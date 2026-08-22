import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Clock3, Loader2, RefreshCw, ServerCog, X, XCircle } from 'lucide-react';
import { PontoIntegrationService, type PontoIntegrationStatus } from '../../services/PontoIntegrationService';
import { syncTenantsFromFirestore } from '../masterTenantsStore';
import type { ClientTenant } from '../types/master';

type RowState = {
  tenant: ClientTenant;
  enabled: boolean;
  loading: boolean;
  status: PontoIntegrationStatus | null;
  error: string;
};

function enabledFor(tenant: ClientTenant) {
  return Boolean(tenant.modules.departamentoPessoal || tenant.modules.ponto);
}

function prettyDate(value: string | null | undefined) {
  if (!value) return 'Ainda não sincronizado';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString('pt-BR');
}

export function MasterPontoStatusPanel({ onClose }: { onClose: () => void }) {
  const [rows, setRows] = useState<RowState[]>([]);
  const [loading, setLoading] = useState(true);
  const [globalError, setGlobalError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setGlobalError('');
    try {
      const tenants = await syncTenantsFromFirestore();
      const initial = tenants.map<RowState>((tenant) => ({
        tenant,
        enabled: enabledFor(tenant),
        loading: enabledFor(tenant),
        status: null,
        error: '',
      }));
      setRows(initial);

      await Promise.all(initial.map(async (row) => {
        if (!row.enabled) return;
        try {
          const status = await PontoIntegrationService.get(row.tenant.id);
          setRows((current) => current.map((item) => item.tenant.id === row.tenant.id
            ? { ...item, loading: false, status, error: '' }
            : item));
        } catch (error) {
          setRows((current) => current.map((item) => item.tenant.id === row.tenant.id
            ? { ...item, loading: false, error: error instanceof Error ? error.message : 'Falha ao consultar status.' }
            : item));
        }
      }));
    } catch (error) {
      setGlobalError(error instanceof Error ? error.message : 'Não foi possível carregar as empresas.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const enabledCount = useMemo(() => rows.filter((row) => row.enabled).length, [rows]);
  const connectedCount = useMemo(() => rows.filter((row) => row.status?.status === 'CONECTADO').length, [rows]);

  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/70 p-3 sm:p-6" role="dialog" aria-modal="true" aria-label="PONTO RH Automático">
      <div className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-slate-700 bg-slate-900 text-slate-100 shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-800 px-5 py-4">
          <div>
            <div className="flex items-center gap-2"><ServerCog className="h-5 w-5 text-emerald-400" /><h2 className="text-lg font-black text-white">PONTO RH — Integração automática</h2></div>
            <p className="mt-1 text-xs text-slate-400">Sem Client ID ou Secret por empresa. O RH-MIL identifica cada tenant pelo empresaId e provisiona automaticamente quando DP/Ponto é ativado.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white" aria-label="Fechar"><X className="h-5 w-5" /></button>
        </div>

        <div className="grid gap-3 border-b border-slate-800 p-4 sm:grid-cols-3">
          <Summary label="Empresas cadastradas" value={rows.length} />
          <Summary label="DP/Ponto ativado" value={enabledCount} />
          <Summary label="Conectadas" value={connectedCount} />
        </div>

        <div className="flex items-center justify-between gap-3 border-b border-slate-800 px-4 py-3">
          <span className="text-xs text-slate-400">O status abaixo é apenas diagnóstico. A configuração continua automática no backend.</span>
          <button type="button" onClick={() => void load()} className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-bold hover:bg-slate-700"><RefreshCw className="h-4 w-4" />Atualizar status</button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {globalError && <div className="mb-3 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-200">{globalError}</div>}
          {loading && rows.length === 0 ? (
            <div className="flex items-center justify-center gap-2 py-12 text-sm text-slate-400"><Loader2 className="h-5 w-5 animate-spin" />Carregando empresas...</div>
          ) : rows.length === 0 ? (
            <div className="rounded-xl border border-slate-800 bg-slate-950 p-5 text-sm text-slate-400">Nenhuma empresa cadastrada.</div>
          ) : (
            <div className="space-y-3">
              {rows.map((row) => {
                const connected = row.status?.status === 'CONECTADO';
                return (
                  <div key={row.tenant.id} className="rounded-xl border border-slate-800 bg-slate-950 p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <div className="font-black text-white">{row.tenant.tradeName || row.tenant.companyName || row.tenant.id}</div>
                        <div className="mt-1 text-xs text-slate-500">empresaId: {row.tenant.id}</div>
                      </div>
                      {!row.enabled ? (
                        <Badge text="DP/Ponto desativado" kind="off" />
                      ) : row.loading ? (
                        <Badge text="Consultando..." kind="loading" />
                      ) : connected ? (
                        <Badge text="Conectado automaticamente" kind="ok" />
                      ) : row.error ? (
                        <Badge text="Erro de integração" kind="error" />
                      ) : (
                        <Badge text={row.status?.status || 'Provisionamento pendente'} kind="pending" />
                      )}
                    </div>
                    {row.enabled && (
                      <div className="mt-3 grid gap-2 text-xs text-slate-400 sm:grid-cols-2">
                        <div className="flex items-center gap-2"><Clock3 className="h-3.5 w-3.5" />Última sincronização: {prettyDate(row.status?.lastSyncAt)}</div>
                        <div>Status técnico: {row.status?.status || (row.error ? 'ERRO' : 'PENDENTE')}</div>
                      </div>
                    )}
                    {(row.error || row.status?.lastError) && <div className="mt-3 rounded-lg border border-rose-500/20 bg-rose-500/10 p-2 text-xs text-rose-200">{row.error || row.status?.lastError}</div>}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Summary({ label, value }: { label: string; value: number }) {
  return <div className="rounded-xl border border-slate-800 bg-slate-950 p-3"><div className="text-xs text-slate-400">{label}</div><div className="mt-1 text-xl font-black text-white">{value}</div></div>;
}

function Badge({ text, kind }: { text: string; kind: 'ok' | 'off' | 'loading' | 'error' | 'pending' }) {
  const classes = kind === 'ok'
    ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
    : kind === 'error'
      ? 'border-rose-500/30 bg-rose-500/10 text-rose-300'
      : 'border-slate-700 bg-slate-800 text-slate-300';
  const Icon = kind === 'ok' ? CheckCircle2 : kind === 'error' ? XCircle : kind === 'loading' ? Loader2 : ServerCog;
  return <span className={`inline-flex items-center gap-2 self-start rounded-full border px-3 py-1.5 text-xs font-bold ${classes}`}><Icon className={`h-3.5 w-3.5 ${kind === 'loading' ? 'animate-spin' : ''}`} />{text}</span>;
}
