import type { MasterPlanPreset, TenantModulePermissions } from '../types/master';

export interface MasterPlanPresetConfig {
  name: MasterPlanPreset;
  maxUsers: number;
  maxActiveJobs: number;
  modules: Partial<TenantModulePermissions>;
}

export const MASTER_PLAN_PRESETS: MasterPlanPresetConfig[] = [
  { name: 'Básico', maxUsers: 5, maxActiveJobs: 10, modules: { recrutamento: true, vagas: true, bancoTalentos: true, entrevistas: true } },
  { name: 'Intermediário', maxUsers: 15, maxActiveJobs: 30, modules: { recrutamento: true, vagas: true, bancoTalentos: true, entrevistas: true, equipeInterna: true, consultorRH: true, headhunter: true } },
  { name: 'Completo / Enterprise', maxUsers: 100, maxActiveJobs: 500, modules: { recrutamento: true, departamentoPessoal: true, vagas: true, headhunter: true, bancoTalentos: true, entrevistas: true, equipeInterna: true, consultorRH: true, feriasBeneficios: true, documentosAssinatura: true, auditoriaLogs: true, relatoriosAvancados: true, siteVagasPersonalizado: true, folha: true, ponto: true } },
  { name: 'Customizado', maxUsers: 1, maxActiveJobs: 1, modules: {} },
];
