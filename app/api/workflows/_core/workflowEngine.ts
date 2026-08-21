export type WorkflowEvent = {
  eventId: string;
  type: string;
  tenantId?: string;
  occurredAt?: string;
  payload: Record<string, unknown>;
};

export type RetryResult<T> = {
  value: T;
  attempts: number;
};

export type RetryOptions = {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
};

const EVENT_ID_PATTERN = /^[A-Za-z0-9._:-]{8,200}$/;
const EVENT_TYPE_PATTERN = /^[a-z0-9]+(?:[._-][a-z0-9]+)*$/;

export function validateWorkflowEvent(input: unknown): WorkflowEvent {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('Evento inválido: o corpo deve ser um objeto JSON.');
  }

  const body = input as Record<string, unknown>;
  const eventId = String(body.eventId || '').trim();
  const type = String(body.type || '').trim().toLowerCase();
  const tenantId = body.tenantId == null ? undefined : String(body.tenantId).trim();
  const occurredAt = body.occurredAt == null ? undefined : String(body.occurredAt).trim();
  const payload = body.payload;

  if (!EVENT_ID_PATTERN.test(eventId)) {
    throw new Error('eventId obrigatório: use entre 8 e 200 caracteres seguros.');
  }
  if (!EVENT_TYPE_PATTERN.test(type)) {
    throw new Error('type obrigatório: use um identificador como subscription.status.update.');
  }
  if (tenantId != null && !tenantId) {
    throw new Error('tenantId inválido.');
  }
  if (occurredAt && Number.isNaN(Date.parse(occurredAt))) {
    throw new Error('occurredAt deve ser uma data ISO válida.');
  }
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('payload obrigatório: use um objeto JSON.');
  }

  return {
    eventId,
    type,
    tenantId,
    occurredAt,
    payload: payload as Record<string, unknown>,
  };
}

export function computeRetryDelayMs(attempt: number, options: RetryOptions) {
  const safeAttempt = Math.max(1, Math.floor(attempt));
  const exponential = options.baseDelayMs * (2 ** (safeAttempt - 1));
  return Math.min(exponential, options.maxDelayMs);
}

export async function executeWithRetry<T>(
  operation: (attempt: number) => Promise<T>,
  options: RetryOptions,
  sleep: (delayMs: number) => Promise<void> = (delayMs) =>
    new Promise((resolve) => setTimeout(resolve, delayMs))
): Promise<RetryResult<T>> {
  const maxAttempts = Math.max(1, Math.floor(options.maxAttempts));
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const value = await operation(attempt);
      return { value, attempts: attempt };
    } catch (error) {
      lastError = error;
      if (attempt >= maxAttempts) break;
      await sleep(computeRetryDelayMs(attempt, options));
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError || 'Falha no workflow.'));
}

export function workflowRetryOptionsFromEnvironment(): RetryOptions {
  const maxAttempts = Number(process.env.WORKFLOW_MAX_ATTEMPTS || 3);
  const baseDelayMs = Number(process.env.WORKFLOW_RETRY_BASE_DELAY_MS || 250);
  const maxDelayMs = Number(process.env.WORKFLOW_RETRY_MAX_DELAY_MS || 3000);

  return {
    maxAttempts: Number.isFinite(maxAttempts) ? Math.min(Math.max(Math.floor(maxAttempts), 1), 8) : 3,
    baseDelayMs: Number.isFinite(baseDelayMs) ? Math.min(Math.max(Math.floor(baseDelayMs), 0), 10_000) : 250,
    maxDelayMs: Number.isFinite(maxDelayMs) ? Math.min(Math.max(Math.floor(maxDelayMs), 0), 60_000) : 3000,
  };
}
