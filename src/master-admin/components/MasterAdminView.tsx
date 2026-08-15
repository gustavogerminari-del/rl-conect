import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Activity,
  Building2,
  CircleDollarSign,
  CloudCog,
  Code2,
  Crown,
  Database,
  FileCheck2,
  Headphones,
  Layers3,
  PlusCircle,
  Settings,
  ShieldCheck,
  Users,
  type LucideIcon,
} from 'lucide-react';
import {
  MasterAdminView as MasterAdminOfficialView,
  type MasterNavigationSection,
} from './MasterAdminOfficialView';
import { MasterDeveloperAssistantView } from './MasterDeveloperAssistantView';
import { validarAcessoMaster } from '../../auth/masterValidation';

export type { MasterNavigationSection } from './MasterAdminOfficialView';

type OfficialMenuItem = {
  id: MasterNavigationSection;
  label: string;
  Icon: LucideIcon;
};

const OFFICIAL_MENU: OfficialMenuItem[] = [
  { id: 'dashboard', label: 'Visão Geral', Icon: Activity },
  { id: 'leads', label: 'Leads', Icon: PlusCircle },
  { id: 'empresas', label: 'Empresas', Icon: Building2 },
  { id: 'usuarios', label: 'Usuários e Permissões', Icon: Users },
  { id: 'planos-modulos', label: 'Planos e Módulos', Icon: Layers3 },
  { id: 'financeiro', label: 'Financeiro', Icon: CircleDollarSign },
  { id: 'faturamento', label: 'Faturamento / NFS-e', Icon: FileCheck2 },
  { id: 'suporte', label: 'Suporte Técnico', Icon: Headphones },
  { id: 'integracoes', label: 'Integrações / API', Icon: CloudCog },
  { id: 'backup', label: 'Backup', Icon: Database },
  { id: 'auditoria', label: 'Auditoria e Logs', Icon: ShieldCheck },
  { id: 'configuracoes', label: 'Configurações', Icon: Settings },
];

const MASTER_SCROLL_CSS = `
@media (min-width: 768px) {
  .master-admin-wrapper aside {
    position: sticky;
    top: 73px;
    height: calc(100vh - 73px);
    max-height: calc(100vh - 73px);
    overflow-y: auto;
    overscroll-behavior: contain;
    scrollbar-gutter: stable;
  }

  .master-admin-wrapper main {
    min-height: calc(100vh - 73px);
  }
}
`;

/**
 * Camada de compatibilidade do Painel Master.
 *
 * - mantém a tela oficial e toda a arquitetura Firebase existente;
 * - normaliza rótulos legados (OpenAI -> Gemini);
 * - acrescenta a Área do Programador já existente ao menu;
 * - garante rolagem vertical própria da lateral em telas desktop baixas.
 */
export function MasterAdminView(props: React.ComponentProps<typeof MasterAdminOfficialView>) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [officialSection, setOfficialSection] = useState<MasterNavigationSection>(props.initialSection ?? 'dashboard');
  const [developerMode, setDeveloperMode] = useState(false);
  const [menuHost, setMenuHost] = useState<HTMLElement | null>(null);

  const openDeveloperArea = useCallback(async () => {
    const validation = await validarAcessoMaster();
    if (!validation.autorizado) {
      window.alert(validation.motivo || 'Acesso Master não autorizado.');
      return;
    }
    setDeveloperMode(true);
  }, []);

  const openOfficialSection = useCallback((section: MasterNavigationSection) => {
    setOfficialSection(section);
    setDeveloperMode(false);
  }, []);

  useEffect(() => {
    if (developerMode) {
      setMenuHost(null);
      return;
    }

    const root = rootRef.current;
    if (!root) return;

    const normalizeVisibleLabels = () => {
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      let node = walker.nextNode();
      while (node) {
        if (node.textContent?.includes('OpenAI / IA')) {
          node.textContent = node.textContent.replaceAll('OpenAI / IA', 'Gemini / IA');
        }
        if (node.textContent?.includes('CONFIGURACAO PENDENTE')) {
          node.textContent = node.textContent.replaceAll('CONFIGURACAO PENDENTE', 'CONFIGURAÇÃO PENDENTE');
        }
        node = walker.nextNode();
      }

      const host = root.querySelector('aside > div');
      setMenuHost(host instanceof HTMLElement ? host : null);
    };

    normalizeVisibleLabels();
    const observer = new MutationObserver(normalizeVisibleLabels);
    observer.observe(root, { childList: true, subtree: true, characterData: true });
    return () => observer.disconnect();
  }, [developerMode, officialSection]);

  if (developerMode) {
    return (
      <div ref={rootRef} className="master-admin-wrapper">
        <style>{MASTER_SCROLL_CSS}</style>
        <div className="-m-4 flex min-h-screen flex-col bg-slate-950 text-slate-100 sm:-m-6 lg:-m-8">
          <header className="sticky top-0 z-30 flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 bg-slate-900 px-5 py-4 shadow-lg">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500 text-slate-950">
                <Crown className="h-6 w-6" />
              </div>
              <div>
                <h1 className="font-black text-white">PAINEL MASTER RL CONNECT</h1>
                <p className="text-xs text-slate-400">Firebase-only • controle administrativo central</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => openOfficialSection('dashboard')}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-bold text-slate-200 hover:bg-slate-700"
            >
              <Activity className="h-4 w-4" />
              Voltar à Visão Geral
            </button>
          </header>

          <div className="flex flex-1 flex-col md:flex-row">
            <aside className="w-full shrink-0 border-b border-slate-800 bg-slate-900/90 p-3 md:w-72 md:border-b-0 md:border-r">
              <div className="grid grid-cols-2 gap-1 md:grid-cols-1">
                {OFFICIAL_MENU.map(({ id, label, Icon }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => openOfficialSection(id)}
                    className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-left text-xs font-bold text-slate-300 hover:bg-slate-800"
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span>{label}</span>
                  </button>
                ))}
                <button
                  type="button"
                  aria-current="page"
                  className="flex items-center gap-2 rounded-xl bg-amber-500 px-3 py-2.5 text-left text-xs font-bold text-slate-950"
                >
                  <Code2 className="h-4 w-4 shrink-0" />
                  <span>Área do Programador</span>
                </button>
              </div>
            </aside>

            <main className="min-w-0 flex-1 space-y-5 overflow-y-auto p-4 sm:p-6">
              <MasterDeveloperAssistantView />
            </main>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div ref={rootRef} className="master-admin-wrapper">
      <style>{MASTER_SCROLL_CSS}</style>
      <MasterAdminOfficialView {...props} initialSection={officialSection} key={officialSection} />
      {menuHost && createPortal(
        <button
          type="button"
          onClick={openDeveloperArea}
          className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-left text-xs font-bold text-slate-300 hover:bg-slate-800"
        >
          <Code2 className="h-4 w-4 shrink-0" />
          <span>Área do Programador</span>
        </button>,
        menuHost,
      )}
    </div>
  );
}
