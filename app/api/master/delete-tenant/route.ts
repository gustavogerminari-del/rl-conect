const JSON_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
};

const MASTER_ROLES = new Set([
  'MASTER',
  'MASTER_ADMIN',
  'SUPER_ADMINISTRADOR',
  'SUPER ADMINISTRADOR',
]);

const PLATFORM_ROLES = new Set([
  ...MASTER_ROLES,
  'DEVELOPER',
  'DEVELOPER_ADMIN',
  'DESENVOLVEDOR',
]);

type ServiceAccount = {
  project_id: string;
  client_email: string;
  private_key: string;
  token_uri?: string;
};

type FirestoreDocument = {
  name?: string;
  fields?: Record<string, any>;
};

const normalizeRole = (value: unknown) =>
  String(value || '').trim().toUpperCase().replace(/[\s-]+/g, '_');

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
    throw new Error(
      'Exclusão administrativa do Firebase Authentication não configurada. Adicione FIREBASE_SERVICE_ACCOUNT_JSON nos Secrets do servidor.'
    );
  }

  return {
    project_id: projectId,
    client_email: clientEmail,
    private_key: privateKey,
    token_uri: 'https://oauth2.googleapis.com/token',
  };
}

function base64Url(value: string | Uint8Array) {
  const binary = typeof value === 'string'
    ? new TextEncoder().encode(value)
    : value;
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
    signal: AbortSignal.timeout(15000),
  });
  const payloadResponse: any = await response.json().catch(() => ({}));
  if (!response.ok || !payloadResponse.access_token) {
    throw new Error('Não foi possível autenticar a conta de serviço do Firebase Admin.');
  }
  return String(payloadResponse.access_token);
}

const firestoreDocumentUrl = (projectId: string, collectionName: string, id: string) =>
  `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/databases/(default)/documents/${encodeURIComponent(collectionName)}/${encodeURIComponent(id)}`;

async function readFirestoreDocument(
  projectId: string,
  accessToken: string,
  collectionName: string,
  id: string
): Promise<FirestoreDocument | null> {
  const response = await fetch(firestoreDocumentUrl(projectId, collectionName, id), {
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(10000),
  });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Não foi possível consultar ${collectionName}/${id}.`);
  return response.json();
}

async function deleteFirestoreDocument(
  projectId: string,
  accessToken: string,
  collectionName: string,
  id: string
) {
  const response = await fetch(firestoreDocumentUrl(projectId, collectionName, id), {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(10000),
  });
  if (response.status === 404) return;
  if (!response.ok) throw new Error(`Não foi possível excluir ${collectionName}/${id}.`);
}

async function requireMaster(request: Request, serviceAccount: ServiceAccount, adminAccessToken: string) {
  const idToken = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim();
  const apiKey = String(process.env.VITE_FIREBASE_API_KEY || process.env.FIREBASE_API_KEY || '').trim();
  if (!idToken) throw new Error('Sessão Firebase obrigatória.');
  if (!apiKey) throw new Error('VITE_FIREBASE_API_KEY não está disponível no servidor.');

  const lookup = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(apiKey)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken }),
    signal: AbortSignal.timeout(10000),
  });
  if (!lookup.ok) throw new Error('Sessão Firebase inválida ou expirada.');
  const account: any = await lookup.json();
  const uid = String(account.users?.[0]?.localId || '').trim();
  if (!uid) throw new Error('Usuário Firebase não identificado.');

  const primary = await readFirestoreDocument(serviceAccount.project_id, adminAccessToken, 'usuarios', uid);
  const legacy = primary ? null : await readFirestoreDocument(serviceAccount.project_id, adminAccessToken, 'users', uid);
  const profile = decodeDocument(primary || legacy);
  const role = normalizeRole(profile?.role || profile?.tipoUsuario);
  if (!profile || !MASTER_ROLES.has(role)) {
    throw new Error('A exclusão de empresa é exclusiva do acesso MASTER.');
  }
  return { uid };
}

async function runLinkedUserQuery(
  projectId: string,
  accessToken: string,
  collectionId: 'usuarios' | 'users',
  fieldPath: 'empresaId' | 'companyId',
  companyId: string
): Promise<Array<{ uid: string; profile: Record<string, any> }>> {
  const response = await fetch(
    `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/databases/(default)/documents:runQuery`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        structuredQuery: {
          from: [{ collectionId }],
          where: {
            fieldFilter: {
              field: { fieldPath },
              op: 'EQUAL',
              value: { stringValue: companyId },
            },
          },
        },
      }),
      signal: AbortSignal.timeout(15000),
    }
  );
  if (!response.ok) throw new Error(`Não foi possível localizar acessos vinculados em ${collectionId}.`);
  const rows: Array<{ document?: FirestoreDocument }> = await response.json();
  return rows.flatMap((row) => {
    if (!row.document?.name) return [];
    const uid = row.document.name.split('/').pop() || '';
    const profile = decodeDocument(row.document);
    return uid && profile ? [{ uid, profile }] : [];
  });
}

function isPlatformIdentity(profile: Record<string, any>) {
  return [profile.role, profile.tipoUsuario]
    .map(normalizeRole)
    .some((role) => PLATFORM_ROLES.has(role));
}

async function deleteAuthenticationUser(projectId: string, accessToken: string, uid: string) {
  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/accounts:delete`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ localId: uid }),
      signal: AbortSignal.timeout(15000),
    }
  );
  if (response.ok) return 'deleted' as const;
  const text = await response.text();
  if (/USER_NOT_FOUND/i.test(text)) return 'missing' as const;
  throw new Error(`Firebase Authentication recusou a exclusão do UID ${uid}.`);
}

