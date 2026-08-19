import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('assistente interno aceita MASTER/Developer e usa OpenAI/Gemini somente no backend', async () => {
  const route = await read('app/api/master/developer-assistant/route.ts');
  const geminiKey = await read('app/api/master/developer-assistant/geminiKey.ts');
  const view = await read('src/master-admin/components/MasterDeveloperAssistantView.tsx');
  assert.match(route, /requireTechnicalAccess\(request\)/);
  assert.match(route, /DEVELOPER_ADMIN/);
  assert.match(route, /MASTER_ADMIN/);
  assert.match(route, /process\.env\.OPENAI_API_KEY/);
  assert.match(route, /https:\/\/api\.openai\.com\/v1\/responses/);
  assert.match(`${route}\n${geminiKey}`, /https:\/\/generativelanguage\.googleapis\.com\/v1beta\/models/);
  assert.doesNotMatch(view, /OPENAI_API_KEY|GEMINI_API_KEY|api\.openai\.com|generativelanguage\.googleapis\.com/);
  assert.match(route, /AES-GCM/);
  assert.match(view, /api\/developer\/assistant/);
  assert.match(view, /Conectar OpenAI/);
  assert.match(view, /Conectar Gemini/);
  assert.match(view, /Gemini gratuito/);
  assert.match(view, /Gemini pago/);
  assert.match(route, /encryptedGeminiApiKey/);
  assert.match(route, /configure_provider_key/);
});

test('seleção gratuita ou paga do Gemini usa a mesma chave segura e é explícita antes da análise', async () => {
  const route = await read('app/api/master/developer-assistant/route.ts');
  const view = await read('src/master-admin/components/MasterDeveloperAssistantView.tsx');
  assert.match(view, /gemini_free/);
  assert.match(view, /gemini_paid/);
  assert.match(view, /selectedProvider/);
  assert.match(route, /body\?\.provider === 'gemini'/);
  assert.match(route, /process\.env\.GEMINI_DEVELOPER_MODEL/);
});

test('chave Gemini não usa bloqueio local de formato e só é aceita após validação real no Google', async () => {
  const route = await read('app/api/master/developer-assistant/route.ts');
  assert.doesNotMatch(route, /\^\[A-Za-z0-9_-\]\{20,/);
  assert.match(route, /normalizeSubmittedSecret/);
  assert.match(route, /validateGeminiApiKey\(submittedKey\)/);
  assert.doesNotMatch(route, /console\.(?:info|error).*submittedKey/);
});

test('Gemini usa modelo habilitado na conta e Interactions API estável', async () => {
  const route = await read('app/api/master/developer-assistant/route.ts');
  const helper = await read('app/api/master/developer-assistant/geminiKey.ts');
  const interactions = await read('app/api/master/developer-assistant/geminiInteractions.ts');
  assert.match(interactions, /v1\/interactions/);
  assert.match(interactions, /gemini-3\.6-flash/);
  assert.match(interactions, /gemini-3\.1-flash-lite/);
  assert.match(interactions, /'x-goog-api-key': options\.apiKey/);
  assert.match(route, /callGeminiInteractions/);
  assert.match(helper, /supportedGenerationMethods\?\.includes\('generateContent'\)/);
});

test('OpenAI sem saldo usa automaticamente o Gemini conectado', async () => {
  const route = await read('app/api/master/developer-assistant/route.ts');
  const view = await read('src/master-admin/components/MasterDeveloperAssistantView.tsx');
  assert.match(route, /error\.status === 429/);
  assert.match(route, /resolveApiKey\(access, 'gemini'\)/);
  assert.match(route, /fallbackMessage/);
  assert.match(view, /payload\.fallbackMessage/);
});

test('catálogo exclui segredos e limita tamanho dos arquivos', async () => {
  const generator = await read('scripts/generate-source-catalog.mjs');
  assert.match(generator, /entry\.name\.startsWith\('\.env'\)/);
  assert.match(generator, /maxFileBytes/);
  assert.match(generator, /maxCatalogBytes/);
});

test('edições ficam em rascunho persistente e não publicam código automaticamente', async () => {
  const view = await read('src/master-admin/components/MasterDeveloperAssistantView.tsx');
  assert.match(view, /developer_code_drafts/);
  assert.match(view, /DEVELOPER_CODE_DRAFT/);
  assert.match(view, /Rascunho — não publica sozinho/);
  assert.match(view, /Aplicar ao rascunho e salvar/);
  assert.doesNotMatch(view, /git push|checkpoint|deploy/);
});

test('rascunhos técnicos ficam isolados por role e autor no Firestore oficial', async () => {
  const rules = await read('firebase/firestore.rules');
  assert.match(rules, /match \/developer_code_drafts/);
  assert.match(rules, /request\.resource\.data\.createdBy == request\.auth\.uid/);
});

test('login MASTER oferece recuperação clara e o modal não fica travado se o Firebase falhar', async () => {
  const login = await read('src/auth/components/LoginForm.tsx');
  const recovery = await read('src/auth/components/ForgotPasswordModal.tsx');
  assert.match(login, /Redefinir senha do acesso MASTER/);
  assert.match(login, /initialEmail=\{email\}/);
  assert.match(recovery, /finally/);
  assert.match(recovery, /setIsSubmitting\(false\)/);
  assert.match(recovery, /errorMessage/);
});
