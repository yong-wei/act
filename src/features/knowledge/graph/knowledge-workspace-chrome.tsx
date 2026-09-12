'use client';

import { useLayoutEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

export const KNOWLEDGE_WORKSPACE_CHROME_SLOT_ID = 'knowledge-workspace-chrome-slot';

export function KnowledgeWorkspaceChromePortal({
  hostRef,
  children,
}: {
  hostRef?: { current: HTMLElement | null };
  children: ReactNode;
}) {
  const [host, setHost] = useState<HTMLElement | null>(null);

  useLayoutEffect(() => {
    setHost(hostRef ? hostRef.current : document.getElementById(KNOWLEDGE_WORKSPACE_CHROME_SLOT_ID));
  }, [hostRef]);

  if (host) return createPortal(children, host);
  return children;
}
