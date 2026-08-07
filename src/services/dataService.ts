import {
  Empresa,
  Usuario,
  Vaga,
  Candidato,
  Candidatura,
  Entrevista,
  Avaliacao,
  Cliente,
  Funcionario,
  Departamento,
  Cargo,
  LogAuditoria,
  Notificacao,
  Plano,
  Assinatura,
  Pagamento,
  EmpresaModulo,
  Modulo,
  UserRole,
  OllamaSettings,
  BuilderModule,
  BuilderVersion,
  AILogExecution,
  StructuredAIResponse,
} from '../types';

// Storage keys for persistent state
const STORAGE_PREFIX = 'rl_connect_v2_';

function loadFromStorage<T>(key: string, defaultValue: T): T {
  try {
    const saved = localStorage.getItem(STORAGE_PREFIX + key);
    if (saved) return JSON.parse(saved);
  } catch (err) {
    console.error('Error loading from storage:', err);
  }
  return defaultValue;
}

function saveToStorage<T>(key: string, value: T): void {
  try {
    localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(value));
  } catch (err) {
    console.error('Error saving to storage:', err);
  }
}

// Initial Seed Data
const initialEmpresas: Empresa[] = [
  {
    id: 'emp_1',
    nome: 'TechCorp Solutions',
    cnpj: '12.345.678/0001-90',
    logo_url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=150&auto=format&fit=crop&q=80',
    plano_id: 'enterprise',
    status: 'ativa',
    endereco: 'Av. Paulista, 1000 - Bela Vista',
    cidade: 'São Paulo',
    estado: 'SP',
    criado_em: '2025-01-15T10:00:00Z',
  },
  {
    id: 'emp_2',
    nome: 'RL Headhunting Executive',
    cnpj: '98.765.432/0001-10',
    logo_url: 'https://images.unsplash.com/photo-1560179707-f14e90ef3623?w=150&auto=format&fit=crop&q=80',
    plano_id: 'premium',
    status: 'ativa',
    endereco: 'Rua Faria Lima, 2500 - Itaim Bibi',
    cidade: 'São Paulo',
    estado: 'SP',
    criado_em: '2025-02-01T11:30:00Z',
  },
  {
    id: 'emp_3',
    nome: 'Inovare Varejo & Logística',
    cnpj: '45.678.901/0001-55',
    logo_url: 'https://images.unsplash.com/photo-1542744100-8a9158d23b88?w=150&auto=format&fit=crop&q=80',
    plano_id: 'pro',
    status: 'ativa',
    endereco: 'Av. Afonso Pena, 1500',
    cidade: 'Belo Horizonte',
    estado: 'MG',
    criado_em: '2025-03-10T09:15:00Z',
  },
];

const initialUsuarios: Usuario[] = [
  {
    id: 'usr_master',
    email: 'master@rlconnect.com.br',
    nome: 'Gustavo Germinari (Admin Master)',
    role: 'master_admin',
    empresa_id: 'emp_1',
    perfil_id: 'perf_master',
    status: 'ativo',
    ultimo_login: '2026-08-06T09:45:00Z',
    criado_em: '2025-01-01T00:00:00Z',
  },
  {
    id: 'usr_admin_1',
    email: 'carlos.rh@techcorp.com.br',
    nome: 'Carlos Silva (Diretor de RH)',
    role: 'empresa_admin',
    empresa_id: 'emp_1',
    perfil_id: 'perf_admin',
    status: 'ativo',
    ultimo_login: '2026-08-06T08:30:00Z',
    criado_em: '2025-01-16T10:00:00Z',
  },
  {
    id: 'usr_rec_1',
    email: 'mariana.recrutadora@techcorp.com.br',
    nome: 'Mariana Costa (Recrutadora Senior)',
    role: 'recrutador',
    empresa_id: 'emp_1',
    perfil_id: 'perf_recruiter',
    status: 'ativo',
    ultimo_login: '2026-08-05T17:10:00Z',
    criado_em: '2025-01-20T14:00:00Z',
  },
  {
    id: 'usr_gestor_1',
    email: 'roberto.tech@techcorp.com.br',
    nome: 'Roberto Santos (Gestor de Engenharia)',
    role: 'gestor',
    empresa_id: 'emp_1',
    perfil_id: 'perf_gestor',
    status: 'ativo',
    ultimo_login: '2026-08-04T11:20:00Z',
    criado_em: '2025-01-22T09:00:00Z',
  },
  {
    id: 'usr_head_2',
    email: 'patricia.executive@rlheadhunting.com.br',
    nome: 'Patricia Albuquerque (Headhunter)',
    role: 'headhunter',
    empresa_id: 'emp_2',
    perfil_id: 'perf_headhunter',
    status: 'ativo',
    ultimo_login: '2026-08-06T09:12:00Z',
    criado_em: '2025-02-02T13:00:00Z',
  },
  {
    id: 'usr_cand_1',
    email: 'lucas.fernandes@email.com',
    nome: 'Lucas Fernandes (Candidato)',
    role: 'candidato',
    empresa_id: 'emp_1',
    perfil_id: 'perf_candidato',
    status: 'ativo',
    ultimo_login: '2026-08-05T20:00:00Z',
    criado_em: '2025-02-10T16:00:00Z',
  },
];

const initialModulos: Modulo[] = [
  { id: 'mod_1', nome: 'Recrutamento & Seleção (ATS)', chave: 'recrutamento', descricao: 'Pipeline de vagas, triagem e kanban', icone: 'Briefcase' },
  { id: 'mod_2', nome: 'Módulo Headhunter Executive', chave: 'headhunter', descricao: 'Gestão de clientes e vagas para consultoria', icone: 'UserCheck' },
  { id: 'mod_3', nome: 'Portal de Vagas Público', chave: 'portal_vagas', descricao: 'Página de carreiras e aplicação de candidatos', icone: 'Globe' },
  { id: 'mod_4', nome: 'IA Generativa & Triagem CV', chave: 'ia_cv', descricao: 'Leitura automática e pontuação de currículos', icone: 'Sparkles' },
  { id: 'mod_5', nome: 'Agenda e Agendamento', chave: 'agenda', descricao: 'Integrações Google Calendar & Outlook', icone: 'Calendar' },
  { id: 'mod_6', nome: 'Departamento Pessoal (DP)', chave: 'departamento_pessoal', descricao: 'Funcionários, Ponto, Férias e Documentos', icone: 'Users' },
];

const initialEmpresaModulos: EmpresaModulo[] = [
  { id: 'em_1', empresa_id: 'emp_1', modulo_id: 'mod_1', ativo: true },
  { id: 'em_2', empresa_id: 'emp_1', modulo_id: 'mod_2', ativo: true },
  { id: 'em_3', empresa_id: 'emp_1', modulo_id: 'mod_3', ativo: true },
  { id: 'em_4', empresa_id: 'emp_1', modulo_id: 'mod_4', ativo: true },
  { id: 'em_5', empresa_id: 'emp_1', modulo_id: 'mod_5', ativo: true },
  { id: 'em_6', empresa_id: 'emp_1', modulo_id: 'mod_6', ativo: true },
  // Company 2: Headhunter
  { id: 'em_7', empresa_id: 'emp_2', modulo_id: 'mod_1', ativo: true },
  { id: 'em_8', empresa_id: 'emp_2', modulo_id: 'mod_2', ativo: true },
  { id: 'em_9', empresa_id: 'emp_2', modulo_id: 'mod_3', ativo: true },
  { id: 'em_10', empresa_id: 'emp_2', modulo_id: 'mod_4', ativo: true },
  { id: 'em_11', empresa_id: 'emp_2', modulo_id: 'mod_5', ativo: true },
  { id: 'em_12', empresa_id: 'emp_2', modulo_id: 'mod_6', ativo: false },
];

