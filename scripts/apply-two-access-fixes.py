from pathlib import Path
import re

# --- server.ts: register Firebase Admin user provisioning routes ---
p = Path('server.ts')
t = p.read_text(encoding='utf-8')
if "registerAdminUserRoutes" not in t:
    t = t.replace("import { googleWorkspaceConfigured, registerGoogleWorkspaceRoutes } from './server/googleWorkspaceRoutes.js';\n", "import { googleWorkspaceConfigured, registerGoogleWorkspaceRoutes } from './server/googleWorkspaceRoutes.js';\nimport { registerAdminUserRoutes } from './server/adminUserRoutes.js';\n")
    t = t.replace("registerGoogleWorkspaceRoutes(app);\n", "registerGoogleWorkspaceRoutes(app);\nregisterAdminUserRoutes(app);\n")
p.write_text(t, encoding='utf-8')

# --- dataService: dedup user + vacancy and expose authenticated account provisioning ---
p = Path('src/services/dataService.ts')
t = p.read_text(encoding='utf-8')

create_vaga = r"""  public createVaga(data: Omit<Vaga, 'id' | 'criado_em' | 'empresa_id'>): Vaga {
    const titleKey = String(data.titulo || '').trim().toLowerCase();
    const originKey = data.modulo_origem || 'recrutamento';
    const clientKey = data.cliente_id || '';
    const existing = this.vagas.find(v =>
      v.empresa_id === this.activeEmpresaId &&
      String(v.titulo || '').trim().toLowerCase() === titleKey &&
      (v.modulo_origem || 'recrutamento') === originKey &&
      (v.cliente_id || '') === clientKey &&
      v.status !== 'encerrada'
    );
    if (existing) {
      Object.assign(existing, { ...data, id: existing.id, empresa_id: existing.empresa_id, criado_em: existing.criado_em });
      this.addLog('EDICAO', `Vaga "${existing.titulo}" reutilizada; duplicidade evitada.`);
      this.notify();
      return existing;
    }
    const newVaga: Vaga = {
      ...data,
      id: stableEntityId('vaga', `${this.activeEmpresaId}:${originKey}:${clientKey}:${titleKey}:${Date.now()}`),
      empresa_id: this.activeEmpresaId,
      criado_em: new Date().toISOString(),
    };
    this.vagas.unshift(newVaga);
    this.addLog('CRIACAO', `Vaga "${newVaga.titulo}" criada no módulo ${newVaga.modulo_origem}.`);
    this.notify();
    return newVaga;
  }
"""
t, count = re.subn(r"  public createVaga\(data: Omit<Vaga, 'id' \| 'criado_em' \| 'empresa_id'>\): Vaga \{[\s\S]*?\n  \}\n\n  public updateVaga", create_vaga + "\n  public updateVaga", t, count=1)
if count != 1:
    raise SystemExit('createVaga block not found')

create_user = r"""  public createUsuario(data: Omit<Usuario, 'id' | 'criado_em'>): Usuario {
    const email = normalizeEmail(data.email);
    if (!email) throw new Error('E-mail do usuário é obrigatório.');
    const existing = this.usuarios.find(u => normalizeEmail(u.email) === email);
    if (existing) {
      if (existing.empresa_id && data.empresa_id && existing.empresa_id !== data.empresa_id) {
        throw new Error('Este e-mail já pertence a outra empresa.');
      }
      Object.assign(existing, { ...data, id: existing.id, criado_em: existing.criado_em, email });
      this.addLog('EDICAO', `Usuário ${existing.nome} (${existing.email}) reutilizado por e-mail.`);
      this.notify();
      return existing;
    }
    const newUsr: Usuario = {
      ...data,
      email,
      id: stableEntityId('usr', email),
      criado_em: new Date().toISOString(),
    };
    this.usuarios.push(newUsr);
    this.addLog('CRIACAO', `Usuário ${newUsr.nome} (${newUsr.email}) criado.`);
    this.notify();
    return newUsr;
  }

  public async createFirebaseAccess(data: Omit<Usuario, 'id' | 'criado_em'>, password: string): Promise<Usuario> {
    const token = await firebaseSessionService.idToken();
    if (!token) throw new Error('Sessão Firebase obrigatória para criar acessos.');
    const response = await fetch('/api/admin/users', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify({ ...data, companyId: data.empresa_id, password }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result?.user) throw new Error(result?.error || 'Não foi possível criar o acesso Firebase.');
    const user = result.user as Usuario;
    const local = this.usuarios.find(u => normalizeEmail(u.email) === normalizeEmail(user.email));
    if (local) Object.assign(local, user);
    else this.usuarios.push(user);
    this.notify();
    return user;
  }
"""
t, count = re.subn(r"  public createUsuario\(data: Omit<Usuario, 'id' \| 'criado_em'>\): Usuario \{[\s\S]*?\n  \}\n\n  // --- CONSTRUTOR MASTER", create_user + "\n  // --- CONSTRUTOR MASTER", t, count=1)
if count != 1:
    raise SystemExit('createUsuario block not found')

