const JSON_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
};

const GOOGLE_SCOPES = [
  'openid',
  'email',
  'https://www.googleapis.com/auth/calendar.events',
];

const ALLOWED_ROLES = new Set([
  'MASTER', 'MASTER_ADMIN', 'SUPER_ADMINISTRADOR', 'SUPER ADMINISTRADOR',
  'ADMIN_EMPRESA', 'EMPRESA_ADMIN', 'ADMINISTRADOR_EMPRESA', 'ADMINISTRADOR DA EMPRESA', 'ADMIN',
  'RH', 'DP', 'GESTOR', 'HEADHUNTER', 'RECRUTADOR', 'RECRUTAMENTO',
  'RECRUTAMENTO_HEADHUNTER', 'RECRUTAMENTO / HEADHUNTER', 'RECRUTAMENTO/HEADHUNTER',
  'ANALISTA_DE_RH', 'ANALISTA RH', 'GESTOR_DE_SELEÇÃO', 'GESTOR DE SELECAO',
]);

const MASTER_ROLES = new Set(['MASTER', 'MASTER_ADMIN', 'SUPER_ADMINISTRADOR', 'SUPER ADMINISTRADOR']);

type ServiceAccount = {
  project_id: string;
  client_email: string;
  private_key: string;
  token_uri?: string;
};

type RlAccess = {
  uid: string;
  email: string;
  companyId: string;
  role: string;
};

type GoogleIntegration = Record<string, any>;

type GoogleConfig = {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  stateSecret: string;
};

const normalizeRole = (value: unknown) =>
  String(value || '').trim().toUpperCase().replace(/[\s-]+/g, '_');

const tenantFrom = (data: any) =>
  String(data?.empresa_id || data?.empresaId || data?.companyId || data?.tenantId || '').trim();

const profileActive = (profile: any) => {
  const status = String(profile?.status || '').trim().toUpperCase();
  return profile?.ativo !== false && !['INATIVO', 'BLOQUEADO', 'SUSPENSO', 'DESATIVADO'].includes(status);
};

function base64UrlBytes(bytes: Uint8Array) {
  let raw = '';
  bytes.forEach((byte) => { raw += String.fromCharCode(byte); });
  return btoa(raw).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64UrlText(value: string) {
  return base64UrlBytes(new TextEncoder().encode(value));
}

function fromBase64Url(value: string) {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (value.length % 4)) % 4);
  return Uint8Array.from(atob(padded), (char) => char.charCodeAt(0));
}

function bytesToBase64(bytes: Uint8Array) {
  let raw = '';
  bytes.forEach((byte) => { raw += String.fromCharCode(byte); });
  return btoa(raw);
}

function base64ToBytes(value: string) {
  return Uint8Array.from(atob(value), (char) => char.charCodeAt(0));
}

function pemToPkcs8(privateKey: string) {
  const body = privateKey
    .replace(/-----BEGIN PRIVATE KEY-----/g, '')
    .replace(/-----END PRIVATE KEY-----/g, '')
    .replace(/\s+/g, '');
  return Uint8Array.from(atob(body), (char) => char.charCodeAt(0));
}

function serviceAccountFromEnvironment(): ServiceAccount {
  const raw = String(process.env.FIREBASE_SERVICE_ACCOUNT_JSON || '').trim();
  if (raw) {
    const parsed = JSON.parse(raw) as Partial<ServiceAccount>;
    if (parsed.project_id && parsed.client_email && parsed.private_key) {
      return {
        project_id: String(parsed.project_id),
        client_email: String(parsed.client_email),
        private_key: String(parsed.private_key).replace(/\\n/g, '\n'),
        token_uri: String(parsed.token_uri || 'https://oauth2.googleapis.com/token'),
      };
    }
  }

  const projectId = String(process.env.FIREBASE_ADMIN_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID || 'rl-connect-ed797').trim();
  const clientEmail = String(process.env.FIREBASE_ADMIN_CLIENT_EMAIL || '').trim();
  const privateKey = String(process.env.FIREBASE_ADMIN_PRIVATE_KEY || '').replace(/\\n/g, '\n').trim();
  if (!projectId || !clientEmail || !privateKey) {
    throw new Error('Firebase Admin não está configurado no servidor. Configure FIREBASE_SERVICE_ACCOUNT_JSON.');
  }
  return { project_id: projectId, client_email: clientEmail, private_key: privateKey, token_uri: 'https://oauth2.googleapis.com/token' };
}