const initialVagas: Vaga[] = [
  {
    id: 'vaga_1',
    empresa_id: 'emp_1',
    titulo: 'Desenvolvedor Full Stack React & Node.js Senior',
    descricao: 'Buscamos um desenvolvedor senior com experiência sólida em React, Node.js, TypeScript e bancos relacionais PostgreSQL.',
    departamento: 'Engenharia de Software',
    cargo: 'Desenvolvedor Senior',
    tipo_contratacao: 'CLT',
    modelo_trabalho: 'Remoto',
    cidade: 'São Paulo',
    estado: 'SP',
    salario_min: 14000,
    salario_max: 18000,
    exibir_salario: true,
    status: 'publicada',
    requisitos: ['TypeScript / Node.js 4+ anos', 'React 18+ com Tailwind CSS', 'PostgreSQL / Supabase', 'Arquitetura de microsserviços e APIs REST'],
    diferenciais: ['Experiência com Next.js / Cloud Run', 'Conhecimento em Docker e CI/CD'],
    beneficios: ['Vale Refeição R$ 1.200/mês', 'Plano de Saúde Bradesco Top', 'Auxílio Home Office R$ 400', 'Seguro de Vida'],
    publicado: true,
    modulo_origem: 'recrutamento',
    criado_por: 'usr_admin_1',
    criado_em: '2026-07-15T10:00:00Z',
    vagas_qtd: 2,
  },
  {
    id: 'vaga_2',
    empresa_id: 'emp_1',
    titulo: 'Especialista em RH & Tech Recruiter',
    descricao: 'Profissional estratégico para liderar o recrutamento de posições de engenharia e produto.',
    departamento: 'Recursos Humanos',
    cargo: 'Tech Recruiter Lead',
    tipo_contratacao: 'CLT',
    modelo_trabalho: 'Hibrido',
    cidade: 'São Paulo',
    estado: 'SP',
    salario_min: 8000,
    salario_max: 11000,
    exibir_salario: true,
    status: 'publicada',
    requisitos: ['3+ anos de experiência em hunting de perfis de TI', 'Inglês intermediário/avançado', 'Domínio de plataformas ATS'],
    beneficios: ['Vale Refeição', 'Plano de Saúde', 'Bônus por Contratação'],
    publicado: true,
    modulo_origem: 'recrutamento',
    criado_por: 'usr_admin_1',
    criado_em: '2026-07-20T14:30:00Z',
    vagas_qtd: 1,
  },
  {
    id: 'vaga_3',
    empresa_id: 'emp_2',
    titulo: 'Diretor Financeiro (CFO) Executive Search',
    descricao: 'Posição executiva de alto impacto para grupo multinacional do setor financeiro.',
    departamento: 'Executivo',
    cargo: 'CFO / Diretor Financeiro',
    tipo_contratacao: 'PJ',
    modelo_trabalho: 'Presencial',
    cidade: 'São Paulo',
    estado: 'SP',
    salario_min: 35000,
    salario_max: 50000,
    exibir_salario: false,
    status: 'em_andamento',
    requisitos: ['10+ anos de liderança em finanças corporativas', 'Experiência prévia em IPO ou M&A', 'Fluência em Inglês'],
    publicado: true,
    modulo_origem: 'headhunter',
    cliente_id: 'cli_1',
    honorario_headhunter: '2.5 salários brutos',
    criado_por: 'usr_head_2',
    criado_em: '2026-07-01T09:00:00Z',
    vagas_qtd: 1,
  },
];

const initialCandidatos: Candidato[] = [
  {
    id: 'cand_1',
    empresa_id: 'emp_1',
    nome: 'Lucas Fernandes',
    email: 'lucas.fernandes@email.com',
    telefone: '(11) 98765-4321',
    cidade: 'São Paulo',
    estado: 'SP',
    cargo_desejado: 'Desenvolvedor Full Stack Senior',
    curriculo_url: 'https://example.com/curriculo_lucas.pdf',
    curriculo_texto: 'Desenvolvedor Full Stack com 6 anos de experiência em React, Node.js, TypeScript e arquitetura Serverless. Experiência em empresas de tecnologia de alto crescimento. Liderança técnica de equipes de 8 desenvolvedores.',
    resumo_ia: 'Perfil altamente compatível com nível Senior. Forte bagagem técnica em ecossistema JS/TS, integração com microsserviços e bancos de dados relacionais.',
    score_ia: 94,
    tags: ['Senior', 'TypeScript', 'Node.js', 'React', 'PostgreSQL'],
    habilidades: ['React', 'TypeScript', 'Node.js', 'PostgreSQL', 'Docker', 'GraphQL', 'Tailwind CSS'],
    experiencias: [
      { empresa: 'Fintech Alfa', cargo: 'Senior Full Stack Engineer', periodo: '2023 - Presente', descricao: 'Desenvolvimento de APIs de pagamentos de alta disponibilidade.' },
      { empresa: 'Software House Beta', cargo: 'Mid/Senior Developer', periodo: '2020 - 2023', descricao: 'Criação de dashboards e aplicações web reativas.' },
    ],
    formacao: [
      { instituisao: 'USP - Universidade de São Paulo', curso: 'Bacharelado em Ciências da Computação', ano: '2019' },
    ],
    criado_em: '2026-07-22T11:00:00Z',
  },
  {
    id: 'cand_2',
    empresa_id: 'emp_1',
    nome: 'Camila Rocha',
    email: 'camila.rocha@email.com',
    telefone: '(11) 97654-3210',
    cidade: 'Campinas',
    estado: 'SP',
    cargo_desejado: 'Tech Recruiter',
    curriculo_url: 'https://example.com/curriculo_camila.pdf',
    curriculo_texto: 'Psicóloga com especialização em Gestão de Pessoas e 4 anos de experiência como Tech Recruiter em startups. Atuação em alinhamento de perfil com gestores técnicos e indicadores de time-to-hire.',
    resumo_ia: 'Excelente experiência em hunting ativo no LinkedIn Recruiter. Ótima comunicação e domínio do processo seletivo end-to-end.',
    score_ia: 88,
    tags: ['Tech Recruiter', 'Hunting', 'Psicologia', 'LinkedIn Recruiter'],
    habilidades: ['Tech Hunting', 'Entrevistas por Competência', 'Indicadores de RH', 'Alinhamento com Gestores'],
    experiencias: [
      { empresa: 'Tech Startup Gamma', cargo: 'Tech Recruiter Senior', periodo: '2022 - Presente', descricao: 'Recrutamento de desenvolvedores, cientistas de dados e DevOps.' },
    ],
    formacao: [
      { instituisao: 'PUC Campinas', curso: 'Bacharelado em Psicologia', ano: '2020' },
    ],
    criado_em: '2026-07-25T15:30:00Z',
  },
  {
    id: 'cand_3',
    empresa_id: 'emp_1',
    nome: 'Rodrigo Oliveira',
    email: 'rodrigo.oliveira@devmail.com',
    telefone: '(21) 99887-6655',
    cidade: 'Rio de Janeiro',
    estado: 'RJ',
    cargo_desejado: 'Desenvolvedor Full Stack',
    curriculo_texto: 'Desenvolvedor Pleno com 3 anos em React e Express. Busca transição para nível Senior. Experiência prévia em projetos governamentais.',
    resumo_ia: 'Candidato com boa base conceitual. Nível pleno forte, necessita de leve validação prática no teste de arquitetura.',
    score_ia: 76,
    tags: ['Pleno', 'React', 'Express', 'SQL'],
    habilidades: ['React', 'Express', 'Node.js', 'MySQL'],
    criado_em: '2026-07-28T09:15:00Z',
  },
];

