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

test('rota valida a empresa no Firestore e deriva companyName no servidor', async () => {
  const route = await read('app/api/users/create/route.ts');
  assert.match(route, /resolveCompanyName/);
  assert.match(route, /readFirestoreDocument\(projectId, accessToken, 'empresas', companyId\)/);
  assert.match(route, /A empresa vinculada ao usuário não existe/);
  assert.match(route, /A empresa selecionada não possui um nome válido/);
  assert.doesNotMatch(route, /String\(body\.companyName/);
});

test('ADMIN_EMPRESA mantém tipoUsuario compatível no backend', async () => {
  const route = await read('app/api/users/create/route.ts');
  assert.match(route, /COMPANY_ADMIN_ROLES/);
  assert.match(route, /return 'ADMIN_EMPRESA'/);
  assert.match(route, /const tipoUsuario = canonicalTipoUsuario\(role, body\.tipoUsuario\)/);
  assert.match(route, /tipoUsuario,/);
});

test('rollback restaura perfis antigos quando a conta Auth já existia', async () => {
  const route = await read('app/api/users/create/route.ts');
  assert.match(route, /previousPrimary/);
  assert.match(route, /previousLegacy/);
  assert.match(route, /restoreProfile/);
  assert.match(route, /Promise\.allSettled/);
  assert.match(route, /if \(previous\)/);
  assert.match(route, /createdAccount\.createdNewUser/);
  assert.match(route, /deleteAuthUser/);
});

test('rota preserva compatibilidade com conta Auth existente', async () => {
  const route = await read('app/api/users/create/route.ts');
  assert.match(route, /EMAIL_EXISTS/);
  assert.match(route, /signInWithPassword/);
  assert.match(route, /reusedExistingAuthAccount/);
});
