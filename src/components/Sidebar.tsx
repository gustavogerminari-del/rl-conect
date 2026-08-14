import React from 'react';
import {
  LayoutDashboard,
  Briefcase,
  Users,
  UserCheck,
  Globe,
  Sparkles,
  Calendar,
  ShieldAlert,
  Settings,
  Crown,
  Cpu,
  ChevronLeft,
} from 'lucide-react';
import { dataService } from '../services/dataService';
import { canAccessView, moduleStateFromCompanyModules } from '../services/accessControl';
import { isSupabaseConfigured } from '../lib/supabase';

export type ViewTab =
  | 'dashboard'
  | 'master_admin'
  | 'construtor_ia'
  | 'recrutamento'
  | 'headhunter'
  | 'portal_vagas'
  | 'ia_screening'
  | 'agenda'
  | 'departamento_pessoal'
  | 'audit_logs'
  | 'settings';

interface SidebarProps {
  currentTab: ViewTab;
  onSelectTab: (tab: ViewTab) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentTab, onSelectTab }) => {
  const user = dataService.getCurrentUser();
  const empresaModulos = dataService.getEmpresaModulos();
  const moduleState = moduleStateFromCompanyModules(empresaModulos);
  const allowed = (view: ViewTab) => canAccessView(user.role, view, moduleState);

  const menuGroups = [
    {
      title: 'INÍCIO',
      items: [
        { id: 'dashboard' as ViewTab, label: 'Visão Geral', icon: LayoutDashboard, badge: null },
      ],
    },
    {
      title: 'RECRUTAMENTO & HEADHUNTER',
      items: [
        { id: 'recrutamento' as ViewTab, label: 'Vagas & Processos (ATS)', icon: Briefcase, badge: null },
        { id: 'headhunter' as ViewTab, label: 'Headhunter Executive', icon: UserCheck, badge: 'B2B' },
        { id: 'ia_screening' as ViewTab, label: 'IA & Triagem CV', icon: Sparkles, badge: 'IA', special: true },
        { id: 'agenda' as ViewTab, label: 'Agenda & Entrevistas', icon: Calendar, badge: null },
      ],
    },
    {
      title: 'DEPARTAMENTO PESSOAL',
      items: [
        { id: 'departamento_pessoal' as ViewTab, label: 'Gestão DP & Ponto', icon: Users, badge: 'RH' },
      ],
    },
    {
      title: 'PLATAFORMA & MASTER',
      items: [
        { id: 'master_admin' as ViewTab, label: 'Painel Master Admin', icon: Crown, badge: 'MASTER', highlight: true },
        { id: 'construtor_ia' as ViewTab, label: 'Construtor Master IA', icon: Cpu, badge: 'IA', special: true },
        { id: 'portal_vagas' as ViewTab, label: 'Portal de Vagas Público', icon: Globe, badge: 'Público' },
        { id: 'audit_logs' as ViewTab, label: 'Auditoria & RLS Logs', icon: ShieldAlert, badge: 'Segurança' },
        { id: 'settings' as ViewTab, label: 'Configurações Empresa', icon: Settings, badge: null },
      ],
    },
  ];

  return (
    <aside className="flex w-60 flex-col bg-[#0B1D33] text-slate-300 border-r border-[#152e4d] shrink-0 min-h-screen">
      <div className="p-4 border-b border-[#18365a]/60">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-[#183a63] rounded-lg flex items-center justify-center font-black text-white text-xs border border-[#254b7c] shadow-xs">RL</div>
            <div className="flex flex-col">
              <span className="text-white font-extrabold text-sm leading-tight tracking-tight">RL CONNECT</span>
              <span className="text-[10px] text-slate-400 font-semibold leading-tight">R Lourenço RH</span>
            </div>
          </div>
          <button className="text-slate-400 hover:text-white p-1 rounded-md transition" aria-label="Recolher menu">
            <ChevronLeft className="h-4 w-4 text-blue-400" />
          </button>
        </div>
      </div>

      <nav className="flex-1 space-y-5 p-3 overflow-y-auto scrollbar-none">
        {menuGroups.map((group, groupIdx) => {
          const visibleItems = group.items.filter((item) => allowed(item.id));
          if (visibleItems.length === 0) return null;
          return (
            <div key={groupIdx} className="space-y-1">
              <div className="px-3 pb-1 pt-1 text-[10px] font-black uppercase tracking-widest text-slate-400">{group.title}</div>
              {visibleItems.map((item) => {
                const Icon = item.icon;
                const isActive = currentTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => onSelectTab(item.id)}
                    className={`group flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-xs font-bold transition-all ${
                      isActive
                        ? item.highlight
                          ? 'bg-amber-500 text-slate-950 font-black shadow-md shadow-amber-500/20'
                          : 'bg-[#2563eb] text-white font-extrabold shadow-md shadow-blue-600/30'
                        : 'text-slate-300 hover:bg-[#132c4a] hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <Icon className={`h-4 w-4 shrink-0 transition-colors ${isActive ? (item.highlight ? 'text-slate-950' : 'text-white') : 'text-slate-400 group-hover:text-white'}`} />
                      <span className="truncate">{item.label}</span>
                    </div>
                    {item.badge && (
                      <span className={`rounded-md px-1.5 py-0.5 text-[9px] font-black uppercase ${
                        isActive
                          ? item.highlight
                            ? 'bg-slate-950 text-amber-300'
                            : 'bg-blue-700 text-white'
                          : item.highlight
                          ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                          : 'bg-[#183252] text-slate-300'
                      }`}>{item.badge}</span>
                    )}
                  </button>
                );
              })}
            </div>
          );
        })}
      </nav>

      <div className="p-3 bg-[#081628] border-t border-[#132d4b] space-y-2">
        <div className="flex items-center gap-2 text-[10px] text-slate-400">
          <span className={`w-2 h-2 rounded-full ${isSupabaseConfigured ? 'bg-emerald-400' : 'bg-amber-400'}`}></span>
          <span>{isSupabaseConfigured ? 'Supabase configurado' : 'Modo local — Supabase não configurado'}</span>
        </div>
        <div className="text-[10px] text-slate-500 truncate">
          Perfil: <strong className="text-slate-300">{user.role.replace('_', ' ')}</strong>
        </div>
        <div className="text-[10px] text-slate-500 truncate">
          Empresa: <strong className="text-slate-300">{dataService.getActiveEmpresa().nome}</strong>
        </div>
      </div>
    </aside>
  );
};
