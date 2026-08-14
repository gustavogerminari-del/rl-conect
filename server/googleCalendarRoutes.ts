import crypto from 'crypto';
import { Router, type NextFunction, type Request, type Response } from 'express';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

type RlRole = 'master_admin' | 'empresa_admin' | 'recrutador' | 'gestor' | 'headhunter' | 'candidato';

type RlContext = {
  userId: string;
  empresaId: string;
  role: RlRole;
  email: string;
  nome: string;
};

type RlRequest = Request & { rl?: RlContext };

type StoredIntegration = {
  empresa_id: string;
  google_account_email: string | null;
  calendar_id: string;
  access_token_enc: string;
  refresh_token_enc: string | null;
  expires_at: string | null;
  scopes: string[] | null;
  status: 'connected' | 'revoked' | 'error';
  connected_by: string;
  connected_at: string;
  updated_at: string;
};

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_REVOKE_URL = 'https://oauth2.googleapis.com/revoke';
const GOOGLE_USERINFO_URL = 'https://www.googleapis.com/oauth2/v2/userinfo';
const GOOGLE_CALENDAR_API = 'https://www.googleapis.com/calendar/v3';
const GOOGLE_SCOPES = [
  'openid',
  'email',
  'https://www.googleapis.com/auth/calendar.events',
];

function env(name: string): string {
  return (process.env[name] || '').trim();
}

function getSupabaseAdmin(): SupabaseClient | null {
  const url = env('SUPABASE_URL') || env('VITE_SUPABASE_URL');
  const key = env('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function getGoogleConfig() {
  const clientId = env('GOOGLE_CLIENT_ID');
  const clientSecret = env('GOOGLE_CLIENT_SECRET');
  const appUrl = (env('APP_URL') || 'http://localhost:3000').replace(/\/$/, '');
  const redirectUri = env('GOOGLE_REDIRECT_URI') || `${appUrl}/api/integrations/google/calendar/callback`;
  return { clientId, clientSecret, appUrl, redirectUri };
}

function isGoogleConfigured(): boolean {
  const cfg = getGoogleConfig();
  return Boolean(
    cfg.clientId &&
      cfg.clientSecret &&
      env('GOOGLE_TOKEN_ENCRYPTION_KEY') &&
      env('GOOGLE_OAUTH_STATE_SECRET') &&
      getSupabaseAdmin()
  );
}

function parseEncryptionKey(): Buffer {
  const raw = env('GOOGLE_TOKEN_ENCRYPTION_KEY');
  if (!raw) throw new Error('GOOGLE_TOKEN_ENCRYPTION_KEY não configurada.');

  const maybeHex = /^[a-fA-F0-9]{64}$/.test(raw) ? Buffer.from(raw, 'hex') : null;
  if (maybeHex?.length === 32) return maybeHex;

  const maybeBase64 = Buffer.from(raw, 'base64');
  if (maybeBase64.length === 32) return maybeBase64;

  throw new Error('GOOGLE_TOKEN_ENCRYPTION_KEY deve representar exatamente 32 bytes (hex de 64 caracteres ou base64).');
}

function encryptSecret(value: string): string {
  const key = parseEncryptionKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv, tag, encrypted].map((part) => part.toString('base64url')).join('.');
}

function decryptSecret(value: string): string {
  const [ivRaw, tagRaw, encryptedRaw] = value.split('.');
  if (!ivRaw || !tagRaw || !encryptedRaw) throw new Error('Token armazenado inválido.');
  const key = parseEncryptionKey();
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(ivRaw, 'base64url'));
  decipher.setAuthTag(Buffer.from(tagRaw, 'base64url'));
  return Buffer.concat([
    decipher.update(Buffer.from(encryptedRaw, 'base64url')),
    decipher.final(),
  ]).toString('utf8');
}

function timingSafeEqualText(a: string, b: string): boolean {
  const aa = Buffer.from(a);
  const bb = Buffer.from(b);
  return aa.length === bb.length && crypto.timingSafeEqual(aa, bb);
}

function signState(payload: Record<string, unknown>): string {
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto
    .createHmac('sha256', env('GOOGLE_OAUTH_STATE_SECRET'))
    .update(encoded)
    .digest('base64url');
  return `${encoded}.${signature}`;
}

