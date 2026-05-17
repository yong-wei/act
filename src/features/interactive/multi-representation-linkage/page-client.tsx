'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, SlidersHorizontal } from 'lucide-react';
import { BlockMath } from 'react-katex';
import 'katex/dist/katex.min.css';

import {
  BodeComparisonPanel,
  ControlPerformanceBar,
  NyquistPanel,
  RootLocusPanel,
  TIME_DOMAIN_CURVE_STYLES,
  TimeDomainComparisonPanel,
} from '@/resources/control-system/charts/control-analysis-panels';
import type { ControlAnalysisResult } from '@/resources/control-system/analysis/types';

import {
  resolvePanelSelectedOptions,
  useMultiRepresentationLinkageModel,
  type MultiRepresentationInitialParams,
  type MultiRepresentationPanelInstance,
  type MultiRepresentationViewConfigs,
  type MultiRepresentationViewId,
} from './model';
import { ParameterDrawer } from './parameter-drawer';
import { ArenaModelSelectorPanel } from '@/features/arena/workbench/arena-model-selector-panel';
import { ArenaSubmitPanel } from './arena-submit-panel';
import {
  arenaMethodLabels,
  arenaSourceLabels,
  arenaVisibilityLabels,
  arenaWorkspaceLabels,
} from '@/features/arena/display-labels';

function selectedViewOptions(
  viewConfigs: MultiRepresentationViewConfigs | undefined,
  viewId: MultiRepresentationViewId,
  fallbackOptions: string[],
) {
  const config = viewConfigs?.[viewId];
  if (!config) return new Set(fallbackOptions);
  if (config.enabled === false) return new Set<string>();
  return new Set(config.selectedOptions ?? []);
}

type ClassicRootLocusSourceId = 'uncorrected-root-locus' | 'corrected-root-locus';
type ClassicNyquistSourceId = 'uncorrected-open-loop' | 'corrected-open-loop';
type ClassicPanelSourceId = ClassicRootLocusSourceId | ClassicNyquistSourceId;

