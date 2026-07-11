'use client';

import Link from 'next/link';
import { useState, useCallback, useEffect, useRef } from 'react';
import { Loader2, Send, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';

import type { ArenaWorkbenchContext, ArenaWorkbenchPreviewSummary } from '@/features/arena/domain';
import type { CorrectionState } from './model';
import { buildArenaArtifactFromMultiRepresentationState } from '@/features/arena/workbench/artifact-mappers';
import type { ArenaEvaluationResult } from '@/features/arena/evaluation/types';
import { scoreMetricSatisfaction } from '@/features/arena/evaluation/scoring';
import type { MetricDefinition } from '@/features/arena/types';
import {
  formatArenaHardConstraint,
  formatArenaMetric,
} from '@/features/arena/display-labels';
import { useArenaOfficialSubmissionPathSync } from '@/features/arena/arena-official-submission-sync';

interface ArenaSubmitPanelProps {
  arenaContext: ArenaWorkbenchContext;
  previewSummary?: ArenaWorkbenchPreviewSummary | null;
  correctionState: CorrectionState;
  isLockedByChallenge: boolean;
  gain: number;
  publicationId?: string;
}

export type OfficialSubmissionMetricStatus = 'reached' | 'close' | 'failed' | 'unavailable';

export interface OfficialSubmissionMetricRow {
  id: string;
  label: string;
  actualText: string;
  targetText: string;
  unacceptableText: string;
  satisfactionText: string;
  status: OfficialSubmissionMetricStatus;
  statusLabel: string;
}

export interface OfficialSubmissionScoreSummary {
  hardConstraintLabel: string;
  baseScore: number;
  penaltyScore: number;
  finalScore: number;
}

interface OfficialSubmissionResultState {
  evaluation: ArenaEvaluationResult;
  isLate: boolean;
}

const officialMetricStatusLabels: Record<OfficialSubmissionMetricStatus, string> = {
  reached: '已达标',
  close: '接近目标',
  failed: '未达标',
  unavailable: '待计算',
};

const officialMetricStatusClasses: Record<OfficialSubmissionMetricStatus, string> = {
  reached: 'border-emerald-500/40 bg-emerald-50 text-emerald-800 dark:border-emerald-400/40 dark:bg-emerald-500/10 dark:text-emerald-200',
  close: 'border-amber-500/40 bg-amber-50 text-amber-800 dark:border-amber-400/40 dark:bg-amber-500/10 dark:text-amber-200',
  failed: 'border-red-500/40 bg-red-50 text-red-800 dark:border-red-400/40 dark:bg-red-500/10 dark:text-red-200',
  unavailable: 'border-border/60 bg-muted/40 text-muted-foreground dark:border-border/50 dark:bg-muted/20',
};

function formatOfficialMetricValue(value: number | null | undefined, unit = '', unavailableText = '无有效值') {
  return Number.isFinite(value) ? `${Number(value).toFixed(3)}${unit}` : unavailableText;
}

function formatMetricTarget(metric: MetricDefinition) {
  const value = formatOfficialMetricValue(metric.idealValue, metric.unit);
  if (metric.direction === 'maximize') return `目标 ≥ ${value}`;
  if (metric.direction === 'target') return `目标 = ${value}`;
  return `目标 ≤ ${value}`;
}

function formatMetricUnacceptable(metric: MetricDefinition) {
  const value = formatOfficialMetricValue(metric.unacceptableValue, metric.unit);
  if (metric.direction === 'maximize') return `不可接受 ≤ ${value}`;
  if (metric.direction === 'target') return `不可接受偏离至 ${value}`;
  return `不可接受 ≥ ${value}`;
}

function metricStatusFromSatisfaction(value: number | null | undefined): OfficialSubmissionMetricStatus {
  if (!Number.isFinite(value)) return 'unavailable';
  if (Number(value) < 0.6) return 'failed';
  if (Number(value) < 0.98) return 'close';
  return 'reached';
}

function getScoringMetricDefinitions(metrics: MetricDefinition[], primaryMetricIds?: string[]) {
  if (!primaryMetricIds?.length) return metrics;
  const primaryIds = new Set(primaryMetricIds);
  const selected = metrics.filter((metric) => primaryIds.has(metric.id));
  return selected.length ? selected : metrics;
}

export function buildOfficialSubmissionMetricRows(
  result: ArenaEvaluationResult,
  metrics: MetricDefinition[],
): OfficialSubmissionMetricRow[] {
  return metrics.map((metric) => {
    const satisfaction = result.satisfaction[metric.id];
    const status = metricStatusFromSatisfaction(satisfaction);
    return {
      id: metric.id,
      label: formatArenaMetric(metric.id, metric),
      actualText: formatOfficialMetricValue(result.metrics[metric.id], metric.unit, '暂不可计算'),
      targetText: formatMetricTarget(metric),
      unacceptableText: formatMetricUnacceptable(metric),
      satisfactionText: Number.isFinite(satisfaction) ? `${Math.round(Number(satisfaction) * 100)}%` : '待计算',
      status,
      statusLabel: officialMetricStatusLabels[status],
    };
  });
}

export function buildOfficialSubmissionPreviewMetricRows(
  previewSummary: ArenaWorkbenchPreviewSummary,
  metrics: MetricDefinition[],
): OfficialSubmissionMetricRow[] {
  const metricDefinitions = new Map(metrics.map((metric) => [metric.id, metric]));
  return previewSummary.metrics.map((previewMetric) => {
    const metric = metricDefinitions.get(previewMetric.id);
    const status = metricStatusFromSatisfaction(previewMetric.satisfaction);
    return {
      id: previewMetric.id,
      label: metric ? formatArenaMetric(metric.id, metric) : previewMetric.label,
      actualText: formatOfficialMetricValue(
        previewMetric.value,
        metric?.unit ?? previewMetric.unit,
        '暂不可计算',
      ),
      targetText: metric ? formatMetricTarget(metric) : '目标暂不可用',
      unacceptableText: metric ? formatMetricUnacceptable(metric) : '阈值暂不可用',
      satisfactionText: Number.isFinite(previewMetric.satisfaction)
        ? `${Math.round(Number(previewMetric.satisfaction) * 100)}%`
        : '待计算',
      status,
      statusLabel: officialMetricStatusLabels[status],
    };
  });
}

function OfficialSubmissionMetricRows({
  rows,
  actualLabel,
}: {
  rows: OfficialSubmissionMetricRow[];
  actualLabel: string;
}) {
  return (
    <div className="grid gap-2 text-xs sm:grid-cols-2">
      {rows.map((row) => (
        <div key={row.id} className="rounded-md border border-border/60 px-3 py-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-medium text-foreground">{row.label}</span>
            <span className={`rounded-md border px-2 py-0.5 ${officialMetricStatusClasses[row.status]}`}>
              {row.statusLabel}
            </span>
          </div>
          <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1">
            <div>
              <dt className="text-muted-foreground">{actualLabel}</dt>
              <dd className="tabular-nums">{row.actualText}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">达标度</dt>
              <dd className="tabular-nums">{row.satisfactionText}</dd>
            </div>
            <div className="col-span-2">
              <dt className="text-muted-foreground">目标</dt>
              <dd>{row.targetText}</dd>
            </div>
            <div className="col-span-2">
              <dt className="text-muted-foreground">不可接受阈值</dt>
              <dd>{row.unacceptableText}</dd>
            </div>
          </dl>
        </div>
      ))}
    </div>
  );
}

export function buildOfficialSubmissionScoreSummary(
  result: ArenaEvaluationResult,
  metrics: MetricDefinition[],
  primaryMetricIds?: string[],
): OfficialSubmissionScoreSummary {
  const scoringMetrics = getScoringMetricDefinitions(metrics, primaryMetricIds);
  const weights = Object.fromEntries(scoringMetrics.map((metric) => [metric.id, 1]));
  const baseScore = result.valid ? scoreMetricSatisfaction(result.satisfaction, weights) : 0;
  const penaltyScore = result.penalties.reduce((sum, penalty) => sum + penalty.value, 0);
  return {
    hardConstraintLabel: result.valid ? '硬约束已通过' : '硬约束未通过',
    baseScore,
    penaltyScore,
    finalScore: result.score,
  };
}

function isRawEnglishEvaluatorLine(line: string) {
  return /[A-Za-z]/.test(line) && !/[\u3400-\u9fff]/.test(line);
}

export function sanitizeOfficialEvaluationExplanation(
  result: ArenaEvaluationResult,
  metrics: MetricDefinition[],
  primaryMetricIds?: string[],
  isLate = false,
): string[] {
  const visibleLines = result.explanation.filter((line) => line.trim() && !isRawEnglishEvaluatorLine(line));
  if (isLate) {
    const latePrefix = result.valid
      ? '硬约束已通过，但本次提交已超过截止时间，保留为复盘证据，未进入正式排名。'
      : '硬约束未全部通过，且本次提交已超过截止时间，保留为复盘证据，未进入正式排名。';
    return [
      latePrefix,
      ...visibleLines.filter((line) => !line.includes('提交进入正式排名')),
    ];
  }
  if (result.valid && result.score === 0) {
    const scoringMetrics = getScoringMetricDefinitions(metrics, primaryMetricIds);
    const zeroMetrics = scoringMetrics
      .filter((metric) => (result.satisfaction[metric.id] ?? 0) <= 0)
      .map((metric) => formatArenaMetric(metric.id, metric));
    if (zeroMetrics.length > 0) {
      visibleLines.unshift(`硬约束已通过，但排名分为 0：评分聚合中存在达标度为 0 的排名指标，主要受 ${zeroMetrics.join('、')} 影响，因此最终分归零。`);
    } else if (result.penalties.length > 0) {
      visibleLines.unshift('硬约束已通过，但最终分为 0：排名基础分被惩罚项扣减至 0，请对照基础分、惩罚和各项实际指标。');
    } else {
      visibleLines.unshift('硬约束已通过，但排名分为 0：评分聚合后的排名分未形成有效得分，请对照各项实际指标与目标差距。');
    }
  }
  if (visibleLines.length) return visibleLines;
  return [result.valid ? '官方评测完成。' : '硬约束未全部通过，提交未进入正式排名。'];
}

export function ArenaSubmitPanel({
  arenaContext,
  previewSummary,
  correctionState,
  isLockedByChallenge,
  gain,
  publicationId,
}: ArenaSubmitPanelProps) {
  const pathSync = useArenaOfficialSubmissionPathSync(arenaContext.task.id);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<OfficialSubmissionResultState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const submitInFlightRef = useRef(false);
  const submitAbortRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      submitAbortRef.current?.abort();
    };
  }, []);

  const buildResult = buildArenaArtifactFromMultiRepresentationState({
    task: arenaContext.task,
    correctionState,
    gain,
  });

  const canSubmit = isLockedByChallenge && buildResult.artifact !== null && !submitting;
  const previewMetricRows = previewSummary
    ? buildOfficialSubmissionPreviewMetricRows(previewSummary, arenaContext.metricProfile.rankingMetrics)
    : [];
  const evaluationResult = result?.evaluation ?? null;
  const metricRows = result
    ? buildOfficialSubmissionMetricRows(result.evaluation, arenaContext.metricProfile.rankingMetrics)
    : [];
  const scoreSummary = result
    ? buildOfficialSubmissionScoreSummary(
        result.evaluation,
        arenaContext.metricProfile.rankingMetrics,
        arenaContext.task.primaryMetrics,
      )
    : null;
  const visibleExplanation = result
    ? sanitizeOfficialEvaluationExplanation(
        result.evaluation,
        arenaContext.metricProfile.rankingMetrics,
        arenaContext.task.primaryMetrics,
        result.isLate,
      )
    : [];

  const handleSubmit = useCallback(async () => {
    if (!buildResult.artifact || submitInFlightRef.current) return;
    submitInFlightRef.current = true;
    const abortController = new AbortController();
    submitAbortRef.current = abortController;
    setSubmitting(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch('/api/arena/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: abortController.signal,
        body: publicationId
          ? JSON.stringify({
              taskId: arenaContext.task.id,
              artifact: buildResult.artifact,
              publicationId,
            })
          : JSON.stringify({
              taskId: arenaContext.task.id,
              artifact: buildResult.artifact,
            }),
      });

      const data = await response.json();
      if (!response.ok) {
        if (mountedRef.current) setError(data.error ?? '提交失败');
        return;
      }
      if (mountedRef.current) {
        setResult(data.submission?.evaluation
          ? {
            evaluation: data.submission.evaluation,
            isLate: Boolean(data.submission.isLate),
          }
          : null);
      }
      if (data.submission?.id) {
        await pathSync.synchronize(data.submission.id);
      }
    } catch (caught) {
      if (caught instanceof DOMException && caught.name === 'AbortError') return;
      if (mountedRef.current) setError('网络请求失败，请检查连接后重试。');
    } finally {
      submitInFlightRef.current = false;
      if (submitAbortRef.current === abortController) submitAbortRef.current = null;
      if (mountedRef.current) setSubmitting(false);
    }
  }, [arenaContext.task.id, buildResult.artifact, pathSync, publicationId]);

  return (
    <div className="premium-lesson-panel px-5 py-4 mt-4">
      <div className="premium-lesson-kicker">竞技场官方提交</div>

      {!isLockedByChallenge && (
        <p className="mt-2 text-sm text-muted-foreground">
          当前为自由探索模式，无法提交官方评测。请从
          <Link href="/arena" className="underline mx-1">竞技场</Link>
          选择挑战后进入。
        </p>
      )}

      {isLockedByChallenge && buildResult.error && (
        <div className="mt-2 flex items-start gap-2 text-sm text-amber-700 dark:text-amber-400">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
          <div>
            <p>{buildResult.error}</p>
            {buildResult.unsupportedMethod && (
              <p className="mt-1 text-xs text-muted-foreground">
                可预评测，暂不可官方提交
              </p>
            )}
          </div>
        </div>
      )}

      {error && (
        <div className="mt-2 flex items-center gap-2 text-sm text-destructive">
          <XCircle className="h-4 w-4" />
          <span>{error}</span>
        </div>
      )}

      {pathSync.hasArenaPathContext && pathSync.state !== 'idle' ? (
        <div className="mt-2 flex flex-wrap items-center gap-2 text-sm" aria-live="polite">
          <span className={pathSync.state === 'failed' ? 'text-destructive' : 'text-muted-foreground'}>
            {pathSync.state === 'pending' ? '官方提交已创建，正在同步学习路径…' : null}
            {pathSync.state === 'succeeded' ? '官方提交已创建，学习路径已同步。' : null}
            {pathSync.state === 'failed' ? '官方提交已创建，但学习路径尚未同步，请重试。' : null}
          </span>
          {pathSync.state === 'failed' ? (
            <button
              type="button"
              onClick={() => void pathSync.retry()}
              disabled={pathSync.isSynchronizing}
              className="text-xs font-medium text-sky-600 underline disabled:opacity-50 dark:text-sky-400"
            >
              重试同步路径
            </button>
          ) : null}
        </div>
      ) : null}

      {previewMetricRows.length > 0 && (
        <section className="mt-3 space-y-2" aria-label="当前预评测指标">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold text-foreground">当前指标</h3>
              <p className="text-xs text-muted-foreground">根据当前工作台状态即时估算，正式成绩以提交后的官方评测为准。</p>
            </div>
            {previewSummary?.previewScore !== null && previewSummary?.previewScore !== undefined ? (
              <span className="rounded-md border border-sky-500/40 bg-sky-50 px-2 py-1 text-xs font-medium text-sky-800 dark:bg-sky-950/30 dark:text-sky-300">
                预评测分数 {previewSummary.previewScore.toFixed(1)}
              </span>
            ) : null}
          </div>
          <OfficialSubmissionMetricRows rows={previewMetricRows} actualLabel="当前值" />
        </section>
      )}

      {evaluationResult && (
        <div className="mt-3 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            {evaluationResult.valid
              ? <CheckCircle className="h-5 w-5 text-emerald-600" />
              : <XCircle className="h-5 w-5 text-destructive" />}
            <span className="font-semibold">
              {evaluationResult.valid ? `得分：${evaluationResult.score.toFixed(1)}` : '未通过硬约束'}
            </span>
            {scoreSummary ? (
              <span className={`rounded-md border px-2 py-1 text-xs ${
                evaluationResult.valid
                  ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200'
                  : 'border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-200'
              }`}
              >
                {scoreSummary.hardConstraintLabel}
              </span>
            ) : null}
          </div>

          {scoreSummary ? (
            <div className="grid gap-2 text-xs sm:grid-cols-3">
              <div className="rounded-md border border-border/60 px-2 py-1">
                <span className="text-muted-foreground">基础分</span>
                <span className="ml-2 font-semibold tabular-nums">{scoreSummary.baseScore.toFixed(1)}</span>
              </div>
              <div className="rounded-md border border-border/60 px-2 py-1">
                <span className="text-muted-foreground">惩罚</span>
                <span className="ml-2 font-semibold tabular-nums">{scoreSummary.penaltyScore.toFixed(1)}</span>
              </div>
              <div className="rounded-md border border-border/60 px-2 py-1">
                <span className="text-muted-foreground">最终分</span>
                <span className="ml-2 font-semibold tabular-nums">{scoreSummary.finalScore.toFixed(1)}</span>
              </div>
            </div>
          ) : null}

          {evaluationResult.valid && metricRows.length > 0 && (
            <section className="space-y-2" aria-label="官方评测指标">
              <h3 className="text-sm font-semibold text-foreground">官方评测结果</h3>
              <OfficialSubmissionMetricRows rows={metricRows} actualLabel="实际值" />
            </section>
          )}

          {evaluationResult.hardConstraintResults.length > 0 && (
            <ul className="space-y-1 text-xs text-muted-foreground">
              {evaluationResult.hardConstraintResults.map((hc) => (
                <li key={hc.id} className="flex items-center gap-1">
                  {hc.passed
                    ? <CheckCircle className="h-3 w-3 text-emerald-500" />
                    : <XCircle className="h-3 w-3 text-destructive" />}
                  {formatArenaHardConstraint(hc.id)}
                  {hc.reason && !isRawEnglishEvaluatorLine(hc.reason) ? <span className="text-destructive"> — {hc.reason}</span> : null}
                </li>
              ))}
            </ul>
          )}

          {visibleExplanation.map((line, i) => (
            <p key={i} className="text-xs text-muted-foreground">{line}</p>
          ))}

          <div className="flex gap-2 pt-1">
            <Link
              href={arenaContext.returnHref}
              className="text-xs text-sky-600 underline dark:text-sky-400"
            >
              返回挑战详情
            </Link>
            <Link
              href="/arena"
              className="text-xs text-sky-600 underline dark:text-sky-400"
            >
              查看榜单
            </Link>
          </div>
        </div>
      )}

      <div className="mt-3">
        <button
          type="button"
          disabled={!canSubmit || pathSync.isSynchronizing}
          onClick={handleSubmit}
          className="premium-lesson-action-tone premium-tone-cyan inline-flex items-center gap-2 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          {submitting ? '提交中……' : '提交官方评测'}
        </button>
        {!canSubmit && !submitting && isLockedByChallenge && (
          <p className="mt-1 text-xs text-muted-foreground">
            {buildResult.error ?? '请先配置控制器参数。'}
          </p>
        )}
      </div>
    </div>
  );
}
