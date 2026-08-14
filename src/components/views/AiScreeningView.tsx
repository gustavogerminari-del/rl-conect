import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, FileText, HelpCircle, Sparkles, Zap } from 'lucide-react';
import { dataService } from '../../services/dataService';

export const AiScreeningView: React.FC = () => {
  const vagas = dataService.getVagas();
  const candidaturas = dataService.getCandidaturas();
  const candidatos = dataService.getCandidatos();
  const [selectedVagaId, setSelectedVagaId] = useState(vagas[0]?.id || '');
  const applicationsForJob = useMemo(() => candidaturas.filter(c => c.vaga_id === selectedVagaId), [candidaturas, selectedVagaId]);
  const [selectedCandidaturaId, setSelectedCandidaturaId] = useState(applicationsForJob[0]?.id || '');
  const selectedApplication = candidaturas.find(c => c.id === selectedCandidaturaId);
  const selectedCandidate = candidatos.find(c => c.id === selectedApplication?.candidato_id);
  const selectedVaga = vagas.find(v => v.id === selectedVagaId);
  const [resumeTextInput, setResumeTextInput] = useState(selectedCandidate?.curriculo_texto || '');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<any>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const first = applicationsForJob[0];
    setSelectedCandidaturaId(first?.id || '');
  }, [selectedVagaId]);

  useEffect(() => {
    setResumeTextInput(selectedCandidate?.curriculo_texto || '');
    setAnalysisResult(null);
  }, [selectedCandidaturaId, selectedCandidate?.id]);

  const handleRunAiScreening = async () => {
    if (!selectedApplication || !selectedCandidate || !resumeTextInput.trim()) {
      setError('Selecione uma candidatura com currículo para executar a triagem.');
      return;
    }
    setError('');
    setIsAnalyzing(true);
    setAnalysisResult(null);
    try {
      const res = await fetch('/api/ai/evaluate-candidate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resumeText: resumeTextInput,
          jobTitle: selectedVaga?.titulo || 'Vaga',
          jobRequirements: selectedVaga?.requisitos || [],
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Falha na triagem por IA.');
      setAnalysisResult(data);
      dataService.updateCandidaturaPareceres(
        selectedApplication.id,
        undefined,
        data.parecer_ia || data.summary || '',
        Number.isFinite(Number(data.score)) ? Number(data.score) : undefined,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha na triagem por IA.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-6 text-white shadow-xl">
        <div className="flex items-center gap-4"><div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-400 text-slate-950"><Sparkles className="h-6 w-6" /></div><div><h1 className="text-xl font-extrabold">Centro de Triagem & IA</h1><p className="mt-0.5 text-xs text-indigo-200">A IA atualiza a candidatura real. Nenhum candidato artificial é criado.</p></div></div>
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
          <h2 className="flex items-center gap-2 font-bold text-slate-900"><FileText className="h-5 w-5 text-indigo-600" />Currículo da candidatura</h2>
          <div><label className="text-xs font-bold text-slate-700">Vaga</label><select value={selectedVagaId} onChange={e => setSelectedVagaId(e.target.value)} className="mt-1 w-full rounded-xl border p-2.5 text-xs">{vagas.map(v => <option key={v.id} value={v.id}>{v.titulo}</option>)}</select></div>
          <div><label className="text-xs font-bold text-slate-700">Candidato / candidatura</label><select value={selectedCandidaturaId} onChange={e => setSelectedCandidaturaId(e.target.value)} className="mt-1 w-full rounded-xl border p-2.5 text-xs"><option value="">Selecione</option>{applicationsForJob.map(app => { const cand = candidatos.find(c => c.id === app.candidato_id); return <option key={app.id} value={app.id}>{cand?.nome || app.candidato_id}</option>; })}</select></div>
          <textarea rows={10} value={resumeTextInput} onChange={e => setResumeTextInput(e.target.value)} className="w-full rounded-xl border p-3 text-xs" placeholder="Currículo do candidato" />
          {error && <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-bold text-rose-700">{error}</div>}
          <button onClick={() => void handleRunAiScreening()} disabled={isAnalyzing || !selectedApplication || !resumeTextInput.trim()} className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 py-3 text-xs font-bold text-white disabled:opacity-50"><Zap className="h-4 w-4" />{isAnalyzing ? 'Analisando...' : 'Executar análise e salvar na candidatura'}</button>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
          <h2 className="flex items-center gap-2 font-bold text-slate-900"><Sparkles className="h-5 w-5 text-amber-500" />Parecer da IA</h2>
          {!analysisResult && <div className="rounded-xl border border-dashed p-8 text-center text-xs text-slate-400">Selecione uma candidatura e execute a análise.</div>}
          {analysisResult && <div className="space-y-4 text-xs"><div className="rounded-xl bg-slate-900 p-4 text-white"><div className="text-2xl font-black">{analysisResult.score ?? '-'}% Compatibility</div><div className="mt-1 text-indigo-200">{analysisResult.recomendacao || 'Analisado'}</div></div><div className="rounded-xl bg-slate-50 p-4"><strong>Resumo:</strong> {analysisResult.summary || analysisResult.parecer_ia}</div><div className="grid gap-3 sm:grid-cols-2"><div className="rounded-xl bg-emerald-50 p-3"><div className="mb-2 flex items-center gap-1 font-bold"><CheckCircle2 className="h-4 w-4" />Pontos fortes</div>{analysisResult.pros?.map((x:string,i:number)=><div key={i}>• {x}</div>)}</div><div className="rounded-xl bg-amber-50 p-3"><div className="mb-2 flex items-center gap-1 font-bold"><AlertTriangle className="h-4 w-4" />Atenção</div>{analysisResult.cons?.map((x:string,i:number)=><div key={i}>• {x}</div>)}</div></div>{analysisResult.perguntas_sugeridas && <div><div className="mb-2 flex items-center gap-1 font-bold"><HelpCircle className="h-4 w-4" />Perguntas sugeridas</div>{analysisResult.perguntas_sugeridas.map((x:string,i:number)=><div key={i} className="mb-1 rounded-lg bg-indigo-50 p-2">{x}</div>)}</div>}</div>}
        </div>
      </div>
    </div>
  );
};
