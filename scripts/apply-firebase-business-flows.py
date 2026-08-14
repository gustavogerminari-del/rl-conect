from pathlib import Path
import re
p=Path('src/services/dataService.ts')
t=p.read_text(encoding='utf-8')

def once(old,new,label):
    global t
    if old not in t: raise SystemExit(f'{label}: pattern not found')
    t=t.replace(old,new,1)

# Business rules import
once("import { firebaseSessionService, normalizeRlRole } from './firebaseSessionService';\n", "import { firebaseSessionService, normalizeRlRole } from './firebaseSessionService';\nimport { calculateHeadhunterFee, normalizeDocument, normalizeEmail, resolveHiringDestination, stableEntityId, isValidCpfForAdmission } from './businessRules';\n", 'import')

# Additional Firebase-backed workflow stores.
once("  private pagamentos: Pagamento[] = loadFromStorage('pagamentos', initialPagamentos);\n", "  private pagamentos: Pagamento[] = loadFromStorage('pagamentos', initialPagamentos);\n  private admissoesPendentes: any[] = [];\n  private cobrancasHeadhunter: any[] = [];\n", 'stores')

# Hydration.
once("this.assinaturas=state.assinaturas||[];this.pagamentos=state.pagamentos||[];", "this.assinaturas=state.assinaturas||[];this.pagamentos=state.pagamentos||[];this.admissoesPendentes=state.admissoesPendentes||[];this.cobrancasHeadhunter=state.cobrancasHeadhunter||[];", 'hydrate')

# Persistence.
once("assinaturas:this.assinaturas,pagamentos:this.pagamentos", "assinaturas:this.assinaturas,pagamentos:this.pagamentos,admissoesPendentes:this.admissoesPendentes,cobrancasHeadhunter:this.cobrancasHeadhunter", 'persist')

# Company identity by CNPJ.
once("  public createEmpresa(data: Omit<Empresa, 'id' | 'criado_em'>): Empresa {\n    const newEmp: Empresa = {\n      ...data,\n      id: 'emp_' + Date.now(),", "  public createEmpresa(data: Omit<Empresa, 'id' | 'criado_em'>): Empresa {\n    const document = normalizeDocument(data.cnpj);\n    const existing = document ? this.empresas.find(e => normalizeDocument(e.cnpj) === document) : undefined;\n    if (existing) { Object.assign(existing, { ...data, id: existing.id, criado_em: existing.criado_em }); this.addLog('EDICAO', `Empresa ${existing.nome} reutilizada por CNPJ.`); this.notify(); return existing; }\n    const newEmp: Empresa = {\n      ...data,\n      id: stableEntityId('emp', document || `${data.nome}:${Date.now()}`),", 'company dedupe')

# Candidate manual identity.
old="""  public createCandidato(data: Omit<Candidato, 'id' | 'criado_em' | 'empresa_id'>): Candidato {
    const newCand: Candidato = {
      ...data,
      id: 'cand_' + Date.now(),
      empresa_id: this.activeEmpresaId,
      criado_em: new Date().toISOString(),
    };
    this.candidatos.unshift(newCand);
    this.notify();
    return newCand;
  }"""
new="""  public createCandidato(data: Omit<Candidato, 'id' | 'criado_em' | 'empresa_id'>): Candidato {
    const email = normalizeEmail(data.email);
    const existing = this.candidatos.find(c => c.empresa_id === this.activeEmpresaId && normalizeEmail(c.email) === email);
    if (existing) { Object.assign(existing, { ...data, id: existing.id, empresa_id: existing.empresa_id, criado_em: existing.criado_em }); this.addLog('EDICAO', `Candidato ${existing.nome} reutilizado por e-mail.`); this.notify(); return existing; }
    const newCand: Candidato = { ...data, id: stableEntityId('cand', `${this.activeEmpresaId}:${email}`), empresa_id: this.activeEmpresaId, criado_em: new Date().toISOString() };
    this.candidatos.unshift(newCand); this.notify(); return newCand;
  }"""
once(old,new,'candidate')

