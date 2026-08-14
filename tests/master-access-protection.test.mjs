import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('MASTER is accepted independently from company status and MASTER_ADMIN is normalized', async () => {
  const profile = await source('src/auth/profile.ts');
  assert.match(profile, /const master = isMasterProfile\(raw\)/);
  assert.match(profile, /if \(!master && \(raw\.ativo === false/);
});

test('login waits for Firestore profile establishment before reporting success', async () => {
  const auth = await source('src/auth/context/AuthContext.tsx');
  assert.match(auth, /await establishFirebaseSession\(credential\.user\)/);
  assert.match(auth, /role: 'MASTER'[\s\S]*status: 'ATIVO'[\s\S]*empresaId: null/);
});

test('company users cannot read, update, block or delete MASTER profiles', async () => {
  const rules = await source('firebase/firestore.rules');
  const service = await source('src/services/UserService.ts');
  const view = await source('src/master-admin/components/MasterAdminOfficialView.tsx');
  assert.match(rules, /!profileIsMaster\(resource\.data\)/);
  assert.match(rules, /!profileIsMaster\(request\.resource\.data\)/);
  assert.match(service, /O acesso MASTER é protegido e não pode ser bloqueado ou desativado/);
  assert.match(service, /O acesso MASTER é protegido e não pode ser excluído/);
  assert.match(view, /Não pode bloquear/);
});
