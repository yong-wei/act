'use client';

import { ArrowLeft } from 'lucide-react';
import type { RefObject } from 'react';

interface KnowledgeDomainReturnActionProps {
  domainId: string | null;
  onReturn: () => void;
  returnFocusRef?: RefObject<HTMLElement | null>;
  resolveReturnFocus?: () => HTMLElement | null;
}

export function KnowledgeDomainReturnAction({
  domainId,
  onReturn,
  returnFocusRef,
  resolveReturnFocus,
}: KnowledgeDomainReturnActionProps) {
  if (!domainId) return null;

  const handleReturn = () => {
    onReturn();
    window.requestAnimationFrame(() => {
      (resolveReturnFocus?.() ?? returnFocusRef?.current)?.focus();
    });
  };

  return (
    <button
      type="button"
      onClick={handleReturn}
      aria-label="返回全部领域"
      title="返回全部领域"
      className="absolute right-[var(--knowledge-workspace-inset)] top-16 z-40 inline-flex h-10 items-center gap-2 rounded-lg border border-platform-border bg-platform-surface/95 px-3 text-sm font-medium text-platform-fg-primary shadow-lg backdrop-blur-md hover:bg-platform-action-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-platform-action lg:top-[var(--knowledge-workspace-inset)]"
      data-knowledge-return-root="true"
    >
      <ArrowLeft className="h-4 w-4" aria-hidden="true" />
      返回全部领域
    </button>
  );
}
