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

const MASTER_ROLES = new Set(['MASTER', 'MASTER_ADMIN', 'SUPER_ADMINISTRADOR']);
const DEFAULT_PONTO_URL = 'https://pronto-rh.gustavogerminari.workers.dev';
const STATUS_COLLECTION = 'ponto_integracoes';

const normalizeRole = (value: unknown) => String(value || '').trim().toUpperCase().replace(/[\s-]+/g, '_');

function firebaseApiKey() {
  const apiKey = String(process.env.VITE_FIREBASE_API_KEY || process.env.FIREBASE_API_KEY || '').trim();
  if (!apiKey) throw new Error('VITE_FIREBASE_API_KEY não está disponível no servidor.');
  return apiKey;
}

function pontoBaseUrl() {
  return String(process.env.PONTO_RH_BASE_URL || DEFAULT_PONTO_URL).trim().replace(/\/+$/g, '');
}

function systemToken() {
  const token = String(process.env.PONTO_RH_SYSTEM_TOKEN || '').trim();
  if (token.length < 32) throw new Error('PONTO_RH_SYSTEM_TOKEN não está configurado no servidor do RH-MIL.');
  return token;
}

async function firebaseIdentity(request: Request, projectId: string, accessToken: string) {
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
  if (!profile) throw Object.assign(new Error('Perfil do usuário não encontrado.'), { status: 403 });

  const role = normalizeRole(profile.role || profile.perfil || profile.tipoUsuario);
  const isMaster = MASTER_ROLES.has(role);
  const companyId = String(profile.empresaId || profile.companyId || '').trim();
  return { uid, role, isMaster, companyId };
}

async function adminContext(request: Request) {
  const serviceAccount = workflowServiceAccountFromEnvironment();
  const accessToken = await getWorkflowGoogleAccessToken(serviceAccount);
  const identity = await firebaseIdentity(request, serviceAccount.project_id, accessToken);
  return { projectId: serviceAccount.project_id, accessToken, identity };
}

async function requireCompany(projectId: string, accessToken: string, companyId: string) {
  if (!companyId) throw Object.assign(new Error('Empresa obrigatória.'), { status: 400 });
  const company = await readFirestoreDocument({ projectId, accessToken, collection: 'empresas', documentId: companyId });
  if (!company) throw Object.assign(new Error('Empresa não encontrada no RH-MIL.'), { status: 404 });
  return company;
}

async function modulesForCompany(projectId: string, accessToken: string, companyId: string, company?: Record<string, any> | null) {
  const moduleDoc = await readFirestoreDocument({ projectId, accessToken, collection: 'empresa_modulos', documentId: companyId });
  const source = moduleDoc?.modules || moduleDoc?.modulos || company?.modules || company?.modulos || company?.rawTenantData?.modules || {};
  return source && typeof source === 'object' ? source : {};
}

function pointModuleEnabled(modules: Record<string, any>) {
  return Boolean(modules.departamentoPessoal || modules.dp || modules.ponto || modules.departamento_pessoal);
}

function companyName(company: Record<string, any>) {
  const raw = company.rawTenantData && typeof company.rawTenantData === 'object' ? company.rawTenantData : company;
  return String(raw.companyName || raw.nomeEmpresa || raw.razaoSocial || company.companyName || company.nomeEmpresa || '').trim();
}

function companyTradeName(company: Record<string, any>) {
  const raw = company.rawTenantData && typeof company.rawTenantData === 'object' ? company.rawTenantData : company;
  return String(raw.tradeName || raw.nomeFantasia || raw.companyName || raw.nomeEmpresa || '').trim();
}

function companyCnpj(company: Record<string, any>) {
  const raw = company.rawTenantData && typeof company.rawTenantData === 'object' ? company.rawTenantData : company;
  return String(raw.cnpj || company.cnpj || '').replace(/\D/g, '');
}

function companyStatus(company: Record<string, any>) {
  const raw = company.rawTenantData && typeof company.rawTenantData === 'object' ? company.rawTenantData : company;
  return String(raw.status || company.status || 'Ativo');
}

async function pontoRequest(path: string, init?: RequestInit) {
  const response = await fetch(`${pontoBaseUrl()}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${systemToken()}`,
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
    signal: AbortSignal.timeout(20_000),
  });
  const body: any = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw Object.assign(new Error(body?.error?.message || `PONTO RH retornou HTTP ${response.status}.`), { status: 502 });
  }
  return body?.data || body;
}

async function saveStatus(projectId: string, accessToken: string, companyId: string, data: Record<string, unknown>) {
  await patchFirestoreDocument({
    projectId,
    accessToken,
    collection: STATUS_COLLECTION,
    documentId: companyId,
    data: {
      empresaId: companyId,
      companyId,
      provider: 'PONTO_RH',
      automatico: true,
      ...data,
      updatedAt: new Date().toISOString(),
    },
  });
}

