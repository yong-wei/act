/**
 * 教学标注的纯逻辑与样式真源：默认精简（仅实际航迹线），
 * 样式与写实场景协调（低饱和青白族、低透明度），不照搬视频样式。
 */

/** 教学标注开关默认值：除实际航迹线外全部默认关闭。 */
export const DEFAULT_TEACHING_ANNOTATIONS_VISIBLE = false;

export const TRAIL_POINT_CAP = 4000;
export const TRAIL_SAMPLE_INTERVAL_SECONDS = 0.25;

/** 与写实场景协调的标注样式（青白族、低透明、加法混合友好）。 */
export const ANNOTATION_STYLE = {
  trail: { color: '#bfe8f5', opacity: 0.75, lineWidth: 2 },
  headingArc: { color: '#9fd8ea', opacity: 0.6, radiusFactor: 0.45, lineWidth: 2 },
  targetCourse: { color: '#f2c879', opacity: 0.55, dashSize: 12, gapSize: 8 },
  directionArrow: { color: '#cfeef8', opacity: 0.7 },
  worldLabel: { color: '#eaf7fc', background: 'rgba(10, 26, 36, 0.55)', fontSizePx: 42 },
} as const;

export function shouldRecordTrailPoint(
  lastRecordedAt: number,
  now: number,
  intervalSeconds = TRAIL_SAMPLE_INTERVAL_SECONDS
): boolean {
  return now - lastRecordedAt >= intervalSeconds;
}

export function appendTrailPoint<T>(
  points: readonly T[],
  point: T,
  cap: number = TRAIL_POINT_CAP
): T[] {
  const next = [...points, point];
  return next.length > cap ? next.slice(next.length - cap) : next;
}
