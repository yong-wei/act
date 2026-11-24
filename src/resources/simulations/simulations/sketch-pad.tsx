'use client';

import { useEffect, useMemo, useRef, useState, type PointerEvent } from 'react';
import { Eye, Layers, RotateCcw, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  isSketchPlotId,
  parseSketchFeatureChecks,
  SKETCH_COORDINATE_PLOTS,
  sketchLabelForId,
  type SketchPlotId,
} from '@/features/ilab/sketch-plots';
import type { SketchRecognitionContext } from '@/features/ilab/sketch-recognition';
import { simulationUi } from '../components/simulation-ui';
import { buildSketchAnalyticalOverlay } from '../experiments/sketch-analytical-overlay';
import {
  buildSketchCoordinateTemplate, clearTransparentSketchCanvas, composeSketchVisionImage,
  mapXToPlot, mapYToPlot, projectSeriesToSvgPath, redrawSketchStrokes,
  SKETCH_VIEW_H, SKETCH_VIEW_W, type SketchActualCurveSeries, type SketchAxisBounds,
  type SketchCoordinateTemplate, type SketchStroke,
} from '../experiments/sketch-coordinate-templates';
import type { FrozenVesselStudentModel } from '../experiments/student-analysis';

export interface SketchRecognitionOutcome {
  sketchKind: SketchPlotId | 'other';
  sketchBlank: boolean;
  sketchEvaluation: string;
  featureChecks?: string[];
  socraticHint?: string;
}

export interface SketchPadProps {
  label: string;
  hint: string;
  onChange: (dataUrl: string) => void;
  value?: string;
  studentModel?: FrozenVesselStudentModel | null;
  defaultPlotId?: SketchPlotId;
  onRecognized?: (verdict: SketchRecognitionOutcome) => void;
  overlayEnabledByDefault?: boolean;
  mode?: 'analysis' | 'prediction';
  lockPlotId?: boolean;
  coordinateOverride?: Partial<SketchAxisBounds> & { title?: string; subtitle?: string };
  actualSeries?: SketchActualCurveSeries[];
  context?: Omit<SketchRecognitionContext, 'mode' | 'plotId'> & { mode?: 'analysis' | 'prediction'; plotId?: SketchPlotId };
  disabled?: boolean;
}

const PEN_OPTIONS = [
  { id: 'primary', label: '主曲线（深蓝）', hex: '#1e3a5f' },
  { id: 'compare', label: '对比曲线（橙红）', hex: '#ea580c' },
] as const;