function verifyState(state: string): { empresaId: string; userId: string; nonce: string; exp: number } {
  const [encoded, signature] = state.split('.');
  if (!encoded || !signature) throw new Error('Estado OAuth inválido.');
  const expected = crypto
    .createHmac('sha256', env('GOOGLE_OAUTH_STATE_SECRET'))
    .update(encoded)
    .digest('base64url');
  if (!timingSafeEqualText(signature, expected)) throw new Error('Assinatura OAuth inválida.');
  const parsed = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
  if (!parsed?.empresaId || !parsed?.userId || !parsed?.nonce || !parsed?.exp) {
    throw new Error('Estado OAuth incompleto.');
  }
  if (Date.now() > Number(parsed.exp)) throw new Error('Estado OAuth expirado.');
  return parsed;
}

async function requireRlSession(req: RlRequest, res: Response, next: NextFunction) {
  try {
    const admin = getSupabaseAdmin();
    if (!admin) {
      res.status(503).json({
        error: 'Autenticação real do RL Connect ainda não está configurada no servidor.',
        code: 'RL_AUTH_NOT_CONFIGURED',
      });
      return;
    }

    const authHeader = req.header('authorization') || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
    if (!token) {
      res.status(401).json({ error: 'Faça login normalmente no RL Connect antes de usar a integração Google.', code: 'RL_LOGIN_REQUIRED' });
      return;
    }

    const { data: authData, error: authError } = await admin.auth.getUser(token);
    if (authError || !authData.user) {
      res.status(401).json({ error: 'Sessão do RL Connect inválida ou expirada.', code: 'RL_SESSION_INVALID' });
      return;
    }

    const { data: profile, error: profileError } = await admin
      .from('usuarios')
      .select('id, empresa_id, role, status, email, nome')
      .eq('id', authData.user.id)
      .maybeSingle();

    if (profileError || !profile || profile.status !== 'ativo') {
      res.status(403).json({ error: 'Usuário sem perfil ativo no RL Connect.', code: 'RL_PROFILE_DENIED' });
      return;
    }

    req.rl = {
      userId: profile.id,
      empresaId: profile.empresa_id,
      role: profile.role as RlRole,
      email: profile.email || authData.user.email || '',
      nome: profile.nome || '',
    };
    next();
  } catch (error) {
    console.error('RL session validation failed:', error);
    res.status(500).json({ error: 'Falha ao validar a sessão do RL Connect.' });
  }
}

function requireRoles(...allowed: RlRole[]) {
  return (req: RlRequest, res: Response, next: NextFunction) => {
    if (!req.rl || !allowed.includes(req.rl.role)) {
      res.status(403).json({ error: 'Seu perfil não possui permissão para esta ação.', code: 'RL_PERMISSION_DENIED' });
      return;
    }
    next();
  };
}

async function addAuditLog(admin: SupabaseClient, ctx: RlContext, detalhes: string, resultado: 'SUCESSO' | 'ERRO' = 'SUCESSO') {
  try {
    await admin.from('logs').insert({
      empresa_id: ctx.empresaId,
      usuario_id: ctx.userId,
      usuario_nome: ctx.nome || ctx.email,
      acao: resultado === 'SUCESSO' ? 'EDICAO' : 'FALHA',
      detalhes,
      ip: 'server',
      resultado,
      criado_em: new Date().toISOString(),
    });
  } catch (error) {
    console.warn('Falha não bloqueante ao gravar auditoria:', error);
  }
}

async function getIntegration(admin: SupabaseClient, empresaId: string): Promise<StoredIntegration | null> {
  const { data, error } = await admin
    .from('google_calendar_integrations')
    .select('*')
    .eq('empresa_id', empresaId)
    .maybeSingle();
  if (error) throw error;
  return (data as StoredIntegration | null) || null;
}

