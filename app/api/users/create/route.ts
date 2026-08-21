const JSON_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
};

const MASTER_ROLES = new Set(['MASTER', 'MASTER_ADMIN', 'SUPER_ADMINISTRADOR', 'SUPER ADMINISTRADOR']);
const DEVELOPER_ROLES = new Set(['DEVELOPER', 'DEVELOPER_ADMIN', 'DESENVOLVEDOR']);

type ServiceAccount = {
  project_id: string;
  client_email: string;
  private_key: string;
  token_uri?: string;
};

type FirestoreDocument = {
  fields?: Record<string, any>;
};

const normalizeRole = (value: unknown) =>
  String(value || '').trim().toUpperCase().replace(/[\s-]+/g, '_');

function serviceAccountFromEnvironment(): ServiceAccount {
  const raw = String(process.env.FIREBASE_SERVICE_ACCOUNT_JSON || '').trim();
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as Partial<ServiceAccount>;
      if (parsed.project_id && parsed.client_email && parsed.private_key) {
        return {
          project_id: String(parsed.project_id),
          client_email: String(parsed.client_email),
          private_key: String(parsed.private_key).replace(/\\n/g, '\n'),
          token_uri: String(parsed.token_uri || 'https://oauth2.googleapis.com/token'),
        };
      }
    } catch {
      throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON possui JSON inválido.');
    }
  }

  const projectId = String(process.env.FIREBASE_ADMIN_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID || '').trim();
  const clientEmail = String(process.env.FIREBASE_ADMIN_CLIENT_EMAIL || '').trim();
  const privateKey = String(process.env.FIREBASE_ADMIN_PRIVATE_KEY || '').replace(/\\n/g, '\n').trim();
  if (!projectId || !clientEmail || !privateKey) {
    throw new Error('Provisionamento administrativo do Firebase não configurado.');
  }

  return {
    project_id: projectId,
    client_email: clientEmail,
    private_key: privateKey,
    token_uri: 'https://oauth2.googleapis.com/token',
  };
}

function firebaseApiKey() {
  const apiKey = String(process.env.VITE_FIREBASE_API_KEY || process.env.FIREBASE_API_KEY || '').trim();
  if (!apiKey) throw new Error('VITE_FIREBASE_API_KEY não está disponível no servidor.');
  return apiKey;
}

function base64Url(value: string | Uint8Array) {
  const binary = typeof value === 'string' ? new TextEncoder().encode(value) : value;
  let raw = '';
  binary.forEach((byte) => { raw += String.fromCharCode(byte); });
  return btoa(raw).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function pemToPkcs8(privateKey: string) {
  const body = privateKey
    .replace(/-----BEGIN PRIVATE KEY-----/g, '')
    .replace(/-----END PRIVATE KEY-----/g, '')
    .replace(/\s+/g, '');
  return Uint8Array.from(atob(body), (char) => char.charCodeAt(0));
}

async function getGoogleAccessToken(serviceAccount: ServiceAccount) {
  const tokenUri = serviceAccount.token_uri || 'https://oauth2.googleapis.com/token';
  const now = Math.floor(Date.now() / 1000);
  const header = base64Url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const payload = base64Url(JSON.stringify({
    iss: serviceAccount.client_email,
    scope: 'https://www.googleapis.com/auth/cloud-platform https://www.googleapis.com/auth/identitytoolkit',
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
    ['sign']
  );
  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    key,
    new TextEncoder().encode(unsigned)
  );
  const assertion = `${unsigned}.${base64Url(new Uint8Array(signature))}`;

  const response = await fetch(tokenUri, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
    signal: AbortSignal.timeout(15_000),
  });
  const body: any = await response.json().catch(() => ({}));
  if (!response.ok || !body.access_token) {
    throw new Error('Não foi possível autenticar a conta de serviço do Firebase Admin.');
  }
  return String(body.access_token);
}

function decodeFirestoreValue(value: any): any {
  if (!value || typeof value !== 'object') return undefined;
  if ('nullValue' in value) return null;
  if ('stringValue' in value) return value.stringValue;
  if ('booleanValue' in value) return value.booleanValue;
  if ('integerValue' in value) return Number(value.integerValue);
  if ('doubleValue' in value) return Number(value.doubleValue);
  if ('timestampValue' in value) return value.timestampValue;
  if ('arrayValue' in value) return (value.arrayValue?.values || []).map(decodeFirestoreValue);
  if ('mapValue' in value) {
    return Object.fromEntries(
      Object.entries(value.mapValue?.fields || {}).map(([key, nested]) => [key, decodeFirestoreValue(nested)])
    );
  }
  return undefined;
}

function decodeDocument(document?: FirestoreDocument | null): Record<string, any> | null {
  if (!document) return null;
  return Object.fromEntries(
    Object.entries(document.fields || {}).map(([key, value]) => [key, decodeFirestoreValue(value)])
  );
}

function encodeFirestoreValue(value: any): any {
  if (value === null || value === undefined) return { nullValue: null };
  if (typeof value === 'string') return { stringValue: value };
  if (typeof value === 'boolean') return { booleanValue: value };
  if (typeof value === 'number') {
    return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value };
  }
  if (Array.isArray(value)) {
    return { arrayValue: { values: value.map(encodeFirestoreValue) } };
  }
  if (typeof value === 'object') {
    return { mapValue: { fields: encodeFirestoreFields(value) } };
  }
  return { stringValue: String(value) };
}

