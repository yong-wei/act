'use client';

import { ILAB_STEPS } from '@/features/ilab/steps';

export function IlabDockSteps({
  seq,
  records,
  onOpen,
}: {
  seq: number;
  records?: Array<{ seq: number; earnedPoints: number; maxPoints: number }>;
  onOpen: (seq: number) => void;
}) {
  return (
    <div className="w-max max-w-[calc(100vw-2rem)] space-y-2" data-ilab-step-nav>
      <p className="text-xs text-platform-fg-secondary">当前进行第 {seq} 步。每一步都可以直接打开。</p>
      <ol className="space-y-1">
        {ILAB_STEPS.map((item) => {
          const record = records?.find((stepRecord) => stepRecord.seq === item.seq);
          const viewing = item.seq === seq;
          return (
            <li key={item.seq}>
              <button
                type="button"
                onClick={() => onOpen(item.seq)}
                data-ilab-step={item.seq}
                className={`block w-max max-w-full rounded-md border px-2 py-1.5 text-left text-xs ${viewing ? 'border-platform-action-primary bg-platform-action-subtle' : 'border-platform-border bg-platform-surface-overlay/86'}`}
              >
                <span className="font-medium">{item.seq}. {item.title}</span>
                <span className="mt-0.5 block text-platform-fg-secondary">{record ? `已记录 ${record.earnedPoints}/${record.maxPoints}` : `${item.maxPoints} 分`} · {item.goal}</span>
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
