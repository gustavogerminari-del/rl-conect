import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import {
  Activity,
  AlertTriangle,
  Building2,
  CheckCircle2,
  CircleDollarSign,
  CloudCog,
  CreditCard,
  Crown,
  Database,
  FileCheck2,
  FileText,
  Headphones,
  KeyRound,
  Layers3,
  Loader2,
  PlusCircle,
  RefreshCw,
  Save,
  Search,
  Settings,
  ShieldCheck,
  Users,
  X,
} from 'lucide-react';
import { auth } from '../../lib/firebase';
import { useAuth } from '../../auth';
import { validarAcessoMaster, type MasterValidationResult } from '../../auth/masterValidation';
import { AuditService } from '../../services/AuditService';
import { UserService, type UserProfile } from '../../services/UserService';
import {
  fetchModulosFirestore,
  fetchPlansFirestore,
  savePlanFirestore,
  type PlanConfig,
} from '../../services/ModuleCatalogService';
import { MasterSectionErrorBoundary } from './MasterSectionErrorBoundary';
import { MasterTenantModal } from './MasterTenantModal';
import { MasterEditPlanModal } from './MasterEditPlanModal';
import { MasterCreateModuleModal } from './MasterCreateModuleModal';
import {
  deleteTenant,
  saveTenantAsync,
  syncTenantsFromFirestore,
  toggleTenantStatus,
} from '../masterTenantsStore';
import { savePlatformModule } from '../masterModulesStore';
import { MasterOperationalService } from '../services/masterOperationalService';
import type {
  ClientTenant,
  MasterBackupRecord,
  MasterFinancialEntry,
  MasterGlobalSettings,
  MasterIntegrationStatus,
  MasterInvoiceRecord,
  MasterLead,
  MasterLeadStatus,
  MasterSupportTicket,
  PlatformModule,
  SaaSPlan,
} from '../types/master';

export type MasterNavigationSection =
  | 'dashboard'
  | 'leads'
  | 'empresas'
  | 'usuarios'
  | 'planos-modulos'
  | 'financeiro'
  | 'faturamento'
  | 'suporte'
  | 'integracoes'
  | 'backup'
  | 'auditoria'
  | 'configuracoes';

interface MasterAdminViewProps {
  initialSection?: MasterNavigationSection;
}

const LEAD_STATUSES: MasterLeadStatus[] = ['NOVO', 'EM_ATENDIMENTO', 'QUALIFICADO', 'PROPOSTA', 'NEGOCIACAO', 'GANHO', 'PERDIDO'];
const INTEGRATION_CATALOG = ['Google Calendar', 'Google Meet', 'n8n', 'OpenAI / IA', 'E-mail', 'Pagamentos', 'NFS-e', 'APIs externas'];

const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const safeDate = (value?: string) => value ? new Date(value).toLocaleDateString('pt-BR') : '—';
const text = (value: unknown) => String(value || '').trim();

function tenantDisplayStatus(tenant: ClientTenant): string {
  const explicit = text(tenant.status);
  if (['Bloqueado por Inadimplência', 'Vencido / Tolerância'].includes(explicit)) return explicit;
  const expiration = text(tenant.contract?.expirationDate);
  if (!expiration) return explicit || 'Sem dados disponíveis';
  const due = new Date(`${expiration}T23:59:59`);
  if (Number.isNaN(due.getTime())) return explicit || 'Sem dados disponíveis';
  const diffDays = Math.floor((Date.now() - due.getTime()) / 86_400_000);
  if (diffDays <= 0) return 'Ativo';
  if (diffDays <= 10) return 'Vencido / Tolerância';
  return 'Bloqueado por Inadimplência';
}

function statusClass(status: string) {
  const normalized = status.toUpperCase();
  if (normalized.includes('ATIVO') || normalized.includes('PAGO') || normalized.includes('CONECTADO') || normalized.includes('CONCLU')) return 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30';
  if (normalized.includes('ERRO') || normalized.includes('FALHA') || normalized.includes('VENCIDO') || normalized.includes('BLOQUEADO') || normalized.includes('CRITICA')) return 'bg-rose-500/10 text-rose-300 border-rose-500/30';
  if (normalized.includes('PENDENTE') || normalized.includes('TOLER') || normalized.includes('ATENDIMENTO')) return 'bg-amber-500/10 text-amber-300 border-amber-500/30';
  return 'bg-slate-700/50 text-slate-300 border-slate-600';
}

