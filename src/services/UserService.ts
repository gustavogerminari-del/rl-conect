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
  sendPasswordResetEmail,
  signOut,
  updateProfile,
} from 'firebase/auth';
import { db, auth } from '../lib/firebase';
import { firebaseConfig } from './firebaseConfig';
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
  tipoUsuario?: 'MASTER' | 'ADMIN_EMPRESA' | 'EMPRESA' | 'CANDIDATO' | 'FUNCIONARIO';
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

async function findExistingUserByEmail(email: string): Promise<UserProfile | null> {
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail) return null;
  const snap = await getDocs(query(collection(db, COLLECTION_NAME), where('email', '==', normalizedEmail)));
  const first = snap.docs[0];
  return first ? normalizeProfile(first.id, first.data() as RawUserProfile) : null;
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
  const secondaryApp = initializeApp(firebaseConfig, appName);
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
      if (createErrorCode === 'auth/email-already-in-use') {
        throw new Error(
          'Este e-mail já existe no Firebase Authentication. A senha atual do cliente nunca deve ser solicitada. Use “Editar acesso” para alterar empresa, perfil e permissões, ou “Enviar redefinição de senha” para o cliente criar uma nova senha.'
        );
      }
      throw createError;
    }

    if (!createdUser) throw new Error('O Firebase Authentication não retornou o usuário criado.');
    await updateProfile(createdUser, { displayName: input.displayName });

    const isMaster = input.role.trim().toUpperCase() === 'MASTER';
    const uid = createdUser.uid;
    const now = new Date().toISOString();
    const empresaId = isMaster ? null : input.companyId;
    const profile = {
      uid,
      email: input.email,
      nome: input.displayName,
      displayName: input.displayName,
      role: isMaster ? 'MASTER' : input.role,
      perfil: isMaster ? 'MASTER' : input.role,
      tipoUsuario: isMaster ? 'MASTER' : (input.tipoUsuario || 'EMPRESA'),
      ativo: input.status === 'Ativo' || input.status === 'ATIVO',
      status: input.status,
      empresaId,
      companyId: empresaId,
      companyName: isMaster ? '' : input.companyName,
      colaboradorId: isMaster ? null : (input.colaboradorId || null),
      permissions: input.permissions,
      modules: input.modules || {},
      createdAt: now,
      updatedAt: now,
      createdBy: auth.currentUser?.uid || 'MASTER',
    };

    const batch = writeBatch(db);
    batch.set(doc(db, 'usuarios', uid), profile, { merge: true });
    batch.set(doc(db, 'users', uid), profile, { merge: true });
    await batch.commit();

    const [usuarioSnapshot, userSnapshot] = await Promise.all([
      getDoc(doc(db, 'usuarios', uid)),
      getDoc(doc(db, 'users', uid)),
    ]);
    if (!usuarioSnapshot.exists() || !userSnapshot.exists()) {
      throw new Error('A conta foi criada, mas o vínculo completo do perfil não pôde ser confirmado.');
    }

    const savedCompanyId = String(
      usuarioSnapshot.data()?.empresaId || usuarioSnapshot.data()?.companyId || ''
    ).trim();
    if (!isMaster && savedCompanyId !== input.companyId) {
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
    const isMaster = ['MASTER', 'MASTER_ADMIN'].includes(normalizedAccessRole(role));
    const status = userData.status || 'Ativo';
    const provisionedPermissions = buildProvisionedPermissions(
      role,
      userData.permissions || [],
      userData.modules || {},
      userData.tipoUsuario || ''
    );
    const isAtivo = status === 'Ativo';
    if (!email || !displayName || (!isMaster && !companyId)) {
      throw new Error('Nome, e-mail e empresa válida são obrigatórios para criar um usuário comum.');
    }

    // Se o perfil já existe no Firestore, isso é uma edição de acesso — não uma
    // nova conta. Nunca peça a senha atual do cliente para atualizar permissões,
    // empresa, perfil, nome ou status.
    const existingUser = await findExistingUserByEmail(email);
    if (existingUser) {
      await this.update(existingUser.uid, {
        displayName,
        role,
        companyId: isMaster ? '' : companyId!,
        status,
        permissions: provisionedPermissions,
        modules: userData.modules || existingUser.modules || {},
        tipoUsuario: userData.tipoUsuario || existingUser.tipoUsuario,
        colaboradorId: userData.colaboradorId ?? existingUser.colaboradorId,
      });
      return (await this.getById(existingUser.uid)) || {
        ...existingUser,
        displayName,
        role,
        companyId: isMaster ? '' : companyId!,
        status,
        permissions: provisionedPermissions,
        modules: userData.modules || existingUser.modules || {},
        updatedAt: new Date().toISOString(),
      };
    }

    // Senha temporária é exigida apenas para uma conta realmente nova.
    if (!userData.password || userData.password.length < 6) {
      throw new Error('Informe uma senha temporária com pelo menos 6 caracteres para criar um novo acesso.');
    }

    const companyName = isMaster ? '' : await resolveCompanyName(companyId!);

    let uid: string;
    try {
      const resData = await authorizedRequest('/api/users/create', {
        method: 'POST',
        body: JSON.stringify({
          email,
          password: userData.password,
          nome: displayName,
          role,
          empresaId: isMaster ? null : companyId,
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
      const statusCode = Number(err?.status);
      const message = String(err?.message || '');
      const shouldUseIsolatedFirebase =
        [404, 501].includes(statusCode) ||
        /provisionamento administrativo|not found|HTTP\s*(404|501)/i.test(message);

      if (!shouldUseIsolatedFirebase) {
        console.error('Erro ao chamar API de criação de usuário:', err);
        throw err;
      }

      if (userData.allowClientSideFallback === false) {
        throw new Error('O serviço autorizado de criação de acesso não está disponível. O acesso deverá ser criado posteriormente.');
      }

      // Sites publica o cliente sem o servidor Express. Uma segunda instância
      // do Firebase Auth cria uma NOVA conta sem derrubar a sessão MASTER. Ela
      // nunca é usada para descobrir ou validar a senha de uma conta existente.
      uid = await createUserWithSecondaryFirebaseApp({
        email,
        password: userData.password,
        displayName,
        role,
        companyId: isMaster ? '' : companyId!,
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
      companyId: isMaster ? '' : companyId!,
      colaboradorId: userData.colaboradorId,
      tipoUsuario: userData.tipoUsuario || 'EMPRESA',
      status,
      permissions: provisionedPermissions,
      modules: userData.modules || {},
      createdBy: currentUser?.uid || 'system',
      createdAt: userData.createdAt || now,
      updatedAt: now
    };

    try {
      await AuditService.log({
        action: 'CREATE',
        description: `Usuário ${profile.displayName} (${profile.email}) criado`,
        moduleName: 'Configurações',
        targetEntity: 'Usuário',
        companyId: profile.companyId
      });
    } catch (err) {
      console.warn('Usuário criado, mas o log de auditoria não pôde ser registrado:', err);
    }

    return profile;
  }

  static async update(uid: string, data: Partial<UserProfile>): Promise<void> {
    try {
      const current = await this.getById(uid);
      if (!current) throw new Error('Usuário não encontrado.');

      // E-mail é a identidade de login do Firebase. Sem uma rota Admin segura,
      // alterá-lo só no Firestore quebraria o login. A edição comum não toca nele.
      if (data.email && data.email.trim().toLowerCase() !== current.email) {
        throw new Error('A alteração do e-mail de login exige um fluxo administrativo seguro do Firebase. Os demais dados podem ser alterados sem a senha do cliente.');
      }

      const role = String(data.role || current.role || '').trim();
      const normalizedRole = role.toUpperCase().replace(/[\s-]+/g, '_');
      const isMaster = normalizedRole === 'MASTER' || normalizedRole === 'MASTER_ADMIN';
      const currentIsMaster = ['MASTER', 'MASTER_ADMIN'].includes(String(current.role || '').toUpperCase().replace(/[\s-]+/g, '_'));
      const requestedStatus = normalizedAccessRole(data.status ?? current.status);
      if (currentIsMaster && ['INATIVO', 'BLOQUEADO', 'SUSPENSO', 'DESATIVADO'].includes(requestedStatus)) {
        throw new Error('O acesso MASTER é protegido e não pode ser bloqueado ou desativado.');
      }
      if (isMaster !== currentIsMaster) {
        throw new Error('A promoção ou remoção do perfil master_admin exige backend administrativo seguro.');
      }
      const companyId = String(data.companyId ?? current.companyId ?? '').trim();
      const companyName = isMaster ? '' : await resolveCompanyName(companyId);
      const safeData = { ...data } as Partial<UserProfile> & Record<string, unknown>;
      delete safeData.email;
      delete safeData.password;

      try {
        await authorizedRequest(`/api/users/${encodeURIComponent(uid)}`, {
          method: 'PATCH',
          body: JSON.stringify({ ...safeData, role, companyId: isMaster ? null : companyId, companyName }),
        });
      } catch (requestError: any) {
        const statusCode = Number(requestError?.status);
        const message = String(requestError?.message || '');
        const canUseFirestoreFallback = [404, 405, 501].includes(statusCode) || /not found|HTTP\s*(404|405|501)/i.test(message);
        if (!canUseFirestoreFallback) throw requestError;

        const now = new Date().toISOString();
        const status = String(data.status || current.status || 'Ativo');
        const profilePatch = {
          ...safeData,
          role,
          nome: String(data.displayName ?? current.displayName),
          displayName: String(data.displayName ?? current.displayName),
          empresaId: isMaster ? null : companyId,
          companyId: isMaster ? null : companyId,
          companyName,
          ativo: !['INATIVO', 'BLOQUEADO'].includes(status.toUpperCase()),
          status,
          updatedAt: now,
          updatedBy: auth.currentUser?.uid || 'system',
        };
        const batch = writeBatch(db);
        batch.set(doc(db, 'usuarios', uid), profilePatch, { merge: true });
        batch.set(doc(db, 'users', uid), profilePatch, { merge: true });
        await batch.commit();
      }

      await AuditService.log({
        action: 'UPDATE',
        description: `Perfil do usuário ${uid} atualizado sem acesso à senha do cliente`,
        moduleName: 'Configurações',
        targetEntity: 'Usuário',
        companyId: isMaster ? '' : companyId
      });
    } catch (err) {
      console.error('Erro ao atualizar usuário no Firestore:', err);
      throw err;
    }
  }

  static async sendPasswordReset(email: string): Promise<void> {
    const normalizedEmail = String(email || '').trim().toLowerCase();
    if (!normalizedEmail) throw new Error('O usuário não possui e-mail válido para redefinição de senha.');

    try {
      await sendPasswordResetEmail(auth, normalizedEmail);
      await AuditService.log({
        action: 'UPDATE',
        description: `E-mail de redefinição de senha solicitado para ${normalizedEmail}`,
        moduleName: 'Configurações',
        targetEntity: 'Usuário'
      }).catch(() => undefined);
    } catch (error) {
      console.error('Erro ao enviar redefinição de senha:', error);
      throw new Error('Não foi possível enviar o e-mail de redefinição de senha. Verifique o e-mail do usuário e a configuração do Firebase Authentication.');
    }
  }

  static async delete(uid: string): Promise<void> {
    try {
      const current = await this.getById(uid);
      if (isProtectedMasterProfile(current)) {
        throw new Error('O acesso MASTER é protegido e não pode ser excluído.');
      }
      await authorizedRequest(`/api/users/${encodeURIComponent(uid)}`, { method: 'DELETE' });
      await AuditService.log({
        action: 'DELETE',
        description: `Usuário ${uid} excluído`,
        moduleName: 'Configurações',
        targetEntity: 'Usuário'
      });
    } catch (err) {
      console.error('Erro ao excluir usuário no Firestore:', err);
      throw err;
    }
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
        // Consultas de uma empresa jamais recebem identidades da plataforma,
        // mesmo que um documento MASTER tenha sido vinculado por engano.
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
