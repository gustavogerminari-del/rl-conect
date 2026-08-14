import { collection, deleteDoc, doc, getDoc, getDocs, query, setDoc, where } from 'firebase/firestore';
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
