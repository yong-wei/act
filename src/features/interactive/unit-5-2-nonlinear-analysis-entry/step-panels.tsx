'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';

import {
  createManifestContentModuleRegistry,
} from '@/features/interactive/shared/manifest-runtime/content-renderers';
import {
  InteractiveSvgMarkerDefs,
  InteractiveSvgMarkerRegistry,
  InteractiveSvgPointMarker,
  INTERACTIVE_SVG_PRODUCTION_ARROW_KIND,
  type InteractiveSvgMarkerKind,
} from '@/features/interactive/shared/interactive-svg-markers';
import {
  createManifestStudentActivityRegistry,
  createManifestTeacherActivityRegistry,
  renderStudentInteractiveActivity,
  renderTeacherInteractiveActivity,
  type ManifestStepResponse,
} from '@/features/interactive/shared/manifest-runtime/activity-renderers';
import {
  type InteractiveModuleRegistry,
  renderInteractiveManifestStep,
  type InteractiveRuntimeModuleManifest,
  type InteractiveRuntimeStepManifest,
} from '@/features/interactive/shared/manifest-runtime/layout-renderer';
import {
  getUNIT_5_2ManifestStepFromManifest,
  type UNIT_5_2StepDefinition,
} from '@/lib/unit-5-2-course';
import type { InteractiveRuntimeManifest } from '@/lib/interactive-lesson-manifest';
import {
  createFallbackNonlinearAnalysisResult,
  useNonlinearAnalysisEngine,
} from '@/resources/control-system/analysis/use-nonlinear-analysis-engine';
import type {
  NonlinearAnalysisRequest,
  NonlinearAnalysisResult,
  NonlinearPoint,
} from '@/resources/control-system/analysis/nonlinear-analysis-types';

type TeacherResponseItem = { studentName: string; response: ManifestStepResponse };
type ContentRecord = Record<string, unknown>;
type ParameterRecord = Record<string, number | string | boolean>;
type ContentRegistryExtra = {
  revealProgress: number;
  allowInlineReveal: boolean;
  onInlineReveal?: () => void;
};
type CurveSeries = {
  id: string;
  label: string;
  color: string;
  points: NonlinearPoint[];
  dashed?: boolean;
  marks?: Record<string, string>;
  selectedPoint?: NonlinearPoint & { amplitude?: number };
};
type AxisRange = { x: [number, number]; y: [number, number] };
type P11ComplexPoint = { re: number; im: number };
type P11CubicSegment = {
  start: P11ComplexPoint;
  c1: P11ComplexPoint;
  c2: P11ComplexPoint;
  end: P11ComplexPoint;
  samples?: number;
};
type P11PerturbationIntersection = P11ComplexPoint & {
  id: string;
  label: string;
  type: 'stable_limit_cycle' | 'unstable_limit_cycle';
  amplitude: number;
  curveIndex: number;
};
type P11ReleaseTarget = 'drag' | 'curve_start' | 'A2' | 'self';
type PerturbationPointPosition = {
  index: number;
  direction: 'lower_amplitude' | 'higher_amplitude';
  releaseTarget?: P11ReleaseTarget;
};
type P11MotionPlan = {
  fromIndex: number;
  toIndex: number;
  direction: 'lower_amplitude' | 'higher_amplitude';
  releaseTarget: P11ReleaseTarget;
  startedAt: number;
  durationMs: number;
};
type SliderConfig = { id: string; label: string; min: number; max: number; default: number; step: number };
type TabConfig = { id: string; label: string; controls: SliderConfig[] };
type CharacteristicPanelConfig = { tabs: TabConfig[] };
type NegativeInverseFamilyConfig = { id: string; label: string; controls: SliderConfig[] };
const UNIT_5_2_ARROW_KINDS: InteractiveSvgMarkerKind[] = [INTERACTIVE_SVG_PRODUCTION_ARROW_KIND];
const UNIT_5_2_AXIS_ARROW_PREFIX = 'unit-5-2-axis';
const UNIT_5_2_VECTOR_ARROW_PREFIX = 'unit-5-2-vector';
const UNIT_5_2_PERTURB_ARROW_PREFIX = 'unit-5-2-perturb';
const UNIT_5_2_AXIS_ARROW_URL = InteractiveSvgMarkerRegistry.markerUrl(
  INTERACTIVE_SVG_PRODUCTION_ARROW_KIND,
  UNIT_5_2_AXIS_ARROW_PREFIX,
);
const UNIT_5_2_VECTOR_ARROW_URL = InteractiveSvgMarkerRegistry.markerUrl(
  INTERACTIVE_SVG_PRODUCTION_ARROW_KIND,
  UNIT_5_2_VECTOR_ARROW_PREFIX,
);
const UNIT_5_2_PERTURB_ARROW_URL = InteractiveSvgMarkerRegistry.markerUrl(
  INTERACTIVE_SVG_PRODUCTION_ARROW_KIND,
  UNIT_5_2_PERTURB_ARROW_PREFIX,
);

const CHARACTERISTIC_PANEL_CONFIGS: Record<string, CharacteristicPanelConfig> = {
  rust_memoryless_nonlinearity_tabs: {
    tabs: [
      {
        id: 'saturation',
        label: '饱和',
        controls: [
          { id: 'k', label: '斜率 k', min: 0.2, max: 5, default: 1, step: 0.1 },
          { id: 'a', label: '饱和阈值 a', min: 0.2, max: 5, default: 1, step: 0.1 },
          { id: 'A', label: '输入幅值 A', min: 0.05, max: 8, default: 2, step: 0.05 },
        ],
      },
      {
        id: 'deadzone',
        label: '死区',
        controls: [
          { id: 'k', label: '斜率 k', min: 0.2, max: 5, default: 1, step: 0.1 },
          { id: 'Delta', label: '死区宽度 Δ', min: 0.1, max: 3, default: 0.5, step: 0.05 },
          { id: 'A', label: '输入幅值 A', min: 0.05, max: 8, default: 2, step: 0.05 },
        ],
      },
      {
        id: 'deadzone_saturation',
        label: '死区饱和',
        controls: [
          { id: 'k', label: '斜率 k', min: 0.2, max: 5, default: 1, step: 0.1 },
          { id: 'Delta', label: '死区宽度 Δ', min: 0.1, max: 3, default: 0.5, step: 0.05 },
          { id: 'a', label: '饱和阈值 a', min: 0.2, max: 5, default: 2, step: 0.05 },
          { id: 'A', label: '输入幅值 A', min: 0.05, max: 8, default: 3, step: 0.05 },
        ],
      },
    ],
  },
  rust_relay_hysteresis_backlash_tabs: {
    tabs: [
      {
        id: 'relay',
        label: '理想继电',
        controls: [
          { id: 'M', label: '继电幅值 M', min: 0.2, max: 5, default: 1, step: 0.1 },
          { id: 'A', label: '输入幅值 A', min: 0.05, max: 8, default: 2, step: 0.05 },
        ],
      },
      {
        id: 'deadzone_relay',
        label: '死区继电',
        controls: [
          { id: 'M', label: '继电幅值 M', min: 0.2, max: 5, default: 1, step: 0.1 },
          { id: 'd', label: '死区门槛 d', min: 0.1, max: 3, default: 0.5, step: 0.05 },
          { id: 'A', label: '输入幅值 A', min: 0.05, max: 8, default: 2, step: 0.05 },
        ],
      },
      {
        id: 'hysteresis_relay',
        label: '滞环继电',
        controls: [
          { id: 'M', label: '继电幅值 M', min: 0.2, max: 5, default: 1, step: 0.1 },
          { id: 'h', label: '滞环半宽 h', min: 0.1, max: 3, default: 0.5, step: 0.05 },
          { id: 'A', label: '输入幅值 A', min: 0.05, max: 8, default: 2, step: 0.05 },
        ],
      },
      {
        id: 'backlash',
        label: '间隙',
        controls: [
          { id: 'k', label: '斜率 k', min: 0.2, max: 5, default: 1, step: 0.1 },
          { id: 'b', label: '间隙宽度 b', min: 0.1, max: 3, default: 0.5, step: 0.05 },
          { id: 'A', label: '输入幅值 A', min: 0.05, max: 8, default: 2, step: 0.05 },
        ],
      },
    ],
  },
};

const PHASE_TABS = [
  { id: 'van_der_pol', label: 'Van der Pol' },
  { id: 'damped_second_order', label: '阻尼二阶' },
  { id: 'stable_focus', label: '稳定焦点' },
];

const PHASE_VIEW_RANGES: Record<string, AxisRange> = {
  van_der_pol: { x: [-3, 3], y: [-4, 4] },
  damped_second_order: { x: [-3, 3], y: [-3, 3] },
  stable_focus: { x: [-3, 3], y: [-3, 3] },
};

const NONLINEARITY_TYPE_LABELS: Record<string, string> = {
  saturation: '饱和',
  deadzone: '死区',
  deadzone_saturation: '死区饱和',
  relay: '理想继电',
  deadzone_relay: '死区继电',
  hysteresis_relay: '滞环继电',
  backlash: '间隙',
};

const LIMIT_CYCLE_TYPE_LABELS: Record<string, string> = {
  unstable_limit_cycle: '非稳定自振点',
  stable_limit_cycle: '稳定自振点',
};

