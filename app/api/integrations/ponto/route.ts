import {
  getWorkflowGoogleAccessToken,
  patchFirestoreDocument,
  readFirestoreDocument,
  workflowServiceAccountFromEnvironment,
} from '../../workflows/_core/firestoreAdminRest';

const JSON_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
};

const MASTER_ROLES = new Set(['MASTER', 'MASTER_ADMIN', 'SUPER_ADMINISTRADOR', 'SUPER_ADMINISTRADOR']);
const DEFAULT_PONTO_URL = 'https://pronto-rh.gustavogerminari.workers.dev';
const CONFIG_COLLECTION = 'integration_secrets';
const normalizeRole = (value: unknown) => String(value || '').trim().toUpperCase().replace(/[\s-]+/g, '_');

function firebaseApiKey() {
  const apiKey = String(process.env.VITE_FIREBASE_API_KEY || process.env.FIREBASE_API_KEY || '').trim();
  if (!apiKey) throw new Error('VITE_FIREBASE_API_KEY não está disponível no servidor.');
  return apiKey;
}

function integrationKey() {
  const raw = String(process.env.PONTO_RH_INTEGRATION_KEY || '').trim();
  if (raw.length < 32) throw new Error('PONTO_RH_INTEGRATION_KEY deve possuir pelo menos 32 caracteres.');
  return raw;
}

function bytesToBase64(bytes: Uint8Array) {
  let raw = '';
  bytes.forEach((byte) => { raw += String.fromCharCode(byte); });
  return btoa(raw);
}

function base64ToBytes(value: string) {
  return Uint8Array.from(atob(value), (char) => char.charCodeAt(0));
}

async function cryptoKey() {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(integrationKey()));
  return crypto.subtle.importKey('raw', digest, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

async function encryptSecret(secret: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    await cryptoKey(),
    new TextEncoder().encode(secret),
  );
  return `v1.${bytesToBase64(iv)}.${bytesToBase64(new Uint8Array(encrypted))}`;
}

async function decryptSecret(value: string) {
  const [version, ivRaw, cipherRaw] = String(value || '').split('.');
  if (version !== 'v1' || !ivRaw || !cipherRaw) throw new Error('Credencial PONTO RH armazenada em formato inválido.');
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: base64ToBytes(ivRaw) },
    await cryptoKey(),
    base64ToBytes(cipherRaw),
  );
  return new TextDecoder().decode(decrypted);
}

function cleanBaseUrl(value: unknown) {
  const raw = String(value || DEFAULT_PONTO_URL).trim().replace(/\/+$/g, '');
  const parsed = new URL(raw);
  const localhost = ['localhost', '127.0.0.1'].includes(parsed.hostname);
  if (parsed.protocol !== 'https:' && !localhost) throw new Error('A URL do PONTO RH deve usar HTTPS.');
  return parsed.toString().replace(/\/+$/g, '');
}

function configId(companyId: string) {
  return `ponto__${companyId}`;
}

async function requireMaster(request: Request, projectId: string, accessToken: string) {
  const idToken = String(request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
  if (!idToken) throw Object.assign(new Error('Sessão Firebase obrigatória.'), { status: 401 });
  const lookup = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(firebaseApiKey())}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!lookup.ok) throw Object.assign(new Error('Sessão Firebase inválida ou expirada.'), { status: 401 });
  const account: any = await lookup.json().catch(() => ({}));
  const uid = String(account.users?.[0]?.localId || '').trim();
  if (!uid) throw Object.assign(new Error('Usuário Firebase não identificado.'), { status: 401 });

  const primary = await readFirestoreDocument({ projectId, accessToken, collection: 'usuarios', documentId: uid });
  const legacy = primary ? null : await readFirestoreDocument({ projectId, accessToken, collection: 'users', documentId: uid });
  const profile = primary || legacy;
  const role = normalizeRole(profile?.role || profile?.perfil || profile?.tipoUsuario);
  if (!profile || !MASTER_ROLES.has(role)) {
    throw Object.assign(new Error('A integração do PONTO RH é exclusiva do usuário MASTER.'), { status: 403 });
  }
  return { uid };
}

