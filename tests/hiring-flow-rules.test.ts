import assert from 'node:assert/strict';
import test from 'node:test';
import {
  admissionIdentity,
  applicationIdentity,
  billingIdentity,
  calculateHeadhunterFee,
  candidateIdentity,
  resolveHiringDestination,
  stableEntityId,
} from '../src/services/businessRules.ts';

test('Recrutamento contratado sempre segue para ADMISSION/DP', () => {
  assert.equal(resolveHiringDestination('recrutamento'), 'ADMISSION');
  assert.equal(resolveHiringDestination('portal_vagas'), 'ADMISSION');
});

test('Headhunter contratado sempre segue para financeiro headhunter', () => {
  assert.equal(resolveHiringDestination('headhunter'), 'FINANCEIRO_HEADHUNTER');
  assert.equal(resolveHiringDestination('HEADHUNTER_EXECUTIVE'), 'FINANCEIRO_HEADHUNTER');
});

test('fees de headhunter são calculadas sem valor zero ou regra ambígua', () => {
  assert.equal(calculateHeadhunterFee(6000, '35%'), 2100);
  assert.equal(calculateHeadhunterFee(6000, 'R$ 1.750 fixo'), 1750);
  assert.equal(calculateHeadhunterFee(35000, '2.5 salários'), 87500);
  assert.equal(calculateHeadhunterFee(6000, '0%'), null);
});

test('identidades determinísticas impedem duplicar candidato, candidatura, admissão e cobrança', () => {
  const candidate = candidateIdentity('empresa-1', ' Candidato@Email.com ');
  assert.equal(candidate, 'empresa-1:candidato@email.com');

  const candidateId1 = stableEntityId('cand', candidate);
  const candidateId2 = stableEntityId('cand', candidateIdentity('empresa-1', 'candidato@email.com'));
  assert.equal(candidateId1, candidateId2);

  const application = applicationIdentity('empresa-1', 'vaga-1', candidateId1);
  const applicationId1 = stableEntityId('app', application);
  const applicationId2 = stableEntityId('app', applicationIdentity('empresa-1', 'vaga-1', candidateId2));
  assert.equal(applicationId1, applicationId2);

  assert.equal(
    stableEntityId('admissao', admissionIdentity('empresa-1', applicationId1)),
    stableEntityId('admissao', admissionIdentity('empresa-1', applicationId2)),
  );
  assert.equal(
    stableEntityId('cobranca', billingIdentity('empresa-1', applicationId1)),
    stableEntityId('cobranca', billingIdentity('empresa-1', applicationId2)),
  );
});