const PERTURBATION_LABELS = ['A1', 'A2'];
const PERTURBATION_VIEW_RANGE: AxisRange = { x: [-4.2, 0.25], y: [-2.25, 1.65] };
const PERTURBATION_PLOT = { left: 42, right: 678, top: 32, bottom: 428 };
const P11_RELEASE_MOTION_MIN_DURATION_MS = 1200;
const P11_RELEASE_MOTION_MAX_DURATION_MS = 1900;
const P11_PERTURBATION_GEOMETRY = {
  linearCurveSegments: [
    {
      start: { re: -3.55, im: -2.25 },
      c1: { re: -2, im: 1 },
      c2: { re: -0.8, im: 2 },
      end: { re: 0, im: 0 },
      samples: 80,
    }
  ] satisfies P11CubicSegment[],
  negativeInverseCurveSegments: [
    {
      start: { re: -4, im: -2 },
      c1: { re: -0.1, im: -0.1 },
      c2: { re: -0.1, im: -0.1  },
      end: { re: -4, im: -0.1 },
      samples: 80,
    }
  ] satisfies P11CubicSegment[],
  stableArea: [
    { re: -4.2, im: -2.25 },
    { re: 0, im: -2.25 },
    { re: 0, im: 1.65 },
    { re: -4.2, im: 1.65 },
  ] satisfies P11ComplexPoint[],
};

function requireUnit52Manifest(manifest: InteractiveRuntimeManifest | null | undefined) {
  if (!manifest) {
    throw new Error('5-2 runtime manifest is required for page rendering.');
  }
  return manifest;
}

function asRecord(value: unknown): ContentRecord {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as ContentRecord : {};
}

function asString(value: unknown, fallback = '') {
  return typeof value === 'string' && value.trim() ? value : fallback;
}

