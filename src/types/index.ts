export type UserRole =
  | 'master_admin'
  | 'empresa_admin'
  | 'recrutador'
  | 'gestor'
  | 'headhunter'
  | 'candidato';

export type ModuloChave =
  | 'recrutamento'
  | 'headhunter'
  | 'portal_vagas'
  | 'ia_cv'
  | 'agenda'
  | 'departamento_pessoal';

export type StatusVaga = 'rascunho' | 'publicada' | 'em_andamento' | 'pausada' | 'encerrada';
export type ModuloOrigemVaga = 'recrutamento' | 'headhunter';
export type TipoContratacao = 'CLT' | 'PJ' | 'Estagio' | 'Temporario' | 'Outro';
export type ModeloTrabalho = 'Presencial' | 'Hibrido' | 'Remoto';

export interface Empresa {
  id: string;
  nome: string;
  cnpj: string;
  logo_url: string;
  plano_id: string;
  status: 'ativa' | 'suspensa' | 'cancelada';
  endereco: string;
  cidade: string;
  estado: string;
  criado_em: string;
  descricao?: string;
  banner_url?: string;
  cor_principal?: string;
  contato_email?: string;
  contato_telefone?: string;
  website?: string;
  linkedin_url?: string;
  instagram_url?: string;
}

export interface Usuario {
  id: string;
  email: string;
  nome: string;
  avatar_url?: string;
  perfil_id: string;
  role: UserRole;
  empresa_id: string;
  departamento_id?: string;
  status: 'ativo' | 'inativo';
  ultimo_login?: string;
  criado_em: string;
}

export interface Perfil {
  id: string;
  nome: string;
  descricao: string;
  permissoes: string[];
}

export interface Modulo {
  id: string;
  nome: string;
  chave: ModuloChave;
  descricao: string;
  icone: string;
}

export interface EmpresaModulo {
  id: string;
  empresa_id: string;
  modulo_id: string;
  ativo: boolean;
  configuracao?: Record<string, unknown>;
}

export interface Vaga {
  id: string;
  empresa_id: string;
  titulo: string;
  descricao: string;
  departamento: string;
  cargo: string;
  tipo_contratacao: TipoContratacao;
  modelo_trabalho: ModeloTrabalho;
  cidade: string;
  estado: string;
  salario_min?: number;
  salario_max?: number;
  exibir_salario: boolean;
  status: StatusVaga;
  requisitos: string[];
  diferenciais?: string[];
  beneficios?: string[];
  publicado: boolean;
  modulo_origem: ModuloOrigemVaga;
  cliente_id?: string; // Para módulo Headhunter
  honorario_headhunter?: string;
  criado_por: string;
  criado_em: string;
  vagas_qtd: number;
}

export interface Candidato {
  id: string;
  empresa_id: string;
  nome: string;
  email: string;
  telefone: string;
  cidade: string;
  estado: string;
  cargo_desejado: string;
  curriculo_url?: string;
  curriculo_texto?: string;
  resumo_ia?: string;
  score_ia?: number;
  tags: string[];
  experiencias?: Array<{ empresa: string; cargo: string; periodo: string; descricao: string }>;
  formacao?: Array<{ instituisao: string; curso: string; ano: string }>;
  habilidades: string[];
  linkedin_url?: string;
  pretensao_salarial?: string;
  observacoes?: string;
  origem?: 'portal_vagas' | 'banco_talentos_portal' | 'manual' | 'headhunter';
  criado_em: string;
}

export type EtapaPipelineNome =
  | 'Inscritos'
  | 'Triagem IA'
  | 'Entrevista RH'
  | 'Entrevista Gestor'
  | 'Proposta'
  | 'Contratado'
  | 'Reprovado';

export interface Candidatura {
  id: string;
  empresa_id: string;
  vaga_id: string;
  candidato_id: string;
  etapa_pipeline: EtapaPipelineNome;
  ordem_etapa: number;
  status: 'em_andamento' | 'aprovado' | 'reprovado' | 'desistiu';
  pontuacao_compatibilidade: number; // 0 - 100
  parecer_rh?: string;
  parecer_ia?: string;
  resumo_match_ia?: string;
  pontos_fortes_ia?: string[];
  pontos_atencao_ia?: string[];
  perguntas_sugeridas_ia?: string[];
  origem?: 'portal_vagas' | 'banco_talentos_portal' | 'manual' | 'headhunter';
  data_candidatura: string;
  atualizado_em: string;
}

