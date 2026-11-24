import type { DestroyerSample } from '../simulations/destroyer-experiment';
import type { VesselSample } from '../simulations/vessel-experiment';
import type { FrozenVesselStudentModel } from './student-analysis';
import {
  DESTROYER_STEP_SPECS_EARLY,
  type DestroyerStepWorkbenchSpec,
} from './destroyer-step-specs-early';
import { DESTROYER_STEP_SPECS_LATE } from './destroyer-step-specs-late';

export type { DestroyerStepWorkbenchSpec };
export {
  extractDestroyerHeadingOverlay,
  extractDestroyerKpMultiplier,
  extractDestroyerYawRateOverlay,
} from './destroyer-step-specs-early';

export const DESTROYER_STEP_SPECS_LIST: readonly DestroyerStepWorkbenchSpec[] = [
  ...DESTROYER_STEP_SPECS_EARLY,
  ...DESTROYER_STEP_SPECS_LATE,
];

export const DESTROYER_STEP_SPECS: Readonly<Record<number, DestroyerStepWorkbenchSpec>> =
  Object.fromEntries(DESTROYER_STEP_SPECS_LIST.map((spec) => [spec.seq, spec]));

/** 将 055 驱逐舰采样数组转为通用 VesselSample[]，保持 series key 完全一致。 */
export function toDestroyerVesselSamples(samples: readonly DestroyerSample[]): VesselSample[] {
  return samples.map((sample) => ({
    time: sample.time,
    values: {
      desiredHeading: sample.desiredHeading,
      actualHeading: sample.actualHeading,
      yawRate: sample.yawRate,
      rudder: sample.rudder,
      manualRudder: sample.manualRudder,
      speed: sample.speed,
      crossTrackError: sample.crossTrackError,
    },
  }));
}

/** 解析当前激活的本人冻结船体模型（供手绘叠加与步骤分析使用）。 */
export function resolveDestroyerActiveHullModel(
  models: readonly FrozenVesselStudentModel[],
  designStudentModelId?: string,
  predictionModelId?: string,
): FrozenVesselStudentModel | null {
  return (
    models.find((model) => model.id === designStudentModelId) ??
    models.find((model) => model.id === predictionModelId) ??
    models.filter((model) => model.channel === 'rudder-to-yaw').at(-1) ??
    models.at(-1) ??
    null
  );
}

/** 计算当前 Kp 相对建议 Kp 的规定倍率（0.5 / 1 / 2）。 */
export function resolveDestroyerKpMultiplier(
  kp: number,
  recommendedKp: number | undefined,
): number | undefined {
  if (!recommendedKp || !Number.isFinite(recommendedKp) || recommendedKp <= 0) return undefined;
  return [0.5, 1, 2].find((ratio) => Math.abs(kp / recommendedKp - ratio) < 1e-4);
}
