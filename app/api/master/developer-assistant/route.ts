import { SOURCE_CATALOG } from './sourceCatalog.generated';
import { normalizeSubmittedSecret, validateGeminiApiKey } from './geminiKey';
import { callGeminiInteractions, type GeminiTier } from './geminiInteractions';

const JSON_HEADERS = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' };
const TECHNICAL_ROLES = new Set([
  'DEVELOPER_ADMIN', 'developer_admin', 'DEVELOPER', 'DESENVOLVEDOR',
  'MASTER_ADMIN', 'master_admin', 'MASTER', 'SUPER_ADMINISTRADOR', 'Super Administrador',
]);
type AiProvider = 'openai' | 'gemini';

class AiProviderError extends Error {
  constructor(public readonly provider: AiProvider, message: string, public readonly status: number) {
    super(message);
    this.name = 'AiProviderError';
  }
}

function decodeValue(value: any): any {
  if (!value || typeof value !== 'object') return undefined;
  if ('stringValue' in value) return value.stringValue;
  if ('booleanValue' in value) return value.booleanValue;
  if ('mapValue' in value) return Object.fromEntries(Object.entries(value.mapValue?.fields || {}).map(([key, nested]) => [key, decodeValue(nested)]));
  return undefined;
}

async function requireTechnicalAccess(request: Request) {
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim();
  const apiKey = process.env.VITE_FIREBASE_API_KEY;
  const projectId = process.env.VITE_FIREBASE_PROJECT_ID;
  if (!token) throw new Error('Sessão Firebase obrigatória.');
  if (!apiKey || !projectId) throw new Error('Validação Firebase não configurada no servidor.');

  const accountResponse = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken: token }),
    signal: AbortSignal.timeout(10000),
  });
  if (!accountResponse.ok) throw new Error('Sessão Firebase inválida ou expirada.');
  const account: any = await accountResponse.json();
  const uid = String(account.users?.[0]?.localId || '');
  if (!uid) throw new Error('Usuário Firebase não identificado.');

  let profile: any = null;
  for (const collectionName of ['usuarios', 'users']) {
    const response = await fetch(`https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${collectionName}/${uid}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(10000),
    });
    if (response.ok) {
      const payload: any = await response.json();
      profile = Object.fromEntries(Object.entries(payload.fields || {}).map(([key, value]) => [key, decodeValue(value)]));
      break;
    }
  }
  const role = String(profile?.role || profile?.tipoUsuario || '');
  if (!profile || profile.ativo === false || !TECHNICAL_ROLES.has(role)) throw new Error('Acesso exclusivo de MASTER ou DESENVOLVEDOR.');
  return { uid, token, projectId };
}

const credentialDocumentId = (uid: string) => `developer_credentials_${uid}`;

async function readCredential(access: { uid: string; token: string; projectId: string }) {
  const response = await fetch(`https://firestore.googleapis.com/v1/projects/${access.projectId}/databases/(default)/documents/developer_credentials/${credentialDocumentId(access.uid)}`, {
    headers: { Authorization: `Bearer ${access.token}` },
    signal: AbortSignal.timeout(10000),
  });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error('Não foi possível consultar a configuração segura das IAs.');
  const payload: any = await response.json();
  return Object.fromEntries(Object.entries(payload.fields || {}).map(([key, value]) => [key, decodeValue(value)]));
}

const bytesToBase64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));
const base64ToBytes = (value: string) => Uint8Array.from(atob(value), char => char.charCodeAt(0));

async function encryptionKey() {
  const encoded = process.env.MASTER_AI_ENCRYPTION_KEY;
  if (!encoded) throw new Error('Proteção das chaves de IA ainda não foi configurada no servidor.');
  const bytes = base64ToBytes(encoded);
  if (bytes.byteLength !== 32) throw new Error('Proteção das chaves de IA possui configuração inválida.');
  return crypto.subtle.importKey('raw', bytes, 'AES-GCM', false, ['encrypt', 'decrypt']);
}

async function encryptSecret(secret: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await encryptionKey(), new TextEncoder().encode(secret));
  return { encryptedKey: bytesToBase64(new Uint8Array(encrypted)), iv: bytesToBase64(iv) };
}

async function decryptSecret(encryptedKey: string, iv: string) {
  const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: base64ToBytes(iv) }, await encryptionKey(), base64ToBytes(encryptedKey));
  return new TextDecoder().decode(decrypted);
}

const credentialFields = (provider: AiProvider) => provider === 'openai'
  ? { encrypted: 'encryptedApiKey', iv: 'iv' }
  : { encrypted: 'encryptedGeminiApiKey', iv: 'geminiIv' };

