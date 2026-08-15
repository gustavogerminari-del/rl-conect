import { auth } from '../lib/firebase';
import { fetchUsuarioFirestore } from '../lib/firestoreServices';
import { isMasterProfile, normalizeRole } from './profile';

export interface MasterValidationResult {
  autorizado: boolean;
  motivo: string | null;
  uid?: string | null;
  email?: string | null;
  role?: string | null;
  ativo?: boolean | null;
  isMaster?: boolean | null;
}

export async function validarAcessoMaster(): Promise<MasterValidationResult> {
  if (typeof (auth as any).authStateReady === 'function') await (auth as any).authStateReady();
  const firebaseUser = auth.currentUser;
  if (!firebaseUser) {
    return { autorizado: false, motivo: 'Acesso negado: usuário não autenticado no Firebase.', uid: null, email: null, role: null, ativo: false, isMaster: false };
  }

  const profile = await fetchUsuarioFirestore(firebaseUser.uid);
  const active = Boolean(profile && profile.ativo !== false && !['INATIVO', 'BLOQUEADO'].includes(normalizeRole(profile.status)));
  const master = Boolean(profile && isMasterProfile(profile));
  const autorizado = active && master;
  return {
    autorizado,
    motivo: autorizado ? null : 'Acesso negado: o perfil autenticado não possui role master_admin ativa.',
    uid: firebaseUser.uid,
    email: firebaseUser.email,
    role: profile?.role || profile?.tipoUsuario || null,
    ativo: active,
    isMaster: master,
  };
}
