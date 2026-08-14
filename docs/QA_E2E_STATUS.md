# RL Connect — QA E2E

Última validação automatizada da branch `agent/google-calendar-meet`.

## Fluxos de negócio

- Recrutamento interno → candidato contratado → `ADMISSION` → admissão pendente → colaborador criado no DP.
- Headhunter → candidato contratado → `FINANCEIRO_HEADHUNTER` → cobrança criada somente com fee válido e positivo.
- Fee percentual: R$ 6.000 × 35% = R$ 2.100.
- Fee fixo brasileiro: R$ 1.750 = R$ 1.750,00.
- Fee 0% é rejeitado como inválido.
- Isolamento do teste Headhunter usa `usr_head_2` / `emp_2` e não os dados da empresa de recrutamento.

## Acessos e telas

Playwright/Chromium valida:

- Acesso Empresa Admin: módulos operacionais abrem; Painel Master e Construtor Master ficam ocultos.
- Acesso Headhunter: Headhunter, IA, Agenda e Portal abrem; DP, Recrutamento interno e Master ficam ocultos.
- Acesso Master: Painel Master e Construtor Master ficam disponíveis.
- Portal público `/vagas/emp_1` abre sem tela branca.
- Todas as telas testadas são verificadas contra erros JavaScript e contra o ErrorBoundary.

## Proteção contra tela branca

A aplicação usa `AppErrorBoundary`. Erros inesperados de renderização passam a exibir uma tela de recuperação, com opção de recarregar e limpar apenas dados locais `rl_connect_v2_*`, em vez de deixar a página totalmente branca.

## Google Calendar / Meet

- OAuth Google é exclusivo para Calendar/Meet e não cria login no RL Connect.
- API exige sessão normal do RL Connect antes da conexão Google.
- Tokens ficam criptografados no backend.
- Eventos usam ID determinístico para evitar duplicação, suportam Meet, convidados, alteração e cancelamento.
- O sistema não exibe mais links Meet fictícios ou status de sincronização falso.

## Validações no CI

O workflow `Validate RL Connect` executa:

1. TypeScript (`npm run lint`)
2. Dois fluxos de negócio (`npm run test:flows`)
3. Build de produção (`npm run build`)
4. Chromium / Playwright (`npm run test:ui`)

## Pendências antes de produção

- Configurar Supabase real e autenticação/persistência real do ambiente de venda; o fallback local não deve ser tratado como produção.
- Executar `supabase/google_calendar_integration.sql` no Supabase do ambiente.
- Configurar os secrets Google/Supabase descritos em `.env.example`.
- Fazer um teste real com uma conta Google autorizada para comprovar criação de evento e Meet na API real.
- A branch permanece separada da `main` até aprovação explícita.
