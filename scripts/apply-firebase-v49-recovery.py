from pathlib import Path
import json, re

ROOT = Path('.')

def write(path, content):
    p = ROOT / path
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(content, encoding='utf-8')

pkg_path = ROOT/'package.json'
pkg=json.loads(pkg_path.read_text())
deps=pkg.setdefault('dependencies',{})
deps.pop('@supabase/supabase-js',None)
deps['firebase']='^12.17.1'
pkg_path.write_text(json.dumps(pkg,ensure_ascii=False,indent=2)+'\n')

for name in ['src/lib/supabase.ts','src/components/SupabaseSetupModal.tsx']:
    p=ROOT/name
    if p.exists(): p.unlink()

write('src/lib/firebase.ts', r'''import { getApp, getApps, initializeApp } from 'firebase/app';
import { browserLocalPersistence, getAuth, setPersistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const expectedProjectId = 'rl-connect-ed797';
const env = (import.meta as any).env || {};
export const firebaseConfig = Object.freeze({
  apiKey: String(env.VITE_FIREBASE_API_KEY || 'AIzaSyBTaAot1PUq8rqX9_PShE0gIUyoptkcuWQ').trim(),
  authDomain: String(env.VITE_FIREBASE_AUTH_DOMAIN || 'rl-connect-ed797.firebaseapp.com').trim(),
  projectId: String(env.VITE_FIREBASE_PROJECT_ID || expectedProjectId).trim(),
  storageBucket: String(env.VITE_FIREBASE_STORAGE_BUCKET || 'rl-connect-ed797.firebasestorage.app').trim(),
  messagingSenderId: String(env.VITE_FIREBASE_MESSAGING_SENDER_ID || '424978245385').trim(),
  appId: String(env.VITE_FIREBASE_APP_ID || '1:424978245385:web:89a7946c5f277c13e015d8').trim(),
  measurementId: String(env.VITE_FIREBASE_MEASUREMENT_ID || 'G-0VMDCYK11M').trim(),
});
if (firebaseConfig.projectId !== expectedProjectId) throw new Error(`[Firebase] Projeto inválido: ${firebaseConfig.projectId}. Esperado: ${expectedProjectId}.`);
export const firebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(firebaseApp);
export const db = getFirestore(firebaseApp);
export const storage = getStorage(firebaseApp);
storage.maxUploadRetryTime = 12_000;
storage.maxOperationRetryTime = 12_000;
void setPersistence(auth, browserLocalPersistence).catch(error => console.error('[Firebase Auth] Persistência da sessão falhou.', error));
export const isFirebaseConfigured = Boolean(firebaseConfig.apiKey && firebaseConfig.authDomain && firebaseConfig.projectId && firebaseConfig.appId);
''')

write('src/lib/tenant.ts', r'''export function tenantIdFrom(data: any): string {
  return String(data?.empresa_id || data?.empresaId || data?.companyId || data?.tenantId || '').trim();
}
export function requireTenantId(value: unknown, operation = 'realizar esta operação'): string {
  const id = String(value || '').trim();
  if (!id) throw new Error(`Não foi possível ${operation}: empresaId é obrigatório.`);
  return id;
}
export function withTenantAliases<T extends Record<string, any>>(data: T, tenant: string): T & { empresa_id: string; empresaId: string; companyId: string } {
  const id = requireTenantId(tenant);
  return { ...data, empresa_id: id, empresaId: id, companyId: id };
}
''')

