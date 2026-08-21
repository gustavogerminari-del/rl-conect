export type ServiceAccount = {
  project_id: string;
  client_email: string;
  private_key: string;
  token_uri?: string;
};

type FirestoreValue =
  | { nullValue: null }
  | { stringValue: string }
  | { booleanValue: boolean }
  | { integerValue: string }
  | { doubleValue: number }
  | { timestampValue: string }
  | { arrayValue: { values?: FirestoreValue[] } }
  | { mapValue: { fields?: Record<string, FirestoreValue> } };

type FirestoreDocument = {
  name?: string;
  fields?: Record<string, FirestoreValue>;
};

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

export function workflowServiceAccountFromEnvironment(): ServiceAccount {
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
    throw new Error('Workflow interno sem credenciais Firebase Admin. Configure FIREBASE_SERVICE_ACCOUNT_JSON.');
  }

  return {
    project_id: projectId,
    client_email: clientEmail,
    private_key: privateKey,
    token_uri: 'https://oauth2.googleapis.com/token',
  };
}

export async function getWorkflowGoogleAccessToken(serviceAccount: ServiceAccount) {
  const tokenUri = serviceAccount.token_uri || 'https://oauth2.googleapis.com/token';
  const now = Math.floor(Date.now() / 1000);
  const header = base64Url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const payload = base64Url(JSON.stringify({
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
    throw new Error('Não foi possível autenticar o workflow no Google/Firebase.');
  }
  return String(body.access_token);
}

function encodeFirestoreValue(value: unknown): FirestoreValue {
  if (value === null || value === undefined) return { nullValue: null };
  if (typeof value === 'string') return { stringValue: value };
  if (typeof value === 'boolean') return { booleanValue: value };
  if (typeof value === 'number') {
    return Number.isInteger(value)
      ? { integerValue: String(value) }
      : { doubleValue: value };
  }
  if (Array.isArray(value)) return { arrayValue: { values: value.map(encodeFirestoreValue) } };
  if (typeof value === 'object') {
    return { mapValue: { fields: encodeFirestoreFields(value as Record<string, unknown>) } };
  }
  return { stringValue: String(value) };
}

function encodeFirestoreFields(input: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(input)
      .filter(([, value]) => value !== undefined)
      .map(([key, value]) => [key, encodeFirestoreValue(value)])
  );
}

function decodeFirestoreValue(value?: FirestoreValue): any {
  if (!value || typeof value !== 'object') return undefined;
  if ('nullValue' in value) return null;
  if ('stringValue' in value) return value.stringValue;
  if ('booleanValue' in value) return value.booleanValue;
  if ('integerValue' in value) return Number(value.integerValue);
  if ('doubleValue' in value) return Number(value.doubleValue);
  if ('timestampValue' in value) return value.timestampValue;
  if ('arrayValue' in value) return (value.arrayValue.values || []).map(decodeFirestoreValue);
  if ('mapValue' in value) {
    return Object.fromEntries(
      Object.entries(value.mapValue.fields || {}).map(([key, nested]) => [key, decodeFirestoreValue(nested)])
    );
  }
  return undefined;
}

export function decodeFirestoreDocument(document?: FirestoreDocument | null): Record<string, any> | null {
  if (!document) return null;
  const id = String(document.name || '').split('/').pop() || '';
  return {
    ...(id ? { id } : {}),
    ...Object.fromEntries(
      Object.entries(document.fields || {}).map(([key, value]) => [key, decodeFirestoreValue(value)])
    ),
  };
}

function documentUrl(projectId: string, collectionName: string, documentId: string) {
  return `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/databases/(default)/documents/${encodeURIComponent(collectionName)}/${encodeURIComponent(documentId)}`;
}

export async function readFirestoreDocument(args: {
  projectId: string;
  accessToken: string;
  collection: string;
  documentId: string;
}) {
  const response = await fetch(documentUrl(args.projectId, args.collection, args.documentId), {
    headers: { Authorization: `Bearer ${args.accessToken}` },
    signal: AbortSignal.timeout(15_000),
  });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Falha ao ler ${args.collection}/${args.documentId} (${response.status}).`);
  return decodeFirestoreDocument(await response.json());
}

export async function queryFirestoreByString(args: {
  projectId: string;
  accessToken: string;
  collection: string;
  fieldPath: string;
  value: string;
}) {
  const response = await fetch(
    `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(args.projectId)}/databases/(default)/documents:runQuery`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${args.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        structuredQuery: {
          from: [{ collectionId: args.collection }],
          where: {
            fieldFilter: {
              field: { fieldPath: args.fieldPath },
              op: 'EQUAL',
              value: { stringValue: args.value },
            },
          },
        },
      }),
      signal: AbortSignal.timeout(15_000),
    }
  );
  if (!response.ok) throw new Error(`Falha na consulta ${args.collection}.${args.fieldPath} (${response.status}).`);
  const rows: Array<{ document?: FirestoreDocument }> = await response.json();
  return rows.flatMap((row) => {
    const decoded = decodeFirestoreDocument(row.document);
    return decoded ? [decoded] : [];
  });
}

export async function createWorkflowEventDocument(args: {
  projectId: string;
  accessToken: string;
  eventId: string;
  data: Record<string, unknown>;
}) {
  const url = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(args.projectId)}/databases/(default)/documents/workflow_events?documentId=${encodeURIComponent(args.eventId)}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${args.accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ fields: encodeFirestoreFields(args.data) }),
    signal: AbortSignal.timeout(15_000),
  });

  if (response.status === 409) return { created: false as const };
  if (!response.ok) {
    const details = await response.text().catch(() => '');
    throw new Error(`Falha ao registrar eventId no Firestore (${response.status}). ${details.slice(0, 200)}`);
  }
  return { created: true as const };
}

export async function patchFirestoreDocument(args: {
  projectId: string;
  accessToken: string;
  collection: string;
  documentId: string;
  data: Record<string, unknown>;
}) {
  const fieldNames = Object.keys(args.data);
  if (!fieldNames.length) return;

  const mask = fieldNames
    .map((field) => `updateMask.fieldPaths=${encodeURIComponent(field)}`)
    .join('&');
  const response = await fetch(`${documentUrl(args.projectId, args.collection, args.documentId)}?${mask}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${args.accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ fields: encodeFirestoreFields(args.data) }),
    signal: AbortSignal.timeout(15_000),
  });

  if (!response.ok) {
    const details = await response.text().catch(() => '');
    throw new Error(`Falha ao atualizar ${args.collection}/${args.documentId} (${response.status}). ${details.slice(0, 200)}`);
  }
}
