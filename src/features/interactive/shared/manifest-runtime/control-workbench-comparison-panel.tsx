'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import { useControlEngine } from '@/resources/control-system/analysis/use-control-engine';
import type { ControlAnalysisResult } from '@/resources/control-system/analysis/types';
import {
  BodeComparisonPanel,
  TimeDomainComparisonPanel,
} from '@/resources/control-system/charts/control-analysis-panels';
import {
  buildControlWorkbenchComparisonSnapshot,
  type ControlWorkbenchComparisonRequest,
  type ControlWorkbenchComparisonSnapshot,
} from './control-workbench-comparison';

const COMPARISON_COLORS = [
  'hsl(var(--platform-action-primary))',
  'hsl(var(--platform-evidence-eligible))',
  'hsl(var(--platform-evidence-unsupported))',
  'hsl(var(--platform-fg-secondary))',
  'hsl(var(--platform-warning))',
  'hsl(var(--platform-accent))',
] as const;

function ComparisonRequestProbe({
  comparison,
  onResult,
}: {
  comparison: ControlWorkbenchComparisonRequest;
  onResult: (id: string, requestKey: string, result: ControlAnalysisResult | null) => void;
}) {
  const requestKey = useMemo(() => JSON.stringify(comparison.request), [comparison.request]);
  const { result } = useControlEngine(comparison.request);
  useEffect(() => onResult(comparison.id, requestKey, result), [comparison.id, onResult, requestKey, result]);
  return null;
}

export function ControlWorkbenchComparisonPanel({
  comparisons,
  showTimeDomain,
  showBode,
  onSnapshotsChange,
}: {
  comparisons: ControlWorkbenchComparisonRequest[];
  showTimeDomain: boolean;
  showBode: boolean;
  onSnapshotsChange?: (snapshots: ControlWorkbenchComparisonSnapshot[], ready: boolean) => void;
}) {
  const [results, setResults] = useState<Record<string, { requestKey: string; result: ControlAnalysisResult | null }>>({});
  const handleResult = useCallback((id: string, requestKey: string, result: ControlAnalysisResult | null) => {
    setResults((current) => current[id]?.requestKey === requestKey && current[id]?.result === result
      ? current
      : { ...current, [id]: { requestKey, result } });
  }, []);
  const ready = useMemo(() => comparisons.flatMap((comparison, index) => {
    const requestKey = JSON.stringify(comparison.request);
    const entry = results[comparison.id];
    if (!entry?.result || entry.requestKey !== requestKey) return [];
    return [{
      comparison,
      result: entry.result,
      color: COMPARISON_COLORS[index % COMPARISON_COLORS.length],
    }];
  }), [comparisons, results]);
  const snapshots = useMemo(
    () => ready.map(({ comparison, result }) => buildControlWorkbenchComparisonSnapshot(comparison, result)),
    [ready],
  );
  const allReady = ready.length === comparisons.length;
  useEffect(() => onSnapshotsChange?.(snapshots, allReady), [allReady, onSnapshotsChange, snapshots]);

  return (
    <div className="interactive-courseware-stack" data-control-workbench-comparison-count={comparisons.length}>
      {comparisons.map((comparison) => (
        <ComparisonRequestProbe key={comparison.id} comparison={comparison} onResult={handleResult} />
      ))}
      {ready.length < comparisons.length ? (
        <div className="premium-lesson-tone-block premium-tone-slate" role="status">正在计算对照曲线，请稍候。</div>
      ) : null}
      {ready.length >= 2 && showTimeDomain ? (
        <TimeDomainComparisonPanel
          caseId={comparisons[0]?.request.caseId}
          panels={ready.map(({ comparison, result, color }) => ({
            label: comparison.label,
            result,
            style: { color, lineType: comparison.role === 'current' ? 'dashed' : 'solid', width: 2 },
          }))}
        />
      ) : null}
      {ready.length >= 2 && showBode ? (
        <BodeComparisonPanel
          caseId={comparisons[0]?.request.caseId}
          panels={ready.map(({ comparison, result, color }) => ({ label: comparison.label, result, color }))}
        />
      ) : null}
    </div>
  );
}
