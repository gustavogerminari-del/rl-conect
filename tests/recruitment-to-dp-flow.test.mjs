import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const service = await readFile(new URL('../src/services/dataService.ts', import.meta.url), 'utf8');

test('candidato Contratado gera admissão pendente', () => {
  assert.match(service, /novaEtapa === 'Contratado'/);
  assert.match(service, /destination === 'ADMISSION'/);
  assert.match(service, /this\.admissoesPendentes\.unshift/);
  assert.match(service, /PENDENTE_DOCUMENTOS/);
});

test('admissão pendente pode virar funcionário', () => {
  assert.match(service, /concluirAdmissao\(/);
  assert.match(service, /isValidCpfForAdmission\(cpf\)/);
  assert.match(service, /this\.createFuncionario/);
  assert.match(service, /adm\.status = 'CONCLUIDA'/);
});

test('headhunter continua indo ao financeiro e não ao DP', () => {
  assert.match(service, /FINANCEIRO_HEADHUNTER/);
  assert.match(service, /AGUARDANDO_COBRANCA/);
});
