import React, { useState } from 'react';
import {
  Globe,
  Search,
  MapPin,
  Briefcase,
  Building2,
  FileText,
  Upload,
  Sparkles,
  CheckCircle2,
  Send,
  X,
} from 'lucide-react';
import { dataService } from '../../services/dataService';
import { Vaga } from '../../types';

export const PublicPortalView: React.FC = () => {
  const [publicVagas, setPublicVagas] = useState(dataService.getPublicVagas());
  const [selectedVaga, setSelectedVaga] = useState<Vaga | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [cityTerm, setCityTerm] = useState('');

  // Candidate Application Form State
  const [nomeForm, setNomeForm] = useState('');
  const [emailForm, setEmailForm] = useState('');
  const [telefoneForm, setTelefoneForm] = useState('');
  const [cidadeForm, setCidadeForm] = useState('');
  const [estadoForm, setEstadoForm] = useState('');
  const [curriculoTexto, setCurriculoTexto] = useState('');
  const [isAiParsing, setIsAiParsing] = useState(false);
  const [submittedSuccess, setSubmittedSuccess] = useState(false);

  const filteredVagas = publicVagas.filter((v) => {
    const matchSearch =
      v.titulo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      v.descricao.toLowerCase().includes(searchTerm.toLowerCase());
    const matchCity =
      !cityTerm || v.cidade.toLowerCase().includes(cityTerm.toLowerCase());
    return matchSearch && matchCity;
  });

  const handleSimulateUploadCv = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Simulate reading PDF / DOCX file text
    const sampleText = `CURRÍCULO - ${file.name.replace(/\.[^/.]+$/, '')}
Experiência Profissional: 5 anos de experiência em desenvolvimento de software, arquitetura de sistemas e metodologias ágeis.
Linguagens e Frameworks: TypeScript, React, Node.js, Express, PostgreSQL, Supabase e Docker.
Formação: Bacharel em Sistemas de Informação.
Telefone: (11) 98765-4321 - Cidade: São Paulo, SP.`;

    setCurriculoTexto(sampleText);

    // Call server API for Gemini AI parsing
    setIsAiParsing(true);
    try {
      const res = await fetch('/api/ai/parse-resume', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resumeText: sampleText, jobTitle: selectedVaga?.titulo }),
      });
      const data = await res.json();

      if (data.nome && data.nome !== 'Candidato Analisado (Modo Offline)') setNomeForm(data.nome);
      if (data.email) setEmailForm(data.email);
      if (data.telefone) setTelefoneForm(data.telefone);
      if (data.cidade) setCidadeForm(data.cidade);
      if (data.estado) setEstadoForm(data.estado);
    } catch (err) {
      console.error('Error parsing resume with AI:', err);
    } finally {
      setIsAiParsing(false);
    }
  };

  const handleApply = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVaga || !nomeForm || !emailForm) return;

    dataService.applyToVagaPublic(selectedVaga.id, {
      nome: nomeForm,
      email: emailForm,
      telefone: telefoneForm || '(11) 99999-9999',
      cidade: cidadeForm || 'São Paulo',
      estado: estadoForm || 'SP',
      cargo_desejado: selectedVaga.titulo,
      curriculo_texto: curriculoTexto,
      resumo_ia: `Inscrição pública realizada para ${selectedVaga.titulo}.`,
      score_ia: 85,
      tags: ['Candidato Portal', 'Inscrição Rápida'],
      habilidades: ['React', 'TypeScript', 'Node.js'],
    });

    setSubmittedSuccess(true);
  };

  return (
    <div className="space-y-6">
      {/* Hero Banner for Job Portal */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 p-8 text-white shadow-xl">
        <div className="relative z-10 max-w-2xl">
          <div className="inline-flex items-center gap-2 rounded-full bg-indigo-500/30 px-3 py-1 text-xs font-bold text-indigo-200 border border-indigo-400/30">
            <Globe className="h-3.5 w-3.5" />
            Portal de Vagas RL CONNECT
          </div>
          <h1 className="mt-3 text-3xl font-extrabold tracking-tight">
            Encontre sua próxima grande oportunidade profissional
          </h1>
          <p className="mt-2 text-xs text-indigo-200 leading-relaxed">
            Inscrição rápida e direta com leitura automatizada de currículo por Inteligência Artificial.
          </p>

          {/* Search Inputs */}
          <div className="mt-6 flex flex-col gap-2 sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Cargo, tecnologia ou palavra-chave..."
                className="w-full rounded-xl bg-white pl-9 pr-4 py-2.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none"
              />
            </div>

            <div className="relative w-full sm:w-48">
              <MapPin className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
              <input
                type="text"
                value={cityTerm}
                onChange={(e) => setCityTerm(e.target.value)}
                placeholder="Cidade ou Estado..."
                className="w-full rounded-xl bg-white pl-9 pr-4 py-2.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Jobs Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filteredVagas.map((vaga) => (
          <div
            key={vaga.id}
            className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-sm hover:border-indigo-500 transition"
          >
            <div>
              <div className="flex items-center justify-between">
                <span className="rounded-md bg-indigo-50 px-2 py-0.5 text-[10px] font-bold text-indigo-700 uppercase">
                  {vaga.modelo_trabalho}
                </span>
                <span className="text-xs font-bold text-emerald-600">
                  R$ {vaga.salario_min?.toLocaleString('pt-BR')} - {vaga.salario_max?.toLocaleString('pt-BR')}
                </span>
              </div>

              <h3 className="mt-3 font-bold text-slate-900 text-base">{vaga.titulo}</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {vaga.departamento} • {vaga.cidade} - {vaga.estado}
              </p>

              <p className="mt-3 text-xs text-slate-600 line-clamp-3 leading-relaxed">
                {vaga.descricao}
              </p>

              {/* Requirements preview */}
              <div className="mt-3 space-y-1">
                {vaga.requisitos.slice(0, 2).map((req, i) => (
                  <div key={i} className="text-[11px] text-slate-600 flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-indigo-500 shrink-0" />
                    <span className="truncate">{req}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-5 border-t border-slate-100 pt-3">
              <button
                onClick={() => {
                  setSelectedVaga(vaga);
                  setSubmittedSuccess(false);
                }}
                className="w-full rounded-xl bg-indigo-600 py-2.5 text-xs font-bold text-white transition hover:bg-indigo-700 shadow-md shadow-indigo-600/20"
              >
                Inscrição Rápida
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* APPLICATION MODAL */}
      {selectedVaga && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-bold text-slate-900 text-base">Inscrição para {selectedVaga.titulo}</h3>
                <p className="text-xs text-slate-500">{selectedVaga.cidade} - {selectedVaga.estado}</p>
              </div>
              <button onClick={() => setSelectedVaga(null)} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100">
                <X className="h-5 w-5" />
              </button>
            </div>

            {submittedSuccess ? (
              <div className="my-8 text-center space-y-3">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                  <CheckCircle2 className="h-8 w-8" />
                </div>
                <h4 className="text-lg font-bold text-slate-900">Inscrição Enviada com Sucesso!</h4>
                <p className="text-xs text-slate-600 max-w-md mx-auto">
                  Seus dados foram salvos e analisados pela nossa Inteligência Artificial. Entraremos em contato caso seu perfil atenda aos requisitos da vaga.
                </p>
                <button
                  onClick={() => setSelectedVaga(null)}
                  className="mt-4 rounded-xl bg-slate-900 px-6 py-2.5 text-xs font-bold text-white hover:bg-slate-800"
                >
                  Concluir
                </button>
              </div>
            ) : (
              <form onSubmit={handleApply} className="mt-4 space-y-4 text-xs">
                {/* Simulated File Upload with Auto AI Parsing */}
                <div className="rounded-2xl border-2 border-dashed border-indigo-200 bg-indigo-50/50 p-4 text-center">
                  <Upload className="mx-auto h-8 w-8 text-indigo-500" />
                  <div className="mt-2 font-bold text-indigo-950 text-xs">
                    Upload do Currículo (PDF ou DOCX)
                  </div>
                  <p className="text-[11px] text-indigo-700 mt-0.5">
                    A IA extrai automaticamente seu nome, contato e histórico profissional.
                  </p>

                  <label className="mt-3 inline-flex cursor-pointer items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-700 shadow-sm">
                    <FileText className="h-4 w-4" />
                    Selecionar Arquivo
                    <input
                      type="file"
                      accept=".pdf,.docx,.doc,.txt"
                      onChange={handleSimulateUploadCv}
                      className="hidden"
                    />
                  </label>

                  {isAiParsing && (
                    <div className="mt-2 flex items-center justify-center gap-2 text-xs font-bold text-indigo-600">
                      <Sparkles className="h-4 w-4 animate-spin" />
                      Analisando com Gemini IA...
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-bold text-slate-700">Nome Completo *</label>
                    <input
                      type="text"
                      required
                      value={nomeForm}
                      onChange={(e) => setNomeForm(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 text-xs focus:border-indigo-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-slate-700">E-mail *</label>
                    <input
                      type="email"
                      required
                      value={emailForm}
                      onChange={(e) => setEmailForm(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 text-xs focus:border-indigo-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="font-bold text-slate-700">Telefone</label>
                    <input
                      type="text"
                      value={telefoneForm}
                      onChange={(e) => setTelefoneForm(e.target.value)}
                      placeholder="(11) 99999-9999"
                      className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 text-xs focus:border-indigo-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="font-bold text-slate-700">Cidade</label>
                    <input
                      type="text"
                      value={cidadeForm}
                      onChange={(e) => setCidadeForm(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 text-xs focus:border-indigo-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="font-bold text-slate-700">Estado</label>
                    <input
                      type="text"
                      value={estadoForm}
                      onChange={(e) => setEstadoForm(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 text-xs focus:border-indigo-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="font-bold text-slate-700">Texto / Resumo do Currículo</label>
                  <textarea
                    rows={4}
                    value={curriculoTexto}
                    onChange={(e) => setCurriculoTexto(e.target.value)}
                    placeholder="Cole ou edite seu texto profissional aqui..."
                    className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 text-xs focus:border-indigo-500 focus:outline-none"
                  />
                </div>

                <div className="mt-6 flex justify-end gap-3 pt-4 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setSelectedVaga(null)}
                    className="rounded-xl border border-slate-200 px-4 py-2 font-bold text-slate-600 hover:bg-slate-50"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="flex items-center gap-2 rounded-xl bg-indigo-600 px-6 py-2.5 font-bold text-white hover:bg-indigo-700 shadow-md"
                  >
                    <Send className="h-4 w-4" />
                    Enviar Candidatura
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
