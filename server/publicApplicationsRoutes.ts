import crypto from 'crypto';
import { Router, type Request, type Response } from 'express';
import { getStorage } from 'firebase-admin/storage';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb, firebaseAdminApp } from './firebaseAdmin.js';

const MAX_FILE_BYTES = 5 * 1024 * 1024;
const ALLOWED_MIME = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
]);
const requestLog = new Map<string, number[]>();

function normalizeEmail(value: unknown) { return String(value || '').trim().toLowerCase(); }
function safeText(value: unknown, max = 500) { return String(value || '').trim().slice(0, max); }
function stableId(prefix: string, identity: string) { return `${prefix}_${crypto.createHash('sha256').update(identity).digest('hex').slice(0, 28)}`; }
function tenantId(data: Record<string, any>) { return String(data.empresa_id || data.empresaId || data.companyId || data.tenantId || '').trim(); }
function rateLimit(req: Request) {
  const key = String(req.ip || req.socket.remoteAddress || 'unknown');
  const now = Date.now(); const windowMs = 10 * 60_000; const max = 15;
  const hits = (requestLog.get(key) || []).filter(ts => now - ts < windowMs);
  if (hits.length >= max) throw Object.assign(new Error('Muitas tentativas. Aguarde alguns minutos e tente novamente.'), { statusCode: 429 });
  hits.push(now); requestLog.set(key, hits);
}
function fail(res: Response, error: unknown) {
  const status = Number((error as any)?.statusCode || 500);
  res.status(status).json({ success: false, error: error instanceof Error ? error.message : String(error) });
}

async function findPublishedJob(companyId: string, jobId: string) {
  const snap = await adminDb().collection('vagas').doc(jobId).get();
  if (!snap.exists) throw Object.assign(new Error('Vaga não encontrada.'), { statusCode: 404 });
  const data = snap.data() || {};
  if (tenantId(data) !== companyId) throw Object.assign(new Error('Vaga não pertence a esta empresa.'), { statusCode: 400 });
  const status = String(data.status || '').toLowerCase();
  const published = data.publicado === true || data.publicada === true || status === 'publicada';
  if (!published || ['encerrada','fechada','cancelada','pausada'].includes(status)) throw Object.assign(new Error('Esta vaga não está disponível para candidatura.'), { statusCode: 409 });
  return { id: snap.id, ...data } as Record<string, any>;
}

async function saveResume(companyId: string, candidateId: string, file: any) {
  if (!file?.base64) return null;
  const mime = safeText(file.mimeType, 120).toLowerCase();
  if (!ALLOWED_MIME.has(mime)) throw Object.assign(new Error('Currículo deve ser PDF, DOC, DOCX ou TXT.'), { statusCode: 400 });
  const buffer = Buffer.from(String(file.base64), 'base64');
  if (!buffer.length || buffer.length > MAX_FILE_BYTES) throw Object.assign(new Error('Currículo inválido ou maior que 5 MB.'), { statusCode: 400 });
  const extension = mime === 'application/pdf' ? 'pdf' : mime === 'application/msword' ? 'doc' : mime.includes('wordprocessingml') ? 'docx' : 'txt';
  const objectPath = `public_applications/${companyId}/${candidateId}/curriculo.${extension}`;
  const bucket = getStorage(firebaseAdminApp()).bucket();
  await bucket.file(objectPath).save(buffer, { resumable: false, contentType: mime, metadata: { cacheControl: 'private, max-age=0, no-store' } });
  return objectPath;
}

