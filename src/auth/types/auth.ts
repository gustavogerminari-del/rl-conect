/**
 * Módulo AUTENTICAÇÃO E ACESSO - Tipos e Contratos de Segurança
 * Depende exclusivamente do Módulo NÚCLEO.
 */

export type RoleProfile = 
  | 'Super Administrador'
  | 'Administrador'
  | 'Gestor de Seleção'
  | 'Recrutador Sênior'
  | 'Analista de RH'
  | 'Colaborador'
  | 'MASTER'
  | string;

export type UserType = 'MASTER' | 'DEVELOPER' | 'EMPRESA' | 'CANDIDATO' | 'FUNCIONARIO' | 'COLABORADOR';

export type ScreenRouteKey =
  | 'dashboard'
  | 'ponto-digital'
  | 'vagas'
  | 'banco-talentos'
  | 'entrevistas'
  | 'relatorios'
  | 'empresa'
  | 'colaboradores'
  | 'departamento-pessoal'
  | 'beneficios'
  | 'ferias'
  | 'rescisao'
  | 'relatorios-dp'
  | 'configuracoes-trabalhistas'
  | 'equipe-interna'
  | 'site-vagas'
  | 'consultor-rh'
  | 'ferias-beneficios'
  | 'documentos'
  | 'folha-pagamento'
  | 'auditoria'
  | 'planos-saas'
  | 'acesso-master'
  | 'configuracoes'
  | 'portal-colaborador';

export type SystemActionKey =
  | 'create_job'
  | 'edit_job'
  | 'close_job'
  | 'edit_budget'
  | 'approve_hire'
  | 'delete_candidate'
  | 'schedule_interview'
  | 'export_reports'
  | 'edit_settings'
  | 'manage_users'
  | 'headhunter.financeiro.visualizar'
  | 'headhunter.financeiro.editar'
  | 'headhunter.financeiro.encaminhar'
  | 'headhunter.financeiro.cobrar';

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: RoleProfile;
  department: string;
  avatar: string;
  tipoUsuario?: UserType;
  empresaId?: string;
  companyId?: string;
  companyName?: string;
  tenantId?: string;
  tenantName?: string;
  isMaster?: boolean;
  colaboradorId?: string;
  portalAccessStatus?: 'Sem acesso' | 'Convite enviado' | 'Ativo' | 'Bloqueado';
  mustChangePassword?: boolean;
  tempPassword?: string;
  permissions?: Record<string, boolean> | string[];
  /** Modules explicitly assigned to this access in the Master panel. */
  modules?: Record<string, boolean>;
}

export interface UserCredentials {
  email: string;
  password?: string;
}

export interface SessionToken {
  token: string;
  expiresAt: string;
  createdAt: string;
}

export interface AuthSessionData {
  user: UserProfile;
  session: SessionToken;
}
