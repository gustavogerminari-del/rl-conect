import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Calendar as CalendarIcon,
  CheckCircle2,
  Clock,
  ExternalLink,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Share2,
  Trash2,
  Video,
  X,
} from 'lucide-react';
import { dataService } from '../../services/dataService';
import { googleCalendarService, type GoogleCalendarStatus } from '../../services/googleCalendarService';
import { interviewService, type EnhancedEntrevista } from '../../services/interviewService';

const DEFAULT_TIMEZONE = 'America/Sao_Paulo';

function toLocalInput(iso?: string): string {
  if (!iso) {
    const d = new Date(Date.now() + 60 * 60 * 1000);
    d.setSeconds(0, 0);
    const tzOffset = d.getTimezoneOffset() * 60_000;
    return new Date(d.getTime() - tzOffset).toISOString().slice(0, 16);
  }
  const d = new Date(iso);
  const tzOffset = d.getTimezoneOffset() * 60_000;
  return new Date(d.getTime() - tzOffset).toISOString().slice(0, 16);
}

export const AgendaView: React.FC = () => {
  const [entrevistas, setEntrevistas] = useState<EnhancedEntrevista[]>(() => interviewService.getAll());
  const vagas = dataService.getVagas();
  const candidatos = dataService.getCandidatos();
  const usuarios = dataService.getUsuarios();
  const currentUser = dataService.getCurrentUser();

  const [calendarStatus, setCalendarStatus] = useState<GoogleCalendarStatus | null>(null);
  const [calendarError, setCalendarError] = useState('');
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<EnhancedEntrevista | null>(null);
  const [vagaId, setVagaId] = useState(vagas[0]?.id || '');
  const [candidatoId, setCandidatoId] = useState(candidatos[0]?.id || '');
  const [entrevistadorId, setEntrevistadorId] = useState(currentUser.id);
  const [titulo, setTitulo] = useState('Entrevista');
  const [dataHora, setDataHora] = useState(toLocalInput());
  const [duracao, setDuracao] = useState(45);
  const [formato, setFormato] = useState<'Online - Google Meet' | 'Presencial' | 'Telefone'>('Online - Google Meet');
  const [anotacoes, setAnotacoes] = useState('');
  const [formError, setFormError] = useState('');

  const refreshData = () => setEntrevistas(interviewService.getAll());

  const loadCalendarStatus = async () => {
    setLoadingStatus(true);
    setCalendarError('');
    try {
      const status = await googleCalendarService.getStatus();
      setCalendarStatus(status);
    } catch (error) {
      setCalendarStatus({ configured: false, connected: false });
      setCalendarError(error instanceof Error ? error.message : 'Não foi possível consultar o Google Calendar.');
    } finally {
      setLoadingStatus(false);
    }
  };

  useEffect(() => {
    void loadCalendarStatus();
  }, []);

  const selectedCandidate = useMemo(
    () => candidatos.find((item) => item.id === candidatoId),
    [candidatos, candidatoId]
  );
  const selectedVaga = useMemo(
    () => vagas.find((item) => item.id === vagaId),
    [vagas, vagaId]
  );
  const selectedInterviewer = useMemo(
    () => usuarios.find((item) => item.id === entrevistadorId) || currentUser,
    [usuarios, entrevistadorId, currentUser]
  );

  const resetForm = () => {
    setEditing(null);
    setVagaId(vagas[0]?.id || '');
    setCandidatoId(candidatos[0]?.id || '');
    setEntrevistadorId(currentUser.id);
    setTitulo('Entrevista');
    setDataHora(toLocalInput());
    setDuracao(45);
    setFormato('Online - Google Meet');
    setAnotacoes('');
    setFormError('');
  };

  const openCreate = () => {
    resetForm();
    setShowModal(true);
  };

  const openEdit = (ent: EnhancedEntrevista) => {
    setEditing(ent);
    setVagaId(ent.vaga_id);
    setCandidatoId(ent.candidato_id);
    setEntrevistadorId(ent.entrevistador_id || currentUser.id);
    setTitulo(ent.titulo);
    setDataHora(toLocalInput(ent.data_hora));
    setDuracao(ent.duracao_minutos || 45);
    setFormato(ent.formato === 'Online - Google Meet' ? 'Online - Google Meet' : ent.formato === 'Telefone' ? 'Telefone' : 'Presencial');
    setAnotacoes(ent.anotacoes || '');
    setFormError('');
    setShowModal(true);
  };

  const buildDescription = () => {
    return [
      `Empresa: ${dataService.getActiveEmpresa().nome}`,
      `Vaga: ${selectedVaga?.titulo || 'Não informada'}`,
      `Candidato: ${selectedCandidate?.nome || 'Não informado'}`,
      `Entrevistador: ${selectedInterviewer?.nome || 'Não informado'}`,
      `Origem do processo: ${selectedVaga?.modulo_origem === 'headhunter' ? 'HEADHUNTER' : 'RECRUTAMENTO INTERNO'}`,
      anotacoes ? `Observações: ${anotacoes}` : '',
    ].filter(Boolean).join('\n');
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    const start = new Date(dataHora);
    if (!Number.isFinite(start.getTime())) {
      setFormError('Informe uma data e horário válidos.');
      return;
    }
    const end = new Date(start.getTime() + Math.max(15, duracao) * 60_000);

    if (formato === 'Online - Google Meet' && !calendarStatus?.connected) {
      setFormError('Google Calendar não está conectado para esta empresa. Conecte em Configurações → Integrações antes de criar um Meet.');
      return;
    }

    try {
      if (editing) {
        setBusyId(editing.id);
        let calendarResult: Awaited<ReturnType<typeof googleCalendarService.updateEvent>> | null = null;
        if (formato === 'Online - Google Meet' && editing.google_calendar_event_id) {
          calendarResult = await googleCalendarService.updateEvent(editing.google_calendar_event_id, {
            title: titulo,
            description: buildDescription(),
            start: start.toISOString(),
            end: end.toISOString(),
            timezone: DEFAULT_TIMEZONE,
            attendees: [selectedCandidate?.email, selectedInterviewer?.email].filter(Boolean) as string[],
          });
        }

        interviewService.update(editing.id, {
          vaga_id: vagaId,
          candidato_id: candidatoId,
          entrevistador_id: entrevistadorId,
          titulo,
          data_hora: start.toISOString(),
          inicio_em: start.toISOString(),
          fim_em: end.toISOString(),
          duracao_minutos: Math.max(15, duracao),
          formato,
          anotacoes,
          status: 'remarcada',
          google_meet_url: calendarResult?.meetUrl || editing.google_meet_url,
          link_reuniao: calendarResult?.meetUrl || editing.google_meet_url,
          integration_status: editing.google_calendar_event_id ? 'synced' : 'not_synced',
          integration_error: undefined,
        });
      } else {
        const created = interviewService.create(
          {
            candidatura_id: dataService.getCandidaturas().find(
              (item) => item.vaga_id === vagaId && item.candidato_id === candidatoId
            )?.id || '',
            vaga_id: vagaId,
            candidato_id: candidatoId,
            titulo,
            data_hora: start.toISOString(),
            duracao_minutos: Math.max(15, duracao),
            formato,
            link_reuniao: undefined,
            entrevistador_id: entrevistadorId,
            status: 'agendada',
            anotacoes,
            sincronizado_gcal: false,
          },
          {
            integration_status: formato === 'Online - Google Meet' ? 'pending' : 'not_synced',
            timezone: DEFAULT_TIMEZONE,
            inicio_em: start.toISOString(),
            fim_em: end.toISOString(),
          }
        );

        if (formato === 'Online - Google Meet') {
          setBusyId(created.id);
          try {
            const calendarResult = await googleCalendarService.createEvent({
              interviewId: created.id,
              title: titulo,
              description: buildDescription(),
              start: start.toISOString(),
              end: end.toISOString(),
              timezone: DEFAULT_TIMEZONE,
              attendees: [selectedCandidate?.email, selectedInterviewer?.email].filter(Boolean) as string[],
              createMeet: true,
            });
            interviewService.update(created.id, {
              google_calendar_event_id: calendarResult.eventId,
              google_calendar_id: calendarResult.calendarId || 'primary',
              google_meet_url: calendarResult.meetUrl || undefined,
              google_event_html_link: calendarResult.htmlLink || undefined,
              link_reuniao: calendarResult.meetUrl || undefined,
              sincronizado_gcal: true,
              integration_status: 'synced',
              integration_error: undefined,
            });
          } catch (error) {
            const message = error instanceof Error ? error.message : 'Falha ao criar o evento Google.';
            interviewService.setIntegrationError(created.id, message);
            throw error;
          }
        }
      }

      setShowModal(false);
      resetForm();
      refreshData();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Não foi possível salvar a entrevista.');
      refreshData();
    } finally {
      setBusyId(null);
    }
  };

  const handleCancel = async (ent: EnhancedEntrevista) => {
    if (!window.confirm(`Cancelar a entrevista "${ent.titulo}"?`)) return;
    setBusyId(ent.id);
    setCalendarError('');
    try {
      if (ent.google_calendar_event_id) {
        await googleCalendarService.deleteEvent(ent.google_calendar_event_id);
      }
      interviewService.update(ent.id, {
        status: 'cancelada',
        integration_status: ent.google_calendar_event_id ? 'cancelled' : 'not_synced',
        sincronizado_gcal: false,
        link_reuniao: undefined,
        google_meet_url: undefined,
      });
      refreshData();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Não foi possível cancelar o evento.';
      interviewService.setIntegrationError(ent.id, message);
      setCalendarError(message);
      refreshData();
    } finally {
      setBusyId(null);
    }
  };

  const statusLabel = (ent: EnhancedEntrevista) => {
    if (ent.status === 'cancelada') return 'Cancelada';
    if (ent.integration_status === 'synced' && ent.google_calendar_event_id) return 'Calendar sincronizado';
    if (ent.integration_status === 'error') return 'Erro de sincronização';
    if (ent.integration_status === 'legacy_unverified') return 'Integração antiga não validada';
    if (ent.integration_status === 'pending') return 'Sincronizando';
    return 'Sem sincronização Google';
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-6 text-white shadow-xl sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-lg">
            <CalendarIcon className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold tracking-tight">Agenda Integrada de Entrevistas</h1>
            <p className="mt-0.5 text-xs text-indigo-200">Google Calendar e Meet reais, vinculados à empresa autenticada no RL Connect.</p>
          </div>
        </div>
        <button onClick={openCreate} className="flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-xs font-bold text-slate-900 hover:bg-slate-100 shadow-md">
          <Plus className="h-4 w-4" /> Agendar Nova Entrevista
        </button>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm text-xs">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 font-bold text-slate-700">
            <Share2 className="h-4 w-4 text-indigo-600" /> Status Google Calendar:
          </div>
          {loadingStatus ? (
            <span className="flex items-center gap-1 text-slate-500"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Consultando...</span>
          ) : calendarStatus?.connected ? (
            <span className="flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-1 font-bold text-emerald-800 border border-emerald-200">
              <CheckCircle2 className="h-3.5 w-3.5" /> Conectado {calendarStatus.accountEmail ? `(${calendarStatus.accountEmail})` : ''}
            </span>
          ) : (
            <span className="flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-1 font-bold text-amber-800 border border-amber-200">
              <AlertCircle className="h-3.5 w-3.5" /> Não conectado
            </span>
          )}
          <button onClick={() => void loadCalendarStatus()} className="ml-auto flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 font-bold text-slate-600 hover:bg-slate-50">
            <RefreshCw className="h-3.5 w-3.5" /> Atualizar status
          </button>
        </div>
        <p className="mt-2 text-slate-500">A conta Google não concede acesso ao RL Connect. A conexão serve somente para Calendar/Meet e deve ser feita em Configurações → Integrações após o login normal.</p>
        {calendarError && <p className="mt-2 font-semibold text-rose-600">{calendarError}</p>}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {entrevistas.map((ent) => (
          <div key={ent.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <span className="rounded-md bg-indigo-50 px-2 py-0.5 text-[10px] font-bold text-indigo-700 uppercase">{ent.formato}</span>
                <h3 className="mt-2 font-bold text-slate-900 text-sm">{ent.titulo}</h3>
              </div>
              <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase ${ent.status === 'cancelada' ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'}`}>{ent.status}</span>
            </div>

            <div className="space-y-1 text-xs text-slate-600 border-t border-slate-100 pt-2">
              <div className="flex items-center gap-1.5 font-semibold text-slate-800"><Clock className="h-3.5 w-3.5 text-indigo-600" /><span>{new Date(ent.data_hora).toLocaleString('pt-BR')}</span></div>
              <p className="text-slate-500">{ent.duracao_minutos} minutos</p>
              <p className={`font-semibold ${ent.integration_status === 'error' ? 'text-rose-600' : ent.integration_status === 'synced' ? 'text-emerald-700' : 'text-amber-700'}`}>{statusLabel(ent)}</p>
              {ent.integration_error && <p className="text-rose-600">{ent.integration_error}</p>}
            </div>

            {ent.google_meet_url && ent.google_calendar_event_id && ent.status !== 'cancelada' && (
              <a href={ent.google_meet_url} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-1.5 rounded-xl bg-slate-900 py-2 text-xs font-bold text-white hover:bg-slate-800">
                <Video className="h-3.5 w-3.5" /> Entrar no Google Meet <ExternalLink className="h-3 w-3 text-slate-400" />
              </a>
            )}

            {ent.status !== 'cancelada' && (
              <div className="grid grid-cols-2 gap-2 pt-1">
                <button disabled={busyId === ent.id} onClick={() => openEdit(ent)} className="flex items-center justify-center gap-1 rounded-lg border border-slate-200 px-2 py-1.5 font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50"><Pencil className="h-3.5 w-3.5" /> Remarcar</button>
                <button disabled={busyId === ent.id} onClick={() => void handleCancel(ent)} className="flex items-center justify-center gap-1 rounded-lg border border-rose-200 px-2 py-1.5 font-bold text-rose-700 hover:bg-rose-50 disabled:opacity-50">{busyId === ent.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />} Cancelar</button>
              </div>
            )}
          </div>
        ))}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 text-xs max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-900 text-base">{editing ? 'Remarcar Entrevista' : 'Agendar Entrevista'}</h3>
              <button onClick={() => setShowModal(false)} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"><X className="h-5 w-5" /></button>
            </div>

            <form onSubmit={handleSave} className="mt-4 space-y-4">
              <div><label className="font-bold text-slate-700">Título *</label><input type="text" required value={titulo} onChange={(e) => setTitulo(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 focus:border-indigo-500 focus:outline-none" /></div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div><label className="font-bold text-slate-700">Vaga *</label><select required value={vagaId} onChange={(e) => setVagaId(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 p-2.5">{vagas.map((vaga) => <option key={vaga.id} value={vaga.id}>{vaga.titulo}</option>)}</select></div>
                <div><label className="font-bold text-slate-700">Candidato *</label><select required value={candidatoId} onChange={(e) => setCandidatoId(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 p-2.5">{candidatos.map((cand) => <option key={cand.id} value={cand.id}>{cand.nome}</option>)}</select></div>
              </div>
              <div><label className="font-bold text-slate-700">Entrevistador *</label><select required value={entrevistadorId} onChange={(e) => setEntrevistadorId(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 p-2.5">{usuarios.filter((u) => u.role !== 'candidato').map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}</select></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="font-bold text-slate-700">Data e Hora *</label><input type="datetime-local" required value={dataHora} onChange={(e) => setDataHora(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 p-2.5" /></div>
                <div><label className="font-bold text-slate-700">Duração (min) *</label><input type="number" min={15} step={15} required value={duracao} onChange={(e) => setDuracao(Number(e.target.value))} className="mt-1 w-full rounded-xl border border-slate-200 p-2.5" /></div>
              </div>
              <div><label className="font-bold text-slate-700">Formato</label><select value={formato} onChange={(e) => setFormato(e.target.value as typeof formato)} className="mt-1 w-full rounded-xl border border-slate-200 p-2.5"><option value="Online - Google Meet">Online - Google Meet</option><option value="Presencial">Presencial</option><option value="Telefone">Telefone</option></select></div>
              <div><label className="font-bold text-slate-700">Observações</label><textarea value={anotacoes} onChange={(e) => setAnotacoes(e.target.value)} rows={3} className="mt-1 w-full rounded-xl border border-slate-200 p-2.5" /></div>

              {formato === 'Online - Google Meet' && (
                <div className={`rounded-xl border p-3 ${calendarStatus?.connected ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>
                  {calendarStatus?.connected ? 'O evento será criado/atualizado no Google Calendar e o mesmo Google Meet será mantido ao remarcar.' : 'Conecte o Google Calendar em Configurações → Integrações antes de confirmar.'}
                </div>
              )}
              {formError && <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 font-semibold text-rose-700">{formError}</div>}

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button type="button" onClick={() => setShowModal(false)} className="rounded-xl border border-slate-200 px-4 py-2 font-bold text-slate-600 hover:bg-slate-50">Cancelar</button>
                <button type="submit" disabled={Boolean(busyId)} className="flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2 font-bold text-white hover:bg-indigo-700 shadow-md disabled:opacity-60">{busyId && <Loader2 className="h-3.5 w-3.5 animate-spin" />}{editing ? 'Salvar Remarcação' : 'Confirmar Agendamento'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
