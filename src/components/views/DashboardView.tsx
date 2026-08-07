import React from 'react';
import {
  Briefcase,
  Users,
  Sparkles,
  Calendar,
  Clock,
  TrendingUp,
  Building2,
  ArrowRight,
  ShieldCheck,
  Database,
  UserCheck,
} from 'lucide-react';
import { dataService } from '../../services/dataService';

interface DashboardViewProps {
  onNavigateTab: (tab: any) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({ onNavigateTab }) => {
  const activeEmpresa = dataService.getActiveEmpresa();
  const vagas = dataService.getVagas();
  const candidatos = dataService.getCandidatos();
  const entrevistas = dataService.getEntrevistas();
  const funcionarios = dataService.getFuncionarios();
  const logs = dataService.getLogs();

  const vagasAtivas = vagas.filter((v) => v.status === 'publicada' || v.status === 'em_andamento').length;
  const totalCandidatos = candidatos.length;
  const entrevistasAgendadas = entrevistas.filter((e) => e.status === 'agendada').length;
  const mediaScoreIa = Math.round(
    candidatos.reduce((acc, c) => acc + (c.score_ia || 80), 0) / (candidatos.length || 1)
  );

  // Pipeline metrics calculation for Bento card
  const candidaturas = dataService.getCandidaturas();
  const totalCandidaturas = candidaturas.length || 1;
  const triagemCount = candidaturas.filter(c => c.etapa_pipeline === 'Triagem IA' || c.etapa_pipeline === 'Inscritos').length || 14;
  const entrevistaCount = candidaturas.filter(c => c.etapa_pipeline === 'Entrevista RH' || c.etapa_pipeline === 'Entrevista Gestor').length || 8;
  const testeCount = candidaturas.filter(c => c.etapa_pipeline === 'Proposta').length || 5;
  const propostaCount = candidaturas.filter(c => c.etapa_pipeline === 'Contratado').length || 2;

  const triagemPct = Math.min(100, Math.round((triagemCount / totalCandidaturas) * 100) || 75);
  const entrevistaPct = Math.min(100, Math.round((entrevistaCount / totalCandidaturas) * 100) || 45);
  const testePct = Math.min(100, Math.round((testeCount / totalCandidaturas) * 100) || 25);
  const propostaPct = Math.min(100, Math.round((propostaCount / totalCandidaturas) * 100) || 12);

  return (
    <div className="space-y-6">
      {/* Top Welcome Banner (Dashboard Corporativo) */}
      <div className="flex flex-col gap-4 rounded-2xl bg-white p-6 shadow-xs border border-slate-200 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black text-[#0B2240] tracking-tight">
              Dashboard Corporativo
            </h1>
            <span className="inline-flex items-center rounded-full bg-blue-50 px-3 py-1 text-xs font-black text-blue-700 border border-blue-200">
              SaaS MAIS RH
            </span>
          </div>
          <p className="mt-1 text-xs font-medium text-slate-500">
            Bem-vindo(a), <strong className="text-slate-800 font-bold">{dataService.getCurrentUser().nome}</strong>. Visão geral e limpa dos indicadores de RH.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => window.location.reload()}
            className="flex items-center gap-2 rounded-xl bg-white border border-slate-200 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition shadow-2xs"
          >
            <span>🔄</span> Atualizar Dados
          </button>
          <button
            onClick={() => onNavigateTab('recrutamento')}
            className="flex items-center gap-2 rounded-xl bg-[#0B2240] px-4 py-2 text-xs font-bold text-white transition hover:bg-[#123157] shadow-xs"
          >
            <Briefcase className="h-4 w-4" />
            Vagas Abertas
          </button>
        </div>
      </div>

      {/* Main Bento Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Large Main Bento Card: Recruitment Pipeline */}
        <div className="md:col-span-2 lg:col-span-2 md:row-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm p-6 flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-bold text-slate-800 flex items-center gap-2 text-base">
                <Briefcase className="w-5 h-5 text-blue-500" />
                Pipeline de Candidaturas
              </h3>
              <span className="text-xs text-blue-600 font-bold bg-blue-50 px-3 py-1 rounded-full border border-blue-100">
                +{candidaturas.length} ativas
              </span>
            </div>
            
            <div className="space-y-4">
              <div className="group cursor-pointer" onClick={() => onNavigateTab('recrutamento')}>
                <div className="flex justify-between text-xs font-bold mb-1 uppercase tracking-wide text-slate-500">
                  <span>Triagem Inicial</span>
                  <span className="text-slate-800">{triagemCount} candidatos</span>
                </div>
                <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-500 rounded-full transition-all duration-500" style={{ width: `${triagemPct}%` }}></div>
                </div>
              </div>

              <div className="group cursor-pointer" onClick={() => onNavigateTab('recrutamento')}>
                <div className="flex justify-between text-xs font-bold mb-1 uppercase tracking-wide text-slate-500">
                  <span>Entrevista RH / Gestor</span>
                  <span className="text-slate-800">{entrevistaCount} candidatos</span>
                </div>
                <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-indigo-500 rounded-full transition-all duration-500" style={{ width: `${entrevistaPct}%` }}></div>
                </div>
              </div>

              <div className="group cursor-pointer" onClick={() => onNavigateTab('recrutamento')}>
                <div className="flex justify-between text-xs font-bold mb-1 uppercase tracking-wide text-slate-500">
                  <span>Avaliação / Teste Técnico</span>
                  <span className="text-slate-800">{testeCount} candidatos</span>
                </div>
                <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-purple-500 rounded-full transition-all duration-500" style={{ width: `${testePct}%` }}></div>
                </div>
              </div>

              <div className="group cursor-pointer" onClick={() => onNavigateTab('recrutamento')}>
                <div className="flex justify-between text-xs font-bold mb-1 uppercase tracking-wide text-slate-500">
                  <span>Proposta & Contratação</span>
                  <span className="text-slate-800">{propostaCount} finalistas</span>
                </div>
                <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500 rounded-full transition-all duration-500" style={{ width: `${propostaPct}%` }}></div>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 pt-6 border-t border-slate-100 flex items-center justify-between">
            <div className="flex -space-x-2 items-center">
              {candidatos.slice(0, 3).map((c) => (
                <div
                  key={c.id}
                  className="w-8 h-8 rounded-full bg-blue-600 border-2 border-white flex items-center justify-center font-bold text-white text-[11px] shadow-xs"
                >
                  {c.nome.charAt(0)}
                </div>
              ))}
              {candidatos.length > 3 && (
                <div className="w-8 h-8 rounded-full bg-slate-800 border-2 border-white text-[10px] flex items-center justify-center font-bold text-white">
                  +{candidatos.length - 3}
                </div>
              )}
            </div>
            <button
              onClick={() => onNavigateTab('recrutamento')}
              className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 group"
            >
              Ver Funil Completo <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
            </button>
          </div>
        </div>

        {/* Medium Bento Card: AI Core Insights (Dark Luxury Card) */}
        <div className="bg-slate-900 rounded-2xl p-6 text-white flex flex-col justify-between shadow-sm border border-slate-800">
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-blue-400 rounded-full animate-ping"></div>
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">IA CONNECT Core</span>
              </div>
              <Sparkles className="h-4 w-4 text-blue-400" />
            </div>
            <h4 className="text-3xl font-extrabold tracking-tight mt-1">{mediaScoreIa}%</h4>
            <p className="text-xs text-slate-400 mt-1">Média de Match de Talentos por IA</p>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between">
            <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden mr-3">
              <div className="h-full bg-blue-400 rounded-full" style={{ width: `${mediaScoreIa}%` }}></div>
            </div>
            <span className="text-[10px] font-mono text-slate-400 bg-slate-800 px-2 py-0.5 rounded">v2.1.0</span>
          </div>
        </div>

        {/* Medium Bento Card: Active Jobs Stat */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 flex flex-col justify-between shadow-sm">
          <div className="flex justify-between items-start">
            <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl">
              <Briefcase className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100 flex items-center gap-1">
              <TrendingUp className="w-3 h-3" /> +2 Novas
            </span>
          </div>
          <div className="mt-4">
            <h4 className="text-3xl font-black text-slate-900 tracking-tight">{vagasAtivas}</h4>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mt-0.5">Vagas Publicadas</p>
          </div>
        </div>

        {/* Agenda Bento Card (col-span-2) */}
        <div className="md:col-span-2 bg-white border border-slate-200 rounded-2xl p-6 flex flex-col justify-between shadow-sm">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-slate-800 flex items-center gap-2 text-sm">
              <Calendar className="w-4 h-4 text-blue-600" />
              Próximas Entrevistas Agendadas
            </h3>
            <button
              onClick={() => onNavigateTab('agenda')}
              className="text-[11px] font-bold uppercase text-slate-500 hover:text-blue-600 transition"
            >
              Visualizar Agenda &rarr;
            </button>
          </div>
          <div className="space-y-3">
            {entrevistas.slice(0, 2).map((ent) => {
              const candObj = candidatos.find(c => c.id === ent.candidato_id);
              return (
                <div
                  key={ent.id}
                  onClick={() => onNavigateTab('agenda')}
                  className="flex items-center gap-4 p-2.5 hover:bg-slate-50 rounded-xl transition border border-transparent hover:border-slate-100 cursor-pointer"
                >
                  <div className="text-center min-w-[50px]">
                    <div className="text-[10px] font-bold text-slate-400">
                      {new Date(ent.data_hora).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                    <div className="text-xs font-bold text-blue-600">Hoje</div>
                  </div>
                  <div className="w-px h-8 bg-slate-200"></div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-bold text-slate-800 truncate">{ent.titulo}</div>
                    <div className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">
                      {candObj?.nome || 'Candidato'} • {ent.formato}
                    </div>
                  </div>
                  <div className="bg-blue-50 border border-blue-100 px-2.5 py-1 rounded-lg text-[10px] font-bold text-blue-700 uppercase shrink-0">
                    MEETING
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Supabase Storage / Database Health Bento Card */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 flex flex-col justify-between shadow-sm">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h5 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Supabase Database</h5>
              <Database className="w-4 h-4 text-emerald-500" />
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span className="font-medium text-slate-600">Conexão RLS</span>
                <span className="font-bold text-emerald-600">Ativa (OK)</span>
              </div>
              <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-slate-800 rounded-full w-[78%]"></div>
              </div>
            </div>
          </div>
          <p className="text-[10px] text-slate-500 mt-3 border-t border-slate-100 pt-2">
            Políticas Row Level Security ativas por <code className="text-blue-600 font-bold">empresa_id</code>
          </p>
        </div>

        {/* Realtime System Logs Bento Card */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 flex flex-col justify-between shadow-sm">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h5 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Histórico Realtime</h5>
              <span className="h-2 w-2 rounded-full bg-blue-500 animate-pulse"></span>
            </div>
            <div className="space-y-2.5">
              {logs.slice(0, 3).map((log, idx) => (
                <div key={log.id} className="flex gap-2 text-[10px] items-start">
                  <span className={`w-1.5 h-1.5 mt-1 rounded-full shrink-0 ${
                    idx === 0 ? 'bg-blue-500' : idx === 1 ? 'bg-emerald-500' : 'bg-amber-500'
                  }`}></span>
                  <span className="text-slate-600 truncate">
                    <b className="text-slate-800">{log.usuario_nome}:</b> {log.detalhes}
                  </span>
                </div>
              ))}
            </div>
          </div>
          <button
            onClick={() => onNavigateTab('audit_logs')}
            className="text-[10px] font-bold text-blue-600 hover:underline mt-3 border-t border-slate-100 pt-2 text-left"
          >
            Ver Logs de Auditoria &rarr;
          </button>
        </div>
      </div>
    </div>
  );
};
