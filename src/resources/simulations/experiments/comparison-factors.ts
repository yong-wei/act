import type { VesselSessionConfiguration } from '@/lib/control-engine/vessel-session';
import type { ComparisonModeValue } from '@/lib/student-model-artifact-contract';

export interface VesselComparisonFactors {physical:string[];student:string[];unmodeled:string[]}

export function activeVesselFactors(configuration:VesselSessionConfiguration,
  switches = configuration.environmentSwitches) {
  const preset = configuration.environment ?? 'P0';
  const active:string[] = [];
  if (switches?.wind_force_enabled ?? ['W1','W2','E1','E2'].includes(preset)) active.push('wind');
  if (switches?.wave_enabled ?? ['V1','V2','V3','E1','E2'].includes(preset)) active.push('wave');
  if (switches?.current_enabled ?? ['C1','C2','E1','E2'].includes(preset)) active.push('current');
  if (configuration.noiseLevel && configuration.noiseLevel !== 'N0') active.push('measurement-noise');
  if (configuration.ice) active.push('ice-contact');
  return active;
}

export function vesselComparisonFactors(configuration:VesselSessionConfiguration,mode:ComparisonModeValue,
  active = activeVesselFactors(configuration)):VesselComparisonFactors {
  return {physical:['sixdof-coupling','nonlinear-hull','actuator-dynamics','actuator-limits',...active],
    student:['identified-local-model',mode === 'hull_model' ? 'measured-actuator-input' : 'identified-actuator',
      mode === 'independent_closed_loop' ? 'independent-controller' : 'replayed-input'],
    unmodeled:['sixdof-coupling','nonlinear-hull',...(mode === 'hull_model' ? [] : ['actuator-rate-limits']),...active]};
}

export const VESSEL_FACTOR_LABELS:Record<string,string> = {
  'sixdof-coupling':'六自由度耦合','nonlinear-hull':'船体非线性','actuator-dynamics':'执行器动态',
  'actuator-limits':'执行器约束','actuator-rate-limits':'执行器速率限制',wind:'风载',wave:'波浪',current:'海流',
  'measurement-noise':'量测误差','identified-local-model':'本人辨识的局部模型','measured-actuator-input':'实际执行器量测输入',
  'identified-actuator':'本人辨识的执行器模型','independent-controller':'独立控制器','replayed-input':'已记录输入重放',
  'ice-contact':'冰板破坏、浮冰运动及摩擦',
};
