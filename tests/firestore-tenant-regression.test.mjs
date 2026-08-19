import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const rules = await readFile(new URL('../firebase/firestore.rules', import.meta.url), 'utf8');

test('usuarios é canônico e users é apenas fallback', () => {
  assert.match(rules, /hasPrimary\(\) && profileActive\(primary\(\)\)/);
  assert.match(rules, /!hasPrimary\(\) && hasLegacy\(\) && profileActive\(legacy\(\)\)/);
});

test('regras aceitam todos os aliases de tenant usados pelo sistema', () => {
  for (const alias of ['empresa_id', 'empresaId', 'companyId', 'tenantId']) {
    assert.ok(rules.includes(alias), `Alias de tenant ausente: ${alias}`);
  }
});

test('coleções essenciais de DP estão isoladas por tenant', () => {
  for (const collection of ['funcionarios', 'registroPontos', 'ferias', 'exames_ocupacionais', 'dp_beneficios', 'dp_folhas', 'dp_afastamentos', 'dp_retornos']) {
    assert.ok(rules.includes(`'${collection}'`), `Coleção de DP ausente nas regras: ${collection}`);
  }
  assert.match(rules, /match \/\{collectionName\}\/\{id\}/);
  assert.match(rules, /master\(\) \|\| sameTenant\(resource\.data\)/);
  assert.match(rules, /tenantCreate\(request\.resource\.data\)/);
});

test('bloqueio padrão permanece ativo', () => {
  assert.match(rules, /match \/\{document=\*\*\} \{ allow read, write: if false; \}/);
});
