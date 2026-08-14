from pathlib import Path


def replace_once(path: str, old: str, new: str):
    p = Path(path)
    text = p.read_text(encoding='utf-8')
    if old not in text:
        raise SystemExit(f'Pattern not found in {path}: {old[:180]!r}')
    p.write_text(text.replace(old, new, 1), encoding='utf-8')

path = 'src/services/dataService.ts'

# Shared normalization helpers.
replace_once(path,
"function saveToStorage<T>(key: string, value: T): void {\n  try {\n    localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(value));\n  } catch (err) {\n    console.error('Error saving to storage:', err);\n  }\n}\n",
"function saveToStorage<T>(key: string, value: T): void {\n  try {\n    localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(value));\n  } catch (err) {\n    console.error('Error saving to storage:', err);\n  }\n}\n\nfunction normalizeDocument(value?: string): string {\n  return String(value || '').replace(/\\D/g, '');\n}\n\nfunction normalizeEmail(value?: string): string {\n  return String(value || '').trim().toLowerCase();\n}\n")

# Empresa: one CNPJ = one company.
replace_once(path,
"  public createEmpresa(data: Omit<Empresa, 'id' | 'criado_em'>): Empresa {\n    const newEmp: Empresa = {",
"  public createEmpresa(data: Omit<Empresa, 'id' | 'criado_em'>): Empresa {\n    const document = normalizeDocument(data.cnpj);\n    const existing = document ? this.empresas.find((e) => normalizeDocument(e.cnpj) === document) : undefined;\n    if (existing) {\n      Object.assign(existing, { ...data, id: existing.id, criado_em: existing.criado_em });\n      this.addLog('EDICAO', `Empresa ${existing.nome} reutilizada por CNPJ; duplicidade evitada.`);\n      this.notify();\n      return existing;\n    }\n\n    const newEmp: Empresa = {")

# Candidate manual creation: reuse same company/email.
replace_once(path,
"  public createCandidato(data: Omit<Candidato, 'id' | 'criado_em' | 'empresa_id'>): Candidato {\n    const newCand: Candidato = {\n      ...data,\n      id: 'cand_' + Date.now(),\n      empresa_id: this.activeEmpresaId,\n      criado_em: new Date().toISOString(),\n    };\n    this.candidatos.unshift(newCand);\n    this.notify();\n    return newCand;\n  }",
"  public createCandidato(data: Omit<Candidato, 'id' | 'criado_em' | 'empresa_id'>): Candidato {\n    const email = normalizeEmail(data.email);\n    const existing = this.candidatos.find(\n      (c) => c.empresa_id === this.activeEmpresaId && normalizeEmail(c.email) === email\n    );\n    if (existing) {\n      Object.assign(existing, { ...data, id: existing.id, empresa_id: existing.empresa_id, criado_em: existing.criado_em });\n      this.addLog('EDICAO', `Candidato ${existing.nome} reutilizado por e-mail; duplicidade evitada.`);\n      this.notify();\n      return existing;\n    }\n\n    const newCand: Candidato = {\n      ...data,\n      id: 'cand_' + Date.now(),\n      empresa_id: this.activeEmpresaId,\n      criado_em: new Date().toISOString(),\n    };\n    this.candidatos.unshift(newCand);\n    this.notify();\n    return newCand;\n  }")

# Public application: same candidate + same job must not create a second application.
replace_once(path,
"    // RULE 7: Create candidature with empresa_id, vaga_id, candidato_id, origem = 'portal_vagas'\n    const candidatura: Candidatura = {",
"    // RULE 7 + IDEMPOTENCY: one candidate can have only one application per job/company.\n    const existingApplication = this.candidaturas.find(\n      (c) => c.empresa_id === empresaTargetId && c.vaga_id === vagaId && c.candidato_id === cand!.id\n    );\n    if (existingApplication) {\n      this.addLog('EDICAO', `Candidatura existente de ${cand.nome} na vaga ${vagaId} reutilizada; duplicidade evitada.`);\n      this.notify();\n      return { candidato: cand, candidatura: existingApplication };\n    }\n\n    const candidatura: Candidatura = {")

