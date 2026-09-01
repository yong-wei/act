'use client';

import type { ReactNode } from 'react';
import { ChevronDown, type LucideIcon } from 'lucide-react';

export type PathWorkspaceModuleId =
  | 'learning-overview'
  | 'current-path'
  | 'goal-selection'
  | 'path-selection'
  | 'learning-record'
  | 'path-resource';

interface PathWorkspaceModuleProps {
  moduleId: PathWorkspaceModuleId;
  openModuleId: PathWorkspaceModuleId | null;
  onToggle: (moduleId: PathWorkspaceModuleId) => void;
  eyebrow: string;
  title: string;
  summary?: string;
  icon?: LucideIcon;
  trailing?: ReactNode;
  children?: ReactNode;
  className?: string;
  [key: `data-${string}`]: string | undefined;
}

export function PathWorkspaceModule({
  moduleId,
  openModuleId,
  onToggle,
  eyebrow,
  title,
  summary,
  icon: Icon,
  trailing,
  children,
  className = '',
  ...dataAttributes
}: PathWorkspaceModuleProps) {
  const isOpen = openModuleId === moduleId;
  const bodyId = `adaptive-path-module-body-${moduleId}`;

  return (
    <section
      id={`adaptive-path-module-${moduleId}`}
      className={`surface-card min-w-0 w-full scroll-mt-24 p-4 sm:p-5 ${className}`}
      data-adaptive-path-module={moduleId}
      data-adaptive-path-module-state={isOpen ? 'expanded' : 'collapsed'}
      {...dataAttributes}
    >
      <button
        type="button"
        onClick={() => onToggle(moduleId)}
        aria-expanded={isOpen}
        aria-controls={bodyId}
        className="flex w-full min-w-0 flex-col items-stretch gap-3 text-left sm:flex-row sm:items-start sm:justify-between sm:gap-4"
        data-adaptive-path-module-header="responsive"
      >
        <span className="min-w-0 flex-1">
          <span className="text-xs font-medium uppercase tracking-normal text-primary">{eyebrow}</span>
          <span className="mt-1 block break-words text-xl font-semibold text-foreground">{title}</span>
          {summary ? <span className="mt-2 block break-words text-sm leading-6 text-subtle">{summary}</span> : null}
        </span>
        <span className="flex max-w-full min-w-0 items-center justify-between gap-3 sm:max-w-[45%] sm:shrink-0 sm:justify-end">
          <span className="min-w-0 break-words">{trailing}</span>
          {Icon ? <Icon className="size-5 shrink-0 text-primary" aria-hidden="true" /> : null}
          <ChevronDown className={`size-4 shrink-0 text-subtle transition-transform ${isOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
        </span>
      </button>
      {isOpen ? (
        <div id={bodyId} className="mt-4 min-w-0 w-full" data-adaptive-path-module-body={moduleId}>
          {children}
        </div>
      ) : null}
    </section>
  );
}
