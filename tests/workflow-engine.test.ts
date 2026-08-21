import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeRetryDelayMs,
  executeWithRetry,
  validateWorkflowEvent,
} from '../app/api/workflows/_core/workflowEngine.ts';

test('validateWorkflowEvent aceita evento válido e normaliza type', () => {
  const event = validateWorkflowEvent({
    eventId: 'evt_12345678',
    type: 'Subscription.Status.Update',
    tenantId: 'empresa_1',
    payload: { subscriptionId: 'sub_1', status: 'ativa' },
  });

  assert.equal(event.eventId, 'evt_12345678');
  assert.equal(event.type, 'subscription.status.update');
  assert.equal(event.tenantId, 'empresa_1');
});

test('validateWorkflowEvent rejeita eventId curto para proteger idempotência', () => {
  assert.throws(
    () => validateWorkflowEvent({ eventId: '123', type: 'system.healthcheck', payload: {} }),
    /eventId obrigatório/
  );
});

test('computeRetryDelayMs aplica backoff exponencial com teto', () => {
  const options = { maxAttempts: 5, baseDelayMs: 100, maxDelayMs: 250 };
  assert.equal(computeRetryDelayMs(1, options), 100);
  assert.equal(computeRetryDelayMs(2, options), 200);
  assert.equal(computeRetryDelayMs(3, options), 250);
});

test('executeWithRetry repete a operação e retorna a tentativa de sucesso', async () => {
  let calls = 0;
  const delays: number[] = [];

  const result = await executeWithRetry(
    async () => {
      calls += 1;
      if (calls < 3) throw new Error('falha transitória');
      return 'ok';
    },
    { maxAttempts: 4, baseDelayMs: 10, maxDelayMs: 100 },
    async (delayMs) => { delays.push(delayMs); }
  );

  assert.equal(result.value, 'ok');
  assert.equal(result.attempts, 3);
  assert.equal(calls, 3);
  assert.deepEqual(delays, [10, 20]);
});
