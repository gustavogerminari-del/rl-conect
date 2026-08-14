import assert from 'node:assert/strict';

class MemoryStorage {
  private store = new Map<string, string>();
  getItem(key: string) { return this.store.get(key) ?? null; }
  setItem(key: string, value: string) { this.store.set(key, String(value)); }
  removeItem(key: string) { this.store.delete(key); }
  clear() { this.store.clear(); }
  key(index: number) { return Array.from(this.store.keys())[index] ?? null; }
  get length() { return this.store.size; }
}

Object.defineProperty(globalThis, 'localStorage', { value: new MemoryStorage(), configurable: true });

const { dataService } = await import('../src/services/dataService.ts');
const { calculateHeadhunterFee, resolveHiringDestination } = await import('../src/services/businessRules.ts');

function log(label: string, value: unknown) {
  console.log(`[E2E] ${label}:`, value);
}

// FLOW 1 - Recrutamento interno -> Contratado -> ADMISSION -> DP
assert.equal(resolveHiringDestination('recrutamento'), 'ADMISSION');
const internalApplication = dataService.getCandidaturas().find((c) => c.id === 'cand_app_1');
assert.ok(internalApplication, 'candidatura interna seed não encontrada');

dataService.moveCandidaturaEtapa(internalApplication.id, 'Contratado');
const admissions = dataService.getAdmissoesPendentes();
const pendingAdmission = admissions.find((a: any) => a.candidatura_id === internalApplication.id);
assert.ok(pendingAdmission, 'contratação interna não foi encaminhada para admissão');
assert.equal(pendingAdmission.destination, 'ADMISSION');
assert.equal(pendingAdmission.status, 'PENDENTE_DOCUMENTOS');
const admissionCount = dataService.getAdmissoesPendentes().length;
dataService.moveCandidaturaEtapa(internalApplication.id, 'Contratado');
assert.equal(dataService.getAdmissoesPendentes().length, admissionCount, 'reprocessar Contratado duplicou admissão');

const beforeEmployees = dataService.getFuncionarios().length;
const employee = dataService.concluirAdmissao(pendingAdmission.id, '123.456.789-09', 16000);
assert.ok(employee, 'DP não concluiu admissão');
assert.equal(dataService.getFuncionarios().length, beforeEmployees + 1);
assert.equal(employee?.email, 'lucas.fernandes@email.com');
const employeeCount = dataService.getFuncionarios().length;
const sameEmployee = dataService.createFuncionario({
  nome: employee!.nome,
  cpf: employee!.cpf,
  email: employee!.email,
  salario: employee!.salario,
});
assert.equal(sameEmployee.id, employee!.id, 'funcionário duplicado não foi reutilizado');
assert.equal(dataService.getFuncionarios().length, employeeCount, 'funcionário duplicado foi criado');
log('Recrutamento -> DP', `${pendingAdmission.destination} -> colaborador ${employee?.nome}`);

// FLOW 2 - Headhunter -> Contratado -> FINANCEIRO_HEADHUNTER
// Troca para usuário da empresa headhunter garantindo isolamento multiempresa.
dataService.setCurrentUser('usr_head_2');
assert.equal(dataService.getActiveEmpresa().id, 'emp_2');
assert.equal(resolveHiringDestination('headhunter'), 'FINANCEIRO_HEADHUNTER');

const hhJob = dataService.getVagas('headhunter').find((v) => v.id === 'vaga_3');
assert.ok(hhJob, 'vaga headhunter seed não encontrada');

const candidatePayload = {
  nome: 'Candidato QA Headhunter',
  email: 'qa.headhunter@example.com',
  telefone: '(43) 99999-0000',
  cidade: 'Londrina',
  estado: 'PR',
  cargo_desejado: 'CFO',
  tags: ['Executive'],
  habilidades: ['Finanças', 'M&A'],
  curriculo_texto: 'Executivo financeiro com experiência em liderança, M&A e controladoria.',
};
const applicationCountBefore = dataService.getCandidaturas().length;
const candidateCountBefore = dataService.getCandidatos().length;
const firstApply = dataService.applyToVagaPublic(hhJob.id, candidatePayload);
const secondApply = dataService.applyToVagaPublic(hhJob.id, candidatePayload);
const hhApplication = firstApply.candidatura;
assert.equal(secondApply.candidato.id, firstApply.candidato.id, 'candidato por e-mail foi duplicado');
assert.equal(secondApply.candidatura.id, firstApply.candidatura.id, 'mesma candidatura na mesma vaga foi duplicada');
assert.equal(dataService.getCandidatos().length, candidateCountBefore + 1, 'quantidade de candidatos inesperada');
assert.equal(dataService.getCandidaturas().length, applicationCountBefore + 1, 'quantidade de candidaturas inesperada');

dataService.moveCandidaturaEtapa(hhApplication.id, 'Contratado');
const charge = dataService.getCobrancasHeadhunter().find((c: any) => c.candidatura_id === hhApplication.id);
assert.ok(charge, 'contratação headhunter não foi encaminhada ao financeiro');
assert.equal(charge.destination, 'FINANCEIRO_HEADHUNTER');
assert.equal(charge.status, 'AGUARDANDO_COBRANCA');
assert.ok(Number(charge.valor) > 0, 'fee headhunter não pode ser zero');
assert.equal(charge.valor, 87500);
const chargeCount = dataService.getCobrancasHeadhunter().length;
dataService.moveCandidaturaEtapa(hhApplication.id, 'Contratado');
assert.equal(dataService.getCobrancasHeadhunter().length, chargeCount, 'reprocessar Contratado duplicou cobrança');
assert.equal(calculateHeadhunterFee(6000, '35%'), 2100);
assert.equal(calculateHeadhunterFee(6000, 'R$ 1.750 fixo'), 1750);
assert.equal(calculateHeadhunterFee(6000, '0%'), null);
const clientCount = dataService.getClientes().length;
const sameClient = dataService.createCliente({
  nome: 'Banco Safira Investimentos Atualizado',
  cnpj_cpf: '33.111.222/0001-88',
  email: 'contato@bancosafira.com.br',
  telefone: '(11) 3000-5000',
  responsavel: 'Fernanda Machado',
  status: 'ativo',
  vagas_contratadas: 3,
  taxa_headhunter: '22% do salário',
});
assert.equal(sameClient.id, 'cli_1', 'cliente por CNPJ foi duplicado');
assert.equal(dataService.getClientes().length, clientCount, 'quantidade de clientes aumentou com CNPJ repetido');
log('Headhunter -> Financeiro', `${charge.destination} -> R$ ${charge.valor}`);

console.log('[E2E] PASSOU: 2 fluxos completos sem travar e sem duplicidade.');
