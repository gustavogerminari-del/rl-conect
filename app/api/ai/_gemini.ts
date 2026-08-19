import { GoogleGenAI, Type } from '@google/genai';

export const JSON_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
};

export function json(data: any, status = 200) {
  return Response.json(data, { status, headers: JSON_HEADERS });
}

function apiKey() {
  const value = String(process.env.GEMINI_API_KEY || '').trim();
  if (!value) throw new Error('GEMINI_API_KEY não está configurada no servidor.');
  return value;
}

export function geminiModel() {
  return String(process.env.GEMINI_MODEL || process.env.GEMINI_DEVELOPER_MODEL || 'gemini-3.6-flash').trim();
}

export async function generateJson(contents: string, responseSchema: any) {
  const ai = new GoogleGenAI({ apiKey: apiKey() });
  const model = geminiModel();
  const response = await ai.models.generateContent({
    model,
    contents,
    config: {
      responseMimeType: 'application/json',
      responseSchema,
    },
  });
  const raw = String(response.text || '').trim();
  if (!raw) throw new Error('Gemini retornou uma resposta vazia.');
  let parsed: any;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('Gemini respondeu fora do formato JSON esperado.');
  }
  return { data: parsed, model };
}

export const schema = {
  string: () => ({ type: Type.STRING }),
  integer: () => ({ type: Type.INTEGER }),
  arrayString: () => ({ type: Type.ARRAY, items: { type: Type.STRING } }),
  object: (properties: Record<string, any>, required: string[] = []) => ({ type: Type.OBJECT, properties, required }),
};

export function cleanText(value: unknown, max = 60_000) {
  return String(value || '').trim().slice(0, max);
}

export function aiErrorResponse(error: any) {
  const message = String(error?.message || 'Falha ao processar a solicitação com Gemini.');
  const status = /GEMINI_API_KEY|não está configurada/i.test(message) ? 503 : 500;
  return json({ success: false, error: message }, status);
}
