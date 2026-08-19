import React, { useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  FileText,
  HelpCircle,
  Sparkles,
  Zap,
} from 'lucide-react';
import { dataService } from '../../services/dataService';

export const AiScreeningView: React.FC = () => {
  const vagas = dataService.getVagas();
  const [selectedVagaId, setSelectedVagaId] = useState<string>(vagas[0]?.id || '');
  const [resumeTextInput, setResumeTextInput] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<any>(null);
  const [error, setError] = useState('');
  const [savedCandidateMessage, setSavedCandidateMessage] = useState('');

  const selectedVaga = vagas.find((v) => v.id === selectedVagaId);

  const handleRunAiScreening = async () => {
    if (!resumeTextInput.trim()) return;

    setIsAnalyzing(true);
    setAnalysisResult(null);
    setError('');
    setSavedCandidateMessage('');

    try {
      const res = await fetch('/api/ai/evaluate-candidate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resumeText: resumeTextInput,
          jobTitle: selectedVaga?.titulo || 'Vaga não informada',
          jobRequirements: selectedVaga?.requisitos || [],
        }),
      });

      const data: any = await res.json().catch(() => ({}));
      if (!res.ok || data?.success === false) {
        throw new Error(data?.error || `A API de IA respondeu HTTP ${res.status}.`);
      }
      if (!Number.isFinite(Number(data?.score))) {
        throw new Error('A IA respondeu sem um score válido. Tente novamente.');
      }
      setAnalysisResult(data);

      const nome = String(data.nome || '').trim();
      const email = String(data.email || '').trim().toLowerCase();
      if (nome && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        dataService.createCandidato({
          nome,
          email,
          telefone: String(data.telefone || '').trim(),
          cidade: String(data.cidade || '').trim(),
          estado: String(data.estado || '').trim(),
          cargo_desejado: selectedVaga?.titulo || 'Não informado',
          curriculo_texto: resumeTextInput,
          resumo_ia: data.summary || data.parecer_ia || '',
          score_ia: Number(data.score),
          tags: ['IA Gemini', 'Triagem Automática'],
          habilidades: Array.isArray(data.habilidades) ? data.habilidades : [],
          origem: 'manual',
        });
        setSavedCandidateMessage(`Candidato ${nome} atualizado/cadastrado no Banco de Talentos.`);
      } else {
        setSavedCandidateMessage('Análise concluída. O candidato não foi cadastrado automaticamente porque nome/e-mail não puderam ser confirmados no currículo.');
      }
    } catch (err: any) {
      console.error('Error running AI screening:', err);
      setError(String(err?.message || 'Não foi possível executar a triagem com IA.'));
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-6 text-white shadow-xl sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-400 text-slate-950 shadow-lg shadow-amber-400/20">
            <Sparkles className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold tracking-tight">Centro de Triagem & IA Gemini</h1>
            <p className="mt-0.5 text-xs text-indigo-200">
              Análise real via API Gemini, sem resultado fictício quando a integração estiver indisponível.
            </p>
          </div>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-xs font-semibold text-red-800">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {savedCandidateMessage && (
        <div className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-xs font-semibold text-emerald-800">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{savedCandidateMessage}</span>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="flex items-center gap-2 text-base font-bold text-slate-900">
            <FileText className="h-5 w-5 text-indigo-600" />
            Inserir Currículo para Análise
          </h2>

          <div>
            <label className="text-xs font-bold text-slate-700">Selecione a Vaga para Match</label>
            <select
              value={selectedVagaId}
              onChange={(e) => setSelectedVagaId(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs font-bold text-slate-800 focus:border-indigo-500 focus:outline-none"
            >
              {vagas.map((v) => (
                <option key={v.id} value={v.id}>{v.titulo} ({v.cidade})</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700">Cole o Texto do Currículo / CV</label>
            <textarea
              rows={10}
              value={resumeTextInput}
              onChange={(e) => setResumeTextInput(e.target.value)}
              placeholder="Cole aqui o texto real do currículo do candidato..."
              className="mt-1 w-full rounded-xl border border-slate-200 p-3 text-xs focus:border-indigo-500 focus:outline-none"
            />
          </div>

          <button
            onClick={handleRunAiScreening}
            disabled={isAnalyzing || !resumeTextInput.trim() || !selectedVaga}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 py-3 text-xs font-bold text-white shadow-md shadow-indigo-600/20 transition hover:bg-indigo-700 disabled:opacity-50"
          >
            <Zap className="h-4 w-4 text-amber-400" />
            {isAnalyzing ? 'Processando com Gemini...' : 'Executar Análise & Match de IA'}
          </button>
        </div>

        <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="flex items-center gap-2 text-base font-bold text-slate-900">
            <Sparkles className="h-5 w-5 text-amber-500" />
            Parecer & Diagnóstico da IA
          </h2>

          {!analysisResult && !isAnalyzing && (
            <div className="flex h-64 flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 p-6 text-center text-xs text-slate-400">
              <Sparkles className="mb-2 h-8 w-8 text-slate-300" />
              <p>Selecione uma vaga, cole o currículo e execute a análise. Se a API estiver sem chave ou indisponível, o erro será mostrado aqui.</p>
            </div>
          )}

          {isAnalyzing && (
            <div className="flex h-64 flex-col items-center justify-center text-center text-xs text-indigo-600">
              <Sparkles className="mb-3 h-10 w-10 animate-spin text-amber-400" />
              <p className="font-bold">Consultando a API Gemini e calculando o match...</p>
            </div>
          )}

          {analysisResult && (
            <div className="space-y-4 text-xs">
              <div className="flex items-center justify-between rounded-xl bg-slate-900 p-4 text-white">
                <div>
                  <span className="text-[10px] font-bold uppercase text-indigo-300">Score de Aderência IA</span>
                  <div className="text-2xl font-black">{Number(analysisResult.score)}% compatibilidade</div>
                  <div className="mt-1 text-[10px] text-slate-300">
                    {analysisResult.provider || 'IA'} {analysisResult.model ? `• ${analysisResult.model}` : ''}
                  </div>
                </div>
                <span className="rounded-full bg-amber-400 px-3 py-1 text-xs font-bold text-slate-950">
                  {analysisResult.recomendacao || 'Sem classificação'}
                </span>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <h3 className="mb-1 font-bold text-slate-900">Resumo do Match</h3>
                <p className="leading-relaxed text-slate-600">{analysisResult.summary || analysisResult.parecer_ia}</p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-emerald-100 bg-emerald-50/80 p-3">
                  <h4 className="mb-2 flex items-center gap-1 text-xs font-bold text-emerald-950">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" /> Pontos Fortes
                  </h4>
                  <ul className="space-y-1 text-[11px] text-emerald-900">
                    {(analysisResult.pros || []).map((item: string, index: number) => <li key={index}>• {item}</li>)}
                  </ul>
                </div>

                <div className="rounded-xl border border-amber-100 bg-amber-50/80 p-3">
                  <h4 className="mb-2 flex items-center gap-1 text-xs font-bold text-amber-950">
                    <AlertTriangle className="h-4 w-4 text-amber-600" /> Pontos de Atenção
                  </h4>
                  <ul className="space-y-1 text-[11px] text-amber-900">
                    {(analysisResult.cons || []).map((item: string, index: number) => <li key={index}>• {item}</li>)}
                  </ul>
                </div>
              </div>

              {Array.isArray(analysisResult.perguntas_sugeridas) && analysisResult.perguntas_sugeridas.length > 0 && (
                <div className="space-y-2">
                  <h3 className="flex items-center gap-1.5 text-xs font-bold text-slate-900">
                    <HelpCircle className="h-4 w-4 text-indigo-600" />
                    Perguntas Recomendadas para o Entrevistador
                  </h3>
                  <div className="space-y-1.5">
                    {analysisResult.perguntas_sugeridas.map((question: string, index: number) => (
                      <div key={index} className="rounded-lg bg-indigo-50 p-2.5 font-medium text-indigo-950">{question}</div>
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
