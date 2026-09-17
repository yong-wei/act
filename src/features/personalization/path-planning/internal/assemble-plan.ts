import type { AdaptivePathStrategyMetadata } from '@/features/personalization/path-planning/adaptive-path-differentiation';
import { goalCanonicalIds } from '@/features/personalization/path-planning/goal-canonical-knowledge';
import { ADAPTIVE_PATH_STRATEGY_BY_FAMILY } from '@/features/personalization/path-planning/adaptive-path-differentiation';
import {
  AUTOCONTROL_KAQ_GRAPH_CATALOG,
  AUTOCONTROL_KAQ_OBJECTIVES,
} from '@/lib/data-governance/autocontrol-kaq-graph-catalog';
import type {
  GraphCenterClassOverlay,
  GraphCenterLearnerOverlay,
  GraphCenterOverlayStatus,
  GraphCenterResourceCoverage,
} from '@/lib/data-governance/graph-center';
import {
  mapLegacyCompetencyDimensionToPortraitV2,
  type PortraitV2DimensionId,
} from '@/lib/data-governance/kaq-objective-taxonomy';
import type { PortraitV2ProjectedPayload } from '@/lib/data-governance/portrait-v2-model';
import { hasAuthoritativePortraitV2Evidence } from '@/lib/data-governance/portrait-v2-consumer';
import type {
  ExpandedGoalSubgraph,
  GoalSubgraphLimitation,
  GoalSubgraphPolicyEntry,
} from '@/lib/graphs/goal-subgraph-expansion-service';
import {
  rankResourceLearnerCandidates,
  type ResourceLearnerRankerExplanation,
} from '@/features/personalization/path-planning/resource-ranker';
import {
  PATH_CONSTRAINT_REPAIR_VERSION,
  deterministicPathConstraintRepairAdapter,
  type PathConstraintRepairCandidate,
  type PathConstraintRepairResult,
} from '@/features/personalization/path-planning/path-constraint-repair';
import {
  buildPersonalizedPathDecisionEvidence,
  listPersonalizedPathDegradationReasons,
  type PersonalizedPathDecisionEvidence,
  type PersonalizedPathDecisionPathEvidence,
} from '@/features/personalization/path-planning/adaptive-path-decision-evidence';
import {
  collectionCheckpointPreference,
  collectionDifficultyRhythm,
  collectionPreferredModalities,
  projectColdStartCollection,
  projectCollectionImpactsOnNewPath,
  type ColdStartCollectionEvent,
  type ColdStartPathFacts,
} from '@/lib/cold-start-evidence-collection';
import {
  buildResourceNodeHighConfidencePlanningAudit,
  buildResourceSemanticProjection,
  type PlanningUnit,
  type ResourceGraphNodeRefs,
  type ResourceNode,
  type ResourceNodeCheckpointMetadata,
  type ResourceNodeExternalResourceMetadata,
  type ResourceNodePathSemantics,
  type ResourceNodePrivacyLevel,
  type ResourceNodeRegistry,
  type ResourceNodeReadinessMetadata,
} from '@/lib/resource-node-registry';
import {
  buildKaqArtifactVersionRefs,
  buildKaqVersionedArtifactMetadata,
  type KaqArtifactVersionRefs,
  type KaqVersionedArtifactMetadata,
} from '@/lib/kaq-artifact-versioning';
import {
  retrieveSourcePack,
  type SourcePackCallerRole,
  type SourcePackItem,
  type SourcePackLimitation,
} from '@/lib/source-pack';
import type { AdaptivePathNodeDecisionExplanation } from '@/features/personalization/path-planning/adaptive-path-node-decisions';
import type { AdaptivePathNodeRuntimeBinding } from '@/features/personalization/path-planning/adaptive-path-runtime-binding';
import type { ResourceFeatureReference } from '@/lib/published-resource-reference';
import type { StudentSafeEvidenceEventReference } from '@/lib/data-governance/evidence-timeline';
import type { StudentEvidenceWindow } from '@/lib/data-governance/student-evidence-feature-cache';
import { resolveAdaptivePathDestinationContract } from '@/features/personalization/path-planning/adaptive-path-destination-contract';
import {
  resolveItemTypeTerminalValidation,
  type ItemTypeTerminalValidationResolution,
} from '@/features/assessment/item-type-terminal-validation';
import { CONTROL_CORRECTION_CAPABILITY_TARGETS } from '@/features/personalization/plugins/control-correction/capability-targets';
import { personalizationPluginRegistry } from '@/features/personalization/plugins/public-api';
import type { PersonalizationPluginPathPlanningPolicy, PersonalizationPluginStatus } from '@/features/personalization/plugins/types';
import type {
  AdaptiveLearningCapabilityTarget,
  AdaptiveLearningPathEvidenceType,
} from '../contracts';

export type {
  AdaptiveLearningCapabilityLevel,
  AdaptiveLearningCapabilityTarget,
  AdaptiveLearningPathEvidenceType,
} from '../contracts';
export { CONTROL_CORRECTION_CAPABILITY_TARGETS };

export type AdaptiveLearningPathStatus = 'ready' | 'fallback';
export type AdaptiveLearningPathPolicyFamily =
  | 'rules-plus-graph-search'
  | 'foundation-remediation'
  | 'simulation-driven'
  | 'preference-matched'
  | 'sprint-correction'
  | 'teacher-assigned';
export type AdaptiveLearningPathPolicyBundleStatus = 'ready' | 'low-resource-fallback';
export type AdaptiveLearningPathStyleId =
  | 'foundation-remediation'
  | 'arena-simulation-sprint'
  | 'preference-matched-route'
  | 'rules-graph-search-route'
  | 'sprint-correction-route'
  | 'teacher-assigned-route';
export type AdaptiveLearningPathFeedbackType =
  | 'adoption'
  | 'selection'
  | 'rejection'
  | 'switch'
  | 'completion'
  | 'deviation'
  | 'correction-success'
  | 'explanation-click'
  | 'helpfulness';
export type LearningGoalStatus = 'draft' | 'path-ready' | 'fully-governed';
export type LearningGoalIntentType =
  | 'concept-understanding'
  | 'modeling'
  | 'analysis'
  | 'controller-design'
  | 'simulation-validation'
  | 'transfer-application'
  | 'reflective-improvement';
export type LearningGoalRecommendedPhase =
  | 'foundation'
  | 'diagnosis'
  | 'practice'
  | 'validation'
  | 'transfer';

export interface LearningGoalResourceMix {
  required: ResourceNode['type'][];
  preferred: ResourceNode['type'][];
  optional: ResourceNode['type'][];
}

export interface LearningGoalEvidencePolicy {
  requiredEvidenceTypes: AdaptiveLearningPathEvidenceType[];
  minimumEvidenceCount: number;
  confidenceFloor: number;
  qualityEvidenceGoverned: boolean;
  limitations: string[];
}

export interface LearningGoalTerminalValidationPolicy {
  required: boolean;
  acceptedEvidenceTypes: AdaptiveLearningPathEvidenceType[];
  terminalNodeTypes: ResourceNode['type'][];
  summary: string;
}

export interface LearningGoalDefinition {
  id: string;
  title: string;
  description: string;
  completionMeaning: string;
  intentType: LearningGoalIntentType;
  recommendedPhase: LearningGoalRecommendedPhase;
  knowledgeObjectiveIds: string[];
  capabilityObjectiveIds: string[];
  qualityObjectiveIds: string[];
  targetGraphNodeIds: string[];
  goalSliceId: string;
  resourceMix: LearningGoalResourceMix;
  evidencePolicy: LearningGoalEvidencePolicy;
  terminalValidationPolicy: LearningGoalTerminalValidationPolicy;
  pathPolicyFamily: AdaptiveLearningPathPolicyFamily;
  status: LearningGoalStatus;
  version: string;
  limitations: string[];
}

export interface AdaptiveLearningPathGraphContextInput {
  learningGoalId: string;
  learningGoalVersion: string;
  objectiveBoundary: {
    knowledgeObjectiveIds: string[];
    capabilityObjectiveIds: string[];
    qualityObjectiveIds: string[];
  };
  expandedSubgraph: ExpandedGoalSubgraph;
  selectedGraphNodeIds?: string[];
  resourceCoverage?: Record<string, GraphCenterResourceCoverage>;
  learnerOverlay?: GraphCenterLearnerOverlay | null;
  classOverlay?: GraphCenterClassOverlay | null;
  learningGoalBaseline?: {
    coverageState: 'complete' | 'limited';
    missingBaselineCategories: string[];
    reviewedBindingCount: number;
    limitationReason: string | null;
    sourceWindow: { from: string | null; to: string | null };
  } | null;
  assessmentCoverage?: {
    coverageState: 'complete' | 'limited';
    incompleteStages: string[];
    reviewedPathEligibleItemCount: number;
    limitationReason: string | null;
    matrixVersion: string;
    generatedAt: string | null;
    terminalValidationRequired: boolean;
    assessmentItemsReplaceTerminalEvidence: false;
  } | null;
  versionRefs?: Partial<KaqArtifactVersionRefs>;
}

export interface AdaptiveLearningPathGraphLimitation {
  code: string;
  severity: 'blocking' | 'warning';
  message: string;
  nodeId?: string;
}

export interface AdaptiveLearningPathGraphContextSummary {
  learningGoalId: string;
  learningGoalVersion: string;
  graphVersion: string;
  objectiveBoundary: AdaptiveLearningPathGraphContextInput['objectiveBoundary'];
  objectiveBoundaryDiagnostics?: AdaptiveLearningPathObjectiveBoundaryDiagnostics;
  targetGraphNodeIds: string[];
  selectedGraphNodeIds: string[];
  prerequisitePolicy: Array<Pick<
    GoalSubgraphPolicyEntry,
    'edgeId' | 'sourceNodeId' | 'targetNodeId' | 'semantics' | 'required'
  >>;
  overlayStatus: {
    learner: GraphCenterOverlayStatus | 'missing';
    class: GraphCenterOverlayStatus | 'missing';
  };
  resourceCoverageStatus: Record<string, Pick<
    GraphCenterResourceCoverage,
    'coverageState' | 'pathEligibleResourceCount' | 'linkedResourceCount'
  >>;
  resourceCoveragePathEligibleResourceIds: Record<string, string[]>;
  learningGoalBaseline?: NonNullable<AdaptiveLearningPathGraphContextInput['learningGoalBaseline']>;
  assessmentCoverage?: NonNullable<AdaptiveLearningPathGraphContextInput['assessmentCoverage']>;
  versionRefs: KaqArtifactVersionRefs;
  limitations: AdaptiveLearningPathGraphLimitation[];
}

export interface AdaptiveLearningPathObjectiveBoundaryDiagnostics {
  acceptedBoundaryRefs: {
    knowledgeObjectiveIds: string[];
    capabilityObjectiveIds: string[];
    qualityObjectiveIds: string[];
    graphNodeIds: string[];
    prerequisiteGraphNodeIds: string[];
    policyRequiredRoles: string[];
  };
  rejectedMismatchCount: number;
  selectedResourceMatches: Array<{
    nodeId: string;
    matchRefs: string[];
    matchReasons: string[];
  }>;
  lowResourceReasons: string[];
}

export type AdaptiveLearningPathGraphContextPersistenceSummary = Omit<
  AdaptiveLearningPathGraphContextSummary,
  'resourceCoveragePathEligibleResourceIds'
>;

export type LearningGoalValidationIssueCode =
  | 'missing-learning-goal'
  | 'duplicate-learning-goal-id'
  | 'missing-student-facing-text'
  | 'missing-objective-binding'
  | 'missing-graph-binding'
  | 'missing-resource-mix'
  | 'missing-evidence-policy'
  | 'missing-terminal-validation-policy'
  | 'missing-quality-limitation'
  | 'missing-path-policy'
  | 'unknown-objective-id'
  | 'objective-domain-mismatch'
  | 'unknown-graph-node-id'
  | 'unknown-goal-slice-id'
  | 'minimum-path-ready-coverage'
  | 'missing-domain-coverage'
  | 'learning-goal-not-registered';

export interface LearningGoalValidationIssue {
  code: LearningGoalValidationIssueCode;
  learningGoalId: string | null;
  message: string;
}

export interface AdaptiveLearningPathGoal {
  id: string;
  title: string;
  knowledgeTargets: string[];
  competencyTargets?: string[];
  capabilityTargets?: AdaptiveLearningCapabilityTarget[];
  learningGoal?: LearningGoalDefinition;
  learningGoalPackage?: LearningGoalDefinition;
}

export interface AdaptiveLearningPathRegisteredGoalDefinition {
  goal: AdaptiveLearningPathGoal;
  displayName: string;
  requiresRegisteredPlugin?: boolean;
  learningGoal?: LearningGoalDefinition;
  knowledgeTargetAliases?: Record<string, string[]>;
  allowedResourceMix: ResourceNode['type'][];
  starterPathPolicy: {
    policyFamilies: AdaptiveLearningPathPolicyFamily[];
    targetOptionCount: number;
    difficultyRhythm: 'gentle' | 'steady' | 'challenge';
    allowExternalResources: boolean;
    preferredResourceTypes: ResourceNode['type'][];
  };
  checkpointPolicy: {
    minCheckpoints: number;
    checkpointResourceTypes: ResourceNode['type'][];
    requiresTerminalValidation: boolean;
  };
  explanationTemplates: {
    ready: string;
    coldStart: string;
    lowConfidence: string;
    fallback: string;
  };
}

export interface AdaptiveLearningPathLearnerState {
  payloadVersion?: string;
  generatedAt?: string;
  authority?: 'server-owned';
  knowledgeMastery?: {
    tags?: Record<string, {
      posteriorMastery?: number;
      confidence?: number;
      evidenceCount?: number;
      freshness?: 'current' | 'partial' | 'stale' | 'missing';
      eventReferences?: StudentSafeEvidenceEventReference[];
    }>;
  };
  // PORTRAIT_V2_LEGACY_COMPATIBILITY_ADAPTER: legacy primaryCompetencies is non-authoritative compatibility input.
  primaryCompetencies?: {
    vector?: Record<string, {
      score?: number;
      confidence?: number;
      evidenceCount?: number;
      eventReferences?: StudentSafeEvidenceEventReference[];
    }>;
  };
  primaryPortrait?: PortraitV2ProjectedPayload;
  primaryPortraitState?: 'SNAPSHOT' | 'NO_EVIDENCE' | 'UNAVAILABLE';
  primaryPortraitAvailability?: string;
  resourcePreference?: {
    preferredModalities?: string[];
    confidence?: 'none' | 'low' | 'medium';
  };
  evidence?: {
    evidenceWindow?: StudentEvidenceWindow;
    confidence?: {
      level?: 'none' | 'low' | 'medium' | 'high';
      score?: number;
      evidenceCount?: number;
      sourceCompleteness?: number;
    };
    sourceCoverage?: Record<string, string>;
  };
  goalSlices?: Record<string, {
    capabilityTargets?: AdaptiveLearningPathCapabilityEvidence[];
  } | undefined>;
  risks?: {
    riskLevel?: string;
    activeFlags?: Array<{
      type: string;
      severity: string;
    }>;
  };
  missingEvidence?: string[];
}

export interface AdaptiveLearningPathLearnerStateSnapshot {
  payloadVersion: string | null;
  generatedAt: string | null;
  authority: 'server-owned' | 'unknown';
  sourceCoverage: Record<string, string>;
  evidenceWindow: StudentEvidenceWindow | null;
  freshness: 'current' | 'partial' | 'stale' | 'missing';
  confidence: {
    level: 'none' | 'low' | 'medium' | 'high';
    score: number;
    sourceCompleteness: number;
    evidenceCount: number;
  };
  missingEvidence: string[];
  preferredModalities: string[];
  preferredModalityConfidence: 'none' | 'low' | 'medium';
  primaryPortraitState: 'SNAPSHOT' | 'NO_EVIDENCE' | 'UNAVAILABLE' | null;
  primaryPortraitAvailability: string | null;
}

export function buildAdaptiveLearningPathLearnerStateSnapshot(
  learnerState: AdaptiveLearningPathLearnerState | null | undefined,
): AdaptiveLearningPathLearnerStateSnapshot | null {
  if (!learnerState) return null;
  const confidence = learnerState.evidence?.confidence;
  const freshnessValues = [
    ...Object.values(learnerState.knowledgeMastery?.tags ?? {}).map((tag) => tag.freshness),
    ...Object.values(learnerState.goalSlices ?? {}).flatMap((slice) =>
      (slice?.capabilityTargets ?? []).map((target) => target.observedEvidence.freshness),
    ),
  ]
    .filter((value): value is NonNullable<typeof value> => Boolean(value));
  const freshness = freshnessValues.includes('stale')
    ? 'stale'
    : freshnessValues.includes('partial')
      ? 'partial'
      : freshnessValues.includes('current')
        ? 'current'
        : 'missing';
  return {
    payloadVersion: learnerState.payloadVersion ?? null,
    generatedAt: learnerState.generatedAt ?? null,
    authority: learnerState.authority === 'server-owned' ? 'server-owned' : 'unknown',
    sourceCoverage: { ...(learnerState.evidence?.sourceCoverage ?? {}) },
    evidenceWindow: learnerState.evidence?.evidenceWindow
      ? { ...learnerState.evidence.evidenceWindow }
      : null,
    freshness,
    confidence: {
      level: confidence?.level ?? 'none',
      score: confidence?.score ?? 0,
      sourceCompleteness: confidence?.sourceCompleteness ?? 0,
      evidenceCount: confidence?.evidenceCount ?? 0,
    },
    missingEvidence: [...(learnerState.missingEvidence ?? [])],
    preferredModalities: [...(learnerState.resourcePreference?.preferredModalities ?? [])],
    preferredModalityConfidence: learnerState.resourcePreference?.confidence
      ?? preferredModalityConfidenceFromCount(learnerState.resourcePreference?.preferredModalities?.length ?? 0),
    primaryPortraitState: learnerState.primaryPortraitState ?? null,
    primaryPortraitAvailability: learnerState.primaryPortraitAvailability ?? null,
  };
}

function preferredModalityConfidenceFromCount(count: number): 'none' | 'low' | 'medium' {
  if (count >= 5) return 'medium';
  if (count > 0) return 'low';
  return 'none';
}

export function hasTrustedPortraitForPersonalization(
  state: AdaptiveLearningPathLearnerState | null | undefined,
): boolean {
  return Boolean(
    state
      && state.primaryPortraitState === 'SNAPSHOT'
      && state.primaryPortraitAvailability === 'available'
      && state.primaryPortrait
      && hasAuthoritativePortraitV2Evidence(state.primaryPortrait),
  );
}

export interface AdaptiveLearningPathConstraints {
  timeBudgetMinutes: number;
  privacyScopes: ResourceNodePrivacyLevel[];
  device?: 'desktop' | 'tablet' | 'mobile';
  timelineWindowDays?: 3 | 7 | 14;
  completedNodeIds?: string[];
  currentNodeId?: string | null;
  availableOutcomeRefs?: string[];
  teacherAssignedNodeIds?: string[];
  requireRiskIntervention?: boolean;
}

export type AdaptiveLearningPathConfigurationKey =
  | 'resource-preferences'
  | 'difficulty-rhythm'
  | 'checkpoint-preference'
  | 'external-resources'
  | 'natural-language-intent'
  | 'time-budget';

export type AdaptiveLearningPathConfigurationSource = 'request' | 'profile' | 'intent' | 'fallback';

export interface AdaptiveLearningPathConfigurationRequest {
  key: AdaptiveLearningPathConfigurationKey;
  source: AdaptiveLearningPathConfigurationSource;
  value: string | string[] | boolean | number;
  mappedTerms?: string[];
  limitationCode?: string;
}

export interface AdaptiveLearningPathConfigurationFulfillment {
  key: AdaptiveLearningPathConfigurationKey;
  status: 'applied' | 'unmet';
  source: AdaptiveLearningPathConfigurationSource;
  effect: string;
  message: string;
  limitationCode?: string;
}

export type AdaptiveLearningPathReadinessState = 'ready' | 'needs-preparation' | 'locked' | 'evidence-needed';

export interface AdaptiveLearningPathNodeReadiness {
  state: AdaptiveLearningPathReadinessState;
  message: string;
  unlockMessage: string | null;
  reasonCodes: string[];
  fallbackNodeIds: string[];
  missingCompetencies: string[];
  missingEvidenceCount: number;
  missingCompletedNodeIds: string[];
  missingOutcomeRefs: string[];
}

export interface AdaptiveLearningPathPlannerInput {
  studentId: string;
  goal: AdaptiveLearningPathGoal;
  learnerState: AdaptiveLearningPathLearnerState | null;
  registry: ResourceNodeRegistry;
  planningScope?: {
    knowledgeIds: string[];
    edges: Array<{
      id: string;
      sourceCanonicalId: string;
      targetCanonicalId: string;
      strength: 'REQUIRED' | 'RECOMMENDED';
    }>;
  };
  constraints: AdaptiveLearningPathConstraints;
  graphContext?: AdaptiveLearningPathGraphContextInput;
  policyFamily?: AdaptiveLearningPathPolicyFamily;
  policyBundle?: {
    families: AdaptiveLearningPathPolicyFamily[];
    overlapThreshold?: number;
  };
  difficultyRhythm?: 'gentle' | 'steady' | 'challenge';
  difficultyRhythmSource?: AdaptiveLearningPathConfigurationSource;
  resourcePreferences?: ResourceNode['type'][];
  resourcePreferenceSource?: AdaptiveLearningPathConfigurationSource;
  checkpointPreference?: 'light' | 'standard' | 'dense';
  checkpointPreferenceSource?: AdaptiveLearningPathConfigurationSource;
  allowExternalResources?: boolean;
  allowExternalResourcesSource?: AdaptiveLearningPathConfigurationSource;
  configurationRequests?: AdaptiveLearningPathConfigurationRequest[];
  excludedNodeIds?: string[];
  diversityAvoidNodeIds?: string[];
  preferredStyleId?: string;
  sourcePackCandidates?: readonly SourcePackItem[];
  sourcePackLimitations?: readonly SourcePackLimitation[];
  candidatePoolDiagnostics?: AdaptiveLearningPathCandidatePoolDiagnostics;
  sourcePackRole?: SourcePackCallerRole;
  sarCandidateContext?: AdaptiveLearningPathSarCandidateContext;
  requestedAt?: string;
  now?: Date;
  collectionEvents?: ColdStartCollectionEvent[];
  previousPathFacts?: ColdStartPathFacts;
}

export interface AdaptiveLearningPathSarCandidateContext {
  enabled?: boolean;
  traceId?: string;
  seedEntityRefs?: readonly string[];
  candidates?: readonly AdaptiveLearningPathSarCandidateRef[];
  limitations?: readonly string[];
}

export type AdaptiveLearningPathSarCandidateKind =
  | 'resourceNode'
  | 'planningUnit'
  | 'retrievalChunk'
  | 'citationTarget'
  | 'resource'
  | 'unknown';

export interface AdaptiveLearningPathSarCandidateRef {
  ref: string;
  kind?: AdaptiveLearningPathSarCandidateKind;
  resourceNodeId?: string;
  planningUnitId?: string;
  resourceId?: string;
  retrievalChunkId?: string;
  citationTargetId?: string;
  requiredUse?: 'path-node' | 'terminal-validation' | 'supporting-evidence';
}

export interface AdaptiveLearningPathPlanNode {
  nodeId: string;
  resourceFeatureRef?: ResourceFeatureReference;
  planningUnitId?: string;
  resourceId?: string;
  resourceNodeId?: string;
  title: string;
  type: ResourceNode['type'];
  pathNodeType: ResourceNodePathSemantics['type'];
  displayName: string;
  iconKey: string;
  shapeHint: ResourceNodePathSemantics['shapeHint'];
  evidenceBehavior: ResourceNodePathSemantics['evidenceBehavior'];
  evidenceStatus: 'instrumented' | 'explicit-access-required' | 'reference-only' | 'missing';
  externalResource: ResourceNodeExternalResourceMetadata | null;
  checkpoint: ResourceNodeCheckpointMetadata | null;
  sourceKind: ResourceNode['sourceKind'];
  sourceRef: string;
  target: string;
  estimatedTimeMinutes: number;
  cognitiveLoad?: ResourceNode['planningMetadata']['cognitiveLoad'];
  effort?: ResourceNode['planningMetadata']['cost']['effort'];
  prerequisiteNodeIds: string[];
  prerequisiteBasis?: Array<{ nodeId: string; source: 'PlanningUnit' | 'ENGINEERING'; relationId?: string;
    sourceCanonicalId?: string; targetCanonicalId?: string }>;
  knowledgeCoverage: string[];
  capabilityTargets?: string[];
  launchBinding?: PlanningUnit['launchBinding'];
  teacherPolicy: ResourceNode['planningMetadata']['teacherPolicy'];
  privacyLevel: ResourceNodePrivacyLevel;
  terminalConstraints: string[];
  score: number;
  reasonCodes: string[];
  resourceRanker?: ResourceLearnerRankerExplanation;
  status: 'current' | 'next' | 'completed' | 'blocked' | 'alternative' | 'locked';
  readiness?: AdaptiveLearningPathNodeReadiness;
  decisionExplanation?: AdaptivePathNodeDecisionExplanation;
  /** Runtime 资源绑定（#2055）：独立于导航 target，仅资产承载节点在批次定稿时携带。 */
  runtimeResourceBinding?: AdaptivePathNodeRuntimeBinding | null;
  appearance?: 'first' | 'revisit' | 'reference' | null;
  anchorLabel?: string | null;
}

export interface AdaptiveLearningPathAlternative {
  nodeId: string;
  nodeIds: string[];
  title: string;
  reasonCodes: string[];
  score: number;
  resourceRanker?: ResourceLearnerRankerExplanation;
  blocked: boolean;
}

export interface AdaptiveLearningPathExplanation {
  engineeringOrder?: import('@/lib/published-resource-reference').EngineeringResourceOrderEvidence;
  selectedReasons: string[];
  rejectedAlternatives: AdaptiveLearningPathAlternative[];
  fallbackReasons: string[];
  configurationFulfillment: AdaptiveLearningPathConfigurationFulfillment[];
  associativeRetrieval?: AdaptiveLearningPathAssociativeRetrievalBasis;
  itemTypeTerminalValidation?: ItemTypeTerminalValidationResolution;
}

export interface AdaptiveLearningPathScore {
  total: number;
  objectives: {
    learningGain: number;
    engagement: number;
    constraintSatisfaction: number;
    diversity: number;
    fatigue: number;
    dropoutRisk: number;
  };
}

export interface AdaptiveLearningPathMapPayload {
  mainPathNodeIds: string[];
  branchPaths: Array<{ fromNodeId: string; nodeIds: string[] }>;
  currentNodeId: string | null;
  completedNodeIds: string[];
  riskNodeIds: string[];
  blockedNodes: AdaptiveLearningPathAlternative[];
  alternatives: AdaptiveLearningPathAlternative[];
}

export interface AdaptiveLearningPathTimelinePayload {
  generatedAt: string;
  windows: Array<{
    days: 3 | 7 | 14;
    nodeIds: string[];
    estimatedMinutes: number;
  }>;
}

export interface AdaptiveLearningPathEvidencePayload {
  evidenceBasis: 'adaptive-learner-state' | 'fallback';
  confidence: AdaptiveLearningPathPlan['confidence'];
  sourceCoverage: Record<string, string>;
  learnerStateDeficits: AdaptiveLearningPathDeficit[];
  capabilityEvidence: AdaptiveLearningPathCapabilityEvidence[];
  prerequisiteReasons: Array<{ nodeId: string; prerequisiteNodeIds: string[] }>;
  teacherPolicy: Array<{ nodeId: string; policy: ResourceNode['planningMetadata']['teacherPolicy'] }>;
  alternatives: AdaptiveLearningPathAlternative[];
  sourcePackEvidence?: AdaptiveLearningPathSourcePackEvidence | null;
  candidatePoolDiagnostics?: AdaptiveLearningPathCandidatePoolDiagnostics | null;
  associativeRetrieval?: AdaptiveLearningPathAssociativeRetrievalBasis;
  learnerStateSnapshot?: AdaptiveLearningPathLearnerStateSnapshot | null;
}

export interface AdaptiveLearningPathCandidatePoolDiagnostics {
  registryVersion: string;
  projectionVersion: string;
  totalCandidates: number;
  pathEligibleCandidates: number;
  candidateCountsByFamily: Record<string, number>;
  sourceFamilies: Array<{
    family: string;
    status: 'loaded' | 'empty' | 'missing' | 'error';
    count: number;
    reason: string | null;
    skipCounts?: Record<string, number>;
  }>;
  excluded: {
    total: number;
    byReason: Record<string, number>;
  };
  sourceFamilyIssues: Record<string, number>;
  missingSourceReasons: Record<string, number>;
  nodeEligibilityMissingReasons: Record<string, number>;
}

export interface AdaptiveLearningPathAssociativeRetrievalBasis {
  traceId: string | null;
  seedEntityRefs: string[];
  candidateResourceNodeIds: string[];
  selectedCandidateNodeIds: string[];
  rejectedCandidates: AdaptiveLearningPathRejectedSarCandidate[];
  limitations: string[];
}

export interface AdaptiveLearningPathRejectedSarCandidate {
  ref: string;
  kind: AdaptiveLearningPathSarCandidateKind;
  resourceNodeId?: string;
  planningUnitId?: string;
  reasonCodes: string[];
}

export interface AdaptiveLearningPathSourcePackEvidence {
  packId: string;
  profile: 'path-planning';
  queryText: string;
  itemRefs: string[];
  pathEligibleItemRefs: string[];
  citationOnlyItemRefs: string[];
  capabilityTargetRefs: string[];
  citationTargetIds: string[];
  retrievalChunkIds: string[];
  limitationCodes: string[];
  coverage: {
    eligibleItems: number;
    returnedItems: number;
    omittedItems: number;
  };
}

export interface AdaptiveLearningPathVisualization {
  map: AdaptiveLearningPathMapPayload;
  timeline: AdaptiveLearningPathTimelinePayload;
  evidence: AdaptiveLearningPathEvidencePayload;
}

export interface AdaptiveLearningPathPolicyDefinition {
  id: AdaptiveLearningPathPolicyFamily;
  label: string;
  scoringIntent: string;
  constraints: string[];
  fallbackSemantics: string;
}

export interface AdaptiveLearningPathPolicyBundle {
  families: AdaptiveLearningPathPolicyFamily[];
  overlapThreshold: number;
  status: AdaptiveLearningPathPolicyBundleStatus;
  paths: Array<{
    styleId: AdaptiveLearningPathStyleId;
    policyFamily: AdaptiveLearningPathPolicyFamily;
    label: string;
    nodeIds: string[];
    activeNodeIds: string[];
    lockedNodeIds: string[];
    readinessSummary: Array<{
      nodeId: string;
      state: AdaptiveLearningPathReadinessState;
      message: string;
    }>;
    unlockMessages: Array<{
      nodeId: string;
      message: string;
    }>;
    planNodes?: AdaptiveLearningPathPlanNode[];
    nodeSummaries: AdaptiveLearningPathOptionNodeSummary[];
    targetDeficits: AdaptiveLearningPathDeficit[];
    strategy?: AdaptivePathStrategyMetadata & {
      preferredTypeShare: number;
      weaknessResourceCount: number;
      comprehensiveTaskCount: number;
      /** 偏好配额未达 60% 可观察占比（资源/预算不足），偏好强化未兑现。 */
      preferenceQuotaUnmet?: boolean;
    };
    recommendationProvenance?: AdaptiveLearningPathRecommendationProvenance;
    evidenceBasis: string[];
    estimatedMinutes: number;
    modalityMix: Record<string, number>;
    resourceMix: Record<string, number>;
    overlap: {
      maxWithOtherOptions: number;
    };
    effort: {
      estimatedMinutes: number;
      relative: 'short' | 'medium' | 'long';
    };
    expectedTargetLift: number;
    terminalValidationNodeIds: string[];
    terminalValidationStrategy: {
      nodeIds: string[];
      summary: string;
    };
    checkpointNodeIds: string[];
    limitations: string[];
    decisionEvidence?: PersonalizedPathDecisionPathEvidence;
  }>;
  decisionEvidence?: PersonalizedPathDecisionEvidence;
  diversity: {
    maxResourceOverlap: number;
    minModalityDistance: number;
    minEstimatedEffortDifference: number;
    minTerminalValidationDifference: number;
    pairwiseResourceOverlap: Array<{
      left: AdaptiveLearningPathPolicyFamily;
      right: AdaptiveLearningPathPolicyFamily;
      overlap: number;
    }>;
    pairwiseModalityDistance: Array<{
      left: AdaptiveLearningPathPolicyFamily;
      right: AdaptiveLearningPathPolicyFamily;
      distance: number;
    }>;
    pairwiseEstimatedEffortDifference: Array<{
      left: AdaptiveLearningPathPolicyFamily;
      right: AdaptiveLearningPathPolicyFamily;
      difference: number;
    }>;
    pairwiseTerminalValidationDifference: Array<{
      left: AdaptiveLearningPathPolicyFamily;
      right: AdaptiveLearningPathPolicyFamily;
      difference: number;
    }>;
    modalityMixByPolicy: Record<string, Record<string, number>>;
    estimatedEffortByPolicy: Record<string, number>;
    terminalValidationDifference: number;
  };
  fallbackReasons: string[];
}

export interface AdaptiveLearningPathOptionNodeSummary {
  nodeId: string;
  planningUnitId?: string;
  title: string;
  pathNodeType: AdaptiveLearningPathPlanNode['pathNodeType'];
  displayName: string;
  iconKey: string;
  shapeHint: AdaptiveLearningPathPlanNode['shapeHint'];
  evidenceBehavior: AdaptiveLearningPathPlanNode['evidenceBehavior'];
  evidenceStatus: AdaptiveLearningPathPlanNode['evidenceStatus'];
  estimatedTimeMinutes: number;
  cognitiveLoad?: AdaptiveLearningPathPlanNode['cognitiveLoad'];
  effort?: AdaptiveLearningPathPlanNode['effort'];
  knowledgeCoverage?: string[];
  capabilityTargets?: string[];
  launchBinding?: AdaptiveLearningPathPlanNode['launchBinding'];
  status: AdaptiveLearningPathPlanNode['status'];
}

export interface AdaptiveLearningPathDeficit {
  targetId: string;
  kind: 'knowledge' | 'competency';
  value: number;
  confidence: number;
  evidenceCount: number;
  reasonCode: string;
  portraitDimensionIds?: PortraitV2DimensionId[];
  eventReferences?: StudentSafeEvidenceEventReference[];
}

export interface AdaptiveLearningPathRecommendationProvenanceEntry {
  targetLabel: string;
  targetKind: 'knowledge' | 'competency';
  confidence: 'low' | 'medium' | 'high';
  evidenceSummary: string;
  judgment: string;
  affectedNodeIds: string[];
  affectedResourceTitles: string[];
  eventReferences?: StudentSafeEvidenceEventReference[];
}

export interface AdaptiveLearningPathRecommendationProvenance {
  summary: string;
  confidence: 'low' | 'medium' | 'high';
  entries: AdaptiveLearningPathRecommendationProvenanceEntry[];
  personalizationNotes?: string[];
  personalizationState?: 'portrait-unavailable';
  evidenceReviewHref: '/profile/evidence';
  limitations: string[];
  nextAction: string | null;
}

export type AdaptiveLearningPathPersistedPathOption = Record<string, unknown> & {
  optionId?: string;
  nodeIds?: string[];
  recommendationProvenance?: AdaptiveLearningPathRecommendationProvenance;
};

export type AdaptiveLearningPathSerializablePathOption = AdaptiveLearningPathPersistedPathOption & {
  optionId: string;
  styleId: string;
  policyFamily: AdaptiveLearningPathPolicyFamily;
  label: string;
  nodeIds: string[];
  strategy?: AdaptivePathStrategyMetadata;
};