function ClassicSourceSwitch<T extends string>({
  label,
  options,
  selectedId,
  onSelect,
}: {
  label: string;
  options: Array<{ id: T; label: string }>;
  selectedId: T;
  onSelect: (id: T) => void;
}) {
  if (options.length <= 1) {
    return (
      <div className="premium-lesson-caption px-1 text-xs">
        {label}：{options[0]?.label ?? '无可用来源'}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2 px-1">
      <span className="premium-lesson-caption text-xs">{label}</span>
      <div className="flex flex-wrap gap-1" role="group" aria-label={label}>
        {options.map((option) => (
          <button
            key={option.id}
            type="button"
            onClick={() => onSelect(option.id)}
            aria-pressed={selectedId === option.id}
            className={`rounded-md border px-2.5 py-1 text-xs transition ${
              selectedId === option.id
                ? 'border-cyan-500 bg-cyan-50 text-cyan-900 dark:bg-cyan-950/40 dark:text-cyan-100'
                : 'border-border/60 bg-background/60 text-muted-foreground hover:border-cyan-400/70 hover:text-foreground'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function selectPanelSource<T extends ClassicPanelSourceId, TOption extends { id: T }>(
  sourceSelections: Record<string, ClassicPanelSourceId>,
  panelId: string,
  sourceOptions: TOption[],
) {
  return sourceOptions.find((option) => option.id === sourceSelections[panelId])
    ?? sourceOptions[0]
    ?? null;
}

function buildReferenceResponseResult(
  result: ControlAnalysisResult,
  responseType: 'step' | 'impulse' | 'ramp',
): ControlAnalysisResult {
  return {
    ...result,
    isFallback: false,
    fallbackMessage: undefined,
    stepResponse: {
      ...result.stepResponse,
      points: result.stepResponse.points.map((point) => ({
        ...point,
        y: responseType === 'ramp' ? point.x : responseType === 'impulse' ? 0 : 1,
      })),
    },
  };
}

function WorkbenchViewEmptyNotice({ title }: { title: string }) {
  return (
    <div className="premium-lesson-panel px-5 py-4 text-sm text-muted-foreground">
      <div className="premium-lesson-kicker">{title}</div>
      <p className="mt-2">当前视图没有选择可显示曲线。</p>
    </div>
  );
}

export function MultiRepresentationLinkageClient({
  initialParams,
}: {
  initialParams: MultiRepresentationInitialParams;
}) {
  const model = useMultiRepresentationLinkageModel(initialParams);
  const [panelSourceSelections, setPanelSourceSelections] = useState<Record<string, ClassicPanelSourceId>>({});
  const result = model.analysisResult;
  const frequencyResult = (model.frequencyAnalysisResult ?? result)!;
  const showCorrectionComparison = Boolean(
    model.correctionEnabled
    && model.preCorrectionAnalysisResult
    && result
    && model.correctionDeviceAnalysisResult,
  );
  const timeDomainOptions = selectedViewOptions(
    initialParams.viewConfigs,
    'time-domain',
    showCorrectionComparison ? ['uncorrected-output', 'corrected-output'] : ['corrected-output'],
  );
  const bodeOptions = selectedViewOptions(
    initialParams.viewConfigs,
    'bode',
    showCorrectionComparison
      ? ['uncorrected-open-loop', 'corrected-open-loop', 'correction-device']
      : ['corrected-open-loop'],
  );
  const rootLocusOptions = selectedViewOptions(
    initialParams.viewConfigs,
    'root-locus',
    showCorrectionComparison ? ['uncorrected-root-locus', 'corrected-root-locus'] : ['corrected-root-locus'],
  );
  const nyquistOptions = selectedViewOptions(
    initialParams.viewConfigs,
    'nyquist',
    showCorrectionComparison ? ['uncorrected-open-loop', 'corrected-open-loop'] : ['corrected-open-loop'],
  );
  const baselineResult = result ? model.preCorrectionAnalysisResult ?? result : null;
  const workbenchPanels: MultiRepresentationPanelInstance[] = initialParams.panelInstances?.length
    ? initialParams.panelInstances.filter((panel) => panel.enabled !== false)
    : [
        { id: 'panel-time-domain', viewId: 'time-domain', title: '时域响应', selectedOptions: Array.from(timeDomainOptions) },
        { id: 'panel-bode', viewId: 'bode', title: 'Bode 图', selectedOptions: Array.from(bodeOptions) },
        { id: 'panel-root-locus', viewId: 'root-locus', title: '根轨迹', selectedOptions: Array.from(rootLocusOptions) },
        { id: 'panel-nyquist', viewId: 'nyquist', title: 'Nyquist 图', selectedOptions: Array.from(nyquistOptions) },
      ];
  const buildTimeDomainPanels = (options: Set<string>) => result
    ? [
        ...(options.has('reference')
          ? [{
              label: '参考输入',
              style: TIME_DOMAIN_CURVE_STYLES.reference,
              result: buildReferenceResponseResult(result, model.responseType),
            }]
          : []),
        ...(options.has('uncorrected-output') && baselineResult
          ? [{ label: '未校正输出', style: TIME_DOMAIN_CURVE_STYLES.uncorrected, result: baselineResult }]
          : []),
        ...(options.has('corrected-output')
          ? [{ label: showCorrectionComparison ? '校正后输出' : '输出', style: TIME_DOMAIN_CURVE_STYLES.corrected, result }]
          : []),
      ]
    : [];
  const buildBodePanels = (options: Set<string>) => result
    ? [
        ...(options.has('uncorrected-open-loop') && model.preCorrectionAnalysisResult
          ? [{ label: '未校正开环', color: '#64748b', result: model.preCorrectionAnalysisResult }]
          : []),
        ...(options.has('corrected-open-loop')
          ? [{ label: '校正后开环', color: '#0ea5e9', result: frequencyResult }]
          : []),
        ...(options.has('correction-device') && model.correctionDeviceAnalysisResult
          ? [{ label: '校正装置', color: '#f97316', result: model.correctionDeviceAnalysisResult }]
          : []),
      ]
    : [];
  const updatePanelSourceSelection = (panelId: string, sourceId: ClassicPanelSourceId) => {
    setPanelSourceSelections((current) => ({
      ...current,
      [panelId]: sourceId,
    }));
  };
  const renderWorkbenchPanel = (panel: MultiRepresentationPanelInstance) => {
    let content;

    if (panel.viewId === 'time-domain') {
      const panels = buildTimeDomainPanels(resolvePanelSelectedOptions(panel, timeDomainOptions));
      content = panels.length > 0 ? (
        <TimeDomainComparisonPanel panels={panels} onRefreshRange={model.refreshTimeRange} />
      ) : (
        <WorkbenchViewEmptyNotice title="时域响应" />
      );
    } else if (panel.viewId === 'bode') {
      const panels = buildBodePanels(resolvePanelSelectedOptions(panel, bodeOptions));
      content = panels.length > 0 ? (
        <BodeComparisonPanel
          panels={panels}
          turnFrequencyHandles={model.turnFrequencyHandles}
          onTurnFrequencyCommit={model.updateTurnFrequencyHandle}
          onRefreshRange={model.refreshFrequencyRange}
        />
      ) : (
        <WorkbenchViewEmptyNotice title="Bode 图" />
      );
    } else if (panel.viewId === 'root-locus') {
      const options = resolvePanelSelectedOptions(panel, rootLocusOptions);
      const sourceOptions = result
        ? [
            ...(options.has('uncorrected-root-locus') && baselineResult
              ? [{ id: 'uncorrected-root-locus' as const, label: '未校正根轨迹', result: baselineResult }]
              : []),
            ...(options.has('corrected-root-locus')
              ? [{ id: 'corrected-root-locus' as const, label: '校正后根轨迹', result }]
              : []),
          ]
        : [];
      const selectedSource = selectPanelSource(panelSourceSelections, panel.id, sourceOptions);
      content = selectedSource ? (
        <div className="space-y-2">
          <ClassicSourceSwitch
            label="根轨迹来源"
            options={sourceOptions}
            selectedId={selectedSource.id}
            onSelect={(id) => updatePanelSourceSelection(panel.id, id)}
          />
          <RootLocusPanel
            result={selectedSource.result}
            mode="full"
            interactiveHandles={selectedSource.id === 'corrected-root-locus' ? model.correctionRootHandles : []}
            onInteractiveHandleCommit={selectedSource.id === 'corrected-root-locus' ? model.updateCorrectionRootHandle : undefined}
            onClosedLoopGainCommit={selectedSource.id === 'corrected-root-locus' ? model.setGain : undefined}
          />
        </div>
      ) : (
        <WorkbenchViewEmptyNotice title="根轨迹" />
      );
    } else {
      const options = resolvePanelSelectedOptions(panel, nyquistOptions);
      const sourceOptions = result
        ? [
            ...(options.has('uncorrected-open-loop') && model.preCorrectionAnalysisResult
              ? [{ id: 'uncorrected-open-loop' as const, label: '未校正开环', result: model.preCorrectionAnalysisResult }]
              : []),
            ...(options.has('corrected-open-loop')
              ? [{ id: 'corrected-open-loop' as const, label: '校正后开环', result: frequencyResult }]
              : []),
          ]
        : [];
      const selectedSource = selectPanelSource(panelSourceSelections, panel.id, sourceOptions);
      content = selectedSource ? (
        <div className="space-y-2">
          <ClassicSourceSwitch
            label="Nyquist 来源"
            options={sourceOptions}
            selectedId={selectedSource.id}
            onSelect={(id) => updatePanelSourceSelection(panel.id, id)}
          />
          <NyquistPanel result={selectedSource.result} />
        </div>
      ) : (
        <WorkbenchViewEmptyNotice title="Nyquist 图" />
      );
    }

    return (
      <section key={panel.id} className="rounded-lg border border-border/70 bg-card/70 p-3" data-workbench-panel-id={panel.id}>
        <header className="mb-3 flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-foreground">{panel.title}</h3>
          <span className="rounded-full border border-border/70 bg-background/70 px-2 py-1 text-[11px] text-subtle">
            独立面板
          </span>
        </header>
        {content}
      </section>
    );
  };

  if (model.arenaContextIncompatible) {
    return (
      <div className="premium-lesson-shell flex min-h-screen items-center justify-center">
        <main className="premium-lesson-main mx-auto max-w-[720px] px-6 py-12 text-center">
          <div className="premium-lesson-panel px-6 py-8 border-l-4 border-amber-500">
            <div className="premium-lesson-kicker text-amber-600">工作台模式不匹配</div>
            <h1 className="premium-lesson-title mt-4 text-2xl font-semibold">
              当前挑战不支持多表征联动工作台
            </h1>
            <p className="premium-lesson-muted mt-3 text-sm">
              该挑战的工作台模式为 {model.arenaContext ? arenaWorkspaceLabels[model.arenaContext.recommendedWorkspaceMode] : '未知工作台'}，
              不支持根轨迹、伯德图和奈奎斯特图等单输入单输出线性时不变传递函数分析功能。
            </p>
            <div className="mt-6 flex justify-center gap-3">
              <Link href="/arena" className="premium-lesson-action-tone premium-tone-cyan">
                返回竞技场
              </Link>
              {model.arenaContext && (
                <Link href={model.arenaContext.returnHref} className="premium-lesson-control">
                  查看挑战详情
                </Link>
              )}
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (model.arenaContextMissing) {
    return (
      <div className="premium-lesson-shell flex min-h-screen items-center justify-center">
        <main className="premium-lesson-main mx-auto max-w-[720px] px-6 py-12 text-center">
          <div className="premium-lesson-panel px-6 py-8 border-l-4 border-destructive">
            <div className="premium-lesson-kicker text-destructive">竞技场挑战错误</div>
            <h1 className="premium-lesson-title mt-4 text-2xl font-semibold">挑战上下文加载失败</h1>
            <p className="premium-lesson-muted mt-3 text-sm">
              指定的竞技场挑战任务不存在或数据不完整，无法加载工作台。
            </p>
            <div className="mt-6 flex justify-center gap-3">
              <Link href="/arena" className="premium-lesson-action-tone premium-tone-cyan">
                返回竞技场
              </Link>
              <Link
                href="/interactive-learning/multi-representation-linkage"
                className="premium-lesson-control"
              >
                进入自由探索
              </Link>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="premium-lesson-shell min-h-screen">
      <main className="premium-lesson-main mx-auto max-w-[1500px] px-3 py-4 sm:px-6 sm:py-6">
        {!model.isEmbedded ? (
          <header className="premium-lesson-panel px-5 py-5">
            <div className="premium-lesson-kicker">多表征联动工作台</div>
            <div className="mt-3 flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
              <div className="min-w-0">
                <div className="flex items-center gap-3">
                  <Link
                    href={model.arenaContext?.returnHref ?? '/interactive-learning/cross-domain-exploration'}
                    className="premium-lesson-control flex h-9 w-9 shrink-0 items-center justify-center rounded-full p-0"
                    aria-label="返回上一层"
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </Link>
                  <h1 className="premium-lesson-title text-2xl font-semibold">
                    {model.isArenaChallengeMode
                      ? model.arenaContext!.task.title
                      : model.isCourseMode
                        ? '多表征联动（课程模式）'
                        : '多表征联动可视化引擎'}
                  </h1>
                </div>
                {model.isArenaChallengeMode ? (
                  <div className="mt-2 space-y-1">
                    <div className="premium-lesson-muted text-sm">
                      <div>对象：{model.arenaContext!.object.name}</div>
                      {model.arenaContext!.object.model ? (
                        <div className="mt-1 max-w-xl overflow-x-auto rounded-md border border-border/60 bg-background/70 px-3 py-2 text-xs [&_.katex-display]:m-0">
                          <BlockMath math={model.arenaContext!.object.model.latex ?? model.arenaContext!.object.model.display} />
                        </div>
                      ) : (
                        <div className="mt-1">该对象不公开传递函数。</div>
                      )}
                    </div>
                    <p className="premium-lesson-muted text-sm">
                      来源：{arenaSourceLabels[model.arenaContext!.object.source]} | 公开程度：{arenaVisibilityLabels[model.arenaContext!.object.visibility]} | 工作台：{arenaWorkspaceLabels[model.arenaContext!.recommendedWorkspaceMode]}
                    </p>
                    <p className="premium-lesson-muted text-sm">
                      允许方法：{model.arenaContext!.allowedMethods.map((method) => arenaMethodLabels[method]).join('、')} | 评价指标：{model.arenaContext!.metricProfile.rankingMetrics.map((m) => m.label).join('、')}
                    </p>
                    <p className="premium-lesson-muted text-sm">
                      状态：{model.isLockedByChallenge ? '挑战锁定（对象不可编辑）' : '自由设计'}
                      <Link href={model.arenaContext!.returnHref} className="underline ml-2">返回挑战详情</Link>
                    </p>
                    <p className="text-xs text-amber-600 mt-1">
                      工作台预评测，不等同于官方榜单成绩
                    </p>
                    {model.arenaPreviewSummary && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {model.arenaPreviewSummary.metrics.map((metric) => (
                          <div
                            key={metric.id}
                            className={`rounded-md border px-3 py-1.5 text-xs ${
                              metric.status === 'unknown'
                                ? 'border-border/40 bg-muted/30 text-muted-foreground'
                                : metric.status === 'pass'
                                  ? 'border-emerald-500/40 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300'
                                  : metric.status === 'warning'
                                    ? 'border-amber-500/40 bg-amber-50 text-amber-800 dark:bg-amber-950/30 dark:text-amber-300'
                                    : 'border-red-500/40 bg-red-50 text-red-800 dark:bg-red-950/30 dark:text-red-300'
                            }`}
                          >
                            <div className="font-medium">{metric.label}</div>
                            <div className="tabular-nums">
                              {metric.value !== null ? `${metric.value.toFixed(2)}${metric.unit ?? ''}` : '官方评测计算'}
                            </div>
                          </div>
                        ))}
                        {model.arenaPreviewSummary.previewScore !== null && (
                          <div className="rounded-md border border-sky-500/40 bg-sky-50 px-3 py-1.5 text-xs dark:bg-sky-950/30">
                            <div className="font-medium text-sky-800 dark:text-sky-300">预评测分数</div>
                            <div className="text-sky-700 dark:text-sky-400 tabular-nums">
                              {model.arenaPreviewSummary.previewScore.toFixed(1)}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="premium-lesson-muted mt-2 text-sm">
                    {model.isCourseMode
                      ? `课程模式（${model.courseRole === 'teacher' ? '教师' : '学生'}）：默认按邮轮模型与控制器注入开环，禁用添加和删除极点零点。`
                      : '开环极点零点、闭环时域指标、伯德图裕度、根轨迹和奈奎斯特轨迹同步刷新。'}
                  </p>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="premium-lesson-caption rounded-full border border-border/60 px-3 py-2 text-xs">
                  {model.parameterSummary}
                </div>
              </div>
            </div>
          </header>
        ) : (
          <div className="premium-lesson-panel-soft mb-4 flex flex-wrap items-center justify-between gap-3 px-4 py-4">
            <div className="premium-lesson-caption text-xs">{model.parameterSummary}</div>
          </div>
        )}

        {!model.isEmbedded && (
          <ArenaModelSelectorPanel
            currentObjectId={model.arenaContext?.object.id}
            locked={model.isArenaChallengeMode && model.isLockedByChallenge}
            workspaceMode="multi-representation-linkage"
            onSelectObject={model.selectArenaObjectForExploration}
          />
        )}

        {model.arenaContext && model.isLockedByChallenge && (
          <ArenaSubmitPanel
            arenaContext={model.arenaContext}
            correctionState={model.correctionState}
            isLockedByChallenge={model.isLockedByChallenge}
            gain={model.gain}
            publicationId={initialParams.publicationId}
          />
        )}

        <ParameterDrawer
          open={model.drawerOpen}
          onOpenChange={model.setDrawerOpen}
          isCourseMode={model.isCourseMode}
          isLockedOrCourse={model.isLockedOrCourse}
          modelPoles={model.modelPoles}
          modelZeros={model.modelZeros}
          gain={model.gain}
          correctionState={model.correctionState}
          responseType={model.responseType}
          showMargins={model.showMargins}
          onGainChange={model.setGain}
          onCorrectionChange={model.setCorrectionState}
          onResponseTypeChange={model.setResponseType}
          onShowMarginsChange={model.setShowMargins}
          onAddPoint={model.addPoint}
          onUpdatePole={model.updatePole}
          onUpdateZero={model.updateZero}
          onRemovePole={model.removePole}
          onRemoveZero={model.removeZero}
          onReset={model.reset}
        />

        <section className="mt-4">
          {result ? (
            <div className="grid gap-4">
              <ControlPerformanceBar result={result} />
              <div className="grid auto-rows-fr gap-4 xl:grid-cols-2">
                {workbenchPanels.map(renderWorkbenchPanel)}
              </div>
            </div>
          ) : (
            <div className="premium-lesson-tone-block premium-tone-rose text-sm">
              控制分析图暂时不可用。
            </div>
          )}
        </section>

        <div className="premium-lesson-tone-block premium-tone-slate mt-4 text-sm">
          {model.analysisState.isLoading
            ? '正在计算联动结果。'
            : model.analysisState.error
              ? `计算失败：${model.analysisState.error}`
              : '联动已更新：四个表征共用同一组开环零极点与统一分析结果。'}
        </div>
      </main>
      <button
        type="button"
        onClick={() => model.setDrawerOpen(true)}
        className="premium-lesson-action-tone premium-tone-cyan fixed bottom-36 right-6 z-40 flex h-11 w-11 items-center justify-center rounded-full p-0 shadow-lg"
        aria-label="打开参数抽屉"
        title="参数抽屉"
      >
        <SlidersHorizontal className="h-5 w-5" />
        <span className="sr-only">打开参数抽屉</span>
      </button>
    </div>
  );
}
