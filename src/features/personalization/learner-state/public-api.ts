import { createDbLearnerStateRuntime } from './adapters/db-runtime';
import { createPrismaLearnerStateRuntime } from './adapters/prisma-runtime';
import {
  readLearnerState as readLearnerStateUseCase,
  readPathPlannerLearnerState as readPathPlannerLearnerStateUseCase,
} from './application/read-learner-state';
import {
  ADAPTIVE_GOAL_SLICE_REGISTRY,
  ADAPTIVE_LEARNER_STATE_ALGORITHM_VERSION,
  ADAPTIVE_LEARNER_STATE_FEATURE_FLAG,
  ADAPTIVE_LEARNER_STATE_FIELD_CONTRACTS,
  ADAPTIVE_LEARNER_STATE_PAYLOAD_VERSION,
  CONTROL_CORRECTION_COURSE_ID_VALUES,
  CONTROL_CORRECTION_GOAL_DIMENSIONS,
  CONTROL_CORRECTION_GOAL_ID,
  CONTROL_CORRECTION_GOAL_SLICE_PAYLOAD_VERSION,
  CONTROL_CORRECTION_TARGET_LEVELS,
  isAdaptiveLearnerStateServiceEnabled,
  projectLearnerStateFactIdentities,
  projectLearnerStateFactIdentity,
  resolveAdaptiveGoalSliceDefinition,
  validateControlCorrectionGoalSliceContract,
  type AdaptiveGoalSliceDefinition,
  type AdaptiveLearnerState,
  type AdaptiveLearnerStateDb,
  type AdaptiveLearnerStateFieldContract,
  type AdaptiveLearnerStateFieldFamily,
  type AdaptiveLearnerStateGoalId,
  type AdaptiveLearnerStateInput,
  type AdaptiveLearnerStatePrimaryPortraitState,
  type AdaptiveLearnerStatePrivacyScope,
  type AdaptiveLearnerStateRole,
  type AdaptiveLearnerSecondaryDimension,
  type ControlCorrectionCapabilityTargetEvidence,
  type ControlCorrectionDimensionId,
  type ControlCorrectionGoalSlice,
  type ControlCorrectionGoalSliceDimension,
  type ControlCorrectionGoalSlicePathContext,
  type ControlCorrectionTargetLevel,
  type MasteryEvidenceReference,
  type MasteryEvidenceSourceType,
  type MasteryTraceabilityEntry,
  type UnsupportedAdaptiveGoalSlice,
} from './internal';

export {
  ADAPTIVE_GOAL_SLICE_REGISTRY,
  ADAPTIVE_LEARNER_STATE_ALGORITHM_VERSION,
  ADAPTIVE_LEARNER_STATE_FEATURE_FLAG,
  ADAPTIVE_LEARNER_STATE_FIELD_CONTRACTS,
  ADAPTIVE_LEARNER_STATE_PAYLOAD_VERSION,
  CONTROL_CORRECTION_COURSE_ID_VALUES,
  CONTROL_CORRECTION_GOAL_DIMENSIONS,
  CONTROL_CORRECTION_GOAL_ID,
  CONTROL_CORRECTION_GOAL_SLICE_PAYLOAD_VERSION,
  CONTROL_CORRECTION_TARGET_LEVELS,
  isAdaptiveLearnerStateServiceEnabled,
  projectLearnerStateFactIdentities,
  projectLearnerStateFactIdentity,
  resolveAdaptiveGoalSliceDefinition,
  validateControlCorrectionGoalSliceContract,
};

export type {
  AdaptiveGoalSliceDefinition,
  AdaptiveLearnerState,
  AdaptiveLearnerStateDb,
  AdaptiveLearnerStateFieldContract,
  AdaptiveLearnerStateFieldFamily,
  AdaptiveLearnerStateGoalId,
  AdaptiveLearnerStateInput,
  AdaptiveLearnerStatePrimaryPortraitState,
  AdaptiveLearnerStatePrivacyScope,
  AdaptiveLearnerStateRole,
  AdaptiveLearnerSecondaryDimension,
  ControlCorrectionCapabilityTargetEvidence,
  ControlCorrectionDimensionId,
  ControlCorrectionGoalSlice,
  ControlCorrectionGoalSliceDimension,
  ControlCorrectionGoalSlicePathContext,
  ControlCorrectionTargetLevel,
  MasteryEvidenceReference,
  MasteryEvidenceSourceType,
  MasteryTraceabilityEntry,
  UnsupportedAdaptiveGoalSlice,
};

export { reduceLearnerState, type LearnerStateReducerInput } from './reducer';
export { createDbLearnerStateRuntime } from './adapters/db-runtime';
export { createPrismaLearnerStateRuntime } from './adapters/prisma-runtime';

export async function readLearnerState(
  input: AdaptiveLearnerStateInput,
): Promise<AdaptiveLearnerState> {
  return readLearnerStateUseCase(createPrismaLearnerStateRuntime(), input);
}

export async function readAdaptiveLearnerState(
  db: AdaptiveLearnerStateDb,
  input: AdaptiveLearnerStateInput,
): Promise<AdaptiveLearnerState> {
  return readLearnerStateUseCase(createDbLearnerStateRuntime(db), input);
}

export async function readPathPlannerLearnerState(
  db: AdaptiveLearnerStateDb,
  userId: string,
  input: Pick<AdaptiveLearnerStateInput, 'goal' | 'classId' | 'now'> = {},
): Promise<AdaptiveLearnerState> {
  return readPathPlannerLearnerStateUseCase(createDbLearnerStateRuntime(db), userId, input);
}

export async function readPathPlannerLearnerStateForSubject(
  userId: string,
  input: Pick<AdaptiveLearnerStateInput, 'goal' | 'classId' | 'now'> = {},
): Promise<AdaptiveLearnerState> {
  return readPathPlannerLearnerStateUseCase(createPrismaLearnerStateRuntime(), userId, input);
}
