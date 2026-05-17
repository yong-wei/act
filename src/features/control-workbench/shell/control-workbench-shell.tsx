'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import 'katex/dist/katex.min.css';
import { InlineMath } from 'react-katex';
import { Plus, Settings2, X } from 'lucide-react';

import {
  arenaMethodLabels,
  arenaWorkspaceLabels,
  formatArenaMetric,
} from '@/features/arena/display-labels';
import { ArenaWorkbenchSubmissionMount } from '@/features/arena/workbench/arena-workbench-submission-mount';
import type { ControlWorkbenchResolutionResult, WorkbenchSessionContext } from '../types';
import type { WorkbenchViewConfig, WorkbenchViewId } from '../contracts';
import {
  buildDefaultWorkbenchPanelInstances,
  buildWorkbenchPanelInstance,
  getPresetDefaultViewConfigs,
  getWorkbenchViewPlugin,
  keyedViewConfigsFromPanels,
  toggleWorkbenchPanelOption,
  type WorkbenchPanelInstance,
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

function isSingleSelectionView(viewId: WorkbenchViewId) {
  return viewId === 'root-locus' || viewId === 'nyquist';
}

export function getControlWorkbenchReturnHref(session: WorkbenchSessionContext) {
  if (!('taskId' in session)) return '/interactive-learning/cross-domain-exploration';
  if (!('publicationId' in session)) return `/arena/challenges/${session.taskId}`;

  const params = new URLSearchParams({ publicationId: session.publicationId });
  return `/arena/challenges/${session.taskId}?${params.toString()}`;
}

function createFallbackPanelConfig(
  viewId: WorkbenchViewId,
  session: WorkbenchSessionContext,
): WorkbenchViewConfig | null {
  const plugin = getWorkbenchViewPlugin(viewId);
  if (!plugin) return null;
  const selectedOptions = plugin.getOptions(session)
    .filter((option) => option.enabled)
    .slice(0, isSingleSelectionView(viewId) ? 1 : 3)
    .map((option) => option.id);
  return {
    id: viewId,
    title: plugin.title,
    enabled: true,
    selectedOptions,
  };
}

function getPanelStorageKey(session: WorkbenchSessionContext) {
  const scope = 'taskId' in session
    ? `${session.taskId}:${'publicationId' in session ? session.publicationId : 'open'}`
    : `object:${'selectedObjectId' in session ? session.selectedObjectId : 'default'}`;
  return `control-workbench-panels:${session.mode}:${session.defaultPreset}:${scope}`;
}

function readStringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : undefined;
}

function readStoredPanels(storageKey: string, session: WorkbenchSessionContext): WorkbenchPanelInstance[] | null {
  if (typeof window === 'undefined') return null;

  try {
    const raw = window.sessionStorage.getItem(storageKey);
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;

    const allowedViews = new Set(session.allowedViews);
    const panels = parsed.flatMap((item): WorkbenchPanelInstance[] => {
      if (!item || typeof item !== 'object') return [];
      const record = item as Partial<WorkbenchPanelInstance>;
      if (typeof record.id !== 'string' || typeof record.viewId !== 'string') return [];
      const viewId = record.viewId as WorkbenchViewId;
      if (!allowedViews.has(viewId)) return [];

      const plugin = getWorkbenchViewPlugin(viewId);
      const availability = plugin?.getAvailability(session) ?? { available: true };
      if (!plugin || !availability.available) return [];

      const optionIds = new Set<string>(plugin.getOptions(session).map((option) => option.id));
      const selectedOptions = readStringArray(record.selectedOptions)?.filter((optionId) => optionIds.has(optionId));

      return [{
        id: record.id,
        viewId,
        title: typeof record.title === 'string' ? record.title : plugin.title,
        enabled: record.enabled !== false,
        selectedOptions,
        signalKinds: readStringArray(record.signalKinds) as WorkbenchPanelInstance['signalKinds'],
        signalSources: readStringArray(record.signalSources) as WorkbenchPanelInstance['signalSources'],
        settings: record.settings,
      }];
    });

    return panels.length ? panels : null;
  } catch {
    return null;
  }
}

