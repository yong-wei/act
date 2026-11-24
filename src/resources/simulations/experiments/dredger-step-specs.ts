import type { VesselRunSummary } from '@/features/simulations/local-evidence-store';
import { DREDGER_COURSE_STEPS, dredgerDefaultSettings, type DredgerCourseSettings } from './dredger-course';
import {
  DREDGER_STEP_SPECS_EARLY,
  extractDredgerSeriesOverlay,
  type DredgerStepWorkbenchSpec,
} from './dredger-step-specs-early';
import { DREDGER_STEP_SPECS_LATE } from './dredger-step-specs-late';
import type { FrozenVesselStudentModel, VesselModelComparison } from './student-analysis';

export type StepWorkbenchSpec = DredgerStepWorkbenchSpec;
export type { DredgerStepWorkbenchSpec };
export { extractDredgerSeriesOverlay };

export const DREDGER_STEP_SPECS: Readonly<Record<number, DredgerStepWorkbenchSpec>> = {
  ...DREDGER_STEP_SPECS_EARLY,
  ...DREDGER_STEP_SPECS_LATE,
};

export const DREDGER_INTEGRAL_POLICY_LABELS: Record<DredgerCourseSettings['integralPolicy'], string> = {
  track: '跟踪实际输出',
  freeze: '冻结积分',
  reset: '直接重置',
};

export const DREDGER_STRATEGY_DIFF_FIELDS: ReadonlyArray<{ key: keyof DredgerCourseSettings; label: string }> = [
  { key: 'targetDepthM', label: '刀位包络目标深度' },
  { key: 'cutterRpm', label: '绞刀参考转速' },
  { key: 'referenceMps', label: '横移速度参考' },
  { key: 'halfAngleDeg', label: '横移半幅' },
  { key: 'kpMultiplier', label: '比例增益倍率' },
  { key: 'tiMultiplier', label: '积分时间倍率' },
  { key: 'reversalRampS', label: '换向斜坡' },
  { key: 'entrySpeedMps', label: '允许进入切削船速' },
  { key: 'entryHoldS', label: '进入条件保持时间' },
  { key: 'safetyFraction', label: '提前中止阈值系数' },
  { key: 'integralPolicy', label: '模式切换积分策略' },
  { key: 'depthFilterTauS', label: '深度量测滤波时间常数' },
  { key: 'swayFilterTauS', label: '横移量测滤波时间常数' },
];

export function isDredgerCompleteRun(run: VesselRunSummary): boolean {
  const required = DREDGER_COURSE_STEPS[run.stepSequence - 1]?.runDurationS ?? Number.POSITIVE_INFINITY;
  return run.stoppedAtMs !== null && run.stopReason !== 'failure' && run.lastTimeS + 1e-7 >= required;
}

export function formatDredgerModelTag(model: FrozenVesselStudentModel | undefined): string {
  if (!model) return '未选择';
  const soil = model.payload.operatingPoint.dredgerSoil === 'clay' ? '黏土层' : '砂层';
  const mode = model.payload.operatingPoint.dredgerMode === 'cut_swing' ? '横移切削' : '钢桩保持';
  const order = model.payload.structure.kind === 'nomoto2' ? '二阶' : '一阶';
  return `${model.label} · ${soil} · ${mode} · ${order}`;
}

export function normalizeDredgerSettings(
  raw: Partial<DredgerCourseSettings> | Record<string, unknown> | undefined,
  seq: number,
): DredgerCourseSettings {
  return { ...dredgerDefaultSettings(seq), ...(raw as Partial<DredgerCourseSettings> | undefined) };
}

export function diffDredgerStrategyFields(
  baselineRaw: Partial<DredgerCourseSettings> | Record<string, unknown> | undefined,
  current: DredgerCourseSettings,
): Array<{ key: keyof DredgerCourseSettings; label: string }> {
  if (!baselineRaw) return [];
  const baseline = normalizeDredgerSettings(baselineRaw, 15);
  return DREDGER_STRATEGY_DIFF_FIELDS.filter(({ key }) => baseline[key] !== current[key]);
}

export function dredgerSchemeMatchesRun(
  run: VesselRunSummary,
  settings: DredgerCourseSettings,
  designModelId: string,
): boolean {
  if (!run.courseSettings || (run.designStudentModelId ?? '') !== designModelId) return false;
  const src = normalizeDredgerSettings(run.courseSettings, run.stepSequence);
  return DREDGER_STRATEGY_DIFF_FIELDS.every(({ key }) => src[key] === settings[key]);
}

