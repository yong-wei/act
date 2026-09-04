import { bindControlCorrectionEvidencePortFactory } from '@/features/personalization/plugins/control-correction/plugin';
import { createControlCorrectionEvidencePort } from '@/features/personalization/plugins/control-correction/db-evidence';
import { personalizationPluginRegistry } from '@/features/personalization/plugins/public-api';
import type { GoalPluginEvidencePort } from '@/features/personalization/plugins/types';
import { resolvePrimaryPortraitV2 } from '@/lib/data-governance/portrait-v2-consumer';
import {
  CONTROL_CORRECTION_GOAL_ID,
  isAdaptiveLearnerStateServiceEnabled,
  type AdaptiveLearnerStateDb,
  type PortraitResolution,
} from '../internal';
import {
  readAdaptiveMasteryLearningFacts,
  readEligibleLearnerStateFacts,
  readFeatureCache,
  resolveFencedAdaptivePortrait,
} from '../effectful-reads';
import type {
  AssessmentReadPort,
  LearnerStateRuntime,
  LearningRecordReadPort,
  PathReadPort,
} from '../ports';

bindControlCorrectionEvidencePortFactory(createControlCorrectionEvidencePort);

const PATH_SELECT = {
  id: true,
  goalId: true,
  pathStatus: true,
  currentNodeId: true,
  terminalValidation: true,
  lastExecutionMetadata: true,
  isBookmarked: true,
} as const;

function createLearningRecordPort(db: AdaptiveLearnerStateDb): LearningRecordReadPort {
  return {
    readFeatureCache: (userId, now) => readFeatureCache(db, userId, now),
    readLatestCompetencySnapshot: async (userId) => db.studentCompetencySnapshot?.findFirst?.({
      where: { userId },
      orderBy: [{ snapshotAt: 'desc' }, { id: 'desc' }],
    }) ?? null,
    readProfileSummary: async (userId) => db.studentProfileSummary?.findUnique?.({
      where: { userId },
    }) ?? null,
    readEligibleFacts: (userId) => readEligibleLearnerStateFacts(db, userId),
    readMasteryLinkedFacts: (userId, masteryUpdates) =>
      readAdaptiveMasteryLearningFacts(db, userId, masteryUpdates),
    readRiskFlags: async (userId) => db.studentRiskFlag?.findMany?.({
      where: { userId, isResolved: false },
      orderBy: { triggeredAt: 'desc' },
      take: 20,
    }) ?? [],
    resolvePortrait: async (input) => {
      const supportsFencedCumulativePortrait = Boolean(
        db.cumulativePortraitCutoverFence?.findUnique &&
        db.cumulativePortraitMigrationRun?.findUnique &&
        db.learnerPortraitCurrentState?.findUnique,
      );
      const resolvedPortrait = supportsFencedCumulativePortrait
        ? await resolveFencedAdaptivePortrait(db, {
            userId: input.userId,
            consumer: input.consumer,
            now: input.now,
            legacySnapshot: input.legacySnapshot,
          })
        : await resolvePrimaryPortraitV2(
            db,
            input.userId,
            input.consumer,
            { now: input.now, legacySnapshot: input.legacySnapshot, featureCache: input.featureCache },
          );
      return (supportsFencedCumulativePortrait
        ? resolvedPortrait
        : {
            ...resolvedPortrait,
            primaryPortrait: null,
            primaryPortraitState: 'UNAVAILABLE' as const,
            primaryPortraitAvailability: 'cumulative-portrait-fence-unavailable',
          }) as PortraitResolution;
    },
  };
}

function createAssessmentPort(db: AdaptiveLearnerStateDb): AssessmentReadPort {
  // Test/injected duck-db only. Production Prisma runtime overrides this with Assessment public API.
  return {
    listMasteryUpdates: async (userId) => db.adaptiveMasteryUpdate?.findMany?.({
      where: { userId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 200,
    }) ?? [],
    readLatestAbilityEstimate: async (userId) => db.adaptiveAssessmentAbilityEstimate?.findFirst?.({
      where: { userId },
      orderBy: [{ estimatedAt: 'desc' }, { id: 'desc' }],
    }) ?? null,
  };
}

function createPathPort(db: AdaptiveLearnerStateDb): PathReadPort {
  return {
    readRecentPaths: async (userId) => db.learningPath?.findMany?.({
      where: { userId },
      select: PATH_SELECT,
      orderBy: { updatedAt: 'desc' },
      take: 10,
    }) ?? [],
    readActiveControlCorrectionPaths: async (userId) => db.learningPath?.findMany?.({
      where: {
        userId,
        goalId: CONTROL_CORRECTION_GOAL_ID,
        pathStatus: { in: ['active', 'fallback'] },
      },
      select: PATH_SELECT,
      orderBy: { updatedAt: 'desc' },
      take: 1,
    }) ?? [],
  };
}

export function createDbLearnerStateRuntime(
  db: AdaptiveLearnerStateDb,
  overrides: {
    assessment?: AssessmentReadPort;
    resolveGoalEvidence?: (goalId: string) => GoalPluginEvidencePort | null;
    controlCorrectionPlugin?: GoalPluginEvidencePort | null;
    isFeatureFlagEnabled?: () => boolean;
  } = {},
): LearnerStateRuntime {
  const resolveGoalEvidence = overrides.resolveGoalEvidence
    ?? ((goalId: string) => {
      if (overrides.controlCorrectionPlugin !== undefined) {
        return goalId === CONTROL_CORRECTION_GOAL_ID ? overrides.controlCorrectionPlugin : null;
      }
      return personalizationPluginRegistry.createEvidencePort(goalId, db);
    });

  return {
    learningRecord: createLearningRecordPort(db),
    assessment: overrides.assessment ?? createAssessmentPort(db),
    paths: createPathPort(db),
    resolveGoalEvidence,
    isFeatureFlagEnabled: overrides.isFeatureFlagEnabled
      ?? (() => isAdaptiveLearnerStateServiceEnabled()),
  };
}