# Talent pool: one public talent-pool registration per candidate/company.
replace_once(path,
"    const candidatura: Candidatura = {\n      id: 'cand_app_' + Date.now(),\n      empresa_id: empresaTargetId,\n      vaga_id: vagaId,\n      candidato_id: cand.id,\n      etapa_pipeline: 'Inscritos',\n      ordem_etapa: 1,\n      status: 'em_andamento',\n      pontuacao_compatibilidade: 85,\n      origem: 'banco_talentos_portal',",
"    const existingTalentApplication = this.candidaturas.find(\n      (c) => c.empresa_id === empresaTargetId && c.candidato_id === cand!.id && c.origem === 'banco_talentos_portal'\n    );\n    if (existingTalentApplication) {\n      this.addLog('EDICAO', `Cadastro existente de ${cand.nome} no Banco de Talentos reutilizado; duplicidade evitada.`);\n      this.notify();\n      return { candidato: cand, candidatura: existingTalentApplication };\n    }\n\n    const candidatura: Candidatura = {\n      id: 'cand_app_' + Date.now(),\n      empresa_id: empresaTargetId,\n      vaga_id: vagaId,\n      candidato_id: cand.id,\n      etapa_pipeline: 'Inscritos',\n      ordem_etapa: 1,\n      status: 'em_andamento',\n      pontuacao_compatibilidade: 85,\n      origem: 'banco_talentos_portal',")

# Interview: same application + same datetime = same interview.
replace_once(path,
"  public createEntrevista(data: Omit<Entrevista, 'id' | 'criado_em' | 'empresa_id'>): Entrevista {\n    const newEnt: Entrevista = {",
"  public createEntrevista(data: Omit<Entrevista, 'id' | 'criado_em' | 'empresa_id'>): Entrevista {\n    const existing = this.entrevistas.find(\n      (e) =>\n        e.empresa_id === this.activeEmpresaId &&\n        e.candidatura_id === data.candidatura_id &&\n        e.data_hora === data.data_hora &&\n        e.status !== 'cancelada'\n    );\n    if (existing) {\n      this.addLog('EDICAO', `Entrevista ${existing.id} reutilizada; agendamento duplicado evitado.`);\n      return existing;\n    }\n\n    const newEnt: Entrevista = {")

# Client: same company/document = one client.
replace_once(path,
"  public createCliente(data: Omit<Cliente, 'id' | 'criado_em' | 'empresa_id'>): Cliente {\n    const newCli: Cliente = {",
"  public createCliente(data: Omit<Cliente, 'id' | 'criado_em' | 'empresa_id'>): Cliente {\n    const document = normalizeDocument(data.cnpj_cpf);\n    const existing = document\n      ? this.clientes.find((c) => c.empresa_id === this.activeEmpresaId && normalizeDocument(c.cnpj_cpf) === document)\n      : undefined;\n    if (existing) {\n      Object.assign(existing, { ...data, id: existing.id, empresa_id: existing.empresa_id, criado_em: existing.criado_em });\n      this.addLog('EDICAO', `Cliente Headhunter ${existing.nome} reutilizado por documento; duplicidade evitada.`);\n      this.notify();\n      return existing;\n    }\n\n    const newCli: Cliente = {")

# Employee: same company + CPF/email = one employee.
replace_once(path,
"  public createFuncionario(data: Partial<Funcionario> & { nome: string; cpf: string; email: string; salario: number }): Funcionario {\n    const newFunc: Funcionario = {",
"  public createFuncionario(data: Partial<Funcionario> & { nome: string; cpf: string; email: string; salario: number }): Funcionario {\n    const cpf = normalizeDocument(data.cpf);\n    const email = normalizeEmail(data.email);\n    const existing = this.funcionarios.find(\n      (f) =>\n        f.empresa_id === this.activeEmpresaId &&\n        ((cpf && normalizeDocument(f.cpf) === cpf) || (email && normalizeEmail(f.email) === email))\n    );\n    if (existing) {\n      Object.assign(existing, { ...data, id: existing.id, empresa_id: existing.empresa_id, criado_em: existing.criado_em });\n      this.addLog('EDICAO', `Funcionário ${existing.nome} reutilizado por CPF/e-mail; duplicidade evitada.`);\n      this.notify();\n      return existing;\n    }\n\n    const newFunc: Funcionario = {")

# Strengthen E2E tests with explicit idempotency/duplicate assertions.
path = 'scripts/e2e-flow-tests.ts'
replace_once(path,
"const pendingAdmission = admissions.find((a: any) => a.candidatura_id === internalApplication.id);\nassert.ok(pendingAdmission, 'contratação interna não foi encaminhada para admissão');\nassert.equal(pendingAdmission.destination, 'ADMISSION');\nassert.equal(pendingAdmission.status, 'PENDENTE_DOCUMENTOS');",
"const pendingAdmission = admissions.find((a: any) => a.candidatura_id === internalApplication.id);\nassert.ok(pendingAdmission, 'contratação interna não foi encaminhada para admissão');\nassert.equal(pendingAdmission.destination, 'ADMISSION');\nassert.equal(pendingAdmission.status, 'PENDENTE_DOCUMENTOS');\nconst admissionCount = dataService.getAdmissoesPendentes().length;\ndataService.moveCandidaturaEtapa(internalApplication.id, 'Contratado');\nassert.equal(dataService.getAdmissoesPendentes().length, admissionCount, 'reprocessar Contratado duplicou admissão');")