export function doesDredgerForecastMatch(
  forecast: VesselModelComparison | undefined,
  designModelId: string,
  settings: DredgerCourseSettings,
): boolean {
  const d = forecast?.controllerInput?.dredger;
  if (!forecast || !d || forecast.modelId !== designModelId) return false;
  return (
    d.commands.depthReferenceM === settings.targetDepthM &&
    d.commands.cutterRpm === settings.cutterRpm &&
    d.referenceMps === settings.referenceMps &&
    d.halfAngleDeg === settings.halfAngleDeg &&
    d.kpMultiplier === settings.kpMultiplier &&
    d.tiMultiplier === settings.tiMultiplier &&
    d.reversalRampS === settings.reversalRampS &&
    d.entrySpeedMps === settings.entrySpeedMps &&
    d.entryHoldS === settings.entryHoldS &&
    d.safetyFraction === settings.safetyFraction &&
    d.integralPolicy === settings.integralPolicy &&
    d.depthFilterTauS === settings.depthFilterTauS &&
    d.swayFilterTauS === settings.swayFilterTauS
  );
}

export function resolveDredgerPriorStepSettings(
  seq: number,
  current: DredgerCourseSettings,
  currentModelId: string,
  allRuns: VesselRunSummary[],
  models: FrozenVesselStudentModel[],
): { settings: DredgerCourseSettings; designModelId: string; sourceRunId?: string } | null {
  if (seq < 9 || seq > 19 || models.length === 0) return null;
  if (allRuns.some((run) => run.stepSequence === seq)) return null;
  const completeRuns = allRuns.filter(isDredgerCompleteRun).sort((a, b) => b.createdAtMs - a.createdAtMs);
  const validModelId = (id: string | undefined) => (id && models.some((m) => m.id === id) ? id : '');
  const latestModelId = models.at(-1)?.id ?? '';
  const sandModelId = [...models].reverse().find((m) => m.payload.operatingPoint.dredgerSoil === 'sand')?.id ?? latestModelId;

  if (seq === 19) {
    const src = completeRuns.find((r) => [17, 18].includes(r.stepSequence) && r.courseSettings && validModelId(r.designStudentModelId));
    if (!src) return null;
    const frozen = normalizeDredgerSettings(src.courseSettings, seq);
    return {
      settings: { ...frozen, validationSeed: current.validationSeed },
      designModelId: validModelId(src.designStudentModelId) || latestModelId,
      sourceRunId: src.id,
    };
  }

  if (seq === 18) {
    const src = completeRuns.find((r) => r.stepSequence === 17 && r.courseSettings && validModelId(r.designStudentModelId));
    if (src) {
      const frozen = normalizeDredgerSettings(src.courseSettings, seq);
      return {
        settings: { ...frozen, wavesEnabled: current.wavesEnabled, validationSeed: current.validationSeed },
        designModelId: validModelId(src.designStudentModelId) || latestModelId,
        sourceRunId: src.id,
      };
    }
  }

  if (seq === 15) {
    const src = completeRuns.find((r) => r.stepSequence >= 9 && r.stepSequence <= 14 && r.courseSettings && validModelId(r.designStudentModelId));
    if (src) {
      const frozen = normalizeDredgerSettings(src.courseSettings, seq);
      return {
        settings: { ...frozen, wavesEnabled: current.wavesEnabled, validationSeed: current.validationSeed },
        designModelId: validModelId(src.designStudentModelId) || latestModelId,
        sourceRunId: src.id,
      };
    }
  }

  const prior = completeRuns.find((r) => r.stepSequence >= 9 && r.stepSequence < seq && r.courseSettings);
  const resolvedModelId = seq === 11
    ? (validModelId(currentModelId) || sandModelId)
    : (validModelId(currentModelId) || validModelId(prior?.designStudentModelId) || latestModelId);

  if (!prior?.courseSettings) {
    return resolvedModelId && resolvedModelId !== currentModelId
      ? { settings: current, designModelId: resolvedModelId }
      : null;
  }

  const prev = normalizeDredgerSettings(prior.courseSettings, seq);
  const nextSettings: DredgerCourseSettings = {
    ...current,
    targetDepthM: seq === 12 ? 20.3 : prev.targetDepthM,
    cutterRpm: prev.cutterRpm,
    referenceMps: prev.referenceMps,
    halfAngleDeg: prev.halfAngleDeg,
    kpMultiplier: prev.kpMultiplier,
    tiMultiplier: prev.tiMultiplier,
    reversalRampS: seq === 13 ? 15 : prev.reversalRampS,
    entrySpeedMps: prev.entrySpeedMps,
    entryHoldS: seq === 17 ? 10 : prev.entryHoldS,
    safetyFraction: prev.safetyFraction,
    integralPolicy: seq === 14 ? 'track' : prev.integralPolicy,
    depthFilterTauS: prev.depthFilterTauS,
    swayFilterTauS: prev.swayFilterTauS,
    wavesEnabled: seq === 16 ? false : current.wavesEnabled,
  };
  return {
    settings: nextSettings,
    designModelId: resolvedModelId,
    sourceRunId: prior.id,
  };
}
