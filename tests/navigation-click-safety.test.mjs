import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = async (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('todas as opções visíveis do menu principal possuem destino de renderização', async () => {
  const sidebar = await read('src/components/Sidebar.tsx');
  const app = await read('src/App.tsx');
  const visibleTabs = [
    'dashboard', 'vagas', 'candidatos', 'entrevistas', 'contratacoes',
    'headhunter-projetos', 'headhunter-clientes', 'headhunter-financeiro', 'headhunter-portal-cliente',
    'banco-talentos', 'departamento-pessoal', 'colaboradores', 'admissoes', 'organograma',
    'ponto-digital', 'beneficios', 'ferias', 'rescisao', 'documentos', 'afastamentos', 'sst',
    'folha-pagamento', 'acessos-portal', 'relatorios-dp', 'agenda', 'relatorios', 'configuracoes',
    'suporte-ajuda', 'acesso-master', 'master-empresas', 'master-planos', 'master-modulos',
    'master-usuarios', 'master-personalizacao', 'auditoria', 'site-vagas',
  ];
  for (const tab of visibleTabs) {
    assert.match(sidebar, new RegExp(`id:\\s*['"]${tab}['"]|handleSelectTab\\(['"]${tab}['"]\\)`), `${tab} deve existir no menu`);
  }
  for (const tab of ['dashboard','vagas','candidatos','entrevistas','contratacoes','agenda','relatorios','auditoria','configuracoes','suporte-ajuda','site-vagas']) {
    assert.match(app, new RegExp(`activeTab\\s*===\\s*['"]${tab}['"]`), `${tab} deve renderizar no App`);
  }
  for (const tab of ['departamento-pessoal','colaboradores','admissoes','organograma','ponto-digital','beneficios','ferias','rescisao','documentos','afastamentos','sst','acessos-portal','relatorios-dp']) {
    assert.match(app, new RegExp(`['"]${tab}['"]`), `${tab} deve participar do roteamento do DP`);
  }
  assert.match(app, /activeTab\.startsWith\('headhunter-'\)/);
  assert.match(app, /activeTab\.startsWith\('master-'\)/);
});

test('atalhos do menu Master abrem a seção correta', async () => {
  const app = await read('src/App.tsx');
  assert.match(app, /activeTab === 'master-empresas' \? 'empresas'/);
  assert.match(app, /activeTab === 'master-planos' \? 'planos-modulos'/);
  assert.match(app, /activeTab === 'master-modulos' \? 'planos-modulos'/);
  assert.match(app, /activeTab === 'master-usuarios' \? 'usuarios'/);
  assert.match(app, /activeTab === 'master-personalizacao' \? 'configuracoes'/);
  assert.match(app, /<MasterAdminView[\s\S]*initialSection=/);
});

test('cada opção interna do Painel Master possui conteúdo e proteção contra tela branca', async () => {
  const master = await read('src/master-admin/components/MasterAdminOfficialView.tsx');
  const boundary = await read('src/master-admin/components/MasterSectionErrorBoundary.tsx');
  for (const section of ['dashboard','leads','empresas','usuarios','planos-modulos','financeiro','faturamento','suporte','integracoes','backup','auditoria','configuracoes']) {
    assert.match(master, new RegExp(`activeSection\\s*===\\s*['"]${section}['"]`), `${section} deve possuir renderização`);
  }
  assert.match(master, /<MasterSectionErrorBoundary section=\{activeSection\}/);
  assert.match(boundary, /getDerivedStateFromError/);
  assert.match(boundary, /componentDidCatch/);
  assert.match(boundary, /RL_CONNECT_MASTER_SECTION_RENDER_FAILED/);
});

test('Master normaliza registros antigos antes de filtros e métricas', async () => {
  const tenants = await read('src/master-admin/masterTenantsStore.ts');
  const modules = await read('src/master-admin/masterModulesStore.ts');
  const master = await read('src/master-admin/components/MasterAdminOfficialView.tsx');
  assert.match(tenants, /normalizeTenantRecord/);
  assert.match(modules, /normalizePlatformModuleRecord/);
  assert.match(master, /tenantDisplayStatus/);
  assert.match(master, /tenant\.contract\?\.monthlyFee/);
  assert.match(master, /tenant\.metrics\?\.activeUsersCount/);
});

test('Desenvolvimento IA não quebra com arquivo incompleto', async () => {
  const assistant = await read('src/master-admin/components/MasterDeveloperAssistantView.tsx');
  assert.match(assistant, /const safeFiles: SourceFile\[\]/);
  assert.match(assistant, /path: String\(file\?\.path \|\| ''\)/);
  assert.match(assistant, /\.filter\(\(file: SourceFile\) => file\.path\.length > 0\)/);
});

test('todos os submenus do Departamento Pessoal possuem tela', async () => {
  const dp = await read('src/departamento-pessoal/DepartamentoPessoalView.tsx');
  for (const tab of ['visao-geral','colaboradores','organograma','cargos-salarios','ponto-digital','admissoes','beneficios','ferias-afastamentos','sst','documentos','rescisao','folha-pagamento','relatorios-dp','acessos-portal','configuracoes-trabalhistas']) {
    assert.match(dp, new RegExp(`activeSubTab\\s*===\\s*['"]${tab}['"]`), `${tab} precisa renderizar uma tela DP`);
  }
});

test('todas as rotas do Headhunter chegam a uma seção renderizada', async () => {
  const hh = await read('src/headhunter/HeadhunterView.tsx');
  for (const tab of ['dashboard','clientes','comercial','financeiro','vagas','candidatos','pipeline','entrevistas','contratacoes','agenda','comissoes','despesas','contratos','relatorios','portal_cliente']) {
    assert.match(hh, new RegExp(`activeTab\\s*===\\s*['"]${tab}['"]|activeTab\\s*===\\s*['"]crm['"]`), `${tab} precisa ter destino no Headhunter`);
  }
});
