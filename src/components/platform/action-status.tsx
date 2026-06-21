import type { ReactNode } from 'react';

import type { AuditedActionSeverity, AuditedActionState } from '@/lib/action-status-contract';
import { cn } from '@/lib/utils';

export interface ActionStatusPanelProps {
  state: AuditedActionState;
  action?: ReactNode;
  className?: string;
}

const severityClassNames: Record<AuditedActionSeverity, string> = {
  neutral: 'border-platform-border bg-platform-surface text-platform-fg-primary',
  info: 'border-platform-action-primary bg-platform-surface text-platform-fg-primary',
  success: 'border-platform-evidence-eligible bg-platform-surface text-platform-fg-primary',
  warning: 'border-platform-evidence-context bg-platform-action-subtle text-platform-fg-primary',
  danger: 'border-platform-evidence-unsupported bg-platform-surface text-platform-fg-primary',
};

export function ActionStatusPanel({ state, action, className }: ActionStatusPanelProps) {
  const isErrorLike = state.severity === 'danger' || state.status === 'failed';
  return (
    <section
      className={cn('rounded-lg border p-4 text-sm', severityClassNames[state.severity], className)}
      data-audited-action-id={state.identity.id}
      data-audited-action-category={state.identity.category}
      data-audited-action-status={state.status}
      role={isErrorLike ? 'alert' : 'status'}
      aria-live={isErrorLike ? 'assertive' : 'polite'}
    >
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="font-medium text-platform-fg-primary">{state.identity.label}</p>
          <p className="mt-1 leading-6 text-platform-fg-secondary">{state.message}</p>
          <p className="sr-only">{state.announcement}</p>
        </div>
        <span className="inline-flex w-fit rounded-full border border-platform-border px-2.5 py-1 text-xs text-platform-fg-secondary">
          {state.status}
        </span>
      </div>
      {state.recoveryAction || state.nextAction || state.downloadFilename || action ? (
        <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-platform-fg-secondary">
          {state.recoveryAction ? <span>恢复：{state.recoveryAction}</span> : null}
          {state.nextAction ? <span>下一步：{state.nextAction}</span> : null}
          {state.downloadFilename ? <span>文件：{state.downloadFilename}</span> : null}
          {action}
        </div>
      ) : null}
    </section>
  );
}