async function getGoogleAdminAccessToken(serviceAccount: ServiceAccount) {
  const tokenUri = serviceAccount.token_uri || 'https://oauth2.googleapis.com/token';
  const now = Math.floor(Date.now() / 1000);
  const header = base64UrlText(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const payload = base64UrlText(JSON.stringify({
    iss: serviceAccount.client_email,
    scope: 'https://www.googleapis.com/auth/cloud-platform https://www.googleapis.com/auth/datastore',
    aud: tokenUri,
    iat: now,
    exp: now + 3600,
  }));
  const unsigned = `${header}.${payload}`;
  const key = await crypto.subtle.importKey(
    'pkcs8',
    pemToPkcs8(serviceAccount.private_key),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(unsigned));
  const assertion = `${unsigned}.${base64UrlBytes(new Uint8Array(signature))}`;
  const response = await fetch(tokenUri, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
    signal: AbortSignal.timeout(15000),
  });
  const data: any = await response.json().catch(() => ({}));
  if (!response.ok || !data.access_token) throw new Error('Não foi possível autenticar o Firebase Admin.');
  return String(data.access_token);
}

const firestoreDocUrl = (projectId: string, collectionName: string, id: string) =>
  `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/databases/(default)/documents/${encodeURIComponent(collectionName)}/${encodeURIComponent(id)}`;

function decodeValue(value: any): any {
  if (!value || typeof value !== 'object') return undefined;
  if ('nullValue' in value) return null;
  if ('stringValue' in value) return value.stringValue;
  if ('booleanValue' in value) return value.booleanValue;
  if ('integerValue' in value) return Number(value.integerValue);
  if ('doubleValue' in value) return Number(value.doubleValue);
  if ('timestampValue' in value) return value.timestampValue;
  if ('arrayValue' in value) return (value.arrayValue?.values || []).map(decodeValue);
  if ('mapValue' in value) {
    return Object.fromEntries(Object.entries(value.mapValue?.fields || {}).map(([key, nested]) => [key, decodeValue(nested)]));
  }
  return undefined;
}

function encodeValue(value: any): any {
  if (value === null || value === undefined) return { nullValue: null };
  if (typeof value === 'string') return { stringValue: value };
  if (typeof value === 'boolean') return { booleanValue: value };
  if (typeof value === 'number') return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value };
  if (Array.isArray(value)) return { arrayValue: { values: value.map(encodeValue) } };
  if (typeof value === 'object') {
    return { mapValue: { fields: Object.fromEntries(Object.entries(value).map(([key, nested]) => [key, encodeValue(nested)])) } };
  }
  return { stringValue: String(value) };
}

async function readDocument(projectId: string, adminToken: string, collectionName: string, id: string) {
  const response = await fetch(firestoreDocUrl(projectId, collectionName, id), {
    headers: { Authorization: `Bearer ${adminToken}` },
    signal: AbortSignal.timeout(10000),
  });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Não foi possível consultar ${collectionName}/${id}.`);
  const payload: any = await response.json();
  return Object.fromEntries(Object.entries(payload.fields || {}).map(([key, value]) => [key, decodeValue(value)]));
}

async function writeDocument(projectId: string, adminToken: string, collectionName: string, id: string, data: Record<string, any>) {
  const response = await fetch(firestoreDocUrl(projectId, collectionName, id), {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: Object.fromEntries(Object.entries(data).map(([key, value]) => [key, encodeValue(value)])) }),
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) {
    const details = await response.text().catch(() => '');
    throw new Error(`Não foi possível salvar ${collectionName}/${id}. ${details.slice(0, 180)}`);
  }
}

async function deleteDocument(projectId: string, adminToken: string, collectionName: string, id: string) {
  const response = await fetch(firestoreDocUrl(projectId, collectionName, id), {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${adminToken}` },
    signal: AbortSignal.timeout(10000),
  });
  if (response.status !== 404 && !response.ok) throw new Error(`Não foi possível excluir ${collectionName}/${id}.`);
}