async function ensureTenant(projectId: string, accessToken: string, companyId: string) {
  const company = await requireCompany(projectId, accessToken, companyId);
  const modules = await modulesForCompany(projectId, accessToken, companyId, company);
  if (!pointModuleEnabled(modules)) {
    await saveStatus(projectId, accessToken, companyId, { status: 'DESATIVADO_MODULO', lastError: null });
    return { skipped: true, reason: 'DP/Ponto não habilitado para esta empresa.' };
  }

  const result = await pontoRequest('/api/v1/internal/rh-mil/tenants/sync', {
    method: 'POST',
    body: JSON.stringify({
      empresaId: companyId,
      companyName: companyName(company),
      tradeName: companyTradeName(company),
      cnpj: companyCnpj(company),
      status: companyStatus(company),
      timezone: 'America/Sao_Paulo',
    }),
  });

  await saveStatus(projectId, accessToken, companyId, {
    status: 'CONECTADO',
    pontoEmpresaId: String(result?.pontoEmpresaId || ''),
    lastError: null,
    lastProvisionAt: new Date().toISOString(),
  });
  return result;
}

async function syncCompany(projectId: string, accessToken: string, companyId: string, inicio?: string, fim?: string) {
  await ensureTenant(projectId, accessToken, companyId);
  const start = String(inicio || new Date(Date.now() - 7 * 86_400_000).toISOString().slice(0, 10));
  const end = String(fim || new Date().toISOString().slice(0, 10));
  let cursor = '';
  let imported = 0;

  for (let page = 0; page < 20; page += 1) {
    const params = new URLSearchParams({ inicio: start, fim: end, limite: '200' });
    if (cursor) params.set('cursor', cursor);
    const result = await pontoRequest(`/api/v1/internal/rh-mil/tenants/${encodeURIComponent(companyId)}/marcacoes?${params.toString()}`);
    const items = Array.isArray(result?.items) ? result.items : [];

    for (const mark of items) {
      const markId = String(mark?.id || '').replace(/[^A-Za-z0-9_-]/g, '_');
      if (!markId) continue;
      await patchFirestoreDocument({
        projectId,
        accessToken,
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

  const bank = await pontoRequest(`/api/v1/internal/rh-mil/tenants/${encodeURIComponent(companyId)}/banco-horas`);
  const bankItems = Array.isArray(bank?.items) ? bank.items : [];
  for (const item of bankItems) {
    const employeeId = String(item?.externalEmployeeId || '').trim();
    if (!employeeId) continue;
    const safeId = employeeId.replace(/[^A-Za-z0-9_-]/g, '_');
    await patchFirestoreDocument({
      projectId,
      accessToken,
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

  await saveStatus(projectId, accessToken, companyId, {
    status: 'CONECTADO',
    lastError: null,
    lastSyncAt: new Date().toISOString(),
  });

  return { importedPunches: imported, bankRecords: bankItems.length, inicio: start, fim: end };
}

function resolvedCompanyId(identity: Awaited<ReturnType<typeof firebaseIdentity>>, requested: unknown) {
  if (identity.isMaster) return String(requested || identity.companyId || '').trim();
  if (!identity.companyId) throw Object.assign(new Error('Usuário não está vinculado a uma empresa.'), { status: 403 });
  return identity.companyId;
}

export async function GET(request: Request) {
  try {
    const { projectId, accessToken, identity } = await adminContext(request);
    const requested = new URL(request.url).searchParams.get('companyId');
    const companyId = resolvedCompanyId(identity, requested);
    const company = await requireCompany(projectId, accessToken, companyId);
    const modules = await modulesForCompany(projectId, accessToken, companyId, company);
    const integration = await readFirestoreDocument({ projectId, accessToken, collection: STATUS_COLLECTION, documentId: companyId });
    return Response.json({
      success: true,
      empresaId: companyId,
      automatico: true,
      moduleEnabled: pointModuleEnabled(modules),
      status: integration?.status || (pointModuleEnabled(modules) ? 'PENDENTE_PROVISIONAMENTO' : 'DESATIVADO_MODULO'),
      lastSyncAt: integration?.lastSyncAt || null,
      lastError: integration?.lastError || null,
    }, { headers: JSON_HEADERS });
  } catch (error: any) {
    return Response.json({ success: false, error: String(error?.message || 'Falha ao consultar integração de ponto.') }, { status: Number(error?.status || 500), headers: JSON_HEADERS });
  }
}

export async function POST(request: Request) {
  let context: Awaited<ReturnType<typeof adminContext>> | null = null;
  let companyId = '';
  try {
    context = await adminContext(request);
    const body: any = await request.json().catch(() => ({}));
    companyId = resolvedCompanyId(context.identity, body.companyId);
    const action = String(body.action || 'sync').toLowerCase();

    if (action === 'ensure') {
      if (!context.identity.isMaster) throw Object.assign(new Error('Provisionamento automático é exclusivo do MASTER.'), { status: 403 });
      const result = await ensureTenant(context.projectId, context.accessToken, companyId);
      return Response.json({ success: true, automatico: true, result }, { headers: JSON_HEADERS });
    }

    if (action !== 'sync') throw Object.assign(new Error('Ação de integração inválida.'), { status: 400 });
    const result = await syncCompany(context.projectId, context.accessToken, companyId, body.inicio, body.fim);
    return Response.json({ success: true, automatico: true, ...result }, { headers: JSON_HEADERS });
  } catch (error: any) {
    const message = String(error?.message || 'Falha na integração automática com o PONTO RH.');
    if (context && companyId) {
      await saveStatus(context.projectId, context.accessToken, companyId, { status: 'ERRO', lastError: message }).catch(() => undefined);
    }
    return Response.json({ success: false, error: message }, { status: Number(error?.status || 500), headers: JSON_HEADERS });
  }
}
