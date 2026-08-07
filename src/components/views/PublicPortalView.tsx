import React, { useState, useEffect } from 'react';
import {
  Globe,
  ExternalLink,
  Copy,
  Check,
  CheckCircle2,
  Briefcase,
  Users,
  Settings,
  Eye,
  Building2,
  Palette,
  Image as ImageIcon,
  Mail,
  Phone,
  Linkedin,
  Instagram,
  Save,
  Sparkles,
} from 'lucide-react';
import { dataService } from '../../services/dataService';
import { Empresa } from '../../types';
import { PublicCompanyPortal } from './PublicCompanyPortal';

export const PublicPortalView: React.FC = () => {
  const [activeEmpresa, setActiveEmpresa] = useState<Empresa>(dataService.getActiveEmpresa());
  const [activeTab, setActiveTab] = useState<'gerenciamento' | 'configuracao' | 'preview'>('gerenciamento');

  // Form State for Portal Configuration
  const [nomeExibido, setNomeExibido] = useState(activeEmpresa.nome || '');
  const [logoUrl, setLogoUrl] = useState(activeEmpresa.logo_url || '');
  const [bannerUrl, setBannerUrl] = useState(activeEmpresa.banner_url || '');
  const [descricao, setDescricao] = useState(activeEmpresa.descricao || '');
  const [corPrincipal, setCorPrincipal] = useState(activeEmpresa.cor_principal || '#0B2240');
  const [contatoEmail, setContatoEmail] = useState(activeEmpresa.contato_email || 'carreiras@' + activeEmpresa.nome.toLowerCase().replace(/[^a-z]/g, '') + '.com.br');
  const [contatoTelefone, setContatoTelefone] = useState(activeEmpresa.contato_telefone || '(11) 3000-0000');
  const [website, setWebsite] = useState(activeEmpresa.website || 'https://' + activeEmpresa.nome.toLowerCase().replace(/[^a-z]/g, '') + '.com.br');
  const [linkedinUrl, setLinkedinUrl] = useState(activeEmpresa.linkedin_url || '');
  const [instagramUrl, setInstagramUrl] = useState(activeEmpresa.instagram_url || '');

  const [copiedLink, setCopiedLink] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    const emp = dataService.getActiveEmpresa();
    setActiveEmpresa(emp);
    setNomeExibido(emp.nome || '');
    setLogoUrl(emp.logo_url || '');
    setBannerUrl(emp.banner_url || '');
    setDescricao(emp.descricao || '');
    setCorPrincipal(emp.cor_principal || '#0B2240');
    setContatoEmail(emp.contato_email || '');
    setContatoTelefone(emp.contato_telefone || '');
    setWebsite(emp.website || '');
    setLinkedinUrl(emp.linkedin_url || '');
    setInstagramUrl(emp.instagram_url || '');
  }, []);

  // Compute metrics for this specific company
  const publicVagasCount = dataService.getPublicVagasByEmpresa(activeEmpresa.id).length;
  const companyCandidaturasCount = dataService.getCandidaturas().length; // filterByEmpresa is built into getCandidaturas
  const talentPoolCount = dataService
    .getCandidatos()
    .filter((c) => c.origem === 'banco_talentos_portal').length;

  const publicPortalUrl = `${window.location.origin}/vagas/${activeEmpresa.id}`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(publicPortalUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const handleOpenPortalInNewTab = () => {
    // Open full portal in new browser window/tab
    window.open(publicPortalUrl, '_blank');
  };

  const handleSaveConfig = (e: React.FormEvent) => {
    e.preventDefault();

    dataService.updateEmpresaPortalConfig(activeEmpresa.id, {
      nome: nomeExibido,
      logo_url: logoUrl,
      banner_url: bannerUrl,
      descricao: descricao,
      cor_principal: corPrincipal,
      contato_email: contatoEmail,
      contato_telefone: contatoTelefone,
      website: website,
      linkedin_url: linkedinUrl,
      instagram_url: instagramUrl,
    });

    setActiveEmpresa(dataService.getActiveEmpresa());
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner (Area Administrativa do Portal de Vagas da Empresa) */}
      <div className="flex flex-col gap-4 rounded-2xl bg-white p-6 shadow-xs border border-slate-200 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs font-black text-emerald-700 uppercase tracking-wider">
              Portal Online & Publicado
            </span>
            <span className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-0.5 text-[10px] font-black text-blue-700 border border-blue-200">
              Tenant ID: {activeEmpresa.id}
            </span>
          </div>
          <h1 className="mt-1 text-2xl font-black text-[#0B2240] tracking-tight">
            Gestão do Portal de Vagas — {activeEmpresa.nome}
          </h1>
          <p className="mt-1 text-xs font-medium text-slate-500">
            Link público exclusivo para atração de talentos, candidaturas externas e cadastro no Banco de Talentos.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleCopyLink}
            className="flex items-center gap-2 rounded-xl bg-slate-100 border border-slate-200 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-200 transition shadow-2xs"
          >
            {copiedLink ? (
              <>
                <Check className="h-4 w-4 text-emerald-600" />
                <span className="text-emerald-700">Link Copiado!</span>
              </>
            ) : (
              <>
                <Copy className="h-4 w-4 text-slate-500" />
                <span>Copiar Link</span>
              </>
            )}
          </button>

          <button
            onClick={handleOpenPortalInNewTab}
            className="flex items-center gap-2 rounded-xl bg-[#0B2240] px-4 py-2 text-xs font-bold text-white hover:bg-[#123157] transition shadow-xs"
          >
            <ExternalLink className="h-4 w-4" />
            Abrir Portal Público
          </button>
        </div>
      </div>

      {/* Subnavigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => setActiveTab('gerenciamento')}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-extrabold transition ${
            activeTab === 'gerenciamento'
              ? 'bg-[#0B2240] text-white shadow-sm'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Globe className="h-4 w-4" />
          Status & Métricas
        </button>

        <button
          onClick={() => setActiveTab('configuracao')}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-extrabold transition ${
            activeTab === 'configuracao'
              ? 'bg-[#0B2240] text-white shadow-sm'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Settings className="h-4 w-4" />
          Configurar Marca & Visual
        </button>

        <button
          onClick={() => setActiveTab('preview')}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-extrabold transition ${
            activeTab === 'preview'
              ? 'bg-[#0B2240] text-white shadow-sm'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Eye className="h-4 w-4" />
          Pré-visualização Ao Vivo
        </button>
      </div>

      {/* TAB 1: GERENCIAMENTO & MÉTRICAS */}
      {activeTab === 'gerenciamento' && (
        <div className="space-y-6">
          {/* Public Link Card */}
          <div className="rounded-2xl bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 p-6 text-white shadow-lg space-y-4">
            <div className="flex items-center justify-between">
              <div className="inline-flex items-center gap-2 rounded-full bg-blue-500/20 px-3 py-1 text-xs font-bold text-blue-200 border border-blue-400/20">
                <Globe className="h-3.5 w-3.5" />
                URL do Portal de Vagas Multiempresa
              </div>
              <span className="text-xs font-bold text-emerald-400 flex items-center gap-1">
                <CheckCircle2 className="h-4 w-4" /> Ativo para Candidaturas
              </span>
            </div>

            <div>
              <p className="text-xs text-slate-300">Endereço público direto da empresa:</p>
              <div className="mt-2 flex items-center gap-2 rounded-xl bg-white/10 p-2.5 backdrop-blur-md border border-white/15">
                <input
                  type="text"
                  readOnly
                  value={publicPortalUrl}
                  className="w-full bg-transparent font-mono text-xs text-white focus:outline-none selection:bg-blue-500"
                />
                <button
                  onClick={handleCopyLink}
                  className="shrink-0 rounded-lg bg-white px-3 py-1.5 text-xs font-bold text-slate-900 hover:bg-slate-100 transition"
                >
                  {copiedLink ? 'Copiado!' : 'Copiar'}
                </button>
              </div>
            </div>

            <p className="text-[11px] text-blue-200 leading-relaxed">
              * Divulgue esse link em suas redes sociais, site institucional ou anúncios para direcionar os candidatos diretamente para a página exclusiva de vagas da <strong className="text-white font-bold">{activeEmpresa.nome}</strong>.
            </p>
          </div>

          {/* Metrics Grid */}
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs flex items-center gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-700 font-bold border border-blue-100">
                <Briefcase className="h-6 w-6" />
              </div>
              <div>
                <span className="text-2xl font-black text-slate-900">{publicVagasCount}</span>
                <p className="text-xs font-bold text-slate-500">Vagas Publicadas no Portal</p>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs flex items-center gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700 font-bold border border-emerald-100">
                <Users className="h-6 w-6" />
              </div>
              <div>
                <span className="text-2xl font-black text-slate-900">{companyCandidaturasCount}</span>
                <p className="text-xs font-bold text-slate-500">Candidaturas Recebidas</p>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs flex items-center gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-purple-50 text-purple-700 font-bold border border-purple-100">
                <Sparkles className="h-6 w-6" />
              </div>
              <div>
                <span className="text-2xl font-black text-slate-900">{talentPoolCount}</span>
                <p className="text-xs font-bold text-slate-500">Inscritos Banco de Talentos</p>
              </div>
            </div>
          </div>

          {/* Published Jobs Preview for this company */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
            <h3 className="font-black text-slate-900 text-base">Vagas Ativas no Portal da Empresa</h3>
            {publicVagasCount === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-xs text-slate-500">
                Nenhuma vaga publicada no momento. Crie ou publique uma vaga no módulo de Recrutamento para que ela apareça no portal público.
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {dataService.getPublicVagasByEmpresa(activeEmpresa.id).map((vaga) => (
                  <div key={vaga.id} className="rounded-xl border border-slate-200 p-4 bg-slate-50 flex items-start justify-between gap-3">
                    <div>
                      <span className="rounded bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-800">
                        {vaga.modelo_trabalho}
                      </span>
                      <h4 className="font-bold text-slate-900 text-xs mt-1">{vaga.titulo}</h4>
                      <p className="text-[10px] text-slate-500">{vaga.cidade} - {vaga.estado}</p>
                    </div>
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-black text-emerald-800">
                      Publicada
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: CONFIGURAÇÃO DE MARCA E VISUAL DO PORTAL */}
      {activeTab === 'configuracao' && (
        <form onSubmit={handleSaveConfig} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div>
              <h3 className="font-black text-slate-900 text-base">Personalização do Portal de Vagas</h3>
              <p className="text-xs text-slate-500">Ajuste o nome, cores, logo, e informações exibidas para os candidatos.</p>
            </div>

            {savedSuccess && (
              <div className="flex items-center gap-1.5 rounded-xl bg-emerald-50 border border-emerald-200 px-3 py-1.5 text-xs font-extrabold text-emerald-800">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                Configurações Salvas!
              </div>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1">
                Nome da Empresa Exibido *
              </label>
              <input
                type="text"
                required
                value={nomeExibido}
                onChange={(e) => setNomeExibido(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-medium text-slate-900 focus:bg-white focus:border-blue-600 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1">
                Cor Principal da Marca (Hex) *
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={corPrincipal}
                  onChange={(e) => setCorPrincipal(e.target.value)}
                  className="h-9 w-12 rounded-lg border border-slate-200 cursor-pointer p-0.5"
                />
                <input
                  type="text"
                  value={corPrincipal}
                  onChange={(e) => setCorPrincipal(e.target.value)}
                  className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-bold text-slate-900 focus:bg-white focus:border-blue-600 focus:outline-none"
                />
              </div>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-800 mb-1">
                URL da Logo da Empresa
              </label>
              <input
                type="url"
                value={logoUrl}
                onChange={(e) => setLogoUrl(e.target.value)}
                placeholder="https://exemplo.com/logo.png"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-medium text-slate-900 focus:bg-white focus:border-blue-600 focus:outline-none"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-800 mb-1">
                URL da Imagem de Banner/Capa (Opcional)
              </label>
              <input
                type="url"
                value={bannerUrl}
                onChange={(e) => setBannerUrl(e.target.value)}
                placeholder="https://images.unsplash.com/photo-1486406146926-c627a92ad1ab"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-medium text-slate-900 focus:bg-white focus:border-blue-600 focus:outline-none"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-800 mb-1">
                Descrição Institucional da Empresa (Apresentação aos Candidatos)
              </label>
              <textarea
                rows={3}
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                placeholder="Descreva a missão, valores e cultura da empresa..."
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-medium text-slate-900 focus:bg-white focus:border-blue-600 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1">
                E-mail de Contato para Dúvidas
              </label>
              <input
                type="email"
                value={contatoEmail}
                onChange={(e) => setContatoEmail(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-medium text-slate-900 focus:bg-white focus:border-blue-600 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1">
                Telefone de Contato
              </label>
              <input
                type="text"
                value={contatoTelefone}
                onChange={(e) => setContatoTelefone(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-medium text-slate-900 focus:bg-white focus:border-blue-600 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1">
                URL do Website Oficial
              </label>
              <input
                type="url"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-medium text-slate-900 focus:bg-white focus:border-blue-600 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1">
                URL do LinkedIn
              </label>
              <input
                type="url"
                value={linkedinUrl}
                onChange={(e) => setLinkedinUrl(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-medium text-slate-900 focus:bg-white focus:border-blue-600 focus:outline-none"
              />
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 flex justify-end">
            <button
              type="submit"
              className="flex items-center gap-2 rounded-xl bg-[#0B2240] px-6 py-2.5 text-xs font-extrabold text-white transition hover:bg-[#123157] shadow-sm"
            >
              <Save className="h-4 w-4" />
              Salvar Alterações
            </button>
          </div>
        </form>
      )}

      {/* TAB 3: LIVE INTERACTIVE PREVIEW */}
      {activeTab === 'preview' && (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs space-y-3">
          <div className="flex items-center justify-between px-2">
            <div>
              <h3 className="font-black text-slate-900 text-sm">Pré-visualização do Portal Público</h3>
              <p className="text-[11px] text-slate-500">
                Esta é a exata experiência que o candidato visualizará ao acessar <code className="bg-slate-100 px-1 py-0.5 rounded font-mono text-[10px] text-blue-700">{publicPortalUrl}</code>.
              </p>
            </div>
            <button
              onClick={handleOpenPortalInNewTab}
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-100"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Abrir em Nova Aba
            </button>
          </div>

          <div className="rounded-xl border border-slate-300 overflow-hidden shadow-inner max-h-[750px] overflow-y-auto bg-slate-100">
            <PublicCompanyPortal empresaId={activeEmpresa.id} isPreviewMode={true} />
          </div>
        </div>
      )}
    </div>
  );
};
