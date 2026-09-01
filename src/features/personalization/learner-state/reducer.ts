import {
  COMPETENCY_DIMENSIONS, // PORTRAIT_V2_LEGACY_COMPATIBILITY_ADAPTER: non-authoritative compatibility catalog.
  createEmptyCompetencyVector,
} from '@/lib/data-governance/competency-model';
import {
  ADAPTIVE_LEARNER_STATE_FEATURE_FLAG,
  ADAPTIVE_LEARNER_STATE_FIELD_CONTRACTS,
  ADAPTIVE_LEARNER_STATE_PAYLOAD_VERSION,
  asRecord,
  buildAbilityEstimate,
  buildAdaptiveGoalSlices,
  buildEvidenceSummary,
  buildKnowledgeMastery,
  buildMasteryTraceability,
  buildMediaAbsorption,
  buildMissingEvidence,
  buildPathContext,
  buildResourcePreference,
  buildRiskState,
  buildSecondaryDimensions,
  deriveLearnerStateCompatibilityVector,
  filterMasteryTraceabilityForRole,
  filterPathExecutionForRole,
  isControlCorrectionPathRound,
  privacyScopesForRole,
  type AdaptiveLearnerState,
  type LearnerStateReducerInput,
} from './internal';

export type { LearnerStateReducerInput };

