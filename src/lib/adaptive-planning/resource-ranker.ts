import {
  buildResourceSemanticProjection,
  type ResourceCitationReadiness,
  type ResourceEvidenceCapability,
  type ResourceGovernanceLimitation,
  type ResourceNodeCognitiveLoad,
  type ResourceNodeReadinessMetadata,
  type ResourceSceneAvailabilityMap,
  type PlanningUnit,
  ResourceGraphNodeRefs,
  ResourceNode,
  ResourceNodeRegistry,
} from '../resource-node-registry';

export type ResourceLearnerMatchingScene = 'path' | 'konling' | 'diagnosis' | 'prep-pack';

export interface ResourceLearnerMatchingLearnerState {
  knowledgeMastery?: {
    tags?: Record<string, {
      posteriorMastery?: number;
      confidence?: number;
      evidenceCount?: number;
    }>;
  };
  primaryCompetencies?: {
    vector?: Record<string, {
      score?: number;
      confidence?: number;
      evidenceCount?: number;
    }>;
  };
  resourcePreference?: {
    preferredModalities?: string[];
  };
  evidence?: {
    confidence?: {
      score?: number;
      evidenceCount?: number;
      sourceCompleteness?: number;
    };
  };
}

export interface ResourceLearnerRankerCandidate {
  node: ResourceNode;
  planningUnit: PlanningUnit | null;
  rejectionReasons?: string[];
  limitations?: string[];
}

export interface ResourceLearnerRankerInput {
  candidates: ResourceLearnerRankerCandidate[];
  scene: ResourceLearnerMatchingScene;
  targetGraphNodeIds: string[];
  learnerState: ResourceLearnerMatchingLearnerState | null;
  preferredResourceTypes?: ResourceNode['type'][];
  timeBudgetMinutes: number;
  registry?: Pick<ResourceNodeRegistry, 'supportedTypes'>;
}

export interface ResourceLearnerRankerFeatureContribution {
  feature:
    | 'graph-coverage'
    | 'capability-contribution'
    | 'evidence-potential'
    | 'learner-fit'
    | 'accessibility'
    | 'freshness'
    | 'time-cost'
    | 'cognitive-load'
    | 'readiness'
    | 'governance';
  value: number;
  reason: string;
}

export interface ResourceLearnerRankerExplanation {
  score: number;
  featureContributions: ResourceLearnerRankerFeatureContribution[];
  matchedGraphRefs: ResourceGraphNodeRefs;
  evidencePotential: number;
  limitations: string[];
  versionContext: string[];
  tieBreakReason: string;
}

export interface RankedResourceLearnerCandidate {
  node: ResourceNode;
  planningUnit: PlanningUnit | null;
  score: number;
  reasonCodes: string[];
  explanation: ResourceLearnerRankerExplanation;
}

export interface RejectedResourceLearnerCandidate {
  node: ResourceNode;
  score: 0;
  rejectionReasons: string[];
  explanation: ResourceLearnerRankerExplanation;
}

export interface ResourceLearnerRankerResult {
  ranked: RankedResourceLearnerCandidate[];
  rejected: RejectedResourceLearnerCandidate[];
  sceneWeights: Record<ResourceLearnerRankerFeatureContribution['feature'], number>;
}

interface ResourceLearnerRankerScoringProfile {
  planningUnit: PlanningUnit | null;
  graphNodeRefs: ResourceGraphNodeRefs;
  sceneAvailability: ResourceSceneAvailabilityMap;
  citationReadiness: ResourceCitationReadiness;
  evidenceCapability: ResourceEvidenceCapability;
  governanceLimitations: ResourceGovernanceLimitation[];
  knowledgeCoverage: string[];
  abilityImpact: Record<string, number>;
  estimatedTimeMinutes: number;
  cognitiveLoad: ResourceNodeCognitiveLoad;
  readiness: ResourceNodeReadinessMetadata | null;
  evidenceInstrumentation: string[];
}

