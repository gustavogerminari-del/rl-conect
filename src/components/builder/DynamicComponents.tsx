import React, { useState } from 'react';
import {
  Table,
  Plus,
  CheckCircle2,
  Calendar as CalendarIcon,
  Bell,
  Send,
  BarChart3,
  Users,
  Settings,
  Layers,
  FileText,
  AlertCircle,
  Clock,
  Sparkles,
  Shield,
  Trash2,
  Edit2,
  Save,
  Check,
  ChevronRight,
  Zap,
} from 'lucide-react';
import {
  BuilderModule,
  BuilderPage,
  BuilderField,
  BuilderAutomation,
} from '../../types';

interface DynamicComponentProps {
  module: BuilderModule;
  activePageSlug?: string;
  onPageChange?: (pageSlug: string) => void;
}

export const DynamicPage: React.FC<DynamicComponentProps> = ({
  module,
  activePageSlug,
  onPageChange,
}) => {
  const currentPage =
    module.paginas.find((p) => p.slug === activePageSlug) || module.paginas[0];

  if (!currentPage) {
    return (
      <div className="p-8 text-center text-slate-500 bg-white rounded-2xl border border-slate-200">
        Nenhuma página definida para este módulo dinâmico.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Sub-Navigation Tabs */}
      {module.paginas.length > 1 && (
        <div className="flex border-b border-slate-200 bg-white px-4 rounded-xl border">
          {module.paginas.map((p) => (
            <button
              key={p.id}
              onClick={() => onPageChange?.(p.slug)}
              className={`px-4 py-3 text-xs font-bold transition border-b-2 ${
                p.slug === currentPage.slug
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              {p.nome}
            </button>
          ))}
        </div>
      )}

      {/* Render according to page type */}
      {currentPage.type === 'list' && (
        <DynamicTable page={currentPage} module={module} />
      )}
      {currentPage.type === 'form' && (
        <DynamicForm page={currentPage} module={module} />
      )}
      {currentPage.type === 'dashboard' && (
        <DynamicDashboard page={currentPage} module={module} />
      )}
      {currentPage.type === 'report' && (
        <DynamicReport page={currentPage} module={module} />
      )}
      {currentPage.type === 'workflow' && (
        <DynamicWorkflow page={currentPage} module={module} />
      )}
    </div>
  );
};

// 1. Dynamic Table
export const DynamicTable: React.FC<{ page: BuilderPage; module: BuilderModule }> = ({
  page,
}) => {
  const [mockRows, setMockRows] = useState([
    { id: 1, titulo: 'Capacitação em Liderança RH 2026', instrutor: 'Profa. Dra. Elena Vance', carga_horaria: 40, data_inicio: '2026-08-15', modalidade: 'Presencial', status: 'Ativo' },
    { id: 2, titulo: 'Segurança da Informação e LGPD', instrutor: 'Consultoria CyberSec', carga_horaria: 16, data_inicio: '2026-08-20', modalidade: 'EAD Online', status: 'Ativo' },
    { id: 3, titulo: 'Metodologias Ágeis Scrum & Kanban', instrutor: 'Agile Master Lucas', carga_horaria: 24, data_inicio: '2026-09-01', modalidade: 'Híbrido', status: 'Pendente' },
  ]);

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
      <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
        <div>
          <h3 className="font-bold text-slate-900 text-sm">{page.nome}</h3>
          <p className="text-xs text-slate-500">Tabela e listagem dinâmica de registros</p>
        </div>
        <button className="flex items-center gap-1.5 bg-blue-600 text-white text-xs font-bold px-3 py-1.5 rounded-lg hover:bg-blue-700 transition">
          <Plus className="w-4 h-4" /> Novo Registro
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs text-slate-600">
          <thead className="bg-slate-100/70 text-slate-500 uppercase tracking-wider font-bold text-[10px]">
            <tr>
              <th className="px-4 py-3">ID</th>
              {page.campos.map((col) => (
                <th key={col.id} className="px-4 py-3">
                  {col.label}
                </th>
              ))}
              <th className="px-4 py-3 text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {mockRows.map((row: any) => (
              <tr key={row.id} className="hover:bg-slate-50/80 transition">
                <td className="px-4 py-3 font-mono text-slate-400">#{row.id}</td>
                {page.campos.map((col) => (
                  <td key={col.id} className="px-4 py-3 font-medium text-slate-800">
                    {row[col.nome] !== undefined ? String(row[col.nome]) : '—'}
                  </td>
                ))}
                <td className="px-4 py-3 text-right space-x-2">
                  <button className="text-blue-600 hover:underline font-bold text-[11px]">Editar</button>
                  <button className="text-red-500 hover:underline text-[11px]">Excluir</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// 2. Dynamic Form
export const DynamicForm: React.FC<{ page: BuilderPage; module: BuilderModule }> = ({
  page,
}) => {
  const [submitted, setSubmitted] = useState(false);

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs max-w-3xl">
      <div className="border-b border-slate-100 pb-4 mb-6">
        <h3 className="font-extrabold text-slate-900 text-base">{page.nome}</h3>
        <p className="text-xs text-slate-500">Preencha os campos abaixo configurados no Construtor IA</p>
      </div>

      {submitted ? (
        <div className="p-6 bg-emerald-50 border border-emerald-200 rounded-xl text-center space-y-2">
          <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto" />
          <h4 className="font-bold text-emerald-900 text-sm">Registro Salvo com Sucesso!</h4>
          <p className="text-xs text-emerald-700">
            Os dados foram persistidos e as automações configuradas foram engatilhadas.
          </p>
          <button
            onClick={() => setSubmitted(false)}
            className="mt-2 bg-emerald-700 text-white font-bold text-xs px-4 py-2 rounded-lg hover:bg-emerald-800"
          >
            Cadastrar Outro
          </button>
        </div>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setSubmitted(true);
          }}
          className="space-y-4"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {page.campos.map((field) => (
              <div
                key={field.id}
                className={field.width === 'full' ? 'md:col-span-2' : 'col-span-1'}
              >
                <DynamicField field={field} />
              </div>
            ))}
          </div>

          <div className="pt-4 border-t border-slate-100 flex justify-end gap-3">
            <button
              type="button"
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-lg transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition shadow-xs flex items-center gap-1.5"
            >
              <Save className="w-4 h-4" /> Salvar Registro
            </button>
          </div>
        </form>
      )}
    </div>
  );
};

// 3. Dynamic Field Renderer
export const DynamicField: React.FC<{ field: BuilderField }> = ({ field }) => {
  return (
    <div className="space-y-1">
      <label className="block text-xs font-bold text-slate-700">
        {field.label}{' '}
        {field.required && <span className="text-red-500 font-bold">*</span>}
      </label>

      {field.type === 'text' && (
        <input
          type="text"
          required={field.required}
          placeholder={`Digite ${field.label.toLowerCase()}...`}
          className="w-full text-xs p-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
        />
      )}

      {field.type === 'number' && (
        <input
          type="number"
          required={field.required}
          placeholder="0"
          className="w-full text-xs p-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
        />
      )}

      {field.type === 'currency' && (
        <div className="relative">
          <span className="absolute left-3 top-2.5 text-xs text-slate-400 font-bold">R$</span>
          <input
            type="number"
            step="0.01"
            required={field.required}
            placeholder="0,00"
            className="w-full text-xs pl-8 pr-3 py-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
          />
        </div>
      )}

      {field.type === 'date' && (
        <input
          type="date"
          required={field.required}
          className="w-full text-xs p-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-700"
        />
      )}

      {field.type === 'select' && (
        <select
          required={field.required}
          className="w-full text-xs p-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-700"
        >
          <option value="">Selecione uma opção...</option>
          {(field.options || ['Opção A', 'Opção B', 'Opção C']).map((opt, idx) => (
            <option key={idx} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      )}

      {field.type === 'textarea' && (
        <textarea
          rows={3}
          required={field.required}
          placeholder={`Informe ${field.label.toLowerCase()}...`}
          className="w-full text-xs p-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
        />
      )}

      {field.type === 'boolean' && (
        <label className="flex items-center gap-2 cursor-pointer pt-1">
          <input
            type="checkbox"
            className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300"
          />
          <span className="text-xs font-semibold text-slate-700">Sim / Confirmado</span>
        </label>
      )}
    </div>
  );
};

// 4. Dynamic Dashboard
export const DynamicDashboard: React.FC<{ page: BuilderPage; module: BuilderModule }> = ({
  module,
}) => {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase">Total de Cursos</span>
            <span className="p-2 bg-blue-50 text-blue-600 rounded-lg">
              <BarChart3 className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-2 text-2xl font-black text-slate-900">18</div>
          <span className="text-[10px] text-emerald-600 font-bold">+2 novos este mês</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase">Inscrições Ativas</span>
            <span className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
              <Users className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-2 text-2xl font-black text-slate-900">142</div>
          <span className="text-[10px] text-slate-400">94% de presença acumulada</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase">Automações Ativas</span>
            <span className="p-2 bg-amber-50 text-amber-600 rounded-lg">
              <Zap className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-2 text-2xl font-black text-slate-900">{module.automacoes.length}</div>
          <span className="text-[10px] text-blue-600 font-bold">Régua em execução</span>
        </div>
      </div>
    </div>
  );
};

// 5. Dynamic Report
export const DynamicReport: React.FC<{ page: BuilderPage; module: BuilderModule }> = ({
  page,
}) => {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
      <div className="flex items-center justify-between border-b border-slate-100 pb-4">
        <div>
          <h3 className="font-extrabold text-slate-900 text-sm">{page.nome}</h3>
          <p className="text-xs text-slate-500">Relatório de auditoria e exportação executiva</p>
        </div>
        <button className="px-3 py-1.5 bg-slate-100 text-slate-700 font-bold text-xs rounded-lg hover:bg-slate-200">
          Exportar PDF / Excel
        </button>
      </div>

      <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-600 space-y-2">
        <div className="font-bold text-slate-800">Parâmetros Ativos no Relatório:</div>
        <ul className="list-disc list-inside space-y-1 text-slate-500">
          <li>Filtro Multi-tenant: Isolado por Empresa Ativa</li>
          <li>Período: Últimos 30 dias</li>
          <li>Auditoria RLS: Verificado com sucesso</li>
        </ul>
      </div>
    </div>
  );
};

// 6. Dynamic Workflow / Kanban
export const DynamicWorkflow: React.FC<{ page: BuilderPage; module: BuilderModule }> = ({
  page,
}) => {
  const steps = ['Inscrição', 'Em Andamento', 'Avaliação Final', 'Certificado Emitido'];

  return (
    <div className="space-y-3">
      <h3 className="font-bold text-slate-800 text-sm">{page.nome} - Funil de Processo</h3>
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        {steps.map((step, idx) => (
          <div key={idx} className="bg-slate-100/80 p-3 rounded-xl border border-slate-200">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200 mb-2">
              <span className="font-extrabold text-xs text-slate-800">{step}</span>
              <span className="text-[10px] bg-white font-bold px-2 py-0.5 rounded-full border border-slate-200">
                {idx + 1}
              </span>
            </div>
            <div className="p-2.5 bg-white rounded-lg border border-slate-200 text-xs shadow-xs font-semibold text-slate-700">
              Registro Exemplo #{idx + 101}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// 7. Dynamic Automation Display
export const DynamicAutomationList: React.FC<{ automations: BuilderAutomation[] }> = ({
  automations,
}) => {
  return (
    <div className="space-y-3">
      {automations.map((a) => (
        <div
          key={a.id}
          className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-xs"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
              <Zap className="w-4 h-4" />
            </div>
            <div>
              <div className="font-bold text-slate-800">{a.nome}</div>
              <div className="text-[10px] text-slate-500">
                Gatilho: <code className="text-blue-600">{a.gatilho}</code> → Ação:{' '}
                <code className="text-emerald-600">{a.acao}</code>
              </div>
            </div>
          </div>
          <span className="px-2 py-1 bg-emerald-100 text-emerald-800 text-[10px] font-bold rounded-md uppercase">
            Ativa
          </span>
        </div>
      ))}
    </div>
  );
};