async function requireRlAccess(request: Request, adminToken: string, serviceAccount: ServiceAccount, requestedCompanyId?: string): Promise<RlAccess> {
  const idToken = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim();
  const apiKey = String(process.env.VITE_FIREBASE_API_KEY || process.env.FIREBASE_API_KEY || 'AIzaSyBTaAot1PUq8rqX9_PShE0gIUyoptkcuWQ').trim();
  if (!idToken) throw new Error('Sessão Firebase obrigatória.');

  const lookup = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(apiKey)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken }),
    signal: AbortSignal.timeout(10000),
  });
  if (!lookup.ok) throw new Error('Sessão Firebase inválida ou expirada.');
  const account: any = await lookup.json();
  const uid = String(account.users?.[0]?.localId || '').trim();
  const email = String(account.users?.[0]?.email || '').trim();
  if (!uid) throw new Error('Usuário Firebase não identificado.');

  const primary = await readDocument(serviceAccount.project_id, adminToken, 'usuarios', uid);
  const legacy = primary ? null : await readDocument(serviceAccount.project_id, adminToken, 'users', uid);
  const profile = primary || legacy;
  if (!profile || !profileActive(profile)) throw new Error('Perfil inexistente, inativo ou bloqueado.');

  const role = normalizeRole(profile.role || profile.tipoUsuario);
  if (!ALLOWED_ROLES.has(role)) throw new Error('Seu perfil não possui acesso à Agenda/Google Workspace.');

  const profileCompanyId = tenantFrom(profile);
  const requested = String(requestedCompanyId || '').trim();
  let companyId = profileCompanyId;
  if (MASTER_ROLES.has(role)) companyId = requested || profileCompanyId;
  if (!companyId) throw new Error('Empresa não identificada para a integração Google Workspace.');
  if (!MASTER_ROLES.has(role) && requested && requested !== profileCompanyId) throw new Error('A integração solicitada pertence a outra empresa.');

  return { uid, email, companyId, role };
}

function appOrigin(request: Request) {
  const configured = String(process.env.APP_URL || '').trim().replace(/\/$/, '');
  return configured || new URL(request.url).origin;
}

function safeReturnPath(value: unknown) {
  const path = String(value || '/?tab=agenda').trim();
  if (!path.startsWith('/') || path.startsWith('//')) return '/?tab=agenda';
  return path.slice(0, 1200);
}

function googleConfig(request: Request): GoogleConfig {
  const clientId = String(process.env.GOOGLE_OAUTH_CLIENT_ID || '').trim();
  const clientSecret = String(process.env.GOOGLE_OAUTH_CLIENT_SECRET || '').trim();
  const redirectUri = String(process.env.GOOGLE_OAUTH_REDIRECT_URI || `${appOrigin(request)}/api/google/workspace/callback`).trim();
  const stateSecret = String(process.env.GOOGLE_OAUTH_STATE_SECRET || '').trim();
  if (!clientId || !clientSecret) throw new Error('Google Workspace não configurado: faltam GOOGLE_OAUTH_CLIENT_ID/GOOGLE_OAUTH_CLIENT_SECRET.');
  if (!stateSecret || stateSecret.length < 24) throw new Error('Google Workspace não configurado: GOOGLE_OAUTH_STATE_SECRET precisa ter pelo menos 24 caracteres.');
  return { clientId, clientSecret, redirectUri, stateSecret };
}

