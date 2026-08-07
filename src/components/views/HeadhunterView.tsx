import React, { useState } from 'react';
import {
  UserCheck,
  Building2,
  Plus,
  Briefcase,
  DollarSign,
  TrendingUp,
  FileText,
  Search,
  CheckCircle2,
  X,
  Share2,
} from 'lucide-react';
import { dataService } from '../../services/dataService';
import { Cliente, Vaga } from '../../types';

export const HeadhunterView: React.FC = () => {
  // Uses exact same jobs table as specified: "O módulo Headhunter deve utilizar exatamente as mesmas vagas do Recrutamento. Não criar tabelas duplicadas."
  const [vagas, setVagas] = useState(dataService.getVagas());
  const [clientes, setClientes] = useState(dataService.getClientes());
  const [activeTab, setActiveTab] = useState<'vagas' | 'clientes'>('vagas');

  // New Client Form
  const [showClienteModal, setShowClienteModal] = useState(false);
  const [nomeCliente, setNomeCliente] = useState('');
  const [cnpjCliente, setCnpjCliente] = useState('');
  const [responsavelCliente, setResponsavelCliente] = useState('');
  const [taxaCliente, setTaxaCliente] = useState('20% do análogo salarial');

  const refreshData = () => {
    setVagas(dataService.getVagas());
    setClientes(dataService.getClientes());
  };

  const handleCreateCliente = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nomeCliente || !cnpjCliente) return;

    dataService.createCliente({
      nome: nomeCliente,
      cnpj_cpf: cnpjCliente,
      email: 'contato@cliente.com.br',
      telefone: '(11) 3000-0000',
      responsavel: responsavelCliente || 'Diretor de Gente',
      status: 'ativo',
      vagas_contratadas: 1,
      taxa_headhunter: taxaCliente,
    });

    setShowClienteModal(false);
    setNomeCliente('');
    setCnpjCliente('');
    setResponsavelCliente('');
    refreshData();
  };

  return (
    <div className="space-y-6">
      {/* Banner */}
      <div className="flex flex-col gap-4 rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-6 text-white shadow-xl sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-lg">
            <UserCheck className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold tracking-tight">Módulo Headhunter Executive Search</h1>
            <p className="mt-0.5 text-xs text-indigo-200">
              Gestão B2B de clientes parceiros e posições executivas unificadas com o banco de vagas.
            </p>
          </div>
        </div>

        <button
          onClick={() => setShowClienteModal(true)}
          className="flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-xs font-bold text-slate-900 hover:bg-slate-100 shadow-md"
        >
          <Plus className="h-4 w-4" />
          Cadastrar Empresa Cliente
        </button>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => setActiveTab('vagas')}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition ${
            activeTab === 'vagas'
              ? 'bg-indigo-600 text-white shadow-md'
              : 'bg-white text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Briefcase className="h-4 w-4" />
          Vagas Compartilhadas ({vagas.length})
        </button>
        <button
          onClick={() => setActiveTab('clientes')}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition ${
            activeTab === 'clientes'
              ? 'bg-indigo-600 text-white shadow-md'
              : 'bg-white text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Building2 className="h-4 w-4" />
          Empresas Clientes ({clientes.length})
        </button>
      </div>

      {/* Shared Jobs View */}
      {activeTab === 'vagas' && (
        <div className="space-y-4">
          <div className="rounded-xl bg-indigo-50/80 p-4 border border-indigo-100 text-xs text-indigo-950 flex items-center gap-3">
            <Share2 className="h-5 w-5 shrink-0 text-indigo-600" />
            <p>
              <strong>Sincronização Ativa:</strong> Todas as vagas criadas no módulo Recrutamento aparecem automaticamente aqui e vice-versa, garantindo que o time de Headhunters utilize exatamente os mesmos dados da empresa sem duplicação de tabelas.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {vagas.map((vaga) => (
              <div key={vaga.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="rounded-md bg-indigo-50 px-2 py-0.5 text-[10px] font-extrabold text-indigo-700 uppercase">
                      {vaga.modulo_origem}
                    </span>
                    <h3 className="mt-2 font-bold text-slate-900 text-sm">{vaga.titulo}</h3>
                    <p className="text-xs text-slate-500">{vaga.departamento}</p>
                  </div>

                  <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-bold text-emerald-800 uppercase">
                    {vaga.status}
                  </span>
                </div>

                <div className="mt-4 space-y-1 text-xs text-slate-600 border-t border-slate-100 pt-3">
                  <p>
                    <strong className="text-slate-900">Honorário / Comissão:</strong> {vaga.honorario_headhunter || '20% do análogo salarial'}
                  </p>
                  <p>
                    <strong className="text-slate-900">Orçamento:</strong> R$ {vaga.salario_min?.toLocaleString('pt-BR')} - {vaga.salario_max?.toLocaleString('pt-BR')}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Clients View */}
      {activeTab === 'clientes' && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {clientes.map((cli) => (
            <div key={cli.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">{cli.nome}</h3>
                  <p className="text-xs text-slate-500">CNPJ: {cli.cnpj_cpf}</p>
                </div>
                <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-bold text-emerald-800">
                  {cli.status}
                </span>
              </div>

              <div className="mt-4 space-y-1 text-xs text-slate-600 border-t border-slate-100 pt-3">
                <p><strong className="text-slate-900">Responsável:</strong> {cli.responsavel}</p>
                <p><strong className="text-slate-900">Taxa Padrão:</strong> {cli.taxa_headhunter}</p>
                <p><strong className="text-slate-900">Vagas Contratadas:</strong> {cli.vagas_contratadas}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Cliente */}
      {showClienteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-900 text-base">Cadastrar Cliente Headhunter</h3>
              <button onClick={() => setShowClienteModal(false)} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateCliente} className="mt-4 space-y-4 text-xs">
              <div>
                <label className="font-bold text-slate-700">Nome da Empresa Cliente *</label>
                <input
                  type="text"
                  required
                  value={nomeCliente}
                  onChange={(e) => setNomeCliente(e.target.value)}
                  placeholder="Ex: Banco Safira Investimentos"
                  className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 text-xs focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700">CNPJ *</label>
                <input
                  type="text"
                  required
                  value={cnpjCliente}
                  onChange={(e) => setCnpjCliente(e.target.value)}
                  placeholder="00.000.000/0001-00"
                  className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 text-xs focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700">Nome do Contato / Responsável</label>
                <input
                  type="text"
                  value={responsavelCliente}
                  onChange={(e) => setResponsavelCliente(e.target.value)}
                  placeholder="Ex: Fernanda Machado (VP de Gente)"
                  className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 text-xs focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div className="mt-6 flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowClienteModal(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2 font-bold text-slate-600 hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-indigo-600 px-5 py-2 font-bold text-white hover:bg-indigo-700 shadow-md"
                >
                  Cadastrar Cliente
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
