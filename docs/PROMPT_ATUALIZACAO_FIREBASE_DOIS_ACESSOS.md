# RL Connect — Prompt Oficial de Atualização Firebase / Dois Acessos

## Objetivo

Aplicar e preservar o RL Connect como uma plataforma **Firebase-only**, usando Firebase Authentication, Cloud Firestore e Firebase Storage como fonte de verdade, mantendo os módulos Recrutamento, Headhunter e Departamento Pessoal integrados sem duplicar entidades ou criar tabelas paralelas desnecessárias.

Esta especificação é obrigatória para qualquer atualização futura do sistema.

## Regra máxima — ZERO DUPLICIDADE

Nenhuma ação repetida, duplo clique, retry de rede ou segunda sessão pode criar uma segunda entidade de negócio quando a identidade lógica for a mesma.

Identidades obrigatórias:

- Empresa: CNPJ normalizado.
- Vínculo Empresa ↔ Módulo: `empresaId + moduloId`.
- Usuário: e-mail normalizado no Firebase Authentication; perfil Firestore em `usuarios/{uid}`.
- Cliente Headhunter: `empresaId + CNPJ/CPF normalizado`.
- Candidato: `empresaId + e-mail normalizado`.
- Candidatura: `empresaId + vagaId + candidatoId`.
- Banco de Talentos: `empresaId + candidatoId`.
- Entrevista: mesma candidatura + mesma data/hora deve reutilizar o registro existente; integração Google usa o mesmo `interviewId` para o mesmo evento.
- Solicitação de admissão: `empresaId + candidaturaId`.
- Funcionário: dentro da empresa, não duplicar CPF ou e-mail.
- Cobrança Headhunter: `empresaId + candidaturaId`.
- Módulo criado pelo Construtor Master: identidade estável por empresa + slug/nome lógico.

Logs, notificações, históricos e batidas de ponto são eventos e podem possuir múltiplos registros quando representarem ocorrências diferentes.

---

# FLUXO 1 — ACESSO RECRUTAMENTO + DP

1. Criar/reutilizar Empresa pelo CNPJ.
2. Criar o acesso do usuário obrigatoriamente no Firebase Authentication e gravar o perfil em `usuarios/{uid}` com `empresa_id`, aliases de tenant e `role`.
3. Criar vaga na coleção compartilhada `vagas` com `modulo_origem: "recrutamento"`.
4. Repetição da mesma criação de vaga ativa, para mesma empresa/origem/cliente/título, deve reutilizar a vaga em vez de criar outra.
5. Criar/reutilizar candidato por empresa + e-mail.
6. Criar/reutilizar candidatura por empresa + vaga + candidato.
7. Triagem IA deve analisar o currículo do candidato selecionado e atualizar a **candidatura real** com score/parecer. É proibido criar candidato artificial para representar uma análise.
8. Entrevista deve estar vinculada à candidatura real. Repetição de candidatura + data/hora não cria uma segunda entrevista.
9. Google Meet nunca pode ser inventado. `sincronizado_gcal=true` somente após confirmação real do Google Calendar e recebimento do evento/link correspondente.
10. Ao mover a candidatura para `Contratado`, vaga de Recrutamento deve ir exclusivamente para `ADMISSION`.
11. Criar uma única solicitação em `solicitacoes_admissao` para a candidatura.
12. Conclusão da admissão exige CPF válido e salário maior que zero.
13. Criar/reutilizar funcionário no DP por empresa + CPF/e-mail.
14. Nunca encaminhar contratação de Recrutamento ao Financeiro Headhunter.

Fluxo esperado:

`Empresa → Usuário/Auth → Vaga Recrutamento → Candidato → Candidatura → Triagem → Entrevista → Contratado → ADMISSION → Funcionário/DP`

---

# FLUXO 2 — ACESSO HEADHUNTER

1. Criar/reutilizar Empresa pelo CNPJ.
2. Criar usuário Headhunter no Firebase Authentication + `usuarios/{uid}` com `role: "headhunter"`.
3. Criar/reutilizar Cliente Headhunter por documento dentro da empresa.
4. Headhunter e Recrutamento devem usar a **mesma coleção `vagas`**. Não criar uma tabela/coleção duplicada de vagas.
5. Vaga criada pelo módulo Headhunter deve obrigatoriamente possuir `modulo_origem: "headhunter"`, `cliente_id` e regra de honorário.
6. Criar/reutilizar candidato por empresa + e-mail.
7. Criar/reutilizar candidatura por empresa + vaga + candidato.
8. Triagem IA deve atualizar a candidatura/candidato reais, sem gerar candidato artificial.
9. Entrevista segue a mesma regra idempotente do fluxo de Recrutamento.
10. Ao mover para `Contratado`, origem Headhunter deve ir exclusivamente para `FINANCEIRO_HEADHUNTER`.
11. Criar uma única cobrança em `financeiro_cobrancas` para a candidatura.
12. Fee deve ser válido e maior que zero. Aceitar percentual, valor fixo ou multiplicador salarial de acordo com a regra existente.
13. Percentual/multiplicador exige salário base válido > 0.
14. Fee zero ou regra inválida deve ser rejeitado/ficar pendente de dados comerciais; nunca gerar cobrança zerada como válida.
15. Nunca encaminhar contratação Headhunter para ADMISSION automaticamente.