write('src/services/firebaseSessionService.ts', r'''import { FirebaseError } from 'firebase/app';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut, type User } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { tenantIdFrom } from '../lib/tenant';

export type FirebaseRlSession = { firebaseUser: User; profile: Record<string, any>; companyId: string; role: string };
export function normalizeRlRole(value: unknown): string {
  const v = String(value || '').trim().toUpperCase();
  if (['MASTER','MASTER_ADMIN','SUPER_ADMINISTRADOR','SUPER ADMINISTRADOR'].includes(v)) return 'master_admin';
  if (['ADMIN_EMPRESA','EMPRESA_ADMIN','ADMINISTRADOR_EMPRESA','ADMINISTRADOR DA EMPRESA','ADMIN'].includes(v)) return 'empresa_admin';
  if (v.includes('HEADHUNTER')) return 'headhunter';
  if (v.includes('RECRUT')) return 'recrutador';
  if (v === 'GESTOR') return 'gestor';
  if (v === 'CANDIDATO') return 'candidato';
  return String(value || 'empresa_admin').toLowerCase();
}
async function profileFor(user: User) {
  const primary = await getDoc(doc(db, 'usuarios', user.uid));
  if (!primary.exists()) throw new Error('Perfil não encontrado no Firestore. Google nunca cria acesso ao RL Connect.');
  const raw = primary.data();
  const companyId = tenantIdFrom(raw);
  const role = normalizeRlRole(raw.role || raw.tipoUsuario);
  if (role !== 'master_admin' && !companyId) throw new Error('Perfil sem empresa vinculada.');
  if (raw.ativo === false || ['inativo','bloqueado'].includes(String(raw.status || '').toLowerCase())) throw new Error('Usuário inativo ou bloqueado.');
  return { ...raw, id: user.uid, email: raw.email || user.email || '', empresa_id: companyId, empresaId: companyId, companyId, role };
}
class FirebaseSessionService {
  subscribe(listener: (session: FirebaseRlSession | null, error?: string) => void) {
    return onAuthStateChanged(auth, async user => {
      if (!user) { listener(null); return; }
      try {
        const profile = await profileFor(user);
        listener({ firebaseUser: user, profile, companyId: profile.empresa_id, role: profile.role });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        await signOut(auth).catch(() => undefined);
        listener(null, message);
      }
    });
  }
  async login(email: string, password: string) {
    try {
      const result = await signInWithEmailAndPassword(auth, email.trim().toLowerCase(), password);
      await profileFor(result.user);
      return true;
    } catch (error) {
      if (error instanceof FirebaseError && ['auth/invalid-credential','auth/wrong-password','auth/user-not-found'].includes(error.code)) throw new Error('E-mail ou senha inválidos.');
      throw error;
    }
  }
  async logout() { await signOut(auth); }
  async idToken() { return auth.currentUser ? auth.currentUser.getIdToken() : null; }
}
export const firebaseSessionService = new FirebaseSessionService();
''')

write('src/services/firebaseStateBridge.ts', r'''import { collection, deleteDoc, doc, getDoc, getDocs, query, setDoc, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { tenantIdFrom, withTenantAliases } from '../lib/tenant';
const TENANT_COLLECTIONS = ['empresas','usuarios','vagas','candidatos','candidaturas','entrevistas','clientes','funcionarios','registroPontos','ferias','departamentos','cargos','logs','notificacoes','empresaModulos','assinaturas','pagamentos'] as const;
type Key = typeof TENANT_COLLECTIONS[number];
export type TenantState = Partial<Record<Key, any[]>>;
const aliases = ['empresa_id','empresaId','companyId','tenantId'] as const;
async function tenantDocs(name: string, companyId: string): Promise<Map<string, any>> {
  const found = new Map<string, any>();
  for (const field of aliases) {
    try { const snap = await getDocs(query(collection(db,name),where(field,'==',companyId))); snap.forEach(d=>found.set(d.id,{id:d.id,...d.data()})); } catch {}
  }
  return found;
}
async function loadEmpresa(companyId: string) {
  const direct=await getDoc(doc(db,'empresas',companyId));
  if(direct.exists()) return [{id:direct.id,...direct.data()}];
  return [...(await tenantDocs('empresas',companyId)).values()];
}
class FirebaseStateBridge {
  async loadTenantState(companyId:string):Promise<TenantState>{
    const entries=await Promise.all(TENANT_COLLECTIONS.map(async key=>[key,key==='empresas'?await loadEmpresa(companyId):[...(await tenantDocs(key,companyId)).values()]] as const));
    return Object.fromEntries(entries) as TenantState;
  }
  async persistTenantState(companyId:string,state:TenantState):Promise<void>{
    if(!companyId)return;
    for(const key of TENANT_COLLECTIONS){
      const raw=Array.isArray(state[key])?state[key]!:[];
      const items=raw.filter((item:any)=>key==='empresas'?item.id===companyId:tenantIdFrom(item)===companyId);
      const wanted=new Set<string>();
      for(const item of items){ if(!item?.id)continue; wanted.add(String(item.id)); const payload=key==='empresas'?{...item,empresa_id:companyId,empresaId:companyId,companyId}:withTenantAliases(item,companyId); await setDoc(doc(db,key,String(item.id)),payload,{merge:true}); }
      const existing=key==='empresas'?new Map<string,any>():await tenantDocs(key,companyId);
      for(const id of existing.keys()) if(!wanted.has(id)) await deleteDoc(doc(db,key,id));
    }
  }
  async loadPublicPortal(companyId:string){
    const company=await loadEmpresa(companyId); const jobs=new Map<string,any>();
    for(const field of aliases){ try{ const snap=await getDocs(query(collection(db,'vagas'),where(field,'==',companyId))); snap.forEach(d=>{const data:any=d.data(); const published=data.publicado===true||data.publicada===true; const status=String(data.status||'').toLowerCase(); if(published&&!['encerrada','fechada','cancelada'].includes(status)) jobs.set(d.id,{id:d.id,...data});});}catch{} }
    return {empresa:company[0]||null,vagas:[...jobs.values()]};
  }
}
export const firebaseStateBridge=new FirebaseStateBridge();
''')

