import { vesselRunMetricsRequest, type VesselTracePoint, type VesselRunMetrics } from '@/features/simulations/run-evidence';
import { computeVirtualSimulationServerStep } from '@/lib/control-engine/server';
export type { VesselRunMetrics } from '@/features/simulations/run-evidence';

/** 评价使用已接收的原始20Hz量测。缺测、环绕和末段保持条件由公共数值入口处理。 */
export function calculateVesselRunMetrics(points: VesselTracePoint[], endTimeS: number, initialHeadingDeg = 0): VesselRunMetrics {
  return computeVirtualSimulationServerStep<VesselRunMetrics>(vesselRunMetricsRequest(points,endTimeS,initialHeadingDeg));
}