replace_once(path,
"assert.equal(employee?.email, 'lucas.fernandes@email.com');\nlog('Recrutamento -> DP', `${pendingAdmission.destination} -> colaborador ${employee?.nome}`);",
"assert.equal(employee?.email, 'lucas.fernandes@email.com');\nconst employeeCount = dataService.getFuncionarios().length;\nconst sameEmployee = dataService.createFuncionario({\n  nome: employee!.nome,\n  cpf: employee!.cpf,\n  email: employee!.email,\n  salario: employee!.salario,\n});\nassert.equal(sameEmployee.id, employee!.id, 'funcionário duplicado não foi reutilizado');\nassert.equal(dataService.getFuncionarios().length, employeeCount, 'funcionário duplicado foi criado');\nlog('Recrutamento -> DP', `${pendingAdmission.destination} -> colaborador ${employee?.nome}`);")

replace_once(path,
"const { candidatura: hhApplication } = dataService.applyToVagaPublic(hhJob.id, {\n  nome: 'Candidato QA Headhunter',\n  email: 'qa.headhunter@example.com',\n  telefone: '(43) 99999-0000',\n  cidade: 'Londrina',\n  estado: 'PR',\n  cargo_desejado: 'CFO',\n  tags: ['Executive'],\n  habilidades: ['Finanças', 'M&A'],\n  curriculo_texto: 'Executivo financeiro com experiência em liderança, M&A e controladoria.',\n});",
"const candidatePayload = {\n  nome: 'Candidato QA Headhunter',\n  email: 'qa.headhunter@example.com',\n  telefone: '(43) 99999-0000',\n  cidade: 'Londrina',\n  estado: 'PR',\n  cargo_desejado: 'CFO',\n  tags: ['Executive'],\n  habilidades: ['Finanças', 'M&A'],\n  curriculo_texto: 'Executivo financeiro com experiência em liderança, M&A e controladoria.',\n};\nconst applicationCountBefore = dataService.getCandidaturas().length;\nconst candidateCountBefore = dataService.getCandidatos().length;\nconst firstApply = dataService.applyToVagaPublic(hhJob.id, candidatePayload);\nconst secondApply = dataService.applyToVagaPublic(hhJob.id, candidatePayload);\nconst hhApplication = firstApply.candidatura;\nassert.equal(secondApply.candidato.id, firstApply.candidato.id, 'candidato por e-mail foi duplicado');\nassert.equal(secondApply.candidatura.id, firstApply.candidatura.id, 'mesma candidatura na mesma vaga foi duplicada');\nassert.equal(dataService.getCandidatos().length, candidateCountBefore + 1, 'quantidade de candidatos inesperada');\nassert.equal(dataService.getCandidaturas().length, applicationCountBefore + 1, 'quantidade de candidaturas inesperada');")

replace_once(path,
"assert.ok(Number(charge.valor) > 0, 'fee headhunter não pode ser zero');\nassert.equal(charge.valor, 87500);",
"assert.ok(Number(charge.valor) > 0, 'fee headhunter não pode ser zero');\nassert.equal(charge.valor, 87500);\nconst chargeCount = dataService.getCobrancasHeadhunter().length;\ndataService.moveCandidaturaEtapa(hhApplication.id, 'Contratado');\nassert.equal(dataService.getCobrancasHeadhunter().length, chargeCount, 'reprocessar Contratado duplicou cobrança');")

replace_once(path,
"assert.equal(calculateHeadhunterFee(6000, '0%'), null);\nlog('Headhunter -> Financeiro', `${charge.destination} -> R$ ${charge.valor}`);",
"assert.equal(calculateHeadhunterFee(6000, '0%'), null);\nconst clientCount = dataService.getClientes().length;\nconst sameClient = dataService.createCliente({\n  nome: 'Banco Safira Investimentos Atualizado',\n  cnpj_cpf: '33.111.222/0001-88',\n  email: 'contato@bancosafira.com.br',\n  telefone: '(11) 3000-5000',\n  responsavel: 'Fernanda Machado',\n  status: 'ativo',\n  vagas_contratadas: 3,\n  taxa_headhunter: '22% do salário',\n});\nassert.equal(sameClient.id, 'cli_1', 'cliente por CNPJ foi duplicado');\nassert.equal(dataService.getClientes().length, clientCount, 'quantidade de clientes aumentou com CNPJ repetido');\nlog('Headhunter -> Financeiro', `${charge.destination} -> R$ ${charge.valor}`);")

replace_once(path,
"console.log('[E2E] PASSOU: 2 fluxos completos sem travar.');",
"console.log('[E2E] PASSOU: 2 fluxos completos sem travar e sem duplicidade.');")

print('Idempotency guards and duplicate tests applied.')
# trigger-v2
