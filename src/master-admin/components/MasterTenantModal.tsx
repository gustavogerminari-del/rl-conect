import React, { useEffect, useMemo, useState } from 'react';
import { Loader2, Save, X } from 'lucide-react';
import { UserService, type UserProfile } from '../../services/UserService';
import type { ClientTenant, MasterPlanPreset, TenantModulePermissions } from '../types/master';
import type { TenantSaveInput } from '../masterTenantsStore';

interface MasterTenantModalProps {
  tenant: ClientTenant | null;
  onClose: () => void;
  onSave: (tenant: TenantSaveInput) => Promise<void> | void;
}

type TabId = 'empresa' | 'plano' | 'modulos' | 'branding' | 'contrato' | 'administrador';

type ViaCepResponse = {
  erro?: boolean;
  logradouro?: string;
  bairro?: string;
  localidade?: string;
  uf?: string;
};

const TABS: Array<{ id: TabId; label: string }> = [
  { id: 'empresa', label: 'Dados da Empresa' },
  { id: 'plano', label: 'Plano & Limites' },
  { id: 'modulos', label: 'Módulos Liberados' },
  { id: 'branding', label: 'Personalização / White-Label' },
  { id: 'contrato', label: 'Contrato' },
  { id: 'administrador', label: 'Administrador' },
];

const MODULE_LABELS: Array<[keyof TenantModulePermissions, string]> = [
  ['recrutamento', 'Recrutamento'],
  ['headhunter', 'Headhunter'],
  ['departamentoPessoal', 'Departamento Pessoal'],
  ['vagas', 'Vagas'],
  ['bancoTalentos', 'Banco de Talentos'],
  ['entrevistas', 'Entrevistas'],
  ['equipeInterna', 'Equipe Interna'],
  ['consultorRH', 'Consultor de RH'],
  ['feriasBeneficios', 'Férias e Benefícios'],
  ['documentosAssinatura', 'Documentos e Assinatura'],
  ['auditoriaLogs', 'Auditoria e Logs'],
  ['relatoriosAvancados', 'Relatórios Avançados'],
  ['siteVagasPersonalizado', 'Site de Vagas Personalizado'],
  ['folha', 'Folha'],
  ['ponto', 'Ponto'],
];

const baseInput = 'w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white outline-none focus:border-amber-500';
const labelClass = 'mb-1 block text-xs font-bold text-slate-400';
const emptyAddress = { cep: '', street: '', number: '', complement: '', neighborhood: '', cityUf: '' };

function emptyTenant(): ClientTenant {
  const today = new Date().toISOString().slice(0, 10);
  return {
    id: '',
    code: '',
    companyName: '',
    tradeName: '',
    cnpj: '',
    ownerName: '',
    ownerEmail: '',
    ownerPhone: '',
    address: { ...emptyAddress },
    adminCredentials: { adminEmail: '' },
    status: 'Ativo',
    maxUsers: 5,
    maxActiveJobs: 10,
    modules: {
      recrutamento: true,
      departamentoPessoal: false,
      vagas: true,
      headhunter: false,
      bancoTalentos: true,
      entrevistas: true,
      equipeInterna: true,
      consultorRH: true,
      feriasBeneficios: false,
      documentosAssinatura: false,
      auditoriaLogs: false,
      relatoriosAvancados: false,
      siteVagasPersonalizado: false,
      folha: false,
      ponto: false,
    },
    branding: { primaryColor: '#123657', companyDisplayName: '', logoUrl: '', customDomain: '' },
    metrics: { activeUsersCount: 0, totalJobsCreated: 0, totalTalentsStored: 0, totalDocumentsSigned: 0, storageUsedMB: 0, lastLoginAt: '' },
    contract: { id: '', contractNumber: '', planName: 'Básico', monthlyFee: 0, billingCycle: 'Mensal', startDate: today, expirationDate: '', paymentMethod: 'Pix', autoRenew: true },
    createdAt: '',
    notes: '',
  };
}

