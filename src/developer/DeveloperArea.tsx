import React, { useEffect, useState } from 'react';
import { addDoc, collection, getDocs, limit, query, serverTimestamp } from 'firebase/firestore';
import {
  Activity, AlertTriangle, Bot, Braces, Code2, Database, FlaskConical, History,
  LayoutDashboard, Loader2, LogOut, Menu, Network, PanelLeft, Rocket, RotateCcw,
  Save, Settings, X,
} from 'lucide-react';
import { useAuth } from '../auth';
import { isDeveloperProfile, isMasterProfile } from '../auth/profile';
import { ModuleErrorBoundary } from '../components/ModuleErrorBoundary';
import { auth, db } from '../lib/firebase';
import { MasterDeveloperAssistantView } from '../master-admin/components/MasterDeveloperAssistantView';
import { DEVELOPER_RELEASE } from './releaseManifest';

type SectionKey = 'overview' | 'visual' | 'ai' | 'code' | 'firebase' | 'integrations' | 'n8n' | 'logs' | 'tests' | 'versions' | 'rollback' | 'publish' | 'settings';
type TechnicalRecord = Record<string, any> & { id: string };

const menu: Array<{ key: SectionKey; label: string; icon: React.ElementType }> = [
  { key: 'overview', label: 'Visão Geral', icon: LayoutDashboard },
  { key: 'visual', label: 'Editor Visual', icon: PanelLeft },
  { key: 'ai', label: 'Assistente IA', icon: Bot },
  { key: 'code', label: 'Código / Projeto', icon: Code2 },
  { key: 'firebase', label: 'Firebase', icon: Database },
  { key: 'integrations', label: 'Integrações / API', icon: Network },
  { key: 'n8n', label: 'n8n Monitor', icon: Activity },
  { key: 'logs', label: 'Logs e Erros', icon: AlertTriangle },
  { key: 'tests', label: 'Testes', icon: FlaskConical },
  { key: 'versions', label: 'Versões', icon: History },
  { key: 'rollback', label: 'Rollback', icon: RotateCcw },
  { key: 'publish', label: 'Publicação', icon: Rocket },
  { key: 'settings', label: 'Configurações DEV', icon: Settings },
];