export function reduceLearnerState(input: LearnerStateReducerInput): AdaptiveLearnerState {
  const {
    now,
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
    controlCorrectionFacts,
    controlCorrectionArenaSubmissions,
    controlCorrectionAgentToolRuns,
    portraitResolution,
  } = input;
  const featureSimulationArena = asRecord(asRecord(featureCache.features).simulationArena);
  const featurePathExecution = asRecord(asRecord(featureCache.features).pathExecution);
  const {
    vector: legacyCompatibilityVector,
    source: compatibilitySource,
  } = portraitResolution.legacyCompatibility;
  const portraitCompatibility = deriveLearnerStateCompatibilityVector(
    portraitResolution.primaryPortrait,
    now,
    legacyCompatibilityVector,
  );
  const portraitCompatibilityVector = portraitCompatibility?.vector ?? null;
  const vector = portraitCompatibilityVector ?? legacyCompatibilityVector;
  const portraitDrivenVector = portraitResolution.primaryPortraitState === 'SNAPSHOT'
    ? (portraitCompatibilityVector ?? createEmptyCompetencyVector())
    : createEmptyCompetencyVector();
  // PORTRAIT_V2_LEGACY_COMPATIBILITY_ADAPTER: expose legacy provenance only for compatibility consumers.
  // PORTRAIT_V2_LEGACY_COMPATIBILITY_ADAPTER: map the compatibility source to the legacy output label.
  const source: AdaptiveLearnerState['primaryCompetencies']['source'] =
    // PORTRAIT_V2_LEGACY_COMPATIBILITY_ADAPTER: retain the legacy source label only for compatibility output.
    portraitCompatibility?.derivedDimensionCount === COMPETENCY_DIMENSIONS.length
      ? 'portrait-v2-derived'
      : portraitCompatibility && portraitCompatibility.derivedDimensionCount > 0
        ? 'portrait-v2-mixed'
      // PORTRAIT_V2_LEGACY_COMPATIBILITY_ADAPTER: expose legacy source names only when their fallback supplied the result.
      : compatibilitySource === 'StudentCompetencySnapshot'
      ? 'latest-snapshot'
      : compatibilitySource === 'StudentEvidenceFeatureCache'
        ? 'feature-cache'
        : 'fallback-empty';
  const primaryPortrait = portraitResolution.primaryPortrait;
  const knowledgeMastery = buildKnowledgeMastery(masteryUpdates, masteryFacts, now);
  const evidence = buildEvidenceSummary(featureRead, featureCache);
  const masteryTraceability = filterMasteryTraceabilityForRole(buildMasteryTraceability({
    knowledgeMastery,
    vector: portraitDrivenVector,
    facts: controlCorrectionFacts,
    arenaSubmissions: controlCorrectionArenaSubmissions,
    agentToolRuns: controlCorrectionAgentToolRuns,
    featureRead,
    evidence,
    now,
  }), input.role, now);
  const secondaryDimensions = buildSecondaryDimensions(portraitDrivenVector);
  const prerequisiteFeatureGroups = {
    simulationArena: Object.keys(featureSimulationArena).length > 0
      ? asRecord(featureSimulationArena.allTime)
      : null,
    pathExecution: Object.keys(featurePathExecution).length > 0
      ? filterPathExecutionForRole(asRecord(featurePathExecution.allTime), input.role)
      : null,
  };
  const missingEvidence = buildMissingEvidence({
    latestSnapshot,
    profileSummary,
    featureRead,
    masteryUpdates,
    // PORTRAIT_V2_LEGACY_COMPATIBILITY_ADAPTER: suppress legacy-source gaps only for a complete v2 projection.
    hasPortraitCompatibility: portraitCompatibility?.derivedDimensionCount === COMPETENCY_DIMENSIONS.length,
  });
  const goalSlices = buildAdaptiveGoalSlices({
    requestedGoal: input.requestedGoal,
    requestedGoalDefinition: input.requestedGoalDefinition,
    supportedGoalIds: input.supportedGoalIds ?? [],
    goalPluginAvailable: input.goalPluginAvailable,
    now,
    vector: portraitDrivenVector,
    primaryPortrait,
    usePrimaryPortrait: portraitResolution.primaryPortraitState === 'SNAPSHOT',
    evidence,
    knowledgeMastery,
    masteryTraceability,
    facts: controlCorrectionFacts,
    arenaSubmissions: controlCorrectionArenaSubmissions,
    prerequisiteFeatureGroups,
    paths,
    activeControlCorrectionPath: activeControlCorrectionPaths.find(isControlCorrectionPathRound) ?? null,
  });

  return {
    userId: input.userId,
    payloadVersion: ADAPTIVE_LEARNER_STATE_PAYLOAD_VERSION,
    generatedAt: now.toISOString(),
    authority: 'server-owned',
    roleScope: {
      role: input.role,
      classId: input.classId ?? null,
      privacyScopes: privacyScopesForRole(input.role),
    },
    featureFlag: {
      name: ADAPTIVE_LEARNER_STATE_FEATURE_FLAG,
      enabled: input.featureFlagEnabled,
      fallback: 'legacy-profile-summary-and-recommendation-consumers',
    },
    clientHints: {
      received: Boolean(input.clientHints && Object.keys(input.clientHints).length > 0),
      authoritative: false,
      reason: 'client-hints-non-authoritative',
    },
    primaryPortrait,
    primaryPortraitState: portraitResolution.primaryPortraitState,
    primaryPortraitAvailability: portraitResolution.primaryPortraitAvailability,
    primaryCompetencies: { // PORTRAIT_V2_LEGACY_COMPATIBILITY_ADAPTER: emit the compatibility slice only.
      authority: 'legacy-compatibility-only',
      source,
      vector,
    },
    secondaryDimensions,
    knowledgeMastery,
    masteryTraceability,
    resourcePreference: buildResourcePreference(personalizationFacts),
    mediaAbsorption: buildMediaAbsorption(personalizationFacts),
    pathContext: buildPathContext(paths, activeControlCorrectionPaths[0] ?? null),
    risks: buildRiskState(profileSummary, riskFlags, input.role),
    assessmentState: {
      latestAbilityEstimate: buildAbilityEstimate(latestAbility),
    },
    evidence,
    prerequisiteFeatureGroups,
    ...(goalSlices ? { goalSlices } : {}),
    fieldContracts: ADAPTIVE_LEARNER_STATE_FIELD_CONTRACTS,
    missingEvidence,
  };
}
