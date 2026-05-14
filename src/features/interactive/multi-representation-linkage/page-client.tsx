'use client';

import Link from 'next/link';
import { ArrowLeft, SlidersHorizontal } from 'lucide-react';

import {
  BodeComparisonPanel,
  BodePanel,
  ControlPerformanceBar,
  NyquistPanel,
  RootLocusPanel,
  TimeDomainComparisonPanel,
  TimeDomainPanel,
} from '@/resources/control-system/charts/control-analysis-panels';

import { useMultiRepresentationLinkageModel, type MultiRepresentationInitialParams } from './model';
import { ParameterDrawer } from './parameter-drawer';
import { ArenaModelSelectorPanel } from '@/features/arena/workbench/arena-model-selector-panel';
import { ArenaSubmitPanel } from './arena-submit-panel';

export function MultiRepresentationLinkageClient({
  initialParams,
}: {
  initialParams: MultiRepresentationInitialParams;
}) {
  const model = useMultiRepresentationLinkageModel(initialParams);
  const result = model.analysisResult;
  const frequencyResult = (model.frequencyAnalysisResult ?? result)!;
  const showCorrectionComparison = Boolean(
    model.correctionEnabled
    && model.preCorrectionAnalysisResult
    && result
    && model.correctionDeviceAnalysisResult,
  );

  if (model.arenaContextIncompatible) {
    return (
      <div className="premium-lesson-shell flex min-h-screen items-center justify-center">
        <main className="premium-lesson-main mx-auto max-w-[720px] px-6 py-12 text-center">
          <div className="premium-lesson-panel px-6 py-8 border-l-4 border-amber-500">
            <div className="premium-lesson-kicker text-amber-600">Workbench Mismatch</div>
            <h1 className="premium-lesson-title mt-4 text-2xl font-semibold">
              当前挑战不支持多表征联动工作台
            </h1>
            <p className="premium-lesson-muted mt-3 text-sm">
              该挑战的工作台模式为 {model.arenaContext?.recommendedWorkspaceMode}，
              不支持根轨迹/Bode/Nyquist 等 SISO LTI 传函分析功能。
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
            <div className="premium-lesson-kicker text-destructive">Arena Challenge Error</div>
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
            <div className="premium-lesson-kicker">Multi Representation Linkage</div>
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
                    <p className="premium-lesson-muted text-sm">
                      对象：{model.arenaContext!.object.name}（{model.arenaContext!.object.model?.display ?? '无传函'}）
                    </p>
                    <p className="premium-lesson-muted text-sm">
                      来源：{model.arenaContext!.object.source} | 公开程度：{model.arenaContext!.object.visibility} | 工作台：{model.arenaContext!.recommendedWorkspaceMode}
                    </p>
                    <p className="premium-lesson-muted text-sm">
                      允许方法：{model.arenaContext!.allowedMethods.join('、')} | 评价指标：{model.arenaContext!.metricProfile.rankingMetrics.map((m) => m.label).join('、')}
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
                      ? `课程模式(${model.courseRole})：默认按邮轮模型与控制器注入开环，禁用添加和删除极点零点。`
                      : '开环极点零点、闭环时域指标、Bode 裕度、根轨迹和 Nyquist 轨迹同步刷新。'}
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

        {model.arenaContext && (
          <ArenaModelSelectorPanel
            currentObjectId={model.arenaContext.object.id}
            locked={model.isLockedByChallenge}
            workspaceMode={model.arenaContext.recommendedWorkspaceMode}
          />
        )}

        {model.arenaContext && model.isLockedByChallenge && (
          <ArenaSubmitPanel
            arenaContext={model.arenaContext}
            correctionState={model.correctionState}
            isLockedByChallenge={model.isLockedByChallenge}
            gain={model.gain}
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
                {showCorrectionComparison ? (
                  <TimeDomainComparisonPanel
                    panels={[
                      { label: '校正前 G(s)K', color: '#64748b', result: model.preCorrectionAnalysisResult! },
                      { label: '校正后 G(s)C(s)K', color: '#0ea5e9', result },
                    ]}
                    onRefreshRange={model.refreshTimeRange}
                  />
                ) : (
                  <TimeDomainPanel result={result} onRefreshRange={model.refreshTimeRange} />
                )}
                {showCorrectionComparison ? (
                  <BodeComparisonPanel
                    panels={[
                      { label: '校正前 G(s)K', color: '#64748b', result: model.preCorrectionAnalysisResult! },
                      { label: '校正后 G(s)C(s)K', color: '#0ea5e9', result },
                      { label: '校正装置 C(s)', color: '#f97316', result: model.correctionDeviceAnalysisResult! },
                    ]}
                    turnFrequencyHandles={model.turnFrequencyHandles}
                    onTurnFrequencyCommit={model.updateTurnFrequencyHandle}
                    onRefreshRange={model.refreshFrequencyRange}
                  />
                ) : (
                  <BodePanel
                    result={frequencyResult}
                    showMargins={model.showMargins}
                    turnFrequencyHandles={model.turnFrequencyHandles}
                    onTurnFrequencyCommit={model.updateTurnFrequencyHandle}
                    onRefreshRange={model.refreshFrequencyRange}
                  />
                )}
                <RootLocusPanel
                  result={result}
                  mode="full"
                  interactiveHandles={model.correctionRootHandles}
                  onInteractiveHandleCommit={model.updateCorrectionRootHandle}
                  onClosedLoopGainCommit={model.setGain}
                />
                <NyquistPanel result={frequencyResult} />
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
              : '联动已更新：四个表征共用同一组开环零极点与 Rust/WASM 分析结果。'}
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
