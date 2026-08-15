/**
 * MÓDULO ACESSO MASTER (SUPER ADMINISTRADOR) - Contratos e Tipos TypeScript
 * MAIS RH - Sistema de Gestão de Pessoas
 * 
 * Depende exclusivamente de:
 * 1. NÚCLEO (/src/core)
 * 2. COMPARTILHADO (/src/shared)
 * 3. AUTENTICAÇÃO (/src/auth)
 */

export type TenantStatus =
  | 'Ativo'
  | 'Vencido / Tolerância'
  | 'Bloqueado por Inadimplência'
  | 'Suspenso'
  | 'Aguardando Pagamento'
  | 'Cancelado'
  | 'Em Teste (Trial)';

export type MasterPlanPreset = 'Básico' | 'Intermediário' | 'Completo / Enterprise' | 'Customizado';

export interface TenantModulePermissions {
  recrutamento?: boolean;
  departamentoPessoal?: boolean;
  vagas: boolean;
  headhunter?: boolean;
  bancoTalentos: boolean;
  entrevistas: boolean;
  equipeInterna: boolean;
  consultorRH: boolean;
  feriasBeneficios: boolean;
  documentosAssinatura: boolean;
  auditoriaLogs: boolean;
  relatoriosAvancados: boolean;
  siteVagasPersonalizado: boolean;
  folha?: boolean;
  ponto?: boolean;
}

export interface TenantBranding {
  logoUrl?: string;
  primaryColor: string; // Ex: #4F46E5
  companyDisplayName: string;
  customDomain?: string;
}

export interface TenantUsageMetrics {
  activeUsersCount: number;
  totalJobsCreated: number;
  totalTalentsStored: number;
  totalDocumentsSigned: number;
  storageUsedMB: number;
  lastLoginAt: string;
}

export interface TenantContract {
  id: string;
  contractNumber: string;
  planName: MasterPlanPreset;
  monthlyFee: number;
  billingCycle: 'Mensal' | 'Trimestral' | 'Anual';
  startDate: string;
  expirationDate: string;
  paymentMethod: 'Boleto Bancário' | 'Cartão de Crédito' | 'Pix' | 'Faturamento Direct';
  autoRenew: boolean;
}

export interface TenantAddress {
  cep: string;
  street: string;
  number: string;
  complement?: string;
  neighborhood: string;
  cityUf: string;
}

export interface TenantAdminCredentials {
  adminEmail: string;
  initialPassword?: string;
  sendWelcomeEmail?: boolean;
  createdAt?: string;
}

export interface ClientTenant {
  id: string;
  code: string;
  companyName: string;
  tradeName: string;
  cnpj: string;
  ownerName: string;
  ownerEmail: string;
  ownerPhone: string;
  address?: TenantAddress;
  adminCredentials?: TenantAdminCredentials;
  status: TenantStatus;
  maxUsers: number;
  maxActiveJobs: number;
  modules: TenantModulePermissions;
  branding: TenantBranding;
  metrics: TenantUsageMetrics;
  contract: TenantContract;
  createdAt: string;
  notes?: string;
  gracePeriodEndsAt?: string;
  financialStatus?: string;
  updatedAt?: string;
}

export type MasterLeadStatus = 'NOVO' | 'EM_ATENDIMENTO' | 'QUALIFICADO' | 'PROPOSTA' | 'NEGOCIACAO' | 'GANHO' | 'PERDIDO';

export interface MasterLead {
  id: string;
  name: string;
  companyName: string;
  cnpj?: string;
  phone?: string;
  email: string;
  source: 'PORTAL' | 'COMERCIAL' | 'EMAIL' | 'API' | 'MANUAL' | string;
  interest?: string;
  ownerId?: string;
  ownerName?: string;
  notes?: string;
  status: MasterLeadStatus;
  companyId?: string;
  history?: Array<{ at: string; action: string; userId?: string }>;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  updatedBy?: string;
}