export async function POST(request: Request) {
  try {
    const serviceAccount = serviceAccountFromEnvironment();
    const adminAccessToken = await getGoogleAccessToken(serviceAccount);
    const caller = await requireMaster(request, serviceAccount, adminAccessToken);
    const body: any = await request.json().catch(() => ({}));
    const companyId = String(body.companyId || '').trim();
    if (!companyId) {
      return Response.json({ success: false, error: 'Empresa não informada.' }, { status: 400, headers: JSON_HEADERS });
    }

    const company = await readFirestoreDocument(serviceAccount.project_id, adminAccessToken, 'empresas', companyId);
    if (!company) {
      return Response.json({ success: false, error: 'A empresa não existe mais no Firestore.' }, { status: 404, headers: JSON_HEADERS });
    }

    const queryResults = await Promise.all([
      runLinkedUserQuery(serviceAccount.project_id, adminAccessToken, 'usuarios', 'empresaId', companyId),
      runLinkedUserQuery(serviceAccount.project_id, adminAccessToken, 'usuarios', 'companyId', companyId),
      runLinkedUserQuery(serviceAccount.project_id, adminAccessToken, 'users', 'empresaId', companyId),
      runLinkedUserQuery(serviceAccount.project_id, adminAccessToken, 'users', 'companyId', companyId),
    ]);

    const profilesByUid = new Map<string, Record<string, any>[]>();
    for (const result of queryResults.flat()) {
      const profiles = profilesByUid.get(result.uid) || [];
      profiles.push(result.profile);
      profilesByUid.set(result.uid, profiles);
    }

    const linkedUserIds = [...profilesByUid.entries()]
      .filter(([uid, profiles]) => uid !== caller.uid && !profiles.some(isPlatformIdentity))
      .map(([uid]) => uid);

    // A conta de Authentication é tentada primeiro, mas uma falha nela não pode
    // manter a empresa/perfis presos no Firestore. Sem perfil de Firestore a conta
    // órfã não recebe acesso ao RL Connect e pode ser limpa depois pelo Admin SDK.
    const authFailures: string[] = [];
    let deletedAuthUsers = 0;
    for (const uid of linkedUserIds) {
      try {
        const result = await deleteAuthenticationUser(serviceAccount.project_id, adminAccessToken, uid);
        if (result === 'deleted') deletedAuthUsers += 1;
      } catch {
        authFailures.push(uid);
      }
    }

    const firestoreDeletes: Promise<void>[] = [];
    for (const uid of linkedUserIds) {
      firestoreDeletes.push(deleteFirestoreDocument(serviceAccount.project_id, adminAccessToken, 'usuarios', uid));
      firestoreDeletes.push(deleteFirestoreDocument(serviceAccount.project_id, adminAccessToken, 'users', uid));
    }
    firestoreDeletes.push(deleteFirestoreDocument(serviceAccount.project_id, adminAccessToken, 'empresa_modulos', companyId));
    firestoreDeletes.push(deleteFirestoreDocument(serviceAccount.project_id, adminAccessToken, 'companyModules', companyId));
    firestoreDeletes.push(deleteFirestoreDocument(serviceAccount.project_id, adminAccessToken, 'companies', companyId));
    firestoreDeletes.push(deleteFirestoreDocument(serviceAccount.project_id, adminAccessToken, 'tenants', companyId));
    firestoreDeletes.push(deleteFirestoreDocument(serviceAccount.project_id, adminAccessToken, 'empresas', companyId));
    await Promise.all(firestoreDeletes);

    return Response.json({
      success: true,
      companyId,
      deletedAuthUsers,
      removedProfileCount: linkedUserIds.length,
      authDeletionPending: authFailures.length,
      failedUserIds: authFailures,
      warning: authFailures.length
        ? `${authFailures.length} conta(s) permaneceram no Firebase Authentication, mas os perfis e a empresa foram removidos do Firestore e não possuem mais acesso ao sistema.`
        : null,
    }, { headers: JSON_HEADERS });
  } catch (error: any) {
    const message = String(error?.message || 'Não foi possível excluir a empresa.');
    const status = /exclusiva do acesso MASTER|Sessão Firebase/i.test(message) ? 403 : 500;
    return Response.json({ success: false, error: message }, { status, headers: JSON_HEADERS });
  }
}
