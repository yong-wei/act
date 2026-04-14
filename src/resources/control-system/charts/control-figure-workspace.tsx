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
  const { result, error } = useControlEngine(request, fallbackResult);

  if (!result) {
    return (
      <div className="premium-lesson-tone-block premium-tone-rose mt-4 text-sm">
        控制分析图暂时不可用。
      </div>
    );
  }

  return (
    <div className="mt-4">
      {error ? (
        <div className="premium-lesson-tone-block premium-tone-amber mb-4 text-sm">
          {result.isFallback ? `${error} 当前已切换到离线基线图。` : error}
        </div>
      ) : null}

      {layout === 'quad' ? (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.18fr)_minmax(0,1fr)]">
          <div className="grid gap-4">
            <StepResponsePanel result={result} caseId={request.caseId} />
            <RootLocusPanel result={result} caseId={request.caseId} />
          </div>
          <div className="grid gap-4">
            <MagnitudePanel result={result} caseId={request.caseId} />
            <PhasePanel result={result} caseId={request.caseId} />
          </div>
        </div>
      ) : (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,0.95fr)]">
          <RootLocusPanel result={result} caseId={request.caseId} />
          <div className="grid gap-4">
            <MagnitudePanel result={result} caseId={request.caseId} />
            <PhasePanel result={result} caseId={request.caseId} />
          </div>
          <div className="xl:col-span-2">
            <StepResponsePanel result={result} caseId={request.caseId} />
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