write('src/components/FirebaseLoginView.tsx', r'''import React,{useState} from 'react';
import {LockKeyhole,LogIn} from 'lucide-react';
import {dataService} from '../services/dataService';
export function FirebaseLoginView({error}:{error?:string|null}){
 const[email,setEmail]=useState('');const[password,setPassword]=useState('');const[busy,setBusy]=useState(false);const[message,setMessage]=useState(error||'');
 const submit=async(e:React.FormEvent)=>{e.preventDefault();setBusy(true);setMessage('');try{await dataService.loginFirebase(email,password)}catch(err){setMessage(err instanceof Error?err.message:'Falha no login Firebase.')}finally{setBusy(false)}};
 return <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6"><form onSubmit={submit} className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-7 shadow-xl"><div className="mb-6 flex items-center gap-3"><div className="h-11 w-11 rounded-xl bg-[#123657] text-white grid place-items-center"><LockKeyhole className="h-5 w-5"/></div><div><h1 className="text-xl font-black text-[#123657]">RL CONNECT</h1><p className="text-xs text-slate-500">Acesso oficial via Firebase Authentication</p></div></div><label className="text-xs font-bold text-slate-600">E-mail</label><input value={email} onChange={e=>setEmail(e.target.value)} type="email" required autoComplete="username" className="mt-1 mb-4 w-full rounded-xl border border-slate-300 px-3 py-2.5"/><label className="text-xs font-bold text-slate-600">Senha</label><input value={password} onChange={e=>setPassword(e.target.value)} type="password" required autoComplete="current-password" className="mt-1 mb-4 w-full rounded-xl border border-slate-300 px-3 py-2.5"/>{message&&<div className="mb-4 rounded-lg bg-rose-50 border border-rose-200 p-3 text-xs font-semibold text-rose-700">{message}</div>}<button disabled={busy} className="w-full rounded-xl bg-[#123657] py-2.5 text-sm font-bold text-white flex items-center justify-center gap-2 disabled:opacity-60"><LogIn className="h-4 w-4"/>{busy?'Entrando...':'Entrar'}</button><p className="mt-5 text-[11px] text-slate-500">Google não é login do RL Connect. OAuth Google serve somente para Calendar/Meet após esta autenticação.</p></form></div>;
}
''')