async function encryptionKey() {
  const encoded = String(process.env.GOOGLE_WORKSPACE_ENCRYPTION_KEY || '').trim();
  if (!encoded) throw new Error('Google Workspace não configurado: falta GOOGLE_WORKSPACE_ENCRYPTION_KEY.');
  const bytes = base64ToBytes(encoded);
  if (bytes.byteLength !== 32) throw new Error('GOOGLE_WORKSPACE_ENCRYPTION_KEY precisa ser Base64 de exatamente 32 bytes.');
  return crypto.subtle.importKey('raw', bytes, 'AES-GCM', false, ['encrypt', 'decrypt']);
}

async function encryptSecret(secret: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await encryptionKey(), new TextEncoder().encode(secret));
  return { cipher: bytesToBase64(new Uint8Array(encrypted)), iv: bytesToBase64(iv) };
}

async function decryptSecret(cipher: string, iv: string) {
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: base64ToBytes(iv) },
    await encryptionKey(),
    base64ToBytes(cipher),
  );
  return new TextDecoder().decode(decrypted);
}

async function signState(payloadPart: string, secret: string) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payloadPart));
  return base64UrlBytes(new Uint8Array(signature));
}

async function createSignedState(data: Record<string, any>, secret: string) {
  const payload = base64UrlText(JSON.stringify(data));
  return `${payload}.${await signState(payload, secret)}`;
}

async function verifySignedState(state: string, secret: string) {
  const [payload, suppliedSignature] = String(state || '').split('.');
  if (!payload || !suppliedSignature) throw new Error('Estado OAuth inválido.');
  const expected = await signState(payload, secret);
  if (expected.length !== suppliedSignature.length) throw new Error('Assinatura OAuth inválida.');
  let mismatch = 0;
  for (let i = 0; i < expected.length; i += 1) mismatch |= expected.charCodeAt(i) ^ suppliedSignature.charCodeAt(i);
  if (mismatch !== 0) throw new Error('Assinatura OAuth inválida.');
  const decoded = new TextDecoder().decode(fromBase64Url(payload));
  const parsed = JSON.parse(decoded);
  if (!parsed?.nonce || !parsed?.uid || !parsed?.companyId || Number(parsed?.exp || 0) < Date.now()) throw new Error('Estado OAuth expirado ou incompleto.');
  return parsed;
}

async function sha256Base64Url(value: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return base64UrlBytes(new Uint8Array(digest));
}

