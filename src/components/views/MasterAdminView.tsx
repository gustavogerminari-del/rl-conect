import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  Building2,
  CheckCircle2,
  Crown,
  Database,
  Layers,
  Package,
  Plus,
  Search,
  ShieldCheck,
  Users,
  X,
} from 'lucide-react';
import { dataService } from '../../services/dataService';
import { Empresa } from '../../types';

type MasterTab = 'visao-geral' | 'empresas' | 'usuarios' | 'modulos' | 'planos' | 'auditoria' | 'configuracoes';

export const MasterAdminView: React.FC = () => {
  const [revision, setRevision] = useState(0);
  const [activeTab, setActiveTab] = useState<MasterTab>('visao-geral');
  const [selectedEmpresaId, setSelectedEmpresaId] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [nomeForm, setNomeForm] = useState('');
  const [cnpjForm, setCnpjForm] = useState('');
  const [cidadeForm, setCidadeForm] = useState('');
  const [estadoForm, setEstadoForm] = useState('PR');
  const [formError, setFormError] = useState('');

  useEffect(() => dataService.subscribe(() => setRevision((value) => value + 1)), []);

  const currentUser = dataService.getCurrentUser();
  const firebaseStatus = dataService.getFirebaseStatus();
  const empresas = dataService.getEmpresas();
  const usuarios = dataService.getAllUsuariosMaster();
  const planos = dataService.getPlanos();
  const logs = dataService.getLogs();

  useEffect(() => {
    if (!selectedEmpresaId && empresas[0]?.id) setSelectedEmpresaId(empresas[0].id);
  }, [revision, empresas, selectedEmpresaId]);

  const selectedEmpresa = empresas.find((empresa) => empresa.id === selectedEmpresaId) || empresas[0] || null;
  const modulosSelecionados = selectedEmpresa ? dataService.getEmpresaModulos(selectedEmpresa.id) : [];

  const empresasFiltradas = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return empresas;
    return empresas.filter((empresa) =>
      empresa.nome.toLowerCase().includes(term) || empresa.cnpj.toLowerCase().includes(term),
    );
  }, [empresas, searchTerm]);

  const usuariosAtivos = usuarios.filter((usuario) => usuario.status === 'ativo').length;
  const empresasAtivas = empresas.filter((empresa) => empresa.status === 'ativa').length;
  const modulosAtivos = modulosSelecionados.filter((item) => item.ativo).length;

  if (!currentUser || currentUser.role !== 'master_admin') {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50 p-8 text-center">
        <ShieldCheck className="mx-auto h-10 w-10 text-rose-600" />
        <h2 className="mt-3 text-lg font-extrabold text-rose-900">Acesso restrito ao Master</h2>
        <p className="mt-1 text-sm text-rose-700">Esta área exige uma sessão Firebase com perfil Master válido.</p>
      </div>
    );
  }

  const handleCreateEmpresa = (event: React.FormEvent) => {
    event.preventDefault();
    setFormError('');
    if (!nomeForm.trim() || !cnpjForm.trim()) {
      setFormError('Nome e CNPJ são obrigatórios.');
      return;
    }
    try {
      const empresa = dataService.createEmpresa({
        nome: nomeForm.trim(),
        cnpj: cnpjForm.trim(),
        logo_url: '',
        plano_id: planos[0]?.id || 'basico',
        status: 'ativa',
        endereco: '',
        cidade: cidadeForm.trim(),
        estado: estadoForm.trim().toUpperCase() || 'PR',
      });
      setSelectedEmpresaId(empresa.id);
      setNomeForm('');
      setCnpjForm('');
      setCidadeForm('');
      setEstadoForm('PR');
      setShowCreateModal(false);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Não foi possível cadastrar a empresa.');
    }
  };

  const tabs: Array<{ id: MasterTab; label: string; icon: React.ComponentType<{ className?: string }> }> = [
    { id: 'visao-geral', label: 'Visão Geral', icon: Activity },
    { id: 'empresas', label: 'Empresas', icon: Building2 },
    { id: 'usuarios', label: 'Usuários', icon: Users },
    { id: 'modulos', label: 'Módulos', icon: Layers },
    { id: 'planos', label: 'Planos', icon: Package },
    { id: 'auditoria', label: 'Auditoria', icon: ShieldCheck },
    { id: 'configuracoes', label: 'Configurações', icon: Database },
  ];

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-800 bg-slate-950 p-6 text-white shadow-xl">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500 text-slate-950">
              <Crown className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-xl font-extrabold">Painel Master RL Connect</h1>
              <p className="mt-1 text-xs text-slate-400">Administração real da plataforma usando Firebase Auth, Firestore e Storage.</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-[11px]">
            <span className={`rounded-full border px-3 py-1 font-bold ${firebaseStatus.authenticated ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300' : 'border-rose-500/40 bg-rose-500/10 text-rose-300'}`}>
              Firebase Auth: {firebaseStatus.authenticated ? 'Autenticado' : 'Não autenticado'}
            </span>
            <span className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1 text-slate-300">{currentUser.email}</span>
          </div>
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto border-b border-slate-200 pb-2">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`flex shrink-0 items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-bold transition ${activeTab === id ? 'bg-slate-950 text-white' : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        ))}
      </div>

      {activeTab === 'visao-geral' && (
        <div className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard title="Empresas cadastradas" value={String(empresas.length)} detail={`${empresasAtivas} ativas`} />
            <MetricCard title="Usuários cadastrados" value={String(usuarios.length)} detail={`${usuariosAtivos} ativos`} />
            <MetricCard title="Planos configurados" value={String(planos.length)} detail="Configuração real do sistema" />
            <MetricCard title="Módulos da empresa selecionada" value={String(modulosAtivos)} detail={selectedEmpresa?.nome || 'Nenhuma empresa'} />
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="font-extrabold text-slate-900">Estado da infraestrutura</h2>
              <div className="mt-4 space-y-3 text-sm">
                <StatusRow label="Firebase Auth" ok={firebaseStatus.authenticated} detail={firebaseStatus.authenticated ? 'Sessão autenticada' : 'Sessão ausente'} />
                <StatusRow label="Firestore" ok={!firebaseStatus.error} detail={firebaseStatus.error || 'Sem erro reportado pela camada de dados'} />
                <StatusRow label="Isolamento multiempresa" ok detail="Dados filtrados por empresaId/companyId" />
                <StatusRow label="Storage" ok detail="Arquivos do projeto padronizados para Firebase Storage" />
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="font-extrabold text-slate-900">Empresa em foco</h2>
                  <p className="text-xs text-slate-500">Use esta seleção para revisar módulos contratados.</p>
                </div>
              </div>
              <select
                value={selectedEmpresa?.id || ''}
                onChange={(event) => setSelectedEmpresaId(event.target.value)}
                className="mt-4 w-full rounded-xl border border-slate-200 bg-white p-3 text-sm"
              >
                {empresas.map((empresa) => <option key={empresa.id} value={empresa.id}>{empresa.nome}</option>)}
              </select>
              {selectedEmpresa && (
                <div className="mt-4 rounded-xl bg-slate-50 p-4 text-xs text-slate-600">
                  <div><strong>CNPJ:</strong> {selectedEmpresa.cnpj}</div>
                  <div className="mt-1"><strong>Status:</strong> {selectedEmpresa.status}</div>
                  <div className="mt-1"><strong>Plano:</strong> {selectedEmpresa.plano_id}</div>
                </div>
              )}
            </section>
          </div>
        </div>
      )}

      {activeTab === 'empresas' && (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-extrabold text-slate-900">Empresas</h2>
              <p className="text-xs text-slate-500">Somente registros reais carregados pela camada Firebase.</p>
            </div>
            <button onClick={() => setShowCreateModal(true)} className="flex items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-xs font-bold text-white">
              <Plus className="h-4 w-4" /> Nova empresa
            </button>
          </div>
          <div className="relative mt-4">
            <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
            <input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Buscar por nome ou CNPJ" className="w-full rounded-xl border border-slate-200 py-2.5 pl-9 pr-3 text-sm" />
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 text-slate-500"><tr><th className="p-3">Empresa</th><th className="p-3">CNPJ</th><th className="p-3">Plano</th><th className="p-3">Status</th><th className="p-3">Ação</th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {empresasFiltradas.map((empresa) => (
                  <tr key={empresa.id}>
                    <td className="p-3 font-bold text-slate-900">{empresa.nome}</td>
                    <td className="p-3 text-slate-600">{empresa.cnpj}</td>
                    <td className="p-3 text-slate-600">{empresa.plano_id}</td>
                    <td className="p-3"><span className="rounded-full bg-slate-100 px-2 py-1 font-bold text-slate-700">{empresa.status}</span></td>
                    <td className="p-3"><button onClick={() => dataService.updateEmpresa(empresa.id, { status: empresa.status === 'ativa' ? 'suspensa' : 'ativa' })} className="font-bold text-slate-700 underline">{empresa.status === 'ativa' ? 'Suspender' : 'Ativar'}</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {activeTab === 'usuarios' && (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="font-extrabold text-slate-900">Usuários e permissões</h2>
          <p className="mt-1 text-xs text-slate-500">A tela não cria usuário fictício. Novos acessos devem ser criados pelo fluxo Firebase Admin.</p>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 text-slate-500"><tr><th className="p-3">Nome</th><th className="p-3">E-mail</th><th className="p-3">Role</th><th className="p-3">Empresa</th><th className="p-3">Status</th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {usuarios.map((usuario) => (
                  <tr key={usuario.id}><td className="p-3 font-bold text-slate-900">{usuario.nome}</td><td className="p-3">{usuario.email}</td><td className="p-3">{usuario.role}</td><td className="p-3">{usuario.empresa_id}</td><td className="p-3">{usuario.status}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {activeTab === 'modulos' && (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div><h2 className="font-extrabold text-slate-900">Módulos por empresa</h2><p className="text-xs text-slate-500">Sem duplicidade: o mesmo módulo é habilitado ou desabilitado por empresa.</p></div>
            <select value={selectedEmpresa?.id || ''} onChange={(event) => setSelectedEmpresaId(event.target.value)} className="rounded-xl border border-slate-200 p-2.5 text-xs">
              {empresas.map((empresa) => <option key={empresa.id} value={empresa.id}>{empresa.nome}</option>)}
            </select>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {modulosSelecionados.map(({ modulo, ativo }) => (
              <div key={modulo.id} className="rounded-xl border border-slate-200 p-4">
                <div className="flex items-start justify-between gap-3"><div><div className="font-bold text-slate-900">{modulo.nome}</div><p className="mt-1 text-xs text-slate-500">{modulo.descricao}</p></div><span className={`rounded-full px-2 py-1 text-[10px] font-bold ${ativo ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{ativo ? 'ATIVO' : 'INATIVO'}</span></div>
                <button disabled={!selectedEmpresa} onClick={() => selectedEmpresa && dataService.toggleEmpresaModulo(selectedEmpresa.id, modulo.id, !ativo)} className="mt-4 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 disabled:opacity-50">{ativo ? 'Desativar' : 'Ativar'}</button>
              </div>
            ))}
          </div>
        </section>
      )}

      {activeTab === 'planos' && (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="font-extrabold text-slate-900">Planos configurados</h2>
          <p className="mt-1 text-xs text-slate-500">Exibe somente a configuração existente no sistema; sem faturamento estimado ou receita inventada.</p>
          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {planos.map((plano) => (
              <div key={plano.id} className="rounded-xl border border-slate-200 p-4">
                <div className="font-extrabold text-slate-900">{plano.nome}</div>
                <div className="mt-2 text-xl font-black text-slate-950">{plano.preco_mensal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</div>
                <div className="mt-3 text-xs text-slate-500">Até {plano.max_vagas} vagas • {plano.max_usuarios} usuários</div>
                <div className="mt-3 flex flex-wrap gap-1">{plano.modulos_inclusos.map((modulo) => <span key={modulo} className="rounded-md bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-600">{modulo}</span>)}</div>
              </div>
            ))}
          </div>
        </section>
      )}

      {activeTab === 'auditoria' && (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="font-extrabold text-slate-900">Auditoria</h2>
          <p className="mt-1 text-xs text-slate-500">Eventos disponíveis para a empresa ativa na sessão.</p>
          <div className="mt-4 space-y-2">
            {logs.slice(0, 30).map((log) => (
              <div key={log.id} className="rounded-xl border border-slate-100 bg-slate-50 p-3 text-xs">
                <div className="flex flex-wrap items-center justify-between gap-2"><strong>{log.acao}</strong><span className="text-slate-400">{new Date(log.criado_em).toLocaleString('pt-BR')}</span></div>
                <p className="mt-1 text-slate-600">{log.detalhes}</p>
              </div>
            ))}
            {!logs.length && <p className="text-sm text-slate-500">Nenhum evento de auditoria carregado.</p>}
          </div>
        </section>
      )}

      {activeTab === 'configuracoes' && (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="font-extrabold text-slate-900">Configurações da plataforma</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <ConfigCard title="Banco oficial" value="Cloud Firestore" />
            <ConfigCard title="Autenticação oficial" value="Firebase Authentication" />
            <ConfigCard title="Arquivos" value="Firebase Storage" />
            <ConfigCard title="Projeto Firebase" value="rl-connect-ed797" />
          </div>
          {firebaseStatus.error && <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">Erro Firebase: {firebaseStatus.error}</div>}
          <p className="mt-4 text-xs text-slate-500">Google Calendar/Meet é uma integração externa. O login principal continua sendo exclusivamente Firebase Authentication.</p>
        </section>
      )}

      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between"><h2 className="font-extrabold text-slate-900">Cadastrar empresa</h2><button onClick={() => setShowCreateModal(false)}><X className="h-5 w-5 text-slate-400" /></button></div>
            <form onSubmit={handleCreateEmpresa} className="mt-5 space-y-4">
              <Field label="Nome *" value={nomeForm} onChange={setNomeForm} />
              <Field label="CNPJ *" value={cnpjForm} onChange={setCnpjForm} />
              <div className="grid gap-4 sm:grid-cols-2"><Field label="Cidade" value={cidadeForm} onChange={setCidadeForm} /><Field label="UF" value={estadoForm} onChange={setEstadoForm} /></div>
              {formError && <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">{formError}</div>}
              <div className="flex justify-end gap-2 pt-2"><button type="button" onClick={() => setShowCreateModal(false)} className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600">Cancelar</button><button type="submit" className="rounded-xl bg-slate-950 px-4 py-2 text-xs font-bold text-white">Cadastrar</button></div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

const MetricCard: React.FC<{ title: string; value: string; detail: string }> = ({ title, value, detail }) => (
  <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="text-xs font-bold text-slate-500">{title}</div><div className="mt-2 text-2xl font-black text-slate-950">{value}</div><div className="mt-1 text-xs text-slate-500">{detail}</div></div>
);

const StatusRow: React.FC<{ label: string; ok: boolean; detail: string }> = ({ label, ok, detail }) => (
  <div className="flex items-start gap-3 rounded-xl border border-slate-100 p-3"><CheckCircle2 className={`mt-0.5 h-4 w-4 ${ok ? 'text-emerald-600' : 'text-rose-600'}`} /><div><div className="font-bold text-slate-900">{label}</div><div className="text-xs text-slate-500">{detail}</div></div></div>
);

const ConfigCard: React.FC<{ title: string; value: string }> = ({ title, value }) => (
  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4"><div className="text-xs font-bold text-slate-500">{title}</div><div className="mt-1 font-extrabold text-slate-900">{value}</div></div>
);

const Field: React.FC<{ label: string; value: string; onChange: (value: string) => void }> = ({ label, value, onChange }) => (
  <label className="block text-xs font-bold text-slate-700">{label}<input value={value} onChange={(event) => onChange(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 text-sm font-normal" /></label>
);