async function adminContext(request: Request) {
  const serviceAccount = workflowServiceAccountFromEnvironment();
  const accessToken = await getWorkflowGoogleAccessToken(serviceAccount);
  const caller = await requireMaster(request, serviceAccount.project_id, accessToken);
  return { projectId: serviceAccount.project_id, accessToken, caller };
}

async function requireCompany(projectId: string, accessToken: string, companyId: string) {
  if (!companyId) throw Object.assign(new Error('Empresa obrigatória.'), { status: 400 });
  const company = await readFirestoreDocument({ projectId, accessToken, collection: 'empresas', documentId: companyId });
  if (!company) throw Object.assign(new Error('Empresa não encontrada no RH-MIL.'), { status: 404 });
  return company;
}

async function loadConfig(projectId: string, accessToken: string, companyId: string) {
  return readFirestoreDocument({ projectId, accessToken, collection: CONFIG_COLLECTION, documentId: configId(companyId) });
}

function publicConfig(config: Record<string, any> | null, companyId: string) {
  return {
    companyId,
    provider: 'PONTO_RH',
    baseUrl: String(config?.baseUrl || DEFAULT_PONTO_URL),
    clientId: String(config?.clientId || ''),
    hasClientSecret: Boolean(config?.clientSecretEncrypted),
    pontoCompanyId: String(config?.pontoCompanyId || ''),
    pontoCompanyName: String(config?.pontoCompanyName || ''),
    status: String(config?.status || 'NAO_CONFIGURADO'),
    lastCheckedAt: config?.lastCheckedAt || null,
    lastSyncAt: config?.lastSyncAt || null,
    lastError: config?.lastError || null,
    updatedAt: config?.updatedAt || null,
  };
}

