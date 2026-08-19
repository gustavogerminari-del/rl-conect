import React, { useEffect, useState } from 'react';
import { Header } from './components/Header';
import { Sidebar, type ViewTab } from './components/Sidebar';
import { FirebaseLoginView } from './components/FirebaseLoginView';
import { dataService } from './services/dataService';
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
import { DeveloperArea } from './developer/DeveloperArea';

const DEVELOPER_AREA_PATH = '/master/programador';
const URL_TABS = new Set<ViewTab>([
  'dashboard',
  'master_admin',
  'construtor_ia',
  'recrutamento',
  'headhunter',
  'portal_vagas',
  'ia_screening',
  'agenda',
  'departamento_pessoal',
  'audit_logs',
  'settings',
]);

function publicCompanyFromUrl() {
  const pathMatch = window.location.pathname.match(/\/vagas\/([^/?#]+)/);
  const hashMatch = window.location.hash.match(/#\/vagas\/([^/?#]+)/);
  return decodeURIComponent(pathMatch?.[1] || hashMatch?.[1] || '') || null;
}

function developerAreaFromUrl() {
  return window.location.pathname.replace(/\/+$/, '') === DEVELOPER_AREA_PATH;
}

function tabFromUrl(): ViewTab {
  const requested = new URLSearchParams(window.location.search).get('tab') as ViewTab | null;
  return requested && URL_TABS.has(requested) ? requested : 'dashboard';
}

export function App() {
  const [currentTab, setCurrentTab] = useState<ViewTab>(tabFromUrl);
  const [status, setStatus] = useState(dataService.getFirebaseStatus());
  const [publicEmpresaId, setPublicEmpresaId] = useState<string | null>(publicCompanyFromUrl);
  const [publicReady, setPublicReady] = useState(false);
  const [developerAreaRequested, setDeveloperAreaRequested] = useState(developerAreaFromUrl);

  useEffect(() => dataService.subscribe(() => setStatus(dataService.getFirebaseStatus())), []);

  useEffect(() => {
    const syncRoute = () => {
      setPublicEmpresaId(publicCompanyFromUrl());
      setDeveloperAreaRequested(developerAreaFromUrl());
      const requestedTab = tabFromUrl();
      if (requestedTab !== 'dashboard' || new URLSearchParams(window.location.search).has('tab')) setCurrentTab(requestedTab);
    };
    window.addEventListener('popstate', syncRoute);
    window.addEventListener('hashchange', syncRoute);
    return () => {
      window.removeEventListener('popstate', syncRoute);
      window.removeEventListener('hashchange', syncRoute);
    };
  }, []);

  useEffect(() => {
    if (!publicEmpresaId) {
      setPublicReady(false);
      return;
    }
    let live = true;
    setPublicReady(false);
    dataService.loadPublicPortalFirebase(publicEmpresaId).finally(() => live && setPublicReady(true));
    return () => {
      live = false;
    };
  }, [publicEmpresaId]);

  const navigate = (tab: ViewTab) => {
    if (tab === 'developer_area') {
      window.history.pushState({}, '', DEVELOPER_AREA_PATH);
      setDeveloperAreaRequested(true);
      return;
    }
    if (developerAreaFromUrl() || window.location.search) window.history.pushState({}, '', '/');
    setDeveloperAreaRequested(false);
    setCurrentTab(tab);
  };

  const returnToMaster = () => {
    window.history.pushState({}, '', '/');
    setDeveloperAreaRequested(false);
    setCurrentTab('master_admin');
  };

  if (publicEmpresaId) {
    if (!publicReady) {
      return <div className="grid min-h-screen place-items-center bg-slate-50">Carregando vagas no Firebase...</div>;
    }
    return (
      <PublicCompanyPortal
        empresaId={publicEmpresaId}
        onBackToApp={() => {
          window.history.pushState({}, '', '/');
          setPublicEmpresaId(null);
          setCurrentTab('dashboard');
        }}
      />
    );
  }

  if (!status.ready) {
    return <div className="grid min-h-screen place-items-center bg-slate-50">Validando sessão Firebase...</div>;
  }

  if (!status.authenticated) {
    return <FirebaseLoginView error={status.error} />;
  }

  if (developerAreaRequested) {
    return <DeveloperArea onBackToMaster={returnToMaster} />;
  }

  return (
    <div className="flex min-h-screen bg-slate-50 font-sans text-slate-900 antialiased">
      <Sidebar currentTab={currentTab} onSelectTab={navigate} />
      <div className="flex flex-1 flex-col overflow-x-hidden">
        <Header onNavigateTab={navigate} currentTab={currentTab} />
        <main className="mx-auto w-full max-w-7xl flex-1 p-4 sm:p-6 lg:p-8">
          {currentTab === 'dashboard' && <DashboardView onNavigateTab={navigate} />}
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
        </main>
      </div>
    </div>
  );
}

export default App;