write('src/App.tsx', r'''import React,{useEffect,useState} from 'react';
import {Header} from './components/Header';import {Sidebar,ViewTab} from './components/Sidebar';import {FirebaseLoginView} from './components/FirebaseLoginView';import {dataService} from './services/dataService';
import {DashboardView} from './components/views/DashboardView';import {MasterAdminView} from './components/views/MasterAdminView';import {RecruitmentView} from './components/views/RecruitmentView';import {HeadhunterView} from './components/views/HeadhunterView';import {PublicPortalView} from './components/views/PublicPortalView';import {PublicCompanyPortal} from './components/views/PublicCompanyPortal';import {AiScreeningView} from './components/views/AiScreeningView';import {AgendaView} from './components/views/AgendaView';import {DepartamentoPessoalView} from './components/views/DepartamentoPessoalView';import {AuditLogsView} from './components/views/AuditLogsView';import {CompanySettingsView} from './components/views/CompanySettingsView';import {MasterBuilderView} from './components/views/MasterBuilderView';
function publicCompanyFromUrl(){const p=location.pathname.match(/\/vagas\/([^/?#]+)/);const h=location.hash.match(/#\/vagas\/([^/?#]+)/);return decodeURIComponent(p?.[1]||h?.[1]||'')||null}
export function App(){const[currentTab,setCurrentTab]=useState<ViewTab>('dashboard');const[status,setStatus]=useState(dataService.getFirebaseStatus());const[publicEmpresaId,setPublicEmpresaId]=useState<string|null>(publicCompanyFromUrl);const[publicReady,setPublicReady]=useState(false);
 useEffect(()=>dataService.subscribe(()=>setStatus(dataService.getFirebaseStatus())),[]);useEffect(()=>{const h=()=>setPublicEmpresaId(publicCompanyFromUrl());addEventListener('popstate',h);addEventListener('hashchange',h);return()=>{removeEventListener('popstate',h);removeEventListener('hashchange',h)}},[]);useEffect(()=>{if(!publicEmpresaId){setPublicReady(false);return}let live=true;setPublicReady(false);dataService.loadPublicPortalFirebase(publicEmpresaId).finally(()=>live&&setPublicReady(true));return()=>{live=false}},[publicEmpresaId]);
 if(publicEmpresaId){if(!publicReady)return <div className="min-h-screen grid place-items-center bg-slate-50">Carregando vagas no Firebase...</div>;return <PublicCompanyPortal empresaId={publicEmpresaId} onBackToApp={()=>{history.pushState({},'','/');setPublicEmpresaId(null);setCurrentTab('dashboard')}}/>}if(!status.ready)return <div className="min-h-screen grid place-items-center bg-slate-50">Validando sessão Firebase...</div>;if(!status.authenticated)return <FirebaseLoginView error={status.error}/>;
 return <div className="flex min-h-screen bg-slate-50 font-sans text-slate-900 antialiased"><Sidebar currentTab={currentTab} onSelectTab={setCurrentTab}/><div className="flex flex-1 flex-col overflow-x-hidden"><Header onNavigateTab={setCurrentTab} currentTab={currentTab}/><main className="flex-1 w-full mx-auto p-4 sm:p-6 lg:p-8 max-w-7xl">{currentTab==='dashboard'&&<DashboardView onNavigateTab={setCurrentTab}/>} {currentTab==='master_admin'&&<MasterAdminView/>}{currentTab==='construtor_ia'&&<MasterBuilderView/>}{currentTab==='recrutamento'&&<RecruitmentView/>}{currentTab==='headhunter'&&<HeadhunterView/>}{currentTab==='portal_vagas'&&<PublicPortalView/>}{currentTab==='ia_screening'&&<AiScreeningView/>}{currentTab==='agenda'&&<AgendaView/>}{currentTab==='departamento_pessoal'&&<DepartamentoPessoalView/>}{currentTab==='audit_logs'&&<AuditLogsView/>}{currentTab==='settings'&&<CompanySettingsView/>}</main></div></div>}
export default App;
''')