export interface Entrevista {
  id: string;
  empresa_id: string;
  candidatura_id: string;
  vaga_id: string;
  candidato_id: string;
  titulo: string;
  data_hora: string;
  duracao_minutos: number;
  formato: 'Online - Google Meet' | 'Online - Teams' | 'Presencial' | 'Telefone';
  link_reuniao?: string;
  entrevistador_id: string;
  status: 'agendada' | 'realizada' | 'cancelada' | 'remarcada';
  anotacoes?: string;
  sincronizado_gcal?: boolean;
  sincronizado_outlook?: boolean;
  criado_em: string;
}

export interface Avaliacao {
  id: string;
  empresa_id: string;
  candidatura_id: string;
  avaliador_id: string;
  nota: number; // 1 to 5
  comentarios: string;
  pontos_fortes: string;
  pontos_melhoria: string;
  recomendacao: 'Fortemente Recomendado' | 'Recomendado' | 'Neutro' | 'Não Recomendado';
  criado_em: string;
}

export interface PipelineEtapa {
  id: string;
  empresa_id: string;
  vaga_id?: string;
  nome_etapa: EtapaPipelineNome;
  ordem: number;
  cor: string;
}

export interface HistoricoAcao {
  id: string;
  empresa_id: string;
  candidatura_id: string;
  acao: string;
  usuario_id: string;
  usuario_nome: string;
  detalhes: string;
  criado_em: string;
}

export interface Notificacao {
  id: string;
  empresa_id: string;
  usuario_id: string;
  titulo: string;
  mensagem: string;
  lida: boolean;
  link?: string;
  criado_em: string;
}

export interface Anexo {
  id: string;
  empresa_id: string;
  tipo_entidade: 'candidato' | 'vaga' | 'funcionario' | 'empresa';
  entidade_id: string;
  nome_arquivo: string;
  url: string;
  tamanho: string;
  tipo_mime: string;
  criado_em: string;
}

export interface Cliente {
  id: string;
  empresa_id: string;
  nome: string;
  cnpj_cpf: string;
  email: string;
  telefone: string;
  responsavel: string;
  status: 'ativo' | 'inativo';
  vagas_contratadas: number;
  taxa_headhunter: string;
  criado_em: string;
}

export interface Funcionario {
  id: string;
  empresa_id: string;
  nome: string;
  cpf: string;
  email: string;
  telefone: string;
  cargo?: string;
  cargo_id: string;
  cargo_nome: string;
  departamento?: string;
  departamento_id: string;
  departamento_nome: string;
  data_admissao: string;
  salario: number;
  status: 'ativo' | 'ferias' | 'afastado' | 'desligado';
  documento_url?: string;
  banco_horas?: number;
  saldo_ferias_dias?: number;
  criado_em: string;
}

export interface Departamento {
  id: string;
  empresa_id: string;
  nome: string;
  gestor_id?: string;
  gestor_nome?: string;
  qtd_funcionarios?: number;
}

export interface Cargo {
  id: string;
  empresa_id: string;
  departamento_id: string;
  titulo: string;
  nivel: 'Junior' | 'Pleno' | 'Senior' | 'Especialista' | 'Liderança';
  salario_base: number;
}

export interface LogAuditoria {
  id: string;
  empresa_id: string;
  usuario_id: string;
  usuario_nome: string;
  acao: 'LOGIN' | 'LOGOUT' | 'CRIACAO' | 'EDICAO' | 'EXCLUSAO' | 'PERMISSAO' | 'FALHA';
  detalhes: string;
  ip: string;
  resultado: 'SUCESSO' | 'ERRO';
  criado_em: string;
}

export interface Plano {
  id: string;
  nome: string;
  preco_mensal: number;
  max_vagas: number;
  max_usuarios: number;
  modulos_inclusos: ModuloChave[];
  recursos: string[];
}

export interface Assinatura {
  id: string;
  empresa_id: string;
  plano_id: string;
  plano_nome: string;
  status: 'ativa' | 'inadimplente' | 'cancelada' | 'degustacao';
  data_inicio: string;
  data_renovacao: string;
  valor_mensal: number;
}

export interface Pagamento {
  id: string;
  empresa_id: string;
  valor: number;
  status: 'pago' | 'pendente' | 'falhou';
  metodo: 'Pix' | 'Cartao de Credito' | 'Boleto';
  data_pagamento: string;
  fatura_url?: string;
}

// --- CONSTRUTOR MASTER COM IA LOCAL ---

export type AIProviderType = 'ollama' | 'local_ai' | 'custom_provider';

