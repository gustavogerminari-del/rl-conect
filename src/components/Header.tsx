import React, { useEffect, useState } from 'react';
import {
  Bell,
  Briefcase,
  ChevronDown,
  Code2,
  Crown,
  LogOut,
  Plus,
  Search,
  Shield,
  UserCheck,
} from 'lucide-react';
import { dataService } from '../services/dataService';
import { isSupabaseConfigured, supabase } from '../lib/supabase';

interface HeaderProps {
  onOpenSupabaseModal: () => void;
  onNavigateTab?: (tab: any) => void;
  currentTab?: string;
}

export const Header: React.FC<HeaderProps> = ({ onOpenSupabaseModal, onNavigateTab, currentTab }) => {
  const [user, setUser] = useState(dataService.getCurrentUser());
  const [activeEmpresa, setActiveEmpresa] = useState(dataService.getActiveEmpresa());
  const [notificacoes, setNotificacoes] = useState(dataService.getNotificacoes());
  const [showNotifPopover, setShowNotifPopover] = useState(false);
  const [showQuickActions, setShowQuickActions] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    const updateState = () => {
      setUser(dataService.getCurrentUser());
      setActiveEmpresa(dataService.getActiveEmpresa());
      setNotificacoes(dataService.getNotificacoes());
    };
    return dataService.subscribe(updateState);
  }, []);

  const unreadCount = notificacoes.filter((n) => !n.lida).length;
  const getUserInitials = (name: string) => {
    const parts = (name || 'U').trim().split(/\s+/);
    return parts.length >= 2 ? `${parts[0][0]}${parts[1][0]}`.toUpperCase() : parts[0].slice(0, 2).toUpperCase();
  };

  const handleLogout = async () => {
    if (!supabase || !isSupabaseConfigured) return;
    setLoggingOut(true);
    try {
      await supabase.auth.signOut();
      window.location.reload();
    } finally {
      setLoggingOut(false);
    }
  };

  return (
    <div className="w-full flex flex-col z-30">
      <div className="bg-[#070e1c] text-white px-4 py-1.5 flex flex-wrap items-center justify-between gap-2 text-xs font-semibold border-b border-slate-800">
        <div className="flex items-center gap-2 min-w-0">
          <Shield className={`h-3.5 w-3.5 shrink-0 ${isSupabaseConfigured ? 'text-emerald-400' : 'text-amber-400'}`} />
          <span className="text-slate-300 font-medium text-[11px] truncate">
            {isSupabaseConfigured ? 'Sessão RL Connect:' : 'Modo local de homologação:'}{' '}
            <strong className="text-white font-bold">{user.nome}</strong>
          </span>
          {user.role === 'master_admin' ? (
            <span className="rounded bg-amber-500 text-slate-950 font-extrabold text-[10px] uppercase px-2 py-0.5">Master</span>
          ) : (
            <span className="rounded bg-slate-800 text-slate-200 border border-slate-700 font-bold text-[10px] uppercase px-2 py-0.5">
              {user.role.replace('_', ' ')}
            </span>
          )}
        </div>

        <button
          onClick={() => void handleLogout()}
          disabled={!isSupabaseConfigured || loggingOut}
          title={!isSupabaseConfigured ? 'Logout real será habilitado quando Supabase Auth estiver configurado.' : 'Encerrar sessão'}
          className="bg-[#851e29] enabled:hover:bg-[#9e2432] disabled:bg-slate-700 disabled:text-slate-400 text-white px-2.5 py-0.5 rounded text-[11px] font-bold flex items-center gap-1 transition"
        >
          <LogOut className="h-3 w-3" />
          {loggingOut ? 'Encerrando...' : 'Encerrar Sessão'}
        </button>
      </div>

      {!isSupabaseConfigured && (
        <div className="border-b border-amber-200 bg-amber-50 px-4 py-1.5 text-[10px] font-semibold text-amber-800">
          Homologação local: autenticação/persistência Supabase ainda não estão ativas. Não use este modo como produção.
        </div>
      )}

      <header className="flex h-16 w-full items-center justify-between border-b border-slate-200 bg-white px-4 sm:px-6 shadow-2xs">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#0B2240] font-black text-white text-sm shadow-xs">RL</div>
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-base font-black tracking-tight text-[#0B2240] leading-none">RL CONNECT</span>
              <span className="hidden sm:inline rounded-md bg-slate-100 text-slate-700 border border-slate-200 text-[10px] font-extrabold px-2 py-0.5 truncate max-w-48">
                {activeEmpresa.nome.toUpperCase()}
              </span>
            </div>
            <span className="text-[10px] font-semibold text-slate-500 leading-tight mt-0.5">Gestão Inteligente de Pessoas & Seleção</span>
          </div>
        </div>

        <div className="hidden md:flex flex-1 max-w-md mx-6">
          <div className="relative w-full">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input type="text" placeholder="Buscar candidato, vaga ou competência..." className="w-full rounded-xl border border-slate-200 bg-slate-50/50 pl-10 pr-4 py-2 text-xs font-medium text-slate-800 placeholder-slate-400 focus:bg-white focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100" />
          </div>
        </div>

        <div className="flex items-center gap-2.5 sm:gap-3">
          <div className="relative">
            <button onClick={() => setShowQuickActions((value) => !value)} className="flex items-center gap-1.5 rounded-xl bg-[#0B2240] px-3.5 py-2 text-xs font-bold text-white transition hover:bg-[#123157] shadow-xs">
              <Plus className="h-4 w-4" /><span className="hidden sm:inline">Ação Rápida</span><ChevronDown className="h-3.5 w-3.5 opacity-80" />
            </button>
            {showQuickActions && (
              <div className="absolute right-0 mt-2 w-56 rounded-xl border border-slate-200 bg-white p-2 shadow-xl z-50 text-xs">
                <button onClick={() => { onNavigateTab?.('recrutamento'); setShowQuickActions(false); }} className="flex w-full items-center gap-2 rounded-lg p-2 text-slate-700 hover:bg-slate-100 font-semibold">
                  <Briefcase className="h-4 w-4 text-blue-600" /> Nova Vaga de Emprego
                </button>
                {['master_admin', 'empresa_admin', 'headhunter'].includes(user.role) && (
                  <button onClick={() => { onNavigateTab?.('headhunter'); setShowQuickActions(false); }} className="flex w-full items-center gap-2 rounded-lg p-2 text-slate-700 hover:bg-slate-100 font-semibold">
                    <UserCheck className="h-4 w-4 text-indigo-600" /> Abrir Headhunter
                  </button>
                )}
              </div>
            )}
          </div>

          {user.role === 'master_admin' && (
            <button onClick={() => onNavigateTab?.('master_admin')} className={`hidden lg:flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-black transition ${currentTab === 'master_admin' ? 'bg-amber-500 text-slate-950' : 'bg-[#0B2240] text-amber-400 hover:bg-[#123157]'}`}>
              <Crown className="h-4 w-4" /> Painel Master
            </button>
          )}

          <button onClick={onOpenSupabaseModal} className="hidden lg:flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-100" title={isSupabaseConfigured ? 'Supabase configurado' : 'Configurar Supabase'}>
            <span className={`w-2 h-2 rounded-full ${isSupabaseConfigured ? 'bg-emerald-500' : 'bg-amber-500'}`}></span><Code2 className="h-3.5 w-3.5 text-slate-500" />
          </button>

          <div className="relative">
            <button onClick={() => setShowNotifPopover((value) => !value)} className="relative rounded-xl border border-slate-200 bg-slate-50 p-2 text-slate-600 hover:bg-slate-100 transition" aria-label="Notificações">
              <Bell className="h-4 w-4" />
              {unreadCount > 0 && <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-rose-600 text-[9px] font-black text-white ring-2 ring-white">{unreadCount}</span>}
            </button>
            {showNotifPopover && (
              <div className="absolute right-0 mt-2 w-80 rounded-2xl border border-slate-200 bg-white p-3 shadow-2xl z-50">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <span className="text-[10px] font-bold uppercase text-slate-500 tracking-wider">Notificações</span>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${isSupabaseConfigured ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                    {isSupabaseConfigured ? 'Backend configurado' : 'Dados locais'}
                  </span>
                </div>
                <div className="mt-2 max-h-64 space-y-2 overflow-y-auto pr-1">
                  {notificacoes.length === 0 ? <p className="p-4 text-center text-xs text-slate-400">Nenhuma notificação pendente.</p> : notificacoes.map((n) => (
                    <button key={n.id} onClick={() => dataService.markNotificacaoLida(n.id)} className={`block w-full text-left rounded-xl p-2.5 text-xs transition ${n.lida ? 'bg-slate-50 text-slate-600' : 'bg-blue-50/80 font-medium text-slate-900 border-l-3 border-blue-600'}`}>
                      <div className="font-bold">{n.titulo}</div><div className="mt-0.5 text-[11px] text-slate-600 line-clamp-2">{n.mensagem}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#0B2240] text-xs font-extrabold text-white">{getUserInitials(user.nome)}</div>
            <div className="hidden xl:flex flex-col max-w-40">
              <span className="text-xs font-extrabold text-slate-900 leading-none truncate">{user.nome}</span>
              <span className="text-[10px] font-semibold text-slate-500 uppercase leading-none mt-1">{user.role.replace('_', ' ')}</span>
            </div>
          </div>
        </div>
      </header>
    </div>
  );
};
