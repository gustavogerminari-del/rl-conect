import { collection, deleteDoc, doc, getDocs, setDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { sanitizeFirestoreData } from '../lib/firestoreUtils';
import { AuditService } from '../services/AuditService';
import { UserService } from '../services/UserService';
import type { ClientTenant, TenantModulePermissions, TenantStatus } from './types/master';

export type TenantSaveInput = ClientTenant & {
  mode?: 'create' | 'edit';
  adminPassword?: string;
  confirmAdminPassword?: string;
  sendCredentialsEmail?: boolean;
};

const nowIso = () => new Date().toISOString();
const newTenantId = () => `empresa-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const DEFAULT_MODULES: TenantModulePermissions = {
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
};

const normalizeModules = (value?: Partial<TenantModulePermissions>): TenantModulePermissions => ({
  ...DEFAULT_MODULES,
  ...(value || {}),
});

export function normalizeTenantRecord(id: string, raw: Record<string, any>): ClientTenant {
  const source = raw.rawTenantData && typeof raw.rawTenantData === 'object' ? raw.rawTenantData : raw;
  const contract = source.contract && typeof source.contract === 'object' ? source.contract : {};
  const branding = source.branding && typeof source.branding === 'object' ? source.branding : {};
  const metrics = source.metrics && typeof source.metrics === 'object' ? source.metrics : {};
  const address = source.address && typeof source.address === 'object' ? source.address : undefined;
  const adminCredentials = source.adminCredentials && typeof source.adminCredentials === 'object'
    ? { adminEmail: String(source.adminCredentials.adminEmail || source.ownerEmail || raw.ownerEmail || '').trim().toLowerCase(), createdAt: source.adminCredentials.createdAt }
    : undefined;

  return {
    id,
    code: String(source.code || raw.code || id),
    companyName: String(source.companyName || source.nomeEmpresa || raw.companyName || raw.nomeEmpresa || '').trim(),
    tradeName: String(source.tradeName || source.nomeFantasia || raw.tradeName || raw.nomeFantasia || '').trim(),
    cnpj: String(source.cnpj || raw.cnpj || '').trim(),
    ownerName: String(source.ownerName || source.responsavel || raw.ownerName || raw.responsavel || '').trim(),
    ownerEmail: String(source.ownerEmail || raw.ownerEmail || '').trim().toLowerCase(),
    ownerPhone: String(source.ownerPhone || source.telefone || raw.ownerPhone || raw.telefone || '').trim(),
    address,
    adminCredentials,
    status: (source.status || raw.status || 'Ativo') as TenantStatus,
    maxUsers: Number(source.maxUsers ?? raw.maxUsers ?? contract.maxUsers ?? 5),
    maxActiveJobs: Number(source.maxActiveJobs ?? raw.maxActiveJobs ?? contract.maxActiveJobs ?? 10),
    modules: normalizeModules(source.modules || raw.modules || raw.modulos),
    branding: {
      logoUrl: String(branding.logoUrl || ''),
      primaryColor: String(branding.primaryColor || '#123657'),
      companyDisplayName: String(branding.companyDisplayName || source.tradeName || source.companyName || raw.companyName || ''),
      customDomain: String(branding.customDomain || ''),
    },
    metrics: {
      activeUsersCount: Number(metrics.activeUsersCount || 0),
      totalJobsCreated: Number(metrics.totalJobsCreated || 0),
      totalTalentsStored: Number(metrics.totalTalentsStored || 0),
      totalDocumentsSigned: Number(metrics.totalDocumentsSigned || 0),
      storageUsedMB: Number(metrics.storageUsedMB || 0),
      lastLoginAt: String(metrics.lastLoginAt || ''),
    },
    contract: {
      id: String(contract.id || `contract-${id}`),
      contractNumber: String(contract.contractNumber || ''),
      planName: contract.planName || source.planName || 'Básico',
      monthlyFee: Number(contract.monthlyFee || 0),
      billingCycle: contract.billingCycle || 'Mensal',
      startDate: String(contract.startDate || ''),
      expirationDate: String(contract.expirationDate || ''),
      paymentMethod: contract.paymentMethod || 'Pix',
      autoRenew: contract.autoRenew !== false,
    },
    createdAt: String(source.createdAt || raw.createdAt || ''),
    notes: String(source.notes || raw.notes || ''),
    gracePeriodEndsAt: String(source.gracePeriodEndsAt || raw.gracePeriodEndsAt || ''),
    financialStatus: String(source.financialStatus || raw.financialStatus || ''),
    updatedAt: String(source.updatedAt || raw.updatedAt || ''),
  };
}

export async function syncTenantsFromFirestore(): Promise<ClientTenant[]> {
  const snapshot = await getDocs(collection(db, 'empresas'));
  return snapshot.docs.map((item) => normalizeTenantRecord(item.id, item.data() as Record<string, any>));
}

async function persistTenant(tenant: ClientTenant): Promise<void> {
  const payload = sanitizeFirestoreData({
    ...tenant,
    empresaId: tenant.id,
    companyId: tenant.id,
    nomeEmpresa: tenant.companyName,
    modulos: tenant.modules,
    rawTenantData: tenant,
    updatedAt: nowIso(),
    updatedBy: auth.currentUser?.uid || 'MASTER',
  });
  await setDoc(doc(db, 'empresas', tenant.id), payload, { merge: true });
  await setDoc(doc(db, 'empresa_modulos', tenant.id), sanitizeFirestoreData({
    empresaId: tenant.id,
    companyId: tenant.id,
    modules: tenant.modules,
    modulos: tenant.modules,
    updatedAt: nowIso(),
    updatedBy: auth.currentUser?.uid || 'MASTER',
  }), { merge: true });
}

export async function saveTenantAsync(input: TenantSaveInput): Promise<ClientTenant[]> {
  const isCreate = input.mode === 'create' || !String(input.id || '').trim();
  const id = isCreate ? newTenantId() : String(input.id).trim();
  const createdAt = isCreate ? nowIso() : (input.createdAt || nowIso());

  if (!input.companyName.trim()) throw new Error('Razão social é obrigatória.');
  if (!input.ownerEmail.trim()) throw new Error('E-mail de contato é obrigatório.');

  if (isCreate) {
    const password = String(input.adminPassword || '');
    if (password.length < 6) throw new Error('Senha inicial deve ter pelo menos 6 caracteres.');
    if (password !== String(input.confirmAdminPassword || '')) throw new Error('Senha inicial e confirmação devem ser iguais.');
    if (!String(input.adminCredentials?.adminEmail || input.ownerEmail || '').trim()) throw new Error('E-mail do administrador é obrigatório.');
  }

  const tenant: ClientTenant = {
    ...input,
    id,
    code: input.code || id,
    modules: normalizeModules(input.modules),
    adminCredentials: isCreate ? {
      adminEmail: String(input.adminCredentials?.adminEmail || input.ownerEmail).trim().toLowerCase(),
      sendWelcomeEmail: Boolean(input.sendCredentialsEmail),
      createdAt,
    } : input.adminCredentials ? {
      adminEmail: String(input.adminCredentials.adminEmail || '').trim().toLowerCase(),
      createdAt: input.adminCredentials.createdAt,
    } : undefined,
    createdAt,
    updatedAt: nowIso(),
  };

  // EDIÇÃO COMUM: somente dados da empresa/contrato/módulos no Firestore.
  // Não chama UserService.create, não recria administrador e não altera senha do Firebase Authentication.
  if (!isCreate) {
    await persistTenant(tenant);
    await AuditService.log({
      action: 'UPDATE',
      description: `Empresa ${tenant.companyName} atualizada sem alteração de credenciais`,
      moduleName: 'Painel Master',
      targetEntity: 'Empresa',
      companyId: tenant.id,
    });
    return syncTenantsFromFirestore();
  }

  // CRIAÇÃO: a empresa precisa existir antes do provisionamento, pois o UserService
  // valida o vínculo com a empresa. Em falha, os documentos criados são revertidos.
  await persistTenant(tenant);
  try {
    await UserService.create({
      email: tenant.adminCredentials!.adminEmail,
      password: String(input.adminPassword),
      displayName: tenant.ownerName || tenant.companyName,
      role: 'ADMIN_EMPRESA',
      tipoUsuario: 'ADMIN_EMPRESA',
      companyId: tenant.id,
      status: 'Ativo',
      modules: tenant.modules as Record<string, boolean>,
    });
    await AuditService.log({
      action: 'CREATE',
      description: `Empresa ${tenant.companyName} e administrador inicial criados`,
      moduleName: 'Painel Master',
      targetEntity: 'Empresa',
      companyId: tenant.id,
    });
  } catch (error) {
    await Promise.allSettled([
      deleteDoc(doc(db, 'empresa_modulos', tenant.id)),
      deleteDoc(doc(db, 'empresas', tenant.id)),
    ]);
    throw error;
  }

  return syncTenantsFromFirestore();
}

export async function toggleTenantStatus(id: string, currentStatus: TenantStatus): Promise<ClientTenant[]> {
  const nextStatus: TenantStatus = currentStatus === 'Ativo' ? 'Suspenso' : 'Ativo';
  await setDoc(doc(db, 'empresas', id), sanitizeFirestoreData({ status: nextStatus, updatedAt: nowIso(), updatedBy: auth.currentUser?.uid || 'MASTER' }), { merge: true });
  await AuditService.log({ action: 'UPDATE', description: `Empresa ${id} alterada para ${nextStatus}`, moduleName: 'Painel Master', targetEntity: 'Empresa', companyId: id });
  return syncTenantsFromFirestore();
}

export async function deleteTenant(id: string): Promise<ClientTenant[]> {
  await Promise.allSettled([
    deleteDoc(doc(db, 'empresa_modulos', id)),
    deleteDoc(doc(db, 'empresas', id)),
  ]);
  await AuditService.log({ action: 'DELETE', description: `Empresa ${id} removida do cadastro Master`, moduleName: 'Painel Master', targetEntity: 'Empresa', companyId: id });
  return syncTenantsFromFirestore();
}
