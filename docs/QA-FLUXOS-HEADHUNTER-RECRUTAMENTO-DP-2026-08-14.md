# RL Connect — Organograma QA dos 2 fluxos oficiais

Data: 14/08/2026
Branch validada: `agent/google-calendar-meet`
Base protegida: `main` sem merge durante o QA

## Regra global obrigatória — sem duplicidade

O sistema deve trabalhar com um único registro lógico por entidade. Reprocessamento, duplo clique, reenvio de formulário ou repetição de evento não pode criar cópia indevida.

Identidades oficiais:

- Empresa: CNPJ normalizado.
- Cliente Headhunter: CNPJ/CPF normalizado dentro da empresa.
- Candidato: e-mail normalizado dentro da empresa.
- Candidatura: `empresa_id + vaga_id + candidato_id`.
- Admissão: uma pendência ativa por candidatura.
- Funcionário: CPF ou e-mail dentro da empresa.
- Cobrança Headhunter: uma por candidatura/contratação.
- Entrevista local: mesma candidatura + mesma data/hora não cria segunda entrevista.
- Google Calendar: ID determinístico por `empresa + interviewId`; reenvio recupera o mesmo evento em caso de conflito.

---

# FLUXO 1 — HEADHUNTER

## 1. Login e isolamento do perfil — ✅ APROVADO

`LOGIN RL CONNECT`
→ identifica usuário Headhunter
→ carrega empresa correta
→ libera Headhunter, IA, Agenda e Portal
→ oculta DP, ATS interno e Master

Não existe login Google para acessar o RL Connect. Google é somente integração Calendar/Meet após a sessão normal.

## 2. Cliente Headhunter — ✅ APROVADO

`HEADHUNTER`
→ selecionar/cadastrar cliente
→ validar documento
→ validar fee/honorário
→ reutilizar cliente existente quando o mesmo documento já estiver cadastrado

Fee aceito: percentual, fixo em reais ou multiplicador salarial, desde que resulte em valor maior que zero.

## 3. Vaga Headhunter — ✅ APROVADO

`CLIENTE`
→ `VAGA`
→ `modulo_origem = headhunter`
→ vínculo com cliente
→ regra comercial/fee

A vaga usa a mesma entidade `Vaga` do sistema. Não existe uma cópia paralela só para o Headhunter.

## 4. Candidato e candidatura — ✅ APROVADO

`PORTAL / CADASTRO`
→ procurar candidato por e-mail + empresa
→ criar somente se não existir
→ procurar candidatura por candidato + vaga + empresa
→ criar somente se não existir
→ candidatura entra no pipeline

Teste executado duas vezes com os mesmos dados: o segundo envio reutilizou candidato e candidatura.

## 5. Triagem IA — ⚠️ FLUXO APROVADO / PROVEDOR EXTERNO DEPENDE DE SECRET

`CANDIDATURA`
→ IA/Triagem
→ parecer/score
→ RH/Headhunter decide próxima etapa

A indisponibilidade da IA não pode apagar candidato, candidatura ou travar o processo. O teste de produção do provedor externo depende da chave real do ambiente.

## 6. Entrevista — ✅ LÓGICA APROVADA / ⚠️ GOOGLE REAL DEPENDE DE CREDENCIAIS

`CANDIDATO APROVADO`
→ agendar entrevista
→ presencial/telefone OU Google Calendar + Meet
→ convidados únicos
→ remarcação atualiza o mesmo evento
→ cancelamento remove/cancela o mesmo evento

Sem credencial Google conectada, o sistema não inventa link Meet.

## 7. Contratação — ✅ APROVADO

`ETAPA = CONTRATADO`
→ lê `modulo_origem = headhunter`
→ `destination = FINANCEIRO_HEADHUNTER`

Reprocessar `Contratado` não cria segunda cobrança.

## 8. Financeiro Headhunter — ✅ APROVADO