# Hiring route.
pattern=r"  public moveCandidaturaEtapa\(candidaturaId: string, novaEtapa: Candidatura\['etapa_pipeline'\]\): void \{.*?\n  \}\n\n  public applyToVagaPublic"
replacement="""  public moveCandidaturaEtapa(candidaturaId: string, novaEtapa: Candidatura['etapa_pipeline']): void {
    const candApp = this.candidaturas.find(c => c.id === candidaturaId);
    if (!candApp) return;
    candApp.etapa_pipeline = novaEtapa;
    candApp.atualizado_em = new Date().toISOString();
    if (novaEtapa === 'Contratado') {
      candApp.status = 'aprovado';
      const vaga = this.vagas.find(v => v.id === candApp.vaga_id);
      const candidato = this.candidatos.find(c => c.id === candApp.candidato_id);
      if (vaga && candidato) {
        const destination = resolveHiringDestination(vaga.modulo_origem);
        if (destination === 'ADMISSION') {
          const id = stableEntityId('adm', `${candApp.empresa_id}:${candApp.id}`);
          if (!this.admissoesPendentes.some(a => a.id === id)) this.admissoesPendentes.unshift({
            id, empresa_id: candApp.empresa_id, candidatura_id: candApp.id, vaga_id: vaga.id, candidato_id: candidato.id,
            candidato_nome: candidato.nome, candidato_email: candidato.email, cargo: vaga.cargo || vaga.titulo,
            departamento: vaga.departamento || 'Geral', salario_sugerido: vaga.salario_min || vaga.salario_max || 0,
            status: 'PENDENTE_DOCUMENTOS', destination, criado_em: new Date().toISOString(), atualizado_em: new Date().toISOString(),
          });
          this.addLog('CRIACAO', `Contratação ${candApp.id} encaminhada para ADMISSION/DP.`);
        } else {
          const id = stableEntityId('cob', `${candApp.empresa_id}:${candApp.id}`);
          if (!this.cobrancasHeadhunter.some(c => c.id === id)) {
            const salario = vaga.salario_min || vaga.salario_max || 0;
            const valor = calculateHeadhunterFee(salario, vaga.honorario_headhunter);
            this.cobrancasHeadhunter.unshift({ id, empresa_id: candApp.empresa_id, candidatura_id: candApp.id, vaga_id: vaga.id,
              candidato_id: candidato.id, candidato_nome: candidato.nome, cliente_id: vaga.cliente_id, salario_base: salario,
              regra_fee: vaga.honorario_headhunter || '', valor, status: valor && valor > 0 ? 'AGUARDANDO_COBRANCA' : 'PENDENTE_DADOS_COMERCIAIS',
              destination, criado_em: new Date().toISOString(), atualizado_em: new Date().toISOString() });
          }
          this.addLog('CRIACAO', `Contratação ${candApp.id} encaminhada para FINANCEIRO_HEADHUNTER.`);
        }
      }
    }
    this.addLog('EDICAO', `Candidatura ID ${candidaturaId} movida para etapa "${novaEtapa}".`); this.notify();
  }

  public applyToVagaPublic"""
t2,n=re.subn(pattern,replacement,t,flags=re.S)
if n!=1: raise SystemExit(f'move candidate replacement count {n}')
t=t2

# Public candidate deterministic id.
once("        id: 'cand_' + Date.now(),\n        empresa_id: empresaTargetId,", "        id: stableEntityId('cand', `${empresaTargetId}:${normalizeEmail(candidateData.email)}`),\n        empresa_id: empresaTargetId,", 'public candidate id')

# Public application idempotency: inject before candidature creation.
marker="    // RULE 7: Create candidature with empresa_id, vaga_id, candidato_id, origem = 'portal_vagas'\n    const candidatura: Candidatura = {"
if marker not in t: raise SystemExit('public application marker missing')
t=t.replace(marker,"""    const existingApplication = this.candidaturas.find(c => c.empresa_id === empresaTargetId && c.vaga_id === vagaId && c.candidato_id === cand!.id);
    if (existingApplication) { this.addLog('EDICAO', `Candidatura existente de ${cand.nome} reutilizada.`); this.notify(); return { candidato: cand, candidatura: existingApplication }; }
    // One Firebase document per company + job + candidate.
    const candidatura: Candidatura = {""",1)
once("      id: 'cand_app_' + Date.now(),\n      empresa_id: empresaTargetId,\n      vaga_id: vagaId,", "      id: stableEntityId('cand_app', `${empresaTargetId}:${vagaId}:${cand.id}`),\n      empresa_id: empresaTargetId,\n      vaga_id: vagaId,", 'application id')

# Interview idempotency and no fake sync.
old="""  public createEntrevista(data: Omit<Entrevista, 'id' | 'criado_em' | 'empresa_id'>): Entrevista {
    const newEnt: Entrevista = {
      ...data,
      id: 'ent_' + Date.now(),
      empresa_id: this.activeEmpresaId,
      sincronizado_gcal: true,
      criado_em: new Date().toISOString(),
    };
    this.entrevistas.unshift(newEnt);
    this.addLog('CRIACAO', `Entrevista \"${newEnt.titulo}\" agendada.`);
    this.notify();
    return newEnt;
  }"""
new="""  public createEntrevista(data: Omit<Entrevista, 'id' | 'criado_em' | 'empresa_id'>): Entrevista {
    const existing = this.entrevistas.find(e => e.empresa_id === this.activeEmpresaId && e.candidatura_id === data.candidatura_id && e.data_hora === data.data_hora && e.status !== 'cancelada');
    if (existing) return existing;
    const newEnt: Entrevista = { ...data, id: stableEntityId('ent', `${this.activeEmpresaId}:${data.candidatura_id}:${data.data_hora}`), empresa_id: this.activeEmpresaId, sincronizado_gcal: Boolean(data.sincronizado_gcal && data.link_reuniao), criado_em: new Date().toISOString() };
    this.entrevistas.unshift(newEnt); this.addLog('CRIACAO', `Entrevista \"${newEnt.titulo}\" agendada.`); this.notify(); return newEnt;
  }
  public updateEntrevista(id: string, updates: Partial<Entrevista>): Entrevista | null {
    const interview = this.entrevistas.find(e => e.id === id); if (!interview) return null;
    Object.assign(interview, updates, { id: interview.id, empresa_id: interview.empresa_id }); this.notify(); return interview;
  }"""
