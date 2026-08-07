import React, { useState } from 'react';
import { Settings, Building2, Users, Save, Check } from 'lucide-react';
import { dataService } from '../../services/dataService';

export const CompanySettingsView: React.FC = () => {
  const activeEmpresa = dataService.getActiveEmpresa();
  const usuarios = dataService.getUsuarios();

  const [nome, setNome] = useState(activeEmpresa.nome);
  const [cnpj, setCnpj] = useState(activeEmpresa.cnpj);
  const [cidade, setCidade] = useState(activeEmpresa.cidade);
  const [estado, setEstado] = useState(activeEmpresa.estado);
  const [endereco, setEndereco] = useState(activeEmpresa.endereco);
  const [saved, setSaved] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    dataService.updateEmpresa(activeEmpresa.id, {
      nome,
      cnpj,
      cidade,
      estado,
      endereco,
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  return (
    <div className="space-y-6">
      {/* Banner */}
      <div className="flex flex-col gap-4 rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-6 text-white shadow-xl sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-lg">
            <Settings className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold tracking-tight">Configurações da Empresa</h1>
            <p className="mt-0.5 text-xs text-indigo-200">
              Dados cadastrais do tenant, usuários autorizados e permissões.
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Company Profile Form */}
        <form onSubmit={handleSave} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4 text-xs">
          <h2 className="font-bold text-slate-900 text-base flex items-center gap-2 border-b border-slate-100 pb-3">
            <Building2 className="h-5 w-5 text-indigo-600" />
            Dados Institucionais
          </h2>

          <div>
            <label className="font-bold text-slate-700">Razão Social / Nome Fantasia</label>
            <input
              type="text"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 focus:border-indigo-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="font-bold text-slate-700">CNPJ</label>
            <input
              type="text"
              value={cnpj}
              onChange={(e) => setCnpj(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 focus:border-indigo-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="font-bold text-slate-700">Endereço Comercial</label>
            <input
              type="text"
              value={endereco}
              onChange={(e) => setEndereco(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 focus:border-indigo-500 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-bold text-slate-700">Cidade</label>
              <input
                type="text"
                value={cidade}
                onChange={(e) => setCidade(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 focus:border-indigo-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="font-bold text-slate-700">Estado</label>
              <input
                type="text"
                value={estado}
                onChange={(e) => setEstado(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 focus:border-indigo-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 flex justify-end">
            <button
              type="submit"
              className="flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 font-bold text-white hover:bg-indigo-700 shadow-md"
            >
              {saved ? (
                <>
                  <Check className="h-4 w-4" />
                  Salvo no Banco!
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  Salvar Alterações
                </>
              )}
            </button>
          </div>
        </form>

        {/* Authorized Users List */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4 text-xs">
          <h2 className="font-bold text-slate-900 text-base flex items-center gap-2 border-b border-slate-100 pb-3">
            <Users className="h-5 w-5 text-indigo-600" />
            Usuários com Acesso ({usuarios.length})
          </h2>

          <div className="space-y-3">
            {usuarios.map((u) => (
              <div key={u.id} className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 p-3">
                <div>
                  <div className="font-bold text-slate-900">{u.nome}</div>
                  <div className="text-[11px] text-slate-500">{u.email}</div>
                </div>

                <span className="rounded-full bg-indigo-100 px-2.5 py-0.5 text-[10px] font-bold text-indigo-800 uppercase">
                  {u.role.replace('_', ' ')}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
