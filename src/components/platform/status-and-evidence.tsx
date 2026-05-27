import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

import {
  buildPlatformStatusViewModel,
  type PlatformRole,
  type PlatformStatusPayload,
  type PlatformStatusTone,
} from './platform-ui-contracts';

export interface PlatformStatusPrimitiveProps {
  payload: PlatformStatusPayload;
  role: PlatformRole;
  className?: string;
}

export interface PlatformStatusMessageProps {
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

const toneClassNames: Record<PlatformStatusTone, string> = {
  success: 'border-platform-evidence-eligible bg-platform-surface text-platform-fg-primary',
  info: 'border-platform-action-primary bg-platform-surface text-platform-fg-primary',
  warning: 'border-platform-evidence-context bg-platform-action-subtle text-platform-fg-primary',
  danger: 'border-platform-evidence-unsupported bg-platform-surface text-platform-fg-primary',
  neutral: 'border-platform-border bg-platform-surface text-platform-fg-primary',
};

function statusToneClassName(tone: PlatformStatusTone) {
  return toneClassNames[tone] ?? toneClassNames.neutral;
}

export function PlatformStatusChip({ payload, role, className }: PlatformStatusPrimitiveProps) {
  const viewModel = buildPlatformStatusViewModel(payload, { role });
  return (
    <span
      className={cn(
        'inline-flex min-h-7 max-w-full items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium',
        statusToneClassName(viewModel.tone),
        className,
      )}
      title={viewModel.summaryLabel}
    >
      <span className="truncate">{viewModel.label}</span>
      <span aria-hidden="true" className="text-platform-fg-muted">·</span>
      <span className="truncate text-platform-fg-secondary">{viewModel.summaryLabel}</span>
    </span>
  );
}

export function PlatformStatusInlineExplanation({ payload, role, className }: PlatformStatusPrimitiveProps) {
  const viewModel = buildPlatformStatusViewModel(payload, { role });
  return (
    <p className={cn('text-sm leading-6 text-platform-fg-secondary', className)}>
      <span className="font-medium text-platform-fg-primary">{viewModel.label}</span>
      <span>：{viewModel.summary ?? viewModel.summaryLabel}</span>
      {viewModel.fallbackReason ? <span> {viewModel.fallbackReason}</span> : null}
    </p>
  );
}

export function PlatformStatusDetailPanel({ payload, role, className }: PlatformStatusPrimitiveProps) {
  const viewModel = buildPlatformStatusViewModel(payload, { role });
  return (
    <section className={cn('rounded-lg border border-platform-border bg-platform-surface p-4', className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-platform-fg-primary">{viewModel.label}</h2>
          <p className="mt-1 text-xs text-platform-fg-muted">{viewModel.sourceLabel}</p>
        </div>
        <PlatformStatusChip payload={payload} role={role} />
      </div>
      <p className="mt-3 text-sm leading-6 text-platform-fg-secondary">
        {viewModel.summary ?? viewModel.summaryLabel}
      </p>
      {viewModel.details.length > 0 ? (
        <dl className="mt-4 divide-y divide-platform-border text-sm">
          {viewModel.details.map((detail) => (
            <div key={`${detail.roleScope}-${detail.label}`} className="grid gap-1 py-3 sm:grid-cols-[160px_1fr]">
              <dt className="text-platform-fg-muted">{detail.label}</dt>
              <dd className="text-platform-fg-primary">{detail.value}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="mt-4 rounded-md border border-platform-border bg-platform-canvas-muted px-3 py-2 text-sm text-platform-fg-muted">
          当前角色没有可展示的状态细节。
        </p>
      )}
    </section>
  );
}

export function PlatformStatusAuditRow({ payload, role, className }: PlatformStatusPrimitiveProps) {
  const viewModel = buildPlatformStatusViewModel(payload, { role });
  return (
    <div className={cn('grid gap-2 border-b border-platform-border py-3 text-sm md:grid-cols-[1fr_1fr_120px]', className)}>
      <div>
        <div className="font-medium text-platform-fg-primary">{viewModel.label}</div>
        <div className="text-xs text-platform-fg-muted">{viewModel.sourceLabel}</div>
      </div>
      <div className="text-platform-fg-secondary">{viewModel.summaryLabel}</div>
      <div className="justify-self-start md:justify-self-end">
        <PlatformStatusChip payload={payload} role={role} />
      </div>
    </div>
  );
}

export function PlatformStatusEmptyState({ title, description, action, className }: PlatformStatusMessageProps) {
  return (
    <section className={cn('rounded-lg border border-platform-border bg-platform-canvas-muted p-4 text-center', className)}>
      <h2 className="text-sm font-semibold text-platform-fg-primary">{title}</h2>
      {description ? <p className="mt-2 text-sm leading-6 text-platform-fg-secondary">{description}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </section>
  );
}

export function PlatformStatusErrorState({ title, description, action, className }: PlatformStatusMessageProps) {
  return (
    <section className={cn('rounded-lg border border-platform-evidence-unsupported bg-platform-surface p-4', className)}>
      <h2 className="text-sm font-semibold text-platform-fg-primary">{title}</h2>
      {description ? <p className="mt-2 text-sm leading-6 text-platform-fg-secondary">{description}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </section>
  );
}
