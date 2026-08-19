import { aiErrorResponse, cleanText, generateJson, json, schema } from '../_gemini';

export async function POST(request: Request) {
  try {
    const body: any = await request.json().catch(() => ({}));
    const resumeText = cleanText(body?.resumeText);
    const jobTitle = cleanText(body?.jobTitle, 180);
    const requirements = Array.isArray(body?.jobRequirements)
      ? body.jobRequirements.map((item: any) => cleanText(item, 500)).filter(Boolean).slice(0, 80)
      : [];

    if (!resumeText || !jobTitle) {
      return json({ success: false, error: 'Currículo e vaga são obrigatórios para a análise.' }, 400);
    }

    const result = await generateJson(
      `Você é um Tech Recruiter Sênior. Avalie a aderência do currículo à vaga usando apenas evidências presentes no texto. Não invente experiência. Score de 0 a 100.\n\nVAGA: ${jobTitle}\nREQUISITOS: ${JSON.stringify(requirements)}\n\nCURRÍCULO:\n${resumeText}`,
      schema.object({
        score: schema.integer(),
        summary: schema.string(),
        pros: schema.arrayString(),
        cons: schema.arrayString(),
        parecer_ia: schema.string(),
        perguntas_sugeridas: schema.arrayString(),
        recomendacao: schema.string(),
        nome: schema.string(),
        email: schema.string(),
        telefone: schema.string(),
        cidade: schema.string(),
        estado: schema.string(),
        habilidades: schema.arrayString(),
      }, ['score', 'summary', 'pros', 'cons', 'parecer_ia', 'perguntas_sugeridas', 'recomendacao']),
    );

    return json({ success: true, provider: 'gemini', model: result.model, ...result.data });
  } catch (error) {
    return aiErrorResponse(error);
  }
}