Fluxo esperado:

`Empresa → Usuário/Auth Headhunter → Cliente → Vaga Headhunter → Candidato → Candidatura → Triagem → Entrevista → Contratado → FINANCEIRO_HEADHUNTER → Cobrança`

---

# PORTAL PÚBLICO E BANCO DE TALENTOS

- O navegador não deve possuir escrita anônima livre em candidatos/candidaturas do Firestore.
- Candidaturas públicas devem passar pelo backend Firebase Admin.
- Validar empresa, vaga publicada, consentimento LGPD, arquivo e limites antes da escrita.
- Candidato público: ID determinístico por empresa + e-mail.
- Candidatura pública: ID determinístico por empresa + vaga + candidato.
- Banco de Talentos: ID determinístico por empresa + candidato.
- Reenvio deve retornar/reutilizar o registro existente.
- Currículo deve ser persistido no Firebase Storage; URL local/blob nunca pode ser tratada como arquivo persistido.

---

# GOOGLE CALENDAR / MEET

- Rotas protegidas devem validar Firebase ID Token.
- Credenciais OAuth/refresh tokens não podem ficar expostas no frontend.
- Tokens Google devem ser guardados de forma segura pelo backend e inacessíveis pelas regras do cliente Firestore.
- Mesmo `interviewId` deve mapear para o mesmo evento Google para garantir idempotência.
- Nenhum link `meet.google.com/...` pode ser hardcoded, fictício ou seed de produção.
- Sem credencial Google ativa, a entrevista pode existir no Firestore, porém deve permanecer sem link de Meet e sem afirmar sincronização.

---

# PAINEL MASTER / CONSTRUTOR

- Mostrar Firebase Auth/Firestore na interface; não mostrar Supabase como infraestrutura atual.
- Usar identidade real da sessão Firebase, nunca UID/e-mail fictício hardcoded.
- Módulos criados pelo Construtor, versões, logs IA e configurações devem persistir no Firestore nas coleções mapeadas.
- É proibido voltar a usar `localStorage` como fonte de verdade de negócio.

---

# COLEÇÕES FIREBASE PRINCIPAIS

Manter compatibilidade com as coleções usadas pela recuperação Firebase, incluindo:

- `empresas`
- `usuarios`
- `vagas`
- `candidatos`
- `candidaturas`
- `entrevistas`
- `clientes`
- `funcionarios`
- `solicitacoes_admissao`
- `financeiro_cobrancas`
- `empresaModulos`
- `pagamentos`
- `assinaturas`
- `notificacoes`
- `logs`
- coleções do Construtor Master/IA já mapeadas no `firebaseStateBridge`

Todos os documentos tenant-aware devem carregar a identidade da empresa conforme a camada de compatibilidade do projeto (`empresa_id`, `empresaId`, `companyId` quando aplicável).

---

# GATE OBRIGATÓRIO DE QA

Nenhuma alteração que afete esses fluxos pode ser considerada pronta sem passar:

1. `npm run lint` / TypeScript sem erros.
2. `npm run build` sem erro.
3. `scripts/qa-two-access-flows.ts` integralmente verde.
4. `scripts/qa-no-duplicate-business-entities.ts` integralmente verde.
5. Nenhuma referência runtime `@supabase` ou `VITE_SUPABASE`.
6. Nenhum link de Meet fictício/hardcoded.
7. Fluxo Recrutamento contratado → `ADMISSION`.
8. Fluxo Headhunter contratado → `FINANCEIRO_HEADHUNTER`.
9. Fee zero rejeitado.
10. Teste de repetição/idempotência para as entidades críticas.

---

# RESULTADO DA RODADA DE QA DE 14/08/2026

Validações automatizadas aprovadas na branch `agent/firebase-v49-recovery`:

- 19 verificações do contrato dos dois acessos: APROVADAS.
- 13 regras globais anti-duplicidade: APROVADAS após endurecimento do vínculo Empresa ↔ Módulo.
- TypeScript: APROVADO.
- Build: APROVADO.
- Runtime Supabase: NÃO PERMITIDO / varredura aprovada.
- Meet fictício: NÃO PERMITIDO / varredura aprovada.
- Portal público e Banco de Talentos: IDs determinísticos + transação Firebase Admin verificados.
- Painel Master migrado visualmente para Firebase e Construtor persistido em Firestore.

Commit de referência após a correção global de duplicidade: `a50d0728284c04f97d4bd97973b318b220b5e9f5`.

## Observação de produção

Os testes acima comprovam **contrato de código, regras de negócio, TypeScript e build**. A ativação real de serviços externos ainda exige que o ambiente de implantação possua as credenciais válidas (`FIREBASE_SERVICE_ACCOUNT_JSON`, credenciais Google OAuth e chaves de segurança correspondentes). Um teste de criação real de usuário no Firebase Auth e um evento real Google Calendar/Meet só pode ser declarado aprovado quando executado em um ambiente implantado com essas credenciais.

Não fazer merge na `main` automaticamente. A branch de recuperação deve permanecer isolada até aprovação explícita para merge/publicação.
