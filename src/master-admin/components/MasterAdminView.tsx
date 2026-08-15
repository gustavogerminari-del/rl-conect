import React, { useEffect, useRef } from 'react';
import { MasterAdminView as MasterAdminOfficialView } from './MasterAdminOfficialView';
export type { MasterNavigationSection } from './MasterAdminOfficialView';

/**
 * Compatibilidade visual enquanto o catálogo oficial ainda contém rótulos legados.
 * A fonte de status é ajustada no serviço para aceitar somente configuração Gemini real.
 */
export function MasterAdminView(props: React.ComponentProps<typeof MasterAdminOfficialView>) {
  const rootRef = useRef<HTMLDivElement>(null);

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
    };
    normalizeVisibleLabels();
    const observer = new MutationObserver(normalizeVisibleLabels);
    observer.observe(root, { childList: true, subtree: true, characterData: true });
    return () => observer.disconnect();
  }, []);

  return <div ref={rootRef}><MasterAdminOfficialView {...props} /></div>;
}
