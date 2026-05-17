'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import 'katex/dist/katex.min.css';
import { InlineMath } from 'react-katex';

import {
  arenaMethodLabels,
  arenaWorkspaceLabels,
  formatArenaMetric,
} from '@/features/arena/display-labels';
import { ArenaWorkbenchSubmissionMount } from '@/features/arena/workbench/arena-workbench-submission-mount';
import type { ControlWorkbenchResolutionResult, WorkbenchSessionContext } from '../types';
import type { WorkbenchViewConfig, WorkbenchViewId } from '../contracts';
import {
  getPresetDefaultViewConfigs,
  getWorkbenchViewPlugin,
} from '../views';
import { ClassicFourViewPreset } from '../presets/classic-four-view-preset';
import { BlackBoxIdentificationPreset } from '../presets/blackbox-identification-preset';
import { CompositeControlPreset } from '../presets/composite-control-preset';
import { PredictiveControlPreset } from '../presets/predictive-control-preset';
import {
  getControlWorkbenchObjectGroups,
  selectControlWorkbenchObject,
  type WorkbenchObjectGroup,
  type WorkbenchObjectOption,
} from '../object-selection';

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
  if (!('taskId' in session)) return '/interactive-learning/cross-domain-exploration';
  if (!('publicationId' in session)) return `/arena/challenges/${session.taskId}`;

  const params = new URLSearchParams({ publicationId: session.publicationId });
  return `/arena/challenges/${session.taskId}?${params.toString()}`;
}

function keyedViewConfigs(configs: WorkbenchViewConfig[]) {
  return Object.fromEntries(configs.map((config) => [config.id, config])) as Partial<Record<WorkbenchViewId, WorkbenchViewConfig>>;
}

function objectOptionClass(option: WorkbenchObjectOption) {
  if (option.selected) {
    return 'border-cyan-600 bg-cyan-50 text-slate-950 shadow-sm dark:border-cyan-300 dark:bg-cyan-950/60 dark:text-cyan-50';
  }
  if (!option.compatible) {
    return 'border-amber-300 bg-amber-50 text-amber-950 hover:border-amber-500 dark:border-amber-400/30 dark:bg-amber-950/20 dark:text-amber-100';
  }
  return 'border-slate-200 bg-white text-slate-800 hover:border-cyan-500 hover:bg-cyan-50 dark:border-white/10 dark:bg-slate-950/50 dark:text-slate-100 dark:hover:border-cyan-300/80 dark:hover:bg-cyan-950/30';
}

function ObjectLabels({ labels }: { labels: WorkbenchObjectOption['labels'] }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {labels.map((label) => (
        <span
          key={`${label.label}:${label.value}`}
          className="inline-flex min-h-6 items-center rounded-md border border-slate-200 bg-slate-100 px-2 text-[11px] font-medium text-slate-700 dark:border-white/10 dark:bg-white/5 dark:text-slate-300"
          aria-label={`${label.label}：${label.value}`}
        >
          {label.value}
        </span>
      ))}
    </div>
  );
}

