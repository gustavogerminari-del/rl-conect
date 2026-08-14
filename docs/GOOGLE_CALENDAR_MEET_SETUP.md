# RL Connect — Google Calendar + Google Meet

## Regra de segurança obrigatória

Google OAuth **não é login do RL Connect**. A conexão Google só pode ser iniciada depois que o usuário estiver autenticado normalmente no RL Connect e tiver perfil ativo na tabela `usuarios`.

Não adicionar ao login público botões como “Entrar com Google” ou “Continuar com Google”. Uma conta Google não cria usuário, empresa, assinatura, plano, módulo nem permissão no RL Connect.

## 1. Banco de dados

Execute no Supabase SQL Editor:

`supabase/google_calendar_integration.sql`

As tabelas de tokens ficam com RLS habilitado e sem acesso direto para `anon`/`authenticated`. O acesso é somente pelo backend com `SUPABASE_SERVICE_ROLE_KEY`.

## 2. Google Cloud

No mesmo projeto Google Cloud usado pela empresa responsável pela integração:

1. Ative a **Google Calendar API**.
2. Configure a tela de consentimento OAuth.
3. Crie um OAuth Client do tipo **Web application**.
4. Cadastre como Authorized redirect URI exatamente o valor de `GOOGLE_REDIRECT_URI`.
5. Use somente os escopos necessários: `openid`, `email` e `https://www.googleapis.com/auth/calendar.events`.

## 3. Secrets do servidor

Configure sem expor no frontend:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_REDIRECT_URI`
- `GOOGLE_TOKEN_ENCRYPTION_KEY`
- `GOOGLE_OAUTH_STATE_SECRET`
- `APP_URL`

O frontend continua usando somente `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`.

## 4. Fluxo correto

Pagamento/contratação → empresa e usuário autorizados → login normal do RL Connect → validação de empresa/plano/permissões → Configurações → Integrações → Google Calendar → **Conectar Google Calendar**.

O backend valida o Bearer token do Supabase Auth antes de gerar a URL OAuth. O callback valida `state` assinado, nonce, expiração, empresa e usuário que iniciaram a autorização.

## 5. Entrevistas

Ao escolher `Online - Google Meet`:

- exige integração Google conectada;
- cria evento real no Google Calendar;
- solicita conferência Google Meet com `conferenceDataVersion=1`;
- envia convites aos e-mails válidos do candidato e entrevistador;
- usa um ID determinístico por empresa/entrevista para evitar duplicação;
- remarca o mesmo evento;
- cancela/remove o evento e envia atualizações aos convidados.

Entrevistas presenciais e por telefone continuam funcionando sem Google.

## 6. Tokens

Access token e refresh token nunca são enviados ao frontend. São criptografados no backend com AES-256-GCM antes de serem persistidos.

O access token é renovado automaticamente usando o refresh token. Se a autorização for revogada ou ficar inválida, a empresa precisa reconectar o Google Calendar.

## 7. Teste mínimo antes de produção

1. Login normal no RL Connect.
2. Abrir Configurações → Integrações.
3. Conectar Google Calendar com um administrador da empresa.
4. Confirmar conta Google conectada.
5. Criar entrevista Google Meet.
6. Confirmar evento no Calendar e link Meet real.
7. Remarcar e confirmar alteração do mesmo evento.
8. Cancelar e confirmar remoção/cancelamento no Calendar.
9. Repetir com uma segunda empresa e confirmar isolamento.
10. Confirmar que usuário sem perfil admin não consegue conectar/desconectar a conta Google.
11. Confirmar que uma pessoa com Google válido, mas sem login RL Connect, recebe `401` e não inicia OAuth.
