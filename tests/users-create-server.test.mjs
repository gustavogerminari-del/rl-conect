import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = async (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('UserService usa a rota administrativa server-side antes do fallback', async () => {
  const service = await read('src/services/UserService.ts');
  assert.match(service, /authorizedRequest\('\/api\/users\/create'/);
});

test('rota de criação exige sessão MASTER', async () => {
  const route = await read('app/api/users/create/route.ts');
  assert.match(route, /requireMaster/);
  assert.match(route, /accounts:lookup/);
  assert.match(route, /A criação de acessos é exclusiva do usuário MASTER/);
});

test('rota cria Auth e persiste perfis canônicos usuarios e users', async () => {
  const route = await read('app/api/users/create/route.ts');
  assert.match(route, /accounts:\$\{action\}/);
  assert.match(route, /'signUp'/);
  assert.match(route, /'usuarios'/);
  assert.match(route, /'users'/);
  assert.match(route, /permissions/);
  assert.match(route, /modules/);
});

test('rota possui rollback quando a persistência do perfil falha', async () => {
  const route = await read('app/api/users/create/route.ts');
  assert.match(route, /Promise\.allSettled/);
  assert.match(route, /deleteFirestoreDocument/);
  assert.match(route, /deleteAuthUser/);
  assert.match(route, /createdNewUser/);
});

test('rota preserva compatibilidade com conta Auth existente', async () => {
  const route = await read('app/api/users/create/route.ts');
  assert.match(route, /EMAIL_EXISTS/);
  assert.match(route, /signInWithPassword/);
  assert.match(route, /reusedExistingAuthAccount/);
});