const initialCandidaturas: Candidatura[] = [
  {
    id: 'cand_app_1',
    empresa_id: 'emp_1',
    vaga_id: 'vaga_1',
    candidato_id: 'cand_1',
    etapa_pipeline: 'Entrevista Gestor',
    ordem_etapa: 4,
    status: 'em_andamento',
    pontuacao_compatibilidade: 94,
    parecer_rh: 'Candidato extremamente preparado, ótima comunicação técnica e fit cultural excelente com o time de engenharia.',
    parecer_ia: 'Adequação de 94%. O perfil possui todos os requisitos obrigatórios e excedeu as expectativas nos diferenciais de arquitetura e PostgreSQL.',
    resumo_match_ia: 'Aderência perfeita às tecnologias exigidas (React, Node.js, TypeScript e Supabase/PostgreSQL).',
    pontos_fortes_ia: [
      '6 anos de experiência sólida em TypeScript',
      'Liderança prévia de equipes de engenharia',
      'Excelente histórico em fintechs',
    ],
    pontos_atencao_ia: ['Expectativa salarial no topo da faixa orçada.'],
    perguntas_sugeridas_ia: [
      'Como você aborda o gerenciamento de conexões concorrentes no PostgreSQL/Supabase?',
      'Conte um exemplo de refatoração complexa que você liderou e os impactos gerados.',
    ],
    data_candidatura: '2026-07-23T10:00:00Z',
    atualizado_em: '2026-08-04T16:00:00Z',
  },
  {
    id: 'cand_app_2',
    empresa_id: 'emp_1',
    vaga_id: 'vaga_2',
    candidato_id: 'cand_2',
    etapa_pipeline: 'Entrevista RH',
    ordem_etapa: 3,
    status: 'em_andamento',
    pontuacao_compatibilidade: 88,
    parecer_rh: 'Agendada conversa para avaliação de fit cultural e alinhamento salarial.',
    parecer_ia: 'Adequação de 88%. Forte experiência em tech hunting.',
    data_candidatura: '2026-07-26T11:20:00Z',
    atualizado_em: '2026-08-02T14:10:00Z',
  },
  {
    id: 'cand_app_3',
    empresa_id: 'emp_1',
    vaga_id: 'vaga_1',
    candidato_id: 'cand_3',
    etapa_pipeline: 'Triagem IA',
    ordem_etapa: 2,
    status: 'em_andamento',
    pontuacao_compatibilidade: 76,
    parecer_ia: 'Adequação de 76%. Perfil Pleno que atende a maioria dos requisitos.',
    data_candidatura: '2026-07-28T10:00:00Z',
    atualizado_em: '2026-07-28T10:00:00Z',
  },
];

const initialEntrevistas: Entrevista[] = [
  {
    id: 'ent_1',
    empresa_id: 'emp_1',
    candidatura_id: 'cand_app_1',
    vaga_id: 'vaga_1',
    candidato_id: 'cand_1',
    titulo: 'Entrevista Técnica com Gestor de Engenharia',
    data_hora: '2026-08-07T14:00:00Z',
    duracao_minutos: 60,
    formato: 'Online - Google Meet',
    link_reuniao: 'https://meet.google.com/abc-defg-hij',
    entrevistador_id: 'usr_gestor_1',
    status: 'agendada',
    anotacoes: 'Focar na arquitetura de microservices e testes de banco PostgreSQL.',
    sincronizado_gcal: true,
    criado_em: '2026-08-04T16:00:00Z',
  },
  {
    id: 'ent_2',
    empresa_id: 'emp_1',
    candidatura_id: 'cand_app_2',
    vaga_id: 'vaga_2',
    candidato_id: 'cand_2',
    titulo: 'Entrevista Cultural de RH',
    data_hora: '2026-08-08T10:00:00Z',
    duracao_minutos: 45,
    formato: 'Online - Google Meet',
    link_reuniao: 'https://meet.google.com/xyz-uvwx-rst',
    entrevistador_id: 'usr_admin_1',
    status: 'agendada',
    sincronizado_gcal: true,
    criado_em: '2026-08-02T14:10:00Z',
  },
];

const initialClientes: Cliente[] = [
  {
    id: 'cli_1',
    empresa_id: 'emp_2',
    nome: 'Banco Safira Investimentos',
    cnpj_cpf: '33.111.222/0001-88',
    email: 'contato@bancosafira.com.br',
    telefone: '(11) 3000-5000',
    responsavel: 'Fernanda Machado (VP de Gente)',
    status: 'ativo',
    vagas_contratadas: 3,
    taxa_headhunter: '22% do análogo salarial',
    criado_em: '2025-02-10T10:00:00Z',
  },
];

const initialFuncionarios: Funcionario[] = [
  {
    id: 'func_1',
    empresa_id: 'emp_1',
    nome: 'Gabriel Mendes',
    cpf: '123.456.789-00',
    email: 'gabriel.mendes@techcorp.com.br',
    telefone: '(11) 98111-2233',
    cargo_id: 'cargo_1',
    cargo_nome: 'Desenvolvedor Senior',
    departamento_id: 'dep_1',
    departamento_nome: 'Tecnologia & Engenharia',
    data_admissao: '2024-03-01',
    salario: 15500,
    status: 'ativo',
    banco_horas: 12.5,
    saldo_ferias_dias: 20,
    criado_em: '2024-03-01T08:00:00Z',
  },
  {
    id: 'func_2',
    empresa_id: 'emp_1',
    nome: 'Juliana Paes',
    cpf: '987.654.321-11',
    email: 'juliana.paes@techcorp.com.br',
    telefone: '(11) 97222-3344',
    cargo_id: 'cargo_2',
    cargo_nome: 'Analista de RH Pleno',
    departamento_id: 'dep_2',
    departamento_nome: 'Recursos Humanos',
    data_admissao: '2024-08-15',
    salario: 6800,
    status: 'ativo',
    banco_horas: -2.0,
    saldo_ferias_dias: 30,
    criado_em: '2024-08-15T08:00:00Z',
  },
];

const initialDepartamentos: Departamento[] = [
  { id: 'dep_1', empresa_id: 'emp_1', nome: 'Tecnologia & Engenharia', gestor_nome: 'Roberto Santos', qtd_funcionarios: 18 },
  { id: 'dep_2', empresa_id: 'emp_1', nome: 'Recursos Humanos', gestor_nome: 'Carlos Silva', qtd_funcionarios: 6 },
  { id: 'dep_3', empresa_id: 'emp_1', nome: 'Financeiro & Controladoria', gestor_nome: 'Ana Lima', qtd_funcionarios: 8 },
];

const initialCargos: Cargo[] = [
  { id: 'cargo_1', empresa_id: 'emp_1', departamento_id: 'dep_1', titulo: 'Desenvolvedor Senior', nivel: 'Senior', salario_base: 15000 },
  { id: 'cargo_2', empresa_id: 'emp_1', departamento_id: 'dep_2', titulo: 'Analista de RH Pleno', nivel: 'Pleno', salario_base: 6500 },
];

const initialRegistroPontos = [
  {
    id: 'ponto_1',
    empresa_id: 'emp_1',
    funcionario_id: 'func_1',
    tipo: 'Entrada',
    timestamp: '2026-08-06T08:00:00Z',
    localizacao: 'São Paulo - Escritório',
  },
  {
    id: 'ponto_2',
    empresa_id: 'emp_1',
    funcionario_id: 'func_2',
    tipo: 'Entrada',
    timestamp: '2026-08-06T08:15:00Z',
    localizacao: 'Home Office - GPS OK',
  },
];

const initialFerias = [
  {
    id: 'ferias_1',
    empresa_id: 'emp_1',
    funcionario_id: 'func_1',
    data_inicio: '2026-09-01',
    data_fim: '2026-09-15',
    dias: 15,
    status: 'aprovada',
  },
];

const initialLogs: LogAuditoria[] = [
  {
    id: 'log_1',
    empresa_id: 'emp_1',
    usuario_id: 'usr_admin_1',
    usuario_nome: 'Carlos Silva',
    acao: 'LOGIN',
    detalhes: 'Sessão iniciada via Supabase Auth com sucesso.',
    ip: '189.120.45.12',
    resultado: 'SUCESSO',
    criado_em: '2026-08-06T08:30:00Z',
  },
  {
    id: 'log_2',
    empresa_id: 'emp_1',
    usuario_id: 'usr_admin_1',
    usuario_nome: 'Carlos Silva',
    acao: 'EDICAO',
    detalhes: 'Avançou o candidato Lucas Fernandes para etapa "Entrevista Gestor".',
    ip: '189.120.45.12',
    resultado: 'SUCESSO',
    criado_em: '2026-08-04T16:00:00Z',
  },
];