function encodeFirestoreFields(input: Record<string, any>) {
  return Object.fromEntries(
    Object.entries(input)
      .filter(([, value]) => value !== undefined)
      .map(([key, value]) => [key, encodeFirestoreValue(value)])
  );
}

function firestoreDocumentUrl(projectId: string, collectionName: string, id: string) {
  return `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/databases/(default)/documents/${encodeURIComponent(collectionName)}/${encodeURIComponent(id)}`;
}

async function readFirestoreDocument(
  projectId: string,
  accessToken: string,
  collectionName: string,
  id: string
): Promise<Record<string, any> | null> {
  const response = await fetch(firestoreDocumentUrl(projectId, collectionName, id), {
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(10_000),
  });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Não foi possível consultar ${collectionName}/${id}.`);
  return decodeDocument(await response.json());
}

async function patchFirestoreDocument(
  projectId: string,
  accessToken: string,
  collectionName: string,
  id: string,
  data: Record<string, any>
) {
  const fields = Object.keys(data);
  const mask = fields.map((field) => `updateMask.fieldPaths=${encodeURIComponent(field)}`).join('&');
  const response = await fetch(`${firestoreDocumentUrl(projectId, collectionName, id)}?${mask}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ fields: encodeFirestoreFields(data) }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`Não foi possível gravar ${collectionName}/${id}. ${text.slice(0, 160)}`);
  }
}

async function deleteFirestoreDocument(projectId: string, accessToken: string, collectionName: string, id: string) {
  const response = await fetch(firestoreDocumentUrl(projectId, collectionName, id), {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(10_000),
  });
  if (response.status === 404 || response.ok) return;
  throw new Error(`Não foi possível reverter ${collectionName}/${id}.`);
}

async function requireMaster(request: Request, projectId: string, accessToken: string, apiKey: string) {
  const idToken = String(request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
  if (!idToken) throw Object.assign(new Error('Sessão Firebase obrigatória.'), { status: 401 });

  const lookup = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(apiKey)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!lookup.ok) throw Object.assign(new Error('Sessão Firebase inválida ou expirada.'), { status: 401 });
  const account: any = await lookup.json();
  const uid = String(account.users?.[0]?.localId || '').trim();
  if (!uid) throw Object.assign(new Error('Usuário Firebase não identificado.'), { status: 401 });

  const primary = await readFirestoreDocument(projectId, accessToken, 'usuarios', uid);
  const legacy = primary ? null : await readFirestoreDocument(projectId, accessToken, 'users', uid);
  const profile = primary || legacy;
  const role = normalizeRole(profile?.role || profile?.tipoUsuario);
  if (!profile || !MASTER_ROLES.has(role)) {
    throw Object.assign(new Error('A criação de acessos é exclusiva do usuário MASTER.'), { status: 403 });
  }
  return { uid };
}

async function identityRequest(apiKey: string, action: string, payload: Record<string, any>) {
  const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:${action}?key=${encodeURIComponent(apiKey)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(15_000),
  });
  const body: any = await response.json().catch(() => ({}));
  return { response, body };
}

async function createOrReuseAuthUser(apiKey: string, email: string, password: string) {
  const signup = await identityRequest(apiKey, 'signUp', {
    email,
    password,
    returnSecureToken: true,
  });

  if (signup.response.ok && signup.body.localId && signup.body.idToken) {
    return {
      uid: String(signup.body.localId),
      idToken: String(signup.body.idToken),
      createdNewUser: true,
    };
  }

  const signupMessage = String(signup.body?.error?.message || '');
  if (!/EMAIL_EXISTS/i.test(signupMessage)) {
    throw new Error(`Firebase Authentication recusou a criação do usuário: ${signupMessage || signup.response.status}.`);
  }

  const signin = await identityRequest(apiKey, 'signInWithPassword', {
    email,
    password,
    returnSecureToken: true,
  });
  if (!signin.response.ok || !signin.body.localId || !signin.body.idToken) {
    const signinMessage = String(signin.body?.error?.message || '');
    if (/INVALID_PASSWORD|INVALID_LOGIN_CREDENTIALS/i.test(signinMessage)) {
      throw new Error('Este e-mail já existe no Firebase Authentication, mas a senha informada não corresponde. Redefina a senha antes de recriar este acesso.');
    }
    throw new Error(`Não foi possível reutilizar a conta Firebase existente: ${signinMessage || signin.response.status}.`);
  }

  return {
    uid: String(signin.body.localId),
    idToken: String(signin.body.idToken),
    createdNewUser: false,
  };
}

