export function normalizeSubmittedSecret(value: unknown) {
  return String(value || '')
    .replace(/[\s\u200B-\u200D\u2060\uFEFF]+/g, '')
    .replace(/^[`'\"]+|[`'\"]+$/g, '');
}

export async function validateGeminiApiKey(apiKey: string, fetcher: typeof fetch = fetch) {
  const response = await fetcher('https://generativelanguage.googleapis.com/v1beta/models?pageSize=1', {
    headers: { 'x-goog-api-key': apiKey },
    signal: AbortSignal.timeout(15000),
  });
  if (response.ok) return;

  let googleMessage = '';
  try {
    const payload: any = await response.json();
    googleMessage = String(payload?.error?.message || '').trim();
  } catch {
    // A resposta do Google pode não conter JSON; nunca registrar ou devolver a chave.
  }
  const reason = response.status === 401 || response.status === 403
    ? 'O Google recusou esta chave. Confirme se ela pertence ao Gemini API e copie novamente pelo botão de copiar.'
    : googleMessage || `O Google não conseguiu validar a chave agora (HTTP ${response.status}).`;
  throw new Error(reason.slice(0, 300));
}

export type GeminiModel = {
  name: string;
  supportedGenerationMethods?: string[];
};

const preferredGeminiModels = [
  'gemini-3.6-flash',
  'gemini-3.5-flash',
  'gemini-3.1-flash-lite',
];

const normalizeModelName = (value: unknown) => String(value || '').trim().replace(/^models\//, '');

export async function resolveGeminiModel(
  apiKey: string,
  configuredModel?: string,
  fetcher: typeof fetch = fetch,
) {
  const response = await fetcher('https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000', {
    headers: { 'x-goog-api-key': apiKey },
    signal: AbortSignal.timeout(15000),
  });

  let payload: any = null;
  try {
    payload = await response.json();
  } catch {
    // Tratado abaixo sem expor a chave.
  }
  if (!response.ok) {
    const googleMessage = String(payload?.error?.message || '').trim();
    throw new Error((googleMessage || `Não foi possível consultar os modelos Gemini (HTTP ${response.status}).`).slice(0, 300));
  }

  const available = (Array.isArray(payload?.models) ? payload.models : [])
    .filter((model: GeminiModel) => model?.name && model.supportedGenerationMethods?.includes('generateContent'));
  if (!available.length) {
    throw new Error('Esta chave Google não possui nenhum modelo Gemini habilitado para geração de conteúdo.');
  }

  const requested = normalizeModelName(configuredModel);
  const order = [...new Set([requested, ...preferredGeminiModels].filter(Boolean))];
  for (const candidate of order) {
    const match = available.find((model: GeminiModel) => normalizeModelName(model.name) === candidate);
    if (match) return String(match.name);
  }
  return String(available[0].name);
}