async function saveCredential(access: { uid: string; token: string; projectId: string }, provider: AiProvider, apiKey: string) {
  const encrypted = await encryptSecret(apiKey);
  const names = credentialFields(provider);
  const updateMask = ['id', 'documentType', 'companyId', names.encrypted, names.iv, 'updatedAt']
    .map(field => `updateMask.fieldPaths=${encodeURIComponent(field)}`)
    .join('&');
  const response = await fetch(`https://firestore.googleapis.com/v1/projects/${access.projectId}/databases/(default)/documents/developer_credentials/${credentialDocumentId(access.uid)}?${updateMask}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${access.token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: {
      id: { stringValue: credentialDocumentId(access.uid) },
      documentType: { stringValue: 'DEVELOPER_CREDENTIALS' },
      companyId: { stringValue: 'GLOBAL' },
      [names.encrypted]: { stringValue: encrypted.encryptedKey },
      [names.iv]: { stringValue: encrypted.iv },
      updatedAt: { timestampValue: new Date().toISOString() },
    } }),
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error('Não foi possível salvar a chave criptografada.');
}

async function resolveApiKey(access: { uid: string; token: string; projectId: string }, provider: AiProvider) {
  const environmentKey = provider === 'openai' ? process.env.OPENAI_API_KEY : process.env.GEMINI_API_KEY;
  if (environmentKey) return environmentKey;
  const credential = await readCredential(access);
  const names = credentialFields(provider);
  if (!credential?.[names.encrypted] || !credential?.[names.iv]) return '';
  return decryptSecret(String(credential[names.encrypted]), String(credential[names.iv]));
}

const publicFiles = () => SOURCE_CATALOG.map(file => ({ path: file.path, size: file.content.length }));

export async function GET(request: Request) {
  try {
    const access = await requireTechnicalAccess(request);
    const path = new URL(request.url).searchParams.get('path');
    if (!path) {
      const credential = await readCredential(access);
      const providers = {
        openai: Boolean(process.env.OPENAI_API_KEY || credential?.encryptedApiKey),
        gemini: Boolean(process.env.GEMINI_API_KEY || credential?.encryptedGeminiApiKey),
      };
      return Response.json({ success: true, files: publicFiles(), providers, openAiConfigured: providers.openai, geminiConfigured: providers.gemini }, { headers: JSON_HEADERS });
    }
    const file = SOURCE_CATALOG.find(item => item.path === path);
    if (!file) return Response.json({ success: false, error: 'Arquivo não encontrado no catálogo seguro.' }, { status: 404, headers: JSON_HEADERS });
    return Response.json({ success: true, file }, { headers: JSON_HEADERS });
  } catch (error: any) {
    return Response.json({ success: false, error: error?.message || 'Acesso negado.' }, { status: 403, headers: JSON_HEADERS });
  }
}

const tokens = (value: string) => [...new Set(value.toLowerCase().match(/[a-zà-ú0-9_-]{4,}/g) || [])];

function relevantContext(prompt: string, activePath: string) {
  const terms = tokens(`${prompt} ${activePath}`);
  return SOURCE_CATALOG
    .map(file => ({
      ...file,
      score: (file.path === activePath ? 100 : 0) + terms.reduce((score, term) => score + (file.path.toLowerCase().includes(term) ? 8 : 0) + (file.content.toLowerCase().includes(term) ? 1 : 0), 0),
    }))
    .filter(file => file.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 10)
    .map(file => `\n--- ${file.path} ---\n${file.content}`)
    .join('')
    .slice(0, 140_000);
}

function extractOutputText(payload: any): string {
  return String(payload.output_text || payload.output?.flatMap((item: any) => item.content || []).find((item: any) => item.type === 'output_text')?.text || '');
}

const SYSTEM_INSTRUCTION = 'Você é o assistente de desenvolvimento do RL Connect. Preserve arquitetura, Firebase, multiempresa e módulos existentes. Nunca invente dados, credenciais ou APIs. Analise o contexto e devolva JSON com message, revisedContent, affectedFiles, tests e warnings. revisedContent deve conter o arquivo ativo completo somente quando a solicitação exigir alterá-lo; caso contrário use null. Não publique nem afirme que executou alterações.';

function parseJsonResult(outputText: string) {
  if (!outputText) throw new Error('A IA retornou resposta vazia.');
  return JSON.parse(outputText.replace(/^```json\s*/i, '').replace(/```$/i, '').trim());
}

async function consultOpenAi(apiKey: string, userContent: string) {
  const model = process.env.OPENAI_DEVELOPER_MODEL || process.env.OPENAI_MODEL || 'gpt-5-mini';
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      store: false,
      max_output_tokens: 12000,
      input: [
        { role: 'system', content: SYSTEM_INSTRUCTION },
        { role: 'user', content: userContent },
      ],
      text: { format: { type: 'json_object' } },
    }),
    signal: AbortSignal.timeout(60000),
  });
  const raw = await response.text();
  if (!response.ok) {
    let providerMessage = '';
    try {
      providerMessage = String(JSON.parse(raw)?.error?.message || '').trim();
    } catch {
      // Nunca incluir a chave ou o conteúdo enviado na mensagem de erro.
    }
    const message = response.status === 429
      ? 'A OpenAI está sem saldo ou atingiu o limite da API.'
      : providerMessage || `OpenAI respondeu HTTP ${response.status}.`;
    throw new AiProviderError('openai', message.slice(0, 300), response.status);
  }
  const payload = JSON.parse(raw);
  return { result: parseJsonResult(extractOutputText(payload)), model: payload.model || model };
}

async function consultGemini(apiKey: string, userContent: string, tier: GeminiTier = 'free') {
  const completion = await callGeminiInteractions({
    apiKey,
    input: `${SYSTEM_INSTRUCTION}\n\n${userContent}`,
    tier,
    configuredModel: process.env.GEMINI_DEVELOPER_MODEL || process.env.GEMINI_MODEL,
  });
  return { result: parseJsonResult(completion.outputText), model: completion.model };
}

export async function POST(request: Request) {
  try {
    const access = await requireTechnicalAccess(request);
    const { uid } = access;
    const body: any = await request.json();
    if (body?.action === 'configure_api_key' || body?.action === 'configure_provider_key') {
      const provider: AiProvider = body?.provider === 'gemini' ? 'gemini' : 'openai';
      const submittedKey = normalizeSubmittedSecret(body?.apiKey);
      if (!submittedKey) {
        return Response.json({ success: false, error: 'Cole a chave completa antes de salvar.' }, { status: 400, headers: JSON_HEADERS });
      }
      if (provider === 'openai' && !/^sk-[A-Za-z0-9_-]{20,}$/.test(submittedKey)) {
        return Response.json({ success: false, error: 'A chave OpenAI informada não possui formato válido.' }, { status: 400, headers: JSON_HEADERS });
      }
      if (provider === 'gemini') await validateGeminiApiKey(submittedKey);
      await saveCredential(access, provider, submittedKey);
      console.info('[DEVELOPER AI KEY CONFIGURED]', JSON.stringify({ uid, provider, success: true }));
      return Response.json({ success: true, configured: true, provider }, { headers: JSON_HEADERS });
    }
    const prompt = String(body?.prompt || '').trim().slice(0, 6000);
    const activePath = String(body?.activePath || '').trim();
    const draftContent = String(body?.draftContent || '').slice(0, 180_000);
    if (!prompt) return Response.json({ success: false, error: 'Descreva a alteração desejada.' }, { status: 400, headers: JSON_HEADERS });
    if (!activePath || !SOURCE_CATALOG.some(file => file.path === activePath)) {
      return Response.json({ success: false, error: 'Selecione um arquivo do projeto.' }, { status: 400, headers: JSON_HEADERS });
    }

    const provider: AiProvider = body?.provider === 'gemini' ? 'gemini' : 'openai';
    const geminiTier: GeminiTier = body?.geminiTier === 'paid' ? 'paid' : 'free';
    const apiKey = await resolveApiKey(access, provider);
    if (!apiKey) return Response.json({ success: false, error: `Conecte sua chave da ${provider === 'openai' ? 'OpenAI' : 'Gemini'} antes de analisar.` }, { status: 503, headers: JSON_HEADERS });
    const context = relevantContext(prompt, activePath);
    const userContent = `PEDIDO:\n${prompt}\n\nARQUIVO ATIVO: ${activePath}\n\nRASCUNHO ATUAL:\n${draftContent}\n\nCONTEXTO DO PROJETO:\n${context}`;
    let effectiveProvider = provider;
    let fallbackMessage = '';
    let completion;
    try {
      completion = provider === 'gemini'
        ? await consultGemini(apiKey, userContent, geminiTier)
        : await consultOpenAi(apiKey, userContent);
    } catch (error: any) {
      const canFallbackToGemini = provider === 'openai' && error instanceof AiProviderError && error.status === 429;
      if (!canFallbackToGemini) throw error;
      const geminiKey = await resolveApiKey(access, 'gemini');
      if (!geminiKey) throw new Error('A OpenAI atingiu o limite. Conecte o Gemini gratuito para continuar sem a OpenAI.');
      completion = await consultGemini(geminiKey, userContent, 'free');
      effectiveProvider = 'gemini';
      fallbackMessage = 'A OpenAI atingiu o limite; a análise foi concluída automaticamente com o Gemini gratuito.';
    }
    console.info('[MASTER DEVELOPER AI]', JSON.stringify({ uid, activePath, provider: effectiveProvider, requestedProvider: provider, model: completion.model, fallbackUsed: effectiveProvider !== provider, success: true }));
    return Response.json({ success: true, result: completion.result, model: completion.model, provider: effectiveProvider, requestedProvider: provider, fallbackMessage }, { headers: JSON_HEADERS });
  } catch (error: any) {
    console.error('[MASTER DEVELOPER AI ERROR]', JSON.stringify({ message: String(error?.message || error).slice(0, 180) }));
    const status = String(error?.message || '').includes('MASTER') || String(error?.message || '').includes('Firebase') ? 403 : 500;
    return Response.json({ success: false, error: error?.message || 'Falha ao consultar a IA.' }, { status, headers: JSON_HEADERS });
  }
}
