import React, { useEffect, useMemo, useState } from 'react';
import { ShieldX } from 'lucide-react';
import { Header } from './components/Header';
import { Sidebar, type ViewTab } from './components/Sidebar';
import { SupabaseSetupModal } from './components/SupabaseSetupModal';
import { dataService } from './services/dataService';
import { canAccessView, moduleStateFromCompanyModules } from './services/accessControl';

import { DashboardView } from './components/views/DashboardView';
import { MasterAdminView } from './components/views/MasterAdminView';
import { RecruitmentView } from './components/views/RecruitmentView';
import { HeadhunterView } from './components/views/HeadhunterView';
import { PublicPortalView } from './components/views/PublicPortalView';
import { PublicCompanyPortal } from './components/views/PublicCompanyPortal';
import { AiScreeningView } from './components/views/AiScreeningView';
import { AgendaView } from './components/views/AgendaView';
import { DepartamentoPessoalView } from './components/views/DepartamentoPessoalView';
import { AuditLogsView } from './components/views/AuditLogsView';
import { CompanySettingsView } from './components/views/CompanySettingsView';
import { MasterBuilderView } from './components/views/MasterBuilderView';

const ALL_INTERNAL_VIEWS: ViewTab[] = [
  'dashboard',
  'recrutamento',
  'headhunter',
  'ia_screening',
  'agenda',
  'departamento_pessoal',
  'portal_vagas',
  'audit_logs',
  'settings',
  'master_admin',
  'construtor_ia',
];

export function App() {
  const [currentTab, setCurrentTab] = useState<ViewTab>('dashboard');
  const [isSupabaseModalOpen, setIsSupabaseModalOpen] = useState(false);
  const [, setSessionVersion] = useState(0);

  const [publicEmpresaId, setPublicEmpresaId] = useState<string | null>(() => {
    const path = window.location.pathname;
    if (path.includes('/vagas/')) {
      const parts = path.split('/vagas/');
      if (parts[1]) return parts[1].split('/')[0];
    }
    const hash = window.location.hash;
    if (hash.includes('#/vagas/')) {
      const parts = hash.split('#/vagas/');
      if (parts[1]) return parts[1].split('/')[0];
    }
    return null;
  });

  useEffect(() => dataService.subscribe(() => setSessionVersion((value) => value + 1)), []);

  const user = dataService.getCurrentUser();
  const moduleState = useMemo(
    () => moduleStateFromCompanyModules(dataService.getEmpresaModulos()),
    [user.id, user.empresa_id]
  );
  const allowed = (view: ViewTab) => canAccessView(user.role, view, moduleState);

  const safeNavigate = (view: ViewTab) => {
    if (allowed(view)) setCurrentTab(view);
  };

  useEffect(() => {
    if (allowed(currentTab)) return;
    const fallback = ALL_INTERNAL_VIEWS.find((view) => allowed(view));
    if (fallback) setCurrentTab(fallback);
  }, [currentTab, user.id, user.role, user.empresa_id]);

  useEffect(() => {
    const handleUrlChange = () => {
      const path = window.location.pathname;
      if (path.includes('/vagas/')) {
        const parts = path.split('/vagas/');
        if (parts[1]) {
          setPublicEmpresaId(parts[1].split('/')[0]);
          return;
        }
      }
      const hash = window.location.hash;
      if (hash.includes('#/vagas/')) {
        const parts = hash.split('#/vagas/');
        if (parts[1]) {
          setPublicEmpresaId(parts[1].split('/')[0]);
          return;
        }
      }
      setPublicEmpresaId(null);
    };

    window.addEventListener('popstate', handleUrlChange);
    window.addEventListener('hashchange', handleUrlChange);
    return () => {
      window.removeEventListener('popstate', handleUrlChange);
      window.removeEventListener('hashchange', handleUrlChange);
    };
  }, []);

  if (publicEmpresaId) {
    return (
      <PublicCompanyPortal
        empresaId={publicEmpresaId}
        onBackToApp={() => {
          window.history.pushState({}, '', '/');
          setPublicEmpresaId(null);
          const fallback = ALL_INTERNAL_VIEWS.find((view) => allowed(view));
          if (fallback) setCurrentTab(fallback);
        }}
      />
    );
  }

  const hasAnyInternalAccess = ALL_INTERNAL_VIEWS.some((view) => allowed(view));
  if (!hasAnyInternalAccess) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="max-w-lg rounded-2xl border border-rose-200 bg-white p-7 text-center shadow-xl">
          <ShieldX className="mx-auto h-10 w-10 text-rose-600" />
          <h1 className="mt-3 text-lg font-extrabold text-slate-900">Acesso interno não autorizado</h1>
          <p className="mt-2 text-sm text-slate-600">Este perfil não possui permissão para os módulos administrativos do RL Connect.</p>
          <a href="/vagas/emp_1" className="mt-5 inline-flex rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white">Ir para o portal público</a>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-slate-50 font-sans text-slate-900 antialiased">
      <Sidebar currentTab={currentTab} onSelectTab={safeNavigate} />

      <div className="flex flex-1 flex-col overflow-x-hidden">
        <Header
          onOpenSupabaseModal={() => setIsSupabaseModalOpen(true)}
          onNavigateTab={(tab) => safeNavigate(tab as ViewTab)}
          currentTab={currentTab}
        />

        <main className="flex-1 w-full mx-auto p-4 sm:p-6 lg:p-8 max-w-7xl">
          {!allowed(currentTab) ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-rose-800">
              <div className="flex items-center gap-2 font-extrabold"><ShieldX className="h-5 w-5" /> Acesso negado</div>
              <p className="mt-1 text-xs">Seu perfil não possui permissão para este módulo.</p>
            </div>
          ) : (
            <>
              {currentTab === 'dashboard' && <DashboardView onNavigateTab={(tab) => safeNavigate(tab as ViewTab)} />}
              {currentTab === 'master_admin' && <MasterAdminView />}
              {currentTab === 'construtor_ia' && <MasterBuilderView />}
              {currentTab === 'recrutamento' && <RecruitmentView />}
              {currentTab === 'headhunter' && <HeadhunterView />}
              {currentTab === 'portal_vagas' && <PublicPortalView />}
              {currentTab === 'ia_screening' && <AiScreeningView />}
              {currentTab === 'agenda' && <AgendaView />}
              {currentTab === 'departamento_pessoal' && <DepartamentoPessoalView />}
              {currentTab === 'audit_logs' && <AuditLogsView />}
              {currentTab === 'settings' && <CompanySettingsView />}
            </>
          )}
        </main>
      </div>

      <SupabaseSetupModal
        isOpen={isSupabaseModalOpen}
        onClose={() => setIsSupabaseModalOpen(false)}
      />
    </div>
  );
}

export default App;