write('src/components/Header.tsx', r'''import React,{useEffect,useState} from 'react';import {Bell,Briefcase,ChevronDown,Crown,LogOut,Plus,Search,Shield,UserCheck} from 'lucide-react';import {dataService} from '../services/dataService';
interface HeaderProps{onNavigateTab?:(tab:any)=>void;currentTab?:string}
export const Header:React.FC<HeaderProps>=({onNavigateTab,currentTab})=>{const[user,setUser]=useState(dataService.getCurrentUser());const[empresa,setEmpresa]=useState(dataService.getActiveEmpresa());const[notifs,setNotifs]=useState(dataService.getNotificacoes());const[showQuick,setShowQuick]=useState(false);const[showNotif,setShowNotif]=useState(false);useEffect(()=>dataService.subscribe(()=>{setUser(dataService.getCurrentUser());setEmpresa(dataService.getActiveEmpresa());setNotifs(dataService.getNotificacoes())}),[]);if(!user||!empresa)return null;const unread=notifs.filter(n=>!n.lida).length;const initials=(user.nome||'U').split(/\s+/).slice(0,2).map(x=>x[0]).join('').toUpperCase();return <div className="w-full flex flex-col z-30"><div className="bg-[#070e1c] text-white px-4 py-1.5 flex items-center justify-between text-xs font-semibold border-b border-slate-800"><div className="flex items-center gap-2"><Shield className="h-3.5 w-3.5 text-emerald-400"/><span className="text-slate-300 text-[11px]">Sessão Firebase: <strong className="text-white">{user.nome}</strong> ({user.email})</span><span className="rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 text-[10px] font-extrabold">FIREBASE AUTH</span></div><button onClick={()=>void dataService.logoutFirebase()} className="bg-[#851e29] text-white px-2.5 py-0.5 rounded text-[11px] font-bold flex items-center gap-1"><LogOut className="h-3 w-3"/>Encerrar Sessão</button></div><header className="flex h-16 w-full items-center justify-between border-b border-slate-200 bg-white px-4 sm:px-6 shadow-xs"><div className="flex items-center gap-3"><div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#123657] font-black text-white text-sm">RL</div><div><div className="flex items-center gap-2"><span className="text-base font-black text-[#123657]">RL CONNECT</span><span className="rounded-md bg-slate-100 text-slate-700 border px-2 py-0.5 text-[10px] font-extrabold">{empresa.nome?.toUpperCase()}</span></div><span className="text-[10px] font-semibold text-slate-500">Gestão Inteligente de Pessoas & Seleção</span></div></div><div className="hidden md:flex flex-1 max-w-md mx-6 relative"><Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400"/><input placeholder="Buscar candidato, vaga ou competência..." className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-4 py-2 text-xs"/></div><div className="flex items-center gap-3"><div className="relative"><button onClick={()=>setShowQuick(!showQuick)} className="flex items-center gap-1.5 rounded-xl bg-[#123657] px-3.5 py-2 text-xs font-bold text-white"><Plus className="h-4 w-4"/>Ação Rápida<ChevronDown className="h-3.5 w-3.5"/></button>{showQuick&&<div className="absolute right-0 mt-2 w-56 rounded-xl border bg-white p-2 shadow-xl z-50 text-xs"><button onClick={()=>{onNavigateTab?.('recrutamento');setShowQuick(false)}} className="flex w-full items-center gap-2 rounded-lg p-2 hover:bg-slate-100"><Briefcase className="h-4 w-4 text-blue-600"/>Nova Vaga</button><button onClick={()=>{onNavigateTab?.('headhunter');setShowQuick(false)}} className="flex w-full items-center gap-2 rounded-lg p-2 hover:bg-slate-100"><UserCheck className="h-4 w-4 text-indigo-600"/>Headhunter</button></div>}</div>{user.role==='master_admin'&&<button onClick={()=>onNavigateTab?.('master_admin')} className={`flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-black ${currentTab==='master_admin'?'bg-amber-500 text-slate-950':'bg-[#123657] text-amber-400'}`}><Crown className="h-4 w-4"/>Painel Master</button>}<div className="relative"><button onClick={()=>setShowNotif(!showNotif)} className="relative rounded-xl border bg-slate-50 p-2"><Bell className="h-4 w-4"/>{unread>0&&<span className="absolute -top-1 -right-1 h-4 min-w-4 rounded-full bg-rose-600 text-[9px] text-white grid place-items-center">{unread}</span>}</button>{showNotif&&<div className="absolute right-0 mt-2 w-80 rounded-2xl border bg-white p-3 shadow-2xl z-50"><div className="text-[10px] font-bold uppercase text-slate-500 border-b pb-2">Notificações Firestore</div><div className="mt-2 max-h-64 overflow-auto">{notifs.map(n=><button key={n.id} onClick={()=>dataService.markNotificacaoLida(n.id)} className="w-full text-left rounded-xl p-2.5 text-xs hover:bg-slate-50"><b>{n.titulo}</b><div className="text-[11px] text-slate-600">{n.mensagem}</div></button>)}</div></div>}</div><div className="flex items-center gap-2 pl-2 border-l"><div className="h-8 w-8 rounded-full bg-[#123657] text-xs font-extrabold text-white grid place-items-center">{initials}</div></div></div></header></div>}
''')

