import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const text = async (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('public portal persistence adapter is loaded by the client entry', async () => {
  const main = await text('src/main.tsx');
  assert.match(main, /publicPortalPersistence/);
});

test('public application adapter sends job and talent registrations to backend', async () => {
  const adapter = await text('src/services/publicPortalPersistence.ts');
  assert.match(adapter, /\/api\/public\/apply/);
  assert.match(adapter, /type: 'job'/);
  assert.match(adapter, /type: 'talent'/);
});

test('public backend validates company and published job before Firebase writes', async () => {
  const route = await text('app/api/public/apply/route.ts');
  assert.match(route, /Empresa não encontrada/);
  assert.match(route, /Vaga indisponível para candidatura/);
  assert.match(route, /tenantOf\(job\) !== companyId/);
  assert.match(route, /isPublishedJob\(job\)/);
  assert.match(route, /upsertDoc\(sa\.project_id, token, 'candidatos'/);
  assert.match(route, /upsertDoc\(sa\.project_id, token, 'candidaturas'/);
});

test('talent pool registration does not create a fake job application', async () => {
  const route = await text('app/api/public/apply/route.ts');
  assert.match(route, /if \(type === 'job'\) \{/);
  assert.match(route, /inTalentBank: type === 'talent'/);
});