const normalizedRole = (value: string) => value.trim().toUpperCase().replace(/[\s-]+/g, '_');
const isCompanyAdmin = (user: UserProfile) => ['ADMIN_EMPRESA', 'ADMINISTRADOR_EMPRESA', 'EMPRESA_ADMIN', 'GESTOR_EMPRESA', 'ADMIN'].includes(normalizedRole(user.role));

export function MasterTenantModal({ tenant, onClose, onSave }: MasterTenantModalProps) {
  const isEditing = Boolean(tenant?.id);
  const [activeTab, setActiveTab] = useState<TabId>('empresa');
  const [form, setForm] = useState<ClientTenant>(() => tenant ? structuredClone(tenant) : emptyTenant());
  const [adminPassword, setAdminPassword] = useState('');
  const [confirmAdminPassword, setConfirmAdminPassword] = useState('');
  const [sendCredentialsEmail, setSendCredentialsEmail] = useState(true);
  const [linkedAdmin, setLinkedAdmin] = useState<UserProfile | null>(null);
  const [loadingAdmin, setLoadingAdmin] = useState(false);
  const [cepLoading, setCepLoading] = useState(false);
  const [cepError, setCepError] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setForm(tenant ? structuredClone(tenant) : emptyTenant());
    setAdminPassword('');
    setConfirmAdminPassword('');
    setSendCredentialsEmail(true);
    setCepLoading(false);
    setCepError('');
    setActiveTab('empresa');
  }, [tenant]);

  useEffect(() => {
    let cancelled = false;
    if (!isEditing || !tenant?.id) {
      setLinkedAdmin(null);
      return;
    }
    setLoadingAdmin(true);
    UserService.list(tenant.id)
      .then((users) => {
        if (cancelled) return;
        const admin = users.find(isCompanyAdmin) || null;
        setLinkedAdmin(admin);
      })
      .finally(() => { if (!cancelled) setLoadingAdmin(false); });
    return () => { cancelled = true; };
  }, [isEditing, tenant?.id]);

  const title = isEditing ? `Editar Cliente — ${form.companyName || 'Empresa'}` : 'Novo Cliente';
  const currentPlan = form.contract.planName as MasterPlanPreset;
  const moduleCount = useMemo(() => Object.values(form.modules).filter(Boolean).length, [form.modules]);

  const patch = (next: Partial<ClientTenant>) => setForm((current) => ({ ...current, ...next }));
  const patchAddress = (key: string, value: string) => setForm((current) => ({ ...current, address: { ...(current.address || emptyAddress), [key]: value } }));
  const patchContract = (key: string, value: unknown) => setForm((current) => ({ ...current, contract: { ...current.contract, [key]: value } }));
  const patchBranding = (key: string, value: string) => setForm((current) => ({ ...current, branding: { ...current.branding, [key]: value } }));
  const patchModule = (key: keyof TenantModulePermissions, value: boolean) => setForm((current) => ({ ...current, modules: { ...current.modules, [key]: value } }));

  const lookupCep = async (rawCep: string) => {
    const cep = rawCep.replace(/\D/g, '').slice(0, 8);
    if (cep.length !== 8) return;

    setCepLoading(true);
    setCepError('');
    try {
      const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      if (!response.ok) throw new Error(`ViaCEP respondeu ${response.status}`);
      const data = await response.json() as ViaCepResponse;
      if (data.erro) {
        setCepError('CEP não encontrado. Confira os 8 dígitos.');
        return;
      }

      setForm((current) => ({
        ...current,
        address: {
          ...(current.address || emptyAddress),
          cep,
          street: data.logradouro || '',
          neighborhood: data.bairro || '',
          cityUf: [data.localidade, data.uf].filter(Boolean).join(' / '),
        },
      }));
    } catch (cepLookupError) {
      console.warn('Não foi possível consultar o CEP no ViaCEP:', cepLookupError);
      setCepError('Não foi possível consultar o CEP agora. Você pode preencher o endereço manualmente.');
    } finally {
      setCepLoading(false);
    }
  };

  const handleCepChange = (value: string) => {
    const cep = value.replace(/\D/g, '').slice(0, 8);
    patchAddress('cep', cep);
    setCepError('');
    if (cep.length === 8) void lookupCep(cep);
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    if (!form.companyName.trim()) return setError('Informe a razão social.');
    if (!form.ownerEmail.trim()) return setError('Informe o e-mail de contato da empresa.');

    if (!isEditing) {
      if (!form.adminCredentials?.adminEmail?.trim()) return setError('Informe o e-mail do administrador.');
      if (adminPassword.length < 6) return setError('A senha inicial deve ter pelo menos 6 caracteres.');
      if (adminPassword !== confirmAdminPassword) return setError('Senha inicial e confirmação devem ser iguais.');
    }

    setSaving(true);
    try {
      const payload: TenantSaveInput = isEditing
        ? { ...form, mode: 'edit' }
        : { ...form, mode: 'create', adminPassword, confirmAdminPassword, sendCredentialsEmail };

      // Em edição não existe senha no payload. O salvamento comum não toca no Firebase Authentication.
      await onSave(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível salvar o cliente.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-2 sm:p-4" role="dialog" aria-modal="true" aria-label={title}>
      <form onSubmit={submit} className="flex max-h-[95vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-slate-700 bg-slate-900 text-slate-100 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 px-4 py-4 sm:px-6">
          <div><h2 className="text-lg font-black text-white">{title}</h2><p className="mt-1 text-xs text-slate-400">Firebase Authentication continua sendo o login oficial do RL Connect.</p></div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white" aria-label="Fechar"><X className="h-5 w-5" /></button>
        </div>

        <div className="border-b border-slate-800 px-3 py-3 sm:px-6">
          {/* Mobile: rolagem horizontal. Desktop: grade responsiva, 6 abas em 1 linha ampla ou 2 linhas sem esconder opções. */}
          <div className="flex flex-nowrap gap-2 overflow-x-auto pb-1 md:grid md:grid-cols-3 md:overflow-visible md:pb-0 xl:grid-cols-6">
            {TABS.map((tab) => (
              <button key={tab.id} type="button" onClick={() => setActiveTab(tab.id)} className={`shrink-0 whitespace-nowrap rounded-xl px-3 py-2 text-xs font-black md:w-full md:whitespace-normal ${activeTab === tab.id ? 'bg-amber-500 text-slate-950' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}>
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
          {error && <div className="mb-4 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-200">{error}</div>}

          {activeTab === 'empresa' && <div className="grid gap-4 md:grid-cols-2">
            <Field label="Razão Social"><input className={baseInput} value={form.companyName} onChange={(e) => patch({ companyName: e.target.value })} /></Field>
            <Field label="Nome Fantasia"><input className={baseInput} value={form.tradeName} onChange={(e) => patch({ tradeName: e.target.value })} /></Field>
            <Field label="CNPJ"><input className={baseInput} value={form.cnpj} onChange={(e) => patch({ cnpj: e.target.value })} /></Field>
            <Field label="Status"><select className={baseInput} value={form.status} onChange={(e) => patch({ status: e.target.value as ClientTenant['status'] })}>{['Ativo','Vencido / Tolerância','Bloqueado por Inadimplência','Suspenso','Aguardando Pagamento','Cancelado','Em Teste (Trial)'].map((status) => <option key={status}>{status}</option>)}</select></Field>
            <Field label="Responsável / Contato"><input className={baseInput} value={form.ownerName} onChange={(e) => patch({ ownerName: e.target.value })} /></Field>
            <Field label="E-mail de contato"><input type="email" className={baseInput} value={form.ownerEmail} onChange={(e) => patch({ ownerEmail: e.target.value })} /></Field>
            <Field label="Telefone"><input className={baseInput} value={form.ownerPhone} onChange={(e) => patch({ ownerPhone: e.target.value })} /></Field>
            <Field label="CEP">
              <input className={baseInput} value={form.address?.cep || ''} onChange={(e) => handleCepChange(e.target.value)} inputMode="numeric" maxLength={8} placeholder="00000000" />
              {cepLoading && <span className="mt-1 block text-xs text-slate-400">Consultando endereço...</span>}
              {cepError && <span className="mt-1 block text-xs text-rose-300">{cepError}</span>}
            </Field>
            <Field label="Endereço"><input className={baseInput} value={form.address?.street || ''} onChange={(e) => patchAddress('street', e.target.value)} /></Field>
            <Field label="Número"><input className={baseInput} value={form.address?.number || ''} onChange={(e) => patchAddress('number', e.target.value)} /></Field>
            <Field label="Bairro"><input className={baseInput} value={form.address?.neighborhood || ''} onChange={(e) => patchAddress('neighborhood', e.target.value)} /></Field>
            <Field label="Cidade / UF"><input className={baseInput} value={form.address?.cityUf || ''} onChange={(e) => patchAddress('cityUf', e.target.value)} /></Field>
          </div>}

          {activeTab === 'plano' && <div className="grid gap-4 md:grid-cols-3">
            <Field label="Plano"><select className={baseInput} value={currentPlan} onChange={(e) => patchContract('planName', e.target.value)}>{['Básico','Intermediário','Completo / Enterprise','Customizado'].map((plan) => <option key={plan}>{plan}</option>)}</select></Field>
            <Field label="Limite de usuários"><input type="number" min="1" className={baseInput} value={form.maxUsers} onChange={(e) => patch({ maxUsers: Number(e.target.value) })} /></Field>
            <Field label="Limite de vagas ativas"><input type="number" min="0" className={baseInput} value={form.maxActiveJobs} onChange={(e) => patch({ maxActiveJobs: Number(e.target.value) })} /></Field>
            <Field label="Mensalidade"><input type="number" min="0" step="0.01" className={baseInput} value={form.contract.monthlyFee} onChange={(e) => patchContract('monthlyFee', Number(e.target.value))} /></Field>
            <div className="md:col-span-2 rounded-xl border border-slate-800 bg-slate-950 p-4 text-sm text-slate-300"><b>{moduleCount}</b> módulos liberados para esta empresa.</div>
          </div>}

          {activeTab === 'modulos' && <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{MODULE_LABELS.map(([key, label]) => <label key={String(key)} className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-950 p-3 text-sm"><span>{label}</span><input type="checkbox" checked={Boolean(form.modules[key])} onChange={(e) => patchModule(key, e.target.checked)} className="h-4 w-4" /></label>)}</div>}

          {activeTab === 'branding' && <div className="grid gap-4 md:grid-cols-2">
            <Field label="Nome exibido"><input className={baseInput} value={form.branding.companyDisplayName} onChange={(e) => patchBranding('companyDisplayName', e.target.value)} /></Field>
            <Field label="Cor principal"><div className="flex gap-2"><input type="color" className="h-11 w-14 rounded border border-slate-700 bg-slate-950" value={form.branding.primaryColor || '#123657'} onChange={(e) => patchBranding('primaryColor', e.target.value)} /><input className={baseInput} value={form.branding.primaryColor} onChange={(e) => patchBranding('primaryColor', e.target.value)} /></div></Field>
            <Field label="URL da logo"><input className={baseInput} value={form.branding.logoUrl || ''} onChange={(e) => patchBranding('logoUrl', e.target.value)} /></Field>
            <Field label="Domínio personalizado"><input className={baseInput} value={form.branding.customDomain || ''} onChange={(e) => patchBranding('customDomain', e.target.value)} /></Field>
          </div>}

          {activeTab === 'contrato' && <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <Field label="Número do contrato"><input className={baseInput} value={form.contract.contractNumber} onChange={(e) => patchContract('contractNumber', e.target.value)} /></Field>
            <Field label="Início"><input type="date" className={baseInput} value={form.contract.startDate} onChange={(e) => patchContract('startDate', e.target.value)} /></Field>
            <Field label="Vencimento"><input type="date" className={baseInput} value={form.contract.expirationDate} onChange={(e) => patchContract('expirationDate', e.target.value)} /></Field>
            <Field label="Ciclo"><select className={baseInput} value={form.contract.billingCycle} onChange={(e) => patchContract('billingCycle', e.target.value)}>{['Mensal','Trimestral','Anual'].map((cycle) => <option key={cycle}>{cycle}</option>)}</select></Field>
            <Field label="Forma de pagamento"><select className={baseInput} value={form.contract.paymentMethod} onChange={(e) => patchContract('paymentMethod', e.target.value)}>{['Pix','Boleto Bancário','Cartão de Crédito','Faturamento Direct'].map((method) => <option key={method}>{method}</option>)}</select></Field>
            <label className="flex items-center gap-2 self-end rounded-xl border border-slate-800 bg-slate-950 p-3 text-sm"><input type="checkbox" checked={form.contract.autoRenew} onChange={(e) => patchContract('autoRenew', e.target.checked)} /> Renovação automática</label>
            <div className="md:col-span-2 lg:col-span-3"><Field label="Observações"><textarea rows={4} className={baseInput} value={form.notes || ''} onChange={(e) => patch({ notes: e.target.value })} /></Field></div>
          </div>}

          {activeTab === 'administrador' && <div className="space-y-4">
            {isEditing ? (
              <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
                <h3 className="font-black text-white">Administrador vinculado</h3>
                <p className="mt-1 text-xs text-slate-400">Edição normal da empresa não recria o usuário e não altera a senha no Firebase Authentication.</p>
                {loadingAdmin ? <div className="mt-4 flex items-center gap-2 text-sm text-slate-400"><Loader2 className="h-4 w-4 animate-spin" />Carregando administrador...</div> : linkedAdmin ? <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <ReadOnly label="Nome" value={linkedAdmin.displayName} />
                  <ReadOnly label="E-mail" value={linkedAdmin.email} />
                  <ReadOnly label="Perfil" value={linkedAdmin.role} />
                  <ReadOnly label="Status" value={linkedAdmin.status} />
                </div> : <p className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-200">Nenhum administrador vinculado foi localizado para esta empresa. Nenhuma conta será criada automaticamente durante a edição.</p>}
                <p className="mt-4 text-xs text-slate-500">Redefinição de senha deve ser tratada por uma ação própria de acesso, separada da edição dos dados da empresa.</p>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="E-mail do administrador"><input type="email" className={baseInput} value={form.adminCredentials?.adminEmail || ''} onChange={(e) => patch({ adminCredentials: { ...(form.adminCredentials || {}), adminEmail: e.target.value } })} required /></Field>
                <div />
                <Field label="Senha Inicial"><input type="password" className={baseInput} value={adminPassword} onChange={(e) => setAdminPassword(e.target.value)} minLength={6} required={!isEditing} autoComplete="new-password" /></Field>
                <Field label="Confirmar Senha"><input type="password" className={baseInput} value={confirmAdminPassword} onChange={(e) => setConfirmAdminPassword(e.target.value)} minLength={6} required={!isEditing} autoComplete="new-password" /></Field>
                <label className="md:col-span-2 flex items-start gap-3 rounded-xl border border-slate-800 bg-slate-950 p-4 text-sm"><input type="checkbox" checked={sendCredentialsEmail} onChange={(e) => setSendCredentialsEmail(e.target.checked)} className="mt-0.5 h-4 w-4" /><span><b>Enviar credenciais e instruções de acesso por e-mail</b><span className="mt-1 block text-xs text-slate-400">Disponível somente na criação de uma nova conta.</span></span></label>
              </div>
            )}
          </div>}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-800 px-4 py-4 sm:px-6">
          <span className="text-xs text-slate-500">{isEditing ? 'Salvar não altera credenciais do administrador.' : 'Nova empresa exige senha inicial e confirmação.'}</span>
          <div className="flex gap-2"><button type="button" onClick={onClose} className="rounded-xl border border-slate-700 px-4 py-2 text-sm font-bold text-slate-300 hover:bg-slate-800">Cancelar</button><button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-amber-500 px-4 py-2 text-sm font-black text-slate-950 hover:bg-amber-400 disabled:opacity-60">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}Salvar alterações</button></div>
        </div>
      </form>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label><span className={labelClass}>{label}</span>{children}</label>; }
function ReadOnly({ label, value }: { label: string; value: string }) { return <div><span className={labelClass}>{label}</span><div className="rounded-xl border border-slate-800 bg-slate-900 px-3 py-2.5 text-sm text-slate-200">{value || '—'}</div></div>; }