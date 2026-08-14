import React, { useState } from 'react';
import { AuthProvider, useAuth, LoginForm, ProfileSwitchSelector, ProtectedRoute } from './auth';
import { Navbar } from './components/Navbar';
import { Sidebar, MainTab } from './components/Sidebar';
import { DashboardView } from './components/DashboardView';
import { JobsView } from './components/JobsView';
import { TalentBankView } from './components/TalentBankView';
import { InterviewsView } from './components/InterviewsView';
import { ReportsView } from './components/ReportsView';
import { CompanyView } from './components/CompanyView';
import { SettingsView } from './components/SettingsView';
import { SupportHelpView } from './support/SupportHelpView';
import { PublicJobsView } from './public-jobs';
import { HeadhunterView } from './headhunter/HeadhunterView';
import { BenefitsLeavesView } from './benefits-leaves';
import { DocumentsSignatureView } from './documents-signature';
import { PayrollView } from './payroll';
import { PontoDigitalView } from './ponto-digital';
import { AuditLogsView } from './audit-logs';
import { SubscriptionsView } from './subscriptions';
import { MasterAdminView } from './master-admin';
import { MaisRhIaView } from './ai/components/MaisRhIaView';
import { DepartamentoPessoalView, DPSubTab } from './departamento-pessoal/DepartamentoPessoalView';
import { PortalColaboradorView } from './departamento-pessoal/components/PortalColaboradorView';
import { UnifiedPipelineView, UnifiedContratacoesView, UnifiedAgendaView } from './recruitment-core';
import { JobCandidatesManagementView } from './jobs/components/JobCandidatesManagementView';

import { NewJobModal } from './components/NewJobModal';
import { NewCandidateModal } from './components/NewCandidateModal';
import { ScheduleInterviewModal } from './components/ScheduleInterviewModal';
import { FloatingAiAssistant } from './components/FloatingAiAssistant';
import { ModuleErrorBoundary } from './components/ModuleErrorBoundary';

import { 
  INITIAL_DEPARTMENTS, 
  INITIAL_RECRUITERS, 
  fontStages 
} from './data/initialData';
import { getCompanyId, isMasterProfile, requireCompanyId } from './auth/profile';

import { Job, Candidate, Interview, InterviewScheduleInput, StageId } from './types/rh';
import { JobService } from './services/JobService';
import { CandidateService } from './services/CandidateService';
import { JobCandidateService } from './services/JobCandidateService';
import { InterviewService } from './services/InterviewService';
import { GoogleWorkspaceService } from './services/GoogleWorkspaceService';

