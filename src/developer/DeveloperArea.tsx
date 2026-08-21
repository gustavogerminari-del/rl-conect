import React, { useMemo, useState } from 'react';
import {
  Activity,
  Bot,
  Braces,
  Code2,
  Database,
  ExternalLink,
  FlaskConical,
  History,
  LayoutDashboard,
  LogOut,
  Network,
  PanelLeft,
  Rocket,
  RotateCcw,
  Settings,
  Workflow,
} from 'lucide-react';
import { dataService } from '../services/dataService';
import { MasterDeveloperAssistantView } from '../master-admin/components/MasterDeveloperAssistantView';
import { DEVELOPER_RELEASE } from './releaseManifest';
import { VisualBuilder } from './VisualBuilder';

type SectionKey =
  | 'overview'
  | 'visual'
  | 'ai'
  | 'code'
  | 'firebase'
  | 'integrations'
  | 'n8n'
  | 'logs'
  | 'tests'
  | 'versions'
  | 'rollback'
  | 'publish'
  | 'settings';

interface DeveloperAreaProps {
  onBackToMaster?: () => void;
}

const menu: Array<{ key: SectionKey; label: string; icon: React.ElementType }> = [
  { key: 'overview', label: 'Visão Geral', icon: LayoutDashboard },
  { key: 'visual', label: 'Editor Visual', icon: PanelLeft },
  { key: 'ai', label: 'Gemini / IA', icon: Bot },
  { key: 'code', label: 'Editor de Código', icon: Code2 },
  { key: 'firebase', label: 'Firebase', icon: Database },
  { key: 'integrations', label: 'Integrações', icon: Network },
  { key: 'n8n', label: 'n8n', icon: Workflow },
  { key: 'logs', label: 'Logs Técnicos', icon: Activity },
  { key: 'tests', label: 'Testes', icon: FlaskConical },
  { key: 'versions', label: 'Versões', icon: History },
  { key: 'rollback', label: 'Rollback', icon: RotateCcw },
  { key: 'publish', label: 'Publicação', icon: Rocket },
  { key: 'settings', label: 'Configurações', icon: Settings },
];

const allowedRoles = new Set(['master_admin', 'master', 'developer', 'programador', 'dev']);

