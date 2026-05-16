import Link from 'next/link';

import {
  arenaMethodLabels,
  arenaWorkspaceLabels,
  formatArenaMetric,
} from '@/features/arena/display-labels';
import type { ControlWorkbenchResolutionResult, WorkbenchSessionContext } from '../types';

function methodText(methods: string[]) {
  return methods.map((method) => arenaMethodLabels[method as keyof typeof arenaMethodLabels] ?? method).join('、');
}

function modeLabel(mode: string) {
  if (mode === 'assignment') return '作业模式';
  if (mode === 'challenge') return '挑战模式';
  if (mode === 'odyssey') return '奥德赛模式';
  return '自由探索模式';
}

export function getControlWorkbenchReturnHref(session: WorkbenchSessionContext) {
  if (!('taskId' in session)) return '/arena';
  if (!('publicationId' in session)) return `/arena/challenges/${session.taskId}`;

  const params = new URLSearchParams({ publicationId: session.publicationId });
  return `/arena/challenges/${session.taskId}?${params.toString()}`;
}

export function ControlWorkbenchShell({ result }: { result: ControlWorkbenchResolutionResult }) {
  if (!result.ok) {
    return (
      <main className="min-h-screen bg-slate-950 px-6 py-10 text-slate-100">
        <div className="mx-auto max-w-5xl rounded-lg border border-red-400/40 bg-red-950/30 p-6">
          <p className="text-sm text-red-200">无法解析竞技场挑战</p>
          <h1 className="mt-2 text-2xl font-semibold">工作台上下文不可用</h1>
          <p className="mt-3 text-sm leading-6 text-red-100">{result.error.message}</p>
          <Link className="mt-5 inline-flex text-sm font-medium text-red-100 underline" href="/arena">
            返回竞技场大厅
          </Link>
        </div>
      </main>
    );
  }

  const { session } = result;
  const taskTitle = 'task' in session ? session.task.title : '自由探索工作台';
  const objectName = 'object' in session ? session.object.name : '未绑定官方对象';
  const workspaceLabel = 'recommendedWorkspaceMode' in session
    ? arenaWorkspaceLabels[session.recommendedWorkspaceMode]
    : '自由探索';
  const metricNames = 'metricProfile' in session
    ? session.metricProfile.rankingMetrics.map((metric) => formatArenaMetric(metric.id, metric)).join('、')
    : '本地观察指标';

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <section className="border-b border-white/10 bg-slate-900/80 px-6 py-5">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm text-cyan-200">{modeLabel(session.mode)} · {workspaceLabel}</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-normal">{taskTitle}</h1>
            <p className="mt-2 text-sm text-slate-300">对象：{objectName}</p>
          </div>
          {'taskId' in session ? (
            <Link
              className="inline-flex h-10 items-center justify-center rounded-md border border-white/15 px-4 text-sm text-slate-100 hover:bg-white/10"
              href={getControlWorkbenchReturnHref(session)}
            >
              返回挑战详情
            </Link>
          ) : (
            <Link
              className="inline-flex h-10 items-center justify-center rounded-md border border-white/15 px-4 text-sm text-slate-100 hover:bg-white/10"
              href="/arena"
            >
              返回竞技场大厅
            </Link>
          )}
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-4 px-6 py-6 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="rounded-lg border border-white/10 bg-slate-900/70 p-4">
          <h2 className="text-base font-semibold">会话状态</h2>
          <dl className="mt-4 space-y-3 text-sm">
            <div>
              <dt className="text-slate-400">允许方法</dt>
              <dd className="mt-1 text-slate-100">{methodText(session.allowedMethods)}</dd>
            </div>
            <div>
              <dt className="text-slate-400">指标</dt>
              <dd className="mt-1 text-slate-100">{metricNames}</dd>
            </div>
            <div>
              <dt className="text-slate-400">提交状态</dt>
              <dd className="mt-1 text-slate-100">
                {session.submissionPolicy.officialEvaluationEnabled
                  ? '可通过预设面板进入官方评价'
                  : session.submissionPolicy.disabledReason}
              </dd>
            </div>
            {'publicationId' in session ? (
              <div>
                <dt className="text-slate-400">作业发布</dt>
                <dd className="mt-1 text-slate-100">{session.publicationId}</dd>
              </div>
            ) : null}
          </dl>
        </aside>

        <div className="rounded-lg border border-white/10 bg-slate-900/60 p-6">
          <h2 className="text-xl font-semibold">工作台外壳</h2>
          {session.mode === 'explore' ? (
            <p className="mt-3 text-sm leading-6 text-slate-300">
              自由探索模式可用于本地建模和参数试验，但结果不进入官方评价和竞技场榜单。
            </p>
          ) : (
            <p className="mt-3 text-sm leading-6 text-slate-300">
              该页面已经解析竞技场任务、对象、指标、允许方法和提交策略。具体视图预设会在后续 change 中接入。
            </p>
          )}
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {session.allowedViews.map((viewId) => (
              <div key={viewId} className="rounded-md border border-white/10 bg-slate-950/50 p-3">
                <p className="text-sm font-medium text-slate-100">{viewId}</p>
                <p className="mt-1 text-xs text-slate-400">等待预设视图接入</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
