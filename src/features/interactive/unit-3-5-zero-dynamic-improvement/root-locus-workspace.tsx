'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { ECharts } from 'echarts/core';
import { BlockMath } from 'react-katex';

import { RootLocusPanel } from '@/resources/control-system/charts/control-analysis-panels';
import { useControlEngine } from '@/resources/control-system/analysis/use-control-engine';
import type { ControlAnalysisRequest } from '@/resources/control-system/analysis/types';
import {
  UNIT_3_5_ROOT_LOCUS_WORKSPACE_CONFIG,
  type Unit35RootPointDefinition,
  type Unit35RootStepId,
  type WorkspaceParameterChange,
} from './workspace';

const ROOT_LOCUS_CASE_ID: Record<Unit35RootStepId, string> = {
  'step-04': 'unit35_step04',
  'step-05': 'unit35_step05',
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function clonePoints(points: Unit35RootPointDefinition[]) {
  return points.map((point) => ({ ...point }));
}

function multiplyByFactor(coefficients: number[], factor: [number, number]) {
  const next = new Array(coefficients.length + 1).fill(0);
  coefficients.forEach((coefficient, index) => {
    next[index] += coefficient * factor[0];
    next[index + 1] += coefficient * factor[1];
  });
  return next;
}

function polynomialFromRoots(roots: number[]) {
  const coefficients = roots.reduce((accumulator, root) => multiplyByFactor(accumulator, [1, -root]), [1]);
  return coefficients.map((value) => (Math.abs(value) < 1e-9 ? 0 : Number(value.toFixed(6))));
}

function formatFactor(root: number) {
  if (Math.abs(root) < 1e-9) {
    return 's';
  }
  return root < 0 ? `(s+${Math.abs(root).toFixed(2).replace(/\.00$/, '')})` : `(s-${root.toFixed(2).replace(/\.00$/, '')})`;
}

function formatCurrentFormula(points: Unit35RootPointDefinition[]) {
  const zeros = points.filter((point) => point.kind === 'zero').map((point) => point.position);
  const poles = points.filter((point) => point.kind === 'pole').map((point) => point.position);
  const numerator = zeros.length ? zeros.map(formatFactor).join('') : '1';
  const denominator = poles.length ? poles.map(formatFactor).join('') : '1';
  return `L(s)=K\\frac{${numerator}}{${denominator}}`;
}

function buildUnit35RootLocusRequest(
  stepId: Unit35RootStepId,
  points: Unit35RootPointDefinition[],
  gain: number,
): ControlAnalysisRequest {
  const config = UNIT_3_5_ROOT_LOCUS_WORKSPACE_CONFIG[stepId];
  const zeros = points.filter((point) => point.kind === 'zero').map((point) => point.position);
  const poles = points.filter((point) => point.kind === 'pole').map((point) => point.position);

  return {
    runtimeMode: 'analysis',
    caseId: `unit-3-5-${stepId}`,
    plant: {
      numerator: polynomialFromRoots(zeros),
      denominator: polynomialFromRoots(poles),
      coefficientOrder: 'descending',
      label: stepId === 'step-04' ? '二阶零点重排对象' : '三阶零点重排对象',
    },
    structures: [{ kind: 'gain', enabled: true, params: { k: gain }, label: 'K' }],
    outputs: ['root_locus'],
    timeRange: { start: 0, end: 10, samples: 240 },
    frequencyRange: { min: 1e-2, max: 1e2, samples: 240 },
    rootLocus: {
      minGain: 0,
      maxGain: config.rootLocusMaxGain,
      samples: config.rootLocusSamples,
      currentGain: gain,
    },
  };
}

export function UNIT_3_5RootLocusWorkspace({
  stepId,
  onWorkspaceParameterChange,
}: {
  stepId: Unit35RootStepId;
  onWorkspaceParameterChange?: (change: WorkspaceParameterChange) => void;
}) {
  return (
    <UNIT_3_5RootLocusWorkspaceContent
      key={stepId}
      stepId={stepId}
      onWorkspaceParameterChange={onWorkspaceParameterChange}
    />
  );
}

function UNIT_3_5RootLocusWorkspaceContent({
  stepId,
  onWorkspaceParameterChange,
}: {
  stepId: Unit35RootStepId;
  onWorkspaceParameterChange?: (change: WorkspaceParameterChange) => void;
}) {
  const config = UNIT_3_5_ROOT_LOCUS_WORKSPACE_CONFIG[stepId];
  const defaultMode = config.modes[0];
  const [modeKey, setModeKey] = useState(defaultMode.key);
  const [points, setPoints] = useState<Unit35RootPointDefinition[]>(() => clonePoints(defaultMode.points));
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<ECharts | null>(null);

  const currentMode = useMemo(
    () => config.modes.find((mode) => mode.key === modeKey) ?? config.modes[0],
    [config.modes, modeKey],
  );
  const request = useMemo(() => buildUnit35RootLocusRequest(stepId, points, config.defaultGain), [config.defaultGain, points, stepId]);
  const { result, error, isLoading } = useControlEngine(request);

  useEffect(() => {
    if (!draggingId) {
      return undefined;
    }

    const handleMove = (event: PointerEvent) => {
      const track = trackRef.current;
      if (!track) return;
      const chart = chartRef.current;
      if (!chart) return;
      const rect = track.getBoundingClientRect();
      const axisPoint = chart.convertFromPixel(
        { xAxisIndex: 0, yAxisIndex: 0 },
        [event.clientX - rect.left, event.clientY - rect.top],
      );
      if (!Array.isArray(axisPoint) || axisPoint.length < 2 || !Number.isFinite(Number(axisPoint[0]))) {
        return;
      }
      const nextPosition = Number(clamp(Number(axisPoint[0]), config.range.min, config.range.max).toFixed(2));
      setPoints((previous) =>
        previous.map((point) =>
          point.id === draggingId && point.draggable ? { ...point, position: nextPosition } : point,
        ),
      );
      onWorkspaceParameterChange?.({ key: draggingId, value: nextPosition, source: 'drag' });
    };

    const handleUp = () => setDraggingId(null);

    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
    };
  }, [config.range.max, config.range.min, draggingId, onWorkspaceParameterChange]);

  const currentFormula = useMemo(() => formatCurrentFormula(points), [points]);

  return (
    <div className="premium-lesson-surface-elevated mt-4 rounded-3xl px-4 py-4">
      <div className="premium-lesson-title text-base font-semibold">{config.title}</div>
      <div className="premium-lesson-muted mt-2 text-sm leading-7">{config.intro}</div>

      <div className="mt-4 grid items-stretch gap-4 lg:grid-cols-[minmax(0,1.24fr)_minmax(320px,0.76fr)]">
        <div className="flex h-full flex-col rounded-2xl border border-border/60 bg-background/55 px-4 py-4">
          <div className="premium-lesson-title text-sm font-medium">根轨迹面板</div>
          <div className="premium-lesson-muted mt-2 text-sm">
            面板沿统一仿真引擎实时重算。开环零点可直接拖动，开环极点保持为叉形标注，当前闭环极点仍沿用图中的原始显示。
          </div>
          <div className="relative mt-4 flex-1">
            {isLoading && !result ? (
              <div className="flex h-full min-h-[520px] items-center justify-center rounded-2xl border border-border/60 bg-background/80 px-6 text-sm text-foreground/65">
                统一仿真引擎正在计算根轨迹。
              </div>
            ) : result ? (
              <RootLocusPanel
                result={result}
                caseId={ROOT_LOCUS_CASE_ID[stepId]}
                axisPresetOverride={{ x: [config.range.min, config.range.max], y: [config.imagRange.min, config.imagRange.max] }}
                interactiveLayerRef={trackRef}
                onChartReady={(chart) => {
                  chartRef.current = chart;
                }}
                interactiveHandles={points.map((point, index) => ({
                  id: point.id,
                  kind: point.kind,
                  point: { re: point.position, im: 0 },
                  draggable: point.draggable,
                  ariaLabel:
                    point.kind === 'zero'
                      ? `开环零点 ${point.position} 可拖动`
                      : `开环极点 ${index + 1} 固定`,
                  cursor: point.draggable ? 'ew-resize' : undefined,
                }))}
                onHandlePointerDown={(handleId, event) => {
                  event.preventDefault();
                  setDraggingId(handleId);
                }}
                className="flex h-full flex-col"
                chartClassName="h-full min-h-[520px]"
              />
            ) : (
              <div className="flex h-full min-h-[520px] items-center justify-center rounded-2xl border border-border/60 bg-background/80 px-6 text-sm text-foreground/65">
                根轨迹结果暂不可用。
              </div>
            )}
          </div>
        </div>

        <div className="flex h-full flex-col rounded-2xl border border-border/60 bg-background/55 px-4 py-4">
          <div className="premium-lesson-title text-sm font-medium">模式切换</div>
          <div className="premium-lesson-muted mt-2 text-sm">
            控件区只保留“基线”和“添加零点”两种模式。切换模式会恢复默认位置，方便你反复对照同一组极点与不同零点位置。
          </div>
          <div className="mt-3 grid gap-2">
            {config.modes.map((mode) => (
              <button
                key={mode.key}
                type="button"
                onClick={() => {
                  setModeKey(mode.key);
                  setPoints(clonePoints(mode.points));
                  setDraggingId(null);
                  onWorkspaceParameterChange?.({ key: `${stepId}:mode`, value: mode.key, source: 'button' });
                }}
                className={`premium-lesson-control justify-between ${modeKey === mode.key ? 'ring-2 ring-cyan-400' : ''}`}
              >
                <span>{mode.label}</span>
                <span className="premium-lesson-caption text-xs">{mode.points.some((point) => point.draggable) ? '拖动零点标注' : '固定基线'}</span>
              </button>
            ))}
          </div>

          <div className="mt-4 rounded-2xl border border-border/50 bg-background/70 px-3 py-3">
            <div className="premium-lesson-title text-sm font-medium">当前模式对象式</div>
            <div className="mt-2 text-sm [&_.katex-display]:m-0">
              <BlockMath math={currentMode.formula} />
            </div>
          </div>

          <div className="mt-4 rounded-2xl border border-border/50 bg-background/70 px-3 py-3">
            <div className="premium-lesson-title text-sm font-medium">当前开环传函</div>
            <div className="mt-2 text-sm [&_.katex-display]:m-0">
              <BlockMath math={currentFormula} />
            </div>
          </div>

          <div className="mt-4 flex-1 rounded-2xl border border-border/50 bg-background/70 px-3 py-3">
            <div className="premium-lesson-title text-sm font-medium">当前零极点</div>
            <div className="mt-3 grid gap-2">
              {points.map((point) => (
                <div key={point.id} className="flex items-center justify-between gap-3 rounded-2xl border border-border/50 px-3 py-2 text-sm">
                  <div>
                    <span className="font-medium">{point.kind === 'pole' ? '开环极点' : '开环零点'}</span>
                    <span className="premium-lesson-muted ml-2">{point.position.toFixed(2)}</span>
                  </div>
                  <span className="premium-lesson-caption text-xs">{point.draggable ? '可拖动' : '固定'}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {error ? <div className="premium-lesson-tone-block premium-tone-rose mt-4 text-sm">{error}</div> : null}
    </div>
  );
}
