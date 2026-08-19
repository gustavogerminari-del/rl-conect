export type GeminiTier = 'free' | 'paid';

export class GeminiInteractionError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
    this.name = 'GeminiInteractionError';
  }
}

const modernModel = (value: unknown) => {
  const model = String(value || '').trim().replace(/^models\//, '');
  return /^gemini-3\./.test(model) ? model : '';
};

export function geminiInteractionCandidates(tier: GeminiTier, configuredModel?: string) {
  const configured = modernModel(configuredModel);
  const defaults = tier === 'free'
    ? ['gemini-3.1-flash-lite', 'gemini-3.6-flash', 'gemini-3.5-flash']
    : ['gemini-3.6-flash', 'gemini-3.5-flash', 'gemini-3.1-flash-lite'];
  return [...new Set([configured, ...defaults].filter(Boolean))];
}

export function interactionOutputText(payload: any) {
  if (payload?.output_text) return String(payload.output_text);
  const modelSteps = (Array.isArray(payload?.steps) ? payload.steps : [])
    .filter((step: any) => step?.type === 'model_output');
  return modelSteps
    .flatMap((step: any) => Array.isArray(step?.content) ? step.content : [])
    .filter((content: any) => content?.type === 'text')
    .map((content: any) => String(content?.text || ''))
    .join('');
}

function generateContentOutputText(payload: any) {
  return (Array.isArray(payload?.candidates) ? payload.candidates : [])
    .flatMap((candidate: any) => Array.isArray(candidate?.content?.parts) ? candidate.content.parts : [])
    .map((part: any) => String(part?.text || ''))
    .join('');
}

async function callGenerateContentFallback(options: {
  apiKey: string;
  input: string;
  models: string[];
  fetcher: typeof fetch;
}) {
  let lastError = new GeminiInteractionError('Nenhum modelo Gemini disponível.', 503);
  for (const model of options.models) {
    const response = await options.fetcher(`https://generativelanguage.googleapis.com/v1/models/${encodeURIComponent(model)}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': options.apiKey },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: options.input }] }],
        generationConfig: { responseMimeType: 'application/json', maxOutputTokens: 12000 },
      }),
      signal: AbortSignal.timeout(60000),
    });
    const raw = await response.text();
    if (response.ok) {
      const outputText = generateContentOutputText(JSON.parse(raw));
      if (!outputText) throw new GeminiInteractionError('Gemini retornou resposta vazia.', 502);
      return { outputText, model };
    }
    let message = '';
    try {
      message = String(JSON.parse(raw)?.error?.message || '').trim();
    } catch {
      // Nunca incluir chave ou conteúdo na mensagem de erro.
    }
    lastError = new GeminiInteractionError((message || `Gemini respondeu HTTP ${response.status}.`).slice(0, 300), response.status);
    if (response.status !== 400 && response.status !== 404) throw lastError;
  }
  throw lastError;
}

export async function callGeminiInteractions(options: {
  apiKey: string;
  input: string;
  tier?: GeminiTier;
  configuredModel?: string;
  fetcher?: typeof fetch;
}) {
  const fetcher = options.fetcher || fetch;
  const models = geminiInteractionCandidates(options.tier || 'free', options.configuredModel);
  let lastError = new GeminiInteractionError('Nenhum modelo Gemini disponível.', 503);

  for (const model of models) {
    const response = await fetcher('https://generativelanguage.googleapis.com/v1/interactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': options.apiKey },
      body: JSON.stringify({ model, store: false, input: options.input }),
      signal: AbortSignal.timeout(60000),
    });
    const raw = await response.text();
    if (response.ok) {
      const payload = JSON.parse(raw);
      const outputText = interactionOutputText(payload);
      if (!outputText) throw new GeminiInteractionError('Gemini retornou resposta vazia.', 502);
      return { outputText, model };
    }

    let googleMessage = '';
    try {
      googleMessage = String(JSON.parse(raw)?.error?.message || '').trim();
    } catch {
      // Resposta não JSON: informar somente o status, nunca a chave.
    }
    lastError = new GeminiInteractionError(
      (googleMessage || `Gemini respondeu HTTP ${response.status}.`).slice(0, 300),
      response.status,
    );
    if (response.status !== 400 && response.status !== 404) throw lastError;
  }
  if (lastError.status === 400 || lastError.status === 404) {
    return callGenerateContentFallback({ apiKey: options.apiKey, input: options.input, models, fetcher });
  }
  throw lastError;
}
