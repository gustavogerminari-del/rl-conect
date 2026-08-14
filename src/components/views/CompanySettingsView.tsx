import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  Building2,
  CalendarDays,
  Check,
  CheckCircle2,
  Loader2,
  RefreshCw,
  Save,
  Settings,
  ShieldCheck,
  Unplug,
  Users,
} from 'lucide-react';
import { dataService } from '../../services/dataService';
import { googleCalendarService, type GoogleCalendarStatus } from '../../services/googleCalendarService';

export const CompanySettingsView: React.FC = () => {
  const activeEmpresa = dataService.getActiveEmpresa();
  const usuarios = dataService.getUsuarios();
  const currentUser = dataService.getCurrentUser();
  const canManageIntegrations = ['master_admin', 'empresa_admin'].includes(currentUser.role);

  const [nome, setNome] = useState(activeEmpresa.nome);
  const [cnpj, setCnpj] = useState(activeEmpresa.cnpj);
  const [cidade, setCidade] = useState(activeEmpresa.cidade);
  const [estado, setEstado] = useState(activeEmpresa.estado);
  const [endereco, setEndereco] = useState(activeEmpresa.endereco);
  const [saved, setSaved] = useState(false);
  const [calendarStatus, setCalendarStatus] = useState<GoogleCalendarStatus | null>(null);
  const [calendarLoading, setCalendarLoading] = useState(true);
  const [calendarBusy, setCalendarBusy] = useState(false);
  const [calendarMessage, setCalendarMessage] = useState('');
  const [calendarError, setCalendarError] = useState('');

  const loadCalendarStatus = async () => {
    setCalendarLoading(true);
    setCalendarError('');
    try {
      setCalendarStatus(await googleCalendarService.getStatus());
    } catch (error) {
      setCalendarStatus({ configured: false, connected: false });
      setCalendarError(error instanceof Error ? error.message : 'Não foi possível consultar a integração Google.');
    } finally {
      setCalendarLoading(false);
    }
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const oauthResult = params.get('googleCalendar');
    if (oauthResult === 'connected') {
      setCalendarMessage('Google Calendar conectado com sucesso para esta empresa.');
    } else if (oauthResult === 'error') {
      setCalendarError(params.get('reason') || 'A autorização do Google Calendar não foi concluída.');
    }
    if (oauthResult) {
      params.delete('googleCalendar');
      params.delete('reason');
      const next = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ''}${window.location.hash}`;
      window.history.replaceState({}, '', next);
    }
    void loadCalendarStatus();
  }, []);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    dataService.updateEmpresa(activeEmpresa.id, { nome, cnpj, cidade, estado, endereco });
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const handleConnectGoogle = async () => {
    setCalendarBusy(true);
    setCalendarError('');
    setCalendarMessage('');
    try {
      await googleCalendarService.connect();
    } catch (error) {
      setCalendarBusy(false);
      setCalendarError(error instanceof Error ? error.message : 'Não foi possível iniciar a conexão com o Google Calendar.');
    }
  };

  const handleDisconnectGoogle = async () => {
    if (!window.confirm('Desconectar o Google Calendar desta empresa? Os eventos existentes não serão apagados automaticamente.')) return;
    setCalendarBusy(true);
    setCalendarError('');
    setCalendarMessage('');
    try {
      await googleCalendarService.disconnect();
      setCalendarMessage('Google Calendar desconectado desta empresa.');
      await loadCalendarStatus();
    } catch (error) {
      setCalendarError(error instanceof Error ? error.message : 'Não foi possível desconectar o Google Calendar.');
    } finally {
      setCalendarBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-6 text-white shadow-xl sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-lg"><Settings className="h-6 w-6" /></div>
          <div>
            <h1 className="text-xl font-extrabold tracking-tight">Configurações da Empresa</h1>
            <p className="mt-0.5 text-xs text-indigo-200">Dados do tenant, usuários autorizados e integrações externas.</p>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <form onSubmit={handleSave} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4 text-xs">
          <h2 className="font-bold text-slate-900 text-base flex items-center gap-2 border-b border-slate-100 pb-3"><Building2 className="h-5 w-5 text-indigo-600" /> Dados Institucionais</h2>
          <div><label className="font-bold text-slate-700">Razão Social / Nome Fantasia</label><input type="text" value={nome} onChange={(e) => setNome(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 focus:border-indigo-500 focus:outline-none" /></div>
          <div><label className="font-bold text-slate-700">CNPJ</label><input type="text" value={cnpj} onChange={(e) => setCnpj(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 focus:border-indigo-500 focus:outline-none" /></div>
          <div><label className="font-bold text-slate-700">Endereço Comercial</label><input type="text" value={endereco} onChange={(e) => setEndereco(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 focus:border-indigo-500 focus:outline-none" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="font-bold text-slate-700">Cidade</label><input type="text" value={cidade} onChange={(e) => setCidade(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 focus:border-indigo-500 focus:outline-none" /></div>
            <div><label className="font-bold text-slate-700">Estado</label><input type="text" value={estado} onChange={(e) => setEstado(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 focus:border-indigo-500 focus:outline-none" /></div>
          </div>
          <div className="pt-4 border-t border-slate-100 flex justify-end"><button type="submit" className="flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 font-bold text-white hover:bg-indigo-700 shadow-md">{saved ? <><Check className="h-4 w-4" /> Salvo</> : <><Save className="h-4 w-4" /> Salvar Alterações</>}</button></div>
        </form>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4 text-xs">
          <h2 className="font-bold text-slate-900 text-base flex items-center gap-2 border-b border-slate-100 pb-3"><Users className="h-5 w-5 text-indigo-600" /> Usuários com Acesso ({usuarios.length})</h2>
          <div className="space-y-3">{usuarios.map((u) => <div key={u.id} className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 p-3"><div><div className="font-bold text-slate-900">{u.nome}</div><div className="text-[11px] text-slate-500">{u.email}</div></div><span className="rounded-full bg-indigo-100 px-2.5 py-0.5 text-[10px] font-bold text-indigo-800 uppercase">{u.role.replace('_', ' ')}</span></div>)}</div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm text-xs">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-base font-bold text-slate-900"><CalendarDays className="h-5 w-5 text-indigo-600" /> Integrações → Google Calendar & Meet</h2>
            <p className="mt-1 max-w-3xl text-slate-500">A autorização Google é usada exclusivamente para criar, atualizar e cancelar eventos e gerar Google Meet nas entrevistas desta empresa.</p>
          </div>
          <button onClick={() => void loadCalendarStatus()} disabled={calendarLoading} className="flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50"><RefreshCw className={`h-3.5 w-3.5 ${calendarLoading ? 'animate-spin' : ''}`} /> Atualizar</button>
        </div>

        <div className="mt-5 rounded-xl border border-indigo-200 bg-indigo-50 p-4 text-indigo-900">
          <div className="flex items-start gap-3"><ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-indigo-700" /><div><div className="font-extrabold">Google NÃO é login do RL Connect</div><p className="mt-1 text-indigo-800">Não existe “Entrar com Google” nesta integração. Primeiro o usuário precisa estar cadastrado, autenticado e autorizado normalmente no RL Connect; somente depois um administrador pode conectar o Calendar.</p></div></div>
        </div>

        <div className="mt-4 flex flex-col gap-4 rounded-xl border border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            {calendarLoading ? (
              <div className="flex items-center gap-2 font-bold text-slate-600"><Loader2 className="h-4 w-4 animate-spin" /> Consultando integração...</div>
            ) : calendarStatus?.connected ? (
              <div className="flex items-start gap-2"><CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-600" /><div><div className="font-extrabold text-emerald-800">Google Calendar conectado</div><div className="mt-0.5 text-slate-500">Conta: {calendarStatus.accountEmail || 'conta Google autorizada'} · Calendário: {calendarStatus.calendarId || 'primary'}</div></div></div>
            ) : (
              <div className="flex items-start gap-2"><AlertCircle className="mt-0.5 h-5 w-5 text-amber-600" /><div><div className="font-extrabold text-amber-800">Google Calendar não conectado</div><div className="mt-0.5 text-slate-500">As entrevistas presenciais continuam funcionando. Google Meet só será criado após a conexão.</div></div></div>
            )}
            {!calendarStatus?.configured && !calendarLoading && <p className="mt-2 text-amber-700">O servidor ainda precisa das credenciais Google e Supabase descritas no arquivo .env.example.</p>}
          </div>

          {canManageIntegrations ? (
            calendarStatus?.connected ? (
              <button onClick={() => void handleDisconnectGoogle()} disabled={calendarBusy} className="flex shrink-0 items-center justify-center gap-2 rounded-xl border border-rose-200 bg-white px-4 py-2.5 font-bold text-rose-700 hover:bg-rose-50 disabled:opacity-50">{calendarBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Unplug className="h-4 w-4" />} Desconectar Google</button>
            ) : (
              <button onClick={() => void handleConnectGoogle()} disabled={calendarBusy || !calendarStatus?.configured} className="flex shrink-0 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 font-bold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50">{calendarBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarDays className="h-4 w-4" />} Conectar Google Calendar</button>
            )
          ) : (
            <span className="rounded-lg bg-slate-100 px-3 py-2 font-semibold text-slate-600">Somente Administrador da Empresa/Master pode conectar ou desconectar.</span>
          )}
        </div>

        {calendarMessage && <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 font-semibold text-emerald-700">{calendarMessage}</div>}
        {calendarError && <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 font-semibold text-rose-700">{calendarError}</div>}
      </div>
    </div>
  );
};