async function pontoToken(config: Record<string, any>) {
  const clientId = String(config.clientId || '').trim();
  const encrypted = String(config.clientSecretEncrypted || '').trim();
  if (!clientId || !encrypted) throw Object.assign(new Error('Client ID e Client Secret do PONTO RH ainda não foram configurados.'), { status: 400 });
  const clientSecret = await decryptSecret(encrypted);
  const baseUrl = cleanBaseUrl(config.baseUrl);
  const response = await fetch(`${baseUrl}/api/v1/integracoes/auth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ clientId, clientSecret }),
    signal: AbortSignal.timeout(15_000),
  });
  const body: any = await response.json().catch(() => ({}));
  const data = body?.data || body;
  if (!response.ok || !data?.accessToken) {
    throw Object.assign(new Error(body?.error?.message || 'O PONTO RH recusou as credenciais informadas.'), { status: 502 });
  }
  return { baseUrl, accessToken: String(data.accessToken) };
}

async function pontoGet(config: Record<string, any>, path: string) {
  const token = await pontoToken(config);
  const response = await fetch(`${token.baseUrl}${path}`, {
    headers: { Authorization: `Bearer ${token.accessToken}` },
    signal: AbortSignal.timeout(20_000),
  });
  const body: any = await response.json().catch(() => ({}));
  if (!response.ok) throw Object.assign(new Error(body?.error?.message || `PONTO RH retornou HTTP ${response.status}.`), { status: 502 });
  return body?.data || body;
}

async function saveConnectionStatus(args: {
  projectId: string;
  accessToken: string;
  companyId: string;
  status: string;
  lastError?: string | null;
  pontoCompanyId?: string;
  pontoCompanyName?: string;
  checked?: boolean;
  synced?: boolean;
}) {
  const now = new Date().toISOString();
  await patchFirestoreDocument({
    projectId: args.projectId,
    accessToken: args.accessToken,
    collection: CONFIG_COLLECTION,
    documentId: configId(args.companyId),
    data: {
      status: args.status,
      lastError: args.lastError || null,
      ...(args.checked ? { lastCheckedAt: now } : {}),
      ...(args.synced ? { lastSyncAt: now } : {}),
      ...(args.pontoCompanyId ? { pontoCompanyId: args.pontoCompanyId } : {}),
      ...(args.pontoCompanyName ? { pontoCompanyName: args.pontoCompanyName } : {}),
      updatedAt: now,
    },
  });
}

export async function GET(request: Request) {
  try {
    const { projectId, accessToken } = await adminContext(request);
    const companyId = String(new URL(request.url).searchParams.get('companyId') || '').trim();
    await requireCompany(projectId, accessToken, companyId);
    const config = await loadConfig(projectId, accessToken, companyId);
    return Response.json({ success: true, config: publicConfig(config, companyId) }, { headers: JSON_HEADERS });
  } catch (error: any) {
    return Response.json({ success: false, error: String(error?.message || 'Falha ao carregar integração de ponto.') }, { status: Number(error?.status || 500), headers: JSON_HEADERS });
  }
}

export async function PUT(request: Request) {
  try {
    const { projectId, accessToken, caller } = await adminContext(request);
    const body: any = await request.json().catch(() => ({}));
    const companyId = String(body.companyId || '').trim();
    await requireCompany(projectId, accessToken, companyId);
    const previous = await loadConfig(projectId, accessToken, companyId);
    const clientId = String(body.clientId || '').trim();
    const clientSecret = String(body.clientSecret || '').trim();
    if (!clientId) throw Object.assign(new Error('Client ID do PONTO RH é obrigatório.'), { status: 400 });
    if (!clientSecret && !previous?.clientSecretEncrypted) throw Object.assign(new Error('Client Secret do PONTO RH é obrigatório na primeira configuração.'), { status: 400 });
    const now = new Date().toISOString();
    await patchFirestoreDocument({
      projectId,
      accessToken,
      collection: CONFIG_COLLECTION,
      documentId: configId(companyId),
      data: {
        companyId,
        provider: 'PONTO_RH',
        baseUrl: cleanBaseUrl(body.baseUrl || previous?.baseUrl || DEFAULT_PONTO_URL),
        clientId,
        clientSecretEncrypted: clientSecret ? await encryptSecret(clientSecret) : previous?.clientSecretEncrypted,
        status: previous?.status || 'CONFIGURADO',
        createdAt: previous?.createdAt || now,
        createdBy: previous?.createdBy || caller.uid,
        updatedAt: now,
        updatedBy: caller.uid,
      },
    });
    const config = await loadConfig(projectId, accessToken, companyId);
    return Response.json({ success: true, config: publicConfig(config, companyId) }, { headers: JSON_HEADERS });
  } catch (error: any) {
    return Response.json({ success: false, error: String(error?.message || 'Falha ao salvar integração de ponto.') }, { status: Number(error?.status || 500), headers: JSON_HEADERS });
  }
}

export async function POST(request: Request) {
  let context: Awaited<ReturnType<typeof adminContext>> | null = null;
  let companyId = '';
  try {
    context = await adminContext(request);
    const body: any = await request.json().catch(() => ({}));
    companyId = String(body.companyId || '').trim();
    await requireCompany(context.projectId, context.accessToken, companyId);
    const config = await loadConfig(context.projectId, context.accessToken, companyId);
    if (!config) throw Object.assign(new Error('Configure o PONTO RH antes de testar a conexão.'), { status: 400 });
    const action = String(body.action || 'test').toLowerCase();

    if (action === 'test') {
      const status = await pontoGet(config, '/api/v1/integracoes/ponto/status');
      const pontoCompanyId = String(status?.empresa?.id || '');
      const pontoCompanyName = String(status?.empresa?.nomeFantasia || status?.empresa?.razaoSocial || '');
      await saveConnectionStatus({ projectId: context.projectId, accessToken: context.accessToken, companyId, status: 'CONECTADO', lastError: null, pontoCompanyId, pontoCompanyName, checked: true });
      return Response.json({ success: true, status: 'CONECTADO', empresa: status?.empresa || null }, { headers: JSON_HEADERS });
    }

    if (action !== 'sync') throw Object.assign(new Error('Ação de integração inválida.'), { status: 400 });

    const inicio = String(body.inicio || new Date(Date.now() - 7 * 86_400_000).toISOString().slice(0, 10));
    const fim = String(body.fim || new Date().toISOString().slice(0, 10));
    let cursor = '';
    let imported = 0;
    for (let page = 0; page < 20; page += 1) {
      const params = new URLSearchParams({ inicio, fim, limite: '200' });
      if (cursor) params.set('cursor', cursor);
      const result = await pontoGet(config, `/api/v1/integracoes/ponto/marcacoes?${params.toString()}`);
      const items = Array.isArray(result?.items) ? result.items : [];
      for (const mark of items) {
        const markId = String(mark?.id || '').replace(/[^A-Za-z0-9_-]/g, '_');
        if (!markId) continue;
        await patchFirestoreDocument({
          projectId: context.projectId,
          accessToken: context.accessToken,
          collection: 'registros_ponto',
          documentId: `ponto_${markId}`,
          data: {
            id: `ponto_${markId}`,
            empresaId: companyId,
            companyId,
            funcionarioId: String(mark.externalEmployeeId || ''),
            colaboradorId: String(mark.externalEmployeeId || ''),
            externalEmployeeId: String(mark.externalEmployeeId || ''),
            externalPunchId: String(mark.id || ''),
            tipo: String(mark.tipo || ''),
            dataReferencia: mark.dataReferencia || null,
            horaOficial: mark.horaOficial || null,
            dataHoraServidor: mark.dataHoraServidor || null,
            dataHoraDispositivo: mark.dataHoraDispositivo || null,
            origem: mark.origem || 'PONTO_RH',
            protocolo: mark.protocolo || null,
            nsr: mark.nsr ?? null,
            localTrabalhoId: mark.localTrabalhoId || null,
            localTrabalhoNome: mark.localTrabalhoNome || null,
            latitude: mark.latitude ?? null,
            longitude: mark.longitude ?? null,
            precisaoMetros: mark.precisaoMetros ?? null,
            provider: 'PONTO_RH',
            sincronizadoEm: new Date().toISOString(),
          },
        });
        imported += 1;
      }
      cursor = String(result?.nextCursor || '');
      if (!cursor || items.length === 0) break;
    }

    const bank = await pontoGet(config, '/api/v1/integracoes/ponto/banco-horas');
    const bankItems = Array.isArray(bank?.items) ? bank.items : [];
    for (const item of bankItems) {
      const employeeId = String(item?.externalEmployeeId || '').trim();
      if (!employeeId) continue;
      const safeId = employeeId.replace(/[^A-Za-z0-9_-]/g, '_');
      await patchFirestoreDocument({
        projectId: context.projectId,
        accessToken: context.accessToken,
        collection: 'ponto_banco_horas',
        documentId: `${companyId}__${safeId}`,
        data: {
          empresaId: companyId,
          companyId,
          funcionarioId: employeeId,
          externalEmployeeId: employeeId,
          matricula: item.matricula || null,
          colaboradorNome: item.colaboradorNome || null,
          creditosMinutos: Number(item.creditosMinutos || 0),
          debitosMinutos: Number(item.debitosMinutos || 0),
          saldoMinutos: Number(item.saldoMinutos || 0),
          atualizadoEmPonto: item.atualizadoEm || null,
          provider: 'PONTO_RH',
          sincronizadoEm: new Date().toISOString(),
        },
      });
    }

    await saveConnectionStatus({ projectId: context.projectId, accessToken: context.accessToken, companyId, status: 'CONECTADO', lastError: null, synced: true });
    return Response.json({ success: true, importedPunches: imported, bankRecords: bankItems.length, inicio, fim }, { headers: JSON_HEADERS });
  } catch (error: any) {
    const message = String(error?.message || 'Falha na integração com o PONTO RH.');
    if (context && companyId) {
      await saveConnectionStatus({ projectId: context.projectId, accessToken: context.accessToken, companyId, status: 'ERRO', lastError: message, checked: true }).catch(() => undefined);
    }
    return Response.json({ success: false, error: message }, { status: Number(error?.status || 500), headers: JSON_HEADERS });
  }
}
