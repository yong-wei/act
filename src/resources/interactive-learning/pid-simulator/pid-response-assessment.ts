export interface PidResponseAssessment {
  diverged: boolean;
  /** 峰值越界或含非有限值时需要钳制纵轴，否则曲线会被压成一条线。 */
  clampChart: boolean;
}

function maxDeviation(response: readonly number[], reference: number, start: number, end: number) {
  let deviation = 0;
  for (let index = start; index < end; index += 1) {
    deviation = Math.max(deviation, Math.abs(response[index] - reference));
  }
  return deviation;
}

/**
 * 判定闭环发散：含非有限值、峰值超过界限，或末四分之一窗口的最大偏差超过此前全部偏差（振幅仍在增大）。
 * 稳定响应的偏差随时间衰减，末段不会刷新最大偏差；周期接近或长于仿真窗口的缓慢发散无法从时域窗口识别。
 */
export function assessPidResponse(response: readonly number[], reference: number): PidResponseAssessment {
  const bound = Math.max(50, 50 * Math.abs(reference));
  let peakMagnitude = 0;
  for (const value of response) {
    if (!Number.isFinite(value)) return { diverged: true, clampChart: true };
    peakMagnitude = Math.max(peakMagnitude, Math.abs(value));
  }
  if (peakMagnitude > bound) return { diverged: true, clampChart: true };

  const n = response.length;
  if (n < 8) return { diverged: false, clampChart: false };
  const tailStart = Math.floor((3 * n) / 4);
  const growing =
    maxDeviation(response, reference, tailStart, n) > 1.05 * maxDeviation(response, reference, 0, tailStart);
  return { diverged: growing, clampChart: false };
}