function CoordinateTemplateLayer({ template }: { template: SketchCoordinateTemplate }) {
  const { left, top, right, bottom } = template.plotArea;
  const { bounds } = template;
  const plotW = right - left;
  const plotH = bottom - top;
  const cx0 = mapXToPlot(template, 0, false);
  const cy0 = mapYToPlot(template, 0, false);
  const xSpan = Math.max(1e-6, bounds.xMax - bounds.xMin);
  const ySpan = Math.max(1e-6, bounds.yMax - bounds.yMin);

  return (
    <svg viewBox={`0 0 ${SKETCH_VIEW_W} ${SKETCH_VIEW_H}`} className="pointer-events-none absolute inset-0 h-full w-full" data-sketch-coordinate-layer aria-hidden="true">
      {(bounds.xTicks ?? []).map((t) => <line key={`gx-${t.value}`} x1={mapXToPlot(template, t.value)} y1={top} x2={mapXToPlot(template, t.value)} y2={bottom} stroke="#e2e8f0" strokeWidth={1} />)}
      {(bounds.yTicks ?? []).map((t) => <line key={`gy-${t.value}`} x1={left} y1={mapYToPlot(template, t.value)} x2={right} y2={mapYToPlot(template, t.value)} stroke="#e2e8f0" strokeWidth={1} />)}
      <rect x={left} y={top} width={plotW} height={plotH} fill="none" stroke="#cbd5e1" strokeWidth={1} />
      {(bounds.rings ?? []).map((ring) => {
        const rx = (ring.radius / xSpan) * plotW;
        const ry = (ring.radius / ySpan) * plotH;
        return (
          <g key={`ring-${ring.radius}`}>
            <ellipse cx={cx0} cy={cy0} rx={rx} ry={ry} fill="none" stroke={ring.color} strokeWidth={1.1} strokeDasharray="4 3" opacity={0.85} />
            <text x={Math.min(right - 46, cx0 + 4)} y={Math.max(top + 10, cy0 - ry + 10)} fontSize={8} fontWeight={600} fill={ring.color}>{ring.label}</text>
          </g>
        );
      })}
      {(bounds.verticalMarkers ?? []).map((m) => {
        const x = mapXToPlot(template, m.value);
        const alignEnd = x > right - 46;
        return (
          <g key={`vm-${m.value}-${m.label}`}>
            <line x1={x} y1={top} x2={x} y2={bottom} stroke={m.color ?? '#64748b'} strokeWidth={1.1} strokeDasharray="4 3" />
            <text x={alignEnd ? x - 3 : x + 3} y={top + 10} textAnchor={alignEnd ? 'end' : 'start'} fontSize={8} fontWeight={600} fill={m.color ?? '#475569'}>{m.label}</text>
          </g>
        );
      })}
      {(bounds.horizontalMarkers ?? []).map((m) => {
        const y = mapYToPlot(template, m.value);
        return (
          <g key={`hm-${m.value}-${m.label}`}>
            <line x1={left} y1={y} x2={right} y2={y} stroke={m.color ?? '#64748b'} strokeWidth={1.1} strokeDasharray="4 3" />
            <text x={left + 4} y={Math.max(top + 10, y - 3)} fontSize={8} fontWeight={600} fill={m.color ?? '#475569'}>{m.label}</text>
          </g>
        );
      })}
      {template.plotId === 'nyquist' ? (
        <g>
          <circle cx={mapXToPlot(template, -1)} cy={mapYToPlot(template, 0)} r={2.8} fill="#ef4444" />
          <text x={mapXToPlot(template, -1) + 4} y={mapYToPlot(template, 0) + 10} fontSize={8} fontWeight={600} fill="#ef4444">(-1,j0)</text>
        </g>
      ) : null}
      <polyline points={`${left},${top} ${left},${bottom} ${right},${bottom}`} fill="none" stroke="#64748b" strokeWidth={1.2} />
      {(bounds.xTicks ?? []).map((t) => <text key={`tx-${t.value}`} x={mapXToPlot(template, t.value)} y={bottom + 12} textAnchor="middle" fontSize={8.5} fill="#475569">{t.label}</text>)}
      {(bounds.yTicks ?? []).map((t) => <text key={`ty-${t.value}`} x={left - 4} y={mapYToPlot(template, t.value) + 3} textAnchor="end" fontSize={8.5} fill="#475569">{t.label}</text>)}
      <text x={6} y={14} fontSize={9.5} fontWeight={600} fill="#0f172a">{bounds.yUnit ? `${bounds.yLabel} (${bounds.yUnit})` : bounds.yLabel}</text>
      <text x={right} y={SKETCH_VIEW_H - 6} textAnchor="end" fontSize={9.5} fontWeight={600} fill="#0f172a">{bounds.xUnit ? `${bounds.xLabel} (${bounds.xUnit})` : bounds.xLabel}</text>
    </svg>
  );
}

