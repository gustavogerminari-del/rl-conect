const normalizeAccessKey = (value: unknown): string => String(value || '').trim();
const normalizeRole = (value: unknown): string => String(value || '').trim().toUpperCase().replace(/[\s-]+/g, '_');

const ADMIN_BASE_PERMISSIONS = ['dashboard', 'configuracoes'];

const MODULE_PERMISSION_MAP: Record<string, string[]> = {
  recrutamento: ['recrutamento', 'vagas', 'candidatos', 'entrevistas', 'contratacoes'],
  vagas: ['vagas'],
  candidatos: ['candidatos'],
  entrevistas: ['entrevistas'],
  contratacoes: ['contratacoes'],
  bancoTalentos: ['bancoTalentos'],
  banco_talentos: ['bancoTalentos'],
  departamentoPessoal: ['departamentoPessoal', 'admissao', 'funcionarios', 'documentos'],
  departamento_pessoal: ['departamentoPessoal', 'admissao', 'funcionarios', 'documentos'],
  departamentopessoal: ['departamentoPessoal', 'admissao', 'funcionarios', 'documentos'],
  dp: ['departamentoPessoal', 'admissao', 'funcionarios', 'documentos'],
  admissao: ['admissao'],
  funcionarios: ['funcionarios'],
  colaboradores: ['funcionarios'],
  documentos: ['documentos'],
  ponto: ['pontoEletronico'],
  pontoEletronico: ['pontoEletronico'],
  folha: ['folhaPagamento'],
  folhaPagamento: ['folhaPagamento'],
  feriasBeneficios: ['feriasBeneficios'],
  equipeInterna: ['equipeInterna'],
  equipe_interna: ['equipeInterna'],
  'equipe-interna': ['equipeInterna'],
  consultorRH: ['consultorRH'],
  documentosAssinatura: ['documentosAssinatura'],
  auditoria: ['auditoria'],
  auditoriaLogs: ['auditoria', 'auditoriaLogs'],
  relatorios: ['relatorios'],
  relatoriosAvancados: ['relatorios', 'relatoriosAvancados'],
  siteVagas: ['siteVagas'],
  siteVagasPersonalizado: ['siteVagas', 'siteVagasPersonalizado'],
  api: ['api'],
  headhunter: ['headhunter'],
  financeiroHeadhunter: ['financeiroHeadhunter'],
  comercial: ['comercial'],
  clientes: ['clientes'],
};

function addPermission(target: Set<string>, value: unknown) {
  const permission = normalizeAccessKey(value);
  if (permission) target.add(permission);
}

/** Converte módulos liberados no Painel Master em permissões persistidas. */
export function buildProvisionedPermissions(
  role: unknown,
  explicitPermissions: string[] = [],
  modules: Record<string, boolean> = {},
  tipoUsuario: unknown = ''
): string[] {
  const permissions = new Set<string>();
  explicitPermissions.forEach(permission => addPermission(permissions, permission));

  const normalizedRole = normalizeRole(role || tipoUsuario);
  const normalizedType = normalizeRole(tipoUsuario);
  const identities = [normalizedRole, normalizedType];
  const isPlatform = identities.some(value =>
    ['MASTER', 'MASTER_ADMIN', 'DEVELOPER', 'DEVELOPER_ADMIN', 'DESENVOLVEDOR'].includes(value)
  );
  if (isPlatform) return [...permissions];

  const isCompanyAdmin = identities.some(value =>
    ['ADMIN_EMPRESA', 'ADMINISTRADOR_EMPRESA', 'EMPRESA_ADMIN', 'GESTOR_EMPRESA', 'ADMIN', 'ADMINISTRADOR'].includes(value)
  );
  if (isCompanyAdmin) ADMIN_BASE_PERMISSIONS.forEach(permission => permissions.add(permission));

  Object.entries(modules || {}).forEach(([moduleKey, enabled]) => {
    if (enabled !== true) return;
    addPermission(permissions, moduleKey);
    (MODULE_PERMISSION_MAP[moduleKey] || []).forEach(permission => permissions.add(permission));
  });

  return [...permissions];
}
