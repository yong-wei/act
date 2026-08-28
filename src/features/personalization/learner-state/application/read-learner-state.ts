import {
  listRegisteredPersonalizationGoalIds,
  resolveAdaptiveGoalSliceDefinition,
} from '@/features/personalization/plugins/public-api';
import type { GoalPluginEvidencePort } from '@/features/personalization/plugins/types';
import {
  ADAPTIVE_LEARNER_STATE_ALGORITHM_VERSION,
  asRecord,
  normalizeRequestedGoal,
  portraitConsumerForInput,
  reduceLearnerState,
  uniqueFactsById,
  type AdaptiveLearnerState,
  type AdaptiveLearnerStateGoalId,
  type AdaptiveLearnerStateInput,
} from '../internal';
import type { LearnerStateRuntime } from '../ports';

async function readPluginEvidence(
  plugin: GoalPluginEvidencePort | null,
  userId: string,
): Promise<{
  facts: Array<Record<string, unknown>>;
  arenaSubmissions: Array<Record<string, unknown>>;
  agentToolRuns: Array<Record<string, unknown>>;
}> {
  if (!plugin) {
    return { facts: [], arenaSubmissions: [], agentToolRuns: [] };
  }

  const settled = await Promise.allSettled([
    plugin.readFacts(userId),
    plugin.readArenaSubmissions(userId),
    plugin.readAgentToolRuns(userId),
  ]);

  return {
    facts: settled[0].status === 'fulfilled' ? settled[0].value : [],
    arenaSubmissions: settled[1].status === 'fulfilled' ? settled[1].value : [],
    agentToolRuns: settled[2].status === 'fulfilled' ? settled[2].value : [],
  };
}

export async function readLearnerState(
  runtime: LearnerStateRuntime,
  input: AdaptiveLearnerStateInput,
): Promise<AdaptiveLearnerState> {
  const now = input.now ?? new Date();
  const requestedGoal = normalizeRequestedGoal(input.goal);
  const requestedGoalDefinition = resolveAdaptiveGoalSliceDefinition(requestedGoal);
  const plugin = requestedGoal ? runtime.resolveGoalEvidence(requestedGoal) : null;
  const featureRead = await runtime.learningRecord.readFeatureCache(input.userId, now);
  const featureCache = asRecord(featureRead.cache);

  const [
    latestSnapshot,
    profileSummary,
    personalizationFacts,
    masteryUpdates,
    latestAbility,
    riskFlags,
    paths,
    activeControlCorrectionPaths,
    pluginEvidence,
  ] = await Promise.all([
    runtime.learningRecord.readLatestCompetencySnapshot(input.userId),
    runtime.learningRecord.readProfileSummary(input.userId),
    runtime.learningRecord.readEligibleFacts(input.userId),
    runtime.assessment.listMasteryUpdates(input.userId),
    runtime.assessment.readLatestAbilityEstimate(input.userId),
    runtime.learningRecord.readRiskFlags(input.userId),
    runtime.paths.readRecentPaths(input.userId),
    runtime.paths.readActiveControlCorrectionPaths(input.userId),
    readPluginEvidence(plugin, input.userId),
  ]);

  const masteryFacts = uniqueFactsById([
    ...personalizationFacts,
    ...await runtime.learningRecord.readMasteryLinkedFacts(input.userId, masteryUpdates),
  ]);

  const portraitResolution = await runtime.learningRecord.resolvePortrait({
    userId: input.userId,
    consumer: portraitConsumerForInput(input),
    now,
    legacySnapshot: latestSnapshot,
    featureCache,
  });

  return reduceLearnerState({
    userId: input.userId,
    role: input.role,
    classId: input.classId,
    now,
    clientHints: input.clientHints,
    algorithmVersion: ADAPTIVE_LEARNER_STATE_ALGORITHM_VERSION,
    featureFlagEnabled: runtime.isFeatureFlagEnabled(),
    requestedGoal,
    requestedGoalDefinition,
    supportedGoalIds: listRegisteredPersonalizationGoalIds() as AdaptiveLearnerStateGoalId[],
    goalPluginAvailable: Boolean(plugin),
    featureRead,
    featureCache,
    latestSnapshot,
    profileSummary,
    personalizationFacts,
    masteryFacts,
    masteryUpdates,
    latestAbility,
    riskFlags,
    paths,
    activeControlCorrectionPaths,
    controlCorrectionFacts: pluginEvidence.facts,
    controlCorrectionArenaSubmissions: pluginEvidence.arenaSubmissions,
    controlCorrectionAgentToolRuns: pluginEvidence.agentToolRuns,
    portraitResolution,
  });
}

export async function readPathPlannerLearnerState(
  runtime: LearnerStateRuntime,
  userId: string,
  input: Pick<AdaptiveLearnerStateInput, 'goal' | 'classId' | 'now'> = {},
): Promise<AdaptiveLearnerState> {
  return readLearnerState(runtime, {
    userId,
    role: 'system',
    goal: input.goal,
    classId: input.classId,
    now: input.now,
    portraitConsumer: 'planner',
  });
}