p=ROOT/'src/services/dataService.ts';t=p.read_text(encoding='utf-8')
if "firebaseStateBridge" not in t:t="import { firebaseStateBridge } from './firebaseStateBridge';\nimport { firebaseSessionService, normalizeRlRole } from './firebaseSessionService';\n"+t
t=re.sub(r"// Storage keys for persistent state.*?// Initial Seed Data","// Firebase é a única camada de persistência. Os arrays iniciais são apenas placeholders até a hidratação do Firestore.\nfunction loadFromStorage<T>(_key:string, defaultValue:T):T{return defaultValue;}\nfunction saveToStorage<T>(_key:string,_value:T):void{}\n\n// Initial Seed Data",t,flags=re.S)
t=t.replace("private currentUserId: string = loadFromStorage('currentUserId', 'usr_admin_1');","private currentUserId: string = '';").replace("private activeEmpresaId: string = loadFromStorage('activeEmpresaId', 'emp_1');","private activeEmpresaId: string = '';")
needle="  private listeners: Set<() => void> = new Set();\n\n  public subscribe"
if needle not in t:raise SystemExit('listeners marker missing')
insert="""  private listeners: Set<() => void> = new Set();
  private firebaseReady = false;
  private firebaseAuthenticated = false;
  private firebaseError: string | null = null;

  constructor() {
    firebaseSessionService.subscribe(async (session, error) => {
      this.firebaseError = error || null;
      if (!session) { this.firebaseAuthenticated=false; this.firebaseReady=true; this.listeners.forEach(fn=>fn()); return; }
      this.firebaseReady=false; this.firebaseAuthenticated=true;
      const profile:any={...session.profile,id:session.firebaseUser.uid,role:normalizeRlRole(session.profile.role||session.profile.tipoUsuario) as UserRole,empresa_id:session.companyId};
      this.currentUserId=profile.id; this.activeEmpresaId=profile.empresa_id;
      try { await this.hydrateTenantFromFirebase(profile.empresa_id,profile); this.firebaseError=null; }
      catch(e){ this.firebaseError=e instanceof Error?e.message:String(e); }
      finally { this.firebaseReady=true; this.listeners.forEach(fn=>fn()); }
    });
  }
  private async hydrateTenantFromFirebase(companyId:string,profile?:any){
    const state:any=await firebaseStateBridge.loadTenantState(companyId);
    this.empresas=state.empresas||[];this.usuarios=state.usuarios||[];if(profile&&!this.usuarios.some(u=>u.id===profile.id))this.usuarios.push(profile as Usuario);
    this.vagas=state.vagas||[];this.candidatos=state.candidatos||[];this.candidaturas=state.candidaturas||[];this.entrevistas=state.entrevistas||[];this.clientes=state.clientes||[];this.funcionarios=state.funcionarios||[];this.registroPontos=state.registroPontos||[];this.ferias=state.ferias||[];this.departamentos=state.departamentos||[];this.cargos=state.cargos||[];this.logs=state.logs||[];this.notificacoes=state.notificacoes||[];this.empresaModulos=state.empresaModulos||[];this.assinaturas=state.assinaturas||[];this.pagamentos=state.pagamentos||[];
  }
  public getFirebaseStatus(){return{ready:this.firebaseReady,authenticated:this.firebaseAuthenticated,error:this.firebaseError};}
  public loginFirebase(email:string,password:string){return firebaseSessionService.login(email,password);}
  public logoutFirebase(){return firebaseSessionService.logout();}
  public async loadPublicPortalFirebase(companyId:string){const s=await firebaseStateBridge.loadPublicPortal(companyId);this.activeEmpresaId=companyId;this.empresas=s.empresa?[s.empresa as Empresa]:[];this.vagas=s.vagas as Vaga[];this.listeners.forEach(fn=>fn());}

  public subscribe"""