p.write_text(t, encoding='utf-8')

# --- AI Screening: analyze an existing application/candidate, never create artificial candidates ---
ai = r'''import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, FileText, HelpCircle, Sparkles, Zap } from 'lucide-react';
import { dataService } from '../../services/dataService';

export const AiScreeningView: React.FC = () => {
  const vagas = dataService.getVagas();
  const candidaturas = dataService.getCandidaturas();
  const candidatos = dataService.getCandidatos();
  const [selectedVagaId, setSelectedVagaId] = useState(vagas[0]?.id || '');
  const applicationsForJob = useMemo(() => candidaturas.filter(c => c.vaga_id === selectedVagaId), [candidaturas, selectedVagaId]);
  const [selectedCandidaturaId, setSelectedCandidaturaId] = useState(applicationsForJob[0]?.id || '');
  const selectedApplication = candidaturas.find(c => c.id === selectedCandidaturaId);
  const selectedCandidate = candidatos.find(c => c.id === selectedApplication?.candidato_id);
  const selectedVaga = vagas.find(v => v.id === selectedVagaId);
  const [resumeTextInput, setResumeTextInput] = useState(selectedCandidate?.curriculo_texto || '');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<any>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const first = applicationsForJob[0];
    setSelectedCandidaturaId(first?.id || '');
  }, [selectedVagaId]);

  useEffect(() => {
    setResumeTextInput(selectedCandidate?.curriculo_texto || '');
    setAnalysisResult(null);
  }, [selectedCandidaturaId, selectedCandidate?.id]);

  const handleRunAiScreening = async () => {
    if (!selectedApplication || !selectedCandidate || !resumeTextInput.trim()) {
      setError('Selecione uma candidatura com currículo para executar a triagem.');
      return;
    }
    setError('');
    setIsAnalyzing(true);
    setAnalysisResult(null);
    try {
      const res = await fetch('/api/ai/evaluate-candidate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resumeText: resumeTextInput,
          jobTitle: selectedVaga?.titulo || 'Vaga',
          jobRequirements: selectedVaga?.requisitos || [],
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Falha na triagem por IA.');
      setAnalysisResult(data);
      dataService.updateCandidaturaPareceres(
        selectedApplication.id,
        undefined,
        data.parecer_ia || data.summary || '',
        Number.isFinite(Number(data.score)) ? Number(data.score) : undefined,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha na triagem por IA.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-6 text-white shadow-xl">
        <div className="flex items-center gap-4"><div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-400 text-slate-950"><Sparkles className="h-6 w-6" /></div><div><h1 className="text-xl font-extrabold">Centro de Triagem & IA</h1><p className="mt-0.5 text-xs text-indigo-200">A IA atualiza a candidatura real. Nenhum candidato artificial é criado.</p></div></div>
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
          <h2 className="flex items-center gap-2 font-bold text-slate-900"><FileText className="h-5 w-5 text-indigo-600" />Currículo da candidatura</h2>
          <div><label className="text-xs font-bold text-slate-700">Vaga</label><select value={selectedVagaId} onChange={e => setSelectedVagaId(e.target.value)} className="mt-1 w-full rounded-xl border p-2.5 text-xs">{vagas.map(v => <option key={v.id} value={v.id}>{v.titulo}</option>)}</select></div>
          <div><label className="text-xs font-bold text-slate-700">Candidato / candidatura</label><select value={selectedCandidaturaId} onChange={e => setSelectedCandidaturaId(e.target.value)} className="mt-1 w-full rounded-xl border p-2.5 text-xs"><option value="">Selecione</option>{applicationsForJob.map(app => { const cand = candidatos.find(c => c.id === app.candidato_id); return <option key={app.id} value={app.id}>{cand?.nome || app.candidato_id}</option>; })}</select></div>
          <textarea rows={10} value={resumeTextInput} onChange={e => setResumeTextInput(e.target.value)} className="w-full rounded-xl border p-3 text-xs" placeholder="Currículo do candidato" />
          {error && <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-bold text-rose-700">{error}</div>}
          <button onClick={() => void handleRunAiScreening()} disabled={isAnalyzing || !selectedApplication || !resumeTextInput.trim()} className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 py-3 text-xs font-bold text-white disabled:opacity-50"><Zap className="h-4 w-4" />{isAnalyzing ? 'Analisando...' : 'Executar análise e salvar na candidatura'}</button>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
          <h2 className="flex items-center gap-2 font-bold text-slate-900"><Sparkles className="h-5 w-5 text-amber-500" />Parecer da IA</h2>
          {!analysisResult && <div className="rounded-xl border border-dashed p-8 text-center text-xs text-slate-400">Selecione uma candidatura e execute a análise.</div>}
          {analysisResult && <div className="space-y-4 text-xs"><div className="rounded-xl bg-slate-900 p-4 text-white"><div className="text-2xl font-black">{analysisResult.score ?? '-'}% Compatibility</div><div className="mt-1 text-indigo-200">{analysisResult.recomendacao || 'Analisado'}</div></div><div className="rounded-xl bg-slate-50 p-4"><strong>Resumo:</strong> {analysisResult.summary || analysisResult.parecer_ia}</div><div className="grid gap-3 sm:grid-cols-2"><div className="rounded-xl bg-emerald-50 p-3"><div className="mb-2 flex items-center gap-1 font-bold"><CheckCircle2 className="h-4 w-4" />Pontos fortes</div>{analysisResult.pros?.map((x:string,i:number)=><div key={i}>• {x}</div>)}</div><div className="rounded-xl bg-amber-50 p-3"><div className="mb-2 flex items-center gap-1 font-bold"><AlertTriangle className="h-4 w-4" />Atenção</div>{analysisResult.cons?.map((x:string,i:number)=><div key={i}>• {x}</div>)}</div></div>{analysisResult.perguntas_sugeridas && <div><div className="mb-2 flex items-center gap-1 font-bold"><HelpCircle className="h-4 w-4" />Perguntas sugeridas</div>{analysisResult.perguntas_sugeridas.map((x:string,i:number)=><div key={i} className="mb-1 rounded-lg bg-indigo-50 p-2">{x}</div>)}</div>}</div>}
        </div>
      </div>
    </div>
  );
};
'''
Path('src/components/views/AiScreeningView.tsx').write_text(ai, encoding='utf-8')