export const DeveloperArea: React.FC<DeveloperAreaProps> = ({ onBackToMaster }) => {
  const [section, setSection] = useState<SectionKey>('overview');
  const currentUser = dataService.getCurrentUser();
  const normalizedRole = String((currentUser as any)?.role || (currentUser as any)?.tipoUsuario || '')
    .trim()
    .toLowerCase();
  const authorized = allowedRoles.has(normalizedRole);

  const releaseRows = useMemo(
    () => [
      ['Versão', `V${DEVELOPER_RELEASE.version}`],
      ['Branch', DEVELOPER_RELEASE.branch],
      ['Ambiente', DEVELOPER_RELEASE.environment],
      ['Firebase', dataService.getFirebaseStatus().authenticated ? 'Autenticado' : 'Não autenticado'],
    ],
    [],
  );

  const goBack = () => {
    if (onBackToMaster) {
      onBackToMaster();
      return;
    }
    window.history.pushState({}, '', '/');
    window.dispatchEvent(new PopStateEvent('popstate'));
  };

  const logout = async () => {
    await dataService.logoutFirebase();
    window.location.assign('/');
  };

  if (!authorized) {
    return (
      <div className="grid min-h-screen place-items-center bg-slate-950 p-6 text-white">
        <div className="w-full max-w-lg rounded-3xl border border-rose-500/30 bg-slate-900 p-8 text-center shadow-2xl">
          <Code2 className="mx-auto h-10 w-10 text-rose-400" />
          <h1 className="mt-4 text-xl font-black">Área do Programador protegida</h1>
          <p className="mt-2 text-sm text-slate-400">Esta rota exige um perfil MASTER ou de desenvolvimento autenticado.</p>
          <button onClick={goBack} className="mt-6 rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-slate-950">
            ← Voltar para o Painel Master
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-[#07111f] text-slate-100">
      <aside className="flex w-64 shrink-0 flex-col border-r border-slate-800 bg-[#0B1D33]">
        <div className="border-b border-slate-800 p-4">
          <button onClick={goBack} className="mb-4 text-xs font-bold text-blue-300 hover:text-white">← Voltar para o Painel Master</button>
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-blue-600 shadow-lg shadow-blue-950/50">
              <Braces className="h-5 w-5" />
            </div>
            <div>
              <div className="font-black tracking-tight">RL CONNECT DEV</div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Área do Programador · V{DEVELOPER_RELEASE.version}</div>
            </div>
          </div>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          {menu.map(({ key, label, icon: Icon }) => {
            const active = section === key;
            return (
              <button
                key={key}
                onClick={() => setSection(key)}
                className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-xs font-bold transition ${active ? 'bg-blue-600 text-white shadow-lg shadow-blue-950/40' : 'text-slate-300 hover:bg-slate-800 hover:text-white'}`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {label}
              </button>
            );
          })}
        </nav>

        <div className="border-t border-slate-800 p-3">
          <div className="mb-2 truncate px-2 text-[10px] text-slate-500">{currentUser?.email}</div>
          <button onClick={() => void logout()} className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold text-slate-300 hover:bg-rose-500/10 hover:text-rose-300">
            <LogOut className="h-4 w-4" /> Sair
          </button>
        </div>
      </aside>

      <main className="min-w-0 flex-1 overflow-x-hidden bg-slate-50 text-slate-900">
        <header className="sticky top-0 z-20 flex min-h-16 items-center justify-between border-b border-slate-200 bg-white/95 px-6 py-3 backdrop-blur">
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-blue-600">Ambiente de desenvolvimento</div>
            <h1 className="text-lg font-black">{menu.find((item) => item.key === section)?.label}</h1>
          </div>
          <a
            href="https://aistudio.google.com/"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:border-blue-300 hover:text-blue-700"
          >
            Google AI Studio <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </header>

        {section === 'visual' ? (
          <VisualBuilder />
        ) : section === 'ai' || section === 'code' ? (
          <div className="p-5 lg:p-7">
            <MasterDeveloperAssistantView />
          </div>
        ) : (
          <div className="p-5 lg:p-7">
            {section === 'overview' && (
              <div className="space-y-6">
                <div className="rounded-3xl bg-slate-950 p-7 text-white shadow-xl">
                  <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <div className="text-xs font-bold uppercase tracking-[0.2em] text-blue-300">RL Connect Developer Workspace</div>
                      <h2 className="mt-2 text-2xl font-black">Edite o sistema sem ficar preso ao conteúdo do Painel Master.</h2>
                      <p className="mt-2 max-w-2xl text-sm text-slate-400">O Editor Visual permite selecionar páginas, mover elementos, alterar textos, tamanhos e propriedades. Para alterações de código e IA, use Gemini / Editor de Código.</p>
                    </div>
                    <button onClick={() => setSection('visual')} className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-black text-white shadow-lg shadow-blue-950/40">Abrir Editor Visual</button>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  {releaseRows.map(([label, value]) => (
                    <div key={label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                      <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">{label}</div>
                      <div className="mt-2 break-words text-sm font-extrabold text-slate-900">{value}</div>
                    </div>
                  ))}
                </div>

                <div className="grid gap-4 lg:grid-cols-3">
                  <FeatureCard icon={PanelLeft} title="Editor tipo Figma" detail="Dashboard, Vagas, Banco de Talentos, Portal de Vagas e Acesso Master no mesmo editor visual." onClick={() => setSection('visual')} />
                  <FeatureCard icon={Bot} title="Gemini / Google AI Studio" detail="Assistente de desenvolvimento com acesso ao provedor Gemini configurado no ambiente." onClick={() => setSection('ai')} />
                  <FeatureCard icon={Code2} title="Código real" detail="Abra arquivos do projeto, revise conteúdo e prepare alterações sem misturar a tela com o Painel Master." onClick={() => setSection('code')} />
                </div>
              </div>
            )}

            {section !== 'overview' && <TechnicalSection section={section} onOpenVisual={() => setSection('visual')} />}
          </div>
        )}
      </main>
    </div>
  );
};

function FeatureCard({ icon: Icon, title, detail, onClick }: { icon: React.ElementType; title: string; detail: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md">
      <Icon className="h-5 w-5 text-blue-600" />
      <div className="mt-3 font-black text-slate-900">{title}</div>
      <p className="mt-1 text-xs leading-5 text-slate-500">{detail}</p>
    </button>
  );
}

function TechnicalSection({ section, onOpenVisual }: { section: Exclude<SectionKey, 'overview' | 'visual' | 'ai' | 'code'>; onOpenVisual: () => void }) {
  const copy: Record<string, { title: string; detail: string }> = {
    firebase: { title: 'Firebase', detail: 'Autenticação e persistência permanecem conectadas à camada Firebase do RL Connect.' },
    integrations: { title: 'Integrações', detail: 'Área reservada para integrações externas, Google Workspace e serviços do sistema.' },
    n8n: { title: 'n8n', detail: 'Acompanhe a arquitetura de automações sem misturar o editor com o código principal.' },
    logs: { title: 'Logs Técnicos', detail: 'Use os registros técnicos e de auditoria para diagnóstico antes de publicar alterações.' },
    tests: { title: 'Testes', detail: 'Valide build e fluxos críticos antes de mover uma versão para homologação ou produção.' },
    versions: { title: 'Versões', detail: `Versão atual da Área do Programador: V${DEVELOPER_RELEASE.version}.` },
    rollback: { title: 'Rollback', detail: 'Restaure uma versão validada quando uma publicação precisar ser revertida.' },
    publish: { title: 'Publicação', detail: 'Publicações devem sair somente de uma versão que passou pelo build e pelos testes de validação.' },
    settings: { title: 'Configurações', detail: 'Preferências técnicas e parâmetros da Área do Programador.' },
  };
  const item = copy[section];
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-7 shadow-sm">
      <div className="text-xs font-black uppercase tracking-wider text-blue-600">Área técnica</div>
      <h2 className="mt-2 text-xl font-black">{item.title}</h2>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">{item.detail}</p>
      <button onClick={onOpenVisual} className="mt-5 rounded-xl bg-slate-950 px-4 py-2.5 text-xs font-bold text-white">Abrir Editor Visual</button>
    </div>
  );
}

export default DeveloperArea;
