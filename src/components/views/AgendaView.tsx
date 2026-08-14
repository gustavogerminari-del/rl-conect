import React, { useEffect, useMemo, useState } from 'react';
import { Calendar as CalendarIcon, CheckCircle2, Clock, ExternalLink, Link2Off, Plus, RefreshCw, Share2, Video, X } from 'lucide-react';
import { dataService } from '../../services/dataService';
import { GoogleWorkspaceService, type GoogleWorkspaceStatus } from '../../services/GoogleWorkspaceService';
import type { Entrevista } from '../../types';

export const AgendaView: React.FC = () => {
  const [entrevistas, setEntrevistas] = useState(dataService.getEntrevistas());
  const [showModal, setShowModal] = useState(false);
  const [vagaId, setVagaId] = useState(dataService.getVagas()[0]?.id || '');
  const [candidatoId, setCandidatoId] = useState(dataService.getCandidatos()[0]?.id || '');
  const [titulo, setTitulo] = useState('Entrevista Técnica');
  const [dataHora, setDataHora] = useState('');
  const [formato, setFormato] = useState<Entrevista['formato']>('Online - Google Meet');
  const [googleStatus, setGoogleStatus] = useState<GoogleWorkspaceStatus | null>(null);
  const [statusError, setStatusError] = useState('');
  const [saving, setSaving] = useState(false);

  const empresa = dataService.getActiveEmpresa();
  const user = dataService.getCurrentUser();
  const vagas = dataService.getVagas();
  const candidatos = dataService.getCandidatos();
  const candidaturas = dataService.getCandidaturas();

  const connected = googleStatus?.status === 'connected';
  const canConnect = user?.role === 'master_admin' || user?.role === 'empresa_admin';

  const refreshGoogle = async () => {
    if (!empresa?.id) return;
    setStatusError('');
    try {
      const result = await GoogleWorkspaceService.getStatus(empresa.id);
      setGoogleStatus(result.integration);
    } catch (error) {
      setGoogleStatus(null);
      setStatusError(error instanceof Error ? error.message : 'Não foi possível consultar o Google Calendar.');
    }
  };

  useEffect(() => dataService.subscribe(() => setEntrevistas(dataService.getEntrevistas())), []);
  useEffect(() => { void refreshGoogle(); }, [empresa?.id]);

  const selectedApplication = useMemo(
    () => candidaturas.find(c => c.vaga_id === vagaId && c.candidato_id === candidatoId),
    [candidaturas, vagaId, candidatoId],
  );

  const handleCreateEntrevista = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusError('');
    if (!empresa?.id || !selectedApplication) {
      setStatusError('O candidato precisa possuir candidatura nesta vaga antes do agendamento.');
      return;
    }
    const startDate = new Date(dataHora);
    if (!Number.isFinite(startDate.getTime())) { setStatusError('Informe uma data e hora válidas.'); return; }
    setSaving(true);
    try {
      const interview = dataService.createEntrevista({
        candidatura_id: selectedApplication.id,
        vaga_id: vagaId,
        candidato_id: candidatoId,
        titulo,
        data_hora: startDate.toISOString(),
        duracao_minutos: 45,
        formato,
        entrevistador_id: user.id,
        status: 'agendada',
        sincronizado_gcal: false,
      });

      if (formato === 'Online - Google Meet') {
        if (!connected) {
          setStatusError('Entrevista salva no Firebase sem Meet. Conecte o Google Calendar para gerar a sala real.');
        } else {
          const candidate = candidatos.find(c => c.id === candidatoId);
          const end = new Date(startDate.getTime() + 45 * 60_000);
          const result = await GoogleWorkspaceService.createInterview(empresa.id, {
            interviewId: interview.id,
            title: titulo,
            start: startDate.toISOString(),
            end: end.toISOString(),
            timezone: 'America/Sao_Paulo',
            attendees: [candidate?.email, user.email].filter(Boolean) as string[],
            description: `RL Connect - candidatura ${selectedApplication.id}`,
          });
          dataService.updateEntrevista(interview.id, {
            link_reuniao: result.meetUrl || undefined,
            sincronizado_gcal: Boolean(result.eventId && result.meetUrl),
          });
          if (!result.meetUrl) setStatusError('Evento criado no Google Calendar, mas o Google não devolveu um link de Meet.');
        }
      }
      setShowModal(false);
      setEntrevistas(dataService.getEntrevistas());
    } catch (error) {
      setStatusError(error instanceof Error ? error.message : 'Falha ao agendar entrevista.');
    } finally { setSaving(false); }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-6 text-white shadow-xl sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4"><div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-600"><CalendarIcon className="h-6 w-6" /></div><div><h1 className="text-xl font-extrabold">Agenda Integrada de Entrevistas</h1><p className="mt-0.5 text-xs text-indigo-200">Firebase + Google Calendar/Meet. Nenhum link de reunião é inventado.</p></div></div>
        <button onClick={() => setShowModal(true)} className="flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-xs font-bold text-slate-900"><Plus className="h-4 w-4" />Agendar Nova Entrevista</button>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm text-xs">
        <div className="flex flex-wrap items-center gap-3"><div className="flex items-center gap-2 font-bold text-slate-700"><Share2 className="h-4 w-4 text-indigo-600" />Google Workspace:</div>
          {connected ? <div className="flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-1 font-bold text-emerald-800 border border-emerald-200"><CheckCircle2 className="h-3.5 w-3.5" />Conectado {googleStatus?.connectedEmail ? `(${googleStatus.connectedEmail})` : ''}</div> : <div className="flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-1 font-bold text-amber-800 border border-amber-200"><Link2Off className="h-3.5 w-3.5" />Não conectado</div>}
          <button onClick={() => void refreshGoogle()} className="rounded-lg border px-2.5 py-1 font-bold text-slate-600"><RefreshCw className="inline h-3 w-3 mr-1" />Atualizar</button>
          {!connected && canConnect && empresa?.id && <button onClick={() => void GoogleWorkspaceService.connect(empresa.id)} className="rounded-lg bg-[#123657] px-3 py-1.5 font-bold text-white">Conectar Google Calendar</button>}
        </div>
        {statusError && <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-2.5 font-semibold text-amber-800">{statusError}</div>}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {entrevistas.map(ent => <div key={ent.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-3"><div className="flex items-start justify-between"><div><span className="rounded-md bg-indigo-50 px-2 py-0.5 text-[10px] font-bold text-indigo-700 uppercase">{ent.formato}</span><h3 className="mt-2 font-bold text-slate-900 text-sm">{ent.titulo}</h3></div><span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-bold text-slate-700 uppercase">{ent.status}</span></div><div className="space-y-1 text-xs text-slate-600 border-t pt-2"><div className="flex items-center gap-1.5 font-semibold text-slate-800"><Clock className="h-3.5 w-3.5 text-indigo-600" />{new Date(ent.data_hora).toLocaleString('pt-BR')}</div><p>{ent.duracao_minutos} minutos</p><p className={ent.sincronizado_gcal ? 'text-emerald-700 font-bold' : 'text-amber-700 font-bold'}>{ent.sincronizado_gcal ? 'Google Calendar sincronizado' : 'Sem sincronização Google'}</p></div>{ent.link_reuniao && <a href={ent.link_reuniao} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-1.5 rounded-xl bg-slate-900 py-2 text-xs font-bold text-white"><Video className="h-3.5 w-3.5" />Abrir Google Meet<ExternalLink className="h-3 w-3" /></a>}</div>)}
      </div>

      {showModal && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm"><div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl text-xs"><div className="flex items-center justify-between border-b pb-3"><h3 className="font-bold text-slate-900 text-base">Agendar Entrevista</h3><button onClick={() => setShowModal(false)}><X className="h-5 w-5" /></button></div><form onSubmit={handleCreateEntrevista} className="mt-4 space-y-4"><div><label className="font-bold">Vaga</label><select required value={vagaId} onChange={e => setVagaId(e.target.value)} className="mt-1 w-full rounded-xl border p-2.5">{vagas.map(v => <option key={v.id} value={v.id}>{v.titulo}</option>)}</select></div><div><label className="font-bold">Candidato</label><select required value={candidatoId} onChange={e => setCandidatoId(e.target.value)} className="mt-1 w-full rounded-xl border p-2.5">{candidatos.filter(c => candidaturas.some(a => a.candidato_id === c.id && a.vaga_id === vagaId)).map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}</select></div><div><label className="font-bold">Título *</label><input required value={titulo} onChange={e => setTitulo(e.target.value)} className="mt-1 w-full rounded-xl border p-2.5" /></div><div><label className="font-bold">Data e Hora *</label><input type="datetime-local" required value={dataHora} onChange={e => setDataHora(e.target.value)} className="mt-1 w-full rounded-xl border p-2.5" /></div><div><label className="font-bold">Formato</label><select value={formato} onChange={e => setFormato(e.target.value as Entrevista['formato'])} className="mt-1 w-full rounded-xl border p-2.5"><option>Online - Google Meet</option><option>Online - Teams</option><option>Presencial</option><option>Telefone</option></select></div><div className="flex justify-end gap-3 pt-4 border-t"><button type="button" onClick={() => setShowModal(false)} className="rounded-xl border px-4 py-2 font-bold">Cancelar</button><button disabled={saving} type="submit" className="rounded-xl bg-indigo-600 px-5 py-2 font-bold text-white disabled:opacity-60">{saving ? 'Salvando...' : 'Confirmar Agendamento'}</button></div></form></div></div>}
    </div>
  );
};
