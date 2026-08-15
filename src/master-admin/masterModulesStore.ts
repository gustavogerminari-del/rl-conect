import { saveModuloFirestore } from '../services/ModuleCatalogService';
import type { PlatformModule } from './types/master';

export function normalizePlatformModuleRecord(id: string, raw: Record<string, any>): PlatformModule {
  return {
    id,
    key: String(raw.key || id),
    slug: String(raw.slug || raw.key || id),
    name: String(raw.name || raw.nome || raw.key || id),
    category: raw.category || raw.categoria || 'Ferramentas',
    description: String(raw.description || raw.descricao || ''),
    status: raw.status || (raw.ativo === false ? 'Inativo' : 'Ativo'),
    isCore: Boolean(raw.isCore),
    activeTenantsCount: Number(raw.activeTenantsCount || 0),
    iconName: String(raw.iconName || raw.icone || 'Layers'),
    route: String(raw.route || raw.rota || ''),
    displayOrder: Number(raw.displayOrder || raw.ordem || 99),
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
    createdBy: raw.createdBy,
  };
}

export async function savePlatformModule(module: PlatformModule): Promise<void> {
  const key = String(module.key || module.id || '').trim();
  if (!key) throw new Error('Informe a chave do módulo.');
  await saveModuloFirestore({
    id: module.id || key,
    key,
    nome: module.name,
    descricao: module.description,
    categoria: module.category,
    ativo: module.status === 'Ativo' || module.status === 'Beta',
    icone: module.iconName,
    rota: module.route,
    ordem: module.displayOrder,
  });
}
