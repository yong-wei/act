'use client';

import { Loader2, RefreshCw, Sigma, TrendingUp } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import type {
  DiagnosisEvolutionApiItem,
  DiagnosisEvolutionPayload,
} from '@/features/teacher/diagnosis/public-api';
import {
  projectDiagnosisMetricEvolution,
  type DiagnosisEvolutionBoardModel,
  type MetricEvolutionSeries,
} from '@/features/teacher/diagnosis/application/project-report-evolution';

type EvolutionBoardState = 'loading' | 'ready' | 'error';

const EVOLUTION_TIME_FORMATTER = new Intl.DateTimeFormat('zh-CN', {
  month: 'short',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
  timeZone: 'Asia/Shanghai',
});

function formatEvolutionTime(iso: string): string {
  const date = new Date(iso);
  return Number.isFinite(date.getTime()) ? EVOLUTION_TIME_FORMATTER.format(date) : iso;
}

/**
 * 班级诊断报告演变板块（Issue #1963）。只消费生成时冻结的指标快照；
 * 相邻快照在范围/成员/口径/版本不一致时断开趋势并说明原因；不输出
 * 改善或恶化判断。仅进入交互式教师页面，不进入交付、打印、学生安
 * 全面或 PDF。
 */
export function DiagnosisReportEvolutionBoard({ classId }: { classId: string }) {
  const [state, setState] = useState<EvolutionBoardState>('loading');
  const [reports, setReports] = useState<DiagnosisEvolutionApiItem[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadEvolution = useCallback(async () => {
    setState('loading');
    setErrorMessage(null);
    try {
      const response = await fetch(
        `/api/teacher/classes/${encodeURIComponent(classId)}/diagnosis-reports/evolution?limit=6`,
      );
      const payload = await response.json().catch(() => null) as
        | (Partial<DiagnosisEvolutionPayload> & { error?: string })
        | null;
      if (!response.ok || !Array.isArray(payload?.reports)) {
        throw new Error(payload?.error || '诊断报告演变读取失败');
      }
      setReports(payload.reports);
      setState('ready');
    } catch (error) {
      setReports([]);
      setErrorMessage(error instanceof Error ? error.message : '诊断报告演变读取失败');
      setState('error');
    }
  }, [classId]);

  useEffect(() => {
    void loadEvolution();
  }, [loadEvolution]);

  const board = useMemo(() => projectDiagnosisMetricEvolution(reports), [reports]);

  return (
    <DiagnosisReportEvolutionBoardView
      state={state}
      board={board}
      errorMessage={errorMessage}
      onRefresh={() => void loadEvolution()}
    />
  );
}

export interface DiagnosisReportEvolutionBoardViewProps {
  state: EvolutionBoardState;
  board: DiagnosisEvolutionBoardModel;
  errorMessage?: string | null;
  onRefresh?: () => void;
}

export function DiagnosisReportEvolutionBoardView({
  state,
  board,
  errorMessage,
  onRefresh,
}: DiagnosisReportEvolutionBoardViewProps) {
  return (
    <section
      className="surface-card relative overflow-hidden border-violet-500/20"
      data-diagnosis-report-evolution-board
      data-evolution-state={state}
      data-evolution-snapshot-count={board.snapshots.length}
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-[radial-gradient(circle_at_top_left,rgba(139,92,246,0.12),transparent_60%)]" />
      <header className="relative flex flex-col gap-3 border-b border-border/70 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 flex-none items-center justify-center rounded-xl border border-violet-500/25 bg-violet-500/10 text-violet-600 dark:text-violet-300">
            <TrendingUp className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-violet-600 dark:text-violet-300">
              报告演变
            </p>
            <h3 className="mt-0.5 text-lg font-semibold text-foreground">班级学情指标演变</h3>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-subtle">
              数据来自历次报告生成时冻结的指标快照，不随当前数据重算；差值与趋势不代表教学成效判断。
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          disabled={state === 'loading'}
          className="btn-ghost-themed inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm disabled:cursor-wait disabled:opacity-60"
          data-evolution-refresh
        >
          {state === 'loading'
            ? <Loader2 className="h-4 w-4 animate-spin" />
            : <RefreshCw className="h-4 w-4" />}
          刷新演变
        </button>
      </header>

      {state === 'loading' ? (
        <p className="relative px-5 py-8 text-center text-sm text-subtle sm:px-6" data-evolution-loading>
          正在读取冻结的指标快照…
        </p>
      ) : null}
      {state === 'error' ? (
        <p className="relative px-5 py-8 text-center text-sm text-red-500 sm:px-6" data-evolution-error>
          {errorMessage || '诊断报告演变读取失败'}
        </p>
      ) : null}
      {state === 'ready' && board.snapshots.length === 0 ? (
        <p className="relative px-5 py-8 text-center text-sm text-subtle sm:px-6" data-evolution-empty>
          暂无可展示的报告演变：生成新的班级诊断报告后，这里会出现冻结的指标快照。
        </p>
      ) : null}
      {state === 'ready' && board.snapshots.length > 0 ? (
        <div className="relative flex flex-col gap-5 px-5 py-5 sm:px-6">
          <EvolutionDeltasLayer board={board} />
          <EvolutionTrendLayer board={board} />
          <EvolutionSnapshotListLayer board={board} />
        </div>
      ) : null}
    </section>
  );
}

function EvolutionDeltasLayer({ board }: { board: DiagnosisEvolutionBoardModel }) {
  const latestBreak = board.breaks.find((breakEntry) => breakEntry.newerReportId === board.latestReportId);
  return (
    <div data-evolution-deltas-layer>
      <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <Sigma className="h-4 w-4 text-violet-500" />
        本次相对上次关键差值
      </p>
      {board.previousComparableReportId && board.deltas.length > 0 ? (
        <ul className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3" data-evolution-delta-list>
          {board.deltas.map((delta) => (
            <li
              key={delta.key}
              className="flex items-baseline justify-between gap-3 rounded-lg border border-border/70 bg-background/40 px-3 py-2"
              data-evolution-delta-key={delta.key}
            >
              <span className="min-w-0 truncate text-sm text-subtle">{delta.label}</span>
              <span className="flex flex-none items-baseline gap-2">
                <span className="text-sm text-foreground">
                  {delta.previousValue.toFixed(2).replace(/\.?0+$/, '')}
                  <span className="mx-1 text-subtle">→</span>
                  {delta.currentValue.toFixed(2).replace(/\.?0+$/, '')}
                </span>
                <span
                  className="rounded px-1.5 py-0.5 font-mono text-xs"
                  data-evolution-delta={delta.deltaDisplay}
                >
                  {delta.deltaDisplay}
                </span>
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-subtle" data-evolution-deltas-unavailable>
          {latestBreak
            ? `与上一份报告不可比：${latestBreak.reasonLabel}。`
            : '暂无可比差值：需要相邻两份指标口径一致的报告。'}
        </p>
      )}
    </div>
  );
}

const TREND_WIDTH = 560;
const TREND_HEIGHT = 168;
const TREND_PADDING = { top: 14, right: 14, bottom: 26, left: 46 };

function EvolutionTrendLayer({ board }: { board: DiagnosisEvolutionBoardModel }) {
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const series = board.series;
  const selected = series.find((entry) => entry.key === selectedKey) ?? series[0] ?? null;
  const breakLabels = [...new Set(board.breaks.map((breakEntry) => breakEntry.reasonLabel))];

  return (
    <div data-evolution-trend-layer>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <TrendingUp className="h-4 w-4 text-violet-500" />
          单指标趋势
        </p>
        {series.length > 0 ? (
          <label className="flex items-center gap-2 text-sm text-subtle">
            指标
            <select
              value={selected?.key ?? ''}
              onChange={(event) => setSelectedKey(event.target.value)}
              className="rounded-lg border border-border bg-background px-2 py-1.5 text-sm text-foreground"
              data-evolution-series-select
            >
              {series.map((entry) => (
                <option key={entry.key} value={entry.key}>{entry.label}</option>
              ))}
            </select>
          </label>
        ) : null}
      </div>
      {selected ? (
        <div className="mt-3 overflow-x-auto rounded-lg border border-border/70 bg-background/40 p-3">
          <svg
            role="img"
            aria-label={`${selected.label}趋势图`}
            viewBox={`0 0 ${TREND_WIDTH} ${TREND_HEIGHT}`}
            className="h-44 w-full min-w-[22rem]"
            data-evolution-series-key={selected.key}
          >
            <TrendChart series={selected} />
          </svg>
        </div>
      ) : (
        <p className="mt-3 text-sm text-subtle" data-evolution-trend-empty>
          暂无可展示的指标趋势：现有快照还没有可用指标。
        </p>
      )}
      {breakLabels.length > 0 ? (
        <ul className="mt-2 flex flex-col gap-1" data-evolution-break-list>
          {board.breaks.map((breakEntry) => (
            <li
              key={`${breakEntry.olderReportId}:${breakEntry.newerReportId}`}
              className="flex items-center gap-2 text-xs text-subtle"
              data-evolution-break={breakEntry.reason}
            >
              <span className="inline-block h-1.5 w-1.5 flex-none rounded-full bg-violet-400" />
              {formatEvolutionTime(
                board.snapshots.find((snapshot) => snapshot.reportId === breakEntry.newerReportId)?.generatedAt ?? '',
              )}
              ：{breakEntry.reasonLabel}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function TrendChart({ series }: { series: MetricEvolutionSeries }) {
  const points = series.points;
  const values = points.map((point) => point.value).filter((value): value is number => value !== null);
  const plotWidth = TREND_WIDTH - TREND_PADDING.left - TREND_PADDING.right;
  const plotHeight = TREND_HEIGHT - TREND_PADDING.top - TREND_PADDING.bottom;
  const rawMin = values.length > 0 ? Math.min(...values) : 0;
  const rawMax = values.length > 0 ? Math.max(...values) : 1;
  const spread = rawMax === rawMin ? 1 : rawMax - rawMin;
  const minY = rawMin - spread * 0.1;
  const maxY = rawMax + spread * 0.1;
  const xFor = (index: number) => (
    TREND_PADDING.left + (points.length <= 1 ? plotWidth / 2 : (plotWidth * index) / (points.length - 1))
  );
  const yFor = (value: number) => (
    TREND_PADDING.top + plotHeight - ((value - minY) / (maxY - minY)) * plotHeight
  );
  const segments: Array<Array<{ x: number; y: number }>> = [];
  let currentSegment: Array<{ x: number; y: number }> = [];
  points.forEach((point, index) => {
    if (point.value === null) {
      if (currentSegment.length > 0) segments.push(currentSegment);
      currentSegment = [];
      return;
    }
    const coordinate = { x: xFor(index), y: yFor(point.value) };
    if (point.connectedToPrevious && currentSegment.length > 0) {
      currentSegment.push(coordinate);
    } else {
      if (currentSegment.length > 0) segments.push(currentSegment);
      currentSegment = [coordinate];
    }
  });
  if (currentSegment.length > 0) segments.push(currentSegment);
  const gridValues = [minY, (minY + maxY) / 2, maxY];

  return (
    <>
      {gridValues.map((value) => (
        <g key={value}>
          <line
            x1={TREND_PADDING.left}
            x2={TREND_WIDTH - TREND_PADDING.right}
            y1={yFor(value)}
            y2={yFor(value)}
            className="stroke-border"
            strokeWidth={1}
          />
          <text
            x={TREND_PADDING.left - 6}
            y={yFor(value) + 4}
            textAnchor="end"
            className="fill-current text-[10px] text-subtle"
          >
            {value.toFixed(1)}
          </text>
        </g>
      ))}
      {segments.map((segment, segmentIndex) => (
        <polyline
          key={segmentIndex}
          points={segment.map((coordinate) => `${coordinate.x},${coordinate.y}`).join(' ')}
          fill="none"
          className="stroke-violet-500"
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      ))}
      {points.map((point, index) => (
        <g key={point.reportId}>
          {point.value === null ? (
            <text
              x={xFor(index)}
              y={TREND_PADDING.top + plotHeight / 2}
              textAnchor="middle"
              className="fill-current text-[10px] text-subtle"
              data-evolution-point-unavailable={point.reportId}
            >
              无数据
            </text>
          ) : (
            <circle
              cx={xFor(index)}
              cy={yFor(point.value)}
              r={3.5}
              className="fill-violet-500"
              data-evolution-point-value={point.value}
            />
          )}
          <text
            x={xFor(index)}
            y={TREND_HEIGHT - 8}
            textAnchor="middle"
            className="fill-current text-[10px] text-subtle"
          >
            {formatEvolutionTime(point.generatedAt)}
          </text>
        </g>
      ))}
    </>
  );
}

function EvolutionSnapshotListLayer({ board }: { board: DiagnosisEvolutionBoardModel }) {
  const snapshotsNewestFirst = [...board.snapshots].reverse();
  return (
    <div data-evolution-snapshot-list-layer>
      <p className="text-sm font-semibold text-foreground">最近 {board.snapshots.length} 次快照明细</p>
      <ul className="mt-3 flex flex-col divide-y divide-border/60" data-evolution-snapshot-list>
        {snapshotsNewestFirst.map((snapshot, index) => (
          <li
            key={snapshot.reportId}
            className="flex flex-wrap items-center gap-x-4 gap-y-1 py-2 text-sm"
            data-evolution-snapshot-item={snapshot.reportId}
            data-evolution-snapshot-historical-unavailable={snapshot.historicalUnavailable ? 'true' : 'false'}
          >
            <span className="w-14 flex-none font-mono text-xs text-subtle">#{snapshotsNewestFirst.length - index}</span>
            <span className="text-foreground">生成 {formatEvolutionTime(snapshot.generatedAt)}</span>
            <span className="text-subtle">证据截止 {formatEvolutionTime(snapshot.evidenceCutoff)}</span>
            {snapshot.historicalUnavailable ? (
              <span
                className="rounded border border-border bg-background/60 px-1.5 py-0.5 text-xs text-subtle"
                data-evolution-historical-unavailable
              >
                历史指标不可用
              </span>
            ) : (
              <span className="text-subtle">纳入 {snapshot.memberCount ?? '—'} 人</span>
            )}
            {snapshot.schemaVersion && snapshot.computationVersion ? (
              <span className="font-mono text-xs text-subtle">
                {snapshot.schemaVersion} · {snapshot.computationVersion}
              </span>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
