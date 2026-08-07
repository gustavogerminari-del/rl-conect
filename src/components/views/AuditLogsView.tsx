import React, { useState } from 'react';
import { ShieldAlert, Search, Filter, Database, CheckCircle2, User } from 'lucide-react';
import { dataService } from '../../services/dataService';

export const AuditLogsView: React.FC = () => {
  const [logs, setLogs] = useState(dataService.getLogs());
  const [searchTerm, setSearchTerm] = useState('');

  const filteredLogs = logs.filter(
    (l) =>
      l.usuario_nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
      l.acao.toLowerCase().includes(searchTerm.toLowerCase()) ||
      l.detalhes.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Banner */}
      <div className="flex flex-col gap-4 rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-6 text-white shadow-xl sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/20">
            <ShieldAlert className="h-6 w-6 font-bold" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold tracking-tight">Trilha de Auditoria & Segurança RLS</h1>
            <p className="mt-0.5 text-xs text-indigo-200">
              Registros imutáveis de acessos, alterações e validações de isolamento Row Level Security no Supabase.
            </p>
          </div>
        </div>

        <span className="rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-bold text-emerald-300 border border-emerald-500/30">
          RLS Imposto Nativamente no Postgres
        </span>
      </div>

      {/* Filter Bar */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por usuário, ação ou IP..."
            className="w-full rounded-xl border border-slate-200 bg-white pl-9 pr-4 py-2 text-xs text-slate-800 focus:border-indigo-500 focus:outline-none"
          />
        </div>
      </div>

      {/* Logs Table */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-slate-200 bg-slate-50 font-bold uppercase text-slate-500 text-[10px]">
            <tr>
              <th className="px-4 py-3">Data / Hora</th>
              <th className="px-4 py-3">Usuário</th>
              <th className="px-4 py-3">Empresa (Tenant)</th>
              <th className="px-4 py-3">Ação Executada</th>
              <th className="px-4 py-3">Detalhes</th>
              <th className="px-4 py-3">Endereço IP</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-slate-700">
            {filteredLogs.map((log) => (
              <tr key={log.id} className="hover:bg-slate-50/80 transition">
                <td className="px-4 py-3 font-mono text-[11px] text-slate-500">
                  {new Date(log.criado_em).toLocaleString('pt-BR')}
                </td>
                <td className="px-4 py-3 font-bold text-slate-900 flex items-center gap-1.5">
                  <User className="h-3.5 w-3.5 text-indigo-600" />
                  {log.usuario_nome}
                </td>
                <td className="px-4 py-3 font-mono text-[11px] text-indigo-600">{log.empresa_id}</td>
                <td className="px-4 py-3">
                  <span className="rounded bg-indigo-50 px-2 py-0.5 text-[10px] font-bold text-indigo-700">
                    {log.acao}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-600 max-w-xs truncate">{log.detalhes}</td>
                <td className="px-4 py-3 font-mono text-[10px] text-slate-400">{log.ip_address}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
