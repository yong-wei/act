import type { SketchPlotId } from '@/features/ilab/sketch-plots';

export const SKETCH_VIEW_W = 420;
export const SKETCH_VIEW_H = 240;
export const SKETCH_DEFAULT_PLOT_AREA = { left: 46, top: 24, right: 402, bottom: 206 } as const;

export interface SketchAxisBounds {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
  xLabel: string;
  yLabel: string;
  xUnit?: string;
  yUnit?: string;
  xTicks?: Array<{ value: number; label: string }>;
  yTicks?: Array<{ value: number; label: string }>;
  verticalMarkers?: Array<{ value: number; label: string; color?: string }>;
  horizontalMarkers?: Array<{ value: number; label: string; color?: string }>;
  rings?: Array<{ radius: number; label: string; color: string }>;
}

export interface SketchCoordinateTemplate {
  plotId: SketchPlotId;
  title: string;
  subtitle: string;
  bounds: SketchAxisBounds;
  plotArea: { left: number; top: number; right: number; bottom: number };
}

export interface SketchActualCurveSeries {
  id?: string;
  label: string;
  color: string;
  dashed?: boolean;
  points: Array<{ x: number; y: number }>;
}

export interface ProjectedSvgMarker {
  id: string;
  x: number;
  y: number;
  color: string;
  label: string;
}

export interface ProjectedSvgSeries {
  id: string;
  label: string;
  color: string;
  dashed?: boolean;
  d: string;
  markers: ProjectedSvgMarker[];
}

const ticksOf = (vals: number[], fixed?: number) =>
  vals.map((value) => ({ value, label: fixed !== undefined ? value.toFixed(fixed) : String(value) }));

