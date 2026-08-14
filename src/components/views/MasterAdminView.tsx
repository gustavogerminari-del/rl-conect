import React, { useState } from 'react';
import {
  Crown,
  Building2,
  Plus,
  Edit3,
  Power,
  ShieldCheck,
  Package,
  CreditCard,
  Search,
  Check,
  X,
  Database,
  BarChart3,
  Activity,
  Layers,
} from 'lucide-react';
import { dataService } from '../../services/dataService';
import { Empresa, ModuloChave } from '../../types';

export const MasterAdminView: React.FC = () => {
  const [empresas, setEmpresas] = useState(dataService.getEmpresas());
  const [selectedEmpresa, setSelectedEmpresa] = useState<Empresa | null>(empresas[0] || null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'dashboard' | 'empresas' | 'usuarios' | 'planos' | 'modulos' | 'relatorios' | 'configuracoes' | 'ia' | 'parceiros'>('dashboard');

  // Form state
  const [nomeForm, setNomeForm] = useState('');
  const [cnpjForm, setCnpjForm] = useState('');
  const [cidadeForm, setCidadeForm] = useState('');
  const [estadoForm, setEstadoForm] = useState('');

  const refreshData = () => {
    setEmpresas(dataService.getEmpresas());
  };

  const handleCreateEmpresa = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nomeForm || !cnpjForm) return;

    dataService.createEmpresa({
      nome: nomeForm,
      cnpj: cnpjForm,
      logo_url: 'https://images.unsplash.com/photo-1560179707-f14e90ef3623?w=150&auto=format&fit=crop&q=80',
      plano_id: 'pro',
      status: 'ativa',
      endereco: 'Av. Brasil, 100',
      cidade: cidadeForm || 'São Paulo',
      estado: estadoForm || 'SP',
    });

    setNomeForm('');
    setCnpjForm('');
    setCidadeForm('');
    setEstadoForm('');
    setShowCreateModal(false);
    refreshData();
  };

  const handleToggleStatus = (id: string, currentStatus: Empresa['status']) => {
    const nextStatus = currentStatus === 'ativa' ? 'suspensa' : 'ativa';
    dataService.updateEmpresa(id, { status: nextStatus });
    refreshData();
  };

  const filteredEmpresas = empresas.filter(
    (e) =>
      e.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
      e.cnpj.includes(searchTerm)
  );

  const activeEmpresaModulos = selectedEmpresa
    ? dataService.getEmpresaModulos(selectedEmpresa.id)
    : [];

  const planos = dataService.getPlanos();
  const currentUser = dataService.getCurrentUser();

  return (
    <div className="space-y-6">
      {/* Top Banner - PAINEL EXCLUSIVO MASTER */}
      <div className="relative overflow-hidden rounded-2xl bg-slate-950 p-6 text-white shadow-xl border border-slate-800">
        <div className="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/20">
              <Crown className="h-6 w-6 font-extrabold" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-extrabold tracking-tight uppercase">PAINEL EXCLUSIVO MASTER</h1>
                <span className="rounded-full bg-amber-500/20 px-2.5 py-0.5 text-[10px] font-extrabold uppercase text-amber-400 border border-amber-500/30">
                  PLATAFORMA MULTI-TENANT
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-400">
                Controle irrestrito do SaaS, faturamento, clientes e infraestrutura Firebase Cloud.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 rounded-xl bg-amber-500 px-4 py-2.5 text-xs font-extrabold text-slate-950 transition hover:bg-amber-400 shadow-md shadow-amber-500/20"
            >
              <Plus className="h-4 w-4" />
              Nova Empresa
            </button>
          </div>
        </div>

        {/* Info status bar */}
        <div className="mt-4 pt-4 border-t border-slate-800/80 grid grid-cols-2 sm:grid-cols-4 gap-3 text-[11px] text-slate-400">
          <div>Firebase Auth: <span className="text-emerald-400 font-bold">Ativo</span></div>
          <div>UID: <span className="font-mono text-slate-300">{currentUser?.id || '-'}</span></div>
          <div>E-mail: <span className="text-slate-200 font-medium">{currentUser?.email || '-'}</span></div>
          <div>Role: <span className="text-amber-400 font-bold">{currentUser?.role || '-'}</span></div>
        </div>
      </div>

      {/* Navigation Subtabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-2 scrollbar-none border-b border-slate-200">
        {[
          { id: 'dashboard', label: 'Dashboard Master', icon: BarChart3 },
          { id: 'empresas', label: 'Empresas Cadastradas', icon: Building2 },
          { id: 'usuarios', label: 'Usuários e Permissões', icon: ShieldCheck },
          { id: 'planos', label: 'Planos & SaaS', icon: Package },
          { id: 'modulos', label: 'Módulos', icon: Layers },
          { id: 'relatorios', label: 'Relatórios', icon: Activity },
          { id: 'configuracoes', label: 'Configurações', icon: Database },
          { id: 'ia', label: 'Inteligência Artificial', icon: Crown },
          { id: 'parceiros', label: 'Parceiros & Vantagens', icon: CreditCard },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-bold transition whitespace-nowrap ${
                isActive
                  ? 'bg-amber-500 text-slate-950 shadow-sm font-extrabold'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* DASHBOARD MASTER TAB */}
      {activeTab === 'dashboard' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-extrabold text-slate-900">Visão Consolida da Plataforma</h2>
              <p className="text-xs text-slate-500">Métricas globais do SaaS MAIS RH em tempo real</p>
            </div>
            <span className="rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 px-3 py-1 text-xs font-bold">
              ● SaaS Operacional • Firebase Firestore
            </span>
          </div>

          {/* Metric Cards Grid matching Screenshot 2 */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-2xl border border-slate-800 bg-slate-950 p-5 text-white shadow-md">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>MRR Total Ativo</span>
                <span className="text-emerald-400 font-bold">$</span>
              </div>
              <div className="mt-2 text-2xl font-black text-white">R$ 2.580</div>
              <p className="mt-1 text-[11px] text-emerald-400 font-semibold">↑ +14.2% em relação ao mês anterior</p>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-950 p-5 text-white shadow-md">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>ARR Projeção Anual</span>
                <span className="text-amber-400 font-bold">📊</span>
              </div>
              <div className="mt-2 text-2xl font-black text-amber-400">R$ 30.960</div>
              <p className="mt-1 text-[11px] text-slate-400">Contratos ativos multiplicados por 12</p>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-950 p-5 text-white shadow-md">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>Empresas Clientes</span>
                <span className="text-blue-400 font-bold">🏢</span>
              </div>
              <div className="mt-2 text-2xl font-black text-white">2 <span className="text-xs font-normal text-slate-400">/ 2 total</span></div>
              <p className="mt-1 text-[11px] text-slate-400">0 pendentes de pagamento</p>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-950 p-5 text-white shadow-md">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>Usuários e Colaboradores</span>
                <span className="text-indigo-400 font-bold">👤</span>
              </div>
              <div className="mt-2 text-2xl font-black text-white">2 <span className="text-xs font-normal text-slate-400">usuários</span></div>
              <p className="mt-1 text-[11px] text-blue-400 font-semibold">1850 colaboradores no DP/Ponto</p>
            </div>
          </div>

          {/* Module Adhesion Bar Charts & Alerts Grid */}
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2 rounded-2xl border border-slate-800 bg-slate-950 p-6 text-white shadow-md space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h3 className="font-extrabold text-sm text-white flex items-center gap-2">
                  <Layers className="h-4 w-4 text-amber-400" />
                  Adesão aos Módulos da Plataforma
                </h3>
              </div>

              <div className="space-y-3.5 text-xs">
                {[
                  { name: 'Recrutamento & Seleção', count: '14 de 14 clientes (100%)', pct: 100, color: 'bg-indigo-500' },
                  { name: 'Gestão de Benefícios', count: '12 de 14 clientes (85%)', pct: 85, color: 'bg-emerald-400' },
                  { name: 'Departamento Pessoal', count: '11 de 14 clientes (80%)', pct: 80, color: 'bg-cyan-400' },
                  { name: 'Ponto Eletrônico', count: '10 de 14 clientes (71%)', pct: 71, color: 'bg-amber-400' },
                  { name: 'Folha de Pagamento', count: '8 de 14 clientes (57%)', pct: 57, color: 'bg-rose-500' },
                ].map((item, idx) => (
                  <div key={idx} className="space-y-1">
                    <div className="flex justify-between text-[11px]">
                      <span className="font-semibold text-slate-200">{item.name}</span>
                      <span className="text-slate-400">{item.count}</span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-slate-800 overflow-hidden">
                      <div className={`h-full ${item.color} rounded-full`} style={{ width: `${item.pct}%` }}></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-950 p-6 text-white shadow-md space-y-4">
              <h3 className="font-extrabold text-sm text-amber-400 flex items-center gap-2 border-b border-slate-800 pb-3">
                ⚠️ Alertas & Status
              </h3>

              <div className="space-y-3 text-xs">
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3">
                  <div className="font-bold text-amber-300">Renovação de Contrato Próxima</div>
                  <div className="mt-1 text-[11px] text-slate-300">Grupo Alpha Logística vence em 01/08/2026.</div>
                </div>

                <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3">
                  <div className="font-bold text-rose-300">Fatura Pendente de Liquidação</div>
                  <div className="mt-1 text-[11px] text-slate-300">OmniTech Softwares (R$ 1.290,00).</div>
                </div>

                <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3">
                  <div className="font-bold text-emerald-300">Inteligência Artificial OK</div>
                  <div className="mt-1 text-[11px] text-slate-300">Consumo diário: 142k tokens. Taxa de erro &lt; 0.01%.</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* USUARIOS & PERMISSOES TAB */}
      {activeTab === 'usuarios' && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h2 className="font-extrabold text-base text-slate-900">Usuários & Permissões da Plataforma Master</h2>
              <p className="text-xs text-slate-500">Gestão global de acessos por empresa e permissões RLS</p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold uppercase text-slate-500">
                <tr>
                  <th className="p-3">Usuário</th>
                  <th className="p-3">E-mail</th>
                  <th className="p-3">Perfil / Role</th>
                  <th className="p-3">Empresa Principal</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                <tr className="hover:bg-slate-50">
                  <td className="p-3 font-bold text-slate-900">Gustavo Germinari</td>
                  <td className="p-3 text-slate-600">gustavo.germinari@gmail.com</td>
                  <td className="p-3"><span className="rounded-md bg-amber-100 px-2 py-0.5 font-bold text-amber-800 text-[10px]">MASTER_ADMIN</span></td>
                  <td className="p-3">RL CONNECT (Holding)</td>
                  <td className="p-3"><span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">Ativo</span></td>
                  <td className="p-3 text-right"><button className="rounded-lg bg-slate-100 px-2.5 py-1 font-bold text-slate-700 hover:bg-slate-200">Editar</button></td>
                </tr>
                <tr className="hover:bg-slate-50">
                  <td className="p-3 font-bold text-slate-900">Rafaela Lourenço</td>
                  <td className="p-3 text-slate-600">rh04consultoria@gmail.com</td>
                  <td className="p-3"><span className="rounded-md bg-indigo-100 px-2 py-0.5 font-bold text-indigo-800 text-[10px]">EMPRESA_ADMIN</span></td>
                  <td className="p-3">R Lourenço RH</td>
                  <td className="p-3"><span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">Ativo</span></td>
                  <td className="p-3 text-right"><button className="rounded-lg bg-slate-100 px-2.5 py-1 font-bold text-slate-700 hover:bg-slate-200">Editar</button></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* RELATORIOS TAB */}
      {activeTab === 'relatorios' && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
          <h2 className="font-extrabold text-base text-slate-900">Relatórios Executivos da Plataforma (MASTER)</h2>
          <p className="text-xs text-slate-500">Métricas de faturamento, engajamento e utilização de cota por tenant.</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50">
              <div className="font-bold text-slate-800 text-xs">Receita e Faturamento Média</div>
              <div className="mt-2 text-xl font-black text-slate-900">R$ 1.150,00 /mês</div>
              <div className="mt-1 text-[11px] text-slate-500">Ticket médio por cliente (MRR / Tenants)</div>
            </div>
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50">
              <div className="font-bold text-slate-800 text-xs">Taxa de Churn (Cancelamento)</div>
              <div className="mt-2 text-xl font-black text-emerald-600">&lt; 0.1% ao ano</div>
              <div className="mt-1 text-[11px] text-slate-500">Retenção de 99.9% nos últimos 12 meses</div>
            </div>
          </div>
        </div>
      )}

      {/* CONFIGURACOES TAB */}
      {activeTab === 'configuracoes' && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
          <h2 className="font-extrabold text-base text-slate-900">Segurança e Auditoria Global</h2>
          <p className="text-xs text-slate-500">Regras do Supabase RLS, chaves de API do Gemini e logs de auditoria.</p>
          <div className="space-y-3 text-xs">
            <div className="p-3 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-between">
              <div>
                <div className="font-bold text-slate-800">Políticas de RLS Supabase (Row Level Security)</div>
                <div className="text-[11px] text-slate-500">Isolamento rigoroso por empresa_id em todas as consultas SQL</div>
              </div>
              <span className="rounded-full bg-emerald-100 px-3 py-1 font-extrabold text-emerald-800 text-[10px]">ATIVO (100%)</span>
            </div>
            <div className="p-3 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-between">
              <div>
                <div className="font-bold text-slate-800">Supabase Realtime Connection</div>
                <div className="text-[11px] text-slate-500">Sincronização instantânea de candidaturas e folha</div>
              </div>
              <span className="rounded-full bg-emerald-100 px-3 py-1 font-extrabold text-emerald-800 text-[10px]">CONECTADO</span>
            </div>
          </div>
        </div>
      )}

      {/* IA TAB */}
      {activeTab === 'ia' && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
          <h2 className="font-extrabold text-base text-slate-900">Inteligência Artificial & Gemini Integration</h2>
          <p className="text-xs text-slate-500">Modelos configurados: Gemini 2.5 Flash, Gemini Pro e Triagem Automática de CVs.</p>
          <div className="rounded-xl bg-slate-950 p-4 text-white text-xs space-y-2">
            <div className="text-amber-400 font-bold">Status do Engine IA: Operacional</div>
            <p className="text-slate-300">Triagem de currículos, geração de descrição de vagas e assistente com IA ativa para todas as empresas.</p>
          </div>
        </div>
      )}

      {/* PARCEIROS TAB */}
      {activeTab === 'parceiros' && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
          <h2 className="font-extrabold text-base text-slate-900">Parceiros e Convênios de Benefícios</h2>
          <p className="text-xs text-slate-500">Integração com ecossistema de saúde, VR, VA e VT para empresas clientes.</p>
          <div className="text-xs text-slate-600">Nenhum parceiro pendente de aprovação no momento.</div>
        </div>
      )}

      {/* Content depending on activeTab */}
      {activeTab === 'empresas' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar empresa por nome ou CNPJ..."
                className="w-full rounded-xl border border-slate-200 bg-white pl-9 pr-4 py-2 text-xs text-slate-800 placeholder-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredEmpresas.map((emp) => (
              <div
                key={emp.id}
                onClick={() => setSelectedEmpresa(emp)}
                className={`cursor-pointer rounded-2xl border p-5 transition shadow-sm ${
                  selectedEmpresa?.id === emp.id
                    ? 'border-indigo-600 bg-indigo-50/40 ring-2 ring-indigo-600/20'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <img
                      src={emp.logo_url}
                      alt={emp.nome}
                      className="h-10 w-10 rounded-xl object-cover border border-slate-200"
                    />
                    <div>
                      <h3 className="font-bold text-slate-900 text-sm">{emp.nome}</h3>
                      <p className="text-[11px] text-slate-500">CNPJ: {emp.cnpj}</p>
                    </div>
                  </div>

                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[10px] font-extrabold uppercase ${
                      emp.status === 'ativa'
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-rose-100 text-rose-800'
                    }`}
                  >
                    {emp.status}
                  </span>
                </div>

                <div className="mt-4 border-t border-slate-100 pt-3 text-xs space-y-1 text-slate-600">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Plano Atual:</span>
                    <span className="font-bold text-slate-800 uppercase">{emp.plano_id}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Localização:</span>
                    <span className="font-medium">{emp.cidade} - {emp.estado}</span>
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleToggleStatus(emp.id, emp.status);
                    }}
                    className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                      emp.status === 'ativa'
                        ? 'bg-rose-50 text-rose-700 hover:bg-rose-100'
                        : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                    }`}
                  >
                    <Power className="h-3.5 w-3.5" />
                    {emp.status === 'ativa' ? 'Suspender' : 'Ativar'}
                  </button>

                  <button
                    onClick={() => {
                      dataService.setActiveEmpresa(emp.id);
                    }}
                    className="flex items-center gap-1 rounded-lg bg-indigo-50 px-3 py-1.5 text-xs font-bold text-indigo-700 hover:bg-indigo-100"
                  >
                    Entrar no Tenant
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'modulos' && selectedEmpresa && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Ativação de Módulos para {selectedEmpresa.nome}
              </h2>
              <p className="text-xs text-slate-500">
                Ative ou desative módulos contratados em tempo real sem impacto no banco de dados.
              </p>
            </div>
            <span className="rounded-lg bg-indigo-50 px-3 py-1 text-xs font-bold text-indigo-700">
              CNPJ: {selectedEmpresa.cnpj}
            </span>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {activeEmpresaModulos.map(({ modulo, ativo }) => (
              <div
                key={modulo.id}
                className={`flex flex-col justify-between rounded-xl border p-4 transition ${
                  ativo
                    ? 'border-emerald-200 bg-emerald-50/30'
                    : 'border-slate-200 bg-slate-50/50 opacity-60'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900 text-sm">{modulo.nome}</span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        ativo ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'
                      }`}
                    >
                      {ativo ? 'Ativo' : 'Desativado'}
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-slate-500 leading-relaxed">{modulo.descricao}</p>
                </div>

                <div className="mt-4 border-t border-slate-100 pt-3">
                  <button
                    onClick={() =>
                      dataService.toggleEmpresaModulo(selectedEmpresa.id, modulo.id, !ativo)
                    }
                    className={`w-full rounded-xl py-2 text-xs font-bold transition ${
                      ativo
                        ? 'bg-rose-100 text-rose-800 hover:bg-rose-200'
                        : 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-md'
                    }`}
                  >
                    {ativo ? 'Desativar Módulo' : 'Ativar Módulo'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'planos' && (
        <div className="grid gap-6 md:grid-cols-3">
          {planos.map((plano) => (
            <div
              key={plano.id}
              className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-6 shadow-sm hover:border-indigo-300"
            >
              <div>
                <div className="flex items-center justify-between">
                  <h3 className="font-extrabold text-slate-900 text-base">{plano.nome}</h3>
                  <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-bold text-indigo-700">
                    SaaS
                  </span>
                </div>

                <div className="mt-4">
                  <span className="text-3xl font-black text-slate-900">
                    R$ {plano.preco_mensal.toLocaleString('pt-BR')}
                  </span>
                  <span className="text-xs text-slate-500"> /mês</span>
                </div>

                <div className="mt-6 space-y-2 border-t border-slate-100 pt-4 text-xs">
                  {plano.recursos.map((rec, i) => (
                    <div key={i} className="flex items-center gap-2 text-slate-700">
                      <Check className="h-4 w-4 shrink-0 text-emerald-600" />
                      <span>{rec}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-100">
                <button className="w-full rounded-xl bg-slate-900 py-2.5 text-xs font-bold text-white hover:bg-slate-800">
                  Gerenciar Assinantes
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Nova Empresa */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-900 text-base">Cadastrar Nova Empresa SaaS</h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateEmpresa} className="mt-4 space-y-4 text-xs">
              <div>
                <label className="font-bold text-slate-700">Nome da Razão Social / Fantasia *</label>
                <input
                  type="text"
                  required
                  value={nomeForm}
                  onChange={(e) => setNomeForm(e.target.value)}
                  placeholder="Ex: Grupo Inovação RH LTDA"
                  className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 text-xs focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700">CNPJ *</label>
                <input
                  type="text"
                  required
                  value={cnpjForm}
                  onChange={(e) => setCnpjForm(e.target.value)}
                  placeholder="00.000.000/0001-00"
                  className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 text-xs focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700">Cidade</label>
                  <input
                    type="text"
                    value={cidadeForm}
                    onChange={(e) => setCidadeForm(e.target.value)}
                    placeholder="São Paulo"
                    className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 text-xs focus:border-indigo-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700">Estado (UF)</label>
                  <input
                    type="text"
                    value={estadoForm}
                    onChange={(e) => setEstadoForm(e.target.value)}
                    placeholder="SP"
                    className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 text-xs focus:border-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2 font-bold text-slate-600 hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-indigo-600 px-5 py-2 font-bold text-white hover:bg-indigo-700 shadow-md"
                >
                  Cadastrar Empresa
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
