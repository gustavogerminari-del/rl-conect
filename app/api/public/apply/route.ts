const JSON_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
};

type ServiceAccount = {
  project_id: string;
  client_email: string;
  private_key: string;
  token_uri?: string;
};

type FirestoreDocument = { fields?: Record<string, any> };

function serviceAccountFromEnvironment(): ServiceAccount {
  const raw = String(process.env.FIREBASE_SERVICE_ACCOUNT_JSON || '').trim();
  if (!raw) throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON não configurado no servidor.');
  const parsed = JSON.parse(raw) as Partial<ServiceAccount>;
  if (!parsed.project_id || !parsed.client_email || !parsed.private_key) throw new Error('Conta de serviço Firebase incompleta.');
  return {
    project_id: String(parsed.project_id),
    client_email: String(parsed.client_email),
    private_key: String(parsed.private_key).replace(/\\n/g, '\n'),
    token_uri: String(parsed.token_uri || 'https://oauth2.googleapis.com/token'),
  };
}

function base64Url(value: string | Uint8Array) {
  const bytes = typeof value === 'string' ? new TextEncoder().encode(value) : value;
  let raw = '';
  bytes.forEach((b) => { raw += String.fromCharCode(b); });
  return btoa(raw).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function pemToPkcs8(privateKey: string) {
  const body = privateKey.replace(/-----BEGIN PRIVATE KEY-----/g, '').replace(/-----END PRIVATE KEY-----/g, '').replace(/\s+/g, '');
  return Uint8Array.from(atob(body), (c) => c.charCodeAt(0));
}

async function accessToken(sa: ServiceAccount) {
  const now = Math.floor(Date.now() / 1000);
  const tokenUri = sa.token_uri || 'https://oauth2.googleapis.com/token';
  const header = base64Url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const payload = base64Url(JSON.stringify({ iss: sa.client_email, scope: 'https://www.googleapis.com/auth/datastore', aud: tokenUri, iat: now, exp: now + 3600 }));
  const unsigned = `${header}.${payload}`;
  const key = await crypto.subtle.importKey('pkcs8', pemToPkcs8(sa.private_key), { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(unsigned));
  const assertion = `${unsigned}.${base64Url(new Uint8Array(signature))}`;
  const response = await fetch(tokenUri, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth-type:jwt-bearer', assertion }),
  });
  let body: any = await response.json().catch(() => ({}));
  // Some OAuth servers require the standard grant_type literal.
  if (!response.ok || !body.access_token) {
    const retry = await fetch(tokenUri, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }),
    });
    body = await retry.json().catch(() => ({}));
    if (!retry.ok || !body.access_token) throw new Error('Não foi possível autenticar a conta de serviço Firebase.');
  }
  return String(body.access_token);
}

function decodeValue(v: any): any {
  if (!v || typeof v !== 'object') return undefined;
  if ('stringValue' in v) return v.stringValue;
  if ('booleanValue' in v) return v.booleanValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return Number(v.doubleValue);
  if ('timestampValue' in v) return v.timestampValue;
  if ('nullValue' in v) return null;
  if ('arrayValue' in v) return (v.arrayValue?.values || []).map(decodeValue);
  if ('mapValue' in v) return Object.fromEntries(Object.entries(v.mapValue?.fields || {}).map(([k, x]) => [k, decodeValue(x)]));
  return undefined;
}

function decodeDocument(doc?: FirestoreDocument | null) {
  return doc ? Object.fromEntries(Object.entries(doc.fields || {}).map(([k, v]) => [k, decodeValue(v)])) : null;
}

function encodeValue(value: any): any {
  if (value === null || value === undefined) return { nullValue: null };
  if (typeof value === 'string') return { stringValue: value };
  if (typeof value === 'boolean') return { booleanValue: value };
  if (typeof value === 'number') return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value };
  if (Array.isArray(value)) return { arrayValue: { values: value.map(encodeValue) } };
  if (typeof value === 'object') return { mapValue: { fields: encodeFields(value) } };
  return { stringValue: String(value) };
}

function encodeFields(value: Record<string, any>) {
  return Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined).map(([k, v]) => [k, encodeValue(v)]));
}

function docUrl(projectId: string, collectionName: string, id: string) {
  return `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/databases/(default)/documents/${encodeURIComponent(collectionName)}/${encodeURIComponent(id)}`;
}

async function readDoc(projectId: string, token: string, collectionName: string, id: string) {
  const r = await fetch(docUrl(projectId, collectionName, id), { headers: { Authorization: `Bearer ${token}` } });
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`Falha ao consultar ${collectionName}/${id}.`);
  return r.json() as Promise<FirestoreDocument>;
}

async function upsertDoc(projectId: string, token: string, collectionName: string, id: string, data: Record<string, any>) {
  const r = await fetch(docUrl(projectId, collectionName, id), {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: encodeFields(data) }),
  });
  if (!r.ok) throw new Error(`Falha ao gravar ${collectionName}/${id}: ${r.status}.`);
}