t=t.replace(needle,insert,1)
start=t.index('  private notify(): void {');end=t.index('  // --- Session & Multi-Tenant Helpers ---',start)
block="""  private notify(): void { this.saveAll(); this.listeners.forEach(fn=>fn()); }
  private saveAll(): void {
    if(!this.firebaseReady||!this.firebaseAuthenticated||!this.activeEmpresaId)return;
    void firebaseStateBridge.persistTenantState(this.activeEmpresaId,{empresas:this.empresas,usuarios:this.usuarios,vagas:this.vagas,candidatos:this.candidatos,candidaturas:this.candidaturas,entrevistas:this.entrevistas,clientes:this.clientes,funcionarios:this.funcionarios,registroPontos:this.registroPontos,ferias:this.ferias,departamentos:this.departamentos,cargos:this.cargos,logs:this.logs,notificacoes:this.notificacoes,empresaModulos:this.empresaModulos,assinaturas:this.assinaturas,pagamentos:this.pagamentos}).catch(error=>{console.error('[Firestore] Falha ao persistir estado.',error);this.firebaseError=error instanceof Error?error.message:String(error);this.listeners.forEach(fn=>fn());});
  }

"""
t=t[:start]+block+t[end:]
t=re.sub(r"  public setCurrentUser\(id: string\): void \{.*?\n  \}\n\n  public getActiveEmpresa","  public setCurrentUser(_id: string): void { console.warn('[Firebase Auth] Troca local de usuário bloqueada.'); }\n\n  public getActiveEmpresa",t,flags=re.S)
t=t.replace('ativo: em ? em.ativo : true,','ativo: em ? em.ativo : false,').replace('PostgreSQL / Supabase','Firestore / Firebase').replace('Supabase Auth','Firebase Auth').replace('Supabase Realtime','Firestore Realtime')
p.write_text(t,encoding='utf-8')

