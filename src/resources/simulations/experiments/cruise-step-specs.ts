import type { StepInterpretationSpec, StepObservationSpec, StepPredictionSpec, StepSketchSpec } from '../simulations/vessel-experiment';
import { CRUISE_STEP_SPECS_EARLY } from './cruise-step-specs-early';
import { CRUISE_STEP_SPECS_LATE } from './cruise-step-specs-late';

export interface StepWorkbenchSpec {
  seq: number;
  goal: string;
  actionSteps: string[];
  watch: string;
  conditionText: string;
  suggestion: string;
  predictionSpec?: StepPredictionSpec;
  observationSpec?: StepObservationSpec;
  interpretationSpec?: StepInterpretationSpec;
  sketchSpec?: StepSketchSpec;
  reportFieldGuides?: Record<string, string>;
}

export const CRUISE_STEP_SPECS_LIST: readonly StepWorkbenchSpec[] = [
  ...CRUISE_STEP_SPECS_EARLY,
  ...CRUISE_STEP_SPECS_LATE,
];

export const CRUISE_STEP_SPECS: Readonly<Record<number, StepWorkbenchSpec>> = Object.fromEntries(
  CRUISE_STEP_SPECS_LIST.map((spec) => [spec.seq, spec]),
);