function Badge({ value }: { value: string }) {
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-black ${statusClass(value)}`}>{value.replaceAll('_', ' ')}</span>;
}

function EmptyState({ label = 'Sem dados disponíveis' }: { label?: string }) {
  return <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-900/40 p-8 text-center text-sm text-slate-400">{label}</div>;
}

function SectionHeader({ title, description, action }: { title: string; description: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div><h2 className="text-xl font-black text-white">{title}</h2><p className="mt-1 text-xs text-slate-400">{description}</p></div>
      {action}
    </div>
  );
}

function Dialog({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
      <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl">
        <div className="sticky top-0 flex items-center justify-between border-b border-slate-800 bg-slate-900 px-5 py-4">
          <h3 className="font-black text-white">{title}</h3><button onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-800"><X className="h-4 w-4" /></button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

const inputClass = 'w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white outline-none focus:border-amber-400';
const primaryButton = 'inline-flex items-center justify-center gap-2 rounded-xl bg-amber-500 px-4 py-2.5 text-xs font-black text-slate-950 hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-50';
const secondaryButton = 'inline-flex items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-bold text-slate-200 hover:bg-slate-700';

export const MasterAdminView: React.FC<MasterAdminViewProps> = ({ initialSection = 'dashboard' }) => {
  const { logout } = useAuth();
  const [activeSection, setActiveSection] = useState<MasterNavigationSection>(initialSection);
  const [validation, setValidation] = useState<MasterValidationResult | null>(null);
  const [validating, setValidating] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [search, setSearch] = useState('');

  const [tenants, setTenants] = useState<ClientTenant[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [plans, setPlans] = useState<SaaSPlan[]>([]);
  const [modules, setModules] = useState<PlatformModule[]>([]);
  const [leads, setLeads] = useState<MasterLead[]>([]);
  const [receivables, setReceivables] = useState<MasterFinancialEntry[]>([]);
  const [payables, setPayables] = useState<MasterFinancialEntry[]>([]);
  const [invoices, setInvoices] = useState<MasterInvoiceRecord[]>([]);
  const [tickets, setTickets] = useState<MasterSupportTicket[]>([]);
  const [integrations, setIntegrations] = useState<MasterIntegrationStatus[]>([]);
  const [backups, setBackups] = useState<MasterBackupRecord[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [settings, setSettings] = useState<MasterGlobalSettings>({ id: 'global', platformName: 'RL Connect', billingPeriodDays: 30, gracePeriodDays: 10 });

  const [tenantModal, setTenantModal] = useState<ClientTenant | 'new' | null>(null);
  const [planModal, setPlanModal] = useState<SaaSPlan | null>(null);
  const [moduleModal, setModuleModal] = useState<PlatformModule | null>(null);
  const [formModal, setFormModal] = useState<'lead' | 'finance' | 'support' | 'user' | null>(null);
  const [saving, setSaving] = useState(false);

  const validate = useCallback(async () => {
    setValidating(true);
    try { setValidation(await validarAcessoMaster()); }
    catch (error) { setValidation({ autorizado: false, motivo: error instanceof Error ? error.message : 'Falha de validação.' }); }
    finally { setValidating(false); }
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    const results = await Promise.allSettled([
      syncTenantsFromFirestore(),
      UserService.list(),
      fetchPlansFirestore(),
      fetchModulosFirestore(),
      MasterOperationalService.listLeads(),
      MasterOperationalService.listFinancialEntries('RECEBER'),
      MasterOperationalService.listFinancialEntries('PAGAR'),
      MasterOperationalService.listInvoices(),
      MasterOperationalService.listSupportTickets(),
      MasterOperationalService.listIntegrations(),
      MasterOperationalService.listBackups(),
      AuditService.list(),
      MasterOperationalService.getSettings(),
    ]);
    const value = <T,>(index: number, fallback: T): T => results[index].status === 'fulfilled' ? results[index].value as T : fallback;
    setTenants(value(0, []));
    setUsers(value(1, []));
    const rawPlans = value<PlanConfig[]>(2, []);
    setPlans(rawPlans.map((plan) => ({
      id: plan.id,
      name: plan.nome as SaaSPlan['name'],
      description: plan.descricao || '',
      monthlyPrice: Number(plan.preco || 0),
      annualDiscountPercent: 0,
      maxUsers: Number(plan.limites?.usuarios || 0),
      maxActiveJobs: Number(plan.limites?.vagas || 0),
      maxEmployees: Number(plan.limites?.colaboradores || 0),
      includedModules: (plan.modulos || []) as SaaSPlan['includedModules'],
      status: 'Ativo',
      subscribersCount: 0,
    })));
    const rawModules = value<any[]>(3, []);
    setModules(rawModules.map((module) => ({
      id: module.id,
      key: module.key,
      slug: module.key,
      name: module.nome,
      description: module.descricao,
      category: module.categoria || 'Ferramentas',
      status: module.ativo ? 'Ativo' : 'Inativo',
      isCore: false,
      activeTenantsCount: 0,
      iconName: module.icone || 'Layers',
      route: module.rota || '',
      displayOrder: module.ordem || 99,
    })));
    setLeads(value(4, [])); setReceivables(value(5, [])); setPayables(value(6, [])); setInvoices(value(7, []));
    setTickets(value(8, [])); setIntegrations(value(9, [])); setBackups(value(10, [])); setAuditLogs(value(11, [])); setSettings(value(12, settings));
    const rejected = results.filter((item) => item.status === 'rejected').length;
    if (rejected) setLoadError(`${rejected} fonte(s) do Firebase não puderam ser carregadas. As demais áreas continuam disponíveis.`);
    setLoading(false);
  }, []);

  useEffect(() => {
    validate();
    const unsubscribe = onAuthStateChanged(auth, validate);
    return unsubscribe;
  }, [validate]);
  useEffect(() => { if (validation?.autorizado) loadData(); }, [validation?.autorizado, loadData]);

  const menuItems = [
    ['dashboard', 'Visão Geral', Activity], ['leads', 'Leads', UserPlusIcon], ['empresas', 'Empresas', Building2],
    ['usuarios', 'Usuários e Permissões', Users], ['planos-modulos', 'Planos e Módulos', Layers3], ['financeiro', 'Financeiro', CircleDollarSign],
    ['faturamento', 'Faturamento / NFS-e', FileCheck2], ['suporte', 'Suporte Técnico', Headphones], ['integracoes', 'Integrações / API', CloudCog],
    ['backup', 'Backup', Database], ['auditoria', 'Auditoria e Logs', ShieldCheck], ['configuracoes', 'Configurações', Settings],
  ] as const;

  const metrics = useMemo(() => {
    const statuses = tenants.map(tenantDisplayStatus);
    return {
      companies: tenants.length,
      active: statuses.filter((status) => status === 'Ativo').length,
      grace: statuses.filter((status) => status === 'Vencido / Tolerância').length,
      blocked: statuses.filter((status) => status === 'Bloqueado por Inadimplência').length,
      newLeads: leads.filter((lead) => lead.status === 'NOVO').length,
      activeUsers: users.filter((user) => !['Inativo', 'Bloqueado'].includes(user.status)).length,
      due: receivables.filter((entry) => entry.status === 'PENDENTE').reduce((sum, entry) => sum + Number(entry.amount || 0), 0),
      overdue: receivables.filter((entry) => entry.status === 'VENCIDO').reduce((sum, entry) => sum + Number(entry.amount || 0), 0),
      received: receivables.filter((entry) => entry.status === 'PAGO').reduce((sum, entry) => sum + Number(entry.amount || 0), 0),
    };
  }, [tenants, users, leads, receivables]);

  if (validating) return <LoadingState label="Validando sessão Firebase e permissão Master..." />;
  if (!validation?.autorizado) return (
    <div className="-m-4 flex min-h-screen items-center justify-center bg-slate-950 p-6 text-white sm:-m-6 lg:-m-8">
      <div className="w-full max-w-md rounded-2xl border border-rose-500/30 bg-slate-900 p-6 text-center"><ShieldCheck className="mx-auto h-10 w-10 text-rose-400" /><h2 className="mt-3 font-black">ACESSO MASTER RESTRITO</h2><p className="mt-2 text-sm text-slate-400">{validation?.motivo || 'Sessão Firebase sem role master_admin ativa.'}</p><button onClick={logout} className={`${primaryButton} mt-5 w-full`}>Entrar novamente</button></div>
    </div>
  );

  return (
    <div className="-m-4 flex min-h-screen flex-col bg-slate-950 text-slate-100 sm:-m-6 lg:-m-8">
      <header className="sticky top-0 z-30 flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 bg-slate-900 px-5 py-4 shadow-lg">
        <div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500 text-slate-950"><Crown className="h-6 w-6" /></div><div><h1 className="font-black text-white">PAINEL MASTER RL CONNECT</h1><p className="text-xs text-slate-400">Firebase-only • controle administrativo central</p></div></div>
        <button onClick={loadData} disabled={loading} className={secondaryButton}><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Atualizar dados</button>
      </header>
      <div className="flex flex-1 flex-col md:flex-row">
        <aside className="w-full shrink-0 border-b border-slate-800 bg-slate-900/90 p-3 md:w-72 md:border-b-0 md:border-r">
          <div className="grid grid-cols-2 gap-1 md:grid-cols-1">
            {menuItems.map(([id, label, Icon]) => <button key={id} onClick={() => setActiveSection(id)} className={`flex items-center gap-2 rounded-xl px-3 py-2.5 text-left text-xs font-bold ${activeSection === id ? 'bg-amber-500 text-slate-950' : 'text-slate-300 hover:bg-slate-800'}`}><Icon className="h-4 w-4 shrink-0" /><span>{label}</span></button>)}
          </div>
        </aside>
        <main className="min-w-0 flex-1 space-y-5 overflow-y-auto p-4 sm:p-6">
          {loadError && <div className="flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200"><AlertTriangle className="h-4 w-4" />{loadError}</div>}
          {loading ? <LoadingState label="Carregando dados reais do Firebase..." compact /> : (
            <MasterSectionErrorBoundary section={activeSection} onGoHome={() => setActiveSection('dashboard')}>
              {activeSection === 'dashboard' && <DashboardSection metrics={metrics} integrations={integrations} backups={backups} />}
              {activeSection === 'leads' && <LeadsSection leads={leads} tenants={tenants} search={search} setSearch={setSearch} onNew={() => setFormModal('lead')} onStatus={async (lead: MasterLead, status: MasterLeadStatus) => { const match = status === 'GANHO' ? tenants.find((tenant: ClientTenant) => (lead.cnpj && tenant.cnpj === lead.cnpj) || tenant.ownerEmail?.toLowerCase() === lead.email.toLowerCase()) : undefined; const saved = await MasterOperationalService.updateLeadStatus(lead, status, match?.id); setLeads((all) => all.map((item) => item.id === saved.id ? saved : item)); }} />}
              {activeSection === 'empresas' && <CompaniesSection tenants={tenants} search={search} setSearch={setSearch} onNew={() => setTenantModal('new')} onEdit={setTenantModal} onToggle={async (tenant: ClientTenant) => { setTenants(await toggleTenantStatus(tenant.id, tenant.status)); }} onDelete={async (tenant: ClientTenant) => { if (window.confirm(`Excluir a empresa ${tenant.companyName}?`)) setTenants(await deleteTenant(tenant.id)); }} />}
              {activeSection === 'usuarios' && <UsersSection users={users} tenants={tenants} onNew={() => setFormModal('user')} onToggle={async (user: UserProfile) => { const role = String(user.role || '').toUpperCase().replace(/[\s-]+/g, '_'); if (role === 'MASTER' || role === 'MASTER_ADMIN' || user.tipoUsuario === 'MASTER') return; await UserService.update(user.uid, { status: user.status === 'Ativo' ? 'Bloqueado' : 'Ativo' }); await loadData(); }} />}
              {activeSection === 'planos-modulos' && <PlansModulesSection plans={plans} modules={modules} onEditPlan={setPlanModal} onEditModule={setModuleModal} onNewModule={() => setModuleModal({} as PlatformModule)} />}
              {activeSection === 'financeiro' && <FinanceSection receivables={receivables} payables={payables} onNew={() => setFormModal('finance')} />}
              {activeSection === 'faturamento' && <InvoiceSection invoices={invoices} />}
              {activeSection === 'suporte' && <SupportSection tickets={tickets} onNew={() => setFormModal('support')} />}
              {activeSection === 'integracoes' && <IntegrationsSection integrations={integrations} />}
              {activeSection === 'backup' && <BackupSection backups={backups} />}
              {activeSection === 'auditoria' && <AuditSection logs={auditLogs} />}
              {activeSection === 'configuracoes' && <SettingsSection settings={settings} onSave={async (next) => setSettings(await MasterOperationalService.saveSettings(next))} />}
            </MasterSectionErrorBoundary>
          )}
        </main>
      </div>

      {tenantModal && <MasterTenantModal tenant={tenantModal === 'new' ? null : tenantModal} onClose={() => setTenantModal(null)} onSave={async (data) => { setTenants(await saveTenantAsync(data)); setTenantModal(null); }} />}
      {planModal && <MasterEditPlanModal plan={planModal} onClose={() => setPlanModal(null)} onSave={async (plan) => { await savePlanFirestore({ id: plan.id, nome: plan.name, descricao: plan.description, preco: plan.monthlyPrice, modulos: plan.includedModules as string[], limites: { usuarios: plan.maxUsers, vagas: plan.maxActiveJobs, colaboradores: plan.maxEmployees } }); setPlanModal(null); await loadData(); }} />}
      {moduleModal && <MasterCreateModuleModal isOpen onClose={() => setModuleModal(null)} initialModule={moduleModal.id ? moduleModal : undefined} onSave={async (module) => { await savePlatformModule(module); setModuleModal(null); await loadData(); }} />}
      {formModal && <OperationalFormModal kind={formModal} tenants={tenants} modules={modules} saving={saving} onClose={() => setFormModal(null)} onSave={async (payload: any) => { setSaving(true); try { if (formModal === 'lead') await MasterOperationalService.saveLead(payload); if (formModal === 'finance') await MasterOperationalService.saveFinancialEntry(payload); if (formModal === 'support') await MasterOperationalService.saveSupportTicket(payload); if (formModal === 'user') await UserService.create(payload); setFormModal(null); await loadData(); } finally { setSaving(false); } }} />}
    </div>
  );
};

function UserPlusIcon(props: React.ComponentProps<typeof Users>) { return <PlusCircle {...props} />; }
function LoadingState({ label, compact = false }: { label: string; compact?: boolean }) { return <div className={`flex items-center justify-center gap-3 bg-slate-950 text-slate-300 ${compact ? 'min-h-[45vh]' : '-m-4 min-h-screen sm:-m-6 lg:-m-8'}`}><Loader2 className="h-6 w-6 animate-spin text-amber-400" /><span className="text-sm font-bold">{label}</span></div>; }

function DashboardSection({ metrics, integrations, backups }: { metrics: Record<string, number>; integrations: MasterIntegrationStatus[]; backups: MasterBackupRecord[] }) {
  const cards = [['Empresas cadastradas', metrics.companies], ['Empresas ativas', metrics.active], ['Em tolerância', metrics.grace], ['Bloqueadas', metrics.blocked], ['Leads novos', metrics.newLeads], ['Usuários ativos', metrics.activeUsers], ['Contas a receber', currency.format(metrics.due)], ['Contas vencidas', currency.format(metrics.overdue)], ['Recebimentos', currency.format(metrics.received)]];
  const latestBackup = [...backups].sort((a, b) => text(b.finishedAt || b.createdAt).localeCompare(text(a.finishedAt || a.createdAt)))[0];
  return <><SectionHeader title="Visão Geral" description="Indicadores calculados somente a partir dos registros atuais do Firebase." /><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{cards.map(([label, value]) => <div key={String(label)} className="rounded-2xl border border-slate-800 bg-slate-900 p-4"><p className="text-xs font-bold text-slate-400">{label}</p><p className="mt-2 text-2xl font-black text-white">{value ?? 'Sem dados disponíveis'}</p></div>)}</div><div className="grid gap-4 lg:grid-cols-2"><div className="rounded-2xl border border-slate-800 bg-slate-900 p-4"><h3 className="font-black text-white">Status das integrações</h3>{integrations.length ? <div className="mt-3 space-y-2">{integrations.slice(0, 6).map((item) => <div key={item.id} className="flex justify-between text-xs"><span>{item.name}</span><Badge value={item.status} /></div>)}</div> : <p className="mt-3 text-sm text-slate-400">Configuração pendente</p>}</div><div className="rounded-2xl border border-slate-800 bg-slate-900 p-4"><h3 className="font-black text-white">Último backup</h3>{latestBackup ? <div className="mt-3 text-sm"><Badge value={latestBackup.status} /><p className="mt-2 text-slate-400">{safeDate(latestBackup.finishedAt || latestBackup.createdAt)}</p></div> : <p className="mt-3 text-sm text-slate-400">Configuração pendente</p>}</div></div></>;
}

function LeadsSection({ leads, tenants, search, setSearch, onNew, onStatus }: any) { const filtered = leads.filter((lead: MasterLead) => `${lead.name} ${lead.companyName} ${lead.email}`.toLowerCase().includes(search.toLowerCase())); return <><SectionHeader title="Leads" description="Interessados e oportunidades comerciais sem duplicar empresas." action={<button onClick={onNew} className={primaryButton}><PlusCircle className="h-4 w-4" />Novo lead</button>} /><SearchBox value={search} onChange={setSearch} />{filtered.length ? <div className="overflow-x-auto rounded-2xl border border-slate-800"><table className="w-full min-w-[780px] text-left text-xs"><thead className="bg-slate-900 text-slate-400"><tr><th className="p-3">Contato</th><th>Empresa</th><th>Origem</th><th>Status</th><th>Vínculo</th></tr></thead><tbody>{filtered.map((lead: MasterLead) => <tr key={lead.id} className="border-t border-slate-800"><td className="p-3"><b className="text-white">{lead.name}</b><div className="text-slate-400">{lead.email}</div></td><td>{lead.companyName || '—'}</td><td>{lead.source}</td><td><select className={inputClass} value={lead.status} onChange={(e) => onStatus(lead, e.target.value)}>{LEAD_STATUSES.map((status) => <option key={status}>{status}</option>)}</select></td><td>{lead.companyId ? tenants.find((t: ClientTenant) => t.id === lead.companyId)?.companyName || lead.companyId : lead.status === 'GANHO' ? 'Empresa não localizada' : '—'}</td></tr>)}</tbody></table></div> : <EmptyState />}</> }

function CompaniesSection({ tenants, search, setSearch, onNew, onEdit, onToggle, onDelete }: any) { const filtered = tenants.filter((tenant: ClientTenant) => `${tenant.companyName} ${tenant.cnpj} ${tenant.ownerEmail}`.toLowerCase().includes(search.toLowerCase())); return <><SectionHeader title="Empresas" description="Cadastro, assinatura, módulos, situação financeira e usuários vinculados." action={<button onClick={onNew} className={primaryButton}><PlusCircle className="h-4 w-4" />Nova empresa</button>} /><SearchBox value={search} onChange={setSearch} />{filtered.length ? <div className="grid gap-3">{filtered.map((tenant: ClientTenant) => <div key={tenant.id} className="rounded-2xl border border-slate-800 bg-slate-900 p-4"><div className="flex flex-wrap justify-between gap-3"><div><h3 className="font-black text-white">{tenant.companyName}</h3><p className="text-xs text-slate-400">{tenant.cnpj || 'CNPJ não informado'} • {tenant.ownerEmail}</p></div><Badge value={tenantDisplayStatus(tenant)} /></div><div className="mt-4 grid gap-2 text-xs text-slate-300 sm:grid-cols-4"><span>Plano: <b>{tenant.contract?.planName || '—'}</b></span><span>Vencimento: <b>{safeDate(tenant.contract?.expirationDate)}</b></span><span>Mensalidade: <b>{currency.format(Number(tenant.contract?.monthlyFee || 0))}</b></span><span>Usuários: <b>{tenant.metrics?.activeUsersCount || 0}</b></span></div><div className="mt-4 flex flex-wrap gap-2"><button onClick={() => onEdit(tenant)} className={secondaryButton}>Editar</button><button onClick={() => onToggle(tenant)} className={secondaryButton}>{tenant.status === 'Ativo' ? 'Suspender' : 'Reativar'}</button><button onClick={() => onDelete(tenant)} className={`${secondaryButton} text-rose-300`}>Excluir</button></div></div>)}</div> : <EmptyState />}</> }

function UsersSection({ users, tenants, onNew, onToggle }: any) { return <><SectionHeader title="Usuários e Permissões" description="Acessos reais do Firebase Authentication vinculados aos perfis do Firestore." action={<button onClick={onNew} className={primaryButton}><KeyRound className="h-4 w-4" />Criar acesso</button>} />{users.length ? <div className="overflow-x-auto rounded-2xl border border-slate-800"><table className="w-full min-w-[760px] text-left text-xs"><thead className="bg-slate-900 text-slate-400"><tr><th className="p-3">Usuário</th><th>Empresa</th><th>Perfil</th><th>Permissões</th><th>Status</th><th>Ação</th></tr></thead><tbody>{users.map((user: UserProfile) => { const role = String(user.role || '').toUpperCase().replace(/[\s-]+/g, '_'); const protectedMaster = role === 'MASTER' || role === 'MASTER_ADMIN' || user.tipoUsuario === 'MASTER'; const developer = ['DEVELOPER_ADMIN','DEVELOPER','DESENVOLVEDOR'].includes(role) || user.tipoUsuario === 'DEVELOPER'; return <tr key={user.uid} className="border-t border-slate-800"><td className="p-3"><b className="text-white">{user.displayName}</b><div className="text-slate-400">{user.email}</div></td><td>{protectedMaster ? 'Plataforma RL Connect' : developer ? 'Tecnologia RL Connect' : tenants.find((t: ClientTenant) => t.id === user.companyId)?.companyName || user.companyId}</td><td>{user.role}</td><td>{user.permissions?.length || 0}</td><td><Badge value={protectedMaster ? 'PROTEGIDO' : user.status} /></td><td>{protectedMaster ? <span className="text-[10px] font-black uppercase text-emerald-300">Não pode bloquear</span> : <button onClick={() => onToggle(user)} className={secondaryButton}>{user.status === 'Ativo' ? 'Bloquear' : 'Reativar'}</button>}</td></tr>; })}</tbody></table></div> : <EmptyState />}</> }

function PlansModulesSection({ plans, modules, onEditPlan, onEditModule, onNewModule }: any) { return <><SectionHeader title="Planos e Módulos" description="Uma única lista oficial de módulos usada por planos, empresas, permissões e menus." action={<button onClick={onNewModule} className={primaryButton}><PlusCircle className="h-4 w-4" />Novo módulo</button>} /><div className="grid gap-4 xl:grid-cols-2"><div className="space-y-3"><h3 className="font-black text-white">Planos</h3>{plans.length ? plans.map((plan: SaaSPlan) => <button key={plan.id} onClick={() => onEditPlan(plan)} className="w-full rounded-2xl border border-slate-800 bg-slate-900 p-4 text-left hover:border-amber-500/50"><div className="flex justify-between"><b>{plan.name}</b><span>{currency.format(plan.monthlyPrice)}/mês</span></div><p className="mt-2 text-xs text-slate-400">{plan.includedModules.length} módulos • {plan.maxUsers} usuários • {plan.maxActiveJobs} vagas</p></button>) : <EmptyState />}</div><div className="space-y-3"><h3 className="font-black text-white">Módulos oficiais</h3>{modules.length ? modules.map((module: PlatformModule) => <button key={module.id} onClick={() => onEditModule(module)} className="w-full rounded-2xl border border-slate-800 bg-slate-900 p-4 text-left hover:border-amber-500/50"><div className="flex justify-between gap-2"><b>{module.name}</b><Badge value={module.status} /></div><p className="mt-2 text-xs text-slate-400">{module.description || 'Sem descrição'} • chave: {module.key}</p></button>) : <EmptyState />}</div></div></> }

function FinanceSection({ receivables, payables, onNew }: any) { const total = (items: MasterFinancialEntry[], status?: string) => items.filter((item) => !status || item.status === status).reduce((sum, item) => sum + Number(item.amount || 0), 0); return <><SectionHeader title="Financeiro" description="Financeiro da plataforma RL Connect, separado do financeiro interno das empresas clientes." action={<button onClick={onNew} className={primaryButton}><PlusCircle className="h-4 w-4" />Novo lançamento</button>} /><div className="grid gap-3 sm:grid-cols-3"><Metric label="A receber" value={currency.format(total(receivables, 'PENDENTE'))} /><Metric label="Recebido" value={currency.format(total(receivables, 'PAGO'))} /><Metric label="A pagar" value={currency.format(total(payables, 'PENDENTE'))} /></div><div className="grid gap-4 xl:grid-cols-2"><FinancialList title="Contas a receber" items={receivables} /><FinancialList title="Contas a pagar" items={payables} /></div></> }
function FinancialList({ title, items }: { title: string; items: MasterFinancialEntry[] }) { return <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4"><h3 className="font-black text-white">{title}</h3>{items.length ? <div className="mt-3 space-y-2">{items.map((entry) => <div key={entry.id} className="flex items-center justify-between gap-3 rounded-xl bg-slate-950 p-3 text-xs"><div><b>{entry.description}</b><p className="text-slate-400">{entry.companyName || entry.supplier || 'Plataforma'} • {safeDate(entry.dueDate)}</p></div><div className="text-right"><b>{currency.format(entry.amount)}</b><div><Badge value={entry.status} /></div></div></div>)}</div> : <EmptyState />}</div> }

function InvoiceSection({ invoices }: { invoices: MasterInvoiceRecord[] }) { return <><SectionHeader title="Faturamento / NFS-e" description="Notas vinculadas à cobrança e ao pagamento. O provedor será definido posteriormente." />{invoices.length ? <div className="grid gap-3">{invoices.map((invoice) => <div key={invoice.id} className="rounded-2xl border border-slate-800 bg-slate-900 p-4"><div className="flex justify-between"><b>{invoice.companyName || invoice.companyId || 'Cliente'}</b><Badge value={invoice.status} /></div><p className="mt-2 text-xs text-slate-400">{currency.format(invoice.amount)} • cobrança {invoice.financialEntryId || 'não vinculada'} • nota {invoice.number || 'pendente'}</p></div>)}</div> : <EmptyState label="Configuração pendente — nenhuma NFS-e real registrada." />}</> }
function SupportSection({ tickets, onNew }: any) { return <><SectionHeader title="Suporte Técnico" description="Atendimentos vinculados à empresa com histórico central na auditoria." action={<button onClick={onNew} className={primaryButton}><PlusCircle className="h-4 w-4" />Abrir atendimento</button>} />{tickets.length ? <div className="grid gap-3">{tickets.map((ticket: MasterSupportTicket) => <div key={ticket.id} className="rounded-2xl border border-slate-800 bg-slate-900 p-4"><div className="flex justify-between"><b>{ticket.subject}</b><Badge value={ticket.status} /></div><p className="mt-2 text-xs text-slate-400">{ticket.companyName || ticket.companyId} • prioridade {ticket.priority} • {safeDate(ticket.createdAt)}</p></div>)}</div> : <EmptyState />}</> }
function IntegrationsSection({ integrations }: { integrations: MasterIntegrationStatus[] }) { const byName = new Map(integrations.map((item) => [item.name.toLowerCase(), item])); return <><SectionHeader title="Integrações / API" description="Google não é login. O acesso ao RL Connect continua exclusivamente pelo Firebase Authentication." /><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{INTEGRATION_CATALOG.map((name) => { const item = byName.get(name.toLowerCase()); return <div key={name} className="rounded-2xl border border-slate-800 bg-slate-900 p-4"><div className="flex justify-between gap-2"><b>{name}</b><Badge value={item?.status || 'CONFIGURACAO_PENDENTE'} /></div><p className="mt-2 text-xs text-slate-400">{item?.lastCheckedAt ? `Última verificação: ${safeDate(item.lastCheckedAt)}` : 'Configuração pendente'}</p></div> })}</div></> }
function BackupSection({ backups }: { backups: MasterBackupRecord[] }) { return <><SectionHeader title="Backup" description="Histórico real de proteção do Firestore e arquivos importantes do Storage. Nenhum segundo banco operacional é criado." />{backups.length ? <div className="grid gap-3">{backups.map((backup) => <div key={backup.id} className="rounded-2xl border border-slate-800 bg-slate-900 p-4"><div className="flex justify-between"><b>{backup.source || 'Firebase'}</b><Badge value={backup.status} /></div><p className="mt-2 text-xs text-slate-400">{safeDate(backup.finishedAt || backup.createdAt)} • destino {backup.destination || 'não configurado'} • {backup.sizeBytes ? `${Math.round(backup.sizeBytes / 1_048_576)} MB` : 'tamanho indisponível'}</p></div>)}</div> : <EmptyState label="Configuração pendente — nenhum backup real registrado." />}</> }
function AuditSection({ logs }: { logs: any[] }) { return <><SectionHeader title="Auditoria e Logs" description="Trilha central de empresas, usuários, financeiro, suporte, configurações e integrações." />{logs.length ? <div className="grid gap-2">{logs.slice().sort((a, b) => text(b.createdAt || b.timestamp).localeCompare(text(a.createdAt || a.timestamp))).map((log) => <div key={log.id} className="rounded-xl border border-slate-800 bg-slate-900 p-3 text-xs"><div className="flex justify-between gap-2"><b>{log.description || log.actionType || 'Evento'}</b><Badge value={log.severity || log.status || 'INFO'} /></div><p className="mt-1 text-slate-400">{log.moduleName || 'Sistema'} • {log.userEmail || log.userName || log.createdBy || 'Sistema'} • {safeDate(log.createdAt || log.timestamp)}</p></div>)}</div> : <EmptyState />}</> }
function SettingsSection({ settings, onSave }: { settings: MasterGlobalSettings; onSave: (next: MasterGlobalSettings) => Promise<void> }) { const [form, setForm] = useState(settings); const [saving, setSaving] = useState(false); useEffect(() => setForm(settings), [settings]); return <><SectionHeader title="Configurações" description="Somente parâmetros globais reais da plataforma. Integrações e planos permanecem em seus módulos próprios." /><form onSubmit={async (event) => { event.preventDefault(); setSaving(true); try { await onSave(form); } finally { setSaving(false); } }} className="max-w-2xl space-y-4 rounded-2xl border border-slate-800 bg-slate-900 p-5"><Field label="Nome da plataforma"><input className={inputClass} value={form.platformName} onChange={(e) => setForm({ ...form, platformName: e.target.value })} /></Field><div className="grid gap-3 sm:grid-cols-2"><Field label="Período da assinatura"><input className={inputClass} value="30 dias" disabled /></Field><Field label="Período de tolerância"><input className={inputClass} value="10 dias" disabled /></Field></div><Field label="E-mail de suporte"><input className={inputClass} type="email" value={form.supportEmail || ''} onChange={(e) => setForm({ ...form, supportEmail: e.target.value })} /></Field><Field label="URL da política de privacidade"><input className={inputClass} value={form.privacyPolicyUrl || ''} onChange={(e) => setForm({ ...form, privacyPolicyUrl: e.target.value })} /></Field><button className={primaryButton} disabled={saving}><Save className="h-4 w-4" />{saving ? 'Salvando...' : 'Salvar configurações'}</button></form></> }

function OperationalFormModal({ kind, tenants, modules, saving, onClose, onSave }: any) { const [data, setData] = useState<any>(kind === 'lead' ? { status: 'NOVO', source: 'MANUAL' } : kind === 'finance' ? { type: 'RECEBER', status: 'PENDENTE' } : kind === 'support' ? { status: 'ABERTO', priority: 'NORMAL' } : { role: 'ADMIN_EMPRESA', status: 'Ativo', permissions: [] }); const title = kind === 'lead' ? 'Novo lead' : kind === 'finance' ? 'Novo lançamento financeiro' : kind === 'support' ? 'Novo atendimento' : 'Criar acesso Firebase'; const submit = async (event: React.FormEvent) => { event.preventDefault(); const tenant = tenants.find((item: ClientTenant) => item.id === data.companyId); await onSave({ ...data, companyName: data.companyName || tenant?.companyName, displayName: data.displayName || data.name, modules: tenant?.modules || {}, tipoUsuario: data.role === 'ADMIN_EMPRESA' ? 'ADMIN_EMPRESA' : 'EMPRESA' }); }; return <Dialog title={title} onClose={onClose}><form onSubmit={submit} className="space-y-3">{kind === 'lead' && <><Field label="Nome"><input required className={inputClass} value={data.name || ''} onChange={(e) => setData({ ...data, name: e.target.value })} /></Field><Field label="Empresa"><input className={inputClass} value={data.companyName || ''} onChange={(e) => setData({ ...data, companyName: e.target.value })} /></Field><Field label="CNPJ"><input className={inputClass} value={data.cnpj || ''} onChange={(e) => setData({ ...data, cnpj: e.target.value })} /></Field><Field label="E-mail"><input required type="email" className={inputClass} value={data.email || ''} onChange={(e) => setData({ ...data, email: e.target.value })} /></Field><Field label="Telefone"><input className={inputClass} value={data.phone || ''} onChange={(e) => setData({ ...data, phone: e.target.value })} /></Field><Field label="Interesse"><textarea className={inputClass} value={data.interest || ''} onChange={(e) => setData({ ...data, interest: e.target.value })} /></Field></>}{kind === 'finance' && <><Field label="Tipo"><select className={inputClass} value={data.type} onChange={(e) => setData({ ...data, type: e.target.value })}><option value="RECEBER">Conta a receber</option><option value="PAGAR">Conta a pagar</option></select></Field><Field label="Descrição"><input required className={inputClass} value={data.description || ''} onChange={(e) => setData({ ...data, description: e.target.value })} /></Field><Field label="Empresa / fornecedor"><select className={inputClass} value={data.companyId || ''} onChange={(e) => setData({ ...data, companyId: e.target.value })}><option value="">Plataforma / fornecedor externo</option>{tenants.map((tenant: ClientTenant) => <option key={tenant.id} value={tenant.id}>{tenant.companyName}</option>)}</select></Field><div className="grid gap-3 sm:grid-cols-2"><Field label="Valor"><input required type="number" min="0.01" step="0.01" className={inputClass} value={data.amount || ''} onChange={(e) => setData({ ...data, amount: Number(e.target.value) })} /></Field><Field label="Vencimento"><input required type="date" className={inputClass} value={data.dueDate || ''} onChange={(e) => setData({ ...data, dueDate: e.target.value })} /></Field></div></>}{kind === 'support' && <><Field label="Empresa"><select required className={inputClass} value={data.companyId || ''} onChange={(e) => setData({ ...data, companyId: e.target.value })}><option value="">Selecione</option>{tenants.map((tenant: ClientTenant) => <option key={tenant.id} value={tenant.id}>{tenant.companyName}</option>)}</select></Field><Field label="Assunto"><input required className={inputClass} value={data.subject || ''} onChange={(e) => setData({ ...data, subject: e.target.value })} /></Field><Field label="Descrição"><textarea required className={inputClass} value={data.description || ''} onChange={(e) => setData({ ...data, description: e.target.value })} /></Field></>}{kind === 'user' && <><Field label="Nome"><input required className={inputClass} value={data.displayName || ''} onChange={(e) => setData({ ...data, displayName: e.target.value })} /></Field><Field label="E-mail"><input required type="email" className={inputClass} value={data.email || ''} onChange={(e) => setData({ ...data, email: e.target.value })} /></Field><Field label="Senha temporária"><input required minLength={6} type="password" className={inputClass} value={data.password || ''} onChange={(e) => setData({ ...data, password: e.target.value })} /></Field><Field label="Empresa"><select required className={inputClass} value={data.companyId || ''} onChange={(e) => setData({ ...data, companyId: e.target.value })}><option value="">Selecione</option>{tenants.map((tenant: ClientTenant) => <option key={tenant.id} value={tenant.id}>{tenant.companyName}</option>)}</select></Field><Field label="Perfil"><select className={inputClass} value={data.role} onChange={(e) => setData({ ...data, role: e.target.value })}><option value="ADMIN_EMPRESA">Administrador da empresa</option><option value="RH">RH</option><option value="DP">Departamento Pessoal</option><option value="RECRUTADOR">Recrutador</option><option value="HEADHUNTER">Headhunter</option><option value="FINANCEIRO">Financeiro</option></select></Field><Field label="Permissões"><div className="grid gap-2 sm:grid-cols-2">{modules.map((module: PlatformModule) => <label key={module.key} className="flex items-center gap-2 rounded-lg border border-slate-800 p-2 text-xs"><input type="checkbox" checked={(data.permissions || []).includes(module.key)} onChange={(e) => setData({ ...data, permissions: e.target.checked ? [...(data.permissions || []), module.key] : (data.permissions || []).filter((item: string) => item !== module.key) })} />{module.name}</label>)}</div></Field></>}<button disabled={saving} className={`${primaryButton} w-full`}>{saving ? 'Salvando...' : 'Salvar no Firebase'}</button></form></Dialog> }

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block space-y-1.5 text-xs font-bold text-slate-300"><span>{label}</span>{children}</label>; }
function SearchBox({ value, onChange }: { value: string; onChange: (value: string) => void }) { return <div className="relative max-w-xl"><Search className="absolute left-3 top-3 h-4 w-4 text-slate-500" /><input className={`${inputClass} pl-9`} value={value} onChange={(e) => onChange(e.target.value)} placeholder="Buscar..." /></div>; }
function Metric({ label, value }: { label: string; value: string }) { return <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4"><p className="text-xs text-slate-400">{label}</p><p className="mt-2 text-xl font-black text-white">{value}</p></div>; }