const DEFAULT_TEMPLATES: Record<SketchPlotId, Omit<SketchCoordinateTemplate, 'plotArea'>> = {
  'time-response': {
    plotId: 'time-response',
    title: '时域响应坐标系',
    subtitle: '横轴为仿真时间，纵轴为系统响应幅值',
    bounds: {
      xMin: 0, xMax: 300, yMin: -10, yMax: 10,
      xLabel: '时间 t', yLabel: '响应幅值', xUnit: 's',
      xTicks: ticksOf([0, 60, 120, 180, 240, 300]),
      yTicks: ticksOf([-10, -5, 0, 5, 10]),
      verticalMarkers: [{ value: 20, label: 't=20s 激励', color: '#0ea5e9' }, { value: 180, label: 't=180s 切换', color: '#f59e0b' }],
      horizontalMarkers: [{ value: 0, label: '0 基线', color: '#64748b' }],
    },
  },
  bode: {
    plotId: 'bode',
    title: '伯德图对数频率坐标系',
    subtitle: '横轴为对数角频率 ω，纵轴为幅频/相频参考',
    bounds: {
      xMin: -2, xMax: 1, yMin: -60, yMax: 20,
      xLabel: '角频率 ω', yLabel: '对数幅值/相位', xUnit: 'rad/s', yUnit: 'dB',
      xTicks: [{ value: -2, label: '0.01' }, { value: -1, label: '0.1' }, { value: 0, label: '1' }, { value: 1, label: '10' }],
      yTicks: ticksOf([-60, -40, -20, 0, 20]),
      horizontalMarkers: [{ value: 0, label: '0 dB 穿越线', color: '#64748b' }, { value: -40, label: '-180° 相位线', color: '#ef4444' }],
    },
  },
  nyquist: {
    plotId: 'nyquist',
    title: '奈奎斯特复平面坐标系',
    subtitle: '实部 Re 与虚部 Im 复平面，标出 (-1, j0) 稳定临界点',
    bounds: {
      xMin: -1.6, xMax: 1.6, yMin: -1.4, yMax: 1.0,
      xLabel: '实部 Re', yLabel: '虚部 Im',
      xTicks: ticksOf([-1.5, -1, -0.5, 0, 0.5, 1, 1.5]),
      yTicks: ticksOf([-1.2, -0.6, 0, 0.6]),
      verticalMarkers: [{ value: 0, label: 'Im 轴', color: '#64748b' }, { value: -1, label: '(-1,j0) 临界线', color: '#ef4444' }],
      horizontalMarkers: [{ value: 0, label: 'Re 轴', color: '#64748b' }],
    },
  },
  'root-locus': {
    plotId: 'root-locus',
    title: 's 平面根轨迹坐标系',
    subtitle: '左半平面 Re(s) < 0 为稳定区，虚轴为稳定边界',
    bounds: {
      xMin: -1.6, xMax: 0.4, yMin: -1.2, yMax: 1.2,
      xLabel: '实部 Re(s)', yLabel: '虚部 Im(s)',
      xTicks: [{ value: -1.5, label: '-1.5' }, { value: -1, label: '-1.0' }, { value: -0.5, label: '-0.5' }, { value: 0, label: '0' }, { value: 0.4, label: '+0.4' }],
      yTicks: [{ value: -1, label: '-j1.0' }, { value: -0.5, label: '-j0.5' }, { value: 0, label: '0' }, { value: 0.5, label: '+j0.5' }, { value: 1, label: '+j1.0' }],
      verticalMarkers: [{ value: 0, label: '虚轴稳定边界', color: '#ef4444' }],
      horizontalMarkers: [{ value: 0, label: '实轴', color: '#64748b' }],
    },
  },
  'frequency-amplitude': {
    plotId: 'frequency-amplitude',
    title: '共振幅频响应坐标系',
    subtitle: '横轴为激励频率比 ω/ωₙ，纵轴为横摇幅频放大倍率',
    bounds: {
      xMin: 0.5, xMax: 1.6, yMin: 0, yMax: 3.0,
      xLabel: '频率比 ω/ωₙ', yLabel: '幅值倍率', yUnit: 'x',
      xTicks: ticksOf([0.5, 0.8, 1.0, 1.2, 1.4, 1.6], 1),
      yTicks: ticksOf([0, 1.0, 2.0, 3.0], 1),
      verticalMarkers: [{ value: 1.0, label: '1.0x 共振峰', color: '#f59e0b' }],
      horizontalMarkers: [{ value: 1.0, label: '1.0 静态基准', color: '#64748b' }],
    },
  },
  'planar-envelope': {
    plotId: 'planar-envelope',
    title: '平面轨迹与警戒圈坐标系',
    subtitle: '东向 E (m) 与北向 N (m) 定位包络与井口安全警戒圈',
    bounds: {
      xMin: -4, xMax: 4, yMin: -4, yMax: 4,
      xLabel: '东向位移 E', yLabel: '北向位移 N', xUnit: 'm', yUnit: 'm',
      xTicks: ticksOf([-4, -2, 0, 2, 4]),
      yTicks: ticksOf([-4, -2, 0, 2, 4]),
      verticalMarkers: [{ value: 0, label: 'E=0', color: '#64748b' }],
      horizontalMarkers: [{ value: 0, label: 'N=0', color: '#64748b' }],
      rings: [
        { radius: 1.0, label: '绿圈 1.0m', color: '#10b981' },
        { radius: 1.5, label: '黄圈 1.5m', color: '#f59e0b' },
        { radius: 2.5, label: '红圈 2.5m', color: '#ef4444' },
      ],
    },
  },
};

function autoTicks(min: number, max: number, count = 5): Array<{ value: number; label: string }> {
  const span = max - min;
  if (!(span > 0) || !Number.isFinite(span)) return [];
  const digits = span <= 4 ? 1 : 0;
  return Array.from({ length: count }, (_, idx) => {
    const rounded = Number((min + (span * idx) / (count - 1)).toFixed(2));
    return { value: rounded, label: digits > 0 ? rounded.toFixed(1) : String(Math.round(rounded)) };
  });
}