const SCENE_WEIGHTS: Record<ResourceLearnerMatchingScene, Record<ResourceLearnerRankerFeatureContribution['feature'], number>> = {
  path: {
    'graph-coverage': 1.2,
    'capability-contribution': 1,
    'evidence-potential': 0.9,
    'learner-fit': 0.8,
    accessibility: 0.7,
    freshness: 0.4,
    'time-cost': 0.8,
    'cognitive-load': 0.6,
    readiness: 1,
    governance: 1,
  },
  konling: {
    'graph-coverage': 1.1,
    'capability-contribution': 0.5,
    'evidence-potential': 0.7,
    'learner-fit': 0.6,
    accessibility: 0.5,
    freshness: 0.9,
    'time-cost': 0.3,
    'cognitive-load': 0.3,
    readiness: 0.4,
    governance: 1,
  },
  diagnosis: {
    'graph-coverage': 1,
    'capability-contribution': 0.9,
    'evidence-potential': 1.1,
    'learner-fit': 0.9,
    accessibility: 0.4,
    freshness: 0.8,
    'time-cost': 0.3,
    'cognitive-load': 0.4,
    readiness: 0.6,
    governance: 1,
  },
  'prep-pack': {
    'graph-coverage': 0.9,
    'capability-contribution': 0.7,
    'evidence-potential': 0.9,
    'learner-fit': 1,
    accessibility: 0.6,
    freshness: 0.6,
    'time-cost': 0.5,
    'cognitive-load': 0.5,
    readiness: 0.6,
    governance: 1,
  },
};

export function rankResourceLearnerCandidates(input: ResourceLearnerRankerInput): ResourceLearnerRankerResult {
  const weights = SCENE_WEIGHTS[input.scene];
  const ranked: RankedResourceLearnerCandidate[] = [];
  const rejected: RejectedResourceLearnerCandidate[] = [];

  for (const candidate of input.candidates) {
    const profile = buildScoringProfile(candidate);
    const rejectionReasons = unique([
      ...(candidate.rejectionReasons ?? []),
      ...sceneRejectionReasons(candidate, input.scene, profile),
    ]);
    if (rejectionReasons.length > 0) {
      rejected.push({
        node: candidate.node,
        score: 0,
        rejectionReasons,
        explanation: buildRankerExplanation(candidate, profile, input, weights, 0, [], rejectionReasons),
      });
      continue;
    }

    const featureContributions = buildFeatureContributions(candidate.node, profile, input);
    const score = round(featureContributions.reduce((sum, contribution) =>
      sum + contribution.value * weights[contribution.feature], 0
    ), 3);
    const explanation = buildRankerExplanation(candidate, profile, input, weights, score, featureContributions, []);
    ranked.push({
      node: candidate.node,
      planningUnit: profile.planningUnit,
      score,
      reasonCodes: rankerReasonCodes(featureContributions, explanation.limitations),
      explanation,
    });
  }

  ranked.sort((left, right) =>
    right.score - left.score ||
    estimatedTimeMinutes(left) - estimatedTimeMinutes(right) ||
    left.node.id.localeCompare(right.node.id)
  );

  return { ranked, rejected, sceneWeights: { ...weights } };
}

function buildScoringProfile(candidate: ResourceLearnerRankerCandidate): ResourceLearnerRankerScoringProfile {
  if (candidate.planningUnit) {
    return {
      planningUnit: candidate.planningUnit,
      graphNodeRefs: candidate.planningUnit.graphNodeRefs,
      sceneAvailability: candidate.planningUnit.sceneAvailability,
      citationReadiness: candidate.planningUnit.citationReadiness,
      evidenceCapability: candidate.planningUnit.evidenceCapability,
      governanceLimitations: candidate.planningUnit.governanceLimitations,
      knowledgeCoverage: candidate.planningUnit.knowledgeCoverage,
      abilityImpact: candidate.planningUnit.abilityImpact,
      estimatedTimeMinutes: candidate.planningUnit.estimatedTimeMinutes,
      cognitiveLoad: candidate.planningUnit.cognitiveLoad,
      readiness: candidate.planningUnit.readiness,
      evidenceInstrumentation: candidate.planningUnit.evidenceInstrumentation,
    };
  }
  const projection = buildResourceSemanticProjection(candidate.node);
  const graphProfile = projection.resource.graphProfile;
  return {
    planningUnit: null,
    graphNodeRefs: graphProfile.graphNodeRefs,
    sceneAvailability: graphProfile.sceneAvailability,
    citationReadiness: graphProfile.citationReadiness,
    evidenceCapability: graphProfile.evidenceCapability,
    governanceLimitations: graphProfile.governanceLimitations,
    knowledgeCoverage: projection.resource.knowledgeNodeIds,
    abilityImpact: Object.fromEntries(
      projection.resource.capabilityTargetIds.map((target) => [target, candidate.node.planningMetadata.abilityImpact[target] ?? 0.2]),
    ),
    estimatedTimeMinutes: graphProfile.pathProfile.estimatedTimeMinutes,
    cognitiveLoad: graphProfile.pathProfile.cognitiveLoad,
    readiness: graphProfile.pathProfile.readiness,
    evidenceInstrumentation: candidate.node.planningMetadata.evidenceInstrumentation,
  };
}

