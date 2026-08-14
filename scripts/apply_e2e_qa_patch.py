from pathlib import Path


def replace_once(path: str, old: str, new: str):
    p = Path(path)
    text = p.read_text(encoding='utf-8')
    if old not in text:
        raise SystemExit(f'Pattern not found in {path}: {old[:120]!r}')
    p.write_text(text.replace(old, new, 1), encoding='utf-8')


def replace_all(path: str, old: str, new: str):
    p = Path(path)
    text = p.read_text(encoding='utf-8')
    if old not in text:
        raise SystemExit(f'Pattern not found in {path}: {old[:120]!r}')
    p.write_text(text.replace(old, new), encoding='utf-8')

# 1) Data safety + real hiring routing
path = 'src/services/dataService.ts'
replace_once(path, "} from '../types';\n", "} from '../types';\nimport { calculateHeadhunterFee, resolveHiringDestination } from './businessRules';\n")
replace_once(
    path,
    "    const saved = localStorage.getItem(STORAGE_PREFIX + key);\n    if (saved) return JSON.parse(saved);",
    "    const saved = localStorage.getItem(STORAGE_PREFIX + key);\n    if (saved) {\n      const parsed = JSON.parse(saved);\n      if (Array.isArray(defaultValue) && !Array.isArray(parsed)) return defaultValue;\n      return parsed as T;\n    }"
)
replace_once(
    path,
    "  private pagamentos: Pagamento[] = loadFromStorage('pagamentos', initialPagamentos);",
    "  private pagamentos: Pagamento[] = loadFromStorage('pagamentos', initialPagamentos);\n  private admissoesPendentes: any[] = loadFromStorage('admissoesPendentes', []);\n  private cobrancasHeadhunter: any[] = loadFromStorage('cobrancasHeadhunter', []);"
)
replace_once(
    path,
    "    saveToStorage('pagamentos', this.pagamentos);",
    "    saveToStorage('pagamentos', this.pagamentos);\n    saveToStorage('admissoesPendentes', this.admissoesPendentes);\n    saveToStorage('cobrancasHeadhunter', this.cobrancasHeadhunter);"
)
replace_once(
    path,
    "  public getVagas(moduloOrigem?: 'recrutamento' | 'headhunter'): Vaga[] {\n    let list = this.filterByEmpresa(this.vagas);",
    "  public getVagas(moduloOrigem?: 'recrutamento' | 'headhunter'): Vaga[] {\n    let list = this.filterByEmpresa(this.vagas).map((v) => ({\n      ...v,\n      requisitos: Array.isArray(v.requisitos) ? v.requisitos : [],\n      diferenciais: Array.isArray(v.diferenciais) ? v.diferenciais : [],\n      beneficios: Array.isArray(v.beneficios) ? v.beneficios : [],\n    }));"
)
replace_once(
    path,
    "  public getCandidatos(): Candidato[] {\n    return this.filterByEmpresa(this.candidatos);\n  }",
    "  public getCandidatos(): Candidato[] {\n    return this.filterByEmpresa(this.candidatos).map((c) => ({\n      ...c,\n      tags: Array.isArray(c.tags) ? c.tags : [],\n      habilidades: Array.isArray(c.habilidades) ? c.habilidades : [],\n    }));\n  }"
)
old_move = """  public moveCandidaturaEtapa(candidaturaId: string, novaEtapa: Candidatura['etapa_pipeline']): void {
    const candApp = this.candidaturas.find((c) => c.id === candidaturaId);
    if (candApp) {
      candApp.etapa_pipeline = novaEtapa;
      candApp.atualizado_em = new Date().toISOString();
      this.addLog('EDICAO', `Candidatura ID ${candidaturaId} movida para etapa \"${novaEtapa}\".`);
      this.notify();
    }
  }
"""
new_move = """  public moveCandidaturaEtapa(candidaturaId: string, novaEtapa: Candidatura['etapa_pipeline']): void {
    const candApp = this.candidaturas.find((c) => c.id === candidaturaId);
    if (!candApp) return;

    candApp.etapa_pipeline = novaEtapa;
    candApp.atualizado_em = new Date().toISOString();

    if (novaEtapa === 'Contratado') {
      candApp.status = 'aprovado';
      const vaga = this.vagas.find((v) => v.id === candApp.vaga_id);
      const candidato = this.candidatos.find((c) => c.id === candApp.candidato_id);
      if (vaga && candidato) {
        const destination = resolveHiringDestination(vaga.modulo_origem);
        if (destination === 'ADMISSION') {
          const exists = this.admissoesPendentes.some((a) => a.candidatura_id === candApp.id && a.status !== 'CONCLUIDA');
          if (!exists) {
            this.admissoesPendentes.unshift({
              id: 'adm_' + Date.now(),
              empresa_id: candApp.empresa_id,
              candidatura_id: candApp.id,
              vaga_id: vaga.id,
              candidato_id: candidato.id,
              candidato_nome: candidato.nome,
              candidato_email: candidato.email,
              cargo: vaga.cargo || vaga.titulo,
              departamento: vaga.departamento || 'Geral',
              salario_sugerido: vaga.salario_min || vaga.salario_max || 0,
              status: 'PENDENTE_DOCUMENTOS',
              destination,
              criado_em: new Date().toISOString(),
            });
          }
          this.addLog('CRIACAO', `Contratação ${candApp.id} encaminhada para ADMISSION/DP.`);
        } else {
          const exists = this.cobrancasHeadhunter.some((c) => c.candidatura_id === candApp.id);
          if (!exists) {
            const salario = vaga.salario_min || vaga.salario_max || 0;
            const valor = calculateHeadhunterFee(salario, vaga.honorario_headhunter);
            this.cobrancasHeadhunter.unshift({
              id: 'cob_' + Date.now(),
              empresa_id: candApp.empresa_id,
              candidatura_id: candApp.id,
              vaga_id: vaga.id,
              candidato_id: candidato.id,
              candidato_nome: candidato.nome,
              cliente_id: vaga.cliente_id,
              salario_base: salario,
              regra_fee: vaga.honorario_headhunter || '',
              valor,
              status: valor && valor > 0 ? 'AGUARDANDO_COBRANCA' : 'PENDENTE_DADOS_COMERCIAIS',
              destination,
              criado_em: new Date().toISOString(),
            });
          }
          this.addLog('CRIACAO', `Contratação ${candApp.id} encaminhada para FINANCEIRO_HEADHUNTER.`);
        }
      }
    }

    this.addLog('EDICAO', `Candidatura ID ${candidaturaId} movida para etapa \"${novaEtapa}\".`);
    this.notify();
  }
"""
replace_once(path, old_move, new_move)
replace_once(
    path,
    "      sincronizado_gcal: true,\n      criado_em: new Date().toISOString(),",
    "      sincronizado_gcal: Boolean(data.sincronizado_gcal),\n      criado_em: new Date().toISOString(),"
)
replace_once(
    path,
    "  // --- ENTREVISTAS & AGENDA ---",
    """  // --- CONTRATAÇÃO / ADMISSÃO / FINANCEIRO HEADHUNTER ---
  public getAdmissoesPendentes(): any[] {
    return this.filterByEmpresa(this.admissoesPendentes);
  }

  public concluirAdmissao(admissaoId: string, cpf: string, salario?: number): Funcionario | null {
    const adm = this.admissoesPendentes.find((a) => a.id === admissaoId);
    if (!adm || adm.status === 'CONCLUIDA') return null;
    const candidato = this.candidatos.find((c) => c.id === adm.candidato_id);
    if (!candidato || !cpf.trim()) return null;

    const existing = this.funcionarios.find(
      (f) => f.empresa_id === adm.empresa_id && f.email.toLowerCase() === candidato.email.toLowerCase()
    );
    if (existing) {
      adm.status = 'CONCLUIDA';
      adm.funcionario_id = existing.id;
      this.notify();
      return existing;
    }

    const funcionario = this.createFuncionario({
      nome: candidato.nome,
      cpf: cpf.trim(),
      email: candidato.email,
      telefone: candidato.telefone,
      cargo: adm.cargo,
      departamento: adm.departamento,
      salario: Number(salario || adm.salario_sugerido || 0),
      data_admissao: new Date().toISOString().slice(0, 10),
      status: 'ativo',
    });
    adm.status = 'CONCLUIDA';
    adm.funcionario_id = funcionario.id;
    this.addLog('CRIACAO', `Admissão ${adm.id} concluída e colaborador ${funcionario.nome} criado no DP.`);
    this.notify();
    return funcionario;
  }

  public getCobrancasHeadhunter(): any[] {
    return this.filterByEmpresa(this.cobrancasHeadhunter);
  }

  // --- ENTREVISTAS & AGENDA ---"""
)
replace_all(path, "link_reuniao: 'https://meet.google.com/abc-defg-hij',", "link_reuniao: undefined,")
replace_all(path, "link_reuniao: 'https://meet.google.com/xyz-uvwx-rst',", "link_reuniao: undefined,")
replace_all(path, "sincronizado_gcal: true,", "sincronizado_gcal: false,")

