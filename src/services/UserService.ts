import {
  collection,
  doc,
  getDocs,
  getDoc,
  query,
  where,
  writeBatch,
} from 'firebase/firestore';
import { deleteApp, initializeApp } from 'firebase/app';
import {
  createUserWithEmailAndPassword,
  deleteUser,
  getAuth,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
} from 'firebase/auth';
import { db, auth } from '../lib/firebase';
import { AuditService } from './AuditService';
import { buildProvisionedPermissions } from './provisionedPermissions';

const COLLECTION_NAME = 'usuarios';

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  role: string;
  companyId: string;
  colaboradorId?: string;
  tipoUsuario?: 'MASTER' | 'DEVELOPER' | 'ADMIN_EMPRESA' | 'EMPRESA' | 'CANDIDATO' | 'FUNCIONARIO';
  status: string;
  permissions?: string[];
  modules?: Record<string, boolean>;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}

type RawUserProfile = Partial<UserProfile> & {
  nome?: string;
  empresaId?: string | null;
  ativo?: boolean;
};

const normalizedAccessRole = (value: unknown): string =>
  String(value || '').trim().toUpperCase().replace(/[\s-]+/g, '_');

const isProtectedMasterProfile = (profile?: Partial<RawUserProfile> | null): boolean =>
  ['MASTER', 'MASTER_ADMIN'].includes(normalizedAccessRole(profile?.role)) ||
  ['MASTER', 'MASTER_ADMIN'].includes(normalizedAccessRole(profile?.tipoUsuario));

const normalizeProfile = (uid: string, raw: RawUserProfile): UserProfile => ({
  uid,
  email: String(raw.email || '').trim().toLowerCase(),
  displayName: String(raw.displayName || raw.nome || '').trim(),
  role: String(raw.role || '').trim(),
  companyId: String(raw.companyId || raw.empresaId || '').trim(),
  colaboradorId: raw.colaboradorId,
  tipoUsuario: raw.tipoUsuario,
  status: raw.status || (raw.ativo === false ? 'Inativo' : 'Ativo'),
  permissions: Array.isArray(raw.permissions) ? raw.permissions : [],
  modules: raw.modules && typeof raw.modules === 'object' ? raw.modules : {},
  createdBy: raw.createdBy,
  createdAt: raw.createdAt || '',
  updatedAt: raw.updatedAt || '',
});

async function safeAudit(input: Parameters<typeof AuditService.log>[0], context: string): Promise<void> {
  try {
    await AuditService.log(input);
  } catch (error) {
    // O acesso já foi alterado. Falha de auditoria não pode virar falso erro de
    // permissão nem induzir o Master a repetir a operação e criar inconsistência.
    console.warn(`[UserService] ${context} concluído, mas a auditoria falhou.`, error);
  }
}

async function resolveCompanyName(companyId: string): Promise<string> {
  const companySnapshot = await getDoc(doc(db, 'empresas', companyId));
  if (!companySnapshot.exists()) {
    throw new Error('A empresa vinculada ao usuário não existe. Selecione uma empresa válida.');
  }
  const raw = companySnapshot.data() as Record<string, any>;
  const tenant = raw.rawTenantData && typeof raw.rawTenantData === 'object' ? raw.rawTenantData : raw;
  const name = String(tenant.companyName || tenant.nomeEmpresa || raw.companyName || raw.nomeEmpresa || '').trim();
  if (!name) throw new Error('A empresa selecionada não possui um nome válido.');
  return name;
}