async function stableId(prefix: string, parts: string[]) {
  const bytes = new TextEncoder().encode(parts.join('|').toLowerCase().trim());
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
  return `${prefix}_${[...digest].map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 28)}`;
}

function tenantOf(data: Record<string, any> | null) {
  return String(data?.empresa_id || data?.empresaId || data?.companyId || data?.tenantId || '').trim();
}

function isPublishedJob(job: Record<string, any>) {
  const published = job.publicado === true || job.publicada === true;
  const status = String(job.status || '').toLowerCase();
  return published && !['encerrada', 'fechada', 'cancelada'].includes(status);
}

function cleanText(value: unknown, max = 2000) {
  return String(value || '').trim().slice(0, max);
}

export async function POST(request: Request) {
  try {
    const body: any = await request.json();
    const type = body?.type === 'talent' ? 'talent' : 'job';
    const companyId = cleanText(body?.companyId, 180);
    const jobId = cleanText(body?.jobId, 180);
    const source = body?.candidate || {};
    const name = cleanText(source.nome || source.name, 180);
    const email = cleanText(source.email, 320).toLowerCase();
    const phone = cleanText(source.telefone || source.phone, 80);

    if (!companyId || !name || !email || !email.includes('@')) {
      return new Response(JSON.stringify({ ok: false, error: 'Dados obrigatórios inválidos.' }), { status: 400, headers: JSON_HEADERS });
    }

    const sa = serviceAccountFromEnvironment();
    const token = await accessToken(sa);
    const companyDoc = await readDoc(sa.project_id, token, 'empresas', companyId);
    if (!companyDoc) return new Response(JSON.stringify({ ok: false, error: 'Empresa não encontrada.' }), { status: 404, headers: JSON_HEADERS });

    let job: Record<string, any> | null = null;
    if (type === 'job') {
      if (!jobId) return new Response(JSON.stringify({ ok: false, error: 'Vaga não informada.' }), { status: 400, headers: JSON_HEADERS });
      const rawJob = await readDoc(sa.project_id, token, 'vagas', jobId);
      job = decodeDocument(rawJob);
      if (!job || tenantOf(job) !== companyId || !isPublishedJob(job)) {
        return new Response(JSON.stringify({ ok: false, error: 'Vaga indisponível para candidatura.' }), { status: 409, headers: JSON_HEADERS });
      }
    }

    const candidateId = await stableId('cand', [companyId, email]);
    const now = new Date().toISOString();
    const tenantAliases = { empresa_id: companyId, empresaId: companyId, companyId, tenantId: companyId };
    const candidate = {
      ...tenantAliases,
      nome: name,
      name,
      email,
      telefone: phone,
      cidade: cleanText(source.cidade, 120),
      estado: cleanText(source.estado, 40),
      cargo_desejado: cleanText(source.cargo_desejado || job?.titulo || 'Banco de Talentos', 220),
      linkedin_url: cleanText(source.linkedin_url, 500),
      pretensao_salarial: cleanText(source.pretensao_salarial, 120),
      observacoes: cleanText(source.observacoes, 3000),
      curriculo_url: cleanText(source.curriculo_url, 1500),
      curriculo_texto: cleanText(source.curriculo_texto, 12000),
      resumo_ia: cleanText(source.resumo_ia, 3000),
      score_ia: Number(source.score_ia || 0),
      tags: Array.isArray(source.tags) ? source.tags.slice(0, 30).map((x: unknown) => cleanText(x, 120)) : [],
      habilidades: Array.isArray(source.habilidades) ? source.habilidades.slice(0, 80).map((x: unknown) => cleanText(x, 120)) : [],
      origem: type === 'talent' ? 'banco_talentos_portal' : 'portal_vagas',
      inTalentBank: type === 'talent',
      currentJobId: type === 'job' ? jobId : '',
      atualizado_em: now,
      criado_em: now,
    };
    await upsertDoc(sa.project_id, token, 'candidatos', candidateId, candidate);

    let applicationId = '';
    if (type === 'job') {
      applicationId = await stableId('cand_app', [companyId, jobId, candidateId]);
      await upsertDoc(sa.project_id, token, 'candidaturas', applicationId, {
        ...tenantAliases,
        vaga_id: jobId,
        vagaId: jobId,
        jobId,
        candidato_id: candidateId,
        candidatoId: candidateId,
        candidateId,
        etapa_pipeline: 'Inscritos',
        ordem_etapa: 1,
        status: 'em_andamento',
        pontuacao_compatibilidade: Number(source.score_ia || 80),
        origem: 'portal_vagas',
        data_candidatura: now,
        atualizado_em: now,
      });
    }

    return new Response(JSON.stringify({ ok: true, candidateId, applicationId }), { status: 200, headers: JSON_HEADERS });
  } catch (error) {
    console.error('[Public Apply] Falha:', error);
    return new Response(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : 'Falha ao registrar candidatura.' }), { status: 500, headers: JSON_HEADERS });
  }
}
