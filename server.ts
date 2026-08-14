import express from 'express';
import path from 'path';
import dotenv from 'dotenv';
import { GoogleGenAI, Type } from '@google/genai';
import { createServer as createViteServer } from 'vite';
import { googleWorkspaceConfigured, registerGoogleWorkspaceRoutes } from './server/googleWorkspaceRoutes.js';
import { registerPublicApplicationsRoutes } from './server/publicApplicationsRoutes.js';

dotenv.config();

const app = express();
app.disable('x-powered-by');
const PORT = Number(process.env.PORT || 3000);

app.use(express.json({ limit: '10mb' }));

// APIs are registered before Vite so OAuth callbacks and public application writes
// are never swallowed by the SPA. Public writes are validated by Firebase Admin.
registerGoogleWorkspaceRoutes(app);
registerPublicApplicationsRoutes(app);

// Initialize Gemini Client
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || '',
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

// Health check
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    version: '2.0.0-firebase',
    geminiConfigured: Boolean(process.env.GEMINI_API_KEY),
    firebaseProjectId: 'rl-connect-ed797',
    firebaseAdminConfigured: Boolean(process.env.FIREBASE_SERVICE_ACCOUNT_JSON),
    googleWorkspaceConfigured: googleWorkspaceConfigured(),
  });
});

// 1. AI Endpoint: Parse Resume / CV Text
app.post('/api/ai/parse-resume', async (req, res) => {
  try {
    const { resumeText, jobTitle } = req.body;
    if (!resumeText || typeof resumeText !== 'string') {
      res.status(400).json({ error: 'Texto do currículo não fornecido ou inválido.' });
      return;
    }

    if (!process.env.GEMINI_API_KEY) {
      res.json({
        nome: 'Candidato Analisado (Modo Offline)',
        email: 'candidato@exemplo.com.br',
        telefone: '(11) 99999-8888',
        cidade: 'São Paulo',
        estado: 'SP',
        cargo_desejado: jobTitle || 'Profissional',
        resumo: 'Currículo processado em modo local. Configure GEMINI_API_KEY para extração por IA.',
        skills: [],
        score: 0,
        parecer_ia: 'IA externa não configurada; encaminhe para revisão humana.',
        sugestoes_entrevista: [],
      });
      return;
    }

    const response = await ai.models.generateContent({
      model: 'gemini-3.6-flash',
      contents: `Você é um assistente de IA especialista em Recursos Humanos e ATS. Analise o currículo abaixo e extraia os dados estruturados. Se houver vaga ("${jobTitle || 'Geral'}"), avalie compatibilidade de 0 a 100.\n\nCURRÍCULO:\n"""\n${resumeText}\n"""`,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            nome: { type: Type.STRING },
            email: { type: Type.STRING },
            telefone: { type: Type.STRING },
            cidade: { type: Type.STRING },
            estado: { type: Type.STRING },
            cargo_desejado: { type: Type.STRING },
            resumo: { type: Type.STRING },
            skills: { type: Type.ARRAY, items: { type: Type.STRING } },
            score: { type: Type.INTEGER },
            parecer_ia: { type: Type.STRING },
            sugestoes_entrevista: { type: Type.ARRAY, items: { type: Type.STRING } },
          },
          required: ['nome', 'email', 'resumo', 'skills', 'score', 'parecer_ia'],
        },
      },
    });
    res.json(JSON.parse(response.text || '{}'));
  } catch (error) {
    console.error('Error in /api/ai/parse-resume:', error);
    res.status(500).json({ error: 'Erro ao analisar currículo com IA.', details: error instanceof Error ? error.message : String(error) });
  }
});

// 2. AI Endpoint: Evaluate Candidate Fit for a Specific Job
app.post('/api/ai/evaluate-candidate', async (req, res) => {
  try {
    const { resumeText, jobTitle, jobRequirements } = req.body;
    if (!resumeText || !jobTitle) {
      res.status(400).json({ error: 'Parâmetros resumeText e jobTitle são obrigatórios.' });
      return;
    }
    if (!process.env.GEMINI_API_KEY) {
      res.json({ score: 0, summary: 'IA externa não configurada.', pros: [], cons: ['Revisão humana necessária'], parecer_ia: 'REVISAR', perguntas_sugeridas: [], recomendacao: 'Revisar manualmente' });
      return;
    }
    const response = await ai.models.generateContent({
      model: 'gemini-3.6-flash',
      contents: `Avalie a compatibilidade do candidato com a vaga.\nVAGA: ${jobTitle}\nREQUISITOS: ${JSON.stringify(jobRequirements || [])}\nCURRÍCULO:\n${resumeText}`,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            score: { type: Type.INTEGER }, summary: { type: Type.STRING },
            pros: { type: Type.ARRAY, items: { type: Type.STRING } },
            cons: { type: Type.ARRAY, items: { type: Type.STRING } },
            parecer_ia: { type: Type.STRING },
            perguntas_sugeridas: { type: Type.ARRAY, items: { type: Type.STRING } },
            recomendacao: { type: Type.STRING },
          },
          required: ['score', 'summary', 'pros', 'cons', 'parecer_ia', 'perguntas_sugeridas'],
        },
      },
    });
    res.json(JSON.parse(response.text || '{}'));
  } catch (error) {
    console.error('Error in /api/ai/evaluate-candidate:', error);
    res.status(500).json({ error: 'Erro na avaliação com IA.', details: error instanceof Error ? error.message : String(error) });
  }
});

// 3. AI Endpoint: Generate Complete Job Description
app.post('/api/ai/generate-job-description', async (req, res) => {
  try {
    const { title, area, level, model } = req.body;
    if (!title) {
      res.status(400).json({ error: 'O título da vaga é obrigatório.' });
      return;
    }
    if (!process.env.GEMINI_API_KEY) {
      res.status(503).json({ error: 'IA externa não configurada no servidor.' });
      return;
    }
    const response = await ai.models.generateContent({
      model: 'gemini-3.6-flash',
      contents: `Gere uma descrição profissional de vaga em português do Brasil. Título: ${title}. Área: ${area || 'Geral'}. Nível: ${level || 'Não informado'}. Modelo: ${model || 'Não informado'}.`,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            descricao: { type: Type.STRING },
            requisitos: { type: Type.ARRAY, items: { type: Type.STRING } },
            diferenciais: { type: Type.ARRAY, items: { type: Type.STRING } },
            beneficios: { type: Type.ARRAY, items: { type: Type.STRING } },
            salario_sugerido_min: { type: Type.INTEGER }, salario_sugerido_max: { type: Type.INTEGER },
          },
          required: ['descricao', 'requisitos', 'beneficios'],
        },
      },
    });
    res.json(JSON.parse(response.text || '{}'));
  } catch (error) {
    console.error('Error in /api/ai/generate-job-description:', error);
    res.status(500).json({ error: 'Erro ao gerar descrição de vaga com IA.', details: error instanceof Error ? error.message : String(error) });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: 'spa' });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => { res.sendFile(path.join(distPath, 'index.html')); });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`RL CONNECT Firebase Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