async function refreshAccessToken(admin: SupabaseClient, integration: StoredIntegration): Promise<string> {
  const expiresAt = integration.expires_at ? new Date(integration.expires_at).getTime() : 0;
  if (expiresAt > Date.now() + 60_000) return decryptSecret(integration.access_token_enc);

  if (!integration.refresh_token_enc) {
    throw new Error('A autorização Google expirou e não há refresh token. Reconecte o Google Calendar.');
  }

  const { clientId, clientSecret } = getGoogleConfig();
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: decryptSecret(integration.refresh_token_enc),
    grant_type: 'refresh_token',
  });
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
  });
  const json = await response.json() as any;
  if (!response.ok || !json.access_token) {
    await admin
      .from('google_calendar_integrations')
      .update({ status: 'error', updated_at: new Date().toISOString() })
      .eq('empresa_id', integration.empresa_id);
    throw new Error(json.error_description || 'Não foi possível renovar a autorização do Google.');
  }

  const newExpiresAt = new Date(Date.now() + Number(json.expires_in || 3600) * 1000).toISOString();
  await admin
    .from('google_calendar_integrations')
    .update({
      access_token_enc: encryptSecret(json.access_token),
      expires_at: newExpiresAt,
      status: 'connected',
      updated_at: new Date().toISOString(),
    })
    .eq('empresa_id', integration.empresa_id);
  return json.access_token;
}

function safeAttendees(value: unknown): Array<{ email: string }> {
  if (!Array.isArray(value)) return [];
  const unique = new Set<string>();
  for (const item of value) {
    const email = typeof item === 'string' ? item.trim().toLowerCase() : '';
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) unique.add(email);
  }
  return [...unique].slice(0, 50).map((email) => ({ email }));
}

function deterministicGoogleEventId(empresaId: string, interviewId: string): string {
  return crypto.createHash('sha256').update(`${empresaId}:${interviewId}`).digest('hex').slice(0, 52);
}

async function googleApi(accessToken: string, url: string, init: RequestInit = {}) {
  const response = await fetch(url, {
    ...init,
    headers: {
      authorization: `Bearer ${accessToken}`,
      'content-type': 'application/json',
      ...(init.headers || {}),
    },
  });
  const text = await response.text();
  const json = text ? JSON.parse(text) : null;
  return { response, json };
}

