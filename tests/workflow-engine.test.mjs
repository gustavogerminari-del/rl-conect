import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = async (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('router exige eventId e token interno', async () => {
  const route = await read('app/api/workflows/events/route.ts');
  const engine = await read('app/api/workflows/_core/workflowEngine.ts');
  assert.match(route, /WORKFLOW_INTERNAL_TOKEN/);
  assert.match(route, /x-rh-mil-workflow-token/);
  assert.match(engine, /eventId obrigatório/);
  assert.match(engine, /EVENT_ID_PATTERN/);
});

test('eventos são persistidos antes do processamento para idempotência', async () => {
  const route = await read('app/api/workflows/events/route.ts');
  const firestore = await read('app/api/workflows/_core/firestoreAdminRest.ts');
  assert.match(route, /createWorkflowEventDocument/);
  assert.match(route, /duplicate: true/);
  assert.match(firestore, /documents\/workflow_events\?documentId=/);
  assert.match(firestore, /response\.status === 409/);
});

test('router registra estados completed, failed e pending_handler', async () => {
  const route = await read('app/api/workflows/events/route.ts');
  for (const status of ['completed', 'failed', 'pending_handler']) {
    assert.match(route, new RegExp(status));
  }
});

test('retry usa backoff exponencial e limite de tentativas', async () => {
  const engine = await read('app/api/workflows/_core/workflowEngine.ts');
  assert.match(engine, /2 \*\* \(safeAttempt - 1\)/);
  assert.match(engine, /WORKFLOW_MAX_ATTEMPTS/);
  assert.match(engine, /WORKFLOW_RETRY_BASE_DELAY_MS/);
  assert.match(engine, /WORKFLOW_RETRY_MAX_DELAY_MS/);
});

test('primeiros handlers internos não dependem de webhook externo', async () => {
  const route = await read('app/api/workflows/events/route.ts');
  for (const eventType of ['subscription.status.update', 'notification.create', 'audit.log.write']) {
    assert.match(route, new RegExp(eventType.replaceAll('.', '\\.')));
  }
  assert.doesNotMatch(route, /n8n|webhook/i);
});
