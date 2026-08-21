import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = async (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('Agenda usa serviço Firestore e não o armazenamento local para entrevistas', async () => {
  const view = await read('src/components/views/AgendaView.tsx');
  assert.match(view, /interviewService/);
  assert.match(view, /await interviewService\.list\(\)/);
  assert.match(view, /await interviewService\.create\(/);
  assert.doesNotMatch(view, /dataService\.createEntrevista/);
});

test('Agenda não inventa candidatura, entrevistador nem link Meet', async () => {
  const view = await read('src/components/views/AgendaView.tsx');
  assert.doesNotMatch(view, /cand_app_1/);
  assert.doesNotMatch(view, /usr_admin_1/);
  assert.doesNotMatch(view, /meet\.google\.com\/abc-defg-hij/);
  assert.match(view, /candidaturasDaVaga\.find/);
});

test('Agenda exige data futura e não marca Google como sincronizado sem integração real', async () => {
  const view = await read('src/components/views/AgendaView.tsx');
  const service = await read('src/services/interviewService.ts');
  assert.match(view, /startAt\.getTime\(\) <= Date\.now\(\)/);
  assert.match(view, /Google Calendar \/ Meet: migração pendente/);
  assert.doesNotMatch(view, /Google Calendar API \(Ativo\)/);
  assert.match(service, /sincronizadoGcal: false/);
  assert.match(service, /sincronizado_gcal: false/);
  assert.match(service, /calendarSyncStatus: 'pending_migration'/);
});

test('Entrevistas são persistidas com isolamento por empresa', async () => {
  const service = await read('src/services/interviewService.ts');
  assert.match(service, /collection\(db, 'entrevistas'\)/);
  assert.match(service, /where\('empresaId', '==', tenantId\)/);
  assert.match(service, /empresaId: tenantId/);
  assert.match(service, /companyId: tenantId/);
  assert.match(service, /empresa_id: tenantId/);
  assert.match(service, /setDoc\(ref, data\)/);
});