function nextCustomPanelSequence(panels: WorkbenchPanelInstance[]) {
  return panels.reduce((max, panel) => {
    const match = panel.id.match(/-(\d+)$/);
    return match ? Math.max(max, Number(match[1])) : max;
  }, 0) + 1;
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
  const defaultPanelInstances = useMemo(() => buildDefaultWorkbenchPanelInstances(session), [session]);
  const storageKey = useMemo(() => getPanelStorageKey(session), [session]);
  const [panels, setPanels] = useState<WorkbenchPanelInstance[]>(
    () => defaultPanelInstances,
  );
  const [panelSequence, setPanelSequence] = useState(1);
  const [hydratedStorageKey, setHydratedStorageKey] = useState<string | null>(null);
  const viewConfigs = useMemo(() => keyedViewConfigsFromPanels(panels, defaultViewConfigs), [defaultViewConfigs, panels]);
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
  const availablePanelPlugins = session.allowedViews
    .map((viewId) => getWorkbenchViewPlugin(viewId))
    .filter((plugin): plugin is NonNullable<typeof plugin> => {
      if (!plugin) return false;
      return plugin.getAvailability(session).available;
    });
  const showObjectSelector = session.mode === 'explore';

  useEffect(() => {
    setSession(initialSession);
    setObjectSelectionError(null);
  }, [initialSession]);

  const selectObject = (objectId: string) => {
    const result = selectControlWorkbenchObject(session, objectId);
    setSession(result.session);
    setObjectSelectionError(result.error ?? null);
  };

  useEffect(() => {
    const restoredPanels = readStoredPanels(storageKey, session) ?? buildDefaultWorkbenchPanelInstances(session);
    setPanels(restoredPanels);
    setPanelSequence(nextCustomPanelSequence(restoredPanels));
    setHydratedStorageKey(storageKey);
  }, [session, storageKey]);

  useEffect(() => {
    if (hydratedStorageKey !== storageKey || typeof window === 'undefined') return;
    window.sessionStorage.setItem(storageKey, JSON.stringify(panels));
  }, [hydratedStorageKey, panels, storageKey]);

  const resetPanels = () => {
    setPanels(buildDefaultWorkbenchPanelInstances(session));
  };

  const resetPanel = (panel: WorkbenchPanelInstance) => {
    const fallback = defaultPanelInstances.find((item) => item.viewId === panel.viewId);
    if (!fallback) return;
    setPanels((current) => current.map((item) => (
      item.id === panel.id ? { ...fallback, id: panel.id } : item
    )));
  };

  const addPanel = (viewId: WorkbenchViewId) => {
    const plugin = getWorkbenchViewPlugin(viewId);
    const availability = plugin?.getAvailability(session) ?? { available: true };
    if (!plugin || !availability.available) return;

    const fallback = defaultViewConfigs.find((config) => config.id === viewId)
      ?? createFallbackPanelConfig(viewId, session);
    if (!fallback) return;

    const nextId = `panel-custom-${viewId}-${panelSequence}`;
    setPanelSequence((current) => current + 1);
    setPanels((current) => [
      ...current,
      buildWorkbenchPanelInstance({
        ...fallback,
        enabled: true,
        title: plugin.title,
        selectedOptions: fallback.selectedOptions ? [...fallback.selectedOptions] : undefined,
      }, nextId),
    ]);
  };

  const removePanel = (panelId: string) => {
    setPanels((current) => current.length <= 1 ? current : current.filter((panel) => panel.id !== panelId));
  };

  const togglePanelOption = (panelId: string, optionId: string) => {
    setPanels((current) => toggleWorkbenchPanelOption(current, panelId, optionId));
  };

  const renderPanelConfiguration = (panel: WorkbenchPanelInstance) => {
    const plugin = getWorkbenchViewPlugin(panel.viewId);
    const availability = plugin?.getAvailability(session) ?? { available: true };
    const options = plugin?.getOptions(session) ?? [];
    return (
      <article key={panel.id} className="rounded-lg border border-border/70 bg-background/60 p-3" data-workbench-panel-config-id={panel.id}>
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-sm font-semibold text-foreground">{panel.title}</p>
            <p className="mt-1 text-xs text-subtle">{availability.available ? plugin?.title ?? panel.viewId : availability.reason}</p>
          </div>
          <div className="flex items-center gap-1">
            <button
              className="btn-ghost-themed inline-flex h-8 w-8 items-center justify-center rounded-lg border p-0"
              type="button"
              onClick={() => resetPanel(panel)}
              aria-label={`重置 ${panel.title}`}
              title="重置默认"
            >
              <Settings2 className="h-4 w-4" />
            </button>
            <button
              className="btn-ghost-themed inline-flex h-8 w-8 items-center justify-center rounded-lg border p-0 disabled:opacity-40"
              type="button"
              disabled={panels.length <= 1}
              onClick={() => removePanel(panel.id)}
              aria-label={`删除 ${panel.title}`}
              title="删除面板"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
        <details className="mt-3">
          <summary className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-border/70 bg-card/70 px-3 py-2 text-xs font-medium text-foreground">
            <Settings2 className="h-4 w-4" />
            面板配置
          </summary>
          {options.length ? (
            <div className="mt-3 grid gap-2">
              {options.map((option) => {
                const selected = Boolean(panel.selectedOptions?.includes(option.id));
                return (
                  <label key={option.id} className="flex gap-2 text-xs text-subtle">
                    <input
                      checked={selected && option.enabled && availability.available}
                      className="mt-0.5"
                      disabled={!availability.available || !option.enabled}
                      name={isSingleSelectionView(panel.viewId) ? panel.id : undefined}
                      onChange={() => togglePanelOption(panel.id, option.id)}
                      type={isSingleSelectionView(panel.viewId) ? 'radio' : 'checkbox'}
                    />
                    <span>
                      <span className={option.enabled && availability.available ? 'text-foreground' : 'text-muted-foreground'}>
                        {option.label}
                      </span>
                      {!option.enabled && option.disabledReason ? (
                        <span className="mt-0.5 block text-muted-foreground">{option.disabledReason}</span>
                      ) : null}
                    </span>
                  </label>
                );
              })}
            </div>
          ) : (
            <p className="mt-3 text-xs text-subtle">该面板暂无可配置选项。</p>
          )}
        </details>
      </article>
    );
  };

  return (
    <main className="min-h-screen bg-background text-foreground">
      <section className="border-b border-border/70 bg-card/80 px-6 py-5">
        <div className="mx-auto flex max-w-[1600px] flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm text-primary">{modeLabel(session.mode)} · {workspaceLabel}</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-normal">{taskTitle}</h1>
            <p className="mt-2 text-sm text-subtle">对象：{objectName}</p>
          </div>
          <Link
            className="btn-ghost-themed inline-flex h-10 items-center justify-center rounded-lg border px-4 text-sm"
            href={getControlWorkbenchReturnHref(session)}
          >
            {'taskId' in session ? '返回挑战详情' : '返回跨域探索'}
          </Link>
        </div>
      </section>

      <section className="mx-auto grid max-w-[1600px] gap-4 px-4 py-5 sm:px-6 lg:px-8">
        <section className="surface-card rounded-lg p-4">
          <h2 className="text-base font-semibold text-foreground">会话状态</h2>
          <dl className="mt-3 grid gap-3 text-sm md:grid-cols-4">
            <div>
              <dt className="text-subtle">允许方法</dt>
              <dd className="mt-1 text-foreground">{methodText(session.allowedMethods)}</dd>
            </div>
            <div>
              <dt className="text-subtle">指标</dt>
              <dd className="mt-1 text-foreground">{metricNames}</dd>
            </div>
            <div>
              <dt className="text-subtle">提交状态</dt>
              <dd className="mt-1 text-foreground">
                {session.submissionPolicy.officialEvaluationEnabled
                  ? '可通过预设面板进入官方评价'
                  : session.submissionPolicy.disabledReason}
              </dd>
            </div>
            {'publicationId' in session ? (
              <div>
                <dt className="text-subtle">作业发布</dt>
                <dd className="mt-1 text-foreground">{session.publicationId}</dd>
              </div>
            ) : null}
          </dl>
        </section>

        {showObjectSelector ? (
          <section className="surface-card rounded-lg p-4">
            <WorkbenchObjectSelector
              expanded={objectSelectorExpanded}
              groups={objectGroups}
              onSelect={selectObject}
              onToggle={() => setObjectSelectorExpanded((current) => !current)}
              selectionError={objectSelectionError}
            />
          </section>
        ) : null}

        <section className="surface-card rounded-lg p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h2 className="text-base font-semibold text-foreground">面板布置与添加面板</h2>
              <p className="mt-1 text-sm text-subtle">可以添加允许的面板；每个面板的配置只影响自己。</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {availablePanelPlugins.map((plugin) => (
                <button
                  key={plugin.id}
                  className="btn-ghost-themed inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm"
                  type="button"
                  onClick={() => addPanel(plugin.id)}
                >
                  <Plus className="h-4 w-4" />
                  添加{plugin.title}
                </button>
              ))}
              <button
                className="btn-ghost-themed inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm"
                type="button"
                onClick={resetPanels}
              >
                <Settings2 className="h-4 w-4" />
                重置默认
              </button>
            </div>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {panels.map(renderPanelConfiguration)}
          </div>
        </section>

        <div className="grid gap-4">
          {session.mode === 'explore' ? (
            <p className="surface-card rounded-lg p-4 text-sm leading-6 text-subtle">
              自由探索模式可用于本地建模和参数试验，但结果不进入官方评价和竞技场榜单。
            </p>
          ) : (
            <p className="surface-card rounded-lg p-4 text-sm leading-6 text-subtle">
              该页面已经解析竞技场任务、对象、指标、允许方法和提交策略。下方工作区按面板实例渲染。
            </p>
          )}
          {showClassicPreset ? (
            <ClassicFourViewPreset session={session} viewConfigs={viewConfigs} panelInstances={panels} />
          ) : null}
          {showBlackBoxPreset ? (
            <BlackBoxIdentificationPreset session={session} panelInstances={panels} />
          ) : null}
          {showCompositePreset ? (
            <CompositeControlPreset session={session} panelInstances={panels} />
          ) : null}
          {showPredictivePreset ? (
            <PredictiveControlPreset session={session} panelInstances={panels} />
          ) : null}
          {showArenaSubmissionMount && 'recommendedWorkspaceMode' in session ? (
            <ArenaWorkbenchSubmissionMount
              workspaceMode={session.recommendedWorkspaceMode}
              className="mt-2"
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
      <main className="min-h-screen bg-background px-6 py-10 text-foreground">
        <div className="surface-card mx-auto max-w-5xl rounded-lg border-red-500/30 bg-red-500/10 p-6">
          <p className="text-sm text-red-600 dark:text-red-300">无法解析竞技场挑战</p>
          <h1 className="mt-2 text-2xl font-semibold">工作台上下文不可用</h1>
          <p className="mt-3 text-sm leading-6 text-red-600 dark:text-red-200">{result.error.message}</p>
          <Link className="mt-5 inline-flex text-sm font-medium text-red-600 underline dark:text-red-200" href="/arena">
            返回竞技场大厅
          </Link>
        </div>
      </main>
    );
  }

  return <ResolvedControlWorkbenchShell session={result.session} />;
}