export function registerGoogleCalendarRoutes(app: { use: (...args: any[]) => any }) {
  const router = Router();

  router.get('/status', requireRlSession, async (req: RlRequest, res) => {
    try {
      if (!isGoogleConfigured()) {
        res.json({
          configured: false,
          connected: false,
          message: 'Credenciais Google/Supabase ainda não configuradas no servidor.',
        });
        return;
      }
      const admin = getSupabaseAdmin()!;
      const integration = await getIntegration(admin, req.rl!.empresaId);
      res.json({
        configured: true,
        connected: integration?.status === 'connected',
        accountEmail: integration?.google_account_email || null,
        calendarId: integration?.calendar_id || 'primary',
        status: integration?.status || 'disconnected',
        updatedAt: integration?.updated_at || null,
      });
    } catch (error) {
      console.error('Google status error:', error);
      res.status(500).json({ error: 'Não foi possível consultar a integração Google.' });
    }
  });

  router.post(
    '/auth-url',
    requireRlSession,
    requireRoles('master_admin', 'empresa_admin'),
    async (req: RlRequest, res) => {
      try {
        if (!isGoogleConfigured()) {
          res.status(503).json({ error: 'Google Calendar ainda não foi configurado no servidor.', code: 'GOOGLE_NOT_CONFIGURED' });
          return;
        }
        const admin = getSupabaseAdmin()!;
        const cfg = getGoogleConfig();
        const nonce = crypto.randomBytes(24).toString('base64url');
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
        const state = signState({
          empresaId: req.rl!.empresaId,
          userId: req.rl!.userId,
          nonce,
          exp: expiresAt.getTime(),
        });

        const { error: stateError } = await admin.from('google_oauth_states').insert({
          nonce,
          empresa_id: req.rl!.empresaId,
          usuario_id: req.rl!.userId,
          expires_at: expiresAt.toISOString(),
        });
        if (stateError) throw stateError;

        const params = new URLSearchParams({
          client_id: cfg.clientId,
          redirect_uri: cfg.redirectUri,
          response_type: 'code',
          scope: GOOGLE_SCOPES.join(' '),
          access_type: 'offline',
          prompt: 'consent',
          include_granted_scopes: 'true',
          state,
        });

        res.json({ authUrl: `${GOOGLE_AUTH_URL}?${params.toString()}` });
      } catch (error) {
        console.error('Google auth-url error:', error);
        res.status(500).json({ error: 'Não foi possível iniciar a autorização do Google Calendar.' });
      }
    }
  );

  router.get('/callback', async (req, res) => {
    const cfg = getGoogleConfig();
    const redirect = (result: string, reason?: string) => {
      const params = new URLSearchParams({ googleCalendar: result });
      if (reason) params.set('reason', reason.slice(0, 160));
      res.redirect(`${cfg.appUrl}/?${params.toString()}`);
    };

    try {
      if (!isGoogleConfigured()) {
        redirect('error', 'Integração Google não configurada no servidor.');
        return;
      }
      const admin = getSupabaseAdmin()!;
      const code = typeof req.query.code === 'string' ? req.query.code : '';
      const stateRaw = typeof req.query.state === 'string' ? req.query.state : '';
      const oauthError = typeof req.query.error === 'string' ? req.query.error : '';
      if (oauthError) {
        redirect('error', oauthError);
        return;
      }
      if (!code || !stateRaw) throw new Error('Callback OAuth incompleto.');

      const state = verifyState(stateRaw);
      const { data: dbState, error: dbStateError } = await admin
        .from('google_oauth_states')
        .select('nonce, empresa_id, usuario_id, expires_at, used_at')
        .eq('nonce', state.nonce)
        .maybeSingle();
      if (dbStateError || !dbState) throw new Error('Estado OAuth não encontrado.');
      if (dbState.used_at) throw new Error('Estado OAuth já utilizado.');
      if (dbState.empresa_id !== state.empresaId || dbState.usuario_id !== state.userId) {
        throw new Error('Estado OAuth não pertence à sessão RL Connect que iniciou a integração.');
      }
      if (new Date(dbState.expires_at).getTime() < Date.now()) throw new Error('Estado OAuth expirado.');
      await admin.from('google_oauth_states').update({ used_at: new Date().toISOString() }).eq('nonce', state.nonce);

      const tokenResponse = await fetch(GOOGLE_TOKEN_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: cfg.clientId,
          client_secret: cfg.clientSecret,
          redirect_uri: cfg.redirectUri,
          grant_type: 'authorization_code',
        }),
      });
      const tokens = await tokenResponse.json() as any;
      if (!tokenResponse.ok || !tokens.access_token) {
        throw new Error(tokens.error_description || 'Google não retornou access token.');
      }

      const userInfoResponse = await fetch(GOOGLE_USERINFO_URL, {
        headers: { authorization: `Bearer ${tokens.access_token}` },
      });
      const userInfo = userInfoResponse.ok ? await userInfoResponse.json() as any : {};
      const existing = await getIntegration(admin, state.empresaId);
      const refreshToken = tokens.refresh_token
        ? encryptSecret(tokens.refresh_token)
        : existing?.refresh_token_enc || null;
      if (!refreshToken) throw new Error('Google não retornou refresh token. Autorize novamente com consentimento completo.');

      const now = new Date().toISOString();
      const integration = {
        empresa_id: state.empresaId,
        google_account_email: userInfo.email || null,
        calendar_id: 'primary',
        access_token_enc: encryptSecret(tokens.access_token),
        refresh_token_enc: refreshToken,
        expires_at: new Date(Date.now() + Number(tokens.expires_in || 3600) * 1000).toISOString(),
        scopes: String(tokens.scope || GOOGLE_SCOPES.join(' ')).split(' ').filter(Boolean),
        status: 'connected',
        connected_by: state.userId,
        connected_at: existing?.connected_at || now,
        updated_at: now,
      };
      const { error: upsertError } = await admin
        .from('google_calendar_integrations')
        .upsert(integration, { onConflict: 'empresa_id' });
      if (upsertError) throw upsertError;

      const { data: profile } = await admin
        .from('usuarios')
        .select('id, empresa_id, role, email, nome')
        .eq('id', state.userId)
        .maybeSingle();
      if (profile) {
        await addAuditLog(admin, {
          userId: profile.id,
          empresaId: profile.empresa_id,
          role: profile.role as RlRole,
          email: profile.email || '',
          nome: profile.nome || '',
        }, `Google Calendar conectado à conta ${userInfo.email || 'Google'} para a empresa ${state.empresaId}.`);
      }
      redirect('connected');
    } catch (error) {
      console.error('Google OAuth callback error:', error);
      redirect('error', error instanceof Error ? error.message : 'Falha na autorização Google.');
    }
  });

  router.post(
    '/disconnect',
    requireRlSession,
    requireRoles('master_admin', 'empresa_admin'),
    async (req: RlRequest, res) => {
      try {
        const admin = getSupabaseAdmin();
        if (!admin) {
          res.status(503).json({ error: 'Supabase de produção não configurado.' });
          return;
        }
        const integration = await getIntegration(admin, req.rl!.empresaId);
        if (integration) {
          const tokenToRevoke = integration.refresh_token_enc
            ? decryptSecret(integration.refresh_token_enc)
            : decryptSecret(integration.access_token_enc);
          try {
            await fetch(GOOGLE_REVOKE_URL, {
              method: 'POST',
              headers: { 'content-type': 'application/x-www-form-urlencoded' },
              body: new URLSearchParams({ token: tokenToRevoke }),
            });
          } catch (error) {
            console.warn('Google revoke failed; removing local authorization anyway:', error);
          }
          await admin.from('google_calendar_integrations').delete().eq('empresa_id', req.rl!.empresaId);
          await addAuditLog(admin, req.rl!, 'Google Calendar desconectado da empresa.');
        }
        res.json({ disconnected: true });
      } catch (error) {
        console.error('Google disconnect error:', error);
        res.status(500).json({ error: 'Não foi possível desconectar o Google Calendar.' });
      }
    }
  );

  router.post(
    '/events',
    requireRlSession,
    requireRoles('master_admin', 'empresa_admin', 'recrutador', 'gestor', 'headhunter'),
    async (req: RlRequest, res) => {
      try {
        const admin = getSupabaseAdmin();
        if (!admin) {
          res.status(503).json({ error: 'Supabase de produção não configurado.' });
          return;
        }
        const integration = await getIntegration(admin, req.rl!.empresaId);
        if (!integration || integration.status !== 'connected') {
          res.status(409).json({ error: 'Google Calendar não conectado para esta empresa.', code: 'GOOGLE_NOT_CONNECTED' });
          return;
        }

        const title = String(req.body?.title || '').trim();
        const start = String(req.body?.start || '').trim();
        const end = String(req.body?.end || '').trim();
        const timezone = String(req.body?.timezone || 'America/Sao_Paulo').trim();
        const interviewId = String(req.body?.interviewId || '').trim();
        const createMeet = req.body?.createMeet !== false;
        if (!title || !start || !end || !interviewId) {
          res.status(400).json({ error: 'title, start, end e interviewId são obrigatórios.' });
          return;
        }
        if (!Number.isFinite(new Date(start).getTime()) || !Number.isFinite(new Date(end).getTime())) {
          res.status(400).json({ error: 'Data/hora inválida.' });
          return;
        }

        const accessToken = await refreshAccessToken(admin, integration);
        const calendarId = integration.calendar_id || 'primary';
        const eventId = deterministicGoogleEventId(req.rl!.empresaId, interviewId);
        const eventBody: any = {
          id: eventId,
          summary: title.slice(0, 250),
          description: String(req.body?.description || '').slice(0, 8000),
          start: { dateTime: new Date(start).toISOString(), timeZone: timezone },
          end: { dateTime: new Date(end).toISOString(), timeZone: timezone },
          attendees: safeAttendees(req.body?.attendees),
          extendedProperties: {
            private: {
              rlInterviewId: interviewId,
              rlEmpresaId: req.rl!.empresaId,
              source: 'RL_CONNECT',
            },
          },
        };
        if (createMeet) {
          eventBody.conferenceData = {
            createRequest: {
              requestId: crypto.randomUUID(),
              conferenceSolutionKey: { type: 'hangoutsMeet' },
            },
          };
        }

        const url = `${GOOGLE_CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events?conferenceDataVersion=1&sendUpdates=all`;
        let result = await googleApi(accessToken, url, { method: 'POST', body: JSON.stringify(eventBody) });
        if (result.response.status === 409) {
          result = await googleApi(
            accessToken,
            `${GOOGLE_CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`
          );
        }
        if (!result.response.ok || !result.json?.id) {
          throw new Error(result.json?.error?.message || 'Google Calendar recusou a criação do evento.');
        }

        await addAuditLog(admin, req.rl!, `Evento Google Calendar criado/recuperado para entrevista ${interviewId}.`);
        res.json({
          eventId: result.json.id,
          calendarId,
          meetUrl: result.json.hangoutLink || result.json.conferenceData?.entryPoints?.find((p: any) => p.entryPointType === 'video')?.uri || null,
          htmlLink: result.json.htmlLink || null,
          status: result.json.status || 'confirmed',
        });
      } catch (error) {
        console.error('Google event create error:', error);
        res.status(500).json({ error: error instanceof Error ? error.message : 'Falha ao criar evento Google.' });
      }
    }
  );

  router.patch(
    '/events/:eventId',
    requireRlSession,
    requireRoles('master_admin', 'empresa_admin', 'recrutador', 'gestor', 'headhunter'),
    async (req: RlRequest, res) => {
      try {
        const admin = getSupabaseAdmin();
        if (!admin) {
          res.status(503).json({ error: 'Supabase de produção não configurado.' });
          return;
        }
        const integration = await getIntegration(admin, req.rl!.empresaId);
        if (!integration || integration.status !== 'connected') {
          res.status(409).json({ error: 'Google Calendar não conectado para esta empresa.' });
          return;
        }
        const eventId = String(req.params.eventId || '').trim();
        if (!eventId) {
          res.status(400).json({ error: 'eventId obrigatório.' });
          return;
        }
        const timezone = String(req.body?.timezone || 'America/Sao_Paulo').trim();
        const patch: any = {};
        if (req.body?.title) patch.summary = String(req.body.title).slice(0, 250);
        if (req.body?.description !== undefined) patch.description = String(req.body.description).slice(0, 8000);
        if (req.body?.start) patch.start = { dateTime: new Date(req.body.start).toISOString(), timeZone: timezone };
        if (req.body?.end) patch.end = { dateTime: new Date(req.body.end).toISOString(), timeZone: timezone };
        if (req.body?.attendees) patch.attendees = safeAttendees(req.body.attendees);

        const accessToken = await refreshAccessToken(admin, integration);
        const calendarId = integration.calendar_id || 'primary';
        const { response, json } = await googleApi(
          accessToken,
          `${GOOGLE_CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}?conferenceDataVersion=1&sendUpdates=all`,
          { method: 'PATCH', body: JSON.stringify(patch) }
        );
        if (!response.ok) throw new Error(json?.error?.message || 'Google Calendar recusou a atualização.');
        await addAuditLog(admin, req.rl!, `Evento Google Calendar ${eventId} atualizado.`);
        res.json({
          eventId: json.id,
          meetUrl: json.hangoutLink || json.conferenceData?.entryPoints?.find((p: any) => p.entryPointType === 'video')?.uri || null,
          htmlLink: json.htmlLink || null,
          status: json.status,
        });
      } catch (error) {
        console.error('Google event update error:', error);
        res.status(500).json({ error: error instanceof Error ? error.message : 'Falha ao atualizar evento Google.' });
      }
    }
  );

  router.delete(
    '/events/:eventId',
    requireRlSession,
    requireRoles('master_admin', 'empresa_admin', 'recrutador', 'gestor', 'headhunter'),
    async (req: RlRequest, res) => {
      try {
        const admin = getSupabaseAdmin();
        if (!admin) {
          res.status(503).json({ error: 'Supabase de produção não configurado.' });
          return;
        }
        const integration = await getIntegration(admin, req.rl!.empresaId);
        if (!integration || integration.status !== 'connected') {
          res.status(409).json({ error: 'Google Calendar não conectado para esta empresa.' });
          return;
        }
        const eventId = String(req.params.eventId || '').trim();
        const accessToken = await refreshAccessToken(admin, integration);
        const calendarId = integration.calendar_id || 'primary';
        const response = await fetch(
          `${GOOGLE_CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}?sendUpdates=all`,
          { method: 'DELETE', headers: { authorization: `Bearer ${accessToken}` } }
        );
        if (![204, 404, 410].includes(response.status)) {
          const text = await response.text();
          throw new Error(text || 'Google Calendar recusou o cancelamento.');
        }
        await addAuditLog(admin, req.rl!, `Evento Google Calendar ${eventId} cancelado/removido.`);
        res.json({ deleted: true });
      } catch (error) {
        console.error('Google event delete error:', error);
        res.status(500).json({ error: error instanceof Error ? error.message : 'Falha ao cancelar evento Google.' });
      }
    }
  );

  app.use('/api/integrations/google/calendar', router);
}

export { isGoogleConfigured };
