import type { VesselRunSummary } from '@/features/simulations/local-evidence-store';
import type { ContainerCourseSettings } from './container-course';
import { CONTAINER_STEP_SPECS_EARLY, type ContainerStepWorkbenchSpec } from './container-step-specs-early';
import { CONTAINER_STEP_SPECS_LATE } from './container-step-specs-late';
import type { FrozenVesselStudentModel } from './student-analysis';

export type StepWorkbenchSpec = ContainerStepWorkbenchSpec;
export type { ContainerStepWorkbenchSpec };

export const CONTAINER_STEP_SPECS: Readonly<Record<number, ContainerStepWorkbenchSpec>> = {
  ...CONTAINER_STEP_SPECS_EARLY,
  ...CONTAINER_STEP_SPECS_LATE,
};

export const CONTAINER_SCHEME_DIFF_FIELDS: Array<{ key: keyof ContainerCourseSettings; label: string }> = [
  { key: 'modelIds', label: '三点工作点模型' },
  { key: 'segmentSpeedsMps', label: '四段航速计划' },
  { key: 'kpMultiplier', label: 'Kp 倍率' },
  { key: 'tiMultiplier', label: 'Ti 倍率' },
  { key: 'antiWindup', label: '积分抗饱和回算' },
  { key: 'bumpless', label: '无扰积分跟踪' },
  { key: 'schedulingEnabled', label: '三点线性增益调度' },
  { key: 'filterTauS', label: '量测滤波' },
  { key: 'losLookaheadM', label: 'LOS 前视距离' },
];

export const containerModelOpKey = (model: FrozenVesselStudentModel): string =>
  `${Number(model.payload.operatingPoint.loadingRatio ?? 0).toFixed(3)}:${Number(model.payload.operatingPoint.speedMps ?? 0).toFixed(2)}`;

export function collectDistinctContainerOpModels(models: FrozenVesselStudentModel[]): FrozenVesselStudentModel[] {
  const byOp = new Map<string, FrozenVesselStudentModel>();
  for (const model of models) byOp.set(containerModelOpKey(model), model);
  return [...byOp.values()].sort((a, b) => {
    const ld = Number(a.payload.operatingPoint.loadingRatio ?? 0) - Number(b.payload.operatingPoint.loadingRatio ?? 0);
    return Math.abs(ld) > 1e-4 ? ld : Number(a.payload.operatingPoint.speedMps ?? 0) - Number(b.payload.operatingPoint.speedMps ?? 0);
  });
}

export function missingContainerModelSteps(models: FrozenVesselStudentModel[]): string[] {
  const has3 = models.some((m) => Math.abs(Number(m.payload.operatingPoint.loadingRatio) - 0.6) < 0.08 && Math.abs(Number(m.payload.operatingPoint.speedMps) - 8) < 1.2);
  const has5 = models.some((m) => Math.abs(Number(m.payload.operatingPoint.loadingRatio) - 0.2) < 0.08)
    && models.some((m) => Math.abs(Number(m.payload.operatingPoint.loadingRatio) - 0.9) < 0.08);
  const has6 = models.some((m) => Math.abs(Number(m.payload.operatingPoint.speedMps) - 6) < 1.2)
    && models.some((m) => Math.abs(Number(m.payload.operatingPoint.speedMps) - 10) < 1.2);
  return [...(!has3 ? ['第 3 步（0.6 装载 8 m/s）'] : []), ...(!has5 ? ['第 5 步（0.2/0.9 装载）'] : []), ...(!has6 ? ['第 6 步（6/10 m/s 航速）'] : [])];
}

export function hasValidContainerModelBank(
  modelIds: unknown,
  models: FrozenVesselStudentModel[],
): modelIds is [string, string, string] {
  if (!Array.isArray(modelIds) || modelIds.length !== 3 || new Set(modelIds).size !== 3) return false;
  const resolved = modelIds.map((id) => models.find((m) => m.id === id));
  return resolved.every(Boolean) && new Set(resolved.map((m) => containerModelOpKey(m!))).size === 3;
}

