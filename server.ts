import express from 'express';
import path from 'path';
import dotenv from 'dotenv';
import { GoogleGenAI, Type } from '@google/genai';
import { createServer as createViteServer } from 'vite';
import { googleWorkspaceConfigured, registerGoogleWorkspaceRoutes } from './server/googleWorkspaceRoutes.js';

dotenv.config();

const app = express();
app.disable('x-powered-by');
const PORT = Number(process.env.PORT || 3000);

app.use(express.json({ limit: '10mb' }));

// Google OAuth/Calendar/Meet routes are registered before Vite so callbacks are never swallowed by the SPA.
registerGoogleWorkspaceRoutes(app);

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
    version: '2.0.0',
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
      // Fallback response if API key is not yet set
      res.json({
        nome: 'Candidato Analisado (Modo Offline)',
        email: 'candidato@exemplo.com.br',
        telefone: '(11) 99999-8888',
        cidade: 'São Paulo',
        estado: 'SP',
        cargo_desejado: jobTitle || 'Profissional de TI',
        resumo: 'Currículo processado em modo local. Adicione sua chave GEMINI_API_KEY nos Secrets para extração completa por IA.',
        skills: ['JavaScript', 'TypeScript', 'Gestão'],
        score: 82,
        parecer_ia: 'Perfil compatível com os requisitos gerais. Recomenda-se avançar para entrevista.',
        sugestoes_entrevista: [
          'Descreva seus últimos projetos relevantes.',
          'Como você lida com prazos apertados?',
        ],
      });
      return;
    }

    const response = await ai.models.generateContent({
      model: 'gemini-3.6-flash',
      contents: `Você é um assistente de IA especialista em Recursos Humanos e ATS (Applicant Tracking System).
Análise o seguinte currículo em texto e extraia as informações estruturadas em formato JSON.
Se houver uma vaga mencionada ("${jobTitle || 'Geral'}"), avalie a compatibilidade em score de 0 a 100.

TEXTO DO CURRÍCULO:
"""
${resumeText}
"""`,
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
            skills: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
            score: { type: Type.INTEGER },
            parecer_ia: { type: Type.STRING },
            sugestoes_entrevista: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
          },
          required: ['nome', 'email', 'resumo', 'skills', 'score', 'parecer_ia'],
        },
      },
    });

    const parsedData = JSON.parse(response.text || '{}');
    res.json(parsedData);
  } catch (error) {
    console.error('Error in /api/ai/parse-resume:', error);
    res.status(500).json({
      error: 'Erro ao analisar currículo com Gemini IA.',
      details: error instanceof Error ? error.message : String(error),
    });
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
      res.json({
        score: 88,
        summary: 'Candidato apresenta excelente aderência aos requisitos principais da vaga.',
        pros: ['Forte bagagem técnica', 'Experiência relevante no setor'],
        cons: ['Disponibilidade imediata precisa ser confirmada'],
        parecer_ia: 'Aprovação recomendada para próxima etapa de entrevista técnica.',
        perguntas_sugeridas: [
          'Qual foi o maior desafio técnico em sua função anterior?',
          'Como você organiza suas prioridades em projetos ágeis?',
        ],
        recomendacao: 'Fortemente Recomendado',
      });
      return;
    }

    const response = await ai.models.generateContent({
      model: 'gemini-3.6-flash',
      contents: `Você é um Tech Recruiter Senior. Avalie detalhadamente a compatibilidade entre o candidato e a vaga.

VAGA:
Título: ${jobTitle}
Requisitos Exigidos: ${JSON.stringify(jobRequirements || [])}

CURRÍCULO DO CANDIDATO:
"""
${resumeText}
"""

Forneça um score de 0 a 100, um resumo de match, pontos fortes (pros), pontos de atenção (cons), o parecer da IA para o RH e 3 perguntas sugeridas para a entrevista.`,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            score: { type: Type.INTEGER },
            summary: { type: Type.STRING },
            pros: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
            cons: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
            parecer_ia: { type: Type.STRING },
            perguntas_sugeridas: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
            recomendacao: { type: Type.STRING },
          },
          required: ['score', 'summary', 'pros', 'cons', 'parecer_ia', 'perguntas_sugeridas'],
        },
      },
    });

    const evalData = JSON.parse(response.text || '{}');
    res.json(evalData);
  } catch (error) {
    console.error('Error in /api/ai/evaluate-candidate:', error);
    res.status(500).json({
      error: 'Erro na avaliação com Gemini IA.',
      details: error instanceof Error ? error.message : String(error),
    });
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
      res.json({
        descricao: `Buscamos um profissional qualificado para a posição de ${title} no departamento de ${area || 'Geral'}. Atuação em modelo ${model || 'Híbrido'}.`,
        requisitos: [
          `3+ anos de experiência na função de ${title}`,
          'Boa comunicação e capacidade de resolução de problemas',
          'Domínio das ferramentas e tecnologias de mercado',
        ],
        diferenciais: ['Inglês avançado', 'Certificações na área'],
        beneficios: ['Vale Refeição', 'Plano de Saúde', 'Auxílio Educação'],
        salario_sugerido_min: 8000,
        salario_sugerido_max: 12000,
      });
      return;
    }

    const response = await ai.models.generateContent({
      model: 'gemini-3.6-flash',
      contents: `Gere uma descrição profissional completa de vaga de emprego em português do Brasil.

Dados da vaga:
- Título: ${title}
- Área/Departamento: ${area || 'Tecnologia/Geral'}
- Nível de Senioridade: ${level || 'Pleno/Senior'}
- Modelo de Trabalho: ${model || 'Híbrido'}

Gere um JSON com: descricao, requisitos (array), diferenciais (array), beneficios (array) e faixa salarial média estimada no mercado brasileiro (salario_sugerido_min, salario_sugerido_max).`,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            descricao: { type: Type.STRING },
            requisitos: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
            diferenciais: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
            beneficios: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
            salario_sugerido_min: { type: Type.INTEGER },
            salario_sugerido_max: { type: Type.INTEGER },
          },
          required: ['descricao', 'requisitos', 'beneficios'],
        },
      },
    });

    const jobData = JSON.parse(response.text || '{}');
    res.json(jobData);
  } catch (error) {
    console.error('Error in /api/ai/generate-job-description:', error);
    res.status(500).json({
      error: 'Erro ao gerar descrição de vaga com Gemini IA.',
      details: error instanceof Error ? error.message : String(error),
    });
  }
});

async function startServer() {
  // Vite integration
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`RL CONNECT 2.0 Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
