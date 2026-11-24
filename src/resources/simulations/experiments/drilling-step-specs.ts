import { DRILLING_STEP_SPECS_EARLY, type DrillingStepSpec } from './drilling-step-specs-early';
import { DRILLING_STEP_SPECS_LATE } from './drilling-step-specs-late';

export type StepWorkbenchSpec = DrillingStepSpec;

export const DRILLING_STEP_SPECS: Record<number, StepWorkbenchSpec> = {
  ...DRILLING_STEP_SPECS_EARLY,
  ...DRILLING_STEP_SPECS_LATE,
};

export function getDrillingStepSpec(sequence: number): StepWorkbenchSpec | undefined {
  return DRILLING_STEP_SPECS[sequence];
}
