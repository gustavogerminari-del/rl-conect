import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Code2 } from 'lucide-react';
import {
  MasterAdminView as MasterAdminOfficialView,
  type MasterNavigationSection,
} from './MasterAdminOfficialView';
import { validarAcessoMaster } from '../../auth/masterValidation';

export type { MasterNavigationSection } from './MasterAdminOfficialView';

const MASTER_SCROLL_CSS = `
@media (min-width: 768px) {
  .master-admin-wrapper aside {
    position: sticky;
    top: var(--master-header-height, 80px);
    height: calc(100dvh - var(--master-header-height, 80px));
    max-height: calc(100dvh - var(--master-header-height, 80px));
    min-height: 0;
    box-sizing: border-box;
    overflow-y: auto !important;
    overscroll-behavior: contain;
    scrollbar-gutter: stable;
    scrollbar-width: thin;
    scrollbar-color: #64748b #0f172a;
    padding-bottom: max(1rem, env(safe-area-inset-bottom));
  }

  .master-admin-wrapper aside::-webkit-scrollbar {
    width: 10px;
  }

  .master-admin-wrapper aside::-webkit-scrollbar-track {
    background: #0f172a;
  }

  .master-admin-wrapper aside::-webkit-scrollbar-thumb {
    border: 2px solid #0f172a;
    border-radius: 999px;
    background: #64748b;
  }

  .master-admin-wrapper main {
    min-height: calc(100dvh - var(--master-header-height, 80px));
  }
}
`;

type MasterAdminViewProps = React.ComponentProps<typeof MasterAdminOfficialView> & {
  onOpenDeveloperArea?: () => void;
};

/**
 * Camada de compatibilidade do Painel Master.
 *
 * - mantém a tela oficial e toda a arquitetura Firebase existente;
 * - normaliza rótulos legados (OpenAI -> Gemini);
 * - acrescenta o acesso à rota própria da Área do Programador;
 * - garante rolagem vertical própria da lateral em telas desktop baixas.
 */
export function MasterAdminView({ onOpenDeveloperArea, ...props }: MasterAdminViewProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [officialSection] = useState<MasterNavigationSection>(props.initialSection ?? 'dashboard');
  const [menuHost, setMenuHost] = useState<HTMLElement | null>(null);

  useEffect(() => {
    const root = rootRef.current;
    const header = root?.querySelector('header');
    if (!root || !(header instanceof HTMLElement)) return;

    const syncHeaderHeight = () => {
      root.style.setProperty('--master-header-height', `${Math.ceil(header.getBoundingClientRect().height)}px`);
    };

    syncHeaderHeight();
    const resizeObserver = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(syncHeaderHeight) : null;
    resizeObserver?.observe(header);
    window.addEventListener('resize', syncHeaderHeight);

    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener('resize', syncHeaderHeight);
    };
  }, [officialSection]);

  const openDeveloperArea = useCallback(async () => {
    const validation = await validarAcessoMaster();
    if (!validation.autorizado) {
      window.alert(validation.motivo || 'Acesso Master não autorizado.');
      return;
    }

    if (onOpenDeveloperArea) {
      onOpenDeveloperArea();
      return;
    }

    window.history.pushState({}, '', '/master/programador');
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, [onOpenDeveloperArea]);

  useEffect(() => {
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
  }, [officialSection]);

  return (
    <div ref={rootRef} className="master-admin-wrapper">
      <style>{MASTER_SCROLL_CSS}</style>
      <MasterAdminOfficialView {...props} initialSection={officialSection} key={officialSection} />
      {menuHost && createPortal(
        <button
          type="button"
          onClick={() => void openDeveloperArea()}
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
