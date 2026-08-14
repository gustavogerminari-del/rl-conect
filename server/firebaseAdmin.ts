import { applicationDefault, cert, getApps, initializeApp, type App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

const EXPECTED_PROJECT_ID = 'rl-connect-ed797';

function resolveCredential() {
  const raw = String(process.env.FIREBASE_SERVICE_ACCOUNT_JSON || '').trim();
  if (!raw) return applicationDefault();
  let parsed: Record<string, any>;
  try { parsed = JSON.parse(raw); } catch { throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON inválida.'); }
  if (!parsed.project_id || !parsed.client_email || !parsed.private_key) throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON incompleta.');
  if (parsed.project_id !== EXPECTED_PROJECT_ID) throw new Error(`Service Account pertence a ${parsed.project_id}, esperado ${EXPECTED_PROJECT_ID}.`);
  return cert(parsed as any);
}

export function firebaseAdminApp(): App {
  if (getApps().length) {
    const app = getApps()[0];
    if (app.options.projectId && app.options.projectId !== EXPECTED_PROJECT_ID) throw new Error('Firebase Admin inicializado no projeto incorreto.');
    return app;
  }
  return initializeApp({ credential: resolveCredential(), projectId: EXPECTED_PROJECT_ID, storageBucket: 'rl-connect-ed797.firebasestorage.app' });
}

export function adminAuth() { return getAuth(firebaseAdminApp()); }
export function adminDb() { return getFirestore(firebaseAdminApp()); }

export type RlAccessContext = {
  uid: string;
  email: string;
  role: string;
  companyId: string;
  isMaster: boolean;
  permissions: string[];
  profile: Record<string, any>;
};

function tenantId(profile: Record<string, any>): string {
  return String(profile.empresa_id || profile.empresaId || profile.companyId || profile.tenantId || '').trim();
}
function normalizedPermissions(profile: Record<string, any>): string[] {
  const raw = profile.permissions || profile.permissoes || [];
  if (Array.isArray(raw)) return raw.map(String);
  return Object.entries(raw || {}).filter(([, enabled]) => enabled === true).map(([key]) => key);
}
function isMasterRole(role: string, profile: Record<string, any>) {
  return profile.isMaster === true || ['master_admin','MASTER','MASTER_ADMIN','SUPER_ADMINISTRADOR','Super Administrador'].includes(role);
}

export async function verifyRlBearer(authorization: string | undefined, requestedCompanyId?: string): Promise<RlAccessContext> {
  const token = String(authorization || '').replace(/^Bearer\s+/i, '').trim();
  if (!token) throw Object.assign(new Error('Sessão Firebase obrigatória.'), { statusCode: 401 });
  let decoded;
  try { decoded = await adminAuth().verifyIdToken(token, true); } catch { throw Object.assign(new Error('Sessão Firebase inválida ou expirada.'), { statusCode: 401 }); }
  const db = adminDb();
  let profileDoc = await db.collection('usuarios').doc(decoded.uid).get();
  if (!profileDoc.exists) profileDoc = await db.collection('users').doc(decoded.uid).get();
  if (!profileDoc.exists) throw Object.assign(new Error('Perfil do usuário não encontrado no Firestore.'), { statusCode: 403 });
  const profile = profileDoc.data() || {};
  const status = String(profile.status || '').toLowerCase();
  if (profile.ativo === false || ['inativo','bloqueado','suspenso'].includes(status)) throw Object.assign(new Error('Usuário inativo ou bloqueado.'), { statusCode: 403 });
  const role = String(profile.role || profile.tipoUsuario || '');
  const profileCompany = tenantId(profile);
  const master = isMasterRole(role, profile);
  const companyId = String(requestedCompanyId || profileCompany || '').trim();
  if (!companyId) throw Object.assign(new Error('empresaId é obrigatório.'), { statusCode: 400 });
  if (!master && profileCompany !== companyId) throw Object.assign(new Error('Empresa não autorizada para esta sessão.'), { statusCode: 403 });
  return { uid: decoded.uid, email: decoded.email || String(profile.email || ''), role, companyId, isMaster: master, permissions: normalizedPermissions(profile), profile };
}

export function canManageIntegration(access: RlAccessContext) {
  return access.isMaster || ['empresa_admin','ADMIN_EMPRESA','EMPRESA_ADMIN','ADMIN','ADMINISTRADOR','GESTOR_EMPRESA'].includes(access.role) || access.permissions.includes('edit_settings');
}
export function canManageInterview(access: RlAccessContext) {
  return canManageIntegration(access) || ['recrutador','headhunter','RH','RECRUTAMENTO','RECRUTADOR','GESTOR'].includes(access.role) || access.permissions.includes('schedule_interview') || access.permissions.includes('entrevistas');
}
