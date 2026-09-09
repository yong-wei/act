/**
 * 航向/动力定位达标计数（视觉层只读）：从驱逐舰场景抽出，供船队仿真共用。
 */

export interface AttainmentState {
  dwell: number;
  armed: boolean;
  maneuverActive: boolean;
  initialTargetDeg: number;
  /** 进入当前调节窗口以来的时间（s）。 */
  maneuverTime: number;
}

export function createAttainmentState(initialTargetDeg = 0): AttainmentState {
  return { dwell: 0, armed: true, maneuverActive: false, initialTargetDeg, maneuverTime: 0 };
}

const normalizeHeading = (heading: number) => ((heading % 360) + 360) % 360;

const normalizeSignedHeading = (heading: number) => {
  const normalized = normalizeHeading(heading);
  return normalized > 180 ? normalized - 360 : normalized;
};

/**
 * 目标偏离初始值后，误差在 maxError 内持续 3s 记一次达标；
 * 误差超过 2×maxError 重新武装。直线巡航段不记达标。
 */
export function advanceAttainment(
  state: AttainmentState,
  targetDeg: number,
  headingErrorDeg: number,
  maxErrorDeg: number,
  dt: number,
  maxSettlingTimeSec?: number,
): boolean {
  if (!state.maneuverActive && Math.abs(normalizeSignedHeading(targetDeg - state.initialTargetDeg)) > 2) {
    state.maneuverActive = true;
    state.maneuverTime = 0;
  }
  if (!state.maneuverActive) return false;
  state.maneuverTime += dt;
  if (headingErrorDeg <= maxErrorDeg) {
    state.dwell += dt;
    const withinDeadline = maxSettlingTimeSec === undefined || state.maneuverTime <= maxSettlingTimeSec;
    if (state.armed && state.dwell >= 3 && withinDeadline) {
      state.armed = false;
      return true;
    }
    return false;
  }
  state.dwell = 0;
  if (headingErrorDeg > maxErrorDeg * 2) {
    if (!state.armed) state.maneuverTime = 0;
    state.armed = true;
  }
  return false;
}

/** 动力定位：位置与航向同时进入死区后持续 holdSec 记一次达标。 */
export function advanceStationKeepAttainment(
  state: { dwell: number; armed: boolean },
  insideDeadzone: boolean,
  dt: number,
  holdSec = 3,
): boolean {
  if (!insideDeadzone) {
    state.dwell = 0;
    state.armed = true;
    return false;
  }
  state.dwell += dt;
  if (state.armed && state.dwell >= holdSec) {
    state.armed = false;
    return true;
  }
  return false;
}

export function absoluteHeadingErrorDeg(currentDeg: number, targetDeg: number): number {
  const raw = ((targetDeg - currentDeg + 540) % 360) - 180;
  return Math.abs(raw);
}

export function displayRpmFromThrust(thrust: number, maxThrust: number, ratedRpm: number): number {
  if (!Number.isFinite(thrust) || !Number.isFinite(maxThrust) || maxThrust <= 0) return 0;
  const q = Math.min(1, Math.max(0, thrust / maxThrust));
  return ratedRpm * Math.sqrt(q);
}

/** 从 clip 列表中随机取 1..n 条，供达标彩蛋播放。 */
export function pickRandomSubset<T>(items: readonly T[], rng: () => number = Math.random): T[] {
  if (items.length === 0) return [];
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    const current = copy[i];
    const swap = copy[j];
    if (current === undefined || swap === undefined) continue;
    copy[i] = swap;
    copy[j] = current;
  }
  const count = 1 + Math.floor(rng() * copy.length);
  return copy.slice(0, count);
}
