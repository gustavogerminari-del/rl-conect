import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const text = async (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('Firestore uses usuarios as canonical profile and users only as fallback', async () => {
  const rules = await text('firebase/firestore.rules');
  assert.match(rules, /hasPrimary\(\) && profileActive\(primary\(\)\)/);
  assert.match(rules, /!hasPrimary\(\) && hasLegacy\(\) && profileActive\(legacy\(\)\)/);
});

test('Firestore tenant isolation accepts all aliases used by RL Connect', async () => {
  const rules = await text('firebase/firestore.rules');
  for (const alias of ['empresa_id', 'empresaId', 'companyId', 'tenantId']) assert.ok(rules.includes(alias), `missing tenant alias ${alias}`);
});

test('Firestore allows the operational collections used by Firebase bridge and DP', async () => {
  const rules = await text('firebase/firestore.rules');
  for (const name of [
    'clientes','registroPontos','departamentos','cargos','logs','notificacoes','solicitacoes_admissao','financeiro_cobrancas',
    'exames_ocupacionais','dp_beneficios','dp_folhas','dp_afastamentos','dp_retornos'
  ]) assert.ok(rules.includes(`'${name}'`), `missing Firestore collection ${name}`);
});

test('automatic tenant persistence does not overwrite master commercial configuration', async () => {
  const bridge = await text('src/services/firebaseStateBridge.ts');
  assert.match(bridge, /MASTER_MANAGED_KEYS/);
  for (const key of ['empresaModulos', 'assinaturas', 'pagamentos', 'aiSettings']) assert.ok(bridge.includes(`'${key}'`), `missing protected key ${key}`);
  assert.match(bridge, /if \(MASTER_MANAGED_KEYS\.has\(key\)\) continue/);
});

test('DP screen contains the complete employee lifecycle', async () => {
  const dp = await text('src/components/views/DepartamentoPessoalView.tsx');
  for (const label of ['Admissões', 'Exames', 'Benefícios', 'Folha', 'Ponto', 'Férias', 'Afastamentos', 'Registrar retorno']) {
    assert.ok(dp.includes(label), `DP stage missing: ${label}`);
  }
  assert.ok(dp.includes("exame_admissional_status !== 'APTO'"), 'payroll must require APTO exam');
});

test('V55 deploy is triggered by application and Firebase changes and validates before deploy', async () => {
  const workflow = await text('.github/workflows/v55-cloudflare-deploy.yml');
  for (const path of ["'src/**'", "'firebase/**'", "'app/**'"]) assert.ok(workflow.includes(path), `deploy trigger missing ${path}`);
  assert.ok(workflow.includes('run: npm test'), 'deploy must run tests');
  assert.ok(workflow.includes('run: npm run build'), 'deploy must run build');
});
