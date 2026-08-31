import type {
  AdaptiveGoalSliceDefinition,
  AdaptiveGoalSliceDimensionDefinition,
  ControlCorrectionTargetLevel,
} from '@/features/personalization/learner-state/internal';
import { CONTROL_CORRECTION_CAPABILITY_TARGETS } from './capability-targets';
import {
  CONTROL_CORRECTION_GOAL_DIMENSIONS,
  CONTROL_CORRECTION_GOAL_ID,
  CONTROL_CORRECTION_GOAL_SLICE_FIELD_CONTRACT,
  CONTROL_CORRECTION_GOAL_SLICE_PAYLOAD_VERSION,
  CONTROL_CORRECTION_PRIVACY,
  CONTROL_CORRECTION_PRIVACY_CLASSES,
  CONTROL_CORRECTION_TARGET_LEVELS,
  PATH_CONTEXT_FIELD_CONTRACT,
} from './slice-constants';

const CONTROL_CORRECTION_TARGET_LEVEL_MAPPING: Record<ControlCorrectionTargetLevel, string> = {
  foundation: 'recognizes canonical control-correction concepts with guided evidence',
  developing: 'applies corrective reasoning with partial multi-source evidence',
  proficient: 'selects and validates corrective methods across governed evidence',
  advanced: 'transfers corrective strategies across constrained tasks with robust validation',
};

const CONTROL_CORRECTION_DIMENSION_DEFINITIONS: AdaptiveGoalSliceDimensionDefinition[] =
  CONTROL_CORRECTION_GOAL_DIMENSIONS.map((id) => ({
    id,
    valueRange: '0-100',
    targetLevelMapping: CONTROL_CORRECTION_TARGET_LEVEL_MAPPING,
    sourceFamilies: [...CONTROL_CORRECTION_GOAL_SLICE_FIELD_CONTRACT.sourceFamilies],
    evidenceThreshold: 'dimension declares sufficient, partial, stale, or missing governed evidence',
    freshnessPolicy: 'current within governed learner-state evidence window, stale when sources age out, missing when no declared source is present',
    confidencePolicy: CONTROL_CORRECTION_GOAL_SLICE_FIELD_CONTRACT.confidencePolicy,
    privacy: CONTROL_CORRECTION_PRIVACY,
    fallbackReason: CONTROL_CORRECTION_GOAL_SLICE_FIELD_CONTRACT.fallbackReason,
  }));

export const controlCorrectionGoalSliceDefinition: AdaptiveGoalSliceDefinition = {
  goalId: CONTROL_CORRECTION_GOAL_ID,
  displayLabel: 'Control Correction',
  shortLabel: 'Control Correction',
  payloadVersion: CONTROL_CORRECTION_GOAL_SLICE_PAYLOAD_VERSION,
  dimensions: CONTROL_CORRECTION_DIMENSION_DEFINITIONS,
  targetLevels: [...CONTROL_CORRECTION_TARGET_LEVELS],
  capabilityTargets: CONTROL_CORRECTION_CAPABILITY_TARGETS,
  evidenceSourceFamilies: [...CONTROL_CORRECTION_GOAL_SLICE_FIELD_CONTRACT.sourceFamilies],
  privacyClasses: CONTROL_CORRECTION_PRIVACY_CLASSES,
  confidencePolicy: CONTROL_CORRECTION_GOAL_SLICE_FIELD_CONTRACT.confidencePolicy,
  fieldFamilies: {
    pathContext: {
      ...PATH_CONTEXT_FIELD_CONTRACT,
      sourceFamilies: [...PATH_CONTEXT_FIELD_CONTRACT.sourceFamilies],
      valueRange: 'active path id/status/current node, terminal validation state, recent path references, no-active-path marker',
    },
    report: {
      ...CONTROL_CORRECTION_GOAL_SLICE_FIELD_CONTRACT,
      sourceFamilies: [...CONTROL_CORRECTION_GOAL_SLICE_FIELD_CONTRACT.sourceFamilies],
      valueRange: 'declared report-ready control-correction dimensions and metadata',
    },
    konling: {
      ...CONTROL_CORRECTION_GOAL_SLICE_FIELD_CONTRACT,
      sourceFamilies: [...CONTROL_CORRECTION_GOAL_SLICE_FIELD_CONTRACT.sourceFamilies],
      valueRange: 'declared Konling-readable control-correction dimensions and metadata',
    },
    grading: {
      ...CONTROL_CORRECTION_GOAL_SLICE_FIELD_CONTRACT,
      sourceFamilies: [...CONTROL_CORRECTION_GOAL_SLICE_FIELD_CONTRACT.sourceFamilies],
      valueRange: 'not declared for grading decisions',
      fallbackReason: 'grading-eligibility-not-declared',
    },
  },
  eligibility: {
    path: 'declared',
    report: 'declared',
    konling: 'declared',
    grading: 'not-declared',
  },
  validationFixtures: [
    'registered-control-correction-parity',
    'unknown-goal-unsupported',
    'undeclared-dimension-fail-closed',
    'path-context-preservation',
  ],
};