async function authorizedRequest(path: string, init: RequestInit): Promise<any> {
  const idToken = await auth.currentUser?.getIdToken();
  if (!idToken) throw new Error('Sessão Firebase inválida. Entre novamente.');
  const response = await fetch(path, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
      ...(init.headers || {}),
    },
  });
  const contentType = response.headers.get('content-type') || '';
  let result: Record<string, any> = {};

  if (contentType.toLowerCase().includes('application/json')) {
    try {
      result = await response.json();
    } catch {
      const error = new Error(`A API respondeu JSON inválido (HTTP ${response.status}).`) as Error & { status?: number };
      error.status = response.status;
      throw error;
    }
  } else {
    const responseText = (await response.text()).trim();
    const error = new Error(
      `A API respondeu em formato inesperado (HTTP ${response.status}${responseText ? `: ${responseText.slice(0, 120)}` : ''}).`
    ) as Error & { status?: number };
    error.status = response.status;
    throw error;
  }

  if (!response.ok || !result.success) {
    const error = new Error(result.error || 'A operação de usuário falhou.') as Error & { status?: number };
    error.status = response.status;
    throw error;
  }
  return result;
}

function canUseClientFirebaseFallback(error: any, allowedStatuses: number[]): boolean {
  const statusCode = Number(error?.status);
  const message = String(error?.message || '');
  // ChatGPT Sites pode servir o index.html para uma rota de API inexistente e
  // responder HTTP 200. Nesse caso "formato inesperado" significa que o backend
  // administrativo não está disponível, não que a sessão MASTER foi negada.
  return allowedStatuses.includes(statusCode)
    || /provisionamento administrativo|not found|formato inesperado|JSON inválido|API respondeu em formato inesperado|HTTP\s*(404|405|501)/i.test(message);
}

