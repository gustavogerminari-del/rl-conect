from pathlib import Path

# Master UI labels and real session identity
p = Path('src/components/views/MasterAdminView.tsx')
t = p.read_text(encoding='utf-8')
if "const currentUser = dataService.getCurrentUser();" not in t:
    t = t.replace("  const planos = dataService.getPlanos();\n", "  const planos = dataService.getPlanos();\n  const currentUser = dataService.getCurrentUser();\n")
t = t.replace('infraestrutura Supabase Cloud.', 'infraestrutura Firebase Cloud.')
t = t.replace('Supabase Auth: <span className="text-emerald-400 font-bold">Sim</span>', 'Firebase Auth: <span className="text-emerald-400 font-bold">Ativo</span>')
t = t.replace('<div>UID: <span className="font-mono text-slate-300">sPB_8392104918234</span></div>', '<div>UID: <span className="font-mono text-slate-300">{currentUser?.id || \'-\'}</span></div>')
t = t.replace('<div>E-mail: <span className="text-slate-200 font-medium">gustavo.germinari@gmail.com</span></div>', '<div>E-mail: <span className="text-slate-200 font-medium">{currentUser?.email || \'-\'}</span></div>')
t = t.replace('<div>Role: <span className="text-amber-400 font-bold">MASTER</span></div>', '<div>Role: <span className="text-amber-400 font-bold">{currentUser?.role || \'-\'}</span></div>')
t = t.replace('● SaaS Operacional • Supabase PostgreSQL', '● SaaS Operacional • Firebase Firestore')
p.write_text(t, encoding='utf-8')

# dataService: hydrate/persist all Master Builder state through Firestore mapped collections
p = Path('src/services/dataService.ts')
t = p.read_text(encoding='utf-8')
old_hydrate = "this.empresas=state.empresas||[];this.usuarios=state.usuarios||[];if(profile&&!this.usuarios.some(u=>u.id===profile.id))this.usuarios.push(profile as Usuario);\n    this.vagas=state.vagas||[];this.candidatos=state.candidatos||[];this.candidaturas=state.candidaturas||[];this.entrevistas=state.entrevistas||[];this.clientes=state.clientes||[];this.funcionarios=state.funcionarios||[];this.registroPontos=state.registroPontos||[];this.ferias=state.ferias||[];this.departamentos=state.departamentos||[];this.cargos=state.cargos||[];this.logs=state.logs||[];this.notificacoes=state.notificacoes||[];this.empresaModulos=state.empresaModulos||[];this.assinaturas=state.assinaturas||[];this.pagamentos=state.pagamentos||[];this.admissoesPendentes=state.admissoesPendentes||[];this.cobrancasHeadhunter=state.cobrancasHeadhunter||[];"
new_hydrate = old_hydrate + "\n    this.builderModules=state.builderModules||[];this.builderVersions=state.builderVersions||[];this.aiLogs=state.aiLogs||[];const aiSettingsRow=(state.aiSettings||[])[0];if(aiSettingsRow)this.ollamaSettings={...this.ollamaSettings,...aiSettingsRow};"
if old_hydrate in t and "this.builderModules=state.builderModules" not in t:
    t = t.replace(old_hydrate, new_hydrate)
old_persist = "cobrancasHeadhunter:this.cobrancasHeadhunter})"
new_persist = "cobrancasHeadhunter:this.cobrancasHeadhunter,builderModules:this.builderModules.map(x=>({...x,empresa_id:(x as any).empresa_id||this.activeEmpresaId})),builderVersions:this.builderVersions.map(x=>({...x,empresa_id:(x as any).empresa_id||this.activeEmpresaId})),aiLogs:this.aiLogs.map(x=>({...x,empresa_id:(x as any).empresa_id||this.activeEmpresaId})),aiSettings:[{...this.ollamaSettings,id:'master_ai_settings',empresa_id:this.activeEmpresaId}]})"
if old_persist in t:
    t = t.replace(old_persist, new_persist)
# Make builder version/log ids deterministic enough for intentional operations, and remove obsolete no-op storage calls.
t = t.replace("    saveToStorage('ollamaSettings', this.ollamaSettings);\n", "")
t = t.replace("    saveToStorage('builderModules', this.builderModules);\n", "")
t = t.replace("    saveToStorage('builderVersions', this.builderVersions);\n", "")
t = t.replace("    saveToStorage('aiLogs', this.aiLogs);\n", "")
# Ensure module ids are stable by slug for new AI modules so repeated same module doesn't fork before matching.
t = t.replace("        id: 'mod_' + Date.now(),\n        nome: res.module?.name || 'Módulo Customizado IA',\n        slug: res.module?.slug || 'modulo_' + Date.now().toString(36),", "        id: stableEntityId('builder_mod', `${this.activeEmpresaId}:${res.module?.slug || res.module?.name || 'modulo_customizado'}`),\n        nome: res.module?.name || 'Módulo Customizado IA',\n        slug: res.module?.slug || stableEntityId('modulo', res.module?.name || 'customizado'),")
p.write_text(t, encoding='utf-8')

print('Firebase Master UI/persistence cleanup applied.')