export interface AdaptiveLearningPathCapabilityEvidence {
  target: AdaptiveLearningCapabilityTarget;
  observedEvidence: {
    state: 'missing' | 'low-confidence' | 'observed';
    knowledgeMastery: number | null;
    competencyScore: number | null;
    confidence: number;
    directEvidenceCount: number;
    supportingEvidenceCount: number;
    freshness?: 'current' | 'partial' | 'stale' | 'missing';
    portraitDimensionIds?: PortraitV2DimensionId[];
    eventReferences?: StudentSafeEvidenceEventReference[];
    source: 'adaptive-learner-state';
    recommendationBias: 'starter-or-evidence-gathering' | 'targeted-practice';
  };
}

export interface AdaptiveLearningPathFeedbackEvent {
  id: string;
  type: AdaptiveLearningPathFeedbackType;
  nodeId: string | null;
  createdAt: string;
  helpful?: boolean;
  context?: Record<string, unknown>;
}

export interface AdaptiveLearningPathDeviation {
  id: string;
  nodeId: string | null;
  createdAt: string;
  context: Record<string, unknown>;
  correctionPathId: string;
}

export interface AdaptiveLearningPathCorrection {
  id: string;
  priorEvidencePlanId: string;
  nodeIds: string[];
  reasonCodes: string[];
}

export interface AdaptiveLearningPathPlan {
  id: string;
  userId: string;
  goal: AdaptiveLearningPathGoal;
  stage: 'stage-1-rules-graph';
  policyFamily: AdaptiveLearningPathPolicyFamily;
  policyMetadata: AdaptiveLearningPathPolicyDefinition;
  policyBundle?: AdaptiveLearningPathPolicyBundle;
  pathOptions?: AdaptiveLearningPathPersistedPathOption[];
  excludedPolicyFamilies: ['contextual-bandit', 'reinforcement-learning', 'long-horizon-hybrid'];
  status: AdaptiveLearningPathStatus;
  currentNodeId: string | null;
  mainPath: AdaptiveLearningPathPlanNode[];
  alternatives: AdaptiveLearningPathAlternative[];
  score: AdaptiveLearningPathScore;
  confidence: {
    level: 'low' | 'medium' | 'high';
    score: number;
    sourceCoverage: number;
  };
  explanations: AdaptiveLearningPathExplanation;
  executionStatus: {
    adopted: boolean;
    completedNodeIds: string[];
    activeNodeId: string | null;
    updatedAt: string;
  };
  deviations: AdaptiveLearningPathDeviation[];
  corrections: AdaptiveLearningPathCorrection[];
  feedbackEvents: AdaptiveLearningPathFeedbackEvent[];
  visualization: AdaptiveLearningPathVisualization;
  graphContext?: AdaptiveLearningPathGraphContextSummary;
  constraintRepair?: PathConstraintRepairResult;
}

export interface AdaptiveLearningPathPersistenceRecord {
  id: string;
  userId: string;
  title: string;
  description: string;
  estimatedTime: number;
  nodeIds: string[];
  isAiGenerated: boolean;
  payload: {
    status: AdaptiveLearningPathStatus;
    learningGoal?: LearningGoalDefinition;
    learningGoalPackage?: LearningGoalDefinition;
    policyFamily: AdaptiveLearningPathPolicyFamily;
    policyMetadata: AdaptiveLearningPathPolicyDefinition;
    policyBundle?: AdaptiveLearningPathPolicyBundle;
    currentNodeId: string | null;
    score: AdaptiveLearningPathScore;
    confidence: AdaptiveLearningPathPlan['confidence'];
    pathOptions?: AdaptiveLearningPathPersistedPathOption[];
    planNodes: AdaptiveLearningPathPlanNode[];
    alternatives: AdaptiveLearningPathAlternative[];
    explanations: AdaptiveLearningPathExplanation;
    executionStatus: AdaptiveLearningPathPlan['executionStatus'];
    deviations: AdaptiveLearningPathDeviation[];
    corrections: AdaptiveLearningPathCorrection[];
    feedbackEvents: AdaptiveLearningPathFeedbackEvent[];
    visualization: AdaptiveLearningPathVisualization;
    graphContext?: AdaptiveLearningPathGraphContextPersistenceSummary;
    constraintRepair?: PathConstraintRepairResult;
    artifactVersioning: KaqVersionedArtifactMetadata;
    studentFacing: {
      summary: string;
      nextAction: string;
      confidenceLabel: string;
    };
  };
}

interface ScoredNode {
  node: ResourceNode;
  score: number;
  reasonCodes: string[];
  resourceRanker?: ResourceLearnerRankerExplanation;
}

interface CandidateChain {
  entries: ScoredNode[];
  estimatedMinutes: number;
  coversGoalTarget: boolean;
}

interface CandidateOption {
  entry: ScoredNode;
  chain: CandidateChain;
  goalTargets: string[];
  includesRiskIntervention: boolean;
}

interface PolicyFamilyRetryState {
  excludedCanonicalCoreRefs: ReadonlySet<string>;
  parentKey: string;
}

interface PolicyFamilyRetryContext {
  excludedCanonicalCoreRefs: ReadonlySet<string>;
}

interface SelectionState {
  selected: Map<string, ScoredNode>;
  coveredGoalTargets: Set<string>;
  includesRiskIntervention: boolean;
  remainingMinutes: number;
}

interface EvaluatedSarCandidates {
  traceId: string | null;
  seedEntityRefs: string[];
  acceptedNodeIds: Set<string>;
  rejectedCandidates: AdaptiveLearningPathRejectedSarCandidate[];
  limitations: string[];
}

const EXCLUDED_POLICY_FAMILIES: AdaptiveLearningPathPlan['excludedPolicyFamilies'] = [
  'contextual-bandit',
  'reinforcement-learning',
  'long-horizon-hybrid',
];

export const ADAPTIVE_LEARNING_PATH_POLICY_FAMILIES: Record<
  AdaptiveLearningPathPolicyFamily,
  AdaptiveLearningPathPolicyDefinition
> = {
  'rules-plus-graph-search': {
    id: 'rules-plus-graph-search',
    label: '规则与图搜索兼容策略',
    scoringIntent: 'preserve current rules-plus-graph-search scoring compatibility',
    constraints: ['stage-1-compatible', 'no-bandit-or-rl'],
    fallbackSemantics: 'use existing low-confidence and resource-mapping fallback reasons',
  },
  'foundation-remediation': {
    id: 'foundation-remediation',
    label: '基础补救策略',
    scoringIntent: 'prioritize prerequisite repair, concept cards, short exercises, and low cognitive-load resources before terminal validation',
    constraints: ['prerequisite-first', 'low-cognitive-load-first', 'terminal-validation-last'],
    fallbackSemantics: 'report low-resource fallback when prerequisite repair resources are insufficient',
  },
  'simulation-driven': {
    id: 'simulation-driven',
    label: '仿真驱动策略',
    scoringIntent: 'prioritize simulation, Arena, experiment, and reflection resources while preserving prerequisites and evidence confidence',
    constraints: ['simulation-first', 'preserve-prerequisites', 'evidence-confidence-required'],
    fallbackSemantics: 'fall back to available graph resources when simulation or Arena resources cannot cover the goal',
  },
  'sprint-correction': {
    id: 'sprint-correction',
    label: '冲刺纠偏策略',
    scoringIntent: 'prioritize highest-impact weak indicators within the time budget and expose the tradeoff against breadth',
    constraints: ['time-budget-first', 'highest-impact-first', 'breadth-tradeoff-visible'],
  fallbackSemantics: 'return low-confidence or low-resource fallback when a short corrective path cannot cover the goal',
  },
  'preference-matched': {
    id: 'preference-matched',
    label: '偏好匹配策略',
    scoringIntent: 'prioritize resource modalities and pacing patterns that match governed learner preference evidence without treating preference as mastery',
    constraints: ['preference-evidence-first', 'no-mastery-inflation', 'terminal-validation-last'],
    fallbackSemantics: 'fall back to ordinary graph-search resources when preference evidence is absent or too sparse',
  },
  'teacher-assigned': {
    id: 'teacher-assigned',
    label: '教师指定策略',
    scoringIntent: 'prioritize teacher-assigned resources while enforcing the same privacy, prerequisite, and terminal-validation constraints',
    constraints: ['teacher-assignment-required', 'preserve-privacy', 'preserve-prerequisites'],
    fallbackSemantics: 'fall back only to eligible assigned resources and surface insufficient teacher assignment coverage',
  },
};

const LEARNING_GOAL_VERSION = 'learning-goal-package/v1';
const QUALITY_EVIDENCE_LIMITATION = 'quality-rubric-evidence-not-fully-governed';
const LEARNING_GOAL_OBJECTIVE_IDS = new Set(AUTOCONTROL_KAQ_OBJECTIVES.map((objective) => objective.id));
const LEARNING_GOAL_OBJECTIVE_DOMAIN_BY_ID = new Map(AUTOCONTROL_KAQ_OBJECTIVES.map((objective) => [objective.id, objective.domain]));
const LEARNING_GOAL_GRAPH_NODE_IDS = new Set(AUTOCONTROL_KAQ_GRAPH_CATALOG.nodes.map((node) => node.id));

const AUTOCONTROL_RESOURCE_MIX: ResourceNode['type'][] = [
  'lesson_step',
  'knowledge_card',
  'textbook_section',
  'quiz',
  'adaptive_quiz',
  'control_workbench',
  'simulation',
  'arena_task',
  'reflection',
  'checkpoint',
  'ai_intervention',
  'konling',
  'video',
  'audio',
  'exercise',
];

const FOUNDATION_RESOURCE_MIX: ResourceNode['type'][] = [
  'knowledge_card',
  'textbook_section',
  'lesson_step',
  'quiz',
  'adaptive_quiz',
  'simulation',
  'checkpoint',
  'reflection',
  'konling',
  'video',
  'audio',
  'exercise',
];

function packageResourceMix(
  required: ResourceNode['type'][],
  preferred: ResourceNode['type'][],
  optional: ResourceNode['type'][] = ['reflection', 'checkpoint', 'konling'],
): LearningGoalResourceMix {
  return { required, preferred, optional };
}

function packageEvidencePolicy(
  requiredEvidenceTypes: AdaptiveLearningPathEvidenceType[],
  qualityEvidenceGoverned = false,
): LearningGoalEvidencePolicy {
  return {
    requiredEvidenceTypes,
    minimumEvidenceCount: 2,
    confidenceFloor: 0.55,
    qualityEvidenceGoverned,
    limitations: qualityEvidenceGoverned ? [] : [QUALITY_EVIDENCE_LIMITATION],
  };
}

function terminalValidationPolicy(
  required: boolean,
  acceptedEvidenceTypes: AdaptiveLearningPathEvidenceType[],
  terminalNodeTypes: ResourceNode['type'][],
  summary: string,
): LearningGoalTerminalValidationPolicy {
  return { required, acceptedEvidenceTypes, terminalNodeTypes, summary };
}

function defineLearningGoal(
  input: Omit<LearningGoalDefinition, 'status' | 'version'> & {
    status?: LearningGoalStatus;
    version?: string;
  },
): LearningGoalDefinition {
  return {
    ...input,
    status: input.status ?? 'path-ready',
    version: input.version ?? LEARNING_GOAL_VERSION,
  };
}

const CONTROL_CORRECTION_LEARNING_GOAL = defineLearningGoal({
  id: 'control-correction',
  title: '控制系统校正设计',
  description: '把时域目标、根轨迹或频域校正、仿真验证和 Arena 迁移组织为一条可执行设计路径。',
  completionMeaning: '学生能够给出有指标依据、仿真证据和迁移边界的校正方案。',
  intentType: 'controller-design',
  recommendedPhase: 'practice',
  knowledgeObjectiveIds: [
    'knowledge:autocontrol:time-domain-performance',
    'knowledge:autocontrol:root-locus',
    'knowledge:autocontrol:controller-correction',
    'knowledge:autocontrol:simulation-validation',
  ],
  capabilityObjectiveIds: [
    'capability:autocontrol:synthesize-controller-correction',
    'capability:autocontrol:validate-with-simulation-evidence',
    'capability:autocontrol:transfer-to-ship-ocean-mission',
  ],
  qualityObjectiveIds: ['quality:autocontrol:evidence-integrity', 'quality:autocontrol:system-tradeoff'],
  targetGraphNodeIds: [
    'kn:autocontrol:time-domain-performance',
    'kn:autocontrol:root-locus',
    'kn:autocontrol:controller-correction',
    'kn:autocontrol:simulation-validation',
    'cap:autocontrol:synthesize-controller-correction',
    'cap:autocontrol:validate-with-simulation-evidence',
    'cap:autocontrol:transfer-to-ship-ocean-mission',
    'qual:autocontrol:evidence-integrity',
    'qual:autocontrol:system-tradeoff',
  ],
  goalSliceId: 'control-correction',
  resourceMix: packageResourceMix(['simulation', 'arena_task'], ['control_workbench', 'simulation', 'arena_task', 'checkpoint']),
  evidencePolicy: packageEvidencePolicy(['question', 'path-execution', 'simulation-run', 'arena-official-evaluation', 'reflection']),
  terminalValidationPolicy: terminalValidationPolicy(
    true,
    ['simulation-run', 'arena-official-evaluation', 'question'],
    ['simulation', 'arena_task', 'checkpoint'],
    '以仿真回放、官方 Arena 评测或教师确认的检查点作为路径终点，验证校正方案是否满足目标。',
  ),
  pathPolicyFamily: 'simulation-driven',
  limitations: [QUALITY_EVIDENCE_LIMITATION],
});

const FREQUENCY_RESPONSE_FOUNDATIONS_LEARNING_GOAL = defineLearningGoal({
  id: 'frequency-response-foundations',
  title: '频率响应基础',
  description: '建立 Bode、Nyquist、频域响应和稳定裕度的基础判读能力。',
  completionMeaning: '学生能够用频域图线和裕度指标解释系统性能风险。',
  intentType: 'analysis',
  recommendedPhase: 'foundation',
  knowledgeObjectiveIds: ['knowledge:autocontrol:frequency-response'],
  capabilityObjectiveIds: ['capability:autocontrol:interpret-time-frequency-response'],
  qualityObjectiveIds: ['quality:autocontrol:system-tradeoff'],
  targetGraphNodeIds: [
    'kn:autocontrol:frequency-response',
    'kn:autocontrol:stability-margin',
    'cap:autocontrol:interpret-time-frequency-response',
    'qual:autocontrol:system-tradeoff',
  ],
  goalSliceId: 'control-correction',
  resourceMix: packageResourceMix(['knowledge_card'], ['knowledge_card', 'textbook_section', 'simulation', 'quiz', 'adaptive_quiz']),
  evidencePolicy: packageEvidencePolicy(['question', 'simulation-run', 'reflection']),
  terminalValidationPolicy: terminalValidationPolicy(
    false,
    ['question', 'simulation-run'],
    ['quiz', 'adaptive_quiz', 'simulation', 'checkpoint'],
    '以短测、仿真观察或检查点确认频域判读，不强制 Arena 终点。',
  ),
  pathPolicyFamily: 'foundation-remediation',
  limitations: [QUALITY_EVIDENCE_LIMITATION],
});

const FEEDBACK_LOOP_CONCEPT_LEARNING_GOAL = defineLearningGoal({
  id: 'feedback-loop-concept-foundations',
  title: '反馈与闭环结构基础',
  description: '理解反馈、误差、闭环结构和控制作用的基本关系。',
  completionMeaning: '学生能够画出闭环关系并解释反馈对误差和稳定性的作用。',
  intentType: 'concept-understanding',
  recommendedPhase: 'foundation',
  knowledgeObjectiveIds: ['knowledge:autocontrol:feedback-loop'],
  capabilityObjectiveIds: ['capability:autocontrol:model-feedback-system'],
  qualityObjectiveIds: ['quality:autocontrol:model-boundary-awareness'],
  targetGraphNodeIds: [
    'kn:autocontrol:feedback-loop',
    'cap:autocontrol:model-feedback-system',
    'qual:autocontrol:model-boundary-awareness',
  ],
  goalSliceId: 'control-correction',
  resourceMix: packageResourceMix(['knowledge_card'], ['knowledge_card', 'textbook_section', 'lesson_step', 'quiz']),
  evidencePolicy: packageEvidencePolicy(['question', 'reflection']),
  terminalValidationPolicy: terminalValidationPolicy(false, ['question'], ['quiz', 'adaptive_quiz', 'checkpoint'], '以概念题和结构解释确认闭环基础。'),
  pathPolicyFamily: 'foundation-remediation',
  limitations: [QUALITY_EVIDENCE_LIMITATION],
});

const TRANSFER_FUNCTION_MODELING_LEARNING_GOAL = defineLearningGoal({
  id: 'transfer-function-modeling-foundations',
  title: '传递函数建模基础',
  description: '从对象、输入输出和误差信号建立可分析的传递函数模型。',
  completionMeaning: '学生能够写出关键传递函数并说明模型假设。',
  intentType: 'modeling',
  recommendedPhase: 'foundation',
  knowledgeObjectiveIds: ['knowledge:autocontrol:transfer-function-model'],
  capabilityObjectiveIds: ['capability:autocontrol:model-feedback-system'],
  qualityObjectiveIds: ['quality:autocontrol:model-boundary-awareness'],
  targetGraphNodeIds: [
    'kn:autocontrol:transfer-function-model',
    'cap:autocontrol:model-feedback-system',
    'qual:autocontrol:model-boundary-awareness',
  ],
  goalSliceId: 'control-correction',
  resourceMix: packageResourceMix(['textbook_section'], ['textbook_section', 'knowledge_card', 'quiz', 'control_workbench']),
  evidencePolicy: packageEvidencePolicy(['question', 'reflection']),
  terminalValidationPolicy: terminalValidationPolicy(false, ['question'], ['quiz', 'adaptive_quiz', 'checkpoint'], '以模型表达题和假设说明确认建模基础。'),
  pathPolicyFamily: 'foundation-remediation',
  limitations: [QUALITY_EVIDENCE_LIMITATION],
});

const TIME_DOMAIN_RESPONSE_ANALYSIS_LEARNING_GOAL = defineLearningGoal({
  id: 'time-domain-response-analysis',
  title: '时域响应与性能指标分析',
  description: '把响应曲线、超调、调节时间和稳态误差转化为可验证指标。',
  completionMeaning: '学生能够从时域响应判断性能缺口并提出验证要求。',
  intentType: 'analysis',
  recommendedPhase: 'diagnosis',
  knowledgeObjectiveIds: ['knowledge:autocontrol:time-domain-performance'],
  capabilityObjectiveIds: ['capability:autocontrol:interpret-time-frequency-response'],
  qualityObjectiveIds: ['quality:autocontrol:evidence-integrity'],
  targetGraphNodeIds: [
    'kn:autocontrol:time-domain-performance',
    'cap:autocontrol:interpret-time-frequency-response',
    'qual:autocontrol:evidence-integrity',
  ],
  goalSliceId: 'control-correction',
  resourceMix: packageResourceMix(['simulation'], ['simulation', 'knowledge_card', 'quiz', 'checkpoint']),
  evidencePolicy: packageEvidencePolicy(['question', 'simulation-run', 'reflection']),
  terminalValidationPolicy: terminalValidationPolicy(false, ['question', 'simulation-run'], ['simulation', 'quiz', 'checkpoint'], '以响应判读题或仿真记录确认指标理解。'),
  pathPolicyFamily: 'simulation-driven',
  limitations: [QUALITY_EVIDENCE_LIMITATION],
});

const ROOT_LOCUS_ANALYSIS_LEARNING_GOAL = defineLearningGoal({
  id: 'root-locus-analysis-foundations',
  title: '根轨迹分析基础',
  description: '用根轨迹解释极点迁移、零点引入和动态性能变化。',
  completionMeaning: '学生能够把根轨迹变化和校正方向联系起来。',
  intentType: 'analysis',
  recommendedPhase: 'diagnosis',
  knowledgeObjectiveIds: ['knowledge:autocontrol:root-locus'],
  capabilityObjectiveIds: ['capability:autocontrol:interpret-time-frequency-response'],
  qualityObjectiveIds: ['quality:autocontrol:system-tradeoff'],
  targetGraphNodeIds: [
    'kn:autocontrol:root-locus',
    'cap:autocontrol:interpret-time-frequency-response',
    'qual:autocontrol:system-tradeoff',
  ],
  goalSliceId: 'control-correction',
  resourceMix: packageResourceMix(['knowledge_card'], ['knowledge_card', 'textbook_section', 'control_workbench', 'quiz']),
  evidencePolicy: packageEvidencePolicy(['question', 'reflection']),
  terminalValidationPolicy: terminalValidationPolicy(false, ['question'], ['quiz', 'adaptive_quiz', 'checkpoint'], '以根轨迹判读题确认分析基础。'),
  pathPolicyFamily: 'foundation-remediation',
  limitations: [QUALITY_EVIDENCE_LIMITATION],
});

const STABILITY_MARGIN_FREQUENCY_LEARNING_GOAL = defineLearningGoal({
  id: 'stability-margin-frequency-analysis',
  title: '稳定裕度与频域安全边界',
  description: '用幅值裕度、相角裕度和穿越频率表达鲁棒性风险。',
  completionMeaning: '学生能够说明频域性能提升和稳定裕度之间的工程取舍。',
  intentType: 'analysis',
  recommendedPhase: 'diagnosis',
  knowledgeObjectiveIds: ['knowledge:autocontrol:frequency-response'],
  capabilityObjectiveIds: ['capability:autocontrol:trade-off-engineering-constraints'],
  qualityObjectiveIds: ['quality:autocontrol:safety-responsibility', 'quality:autocontrol:system-tradeoff'],
  targetGraphNodeIds: [
    'kn:autocontrol:frequency-response',
    'kn:autocontrol:stability-margin',
    'cap:autocontrol:trade-off-engineering-constraints',
    'qual:autocontrol:safety-responsibility',
    'qual:autocontrol:system-tradeoff',
  ],
  goalSliceId: 'control-correction',
  resourceMix: packageResourceMix(['simulation'], ['simulation', 'textbook_section', 'quiz', 'reflection', 'checkpoint']),
  evidencePolicy: packageEvidencePolicy(['question', 'simulation-run', 'reflection']),
  terminalValidationPolicy: terminalValidationPolicy(false, ['question', 'simulation-run'], ['simulation', 'quiz', 'checkpoint'], '以裕度判读和约束说明确认安全边界。'),
  pathPolicyFamily: 'simulation-driven',
  limitations: [QUALITY_EVIDENCE_LIMITATION],
});

const SIMULATION_VALIDATION_PRACTICE_LEARNING_GOAL = defineLearningGoal({
  id: 'simulation-validation-practice',
  title: '仿真验证实践',
  description: '用可复现仿真记录验证控制方案是否满足目标和约束。',
  completionMeaning: '学生能够提交仿真证据并逐项对应原始控制目标。',
  intentType: 'simulation-validation',
  recommendedPhase: 'validation',
  knowledgeObjectiveIds: ['knowledge:autocontrol:simulation-validation'],
  capabilityObjectiveIds: ['capability:autocontrol:validate-with-simulation-evidence'],
  qualityObjectiveIds: ['quality:autocontrol:evidence-integrity'],
  targetGraphNodeIds: [
    'kn:autocontrol:simulation-validation',
    'cap:autocontrol:validate-with-simulation-evidence',
    'qual:autocontrol:evidence-integrity',
  ],
  goalSliceId: 'control-correction',
  resourceMix: packageResourceMix(['simulation'], ['simulation', 'control_workbench', 'checkpoint', 'reflection']),
  evidencePolicy: packageEvidencePolicy(['simulation-run', 'reflection']),
  terminalValidationPolicy: terminalValidationPolicy(true, ['simulation-run'], ['simulation', 'checkpoint'], '以受治理仿真记录作为路径终点。'),
  pathPolicyFamily: 'simulation-driven',
  limitations: [QUALITY_EVIDENCE_LIMITATION],
});

const SHIP_OCEAN_TRANSFER_LEARNING_GOAL = defineLearningGoal({
  id: 'ship-ocean-transfer-application',
  title: '船海场景迁移应用',
  description: '把自动控制方法迁移到船舶、MASS 或跨模型任务，并识别失配风险。',
  completionMeaning: '学生能够说明源模型和船海任务条件的共同结构、差异和补充验证需求。',
  intentType: 'transfer-application',
  recommendedPhase: 'transfer',
  knowledgeObjectiveIds: ['knowledge:autocontrol:modern-transfer', 'knowledge:autocontrol:simulation-validation'],
  capabilityObjectiveIds: ['capability:autocontrol:transfer-to-ship-ocean-mission'],
  qualityObjectiveIds: ['quality:autocontrol:ship-ocean-mission', 'quality:autocontrol:model-boundary-awareness'],
  targetGraphNodeIds: [
    'kn:autocontrol:modern-transfer',
    'kn:autocontrol:simulation-validation',
    'cap:autocontrol:transfer-to-ship-ocean-mission',
    'qual:autocontrol:ship-ocean-mission',
    'qual:autocontrol:model-boundary-awareness',
  ],
  goalSliceId: 'control-correction',
  resourceMix: packageResourceMix(['arena_task'], ['arena_task', 'simulation', 'reflection', 'ai_intervention']),
  evidencePolicy: packageEvidencePolicy(['arena-official-evaluation', 'simulation-run', 'reflection', 'agent-interaction']),
  terminalValidationPolicy: terminalValidationPolicy(true, ['arena-official-evaluation', 'simulation-run'], ['arena_task', 'simulation'], '以跨模型任务、Arena 或仿真迁移验证作为路径终点。'),
  pathPolicyFamily: 'simulation-driven',
  limitations: [QUALITY_EVIDENCE_LIMITATION],
});

export const ADAPTIVE_LEARNING_GOAL_DEFINITIONS: Record<string, AdaptiveLearningPathRegisteredGoalDefinition> = {
  'control-correction': {
    goal: {
      id: 'control-correction',
      title: '控制系统校正设计',
      knowledgeTargets: [
        'control-correction:time-domain-targets',
        'control-correction:root-locus-design',
        'control-correction:simulation-validation',
        'control-correction:arena-transfer',
      ],
      competencyTargets: ['parameterDesign', 'engineeringDecision', 'crossDomainTransfer'],
      capabilityTargets: CONTROL_CORRECTION_CAPABILITY_TARGETS,
    },
    displayName: '控制系统校正设计',
    requiresRegisteredPlugin: true,
    learningGoal: CONTROL_CORRECTION_LEARNING_GOAL,
    knowledgeTargetAliases: {
      'control-correction:time-domain-targets': [
        '性能指标_1_1',
        '动态性能指标_3_a10733c1',
        '时域指标到目标极点区域_3_36001',
        '稳态误差双路径判断_3_37002',
        '给定-扰动双通道误差分析_3_37001',
      ],
      'control-correction:root-locus-design': [
        '根轨迹_1_1',
        '根轨迹_4_c19f8854',
        '根轨迹完整法则_3_0f2e7b11',
        '根轨迹绘制规则_3_2f9e8cb3',
        '根轨迹增益换算_3_4b1d9e6c',
        '零点引入与根轨迹重排_3_35001',
        '串联校正_6_fede5751',
        '频域PD与超前整定_4_42011',
        '频域PI与滞后整定_4_42010',
        '控制器频域特性矩阵_4_42008',
      ],
      'control-correction:simulation-validation': [
        '对象化三域验证_3_56cb3a4e',
        '传统设计四联图校正_4_47004',
        '跨模型验证比较_4_47006',
        '工程指标代价函数翻译_4_47003',
        '剩余风险说明_4_45006',
      ],
      'control-correction:arena-transfer': [
        '跨模型验证比较_4_47006',
        '传统设计四联图校正_4_47004',
      ],
    },
    allowedResourceMix: [
      'lesson_step',
      'knowledge_card',
      'textbook_section',
      'quiz',
      'adaptive_quiz',
      'control_workbench',
      'simulation',
      'arena_task',
      'external_resource',
      'reflection',
      'checkpoint',
      'ai_intervention',
      'konling',
      'video',
      'audio',
      'exercise',
    ],
    starterPathPolicy: {
      policyFamilies: ['foundation-remediation', 'simulation-driven', 'preference-matched'],
      targetOptionCount: 3,
      difficultyRhythm: 'steady',
      allowExternalResources: false,
      preferredResourceTypes: ['knowledge_card', 'textbook_section', 'lesson_step', 'quiz', 'adaptive_quiz', 'control_workbench', 'simulation', 'arena_task'],
    },
    checkpointPolicy: {
      minCheckpoints: 1,
      checkpointResourceTypes: ['checkpoint', 'simulation', 'arena_task'],
      requiresTerminalValidation: true,
    },
    explanationTemplates: {
      ready: '已根据当前证据生成校正设计学习路径。',
      coldStart: '证据还少，先从入门路径开始，系统会随学习过程调整。',
      lowConfidence: '当前证据不足，先沿可执行路径学习，后续会根据新证据调整。',
      fallback: '当前只能给出保守路径建议，请先完成可用资源并补充学习证据。',
    },
  },
  'frequency-response-foundations': {
    goal: {
      id: 'frequency-response-foundations',
      title: '频率响应基础',
      knowledgeTargets: ['kn-bode'],
      competencyTargets: [],
    },
    displayName: '频率响应基础',
    learningGoal: FREQUENCY_RESPONSE_FOUNDATIONS_LEARNING_GOAL,
    knowledgeTargetAliases: {
      'kn-bode': [
        'Bode图_1_1',
        'Bode首轮骨架_5_1e07d9da',
        '频域响应_1_1',
        '频域分析_2_2e257d89',
        '正弦稳态响应_5_b6dc1100',
      ],
    },
    allowedResourceMix: [
      'knowledge_card',
      'textbook_section',
      'simulation',
      'quiz',
      'adaptive_quiz',
      'external_resource',
      'reflection',
      'checkpoint',
      'handout',
      'slides',
      'lesson_step',
      'konling',
      'video',
      'audio',
      'exercise',
    ],
    starterPathPolicy: {
      policyFamilies: ['foundation-remediation', 'simulation-driven', 'preference-matched'],
      targetOptionCount: 3,
      difficultyRhythm: 'gentle',
      allowExternalResources: false,
      preferredResourceTypes: ['knowledge_card', 'textbook_section', 'simulation', 'quiz', 'adaptive_quiz'],
    },
    checkpointPolicy: {
      minCheckpoints: 1,
      checkpointResourceTypes: ['checkpoint', 'quiz', 'adaptive_quiz', 'simulation', 'reflection', 'knowledge_card'],
      requiresTerminalValidation: false,
    },
    explanationTemplates: {
      ready: '已根据当前证据生成频率响应学习路径。',
      coldStart: '证据还少，先从入门路径开始，系统会随学习过程调整。',
      lowConfidence: '当前证据不足，先完成基础路径，系统会根据后续表现调整顺序。',
      fallback: '当前可用资源不足，请先完成基础材料并补充学习证据。',
    },
  },
  'feedback-loop-concept-foundations': {
    goal: {
      id: 'feedback-loop-concept-foundations',
      title: '反馈与闭环结构基础',
      knowledgeTargets: ['反馈_1_1'],
      competencyTargets: ['controlModeling'],
    },
    displayName: '反馈与闭环结构基础',
    learningGoal: FEEDBACK_LOOP_CONCEPT_LEARNING_GOAL,
    knowledgeTargetAliases: {
      '反馈_1_1': [
        '负反馈_1_0cffeeab',
        '闭环控制系统_1_10003',
        '反馈控制系统_1_98dc667a',
        '闭环控制_1_1',
        '负反馈控制原理_1_5a06114b',
      ],
    },
    allowedResourceMix: FOUNDATION_RESOURCE_MIX,
    starterPathPolicy: {
      policyFamilies: ['foundation-remediation', 'simulation-driven', 'preference-matched'],
      targetOptionCount: 3,
      difficultyRhythm: 'gentle',
      allowExternalResources: false,
      preferredResourceTypes: ['knowledge_card', 'textbook_section', 'lesson_step', 'quiz', 'adaptive_quiz', 'simulation', 'checkpoint'],
    },
    checkpointPolicy: {
      minCheckpoints: 1,
      checkpointResourceTypes: ['checkpoint', 'quiz', 'adaptive_quiz', 'knowledge_card'],
      requiresTerminalValidation: false,
    },
    explanationTemplates: {
      ready: '已根据当前证据生成反馈与闭环结构学习路径。',
      coldStart: '证据还少，先从闭环结构基础开始。',
      lowConfidence: '当前证据不足，先完成反馈概念与结构判断。',
      fallback: '当前可用资源不足，请先完成反馈概念材料并补充学习证据。',
    },
  },
  'transfer-function-modeling-foundations': {
    goal: {
      id: 'transfer-function-modeling-foundations',
      title: '传递函数建模基础',
      knowledgeTargets: ['传递函数_2_2c5e2589'],
      competencyTargets: ['controlModeling'],
    },
    displayName: '传递函数建模基础',
    learningGoal: TRANSFER_FUNCTION_MODELING_LEARNING_GOAL,
    knowledgeTargetAliases: {
      '传递函数_2_2c5e2589': ['建模_1_2', '零初值传递函数_2_21001'],
    },
    allowedResourceMix: FOUNDATION_RESOURCE_MIX,
    starterPathPolicy: {
      policyFamilies: ['foundation-remediation', 'preference-matched'],
      targetOptionCount: 2,
      difficultyRhythm: 'gentle',
      allowExternalResources: false,
      preferredResourceTypes: ['textbook_section', 'knowledge_card', 'quiz', 'control_workbench'],
    },
    checkpointPolicy: {
      minCheckpoints: 1,
      checkpointResourceTypes: ['checkpoint', 'quiz', 'adaptive_quiz', 'knowledge_card'],
      requiresTerminalValidation: false,
    },
    explanationTemplates: {
      ready: '已根据当前证据生成传递函数建模学习路径。',
      coldStart: '证据还少，先从模型假设和传递函数表达开始。',
      lowConfidence: '当前证据不足，先完成建模基础路径。',
      fallback: '当前可用资源不足，请先完成传递函数材料并补充学习证据。',
    },
  },
  'time-domain-response-analysis': {
    goal: {
      id: 'time-domain-response-analysis',
      title: '时域响应与性能指标分析',
      knowledgeTargets: ['动态性能指标_3_a10733c1'],
      competencyTargets: ['controlModeling', 'engineeringDecision'],
    },
    displayName: '时域响应与性能指标分析',
    learningGoal: TIME_DOMAIN_RESPONSE_ANALYSIS_LEARNING_GOAL,
    knowledgeTargetAliases: {
      '动态性能指标_3_a10733c1': ['时域分析法_3_0f0489e0', '稳态误差双路径判断_3_37002', '终值定理_3_be8fe1ad'],
    },
    allowedResourceMix: AUTOCONTROL_RESOURCE_MIX,
    starterPathPolicy: {
      policyFamilies: ['simulation-driven', 'foundation-remediation', 'preference-matched'],
      targetOptionCount: 3,
      difficultyRhythm: 'steady',
      allowExternalResources: false,
      preferredResourceTypes: ['simulation', 'knowledge_card', 'quiz', 'checkpoint'],
    },
    checkpointPolicy: {
      minCheckpoints: 1,
      checkpointResourceTypes: ['checkpoint', 'simulation', 'quiz', 'adaptive_quiz'],
      requiresTerminalValidation: false,
    },
    explanationTemplates: {
      ready: '已根据当前证据生成时域响应分析学习路径。',
      coldStart: '证据还少，先从时域指标和响应曲线开始。',
      lowConfidence: '当前证据不足，先完成时域指标基础路径。',
      fallback: '当前可用资源不足，请先完成时域响应材料并补充学习证据。',
    },
  },
  'root-locus-analysis-foundations': {
    goal: {
      id: 'root-locus-analysis-foundations',
      title: '根轨迹分析基础',
      knowledgeTargets: ['根轨迹完整法则_3_0f2e7b11'],
      competencyTargets: ['controlModeling', 'parameterDesign'],
    },
    displayName: '根轨迹分析基础',
    learningGoal: ROOT_LOCUS_ANALYSIS_LEARNING_GOAL,
    knowledgeTargetAliases: {
      '根轨迹完整法则_3_0f2e7b11': ['根轨迹法_2_e3f6c0c1', '时域指标到目标极点区域_3_36001'],
    },
    allowedResourceMix: AUTOCONTROL_RESOURCE_MIX,
    starterPathPolicy: {
      policyFamilies: ['foundation-remediation', 'simulation-driven', 'preference-matched'],
      targetOptionCount: 3,
      difficultyRhythm: 'steady',
      allowExternalResources: false,
      preferredResourceTypes: ['knowledge_card', 'textbook_section', 'control_workbench', 'quiz'],
    },
    checkpointPolicy: {
      minCheckpoints: 1,
      checkpointResourceTypes: ['checkpoint', 'quiz', 'adaptive_quiz', 'simulation'],
      requiresTerminalValidation: false,
    },
    explanationTemplates: {
      ready: '已根据当前证据生成根轨迹分析学习路径。',
      coldStart: '证据还少，先从根轨迹基础法则开始。',
      lowConfidence: '当前证据不足，先完成根轨迹判读基础路径。',
      fallback: '当前可用资源不足，请先完成根轨迹材料并补充学习证据。',
    },
  },
  'stability-margin-frequency-analysis': {
    goal: {
      id: 'stability-margin-frequency-analysis',
      title: '稳定裕度与频域安全边界',
      knowledgeTargets: ['相角裕度_5_5a74b451'],
      competencyTargets: ['engineeringDecision'],
    },
    displayName: '稳定裕度与频域安全边界',
    learningGoal: STABILITY_MARGIN_FREQUENCY_LEARNING_GOAL,
    knowledgeTargetAliases: {
      '相角裕度_5_5a74b451': ['幅值裕度_5_73af26a5', '频率特性_5_404adfdd', '截止频率_5_c7d09ff7', '穿越频率_5_c4c2b93c'],
    },
    allowedResourceMix: AUTOCONTROL_RESOURCE_MIX,
    starterPathPolicy: {
      policyFamilies: ['simulation-driven', 'foundation-remediation', 'preference-matched'],
      targetOptionCount: 3,
      difficultyRhythm: 'steady',
      allowExternalResources: false,
      preferredResourceTypes: ['simulation', 'textbook_section', 'quiz', 'reflection', 'checkpoint'],
    },
    checkpointPolicy: {
      minCheckpoints: 1,
      checkpointResourceTypes: ['checkpoint', 'simulation', 'quiz', 'adaptive_quiz', 'reflection'],
      requiresTerminalValidation: false,
    },
    explanationTemplates: {
      ready: '已根据当前证据生成稳定裕度学习路径。',
      coldStart: '证据还少，先从裕度概念和频域判读开始。',
      lowConfidence: '当前证据不足，先完成频域安全边界基础路径。',
      fallback: '当前可用资源不足，请先完成稳定裕度材料并补充学习证据。',
    },
  },
  'simulation-validation-practice': {
    goal: {
      id: 'simulation-validation-practice',
      title: '仿真验证实践',
      knowledgeTargets: ['跨模型验证比较_4_47006'],
      competencyTargets: ['engineeringDecision'],
    },
    displayName: '仿真验证实践',
    learningGoal: SIMULATION_VALIDATION_PRACTICE_LEARNING_GOAL,
    knowledgeTargetAliases: {
      '跨模型验证比较_4_47006': [
        '数据驱动控制_5_54003',
        '传统设计四联图校正_4_47004',
        '工程指标代价函数翻译_4_47003',
        '结构参数联合搜索解码_4_47005',
        '统一结构编码与解码_4_46005',
        '扰动噪声设计边界_4_47007',
        '传统控制结构局限_4_47008',
      ],
    },
    allowedResourceMix: AUTOCONTROL_RESOURCE_MIX,
    starterPathPolicy: {
      policyFamilies: ['simulation-driven', 'preference-matched'],
      targetOptionCount: 2,
      difficultyRhythm: 'challenge',
      allowExternalResources: false,
      preferredResourceTypes: ['simulation', 'control_workbench', 'checkpoint', 'reflection'],
    },
    checkpointPolicy: {
      minCheckpoints: 1,
      checkpointResourceTypes: ['checkpoint', 'simulation'],
      requiresTerminalValidation: true,
    },
    explanationTemplates: {
      ready: '已根据当前证据生成仿真验证学习路径。',
      coldStart: '证据还少，先从可复现仿真记录开始。',
      lowConfidence: '当前证据不足，先完成仿真证据采集路径。',
      fallback: '当前可用资源不足，请先完成仿真验证材料并补充学习证据。',
    },
  },
  'ship-ocean-transfer-application': {
    goal: {
      id: 'ship-ocean-transfer-application',
      title: '船海场景迁移应用',
      knowledgeTargets: ['船舶航向控制对象_2_21004'],
      competencyTargets: ['crossDomainTransfer', 'engineeringDecision'],
    },
    displayName: '船海场景迁移应用',
    learningGoal: SHIP_OCEAN_TRANSFER_LEARNING_GOAL,
    knowledgeTargetAliases: {
      '船舶航向控制对象_2_21004': [
        'MASS协同链路_5_53001',
        'MASS自动化等级责任边界_5_53008',
        '上游信息质量_5_53003',
        '执行约束反馈_5_53005',
        '控制在自主系统链路中的位置_5_53002',
        '现代控制理论_9_0b54b9a0',
        '规划参考可实现性_5_53004',
        '避碰转弯半径可行域_5_53007',
        '链路责任诊断_5_53006',
        '鲁棒控制_3_a7fa1491',
      ],
    },
    allowedResourceMix: AUTOCONTROL_RESOURCE_MIX,
    starterPathPolicy: {
      policyFamilies: ['simulation-driven', 'preference-matched', 'teacher-assigned'],
      targetOptionCount: 3,
      difficultyRhythm: 'challenge',
      allowExternalResources: false,
      preferredResourceTypes: ['arena_task', 'simulation', 'reflection', 'ai_intervention'],
    },
    checkpointPolicy: {
      minCheckpoints: 1,
      checkpointResourceTypes: ['checkpoint', 'simulation', 'arena_task', 'reflection'],
      requiresTerminalValidation: true,
    },
    explanationTemplates: {
      ready: '已根据当前证据生成船海迁移应用学习路径。',
      coldStart: '证据还少，先从船海任务条件和模型差异开始。',
      lowConfidence: '当前证据不足，先完成迁移边界识别路径。',
      fallback: '当前可用资源不足，请先完成船海迁移材料并补充学习证据。',
    },
  },
};

