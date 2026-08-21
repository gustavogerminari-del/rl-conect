# Migração RH-MIL: retirada segura do n8n

## Regra de segurança

O n8n não deve ser desligado de uma vez. Cada workflow será substituído por um handler interno, validado e observado antes do corte. A branch `main` permanece intocada durante a migração.

Backup congelado antes da migração:

- branch: `backup/pre-n8n-removal-2026-08-21`
- commit: `47e99a0c63b89d2d6e588d95b8f684f2159acf2e`

Branch de trabalho:

- `codex/remove-n8n-rh-mil`

## Fase 1 — Event Router interno

Status: iniciada.

Implementado:

- `POST /api/workflows/events`;
- autenticação server-to-server por `WORKFLOW_INTERNAL_TOKEN`;
- `eventId` obrigatório;
- persistência do evento em `workflow_events` antes do efeito;
- idempotência por criação condicional do documento `eventId`;
- retry imediato com backoff exponencial;
- estados `processing`, `completed`, `failed` e `pending_handler`;
- duração, tentativas, resultado e último erro registrados;
- eventos sem handler ficam preservados como `pending_handler` em vez de serem descartados;
- handlers iniciais:
  - `subscription.status.update`;
  - `notification.create`;
  - `audit.log.write`;
  - `system.healthcheck`.

## Fase 2 — Persistência e provisionamento

Status: parcialmente implementada.

Implementado:

- `POST /api/users/create` server-side;
- validação da sessão Firebase do chamador e exigência de perfil MASTER;
- criação real no Firebase Authentication;
- compatibilidade controlada para conta Auth já existente;
- atualização do `displayName` no Authentication;
- persistência canônica em `usuarios` e espelho em `users`;
- permissões e módulos preservados no perfil;
- validação de `empresaId` diretamente na coleção `empresas`;
- `companyName` derivado no servidor, sem confiar no valor enviado pelo navegador;
- rollback de perfis e de conta Auth recém-criada se a persistência falhar.

Ainda pendente nesta fase:

- mover demais mutações administrativas para handlers internos;
- atualização transacional de assinatura e permissões;
- auditoria unificada dos efeitos administrativos;
- eliminar o fallback de criação pelo navegador somente depois de validar o backend no ambiente publicado.

## Fase 3 — Agenda, Meet e e-mail

Migrar para integrações server-side:

- Google Calendar;
- criação de Google Meet;
- convite de entrevistadores e candidatos;
- envio de e-mail;
- idempotência por `eventId` e identificador externo;
- retry apenas para falhas transitórias.

## Fase 4 — Cobrança

Migrar o gateway de cobrança para endpoint próprio:

- validar assinatura do webhook do gateway;
- registrar pagamento;
- atualizar assinatura;
- liberar/bloquear módulos de forma idempotente;
- registrar auditoria;
- impedir processamento duplicado do mesmo evento do gateway.

## Fase 5 — Retry durável e monitoramento

Adicionar processamento de eventos `failed` com `nextAttemptAt`, limite de tentativas e dead-letter state. Criar visão operacional para falhas e alertas.

## Corte final

O n8n só poderá ser desligado quando:

1. todos os tipos de evento usados em produção tiverem handler interno;
2. não houver eventos `pending_handler` dos fluxos em produção;
3. os testes de regressão passarem;
4. o período de execução paralela não apresentar divergência;
5. existir rollback documentado para a branch de backup.
