import type { DataCenterSourceQuality } from './data-center-contracts';
import { SOURCE_QUALITY_MARKERS } from './data-center-contracts';
import { cn } from '@/lib/utils';

interface SourceMarkerProps {
  quality: DataCenterSourceQuality;
  className?: string;
  showSummary?: boolean;
}

const qualityColorMap: Record<DataCenterSourceQuality, string> = {
  real: 'bg-platform-evidence-eligible/15 text-platform-evidence-eligible border-platform-evidence-eligible/30',
  demo: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
  partial: 'bg-platform-action-subtle text-platform-action-primary border-platform-action-primary/30',
  stale: 'bg-platform-evidence-context text-orange-400 border-orange-500/30',
  restricted: 'bg-platform-privacy-restricted text-red-400 border-red-500/30',
};

export function DataCenterSourceMarker({ quality, className, showSummary = false }: SourceMarkerProps) {
  const marker = SOURCE_QUALITY_MARKERS[quality];

  return (
    <span className={cn('inline-flex flex-col gap-0.5', className)}>
      <span
        className={cn(
          'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium',
          qualityColorMap[quality],
        )}
        title={marker.summary}
      >
        <span className="h-1.5 w-1.5 rounded-full bg-current" />
        {marker.label}
      </span>
      {showSummary ? (
        <span className="text-[11px] text-platform-fg-muted">{marker.summary}</span>
      ) : null}
    </span>
  );
}
