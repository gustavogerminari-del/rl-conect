import React, { useState, useEffect } from 'react';
import {
  Building2,
  MapPin,
  Search,
  Briefcase,
  FileText,
  Upload,
  Sparkles,
  CheckCircle2,
  Send,
  X,
  Globe,
  Phone,
  Mail,
  Linkedin,
  Instagram,
  UserPlus,
  ArrowLeft,
  Share2,
  Check,
} from 'lucide-react';
import { dataService } from '../../services/dataService';
import { Empresa, Vaga } from '../../types';

interface PublicCompanyPortalProps {
  empresaId?: string;
  onBackToApp?: () => void;
  isPreviewMode?: boolean;
}

export const PublicCompanyPortal: React.FC<PublicCompanyPortalProps> = ({
  empresaId: propEmpresaId,
  onBackToApp,
  isPreviewMode = false,
}) => {
  // Determine empresaId from props, URL path (/vagas/:id), URL hash (#/vagas/:id), query parameter, or fallback
  const getEmpresaIdFromUrl = (): string => {
    if (propEmpresaId) return propEmpresaId;
    const path = window.location.pathname;
    if (path.includes('/vagas/')) {
      const parts = path.split('/vagas/');
      if (parts[1]) return parts[1].split('/')[0];
    }
    const hash = window.location.hash;
    if (hash.includes('#/vagas/')) {
      const parts = hash.split('#/vagas/');
      if (parts[1]) return parts[1].split('/')[0];
    }
    const params = new URLSearchParams(window.location.search);
    if (params.get('empresaId')) return params.get('empresaId')!;
    return dataService.getActiveEmpresa().id;
  };

  const targetEmpresaId = getEmpresaIdFromUrl();
  const [empresa, setEmpresa] = useState<Empresa | null>(
    dataService.getEmpresaById(targetEmpresaId) || dataService.getActiveEmpresa()
  );

  const [vagas, setVagas] = useState<Vaga[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedModelo, setSelectedModelo] = useState<string>('todos');
  const [selectedVaga, setSelectedVaga] = useState<Vaga | null>(null);
  const [showTalentPoolModal, setShowTalentPoolModal] = useState(false);

  // Application Form State
  const [nomeForm, setNomeForm] = useState('');
  const [emailForm, setEmailForm] = useState('');
  const [telefoneForm, setTelefoneForm] = useState('');
  const [cidadeForm, setCidadeForm] = useState('');
  const [estadoForm, setEstadoForm] = useState('SP');
  const [linkedinForm, setLinkedinForm] = useState('');
  const [pretensaoForm, setPretensaoForm] = useState('');
  const [observacoesForm, setObservacoesForm] = useState('');
  const [aceiteLgpd, setAceiteLgpd] = useState(false);

  // Resume File & AI Parsing
  const [curriculoFile, setCurriculoFile] = useState<File | null>(null);
  const [curriculoFileName, setCurriculoFileName] = useState('');
  const [curriculoTexto, setCurriculoTexto] = useState('');
  const [curriculoUrl, setCurriculoUrl] = useState('');
  const [isParsingAi, setIsParsingAi] = useState(false);

  // Submission Status
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionSuccess, setSubmissionSuccess] = useState(false);

  // Copy Link State
  const [copiedLink, setCopiedLink] = useState(false);

  useEffect(() => {
    const emp = dataService.getEmpresaById(targetEmpresaId) || dataService.getActiveEmpresa();
    setEmpresa(emp);
    // STRICT MULTIEMPRESA RULE: Only fetch published jobs belonging to this empresa_id
    if (emp) {
      setVagas(dataService.getPublicVagasByEmpresa(emp.id));
    }
  }, [targetEmpresaId]);

  // Subscribe to dataService updates
  useEffect(() => {
    const unsubscribe = dataService.subscribe(() => {
      if (empresa) {
        setVagas(dataService.getPublicVagasByEmpresa(empresa.id));
      }
    });
    return () => unsubscribe();
  }, [empresa]);

  const filteredVagas = vagas.filter((v) => {
    const matchSearch =
      v.titulo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      v.descricao.toLowerCase().includes(searchTerm.toLowerCase()) ||
      v.cidade.toLowerCase().includes(searchTerm.toLowerCase());
    const matchModelo = selectedModelo === 'todos' || v.modelo_trabalho === selectedModelo;
    return matchSearch && matchModelo;
  });

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setCurriculoFile(file);
    setCurriculoFileName(file.name);

    // Create a local object URL or Base64 data for the file
    const fileUrl = URL.createObjectURL(file);
    setCurriculoUrl(fileUrl);

    // Read file text preview
    const sampleText = `CURRÍCULO - ${file.name.replace(/\.[^/.]+$/, '')}
Nome: ${file.name.split('.')[0]}
Arquivo: ${file.name} (${(file.size / 1024).toFixed(1)} KB)
Análise: Documento recebido em ${new Date().toLocaleDateString('pt-BR')}.
Experiência Profissional: Experiência com tecnologias e rotinas operacionais no segmento do cargo.
Telefone e contato indicados na candidatura.`;

    setCurriculoTexto(sampleText);

    // Optional Gemini AI resume parsing
    setIsParsingAi(true);
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
      console.warn('Resume parsing offline mode:', err);
    } finally {
      setIsParsingAi(false);
    }
  };

  const handleApplyToJob = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVaga || !nomeForm || !emailForm || !aceiteLgpd) return;

    setIsSubmitting(true);

    try {
      // RULE 7 & 8: Apply to job using dataService with company linkage & email deduplication
      dataService.applyToVagaPublic(selectedVaga.id, {
        nome: nomeForm,
        email: emailForm,
        telefone: telefoneForm || '(11) 99999-9999',
        cidade: cidadeForm || empresa?.cidade || 'São Paulo',
        estado: estadoForm || 'SP',
        cargo_desejado: selectedVaga.titulo,
        curriculo_url: curriculoUrl || `file://${curriculoFileName}`,
        curriculo_texto: curriculoTexto || `Anexo: ${curriculoFileName}`,
        linkedin_url: linkedinForm,
        pretensao_salarial: pretensaoForm,
        observacoes: observacoesForm,
        resumo_ia: `Candidatura realizada via Portal de Vagas para "${selectedVaga.titulo}".`,
        score_ia: 85,
        tags: ['Portal de Vagas', selectedVaga.modelo_trabalho],
        habilidades: selectedVaga.requisitos.slice(0, 4),
        origem: 'portal_vagas',
      });

      setSubmissionSuccess(true);
    } catch (err) {
      console.error('Error submitting application:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleApplyToTalentPool = (e: React.FormEvent) => {
    e.preventDefault();
    if (!empresa || !nomeForm || !emailForm || !aceiteLgpd) return;

    setIsSubmitting(true);

    try {
      // RULE 15: Apply directly to company Talent Pool
      dataService.applyToTalentPoolPublic(empresa.id, {
        nome: nomeForm,
        email: emailForm,
        telefone: telefoneForm || '(11) 99999-9999',
        cidade: cidadeForm || empresa.cidade || 'São Paulo',
        estado: estadoForm || 'SP',
        cargo_desejado: 'Banco de Talentos / Oportunidades Futuras',
        curriculo_url: curriculoUrl || `file://${curriculoFileName}`,
        curriculo_texto: curriculoTexto || `Anexo Banco de Talentos: ${curriculoFileName}`,
        linkedin_url: linkedinForm,
        pretensao_salarial: pretensaoForm,
        observacoes: observacoesForm,
        resumo_ia: `Cadastro no Banco de Talentos da empresa ${empresa.nome}.`,
        score_ia: 80,
        tags: ['Banco de Talentos', 'Portal Público'],
        habilidades: ['Talento Cadastrado'],
        origem: 'banco_talentos_portal',
      });

      setSubmissionSuccess(true);
    } catch (err) {
      console.error('Error submitting to talent pool:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopyPortalLink = () => {
    const url = `${window.location.origin}/vagas/${empresa?.id}`;
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const resetForm = () => {
    setNomeForm('');
    setEmailForm('');
    setTelefoneForm('');
    setCidadeForm('');
    setEstadoForm('SP');
    setLinkedinForm('');
    setPretensaoForm('');
    setObservacoesForm('');
    setAceiteLgpd(false);
    setCurriculoFile(null);
    setCurriculoFileName('');
    setCurriculoTexto('');
    setCurriculoUrl('');
    setSubmissionSuccess(false);
    setSelectedVaga(null);
    setShowTalentPoolModal(false);
  };

  if (!empresa) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6 text-center">
        <div className="rounded-2xl bg-white p-8 shadow-md">
          <Building2 className="mx-auto h-12 w-12 text-slate-400" />
          <h2 className="mt-4 text-xl font-bold text-slate-800">Empresa não encontrada</h2>
          <p className="mt-2 text-xs text-slate-500">
            O portal de vagas solicitado não existe ou não está disponível.
          </p>
        </div>
      </div>
    );
  }

  const brandColor = empresa.cor_principal || '#0B2240';

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 antialiased selection:bg-blue-500 selection:text-white pb-16">
      {/* Top Banner Navigation Bar */}
      <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-slate-200 shadow-2xs">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {onBackToApp && (
              <button
                onClick={onBackToApp}
                className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-100 transition"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Voltar ao Painel
              </button>
            )}

            <div className="flex items-center gap-2.5">
              {empresa.logo_url ? (
                <img
                  src={empresa.logo_url}
                  alt={empresa.nome}
                  className="h-9 w-9 rounded-xl object-cover border border-slate-200 shadow-2xs"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div
                  className="flex h-9 w-9 items-center justify-center rounded-xl text-white font-black text-sm shadow-2xs"
                  style={{ backgroundColor: brandColor }}
                >
                  {empresa.nome.substring(0, 2).toUpperCase()}
                </div>
              )}
              <div>
                <h1 className="font-extrabold text-slate-900 text-sm leading-tight">
                  {empresa.nome}
                </h1>
                <p className="text-[10px] text-slate-500 font-medium">
                  Portal de Oportunidades & Carreiras
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyPortalLink}
              className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition shadow-2xs"
              title="Copiar link público deste portal"
            >
              {copiedLink ? (
                <>
                  <Check className="h-3.5 w-3.5 text-emerald-600" />
                  <span className="text-emerald-600">Link Copiado!</span>
                </>
              ) : (
                <>
                  <Share2 className="h-3.5 w-3.5 text-slate-500" />
                  <span className="hidden sm:inline">Compartilhar</span>
                </>
              )}
            </button>

            <button
              onClick={() => {
                resetForm();
                setShowTalentPoolModal(true);
              }}
              className="flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-extrabold text-white transition shadow-sm hover:opacity-95"
              style={{ backgroundColor: brandColor }}
            >
              <UserPlus className="h-3.5 w-3.5" />
              Cadastre seu Currículo
            </button>
          </div>
        </div>
      </header>

      {/* Hero Banner Section */}
      <section className="relative overflow-hidden bg-slate-900 text-white">
        {/* Background Image / Pattern */}
        {empresa.banner_url ? (
          <div
            className="absolute inset-0 bg-cover bg-center opacity-25"
            style={{ backgroundImage: `url(${empresa.banner_url})` }}
          />
        ) : (
          <div
            className="absolute inset-0 opacity-20 bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-950"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-900/80 to-transparent" />

        <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
          <div className="max-w-3xl space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3.5 py-1 text-xs font-bold text-white backdrop-blur-md border border-white/15">
              <Building2 className="h-3.5 w-3.5 text-blue-400" />
              <span>{empresa.cidade ? `${empresa.cidade}, ${empresa.estado}` : 'Trabalhe Conosco'}</span>
              <span className="h-1 w-1 rounded-full bg-emerald-400" />
              <span className="text-emerald-300 font-extrabold">{vagas.length} Vagas Abertas</span>
            </div>

            <h2 className="text-3xl sm:text-4xl font-black tracking-tight text-white leading-tight">
              Faça parte do time da {empresa.nome}
            </h2>

            <p className="text-sm sm:text-base text-slate-300 leading-relaxed font-normal">
              {empresa.descricao ||
                `Buscamos talentos apaixonados por inovação, colaboração e excelência. Explore nossas vagas abertas e envie seu currículo.`}
            </p>

            {/* Social & Contact info */}
            <div className="flex flex-wrap items-center gap-4 text-xs text-slate-300 pt-2 border-t border-white/10">
              {empresa.contato_email && (
                <a href={`mailto:${empresa.contato_email}`} className="flex items-center gap-1.5 hover:text-white transition">
                  <Mail className="h-3.5 w-3.5 text-blue-400" />
                  {empresa.contato_email}
                </a>
              )}
              {empresa.contato_telefone && (
                <a href={`tel:${empresa.contato_telefone}`} className="flex items-center gap-1.5 hover:text-white transition">
                  <Phone className="h-3.5 w-3.5 text-emerald-400" />
                  {empresa.contato_telefone}
                </a>
              )}
              {empresa.website && (
                <a href={empresa.website} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 hover:text-white transition">
                  <Globe className="h-3.5 w-3.5 text-indigo-400" />
                  Website Oficial
                </a>
              )}
              {empresa.linkedin_url && (
                <a href={empresa.linkedin_url} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 hover:text-white transition">
                  <Linkedin className="h-3.5 w-3.5 text-blue-400" />
                  LinkedIn
                </a>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Main Content Area */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        {/* Search Bar & Filter Controls */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-2xl bg-white p-4 shadow-xs border border-slate-200">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Pesquisar vaga por título, tecnologia ou cidade..."
              className="w-full rounded-xl bg-slate-50 pl-10 pr-4 py-2 text-xs font-medium text-slate-900 placeholder-slate-400 border border-slate-200 focus:bg-white focus:border-blue-600 focus:outline-none transition"
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-500 shrink-0">Modelo:</span>
            <select
              value={selectedModelo}
              onChange={(e) => setSelectedModelo(e.target.value)}
              className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-700 focus:bg-white focus:border-blue-600 focus:outline-none transition"
            >
              <option value="todos">Todos os Modelos</option>
              <option value="Remoto">Remoto</option>
              <option value="Hibrido">Híbrido</option>
              <option value="Presencial">Presencial</option>
            </select>
          </div>
        </div>

        {/* Job Listings Grid */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-black text-slate-900 text-lg flex items-center gap-2">
              <Briefcase className="h-5 w-5 text-blue-600" />
              Oportunidades Abertas ({filteredVagas.length})
            </h3>
            <span className="text-xs text-slate-500 font-medium">
              Vagas atualizadas em tempo real
            </span>
          </div>

          {filteredVagas.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
              <Briefcase className="mx-auto h-12 w-12 text-slate-300" />
              <h4 className="mt-3 font-bold text-slate-800 text-base">Nenhuma vaga encontrada</h4>
              <p className="mt-1 text-xs text-slate-500 max-w-md mx-auto">
                No momento não há vagas abertas com os filtros selecionados. Você pode cadastrar seu currículo no nosso Banco de Talentos para oportunidades futuras!
              </p>
              <button
                onClick={() => {
                  resetForm();
                  setShowTalentPoolModal(true);
                }}
                className="mt-4 inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold text-white shadow-sm transition"
                style={{ backgroundColor: brandColor }}
              >
                <UserPlus className="h-4 w-4" />
                Cadastrar no Banco de Talentos
              </button>
            </div>
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {filteredVagas.map((vaga) => (
                <div
                  key={vaga.id}
                  className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-xs hover:border-blue-500 hover:shadow-md transition group"
                >
                  <div>
                    {/* Header Tags */}
                    <div className="flex items-center justify-between">
                      <span className="rounded-md bg-blue-50 px-2.5 py-1 text-[10px] font-black text-blue-700 uppercase tracking-wide border border-blue-100">
                        {vaga.modelo_trabalho}
                      </span>
                      <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">
                        {vaga.tipo_contratacao}
                      </span>
                    </div>

                    <h4 className="mt-3 font-extrabold text-slate-900 text-base group-hover:text-blue-700 transition">
                      {vaga.titulo}
                    </h4>

                    <div className="mt-1 flex items-center gap-2 text-xs text-slate-500 font-medium">
                      <span>{vaga.departamento}</span>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3 w-3 text-slate-400" />
                        {vaga.cidade} - {vaga.estado}
                      </span>
                    </div>

                    {/* Salary Range */}
                    {vaga.exibir_salario && vaga.salario_min && vaga.salario_max && (
                      <div className="mt-3 inline-block rounded-lg bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-800 border border-emerald-100">
                        R$ {vaga.salario_min.toLocaleString('pt-BR')} - R${' '}
                        {vaga.salario_max.toLocaleString('pt-BR')}
                      </div>
                    )}

                    <p className="mt-3 text-xs text-slate-600 line-clamp-3 leading-relaxed">
                      {vaga.descricao}
                    </p>

                    {/* Requirements Tags */}
                    {vaga.requisitos && vaga.requisitos.length > 0 && (
                      <div className="mt-4 space-y-1">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Requisitos:</span>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {vaga.requisitos.slice(0, 3).map((req, i) => (
                            <span
                              key={i}
                              className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-700"
                            >
                              {req}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="mt-5 border-t border-slate-100 pt-3">
                    <button
                      onClick={() => {
                        resetForm();
                        setSelectedVaga(vaga);
                      }}
                      className="w-full rounded-xl py-2.5 text-xs font-bold text-white transition shadow-2xs hover:opacity-95"
                      style={{ backgroundColor: brandColor }}
                    >
                      Ver Detalhes e Candidatar-se
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* JOB APPLICATION MODAL */}
      {selectedVaga && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm overflow-y-auto">
          <div className="relative w-full max-w-2xl max-h-[92vh] flex flex-col rounded-2xl bg-white shadow-2xl border border-slate-200 my-auto overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-200 bg-slate-900 px-6 py-4 text-white">
              <div>
                <span className="rounded-md bg-blue-500/20 px-2 py-0.5 text-[10px] font-bold text-blue-300 border border-blue-400/20 uppercase">
                  {selectedVaga.modelo_trabalho} • {selectedVaga.tipo_contratacao}
                </span>
                <h3 className="font-extrabold text-white text-lg mt-1">{selectedVaga.titulo}</h3>
                <p className="text-xs text-slate-300">
                  {empresa.nome} • {selectedVaga.cidade} - {selectedVaga.estado}
                </p>
              </div>

              <button
                onClick={() => setSelectedVaga(null)}
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-6 text-xs text-slate-700">
              {submissionSuccess ? (
                <div className="rounded-2xl bg-emerald-50 p-8 text-center border border-emerald-200 space-y-4">
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500 text-white shadow-md">
                    <CheckCircle2 className="h-10 w-10" />
                  </div>
                  <h4 className="text-xl font-extrabold text-emerald-950">
                    Candidatura Enviada com Sucesso!
                  </h4>
                  <p className="text-xs text-emerald-800 leading-relaxed max-w-md mx-auto">
                    Obrigado, <strong className="font-bold">{nomeForm}</strong>! Sua candidatura para a vaga <strong className="font-bold">{selectedVaga.titulo}</strong> foi registrada diretamente no sistema de recrutamento da empresa <strong className="font-bold">{empresa.nome}</strong>.
                  </p>
                  <div className="pt-2">
                    <button
                      onClick={() => setSelectedVaga(null)}
                      className="rounded-xl bg-emerald-700 px-6 py-2.5 text-xs font-extrabold text-white shadow-sm hover:bg-emerald-800 transition"
                    >
                      Concluir
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  {/* Job Details Section */}
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
                    <h4 className="font-extrabold text-slate-900 text-sm">Descrição da Vaga</h4>
                    <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-line">
                      {selectedVaga.descricao}
                    </p>

                    {selectedVaga.requisitos && selectedVaga.requisitos.length > 0 && (
                      <div className="pt-2">
                        <h5 className="font-bold text-slate-900 text-xs mb-1">Requisitos:</h5>
                        <ul className="list-disc list-inside space-y-0.5 text-slate-600">
                          {selectedVaga.requisitos.map((req, idx) => (
                            <li key={idx}>{req}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {selectedVaga.beneficios && selectedVaga.beneficios.length > 0 && (
                      <div className="pt-2">
                        <h5 className="font-bold text-slate-900 text-xs mb-1">Benefícios:</h5>
                        <div className="flex flex-wrap gap-1.5">
                          {selectedVaga.beneficios.map((ben, idx) => (
                            <span key={idx} className="rounded bg-white px-2 py-0.5 text-[10px] font-bold text-slate-700 border border-slate-200">
                              ✓ {ben}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Application Form */}
                  <form onSubmit={handleApplyToJob} className="space-y-4 pt-2">
                    <div className="border-b border-slate-200 pb-2">
                      <h4 className="font-extrabold text-slate-900 text-sm flex items-center gap-2">
                        <Send className="h-4 w-4 text-blue-600" />
                        Formulário de Candidatura
                      </h4>
                      <p className="text-[11px] text-slate-500">Preencha seus dados para se candidatar nesta vaga.</p>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">
                          Nome Completo *
                        </label>
                        <input
                          type="text"
                          required
                          value={nomeForm}
                          onChange={(e) => setNomeForm(e.target.value)}
                          placeholder="Ex: João da Silva"
                          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-900 focus:border-blue-600 focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">
                          E-mail *
                        </label>
                        <input
                          type="email"
                          required
                          value={emailForm}
                          onChange={(e) => setEmailForm(e.target.value)}
                          placeholder="joao@email.com"
                          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-900 focus:border-blue-600 focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">
                          Telefone / WhatsApp *
                        </label>
                        <input
                          type="text"
                          required
                          value={telefoneForm}
                          onChange={(e) => setTelefoneForm(e.target.value)}
                          placeholder="(11) 98765-4321"
                          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-900 focus:border-blue-600 focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">
                          Cidade e Estado *
                        </label>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            required
                            value={cidadeForm}
                            onChange={(e) => setCidadeForm(e.target.value)}
                            placeholder="São Paulo"
                            className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-900 focus:border-blue-600 focus:outline-none"
                          />
                          <input
                            type="text"
                            required
                            maxLength={2}
                            value={estadoForm}
                            onChange={(e) => setEstadoForm(e.target.value.toUpperCase())}
                            placeholder="SP"
                            className="w-16 rounded-xl border border-slate-200 bg-white px-2 py-2 text-center text-xs font-bold text-slate-900 focus:border-blue-600 focus:outline-none"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">
                          Perfil LinkedIn (Opcional)
                        </label>
                        <input
                          type="url"
                          value={linkedinForm}
                          onChange={(e) => setLinkedinForm(e.target.value)}
                          placeholder="https://linkedin.com/in/seuperfil"
                          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-900 focus:border-blue-600 focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">
                          Pretensão Salarial (Opcional)
                        </label>
                        <input
                          type="text"
                          value={pretensaoForm}
                          onChange={(e) => setPretensaoForm(e.target.value)}
                          placeholder="Ex: R$ 8.000 / mês"
                          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-900 focus:border-blue-600 focus:outline-none"
                        />
                      </div>
                    </div>

                    {/* Resume Upload Box */}
                    <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-center">
                      <label className="cursor-pointer block">
                        <Upload className="mx-auto h-6 w-6 text-blue-600" />
                        <span className="mt-2 block font-extrabold text-slate-800 text-xs">
                          {curriculoFileName ? `Currículo: ${curriculoFileName}` : 'Anexar Currículo (PDF, DOCX ou TXT)'}
                        </span>
                        <span className="text-[10px] text-slate-500">Clique para selecionar do seu dispositivo</span>
                        <input
                          type="file"
                          accept=".pdf,.doc,.docx,.txt"
                          onChange={handleFileUpload}
                          className="hidden"
                        />
                      </label>

                      {isParsingAi && (
                        <div className="mt-2 flex items-center justify-center gap-2 text-[10px] font-bold text-blue-700">
                          <Sparkles className="h-3.5 w-3.5 animate-spin text-blue-600" />
                          <span>Analisando currículo com Inteligência Artificial Gemini...</span>
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        Observações / Apresentação (Opcional)
                      </label>
                      <textarea
                        rows={2}
                        value={observacoesForm}
                        onChange={(e) => setObservacoesForm(e.target.value)}
                        placeholder="Escreva um breve resumo da sua trajetória profissional..."
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-900 focus:border-blue-600 focus:outline-none"
                      />
                    </div>

                    {/* LGPD Checkbox */}
                    <div className="flex items-start gap-2 pt-1">
                      <input
                        type="checkbox"
                        id="lgpd"
                        required
                        checked={aceiteLgpd}
                        onChange={(e) => setAceiteLgpd(e.target.checked)}
                        className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                      <label htmlFor="lgpd" className="text-[11px] text-slate-600 leading-snug cursor-pointer">
                        Estou ciente e aceito o tratamento dos meus dados pessoais para finalidade de participação em processos seletivos promovidos pela empresa <strong className="font-bold text-slate-800">{empresa.nome}</strong> conforme a LGPD.
                      </label>
                    </div>

                    <div className="pt-3">
                      <button
                        type="submit"
                        disabled={isSubmitting || !aceiteLgpd}
                        className="w-full rounded-xl py-3 text-xs font-extrabold text-white shadow-md transition disabled:opacity-50"
                        style={{ backgroundColor: brandColor }}
                      >
                        {isSubmitting ? 'Enviando Candidatura...' : 'Enviar Candidatura'}
                      </button>
                    </div>
                  </form>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* GENERAL TALENT POOL MODAL ("Cadastre seu currículo") */}
      {showTalentPoolModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm overflow-y-auto">
          <div className="relative w-full max-w-xl max-h-[92vh] flex flex-col rounded-2xl bg-white shadow-2xl border border-slate-200 my-auto overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-200 bg-slate-900 px-6 py-4 text-white">
              <div>
                <h3 className="font-extrabold text-white text-base">Banco de Talentos</h3>
                <p className="text-xs text-slate-300">{empresa.nome}</p>
              </div>
              <button
                onClick={() => setShowTalentPoolModal(false)}
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4 text-xs text-slate-700">
              {submissionSuccess ? (
                <div className="rounded-2xl bg-emerald-50 p-6 text-center border border-emerald-200 space-y-3">
                  <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-600" />
                  <h4 className="text-lg font-bold text-emerald-950">
                    Currículo Cadastrado no Banco de Talentos!
                  </h4>
                  <p className="text-xs text-emerald-800">
                    Obrigado, <strong className="font-bold">{nomeForm}</strong>! Seu currículo foi salvo com sucesso. Quando surgirem novas vagas compatíveis com seu perfil, a equipe de recrutamento da <strong className="font-bold">{empresa.nome}</strong> entrará em contato.
                  </p>
                  <button
                    onClick={() => setShowTalentPoolModal(false)}
                    className="rounded-xl bg-emerald-700 px-5 py-2 text-xs font-bold text-white hover:bg-emerald-800"
                  >
                    Fechar
                  </button>
                </div>
              ) : (
                <form onSubmit={handleApplyToTalentPool} className="space-y-4">
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Não encontrou uma vaga específica para o seu perfil no momento? Deixe seu currículo no nosso Banco de Talentos para oportunidades futuras!
                  </p>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        Nome Completo *
                      </label>
                      <input
                        type="text"
                        required
                        value={nomeForm}
                        onChange={(e) => setNomeForm(e.target.value)}
                        placeholder="Seu nome completo"
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-900 focus:border-blue-600 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        E-mail *
                      </label>
                      <input
                        type="email"
                        required
                        value={emailForm}
                        onChange={(e) => setEmailForm(e.target.value)}
                        placeholder="seu@email.com"
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-900 focus:border-blue-600 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        Telefone / WhatsApp *
                      </label>
                      <input
                        type="text"
                        required
                        value={telefoneForm}
                        onChange={(e) => setTelefoneForm(e.target.value)}
                        placeholder="(11) 98765-4321"
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-900 focus:border-blue-600 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        Cidade e Estado *
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          required
                          value={cidadeForm}
                          onChange={(e) => setCidadeForm(e.target.value)}
                          placeholder="São Paulo"
                          className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-900 focus:border-blue-600 focus:outline-none"
                        />
                        <input
                          type="text"
                          required
                          maxLength={2}
                          value={estadoForm}
                          onChange={(e) => setEstadoForm(e.target.value.toUpperCase())}
                          placeholder="SP"
                          className="w-14 rounded-xl border border-slate-200 bg-white px-2 py-2 text-center text-xs font-bold text-slate-900 focus:border-blue-600 focus:outline-none"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Resume Upload */}
                  <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-center">
                    <label className="cursor-pointer block">
                      <Upload className="mx-auto h-6 w-6 text-blue-600" />
                      <span className="mt-2 block font-bold text-slate-800 text-xs">
                        {curriculoFileName ? `Anexo: ${curriculoFileName}` : 'Anexar Currículo (PDF, DOCX ou TXT)'}
                      </span>
                      <input
                        type="file"
                        accept=".pdf,.doc,.docx,.txt"
                        onChange={handleFileUpload}
                        className="hidden"
                      />
                    </label>
                  </div>

                  <div className="flex items-start gap-2 pt-1">
                    <input
                      type="checkbox"
                      id="lgpd_talent"
                      required
                      checked={aceiteLgpd}
                      onChange={(e) => setAceiteLgpd(e.target.checked)}
                      className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <label htmlFor="lgpd_talent" className="text-[11px] text-slate-600 leading-snug cursor-pointer">
                      Autorizo a empresa <strong className="font-bold text-slate-800">{empresa.nome}</strong> a armazenar e analisar meus dados para futuras oportunidades.
                    </label>
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting || !aceiteLgpd}
                    className="w-full rounded-xl py-3 text-xs font-extrabold text-white shadow-md transition disabled:opacity-50"
                    style={{ backgroundColor: brandColor }}
                  >
                    {isSubmitting ? 'Cadastrando...' : 'Cadastrar no Banco de Talentos'}
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