for (const topic of [
  { id: 'discrete-control-foundations', title: '离散控制基础', description: '理解采样保持、脉冲传递函数与单位圆稳定性，能完成基本模型和判据计算。', knowledge: 'transfer-function-model' },
  { id: 'state-space-analysis-foundations', title: '状态空间分析基础', description: '理解可控性与可观测性，能用矩阵秩区分输入作用范围和输出信息范围。', knowledge: 'modern-transfer' },
  { id: 'steady-state-control-foundations', title: '稳态精度与PI基础', description: '区分系统型别、稳态误差与积分作用，理解PI的精度收益和动态代价。', knowledge: 'controller-correction' },
  { id: 'system-modeling-process-foundations', title: '系统建模流程与适用边界', description: '明确建模目的、状态和简化假设，比较模型保真度与跨物理系统的相似条件。', knowledge: 'transfer-function-model' },
  { id: 'physical-modeling-interconnection-foundations', title: '物理系统与互连建模', description: '从受力和守恒关系建立模型，辨别串并联、负载效应及测量环节的适用条件。', knowledge: 'transfer-function-model' },
  { id: 'state-space-controllability-foundations', title: '状态空间实现与可控性', description: '建立状态表达，运用秩与模态判据分析可达性、估计误差和极点配置的条件。', knowledge: 'modern-transfer' },
  { id: 'local-linearization-foundations', title: '平衡点与局部线性化', description: '区分平衡点和一般工作点，建立小信号模型并判断局部近似的适用边界。', knowledge: 'transfer-function-model' },
  { id: 'signal-flow-foundations', title: '信号流图基础', description: '由节点方程识别输入输出、支路、前向路径和基本回路，区分路径增益与整图关系。', knowledge: 'transfer-function-model' },
  { id: 'block-diagram-modeling-foundations', title: '结构图建模与等效化简', description: '从变量方程建立结构图，保留输入位置和负载条件，验证代数化简与反馈互联。', knowledge: 'transfer-function-model' },
  { id: 'mason-gain-formula-foundations', title: '梅森公式与通路余子式', description: '逐项确定通路、回路、不接触组合与余子式，并用节点方程复核增益。', knowledge: 'transfer-function-model' },
  { id: 'feedback-structure-foundations', title: '开闭环与反馈结构', description: '区分辅助回路、参考与扰动通道，依据完整结构判断增益、误差和反馈作用。', knowledge: 'transfer-function-model' },
  { id: 'transfer-poles-zeros-foundations', title: '传递函数与零极点', description: '区分直接传递、零极点与隐藏模态，判断闭环和多变量传输关系。', knowledge: 'transfer-function-model' },
  { id: 'input-response-foundations', title: '典型输入与系统响应', description: '根据输入与初态区分脉冲、自然和卷积响应，复核时域与复频域表达。', knowledge: 'transfer-function-model' },
  { id: 'first-second-order-dynamics-foundations', title: '一二阶动态与阻尼参数', description: '识别时间常数、固有频率与阻尼比，在匹配条件下解释极点和响应变化。', knowledge: 'time-domain-performance' },
  { id: 'response-metrics-foundations', title: '响应指标与长期过程', description: '按统一口径计算峰值、上升和调节时间，区分瞬态、稳态与完整动态过程。', knowledge: 'time-domain-performance' },
  { id: 'time-domain-design-foundations', title: '时域性能与设计', description: '结合响应速度、超调与误差积分比较方案，按模型条件核验时域设计。', knowledge: 'time-domain-performance' },
  { id: 'dominant-pole-analysis-foundations', title: '高阶系统与主导极点', description: '辨析模态、极点与零点，验证高阶模型的主导极点近似。', knowledge: 'time-domain-performance' },
  { id: 'stability-concepts-foundations', title: '稳定性概念与边界', description: '区分内部、渐近与输入输出稳定，核验边界模态和增益区间。', knowledge: 'time-domain-performance' },
  { id: 'routh-relative-stability-foundations', title: '劳斯判别与近似', description: '核验劳斯特殊情形、参数区间和衰减裕量，并区分判别与降阶。', knowledge: 'time-domain-performance' },
  { id: 'optimal-control-foundations', title: '最优控制基础', description: '明确性能指标与约束，区分必要条件和最优性证明，理解动态规划与二次型控制的基本方法。', knowledge: 'modern-transfer' },
  { id: 'robust-control-foundations', title: '鲁棒控制基础', description: '明确不确定集合，核验全族稳定与性能边界，区分标称设计、鲁棒保证与采样仿真。', knowledge: 'frequency-response' },
  { id: 'nonlinear-control-foundations', title: '非线性控制基础', description: '理解逆系统、状态反馈与耗散方法，核验可逆性、内部动态和输入约束。', knowledge: 'modern-transfer' },
]) {
  const learningGoal = defineLearningGoal({
    id: topic.id, title: topic.title, description: topic.description,
    completionMeaning: '能够解释关键条件并完成卡片自检；阅读完成不直接认定知识掌握。',
    intentType: ['system-modeling-process-foundations', 'physical-modeling-interconnection-foundations', 'local-linearization-foundations', 'signal-flow-foundations', 'block-diagram-modeling-foundations'].includes(topic.id) ? 'modeling' : 'analysis', recommendedPhase: 'foundation',
    knowledgeObjectiveIds: [`knowledge:autocontrol:${topic.knowledge}`],
    capabilityObjectiveIds: ['capability:autocontrol:model-feedback-system'],
    qualityObjectiveIds: ['quality:autocontrol:model-boundary-awareness'],
    targetGraphNodeIds: [`kn:autocontrol:${topic.knowledge}`, 'cap:autocontrol:model-feedback-system', 'qual:autocontrol:model-boundary-awareness'],
    goalSliceId: 'control-correction',
    resourceMix: packageResourceMix(['knowledge_card'], ['knowledge_card', 'textbook_section', 'quiz']),
    evidencePolicy: packageEvidencePolicy(['question', 'reflection']),
    terminalValidationPolicy: terminalValidationPolicy(false, ['question'], ['quiz', 'adaptive_quiz', 'checkpoint'], '以计算与条件说明核验理解；阅读不替代测评。'),
    pathPolicyFamily: 'foundation-remediation', limitations: [QUALITY_EVIDENCE_LIMITATION],
  });
  ADAPTIVE_LEARNING_GOAL_DEFINITIONS[topic.id] = {
    goal: { id: topic.id, title: topic.title, knowledgeTargets: goalCanonicalIds(topic.id), competencyTargets: ['controlModeling'] },
    displayName: topic.title, learningGoal, allowedResourceMix: AUTOCONTROL_RESOURCE_MIX,
    starterPathPolicy: { policyFamilies: ['foundation-remediation', 'preference-matched'], targetOptionCount: 2,
      difficultyRhythm: 'gentle', allowExternalResources: false, preferredResourceTypes: ['knowledge_card', 'textbook_section', 'quiz'] },
    checkpointPolicy: { minCheckpoints: 0, checkpointResourceTypes: ['quiz', 'adaptive_quiz', 'checkpoint'], requiresTerminalValidation: false },
    explanationTemplates: { ready: `已生成${topic.title}学习路径。`, coldStart: '先阅读概念与计算例，再完成自检。',
      lowConfidence: '当前证据不足，先学习基础内容。', fallback: '可用资源不足，当前路径仅覆盖已发布内容。' },
  };
}

export function getRegisteredAdaptiveLearningPathGoal(
  goalId: string,
  registry: {
    get(goalId: string): {
      status: PersonalizationPluginStatus;
      pathPlanningPolicy?: PersonalizationPluginPathPlanningPolicy;
      sliceDefinition?: { capabilityTargets?: AdaptiveLearningCapabilityTarget[] };
    } | null | undefined;
  } = personalizationPluginRegistry,
): AdaptiveLearningPathRegisteredGoalDefinition | null {
  const original = ADAPTIVE_LEARNING_GOAL_DEFINITIONS[goalId] ?? null;
  if (!original) return null;
  const canonicalTargets = goalCanonicalIds(goalId);
  const definition = canonicalTargets.length
    ? { ...original, goal: { ...original.goal, knowledgeTargets: canonicalTargets } }
    : original;
  const plugin = registry.get(goalId);
  if (definition.requiresRegisteredPlugin) {
    if (!plugin || plugin.status !== 'active' || !plugin.pathPlanningPolicy) return null;
  }
  const policy = plugin?.status === 'active' ? plugin.pathPlanningPolicy : undefined;
  if (!policy) return definition;
  return {
    ...definition,
    displayName: policy.displayName,
    knowledgeTargetAliases: policy.knowledgeTargetAliases,
    allowedResourceMix: policy.allowedResourceMix as AdaptiveLearningPathRegisteredGoalDefinition['allowedResourceMix'],
    starterPathPolicy: {
      ...policy.starterPathPolicy,
      policyFamilies: policy.starterPathPolicy.policyFamilies as AdaptiveLearningPathRegisteredGoalDefinition['starterPathPolicy']['policyFamilies'],
      preferredResourceTypes: policy.starterPathPolicy.preferredResourceTypes as AdaptiveLearningPathRegisteredGoalDefinition['starterPathPolicy']['preferredResourceTypes'],
    },
    checkpointPolicy: {
      minCheckpoints: policy.checkpointPolicy.minCheckpoints,
      checkpointResourceTypes: policy.checkpointPolicy.checkpointResourceTypes as AdaptiveLearningPathRegisteredGoalDefinition['checkpointPolicy']['checkpointResourceTypes'],
      requiresTerminalValidation: policy.checkpointPolicy.requiresTerminalValidation,
    },
    explanationTemplates: policy.explanationTemplates,
    learningGoal: definition.learningGoal
      ? {
          ...definition.learningGoal,
          evidencePolicy: {
            ...definition.learningGoal.evidencePolicy,
            requiredEvidenceTypes: policy.evidenceRequirements.filter(
              (value): value is AdaptiveLearningPathEvidenceType => (
                value === 'question' ||
                value === 'path-execution' ||
                value === 'simulation-run' ||
                value === 'arena-official-evaluation' ||
                value === 'reflection' ||
                value === 'agent-interaction'
              ),
            ),
          },
        }
      : definition.learningGoal,
    goal: {
      ...definition.goal,
      capabilityTargets: plugin?.sliceDefinition?.capabilityTargets ?? definition.goal.capabilityTargets,
    },
  };
}

export function isRegisteredAdaptiveLearningPathGoal(goalId: string): boolean {
  return Boolean(getRegisteredAdaptiveLearningPathGoal(goalId));
}

export function getLearningGoal(goalId: string): LearningGoalDefinition | null {
  return getRegisteredAdaptiveLearningPathGoal(goalId)?.learningGoal ?? null;
}

export function listLearningGoals(): LearningGoalDefinition[] {
  return Object.keys(ADAPTIVE_LEARNING_GOAL_DEFINITIONS)
    .map((goalId) => getRegisteredAdaptiveLearningPathGoal(goalId)?.learningGoal)
    .filter((item): item is LearningGoalDefinition => Boolean(item));
}

export function validateLearningGoal(
  learningGoal: LearningGoalDefinition | null | undefined,
): LearningGoalValidationIssue[] {
  if (!learningGoal) {
    return [learningGoalIssue('missing-learning-goal', null, 'LearningGoal metadata is required.')];
  }

  const issues: LearningGoalValidationIssue[] = [];
  const learningGoalId = learningGoal.id || null;
  if (!learningGoal.title || !learningGoal.description || !learningGoal.completionMeaning) {
    issues.push(learningGoalIssue('missing-student-facing-text', learningGoalId, 'LearningGoal requires title, description, and completion meaning.'));
  }
  if (
    learningGoal.status === 'path-ready' &&
    (
      learningGoal.knowledgeObjectiveIds.length === 0 ||
      learningGoal.capabilityObjectiveIds.length === 0 ||
      learningGoal.qualityObjectiveIds.length === 0
    )
  ) {
    issues.push(learningGoalIssue('missing-objective-binding', learningGoalId, 'Path-ready LearningGoal must bind at least one K/A/Q objective id in each domain.'));
  }
  issues.push(...validateLearningGoalObjectiveIds(learningGoal, learningGoalId));
  if (learningGoal.targetGraphNodeIds.length === 0) {
    issues.push(learningGoalIssue('missing-graph-binding', learningGoalId, 'LearningGoal must expose target graph node ids.'));
  }
  for (const graphNodeId of learningGoal.targetGraphNodeIds) {
    if (!LEARNING_GOAL_GRAPH_NODE_IDS.has(graphNodeId)) {
      issues.push(learningGoalIssue('unknown-graph-node-id', learningGoalId, `Unknown K/A/Q graph node id: ${graphNodeId}.`));
    }
  }
  if (!personalizationPluginRegistry.listGoalIds().includes(learningGoal.goalSliceId)) {
    issues.push(learningGoalIssue('unknown-goal-slice-id', learningGoalId, `Unknown adaptive goal slice id: ${learningGoal.goalSliceId}.`));
  }
  if (
    learningGoal.resourceMix.required.length === 0 ||
    learningGoal.resourceMix.preferred.length === 0
  ) {
    issues.push(learningGoalIssue('missing-resource-mix', learningGoalId, 'LearningGoal must declare required and preferred resource mix.'));
  }
  if (
    learningGoal.evidencePolicy.requiredEvidenceTypes.length === 0 ||
    learningGoal.evidencePolicy.minimumEvidenceCount < 1 ||
    learningGoal.evidencePolicy.confidenceFloor <= 0
  ) {
    issues.push(learningGoalIssue('missing-evidence-policy', learningGoalId, 'LearningGoal must declare governed evidence requirements.'));
  }
  if (
    learningGoal.terminalValidationPolicy.acceptedEvidenceTypes.length === 0 ||
    learningGoal.terminalValidationPolicy.terminalNodeTypes.length === 0 ||
    !learningGoal.terminalValidationPolicy.summary
  ) {
    issues.push(learningGoalIssue('missing-terminal-validation-policy', learningGoalId, 'LearningGoal must declare terminal validation policy.'));
  }
  if (
    learningGoal.qualityObjectiveIds.length > 0 &&
    !learningGoal.evidencePolicy.qualityEvidenceGoverned &&
    learningGoal.evidencePolicy.limitations.length === 0 &&
    learningGoal.limitations.length === 0
  ) {
    issues.push(learningGoalIssue('missing-quality-limitation', learningGoalId, 'LearningGoal with non-governed quality evidence must expose a limitation.'));
  }
  if (!ADAPTIVE_LEARNING_PATH_POLICY_FAMILIES[learningGoal.pathPolicyFamily]) {
    issues.push(learningGoalIssue('missing-path-policy', learningGoalId, 'LearningGoal must use a known path policy family.'));
  }
  return issues;
}

export function validateLearningGoalCatalog(): LearningGoalValidationIssue[] {
  const issues = Object.values(ADAPTIVE_LEARNING_GOAL_DEFINITIONS).flatMap((definition) =>
    validateLearningGoal(definition.learningGoal)
  );
  const learningGoals = listLearningGoals();
  const learningGoalIds = new Set<string>();
  for (const learningGoal of learningGoals) {
    if (learningGoalIds.has(learningGoal.id)) {
      issues.push(learningGoalIssue('duplicate-learning-goal-id', learningGoal.id, 'LearningGoal ids must be unique.'));
    }
    learningGoalIds.add(learningGoal.id);
    if (!ADAPTIVE_LEARNING_GOAL_DEFINITIONS[learningGoal.id]) {
      issues.push(learningGoalIssue('learning-goal-not-registered', learningGoal.id, 'LearningGoal must be registered as an adaptive path goal id.'));
    }
  }
  const pathReadyLearningGoals = learningGoals.filter((item) => item.status === 'path-ready');
  if (pathReadyLearningGoals.length < 8) {
    issues.push(learningGoalIssue('minimum-path-ready-coverage', null, 'At least eight automatic-control LearningGoals must be path-ready.'));
  }
  const coveredIntents = new Set(pathReadyLearningGoals.map((item) => item.intentType));
  for (const requiredIntent of ['concept-understanding', 'modeling', 'analysis', 'controller-design', 'simulation-validation', 'transfer-application'] satisfies LearningGoalIntentType[]) {
    if (!coveredIntents.has(requiredIntent)) {
      issues.push(learningGoalIssue('missing-domain-coverage', null, `Path-ready LearningGoal catalog must cover ${requiredIntent}.`));
    }
  }
  return issues;
}

export type LearningGoalPackageDefinition = LearningGoalDefinition;
export type LearningGoalPackageValidationIssue = LearningGoalValidationIssue;

export function getLearningGoalPackage(goalId: string): LearningGoalDefinition | null {
  return getLearningGoal(goalId);
}

export function listLearningGoalPackages(): LearningGoalDefinition[] {
  return listLearningGoals();
}

export function validateLearningGoalPackage(
  learningGoal: LearningGoalDefinition | null | undefined,
): LearningGoalValidationIssue[] {
  return validateLearningGoal(learningGoal);
}

export function validateLearningGoalPackageCatalog(): LearningGoalValidationIssue[] {
  return validateLearningGoalCatalog();
}

function learningGoalIssue(
  code: LearningGoalValidationIssueCode,
  learningGoalId: string | null,
  message: string,
): LearningGoalValidationIssue {
  return { code, learningGoalId, message };
}

function validateLearningGoalObjectiveIds(
  learningGoal: LearningGoalDefinition,
  learningGoalId: string | null,
): LearningGoalValidationIssue[] {
  return [
    ...validateLearningGoalObjectiveDomain(learningGoal.knowledgeObjectiveIds, 'knowledge', learningGoalId),
    ...validateLearningGoalObjectiveDomain(learningGoal.capabilityObjectiveIds, 'capability', learningGoalId),
    ...validateLearningGoalObjectiveDomain(learningGoal.qualityObjectiveIds, 'quality', learningGoalId),
  ];
}

function validateLearningGoalObjectiveDomain(
  objectiveIds: string[],
  expectedDomain: 'knowledge' | 'capability' | 'quality',
  learningGoalId: string | null,
): LearningGoalValidationIssue[] {
  const issues: LearningGoalValidationIssue[] = [];
  for (const objectiveId of objectiveIds) {
    if (!LEARNING_GOAL_OBJECTIVE_IDS.has(objectiveId)) {
      issues.push(learningGoalIssue('unknown-objective-id', learningGoalId, `Unknown K/A/Q objective id: ${objectiveId}.`));
      continue;
    }
    const actualDomain = LEARNING_GOAL_OBJECTIVE_DOMAIN_BY_ID.get(objectiveId);
    if (actualDomain !== expectedDomain) {
      issues.push(learningGoalIssue('objective-domain-mismatch', learningGoalId, `Expected ${expectedDomain} objective id, received ${objectiveId}.`));
    }
  }
  return issues;
}

export function assembleAdaptiveLearningPathPlan(
  input: AdaptiveLearningPathPlannerInput,
  stageRepairedNodeIds?: readonly string[],
): AdaptiveLearningPathPlan {
  return assembleAdaptiveLearningPathPlanInternal(input, true, undefined, stageRepairedNodeIds);
}

export function buildControlCorrectionThreeStylePathBundle(
  input: Omit<AdaptiveLearningPathPlannerInput, 'policyFamily' | 'policyBundle'>,
): AdaptiveLearningPathPolicyBundle {
  const plan = assembleAdaptiveLearningPathPlan({
    ...input,
    policyFamily: 'foundation-remediation',
    policyBundle: {
      families: ['foundation-remediation', 'simulation-driven', 'preference-matched'],
      overlapThreshold: 0.6,
    },
  });
  return plan.policyBundle as AdaptiveLearningPathPolicyBundle;
}

function withCollectionBackedPlanningInput(
  input: AdaptiveLearningPathPlannerInput,
): AdaptiveLearningPathPlannerInput {
  const projection = projectColdStartCollection({
    learnerState: {
      knowledgeMasteryTags: input.learnerState?.knowledgeMastery?.tags,
      resourcePreference: input.learnerState?.resourcePreference,
      evidence: {
        confidence: input.learnerState?.evidence?.confidence,
        freshness: buildAdaptiveLearningPathLearnerStateSnapshot(input.learnerState)?.freshness,
      },
      missingEvidence: input.learnerState?.missingEvidence,
    },
    events: input.collectionEvents,
    goalId: input.goal.id,
    mode: 'new',
  });
  // #1985：下落系统默认（fallback）时，画像偏好已被运行时门槛判定不可用或未达门槛，
  // 其原始模态不得再参与排序加权；冷启动试学模态在下方另行合并，不受影响。
  const suppressedLearnerState = input.resourcePreferenceSource === 'fallback'
    ? withoutLearnerStateResourceModalities(input.learnerState)
    : input.learnerState;
  if (projection.records.length === 0) return { ...input, learnerState: suppressedLearnerState };
  const extraModalities = collectionPreferredModalities(projection.records)
    .filter((type): type is ResourceNode['type'] => input.registry.supportedTypes.includes(type as ResourceNode['type']));
  const checkpointPreference = input.checkpointPreferenceSource === 'request'
    ? input.checkpointPreference
    : collectionCheckpointPreference(projection.records) ?? input.checkpointPreference;
  const difficultyRhythm = input.difficultyRhythmSource === 'request'
    ? input.difficultyRhythm
    : collectionDifficultyRhythm(projection.records) ?? input.difficultyRhythm;
  const applyPreference = extraModalities.length > 0 && input.resourcePreferenceSource !== 'request';
  const learnerState = applyPreference
    ? {
      ...suppressedLearnerState,
      resourcePreference: {
        preferredModalities: unique([
          ...extraModalities,
          ...(suppressedLearnerState?.resourcePreference?.preferredModalities ?? []),
        ]),
        confidence: 'medium' as const,
      },
    }
    : suppressedLearnerState;
  return {
    ...input,
    learnerState,
    checkpointPreference,
    difficultyRhythm,
  };
}

function applyStageRepairedNodeOrder(
  internallyRepairedMainPathNodes: ScoredNode[],
  stageRepairedNodeIds: readonly string[] | undefined,
  insertedNodeIds: readonly string[] = [],
): ScoredNode[] {
  if (!stageRepairedNodeIds) {
    return internallyRepairedMainPathNodes;
  }
  const stageOrderIndex = new Map(stageRepairedNodeIds.map((nodeId, index) => [nodeId, index]));
  const allowedNodes = internallyRepairedMainPathNodes.filter((entry) => stageOrderIndex.has(entry.node.id));
  if (allowedNodes.length <= 1) {
    return allowedNodes;
  }

  const ids = allowedNodes.map((entry) => entry.node.id);
  const byId = new Map(allowedNodes.map((entry) => [entry.node.id, entry]));
  const predecessors = new Map(ids.map((id) => [id, new Set<string>()]));
  const addEdge = (beforeId: string, afterId: string) => {
    if (beforeId === afterId || !predecessors.has(beforeId) || !predecessors.has(afterId)) {
      return;
    }
    predecessors.get(afterId)!.add(beforeId);
  };

  for (const entry of allowedNodes) {
    for (const prerequisiteId of entry.node.planningMetadata.prerequisites) {
      addEdge(prerequisiteId, entry.node.id);
    }
    for (const fallbackId of entry.node.planningMetadata.readiness?.fallbackNodeIds ?? []) {
      addEdge(fallbackId, entry.node.id);
    }
  }

  const inserted = new Set(insertedNodeIds);
  for (let index = 0; index < allowedNodes.length; index += 1) {
    const current = allowedNodes[index]!;
    if (!inserted.has(current.node.id)) {
      continue;
    }
    const successor = allowedNodes.slice(index + 1).find((entry) => !inserted.has(entry.node.id));
    if (successor) {
      addEdge(current.node.id, successor.node.id);
    }
  }

  const remaining = new Set(ids);
  const ordered: ScoredNode[] = [];
  while (remaining.size > 0) {
    const ready = [...remaining].filter((id) =>
      [...predecessors.get(id)!].every((beforeId) => !remaining.has(beforeId)),
    );
    const pool = (ready.length > 0 ? ready : [...remaining]).sort((left, right) =>
      (stageOrderIndex.get(left) ?? 0) - (stageOrderIndex.get(right) ?? 0),
    );
    const nextId = pool[0]!;
    remaining.delete(nextId);
    ordered.push(byId.get(nextId)!);
  }
  return ordered;
}

