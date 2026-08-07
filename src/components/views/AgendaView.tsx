import React, { useState } from 'react';
import {
  Calendar as CalendarIcon,
  Plus,
  Clock,
  Video,
  UserCheck,
  CheckCircle2,
  ExternalLink,
  X,
  Share2,
} from 'lucide-react';
import { dataService } from '../../services/dataService';
import { Entrevista } from '../../types';

export const AgendaView: React.FC = () => {
  const [entrevistas, setEntrevistas] = useState(dataService.getEntrevistas());
  const vagas = dataService.getVagas();
  const candidatos = dataService.getCandidatos();

  const [showModal, setShowModal] = useState(false);
  const [vagaId, setVagaId] = useState(vagas[0]?.id || '');
  const [candidatoId, setCandidatoId] = useState(candidatos[0]?.id || '');
  const [titulo, setTitulo] = useState('Entrevista Técnica');
  const [dataHora, setDataHora] = useState('2026-08-08T14:00');
  const [formato, setFormato] = useState<'Online - Google Meet' | 'Online - Teams' | 'Presencial' | 'Telefone'>('Online - Google Meet');

  const refreshData = () => {
    setEntrevistas(dataService.getEntrevistas());
  };

  const handleCreateEntrevista = (e: React.FormEvent) => {
    e.preventDefault();
    dataService.createEntrevista({
      candidatura_id: 'cand_app_1',
      vaga_id: vagaId,
      candidato_id: candidatoId,
      titulo,
      data_hora: new Date(dataHora).toISOString(),
      duracao_minutos: 45,
      formato,
      link_reuniao: 'https://meet.google.com/abc-defg-hij',
      entrevistador_id: 'usr_admin_1',
      status: 'agendada',
      sincronizado_gcal: true,
    });

    setShowModal(false);
    refreshData();
  };

  return (
    <div className="space-y-6">
      {/* Banner */}
      <div className="flex flex-col gap-4 rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-6 text-white shadow-xl sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-lg">
            <CalendarIcon className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold tracking-tight">Agenda Integrada de Entrevistas</h1>
            <p className="mt-0.5 text-xs text-indigo-200">
              Sincronização com Google Calendar & Microsoft Outlook preparada para envio de lembretes.
            </p>
          </div>
        </div>

        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-xs font-bold text-slate-900 hover:bg-slate-100 shadow-md"
        >
          <Plus className="h-4 w-4" />
          Agendar Nova Entrevista
        </button>
      </div>

      {/* Sync Badges */}
      <div className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm text-xs">
        <div className="flex items-center gap-2 font-bold text-slate-700">
          <Share2 className="h-4 w-4 text-indigo-600" />
          <span>Status de Integrações:</span>
        </div>

        <div className="flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-1 font-bold text-emerald-800 border border-emerald-200">
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
          Google Calendar API (Ativo)
        </div>

        <div className="flex items-center gap-2 rounded-lg bg-blue-50 px-3 py-1 font-bold text-blue-800 border border-blue-200">
          <CheckCircle2 className="h-3.5 w-3.5 text-blue-600" />
          Microsoft Outlook (Pronto)
        </div>
      </div>

      {/* List of Interviews */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {entrevistas.map((ent) => (
          <div key={ent.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-3">
            <div className="flex items-start justify-between">
              <div>
                <span className="rounded-md bg-indigo-50 px-2 py-0.5 text-[10px] font-bold text-indigo-700 uppercase">
                  {ent.formato}
                </span>
                <h3 className="mt-2 font-bold text-slate-900 text-sm">{ent.titulo}</h3>
              </div>
              <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-bold text-emerald-800 uppercase">
                {ent.status}
              </span>
            </div>

            <div className="space-y-1 text-xs text-slate-600 border-t border-slate-100 pt-2">
              <div className="flex items-center gap-1.5 font-semibold text-slate-800">
                <Clock className="h-3.5 w-3.5 text-indigo-600" />
                <span>{new Date(ent.data_hora).toLocaleString('pt-BR')}</span>
              </div>
              <p className="text-slate-500">{ent.duracao_minutos} minutos de duração</p>
            </div>

            {ent.link_reuniao && (
              <div className="pt-2">
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
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 text-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-900 text-base">Agendar Entrevista</h3>
              <button onClick={() => setShowModal(false)} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateEntrevista} className="mt-4 space-y-4">
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
                  value={dataHora}
                  onChange={(e) => setDataHora(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 text-xs focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700">Formato</label>
                <select
                  value={formato}
                  onChange={(e: any) => setFormato(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 text-xs focus:border-indigo-500 focus:outline-none"
                >
                  <option value="Online - Google Meet">Online - Google Meet</option>
                  <option value="Online - Teams">Online - Microsoft Teams</option>
                  <option value="Presencial">Presencial na Sede</option>
                </select>
              </div>

              <div className="mt-6 flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2 font-bold text-slate-600 hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-indigo-600 px-5 py-2 font-bold text-white hover:bg-indigo-700 shadow-md"
                >
                  Confirmar Agendamento
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