export async function startGoogleWorkspaceOAuth(request: Request, body: any) {
  const serviceAccount = serviceAccountFromEnvironment();
  const adminToken = await getGoogleAdminAccessToken(serviceAccount);
  const access = await requireRlAccess(request, adminToken, serviceAccount, body?.companyId);
  const config = googleConfig(request);
  await encryptionKey();

  const nonce = base64UrlBytes(crypto.getRandomValues(new Uint8Array(24)));
  const codeVerifier = base64UrlBytes(crypto.getRandomValues(new Uint8Array(48)));
  const codeChallenge = await sha256Base64Url(codeVerifier);
  const returnTo = safeReturnPath(body?.returnTo);
  const expiresAt = Date.now() + 10 * 60 * 1000;

  await writeDocument(serviceAccount.project_id, adminToken, 'google_oauth_states', nonce, {
    id: nonce,
    uid: access.uid,
    companyId: access.companyId,
    empresaId: access.companyId,
    returnTo,
    codeVerifier,
    expiresAt,
    createdAt: new Date().toISOString(),
  });

  const state = await createSignedState({ nonce, uid: access.uid, companyId: access.companyId, exp: expiresAt }, config.stateSecret);
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: 'code',
    scope: GOOGLE_SCOPES.join(' '),
    access_type: 'offline',
    include_granted_scopes: 'true',
    prompt: 'consent',
    state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
  });

  return { authorizationUrl: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`, connectedCompanyId: access.companyId };
}

async function exchangeAuthorizationCode(config: GoogleConfig, code: string, codeVerifier: string) {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: config.redirectUri,
      grant_type: 'authorization_code',
      code_verifier: codeVerifier,
    }),
    signal: AbortSignal.timeout(15000),
  });
  const payload: any = await response.json().catch(() => ({}));
  if (!response.ok || !payload.access_token) throw new Error(payload.error_description || payload.error || 'Google recusou a troca do código OAuth.');
  return payload;
}

async function googleAccountEmail(accessToken: string) {
  const response = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) return '';
  const payload: any = await response.json().catch(() => ({}));
  return String(payload.email || '').trim();
}

export async function handleGoogleWorkspaceCallback(request: Request) {
  const url = new URL(request.url);
  const code = String(url.searchParams.get('code') || '').trim();
  const stateRaw = String(url.searchParams.get('state') || '').trim();
  const oauthError = String(url.searchParams.get('error') || '').trim();
  const config = googleConfig(request);
  const serviceAccount = serviceAccountFromEnvironment();
  const adminToken = await getGoogleAdminAccessToken(serviceAccount);
  let returnTo = '/?tab=agenda';

  try {
    if (oauthError) throw new Error(`Google não autorizou a conexão: ${oauthError}.`);
    if (!code || !stateRaw) throw new Error('Retorno OAuth sem código ou estado.');
    const state = await verifySignedState(stateRaw, config.stateSecret);
    const stateDoc = await readDocument(serviceAccount.project_id, adminToken, 'google_oauth_states', state.nonce);
    if (!stateDoc || stateDoc.uid !== state.uid || stateDoc.companyId !== state.companyId || Number(stateDoc.expiresAt || 0) < Date.now()) {
      throw new Error('A autorização Google expirou ou já foi utilizada.');
    }
    returnTo = safeReturnPath(stateDoc.returnTo);
    await deleteDocument(serviceAccount.project_id, adminToken, 'google_oauth_states', state.nonce);

    const tokens = await exchangeAuthorizationCode(config, code, String(stateDoc.codeVerifier || ''));
    const existing = await readDocument(serviceAccount.project_id, adminToken, 'google_workspace_integrations', state.companyId) || {};
    const encryptedAccess = await encryptSecret(String(tokens.access_token));
    let refreshCipher = String(existing.refreshTokenCipher || '');
    let refreshIv = String(existing.refreshTokenIv || '');
    if (tokens.refresh_token) {
      const encryptedRefresh = await encryptSecret(String(tokens.refresh_token));
      refreshCipher = encryptedRefresh.cipher;
      refreshIv = encryptedRefresh.iv;
    }
    if (!refreshCipher || !refreshIv) throw new Error('Google não devolveu refresh token. Revogue o acesso anterior e conecte novamente.');
    const connectedEmail = await googleAccountEmail(String(tokens.access_token));
    const expiresAt = Date.now() + Number(tokens.expires_in || 3600) * 1000;

    await writeDocument(serviceAccount.project_id, adminToken, 'google_workspace_integrations', state.companyId, {
      ...existing,
      id: state.companyId,
      companyId: state.companyId,
      empresaId: state.companyId,
      empresa_id: state.companyId,
      tenantId: state.companyId,
      provider: 'google_workspace',
      status: 'CONNECTED',
      connectedByUid: state.uid,
      connectedEmail,
      scopes: String(tokens.scope || GOOGLE_SCOPES.join(' ')).split(/\s+/).filter(Boolean),
      accessTokenCipher: encryptedAccess.cipher,
      accessTokenIv: encryptedAccess.iv,
      refreshTokenCipher: refreshCipher,
      refreshTokenIv: refreshIv,
      expiresAt,
      updatedAt: new Date().toISOString(),
      createdAt: existing.createdAt || new Date().toISOString(),
    });

    const redirect = new URL(returnTo, appOrigin(request));
    redirect.searchParams.set('tab', 'agenda');
    redirect.searchParams.set('googleWorkspace', 'connected');
    return Response.redirect(redirect.toString(), 302);
  } catch (error: any) {
    const redirect = new URL(returnTo, appOrigin(request));
    redirect.searchParams.set('tab', 'agenda');
    redirect.searchParams.set('googleWorkspace', 'error');
    redirect.searchParams.set('googleWorkspaceMessage', String(error?.message || 'Falha ao conectar Google Workspace.').slice(0, 240));
    return Response.redirect(redirect.toString(), 302);
  }
}

async function refreshGoogleAccessToken(request: Request, integration: GoogleIntegration, serviceAccount: ServiceAccount, adminToken: string) {
  const config = googleConfig(request);
  const refreshToken = await decryptSecret(String(integration.refreshTokenCipher || ''), String(integration.refreshTokenIv || ''));
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
    signal: AbortSignal.timeout(15000),
  });
  const payload: any = await response.json().catch(() => ({}));
  if (!response.ok || !payload.access_token) throw new Error('A conexão Google expirou. Reconecte o Google Workspace.');
  const encrypted = await encryptSecret(String(payload.access_token));
  const updated = {
    ...integration,
    accessTokenCipher: encrypted.cipher,
    accessTokenIv: encrypted.iv,
    expiresAt: Date.now() + Number(payload.expires_in || 3600) * 1000,
    updatedAt: new Date().toISOString(),
  };
  await writeDocument(serviceAccount.project_id, adminToken, 'google_workspace_integrations', String(integration.companyId), updated);
  return { token: String(payload.access_token), integration: updated };
}

async function accessTokenFor(request: Request, integration: GoogleIntegration, serviceAccount: ServiceAccount, adminToken: string) {
  if (!integration?.accessTokenCipher || !integration?.accessTokenIv || !integration?.refreshTokenCipher || !integration?.refreshTokenIv) {
    throw new Error('Google Workspace ainda não está conectado nesta empresa.');
  }
  if (Number(integration.expiresAt || 0) > Date.now() + 60_000) {
    return { token: await decryptSecret(String(integration.accessTokenCipher), String(integration.accessTokenIv)), integration };
  }
  return refreshGoogleAccessToken(request, integration, serviceAccount, adminToken);
}

function meetLinkFromEvent(event: any) {
  const direct = String(event?.hangoutLink || '').trim();
  if (direct) return direct;
  const entry = (event?.conferenceData?.entryPoints || []).find((item: any) => item?.entryPointType === 'video' || String(item?.uri || '').includes('meet.google.com'));
  return String(entry?.uri || '').trim();
}

async function fetchCalendarEvent(accessToken: string, eventId: string) {
  const response = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(eventId)}?conferenceDataVersion=1`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) return null;
  return response.json();
}

