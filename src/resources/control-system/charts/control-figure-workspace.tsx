'use client';

import { useControlEngine } from '../analysis/use-control-engine';
import type { ControlAnalysisRequest, ControlAnalysisResult } from '../analysis/types';
import {
  BodePanel,
  MagnitudePanel,
  NyquistPanel,
  PhasePanel,
  RootLocusPanel,
  StepResponsePanel,
} from './control-analysis-panels';

export function ControlFigureWorkspace({
  request,
  fallbackResult,
  layout,
}: {
  request: ControlAnalysisRequest;
  fallbackResult?: ControlAnalysisResult;
  layout: 'quad' | 'platform';
}) {
  const { result, isLoading, error } = useControlEngine(request, fallbackResult);

  if (!result) {
    return (
      <div className="premium-lesson-tone-block premium-tone-rose mt-4 text-sm">
        控制分析图暂时不可用。
      </div>
    );
  }

  return (
    <div className="mt-4">
      {isLoading ? (
        <div className="premium-lesson-tone-block premium-tone-cyan mb-4 text-sm">正在计算控制分析曲线…</div>
      ) : null}
      {error ? (
        <div className="premium-lesson-tone-block premium-tone-amber mb-4 text-sm">
          {result.isFallback ? `${error} 当前已切换到离线基线图。` : error}
        </div>
      ) : null}

      {layout === 'quad' ? (
        <div className="grid gap-4 xl:grid-cols-2">
          <StepResponsePanel result={result} />
          <RootLocusPanel result={result} />
          <MagnitudePanel result={result} />
          <PhasePanel result={result} />
        </div>
      ) : (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,0.95fr)]">
          <RootLocusPanel result={result} />
          <MagnitudePanel result={result} />
          <PhasePanel result={result} />
          <div className="xl:col-span-2">
            <StepResponsePanel result={result} />
          </div>
        </div>
      )}
    </div>
  );
}

export const CONTROL_ANALYSIS_PANELS = {
  StepResponsePanel,
  RootLocusPanel,
  MagnitudePanel,
  PhasePanel,
  NyquistPanel,
  BodePanel,
};
