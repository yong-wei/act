'use client';

import { cn } from '@/lib/utils';
import {
  isLastActiveControlMapFilter,
  toggleControlMapFilter,
  type ControlMapFilterKey,
} from '../control-map-filters';
import type { ViewState } from '../types';

interface ViewTogglesProps {
  viewState: ViewState;
  onViewStateChange: (updates: Partial<ViewState>) => void;
}

const TOGGLE_GROUPS: readonly { id: string; label: string; options: readonly { key: ControlMapFilterKey; label: string }[] }[] = [
  {
    id: 'domain',
    label: '分析域',
    options: [
      { key: 'showTimeDomain', label: '时域' },
      { key: 'showFreqDomain', label: '频域' },
    ],
  },
  {
    id: 'time',
    label: '时间',
    options: [
      { key: 'showContinuous', label: '连续' },
      { key: 'showDiscrete', label: '离散' },
    ],
  },
];

export function ViewToggles({ viewState, onViewStateChange }: ViewTogglesProps) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      {TOGGLE_GROUPS.map((group) => (
        <div key={group.id} className="flex items-center gap-1.5">
          <span className="text-[11px] text-platform-fg-secondary">{group.label}</span>
          <div className="flex rounded-md border border-platform-border bg-platform-canvas/60 p-0.5" role="group" aria-label={group.label}>
            {group.options.map((option) => {
              const active = viewState[option.key];
              const locked = isLastActiveControlMapFilter(viewState, option.key);
              return (
                <button
                  type="button"
                  key={option.key}
                  aria-pressed={active}
                  aria-disabled={locked || undefined}
                  title={locked ? '至少保留一项' : undefined}
                  onClick={() => onViewStateChange(toggleControlMapFilter(viewState, option.key))}
                  className={cn(
                    'rounded px-2.5 py-1 text-xs font-medium transition-colors',
                    active
                      ? 'bg-platform-action-primary/14 text-platform-action-primary'
                      : 'text-platform-fg-muted hover:text-platform-fg-primary',
                    locked && 'cursor-not-allowed',
                  )}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