function sceneRejectionReasons(
  candidate: ResourceLearnerRankerCandidate,
  scene: ResourceLearnerMatchingScene,
  profile: ResourceLearnerRankerScoringProfile,
): string[] {
  if (scene === 'path') {
    if (!profile.planningUnit) return ['missing-planning-unit-projection'];
    if (!candidate.node.eligibility.pathEligible) return candidate.node.eligibility.reasons;
  }
  const availability = profile.sceneAvailability[scene];
  if (!availability.allowed) return [availability.reason ?? `${scene}-scene-unavailable`];
  return [];
}

function buildFeatureContributions(
  node: ResourceNode,
  profile: ResourceLearnerRankerScoringProfile,
  input: ResourceLearnerRankerInput,
): ResourceLearnerRankerFeatureContribution[] {
  const graphCoverage = graphCoverageScore(profile, input.targetGraphNodeIds);
  const capability = capabilityContributionScore(profile, input.learnerState);
  const evidence = evidencePotentialScore(profile);
  const learner = learnerFitScore(node, profile, input);
  const accessibility = node.planningMetadata.privacyLevel === 'student-visible' ? 1 : 0.2;
  const freshness = freshnessScore(node, profile);
  const timeCost = 1 - Math.min(1, profile.estimatedTimeMinutes / Math.max(input.timeBudgetMinutes, 1));
  const cognitiveLoad = profile.cognitiveLoad === 'low' ? 1 : profile.cognitiveLoad === 'medium' ? 0.7 : 0.35;
  const readiness = profile.readiness ? 0.55 : 1;
  const governance = Math.max(0, 1 - Math.min(profile.governanceLimitations.length, 4) * 0.2);
  const matchedRefs = matchedGraphRefs(profile, input.targetGraphNodeIds);
  return [
    { feature: 'graph-coverage', value: graphCoverage, reason: `matched ${matchedRefs.knowledge.length + matchedRefs.capability.length + matchedRefs.quality.length} graph refs` },
    { feature: 'capability-contribution', value: capability, reason: 'ability impact against weak competency dimensions' },
    { feature: 'evidence-potential', value: evidence, reason: 'instrumentation and terminal validation capacity' },
    { feature: 'learner-fit', value: learner, reason: 'learner preference and weak knowledge fit' },
    { feature: 'accessibility', value: accessibility, reason: 'privacy visibility for learner scene' },
    { feature: 'freshness', value: freshness, reason: 'versioned source context and citation readiness' },
    { feature: 'time-cost', value: timeCost, reason: 'fits within planner time budget' },
    { feature: 'cognitive-load', value: cognitiveLoad, reason: `${profile.cognitiveLoad} cognitive load` },
    { feature: 'readiness', value: readiness, reason: profile.readiness ? 'readiness prerequisites remain' : 'ready without extra prerequisites' },
    { feature: 'governance', value: governance, reason: 'resource governance limitations' },
  ];
}

function buildRankerExplanation(
  candidate: ResourceLearnerRankerCandidate,
  profile: ResourceLearnerRankerScoringProfile,
  input: ResourceLearnerRankerInput,
  weights: ResourceLearnerRankerResult['sceneWeights'],
  score: number,
  featureContributions: ResourceLearnerRankerFeatureContribution[],
  rejectionReasons: string[],
): ResourceLearnerRankerExplanation {
  return {
    score,
    featureContributions,
    matchedGraphRefs: matchedGraphRefs(profile, input.targetGraphNodeIds),
    evidencePotential: evidencePotentialScore(profile),
    limitations: unique([
      ...(candidate.limitations ?? []),
      ...rejectionReasons,
      ...profile.citationReadiness.limitations,
      ...profile.governanceLimitations.map((limitation) => limitation.code),
    ]),
    versionContext: candidate.node.sourceRefs.map((ref) => `${ref.kind}:${ref.ref}`),
    tieBreakReason: `score:${score}; scene:${input.scene}; weights:${Object.entries(weights)
      .map(([key, value]) => `${key}=${value}`)
      .join(',')}; id:${candidate.node.id}`,
  };
}