export function buildSketchCoordinateTemplate(
  plotId: SketchPlotId,
  override?: Partial<SketchAxisBounds> & { title?: string; subtitle?: string },
): SketchCoordinateTemplate {
  const base = DEFAULT_TEMPLATES[plotId];
  const { title, subtitle, ...boundsOverride } = override ?? {};
  const merged: SketchAxisBounds = { ...base.bounds, ...boundsOverride };
  if (boundsOverride.xTicks === undefined && (boundsOverride.xMin !== undefined || boundsOverride.xMax !== undefined)) {
    merged.xTicks = autoTicks(merged.xMin, merged.xMax);
  }
  if (boundsOverride.yTicks === undefined && (boundsOverride.yMin !== undefined || boundsOverride.yMax !== undefined)) {
    merged.yTicks = autoTicks(merged.yMin, merged.yMax);
  }
  if (boundsOverride.verticalMarkers === undefined && merged.verticalMarkers) {
    merged.verticalMarkers = merged.verticalMarkers.filter((m) => m.value >= merged.xMin && m.value <= merged.xMax);
  }
  if (boundsOverride.horizontalMarkers === undefined && merged.horizontalMarkers) {
    merged.horizontalMarkers = merged.horizontalMarkers.filter((m) => m.value >= merged.yMin && m.value <= merged.yMax);
  }
  return {
    plotId,
    title: title ?? base.title,
    subtitle: subtitle ?? base.subtitle,
    bounds: merged,
    plotArea: { ...SKETCH_DEFAULT_PLOT_AREA },
  };
}

export function mapXToPlot(template: SketchCoordinateTemplate, x: number, clamp = true): number {
  const { xMin, xMax } = template.bounds;
  const { left, right } = template.plotArea;
  const span = Math.abs(xMax - xMin) > 1e-9 ? xMax - xMin : 1;
  const ratio = (x - xMin) / span;
  const t = clamp ? Math.max(0, Math.min(1, ratio)) : ratio;
  return left + t * (right - left);
}

export function mapYToPlot(template: SketchCoordinateTemplate, y: number, clamp = true): number {
  const { yMin, yMax } = template.bounds;
  const { top, bottom } = template.plotArea;
  const span = Math.abs(yMax - yMin) > 1e-9 ? yMax - yMin : 1;
  const ratio = (y - yMin) / span;
  const t = clamp ? Math.max(0, Math.min(1, ratio)) : ratio;
  return bottom - t * (bottom - top);
}

export function projectSeriesToSvgPath(
  template: SketchCoordinateTemplate,
  series: SketchActualCurveSeries,
): ProjectedSvgSeries {
  const valid = series.points.filter((pt) => Number.isFinite(pt.x) && Number.isFinite(pt.y));
  const id = series.id ?? series.label;
  if (valid.length === 0) {
    return { id, label: series.label, color: series.color, dashed: series.dashed, d: '', markers: [] };
  }
  const projected = valid.map((pt) => ({
    rawX: pt.x,
    rawY: pt.y,
    px: mapXToPlot(template, pt.x, true),
    py: mapYToPlot(template, pt.y, true),
  }));
  const d = projected.map((pt, i) => `${i === 0 ? 'M' : 'L'}${pt.px.toFixed(1)},${pt.py.toFixed(1)}`).join(' ');
  const first = projected[0];
  const markers: ProjectedSvgMarker[] = [
    { id: `${id}-start`, x: first.px, y: first.py, color: series.color, label: `起点(${first.rawX.toFixed(1)},${first.rawY.toFixed(1)})` },
  ];
  if (projected.length >= 3) {
    let peakIdx = 0;
    let peakScore = -Infinity;
    projected.forEach((pt, idx) => {
      const score = template.plotId === 'planar-envelope' ? Math.hypot(pt.rawX, pt.rawY) : Math.abs(pt.rawY);
      if (score > peakScore) {
        peakScore = score;
        peakIdx = idx;
      }
    });
    if (peakIdx > 0 && peakIdx < projected.length - 1) {
      const peak = projected[peakIdx];
      markers.push({
        id: `${id}-peak`,
        x: peak.px,
        y: peak.py,
        color: series.color,
        label: template.plotId === 'planar-envelope'
          ? `最大偏移 ${Math.hypot(peak.rawX, peak.rawY).toFixed(2)}m`
          : `峰值(${peak.rawX.toFixed(1)},${peak.rawY.toFixed(2)})`,
      });
    }
  }
  if (projected.length >= 2) {
    const last = projected[projected.length - 1];
    markers.push({ id: `${id}-end`, x: last.px, y: last.py, color: series.color, label: `终点(${last.rawX.toFixed(1)},${last.rawY.toFixed(1)})` });
  }
  return { id, label: series.label, color: series.color, dashed: series.dashed, d, markers };
}

