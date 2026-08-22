import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const route = readFileSync(new URL('../app/api/integrations/ponto/route.ts', import.meta.url), 'utf8');
const service = readFileSync(new URL('../src/services/PontoIntegrationService.ts', import.meta.url), 'utf8');
const master = readFileSync(new URL('../src/master-admin/components/MasterAdminView.tsx', import.meta.url), 'utf8');

const compact = (value) => value.replace(/\s+/g, ' ');

test('integração usa um único token servidor-servidor e nenhuma credencial por empresa', () => {
  assert.match(route, /PONTO_RH_SYSTEM_TOKEN/);
  assert.match(route, /PONTO_RH_BASE_URL/);
  assert.doesNotMatch(route, /clientSecretEncrypted/);
  assert.doesNotMatch(route, /PONTO_RH_INTEGRATION_KEY/);
  assert.doesNotMatch(service, /clientSecret/);
  assert.doesNotMatch(service, /clientId/);
  assert.doesNotMatch(master, /Client Secret/);
  assert.doesNotMatch(master, /Client ID/);
});

test('empresa comum é sempre resolvida pela sessão Firebase e MASTER pode provisionar empresa selecionada', () => {
  const source = compact(route);
  assert.match(source, /const companyId = String\(profile\.empresaId \|\| profile\.companyId/);
  assert.match(source, /if \(identity\.isMaster\) return String\(requested/);
  assert.match(source, /return identity\.companyId/);
  assert.match(source, /Provisionamento automático é exclusivo do MASTER/);
});

test('ativação de DP ou Ponto dispara provisionamento automático no Painel Master', () => {
  assert.match(master, /onSnapshot\(collection\(db, 'empresas'\)/);
  assert.match(master, /departamentoPessoal/);
  assert.match(master, /PontoIntegrationService\.ensure\(companyDoc\.id\)/);
  assert.doesNotMatch(master, /Integração PONTO RH/);
  assert.doesNotMatch(master, /PontoIntegrationPanel/);
});

test('backend provisiona tenant central usando empresaId do RH-MIL', () => {
  const source = compact(route);
  assert.match(source, /\/api\/v1\/internal\/rh-mil\/tenants\/sync/);
  assert.match(source, /empresaId: companyId/);
  assert.match(source, /companyName: companyName\(company\)/);
  assert.match(source, /cnpj: companyCnpj\(company\)/);
  assert.match(source, /automatico: true/);
});

test('sincronização central mantém empresaId em todos os dados gravados', () => {
  const source = compact(route);
  assert.match(source, /\/internal\/rh-mil\/tenants\/\$\{encodeURIComponent\(companyId\)\}\/marcacoes/);
  assert.match(source, /\/internal\/rh-mil\/tenants\/\$\{encodeURIComponent\(companyId\)\}\/banco-horas/);
  assert.match(source, /collection: 'registros_ponto'/);
  assert.match(source, /collection: 'ponto_banco_horas'/);
  assert.match(source, /empresaId: companyId/);
  assert.match(source, /companyId,/);
});
