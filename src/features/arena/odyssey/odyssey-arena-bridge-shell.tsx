'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { ArrowLeft, CheckCircle2, Trophy } from 'lucide-react';

import { arenaMethodLabels, formatArenaMetricGoal } from '../display-labels';
import type { ArenaSubmissionRecord } from '../submissions/submission-service';
import { resolveArenaWorkbenchContext } from '../workbench/context';

function formatScore(value: number | null | undefined): string {
  return typeof value === 'number' && Number.isFinite(value) ? value.toFixed(1) : '暂无';
}

const RETURN_CONTEXT_KEYS = ['publicationId', 'classId', 'seasonId'] as const;

export function buildOdysseyArenaReturnHref(
  baseHref: string,
  searchParams: Pick<URLSearchParams, 'get'>,
): string {
  const preservedParams = new URLSearchParams();
  for (const key of RETURN_CONTEXT_KEYS) {
    const value = searchParams.get(key)?.trim();
    if (value) {
      preservedParams.set(key, value);
    }
  }

  const query = preservedParams.toString();
  if (!query) return baseHref;
  return `${baseHref}${baseHref.includes('?') ? '&' : '?'}${query}`;
}

export function pickViewerBestSubmission(
  submissions: ArenaSubmissionRecord[],
  viewerUserId?: string,
): ArenaSubmissionRecord | null {
  if (!viewerUserId) return null;
  const visibleSubmissions = submissions.filter((submission) => submission.userId === viewerUserId);
  return visibleSubmissions.reduce<ArenaSubmissionRecord | null>((best, submission) => {
    const score = submission.evaluation?.score ?? null;
    const bestScore = best?.evaluation?.score ?? null;
    if (score === null) return best;
    if (bestScore === null || score > bestScore) return submission;
    return best;
  }, null);
}

export function OdysseyArenaBridgeShell() {
  const searchParams = useSearchParams();
  const arenaTaskId = searchParams.get('arenaTask');
  const publicationId = searchParams.get('publicationId')?.trim() || undefined;
  const arenaContext = useMemo(
    () => (arenaTaskId ? resolveArenaWorkbenchContext(arenaTaskId) : null),
    [arenaTaskId],
  );
  const returnHref = useMemo(
    () => (arenaContext ? buildOdysseyArenaReturnHref(arenaContext.returnHref, searchParams) : '#'),
    [arenaContext, searchParams],
  );
  const [submissions, setSubmissions] = useState<ArenaSubmissionRecord[] | null>(null);
  const [viewerUserId, setViewerUserId] = useState<string | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    setSubmissions(null);
    setViewerUserId(undefined);

    if (!arenaContext || arenaContext.recommendedWorkspaceMode !== 'control-odyssey') {
      return () => {
        cancelled = true;
      };
    }

    const submissionParams = new URLSearchParams({ taskId: arenaContext.task.id });
    if (publicationId) {
      submissionParams.set('publicationId', publicationId);
    }

    fetch(`/api/arena/submissions?${submissionParams.toString()}`, { cache: 'no-store' })
      .then(async (response) => {
        const payload = await response.json() as {
          submissions?: ArenaSubmissionRecord[];
          viewerUserId?: string;
        };
        if (!cancelled) {
          setSubmissions(response.ok ? payload.submissions ?? [] : []);
          setViewerUserId(response.ok ? payload.viewerUserId : undefined);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSubmissions([]);
          setViewerUserId(undefined);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [arenaContext, publicationId]);

  if (!arenaContext || arenaContext.recommendedWorkspaceMode !== 'control-odyssey') {
    return null;
  }

  const bestSubmission = submissions ? pickViewerBestSubmission(submissions, viewerUserId) : null;
  const methodLabels = arenaContext.allowedMethods.map((method) => arenaMethodLabels[method] ?? method).join('、');
  const metricGoals = arenaContext.metricProfile.rankingMetrics
    .map((metric) => `${metric.label}：${formatArenaMetricGoal(metric)}`)
    .join('；');

  return (
    <section className="border-b border-cyan-400/20 bg-slate-950 px-4 py-4 text-white shadow-lg shadow-cyan-950/20 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-2">
          <a
            href={returnHref}
            className="inline-flex items-center gap-2 text-xs font-medium text-cyan-200 hover:text-cyan-100"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            返回竞技场挑战详情
          </a>
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300/80">Arena 任务上下文</div>
            <h1 className="mt-1 text-xl font-semibold text-white">{arenaContext.task.title}</h1>
          </div>
          <div className="flex flex-wrap gap-2 text-xs text-slate-300">
            <span className="rounded-full border border-slate-700 px-3 py-1">允许方法：{methodLabels}</span>
            <span className="rounded-full border border-slate-700 px-3 py-1">评分口径：{arenaContext.metricProfile.name}</span>
            <span className="rounded-full border border-slate-700 px-3 py-1">返回路径：挑战详情</span>
          </div>
          <p className="max-w-4xl text-xs leading-5 text-slate-400">
            Odyssey 游戏积分保留在通关结算面板；Arena 官方评分只由通关遥测提交产生。{metricGoals}
          </p>
        </div>

        <div className="rounded-xl border border-cyan-400/20 bg-cyan-400/10 px-4 py-3 text-sm text-cyan-50">
          <div className="flex items-center gap-2 text-xs font-semibold text-cyan-200">
            <Trophy className="h-4 w-4" />
            Arena 官方评分
          </div>
          <div className="mt-1 text-2xl font-semibold">
            {submissions === null ? '加载中' : formatScore(bestSubmission?.evaluation?.score)}
          </div>
          <div className="mt-1 flex items-center gap-1 text-xs text-cyan-100/80">
            <CheckCircle2 className="h-3.5 w-3.5" />
            {bestSubmission ? '已有通关遥测提交' : '完成通关后自动提交'}
          </div>
        </div>
      </div>
    </section>
  );
}
