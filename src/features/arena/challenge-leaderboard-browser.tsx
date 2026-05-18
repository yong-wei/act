'use client';

import { useMemo, useState } from 'react';

import type { ArenaSubmissionRecord } from './submissions/submission-service';
import type { ControllerMethod, LeaderboardPolicy } from './types';
import {
  getChallengeLeaderboardBrowserViewModel,
  type ChallengeLeaderboardOption,
} from './leaderboards/leaderboard-service';

type ChallengeLeaderboardType = 'main' | 'method' | 'metric';

interface ChallengeLeaderboardBrowserProps {
  taskId: string;
  leaderboardPolicy: LeaderboardPolicy;
  submissions: ArenaSubmissionRecord[];
}

export function ChallengeLeaderboardBrowser({
  taskId,
  leaderboardPolicy,
  submissions,
}: ChallengeLeaderboardBrowserProps) {
  const [selectedType, setSelectedType] = useState<ChallengeLeaderboardType>('main');
  const [selectedMethod, setSelectedMethod] = useState<ControllerMethod | undefined>();
  const [selectedMetricId, setSelectedMetricId] = useState<string | undefined>();
  const viewModel = useMemo(() => getChallengeLeaderboardBrowserViewModel({
    taskId,
    submissions,
    selectedType,
    selectedMethod,
    selectedMetricId,
    leaderboardPolicyId: leaderboardPolicy.id,
  }), [leaderboardPolicy.id, selectedMethod, selectedMetricId, selectedType, submissions, taskId]);

  const current = viewModel.current;

  return (
    <section className="mt-6 border-t border-border/70 pt-5">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-base font-semibold text-foreground">当前榜单</h3>
        <span className="rounded-full border border-border/70 px-2 py-1 text-xs text-subtle">
          {current.entries.length} 条记录
        </span>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2">
        {viewModel.categories.map((category) => (
          <button
            key={category.type}
            type="button"
            onClick={() => setSelectedType(category.type)}
            className={[
              'rounded-lg border px-3 py-2 text-sm font-medium transition',
              category.type === viewModel.selectedType
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border/70 bg-background/70 text-foreground hover:border-primary/40',
            ].join(' ')}
          >
            {category.label}
          </button>
        ))}
      </div>

      {current.subOptions.length > 0 ? (
        <SubSelector
          options={current.subOptions}
          selectedId={current.selectedSubId}
          onSelect={(id) => {
            if (current.type === 'method') setSelectedMethod(id as ControllerMethod);
            if (current.type === 'metric') setSelectedMetricId(id);
          }}
        />
      ) : null}

      <div className="mt-4 overflow-hidden rounded-lg border border-border/70">
        {current.entries.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="bg-muted/45 text-xs text-subtle">
                <tr>
                  <th className="px-3 py-2 font-medium">排名</th>
                  <th className="px-3 py-2 font-medium">姓名</th>
                  <th className="px-3 py-2 font-medium">学号</th>
                  <th className="px-3 py-2 font-medium">方法</th>
                  <th className="px-3 py-2 font-medium">得分</th>
                  <th className="px-3 py-2 font-medium">具体指标</th>
                  <th className="px-3 py-2 font-medium">提交时间</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60 bg-background/50">
                {current.entries.map((entry) => (
                  <tr key={entry.submissionId}>
                    <td className="px-3 py-3 font-semibold text-primary">#{entry.rank}</td>
                    <td className="px-3 py-3 font-medium text-foreground">{entry.studentName}</td>
                    <td className="px-3 py-3 text-subtle">{entry.studentNumberLabel}</td>
                    <td className="px-3 py-3 text-subtle">{entry.methodLabel}</td>
                    <td className="px-3 py-3 font-medium text-foreground">{entry.score.toFixed(1)}</td>
                    <td className="px-3 py-3 text-subtle">
                      <div className="flex flex-wrap gap-1.5">
                        {entry.metrics.map((metric) => (
                          <span key={metric.id} className="rounded-full border border-border/70 bg-card px-2 py-1 text-xs">
                            {metric.label} {formatMetricValue(metric.value, metric.unit)}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-3 py-3 text-subtle">{formatSubmittedAt(entry.submittedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="bg-background/50 px-4 py-6 text-sm text-subtle">{current.emptyMessage}</div>
        )}
      </div>
    </section>
  );
}

function SubSelector({
  options,
  selectedId,
  onSelect,
}: {
  options: ChallengeLeaderboardOption[];
  selectedId?: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          onClick={() => onSelect(option.id)}
          className={[
            'rounded-full border px-3 py-1.5 text-xs font-medium transition',
            option.id === selectedId
              ? 'border-primary bg-primary/12 text-primary'
              : 'border-border/70 bg-background/70 text-subtle hover:border-primary/40 hover:text-foreground',
          ].join(' ')}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function formatMetricValue(value: number | undefined, unit?: string): string {
  if (!Number.isFinite(value)) return '暂无';
  const formatted = Math.abs(value as number) >= 100 ? (value as number).toFixed(0) : (value as number).toFixed(3).replace(/\.?0+$/, '');
  return `${formatted}${unit ?? ''}`;
}

function formatSubmittedAt(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}