# --- Headhunter: same collection, own filtered view and vacancy creation with client + fee ---
headhunter = r'''import React, { useState } from 'react';
import { Building2, Briefcase, CheckCircle2, DollarSign, Plus, UserCheck, X } from 'lucide-react';
import { dataService } from '../../services/dataService';

export const HeadhunterView: React.FC = () => {
  const [vagas, setVagas] = useState(dataService.getVagas('headhunter'));
  const [clientes, setClientes] = useState(dataService.getClientes());
  const [activeTab, setActiveTab] = useState<'vagas' | 'clientes'>('vagas');
  const [showClienteModal, setShowClienteModal] = useState(false);
  const [showVagaModal, setShowVagaModal] = useState(false);
  const [nomeCliente, setNomeCliente] = useState('');
  const [cnpjCliente, setCnpjCliente] = useState('');
  const [responsavelCliente, setResponsavelCliente] = useState('');
  const [taxaCliente, setTaxaCliente] = useState('20%');
  const [tituloVaga, setTituloVaga] = useState('');
  const [clienteVaga, setClienteVaga] = useState(clientes[0]?.id || '');
  const [salarioVaga, setSalarioVaga] = useState(6000);
  const [feeVaga, setFeeVaga] = useState('35%');
  const [error, setError] = useState('');

  const refreshData = () => { setVagas(dataService.getVagas('headhunter')); setClientes(dataService.getClientes()); };

  const handleCreateCliente = (e: React.FormEvent) => {
    e.preventDefault(); setError('');
    if (!nomeCliente || !cnpjCliente) return;
    const cli = dataService.createCliente({ nome: nomeCliente, cnpj_cpf: cnpjCliente, email: 'contato@cliente.com.br', telefone: '(11) 3000-0000', responsavel: responsavelCliente || 'Responsável', status: 'ativo', vagas_contratadas: 1, taxa_headhunter: taxaCliente });
    setClienteVaga(cli.id); setShowClienteModal(false); setNomeCliente(''); setCnpjCliente(''); setResponsavelCliente(''); refreshData();
  };

  const handleCreateVaga = (e: React.FormEvent) => {
    e.preventDefault(); setError('');
    if (!tituloVaga.trim() || !clienteVaga) { setError('Informe título e cliente da vaga Headhunter.'); return; }
    const feeNumber = Number(String(feeVaga).replace('%','').replace(',','.'));
    if (!feeVaga.trim() || (!(feeNumber > 0) && !/^\s*r\$/i.test(feeVaga))) { setError('Informe um fee Headhunter válido e maior que zero.'); return; }
    dataService.createVaga({ titulo: tituloVaga.trim(), descricao: `Processo Headhunter para ${tituloVaga.trim()}.`, departamento: 'Headhunter', cargo: tituloVaga.trim(), tipo_contratacao: 'CLT', modelo_trabalho: 'Hibrido', cidade: 'São Paulo', estado: 'SP', salario_min: Number(salarioVaga), salario_max: Number(salarioVaga), exibir_salario: false, status: 'publicada', requisitos: [], diferenciais: [], beneficios: [], publicado: true, modulo_origem: 'headhunter', cliente_id: clienteVaga, honorario_headhunter: feeVaga.trim(), criado_por: dataService.getCurrentUser().id, vagas_qtd: 1 });
    setShowVagaModal(false); setTituloVaga(''); refreshData();
  };

  return <div className="space-y-6">
    <div className="flex flex-col gap-4 rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-6 text-white shadow-xl sm:flex-row sm:items-center sm:justify-between"><div className="flex items-center gap-4"><div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-600"><UserCheck className="h-6 w-6" /></div><div><h1 className="text-xl font-extrabold">Módulo Headhunter Executive Search</h1><p className="mt-0.5 text-xs text-indigo-200">Mesma coleção de vagas do Recrutamento, filtrada por origem Headhunter.</p></div></div><div className="flex gap-2"><button onClick={()=>setShowVagaModal(true)} className="flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2.5 text-xs font-bold text-white"><Plus className="h-4 w-4" />Nova Vaga Headhunter</button><button onClick={()=>setShowClienteModal(true)} className="flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-xs font-bold text-slate-900"><Building2 className="h-4 w-4" />Novo Cliente</button></div></div>
    {error && <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-bold text-rose-700">{error}</div>}
    <div className="flex gap-2 border-b pb-2"><button onClick={()=>setActiveTab('vagas')} className={`rounded-xl px-4 py-2 text-xs font-bold ${activeTab==='vagas'?'bg-indigo-600 text-white':'bg-white'}`}><Briefcase className="mr-1 inline h-4 w-4" />Vagas ({vagas.length})</button><button onClick={()=>setActiveTab('clientes')} className={`rounded-xl px-4 py-2 text-xs font-bold ${activeTab==='clientes'?'bg-indigo-600 text-white':'bg-white'}`}><Building2 className="mr-1 inline h-4 w-4" />Clientes ({clientes.length})</button></div>
    {activeTab==='vagas' && <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{vagas.map(v=><div key={v.id} className="rounded-2xl border bg-white p-5 shadow-sm"><div className="flex items-start justify-between"><div><span className="rounded-md bg-indigo-50 px-2 py-0.5 text-[10px] font-bold uppercase text-indigo-700">HEADHUNTER</span><h3 className="mt-2 font-bold text-slate-900">{v.titulo}</h3></div><CheckCircle2 className="h-5 w-5 text-emerald-600" /></div><div className="mt-4 border-t pt-3 text-xs text-slate-600"><p><strong>Cliente:</strong> {clientes.find(c=>c.id===v.cliente_id)?.nome || v.cliente_id}</p><p><strong>Salário base:</strong> R$ {Number(v.salario_min||0).toLocaleString('pt-BR')}</p><p><strong>Fee:</strong> {v.honorario_headhunter}</p></div></div>)}</div>}
    {activeTab==='clientes' && <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{clientes.map(c=><div key={c.id} className="rounded-2xl border bg-white p-5 shadow-sm"><h3 className="font-bold">{c.nome}</h3><p className="text-xs text-slate-500">{c.cnpj_cpf}</p><div className="mt-3 text-xs"><DollarSign className="mr-1 inline h-4 w-4" />Fee padrão: {c.taxa_headhunter}</div></div>)}</div>}
    {showClienteModal && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4"><div className="w-full max-w-md rounded-2xl bg-white p-6"><div className="flex justify-between"><h3 className="font-bold">Cadastrar Cliente Headhunter</h3><button onClick={()=>setShowClienteModal(false)}><X className="h-5 w-5" /></button></div><form onSubmit={handleCreateCliente} className="mt-4 space-y-3 text-xs"><input required value={nomeCliente} onChange={e=>setNomeCliente(e.target.value)} placeholder="Nome da empresa" className="w-full rounded-xl border p-2.5"/><input required value={cnpjCliente} onChange={e=>setCnpjCliente(e.target.value)} placeholder="CNPJ" className="w-full rounded-xl border p-2.5"/><input value={responsavelCliente} onChange={e=>setResponsavelCliente(e.target.value)} placeholder="Responsável" className="w-full rounded-xl border p-2.5"/><input value={taxaCliente} onChange={e=>setTaxaCliente(e.target.value)} placeholder="Fee padrão, ex. 35%" className="w-full rounded-xl border p-2.5"/><button className="w-full rounded-xl bg-indigo-600 py-2.5 font-bold text-white">Cadastrar cliente</button></form></div></div>}
    {showVagaModal && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4"><div className="w-full max-w-md rounded-2xl bg-white p-6"><div className="flex justify-between"><h3 className="font-bold">Nova Vaga Headhunter</h3><button onClick={()=>setShowVagaModal(false)}><X className="h-5 w-5" /></button></div><form onSubmit={handleCreateVaga} className="mt-4 space-y-3 text-xs"><input required value={tituloVaga} onChange={e=>setTituloVaga(e.target.value)} placeholder="Título da vaga" className="w-full rounded-xl border p-2.5"/><select required value={clienteVaga} onChange={e=>setClienteVaga(e.target.value)} className="w-full rounded-xl border p-2.5"><option value="">Selecione o cliente</option>{clientes.map(c=><option key={c.id} value={c.id}>{c.nome}</option>)}</select><input type="number" min="1" required value={salarioVaga} onChange={e=>setSalarioVaga(Number(e.target.value))} placeholder="Salário base" className="w-full rounded-xl border p-2.5"/><input required value={feeVaga} onChange={e=>setFeeVaga(e.target.value)} placeholder="35% ou R$ 1.750" className="w-full rounded-xl border p-2.5"/><button className="w-full rounded-xl bg-emerald-600 py-2.5 font-bold text-white">Criar vaga Headhunter</button></form></div></div>}
  </div>;
};
'''
Path('src/components/views/HeadhunterView.tsx').write_text(headhunter, encoding='utf-8')

print('Two-access fixes applied.')
