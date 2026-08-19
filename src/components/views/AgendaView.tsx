import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  Calendar as CalendarIcon,
  CheckCircle2,
  ExternalLink,
  Link2,
  Loader2,
  Plus,
  Share2,
  Unplug,
  Video,
  X,
} from 'lucide-react';
import { dataService } from '../../services/dataService';
import { googleWorkspaceService, type GoogleWorkspaceStatus } from '../../services/googleWorkspaceService';

const PENDING_MEET_KEY = 'rl_connect_pending_google_meet_interview';

type InterviewFormat = 'Online - Google Meet' | 'Online - Teams' | 'Presencial' | 'Telefone';
type InterviewDraft = {
  vagaId: string;
  candidatoId: string;
  candidaturaId: string;
  titulo: string;
  dataHora: string;
  duracaoMinutos: number;
  formato: InterviewFormat;
};

function nextInterviewDateTime() {
  const date = new Date(Date.now() + 60 * 60 * 1000);
  const roundedMinutes = Math.ceil(date.getMinutes() / 15) * 15;
  date.setMinutes(roundedMinutes, 0, 0);
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export const AgendaView: React.FC = () => {
  const [entrevistas, setEntrevistas] = useState(dataService.getEntrevistas());
  const vagas = dataService.getVagas();
  const candidatos = dataService.getCandidatos();
  const candidaturas = dataService.getCandidaturas();
  const companyId = dataService.getActiveEmpresa().id;

  const [showModal, setShowModal] = useState(false);
  const [vagaId, setVagaId] = useState(vagas[0]?.id || '');
  const [candidatoId, setCandidatoId] = useState('');
  const [titulo, setTitulo] = useState('Entrevista Técnica');
  const [dataHora, setDataHora] = useState(nextInterviewDateTime);
  const [formato, setFormato] = useState<InterviewFormat>('Online - Google Meet');
  const [duracaoMinutos, setDuracaoMinutos] = useState(45);
  const [workspaceStatus, setWorkspaceStatus] = useState<GoogleWorkspaceStatus>({ connected: false });
  const [loadingWorkspace, setLoadingWorkspace] = useState(true);
  const [connectingWorkspace, setConnectingWorkspace] = useState(false);
  const [scheduling, setScheduling] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const resumedRef = useRef(false);

  const candidateOptions = useMemo(() => {
    const ids = new Set(candidaturas.filter((item) => item.vaga_id === vagaId).map((item) => item.candidato_id));
    return candidatos.filter((candidate) => ids.has(candidate.id));
  }, [candidaturas, candidatos, vagaId]);

  useEffect(() => {
    if (!candidateOptions.some((candidate) => candidate.id === candidatoId)) {
      setCandidatoId(candidateOptions[0]?.id || '');
    }
  }, [candidateOptions, candidatoId]);

  const refreshData = () => setEntrevistas(dataService.getEntrevistas());

  const clearGoogleReturnParams = () => {
    const url = new URL(window.location.href);
    url.searchParams.delete('googleWorkspace');
    url.searchParams.delete('googleWorkspaceMessage');
    url.searchParams.delete('tab');
    window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}` || '/');
  };

  const loadWorkspaceStatus = async () => {
    setLoadingWorkspace(true);
    try {
      const status = await googleWorkspaceService.status(companyId);
      setWorkspaceStatus(status);
      return status;
    } catch (statusError: any) {
      setWorkspaceStatus({ connected: false });
      setError(String(statusError?.message || 'Não foi possível verificar o Google Workspace.'));
      return { connected: false } as GoogleWorkspaceStatus;
    } finally {
      setLoadingWorkspace(false);
    }
  };

  const createInterviewFromDraft = async (draft: InterviewDraft) => {
    const vaga = dataService.getVagas().find((item) => item.id === draft.vagaId);
    const candidato = dataService.getCandidatos().find((item) => item.id === draft.candidatoId);
    const candidatura = dataService.getCandidaturas().find((item) => item.id === draft.candidaturaId);
    if (!vaga || !candidato || !candidatura) {
      throw new Error('A vaga, o candidato ou a candidatura não foram encontrados. Atualize a Agenda e tente novamente.');
    }

    let linkReuniao: string | undefined;
    let sincronizadoGcal = false;
    let anotacoes = '';

    if (draft.formato === 'Online - Google Meet') {
      const meet = await googleWorkspaceService.createMeetEvent({
        companyId,
        title: draft.titulo,
        startDateTime: new Date(draft.dataHora).toISOString(),
        durationMinutes: draft.duracaoMinutos,
        attendeeEmails: candidato.email ? [candidato.email] : [],
        timeZone: 'America/Sao_Paulo',
        description: `Entrevista RL Connect - ${vaga.titulo} - candidato ${candidato.nome}.`,
        vagaId: vaga.id,
        candidatoId: candidato.id,
        candidaturaId: candidatura.id,
      });
      linkReuniao = meet.meetLink;
      sincronizadoGcal = true;
      anotacoes = `Google Calendar: ${meet.eventId}${meet.calendarLink ? ` | ${meet.calendarLink}` : ''}`;
    }

    dataService.createEntrevista({
      candidatura_id: candidatura.id,
      vaga_id: vaga.id,
      candidato_id: candidato.id,
      titulo: draft.titulo,
      data_hora: new Date(draft.dataHora).toISOString(),
      duracao_minutos: draft.duracaoMinutos,
      formato: draft.formato,
      link_reuniao: linkReuniao,
      entrevistador_id: dataService.getCurrentUser().id,
      status: 'agendada',
      anotacoes,
      sincronizado_gcal: sincronizadoGcal,
      sincronizado_outlook: false,
    });

    sessionStorage.removeItem(PENDING_MEET_KEY);
    setSuccess(
      sincronizadoGcal
        ? `Entrevista criada no Google Calendar. Link do Meet: ${linkReuniao}`
        : 'Entrevista registrada no RL Connect.',
    );
    setShowModal(false);
    refreshData();
  };

  useEffect(() => {
    void (async () => {
      const params = new URLSearchParams(window.location.search);
      const googleReturn = params.get('googleWorkspace');
      const googleError = params.get('googleWorkspaceMessage');
      if (googleReturn === 'error') {
        setError(googleError || 'O Google não concluiu a autorização.');
        clearGoogleReturnParams();
      }

      const status = await loadWorkspaceStatus();
      if (googleReturn === 'connected' && status.connected && !resumedRef.current) {
        resumedRef.current = true;
        clearGoogleReturnParams();
        const rawDraft = sessionStorage.getItem(PENDING_MEET_KEY);
        if (rawDraft) {
          try {
            setScheduling(true);
            await createInterviewFromDraft(JSON.parse(rawDraft) as InterviewDraft);
          } catch (resumeError: any) {
            setError(String(resumeError?.message || 'Google foi conectado, mas não foi possível concluir a entrevista.'));
          } finally {
            setScheduling(false);
          }
        } else {
          setSuccess('Google Workspace conectado. Agora você pode criar reuniões reais do Google Meet.');
        }
      }
    })();
    // Executa somente ao abrir a Agenda/retornar do OAuth.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId]);

  const handleConnectGoogle = async () => {
    setError('');
    setConnectingWorkspace(true);
    try {
      await googleWorkspaceService.connect(companyId, '/?tab=agenda');
    } catch (connectError: any) {
      setConnectingWorkspace(false);
      setError(String(connectError?.message || 'Não foi possível iniciar a conexão com o Google.'));
    }
  };

  const handleDisconnectGoogle = async () => {
    setError('');
    try {
      await googleWorkspaceService.disconnect(companyId);
      setWorkspaceStatus({ connected: false });
      setSuccess('Google Workspace desconectado desta empresa.');
    } catch (disconnectError: any) {
      setError(String(disconnectError?.message || 'Não foi possível desconectar o Google Workspace.'));
    }
  };

  const buildDraft = (): InterviewDraft => {
    const candidatura = candidaturas.find((item) => item.vaga_id === vagaId && item.candidato_id === candidatoId);
    if (!vagaId) throw new Error('Selecione uma vaga.');
    if (!candidatoId) throw new Error('Selecione um candidato vinculado à vaga.');
    if (!candidatura) throw new Error('Este candidato não possui candidatura vinculada à vaga selecionada.');
    if (!dataHora || !Number.isFinite(new Date(dataHora).getTime())) throw new Error('Informe uma data e hora válidas.');
    return {
      vagaId,
      candidatoId,
      candidaturaId: candidatura.id,
      titulo: titulo.trim() || 'Entrevista',
      dataHora,
      duracaoMinutos,
      formato,
    };
  };

  const handleCreateEntrevista = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setSuccess('');
    let draft: InterviewDraft;
    try {
      draft = buildDraft();
    } catch (validationError: any) {
      setError(String(validationError?.message || 'Revise os dados da entrevista.'));
      return;
    }

    if (draft.formato === 'Online - Google Meet' && !workspaceStatus.connected) {
      sessionStorage.setItem(PENDING_MEET_KEY, JSON.stringify(draft));
      setConnectingWorkspace(true);
      try {
        await googleWorkspaceService.connect(companyId, '/?tab=agenda');
      } catch (connectError: any) {
        setConnectingWorkspace(false);
        setError(String(connectError?.message || 'Conecte o Google Workspace para criar o Meet.'));
      }
      return;
    }

    setScheduling(true);
    try {
      await createInterviewFromDraft(draft);
    } catch (scheduleError: any) {
      setError(String(scheduleError?.message || 'Não foi possível agendar a entrevista.'));
    } finally {
      setScheduling(false);
    }
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
            <p className="mt-0.5 text-xs text-indigo-200">
              Google Calendar + Google Meet reais, vinculados à vaga, candidatura e candidato.
            </p>
          </div>
        </div>

        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-xs font-bold text-slate-900 shadow-md hover:bg-slate-100"
        >
          <Plus className="h-4 w-4" />
          Agendar Nova Entrevista
        </button>
      </div>

      {(error || success) && (
        <div className={`flex items-start gap-2 rounded-xl border p-4 text-xs ${error ? 'border-red-200 bg-red-50 text-red-800' : 'border-emerald-200 bg-emerald-50 text-emerald-800'}`}>
          {error ? <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> : <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />}
          <span className="font-semibold">{error || success}</span>
        </div>
      )}

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm font-extrabold text-slate-900">
              <Share2 className="h-4 w-4 text-indigo-600" />
              Google Workspace / Meet
            </div>
            {loadingWorkspace ? (
              <p className="mt-1 text-xs text-slate-500">Verificando conexão real...</p>
            ) : workspaceStatus.connected ? (
              <p className="mt-1 text-xs font-semibold text-emerald-700">
                Conectado{workspaceStatus.connectedEmail ? ` como ${workspaceStatus.connectedEmail}` : ''}. Eventos e links do Meet serão criados pela API do Google.
              </p>
            ) : (
              <p className="mt-1 text-xs font-semibold text-amber-700">
                Não conectado. O RL Connect não criará link fictício: conecte sua conta Google para usar o Meet.
              </p>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleConnectGoogle}
              disabled={connectingWorkspace || loadingWorkspace}
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-indigo-700 disabled:opacity-60"
            >
              {connectingWorkspace ? <Loader2 className="h-4 w-4 animate-spin" /> : <Video className="h-4 w-4" />}
              {workspaceStatus.connected ? 'Reconectar Google' : 'Conectar Google Meet'}
            </button>
            {workspaceStatus.connected && (
              <button
                type="button"
                onClick={handleDisconnectGoogle}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50"
              >
                <Unplug className="h-4 w-4" />
                Desconectar
              </button>
            )}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2 text-[11px] font-bold">
          <span className={`rounded-lg border px-3 py-1 ${workspaceStatus.connected ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>
            Google Calendar: {workspaceStatus.connected ? 'Conectado' : 'Não conectado'}
          </span>
          <span className={`rounded-lg border px-3 py-1 ${workspaceStatus.connected ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>
            Google Meet: {workspaceStatus.connected ? 'Pronto para criar link real' : 'Aguardando conexão'}
          </span>
          <span className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1 text-slate-600">
            Microsoft Outlook: Não configurado
          </span>
        </div>
      </div>

      {scheduling && (
        <div className="flex items-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 p-4 text-xs font-bold text-indigo-800">
          <Loader2 className="h-4 w-4 animate-spin" />
          Criando evento no Google Calendar e aguardando o link do Meet...
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {entrevistas.map((ent) => (
          <div key={ent.id} className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between">
              <div>
                <span className="rounded-md bg-indigo-50 px-2 py-0.5 text-[10px] font-bold uppercase text-indigo-700">{ent.formato}</span>
                <h3 className="mt-2 text-sm font-bold text-slate-900">{ent.titulo}</h3>
              </div>
              <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-bold uppercase text-emerald-800">{ent.status}</span>
            </div>

            <div className="border-t border-slate-100 pt-2 text-xs text-slate-600">
              <div className="font-semibold text-slate-800">{new Date(ent.data_hora).toLocaleString('pt-BR')}</div>
              <p className="text-slate-500">{ent.duracao_minutos} minutos de duração</p>
              {ent.sincronizado_gcal && <p className="mt-1 font-bold text-emerald-700">Sincronizado com Google Calendar</p>}
            </div>

            {ent.link_reuniao && (
              <a
                href={ent.link_reuniao}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-center gap-1.5 rounded-xl bg-slate-900 py-2 text-xs font-bold text-white hover:bg-slate-800"
              >
                <Video className="h-3.5 w-3.5" />
                Abrir Google Meet
                <ExternalLink className="h-3 w-3 text-slate-400" />
              </a>
            )}
          </div>
        ))}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 text-xs shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900">Agendar Entrevista</h3>
              <button onClick={() => setShowModal(false)} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"><X className="h-5 w-5" /></button>
            </div>

            <form onSubmit={handleCreateEntrevista} className="mt-4 space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="font-bold text-slate-700">Vaga *</label>
                  <select value={vagaId} onChange={(e) => setVagaId(e.target.value)} required className="mt-1 w-full rounded-xl border border-slate-200 p-2.5">
                    <option value="">Selecione</option>
                    {vagas.map((vaga) => <option key={vaga.id} value={vaga.id}>{vaga.titulo}</option>)}
                  </select>
                </div>
                <div>
                  <label className="font-bold text-slate-700">Candidato da vaga *</label>
                  <select value={candidatoId} onChange={(e) => setCandidatoId(e.target.value)} required className="mt-1 w-full rounded-xl border border-slate-200 p-2.5">
                    <option value="">Selecione</option>
                    {candidateOptions.map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.nome}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700">Título da reunião *</label>
                <input type="text" required value={titulo} onChange={(e) => setTitulo(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 p-2.5" />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="font-bold text-slate-700">Data e hora *</label>
                  <input type="datetime-local" required value={dataHora} onChange={(e) => setDataHora(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 p-2.5" />
                </div>
                <div>
                  <label className="font-bold text-slate-700">Duração</label>
                  <select value={duracaoMinutos} onChange={(e) => setDuracaoMinutos(Number(e.target.value))} className="mt-1 w-full rounded-xl border border-slate-200 p-2.5">
                    <option value={30}>30 minutos</option>
                    <option value={45}>45 minutos</option>
                    <option value={60}>60 minutos</option>
                    <option value={90}>90 minutos</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700">Formato</label>
                <select value={formato} onChange={(e) => setFormato(e.target.value as InterviewFormat)} className="mt-1 w-full rounded-xl border border-slate-200 p-2.5">
                  <option value="Online - Google Meet">Online - Google Meet</option>
                  <option value="Online - Teams">Online - Microsoft Teams</option>
                  <option value="Presencial">Presencial</option>
                  <option value="Telefone">Telefone</option>
                </select>
              </div>

              {formato === 'Online - Google Meet' && (
                <div className={`rounded-xl border p-3 ${workspaceStatus.connected ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'}`}>
                  <div className="flex items-start gap-2">
                    <Link2 className={`mt-0.5 h-4 w-4 ${workspaceStatus.connected ? 'text-emerald-600' : 'text-amber-600'}`} />
                    <div>
                      <p className={`font-bold ${workspaceStatus.connected ? 'text-emerald-800' : 'text-amber-800'}`}>
                        {workspaceStatus.connected ? 'Google Meet conectado' : 'Será necessário conectar o Google Workspace'}
                      </p>
                      <p className="mt-0.5 text-[11px] text-slate-600">
                        Ao confirmar, o RL Connect cria o evento no Calendar, gera um Meet único, envia o convite ao candidato e salva o link na entrevista.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div className="mt-6 flex justify-end gap-3 border-t border-slate-100 pt-4">
                <button type="button" onClick={() => setShowModal(false)} className="rounded-xl border border-slate-200 px-4 py-2 font-bold text-slate-600 hover:bg-slate-50">Cancelar</button>
                <button type="submit" disabled={scheduling || connectingWorkspace} className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2 font-bold text-white shadow-md hover:bg-indigo-700 disabled:opacity-60">
                  {(scheduling || connectingWorkspace) && <Loader2 className="h-4 w-4 animate-spin" />}
                  {formato === 'Online - Google Meet' && !workspaceStatus.connected ? 'Conectar e Agendar' : 'Confirmar Agendamento'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
