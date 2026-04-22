export type Unit44GradientPoint = {
  x: number;
  fx: number;
};

export type Unit44PlotPoint = {
  x: number;
  y: number;
};

export type Unit44GradientRevealState = {
  visiblePointCount: number;
  visibleSegmentCount: number;
  activePointIndex: number;
};

export type Unit44ParetoPoint = {
  id: string;
  markerLabel?: string;
  pointLabel: string;
  itae: number;
  eu: number;
  ts: number;
  peak: number;
  K: number;
  T: number;
  alphaT: number;
};

export const UNIT_4_4_GRADIENT_POINTS: readonly Unit44GradientPoint[] = [
  { x: 0, fx: 10 },
  { x: 1.5, fx: 3.25 },
  { x: 2.25, fx: 1.5625 },
  { x: 2.625, fx: 1.140625 },
  { x: 2.8125, fx: 1.03515625 },
] as const;

export const UNIT_4_4_PARETO_FRONT_POINTS: readonly Unit44ParetoPoint[] = [
  { id: 'pf-00', pointLabel: '极快端', itae: 11.9475306758, eu: 1395.431148268, ts: 11.3, peak: 41.2248990527, K: 5.9879201773, T: 9.1140531744, alphaT: 1.3238170172 },
  { id: 'pf-01', markerLabel: 'P1', pointLabel: '快速端 P1', itae: 19.1180886328, eu: 218.3021582804, ts: 11.6, peak: 15.3585144361, K: 2.427399531, T: 10.0554198675, alphaT: 1.5892501565 },
  { id: 'pf-02', pointLabel: '前沿点 3', itae: 26.0385987962, eu: 135.8382701237, ts: 13.6, peak: 10.8701957853, K: 2.0755030655, T: 10.1642335018, alphaT: 1.9352145932 },
  { id: 'pf-03', pointLabel: '前沿点 4', itae: 32.0801691761, eu: 99.3052567019, ts: 15.2, peak: 8.6196028288, K: 1.8656229566, T: 10.2326966247, alphaT: 2.2082676067 },
  { id: 'pf-04', pointLabel: '前沿点 5', itae: 38.0555616221, eu: 77.219261664, ts: 16.6, peak: 7.1278847928, K: 1.7102585007, T: 10.2894528616, alphaT: 2.4634708771 },
  { id: 'pf-05', markerLabel: 'P2', pointLabel: '中间点 P2', itae: 44.5814663642, eu: 61.4348793791, ts: 18, peak: 5.9772273935, K: 1.5778810965, T: 10.3378925767, alphaT: 2.7290186905 },
  { id: 'pf-06', pointLabel: '前沿点 7', itae: 52.2031532772, eu: 49.1390297687, ts: 19.5, peak: 5.0132212459, K: 1.4563468679, T: 10.4258062967, alphaT: 3.0278144317 },
  { id: 'pf-07', pointLabel: '前沿点 8', itae: 62.1271672207, eu: 38.6444371223, ts: 21.3, peak: 4.1347239678, K: 1.3323838931, T: 10.5309805257, alphaT: 3.3935080916 },
  { id: 'pf-08', pointLabel: '前沿点 9', itae: 76.987699085, eu: 29.0207365939, ts: 23.8, peak: 3.2643909718, K: 1.1936821649, T: 10.6968580573, alphaT: 3.9107576454 },
  { id: 'pf-09', markerLabel: 'P3', pointLabel: '节能端 P3', itae: 106.7629181174, eu: 19.1914526463, ts: 28.2, peak: 2.2819606425, K: 1.0098592764, T: 11.0339288409, alphaT: 4.8829568692 },
  { id: 'pf-10', pointLabel: '极省能端', itae: 223.6360259413, eu: 13.1891646382, ts: 59.1, peak: 1.2889308707, K: 0.9994416928, T: 10.1623534432, alphaT: 7.8799258819 },
] as const;

