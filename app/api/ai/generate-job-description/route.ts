import { aiErrorResponse, cleanText, generateJson, json, schema } from '../_gemini';

export async function POST(request: Request) {
  try {
    const body: any = await request.json().catch(() => ({}));
    const title = cleanText(body?.title, 180);
    const area = cleanText(body?.area, 180);
    const level = cleanText(body?.level, 100);
    const model = cleanText(body?.model, 100);
    if (!title) return json({ success: false, error: 'O título da vaga é obrigatório.' }, 400);

    const result = await generateJson(
      `Crie uma descrição profissional de vaga em português do Brasil, objetiva e inclusiva. Não invente exigências legais ou benefícios que não sejam apresentados como sugestões.\n\nTítulo: ${title}\nÁrea: ${area || 'Geral'}\nSenioridade: ${level || 'Não informada'}\nModelo de trabalho: ${model || 'Não informado'}`,
      schema.object({
        descricao: schema.string(),
        requisitos: schema.arrayString(),
        diferenciais: schema.arrayString(),
        beneficios: schema.arrayString(),
        salario_sugerido_min: schema.integer(),
        salario_sugerido_max: schema.integer(),
      }, ['descricao', 'requisitos', 'diferenciais', 'beneficios']),
    );

    return json({ success: true, provider: 'gemini', model: result.model, ...result.data });
  } catch (error) {
    return aiErrorResponse(error);
  }
}
