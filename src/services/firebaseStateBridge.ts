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
  clientes: 'clientes',
  funcionarios: 'funcionarios',
  registroPontos: 'registroPontos',
  ferias: 'ferias',
  departamentos: 'departamentos',
  cargos: 'cargos',
  logs: 'logs',
  notificacoes: 'notificacoes',
  empresaModulos: 'empresaModulos',
  assinaturas: 'assinaturas',
  pagamentos: 'pagamentos',
  admissoesPendentes: 'solicitacoes_admissao',
  cobrancasHeadhunter: 'financeiro_cobrancas',
  builderModules: 'ai_builder_modules',
  builderVersions: 'ai_builder_versions',
  aiLogs: 'ai_logs',
  aiSettings: 'ai_settings',
} as const;

type Key = keyof typeof COLLECTION_MAP;
export type TenantState = Partial<Record<Key, any[]>>;
const aliases = ['empresa_id', 'empresaId', 'companyId', 'tenantId'] as const;

// Estas coleções pertencem ao controle comercial/MASTER e nunca devem ser
// regravadas automaticamente quando um usuário da empresa altera vaga, DP etc.
const MASTER_MANAGED_KEYS = new Set<Key>(['empresaModulos', 'assinaturas', 'pagamentos', 'aiSettings']);

async function tenantDocs(name: string, companyId: string): Promise<Map<string, any>> {
  const found = new Map<string, any>();
  for (const field of aliases) {
    try {
      const snap = await getDocs(query(collection(db, name), where(field, '==', companyId)));
      snap.forEach(d => found.set(d.id, { id: d.id, ...d.data() }));
    } catch (error) {
      console.debug(`[Firestore] tenant query skipped ${name}.${field}`, error);
    }
  }
  return found;
}

async function loadEmpresa(companyId: string) {
  const direct = await getDoc(doc(db, 'empresas', companyId));
  if (direct.exists()) return [{ id: direct.id, ...direct.data() }];
  return [...(await tenantDocs('empresas', companyId)).values()];
}

class FirebaseStateBridge {
  async loadTenantState(companyId: string): Promise<TenantState> {
    const entries = await Promise.all(
      (Object.keys(COLLECTION_MAP) as Key[]).map(async key => {
        const collectionName = COLLECTION_MAP[key];
        const values = key === 'empresas'
          ? await loadEmpresa(companyId)
          : [...(await tenantDocs(collectionName, companyId)).values()];
        return [key, values] as const;
      }),
    );
    return Object.fromEntries(entries) as TenantState;
  }

  async persistTenantState(companyId: string, state: TenantState): Promise<void> {
    if (!companyId) return;

    const failures: string[] = [];
    for (const key of Object.keys(COLLECTION_MAP) as Key[]) {
      if (MASTER_MANAGED_KEYS.has(key)) continue;

      const collectionName = COLLECTION_MAP[key];
      const raw = Array.isArray(state[key]) ? state[key]! : [];
      const items = raw.filter((item: any) => key === 'empresas' ? item.id === companyId : tenantIdFrom(item) === companyId);

      for (const item of items) {
        if (!item?.id) continue;
        const payload = key === 'empresas'
          ? { ...item, empresa_id: companyId, empresaId: companyId, companyId }
          : withTenantAliases(item, companyId);
        try {
          await setDoc(doc(db, collectionName, String(item.id)), payload, { merge: true });
        } catch (error) {
          failures.push(`${collectionName}/${item.id}: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
    }

    if (failures.length) {
      console.error('[Firestore] Algumas gravações do tenant falharam:', failures);
      throw new Error(`Falha ao salvar ${failures.length} registro(s) no Firebase. ${failures[0]}`);
    }
  }

  async loadPublicPortal(companyId: string) {
    const company = await loadEmpresa(companyId);
    const jobs = new Map<string, any>();
    for (const field of aliases) {
      try {
        const snap = await getDocs(query(collection(db, 'vagas'), where(field, '==', companyId)));
        snap.forEach(d => {
          const data: any = d.data();
          const published = data.publicado === true || data.publicada === true;
          const status = String(data.status || '').toLowerCase();
          if (published && !['encerrada', 'fechada', 'cancelada'].includes(status)) jobs.set(d.id, { id: d.id, ...data });
        });
      } catch (error) {
        console.debug(`[Firestore] public portal query skipped vagas.${field}`, error);
      }
    }
    return { empresa: company[0] || null, vagas: [...jobs.values()] };
  }
}

export const firebaseStateBridge = new FirebaseStateBridge();
