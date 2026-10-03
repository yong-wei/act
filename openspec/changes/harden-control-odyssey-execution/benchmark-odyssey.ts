import { computeOfficialOdysseyTelemetry } from '../../../src/resources/interactive-learning/control-odyssey/engine/official-simulation';

const input = {
  levelId: 'level-1',
  tier: 'bronze',
  controllerId: 'P' as const,
  controlMode: 'AUTO',
  pidParams: { kp: 1.6, ki: 0, kd: 0 },
  controllerLevels: { P: 5, PI: 0, PD: 0, PID: 0, VFB: 0, FF: 0, SMITH: 0 },
};

computeOfficialOdysseyTelemetry(input);
const timesMs = Array.from({ length: 10 }, () => {
  const start = performance.now();
  const metrics = computeOfficialOdysseyTelemetry(input);
  if (Math.abs(metrics.settlingTime - 2.8) > 1e-10) throw new Error('无延迟标定发生变化');
  return performance.now() - start;
}).sort((a, b) => a - b);

console.log(JSON.stringify({
  fixture: 'level-1 bronze P5 Kp=1.6 no modules',
  warmupRuns: 1,
  measuredRuns: 10,
  timesMs,
  medianMs: (timesMs[4] + timesMs[5]) / 2,
  maxMs: timesMs[9],
  metrics: computeOfficialOdysseyTelemetry(input),
}));