function drawCanvasSegment(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  color: string,
  width = 1,
  dashed = false,
) {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.setLineDash(dashed ? [4, 3] : []);
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

export function drawCoordinateTemplateOnCanvas(
  ctx: CanvasRenderingContext2D,
  template: SketchCoordinateTemplate,
): void {
  const { left, top, right, bottom } = template.plotArea;
  const plotW = right - left;
  const plotH = bottom - top;
  const { bounds } = template;

  ctx.save();
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, SKETCH_VIEW_W, SKETCH_VIEW_H);

  for (const tick of bounds.xTicks ?? []) {
    const x = mapXToPlot(template, tick.value);
    drawCanvasSegment(ctx, x, top, x, bottom, '#e2e8f0');
  }
  for (const tick of bounds.yTicks ?? []) {
    const y = mapYToPlot(template, tick.value);
    drawCanvasSegment(ctx, left, y, right, y, '#e2e8f0');
  }

  ctx.setLineDash([]);
  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 1;
  ctx.strokeRect(left, top, plotW, plotH);

  if (bounds.rings && bounds.rings.length > 0) {
    const cx0 = mapXToPlot(template, 0, false);
    const cy0 = mapYToPlot(template, 0, false);
    const xSpan = Math.max(1e-6, bounds.xMax - bounds.xMin);
    const ySpan = Math.max(1e-6, bounds.yMax - bounds.yMin);
    ctx.save();
    ctx.beginPath();
    ctx.rect(left, top, plotW, plotH);
    ctx.clip();
    for (const ring of bounds.rings) {
      const rx = (ring.radius / xSpan) * plotW;
      const ry = (ring.radius / ySpan) * plotH;
      ctx.save();
      ctx.translate(cx0, cy0);
      ctx.scale(rx, ry);
      ctx.beginPath();
      ctx.arc(0, 0, 1, 0, Math.PI * 2);
      ctx.restore();
      ctx.strokeStyle = ring.color;
      ctx.lineWidth = 1.2;
      ctx.setLineDash([4, 3]);
      ctx.stroke();
      ctx.fillStyle = ring.color;
      ctx.font = '600 9px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(ring.label, Math.min(right - 48, cx0 + 4), Math.max(top + 10, cy0 - ry + 10));
    }
    ctx.restore();
  }

  for (const marker of bounds.verticalMarkers ?? []) {
    const x = mapXToPlot(template, marker.value);
    const color = marker.color ?? '#64748b';
    drawCanvasSegment(ctx, x, top, x, bottom, color, 1.1, true);
    ctx.fillStyle = color;
    ctx.font = '600 9px sans-serif';
    ctx.textAlign = x > right - 46 ? 'right' : 'left';
    ctx.fillText(marker.label, x > right - 46 ? x - 3 : x + 3, top + 11);
  }
  for (const marker of bounds.horizontalMarkers ?? []) {
    const y = mapYToPlot(template, marker.value);
    const color = marker.color ?? '#64748b';
    drawCanvasSegment(ctx, left, y, right, y, color, 1.1, true);
    ctx.fillStyle = color;
    ctx.font = '600 9px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(marker.label, left + 4, Math.max(top + 10, y - 3));
  }

  if (template.plotId === 'nyquist') {
    const critX = mapXToPlot(template, -1);
    const critY = mapYToPlot(template, 0);
    ctx.setLineDash([]);
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.arc(critX, critY, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.font = '600 9px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('(-1,j0)', critX + 4, critY + 11);
  }

  ctx.setLineDash([]);
  ctx.strokeStyle = '#64748b';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(left, top);
  ctx.lineTo(left, bottom);
  ctx.lineTo(right, bottom);
  ctx.stroke();

  ctx.fillStyle = '#475569';
  ctx.font = '500 9px sans-serif';
  ctx.textAlign = 'center';
  for (const tick of bounds.xTicks ?? []) {
    ctx.fillText(tick.label, mapXToPlot(template, tick.value), bottom + 12);
  }
  ctx.textAlign = 'right';
  for (const tick of bounds.yTicks ?? []) {
    ctx.fillText(tick.label, left - 4, mapYToPlot(template, tick.value) + 3);
  }

  ctx.fillStyle = '#0f172a';
  ctx.font = '600 10px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(bounds.yUnit ? `${bounds.yLabel} (${bounds.yUnit})` : bounds.yLabel, 6, 14);
  ctx.textAlign = 'right';
  ctx.fillText(bounds.xUnit ? `${bounds.xLabel} (${bounds.xUnit})` : bounds.xLabel, right, SKETCH_VIEW_H - 6);
  ctx.restore();
}

export interface SketchStroke {
  color: string;
  points: Array<{ x: number; y: number }>;
}

export function clearTransparentSketchCanvas(canvas: HTMLCanvasElement, context: CanvasRenderingContext2D): void {
  if (typeof context.clearRect === 'function') context.clearRect(0, 0, canvas.width, canvas.height);
}

export function redrawSketchStrokes(
  canvas: HTMLCanvasElement,
  context: CanvasRenderingContext2D,
  strokes: SketchStroke[],
): number {
  clearTransparentSketchCanvas(canvas, context);
  let totalSegments = 0;
  for (const stroke of strokes) {
    if (stroke.points.length < 2) continue;
    context.beginPath();
    context.strokeStyle = stroke.color;
    context.lineWidth = 2;
    context.lineCap = 'round';
    context.moveTo(stroke.points[0].x, stroke.points[0].y);
    for (let i = 1; i < stroke.points.length; i += 1) {
      context.lineTo(stroke.points[i].x, stroke.points[i].y);
      totalSegments += 1;
    }
    context.stroke();
  }
  return totalSegments;
}

export function composeSketchVisionImage(
  studentCanvas: HTMLCanvasElement | null,
  rawDataUrl: string,
  template: SketchCoordinateTemplate,
): string {
  if (!studentCanvas || typeof document === 'undefined') return rawDataUrl;
  try {
    const offscreen = document.createElement('canvas');
    offscreen.width = SKETCH_VIEW_W;
    offscreen.height = SKETCH_VIEW_H;
    const ctx = offscreen.getContext('2d');
    if (
      !ctx ||
      typeof ctx.drawImage !== 'function' ||
      typeof ctx.fillText !== 'function' ||
      typeof ctx.setLineDash !== 'function' ||
      typeof ctx.arc !== 'function' ||
      typeof ctx.save !== 'function' ||
      typeof ctx.restore !== 'function'
    ) {
      return rawDataUrl;
    }
    drawCoordinateTemplateOnCanvas(ctx, template);
    ctx.drawImage(studentCanvas, 0, 0, SKETCH_VIEW_W, SKETCH_VIEW_H);
    const composed = offscreen.toDataURL('image/png');
    return composed && composed.startsWith('data:image/') ? composed : rawDataUrl;
  } catch {
    return rawDataUrl;
  }
}
