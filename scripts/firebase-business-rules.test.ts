import assert from 'node:assert/strict';
import {
  applicationIdentity,
  calculateHeadhunterFee,
  candidateIdentity,
  resolveHiringDestination,
  stableEntityId,
} from '../src/services/businessRules.ts';

assert.equal(resolveHiringDestination('recrutamento'), 'ADMISSION');
assert.equal(resolveHiringDestination('headhunter'), 'FINANCEIRO_HEADHUNTER');
assert.equal(calculateHeadhunterFee(6000, '35%'), 2100);
assert.equal(calculateHeadhunterFee(6000, 'R$ 1.750 fixo'), 1750);
assert.equal(calculateHeadhunterFee(6000, '0%'), null);
assert.equal(calculateHeadhunterFee(0, '35%'), null);

const candidateA = stableEntityId('cand', candidateIdentity('emp_a', 'Pessoa@Email.com'));
const candidateRetry = stableEntityId('cand', candidateIdentity('emp_a', ' pessoa@email.com '));
assert.equal(candidateA, candidateRetry, 'mesmo e-mail/empresa deve gerar o mesmo candidato');

const appA = stableEntityId('cand_app', applicationIdentity('emp_a', 'vaga_1', candidateA));
const appRetry = stableEntityId('cand_app', applicationIdentity('emp_a', 'vaga_1', candidateA));
const appOtherJob = stableEntityId('cand_app', applicationIdentity('emp_a', 'vaga_2', candidateA));
assert.equal(appA, appRetry, 'retry não pode duplicar candidatura');
assert.notEqual(appA, appOtherJob, 'vagas diferentes devem ter candidaturas diferentes');

console.log('[FIREBASE RULES] PASSOU: destinos, fee e identidades idempotentes.');
