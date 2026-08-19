import React, { useMemo, useState } from 'react';
import {
  Users,
  Clock,
  Calendar,
  UserPlus,
  X,
  Stethoscope,
  Gift,
  WalletCards,
  Activity,
  RotateCcw,
  ClipboardCheck,
  AlertTriangle,
} from 'lucide-react';
import { dataService } from '../../services/dataService';

type Tab = 'admissoes' | 'colaboradores' | 'exames' | 'beneficios' | 'folha' | 'ponto' | 'ferias' | 'afastamentos';

const today = () => new Date().toISOString().slice(0, 10);

export const DepartamentoPessoalView: React.FC = () => {
  const [funcionarios, setFuncionarios] = useState<any[]>(dataService.getFuncionarios() as any[]);
  const [pontos, setPontos] = useState<any[]>(dataService.getRegistroPontos());
  const [ferias, setFerias] = useState<any[]>(dataService.getFerias());
  const [admissoes, setAdmissoes] = useState<any[]>(dataService.getAdmissoesPendentes());
  const [activeTab, setActiveTab] = useState<Tab>('admissoes');
  const [showFuncModal, setShowFuncModal] = useState(false);
  const [nomeFunc, setNomeFunc] = useState('');
  const [cpfFunc, setCpfFunc] = useState('');
  const [cargoFunc, setCargoFunc] = useState('');
  const [departamentoFunc, setDepartamentoFunc] = useState('Administrativo');
  const [salarioFunc, setSalarioFunc] = useState(3000);
  const [cpfAdmissao, setCpfAdmissao] = useState<Record<string, string>>({});
  const [feriasInicio, setFeriasInicio] = useState<Record<string, string>>({});
  const [feriasFim, setFeriasFim] = useState<Record<string, string>>({});

  const refreshData = () => {
    setFuncionarios(dataService.getFuncionarios() as any[]);
    setPontos(dataService.getRegistroPontos());
    setFerias(dataService.getFerias());
    setAdmissoes(dataService.getAdmissoesPendentes());
  };

  const updateFuncionario = (func: any, updates: Record<string, unknown>) => {
    dataService.createFuncionario({ ...func, ...updates } as any);
    refreshData();
  };

  const handleCreateFuncionario = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nomeFunc || !cpfFunc) return;
    dataService.createFuncionario({
      nome: nomeFunc,
      cpf: cpfFunc,
      email: `${nomeFunc.toLowerCase().trim().replace(/\s+/g, '.')}@empresa.com.br`,
      cargo: cargoFunc || 'Analista',
      departamento: departamentoFunc,
      data_admissao: today(),
      salario: salarioFunc,
      status: 'ativo',
      exame_admissional_status: 'PENDENTE',
      beneficios_status: 'PENDENTE',
      folha_status: 'PENDENTE',
      afastamento_status: 'ATIVO',
      ferias_status: 'SEM_PROGRAMACAO',
    } as any);
    setShowFuncModal(false);
    setNomeFunc('');
    setCpfFunc('');
    setCargoFunc('');
    refreshData();
  };

  const handleConcluirAdmissao = (adm: any) => {
    const cpf = String(cpfAdmissao[adm.id] || '').trim();
    const funcionario = dataService.concluirAdmissao(adm.id, cpf, Number(adm.salario_sugerido || 0));
    if (!funcionario) return;
    updateFuncionario(funcionario as any, {
      exame_admissional_status: 'PENDENTE',
      beneficios_status: 'PENDENTE',
      folha_status: 'PENDENTE',
      afastamento_status: 'ATIVO',
      ferias_status: 'SEM_PROGRAMACAO',
    });
    refreshData();
  };

  const handleBaterPonto = () => {
    const func = funcionarios.find((f) => f.status === 'ativo');
    if (!func) return;
    dataService.baterPonto({
      funcionario_id: func.id,
      tipo: 'Entrada',
      timestamp: new Date().toISOString(),
      localizacao: 'Registro via RL Connect',
    });
    refreshData();
  };

  const programarFerias = (func: any) => {
    const inicio = feriasInicio[func.id];
    const fim = feriasFim[func.id];
    if (!inicio || !fim || fim < inicio) return;
    updateFuncionario(func, {
      ferias_status: 'PROGRAMADA',
      ferias_inicio: inicio,
      ferias_fim: fim,
      ferias_atualizado_em: new Date().toISOString(),
    });
  };

  const tabs: Array<{ key: Tab; label: string; count?: number }> = [
    { key: 'admissoes', label: 'Admissões', count: admissoes.filter((a) => a.status !== 'CONCLUIDA').length },
    { key: 'colaboradores', label: 'Colaboradores', count: funcionarios.length },
    { key: 'exames', label: 'Exames' },
    { key: 'beneficios', label: 'Benefícios' },
    { key: 'folha', label: 'Folha' },
    { key: 'ponto', label: 'Ponto', count: pontos.length },
    { key: 'ferias', label: 'Férias', count: funcionarios.filter((f) => f.ferias_status === 'PROGRAMADA').length + ferias.length },
    { key: 'afastamentos', label: 'Afastamentos' },
  ];

  const pendencias = useMemo(() => funcionarios.filter((f) =>
    f.exame_admissional_status !== 'APTO' || f.beneficios_status !== 'ATIVO' || f.folha_status !== 'ATIVO'
  ).length, [funcionarios]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-6 text-white shadow-xl sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-600"><Users className="h-6 w-6" /></div>
          <div>
            <h1 className="text-xl font-extrabold">Departamento Pessoal & RH</h1>
            <p className="mt-1 text-xs text-indigo-200">Contratação → admissão → exame → benefícios → folha → férias → afastamento → retorno, persistido no Firebase.</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={handleBaterPonto} className="rounded-xl bg-emerald-500 px-4 py-2.5 text-xs font-bold text-slate-950"><Clock className="mr-2 inline h-4 w-4" />Bater Ponto</button>
          <button onClick={() => setShowFuncModal(true)} className="rounded-xl bg-white px-4 py-2.5 text-xs font-bold text-slate-900"><UserPlus className="mr-2 inline h-4 w-4" />Admissão Manual</button>
        </div>
      </div>

      {pendencias > 0 && (
        <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs font-semibold text-amber-900">
          <AlertTriangle className="h-4 w-4" /> {pendencias} colaborador(es) com pendências de exame, benefícios ou folha.
        </div>
      )}

      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-2">
        {tabs.map((tab) => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)} className={`rounded-xl px-4 py-2 text-xs font-bold ${activeTab === tab.key ? 'bg-indigo-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-100'}`}>
            {tab.label}{typeof tab.count === 'number' ? ` (${tab.count})` : ''}
          </button>
        ))}
      </div>

      {activeTab === 'admissoes' && (
        <div className="space-y-3">
          {admissoes.filter((a) => a.status !== 'CONCLUIDA').length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">Nenhuma contratação aguardando admissão.</div>
          ) : admissoes.filter((a) => a.status !== 'CONCLUIDA').map((adm) => (
            <div key={adm.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                <div><span className="text-[10px] font-black uppercase text-indigo-600">Vindo do Recrutamento</span><h3 className="font-bold text-slate-900">{adm.candidato_nome}</h3><p className="text-xs text-slate-500">{adm.cargo} • {adm.departamento} • R$ {Number(adm.salario_sugerido || 0).toLocaleString('pt-BR')}</p></div>
                <div className="flex gap-2"><input value={cpfAdmissao[adm.id] || ''} onChange={(e) => setCpfAdmissao((s) => ({ ...s, [adm.id]: e.target.value }))} placeholder="CPF do contratado" className="rounded-xl border border-slate-200 px-3 py-2 text-xs" /><button onClick={() => handleConcluirAdmissao(adm)} className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white">Concluir admissão</button></div>
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'colaboradores' && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{funcionarios.map((func) => <div key={func.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-start justify-between gap-2"><div><h3 className="font-bold text-slate-900">{func.nome}</h3><p className="text-xs text-slate-500">{func.cargo || func.cargo_nome} • {func.departamento || func.departamento_nome}</p></div><span className="rounded-full bg-emerald-100 px-2 py-1 text-[10px] font-bold text-emerald-800">{func.status}</span></div><div className="mt-3 space-y-1 border-t pt-3 text-xs text-slate-600"><p>CPF: {func.cpf}</p><p>Admissão: {func.data_admissao}</p><p>Salário: R$ {Number(func.salario || 0).toLocaleString('pt-BR')}</p></div></div>)}</div>
      )}

      {activeTab === 'exames' && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{funcionarios.map((func) => <div key={func.id} className="rounded-2xl border bg-white p-5 shadow-sm"><Stethoscope className="h-5 w-5 text-indigo-600" /><h3 className="mt-2 font-bold">{func.nome}</h3><p className="text-xs text-slate-500">Exame admissional: <b>{func.exame_admissional_status || 'PENDENTE'}</b></p><div className="mt-3 flex gap-2"><button onClick={() => updateFuncionario(func, { exame_admissional_status: 'APTO', exame_admissional_data: today() })} className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white">Marcar APTO</button><button onClick={() => updateFuncionario(func, { exame_admissional_status: 'INAPTO', exame_admissional_data: today() })} className="rounded-lg bg-rose-100 px-3 py-2 text-xs font-bold text-rose-700">INAPTO</button></div></div>)}</div>
      )}

      {activeTab === 'beneficios' && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{funcionarios.map((func) => <div key={func.id} className="rounded-2xl border bg-white p-5 shadow-sm"><Gift className="h-5 w-5 text-indigo-600" /><h3 className="mt-2 font-bold">{func.nome}</h3><p className="text-xs text-slate-500">Status: <b>{func.beneficios_status || 'PENDENTE'}</b></p><button onClick={() => updateFuncionario(func, { beneficios_status: 'ATIVO', beneficios: ['Vale Transporte', 'Vale Alimentação'], beneficios_atualizado_em: new Date().toISOString() })} className="mt-3 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-bold text-white">Ativar VT + VA</button></div>)}</div>
      )}

      {activeTab === 'folha' && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{funcionarios.map((func) => <div key={func.id} className="rounded-2xl border bg-white p-5 shadow-sm"><WalletCards className="h-5 w-5 text-indigo-600" /><h3 className="mt-2 font-bold">{func.nome}</h3><p className="text-xs text-slate-500">Folha: <b>{func.folha_status || 'PENDENTE'}</b></p><p className="mt-1 text-xs">Base: R$ {Number(func.salario || 0).toLocaleString('pt-BR')}</p><button disabled={func.exame_admissional_status !== 'APTO'} onClick={() => updateFuncionario(func, { folha_status: 'ATIVO', folha_competencia: new Date().toISOString().slice(0, 7) })} className="mt-3 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-40">Incluir na folha</button>{func.exame_admissional_status !== 'APTO' && <p className="mt-2 text-[10px] font-semibold text-amber-700">Exame APTO obrigatório antes da folha.</p>}</div>)}</div>
      )}

      {activeTab === 'ponto' && (
        <div className="rounded-2xl border bg-white p-6 shadow-sm"><h2 className="font-bold">Registros de Ponto</h2><div className="mt-4 space-y-2">{pontos.map((p) => <div key={p.id} className="flex justify-between rounded-xl bg-slate-50 p-3 text-xs"><span>{funcionarios.find((f) => f.id === p.funcionario_id)?.nome || 'Colaborador'} • {p.tipo}</span><span>{new Date(p.timestamp).toLocaleString('pt-BR')}</span></div>)}</div></div>
      )}

      {activeTab === 'ferias' && (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{funcionarios.map((func) => <div key={func.id} className="rounded-2xl border bg-white p-5 shadow-sm"><Calendar className="h-5 w-5 text-indigo-600" /><h3 className="mt-2 font-bold">{func.nome}</h3><p className="text-xs text-slate-500">Status: <b>{func.ferias_status || 'SEM_PROGRAMACAO'}</b></p>{func.ferias_inicio && <p className="mt-1 text-xs">{func.ferias_inicio} até {func.ferias_fim}</p>}<div className="mt-3 grid grid-cols-2 gap-2"><input type="date" value={feriasInicio[func.id] || ''} onChange={(e) => setFeriasInicio((s) => ({ ...s, [func.id]: e.target.value }))} className="rounded-lg border p-2 text-xs" /><input type="date" value={feriasFim[func.id] || ''} onChange={(e) => setFeriasFim((s) => ({ ...s, [func.id]: e.target.value }))} className="rounded-lg border p-2 text-xs" /></div><button onClick={() => programarFerias(func)} className="mt-2 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-bold text-white">Programar férias</button></div>)}</div>
          {ferias.length > 0 && <div className="rounded-2xl border bg-white p-5"><h3 className="font-bold">Histórico legado de férias</h3><div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{ferias.map((f) => <div key={f.id} className="rounded-xl bg-slate-50 p-3 text-xs"><b>{funcionarios.find((x) => x.id === f.funcionario_id)?.nome || 'Colaborador'}</b><p>{f.data_inicio} até {f.data_fim}</p><p>{f.dias} dias • {f.status}</p></div>)}</div></div>}
        </div>
      )}

      {activeTab === 'afastamentos' && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{funcionarios.map((func) => <div key={func.id} className="rounded-2xl border bg-white p-5 shadow-sm"><Activity className="h-5 w-5 text-indigo-600" /><h3 className="mt-2 font-bold">{func.nome}</h3><p className="text-xs text-slate-500">Situação: <b>{func.afastamento_status || 'ATIVO'}</b></p><div className="mt-3 flex gap-2">{func.afastamento_status === 'AFASTADO' ? <button onClick={() => updateFuncionario(func, { afastamento_status: 'ATIVO', retorno_trabalho_data: today(), status: 'ativo' })} className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white"><RotateCcw className="mr-1 inline h-3 w-3" />Registrar retorno</button> : <button onClick={() => updateFuncionario(func, { afastamento_status: 'AFASTADO', afastamento_inicio: today(), status: 'afastado' })} className="rounded-lg bg-amber-500 px-3 py-2 text-xs font-bold text-slate-950">Registrar afastamento</button>}</div></div>)}</div>
      )}

      {showFuncModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm"><div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"><div className="flex items-center justify-between border-b pb-3"><h3 className="font-bold">Admissão Manual</h3><button onClick={() => setShowFuncModal(false)}><X className="h-5 w-5" /></button></div><form onSubmit={handleCreateFuncionario} className="mt-4 space-y-3 text-xs"><input required value={nomeFunc} onChange={(e) => setNomeFunc(e.target.value)} placeholder="Nome completo" className="w-full rounded-xl border p-2.5" /><input required value={cpfFunc} onChange={(e) => setCpfFunc(e.target.value)} placeholder="CPF" className="w-full rounded-xl border p-2.5" /><input value={cargoFunc} onChange={(e) => setCargoFunc(e.target.value)} placeholder="Cargo" className="w-full rounded-xl border p-2.5" /><input value={departamentoFunc} onChange={(e) => setDepartamentoFunc(e.target.value)} placeholder="Departamento" className="w-full rounded-xl border p-2.5" /><input type="number" min="1" value={salarioFunc} onChange={(e) => setSalarioFunc(Number(e.target.value))} className="w-full rounded-xl border p-2.5" /><button className="w-full rounded-xl bg-indigo-600 px-4 py-2.5 font-bold text-white"><ClipboardCheck className="mr-2 inline h-4 w-4" />Concluir admissão</button></form></div></div>
      )}
    </div>
  );
};
