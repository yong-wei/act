import { resolvePrimaryPortraitV2 } from '@/lib/data-governance/portrait-v2-consumer';
import {
  CONTROL_CORRECTION_ARENA_TASK_ID_VALUES,
  CONTROL_CORRECTION_COURSE_ID_VALUES,
  CONTROL_CORRECTION_GOAL_ID,
  attachPersistedArenaWritebacks,
  isAdaptiveLearnerStateServiceEnabled,
  readAdaptiveMasteryLearningFacts,
  readControlCorrectionLearningFacts,
  readEligibleLearnerStateFacts,
  readFeatureCache,
  resolveFencedAdaptivePortrait,
  type AdaptiveLearnerStateDb,
  type PortraitResolution,
} from '../internal';
import type {
  AssessmentReadPort,
  ControlCorrectionGoalPluginPort,
  LearnerStateRuntime,
  LearningRecordReadPort,
  PathReadPort,
} from '../ports';

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

function createControlCorrectionPlugin(db: AdaptiveLearnerStateDb): ControlCorrectionGoalPluginPort {
  return {
    readFacts: (userId) => readControlCorrectionLearningFacts(db, userId),
    readArenaSubmissions: async (userId) => {
      const submissions = await db.arenaSubmission?.findMany?.({
        where: {
          userId,
          valid: true,
          taskId: { in: [...CONTROL_CORRECTION_ARENA_TASK_ID_VALUES] },
        },
        include: {
          controllerArtifact: true,
          evaluationRun: true,
        },
        orderBy: { submittedAt: 'desc' },
        take: 200,
      }) ?? [];
      return attachPersistedArenaWritebacks(db, submissions);
    },
    readAgentToolRuns: async (userId) => db.agentToolRun?.findMany?.({
      where: {
        targetUserId: userId,
        courseId: { in: [...CONTROL_CORRECTION_COURSE_ID_VALUES] },
        status: { in: ['completed', 'succeeded', 'success'] },
      },
      orderBy: [{ completedAt: 'desc' }, { id: 'desc' }],
      take: 100,
    }) ?? [],
  };
}

export function createDbLearnerStateRuntime(
  db: AdaptiveLearnerStateDb,
  overrides: {
    assessment?: AssessmentReadPort;
    controlCorrectionPlugin?: ControlCorrectionGoalPluginPort | null;
    isFeatureFlagEnabled?: () => boolean;
  } = {},
): LearnerStateRuntime {
  return {
    learningRecord: createLearningRecordPort(db),
    assessment: overrides.assessment ?? createAssessmentPort(db),
    paths: createPathPort(db),
    controlCorrectionPlugin: overrides.controlCorrectionPlugin === undefined
      ? createControlCorrectionPlugin(db)
      : overrides.controlCorrectionPlugin,
    isFeatureFlagEnabled: overrides.isFeatureFlagEnabled
      ?? (() => isAdaptiveLearnerStateServiceEnabled()),
  };
}
