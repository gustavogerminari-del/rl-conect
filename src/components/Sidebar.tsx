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
  Code2,
} from 'lucide-react';
import { dataService } from '../services/dataService';

export type ViewTab =
  | 'dashboard'
  | 'master_admin'
  | 'developer_area'
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

const normalize = (value: unknown) => String(value || '').trim();

export const Sidebar: React.FC<SidebarProps> = ({ currentTab, onSelectTab }) => {
  const user: any = dataService.getCurrentUser();
  const normalizedRole = normalize(user?.role || user?.tipoUsuario).toLowerCase().replace(/[\s-]+/g, '_');
  const isMaster = ['master_admin', 'master', 'super_administrador'].includes(normalizedRole);
  const isCompanyAdmin = ['admin_empresa', 'administrador_empresa', 'empresa_admin', 'gestor_empresa', 'admin', 'administrador'].includes(normalizedRole)
    || normalize(user?.tipoUsuario).toUpperCase() === 'ADMIN_EMPRESA';

  const modules: Record<string, boolean> = {
    ...(user?.modulos && typeof user.modulos === 'object' ? user.modulos : {}),
    ...(user?.modules && typeof user.modules === 'object' ? user.modules : {}),
  };
  const permissions = new Set<string>([
    ...(Array.isArray(user?.permissoes) ? user.permissoes : []),
    ...(Array.isArray(user?.permissions) ? user.permissions : []),
  ].map(String));

  const hasAccess = (...keys: string[]) => isMaster || keys.some((key) => modules[key] === true || permissions.has(key));

  const menuGroups = [
    {
      title: 'INÍCIO',
      items: [
        { id: 'dashboard' as ViewTab, label: 'Visão Geral', icon: LayoutDashboard, visible: true, badge: null },
      ],
    },
    {
      title: 'RECRUTAMENTO & HEADHUNTER',
      items: [
        { id: 'recrutamento' as ViewTab, label: 'Vagas & Processos (ATS)', icon: Briefcase, visible: hasAccess('recrutamento', 'vagas', 'candidatos', 'contratacoes'), badge: null },
        { id: 'headhunter' as ViewTab, label: 'Headhunter Executive', icon: UserCheck, visible: hasAccess('headhunter'), badge: 'B2B' },
        { id: 'ia_screening' as ViewTab, label: 'IA & Triagem CV', icon: Sparkles, visible: hasAccess('ia_cv', 'consultorRH', 'recrutamento'), badge: 'Gemini' },
        { id: 'agenda' as ViewTab, label: 'Agenda & Entrevistas', icon: Calendar, visible: hasAccess('agenda', 'entrevistas', 'recrutamento'), badge: null },
      ],
    },
    {
      title: 'DEPARTAMENTO PESSOAL',
      items: [
        { id: 'departamento_pessoal' as ViewTab, label: 'Gestão DP & Ponto', icon: Users, visible: hasAccess('departamentoPessoal', 'departamento_pessoal', 'dp', 'admissao', 'funcionarios'), badge: 'RH' },
      ],
    },
    {
      title: 'PORTAL & CONFIGURAÇÕES',
      items: [
        { id: 'portal_vagas' as ViewTab, label: 'Portal de Vagas Público', icon: Globe, visible: hasAccess('siteVagas', 'siteVagasPersonalizado', 'portal_vagas', 'recrutamento'), badge: 'Público' },
        { id: 'audit_logs' as ViewTab, label: 'Auditoria & Logs', icon: ShieldAlert, visible: hasAccess('auditoria', 'auditoriaLogs'), badge: 'Segurança' },
        { id: 'settings' as ViewTab, label: 'Configurações Empresa', icon: Settings, visible: isCompanyAdmin || hasAccess('configuracoes'), badge: null },
      ],
    },
    {
      title: 'PLATAFORMA & MASTER',
      items: [
        { id: 'master_admin' as ViewTab, label: 'Painel Master Admin', icon: Crown, visible: isMaster, badge: 'MASTER', highlight: true },
        { id: 'developer_area' as ViewTab, label: 'Área do Programador', icon: Code2, visible: isMaster, badge: 'DEV' },
        { id: 'construtor_ia' as ViewTab, label: 'Construtor Master IA', icon: Cpu, visible: isMaster, badge: 'IA' },
      ],
    },
  ];

  const activeEmpresa: any = dataService.getActiveEmpresa?.();

  return (
    <aside className="flex min-h-screen w-60 shrink-0 flex-col border-r border-[#152e4d] bg-[#0B1D33] text-slate-300">
      <div className="border-b border-[#18365a]/60 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#254b7c] bg-[#183a63] text-xs font-black text-white shadow-sm">RL</div>
            <div className="flex flex-col">
              <span className="text-sm font-extrabold leading-tight tracking-tight text-white">RL CONNECT</span>
              <span className="text-[10px] font-semibold leading-tight text-slate-400">R Lourenço RH</span>
            </div>
          </div>
          <button className="rounded-md p-1 text-slate-400 transition hover:text-white" aria-label="Recolher menu">
            <ChevronLeft className="h-4 w-4 text-blue-400" />
          </button>
        </div>
      </div>

      <nav className="flex-1 space-y-5 overflow-y-auto p-3">
        {menuGroups.map((group) => {
          const visibleItems = group.items.filter((item) => item.visible);
          if (!visibleItems.length) return null;
          return (
            <div key={group.title} className="space-y-1">
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
                          ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                          : 'bg-[#2563eb] text-white shadow-md shadow-blue-600/30'
                        : 'text-slate-300 hover:bg-[#132c4a] hover:text-white'
                    }`}
                  >
                    <div className="flex min-w-0 items-center gap-2.5">
                      <Icon className={`h-4 w-4 shrink-0 ${isActive ? (item.highlight ? 'text-slate-950' : 'text-white') : 'text-slate-400 group-hover:text-white'}`} />
                      <span className="truncate">{item.label}</span>
                    </div>
                    {item.badge && (
                      <span className={`rounded-md px-1.5 py-0.5 text-[9px] font-black uppercase ${isActive ? (item.highlight ? 'bg-slate-950 text-amber-300' : 'bg-blue-700 text-white') : item.highlight ? 'border border-amber-500/30 bg-amber-500/20 text-amber-400' : 'bg-[#183252] text-slate-300'}`}>
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          );
        })}
      </nav>

      <div className="space-y-2 border-t border-[#132d4b] bg-[#081628] p-3">
        <div className="flex items-center gap-2 text-[10px] text-slate-400">
          <span className="h-2 w-2 rounded-full bg-emerald-400"></span>
          <span>Firebase conectado</span>
        </div>
        <div className="truncate text-[10px] text-slate-500">Empresa: <strong className="text-slate-300">{activeEmpresa?.nome || activeEmpresa?.companyName || 'Tenant autenticado'}</strong></div>
      </div>
    </aside>
  );
};
