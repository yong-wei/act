/**
 * 版本化模型包的生产激活指针。
 *
 * 七模型 `SIMULATION_MODEL_REGISTRY` 仍只登记旧单文件链（服务回退分母）。
 * 每个 logicalId 只指向当前激活的版本化包；旧版本目录与描述符已退役。
 */
import type { SimulationModelId } from './types';

export interface VersionedDefaultActivation {
  readonly packageId: string;
  readonly modelVersion: string;
  readonly baseUrl: string;
}

export const SIMULATION_VERSIONED_DEFAULTS: Partial<Record<SimulationModelId, VersionedDefaultActivation>> = {
  destroyer: {
    packageId: 'type055-nanchang-101',
    modelVersion: '2.2.1',
    baseUrl: '/assets/model-releases/type055-nanchang-101/v2.2.1',
  },
  'lng-carrier': {
    packageId: 'lng-changheng',
    modelVersion: '1.1.1',
    baseUrl: '/assets/model-releases/lng-changheng/v1.1.1',
  },
  container: {
    packageId: 'msc-tessa',
    modelVersion: '1.1.1',
    baseUrl: '/assets/model-releases/msc-tessa/v1.1.1',
  },
  icebreaker: {
    packageId: 'xue-long-2',
    modelVersion: '1.0.1',
    baseUrl: '/assets/model-releases/xue-long-2/v1.0.1',
  },
  'luxury-liner': {
    packageId: 'adora-magic-city',
    modelVersion: '1.0.1',
    baseUrl: '/assets/model-releases/adora-magic-city/v1.0.1',
  },
  'drilling-rig': {
    packageId: 'hysy-981',
    modelVersion: '1.1.1',
    baseUrl: '/assets/model-releases/hysy-981/v1.1.1',
  },
  dredger: {
    packageId: 'dredger-tianjing',
    modelVersion: '1.1.1',
    baseUrl: '/assets/model-releases/dredger-tianjing/v1.1.1',
  },
};

export function resolveVersionedDefault(logicalId: SimulationModelId): VersionedDefaultActivation | null {
  return SIMULATION_VERSIONED_DEFAULTS[logicalId] ?? null;
}
