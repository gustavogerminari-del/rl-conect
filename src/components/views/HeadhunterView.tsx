import React, { useState } from 'react';
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