once(old,new,'interview')

# Client dedupe.
old="""  public createCliente(data: Omit<Cliente, 'id' | 'criado_em' | 'empresa_id'>): Cliente {
    const newCli: Cliente = {
      ...data,
      id: 'cli_' + Date.now(),
      empresa_id: this.activeEmpresaId,
      criado_em: new Date().toISOString(),
    };
    this.clientes.push(newCli);
    this.addLog('CRIACAO', `Cliente Headhunter \"${newCli.nome}\" cadastrado.`);
    this.notify();
    return newCli;
  }"""
new="""  public createCliente(data: Omit<Cliente, 'id' | 'criado_em' | 'empresa_id'>): Cliente {
    const document = normalizeDocument(data.cnpj_cpf); const existing = document ? this.clientes.find(c => c.empresa_id === this.activeEmpresaId && normalizeDocument(c.cnpj_cpf) === document) : undefined;
    if (existing) { Object.assign(existing, { ...data, id: existing.id, empresa_id: existing.empresa_id, criado_em: existing.criado_em }); this.notify(); return existing; }
    const newCli: Cliente = { ...data, id: stableEntityId('cli', `${this.activeEmpresaId}:${document || normalizeEmail(data.email)}`), empresa_id: this.activeEmpresaId, criado_em: new Date().toISOString() };
    this.clientes.push(newCli); this.addLog('CRIACAO', `Cliente Headhunter \"${newCli.nome}\" cadastrado.`); this.notify(); return newCli;
  }"""
once(old,new,'client')

# Employee dedupe.
needle="  public createFuncionario(data: Partial<Funcionario> & { nome: string; cpf: string; email: string; salario: number }): Funcionario {\n    const newFunc: Funcionario = {"
replacement="""  public createFuncionario(data: Partial<Funcionario> & { nome: string; cpf: string; email: string; salario: number }): Funcionario {
    const cpfKey = normalizeDocument(data.cpf); const emailKey = normalizeEmail(data.email);
    const existing = this.funcionarios.find(f => f.empresa_id === this.activeEmpresaId && ((cpfKey && normalizeDocument(f.cpf) === cpfKey) || (emailKey && normalizeEmail(f.email) === emailKey)));
    if (existing) { Object.assign(existing, { ...data, id: existing.id, empresa_id: existing.empresa_id, criado_em: existing.criado_em }); this.notify(); return existing; }
    const newFunc: Funcionario = {"""
once(needle,replacement,'employee head')
once("      id: 'func_' + Date.now(),\n      empresa_id: this.activeEmpresaId,", "      id: stableEntityId('func', `${this.activeEmpresaId}:${cpfKey || emailKey}`),\n      empresa_id: this.activeEmpresaId,", 'employee id')

# Insert admission/billing API before Interviews.
marker="  // --- ENTREVISTAS & AGENDA ---"
if marker not in t: raise SystemExit('interview marker missing')
methods="""  // --- CONTRATAÇÃO / ADMISSÃO / FINANCEIRO HEADHUNTER ---
  public getAdmissoesPendentes(): any[] { return this.filterByEmpresa(this.admissoesPendentes); }
  public concluirAdmissao(admissaoId: string, cpf: string, salario?: number): Funcionario | null {
    const adm = this.admissoesPendentes.find(a => a.id === admissaoId); if (!adm || adm.status === 'CONCLUIDA') return null;
    const candidato = this.candidatos.find(c => c.id === adm.candidato_id); const salary = Number(salario || adm.salario_sugerido || 0);
    if (!candidato || !isValidCpfForAdmission(cpf) || !(salary > 0)) return null;
    const previousCompany = this.activeEmpresaId; this.activeEmpresaId = adm.empresa_id;
    const funcionario = this.createFuncionario({ nome: candidato.nome, cpf: cpf.trim(), email: candidato.email, telefone: candidato.telefone, cargo: adm.cargo, departamento: adm.departamento, salario: salary, data_admissao: new Date().toISOString().slice(0,10), status: 'ativo' });
    this.activeEmpresaId = previousCompany; adm.status = 'CONCLUIDA'; adm.funcionario_id = funcionario.id; adm.atualizado_em = new Date().toISOString(); this.notify(); return funcionario;
  }
  public getCobrancasHeadhunter(): any[] { return this.filterByEmpresa(this.cobrancasHeadhunter); }

"""
t=t.replace(marker,methods+marker,1)

p.write_text(t,encoding='utf-8')
print('Firebase hiring flow patch applied.')
