import crypto from 'crypto';
import { Router, type Request, type Response } from 'express';
import { adminDb, canManageIntegration, canManageInterview, verifyRlBearer, type RlAccessContext } from './firebaseAdmin.js';

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_REVOKE_URL = 'https://oauth2.googleapis.com/revoke';
const GOOGLE_USERINFO_URL = 'https://www.googleapis.com/oauth2/v2/userinfo';
const GOOGLE_CALENDAR_API = 'https://www.googleapis.com/calendar/v3';
const GOOGLE_SCOPES = ['openid', 'email', 'https://www.googleapis.com/auth/calendar.events'];

function env(name: string): string { return String(process.env[name] || '').trim(); }
function config() {
  const appUrl = (env('APP_URL') || 'http://localhost:3000').replace(/\/$/, '');
  return {
    clientId: env('GOOGLE_CLIENT_ID'),
    clientSecret: env('GOOGLE_CLIENT_SECRET'),
    redirectUri: env('GOOGLE_REDIRECT_URI') || `${appUrl}/api/google/oauth/callback`,
    appUrl,
  };
}
export function googleWorkspaceConfigured() {
  const c = config();
  return Boolean(c.clientId && c.clientSecret && env('GOOGLE_TOKEN_ENCRYPTION_KEY') && env('GOOGLE_OAUTH_STATE_SECRET') && env('FIREBASE_SERVICE_ACCOUNT_JSON'));
}

function encryptionKey(): Buffer {
  const raw = env('GOOGLE_TOKEN_ENCRYPTION_KEY');
  if (!raw) throw new Error('GOOGLE_TOKEN_ENCRYPTION_KEY não configurada.');
  if (/^[a-fA-F0-9]{64}$/.test(raw)) return Buffer.from(raw, 'hex');
  const decoded = Buffer.from(raw, 'base64');
  if (decoded.length === 32) return decoded;
  throw new Error('GOOGLE_TOKEN_ENCRYPTION_KEY deve representar 32 bytes.');
}
function encrypt(value: string, companyId: string) {
  const iv = crypto.randomBytes(12); const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey(), iv);
  cipher.setAAD(Buffer.from(companyId)); const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return `${iv.toString('base64url')}.${cipher.getAuthTag().toString('base64url')}.${encrypted.toString('base64url')}`;
}
function decrypt(value: string, companyId: string) {
  const [iv, tag, payload] = value.split('.'); if (!iv || !tag || !payload) throw new Error('Credencial Google armazenada inválida.');
  const decipher = crypto.createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(iv, 'base64url')); decipher.setAAD(Buffer.from(companyId)); decipher.setAuthTag(Buffer.from(tag, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(payload, 'base64url')), decipher.final()]).toString('utf8');
}
function signState(payload: Record<string, unknown>) {
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', env('GOOGLE_OAUTH_STATE_SECRET')).update(encoded).digest('base64url');
  return `${encoded}.${sig}`;
}
function verifyState(raw: string): { companyId: string; uid: string; nonce: string; exp: number } {
  const [encoded, sig] = raw.split('.'); if (!encoded || !sig) throw new Error('OAuth state inválido.');
  const expected = crypto.createHmac('sha256', env('GOOGLE_OAUTH_STATE_SECRET')).update(encoded).digest('base64url');
  const a = Buffer.from(sig); const b = Buffer.from(expected); if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) throw new Error('OAuth state adulterado.');
  const parsed = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
  if (!parsed.companyId || !parsed.uid || !parsed.nonce || !parsed.exp || Date.now() > Number(parsed.exp)) throw new Error('OAuth state inválido ou expirado.');
  return parsed;
}

