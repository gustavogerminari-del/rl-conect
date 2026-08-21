import { collection, doc, getDoc, getDocs, query, setDoc, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { tenantIdFrom, withTenantAliases } from '../lib/tenant';

const COLLECTION_MAP = {
  empresas: 'empresas',
  usuarios: 'usuarios',
  vagas: 'vagas',
  candidatos: 'candidatos',
  candidaturas: 'candidaturas',
  entrevistas: 'entrevistas',
  clientes: 'headhunter_clients',
  funcionarios: 'funcionarios',
  registroPontos: 'registros_ponto',
  ferias: 'ferias',
  departamentos: 'organograma_empresa',
  cargos: 'cargos_salarios',
  logs: 'auditLogs',
  notificacoes: 'notificacoes',
  assinaturas: 'subscriptions',
  admissoesPendentes: 'solicitacoes_admissao',
  cobrancasHeadhunter: 'financeiro_cobrancas',
} as const;

type Key = keyof typeof COLLECTION_MAP | 'empresaModulos' | 'pagamentos' | 'builderModules' | 'builderVersions' | 'aiLogs' | 'aiSettings';
export type TenantState = Partial<Record<Key, any[]>>;
const aliases = ['empresa_id', 'empresaId', 'companyId', 'tenantId'] as const;

// Áreas administrativas não podem ser regravadas por um save genérico do navegador.
const AUTO_PERSIST_KEYS = new Set<Key>([
  'vagas',
  'candidatos',
  'candidaturas',
  'entrevistas',
  'clientes',
  'funcionarios',
  'registroPontos',
  'ferias',
  'departamentos',
  'cargos',
  'logs',
  'notificacoes',
  'admissoesPendentes',
  'cobrancasHeadhunter',
]);

async function tenantDocs(name: string, companyId: string): Promise<Map<string, any>> {
  const found = new Map<string, any>();
  if (!companyId) return found;
  for (const field of aliases) {
    try {
      const snap = await getDocs(query(collection(db, name), where(field, '==', companyId)));
      snap.forEach((item) => found.set(item.id, { id: item.id, ...item.data() }));
    } catch (error) {
      console.debug(`[Firestore] tenant query skipped ${name}.${field}`, error);
    }
  }
  return found;
}

async function loadEmpresa(companyId: string) {
  if (!companyId) return [];
  const direct = await getDoc(doc(db, 'empresas', companyId));
  if (direct.exists()) return [{ id: direct.id, ...direct.data() }];
  return [...(await tenantDocs('empresas', companyId)).values()];
}

async function loadEmpresaModulos(companyId: string) {
  if (!companyId) return [];
  const primary = await getDoc(doc(db, 'empresa_modulos', companyId));
  const legacy = primary.exists() ? null : await getDoc(doc(db, 'companyModules', companyId));
  const raw: any = primary.exists() ? primary.data() : legacy?.exists() ? legacy.data() : null;
  if (!raw) return [];
  const map = raw.modulos && typeof raw.modulos === 'object'
    ? raw.modulos
    : raw.modules && typeof raw.modules === 'object'
      ? raw.modules
      : raw;
  return Object.entries(map)
    .filter(([, enabled]) => typeof enabled === 'boolean')
    .map(([moduleKey, enabled]) => ({
      id: `${companyId}:${moduleKey}`,
      empresa_id: companyId,
      empresaId: companyId,
      companyId,
      modulo_id: moduleKey,
      modulo_chave: moduleKey,
      ativo: enabled === true,
    }));
}

function normalizeLoaded(key: Key, item: any) {
  if (key === 'vagas') {
    const published = item.publicada === true || item.publicado === true;
    const rawStatus = String(item.status || '').toLowerCase();
    return {
      ...item,
      publicado: published,
      status: published && ['ativa', 'aberta'].includes(rawStatus) ? 'publicada' : item.status,
    };
  }
  return item;
}

function firestorePayload(key: Key, item: any, companyId: string) {
  const base = withTenantAliases(item, companyId);
  if (key === 'vagas') {
    const published = item.publicado === true || item.status === 'publicada';
    return {
      ...base,
      publicada: published,
      publicado: published,
      statusInterno: item.status,
      status: published ? 'Ativa' : item.status === 'rascunho' ? 'Rascunho' : item.status,
    };
  }
  return base;
}

class FirebaseStateBridge {
  async loadTenantState(companyId: string): Promise<TenantState> {
    if (!companyId) return { usuarios: [] };

    const entries = await Promise.all(
      (Object.keys(COLLECTION_MAP) as Array<keyof typeof COLLECTION_MAP>).map(async (key) => {
        const collectionName = COLLECTION_MAP[key];
        const values = key === 'empresas'
          ? await loadEmpresa(companyId)
          : [...(await tenantDocs(collectionName, companyId)).values()];
        return [key, values.map((item) => normalizeLoaded(key, item))] as const;
      }),
    );

    const state = Object.fromEntries(entries) as TenantState;
    state.empresaModulos = await loadEmpresaModulos(companyId);
    state.pagamentos = [];
    state.builderModules = [];
    state.builderVersions = [];
    state.aiLogs = [];
    state.aiSettings = [];
    return state;
  }

  async persistTenantState(companyId: string, state: TenantState): Promise<void> {
    if (!companyId) return;

    for (const key of AUTO_PERSIST_KEYS) {
      const collectionName = COLLECTION_MAP[key as keyof typeof COLLECTION_MAP];
      if (!collectionName) continue;
      const raw = Array.isArray(state[key]) ? state[key]! : [];
      const items = raw.filter((item: any) => tenantIdFrom(item) === companyId);
      for (const item of items) {
        if (!item?.id) continue;
        await setDoc(
          doc(db, collectionName, String(item.id)),
          firestorePayload(key, item, companyId),
          { merge: true }
        );
      }
    }
  }

  async loadPublicPortal(companyId: string) {
    // Compatibilidade autenticada. O portal anônimo usa /api/public/portal,
    // pois `empresas` não é coleção pública nas regras do Firestore.
    const company = await loadEmpresa(companyId);
    const jobs = new Map<string, any>();
    for (const field of aliases) {
      try {
        const snap = await getDocs(query(collection(db, 'vagas'), where(field, '==', companyId)));
        snap.forEach((item) => {
          const data: any = item.data();
          const published = data.publicada === true || data.publicado === true;
          const status = String(data.status || '').toLowerCase();
          if (published && ['ativa', 'aberta', 'publicada'].includes(status)) {
            jobs.set(item.id, normalizeLoaded('vagas', { id: item.id, ...data }));
          }
        });
      } catch {}
    }
    return { empresa: company[0] || null, vagas: [...jobs.values()] };
  }
}

export const firebaseStateBridge = new FirebaseStateBridge();