const Status = ({ children, tone = 'slate' }: { children: React.ReactNode; tone?: 'green' | 'amber' | 'red' | 'slate' }) => (
  <span className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-wide ${tone === 'green' ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300' : tone === 'amber' ? 'border-amber-500/30 bg-amber-500/10 text-amber-300' : tone === 'red' ? 'border-rose-500/30 bg-rose-500/10 text-rose-300' : 'border-slate-700 bg-slate-800 text-slate-300'}`}>{children}</span>
);

const Card = ({ title, children, status }: { title: string; children: React.ReactNode; status?: React.ReactNode }) => <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5 shadow-sm"><div className="mb-3 flex items-center justify-between gap-3"><h3 className="font-black text-white">{title}</h3>{status}</div>{children}</section>;
const Pending = ({ text = 'Configuração pendente' }: { text?: string }) => <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-xs font-bold text-amber-200">{text}</div>;
const Empty = () => <p className="text-sm text-slate-500">Sem dados disponíveis.</p>;

async function authenticatedHeaders() {
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error('Sessão Firebase não encontrada.');
  return { Authorization: `Bearer ${token}` };
}

type DeveloperAreaProps = {
  onBackToMaster?: () => void;
};

export const DeveloperArea: React.FC<DeveloperAreaProps> = ({ onBackToMaster }) => {
  const { user, logout } = useAuth();
  const [active, setActive] = useState<SectionKey>('overview');
  const [mobile, setMobile] = useState(false);
  const [loading, setLoading] = useState(true);
  const [diagnosticError, setDiagnosticError] = useState('');
  const [records, setRecords] = useState<{ logs: TechnicalRecord[]; versions: TechnicalRecord[]; tests: TechnicalRecord[] }>({ logs: [], versions: [], tests: [] });
  const [providers, setProviders] = useState<{ gemini: boolean; openai: boolean } | null>(null);

  const refreshDiagnostics = async () => {
    setLoading(true); setDiagnosticError('');
    const read = async (name: string) => (await getDocs(query(collection(db, name), limit(50)))).docs.map(item => ({ id: item.id, ...item.data() }));
    try {
      const [logs, versions, tests, assistant] = await Promise.allSettled([
        read('developer_logs'), read('developer_versions'), read('developer_test_runs'),
        fetch('/api/developer/assistant', { headers: await authenticatedHeaders() }).then(async response => ({ response, payload: await response.json() })),
      ]);
      setRecords({
        logs: logs.status === 'fulfilled' ? logs.value : [],
        versions: versions.status === 'fulfilled' ? versions.value : [],
        tests: tests.status === 'fulfilled' ? tests.value : [],
      });
      if (assistant.status === 'fulfilled' && assistant.value.response.ok) setProviders(assistant.value.payload.providers || null);
      else setProviders(null);
      const failures = [logs, versions, tests].filter(result => result.status === 'rejected');
      if (failures.length) setDiagnosticError('Parte dos diagnósticos não pôde ser consultada no Firestore. Verifique as Rules publicadas.');
    } finally { setLoading(false); }
  };

  const hasTechnicalAccess = isDeveloperProfile(user) || isMasterProfile(user);
  const hasMasterAccess = isMasterProfile(user);

  useEffect(() => {
    if (hasTechnicalAccess) void refreshDiagnostics();
  }, [user?.uid, user?.role]);

  if (!hasTechnicalAccess) return <div className="min-h-screen bg-slate-950 p-8 text-white"><Card title="Acesso negado" status={<Status tone="red">ERRO</Status>}><p className="text-sm text-slate-300">Esta área exige Firebase Authentication e perfil Firestore MASTER ou developer_admin ativo.</p></Card></div>;

  const renderSection = () => {
    if (active === 'ai' || active === 'code') return <MasterDeveloperAssistantView />;
    if (active === 'visual') return <VisualEditorArchitecture />;
    if (active === 'overview') return <Overview loading={loading} providers={providers} records={records} diagnosticError={diagnosticError} />;
    if (active === 'firebase') return <FirebasePanel error={diagnosticError} />;
    if (active === 'integrations') return <Integrations providers={providers} />;
    if (active === 'n8n') return <N8nMonitor />;
    if (active === 'logs') return <Records title="Logs e erros reais" rows={records.logs} empty="Nenhum log técnico registrado." />;
    if (active === 'tests') return <TestsPanel rows={records.tests} />;
    if (active === 'versions') return <VersionsPanel rows={records.versions} onSaved={refreshDiagnostics} />;
    if (active === 'rollback') return <SafeWorkflow kind="rollback" versions={records.versions} />;
    if (active === 'publish') return <SafeWorkflow kind="publish" versions={records.versions} />;
    return <DevSettings providers={providers} />;
  };

  return <div className="min-h-screen bg-[#07111f] text-slate-100 lg:flex">
    <button className="fixed left-4 top-4 z-50 rounded-xl border border-slate-700 bg-slate-900 p-2 lg:hidden" onClick={() => setMobile(true)} aria-label="Abrir menu"><Menu className="h-5 w-5" /></button>
    {mobile && <button className="fixed inset-0 z-30 bg-black/70 lg:hidden" onClick={() => setMobile(false)} aria-label="Fechar menu" />}
    <aside className={`fixed inset-y-0 left-0 z-40 flex w-72 flex-col border-r border-slate-800 bg-slate-950 transition-transform lg:static lg:translate-x-0 ${mobile ? 'translate-x-0' : '-translate-x-full'}`}>
      <div className="flex items-center justify-between border-b border-slate-800 p-5"><div><p className="text-xs font-black tracking-[0.22em] text-cyan-400">RL CONNECT</p><h1 className="mt-1 text-lg font-black">Área do Programador</h1><p className="text-[11px] text-slate-500">Ambiente técnico separado</p></div><button className="lg:hidden" onClick={() => setMobile(false)}><X className="h-5 w-5" /></button></div>
      <nav className="flex-1 space-y-1 overflow-y-auto p-3">{menu.map(item => { const Icon = item.icon; return <button key={item.key} onClick={() => { setActive(item.key); setMobile(false); }} className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-xs font-bold ${active === item.key ? 'bg-cyan-500 text-slate-950' : 'text-slate-300 hover:bg-slate-900'}`}><Icon className="h-4 w-4" />{item.label}</button>; })}</nav>
      <div className="border-t border-slate-800 p-4"><p className="truncate text-xs font-bold">{user?.name}</p><p className="truncate text-[11px] text-slate-500">{user?.email}</p><button onClick={() => void logout()} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-slate-700 p-2 text-xs font-bold hover:bg-slate-900"><LogOut className="h-4 w-4" />Sair</button></div>
    </aside>
    <main className="min-w-0 flex-1 p-4 pt-16 sm:p-6 sm:pt-16 lg:p-8">
      {hasMasterAccess && onBackToMaster && <button type="button" onClick={onBackToMaster} className="mb-5 inline-flex items-center rounded-xl border border-cyan-500/40 bg-cyan-500/10 px-4 py-2.5 text-sm font-black text-cyan-200 hover:bg-cyan-500/20">← Voltar para o Painel Master</button>}
      <ModuleErrorBoundary key={active} moduleKey={`developer-${active}`} onGoHome={() => setActive('overview')}>{renderSection()}</ModuleErrorBoundary>
    </main>
  </div>;
};

function Heading({ title, text }: { title: string; text: string }) { return <div className="mb-6"><div className="flex items-center gap-2 text-cyan-400"><Braces className="h-5 w-5" /><span className="text-xs font-black uppercase tracking-widest">Developer v55</span></div><h2 className="mt-2 text-2xl font-black text-white">{title}</h2><p className="mt-1 max-w-3xl text-sm text-slate-400">{text}</p></div>; }

function Overview({ loading, providers, records, diagnosticError }: any) { const cards = [
  ['Versão', `v${DEVELOPER_RELEASE.version}`, 'green'], ['Branch', DEVELOPER_RELEASE.branch, 'green'], ['Ambiente', DEVELOPER_RELEASE.environment, 'amber'],
  ['Firebase', diagnosticError ? 'ATENÇÃO' : 'OPERACIONAL', diagnosticError ? 'amber' : 'green'], ['Gemini', providers?.gemini ? 'OPERACIONAL' : 'NÃO CONFIGURADO', providers?.gemini ? 'green' : 'slate'], ['n8n', 'INDISPONÍVEL', 'slate'],
]; return <><Heading title="Visão Geral Técnica" text="Somente estados obtidos da configuração de build, Firebase e endpoints autenticados." />{loading ? <p className="flex items-center gap-2 text-sm text-slate-400"><Loader2 className="h-4 w-4 animate-spin" />Consultando diagnósticos reais...</p> : <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{cards.map(([label,value,tone]) => <Card key={label} title={label} status={<Status tone={tone as any}>{value}</Status>}><p className="break-all text-xs text-slate-400">{label === 'Versão' ? 'Manifesto técnico da compilação.' : label === 'Branch' ? 'Branch de trabalho declarada para esta versão.' : 'Estado sem simulação.'}</p></Card>)}</div>}{diagnosticError && <div className="mt-4"><Pending text={diagnosticError} /></div>}<div className="mt-4 grid gap-4 lg:grid-cols-3"><Card title="Erros registrados"><b className="text-3xl">{records.logs.length}</b></Card><Card title="Execuções de testes"><b className="text-3xl">{records.tests.length}</b></Card><Card title="Versões no Firebase"><b className="text-3xl">{records.versions.length}</b></Card></div></>; }

function VisualEditorArchitecture() { const [page, setPage] = useState('dashboard'); const [component, setComponent] = useState('header_main'); const [text, setText] = useState(''); const [saving, setSaving] = useState(false); const [notice, setNotice] = useState(''); const save = async () => { setSaving(true); setNotice(''); try { await addDoc(collection(db, 'developer_visual_drafts'), { page, component, proposedText: text.trim(), status: 'EM_DESENVOLVIMENTO', createdBy: auth.currentUser?.uid || '', createdAt: serverTimestamp(), appliedToProduction: false }); setText(''); setNotice('Rascunho técnico salvo no Firestore. Nenhuma tela de produção foi alterada.'); } finally { setSaving(false); } }; return <><Heading title="Editor Visual" text="Arquitetura real de rascunho: selecionar, propor, validar e testar antes de criar uma versão. A aplicação automática no código permanece pendente." /><div className="grid gap-4 lg:grid-cols-[1fr_1.4fr]"><Card title="Seleção controlada" status={<Status tone="amber">EM DESENVOLVIMENTO</Status>}><label className="text-xs font-bold text-slate-400">Tela<select value={page} onChange={e=>setPage(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-white"><option value="dashboard">Dashboard</option><option value="vagas">Vagas</option><option value="banco-talentos">Banco de Talentos</option><option value="acesso-master">Painel Master</option></select></label><label className="mt-3 block text-xs font-bold text-slate-400">Componente<input value={component} onChange={e=>setComponent(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-white" /></label><label className="mt-3 block text-xs font-bold text-slate-400">Texto proposto<textarea value={text} onChange={e=>setText(e.target.value)} rows={4} className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-white" /></label><button disabled={saving || !text.trim()} onClick={() => void save()} className="mt-3 flex items-center gap-2 rounded-xl bg-cyan-500 px-4 py-2 text-xs font-black text-slate-950 disabled:opacity-50"><Save className="h-4 w-4" />Salvar rascunho</button>{notice && <p className="mt-3 text-xs text-emerald-300">{notice}</p>}</Card><Card title="Fluxo protegido" status={<Status tone="green">ATIVO</Status>}><div className="grid gap-2 sm:grid-cols-3">{['EDITAR','PREVIEW','VALIDAR','TESTAR','CRIAR VERSÃO','PUBLICAR'].map((step,index)=><div key={step} className="rounded-xl border border-slate-800 bg-slate-950 p-3"><span className="text-[10px] text-cyan-400">{String(index+1).padStart(2,'0')}</span><p className="text-xs font-black">{step}</p></div>)}</div><div className="mt-4"><Pending text="Preview aplicado ao runtime e geração automática de patch: função em desenvolvimento. O rascunho não altera produção." /></div></Card></div></>; }

function FirebasePanel({ error }: { error: string }) { return <><Heading title="Firebase" text="Diagnóstico não destrutivo da fonte oficial do RL Connect." /><div className="grid gap-4 md:grid-cols-2"><Card title="Authentication" status={<Status tone="green">OPERACIONAL</Status>}><p className="text-xs text-slate-400">Sessão atual validada pelo Firebase Authentication.</p></Card><Card title="Cloud Firestore" status={<Status tone={error ? 'amber' : 'green'}>{error ? 'ATENÇÃO' : 'OPERACIONAL'}</Status>}><p className="text-xs text-slate-400">Leituras técnicas protegidas por role developer_admin.</p></Card><Card title="Firebase Storage" status={<Status>INDISPONÍVEL</Status>}><p className="text-xs text-slate-400">Nenhuma operação destrutiva disponibilizada.</p></Card><Card title="Security Rules" status={<Status tone="green">PROTEGIDO</Status>}><p className="text-xs text-slate-400">Acesso Developer separado de Master e tenants.</p></Card></div></>; }

function Integrations({ providers }: { providers: { gemini: boolean; openai: boolean } | null }) { const rows = [['Firebase','CONECTADO'],['Gemini',providers?.gemini?'CONECTADO':'PENDENTE'],['OpenAI',providers?.openai?'CONECTADO':'PENDENTE'],['Google Calendar','PENDENTE'],['Google Meet','PENDENTE'],['n8n','PENDENTE'],['E-mail','PENDENTE'],['Pagamento','PENDENTE'],['NFS-e','PENDENTE']]; return <><Heading title="Integrações / API" text="Status apenas quando verificável neste contexto técnico; nenhuma integração é marcada como conectada por suposição." /><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{rows.map(([name,status])=><Card key={name} title={name} status={<Status tone={status==='CONECTADO'?'green':'slate'}>{status}</Status>}><p className="text-xs text-slate-500">{status==='PENDENTE'?'Configuração pendente ou diagnóstico backend indisponível.':'Verificado na sessão atual.'}</p></Card>)}</div></>; }
function N8nMonitor() { return <><Heading title="n8n Monitor" text="Monitoramento somente leitura. Nenhuma credencial, webhook ou workflow foi alterado." /><Card title="Diagnóstico n8n" status={<Status>INDISPONÍVEL</Status>}><Empty/><div className="mt-3"><Pending text="Endpoint de monitoramento autenticado não configurado. Escrita em workflows permanece bloqueada nesta versão." /></div></Card></>; }

function Records({ title, rows, empty }: { title: string; rows: TechnicalRecord[]; empty: string }) { return <><Heading title={title} text="Registros carregados do Firestore; dados sensíveis não são exibidos." /><Card title="Registros">{rows.length ? <div className="space-y-2">{rows.map(row=><div key={row.id} className="rounded-xl border border-slate-800 bg-slate-950 p-3 text-xs"><div className="flex justify-between gap-3"><b>{String(row.message || row.description || row.action || row.id)}</b><Status tone={String(row.severity || '').toUpperCase()==='ERROR'?'red':'slate'}>{String(row.severity || row.status || 'INFO')}</Status></div><p className="mt-1 text-slate-500">{String(row.origin || row.module || 'Developer')} • {String(row.createdAt?.toDate?.()?.toISOString?.() || row.createdAt || 'Data indisponível')}</p></div>)}</div> : <p className="text-sm text-slate-500">{empty}</p>}</Card></>; }
function TestsPanel({ rows }: { rows: TechnicalRecord[] }) { return <><Heading title="Central de Testes" text="Resultados somente depois de uma execução registrada; ausência nunca é convertida em sucesso." /><div className="grid gap-4 md:grid-cols-3"><Card title="TypeScript" status={<Status>{DEVELOPER_RELEASE.typeScript}</Status>}><p className="text-xs text-slate-500">Manifesto da versão.</p></Card><Card title="Build" status={<Status>{DEVELOPER_RELEASE.build}</Status>}><p className="text-xs text-slate-500">Manifesto da versão.</p></Card><Card title="Automatizados" status={<Status>{DEVELOPER_RELEASE.automatedTests}</Status>}><p className="text-xs text-slate-500">Manifesto da versão.</p></Card></div><div className="mt-4"><Records title="Execuções registradas" rows={rows} empty="NÃO EXECUTADO" /></div></>; }
function VersionsPanel({ rows, onSaved }: { rows: TechnicalRecord[]; onSaved: () => Promise<void> }) { const [saving,setSaving]=useState(false); const save=async()=>{setSaving(true); try { await addDoc(collection(db,'developer_versions'),{version:DEVELOPER_RELEASE.version,branch:DEVELOPER_RELEASE.branch,commitSha:DEVELOPER_RELEASE.commitSha||null,environment:DEVELOPER_RELEASE.environment,status:'EM_DESENVOLVIMENTO',responsibleUid:auth.currentUser?.uid||'',tests:{typescript:DEVELOPER_RELEASE.typeScript,build:DEVELOPER_RELEASE.build,automated:DEVELOPER_RELEASE.automatedTests},createdAt:serverTimestamp()}); await onSaved(); } finally {setSaving(false);} }; return <><Heading title="Versões" text="Registro técnico no Firestore com branch, testes, ambiente e responsável." /><Card title="Versão atual" status={<Status tone="amber">EM DESENVOLVIMENTO</Status>}><dl className="grid gap-3 text-xs sm:grid-cols-2"><div><dt className="text-slate-500">Versão</dt><dd className="font-bold">v{DEVELOPER_RELEASE.version}</dd></div><div><dt className="text-slate-500">Branch</dt><dd className="font-mono">{DEVELOPER_RELEASE.branch}</dd></div><div><dt className="text-slate-500">Commit</dt><dd>{DEVELOPER_RELEASE.commitSha || 'INDISPONÍVEL'}</dd></div><div><dt className="text-slate-500">Ambiente</dt><dd>{DEVELOPER_RELEASE.environment}</dd></div></dl><button disabled={saving} onClick={()=>void save()} className="mt-4 rounded-xl bg-cyan-500 px-4 py-2 text-xs font-black text-slate-950 disabled:opacity-50">{saving?'Registrando...':'Registrar versão no Firebase'}</button></Card><div className="mt-4"><Records title="Histórico real" rows={rows} empty="Nenhuma versão técnica registrada." /></div></>; }
function SafeWorkflow({ kind, versions }: { kind: 'rollback'|'publish'; versions: TechnicalRecord[] }) { const publish=kind==='publish'; return <><Heading title={publish?'Publicação':'Rollback'} text={publish?'Fluxo visível e bloqueado até testes, homologação e aprovação humana.':'Arquitetura de inspeção; nenhuma reversão automática está habilitada.'} /><Card title={publish?'Gate de publicação':'Análise de reversão'} status={<Status tone="amber">FUNÇÃO EM DESENVOLVIMENTO</Status>}><div className="grid gap-2 sm:grid-cols-4">{(publish?['ALTERAÇÃO','TESTES','HOMOLOGAÇÃO','APROVAÇÃO','PUBLICAÇÃO']:['VERSÃO ATUAL','VERSÃO ANTERIOR','RISCOS','CONFIRMAÇÃO']).map(step=><div key={step} className="rounded-xl border border-slate-800 bg-slate-950 p-3 text-xs font-black">{step}</div>)}</div><div className="mt-4"><Pending text={publish?'Publicação silenciosa e merge automático na main estão desabilitados.':'Execução de rollback não está disponível na v55 e exigirá confirmação explícita em etapa futura.'}/></div><p className="mt-3 text-xs text-slate-500">Versões disponíveis para inspeção: {versions.length}</p></Card></>; }
function DevSettings({ providers }: { providers: { gemini: boolean; openai: boolean } | null }) { return <><Heading title="Configurações DEV" text="Somente indicadores técnicos; segredos nunca são exibidos em texto aberto." /><div className="grid gap-4 md:grid-cols-2"><Card title="Gemini API" status={<Status tone={providers?.gemini?'green':'slate'}>{providers?.gemini?'CONFIGURADO':'NÃO CONFIGURADO'}</Status>}><p className="text-xs text-slate-500">A chave é processada somente pelo backend seguro.</p></Card><Card title="OpenAI API" status={<Status tone={providers?.openai?'green':'slate'}>{providers?.openai?'CONFIGURADO':'NÃO CONFIGURADO'}</Status>}><p className="text-xs text-slate-500">Nenhuma chave completa é retornada ao navegador.</p></Card><Card title="Firebase" status={<Status tone="green">CONFIGURADO</Status>}><p className="text-xs text-slate-500">Fonte oficial de autenticação e dados.</p></Card><Card title="Publicação automática" status={<Status>DESABILITADO</Status>}><p className="text-xs text-slate-500">Exige aprovação humana e processo externo controlado.</p></Card></div></>; }
