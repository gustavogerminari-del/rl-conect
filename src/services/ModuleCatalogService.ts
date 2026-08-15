import { collection, doc, getDocs, setDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { sanitizeFirestoreData } from '../lib/firestoreUtils';

export interface PlanConfig {
  id: string;
  nome: string;
  descricao?: string;
  preco: number;
  modulos: string[];
  limites?: { usuarios?: number; vagas?: number; colaboradores?: number };
  ativo?: boolean;
  updatedAt?: string;
  updatedBy?: string;
}

export interface ModuloConfig {
  id: string;
  key: string;
  nome: string;
  descricao?: string;
  categoria?: string;
  ativo?: boolean;
  icone?: string;
  rota?: string;
  ordem?: number;
  updatedAt?: string;
  updatedBy?: string;
}

const nowIso = () => new Date().toISOString();

export async function fetchPlansFirestore(): Promise<PlanConfig[]> {
  const snapshot = await getDocs(collection(db, 'planos'));
  return snapshot.docs.map((item) => ({ id: item.id, ...item.data() } as PlanConfig));
}

export async function savePlanFirestore(plan: PlanConfig): Promise<void> {
  const id = String(plan.id || '').trim();
  if (!id) throw new Error('Plano sem identificador.');
  await setDoc(doc(db, 'planos', id), sanitizeFirestoreData({
    ...plan,
    id,
    updatedAt: nowIso(),
    updatedBy: auth.currentUser?.uid || 'MASTER',
  }), { merge: true });
}

export async function fetchModulosFirestore(): Promise<ModuloConfig[]> {
  const snapshot = await getDocs(collection(db, 'modulos'));
  return snapshot.docs.map((item) => ({ id: item.id, ...item.data() } as ModuloConfig));
}

export async function saveModuloFirestore(module: ModuloConfig): Promise<void> {
  const id = String(module.id || module.key || '').trim();
  if (!id) throw new Error('Módulo sem identificador.');
  await setDoc(doc(db, 'modulos', id), sanitizeFirestoreData({
    ...module,
    id,
    updatedAt: nowIso(),
    updatedBy: auth.currentUser?.uid || 'MASTER',
  }), { merge: true });
}
