import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Calendar as CalendarIcon,
  Clock,
  ExternalLink,
  Plus,
  Share2,
  Video,
  X,
} from 'lucide-react';
import { dataService } from '../../services/dataService';
import { interviewService } from '../../services/interviewService';
import type { Entrevista } from '../../types';

function nextHourLocalInputValue() {
  const date = new Date(Date.now() + 60 * 60 * 1000);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  local.setMinutes(0, 0, 0);
  return local.toISOString().slice(0, 16);
}

export const AgendaView: React.FC = () => {
  const vagas = dataService.getVagas();
  const [entrevistas, setEntrevistas] = useState<Entrevista[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [vagaId, setVagaId] = useState(vagas[0]?.id || '');
  const [candidatoId, setCandidatoId] = useState('');
  const [titulo, setTitulo] = useState('Entrevista Técnica');
  const [dataHora, setDataHora] = useState(nextHourLocalInputValue);
  const [formato, setFormato] = useState<'Online - Google Meet' | 'Online - Teams' | 'Presencial' | 'Telefone'>('Online - Google Meet');
  const [saving, setSaving] = useState(false);

  const candidaturasDaVaga = useMemo(
    () => (vagaId ? dataService.getCandidaturasByVaga(vagaId) : []),
    [vagaId]
  );

  useEffect(() => {
    const firstCandidateId = candidaturasDaVaga[0]?.candidato_id || '';
    if (!candidaturasDaVaga.some((item) => item.candidato_id === candidatoId)) {
      setCandidatoId(firstCandidateId);
    }
  }, [candidaturasDaVaga, candidatoId]);

  const refreshData = async () => {
    setLoading(true);
    setError('');
    try {
      setEntrevistas(await interviewService.list());
    } catch (err) {
      setEntrevistas([]);
      setError(err instanceof Error ? err.message : 'Não foi possível carregar a agenda.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refreshData();
  }, []);

  const handleCreateEntrevista = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');

    const candidatura = candidaturasDaVaga.find((item) => item.candidato_id === candidatoId);
    if (!vagaId || !candidatoId || !candidatura) {
      setError('Selecione uma vaga e um candidato que possua candidatura vinculada antes de agendar.');
      return;
    }

    const startAt = new Date(dataHora);
    if (Number.isNaN(startAt.getTime()) || startAt.getTime() <= Date.now()) {
      setError('A entrevista precisa ser agendada para uma data e hora futuras.');
      return;
    }

    setSaving(true);
    try {
      await interviewService.create({
        candidatura_id: candidatura.id,
        vaga_id: vagaId,
        candidato_id: candidatoId,
        titulo: titulo.trim() || 'Entrevista',
        data_hora: startAt.toISOString(),
        duracao_minutos: 45,
        formato,
        link_reuniao: undefined,
        entrevistador_id: '',
        status: 'agendada',
      });
      setShowModal(false);
      setDataHora(nextHourLocalInputValue());
      await refreshData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível agendar a entrevista.');
    } finally {
      setSaving(false);
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
              Entrevistas persistidas no Firestore. Calendar/Meet só será marcado como sincronizado após integração real.
            </p>
          </div>
        </div>

        <button
          onClick={() => {
            setError('');
            setDataHora(nextHourLocalInputValue());
            setShowModal(true);
          }}
          className="flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-xs font-bold text-slate-900 hover:bg-slate-100 shadow-md"
        >
          <Plus className="h-4 w-4" />
          Agendar Nova Entrevista
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm text-xs">
        <div className="flex items-center gap-2 font-bold text-slate-700">
          <Share2 className="h-4 w-4 text-indigo-600" />
          <span>Status de Integrações:</span>
        </div>
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-1 font-bold text-amber-800">
          Google Calendar / Meet: migração pendente
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1 font-bold text-slate-600">
          Microsoft Outlook: não integrado
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs font-semibold text-rose-800">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
          Carregando entrevistas do Firestore...
        </div>
      ) : entrevistas.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
          Nenhuma entrevista agendada para esta empresa.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {entrevistas.map((ent) => (
            <div key={ent.id} className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between">
                <div>
                  <span className="rounded-md bg-indigo-50 px-2 py-0.5 text-[10px] font-bold uppercase text-indigo-700">
                    {ent.formato}
                  </span>
                  <h3 className="mt-2 text-sm font-bold text-slate-900">{ent.titulo}</h3>
                </div>
                <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-bold uppercase text-emerald-800">
                  {ent.status}
                </span>
              </div>

              <div className="space-y-1 border-t border-slate-100 pt-2 text-xs text-slate-600">
                <div className="flex items-center gap-1.5 font-semibold text-slate-800">
                  <Clock className="h-3.5 w-3.5 text-indigo-600" />
                  <span>{new Date(ent.data_hora).toLocaleString('pt-BR')}</span>
                </div>
                <p className="text-slate-500">{ent.duracao_minutos} minutos de duração</p>
                <p className={ent.sincronizado_gcal ? 'font-bold text-emerald-700' : 'font-bold text-amber-700'}>
                  {ent.sincronizado_gcal ? 'Google Calendar sincronizado' : 'Aguardando integração com Calendar/Meet'}
                </p>
              </div>

              {ent.link_reuniao && (
                <a
                  href={ent.link_reuniao}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-center gap-1.5 rounded-xl bg-slate-900 py-2 text-xs font-bold text-white hover:bg-slate-800"
                >
                  <Video className="h-3.5 w-3.5" />
                  Abrir Sala de Reunião
                  <ExternalLink className="h-3 w-3 text-slate-400" />
                </a>
              )}
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 text-xs shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900">Agendar Entrevista</h3>
              <button onClick={() => setShowModal(false)} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateEntrevista} className="mt-4 space-y-4">
              <div>
                <label className="font-bold text-slate-700">Vaga *</label>
                <select
                  required
                  value={vagaId}
                  onChange={(e) => setVagaId(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 text-xs focus:border-indigo-500 focus:outline-none"
                >
                  <option value="">Selecione</option>
                  {vagas.map((vaga) => <option key={vaga.id} value={vaga.id}>{vaga.titulo}</option>)}
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-700">Candidato da vaga *</label>
                <select
                  required
                  value={candidatoId}
                  onChange={(e) => setCandidatoId(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 text-xs focus:border-indigo-500 focus:outline-none"
                >
                  <option value="">Selecione</option>
                  {candidaturasDaVaga.map((item) => (
                    <option key={item.id} value={item.candidato_id}>{item.candidato.nome}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-700">Título da Reunião *</label>
                <input
                  type="text"
                  required
                  value={titulo}
                  onChange={(e) => setTitulo(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 text-xs focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700">Data e Hora *</label>
                <input
                  type="datetime-local"
                  required
                  min={nextHourLocalInputValue()}
                  value={dataHora}
                  onChange={(e) => setDataHora(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 text-xs focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700">Formato</label>
                <select
                  value={formato}
                  onChange={(e) => setFormato(e.target.value as typeof formato)}
                  className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 text-xs focus:border-indigo-500 focus:outline-none"
                >
                  <option value="Online - Google Meet">Online - Google Meet</option>
                  <option value="Online - Teams">Online - Microsoft Teams</option>
                  <option value="Presencial">Presencial</option>
                  <option value="Telefone">Telefone</option>
                </select>
              </div>

              <p className="rounded-xl bg-amber-50 p-3 text-[11px] font-semibold text-amber-800">
                O agendamento será salvo agora. O link de reunião só será criado quando a integração Calendar/Meet real estiver ativa.
              </p>

              <div className="mt-6 flex justify-end gap-3 border-t border-slate-100 pt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2 font-bold text-slate-600 hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-xl bg-indigo-600 px-5 py-2 font-bold text-white shadow-md hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {saving ? 'Salvando...' : 'Confirmar Agendamento'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