function ReadOnlyOverlaySvg({
  viewBox,
  paths,
  markers,
  maxTextX,
  markerRadius,
  dataAttr,
}: {
  viewBox: string;
  paths: Array<{ id: string; d: string; stroke: string; dashed?: boolean }>;
  markers: Array<{ id: string; x: number; y: number; color: string; label: string }>;
  maxTextX: number;
  markerRadius: number;
  dataAttr: 'analytical' | 'actual';
}) {
  return (
    <svg
      viewBox={viewBox}
      className="pointer-events-none absolute inset-0 z-20 h-full w-full"
      aria-hidden="true"
      {...(dataAttr === 'analytical' ? { 'data-sketch-analytical-overlay': '' } : { 'data-sketch-actual-overlay': '' })}
    >
      {paths.map((p) => (
        <path key={p.id} d={p.d} fill="none" stroke={p.stroke} strokeWidth={dataAttr === 'actual' ? 1.8 : 1.6} strokeDasharray={p.dashed ? '4 3' : undefined} opacity={dataAttr === 'actual' ? 0.9 : 0.85} />
      ))}
      {markers.map((m) => (
        <g key={m.id}>
          <circle cx={m.x} cy={m.y} r={markerRadius} fill={m.color} />
          <text x={Math.min(maxTextX, m.x + 5)} y={Math.max(12, m.y - 4)} fontSize={dataAttr === 'actual' ? 8 : 8.5} fontWeight={600} fill={m.color}>{m.label}</text>
        </g>
      ))}
    </svg>
  );
}