function assembleAdaptiveLearningPathPlanInternal(
  rawInput: AdaptiveLearningPathPlannerInput,
  includePolicyBundle: boolean,
  retryContext?: PolicyFamilyRetryContext,
  stageRepairedNodeIds?: readonly string[],
): AdaptiveLearningPathPlan {
  const input = withCollectionBackedPlanningInput(rawInput);
  const now = (input.now ?? new Date()).toISOString();
  const policyFamily = input.policyFamily ?? 'rules-plus-graph-search';
  const policyMetadata = ADAPTIVE_LEARNING_PATH_POLICY_FAMILIES[policyFamily];
  const registeredGoal = getRegisteredAdaptiveLearningPathGoal(input.goal.id);
  const coursePluginUnavailable = Boolean(
    ADAPTIVE_LEARNING_GOAL_DEFINITIONS[input.goal.id]?.requiresRegisteredPlugin && !registeredGoal,
  );
  const graphContext = buildAdaptiveLearningPathGraphContext(input.graphContext, input.goal, registeredGoal);
  const deficits = inferDeficits(input.goal, input.learnerState);
  const confidence = resolvePlanConfidence(input.learnerState);
  const sourceCoverage = input.learnerState?.evidence?.sourceCoverage ?? {};
  const learnerStateSnapshot = buildAdaptiveLearningPathLearnerStateSnapshot(input.learnerState);
  const requestedCompletedNodeIds = input.constraints.completedNodeIds ?? [];
  const preferenceContext = buildPlannerPreferenceContext(input);
  const excludedNodeIds = new Set(input.excludedNodeIds ?? []);
  const diversityAvoidNodeIds = new Set(input.diversityAvoidNodeIds ?? []);
  const { eligible, blocked } = evaluateHardEligibility(input.registry.nodes, input.constraints);
  const pathEligible = eligible
    .filter((node) => !excludedNodeIds.has(node.id))
    .filter((node) => policyAllowsNode(node, policyFamily, input.constraints))
    .filter((node) => externalResourceAllowed(node, input, registeredGoal));
  const learningGoalBoundary = buildLearningGoalObjectiveBoundary(registeredGoal, graphContext);
  const learningGoalBoundaryEvaluations = learningGoalBoundary
    ? new Map(pathEligible.map((node) => [
        node.id,
        evaluateLearningGoalObjectiveBoundary(node, learningGoalBoundary, graphContext, registeredGoal, input.constraints),
      ]))
    : null;
  const candidatePathEligible = coursePluginUnavailable
    ? []
    : pathEligible
      .filter((node) => goalAllowsResourceNode(node, registeredGoal))
      .filter((node) => (node.publishedResource && (
        node.planningMetadata.goalCoverage?.some((target) => input.goal.knowledgeTargets.includes(target))
        || input.registry.engineeringOrder?.requiredNodeIds.includes(node.id)
      )) || (learningGoalBoundaryEvaluations?.get(node.id)?.allowed ?? true));
  const eligibleIds = new Set(candidatePathEligible.map((node) => node.id));
  const targetGraphNodeIds = graphContext?.targetGraphNodeIds.length
    ? graphContext.targetGraphNodeIds
    : unique([
      ...input.goal.knowledgeTargets,
      ...expandedRegisteredKnowledgeTargets(input.goal, deficits, registeredGoal),
      ...(input.goal.competencyTargets ?? []),
    ]);
  const sarCandidates = evaluateSarCandidates({
    input,
    pathEligible: candidatePathEligible,
    graphContext,
    deficits,
    registeredGoal,
    completedNodeIds: requestedCompletedNodeIds,
  });
  const rankerResult = rankResourceLearnerCandidates({
    candidates: candidatePathEligible.map((node) => {
      const planningUnit = planningUnitForNode(node);
      return {
        node,
        planningUnit,
        matchedGraphRefs: planningUnit && graphContext
          ? graphMatchedRefsForRanker(planningUnit, graphContext)
          : undefined,
        limitations: planningUnit?.governanceLimitations.map((limitation) => limitation.code) ?? [],
      };
    }),
    scene: 'path',
    targetGraphNodeIds,
    selectedGraphNodeIds: graphContext?.selectedGraphNodeIds ?? [],
    learnerState: preferenceContext.usesExplicitResourcePreferences
      ? withoutLearnerStateResourceModalities(input.learnerState)
      : input.learnerState,
    preferredResourceTypes: input.resourcePreferences,
    difficultyRhythm: preferenceContext.difficultyRhythm,
    timeBudgetMinutes: input.constraints.timeBudgetMinutes,
    completedNodeIds: input.constraints.completedNodeIds ?? [],
    availableOutcomeRefs: input.constraints.availableOutcomeRefs ?? [],
    teacherAssignedNodeIds: input.constraints.teacherAssignedNodeIds ?? [],
    registry: input.registry,
  });
  const rankerByNodeId = new Map(rankerResult.ranked.map((entry) => [entry.node.id, entry.explanation]));
  const scored = candidatePathEligible
    .filter((node) =>
      nodeMatchesGoal(node, input.goal, deficits, graphContext) ||
      (input.constraints.requireRiskIntervention && isRiskInterventionNode(node))
    )
    .map((node) => {
      const scoredNode = scoreNode(node, deficits, input.learnerState, input.constraints, policyFamily, preferenceContext);
      const resourceRanker = rankerByNodeId.get(node.id);
      const baseScore = resourceRanker
        ? round(scoredNode.score + resourceRanker.score, 3)
        : scoredNode.score;
      const score = diversityAvoidNodeIds.has(node.id)
        ? round(baseScore - 100, 3)
        : baseScore;
      return {
        ...scoredNode,
        score,
        resourceRanker,
        reasonCodes: unique([
          ...scoredNode.reasonCodes,
          ...(diversityAvoidNodeIds.has(node.id) ? ['policy-bundle-diversity-avoidance'] : []),
          ...(sarCandidates?.acceptedNodeIds.has(node.id) ? ['sar-associated-candidate'] : []),
          ...(resourceRanker?.featureContributions
            .filter((contribution) => contribution.value > 0)
            .map((contribution) => `ranker:${contribution.feature}`) ?? []),
          ...(learningGoalBoundaryEvaluations?.get(node.id)?.matchedRefs.length
            ? ['learning-goal-objective-boundary']
            : []),
        ]),
      };
    })
    .filter((entry) => !isRetryExcludedCoreCandidate(entry.node, retryContext))
    .sort((left, right) =>
      configurationSelectionPriority(right.node, preferenceContext, input.constraints) -
        configurationSelectionPriority(left.node, preferenceContext, input.constraints) ||
      right.score - left.score ||
      left.node.id.localeCompare(right.node.id)
    );
  const mainPathNodes = buildFeasiblePath(
    scored,
    input.registry,
    input.constraints,
    input.goal,
    graphContext,
    eligibleIds,
    requestedCompletedNodeIds,
  );
  const coveredGraphTargets = graphContext ? graphTargetsCoveredByScoredNodes(scored, graphContext) : [];
  const hasGraphCandidateCoverage = coveredGraphTargets.length > 0;
  const repairCoverageGraphContext = hasGraphCandidateCoverage ? graphContext : undefined;
  const repairEntries = expandRepairCandidateEntries(
    uniqueScoredEntries([...mainPathNodes, ...scored]),
    input.registry,
    eligibleIds,
    requestedCompletedNodeIds,
    input.constraints,
    input.learnerState,
  );
  const requiredPrerequisiteNodeIds = new Set(repairEntries.flatMap((entry) =>
    planningUnitForNode(entry.node)?.prerequisites ?? []
  ));
  const retryRepairEntries = repairEntries.filter((entry) =>
    !isRetryExcludedCoreCandidate(entry.node, retryContext) ||
    requiredPrerequisiteNodeIds.has(entry.node.id)
  );
  const checkpointResourceTypes = new Set<ResourceNode['type']>(
    registeredGoal?.checkpointPolicy.checkpointResourceTypes ?? []
  );
  const forcedCheckpointNodeIds = new Set(
    selectRepairCheckpointNodeIds(mainPathNodes, registeredGoal)
  );
  const repairCandidates = retryRepairEntries.map((entry) =>
    toRepairCandidate(
      entry,
      requestedCompletedNodeIds,
      input.constraints,
      input.learnerState,
      checkpointResourceTypes,
      forcedCheckpointNodeIds,
      goalTargetsCoveredByNodes([entry.node], input.goal, repairCoverageGraphContext),
    )
  );
  const constraintRepair = deterministicPathConstraintRepairAdapter.repair({
    draftNodeIds: mainPathNodes.map((entry) => entry.node.id),
    candidates: repairCandidates,
    constraints: {
      timeBudgetMinutes: input.constraints.timeBudgetMinutes,
      requiredCheckpointCount: requiredCheckpointCountForPreference(registeredGoal, preferenceContext),
      terminalValidationRequired: requiresTerminalValidation(input.goal),
      requiredCoverageTargetIds: goalTargetsCoveredByNodes(
        mainPathNodes.map((entry) => entry.node),
        input.goal,
        repairCoverageGraphContext,
      ),
    },
    versionRefs: {
      ...graphContext?.versionRefs,
      plannerVersion: 'adaptive-learning-path-planner.v1',
      repairVersion: PATH_CONSTRAINT_REPAIR_VERSION,
    },
  });
  const scoredByNodeId = new Map(retryRepairEntries.map((entry) => [entry.node.id, entry]));
  const repairedEntries = constraintRepair.repairedNodeIds
    .map((nodeId) => scoredByNodeId.get(nodeId))
    .filter((entry): entry is ScoredNode => Boolean(entry));
  const internallyRepairedMainPathNodes = repairedEntries.length > 0 ? repairedEntries : mainPathNodes;
  const repairedMainPathNodes = applyStageRepairedNodeOrder(
    internallyRepairedMainPathNodes,
    stageRepairedNodeIds,
    constraintRepair.insertedNodeIds,
  );
  const originalFallbackReasons = constraintRepair.status === 'infeasible'
    ? buildFallbackReasons({
        learnerState: input.learnerState,
        deficits,
        eligible,
        mainPathNodes,
        constraints: input.constraints,
        goal: input.goal,
        graphContext,
        hasGraphCandidateCoverage,
        attemptedCandidates: scored.length,
        policyFamily,
      })
    : [];
  const fallbackReasons = buildFallbackReasons({
    learnerState: input.learnerState,
    deficits,
    eligible,
    mainPathNodes: repairedMainPathNodes,
    constraints: input.constraints,
    goal: input.goal,
    graphContext,
    hasGraphCandidateCoverage,
    attemptedCandidates: scored.length,
    policyFamily,
  });
  fallbackReasons.push(...originalFallbackReasons.filter((reason) => isPathBlockingFallbackReason(reason)));
  fallbackReasons.push(...constraintRepair.infeasibleReasons.map((reason) => reason.code));
  if (coursePluginUnavailable) {
    fallbackReasons.push('course-plugin-unavailable');
  }
  const uniqueFallbackReasons = unique(fallbackReasons);
  const status: AdaptiveLearningPathStatus = uniqueFallbackReasons.length > 0 ? 'fallback' : 'ready';
  const hasPartialGraphStarter = repairedMainPathNodes.length > 0 && uniqueFallbackReasons.includes('graph-target-coverage-partial');
  const hasBlockingFallback = uniqueFallbackReasons.some((reason) =>
    isPathBlockingFallbackReason(reason) &&
    !(hasPartialGraphStarter && reason === 'terminal-validation-resource-missing')
  );
  const plannedEntries = hasBlockingFallback ? [] : repairedMainPathNodes;
  const mainPathNodeIds = new Set(plannedEntries.map((entry) => entry.node.id));
  const completedNodeIds = requestedCompletedNodeIds.filter((nodeId) => mainPathNodeIds.has(nodeId));
  const planningCompletedNodeIds = requestedCompletedNodeIds.filter((nodeId) => eligibleIds.has(nodeId));
  const readinessByNodeId = new Map(plannedEntries.map((entry) => [
    entry.node.id,
    evaluateNodeReadiness(entry.node, input.learnerState, input.constraints, completedNodeIds),
  ]));
  let currentNodeId = plannedEntries.length > 0
    ? firstReadyCurrentNodeId(
      plannedEntries.map((entry) => entry.node.id),
      completedNodeIds,
      (nodeId) => (readinessByNodeId.get(nodeId)?.state ?? 'ready') === 'ready',
      input.constraints.currentNodeId,
    )
    : null;
  let mainPath = plannedEntries.length > 0
    ? plannedEntries.map((entry) => toPlanNode(entry, currentNodeId, completedNodeIds, readinessByNodeId.get(entry.node.id)!))
    : [];
  const itemTypeTerminalValidation = resolveItemTypeTerminalValidation({
    learningGoalId: input.goal.id,
  });
  const acceptsQuestionTerminal = Boolean(
    registeredGoal?.learningGoal?.terminalValidationPolicy.terminalNodeTypes.some((type) => (
      type === 'quiz' || type === 'adaptive_quiz'
    )),
  );
  const itemTypeTerminalValidationNode = acceptsQuestionTerminal && mainPath.length > 0
    ? toItemTypeTerminalValidationPlanNode(itemTypeTerminalValidation, mainPath, input.goal.id)
    : null;
  if (itemTypeTerminalValidationNode) {
    mainPath = [...mainPath, itemTypeTerminalValidationNode];
    if (!currentNodeId) currentNodeId = itemTypeTerminalValidationNode.nodeId;
  }
  const alternatives = buildAlternatives(
    scored,
    mainPath,
    blocked,
    input.registry,
    eligibleIds,
    input.goal,
    graphContext,
    input.constraints,
    planningCompletedNodeIds,
  );
  const score = buildPlanScore(mainPath, alternatives, input.learnerState, input.constraints);
  const explanations: AdaptiveLearningPathExplanation = {
    selectedReasons: mainPath.flatMap((node) => node.reasonCodes),
    rejectedAlternatives: alternatives.filter((item) => item.blocked || !mainPath.some((node) => node.nodeId === item.nodeId)),
    fallbackReasons: uniqueFallbackReasons,
    configurationFulfillment: buildConfigurationFulfillment(input, mainPath, uniqueFallbackReasons),
    associativeRetrieval: sarCandidates
      ? buildAssociativeRetrievalBasis(sarCandidates, mainPath)
      : undefined,
    itemTypeTerminalValidation,
  };
  const policyBundleRequest = resolvePolicyBundleRequest(input, confidence, registeredGoal);
  const capabilityTargets = resolveCapabilityTargets(input.goal, registeredGoal);
  const goal = attachLearningGoal(input.goal, registeredGoal);
  const sourcePackEvidence = buildPathPlanningSourcePackEvidence(input, mainPath, goal);
  const graphContextWithBoundaryDiagnostics = graphContext && learningGoalBoundary
    ? {
        ...graphContext,
        objectiveBoundaryDiagnostics: buildLearningGoalObjectiveBoundaryDiagnostics({
          boundary: learningGoalBoundary,
          evaluations: learningGoalBoundaryEvaluations ?? new Map(),
          mainPath,
          fallbackReasons: uniqueFallbackReasons,
        }),
      }
    : graphContext;

  return {
    id: `adaptive-path:${input.studentId}:${input.goal.id}`,
    userId: input.studentId,
    goal,
    stage: 'stage-1-rules-graph',
    policyFamily,
    policyMetadata,
    policyBundle: includePolicyBundle ? buildPolicyBundle({
      ...input,
      policyBundle: policyBundleRequest,
    }, now, stageRepairedNodeIds) : undefined,
    excludedPolicyFamilies: EXCLUDED_POLICY_FAMILIES,
    status,
    currentNodeId,
    mainPath,
    alternatives,
    score,
    confidence,
    explanations,
    executionStatus: {
      adopted: false,
      completedNodeIds,
      activeNodeId: currentNodeId,
      updatedAt: now,
    },
    deviations: [],
    corrections: [],
    feedbackEvents: [],
    visualization: buildVisualization({
      mainPath,
      alternatives,
      blocked,
      currentNodeId,
      completedNodeIds,
      deficits,
      capabilityTargets,
      learnerState: input.learnerState,
      sourceCoverage,
      confidence,
      learnerStateSnapshot,
      status,
      hasUsablePath: mainPath.length > 0,
      sourcePackEvidence,
      candidatePoolDiagnostics: input.candidatePoolDiagnostics,
      associativeRetrieval: explanations.associativeRetrieval,
      generatedAt: now,
    }),
    graphContext: graphContextWithBoundaryDiagnostics,
    constraintRepair,
  };
}

export function recordLearningPathFeedback(
  plan: AdaptiveLearningPathPlan,
  event: AdaptiveLearningPathFeedbackEvent,
): AdaptiveLearningPathPlan {
  const visibleNodeIds = new Set([
    ...plan.mainPath.map((node) => node.nodeId),
    ...plan.alternatives.map((node) => node.nodeId),
    ...plan.alternatives.flatMap((node) => node.nodeIds),
  ]);
  const safeEvent = event.nodeId && !visibleNodeIds.has(event.nodeId)
    ? { ...event, nodeId: null }
    : event;
  const feedbackEvents = [...plan.feedbackEvents, safeEvent];
  const deviations = [...plan.deviations];
  const corrections = [...plan.corrections];
  let executionStatus = plan.executionStatus;
  let currentNodeId = plan.currentNodeId;
  let mainPath = plan.mainPath;
  let visualization = plan.visualization;
  let policyBundle = plan.policyBundle;

  if (safeEvent.type === 'adoption') {
    executionStatus = { ...executionStatus, adopted: true, updatedAt: safeEvent.createdAt };
  }
  if (safeEvent.type === 'completion' && safeEvent.nodeId && plan.mainPath.some((node) => node.nodeId === safeEvent.nodeId)) {
    const completedNodeIds = unique([...executionStatus.completedNodeIds, safeEvent.nodeId]);
    const refreshedPath = refreshPathReadinessAfterFeedback(mainPath, completedNodeIds, safeEvent.context);
    const readyById = new Map(refreshedPath.map((node) => [node.nodeId, (node.readiness?.state ?? 'ready') === 'ready']));
    currentNodeId = firstReadyCurrentNodeId(
      refreshedPath.map((node) => node.nodeId),
      completedNodeIds,
      (nodeId) => readyById.get(nodeId) ?? true,
    );
    mainPath = refreshedPath.map((node) => ({
      ...node,
      status: completedNodeIds.includes(node.nodeId)
        ? 'completed'
        : node.nodeId === currentNodeId
          ? 'current'
          : node.readiness && node.readiness.state !== 'ready' ? 'locked' : 'next',
    }));
    const riskNodeIds = visualization.map.riskNodeIds.length > 0 && currentNodeId ? [currentNodeId] : [];
    visualization = {
      ...visualization,
      map: {
        ...visualization.map,
        currentNodeId,
        completedNodeIds,
        riskNodeIds,
        branchPaths: visualization.map.branchPaths.map((branch) => ({
          ...branch,
          fromNodeId: currentNodeId ?? 'start',
        })),
      },
      timeline: buildTimelinePayload(mainPath, visualization.timeline.generatedAt),
      evidence: {
        ...visualization.evidence,
        learnerStateDeficits: visualization.evidence?.learnerStateDeficits ?? [],
        prerequisiteReasons: mainPath
          .filter((node) => node.prerequisiteNodeIds.length > 0)
          .map((node) => ({ nodeId: node.nodeId, prerequisiteNodeIds: node.prerequisiteNodeIds })),
        teacherPolicy: mainPath.map((node) => ({ nodeId: node.nodeId, policy: node.teacherPolicy })),
      },
    };
    executionStatus = {
      ...executionStatus,
      completedNodeIds,
      activeNodeId: currentNodeId,
      updatedAt: safeEvent.createdAt,
    };
    policyBundle = refreshPolicyBundlePathStates(policyBundle, mainPath);
  }
  if (safeEvent.type === 'deviation') {
    const correctionId = `${plan.id}:correction:${corrections.length + 1}`;
    deviations.push({
      id: `${plan.id}:deviation:${deviations.length + 1}`,
      nodeId: safeEvent.nodeId,
      createdAt: safeEvent.createdAt,
      context: safeEvent.context ?? {},
      correctionPathId: correctionId,
    });
    corrections.push({
      id: correctionId,
      priorEvidencePlanId: plan.id,
      nodeIds: plan.alternatives.find((item) => !item.blocked && item.nodeIds.length > 0)?.nodeIds ?? [],
      reasonCodes: ['student-deviation', 'preserve-evidence-chain'],
    });
  }

  return {
    ...plan,
    currentNodeId,
    mainPath,
    executionStatus,
    deviations,
    corrections,
    feedbackEvents,
    visualization,
    policyBundle,
  };
}

export function serializeLearningPathPlan(plan: AdaptiveLearningPathPlan): AdaptiveLearningPathPersistenceRecord {
  const studentFacing = buildStudentFacingPathExplanation(plan);
  const registeredGoal = getRegisteredAdaptiveLearningPathGoal(plan.goal.id);
  const learningGoal = plan.goal.learningGoal ?? registeredGoal?.learningGoal;
  const graphContext = serializeGraphContextSummary(plan.graphContext);
  return {
    id: plan.id,
    userId: plan.userId,
    title: plan.goal.title,
    description: studentFacing.summary,
    estimatedTime: remainingEstimatedMinutes(plan.mainPath),
    nodeIds: plan.mainPath.map((node) => node.nodeId),
    isAiGenerated: false,
    payload: {
      status: plan.status,
      learningGoal,
      policyFamily: plan.policyFamily,
      policyMetadata: plan.policyMetadata,
      policyBundle: plan.policyBundle,
      pathOptions: buildSerializablePathOptions(plan),
      currentNodeId: plan.currentNodeId,
      score: plan.score,
      confidence: plan.confidence,
      planNodes: plan.mainPath,
      alternatives: plan.alternatives,
      explanations: plan.explanations,
      executionStatus: plan.executionStatus,
      deviations: plan.deviations,
      corrections: plan.corrections,
      feedbackEvents: plan.feedbackEvents,
      visualization: plan.visualization,
      graphContext,
      constraintRepair: plan.constraintRepair,
      artifactVersioning: buildKaqVersionedArtifactMetadata({
        artifactId: plan.id,
        artifactKind: 'path-artifact',
        generatedAt: plan.executionStatus.updatedAt,
        versionRefs: {
          ...plan.graphContext?.versionRefs,
          learningGoalPackageVersion: learningGoal?.version ?? null,
        },
        requiredRefs: [
          'learningGoalPackageVersion',
          'graphCatalogVersion',
          'resourceRegistryVersion',
          'resourceProjectionVersion',
          'plannerVersion',
        ],
      }),
      studentFacing,
    },
  };
}

function buildAdaptivePathStrategyMetadata(
  family: AdaptiveLearningPathPolicyFamily,
  portraitUnavailable: boolean,
  deficitTargetIds: string[],
): AdaptivePathStrategyMetadata {
  const mapped = ADAPTIVE_PATH_STRATEGY_BY_FAMILY[family];
  if (!mapped) {
    return { family, strategyId: family, name: family, portraitBasis: [], generic: true };
  }
  return {
    family,
    strategyId: mapped.strategyId,
    name: mapped.name,
    portraitBasis: portraitUnavailable ? [] : deficitTargetIds,
    generic: portraitUnavailable,
  };
}

export function buildSerializablePathOptions(plan: AdaptiveLearningPathPlan): AdaptiveLearningPathSerializablePathOption[] {
  if (plan.policyBundle?.paths.length) {
    const planNodeById = new Map(plan.mainPath.map((node) => [node.nodeId, node]));
    const portraitUnavailable = plan.visualization?.evidence?.learnerStateDeficits?.some((deficit) => deficit.reasonCode === 'portrait-unavailable') === true;
    const deficits = (plan.visualization?.evidence?.learnerStateDeficits ?? [])
      .map((deficit) => deficit.targetId)
      .filter((targetId): targetId is string => typeof targetId === 'string')
      .slice(0, 2);
    return plan.policyBundle.paths.map((path, index) => ({
      optionId: `path-option-${index + 1}`,
      ...path,
      // #2033 复审修复：保留 buildFamilyStrategyObservation 已按族计算的画像依据，
      // 仅在路径未携带策略观察时回退到统一 deficit 推断。
      strategy: path.strategy ?? buildAdaptivePathStrategyMetadata(path.policyFamily, portraitUnavailable, deficits),
      planNodes: Array.isArray(path.planNodes) && path.planNodes.length > 0
        ? path.planNodes
        : path.nodeIds.map((nodeId) => planNodeById.get(nodeId)).filter(Boolean),
    }));
  }
  if (plan.mainPath.length === 0) return [];
  const estimatedMinutes = remainingEstimatedMinutes(plan.mainPath);
  const terminalValidationNodeIds = pathTerminalValidationNodeIds(plan.mainPath);
  const resourceMix = buildModalityMix(plan.mainPath);
  const targetDeficits = deficitsForPath(
    plan.mainPath,
    plan.visualization?.evidence?.learnerStateDeficits ?? [],
  );
  return [{
    optionId: 'path-option-1',
    styleId: 'recommended',
    policyFamily: plan.policyFamily,
    label: '推荐学习路径',
    nodeIds: plan.mainPath.map((node) => node.nodeId),
    activeNodeIds: activePolicyNodeIds(plan.mainPath),
    lockedNodeIds: lockedPolicyNodeIds(plan.mainPath),
    readinessSummary: policyReadinessSummary(plan.mainPath),
    unlockMessages: policyUnlockMessages(plan.mainPath),
    planNodes: plan.mainPath,
    nodeSummaries: plan.mainPath.map(toPathOptionNodeSummary),
    targetDeficits,
    recommendationProvenance: buildAdaptivePathRecommendationProvenance({
      path: plan.mainPath,
      deficits: targetDeficits,
      confidence: plan.confidence.level,
      learnerStateSnapshot: plan.visualization?.evidence?.learnerStateSnapshot,
    }),
    evidenceBasis: plan.confidence.level === 'low'
      ? ['learner-evidence-low-confidence']
      : ['adaptive-learner-state'],
    estimatedMinutes,
    modalityMix: resourceMix,
    resourceMix,
    overlap: { maxWithOtherOptions: 0 },
    effort: {
      estimatedMinutes,
      relative: effortLabel(estimatedMinutes, Math.max(estimatedMinutes, 1)),
    },
    expectedTargetLift: round(plan.score.objectives.learningGain, 3),
    terminalValidationNodeIds,
    terminalValidationStrategy: buildTerminalValidationStrategy(
      plan.mainPath,
      terminalValidationNodeIds,
      terminalValidationNodeIds.length > 0,
    ),
    checkpointNodeIds: terminalValidationNodeIds,
    limitations: unique([
      ...(plan.status === 'fallback' ? plan.explanations.fallbackReasons : []),
      ...buildPathOptionLimitations(
        plan,
        plan.mainPath,
        terminalValidationNodeIds,
        targetDeficits,
        terminalValidationNodeIds.length > 0,
      ),
    ]),
  }];
}

function serializeGraphContextSummary(
  graphContext: AdaptiveLearningPathGraphContextSummary | undefined,
): AdaptiveLearningPathPersistenceRecord['payload']['graphContext'] {
  if (!graphContext) return undefined;
  const {
    resourceCoveragePathEligibleResourceIds: _internalPathEligibleResourceIds,
    objectiveBoundaryDiagnostics,
    ...serialized
  } = graphContext;
  return {
    ...serialized,
    ...(objectiveBoundaryDiagnostics
      ? {
          objectiveBoundaryDiagnostics: {
            ...objectiveBoundaryDiagnostics,
            selectedResourceMatches: [],
          },
        }
      : {}),
  };
}

export function normalizeLearningPathPayloadLearningGoal(
  payload: AdaptiveLearningPathPersistenceRecord['payload'] | null | undefined,
  goalId?: string | null,
): LearningGoalDefinition | null {
  const registeredLearningGoal = goalId ? getLearningGoal(goalId) : null;
  if (registeredLearningGoal) return registeredLearningGoal;
  return payload?.learningGoal ?? payload?.learningGoalPackage ?? null;
}

function inferDeficits(
  goal: AdaptiveLearningPathGoal,
  learnerState: AdaptiveLearningPathLearnerState | null,
): AdaptiveLearningPathDeficit[] {
  const knowledgeTags = learnerState?.knowledgeMastery?.tags ?? {};
  return [
    ...goal.knowledgeTargets
      .map((targetId) => {
        const mastery = knowledgeTags[targetId];
        const value = mastery?.posteriorMastery ?? 0;
        return {
          targetId,
          kind: 'knowledge' as const,
          value,
          confidence: mastery?.confidence ?? 0,
          evidenceCount: mastery?.evidenceCount ?? 0,
          reasonCode: value < 0.75 ? 'knowledge-deficit' : 'knowledge-maintenance',
          eventReferences: eventReferencesForDeficit(mastery?.eventReferences),
        };
      })
      .filter((item) => item.value < 0.85),
    ...(goal.competencyTargets ?? [])
      .map((targetId) => {
        const portraitDimensionIds = portraitDimensionIdsForTarget(targetId);
        const portraitScores = usablePortraitDimensionsForTarget(learnerState, targetId);
        if (portraitScores.length === 0) {
          return {
            targetId,
            kind: 'competency' as const,
            value: 0,
            confidence: 0,
            evidenceCount: 0,
            reasonCode: 'competency-no-portrait-evidence',
            portraitDimensionIds,
            eventReferences: eventReferencesForDeficit(undefined),
          };
        }
        const value = normalizeCompetencyScore(portraitScores.reduce((sum, dimension) => sum + dimension.score, 0) / portraitScores.length);
        const confidence = portraitScores.reduce((sum, dimension) => sum + dimension.confidence, 0) / portraitScores.length;
        const evidenceCount = Math.max(...portraitScores.map((dimension) => dimension.evidenceSummary.totalCount));
        return {
          targetId,
          kind: 'competency' as const,
          value,
          confidence,
          evidenceCount,
          reasonCode: value < 0.7 ? 'competency-deficit' : 'competency-maintenance',
          portraitDimensionIds,
          eventReferences: eventReferencesForDeficit(undefined),
        };
      })
      .filter((item) => item.reasonCode === 'competency-no-portrait-evidence' || item.value < 0.85),
  ];
}

