import { doc, getDoc } from 'firebase/firestore';
import { db } from './firebase';

async function readDocument(collectionName: string, id: string): Promise<Record<string, any> | null> {
  const snapshot = await getDoc(doc(db, collectionName, id));
  return snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null;
}

/** Perfil oficial: `usuarios`. `users` existe apenas para compatibilidade legada. */
export async function fetchUsuarioFirestore(uid: string): Promise<Record<string, any> | null> {
  const primary = await readDocument('usuarios', uid);
  if (primary) return { ...primary, uid, id: uid };
  const legacy = await readDocument('users', uid);
  return legacy ? { ...legacy, uid, id: uid } : null;
}

/**
 * Módulos da empresa são administrados pelo Master em `empresa_modulos/{empresaId}`.
 * `companyModules` é somente fallback de leitura para instalações antigas.
 */
export async function fetchEmpresaModulosFirestore(companyId: string): Promise<Record<string, any>> {
  if (!companyId) return {};
  const primary = await readDocument('empresa_modulos', companyId);
  if (primary) return primary;
  return (await readDocument('companyModules', companyId)) || {};
}

/** Registro usado para status/trial/bloqueio do tenant. */
export async function fetchEmpresaAccessRecord(companyId: string): Promise<Record<string, any> | null> {
  if (!companyId) return null;
  return (
    await readDocument('empresas', companyId) ||
    await readDocument('companies', companyId) ||
    await readDocument('tenants', companyId)
  );
}