function WorkbenchObjectSelector({
  expanded,
  groups,
  onSelect,
  onToggle,
  selectionError,
}: {
  expanded: boolean;
  groups: WorkbenchObjectGroup[];
  onSelect: (objectId: string) => void;
  onToggle: () => void;
  selectionError: string | null;
}) {
  const selectedOption = groups.flatMap((group) => group.options).find((option) => option.selected);

  return (
    <section className="rounded-md border border-slate-200 bg-slate-50 p-3 text-slate-950 dark:border-white/10 dark:bg-slate-950/40 dark:text-slate-100" aria-label="对象选择">
      <button
        className="flex w-full items-start justify-between gap-3 text-left"
        type="button"
        aria-expanded={expanded}
        onClick={onToggle}
      >
        <span>
          <span className="block text-sm font-semibold">对象选择</span>
          <span className="mt-1 block text-xs text-slate-600 dark:text-slate-400">{selectedOption?.name ?? '未选择对象'}</span>
        </span>
        <span className="inline-flex h-7 min-w-7 items-center justify-center rounded-md border border-slate-200 text-sm text-slate-600 dark:border-white/10 dark:text-slate-300">
          {expanded ? '收' : '展'}
        </span>
      </button>
      {selectedOption ? (
        <div className="mt-3">
          <ObjectLabels labels={selectedOption.labels} />
        </div>
      ) : null}
      {selectionError ? (
        <p className="mt-3 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-400/30 dark:bg-amber-950/30 dark:text-amber-100" role="status">
          {selectionError}
        </p>
      ) : null}
      {expanded ? (
        <div className="mt-4 space-y-4">
          {groups.map((group) => (
            <div key={group.id} className="space-y-2">
              <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400">{group.label}</h3>
              <div className="grid gap-2">
                {group.options.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    aria-disabled={false}
                    data-incompatible={!option.compatible}
                    className={`rounded-md border p-3 text-left transition ${objectOptionClass(option)}`}
                    onClick={() => onSelect(option.id)}
                  >
                    <span className="flex items-start justify-between gap-2">
                      <span className="text-sm font-semibold">{option.name}</span>
                      {option.selected ? <span className="text-xs font-medium text-cyan-700 dark:text-cyan-200">当前</span> : null}
                    </span>
                    <span className="mt-2 block text-xs leading-6">
                      {option.modelLatex ? <InlineMath math={option.modelLatex} /> : option.modelDisplay}
                    </span>
                    <span className="mt-2 block">
                      <ObjectLabels labels={option.labels} />
                    </span>
                    {!option.compatible && option.disabledReason ? (
                      <span className="mt-2 block text-xs text-amber-700 dark:text-amber-200">{option.disabledReason}</span>
                    ) : null}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function ResolvedControlWorkbenchShell({ session: initialSession }: { session: WorkbenchSessionContext }) {
  const [session, setSession] = useState<WorkbenchSessionContext>(initialSession);
  const [objectSelectorExpanded, setObjectSelectorExpanded] = useState(false);
  const [objectSelectionError, setObjectSelectionError] = useState<string | null>(null);
  const defaultViewConfigs = useMemo(() => getPresetDefaultViewConfigs(session.defaultPreset), [session.defaultPreset]);
  const objectGroups = useMemo(() => getControlWorkbenchObjectGroups(session), [session]);
  const [viewConfigs, setViewConfigs] = useState(() => keyedViewConfigs(defaultViewConfigs));
  const taskTitle = 'task' in session ? session.task.title : '综合仿真工作台';
  const objectName = 'object' in session ? session.object.name : '未绑定官方对象';
  const workspaceLabel = 'recommendedWorkspaceMode' in session
    ? arenaWorkspaceLabels[session.recommendedWorkspaceMode]
    : '自由探索';
  const metricNames = 'metricProfile' in session
    ? session.metricProfile.rankingMetrics.map((metric) => formatArenaMetric(metric.id, metric)).join('、')
    : '本地观察指标';
  const showClassicPreset = session.defaultPreset === 'classic-whitebox';
  const showBlackBoxPreset = session.defaultPreset === 'blackbox-identification' && 'taskId' in session;
  const showCompositePreset = session.defaultPreset === 'composite-control' && 'taskId' in session;
  const showPredictivePreset = session.defaultPreset === 'predictive-control' && 'taskId' in session;
  const showArenaSubmissionMount = 'recommendedWorkspaceMode' in session
    && session.defaultPreset !== 'classic-whitebox'
    && session.defaultPreset !== 'blackbox-identification'
    && session.defaultPreset !== 'composite-control'
    && session.defaultPreset !== 'predictive-control';

  useEffect(() => {
    setSession(initialSession);
    setObjectSelectionError(null);
  }, [initialSession]);

  const selectObject = (objectId: string) => {
    const result = selectControlWorkbenchObject(session, objectId);
    setSession(result.session);
    setObjectSelectionError(result.error ?? null);
  };

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
              href={getControlWorkbenchReturnHref(session)}
            >
              返回跨域探索
            </Link>
          )}
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-4 px-6 py-6 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="rounded-lg border border-white/10 bg-slate-900/70 p-4">
          <WorkbenchObjectSelector
            expanded={objectSelectorExpanded}
            groups={objectGroups}
            onSelect={selectObject}
            onToggle={() => setObjectSelectorExpanded((current) => !current)}
            selectionError={objectSelectionError}
          />
          <h2 className="mt-5 text-base font-semibold">会话状态</h2>
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
              <h2 className="text-xl font-semibold">综合仿真工作台</h2>
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
                              type="checkbox"
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
              <ClassicFourViewPreset session={session} viewConfigs={viewConfigs} />
            </div>
          ) : null}
          {showBlackBoxPreset ? (
            <div className="mt-6">
              <BlackBoxIdentificationPreset session={session} viewConfigs={viewConfigs} />
            </div>
          ) : null}
          {showCompositePreset ? (
            <div className="mt-6">
              <CompositeControlPreset session={session} viewConfigs={viewConfigs} />
            </div>
          ) : null}
          {showPredictivePreset ? (
            <div className="mt-6">
              <PredictiveControlPreset session={session} viewConfigs={viewConfigs} />
            </div>
          ) : null}
          {showArenaSubmissionMount && 'recommendedWorkspaceMode' in session ? (
            <ArenaWorkbenchSubmissionMount
              workspaceMode={session.recommendedWorkspaceMode}
              className="mt-6"
            />
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
