import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('perfil developer_admin é separado de MASTER e não exige empresa', async () => {
  const profile = await read('src/auth/profile.ts');
  assert.match(profile, /isDeveloperProfile/);
  assert.match(profile, /!master && !developer && !companyId/);
  assert.match(profile, /developer \? 'DEVELOPER_ADMIN'/);
});

test('App entrega experiência Developer separada antes das rotas operacionais', async () => {
  const app = await read('src/App.tsx');
  assert.match(app, /if \(isDeveloperProfile\(user\)\) return <DeveloperArea/);
  assert.match(app, /Não renderiza Navbar, Sidebar/);
});

test('menu técnico v55 contém as treze áreas e nenhuma ação n8n de escrita', async () => {
  const area = await read('src/developer/DeveloperArea.tsx');
  for (const label of ['Visão Geral','Editor Visual','Assistente IA','Código / Projeto','Firebase','Integrações / API','n8n Monitor','Logs e Erros','Testes','Versões','Rollback','Publicação','Configurações DEV']) assert.match(area, new RegExp(label.replace('/', '\\/')));
  assert.match(area, /somente leitura/i);
  assert.doesNotMatch(area, /ativarWorkflow|desativarWorkflow|excluirWorkflow/);
});

test('regras separam Developer, Master e tenants e protegem segredos', async () => {
  const rules = await read('firebase/firestore.rules');
  assert.match(rules, /function developer\(\)/);
  assert.match(rules, /profileIsPlatform/);
  assert.match(rules, /match \/developer_credentials/);
  assert.match(rules, /id == 'developer_credentials_' \+ request\.auth\.uid/);
  assert.match(rules, /allow delete: if false/);
});

test('Editor Visual salva somente rascunho não aplicado e publicação continua humana', async () => {
  const area = await read('src/developer/DeveloperArea.tsx');
  assert.match(area, /developer_visual_drafts/);
  assert.match(area, /appliedToProduction: false/);
  assert.match(area, /merge automático na main estão desabilitados/);
  assert.match(area, /Execução de rollback não está disponível/);
});
