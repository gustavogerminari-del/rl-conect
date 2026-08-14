import fs from 'node:fs';
import assert from 'node:assert/strict';
import { calculateHeadhunterFee, resolveHiringDestination } from '../src/services/businessRules';

const dataService = fs.readFileSync('src/services/dataService.ts', 'utf8');
const recruitment = fs.readFileSync('src/components/views/RecruitmentView.tsx', 'utf8');
const headhunter = fs.readFileSync('src/components/views/HeadhunterView.tsx', 'utf8');
const ai = fs.readFileSync('src/components/views/AiScreeningView.tsx', 'utf8');
const agenda = fs.readFileSync('src/components/views/AgendaView.tsx', 'utf8');
const server = fs.readFileSync('server.ts', 'utf8');

const checks: Array<[string, () => void]> = [
  ['Empresa deduplica por CNPJ', () => {
    assert.match(dataService, /createEmpresa[\s\S]*normalizeDocument\(data\.cnpj\)[\s\S]*existing/);
  }],
  ['Usuário deduplica por e-mail', () => {
    assert.match(dataService, /createUsuario[\s\S]{0,1200}normalizeEmail\(data\.email\)[\s\S]{0,1200}existing/);
  }],
  ['Criação de acesso possui provisionamento Firebase Auth', () => {
    assert.ok(server.includes('registerAdminUserRoutes') || fs.existsSync('server/adminUserRoutes.ts'));
  }],
  ['Vaga normal possui proteção anti-duplicidade', () => {
    assert.match(dataService, /createVaga[\s\S]{0,1800}existing/);
  }],
  ['Candidato é único por empresa + e-mail', () => {
    assert.match(dataService, /createCandidato[\s\S]{0,1400}normalizeEmail\(data\.email\)[\s\S]{0,1400}existing/);
  }],
  ['Candidatura é única por empresa + vaga + candidato', () => {
    assert.match(dataService, /existingApplication[\s\S]{0,700}return \{ candidato: cand, candidatura: existingApplication \}/);
  }],
  ['Triagem IA atualiza candidatura real e não cria candidato artificial', () => {
    assert.ok(!ai.includes('ia.candidate.${Date.now()}'));
    assert.ok(ai.includes('updateCandidaturaPareceres'));
  }],
  ['Entrevista é idempotente e Meet não é inventado', () => {
    assert.match(dataService, /createEntrevista[\s\S]{0,1200}existing[\s\S]{0,1200}stableEntityId/);
    assert.ok(!agenda.includes('meet.google.com/abc-defg-hij'));
  }],
  ['Recrutamento contratado vai para ADMISSION', () => {
    assert.equal(resolveHiringDestination('recrutamento'), 'ADMISSION');
  }],
  ['Headhunter contratado vai para FINANCEIRO_HEADHUNTER', () => {
    assert.equal(resolveHiringDestination('headhunter'), 'FINANCEIRO_HEADHUNTER');
  }],
  ['Admissão/funcionário não duplica por CPF ou e-mail', () => {
    assert.match(dataService, /createFuncionario[\s\S]{0,1600}normalizeDocument\(data\.cpf\)[\s\S]{0,1600}normalizeEmail\(data\.email\)[\s\S]{0,1600}existing/);
  }],
  ['Cliente Headhunter não duplica por documento', () => {
    assert.match(dataService, /createCliente[\s\S]{0,1400}normalizeDocument\(data\.cnpj_cpf\)[\s\S]{0,1400}existing/);
  }],
  ['Interface permite criar vaga Headhunter com origem correta', () => {
    assert.ok(headhunter.includes("modulo_origem: 'headhunter'"));
    assert.ok(headhunter.includes('createVaga'));
  }],
  ['Fee percentual 6000 x 35% = 2100', () => assert.equal(calculateHeadhunterFee(6000, '35%'), 2100)],
  ['Fee percentual 8200 x 25% = 2050', () => assert.equal(calculateHeadhunterFee(8200, '25%'), 2050)],
  ['Fee percentual 9000 x 20% = 1800', () => assert.equal(calculateHeadhunterFee(9000, '20%'), 1800)],
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