`FINANCEIRO_HEADHUNTER`
→ calcular fee
→ se valor > 0: `AGUARDANDO_COBRANCA`
→ se dados comerciais incompletos: `PENDENTE_DADOS_COMERCIAIS`
→ preservar contratação para correção

Testes de cálculo:

- R$ 6.000 × 35% = R$ 2.100.
- R$ 1.750 fixo = R$ 1.750.
- 0% = rejeitado corretamente.

---

# FLUXO 2 — RECRUTAMENTO INTERNO + DP

## 1. Login Empresa/RH — ✅ APROVADO

`LOGIN RL CONNECT`
→ identifica empresa e perfil
→ libera ATS, IA, Agenda, DP e demais módulos permitidos
→ oculta Master para perfil não Master

## 2. Vaga de Recrutamento — ✅ APROVADO

`RECRUTAMENTO`
→ criar/usar vaga única
→ `modulo_origem = recrutamento`
→ publicar no portal quando aplicável

A mesma vaga não é copiada para o DP. O DP recebe somente a admissão após contratação.

## 3. Candidato e candidatura — ✅ APROVADO

`PORTAL / RH`
→ candidato único por e-mail + empresa
→ candidatura única por vaga + candidato + empresa
→ pipeline único

## 4. Triagem — ⚠️ FLUXO APROVADO / PROVEDOR EXTERNO DEPENDE DE SECRET

`INSCRITOS`
→ `TRIAGEM IA/RH`
→ próximas etapas
→ entrevista
→ decisão

## 5. Entrevista — ✅ LÓGICA APROVADA / ⚠️ GOOGLE REAL DEPENDE DE CREDENCIAIS

Mesma regra do Headhunter: nenhum Meet falso e nenhum evento duplicado.

## 6. Contratação — ✅ APROVADO

`ETAPA = CONTRATADO`
→ lê `modulo_origem = recrutamento`
→ `destination = ADMISSION`
→ cria uma única admissão pendente

Reprocessar `Contratado` não cria segunda admissão.

## 7. Departamento Pessoal — ✅ APROVADO

`ADMISSION`
→ `PENDENTE_DOCUMENTOS`
→ validar CPF
→ validar salário > 0
→ concluir admissão
→ criar/reutilizar funcionário por CPF/e-mail
→ marcar admissão `CONCLUIDA`

Repetir criação com o mesmo CPF/e-mail não cria segundo funcionário.

---

# QA técnico final — ✅ SUCCESS

Workflow: `Validate RL Connect`

Validações executadas na rodada final de código:

1. Instalação de dependências — PASSOU.
2. TypeScript (`tsc --noEmit`) — PASSOU.
3. E2E business flows — PASSOU.
4. Build — PASSOU.
5. Chromium/Playwright — PASSOU.
6. Acesso Empresa sem Master — PASSOU.
7. Acesso Headhunter sem DP/ATS interno/Master — PASSOU.
8. Acesso Master com módulos Master — PASSOU.
9. Portal público sem tela branca — PASSOU.
10. Testes anti-duplicidade em candidatura, admissão, funcionário, cobrança e cliente — PASSOU.

Run de referência do código limpo: `31806703068`.
SHA validado antes deste documento: `7b84125aba1e330b56cb71dde22a99f1b84ff4ab`.

## Pendências externas antes de declarar produção 100%

- Configurar Supabase real/produção e aplicar migrations necessárias.
- Configurar `GOOGLE_CLIENT_ID` e `GOOGLE_CLIENT_SECRET`.
- Configurar `GOOGLE_TOKEN_ENCRYPTION_KEY` e `GOOGLE_OAUTH_STATE_SECRET`.
- Confirmar `APP_URL`/redirect URI de produção.
- Fazer um evento real Google Calendar + Meet com conta autorizada.
- Validar o provedor de IA com secret real do ambiente.

Essas pendências não autorizam criar dados fictícios, links falsos ou contornar autenticação.