async function createUserWithSecondaryFirebaseApp(input: {
  email: string;
  password: string;
  displayName: string;
  role: string;
  companyId: string;
  companyName: string;
  status: string;
  permissions: string[];
  modules?: Record<string, boolean>;
  tipoUsuario?: UserProfile['tipoUsuario'];
  colaboradorId?: string;
}): Promise<string> {
  const appName = `maisrh-provision-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  // Usa exatamente as opções da instância Firebase autenticada. Assim não existe
  // uma segunda configuração divergente entre o Painel Master e o usuário criado.
  const secondaryApp = initializeApp(auth.app.options, appName);
  const secondaryAuth = getAuth(secondaryApp);
  let createdUser: Awaited<ReturnType<typeof createUserWithEmailAndPassword>>['user'] | null = null;
  let createdNewAuthUser = false;

  try {
    try {
      const credential = await createUserWithEmailAndPassword(secondaryAuth, input.email, input.password);
      createdUser = credential.user;
      createdNewAuthUser = true;
    } catch (createError: unknown) {
      const createErrorCode =
        createError && typeof createError === 'object' && 'code' in createError
          ? String((createError as { code?: unknown }).code || '')
          : '';
      if (createErrorCode !== 'auth/email-already-in-use') throw createError;

      // Compatibilidade para empresa recriada quando a conta Auth antiga ainda
      // não foi removida. A senha informada precisa pertencer à própria conta.
      try {
        const credential = await signInWithEmailAndPassword(secondaryAuth, input.email, input.password);
        createdUser = credential.user;
      } catch (signInError: unknown) {
        const signInErrorCode =
          signInError && typeof signInError === 'object' && 'code' in signInError
            ? String((signInError as { code?: unknown }).code || '')
            : '';
        if (signInErrorCode === 'auth/invalid-credential') {
          throw new Error(
            'Este e-mail já existe no Firebase Authentication, mas a senha informada não corresponde. Use a redefinição de senha antes de recriar este acesso.'
          );
        }
        throw signInError;
      }
    }

    if (!createdUser) throw new Error('O Firebase Authentication não retornou o usuário criado.');
    await updateProfile(createdUser, { displayName: input.displayName });

    const normalizedRole = normalizedAccessRole(input.role);
    const isMaster = ['MASTER', 'MASTER_ADMIN'].includes(normalizedRole);
    const isDeveloper = ['DEVELOPER_ADMIN', 'DEVELOPER', 'DESENVOLVEDOR'].includes(normalizedRole);
    const isPlatformUser = isMaster || isDeveloper;
    const uid = createdUser.uid;
    const now = new Date().toISOString();
    const empresaId = isPlatformUser ? null : input.companyId;
    const profile = {
      uid,
      email: input.email,
      nome: input.displayName,
      displayName: input.displayName,
      role: isMaster ? 'MASTER' : isDeveloper ? 'DEVELOPER_ADMIN' : input.role,
      perfil: isMaster ? 'MASTER' : isDeveloper ? 'DEVELOPER_ADMIN' : input.role,
      tipoUsuario: isMaster ? 'MASTER' : isDeveloper ? 'DEVELOPER' : (input.tipoUsuario || 'EMPRESA'),
      ativo: ['ATIVO', 'ATIVA'].includes(normalizedAccessRole(input.status)),
      status: input.status,
      empresaId,
      companyId: empresaId,
      companyName: isPlatformUser ? '' : input.companyName,
      colaboradorId: isPlatformUser ? null : (input.colaboradorId || null),
      permissions: input.permissions,
      permissoes: input.permissions,
      modules: input.modules || {},
      modulos: input.modules || {},
      createdAt: now,
      updatedAt: now,
      createdBy: auth.currentUser?.uid || 'MASTER',
      updatedBy: auth.currentUser?.uid || 'MASTER',
    };

    const batch = writeBatch(db);
    batch.set(doc(db, 'usuarios', uid), profile, { merge: true });
    batch.set(doc(db, 'users', uid), profile, { merge: true });
    await batch.commit();

    // `usuarios` é o documento oficial. `users` é espelho de compatibilidade.
    const usuarioSnapshot = await getDoc(doc(db, 'usuarios', uid));
    if (!usuarioSnapshot.exists()) {
      throw new Error('A conta foi criada, mas o perfil oficial em usuarios não pôde ser confirmado.');
    }
    const savedCompanyId = String(usuarioSnapshot.data()?.empresaId || usuarioSnapshot.data()?.companyId || '').trim();
    if (!isPlatformUser && savedCompanyId !== input.companyId) {
      throw new Error('A conta foi criada, mas o vínculo com a empresa ficou inválido.');
    }
    return uid;
  } catch (error) {
    if (createdUser && createdNewAuthUser) {
      try {
        await deleteUser(createdUser);
      } catch (rollbackError) {
        const originalMessage = error instanceof Error ? error.message : String(error);
        const rollbackMessage = rollbackError instanceof Error ? rollbackError.message : String(rollbackError);
        throw new Error(`Falha ao criar o perfil do administrador: ${originalMessage}. A reversão da conta também falhou: ${rollbackMessage}`);
      }
    }
    throw error;
  } finally {
    await signOut(secondaryAuth).catch(() => undefined);
    await deleteApp(secondaryApp).catch(() => undefined);
  }
}

export class UserService {
  static async create(userData: Partial<UserProfile> & { password?: string; allowClientSideFallback?: boolean }): Promise<UserProfile> {
    const email = userData.email?.trim().toLowerCase();
    const displayName = userData.displayName?.trim();
    const role = userData.role || 'Colaborador';
    const companyId = userData.companyId?.trim();
    const normalizedRole = normalizedAccessRole(role);
    const isMaster = ['MASTER', 'MASTER_ADMIN'].includes(normalizedRole);
    const isDeveloper = ['DEVELOPER_ADMIN', 'DEVELOPER', 'DESENVOLVEDOR'].includes(normalizedRole);
    const isPlatformUser = isMaster || isDeveloper;
    const status = userData.status || 'Ativo';
    const provisionedPermissions = buildProvisionedPermissions(
      role,
      userData.permissions || [],
      userData.modules || {},
      userData.tipoUsuario || ''
    );
    const isAtivo = ['ATIVO', 'ATIVA'].includes(normalizedAccessRole(status));
    if (!email || !displayName || (!isPlatformUser && !companyId)) {
      throw new Error('Nome, e-mail e empresa válida são obrigatórios para criar um usuário comum.');
    }
    if (!userData.password || userData.password.length < 6) {
      throw new Error('Informe uma senha temporária com pelo menos 6 caracteres.');
    }

    const companyName = isPlatformUser ? '' : await resolveCompanyName(companyId!);

    let uid: string;
    try {
      const resData = await authorizedRequest('/api/users/create', {
        method: 'POST',
        body: JSON.stringify({
          email,
          password: userData.password,
          nome: displayName,
          role,
          empresaId: isPlatformUser ? null : companyId,
          companyName,
          ativo: isAtivo,
          permissions: provisionedPermissions,
          modules: userData.modules || {},
          colaboradorId: userData.colaboradorId,
        })
      });
      if (!resData.uid) throw new Error('A API não retornou o UID do usuário criado.');
      uid = resData.uid;
    } catch (err: any) {
      if (!canUseClientFirebaseFallback(err, [404, 501])) {
        console.error('Erro ao chamar API de criação de usuário:', err);
        throw err;
      }

      if (userData.allowClientSideFallback === false) {
        throw new Error('O serviço autorizado de criação de acesso não está disponível. O acesso deverá ser criado posteriormente.');
      }

      // Sites pode publicar apenas o SPA. A segunda instância do Firebase cria o
      // Auth sem derrubar a sessão MASTER e os perfis continuam protegidos pelas rules.
      uid = await createUserWithSecondaryFirebaseApp({
        email,
        password: userData.password,
        displayName,
        role,
        companyId: isPlatformUser ? '' : companyId!,
        companyName,
        status,
        permissions: provisionedPermissions,
        modules: userData.modules || {},
        tipoUsuario: userData.tipoUsuario,
        colaboradorId: userData.colaboradorId,
      });
    }

    const finalUid = uid;
    const currentUser = auth.currentUser;
    const now = new Date().toISOString();

    const profile: UserProfile = {
      uid: finalUid,
      email,
      displayName,
      role,
      companyId: isPlatformUser ? '' : companyId!,
      colaboradorId: userData.colaboradorId,
      tipoUsuario: isDeveloper ? 'DEVELOPER' : userData.tipoUsuario || 'EMPRESA',
      status,
      permissions: provisionedPermissions,
      modules: userData.modules || {},
      createdBy: currentUser?.uid || 'system',
      createdAt: userData.createdAt || now,
      updatedAt: now
    };

    await safeAudit({
      action: 'CREATE',
      description: `Usuário ${profile.displayName} (${profile.email}) criado`,
      moduleName: 'Configurações',
      targetEntity: 'Usuário',
      companyId: profile.companyId
    }, 'Criação do usuário');

    return profile;
  }

  static async update(uid: string, data: Partial<UserProfile>): Promise<void> {
    const current = await this.getById(uid);
    if (!current) throw new Error('Usuário não encontrado.');
    const role = String(data.role || current.role || '').trim();
    const normalizedRole = normalizedAccessRole(role);
    const isMaster = normalizedRole === 'MASTER' || normalizedRole === 'MASTER_ADMIN';
    const isDeveloper = ['DEVELOPER_ADMIN', 'DEVELOPER', 'DESENVOLVEDOR'].includes(normalizedRole);
    const isPlatformUser = isMaster || isDeveloper;
    const currentIsMaster = ['MASTER', 'MASTER_ADMIN'].includes(normalizedAccessRole(current.role));
    const requestedStatus = normalizedAccessRole(data.status ?? current.status);
    if (currentIsMaster && ['INATIVO', 'BLOQUEADO', 'SUSPENSO', 'DESATIVADO'].includes(requestedStatus)) {
      throw new Error('O acesso MASTER é protegido e não pode ser bloqueado ou desativado.');
    }
    if (isMaster !== currentIsMaster) {
      throw new Error('A promoção ou remoção do perfil master_admin exige backend administrativo seguro.');
    }
    const companyId = String(data.companyId ?? current.companyId ?? '').trim();
    const companyName = isPlatformUser ? '' : await resolveCompanyName(companyId);
    const modules = data.modules || current.modules || {};
    const permissions = buildProvisionedPermissions(
      role,
      data.permissions || current.permissions || [],
      modules,
      data.tipoUsuario || current.tipoUsuario || ''
    );

    try {
      await authorizedRequest(`/api/users/${encodeURIComponent(uid)}`, {
        method: 'PATCH',
        body: JSON.stringify({ ...data, role, companyId: isPlatformUser ? null : companyId, companyName, modules, permissions }),
      });
    } catch (requestError: any) {
      if (!canUseClientFirebaseFallback(requestError, [404, 405, 501])) throw requestError;

      const now = new Date().toISOString();
      const status = String(data.status || current.status || 'Ativo');
      const profilePatch = {
        ...data,
        role,
        empresaId: isPlatformUser ? null : companyId,
        companyId: isPlatformUser ? null : companyId,
        companyName,
        permissions,
        permissoes: permissions,
        modules,
        modulos: modules,
        ativo: !['INATIVO', 'BLOQUEADO', 'SUSPENSO', 'DESATIVADO'].includes(normalizedAccessRole(status)),
        status,
        updatedAt: now,
        updatedBy: auth.currentUser?.uid || 'system',
      };
      const batch = writeBatch(db);
      batch.set(doc(db, 'usuarios', uid), profilePatch, { merge: true });
      batch.set(doc(db, 'users', uid), profilePatch, { merge: true });
      await batch.commit();
    }

    await safeAudit({
      action: 'UPDATE',
      description: `Perfil do usuário ${uid} atualizado`,
      moduleName: 'Configurações',
      targetEntity: 'Usuário',
      companyId: isPlatformUser ? undefined : companyId,
    }, 'Atualização do usuário');
  }

  static async delete(uid: string): Promise<void> {
    const current = await this.getById(uid);
    if (isProtectedMasterProfile(current)) {
      throw new Error('O acesso MASTER é protegido e não pode ser excluído.');
    }
    await authorizedRequest(`/api/users/${encodeURIComponent(uid)}`, { method: 'DELETE' });
    await safeAudit({
      action: 'DELETE',
      description: `Usuário ${uid} excluído`,
      moduleName: 'Configurações',
      targetEntity: 'Usuário'
    }, 'Exclusão do usuário');
  }

  static async getById(uid: string): Promise<UserProfile | null> {
    try {
      const snap = await getDoc(doc(db, COLLECTION_NAME, uid));
      if (snap.exists()) {
        return normalizeProfile(snap.id, snap.data() as RawUserProfile);
      }
    } catch (err) {
      console.warn('Erro em UserService.getById:', err);
    }
    return null;
  }

  static async get(uid: string): Promise<UserProfile | null> {
    return this.getById(uid);
  }

  static async list(companyId?: string): Promise<UserProfile[]> {
    try {
      const q = companyId
        ? query(collection(db, COLLECTION_NAME), where('empresaId', '==', companyId))
        : collection(db, COLLECTION_NAME);
      const snap = await getDocs(q);
      if (!snap.empty) {
        const list: UserProfile[] = [];
        snap.forEach(d => list.push(normalizeProfile(d.id, d.data() as RawUserProfile)));
        return companyId ? list.filter(user => !isProtectedMasterProfile(user)) : list;
      }
    } catch (err) {
      console.warn('Erro em UserService.list:', err);
    }
    return [];
  }

  static async search(term: string, companyId?: string): Promise<UserProfile[]> {
    const all = await this.list(companyId);
    const lower = term.toLowerCase();
    return all.filter(u =>
      u.displayName.toLowerCase().includes(lower) ||
      u.email.toLowerCase().includes(lower) ||
      u.role.toLowerCase().includes(lower)
    );
  }

  static async count(companyId?: string): Promise<number> {
    const all = await this.list(companyId);
    return all.length;
  }

  static async paginate(page: number, pageSize: number, companyId?: string): Promise<{ items: UserProfile[]; total: number }> {
    const all = await this.list(companyId);
    const start = (page - 1) * pageSize;
    return {
      items: all.slice(start, start + pageSize),
      total: all.length
    };
  }
}
