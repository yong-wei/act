import { vesselRunMetricsRequest, vesselDpMetricsRequest, vesselIceMetricsRequest, type VesselIceMetricPoint, type VesselTracePoint, type VesselRunMetrics } from '@/features/simulations/run-evidence';
import { computeVirtualSimulationServerStep } from '@/lib/control-engine/server';
export type { VesselRunMetrics } from '@/features/simulations/run-evidence';

/** 评价使用已接收的原始20Hz量测。缺测、环绕和末段保持条件由公共数值入口处理。 */
export function calculateVesselRunMetrics(points: VesselTracePoint[], endTimeS: number, initialHeadingDeg = 0,
  terminalPoint?: VesselIceMetricPoint): VesselRunMetrics {
  const metrics = computeVirtualSimulationServerStep<VesselRunMetrics>(vesselRunMetricsRequest(points,endTimeS,initialHeadingDeg));
  if (points.some((point) => point.dp)) {
    Object.assign(metrics, computeVirtualSimulationServerStep<Record<string, number>>(vesselDpMetricsRequest(points, endTimeS)));
  }
  if (points.some((point) => point.ice)) {
    Object.assign(metrics, computeVirtualSimulationServerStep<Partial<VesselRunMetrics>>(vesselIceMetricsRequest(points, terminalPoint)));
  }
  return metrics;
}
