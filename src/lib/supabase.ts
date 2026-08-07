import { createClient, SupabaseClient } from '@supabase/supabase-js';

function isValidUrl(url: string): boolean {
  if (!url || typeof url !== 'string') return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

const supabaseUrl = (import.meta as any).env?.VITE_SUPABASE_URL || '';
const supabaseAnonKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || '';

export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
  supabaseAnonKey &&
  isValidUrl(supabaseUrl)
);

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

/**
 * Generates full PostgreSQL Schema SQL with Row Level Security (RLS) policies
 * ready for execution in the Supabase SQL Editor.
 */
export function generateSupabaseSQLSchema(): string {
  return `-- ====================================================================
-- RL CONNECT 2.0 - RECONSTRUÇÃO COMPLETA SUPABASE & POSTGRESQL SCHEMA
-- Sistema ATS & Departamento Pessoal SaaS Multiempresa
-- ====================================================================

-- 1. Habilitar extensões
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Tabela de Empresas
CREATE TABLE IF NOT EXISTS public.empresas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nome VARCHAR(255) NOT NULL,
    cnpj VARCHAR(20) UNIQUE NOT NULL,
    logo_url TEXT,
    plano_id VARCHAR(50) DEFAULT 'pro',
    status VARCHAR(20) DEFAULT 'ativa' CHECK (status IN ('ativa', 'suspensa', 'cancelada')),
    endereco TEXT,
    cidade VARCHAR(100),
    estado VARCHAR(50),
    criado_em TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Tabela de Perfis de Acesso
CREATE TABLE IF NOT EXISTS public.perfis (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nome VARCHAR(100) NOT NULL,
    descricao TEXT,
    permissoes JSONB DEFAULT '[]'::jsonb
);

-- 4. Tabela de Usuários (Vinculado a Supabase Auth)
CREATE TABLE IF NOT EXISTS public.usuarios (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    nome VARCHAR(255) NOT NULL,
    avatar_url TEXT,
    perfil_id UUID REFERENCES public.perfis(id),
    role VARCHAR(50) NOT NULL CHECK (role IN ('master_admin', 'empresa_admin', 'recrutador', 'gestor', 'headhunter', 'candidato')),
    status VARCHAR(20) DEFAULT 'ativo',
    ultimo_login TIMESTAMPTZ,
    criado_em TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Tabela de Módulos Globais
CREATE TABLE IF NOT EXISTS public.modulos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nome VARCHAR(100) NOT NULL,
    chave VARCHAR(50) UNIQUE NOT NULL,
    descricao TEXT,
    icone VARCHAR(50)
);

-- 6. Tabela de Módulos da Empresa
CREATE TABLE IF NOT EXISTS public.empresa_modulos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
    modulo_id UUID NOT NULL REFERENCES public.modulos(id) ON DELETE CASCADE,
    ativo BOOLEAN DEFAULT TRUE,
    configuracao JSONB DEFAULT '{}'::jsonb,
    UNIQUE(empresa_id, modulo_id)
);

-- 7. Tabela de Clientes (Para Módulo Headhunter)
CREATE TABLE IF NOT EXISTS public.clientes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
    nome VARCHAR(255) NOT NULL,
    cnpj_cpf VARCHAR(20) NOT NULL,
    email VARCHAR(255),
    telefone VARCHAR(50),
    responsavel VARCHAR(255),
    status VARCHAR(20) DEFAULT 'ativo',
    vagas_contratadas INT DEFAULT 0,
    taxa_headhunter VARCHAR(50),
    criado_em TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Tabela de Vagas (Compatível com Recrutamento e Headhunter)
CREATE TABLE IF NOT EXISTS public.vagas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
    titulo VARCHAR(255) NOT NULL,
    descricao TEXT NOT NULL,
    departamento VARCHAR(100),
    cargo VARCHAR(100),
    tipo_contratacao VARCHAR(50) DEFAULT 'CLT',
    modelo_trabalho VARCHAR(50) DEFAULT 'Hibrido',
    cidade VARCHAR(100),
    estado VARCHAR(50),
    salario_min NUMERIC(12,2),
    salario_max NUMERIC(12,2),
    exibir_salario BOOLEAN DEFAULT TRUE,
    status VARCHAR(50) DEFAULT 'publicada' CHECK (status IN ('rascunho', 'publicada', 'em_andamento', 'pausada', 'encerrada')),
    requisitos TEXT[],
    diferenciais TEXT[],
    beneficios TEXT[],
    publicado BOOLEAN DEFAULT TRUE,
    modulo_origem VARCHAR(50) DEFAULT 'recrutamento' CHECK (modulo_origem IN ('recrutamento', 'headhunter')),
    cliente_id UUID REFERENCES public.clientes(id) ON DELETE SET NULL,
    honorario_headhunter VARCHAR(100),
    vagas_qtd INT DEFAULT 1,
    criado_por UUID,
    criado_em TIMESTAMPTZ DEFAULT NOW()
);

-- 9. Tabela de Candidatos (Banco de Talentos)
CREATE TABLE IF NOT EXISTS public.candidatos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
    nome VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    telefone VARCHAR(50),
    cidade VARCHAR(100),
    estado VARCHAR(50),
    cargo_desejado VARCHAR(255),
    curriculo_url TEXT,
    curriculo_texto TEXT,
    resumo_ia TEXT,
    score_ia INT DEFAULT 0,
    tags TEXT[],
    habilidades TEXT[],
    experiencias JSONB DEFAULT '[]'::jsonb,
    formacao JSONB DEFAULT '[]'::jsonb,
    criado_em TIMESTAMPTZ DEFAULT NOW()
);

-- 10. Tabela de Candidaturas (Pipeline ATS)
CREATE TABLE IF NOT EXISTS public.candidaturas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
    vaga_id UUID NOT NULL REFERENCES public.vagas(id) ON DELETE CASCADE,
    candidato_id UUID NOT NULL REFERENCES public.candidatos(id) ON DELETE CASCADE,
    etapa_pipeline VARCHAR(100) DEFAULT 'Inscritos',
    ordem_etapa INT DEFAULT 1,
    status VARCHAR(50) DEFAULT 'em_andamento',
    pontuacao_compatibilidade INT DEFAULT 0,
    parecer_rh TEXT,
    parecer_ia TEXT,
    resumo_match_ia TEXT,
    pontos_fortes_ia TEXT[],
    pontos_atencao_ia TEXT[],
    perguntas_sugeridas_ia TEXT[],
    data_candidatura TIMESTAMPTZ DEFAULT NOW(),
    atualizado_em TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(vaga_id, candidato_id)
);

-- 11. Tabela de Entrevistas
CREATE TABLE IF NOT EXISTS public.entrevistas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
    candidatura_id UUID NOT NULL REFERENCES public.candidaturas(id) ON DELETE CASCADE,
    vaga_id UUID NOT NULL REFERENCES public.vagas(id) ON DELETE CASCADE,
    candidato_id UUID NOT NULL REFERENCES public.candidatos(id) ON DELETE CASCADE,
    titulo VARCHAR(255) NOT NULL,
    data_hora TIMESTAMPTZ NOT NULL,
    duracao_minutos INT DEFAULT 45,
    formato VARCHAR(100) DEFAULT 'Online - Google Meet',
    link_reuniao TEXT,
    entrevistador_id UUID,
    status VARCHAR(50) DEFAULT 'agendada',
    anotacoes TEXT,
    sincronizado_gcal BOOLEAN DEFAULT FALSE,
    sincronizado_outlook BOOLEAN DEFAULT FALSE,
    criado_em TIMESTAMPTZ DEFAULT NOW()
);

-- 12. Tabela de Avaliações RH & Gestor
CREATE TABLE IF NOT EXISTS public.avaliacoes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
    candidatura_id UUID NOT NULL REFERENCES public.candidaturas(id) ON DELETE CASCADE,
    avaliador_id UUID NOT NULL,
    nota INT CHECK (nota BETWEEN 1 AND 5),
    comentarios TEXT,
    pontos_fortes TEXT,
    pontos_melhoria TEXT,
    recomendacao VARCHAR(100),
    criado_em TIMESTAMPTZ DEFAULT NOW()
);

-- 13. Tabela de Departamentos
CREATE TABLE IF NOT EXISTS public.departamentos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
    nome VARCHAR(100) NOT NULL,
    gestor_id UUID
);

-- 14. Tabela de Cargos
CREATE TABLE IF NOT EXISTS public.cargos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
    departamento_id UUID REFERENCES public.departamentos(id) ON DELETE CASCADE,
    titulo VARCHAR(100) NOT NULL,
    nivel VARCHAR(50) DEFAULT 'Pleno',
    salario_base NUMERIC(12,2)
);

-- 15. Tabela de Funcionários (Departamento Pessoal)
CREATE TABLE IF NOT EXISTS public.funcionarios (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
    nome VARCHAR(255) NOT NULL,
    cpf VARCHAR(20) NOT NULL,
    email VARCHAR(255),
    telefone VARCHAR(50),
    cargo_id UUID REFERENCES public.cargos(id),
    departamento_id UUID REFERENCES public.departamentos(id),
    data_admissao DATE NOT NULL,
    salario NUMERIC(12,2) NOT NULL,
    status VARCHAR(50) DEFAULT 'ativo',
    documento_url TEXT,
    banco_horas NUMERIC(8,2) DEFAULT 0,
    saldo_ferias_dias INT DEFAULT 30,
    criado_em TIMESTAMPTZ DEFAULT NOW()
);

-- 16. Tabela de Logs de Auditoria
CREATE TABLE IF NOT EXISTS public.logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    empresa_id UUID REFERENCES public.empresas(id) ON DELETE CASCADE,
    usuario_id UUID,
    usuario_nome VARCHAR(255),
    acao VARCHAR(50) NOT NULL,
    detalhes TEXT,
    ip VARCHAR(50),
    resultado VARCHAR(20) DEFAULT 'SUCESSO',
    criado_em TIMESTAMPTZ DEFAULT NOW()
);

-- 17. Tabela de Notificações
CREATE TABLE IF NOT EXISTS public.notificacoes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
    usuario_id UUID NOT NULL,
    titulo VARCHAR(255) NOT NULL,
    mensagem TEXT NOT NULL,
    lida BOOLEAN DEFAULT FALSE,
    link TEXT,
    criado_em TIMESTAMPTZ DEFAULT NOW()
);

-- 18. Tabela de Planos e Assinaturas
CREATE TABLE IF NOT EXISTS public.planos (
    id VARCHAR(50) PRIMARY KEY,
    nome VARCHAR(100) NOT NULL,
    preco_mensal NUMERIC(10,2) NOT NULL,
    max_vagas INT DEFAULT 10,
    max_usuarios INT DEFAULT 5,
    modulos_inclusos TEXT[],
    recursos TEXT[]
);

CREATE TABLE IF NOT EXISTS public.assinaturas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
    plano_id VARCHAR(50) REFERENCES public.planos(id),
    status VARCHAR(50) DEFAULT 'ativa',
    data_inicio DATE NOT NULL,
    data_renovacao DATE NOT NULL,
    valor_mensal NUMERIC(10,2) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.pagamentos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
    valor NUMERIC(10,2) NOT NULL,
    status VARCHAR(50) DEFAULT 'pago',
    metodo VARCHAR(50) DEFAULT 'Pix',
    data_pagamento TIMESTAMPTZ DEFAULT NOW(),
    fatura_url TEXT
);

-- ====================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- Multi-tenant isolation: cada empresa visualiza exclusivamente seus dados
-- ====================================================================

-- Função para capturar empresa_id do usuário logado no Supabase Auth JWT
CREATE OR REPLACE FUNCTION public.get_user_empresa_id()
RETURNS UUID AS $$
  SELECT (auth.jwt() -> 'app_metadata' ->> 'empresa_id')::UUID;
$$ LANGUAGE SQL STABLE;

-- Habilitar RLS em todas as tabelas principais
ALTER TABLE public.empresas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vagas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidatos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidaturas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.entrevistas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.avaliacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.funcionarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notificacoes ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS para VAGAS
CREATE POLICY vagas_empresa_isolation ON public.vagas
    FOR ALL
    USING (empresa_id = public.get_user_empresa_id() OR auth.jwt() ->> 'role' = 'master_admin');

-- Política de RLS para CANDIDATOS
CREATE POLICY candidatos_empresa_isolation ON public.candidatos
    FOR ALL
    USING (empresa_id = public.get_user_empresa_id() OR auth.jwt() ->> 'role' = 'master_admin');

-- Política de RLS para CANDIDATURAS
CREATE POLICY candidaturas_empresa_isolation ON public.candidaturas
    FOR ALL
    USING (empresa_id = public.get_user_empresa_id() OR auth.jwt() ->> 'role' = 'master_admin');

-- Política de RLS para FUNCIONÁRIOS (Departamento Pessoal)
CREATE POLICY funcionarios_empresa_isolation ON public.funcionarios
    FOR ALL
    USING (empresa_id = public.get_user_empresa_id() OR auth.jwt() ->> 'role' = 'master_admin');

-- Política de RLS para CLIENTES (Headhunter)
CREATE POLICY clientes_empresa_isolation ON public.clientes
    FOR ALL
    USING (empresa_id = public.get_user_empresa_id() OR auth.jwt() ->> 'role' = 'master_admin');

-- Vagas públicas visíveis no Portal de Vagas
CREATE POLICY vagas_public_portal ON public.vagas
    FOR SELECT
    USING (publicado = true AND status = 'publicada');
`;
}
