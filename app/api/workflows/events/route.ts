import {
  createWorkflowEventDocument,
  getWorkflowGoogleAccessToken,
  patchFirestoreDocument,
  workflowServiceAccountFromEnvironment,
} from '../_core/firestoreAdminRest';
import {
  executeWithRetry,
  validateWorkflowEvent,
  workflowRetryOptionsFromEnvironment,
  type WorkflowEvent,
} from '../_core/workflowEngine';

const JSON_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
};

function requireInternalToken(request: Request) {
  const expected = String(process.env.WORKFLOW_INTERNAL_TOKEN || '').trim();
  if (!expected) {
    throw new Error('WORKFLOW_INTERNAL_TOKEN não configurado no servidor.');
  }

  const headerToken = String(request.headers.get('x-rh-mil-workflow-token') || '').trim();
  const bearerToken = String(request.headers.get('authorization') || '')
    .replace(/^Bearer\s+/i, '')
    .trim();
  const provided = headerToken || bearerToken;

  if (!provided || provided !== expected) {
    const error = new Error('Token interno do workflow inválido.');
    (error as any).status = 401;
    throw error;
  }
}

function requiredString(payload: Record<string, unknown>, key: string) {
  const value = String(payload[key] || '').trim();
  if (!value) throw new Error(`payload.${key} é obrigatório.`);
  return value;
}

async function dispatchEvent(args: {
  event: WorkflowEvent;
  projectId: string;
  accessToken: string;
}) {
  const { event, projectId, accessToken } = args;

  if (event.type === 'system.healthcheck') {
    return { handled: true as const, result: { status: 'ok' } };
  }

  if (event.type === 'subscription.status.update') {
    const subscriptionId = String(event.payload.subscriptionId || event.payload.assinaturaId || '').trim();
    if (!subscriptionId) throw new Error('payload.subscriptionId é obrigatório.');

    const status = requiredString(event.payload, 'status').toLowerCase();
    const allowedStatuses = new Set(['ativa', 'inadimplente', 'cancelada', 'degustacao']);
    if (!allowedStatuses.has(status)) {
      throw new Error('Status de assinatura inválido.');
    }

    await patchFirestoreDocument({
      projectId,
      accessToken,
      collection: 'assinaturas',
      documentId: subscriptionId,
      data: {
        status,
        atualizado_em: new Date().toISOString(),
        workflow_event_id: event.eventId,
      },
    });

    return { handled: true as const, result: { subscriptionId, status } };
  }

  if (event.type === 'notification.create') {
    const notificationId = String(event.payload.notificationId || event.payload.id || event.eventId).trim();
    const empresaId = String(event.payload.empresa_id || event.payload.empresaId || event.tenantId || '').trim();
    const usuarioId = String(event.payload.usuario_id || event.payload.usuarioId || '').trim();
    const titulo = requiredString(event.payload, 'titulo');
    const mensagem = requiredString(event.payload, 'mensagem');

    if (!empresaId) throw new Error('tenantId ou payload.empresa_id é obrigatório.');
    if (!usuarioId) throw new Error('payload.usuario_id é obrigatório.');

    await patchFirestoreDocument({
      projectId,
      accessToken,
      collection: 'notificacoes',
      documentId: notificationId,
      data: {
        empresa_id: empresaId,
        usuario_id: usuarioId,
        titulo,
        mensagem,
        lida: Boolean(event.payload.lida),
        link: event.payload.link == null ? null : String(event.payload.link),
        criado_em: String(event.payload.criado_em || new Date().toISOString()),
        workflow_event_id: event.eventId,
      },
    });

    return { handled: true as const, result: { notificationId } };
  }

  if (event.type === 'audit.log.write') {
    const auditId = String(event.payload.auditId || event.payload.id || event.eventId).trim();
    const empresaId = String(event.payload.empresa_id || event.payload.empresaId || event.tenantId || '').trim();
    if (!empresaId) throw new Error('tenantId ou payload.empresa_id é obrigatório.');

    await patchFirestoreDocument({
      projectId,
      accessToken,
      collection: 'logs_auditoria',
      documentId: auditId,
      data: {
        ...event.payload,
        empresa_id: empresaId,
        criado_em: String(event.payload.criado_em || new Date().toISOString()),
        workflow_event_id: event.eventId,
      },
    });

    return { handled: true as const, result: { auditId } };
  }

  // Migração segura: eventos ainda não convertidos do n8n ficam persistidos
  // para implementação progressiva, sem serem descartados nem executarem efeitos parciais.
  return {
    handled: false as const,
    result: { reason: 'handler_not_migrated', type: event.type },
  };
}

export async function POST(request: Request) {
  const startedAt = Date.now();

  try {
    requireInternalToken(request);
    const event = validateWorkflowEvent(await request.json().catch(() => null));
    const serviceAccount = workflowServiceAccountFromEnvironment();
    const accessToken = await getWorkflowGoogleAccessToken(serviceAccount);
    const now = new Date().toISOString();

    const eventRecord = await createWorkflowEventDocument({
      projectId: serviceAccount.project_id,
      accessToken,
      eventId: event.eventId,
      data: {
        eventId: event.eventId,
        type: event.type,
        tenantId: event.tenantId || null,
        occurredAt: event.occurredAt || now,
        receivedAt: now,
        payload: event.payload,
        status: 'processing',
        attempts: 0,
        source: 'rh-mil-internal-router',
      },
    });

    if (!eventRecord.created) {
      return Response.json({
        success: true,
        duplicate: true,
        eventId: event.eventId,
      }, { status: 200, headers: JSON_HEADERS });
    }

    const retryOptions = workflowRetryOptionsFromEnvironment();

    try {
      const execution = await executeWithRetry(
        () => dispatchEvent({
          event,
          projectId: serviceAccount.project_id,
          accessToken,
        }),
        retryOptions
      );

      const finalStatus = execution.value.handled ? 'completed' : 'pending_handler';
      await patchFirestoreDocument({
        projectId: serviceAccount.project_id,
        accessToken,
        collection: 'workflow_events',
        documentId: event.eventId,
        data: {
          status: finalStatus,
          attempts: execution.attempts,
          processedAt: new Date().toISOString(),
          durationMs: Date.now() - startedAt,
          result: execution.value.result,
          lastError: null,
        },
      });

      return Response.json({
        success: true,
        duplicate: false,
        eventId: event.eventId,
        status: finalStatus,
        attempts: execution.attempts,
        result: execution.value.result,
      }, { status: execution.value.handled ? 200 : 202, headers: JSON_HEADERS });
    } catch (error: any) {
      const message = String(error?.message || 'Falha ao processar workflow.');
      await patchFirestoreDocument({
        projectId: serviceAccount.project_id,
        accessToken,
        collection: 'workflow_events',
        documentId: event.eventId,
        data: {
          status: 'failed',
          attempts: retryOptions.maxAttempts,
          failedAt: new Date().toISOString(),
          durationMs: Date.now() - startedAt,
          lastError: message.slice(0, 1000),
        },
      }).catch(() => undefined);

      return Response.json({
        success: false,
        eventId: event.eventId,
        status: 'failed',
        error: message,
      }, { status: 500, headers: JSON_HEADERS });
    }
  } catch (error: any) {
    const message = String(error?.message || 'Evento de workflow inválido.');
    const status = Number(error?.status || (/WORKFLOW_INTERNAL_TOKEN não configurado/i.test(message) ? 503 : 400));
    return Response.json({ success: false, error: message }, { status, headers: JSON_HEADERS });
  }
}
