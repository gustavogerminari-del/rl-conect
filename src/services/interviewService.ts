import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  where,
} from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import type { Entrevista } from '../types';

type UserContext = {
  uid: string;
  tenantId: string;
};

type InterviewCreateInput = Omit<
  Entrevista,
  'id' | 'empresa_id' | 'criado_em' | 'sincronizado_gcal' | 'sincronizado_outlook'
>;

function normalizeInterview(id: string, raw: Record<string, any>): Entrevista {
  return {
    id,
    empresa_id: String(raw.empresa_id || raw.empresaId || raw.companyId || ''),
    candidatura_id: String(raw.candidatura_id || raw.candidaturaId || ''),
    vaga_id: String(raw.vaga_id || raw.vagaId || ''),
    candidato_id: String(raw.candidato_id || raw.candidatoId || ''),
    titulo: String(raw.titulo || 'Entrevista'),
    data_hora: String(raw.data_hora || raw.dataHora || ''),
    duracao_minutos: Number(raw.duracao_minutos || raw.duracaoMinutos || 45),
    formato: raw.formato || 'Presencial',
    link_reuniao: raw.link_reuniao || raw.linkReuniao || undefined,
    entrevistador_id: String(raw.entrevistador_id || raw.entrevistadorId || ''),
    status: raw.status || 'agendada',
    anotacoes: raw.anotacoes || undefined,
    sincronizado_gcal: raw.sincronizado_gcal === true || raw.sincronizadoGcal === true,
    sincronizado_outlook: raw.sincronizado_outlook === true || raw.sincronizadoOutlook === true,
    criado_em: String(raw.criado_em || raw.createdAt || ''),
  };
}

async function currentUserContext(): Promise<UserContext> {
  const currentUser = auth.currentUser;
  if (!currentUser) throw new Error('Sessão Firebase não encontrada. Entre novamente.');

  const primary = await getDoc(doc(db, 'usuarios', currentUser.uid));
  const legacy = primary.exists() ? null : await getDoc(doc(db, 'users', currentUser.uid));
  const raw = primary.exists() ? primary.data() : legacy?.exists() ? legacy.data() : null;
  if (!raw) throw new Error('Perfil do usuário não encontrado no Firestore.');

  const tenantId = String(raw.empresaId || raw.companyId || raw.tenantId || '').trim();
  if (!tenantId) {
    throw new Error('Este acesso não está vinculado a uma empresa para operar a Agenda.');
  }

  return { uid: currentUser.uid, tenantId };
}

export const interviewService = {
  async list(): Promise<Entrevista[]> {
    const { tenantId } = await currentUserContext();
    const snapshot = await getDocs(
      query(collection(db, 'entrevistas'), where('empresaId', '==', tenantId))
    );
    return snapshot.docs
      .map((item) => normalizeInterview(item.id, item.data() as Record<string, any>))
      .sort((a, b) => new Date(a.data_hora).getTime() - new Date(b.data_hora).getTime());
  },

  async create(input: InterviewCreateInput): Promise<Entrevista> {
    const { uid, tenantId } = await currentUserContext();
    const ref = doc(collection(db, 'entrevistas'));
    const now = new Date().toISOString();

    const data = {
      empresaId: tenantId,
      companyId: tenantId,
      empresa_id: tenantId,
      candidaturaId: input.candidatura_id,
      candidatura_id: input.candidatura_id,
      vagaId: input.vaga_id,
      vaga_id: input.vaga_id,
      candidatoId: input.candidato_id,
      candidato_id: input.candidato_id,
      titulo: input.titulo,
      dataHora: input.data_hora,
      data_hora: input.data_hora,
      duracaoMinutos: input.duracao_minutos,
      duracao_minutos: input.duracao_minutos,
      formato: input.formato,
      linkReuniao: input.link_reuniao || null,
      link_reuniao: input.link_reuniao || null,
      entrevistadorId: input.entrevistador_id || uid,
      entrevistador_id: input.entrevistador_id || uid,
      status: input.status,
      anotacoes: input.anotacoes || null,
      sincronizadoGcal: false,
      sincronizado_gcal: false,
      sincronizadoOutlook: false,
      sincronizado_outlook: false,
      calendarSyncStatus: 'pending_migration',
      createdAt: now,
      criado_em: now,
      createdBy: uid,
      updatedAt: now,
      updatedBy: uid,
    };

    await setDoc(ref, data);
    return normalizeInterview(ref.id, data);
  },
};