function eventReferencesForDeficit(
  references: StudentSafeEvidenceEventReference[] | undefined,
): StudentSafeEvidenceEventReference[] {
  const seen = new Set<string>();
  return [...(references ?? [])]
    .sort((left, right) => right.occurredAt.localeCompare(left.occurredAt))
    .filter((reference) => {
      const key = `${reference.sourceScope}|${reference.occurredAt}|${reference.nextAction.href}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 3);
}

function resolveCapabilityTargets(
  goal: AdaptiveLearningPathGoal,
  registeredGoal: AdaptiveLearningPathRegisteredGoalDefinition | null,
): AdaptiveLearningCapabilityTarget[] {
  return goal.capabilityTargets ?? registeredGoal?.goal.capabilityTargets ?? [];
}

function attachLearningGoal(
  goal: AdaptiveLearningPathGoal,
  registeredGoal: AdaptiveLearningPathRegisteredGoalDefinition | null,
): AdaptiveLearningPathGoal {
  const { learningGoal: _clientLearningGoal, learningGoalPackage: _legacyLearningGoalPackage, ...safeGoal } = goal;
  const learningGoal = registeredGoal?.learningGoal;
  return learningGoal ? { ...safeGoal, learningGoal } : safeGoal;
}

function buildAdaptiveLearningPathGraphContext(
  input: AdaptiveLearningPathGraphContextInput | undefined,
  goal: AdaptiveLearningPathGoal,
  registeredGoal: AdaptiveLearningPathRegisteredGoalDefinition | null,
): AdaptiveLearningPathGraphContextSummary | undefined {
  if (!input) return undefined;
  if (input.learningGoalId !== goal.id) return undefined;
  if (input.expandedSubgraph.learningGoalId !== input.learningGoalId) return undefined;
  if (input.expandedSubgraph.learningGoalVersion !== input.learningGoalVersion) return undefined;
  if (registeredGoal?.learningGoal?.version && input.learningGoalVersion !== registeredGoal.learningGoal.version) return undefined;
  const graphNodeIds = input.expandedSubgraph.graphNodeIds;
  const targetGraphNodeIds = unique([
    ...input.expandedSubgraph.fixtures.planner.targetGraphNodeIds,
    ...graphNodeIds.knowledge,
    ...graphNodeIds.capability,
    ...graphNodeIds.quality,
    ...(registeredGoal?.learningGoal?.targetGraphNodeIds ?? []),
    ...input.expandedSubgraph.prerequisitePolicy
      .filter((entry) => entry.required && (
        entry.semantics === 'hard_prerequisite' ||
        entry.semantics === 'co_requisite'
      ))
      .flatMap((entry) => [entry.sourceNodeId, entry.targetNodeId]),
  ]);
  const selectedGraphNodeIds = unique((input.selectedGraphNodeIds ?? [])
    .filter((nodeId) => targetGraphNodeIds.includes(nodeId)));
  const resourceCoverageStatus = Object.fromEntries(
    Object.entries(input.resourceCoverage ?? {}).map(([nodeId, coverage]) => [
      nodeId,
      {
        coverageState: coverage.coverageState,
        linkedResourceCount: coverage.linkedResourceCount,
        pathEligibleResourceCount: coverage.pathEligibleResourceCount,
      },
    ]),
  );
  const resourceCoveragePathEligibleResourceIds = Object.fromEntries(
    Object.entries(input.resourceCoverage ?? {}).map(([nodeId, coverage]) => [
      nodeId,
      coverage.pathEligibleResourceIds,
    ]),
  );
  const versionRefs = buildKaqArtifactVersionRefs({
    ...input.versionRefs,
    learningGoalPackageVersion: input.learningGoalVersion,
    graphCatalogVersion: input.expandedSubgraph.graphVersion,
  });
  return {
    learningGoalId: input.learningGoalId,
    learningGoalVersion: input.learningGoalVersion,
    graphVersion: input.expandedSubgraph.graphVersion,
    objectiveBoundary: input.objectiveBoundary,
    targetGraphNodeIds,
    selectedGraphNodeIds,
    prerequisitePolicy: input.expandedSubgraph.prerequisitePolicy.map((entry) => ({
      edgeId: entry.edgeId,
      sourceNodeId: entry.sourceNodeId,
      targetNodeId: entry.targetNodeId,
      semantics: entry.semantics,
      required: entry.required,
    })),
    overlayStatus: {
      learner: input.learnerOverlay?.status ?? 'missing',
      class: input.classOverlay?.status ?? 'missing',
    },
    resourceCoverageStatus,
    resourceCoveragePathEligibleResourceIds,
    ...(input.learningGoalBaseline ? { learningGoalBaseline: input.learningGoalBaseline } : {}),
    ...(input.assessmentCoverage ? { assessmentCoverage: input.assessmentCoverage } : {}),
    versionRefs,
    limitations: buildGraphContextLimitations(input),
  };
}

function buildGraphContextLimitations(
  input: AdaptiveLearningPathGraphContextInput,
): AdaptiveLearningPathGraphLimitation[] {
  const limitations: AdaptiveLearningPathGraphLimitation[] = [
    ...input.expandedSubgraph.limitations.map(goalSubgraphLimitation),
  ];
  for (const coverage of Object.values(input.resourceCoverage ?? {})) {
    if (coverage.pathEligibleResourceCount === 0) {
      limitations.push({
        code: 'resource-coverage-missing-path-eligible',
        severity: 'blocking',
        nodeId: coverage.nodeId,
        message: `Graph node ${coverage.nodeId} has no audited path-eligible ResourceNode coverage.`,
      });
    } else if (coverage.coverageState !== 'sufficient') {
      limitations.push({
        code: 'resource-coverage-partial',
        severity: 'warning',
        nodeId: coverage.nodeId,
        message: `Graph node ${coverage.nodeId} resource coverage is ${coverage.coverageState}.`,
      });
    }
  }
  if (input.learningGoalBaseline?.coverageState === 'limited') {
    limitations.push({
      code: 'learning-goal-baseline-incomplete',
      severity: 'warning',
      message: `LearningGoal baseline is incomplete: ${input.learningGoalBaseline.missingBaselineCategories.join(', ') || input.learningGoalBaseline.limitationReason || 'missing reviewed baseline coverage'}.`,
    });
  }
  if (input.assessmentCoverage?.coverageState === 'limited') {
    limitations.push({
      code: 'learning-goal-assessment-coverage-incomplete',
      severity: 'blocking',
      message: `LearningGoal assessment coverage is incomplete: ${input.assessmentCoverage.incompleteStages.join(', ') || input.assessmentCoverage.limitationReason || 'missing reviewed assessment coverage'}.`,
    });
  }
  limitations.push(...overlayLimitations('learner', input.learnerOverlay));
  limitations.push(...overlayLimitations('class', input.classOverlay));
  return limitations;
}

function goalSubgraphLimitation(limitation: GoalSubgraphLimitation): AdaptiveLearningPathGraphLimitation {
  return {
    code: limitation.code,
    severity: limitation.severity,
    nodeId: limitation.graphNodeId ?? undefined,
    message: limitation.message,
  };
}

function overlayLimitations(
  kind: 'learner' | 'class',
  overlay: GraphCenterLearnerOverlay | GraphCenterClassOverlay | null | undefined,
): AdaptiveLearningPathGraphLimitation[] {
  if (!overlay) {
    return [{
      code: `${kind}-overlay-missing`,
      severity: 'warning',
      message: `${kind} overlay is unavailable; planner must treat overlay guidance as a limitation.`,
    }];
  }
  const limitations: AdaptiveLearningPathGraphLimitation[] = overlay.limitations.map((limitation) => ({
    code: limitation.code,
    severity: 'warning' as const,
    nodeId: limitation.nodeId,
    message: limitation.message,
  }));
  if (overlay.status !== 'available') {
    limitations.unshift({
      code: `${kind}-overlay-${overlay.status}`,
      severity: 'warning',
      message: `${kind} overlay status is ${overlay.status}.`,
    });
  }
  return limitations;
}

function buildCapabilityEvidence(
  targets: AdaptiveLearningCapabilityTarget[],
  learnerState: AdaptiveLearningPathLearnerState | null,
): AdaptiveLearningPathCapabilityEvidence[] {
  const goalSliceEvidence = collectGoalSliceCapabilityEvidence(learnerState);
  return targets.map((target) => {
    const existingEvidence = goalSliceEvidence.get(target.id);
    if (existingEvidence) {
      return {
        target,
        observedEvidence: existingEvidence.observedEvidence,
      };
    }
    const knowledge = learnerState?.knowledgeMastery?.tags?.[target.knowledgeNodeRef];
    const competencies: Array<{ score?: number; confidence?: number; evidenceCount?: number }> = target.competencyDimensions
      .flatMap((dimension): Array<{ score?: number; confidence?: number; evidenceCount?: number }> => {
        const portraitValues = usablePortraitDimensionsForTarget(learnerState, dimension)
          .map((value) => ({
            score: value.score,
            confidence: value.confidence,
            evidenceCount: value.evidenceSummary.totalCount,
          }));
        return portraitValues;
      });
    const competencyScore = competencies.length > 0
      ? round(competencies.reduce((sum, competency) => sum + (competency.score ?? 0), 0) / competencies.length, 2)
      : null;
    const directConfidence = knowledge?.confidence ?? 0;
    const knowledgeEvidenceCount = knowledge?.evidenceCount ?? 0;
    const supportingEvidenceCount = Math.max(0, ...competencies.map((competency) => competency.evidenceCount ?? 0));
    const state = knowledgeEvidenceCount === 0
      ? 'missing'
      : directConfidence < 0.5
        ? 'low-confidence'
        : 'observed';
    return {
      target,
      observedEvidence: {
        state,
        knowledgeMastery: knowledge?.posteriorMastery ?? null,
        competencyScore,
        confidence: round(directConfidence, 2),
        directEvidenceCount: knowledgeEvidenceCount,
        supportingEvidenceCount,
        portraitDimensionIds: unique(target.competencyDimensions.flatMap(portraitDimensionIdsForTarget)),
        source: 'adaptive-learner-state',
        recommendationBias: state === 'observed' ? 'targeted-practice' : 'starter-or-evidence-gathering',
      },
    };
  });
}

function collectGoalSliceCapabilityEvidence(
  learnerState: AdaptiveLearningPathLearnerState | null,
): Map<string, AdaptiveLearningPathCapabilityEvidence> {
  const entries = Object.values(learnerState?.goalSlices ?? {})
    .flatMap((slice) => Array.isArray(slice?.capabilityTargets) ? slice.capabilityTargets : [])
    .filter((item) => typeof item.target.id === 'string');
  return new Map(entries.map((item) => [item.target.id, item]));
}

export function evaluateHardEligibility(
  nodes: ResourceNode[],
  constraints: AdaptiveLearningPathConstraints,
): { eligible: ResourceNode[]; blocked: AdaptiveLearningPathAlternative[] } {
  const eligible: ResourceNode[] = [];
  const blocked: AdaptiveLearningPathAlternative[] = [];
  for (const node of nodes) {
    const reasonCodes = blockingReasonCodes(node, constraints);
    if (reasonCodes.length > 0) {
      const redacted = shouldRedactBlockedNode(node, reasonCodes);
      const nodeId = redacted ? `restricted:${blocked.length + 1}` : node.id;
      blocked.push({
        nodeId,
        nodeIds: [nodeId],
        title: redacted ? '受限资源' : node.title,
        reasonCodes,
        score: 0,
        blocked: true,
      });
      continue;
    }
    eligible.push(node);
  }
  return { eligible, blocked };
}

function evaluateSarCandidates(input: {
  input: AdaptiveLearningPathPlannerInput;
  pathEligible: ResourceNode[];
  graphContext?: AdaptiveLearningPathGraphContextSummary;
  deficits: AdaptiveLearningPathDeficit[];
  registeredGoal: AdaptiveLearningPathRegisteredGoalDefinition | null;
  completedNodeIds: string[];
}): EvaluatedSarCandidates | null {
  const context = input.input.sarCandidateContext;
  if (!context || context.enabled === false) return null;
  const candidateRefs = context.candidates ?? [];
  if (candidateRefs.length === 0 && (context.seedEntityRefs?.length ?? 0) === 0 && !context.traceId) return null;

  const pathEligibleIds = new Set(input.pathEligible.map((node) => node.id));
  const nodeById = new Map(input.input.registry.nodes.map((node) => [node.id, node]));
  const nodeByResourceId = new Map(input.input.registry.nodes
    .map((node) => {
      const planningUnit = planningUnitForNode(node);
      return planningUnit ? [planningUnit.resourceId, node] as const : null;
    })
    .filter((entry): entry is readonly [string, ResourceNode] => Boolean(entry)));
  const nodeByPlanningUnitId = new Map(input.input.registry.nodes
    .map((node) => {
      const planningUnit = planningUnitForNode(node);
      return planningUnit ? [planningUnit.id, node] as const : null;
    })
    .filter((entry): entry is readonly [string, ResourceNode] => Boolean(entry)));
  const acceptedNodeIds = new Set<string>();
  const rejectedCandidates: AdaptiveLearningPathRejectedSarCandidate[] = [];

  for (const candidate of candidateRefs) {
    const kind = candidate.kind ?? 'unknown';
    const node = sarCandidateCanMapToPathNode(kind, candidate)
      ? resolveSarCandidateNode(
        candidate,
        nodeById,
        nodeByResourceId,
        nodeByPlanningUnitId,
        kind !== 'retrievalChunk' && kind !== 'citationTarget',
      )
      : null;
    if (!node) {
      rejectedCandidates.push(toUnmappedRejectedSarCandidate(
        candidate,
        kind,
        nodeById,
        nodeByResourceId,
        nodeByPlanningUnitId,
        input.input.constraints,
        rejectedCandidates.length,
      ));
      continue;
    }

    const reasons = unique([
      ...blockingReasonCodes(node, input.input.constraints),
      ...(pathEligibleIds.has(node.id) ? [] : ['path-ineligible']),
      ...(input.input.excludedNodeIds?.includes(node.id) ? ['excluded-node'] : []),
      ...(externalResourceAllowed(node, input.input, input.registeredGoal) ? [] : ['external-resource-disabled']),
      ...(goalAllowsResourceNode(node, input.registeredGoal) ? [] : ['learning-goal-resource-mix-blocked']),
      ...(nodeMatchesGoal(node, input.input.goal, input.deficits, input.graphContext)
        ? []
        : ['learning-goal-boundary-mismatch']),
      ...sarReadinessReasonCodes(node, input.input.learnerState, input.input.constraints, input.completedNodeIds),
      ...(candidate.requiredUse === 'terminal-validation' && !isTerminalValidationNode(node)
        ? ['terminal-validation-insufficient']
        : []),
    ]);
    if (reasons.length > 0) {
      rejectedCandidates.push(toRejectedSarCandidate(candidate, kind, node, reasons, rejectedCandidates.length));
      continue;
    }

    acceptedNodeIds.add(node.id);
  }

  return {
    traceId: context.traceId ?? null,
    seedEntityRefs: uniqueNonEmptyStrings(context.seedEntityRefs ?? []),
    acceptedNodeIds,
    rejectedCandidates,
    limitations: uniqueNonEmptyStrings(context.limitations ?? []),
  };
}

function sarCandidateCanMapToPathNode(
  kind: AdaptiveLearningPathSarCandidateKind,
  candidate: AdaptiveLearningPathSarCandidateRef,
): boolean {
  if (kind === 'retrievalChunk' || kind === 'citationTarget') {
    return Boolean(candidate.resourceNodeId || candidate.planningUnitId || candidate.resourceId);
  }
  return kind === 'resourceNode' || kind === 'planningUnit' || kind === 'resource' || kind === 'unknown';
}

function toUnmappedRejectedSarCandidate(
  candidate: AdaptiveLearningPathSarCandidateRef,
  kind: AdaptiveLearningPathSarCandidateKind,
  nodeById: Map<string, ResourceNode>,
  nodeByResourceId: Map<string, ResourceNode>,
  nodeByPlanningUnitId: Map<string, ResourceNode>,
  constraints: AdaptiveLearningPathConstraints,
  index: number,
): AdaptiveLearningPathRejectedSarCandidate {
  const possibleNode = resolveSarCandidateNode(candidate, nodeById, nodeByResourceId, nodeByPlanningUnitId);
  const possibleReasons = possibleNode ? blockingReasonCodes(possibleNode, constraints) : [];
  const reasonCodes = unique(['missing-resource-node-mapping', ...possibleReasons]);
  if (
    (possibleNode && shouldRedactBlockedNode(possibleNode, reasonCodes)) ||
    (!possibleNode && Boolean(candidate.resourceNodeId || candidate.planningUnitId || candidate.resourceId))
  ) {
    return {
      ref: `restricted:${index + 1}`,
      kind,
      reasonCodes,
    };
  }
  return {
    ref: candidate.ref,
    kind,
    reasonCodes,
  };
}

function toRejectedSarCandidate(
  candidate: AdaptiveLearningPathSarCandidateRef,
  kind: AdaptiveLearningPathSarCandidateKind,
  node: ResourceNode,
  reasonCodes: string[],
  index: number,
): AdaptiveLearningPathRejectedSarCandidate {
  if (shouldRedactBlockedNode(node, reasonCodes)) {
    return {
      ref: `restricted:${index + 1}`,
      kind,
      reasonCodes,
    };
  }
  return {
    ref: candidate.ref,
    kind,
    resourceNodeId: node.id,
    planningUnitId: planningUnitForNode(node)?.id ?? candidate.planningUnitId,
    reasonCodes,
  };
}

function resolveSarCandidateNode(
  candidate: AdaptiveLearningPathSarCandidateRef,
  nodeById: Map<string, ResourceNode>,
  nodeByResourceId: Map<string, ResourceNode>,
  nodeByPlanningUnitId: Map<string, ResourceNode>,
  allowRefFallback = true,
): ResourceNode | null {
  const mapped = (candidate.resourceNodeId ? nodeById.get(candidate.resourceNodeId) : undefined) ??
    (candidate.planningUnitId ? nodeByPlanningUnitId.get(candidate.planningUnitId) : undefined) ??
    (candidate.resourceId ? nodeByResourceId.get(candidate.resourceId) : undefined) ??
    null;
  if (mapped || !allowRefFallback) return mapped;
  return nodeById.get(candidate.ref) ??
    nodeByPlanningUnitId.get(candidate.ref) ??
    nodeByResourceId.get(candidate.ref) ??
    null;
}

function sarReadinessReasonCodes(
  node: ResourceNode,
  learnerState: AdaptiveLearningPathLearnerState | null,
  constraints: AdaptiveLearningPathConstraints,
  completedNodeIds: string[],
): string[] {
  const readiness = evaluateNodeReadiness(node, learnerState, constraints, completedNodeIds);
  return readiness.state === 'ready' ? [] : readiness.reasonCodes;
}

function buildAssociativeRetrievalBasis(
  sarCandidates: EvaluatedSarCandidates,
  mainPath: AdaptiveLearningPathPlanNode[],
): AdaptiveLearningPathAssociativeRetrievalBasis {
  const mainPathNodeIds = new Set(mainPath.map((node) => node.nodeId));
  const selectedCandidateNodeIds = Array.from(sarCandidates.acceptedNodeIds)
    .filter((nodeId) => mainPathNodeIds.has(nodeId))
    .sort();
  return {
    traceId: sarCandidates.traceId,
    seedEntityRefs: sarCandidates.seedEntityRefs,
    candidateResourceNodeIds: Array.from(sarCandidates.acceptedNodeIds).sort(),
    selectedCandidateNodeIds,
    rejectedCandidates: sarCandidates.rejectedCandidates,
    limitations: sarCandidates.limitations,
  };
}

function blockingReasonCodes(node: ResourceNode, constraints: AdaptiveLearningPathConstraints): string[] {
  const reasons: string[] = [];
  const planningAudit = buildResourceNodeHighConfidencePlanningAudit(node);
  if (!node.eligibility.pathEligible) reasons.push(...node.eligibility.reasons);
  reasons.push(...planningAudit.issues
    .filter((issue) => issue.severity === 'blocking')
    .map((issue) => issue.code));
  if (!planningUnitForNode(node)) reasons.push('missing-planning-unit-projection');
  if (!constraints.privacyScopes.includes(node.planningMetadata.privacyLevel)) reasons.push('privacy-scope-blocked');
  if (node.planningMetadata.teacherPolicy === 'blocked') reasons.push('teacher-policy-blocked');
  if (node.planningMetadata.teacherPolicy === 'teacher-only') reasons.push('teacher-policy-teacher-only');
  if (
    node.planningMetadata.teacherPolicy === 'teacher-assigned' &&
    !(constraints.teacherAssignedNodeIds ?? []).includes(node.id)
  ) {
    reasons.push('teacher-assignment-required');
  }
  const destination = resolveAdaptivePathDestinationContract(node.type, node.launchTarget ?? node.renderTarget ?? '', {
    nodeId: node.id,
    sourceKind: node.sourceKind,
    sourceRef: node.sourceRef,
  });
  if (destination.disposition === 'blocked') reasons.push('destination-contract-blocked');
  if ((constraints.device === 'mobile' || constraints.device === 'tablet') && node.type === 'simulation') {
    reasons.push('device-constraint-blocked');
  }
  return unique(reasons);
}

function planningUnitForNode(node: ResourceNode): PlanningUnit | null {
  return buildResourceSemanticProjection(node).planningUnit;
}

function requirePlanningUnit(node: ResourceNode): PlanningUnit {
  const planningUnit = planningUnitForNode(node);
  if (!planningUnit) {
    throw new Error(`Path node ${node.id} does not have a PlanningUnit projection.`);
  }
  return planningUnit;
}

function nodeMatchesGoal(
  node: ResourceNode,
  goal: AdaptiveLearningPathGoal,
  deficits: AdaptiveLearningPathDeficit[],
  graphContext?: AdaptiveLearningPathGraphContextSummary,
): boolean {
  const planningUnit = planningUnitForNode(node);
  if (!planningUnit) return false;
  const registeredGoal = getRegisteredAdaptiveLearningPathGoal(goal.id);
  const knowledgeTargets = new Set([
    ...goal.knowledgeTargets,
    ...deficits.filter((deficit) => deficit.kind === 'knowledge').map((deficit) => deficit.targetId),
    ...expandedRegisteredKnowledgeTargets(goal, deficits, registeredGoal),
  ]);
  const coversKnowledgeTarget = planningUnit.knowledgeCoverage.some((tag) => knowledgeTargets.has(tag))
    || knowledgeTargets.has(node.id);
  const coversGraphTarget = Boolean(
    graphContext?.targetGraphNodeIds.length &&
    graphTargetsCoveredByPlanningUnit(planningUnit, graphContext).length > 0,
  );
  if (knowledgeTargets.size > 0) {
    return coversKnowledgeTarget || coversGraphTarget;
  }
  if (coversGraphTarget) return true;
  if (registeredGoal) {
    return coversKnowledgeTarget;
  }
  return Object.keys(planningUnit.abilityImpact).some((key) => (goal.competencyTargets ?? []).includes(key));
}

function expandedRegisteredKnowledgeTargets(
  goal: AdaptiveLearningPathGoal,
  deficits: AdaptiveLearningPathDeficit[],
  registeredGoal: AdaptiveLearningPathRegisteredGoalDefinition | null,
): string[] {
  if (!registeredGoal?.knowledgeTargetAliases) return [];
  const declaredTargets = unique([
    ...goal.knowledgeTargets,
    ...deficits.filter((deficit) => deficit.kind === 'knowledge').map((deficit) => deficit.targetId),
  ]);
  return unique(declaredTargets.flatMap((target) => registeredGoal.knowledgeTargetAliases?.[target] ?? []));
}

function knowledgeTargetCoverageRefs(goal: AdaptiveLearningPathGoal, target: string): string[] {
  const aliases = getRegisteredAdaptiveLearningPathGoal(goal.id)?.knowledgeTargetAliases?.[target] ?? [];
  return unique([target, ...aliases]);
}

function planningUnitCoversKnowledgeTarget(
  planningUnit: PlanningUnit,
  goal: AdaptiveLearningPathGoal,
  target: string,
): boolean {
  const coverageRefs = new Set(knowledgeTargetCoverageRefs(goal, target));
  return planningUnit.knowledgeCoverage.some((tag) => coverageRefs.has(tag))
    || coverageRefs.has(planningUnit.resourceNodeId);
}

function scoreNode(
  node: ResourceNode,
  deficits: AdaptiveLearningPathDeficit[],
  learnerState: AdaptiveLearningPathLearnerState | null,
  constraints: AdaptiveLearningPathConstraints,
  policyFamily: AdaptiveLearningPathPolicyFamily,
  preferenceContext: AdaptiveLearningPathPreferenceContext,
): ScoredNode {
  const planningUnit = requirePlanningUnit(node);
  const coverageGain = planningUnit.knowledgeCoverage.reduce((sum, tag) => {
    const deficit = deficits.find((item) => item.targetId === tag);
    return sum + (deficit ? 1 - deficit.value : 0);
  }, 0);
  const competencyTargets = new Set(
    deficits
      .filter((item) => item.kind === 'competency' && item.reasonCode !== 'competency-no-portrait-evidence')
      .map((item) => item.targetId),
  );
  const abilityGain = Object.entries(planningUnit.abilityImpact).reduce((sum, [dimension, impact]) => {
    const deficit = deficits.find((item) =>
      item.kind === 'competency'
      && item.targetId === dimension
      && item.reasonCode !== 'competency-no-portrait-evidence');
    if (!deficit || !competencyTargets.has(dimension)) return sum;
    return sum + impact * (1 - deficit.value);
  }, 0);
  const modalityBoost = preferenceContext.resourceTypes.has(node.type) ? 0.45 : 0;
  const learnerModalityBoost = !preferenceContext.usesExplicitResourcePreferences &&
    learnerState?.resourcePreference?.preferredModalities?.includes(node.type)
    ? 0.2
    : 0;
  const fatiguePenalty = Math.max(0, planningUnit.estimatedTimeMinutes - constraints.timeBudgetMinutes / 2) / 100;
  const riskBoost = constraints.requireRiskIntervention && (node.type === 'ai_intervention' || node.type === 'reflection') ? 0.25 : 0;
  const difficultyBoost = difficultyRhythmScoreBoost(node, preferenceContext.difficultyRhythm, constraints);
  const checkpointBoost = checkpointPreferenceScoreBoost(node, preferenceContext.checkpointPreference);
  const policyBoost = policyScoreBoost(node, policyFamily, constraints, learnerState, preferenceContext);
  const score = round(coverageGain + abilityGain + modalityBoost + learnerModalityBoost + riskBoost + difficultyBoost + checkpointBoost + policyBoost - fatiguePenalty, 3);
  const reasonCodes = [
    coverageGain > 0 ? 'matches-knowledge-deficit' : null,
    abilityGain > 0 ? 'matches-competency-deficit' : null,
    modalityBoost + learnerModalityBoost > 0 ? 'matches-resource-preference' : null,
    riskBoost > 0 ? 'risk-intervention-fit' : null,
    difficultyBoost > 0 ? `matches-${preferenceContext.difficultyRhythm}-rhythm` : null,
    checkpointBoost > 0 ? `matches-${preferenceContext.checkpointPreference}-checkpoint-preference` : null,
    policyBoost > 0 ? policyReasonCode(policyFamily) : null,
  ].filter((item): item is string => Boolean(item));
  return { node, score, reasonCodes };
}

interface AdaptiveLearningPathPreferenceContext {
  resourceTypes: Set<ResourceNode['type']>;
  difficultyRhythm: NonNullable<AdaptiveLearningPathPlannerInput['difficultyRhythm']>;
  checkpointPreference: NonNullable<AdaptiveLearningPathPlannerInput['checkpointPreference']>;
  usesExplicitResourcePreferences: boolean;
  usesExplicitDifficultyRhythm: boolean;
  usesExplicitCheckpointPreference: boolean;
}

function buildPlannerPreferenceContext(input: AdaptiveLearningPathPlannerInput): AdaptiveLearningPathPreferenceContext {
  const usesExplicitResourcePreferences = hasExplicitPlannerChoice(
    input.resourcePreferenceSource,
    input.resourcePreferences,
  );
  const resourceTypes = unique(usesExplicitResourcePreferences
    ? input.resourcePreferences ?? []
    : [
      ...(input.learnerState?.resourcePreference?.preferredModalities ?? []),
      ...(input.resourcePreferences ?? []),
    ]).filter((type): type is ResourceNode['type'] =>
    input.registry.supportedTypes.includes(type as ResourceNode['type'])
  );
  return {
    resourceTypes: new Set(resourceTypes),
    difficultyRhythm: input.difficultyRhythm ?? 'steady',
    checkpointPreference: input.checkpointPreference ?? 'standard',
    usesExplicitResourcePreferences,
    usesExplicitDifficultyRhythm: hasExplicitPlannerChoice(input.difficultyRhythmSource, input.difficultyRhythm),
    usesExplicitCheckpointPreference: hasExplicitPlannerChoice(input.checkpointPreferenceSource, input.checkpointPreference),
  };
}

function buildConfigurationFulfillment(
  input: AdaptiveLearningPathPlannerInput,
  mainPath: AdaptiveLearningPathPlanNode[],
  fallbackReasons: readonly string[],
): AdaptiveLearningPathConfigurationFulfillment[] {
  const requests = input.configurationRequests ?? [];
  const selectedTypes = new Set(mainPath.map((node) => node.type));
  const selectedReasons = new Set(mainPath.flatMap((node) => node.reasonCodes));
  const checkpointCount = mainPath.filter((node) => node.checkpoint || node.type === 'checkpoint').length;
  const registeredGoal = getRegisteredAdaptiveLearningPathGoal(input.goal.id);
  const fulfillmentByKey = new Map<AdaptiveLearningPathConfigurationKey, AdaptiveLearningPathConfigurationFulfillment>();

  for (const request of requests) {
    if (request.source === 'fallback' && request.key !== 'resource-preferences') continue;
    let fulfilled = mainPath.length > 0;
    let effect = '';
    let message = '';
    if (request.key === 'resource-preferences') {
      if (request.source === 'fallback') {
        // #1985：下落系统默认时同样标注来源，不得呈现为用户或画像选择。
        fulfilled = mainPath.length > 0;
        effect = '未提交资源偏好，已按目标默认资源类型组合路径。';
        message = effect;
      } else {
        const requestedTypes = Array.isArray(request.value) ? request.value : [];
        fulfilled = requestedTypes.some((type) => selectedTypes.has(type as ResourceNode['type']));
        effect = fulfilled ? '已优先选择匹配的资源类型。' : '没有可满足的匹配资源类型。';
        message = fulfilled ? effect : '当前目标和约束下没有可替代的匹配资源。';
      }
    } else if (request.key === 'difficulty-rhythm') {
      const rhythm = typeof request.value === 'string' ? request.value : 'steady';
      fulfilled = selectedReasons.has(`matches-${rhythm}-rhythm`);
      effect = fulfilled ? '已按所选学习节奏编排资源。' : '没有可满足该节奏的可执行资源组合。';
      message = fulfilled ? effect : '当前目标和约束下无法满足所选学习节奏。';
    } else if (request.key === 'checkpoint-preference') {
      const preference = typeof request.value === 'string' ? request.value : 'standard';
      const requiredCheckpoints = registeredGoal?.checkpointPolicy.minCheckpoints ?? 0;
      if (preference === 'dense') {
        fulfilled = checkpointCount >= Math.max(requiredCheckpoints, 2);
        effect = fulfilled ? '已按所选检查点密度编排路径。' : '可用检查点不足以满足所选密度。';
        message = fulfilled ? effect : '当前资源不足以满足所选检查点密度。';
      } else if (preference === 'light') {
        fulfilled = requiredCheckpoints <= 1;
        effect = fulfilled ? '已按所选检查点密度编排路径。' : '目标要求的必需检查点数量高于轻量设置。';
        message = fulfilled ? effect : '当前目标要求保留更多必需检查点，因此未按轻量设置减少检查点。';
      } else {
        fulfilled = mainPath.length > 0;
        effect = fulfilled ? '已按所选检查点密度编排路径。' : '可用检查点不足以满足所选密度。';
        message = fulfilled ? effect : '当前资源不足以满足所选检查点密度。';
      }
    } else if (request.key === 'external-resources') {
      const allowed = request.value === true;
      fulfilled = allowed || !mainPath.some((node) => node.type === 'external_resource');
      effect = allowed ? '已允许在可用时选用外部资源。' : '路径未使用外部资源。';
      message = effect;
    } else if (request.key === 'natural-language-intent') {
      const mappedFulfillments = requests
        .filter((candidate) => candidate.source === 'intent' && candidate.key !== 'natural-language-intent')
        .map((candidate) => fulfillmentByKey.get(candidate.key));
      fulfilled = !request.limitationCode &&
        mappedFulfillments.length > 0 &&
        mappedFulfillments.every((candidate) => candidate?.status === 'applied');
      effect = fulfilled ? '已将可识别意图映射为路径配置。' : '识别到的意图未能全部落实到可执行路径。';
      message = fulfilled
        ? effect
        : request.limitationCode === 'natural-language-intent-partially-unmapped'
          ? '部分意图未能识别为可执行配置，请补充资源类型、节奏、检查点或目标相关的明确表达。'
          : request.limitationCode === 'natural-language-intent-conflict'
            ? '同一配置包含相互冲突的表达，系统未自动选择任一项。请在挑战或轻松、密集或轻量检查、允许或不使用外部资源中各选一项后重试。'
          : request.limitationCode
            ? '请使用资源类型、节奏、检查点、外部资源或目标相关的明确表达。'
            : '请调整明确配置或可用资源后重试。';
    } else if (request.key === 'time-budget') {
      fulfilled = !fallbackReasons.includes('time-budget-insufficient');
      effect = fulfilled ? '已按所选学习时长生成路径。' : '所选学习时长不足以覆盖必需验证。';
      message = fulfilled ? effect : '请增加学习时长后重试。';
    }
    fulfillmentByKey.set(request.key, {
      key: request.key,
      status: fulfilled ? 'applied' : 'unmet',
      source: request.source,
      effect,
      message,
      ...(fulfilled || !request.limitationCode ? {} : { limitationCode: request.limitationCode }),
    });
  }

  return Array.from(fulfillmentByKey.values());
}

function difficultyRhythmScoreBoost(
  node: ResourceNode,
  rhythm: AdaptiveLearningPathPreferenceContext['difficultyRhythm'],
  constraints: AdaptiveLearningPathConstraints,
): number {
  const planningUnit = requirePlanningUnit(node);
  const estimatedMinutes = planningUnit.estimatedTimeMinutes;
  const highImpact = Math.max(...Object.values(planningUnit.abilityImpact), 0);
  if (rhythm === 'gentle') {
    const lowLoadBoost = planningUnit.cognitiveLoad === 'low' ? 0.3 : 0;
    const shortResourceBoost = estimatedMinutes <= Math.max(12, constraints.timeBudgetMinutes / 5) ? 0.18 : 0;
    return lowLoadBoost + shortResourceBoost;
  }
  if (rhythm === 'challenge') {
    const highLoadBoost = planningUnit.cognitiveLoad === 'high' ? 0.25 : 0;
    const highImpactBoost = highImpact >= 0.3 ? 0.25 : 0;
    const authenticTaskBoost = node.type === 'simulation' || node.type === 'arena_task' ? 0.2 : 0;
    return highLoadBoost + highImpactBoost + authenticTaskBoost;
  }
  return planningUnit.cognitiveLoad === 'medium' ? 0.12 : 0;
}

function checkpointPreferenceScoreBoost(
  node: ResourceNode,
  preference: AdaptiveLearningPathPreferenceContext['checkpointPreference'],
): number {
  const isCheckpoint = Boolean(node.checkpoint) || node.type === 'checkpoint';
  const isTerminalValidation = node.planningMetadata.terminalConstraints.includes('terminal-validation');
  if (preference === 'dense') {
    return (isCheckpoint ? 0.45 : 0) + (isTerminalValidation ? 0.25 : 0);
  }
  if (preference === 'light') {
    return isTerminalValidation ? 0.08 : isCheckpoint ? -0.25 : 0.08;
  }
  return isCheckpoint ? 0.16 : 0;
}

function configurationSelectionPriority(
  node: ResourceNode,
  preferenceContext: AdaptiveLearningPathPreferenceContext,
  constraints: AdaptiveLearningPathConstraints,
): number {
  let priority = 0;
  if (preferenceContext.usesExplicitResourcePreferences && preferenceContext.resourceTypes.has(node.type)) {
    priority += 4;
  }
  if (preferenceContext.usesExplicitDifficultyRhythm &&
    difficultyRhythmScoreBoost(node, preferenceContext.difficultyRhythm, constraints) > 0) {
    priority += 2;
  }
  if (preferenceContext.usesExplicitCheckpointPreference &&
    checkpointPreferenceScoreBoost(node, preferenceContext.checkpointPreference) > 0) {
    priority += 1;
  }
  return priority;
}

export function requiredCheckpointCountForPreference(
  registeredGoal: AdaptiveLearningPathRegisteredGoalDefinition | null,
  preferenceContext: AdaptiveLearningPathPreferenceContext,
): number {
  const required = registeredGoal?.checkpointPolicy.minCheckpoints ?? 0;
  if (!preferenceContext.usesExplicitCheckpointPreference) return required;
  if (preferenceContext.checkpointPreference === 'dense') return Math.max(required, 2);
  if (preferenceContext.checkpointPreference === 'light') return required;
  return required;
}

function policyScoreBoost(
  node: ResourceNode,
  policyFamily: AdaptiveLearningPathPolicyFamily,
  constraints: AdaptiveLearningPathConstraints,
  learnerState: AdaptiveLearningPathLearnerState | null,
  preferenceContext: AdaptiveLearningPathPreferenceContext,
): number {
  const planningUnit = requirePlanningUnit(node);
  const estimatedMinutes = planningUnit.estimatedTimeMinutes;

  if (policyFamily === 'foundation-remediation') {
    const conceptBoost = node.type === 'knowledge_card' || node.type === 'infographic' ||
      node.type === 'textbook_section' ||
      node.type === 'lesson_step' ||
      node.type === 'quiz' ||
      node.type === 'handout'
      ? 1.1
      : 0;
    const lowLoadBoost = planningUnit.cognitiveLoad === 'low' ? 0.25 : 0;
    const prerequisiteBoost = planningUnit.prerequisites.length === 0 ? 0.12 : 0;
    return conceptBoost + lowLoadBoost + prerequisiteBoost;
  }
  if (policyFamily === 'simulation-driven') {
    if (node.type === 'simulation') return 0.65;
    if (node.type === 'arena_task') return 0.55;
    if (node.type === 'reflection') return 0.35;
    return 0;
  }
  if (policyFamily === 'sprint-correction') {
    const budgetRatio = estimatedMinutes / Math.max(constraints.timeBudgetMinutes, 1);
    const shortPathBoost = budgetRatio <= 0.3 ? 0.45 : budgetRatio <= 0.5 ? 0.25 : 0;
    const highImpactBoost = Math.max(...Object.values(planningUnit.abilityImpact), 0) >= 0.3 ? 0.2 : 0;
    return shortPathBoost + highImpactBoost;
  }
  if (policyFamily === 'preference-matched') {
    const preferenceBoost = preferenceContext.resourceTypes.has(node.type) ||
      (!preferenceContext.usesExplicitResourcePreferences &&
        learnerState?.resourcePreference?.preferredModalities?.includes(node.type))
      ? 0.75
      : 0;
    const pacingBoost = estimatedMinutes <= Math.max(15, constraints.timeBudgetMinutes / 3) ? 0.18 : 0;
    return preferenceBoost + pacingBoost;
  }
  if (policyFamily === 'teacher-assigned') {
    return node.planningMetadata.teacherPolicy === 'teacher-assigned' &&
      (constraints.teacherAssignedNodeIds ?? []).includes(node.id)
      ? 0.8
      : 0;
  }
  return 0;
}

function policyAllowsNode(
  node: ResourceNode,
  policyFamily: AdaptiveLearningPathPolicyFamily,
  constraints: AdaptiveLearningPathConstraints,
): boolean {
  if (policyFamily !== 'teacher-assigned') {
    return true;
  }
  return node.planningMetadata.teacherPolicy === 'teacher-assigned' &&
    (constraints.teacherAssignedNodeIds ?? []).includes(node.id);
}

function policyReasonCode(policyFamily: AdaptiveLearningPathPolicyFamily): string | null {
  if (policyFamily === 'rules-plus-graph-search') return null;
  return `policy-${policyFamily}`;
}

function buildFeasiblePath(
  scoredNodes: ScoredNode[],
  registry: ResourceNodeRegistry,
  constraints: AdaptiveLearningPathConstraints,
  goal: AdaptiveLearningPathGoal,
  graphContext: AdaptiveLearningPathGraphContextSummary | undefined,
  eligibleIds: Set<string>,
  completedNodeIds: string[],
): ScoredNode[] {
  const nodesById = new Map(registry.nodes.filter((node) => eligibleIds.has(node.id)).map((node) => [node.id, node]));
  const scoredById = new Map(scoredNodes.map((entry) => [entry.node.id, entry]));
  const completed = new Set(completedNodeIds);
  const graphGoalTargets = graphContext?.targetGraphNodeIds.length
    ? graphTargetsCoveredByScoredNodes(scoredNodes, graphContext)
    : [];
  const activeGraphContext = graphGoalTargets.length > 0 ? graphContext : undefined;
  const allGoalTargets = new Set([
    ...(activeGraphContext ? graphGoalTargets : goal.knowledgeTargets),
    ...(activeGraphContext ? [] : (goal.competencyTargets ?? [])),
  ]);
  const candidateOptions = scoredNodes.flatMap((entry): CandidateOption[] => {
    const chain = buildCandidateChain(entry, nodesById, scoredById, goal, activeGraphContext);
    if (!chain) {
      return [];
    }
    const includesRiskIntervention = chain.entries.some((candidate) => isRiskInterventionNode(candidate.node));
    if (!chain.coversGoalTarget && !(constraints.requireRiskIntervention && includesRiskIntervention)) {
      return [];
    }
    if (chainHasTerminalViolation(chain.entries)) {
      return [];
    }
    return [{
      entry,
      chain,
      goalTargets: goalTargetsCoveredByNodes(chain.entries.map((candidate) => candidate.node), goal, activeGraphContext),
      includesRiskIntervention,
    }];
  });
  let state: SelectionState = {
    selected: new Map(),
    coveredGoalTargets: new Set(),
    includesRiskIntervention: false,
    remainingMinutes: constraints.timeBudgetMinutes,
  };

  const tryAddOption = (
    option: CandidateOption,
    requireNewGoalTarget: boolean,
    enforceCompletionLookahead = true,
  ): boolean => {
    const addsGoalTarget = option.goalTargets.some((target) => !state.coveredGoalTargets.has(target));
    const addsRequiredRiskIntervention = constraints.requireRiskIntervention &&
      !state.includesRiskIntervention &&
      option.includesRiskIntervention;
    if (requireNewGoalTarget && !addsGoalTarget && !addsRequiredRiskIntervention) {
      return false;
    }
    const nextState = addCandidateOptionToState(option, state, completed);
    if (!nextState) {
      return false;
    }
    if (
      requireNewGoalTarget &&
      enforceCompletionLookahead &&
      !allPlanningRequirementsSatisfied(nextState, allGoalTargets, constraints) &&
      !canCompletePlanningRequirements(candidateOptions, nextState, completed, allGoalTargets, constraints)
    ) {
      return false;
    }
    state = nextState;
    return true;
  };

  for (const option of candidateOptions) {
    tryAddOption(option, true);
  }
  const selectedEntries = () => Array.from(state.selected.values());
  const selectedCoversAllGraphTargets = () => !activeGraphContext || activeGraphContext.targetGraphNodeIds.every((target) =>
    state.coveredGoalTargets.has(target)
  );
  if (
    activeGraphContext &&
    (
      !allPlanningRequirementsSatisfied(state, allGoalTargets, constraints) ||
      !selectedCoversAllGraphTargets() ||
      (requiresTerminalValidation(goal) && !endsWithTerminalValidationNode(selectedEntries()))
    )
  ) {
    state = {
      selected: new Map(),
      coveredGoalTargets: new Set(),
      includesRiskIntervention: false,
      remainingMinutes: constraints.timeBudgetMinutes,
    };
  }
  if (activeGraphContext && state.selected.size === 0) {
    for (const option of candidateOptions) {
      if (tryAddOption(option, true, false)) break;
    }
    if (requiresTerminalValidation(goal)) {
      for (const option of candidateOptions) {
        if (option.chain.entries.some((candidate) => isTerminalNode(candidate.node))) {
          tryAddOption(option, false, false);
        }
      }
    }
  }
  if (allPlanningRequirementsSatisfied(state, allGoalTargets, constraints)) {
    for (const option of candidateOptions) {
      tryAddOption(option, false);
    }
  }

  return Array.from(state.selected.values()).sort((left, right) => {
    const leftTerminal = isTerminalNode(left.node);
    const rightTerminal = isTerminalNode(right.node);
    if (leftTerminal !== rightTerminal) {
      return leftTerminal ? 1 : -1;
    }
    return prerequisiteDepth(left.node, nodesById) - prerequisiteDepth(right.node, nodesById) ||
      right.score - left.score ||
      left.node.id.localeCompare(right.node.id);
  });
}

function addCandidateOptionToState(
  option: CandidateOption,
  state: SelectionState,
  completed: Set<string>,
): SelectionState | null {
  const newEntries = option.chain.entries.filter((candidate) => !state.selected.has(candidate.node.id));
  if (newEntries.length === 0) {
    return null;
  }
  if (Array.from(state.selected.values()).some((candidate) => isTerminalNode(candidate.node))) {
    return null;
  }
  const newEstimatedMinutes = newEntries.reduce(
    (sum, candidate) => sum + (completed.has(candidate.node.id)
      ? 0
      : requirePlanningUnit(candidate.node).estimatedTimeMinutes),
    0,
  );
  if (newEstimatedMinutes > state.remainingMinutes) {
    return null;
  }
  const selected = new Map(state.selected);
  for (const candidate of option.chain.entries) {
    if (selected.has(candidate.node.id)) continue;
    selected.set(candidate.node.id, candidate);
  }
  const coveredGoalTargets = new Set(state.coveredGoalTargets);
  for (const target of option.goalTargets) {
    coveredGoalTargets.add(target);
  }
  return {
    selected,
    coveredGoalTargets,
    includesRiskIntervention: state.includesRiskIntervention || option.includesRiskIntervention,
    remainingMinutes: state.remainingMinutes - newEstimatedMinutes,
  };
}

function canCompletePlanningRequirements(
  options: CandidateOption[],
  state: SelectionState,
  completed: Set<string>,
  allGoalTargets: Set<string>,
  constraints: AdaptiveLearningPathConstraints,
): boolean {
  if (allPlanningRequirementsSatisfied(state, allGoalTargets, constraints)) {
    return true;
  }
  for (const option of options) {
    const addsGoalTarget = option.goalTargets.some((target) => !state.coveredGoalTargets.has(target));
    const addsRequiredRiskIntervention = constraints.requireRiskIntervention &&
      !state.includesRiskIntervention &&
      option.includesRiskIntervention;
    if (!addsGoalTarget && !addsRequiredRiskIntervention) {
      continue;
    }
    const nextState = addCandidateOptionToState(option, state, completed);
    if (nextState && canCompletePlanningRequirements(options, nextState, completed, allGoalTargets, constraints)) {
      return true;
    }
  }
  return false;
}

function allPlanningRequirementsSatisfied(
  state: SelectionState,
  allGoalTargets: Set<string>,
  constraints: AdaptiveLearningPathConstraints,
): boolean {
  return allGoalTargetsCovered(state.coveredGoalTargets, allGoalTargets) &&
    (!constraints.requireRiskIntervention || state.includesRiskIntervention);
}

function allGoalTargetsCovered(coveredGoalTargets: Set<string>, allGoalTargets: Set<string>): boolean {
  return Array.from(allGoalTargets).every((target) => coveredGoalTargets.has(target));
}

function buildCandidateChain(
  entry: ScoredNode,
  nodesById: Map<string, ResourceNode>,
  scoredById: Map<string, ScoredNode>,
  goal: AdaptiveLearningPathGoal,
  graphContext: AdaptiveLearningPathGraphContextSummary | undefined,
): CandidateChain | null {
  if (hasCyclicPrerequisites(entry.node, nodesById)) return null;
  const entries = expandPrerequisites(entry, nodesById, scoredById);
  const uniqueEntries = uniqueScoredEntries(entries);
  const missingPrerequisite = uniqueEntries.some((candidate) =>
    requirePlanningUnit(candidate.node).prerequisites.some((id) => !nodesById.has(id))
  );
  if (missingPrerequisite) return null;
  return {
    entries: uniqueEntries,
    estimatedMinutes: uniqueEntries.reduce((sum, candidate) =>
      sum + requirePlanningUnit(candidate.node).estimatedTimeMinutes, 0),
    coversGoalTarget: uniqueEntries.some((candidate) => nodeCoversGoalTarget(candidate.node, goal, graphContext)),
  };
}

function uniqueScoredEntries(entries: ScoredNode[]): ScoredNode[] {
  const result = new Map<string, ScoredNode>();
  for (const entry of entries) {
    if (!result.has(entry.node.id)) {
      result.set(entry.node.id, entry);
    }
  }
  return Array.from(result.values());
}

function expandRepairCandidateEntries(
  seedEntries: ScoredNode[],
  registry: ResourceNodeRegistry,
  eligibleIds: Set<string>,
  completedNodeIds: string[],
  constraints: AdaptiveLearningPathConstraints,
  learnerState: AdaptiveLearningPathLearnerState | null,
): ScoredNode[] {
  const nodesById = new Map(registry.nodes.filter((node) => eligibleIds.has(node.id)).map((node) => [node.id, node]));
  const entriesById = new Map(seedEntries.map((entry) => [entry.node.id, entry]));
  const queue = [...seedEntries];

  while (queue.length > 0) {
    const entry = queue.shift()!;
    const planningUnit = planningUnitForNode(entry.node);
    const readiness = evaluateNodeReadiness(entry.node, learnerState, constraints, completedNodeIds);
    const relatedNodeIds = unique([
      ...(planningUnit?.prerequisites ?? []),
      ...readiness.fallbackNodeIds,
    ]);

    for (const nodeId of relatedNodeIds) {
      if (entriesById.has(nodeId)) continue;
      const node = nodesById.get(nodeId);
      if (!node) continue;
      const repairEntry: ScoredNode = {
        node,
        score: 0,
        reasonCodes: ['repair-support-candidate'],
      };
      entriesById.set(nodeId, repairEntry);
      queue.push(repairEntry);
    }
  }

  return Array.from(entriesById.values());
}

function nodeCoversGoalTarget(
  node: ResourceNode,
  goal: AdaptiveLearningPathGoal,
  graphContext?: AdaptiveLearningPathGraphContextSummary,
): boolean {
  const planningUnit = planningUnitForNode(node);
  if (!planningUnit) return false;
  if (graphContext?.targetGraphNodeIds.length) {
    return graphTargetsCoveredByPlanningUnit(planningUnit, graphContext).length > 0;
  }
  return goal.knowledgeTargets.some((target) => planningUnitCoversKnowledgeTarget(planningUnit, goal, target)) ||
    Object.keys(planningUnit.abilityImpact).some((dimension) =>
      (goal.competencyTargets ?? []).includes(dimension)
    );
}

function goalTargetsCoveredByNodes(
  nodes: ResourceNode[],
  goal: AdaptiveLearningPathGoal,
  graphContext?: AdaptiveLearningPathGraphContextSummary,
): string[] {
  const covered = new Set<string>();
  for (const node of nodes) {
    const planningUnit = planningUnitForNode(node);
    if (!planningUnit) continue;
    if (graphContext?.targetGraphNodeIds.length) {
      for (const target of graphTargetsCoveredByPlanningUnit(planningUnit, graphContext)) {
        covered.add(target);
      }
      continue;
    }
    for (const target of goal.knowledgeTargets) {
      if (planningUnitCoversKnowledgeTarget(planningUnit, goal, target)) {
        covered.add(target);
      }
    }
    for (const target of goal.competencyTargets ?? []) {
      if (Object.prototype.hasOwnProperty.call(planningUnit.abilityImpact, target)) {
        covered.add(target);
      }
    }
  }
  return Array.from(covered);
}

function hasCyclicPrerequisites(
  node: ResourceNode,
  nodesById: Map<string, ResourceNode>,
  visiting = new Set<string>(),
  visited = new Set<string>(),
): boolean {
  if (visiting.has(node.id)) return true;
  if (visited.has(node.id)) return false;
  visiting.add(node.id);
  for (const prerequisiteId of planningUnitForNode(node)?.prerequisites ?? []) {
    const prerequisite = nodesById.get(prerequisiteId);
    if (prerequisite && hasCyclicPrerequisites(prerequisite, nodesById, visiting, visited)) {
      return true;
    }
  }
  visiting.delete(node.id);
  visited.add(node.id);
  return false;
}

function isTerminalNode(node: ResourceNode): boolean {
  return node.planningMetadata.terminalConstraints.includes('terminal-node') ||
    node.planningMetadata.terminalConstraints.includes('terminal-validation');
}

function isRiskInterventionNode(node: ResourceNode): boolean {
  return node.type === 'reflection' || node.type === 'ai_intervention';
}

function chainHasTerminalViolation(entries: ScoredNode[]): boolean {
  const terminalIndexes = entries
    .map((entry, index) => isTerminalNode(entry.node) ? index : -1)
    .filter((index) => index >= 0);
  return terminalIndexes.length > 1 ||
    (terminalIndexes.length === 1 && terminalIndexes[0] !== entries.length - 1);
}

function uncoveredGoalTargets(
  nodes: ResourceNode[],
  goal: AdaptiveLearningPathGoal,
  graphContext?: AdaptiveLearningPathGraphContextSummary,
): string[] {
  const planningUnits = nodes
    .map((node) => planningUnitForNode(node))
    .filter((unit): unit is PlanningUnit => Boolean(unit));
  if (graphContext?.targetGraphNodeIds.length) {
    const coveredGraphTargets = new Set(planningUnits.flatMap((unit) =>
      graphTargetsCoveredByPlanningUnit(unit, graphContext)
    ));
    return graphContext.targetGraphNodeIds.filter((target) => !coveredGraphTargets.has(target));
  }
  const coveredKnowledge = new Set([
    ...planningUnits.flatMap((unit) => unit.knowledgeCoverage),
    ...planningUnits.map((unit) => unit.resourceNodeId),
  ]);
  const coveredCompetencies = new Set(planningUnits.flatMap((unit) => Object.keys(unit.abilityImpact)));
  return [
    ...goal.knowledgeTargets.filter((target) =>
      knowledgeTargetCoverageRefs(goal, target).every((ref) => !coveredKnowledge.has(ref))
    ),
    ...(goal.competencyTargets ?? []).filter((target) => !coveredCompetencies.has(target)),
  ];
}

function graphTargetsCoveredByPlanningUnit(
  planningUnit: PlanningUnit,
  graphContext: AdaptiveLearningPathGraphContextSummary,
): string[] {
  const refs = new Set([
    ...planningUnit.graphNodeRefs.knowledge,
    ...planningUnit.graphNodeRefs.capability,
    ...planningUnit.graphNodeRefs.quality,
    ...planningUnit.knowledgeCoverage,
    ...Object.keys(planningUnit.abilityImpact),
  ]);
  return graphContext.targetGraphNodeIds.filter((target) =>
    refs.has(target) ||
    graphContext.resourceCoveragePathEligibleResourceIds[target]?.includes(planningUnit.resourceNodeId)
  );
}

function graphMatchedRefsForRanker(
  planningUnit: PlanningUnit,
  graphContext: AdaptiveLearningPathGraphContextSummary,
): ResourceGraphNodeRefs {
  return graphTargetsCoveredByPlanningUnit(planningUnit, graphContext).reduce<ResourceGraphNodeRefs>((refs, target) => {
    if (planningUnit.graphNodeRefs.capability.includes(target) || target.startsWith('capability:') || target.startsWith('cap:')) {
      refs.capability.push(target);
    } else if (planningUnit.graphNodeRefs.quality.includes(target) || target.startsWith('quality:') || target.startsWith('qual:')) {
      refs.quality.push(target);
    } else {
      refs.knowledge.push(target);
    }
    return refs;
  }, {
    knowledge: [],
    capability: [],
    quality: [],
  });
}

function graphTargetsCoveredByScoredNodes(
  scoredNodes: ScoredNode[],
  graphContext: AdaptiveLearningPathGraphContextSummary,
): string[] {
  return unique(scoredNodes.flatMap((entry) => {
    const planningUnit = planningUnitForNode(entry.node);
    return planningUnit ? graphTargetsCoveredByPlanningUnit(planningUnit, graphContext) : [];
  }));
}

function shouldRedactBlockedNode(node: ResourceNode, reasonCodes: string[]): boolean {
  return node.planningMetadata.privacyLevel !== 'student-visible' ||
    reasonCodes.includes('privacy-scope-blocked') ||
    reasonCodes.includes('teacher-policy-blocked') ||
    reasonCodes.includes('teacher-policy-teacher-only') ||
    reasonCodes.includes('teacher-assignment-required');
}

function expandPrerequisites(
  entry: ScoredNode,
  nodesById: Map<string, ResourceNode>,
  scoredById: Map<string, ScoredNode>,
  seen = new Set<string>(),
): ScoredNode[] {
  if (seen.has(entry.node.id)) return [];
  seen.add(entry.node.id);
  const prerequisites = requirePlanningUnit(entry.node).prerequisites
    .map((id) => nodesById.get(id))
    .filter((node): node is ResourceNode => Boolean(node))
    .flatMap((node) => expandPrerequisites(scoredById.get(node.id) ?? {
      node,
      score: 0.5,
      reasonCodes: ['required-prerequisite'],
    }, nodesById, scoredById, seen));
  return [...prerequisites, entry];
}

function prerequisiteDepth(node: ResourceNode, nodesById: Map<string, ResourceNode>, seen = new Set<string>()): number {
  if (seen.has(node.id)) return 0;
  seen.add(node.id);
  const planningUnit = planningUnitForNode(node);
  if (!planningUnit || planningUnit.prerequisites.length === 0) return 0;
  return 1 + Math.max(
    ...planningUnit.prerequisites
      .map((id) => nodesById.get(id))
      .filter((item): item is ResourceNode => Boolean(item))
      .map((item) => prerequisiteDepth(item, nodesById, seen)),
    0,
  );
}

function firstReadyCurrentNodeId(
  nodeIds: readonly string[],
  completedNodeIds: readonly string[],
  isReady: (nodeId: string) => boolean,
  preferredCurrentNodeId?: string | null,
): string | null {
  const completed = new Set(completedNodeIds);
  if (
    preferredCurrentNodeId &&
    !completed.has(preferredCurrentNodeId) &&
    nodeIds.includes(preferredCurrentNodeId) &&
    isReady(preferredCurrentNodeId)
  ) {
    return preferredCurrentNodeId;
  }
  for (const nodeId of nodeIds) {
    if (completed.has(nodeId)) continue;
    return isReady(nodeId) ? nodeId : null;
  }
  return null;
}

function toItemTypeTerminalValidationPlanNode(
  resolution: ItemTypeTerminalValidationResolution,
  mainPath: AdaptiveLearningPathPlanNode[],
  goalId: string,
): AdaptiveLearningPathPlanNode | null {
  if (resolution.status !== 'ready' || !resolution.catalogItemId || !resolution.taskId) return null;
  const nodeId = `item-type-terminal-validation:${resolution.catalogItemId}`;
  const prerequisiteNodeIds = mainPath.at(-1) ? [mainPath.at(-1)!.nodeId] : [];
  return {
    nodeId,
    title: '题目型终结验证',
    type: 'adaptive_quiz',
    pathNodeType: 'adaptive_quiz',
    displayName: '题目型终结验证',
    iconKey: 'adaptive-quiz',
    shapeHint: 'task',
    evidenceBehavior: 'assessment',
    evidenceStatus: 'instrumented',
    externalResource: null,
    checkpoint: {
      assessmentPurpose: 'terminal-validation',
      criteria: ['item-type-terminal-validation'],
      requiredEvidenceRefs: [resolution.catalogItemId],
      remediationBehavior: null,
      reviewState: 'review',
    },
    sourceKind: 'checkpoint',
    sourceRef: resolution.catalogItemId,
    target: `/assessment/adaptive-practice?goalId=${encodeURIComponent(goalId)}&questionScope=terminal-validation`,
    estimatedTimeMinutes: 8,
    cognitiveLoad: 'high',
    prerequisiteNodeIds,
    prerequisiteBasis: prerequisiteNodeIds.map((id) => ({ nodeId: id, source: 'PlanningUnit' })),
    knowledgeCoverage: [],
    launchBinding: {
      kind: 'checkpoint-contract',
      target: `/assessment/adaptive-practice?goalId=${encodeURIComponent(goalId)}&questionScope=terminal-validation`,
      sourceRef: { kind: 'checkpoint', ref: resolution.catalogItemId },
    },
    teacherPolicy: 'allowed',
    privacyLevel: 'student-visible',
    terminalConstraints: ['terminal-validation'],
    score: 1,
    reasonCodes: ['item-type-terminal-validation'],
    status: mainPath.length === 0 ? 'current' : 'next',
  };
}

function toPlanNode(
  entry: ScoredNode,
  currentNodeId: string | null,
  completedNodeIds: string[],
  readiness: AdaptiveLearningPathNodeReadiness,
): AdaptiveLearningPathPlanNode {
  const planningUnit = requirePlanningUnit(entry.node);
  const isCompleted = completedNodeIds.includes(entry.node.id);
  const locked = !isCompleted && readiness.state !== 'ready';
  return {
    nodeId: entry.node.id,
    planningUnitId: planningUnit.id,
    resourceId: planningUnit.resourceId,
    resourceNodeId: planningUnit.resourceNodeId,
    title: entry.node.title,
    type: entry.node.type,
    pathNodeType: planningUnit.pathSemantics.type,
    displayName: planningUnit.pathSemantics.displayName,
    iconKey: planningUnit.pathSemantics.iconKey,
    shapeHint: planningUnit.pathSemantics.shapeHint,
    evidenceBehavior: planningUnit.pathSemantics.evidenceBehavior,
    evidenceStatus: pathNodeEvidenceStatus(entry.node),
    externalResource: entry.node.externalResource,
    checkpoint: entry.node.checkpoint,
    sourceKind: entry.node.sourceKind,
    sourceRef: entry.node.sourceRef,
    target: planningUnit.target,
    estimatedTimeMinutes: planningUnit.estimatedTimeMinutes,
    cognitiveLoad: planningUnit.cognitiveLoad,
    effort: planningUnit.effort,
    prerequisiteNodeIds: planningUnit.prerequisites,
    prerequisiteBasis: planningUnit.prerequisites.map((nodeId) => ({ nodeId, source: 'PlanningUnit' })),
    knowledgeCoverage: planningUnit.knowledgeCoverage,
    capabilityTargets: Object.keys(planningUnit.abilityImpact).sort((left, right) => left.localeCompare(right)),
    launchBinding: planningUnit.launchBinding,
    teacherPolicy: planningUnit.teacherPolicy,
    privacyLevel: planningUnit.privacyLevel,
    terminalConstraints: entry.node.planningMetadata.terminalConstraints,
    score: entry.score,
    reasonCodes: entry.reasonCodes,
    resourceRanker: entry.resourceRanker,
    status: isCompleted ? 'completed' : locked ? 'locked' : entry.node.id === currentNodeId ? 'current' : 'next',
    readiness,
  };
}

function toRepairCandidate(
  entry: ScoredNode,
  completedNodeIds: string[],
  constraints: AdaptiveLearningPathConstraints,
  learnerState: AdaptiveLearningPathLearnerState | null,
  checkpointResourceTypes: Set<ResourceNode['type']>,
  forcedCheckpointNodeIds: Set<string>,
  coverageTargetIds: string[],
): PathConstraintRepairCandidate {
  const planningUnit = requirePlanningUnit(entry.node);
  const readiness = evaluateNodeReadiness(entry.node, learnerState, constraints, completedNodeIds);
  const officialTerminalValidation = officialTerminalValidationReachable(
    entry.node,
    learnerState,
    constraints,
    completedNodeIds,
  );
  const previewTerminalValidation = !officialTerminalValidation &&
    entry.node.planningMetadata.terminalConstraints.includes('terminal-validation');
  const completed = completedNodeIds.includes(entry.node.id);
  const checkpointRole = entry.node.checkpoint ||
    entry.node.type === 'checkpoint' ||
    checkpointResourceTypes.has(entry.node.type) ||
    forcedCheckpointNodeIds.has(entry.node.id)
    ? entry.node.checkpoint?.assessmentPurpose ?? 'formative'
    : undefined;
  return {
    nodeId: entry.node.id,
    estimatedTimeMinutes: completed ? 0 : planningUnit.estimatedTimeMinutes,
    prerequisiteNodeIds: planningUnit.prerequisites,
    checkpointRole,
    terminalValidation: officialTerminalValidation
      ? 'official'
      : previewTerminalValidation ? 'preview' : undefined,
    locked: !completed &&
      readiness.state !== 'ready' &&
      (!readiness.reasonCodes.includes('readiness-metadata-missing') ||
        officialTerminalValidation ||
        previewTerminalValidation),
    fallbackNodeIds: readiness.fallbackNodeIds,
    removable: !officialTerminalValidation,
    serialOnly: planningUnit.effort === 'high' || entry.node.planningMetadata.cognitiveLoad === 'high',
    coverageTargetIds,
  };
}

function selectRepairCheckpointNodeIds(
  entries: ScoredNode[],
  registeredGoal: AdaptiveLearningPathRegisteredGoalDefinition | null,
): string[] {
  if (entries.length === 0) return [];
  const policy = registeredGoal?.checkpointPolicy;
  const preferred = policy
    ? entries
        .filter((entry) => policy.checkpointResourceTypes.includes(entry.node.type))
        .map((entry) => entry.node.id)
    : [];
  const minimum = Math.max(0, policy?.minCheckpoints ?? 0);
  if (preferred.length >= minimum) return preferred.slice(0, minimum);
  return preferred;
}

function pathNodeEvidenceStatus(node: ResourceNode): AdaptiveLearningPathPlanNode['evidenceStatus'] {
  if (node.type === 'external_resource') {
    if (node.externalResource?.evidenceUseStatus === 'explicit-access-required') return 'explicit-access-required';
    if (node.externalResource?.evidenceUseStatus === 'reference-only') return 'reference-only';
  }
  return (planningUnitForNode(node)?.evidenceInstrumentation.length ?? 0) > 0 ? 'instrumented' : 'missing';
}

function readyNodeReadiness(): AdaptiveLearningPathNodeReadiness {
  return {
    state: 'ready',
    message: '可以开始。',
    unlockMessage: null,
    reasonCodes: [],
    fallbackNodeIds: [],
    missingCompetencies: [],
    missingEvidenceCount: 0,
    missingCompletedNodeIds: [],
    missingOutcomeRefs: [],
  };
}

function refreshPathReadinessAfterFeedback(
  nodes: AdaptiveLearningPathPlanNode[],
  completedNodeIds: string[],
  context: Record<string, unknown> | undefined,
): AdaptiveLearningPathPlanNode[] {
  const completed = new Set(completedNodeIds);
  const availableOutcomeRefs = new Set(readStringArray(context?.availableOutcomeRefs));
  const evidenceReadinessDelta = readNonNegativeNumber(context?.evidenceReadinessDelta);
  return nodes.map((node) => {
    if (!node.readiness || node.readiness.state === 'ready') return node;
    if (node.readiness.reasonCodes.includes('readiness-metadata-missing')) return node;
    const missingCompletedNodeIds = node.readiness.missingCompletedNodeIds.filter((id) => !completed.has(id));
    const missingOutcomeRefs = node.readiness.missingOutcomeRefs.filter((ref) => !availableOutcomeRefs.has(ref));
    const missingEvidenceCount = Math.max(0, node.readiness.missingEvidenceCount - evidenceReadinessDelta);
    const readiness = {
      ...node.readiness,
      missingEvidenceCount,
      missingCompletedNodeIds,
      missingOutcomeRefs,
    };
    const ready = readiness.missingCompetencies.length === 0 &&
      readiness.missingEvidenceCount === 0 &&
      readiness.missingCompletedNodeIds.length === 0 &&
      readiness.missingOutcomeRefs.length === 0;
    return {
      ...node,
      readiness: ready ? readyNodeReadiness() : readiness,
    };
  });
}

function evaluateNodeReadiness(
  node: ResourceNode,
  learnerState: AdaptiveLearningPathLearnerState | null,
  constraints: AdaptiveLearningPathConstraints,
  completedNodeIds: string[],
): AdaptiveLearningPathNodeReadiness {
  const readiness = node.planningMetadata.readiness;
  if (!readiness) {
    if (requiresReadinessMetadataForImmediateExecution(node)) {
      return {
        state: 'locked',
        message: '该节点需要完成准备条件后才能解锁。',
        unlockMessage: '该节点需要完成准备条件后才能解锁。',
        reasonCodes: ['readiness-metadata-missing'],
        fallbackNodeIds: node.planningMetadata.prerequisites,
        missingCompetencies: [],
        missingEvidenceCount: 0,
        missingCompletedNodeIds: [],
        missingOutcomeRefs: [],
      };
    }
    return readyNodeReadiness();
  }

  const completed = new Set([...completedNodeIds, ...(constraints.completedNodeIds ?? [])]);
  const availableOutcomeRefs = new Set(constraints.availableOutcomeRefs ?? []);
  const missingCompetencies = Object.entries(readiness.minimumCompetency)
    .filter(([dimension, minimum]) => learnerCompetencyScore(learnerState, dimension) < minimum)
    .map(([dimension]) => dimension);
  const missingEvidenceCount = Math.max(0, readiness.minimumEvidenceCount - learnerEvidenceCount(learnerState, readiness));
  const missingCompletedNodeIds = readiness.requiredCompletedNodeIds.filter((nodeId) => !completed.has(nodeId));
  const missingOutcomeRefs = readiness.requiredOutcomeRefs.filter((ref) => !availableOutcomeRefs.has(ref));
  const reasonCodes = [
    missingCompetencies.length > 0 ? 'readiness-minimum-competency' : null,
    missingEvidenceCount > 0 ? 'readiness-minimum-evidence' : null,
    missingCompletedNodeIds.length > 0 ? 'readiness-required-completion' : null,
    missingOutcomeRefs.length > 0 ? 'readiness-required-outcome' : null,
  ].filter((code): code is string => Boolean(code));

  if (reasonCodes.length === 0) return readyNodeReadiness();

  return {
    state: missingCompletedNodeIds.length > 0 || missingOutcomeRefs.length > 0 || missingCompetencies.length > 0
      ? 'locked'
      : 'evidence-needed',
    message: readiness.unlockMessage,
    unlockMessage: readiness.unlockMessage,
    reasonCodes,
    fallbackNodeIds: readiness.fallbackNodeIds,
    missingCompetencies,
    missingEvidenceCount,
    missingCompletedNodeIds,
    missingOutcomeRefs,
  };
}

function requiresReadinessMetadataForImmediateExecution(node: ResourceNode): boolean {
  if (node.planningMetadata.cognitiveLoad !== 'high') return false;
  return node.type === 'simulation' ||
    node.type === 'arena_task' ||
    node.type === 'control_workbench' ||
    node.type === 'checkpoint' ||
    node.planningMetadata.terminalConstraints.length > 0;
}

function learnerCompetencyScore(
  learnerState: AdaptiveLearningPathLearnerState | null,
  dimension: string,
): number {
  if (!hasTrustedPortraitForPersonalization(learnerState)) return 0;
  const portraitScores = usablePortraitDimensionsForTarget(learnerState, dimension)
    .map((item) => item.score)
    .filter((score): score is number => typeof score === 'number' && Number.isFinite(score));
  if (portraitScores.length > 0) {
    return normalizeCompetencyScore(portraitScores.reduce((sum, score) => sum + score, 0) / portraitScores.length);
  }
  return 0;
}

function usablePortraitDimensionsForTarget(
  learnerState: AdaptiveLearningPathLearnerState | null,
  targetId: string,
): PortraitV2ProjectedPayload['dimensions'] {
  if (!hasTrustedPortraitForPersonalization(learnerState)) return [];
  return portraitDimensionIdsForTarget(targetId)
    .map((id) => learnerState?.primaryPortrait?.dimensions.find((item) => item.id === id))
    .filter((item): item is PortraitV2ProjectedPayload['dimensions'][number] => Boolean(item
      && item.evidenceSummary.totalCount > 0
      && (item.freshness.state === 'current' || item.freshness.state === 'partial')));
}

function normalizeCompetencyScore(score: number): number {
  return score > 1 ? score / 100 : score;
}

function portraitDimensionIdsForTarget(targetId: string): PortraitV2DimensionId[] {
  if (targetId === 'controlModeling' || targetId === 'parameterDesign' || targetId === 'crossDomainTransfer' ||
    targetId === 'engineeringDecision' || targetId === 'inquiryReflection' || targetId === 'selfDirectedLearning') {
    return mapLegacyCompetencyDimensionToPortraitV2(targetId).targetDimensions;
  }
  return [targetId as PortraitV2DimensionId];
}

function learnerEvidenceCount(
  learnerState: AdaptiveLearningPathLearnerState | null,
  readiness: ResourceNodeReadinessMetadata,
): number {
  if (!hasTrustedPortraitForPersonalization(learnerState)) return 0;
  const portraitCompetencyEvidence = Object.keys(readiness.minimumCompetency)
    .flatMap((dimension) => portraitDimensionIdsForTarget(dimension))
    .map((portraitDimensionId) =>
      learnerState?.primaryPortrait?.dimensions.find((dimension) => dimension.id === portraitDimensionId)
        ?.evidenceSummary.totalCount ?? 0,
    );
  const overallTrustedEvidence = Object.keys(readiness.minimumCompetency).length === 0
    ? learnerState?.primaryPortrait?.dimensions.map((dimension) => dimension.evidenceSummary.totalCount) ?? []
    : [];
  return Math.max(...portraitCompetencyEvidence, ...overallTrustedEvidence, 0);
}

function readStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function readNonNegativeNumber(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, value) : 0;
}

function buildAlternatives(
  scored: ScoredNode[],
  mainPath: AdaptiveLearningPathPlanNode[],
  blocked: AdaptiveLearningPathAlternative[],
  registry: ResourceNodeRegistry,
  eligibleIds: Set<string>,
  goal: AdaptiveLearningPathGoal,
  graphContext: AdaptiveLearningPathGraphContextSummary | undefined,
  constraints: AdaptiveLearningPathConstraints,
  completedNodeIds: string[],
): AdaptiveLearningPathAlternative[] {
  const selected = new Set(mainPath.map((node) => node.nodeId));
  const nodesById = new Map(registry.nodes.filter((node) => eligibleIds.has(node.id)).map((node) => [node.id, node]));
  const scoredById = new Map(scored.map((entry) => [entry.node.id, entry]));
  const completed = new Set(completedNodeIds);
  const activeGraphContext = graphContext && graphTargetsCoveredByScoredNodes(scored, graphContext).length > 0
    ? graphContext
    : undefined;
  const nonSelected = scored
    .filter((entry) => !selected.has(entry.node.id))
    .slice(0, 8)
    .map((entry) => {
      const chain = buildCandidateChain(entry, nodesById, scoredById, goal, activeGraphContext);
      const blockedByPrerequisite = !chain || !chain.coversGoalTarget;
      const blockedByTerminal = Boolean(chain && chainHasTerminalViolation(chain.entries));
      const remainingMinutes = chain?.entries.reduce(
        (sum, candidate) => sum + (completed.has(candidate.node.id)
          ? 0
          : requirePlanningUnit(candidate.node).estimatedTimeMinutes),
        0,
      ) ?? 0;
      const blockedByBudget = !blockedByPrerequisite && !blockedByTerminal && remainingMinutes > constraints.timeBudgetMinutes;
      return {
        nodeId: entry.node.id,
        nodeIds: chain?.entries
          .filter((candidate) => !completed.has(candidate.node.id))
          .map((candidate) => candidate.node.id) ?? [entry.node.id],
        title: entry.node.title,
        reasonCodes: blockedByPrerequisite
          ? ['infeasible-prerequisite-chain']
          : blockedByTerminal
            ? ['terminal-constraint-blocked']
          : blockedByBudget
            ? ['time-budget-insufficient']
          : entry.reasonCodes.length > 0 ? entry.reasonCodes : ['lower-objective-score'],
        score: blockedByPrerequisite || blockedByTerminal || blockedByBudget ? 0 : entry.score,
        resourceRanker: entry.resourceRanker,
        blocked: blockedByPrerequisite || blockedByTerminal || blockedByBudget,
      };
    })
    .filter((item) => item.blocked || item.nodeIds.length > 0);
  return [...nonSelected, ...blocked.slice(0, 8)];
}

function buildFallbackReasons(input: {
  learnerState: AdaptiveLearningPathLearnerState | null;
  deficits: AdaptiveLearningPathDeficit[];
  eligible: ResourceNode[];
  mainPathNodes: ScoredNode[];
  constraints: AdaptiveLearningPathConstraints;
  goal: AdaptiveLearningPathGoal;
  graphContext?: AdaptiveLearningPathGraphContextSummary;
  hasGraphCandidateCoverage: boolean;
  attemptedCandidates: number;
  policyFamily: AdaptiveLearningPathPolicyFamily;
}): string[] {
  const reasons: string[] = [];
  const confidence = input.learnerState?.evidence?.confidence;
  const activeGraphContext = input.hasGraphCandidateCoverage ? input.graphContext : undefined;
  const uncoveredTargets = uncoveredGoalTargets(
    input.mainPathNodes.map((entry) => entry.node),
    input.goal,
    activeGraphContext,
  );
  if (!input.learnerState) reasons.push('learner-state-missing');
  if (input.learnerState?.primaryPortraitState === 'NO_EVIDENCE') {
    reasons.push('trusted-portrait-no-evidence');
  } else if (input.learnerState && !hasTrustedPortraitForPersonalization(input.learnerState)) {
    reasons.push('trusted-portrait-unavailable');
  }
  if ((confidence?.score ?? 0) < 0.35 || (confidence?.evidenceCount ?? 0) === 0) reasons.push('learner-evidence-low-confidence');
  if (input.deficits.length === 0) reasons.push('learner-deficit-not-detected');
  const hasGraphStarterPath = input.hasGraphCandidateCoverage
    ? input.mainPathNodes.some((entry) => nodeCoversGoalTarget(entry.node, input.goal, input.graphContext))
    : input.mainPathNodes.length > 0;
  if (input.hasGraphCandidateCoverage && hasGraphStarterPath && uncoveredTargets.length > 0) {
    reasons.push('graph-target-coverage-partial');
  }
  if (input.eligible.length === 0 || input.attemptedCandidates === 0 || (!hasGraphStarterPath && uncoveredTargets.length > 0)) {
    reasons.push('resource-mapping-insufficient');
  }
  if (
    input.attemptedCandidates > 0 &&
    !input.mainPathNodes.some((entry) => nodeCoversGoalTarget(entry.node, input.goal, activeGraphContext))
  ) {
    reasons.push('feasible-goal-path-missing');
  }
  if (input.graphContext?.limitations.some((item) => item.code === 'learning-goal-baseline-incomplete')) {
    reasons.push('learning-goal-baseline-incomplete');
  }
  if (input.graphContext?.limitations.some((item) => item.code === 'learning-goal-assessment-coverage-incomplete')) {
    reasons.push('learning-goal-assessment-coverage-incomplete');
  }
  if (input.attemptedCandidates > 0 && input.mainPathNodes.length === 0) {
    reasons.push('time-budget-insufficient');
  }
  if (
    input.constraints.requireRiskIntervention &&
    !input.mainPathNodes.some((entry) => entry.node.type === 'reflection' || entry.node.type === 'ai_intervention')
  ) {
    reasons.push('risk-intervention-resource-missing');
  }
  if (input.policyFamily === 'teacher-assigned' && input.mainPathNodes.length === 0) {
    reasons.push('teacher-assignment-resource-missing');
  }
  if (
    requiresTerminalValidation(input.goal) &&
    !endsWithTerminalValidationNode(input.mainPathNodes)
  ) {
    reasons.push('terminal-validation-resource-missing');
  }
  return unique(reasons);
}

export function isPathBlockingFallbackReason(reason: string): boolean {
  return [
    'resource-mapping-insufficient',
    'feasible-goal-path-missing',
    'time-budget-insufficient',
    'risk-intervention-resource-missing',
    'teacher-assignment-resource-missing',
    'terminal-validation-resource-missing',
    'terminal-validation-not-final',
    'locked-node-without-fallback',
    'hard-prerequisite-missing',
    'learning-goal-assessment-coverage-incomplete',
    'course-plugin-unavailable',
  ].includes(reason);
}

function goalAllowsResourceNode(
  node: ResourceNode,
  registeredGoal: AdaptiveLearningPathRegisteredGoalDefinition | null,
): boolean {
  return node.publishedResource?.recommendable === true || !registeredGoal || registeredGoal.allowedResourceMix.includes(node.type);
}

interface LearningGoalObjectiveBoundary {
  knowledgeObjectiveIds: string[];
  capabilityObjectiveIds: string[];
  qualityObjectiveIds: string[];
  graphNodeIds: string[];
  prerequisiteGraphNodeIds: string[];
  policyRequiredRoles: string[];
  hasPathEligibleCoverage: boolean;
}

interface LearningGoalObjectiveBoundaryEvaluation {
  allowed: boolean;
  matchedRefs: string[];
  matchReasons: string[];
}

function buildLearningGoalObjectiveBoundary(
  registeredGoal: AdaptiveLearningPathRegisteredGoalDefinition | null,
  graphContext: AdaptiveLearningPathGraphContextSummary | undefined,
): LearningGoalObjectiveBoundary | null {
  const learningGoal = registeredGoal?.learningGoal;
  if (!learningGoal || !graphContext?.targetGraphNodeIds.length) return null;
  const knowledgeObjectiveIds = unique([
    ...learningGoal.knowledgeObjectiveIds,
    ...graphContext.objectiveBoundary.knowledgeObjectiveIds,
  ]);
  const capabilityObjectiveIds = unique([
    ...learningGoal.capabilityObjectiveIds,
    ...graphContext.objectiveBoundary.capabilityObjectiveIds,
  ]);
  const qualityObjectiveIds = unique([
    ...learningGoal.qualityObjectiveIds,
    ...graphContext.objectiveBoundary.qualityObjectiveIds,
  ]);
  const objectiveGraphNodeIds = unique([
    ...knowledgeObjectiveIds,
    ...capabilityObjectiveIds,
    ...qualityObjectiveIds,
  ].map(objectiveIdToGraphNodeId));
  const prerequisiteGraphNodeIds = unique(graphContext.prerequisitePolicy
    .filter((entry) => entry.required)
    .flatMap((entry) => [entry.sourceNodeId, entry.targetNodeId]));
  const policyRequiredRoles = unique([
    ...(registeredGoal.checkpointPolicy.minCheckpoints > 0 ? ['checkpoint'] : []),
    ...(registeredGoal.checkpointPolicy.requiresTerminalValidation ? ['terminal-validation'] : []),
  ]);
  const hasPathEligibleCoverage = Object.values(graphContext.resourceCoverageStatus)
    .some((coverage) => coverage.pathEligibleResourceCount > 0);
  return {
    knowledgeObjectiveIds,
    capabilityObjectiveIds,
    qualityObjectiveIds,
    graphNodeIds: unique([
      ...learningGoal.targetGraphNodeIds,
      ...graphContext.targetGraphNodeIds,
      ...objectiveGraphNodeIds,
      ...prerequisiteGraphNodeIds,
    ]),
    prerequisiteGraphNodeIds,
    policyRequiredRoles,
    hasPathEligibleCoverage,
  };
}

function objectiveIdToGraphNodeId(objectiveId: string): string {
  if (objectiveId.startsWith('knowledge:')) return objectiveId.replace(/^knowledge:/, 'kn:');
  if (objectiveId.startsWith('capability:')) return objectiveId.replace(/^capability:/, 'cap:');
  if (objectiveId.startsWith('quality:')) return objectiveId.replace(/^quality:/, 'qual:');
  return objectiveId;
}

function evaluateLearningGoalObjectiveBoundary(
  node: ResourceNode,
  boundary: LearningGoalObjectiveBoundary,
  graphContext: AdaptiveLearningPathGraphContextSummary | undefined,
  registeredGoal: AdaptiveLearningPathRegisteredGoalDefinition | null,
  constraints: AdaptiveLearningPathConstraints,
): LearningGoalObjectiveBoundaryEvaluation {
  const planningUnit = planningUnitForNode(node);
  if (!planningUnit) return { allowed: false, matchedRefs: [], matchReasons: ['missing-planning-unit'] };
  const refs = new Set([
    ...planningUnit.graphNodeRefs.knowledge,
    ...planningUnit.graphNodeRefs.capability,
    ...planningUnit.graphNodeRefs.quality,
    ...planningUnit.knowledgeCoverage,
    ...Object.keys(planningUnit.abilityImpact),
  ]);
  const matchedRefs = new Set<string>();
  const matchReasons = new Set<string>();
  for (const graphNodeId of boundary.graphNodeIds) {
    if (
      refs.has(graphNodeId) ||
      graphContext?.resourceCoveragePathEligibleResourceIds[graphNodeId]?.includes(planningUnit.resourceNodeId)
    ) {
      matchedRefs.add(graphNodeId);
      matchReasons.add('graph-boundary');
    }
  }
  if (
    boundary.hasPathEligibleCoverage &&
    boundary.policyRequiredRoles.includes('terminal-validation') &&
    isTerminalValidationNode(node)
  ) {
    matchedRefs.add('policy:terminal-validation');
    matchReasons.add('policy-required-terminal-validation');
  }
  if (
    boundary.hasPathEligibleCoverage &&
    boundary.policyRequiredRoles.includes('checkpoint') &&
    registeredGoal?.checkpointPolicy.checkpointResourceTypes.includes(node.type)
  ) {
    matchedRefs.add('policy:checkpoint');
    matchReasons.add('policy-required-checkpoint');
  }
  if (constraints.requireRiskIntervention && isRiskInterventionNode(node)) {
    matchedRefs.add('policy:risk-intervention');
    matchReasons.add('policy-required-remediation');
  }
  return {
    allowed: matchedRefs.size > 0,
    matchedRefs: Array.from(matchedRefs).sort((left, right) => left.localeCompare(right)),
    matchReasons: Array.from(matchReasons).sort((left, right) => left.localeCompare(right)),
  };
}

function buildLearningGoalObjectiveBoundaryDiagnostics(input: {
  boundary: LearningGoalObjectiveBoundary;
  evaluations: Map<string, LearningGoalObjectiveBoundaryEvaluation>;
  mainPath: AdaptiveLearningPathPlanNode[];
  fallbackReasons: string[];
}): AdaptiveLearningPathObjectiveBoundaryDiagnostics {
  const lowResourceReasons = input.fallbackReasons.filter((reason) => [
    'resource-mapping-insufficient',
    'feasible-goal-path-missing',
    'graph-target-coverage-partial',
    'terminal-validation-resource-missing',
    'checkpoint-resource-missing',
    'learning-goal-baseline-incomplete',
  ].includes(reason));
  return {
    acceptedBoundaryRefs: {
      knowledgeObjectiveIds: input.boundary.knowledgeObjectiveIds,
      capabilityObjectiveIds: input.boundary.capabilityObjectiveIds,
      qualityObjectiveIds: input.boundary.qualityObjectiveIds,
      graphNodeIds: input.boundary.graphNodeIds,
      prerequisiteGraphNodeIds: input.boundary.prerequisiteGraphNodeIds,
      policyRequiredRoles: input.boundary.policyRequiredRoles,
    },
    rejectedMismatchCount: Array.from(input.evaluations.values())
      .filter((evaluation) => !evaluation.allowed).length,
    selectedResourceMatches: input.mainPath
      .map((node) => {
        const evaluation = input.evaluations.get(node.nodeId);
        return evaluation?.matchedRefs.length
          ? { nodeId: node.nodeId, matchRefs: evaluation.matchedRefs, matchReasons: evaluation.matchReasons }
          : null;
      })
      .filter((item): item is NonNullable<typeof item> => Boolean(item)),
    lowResourceReasons,
  };
}

function externalResourceAllowed(
  node: ResourceNode,
  input: AdaptiveLearningPathPlannerInput,
  registeredGoal: AdaptiveLearningPathRegisteredGoalDefinition | null,
): boolean {
  if (node.type !== 'external_resource') return true;
  const allowed = input.allowExternalResources ?? registeredGoal?.starterPathPolicy.allowExternalResources ?? false;
  return allowed && (
    !node.externalResource?.applicableGoalId ||
    node.externalResource.applicableGoalId === input.goal.id
  );
}

function resolvePolicyBundleRequest(
  input: AdaptiveLearningPathPlannerInput,
  confidence: AdaptiveLearningPathPlan['confidence'],
  registeredGoal: AdaptiveLearningPathRegisteredGoalDefinition | null,
): AdaptiveLearningPathPlannerInput['policyBundle'] {
  if (input.policyBundle) return input.policyBundle;
  if (!registeredGoal) return undefined;
  const evidenceCount = input.learnerState?.evidence?.confidence?.evidenceCount ?? 0;
  const needsStarterOptions = !input.learnerState || confidence.level === 'low' || evidenceCount <= 1;
  if (!needsStarterOptions) return undefined;
  const { policyFamilies, targetOptionCount } = registeredGoal.starterPathPolicy;
  if (policyFamilies.length !== targetOptionCount) {
    throw new Error(
      `Adaptive path goal "${input.goal.id}" declares ${policyFamilies.length} starter policy families ` +
      `but targetOptionCount ${targetOptionCount}; the starter candidate count contract is misconfigured.`,
    );
  }
  return {
    families: policyFamilies,
    overlapThreshold: 0.95,
  };
}

function buildStudentFacingPathExplanation(plan: AdaptiveLearningPathPlan): AdaptiveLearningPathPersistenceRecord['payload']['studentFacing'] {
  const registeredGoal = getRegisteredAdaptiveLearningPathGoal(plan.goal.id);
  const templates = registeredGoal?.explanationTemplates;
  const fallbackReasons = plan.explanations.fallbackReasons;
  const summary = fallbackReasons.includes('learner-state-missing')
    ? templates?.coldStart ?? '证据还少，先从入门路径开始，系统会随学习过程调整。'
    : fallbackReasons.includes('learner-evidence-low-confidence')
      ? templates?.lowConfidence ?? '当前证据不足，先沿可执行路径学习，后续会根据新证据调整。'
      : plan.status === 'ready'
        ? templates?.ready ?? '已根据当前学习证据生成可执行路径。'
        : templates?.fallback ?? '当前只能给出保守路径建议，请先完成可用资源并补充学习证据。';
  const nextAction = plan.currentNodeId
    ? `从“${plan.mainPath.find((node) => node.nodeId === plan.currentNodeId)?.title ?? '当前节点'}”开始。`
    : '先完成可用的基础资源，系统会继续更新路径。';
  const confidenceLabel = plan.confidence.level === 'high'
    ? '证据充分'
    : plan.confidence.level === 'medium'
      ? '证据基本可用'
      : '证据较少';
  return {
    summary,
    nextAction,
    confidenceLabel,
  };
}

function requiresTerminalValidation(goal: AdaptiveLearningPathGoal): boolean {
  return getRegisteredAdaptiveLearningPathGoal(goal.id)?.checkpointPolicy.requiresTerminalValidation ?? false;
}

function isTerminalValidationNode(node: ResourceNode): boolean {
  return (node.type === 'simulation' || node.type === 'arena_task') &&
    node.planningMetadata.terminalConstraints.includes('terminal-validation');
}

function officialTerminalValidationReachable(
  node: ResourceNode,
  learnerState: AdaptiveLearningPathLearnerState | null,
  constraints: AdaptiveLearningPathConstraints,
  completedNodeIds: string[],
): boolean {
  if (!isTerminalValidationNode(node)) return false;
  const readiness = evaluateNodeReadiness(node, learnerState, constraints, completedNodeIds);
  const pathCanCloseRemainingGates =
    readiness.missingCompletedNodeIds.length > 0 || readiness.missingOutcomeRefs.length > 0;
  if (pathCanCloseRemainingGates) return true;
  return readiness.missingCompetencies.length === 0 && readiness.missingEvidenceCount === 0;
}

function endsWithTerminalValidationNode(entries: ScoredNode[]): boolean {
  const last = entries.at(-1);
  return last ? isTerminalValidationNode(last.node) : false;
}

function buildPlanScore(
  mainPath: AdaptiveLearningPathPlanNode[],
  alternatives: AdaptiveLearningPathAlternative[],
  learnerState: AdaptiveLearningPathLearnerState | null,
  constraints: AdaptiveLearningPathConstraints,
): AdaptiveLearningPathScore {
  const learningGain = round(mainPath.reduce((sum, node) => sum + node.score, 0), 3);
  const engagement = round(mainPath.filter((node) =>
    learnerState?.resourcePreference?.preferredModalities?.includes(node.type)
  ).length / Math.max(mainPath.length, 1), 3);
  const estimatedTime = remainingTeachingEstimatedMinutes(mainPath);
  const constraintSatisfaction = estimatedTime <= constraints.timeBudgetMinutes && mainPath.length > 0 ? 1 : 0;
  const diversity = round(new Set(mainPath.map((node) => node.type)).size / Math.max(mainPath.length, 1), 3);
  const fatigue = round(Math.max(0, 1 - estimatedTime / Math.max(constraints.timeBudgetMinutes, 1)), 3);
  const dropoutRisk = alternatives.some((item) => item.reasonCodes.includes('risk-intervention-fit')) ? 0.6 : 0.8;
  const total = round(
    learningGain * 0.34 +
    engagement * 0.14 +
    constraintSatisfaction * 0.22 +
    diversity * 0.12 +
    fatigue * 0.1 +
    dropoutRisk * 0.08,
    3,
  );
  return {
    total,
    objectives: {
      learningGain,
      engagement,
      constraintSatisfaction,
      diversity,
      fatigue,
      dropoutRisk,
    },
  };
}

function canonicalSourceRefForNode(node: ResourceNode): string {
  const registryRef = node.sourceRefs.find((source) => source.kind === 'resource_registry');
  const teachingRef = node.sourceRefs.find((source) => source.kind === 'teaching_resource');
  const canonicalRef = registryRef ?? teachingRef;
  if (canonicalRef) return `resource:${canonicalRef.ref}`;
  return `${node.sourceKind}:${node.sourceRef}`;
}

function isRetryExcludedCoreCandidate(
  node: ResourceNode,
  retryContext?: PolicyFamilyRetryContext,
): boolean {
  if (!retryContext || retryContext.excludedCanonicalCoreRefs.size === 0) return false;
  const canonicalRef = canonicalSourceRefForNode(node);
  if (!retryContext.excludedCanonicalCoreRefs.has(canonicalRef)) return false;
  const disposition = node.planningMetadata.pathDisposition?.kind;
  if (disposition === 'supporting-citation' || disposition === 'embedded-asset') return false;
  if (node.checkpoint || node.type === 'checkpoint') return false;
  if (node.planningMetadata.terminalConstraints.some((constraint) =>
    constraint === 'terminal-validation' || constraint === 'terminal-node'
  )) return false;
  return true;
}

function isItemTypeTerminalValidationPlanNode(node: AdaptiveLearningPathPlanNode): boolean {
  return node.nodeId.startsWith('item-type-terminal-validation:')
    || node.checkpoint?.assessmentPurpose === 'terminal-validation';
}

function isStructuralPolicySharedNode(
  node: AdaptiveLearningPathPlanNode,
  registry: ResourceNodeRegistry,
  requiredPrerequisiteNodeIds: Set<string>,
): boolean {
  if (node.pathNodeType === 'checkpoint' || node.type === 'checkpoint') return true;
  if (node.reasonCodes.includes('checkpoint-required')) return true;
  if (node.reasonCodes.includes('required-prerequisite')) return true;
  if (requiredPrerequisiteNodeIds.has(node.nodeId)) return true;
  if (node.reasonCodes.some((code) => code.startsWith('policy-') && code.endsWith('-support'))) return true;
  if (node.terminalConstraints.some((constraint) =>
    constraint === 'terminal-validation' || constraint === 'terminal-node'
  )) return true;
  const resourceNode = registry.nodes.find((candidate) => candidate.id === node.nodeId);
  const disposition = resourceNode?.planningMetadata.pathDisposition?.kind;
  return disposition === 'supporting-citation' || disposition === 'embedded-asset';
}

function corePolicyTeachingPlanNodes(
  mainPath: AdaptiveLearningPathPlanNode[],
  registry: ResourceNodeRegistry,
): AdaptiveLearningPathPlanNode[] {
  const teachingPath = mainPath.filter((node) => !isItemTypeTerminalValidationPlanNode(node));
  const requiredPrerequisiteNodeIds = new Set(teachingPath.flatMap((node) => node.prerequisiteNodeIds));
  return teachingPath.filter((node) => !isStructuralPolicySharedNode(node, registry, requiredPrerequisiteNodeIds));
}

function differentiablePolicyCoreRefs(
  mainPath: AdaptiveLearningPathPlanNode[],
  registry: ResourceNodeRegistry,
): string[] {
  return unique(corePolicyTeachingPlanNodes(mainPath, registry).map((node) => {
    const resourceNode = registry.nodes.find((candidate) => candidate.id === node.nodeId);
    return resourceNode ? canonicalSourceRefForNode(resourceNode) : `${node.sourceKind}:${node.sourceRef}`;
  }));
}

function differentiablePolicyModalityMix(
  mainPath: AdaptiveLearningPathPlanNode[],
  registry: ResourceNodeRegistry,
): Record<string, number> {
  return buildModalityMix(corePolicyTeachingPlanNodes(mainPath, registry));
}

const POLICY_FAMILY_STYLE: Record<AdaptiveLearningPathPolicyFamily, { id: AdaptiveLearningPathStyleId; label: string }> = {
  'foundation-remediation': { id: 'foundation-remediation', label: '基础补救' },
  'simulation-driven': { id: 'arena-simulation-sprint', label: '仿真与 Arena 冲刺' },
  'preference-matched': { id: 'preference-matched-route', label: '偏好匹配路线' },
  'sprint-correction': { id: 'sprint-correction-route', label: '短程纠偏' },
  'teacher-assigned': { id: 'teacher-assigned-route', label: '教师指定路线' },
  'rules-plus-graph-search': { id: 'rules-graph-search-route', label: '推荐路线' },
};

function buildPolicyBundle(
  input: AdaptiveLearningPathPlannerInput,
  capturedAt: string,
  stageRepairedNodeIds?: readonly string[],
): AdaptiveLearningPathPolicyBundle | undefined {
  const requestedFamilies = input.policyBundle?.families;
  if (!requestedFamilies || requestedFamilies.length === 0) {
    return undefined;
  }
  const families = unique(requestedFamilies);
  const overlapThreshold = input.policyBundle?.overlapThreshold ?? 0.6;
  const registeredGoal = getRegisteredAdaptiveLearningPathGoal(input.goal.id);
  const terminalValidationRequired = registeredGoal?.checkpointPolicy.requiresTerminalValidation ?? false;
  const deficits = inferDeficits(input.goal, input.learnerState);
  const sourceCoverage = input.learnerState?.evidence?.sourceCoverage ?? {};
  const omittedPolicyReasons: string[] = [];
  const targetOptionCount = registeredGoal?.starterPathPolicy.targetOptionCount;
  if (targetOptionCount !== undefined && families.length > targetOptionCount) {
    throw new Error(
      `Adaptive path goal "${input.goal.id}" requested ${families.length} policy families, ` +
      `exceeding targetOptionCount ${targetOptionCount}.`,
    );
  }
  if (targetOptionCount !== undefined && families.length < targetOptionCount) {
    omittedPolicyReasons.push('policy-option-count-below-target');
  }
  const avoidedDifferentiableCoreRefs = new Set<string>();
  const retainedCoreRefs = new Set<string>();
  const basePaths: AdaptiveLearningPathPolicyBundle['paths'] = [];
  for (const policyFamily of families) {
    const retryQueue: PolicyFamilyRetryState[] = [{
      excludedCanonicalCoreRefs: new Set<string>(),
      parentKey: '',
    }];
    const seenRetryStateKeys = new Set<string>([retryStateKey(new Set<string>())]);
    const seenCoreSetKeys = new Set<string>();
    let attempts = 0;
    let familyAccepted = false;
    let ordinaryPlannerFailure = false;

    const enqueueRetryState = (
      excludedCanonicalCoreRefs: ReadonlySet<string>,
      parentKey: string,
    ) => {
      const stateKey = retryStateKey(excludedCanonicalCoreRefs);
      if (seenRetryStateKeys.has(stateKey)) return;
      seenRetryStateKeys.add(stateKey);
      retryQueue.push({ excludedCanonicalCoreRefs: new Set(excludedCanonicalCoreRefs), parentKey });
    };

    const enqueueRetryBranches = (
      refs: string[],
      currentExcludedCanonicalCoreRefs: ReadonlySet<string>,
      parentKey: string,
      options: { combinedFirst?: boolean } = {},
    ) => {
      const uniqueRefs = unique(refs).sort((left, right) => left.localeCompare(right));
      if (options.combinedFirst && uniqueRefs.length > 1) {
        enqueueRetryState(new Set([
          ...currentExcludedCanonicalCoreRefs,
          ...uniqueRefs,
        ]), parentKey);
      }
      for (const ref of uniqueRefs) {
        enqueueRetryState(new Set([
          ...currentExcludedCanonicalCoreRefs,
          ref,
        ]), parentKey);
      }
    };

    while (attempts < 3 && retryQueue.length > 0) {
      const retryState = retryQueue.shift()!;
      attempts += 1;
      const diversityAvoidNodeIds = unique([
        ...(input.excludedNodeIds ?? []),
        ...input.registry.nodes
          .filter((node) => avoidedDifferentiableCoreRefs.has(canonicalSourceRefForNode(node)))
          .map((node) => node.id),
      ]);
      const plan = assembleAdaptiveLearningPathPlanInternal(
        {
          ...input,
          policyFamily,
          policyBundle: undefined,
          diversityAvoidNodeIds,
        },
        false,
        { excludedCanonicalCoreRefs: retryState.excludedCanonicalCoreRefs },
        stageRepairedNodeIds,
      );
      const mainPath = shapePolicyBundlePath(plan.mainPath, policyFamily, input);
      const coreRefs = differentiablePolicyCoreRefs(mainPath, input.registry);
      if (mainPath.length === 0) {
        ordinaryPlannerFailure = true;
        continue;
      }
      const coreSetKey = retryStateKey(new Set(coreRefs));
      if (seenCoreSetKeys.has(coreSetKey)) continue;
      seenCoreSetKeys.add(coreSetKey);
      const retryExcludedCoreRefs = coreRefs.filter((ref) =>
        retryState.excludedCanonicalCoreRefs.has(ref)
      );
      if (retryExcludedCoreRefs.length > 0) {
        enqueueRetryBranches(
          retryExcludedCoreRefs,
          retryState.excludedCanonicalCoreRefs,
          coreSetKey,
          { combinedFirst: true },
        );
        continue;
      }
      const hasNewCoreRef = coreRefs.some((ref) => !retainedCoreRefs.has(ref));
      if (basePaths.length > 0 && !hasNewCoreRef) {
        enqueueRetryBranches(
          coreRefs,
          retryState.excludedCanonicalCoreRefs,
          coreSetKey,
          { combinedFirst: true },
        );
        continue;
      }
      const overlapConflicts = pathsWithCoreOverlapAboveThreshold(
        basePaths,
        coreRefs,
        input.registry,
        overlapThreshold,
      );
      if (overlapConflicts.length > 0) {
        enqueueRetryBranches(
          unique(overlapConflicts.flatMap((conflict) => conflict.conflictingRefs)),
          retryState.excludedCanonicalCoreRefs,
          coreSetKey,
          { combinedFirst: true },
        );
        continue;
      }
      coreRefs.forEach((ref) => {
        retainedCoreRefs.add(ref);
        avoidedDifferentiableCoreRefs.add(ref);
      });
      const strategy = buildFamilyStrategyObservation(policyFamily, input, mainPath);
      const modalityMix = buildModalityMix(mainPath);
      const terminalValidationNodeIds = pathTerminalValidationNodeIds(mainPath);
      const estimatedMinutes = remainingTeachingEstimatedMinutes(mainPath);
      const checkpointNodeIds = selectCheckpointNodeIds(mainPath, registeredGoal);
      const targetDeficits = deficitsForPath(mainPath, deficits);
      basePaths.push({
        styleId: POLICY_FAMILY_STYLE[policyFamily].id,
        policyFamily,
        label: POLICY_FAMILY_STYLE[policyFamily].label,
        nodeIds: mainPath.map((node) => node.nodeId),
        activeNodeIds: activePolicyNodeIds(mainPath),
        lockedNodeIds: lockedPolicyNodeIds(mainPath),
        readinessSummary: policyReadinessSummary(mainPath),
        unlockMessages: policyUnlockMessages(mainPath),
        planNodes: mainPath,
        nodeSummaries: mainPath.map(toPathOptionNodeSummary),
        targetDeficits,
        strategy,
        recommendationProvenance: buildAdaptivePathRecommendationProvenance({
          path: mainPath,
          deficits: targetDeficits,
          confidence: plan.confidence.level,
          learnerStateSnapshot: plan.visualization?.evidence?.learnerStateSnapshot,
        }),
        evidenceBasis: buildPathEvidenceBasis(plan, sourceCoverage),
        estimatedMinutes,
        modalityMix,
        resourceMix: modalityMix,
        overlap: {
          maxWithOtherOptions: 0,
        },
        effort: {
          estimatedMinutes,
          relative: effortLabel(estimatedMinutes, input.constraints.timeBudgetMinutes),
        },
        expectedTargetLift: round(plan.score.objectives.learningGain, 3),
        terminalValidationNodeIds,
        terminalValidationStrategy: buildTerminalValidationStrategy(
          mainPath,
          terminalValidationNodeIds,
          terminalValidationRequired,
        ),
        checkpointNodeIds,
        limitations: buildPathOptionLimitations(
          plan,
          mainPath,
          terminalValidationNodeIds,
          deficits,
          terminalValidationRequired,
        ),
      });
      familyAccepted = true;
      break;
    }
    if (!familyAccepted && attempts > 0) {
      omittedPolicyReasons.push(
        ordinaryPlannerFailure && basePaths.length === 0
          ? 'policy-path-resource-missing'
          : 'policy-option-diversity-unavailable',
      );
    }
  }
  const pairwiseResourceOverlap = pairwisePolicies(basePaths, (left, right) => ({
    overlap: resourceOverlap(
      differentiablePolicyCoreRefs(left.planNodes ?? [], input.registry),
      differentiablePolicyCoreRefs(right.planNodes ?? [], input.registry),
    ),
  }));
  const paths = basePaths.map((path) => ({
    ...path,
    overlap: {
      maxWithOtherOptions: round(pairwiseResourceOverlap
        .filter((item) => item.left === path.policyFamily || item.right === path.policyFamily)
        .reduce((max, item) => Math.max(max, item.overlap), 0), 3),
    },
  }));
  const pairwiseModalityDistance = pairwisePolicies(paths, (left, right) => ({
    distance: setDistance(
      Object.keys(differentiablePolicyModalityMix(left.planNodes ?? [], input.registry)),
      Object.keys(differentiablePolicyModalityMix(right.planNodes ?? [], input.registry)),
    ),
  }));
  const pairwiseEstimatedEffortDifference = pairwisePolicies(paths, (left, right) => ({
    difference: round(
      Math.abs(left.estimatedMinutes - right.estimatedMinutes) / Math.max(left.estimatedMinutes, right.estimatedMinutes, 1),
      3,
    ),
  }));
  const pairwiseTerminalValidationDifference = pairwisePolicies(paths, (left, right) => ({
    difference: setDistance(left.terminalValidationNodeIds, right.terminalValidationNodeIds),
  }));
  const maxResourceOverlap = round(
    pairwiseResourceOverlap.reduce((max, item) => Math.max(max, item.overlap), 0),
    3,
  );
  const minModalityDistance = minPairwiseValue(pairwiseModalityDistance, 'distance');
  const minEstimatedEffortDifference = minPairwiseValue(pairwiseEstimatedEffortDifference, 'difference');
  const minTerminalValidationDifference = minPairwiseValue(pairwiseTerminalValidationDifference, 'difference');
  const modalityMixByPolicy = Object.fromEntries(
    paths.map((path) => [path.policyFamily, path.modalityMix]),
  );
  const estimatedEffortByPolicy = Object.fromEntries(
    paths.map((path) => [path.policyFamily, path.estimatedMinutes]),
  );
  const terminalValidationDifference = minTerminalValidationDifference;
  const terminalValidationMissing = terminalValidationRequired &&
    paths.some((path) => path.terminalValidationNodeIds.length === 0);
  const fallbackReasons = unique([
    ...omittedPolicyReasons,
    maxResourceOverlap >= overlapThreshold ? 'path-diversity-insufficient' : null,
    terminalValidationMissing ? 'terminal-validation-diversity-insufficient' : null,
    new Set(paths.map((path) => path.nodeIds.join('|'))).size < Math.min(paths.length, 2)
      ? 'policy-paths-identical'
      : null,
  ].filter((item): item is string => Boolean(item)));
  const collectionProjection = projectColdStartCollection({
    learnerState: {
      knowledgeMasteryTags: input.learnerState?.knowledgeMastery?.tags,
      resourcePreference: input.learnerState?.resourcePreference,
      evidence: {
        confidence: input.learnerState?.evidence?.confidence,
        freshness: buildAdaptiveLearningPathLearnerStateSnapshot(input.learnerState)?.freshness,
      },
      missingEvidence: input.learnerState?.missingEvidence,
      capabilityTargets: Object.values(input.learnerState?.goalSlices ?? {}).flatMap((slice) => (
        (slice?.capabilityTargets ?? []).map((target) => ({
          confidence: target.observedEvidence?.confidence,
          evidenceCount: target.observedEvidence?.directEvidenceCount,
          freshness: target.observedEvidence?.freshness,
        }))
      )),
    },
    events: input.collectionEvents,
    goalId: input.goal.id,
    mode: 'new',
  });
  const pathsWithCollectionLimitations = paths.map((path) => ({
    ...path,
    limitations: unique([
      ...path.limitations,
      ...collectionProjection.limitationCodes,
    ]),
  }));
  const collectionImpacts = pathsWithCollectionLimitations.flatMap((path) => projectCollectionImpactsOnNewPath({
    mode: 'new',
    previous: input.previousPathFacts ?? {
      resourceMix: {},
      estimatedMinutes: 0,
      checkpointCount: 0,
    },
    next: {
      resourceMix: path.resourceMix,
      estimatedMinutes: path.estimatedMinutes,
      checkpointCount: path.checkpointNodeIds.length,
    },
    records: collectionProjection.records,
  })).filter((impact, index, all) => (
    all.findIndex((candidate) => candidate.reasonCode === impact.reasonCode) === index
  ));
  const decisionEvidence = buildPersonalizedPathDecisionEvidence({
    capturedAt,
    plannerVersion: 'adaptive-learning-path-planner.v1',
    learnerStateSnapshot: buildAdaptiveLearningPathLearnerStateSnapshot(input.learnerState),
    deficits: inferDeficits(input.goal, input.learnerState),
    paths: pathsWithCollectionLimitations.map((path, index) => ({
      optionId: `path-option-${index + 1}`,
      styleId: path.styleId,
      policyFamily: path.policyFamily,
      nodeIds: path.nodeIds,
      planNodes: path.planNodes,
      resourceMix: path.resourceMix,
      recommendationProvenance: path.recommendationProvenance,
    })),
    collectionImpacts,
    collectionLimitationCodes: collectionProjection.limitationCodes,
  });
  const pathsWithDecisionEvidence = pathsWithCollectionLimitations.map((path, index) => ({
    ...path,
    decisionEvidence: decisionEvidence.paths[index],
  }));

  return {
    families,
    overlapThreshold,
    status: fallbackReasons.length > 0 ? 'low-resource-fallback' : 'ready',
    paths: pathsWithDecisionEvidence,
    decisionEvidence,
    diversity: {
      maxResourceOverlap,
      minModalityDistance,
      minEstimatedEffortDifference,
      minTerminalValidationDifference,
      pairwiseResourceOverlap,
      pairwiseModalityDistance,
      pairwiseEstimatedEffortDifference,
      pairwiseTerminalValidationDifference,
      modalityMixByPolicy,
      estimatedEffortByPolicy,
      terminalValidationDifference,
    },
    fallbackReasons,
  };
}

function refreshPolicyBundlePathStates(
  policyBundle: AdaptiveLearningPathPolicyBundle | undefined,
  mainPath: AdaptiveLearningPathPlanNode[],
): AdaptiveLearningPathPolicyBundle | undefined {
  if (!policyBundle) return undefined;
  const pathByNodeId = new Map(mainPath.map((node) => [node.nodeId, node]));
  return {
    ...policyBundle,
    paths: policyBundle.paths.map((path) => {
      const optionNodes = path.nodeIds
        .map((nodeId) => pathByNodeId.get(nodeId))
        .filter((node): node is AdaptiveLearningPathPlanNode => Boolean(node));
      if (optionNodes.length === 0) return path;
      const refreshedNodeIds = new Set(optionNodes.map((node) => node.nodeId));
      return {
        ...path,
        activeNodeIds: [
          ...path.activeNodeIds.filter((nodeId) => !refreshedNodeIds.has(nodeId)),
          ...activePolicyNodeIds(optionNodes),
        ],
        lockedNodeIds: [
          ...path.lockedNodeIds.filter((nodeId) => !refreshedNodeIds.has(nodeId)),
          ...lockedPolicyNodeIds(optionNodes),
        ],
        readinessSummary: [
          ...path.readinessSummary.filter((item) => !refreshedNodeIds.has(item.nodeId)),
          ...policyReadinessSummary(optionNodes),
        ],
        unlockMessages: [
          ...path.unlockMessages.filter((item) => !refreshedNodeIds.has(item.nodeId)),
          ...policyUnlockMessages(optionNodes),
        ],
        planNodes: (Array.isArray(path.planNodes) ? path.planNodes : optionNodes)
          .map((node) => pathByNodeId.get(node.nodeId) ?? node),
        nodeSummaries: path.nodeSummaries.map((summary) => {
          const node = pathByNodeId.get(summary.nodeId);
          return node ? toPathOptionNodeSummary(node) : summary;
        }),
      };
    }),
  };
}

function activePolicyNodeIds(path: AdaptiveLearningPathPlanNode[]): string[] {
  const activeNodeIds: string[] = [];
  for (const node of path) {
    if (node.status === 'completed') continue;
    if (node.status === 'locked' || node.status === 'blocked') break;
    activeNodeIds.push(node.nodeId);
  }
  return activeNodeIds;
}

function lockedPolicyNodeIds(path: AdaptiveLearningPathPlanNode[]): string[] {
  return path
    .filter((node) => node.status === 'locked')
    .map((node) => node.nodeId);
}

function policyReadinessSummary(path: AdaptiveLearningPathPlanNode[]): Array<{
  nodeId: string;
  state: AdaptiveLearningPathReadinessState;
  message: string;
}> {
  return path
    .filter((node) => (node.readiness?.state ?? 'ready') !== 'ready')
    .map((node) => ({
      nodeId: node.nodeId,
      state: node.readiness?.state ?? 'locked',
      message: node.readiness?.message ?? '完成准备节点后会自动解锁。',
    }));
}

function policyUnlockMessages(path: AdaptiveLearningPathPlanNode[]): Array<{
  nodeId: string;
  message: string;
}> {
  return path
    .filter((node) => Boolean(node.readiness?.unlockMessage))
    .map((node) => ({
      nodeId: node.nodeId,
      message: node.readiness?.unlockMessage ?? '完成准备节点后会自动解锁。',
    }));
}

function shapePolicyBundlePath(
  mainPath: AdaptiveLearningPathPlanNode[],
  policyFamily: AdaptiveLearningPathPolicyFamily | '__quota_support__',
  input: AdaptiveLearningPathPlannerInput,
): AdaptiveLearningPathPlanNode[] {
  if (personalizationPluginRegistry.get(input.goal.id)?.status !== 'active') {
    return mainPath;
  }
  if (policyFamily === 'preference-matched') {
    // #2033 偏好资源强化：偏好类型教学节点占比不足 60% 时补充偏好支持节点。
    const preferredTypes = new Set(buildPlannerPreferenceContext(input).resourceTypes);
    if (preferredTypes.size === 0) return mainPath;
    let shaped = mainPath;
    for (let round = 0; round < 2; round += 1) {
      const teachingNodes = shaped.filter((node) => node.terminalConstraints.length === 0);
      const preferredCount = teachingNodes.filter((node) => preferredTypes.has(node.type)).length;
      if (teachingNodes.length === 0 || preferredCount / teachingNodes.length >= 0.6) break;
      const withSupport = shapePolicyBundlePath(shaped, '__quota_support__', input);
      if (withSupport.length === shaped.length) break;
      shaped = withSupport;
    }
    return shaped;
  }
  if (
    policyFamily !== 'foundation-remediation' &&
    policyFamily !== 'simulation-driven' &&
    // '__quota_support__' 是偏好配额补充轮的内部伪族，走同一插入管线。
    policyFamily !== '__quota_support__'
  ) {
    return mainPath;
  }
  const supportReasonCode = policyFamily === '__quota_support__'
    ? 'policy-preference-quota-support'
    : `policy-${policyFamily}-support`;
  const selectedIds = new Set(mainPath.map((node) => node.nodeId));
  const remainingBudget = input.constraints.timeBudgetMinutes - remainingEstimatedMinutes(mainPath);
  const supportNodes = selectPolicySupportNodes(policyFamily, input, selectedIds, remainingBudget);
  if (supportNodes.length === 0) {
    return mainPath;
  }
  const completedNodeIds = unique([
    ...(input.constraints.completedNodeIds ?? []),
    ...mainPath.filter((node) => node.status === 'completed').map((node) => node.nodeId),
  ]);
  const supportPlanNodes = supportNodes.map((node) => toPlanNode({
    node,
    score: 0.35,
    reasonCodes: [supportReasonCode],
  }, null, completedNodeIds, evaluateNodeReadiness(node, input.learnerState, input.constraints, completedNodeIds)));
  const validationIndex = mainPath.findIndex((node) => node.terminalConstraints.length > 0);
  if (validationIndex < 0) {
    return [...supportPlanNodes, ...mainPath];
  }
  return [
    ...mainPath.slice(0, validationIndex),
    ...supportPlanNodes,
    ...mainPath.slice(validationIndex),
  ];
}

function buildFamilyStrategyObservation(
  policyFamily: AdaptiveLearningPathPolicyFamily,
  input: AdaptiveLearningPathPlannerInput,
  mainPath: AdaptiveLearningPathPlanNode[],
): AdaptiveLearningPathPolicyBundle['paths'][number]['strategy'] {
  const mapped = ADAPTIVE_PATH_STRATEGY_BY_FAMILY[policyFamily];
  if (!mapped) return undefined;
  // 复审修复：用与 planner 一致的可信画像判定（availability + payload 权威证据），
  // SNAPSHOT 但无权威维度证据时同样降级为通用策略。
  const portraitUnavailable = !hasTrustedPortraitForPersonalization(input.learnerState);
  const deficits = inferDeficits(input.goal, input.learnerState)
    .filter((deficit) => deficit.kind === 'knowledge')
    .slice(0, 2)
    .map((deficit) => deficit.targetId);
  const preferredTypes = Array.from(buildPlannerPreferenceContext(input).resourceTypes);
  // 优势维度取 portrait-v2 主权维度（最高分且证据非零）。
  const competencies = (input.learnerState?.primaryPortrait?.dimensions ?? [])
    .filter((dimension) => dimension.evidenceSummary.totalCount > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, 1)
    .map((dimension) => dimension.id);
  // 三策略依据各来自不同证据面，generic 需按策略独立判定：
  // 薄弱=知识缺口、偏好=带画像来源的偏好证据（fallback 系统默认不得声称画像依据）、
  // 优势=portrait-v2 优势维度。任一依据缺失即降级为通用策略。
  const preferenceEvidenceAvailable = input.resourcePreferenceSource !== undefined
    && input.resourcePreferenceSource !== 'fallback';
  const portraitBasis = policyFamily === 'foundation-remediation'
    ? deficits
    : policyFamily === 'preference-matched'
      ? preferredTypes
      : competencies;
  const generic = portraitUnavailable
    || (policyFamily === 'foundation-remediation' && portraitBasis.length === 0)
    || (policyFamily === 'preference-matched' && (portraitBasis.length === 0 || !preferenceEvidenceAvailable))
    || (policyFamily === 'simulation-driven' && portraitBasis.length === 0);
  const teachingNodes = mainPath.filter((node) => node.terminalConstraints.length === 0);
  const preferredCount = teachingNodes.filter((node) => preferredTypes.length > 0 && preferredTypes.includes(node.type as ResourceNode['type'])).length;
  const preferredTypeShare = teachingNodes.length > 0 ? preferredCount / teachingNodes.length : 0;
  // 复审修复：配额轮资源/预算不足而未达 60% 可观察占比时，如实标记未兑现，
  // 不得继续声称"偏好资源强化"已生效。
  const preferenceQuotaUnmet = policyFamily === 'preference-matched'
    && preferredTypes.length > 0
    && preferredTypeShare < 0.6;
  const weaknessResourceCount = policyFamily === 'foundation-remediation'
    ? teachingNodes.filter((node) => node.knowledgeCoverage.some((tag) => deficits.includes(tag))).length
    : 0;
  const comprehensiveTaskCount = policyFamily === 'simulation-driven'
    ? teachingNodes.filter((node) => ['simulation', 'arena_task', 'project', 'control_workbench'].includes(node.type)).length
    : 0;
  return {
    family: policyFamily,
    strategyId: mapped.strategyId,
    name: mapped.name,
    portraitBasis: generic ? [] : portraitBasis,
    generic,
    preferenceQuotaUnmet,
    preferredTypeShare,
    weaknessResourceCount,
    comprehensiveTaskCount,
  };
}

function selectPolicySupportNodes(
  policyFamily: AdaptiveLearningPathPolicyFamily | '__quota_support__',
  input: AdaptiveLearningPathPlannerInput,
  selectedIds: Set<string>,
  remainingBudget: number,
): ResourceNode[] {
  // '__quota_support__'：偏好配额补充轮，沿用偏好匹配的支持节点选择。
  const supportFamily = (policyFamily === '__quota_support__'
    ? 'preference-matched'
    : policyFamily) as AdaptiveLearningPathPolicyFamily;
  let remaining = Math.max(0, remainingBudget);
  const deficits = inferDeficits(input.goal, input.learnerState);
  const registeredGoal = getRegisteredAdaptiveLearningPathGoal(input.goal.id);
  const graphContext = buildAdaptiveLearningPathGraphContext(input.graphContext, input.goal, registeredGoal);
  const learningGoalBoundary = buildLearningGoalObjectiveBoundary(registeredGoal, graphContext);
  const excludedNodeIds = new Set(input.excludedNodeIds ?? []);
  const eligibleIds = new Set(evaluateHardEligibility(input.registry.nodes, input.constraints).eligible
    .filter((node) => !excludedNodeIds.has(node.id))
    .filter((node) => externalResourceAllowed(node, input, registeredGoal))
    .filter((node) => learningGoalBoundary
      ? evaluateLearningGoalObjectiveBoundary(node, learningGoalBoundary, graphContext, registeredGoal, input.constraints).allowed
      : true)
    .map((node) => node.id));
  const picked: ResourceNode[] = [];
  // 前置放宽仅用于优势迁移与偏好配额补充轮：两者插入的支持节点前置已在主路径满足；
  // foundation 等基础补强仍坚持"立即可学"，不引入前置链。
  const allowSatisfiedPrerequisites = policyFamily === '__quota_support__'
    || policyFamily === 'simulation-driven';
  const addCandidates = (candidates: ResourceNode[], limit: number) => {
    for (const node of candidates) {
      if (picked.length >= limit) break;
      if (selectedIds.has(node.id) || picked.some((item) => item.id === node.id)) continue;
      if (excludedNodeIds.has(node.id)) continue;
      if (!eligibleIds.has(node.id)) continue;
      if (node.planningMetadata.terminalConstraints.length > 0) continue;
      const planningUnit = planningUnitForNode(node);
      if (!planningUnit) continue;
      if (planningUnit.prerequisites.length > 0) {
        const prerequisitesSatisfied = planningUnit.prerequisites.every((id) => selectedIds.has(id));
        if (!allowSatisfiedPrerequisites || !prerequisitesSatisfied) continue;
      }
      if (!policyAllowsNode(node, supportFamily, input.constraints)) continue;
      if (!nodeMatchesGoal(node, input.goal, deficits, graphContext)) continue;
      const estimatedMinutes = planningUnit.estimatedTimeMinutes;
      if (estimatedMinutes > remaining) continue;
      picked.push(node);
      remaining -= estimatedMinutes;
    }
  };

  if (supportFamily === 'simulation-driven') {
    // 优势迁移应用（#2033）：优先仿真/Arena/项目综合任务支持节点。
    // 复审修复：把 portrait-v2 优势维度经显式兼容适配器映射到资源 abilityImpact
    // 的能力键，其最大增量作为首选排序信号——单变量优势切换可实际改变选中资源。
    const topDimension = (input.learnerState?.primaryPortrait?.dimensions ?? [])
      .filter((dimension) => dimension.evidenceSummary.totalCount > 0)
      .sort((left, right) => right.score - left.score)[0]?.id ?? null;
    const affinityOf = (node: ResourceNode): number => {
      if (!topDimension) return 0;
      let max = 0;
      for (const [legacyKey, value] of Object.entries(node.planningMetadata.abilityImpact)) {
        if (!mapLegacyCompetencyDimensionToPortraitV2(legacyKey).targetDimensions.includes(topDimension)) continue;
        if (typeof value === 'number' && Number.isFinite(value)) max = Math.max(max, value);
      }
      return max;
    };
    const typeRank = new Map<ResourceNode['type'], number>([
      ['simulation', 0],
      ['arena_task', 1],
      ['project', 2],
      ['control_workbench', 3],
    ]);
    addCandidates(input.registry.nodes
      .filter((node) => typeRank.has(node.type))
      .sort((left, right) =>
        affinityOf(right) - affinityOf(left) ||
        (typeRank.get(left.type) ?? 99) - (typeRank.get(right.type) ?? 99) ||
        (planningUnitForNode(left)?.estimatedTimeMinutes ?? 0) - (planningUnitForNode(right)?.estimatedTimeMinutes ?? 0) ||
        left.id.localeCompare(right.id)
      ), 2);
    return picked;
  }

  if (supportFamily === 'foundation-remediation') {
    const typeRank = new Map<ResourceNode['type'], number>([
      ['knowledge_card', 0],
      ['textbook_section', 1],
      ['handout', 2],
      ['slides', 3],
      ['lesson_step', 4],
      ['quiz', 5],
    ]);
    addCandidates(input.registry.nodes
      .filter((node) => typeRank.has(node.type))
      .sort((left, right) =>
        (typeRank.get(left.type) ?? 99) - (typeRank.get(right.type) ?? 99) ||
        (planningUnitForNode(left)?.estimatedTimeMinutes ?? 0) - (planningUnitForNode(right)?.estimatedTimeMinutes ?? 0) ||
        left.id.localeCompare(right.id)
      ), 2);
    return picked;
  }

  const preferredTypes = Array.from(buildPlannerPreferenceContext({ ...input, policyFamily: supportFamily } as AdaptiveLearningPathPlannerInput).resourceTypes);
  const preferenceRank = new Map(preferredTypes.map((type, index) => [type, index]));
  addCandidates(input.registry.nodes
      .filter((node) => preferenceRank.has(node.type))
      .sort((left, right) =>
        (preferenceRank.get(left.type) ?? 99) - (preferenceRank.get(right.type) ?? 99) ||
        (planningUnitForNode(left)?.estimatedTimeMinutes ?? 0) - (planningUnitForNode(right)?.estimatedTimeMinutes ?? 0) ||
        left.id.localeCompare(right.id)
      ), 2);
  addCandidates(input.registry.nodes
    .filter((node) => node.type === 'ai_intervention' || node.type === 'reflection')
    .sort((left, right) =>
      (planningUnitForNode(left)?.estimatedTimeMinutes ?? 0) - (planningUnitForNode(right)?.estimatedTimeMinutes ?? 0) ||
      left.id.localeCompare(right.id)
    ), 2);
  return picked;
}

function toPathOptionNodeSummary(node: AdaptiveLearningPathPlanNode): AdaptiveLearningPathOptionNodeSummary {
  return {
    nodeId: node.nodeId,
    planningUnitId: node.planningUnitId,
    title: node.title,
    pathNodeType: node.pathNodeType,
    displayName: node.displayName,
    iconKey: node.iconKey,
    shapeHint: node.shapeHint,
    evidenceBehavior: node.evidenceBehavior,
    evidenceStatus: node.evidenceStatus,
    estimatedTimeMinutes: node.estimatedTimeMinutes,
    cognitiveLoad: node.cognitiveLoad,
    effort: node.effort,
    knowledgeCoverage: node.knowledgeCoverage,
    capabilityTargets: node.capabilityTargets,
    launchBinding: node.launchBinding,
    status: node.status,
  };
}

function pathTerminalValidationNodeIds(mainPath: AdaptiveLearningPathPlanNode[]): string[] {
  return mainPath
    .filter((node) => node.terminalConstraints.includes('terminal-validation'))
    .map((node) => node.nodeId);
}

function selectCheckpointNodeIds(
  mainPath: AdaptiveLearningPathPlanNode[],
  registeredGoal: AdaptiveLearningPathRegisteredGoalDefinition | null,
): string[] {
  if (mainPath.length === 0) return [];
  const terminalValidationNodeIds = pathTerminalValidationNodeIds(mainPath);
  if (terminalValidationNodeIds.length > 0) return terminalValidationNodeIds;
  const policy = registeredGoal?.checkpointPolicy;
  const preferred = policy
    ? mainPath
        .filter((node) => policy.checkpointResourceTypes.includes(node.type))
        .map((node) => node.nodeId)
    : [];
  const minimum = Math.max(1, policy?.minCheckpoints ?? 1);
  return unique([
    ...preferred,
    mainPath.at(-1)?.nodeId,
  ]).slice(0, minimum);
}

function buildModalityMix(mainPath: AdaptiveLearningPathPlanNode[]): Record<string, number> {
  return mainPath.reduce<Record<string, number>>((mix, node) => {
    mix[node.type] = (mix[node.type] ?? 0) + 1;
    return mix;
  }, {});
}

function hasExplicitPlannerChoice(source: string | undefined, value: unknown): boolean {
  return source ? source !== 'fallback' : value !== undefined;
}

// #1985：显式来源（request/profile）下，解析后的 resourcePreferences 是唯一偏好权威，
// learnerState 携带的画像/试学模态不得再进入排序加权，避免画像偏好压过用户显式选择。
function withoutLearnerStateResourceModalities(
  learnerState: AdaptiveLearningPathPlannerInput['learnerState'],
): AdaptiveLearningPathPlannerInput['learnerState'] {
  if (!learnerState) return learnerState;
  return {
    ...learnerState,
    resourcePreference: {
      ...learnerState.resourcePreference,
      preferredModalities: [],
    },
  };
}

function deficitsForPath(
  mainPath: AdaptiveLearningPathPlanNode[],
  deficits: AdaptiveLearningPathDeficit[],
): AdaptiveLearningPathDeficit[] {
  const coveredTargets = new Set([
    ...mainPath.flatMap((node) => node.knowledgeCoverage),
  ]);
  for (const node of mainPath) {
    for (const reason of node.reasonCodes) {
      if (reason.includes('competency')) {
        for (const deficit of deficits.filter((item) => item.kind === 'competency')) {
          coveredTargets.add(deficit.targetId);
        }
      }
    }
  }
  const selected = deficits.filter((deficit) => coveredTargets.has(deficit.targetId));
  return selected.length > 0 ? selected : deficits.slice(0, 3);
}

const RECOMMENDATION_TARGET_LABELS: Record<string, string> = {
  controlModeling: '控制建模',
  parameterDesign: '参数设计',
  crossDomainTransfer: '跨域迁移',
  engineeringDecision: '工程决策',
  inquiryReflection: '探究反思',
  selfDirectedLearning: '自主学习',
  'control-correction:time-domain-targets': '时域性能目标',
  'control-correction:root-locus-design': '根轨迹校正设计',
  'control-correction:simulation-validation': '仿真验证',
  'control-correction:arena-transfer': 'Arena 迁移应用',
  'kn-bode': 'Bode 图基础',
};

export function buildAdaptivePathRecommendationProvenance(input: {
  path: AdaptiveLearningPathPlanNode[];
  deficits: AdaptiveLearningPathDeficit[];
  confidence: AdaptiveLearningPathPlan['confidence']['level'];
  learnerStateSnapshot?: AdaptiveLearningPathLearnerStateSnapshot | null;
}): AdaptiveLearningPathRecommendationProvenance {
  const degradationReasons = listPersonalizedPathDegradationReasons(input.learnerStateSnapshot);
  const snapshotDegraded = Boolean(input.learnerStateSnapshot) && degradationReasons.length > 0;
  const portraitUnavailable = degradationReasons.includes('portrait-unavailable');
  const entries = input.deficits
    .filter((deficit) => deficit.reasonCode !== 'competency-no-portrait-evidence')
    .slice(0, 3)
    .map((deficit) => {
    const confidence = snapshotDegraded ? 'low' : recommendationEntryConfidence(deficit);
    const affectedNodes = confidence === 'low'
      ? []
      : input.path.filter((node) => nodeMatchesRecommendationTarget(node, deficit));
    const targetLabel = recommendationTargetLabel(deficit.targetId);
    const evidenceSummary = snapshotDegraded
      ? '当前学习证据过期、缺失或不完整，暂时不能据此给出个性化判断。'
      : deficit.evidenceCount > 0
        ? `${deficit.kind === 'knowledge' ? '掌握状态' : '能力状态'} ${Math.round(deficit.value * 100)}%，来自 ${deficit.evidenceCount} 条有效证据，置信度 ${Math.round(deficit.confidence * 100)}%。`
        : '当前没有足够的有效学习证据支持个性化判断。';
    const judgment = confidence === 'low'
      ? '暂不能确认该项为稳定薄弱点，本路径主要依据课程结构、先修规则和可用资源安排。'
      : affectedNodes.length > 0
        ? `当前状态仍有提升空间，因此优先安排 ${affectedNodes.map((node) => node.title).join('、')}。`
        : '现有路径事实不足以确认该项具体影响了哪些推荐资源。';
    return {
      targetLabel,
      targetKind: deficit.kind,
      confidence,
      evidenceSummary,
      judgment,
      affectedNodeIds: affectedNodes.map((node) => node.nodeId),
      affectedResourceTitles: affectedNodes.map((node) => node.title),
      eventReferences: deficit.eventReferences ?? [],
    };
  });
  const hasLowConfidenceDeficit = input.deficits.some((deficit) =>
    recommendationEntryConfidence(deficit) === 'low'
  );
  const hasUnmatchedEntry = entries.some((entry) =>
    entry.confidence !== 'low' && entry.affectedResourceTitles.length === 0
  );
  const hasMissingEventReferences = entries.some((entry) => entry.eventReferences?.length === 0);
  const confidence = snapshotDegraded || input.confidence === 'low' || entries.length === 0 || hasLowConfidenceDeficit
    ? 'low'
    : input.confidence;
  const appliedPreferredModalities = snapshotDegraded
    ? []
    : trustedPreferredModalitiesOnPath(
      input.path,
      input.learnerStateSnapshot,
    );
  const limitations = unique([
    entries.length === 0 ? '当前没有可用于形成个性化判断的有效学习证据。' : null,
    portraitUnavailable
      ? `当前无法个性化推荐：能力画像暂不可用（${input.learnerStateSnapshot?.primaryPortraitAvailability ?? '未知原因'}），本路径按通用学习路线生成。`
      : null,
    snapshotDegraded && !portraitUnavailable ? '当前学习证据过期、缺失或不完整，暂时不能据此给出个性化判断。' : null,
    hasLowConfidenceDeficit ? '部分判断的有效证据仍然不足。' : null,
    hasUnmatchedEntry ? '部分判断缺少可核验的推荐资源关联。' : null,
    hasMissingEventReferences ? '部分判断尚无可核验的事件级学习记录。' : null,
    unmatchedPreferredModalityLimitation(input.learnerStateSnapshot, appliedPreferredModalities),
  ]);
  const personalizationNotes = appliedPreferredModalities.length
    ? [`根据你的学习方式偏好，优先安排${appliedPreferredModalities.map(resourceTypeLabel).join('、')}类学习资源。`]
    : [];
  return {
    summary: portraitUnavailable
      ? '当前无法个性化推荐：能力画像暂不可用，本路径按通用学习路线生成。'
      : confidence === 'low'
        ? '当前证据较少，本路径主要依据课程结构、先修规则和可用资源生成。'
        : entries.length === 1
          ? `依据 ${entries[0].targetLabel} 的学习证据安排本路径。`
          : `依据 ${entries[0].targetLabel} 等 ${entries.length} 项学习证据安排本路径。`,
    confidence,
    entries,
    personalizationNotes,
    ...(portraitUnavailable ? { personalizationState: 'portrait-unavailable' as const } : {}),
    evidenceReviewHref: '/profile/evidence',
    limitations,
    nextAction: confidence === 'low' || hasLowConfidenceDeficit
      ? '完成诊断或练习，补充有效学习证据。'
      : null,
  };
}

function recommendationEntryConfidence(
  deficit: AdaptiveLearningPathDeficit,
): AdaptiveLearningPathRecommendationProvenanceEntry['confidence'] {
  if (deficit.evidenceCount < 2 || deficit.confidence < 0.5) return 'low';
  if (deficit.evidenceCount < 5 || deficit.confidence < 0.75) return 'medium';
  return 'high';
}

function isTrustedPersonalizationSnapshot(
  snapshot: AdaptiveLearningPathLearnerStateSnapshot | null | undefined,
): snapshot is AdaptiveLearningPathLearnerStateSnapshot {
  return Boolean(
    snapshot
      && snapshot.confidence.level !== 'none'
      && snapshot.confidence.level !== 'low'
      && snapshot.preferredModalityConfidence !== 'none'
      && snapshot.preferredModalityConfidence !== 'low'
      && snapshot.freshness !== 'stale'
      && snapshot.freshness !== 'partial'
  );
}

function pathResourceTypes(path: AdaptiveLearningPathPlanNode[]): Set<string> {
  return new Set(
    path.flatMap((node) => [node.type, node.pathNodeType].filter(Boolean)),
  );
}

function trustedPreferredModalitiesOnPath(
  path: AdaptiveLearningPathPlanNode[],
  snapshot: AdaptiveLearningPathLearnerStateSnapshot | null | undefined,
): string[] {
  if (!isTrustedPersonalizationSnapshot(snapshot)) return [];
  const present = pathResourceTypes(path);
  return snapshot.preferredModalities.filter((modality) => present.has(modality));
}

function unmatchedPreferredModalityLimitation(
  snapshot: AdaptiveLearningPathLearnerStateSnapshot | null | undefined,
  appliedPreferredModalities: string[],
): string | null {
  if (!snapshot?.preferredModalities.length || appliedPreferredModalities.length > 0) return null;
  if (!isTrustedPersonalizationSnapshot(snapshot)) {
    return '学习方式偏好证据不足或已过期，本路径未据此调整资源组合。';
  }
  return '当前学习方式偏好未能落实到本路径的可用资源。';
}

function resourceTypeLabel(resourceType: string): string {
  const labels: Record<string, string> = {
    video: '视频',
    handout: '讲义',
    knowledge_card: '知识卡片',
    simulation: '仿真',
    adaptive_quiz: '自适应练习',
    quiz: '练习题',
    audio: '音频',
    textbook_section: '教材阅读',
  };
  return labels[resourceType] ?? '学习';
}

function nodeMatchesRecommendationTarget(
  node: AdaptiveLearningPathPlanNode,
  deficit: AdaptiveLearningPathDeficit,
): boolean {
  return deficit.kind === 'knowledge'
    ? node.knowledgeCoverage.includes(deficit.targetId)
    : node.capabilityTargets?.includes(deficit.targetId) ?? false;
}

function recommendationTargetLabel(targetId: string): string {
  const knownLabel = RECOMMENDATION_TARGET_LABELS[targetId];
  if (knownLabel) return knownLabel;
  const finalSegment = targetId.split(':').at(-1) ?? targetId;
  const normalized = finalSegment
    .replace(/_[0-9]+_[a-z0-9]+$/i, '')
    .replaceAll('-', ' ')
    .trim();
  return /[\u3400-\u9fff]/u.test(normalized) ? normalized : '当前学习目标';
}

function buildPathEvidenceBasis(
  plan: AdaptiveLearningPathPlan,
  sourceCoverage: Record<string, string>,
): string[] {
  return unique([
    plan.confidence.sourceCoverage > 0 ? 'adaptive-learner-state' : 'low-confidence-learner-state',
    ...Object.entries(sourceCoverage)
      .filter(([, state]) => state === 'available' || state === 'partial')
      .map(([source]) => source),
    ...(plan.visualization?.evidence?.evidenceBasis ? [plan.visualization.evidence.evidenceBasis] : []),
  ]);
}

function effortLabel(estimatedMinutes: number, timeBudgetMinutes: number): 'short' | 'medium' | 'long' {
  if (estimatedMinutes <= Math.max(20, timeBudgetMinutes * 0.35)) return 'short';
  if (estimatedMinutes <= Math.max(45, timeBudgetMinutes * 0.7)) return 'medium';
  return 'long';
}

const INCLUDED_UNVERIFIABLE_TERMINAL_VALIDATION = '终点已纳入但当前不可验证';

function isPathTerminalCurrentlyReady(node: AdaptiveLearningPathPlanNode): boolean {
  return node.status !== 'locked'
    && node.status !== 'blocked'
    && (node.readiness?.state ?? 'ready') === 'ready';
}

function terminalValidationIsIncludedButUnverifiable(
  path: AdaptiveLearningPathPlanNode[],
  terminalValidationNodeIds: string[],
): boolean {
  if (terminalValidationNodeIds.length === 0) return false;
  const terminals = path.filter((node) => terminalValidationNodeIds.includes(node.nodeId));
  if (terminals.length === 0) return true;
  return terminals.every((node) => !isPathTerminalCurrentlyReady(node));
}

function buildTerminalValidationStrategy(
  path: AdaptiveLearningPathPlanNode[],
  terminalValidationNodeIds: string[],
  terminalValidationRequired = true,
): { nodeIds: string[]; summary: string } {
  let summary = '阶段检查点用于学习反馈';
  if (terminalValidationRequired) {
    if (terminalValidationNodeIds.length === 0) {
      summary = 'terminal validation unavailable';
    } else if (terminalValidationIsIncludedButUnverifiable(path, terminalValidationNodeIds)) {
      summary = INCLUDED_UNVERIFIABLE_TERMINAL_VALIDATION;
    } else {
      summary = `terminal validation through ${terminalValidationNodeIds.join(', ')}`;
    }
  }
  return {
    nodeIds: terminalValidationNodeIds,
    summary,
  };
}

function buildPathOptionLimitations(
  plan: AdaptiveLearningPathPlan,
  path: AdaptiveLearningPathPlanNode[],
  terminalValidationNodeIds: string[],
  deficits: AdaptiveLearningPathDeficit[],
  terminalValidationRequired = true,
): string[] {
  return unique([
    terminalValidationRequired && terminalValidationNodeIds.length === 0 ? '需要完成终点检验' : null,
    terminalValidationRequired
      && terminalValidationIsIncludedButUnverifiable(path, terminalValidationNodeIds)
      ? INCLUDED_UNVERIFIABLE_TERMINAL_VALIDATION
      : null,
    deficits.some((deficit) => deficit.evidenceCount === 0) ? '部分目标还缺少直接证据' : null,
    plan.confidence.level === 'low' ? '当前证据较少' : null,
  ]);
}

function pairwisePolicies<T extends Record<string, number>>(
  paths: AdaptiveLearningPathPolicyBundle['paths'],
  metric: (
    left: AdaptiveLearningPathPolicyBundle['paths'][number],
    right: AdaptiveLearningPathPolicyBundle['paths'][number],
  ) => T,
): Array<T & { left: AdaptiveLearningPathPolicyFamily; right: AdaptiveLearningPathPolicyFamily }> {
  const results: Array<T & { left: AdaptiveLearningPathPolicyFamily; right: AdaptiveLearningPathPolicyFamily }> = [];
  for (let leftIndex = 0; leftIndex < paths.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < paths.length; rightIndex += 1) {
      const left = paths[leftIndex]!;
      const right = paths[rightIndex]!;
      results.push({
        left: left.policyFamily,
        right: right.policyFamily,
        ...metric(left, right),
      });
    }
  }
  return results;
}

function retryStateKey(refs: ReadonlySet<string>): string {
  return Array.from(refs).sort((left, right) => left.localeCompare(right)).join('|');
}

function pathsWithCoreOverlapAboveThreshold(
  paths: AdaptiveLearningPathPolicyBundle['paths'],
  candidateCoreRefs: string[],
  registry: ResourceNodeRegistry,
  overlapThreshold: number,
): Array<{ path: AdaptiveLearningPathPolicyBundle['paths'][number]; conflictingRefs: string[]; overlap: number }> {
  return paths
    .map((path) => {
      const retainedCoreRefs = differentiablePolicyCoreRefs(path.planNodes ?? [], registry);
      const overlap = resourceOverlap(candidateCoreRefs, retainedCoreRefs);
      return {
        path,
        overlap,
        conflictingRefs: candidateCoreRefs
          .filter((ref) => retainedCoreRefs.includes(ref))
          .sort((left, right) => left.localeCompare(right)),
      };
    })
    .filter((item) => item.overlap >= overlapThreshold && item.conflictingRefs.length > 0)
    .sort((left, right) =>
      right.overlap - left.overlap ||
      left.path.policyFamily.localeCompare(right.path.policyFamily)
    );
}

function minPairwiseValue<T extends Record<K, number>, K extends string>(items: T[], key: K): number {
  if (items.length === 0) {
    return 0;
  }
  return round(items.reduce((min, item) => Math.min(min, item[key]), 1), 3);
}

function resourceOverlap(leftNodeIds: string[], rightNodeIds: string[]): number {
  const left = new Set(leftNodeIds);
  const right = new Set(rightNodeIds);
  const union = new Set([...left, ...right]);
  if (union.size === 0) {
    return 1;
  }
  const intersection = Array.from(left).filter((nodeId) => right.has(nodeId));
  return round(intersection.length / union.size, 3);
}

function setDistance(leftValues: string[], rightValues: string[]): number {
  const left = new Set(leftValues);
  const right = new Set(rightValues);
  const union = new Set([...left, ...right]);
  if (union.size === 0) {
    return 0;
  }
  const intersection = Array.from(left).filter((value) => right.has(value));
  return round(1 - intersection.length / union.size, 3);
}

function buildVisualization(input: {
  mainPath: AdaptiveLearningPathPlanNode[];
  alternatives: AdaptiveLearningPathAlternative[];
  blocked: AdaptiveLearningPathAlternative[];
  currentNodeId: string | null;
  completedNodeIds: string[];
  deficits: AdaptiveLearningPathDeficit[];
  capabilityTargets: AdaptiveLearningCapabilityTarget[];
  learnerState: AdaptiveLearningPathLearnerState | null;
  sourceCoverage: Record<string, string>;
  confidence: AdaptiveLearningPathPlan['confidence'];
  learnerStateSnapshot: AdaptiveLearningPathLearnerStateSnapshot | null;
  status: AdaptiveLearningPathStatus;
  hasUsablePath: boolean;
  sourcePackEvidence: AdaptiveLearningPathSourcePackEvidence | null;
  candidatePoolDiagnostics?: AdaptiveLearningPathCandidatePoolDiagnostics;
  associativeRetrieval?: AdaptiveLearningPathAssociativeRetrievalBasis;
  generatedAt: string;
}): AdaptiveLearningPathVisualization {
  const mainPathNodeIds = input.mainPath.map((node) => node.nodeId);
  const riskNodeIds = input.currentNodeId && input.deficits.some((deficit) => deficit.evidenceCount < 3)
    ? [input.currentNodeId]
    : [];
  return {
    map: {
      mainPathNodeIds,
      branchPaths: input.alternatives
        .filter((item) => !item.blocked)
        .slice(0, 3)
        .map((item) => ({ fromNodeId: input.currentNodeId ?? 'start', nodeIds: item.nodeIds })),
      currentNodeId: input.currentNodeId,
      completedNodeIds: input.completedNodeIds,
      riskNodeIds,
      blockedNodes: input.blocked,
      alternatives: input.alternatives,
    },
    timeline: buildTimelinePayload(input.mainPath, input.generatedAt),
    evidence: {
      evidenceBasis: input.status === 'fallback' && !input.hasUsablePath ? 'fallback' : 'adaptive-learner-state',
      confidence: input.confidence,
      sourceCoverage: input.sourceCoverage,
      learnerStateDeficits: input.deficits,
      capabilityEvidence: buildCapabilityEvidence(input.capabilityTargets, input.learnerState),
      prerequisiteReasons: input.mainPath
        .filter((node) => node.prerequisiteNodeIds.length > 0)
        .map((node) => ({ nodeId: node.nodeId, prerequisiteNodeIds: node.prerequisiteNodeIds })),
      teacherPolicy: input.mainPath.map((node) => ({ nodeId: node.nodeId, policy: node.teacherPolicy })),
      alternatives: input.alternatives,
      sourcePackEvidence: input.sourcePackEvidence,
      candidatePoolDiagnostics: input.candidatePoolDiagnostics ?? null,
      associativeRetrieval: input.associativeRetrieval,
      learnerStateSnapshot: input.learnerStateSnapshot,
    },
  };
}

function buildPathPlanningSourcePackEvidence(
  input: AdaptiveLearningPathPlannerInput,
  mainPath: AdaptiveLearningPathPlanNode[],
  goal: AdaptiveLearningPathGoal,
): AdaptiveLearningPathSourcePackEvidence | null {
  const candidates = input.sourcePackCandidates ?? [];
  if (candidates.length === 0) return null;
  const capabilityTargetRefs = uniqueNonEmptyStrings([
    ...(goal.competencyTargets ?? []),
    ...(goal.capabilityTargets?.map((target) => target.id) ?? []),
  ]);
  const query = `${goal.title} ${goal.knowledgeTargets.join(' ')} ${(goal.competencyTargets ?? []).join(' ')} ${goal.capabilityTargets?.map((target) => `${target.id} ${target.behaviorVerb}`).join(' ') ?? ''}`.trim();

  const result = retrieveSourcePack({
    query,
    profile: 'path-planning',
    role: input.sourcePackRole ?? 'student',
    caller: 'adaptive-learning-path-planner',
    topK: 6,
    graphNodeRefs: uniqueNonEmptyStrings([
      ...goal.knowledgeTargets,
      ...(input.graphContext?.selectedGraphNodeIds ?? []),
      ...Object.values(input.graphContext?.expandedSubgraph.graphNodeIds ?? {}).flat(),
    ]),
    capabilityTargetRefs,
    learningGoalIds: uniqueNonEmptyStrings([
      goal.id,
      input.graphContext?.learningGoalId,
      goal.learningGoal?.id,
    ]),
    resourceIds: uniqueNonEmptyStrings(mainPath.flatMap((node) => [
      node.resourceNodeId,
      node.resourceId,
      node.planningUnitId,
    ])),
    candidates,
    limitations: input.sourcePackLimitations ?? [],
  });
  const itemRefs = result.pack.items.map((item) => item.id);
  const pathEligibleItemRefs = result.pack.items
    .filter((item) => Boolean(item.resourceNodeId || item.planningUnitId))
    .map((item) => item.id);
  return {
    packId: result.pack.packId,
    profile: 'path-planning',
    queryText: result.pack.query.text,
    itemRefs,
    pathEligibleItemRefs,
    citationOnlyItemRefs: itemRefs.filter((itemRef) => !pathEligibleItemRefs.includes(itemRef)),
    capabilityTargetRefs,
    citationTargetIds: result.pack.audit.citationTargetIds,
    retrievalChunkIds: result.pack.audit.retrievalChunkIds,
    limitationCodes: result.pack.limitations.map((limitation) => limitation.code),
    coverage: {
      eligibleItems: result.pack.coverage.eligibleItems ?? 0,
      returnedItems: result.pack.coverage.returnedItems,
      omittedItems: result.pack.coverage.omittedItems ?? 0,
    },
  };
}

function uniqueNonEmptyStrings(values: readonly (string | null | undefined)[]): string[] {
  return [...new Set(values.map((value) => value?.trim()).filter((value): value is string => Boolean(value)))];
}

function buildTimelinePayload(
  mainPath: AdaptiveLearningPathPlanNode[],
  generatedAt: string,
): AdaptiveLearningPathTimelinePayload {
  const mainPathNodeIds = mainPath.map((node) => node.nodeId);
  return {
    generatedAt,
    windows: ([3, 7, 14] as const).map((days) => {
      const nodeIds = mainPathNodeIds.slice(0, Math.min(days, mainPathNodeIds.length));
      return {
        days,
        nodeIds,
        estimatedMinutes: remainingEstimatedMinutes(mainPath.filter((node) => nodeIds.includes(node.nodeId))),
      };
    }),
  };
}

function resolvePlanConfidence(learnerState: AdaptiveLearningPathLearnerState | null): AdaptiveLearningPathPlan['confidence'] {
  if (!hasTrustedPortraitForPersonalization(learnerState)) {
    return {
      level: 'low',
      score: 0,
      sourceCoverage: 0,
    };
  }
  const confidence = learnerState?.evidence?.confidence;
  const score = confidence?.score ?? 0;
  const sourceCoverage = confidence?.sourceCompleteness ?? 0;
  return {
    level: score >= 0.75 && sourceCoverage >= 0.75 ? 'high' : score >= 0.45 ? 'medium' : 'low',
    score: round(score, 3),
    sourceCoverage: round(sourceCoverage, 3),
  };
}

function remainingEstimatedMinutes(nodes: AdaptiveLearningPathPlanNode[]): number {
  return nodes
    .filter((node) => node.status !== 'completed')
    .reduce((sum, node) => sum + node.estimatedTimeMinutes, 0);
}

function remainingTeachingEstimatedMinutes(nodes: AdaptiveLearningPathPlanNode[]): number {
  return remainingEstimatedMinutes(nodes.filter((node) => !isItemTypeTerminalValidationPlanNode(node)));
}

function unique<T extends string>(values: Array<T | null | undefined>): T[] {
  return Array.from(new Set(values.filter((value): value is T => Boolean(value))));
}

function round(value: number, digits = 2): number {
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}
