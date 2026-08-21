import {
  getWorkflowGoogleAccessToken,
  patchFirestoreDocument,
  queryFirestoreByString,
  readFirestoreDocument,
  workflowServiceAccountFromEnvironment,
} from '../../workflows/_core/firestoreAdminRest';

const JSON_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
};

const TENANT_ALIASES = ['empresaId', 'companyId', 'empresa_id', 'tenantId'];

function text(value: unknown) {
  return String(value || '').trim();
}

function normalizeEmail(value: unknown) {
  return text(value).toLowerCase();
}

function stableEntityId(prefix: string, identity: string) {
  let hash = 2166136261;
  for (let index = 0; index < identity.length; index += 1) {
    hash ^= identity.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `${prefix}_${(hash >>> 0).toString(36)}`;
}

function tenantIdOf(data: Record<string, any>) {
  return text(data.empresaId || data.companyId || data.empresa_id || data.tenantId);
}

function isPublicJob(job: Record<string, any>, companyId: string) {
  const status = text(job.status).toLowerCase();
  return tenantIdOf(job) === companyId
    && job.publicada === true
    && ['ativa', 'aberta'].includes(status);
}

async function queryTenantDocuments(args: {
  projectId: string;
  accessToken: string;
  collection: string;
  companyId: string;
}) {
  const found = new Map<string, Record<string, any>>();
  for (const fieldPath of TENANT_ALIASES) {
    try {
      const rows = await queryFirestoreByString({
        projectId: args.projectId,
        accessToken: args.accessToken,
        collection: args.collection,
        fieldPath,
        value: args.companyId,
      });
      rows.forEach((row) => row.id && found.set(String(row.id), row));
    } catch {
      // Compatibilidade entre aliases históricos: uma query inválida não impede as demais.
    }
  }
  return [...found.values()];
}

function publicCompany(companyId: string, raw: Record<string, any>) {
  const source = raw.rawTenantData && typeof raw.rawTenantData === 'object' ? raw.rawTenantData : raw;
  const branding = source.branding && typeof source.branding === 'object' ? source.branding : {};
  const address = source.address && typeof source.address === 'object' ? source.address : {};
  return {
    id: companyId,
    nome: text(source.companyName || source.nomeEmpresa || raw.companyName || raw.nomeEmpresa),
    nome_fantasia: text(source.tradeName || source.nomeFantasia || raw.tradeName || raw.nomeFantasia),
    descricao: text(source.publicDescription || source.description || source.notes),
    logo_url: text(branding.logoUrl || source.logoUrl || raw.logo_url),
    banner_url: text(branding.bannerUrl || source.bannerUrl || raw.banner_url),
    cor_principal: text(branding.primaryColor || source.cor_principal || '#123657'),
    website: text(source.website || raw.website),
    linkedin_url: text(source.linkedinUrl || source.linkedin_url || raw.linkedin_url),
    instagram_url: text(source.instagramUrl || source.instagram_url || raw.instagram_url),
    contato_email: text(source.publicEmail || source.ownerEmail || raw.ownerEmail),
    contato_telefone: text(source.publicPhone || source.ownerPhone || raw.ownerPhone),
    cidade: text(address.city || address.cidade || source.cidade || raw.cidade),
    estado: text(address.state || address.estado || source.estado || raw.estado),
  };
}

function publicJob(job: Record<string, any>) {
  return {
    id: String(job.id),
    empresa_id: tenantIdOf(job),
    titulo: text(job.titulo || job.title),
    descricao: text(job.descricao || job.description),
    departamento: text(job.departamento || job.department),
    cargo: text(job.cargo || job.position || job.titulo),
    tipo_contratacao: text(job.tipo_contratacao || job.contractType || 'CLT'),
    modelo_trabalho: text(job.modelo_trabalho || job.workModel || 'Presencial'),
    cidade: text(job.cidade),
    estado: text(job.estado),
    salario_min: Number(job.salario_min || 0) || undefined,
    salario_max: Number(job.salario_max || 0) || undefined,
    exibir_salario: job.exibir_salario === true,
    status: 'publicada',
    requisitos: Array.isArray(job.requisitos) ? job.requisitos.map(String) : [],
    diferenciais: Array.isArray(job.diferenciais) ? job.diferenciais.map(String) : [],
    beneficios: Array.isArray(job.beneficios) ? job.beneficios.map(String) : [],
    publicado: true,
    modulo_origem: text(job.modulo_origem || 'recrutamento'),
    vagas_qtd: Number(job.vagas_qtd || 1),
    criado_em: text(job.criado_em || job.createdAt),
  };
}

async function adminContext() {
  const serviceAccount = workflowServiceAccountFromEnvironment();
  const accessToken = await getWorkflowGoogleAccessToken(serviceAccount);
  return { projectId: serviceAccount.project_id, accessToken };
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const companyId = text(url.searchParams.get('empresaId') || url.searchParams.get('companyId'));
    if (!companyId) {
      return Response.json({ success: false, error: 'Empresa não informada.' }, { status: 400, headers: JSON_HEADERS });
    }

    const { projectId, accessToken } = await adminContext();
    const company = await readFirestoreDocument({ projectId, accessToken, collection: 'empresas', documentId: companyId });
    if (!company) {
      return Response.json({ success: false, error: 'Empresa não encontrada.' }, { status: 404, headers: JSON_HEADERS });
    }

    const jobs = (await queryTenantDocuments({ projectId, accessToken, collection: 'vagas', companyId }))
      .filter((job) => isPublicJob(job, companyId))
      .map(publicJob);

    return Response.json({
      success: true,
      empresa: publicCompany(companyId, company),
      vagas: jobs,
    }, { headers: JSON_HEADERS });
  } catch (error: any) {
    return Response.json({
      success: false,
      error: String(error?.message || 'Não foi possível carregar o portal de vagas.'),
    }, { status: 500, headers: JSON_HEADERS });
  }
}

