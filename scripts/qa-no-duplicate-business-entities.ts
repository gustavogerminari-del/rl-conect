import fs from 'node:fs';
import assert from 'node:assert/strict';

const data = fs.readFileSync('src/services/dataService.ts', 'utf8');
const publicApi = fs.readFileSync('server/publicApplicationsRoutes.ts', 'utf8');
const adminUsers = fs.readFileSync('server/adminUserRoutes.ts', 'utf8');

function block(startToken: string, endToken: string) {
  const start = data.indexOf(startToken);
  assert.ok(start >= 0, `Início não encontrado: ${startToken}`);
  const end = data.indexOf(endToken, start + startToken.length);
  assert.ok(end > start, `Fim não encontrado para ${startToken}`);
  return data.slice(start, end);
}

const checks: Array<[string, () => void]> = [
  ['Empresa: CNPJ normalizado + reutilização', () => {
    const x = block('public createEmpresa', 'public updateEmpresa');
    assert.match(x, /normalizeDocument\(data\.cnpj\)/);
    assert.match(x, /existing/);
    assert.match(x, /duplicidade evitada/);
  }],
  ['Usuário local: e-mail normalizado + reutilização', () => {
    const x = block('public createUsuario', 'public async createFirebaseAccess');
    assert.match(x, /normalizeEmail\(data\.email\)/);
    assert.match(x, /existing/);
  }],
  ['Usuário Firebase Auth: getUserByEmail antes de createUser', () => {
    assert.ok(adminUsers.indexOf('getUserByEmail') < adminUsers.indexOf('createUser'));
    assert.ok(adminUsers.includes("collection('usuarios').doc(authUser.uid)"));
  }],
  ['Vaga: mesma empresa + origem + cliente + título reutiliza ativa', () => {
    const x = block('public createVaga', 'public updateVaga');
    for (const token of ['this.activeEmpresaId', 'titleKey', 'originKey', 'clientKey', 'existing']) assert.ok(x.includes(token));
    assert.match(x, /v\.status !== 'encerrada'/);
  }],
  ['Candidato: empresa + e-mail único', () => {
    const x = block('public createCandidato', 'public getCandidaturas');
    assert.match(x, /normalizeEmail\(data\.email\)/);
    assert.match(x, /existing/);
    assert.match(x, /stableEntityId\('cand'/);
  }],
  ['Candidatura interna: empresa + vaga + candidato única', () => {
    assert.ok(data.includes('existingApplication'));
    assert.ok(data.includes("stableEntityId('cand_app'"));
  }],
  ['Portal público: candidato e candidatura usam IDs determinísticos', () => {
    assert.ok(publicApi.includes("stableId('cand', `${companyId}:${email}`)"));
    assert.ok(publicApi.includes("stableId('cand_app', `${companyId}:${jobId}:${candidateId}`)"));
    assert.ok(publicApi.includes('appSnap.exists'));
    assert.ok(publicApi.includes('duplicidade evitada'));
  }],
  ['Banco de Talentos público: empresa + candidato único', () => {
    assert.ok(publicApi.includes("stableId('talent', `${companyId}:${candidateId}`)"));
    assert.ok(publicApi.includes("router.post('/talent-pool'"));
    assert.ok(publicApi.includes('reused = appSnap.exists'));
  }],
  ['Entrevista: candidatura + data/hora única', () => {
    const x = block('public createEntrevista', 'public updateEntrevista');
    assert.ok(x.includes('candidatura_id'));
    assert.ok(x.includes('data_hora'));
    assert.ok(x.includes('existing'));
    assert.match(x, /stableEntityId\('ent'/);
  }],
  ['Admissão: uma solicitação por candidatura', () => {
    const x = block('public moveCandidaturaEtapa', 'public applyToVagaPublic');
    assert.ok(x.includes("stableEntityId('adm'"));
    assert.ok(x.includes('admissoesPendentes.some'));
  }],
  ['Funcionário: CPF ou e-mail único por empresa', () => {
    const x = block('public createFuncionario', 'public getRegistroPontos');
    assert.ok(x.includes('cpfKey'));
    assert.ok(x.includes('emailKey'));
    assert.ok(x.includes('existing'));
    assert.match(x, /stableEntityId\('func'/);
  }],
  ['Cliente Headhunter: documento único por empresa', () => {
    const x = block('public createCliente', 'public getFuncionarios');
    assert.match(x, /normalizeDocument\(data\.cnpj_cpf\)/);
    assert.ok(x.includes('existing'));
    assert.match(x, /stableEntityId\('cli'/);
  }],
  ['Cobrança Headhunter: uma cobrança por candidatura', () => {
    const x = block('public moveCandidaturaEtapa', 'public applyToVagaPublic');
    assert.ok(x.includes("stableEntityId('cob'"));
    assert.ok(x.includes('cobrancasHeadhunter.some'));
    assert.ok(x.includes("FINANCEIRO_HEADHUNTER"));
  }],
];

let failed = 0;
for (const [name, fn] of checks) {
  try { fn(); console.log(`✅ ${name}`); }
  catch (error) { failed += 1; console.error(`❌ ${name}`); console.error(error instanceof Error ? error.message : error); }
}
if (failed) {
  console.error(`\n❌ ${failed} regra(s) globais de duplicidade falharam.`);
  process.exit(1);
}
console.log(`\n✅ ${checks.length} regras globais anti-duplicidade passaram.`);