export function completeContainerBankForPrimary(
  models: FrozenVesselStudentModel[],
  distinct: FrozenVesselStudentModel[],
  primaryId: string,
): [string, string, string] | null {
  const primary = models.find((m) => m.id === primaryId);
  if (!primary) return null;
  const others = distinct.filter((m) => m.id !== primary.id && containerModelOpKey(m) !== containerModelOpKey(primary));
  return others.length >= 2 ? [others[0].id, primary.id, others[others.length - 1].id] : null;
}

export function formatContainerModelTag(model: FrozenVesselStudentModel | undefined): string {
  if (!model) return '未选择';
  return `${model.label} · 装载 ${Number(model.payload.operatingPoint.loadingRatio ?? 0).toFixed(2)} · ${Number(model.payload.operatingPoint.speedMps ?? 0).toFixed(1)} m/s`;
}

export function diffContainerSchemeDimensions(
  baseline: Partial<ContainerCourseSettings> | undefined,
  current: ContainerCourseSettings,
): Array<{ key: keyof ContainerCourseSettings; label: string }> {
  if (!baseline) return [];
  return CONTAINER_SCHEME_DIFF_FIELDS.filter((f) => JSON.stringify(baseline[f.key]) !== JSON.stringify(current[f.key]));
}

export function resolveContainerPriorStepSettings(
  seq: number,
  current: ContainerCourseSettings,
  completedRuns: VesselRunSummary[],
  models: FrozenVesselStudentModel[],
  distinctOpModels: FrozenVesselStudentModel[],
): { settings: ContainerCourseSettings; designModelId: string; sourceRunId?: string } | null {
  if (seq < 7 || seq > 19 || hasValidContainerModelBank(current.modelIds, models)) return null;
  if (seq === 18 || seq === 19) {
    const src = completedRuns.find((r) => (seq === 18 ? r.stepSequence === 17 : r.stepSequence === 17 || r.stepSequence === 18) && r.courseSettings);
    if (src?.courseSettings) {
      const frozen = src.courseSettings as unknown as ContainerCourseSettings;
      return { settings: { ...frozen, validationSeed: current.validationSeed }, designModelId: src.designStudentModelId ?? frozen.modelIds?.[1] ?? '', sourceRunId: src.id };
    }
  }
  const prior = completedRuns
    .filter((r) => r.stepSequence >= 7 && r.stepSequence < seq && hasValidContainerModelBank(r.courseSettings?.modelIds, models))
    .sort((a, b) => (b.stepSequence !== a.stepSequence ? b.stepSequence - a.stepSequence : b.createdAtMs - a.createdAtMs))[0];
  if (prior?.courseSettings) {
    const prev = prior.courseSettings as unknown as ContainerCourseSettings;
    return {
      settings: {
        ...current,
        modelIds: prev.modelIds,
        kpMultiplier: prev.kpMultiplier,
        tiMultiplier: prev.tiMultiplier,
        antiWindup: prev.antiWindup,
        bumpless: seq === 10 ? current.bumpless : prev.bumpless,
        schedulingEnabled: seq <= 8 ? false : seq === 9 ? true : prior.stepSequence >= 9 ? prev.schedulingEnabled : true,
        filterTauS: seq >= 17 ? prev.filterTauS : current.filterTauS,
        losLookaheadM: seq >= 13 && seq <= 15 ? prev.losLookaheadM : current.losLookaheadM,
        segmentSpeedsMps: seq >= 13 && seq <= 17 ? prev.segmentSpeedsMps : current.segmentSpeedsMps,
      },
      designModelId: prior.designStudentModelId ?? prev.modelIds[1],
    };
  }
  if (distinctOpModels.length >= 3) {
    const preferred = distinctOpModels.find((m) => Math.abs(Number(m.payload.operatingPoint.loadingRatio) - 0.6) < 0.08) ?? distinctOpModels[1];
    const bank = completeContainerBankForPrimary(models, distinctOpModels, preferred.id);
    if (bank) return { settings: { ...current, modelIds: bank }, designModelId: bank[1] };
  }
  return null;
}