export function registerPublicApplicationsRoutes(app: { use: (...args: any[]) => any }) {
  const router = Router();

  router.post('/applications', async (req, res) => {
    try {
      rateLimit(req);
      const companyId = safeText(req.body?.companyId, 120);
      const jobId = safeText(req.body?.jobId, 160);
      const email = normalizeEmail(req.body?.candidate?.email);
      const name = safeText(req.body?.candidate?.nome, 180);
      if (!companyId || !jobId || !name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw Object.assign(new Error('Empresa, vaga, nome e e-mail válido são obrigatórios.'), { statusCode: 400 });
      if (req.body?.lgpdAccepted !== true) throw Object.assign(new Error('É necessário aceitar o consentimento LGPD.'), { statusCode: 400 });
      const job = await findPublishedJob(companyId, jobId);
      const candidateId = stableId('cand', `${companyId}:${email}`);
      const applicationId = stableId('cand_app', `${companyId}:${jobId}:${candidateId}`);
      const resumePath = await saveResume(companyId, candidateId, req.body?.resume);
      const db = adminDb();
      const now = new Date().toISOString();
      let reused = false;
      await db.runTransaction(async tx => {
        const candidateRef = db.collection('candidatos').doc(candidateId);
        const applicationRef = db.collection('candidaturas').doc(applicationId);
        const appSnap = await tx.get(applicationRef);
        reused = appSnap.exists;
        tx.set(candidateRef, {
          id: candidateId,
          empresa_id: companyId, empresaId: companyId, companyId,
          nome: name, email,
          telefone: safeText(req.body.candidate.telefone, 40),
          cidade: safeText(req.body.candidate.cidade, 100), estado: safeText(req.body.candidate.estado, 20),
          cargo_desejado: safeText(job.titulo || req.body.candidate.cargo_desejado, 180),
          linkedin_url: safeText(req.body.candidate.linkedin_url, 500), pretensao_salarial: safeText(req.body.candidate.pretensao_salarial, 100),
          observacoes: safeText(req.body.candidate.observacoes, 2000), curriculo_texto: safeText(req.body.candidate.curriculo_texto, 12000),
          curriculo_storage_path: resumePath || FieldValue.delete(), origem: 'portal_vagas',
          tags: ['Portal de Vagas'], habilidades: Array.isArray(job.requisitos) ? job.requisitos.slice(0, 10) : [],
          atualizado_em: now, criado_em: now,
        }, { merge: true });
        if (!appSnap.exists) tx.create(applicationRef, {
          id: applicationId, empresa_id: companyId, empresaId: companyId, companyId,
          vaga_id: jobId, candidato_id: candidateId, etapa_pipeline: 'Inscritos', ordem_etapa: 1,
          status: 'em_andamento', pontuacao_compatibilidade: 0, origem: 'portal_vagas', data_candidatura: now, atualizado_em: now,
        });
      });
      await db.collection('logs').add({ empresa_id: companyId, empresaId: companyId, companyId, usuario_id: 'PORTAL_PUBLICO', usuario_nome: email, acao: reused ? 'EDICAO' : 'CRIACAO', detalhes: reused ? `Candidatura ${applicationId} reutilizada; duplicidade evitada.` : `Nova candidatura ${applicationId} recebida pelo portal.`, resultado: 'SUCESSO', criado_em: now });
      res.status(reused ? 200 : 201).json({ success: true, reused, candidateId, applicationId });
    } catch (error) { fail(res, error); }
  });

  router.post('/talent-pool', async (req, res) => {
    try {
      rateLimit(req);
      const companyId = safeText(req.body?.companyId, 120); const email = normalizeEmail(req.body?.candidate?.email); const name = safeText(req.body?.candidate?.nome, 180);
      if (!companyId || !name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || req.body?.lgpdAccepted !== true) throw Object.assign(new Error('Empresa, nome, e-mail válido e consentimento LGPD são obrigatórios.'), { statusCode: 400 });
      const companySnap = await adminDb().collection('empresas').doc(companyId).get(); if (!companySnap.exists) throw Object.assign(new Error('Empresa não encontrada.'), { statusCode: 404 });
      const candidateId = stableId('cand', `${companyId}:${email}`); const applicationId = stableId('talent', `${companyId}:${candidateId}`); const resumePath = await saveResume(companyId, candidateId, req.body?.resume); const now = new Date().toISOString(); const db = adminDb();
      let reused = false;
      await db.runTransaction(async tx => {
        const candidateRef = db.collection('candidatos').doc(candidateId); const applicationRef = db.collection('candidaturas').doc(applicationId); const appSnap = await tx.get(applicationRef); reused = appSnap.exists;
        tx.set(candidateRef, { id: candidateId, empresa_id: companyId, empresaId: companyId, companyId, nome: name, email, telefone: safeText(req.body.candidate.telefone,40), cidade: safeText(req.body.candidate.cidade,100), estado: safeText(req.body.candidate.estado,20), cargo_desejado: safeText(req.body.candidate.cargo_desejado || 'Banco de Talentos',180), linkedin_url: safeText(req.body.candidate.linkedin_url,500), pretensao_salarial: safeText(req.body.candidate.pretensao_salarial,100), observacoes: safeText(req.body.candidate.observacoes,2000), curriculo_texto: safeText(req.body.candidate.curriculo_texto,12000), curriculo_storage_path: resumePath || FieldValue.delete(), origem: 'banco_talentos_portal', tags: ['Banco de Talentos','Portal Público'], habilidades: [], atualizado_em: now, criado_em: now }, { merge: true });
        if (!appSnap.exists) tx.create(applicationRef, { id: applicationId, empresa_id: companyId, empresaId: companyId, companyId, vaga_id: `talent_pool_${companyId}`, candidato_id: candidateId, etapa_pipeline: 'Inscritos', ordem_etapa: 1, status: 'em_andamento', pontuacao_compatibilidade: 0, origem: 'banco_talentos_portal', data_candidatura: now, atualizado_em: now });
      });
      res.status(reused ? 200 : 201).json({ success: true, reused, candidateId, applicationId });
    } catch (error) { fail(res, error); }
  });

  app.use('/api/public', router);
}