# 2) Recruitment: unified jobs and safer legacy data rendering
path = 'src/components/views/RecruitmentView.tsx'
replace_all(path, "dataService.getVagas('recrutamento')", "dataService.getVagas()")
replace_all(path, "app.candidato.tags.slice(0, 3)", "(app.candidato.tags || []).slice(0, 3)")
replace_all(path, "cand.habilidades.map((h, i)", "(cand.habilidades || []).map((h, i)")
replace_once(
    path,
    "<p className=\"text-xs text-slate-500\">{vaga.departamento}</p>",
    "<p className=\"text-xs text-slate-500\">{vaga.departamento}</p>\n                    <span className={`mt-1 inline-block rounded px-2 py-0.5 text-[9px] font-extrabold uppercase ${vaga.modulo_origem === 'headhunter' ? 'bg-violet-100 text-violet-700' : 'bg-sky-100 text-sky-700'}`}>\n                      Origem: {vaga.modulo_origem === 'headhunter' ? 'Headhunter' : 'Recrutamento'}\n                    </span>"
)

# 3) DP: show pending admissions generated by the hiring flow
path = 'src/components/views/DepartamentoPessoalView.tsx'
replace_once(path, "const [activeTab, setActiveTab] = useState<'colaboradores' | 'ponto' | 'ferias' | 'documentos'>('colaboradores');",
             "const [activeTab, setActiveTab] = useState<'admissoes' | 'colaboradores' | 'ponto' | 'ferias' | 'documentos'>('admissoes');")