async function access(req: Request, companyId?: string) { return verifyRlBearer(req.header('authorization'), companyId); }
function fail(res: Response, error: unknown) {
  const status = Number((error as any)?.statusCode || 500); const message = error instanceof Error ? error.message : String(error);
  res.status(status).json({ success: false, error: message });
}
function integrationRef(companyId: string) { return adminDb().collection('google_workspace_integrations').doc(companyId); }
async function integration(companyId: string) { const snap = await integrationRef(companyId).get(); return snap.exists ? snap.data() : null; }
async function accessTokenFor(companyId: string) {
  const row: any = await integration(companyId); if (!row || row.status !== 'connected') throw Object.assign(new Error('Google Calendar não conectado para esta empresa.'), { statusCode: 409 });
  if (Number(row.expiresAt || 0) > Date.now() + 60_000 && row.accessTokenEnc) return decrypt(row.accessTokenEnc, companyId);
  if (!row.refreshTokenEnc) throw Object.assign(new Error('Autorização Google expirada. Reconecte o Calendar.'), { statusCode: 409 });
  const c = config(); const response = await fetch(GOOGLE_TOKEN_URL, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ client_id: c.clientId, client_secret: c.clientSecret, refresh_token: decrypt(row.refreshTokenEnc, companyId), grant_type: 'refresh_token' }) });
  const tokens: any = await response.json().catch(() => ({})); if (!response.ok || !tokens.access_token) { await integrationRef(companyId).set({ status: 'reauthorization_required', updatedAt: new Date().toISOString() }, { merge: true }); throw Object.assign(new Error(tokens.error_description || 'Não foi possível renovar o Google.'), { statusCode: 409 }); }
  const expiresAt = Date.now() + Number(tokens.expires_in || 3600) * 1000;
  await integrationRef(companyId).set({ accessTokenEnc: encrypt(tokens.access_token, companyId), expiresAt, status: 'connected', updatedAt: new Date().toISOString() }, { merge: true });
  return tokens.access_token as string;
}
async function googleApi(token: string, url: string, init: RequestInit = {}) {
  const response = await fetch(url, { ...init, headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json', ...(init.headers || {}) } });
  const text = await response.text(); let json: any = null; try { json = text ? JSON.parse(text) : null; } catch { json = { error: { message: text } }; }
  return { response, json };
}
function deterministicEventId(companyId: string, interviewId: string) { return crypto.createHash('sha256').update(`${companyId}:${interviewId}`).digest('hex').slice(0, 52); }
function attendees(value: unknown) { const set = new Set<string>(); if (Array.isArray(value)) for (const raw of value) { const email = String(raw || '').trim().toLowerCase(); if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) set.add(email); } return [...set].slice(0, 50).map(email => ({ email })); }
async function audit(ctx: RlAccessContext, details: string) { await adminDb().collection('logs').add({ empresa_id: ctx.companyId, empresaId: ctx.companyId, companyId: ctx.companyId, usuario_id: ctx.uid, usuario_nome: ctx.email, acao: 'EDICAO', detalhes: details, resultado: 'SUCESSO', criado_em: new Date().toISOString() }).catch(() => undefined); }

export function registerGoogleWorkspaceRoutes(app: { use: (...args: any[]) => any }) {
  const router = Router();

  router.get('/workspace', async (req, res) => {
    try {
      const companyId = String(req.query.companyId || '').trim(); const ctx = await access(req, companyId);
      const row: any = await integration(ctx.companyId);
      res.json({ success: true, integration: { companyId: ctx.companyId, status: row?.status || 'disconnected', connectedEmail: row?.connectedEmail || null, calendarId: row?.calendarId || 'primary', connectedAt: row?.connectedAt || null, lastSyncAt: row?.lastSyncAt || null, calendarAvailable: row?.status === 'connected', meetAvailable: row?.status === 'connected' }, configuration: { oauthConfigured: Boolean(config().clientId && config().clientSecret), secureStoreConfigured: Boolean(env('GOOGLE_TOKEN_ENCRYPTION_KEY') && env('FIREBASE_SERVICE_ACCOUNT_JSON')) } });
    } catch (e) { fail(res, e); }
  });

  router.post('/workspace', async (req, res) => {
    try {
      const companyId = String(req.body?.companyId || '').trim(); const ctx = await access(req, companyId);
      if (!canManageIntegration(ctx)) throw Object.assign(new Error('Seu perfil não pode conectar o Google Calendar.'), { statusCode: 403 });
      if (!googleWorkspaceConfigured()) throw Object.assign(new Error('Credenciais Google/Firebase Admin ainda não configuradas no servidor.'), { statusCode: 503 });
      const nonce = crypto.randomBytes(24).toString('base64url'); const exp = Date.now() + 10 * 60_000;
      await adminDb().collection('google_oauth_states').doc(nonce).set({ nonce, companyId: ctx.companyId, uid: ctx.uid, exp, usedAt: null, createdAt: new Date().toISOString() });
      const c = config(); const state = signState({ companyId: ctx.companyId, uid: ctx.uid, nonce, exp });
      const params = new URLSearchParams({ client_id: c.clientId, redirect_uri: c.redirectUri, response_type: 'code', scope: GOOGLE_SCOPES.join(' '), access_type: 'offline', prompt: 'consent', include_granted_scopes: 'true', state });
      res.json({ success: true, authorizationUrl: `${GOOGLE_AUTH_URL}?${params.toString()}` });
    } catch (e) { fail(res, e); }
  });

  router.delete('/workspace', async (req, res) => {
    try {
      const companyId = String(req.body?.companyId || req.query.companyId || '').trim(); const ctx = await access(req, companyId);
      if (!canManageIntegration(ctx)) throw Object.assign(new Error('Seu perfil não pode desconectar o Google Calendar.'), { statusCode: 403 });
      const row: any = await integration(ctx.companyId);
      if (row) {
        const token = row.refreshTokenEnc ? decrypt(row.refreshTokenEnc, ctx.companyId) : row.accessTokenEnc ? decrypt(row.accessTokenEnc, ctx.companyId) : '';
        if (token) await fetch(GOOGLE_REVOKE_URL, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ token }) }).catch(() => undefined);
        await integrationRef(ctx.companyId).delete();
      }
      await audit(ctx, 'Google Calendar desconectado.'); res.json({ success: true, disconnected: true });
    } catch (e) { fail(res, e); }
  });

  router.get('/oauth/callback', async (req, res) => {
    const c = config(); const redirect = (status: string, reason?: string) => { const p = new URLSearchParams({ googleCalendar: status }); if (reason) p.set('reason', reason.slice(0, 180)); res.redirect(`${c.appUrl}/?${p}`); };
    try {
      if (!googleWorkspaceConfigured()) throw new Error('Integração Google não configurada.');
      if (req.query.error) throw new Error(String(req.query.error_description || req.query.error));
      const code = String(req.query.code || ''); const stateRaw = String(req.query.state || ''); if (!code || !stateRaw) throw new Error('Callback OAuth incompleto.');
      const state = verifyState(stateRaw); const stateRef = adminDb().collection('google_oauth_states').doc(state.nonce); const stateSnap = await stateRef.get(); if (!stateSnap.exists) throw new Error('OAuth state não encontrado.');
      const stored: any = stateSnap.data(); if (stored.usedAt) throw new Error('OAuth state já utilizado.'); if (stored.companyId !== state.companyId || stored.uid !== state.uid || Number(stored.exp) < Date.now()) throw new Error('OAuth state não pertence à sessão que iniciou a integração.');
      await stateRef.set({ usedAt: new Date().toISOString() }, { merge: true });
      const tokenResponse = await fetch(GOOGLE_TOKEN_URL, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ code, client_id: c.clientId, client_secret: c.clientSecret, redirect_uri: c.redirectUri, grant_type: 'authorization_code' }) });
      const tokens: any = await tokenResponse.json().catch(() => ({})); if (!tokenResponse.ok || !tokens.access_token) throw new Error(tokens.error_description || 'Google não retornou access token.');
      const infoResponse = await fetch(GOOGLE_USERINFO_URL, { headers: { authorization: `Bearer ${tokens.access_token}` } }); const info: any = infoResponse.ok ? await infoResponse.json() : {};
      const current: any = await integration(state.companyId); const refreshTokenEnc = tokens.refresh_token ? encrypt(tokens.refresh_token, state.companyId) : current?.refreshTokenEnc;
      if (!refreshTokenEnc) throw new Error('Google não retornou refresh token. Reconecte concedendo consentimento.');
      const now = new Date().toISOString(); await integrationRef(state.companyId).set({ empresa_id: state.companyId, empresaId: state.companyId, companyId: state.companyId, connectedEmail: info.email || null, calendarId: 'primary', accessTokenEnc: encrypt(tokens.access_token, state.companyId), refreshTokenEnc, expiresAt: Date.now() + Number(tokens.expires_in || 3600) * 1000, grantedScopes: String(tokens.scope || GOOGLE_SCOPES.join(' ')).split(' ').filter(Boolean), status: 'connected', connectedBy: state.uid, connectedAt: current?.connectedAt || now, updatedAt: now }, { merge: true });
      redirect('connected');
    } catch (e) { console.error('Google OAuth callback', e); redirect('error', e instanceof Error ? e.message : String(e)); }
  });

  router.post('/interviews', async (req, res) => {
    try {
      const companyId = String(req.body?.companyId || req.body?.empresaId || '').trim(); const ctx = await access(req, companyId); if (!canManageInterview(ctx)) throw Object.assign(new Error('Seu perfil não pode agendar entrevistas.'), { statusCode: 403 });
      const interviewId = String(req.body?.interviewId || '').trim(); const title = String(req.body?.title || '').trim(); const start = String(req.body?.start || '').trim(); const end = String(req.body?.end || '').trim(); const timezone = String(req.body?.timezone || 'America/Sao_Paulo');
      if (!interviewId || !title || !start || !end || !Number.isFinite(Date.parse(start)) || !Number.isFinite(Date.parse(end))) throw Object.assign(new Error('Entrevista precisa de id, título, início e fim válidos.'), { statusCode: 400 });
      const token = await accessTokenFor(ctx.companyId); const calendarId = String((await integration(ctx.companyId) as any)?.calendarId || 'primary'); const eventId = deterministicEventId(ctx.companyId, interviewId);
      const body: any = { id: eventId, summary: title.slice(0, 250), description: String(req.body?.description || '').slice(0, 8000), start: { dateTime: new Date(start).toISOString(), timeZone: timezone }, end: { dateTime: new Date(end).toISOString(), timeZone: timezone }, attendees: attendees(req.body?.attendees), extendedProperties: { private: { rlInterviewId: interviewId, rlCompanyId: ctx.companyId, source: 'RL_CONNECT' } }, conferenceData: { createRequest: { requestId: `rl-${eventId}`, conferenceSolutionKey: { type: 'hangoutsMeet' } } } };
      const createUrl = `${GOOGLE_CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events?conferenceDataVersion=1&sendUpdates=all`;
      let result = await googleApi(token, createUrl, { method: 'POST', body: JSON.stringify(body) });
      if (result.response.status === 409) result = await googleApi(token, `${GOOGLE_CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}?conferenceDataVersion=1`);
      if (!result.response.ok || !result.json?.id) throw new Error(result.json?.error?.message || 'Google Calendar recusou o evento.');
      const meetUrl = result.json.hangoutLink || result.json.conferenceData?.entryPoints?.find((x: any) => x.entryPointType === 'video')?.uri || null;
      await adminDb().collection('entrevistas').doc(interviewId).set({ empresa_id: ctx.companyId, empresaId: ctx.companyId, companyId: ctx.companyId, google_event_id: result.json.id, google_calendar_id: calendarId, link_reuniao: meetUrl, google_meet_url: meetUrl, google_event_html_link: result.json.htmlLink || null, sincronizado_gcal: true, integration_status: 'synced', atualizado_em: new Date().toISOString() }, { merge: true });
      await integrationRef(ctx.companyId).set({ lastSyncAt: new Date().toISOString() }, { merge: true }); await audit(ctx, `Entrevista ${interviewId} sincronizada no Google Calendar/Meet.`);
      res.json({ success: true, eventId: result.json.id, calendarId, meetUrl, htmlLink: result.json.htmlLink || null, status: result.json.status || 'confirmed' });
    } catch (e) { fail(res, e); }
  });

  router.patch('/interviews/:eventId', async (req, res) => {
    try {
      const companyId = String(req.body?.companyId || req.body?.empresaId || '').trim(); const ctx = await access(req, companyId); if (!canManageInterview(ctx)) throw Object.assign(new Error('Seu perfil não pode remarcar entrevistas.'), { statusCode: 403 });
      const eventId = String(req.params.eventId || '').trim(); const token = await accessTokenFor(ctx.companyId); const calendarId = String((await integration(ctx.companyId) as any)?.calendarId || 'primary'); const patch: any = {};
      if (req.body?.title) patch.summary = String(req.body.title).slice(0, 250); if (req.body?.start) patch.start = { dateTime: new Date(req.body.start).toISOString(), timeZone: String(req.body.timezone || 'America/Sao_Paulo') }; if (req.body?.end) patch.end = { dateTime: new Date(req.body.end).toISOString(), timeZone: String(req.body.timezone || 'America/Sao_Paulo') }; if (req.body?.attendees) patch.attendees = attendees(req.body.attendees);
      const result = await googleApi(token, `${GOOGLE_CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}?conferenceDataVersion=1&sendUpdates=all`, { method: 'PATCH', body: JSON.stringify(patch) }); if (!result.response.ok) throw new Error(result.json?.error?.message || 'Google recusou a remarcação.');
      const interviewId = String(req.body?.interviewId || ''); if (interviewId) await adminDb().collection('entrevistas').doc(interviewId).set({ data_hora: req.body.start ? new Date(req.body.start).toISOString() : undefined, status: 'remarcada', atualizado_em: new Date().toISOString() }, { merge: true });
      res.json({ success: true, eventId: result.json.id, meetUrl: result.json.hangoutLink || null, htmlLink: result.json.htmlLink || null });
    } catch (e) { fail(res, e); }
  });

  router.delete('/interviews/:eventId', async (req, res) => {
    try {
      const companyId = String(req.query.companyId || '').trim(); const ctx = await access(req, companyId); if (!canManageInterview(ctx)) throw Object.assign(new Error('Seu perfil não pode cancelar entrevistas.'), { statusCode: 403 });
      const eventId = String(req.params.eventId || '').trim(); const token = await accessTokenFor(ctx.companyId); const calendarId = String((await integration(ctx.companyId) as any)?.calendarId || 'primary'); const result = await googleApi(token, `${GOOGLE_CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}?sendUpdates=all`, { method: 'DELETE' }); if (!result.response.ok && result.response.status !== 410 && result.response.status !== 404) throw new Error(result.json?.error?.message || 'Google recusou o cancelamento.');
      const interviewId = String(req.query.interviewId || ''); if (interviewId) await adminDb().collection('entrevistas').doc(interviewId).set({ status: 'cancelada', sincronizado_gcal: false, integration_status: 'cancelled', atualizado_em: new Date().toISOString() }, { merge: true });
      res.json({ success: true, cancelled: true });
    } catch (e) { fail(res, e); }
  });

  app.use('/api/google', router);
}
