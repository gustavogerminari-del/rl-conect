-- RL CONNECT - Google Calendar / Meet
-- OAuth Google serve SOMENTE para Calendar/Meet. Não cria login, usuário, empresa ou assinatura.

CREATE TABLE IF NOT EXISTS public.google_calendar_integrations (
    empresa_id UUID PRIMARY KEY REFERENCES public.empresas(id) ON DELETE CASCADE,
    google_account_email TEXT,
    calendar_id TEXT NOT NULL DEFAULT 'primary',
    access_token_enc TEXT NOT NULL,
    refresh_token_enc TEXT,
    expires_at TIMESTAMPTZ,
    scopes TEXT[] DEFAULT ARRAY[]::TEXT[],
    status TEXT NOT NULL DEFAULT 'connected' CHECK (status IN ('connected', 'revoked', 'error')),
    connected_by UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE RESTRICT,
    connected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.google_oauth_states (
    nonce TEXT PRIMARY KEY,
    empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
    usuario_id UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.google_calendar_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.google_oauth_states ENABLE ROW LEVEL SECURITY;

-- Sem policies para authenticated/anon de propósito.
-- Apenas o backend com SUPABASE_SERVICE_ROLE_KEY acessa tokens e states.
REVOKE ALL ON TABLE public.google_calendar_integrations FROM anon, authenticated;
REVOKE ALL ON TABLE public.google_oauth_states FROM anon, authenticated;

-- Campos de sincronização real da entrevista.
ALTER TABLE public.entrevistas
    ADD COLUMN IF NOT EXISTS google_calendar_event_id TEXT,
    ADD COLUMN IF NOT EXISTS google_calendar_id TEXT,
    ADD COLUMN IF NOT EXISTS google_meet_url TEXT,
    ADD COLUMN IF NOT EXISTS google_event_html_link TEXT,
    ADD COLUMN IF NOT EXISTS integration_status TEXT DEFAULT 'not_synced',
    ADD COLUMN IF NOT EXISTS integration_error TEXT,
    ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'America/Sao_Paulo',
    ADD COLUMN IF NOT EXISTS inicio_em TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS fim_em TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS atualizado_em TIMESTAMPTZ DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_entrevistas_google_event
    ON public.entrevistas (empresa_id, google_calendar_event_id)
    WHERE google_calendar_event_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_google_oauth_states_expires
    ON public.google_oauth_states (expires_at);

-- Limpeza opcional de states expirados (pode ser chamada por cron).
DELETE FROM public.google_oauth_states
WHERE expires_at < NOW() - INTERVAL '1 hour';