async function updateAuthDisplayName(apiKey: string, idToken: string, displayName: string) {
  const update = await identityRequest(apiKey, 'update', {
    idToken,
    displayName,
    returnSecureToken: true,
  });
  if (!update.response.ok) {
    const message = String(update.body?.error?.message || update.response.status);
    throw new Error(`A conta foi criada, mas o nome no Firebase Authentication não pôde ser atualizado: ${message}.`);
  }
}

async function deleteAuthUser(apiKey: string, idToken: string) {
  const result = await identityRequest(apiKey, 'delete', { idToken });
  if (!result.response.ok) {
    throw new Error('Não foi possível reverter a conta criada no Firebase Authentication.');
  }
}

export async function POST(request: Request) {
  let createdAccount: { uid: string; idToken: string; createdNewUser: boolean } | null = null;
  let projectId = '';
  let accessToken = '';
  let apiKey = '';

  try {
    const serviceAccount = serviceAccountFromEnvironment();
    projectId = serviceAccount.project_id;
    accessToken = await getGoogleAccessToken(serviceAccount);
    apiKey = firebaseApiKey();
    const caller = await requireMaster(request, projectId, accessToken, apiKey);
    const body: any = await request.json().catch(() => ({}));

    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');
    const displayName = String(body.nome || body.displayName || '').trim();
    const rawRole = String(body.role || 'Colaborador').trim();
    const role = normalizeRole(rawRole);
    const isMaster = MASTER_ROLES.has(role);
    const isDeveloper = DEVELOPER_ROLES.has(role);
    const isPlatformUser = isMaster || isDeveloper;
    const companyId = isPlatformUser ? '' : String(body.empresaId || body.companyId || '').trim();
    const companyName = isPlatformUser ? '' : String(body.companyName || '').trim();
    const ativo = body.ativo !== false;
    const permissions = Array.isArray(body.permissions) ? body.permissions.map(String) : [];
    const modules = body.modules && typeof body.modules === 'object' && !Array.isArray(body.modules) ? body.modules : {};
    const colaboradorId = isPlatformUser ? null : (body.colaboradorId ? String(body.colaboradorId) : null);

    if (!email || !displayName || password.length < 6) {
      return Response.json({ success: false, error: 'Nome, e-mail e senha temporária de pelo menos 6 caracteres são obrigatórios.' }, { status: 400, headers: JSON_HEADERS });
    }
    if (!isPlatformUser && (!companyId || !companyName)) {
      return Response.json({ success: false, error: 'Empresa válida é obrigatória para criar um usuário comum.' }, { status: 400, headers: JSON_HEADERS });
    }

    createdAccount = await createOrReuseAuthUser(apiKey, email, password);
    await updateAuthDisplayName(apiKey, createdAccount.idToken, displayName);

    const now = new Date().toISOString();
    const canonicalRole = isMaster ? 'MASTER' : isDeveloper ? 'DEVELOPER_ADMIN' : rawRole;
    const empresaId = isPlatformUser ? null : companyId;
    const profile = {
      uid: createdAccount.uid,
      email,
      nome: displayName,
      displayName,
      role: canonicalRole,
      perfil: canonicalRole,
      tipoUsuario: isMaster ? 'MASTER' : isDeveloper ? 'DEVELOPER' : 'EMPRESA',
      ativo,
      status: ativo ? 'Ativo' : 'Inativo',
      empresaId,
      companyId: empresaId,
      companyName,
      colaboradorId,
      permissions,
      permissoes: permissions,
      modules,
      modulos: modules,
      createdAt: now,
      updatedAt: now,
      createdBy: caller.uid,
      updatedBy: caller.uid,
    };

    try {
      await patchFirestoreDocument(projectId, accessToken, 'usuarios', createdAccount.uid, profile);
      await patchFirestoreDocument(projectId, accessToken, 'users', createdAccount.uid, profile);
    } catch (writeError) {
      await Promise.allSettled([
        deleteFirestoreDocument(projectId, accessToken, 'usuarios', createdAccount.uid),
        deleteFirestoreDocument(projectId, accessToken, 'users', createdAccount.uid),
      ]);
      if (createdAccount.createdNewUser) {
        await deleteAuthUser(apiKey, createdAccount.idToken).catch(() => undefined);
      }
      throw writeError;
    }

    return Response.json({
      success: true,
      uid: createdAccount.uid,
      reusedExistingAuthAccount: !createdAccount.createdNewUser,
    }, { status: createdAccount.createdNewUser ? 201 : 200, headers: JSON_HEADERS });
  } catch (error: any) {
    const message = String(error?.message || 'Não foi possível criar o usuário.');
    const status = Number(error?.status || (/já existe|senha informada não corresponde/i.test(message) ? 409 : 500));
    return Response.json({ success: false, error: message }, { status, headers: JSON_HEADERS });
  }
}
