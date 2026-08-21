import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = async (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('bridge usa coleções canônicas dos fluxos operacionais', async () => {
  const bridge = await read('src/services/firebaseStateBridge.ts');
  assert.match(bridge, /clientes: 'headhunter_clients'/);
  assert.match(bridge, /registroPontos: 'registros_ponto'/);
  assert.match(bridge, /assinaturas: 'subscriptions'/);
  assert.match(bridge, /admissoesPendentes: 'solicitacoes_admissao'/);
  assert.match(bridge, /cobrancasHeadhunter: 'financeiro_cobrancas'/);
  assert.match(bridge, /doc\(db, 'empresa_modulos', companyId\)/);
  assert.doesNotMatch(bridge, /empresaModulos: 'empresaModulos'/);
  assert.doesNotMatch(bridge, /assinaturas: 'assinaturas'/);
});

test('bridge não regrava módulos, assinatura ou usuário pelo save genérico', async () => {
  const bridge = await read('src/services/firebaseStateBridge.ts');
  const persistBlock = bridge.slice(bridge.indexOf('const AUTO_PERSIST_KEYS'), bridge.indexOf('async function tenantDocs'));
  assert.doesNotMatch(persistBlock, /empresaModulos/);
  assert.doesNotMatch(persistBlock, /assinaturas/);
  assert.doesNotMatch(persistBlock, /usuarios/);
  assert.doesNotMatch(persistBlock, /empresas/);
});

test('vaga publicada recebe formato público aceito pelas rules', async () => {
  const bridge = await read('src/services/firebaseStateBridge.ts');
  const rules = await read('firebase/firestore.rules');
  assert.match(bridge, /publicada: published/);
  assert.match(bridge, /status: published \? 'Ativa'/);
  assert.match(rules, /data\.publicada == true/);
  assert.match(rules, /data\.status == 'Aberta' \|\| data\.status == 'Ativa' \|\| data\.status == 'ativa'/);
});

test('MASTER abre tela própria sem Header e Sidebar de tenant', async () => {
  const app = await read('src/App.tsx');
  assert.match(app, /if \(isMaster\) \{\s*return <MasterAdminView/);
  assert.match(app, /MASTER é identidade da plataforma e não possui empresa/);
});

test('menu de empresa exige modules ou permissions provisionados', async () => {
  const sidebar = await read('src/components/Sidebar.tsx');
  assert.match(sidebar, /const hasAccess =/);
  assert.match(sidebar, /modules\[key\] === true \|\| permissions\.has\(key\)/);
  assert.match(sidebar, /visible: hasAccess\('headhunter'\)/);
  assert.match(sidebar, /visible: isMaster/);
});
