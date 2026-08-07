import React, { useState, useEffect } from 'react';
import {
  Bell,
  Building2,
  Database,
  UserCheck,
  ShieldCheck,
  ChevronDown,
  Check,
  Code2,
  Search,
  Plus,
  Crown,
  LogOut,
  Shield,
  Briefcase,
} from 'lucide-react';
import { dataService } from '../services/dataService';
import { isSupabaseConfigured } from '../lib/supabase';
import { UserRole } from '../types';

interface HeaderProps {
  onOpenSupabaseModal: () => void;
  onNavigateTab?: (tab: any) => void;
  currentTab?: string;
}

export const Header: React.FC<HeaderProps> = ({ onOpenSupabaseModal, onNavigateTab, currentTab }) => {
  const [user, setUser] = useState(dataService.getCurrentUser());
  const [activeEmpresa, setActiveEmpresa] = useState(dataService.getActiveEmpresa());
  const [empresas, setEmpresas] = useState(dataService.getEmpresas());
  const [notificacoes, setNotificacoes] = useState(dataService.getNotificacoes());
  const [showNotifPopover, setShowNotifPopover] = useState(false);
  const [showRoleMenu, setShowRoleMenu] = useState(false);
  const [showTenantMenu, setShowTenantMenu] = useState(false);
  const [showQuickActions, setShowQuickActions] = useState(false);

  useEffect(() => {
    const updateState = () => {
      setUser(dataService.getCurrentUser());
      setActiveEmpresa(dataService.getActiveEmpresa());
      setEmpresas(dataService.getEmpresas());
      setNotificacoes(dataService.getNotificacoes());
    };
    const unsubscribe = dataService.subscribe(updateState);
    return () => {
      unsubscribe();
    };
  }, []);

  const unreadCount = notificacoes.filter((n) => !n.lida).length;

  const rolesList: { role: UserRole; label: string; desc: string }[] = [
    { role: 'master_admin', label: 'Administrador Master', desc: 'Acesso total a todas as empresas, planos e módulos' },
    { role: 'empresa_admin', label: 'Administrador Empresa', desc: 'Acesso total à gestão da empresa ativa' },
    { role: 'recrutador', label: 'Recrutador / RH', desc: 'Gestão de vagas, candidatos e entrevistas' },
    { role: 'gestor', label: 'Gestor de Departamento', desc: 'Visualização da equipe e aprovação de vagas' },
    { role: 'headhunter', label: 'Headhunter Executive', desc: 'Módulo de consultoria e gestão de clientes' },
    { role: 'candidato', label: 'Candidato (Portal)', desc: 'Visão pública do candidato e suas inscrições' },
  ];

  const handleRoleChange = (role: UserRole) => {
    const users = dataService.getAllUsuariosMaster();
    const targetUser = users.find((u) => u.role === role);
    if (targetUser) {
      dataService.setCurrentUser(targetUser.id);
    } else {
      dataService.updateEmpresa(activeEmpresa.id, {});
      const currentUser = dataService.getCurrentUser();
      currentUser.role = role;
      dataService.setCurrentUser(currentUser.id);
    }
    setShowRoleMenu(false);
  };

  const handleTenantChange = (empresaId: string) => {
    dataService.setActiveEmpresa(empresaId);
    setShowTenantMenu(false);
  };

  const getUserInitials = (name: string) => {
    if (!name) return 'U';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  return (
    <div className="w-full flex flex-col z-30">
      {/* 1. TOPMOST AUTHENTICATED SESSION BAR (Exact match to video/screenshots 1 & 2) */}
      <div className="bg-[#070e1c] text-white px-4 py-1.5 flex flex-wrap items-center justify-between text-xs font-semibold border-b border-slate-800">
        <div className="flex items-center gap-2">
          <Shield className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
          <span className="text-slate-300 font-medium text-[11px]">
            Sessão Autenticada: <strong className="text-white font-bold">{user.nome}</strong> ({user.email})
          </span>

          {user.role === 'master_admin' ? (
            <div className="flex items-center gap-1.5 ml-2">
              <span className="rounded bg-amber-500 text-slate-950 font-extrabold text-[10px] uppercase px-2 py-0.5 shadow-2xs">
                Super Administrador
              </span>
              <span className="rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 font-extrabold text-[10px] uppercase px-2 py-0.5">
                👑 ACESSO MASTER GLOBAL
              </span>
            </div>
          ) : (
            <span className="rounded bg-slate-800 text-slate-200 border border-slate-700 font-bold text-[10px] uppercase px-2 py-0.5 ml-1">
              • {user.role.toUpperCase()}
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => handleRoleChange(user.role === 'master_admin' ? 'empresa_admin' : 'master_admin')}
            className="text-[10px] text-amber-400 hover:underline font-bold"
          >
            {user.role === 'master_admin' ? 'Simular Modo Empresa' : 'Entrar como Master'}
          </button>
          <button
            onClick={() => {
              // Toggle role simulation or reset session
              alert('Sessão mantida via Supabase Auth.');
            }}
            className="bg-[#851e29] hover:bg-[#9e2432] text-white px-2.5 py-0.5 rounded text-[11px] font-bold flex items-center gap-1 transition shadow-2xs"
          >
            <LogOut className="h-3 w-3" />
            Encerrar Sessão
          </button>
        </div>
      </div>

      {/* 2. MAIN HEADER BAR (White background with Logo, Search, Action Button, Master Toggle, Avatar) */}
      <header className="flex h-16 w-full items-center justify-between border-b border-slate-200 bg-white px-4 sm:px-6 shadow-2xs">
        {/* Left: Brand Identity & Active Empresa Badge */}
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#0B2240] font-black text-white text-sm shadow-xs">
            RL
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="text-base font-black tracking-tight text-[#0B2240] leading-none">
                RL CONNECT
              </span>
              <span className="rounded-md bg-slate-100 text-slate-700 border border-slate-200 text-[10px] font-extrabold px-2 py-0.5 leading-none">
                {activeEmpresa.nome.toUpperCase()}
              </span>
            </div>
            <span className="text-[10px] font-semibold text-slate-500 leading-tight mt-0.5">
              Gestão Inteligente de Pessoas & Seleção
            </span>
          </div>
        </div>

        {/* Center: Search Bar Capsule */}
        <div className="hidden md:flex flex-1 max-w-md mx-6">
          <div className="relative w-full">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar candidato, vaga ou competência..."
              className="w-full rounded-xl border border-slate-200 bg-slate-50/50 pl-10 pr-4 py-2 text-xs font-medium text-slate-800 placeholder-slate-400 transition focus:bg-white focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 shadow-2xs"
            />
          </div>
        </div>

        {/* Right Section: Actions, Notifications, Role Switcher, Avatar */}
        <div className="flex items-center gap-2.5 sm:gap-3">
          {/* Quick Action Button */}
          <div className="relative">
            <button
              onClick={() => setShowQuickActions(!showQuickActions)}
              className="flex items-center gap-1.5 rounded-xl bg-[#0B2240] px-3.5 py-2 text-xs font-bold text-white transition hover:bg-[#123157] shadow-xs"
            >
              <Plus className="h-4 w-4" />
              <span>Ação Rápida</span>
              <ChevronDown className="h-3.5 w-3.5 opacity-80" />
            </button>

            {showQuickActions && (
              <div className="absolute right-0 mt-2 w-56 rounded-xl border border-slate-200 bg-white p-2 shadow-xl z-50 text-xs">
                <button
                  onClick={() => {
                    if (onNavigateTab) onNavigateTab('recrutamento');
                    setShowQuickActions(false);
                  }}
                  className="flex w-full items-center gap-2 rounded-lg p-2 text-slate-700 hover:bg-slate-100 font-semibold"
                >
                  <Briefcase className="h-4 w-4 text-blue-600" />
                  Nova Vaga de Emprego
                </button>
                <button
                  onClick={() => {
                    if (onNavigateTab) onNavigateTab('headhunter');
                    setShowQuickActions(false);
                  }}
                  className="flex w-full items-center gap-2 rounded-lg p-2 text-slate-700 hover:bg-slate-100 font-semibold"
                >
                  <UserCheck className="h-4 w-4 text-indigo-600" />
                  Cadastrar Candidato
                </button>
              </div>
            )}
          </div>

          {/* Master Panel Button (if Master Admin) */}
          {user.role === 'master_admin' && (
            <button
              onClick={() => onNavigateTab && onNavigateTab('master_admin')}
              className={`flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-black transition shadow-xs ${
                currentTab === 'master_admin'
                  ? 'bg-amber-500 text-slate-950 font-black'
                  : 'bg-[#0B2240] text-amber-400 hover:bg-[#123157]'
              }`}
            >
              <Crown className="h-4 w-4" />
              <span>Painel Master</span>
            </button>
          )}

          {/* Supabase DDL Config Modal Toggle */}
          <button
            onClick={onOpenSupabaseModal}
            className="hidden lg:flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-100 transition"
            title="Conectividade Supabase PostgreSQL"
          >
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <Code2 className="h-3.5 w-3.5 text-slate-500" />
          </button>

          {/* Notifications */}
          <div className="relative">
            <button
              onClick={() => setShowNotifPopover(!showNotifPopover)}
              className="relative rounded-xl border border-slate-200 bg-slate-50 p-2 text-slate-600 hover:bg-slate-100 transition"
            >
              <Bell className="h-4 w-4" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-rose-600 text-[9px] font-black text-white ring-2 ring-white">
                  {unreadCount}
                </span>
              )}
            </button>

            {showNotifPopover && (
              <div className="absolute right-0 mt-2 w-80 rounded-2xl border border-slate-200 bg-white p-3 shadow-2xl z-50">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <span className="text-[10px] font-bold uppercase text-slate-500 tracking-wider">
                    Notificações Supabase Realtime
                  </span>
                  <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-200">
                    Sincronizado
                  </span>
                </div>
                <div className="mt-2 max-h-64 space-y-2 overflow-y-auto pr-1">
                  {notificacoes.length === 0 ? (
                    <p className="p-4 text-center text-xs text-slate-400">Nenhuma notificação pendente.</p>
                  ) : (
                    notificacoes.map((n) => (
                      <div
                        key={n.id}
                        onClick={() => dataService.markNotificacaoLida(n.id)}
                        className={`cursor-pointer rounded-xl p-2.5 text-xs transition ${
                          n.lida
                            ? 'bg-slate-50 text-slate-600'
                            : 'bg-blue-50/80 font-medium text-slate-900 border-l-3 border-blue-600'
                        }`}
                      >
                        <div className="font-bold">{n.titulo}</div>
                        <div className="mt-0.5 text-[11px] text-slate-600 line-clamp-2">{n.mensagem}</div>
                        <div className="mt-1 text-[9px] text-slate-400">
                          {new Date(n.criado_em).toLocaleTimeString()}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* User Profile Info Pill */}
          <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#0B2240] text-xs font-extrabold text-white shadow-2xs">
              {getUserInitials(user.nome)}
            </div>
            <div className="hidden xl:flex flex-col">
              <span className="text-xs font-extrabold text-slate-900 leading-none">{user.nome}</span>
              <span className="text-[10px] font-semibold text-slate-500 uppercase leading-none mt-1">
                {user.role === 'master_admin' ? 'Super Administrator' : user.role.replace('_', ' ')}
              </span>
            </div>
          </div>
        </div>
      </header>
    </div>
  );
};

