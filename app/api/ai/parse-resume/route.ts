import { aiErrorResponse, cleanText, generateJson, json, schema } from '../_gemini';

export async function POST(request: Request) {
  try {
    const body: any = await request.json().catch(() => ({}));
    const resumeText = cleanText(body?.resumeText);
    const jobTitle = cleanText(body?.jobTitle, 180);
    if (!resumeText) return json({ success: false, error: 'Texto do currículo não fornecido.' }, 400);

    const result = await generateJson(
      `Você é um assistente especialista em RH e ATS. Extraia os dados reais presentes no currículo abaixo. Não invente e-mail, telefone, cidade ou experiência que não estejam no texto. Se um campo não estiver disponível, devolva string vazia.\n\nVAGA DE REFERÊNCIA: ${jobTitle || 'Geral'}\n\nCURRÍCULO:\n${resumeText}`,
      schema.object({
        nome: schema.string(),
        email: schema.string(),
        telefone: schema.string(),
        cidade: schema.string(),
        estado: schema.string(),
        cargo_desejado: schema.string(),
        resumo: schema.string(),
        skills: schema.arrayString(),
        score: schema.integer(),
        parecer_ia: schema.string(),
        sugestoes_entrevista: schema.arrayString(),
      }, ['nome', 'email', 'resumo', 'skills', 'score', 'parecer_ia']),
    );

    return json({ success: true, provider: 'gemini', model: result.model, ...result.data });
  } catch (error) {
    return aiErrorResponse(error);
  }
}
