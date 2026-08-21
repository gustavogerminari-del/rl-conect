import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Database, Link2, Loader2, RefreshCw, Save, TestTube2, X } from 'lucide-react';
import { PontoIntegrationService, type PontoIntegrationConfig } from '../../services/PontoIntegrationService';
import { syncTenantsFromFirestore } from '../masterTenantsStore';
import type { ClientTenant } from '../types/master';

const DEFAULT_URL = 'https://pronto-rh.gustavogerminari.workers.dev';
const inputClass = 'w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white outline-none focus:border-amber-400';
const primaryButton = 'inline-flex items-center justify-center gap-2 rounded-xl bg-amber-500 px-4 py-2.5 text-xs font-black text-slate-950 hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-50';
const secondaryButton = 'inline-flex items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-800 px-3 py-2.5 text-xs font-bold text-slate-200 hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50';

function statusClass(status: string) {
  const normalized = status.toUpperCase();
  if (normalized === 'CONECTADO') return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300';
  if (normalized === 'ERRO') return 'border-rose-500/30 bg-rose-500/10 text-rose-300';
  return 'border-amber-500/30 bg-amber-500/10 text-amber-200';
}

function formatDate(value?: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('pt-BR');
}

export function PontoIntegrationPanel({ onClose }: { onClose: () => void }) {
  const [tenants, setTenants] = useState<ClientTenant[]>([]);
  const [companyId, setCompanyId] = useState('');
  const [baseUrl, setBaseUrl] = useState(DEFAULT_URL);
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [config, setConfig] = useState<PontoIntegrationConfig | null>(null);
  const [loadingTenants, setLoadingTenants] = useState(true);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const selectedTenant = useMemo(() => tenants.find((item) => item.id === companyId) || null, [tenants, companyId]);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const result = await syncTenantsFromFirestore();
        if (!active) return;
        setTenants(result);
        setCompanyId((current) => current || result[0]?.id || '');
      } catch (caught) {
        if (active) setError(caught instanceof Error ? caught.message : 'Não foi possível carregar as empresas.');
      } finally {
        if (active) setLoadingTenants(false);
      }
    })();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!companyId) return;
    let active = true;
    setLoading(true);
    setError('');
    setMessage('');
    void PontoIntegrationService.get(companyId)
      .then((next) => {
        if (!active) return;
        setConfig(next);
        setBaseUrl(next.baseUrl || DEFAULT_URL);
        setClientId(next.clientId || '');
        setClientSecret('');
      })
      .catch((caught) => {
        if (!active) return;
        setConfig(null);
        setBaseUrl(DEFAULT_URL);
        setClientId('');
        setClientSecret('');
        setError(caught instanceof Error ? caught.message : 'Não foi possível carregar a integração.');
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [companyId]);

  const refresh = async () => {
    if (!companyId) return;
    const next = await PontoIntegrationService.get(companyId);
    setConfig(next);
    setBaseUrl(next.baseUrl || DEFAULT_URL);
    setClientId(next.clientId || '');
    setClientSecret('');
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!companyId) return;
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const next = await PontoIntegrationService.save({ companyId, baseUrl, clientId, clientSecret: clientSecret || undefined });
      setConfig(next);
      setClientSecret('');
      setMessage('Credenciais salvas com segurança. Agora use “Testar conexão”.');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Não foi possível salvar.');
    } finally {
      setSaving(false);
    }
  };

  const test = async () => {
    if (!companyId) return;
    setTesting(true);
    setError('');
    setMessage('');
    try {
      await PontoIntegrationService.test(companyId);
      await refresh();
      setMessage('Conexão real com o PONTO RH validada com sucesso.');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Falha ao testar a conexão.');
      await refresh().catch(() => undefined);
    } finally {
      setTesting(false);
    }
  };

  const sync = async () => {
    if (!companyId) return;
    setSyncing(true);
    setError('');
    setMessage('');
    try {
      const result = await PontoIntegrationService.sync(companyId);
      await refresh();
      setMessage(`Sincronização concluída: ${result.importedPunches} marcações e ${result.bankRecords} saldos de banco de horas.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Falha na sincronização.');
      await refresh().catch(() => undefined);
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[220] overflow-y-auto bg-slate-950 text-slate-100">
      <header className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 bg-slate-900 px-5 py-4 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500 text-slate-950"><Link2 className="h-5 w-5" /></div>
          <div><h1 className="font-black text-white">Integração PONTO RH</h1><p className="text-xs text-slate-400">Uma API para todas as empresas, com credenciais e dados isolados por empresa.</p></div>
        </div>
        <button type="button" onClick={onClose} className={secondaryButton}><X className="h-4 w-4" />Voltar ao Painel Master</button>
      </header>

      <main className="mx-auto max-w-5xl space-y-5 p-4 sm:p-6">
        <div className="rounded-2xl border border-sky-500/20 bg-sky-500/10 p-4 text-sm text-sky-100">
          O PONTO RH usa uma única URL de API. Cada empresa recebe seu próprio <b>Client ID</b> e <b>Client Secret</b>. O segredo é enviado somente ao backend do RH-MIL e fica armazenado criptografado.
        </div>

        <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <label className="block text-xs font-black uppercase tracking-wide text-slate-400">Empresa do RH-MIL</label>
          <select className={`${inputClass} mt-2`} value={companyId} onChange={(event) => setCompanyId(event.target.value)} disabled={loadingTenants}>
            <option value="">Selecione uma empresa</option>
            {tenants.map((tenant) => <option key={tenant.id} value={tenant.id}>{tenant.companyName}</option>)}
          </select>
          {selectedTenant && <p className="mt-2 text-xs text-slate-500">Empresa selecionada: {selectedTenant.companyName} • {selectedTenant.cnpj || 'CNPJ não informado'}</p>}
        </section>

        {error && <div className="flex items-start gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-200"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />{error}</div>}
        {message && <div className="flex items-start gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-200"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />{message}</div>}

        {companyId && (
          <div className="grid gap-5 lg:grid-cols-[1.35fr_0.65fr]">
            <form onSubmit={save} className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900 p-5">
              <div><h2 className="font-black text-white">Credenciais da empresa</h2><p className="mt-1 text-xs text-slate-400">Copie estas credenciais da área de Integrações do PONTO RH.</p></div>
              <label className="block text-xs font-bold text-slate-300">URL única do PONTO RH<input required className={`${inputClass} mt-1.5`} value={baseUrl} onChange={(event) => setBaseUrl(event.target.value)} placeholder={DEFAULT_URL} /></label>
              <label className="block text-xs font-bold text-slate-300">Client ID<input required className={`${inputClass} mt-1.5`} value={clientId} onChange={(event) => setClientId(event.target.value)} placeholder="prh_..." autoComplete="off" /></label>
              <label className="block text-xs font-bold text-slate-300">Client Secret<input className={`${inputClass} mt-1.5`} type="password" value={clientSecret} onChange={(event) => setClientSecret(event.target.value)} placeholder={config?.hasClientSecret ? '•••••••••••••••• (já salvo — deixe vazio para manter)' : 'Cole o Client Secret'} autoComplete="new-password" /></label>
              <div className="flex flex-wrap gap-2">
                <button className={primaryButton} disabled={saving || loading}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}{saving ? 'Salvando...' : 'Salvar credenciais'}</button>
                <button type="button" onClick={test} className={secondaryButton} disabled={testing || !config?.hasClientSecret}>{testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <TestTube2 className="h-4 w-4" />}{testing ? 'Testando...' : 'Testar conexão'}</button>
              </div>
            </form>

            <section className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900 p-5">
              <div className="flex items-center justify-between gap-2"><h2 className="font-black text-white">Status</h2><span className={`rounded-full border px-2.5 py-1 text-[10px] font-black ${statusClass(config?.status || 'NAO_CONFIGURADO')}`}>{(config?.status || 'NÃO CONFIGURADO').replaceAll('_', ' ')}</span></div>
              <div className="space-y-2 text-xs text-slate-400">
                <p>Empresa no PONTO RH: <b className="text-slate-200">{config?.pontoCompanyName || '—'}</b></p>
                <p>ID no PONTO RH: <b className="break-all text-slate-200">{config?.pontoCompanyId || '—'}</b></p>
                <p>Último teste: <b className="text-slate-200">{formatDate(config?.lastCheckedAt)}</b></p>
                <p>Última sincronização: <b className="text-slate-200">{formatDate(config?.lastSyncAt)}</b></p>
              </div>
              {config?.lastError && <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-3 text-xs text-rose-200">{config.lastError}</div>}
              <button type="button" onClick={sync} className={`${primaryButton} w-full`} disabled={syncing || config?.status !== 'CONECTADO'}>{syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Database className="h-4 w-4" />}{syncing ? 'Sincronizando...' : 'Sincronizar ponto agora'}</button>
              <button type="button" onClick={() => void refresh()} className={`${secondaryButton} w-full`} disabled={loading}>{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}Atualizar status</button>
            </section>
          </div>
        )}
      </main>
    </div>
  );
}