replace_once(path, "  const [showFuncModal, setShowFuncModal] = useState(false);",
             "  const admissoesPendentes = dataService.getAdmissoesPendentes();\n\n  const [showFuncModal, setShowFuncModal] = useState(false);")
replace_once(path, "      {/* TAB 1: COLABORADORES */}", """      {activeTab === 'admissoes' && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="font-bold text-slate-900">Admissões encaminhadas pelo Recrutamento</h2>
            <p className="mt-1 text-xs text-slate-500">Candidatos de recrutamento interno chegam aqui automaticamente ao atingir Contratado.</p>
          </div>
          {admissoesPendentes.filter((a) => a.status !== 'CONCLUIDA').length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-xs text-slate-500">Nenhuma admissão pendente.</div>
          ) : admissoesPendentes.filter((a) => a.status !== 'CONCLUIDA').map((adm) => (
            <div key={adm.id} className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-xs">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="font-extrabold text-slate-900">{adm.candidato_nome}</h3>
                  <p className="text-slate-600">{adm.cargo} • {adm.departamento}</p>
                  <p className="mt-1 font-bold text-amber-800">Status: {adm.status}</p>
                </div>
                <button onClick={() => {
                  const cpf = window.prompt('Informe o CPF do colaborador para concluir a admissão:') || '';
                  if (!cpf.trim()) return;
                  const salarioStr = window.prompt('Informe o salário de admissão:', String(adm.salario_sugerido || 0)) || '';
                  const salario = Number(salarioStr.replace(',', '.'));
                  const result = dataService.concluirAdmissao(adm.id, cpf, salario);
                  if (!result) window.alert('Não foi possível concluir a admissão. Confira CPF e salário.');
                  refreshData();
                }} className="rounded-xl bg-emerald-600 px-4 py-2 font-bold text-white hover:bg-emerald-700">Concluir admissão no DP</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* TAB 1: COLABORADORES */}""")
