import React, { useState } from 'react';
import {
  Sparkles,
  FileText,
  UserCheck,
  CheckCircle2,
  AlertTriangle,
  Send,
  HelpCircle,
  Briefcase,
  Star,
  Zap,
} from 'lucide-react';
import { dataService } from '../../services/dataService';

export const AiScreeningView: React.FC = () => {
  const vagas = dataService.getVagas();
  const [selectedVagaId, setSelectedVagaId] = useState<string>(vagas[0]?.id || '');
  const [resumeTextInput, setResumeTextInput] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<any>(null);

  const selectedVaga = vagas.find((v) => v.id === selectedVagaId);

  const handleRunAiScreening = async () => {
    if (!resumeTextInput) return;

    setIsAnalyzing(true);
    setAnalysisResult(null);

    try {
      const res = await fetch('/api/ai/evaluate-candidate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resumeText: resumeTextInput,
          jobTitle: selectedVaga?.titulo || 'Vaga de Tecnologia',
          jobRequirements: selectedVaga?.requisitos || [],
        }),
      });

      const data = await res.json();
      setAnalysisResult(data);

      // Save to candidate database
      dataService.createCandidato({
        nome: 'Candidato Analisado por IA',
        email: `ia.candidate.${Date.now()}@exemplo.com.br`,
        telefone: '(11) 98888-7777',
        cidade: 'São Paulo',
        estado: 'SP',
        cargo_desejado: selectedVaga?.titulo || 'Profissional TI',
        curriculo_texto: resumeTextInput,
        resumo_ia: data.summary || data.parecer_ia,
        score_ia: data.score || 85,
        tags: ['IA Gemini', 'Triagem Automática'],
        habilidades: ['Analisado por IA'],
      });
    } catch (err) {
      console.error('Error running AI screening:', err);
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Banner */}
      <div className="flex flex-col gap-4 rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-6 text-white shadow-xl sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-400 text-slate-950 shadow-lg shadow-amber-400/20">
            <Sparkles className="h-6 w-6 font-bold" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold tracking-tight">Centro de Triagem & IA Gemini</h1>
            <p className="mt-0.5 text-xs text-indigo-200">
              Extração automática de currículos, pontuação de compatibilidade, ranking e sugestões de entrevista.
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left Column: Input Form */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
          <h2 className="font-bold text-slate-900 text-base flex items-center gap-2">
            <FileText className="h-5 w-5 text-indigo-600" />
            Inserir Currículo para Análise
          </h2>

          <div>
            <label className="font-bold text-slate-700 text-xs">Selecione a Vaga para Match</label>
            <select
              value={selectedVagaId}
              onChange={(e) => setSelectedVagaId(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs font-bold text-slate-800 focus:border-indigo-500 focus:outline-none"
            >
              {vagas.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.titulo} ({v.cidade})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="font-bold text-slate-700 text-xs">Cole o Texto do Currículo / CV</label>
            <textarea
              rows={10}
              value={resumeTextInput}
              onChange={(e) => setResumeTextInput(e.target.value)}
              placeholder="Cole aqui o texto do currículo do candidato (Experiências, Tecnologias, Formação)..."
              className="mt-1 w-full rounded-xl border border-slate-200 p-3 text-xs focus:border-indigo-500 focus:outline-none"
            />
          </div>

          <button
            onClick={handleRunAiScreening}
            disabled={isAnalyzing || !resumeTextInput}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 py-3 text-xs font-bold text-white transition hover:bg-indigo-700 shadow-md shadow-indigo-600/20 disabled:opacity-50"
          >
            <Zap className="h-4 w-4 text-amber-400" />
            {isAnalyzing ? 'Processando com IA Gemini...' : 'Executar Análise & Match de IA'}
          </button>
        </div>

        {/* Right Column: AI Output */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
          <h2 className="font-bold text-slate-900 text-base flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-amber-500" />
            Parecer & Diagnóstico da IA
          </h2>

          {!analysisResult && !isAnalyzing && (
            <div className="flex h-64 flex-col items-center justify-center text-center text-slate-400 text-xs border border-dashed border-slate-200 rounded-xl p-6">
              <Sparkles className="h-8 w-8 text-slate-300 mb-2" />
              <p>Selecione uma vaga, cole o currículo ao lado e clique em Executar Análise para obter o parecer da IA.</p>
            </div>
          )}

          {isAnalyzing && (
            <div className="flex h-64 flex-col items-center justify-center text-center text-indigo-600 text-xs">
              <Sparkles className="h-10 w-10 animate-spin text-amber-400 mb-3" />
              <p className="font-bold">Analisando currículo e calculando match com a vaga...</p>
            </div>
          )}

          {analysisResult && (
            <div className="space-y-4 text-xs">
              {/* Score Header */}
              <div className="flex items-center justify-between rounded-xl bg-slate-900 p-4 text-white">
                <div>
                  <span className="text-[10px] font-bold uppercase text-indigo-300">Score de Adjetivação IA</span>
                  <div className="text-2xl font-black">{analysisResult.score}% Compatibility</div>
                </div>
                <span className="rounded-full bg-amber-400 px-3 py-1 font-bold text-slate-950 text-xs">
                  {analysisResult.recomendacao || 'Recomendado'}
                </span>
              </div>

              {/* Summary */}
              <div className="rounded-xl bg-slate-50 p-4 border border-slate-200">
                <h3 className="font-bold text-slate-900 mb-1">Resumo do Match</h3>
                <p className="text-slate-600 leading-relaxed">{analysisResult.summary || analysisResult.parecer_ia}</p>
              </div>

              {/* Pros & Cons */}
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl bg-emerald-50/80 p-3 border border-emerald-100">
                  <h4 className="font-bold text-emerald-950 text-xs mb-2 flex items-center gap-1">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" /> Pontos Fortes
                  </h4>
                  <ul className="space-y-1 text-emerald-900 text-[11px]">
                    {analysisResult.pros?.map((p: string, i: number) => (
                      <li key={i}>• {p}</li>
                    ))}
                  </ul>
                </div>

                <div className="rounded-xl bg-amber-50/80 p-3 border border-amber-100">
                  <h4 className="font-bold text-amber-950 text-xs mb-2 flex items-center gap-1">
                    <AlertTriangle className="h-4 w-4 text-amber-600" /> Pontos de Atenção
                  </h4>
                  <ul className="space-y-1 text-amber-900 text-[11px]">
                    {analysisResult.cons?.map((c: string, i: number) => (
                      <li key={i}>• {c}</li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Suggested Questions */}
              {analysisResult.perguntas_sugeridas && (
                <div className="space-y-2">
                  <h3 className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                    <HelpCircle className="h-4 w-4 text-indigo-600" />
                    Perguntas Recomendadas para o Entrevistador
                  </h3>
                  <div className="space-y-1.5">
                    {analysisResult.perguntas_sugeridas.map((q: string, i: number) => (
                      <div key={i} className="rounded-lg bg-indigo-50 p-2.5 text-indigo-950 font-medium">
                        {q}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