export function SketchPad({
  label, hint, onChange, value, studentModel, defaultPlotId = 'bode', onRecognized,
  overlayEnabledByDefault = true, mode = 'analysis', lockPlotId = false,
  coordinateOverride, actualSeries, context, disabled = false,
}: SketchPadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const moved = useRef(0);
  const published = useRef<string | undefined>(undefined);
  const strokesRef = useRef<SketchStroke[]>([]);
  const activeStrokeRef = useRef<SketchStroke | null>(null);
  const hadActualRef = useRef(Boolean(actualSeries && actualSeries.length > 0));

  const [selectedPlotId, setSelectedPlotId] = useState<SketchPlotId>(defaultPlotId);
  const [penColor, setPenColor] = useState<string>(PEN_OPTIONS[0].hex);
  const [strokeCount, setStrokeCount] = useState(0);
  const [recognizing, setRecognizing] = useState(false);
  const [recognizeError, setRecognizeError] = useState<string | null>(null);
  const [verdict, setVerdict] = useState<SketchRecognitionOutcome | null>(null);
  const [showOverlay, setShowOverlay] = useState(overlayEnabledByDefault);
  const [showActualOverlay, setShowActualOverlay] = useState(Boolean(actualSeries && actualSeries.length > 0));

  useEffect(() => { setSelectedPlotId(defaultPlotId); }, [defaultPlotId]);
  useEffect(() => {
    const hasActual = Boolean(actualSeries && actualSeries.length > 0);
    if (hasActual && !hadActualRef.current) setShowActualOverlay(true);
    hadActualRef.current = hasActual;
  }, [actualSeries]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx || (value && value === published.current)) return;
    clearTransparentSketchCanvas(canvas, ctx);
    if (!value) {
      moved.current = 0;
      strokesRef.current = [];
      setStrokeCount(0);
      return;
    }
    let cancelled = false;
    const image = new window.Image();
    image.onload = () => {
      if (cancelled) return;
      if (typeof ctx.drawImage === 'function') ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
      moved.current = 8;
      published.current = value;
    };
    image.src = value;
    return () => { cancelled = true; };
  }, [value]);

  const template = useMemo(() => buildSketchCoordinateTemplate(selectedPlotId, coordinateOverride), [selectedPlotId, coordinateOverride]);

  function point(event: PointerEvent<HTMLCanvasElement>) {
    const canvas = event.currentTarget;
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) * canvas.width) / (rect.width || SKETCH_VIEW_W),
      y: ((event.clientY - rect.top) * canvas.height) / (rect.height || SKETCH_VIEW_H),
    };
  }

  function publish() {
    const canvas = canvasRef.current;
    if (!canvas || moved.current < 8) {
      published.current = '';
      onChange('');
      return;
    }
    const image = canvas.toDataURL('image/png');
    published.current = image;
    onChange(image);
  }

  function handleUndoStroke() {
    if (disabled) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx || strokesRef.current.length === 0) return;
    strokesRef.current = strokesRef.current.slice(0, -1);
    setStrokeCount(strokesRef.current.length);
    moved.current = redrawSketchStrokes(canvas, ctx, strokesRef.current);
    publish();
  }

  function handleClearCanvas() {
    if (disabled) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    clearTransparentSketchCanvas(canvas, ctx);
    strokesRef.current = [];
    activeStrokeRef.current = null;
    setStrokeCount(0);
    moved.current = 0;
    published.current = '';
    setVerdict(null);
    setRecognizeError(null);
    onChange('');
  }

  async function runSketchRecognition() {
    const canvas = canvasRef.current;
    const rawDataUrl = value && value.startsWith('data:image/')
      ? value
      : canvas && moved.current >= 8 ? canvas.toDataURL('image/png') : '';
    if (!rawDataUrl) {
      setRecognizeError('请先在画布上绘制曲线后再执行识图。');
      return;
    }
    setRecognizing(true);
    setRecognizeError(null);
    try {
      const visionImage = composeSketchVisionImage(canvas, rawDataUrl, template);
      const response = await fetch('/api/simulations/sketch-review', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ image: visionImage, context: { ...context, mode, plotId: selectedPlotId } }),
      });
      const body = (await response.json()) as {
        error?: string; sketchKind?: string; sketchBlank?: string; sketchEvaluation?: string;
        featureChecks?: unknown; sketchFeatureChecks?: string; socraticHint?: string; sketchSocraticHint?: string;
      };
      if (!response.ok || !body.sketchKind) {
        setRecognizeError(body.error || '图像识别暂时不可用，请稍后重试。');
        return;
      }
      const nextVerdict: SketchRecognitionOutcome = {
        sketchKind: isSketchPlotId(body.sketchKind) ? body.sketchKind : 'other',
        sketchBlank: body.sketchBlank === '1',
        sketchEvaluation: (body.sketchEvaluation ?? '').trim(),
        featureChecks: parseSketchFeatureChecks(body.featureChecks, body.sketchFeatureChecks),
        socraticHint: (body.socraticHint ?? body.sketchSocraticHint ?? '').trim() || undefined,
      };
      setVerdict(nextVerdict);
      if (mode === 'analysis') {
        if (nextVerdict.sketchKind !== 'other' && !nextVerdict.sketchBlank) {
          const targetPlot = lockPlotId ? selectedPlotId : nextVerdict.sketchKind;
          if (!lockPlotId) setSelectedPlotId(nextVerdict.sketchKind);
          setShowOverlay(buildSketchAnalyticalOverlay(targetPlot, studentModel).supported);
        } else {
          setShowOverlay(false);
        }
      }
      onRecognized?.(nextVerdict);
    } catch {
      setRecognizeError('图像识别网络请求失败，请检查服务连接后重试。');
    } finally {
      setRecognizing(false);
    }
  }

  const activePlotForOverlay: SketchPlotId | null = mode === 'analysis'
    ? verdict && !verdict.sketchBlank && verdict.sketchKind !== 'other'
      ? lockPlotId ? selectedPlotId : verdict.sketchKind
      : verdict ? selectedPlotId : null
    : null;
  const overlaySpec = useMemo(() => (activePlotForOverlay ? buildSketchAnalyticalOverlay(activePlotForOverlay, studentModel) : null), [activePlotForOverlay, studentModel]);
  const projectedActuals = useMemo(() => (mode === 'prediction' && actualSeries?.length ? actualSeries.map((s) => projectSeriesToSvgPath(template, s)) : []), [mode, actualSeries, template]);

  return (
    <div className="space-y-2" data-sketch-pad>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-medium text-platform-fg-primary">{label}</span>
        <select aria-label="手绘图目标图种" disabled={lockPlotId} className="sim-hud-input h-7 w-auto px-2 py-0.5 text-[11px] disabled:opacity-75" value={selectedPlotId} onChange={(e) => setSelectedPlotId(e.target.value as SketchPlotId)}>
          {SKETCH_COORDINATE_PLOTS.map((plot) => <option key={plot.id} value={plot.id}>{lockPlotId ? `锁定：${plot.label}` : `目标：${plot.label}`}</option>)}
        </select>
      </div>
      <p className="text-platform-fg-muted">{hint}</p>

      <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
        {PEN_OPTIONS.map((option) => (
          <button
            key={option.id}
            type="button"
            disabled={disabled}
            onClick={() => setPenColor(option.hex)}
            className={`inline-flex items-center gap-1 rounded border px-2 py-0.5 transition disabled:cursor-not-allowed disabled:opacity-60 ${
              penColor === option.hex ? 'border-platform-action-primary bg-platform-action-primary/15 font-medium text-platform-fg-primary' : 'border-platform-border bg-platform-canvas/40 text-platform-fg-secondary hover:bg-platform-action-hover'
            }`}
          >
            <span className="size-2 rounded-full" style={{ backgroundColor: option.hex }} aria-hidden="true" />
            <span>{option.label}</span>
          </button>
        ))}
        <span className="text-[10px] text-platform-fg-muted">{template.subtitle}</span>
      </div>

      <div className="relative inline-block w-full max-w-[420px] overflow-hidden rounded-md border border-platform-border bg-white">
        <CoordinateTemplateLayer template={template} />
        <canvas
          ref={canvasRef}
          width={SKETCH_VIEW_W}
          height={SKETCH_VIEW_H}
          className={`relative z-10 block h-auto w-full touch-none bg-transparent ${disabled ? 'cursor-not-allowed opacity-90' : 'cursor-crosshair'}`}
          aria-label={label}
          onPointerDown={(event) => {
            if (disabled) return;
            const ctx = event.currentTarget.getContext('2d');
            const cursor = point(event);
            activeStrokeRef.current = { color: penColor, points: [cursor] };
            ctx?.beginPath();
            ctx?.moveTo(cursor.x, cursor.y);
            event.currentTarget.setPointerCapture(event.pointerId);
          }}
          onPointerMove={(event) => {
            if (disabled || event.buttons !== 1) return;
            const ctx = event.currentTarget.getContext('2d');
            if (!ctx) return;
            const cursor = point(event);
            activeStrokeRef.current?.points.push(cursor);
            ctx.strokeStyle = penColor;
            ctx.lineWidth = 2;
            ctx.lineCap = 'round';
            ctx.lineTo(cursor.x, cursor.y);
            ctx.stroke();
            moved.current += 1;
          }}
          onPointerUp={() => {
            if (disabled) return;
            if (activeStrokeRef.current && activeStrokeRef.current.points.length > 1) {
              strokesRef.current = [...strokesRef.current, activeStrokeRef.current];
              setStrokeCount(strokesRef.current.length);
            }
            activeStrokeRef.current = null;
            publish();
          }}
        />
        {mode === 'analysis' && overlaySpec?.supported && showOverlay ? (
          <ReadOnlyOverlaySvg viewBox={overlaySpec.viewBox} paths={overlaySpec.paths} markers={overlaySpec.markers} maxTextX={SKETCH_VIEW_W - 72} markerRadius={3.5} dataAttr="analytical" />
        ) : null}
        {mode === 'prediction' && projectedActuals.length > 0 && showActualOverlay ? (
          <ReadOnlyOverlaySvg
            viewBox={`0 0 ${SKETCH_VIEW_W} ${SKETCH_VIEW_H}`}
            paths={projectedActuals.filter((s) => Boolean(s.d)).map((s) => ({ id: s.id, d: s.d, stroke: s.color, dashed: s.dashed }))}
            markers={projectedActuals.flatMap((s) => s.markers)}
            maxTextX={SKETCH_VIEW_W - 88}
            markerRadius={3}
            dataAttr="actual"
          />
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" size="sm" variant="outline" disabled={disabled || strokeCount === 0} className={simulationUi.buttonOutline} onClick={handleUndoStroke}>
          <RotateCcw className="mr-1 size-3" aria-hidden="true" />
          <span>撤销上一笔</span>
        </Button>
        <Button type="button" size="sm" variant="outline" disabled={disabled} className={simulationUi.buttonOutline} onClick={handleClearCanvas}>清空手绘</Button>
        <Button type="button" size="sm" variant="outline" disabled={recognizing} data-sketch-recognize className={simulationUi.buttonOutline} onClick={() => { void runSketchRecognition(); }}>
          <Sparkles className="mr-1 size-3" aria-hidden="true" />
          <span>{recognizing ? '识图中...' : '识图核验'}</span>
        </Button>

        {mode === 'analysis' && overlaySpec ? (
          <label className={`inline-flex items-center gap-1 text-[11px] ${overlaySpec.supported ? 'cursor-pointer text-amber-700 dark:text-amber-300' : 'cursor-not-allowed text-platform-fg-muted opacity-70'}`}>
            <input type="checkbox" data-sketch-overlay-toggle disabled={!overlaySpec.supported} checked={overlaySpec.supported && showOverlay} onChange={(e) => { if (overlaySpec.supported) setShowOverlay(e.target.checked); }} />
            <Layers className="size-3" aria-hidden="true" />
            <span>{overlaySpec.supported ? '叠加本人模型参考特征' : '当前结构不支持参考叠加'}</span>
          </label>
        ) : null}
        {mode === 'prediction' && projectedActuals.length > 0 ? (
          <label className="inline-flex cursor-pointer items-center gap-1 text-[11px] text-cyan-700 dark:text-cyan-300">
            <input type="checkbox" data-sketch-actual-overlay-toggle checked={showActualOverlay} onChange={(e) => setShowActualOverlay(e.target.checked)} />
            <Layers className="size-3" aria-hidden="true" />
            <span>叠加实测运行轨迹对照</span>
          </label>
        ) : null}
      </div>

      {mode === 'analysis' && overlaySpec && !overlaySpec.supported && overlaySpec.unsupportedReason ? (
        <p data-sketch-overlay-unsupported className="text-[11px] text-amber-700 dark:text-amber-300">{overlaySpec.unsupportedReason}</p>
      ) : null}
      {mode === 'prediction' && projectedActuals.length > 0 && showActualOverlay ? (
        <div className="sim-hud-tile space-y-1 p-2 text-[10px] text-platform-fg-secondary" data-sketch-actual-summary>
          <p className="font-medium text-platform-fg-primary">运行前预测 vs 仿真真值对照（只读覆盖层）</p>
          <div className="flex flex-wrap gap-3">
            {projectedActuals.map((s) => (
              <span key={s.id} className="inline-flex items-center gap-1"><span className="inline-block h-0.5 w-3" style={{ backgroundColor: s.color }} /><span>{s.label}</span></span>
            ))}
          </div>
          <p className="text-platform-fg-muted">对比您的预测手绘曲线与实测轨迹的起终点、峰值及警戒线跨越情况，分析误差成因。</p>
        </div>
      ) : null}
      {recognizeError ? <p role="alert" className="text-[11px] text-rose-600 dark:text-rose-300">{recognizeError}</p> : null}
      {verdict ? (
        <div data-sketch-verdict className="sim-hud-tile space-y-1 p-2 text-[11px] text-platform-fg-secondary">
          <p className="flex items-center gap-1 font-medium text-platform-fg-primary">
            <Eye className="size-3.5 text-cyan-500" aria-hidden="true" />
            <span>识图结果：{verdict.sketchBlank ? '空白草图' : sketchLabelForId(verdict.sketchKind)}{verdict.sketchEvaluation ? ` · ${verdict.sketchEvaluation}` : ''}</span>
          </p>
          {verdict.featureChecks?.length ? <ul className="list-disc space-y-0.5 pl-4 text-[10px] text-platform-fg-secondary">{verdict.featureChecks.map((item) => <li key={item}>{item}</li>)}</ul> : null}
          {verdict.socraticHint ? <p className="text-[10px] text-cyan-700 dark:text-cyan-300">思考提示：{verdict.socraticHint}</p> : null}
          {overlaySpec ? <ul className="list-disc space-y-0.5 pl-4 text-[10px] text-platform-fg-muted">{overlaySpec.referenceNotes.map((note) => <li key={note}>{note}</li>)}</ul> : null}
          <p className="text-[10px] text-emerald-700 dark:text-emerald-300">纯画布隔离保护：参考特征仅绘制在只读覆盖层，不会污染上传草图像素。</p>
        </div>
      ) : null}
    </div>
  );
}