replace_once(path, "      {/* Tabs */}\n      <div className=\"flex items-center gap-2 border-b border-slate-200 pb-2\">",
             """      {/* Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => setActiveTab('admissoes')}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition ${activeTab === 'admissoes' ? 'bg-amber-500 text-slate-950 shadow-md' : 'bg-white text-slate-600 hover:bg-slate-100'}`}
        >
          <UserPlus className="h-4 w-4" />
          Admissões Pendentes ({admissoesPendentes.filter((a) => a.status !== 'CONCLUIDA').length})
        </button>""")
replace_all(path, "func.salario.toLocaleString('pt-BR')", "Number(func.salario || 0).toLocaleString('pt-BR')")

# 4) Headhunter: financial destination visible, no zero-fee charge masquerading as ready
path = 'src/components/views/HeadhunterView.tsx'
replace_once(path, "const [activeTab, setActiveTab] = useState<'vagas' | 'clientes'>('vagas');",
             "const [activeTab, setActiveTab] = useState<'vagas' | 'clientes' | 'financeiro'>('vagas');")
replace_once(path, "  // New Client Form", "  const cobrancas = dataService.getCobrancasHeadhunter();\n\n  // New Client Form")
replace_once(path, "      {/* Shared Jobs View */}", """        <button
          onClick={() => setActiveTab('financeiro')}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition ${activeTab === 'financeiro' ? 'bg-indigo-600 text-white shadow-md' : 'bg-white text-slate-600 hover:bg-slate-100'}`}
        >
          <DollarSign className="h-4 w-4" />
          Financeiro ({cobrancas.length})
        </button>
      </div>

      {activeTab === 'financeiro' && (
        <div className="space-y-4">
          <div className="rounded-xl border border-indigo-100 bg-indigo-50 p-4 text-xs text-indigo-950">
            Contratações de vagas com origem Headhunter são roteadas para FINANCEIRO_HEADHUNTER. Cobrança só fica AGUARDANDO_COBRANCA quando o fee calculado é maior que zero.
          </div>
          {cobrancas.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-xs text-slate-500">Nenhuma contratação Headhunter encaminhada ao financeiro.</div>
          ) : cobrancas.map((c) => (
            <div key={c.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm text-xs">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="font-extrabold text-slate-900">{c.candidato_nome}</h3>
                  <p className="text-slate-500">Regra: {c.regra_fee || 'Pendente'}</p>
                  <p className="mt-2 text-base font-black text-emerald-700">{c.valor ? `R$ ${Number(c.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : 'Fee não configurado'}</p>
                </div>
                <span className={`rounded-full px-3 py-1 text-[10px] font-extrabold ${c.status === 'AGUARDANDO_COBRANCA' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>{c.status}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Shared Jobs View */}""")
# Remove the original closing div for tabs because insertion above closes it.
replace_once(path, "        </button>\n      </div>\n\n      {/* Shared Jobs View */}", "        </button>\n")

print('E2E QA patch applied successfully')