function numeric(value: unknown, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function panelId(module: InteractiveRuntimeModuleManifest) {
  return asString(module.payload.panel_id ?? module.payload.panelId, module.id);
}

function defaultTabForPanel(id: string) {
  return CHARACTERISTIC_PANEL_CONFIGS[id]?.tabs[0]?.id ?? 'saturation';
}

function tabConfigForPanel(id: string, tabId: string) {
  const config = CHARACTERISTIC_PANEL_CONFIGS[id];
  return config?.tabs.find((tab) => tab.id === tabId) ?? config?.tabs[0];
}

function negativeInverseFamilies(step: InteractiveRuntimeStepManifest): NegativeInverseFamilyConfig[] {
  const families = Array.isArray(step.interactiveFigureSpec.curve_families)
    ? step.interactiveFigureSpec.curve_families
    : Array.isArray(step.interactiveFigureSpec.curveFamilies)
      ? step.interactiveFigureSpec.curveFamilies
      : [];
  return families
    .map((item) => {
      const record = asRecord(item);
      const controls = Array.isArray(record.controls) ? record.controls : [];
      return {
        id: asString(record.id, ''),
        label: asString(record.label, asString(record.id, '')),
        controls: controls
          .map((control) => {
            const controlRecord = asRecord(control);
            return {
              id: asString(controlRecord.id, ''),
              label: asString(controlRecord.label, asString(controlRecord.id, '')),
              min: numeric(controlRecord.min, 0),
              max: numeric(controlRecord.max, 1),
              default: numeric(controlRecord.default, 0),
              step: numeric(controlRecord.step, 0.1),
            };
          })
          .filter((control) => control.id && control.label),
      };
    })
    .filter((family) => family.id && family.label);
}

function controlRange(family: NegativeInverseFamilyConfig | undefined, id: string, fallback: [number, number]) {
  const control = family?.controls.find((item) => item.id === id);
  return control ? [control.min, control.max] as [number, number] : fallback;
}

function negativeInverseViewRange(family: NegativeInverseFamilyConfig | undefined): AxisRange {
  const amplitudeMax = 8;
  const [mMin] = controlRange(family, 'M', [0.2, 5]);
  const [kMin] = controlRange(family, 'k', [0.2, 5]);
  const relayScale = Math.PI * amplitudeMax / (4 * Math.max(0.05, mMin));
  const slopeScale = amplitudeMax / Math.max(0.05, kMin);
  const realExtent = Math.max(12, relayScale * 1.18, slopeScale * 1.05);

  if (family?.id === 'hysteresis_relay' || family?.id === 'backlash') {
    return { x: [-realExtent, 1], y: [-Math.max(6, realExtent * 0.45), 2] };
  }

  if (family?.id === 'relay') {
    return { x: [-realExtent, 1], y: [-1, 1] };
  }

  return { x: [-Math.max(18, realExtent), 1], y: [-2, 2] };
}

function requestForPanel(id: string, params: ParameterRecord): NonlinearAnalysisRequest {
  if (id === 'rust_phase_plane_tabs') {
    return {
      runtimeMode: 'nonlinear_analysis',
      analysisKind: 'phase_plane',
      modelId: String(params.tab ?? 'van_der_pol'),
      initialPoint: [numeric(params.x0, 1.2), numeric(params.y0, 0.1)],
      parameters: {
        mu: numeric(params.mu, 1),
        zeta: numeric(params.zeta, 0.35),
        omega_n: numeric(params.omega_n, 1),
        alpha: numeric(params.alpha, 0.25),
        beta: numeric(params.beta, 1.2),
      },
      timeRange: { start: 0, end: 8, samples: 180 },
    };
  }

  if (id === 'rust_negative_inverse_family_panel') {
    return {
      runtimeMode: 'nonlinear_analysis',
      analysisKind: 'negative_inverse_family',
      modelId: String(params.nonlinearity_type ?? 'saturation'),
      parameters: {
        k: numeric(params.k, 1),
        a: numeric(params.a, 1),
        Delta: numeric(params.Delta, 0.5),
        M: numeric(params.M, 1),
        h: numeric(params.h, 0.5),
        d: numeric(params.d, 0.5),
        b: numeric(params.b, 0.5),
        A: numeric(params.A, 2),
      },
      timeRange: { start: 0, end: 1, samples: 100 },
    };
  }

  if (id === 'rust_harmonic_lowpass_panel') {
    return {
      runtimeMode: 'nonlinear_analysis',
      analysisKind: 'harmonic_lowpass',
      modelId: 'ideal_relay',
      parameters: {
        A: numeric(params.A, 2),
        omega: numeric(params.omega, 1),
        omega_c: numeric(params.omega_c, 2),
        M: 1,
      },
      timeRange: { start: 0, end: 8, samples: 180 },
    };
  }

  if (CHARACTERISTIC_PANEL_CONFIGS[id]) {
    const tab = String(params.tab ?? defaultTabForPanel(id));
    return {
      runtimeMode: 'nonlinear_analysis',
      analysisKind: 'characteristic',
      modelId: tab,
      parameters: { ...params, nonlinearity_type: tab, omega: numeric(params.omega, 1) },
      timeRange: { start: -8, end: 8, samples: 180 },
    };
  }

  return {
    runtimeMode: 'nonlinear_analysis',
    analysisKind: 'characteristic',
    modelId: String(params.tab ?? 'saturation'),
    parameters: params,
    timeRange: { start: -8, end: 8, samples: 160 },
  };
}

function spectrumValue(item: { harmonic?: number; amplitude?: number; x?: number; y?: number }) {
  return {
    harmonic: item.harmonic ?? item.x ?? 0,
    amplitude: item.amplitude ?? item.y ?? 0,
  };
}

function chartSeries(result: NonlinearAnalysisResult | null): CurveSeries[] {
  if (result?.harmonic) {
    return [
      { id: 'input', label: '正弦输入', color: '#64748b', points: result.harmonic.input },
      { id: 'relayOutput', label: '继电输出', color: '#dc2626', points: result.harmonic.relayOutput },
      { id: 'filteredOutput', label: '低通后输出', color: '#0f766e', points: result.harmonic.filteredOutput },
      {
        id: 'describingFunctionApproximation',
        label: '描述函数近似',
        color: '#2563eb',
        points: result.harmonic.describingFunctionApproximation,
        dashed: true,
      },
    ];
  }

  if (result?.characteristic) {
    return [
      { id: 'characteristic', label: '输入输出特性', color: '#0f766e', points: result.characteristic.curve },
    ];
  }

  if (result?.negativeInverse) {
    return result.negativeInverse.curves.map((curve, index) => ({
      id: curve.id,
      label: NONLINEARITY_TYPE_LABELS[curve.id] ?? curve.label,
      color: index % 2 === 0 ? '#dc2626' : '#7c3aed',
      points: curve.points.map((point) => ({ x: point.re, y: point.im })),
      selectedPoint: curve.selectedPoint
        ? { x: curve.selectedPoint.re, y: curve.selectedPoint.im, amplitude: curve.selectedPoint.amplitude }
        : undefined,
      marks: curve.marks,
    }));
  }

  const phasePoints = result?.phasePlane?.trajectories[0]?.points ?? [];
  return [{ id: 'phase', label: '相轨迹', color: '#0f766e', points: phasePoints, marks: { start: 'phase_start' } }];
}

function SvgCurve({
  series,
  vectorField = [],
  showVectorField = false,
  onPointSelect,
  className = '',
  xLabel = 'x / Re',
  yLabel = '状态 / 输出关系',
  fixedRange,
  fixedRangeId,
}: {
  series: CurveSeries[];
  vectorField?: Array<{ x: number; y: number; dx: number; dy: number }>;
  showVectorField?: boolean;
  onPointSelect?: (point: NonlinearPoint) => void;
  className?: string;
  xLabel?: string;
  yLabel?: string;
  fixedRange?: AxisRange;
  fixedRangeId?: string;
}) {
  const allPoints = series.flatMap((item) => item.points);
  const vectorPoints = vectorField.flatMap((item) => [{ x: item.x, y: item.y }, { x: item.x + item.dx, y: item.y + item.dy }]);
  const selectedPoints = series.flatMap((item) => item.selectedPoint ? [item.selectedPoint] : []);
  const fieldPoints = showVectorField ? [...allPoints, ...vectorPoints, ...selectedPoints] : [...allPoints, ...selectedPoints];
  const safePoints = fieldPoints.length ? fieldPoints : [{ x: 0, y: 0 }];
  const xs = safePoints.map((point) => point.x);
  const ys = safePoints.map((point) => point.y);
  const rawMinX = Math.min(...xs);
  const rawMaxX = Math.max(...xs);
  const rawMinY = Math.min(...ys);
  const rawMaxY = Math.max(...ys);
  const padX = Math.max(0.2, (rawMaxX - rawMinX) * 0.08);
  const padY = Math.max(0.2, (rawMaxY - rawMinY) * 0.08);
  const minX = fixedRange?.x[0] ?? Math.min(rawMinX - padX, 0);
  const maxX = fixedRange?.x[1] ?? Math.max(rawMaxX + padX, 0);
  const minY = fixedRange?.y[0] ?? Math.min(rawMinY - padY, 0);
  const maxY = fixedRange?.y[1] ?? Math.max(rawMaxY + padY, 0);
  const left = 48;
  const right = 486;
  const top = 28;
  const bottom = 256;
  const scaleX = (x: number) => left + ((x - minX) / Math.max(1e-6, maxX - minX)) * (right - left);
  const scaleY = (y: number) => bottom - ((y - minY) / Math.max(1e-6, maxY - minY)) * (bottom - top);
  const axisX = clamp(scaleY(0), top, bottom);
  const axisY = clamp(scaleX(0), left, right);
  const xTicks = Array.from({ length: 5 }, (_, index) => minX + ((maxX - minX) * index) / 4);
  const yTicks = Array.from({ length: 5 }, (_, index) => minY + ((maxY - minY) * index) / 4);
  const invertPoint = (clientX: number, clientY: number, rect: DOMRect) => {
    const svgX = ((clientX - rect.left) / rect.width) * 520;
    const svgY = ((clientY - rect.top) / rect.height) * 292;
    return {
      x: minX + ((svgX - left) / (right - left)) * Math.max(1e-6, maxX - minX),
      y: minY + ((bottom - svgY) / (bottom - top)) * Math.max(1e-6, maxY - minY),
    };
  };

  return (
    <div className={`rounded-xl border border-slate-200 bg-white p-3 ${className}`}>
      <div className="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-600" data-chart-legend="top-outside-plot">
        {series.map((item) => (
          <span key={item.id} className="inline-flex items-center gap-1.5">
            <span
              className="inline-block h-0.5 w-5"
              style={{ backgroundColor: item.color, borderTop: item.dashed ? `2px dashed ${item.color}` : undefined }}
            />
            {item.label}
          </span>
        ))}
      </div>
      <svg
        viewBox="0 0 520 292"
        className={`h-64 w-full ${onPointSelect ? 'cursor-crosshair' : ''}`}
        data-fixed-axis-range={fixedRangeId}
        onPointerDown={(event) => {
          if (!onPointSelect) return;
          const rect = event.currentTarget.getBoundingClientRect();
          onPointSelect(invertPoint(event.clientX, event.clientY, rect));
        }}
      >
        <InteractiveSvgMarkerDefs
          prefix={UNIT_5_2_AXIS_ARROW_PREFIX}
          color="#94a3b8"
          lineStrokeWidth={1.4}
          kinds={UNIT_5_2_ARROW_KINDS}
        />
        <InteractiveSvgMarkerDefs
          prefix={UNIT_5_2_VECTOR_ARROW_PREFIX}
          color="#cbd5e1"
          lineStrokeWidth={1}
          kinds={UNIT_5_2_ARROW_KINDS}
        />
        <rect x={left} y={top} width={right - left} height={bottom - top} fill="#f8fafc" stroke="#e2e8f0" />
        {xTicks.map((tick) => (
          <g key={`x-${tick}`}>
            <line x1={scaleX(tick)} y1={top} x2={scaleX(tick)} y2={bottom} stroke="#e2e8f0" />
            <text x={scaleX(tick)} y={bottom + 18} textAnchor="middle" className="fill-slate-500 text-[12px]" data-axis-font-size="12">{tick.toFixed(1)}</text>
          </g>
        ))}
        {yTicks.map((tick) => (
          <g key={`y-${tick}`}>
            <line x1={left} y1={scaleY(tick)} x2={right} y2={scaleY(tick)} stroke="#e2e8f0" />
            <text x={left - 8} y={scaleY(tick) + 3} textAnchor="end" className="fill-slate-500 text-[12px]" data-axis-font-size="12">{tick.toFixed(1)}</text>
          </g>
        ))}
        <line x1={left} y1={axisX} x2={right} y2={axisX} stroke="#94a3b8" strokeWidth="1.4" markerEnd={UNIT_5_2_AXIS_ARROW_URL} />
        <line x1={axisY} y1={bottom} x2={axisY} y2={top} stroke="#94a3b8" strokeWidth="1.4" markerEnd={UNIT_5_2_AXIS_ARROW_URL} />
        {showVectorField ? vectorField.map((item, index) => {
          const length = Math.hypot(item.dx, item.dy) || 1;
          const dx = (item.dx / length) * 10;
          const dy = (item.dy / length) * 10;
          return (
            <line
              key={`${item.x}:${item.y}:${index}`}
              x1={scaleX(item.x)}
              y1={scaleY(item.y)}
              x2={scaleX(item.x) + dx}
              y2={scaleY(item.y) - dy}
              stroke="#cbd5e1"
              strokeWidth="1"
              markerEnd={UNIT_5_2_VECTOR_ARROW_URL}
              data-vector-arrow="phase-field"
            />
          );
        }) : null}
        {series.map((item) => {
          const d = item.points
            .map((point, index) => `${index === 0 ? 'M' : 'L'} ${scaleX(point.x).toFixed(1)} ${scaleY(point.y).toFixed(1)}`)
            .join(' ');
          return (
            <g key={item.id}>
              <path
                d={d}
                fill="none"
                stroke={item.color}
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray={item.dashed ? '6 5' : undefined}
              />
              {item.marks?.start && item.points[0] ? (
                <InteractiveSvgPointMarker
                  kind="dot-hollow"
                  x={scaleX(item.points[0].x)}
                  y={scaleY(item.points[0].y)}
                  size={12}
                  color={item.color}
                  strokeColor={item.color}
                  strokeWidth={2}
                  data-curve-mark={item.marks.start}
                  data-phase-start-point={item.id === 'phase' ? 'true' : undefined}
                />
              ) : null}
              {item.selectedPoint ? (
                <InteractiveSvgPointMarker
                  kind="dot-filled"
                  x={scaleX(item.selectedPoint.x)}
                  y={scaleY(item.selectedPoint.y)}
                  size={12}
                  color={item.color}
                  data-selected-amplitude={item.selectedPoint.amplitude?.toFixed(2)}
                />
              ) : null}
            </g>
          );
        })}
        <text x={left + 4} y={top - 8} className="fill-slate-500 text-[11px]">{yLabel}</text>
        <text x={right - 46} y={bottom - 8} className="fill-slate-500 text-[11px]">{xLabel}</text>
      </svg>
    </div>
  );
}

function SpectrumBars({ spectrum }: { spectrum: Array<{ harmonic?: number; amplitude?: number; x?: number; y?: number }> }) {
  const bars = spectrum.map(spectrumValue);
  const maxAmplitude = Math.max(...bars.map((item) => item.amplitude), 1e-6);
  return (
    <div className="rounded-lg bg-white p-3">
      <div className="text-xs font-semibold text-slate-700">频率分解</div>
      <div className="mt-3 flex h-20 items-end gap-3">
        {bars.map((item) => (
          <div key={item.harmonic} className="flex flex-1 flex-col items-center gap-1">
            <div
              className="w-full rounded-t bg-teal-500"
              style={{ height: `${Math.max(8, (item.amplitude / maxAmplitude) * 64)}px` }}
              title={`第 ${item.harmonic} 次谐波 ${item.amplitude.toFixed(2)}`}
            />
            <span className="text-[10px] text-slate-500">{item.harmonic}ω</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function sliderControl(label: string, value: number, min: number, max: number, step: number, onChange: (value: number) => void) {
  return (
    <label className="block text-xs font-medium text-slate-600">
      <span className="flex justify-between">
        <span>{label}</span>
        <span>{value.toFixed(2)}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="mt-2 w-full"
      />
    </label>
  );
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function sampleCubicSegment(segment: P11CubicSegment, t: number): P11ComplexPoint {
  const safeT = clamp(t, 0, 1);
  const u = 1 - safeT;
  return {
    re: u ** 3 * segment.start.re
      + 3 * u ** 2 * safeT * segment.c1.re
      + 3 * u * safeT ** 2 * segment.c2.re
      + safeT ** 3 * segment.end.re,
    im: u ** 3 * segment.start.im
      + 3 * u ** 2 * safeT * segment.c1.im
      + 3 * u * safeT ** 2 * segment.c2.im
      + safeT ** 3 * segment.end.im,
  };
}

function sampleCubicSegments(segments: P11CubicSegment[]): P11ComplexPoint[] {
  return segments.flatMap((segment, segmentIndex) => {
    const samples = Math.max(2, segment.samples ?? 40);
    return Array.from({ length: samples }, (_, index) => {
      if (segmentIndex > 0 && index === 0) return null;
      return sampleCubicSegment(segment, index / Math.max(1, samples - 1));
    }).filter((point): point is P11ComplexPoint => point !== null);
  });
}

function cubicSegmentsToSvgPath(
  segments: P11CubicSegment[],
  scaleX: (value: number) => number,
  scaleY: (value: number) => number,
) {
  return segments.map((segment, index) => {
    const command = `C ${scaleX(segment.c1.re).toFixed(1)} ${scaleY(segment.c1.im).toFixed(1)} ${scaleX(segment.c2.re).toFixed(1)} ${scaleY(segment.c2.im).toFixed(1)} ${scaleX(segment.end.re).toFixed(1)} ${scaleY(segment.end.im).toFixed(1)}`;
    if (index === 0) {
      return `M ${scaleX(segment.start.re).toFixed(1)} ${scaleY(segment.start.im).toFixed(1)} ${command}`;
    }
    return command;
  }).join(' ');
}

function pointOnCurve(points: P11ComplexPoint[], index: number): P11ComplexPoint | undefined {
  if (!points.length) return undefined;
  const safeIndex = clamp(index, 0, points.length - 1);
  const lower = Math.floor(safeIndex);
  const upper = Math.ceil(safeIndex);
  if (lower === upper) return points[lower];
  const progress = safeIndex - lower;
  const start = points[lower];
  const end = points[upper];
  return {
    re: start.re + (end.re - start.re) * progress,
    im: start.im + (end.im - start.im) * progress,
  };
}

function easeInOutCubic(progress: number) {
  const t = clamp(progress, 0, 1);
  return t < 0.5 ? 4 * t ** 3 : 1 - ((-2 * t + 2) ** 3) / 2;
}

function releaseMotionDurationForIndexes(fromIndex: number, toIndex: number, curvePointCount: number) {
  const normalizedDistance = clamp(Math.abs(toIndex - fromIndex) / Math.max(1, curvePointCount - 1), 0, 1);
  return Math.round(
    P11_RELEASE_MOTION_MIN_DURATION_MS
      + (P11_RELEASE_MOTION_MAX_DURATION_MS - P11_RELEASE_MOTION_MIN_DURATION_MS) * Math.sqrt(normalizedDistance),
  );
}

function pathBetweenCurveIndexes(points: P11ComplexPoint[], from: number, to: number, scaleX: (value: number) => number, scaleY: (value: number) => number) {
  if (!points.length || Math.abs(to - from) < 0.5) return '';
  const start = Math.round(clamp(from, 0, points.length - 1));
  const end = Math.round(clamp(to, 0, points.length - 1));
  const [first, last] = start <= end ? [start, end] : [end, start];
  return points
    .slice(first, last + 1)
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${scaleX(point.re).toFixed(1)} ${scaleY(point.im).toFixed(1)}`)
    .join(' ');
}

function crossProduct(a: P11ComplexPoint, b: P11ComplexPoint) {
  return a.re * b.im - a.im * b.re;
}

function subtractPoint(a: P11ComplexPoint, b: P11ComplexPoint): P11ComplexPoint {
  return { re: a.re - b.re, im: a.im - b.im };
}

function findSegmentIntersection(
  a: P11ComplexPoint,
  b: P11ComplexPoint,
  c: P11ComplexPoint,
  d: P11ComplexPoint,
) {
  const r = subtractPoint(b, a);
  const s = subtractPoint(d, c);
  const denominator = crossProduct(r, s);
  if (Math.abs(denominator) < 1e-9) return null;

  const cMinusA = subtractPoint(c, a);
  const t = crossProduct(cMinusA, s) / denominator;
  const u = crossProduct(cMinusA, r) / denominator;
  if (t < -1e-6 || t > 1 + 1e-6 || u < -1e-6 || u > 1 + 1e-6) return null;

  return {
    re: a.re + t * r.re,
    im: a.im + t * r.im,
    linearT: clamp(t, 0, 1),
    redT: clamp(u, 0, 1),
  };
}

function findCurveIntersections(linearCurve: P11ComplexPoint[], negativeCurve: P11ComplexPoint[]) {
  const intersections: Array<P11ComplexPoint & { curveIndex: number }> = [];
  for (let linearIndex = 0; linearIndex < linearCurve.length - 1; linearIndex += 1) {
    for (let redIndex = 0; redIndex < negativeCurve.length - 1; redIndex += 1) {
      const intersection = findSegmentIntersection(
        linearCurve[linearIndex],
        linearCurve[linearIndex + 1],
        negativeCurve[redIndex],
        negativeCurve[redIndex + 1],
      );
      if (!intersection) continue;
      const curveIndex = redIndex + intersection.redT;
      const duplicate = intersections.some((item) => Math.abs(item.curveIndex - curveIndex) < 1);
      if (!duplicate) {
        intersections.push({ re: intersection.re, im: intersection.im, curveIndex });
      }
    }
  }
  return intersections.sort((left, right) => left.curveIndex - right.curveIndex);
}

function computePerturbationIntersections(linearCurve: P11ComplexPoint[], negativeCurve: P11ComplexPoint[]): P11PerturbationIntersection[] {
  return findCurveIntersections(linearCurve, negativeCurve).slice(0, 2).map((intersection, index) => {
    const label = index === 0 ? 'A1' : 'A2';
    return {
      ...intersection,
      id: label,
      label,
      amplitude: Number((index + 1).toFixed(2)),
      type: index === 0 ? 'unstable_limit_cycle' : 'stable_limit_cycle',
    };
  });
}

function releaseTargetForPerturbation(
  pointId: string,
  direction: 'lower_amplitude' | 'higher_amplitude',
  basePositions: Record<string, PerturbationPointPosition>,
  negativeCurve: P11ComplexPoint[],
) {
  if (pointId === 'A1' && direction === 'lower_amplitude') {
    return { index: 0, target: 'curve_start' as const };
  }
  if (pointId === 'A1') {
    return { index: basePositions.A2?.index ?? negativeCurve.length - 1, target: 'A2' as const };
  }
  return { index: basePositions[pointId]?.index ?? 0, target: 'self' as const };
}

function perturbationStatus(pointId: string, pointType: string, direction: 'lower_amplitude' | 'higher_amplitude', releaseTarget: P11ReleaseTarget) {
  if (pointId === 'A1' && releaseTarget === 'curve_start') {
    return {
      direction: 'A1 向左扰动后沿红色曲线运动到起始点',
      finalState: 'move_to_curve_start',
      text: 'A1 左侧处于稳定区域，松开后继续沿红色曲线运动到起始端。',
    };
  }

  if (pointId === 'A1' && releaseTarget === 'A2') {
    return {
      direction: 'A1 向右扰动后沿红色曲线运动到 A2',
      finalState: 'move_to_next_stable_point',
      text: 'A1 右侧处于不稳定区域，松开后会继续运动到稳定交点 A2。',
    };
  }

  if (pointType === 'stable_limit_cycle') {
    return {
      direction: direction === 'lower_amplitude' ? `${pointId} 向左扰动后回到 ${pointId}` : `${pointId} 向右扰动后回到 ${pointId}`,
      finalState: 'return_to_same_point',
      text: 'A2 两侧的小扰动都会沿红色曲线回到原稳定交点。',
    };
  }

  return {
    direction: direction === 'lower_amplitude' ? `沿红色曲线左侧远离 ${pointId}` : `沿红色曲线右侧远离 ${pointId}`,
    finalState: 'move_away_or_stop_at_next_stable',
    text: '非稳定自振点的小扰动不会回到原交点；运动方向由红色曲线上的相对位置给出。',
  };
}

function PerturbationCurvePanel({
  step,
  module,
  onParameterChange,
}: {
  step: InteractiveRuntimeStepManifest;
  module: InteractiveRuntimeModuleManifest;
  onParameterChange?: (stepId: string, values: Record<string, string>) => void;
}) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const motionPlansRef = useRef<Record<string, P11MotionPlan>>({});
  const pointPositionsRef = useRef<Record<string, PerturbationPointPosition>>({});
  const animatedPointPositionsRef = useRef<Record<string, PerturbationPointPosition>>({});
  const negativeCurve = useMemo(
    () => sampleCubicSegments(P11_PERTURBATION_GEOMETRY.negativeInverseCurveSegments),
    [],
  );
  const linearCurve = useMemo(
    () => sampleCubicSegments(P11_PERTURBATION_GEOMETRY.linearCurveSegments),
    [],
  );
  const intersections = useMemo(
    () => computePerturbationIntersections(linearCurve, negativeCurve),
    [linearCurve, negativeCurve],
  );
  const [draggingPoint, setDraggingPoint] = useState<string | null>(null);
  const [selectedPointId, setSelectedPointId] = useState('A1');
  const [pointPositions, setPointPositions] = useState<Record<string, PerturbationPointPosition>>({});
  const [animatedPointPositions, setAnimatedPointPositions] = useState<Record<string, PerturbationPointPosition>>({});
  const basePointPositions = useMemo(() => {
    const positions: Record<string, PerturbationPointPosition> = {};
    intersections.forEach((intersection) => {
      let bestIndex = 0;
      let bestDistance = Number.POSITIVE_INFINITY;
      negativeCurve.forEach((point, index) => {
        const distance = Math.hypot(point.re - intersection.re, point.im - intersection.im);
        if (distance < bestDistance) {
          bestDistance = distance;
          bestIndex = index;
        }
      });
      positions[intersection.id] = { index: bestIndex, direction: 'higher_amplitude', releaseTarget: 'self' };
    });
    return positions;
  }, [intersections, negativeCurve]);
  const activePointId = draggingPoint ?? selectedPointId;
  const activeIntersection = intersections.find((item) => item.id === activePointId) ?? intersections[0];
  const activePosition = pointPositions[activePointId] ?? basePointPositions[activePointId] ?? { index: 0, direction: 'higher_amplitude' as const };
  const activeReleaseTarget = activePosition.releaseTarget && activePosition.releaseTarget !== 'drag'
    ? activePosition.releaseTarget
    : releaseTargetForPerturbation(activePointId, activePosition.direction, basePointPositions, negativeCurve).target;
  const status = perturbationStatus(activePointId, activeIntersection?.type ?? 'unstable_limit_cycle', activePosition.direction, activeReleaseTarget);
  const scaleX = (re: number) => PERTURBATION_PLOT.left + ((re - PERTURBATION_VIEW_RANGE.x[0]) / (PERTURBATION_VIEW_RANGE.x[1] - PERTURBATION_VIEW_RANGE.x[0])) * (PERTURBATION_PLOT.right - PERTURBATION_PLOT.left);
  const scaleY = (im: number) => PERTURBATION_PLOT.bottom - ((im - PERTURBATION_VIEW_RANGE.y[0]) / (PERTURBATION_VIEW_RANGE.y[1] - PERTURBATION_VIEW_RANGE.y[0])) * (PERTURBATION_PLOT.bottom - PERTURBATION_PLOT.top);
  const gridX = Array.from({ length: 10 }, (_, index) => PERTURBATION_VIEW_RANGE.x[0] + index * 0.5);
  const gridY = Array.from({ length: 9 }, (_, index) => -2 + index * 0.5);
  const svgPaths = {
    linear_curve_path: cubicSegmentsToSvgPath(P11_PERTURBATION_GEOMETRY.linearCurveSegments, scaleX, scaleY),
    negative_inverse_curve_path: cubicSegmentsToSvgPath(P11_PERTURBATION_GEOMETRY.negativeInverseCurveSegments, scaleX, scaleY),
  };
  const toPolygon = (points: P11ComplexPoint[]) => points
    .map((point) => `${scaleX(point.re).toFixed(1)},${scaleY(point.im).toFixed(1)}`)
    .join(' ');
  const lowestLinearIndex = linearCurve.reduce((bestIndex, point, index) => (
    point.im < linearCurve[bestIndex].im ? index : bestIndex
  ), 0);
  const unstableArea = [
    { re: 0, im: 0 },
    { re: 0, im: PERTURBATION_VIEW_RANGE.y[0] },
    linearCurve[lowestLinearIndex],
    ...linearCurve.slice(lowestLinearIndex),
  ];

  useEffect(() => {
    if (!draggingPoint) return undefined;
    const previousUserSelect = document.body.style.userSelect;
    document.body.style.userSelect = 'none';
    return () => {
      document.body.style.userSelect = previousUserSelect;
    };
  }, [draggingPoint]);

  useEffect(() => {
    return () => {
      if (animationFrameRef.current !== null) {
        window.cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      motionPlansRef.current = {};
    };
  }, []);

  const runReleaseMotionFrame = (timestamp: number) => {
    const plans = Object.entries(motionPlansRef.current);
    if (!plans.length) {
      animationFrameRef.current = null;
      return;
    }

    const remainingPlans: Record<string, P11MotionPlan> = {};
    const framePositions: Record<string, PerturbationPointPosition> = {};

    for (const [pointId, plan] of plans) {
      const progress = clamp((timestamp - plan.startedAt) / plan.durationMs, 0, 1);
      const easedProgress = easeInOutCubic(progress);
      framePositions[pointId] = {
        index: plan.fromIndex + (plan.toIndex - plan.fromIndex) * easedProgress,
        direction: plan.direction,
        releaseTarget: plan.releaseTarget,
      };
      if (progress < 1) {
        remainingPlans[pointId] = plan;
      }
    }

    motionPlansRef.current = remainingPlans;
    animatedPointPositionsRef.current = {
      ...animatedPointPositionsRef.current,
      ...framePositions,
    };
    setAnimatedPointPositions(animatedPointPositionsRef.current);

    if (Object.keys(remainingPlans).length) {
      animationFrameRef.current = window.requestAnimationFrame(runReleaseMotionFrame);
    } else {
      animationFrameRef.current = null;
    }
  };

  const ensureReleaseMotionFrame = () => {
    if (animationFrameRef.current !== null) return;
    animationFrameRef.current = window.requestAnimationFrame(runReleaseMotionFrame);
  };

  const cancelReleaseMotion = (pointId?: string) => {
    if (pointId) {
      const remainingPlans = { ...motionPlansRef.current };
      delete remainingPlans[pointId];
      motionPlansRef.current = remainingPlans;
    } else {
      motionPlansRef.current = {};
    }
    if (!Object.keys(motionPlansRef.current).length && animationFrameRef.current !== null) {
      window.cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
  };

  const reset = () => {
    cancelReleaseMotion();
    setDraggingPoint(null);
    setSelectedPointId('A1');
    pointPositionsRef.current = {};
    animatedPointPositionsRef.current = {};
    setPointPositions({});
    setAnimatedPointPositions({});
    onParameterChange?.(step.id, {
      draggedPoint: 'reset',
      disturbanceDirection: 'none',
      finalState: 'reset',
    });
  };

  const updatePoint = (pointId: string, clientX: number, clientY: number) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect || !negativeCurve.length) return;
    const svgX = ((clientX - rect.left) / rect.width) * 720;
    const svgY = ((clientY - rect.top) / rect.height) * 460;
    let bestIndex = 0;
    let bestDistance = Number.POSITIVE_INFINITY;
    negativeCurve.forEach((point, index) => {
      const distance = Math.hypot(scaleX(point.re) - svgX, scaleY(point.im) - svgY);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestIndex = index;
      }
    });
    const intersection = intersections.find((item) => item.id === pointId);
    const baseIndex = basePointPositions[pointId]?.index ?? bestIndex;
    const baseCurvePoint = pointOnCurve(negativeCurve, baseIndex);
    const direction: PerturbationPointPosition['direction'] =
      baseCurvePoint && svgX < scaleX(baseCurvePoint.re) ? 'lower_amplitude' : 'higher_amplitude';
    const releaseTarget = releaseTargetForPerturbation(pointId, direction, basePointPositions, negativeCurve);
    const nextStatus = perturbationStatus(pointId, intersection?.type ?? 'unstable_limit_cycle', direction, releaseTarget.target);
    const nextPosition: PerturbationPointPosition = { index: bestIndex, direction, releaseTarget: 'drag' };
    cancelReleaseMotion(pointId);
    pointPositionsRef.current = { ...pointPositionsRef.current, [pointId]: nextPosition };
    animatedPointPositionsRef.current = { ...animatedPointPositionsRef.current, [pointId]: nextPosition };
    setPointPositions(pointPositionsRef.current);
    setAnimatedPointPositions(animatedPointPositionsRef.current);
    setSelectedPointId(pointId);
    onParameterChange?.(step.id, {
      draggedPoint: pointId,
      disturbanceDirection: nextStatus.direction,
      finalState: nextStatus.finalState,
    });
  };

  const stopDragEvent = (event: ReactPointerEvent) => {
    event.preventDefault();
    event.stopPropagation();
  };

  const finishDrag = (event: ReactPointerEvent) => {
    stopDragEvent(event);
    if (draggingPoint && svgRef.current?.hasPointerCapture(event.pointerId)) {
      svgRef.current.releasePointerCapture(event.pointerId);
    }
    if (draggingPoint) {
      const current = pointPositionsRef.current[draggingPoint] ?? basePointPositions[draggingPoint];
      const direction = current?.direction ?? 'higher_amplitude';
      const releaseTarget = releaseTargetForPerturbation(draggingPoint, direction, basePointPositions, negativeCurve);
      const intersection = intersections.find((item) => item.id === draggingPoint);
      const nextStatus = perturbationStatus(draggingPoint, intersection?.type ?? 'unstable_limit_cycle', direction, releaseTarget.target);
      const targetPosition = {
        index: releaseTarget.index,
        direction,
        releaseTarget: releaseTarget.target,
      };
      pointPositionsRef.current = {
        ...pointPositionsRef.current,
        [draggingPoint]: {
          index: releaseTarget.index,
          direction,
          releaseTarget: releaseTarget.target,
        },
      };
      setPointPositions(pointPositionsRef.current);
      motionPlansRef.current = {
        ...motionPlansRef.current,
        [draggingPoint]: {
          fromIndex: animatedPointPositionsRef.current[draggingPoint]?.index ?? current?.index ?? releaseTarget.index,
          toIndex: releaseTarget.index,
          direction,
          releaseTarget: releaseTarget.target,
          startedAt: performance.now(),
          durationMs: releaseMotionDurationForIndexes(
            animatedPointPositionsRef.current[draggingPoint]?.index ?? current?.index ?? releaseTarget.index,
            releaseTarget.index,
            negativeCurve.length,
          ),
        },
      };
      animatedPointPositionsRef.current = {
        ...animatedPointPositionsRef.current,
        [draggingPoint]: {
          index: animatedPointPositionsRef.current[draggingPoint]?.index ?? current?.index ?? targetPosition.index,
          direction,
          releaseTarget: releaseTarget.target,
        },
      };
      setAnimatedPointPositions(animatedPointPositionsRef.current);
      ensureReleaseMotionFrame();
      setSelectedPointId(draggingPoint);
      onParameterChange?.(step.id, {
        draggedPoint: draggingPoint,
        disturbanceDirection: nextStatus.direction,
        finalState: nextStatus.finalState,
      });
    }
    setDraggingPoint(null);
  };

  return (
    <section
      className="premium-lesson-panel space-y-4"
      data-nonlinear-panel="interactive_perturbation_curve_panel"
      data-interactive-figure-kind="native_svg_perturbation_curve_panel"
      data-dragged-point={activePointId}
      data-disturbance-direction={status.direction}
      data-final-state={status.finalState}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="premium-lesson-title text-base font-semibold leading-7 tracking-normal">{asString(module.payload.title ?? module.title, step.title)}</h3>
        </div>
        <button type="button" onClick={reset} className="premium-lesson-button-secondary text-sm">重置</button>
      </div>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_20rem]" data-perturbation-layout="figure-left-status-right">
        {draggingPoint ? (
          <div
            className="fixed inset-0 z-50 cursor-grabbing"
            data-perturbation-drag-lock="active"
            onPointerMove={(event) => {
              stopDragEvent(event);
              updatePoint(draggingPoint, event.clientX, event.clientY);
            }}
            onPointerUp={finishDrag}
            onPointerCancel={finishDrag}
          />
        ) : null}
        <svg
          ref={svgRef}
          viewBox="0 0 720 460"
          className="h-[460px] w-full touch-none rounded-xl border border-slate-200 bg-white"
          data-perturbation-figure="tex-figure-6"
          onPointerMove={(event) => {
            if (!draggingPoint) return;
            stopDragEvent(event);
            updatePoint(draggingPoint, event.clientX, event.clientY);
          }}
          onPointerUp={finishDrag}
          onPointerCancel={finishDrag}
          onPointerLeave={(event) => {
            if (draggingPoint) stopDragEvent(event);
          }}
        >
          <InteractiveSvgMarkerDefs
            prefix={UNIT_5_2_PERTURB_ARROW_PREFIX}
            color="#dc2626"
            lineStrokeWidth={4}
            kinds={UNIT_5_2_ARROW_KINDS}
          />
          <InteractiveSvgMarkerDefs
            prefix={UNIT_5_2_AXIS_ARROW_PREFIX}
            color="#94a3b8"
            lineStrokeWidth={1.3}
            kinds={UNIT_5_2_ARROW_KINDS}
          />
          <rect x={PERTURBATION_PLOT.left} y={PERTURBATION_PLOT.top} width={PERTURBATION_PLOT.right - PERTURBATION_PLOT.left} height={PERTURBATION_PLOT.bottom - PERTURBATION_PLOT.top} fill="#f8fafc" stroke="#e2e8f0" />
          <rect
            x={PERTURBATION_PLOT.left}
            y={PERTURBATION_PLOT.top}
            width={scaleX(0) - PERTURBATION_PLOT.left}
            height={PERTURBATION_PLOT.bottom - PERTURBATION_PLOT.top}
            fill="#d7d6ff"
            opacity="0.85"
            data-stable-half-plane="left"
          />
          <polygon points={toPolygon(unstableArea)} fill="#fff7ed" opacity="0.88" data-unstable-boundary="blue-curve" />
          {gridX.map((tick) => (
            <line key={`px-${tick}`} x1={scaleX(tick)} y1={PERTURBATION_PLOT.top} x2={scaleX(tick)} y2={PERTURBATION_PLOT.bottom} stroke="#cbd5e1" strokeWidth="1" />
          ))}
          {gridY.map((tick) => (
            <line key={`py-${tick}`} x1={PERTURBATION_PLOT.left} y1={scaleY(tick)} x2={PERTURBATION_PLOT.right} y2={scaleY(tick)} stroke="#cbd5e1" strokeWidth="1" />
          ))}
          <line
            x1={PERTURBATION_PLOT.left + 16}
            y1={scaleY(0)}
            x2={PERTURBATION_PLOT.right - 10}
            y2={scaleY(0)}
            stroke="#94a3b8"
            strokeWidth="1.3"
            markerEnd={UNIT_5_2_AXIS_ARROW_URL}
            data-axis-arrow="real-axis"
          />
          <line
            x1={scaleX(0)}
            y1={PERTURBATION_PLOT.bottom - 10}
            x2={scaleX(0)}
            y2={PERTURBATION_PLOT.top + 16}
            stroke="#94a3b8"
            strokeWidth="1.3"
            markerEnd={UNIT_5_2_AXIS_ARROW_URL}
            data-axis-arrow="imaginary-axis"
          />
          <path d={svgPaths.linear_curve_path} fill="none" stroke="#1d4ed8" strokeWidth="4" data-svg-path-id="linear_curve_path" />
          <path d={svgPaths.negative_inverse_curve_path} fill="none" stroke="#dc2626" strokeWidth="4" strokeLinecap="round" markerEnd={UNIT_5_2_PERTURB_ARROW_URL} data-perturbation-drag-path="negative-inverse" data-svg-path-id="negative_inverse_curve_path" data-curve-arrow-position="path-end" />
          <text x="128" y="82" className="fill-blue-700 text-[24px] font-semibold">稳定区域</text>
          <text x="408" y="338" className="fill-orange-600 text-[24px] font-semibold">不稳定区域</text>
          <text x={scaleX(-2.25)} y={scaleY(0.55)} className="fill-blue-700 text-[18px] italic">G(jω)</text>
          <text x={scaleX(-2.2)} y={scaleY(-0.85)} className="fill-red-700 text-[18px]">-1/N(A)</text>
          <text x={scaleX(0.02)} y={scaleY(0) + 20} className="fill-slate-900 text-[14px]">0</text>
          <text x={scaleX(0.1)} y={scaleY(0) + 32} className="fill-slate-900 text-[20px]">Re</text>
          <text x={scaleX(0) - 24} y={scaleY(PERTURBATION_VIEW_RANGE.y[1]) + 8} className="fill-slate-900 text-[20px]">Im</text>
          {intersections.map((intersection) => {
            const targetPosition = pointPositions[intersection.id] ?? basePointPositions[intersection.id] ?? { index: 0, direction: 'higher_amplitude' as const };
            const animatedPosition = animatedPointPositions[intersection.id] ?? targetPosition;
            const curvePoint = pointOnCurve(negativeCurve, animatedPosition.index) ?? intersection;
            const selected = selectedPointId === intersection.id;
            const trailPath = pathBetweenCurveIndexes(negativeCurve, basePointPositions[intersection.id]?.index ?? targetPosition.index, animatedPosition.index, scaleX, scaleY);
            const releaseTarget = releaseTargetForPerturbation(intersection.id, targetPosition.direction, basePointPositions, negativeCurve);
            return (
              <g
                key={intersection.id}
                data-animated-red-curve-motion="true"
                data-release-target={releaseTarget.index}
                data-auto-motion-target={pointPositions[intersection.id]?.releaseTarget ?? "drag"}
              >
                {trailPath ? (
                  <path
                    d={trailPath}
                    fill="none"
                    stroke={intersection.type === 'unstable_limit_cycle' ? '#f97316' : '#22c55e'}
                    strokeWidth="5"
                    strokeLinecap="round"
                    opacity="0.55"
                    data-red-motion-trail={intersection.id}
                  />
                ) : null}
                <InteractiveSvgPointMarker
                  kind="dot-hollow"
                  x={scaleX(curvePoint.re)}
                  y={scaleY(curvePoint.im)}
                  size={selected ? 28 : 24}
                  color={intersection.type === 'unstable_limit_cycle' ? '#dc2626' : '#16a34a'}
                  fillColor={intersection.type === 'unstable_limit_cycle' ? '#fee2e2' : '#dcfce7'}
                  strokeColor={intersection.type === 'unstable_limit_cycle' ? '#dc2626' : '#16a34a'}
                  strokeWidth={1.5}
                  data-limit-cycle-type={intersection.type}
                  data-drag-constraint="red-negative-inverse-curve"
                  onPointerDown={(event) => {
                    stopDragEvent(event);
                    setDraggingPoint(intersection.id);
                    setSelectedPointId(intersection.id);
                    svgRef.current?.setPointerCapture(event.pointerId);
                    updatePoint(intersection.id, event.clientX, event.clientY);
                  }}
                />
                <text
                  x={scaleX(curvePoint.re) - 9}
                  y={scaleY(curvePoint.im) + 4}
                  className="pointer-events-none fill-slate-900 text-[14px] font-semibold"
                  data-perturbation-label={intersection.id}
                >
                  {intersection.label}
                </text>
              </g>
            );
          })}
        </svg>
        <div className="grid content-start gap-3">
          <div className="rounded-lg bg-slate-50 p-3 text-xs leading-6 text-slate-700">
            <div className="font-semibold text-slate-900">拖动点</div>
            <div>{activePointId} · {LIMIT_CYCLE_TYPE_LABELS[activeIntersection?.type ?? ''] ?? activeIntersection?.type}</div>
          </div>
          <div className="rounded-lg bg-slate-50 p-3 text-xs leading-6 text-slate-700">
            <div className="font-semibold text-slate-900">扰动方向</div>
            <div>{status.direction}</div>
          </div>
          <div className="rounded-lg bg-slate-50 p-3 text-xs leading-6 text-slate-700">
            <div className="font-semibold text-slate-900">稳定性回判</div>
            <div>{status.text}</div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Unit52NonlinearEnginePanel({
  id,
  step,
  module,
  onParameterChange,
}: {
  id: string;
  step: InteractiveRuntimeStepManifest;
  module: InteractiveRuntimeModuleManifest;
  onParameterChange?: (stepId: string, values: Record<string, string>) => void;
}) {
  const [params, setParams] = useState<ParameterRecord>({
    tab: id === 'rust_phase_plane_tabs' ? 'van_der_pol' : defaultTabForPanel(id),
    nonlinearity_type: 'saturation',
    x0: 1.2,
    y0: 0.1,
    A: 2,
    omega: 1,
    omega_c: 2,
    k: 1,
    a: 1,
    Delta: 0.5,
    M: 1,
    h: 0.5,
    d: 0.5,
    b: 0.5,
    zeta: 0.35,
    omega_n: 1,
    alpha: 0.25,
    beta: 1.2,
  });
  const [showVectorField, setShowVectorField] = useState(true);
  const request = useMemo(() => requestForPanel(id, params), [id, params]);
  const fallback = useMemo(() => createFallbackNonlinearAnalysisResult(request), [request]);
  const {
    result,
    error,
    isFallback,
    requestKey,
    resultRequestKey,
  } = useNonlinearAnalysisEngine(request, fallback);
  const displayResult = resultRequestKey === requestKey ? result : null;
  const series = chartSeries(displayResult);
  const activeCharacteristicTab = tabConfigForPanel(id, String(params.tab));
  const activeNegativeFamily = useMemo(() => {
    const families = negativeInverseFamilies(step);
    return families.find((family) => family.id === params.nonlinearity_type) ?? families[0];
  }, [params.nonlinearity_type, step]);
  const phaseViewRange = PHASE_VIEW_RANGES[String(params.tab)] ?? PHASE_VIEW_RANGES.van_der_pol;
  const harmonicAmplitude = Math.max(1.5, numeric(params.A, 2));
  const negativeInverseRange = negativeInverseViewRange(activeNegativeFamily);
  const characteristicSignalSeries = useMemo<CurveSeries[]>(() => {
    const comparison = displayResult?.characteristic?.signalComparison;
    if (!comparison) return [];
    return [
      { id: 'inputSignal', label: '输入正弦信号', color: '#2563eb', points: comparison.input },
      { id: 'nonlinearOutput', label: '非线性输出', color: '#dc2626', points: comparison.output },
    ];
  }, [displayResult]);

  const currentSnapshot = useMemo(() => {
    const snapshot: Record<string, string> = {
      ...Object.fromEntries(Object.entries(params).map(([itemKey, itemValue]) => [itemKey, String(itemValue)])),
      tab_id: String(params.tab ?? ''),
      initial_point: `${numeric(params.x0, 0).toFixed(2)},${numeric(params.y0, 0).toFixed(2)}`,
    };
    if (displayResult?.summary.outcome) {
      snapshot.trajectory_outcome = displayResult.summary.outcome;
    }
    return snapshot;
  }, [displayResult?.summary.outcome, params]);

  useEffect(() => {
    onParameterChange?.(step.id, currentSnapshot);
  }, [currentSnapshot, onParameterChange, step.id]);

  const updateParam = (key: string, value: number | string) => {
    setParams((prev) => ({ ...prev, [key]: value }));
  };
  const handlePhasePointSelect = (point: NonlinearPoint) => {
    if (id !== 'rust_phase_plane_tabs') return;
    setParams((prev) => ({
      ...prev,
      x0: Number(point.x.toFixed(2)),
      y0: Number(point.y.toFixed(2)),
    }));
  };
  const controlsPanel = (
    <div className="space-y-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
      {id === 'rust_phase_plane_tabs' ? (
        <div className="grid grid-cols-3 gap-2 text-xs">
          {PHASE_TABS.map((tab) => (
            <button
              type="button"
              key={tab.id}
              onClick={() => updateParam('tab', tab.id)}
              className={`rounded-md border px-2 py-2 ${params.tab === tab.id ? 'border-teal-500 bg-teal-50 text-teal-800' : 'border-slate-200 bg-white text-slate-700'}`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      ) : null}
      {id === 'rust_phase_plane_tabs' ? (
        <label className="flex items-center justify-between gap-3 rounded-lg bg-white px-3 py-2 text-xs font-medium text-slate-700">
          <span>显示向量场</span>
          <input
            type="checkbox"
            checked={showVectorField}
            onChange={(event) => setShowVectorField(event.target.checked)}
          />
        </label>
      ) : null}
      {CHARACTERISTIC_PANEL_CONFIGS[id] ? (
        <div className="grid grid-cols-2 gap-2 text-xs">
          {CHARACTERISTIC_PANEL_CONFIGS[id].tabs.map((tab) => (
            <button
              type="button"
              key={tab.id}
              onClick={() => updateParam('tab', tab.id)}
              className={`rounded-md border px-2 py-2 ${params.tab === tab.id ? 'border-teal-500 bg-teal-50 text-teal-800' : 'border-slate-200 bg-white text-slate-700'}`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      ) : null}
      {id === 'rust_negative_inverse_family_panel' ? (
        <select
          value={String(params.nonlinearity_type)}
          onChange={(event) => updateParam('nonlinearity_type', event.target.value)}
          className="premium-lesson-input text-sm"
        >
          {['saturation', 'deadzone', 'deadzone_saturation', 'relay', 'deadzone_relay', 'hysteresis_relay', 'backlash'].map((item) => (
            <option key={item} value={item}>{NONLINEARITY_TYPE_LABELS[item] ?? item}</option>
          ))}
        </select>
      ) : null}
      {id === 'rust_harmonic_lowpass_panel' ? (
        <>
          {sliderControl('输入幅值 A', numeric(params.A, 2), 0.05, 8, 0.05, (value) => updateParam('A', value))}
          {sliderControl('输入角频率 ω', numeric(params.omega, 1), 0.2, 5, 0.1, (value) => updateParam('omega', value))}
          {sliderControl('低通截止角频率 ωc', numeric(params.omega_c, 2), 0.2, 8, 0.1, (value) => updateParam('omega_c', value))}
        </>
      ) : null}
      {CHARACTERISTIC_PANEL_CONFIGS[id] ? (
        <>
          {sliderControl('输入角频率 ω', numeric(params.omega, 1), 0.2, 5, 0.1, (value) => updateParam('omega', value))}
          {activeCharacteristicTab?.controls.map((control) => (
            <div key={control.id}>
              {sliderControl(
                control.label,
                numeric(params[control.id], control.default),
                control.min,
                control.max,
                control.step,
                (value) => updateParam(control.id, value),
              )}
            </div>
          ))}
        </>
      ) : null}
      {id === 'rust_negative_inverse_family_panel' ? (
        <>
          {sliderControl('当前幅值 A', numeric(params.A, 2), 0.05, 8, 0.05, (value) => updateParam('A', value))}
          {(activeNegativeFamily?.controls ?? []).map((control) => (
            <div key={control.id}>
              {sliderControl(
                control.label,
                numeric(params[control.id], control.default),
                control.min,
                control.max,
                control.step,
                (value) => updateParam(control.id, value),
              )}
            </div>
          ))}
        </>
      ) : null}
      {displayResult?.harmonic?.spectrum ? <SpectrumBars spectrum={displayResult.harmonic.spectrum} /> : null}
      <div className="rounded-lg bg-white p-3 text-xs leading-6 text-slate-600">
        <div className="font-semibold text-slate-800">{displayResult?.summary.outcome ?? '等待计算'}</div>
        {(displayResult?.summary.metrics ?? []).map((item) => <div key={item}>{item}</div>)}
        {error || (displayResult && isFallback) ? <div className="mt-2 text-amber-700">{error ?? displayResult?.fallbackMessage}</div> : null}
      </div>
    </div>
  );

  return (
    <section className="premium-lesson-panel space-y-4" data-nonlinear-panel={id}>
      <div>
        <h3 className="premium-lesson-title text-base font-semibold leading-7 tracking-normal">{asString(module.payload.title ?? module.title, step.title)}</h3>
      </div>
      {CHARACTERISTIC_PANEL_CONFIGS[id] ? (
        <div className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <div>
              <div className="mb-2 text-sm font-semibold text-slate-800">输入输出关系</div>
              <SvgCurve series={series} xLabel="输入 e" yLabel="输出 u" fixedRange={{ x: [-8, 8], y: [-8, 8] }} />
            </div>
            <div>
              <div className="mb-2 text-sm font-semibold text-slate-800">输入正弦信号与输出对比</div>
              <SvgCurve
                series={characteristicSignalSeries}
                xLabel="t"
                yLabel="信号幅值"
                fixedRange={{ x: [0, Math.PI * 2 / Math.max(0.05, numeric(params.omega, 1))], y: [-Math.max(8, harmonicAmplitude), Math.max(8, harmonicAmplitude)] }}
              />
            </div>
          </div>
          <div data-controls-position="bottom">{controlsPanel}</div>
        </div>
      ) : (
        <div className="grid items-stretch gap-4 lg:grid-cols-[1.4fr_0.9fr]">
          <SvgCurve
            series={series}
            vectorField={displayResult?.phasePlane?.vectorField ?? []}
            showVectorField={id === 'rust_phase_plane_tabs' && showVectorField}
            onPointSelect={id === 'rust_phase_plane_tabs' ? handlePhasePointSelect : undefined}
            fixedRange={id === 'rust_phase_plane_tabs' ? phaseViewRange : id === 'rust_negative_inverse_family_panel' ? negativeInverseRange : { x: [0, 8], y: [-Math.max(8, harmonicAmplitude), Math.max(8, harmonicAmplitude)] }}
            fixedRangeId={id === 'rust_negative_inverse_family_panel' ? 'negative-inverse-family' : id === 'rust_phase_plane_tabs' ? String(params.tab) : 'harmonic-lowpass'}
            className="h-full"
          />
          {controlsPanel}
        </div>
      )}
    </section>
  );
}

export function Unit52NonlinearAnalysisPanel({
  step,
  module,
  onParameterChange,
}: {
  step: InteractiveRuntimeStepManifest;
  module: InteractiveRuntimeModuleManifest;
  onParameterChange?: (stepId: string, values: Record<string, string>) => void;
}) {
  const id = panelId(module);
  if (id === 'interactive_perturbation_curve_panel') {
    return <PerturbationCurvePanel step={step} module={module} onParameterChange={onParameterChange} />;
  }
  return <Unit52NonlinearEnginePanel id={id} step={step} module={module} onParameterChange={onParameterChange} />;
}

export function Unit52StudentSummaryStats({
  submittedCount,
  viewedCount,
  parameterSubmissionCount,
  prePostCompletion,
}: {
  submittedCount: number;
  viewedCount: number;
  parameterSubmissionCount: number;
  prePostCompletion: string;
}) {
  const abilitySummary = parameterSubmissionCount >= 3 ? '已形成参数观察记录' : '继续补齐关键参数页观察';
  return (
    <section className="premium-lesson-panel p-4" data-testid="unit-5-2-student-summary-stats">
      <div className="premium-lesson-title text-base font-semibold leading-7 tracking-normal">个人课堂表现</div>
      <div className="mt-3 grid gap-3 sm:grid-cols-4">
        <div className="premium-lesson-surface-elevated px-3 py-3">
          <div className="premium-lesson-caption text-xs">已浏览页面</div>
          <div className="premium-lesson-title mt-1 text-2xl font-semibold">{viewedCount}</div>
        </div>
        <div className="premium-lesson-surface-elevated px-3 py-3">
          <div className="premium-lesson-caption text-xs">提交页面</div>
          <div className="premium-lesson-title mt-1 text-2xl font-semibold">{submittedCount}</div>
        </div>
        <div className="premium-lesson-surface-elevated px-3 py-3">
          <div className="premium-lesson-caption text-xs">参数探索提交</div>
          <div className="premium-lesson-title mt-1 text-2xl font-semibold">{parameterSubmissionCount}</div>
        </div>
        <div className="premium-lesson-surface-elevated px-3 py-3">
          <div className="premium-lesson-caption text-xs">测验完成</div>
          <div className="premium-lesson-title mt-1 text-sm font-semibold">{prePostCompletion}</div>
        </div>
        <div className="premium-lesson-surface-elevated px-3 py-3 sm:col-span-4">
          <div className="premium-lesson-caption text-xs">学习记录判断</div>
          <div className="premium-lesson-title mt-1 text-sm font-semibold">{abilitySummary}</div>
        </div>
      </div>
    </section>
  );
}

export function Unit52TeacherSummaryStats({
  studentCount,
  submittedStudents,
  totalResponses,
  parameterCoverage,
  objectiveAccuracy,
  postTestCompletion,
  misconceptionSummary,
}: {
  studentCount: number;
  submittedStudents: number;
  totalResponses: number;
  parameterCoverage: number;
  objectiveAccuracy: number;
  postTestCompletion: number;
  misconceptionSummary: string;
}) {
  const rate = studentCount ? Math.round((submittedStudents / studentCount) * 100) : 0;
  return (
    <section className="premium-lesson-panel p-4" data-testid="unit-5-2-teacher-summary-stats">
      <div className="premium-lesson-title text-base font-semibold leading-7 tracking-normal">班级整体表现统计</div>
      <div className="mt-3 grid gap-3 md:grid-cols-5">
        <div className="premium-lesson-surface-elevated px-3 py-3">
          <div className="premium-lesson-caption text-xs">参与学生</div>
          <div className="premium-lesson-title mt-1 text-2xl font-semibold">{studentCount}</div>
        </div>
        <div className="premium-lesson-surface-elevated px-3 py-3">
          <div className="premium-lesson-caption text-xs">提交覆盖</div>
          <div className="premium-lesson-title mt-1 text-2xl font-semibold">{rate}%</div>
        </div>
        <div className="premium-lesson-surface-elevated px-3 py-3">
          <div className="premium-lesson-caption text-xs">客观题正确率</div>
          <div className="premium-lesson-title mt-1 text-2xl font-semibold">{objectiveAccuracy}%</div>
        </div>
        <div className="premium-lesson-surface-elevated px-3 py-3">
          <div className="premium-lesson-caption text-xs">后测完成率</div>
          <div className="premium-lesson-title mt-1 text-2xl font-semibold">{postTestCompletion}%</div>
        </div>
        <div className="premium-lesson-surface-elevated px-3 py-3">
          <div className="premium-lesson-caption text-xs">参数探索覆盖</div>
          <div className="premium-lesson-title mt-1 text-2xl font-semibold">{parameterCoverage}%</div>
        </div>
        <div className="premium-lesson-surface-elevated px-3 py-3 md:col-span-5">
          <div className="premium-lesson-caption text-xs">常见误判标签</div>
          <div className="premium-lesson-title mt-1 text-sm font-semibold">
            {misconceptionSummary} · 提交总数 {totalResponses}
          </div>
        </div>
      </div>
    </section>
  );
}

export function UNIT_5_2StepContentPanel({
  step,
  manifest,
  revealProgress,
  allowInlineReveal,
  browseEnabled = true,
  role,
  submittedCount = 0,
  viewedCount = 0,
  studentCount = 0,
  submittedStudents = 0,
  totalResponses = 0,
  parameterSubmissionCount = 0,
  prePostCompletion = '等待提交',
  parameterCoverage = 0,
  objectiveAccuracy = 0,
  postTestCompletion = 0,
  misconceptionSummary = '暂无聚合',
  onParameterChange,
  onAdvanceReveal,
}: {
  step: UNIT_5_2StepDefinition;
  manifest?: InteractiveRuntimeManifest | null;
  revealProgress: number;
  allowInlineReveal: boolean;
  browseEnabled?: boolean;
  role: 'student' | 'teacher';
  submittedCount?: number;
  viewedCount?: number;
  studentCount?: number;
  submittedStudents?: number;
  totalResponses?: number;
  parameterSubmissionCount?: number;
  prePostCompletion?: string;
  parameterCoverage?: number;
  objectiveAccuracy?: number;
  postTestCompletion?: number;
  misconceptionSummary?: string;
  onParameterChange?: (stepId: string, values: Record<string, string>) => void;
  onAdvanceReveal?: () => void;
}) {
  const activeManifest = requireUnit52Manifest(manifest);
  const stepManifest = getUNIT_5_2ManifestStepFromManifest(activeManifest, step.id);
  const baseRegistry = createManifestContentModuleRegistry({
    revealProgress,
    allowInlineReveal,
    onInlineReveal: onAdvanceReveal,
  });
  const moduleRegistry: InteractiveModuleRegistry<ContentRegistryExtra> = {
    ...baseRegistry,
    'interactive-figure-panel': ({ step: manifestStep, module }: { step: InteractiveRuntimeStepManifest; module: InteractiveRuntimeModuleManifest }) => (
      <Unit52NonlinearAnalysisPanel step={manifestStep} module={module} onParameterChange={onParameterChange} />
    ),
    'stat-panel': ({ module }: { module: InteractiveRuntimeModuleManifest }) => {
      const visibility = String(module.payload.role_visibility ?? '');
      if (visibility === 'student_only' && role !== 'student') {
        return <div hidden aria-hidden="true" data-role-hidden-module={module.id} />;
      }
      if (visibility === 'teacher_only' && role !== 'teacher') {
        return <div hidden aria-hidden="true" data-role-hidden-module={module.id} />;
      }
      if (role === 'student') {
        return (
          <Unit52StudentSummaryStats
            submittedCount={submittedCount}
            viewedCount={viewedCount}
            parameterSubmissionCount={parameterSubmissionCount}
            prePostCompletion={prePostCompletion}
          />
        );
      }
      return (
        <Unit52TeacherSummaryStats
          studentCount={studentCount}
          submittedStudents={submittedStudents}
          totalResponses={totalResponses}
          parameterCoverage={parameterCoverage}
          objectiveAccuracy={objectiveAccuracy}
          postTestCompletion={postTestCompletion}
          misconceptionSummary={misconceptionSummary}
        />
      );
    },
  };
  if (role === 'student' && !browseEnabled && stepManifest.studentAccess.browse_required === true) {
    moduleRegistry['content.reveal'] = () => <div hidden aria-hidden="true" data-role-hidden-module="browse-required-reveal" />;
    moduleRegistry['content.figure'] = () => <div hidden aria-hidden="true" data-role-hidden-module="browse-required-media" />;
    moduleRegistry['step-reveal-chain'] = () => <div hidden aria-hidden="true" data-role-hidden-module="browse-required-reveal" />;
    moduleRegistry['step-reveal'] = () => <div hidden aria-hidden="true" data-role-hidden-module="browse-required-reveal" />;
    moduleRegistry['image-panel'] = () => <div hidden aria-hidden="true" data-role-hidden-module="browse-required-media" />;
  }

  return (
    <section className="space-y-4">
      {renderInteractiveManifestStep({
        manifest: activeManifest,
        step: stepManifest,
        moduleRegistry,
        extra: { revealProgress, allowInlineReveal, onInlineReveal: onAdvanceReveal },
      })}
    </section>
  );
}

export function UNIT_5_2StudentActivityForm({
  step,
  manifest,
  savedResponse,
  released,
  browseEnabled,
  answerVisible,
  revealProgress,
  onSubmit,
}: {
  step: UNIT_5_2StepDefinition;
  manifest?: InteractiveRuntimeManifest | null;
  savedResponse?: ManifestStepResponse;
  released: boolean;
  browseEnabled: boolean;
  answerVisible: boolean;
  revealProgress: number;
  onSubmit: (response: ManifestStepResponse) => void;
}) {
  const activeManifest = requireUnit52Manifest(manifest);
  const stepManifest = getUNIT_5_2ManifestStepFromManifest(activeManifest, step.id);
  return (
    <>
      {renderStudentInteractiveActivity({
        registry: createManifestStudentActivityRegistry<UNIT_5_2StepDefinition>(),
        step,
        stepManifest,
        savedResponse,
        released,
        browseEnabled,
        answerVisible,
        revealProgress,
        onSubmit,
      })}
    </>
  );
}

export function UNIT_5_2TeacherActivitySummary({
  step,
  manifest,
  responses,
  released,
  browseEnabled,
  answerVisible,
  revealProgress,
  onToggleRelease,
  onToggleBrowse,
  onToggleAnswerVisible,
  onAdvanceReveal,
  onResetReveal,
}: {
  step: UNIT_5_2StepDefinition;
  manifest?: InteractiveRuntimeManifest | null;
  responses: TeacherResponseItem[];
  released: boolean;
  browseEnabled: boolean;
  answerVisible: boolean;
  revealProgress: number;
  onToggleRelease: () => void;
  onToggleBrowse: () => void;
  onToggleAnswerVisible: () => void;
  onAdvanceReveal: () => void;
  onResetReveal: () => void;
}) {
  const activeManifest = requireUnit52Manifest(manifest);
  const stepManifest = getUNIT_5_2ManifestStepFromManifest(activeManifest, step.id);
  return (
    <>
      {renderTeacherInteractiveActivity({
        registry: createManifestTeacherActivityRegistry<UNIT_5_2StepDefinition>(),
        step,
        stepManifest,
        responses,
        released,
        browseEnabled,
        answerVisible,
        revealProgress,
        onToggleRelease,
        onToggleBrowse,
        onToggleAnswerVisible,
        onAdvanceReveal,
        onResetReveal,
      })}
    </>
  );
}
