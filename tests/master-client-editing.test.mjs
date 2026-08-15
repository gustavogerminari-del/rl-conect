import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = async (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('modal permite editar cliente sem senha e exige senha apenas na criação', async () => {
  const modal = await read('src/master-admin/components/MasterTenantModal.tsx');
  assert.match(modal, /const isEditing = Boolean\(tenant\?\.id\)/);
  assert.match(modal, /required=\{!isEditing\}/);
  assert.match(modal, /isEditing \? \(\s*<div/);
  assert.match(modal, /mode: 'edit'/);
  assert.match(modal, /mode: 'create', adminPassword, confirmAdminPassword/);
  assert.match(modal, /Enviar credenciais e instruções de acesso por e-mail/);
});

test('abas ficam todas acessíveis e desktop permite duas linhas sem overflow oculto', async () => {
  const modal = await read('src/master-admin/components/MasterTenantModal.tsx');
  for (const label of ['Dados da Empresa', 'Plano & Limites', 'Módulos Liberados', 'Personalização / White-Label', 'Contrato', 'Administrador']) {
    assert.ok(modal.includes(label), `aba ausente: ${label}`);
  }
  assert.match(modal, /overflow-x-auto/);
  assert.match(modal, /md:grid-cols-3/);
  assert.match(modal, /xl:grid-cols-6/);
  assert.match(modal, /md:overflow-visible/);
});

test('edição comum não recria administrador nem persiste senha', async () => {
  const store = await read('src/master-admin/masterTenantsStore.ts');
  const editStart = store.indexOf('// Edição comum nunca provisiona usuário');
  const creationStart = store.indexOf('\n\n  await persistTenant(tenant);', editStart);
  assert.ok(editStart >= 0 && creationStart > editStart, 'bloco de edição não localizado');
  const editBlock = store.slice(editStart, creationStart);
  assert.doesNotMatch(editBlock, /UserService\.create/);
  assert.match(store, /adminPassword: _password/);
  assert.match(store, /confirmAdminPassword: _confirmation/);
  assert.match(store, /UserService\.create/);
});

test('Gemini substitui OpenAI e status legado não é reaproveitado', async () => {
  const wrapper = await read('src/master-admin/components/MasterAdminView.tsx');
  const service = await read('src/master-admin/services/masterOperationalService.ts');
  assert.match(wrapper, /Gemini \/ IA/);
  assert.match(wrapper, /CONFIGURAÇÃO PENDENTE/);
  assert.match(service, /item\.name\.trim\(\)\.toLowerCase\(\) !== 'openai \/ ia'/);
  assert.match(service, /\/gemini\/i\.test\(item\.name\)/);
});

test('login do Painel Master permanece Firebase Authentication', async () => {
  const view = await read('src/master-admin/components/MasterAdminOfficialView.tsx');
  assert.match(view, /onAuthStateChanged\(auth/);
  assert.match(view, /Firebase Authentication/);
  assert.doesNotMatch(view, /signInWithGoogle|GoogleAuthProvider/);
});

test('menu do Painel Master expõe Área do Programador e possui rolagem vertical própria', async () => {
  const wrapper = await read('src/master-admin/components/MasterAdminView.tsx');
  const official = await read('src/master-admin/components/MasterAdminOfficialView.tsx');
  const index = await read('src/master-admin/index.ts');

  for (const label of [
    'Visão Geral',
    'Leads',
    'Empresas',
    'Usuários e Permissões',
    'Planos e Módulos',
    'Financeiro',
    'Faturamento / NFS-e',
    'Suporte Técnico',
    'Integrações / API',
    'Backup',
    'Auditoria e Logs',
    'Configurações',
    'Área do Programador',
  ]) {
    assert.ok(`${official}\n${wrapper}`.includes(label), `item de menu ausente: ${label}`);
  }

  assert.doesNotMatch(wrapper, /MasterDeveloperAssistantView/);
  assert.match(wrapper, /onOpenDeveloperArea/);
  assert.match(wrapper, /\/master\/programador/);
  assert.match(wrapper, /height: calc\(100dvh - var\(--master-header-height/);
  assert.match(wrapper, /ResizeObserver/);
  assert.match(wrapper, /overflow-y: auto/);
  assert.match(wrapper, /validarAcessoMaster/);
  assert.match(index, /export \{ MasterAdminView \} from '\.\/components\/MasterAdminView'/);
  assert.doesNotMatch(index, /export \* from '\.\/components\/MasterAdminOfficialView'/);
});
