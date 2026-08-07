import React, { useState } from 'react';
import { Header } from './components/Header';
import { Sidebar, ViewTab } from './components/Sidebar';
import { SupabaseSetupModal } from './components/SupabaseSetupModal';

// Views
import { DashboardView } from './components/views/DashboardView';
import { MasterAdminView } from './components/views/MasterAdminView';
import { RecruitmentView } from './components/views/RecruitmentView';
import { HeadhunterView } from './components/views/HeadhunterView';
import { PublicPortalView } from './components/views/PublicPortalView';
import { AiScreeningView } from './components/views/AiScreeningView';
import { AgendaView } from './components/views/AgendaView';
import { DepartamentoPessoalView } from './components/views/DepartamentoPessoalView';
import { AuditLogsView } from './components/views/AuditLogsView';
import { CompanySettingsView } from './components/views/CompanySettingsView';
import { MasterBuilderView } from './components/views/MasterBuilderView';

export function App() {
  const [currentTab, setCurrentTab] = useState<ViewTab>('dashboard');
  const [isSupabaseModalOpen, setIsSupabaseModalOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-slate-50 font-sans text-slate-900 antialiased">
      {/* Sidebar Navigation */}
      <Sidebar currentTab={currentTab} onSelectTab={(tab) => setCurrentTab(tab)} />

      {/* Main Container */}
      <div className="flex flex-1 flex-col overflow-x-hidden">
        {/* Header Bar */}
        <Header
          onOpenSupabaseModal={() => setIsSupabaseModalOpen(true)}
          onNavigateTab={(tab) => setCurrentTab(tab)}
          currentTab={currentTab}
        />

        {/* View Body */}
        <main
          className={`flex-1 w-full mx-auto ${
            currentTab === 'portal_vagas' ? 'p-0 max-w-full' : 'p-4 sm:p-6 lg:p-8 max-w-7xl'
          }`}
        >
          {currentTab === 'dashboard' && (
            <DashboardView onNavigateTab={(tab) => setCurrentTab(tab)} />
          )}
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

      {/* Supabase & RLS Setup Modal */}
      <SupabaseSetupModal
        isOpen={isSupabaseModalOpen}
        onClose={() => setIsSupabaseModalOpen(false)}
      />
    </div>
  );
}

export default App;
