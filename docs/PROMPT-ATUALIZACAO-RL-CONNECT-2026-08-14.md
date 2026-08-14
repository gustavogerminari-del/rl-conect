# Prompt oficial de atualização — RL Connect

Copie e cole este prompt em qualquer agente/Work usado para atualizar o sistema. Ele deve ser tratado como regra funcional obrigatória.

---

ATUALIZE O RL CONNECT PRESERVANDO O VISUAL ATUAL E SEM CRIAR MÓDULOS, TELAS, REGISTROS OU FLUXOS DUPLICADOS.

OBJETIVO PRINCIPAL:
Deixar funcionando de ponta a ponta dois fluxos oficiais, compartilhando as mesmas entidades centrais do sistema:

1. HEADHUNTER:
Login RL Connect → empresa correta → cliente Headhunter → vaga com `modulo_origem = headhunter` → candidato único → candidatura única → triagem → entrevista → contratado → `FINANCEIRO_HEADHUNTER` → cobrança única.

2. RECRUTAMENTO INTERNO + DP:
Login RL Connect → empresa correta → vaga com `modulo_origem = recrutamento` → candidato único → candidatura única → triagem → entrevista → contratado → `ADMISSION` → DP → colaborador único.

REGRA ABSOLUTA DE NÃO DUPLICIDADE:
- Empresa: identificar por CNPJ normalizado.
- Cliente Headhunter: identificar por CNPJ/CPF normalizado dentro da empresa.
- Candidato: identificar por e-mail normalizado dentro da empresa.
- Candidatura: uma por `empresa_id + vaga_id + candidato_id`.
- Admissão: uma pendência ativa por candidatura.
- Funcionário: identificar por CPF ou e-mail dentro da empresa.
- Cobrança Headhunter: uma por candidatura/contratação.
- Entrevista: não duplicar a mesma candidatura no mesmo horário.
- Google Calendar: usar um único evento por entrevista. Reenvio, duplo clique ou retry deve recuperar/atualizar o evento existente, nunca criar outro.
- Reprocessar a etapa `Contratado` nunca pode gerar segunda admissão ou segunda cobrança.
- Não criar uma tabela/base paralela de vagas para Headhunter. Recrutamento e Headhunter usam a mesma entidade Vaga e são separados por `modulo_origem`.

CONTROLE DE ACESSO:
- Não adicionar botão “Entrar com Google” no login do RL Connect.
- Google OAuth serve somente para Google Calendar/Google Meet depois do login normal no RL Connect.
- Perfil Headhunter não pode ver DP, ATS interno, Painel Master nem Construtor Master.
- Perfil Empresa/RH não pode ver Painel Master nem Construtor Master.
- Perfil Master pode acessar os módulos Master.
- Nunca permitir troca de perfil por botão de simulação/bypass no cabeçalho ou menu.
- Toda ação deve respeitar empresa/tenant do usuário autenticado.

HEADHUNTER:
- Cliente deve vir da base real da empresa, não ser digitado como texto solto quando já existir cadastro.
- Ao cadastrar cliente com documento já existente, reutilizar/atualizar o registro em vez de duplicar.
- Vaga Headhunter deve manter cliente real e regra de fee.
- Aceitar fee percentual, fixo em reais ou multiplicador salarial apenas quando resultar em valor maior que zero.
- Exemplo obrigatório: salário R$ 6.000 e fee 35% = R$ 2.100.
- Exemplo obrigatório: `R$ 1.750 fixo` = R$ 1.750, nunca R$ 1,75.
- Fee 0% deve ser rejeitado com mensagem amigável e sem perder a contratação.
- Quando faltarem salário/fee/dados comerciais, manter `PENDENTE_DADOS_COMERCIAIS` e orientar o usuário a corrigir.
- Só usar `AGUARDANDO_COBRANCA` quando houver valor de cobrança válido e maior que zero.
- Destino do contratado Headhunter deve ser exclusivamente `FINANCEIRO_HEADHUNTER`.

RECRUTAMENTO + DP:
- Destino do contratado de recrutamento interno deve ser exclusivamente `ADMISSION`.
- Criar uma única admissão com status inicial `PENDENTE_DOCUMENTOS`.
- Antes de concluir admissão, validar CPF e salário maior que zero com mensagens claras.
- Formatos monetários brasileiros devem ser interpretados corretamente.
- Se colaborador já existir por CPF/e-mail na mesma empresa, reutilizar o registro e concluir a admissão sem criar outro colaborador.
- Nenhum item do DP deve aparecer no acesso Headhunter.

