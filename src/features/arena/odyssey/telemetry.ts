import type { ControllerArtifact } from '../types';

export interface OdysseyOfficialTelemetryMetrics {
  settlingTime: number;
  overshoot: number;
  steadyStateError: number;
  controlEnergy: number;
  controlSmoothness?: number;
}

type TelemetryKey = keyof Required<OdysseyOfficialTelemetryMetrics>;

const REQUIRED_TELEMETRY: Array<{
  key: keyof OdysseyOfficialTelemetryMetrics;
  label: string;
}> = [
  { key: 'settlingTime', label: '通关时间' },
  { key: 'overshoot', label: '偏离峰值' },
  { key: 'steadyStateError', label: '终点误差' },
  { key: 'controlEnergy', label: '操作强度' },
];

function finiteMetric(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function readMetric(metrics: Record<string, unknown>, key: TelemetryKey): number | null {
  if (key === 'overshoot') {
    return finiteMetric(metrics.overshoot) ?? finiteMetric(metrics.maxOvershoot);
  }
  if (key === 'steadyStateError') {
    const officialValue = finiteMetric(metrics.steadyStateError);
    if (officialValue !== null) return Math.abs(officialValue);
    const gamePercentValue = finiteMetric(metrics.steadyError);
    return gamePercentValue === null ? null : Math.abs(gamePercentValue) / 100;
  }
  return finiteMetric(metrics[key]);
}

export function normalizeOdysseyOfficialTelemetry(metrics: Record<string, unknown> | undefined): {
  ok: true;
  metrics: OdysseyOfficialTelemetryMetrics;
} | {
  ok: false;
  reason: string;
} {
  const source = metrics ?? {};
  const missing = REQUIRED_TELEMETRY.filter((item) => readMetric(source, item.key) === null);
  if (missing.length > 0) {
    return {
      ok: false,
      reason: `缺少通关遥测：${missing.map((item) => item.label).join('、')}。`,
    };
  }

  const controlSmoothness = finiteMetric(source.controlSmoothness);
  return {
    ok: true,
    metrics: {
      settlingTime: readMetric(source, 'settlingTime')!,
      overshoot: readMetric(source, 'overshoot')!,
      steadyStateError: readMetric(source, 'steadyStateError')!,
      controlEnergy: readMetric(source, 'controlEnergy')!,
      ...(controlSmoothness === null ? {} : { controlSmoothness }),
    },
  };
}

export function readOdysseyOfficialTelemetryFromArtifact(artifact: ControllerArtifact): OdysseyOfficialTelemetryMetrics {
  const raw = artifact.params.odysseyOfficialMetricsJson;
  if (typeof raw !== 'string') {
    throw new Error('Odyssey official telemetry is missing from the Arena artifact.');
  }
  const parsed = JSON.parse(raw) as Record<string, unknown>;
  const normalized = normalizeOdysseyOfficialTelemetry(parsed);
  if (!normalized.ok) {
    throw new Error(normalized.reason);
  }
  return normalized.metrics;
}
