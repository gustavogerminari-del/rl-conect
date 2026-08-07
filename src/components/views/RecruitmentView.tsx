import React, { useState } from 'react';
import {
  Briefcase,
  Plus,
  Search,
  Sparkles,
  Users,
  Copy,
  CheckCircle2,
  XCircle,
  Clock,
  Calendar,
  FileText,
  UserCheck,
  ChevronRight,
  ChevronLeft,
  X,
  Building2,
  Tag,
  Star,
  Send,
  MessageSquare,
} from 'lucide-react';
import { dataService } from '../../services/dataService';
import { Vaga, Candidatura, EtapaPipelineNome, Candidato } from '../../types';

export const RecruitmentView: React.FC = () => {
  const [vagas, setVagas] = useState(dataService.getVagas('recrutamento'));
  const [selectedVagaId, setSelectedVagaId] = useState<string>(vagas[0]?.id || '');
  const [activeTab, setActiveTab] = useState<'pipeline' | 'vagas' | 'talentos'>('pipeline');
  const [searchTerm, setSearchTerm] = useState('');

  // Modals
  const [showCreateVagaModal, setShowCreateVagaModal] = useState(false);
  const [showCandidatosListModal, setShowCandidatosListModal] = useState(false);
  const [selectedCandidatura, setSelectedCandidatura] = useState<(Candidatura & { candidato: Candidato }) | null>(null);

  // Form State for Vaga Creation
  const [tituloVaga, setTituloVaga] = useState('');
  const [departamentoVaga, setDepartamentoVaga] = useState('Engenharia de Software');
  const [modeloTrabalho, setModeloTrabalho] = useState<'Presencial' | 'Hibrido' | 'Remoto'>('Hibrido');
  const [salarioMin, setSalarioMin] = useState(8000);
  const [salarioMax, setSalarioMax] = useState(12000);
  const [descricaoVaga, setDescricaoVaga] = useState('');
  const [requisitosVaga, setRequisitosVaga] = useState('');
  const [isAiGenerating, setIsAiGenerating] = useState(false);

  // Parecer RH state inside Drawer
  const [parecerRhInput, setParecerRhInput] = useState('');

  const refreshData = () => {
    const updatedVagas = dataService.getVagas('recrutamento');
    setVagas(updatedVagas);
    if (!selectedVagaId && updatedVagas.length > 0) {
      setSelectedVagaId(updatedVagas[0].id);
    }
  };

  const selectedVaga = vagas.find((v) => v.id === selectedVagaId) || vagas[0];

  const candidaturasVaga = selectedVaga
    ? dataService.getCandidaturasByVaga(selectedVaga.id)
    : [];

  const pipelineEtapas: EtapaPipelineNome[] = [
    'Inscritos',
    'Triagem IA',
    'Entrevista RH',
    'Entrevista Gestor',
    'Proposta',
    'Contratado',
  ];

  const handleGenerateAiJobDescription = async () => {
    if (!tituloVaga) return;
    setIsAiGenerating(true);
    try {
      const res = await fetch('/api/ai/generate-job-description', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: tituloVaga,
          area: departamentoVaga,
          level: 'Senior',
          model: modeloTrabalho,
        }),
      });
      const data = await res.json();
      if (data.descricao) {
        setDescricaoVaga(data.descricao);
        setRequisitosVaga(data.requisitos.join('\n'));
        if (data.salario_sugerido_min) setSalarioMin(data.salario_sugerido_min);
        if (data.salario_sugerido_max) setSalarioMax(data.salario_sugerido_max);
      }
    } catch (error) {
      console.error('Error generating job description:', error);
    } finally {
      setIsAiGenerating(false);
    }
  };

  const handleCreateVaga = (e: React.FormEvent) => {
    e.preventDefault();
    if (!tituloVaga) return;

    const newVaga = dataService.createVaga({
      titulo: tituloVaga,
      descricao: descricaoVaga || 'Descrição da vaga.',
      departamento: departamentoVaga,
      cargo: tituloVaga,
      tipo_contratacao: 'CLT',
      modelo_trabalho: modeloTrabalho,
      cidade: 'São Paulo',
      estado: 'SP',
      salario_min: salarioMin,
      salario_max: salarioMax,
      exibir_salario: true,
      status: 'publicada',
      requisitos: requisitosVaga.split('\n').filter(Boolean),
      diferenciais: [],
      beneficios: ['Vale Refeição', 'Plano de Saúde'],
      publicado: true,
      modulo_origem: 'recrutamento',
      criado_por: 'usr_admin_1',
      vagas_qtd: 1,
    });

    setShowCreateVagaModal(false);
    setTituloVaga('');
    setDescricaoVaga('');
    setRequisitosVaga('');
    refreshData();
    setSelectedVagaId(newVaga.id);
  };

  const handleMoveEtapa = (candidaturaId: string, delta: number) => {
    const cand = candidaturasVaga.find((c) => c.id === candidaturaId);
    if (!cand) return;

    const currentIdx = pipelineEtapas.indexOf(cand.etapa_pipeline);
    const newIdx = currentIdx + delta;
    if (newIdx >= 0 && newIdx < pipelineEtapas.length) {
      dataService.moveCandidaturaEtapa(candidaturaId, pipelineEtapas[newIdx]);
      refreshData();
    }
  };

  const handleSaveParecerRh = () => {
    if (selectedCandidatura) {
      dataService.updateCandidaturaPareceres(selectedCandidatura.id, parecerRhInput);
      setSelectedCandidatura((prev) => prev ? { ...prev, parecer_rh: parecerRhInput } : null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col gap-4 rounded-2xl bg-white p-6 shadow-sm border border-slate-200 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-indigo-600">
            <Briefcase className="h-4 w-4" />
            <span>Módulo de Recrutamento & Seleção (ATS)</span>
          </div>
          <h1 className="mt-1 text-2xl font-extrabold text-slate-900 tracking-tight">
            Pipeline de Candidatos e Vagas
          </h1>
          <p className="mt-0.5 text-xs text-slate-500">
            Gerencie o funil de seleção com triagem automatizada via IA Gemini e Parecer RH
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowCreateVagaModal(true)}
            className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-extrabold text-white transition hover:bg-indigo-700 shadow-md shadow-indigo-600/20"
          >
            <Plus className="h-4 w-4" />
            Nova Vaga
          </button>
        </div>
      </div>

      {/* Subnav Tabs */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-2">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('pipeline')}
            className={`rounded-xl px-4 py-2 text-xs font-bold transition ${
              activeTab === 'pipeline'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'bg-white text-slate-600 hover:bg-slate-100'
            }`}
          >
            Pipeline Kanban
          </button>
          <button
            onClick={() => setActiveTab('vagas')}
            className={`rounded-xl px-4 py-2 text-xs font-bold transition ${
              activeTab === 'vagas'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'bg-white text-slate-600 hover:bg-slate-100'
            }`}
          >
            Gerenciar Vagas ({vagas.length})
          </button>
          <button
            onClick={() => setActiveTab('talentos')}
            className={`rounded-xl px-4 py-2 text-xs font-bold transition ${
              activeTab === 'talentos'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'bg-white text-slate-600 hover:bg-slate-100'
            }`}
          >
            Banco de Talentos ({dataService.getCandidatos().length})
          </button>
        </div>

        {/* Job Selector Dropdown */}
        {activeTab === 'pipeline' && selectedVaga && (
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-500">Vaga selecionada:</span>
            <select
              value={selectedVaga.id}
              onChange={(e) => setSelectedVagaId(e.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-800 shadow-sm focus:border-indigo-500 focus:outline-none"
            >
              {vagas.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.titulo} ({v.cidade})
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* TAB 1: KANBAN PIPELINE */}
      {activeTab === 'pipeline' && (
        <div className="space-y-4">
          {selectedVaga ? (
            <div className="flex gap-4 overflow-x-auto pb-4">
              {pipelineEtapas.map((etapa) => {
                const candidatesInEtapa = candidaturasVaga.filter(
                  (c) => c.etapa_pipeline === etapa
                );

                return (
                  <div
                    key={etapa}
                    className="flex w-72 shrink-0 flex-col rounded-2xl border border-slate-200 bg-slate-50/80 p-3 shadow-sm"
                  >
                    {/* Stage Header */}
                    <div className="flex items-center justify-between border-b border-slate-200 pb-2.5 px-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 text-xs">{etapa}</span>
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-indigo-100 text-[10px] font-extrabold text-indigo-700">
                          {candidatesInEtapa.length}
                        </span>
                      </div>
                    </div>

                    {/* Cards List */}
                    <div className="mt-3 flex-1 space-y-3 min-h-[300px]">
                      {candidatesInEtapa.length === 0 ? (
                        <div className="flex h-32 items-center justify-center rounded-xl border border-dashed border-slate-200 text-[11px] text-slate-400">
                          Nenhum candidato
                        </div>
                      ) : (
                        candidatesInEtapa.map((app) => (
                          <div
                            key={app.id}
                            onClick={() => {
                              setSelectedCandidatura(app);
                              setParecerRhInput(app.parecer_rh || '');
                            }}
                            className="group cursor-pointer rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm transition hover:border-indigo-500 hover:shadow-md"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <h4 className="font-bold text-slate-900 text-xs group-hover:text-indigo-600 transition">
                                  {app.candidato.nome}
                                </h4>
                                <p className="text-[10px] text-slate-500 mt-0.5">
                                  {app.candidato.cidade}, {app.candidato.estado}
                                </p>
                              </div>

                              <span
                                className={`rounded-md px-1.5 py-0.5 text-[10px] font-black ${
                                  app.pontuacao_compatibilidade >= 85
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : app.pontuacao_compatibilidade >= 70
                                    ? 'bg-blue-100 text-blue-800'
                                    : 'bg-amber-100 text-amber-800'
                                }`}
                              >
                                {app.pontuacao_compatibilidade}% Match
                              </span>
                            </div>

                            {/* Tags */}
                            <div className="mt-2.5 flex flex-wrap gap-1">
                              {app.candidato.tags.slice(0, 3).map((tag, i) => (
                                <span
                                  key={i}
                                  className="rounded bg-slate-100 px-1.5 py-0.5 text-[9px] font-medium text-slate-600"
                                >
                                  {tag}
                                </span>
                              ))}
                            </div>

                            {/* Move Controls */}
                            <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2 text-[10px]">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleMoveEtapa(app.id, -1);
                                }}
                                className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                                title="Mover para etapa anterior"
                              >
                                <ChevronLeft className="h-3.5 w-3.5" />
                              </button>

                              <span className="text-slate-400 text-[9px]">
                                {new Date(app.data_candidatura).toLocaleDateString('pt-BR')}
                              </span>

                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleMoveEtapa(app.id, 1);
                                }}
                                className="rounded p-1 text-indigo-600 hover:bg-indigo-50 font-bold"
                                title="Avançar próxima etapa"
                              >
                                <ChevronRight className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p-8 text-center text-slate-500">Nenhuma vaga cadastrada.</div>
          )}
        </div>
      )}

      {/* TAB 2: GERENCIAR VAGAS */}
      {activeTab === 'vagas' && (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {vagas.map((vaga) => (
              <div key={vaga.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="rounded-md bg-indigo-50 px-2 py-0.5 text-[10px] font-bold text-indigo-700 uppercase">
                      {vaga.modelo_trabalho}
                    </span>
                    <h3 className="mt-2 font-bold text-slate-900 text-sm">{vaga.titulo}</h3>
                    <p className="text-xs text-slate-500">{vaga.departamento}</p>
                  </div>

                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                      vaga.status === 'publicada'
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {vaga.status}
                  </span>
                </div>

                <div className="mt-4 space-y-1 text-xs text-slate-600 border-t border-slate-100 pt-3">
                  <p>
                    <strong className="text-slate-900">Faixa Salarial:</strong> R${' '}
                    {vaga.salario_min?.toLocaleString('pt-BR')} - {vaga.salario_max?.toLocaleString('pt-BR')}
                  </p>
                  <p>
                    <strong className="text-slate-900">Local:</strong> {vaga.cidade} - {vaga.estado}
                  </p>
                </div>

                <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
                  <button
                    onClick={() => {
                      dataService.duplicateVaga(vaga.id);
                      refreshData();
                    }}
                    className="flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50"
                  >
                    <Copy className="h-3.5 w-3.5" />
                    Duplicar
                  </button>

                  <button
                    onClick={() => {
                      setSelectedVagaId(vaga.id);
                      setShowCandidatosListModal(true);
                    }}
                    className="flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700 shadow-sm"
                  >
                    <Users className="h-3.5 w-3.5" />
                    Candidatos ({dataService.getCandidaturasByVaga(vaga.id).length})
                  </button>

                  <button
                    onClick={() => {
                      setSelectedVagaId(vaga.id);
                      setActiveTab('pipeline');
                    }}
                    className="flex items-center gap-1 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-indigo-700 shadow-sm"
                  >
                    Ver Pipeline
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: BANCO DE TALENTOS */}
      {activeTab === 'talentos' && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="font-bold text-slate-900 text-base">Banco de Talentos Unificado</h2>
            <p className="text-xs text-slate-500">Busque profissionais por competências, cargo e avaliação da IA.</p>

            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {dataService.getCandidatos().map((cand) => (
                <div key={cand.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-bold text-slate-900 text-sm">{cand.nome}</h3>
                      <p className="text-xs text-slate-500">{cand.cargo_desejado}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">{cand.email} • {cand.telefone}</p>
                    </div>
                    <span className="rounded-full bg-indigo-100 px-2.5 py-0.5 text-xs font-black text-indigo-800">
                      Score {cand.score_ia || 85}%
                    </span>
                  </div>

                  <p className="mt-3 text-xs text-slate-600 line-clamp-2">{cand.resumo_ia}</p>

                  <div className="mt-3 flex flex-wrap gap-1">
                    {cand.habilidades.map((h, i) => (
                      <span key={i} className="rounded bg-white px-2 py-0.5 text-[9px] font-bold text-slate-700 border border-slate-200">
                        {h}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* CANDIDATE DETAIL DRAWER */}
      {selectedCandidatura && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/50 backdrop-blur-sm">
          <div className="relative flex h-full w-full max-w-2xl flex-col bg-white shadow-2xl overflow-y-auto border-l border-slate-200">
            {/* Drawer Header */}
            <div className="flex items-center justify-between border-b border-slate-200 bg-slate-900 px-6 py-4 text-white">
              <div>
                <h2 className="text-lg font-bold">{selectedCandidatura.candidato.nome}</h2>
                <p className="text-xs text-indigo-300">
                  {selectedCandidatura.candidato.cargo_desejado} • {selectedCandidatura.candidato.cidade}
                </p>
              </div>

              <button
                onClick={() => setSelectedCandidatura(null)}
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 space-y-6 text-xs text-slate-700">
              {/* Score & Match Badge */}
              <div className="rounded-2xl bg-gradient-to-r from-indigo-900 to-blue-900 p-5 text-white shadow-md">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-indigo-200">
                    Compatibilidade IA Gemini
                  </span>
                  <span className="rounded-full bg-emerald-400 px-3 py-1 font-black text-slate-950 text-sm">
                    {selectedCandidatura.pontuacao_compatibilidade}% Match
                  </span>
                </div>
                <p className="mt-2 text-xs leading-relaxed text-indigo-100">
                  {selectedCandidatura.resumo_match_ia || selectedCandidatura.candidato.resumo_ia}
                </p>
              </div>

              {/* Parecer RH Section */}
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                    <MessageSquare className="h-4 w-4 text-indigo-600" />
                    Parecer do RH & Entrevistador
                  </h3>
                </div>

                <textarea
                  rows={3}
                  value={parecerRhInput}
                  onChange={(e) => setParecerRhInput(e.target.value)}
                  placeholder="Escreva aqui suas impressões, observações de entrevista e alinhamento salarial..."
                  className="w-full rounded-xl border border-slate-200 bg-white p-3 text-xs focus:border-indigo-500 focus:outline-none"
                />

                <div className="flex justify-end">
                  <button
                    onClick={handleSaveParecerRh}
                    className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-700 shadow-sm"
                  >
                    <Send className="h-3.5 w-3.5" />
                    Salvar Parecer RH
                  </button>
                </div>
              </div>

              {/* Parecer IA Points */}
              {selectedCandidatura.pontos_fortes_ia && (
                <div className="space-y-3">
                  <h3 className="font-bold text-slate-900 text-sm">Pontos Fortes Identificados pela IA</h3>
                  <div className="space-y-1.5">
                    {selectedCandidatura.pontos_fortes_ia.map((pt, i) => (
                      <div key={i} className="flex items-center gap-2 rounded-lg bg-emerald-50 p-2 text-emerald-900">
                        <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                        <span>{pt}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Questions Suggested by AI */}
              {selectedCandidatura.perguntas_sugeridas_ia && (
                <div className="space-y-3">
                  <h3 className="font-bold text-slate-900 text-sm">Perguntas Sugeridas para Entrevista</h3>
                  <div className="space-y-2">
                    {selectedCandidatura.perguntas_sugeridas_ia.map((p, i) => (
                      <div key={i} className="rounded-xl border border-indigo-100 bg-indigo-50/50 p-3 text-indigo-950 font-medium">
                        {p}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Full CV text */}
              <div className="space-y-2 border-t border-slate-200 pt-4">
                <h3 className="font-bold text-slate-900 text-sm">Resumo do Currículo</h3>
                <div className="rounded-xl bg-slate-100 p-4 font-mono text-[11px] text-slate-800 leading-relaxed whitespace-pre-wrap">
                  {selectedCandidatura.candidato.curriculo_texto || 'Texto do currículo indisponível.'}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CREATE VAGA MODAL */}
      {showCreateVagaModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-900 text-base">Abrir Nova Vaga de Recrutamento</h3>
              <button
                onClick={() => setShowCreateVagaModal(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateVaga} className="mt-4 space-y-4 text-xs">
              <div>
                <label className="font-bold text-slate-700">Título do Cargo / Vaga *</label>
                <div className="mt-1 flex gap-2">
                  <input
                    type="text"
                    required
                    value={tituloVaga}
                    onChange={(e) => setTituloVaga(e.target.value)}
                    placeholder="Ex: Engenheiro de Software Full Stack Senior"
                    className="flex-1 rounded-xl border border-slate-200 p-2.5 text-xs focus:border-indigo-500 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleGenerateAiJobDescription}
                    disabled={isAiGenerating || !tituloVaga}
                    className="flex items-center gap-1.5 shrink-0 rounded-xl bg-slate-900 px-4 py-2.5 font-bold text-white hover:bg-slate-800 disabled:opacity-50"
                  >
                    <Sparkles className="h-4 w-4 text-amber-400" />
                    {isAiGenerating ? 'Gerando...' : 'Gerar com IA'}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="font-bold text-slate-700">Departamento</label>
                  <input
                    type="text"
                    value={departamentoVaga}
                    onChange={(e) => setDepartamentoVaga(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 text-xs focus:border-indigo-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700">Modelo de Trabalho</label>
                  <select
                    value={modeloTrabalho}
                    onChange={(e: any) => setModeloTrabalho(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 text-xs focus:border-indigo-500 focus:outline-none"
                  >
                    <option value="Hibrido">Híbrido</option>
                    <option value="Remoto">Remoto</option>
                    <option value="Presencial">Presencial</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="font-bold text-slate-700">Salário Mínimo (R$)</label>
                  <input
                    type="number"
                    value={salarioMin}
                    onChange={(e) => setSalarioMin(Number(e.target.value))}
                    className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 text-xs focus:border-indigo-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700">Salário Máximo (R$)</label>
                  <input
                    type="number"
                    value={salarioMax}
                    onChange={(e) => setSalarioMax(Number(e.target.value))}
                    className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 text-xs focus:border-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700">Descrição Completa</label>
                <textarea
                  rows={4}
                  value={descricaoVaga}
                  onChange={(e) => setDescricaoVaga(e.target.value)}
                  placeholder="Descrição das atividades e responsabilidades..."
                  className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 text-xs focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700">Requisitos (1 por linha)</label>
                <textarea
                  rows={3}
                  value={requisitosVaga}
                  onChange={(e) => setRequisitosVaga(e.target.value)}
                  placeholder="Ex: TypeScript 3+ anos&#10;PostgreSQL ou Supabase"
                  className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 text-xs focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div className="mt-6 flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowCreateVagaModal(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2 font-bold text-slate-600 hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-indigo-600 px-5 py-2 font-bold text-white hover:bg-indigo-700 shadow-md"
                >
                  Publicar Vaga
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* CANDIDATES LIST BY VAGA MODAL (Requirement 9) */}
      {showCandidatosListModal && selectedVaga && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm overflow-y-auto">
          <div className="w-full max-w-4xl max-h-[90vh] flex flex-col rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden my-auto">
            <div className="flex items-center justify-between border-b border-slate-200 bg-slate-900 px-6 py-4 text-white">
              <div>
                <span className="rounded bg-indigo-500/20 px-2 py-0.5 text-[10px] font-bold text-indigo-300 uppercase">
                  {selectedVaga.modelo_trabalho}
                </span>
                <h3 className="text-base font-extrabold text-white mt-1">
                  Candidatos inscritos na vaga: {selectedVaga.titulo}
                </h3>
                <p className="text-xs text-slate-300">
                  Total de {candidaturasVaga.length} candidato(s) cadastrado(s) nesta vaga
                </p>
              </div>

              <button
                onClick={() => setShowCandidatosListModal(false)}
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4">
              {candidaturasVaga.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-300 p-12 text-center text-xs text-slate-500">
                  Nenhum candidato inscrito nesta vaga ainda.
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-slate-200">
                  <table className="w-full text-left text-xs text-slate-700">
                    <thead className="bg-slate-50 border-b border-slate-200 font-bold text-slate-800">
                      <tr>
                        <th className="px-4 py-3">Candidato</th>
                        <th className="px-4 py-3">Origem</th>
                        <th className="px-4 py-3">Etapa Atual</th>
                        <th className="px-4 py-3">Match IA</th>
                        <th className="px-4 py-3">Data</th>
                        <th className="px-4 py-3 text-right">Ação</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {candidaturasVaga.map((cApp) => (
                        <tr key={cApp.id} className="hover:bg-slate-50/80 transition">
                          <td className="px-4 py-3">
                            <div className="font-bold text-slate-900">{cApp.candidato.nome}</div>
                            <div className="text-[10px] text-slate-500">
                              {cApp.candidato.email} • {cApp.candidato.telefone}
                            </div>
                            <div className="text-[10px] text-slate-400">
                              {cApp.candidato.cidade} - {cApp.candidato.estado}
                            </div>
                          </td>

                          <td className="px-4 py-3">
                            {cApp.origem === 'portal_vagas' || cApp.candidato.origem === 'portal_vagas' ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-extrabold text-emerald-800 border border-emerald-200">
                                <Sparkles className="h-3 w-3 text-emerald-600" />
                                Portal de Vagas
                              </span>
                            ) : cApp.origem === 'banco_talentos_portal' ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-purple-100 px-2.5 py-0.5 text-[10px] font-extrabold text-purple-800 border border-purple-200">
                                Banco de Talentos
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-bold text-slate-700">
                                Inclusão Manual
                              </span>
                            )}
                          </td>

                          <td className="px-4 py-3 font-semibold text-slate-800">
                            <span className="rounded bg-indigo-50 px-2 py-1 text-[10px] font-bold text-indigo-700">
                              {cApp.etapa_pipeline}
                            </span>
                          </td>

                          <td className="px-4 py-3">
                            <span className="font-extrabold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded text-xs">
                              {cApp.pontuacao_compatibilidade}%
                            </span>
                          </td>

                          <td className="px-4 py-3 text-[10px] text-slate-500 whitespace-nowrap">
                            {new Date(cApp.data_candidatura).toLocaleDateString('pt-BR')}
                          </td>

                          <td className="px-4 py-3 text-right">
                            <button
                              onClick={() => {
                                setSelectedCandidatura(cApp);
                                setParecerRhInput(cApp.parecer_rh || '');
                              }}
                              className="rounded-lg bg-indigo-600 px-3 py-1.5 text-[11px] font-bold text-white hover:bg-indigo-700 shadow-2xs"
                            >
                              Ver Perfil & Parecer
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
