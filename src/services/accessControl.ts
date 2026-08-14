import type { ModuloChave, UserRole } from '../types';
import type { ViewTab } from '../components/Sidebar';

export type ModuleState = Partial<Record<ModuloChave, boolean>>;

export function canAccessView(role: UserRole, view: ViewTab, modules: ModuleState = {}): boolean {
  const moduleEnabled = (key: ModuloChave) => modules[key] !== false;

  switch (view) {
    case 'dashboard':
      return role !== 'candidato';
    case 'recrutamento':
      return moduleEnabled('recrutamento') && ['master_admin', 'empresa_admin', 'recrutador', 'gestor'].includes(role);
    case 'headhunter':
      return moduleEnabled('headhunter') && ['master_admin', 'empresa_admin', 'headhunter'].includes(role);
    case 'ia_screening':
      return moduleEnabled('ia_cv') && ['master_admin', 'empresa_admin', 'recrutador', 'headhunter'].includes(role);
    case 'agenda':
      return moduleEnabled('agenda') && ['master_admin', 'empresa_admin', 'recrutador', 'gestor', 'headhunter'].includes(role);
    case 'departamento_pessoal':
      return moduleEnabled('departamento_pessoal') && ['master_admin', 'empresa_admin', 'gestor'].includes(role);
    case 'master_admin':
    case 'construtor_ia':
      return role === 'master_admin';
    case 'portal_vagas':
      return moduleEnabled('portal_vagas') && ['master_admin', 'empresa_admin', 'recrutador', 'headhunter'].includes(role);
    case 'audit_logs':
    case 'settings':
      return ['master_admin', 'empresa_admin'].includes(role);
    default:
      return false;
  }
}

export function moduleStateFromCompanyModules(
  items: Array<{ modulo: { chave: ModuloChave }; ativo: boolean }>
): ModuleState {
  return items.reduce<ModuleState>((state, item) => {
    state[item.modulo.chave] = item.ativo;
    return state;
  }, {});
}
