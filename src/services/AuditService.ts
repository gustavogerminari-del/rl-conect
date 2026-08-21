import { addDoc, collection, getDocs, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';

export type AuditInput = {
  action: string;
  description: string;
  moduleName?: string;
  targetEntity?: string;
  targetId?: string;
  companyId?: string | null;
  metadata?: Record<string, unknown>;
};

export class AuditService {
  static async log(input: AuditInput): Promise<void> {
    const actor = auth.currentUser;
    const companyId = String(input.companyId || '').trim();
    const payload: Record<string, unknown> = {
      action: input.action,
      description: input.description,
      moduleName: input.moduleName || '',
      targetEntity: input.targetEntity || '',
      targetId: input.targetId || '',
      actorUid: actor?.uid || 'system',
      actorEmail: actor?.email || '',
      companyId: companyId || null,
      empresaId: companyId || null,
      empresa_id: companyId || null,
      metadata: input.metadata || {},
      createdAt: new Date().toISOString(),
      createdAtServer: serverTimestamp(),
    };
    await addDoc(collection(db, 'auditLogs'), payload);
  }

  static async list(): Promise<Array<Record<string, any> & { id: string }>> {
    const snapshot = await getDocs(collection(db, 'auditLogs'));
    return snapshot.docs
      .map((item) => ({ id: item.id, ...item.data() }))
      .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
  }
}
