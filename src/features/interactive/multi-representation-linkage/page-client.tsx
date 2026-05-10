'use client';

import Link from 'next/link';
import { ArrowLeft, SlidersHorizontal } from 'lucide-react';

import {
  BodePanel,
  ControlPerformanceBar,
  NyquistPanel,
  RootLocusPanel,
  TimeDomainPanel,
} from '@/resources/control-system/charts/control-analysis-panels';

import { useMultiRepresentationLinkageModel, type MultiRepresentationInitialParams } from './model';
import { ParameterDrawer } from './parameter-drawer';

export function MultiRepresentationLinkageClient({
  initialParams,
}: {
  initialParams: MultiRepresentationInitialParams;
}) {
  const model = useMultiRepresentationLinkageModel(initialParams);
  const result = model.analysisResult;
  const frequencyResult = (model.frequencyAnalysisResult ?? result)!;

  return (
    <div className="premium-lesson-shell min-h-screen">
      <main className="premium-lesson-main mx-auto max-w-[1500px] px-3 py-4 sm:px-6 sm:py-6">
        {!model.isEmbedded ? (
          <header className="premium-lesson-panel px-5 py-5">
            <div className="premium-lesson-kicker">Multi Representation Linkage</div>
            <div className="mt-3 flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
              <div>
                <h1 className="premium-lesson-title text-2xl font-semibold">
                  {model.isCourseMode ? '多表征联动（课程模式）' : '多表征联动可视化引擎'}
                </h1>
                <p className="premium-lesson-muted mt-2 text-sm">
                  {model.isCourseMode
                    ? `课程模式(${model.courseRole})：默认按邮轮模型与控制器注入开环，禁用添加和删除极点零点。`
                    : '开环极点零点、闭环时域指标、Bode 裕度、根轨迹和 Nyquist 轨迹同步刷新。'}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Link
                  href="/interactive-learning/cross-domain-exploration"
                  className="premium-lesson-action-tone premium-tone-slate inline-flex items-center gap-2"
                >
                  <ArrowLeft className="h-4 w-4" />
                  返回上一层
                </Link>
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

        <ParameterDrawer
          open={model.drawerOpen}
          onOpenChange={model.setDrawerOpen}
          isCourseMode={model.isCourseMode}
          modelPoles={model.modelPoles}
          modelZeros={model.modelZeros}
          gain={model.gain}
          responseType={model.responseType}
          showMargins={model.showMargins}
          onGainChange={model.setGain}
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
                <TimeDomainPanel result={result} />
                <BodePanel result={frequencyResult} showMargins={model.showMargins} />
                <RootLocusPanel
                  result={result}
                  mode="full"
                  onClosedLoopGainCommit={model.setClosedLoopGain}
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