const initialNotificacoes: Notificacao[] = [
  {
    id: 'notif_1',
    empresa_id: 'emp_1',
    usuario_id: 'usr_admin_1',
    titulo: 'Nova candidatura recebida!',
    mensagem: 'Lucas Fernandes aplicou para a vaga "Desenvolvedor Full Stack React & Node.js Senior" com score IA de 94%.',
    lida: false,
    link: '/recrutamento',
    criado_em: '2026-08-06T09:00:00Z',
  },
  {
    id: 'notif_2',
    empresa_id: 'emp_1',
    usuario_id: 'usr_admin_1',
    titulo: 'Entrevista Agendada',
    mensagem: 'Entrevista técnica de Lucas Fernandes agendada para amanhã às 14h.',
    lida: true,
    link: '/agenda',
    criado_em: '2026-08-05T16:30:00Z',
  },
];

const initialPlanos: Plano[] = [
  {
    id: 'starter',
    nome: 'Plano Starter',
    preco_mensal: 490,
    max_vagas: 5,
    max_usuarios: 3,
    modulos_inclusos: ['recrutamento', 'portal_vagas'],
    recursos: ['Até 5 vagas ativas', '3 usuários', 'Portal de vagas customizável', 'Suporte por e-mail'],
  },
  {
    id: 'pro',
    nome: 'Plano Pro AI',
    preco_mensal: 990,
    max_vagas: 20,
    max_usuarios: 10,
    modulos_inclusos: ['recrutamento', 'portal_vagas', 'ia_cv', 'agenda'],
    recursos: ['Até 20 vagas ativas', '10 usuários', 'Leitura e Triagem com IA Gemini', 'Agenda com Google/Outlook', 'Suporte prioritário'],
  },
  {
    id: 'enterprise',
    nome: 'Plano Enterprise RH Full',
    preco_mensal: 2490,
    max_vagas: 999,
    max_usuarios: 999,
    modulos_inclusos: ['recrutamento', 'headhunter', 'portal_vagas', 'ia_cv', 'agenda', 'departamento_pessoal'],
    recursos: ['Vagas ilimitadas', 'Usuários ilimitados', 'Módulo Headhunter & Clientes', 'Departamento Pessoal (Ponto/Férias)', 'Auditoria RLS e Logs completos'],
  },
];

const initialAssinaturas: Assinatura[] = [
  {
    id: 'ass_1',
    empresa_id: 'emp_1',
    plano_id: 'enterprise',
    plano_nome: 'Plano Enterprise RH Full',
    status: 'ativa',
    data_inicio: '2025-01-15',
    data_renovacao: '2026-09-15',
    valor_mensal: 2490,
  },
  {
    id: 'ass_2',
    empresa_id: 'emp_2',
    plano_id: 'pro',
    plano_nome: 'Plano Pro AI',
    status: 'ativa',
    data_inicio: '2025-02-01',
    data_renovacao: '2026-09-01',
    valor_mensal: 990,
  },
];

const initialPagamentos: Pagamento[] = [
  {
    id: 'pag_1',
    empresa_id: 'emp_1',
    valor: 2490,
    status: 'pago',
    metodo: 'Pix',
    data_pagamento: '2026-07-15T10:00:00Z',
    fatura_url: 'https://example.com/fatura_072026.pdf',
  },
];

// --- INITIAL BUILDER & AI DATA ---
const initialOllamaSettings: OllamaSettings = {
  servidor_url: 'http://localhost:11434',
  modelo_padrao: 'llama3:8b',
  modelo_programacao: 'deepseek-coder:6.7b',
  modelo_analise: 'mistral:7b',
  status_conexao: 'online',
  limite_contexto: 8192,
  timeout_ms: 30000,
  modelos_instalados: [
    'llama3:8b',
    'mistral:7b',
    'codellama:13b',
    'deepseek-coder:6.7b',
    'qwen2.5-coder:7b',
  ],
  ia_ativa: true,
  provider_ativo: 'ollama',
  ultimo_teste: new Date().toISOString(),
};

const initialBuilderModules: BuilderModule[] = [
  {
    id: 'mod_treinamentos',
    nome: 'Treinamentos & Capacitação',
    slug: 'treinamentos',
    icone: 'graduation-cap',
    descricao: 'Controle corporativo de cursos, certificações e trilhas de desenvolvimento.',
    empresa_id: 'emp_1',
    status: 'producao',
    versao: '1.2.0',
    criado_em: '2026-08-01T10:00:00Z',
    atualizado_em: '2026-08-05T14:20:00Z',
    paginas: [
      {
        id: 'pag_1',
        nome: 'Catálogo de Cursos',
        slug: 'catalogo',
        type: 'list',
        campos: [
          { id: 'f1', nome: 'titulo', label: 'Título do Curso', type: 'text', required: true, width: 'half' },
          { id: 'f2', nome: 'instrutor', label: 'Instrutor Responsável', type: 'text', required: true, width: 'half' },
          { id: 'f3', nome: 'carga_horaria', label: 'Carga Horária (h)', type: 'number', required: true, width: 'half' },
          { id: 'f4', nome: 'data_inicio', label: 'Data de Início', type: 'date', required: true, width: 'half' },
          { id: 'f5', nome: 'modalidade', label: 'Modalidade', type: 'select', required: true, options: ['Presencial', 'EAD Online', 'Híbrido'], width: 'half' },
          { id: 'f6', nome: 'investimento', label: 'Investimento (R$)', type: 'currency', required: false, width: 'half' },
        ],
        componentes: [],
        permissoes: ['master_admin', 'empresa_admin', 'gestor', 'recrutador'],
      },
      {
        id: 'pag_2',
        nome: 'Inscrição & Avaliação',
        slug: 'inscricao',
        type: 'form',
        campos: [
          { id: 'f7', nome: 'colaborador_nome', label: 'Nome do Colaborador', type: 'text', required: true, width: 'full' },
          { id: 'f8', nome: 'nota_final', label: 'Nota Final (0-10)', type: 'number', required: false, width: 'half' },
          { id: 'f9', nome: 'certificado_emitido', label: 'Certificado Emitido', type: 'boolean', required: false, width: 'half' },
        ],
        componentes: [],
        permissoes: ['master_admin', 'empresa_admin'],
      },
    ],
    automacoes: [
      {
        id: 'aut_1',
        nome: 'Notificar Inscrição Confirmada',
        gatilho: 'registro_criado',
        acao: 'criar_notificacao',
        descricao: 'Avisa o colaborador e gestor quando a matrícula é efetuada.',
        ativo: true,
      },
    ],
  },
];

const initialBuilderVersions: BuilderVersion[] = [
  {
    id: 'ver_1',
    modulo_id: 'mod_treinamentos',
    versao: '1.2.0',
    prompt_original: 'Crie um módulo de treinamentos com lista de cursos, inscrições e automação de notificação.',
    usuario_nome: 'Carlos Silva (Master)',
    data: '2026-08-05T14:20:00Z',
    ambiente: 'producao',
    configuracao: initialBuilderModules[0],
    status: 'aplicada',
    detalhes: 'Módulo homologado e publicado para todas as empresas da plataforma.',
  },
];

const initialAILogs: AILogExecution[] = [
  {
    id: 'log_ai_1',
    prompt: 'Crie um módulo de treinamentos com lista de cursos, inscrições e automação de notificação.',
    usuario_id: 'usr_admin_1',
    usuario_nome: 'Carlos Silva',
    data: '2026-08-05T14:18:00Z',
    modelo: 'llama3:8b (Ollama Local)',
    duracao_ms: 1240,
    status: 'sucesso',
    resposta_json: initialBuilderModules[0],
    ambiente: 'producao',
  },
];