export async function getGoogleWorkspaceStatus(request: Request, body: any) {
  const serviceAccount = serviceAccountFromEnvironment();
  const adminToken = await getGoogleAdminAccessToken(serviceAccount);
  const access = await requireRlAccess(request, adminToken, serviceAccount, body?.companyId);
  const integration = await readDocument(serviceAccount.project_id, adminToken, 'google_workspace_integrations', access.companyId);
  return {
    connected: integration?.status === 'CONNECTED' && Boolean(integration?.refreshTokenCipher),
    connectedEmail: String(integration?.connectedEmail || ''),
    updatedAt: String(integration?.updatedAt || ''),
    companyId: access.companyId,
  };
}

export async function disconnectGoogleWorkspace(request: Request, body: any) {
  const serviceAccount = serviceAccountFromEnvironment();
  const adminToken = await getGoogleAdminAccessToken(serviceAccount);
  const access = await requireRlAccess(request, adminToken, serviceAccount, body?.companyId);
  await deleteDocument(serviceAccount.project_id, adminToken, 'google_workspace_integrations', access.companyId);
  return { success: true, connected: false };
}

export async function createGoogleMeetEvent(request: Request, body: any) {
  const serviceAccount = serviceAccountFromEnvironment();
  const adminToken = await getGoogleAdminAccessToken(serviceAccount);
  const access = await requireRlAccess(request, adminToken, serviceAccount, body?.companyId);
  let integration = await readDocument(serviceAccount.project_id, adminToken, 'google_workspace_integrations', access.companyId);
  if (!integration || integration.status !== 'CONNECTED') throw new Error('Conecte o Google Workspace antes de criar uma reunião.');
  let resolved = await accessTokenFor(request, integration, serviceAccount, adminToken);
  integration = resolved.integration;

  const title = String(body?.title || body?.titulo || 'Entrevista RL Connect').trim().slice(0, 180);
  const start = new Date(String(body?.startDateTime || ''));
  if (!Number.isFinite(start.getTime())) throw new Error('Data/hora da entrevista é inválida.');
  const durationMinutes = Math.min(480, Math.max(15, Number(body?.durationMinutes || 45)));
  const end = new Date(start.getTime() + durationMinutes * 60_000);
  const attendeeEmails = [...new Set((Array.isArray(body?.attendeeEmails) ? body.attendeeEmails : [])
    .map((item: any) => String(item || '').trim().toLowerCase())
    .filter((email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)))] as string[];

  const eventBody = {
    summary: title,
    description: String(body?.description || 'Entrevista criada pelo RL Connect.').slice(0, 4000),
    start: { dateTime: start.toISOString(), timeZone: String(body?.timeZone || 'America/Sao_Paulo') },
    end: { dateTime: end.toISOString(), timeZone: String(body?.timeZone || 'America/Sao_Paulo') },
    attendees: attendeeEmails.map((email) => ({ email })),
    conferenceData: {
      createRequest: {
        requestId: crypto.randomUUID().replace(/-/g, ''),
        conferenceSolutionKey: { type: 'hangoutsMeet' },
      },
    },
    extendedProperties: {
      private: {
        rlConnectCompanyId: access.companyId,
        rlConnectVagaId: String(body?.vagaId || ''),
        rlConnectCandidatoId: String(body?.candidatoId || ''),
        rlConnectCandidaturaId: String(body?.candidaturaId || ''),
      },
    },
  };

  const sendCreate = async (token: string) => fetch(
    'https://www.googleapis.com/calendar/v3/calendars/primary/events?conferenceDataVersion=1&sendUpdates=all',
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(eventBody),
      signal: AbortSignal.timeout(20000),
    },
  );

  let response = await sendCreate(resolved.token);
  if (response.status === 401) {
    resolved = await refreshGoogleAccessToken(request, integration, serviceAccount, adminToken);
    response = await sendCreate(resolved.token);
  }
  const event: any = await response.json().catch(() => ({}));
  if (!response.ok || !event?.id) {
    throw new Error(event?.error?.message || `Google Calendar recusou a criação do evento (HTTP ${response.status}).`);
  }

  let finalEvent = event;
  let meetLink = meetLinkFromEvent(finalEvent);
  for (let attempt = 0; !meetLink && attempt < 5; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 350));
    const refreshed = await fetchCalendarEvent(resolved.token, String(event.id));
    if (refreshed) finalEvent = refreshed;
    meetLink = meetLinkFromEvent(finalEvent);
  }

  if (!meetLink) throw new Error('O evento foi criado no Google Calendar, mas o Google Meet ainda não devolveu o link. Abra o evento no Calendar e tente sincronizar novamente.');

  return {
    success: true,
    companyId: access.companyId,
    eventId: String(finalEvent.id || event.id),
    meetLink,
    calendarLink: String(finalEvent.htmlLink || event.htmlLink || ''),
    startDateTime: String(finalEvent.start?.dateTime || start.toISOString()),
    endDateTime: String(finalEvent.end?.dateTime || end.toISOString()),
    connectedEmail: String(integration.connectedEmail || ''),
  };
}

export function jsonResponse(data: any, status = 200) {
  return Response.json(data, { status, headers: JSON_HEADERS });
}
