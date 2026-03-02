/**
 * 仿真时间推进策略
 *
 * 目标：
 * - 在高倍率（如 8x）下保持可感知加速
 * - 避免切后台/卡顿后出现超大单帧步长导致数值不稳定
 */

export const SIMULATION_FIXED_STEP_SECONDS = 1 / 60;
export const SIMULATION_MAX_SUB_STEPS = 120;

const MAX_REAL_FRAME_DELTA_SECONDS = 0.25;

function clampRealFrameDelta(deltaSeconds: number): number {
  if (!Number.isFinite(deltaSeconds) || deltaSeconds <= 0) {
    return 0;
  }
  return Math.min(deltaSeconds, MAX_REAL_FRAME_DELTA_SECONDS);
}

function sanitizeSpeedScale(speedScale: number): number {
  if (!Number.isFinite(speedScale) || speedScale <= 0) {
    return 1;
  }
  return speedScale;
}

export function getSimulationDeltaFromMilliseconds(
  nowMs: number,
  lastMs: number,
  speedScale: number
): number {
  if (!Number.isFinite(lastMs) || lastMs <= 0) {
    return 0;
  }
  const realDeltaSeconds = (nowMs - lastMs) / 1000;
  return clampRealFrameDelta(realDeltaSeconds) * sanitizeSpeedScale(speedScale);
}

export function getSimulationDeltaFromSeconds(
  nowSeconds: number,
  lastSeconds: number,
  speedScale: number
): number {
  if (!Number.isFinite(lastSeconds) || lastSeconds <= 0) {
    return 0;
  }
  const realDeltaSeconds = nowSeconds - lastSeconds;
  return clampRealFrameDelta(realDeltaSeconds) * sanitizeSpeedScale(speedScale);
}