CANDIDATO/PORTAL:
- Reenvio do mesmo candidato com mesmo e-mail para a mesma empresa deve atualizar/reutilizar o candidato.
- A mesma pessoa não pode ter duas candidaturas iguais na mesma vaga.
- O portal público deve abrir sem tela branca.
- Não marcar inscrição como sucesso antes de concluir o salvamento real necessário.

TRIAGEM/IA:
- IA pode auxiliar score e parecer, mas falha do provedor externo não pode apagar candidato/candidatura nem quebrar o fluxo.
- Não inventar resposta “real” quando a chave externa não estiver configurada.
- Exibir estado claro de integração/configuração.

GOOGLE CALENDAR + GOOGLE MEET:
- Usar OAuth 2.0 real somente após sessão RL Connect autenticada.
- Guardar tokens somente no backend, criptografados.
- Usar refresh token e renovação segura.
- Validar OAuth state, expiração, nonce, empresa e usuário.
- Apenas perfis autorizados podem conectar/desconectar a conta Google da empresa.
- Criar evento com convidados reais e `conferenceDataVersion=1` para Meet.
- Cada entrevista deve possuir ID determinístico/estável de evento para impedir duplicidade.
- Se a API retornar conflito por evento já existente, recuperar o mesmo evento.
- Remarcação deve atualizar o mesmo evento.
- Cancelamento deve remover/cancelar o mesmo evento.
- Nunca gerar link Meet fictício.
- Se Google não estiver conectado, mostrar mensagem clara e permitir seguir com formato Presencial/Telefone quando aplicável.

TELA BRANCA/QUALIDADE:
- Nenhum clique de menu pode renderizar página vazia.
- Manter ErrorBoundary/proteção global para falhas inesperadas.
- Corrigir exceções JavaScript; não esconder erro apenas com try/catch sem tratar causa.
- Dados antigos/incompletos do armazenamento não podem derrubar uma tela inteira.
- Indicadores visuais de Supabase/Google/IA devem mostrar o estado real, nunca “OK” falso.

PERSISTÊNCIA:
- Em produção, usar autenticação e persistência reais do backend/Supabase configurado.
- Não afirmar que localStorage é banco de produção.
- Aplicar RLS/multiempresa no backend e garantir que toda entidade grave `empresa_id` corretamente.
- Secrets jamais podem ficar no frontend ou no repositório.

TESTES OBRIGATÓRIOS ANTES DE PUBLICAR:
1. `tsc --noEmit` sem erros.
2. Build de produção sem erros.
3. E2E Recrutamento → Contratado → ADMISSION → DP → Funcionário.
4. Repetir `Contratado` e comprovar que não cria segunda admissão.
5. Repetir funcionário com mesmo CPF/e-mail e comprovar que não duplica.
6. E2E Headhunter → Contratado → FINANCEIRO_HEADHUNTER → cobrança.
7. Repetir `Contratado` e comprovar que não cria segunda cobrança.
8. Aplicar duas vezes o mesmo candidato na mesma vaga e comprovar que candidato/candidatura não duplicam.
9. Cadastrar o mesmo cliente por CNPJ duas vezes e comprovar que não duplica.
10. Testar fee 35%, fee fixo brasileiro e fee 0%.
11. Playwright/Chromium em todas as telas principais, sem página branca e sem `pageerror`.
12. Testar acesso Empresa, Headhunter e Master separadamente.
13. Com credenciais reais disponíveis, criar um evento Google Calendar + Meet real, remarcar e cancelar, sempre no mesmo eventId.

REGRAS DE ENTREGA:
- Trabalhar em branch separada; não alterar `main` até todos os testes passarem.
- Não remover funcionalidade existente sem motivo validado.
- Não duplicar módulos que já resolvem a mesma função.
- Sempre preferir corrigir e reutilizar a entidade existente.
- Registrar no PR o que foi corrigido, causa, impacto, testes e pendências externas.
- Só considerar produção 100% quando autenticação/persistência real e integrações externas tiverem sido testadas de verdade.

REFERÊNCIA DO QA:
Consultar `docs/QA-FLUXOS-HEADHUNTER-RECRUTAMENTO-DP-2026-08-14.md` antes de modificar qualquer regra dos dois fluxos.

---

FIM DO PROMPT OFICIAL.