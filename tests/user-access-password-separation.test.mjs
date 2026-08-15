import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = async (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('edição de acesso não solicita senha atual do cliente', async () => {
  const view = await read('src/master-admin/components/MasterAdminOfficialView.tsx');
  assert.match(view, /Editar acesso — sem senha/);
  assert.match(view, /Salvar alterações sem senha/);
  assert.match(view, /Redefinir senha/);
  assert.match(view, /Senha temporária — somente conta nova/);
});

test('UserService nunca autentica como cliente para reaproveitar uma conta existente', async () => {
  const service = await read('src/services/UserService.ts');
  assert.doesNotMatch(service, /signInWithEmailAndPassword/);
  assert.match(service, /sendPasswordResetEmail/);
  assert.match(service, /A senha atual do cliente nunca deve ser solicitada/);
});

test('senha temporária continua obrigatória apenas para nova conta', async () => {
  const service = await read('src/services/UserService.ts');
  assert.match(service, /Senha temporária é exigida apenas para uma conta realmente nova/);
  assert.match(service, /findExistingUserByEmail/);
});

test('alteração comum não muda o e-mail do Firebase só pelo Firestore', async () => {
  const service = await read('src/services/UserService.ts');
  assert.match(service, /A alteração do e-mail de login exige um fluxo administrativo seguro do Firebase/);
  assert.match(service, /delete safeData\.email/);
});