write('.env.example','# RL Connect - Firebase único\nVITE_FIREBASE_API_KEY=\nVITE_FIREBASE_AUTH_DOMAIN=rl-connect-ed797.firebaseapp.com\nVITE_FIREBASE_PROJECT_ID=rl-connect-ed797\nVITE_FIREBASE_STORAGE_BUCKET=rl-connect-ed797.firebasestorage.app\nVITE_FIREBASE_MESSAGING_SENDER_ID=424978245385\nVITE_FIREBASE_APP_ID=1:424978245385:web:89a7946c5f277c13e015d8\nVITE_FIREBASE_MEASUREMENT_ID=G-0VMDCYK11M\nGEMINI_API_KEY=\nOPENAI_API_KEY=\nGOOGLE_CLIENT_ID=\nGOOGLE_CLIENT_SECRET=\nGOOGLE_REDIRECT_URI=\n')
write('.firebaserc','{\n  "projects": { "default": "rl-connect-ed797" }\n}\n')
write('firebase.json','{\n  "firestore": { "rules": "firebase/firestore.rules" },\n  "storage": { "rules": "firebase/storage.rules" }\n}\n')
write('firebase/firestore.rules',r'''rules_version = '2';
service cloud.firestore { match /databases/{database}/documents {
 function signedIn(){return request.auth!=null;} function userPath(){return /databases/$(database)/documents/usuarios/$(request.auth.uid);} function hasProfile(){return signedIn()&&exists(userPath());} function profile(){return get(userPath()).data;} function role(){return hasProfile()?profile().role:'';} function master(){return hasProfile()&&role() in ['master_admin','MASTER','MASTER_ADMIN','SUPER_ADMINISTRADOR'];} function tenant(){return hasProfile()?(profile().empresa_id!=null?profile().empresa_id:(profile().empresaId!=null?profile().empresaId:profile().companyId)):'';} function dataTenant(d){return d.empresa_id!=null?d.empresa_id:(d.empresaId!=null?d.empresaId:(d.companyId!=null?d.companyId:d.tenantId));} function same(d){return hasProfile()&&tenant()!=''&&dataTenant(d)==tenant();} function active(){return hasProfile()&&profile().ativo!=false&&!(profile().status in ['Inativo','Bloqueado','inativo','bloqueado']);} function access(d){return active()&&(master()||same(d));} function publicJob(d){return (d.publicado==true||d.publicada==true)&&!(d.status in ['encerrada','Encerrada','fechada','Fechada','cancelada','Cancelada']);}
 match /usuarios/{uid}{allow read:if signedIn()&&(request.auth.uid==uid||master()||same(resource.data));allow create,delete:if master();allow update:if master()||(active()&&same(resource.data)&&same(request.resource.data));}
 match /empresas/{id}{allow read:if master()||(active()&&tenant()==id)||resource.data.portal_publico==true;allow write:if master();}
 match /vagas/{id}{allow read:if publicJob(resource.data)||access(resource.data);allow create:if access(request.resource.data);allow update:if access(resource.data)&&access(request.resource.data);allow delete:if access(resource.data);}
 match /candidatos/{id}{allow read:if access(resource.data);allow create:if access(request.resource.data)||(request.resource.data.email is string&&dataTenant(request.resource.data)!='');allow update,delete:if access(resource.data)&&access(request.resource.data);}
 match /candidaturas/{id}{allow read:if access(resource.data);allow create:if access(request.resource.data)||(dataTenant(request.resource.data)!=''&&request.resource.data.vaga_id is string&&request.resource.data.candidato_id is string);allow update,delete:if access(resource.data)&&access(request.resource.data);}
 match /{collectionName}/{id}{allow read:if access(resource.data);allow create:if access(request.resource.data);allow update:if access(resource.data)&&access(request.resource.data);allow delete:if access(resource.data);}
}}
''')
write('firebase/storage.rules',r'''rules_version = '2';
service firebase.storage { match /b/{bucket}/o {
 function signedIn(){return request.auth!=null;} function profilePath(){return /databases/(default)/documents/usuarios/$(request.auth.uid);} function hasProfile(){return signedIn()&&firestore.exists(profilePath());} function profile(){return firestore.get(profilePath()).data;} function tenant(){return hasProfile()?(profile().empresa_id!=null?profile().empresa_id:(profile().empresaId!=null?profile().empresaId:profile().companyId)):'';} function master(){return hasProfile()&&profile().role in ['master_admin','MASTER','MASTER_ADMIN','SUPER_ADMINISTRADOR'];} function safe(){return request.resource!=null&&request.resource.size<=20*1024*1024&&request.resource.contentType.matches('(application/pdf|application/msword|application/vnd\\.openxmlformats-officedocument\\.wordprocessingml\\.document|image/jpeg|image/png|image/webp|text/plain)');}
 match /companies/{companyId}/{allPaths=**}{allow read,delete:if master()||tenant()==companyId;allow create,update:if (master()||tenant()==companyId)&&safe();}
 match /public_applications/{companyId}/{allPaths=**}{allow create:if safe();allow read,update,delete:if master()||tenant()==companyId;}
 match /public/{allPaths=**}{allow read:if true;allow write:if false;} match /{allPaths=**}{allow read,write:if false;}
}}
''')
print('Firebase-only recovery patch applied.')
