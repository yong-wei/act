'use client';

import { useMemo, useState } from 'react';

import {
  type ChallengeLeaderboardBrowserData,
  type ChallengeLeaderboardCategoryModel,
  type ChallengeLeaderboardOption,
} from './leaderboards/leaderboard-service';
import type { ControllerMethod, LeaderboardType } from './types';

type ChallengeLeaderboardType = LeaderboardType;

interface ChallengeLeaderboardBrowserProps {
  browser: ChallengeLeaderboardBrowserData;
}

export function ChallengeLeaderboardBrowser({
  browser,
}: ChallengeLeaderboardBrowserProps) {
  const [selectedType, setSelectedType] = useState<ChallengeLeaderboardType>('main');
  const [selectedMethod, setSelectedMethod] = useState<ControllerMethod | undefined>(
    browser.methodOptions[0]?.id as ControllerMethod | undefined,
  );
  const [selectedMetricId, setSelectedMetricId] = useState<string | undefined>(browser.metricOptions[0]?.id);
  const current = useMemo(() => selectCurrentView(browser, selectedType, selectedMethod, selectedMetricId), [
    browser,
    selectedMethod,
    selectedMetricId,
    selectedType,
  ]);

  return (
    <section className="mt-6 border-t border-border/70 pt-5">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-base font-semibold text-foreground">当前榜单</h3>
        <span className="rounded-full border border-border/70 px-2 py-1 text-xs text-subtle">
          {current.entries.length} 条记录
        </span>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {browser.categories.map((category) => (
          <button
            key={category.type}
            type="button"
            onClick={() => {
              setSelectedType(category.type);
              if (category.type === 'method' && !selectedMethod) {
                setSelectedMethod(browser.methodOptions[0]?.id as ControllerMethod | undefined);
              }
              if (category.type === 'metric' && !selectedMetricId) {
                setSelectedMetricId(browser.metricOptions[0]?.id);
              }
            }}
            className={[
              'rounded-lg border px-3 py-2 text-sm font-medium transition',
              category.type === selectedType
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
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="bg-muted/45 text-xs text-subtle">
                <tr>
                  <th className="whitespace-nowrap px-3 py-2 font-medium">排名</th>
                  <th className="whitespace-nowrap px-3 py-2 font-medium">姓名 / 学号</th>
                  {current.showMethodColumn ? (
                    <th className="whitespace-nowrap px-3 py-2 font-medium">方法</th>
                  ) : null}
                  {current.showParetoColumn ? (
                    <th className="whitespace-nowrap px-3 py-2 font-medium">Pareto</th>
                  ) : null}
                  <th className="whitespace-nowrap px-3 py-2 font-medium">得分</th>
                  <th className="whitespace-nowrap px-3 py-2 font-medium">具体指标</th>
                  <th className="whitespace-nowrap px-3 py-2 font-medium">提交时间</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60 bg-background/50">
                {current.entries.map((entry) => (
                  <tr key={entry.submissionId}>
                    <td className="whitespace-nowrap px-3 py-3 font-semibold text-primary">#{entry.rank}</td>
                    <td className="whitespace-nowrap px-3 py-3">
                      <div className="font-medium text-foreground">{entry.studentName}</div>
                      <div className="mt-0.5 text-xs text-subtle">{entry.studentNumberLabel}</div>
                    </td>
                    {current.showMethodColumn ? (
                      <td className="whitespace-nowrap px-3 py-3 text-subtle">{entry.methodLabel}</td>
                    ) : null}
                    {current.showParetoColumn ? (
                      <td className="whitespace-nowrap px-3 py-3 text-subtle">
                        {entry.paretoTier ? `第 ${entry.paretoTier} 层` : '未分层'}
                        {typeof entry.dominanceCount === 'number' ? (
                          <span className="ml-1 text-xs">被支配 {entry.dominanceCount}</span>
                        ) : null}
                      </td>
                    ) : null}
                    <td className="whitespace-nowrap px-3 py-3 font-medium text-foreground">{entry.score.toFixed(1)}</td>
                    <td className="px-3 py-3 text-subtle">
                      <div className="flex flex-wrap gap-1.5">
                        {entry.metrics.map((metric) => (
                          <span key={metric.id} className="rounded-full border border-border/70 bg-card px-2 py-1 text-xs">
                            {metric.label} {formatMetricValue(metric.value, metric.unit)}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-subtle">{formatSubmittedAt(entry.submittedAt)}</td>
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

function selectCurrentView(
  browser: ChallengeLeaderboardBrowserData,
  selectedType: ChallengeLeaderboardType,
  selectedMethod?: ControllerMethod,
  selectedMetricId?: string,
): ChallengeLeaderboardCategoryModel {
  const selectedSubId = selectedType === 'method'
    ? selectedMethod
    : selectedType === 'metric'
      ? selectedMetricId
      : undefined;
  return browser.views.find((view) => view.type === selectedType && view.selectedSubId === selectedSubId)
    ?? browser.views.find((view) => view.type === selectedType)
    ?? browser.views[0]
    ?? {
      type: 'main',
      label: '主榜',
      subOptions: [],
      showMethodColumn: true,
      showParetoColumn: false,
      entries: [],
      metricColumns: [],
      emptyMessage: '当前还没有官方提交。',
    };
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
    timeZone: 'Asia/Shanghai',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}