// Data Store Class
class DataService {
  private empresas: Empresa[] = loadFromStorage('empresas', initialEmpresas);
  private usuarios: Usuario[] = loadFromStorage('usuarios', initialUsuarios);
  private vagas: Vaga[] = loadFromStorage('vagas', initialVagas);
  private candidatos: Candidato[] = loadFromStorage('candidatos', initialCandidatos);
  private candidaturas: Candidatura[] = loadFromStorage('candidaturas', initialCandidaturas);
  private entrevistas: Entrevista[] = loadFromStorage('entrevistas', initialEntrevistas);
  private clientes: Cliente[] = loadFromStorage('clientes', initialClientes);
  private funcionarios: Funcionario[] = loadFromStorage('funcionarios', initialFuncionarios);
  private registroPontos: any[] = loadFromStorage('registroPontos', initialRegistroPontos);
  private ferias: any[] = loadFromStorage('ferias', initialFerias);
  private departamentos: Departamento[] = loadFromStorage('departamentos', initialDepartamentos);
  private cargos: Cargo[] = loadFromStorage('cargos', initialCargos);
  private logs: LogAuditoria[] = loadFromStorage('logs', initialLogs);
  private notificacoes: Notificacao[] = loadFromStorage('notificacoes', initialNotificacoes);
  private empresaModulos: EmpresaModulo[] = loadFromStorage('empresaModulos', initialEmpresaModulos);
  private assinaturas: Assinatura[] = loadFromStorage('assinaturas', initialAssinaturas);
  private pagamentos: Pagamento[] = loadFromStorage('pagamentos', initialPagamentos);

  // Master AI Builder Stores
  private ollamaSettings: OllamaSettings = loadFromStorage('ollamaSettings', initialOllamaSettings);
  private builderModules: BuilderModule[] = loadFromStorage('builderModules', initialBuilderModules);
  private builderVersions: BuilderVersion[] = loadFromStorage('builderVersions', initialBuilderVersions);
  private aiLogs: AILogExecution[] = loadFromStorage('aiLogs', initialAILogs);

  // Active Session State
  private currentUserId: string = loadFromStorage('currentUserId', 'usr_admin_1');
  private activeEmpresaId: string = loadFromStorage('activeEmpresaId', 'emp_1');