function graphCoverageScore(profile: ResourceLearnerRankerScoringProfile, targetGraphNodeIds: string[]): number {
  if (targetGraphNodeIds.length === 0) {
    return Math.min(1, (profile.knowledgeCoverage.length + Object.keys(profile.abilityImpact).length) / 4);
  }
  const matched = matchedGraphRefs(profile, targetGraphNodeIds);
  const matchedCount = matched.knowledge.length + matched.capability.length + matched.quality.length;
  return Math.min(1, matchedCount / targetGraphNodeIds.length);
}

function capabilityContributionScore(
  profile: ResourceLearnerRankerScoringProfile,
  learnerState: ResourceLearnerMatchingLearnerState | null,
): number {
  const competencyState = learnerState?.primaryCompetencies?.vector ?? {};
  const entries = Object.entries(profile.abilityImpact);
  if (entries.length === 0) return 0;
  const weighted = entries.reduce((sum, [dimension, impact]) => {
    const weakScore = 1 - Math.min(1, Math.max(0, competencyState[dimension]?.score ?? 0.5));
    return sum + impact * weakScore;
  }, 0);
  return Math.min(1, weighted);
}

function evidencePotentialScore(profile: ResourceLearnerRankerScoringProfile): number {
  const instrumentation = profile.evidenceInstrumentation.length > 0 ? 0.45 : 0;
  const terminal = profile.evidenceCapability.terminalValidationRole === 'terminal'
    ? 0.45
    : profile.evidenceCapability.terminalValidationRole === 'supporting'
      ? 0.25
      : 0;
  return Math.min(1, instrumentation + terminal + profile.evidenceCapability.instrumentationRefs.length * 0.05);
}

function learnerFitScore(
  node: ResourceNode,
  profile: ResourceLearnerRankerScoringProfile,
  input: ResourceLearnerRankerInput,
): number {
  const preferredTypes = new Set([
    ...(input.preferredResourceTypes ?? []),
    ...(input.learnerState?.resourcePreference?.preferredModalities ?? []).filter((type): type is ResourceNode['type'] =>
      Boolean(input.registry?.supportedTypes.includes(type as ResourceNode['type']))
    ),
  ]);
  const modality = preferredTypes.has(node.type) ? 0.35 : 0;
  const weakKnowledge = Object.entries(input.learnerState?.knowledgeMastery?.tags ?? {}).reduce((sum, [tag, state]) => {
    if (!profile.knowledgeCoverage.includes(tag)) return sum;
    return sum + (1 - Math.min(1, Math.max(0, state.posteriorMastery ?? 0.5)));
  }, 0);
  return Math.min(1, modality + weakKnowledge);
}

function freshnessScore(node: ResourceNode, profile: ResourceLearnerRankerScoringProfile): number {
  const refs = node.sourceRefs.map((ref) => ref.ref);
  const hasVersion = refs.some((ref) => ref.startsWith('version:') || ref.includes('v'));
  const hasFreshness = refs.some((ref) => ref.startsWith('freshness:') || ref.includes('checked'));
  const citationReady = profile.citationReadiness.status === 'verified' ? 0.4 : 0.15;
  return Math.min(1, (hasVersion ? 0.35 : 0) + (hasFreshness ? 0.25 : 0) + citationReady);
}

function matchedGraphRefs(profile: ResourceLearnerRankerScoringProfile, targetGraphNodeIds: string[]): ResourceGraphNodeRefs {
  const targets = new Set(targetGraphNodeIds);
  if (targets.size === 0) {
    return profile.graphNodeRefs;
  }
  return {
    knowledge: profile.graphNodeRefs.knowledge.filter((ref) => targets.has(ref)),
    capability: profile.graphNodeRefs.capability.filter((ref) => targets.has(ref)),
    quality: profile.graphNodeRefs.quality.filter((ref) => targets.has(ref)),
  };
}

function estimatedTimeMinutes(candidate: RankedResourceLearnerCandidate): number {
  return candidate.planningUnit?.estimatedTimeMinutes ?? candidate.node.planningMetadata.estimatedTimeMinutes ?? 0;
}

function rankerReasonCodes(
  contributions: ResourceLearnerRankerFeatureContribution[],
  limitations: string[],
): string[] {
  return unique([
    ...contributions
      .filter((contribution) => contribution.value > 0)
      .map((contribution) => `ranker:${contribution.feature}`),
    ...limitations.map((limitation) => `limitation:${limitation}`),
  ]);
}

function unique<T>(items: T[]): T[] {
  return Array.from(new Set(items));
}

function round(value: number, digits = 3): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}
