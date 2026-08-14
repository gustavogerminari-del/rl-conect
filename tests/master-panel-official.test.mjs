import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = async (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('Painel Master usa somente serviços Firebase e não carrega defaults fictícios', async () => {
  const view = await read('src/master-admin/components/MasterAdminOfficialView.tsx');
  const service = await read('src/master-admin/services/masterOperationalService.ts');
  assert.match(view, /syncTenantsFromFirestore/);
  assert.match(view, /fetchPlansFirestore/);
  assert.match(view, /fetchModulosFirestore/);
  assert.match(view, /UserService\.list/);
  assert.doesNotMatch(view, /DEFAULT_|MOCK_|localStorage|indexedDB|Supabase/i);
  assert.match(service, /from 'firebase\/firestore'/);
  assert.doesNotMatch(service, /Supabase|PostgreSQL|localStorage|indexedDB/i);
});

test('menu oficial contém exatamente as doze áreas administrativas', async () => {
  const view = await read('src/master-admin/components/MasterAdminOfficialView.tsx');
  for (const label of ['Visão Geral','Leads','Empresas','Usuários e Permissões','Planos e Módulos','Financeiro','Faturamento / NFS-e','Suporte Técnico','Integrações / API','Backup','Auditoria e Logs','Configurações']) {
    assert.match(view, new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
});

test('coleções globais do Master ficam restritas a master nas regras', async () => {
  const rules = await read('firebase/firestore.rules');
  assert.match(rules, /master_admin/);
  for (const collection of ['master_leads','master_finance_receivables','master_finance_payables','master_nfse','master_support_tickets','master_integrations','master_backups','master_settings','master_idempotency']) {
    assert.match(rules, new RegExp(`match /${collection}/\\{id\\} \\{ allow read, write: if master\\(\\); \\}`));
  }
});

test('pagamentos possuem idempotência e auditoria atômica', async () => {
  const service = await read('src/master-admin/services/masterOperationalService.ts');
  assert.match(service, /master_idempotency/);
  assert.match(service, /registerPaymentOnce/);
  assert.match(service, /writeBatch\(db\)/);
  assert.match(service, /batch\.set\(idempotencyRef/);
  assert.match(service, /batch\.set\(entryRef/);
  assert.match(service, /batch\.set\(doc\(db, 'auditLogs'/);
});

test('n8n não foi incorporado ao serviço operacional do Master', async () => {
  const service = await read('src/master-admin/services/masterOperationalService.ts');
  assert.doesNotMatch(service, /N8nService|\/api\/n8n|webhook/i);
});
