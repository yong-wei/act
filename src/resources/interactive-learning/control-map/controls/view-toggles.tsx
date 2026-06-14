'use client';

import type { ViewState } from '../types';

interface ViewTogglesProps {
  viewState: ViewState;
  onViewStateChange: (updates: Partial<ViewState>) => void;
}

export function ViewToggles({ viewState, onViewStateChange }: ViewTogglesProps) {
  const toggles = [
    {
      id: 'domain',
      label: '域',
      options: [
        { key: 'showTimeDomain', label: '时域', active: viewState.showTimeDomain },
        { key: 'showFreqDomain', label: '频域', active: viewState.showFreqDomain },
      ],
    },
    {
      id: 'time',
      label: '时间',
      options: [
        { key: 'showContinuous', label: '连续', active: viewState.showContinuous },
        { key: 'showDiscrete', label: '离散', active: viewState.showDiscrete },
      ],
    },
  ];

  return (
    <div className="flex items-center gap-4">
      {toggles.map((group) => (
        <div key={group.id} className="flex items-center gap-2">
          <span className="text-xs text-slate-500">{group.label}</span>
          <div className="flex rounded-lg border border-slate-700 bg-slate-800/50 p-0.5">
            {group.options.map((option) => (
              <button type="button"
                key={option.key}
                onClick={() =>
                  onViewStateChange({
                    [option.key]: !option.active,
                  } as Partial<ViewState>)
                }
                className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                  option.active
                    ? 'bg-blue-500/20 text-blue-400'
                    : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
