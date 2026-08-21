import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const route = readFileSync(new URL('../app/api/integrations/ponto/route.ts', import.meta.url), 'utf8');
const service = readFileSync(new URL('../src/services/PontoIntegrationService.ts', import.meta.url), 'utf8');
const panel = readFileSync(new URL('../src/master-admin/components/PontoIntegrationPanel.tsx', import.meta.url), 'utf8');
const master = readFileSync(new URL('../src/master-admin/components/MasterAdminView.tsx', import.meta.url), 'utf8');

const compact = (value) => value.replace(/\s+/g, ' ');

test('segredo do PONTO RH é tratado somente no backend e criptografado', () => {
  assert.match(route, /PONTO_RH_INTEGRATION_KEY/);
  assert.match(route, /AES-GCM/);
  assert.match(route, /clientSecretEncrypted/);
  assert.doesNotMatch(service, /clientSecretEncrypted/);
  assert.doesNotMatch(panel, /clientSecretEncrypted/);
});

test('backend exige MASTER e valida a empresa no Firestore', () => {
  assert.match(route, /A integração do PONTO RH é exclusiva do usuário MASTER/);
  assert.match(route, /collection: 'empresas'/);
  assert.match(route, /Empresa não encontrada no RH-MIL/);
});

test('empresa usada na sincronização vem da configuração autenticada do RH-MIL', () => {
  const source = compact(route);
  assert.match(source, /const companyId = String\(body\.companyId/);
  assert.match(source, /empresaId: companyId/);
  assert.match(source, /companyId,/);
  assert.match(source, /collection: 'registros_ponto'/);
  assert.match(source, /collection: 'ponto_banco_horas'/);
});

test('teste de conexão usa token sistema-a-sistema e status real do PONTO RH', () => {
  assert.match(route, /\/api\/v1\/integracoes\/auth\/token/);
  assert.match(route, /\/api\/v1\/integracoes\/ponto\/status/);
  assert.match(route, /status: 'CONECTADO'/);
  assert.match(route, /O PONTO RH recusou as credenciais informadas/);
});

test('Painel Master possui acesso dedicado à integração de ponto', () => {
  assert.match(master, /Integração PONTO RH/);
  assert.match(master, /PontoIntegrationPanel/);
  assert.match(panel, /Client ID/);
  assert.match(panel, /Client Secret/);
  assert.match(panel, /Testar conexão/);
  assert.match(panel, /Sincronizar ponto agora/);
});
