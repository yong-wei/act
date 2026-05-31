import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import type { DataCenterSourceQuality } from './data-center-contracts';
import { DataCenterSourceMarker } from './source-marker';

interface DataCenterChartPanelProps {
  title: string;
  subtitle?: string;
  sourceQuality: DataCenterSourceQuality;
  mode: 'presentation' | 'governance';
  children: ReactNode;
  className?: string;
  actions?: ReactNode;
}

export function DataCenterChartPanel({
  title,
  subtitle,
  sourceQuality,
  mode,
  children,
  className,
  actions,
}: DataCenterChartPanelProps) {
  const isGovernance = mode === 'governance';

  return (
    <section
      className={cn(
        'rounded-2xl border p-5',
        'border-platform-border bg-platform-surface',
        isGovernance && 'border-l-4 border-l-platform-action-primary',
        className,
      )}
    >
      <div className="mb-4 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-platform-fg-primary">{title}</h2>
          {subtitle ? (
            <p className="mt-1 text-xs text-platform-fg-secondary">{subtitle}</p>
          ) : null}
          <div className="mt-2">
            <DataCenterSourceMarker quality={sourceQuality} />
          </div>
        </div>
        {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
      </div>
      <div className="min-h-0">{children}</div>
    </section>
  );
}
