/** Firebase Auth is the only source of truth for the active session. */
import React, { createContext, useContext, useEffect, useState } from 'react';
import { FirebaseError } from 'firebase/app';
import { doc, setDoc } from 'firebase/firestore';
import {
  browserLocalPersistence,
  onAuthStateChanged,
  sendPasswordResetEmail,
  setPersistence,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth';
import { RoleProfile, ScreenRouteKey, SessionToken, SystemActionKey, UserProfile } from '../types/auth';
import { logger } from '../../core';
import { fetchEmpresaAccessRecord, fetchEmpresaModulosFirestore, fetchUsuarioFirestore } from '../../lib/firestoreServices';
import { auth, db } from '../../lib/firebase';
import { PermissionService } from '../../services/PermissionService';
import { buildProvisionedPermissions } from '../../services/provisionedPermissions';
import { getCompanyId, isDeveloperProfile, isMasterProfile, toUserProfile } from '../profile';
import { isTrialCompanyRecord, normalizeModuleEntitlements } from '../../services/AccessPolicyService';

export interface AuthContextType {
  user: UserProfile | null;
  sessionToken: SessionToken | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  activeModules: Record<string, boolean>;
  isTrial: boolean;
  userPermissions: Record<string, boolean> | string[];
  login: (email: string, password?: string) => Promise<boolean>;
  logout: () => Promise<void>;
  switchDemoProfile: (role: RoleProfile) => void;
  requestPasswordReset: (email: string) => Promise<boolean>;
  hasScreenAccess: (screenKey: ScreenRouteKey) => boolean;
  hasActionAccess: (actionKey: SystemActionKey) => boolean;
  isModuleActive: (moduleKey: string) => boolean;
  refreshCompanyModules: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const normalizeModules = (raw: unknown): Record<string, boolean> => {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const source = raw as Record<string, unknown>;
  const possibleMap =
    (source.modules && typeof source.modules === 'object' ? source.modules : null) ||
    (source.modulos && typeof source.modulos === 'object' ? source.modulos : null) || source;
  return Object.entries(possibleMap as Record<string, unknown>).reduce<Record<string, boolean>>((acc, [key, value]) => {
    if (typeof value === 'boolean') acc[key] = value;
    return acc;
  }, {});
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [sessionToken, setSessionToken] = useState<SessionToken | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeModules, setActiveModules] = useState<Record<string, boolean>>({});
  const [isTrial, setIsTrial] = useState(false);
  const userPermissions = user?.permissions || {};

  const clearAuthData = () => {
    setUser(null);
    setSessionToken(null);
    setActiveModules({});
    setIsTrial(false);
  };

  const loadFirebaseProfile = async (firebaseUser: typeof auth.currentUser extends infer T ? NonNullable<T> : never) => {
    const raw = await fetchUsuarioFirestore(firebaseUser.uid);
    if (!raw) throw new Error('Perfil do usuário não encontrado no Firestore. Contate o administrador.');
    if (isMasterProfile(raw)) {
      const protectedMasterProfile = {
        role: 'MASTER',
        tipoUsuario: 'MASTER',
        ativo: true,
        status: 'ATIVO',
        empresaId: null,
        companyId: null,
        companyName: '',
        updatedAt: new Date().toISOString(),
        updatedBy: firebaseUser.uid,
      };
      // Mantém as duas coleções legadas sincronizadas. A falha de reparação não
      // encerra a sessão: a identidade MASTER válida continua protegida.
      await Promise.all([
        setDoc(doc(db, 'usuarios', firebaseUser.uid), protectedMasterProfile, { merge: true }),
        setDoc(doc(db, 'users', firebaseUser.uid), protectedMasterProfile, { merge: true }),
      ]).catch(error => logger.warn('[Auth] Perfil MASTER autenticado; sincronização de proteção pendente.', error));
      return toUserProfile(firebaseUser.uid, { ...raw, ...protectedMasterProfile }, firebaseUser);
    }
    return toUserProfile(firebaseUser.uid, raw, firebaseUser);
  };

  const loadModules = async (profile: UserProfile): Promise<Record<string, boolean>> => {
    if (isMasterProfile(profile) || isDeveloperProfile(profile)) {
      setActiveModules({});
      setIsTrial(false);
      return {};
    }
    const companyId = getCompanyId(profile);
    if (!companyId) throw new Error('Perfil sem empresa vinculada.');
    const [rawModules, companyRecord] = await Promise.all([
      fetchEmpresaModulosFirestore(companyId),
      fetchEmpresaAccessRecord(companyId),
    ]);
    const normalizedModules = normalizeModuleEntitlements(normalizeModules(rawModules));
    setActiveModules(normalizedModules);
    setIsTrial(isTrialCompanyRecord(companyRecord));
    return normalizedModules;
  };

  const repairMasterProvisionedHeadhunterAccess = async (
    profile: UserProfile,
    companyModules: Record<string, boolean>
  ): Promise<UserProfile> => {
    if (isMasterProfile(profile) || isDeveloperProfile(profile)) return profile;
    const currentPermissions = Array.isArray(profile.permissions)
      ? profile.permissions
      : Object.entries(profile.permissions || {}).filter(([, enabled]) => enabled).map(([key]) => key);
    const repairedPermissions = buildProvisionedPermissions(
      profile.role,
      currentPermissions,
      profile.modules || {},
      profile.tipoUsuario || '',
    );
    if (repairedPermissions.length === currentPermissions.length &&
        repairedPermissions.every(permission => currentPermissions.includes(permission))) {
      return profile;
    }

    try {
      await setDoc(doc(db, 'usuarios', profile.id), {
        permissions: repairedPermissions,
        permissoes: repairedPermissions,
        updatedAt: new Date().toISOString(),
      }, { merge: true });
    } catch (error) {
      logger.error('[Auth] Não foi possível reparar as permissões do acesso criado pelo Painel Master.', 'AUTH', {
        uid: profile.id,
        empresaId: getCompanyId(profile),
        code: error instanceof FirebaseError ? error.code : 'firestore/unknown',
      });
    }
    return { ...profile, permissions: repairedPermissions };
  };

  const establishFirebaseSession = async (
    firebaseUser: typeof auth.currentUser extends infer T ? NonNullable<T> : never
  ): Promise<UserProfile> => {
    const loadedProfile = await loadFirebaseProfile(firebaseUser);
    const idToken = await firebaseUser.getIdToken();
    setSessionToken({ token: idToken, createdAt: new Date().toISOString(), expiresAt: '' });
    const companyModules = await loadModules(loadedProfile);
    const profile = await repairMasterProvisionedHeadhunterAccess(loadedProfile, companyModules);
    setUser(profile);
    return profile;
  };

  useEffect(() => {
    setPersistence(auth, browserLocalPersistence).catch(error => {
      logger.error('[Auth] Não foi possível configurar a persistência oficial do Firebase.', error);
    });

    const unsubscribe = onAuthStateChanged(auth, async firebaseUser => {
      setIsLoading(true);
      if (!firebaseUser) {
        clearAuthData();
        setIsLoading(false);
        return;
      }

      try {
        await establishFirebaseSession(firebaseUser);
      } catch (error) {
        logger.error('[Auth] Sessão recusada por perfil inválido.', 'AUTH', {
          message: error instanceof Error ? error.message : String(error),
        });
        clearAuthData();
        await signOut(auth).catch(() => undefined);
      } finally {
        setIsLoading(false);
      }
    });
    return unsubscribe;
  }, []);

  const refreshCompanyModules = async () => {
    if (!auth.currentUser || !user) return;
    await loadModules(user);
  };

  useEffect(() => {
    const handleModuleUpdate = () => void refreshCompanyModules();
    window.addEventListener('company_modules_updated', handleModuleUpdate);
    return () => window.removeEventListener('company_modules_updated', handleModuleUpdate);
  }, [user]);

  const login = async (email: string, password?: string): Promise<boolean> => {
    if (!password) return false;
    setIsLoading(true);
    try {
      await setPersistence(auth, browserLocalPersistence);
      const credential = await signInWithEmailAndPassword(auth, email.trim().toLowerCase(), password);
      // O login só retorna sucesso depois que o perfil do Firestore foi validado
      // e aplicado. Isso impede a tela de login de ficar parada silenciosamente.
      await establishFirebaseSession(credential.user);
      return true;
    } catch (error) {
      const errorCode = error instanceof FirebaseError ? error.code : 'auth/unknown';
      logger.error('[Auth] Falha no login Firebase.', 'AUTH', {
        code: errorCode,
        projectId: auth.app.options.projectId,
        authDomain: auth.app.options.authDomain,
      });
      clearAuthData();
      await signOut(auth).catch(() => undefined);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    await signOut(auth);
    clearAuthData();
  };

  const switchDemoProfile = (_role: RoleProfile) => {
    logger.warn('[Auth] Troca local de perfil desativada: permissões vêm do Firestore.');
  };

  const requestPasswordReset = async (email: string) => {
    await sendPasswordResetEmail(auth, email.trim().toLowerCase());
    return true;
  };

  const isModuleActive = (moduleKey: string) => {
    if (!user) return false;
    return PermissionService.checkAccess(moduleKey, {
      userRole: user.role,
      isMaster: isMasterProfile(user),
      companyModules: activeModules,
      userPermissions,
      userId: user.id,
      companyId: getCompanyId(user) || undefined,
      isTrial,
    }).allowed;
  };

  const hasScreenAccess = (screenKey: ScreenRouteKey) => {
    if (!user) return false;
    if (screenKey === 'acesso-master' || screenKey.startsWith('master-') || screenKey === 'auditoria') {
      return isMasterProfile(user);
    }
    if (screenKey === 'dashboard' || screenKey === 'configuracoes' || screenKey === 'empresa') return true;
    return isModuleActive(screenKey);
  };

  const hasActionAccess = (actionKey: SystemActionKey) =>
    Boolean(user) && (isMasterProfile(user) || isModuleActive(actionKey));

  return <AuthContext.Provider value={{
    user,
    sessionToken,
    isAuthenticated: Boolean(auth.currentUser && user),
    isLoading,
    activeModules,
    isTrial,
    userPermissions,
    login,
    logout,
    switchDemoProfile,
    requestPasswordReset,
    hasScreenAccess,
    hasActionAccess,
    isModuleActive,
    refreshCompanyModules,
  }}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth deve ser usado dentro de um AuthProvider');
  return context;
};
