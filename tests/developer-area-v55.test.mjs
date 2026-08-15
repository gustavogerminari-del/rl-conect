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

test('App entrega a Área do Programador em rota própria antes do shell operacional', async () => {
  const app = await read('src/App.tsx');
  assert.match(app, /const DEVELOPER_AREA_PATH = '\/master\/programador'/);
  assert.match(app, /if \(developerAreaRequested\) \{[\s\S]*return <DeveloperArea onBackToMaster=/);
  assert.match(app, /onOpenDeveloperArea=\{\(\) => navigateToPath\(DEVELOPER_AREA_PATH\)\}/);
  assert.match(app, /if \(isDeveloperProfile\(user\)\) return <DeveloperArea/);
  assert.match(app, /Não renderiza Navbar, Sidebar/);

  const routeStart = app.indexOf('if (developerAreaRequested)');
  const shellStart = app.indexOf('return (', routeStart);
  assert.ok(routeStart >= 0 && shellStart > routeStart, 'rota própria deve retornar antes do shell');
  assert.doesNotMatch(app.slice(routeStart, shellStart), /<Navbar|<Sidebar|<MasterAdminView/);
});

test('menu técnico v55 contém as treze áreas e nenhuma ação n8n de escrita', async () => {
  const area = await read('src/developer/DeveloperArea.tsx');
  for (const label of ['Visão Geral','Editor Visual','Assistente IA','Código / Projeto','Firebase','Integrações / API','n8n Monitor','Logs e Erros','Testes','Versões','Rollback','Publicação','Configurações DEV']) assert.match(area, new RegExp(label.replace('/', '\\/')));
  assert.match(area, /somente leitura/i);
  assert.doesNotMatch(area, /ativarWorkflow|desativarWorkflow|excluirWorkflow/);
  assert.match(area, /isDeveloperProfile\(user\) \|\| isMasterProfile\(user\)/);
  assert.match(area, /← Voltar para o Painel Master/);
  assert.match(area, /active === 'ai' \|\| active === 'code'/);
  assert.match(area, /return <MasterDeveloperAssistantView/);
});

test('regras separam Developer, Master e tenants e protegem segredos', async () => {
  const rules = await read('firebase/firestore.rules');
  assert.match(rules, /function developer\(\)/);
  assert.match(rules, /profileIsPlatform/);
  assert.match(rules, /match \/developer_credentials/);
  assert.match(rules, /id == 'developer_credentials_' \+ request\.auth\.uid/);
  assert.match(rules, /function technicalPlatformAccess\(\)/);
  assert.match(rules, /return master\(\) \|\| developer\(\)/);
  assert.match(rules, /allow delete: if false/);
});

test('Firebase continua oficial e não há troca por Google ou Supabase na rota técnica', async () => {
  const app = await read('src/App.tsx');
  const area = await read('src/developer/DeveloperArea.tsx');
  const validation = await read('src/auth/masterValidation.ts');
  assert.match(app, /AuthProvider/);
  assert.match(area, /Firebase Authentication/);
  assert.match(validation, /auth\.currentUser/);
  assert.doesNotMatch(`${app}\n${area}\n${validation}`, /GoogleAuthProvider|signInWithGoogle|supabase/i);
});

test('Editor Visual salva somente rascunho não aplicado e publicação continua humana', async () => {
  const area = await read('src/developer/DeveloperArea.tsx');
  const editor = await read('src/developer/VisualBuilder.tsx');
  assert.match(area, /return <VisualBuilder/);
  assert.match(editor, /developer_visual_drafts/);
  assert.match(editor, /appliedToProduction: false/);
  assert.match(editor, /Edite o layout sem mexer no código/);
  assert.match(editor, /onPointerDown/);
  assert.match(editor, /Camadas/);
  assert.match(editor, /Propriedades/);
  assert.match(editor, /Desfazer/);
  assert.match(editor, /Preview/);
  assert.match(editor, /Validar/);
  assert.match(editor, /Testar/);
  assert.match(editor, /Criar versão/);
  assert.match(area, /merge automático na main estão desabilitados/);
  assert.match(area, /Execução de rollback não está disponível/);
});

test('Google AI Studio fica acessível ao MASTER sem expor chave no navegador', async () => {
  const view = await read('src/master-admin/components/MasterDeveloperAssistantView.tsx');
  const route = await read('app/api/master/developer-assistant/route.ts');
  assert.match(view, /https:\/\/aistudio\.google\.com\/app\/apikey/);
  assert.match(view, /MASTER e DESENVOLVEDOR/);
  assert.match(view, /Conectar Gemini \/ AI Studio/);
  assert.match(route, /MASTER_ADMIN/);
  assert.match(route, /validateGeminiApiKey/);
  assert.doesNotMatch(view, /GEMINI_API_KEY/);
});