export interface OllamaSettings {
  servidor_url: string;
  modelo_padrao: string;
  modelo_programacao: string;
  modelo_analise: string;
  status_conexao: 'online' | 'offline' | 'processando' | 'indisponivel';
  limite_contexto: number;
  timeout_ms: number;
  modelos_instalados: string[];
  ia_ativa: boolean;
  provider_ativo: AIProviderType;
  ultimo_teste?: string;
}

export type BuilderActionType =
  | 'create_module'
  | 'create_page'
  | 'create_form'
  | 'add_field'
  | 'alter_field'
  | 'create_menu'
  | 'reorganize_menu'
  | 'create_dashboard'
  | 'create_report'
  | 'create_process'
  | 'create_stage'
  | 'create_permission'
  | 'create_automation'
  | 'change_texts'
  | 'alter_appearance'
  | 'config_tenant_resources'
  | 'config_plan_resources';

export interface BuilderField {
  id: string;
  nome: string;
  label: string;
  type: 'text' | 'number' | 'date' | 'select' | 'boolean' | 'textarea' | 'currency' | 'file';
  required: boolean;
  width?: 'full' | 'half' | 'third' | 'twothirds';
  options?: string[];
  visible_roles?: UserRole[];
}

export interface BuilderComponent {
  id: string;
  tipo:
    | 'DynamicTable'
    | 'DynamicForm'
    | 'DynamicDashboard'
    | 'DynamicReport'
    | 'DynamicWorkflow'
    | 'DynamicField'
    | 'DynamicAutomation'
    | 'DynamicMenu';
  titulo: string;
  ordem: number;
  config: Record<string, any>;
}

export interface BuilderPage {
  id: string;
  nome: string;
  slug: string;
  type: 'list' | 'form' | 'dashboard' | 'report' | 'workflow';
  campos: BuilderField[];
  componentes: BuilderComponent[];
  permissoes: string[];
}

export interface BuilderAutomation {
  id: string;
  nome: string;
  gatilho:
    | 'registro_criado'
    | 'registro_atualizado'
    | 'status_alterado'
    | 'etapa_alterada'
    | 'prazo_vencido'
    | 'documento_vencendo'
    | 'candidato_aprovado'
    | 'entrevista_marcada'
    | 'funcionario_admitido'
    | 'pagamento_confirmado';
  acao:
    | 'criar_notificacao'
    | 'enviar_email'
    | 'atualizar_status'
    | 'criar_tarefa'
    | 'atribuir_responsavel'
    | 'gerar_documento'
    | 'liberar_modulo'
    | 'bloquear_modulo'
    | 'registrar_historico';
  descricao: string;
  ativo: boolean;
}

export interface BuilderModule {
  id: string;
  nome: string;
  slug: string;
  descricao: string;
  icone: string;
  empresa_id: string;
  status: 'rascunho' | 'homologacao' | 'producao';
  paginas: BuilderPage[];
  automacoes: BuilderAutomation[];
  versao: string;
  criado_em: string;
  atualizado_em: string;
}

export interface BuilderVersion {
  id: string;
  modulo_id: string;
  versao: string;
  prompt_original: string;
  usuario_nome: string;
  data: string;
  ambiente: 'rascunho' | 'homologacao' | 'producao';
  configuracao: BuilderModule;
  status: 'aplicada' | 'restaurada' | 'desfeita';
  detalhes: string;
}

export interface AILogExecution {
  id: string;
  prompt: string;
  usuario_id: string;
  usuario_nome: string;
  data: string;
  modelo: string;
  duracao_ms: number;
  status: 'sucesso' | 'erro' | 'validando';
  resposta_json: any;
  erros_validacao?: string[];
  ambiente: 'rascunho' | 'homologacao' | 'producao';
}

export interface StructuredAIResponse {
  action: BuilderActionType;
  module?: {
    name: string;
    slug: string;
    icon: string;
    description: string;
  };
  pages?: {
    name: string;
    type: 'list' | 'form' | 'dashboard' | 'report' | 'workflow';
  }[];
  fields?: {
    name: string;
    label?: string;
    type: 'text' | 'number' | 'date' | 'select' | 'boolean' | 'textarea' | 'currency' | 'file';
    required: boolean;
    options?: string[];
  }[];
  permissions?: string[];
  automations?: {
    name: string;
    trigger: BuilderAutomation['gatilho'];
    action: BuilderAutomation['acao'];
    description: string;
  }[];
  appearance?: {
    theme_color?: string;
    menu_label?: string;
    layout_style?: string;
  };
  explanation?: string;
}