export async function POST(request: Request) {
  try {
    const body: any = await request.json().catch(() => ({}));
    const companyId = text(body.empresaId || body.companyId);
    const jobId = text(body.vagaId || body.jobId);
    const candidate = body.candidate && typeof body.candidate === 'object' ? body.candidate : body;
    const name = text(candidate.nome || candidate.name);
    const email = normalizeEmail(candidate.email);

    if (!companyId || !jobId || !name || !email) {
      return Response.json({
        success: false,
        error: 'Empresa, vaga, nome e e-mail são obrigatórios para candidatura.',
      }, { status: 400, headers: JSON_HEADERS });
    }

    const { projectId, accessToken } = await adminContext();
    const job = await readFirestoreDocument({ projectId, accessToken, collection: 'vagas', documentId: jobId });
    if (!job || !isPublicJob(job, companyId)) {
      return Response.json({ success: false, error: 'A vaga não está disponível para candidatura.' }, { status: 404, headers: JSON_HEADERS });
    }

    const candidateId = stableEntityId('cand', `${companyId}:${email}`);
    const applicationId = stableEntityId('cand_app', `${companyId}:${jobId}:${candidateId}`);
    const now = new Date().toISOString();
    const tenantAliases = {
      empresaId: companyId,
      companyId,
      empresa_id: companyId,
      tenantId: companyId,
    };

    await patchFirestoreDocument({
      projectId,
      accessToken,
      collection: 'candidatos',
      documentId: candidateId,
      data: {
        ...tenantAliases,
        id: candidateId,
        name,
        nome: name,
        email,
        telefone: text(candidate.telefone || candidate.phone),
        cidade: text(candidate.cidade),
        estado: text(candidate.estado),
        cargo_desejado: text(candidate.cargo_desejado || job.cargo || job.titulo),
        curriculo_url: candidate.curriculo_url ? text(candidate.curriculo_url) : null,
        curriculo_texto: candidate.curriculo_texto ? text(candidate.curriculo_texto) : null,
        linkedin_url: candidate.linkedin_url ? text(candidate.linkedin_url) : null,
        pretensao_salarial: candidate.pretensao_salarial ? text(candidate.pretensao_salarial) : null,
        observacoes: candidate.observacoes ? text(candidate.observacoes) : null,
        currentJobId: jobId,
        inTalentBank: false,
        origem: 'portal_vagas',
        tags: Array.isArray(candidate.tags) ? candidate.tags.map(String) : [],
        habilidades: Array.isArray(candidate.habilidades) ? candidate.habilidades.map(String) : [],
        criado_em: now,
        updatedAt: now,
      },
    });

    const existingApplication = await readFirestoreDocument({
      projectId,
      accessToken,
      collection: 'candidaturas',
      documentId: applicationId,
    });

    if (!existingApplication) {
      await patchFirestoreDocument({
        projectId,
        accessToken,
        collection: 'candidaturas',
        documentId: applicationId,
        data: {
          ...tenantAliases,
          id: applicationId,
          candidateId,
          candidato_id: candidateId,
          jobId,
          vaga_id: jobId,
          etapa_pipeline: 'Inscritos',
          ordem_etapa: 1,
          status: 'em_andamento',
          pontuacao_compatibilidade: 0,
          origem: 'portal_vagas',
          data_candidatura: now,
          atualizado_em: now,
        },
      });
    }

    // Notifica perfis reais vinculados ao tenant; nenhuma identidade fixa é inventada.
    const recipients = new Map<string, Record<string, any>>();
    for (const fieldPath of ['empresaId', 'companyId']) {
      const rows = await queryFirestoreByString({
        projectId,
        accessToken,
        collection: 'usuarios',
        fieldPath,
        value: companyId,
      }).catch(() => []);
      rows.forEach((row) => row.id && recipients.set(String(row.id), row));
    }

    await Promise.allSettled(
      [...recipients.values()]
        .filter((profile) => {
          const role = text(profile.role || profile.tipoUsuario).toUpperCase();
          const permissions = new Set([...(profile.permissions || []), ...(profile.permissoes || [])].map(String));
          return ['ADMIN_EMPRESA', 'RECRUTADOR', 'GESTOR_EMPRESA'].includes(role)
            || permissions.has('recrutamento')
            || permissions.has('candidatos');
        })
        .map((profile) => patchFirestoreDocument({
          projectId,
          accessToken,
          collection: 'notificacoes',
          documentId: stableEntityId('notif', `${applicationId}:${profile.id}`),
          data: {
            ...tenantAliases,
            usuario_id: String(profile.id),
            titulo: 'Nova inscrição no Portal de Vagas',
            mensagem: `${name} se inscreveu na vaga "${text(job.titulo || job.title)}".`,
            lida: false,
            link: '/recrutamento',
            candidatura_id: applicationId,
            criado_em: now,
          },
        }))
    );

    return Response.json({
      success: true,
      duplicate: Boolean(existingApplication),
      candidatoId: candidateId,
      candidaturaId: applicationId,
    }, { status: existingApplication ? 200 : 201, headers: JSON_HEADERS });
  } catch (error: any) {
    return Response.json({
      success: false,
      error: String(error?.message || 'Não foi possível registrar a candidatura.'),
    }, { status: 500, headers: JSON_HEADERS });
  }
}
