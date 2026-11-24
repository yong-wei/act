import {
  ICEBREAKER_STEP_SPECS_EARLY,
  extractFilterTauS,
  extractGainSummary,
  extractIceStrengthMpa,
  extractIceThicknessM,
  extractIcebreakerHeadingActualSeries,
  extractIcebreakerIceForceActualSeries,
  extractIcebreakerYawRateActualSeries,
  extractRunEndTimeS,
  extractWaterSpeedMps,
  type IcebreakerStepWorkbenchSpec,
} from './icebreaker-step-specs-early';
import {
  ICEBREAKER_STEP_SPECS_LATE,
  extractPodJamStatus,
  extractRampS,
  extractRunStopSummary,
  extractScheduleMode,
  extractStrategySummary,
  extractUnseenIceSummary,
} from './icebreaker-step-specs-late';

export type StepWorkbenchSpec = IcebreakerStepWorkbenchSpec;
export type { IcebreakerStepWorkbenchSpec };

export const ICEBREAKER_STEP_SPECS: Readonly<Record<number, IcebreakerStepWorkbenchSpec>> = {
  ...ICEBREAKER_STEP_SPECS_EARLY,
  ...ICEBREAKER_STEP_SPECS_LATE,
};

export const ICEBREAKER_STEP_SPECS_LIST: readonly (IcebreakerStepWorkbenchSpec & { seq: number })[] = Array.from(
  { length: 20 },
  (_, index) => ({
    seq: index + 1,
    ...ICEBREAKER_STEP_SPECS[index + 1],
  }),
);

export {
  extractFilterTauS,
  extractGainSummary,
  extractIceStrengthMpa,
  extractIceThicknessM,
  extractIcebreakerHeadingActualSeries,
  extractIcebreakerIceForceActualSeries,
  extractIcebreakerYawRateActualSeries,
  extractPodJamStatus,
  extractRampS,
  extractRunEndTimeS,
  extractRunStopSummary,
  extractScheduleMode,
  extractStrategySummary,
  extractUnseenIceSummary,
  extractWaterSpeedMps,
};
