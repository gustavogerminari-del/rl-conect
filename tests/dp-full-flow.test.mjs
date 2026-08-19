import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const file = await readFile(new URL('../src/components/views/DepartamentoPessoalView.tsx', import.meta.url), 'utf8');

test('DP recebe contratações do recrutamento', () => {
  assert.match(file, /getAdmissoesPendentes\(\)/);
  assert.match(file, /concluirAdmissao\(/);
  assert.match(file, /Vindo do Recrutamento/);
});

test('DP mantém etapas essenciais após admissão', () => {
  for (const token of [
    'Exame admissional',
    'beneficios_status',
    'folha_status',
    'afastamento_status',
    'Registrar afastamento',
    'Registrar retorno',
  ]) {
    assert.ok(file.includes(token), `Etapa obrigatória ausente: ${token}`);
  }
});

test('folha exige exame admissional apto', () => {
  assert.match(file, /exame_admissional_status !== 'APTO'/);
  assert.match(file, /Exame APTO obrigatório antes da folha/);
});

test('DP não referencia Supabase', () => {
  assert.equal(/supabase/i.test(file), false);
  assert.match(file, /persistido no Firebase/);
});
