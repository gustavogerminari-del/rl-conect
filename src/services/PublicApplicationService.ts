type CandidatePayload = {
  nome: string;
  email: string;
  telefone?: string;
  cidade?: string;
  estado?: string;
  cargo_desejado?: string;
  linkedin_url?: string;
  pretensao_salarial?: string;
  observacoes?: string;
  curriculo_texto?: string;
};

async function filePayload(file: File | null) {
  if (!file) return undefined;
  if (file.size > 5 * 1024 * 1024) throw new Error('O currículo deve ter no máximo 5 MB.');
  const allowed = new Set([
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
  ]);
  if (!allowed.has(file.type)) throw new Error('Envie o currículo em PDF, DOC, DOCX ou TXT.');
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  return { base64: btoa(binary), mimeType: file.type, name: file.name };
}

async function post(path: string, payload: Record<string, unknown>) {
  const response = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const text = await response.text();
  let body: any = {};
  try { body = text ? JSON.parse(text) : {}; } catch { body = { error: text }; }
  if (!response.ok || body.success === false) throw new Error(body.error || 'Não foi possível enviar a candidatura.');
  return body as { success: true; reused: boolean; candidateId: string; applicationId: string };
}

export const PublicApplicationService = {
  async applyToJob(companyId: string, jobId: string, candidate: CandidatePayload, resume: File | null, lgpdAccepted: boolean) {
    return post('/api/public/applications', { companyId, jobId, candidate, resume: await filePayload(resume), lgpdAccepted });
  },
  async applyToTalentPool(companyId: string, candidate: CandidatePayload, resume: File | null, lgpdAccepted: boolean) {
    return post('/api/public/talent-pool', { companyId, candidate, resume: await filePayload(resume), lgpdAccepted });
  },
};