export type MasterFinancialStatus = 'PENDENTE' | 'PAGO' | 'VENCIDO' | 'CANCELADO' | 'ESTORNADO';
export interface MasterFinancialEntry {
  id: string;
  type: 'RECEBER' | 'PAGAR';
  description: string;
  category?: string;
  companyId?: string;
  companyName?: string;
  supplier?: string;
  amount: number;
  dueDate: string;
  paidAt?: string;
  paymentMethod?: string;
  status: MasterFinancialStatus;
  externalId?: string;
  idempotencyKey?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  updatedBy?: string;
}

export interface MasterInvoiceRecord {
  id: string;
  companyId?: string;
  companyName?: string;
  financialEntryId?: string;
  paymentId?: string;
  amount: number;
  status: 'PENDENTE' | 'EMITIDA' | 'ERRO' | 'CANCELADA';
  number?: string;
  issuedAt?: string;
  pdfUrl?: string;
  xmlUrl?: string;
  errorMessage?: string;
  idempotencyKey?: string;
  createdAt: string;
  updatedAt: string;
}

export interface MasterSupportTicket {
  id: string;
  companyId: string;
  companyName?: string;
  subject: string;
  description: string;
  status: 'ABERTO' | 'EM_ATENDIMENTO' | 'AGUARDANDO_CLIENTE' | 'RESOLVIDO' | 'CANCELADO';
  priority: 'BAIXA' | 'NORMAL' | 'ALTA' | 'CRITICA';
  responsibleId?: string;
  responsibleName?: string;
  guidance?: string;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  updatedBy?: string;
}

export interface MasterIntegrationStatus {
  id: string;
  name: string;
  provider?: string;
  companyId?: string;
  status: 'CONECTADO' | 'DESCONECTADO' | 'ERRO' | 'CONFIGURACAO_PENDENTE';
  lastCheckedAt?: string;
  errorMessage?: string;
  updatedAt?: string;
}

export interface MasterBackupRecord {
  id: string;
  status: 'PENDENTE' | 'EM_EXECUCAO' | 'CONCLUIDO' | 'FALHA';
  startedAt?: string;
  finishedAt?: string;
  nextRunAt?: string;
  durationMs?: number;
  source?: string;
  destination?: string;
  sizeBytes?: number;
  errorMessage?: string;
  createdAt?: string;
}

export interface MasterGlobalSettings {
  id: 'global';
  platformName: string;
  billingPeriodDays: number;
  gracePeriodDays: number;
  supportEmail?: string;
  privacyPolicyUrl?: string;
  termsUrl?: string;
  updatedAt?: string;
  updatedBy?: string;
}

export interface SystemAnnouncement {
  id: string;
  title: string;
  message: string;
  targetAudience: 'TODOS' | 'APENAS_ATIVOS' | 'EM_RISCO_RENOVACAO' | 'ESPECIFICO';
  targetTenantIds?: string[];
  sentAt: string;
  senderName: string;
  priority: 'BAIXA' | 'NORMAL' | 'ALTA' | 'CRITICA';
}

export interface BackupRecord {
  id: string;
  tenantId: string;
  tenantName: string;
  createdAt: string;
  fileSizeBytes: number;
  checksum: string;
  status: 'Concluído' | 'Em Processamento' | 'Falha';
}

// 💳 PLANOS & SAAS
export interface SaaSPlan {
  id: string;
  name: MasterPlanPreset;
  description: string;
  monthlyPrice: number;
  annualDiscountPercent: number;
  maxUsers: number;
  maxActiveJobs: number;
  maxEmployees: number;
  includedModules: (keyof TenantModulePermissions)[];
  status: 'Ativo' | 'Rascunho' | 'Arquivado';
  subscribersCount: number;
}

// 🧩 GERENCIADOR DE MÓDULOS DA PLATAFORMA
export type ModuleCategory = 
  | 'Recrutamento' 
  | 'Headhunter' 
  | 'Departamento Pessoal' 
  | 'Financeiro' 
  | 'Portal' 
  | 'IA' 
  | 'Relatórios' 
  | 'Ferramentas' 
  | 'Integrações' 
  | 'Segurança' 
  | 'DP' 
  | 'Ponto' 
  | 'Folha' 
  | 'Benefícios' 
  | 'Gestão';

