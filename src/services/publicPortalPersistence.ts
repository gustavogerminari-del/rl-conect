import { dataService } from './dataService';

type PublicApplyResult = { candidato: Record<string, any>; candidatura?: Record<string, any> };

async function persist(payload: Record<string, any>) {
  const response = await fetch('/api/public/apply', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body?.ok !== true) {
    const error = new Error(String(body?.error || 'Não foi possível persistir a candidatura no Firebase.'));
    window.dispatchEvent(new CustomEvent('rl-public-application-persistence', { detail: { ok: false, error: error.message } }));
    throw error;
  }
  window.dispatchEvent(new CustomEvent('rl-public-application-persistence', { detail: { ok: true, ...body } }));
  return body;
}

const service = dataService as any;
const originalApplyToVagaPublic = service.applyToVagaPublic.bind(service);
const originalApplyToTalentPoolPublic = service.applyToTalentPoolPublic.bind(service);

// Public visitors intentionally do not authenticate in Firebase. The original
// dataService keeps the instant local UI behavior; this adapter guarantees that
// the same candidate/application is also persisted by the server-side Firebase
// service account, where company/job ownership is validated before writing.
service.applyToVagaPublic = (vagaId: string, candidateData: Record<string, any>): PublicApplyResult => {
  const result = originalApplyToVagaPublic(vagaId, candidateData) as PublicApplyResult;
  const companyId = String(result?.candidato?.empresa_id || '');
  void persist({ type: 'job', companyId, jobId: vagaId, candidate: result.candidato }).catch((error) => {
    console.error('[Portal Público] Candidatura não persistida:', error);
  });
  return result;
};

service.applyToTalentPoolPublic = (companyId: string, candidateData: Record<string, any>): PublicApplyResult => {
  const result = originalApplyToTalentPoolPublic(companyId, candidateData) as PublicApplyResult;
  void persist({ type: 'talent', companyId, candidate: result.candidato }).catch((error) => {
    console.error('[Portal Público] Banco de Talentos não persistido:', error);
  });
  return result;
};
