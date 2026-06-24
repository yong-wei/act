'use client';

import { useControlEngine } from '../analysis/use-control-engine';
import type { ControlAnalysisRequest, ControlAnalysisResult } from '../analysis/types';
import {
  BodePanel,
  ControlPerformanceBar,
  MagnitudePanel,
  NyquistPanel,
  PhasePanel,
  RootLocusPanel,
  StepResponsePanel,
  TimeDomainPanel,
} from './control-analysis-panels';

export function ControlFigureWorkspace({
  request,
  fallbackResult,
  layout,
  allowedPanelIds,
}: {
  request: ControlAnalysisRequest;
  fallbackResult?: ControlAnalysisResult;
  layout: 'quad' | 'platform' | 'standard-quad';
  allowedPanelIds?: string[];
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

      {allowedPanelIds?.length ? (
        <div className="grid gap-4 xl:grid-cols-2">
          {controlWorkbenchPanelsForIds(allowedPanelIds, result, request.caseId)}
        </div>
      ) : layout === 'standard-quad' ? (
        <div className="grid gap-4">
          <ControlPerformanceBar result={result} />
          <div className="grid auto-rows-fr gap-4 xl:grid-cols-2">
            <TimeDomainPanel result={result} caseId={request.caseId} />
            <BodePanel result={result} caseId={request.caseId} />
            <RootLocusPanel result={result} caseId={request.caseId} mode="full" />
            <NyquistPanel result={result} caseId={request.caseId} />
          </div>
        </div>
      ) : layout === 'quad' ? (
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
        <div className="grid gap-4 xl:grid-cols-2">
          <StepResponsePanel result={result} caseId={request.caseId} />
          <BodePanel result={result} caseId={request.caseId} />
          <RootLocusPanel result={result} caseId={request.caseId} mode="full" />
          <RootLocusPanel result={result} caseId={request.caseId} mode="zoom" />
        </div>
      )}
    </div>
  );
}

function controlWorkbenchPanelsForIds(
  allowedPanelIds: string[],
  result: ControlAnalysisResult,
  caseId?: string,
) {
  const uniquePanelIds = Array.from(new Set(allowedPanelIds.map(normalizeControlWorkbenchPanelId).filter(Boolean)));
  return uniquePanelIds.map((panelId) => {
    if (panelId === 'performance') {
      return (
        <div key={panelId} className="xl:col-span-2" data-control-workbench-panel={panelId}>
          <ControlPerformanceBar result={result} />
        </div>
      );
    }
    if (panelId === 'time-domain') {
      return <div key={panelId} data-control-workbench-panel={panelId}><TimeDomainPanel result={result} caseId={caseId} /></div>;
    }
    if (panelId === 'step-response') {
      return <div key={panelId} data-control-workbench-panel={panelId}><StepResponsePanel result={result} caseId={caseId} /></div>;
    }
    if (panelId === 'bode') {
      return <div key={panelId} data-control-workbench-panel={panelId}><BodePanel result={result} caseId={caseId} /></div>;
    }
    if (panelId === 'magnitude') {
      return <div key={panelId} data-control-workbench-panel={panelId}><MagnitudePanel result={result} caseId={caseId} /></div>;
    }
    if (panelId === 'phase') {
      return <div key={panelId} data-control-workbench-panel={panelId}><PhasePanel result={result} caseId={caseId} /></div>;
    }
    if (panelId === 'root-locus') {
      return <div key={panelId} data-control-workbench-panel={panelId}><RootLocusPanel result={result} caseId={caseId} mode="full" /></div>;
    }
    if (panelId === 'nyquist') {
      return <div key={panelId} data-control-workbench-panel={panelId}><NyquistPanel result={result} caseId={caseId} /></div>;
    }
    return null;
  }).filter(Boolean);
}

function normalizeControlWorkbenchPanelId(panelId: string) {
  const normalized = panelId.trim().toLowerCase().replace(/_/g, '-');
  if (normalized === 'time' || normalized === 'time-domain-response') return 'time-domain';
  if (normalized === 'step' || normalized === 'step-response') return 'step-response';
  if (normalized === 'root' || normalized === 'rootlocus' || normalized === 'root-locus') return 'root-locus';
  if (normalized === 'frequency' || normalized === 'frequency-response') return 'bode';
  if (normalized === 'metrics' || normalized === 'metric-summary' || normalized === 'performance-summary') return 'performance';
  if (['time-domain', 'bode', 'magnitude', 'phase', 'nyquist', 'performance'].includes(normalized)) return normalized;
  return '';
}

export const CONTROL_ANALYSIS_PANELS = {
  StepResponsePanel,
  TimeDomainPanel,
  RootLocusPanel,
  MagnitudePanel,
  PhasePanel,
  NyquistPanel,
  BodePanel,
  ControlPerformanceBar,
};