  private listeners: Set<() => void> = new Set();

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    this.saveAll();
    this.listeners.forEach((fn) => fn());
  }

  private saveAll(): void {
    saveToStorage('empresas', this.empresas);
    saveToStorage('usuarios', this.usuarios);
    saveToStorage('vagas', this.vagas);
    saveToStorage('candidatos', this.candidatos);
    saveToStorage('candidaturas', this.candidaturas);
    saveToStorage('entrevistas', this.entrevistas);
    saveToStorage('clientes', this.clientes);
    saveToStorage('funcionarios', this.funcionarios);
    saveToStorage('registroPontos', this.registroPontos);
    saveToStorage('ferias', this.ferias);
    saveToStorage('departamentos', this.departamentos);
    saveToStorage('cargos', this.cargos);
    saveToStorage('logs', this.logs);
    saveToStorage('notificacoes', this.notificacoes);
    saveToStorage('empresaModulos', this.empresaModulos);
    saveToStorage('assinaturas', this.assinaturas);
    saveToStorage('pagamentos', this.pagamentos);
    saveToStorage('currentUserId', this.currentUserId);
    saveToStorage('activeEmpresaId', this.activeEmpresaId);
  }

  // --- Session & Multi-Tenant Helpers ---
  public getCurrentUser(): Usuario {
    return (
      this.usuarios.find((u) => u.id === this.currentUserId) ||
      this.usuarios[0]
    );
  }

  public setCurrentUser(id: string): void {
    const user = this.usuarios.find((u) => u.id === id);
    if (user) {
      this.currentUserId = user.id;
      this.activeEmpresaId = user.empresa_id;
      this.addLog('LOGIN', `Sessão alterada para ${user.nome} (${user.role})`);
      this.notify();
    }
  }

  public getActiveEmpresa(): Empresa {
    return (
      this.empresas.find((e) => e.id === this.activeEmpresaId) ||
      this.empresas[0]
    );
  }

  public setActiveEmpresa(empresaId: string): void {
    const emp = this.empresas.find((e) => e.id === empresaId);
    if (emp) {
      this.activeEmpresaId = emp.id;
      this.notify();
    }
  }

  // Filter helper enforcing multi-tenancy (RLS simulation for memory state)
  private filterByEmpresa<T extends { empresa_id: string }>(items: T[]): T[] {
    const currentUser = this.getCurrentUser();
    if (currentUser.role === 'master_admin') {
      return items.filter((item) => item.empresa_id === this.activeEmpresaId);
    }
    return items.filter((item) => item.empresa_id === currentUser.empresa_id);
  }

  // --- EMPRESAS ---
  public getEmpresas(): Empresa[] {
    const user = this.getCurrentUser();
    if (user.role === 'master_admin') return [...this.empresas];
    return this.empresas.filter((e) => e.id === user.empresa_id);
  }

  public getEmpresaById(empresaId: string): Empresa | null {
    return this.empresas.find((e) => e.id === empresaId) || null;
  }

  public updateEmpresaPortalConfig(empresaId: string, updates: Partial<Empresa>): void {
    this.empresas = this.empresas.map((e) => (e.id === empresaId ? { ...e, ...updates } : e));
    this.addLog('EDICAO', `Portal de vagas da empresa ${empresaId} atualizado.`);
    this.notify();
  }

  public createEmpresa(data: Omit<Empresa, 'id' | 'criado_em'>): Empresa {
    const newEmp: Empresa = {
      ...data,
      id: 'emp_' + Date.now(),
      criado_em: new Date().toISOString(),
    };
    this.empresas.push(newEmp);

    // Initialize modules for new empresa
    initialModulos.forEach((m) => {
      this.empresaModulos.push({
        id: 'em_' + Date.now() + '_' + m.chave,
        empresa_id: newEmp.id,
        modulo_id: m.id,
        ativo: true,
      });
    });

    this.addLog('CRIACAO', `Empresa ${newEmp.nome} cadastrada pelo Master Admin.`);
    this.notify();
    return newEmp;
  }

  public updateEmpresa(id: string, updates: Partial<Empresa>): void {
    this.empresas = this.empresas.map((e) => (e.id === id ? { ...e, ...updates } : e));
    this.addLog('EDICAO', `Empresa ID ${id} atualizada.`);
    this.notify();
  }

  // --- MODULES PER EMPRESA ---
  public getEmpresaModulos(empresaId?: string): { modulo: Modulo; ativo: boolean }[] {
    const targetEmpresaId = empresaId || this.activeEmpresaId;
    return initialModulos.map((mod) => {
      const em = this.empresaModulos.find(
        (item) => item.empresa_id === targetEmpresaId && item.modulo_id === mod.id
      );
      return {
        modulo: mod,
        ativo: em ? em.ativo : true,
      };
    });
  }

  public toggleEmpresaModulo(empresaId: string, moduloId: string, ativo: boolean): void {
    const index = this.empresaModulos.findIndex(
      (em) => em.empresa_id === empresaId && em.modulo_id === moduloId
    );
    if (index >= 0) {
      this.empresaModulos[index].ativo = ativo;
    } else {
      this.empresaModulos.push({
        id: 'em_' + Date.now(),
        empresa_id: empresaId,
        modulo_id: moduloId,
        ativo,
      });
    }
    this.addLog('PERMISSAO', `Módulo ID ${moduloId} alterado para ${ativo ? 'ativo' : 'inativo'} na empresa ${empresaId}.`);
    this.notify();
  }

  // --- VAGAS (Recrutamento & Headhunter) ---
  public getVagas(moduloOrigem?: 'recrutamento' | 'headhunter'): Vaga[] {
    let list = this.filterByEmpresa(this.vagas);
    if (moduloOrigem) {
      list = list.filter((v) => v.modulo_origem === moduloOrigem || v.modulo_origem === undefined);
    }
    return list;
  }

  public getPublicVagas(): Vaga[] {
    // Public portal displays all published jobs
    return this.vagas.filter((v) => v.publicado && v.status === 'publicada');
  }

  public getPublicVagasByEmpresa(empresaId: string): Vaga[] {
    // PUBLIC PORTAL MULTIEMPRESA RULE: Strictly filter jobs by empresa_id and status = 'publicada'
    return this.vagas.filter(
      (v) => v.empresa_id === empresaId && (v.publicado || v.status === 'publicada') && v.status !== 'encerrada'
    );
  }

  public createVaga(data: Omit<Vaga, 'id' | 'criado_em' | 'empresa_id'>): Vaga {
    const user = this.getCurrentUser();
    const newVaga: Vaga = {
      ...data,
      id: 'vaga_' + Date.now(),
      empresa_id: this.activeEmpresaId,
      criado_em: new Date().toISOString(),
    };
    this.vagas.unshift(newVaga);
    this.addLog('CRIACAO', `Vaga "${newVaga.titulo}" criada no módulo ${newVaga.modulo_origem}.`);
    this.notify();
    return newVaga;
  }

  public updateVaga(id: string, updates: Partial<Vaga>): void {
    this.vagas = this.vagas.map((v) => (v.id === id ? { ...v, ...updates } : v));
    this.addLog('EDICAO', `Vaga ID ${id} atualizada.`);
    this.notify();
  }

  public duplicateVaga(id: string): Vaga | null {
    const original = this.vagas.find((v) => v.id === id);
    if (!original) return null;

    const duplicated: Vaga = {
      ...original,
      id: 'vaga_' + Date.now(),
      titulo: `${original.titulo} (Cópia)`,
      status: 'rascunho',
      criado_em: new Date().toISOString(),
    };

    this.vagas.unshift(duplicated);
    this.addLog('CRIACAO', `Vaga "${original.titulo}" duplicada.`);
    this.notify();
    return duplicated;
  }

  // --- CANDIDATOS & CANDIDATURAS ---
  public getCandidatos(): Candidato[] {
    return this.filterByEmpresa(this.candidatos);
  }

  public createCandidato(data: Omit<Candidato, 'id' | 'criado_em' | 'empresa_id'>): Candidato {
    const newCand: Candidato = {
      ...data,
      id: 'cand_' + Date.now(),
      empresa_id: this.activeEmpresaId,
      criado_em: new Date().toISOString(),
    };
    this.candidatos.unshift(newCand);
    this.notify();
    return newCand;
  }

  public getCandidaturas(): Candidatura[] {
    return this.filterByEmpresa(this.candidaturas);
  }

  public getCandidaturasByVaga(vagaId: string): (Candidatura & { candidato: Candidato })[] {
    const list = this.filterByEmpresa(this.candidaturas).filter((c) => c.vaga_id === vagaId);
    return list.map((candApp) => {
      const candidato = this.candidatos.find((c) => c.id === candApp.candidato_id) || {
        id: 'desconhecido',
        empresa_id: this.activeEmpresaId,
        nome: 'Candidato Não Encontrado',
        email: '',
        telefone: '',
        cidade: '',
        estado: '',
        cargo_desejado: '',
        tags: [],
        habilidades: [],
        criado_em: '',
      };
      return {
        ...candApp,
        candidato,
      };
    });
  }

  public moveCandidaturaEtapa(candidaturaId: string, novaEtapa: Candidatura['etapa_pipeline']): void {
    const candApp = this.candidaturas.find((c) => c.id === candidaturaId);
    if (candApp) {
      candApp.etapa_pipeline = novaEtapa;
      candApp.atualizado_em = new Date().toISOString();
      this.addLog('EDICAO', `Candidatura ID ${candidaturaId} movida para etapa "${novaEtapa}".`);
      this.notify();
    }
  }

  public applyToVagaPublic(
    vagaId: string,
    candidateData: Omit<Candidato, 'id' | 'criado_em' | 'empresa_id'>
  ): { candidato: Candidato; candidatura: Candidatura } {
    const vaga = this.vagas.find((v) => v.id === vagaId);
    const empresaTargetId = vaga ? vaga.empresa_id : this.activeEmpresaId;

    // RULE 8: Check if candidate already exists for this company by email
    let cand = this.candidatos.find(
      (c) =>
        c.email.trim().toLowerCase() === candidateData.email.trim().toLowerCase() &&
        c.empresa_id === empresaTargetId
    );

    if (!cand) {
      cand = {
        ...candidateData,
        id: 'cand_' + Date.now(),
        empresa_id: empresaTargetId,
        origem: 'portal_vagas',
        criado_em: new Date().toISOString(),
      };
      this.candidatos.push(cand);
    } else {
      // Update candidate details with newest info
      cand.nome = candidateData.nome || cand.nome;
      cand.telefone = candidateData.telefone || cand.telefone;
      cand.cidade = candidateData.cidade || cand.cidade;
      cand.estado = candidateData.estado || cand.estado;
      if (candidateData.curriculo_url) cand.curriculo_url = candidateData.curriculo_url;
      if (candidateData.curriculo_texto) cand.curriculo_texto = candidateData.curriculo_texto;
      if (candidateData.linkedin_url) cand.linkedin_url = candidateData.linkedin_url;
      if (candidateData.pretensao_salarial) cand.pretensao_salarial = candidateData.pretensao_salarial;
      if (candidateData.observacoes) cand.observacoes = candidateData.observacoes;
    }

    // RULE 7: Create candidature with empresa_id, vaga_id, candidato_id, origem = 'portal_vagas'
    const candidatura: Candidatura = {
      id: 'cand_app_' + Date.now(),
      empresa_id: empresaTargetId,
      vaga_id: vagaId,
      candidato_id: cand.id,
      etapa_pipeline: 'Inscritos',
      ordem_etapa: 1,
      status: 'em_andamento',
      pontuacao_compatibilidade: cand.score_ia || 80,
      origem: 'portal_vagas',
      data_candidatura: new Date().toISOString(),
      atualizado_em: new Date().toISOString(),
    };

    this.candidaturas.unshift(candidatura);

    // Create notification for company
    this.notificacoes.unshift({
      id: 'notif_' + Date.now(),
      empresa_id: empresaTargetId,
      usuario_id: 'usr_admin_1',
      titulo: 'Nova Inscrição no Portal!',
      mensagem: `${cand.nome} se inscreveu na vaga "${vaga?.titulo || 'Vaga'}".`,
      lida: false,
      link: '/recrutamento',
      criado_em: new Date().toISOString(),
    });

    this.addLog('CRIACAO', `Candidatura de ${cand.nome} recebida no Portal de Vagas.`);
    this.notify();
    return { candidato: cand, candidatura };
  }

  public applyToTalentPoolPublic(
    empresaId: string,
    candidateData: Omit<Candidato, 'id' | 'criado_em' | 'empresa_id'>
  ): { candidato: Candidato; candidatura: Candidatura } {
    const empresaTargetId = empresaId || this.activeEmpresaId;

    // RULE 8: Check if candidate already exists
    let cand = this.candidatos.find(
      (c) =>
        c.email.trim().toLowerCase() === candidateData.email.trim().toLowerCase() &&
        c.empresa_id === empresaTargetId
    );

    if (!cand) {
      cand = {
        ...candidateData,
        id: 'cand_' + Date.now(),
        empresa_id: empresaTargetId,
        origem: 'banco_talentos_portal',
        criado_em: new Date().toISOString(),
      };
      this.candidatos.push(cand);
    } else {
      cand.nome = candidateData.nome || cand.nome;
      cand.telefone = candidateData.telefone || cand.telefone;
      cand.cidade = candidateData.cidade || cand.cidade;
      cand.estado = candidateData.estado || cand.estado;
      if (candidateData.curriculo_url) cand.curriculo_url = candidateData.curriculo_url;
      if (candidateData.curriculo_texto) cand.curriculo_texto = candidateData.curriculo_texto;
      if (candidateData.linkedin_url) cand.linkedin_url = candidateData.linkedin_url;
    }

    // Find first published vaga or create general talent candidature
    const firstVaga = this.vagas.find((v) => v.empresa_id === empresaTargetId);
    const vagaId = firstVaga ? firstVaga.id : 'banco_talentos';

    const candidatura: Candidatura = {
      id: 'cand_app_' + Date.now(),
      empresa_id: empresaTargetId,
      vaga_id: vagaId,
      candidato_id: cand.id,
      etapa_pipeline: 'Inscritos',
      ordem_etapa: 1,
      status: 'em_andamento',
      pontuacao_compatibilidade: 85,
      origem: 'banco_talentos_portal',
      data_candidatura: new Date().toISOString(),
      atualizado_em: new Date().toISOString(),
    };

    this.candidaturas.unshift(candidatura);

    this.notificacoes.unshift({
      id: 'notif_' + Date.now(),
      empresa_id: empresaTargetId,
      usuario_id: 'usr_admin_1',
      titulo: 'Novo Cadastro no Banco de Talentos!',
      mensagem: `${cand.nome} cadastrou seu currículo no Banco de Talentos pelo Portal.`,
      lida: false,
      link: '/recrutamento',
      criado_em: new Date().toISOString(),
    });

    this.addLog('CRIACAO', `Currículo de ${cand.nome} cadastrado no Banco de Talentos via Portal.`);
    this.notify();
    return { candidato: cand, candidatura };
  }

  public updateCandidaturaPareceres(
    id: string,
    parecerRh?: string,
    parecerIa?: string,
    score?: number
  ): void {
    const app = this.candidaturas.find((c) => c.id === id);
    if (app) {
      if (parecerRh !== undefined) app.parecer_rh = parecerRh;
      if (parecerIa !== undefined) app.parecer_ia = parecerIa;
      if (score !== undefined) app.pontuacao_compatibilidade = score;
      app.atualizado_em = new Date().toISOString();
      this.notify();
    }
  }

  // --- ENTREVISTAS & AGENDA ---
  public getEntrevistas(): Entrevista[] {
    return this.filterByEmpresa(this.entrevistas);
  }

  public createEntrevista(data: Omit<Entrevista, 'id' | 'criado_em' | 'empresa_id'>): Entrevista {
    const newEnt: Entrevista = {
      ...data,
      id: 'ent_' + Date.now(),
      empresa_id: this.activeEmpresaId,
      sincronizado_gcal: true,
      criado_em: new Date().toISOString(),
    };
    this.entrevistas.unshift(newEnt);
    this.addLog('CRIACAO', `Entrevista "${newEnt.titulo}" agendada.`);
    this.notify();
    return newEnt;
  }

  // --- CLIENTES (HEADHUNTER) ---
  public getClientes(): Cliente[] {
    return this.filterByEmpresa(this.clientes);
  }

  public createCliente(data: Omit<Cliente, 'id' | 'criado_em' | 'empresa_id'>): Cliente {
    const newCli: Cliente = {
      ...data,
      id: 'cli_' + Date.now(),
      empresa_id: this.activeEmpresaId,
      criado_em: new Date().toISOString(),
    };
    this.clientes.push(newCli);
    this.addLog('CRIACAO', `Cliente Headhunter "${newCli.nome}" cadastrado.`);
    this.notify();
    return newCli;
  }

  // --- DEPARTAMENTO PESSOAL (FUNCIONÁRIOS, PONTO, FÉRIAS) ---
  public getFuncionarios(): Funcionario[] {
    return this.filterByEmpresa(this.funcionarios);
  }

  public createFuncionario(data: Partial<Funcionario> & { nome: string; cpf: string; email: string; salario: number }): Funcionario {
    const newFunc: Funcionario = {
      cargo_id: 'cargo_1',
      cargo_nome: data.cargo || 'Analista',
      departamento_id: 'dep_1',
      departamento_nome: data.departamento || 'Geral',
      telefone: '(11) 99999-9999',
      data_admissao: new Date().toISOString().split('T')[0],
      status: 'ativo',
      ...data,
      id: 'func_' + Date.now(),
      empresa_id: this.activeEmpresaId,
      criado_em: new Date().toISOString(),
    };
    this.funcionarios.push(newFunc);
    this.addLog('CRIACAO', `Funcionário DP "${newFunc.nome}" cadastrado.`);
    this.notify();
    return newFunc;
  }

  public getRegistroPontos(): any[] {
    return this.filterByEmpresa(this.registroPontos);
  }

  public baterPonto(pontoData: { funcionario_id: string; tipo: string; timestamp: string; localizacao: string }): any {
    const newPonto = {
      id: 'ponto_' + Date.now(),
      empresa_id: this.activeEmpresaId,
      ...pontoData,
    };
    this.registroPontos.unshift(newPonto);
    this.addLog('CRIACAO', `Ponto registrado para funcionário ID ${pontoData.funcionario_id}`);
    this.notify();
    return newPonto;
  }

  public getFerias(): any[] {
    return this.filterByEmpresa(this.ferias);
  }

  public getDepartamentos(): Departamento[] {
    return this.filterByEmpresa(this.departamentos);
  }

  public getCargos(): Cargo[] {
    return this.filterByEmpresa(this.cargos);
  }

  // --- LOGS & AUDITORIA ---
  public getLogs(): LogAuditoria[] {
    return this.filterByEmpresa(this.logs);
  }

  public addLog(acao: LogAuditoria['acao'], detalhes: string, ip = '127.0.0.1', resultado: 'SUCESSO' | 'ERRO' = 'SUCESSO'): void {
    const user = this.getCurrentUser();
    this.logs.unshift({
      id: 'log_' + Date.now(),
      empresa_id: this.activeEmpresaId,
      usuario_id: user.id,
      usuario_nome: user.nome,
      acao,
      detalhes,
      ip,
      resultado,
      criado_em: new Date().toISOString(),
    });
  }

  // --- NOTIFICAÇÕES ---
  public getNotificacoes(): Notificacao[] {
    const user = this.getCurrentUser();
    return this.notificacoes.filter(
      (n) => n.empresa_id === this.activeEmpresaId && (!n.usuario_id || n.usuario_id === user.id)
    );
  }

  public markNotificacaoLida(id: string): void {
    const item = this.notificacoes.find((n) => n.id === id);
    if (item) {
      item.lida = true;
      this.notify();
    }
  }

  // --- PLANOS E FINANCEIRO ---
  public getPlanos(): Plano[] {
    return initialPlanos;
  }

  public getAssinaturaAtiva(): Assinatura | undefined {
    return this.assinaturas.find((a) => a.empresa_id === this.activeEmpresaId);
  }

  public getPagamentos(): Pagamento[] {
    return this.filterByEmpresa(this.pagamentos);
  }

  // --- USERS MANAGEMENT ---
  public getUsuarios(): Usuario[] {
    return this.filterByEmpresa(this.usuarios);
  }

  public getAllUsuariosMaster(): Usuario[] {
    return [...this.usuarios];
  }

  public createUsuario(data: Omit<Usuario, 'id' | 'criado_em'>): Usuario {
    const newUsr: Usuario = {
      ...data,
      id: 'usr_' + Date.now(),
      criado_em: new Date().toISOString(),
    };
    this.usuarios.push(newUsr);
    this.addLog('CRIACAO', `Usuário ${newUsr.nome} (${newUsr.email}) criado.`);
    this.notify();
    return newUsr;
  }

  // --- CONSTRUTOR MASTER COM IA METHODS ---

  public getOllamaSettings(): OllamaSettings {
    return { ...this.ollamaSettings };
  }

  public updateOllamaSettings(data: Partial<OllamaSettings>): OllamaSettings {
    this.ollamaSettings = { ...this.ollamaSettings, ...data };
    saveToStorage('ollamaSettings', this.ollamaSettings);
    this.notify();
    return this.ollamaSettings;
  }

  public getBuilderModules(): BuilderModule[] {
    return [...this.builderModules];
  }

  public getBuilderModuleById(id: string): BuilderModule | undefined {
    return this.builderModules.find((m) => m.id === id);
  }

  public saveBuilderModule(mod: BuilderModule): BuilderModule {
    const idx = this.builderModules.findIndex((m) => m.id === mod.id);
    if (idx >= 0) {
      this.builderModules[idx] = { ...mod, atualizado_em: new Date().toISOString() };
    } else {
      this.builderModules.push({ ...mod, criado_em: new Date().toISOString(), atualizado_em: new Date().toISOString() });
    }
    saveToStorage('builderModules', this.builderModules);
    this.notify();
    return mod;
  }

  public deleteBuilderModule(id: string): void {
    this.builderModules = this.builderModules.filter((m) => m.id !== id);
    saveToStorage('builderModules', this.builderModules);
    this.addLog('EXCLUSAO', `Módulo dinâmico ${id} excluído do Construtor.`);
    this.notify();
  }

  public getBuilderVersions(moduleId?: string): BuilderVersion[] {
    if (moduleId) {
      return this.builderVersions.filter((v) => v.modulo_id === moduleId);
    }
    return [...this.builderVersions];
  }

  public saveBuilderVersion(
    mod: BuilderModule,
    promptOriginal: string,
    ambiente: 'rascunho' | 'homologacao' | 'producao'
  ): BuilderVersion {
    const user = this.getCurrentUser();
    const nextVer = `1.${this.builderVersions.length + 1}.0`;

    const version: BuilderVersion = {
      id: 'ver_' + Date.now(),
      modulo_id: mod.id,
      versao: nextVer,
      prompt_original: promptOriginal,
      usuario_nome: `${user.nome} (${user.role})`,
      data: new Date().toISOString(),
      ambiente,
      configuracao: JSON.parse(JSON.stringify(mod)),
      status: 'aplicada',
      detalhes: `Ação no ambiente [${ambiente.toUpperCase()}]: ${promptOriginal.slice(0, 60)}`,
    };

    // Update module status and version
    mod.versao = nextVer;
    mod.status = ambiente;
    this.saveBuilderModule(mod);

    this.builderVersions.unshift(version);
    saveToStorage('builderVersions', this.builderVersions);
    this.addLog('CRIACAO', `Nova versão de módulo ${mod.nome} v${nextVer} registrada no ambiente ${ambiente}.`);
    this.notify();
    return version;
  }

  public restoreBuilderVersion(versionId: string): BuilderModule | undefined {
    const ver = this.builderVersions.find((v) => v.id === versionId);
    if (!ver) return undefined;

    const modConfig = JSON.parse(JSON.stringify(ver.configuracao)) as BuilderModule;
    modConfig.atualizado_em = new Date().toISOString();
    this.saveBuilderModule(modConfig);

    // Update status of version items
    ver.status = 'restaurada';
    saveToStorage('builderVersions', this.builderVersions);

    this.addLog('EDICAO', `Restaurada versão ${ver.versao} do módulo ${modConfig.nome}.`);
    this.notify();
    return modConfig;
  }

  public getAILogs(): AILogExecution[] {
    return [...this.aiLogs];
  }

  public addAILog(
    log: Omit<AILogExecution, 'id' | 'data' | 'usuario_id' | 'usuario_nome'>
  ): AILogExecution {
    const user = this.getCurrentUser();
    const newLog: AILogExecution = {
      ...log,
      id: 'log_ai_' + Date.now(),
      data: new Date().toISOString(),
      usuario_id: user.id,
      usuario_nome: user.nome,
    };
    this.aiLogs.unshift(newLog);
    saveToStorage('aiLogs', this.aiLogs);
    this.notify();
    return newLog;
  }

  // Applies AI response safely into a draft/homologated/published module
  public applyAIResponseToModule(
    res: StructuredAIResponse,
    prompt: string,
    ambiente: 'rascunho' | 'homologacao' | 'producao'
  ): BuilderModule {
    const existing = this.builderModules.find(
      (m) =>
        (res.module && m.slug === res.module.slug) ||
        m.nome.toLowerCase() === (res.module?.name || '').toLowerCase()
    );

    let mod: BuilderModule;

    if (existing) {
      mod = { ...existing };
    } else {
      mod = {
        id: 'mod_' + Date.now(),
        nome: res.module?.name || 'Módulo Customizado IA',
        slug: res.module?.slug || 'modulo_' + Date.now().toString(36),
        descricao: res.module?.description || 'Gerado via Construtor Master IA',
        icone: res.module?.icon || 'sparkles',
        empresa_id: this.activeEmpresaId,
        status: ambiente,
        versao: '1.0.0',
        criado_em: new Date().toISOString(),
        atualizado_em: new Date().toISOString(),
        paginas: [],
        automacoes: [],
      };
    }

    // Process Pages
    if (res.pages && res.pages.length > 0) {
      res.pages.forEach((p, idx) => {
        const pageSlug = p.name.toLowerCase().replace(/[^a-z0-9]/g, '_');
        let pageObj = mod.paginas.find((pag) => pag.slug === pageSlug);
        if (!pageObj) {
          pageObj = {
            id: 'pag_' + Date.now() + '_' + idx,
            nome: p.name,
            slug: pageSlug,
            type: p.type || 'list',
            campos: [],
            componentes: [],
            permissoes: res.permissions || ['master_admin', 'empresa_admin'],
          };
          mod.paginas.push(pageObj);
        }
      });
    }

    // Process Fields
    if (res.fields && res.fields.length > 0) {
      if (mod.paginas.length === 0) {
        mod.paginas.push({
          id: 'pag_' + Date.now(),
          nome: 'Página Principal',
          slug: 'principal',
          type: 'form',
          campos: [],
          componentes: [],
          permissoes: ['master_admin', 'empresa_admin'],
        });
      }
      const targetPage = mod.paginas[0];
      res.fields.forEach((f, fIdx) => {
        const fieldName = f.name.toLowerCase().replace(/[^a-z0-9]/g, '_');
        const exists = targetPage.campos.some((c) => c.nome === fieldName);
        if (!exists) {
          targetPage.campos.push({
            id: 'f_' + Date.now() + '_' + fIdx,
            nome: fieldName,
            label: f.label || f.name.replace(/_/g, ' ').toUpperCase(),
            type: f.type || 'text',
            required: f.required ?? true,
            width: 'half',
            options: f.options,
          });
        }
      });
    }

    // Process Automations
    if (res.automations && res.automations.length > 0) {
      res.automations.forEach((a, aIdx) => {
        mod.automacoes.push({
          id: 'aut_' + Date.now() + '_' + aIdx,
          nome: a.name,
          gatilho: a.trigger,
          acao: a.action,
          descricao: a.description,
          ativo: true,
        });
      });
    }

    this.saveBuilderModule(mod);
    this.saveBuilderVersion(mod, prompt, ambiente);
    return mod;
  }

  // Generates safe system context JSON for the LLM prompt
  public getSystemContextForAI(): any {
    return {
      empresa_ativa: {
        id: this.activeEmpresaId,
        nome: this.getActiveEmpresa().nome,
      },
      modulos_existentes: this.builderModules.map((m) => ({
        id: m.id,
        nome: m.nome,
        slug: m.slug,
        status: m.status,
        paginas: m.paginas.map((p) => ({
          nome: p.nome,
          tipo: p.type,
          qtd_campos: p.campos.length,
        })),
        automacoes: m.automacoes.map((a) => a.nome),
      })),
      perfis_permissoes: [
        'master_admin',
        'empresa_admin',
        'recrutador',
        'gestor',
        'headhunter',
        'candidato',
      ],
      tabelas_permitidas: [
        'empresas',
        'vagas',
        'candidatos',
        'candidaturas',
        'entrevistas',
        'funcionarios',
        'departamentos',
        'cargos',
        'builder_modules',
      ],
      componentes_disponiveis: [
        'DynamicTable',
        'DynamicForm',
        'DynamicDashboard',
        'DynamicReport',
        'DynamicWorkflow',
        'DynamicField',
        'DynamicAutomation',
      ],
      gatilhos_automação: [
        'registro_criado',
        'registro_atualizado',
        'status_alterado',
        'etapa_alterada',
        'prazo_vencido',
        'documento_vencendo',
      ],
      acoes_automação: [
        'criar_notificacao',
        'enviar_email',
        'atualizar_status',
        'criar_tarefa',
        'atribuir_responsavel',
      ],
      isolamento_multiempresa: 'Ativo (RLS por empresa_id)',
    };
  }
}

export const dataService = new DataService();
