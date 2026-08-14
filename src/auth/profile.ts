import { UserProfile } from './types/auth';

export interface RawUserProfile extends Record<string, any> {
  uid?: string;
  id?: string;
  nome?: string;
  name?: string;
  displayName?: string;
  email?: string;
  role?: string;
  tipoUsuario?: string;
  empresaId?: string | null;
  companyId?: string | null;
  tenantId?: string | null;
  companyName?: string;
  empresaNome?: string;
  permissions?: Record<string, boolean> | string[];
  permissoes?: Record<string, boolean> | string[];
  modules?: Record<string, boolean>;
  modulos?: Record<string, boolean>;
  ativo?: boolean;
  status?: string;
  colaboradorId?: string;
}

export const normalizeRole = (value?: unknown): string =>
  String(value ?? '').trim().toUpperCase().replace(/[\s-]+/g, '_');

export const isMasterProfile = (profile?: Partial<RawUserProfile | UserProfile> | null): boolean => {
  const role = normalizeRole(profile?.role);
  const userType = normalizeRole(profile?.tipoUsuario);
  return ['MASTER_ADMIN', 'MASTER'].includes(role) || ['MASTER_ADMIN', 'MASTER'].includes(userType);
};

export const getCompanyId = (profile?: Partial<RawUserProfile | UserProfile> | null): string | null => {
  const value = profile?.empresaId || profile?.companyId || profile?.tenantId;
  return typeof value === 'string' && value.trim() ? value.trim() : null;
};

export const requireCompanyId = (
  profile?: Partial<RawUserProfile | UserProfile> | null,
  operation = 'realizar esta operação'
): string => {
  const companyId = getCompanyId(profile);
  if (!companyId) throw new Error(`Não foi possível ${operation}: usuário sem empresa válida vinculada.`);
  return companyId;
};

export function mergeUserDocuments(uid: string, primary?: RawUserProfile | null, legacy?: RawUserProfile | null): RawUserProfile | null {
  if (!primary && !legacy) return null;
  const companyId = getCompanyId(primary) || getCompanyId(legacy);
  const mergeFlags = (
    legacyValue?: Record<string, boolean> | string[],
    primaryValue?: Record<string, boolean> | string[],
  ): Record<string, boolean> => {
    const result: Record<string, boolean> = {};
    const apply = (value?: Record<string, boolean> | string[]) => {
      if (Array.isArray(value)) value.forEach(key => { if (key) result[key] = true; });
      else if (value && typeof value === 'object') {
        Object.entries(value).forEach(([key, enabled]) => { result[key] = enabled === true; });
      }
    };
    apply(legacyValue);
    apply(primaryValue);
    return result;
  };
  const permissions = mergeFlags(
    legacy?.permissions || legacy?.permissoes,
    primary?.permissions || primary?.permissoes,
  );
  const modules = mergeFlags(legacy?.modules || legacy?.modulos, primary?.modules || primary?.modulos);
  return {
    ...(legacy || {}),
    ...(primary || {}),
    uid,
    nome: primary?.nome || primary?.name || primary?.displayName || legacy?.nome || legacy?.name || legacy?.displayName,
    email: primary?.email || legacy?.email,
    role: primary?.role || primary?.tipoUsuario || legacy?.role || legacy?.tipoUsuario,
    tipoUsuario: primary?.tipoUsuario || legacy?.tipoUsuario,
    empresaId: companyId,
    companyId,
    companyName: primary?.companyName || primary?.empresaNome || legacy?.companyName || legacy?.empresaNome,
    permissions,
    modules,
    ativo: primary?.ativo ?? legacy?.ativo ?? true,
    status: primary?.status || legacy?.status || 'Ativo',
    colaboradorId: primary?.colaboradorId || legacy?.colaboradorId,
  };
}

export function toUserProfile(uid: string, raw: RawUserProfile, authData: {
  email?: string | null;
  displayName?: string | null;
  photoURL?: string | null;
}): UserProfile {
  const role = normalizeRole(raw.role || raw.tipoUsuario);
  if (!role) throw new Error('Perfil sem papel de acesso (role). Contate o administrador.');
  const master = isMasterProfile(raw);
  const companyId = getCompanyId(raw);
  if (!master && !companyId) throw new Error('Perfil sem empresa vinculada. Contate o administrador.');
  const status = normalizeRole(raw.status);
  // MASTER é uma identidade da plataforma, não um usuário de empresa. O acesso
  // de emergência da plataforma nunca pode ser invalidado por status empresarial.
  if (!master && (raw.ativo === false || status === 'INATIVO' || status === 'BLOQUEADO')) {
    throw new Error('Esta conta foi desativada pelo administrador.');
  }
  return {
    id: uid,
    name: raw.nome || raw.name || raw.displayName || authData.displayName || authData.email?.split('@')[0] || 'Usuário',
    email: authData.email || raw.email || '',
    role: master ? 'MASTER' : role,
    tipoUsuario: master ? 'MASTER' : (raw.tipoUsuario as UserProfile['tipoUsuario']) || 'EMPRESA',
    department: String(raw.departamento || ''),
    avatar: authData.photoURL || '',
    empresaId: companyId || undefined,
    companyId: companyId || undefined,
    companyName: raw.companyName || raw.empresaNome,
    colaboradorId: raw.colaboradorId,
    permissions: raw.permissions || raw.permissoes || [],
    modules: raw.modules || raw.modulos || {},
    isMaster: master,
  };
}
