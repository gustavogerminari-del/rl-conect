import { FirebaseError } from 'firebase/app';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut, type User } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { tenantIdFrom } from '../lib/tenant';

export type FirebaseRlSession = { firebaseUser: User; profile: Record<string, any>; companyId: string; role: string };
export function normalizeRlRole(value: unknown): string {
  const v = String(value || '').trim().toUpperCase();
  if (['MASTER','MASTER_ADMIN','SUPER_ADMINISTRADOR','SUPER ADMINISTRADOR'].includes(v)) return 'master_admin';
  if (['ADMIN_EMPRESA','EMPRESA_ADMIN','ADMINISTRADOR_EMPRESA','ADMINISTRADOR DA EMPRESA','ADMIN'].includes(v)) return 'empresa_admin';
  if (v.includes('HEADHUNTER')) return 'headhunter';
  if (v.includes('RECRUT')) return 'recrutador';
  if (v === 'GESTOR') return 'gestor';
  if (v === 'CANDIDATO') return 'candidato';
  return String(value || 'empresa_admin').toLowerCase();
}
async function profileFor(user: User) {
  const primary = await getDoc(doc(db, 'usuarios', user.uid));
  if (!primary.exists()) throw new Error('Perfil não encontrado no Firestore. Google nunca cria acesso ao RL Connect.');
  const raw = primary.data();
  const companyId = tenantIdFrom(raw);
  const role = normalizeRlRole(raw.role || raw.tipoUsuario);
  if (role !== 'master_admin' && !companyId) throw new Error('Perfil sem empresa vinculada.');
  if (raw.ativo === false || ['inativo','bloqueado'].includes(String(raw.status || '').toLowerCase())) throw new Error('Usuário inativo ou bloqueado.');
  return { ...raw, id: user.uid, email: raw.email || user.email || '', empresa_id: companyId, empresaId: companyId, companyId, role };
}
class FirebaseSessionService {
  subscribe(listener: (session: FirebaseRlSession | null, error?: string) => void) {
    return onAuthStateChanged(auth, async user => {
      if (!user) { listener(null); return; }
      try {
        const profile = await profileFor(user);
        listener({ firebaseUser: user, profile, companyId: profile.empresa_id, role: profile.role });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        await signOut(auth).catch(() => undefined);
        listener(null, message);
      }
    });
  }
  async login(email: string, password: string) {
    try {
      const result = await signInWithEmailAndPassword(auth, email.trim().toLowerCase(), password);
      await profileFor(result.user);
      return true;
    } catch (error) {
      if (error instanceof FirebaseError && ['auth/invalid-credential','auth/wrong-password','auth/user-not-found'].includes(error.code)) throw new Error('E-mail ou senha inválidos.');
      throw error;
    }
  }
  async logout() { await signOut(auth); }
  async idToken() { return auth.currentUser ? auth.currentUser.getIdToken() : null; }
}
export const firebaseSessionService = new FirebaseSessionService();