export const UNIT_4_4_PARETO_DEFAULT_POINT_ID = 'pf-05';
export const UNIT_4_4_PARETO_STEP11_POINT_IDS = ['pf-01', 'pf-05', 'pf-09'] as const;

export const UNIT_4_4_PARETO_FIGURE_LAYOUT = {
  width: 520,
  height: 320,
  padding: { top: 28, right: 32, bottom: 42, left: 52 },
} as const;

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function toPlotPoint(
  value: number,
  min: number,
  max: number,
  start: number,
  size: number,
  invert = false,
) {
  if (max === min) return start;
  const ratio = invert ? (max - value) / (max - min) : (value - min) / (max - min);
  return start + ratio * size;
}

export function getUnit44GradientRevealState(revealProgress: number): Unit44GradientRevealState {
  const clampedProgress = clamp(revealProgress, 0, 2);
  return {
    visiblePointCount: clampedProgress + 1,
    visibleSegmentCount: clampedProgress,
    activePointIndex: clampedProgress,
  };
}

export function getUnit44ProgressiveRevealVisibleCount(
  revealProgress: number,
  localRevealCount: number,
  allowInlineReveal: boolean,
  totalSteps: number,
) {
  const normalizedTotalSteps = Math.max(totalSteps, 1);
  const teacherVisibleCount = Math.min(Math.max(revealProgress + 1, 1), normalizedTotalSteps);
  return allowInlineReveal
    ? Math.min(Math.max(teacherVisibleCount, Math.max(localRevealCount, 1)), normalizedTotalSteps)
    : teacherVisibleCount;
}

export function getUnit44ParetoPoint(pointId: string) {
  return UNIT_4_4_PARETO_FRONT_POINTS.find((point) => point.id === pointId) ?? UNIT_4_4_PARETO_FRONT_POINTS[5];
}

export function getUnit44ParetoPlotPoint(point: Unit44ParetoPoint): Unit44PlotPoint {
  const { width, height, padding } = UNIT_4_4_PARETO_FIGURE_LAYOUT;
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;
  const minEu = Math.min(...UNIT_4_4_PARETO_FRONT_POINTS.map((item) => item.eu));
  const maxEu = Math.max(...UNIT_4_4_PARETO_FRONT_POINTS.map((item) => item.eu));
  const minItae = Math.min(...UNIT_4_4_PARETO_FRONT_POINTS.map((item) => item.itae));
  const maxItae = Math.max(...UNIT_4_4_PARETO_FRONT_POINTS.map((item) => item.itae));

  return {
    x: toPlotPoint(point.eu, minEu, maxEu, padding.left, plotWidth),
    y: toPlotPoint(point.itae, minItae, maxItae, padding.top, plotHeight, true),
  };
}

export function getUnit44NearestParetoPointId(pointer: Unit44PlotPoint) {
  const nearest = UNIT_4_4_PARETO_FRONT_POINTS.reduce(
    (best, point) => {
      const plotPoint = getUnit44ParetoPlotPoint(point);
      const distance = Math.hypot(plotPoint.x - pointer.x, plotPoint.y - pointer.y);
      return distance < best.distance ? { distance, pointId: point.id } : best;
    },
    { distance: Number.POSITIVE_INFINITY, pointId: UNIT_4_4_PARETO_DEFAULT_POINT_ID },
  );

  return nearest.pointId;
}

function toFixedString(value: number, digits: number) {
  return value.toFixed(digits);
}

export const UNIT_4_4_STEP11_PARETO_ROWS = UNIT_4_4_PARETO_STEP11_POINT_IDS.map((pointId) => {
  const point = getUnit44ParetoPoint(pointId);
  return [
    point.pointLabel,
    toFixedString(point.K, 4),
    toFixedString(point.T, 4),
    toFixedString(point.alphaT, 4),
    toFixedString(point.itae, 3),
    toFixedString(point.eu, 3),
    toFixedString(point.ts, 1),
    toFixedString(point.peak, 3),
  ] as const;
});
