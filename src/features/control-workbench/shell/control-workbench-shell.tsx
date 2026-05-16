'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';

import {
  arenaMethodLabels,
  arenaWorkspaceLabels,
  formatArenaMetric,
} from '@/features/arena/display-labels';
import type { ControlWorkbenchResolutionResult, WorkbenchSessionContext } from '../types';
import type { WorkbenchViewConfig, WorkbenchViewId } from '../contracts';
import {
  getPresetDefaultViewConfigs,
  getWorkbenchViewPlugin,
} from '../views';
import { ClassicFourViewPreset } from '../presets/classic-four-view-preset';

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

function keyedViewConfigs(configs: WorkbenchViewConfig[]) {
  return Object.fromEntries(configs.map((config) => [config.id, config])) as Partial<Record<WorkbenchViewId, WorkbenchViewConfig>>;
}

function ResolvedControlWorkbenchShell({ session }: { session: WorkbenchSessionContext }) {
  const defaultViewConfigs = useMemo(() => getPresetDefaultViewConfigs(session.defaultPreset), [session.defaultPreset]);
  const [viewConfigs, setViewConfigs] = useState(() => keyedViewConfigs(defaultViewConfigs));
  const taskTitle = 'task' in session ? session.task.title : '自由探索工作台';
  const objectName = 'object' in session ? session.object.name : '未绑定官方对象';
  const workspaceLabel = 'recommendedWorkspaceMode' in session
    ? arenaWorkspaceLabels[session.recommendedWorkspaceMode]
    : '自由探索';
  const metricNames = 'metricProfile' in session
    ? session.metricProfile.rankingMetrics.map((metric) => formatArenaMetric(metric.id, metric)).join('、')
    : '本地观察指标';
  const showClassicPreset = session.defaultPreset === 'classic-whitebox' && 'taskId' in session;
  const resetViewConfig = (viewId: WorkbenchViewId) => {
    const fallback = defaultViewConfigs.find((config) => config.id === viewId);
    setViewConfigs((current) => ({
      ...current,
      [viewId]: fallback ? { ...fallback, selectedOptions: fallback.selectedOptions ? [...fallback.selectedOptions] : undefined } : undefined,
    }));
  };
  const toggleViewOption = (viewId: WorkbenchViewId, optionId: string) => {
    setViewConfigs((current) => {
      const currentConfig = current[viewId] ?? defaultViewConfigs.find((config) => config.id === viewId);
      const selected = new Set(currentConfig?.selectedOptions ?? []);
      if (selected.has(optionId)) {
        selected.delete(optionId);
      } else if (viewId === 'root-locus') {
        selected.clear();
        selected.add(optionId);
      } else {
        selected.add(optionId);
      }
      return {
        ...current,
        [viewId]: {
          ...(currentConfig ?? { id: viewId, title: viewId, enabled: true }),
          selectedOptions: Array.from(selected),
        },
      };
    });
  };

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
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold">工作台外壳</h2>
              <p className="mt-1 text-sm text-slate-400">视图配置保存在当前浏览器会话中。</p>
            </div>
            <button
              className="inline-flex h-9 items-center justify-center rounded-md border border-white/15 px-3 text-sm text-slate-100 hover:bg-white/10"
              type="button"
              onClick={() => setViewConfigs(keyedViewConfigs(defaultViewConfigs))}
            >
              重置默认
            </button>
          </div>
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
            {session.allowedViews.map((viewId) => {
              const plugin = getWorkbenchViewPlugin(viewId);
              const config = viewConfigs[viewId] ?? defaultViewConfigs.find((item) => item.id === viewId);
              const availability = plugin?.getAvailability(session) ?? { available: true };
              const options = plugin?.getOptions(session) ?? [];
              return (
                <div key={viewId} className="rounded-md border border-white/10 bg-slate-950/50 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium text-slate-100">{plugin?.title ?? config?.title ?? viewId}</p>
                      <p className="mt-1 text-xs text-slate-400">{availability.available ? '视图配置' : availability.reason}</p>
                    </div>
                    <button
                      className="shrink-0 text-xs text-cyan-200 underline-offset-4 hover:underline"
                      type="button"
                      onClick={() => resetViewConfig(viewId)}
                    >
                      重置默认
                    </button>
                  </div>
                  {options.length ? (
                    <div className="mt-3 space-y-2">
                      {options.map((option) => {
                        const selected = Boolean(config?.selectedOptions?.includes(option.id));
                        return (
                          <label key={option.id} className="flex gap-2 text-xs text-slate-300">
                            <input
                              checked={selected && option.enabled}
                              className="mt-0.5"
                              disabled={!availability.available || !option.enabled}
                              onChange={() => toggleViewOption(viewId, option.id)}
                              type={viewId === 'root-locus' ? 'radio' : 'checkbox'}
                            />
                            <span>
                              <span className={option.enabled && availability.available ? 'text-slate-100' : 'text-slate-500'}>
                                {option.label}
                              </span>
                              {!option.enabled && option.disabledReason ? (
                                <span className="mt-0.5 block text-slate-500">{option.disabledReason}</span>
                              ) : null}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="mt-3 text-xs text-slate-400">等待预设视图接入</p>
                  )}
                </div>
              );
            })}
          </div>
          {showClassicPreset ? (
            <div className="mt-6">
              <ClassicFourViewPreset session={session} />
            </div>
          ) : null}
        </div>
      </section>
    </main>
  );
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

  return <ResolvedControlWorkbenchShell session={result.session} />;
}
