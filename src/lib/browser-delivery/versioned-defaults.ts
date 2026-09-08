/**
 * 版本化模型包的生产激活指针。
 *
 * 七模型 `SIMULATION_MODEL_REGISTRY` 仍只登记旧单文件链（回退分母）。
 * 授权激活把某 logicalId 指到已接收的版本化包；授权回滚删除该条目即可恢复旧默认，
 * 不必改场景代码，也不必重新下载或修改模型资产。
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
    modelVersion: '2.1.3',
    baseUrl: '/assets/model-releases/type055-nanchang-101/v2.1.3',
  },
  // xue-long-2 v0.1.0 保持可逆候选态（spec: versioned-simulation-model-package-integration）：
  // 激活门槛 = 三档+回退路径浏览器视觉验收 + 压缩重编码（上游发修订版后接收）。
  // 候选验收面：/simulations/xue-long-2-candidate；激活 = 在此登记 icebreaker 指针。
};

export function resolveVersionedDefault(logicalId: SimulationModelId): VersionedDefaultActivation | null {
  return SIMULATION_VERSIONED_DEFAULTS[logicalId] ?? null;
}