export type ModuleStatus = 'Ativo' | 'Beta' | 'Em Desenvolvimento' | 'Desativado' | 'Inativo';

export interface PlatformModuleAuditLog {
  id: string;
  moduleId: string;
  action: string;
  changedBy: string;
  companyName?: string;
  details: string;
  timestamp: string;
  ipAddress?: string;
}

export interface PlatformModule {
  id: string;
  key: string;
  slug?: string;
  name: string;
  category: ModuleCategory;
  description: string;
  status: ModuleStatus;
  version?: string;
  moduleType?: 'Core' | 'Opcional' | 'Beta' | 'Integração' | 'Addon';
  isCore: boolean;
  isBeta?: boolean;
  isVisible?: boolean;
  isInstalled?: boolean;
  allowActivation?: boolean;
  allowDeactivation?: boolean;
  requiredModules?: string[];
  requiredPlan?: string;
  totalCompaniesUsing?: number;
  activeTenantsCount: number;
  displayOrder?: number;
  iconName: string;
  route?: string;
  createdAt?: string;
  updatedAt?: string;
  createdBy?: string;
}

// 🎨 CONSTRUTOR VISUAL
export interface PlatformVisualConfig {
  activeTheme: 'Indigo Moderno' | 'Slate Executivo' | 'Emerald Pro' | 'Rose Luxury';
  primaryColor: string;
  secondaryColor: string;
  fontFamily: 'Plus Jakarta Sans' | 'Inter' | 'Roboto' | 'Playfair Display';
  globalLogoUrl: string;
  allowClientCustomLogo: boolean;
  enableCustomFields: boolean;
}

// 🤖 INTELIGÊNCIA ARTIFICIAL
export interface AIPromptTemplate {
  id: string;
  title: string;
  feature: 'Triagem de CV' | 'Descrição de Vaga' | 'Resumo Entrevista' | 'Consultor RH' | 'Análise de Desempenho';
  promptText: string;
  model: 'gemini-2.5-flash' | 'gemini-2.5-pro';
  active: boolean;
}

export interface AIUsageLog {
  id: string;
  tenantName: string;
  feature: string;
  tokensUsed: number;
  costEstUSD: number;
  requestedAt: string;
  status: 'Sucesso' | 'Erro' | 'Throttled';
}

// 🤝 PARCEIROS
export interface PartnerBenefit {
  id: string;
  name: string;
  category: 'Alimentação / Refeição' | 'Saúde & Odonto' | 'Mobilidade & Combustível' | 'Bem-estar & Academia' | 'Seguros';
  logoUrl: string;
  agreementStatus: 'Ativo' | 'Em Negociação' | 'Pendente';
  commissionRatePercent: number;
  monthlyVolumeBRL: number;
  activeEmployeesCount: number;
  contactPerson: string;
  contactEmail: string;
}

// 👥 USUÁRIOS E PERMISSÕES DA PLATAFORMA
export interface PlatformAdminUser {
  id: string;
  name: string;
  email: string;
  role: 'Super Administrador' | 'Suporte Técnico' | 'CS & Onboarding' | 'Financeiro Master';
  status: 'Ativo' | 'Inativo';
  lastAccessAt: string;
  avatar: string;
}

// 🔐 SEGURANÇA E AUDITORIA
export interface AuditSecurityLog {
  id: string;
  timestamp: string;
  tenantName: string;
  userName: string;
  userRole: string;
  actionCategory: 'LOGIN' | 'ALTERACAO_DADOS' | 'EXPORTACAO' | 'CONF_EXCLUSAO' | 'MUDANCA_PERMISSAO';
  description: string;
  ipAddress: string;
  severity: 'BAIXA' | 'MEDIA' | 'ALTA' | 'CRITICA';
}
