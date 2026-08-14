import fs from 'node:fs';
import assert from 'node:assert/strict';
import { calculateHeadhunterFee, resolveHiringDestination } from '../src/services/businessRules';

const dataService = fs.readFileSync('src/services/dataService.ts', 'utf8');
const recruitment = fs.readFileSync('src/components/views/RecruitmentView.tsx', 'utf8');
const headhunter = fs.readFileSync('src/components/views/HeadhunterView.tsx', 'utf8');
const ai = fs.readFileSync('src/components/views/AiScreeningView.tsx', 'utf8');
const agenda = fs.readFileSync('src/components/views/AgendaView.tsx', 'utf8');
const server = fs.readFileSync('server.ts', 'utf8');
const adminUsers = fs.readFileSync('server/adminUserRoutes.ts', 'utf8');

function method(name: string, nextMarker: string) {
  const start = dataService.indexOf(`public ${name}`);
  const end = dataService.indexOf(nextMarker, start + 1);
  assert.ok(start >= 0 && end > start, `Método ${name} não encontrado`);
  return dataService.slice(start, end);
}

const checks: Array<[string, () => void]> = [
  ['Empresa deduplica por CNPJ', () => {
    const block = method('createEmpresa', 'public updateEmpresa');
    assert.match(block, /normalizeDocument\(data\.cnpj\)/);
    assert.match(block, /existing/);
  }],
  ['Usuário deduplica por e-mail', () => {
    const block = method('createUsuario', 'public async createFirebaseAccess');
    assert.match(block, /normalizeEmail\(data\.email\)/);
    assert.match(block, /existing/);
  }],
  ['Criação de acesso provisiona Firebase Auth + perfil Firestore', () => {
    assert.ok(server.includes('registerAdminUserRoutes'));
    assert.ok(adminUsers.includes('adminAuth().createUser'));
    assert.ok(adminUsers.includes("collection('usuarios').doc(authUser.uid)"));
    assert.ok(adminUsers.includes('getUserByEmail'));
  }],
  ['Vaga normal possui proteção anti-duplicidade', () => {
    const block = method('createVaga', 'public updateVaga');
    assert.match(block, /const existing = this\.vagas\.find/);
    assert.match(block, /v\.status !== 'encerrada'/);
    assert.match(block, /duplicidade evitada/);
  }],
  ['Candidato é único por empresa + e-mail', () => {
    const block = method('createCandidato', 'public getCandidaturas');
    assert.match(block, /normalizeEmail\(data\.email\)/);
    assert.match(block, /existing/);
  }],
  ['Candidatura é única por empresa + vaga + candidato', () => {
    assert.match(dataService, /existingApplication[\s\S]{0,700}return \{ candidato: cand, candidatura: existingApplication \}/);
  }],
  ['Triagem IA atualiza candidatura real e não cria candidato artificial', () => {
    assert.ok(!ai.includes('ia.candidate.${Date.now()}'));
    assert.ok(!ai.includes('Candidato Analisado por IA'));
    assert.ok(ai.includes('updateCandidaturaPareceres'));
    assert.ok(ai.includes('selectedApplication.id'));
  }],
  ['Entrevista é idempotente e Meet não é inventado', () => {
    const block = method('createEntrevista', 'public updateEntrevista');
    assert.match(block, /existing/);
    assert.match(block, /stableEntityId/);
    assert.ok(!agenda.includes('meet.google.com/abc-defg-hij'));
  }],
  ['Recrutamento contratado vai para ADMISSION', () => {
    assert.equal(resolveHiringDestination('recrutamento'), 'ADMISSION');
  }],
  ['Headhunter contratado vai para FINANCEIRO_HEADHUNTER', () => {
    assert.equal(resolveHiringDestination('headhunter'), 'FINANCEIRO_HEADHUNTER');
  }],
  ['Admissão/funcionário não duplica por CPF ou e-mail', () => {
    const block = method('createFuncionario', 'public getRegistroPontos');
    assert.match(block, /normalizeDocument\(data\.cpf\)/);
    assert.match(block, /normalizeEmail\(data\.email\)/);
    assert.match(block, /existing/);
  }],
  ['Cliente Headhunter não duplica por documento', () => {
    const block = method('createCliente', 'public getFuncionarios');
    assert.match(block, /normalizeDocument\(data\.cnpj_cpf\)/);
    assert.match(block, /existing/);
  }],
  ['Interface permite criar vaga Headhunter com origem correta', () => {
    assert.ok(headhunter.includes("getVagas('headhunter')"));
    assert.ok(headhunter.includes("modulo_origem: 'headhunter'"));
    assert.ok(headhunter.includes('createVaga'));
    assert.ok(headhunter.includes('cliente_id: clienteVaga'));
    assert.ok(headhunter.includes('honorario_headhunter: feeVaga.trim()'));
  }],
  ['Fee percentual 6000 x 35% = 2100', () => assert.equal(calculateHeadhunterFee(6000, '35%'), 2100)],
  ['Fee percentual 8200 x 25% = 2050', () => assert.equal(calculateHeadhunterFee(8200, '25%'), 2050)],
  ['Fee percentual 9000 x 20% = 1800', () => assert.equal(calculateHeadhunterFee(9000, '20%'), 1800)],
  ['Fee fixo R$ 1.750 = 1750', () => assert.equal(calculateHeadhunterFee(0, 'R$ 1.750'), 1750)],
  ['Fee zero é inválido', () => assert.equal(calculateHeadhunterFee(6000, '0%'), null)],
  ['Recrutamento cria vaga somente com origem recrutamento', () => {
    assert.ok(recruitment.includes("modulo_origem: 'recrutamento'"));
  }],
];

let failed = 0;
for (const [name, check] of checks) {
  try {
    check();
    console.log(`✅ ${name}`);
  } catch (error) {
    failed += 1;
    console.error(`❌ ${name}`);
    console.error(error instanceof Error ? error.message : error);
  }
}

if (failed) {
  console.error(`\n${failed} verificação(ões) falharam.`);
  process.exit(1);
}
console.log(`\n✅ ${checks.length} verificações dos dois acessos passaram.`);
