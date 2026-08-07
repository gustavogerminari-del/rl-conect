import React, { useState } from 'react';
import {
  Users,
  Clock,
  Calendar,
  FileCheck2,
  Plus,
  Search,
  CheckCircle2,
  AlertCircle,
  FileText,
  UserPlus,
  X,
  Upload,
} from 'lucide-react';
import { dataService } from '../../services/dataService';
import { Funcionario } from '../../types';

export const DepartamentoPessoalView: React.FC = () => {
  const [funcionarios, setFuncionarios] = useState(dataService.getFuncionarios());
  const [pontos, setPontos] = useState(dataService.getRegistroPontos());
  const [ferias, setFerias] = useState(dataService.getFerias());
  const [activeTab, setActiveTab] = useState<'colaboradores' | 'ponto' | 'ferias' | 'documentos'>('colaboradores');

  const [showFuncModal, setShowFuncModal] = useState(false);
  const [nomeFunc, setNomeFunc] = useState('');
  const [cpfFunc, setCpfFunc] = useState('');
  const [cargoFunc, setCargoFunc] = useState('');
  const [departamentoFunc, setDepartamentoFunc] = useState('Tecnologia');
  const [salarioFunc, setSalarioFunc] = useState(9500);

  const refreshData = () => {
    setFuncionarios(dataService.getFuncionarios());
    setPontos(dataService.getRegistroPontos());
    setFerias(dataService.getFerias());
  };

  const handleCreateFuncionario = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nomeFunc || !cpfFunc) return;

    dataService.createFuncionario({
      nome: nomeFunc,
      cpf: cpfFunc,
      email: `${nomeFunc.toLowerCase().replace(/\s+/g, '.')}@empresa.com.br`,
      cargo: cargoFunc || 'Analista',
      departamento: departamentoFunc,
      data_admissao: new Date().toISOString().split('T')[0],
      salario: salarioFunc,
      status: 'ativo',
    });

    setShowFuncModal(false);
    setNomeFunc('');
    setCpfFunc('');
    setCargoFunc('');
    refreshData();
  };

  const handleBaterPonto = () => {
    if (funcionarios.length === 0) return;

    dataService.baterPonto({
      funcionario_id: funcionarios[0].id,
      tipo: 'Entrada',
      timestamp: new Date().toISOString(),
      localizacao: 'São Paulo - GPS OK',
    });

    refreshData();
  };

  return (
    <div className="space-y-6">
      {/* Banner */}
      <div className="flex flex-col gap-4 rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-6 text-white shadow-xl sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-lg">
            <Users className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold tracking-tight">Módulo Departamento Pessoal & RH</h1>
            <p className="mt-0.5 text-xs text-indigo-200">
              Gestão de colaboradores, registro de ponto digital, férias, admissão/rescisão e contratos no Supabase Storage.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleBaterPonto}
            className="flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2.5 text-xs font-bold text-slate-950 hover:bg-emerald-400 shadow-md"
          >
            <Clock className="h-4 w-4" />
            Bater Ponto Agora
          </button>
          <button
            onClick={() => setShowFuncModal(true)}
            className="flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-xs font-bold text-slate-900 hover:bg-slate-100 shadow-md"
          >
            <UserPlus className="h-4 w-4" />
            Admitir Novo Colaborador
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => setActiveTab('colaboradores')}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition ${
            activeTab === 'colaboradores'
              ? 'bg-indigo-600 text-white shadow-md'
              : 'bg-white text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Users className="h-4 w-4" />
          Colaboradores ({funcionarios.length})
        </button>
        <button
          onClick={() => setActiveTab('ponto')}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition ${
            activeTab === 'ponto'
              ? 'bg-indigo-600 text-white shadow-md'
              : 'bg-white text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Clock className="h-4 w-4" />
          Registro de Ponto ({pontos.length})
        </button>
        <button
          onClick={() => setActiveTab('ferias')}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition ${
            activeTab === 'ferias'
              ? 'bg-indigo-600 text-white shadow-md'
              : 'bg-white text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Calendar className="h-4 w-4" />
          Gestão de Férias ({ferias.length})
        </button>
      </div>

      {/* TAB 1: COLABORADORES */}
      {activeTab === 'colaboradores' && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {funcionarios.map((func) => (
            <div key={func.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">{func.nome}</h3>
                  <p className="text-xs text-slate-500">{func.cargo} • {func.departamento}</p>
                </div>
                <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-bold text-emerald-800 uppercase">
                  {func.status}
                </span>
              </div>

              <div className="space-y-1 text-xs text-slate-600 border-t border-slate-100 pt-3">
                <p><strong className="text-slate-900">CPF:</strong> {func.cpf}</p>
                <p><strong className="text-slate-900">E-mail:</strong> {func.email}</p>
                <p><strong className="text-slate-900">Admissão:</strong> {func.data_admissao}</p>
                <p><strong className="text-slate-900">Salário CLT:</strong> R$ {func.salario.toLocaleString('pt-BR')}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* TAB 2: PONTO */}
      {activeTab === 'ponto' && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
          <h2 className="font-bold text-slate-900 text-base">Registros de Ponto em Tempo Real</h2>
          <div className="space-y-2">
            {pontos.map((p) => {
              const func = funcionarios.find((f) => f.id === p.funcionario_id);
              return (
                <div key={p.id} className="flex items-center justify-between rounded-xl bg-slate-50 p-3 text-xs border border-slate-100">
                  <div>
                    <span className="font-bold text-slate-900">{func?.nome || 'Colaborador'}</span>
                    <span className="text-slate-400 ml-2">• {p.localizacao}</span>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="rounded-md bg-indigo-50 px-2 py-0.5 font-bold text-indigo-700">
                      {p.tipo}
                    </span>
                    <span className="font-mono text-slate-600 font-bold">
                      {new Date(p.timestamp).toLocaleString('pt-BR')}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 3: FERIAS */}
      {activeTab === 'ferias' && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {ferias.map((f) => {
            const func = funcionarios.find((fn) => fn.id === f.funcionario_id);
            return (
              <div key={f.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-slate-900 text-sm">{func?.nome || 'Colaborador'}</h3>
                  <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-bold text-indigo-800 uppercase">
                    {f.status}
                  </span>
                </div>

                <div className="text-xs text-slate-600 pt-2 border-t border-slate-100">
                  <p><strong>Início:</strong> {f.data_inicio}</p>
                  <p><strong>Fim:</strong> {f.data_fim}</p>
                  <p><strong>Período Aquisitivo:</strong> {f.dias} dias</p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL NOVO FUNCIONARIO */}
      {showFuncModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 text-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-900 text-base">Admissão de Colaborador</h3>
              <button onClick={() => setShowFuncModal(false)} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateFuncionario} className="mt-4 space-y-4">
              <div>
                <label className="font-bold text-slate-700">Nome Completo *</label>
                <input
                  type="text"
                  required
                  value={nomeFunc}
                  onChange={(e) => setNomeFunc(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700">CPF *</label>
                <input
                  type="text"
                  required
                  value={cpfFunc}
                  onChange={(e) => setCpfFunc(e.target.value)}
                  placeholder="000.000.000-00"
                  className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700">Cargo</label>
                <input
                  type="text"
                  value={cargoFunc}
                  onChange={(e) => setCargoFunc(e.target.value)}
                  placeholder="Ex: Desenvolvedor Senior"
                  className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700">Salário CLT (R$)</label>
                <input
                  type="number"
                  value={salarioFunc}
                  onChange={(e) => setSalarioFunc(Number(e.target.value))}
                  className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div className="mt-6 flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowFuncModal(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2 font-bold text-slate-600 hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-indigo-600 px-5 py-2 font-bold text-white hover:bg-indigo-700 shadow-md"
                >
                  Concluir Admissão
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
