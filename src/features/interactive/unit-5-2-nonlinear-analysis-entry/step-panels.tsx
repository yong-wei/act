'use client';

import { useMemo, useRef, useState } from 'react';

import {
  createManifestContentModuleRegistry,
} from '@/features/interactive/shared/manifest-runtime/content-renderers';
import {
  createManifestStudentActivityRegistry,
  createManifestTeacherActivityRegistry,
  renderStudentInteractiveActivity,
  renderTeacherInteractiveActivity,
  type ManifestStepResponse,
} from '@/features/interactive/shared/manifest-runtime/activity-renderers';
import {
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
type ParameterRecord = Record<string, number | string | boolean>;
type CurveSeries = { id: string; label: string; color: string; points: NonlinearPoint[]; dashed?: boolean };
type SliderConfig = { id: string; label: string; min: number; max: number; default: number; step: number };
type TabConfig = { id: string; label: string; controls: SliderConfig[] };
type CharacteristicPanelConfig = { tabs: TabConfig[] };

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
          { id: 'Delta', label: '死区宽度 Delta', min: 0.1, max: 3, default: 0.5, step: 0.05 },
          { id: 'A', label: '输入幅值 A', min: 0.05, max: 8, default: 2, step: 0.05 },
        ],
      },
      {
        id: 'deadzone_saturation',
        label: '死区饱和',
        controls: [
          { id: 'k', label: '斜率 k', min: 0.2, max: 5, default: 1, step: 0.1 },
          { id: 'Delta', label: '死区宽度 Delta', min: 0.1, max: 3, default: 0.5, step: 0.05 },
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
  { id: 'double_integrator', label: '重积分' },
  { id: 'integral_inertia', label: '积分惯性' },
];

function requireUnit52Manifest(manifest: InteractiveRuntimeManifest | null | undefined) {
  if (!manifest) {
    throw new Error('5-2 runtime manifest is required for page rendering.');
  }
  return manifest;
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

function requestForPanel(id: string, params: ParameterRecord): NonlinearAnalysisRequest {
  if (id === 'rust_phase_plane_tabs') {
    return {
      runtimeMode: 'nonlinear_analysis',
      analysisKind: 'phase_plane',
      modelId: String(params.tab ?? 'van_der_pol'),
      initialPoint: [numeric(params.x0, 1.2), numeric(params.y0, 0.1)],
      parameters: { mu: numeric(params.mu, 1), T: numeric(params.T, 1) },
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
        A_min: 0.05,
        A_max: 8,
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
      parameters: { ...params, nonlinearity_type: tab },
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
      { id: 'sineEnvelope', label: '输入幅值边界', color: '#f97316', points: result.characteristic.sineEnvelope, dashed: true },
    ];
  }

  if (result?.negativeInverse) {
    return result.negativeInverse.curves.map((curve, index) => ({
      id: curve.id,
      label: curve.label,
      color: index % 2 === 0 ? '#dc2626' : '#7c3aed',
      points: curve.points.map((point) => ({ x: point.re, y: point.im })),
    }));
  }

  const phasePoints = result?.phasePlane?.trajectories[0]?.points ?? [];
  return [{ id: 'phase', label: '相轨迹', color: '#0f766e', points: phasePoints }];
}

function SvgCurve({ series }: { series: CurveSeries[] }) {
  const allPoints = series.flatMap((item) => item.points);
  const safePoints = allPoints.length ? allPoints : [{ x: 0, y: 0 }];
  const xs = safePoints.map((point) => point.x);
  const ys = safePoints.map((point) => point.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const scaleX = (x: number) => 30 + ((x - minX) / Math.max(1e-6, maxX - minX)) * 420;
  const scaleY = (y: number) => 230 - ((y - minY) / Math.max(1e-6, maxY - minY)) * 190;

  return (
    <svg viewBox="0 0 480 260" className="h-64 w-full rounded-xl border border-slate-200 bg-white">
      <line x1="30" y1="230" x2="450" y2="230" stroke="#cbd5e1" />
      <line x1="30" y1="30" x2="30" y2="230" stroke="#cbd5e1" />
      {series.map((item) => {
        const d = item.points
          .map((point, index) => `${index === 0 ? 'M' : 'L'} ${scaleX(point.x).toFixed(1)} ${scaleY(point.y).toFixed(1)}`)
          .join(' ');
        return (
          <path
            key={item.id}
            d={d}
            fill="none"
            stroke={item.color}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray={item.dashed ? '6 5' : undefined}
          />
        );
      })}
      <text x="34" y="24" className="fill-slate-500 text-[11px]">状态 / 输出关系</text>
      <text x="354" y="248" className="fill-slate-500 text-[11px]">x / Re</text>
      {series.map((item, index) => (
        <g key={item.id} transform={`translate(${300}, ${24 + index * 18})`}>
          <line x1="0" y1="0" x2="22" y2="0" stroke={item.color} strokeWidth="3" strokeDasharray={item.dashed ? '6 5' : undefined} />
          <text x="28" y="4" className="fill-slate-600 text-[11px]">{item.label}</text>
        </g>
      ))}
    </svg>
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

const PERTURBATION_BASE_POINTS = {
  A1: { x: 250, y: 150, type: 'unstable_limit_cycle', label: 'A1' },
  A2: { x: 470, y: 162, type: 'stable_limit_cycle', label: 'A2' },
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function perturbationStatus(pointId: 'A1' | 'A2', x: number) {
  if (pointId === 'A2') {
    return {
      direction: x < PERTURBATION_BASE_POINTS.A2.x ? '向右回到稳定自振点 A2' : '向左回到稳定自振点 A2',
      finalState: 'return_to_same_point',
      text: 'A2 是稳定自振点，小扰动后轨迹回到对应交点。',
    };
  }

  return {
    direction: x < PERTURBATION_BASE_POINTS.A1.x ? '向左远离非稳定点 A1' : '向右远离非稳定点 A1，可能停在 A2',
    finalState: 'move_away_or_stop_at_next_stable',
    text: 'A1 是非稳定自振点，小扰动后不会回到原交点。',
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
  const [draggingPoint, setDraggingPoint] = useState<'A1' | 'A2' | null>(null);
  const [points, setPoints] = useState(PERTURBATION_BASE_POINTS);
  const activePoint = draggingPoint ?? 'A1';
  const status = perturbationStatus(activePoint, points[activePoint].x);

  const reset = () => {
    setDraggingPoint(null);
    setPoints(PERTURBATION_BASE_POINTS);
    onParameterChange?.(step.id, {
      draggedPoint: 'reset',
      disturbanceDirection: 'none',
      finalState: 'reset',
    });
  };

  const updatePoint = (pointId: 'A1' | 'A2', clientX: number, clientY: number) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    const nextX = clamp(((clientX - rect.left) / rect.width) * 720, 190, 540);
    const nextY = clamp(((clientY - rect.top) / rect.height) * 320, 95, 220);
    const next = { ...points, [pointId]: { ...points[pointId], x: nextX, y: nextY } };
    const nextStatus = perturbationStatus(pointId, nextX);
    setPoints(next);
    onParameterChange?.(step.id, {
      draggedPoint: pointId,
      disturbanceDirection: nextStatus.direction,
      finalState: nextStatus.finalState,
    });
  };

  return (
    <section className="premium-lesson-panel space-y-4" data-nonlinear-panel="interactive_perturbation_curve_panel">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="premium-lesson-kicker">微小扰动法拖动面板</div>
          <h3 className="premium-lesson-title mt-1 text-lg font-semibold">{asString(module.payload.text, step.title)}</h3>
        </div>
        <button type="button" onClick={reset} className="premium-lesson-button-secondary text-sm">重置</button>
      </div>
      <svg
        ref={svgRef}
        viewBox="0 0 720 320"
        className="h-[320px] w-full touch-none rounded-xl border border-slate-200 bg-white"
        onPointerMove={(event) => {
          if (!draggingPoint) return;
          updatePoint(draggingPoint, event.clientX, event.clientY);
        }}
        onPointerUp={(event) => {
          if (draggingPoint) event.currentTarget.releasePointerCapture(event.pointerId);
          setDraggingPoint(null);
        }}
        onPointerLeave={() => setDraggingPoint(null)}
      >
        <rect x="42" y="40" width="636" height="232" rx="12" fill="#f8fafc" stroke="#e2e8f0" />
        <path d="M 96 170 C 160 70, 290 80, 346 156 C 410 242, 560 238, 624 138" fill="none" stroke="#2563eb" strokeWidth="4" />
        <path d="M 118 210 C 208 120, 334 115, 420 164 C 498 208, 576 204, 642 120" fill="none" stroke="#dc2626" strokeWidth="4" strokeLinecap="round" />
        <path d="M 130 210 L 168 181" stroke="#dc2626" strokeWidth="3" markerEnd="url(#perturb-arrow)" />
        <path d="M 382 147 L 424 165" stroke="#dc2626" strokeWidth="3" markerEnd="url(#perturb-arrow)" />
        <defs>
          <marker id="perturb-arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
            <path d="M0,0 L0,6 L6,3 z" fill="#dc2626" />
          </marker>
        </defs>
        <text x="68" y="68" className="fill-blue-700 text-[13px] font-semibold">稳定区域</text>
        <text x="530" y="68" className="fill-red-700 text-[13px] font-semibold">不稳定区域</text>
        {[
          { id: 'B1', x: 222, y: 150 },
          { id: 'C1', x: 282, y: 150 },
          { id: 'B2', x: 440, y: 162 },
          { id: 'C2', x: 500, y: 162 },
        ].map((item) => (
          <g key={item.id}>
            <circle cx={item.x} cy={item.y} r="4" fill="#f97316" />
            <text x={item.x - 8} y={item.y - 12} className="fill-slate-600 text-[12px]">{item.id}</text>
          </g>
        ))}
        {(['A1', 'A2'] as const).map((pointId) => {
          const point = points[pointId];
          return (
            <g key={pointId}>
              <circle
                cx={point.x}
                cy={point.y}
                r="13"
                fill={pointId === 'A1' ? '#fee2e2' : '#dcfce7'}
                stroke={pointId === 'A1' ? '#dc2626' : '#16a34a'}
                strokeWidth="3"
                data-limit-cycle-type={point.type}
                onPointerDown={(event) => {
                  setDraggingPoint(pointId);
                  event.currentTarget.ownerSVGElement?.setPointerCapture(event.pointerId);
                  updatePoint(pointId, event.clientX, event.clientY);
                }}
              />
              <text x={point.x - 9} y={point.y + 4} className="pointer-events-none fill-slate-900 text-[12px] font-semibold">{point.label}</text>
            </g>
          );
        })}
      </svg>
      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-lg bg-slate-50 p-3 text-xs text-slate-700">
          <div className="font-semibold text-slate-900">拖动点</div>
          <div>{activePoint} · {points[activePoint].type}</div>
        </div>
        <div className="rounded-lg bg-slate-50 p-3 text-xs text-slate-700">
          <div className="font-semibold text-slate-900">扰动方向</div>
          <div>{status.direction}</div>
        </div>
        <div className="rounded-lg bg-slate-50 p-3 text-xs text-slate-700">
          <div className="font-semibold text-slate-900">稳定性回判</div>
          <div>{status.text}</div>
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
  });
  const request = useMemo(() => requestForPanel(id, params), [id, params]);
  const fallback = useMemo(() => createFallbackNonlinearAnalysisResult(request), [request]);
  const { result, error, isFallback } = useNonlinearAnalysisEngine(request, fallback);
  const series = chartSeries(result);
  const activeCharacteristicTab = tabConfigForPanel(id, String(params.tab));

  const updateParam = (key: string, value: number | string) => {
    const next = { ...params, [key]: value };
    setParams(next);
    onParameterChange?.(step.id, Object.fromEntries(Object.entries(next).map(([itemKey, itemValue]) => [itemKey, String(itemValue)])));
  };

  return (
    <section className="premium-lesson-panel space-y-4" data-nonlinear-panel={id}>
      <div>
        <div className="premium-lesson-kicker">Rust/WASM 非线性分析面板</div>
        <h3 className="premium-lesson-title mt-1 text-lg font-semibold">{asString(module.payload.text, step.title)}</h3>
      </div>
      <div className="grid gap-4 lg:grid-cols-[1.4fr_0.9fr]">
        <SvgCurve series={series} />
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
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
          ) : null}
          {id === 'rust_harmonic_lowpass_panel' ? (
            <>
              {sliderControl('输入幅值 A', numeric(params.A, 2), 0.05, 8, 0.05, (value) => updateParam('A', value))}
              {sliderControl('输入频率 omega', numeric(params.omega, 1), 0.2, 5, 0.1, (value) => updateParam('omega', value))}
              {sliderControl('低通截止频率 omega_c', numeric(params.omega_c, 2), 0.2, 8, 0.1, (value) => updateParam('omega_c', value))}
            </>
          ) : null}
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
          {id === 'rust_negative_inverse_family_panel' ? (
            <>
              {sliderControl('输入幅值 A', numeric(params.A, 2), 0.05, 8, 0.05, (value) => updateParam('A', value))}
              {sliderControl('斜率 / 增益 k', numeric(params.k, 1), 0.2, 5, 0.1, (value) => updateParam('k', value))}
              {sliderControl('门槛参数', numeric(params.a, 1), 0.1, 5, 0.1, (value) => updateParam('a', value))}
            </>
          ) : null}
          {result?.harmonic?.spectrum ? <SpectrumBars spectrum={result.harmonic.spectrum} /> : null}
          <div className="rounded-lg bg-white p-3 text-xs leading-6 text-slate-600">
            <div className="font-semibold text-slate-800">{result?.summary.outcome ?? '等待计算'}</div>
            {(result?.summary.metrics ?? []).map((item) => <div key={item}>{item}</div>)}
            {error || isFallback ? <div className="mt-2 text-amber-700">{error ?? result?.fallbackMessage}</div> : null}
          </div>
        </div>
      </div>
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

export function Unit52StudentSummaryStats({ responses }: { responses?: Record<string, ManifestStepResponse> }) {
  const submitted = Object.keys(responses ?? {}).length;
  return (
    <section className="premium-lesson-panel grid gap-3 sm:grid-cols-3">
      <div><div className="premium-lesson-kicker">参数探索覆盖</div><div className="premium-lesson-title mt-1 text-2xl font-semibold">{Math.min(6, submitted)}/6</div></div>
      <div><div className="premium-lesson-kicker">客观题正确率</div><div className="premium-lesson-title mt-1 text-2xl font-semibold">待课堂汇总</div></div>
      <div><div className="premium-lesson-kicker">常见误判标签</div><div className="premium-lesson-title mt-1 text-sm font-semibold">交点即稳定自振 / 全局外推</div></div>
    </section>
  );
}

export function Unit52TeacherSummaryStats({ responses }: { responses: TeacherResponseItem[] }) {
  return (
    <section className="premium-lesson-panel grid gap-3 sm:grid-cols-3">
      <div><div className="premium-lesson-kicker">参数探索覆盖</div><div className="premium-lesson-title mt-1 text-2xl font-semibold">{responses.length}</div></div>
      <div><div className="premium-lesson-kicker">客观题正确率</div><div className="premium-lesson-title mt-1 text-2xl font-semibold">按题查看</div></div>
      <div><div className="premium-lesson-kicker">常见误判标签</div><div className="premium-lesson-title mt-1 text-sm font-semibold">汇总提交后显示</div></div>
    </section>
  );
}

export function UNIT_5_2StepContentPanel({
  step,
  manifest,
  revealProgress,
  allowInlineReveal,
  onParameterChange,
  responses,
  teacherMode = false,
}: {
  step: UNIT_5_2StepDefinition;
  manifest?: InteractiveRuntimeManifest | null;
  revealProgress: number;
  allowInlineReveal: boolean;
  onParameterChange?: (stepId: string, values: Record<string, string>) => void;
  responses?: Record<string, ManifestStepResponse> | TeacherResponseItem[];
  teacherMode?: boolean;
}) {
  const activeManifest = requireUnit52Manifest(manifest);
  const stepManifest = getUNIT_5_2ManifestStepFromManifest(activeManifest, step.id);
  const baseRegistry = createManifestContentModuleRegistry({
    revealProgress,
    allowInlineReveal,
  });
  const moduleRegistry = {
    ...baseRegistry,
    'interactive-figure-panel': ({ step: manifestStep, module }: { step: InteractiveRuntimeStepManifest; module: InteractiveRuntimeModuleManifest }) => (
      <Unit52NonlinearAnalysisPanel step={manifestStep} module={module} onParameterChange={onParameterChange} />
    ),
    'stat-panel': ({ module }: { module: InteractiveRuntimeModuleManifest }) => (
      <div data-role-hidden-module={module.id}>
        {teacherMode ? (
          <Unit52TeacherSummaryStats responses={Array.isArray(responses) ? responses : []} />
        ) : (
          <Unit52StudentSummaryStats responses={!Array.isArray(responses) ? responses : undefined} />
        )}
      </div>
    ),
  };

  return (
    <section className="space-y-4">
      {renderInteractiveManifestStep({
        manifest: activeManifest,
        step: stepManifest,
        moduleRegistry,
        extra: { revealProgress, allowInlineReveal },
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