function MainAppContent() {
  const { user, isAuthenticated, isModuleActive } = useAuth();
  const [showLoginScreen, setShowLoginScreen] = useState(false);
  const [activeTab, setActiveTab] = useState<MainTab>(() => {
    return isMasterProfile(user) ? 'acesso-master' : 'dashboard';
  });
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedAdmissionId, setSelectedAdmissionId] = useState<string | null>(() => {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      return urlParams.get('selectedAdmissionId') || localStorage.getItem('selectedAdmissionId') || null;
    } catch {
      return null;
    }
  });
  const [selectedFinancialId, setSelectedFinancialId] = useState<string | null>(() => {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      return urlParams.get('selectedFinancialId') || urlParams.get('selectedBillingId') || localStorage.getItem('selectedFinancialId') || localStorage.getItem('selectedBillingId') || null;
    } catch {
      return null;
    }
  });

  const handleNavigateTab = (tab: string, entityId?: string) => {
    if (entityId) {
      if (tab === 'admissoes' || tab === 'colaboradores' || tab === 'equipe-interna' || tab === 'departamento-pessoal') {
        setSelectedAdmissionId(entityId);
        localStorage.setItem('selectedAdmissionId', entityId);
      } else if (tab === 'headhunter-financeiro' || tab === 'financeiro' || tab.includes('financeiro')) {
        setSelectedFinancialId(entityId);
        localStorage.setItem('selectedFinancialId', entityId);
        localStorage.setItem('selectedBillingId', entityId);
      }
    }
    if (tab === 'admissoes' || tab === 'colaboradores' || tab === 'equipe-interna' || tab === 'departamento-pessoal') {
      setActiveTab('admissoes' as MainTab);
    } else {
      setActiveTab(tab as MainTab);
    }
  };

  // Auto-switch to Master Panel when Super Admin logs in or switches profile
  React.useEffect(() => {
    if (isMasterProfile(user) && activeTab !== 'acesso-master') {
      setActiveTab('acesso-master');
    }
  }, [user?.role]);

  // Main state
  const [jobs, setJobs] = useState<Job[]>([]);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [departments] = useState(INITIAL_DEPARTMENTS);
  const [recruiters] = useState(INITIAL_RECRUITERS);
  const [companyApplicationsCount, setCompanyApplicationsCount] = useState<number>(0);
  const canAccessTalentBank = isModuleActive('bancoTalentos');

  // Load company jobs, candidates and candidatures count from Firestore
  React.useEffect(() => {
    if (!isAuthenticated) return;

    const isMaster = isMasterProfile(user);
    const userCompanyId = isMaster ? undefined : getCompanyId(user) || undefined;
    if (!isMaster && !userCompanyId) {
      setJobs([]);
      setCandidates([]);
      setCompanyApplicationsCount(0);
      return;
    }

    JobService.list(userCompanyId)
      .then(loadedJobs => {
        if (loadedJobs && Array.isArray(loadedJobs)) {
          if (!isMaster && userCompanyId) {
            const filtered = loadedJobs.filter(j => {
              const cId = (j as any).companyId || (j as any).empresaId || (j as any).tenantId;
              return cId === userCompanyId;
            });
            setJobs(filtered);
          } else {
            setJobs(loadedJobs);
          }
        }
      })
      .catch(err => {
        console.warn('Erro ao carregar vagas do Firestore:', err);
      });

    if (canAccessTalentBank) {
      CandidateService.listTalentBank(userCompanyId)
        .then(loadedCands => {
          setCandidates(Array.isArray(loadedCands) ? loadedCands : []);
        })
        .catch(err => {
          console.error('Erro ao carregar Banco de Talentos do Firestore:', err);
          setCandidates([]);
        });
    } else {
      // Bloqueio anterior à consulta: trial e planos sem o módulo não leem talentos.
      setCandidates([]);
    }

    InterviewService.list(userCompanyId)
      .then(loadedInterviews => setInterviews(Array.isArray(loadedInterviews) ? loadedInterviews : []))
      .catch(err => {
        console.warn('Erro ao carregar entrevistas do Firestore:', err);
        setInterviews([]);
      });

    const unsubscribeApps = userCompanyId
      ? JobCandidateService.subscribeByCompany(userCompanyId, apps => setCompanyApplicationsCount(apps.length))
      : () => undefined;

    return () => {
      unsubscribeApps();
    };
  }, [isAuthenticated, user?.empresaId, user?.companyId, user?.tenantId, user?.role, user?.tipoUsuario, user?.isMaster, canAccessTalentBank]);

  // Modals state
  const [isJobModalOpen, setIsJobModalOpen] = useState(false);
  const [isCandidateModalOpen, setIsCandidateModalOpen] = useState(false);
  const [isInterviewModalOpen, setIsInterviewModalOpen] = useState(false);
  const [editingInterview, setEditingInterview] = useState<Interview | null>(null);
  const [interviewNotice, setInterviewNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Handlers
  const handleAddJob = async (newJobData: Omit<Job, 'id' | 'applicantsCount' | 'createdAt'>) => {
    const empresaId = requireCompanyId(user, 'criar a vaga');
    const nomeEmpresa = user?.companyName || user?.tenantName || '';
    const parts = (newJobData.location || '').split('-');
    const cidade = parts[0]?.trim() || '';
    const estado = parts[1]?.trim() || '';
    const nowIsoDate = new Date().toISOString().split('T')[0];

    const newJob: Job = {
      ...newJobData,
      id: `vaga-${Date.now()}`,
      companyId: empresaId,
      empresaId,
      nomeEmpresa,
      titulo: newJobData.title,
      title: newJobData.title,
      descricao: newJobData.description,
      description: newJobData.description,
      requisitos: newJobData.requirements || [],
      requirements: newJobData.requirements || [],
      cidade,
      estado,
      location: newJobData.location || `${cidade} - ${estado}`,
      salario: newJobData.salaryRange || 'A combinar',
      salaryRange: newJobData.salaryRange || 'A combinar',
      tipoContrato: newJobData.type || 'CLT',
      type: newJobData.type || 'CLT',
      beneficios: newJobData.benefits || [],
      benefits: newJobData.benefits || [],
      quantidadeVagas: newJobData.openings || 1,
      openings: newJobData.openings || 1,
      dataCriacao: nowIsoDate,
      createdAt: nowIsoDate,
      status: 'Aberta',
      publicada: true,
      applicantsCount: 0,
    };

    try {
      const savedJob = await JobService.create(newJob);
      setJobs(prev => [savedJob, ...prev.filter(job => job.id !== savedJob.id)]);
    } catch (err) {
      console.error('Erro ao salvar nova vaga no Firestore:', err);
      window.alert(err instanceof Error ? err.message : 'Não foi possível salvar a vaga.');
    }
  };

  const handleAddCandidate = async (newCandData: Omit<Candidate, 'id' | 'appliedDate'>) => {
    const userCompanyId = requireCompanyId(user, 'cadastrar o candidato');
    const nowIsoDate = new Date().toISOString().split('T')[0];

    let savedCand: Candidate;
    try {
      savedCand = await CandidateService.create({
        ...newCandData,
        companyId: userCompanyId,
        appliedDate: nowIsoDate
      });
    } catch (err) {
      console.error('Erro ao salvar candidato no Firestore:', err);
      window.alert(err instanceof Error ? err.message : 'Não foi possível salvar o candidato.');
      return;
    }

    const candidateId = savedCand.id;

    // If candidate assigned to a job, create application document too
    if (newCandData.currentJobId) {
      try {
        await JobCandidateService.create({
          jobId: newCandData.currentJobId,
          companyId: userCompanyId,
          candidateId: candidateId,
          name: newCandData.name,
          email: newCandData.email,
          phone: newCandData.phone,
          role: newCandData.role || 'Candidato',
          city: newCandData.location?.split('-')[0]?.trim() || '',
          state: newCandData.location?.split('-')[1]?.trim() || '',
          status: 'Novos',
          resumeUrl: newCandData.resumeUrl || '',
          experienceYears: newCandData.experienceYears || 1,
          salaryExpectation: newCandData.salaryExpectation || 'A combinar',
          notes: newCandData.notes ? [newCandData.notes] : []
        });
      } catch (err) {
        console.error('Erro ao criar candidatura no Firestore:', err);
        await CandidateService.delete(candidateId).catch(() => undefined);
        window.alert(err instanceof Error ? err.message : 'Não foi possível vincular o candidato à vaga.');
        return;
      }

      setJobs(prev => prev.map(j => {
        if (j.id === newCandData.currentJobId) {
          return { ...j, applicantsCount: (j.applicantsCount || 0) + 1 };
        }
        return j;
      }));
    }

    setCandidates(prev => [savedCand, ...prev.filter(candidate => candidate.id !== savedCand.id)]);
  };

  // If user is not logged in, show Public Job Site as initial page, or LoginForm when requested
  if (!isAuthenticated) {
    if (showLoginScreen) {
      return <LoginForm onBackToJobs={() => setShowLoginScreen(false)} />;
    }
    return (
      <PublicJobsView
        jobs={jobs}
        onGoToLogin={() => setShowLoginScreen(true)}
      />
    );
  }

  const handleScheduleInterview = async (newInterviewData: InterviewScheduleInput) => {
    const companyId = requireCompanyId(user, 'agendar a entrevista');
    let savedInterview: Interview;
    let warnings: string[] = [];
    if (newInterviewData.modality === 'Google Meet' && !newInterviewData.forceWithoutGoogle) {
      const result = newInterviewData.id
        ? await GoogleWorkspaceService.updateInterview(companyId, newInterviewData)
        : await GoogleWorkspaceService.createInterview(companyId, newInterviewData);
      savedInterview = result.interview;
      warnings = (result as any).warnings || savedInterview.integrationWarnings || [];
    } else if (newInterviewData.id) {
      savedInterview = await InterviewService.updateSchedule(companyId, newInterviewData);
    } else {
      const { forceWithoutGoogle: _forceWithoutGoogle, ...localInput } = newInterviewData;
      savedInterview = await InterviewService.create(companyId, localInput as Omit<Interview, 'id' | 'status'>);
    }
    setInterviews(prev => [savedInterview, ...prev.filter(item => item.id !== savedInterview.id)]);
    setEditingInterview(null);
    setInterviewNotice({
      type: 'success',
      message: `${newInterviewData.id ? 'Entrevista atualizada com sucesso.' : 'Entrevista agendada com sucesso.'}${savedInterview.googleMeetUrl ? ` Google Meet: ${savedInterview.googleMeetUrl}` : ''}${warnings.length ? ` ${warnings.join(' ')}` : ''}`,
    });
  };

  const handleEditInterview = (interview: Interview) => {
    setEditingInterview(interview);
    setIsInterviewModalOpen(true);
  };

  const handleCancelInterview = async (interview: Interview) => {
    const companyId = requireCompanyId(user, 'cancelar a entrevista');
    try {
      if (interview.googleCalendarEventId) {
        await GoogleWorkspaceService.cancelInterview(companyId, interview.id);
      } else {
        await InterviewService.cancel(companyId, interview.id);
      }
      setInterviews(prev => prev.map(item => item.id === interview.id ? { ...item, status: 'Cancelada' } : item));
      setInterviewNotice({ type: 'success', message: 'Entrevista cancelada com sucesso.' });
    } catch (error: any) {
      setInterviewNotice({ type: 'error', message: error?.message || 'Não foi possível cancelar a entrevista.' });
      throw error;
    }
  };

  const handleMoveCandidateStage = (candidateId: string, newStageId: StageId) => {
    setCandidates(prev => prev.map(c => {
      if (c.id === candidateId) {
        return {
          ...c,
          currentStageId: newStageId,
          status: newStageId === 'contratado' ? 'Contratado' : 'Em Processo'
        };
      }
      return c;
    }));
  };

  const handleAssignCandidateToJob = (candidateId: string, jobId: string) => {
    setCandidates(prev => prev.map(c => {
      if (c.id === candidateId) {
        return {
          ...c,
          currentJobId: jobId,
          currentStageId: 'triagem',
          status: 'Em Processo'
        };
      }
      return c;
    }));

    setJobs(prev => prev.map(j => {
      if (j.id === jobId) {
        return { ...j, applicantsCount: j.applicantsCount + 1 };
      }
      return j;
    }));
  };

  const handleUpdateInterviewFeedback = async (interviewId: string, feedback: Interview['feedback']) => {
    if (!feedback) return;
    try {
      await InterviewService.updateFeedback(interviewId, feedback);
    } catch (error) {
      console.error('Erro ao persistir feedback da entrevista:', error);
      window.alert(error instanceof Error ? error.message : 'Não foi possível salvar o feedback.');
      return;
    }
    setInterviews(prev => prev.map(i => {
      if (i.id === interviewId) {
        return {
          ...i,
          status: 'Concluída',
          feedback,
        };
      }
      return i;
    }));
  };

  const departmentNames = departments.map(d => d.name);

  const isColaborador = user?.role === 'Colaborador' || user?.tipoUsuario === 'COLABORADOR';

  if (isColaborador) {
    return (
      <div className="min-h-screen bg-[#F7F9FC] text-[#0F172A] flex flex-col font-sans">
        <ProfileSwitchSelector />
        <PortalColaboradorView />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F7F9FC] text-[#0F172A] flex flex-col font-sans antialiased">
      {/* Top Profile Switch Bar */}
      <ProfileSwitchSelector />

      {/* Navbar Header */}
      <Navbar
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        openNewCandidateModal={canAccessTalentBank ? () => setIsCandidateModalOpen(true) : undefined}
        openScheduleInterviewModal={() => setIsInterviewModalOpen(true)}
        openNewJobModal={() => setIsJobModalOpen(true)}
        onOpenMasterPanel={() => setActiveTab('acesso-master')}
        onToggleMobileMenu={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
      />

      {/* Main Layout Container */}
      <div className="flex flex-1 overflow-hidden">
        {/* Operational Sidebar (hidden when in Master Admin mode) */}
        {activeTab !== 'acesso-master' && (
          <Sidebar
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            openNewJobModal={() => setIsJobModalOpen(true)}
            openNewCandidateModal={() => setIsCandidateModalOpen(true)}
            openScheduleInterviewModal={() => setIsInterviewModalOpen(true)}
            jobsCount={jobs.length}
            candidatesCount={companyApplicationsCount || candidates.length}
            interviewsCount={interviews.length}
            isOpenMobile={isMobileMenuOpen}
            onCloseMobile={() => setIsMobileMenuOpen(false)}
          />
        )}

        {/* View Router Protected by Role */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 bg-[#F7F9FC]">

          <ModuleErrorBoundary key={activeTab} moduleKey={activeTab} onGoHome={() => setActiveTab('dashboard')}>
          <ProtectedRoute screenKey={activeTab as any}>
            {activeTab === 'dashboard' && (
              <DashboardView
                jobs={jobs}
                candidates={candidates}
                interviews={interviews}
                stages={fontStages}
                onNavigateToJobs={() => setActiveTab('vagas')}
                onNavigateToCandidates={() => setActiveTab('candidatos')}
                onNavigateToInterviews={() => setActiveTab('entrevistas')}
                openNewJobModal={() => setIsJobModalOpen(true)}
                openNewCandidateModal={() => setIsCandidateModalOpen(true)}
              />
            )}

            {activeTab === 'mais-rh-ia' && <MaisRhIaView />}

            {activeTab === 'vagas' && (
              <JobsView
                key={activeTab}
                jobs={jobs}
                candidates={candidates}
                stages={fontStages}
                openNewJobModal={() => setIsJobModalOpen(true)}
                onMoveCandidateStage={handleMoveCandidateStage}
                searchTerm={searchTerm}
                onUpdateJobs={setJobs}
              />
            )}

            {activeTab === 'banco-talentos' && (
              <TalentBankView
                candidates={candidates}
                jobs={jobs}
                openNewCandidateModal={() => setIsCandidateModalOpen(true)}
                onAssignCandidateToJob={handleAssignCandidateToJob}
                searchTerm={searchTerm}
              />
            )}

            {activeTab === 'candidatos' && (
              <JobCandidatesManagementView openNewJobModal={() => setIsJobModalOpen(true)} />
            )}

            {activeTab === 'entrevistas' && (
              <InterviewsView
                interviews={interviews}
                openScheduleInterviewModal={() => { setEditingInterview(null); setIsInterviewModalOpen(true); }}
                onEditInterview={handleEditInterview}
                onCancelInterview={handleCancelInterview}
                onUpdateInterviewFeedback={handleUpdateInterviewFeedback}
              />
            )}

            {activeTab === 'contratacoes' && (
              <UnifiedContratacoesView
                origemProcesso="recrutamento_interno"
                companyId={getCompanyId(user) || ''}
                onNavigateToTab={handleNavigateTab}
              />
            )}

            {activeTab === 'agenda' && (
              <UnifiedAgendaView
                origemProcesso="interno"
                events={[]}
              />
            )}

            {activeTab === 'relatorios' && <ReportsView />}

            {activeTab === 'empresa' && (
              <CompanyView departments={departments} recruiters={recruiters} />
            )}

            {activeTab === 'equipe-interna' && (
              <DepartamentoPessoalView initialSubTab="colaboradores" selectedAdmissionId={selectedAdmissionId} />
            )}

            {activeTab === 'site-vagas' && (
              <PublicJobsView
                jobs={jobs}
                onApplyCandidate={handleAddCandidate}
                isInternalView={true}
              />
            )}

            {(activeTab === 'headhunter' || activeTab === 'consultor-rh' || activeTab.startsWith('headhunter-')) && (
              <HeadhunterView 
                initialSubTab={
                  activeTab === 'headhunter' || activeTab === 'consultor-rh' 
                    ? 'dashboard' 
                    : (activeTab.replace('headhunter-', '') as any)
                } 
                selectedFinancialId={selectedFinancialId}
              />
            )}

            {/* Departamento Pessoal Master Submenu Routing */}
            {['departamento-pessoal', 'colaboradores', 'admissoes', 'organograma', 'ponto-digital', 'jornada', 'beneficios', 'ferias', 'rescisao', 'documentos', 'afastamentos', 'sst', 'acessos-portal', 'relatorios-dp', 'configuracoes-trabalhistas'].includes(activeTab) && (
              <DepartamentoPessoalView 
                initialSubTab={
                  activeTab === 'departamento-pessoal' ? 'visao-geral'
                    : activeTab === 'jornada' ? 'ponto-digital'
                    : activeTab === 'ferias' || activeTab === 'afastamentos' ? 'ferias-afastamentos'
                    : (activeTab as DPSubTab)
                }
                selectedAdmissionId={selectedAdmissionId}
              />
            )}

            {activeTab === 'folha-pagamento' && (
              <DepartamentoPessoalView initialSubTab="folha-pagamento" />
            )}

            {activeTab === 'ferias-beneficios' && (
              <DepartamentoPessoalView initialSubTab="beneficios" />
            )}

            {activeTab === 'auditoria' && <AuditLogsView />}

            {activeTab === 'planos-saas' && <SubscriptionsView />}

            {(activeTab === 'acesso-master' || activeTab.startsWith('master-')) && (
              <MasterAdminView
                key={activeTab}
                initialSection={
                  activeTab === 'master-empresas' ? 'empresas'
                    : activeTab === 'master-planos' ? 'planos-modulos'
                    : activeTab === 'master-modulos' ? 'planos-modulos'
                    : activeTab === 'master-usuarios' ? 'usuarios'
                    : activeTab === 'master-personalizacao' ? 'configuracoes'
                    : 'dashboard'
                }
              />
            )}

            {activeTab === 'configuracoes' && <SettingsView stages={fontStages} />}

            {activeTab === 'suporte-ajuda' && <SupportHelpView />}
          </ProtectedRoute>
          </ModuleErrorBoundary>
        </main>
      </div>

      {/* Creation & Action Modals */}
      <NewJobModal
        isOpen={isJobModalOpen}
        onClose={() => setIsJobModalOpen(false)}
        onSubmit={handleAddJob}
        departments={departmentNames}
      />

      {canAccessTalentBank && <NewCandidateModal
        isOpen={isCandidateModalOpen}
        onClose={() => setIsCandidateModalOpen(false)}
        onSubmit={handleAddCandidate}
        jobs={jobs}
      />}

      <ScheduleInterviewModal
        isOpen={isInterviewModalOpen}
        onClose={() => { setIsInterviewModalOpen(false); setEditingInterview(null); }}
        onSubmit={handleScheduleInterview}
        candidates={candidates}
        jobs={jobs}
        initialInterview={editingInterview}
      />

      {interviewNotice && (
        <div role="status" className={`fixed top-5 right-5 z-[80] max-w-lg rounded-2xl border px-4 py-3 shadow-xl text-xs font-bold ${interviewNotice.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-rose-50 border-rose-200 text-rose-900'}`}>
          <div className="flex items-start gap-3"><span>{interviewNotice.message}</span><button type="button" onClick={() => setInterviewNotice(null)} aria-label="Fechar mensagem">×</button></div>
        </div>
      )}

      {/* Assistente IA Flutuante Global */}
      <FloatingAiAssistant
        activeTab={activeTab}
        onNavigateToTab={(tab) => setActiveTab(tab as MainTab)}
      />
    </div>
  );
}

import { 
  CompanyProvider, 
  PermissionProvider, 
  ModuleProvider, 
  SubscriptionProvider, 
  NotificationProvider, 
  SettingsProvider 
} from './contexts';
import { VisualBuilderProvider } from './visual-builder/context/VisualBuilderRuntimeContext';

export default function App() {
  return (
    <AuthProvider>
      <CompanyProvider>
        <PermissionProvider>
          <ModuleProvider>
            <SubscriptionProvider>
              <NotificationProvider>
                <SettingsProvider>
                  <VisualBuilderProvider>
                    <MainAppContent />
                  </VisualBuilderProvider>
                </SettingsProvider>
              </NotificationProvider>
            </SubscriptionProvider>
          </ModuleProvider>
        </PermissionProvider>
      </CompanyProvider>
    </AuthProvider>
  );
}
