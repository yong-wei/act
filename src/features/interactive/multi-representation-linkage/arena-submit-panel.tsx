'use client';

import Link from 'next/link';
import { useState, useCallback } from 'react';
import { Loader2, Send, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';

import type { ArenaWorkbenchContext } from '@/features/arena/domain';
import type { CorrectionState } from './model';
import { buildArenaArtifactFromMultiRepresentationState } from '@/features/arena/workbench/artifact-mappers';
import type { ArenaEvaluationResult } from '@/features/arena/evaluation/types';
import {
  formatArenaHardConstraint,
  formatArenaMetric,
} from '@/features/arena/display-labels';

interface ArenaSubmitPanelProps {
  arenaContext: ArenaWorkbenchContext;
  correctionState: CorrectionState;
  isLockedByChallenge: boolean;
  gain: number;
  publicationId?: string;
}

export function ArenaSubmitPanel({
  arenaContext,
  correctionState,
  isLockedByChallenge,
  gain,
  publicationId,
}: ArenaSubmitPanelProps) {
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<ArenaEvaluationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const buildResult = buildArenaArtifactFromMultiRepresentationState({
    task: arenaContext.task,
    correctionState,
    gain,
  });

  const canSubmit = isLockedByChallenge && buildResult.artifact !== null && !submitting;
  const metricDefinitions = new Map(
    arenaContext.metricProfile.rankingMetrics.map((metric) => [metric.id, metric]),
  );

  const handleSubmit = useCallback(async () => {
    if (!buildResult.artifact) return;
    setSubmitting(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch('/api/arena/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
        setError(data.error ?? '提交失败');
        return;
      }
      setResult(data.submission?.evaluation ?? null);
    } catch {
      setError('网络请求失败，请检查连接后重试。');
    } finally {
      setSubmitting(false);
    }
  }, [arenaContext.task.id, buildResult.artifact, publicationId]);

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

      {result && (
        <div className="mt-3 space-y-2">
          <div className="flex items-center gap-2">
            {result.valid
              ? <CheckCircle className="h-5 w-5 text-emerald-600" />
              : <XCircle className="h-5 w-5 text-destructive" />}
            <span className="font-semibold">
              {result.valid ? `得分：${result.score.toFixed(1)}` : '未通过硬约束'}
            </span>
          </div>

          {result.valid && (
            <div className="grid grid-cols-2 gap-2 text-xs">
              {Object.entries(result.metrics).map(([key, value]) => (
                <div key={key} className="rounded border border-border/60 px-2 py-1">
                  <span className="text-muted-foreground">{formatArenaMetric(key, metricDefinitions.get(key))}：</span>{' '}
                  <span className="tabular-nums">{Number(value).toFixed(3)}</span>
                </div>
              ))}
            </div>
          )}

          {result.hardConstraintResults.length > 0 && (
            <ul className="space-y-1 text-xs text-muted-foreground">
              {result.hardConstraintResults.map((hc) => (
                <li key={hc.id} className="flex items-center gap-1">
                  {hc.passed
                    ? <CheckCircle className="h-3 w-3 text-emerald-500" />
                    : <XCircle className="h-3 w-3 text-destructive" />}
                  {formatArenaHardConstraint(hc.id)}
                  {hc.reason && <span className="text-destructive"> — {hc.reason}</span>}
                </li>
              ))}
            </ul>
          )}

          {result.explanation.map((line, i) => (
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
          disabled={!canSubmit}
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
