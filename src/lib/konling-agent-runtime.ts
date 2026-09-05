import { createHash } from 'node:crypto';

import { z } from 'zod';
import { tool } from 'ai';
import {
  AuthoritativeKnowledgeProjectionService,
  type KnowledgeRole,
  type ProjectionResult,
  type RepositoryDiagnostic,
} from '@/lib/authoritative-knowledge';
import {
  CANDIDATE_GRAPH_SUPPORT,
  CANDIDATE_RELEASE_SELECTOR,
  isCandidateGraphPubliclyActivated,
  resolveCandidateGraphAccess,
} from '@/features/knowledge/public-api';

import { getStepAIContext } from '@/lib/course-ai-contexts';
import {
  authorizeSimulationRunAccess,
  buildSimulationTaskSpec,
  type SimulationAccessRole,
  type SimulationRunEnvelopeV1,
  type SimulationTaskSpecInputV1,
  type SimulationTaskSpecV1,
} from '@/resources/simulations/core/run-contract';
import { resolvePersonalizationGoalContext } from '@/features/personalization/plugins/public-api';
import {
  ADAPTIVE_LEARNER_STATE_FEATURE_FLAG,
  isAdaptiveLearnerStateServiceEnabled,
  readLearnerState,
  readPathPlannerLearnerStateForSubject,
  type AdaptiveLearnerState,
  type AdaptiveLearnerStatePrivacyScope,
  type AdaptiveLearnerStateRole,
} from '@/features/personalization/learner-state/public-api';
import {
  projectGovernedCopilotProfile,
  toServerOwnedUserProfile,
} from '@/lib/governed-copilot-profile-context';
import { persistSimulationAgentEvidenceMaterialization } from '@/lib/data-governance/simulation-agent-evidence-materialization';
import {
  AdaptivePathCandidateBatchConflictError,
  assertAdaptivePathCandidateBatchMatchesInput,
  authorizeAdaptivePathComparisonIdentity,
  buildAdaptivePathCandidateDifferenceSummary,
  persistAdaptivePathCandidateBatch,
  readAdaptivePathCandidateBatch,
  readAdaptivePathCandidateBatchByGenerationRequest,
  resolveAdaptivePathCandidateSelection,
  type AdaptivePathCandidateBatchView,
  CONTROL_CORRECTION_PATH_ROUND_GOAL_ID,
  persistLearningPathRound,
  recordPathChoiceEvidence,
  recordPathIntervention,
  planLearningPath,
  buildAdaptiveLearningPathLearnerStateSnapshot,
  getRegisteredAdaptiveLearningPathGoal,
  type AdaptiveLearningPathGraphContextInput,
  type AdaptiveLearningPathConfigurationRequest,
  type AdaptiveLearningPathPolicyFamily,
  type AdaptiveLearningPathLearnerState,
  type AdaptiveLearningPathPlan,
  type AdaptiveLearningPathPlanNode,
} from '@/features/personalization/path-planning/public-api';
import { runWithLearningPathWriteFence } from '@/lib/canonical-learning-path-transition/write-fence';
import {
  bindKonlingCandidateSelectionToolRun,
  buildKonlingCandidateSelectionToolResult,
} from '@/lib/konling-candidate-selection-tool-run';
import {
  loadAllLessonRuntimeResourceCatalogEntries,
  loadAllTextbookStructureRuntimeCatalogEntries,
  loadAllTextbookStructureUnitProjections,
} from '@/lib/course-bundle';
import {
  detectStudyQuestionSectionHeading,
  isStudyQuestionIntent as isKnownStudyQuestionIntent,
  STUDY_QUESTION_SECTIONS,
  studyQuestionSectionTitles,
  type StudyQuestionIntent,
} from '@/lib/konling-study-question-structure';
import { isTechnicalIndexContext, markdownCodeRanges } from '@/lib/konling-citation-repair';

// #1951：答案单元扫描语义下沉到轻模块（无服务端重链），实验脚本可直接复用；
// 此处保持既有导出与内部使用不变。
import {
  assignedCitationNumbers,
  isBindableAnswerUnitCitation,
  isCitationMarkerPosition,
  scanKonlingAnswerUnits,
} from './konling-answer-unit-scan';
import type {
  KonlingAnswerUnitCitationBinding,
  KonlingAnswerUnitMissReason,
  KonlingAnswerUnitRecord,
  KonlingAnswerUnitScannableCitation,
} from './konling-answer-unit-scan';
export { scanKonlingAnswerUnits } from './konling-answer-unit-scan';
export type {
  KonlingAnswerUnitCitationBinding,
  KonlingAnswerUnitMissReason,
  KonlingAnswerUnitRecord,
  KonlingAnswerUnitScannableCitation,
} from './konling-answer-unit-scan';
import {
  collectionEventsFromGovernedFacts,
  previousPathFactsFromPlanOptions,
  type ColdStartGovernedFactInput,
} from '@/lib/cold-start-evidence-collection';
import {
  buildKonlingGraphGroundingDegradedReasons,
  buildKonlingKaqGraphContext,
  projectKonlingGraphContextForRole,
  resolveKonlingGraphContextLearningGoalId,
  type KonlingKaqGraphContext,
} from '@/lib/konling-kaq-graph-context';
import {
  adaptTextbookStructureUnit,
  retrieveSourcePack,
  type SourcePack,
  type SourcePackCallerRole,
  type SourcePackItem,
  type SourcePackLimitation,
  type SourcePackModality,
  type SourcePackSourceKind,
} from '@/lib/source-pack';
import {
  retrieveTextbookSourcePackV2Progressive,
  type TextbookV2OptimizationResult,
  type TextbookV2ToolResult,
} from '@/lib/source-pack/textbook-v2-adapter';
import {
  maybeRunKonlingCanonicalRagShadowDiagnostic,
  type KonlingCanonicalRagShadowContext,
  type KonlingCanonicalRagShadowDiagnostic,
} from '@/lib/canonical-rag/konling-integration';
import type { LayeredGraphPayload } from '@/lib/layered-graph/contracts';
import {
  extractKonlingTeachingProjectionClientHints,
  resolveKonlingTeachingProjectionBinding,
} from '@/lib/konling-teaching-projection-binding';
import {
  buildKonlingTeachingProjectionGroundingLines,
  projectKonlingTeachingProjectionAnswerProvenance,
  resolveKonlingTeachingProjectionContext,
  type KonlingTeachingProjectionClientHints,
  type KonlingTeachingProjectionContext,
} from '@/lib/konling-teaching-projection-context';
import {
  assignKonlingCitationDisplayNumbers,
  buildKonlingCitationCanonicalKey,
  createKonlingCitationAllocator,
  type KonlingAssignedCitation,
  type KonlingCitationIdentity,
} from '@/lib/konling-citation-protocol';
import { getLearningGoalResourceBaselineForPlanner } from '@/lib/learning-goal-resource-baseline-runtime';
import { getLearningGoalAssessmentCoverageForPlanner } from '@/lib/learning-goal-assessment-coverage-runtime';
import { createTaskSchema, updateTaskSchema } from '@/lib/smart-lesson-plan/task-input-schema';
import type { GraphCenterClassOverlayInput } from '@/lib/data-governance/graph-center';
import {
  type ResourceNode,
  type ResourceNodeRegistry,
} from '@/lib/resource-node-registry';
import { getAllRegisteredResourceMetadata } from '@/lib/resource-registry-metadata';
import {
  buildResourceCandidatePoolDiagnostics,
  buildResourceNodeRegistryFromTeachingResources,
  loadRuntimeResourceProjectionInputs,
  toTextbookUnitNodeInputs,
  type ResourceCandidatePoolDiagnostics,
  type ResourceCandidatePoolSourceStatus,
} from '@/lib/teacher-resource-node-data';
import { buildFrequencyResponseFoundationsResourceSeedInput } from '@/lib/frequency-response-resource-seed';
import { expandLearningGoalSubgraph } from '@/lib/graphs/goal-subgraph-expansion-service';
import type { PageContext, UserProfile } from '@/types/ai-context';
import {
  type ArenaCompanionContext,
  isClientAuthoredArenaCompanionScope,
} from '@/features/ai/companion/arena-companion-context';
import {
  decideIntervention,
  shouldIntervene,
  type InterventionDecision,
  type StudentState,
} from '@/features/personalization/interventions/public-api';
import {
  analyzeResultInputSchema,
  analyzeSimulationResult,
  buildSimulationParamChangeRequest,
  formatSimulationParamChangeResponse,
  getSimulationStatusInputSchema,
  setSimulationParamsInputSchema,
  type SimulationAnalysisInput,
  type SimulationParamChangeInput,
  type SimulationStateStore,
} from '@/lib/ai-tools';
import type { LearningEvidenceCitationChipPayload } from '@/lib/data-governance/learning-evidence-rag-corpus';
import {
  expandSarAssociations,
  type SarAssociationCandidateRefs,
  type SarAssociationCallerScope,
  type SarAssociationExpansionUseCase,
} from '@/lib/data-governance/sar-association-expansion';
import {
  projectGovernedSummaryToSar,
  type GovernedSummaryEntityRef,
} from '@/lib/data-governance/sar-projection';
import {
  MATH_CALC_OPERATIONS,
  MathCalculateCapacityError,
  runMathCalculate,
} from '@/lib/math-calc';

export const KONLING_SEMANTIC_MEMORY_FEATURE_FLAG = 'KONLING_SEMANTIC_MEMORY_ENABLED';
export const KONLING_STRATEGY_MEMORY_FEATURE_FLAG = 'KONLING_STRATEGY_MEMORY_ENABLED';

export type KonlingToolName =
  | 'get_page_context'
  | 'search_textbook'
  | 'get_learner_state'
  | 'get_plan_context'
  | 'search_learning_memory'
  | 'search_knowledge_graph'
  | 'search_candidate_canonical'
  | 'get_candidate_canonical_detail'
  | 'get_candidate_canonical_neighbors'
  | 'recommend_next_action'
  | 'get_simulation_status'
  | 'set_simulation_params'
  | 'analyze_result'
  | 'get_simulation_context'
  | 'run_virtual_simulation'
  | 'analyze_simulation_trace'
  | 'compare_simulation_runs'
  | 'propose_controller_patch'
  | 'apply_controller_patch'
  | 'record_intervention_result'
  | 'generate_learning_path'
  | 'revise_learning_path_options'
  | 'select_learning_path'
  | 'reject_learning_path_option'
  | 'explain_learning_path_tradeoff'
  | 'record_path_adjustment_outcome'
  | 'propose_smart_lesson_task_change'
  | 'analyze_attempt'
  | 'get_class_assignment_outcomes'
  | 'get_class_assessment_outcomes'
  | 'get_student_risk_flags'
  | 'get_class_competency_summary'
  | 'calculate'
  | 'get_student_knowledge_progress';

export type KonlingMemoryType = 'working-summary' | 'session-summary' | 'episodic' | 'intervention-outcome';
export type KonlingInterventionFeedback =
  | 'accepted'
  | 'ignored'
  | 'rejected'
  | 'partially-accepted'
  | 'dismissed'
  | 'rated';
export type KonlingAgentSessionStatus =
  | 'draft'
  | 'ready'
  | 'running'
  | 'awaiting_approval'
  | 'paused'
  | 'succeeded'
  | 'failed'
  | 'archived';
export type KonlingToolPermissionTier = 'read' | 'analyze' | 'run' | 'write' | 'publish';
export type KonlingToolApprovalPolicy = 'none' | 'required';
export type KonlingToolApprovalState = 'not_required' | 'required' | 'approved' | 'rejected';
export type KonlingToolRunStatus = 'running' | 'awaiting_approval' | 'succeeded' | 'failed';
export type KonlingToolIdempotencyPolicy = 'none' | 'reuse' | 'reject';
export type KonlingTeachingAssistantModeId =
  | 'generic-chat'
  | 'diagnosis-explainer'
  | 'path-advisor'
  | 'resource-coach'
  | 'grading-assistant'
  | 'feedback-explainer'
  | 'class-summarizer'
  | 'prep-coauthor'
  | 'teacher-diagnosis';
export type KonlingTeachingAssistantMountSurface =
  | 'generic-chat'
  | 'student-learning-overview'
  | 'student-path-center'
  | 'resource-node-launch'
  | 'teacher-grading-workbench'
  | 'student-feedback'
  | 'teacher-class-report'
  | 'teacher-dashboard-diagnosis'
  | 'teacher-prep-pack';
export type KonlingTeachingAssistantContextKey =
  | 'student-path-center'
  | 'diagnosis-view'
  | 'adaptive-attempt'
  | 'learner-state-summary'
  | 'evidence-citations'
  | 'path-execution-context'
  | 'resource-node'
  | 'media-resource'
  | 'rubric'
  | 'converted-document'
  | 'draft-grading-state'
  | 'teacher-review-state'
  | 'student-feedback'
  | 'class-report'
  | 'prep-pack'
  | 'smart-task'
  | 'selected-course-basis-versions'
  | 'task-ambiguities'
  | 'confirmed-task-decisions'
  | 'citation-state'
  | 'clarification-readiness';
export type KonlingTeachingAssistantStatus = 'ready' | 'degraded' | 'unavailable';
export type KonlingAnswerIntent =
  | 'fact-explanation'
  | 'formula-derivation'
  | 'code-debugging'
  | 'concept-comparison'
  | 'normative-content'
  | 'open-ended-explanation'
  | 'personalized-diagnosis'
  | 'path-advice'
  | 'grading-explanation'
  | 'media-guidance';

export interface KonlingStudyAnswerPreferences {
  depth: 'concise' | 'standard' | 'detailed';
  format: 'default' | 'steps' | 'table' | 'code-first';
  hintStrength: 'full-answer' | 'guided';
  exampleContext: string | null;
}

export interface KonlingStudyQuestionContract {
  intent: Extract<KonlingAnswerIntent, 'fact-explanation' | 'formula-derivation' | 'code-debugging' | 'concept-comparison' | 'normative-content' | 'open-ended-explanation'>;
  requiredSections: string[];
  normativeGuidance: 'not-applicable' | 'verified' | 'verification-required';
  preferences: KonlingStudyAnswerPreferences;
}


export interface KonlingTeachingAssistantModeContract {
  id: KonlingTeachingAssistantModeId;
  label: string;
  supportedRoles: AdaptiveLearnerStateRole[];
  mountingSurfaces: KonlingTeachingAssistantMountSurface[];
  requiredContext: KonlingTeachingAssistantContextKey[];
  optionalContext: KonlingTeachingAssistantContextKey[];
  permittedTools: KonlingToolName[];
  citationClasses: KonlingCitation['sourceType'][];
  privacyPolicy: {
    payload: 'aggregate-and-redacted-only' | 'student-visible-summary' | 'teacher-scoped-summary';
    forbiddenContent: string[];
  };
  unavailableStates: string[];
  outputContract: {
    status: 'draft-only' | 'advisory-only' | 'chat';
    requiredCitationOwners: Array<KonlingCitation['owner']>;
    forbiddenActions: string[];
  };
}

export interface KonlingTeachingAssistantMountContract {
  surface: KonlingTeachingAssistantMountSurface;
  modeId: KonlingTeachingAssistantModeId;
  supportedRoles: AdaptiveLearnerStateRole[];
  requiredContext: KonlingTeachingAssistantContextKey[];
  unavailableStates: string[];
}

export interface KonlingTeachingAssistantRuntimeContract {
  mode: KonlingTeachingAssistantModeContract;
  answerIntent: KonlingAnswerIntent;
  studyQuestion: KonlingStudyQuestionContract | null;
  status: KonlingTeachingAssistantStatus;
  unavailableReasons: string[];
  degradedReasons: string[];
  groundingContext: KonlingKnowledgeCapabilityContext;
  graphContext: KonlingKaqGraphContext | null;
  scope: Pick<KonlingRuntimeScope, 'authenticatedUserId' | 'targetUserId' | 'role' | 'classId' | 'courseId' | 'pageId' | 'resourceId' | 'pathNodeId' | 'privacyScopes'>;
  permittedTools: KonlingToolName[];
  citationRequirements: {
    required: boolean;
    classes: KonlingCitation['sourceType'][];
    requiredOwners: Array<KonlingCitation['owner']>;
    missingClasses: string[];
  };
  privacyPolicy: KonlingTeachingAssistantModeContract['privacyPolicy'];
  outputContract: KonlingTeachingAssistantModeContract['outputContract'];
  smartPreparation: KonlingSmartPreparationServerContext | null;
  adaptiveAttempt: import('@/features/assessment/adaptive-attempt-context').AdaptiveAttemptContext | null;
  wrongAnswerAttribution: import('@/features/assessment/wrong-answer-attribution').WrongAnswerAttributionProjection | null;
  authorizedCandidateBatch: KonlingAuthorizedCandidateBatchContext | null;
  clientHintsAccepted: string[];
  clientHintsRejected: string[];
}

export interface KonlingAuthorizedCandidateBatchContext {
  batchId: string;
  pathId: string;
  goalId: string;
  classId: string | null;
}

export interface KonlingSmartPreparationAmbiguity {
  id: string;
  field: string;
  question: string;
  alternatives: Array<{ id: string; label: string }>;
}

export interface KonlingSmartPreparationConfirmedDecision {
  id: string;
  field: string;
  value: string | number | boolean | string[] | null;
  confirmedAt: string;
  confirmedBy: string;
}

export interface KonlingSmartPreparationServerContext {
  taskId: string | null;
  taskRevision: string | null;
  bootstrap?: boolean;
  currentTask?: Record<string, unknown>;
  selectedCourseBasisVersions: Array<{
    versionId: string;
    citationState: string;
    reviewState: string;
  }>;
  unresolvedAmbiguities: KonlingSmartPreparationAmbiguity[];
  confirmedDecisions: KonlingSmartPreparationConfirmedDecision[];
  citationState: string;
  reviewState: string;
  clarificationReadiness: {
    status: 'ready' | 'clarification-required';
    canGenerate: boolean;
    unresolvedAmbiguityIds: string[];
  };
  updatePolicy: {
    suggestionStatus: 'draft';
    requiresExplicitTeacherConfirmation: true;
    expectedTaskRevision: string | null;
  };
}

export type KonlingTeachingAssistantServerModeContext = Partial<Record<KonlingTeachingAssistantContextKey, boolean>> & {
  smartPreparation?: KonlingSmartPreparationServerContext;
  adaptiveAttempt?: import('@/features/assessment/adaptive-attempt-context').AdaptiveAttemptContext;
  wrongAnswerAttribution?: import('@/features/assessment/wrong-answer-attribution').WrongAnswerAttributionProjection;
  authorizedCandidateBatch?: KonlingAuthorizedCandidateBatchContext;
};

export interface KonlingTeachingAssistantEntryPoint {
  mode: Exclude<KonlingTeachingAssistantModeId, 'generic-chat'>;
  promptContext: string;
  serverContext: Record<string, string>;
}

export interface KonlingRuntimeScope {
  authenticatedUserId: string;
  targetUserId: string;
  role: AdaptiveLearnerStateRole;
  classId?: string | null;
  courseId: string;
  pageId: string;
  resourceId?: string | null;
  pathNodeId?: string | null;
  privacyScopes: AdaptiveLearnerStatePrivacyScope[];
  candidateGraph?: PageContext['candidateGraph'];
}

export interface KonlingRuntimeContext {
  pageContext: PageContext;
  userProfile: UserProfile;
  learnerState: AdaptiveLearnerState | null;
  textbookRetrievalContext?: Readonly<{
    externalQuery: string | null;
  }>;
  planContext: KonlingPlanContext;
  memory: KonlingMemoryView[];
  knowledgeWorkspace?: KonlingKnowledgeWorkspaceContext | null;
  knowledgeCapabilityContext?: KonlingKnowledgeCapabilityContext;
  sarAssociatedGrounding?: KonlingSarAssociatedGroundingContext | null;
  graphContext?: KonlingKaqGraphContext | null;
  /**
   * Server-owned Authority / Teaching Projection combination for dual-domain
   * grounding (#1274). Absent when no layered payload was supplied.
   */
  teachingProjectionContext?: KonlingTeachingProjectionContext | null;
  citationContext?: KonlingCitationContext;
  permittedTools: KonlingToolName[];
  missingContext: string[];
  featureFlags: {
    learnerState: boolean;
    semanticMemory: boolean;
    strategyMemory: boolean;
  };
}

export interface KonlingKnowledgeWorkspaceHint {
  selectedNodeId?: string | null;
  requestedNodeId?: string | null;
  status?: 'selected-node' | 'no-selection' | 'degraded' | null;
  activeFilters?: string[] | null;
  densityMode?: string | null;
  viewMode?: string | null;
  visibleRelationCount?: number | null;
  selectedNodeRelationCount?: number | null;
}

export function normalizeKonlingKnowledgeWorkspaceHint(value: unknown): KonlingKnowledgeWorkspaceHint | null {
  const record = readRecord(value);
  const selectedNodeId = sanitizeKnowledgeWorkspaceText(record.selectedNodeId);
  const requestedNodeId = sanitizeKnowledgeWorkspaceText(record.requestedNodeId);
  const status = record.status === 'selected-node' || record.status === 'no-selection' || record.status === 'degraded'
    ? record.status
    : null;
  const activeFilters = normalizeKnowledgeWorkspaceStrings(record.activeFilters);
  const densityMode = sanitizeKnowledgeWorkspaceText(record.densityMode);
  const viewMode = sanitizeKnowledgeWorkspaceText(record.viewMode);
  const visibleRelationCount = normalizeKnowledgeWorkspaceOptionalCount(record.visibleRelationCount);
  const selectedNodeRelationCount = normalizeKnowledgeWorkspaceOptionalCount(record.selectedNodeRelationCount);

  if (
    selectedNodeId
    || requestedNodeId
    || status
    || activeFilters.length > 0
    || densityMode
    || viewMode
    || visibleRelationCount !== null
    || selectedNodeRelationCount !== null
  ) {
    return {
      selectedNodeId,
      requestedNodeId,
      status,
      activeFilters,
      densityMode,
      viewMode,
      visibleRelationCount,
      selectedNodeRelationCount,
    };
  }

  return null;
}

export interface KonlingKnowledgeWorkspaceContext {
  source: 'server-owned';
  route: '/knowledge';
  status: 'selected-node' | 'no-selection' | 'degraded';
  selected_node: {
    id: string;
    name: string;
    node_type: string;
    chapter: string | null;
    knowledge_dim: string | null;
    description: string;
    tags: string[];
    capability_target_refs?: string[];
  } | null;
  relation_summary: {
    density_mode: string | null;
    view_mode: string | null;
    active_filters: string[];
    visible_relation_count: number;
    selected_node_relation_count: number;
  };
  available_learning_actions: string[];
  hover_policy: 'preview-only-not-durable-context';
  missing_context: string[];
}

export interface KonlingKnowledgeCapabilityContext {
  source: 'server-owned';
  answerIntent: KonlingAnswerIntent;
  knowledgeNodeRefs: string[];
  capabilityTargetRefs: string[];
  resourceRefs: string[];
  pathNodeRefs: string[];
  citationRefs: string[];
  sarAssociatedGrounding?: KonlingSarAssociatedGroundingContext | null;
  scope: Pick<KonlingRuntimeScope, 'authenticatedUserId' | 'targetUserId' | 'role' | 'classId' | 'courseId' | 'pageId' | 'resourceId' | 'pathNodeId' | 'privacyScopes'>;
  missingContext: string[];
}

export interface KonlingSarAssociatedGroundingContext {
  source: 'sar-association-expansion';
  useCase: SarAssociationExpansionUseCase;
  seedRefs: string[];
  associatedEventRefs: string[];
  associatedEntityRefs: string[];
  candidateRefs: SarAssociationCandidateRefs;
  sourcePackSeedRefs: string[];
  traceSummary: {
    hopCount: number;
    selectedRefCount: number;
    rejectedRefCount: number;
    safeEventSummaries: string[];
    limitationCodes: string[];
  };
  limitations: string[];
}

export interface KonlingSarAssociatedGroundingMetadataPayload {
  source: 'sar-association-expansion';
  useCase: SarAssociationExpansionUseCase;
  seedRefs: string[];
  traceSummary: KonlingSarAssociatedGroundingContext['traceSummary'];
  limitations: string[];
}

export function buildKonlingSarAssociatedGroundingMetadataPayload(
  grounding: KonlingSarAssociatedGroundingContext | null | undefined,
): KonlingSarAssociatedGroundingMetadataPayload | null {
  if (!grounding) return null;
  return {
    source: grounding.source,
    useCase: grounding.useCase,
    seedRefs: [...grounding.seedRefs],
    traceSummary: {
      hopCount: grounding.traceSummary.hopCount,
      selectedRefCount: grounding.traceSummary.selectedRefCount,
      rejectedRefCount: grounding.traceSummary.rejectedRefCount,
      safeEventSummaries: [...grounding.traceSummary.safeEventSummaries],
      limitationCodes: [...grounding.traceSummary.limitationCodes],
    },
    limitations: [...grounding.limitations],
  };
}

interface KonlingKnowledgeCapabilityToolContext extends Omit<KonlingKnowledgeCapabilityContext, 'scope'> {
  scope: {
    role: AdaptiveLearnerStateRole;
    courseId: string;
    pageId: string;
    resourceId: string | null | undefined;
    pathNodeId: string | null | undefined;
    classScoped: boolean;
    privacyLabel: 'student-visible' | 'teacher-scoped' | 'admin-scoped';
  };
}

function projectKonlingSarAssociatedGroundingForRole(
  grounding: KonlingSarAssociatedGroundingContext | null | undefined,
  role: AdaptiveLearnerStateRole,
): KonlingSarAssociatedGroundingContext | null {
  if (!grounding) return null;
  if (role !== 'student') {
    return grounding;
  }
  const safeLimitations = grounding.limitations.filter(isStudentSafeSarLimitation);
  const safeTraceLimitations = grounding.traceSummary.limitationCodes.filter(isStudentSafeSarLimitation);
  return {
    source: grounding.source,
    useCase: grounding.useCase,
    seedRefs: redactSarRefs(grounding.seedRefs),
    associatedEventRefs: redactSarRefs(grounding.associatedEventRefs),
    associatedEntityRefs: redactSarRefs(grounding.associatedEntityRefs),
    candidateRefs: {
      eventIds: redactTypedSarRefs('event', grounding.candidateRefs.eventIds),
      entityIds: redactTypedSarRefs('entity', grounding.candidateRefs.entityIds),
      citationTargetIds: redactTypedSarRefs('citation-target', grounding.candidateRefs.citationTargetIds),
      retrievalChunkIds: redactTypedSarRefs('retrieval-chunk', grounding.candidateRefs.retrievalChunkIds),
      resourceNodeIds: redactTypedSarRefs('resource-node', grounding.candidateRefs.resourceNodeIds),
      planningUnitIds: redactTypedSarRefs('planning-unit', grounding.candidateRefs.planningUnitIds),
    },
    sourcePackSeedRefs: redactSarRefs(grounding.sourcePackSeedRefs),
    traceSummary: {
      hopCount: grounding.traceSummary.hopCount,
      selectedRefCount: grounding.traceSummary.selectedRefCount,
      rejectedRefCount: grounding.traceSummary.rejectedRefCount,
      safeEventSummaries: grounding.traceSummary.safeEventSummaries,
      limitationCodes: safeTraceLimitations,
    },
    limitations: safeLimitations,
  };
}

function redactSarRefs(refs: readonly string[]): string[] {
  return refs.map((_, index) => `sar-ref:${index + 1}`);
}

function redactTypedSarRefs(type: string, refs: readonly string[]): string[] {
  return refs.map((_, index) => `${type}:redacted-${index + 1}`);
}

function isStudentSafeSarLimitation(limitation: string): boolean {
  return [
    'source-pack-ranking-required',
    'citation-hydration-required',
    'no-resolved-seed-refs',
    'maxEvents-clamped',
    'maxEntities-clamped',
    'minConfidence-clamped',
  ].some((safeCode) => limitation === safeCode || limitation.startsWith(`${safeCode}:`));
}

export const KONLING_TEACHING_ASSISTANT_MODE_REGISTRY: Record<KonlingTeachingAssistantModeId, KonlingTeachingAssistantModeContract> = {
  'generic-chat': teachingAssistantMode({
    id: 'generic-chat',
    label: '通用控灵对话',
    supportedRoles: ['student', 'teacher', 'admin'],
    mountingSurfaces: ['generic-chat'],
    requiredContext: [],
    optionalContext: ['learner-state-summary', 'evidence-citations'],
    permittedTools: [
      'get_page_context',
      'search_textbook',
      'get_learner_state',
      'get_plan_context',
      'search_learning_memory',
      'search_knowledge_graph',
      'recommend_next_action',
      'get_simulation_status',
      'set_simulation_params',
      'analyze_result',
      'get_simulation_context',
      'run_virtual_simulation',
      'analyze_simulation_trace',
      'compare_simulation_runs',
      'propose_controller_patch',
      'apply_controller_patch',
      'record_intervention_result',
      'analyze_attempt',
    ],
    citationClasses: ['content', 'learner-state', 'path-execution', 'memory'],
    payload: 'student-visible-summary',
    outputStatus: 'chat',
    requiredCitationOwners: ['answer'],
  }),
  'diagnosis-explainer': teachingAssistantMode({
    id: 'diagnosis-explainer',
    label: '诊断解释器',
    supportedRoles: ['student', 'teacher'],
    mountingSurfaces: ['student-learning-overview'],
    requiredContext: ['diagnosis-view', 'learner-state-summary', 'evidence-citations'],
    optionalContext: ['adaptive-attempt', 'path-execution-context'],
    permittedTools: ['get_page_context', 'search_textbook', 'get_learner_state', 'get_plan_context', 'search_knowledge_graph', 'recommend_next_action'],
    citationClasses: ['learner-state', 'path-execution', 'content'],
    payload: 'aggregate-and-redacted-only',
    outputStatus: 'advisory-only',
    requiredCitationOwners: ['answer', 'recommendation'],
  }),
  'path-advisor': teachingAssistantMode({
    id: 'path-advisor',
    label: '学习路径顾问',
    supportedRoles: ['student', 'teacher'],
    mountingSurfaces: ['student-path-center'],
    requiredContext: ['learner-state-summary', 'evidence-citations'],
    optionalContext: ['path-execution-context', 'diagnosis-view', 'resource-node'],
    permittedTools: [
      'get_page_context',
      'search_textbook',
      'get_learner_state',
      'get_plan_context',
      'search_knowledge_graph',
      'recommend_next_action',
      'generate_learning_path',
      'revise_learning_path_options',
      'select_learning_path',
      'reject_learning_path_option',
      'explain_learning_path_tradeoff',
      'record_path_adjustment_outcome',
    ],
    citationClasses: ['learner-state', 'content'],
    payload: 'aggregate-and-redacted-only',
    outputStatus: 'advisory-only',
    requiredCitationOwners: ['answer', 'recommendation'],
  }),
  'resource-coach': teachingAssistantMode({
    id: 'resource-coach',
    label: '资源学习教练',
    supportedRoles: ['student', 'teacher'],
    mountingSurfaces: ['resource-node-launch'],
    requiredContext: ['resource-node', 'path-execution-context', 'evidence-citations'],
    optionalContext: ['learner-state-summary'],
    permittedTools: ['get_page_context', 'search_textbook', 'get_learner_state', 'get_plan_context', 'search_knowledge_graph', 'recommend_next_action', 'analyze_attempt'],
    citationClasses: ['content', 'path-execution', 'learner-state'],
    payload: 'student-visible-summary',
    outputStatus: 'advisory-only',
    requiredCitationOwners: ['answer', 'recommendation'],
  }),
  'grading-assistant': teachingAssistantMode({
    id: 'grading-assistant',
    label: '文档批改助手',
    supportedRoles: ['teacher'],
    mountingSurfaces: ['teacher-grading-workbench'],
    requiredContext: ['rubric', 'converted-document', 'draft-grading-state', 'teacher-review-state', 'evidence-citations'],
    optionalContext: ['learner-state-summary'],
    permittedTools: ['get_page_context', 'search_textbook', 'search_knowledge_graph'],
    citationClasses: ['content', 'learner-state'],
    payload: 'teacher-scoped-summary',
    outputStatus: 'draft-only',
    requiredCitationOwners: ['answer', 'report-explanation'],
    forbiddenActions: ['approve-grading', 'write-back-profile'],
  }),
  'feedback-explainer': teachingAssistantMode({
    id: 'feedback-explainer',
    label: '学生反馈解释器',
    supportedRoles: ['student'],
    mountingSurfaces: ['student-feedback'],
    requiredContext: ['student-feedback', 'evidence-citations'],
    optionalContext: ['rubric', 'learner-state-summary'],
    permittedTools: ['get_page_context', 'search_textbook', 'get_learner_state', 'search_knowledge_graph', 'recommend_next_action'],
    citationClasses: ['content', 'learner-state'],
    payload: 'student-visible-summary',
    outputStatus: 'advisory-only',
    requiredCitationOwners: ['answer', 'recommendation'],
  }),
  'class-summarizer': teachingAssistantMode({
    id: 'class-summarizer',
    label: '班级学情总结器',
    supportedRoles: ['teacher'],
    mountingSurfaces: ['teacher-class-report'],
    requiredContext: ['class-report', 'diagnosis-view', 'evidence-citations'],
    optionalContext: ['path-execution-context'],
    permittedTools: ['get_page_context', 'get_learner_state', 'get_plan_context', 'search_knowledge_graph'],
    citationClasses: ['learner-state', 'path-execution', 'intervention'],
    payload: 'teacher-scoped-summary',
    outputStatus: 'advisory-only',
    requiredCitationOwners: ['answer', 'report-explanation'],
  }),
  'teacher-diagnosis': teachingAssistantMode({
    id: 'teacher-diagnosis',
    label: '教师学情诊断',
    supportedRoles: ['teacher'],
    mountingSurfaces: ['teacher-dashboard-diagnosis'],
    requiredContext: ['evidence-citations'],
    optionalContext: ['class-report', 'diagnosis-view', 'learner-state-summary', 'resource-node'],
    permittedTools: [
      'get_class_assignment_outcomes',
      'get_class_assessment_outcomes',
      'get_student_risk_flags',
      'get_class_competency_summary',
      'get_student_knowledge_progress',
    ],
    citationClasses: ['learner-state', 'path-execution', 'intervention'],
    payload: 'teacher-scoped-summary',
    outputStatus: 'draft-only',
    requiredCitationOwners: ['answer', 'report-explanation'],
    forbiddenActions: ['auto-publish-diagnosis', 'auto-apply-teaching-action'],
  }),
  'prep-coauthor': teachingAssistantMode({
    id: 'prep-coauthor',
    label: '教师备课共创',
    supportedRoles: ['teacher'],
    mountingSurfaces: ['teacher-prep-pack'],
    requiredContext: ['prep-pack', 'diagnosis-view', 'evidence-citations', 'teacher-review-state'],
    optionalContext: ['class-report', 'resource-node'],
    permittedTools: ['get_page_context', 'search_textbook', 'get_learner_state', 'get_plan_context', 'search_knowledge_graph', 'propose_smart_lesson_task_change'],
    citationClasses: ['learner-state', 'path-execution', 'content', 'intervention'],
    payload: 'teacher-scoped-summary',
    outputStatus: 'draft-only',
    requiredCitationOwners: ['answer', 'report-explanation'],
    forbiddenActions: [
      'publish-prep-item',
      'insert-lesson-item',
      'apply-smart-task-change',
      'confirm-smart-task-change',
      'start-generation-with-unconfirmed-task',
    ],
  }),
};

function normalizeKonlingTeachingAssistantModeId(modeId?: string | null): KonlingTeachingAssistantModeId | null {
  if (!modeId) return 'generic-chat';
  if (modeId in KONLING_TEACHING_ASSISTANT_MODE_REGISTRY) return modeId as KonlingTeachingAssistantModeId;
  return null;
}

export function resolveKonlingTeachingAssistantMode(
  modeId?: string | null,
): KonlingTeachingAssistantModeContract {
  const normalized = normalizeKonlingTeachingAssistantModeId(modeId);
  return KONLING_TEACHING_ASSISTANT_MODE_REGISTRY[normalized ?? 'generic-chat'];
}

export function getKonlingTeachingAssistantMountContracts(): KonlingTeachingAssistantMountContract[] {
  return Object.values(KONLING_TEACHING_ASSISTANT_MODE_REGISTRY)
    .flatMap((mode) => mode.mountingSurfaces.map((surface) => ({
      surface,
      modeId: mode.id,
      supportedRoles: mode.supportedRoles,
      requiredContext: mode.requiredContext,
      unavailableStates: mode.unavailableStates,
    })));
}

export function buildKonlingTeachingAssistantRuntimeContract(input: {
  modeId?: string | null;
  runtimeContext: KonlingRuntimeContext;
  scope: KonlingRuntimeScope;
  serverModeContext?: KonlingTeachingAssistantServerModeContext | null;
  clientContextHints?: Record<string, unknown> | null;
  currentUserQuery?: string | null;
  studyAnswerPreferences?: unknown;
}): KonlingTeachingAssistantRuntimeContract {
  const normalizedModeId = normalizeKonlingTeachingAssistantModeId(input.modeId);
  const mode = resolveKonlingTeachingAssistantMode(input.modeId);
  const clientHintsRejected = Object.keys(input.clientContextHints ?? {});
  const answerIntent = classifyKonlingAnswerIntent(
    mode,
    input.runtimeContext,
    input.scope,
    input.serverModeContext,
    input.currentUserQuery,
  );
  const studyQuestion = buildKonlingStudyQuestionContract({
    answerIntent,
    citationContext: input.runtimeContext.citationContext,
    preferences: input.studyAnswerPreferences,
    currentUserQuery: input.currentUserQuery,
    mathToolAvailable: mode.id === 'generic-chat'
      ? input.runtimeContext.permittedTools.includes('calculate')
      : mode.permittedTools.includes('calculate'),
  });
  const groundingContext = buildKonlingKnowledgeCapabilityContext({
    runtimeContext: input.runtimeContext,
    scope: input.scope,
    answerIntent,
    modeId: mode.id,
  });
  const roleSupported = mode.supportedRoles.includes(input.scope.role);
  const unknownModeReasons = input.modeId && !normalizedModeId ? [`unknown-mode:${input.modeId}`] : [];
  const smartPreparation = mode.id === 'prep-coauthor' && input.scope.role === 'teacher'
    ? input.serverModeContext?.smartPreparation ?? null
    : null;
  const adaptiveAttempt = mode.id === 'diagnosis-explainer'
    ? input.serverModeContext?.adaptiveAttempt ?? null
    : null;
  const wrongAnswerAttribution = mode.id === 'diagnosis-explainer'
    ? input.serverModeContext?.wrongAnswerAttribution ?? null
    : null;
  const requiredContext = adaptiveAttempt
    ? ['adaptive-attempt'] satisfies KonlingTeachingAssistantContextKey[]
    : smartPreparation
    ? smartPreparation.bootstrap
      ? [
          'prep-pack',
          'task-ambiguities',
          'teacher-review-state',
          'clarification-readiness',
        ] satisfies KonlingTeachingAssistantContextKey[]
      : [
        'smart-task',
        'selected-course-basis-versions',
        'task-ambiguities',
        'confirmed-task-decisions',
        'citation-state',
        'teacher-review-state',
        'clarification-readiness',
        ] satisfies KonlingTeachingAssistantContextKey[]
    : mode.requiredContext;
  const requiredCitationClasses = smartPreparation || adaptiveAttempt ? [] : mode.citationClasses;
  const missingRequiredContext = mode.id === 'generic-chat'
    ? []
    : requiredContext.flatMap((contextKey) =>
      isKonlingModeContextAvailable(contextKey, mode, input.runtimeContext, input.scope, input.serverModeContext)
        ? []
        : [`missing-context:${contextKey}`]
    );
  const missingCitationClasses = mode.id === 'generic-chat'
    ? []
    : requiredCitationClasses.flatMap((citationClass) =>
      hasKonlingCitationClass(citationClass, input.runtimeContext.citationContext)
        ? []
        : [`missing-citation:${citationClass}`]
    );
  const canAnswerFromTeachingContent = hasKonlingCitationClass('content', input.runtimeContext.citationContext);
  const canDegradePersonalization = canAnswerFromTeachingContent
    && supportsLimitedPersonalizationAnswerIntent(answerIntent);
  const blockingMissingRequiredContext = canDegradePersonalization
    ? missingRequiredContext.filter((reason) => !isLimitedPersonalizationContextReason(reason))
    : missingRequiredContext;
  const limitedPersonalizationContextReasons = canDegradePersonalization
    ? missingRequiredContext.filter((reason) =>
        isLimitedPersonalizationContextReason(reason) && reason !== 'missing-context:evidence-citations'
      )
    : [];
  const blockingMissingCitationClasses = canDegradePersonalization
    ? missingCitationClasses.filter((reason) => !isLimitedPersonalizationCitationReason(reason))
    : missingCitationClasses;
  const limitedPersonalizationCitationReasons = canDegradePersonalization
    ? missingCitationClasses.filter(isLimitedPersonalizationCitationReason)
    : [];
  const effectiveGraphContext = input.runtimeContext.graphContext
    ?? buildKonlingKaqGraphContext({
      scope: input.scope,
      clientHints: input.clientContextHints,
    });
  const unavailableReasons = [
    ...unknownModeReasons,
    ...(roleSupported ? [] : [`unsupported-role:${input.scope.role}`]),
    ...blockingMissingRequiredContext,
    ...blockingMissingCitationClasses,
  ];
  const graphGroundingDegradedReasons = isKonlingGraphAwareMode(mode, answerIntent)
    ? buildKonlingGraphGroundingDegradedReasons(effectiveGraphContext)
    : [];
  const degradedReasons = unavailableReasons.length === 0
    ? [
        ...(input.runtimeContext.citationContext?.lowConfidenceReasons ?? []),
        ...limitedPersonalizationContextReasons,
        ...limitedPersonalizationCitationReasons,
        ...graphGroundingDegradedReasons,
      ]
    : [];
  const status: KonlingTeachingAssistantStatus = unknownModeReasons.length > 0
    ? 'unavailable'
    : mode.id === 'generic-chat'
    ? 'ready'
    : unavailableReasons.length > 0
      ? 'unavailable'
      : degradedReasons.length > 0
        ? 'degraded'
        : 'ready';
  const runtimePermittedTools = new Set(input.runtimeContext.permittedTools);
  const permittedTools = mode.id === 'generic-chat'
    ? input.runtimeContext.permittedTools
    : mode.permittedTools.filter((toolName) => {
      if (isKonlingAdaptivePathTool(toolName)) {
        return isKonlingModeOwnedTool(mode, toolName, input.scope, input.serverModeContext);
      }
      return runtimePermittedTools.has(toolName);
    });
  const safePermittedTools = status === 'unavailable' ? [] : permittedTools;

  return {
    mode,
    answerIntent,
    studyQuestion,
    status,
    unavailableReasons,
    degradedReasons,
    groundingContext: projectKonlingKnowledgeCapabilityContextForRole(groundingContext, input.scope.role),
    graphContext: projectKonlingGraphContextForRole(effectiveGraphContext, input.scope.role),
    scope: {
      authenticatedUserId: input.scope.authenticatedUserId,
      targetUserId: input.scope.targetUserId,
      role: input.scope.role,
      classId: input.scope.classId,
      courseId: input.scope.courseId,
      pageId: input.scope.pageId,
      resourceId: input.scope.resourceId,
      pathNodeId: input.scope.pathNodeId,
      privacyScopes: input.scope.privacyScopes,
    },
    permittedTools: safePermittedTools,
    citationRequirements: {
      required: mode.id !== 'generic-chat' || input.runtimeContext.citationContext?.required === true,
      classes: requiredCitationClasses,
      requiredOwners: mode.outputContract.requiredCitationOwners,
      missingClasses: missingCitationClasses.map((reason) => reason.replace('missing-citation:', '')),
    },
    privacyPolicy: mode.privacyPolicy,
    outputContract: mode.outputContract,
    smartPreparation,
    adaptiveAttempt,
    wrongAnswerAttribution,
    authorizedCandidateBatch: mode.id === 'path-advisor'
      ? input.serverModeContext?.authorizedCandidateBatch ?? null
      : null,
    clientHintsAccepted: [],
    clientHintsRejected,
  };
}

function projectKonlingKnowledgeCapabilityContextForRole(
  context: KonlingKnowledgeCapabilityContext,
  role: AdaptiveLearnerStateRole,
): KonlingKnowledgeCapabilityContext {
  return {
    ...context,
    sarAssociatedGrounding: projectKonlingSarAssociatedGroundingForRole(context.sarAssociatedGrounding, role),
  };
}

function isKonlingGraphAwareMode(
  mode: KonlingTeachingAssistantModeContract,
  answerIntent: KonlingAnswerIntent,
): boolean {
  return (
    answerIntent === 'path-advice'
    || answerIntent === 'personalized-diagnosis'
    || mode.id === 'resource-coach'
    || mode.id === 'prep-coauthor'
  );
}

function classifyKonlingAnswerIntent(
  mode: KonlingTeachingAssistantModeContract,
  runtimeContext: KonlingRuntimeContext,
  scope: KonlingRuntimeScope,
  serverModeContext?: KonlingTeachingAssistantServerModeContext | null,
  currentUserQuery?: string | null,
): KonlingAnswerIntent {
  if (mode.id === 'diagnosis-explainer' || mode.id === 'class-summarizer') return 'personalized-diagnosis';
  if (mode.id === 'path-advisor') return 'path-advice';
  if (mode.id === 'grading-assistant' || mode.id === 'feedback-explainer') return 'grading-explanation';
  if (mode.id === 'resource-coach') {
    return serverModeContext?.['media-resource'] === true ? 'media-guidance' : 'fact-explanation';
  }
  if (mode.id === 'generic-chat') {
    if (isKonlingMediaGuidanceScope(runtimeContext)) return 'media-guidance';
    return classifyGenericStudyQuestionIntent(currentUserQuery);
  }
  return 'fact-explanation';
}

// Shared vocabulary so the independent normative-risk detector can never be
// weaker than the primary intent classifier (#1901): modes whose answer intent
// bypasses the generic classifier must not bypass the fail-closed gate.
const KONLING_NORMATIVE_QUERY_MARKERS = [
  '法律', '法条', '法规', '法律要求', '官方规定', '官方要求', '官方限值',
  '国家标准', '行业标准', '标准格式', '规范书写', '规范格式', '国标格式', '化学方程式',
  '必须写', '才算合格', '操作规程', '考核办法', '认证',
  'official rule', 'official requirement', 'official limit', 'legal requirement',
  'standard format', 'certification', 'certified', 'must not', 'shall not',
] as const;

// #1948 组合信号：规范/要求/格式措辞 × 权威来源文档。两个词面都出现才判
// 规范诉求，避免单独的「要求/格式」吞并普通课程问题；与单命中标记共享给主分
// 类器与独立风险探测器，维持 #1901 平价不变量。来源词必须是权威出处本身
// （报告/论文/学校/教务/大纲等），不含「课程」这类泛学习上下文（review：课
// 程要求我们比较 A 和 B」不得触发规范门禁）。
const KONLING_NORMATIVE_COMBO_TERMS = ['规范', '要求', '格式', '封面', '模板', '书写', '排版'] as const;
const KONLING_NORMATIVE_SOURCE_TERMS = ['报告', '论文', '学校', '教务', '学院', '考核', '大纲', '官方', '标准'] as const;

// #1948 组合信号：控制系统异常现象 × 定位/修复动作。现象词必须搭配排障动
// 作才判代码调试，「解释超调」「什么是超调量」等仅含现象词的问题不被吞并。
const KONLING_DEBUG_PHENOMENON_MARKERS = ['饱和', '超调', '振荡', '震荡', '发散', '不收敛', '抖动', '失稳', '畸变', '溢出', '崩溃', '卡死'] as const;
const KONLING_DEBUG_RESOLUTION_MARKERS = ['定位', '修复', '排查', '排除', '解决', '怎么修', '如何修', '怎么办', '怎么处理', '如何处理', '找出原因'] as const;

function hasNormativeComboSignal(normalized: string): boolean {
  return includesAny(normalized, KONLING_NORMATIVE_COMBO_TERMS)
    && includesAny(normalized, KONLING_NORMATIVE_SOURCE_TERMS);
}

function classifyGenericStudyQuestionIntent(query: string | null | undefined): KonlingStudyQuestionContract['intent'] {
  const normalized = query?.trim().toLowerCase().normalize('NFKC') ?? '';
  if (!normalized) return 'fact-explanation';
  if (includesAny(normalized, KONLING_NORMATIVE_QUERY_MARKERS) || hasNormativeComboSignal(normalized)) {
    return 'normative-content';
  }
  if (
    includesAny(normalized, ['推导', '证明', '演算', 'derive', 'derivation', 'prove', '一步步得到'])
    || (
      includesAny(normalized, ['怎么得到', '如何得到'])
      && includesAny(normalized, ['传递函数', '特征方程', '控制律', '公式', '离散化', '根轨迹增益', 'bode', 'nyquist', '包围圈'])
    )
  ) {
    return 'formula-derivation';
  }
  if (
    includesAny(normalized, [
      '报错', '错误', '调试', 'bug', 'debug', 'exception', 'traceback', '改了参数还是', '下不来',
    ])
    || (
      includesAny(normalized, KONLING_DEBUG_PHENOMENON_MARKERS)
      && includesAny(normalized, KONLING_DEBUG_RESOLUTION_MARKERS)
    )
  ) {
    return 'code-debugging';
  }
  if (includesAny(normalized, [
    '区别', '辨析', '比较', '联系与区别', 'difference', 'compare', 'versus', ' vs ', '该怎么选',
  ])) {
    return 'concept-comparison';
  }
  if (includesAny(normalized, [
    '举例', '换一种说法', '换一种格式', '自定义', 'example', 'explain in', '生活化例子', '更直白', '为什么',
  ])) {
    return 'open-ended-explanation';
  }
  if (includesAny(normalized, ['什么是', '是什么', '定义', '含义', '大概表示什么', 'what is', 'meaning of'])) {
    return 'fact-explanation';
  }
  return 'open-ended-explanation';
}

function includesAny(value: string, markers: readonly string[]): boolean {
  return markers.some((marker) => value.includes(marker));
}

const NORMATIVE_STANDARD_ID = /\b(?:gb\/t|gb\/z|gb[/\s.-]?\d|iso[\s.-]?\d|iec[\s.-]?\d|ieee[\s.-]?\d|en[\s.-]?\d|astm[\s.-]?[a-z]?\d)/i;
const NORMATIVE_OBLIGATION = /(?:必须|不得|应当|严禁).{0,16}(?:标准|规定|法规|认证|条款|限值|格式|合格|遵守|符合)|(?:must|shall)\s+(?:not\s+)?(?:comply|meet|satisfy|observe|follow)/i;

function hasIndependentNormativeRisk(query: string | null | undefined): boolean {
  const normalized = query?.trim().toLowerCase().normalize('NFKC') ?? '';
  if (!normalized) return false;
  return NORMATIVE_STANDARD_ID.test(normalized)
    || includesAny(normalized, KONLING_NORMATIVE_QUERY_MARKERS)
    || hasNormativeComboSignal(normalized)
    || NORMATIVE_OBLIGATION.test(normalized);
}

function buildKonlingStudyQuestionContract(input: {
  answerIntent: KonlingAnswerIntent;
  citationContext: KonlingCitationContext | null | undefined;
  preferences: unknown;
  currentUserQuery?: string | null;
  mathToolAvailable?: boolean;
}): KonlingStudyQuestionContract | null {
  const independentRisk = hasIndependentNormativeRisk(input.currentUserQuery);
  let intent: KonlingStudyQuestionContract['intent'];
  if (isKnownStudyQuestionIntent(input.answerIntent)) {
    intent = input.answerIntent;
  } else if (independentRisk) {
    intent = 'open-ended-explanation';
  } else {
    return null;
  }
  const preferences = normalizeKonlingStudyAnswerPreferences(
    input.preferences,
    input.currentUserQuery,
    input.mathToolAvailable,
  );
  const hasAuthority = hasVerifiedNormativeCitation(input.citationContext?.contentCitations ?? []);
  const requiresNormativeGate = input.answerIntent === 'normative-content' || independentRisk;
  const normativeGuidance = requiresNormativeGate
    ? (hasAuthority ? 'verified' : 'verification-required')
    : 'not-applicable';
  return {
    intent,
    requiredSections: studyQuestionSectionTitles(intent),
    normativeGuidance,
    preferences,
  };
}

function normalizeKonlingStudyAnswerPreferences(
  value: unknown,
  currentUserQuery?: string | null,
  mathToolAvailable = false,
): KonlingStudyAnswerPreferences {
  const source = readRecord(value);
  const query = currentUserQuery?.trim().toLowerCase().normalize('NFKC') ?? '';
  const depth = getString(source, 'depth');
  const format = getString(source, 'format');
  const hintStrength = getString(source, 'hintStrength');
  const exampleContext = getString(source, 'exampleContext').trim().slice(0, 120);
  return {
    depth: depth === 'concise' || depth === 'detailed'
      ? depth
      : includesAny(query, ['简洁', '概述', '要点', 'concise', 'brief'])
        ? 'concise'
        : includesAny(query, ['详细', '深入', '完整推导', 'detailed', 'in depth'])
          ? 'detailed'
          : mathToolAvailable
            ? 'detailed'
            : 'standard',
    format: format === 'steps' || format === 'table' || format === 'code-first'
      ? format
      : includesAny(query, ['表格', '对照表', 'table'])
        ? 'table'
        : includesAny(query, ['分步骤', '一步一步', '逐步', 'step by step'])
          ? 'steps'
          : includesAny(query, ['先给代码', '代码优先', 'code first'])
            ? 'code-first'
            : mathToolAvailable
              ? 'steps'
              : 'default',
    hintStrength: hintStrength === 'guided'
      ? 'guided'
      : includesAny(query, ['循序渐进', '逐步提示', '只给提示', '不要直接给答案', 'guided hint'])
        ? 'guided'
        : 'full-answer',
    exampleContext: exampleContext || null,
  };
}

function hasVerifiedNormativeCitation(citations: readonly KonlingCitation[]): boolean {
  return citations.some((citation) => (
    citation.verified === true
    && citation.resolver === 'official-reference'
    && citation.confidence === 'high'
    && Boolean(citation.citationTargetId)
    && Boolean(citation.href)
  ));
}

function supportsLimitedPersonalizationAnswerIntent(answerIntent: KonlingAnswerIntent): boolean {
  return answerIntent === 'fact-explanation'
    || answerIntent === 'personalized-diagnosis'
    || answerIntent === 'path-advice'
    || answerIntent === 'grading-explanation';
}

function isLimitedPersonalizationContextReason(reason: string): boolean {
  return reason === 'missing-context:learner-state-summary'
    || reason === 'missing-context:path-execution-context'
    || reason === 'missing-context:evidence-citations';
}

function isLimitedPersonalizationCitationReason(reason: string): boolean {
  if (!reason.startsWith('missing-citation:')) return false;
  return isPersonalizationCitationClass(reason.replace('missing-citation:', ''));
}

function isKonlingMediaGuidanceScope(
  runtimeContext: KonlingRuntimeContext,
): boolean {
  const pageType = runtimeContext.pageContext.pageType?.toLowerCase?.() ?? '';
  return ['video', 'audio', 'image', 'media', 'interactive'].some((marker) =>
    pageType.includes(marker)
  );
}

function buildKonlingKnowledgeCapabilityContext(input: {
  runtimeContext: KonlingRuntimeContext;
  scope: KonlingRuntimeScope;
  answerIntent: KonlingAnswerIntent;
  modeId?: KonlingTeachingAssistantModeId;
}): KonlingKnowledgeCapabilityContext {
  const selectedNode = input.runtimeContext.knowledgeWorkspace?.selected_node ?? null;
  const knowledgeNodeRefs = selectedNode?.id ? [`knowledge-node:${selectedNode.id}`] : [];
  const capabilityTargetRefs = [
    ...(selectedNode?.capability_target_refs ?? []),
    ...extractCapabilityTargetRefs(input.runtimeContext.planContext),
  ];
  const resourceRefs = [
    input.scope.resourceId ? `resource:${input.scope.resourceId}` : null,
  ].filter((item): item is string => Boolean(item));
  const pathNodeRefs = [
    input.scope.pathNodeId ? `path-node:${input.scope.pathNodeId}` : null,
    input.runtimeContext.planContext.activeNodeId ? `path-node:${input.runtimeContext.planContext.activeNodeId}` : null,
    ...input.runtimeContext.planContext.nextNodeIds.map((nodeId) => `path-node:${nodeId}`),
  ].filter((item): item is string => Boolean(item));
  const citationRefs = [
    ...(input.runtimeContext.citationContext?.contentCitations ?? []),
    ...(input.runtimeContext.citationContext?.evidenceCitations ?? []),
  ];
  const missingContext = [
    knowledgeNodeRefs.length === 0 ? 'knowledge-node-context-missing' : null,
    capabilityTargetRefs.length === 0 ? 'capability-target-context-missing' : null,
    input.answerIntent === 'media-guidance' && resourceRefs.length === 0 ? 'resource-context-missing' : null,
    input.answerIntent === 'path-advice' && pathNodeRefs.length === 0 ? 'path-node-context-missing' : null,
  ].filter((item): item is string => Boolean(item));
  const sarAssociatedGrounding = buildKonlingSarAssociatedGrounding({
    answerIntent: input.answerIntent,
    modeId: input.modeId ?? 'generic-chat',
    knowledgeNodeRefs: [...new Set(knowledgeNodeRefs)],
    capabilityTargetRefs: [...new Set(capabilityTargetRefs)],
    resourceRefs: [...new Set(resourceRefs)],
    pathNodeRefs: [...new Set(pathNodeRefs)],
    citationRefs: buildGroundingCitationRefs(citationRefs),
    scope: input.scope,
  });

  return {
    source: 'server-owned',
    answerIntent: input.answerIntent,
    knowledgeNodeRefs: [...new Set(knowledgeNodeRefs)],
    capabilityTargetRefs: [...new Set(capabilityTargetRefs)],
    resourceRefs: [...new Set(resourceRefs)],
    pathNodeRefs: [...new Set(pathNodeRefs)],
    citationRefs: buildGroundingCitationRefs(citationRefs),
    sarAssociatedGrounding,
    scope: {
      authenticatedUserId: input.scope.authenticatedUserId,
      targetUserId: input.scope.targetUserId,
      role: input.scope.role,
      classId: input.scope.classId,
      courseId: input.scope.courseId,
      pageId: input.scope.pageId,
      resourceId: input.scope.resourceId,
      pathNodeId: input.scope.pathNodeId,
      privacyScopes: input.scope.privacyScopes,
    },
    missingContext,
  };
}

function buildKonlingSarAssociatedGrounding(input: {
  answerIntent: KonlingAnswerIntent;
  modeId: KonlingTeachingAssistantModeId;
  knowledgeNodeRefs: readonly string[];
  capabilityTargetRefs: readonly string[];
  resourceRefs: readonly string[];
  pathNodeRefs: readonly string[];
  citationRefs: readonly string[];
  scope: KonlingRuntimeScope;
}): KonlingSarAssociatedGroundingContext | null {
  const useCase = resolveKonlingSarUseCase(input.answerIntent, input);
  if (!useCase) return null;
  const entityRefs = buildKonlingSarEntityRefs(input);
  if (entityRefs.length === 0) return null;
  const id = stableKonlingSarGroundingId(input.scope, input.answerIntent);
  const projection = projectGovernedSummaryToSar({
    id,
    title: `Konling ${input.answerIntent} grounding`,
    summary: `Server-owned Konling grounding for ${input.answerIntent}.`,
    sourceOwner: 'konling-agent-runtime',
    sourceRefId: id,
    eventType: input.answerIntent === 'path-advice'
      ? 'path-summary'
      : input.answerIntent === 'personalized-diagnosis'
        ? 'diagnosis-summary'
        : 'learning-fact-summary',
    privacyScope: input.scope.role === 'student' ? 'student-visible' : 'teacher-scoped',
    entityRefs,
    citationTargetRefs: input.citationRefs.filter((ref) => ref.startsWith('content:')),
    limitations: input.scope.role === 'student' ? [] : ['teacher-scoped-sar-trace-redacted-for-students'],
    versionRefs: ['konling-sar-grounding.v1'],
  });
  const result = expandSarAssociations({
    id,
    query: input.answerIntent,
    useCase,
    callerScope: buildKonlingSarCallerScope(input.scope),
    seedRefs: projection.entities.map((entityItem) => entityItem.id),
    projection,
    maxHops: 1,
    maxEvents: 12,
    maxEntities: 12,
    minConfidence: 0.5,
    versionRefs: ['konling-sar-grounding.v1'],
  });
  return {
    source: 'sar-association-expansion',
    useCase,
    seedRefs: result.trace.seedEntityIds,
    associatedEventRefs: result.candidateRefs.eventIds,
    associatedEntityRefs: result.candidateRefs.entityIds,
    candidateRefs: result.candidateRefs,
    sourcePackSeedRefs: result.sourcePackSeedRefs,
    traceSummary: {
      hopCount: result.trace.expansionHops.length,
      selectedRefCount: result.trace.selectedRefs.length,
      rejectedRefCount: result.trace.rejectedRefs.length,
      safeEventSummaries: result.events.map((event) => event.safeSummary).slice(0, 6),
      limitationCodes: result.limitations,
    },
    limitations: result.limitations,
  };
}

function resolveKonlingSarUseCase(
  answerIntent: KonlingAnswerIntent,
  input: Pick<KonlingSarAssociatedGroundingContextInput, 'modeId' | 'resourceRefs'>,
): SarAssociationExpansionUseCase | null {
  if (!isKonlingSarEligibleMode(input.modeId)) return null;
  if (answerIntent === 'path-advice') return 'path-planning';
  if (answerIntent === 'personalized-diagnosis') return 'diagnostic-trace';
  if (answerIntent === 'media-guidance') return input.resourceRefs.length > 0 ? 'source-pack-seeding' : null;
  if (answerIntent === 'fact-explanation') return 'graph-context';
  if (answerIntent === 'grading-explanation') return 'diagnostic-trace';
  return null;
}

type KonlingSarAssociatedGroundingContextInput = {
  modeId: KonlingTeachingAssistantModeId;
  knowledgeNodeRefs: readonly string[];
  capabilityTargetRefs: readonly string[];
  resourceRefs: readonly string[];
  pathNodeRefs: readonly string[];
};

function isKonlingSarEligibleMode(modeId: KonlingTeachingAssistantModeId): boolean {
  return [
    'diagnosis-explainer',
    'path-advisor',
    'resource-coach',
    'grading-assistant',
    'feedback-explainer',
    'class-summarizer',
    'prep-coauthor',
  ].includes(modeId);
}

function buildKonlingSarEntityRefs(input: {
  knowledgeNodeRefs: readonly string[];
  capabilityTargetRefs: readonly string[];
  resourceRefs: readonly string[];
  pathNodeRefs: readonly string[];
  citationRefs: readonly string[];
}): GovernedSummaryEntityRef[] {
  return [
    ...input.knowledgeNodeRefs.map((ref) => governedSummaryEntityRef('graph-node', ref, 'supports')),
    ...input.capabilityTargetRefs.map((ref) => governedSummaryEntityRef('kaq-objective', ref, 'supports')),
    ...input.resourceRefs.map((ref) => governedSummaryEntityRef('resource-node', stripKnownRefPrefix(ref, 'resource:'), 'evidence-for')),
    ...input.pathNodeRefs.map((ref) => governedSummaryEntityRef('path-node', stripKnownRefPrefix(ref, 'path-node:'), 'candidate-for')),
    ...input.citationRefs
      .filter((ref) => ref.startsWith('content:'))
      .map((ref) => governedSummaryEntityRef('citation-target', ref, 'evidence-for')),
  ];
}

function governedSummaryEntityRef(
  entityType: GovernedSummaryEntityRef['entityType'],
  canonicalRef: string,
  role: GovernedSummaryEntityRef['role'],
): GovernedSummaryEntityRef {
  return {
    entityType,
    canonicalRef,
    label: canonicalRef,
    role,
    privacyScope: 'student-visible',
    aliases: [canonicalRef],
  };
}

function stripKnownRefPrefix(ref: string, prefix: string): string {
  return ref.startsWith(prefix) ? ref.slice(prefix.length) : ref;
}

function stableKonlingSarGroundingId(scope: KonlingRuntimeScope, answerIntent: KonlingAnswerIntent): string {
  return uniqueStrings([
    'konling',
    answerIntent,
    scope.courseId,
    scope.pageId,
    scope.resourceId ?? '',
    scope.pathNodeId ?? '',
  ]).join(':').replace(/[^A-Za-z0-9_.:-]/g, '-');
}

function buildKonlingSarCallerScope(scope: KonlingRuntimeScope): SarAssociationCallerScope {
  if (scope.role === 'student') {
    return {
      role: 'student',
      studentId: scope.targetUserId,
    };
  }
  if (scope.role === 'teacher') {
    return {
      role: 'teacher',
      classId: scope.classId ?? undefined,
    };
  }
  return {
    role: 'admin',
    classId: scope.classId ?? undefined,
  };
}

function buildGroundingCitationRefs(citations: KonlingCitation[]): string[] {
  const counts: Partial<Record<KonlingCitation['sourceType'], number>> = {};
  return citations.map((citation) => {
    const nextIndex = (counts[citation.sourceType] ?? 0) + 1;
    counts[citation.sourceType] = nextIndex;
    return `${citation.sourceType}:${nextIndex}`;
  });
}

function buildKonlingKnowledgeCapabilityToolContext(
  context: KonlingKnowledgeCapabilityContext,
): KonlingKnowledgeCapabilityToolContext {
  return {
    source: context.source,
    answerIntent: context.answerIntent,
    knowledgeNodeRefs: context.knowledgeNodeRefs,
    capabilityTargetRefs: context.capabilityTargetRefs,
    resourceRefs: context.resourceRefs,
    pathNodeRefs: context.pathNodeRefs,
    citationRefs: context.citationRefs,
    sarAssociatedGrounding: projectKonlingSarAssociatedGroundingForRole(
      context.sarAssociatedGrounding,
      context.scope.role,
    ),
    missingContext: context.missingContext,
    scope: {
      role: context.scope.role,
      courseId: context.scope.courseId,
      pageId: context.scope.pageId,
      resourceId: context.scope.resourceId,
      pathNodeId: context.scope.pathNodeId,
      classScoped: Boolean(context.scope.classId),
      privacyLabel: context.scope.role === 'admin'
        ? 'admin-scoped'
        : context.scope.role === 'teacher'
          ? 'teacher-scoped'
          : 'student-visible',
    },
  };
}

function extractCapabilityTargetRefs(planContext: KonlingPlanContext): string[] {
  return [
    ...(planContext.pathOptions ?? []).flatMap((option) => option.targetDeficits),
    ...(planContext.pathOptions ?? []).flatMap((option) =>
      option.evidenceBasis
        .filter((item) => item.startsWith('capability:') || item.startsWith('target:'))
    ),
  ];
}

function buildKonlingGroundingFallbackReasons(
  answerIntent: KonlingAnswerIntent,
  groundingContext: KonlingKnowledgeCapabilityContext,
): string[] {
  if (answerIntent === 'fact-explanation') {
    const hasTeachingKnowledgeSupport = groundingContext.knowledgeNodeRefs.length > 0
      || groundingContext.resourceRefs.length > 0
      || groundingContext.citationRefs.some((citationRef) => citationRef.startsWith('content:'));
    return !hasTeachingKnowledgeSupport
      ? ['missing-grounding:knowledge-or-resource']
      : [];
  }
  if (answerIntent === 'path-advice') {
    return [
      groundingContext.capabilityTargetRefs.length === 0 ? 'missing-grounding:capability-targets' : null,
      groundingContext.pathNodeRefs.length === 0 ? 'missing-grounding:path-context' : null,
    ].filter((item): item is string => Boolean(item));
  }
  if (answerIntent === 'media-guidance') {
    return groundingContext.resourceRefs.length === 0 ? ['missing-grounding:resource'] : [];
  }
  return [];
}

function teachingAssistantMode(input: {
  id: KonlingTeachingAssistantModeId;
  label: string;
  supportedRoles: AdaptiveLearnerStateRole[];
  mountingSurfaces: KonlingTeachingAssistantMountSurface[];
  requiredContext: KonlingTeachingAssistantContextKey[];
  optionalContext: KonlingTeachingAssistantContextKey[];
  permittedTools: KonlingToolName[];
  citationClasses: KonlingCitation['sourceType'][];
  payload: KonlingTeachingAssistantModeContract['privacyPolicy']['payload'];
  outputStatus: KonlingTeachingAssistantModeContract['outputContract']['status'];
  requiredCitationOwners: Array<KonlingCitation['owner']>;
  forbiddenActions?: string[];
}): KonlingTeachingAssistantModeContract {
  return {
    id: input.id,
    label: input.label,
    supportedRoles: input.supportedRoles,
    mountingSurfaces: input.mountingSurfaces,
    requiredContext: input.requiredContext,
    optionalContext: input.optionalContext,
    permittedTools: input.permittedTools,
    citationClasses: input.citationClasses,
    privacyPolicy: {
      payload: input.payload,
      forbiddenContent: [
        'raw-answer-body',
        'private-konling-memory',
        'hidden-arena-internals',
        'raw-high-frequency-trace',
        'secret',
      ],
    },
    unavailableStates: input.requiredContext.map((contextKey) => `missing-context:${contextKey}`),
    outputContract: {
      status: input.outputStatus,
      requiredCitationOwners: input.requiredCitationOwners,
      forbiddenActions: input.forbiddenActions ?? [],
    },
  };
}

function isKonlingModeContextAvailable(
  contextKey: KonlingTeachingAssistantContextKey,
  mode: KonlingTeachingAssistantModeContract,
  runtimeContext: KonlingRuntimeContext,
  scope: KonlingRuntimeScope,
  serverModeContext: KonlingTeachingAssistantServerModeContext | null | undefined,
): boolean {
  if (serverModeContext?.[contextKey] === true) return true;

  switch (contextKey) {
    case 'student-path-center':
      return isKonlingStudentPathCenterScope(scope);
    case 'diagnosis-view':
    case 'learner-state-summary':
      return Boolean(runtimeContext.learnerState) && !runtimeContext.missingContext.includes('learner-state');
    case 'adaptive-attempt':
      return Boolean(serverModeContext?.adaptiveAttempt);
    case 'evidence-citations':
      return mode.citationClasses.every((citationClass) =>
        hasKonlingCitationClass(citationClass, runtimeContext.citationContext)
      );
    case 'path-execution-context':
      return runtimeContext.planContext.status === 'available';
    case 'resource-node':
      return runtimeContext.knowledgeWorkspace?.status === 'selected-node'
        && Boolean(runtimeContext.knowledgeWorkspace.selected_node);
    case 'media-resource':
      return false;
    case 'rubric':
    case 'converted-document':
    case 'draft-grading-state':
    case 'teacher-review-state':
    case 'student-feedback':
    case 'class-report':
    case 'prep-pack':
    case 'smart-task':
    case 'selected-course-basis-versions':
    case 'task-ambiguities':
    case 'confirmed-task-decisions':
    case 'citation-state':
    case 'clarification-readiness':
      return false;
  }
}

function hasKonlingCitationClass(
  citationClass: KonlingCitation['sourceType'],
  citationContext: KonlingCitationContext | undefined,
): boolean {
  if (!citationContext) return false;
  return [...citationContext.contentCitations, ...citationContext.evidenceCitations]
    .some((citation) => citation.sourceType === citationClass);
}

export interface KonlingPlanContext {
  currentPathId: string | null;
  activeNodeId: string | null;
  nextNodeIds: string[];
  recentPathIds: string[];
  completedNodeIds: string[];
  progressVersion?: string;
  pathOptions?: KonlingPathOptionContext[];
  pathOptionFallback?: KonlingPathOptionFallbackContext | null;
  selectionHistory?: KonlingPathSelectionContext[];
  status: 'available' | 'missing';
}

export interface KonlingPathOptionContext {
  styleId: string;
  policyFamily: string;
  label: string;
  nodeIds: string[];
  targetDeficits: string[];
  evidenceBasis: string[];
  lockedNodeIds: string[];
  readinessSummary: Array<{
    nodeId: string;
    state: string;
    message: string;
  }>;
  resourceMix: Record<string, number>;
  effort: {
    estimatedMinutes: number;
    relative: string;
  };
  terminalValidationNodeIds: string[];
  limitations: string[];
}

export interface KonlingPathSelectionContext {
  type: string;
  selectedStyleId: string | null;
  previousStyleId: string | null;
  rejectedStyleIds: string[];
  createdAt: string | null;
  helpful: boolean | null;
}

export interface KonlingPathOptionFallbackContext {
  status: string;
  fallbackReasons: string[];
}

export interface KonlingCitation {
  id: string;
  sourceType: 'content' | 'learner-state' | 'path-execution' | 'simulation' | 'arena' | 'intervention' | 'memory';
  displayTitle: string;
  href: string | null;
  displayHref?: string | null;
  canonicalHref?: string | null;
  confidence: 'none' | 'low' | 'medium' | 'high';
  evidenceBasis: string;
  owner: 'answer' | 'recommendation' | 'intervention' | 'report-explanation';
  citationChip?: LearningEvidenceCitationChipPayload;
  citationTargetId?: string | null;
  retrievalChunkId?: string | null;
  answerRelevanceBasis?: string | null;
  answerRelevanceMatch?: string | null;
  answerRelevanceQueryHash?: string | null;
  omittedCitationReason?: string | null;
  verified?: boolean;
  resolver?: string | null;
  displayNumber?: number;
  canonicalKey?: string;
  identity?: KonlingCitationIdentity;
}

export interface KonlingCitationContext {
  required: boolean;
  contentCitations: KonlingCitation[];
  evidenceCitations: KonlingCitation[];
  sourcePacks?: KonlingSourcePackCitationSummary[];
  missingCitationClasses: string[];
  lowConfidenceReasons: string[];
  responseProtocol: {
    requiredOwners: Array<KonlingCitation['owner']>;
    minimum: {
      content: number;
      evidenceWhenAvailable: number;
    };
    fallbackWhenMissing: 'low-confidence';
  };
}

export interface KonlingSourcePackCitationSummary {
  packId: string;
  profile: SourcePack['profile'];
  queryText: string;
  citationTargetIds: string[];
  retrievalChunkIds: string[];
  limitationCodes: string[];
  answerRelevanceBases?: string[];
}

export interface KonlingAnswerUnitCoverageSectionState {
  sectionId: string;
  sectionTitle: string;
  citationPolicy: 'evidence-required' | 'model-derived';
  covered: boolean;
}


export interface KonlingAnswerUnitCoverageMissingReason {
  reason: KonlingAnswerUnitMissReason;
  count: number;
}

export interface KonlingAnswerUnitCitationCoverage {
  intent: string;
  sections: KonlingAnswerUnitCoverageSectionState[];
  coveredCount: number;
  requiredCount: number;
  ratio: number;
  missingReasons: KonlingAnswerUnitCoverageMissingReason[];
}

export interface KonlingCitationGuard {
  status: 'verified' | 'low-confidence';
  citations: KonlingCitation[];
  missingCitationClasses: string[];
  lowConfidenceReasons: string[];
  fallbackRequired: boolean;
  diagnosticReasons?: string[];
  personalizationAvailability?: {
    status: 'available' | 'limited';
    missingCitationClasses: string[];
    lowConfidenceReasons: string[];
  };
  studyQuestion?: KonlingStudyQuestionContract | null;
  answerUnits?: KonlingAnswerUnitCitationBinding[];
  answerUnitCoverage?: KonlingAnswerUnitCitationCoverage | null;
  // 非敏感聚合计数，独立于 coverage 可空条件持久化（生产保留字段）：
  // 即使回答没有任何需证据单元，仅出现在 model-derived/章节外的漂移也必须可观测
  answerCitationDriftCount?: number;
  answerCitationStackCount?: number;
  derivedSectionIds?: string[];
  unverifiedCitationMarkers?: number[];
  normativeCompliance?: KonlingNormativeCompliance | null;
}

export function buildKonlingCitationRetrievalSources(guard: KonlingCitationGuard) {
  return guard.citations.map(serializeKonlingCitationMetadata);
}

export function serializeKonlingCitationMetadata(citation: KonlingCitation) {
  return {
    sourceType: citation.sourceType,
    displayTitle: citation.displayTitle,
    href: citation.href,
    displayHref: citation.displayHref ?? citation.citationChip?.displayHref ?? null,
    canonicalHref: citation.canonicalHref ?? citation.href,
    confidence: citation.confidence,
    evidenceBasis: citation.evidenceBasis,
    id: citation.id,
    citationTargetId: citation.citationTargetId ?? null,
    retrievalChunkId: citation.retrievalChunkId ?? null,
    answerRelevanceBasis: citation.answerRelevanceBasis ?? null,
    answerRelevanceMatch: citation.answerRelevanceMatch ?? null,
    answerRelevanceQueryHash: citation.answerRelevanceQueryHash ?? null,
    omittedCitationReason: citation.omittedCitationReason ?? null,
    verified: citation.verified === true,
    resolver: citation.resolver ?? null,
    displayNumber: citation.displayNumber ?? null,
    canonicalKey: citation.canonicalKey ?? null,
    // 持久化引用必须携带结构化 identity（来源版本与目标锚点随 identity
    // 输出），sessions 重载不能只依赖 opaque canonicalKey（#1949 review）。
    identity: citation.identity ?? null,
    citationChip: jsonSafe(citation.citationChip),
  };
}

function jsonSafe(value: unknown): unknown | null {
  if (value === undefined) return null;
  return JSON.parse(JSON.stringify(value)) as unknown;
}

export interface KonlingMemoryView {
  id: string;
  memoryType: KonlingMemoryType | string;
  privacyScope: AdaptiveLearnerStatePrivacyScope | string;
  summary: string;
  evidenceRefs: unknown[];
  createdAt: string;
}

export interface KonlingInterventionRecord {
  id: string;
  shouldIntervene: boolean;
  reason: string;
  interventionType: string;
  content: string;
  whyNow: string;
  evidence: unknown[];
  alternatives: string[];
  relatedConcepts: string[];
  highlightParams: string[];
  showTrendPrediction: boolean;
  cooldownUntil: string | null;
}

export interface KonlingAgentSessionView {
  id: string;
  ownerUserId: string;
  actorUserId?: string | null;
  phase: string;
  status: KonlingAgentSessionStatus | string;
  state: Record<string, unknown>;
  permittedTools: string[];
  pendingApproval: Record<string, unknown> | null;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface KonlingToolRegistryEntry {
  name: KonlingToolName;
  permissionTier: KonlingToolPermissionTier;
  approvalPolicy: KonlingToolApprovalPolicy;
  idempotencyPolicy: KonlingToolIdempotencyPolicy;
  redactionPolicy: 'summary-only';
}

export interface KonlingToolRunView {
  id: string;
  agentSessionId: string;
  ownerUserId: string;
  actorUserId: string;
  targetUserId: string;
  toolName: string;
  permissionTier: KonlingToolPermissionTier | string;
  approvalState: KonlingToolApprovalState | string;
  status: KonlingToolRunStatus | string;
  inputSummary: unknown;
  outputSummary: unknown | null;
  errorSummary: unknown | null;
  idempotencyKey: string | null;
  correlationId: string;
  startedAt: string;
  completedAt: string | null;
  latencyMs: number | null;
  reused: boolean;
}

interface KonlingRuntimeInput {
  authenticatedUserId: string;
  authenticatedUserName?: string | null;
  role: string | undefined;
  targetUserId?: string | null;
  classId?: string | null;
  courseId?: string | null;
  pageId?: string | null;
  resourceId?: string | null;
  pathNodeId?: string | null;
  pageContextHint?: Partial<PageContext> | null;
  serverAuthorizedCandidateGraph?: NonNullable<PageContext['candidateGraph']> | null;
  knowledgeWorkspaceHint?: KonlingKnowledgeWorkspaceHint | null;
  teachingAssistantModeId?: string | null;
  teachingAssistantServerModeContext?: KonlingTeachingAssistantServerModeContext | null;
  currentUserQuery?: string | null;
  trustedContentContext?: boolean;
  now?: Date;
  /**
   * Optional server-resolved layered graph payload for Authority/Projection
   * grounding. Client hints alone never authorize teaching resources (#1274).
   */
  layeredGraphPayload?: LayeredGraphPayload | null;
  teachingProjectionClientHints?: KonlingTeachingProjectionClientHints | null;
  teachingProjectionAuthorized?: boolean;
  permittedTeachingScopeIds?: readonly string[] | null;
  requiredAuthorityReleaseId?: string | null;
  requiredProjectionId?: string | null;
  evidenceCutoff?: string | null;
}

interface KonlingMemoryCreateInput {
  userId: string;
  scope?: KonlingRuntimeScope;
  sessionId?: string | null;
  classId?: string | null;
  courseId?: string | null;
  pageId?: string | null;
  resourceId?: string | null;
  pathNodeId?: string | null;
  memoryType: KonlingMemoryType;
  privacyScope?: AdaptiveLearnerStatePrivacyScope;
  summary: string;
  evidenceRefs?: unknown[];
  metadata?: Record<string, unknown>;
  expiresAt?: Date | null;
}

interface KonlingInterventionInput {
  scope: KonlingRuntimeScope;
  studentState: StudentState;
  arenaContext?: ArenaCompanionContext;
  now?: Date;
}

interface KonlingToolRuntimeInput {
  db: KonlingRuntimeDb;
  scope: KonlingRuntimeScope;
  context: KonlingRuntimeContext;
  agentSessionId?: string | null;
  permittedTools?: string[] | null;
  evidenceCutoff?: Date;
  scopedSimulationState?: Partial<SimulationStateStore> | null;
  /**
   * Optional #1112 Canonical RAG shadow context. When omitted (default), Konling
   * production retrieval remains Legacy-only and does not require Crosswalks.
   * When supplied, Legacy production is unchanged and a separate shadow
   * comparison is recorded as diagnostics only.
   */
  canonicalRagShadow?: KonlingCanonicalRagShadowContext | null;
}

const candidateKnowledgeProjectionService = new AuthoritativeKnowledgeProjectionService();

function candidateKnowledgeRole(role: AdaptiveLearnerStateRole): KnowledgeRole {
  if (role === 'student') return 'STUDENT';
  if (role === 'teacher') return 'TEACHER';
  return 'ADMIN';
}

function unwrapCandidateProjection<T>(result: ProjectionResult<T>): {
  projection: T;
  diagnostics: RepositoryDiagnostic[];
} {
  if (result.status === 'available') {
    return {
      projection: result.projection,
      diagnostics: result.diagnostics,
    };
  }
  if (result.status === 'drift') {
    throw new KonlingRuntimeScopeError(409, '候选权威图谱 ReleaseSet 证据发生漂移。');
  }
  throw new KonlingRuntimeScopeError(
    result.reason === 'node-not-found' ? 404 : 409,
    '候选权威图谱数据不可用。',
  );
}

type SimulationDbRun = Record<string, unknown>;
type SimulationDbTrace = Record<string, unknown>;
type SimulationDbTaskSpec = Record<string, unknown>;

type SimulationContextInput = z.infer<typeof simulationContextParameters>;
type RunVirtualSimulationInput = z.infer<typeof runVirtualSimulationParameters>;
type AnalyzeSimulationTraceInput = z.infer<typeof analyzeSimulationTraceParameters>;
type CompareSimulationRunsInput = z.infer<typeof compareSimulationRunsParameters>;
type ProposeControllerPatchInput = z.infer<typeof proposeControllerPatchParameters>;
type ApplyControllerPatchInput = z.infer<typeof applyControllerPatchParameters>;

interface KonlingAgentSessionCreateInput {
  scope: KonlingRuntimeScope;
  konlingSessionId?: string | null;
  phase: string;
  status?: KonlingAgentSessionStatus;
  state?: Record<string, unknown>;
  permittedTools?: KonlingToolName[];
  pendingApproval?: Record<string, unknown> | null;
  expiresAt?: Date | null;
  smartPrepBinding?: KonlingSmartPrepSessionBinding | null;
}

export interface KonlingSmartPrepSessionBinding {
  taskId: string;
  taskRevision: string;
}

interface KonlingAgentSessionResolveInput extends KonlingAgentSessionCreateInput {
  agentSessionId?: string | null;
}

interface KonlingAgentSessionRefInput {
  scope: KonlingRuntimeScope;
  agentSessionId: string;
  konlingSessionId?: string | null;
  phase?: string;
  smartPrepBinding?: KonlingSmartPrepSessionBinding | null;
}

interface KonlingToolRunStartInput {
  scope: KonlingRuntimeScope;
  agentSessionId: string;
  toolName: KonlingToolName;
  input?: unknown;
  idempotencyKey?: string | null;
  correlationId?: string | null;
  preflight?: () => Promise<void>;
}

interface KonlingToolRunCompleteInput {
  scope: KonlingRuntimeScope;
  toolRunId: string;
  output?: unknown;
  now?: Date;
}

interface KonlingToolRunFailInput {
  scope: KonlingRuntimeScope;
  toolRunId: string;
  error?: unknown;
  now?: Date;
}

export interface KonlingRuntimeDb {
  studentProfile?: {
    findFirst?: (args: any) => Promise<unknown | null>;
    findMany?: (args: any) => Promise<unknown[]>;
    count?: (args: any) => Promise<number>;
  };
  class?: {
    findUnique?: (args: any) => Promise<unknown | null>;
  };
  learningPath?: {
    findMany?: (args: any) => Promise<unknown[]>;
    findFirst?: (args: any) => Promise<any | null>;
    upsert?: (args: any) => Promise<any>;
    update?: (args: any) => Promise<any>;
  };
  learningPathIntervention?: {
    findFirst: (args: any) => Promise<any | null>;
    create: (args: any) => Promise<any>;
  };
  konlingMemory?: {
    findMany?: (args: any) => Promise<unknown[]>;
    create?: (args: any) => Promise<unknown>;
  };
  konlingSession?: {
    findFirst?: (args: any) => Promise<unknown | null>;
  };
  agentSession?: {
    create?: (args: any) => Promise<unknown>;
    findFirst?: (args: any) => Promise<unknown | null>;
    updateMany?: (args: any) => Promise<unknown>;
  };
  agentToolRun?: {
    findFirst?: (args: any) => Promise<unknown | null>;
    create?: (args: any) => Promise<unknown>;
    updateMany?: (args: any) => Promise<unknown>;
  };
  simulationTaskSpec?: {
    findFirst?: (args: any) => Promise<unknown | null>;
    create?: (args: any) => Promise<unknown>;
  };
  simulationRun?: {
    findFirst?: (args: any) => Promise<unknown | null>;
    findMany?: (args: any) => Promise<unknown[]>;
    create?: (args: any) => Promise<unknown>;
  };
  simulationTrace?: {
    findFirst?: (args: any) => Promise<unknown | null>;
    create?: (args: any) => Promise<unknown>;
  };
  aIIntervention?: {
    findFirst?: (args: any) => Promise<unknown | null>;
    create?: (args: any) => Promise<unknown>;
    updateMany?: (args: any) => Promise<unknown>;
  };
  knowledgeNode?: {
    findMany?: (args: any) => Promise<unknown[]>;
  };
  knowledgeProgress?: {
    findMany?: (args: any) => Promise<unknown[]>;
  };
  studentCompetencySnapshot?: {
    findFirst?: (args: any) => Promise<unknown | null>;
    findMany?: (args: any) => Promise<unknown[]>;
  };
  studentProfileSummary?: {
    findUnique?: (args: any) => Promise<unknown | null>;
  };
  learningFact?: {
    findMany?: (args: any) => Promise<unknown[]>;
    createMany?: (args: any) => Promise<{ count: number }>;
  };
  learningEvidenceDraft?: {
    createMany?: (args: any) => Promise<{ count: number }>;
  };
  evidenceOutbox?: {
    createMany?: (args: any) => Promise<{ count: number }>;
    findMany?: (args: any) => Promise<any[]>;
  };
  adaptiveMasteryUpdate?: {
    findMany?: (args: any) => Promise<unknown[]>;
  };
  adaptiveAssessmentAbilityEstimate?: {
    findFirst?: (args: any) => Promise<unknown | null>;
  };
  studentRiskFlag?: {
    findMany?: (args: any) => Promise<unknown[]>;
  };
  studentEvidenceFeatureCache?: {
    findUnique?: (args: any) => Promise<unknown | null>;
  };
}

const DEFAULT_TOOLS: KonlingToolName[] = [
  'get_page_context',
  'get_learner_state',
  'get_plan_context',
  'search_learning_memory',
  'search_knowledge_graph',
  'recommend_next_action',
  'get_simulation_status',
  'set_simulation_params',
  'analyze_result',
  'get_simulation_context',
  'run_virtual_simulation',
  'analyze_simulation_trace',
  'compare_simulation_runs',
  'propose_controller_patch',
  'apply_controller_patch',
  'record_intervention_result',
  'analyze_attempt',
];

export const KONLING_CANDIDATE_READ_TOOLS: KonlingToolName[] = [
  'search_candidate_canonical',
  'get_candidate_canonical_detail',
  'get_candidate_canonical_neighbors',
];
const KONLING_CANDIDATE_READ_TOOL_SET = new Set<KonlingToolName>(KONLING_CANDIDATE_READ_TOOLS);

function assertCandidateToolAllowed(scope: KonlingRuntimeScope, toolName: KonlingToolName) {
  if (scope.candidateGraph && !KONLING_CANDIDATE_READ_TOOL_SET.has(toolName)) {
    throw new KonlingRuntimeScopeError(
      403,
      `候选权威图谱上下文拒绝非候选只读工具：${toolName}`,
    );
  }
}

const candidateCanonicalSearchParameters = z.object({
  query: z.string().trim().max(500).default(''),
  limit: z.number().int().min(1).max(20).optional(),
  canonicalType: z.string().trim().min(1).max(120).optional(),
  governance: z.enum(['CORE', 'EXTENSION']).optional(),
});
const candidateCanonicalDetailParameters = z.object({
  canonicalId: z.string().trim().min(1).max(300),
});
const candidateCanonicalNeighborsParameters = z.object({
  canonicalId: z.string().trim().min(1).max(300),
  limit: z.number().int().min(1).max(20).optional(),
  predicate: z.string().trim().min(1).max(160).optional(),
  governance: z.enum(['CORE', 'EXTENSION']).optional(),
});
const teacherDiagnosisStudentParameters = z.object({
  studentId: z.string().trim().min(1).max(200).optional(),
}).strict();
const teacherDiagnosisClassParameters = z.object({}).strict();

function safeRiskEvidenceSummary(value: unknown) {
  const evidence = readRecord(value);
  return {
    ...(typeof evidence.lowProgressNodeCount === 'number'
      ? { lowProgressNodeCount: evidence.lowProgressNodeCount }
      : {}),
    ...(typeof evidence.avgProgress === 'number' ? { averageProgress: evidence.avgProgress } : {}),
    ...(typeof evidence.stuckNodeCount === 'number' ? { stuckNodeCount: evidence.stuckNodeCount } : {}),
    ...(typeof evidence.standardDeviation === 'number' ? { standardDeviation: evidence.standardDeviation } : {}),
    ...(typeof evidence.dimensionCount === 'number' ? { dimensionCount: evidence.dimensionCount } : {}),
    ...(typeof evidence.evidenceCutoff === 'string' ? { evidenceCutoff: evidence.evidenceCutoff } : {}),
  };
}

async function assertTeacherDiagnosisClassScope(
  db: KonlingRuntimeDb,
  scope: KonlingRuntimeScope,
) {
  if (scope.role !== 'teacher' || !scope.classId) {
    throw new KonlingRuntimeScopeError(403, '教师学情诊断工具需要已授权的班级范围。');
  }
  if (!db.class?.findUnique) {
    throw new KonlingRuntimeScopeError(409, '班级授权数据暂不可用。');
  }
  const classRow = await db.class.findUnique({
    where: { id: scope.classId },
    select: { id: true, teacherId: true, isActive: true },
  });
  if (!classRow) throw new KonlingRuntimeScopeError(404, '班级不存在。');
  if (getString(classRow, 'teacherId') !== scope.authenticatedUserId) {
    throw new KonlingRuntimeScopeError(403, '无权读取该班级的学情诊断。');
  }
  if (getValue(classRow, 'isActive') === false) {
    throw new KonlingRuntimeScopeError(409, '班级已停用，不能生成新的学情诊断。');
  }
  return scope.classId;
}

async function resolveTeacherDiagnosisStudentIds(
  db: KonlingRuntimeDb,
  scope: KonlingRuntimeScope,
  requestedStudentId?: string,
) {
  const classId = await assertTeacherDiagnosisClassScope(db, scope);
  if (!db.studentProfile?.findFirst || !db.studentProfile.findMany) {
    throw new KonlingRuntimeScopeError(409, '班级成员数据暂不可用。');
  }

  const scopedStudentId = scope.targetUserId !== scope.authenticatedUserId
    ? scope.targetUserId
    : null;
  if (requestedStudentId && scopedStudentId && requestedStudentId !== scopedStudentId) {
    throw new KonlingRuntimeScopeError(403, '学生诊断会话不能切换到其他学生。');
  }
  const targetStudentId = requestedStudentId ?? scopedStudentId;
  if (targetStudentId) {
    const member = await db.studentProfile.findFirst({
      where: { userId: targetStudentId, classId },
      select: { userId: true },
    });
    if (!member) throw new KonlingRuntimeScopeError(403, '目标学生不属于当前授权班级。');
    return {
      studentIds: [targetStudentId],
      totalMembers: 1,
      truncated: false,
    };
  }

  const members = await db.studentProfile.findMany({
    where: { classId },
    orderBy: { userId: 'asc' },
    take: 501,
    select: { userId: true },
  });
  const studentIds = arrayOfRecords(members)
    .map((member) => getString(member, 'userId'))
    .filter(Boolean);
  const totalMembers = db.studentProfile.count
    ? await db.studentProfile.count({ where: { classId } })
    : studentIds.length;
  return {
    studentIds,
    totalMembers,
    truncated: totalMembers > studentIds.length,
  };
}

async function readTeacherScopedRiskFlags(
  db: KonlingRuntimeDb,
  scope: KonlingRuntimeScope,
  args: z.infer<typeof teacherDiagnosisStudentParameters>,
  evidenceCutoff?: Date,
) {
  const parsed = teacherDiagnosisStudentParameters.parse(args);
  const memberScope = await resolveTeacherDiagnosisStudentIds(db, scope, parsed.studentId);
  const { studentIds } = memberScope;
  if (!db.studentRiskFlag?.findMany) {
    throw new KonlingRuntimeScopeError(409, '学生风险数据暂不可用。');
  }
  if (studentIds.length === 0) {
    return {
      classId: scope.classId,
      students: [],
      sourceCoverage: { classMembers: memberScope.totalMembers, includedStudents: 0 },
      confidence: 'unavailable',
      limitations: memberScope.truncated
        ? ['class-members-truncated-at-500']
        : ['class-has-no-current-members'],
      privacyClass: 'teacher-scoped',
    };
  }

  const rows = arrayOfRecords(await db.studentRiskFlag.findMany({
    where: {
      userId: { in: studentIds },
      isResolved: false,
      flagType: { in: ['constraint', 'stagnation', 'cross_domain'] },
      ...(evidenceCutoff ? { evidenceObservedAt: { lte: evidenceCutoff } } : {}),
    },
    orderBy: { triggeredAt: 'desc' },
    take: 500,
    select: {
      id: true,
      userId: true,
      flagType: true,
      severity: true,
      description: true,
      evidenceJson: true,
      triggeredAt: true,
    },
  }));
  const truncated = rows.length > 500;
  const flags = rows.slice(0, 500).map((row) => ({
    studentId: getString(row, 'userId'),
    type: getString(row, 'flagType'),
    severity: getString(row, 'severity'),
    summary: getString(row, 'description'),
    triggeredAt: toIsoOrNull(getValue(row, 'triggeredAt')),
    evidenceSummary: safeRiskEvidenceSummary(getValue(row, 'evidenceJson')),
    evidenceCutoff: getString(readRecord(getValue(row, 'evidenceJson')), 'evidenceCutoff') || null,
    evidenceRefs: getString(row, 'id') ? [`student-risk-flag:${getString(row, 'id')}`] : [],
  }));
  return {
    classId: scope.classId,
    students: studentIds,
    flags,
    evidenceCutoff: flags.map((flag) => flag.evidenceCutoff).filter(Boolean).sort().at(-1) ?? null,
    evidenceRefs: flags.flatMap((flag) => flag.evidenceRefs),
    sourceCoverage: {
      classMembers: memberScope.totalMembers,
      includedStudents: new Set(flags.map((flag) => flag.studentId).filter(Boolean)).size,
    },
    confidence: rows.length > 0 ? 'medium' : 'unavailable',
    limitations: [
      ...(rows.length > 0 ? [] : ['no-current-governed-risk-flags']),
      ...(memberScope.truncated ? ['class-members-truncated-at-500'] : []),
      ...(truncated ? ['risk-flags-truncated-at-500'] : []),
    ],
    privacyClass: 'teacher-scoped',
  };
}

async function readTeacherScopedClassCompetencySummary(
  db: KonlingRuntimeDb,
  scope: KonlingRuntimeScope,
  evidenceCutoff?: Date,
) {
  const memberScope = await resolveTeacherDiagnosisStudentIds(db, scope);
  const { studentIds } = memberScope;
  if (!db.studentCompetencySnapshot?.findMany) {
    throw new KonlingRuntimeScopeError(409, '班级能力快照暂不可用。');
  }
  const rows = arrayOfRecords(await db.studentCompetencySnapshot.findMany({
    where: {
      userId: { in: studentIds },
      ...(evidenceCutoff ? { snapshotAt: { lte: evidenceCutoff } } : {}),
    },
    orderBy: [{ userId: 'asc' }, { snapshotAt: 'desc' }],
    distinct: ['userId'],
    take: Math.max(studentIds.length, 1),
    select: {
      id: true,
      userId: true,
      snapshotAt: true,
      competencyVector: true,
    },
  }));
  const latestByStudent = new Map<string, Record<string, unknown>>();
  for (const row of rows) {
    const studentId = getString(row, 'userId');
    if (studentId && !latestByStudent.has(studentId)) latestByStudent.set(studentId, row);
  }

  const totals = new Map<string, { sum: number; count: number }>();
  for (const row of latestByStudent.values()) {
    for (const [dimension, value] of Object.entries(readRecord(row.competencyVector))) {
      if (typeof value !== 'number' || !Number.isFinite(value)) continue;
      const current = totals.get(dimension) ?? { sum: 0, count: 0 };
      current.sum += value;
      current.count += 1;
      totals.set(dimension, current);
    }
  }
  const dimensions = Object.fromEntries(
    [...totals.entries()].sort(([left], [right]) => left.localeCompare(right)).map(
      ([dimension, value]) => [
        dimension,
        {
          mean: Math.round((value.sum / value.count) * 100) / 100,
          evidencedMembers: value.count,
          missingMembers: Math.max(memberScope.totalMembers - value.count, 0),
        },
      ],
    ),
  );
  const coverage = memberScope.totalMembers === 0
    ? 0
    : latestByStudent.size / memberScope.totalMembers;
  return {
    classId: scope.classId,
    dimensions,
    evidenceCutoff: [...latestByStudent.values()]
      .map((row) => toIsoOrNull(row.snapshotAt))
      .filter(Boolean)
      .sort()
      .at(-1) ?? null,
    sourceCoverage: {
      classMembers: memberScope.totalMembers,
      includedStudents: latestByStudent.size,
      coverage,
    },
    confidence: coverage >= 0.8 && latestByStudent.size >= 5
      ? 'high'
      : coverage > 0
        ? 'medium'
        : 'unavailable',
    evidenceRefs: [...latestByStudent.values()].flatMap((row) => (
      getString(row, 'id') ? [`student-competency-snapshot:${getString(row, 'id')}`] : []
    )),
    limitations: [
      ...(coverage === 0 ? ['no-current-competency-snapshots'] : []),
      ...(memberScope.truncated ? ['class-members-truncated-at-500'] : []),
    ],
    privacyClass: 'teacher-scoped',
  };
}

async function readTeacherScopedKnowledgeProgress(
  db: KonlingRuntimeDb,
  scope: KonlingRuntimeScope,
  args: z.infer<typeof teacherDiagnosisStudentParameters>,
  evidenceCutoff?: Date,
) {
  const parsed = teacherDiagnosisStudentParameters.parse(args);
  const memberScope = await resolveTeacherDiagnosisStudentIds(db, scope, parsed.studentId);
  const { studentIds } = memberScope;
  if (!db.knowledgeProgress?.findMany) {
    throw new KonlingRuntimeScopeError(409, '知识点进度数据暂不可用。');
  }
  const rows = arrayOfRecords(await db.knowledgeProgress.findMany({
    where: {
      userId: { in: studentIds },
      ...(evidenceCutoff ? { lastVisited: { lte: evidenceCutoff } } : {}),
    },
    orderBy: [{ userId: 'asc' }, { lastVisited: 'desc' }],
    take: 1_001,
    select: {
      id: true,
      userId: true,
      nodeId: true,
      status: true,
      progress: true,
      timeSpent: true,
      lastVisited: true,
    },
  }));
  const truncated = rows.length > 1_000;
  const progress = rows.slice(0, 1_000).map((row) => ({
    studentId: getString(row, 'userId'),
    knowledgeNodeId: getString(row, 'nodeId'),
    status: getString(row, 'status'),
    progress: getNumber(row, 'progress'),
    timeSpentSeconds: getNumber(row, 'timeSpent'),
    lastVisitedAt: toIsoOrNull(getValue(row, 'lastVisited')),
    evidenceRefs: getString(row, 'id') ? [`knowledge-progress:${getString(row, 'id')}`] : [],
  }));
  return {
    classId: scope.classId,
    students: studentIds,
    progress,
    evidenceCutoff: progress.map((item) => item.lastVisitedAt).filter(Boolean).sort().at(-1) ?? null,
    evidenceRefs: progress.flatMap((item) => item.evidenceRefs),
    sourceCoverage: {
      classMembers: memberScope.totalMembers,
      includedStudents: new Set(progress.map((item) => item.studentId).filter(Boolean)).size,
      progressRows: progress.length,
    },
    confidence: progress.length > 0 ? 'medium' : 'unavailable',
    limitations: [
      ...(progress.length > 0 ? [] : ['no-knowledge-progress-evidence']),
      ...(memberScope.truncated ? ['class-members-truncated-at-500'] : []),
      ...(truncated ? ['knowledge-progress-truncated-at-1000'] : []),
    ],
    privacyClass: 'teacher-scoped',
  };
}

export const KONLING_TOOL_PERMISSION_TIERS: KonlingToolPermissionTier[] = ['read', 'analyze', 'run', 'write', 'publish'];

export const KONLING_TOOL_REGISTRY: Record<KonlingToolName, KonlingToolRegistryEntry> = {
  get_page_context: toolRegistryEntry('get_page_context', 'read'),
  search_textbook: toolRegistryEntry('search_textbook', 'read'),
  get_learner_state: toolRegistryEntry('get_learner_state', 'read'),
  get_plan_context: toolRegistryEntry('get_plan_context', 'read'),
  search_learning_memory: toolRegistryEntry('search_learning_memory', 'read'),
  search_knowledge_graph: toolRegistryEntry('search_knowledge_graph', 'read'),
  search_candidate_canonical: toolRegistryEntry('search_candidate_canonical', 'read'),
  get_candidate_canonical_detail: toolRegistryEntry('get_candidate_canonical_detail', 'read'),
  get_candidate_canonical_neighbors: toolRegistryEntry('get_candidate_canonical_neighbors', 'read'),
  recommend_next_action: toolRegistryEntry('recommend_next_action', 'analyze'),
  get_simulation_status: toolRegistryEntry('get_simulation_status', 'read'),
  set_simulation_params: toolRegistryEntry('set_simulation_params', 'write', 'required', 'reuse'),
  analyze_result: toolRegistryEntry('analyze_result', 'analyze'),
  get_simulation_context: toolRegistryEntry('get_simulation_context', 'read'),
  run_virtual_simulation: toolRegistryEntry('run_virtual_simulation', 'run', 'none', 'reuse'),
  analyze_simulation_trace: toolRegistryEntry('analyze_simulation_trace', 'analyze'),
  compare_simulation_runs: toolRegistryEntry('compare_simulation_runs', 'analyze'),
  propose_controller_patch: toolRegistryEntry('propose_controller_patch', 'analyze'),
  apply_controller_patch: toolRegistryEntry('apply_controller_patch', 'write', 'required', 'reuse'),
  record_intervention_result: toolRegistryEntry('record_intervention_result', 'write', 'required', 'reuse'),
  generate_learning_path: toolRegistryEntry('generate_learning_path', 'write', 'none', 'reuse'),
  revise_learning_path_options: toolRegistryEntry('revise_learning_path_options', 'write', 'none', 'reuse'),
  select_learning_path: toolRegistryEntry('select_learning_path', 'write', 'none', 'reuse'),
  reject_learning_path_option: toolRegistryEntry('reject_learning_path_option', 'write', 'none', 'reuse'),
  explain_learning_path_tradeoff: toolRegistryEntry('explain_learning_path_tradeoff', 'analyze', 'none', 'reuse'),
  record_path_adjustment_outcome: toolRegistryEntry('record_path_adjustment_outcome', 'write', 'none', 'reuse'),
  propose_smart_lesson_task_change: toolRegistryEntry('propose_smart_lesson_task_change', 'analyze'),
  calculate: toolRegistryEntry('calculate', 'analyze'),
  analyze_attempt: toolRegistryEntry('analyze_attempt', 'analyze'),
  get_class_assignment_outcomes: toolRegistryEntry('get_class_assignment_outcomes', 'read'),
  get_class_assessment_outcomes: toolRegistryEntry('get_class_assessment_outcomes', 'read'),
  get_student_risk_flags: toolRegistryEntry('get_student_risk_flags', 'read'),
  get_class_competency_summary: toolRegistryEntry('get_class_competency_summary', 'read'),
  get_student_knowledge_progress: toolRegistryEntry('get_student_knowledge_progress', 'read'),
};

const KONLING_IDEMPOTENCY_KEY_PARAMETER = z.string().min(1).max(128).optional();
const KONLING_REQUIRED_IDEMPOTENCY_KEY_PARAMETER = z.string().min(1).max(128);
const KONLING_IDEMPOTENCY_REQUIRED_TOOLS = new Set<KonlingToolName>([
  'run_virtual_simulation',
  'apply_controller_patch',
  'generate_learning_path',
  'revise_learning_path_options',
  'select_learning_path',
  'reject_learning_path_option',
  'explain_learning_path_tradeoff',
  'record_path_adjustment_outcome',
]);

const KONLING_ADAPTIVE_PATH_TOOLS = new Set<KonlingToolName>([
  'generate_learning_path',
  'revise_learning_path_options',
  'select_learning_path',
  'reject_learning_path_option',
  'explain_learning_path_tradeoff',
  'record_path_adjustment_outcome',
]);

const KONLING_ADAPTIVE_PATH_WRITE_TOOLS = new Set<KonlingToolName>([
  'generate_learning_path',
  'revise_learning_path_options',
  'select_learning_path',
  'reject_learning_path_option',
  'record_path_adjustment_outcome',
]);

const KONLING_CLASS_OVERLAY_MAX_LEARNERS = 30;
const KONLING_CLASS_OVERLAY_READ_CONCURRENCY = 4;

const simulationTaskSpecParameters = z.object({
  sceneId: z.string().min(1),
  scenarioId: z.string().min(1),
  objectives: z.array(z.string()).default([]),
  constraints: z.array(z.string()).default([]),
  disturbancePolicy: z.record(z.string(), z.unknown()).default({}),
  evaluationSpecRef: z.object({
    id: z.string().min(1),
    visibility: z.enum(['preview', 'official', 'both']).optional(),
  }),
  allowedControllers: z.array(z.string()).default([]),
  launchContext: z.record(z.string(), z.unknown()).optional(),
});

const simulationContextParameters = z.object({
  simulationRunId: z.string().min(1).optional(),
  taskSpecId: z.string().min(1).optional(),
  includeTrace: z.boolean().optional(),
});

const smartLessonCollectionPatch = z.discriminatedUnion('operation', [
  z.object({
    operation: z.literal('update'),
    id: z.string().min(1).max(200),
    changes: z.record(z.string(), z.unknown()),
  }).strict(),
  z.object({
    operation: z.literal('remove'),
    id: z.string().min(1).max(200),
  }).strict(),
  z.object({
    operation: z.literal('add'),
    item: z.record(z.string(), z.unknown()),
  }).strict(),
]);

function smartLessonTaskChangeParameters(proposedTask: z.ZodTypeAny) {
  return z.object({
    operation: z.enum(['bootstrap', 'revise']).optional(),
    taskId: z.string().min(1).max(200).optional(),
    expectedRevision: z.number().int().min(1).optional(),
    proposedTask: proposedTask.optional(),
    knowledgePointPatches: z.array(smartLessonCollectionPatch).optional(),
    goalPatches: z.array(smartLessonCollectionPatch).optional(),
    clarification: z.object({
      question: z.string().min(1).max(1000),
      alternatives: z.array(z.string().min(1).max(500)).min(2).max(10),
    }).strict().optional(),
  }).strict().refine((value) => Boolean(
    value.proposedTask || value.knowledgePointPatches?.length || value.goalPatches?.length,
  ) !== Boolean(value.clarification), {
    message: '必须且只能提供 proposedTask 或 clarification。',
  }).refine((value) => value.operation === 'bootstrap' || Boolean(value.taskId && value.expectedRevision), {
    message: '修订建议必须绑定任务及其预期修订号。',
  }).superRefine((value, context) => {
    const hasPatches = Boolean(value.knowledgePointPatches?.length || value.goalPatches?.length);
    if (value.clarification && hasPatches) {
      context.addIssue({ code: 'custom', message: '澄清请求不能携带任务集合补丁。' });
    }
    if (value.operation === 'bootstrap' && hasPatches) {
      context.addIssue({ code: 'custom', message: '新建任务必须提交完整 knowledgePoints 和 goals。' });
    }
  });
}

const proposeSmartLessonTaskChangeParameters = smartLessonTaskChangeParameters(z.record(z.string(), z.unknown()));
const proposedSmartLessonRevisionParameters = z.object({
  topic: z.string().min(1).max(500).optional(),
  audience: z.string().min(1).max(1000).optional(),
  prerequisites: z.string().max(5000).optional(),
  durationMinutes: z.number().int().min(30).max(120).optional(),
  outlineConfirmationRequired: z.boolean().optional(),
  confirmScope: z.boolean().optional(),
  confirmGoals: z.boolean().optional(),
}).strict();

const smartLessonToolCollectionPatch = z.discriminatedUnion('operation', [
  z.object({
    operation: z.literal('update'),
    id: z.string().min(1).max(200),
    changes: z.object({
      content: z.string().min(1).max(2000).optional(),
      title: z.string().min(1).max(500).optional(),
      sourceState: z.enum(['verified', 'ai_generated_source_pending', 'teacher_created_source_pending']).optional(),
      origin: z.enum(['SUGGESTED', 'TEACHER_CREATED', 'ai_generated']).optional(),
    }).strict(),
  }).strict(),
  z.object({
    operation: z.literal('remove'),
    id: z.string().min(1).max(200),
  }).strict(),
  z.object({
    operation: z.literal('add'),
    item: z.object({
      content: z.string().min(1).max(2000),
      sourceState: z.enum(['verified', 'ai_generated_source_pending', 'teacher_created_source_pending']),
      sourceBindings: z.array(z.unknown()).max(100),
      title: z.string().min(1).max(500).optional(),
      origin: z.enum(['SUGGESTED', 'TEACHER_CREATED', 'ai_generated']).optional(),
    }).strict(),
  }).strict(),
]);

// This schema is emitted to the provider. It distinguishes a complete
// bootstrap task from a revision, so a revision cannot be expressed with
// lesson-plan-only fields or by retransmitting the task collections.
const proposeSmartLessonTaskChangeToolParameters = z.discriminatedUnion('operation', [
  z.object({
    operation: z.literal('bootstrap'),
    proposedTask: createTaskSchema.optional(),
    clarification: z.object({
      question: z.string().min(1).max(1000),
      alternatives: z.array(z.string().min(1).max(500)).min(2).max(10),
    }).strict().optional(),
  }).strict(),
  z.object({
    operation: z.literal('revise'),
    taskId: z.string().min(1).max(200),
    expectedRevision: z.number().int().min(1),
    proposedTask: proposedSmartLessonRevisionParameters.optional(),
    knowledgePointPatches: z.array(smartLessonToolCollectionPatch).optional(),
    goalPatches: z.array(smartLessonToolCollectionPatch).optional(),
    clarification: z.object({
      question: z.string().min(1).max(1000),
      alternatives: z.array(z.string().min(1).max(500)).min(2).max(10),
    }).strict().optional(),
  }).strict(),
]);

const runVirtualSimulationParameters = z.object({
  idempotencyKey: KONLING_REQUIRED_IDEMPOTENCY_KEY_PARAMETER,
  taskSpec: simulationTaskSpecParameters,
  controllerSnapshotRef: z.string().min(1).optional(),
  seed: z.number().int().nonnegative().optional(),
  summaryMetrics: z.record(z.string(), z.unknown()).optional(),
  trace: z.object({
    checksum: z.string().min(1).optional(),
    sampleCount: z.number().int().nonnegative().optional(),
    sampleCadence: z.number().nonnegative().optional(),
    sampleStorageUri: z.string().min(1).optional(),
    summaryMetrics: z.record(z.string(), z.unknown()).optional(),
  }).optional(),
});

const analyzeSimulationTraceParameters = z.object({
  simulationRunId: z.string().min(1),
  traceId: z.string().min(1).optional(),
});

const compareSimulationRunsParameters = z.object({
  simulationRunIds: z.array(z.string().min(1)).min(2).max(6),
});

const controllerPatchParameters = z.record(z.string(), z.unknown());

const proposeControllerPatchParameters = z.object({
  simulationRunId: z.string().min(1),
  objective: z.string().min(1).optional(),
  targetMetrics: z.record(z.string(), z.unknown()).optional(),
  constraints: z.array(z.string()).optional(),
});

const applyControllerPatchParameters = z.object({
  idempotencyKey: KONLING_REQUIRED_IDEMPOTENCY_KEY_PARAMETER,
  simulationRunId: z.string().min(1),
  patch: controllerPatchParameters,
  rationale: z.string().min(1).optional(),
});

const calculateToolParameters = z.object({
  expression: z.string().min(1).max(300),
  operation: z.enum(MATH_CALC_OPERATIONS).optional(),
});

const adaptivePathToolBaseParameters = z.object({
  idempotencyKey: KONLING_REQUIRED_IDEMPOTENCY_KEY_PARAMETER,
  goalId: z.string().min(1).optional(),
  pathId: z.string().min(1).optional(),
  graphNodeId: z.string().min(1).optional(),
  routeIntent: z.string().min(1).optional(),
  naturalLanguageIntent: z.string().max(500).optional(),
});

const generateLearningPathParameters = adaptivePathToolBaseParameters.extend({
  timeBudgetMinutes: z.number().int().min(5).max(240).optional(),
  difficultyRhythm: z.enum(['gentle', 'steady', 'challenge']).optional(),
  resourcePreference: z.array(z.string().min(1)).max(8).optional(),
  checkpointPreference: z.enum(['light', 'standard', 'dense']).optional(),
  allowExternalResources: z.boolean().optional(),
  excludedNodeIds: z.array(z.string().min(1)).max(24).optional(),
  preferredStyleId: z.string().min(1).optional(),
  requestedAt: z.string().datetime().optional(),
});

const reviseLearningPathOptionsParameters = generateLearningPathParameters.extend({
  priorRequestId: z.string().min(1).optional(),
  rejectedStyleIds: z.array(z.string().min(1)).max(8).optional(),
  selectedStyleId: z.string().min(1).optional(),
  sourceBatchId: z.string().min(1),
  sourceCandidateId: z.string().min(1),
  sourceCandidateFingerprint: z.string().regex(/^[a-f0-9]{64}$/),
  activeProgressVersion: z.string().min(1),
});

const selectLearningPathParameters = adaptivePathToolBaseParameters.extend({
  batchId: z.string().min(1),
  candidateId: z.string().min(1).optional(),
});

const rejectLearningPathOptionParameters = adaptivePathToolBaseParameters.extend({
  rejectedStyleId: z.string().min(1),
  reason: z.string().max(240).optional(),
});

const explainLearningPathTradeoffParameters = adaptivePathToolBaseParameters.extend({
  styleId: z.string().min(1).optional(),
  compareWithStyleId: z.string().min(1).optional(),
  candidateBatchId: z.string().min(1).optional(),
  comparisonKey: z.string().min(1).optional(),
});

const recordPathAdjustmentOutcomeParameters = adaptivePathToolBaseParameters.extend({
  outcome: z.enum(['adopted', 'ignored', 'helpful', 'not-helpful', 'switched']),
  selectedStyleId: z.string().min(1).optional(),
  rejectedStyleIds: z.array(z.string().min(1)).max(8).optional(),
});

async function resolveServerCandidateGraphContext(
  claim: NonNullable<PageContext['candidateGraph']>,
  role: KnowledgeRole | null,
): Promise<NonNullable<PageContext['candidateGraph']> | null> {
  if (!role) return null;
  const result = await candidateKnowledgeProjectionService.canvas(
    CANDIDATE_RELEASE_SELECTOR,
    CANDIDATE_GRAPH_SUPPORT,
  );
  if (result.status !== 'available') return null;
  const selectedCanonicalId = typeof claim.selectedCanonicalId === 'string'
    && result.projection.nodes.some((node) => node.id === claim.selectedCanonicalId)
    ? claim.selectedCanonicalId
    : null;
  const selectedNode = selectedCanonicalId
    ? result.projection.nodes.find((node) => node.id === selectedCanonicalId) ?? null
    : null;
  const actualCanonicalTypes = new Set(
    result.projection.nodes.map((node) => node.canonicalType),
  );
  const canonicalTypeFilter = typeof claim.canonicalTypeFilter === 'string'
    && actualCanonicalTypes.has(claim.canonicalTypeFilter)
    ? claim.canonicalTypeFilter
    : null;
  // 聚合身份、release tier、投影摘要与精确关系一律由服务端按投影重算；
  // 客户端声明的对应字段一律丢弃，不作合并。
  const selectedRelations = selectedCanonicalId
    ? result.projection.relations
        .filter((relation) => (
          relation.sourceId === selectedCanonicalId || relation.targetId === selectedCanonicalId
        ))
        .slice(0, 12)
        .map((relation) => ({
          relationId: relation.id,
          predicate: relation.predicate,
          direction: relation.direction,
          relationFamily: relation.relationFamily ?? null,
          evidenceState: relation.evidenceState ?? null,
          releaseTier: relation.releaseTier ?? null,
          traversal: (relation.sourceId === selectedCanonicalId
            ? 'outgoing'
            : 'incoming') as 'outgoing' | 'incoming',
          neighborId: relation.sourceId === selectedCanonicalId
            ? relation.targetId
            : relation.sourceId,
        }))
    : [];
  return {
    ...CANDIDATE_RELEASE_SELECTOR,
    selectedCanonicalId,
    selectedCanonicalType: selectedNode?.canonicalType ?? null,
    governanceFilter: claim.governanceFilter === 'CORE' ? 'CORE' : 'EXTENSION',
    canonicalTypeFilter,
    coverageStatus: result.projection.nodes.length === 0 ? 'empty' : 'ready',
    objectCount: result.projection.coverage.objectCount,
    relationCount: result.projection.coverage.relationCount,
    projectionDigest: result.projection.source.projectionDigest ?? null,
    sourceDatasetHash: result.projection.source.sourceDatasetHash ?? null,
    releaseTier: selectedNode?.releaseTier ?? null,
    selectedRelations,
    teachingSemanticsAvailability: 'unavailable',
  };
}

export async function verifyKonlingRuntimeScope(
  db: KonlingRuntimeDb,
  input: KonlingRuntimeInput,
): Promise<{ ok: true; scope: KonlingRuntimeScope } | { ok: false; status: 400 | 403 | 404; error: string }> {
  const role = normalizeKonlingRole(input.role);
  const targetUserId = input.targetUserId || input.authenticatedUserId;
  const courseId = input.courseId || input.pageContextHint?.courseId || 'unknown-course';
  const pageId = input.pageId || input.pageContextHint?.stepId || 'unknown-page';
  const candidateClaim = input.pageContextHint?.candidateGraph;
  const candidateRole = role === 'student'
    ? 'STUDENT'
    : role === 'teacher'
      ? 'TEACHER'
      : role === 'admin'
        ? 'ADMIN'
        : null;
  const candidateAccess = resolveCandidateGraphAccess(
    candidateRole,
    isCandidateGraphPubliclyActivated(),
  );
  const candidateGraph = input.serverAuthorizedCandidateGraph
    ?? (candidateClaim
      && pageId === '/knowledge'
      && candidateClaim.authorityState === CANDIDATE_RELEASE_SELECTOR.authorityState
      && candidateClaim.releaseSetId === CANDIDATE_RELEASE_SELECTOR.releaseSetId
      && candidateClaim.releaseId === CANDIDATE_RELEASE_SELECTOR.releaseId
      && candidateAccess.allowed
      ? await resolveServerCandidateGraphContext(candidateClaim, candidateRole)
      : null);
  if (candidateClaim && !candidateGraph) {
    return { ok: false, status: 403, error: '候选权威图谱上下文未获服务端授权。' };
  }
  if (
    input.serverAuthorizedCandidateGraph
    && (
      pageId !== '/knowledge'
      || input.serverAuthorizedCandidateGraph.releaseSetId !== CANDIDATE_RELEASE_SELECTOR.releaseSetId
      || input.serverAuthorizedCandidateGraph.releaseId !== CANDIDATE_RELEASE_SELECTOR.releaseId
    )
  ) {
    return { ok: false, status: 403, error: '服务端候选权威图谱上下文无效。' };
  }

  if (role === 'student' && targetUserId !== input.authenticatedUserId) {
    return { ok: false, status: 403, error: '学生只能访问自己的 Konling 运行时上下文。' };
  }

  if (role === 'student' && input.classId) {
    const studentProfile = await db.studentProfile?.findFirst?.({
      where: { userId: targetUserId, classId: input.classId },
      select: { userId: true, classId: true },
    });
    if (!studentProfile) return { ok: false, status: 404, error: '学生不在该班级中。' };
  }

  if (role === 'teacher' && input.classId) {
    const classData = await db.class?.findUnique?.({
      where: { id: input.classId },
      select: { id: true, teacherId: true },
    });
    if (!classData) return { ok: false, status: 404, error: '班级不存在。' };
    if (getString(classData, 'teacherId') !== input.authenticatedUserId) {
      return { ok: false, status: 403, error: '无权访问该班级的 Konling 运行时。' };
    }
  }

  if (role === 'teacher' && targetUserId !== input.authenticatedUserId) {
    if (!input.classId) {
      return { ok: false, status: 400, error: '教师访问学生 Konling 运行时必须提供 classId。' };
    }

    const studentProfile = await db.studentProfile?.findFirst?.({
      where: { userId: targetUserId, classId: input.classId },
      select: { userId: true, classId: true },
    });
    if (!studentProfile) return { ok: false, status: 404, error: '学生不在该班级中。' };
  }

  return {
    ok: true,
    scope: {
      authenticatedUserId: input.authenticatedUserId,
      targetUserId,
      role,
      classId: input.classId ?? null,
      courseId,
      pageId,
      resourceId: input.resourceId ?? null,
      pathNodeId: input.pathNodeId ?? null,
      privacyScopes: privacyScopesForRole(role),
      candidateGraph,
    },
  };
}

function resolveAdaptiveLearnerStateGoal(...candidates: Array<string | null | undefined>): string | null {
  for (const candidate of candidates) {
    if (!candidate) continue;
    if (getRegisteredAdaptiveLearningPathGoal(candidate)) {
      return candidate;
    }
    const mapped = resolvePersonalizationGoalContext({ courseId: candidate });
    if (mapped.status === 'resolved') {
      return mapped.context.goalId;
    }
  }
  return null;
}

function hasGraphCenterLearnerOverlayShape(state: AdaptiveLearnerState | null): state is AdaptiveLearnerState {
  if (!state || typeof state !== 'object') return false;
  const knowledgeMastery = (state as { knowledgeMastery?: unknown }).knowledgeMastery;
  return Boolean(
    knowledgeMastery
    && typeof knowledgeMastery === 'object'
    && (knowledgeMastery as { tags?: unknown }).tags
    && typeof (knowledgeMastery as { tags?: unknown }).tags === 'object'
  );
}

async function buildKonlingRuntimeClassOverlayInput(
  db: KonlingRuntimeDb,
  input: {
    scope: KonlingRuntimeScope;
    learnerStateGoal: string | null;
    pageContextHint?: Partial<PageContext> | null;
    now?: Date;
  },
): Promise<GraphCenterClassOverlayInput | null> {
  if (
    input.scope.role !== 'teacher'
    || !input.scope.classId
    || !db.studentProfile?.findMany
    || !shouldBuildKonlingRuntimeClassOverlay(input.scope, input.pageContextHint)
  ) {
    return null;
  }

  const studentProfiles = await db.studentProfile.findMany({
    where: { classId: input.scope.classId },
    select: { userId: true },
    orderBy: { userId: 'asc' },
  }).catch(() => null);
  if (!studentProfiles) return null;

  const sampledProfiles = studentProfiles.slice(0, KONLING_CLASS_OVERLAY_MAX_LEARNERS);
  const learnerStates = await mapWithConcurrency(sampledProfiles, KONLING_CLASS_OVERLAY_READ_CONCURRENCY, async (student) => {
    const userId = getString(student, 'userId');
    if (!userId) return null;
    return readLearnerState({
      userId,
      role: input.scope.role,
      classId: input.scope.classId,
      goal: input.learnerStateGoal,
      portraitConsumer: 'konling',
      clientHints: input.pageContextHint ? { pageContext: input.pageContextHint } : undefined,
      now: input.now,
    }).catch(() => null);
  });
  const usableLearnerStates = learnerStates.filter(hasGraphCenterLearnerOverlayShape);

  return {
    classId: input.scope.classId,
    viewerRole: input.scope.role,
    authorized: true,
    learnerStates: usableLearnerStates,
    excludedPopulation: Math.max(studentProfiles.length - usableLearnerStates.length, 0),
  };
}

function shouldBuildKonlingRuntimeClassOverlay(
  scope: KonlingRuntimeScope,
  pageContextHint?: Partial<PageContext> | null,
): boolean {
  const markers = [
    scope.pageId,
    pageContextHint?.stepId,
    pageContextHint?.pageType,
  ]
    .filter((value): value is string => typeof value === 'string' && value.length > 0)
    .map((value) => value.toLowerCase());
  return markers.some((value) =>
    value.includes('class-report')
    || value.includes('prep-pack')
    || value.includes('teacher-class-report')
    || value.includes('teacher-prep-pack')
  );
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let nextIndex = 0;
  const workerCount = Math.min(Math.max(1, concurrency), items.length);
  await Promise.all(Array.from({ length: workerCount }, async () => {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await mapper(items[index], index);
    }
  }));
  return results;
}

export async function buildKonlingRuntimeContext(
  db: KonlingRuntimeDb,
  input: KonlingRuntimeInput,
): Promise<KonlingRuntimeContext> {
  const scopeResult = await verifyKonlingRuntimeScope(db, input);
  if (!scopeResult.ok) {
    throw new KonlingRuntimeScopeError(scopeResult.status, scopeResult.error);
  }

  const scope = scopeResult.scope;
  if (scope.candidateGraph) {
    const pageContext = buildServerOwnedPageContext(scope);
    const userProfile = buildServerOwnedUserProfile({
      userId: scope.targetUserId,
      name: input.authenticatedUserName || '同学',
      learnerState: null,
    });
    const planContext: KonlingPlanContext = {
      currentPathId: null,
      activeNodeId: null,
      nextNodeIds: [],
      recentPathIds: [],
      completedNodeIds: [],
      status: 'missing',
    };
    const citationContext: KonlingCitationContext = {
      required: true,
      contentCitations: [],
      evidenceCitations: [],
      sourcePacks: [],
      missingCitationClasses: ['content'],
      lowConfidenceReasons: ['candidate-tool-citation-required'],
      responseProtocol: {
        requiredOwners: ['answer'],
        minimum: { content: 1, evidenceWhenAvailable: 0 },
        fallbackWhenMissing: 'low-confidence',
      },
    };
    const baseRuntimeContext: KonlingRuntimeContext = {
      pageContext,
      userProfile,
      learnerState: null,
      planContext,
      memory: [],
      knowledgeWorkspace: null,
      graphContext: null,
      citationContext,
      permittedTools: KONLING_CANDIDATE_READ_TOOLS,
      missingContext: [],
      featureFlags: {
        learnerState: false,
        semanticMemory: false,
        strategyMemory: false,
      },
    };
    const knowledgeCapabilityContext = buildKonlingKnowledgeCapabilityContext({
      runtimeContext: baseRuntimeContext,
      scope,
      answerIntent: classifyKonlingAnswerIntent(
        resolveKonlingTeachingAssistantMode(input.teachingAssistantModeId),
        baseRuntimeContext,
        scope,
        input.teachingAssistantServerModeContext,
        input.currentUserQuery,
      ),
      modeId: normalizeKonlingTeachingAssistantModeId(input.teachingAssistantModeId) ?? 'generic-chat',
    });
    return {
      ...baseRuntimeContext,
      knowledgeCapabilityContext,
      sarAssociatedGrounding: null,
    };
  }
  const learnerStateEnabled = isAdaptiveLearnerStateServiceEnabled();
  const learnerStateGoal = resolveAdaptiveLearnerStateGoal(scope.courseId, input.pageContextHint?.courseId);
  const learnerState = learnerStateEnabled
    ? await readLearnerState({
        userId: scope.targetUserId,
        role: scope.role,
        classId: scope.classId,
        goal: learnerStateGoal,
        portraitConsumer: 'konling',
        clientHints: input.pageContextHint ? { pageContext: input.pageContextHint } : undefined,
        now: input.now,
      }).catch(() => null)
    : null;

  const [planContext, memory, knowledgeWorkspace, classOverlayInput] = await Promise.all([
    readPlanContext(db, scope),
    searchKonlingMemory(db, {
      scope,
      query: '',
      limit: 6,
    }),
    buildKnowledgeWorkspaceContext(db, scope, input.knowledgeWorkspaceHint),
    learnerStateEnabled
      ? buildKonlingRuntimeClassOverlayInput(db, {
          scope,
          learnerStateGoal,
          pageContextHint: input.pageContextHint,
          now: input.now,
        })
      : Promise.resolve(null),
  ]);
  const pageContext = buildServerOwnedPageContext(scope);
  const userProfile = buildServerOwnedUserProfile({
    userId: scope.targetUserId,
    name: input.authenticatedUserName || '同学',
    learnerState,
  });
  const textbookRetrievalContext = Object.freeze({
    externalQuery: buildServerOwnedTextbookRetrievalQuery({
      pageContext,
    }),
  });
  const citationMode = resolveKonlingTeachingAssistantMode(input.teachingAssistantModeId);
  const registeredPageContext = getStepAIContext(scope.courseId, scope.pageId);
  const permitsTextbookRetrieval = Boolean(registeredPageContext)
    && citationMode.supportedRoles.includes(scope.role)
    && citationMode.citationClasses.includes('content');
  const modeSpecificTools: KonlingToolName[] = citationMode.id === 'prep-coauthor'
    ? ['propose_smart_lesson_task_change']
    : citationMode.id === 'teacher-diagnosis'
      ? [
          'get_class_assignment_outcomes',
          'get_class_assessment_outcomes',
          'get_student_risk_flags',
          'get_class_competency_summary',
          'get_student_knowledge_progress',
        ]
      : [];
  const runtimePermittedTools: KonlingToolName[] = [
    ...DEFAULT_TOOLS,
    ...(permitsTextbookRetrieval ? ['search_textbook' as const] : []),
    ...modeSpecificTools,
  ];
  const preCitationRuntimeContext: KonlingRuntimeContext = {
    pageContext,
    userProfile,
    learnerState,
    textbookRetrievalContext,
    planContext,
    memory,
    knowledgeWorkspace,
    citationContext: undefined,
    permittedTools: runtimePermittedTools,
    missingContext: [],
    featureFlags: {
      learnerState: learnerStateEnabled,
      semanticMemory: process.env.KONLING_SEMANTIC_MEMORY_ENABLED === 'true',
      strategyMemory: process.env.KONLING_STRATEGY_MEMORY_ENABLED === 'true',
    },
  };
  const citationAnswerIntent = classifyKonlingAnswerIntent(
    citationMode,
    preCitationRuntimeContext,
    scope,
    input.teachingAssistantServerModeContext,
    input.currentUserQuery,
  );
  const preCitationGroundingContext = buildKonlingKnowledgeCapabilityContext({
    runtimeContext: preCitationRuntimeContext,
    scope,
    answerIntent: citationAnswerIntent,
    modeId: citationMode.id,
  });
  const citationContext = await buildKonlingCitationContext(db, {
    scope,
    pageContext,
    learnerState,
    planContext,
    memory,
    knowledgeWorkspace,
    sarAssociatedGrounding: preCitationGroundingContext.sarAssociatedGrounding,
    currentUserQuery: input.currentUserQuery,
    trustedContentContext: input.trustedContentContext === true,
  });
  const baseRuntimeContext: KonlingRuntimeContext = {
    pageContext,
    userProfile,
    learnerState,
    textbookRetrievalContext,
    planContext,
    memory,
    knowledgeWorkspace,
    sarAssociatedGrounding: preCitationGroundingContext.sarAssociatedGrounding,
    citationContext,
    permittedTools: runtimePermittedTools,
    missingContext: [],
    featureFlags: {
      learnerState: learnerStateEnabled,
      semanticMemory: process.env.KONLING_SEMANTIC_MEMORY_ENABLED === 'true',
      strategyMemory: process.env.KONLING_STRATEGY_MEMORY_ENABLED === 'true',
    },
  };
  const teachingProjectionBinding = resolveKonlingTeachingProjectionBinding({
    courseId: scope.courseId,
    pageId: scope.pageId,
    resourceId: scope.resourceId,
    layeredGraphPayload: input.layeredGraphPayload,
    authorized: input.teachingProjectionAuthorized,
    pinnedProjectionId: input.requiredProjectionId ?? null,
  });
  const teachingProjectionClientHints =
    input.teachingProjectionClientHints
    ?? extractKonlingTeachingProjectionClientHints(input.pageContextHint)
    ?? extractKonlingTeachingProjectionClientHints(
      input.teachingAssistantServerModeContext,
    );
  const teachingProjectionContext = resolveKonlingTeachingProjectionContext({
    payload: teachingProjectionBinding.payload,
    focusCanonicalIds: knowledgeWorkspace?.selected_node?.id
      ? [knowledgeWorkspace.selected_node.id]
      : teachingProjectionClientHints?.canonicalIds
        ?? teachingProjectionClientHints?.signedCanonicalIds
        ?? null,
    clientHints: teachingProjectionClientHints,
    authorized: teachingProjectionBinding.authorized,
    permittedScopeIds:
      input.permittedTeachingScopeIds
      ?? teachingProjectionBinding.permittedScopeIds,
    requiredAuthorityReleaseId: input.requiredAuthorityReleaseId,
    requiredProjectionId: input.requiredProjectionId,
    evidenceCutoff: input.evidenceCutoff,
  });
  const graphContext = buildKonlingRuntimeGraphContext({
    scope,
    runtimeContext: baseRuntimeContext,
    classOverlayInput,
    clientHints: input.pageContextHint ? { pageContext: input.pageContextHint } : null,
    layeredGraphPayload: teachingProjectionBinding.payload,
    teachingProjectionClientHints,
    teachingProjectionAuthorized: teachingProjectionBinding.authorized,
    permittedTeachingScopeIds:
      input.permittedTeachingScopeIds
      ?? teachingProjectionBinding.permittedScopeIds,
    requiredAuthorityReleaseId: input.requiredAuthorityReleaseId,
    requiredProjectionId: input.requiredProjectionId,
    evidenceCutoff: input.evidenceCutoff,
    teachingProjectionContext,
  });
  baseRuntimeContext.graphContext = graphContext;
  baseRuntimeContext.teachingProjectionContext = teachingProjectionContext;
  const knowledgeCapabilityContext = buildKonlingKnowledgeCapabilityContext({
    runtimeContext: baseRuntimeContext,
    scope,
    answerIntent: classifyKonlingAnswerIntent(
      citationMode,
      baseRuntimeContext,
      scope,
      input.teachingAssistantServerModeContext,
    ),
    modeId: citationMode.id,
  });

  return {
    pageContext,
    userProfile,
    learnerState,
    textbookRetrievalContext,
    planContext,
    memory,
    knowledgeWorkspace,
    knowledgeCapabilityContext,
    sarAssociatedGrounding: knowledgeCapabilityContext.sarAssociatedGrounding,
    graphContext,
    teachingProjectionContext,
    citationContext,
    permittedTools: runtimePermittedTools,
    missingContext: buildMissingContext({ learnerStateEnabled, learnerState, planContext, memory, citationContext, pageContext, knowledgeWorkspace, graphContext }),
    featureFlags: {
      learnerState: learnerStateEnabled,
      semanticMemory: process.env.KONLING_SEMANTIC_MEMORY_ENABLED === 'true',
      strategyMemory: process.env.KONLING_STRATEGY_MEMORY_ENABLED === 'true',
    },
  };
}

export function buildKonlingRuntimeGraphContext(input: {
  scope: KonlingRuntimeScope;
  runtimeContext: KonlingRuntimeContext;
  classOverlayInput?: GraphCenterClassOverlayInput | null;
  clientHints?: Record<string, unknown> | null;
  layeredGraphPayload?: LayeredGraphPayload | null;
  teachingProjectionClientHints?: KonlingTeachingProjectionClientHints | null;
  teachingProjectionAuthorized?: boolean;
  permittedTeachingScopeIds?: readonly string[] | null;
  requiredAuthorityReleaseId?: string | null;
  requiredProjectionId?: string | null;
  evidenceCutoff?: string | null;
  teachingProjectionContext?: KonlingTeachingProjectionContext | null;
}): KonlingKaqGraphContext {
  return buildKonlingKaqGraphContext({
    scope: input.scope,
    learningGoalId: resolveKonlingGraphContextLearningGoalId(input.scope.courseId),
    selectedGraphNodeIds: input.runtimeContext.knowledgeWorkspace?.selected_node?.id
      ? [input.runtimeContext.knowledgeWorkspace.selected_node.id]
      : [],
    learnerOverlayInput: hasGraphCenterLearnerOverlayShape(input.runtimeContext.learnerState)
      ? {
          state: input.runtimeContext.learnerState,
          requestedLearnerId: input.scope.targetUserId,
          viewerRole: input.scope.role,
          authorized: true,
        }
      : null,
    classOverlayInput: input.classOverlayInput ?? null,
    planContext: input.runtimeContext.planContext,
    citationContext: input.runtimeContext.citationContext,
    clientHints: input.clientHints,
    layeredGraphPayload: input.layeredGraphPayload,
    teachingProjectionClientHints: input.teachingProjectionClientHints,
    teachingProjectionAuthorized: input.teachingProjectionAuthorized,
    permittedTeachingScopeIds: input.permittedTeachingScopeIds,
    requiredAuthorityReleaseId: input.requiredAuthorityReleaseId,
    requiredProjectionId: input.requiredProjectionId,
    evidenceCutoff: input.evidenceCutoff,
    teachingProjectionContext: input.teachingProjectionContext,
  });
}

/**
 * Bounded teaching-projection grounding lines for tools/prompts (#1274).
 * Does not expose store paths, writer APIs, or engineering predicates as
 * teaching prerequisites.
 */
export function buildKonlingTeachingProjectionToolGrounding(
  context: KonlingRuntimeContext | null | undefined,
): string[] {
  return buildKonlingTeachingProjectionGroundingLines(
    context?.teachingProjectionContext
      ?? context?.graphContext?.teachingProjectionContext
      ?? null,
  );
}

/**
 * Dual-domain answer provenance retained through assembly (#1274).
 */
export function buildKonlingDualDomainAnswerProvenance(
  context: KonlingRuntimeContext | null | undefined,
): {
  teaching: ReturnType<typeof projectKonlingTeachingProjectionAnswerProvenance>;
  engineeringAuthorityReleaseId: string | null;
  relationWriteback: false;
} {
  const teaching =
    context?.teachingProjectionContext
    ?? context?.graphContext?.teachingProjectionContext
    ?? null;
  return {
    teaching: projectKonlingTeachingProjectionAnswerProvenance(teaching),
    engineeringAuthorityReleaseId: teaching?.authorityReleaseId ?? null,
    relationWriteback: false,
  };
}

export interface KonlingDualDomainProvenanceMetadataPayload {
  source: 'teaching-projection-dual-domain';
  relationWriteback: false;
  engineeringAuthorityReleaseId: string | null;
  teaching: ReturnType<typeof projectKonlingTeachingProjectionAnswerProvenance>;
  groundingLines: string[];
}

/**
 * Metadata retained in answer assembly / streaming for dual-domain provenance.
 */
export function buildKonlingDualDomainProvenanceMetadataPayload(
  context: KonlingRuntimeContext | null | undefined,
): KonlingDualDomainProvenanceMetadataPayload | null {
  const teaching =
    context?.teachingProjectionContext
    ?? context?.graphContext?.teachingProjectionContext
    ?? null;
  if (!teaching) return null;
  const provenance = buildKonlingDualDomainAnswerProvenance(context);
  return {
    source: 'teaching-projection-dual-domain',
    relationWriteback: false,
    engineeringAuthorityReleaseId: provenance.engineeringAuthorityReleaseId,
    teaching: provenance.teaching,
    groundingLines: buildKonlingTeachingProjectionGroundingLines(teaching),
  };
}

export function buildKonlingToolRuntime(input: KonlingToolRuntimeInput) {
  const citationAllocator = createKonlingCitationAllocator([
    ...(input.context.citationContext?.contentCitations ?? []),
    ...(input.context.citationContext?.evidenceCitations ?? []),
  ].map(toAssignableRuntimeCitation));
  const textbookOptimizations = new Map<string, {
    toolCallId: string;
    foreground: TextbookV2ToolResult;
    continuation: Promise<TextbookV2OptimizationResult>;
  }>();
  const assignTextbookCitations = (result: TextbookV2ToolResult): TextbookV2ToolResult => ({
    ...result,
    candidates: result.candidates.map((candidate) => ({
      ...candidate,
      displayNumber: citationAllocator.assign({
        id: candidate.identity.fragmentId ?? candidate.identity.unitId,
        sourceType: 'textbook',
        displayTitle: candidate.title,
        href: candidate.href,
        // 无锚点地址的教材候选不可核验，不得作为已核验引用（#1949）
        verifiable: Boolean(candidate.href),
        confidence: 'high',
        evidenceBasis: 'source-pack:textbook-v2',
        limitation: candidate.limitation,
        identity: {
          kind: 'textbook',
          bookId: candidate.identity.bookId,
          edition: candidate.identity.edition,
          sourceRevision: candidate.identity.sourceRevision,
          unitId: candidate.identity.unitId,
          fragmentId: candidate.identity.fragmentId,
        },
      }).displayNumber,
    })),
  });
  const assignCandidateCitation = (canonicalId: string, displayTitle: string) => (
    citationAllocator.assign({
      id: `candidate:${CANDIDATE_RELEASE_SELECTOR.releaseSetId}:${CANDIDATE_RELEASE_SELECTOR.releaseId}:${canonicalId}`,
      sourceType: 'content',
      displayTitle,
      href: `/knowledge?canonicalId=${encodeURIComponent(canonicalId)}`,
      confidence: 'high',
      evidenceBasis: `candidate-canonical:${CANDIDATE_RELEASE_SELECTOR.releaseSetId}:${CANDIDATE_RELEASE_SELECTOR.releaseId}`,
      limitation: 'candidate-read-only',
      identity: {
        kind: 'content',
        sourceType: 'content',
        contentId: canonicalId,
        sourceRevision: `${CANDIDATE_RELEASE_SELECTOR.releaseSetId}/${CANDIDATE_RELEASE_SELECTOR.releaseId}`,
      },
    })
  );
  return {
    getAssignedCitations: citationAllocator.assigned,
    getTextbookOptimizations: () => [...textbookOptimizations.values()]
      .sort((left, right) => left.toolCallId.localeCompare(right.toolCallId)),
    permittedTools: normalizeKonlingToolNames(input.permittedTools ?? input.context.permittedTools),
    getPageContext: async () => runKonlingRuntimeTool(input, 'get_page_context', {}, async () => ({
      pageContext: input.context.pageContext,
      knowledgeWorkspace: input.context.knowledgeWorkspace ?? null,
      graphContext: input.context.graphContext
        ? projectKonlingGraphContextForRole(input.context.graphContext, input.scope.role)
        : null,
      knowledgeCapabilityContext: buildKonlingKnowledgeCapabilityToolContext(
        input.context.knowledgeCapabilityContext
        ?? buildKonlingKnowledgeCapabilityContext({
          runtimeContext: input.context,
          scope: input.scope,
          answerIntent: classifyKonlingAnswerIntent(resolveKonlingTeachingAssistantMode('generic-chat'), input.context, input.scope),
          modeId: 'generic-chat',
        })
      ),
    })),
    searchTextbook: async (
      args: { query: string },
      execution: { toolCallId?: string; abortSignal?: AbortSignal } = {},
    ) =>
      runKonlingRuntimeTool(input, 'search_textbook', args, async () => {
        // Production textbook path remains Legacy workspace graph refs only.
        const progressive = await retrieveTextbookSourcePackV2Progressive({
          query: args.query,
          externalQuery: input.context.textbookRetrievalContext?.externalQuery
            ?? [input.context.pageContext.courseTitle, input.context.pageContext.topic]
              .filter(Boolean)
              .join(' '),
          graphNodeRefs: input.context.knowledgeCapabilityContext?.knowledgeNodeRefs ?? [],
          abortSignal: execution.abortSignal,
        }).catch(() => {
          throw new Error('教材检索暂不可用。');
        });
        const result = assignTextbookCitations(progressive.foreground);
        if (progressive.optimizationPending && progressive.continuation) {
          const toolCallId = execution.toolCallId ?? crypto.randomUUID();
          textbookOptimizations.set(toolCallId, {
            toolCallId,
            foreground: result,
            continuation: progressive.continuation.then((outcome): TextbookV2OptimizationResult => (
              outcome.status === 'complete'
                ? { status: 'complete', result: assignTextbookCitations(outcome.result) }
                : outcome
            )).catch((): TextbookV2OptimizationResult => ({ status: 'failed' })),
          });
        }

        // Optional #1112 shadow sidecar: compares actual production foreground
        // identities with Canonical seed+Source Pack adjudication only. Never
        // re-runs production retrieval and never mutates the user-facing result.
        const canonicalRagShadowDiagnostic = maybeRunKonlingCanonicalRagShadowDiagnostic({
          query: args.query,
          productionForeground: result,
          shadowContext: input.canonicalRagShadow ?? null,
          role: sourcePackRoleForKonling(input.scope.role),
        });

        return {
          ...result,
          optimizationPending: progressive.optimizationPending,
          // Diagnostic-only; model projection / user answer ignore this field.
          ...(canonicalRagShadowDiagnostic
            ? { canonicalRagShadowDiagnostic }
            : {}),
        };
      }),
    getLearnerState: async () => runKonlingRuntimeTool(input, 'get_learner_state', {}, async () => input.context.learnerState),
    getStudentRiskFlags: async (args: z.infer<typeof teacherDiagnosisStudentParameters>) =>
      runKonlingRuntimeTool(input, 'get_student_risk_flags', args, async () =>
        readTeacherScopedRiskFlags(input.db, input.scope, args, input.evidenceCutoff)),
    getClassCompetencySummary: async (args: z.infer<typeof teacherDiagnosisClassParameters>) =>
      runKonlingRuntimeTool(input, 'get_class_competency_summary', args, async () => {
        teacherDiagnosisClassParameters.parse(args);
        return readTeacherScopedClassCompetencySummary(input.db, input.scope, input.evidenceCutoff);
      }),
    getStudentKnowledgeProgress: async (args: z.infer<typeof teacherDiagnosisStudentParameters>) =>
      runKonlingRuntimeTool(input, 'get_student_knowledge_progress', args, async () =>
        readTeacherScopedKnowledgeProgress(input.db, input.scope, args, input.evidenceCutoff)),
    getPlanContext: async () => runKonlingRuntimeTool(input, 'get_plan_context', {}, async () => input.context.planContext),
    searchLearningMemory: async (args: { query?: string; limit?: number } = {}) =>
      runKonlingRuntimeTool(input, 'search_learning_memory', args, async () => searchKonlingMemory(input.db, {
        scope: input.scope,
        query: args.query ?? '',
        limit: args.limit ?? 5,
      })),
    searchKnowledgeGraph: async (args: { query?: string; limit?: number } = {}) =>
      runKonlingRuntimeTool(input, 'search_knowledge_graph', args, async () => searchKnowledgeGraph(input.db, args.query ?? '', args.limit ?? 5)),
    searchCandidateCanonical: async (args: z.infer<typeof candidateCanonicalSearchParameters>) =>
      runKonlingRuntimeTool(input, 'search_candidate_canonical', args, async () => {
        if (!input.scope.candidateGraph) {
          throw new KonlingRuntimeScopeError(403, '当前页面未获候选权威图谱授权。');
        }
        const parsed = candidateCanonicalSearchParameters.parse(args);
        const result = unwrapCandidateProjection(await candidateKnowledgeProjectionService.canonicalSearch(
          CANDIDATE_RELEASE_SELECTOR,
          candidateKnowledgeRole(input.scope.role),
          parsed.query,
          CANDIDATE_GRAPH_SUPPORT,
          parsed,
        ));
        return {
          ...result.projection,
          diagnostics: result.diagnostics,
          citations: result.projection.results.map((item) => (
            assignCandidateCitation(item.id, item.label)
          )),
        };
      }),
    getCandidateCanonicalDetail: async (args: z.infer<typeof candidateCanonicalDetailParameters>) =>
      runKonlingRuntimeTool(input, 'get_candidate_canonical_detail', args, async () => {
        if (!input.scope.candidateGraph) {
          throw new KonlingRuntimeScopeError(403, '当前页面未获候选权威图谱授权。');
        }
        const parsed = candidateCanonicalDetailParameters.parse(args);
        const result = unwrapCandidateProjection(await candidateKnowledgeProjectionService.nodeDetail(
          CANDIDATE_RELEASE_SELECTOR,
          candidateKnowledgeRole(input.scope.role),
          parsed.canonicalId,
          CANDIDATE_GRAPH_SUPPORT,
        ));
        return {
          ...result.projection,
          diagnostics: result.diagnostics,
          citations: [
            assignCandidateCitation(
              result.projection.node.id,
              result.projection.node.label,
            ),
          ],
        };
      }),
    getCandidateCanonicalNeighbors: async (args: z.infer<typeof candidateCanonicalNeighborsParameters>) =>
      runKonlingRuntimeTool(input, 'get_candidate_canonical_neighbors', args, async () => {
        if (!input.scope.candidateGraph) {
          throw new KonlingRuntimeScopeError(403, '当前页面未获候选权威图谱授权。');
        }
        const parsed = candidateCanonicalNeighborsParameters.parse(args);
        const result = unwrapCandidateProjection(await candidateKnowledgeProjectionService.boundedNeighbors(
          CANDIDATE_RELEASE_SELECTOR,
          candidateKnowledgeRole(input.scope.role),
          parsed.canonicalId,
          CANDIDATE_GRAPH_SUPPORT,
          parsed,
        ));
        return {
          ...result.projection,
          diagnostics: result.diagnostics,
          citations: [
            assignCandidateCitation(parsed.canonicalId, parsed.canonicalId),
            ...result.projection.neighbors.map((item) => (
              assignCandidateCitation(item.neighbor.id, item.neighbor.label)
            )),
          ],
        };
      }),
    recommendNextAction: async () => runKonlingRuntimeTool(input, 'recommend_next_action', {}, async () => recommendNextAction(input.context)),
    getSimulationStatus: async (args: { resourceId?: string | null } = {}) => {
      return runKonlingRuntimeTool(input, 'get_simulation_status', args, async () => {
        if (args.resourceId && input.scope.resourceId && args.resourceId !== input.scope.resourceId) {
          throw new KonlingRuntimeScopeError(403, '无权读取当前资源范围外的仿真状态。');
        }
        return input.scopedSimulationState
          ? formatSimulationStatus(input.scopedSimulationState)
          : formatUnavailableSimulationStatus(input.scope);
      });
    },
    setSimulationParams: async (args: SimulationParamChangeInput) => runKonlingRuntimeTool(input, 'set_simulation_params', args, async () => {
      assertSimulationScope(input.scope, Boolean(input.scopedSimulationState));
      const request = buildSimulationParamChangeRequest(args);
      return {
        ...formatSimulationParamChangeResponse(request),
        pendingRequest: {
          type: request.type,
          params: request.params,
          scope: buildToolScopeRef(input.scope),
        },
      };
    }),
    analyzeResult: async (args: SimulationAnalysisInput) => runKonlingRuntimeTool(input, 'analyze_result', args, async () => {
      assertSimulationScope(input.scope, Boolean(input.scopedSimulationState));
      return analyzeSimulationResult(args);
    }),
    getSimulationContext: async (args: SimulationContextInput) =>
      runKonlingRuntimeTool(input, 'get_simulation_context', args, async () => {
        const parsed = simulationContextParameters.parse(args);
        if (parsed.simulationRunId) {
          const run = await resolveScopedSimulationRun(input.db, input.scope, parsed);
          return buildSimulationContextOutput(input.scope, run, { includeTrace: parsed.includeTrace === true });
        }
        const taskSpec = await resolveScopedSimulationTaskSpec(input.db, input.scope, parsed.taskSpecId);
        return buildSimulationTaskSpecContextOutput(input.scope, taskSpec);
      }),
    runVirtualSimulation: async (args: RunVirtualSimulationInput) => {
      assertCandidateToolAllowed(input.scope, 'run_virtual_simulation');
      assertAgentSessionRequiredForPersistentSimulationTool(input, 'run_virtual_simulation');
      assertOwnerSimulationWriteScope(input.scope);
      return runKonlingRuntimeTool(input, 'run_virtual_simulation', args, async (toolRun) => {
        const parsed = runVirtualSimulationParameters.parse(args);
        return createKonlingVirtualSimulationRun(input.db, input.scope, parsed, {
          agentSessionId: input.agentSessionId ?? null,
          agentToolRunId: toolRun?.id ?? null,
        });
      });
    },
    analyzeSimulationTrace: async (args: AnalyzeSimulationTraceInput) =>
      runKonlingRuntimeTool(input, 'analyze_simulation_trace', args, async () => {
        const parsed = analyzeSimulationTraceParameters.parse(args);
        const run = await resolveScopedSimulationRun(input.db, input.scope, {
          simulationRunId: parsed.simulationRunId,
          includeTrace: true,
        });
        const trace = await resolveScopedSimulationTrace(input.db, run, parsed.traceId);
        return buildSimulationTraceAnalysisOutput(input.scope, run, trace);
      }),
    compareSimulationRuns: async (args: CompareSimulationRunsInput) =>
      runKonlingRuntimeTool(input, 'compare_simulation_runs', args, async () => {
        const parsed = compareSimulationRunsParameters.parse(args);
        const runs = await resolveScopedSimulationRuns(input.db, input.scope, parsed.simulationRunIds);
        return buildSimulationComparisonOutput(input.scope, runs);
      }),
    proposeControllerPatch: async (args: ProposeControllerPatchInput) =>
      runKonlingRuntimeTool(input, 'propose_controller_patch', args, async () => {
        const parsed = proposeControllerPatchParameters.parse(args);
        const run = await resolveScopedSimulationRun(input.db, input.scope, {
          simulationRunId: parsed.simulationRunId,
          includeTrace: true,
        });
        return buildControllerPatchProposal(input.scope, run, parsed);
      }),
    applyControllerPatch: async (args: ApplyControllerPatchInput) => {
      assertCandidateToolAllowed(input.scope, 'apply_controller_patch');
      assertAgentSessionRequiredForPersistentSimulationTool(input, 'apply_controller_patch');
      assertOwnerSimulationWriteScope(input.scope);
      return runKonlingRuntimeTool(input, 'apply_controller_patch', args, async () => {
        const parsed = applyControllerPatchParameters.parse(args);
        const run = await resolveScopedSimulationRun(input.db, input.scope, {
          simulationRunId: parsed.simulationRunId,
          includeTrace: true,
        });
        return {
          applied: true,
          pendingControllerPatch: buildPendingControllerPatch(input.scope, run, parsed),
        };
      });
    },
    recordInterventionResult: async (args: {
      interventionId: string;
      feedback: KonlingInterventionFeedback;
      helpful?: boolean;
      studentResponse?: string;
    }) => runKonlingRuntimeTool(input, 'record_intervention_result', args, async () => recordKonlingInterventionFeedback(input.db, {
      scope: input.scope,
      interventionId: args.interventionId,
      feedback: args.feedback,
      helpful: args.helpful,
      studentResponse: args.studentResponse,
    })),
    generateLearningPath: async (args: z.infer<typeof generateLearningPathParameters>) =>
      runKonlingRuntimeTool(input, 'generate_learning_path', args, async () => buildAdaptivePathToolOutput(input, 'generated', args)),
    reviseLearningPathOptions: async (args: z.infer<typeof reviseLearningPathOptionsParameters>) =>
      runKonlingRuntimeTool(input, 'revise_learning_path_options', args, async () => buildAdaptivePathToolOutput(input, 'revised', args)),
    selectLearningPath: async (args: z.infer<typeof selectLearningPathParameters>) =>
      runKonlingRuntimeTool(input, 'select_learning_path', args, async (toolRun) =>
        buildAdaptivePathCandidateSelectionOutput(input, args, toolRun?.id ?? null)),
    rejectLearningPathOption: async (args: z.infer<typeof rejectLearningPathOptionParameters>) =>
      runKonlingRuntimeTool(input, 'reject_learning_path_option', args, async () => buildAdaptivePathToolOutcome(input, 'rejected', args)),
    explainLearningPathTradeoff: async (args: z.infer<typeof explainLearningPathTradeoffParameters>) =>
      runKonlingRuntimeTool(input, 'explain_learning_path_tradeoff', args, async () => buildAdaptivePathTradeoffOutput(input, args)),
    recordPathAdjustmentOutcome: async (args: z.infer<typeof recordPathAdjustmentOutcomeParameters>) =>
      runKonlingRuntimeTool(input, 'record_path_adjustment_outcome', args, async () => buildAdaptivePathToolOutcome(input, args.outcome, args)),
    proposeSmartLessonTaskChange: async (args: z.infer<typeof proposeSmartLessonTaskChangeParameters>) => {
      const smartPreparation = (input.context as KonlingRuntimeContext & { teachingAssistantMode?: KonlingTeachingAssistantRuntimeContract })
        .teachingAssistantMode?.smartPreparation;
      args = proposeSmartLessonTaskChangeParameters.parse({
        ...args,
        operation: args.operation ?? (smartPreparation?.bootstrap ? 'bootstrap' : 'revise'),
      });
      if (!input.agentSessionId) throw new KonlingRuntimeScopeError(403, '智能备课建议必须来自已绑定的 prep-coauthor 会话。');
      const session = await input.db.agentSession?.findFirst?.({
        where: { id: input.agentSessionId, ownerUserId: input.scope.targetUserId, actorUserId: input.scope.authenticatedUserId },
        select: { stateJson: true },
      });
      const sessionState = readRecord(getValue(session, 'stateJson'));
      const turnId = getString(sessionState, 'currentTurnId');
      if (!turnId) throw new KonlingRuntimeScopeError(409, '智能备课会话没有可绑定的当前对话轮次。');
      const proposedFieldNames = Object.keys(readRecord(args.proposedTask));
      const changedFields = [...new Set([
        ...proposedFieldNames,
        ...(args.knowledgePointPatches?.length ? ['knowledgePoints'] : []),
        ...(args.goalPatches?.length ? ['goals'] : []),
      ])];
      const affectedStageId = args.operation !== 'bootstrap'
        && !args.knowledgePointPatches?.length
        && !args.goalPatches?.length
        && proposedFieldNames.length === 1
        && proposedFieldNames[0] === 'selectedClassId'
        ? 'class-attainment'
        : 'topic-goals';
      const { knowledgePointPatches, goalPatches, ...proposalArgs } = args;
      const operation = args.operation ?? 'revise';
      const normalizedProposedTask = normalizeSuggestedSmartLessonTask(
        args.proposedTask as Record<string, unknown> | undefined,
        smartPreparation,
        {
          knowledgePoints: knowledgePointPatches,
          goals: goalPatches,
        },
      );
      const boundArgs = {
        ...proposalArgs,
        proposedTask: normalizedProposedTask,
        publicActionId: crypto.randomUUID(),
        ...(operation === 'bootstrap' ? {
          publicBasisSummary: buildPublicSmartPreparationBasisSummary(
            smartPreparation,
            normalizedProposedTask,
          ),
        } : {}),
        affectedStageId,
        changedFields,
        turnId,
      };
      const proposedTask = boundArgs.proposedTask;
      if (!args.clarification && proposedTask) {
        const validation = operation === 'bootstrap'
          ? createTaskSchema.safeParse(proposedTask)
          : updateTaskSchema.safeParse({
            ...proposedTask,
            expectedRevision: args.expectedRevision,
            confirmingTurnId: turnId,
            agentSessionId: input.agentSessionId,
          });
        if (!validation.success) {
          logKonlingSmartPreparationValidationIssues(validation.error.issues);
          throw new KonlingRuntimeScopeError(400, '智能备课建议不符合确认要求。');
        }
        if (operation === 'bootstrap') {
          const courseBasisId = getString(proposedTask, 'courseBasisId');
          const availableCourseBases = arrayOfRecords(readRecord(smartPreparation?.currentTask).availableCourseBases);
          const courseBasis = availableCourseBases.find((basis) => getString(basis, 'id') === courseBasisId);
          if (!courseBasis) throw new KonlingRuntimeScopeError(400, '智能备课建议引用了不可用的课程依据。');
          const availableVersionIds = new Set(
            arrayOfRecords(courseBasis.documents).flatMap((document) =>
              arrayOfRecords(document.versions).map((version) => getString(version, 'id')).filter(Boolean)
            ),
          );
          if (arrayOfStrings(readRecord(proposedTask).sourceVersionIds).some((versionId) => !availableVersionIds.has(versionId))) {
            throw new KonlingRuntimeScopeError(400, '智能备课建议引用了不属于所选课程依据的版本。');
          }
          for (const point of arrayOfRecords(readRecord(proposedTask).knowledgePoints)) point.sourceBindings = [];
          for (const goal of arrayOfRecords(readRecord(proposedTask).goals)) goal.sourceBindings = [];
        }
      }
      return runKonlingRuntimeTool(input, 'propose_smart_lesson_task_change', boundArgs, async (toolRun) => {
        const contract = (input.context as KonlingRuntimeContext & { teachingAssistantMode?: KonlingTeachingAssistantRuntimeContract }).teachingAssistantMode;
        const activeSmartPreparation = contract?.smartPreparation;
        if (contract?.mode.id !== 'prep-coauthor' || !activeSmartPreparation) {
          throw new KonlingRuntimeScopeError(403, '智能备课建议必须来自已绑定的 prep-coauthor 会话。');
        }
        const isBootstrap = operation === 'bootstrap';
        if (isBootstrap !== Boolean(activeSmartPreparation.bootstrap)) {
          throw new KonlingRuntimeScopeError(409, '智能备课建议与当前会话阶段不匹配。');
        }
        if (!isBootstrap && (args.taskId !== activeSmartPreparation.taskId || String(args.expectedRevision) !== activeSmartPreparation.taskRevision)) {
          throw new KonlingRuntimeScopeError(409, '智能备课建议绑定的任务修订已过期。');
        }
        const binding = readRecord(sessionState.smartPrepBinding);
        if (
          getString(sessionState, 'currentTurnId') !== turnId
          || (!isBootstrap && getString(binding, 'taskId') !== args.taskId)
          || (!isBootstrap && getString(binding, 'ownerUserId') !== input.scope.targetUserId)
        ) throw new KonlingRuntimeScopeError(409, '智能备课建议的会话、对话轮次或任务绑定无效。');
        return {
          suggestionId: toolRun?.id,
          operation,
          ...(args.taskId ? { taskId: args.taskId } : {}),
          ...(args.expectedRevision ? { expectedRevision: args.expectedRevision } : {}),
          turnId,
          status: args.clarification ? 'clarification_required' : 'awaiting_teacher_confirmation',
          ...(args.clarification ? { clarification: args.clarification } : { proposedTask: boundArgs.proposedTask }),
        };
      });
    },
    analyzeAttempt: async (args: { studentState: StudentState }) =>
      runKonlingRuntimeTool(input, 'analyze_attempt', args, async () => analyzeKonlingAttempt(args.studentState)),
    calculate: async (args: { expression: string; operation?: (typeof MATH_CALC_OPERATIONS)[number] }) =>
      runKonlingRuntimeTool(input, 'calculate', args, async () => {
        const parsed = calculateToolParameters.parse(args);
        let result;
        try {
          result = await runMathCalculate({
            expression: parsed.expression,
            ...(parsed.operation ? { operation: parsed.operation } : {}),
          });
        } catch (error) {
          if (error instanceof MathCalculateCapacityError) {
            throw new KonlingRuntimeScopeError(429, error.message);
          }
          throw error;
        }
        if (result.status === 'error') {
          throw new KonlingRuntimeScopeError(400, result.error ?? '公式计算失败');
        }
        return {
          expression: parsed.expression,
          result: result.result,
          steps: result.steps,
        };
      }),
  };
}

function normalizeSuggestedSmartLessonTask(
  value: Record<string, unknown> | undefined,
  preparation: KonlingSmartPreparationServerContext | null | undefined,
  patches: {
    knowledgePoints?: Array<z.infer<typeof smartLessonCollectionPatch>>;
    goals?: Array<z.infer<typeof smartLessonCollectionPatch>>;
  } = {},
) {
  if (!value && !patches.knowledgePoints?.length && !patches.goals?.length) return value;
  value ??= {};
  const currentTask = readRecord(preparation?.currentTask);
  const isRevision = Boolean(preparation && !preparation.bootstrap);
  if (!isRevision && (patches.knowledgePoints?.length || patches.goals?.length)) {
    throw new KonlingRuntimeScopeError(400, '新建任务必须提交完整 knowledgePoints 和 goals。');
  }
  if (isRevision && patches.knowledgePoints?.length && Object.hasOwn(value, 'knowledgePoints')) {
    throw new KonlingRuntimeScopeError(400, 'knowledgePoints 完整数组与增量补丁不能同时提交。');
  }
  if (isRevision && patches.goals?.length && Object.hasOwn(value, 'goals')) {
    throw new KonlingRuntimeScopeError(400, 'goals 完整数组与增量补丁不能同时提交。');
  }
  if (isRevision && Object.hasOwn(value, 'knowledgePoints')) {
    throw new KonlingRuntimeScopeError(400, '既有任务的 knowledgePoints 必须使用增量补丁修改。');
  }
  if (isRevision && Object.hasOwn(value, 'goals')) {
    throw new KonlingRuntimeScopeError(400, '既有任务的 goals 必须使用增量补丁修改。');
  }
  const proposedTask = isRevision ? { ...currentTask, ...value } : value;
  if (isRevision) {
    if (patches.knowledgePoints?.length) {
      proposedTask.knowledgePoints = applySmartLessonCollectionPatches(
        currentTask.knowledgePoints,
        patches.knowledgePoints,
        'knowledgePoints',
      );
    }
    if (patches.goals?.length) {
      proposedTask.goals = applySmartLessonCollectionPatches(currentTask.goals, patches.goals, 'goals');
    }
    proposedTask.courseBasisId = getString(currentTask, 'courseBasisId') ?? undefined;
    proposedTask.sourceVersionIds = (preparation?.selectedCourseBasisVersions ?? [])
      .map((source) => source.versionId)
      .filter(Boolean);
  }
  const knowledgePoints = Array.isArray(proposedTask.knowledgePoints)
    ? proposedTask.knowledgePoints.map((item) => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) return item;
      const point = item as Record<string, unknown>;
      const sourceState = normalizeSuggestedSmartLessonSourceState(point.sourceState);
      const origin = point.origin === 'SUGGESTED' || point.origin === 'TEACHER_CREATED'
        ? point.origin
        : 'SUGGESTED';
      return sourceState === point.sourceState && origin === point.origin
        ? point
        : { ...point, sourceState, origin };
    })
    : proposedTask.knowledgePoints;
  const goals = Array.isArray(proposedTask.goals)
    ? proposedTask.goals.map((item) => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) return item;
      const goal = item as Record<string, unknown>;
      const sourceState = normalizeSuggestedSmartLessonSourceState(goal.sourceState);
      return sourceState === goal.sourceState ? goal : { ...goal, sourceState };
    })
    : proposedTask.goals;
  return {
    ...proposedTask,
    ...(knowledgePoints ? { knowledgePoints } : {}),
    ...(goals ? { goals } : {}),
  };
}

function normalizeSuggestedSmartLessonSourceState(value: unknown) {
  if (value === 'VERIFIED') return 'verified';
  if (value === 'NO_RELIABLE_SOURCE') return 'no_reliable_source';
  if (value === 'AI_GENERATED_SOURCE_PENDING') return 'ai_generated_source_pending';
  if (value === 'TEACHER_CREATED_SOURCE_PENDING') return 'teacher_created_source_pending';
  return value;
}

function buildPublicSmartPreparationBasisSummary(
  preparation: KonlingSmartPreparationServerContext | null | undefined,
  proposedTask: Record<string, unknown> | undefined,
) {
  if (!proposedTask) return undefined;
  const selectedBasisId = getString(proposedTask, 'courseBasisId');
  const selectedVersionIds = new Set(arrayOfStrings(proposedTask.sourceVersionIds));
  const availableCourseBases = arrayOfRecords(readRecord(preparation?.currentTask).availableCourseBases);
  const basis = availableCourseBases.find((candidate) => getString(candidate, 'id') === selectedBasisId);
  if (!basis) return undefined;
  const sources = arrayOfRecords(basis.documents).flatMap((document) => {
    const documentTitle = getString(document, 'title');
    return arrayOfRecords(document.versions).flatMap((version) => {
      const versionId = getString(version, 'id');
      if (!versionId || !selectedVersionIds.has(versionId)) return [];
      const versionNumber = version.versionNumber;
      return [typeof versionNumber === 'number'
        ? `${documentTitle ?? '课程资料'} v${versionNumber}`
        : documentTitle ?? '课程资料'];
    });
  });
  return {
    title: getString(basis, 'title') ?? '课程依据',
    sources,
  };
}

function logKonlingSmartPreparationValidationIssues(issues: readonly unknown[]) {
  if (process.env.NODE_ENV === 'production') return;
  const payload = {
    issues: issues.slice(0, 16).map((issue) => {
      const record = readRecord(issue);
      return {
        path: Array.isArray(record.path)
          ? record.path.slice(0, 12).map((segment) =>
              typeof segment === 'number'
                ? segment
                : typeof segment === 'string' && /^[A-Za-z][A-Za-z0-9_]{0,63}$/u.test(segment)
                  ? segment
                  : '[field]')
          : [],
        code: typeof record.code === 'string' && /^[a-z_]{1,64}$/u.test(record.code)
          ? record.code
          : 'validation_error',
      };
    }),
  };
  console.error('[konling-smart-preparation-validation]', JSON.stringify(payload));
}

function applySmartLessonCollectionPatches(
  currentValue: unknown,
  patches: Array<z.infer<typeof smartLessonCollectionPatch>>,
  field: 'knowledgePoints' | 'goals',
): unknown[] {
  const current = Array.isArray(currentValue) ? currentValue : [];
  const currentById = new Map<string, Record<string, unknown>>();
  for (const item of current) {
    const record = readRecord(item);
    const id = getString(record, 'id');
    if (!id) throw new KonlingRuntimeScopeError(400, `${field} 的现有条目缺少稳定 ID，不能应用增量补丁。`);
    if (currentById.has(id)) throw new KonlingRuntimeScopeError(400, `${field} 存在重复 ID：${id}。`);
    currentById.set(id, record);
  }

  const targetedIds = new Set<string>();
  const additions: Record<string, unknown>[] = [];
  const updates = new Map<string, Record<string, unknown>>();
  const removals = new Set<string>();
  for (const patch of patches) {
    if (patch.operation === 'add') {
      if (getString(patch.item, 'id')) {
        throw new KonlingRuntimeScopeError(400, `${field} 新增条目不能指定既有 ID。`);
      }
      additions.push(patch.item);
      continue;
    }
    if (targetedIds.has(patch.id)) {
      throw new KonlingRuntimeScopeError(400, `${field} 补丁包含重复或冲突 ID：${patch.id}。`);
    }
    targetedIds.add(patch.id);
    if (!currentById.has(patch.id)) {
      throw new KonlingRuntimeScopeError(400, `${field} 补丁引用未知 ID：${patch.id}。`);
    }
    if (patch.operation === 'remove') {
      removals.add(patch.id);
      continue;
    }
    if (Object.hasOwn(patch.changes, 'id')) {
      throw new KonlingRuntimeScopeError(400, `${field} 补丁不能修改稳定 ID：${patch.id}。`);
    }
    if (Object.hasOwn(patch.changes, 'sourceBindings')) {
      throw new KonlingRuntimeScopeError(400, `${field} 补丁不能修改服务端保留的 sourceBindings：${patch.id}。`);
    }
    updates.set(patch.id, patch.changes);
  }

  return current
    .filter((item) => !removals.has(getString(readRecord(item), 'id') ?? ''))
    .map((item) => {
      const record = readRecord(item);
      const id = getString(record, 'id')!;
      const changes = updates.get(id);
      if (!changes) return item;
      return {
        ...record,
        ...changes,
        ...(field === 'knowledgePoints' && Object.hasOwn(changes, 'content') && !Object.hasOwn(changes, 'title')
          ? { title: changes.content }
          : {}),
        id,
      };
    })
    .concat(additions);
}

async function buildAdaptivePathToolOutput(
  input: KonlingToolRuntimeInput,
  operation: 'generated' | 'revised',
  rawArgs: z.infer<typeof generateLearningPathParameters> | z.infer<typeof reviseLearningPathOptionsParameters>,
) {
  const goalId = resolveScopedAdaptivePathGoalId(input, rawArgs.goalId);
  const registeredGoal = getRegisteredAdaptiveLearningPathGoal(goalId);
  if (!registeredGoal) {
    throw new KonlingRuntimeScopeError(404, '当前页面目标没有可生成的学习路径。');
  }
  const revisedArgs = operation === 'revised'
    ? reviseLearningPathOptionsParameters.parse(rawArgs)
    : null;
  const adjustmentSource = revisedArgs
    ? await resolveAdaptivePathAdjustmentSource(input, goalId, revisedArgs)
    : null;
  const effectiveRevisionArgs = adjustmentSource && revisedArgs
    ? {
        ...revisedArgs,
        priorRequestId: adjustmentSource.batch.generationRequestId,
        preferredStyleId: adjustmentSource.candidate.styleId,
        selectedStyleId: adjustmentSource.candidate.styleId,
      }
    : null;
  const args = effectiveRevisionArgs ?? generateLearningPathParameters.parse(rawArgs);
  const { registry, diagnostics: candidatePoolDiagnostics } = await resolveAdaptivePathGenerationRegistry(input, goalId);
  // Use the legacy bounded generation cap when the learner omitted one. This
  // cap only controls candidate generation; the minimum executable duration is
  // derived from the repaired plan below and never raises an explicit request.
  const planningTimeBudgetMinutes = args.timeBudgetMinutes ?? resolveAdaptivePathPlanningBudget(registeredGoal);
  const intentMapping = mapAdaptivePathNaturalLanguageIntent(args.naturalLanguageIntent);
  const plannerLearnerState = operation === 'generated'
    ? isAdaptiveLearnerStateServiceEnabled()
      ? await readPathPlannerLearnerStateForSubject(input.scope.targetUserId, {
          goal: goalId,
          classId: input.scope.classId,
          now: new Date(),
        }).catch((error) => {
          console.error('[KonlingRuntime] Planner learner state read failed:', error);
          return null;
        })
      : input.context.learnerState
    : input.context.learnerState;
  const learnerStateForPlanning = plannerLearnerState;
  const explicitResourcePreferences = normalizeAdaptivePathResourcePreferences(args.resourcePreference);
  const portraitResourcePreferences = resolveAdaptivePathPortraitResourcePreference(plannerLearnerState);
  const resourcePreferences = explicitResourcePreferences
    ?? portraitResourcePreferences
    ?? (intentMapping.resourcePreferences.length > 0 ? intentMapping.resourcePreferences : undefined)
    ?? registeredGoal.starterPathPolicy.preferredResourceTypes;
  const resourcePreferenceSource = explicitResourcePreferences
    ? 'request'
    : portraitResourcePreferences
      ? 'profile'
      : intentMapping.resourcePreferences.length > 0
        ? 'intent'
        : 'fallback';
  const difficultyRhythm = args.difficultyRhythm
    ?? (intentMapping.conflictDimensions.includes('difficulty')
      ? undefined
      : intentMapping.difficultyRhythm ?? registeredGoal.starterPathPolicy.difficultyRhythm);
  const difficultyRhythmSource = args.difficultyRhythm
    ? 'request'
    : intentMapping.difficultyRhythm
      ? 'intent'
      : 'fallback';
  const checkpointPreference = args.checkpointPreference
    ?? (intentMapping.conflictDimensions.includes('checkpoint')
      ? undefined
      : intentMapping.checkpointPreference ?? 'standard');
  const checkpointPreferenceSource = args.checkpointPreference
    ? 'request'
    : intentMapping.checkpointPreference
      ? 'intent'
      : 'fallback';
  const allowExternalResources = args.allowExternalResources
    ?? (intentMapping.conflictDimensions.includes('external-resource')
      ? undefined
      : intentMapping.allowExternalResources ?? registeredGoal.starterPathPolicy.allowExternalResources);
  const allowExternalResourcesSource = typeof args.allowExternalResources === 'boolean'
    ? 'request'
    : intentMapping.allowExternalResources !== undefined
      ? 'intent'
      : 'fallback';
  const configurationRequests: AdaptiveLearningPathConfigurationRequest[] = [
    ...(explicitResourcePreferences ? [{
      key: 'resource-preferences' as const,
      source: 'request' as const,
      value: explicitResourcePreferences,
    }] : portraitResourcePreferences ? [{
      key: 'resource-preferences' as const,
      source: 'profile' as const,
      value: portraitResourcePreferences,
    }] : intentMapping.resourcePreferences.length > 0 ? [{
      key: 'resource-preferences' as const,
      source: 'intent' as const,
      value: intentMapping.resourcePreferences,
      mappedTerms: intentMapping.matchedTerms,
    }] : [{
      key: 'resource-preferences' as const,
      source: 'fallback' as const,
      value: registeredGoal.starterPathPolicy.preferredResourceTypes,
    }]),
    ...(args.difficultyRhythm ? [{
      key: 'difficulty-rhythm' as const,
      source: 'request' as const,
      value: args.difficultyRhythm,
    }] : intentMapping.difficultyRhythm ? [{
      key: 'difficulty-rhythm' as const,
      source: 'intent' as const,
      value: intentMapping.difficultyRhythm,
      mappedTerms: intentMapping.matchedTerms,
    }] : []),
    ...(args.checkpointPreference ? [{
      key: 'checkpoint-preference' as const,
      source: 'request' as const,
      value: args.checkpointPreference,
    }] : intentMapping.checkpointPreference ? [{
      key: 'checkpoint-preference' as const,
      source: 'intent' as const,
      value: intentMapping.checkpointPreference,
      mappedTerms: intentMapping.matchedTerms,
    }] : []),
    ...(typeof args.allowExternalResources === 'boolean' ? [{
      key: 'external-resources' as const,
      source: 'request' as const,
      value: args.allowExternalResources,
    }] : intentMapping.allowExternalResources !== undefined ? [{
      key: 'external-resources' as const,
      source: 'intent' as const,
      value: intentMapping.allowExternalResources,
      mappedTerms: intentMapping.matchedTerms,
    }] : []),
    ...(typeof args.timeBudgetMinutes === 'number' ? [{
      key: 'time-budget' as const,
      source: 'request' as const,
      value: args.timeBudgetMinutes,
    }] : []),
    ...(typeof args.naturalLanguageIntent === 'string' && args.naturalLanguageIntent.trim() ? [{
      key: 'natural-language-intent' as const,
      source: 'request' as const,
      value: 'mapped-intent',
      mappedTerms: intentMapping.matchedTerms,
      limitationCode: intentMapping.limitationCode,
    }] : []),
  ];
  const plannerRevisionPreference = operation === 'revised'
    ? buildAdaptivePathRevisionPlannerPreference(args, registeredGoal)
    : buildAdaptivePathGenerationPlannerPreference(registeredGoal);
  const graphContext = buildAdaptivePathPlannerGraphContext(input.context.graphContext, goalId, args.graphNodeId);
  const sourcePackInput = await buildAdaptivePathSourcePackCandidates(registry);
  const governedFacts = await input.db.learningFact?.findMany?.({
    where: { userId: input.scope.targetUserId },
    orderBy: [{ finishedAt: 'desc' }, { id: 'desc' }],
    take: 50,
  }) ?? [];
  const collectionEvents = collectionEventsFromGovernedFacts({
    facts: Array.isArray(governedFacts) ? governedFacts as ColdStartGovernedFactInput[] : [],
    goalId,
  });
  const previousPathFacts = previousPathFactsFromPlanOptions(input.context.planContext?.pathOptions);
  const plan = planLearningPath({
    studentId: input.scope.targetUserId,
    goal: registeredGoal.goal,
    learnerState: normalizeAdaptivePathLearnerStateForPlanner(learnerStateForPlanning as any)
      ?? buildColdStartAdaptivePathLearnerState(registeredGoal.goal.knowledgeTargets),
    registry,
    graphContext,
    constraints: {
      timeBudgetMinutes: planningTimeBudgetMinutes,
      privacyScopes: ['student-visible'],
      completedNodeIds: input.context.planContext?.completedNodeIds ?? [],
      currentNodeId: input.context.planContext?.activeNodeId ?? null,
    },
    difficultyRhythm,
    difficultyRhythmSource,
    resourcePreferences,
    resourcePreferenceSource,
    checkpointPreference,
    checkpointPreferenceSource,
    allowExternalResources,
    allowExternalResourcesSource,
    configurationRequests,
    sourcePackCandidates: sourcePackInput.items,
    sourcePackLimitations: sourcePackInput.limitations,
    candidatePoolDiagnostics,
    sourcePackRole: 'student',
    ...plannerRevisionPreference,
    excludedNodeIds: args.excludedNodeIds,
    preferredStyleId: args.preferredStyleId,
    requestedAt: args.requestedAt,
    collectionEvents,
    previousPathFacts,
    now: new Date(),
  });
  const timeBudget = resolveAdaptivePathTimeBudget(
    args.timeBudgetMinutes,
    plan,
    planningTimeBudgetMinutes,
  );
  const toolScope = buildAdaptivePathToolScope(input, goalId, args.pathId);
  const requestSnapshot = redactSensitivePayload({
    requestedTimeBudgetMinutes: args.timeBudgetMinutes ?? null,
    effectiveTimeBudgetMinutes: timeBudget.effectiveMinutes,
    minimumTimeBudgetMinutes: timeBudget.minimumMinutes,
    timeBudgetInsufficient: timeBudget.insufficient,
    difficultyRhythm,
    resourcePreference: resourcePreferences,
    resourcePreferenceSource,
    checkpointPreference,
    allowExternalResources,
    graphNodeId: args.graphNodeId ?? null,
    intentSummary: summarizeStudentIntent(args.naturalLanguageIntent),
    excludedNodeIds: args.excludedNodeIds ?? [],
    preferredStyleId: args.preferredStyleId ?? null,
    requestedAt: args.requestedAt ?? null,
    candidatePoolDiagnostics,
    learnerStateSnapshot: buildAdaptiveLearningPathLearnerStateSnapshot(
      normalizeAdaptivePathLearnerStateForPlanner(learnerStateForPlanning as any),
    ),
  });
  const hasPersistablePath = plan.mainPath.length > 0;
  const differenceSummary = adjustmentSource && hasPersistablePath
    ? buildAdaptivePathCandidateDifferenceSummary(adjustmentSource.candidate, plan)
    : null;
  if (effectiveRevisionArgs) {
    await assertAdaptivePathAdjustmentProgressStillCurrent(input, goalId, effectiveRevisionArgs);
  }
  const hasMaterialPath = hasPersistablePath && (!differenceSummary || differenceSummary.material);
  const persistedPlan = {
    ...plan,
    id: `${plan.id}:candidate_${createHash('sha256')
      .update(args.idempotencyKey)
      .digest('hex')
      .slice(0, 24)}`,
  };
  const candidatePoolLimitationCodes = candidatePoolDiagnostics.sourceFamilies
    .map((source) => source.reason)
    .filter((reason): reason is string => Boolean(reason));
  const candidatePoolLimited = candidatePoolLimitationCodes.length > 0;
  const candidatePoolStatus = {
    limited: candidatePoolLimited,
    limitationCodes: candidatePoolLimitationCodes,
  };
  const persistSourcePath = (db: any) => persistLearningPathRound(db, {
    plan: persistedPlan,
    pathStatus: 'candidate',
    classId: input.scope.classId ?? null,
    learnerStateRef: learnerStateForPlanning ? `adaptive-learner-state:${input.scope.targetUserId}` : null,
    inputSnapshot: {
      source: 'konling-tool',
      operation,
      toolScope,
      candidatePoolLimited,
      candidatePoolLimitationCodes,
      request: requestSnapshot,
    },
    pathPayloadMetadata: {
      candidatePoolLimited,
      candidatePoolLimitationCodes,
      candidatePoolStatus,
      configurationFulfillment: plan.explanations.configurationFulfillment,
      requestedTimeBudgetMinutes: args.timeBudgetMinutes ?? null,
      minimumTimeBudgetMinutes: timeBudget.minimumMinutes,
      timeBudgetInsufficient: timeBudget.insufficient,
    },
  });
  let candidateBatch: AdaptivePathCandidateBatchView | null = null;
  const candidateBatchStore = (input.db as any).adaptivePathCandidateBatch;
  const canPersistCandidateBatch = candidateBatchStore
    && typeof candidateBatchStore.findUnique === 'function'
    && typeof candidateBatchStore.create === 'function';
  const candidateBatchInput = {
    generationRequestId: args.idempotencyKey,
    plan: persistedPlan,
    classId: input.scope.classId ?? null,
    ...(adjustmentSource && differenceSummary ? {
      derivation: {
        kind: 'adjustment' as const,
        sourceBatchId: adjustmentSource.batch.id,
        sourceCandidateId: adjustmentSource.candidate.id,
        sourceCandidateFingerprint: adjustmentSource.candidate.fingerprint,
        activeProgressVersion: effectiveRevisionArgs!.activeProgressVersion,
        requestSnapshot: readRecord(requestSnapshot),
        differenceSummary,
      },
    } : {}),
  };
  if (operation === 'revised' && !canPersistCandidateBatch) {
    throw new KonlingRuntimeScopeError(409, '候选路径调整暂不可用，请稍后重试。');
  }
  if (canPersistCandidateBatch) {
    const readExistingBatch = async () => {
      const existingBatch = await readAdaptivePathCandidateBatchByGenerationRequest(
        input.db as any,
        args.idempotencyKey,
      );
      if (existingBatch) assertAdaptivePathCandidateBatchMatchesInput(existingBatch, candidateBatchInput);
      return existingBatch;
    };
    candidateBatch = await readExistingBatch();
    if (!candidateBatch && hasMaterialPath) {
      const writeFencePathId = effectiveRevisionArgs
        ? effectiveRevisionArgs.pathId ?? input.context.planContext?.currentPathId
        : persistedPlan.id;
      if (!writeFencePathId) {
        throw new KonlingRuntimeScopeError(409, '当前学习路径不存在，请刷新后重新调整。');
      }
      try {
        candidateBatch = await runWithLearningPathWriteFence(
          input.db as any,
          writeFencePathId,
          async (tx, existingPath) => {
            const existingBatch = await readAdaptivePathCandidateBatchByGenerationRequest(
              tx as any,
              args.idempotencyKey,
            );
            if (existingBatch) {
              assertAdaptivePathCandidateBatchMatchesInput(existingBatch, candidateBatchInput);
              return existingBatch;
            }
            if (!effectiveRevisionArgs && existingPath) {
              throw new AdaptivePathCandidateBatchConflictError(
                'Candidate source path exists without its immutable candidate batch',
              );
            }
            if (effectiveRevisionArgs) {
              await assertAdaptivePathAdjustmentProgressStillCurrent(
                input,
                goalId,
                effectiveRevisionArgs,
                tx,
              );
            }
            await persistSourcePath(tx);
            return persistAdaptivePathCandidateBatch(tx as any, candidateBatchInput);
          },
          { requireWritable: false },
        );
      } catch (error) {
        candidateBatch = await readExistingBatch();
        if (!candidateBatch) throw error;
      }
    }
  } else if (hasMaterialPath) {
    await persistSourcePath(input.db as any);
  }
  const noMaterialDifference = operation === 'revised'
    && !candidateBatch
    && differenceSummary?.material === false;
  const hasPersistedOutput = hasMaterialPath || Boolean(candidateBatch);
  const pathOptions = noMaterialDifference
    ? []
    : candidateBatch
    ? candidateBatch.candidates.map((candidate) => ({
          ...buildStudentSafeCandidatePathOption(candidate.snapshot),
          candidateId: candidate.id,
        }))
    : hasPersistablePath
      ? buildStudentSafePathOptions(plan).map((option) => ({
          ...option,
          candidateId: null,
        }))
      : [];
  const fallbackReasons = uniqueStringList([
    ...plan.explanations.fallbackReasons,
    ...(plan.policyBundle?.fallbackReasons ?? []),
  ]);
  const singleOptionDiversityUnavailable = pathOptions.length === 1
    && fallbackReasons.includes('policy-option-diversity-unavailable');
  return {
    operation,
    scope: toolScope,
    generationStatus: noMaterialDifference
      ? 'no_material_difference'
      : hasPersistedOutput ? 'persisted' : 'blocked',
    request: {
      requestedTimeBudgetMinutes: args.timeBudgetMinutes ?? null,
      effectiveTimeBudgetMinutes: timeBudget.effectiveMinutes,
      timeBudgetAdjusted: timeBudget.adjusted,
      minimumTimeBudgetMinutes: timeBudget.minimumMinutes,
      timeBudgetInsufficient: timeBudget.insufficient,
      difficultyRhythm,
      resourcePreference: resourcePreferences,
      resourcePreferenceSource,
      checkpointPreference,
      allowExternalResources,
      graphNodeId: args.graphNodeId ?? null,
      intentSummary: summarizeStudentIntent(args.naturalLanguageIntent),
      excludedNodeIds: args.excludedNodeIds ?? [],
      preferredStyleId: args.preferredStyleId ?? null,
      requestedAt: args.requestedAt ?? null,
    },
    pathId: candidateBatch?.sourcePathId ?? (hasPersistedOutput ? persistedPlan.id : null),
    candidateBatch: candidateBatch ? {
      id: candidateBatch.id,
      generationRequestId: candidateBatch.generationRequestId,
      candidateIds: candidateBatch.candidates.map((candidate) => candidate.id),
    } : null,
    pathOptions,
    configurationFulfillment: plan.explanations.configurationFulfillment.map(
      toStudentConfigurationFulfillment,
    ),
    comparison: {
      optionCount: pathOptions.length,
      message: noMaterialDifference
        ? '调整后的方案与原候选没有实质差异，请修改调整条件后重试。'
        : hasPersistablePath
        ? singleOptionDiversityUnavailable
          ? '当前资源只能形成单一推荐方案。'
          : '已根据你的学习证据生成可比较的路径方案。'
        : buildBlockedAdaptivePathGenerationMessage(fallbackReasons),
    },
    limitations: uniqueStringList([
      ...fallbackReasons,
      ...candidatePoolLimitationCodes,
      ...(noMaterialDifference ? ['no-material-difference'] : []),
    ]),
    candidatePoolLimited,
    diagnostics: {
      candidatePool: candidatePoolDiagnostics,
    },
    studentSafeRationale: [
      '路径会依据你的当前目标、学习证据和可用时间生成。',
      '证据不足时会先给出可开始的基础路径，并提示需要补充的学习记录。',
      ...(timeBudget.insufficient ? [`当前学习时长不足以覆盖必需验证，至少需要 ${timeBudget.minimumMinutes} 分钟。`] : []),
    ],
  };
}

async function resolveAdaptivePathAdjustmentSource(
  input: KonlingToolRuntimeInput,
  goalId: string,
  args: z.infer<typeof reviseLearningPathOptionsParameters>,
) {
  const batch = await readAdaptivePathCandidateBatch(input.db as any, args.sourceBatchId);
  if (!batch) {
    throw new KonlingRuntimeScopeError(404, '调整基线候选不存在，请刷新后重试。');
  }
  if (
    batch.userId !== input.scope.targetUserId ||
    batch.goalId !== goalId ||
    (input.scope.classId && batch.classId !== input.scope.classId)
  ) {
    throw new KonlingRuntimeScopeError(403, '调整基线候选不属于当前学习范围。');
  }
  const candidate = batch.candidates.find((item) => item.id === args.sourceCandidateId);
  if (!candidate) {
    throw new KonlingRuntimeScopeError(404, '调整基线候选不属于指定批次。');
  }
  if (candidate.fingerprint !== args.sourceCandidateFingerprint) {
    throw new KonlingRuntimeScopeError(409, '候选路径版本已更新，请刷新后重新调整。');
  }
  const progressVersion = input.context.planContext?.progressVersion;
  if (!progressVersion || progressVersion !== args.activeProgressVersion) {
    throw new KonlingRuntimeScopeError(409, '学习路径进度已更新，请基于最新进度重新调整。');
  }
  return { batch, candidate };
}

async function assertAdaptivePathAdjustmentProgressStillCurrent(
  input: KonlingToolRuntimeInput,
  goalId: string,
  args: z.infer<typeof reviseLearningPathOptionsParameters>,
  db: unknown = input.db,
) {
  const pathId = args.pathId ?? input.context.planContext?.currentPathId;
  if (!pathId) {
    throw new KonlingRuntimeScopeError(409, '当前学习路径不存在，请刷新后重新调整。');
  }
  const current = await (db as any).learningPath?.findFirst?.({
    where: {
      id: pathId,
      userId: input.scope.targetUserId,
      goalId,
      ...(input.scope.classId ? { classId: input.scope.classId } : {}),
    },
    select: { updatedAt: true },
  });
  const currentVersion = current?.updatedAt instanceof Date
    ? current.updatedAt.toISOString()
    : typeof current?.updatedAt === 'string' ? current.updatedAt : '';
  if (!currentVersion || currentVersion !== args.activeProgressVersion) {
    throw new KonlingRuntimeScopeError(409, '学习路径进度已更新，请基于最新进度重新调整。');
  }
}

function toStudentConfigurationFulfillment(
  fulfillment: AdaptiveLearningPathPlan['explanations']['configurationFulfillment'][number],
) {
  return {
    key: fulfillment.key,
    status: fulfillment.status,
    source: fulfillment.source,
    effect: fulfillment.effect,
    message: fulfillment.message,
  };
}

function buildBlockedAdaptivePathGenerationMessage(fallbackReasons: readonly string[]): string {
  if (fallbackReasons.includes('learning-goal-baseline-incomplete')) {
    return '当前目标缺少已审核的基线资源，暂不能生成可执行学习路径。';
  }
  if (fallbackReasons.includes('learning-goal-assessment-coverage-incomplete')) {
    return '当前目标缺少已审核的评估题目覆盖，暂不能生成可执行学习路径。';
  }
  if (fallbackReasons.includes('time-budget-insufficient')) {
    return '当前时间预算不足以生成可执行学习路径，请增加学习时长或减少限制条件。';
  }
  if (fallbackReasons.includes('resource-mapping-insufficient') || fallbackReasons.includes('feasible-goal-path-missing')) {
    return '当前目标缺少可用的路径资源映射，暂不能生成可执行学习路径。';
  }
  return '当前限制条件下暂不能生成可执行学习路径，请调整目标、时间或资源偏好后重试。';
}

function uniqueStringList(values: readonly string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

function isMissingFileError(error: unknown): boolean {
  return Boolean(error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT');
}

function buildAdaptivePathPlannerGraphContext(
  graphContext: KonlingKaqGraphContext | null | undefined,
  goalId: string,
  graphNodeId?: string | null,
): AdaptiveLearningPathGraphContextInput | undefined {
  if (!graphContext?.learningGoal || !graphContext.expandedSubgraph) return undefined;
  if (graphContext.learningGoal.id !== goalId) return undefined;
  const expandedSubgraph = expandLearningGoalSubgraph(graphContext.learningGoal.id);
  return {
    learningGoalId: graphContext.learningGoal.id,
    learningGoalVersion: graphContext.learningGoal.version,
    objectiveBoundary: graphContext.learningGoal.objectiveBoundary,
    expandedSubgraph,
    selectedGraphNodeIds: normalizeAdaptivePathSelectedGraphNodeIds([
      ...graphContext.selectedGraphNodeIds,
      ...(graphNodeId ? [graphNodeId] : []),
    ], expandedSubgraph),
    resourceCoverage: graphContext.resourceCoverage,
    learnerOverlay: graphContext.learnerOverlay,
    classOverlay: graphContext.classOverlay,
    learningGoalBaseline: getLearningGoalResourceBaselineForPlanner(graphContext.learningGoal.id),
    assessmentCoverage: getLearningGoalAssessmentCoverageForPlanner(graphContext.learningGoal.id),
    versionRefs: graphContext.versionRefs ?? undefined,
  };
}

function normalizeAdaptivePathSelectedGraphNodeIds(
  selectedGraphNodeIds: string[],
  expandedSubgraph: ReturnType<typeof expandLearningGoalSubgraph>,
): string[] {
  const allowed = new Set([
    ...expandedSubgraph.graphNodeIds.knowledge,
    ...expandedSubgraph.graphNodeIds.capability,
    ...expandedSubgraph.graphNodeIds.quality,
  ]);
  return Array.from(new Set(selectedGraphNodeIds.filter((nodeId) => allowed.has(nodeId)))).sort();
}

function buildAdaptivePathRevisionPlannerPreference(
  args: z.infer<typeof generateLearningPathParameters> | z.infer<typeof reviseLearningPathOptionsParameters>,
  registeredGoal: NonNullable<ReturnType<typeof getRegisteredAdaptiveLearningPathGoal>>,
): Pick<Parameters<typeof planLearningPath>[0], 'policyFamily' | 'policyBundle'> {
  if (!('rejectedStyleIds' in args)) return {};
  const preferredFamily = adaptivePathPolicyFamilyFromStyleId(args.preferredStyleId ?? args.selectedStyleId ?? null);
  const rejectedFamilies = new Set((args.rejectedStyleIds ?? [])
    .map((styleId) => adaptivePathPolicyFamilyFromStyleId(styleId))
    .filter((family): family is AdaptiveLearningPathPolicyFamily => Boolean(family)));
  const candidateFamilies = [
    preferredFamily,
    ...registeredGoal.starterPathPolicy.policyFamilies,
    'sprint-correction',
  ].filter((family): family is AdaptiveLearningPathPolicyFamily => Boolean(family));
  const families = Array.from(new Set(candidateFamilies.filter((family) => (
    family === preferredFamily || !rejectedFamilies.has(family)
  )))).slice(0, registeredGoal.starterPathPolicy.targetOptionCount);
  if (!preferredFamily && rejectedFamilies.size === 0) return {};
  return {
    policyFamily: preferredFamily ?? families[0] ?? 'rules-plus-graph-search',
    policyBundle: families.length > 0
      ? { families, overlapThreshold: 0.6 }
      : undefined,
  };
}

function buildAdaptivePathGenerationPlannerPreference(
  registeredGoal: NonNullable<ReturnType<typeof getRegisteredAdaptiveLearningPathGoal>>,
): Pick<Parameters<typeof planLearningPath>[0], 'policyBundle'> {
  return {
    policyBundle: {
      families: registeredGoal.starterPathPolicy.policyFamilies,
      overlapThreshold: 0.6,
    },
  };
}

function adaptivePathPolicyFamilyFromStyleId(styleId: string | null | undefined): AdaptiveLearningPathPolicyFamily | null {
  if (!styleId) return null;
  if (styleId === 'foundation-remediation') return 'foundation-remediation';
  if (styleId === 'arena-simulation-sprint' || styleId === 'simulation-driven') return 'simulation-driven';
  if (styleId === 'preference-matched-route' || styleId === 'preference-matched') return 'preference-matched';
  if (styleId === 'sprint-correction-route' || styleId === 'sprint-correction') return 'sprint-correction';
  if (styleId === 'teacher-assigned-route' || styleId === 'teacher-assigned') return 'teacher-assigned';
  if (styleId === 'rules-graph-search-route' || styleId === 'rules-plus-graph-search') return 'rules-plus-graph-search';
  return null;
}

function resolveAdaptivePathPlanningBudget(
  registeredGoal: NonNullable<ReturnType<typeof getRegisteredAdaptiveLearningPathGoal>>,
) {
  return registeredGoal.checkpointPolicy.requiresTerminalValidation ? 90 : 45;
}

function resolveAdaptivePathTimeBudget(
  requestedMinutes: number | undefined,
  plan: AdaptiveLearningPathPlan,
  planningBudgetMinutes: number,
) {
  const minimumMinutes = deriveMinimumExecutableDurationMinutes(plan);
  const insufficient = typeof requestedMinutes === 'number' &&
    minimumMinutes !== null &&
    requestedMinutes < minimumMinutes;
  return {
    effectiveMinutes: requestedMinutes ?? planningBudgetMinutes,
    minimumMinutes,
    insufficient,
    adjusted: false,
  };
}

function deriveMinimumExecutableDurationMinutes(plan: AdaptiveLearningPathPlan): number | null {
  const repairFoundInsufficientBudget = plan.constraintRepair?.infeasibleReasons
    .some((reason) => reason.code === 'time-budget-insufficient') ?? false;
  if (plan.mainPath.length === 0 && !repairFoundInsufficientBudget) return null;
  const repairedMinimum = plan.constraintRepair?.minimumExecutableDurationMinutes;
  if (typeof repairedMinimum === 'number' && Number.isFinite(repairedMinimum)) {
    return Math.max(0, Math.ceil(repairedMinimum));
  }
  const remaining = plan.mainPath.reduce((sum, node) =>
    sum + (node.status === 'completed' ? 0 : node.estimatedTimeMinutes), 0);
  return Number.isFinite(remaining) ? Math.max(0, Math.ceil(remaining)) : null;
}

interface AdaptivePathIntentMapping {
  resourcePreferences: ResourceNode['type'][];
  difficultyRhythm?: 'gentle' | 'steady' | 'challenge';
  checkpointPreference?: 'light' | 'standard' | 'dense';
  allowExternalResources?: boolean;
  /** Canonical values passed to the planner as mapping evidence. */
  matchedTerms: string[];
  /** Source words matched in the learner's text, used only for clause consumption. */
  matchedSourceTerms: string[];
  conflictDimensions: Array<'difficulty' | 'checkpoint' | 'external-resource'>;
  limitationCode?: string;
}

export function mapAdaptivePathNaturalLanguageIntent(intent?: string | null): AdaptivePathIntentMapping {
  const value = typeof intent === 'string' ? intent.trim().toLowerCase() : '';
  if (!value) {
    return { resourcePreferences: [], matchedTerms: [], matchedSourceTerms: [], conflictDimensions: [] };
  }
  const resourceMappings: Array<{ type: ResourceNode['type']; terms: string[] }> = [
    { type: 'knowledge_card', terms: ['知识卡', '知识卡片'] },
    { type: 'textbook_section', terms: ['教材', '课本', '参考章节'] },
    { type: 'lesson_step', terms: ['互动课', '课程步骤'] },
    { type: 'quiz', terms: ['测验', '小测'] },
    { type: 'adaptive_quiz', terms: ['自适应测验', '诊断测验'] },
    { type: 'simulation', terms: ['仿真', 'simulation'] },
    { type: 'arena_task', terms: ['arena', '竞技场', '挑战任务'] },
    { type: 'control_workbench', terms: ['工作台', 'control workbench'] },
    { type: 'reflection', terms: ['反思', '复盘'] },
  ];
  const matchedTerms: string[] = [];
  const matchedSourceTerms: string[] = [];
  const intentClauses = value
    .split(/[，。、；：；,.!:;?？\n]+/)
    .map((clause) => clause.trim())
    .filter((clause) => clause.length > 0);
  const hasPositiveTerm = (term: string, negationPrefixes: string[]) => intentClauses.some((clause) => {
    let offset = 0;
    while (offset < clause.length) {
      const index = clause.indexOf(term, offset);
      if (index < 0) return false;
      const negated = negationPrefixes.some((prefix) =>
        clause.slice(Math.max(0, index - prefix.length), index) === prefix
      );
      if (!negated) return true;
      offset = index + term.length;
    }
    return false;
  });
  const resourcePreferences = resourceMappings.flatMap(({ type, terms }) => {
    const matched = terms.filter((term) => value.includes(term));
    if (matched.length > 0) {
      matchedTerms.push(type);
      matchedSourceTerms.push(...matched);
    }
    return matched.length > 0 ? [type] : [];
  });
  const difficultyNegationPrefixes = ['不要'];
  const difficultySourceTerms = ['挑战', '高难', '轻松', '循序', '基础'].filter((term) => value.includes(term));
  const challengeTerms = ['挑战', '高难'].filter((term) => hasPositiveTerm(term, difficultyNegationPrefixes));
  const gentleTerms = ['轻松', '循序', '基础'].filter((term) => hasPositiveTerm(term, difficultyNegationPrefixes));
  const difficultyConflict = challengeTerms.length > 0 && gentleTerms.length > 0;
  const difficultyRhythm = difficultyConflict
    ? undefined
    : challengeTerms.length > 0
    ? 'challenge'
    : gentleTerms.length > 0
      ? 'gentle'
      : undefined;
  if (difficultyConflict) {
    matchedSourceTerms.push(...difficultySourceTerms);
  } else if (difficultyRhythm) {
    matchedTerms.push(difficultyRhythm);
    matchedSourceTerms.push(...difficultySourceTerms);
  }
  const checkpointSourceTerms = ['密集检查', '多检查点', '少检查', '轻量检查']
    .filter((term) => value.includes(term));
  const checkpointNegationPrefixes = ['不要'];
  const denseCheckpointTerms = ['密集检查', '多检查点'].filter((term) => hasPositiveTerm(term, checkpointNegationPrefixes));
  const lightCheckpointTerms = ['少检查', '轻量检查'].filter((term) => hasPositiveTerm(term, checkpointNegationPrefixes));
  const checkpointConflict = denseCheckpointTerms.length > 0 && lightCheckpointTerms.length > 0;
  const checkpointPreference = checkpointConflict
    ? undefined
    : denseCheckpointTerms.length > 0
    ? 'dense'
    : lightCheckpointTerms.length > 0
      ? 'light'
      : undefined;
  if (checkpointConflict) {
    matchedSourceTerms.push(...checkpointSourceTerms);
  } else if (checkpointPreference) {
    matchedTerms.push(checkpointPreference);
    matchedSourceTerms.push(...checkpointSourceTerms);
  }
  const externalResourceNegationPrefixes = ['不要使用', '不使用', '不允许', '禁止使用', '不要'];
  const denyExternalResourceTerms = [
    '不使用外部',
    '不要外部',
    '不要使用外部',
    '不允许外部',
    '禁止使用外部',
  ].filter((term) => value.includes(term));
  const allowExternalResourceTerms = ['外部资源', '参考资料', '外部链接']
    .filter((term) => hasPositiveTerm(term, externalResourceNegationPrefixes));
  const externalResourceConflict = denyExternalResourceTerms.length > 0 && allowExternalResourceTerms.length > 0;
  const allowExternalResources = externalResourceConflict
    ? undefined
    : denyExternalResourceTerms.length > 0
    ? false
    : allowExternalResourceTerms.length > 0
      ? true
      : undefined;
  if (externalResourceConflict) {
    matchedSourceTerms.push(...denyExternalResourceTerms, ...allowExternalResourceTerms);
  } else if (allowExternalResources !== undefined) {
    matchedTerms.push('external-resources');
    matchedSourceTerms.push(...(allowExternalResources ? allowExternalResourceTerms : denyExternalResourceTerms));
  }
  const uniqueMatchedTerms = Array.from(new Set(matchedTerms));
  const uniqueMatchedSourceTerms = Array.from(new Set(matchedSourceTerms));
  const hasUnconsumedClause = detectUnconsumedIntentClauses(value, uniqueMatchedSourceTerms);
  const conflictDimensions: AdaptivePathIntentMapping['conflictDimensions'] = [];
  if (difficultyConflict) conflictDimensions.push('difficulty');
  if (checkpointConflict) conflictDimensions.push('checkpoint');
  if (externalResourceConflict) conflictDimensions.push('external-resource');
  const result = {
    resourcePreferences: Array.from(new Set(resourcePreferences)),
    difficultyRhythm,
    checkpointPreference,
    allowExternalResources,
    matchedTerms: uniqueMatchedTerms,
    matchedSourceTerms: uniqueMatchedSourceTerms,
    conflictDimensions,
    ...(conflictDimensions.length > 0
      ? { limitationCode: 'natural-language-intent-conflict' }
      : uniqueMatchedTerms.length === 0
      ? { limitationCode: 'natural-language-intent-unsupported' }
      : hasUnconsumedClause
        ? { limitationCode: 'natural-language-intent-partially-unmapped' }
        : {}
    ),
  } satisfies AdaptivePathIntentMapping;
  return result;
}
/**
 * Detect whether the intent text contains sub-clauses (separated by punctuation)
 * that have no consumed mapping terms. When some terms match but other sub-clauses
 * remain unmapped, the intent is only partially actionable.
 */
function detectUnconsumedIntentClauses(value: string, matchedSourceTerms: string[]): boolean {
  const clauses = value
    .split(/[，。、；：；,.!:;?？\n]+/)
    .map((c) => c.trim())
    .filter((c) => c.length > 0);
  const unconsumedClauses = clauses.filter((clause) =>
    !matchedSourceTerms.some((term) => clause.includes(term))
  );
  return unconsumedClauses.length > 0;
}

function buildColdStartAdaptivePathLearnerState(knowledgeTargets: string[]): AdaptiveLearningPathLearnerState {
  const tags = Object.fromEntries(knowledgeTargets.map((target) => [target, {
    posteriorMastery: 0.35,
    confidence: 0.25,
    evidenceCount: 0,
  }]));
  return {
    knowledgeMastery: {
      tags,
    },
    primaryPortraitState: 'NO_EVIDENCE',
    primaryPortraitAvailability: 'no-eligible-evidence',
    evidence: {
      confidence: {
        level: 'low',
        score: 0.25,
        evidenceCount: 0,
        sourceCompleteness: 0.2,
      },
      sourceCoverage: {
        knowledgeMastery: 'partial',
      },
    },
    resourcePreference: {
      preferredModalities: [],
    },
    risks: {
      riskLevel: 'low',
      activeFlags: [],
    },
  };
}

function normalizeAdaptivePathLearnerStateForPlanner(
  learnerState: AdaptiveLearnerState | null | undefined,
): AdaptiveLearningPathLearnerState | null {
  if (!learnerState) return null;
  const vector = learnerState.primaryCompetencies?.vector ?? {};
  return {
    ...learnerState,
    primaryPortraitState: learnerState.primaryPortraitState,
    primaryPortraitAvailability: learnerState.primaryPortraitAvailability,
    primaryCompetencies: {
      ...learnerState.primaryCompetencies,
      vector: Object.fromEntries(Object.entries(vector).map(([key, value]) => [
        key,
        {
          ...value,
          score: normalizePlannerScore(value?.score),
        },
      ])),
    },
  } as AdaptiveLearningPathLearnerState;
}

function normalizePlannerScore(value: unknown) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0;
  if (value > 1) return Math.max(0, Math.min(1, value / 100));
  return Math.max(0, Math.min(1, value));
}

// #1985：画像偏好层门槛——治理证据总量达到该值且画像可用时才以 profile 来源生效。
const ADAPTIVE_PATH_PORTRAIT_RESOURCE_PREFERENCE_MIN_EVIDENCE = 3;

// learner-state 偏好模态（factTypeToModality）→ 规划器资源类型；path_choice resourceMix
// 键本身已是规划器资源类型，经 normalize 过滤后原样保留。
const ADAPTIVE_PATH_PORTRAIT_MODALITY_RESOURCE_TYPES: Record<string, AdaptiveLearningPathPlanNode['type'][]> = {
  assessment: ['adaptive_quiz'],
  media: ['video'],
  simulation: ['simulation'],
  arena: ['arena_task'],
  reflection: ['reflection'],
  'ai-collaboration': ['konling'],
  ai: ['konling'],
  konling: ['konling'],
  resource: ['handout'],
};

function resolveAdaptivePathPortraitResourcePreference(
  learnerState: AdaptiveLearnerState | null | undefined,
): AdaptiveLearningPathPlanNode['type'][] | undefined {
  if (!learnerState || learnerState.primaryPortraitState === 'UNAVAILABLE') return undefined;
  const preference = learnerState.resourcePreference;
  if (!preference || preference.confidence === 'none') return undefined;
  const evidenceCount = Object.values(preference.sourceCounts ?? {})
    .reduce((sum, count) => sum + (typeof count === 'number' && Number.isFinite(count) && count > 0 ? count : 0), 0);
  if (evidenceCount < ADAPTIVE_PATH_PORTRAIT_RESOURCE_PREFERENCE_MIN_EVIDENCE) return undefined;
  const mapped = normalizeAdaptivePathResourcePreferences(Array.from(new Set(preference.preferredModalities.flatMap((modality) => (
    ADAPTIVE_PATH_PORTRAIT_MODALITY_RESOURCE_TYPES[modality] ?? [modality]
  )))));
  return mapped && mapped.length > 0 ? mapped : undefined;
}

function normalizeAdaptivePathResourcePreferences(value: string[] | undefined): AdaptiveLearningPathPlanNode['type'][] | undefined {
  if (!value) return undefined;
  if (value.length === 0) return [];
  const allowed = new Set<AdaptiveLearningPathPlanNode['type']>([
    'lesson_step',
    'knowledge_node',
    'knowledge_card',
    'textbook_section',
    'video',
    'audio',
    'handout',
    'quiz',
    'adaptive_quiz',
    'control_workbench',
    'simulation',
    'arena_task',
    'external_resource',
    'checkpoint',
    'ai_intervention',
    'konling',
    'reflection',
    'project',
  ]);
  return value.filter((item): item is AdaptiveLearningPathPlanNode['type'] =>
    allowed.has(item as AdaptiveLearningPathPlanNode['type']));
}

export function buildStudentSafePathOptions(plan: AdaptiveLearningPathPlan) {
  if (plan.policyBundle?.paths.length) {
    return plan.policyBundle.paths
      .filter((path) => Array.isArray(path.nodeIds) && path.nodeIds.length > 0)
      .map((path, index) => ({
        optionId: `path-option-${index + 1}`,
        styleId: path.styleId,
        label: path.label,
        estimatedMinutes: path.effort.estimatedMinutes,
        effort: path.effort.relative,
        nodeSummaries: path.nodeSummaries.map((node) => ({
          nodeId: node.nodeId,
          title: node.title,
          resourceType: node.pathNodeType,
          estimatedTimeMinutes: node.estimatedTimeMinutes,
          knowledgeCoverage: [],
        })),
        targetDeficits: path.targetDeficits.map((target) => target.targetId),
        evidenceBasis: buildStudentSafeEvidenceBasis(path.evidenceBasis),
        lockedNodeIds: path.lockedNodeIds,
        readinessSummary: path.readinessSummary,
        limitations: path.limitations,
        terminalValidation: path.terminalValidationStrategy.nodeIds.length > 0
          ? {
              required: true,
              nodeIds: path.terminalValidationStrategy.nodeIds,
            }
          : { required: false, nodeIds: [] },
      }));
  }
  const estimatedMinutes = plan.mainPath.reduce((sum, node) => sum + node.estimatedTimeMinutes, 0);
  return [{
    styleId: 'recommended',
    label: '推荐学习路径',
    estimatedMinutes,
    nodeSummaries: plan.mainPath.map((node) => ({
      nodeId: node.nodeId,
      title: node.title,
      resourceType: node.type,
      estimatedTimeMinutes: node.estimatedTimeMinutes,
      knowledgeCoverage: node.knowledgeCoverage,
    })),
    targetDeficits: plan.goal.knowledgeTargets,
    evidenceBasis: plan.confidence.level === 'low'
      ? ['当前证据较少，路径会从基础资源开始。']
      : ['路径已结合你的近期学习证据。'],
    lockedNodeIds: plan.mainPath
      .filter((node) => node.readiness?.state !== 'ready')
      .map((node) => node.nodeId),
    readinessSummary: plan.mainPath.map((node) => ({
      nodeId: node.nodeId,
      state: node.readiness?.state ?? 'unknown',
      message: node.readiness?.message ?? '准备条件待确认。',
    })),
    limitations: plan.status === 'fallback'
      ? ['当前可用证据或资源不足，建议先完成基础节点。']
      : [],
  }];
}

function buildStudentSafeCandidatePathOption(snapshot: Record<string, unknown>) {
  const optionId = typeof snapshot.optionId === 'string' ? snapshot.optionId : null;
  const styleId = typeof snapshot.styleId === 'string' ? snapshot.styleId : null;
  const label = typeof snapshot.label === 'string' ? snapshot.label : null;
  const effort = snapshot.effort && typeof snapshot.effort === 'object'
    ? snapshot.effort as Record<string, unknown>
    : {};
  const nodeSummaries = Array.isArray(snapshot.nodeSummaries) ? snapshot.nodeSummaries : [];
  const targetDeficits = Array.isArray(snapshot.targetDeficits) ? snapshot.targetDeficits : [];
  const terminalValidationStrategy = snapshot.terminalValidationStrategy
    && typeof snapshot.terminalValidationStrategy === 'object'
    ? snapshot.terminalValidationStrategy as Record<string, unknown>
    : {};
  const terminalNodeIds = Array.isArray(terminalValidationStrategy.nodeIds)
    ? terminalValidationStrategy.nodeIds.filter((value): value is string => typeof value === 'string')
    : [];
  return {
    optionId,
    styleId,
    label,
    estimatedMinutes: typeof effort.estimatedMinutes === 'number' ? effort.estimatedMinutes : null,
    effort: typeof effort.relative === 'string' ? effort.relative : null,
    nodeSummaries: nodeSummaries.map((value) => {
      const node = value && typeof value === 'object' ? value as Record<string, unknown> : {};
      return {
        nodeId: typeof node.nodeId === 'string' ? node.nodeId : null,
        title: typeof node.title === 'string' ? node.title : null,
        resourceType: typeof node.pathNodeType === 'string' ? node.pathNodeType : null,
        estimatedTimeMinutes: typeof node.estimatedTimeMinutes === 'number' ? node.estimatedTimeMinutes : null,
        knowledgeCoverage: [],
      };
    }),
    targetDeficits: targetDeficits.flatMap((value) => {
      if (!value || typeof value !== 'object') return [];
      const targetId = (value as Record<string, unknown>).targetId;
      return typeof targetId === 'string' ? [targetId] : [];
    }),
    evidenceBasis: buildStudentSafeEvidenceBasis(
      Array.isArray(snapshot.evidenceBasis)
        ? snapshot.evidenceBasis.filter((value): value is string => typeof value === 'string')
        : [],
    ),
    lockedNodeIds: Array.isArray(snapshot.lockedNodeIds) ? snapshot.lockedNodeIds : [],
    readinessSummary: Array.isArray(snapshot.readinessSummary) ? snapshot.readinessSummary : [],
    limitations: Array.isArray(snapshot.limitations) ? snapshot.limitations : [],
    terminalValidation: {
      required: terminalNodeIds.length > 0,
      nodeIds: terminalNodeIds,
    },
  };
}

function buildStudentSafeEvidenceBasis(values: string[]) {
  const labels = new Set<string>();
  for (const value of values) {
    if (/path|execution/i.test(value)) {
      labels.add('已参考学习路径进度。');
    } else if (/learner|mastery|evidence|state/i.test(value)) {
      labels.add('已参考当前学习记录。');
    } else {
      labels.add('已参考可用学习资源。');
    }
  }
  return [...labels];
}

function buildPathResourceMix(nodes: AdaptiveLearningPathPlanNode[]) {
  return nodes.reduce<Record<string, number>>((mix, node) => {
    mix[node.type] = (mix[node.type] ?? 0) + 1;
    return mix;
  }, {});
}

async function buildAdaptivePathCandidateSelectionOutput(
  input: KonlingToolRuntimeInput,
  args: z.infer<typeof selectLearningPathParameters>,
  toolRunId: string | null,
) {
  if (!args.candidateId && !args.naturalLanguageIntent?.trim()) {
    throw new KonlingRuntimeScopeError(400, '选择候选路径需要稳定候选身份或学生原话。');
  }
  const goalId = resolveScopedAdaptivePathGoalId(input, args.goalId);
  const authorizedBatch = (input.context as KonlingRuntimeContext & {
    teachingAssistantMode?: KonlingTeachingAssistantRuntimeContract;
  }).teachingAssistantMode?.authorizedCandidateBatch;
  const batch = await readAdaptivePathCandidateBatch(input.db as any, args.batchId);
  if (
    !batch
    || !authorizedBatch
    || authorizedBatch.batchId !== batch.id
    || authorizedBatch.pathId !== batch.sourcePathId
    || authorizedBatch.goalId !== goalId
    || authorizedBatch.classId !== (input.scope.classId ?? null)
    || batch.userId !== input.scope.targetUserId
    || batch.goalId !== goalId
    || batch.classId !== (input.scope.classId ?? null)
    || (args.pathId ?? authorizedBatch.pathId) !== batch.sourcePathId
  ) {
    return { status: 'unavailable' as const };
  }
  const resolution = resolveAdaptivePathCandidateSelection(batch, args);
  if (resolution.status !== 'selected') return resolution;
  const snapshot = resolution.candidate.snapshot;
  const selectedOptionId = getString(snapshot, 'optionId');
  const selectedStyleId = getString(snapshot, 'styleId');
  if (!selectedOptionId || selectedStyleId !== resolution.candidate.styleId) {
    return { status: 'unavailable' as const };
  }
  if (!toolRunId) {
    throw new KonlingRuntimeScopeError(403, 'Candidate selection requires an AgentToolRun');
  }
  const selectionResult = {
    toolRunId,
    actorUserId: input.scope.authenticatedUserId,
    targetUserId: input.scope.targetUserId,
    batchId: batch.id,
    candidateId: resolution.candidate.id,
    pathId: batch.sourcePathId,
    goalId,
    selectedOptionId,
    selectedStyleId,
    idempotencyKey: args.idempotencyKey,
    studentSafeRationale: `已确认选择“${resolution.candidate.label}”，正在同步到路径中心。`,
  };
  await bindKonlingCandidateSelectionToolRun(input.db as any, selectionResult);
  return {
    ...buildKonlingCandidateSelectionToolResult(selectionResult),
    status: 'pending_commit' as const,
  };
}

async function buildAdaptivePathToolOutcome(
  input: KonlingToolRuntimeInput,
  outcome: string,
  args: z.infer<typeof rejectLearningPathOptionParameters> | z.infer<typeof recordPathAdjustmentOutcomeParameters>,
) {
  const goalId = resolveScopedAdaptivePathGoalId(input, args.goalId);
  const pathId = args.pathId ?? input.context.planContext?.currentPathId ?? null;
  if (!pathId) {
    throw new KonlingRuntimeScopeError(400, '记录路径反馈需要有效的学习路径。');
  }
  const path = await assertScopedAdaptivePathToolPath(input, pathId, { goalId, requirePath: true, requireExisting: true });
  const activity = {
    selectedStyleId: 'selectedStyleId' in args ? args.selectedStyleId ?? null : null,
    rejectedStyleIds: 'rejectedStyleIds' in args
      ? args.rejectedStyleIds ?? []
      : 'rejectedStyleId' in args ? [args.rejectedStyleId] : [],
    helpful: helpfulFromPathAdjustmentOutcome(outcome),
  };
  const selectedOption = activity.selectedStyleId
    ? readStoredAdaptivePathOptions(readRecord(getValue(path, 'pathPayload'))).get(activity.selectedStyleId) ?? null
    : null;
  const action = resolveAdaptivePathChoiceAction(outcome, activity.helpful);
  const evidence = await recordPathChoiceEvidence(input.db as any, {
    pathId,
    userId: input.scope.targetUserId,
    goalId,
    action,
    selectedStyleId: activity.selectedStyleId,
    selectedPolicyFamily: selectedOption?.policyFamily ?? null,
    rejectedStyleIds: activity.rejectedStyleIds,
    diagnosisSnapshotRef: resolveAdaptivePathDiagnosisSnapshotRef(path),
    resourceMix: selectedOption?.resourceMix ?? {},
    helpful: activity.helpful,
    rationaleMetadata: {
      ...(selectedOption?.rationaleMetadata ?? {}),
      outcome,
      intentSummary: summarizeStudentIntent(args.naturalLanguageIntent),
      routeIntent: args.routeIntent ?? null,
    },
    idempotencyKey: args.idempotencyKey,
    actorUserId: input.scope.authenticatedUserId,
    actorRole: input.scope.role,
  });
  return {
    outcome,
    scope: buildAdaptivePathToolScope(input, goalId, pathId),
    activity,
    evidence,
    studentSafeRationale: '已记录你的路径反馈。选择记录会用于调整路径，不会被当作掌握度证据。',
  };
}

function helpfulFromPathAdjustmentOutcome(outcome: string) {
  if (outcome === 'helpful') return true;
  if (outcome === 'not-helpful') return false;
  return null;
}

function resolveAdaptivePathChoiceAction(outcome: string, helpful: boolean | null) {
  if (outcome === 'selected' || outcome === 'adopted') return 'selection' as const;
  if (outcome === 'rejected' || outcome === 'ignored') return 'rejection' as const;
  if (outcome === 'switched') return 'switch' as const;
  if (outcome === 'helpful' || outcome === 'not-helpful' || typeof helpful === 'boolean') return 'helpfulness' as const;
  return 'selection' as const;
}

async function buildAdaptivePathTradeoffOutput(
  input: KonlingToolRuntimeInput,
  args: z.infer<typeof explainLearningPathTradeoffParameters>,
) {
  const goalId = resolveScopedAdaptivePathGoalId(input, args.goalId);
  if (!args.candidateBatchId || !args.styleId || !args.compareWithStyleId || !args.comparisonKey) {
    throw new KonlingRuntimeScopeError(400, '候选路径比较必须提供完整的批次、路径和比较身份。');
  }
  if (args.styleId === args.compareWithStyleId) {
    throw new KonlingRuntimeScopeError(400, '候选路径比较不能选择同一条路径。');
  }
  const pathId = args.pathId ?? input.context.planContext?.currentPathId ?? null;
  const path = await assertScopedAdaptivePathToolPath(input, pathId, {
    goalId,
    requirePath: true,
    requireExisting: true,
  });
  if (!path) {
    throw new KonlingRuntimeScopeError(400, '解释路径差异需要有效的学习路径。');
  }
  const storedOptions = readStoredAdaptivePathOptions(
    readRecord(getValue(path, 'pathPayload')),
    { allowPolicyFallback: true },
  );
  const options = [...storedOptions.values()];
  const selectedOption = storedOptions.get(args.styleId) ?? null;
  const comparedOption = storedOptions.get(args.compareWithStyleId) ?? null;
  const candidateBatch = await readAdaptivePathCandidateBatch(input.db as any, args.candidateBatchId);
  if (
    !candidateBatch
    || candidateBatch.userId !== input.scope.targetUserId
    || candidateBatch.goalId !== goalId
    || candidateBatch.sourcePathId !== path.id
  ) {
    throw new KonlingRuntimeScopeError(403, '候选比较对象不属于当前学习路径批次。');
  }
  const comparisonAuthorization = authorizeAdaptivePathComparisonIdentity({
    candidateBatchId: candidateBatch.id,
    candidateBatchCreatedAt: candidateBatch.createdAt,
    currentPathUpdatedAt: toIsoOrNull(getValue(path, 'updatedAt')) ?? '',
    candidates: candidateBatch.candidates.map((candidate, index) => ({
      optionId: getString(readRecord(candidate.snapshot), 'optionId') || `path-option-${index + 1}`,
      styleId: candidate.styleId,
    })),
    selectedStyleId: selectedOption?.styleId,
    comparedStyleId: comparedOption?.styleId,
    requestedComparisonKey: args.comparisonKey,
  });
  if (!comparisonAuthorization.ok) {
    throw new KonlingRuntimeScopeError(
      comparisonAuthorization.reason === 'stale-path-version' ? 409 : 403,
      comparisonAuthorization.reason === 'stale-path-version'
        ? '当前学习路径已更新，请重新生成候选方案后再比较。'
        : '候选比较身份已失效，请重新选择比较对象。',
    );
  }
  const comparison = selectedOption && comparedOption && selectedOption.styleId !== comparedOption.styleId
    ? buildAdaptivePathDifferenceExplanation(path.id, selectedOption, comparedOption)
    : buildUnavailableAdaptivePathDifferenceExplanation(path.id, options);
  comparison.comparisonKey = comparisonAuthorization.comparisonKey;
  return {
    operation: 'explained',
    scope: buildAdaptivePathToolScope(input, goalId, path.id),
    styleId: selectedOption?.styleId ?? args.styleId ?? null,
    compareWithStyleId: comparedOption?.styleId ?? args.compareWithStyleId ?? null,
    comparison,
    studentSafeRationale: buildAdaptivePathDifferenceRationale(comparison),
  };
}

function resolveScopedAdaptivePathGoalId(input: KonlingToolRuntimeInput, requestedGoalId?: string | null) {
  const serverScopedGoalId = getRegisteredAdaptiveLearningPathGoal(input.scope.courseId)
    ? input.scope.courseId
    : null;
  if (requestedGoalId && serverScopedGoalId && requestedGoalId !== serverScopedGoalId) {
    throw new KonlingRuntimeScopeError(403, 'Konling 路径工具不能扩展到服务端授权目标之外。');
  }
  const goalId = requestedGoalId || serverScopedGoalId || CONTROL_CORRECTION_PATH_ROUND_GOAL_ID;
  if (!getRegisteredAdaptiveLearningPathGoal(goalId)) {
    throw new KonlingRuntimeScopeError(403, 'Konling 路径工具不能扩展到未登记的学习目标。');
  }
  return goalId;
}

async function resolveAdaptivePathGenerationRegistry(input: KonlingToolRuntimeInput, goalId: string): Promise<{
  registry: ResourceNodeRegistry;
  diagnostics: ResourceCandidatePoolDiagnostics;
}> {
  const [teachingResourcesSource, runtimeLessonsSource, runtimeTextbooksSource, runtimeResourceProjectionsSource] = await Promise.all([
    loadCandidateSourceFamily('teaching-resources', () => loadAdaptivePathTeachingResources(input.db)),
    loadCandidateSourceFamily('runtime-lessons', () => loadAllLessonRuntimeResourceCatalogEntries()),
    loadCandidateSourceFamily('runtime-textbooks', () => loadAllTextbookStructureRuntimeCatalogEntries()),
    loadCandidateSourceFamily('runtime-resource-projections', () => loadRuntimeResourceProjectionInputs({ allowMissing: false })),
  ]);
  const teachingResources = teachingResourcesSource.items;
  const runtimeLessons = runtimeLessonsSource.items;
  const runtimeTextbooks = runtimeTextbooksSource.items;
  const runtimeResourceProjections = runtimeResourceProjectionsSource.items;
  const sourceFamilies = [
    teachingResourcesSource.status,
    runtimeLessonsSource.status,
    runtimeTextbooksSource.status,
    runtimeResourceProjectionsSource.status,
  ];
  const registeredResources = getAllRegisteredResourceMetadata();
  const runtimeTextbookInput = {
    textbooks: runtimeTextbooks.map((entry) => entry.textbook),
    textbookSections: runtimeTextbooks.flatMap(toTextbookUnitNodeInputs),
  };
  const withDiagnostics = (registry: ResourceNodeRegistry) => ({
    registry,
    diagnostics: buildResourceCandidatePoolDiagnostics(registry, sourceFamilies),
  });
  const buildGenericRegistry = () => buildResourceNodeRegistryFromTeachingResources(
    teachingResources,
    registeredResources,
    runtimeLessons,
    runtimeTextbooks,
    runtimeResourceProjections,
  );
  if (goalId === CONTROL_CORRECTION_PATH_ROUND_GOAL_ID) {
    return withDiagnostics(buildGenericRegistry());
  }
  if (goalId === 'frequency-response-foundations') {
    return withDiagnostics(buildResourceNodeRegistryFromTeachingResources(
      teachingResources,
      registeredResources,
      runtimeLessons,
      runtimeTextbooks,
      runtimeResourceProjections,
      buildFrequencyResponseFoundationsResourceSeedInput(),
    ));
  }
  if (getRegisteredAdaptiveLearningPathGoal(goalId)) {
    return withDiagnostics(buildGenericRegistry());
  }
  throw new KonlingRuntimeScopeError(404, '当前学习目标未注册。');
}

async function loadCandidateSourceFamily<T>(
  family: string,
  loader: () => Promise<readonly T[]>,
): Promise<{ items: T[]; status: ResourceCandidatePoolSourceStatus }> {
  try {
    const items = [...await loader()];
    return {
      items,
      status: {
        family,
        status: items.length > 0 ? 'loaded' : 'empty',
        count: items.length,
        reason: null,
      },
    };
  } catch (error) {
    if (isMissingFileError(error)) {
      return {
        items: [],
        status: {
          family,
          status: 'missing',
          count: 0,
          reason: `missing-source-family:${family}`,
        },
      };
    }
    return {
      items: [],
      status: {
        family,
        status: 'error',
        count: 0,
        reason: `loader-error:${family}`,
      },
    };
  }
}

async function loadAdaptivePathTeachingResources(db: unknown): Promise<Array<{
  id: string;
  title: string;
  displayName: string | null;
  description: string | null;
  type: string;
  registryId: string | null;
  content: string | null;
  category: string | null;
  teacherOnly: boolean | null;
  config: unknown;
  knowledgeNodes: Array<{
    id: string;
    name: string;
    resources: unknown;
    tags: string[];
  }>;
}>> {
  const teachingResource = readRecord(db).teachingResource;
  if (!teachingResource || typeof teachingResource !== 'object') return [];
  const findMany = readRecord(teachingResource).findMany;
  if (typeof findMany !== 'function') return [];
  return await findMany({
    where: { teacherOnly: false },
    include: {
      knowledgeNodes: {
        select: {
          id: true,
          name: true,
          resources: true,
          tags: true,
        },
      },
    },
    orderBy: [{ category: 'asc' }, { displayOrder: 'asc' }, { title: 'asc' }],
  });
}

async function buildAdaptivePathSourcePackCandidates(
  registry: ResourceNodeRegistry,
): Promise<{ items: SourcePackItem[]; limitations: SourcePackLimitation[] }> {
  const resourceNodeCandidates = registry.nodes.map(buildResourceNodeSourcePackCandidate);
  const textbookAdapted = await loadAllTextbookStructureUnitProjections()
    .then((units) => units.map(adaptTextbookStructureUnit))
    .catch(() => []);
  return {
    items: [
      ...resourceNodeCandidates,
      ...textbookAdapted.map((entry) => entry.item),
    ],
    limitations: textbookAdapted.flatMap((entry) => entry.limitations),
  };
}

export function buildResourceNodeSourcePackCandidate(node: ResourceNode): SourcePackItem {
  const pathEligible = node.eligibility.pathEligible === true;
  const citationTargetId = `citation-target:${node.id}:primary`;
  const citationHref = sourcePackCitationHrefForResourceNode(node);
  const runtimeCitationReady = node.runtimeProjection?.groundingEligibility?.citationReady !== false
    && node.runtimeProjection?.runtimeSemanticEvidence?.assetStatus !== 'missing-local-runtime-asset';
  const citationVerified = runtimeCitationReady && node.planningMetadata.availability === 'available';
  return {
    id: `resource-node:${node.id}`,
    title: node.title,
    sourceKind: sourcePackSourceKindForResourceNode(node),
    modality: sourcePackModalityForResourceNode(node),
    excerpt: node.description || node.title,
    inclusionRationale: pathEligible
      ? 'Path-eligible ResourceNode from the governed adaptive planning registry.'
      : 'ResourceNode citation context without current path eligibility.',
    resourceNodeId: pathEligible ? node.id : undefined,
    planningUnitId: pathEligible ? `planning-unit:${node.id}` : undefined,
    retrievalChunkId: `resource-node:${node.id}`,
    citationTargetId,
    scores: {
      relevance: pathEligible ? 0.82 : 0.48,
      graphAlignment: node.planningMetadata.knowledgeCoverage.length > 0 ? 0.8 : 0.45,
      authority: node.planningMetadata.availability === 'available' ? 0.82 : 0.45,
      eligibility: pathEligible ? 0.9 : 0.25,
      freshness: node.runtimeProjection?.reviewAudit?.status === 'stale' ? 0.35 : 0.75,
      final: 0,
    },
    access: {
      visibility: sourcePackVisibilityForResourceNode(node),
      aiUseAllowed: node.planningMetadata.teacherPolicy !== 'blocked',
    },
    citation: {
      citationTargetId,
      sourceId: `resource-node-source:${node.id}`,
      displayTitle: node.title,
      href: citationVerified ? citationHref : undefined,
      resolver: citationVerified && citationHref ? 'course-runtime' : undefined,
      verified: citationVerified,
    },
    metadata: {
      reviewStatus: node.runtimeProjection?.reviewAudit?.status ?? 'current',
      resourceId: node.id,
      resourceIds: [node.id, node.sourceRef],
      knowledgeNodeRefs: node.planningMetadata.knowledgeCoverage,
      capabilityTargetRefs: Object.keys(node.planningMetadata.abilityImpact).sort((left, right) => left.localeCompare(right)),
      resourceType: node.type,
      sourceKind: node.sourceKind,
      pathEligible: String(pathEligible),
      teacherPolicy: node.planningMetadata.teacherPolicy,
      availability: node.planningMetadata.availability,
      citationReady: String(citationVerified),
    },
  };
}

function sourcePackCitationHrefForResourceNode(node: ResourceNode): string | undefined {
  const href = node.launchTarget ?? node.renderTarget ?? undefined;
  if (!href) return undefined;
  if (href.startsWith('/course-runtime/') || href.startsWith('/resources/') || href === '/course-runtime' || href === '/resources') {
    return href;
  }
  if (href.startsWith('#')) return href;
  return undefined;
}

function sourcePackSourceKindForResourceNode(node: ResourceNode): SourcePackSourceKind {
  if (node.type === 'textbook' || node.type === 'textbook_section' || node.sourceKind === 'textbook' || node.sourceKind === 'textbook_section') {
    return 'textbook';
  }
  if (node.type === 'quiz' || node.type === 'adaptive_quiz' || node.type === 'checkpoint') return 'exercise';
  if (node.type === 'simulation' || node.type === 'control_workbench' || node.type === 'arena_task') return 'simulation';
  if (node.type === 'external_resource') return 'reference';
  if (node.type === 'lesson_step' || node.type === 'slides' || node.type === 'handout' || node.sourceKind.startsWith('runtime_')) {
    return 'runtime-lesson';
  }
  if (node.type === 'knowledge_node' || node.type === 'knowledge_card' || node.sourceKind === 'knowledge_graph') return 'knowledge-card';
  return 'other';
}

function sourcePackModalityForResourceNode(node: ResourceNode): SourcePackModality {
  if (node.type === 'video') return 'video';
  if (node.type === 'audio') return 'audio';
  if (
    node.type === 'slides' ||
    node.type === 'simulation' ||
    node.type === 'control_workbench' ||
    node.type === 'arena_task' ||
    node.type === 'adaptive_quiz' ||
    node.type === 'checkpoint' ||
    node.type === 'konling'
  ) {
    return 'interactive';
  }
  return 'text';
}

function sourcePackVisibilityForResourceNode(node: ResourceNode): SourcePackItem['access']['visibility'] {
  if (node.planningMetadata.privacyLevel === 'student-visible') return 'student';
  if (node.planningMetadata.privacyLevel === 'teacher-scoped') return 'teacher';
  return 'admin';
}

async function assertScopedAdaptivePathToolPath(
  input: KonlingToolRuntimeInput,
  requestedPathId: string | null | undefined,
  options: { goalId: string; requirePath: boolean; requireExisting: boolean },
) {
  const currentPathId = input.context.planContext?.currentPathId ?? null;
  const knownPathIds = new Set([
    currentPathId,
    ...(input.context.planContext?.recentPathIds ?? []),
  ].filter((pathId): pathId is string => typeof pathId === 'string' && pathId.length > 0));
  if (requestedPathId && knownPathIds.size > 0 && !knownPathIds.has(requestedPathId)) {
    throw new KonlingRuntimeScopeError(403, 'Konling 路径工具不能扩展到当前学习路径之外。');
  }
  const pathId = requestedPathId ?? currentPathId;
  if (options.requirePath && !pathId) {
    throw new KonlingRuntimeScopeError(400, '当前没有可记录的学习路径。');
  }
  if (!pathId || !options.requireExisting) return;
  if (!input.db.learningPath?.findFirst) {
    throw new KonlingRuntimeScopeError(404, '学习路径存储不可用。');
  }
  const path = await input.db.learningPath.findFirst({
    where: {
      id: pathId,
      userId: input.scope.targetUserId,
      goalId: options.goalId,
      ...(input.scope.classId ? { classId: input.scope.classId } : {}),
    },
    select: { id: true, pathPayload: true, learnerStateRef: true, inputSnapshot: true, updatedAt: true },
  });
  if (!path) {
    throw new KonlingRuntimeScopeError(403, 'Konling 路径工具不能访问不属于当前学生的学习路径。');
  }
  return path;
}

interface AdaptivePathStoredOption {
  optionId: string;
  styleId: string;
  label: string;
  policyFamily: string | null;
  nodeIds: string[];
  nodeSummaries: AdaptivePathStoredNodeSummary[];
  estimatedMinutes: number | null;
  resourceMix: Record<string, number>;
  readinessSummary: Array<{
    nodeId: string;
    state: string;
    message: string;
  }>;
  lockedNodeIds: string[];
  checkpointNodeIds: string[];
  terminalValidationNodeIds: string[];
  limitations: string[];
  rationaleMetadata: Record<string, unknown>;
}

interface AdaptivePathStoredNodeSummary {
  nodeId: string;
  title: string;
  resourceType: string;
}

interface AdaptivePathDifferenceExplanation {
  status: 'ready' | 'no-material-difference' | 'insufficient-data';
  pathId: string;
  comparisonKey?: string;
  options: Array<{
    optionId: string;
    styleId: string;
    label: string;
    metrics: {
      estimatedMinutes: number | null;
      nodeCount: number;
      resourceMix: Record<string, number>;
      readiness: Record<string, number>;
      readinessSummary: Array<{
        nodeId: string;
        state: string;
        message: string;
      }>;
      checkpointCount: number;
      checkpointNodeIds: string[];
      lockedNodeCount: number;
      lockedNodeIds: string[];
      terminalValidationCount: number;
      terminalValidationNodeIds: string[];
    };
  }>;
  commonNodes: Array<AdaptivePathStoredNodeSummary & { positions: [number, number] }>;
  optionOnlyNodes: Array<{
    optionId: string;
    nodes: Array<AdaptivePathStoredNodeSummary & { position: number }>;
  }>;
  orderDifferences: Array<{
    nodeId: string;
    title: string;
    positions: [number, number];
  }>;
  tradeoffs: string[];
  limitations: string[];
}

function assertAdaptivePathOptionIds(
  path: unknown,
  selectedStyleId: string | null | undefined,
  rejectedStyleIds: string[],
  options: { allowPolicyFallback?: boolean } = {},
) {
  if (selectedStyleId && rejectedStyleIds.includes(selectedStyleId)) {
    throw new KonlingRuntimeScopeError(400, '路径选择不能同时选择并拒绝同一 styleId。');
  }
  const requestedStyleIds = [
    selectedStyleId ?? null,
    ...rejectedStyleIds,
  ].filter((styleId): styleId is string => typeof styleId === 'string' && styleId.length > 0);
  if (requestedStyleIds.length === 0) return;
  const validOptions = readStoredAdaptivePathOptions(readRecord(getValue(path, 'pathPayload')), options);
  if (validOptions.size === 0) {
    throw new KonlingRuntimeScopeError(403, '当前学习路径没有可记录的路径选项。');
  }
  if (requestedStyleIds.some((styleId) => !validOptions.has(styleId))) {
    throw new KonlingRuntimeScopeError(403, '路径选项不属于当前学习路径。');
  }
}

function readStoredAdaptivePathOptions(
  pathPayload: Record<string, unknown>,
  readOptions: { allowPolicyFallback?: boolean } = {},
) {
  const policyBundle = readRecord(getValue(pathPayload, 'policyBundle'));
  const policyBundleStatus = getString(policyBundle, 'status') || 'ready';
  const policyBundlePaths = policyBundleStatus === 'ready' || readOptions.allowPolicyFallback === true
    ? arrayOfRecords(getValue(policyBundle, 'paths'))
    : [];
  const options = policyBundlePaths.length > 0
    ? policyBundlePaths
    : arrayOfRecords(getValue(pathPayload, 'pathOptions'));
  return new Map(options
    .map((option, index): [string, AdaptivePathStoredOption] | null => {
      const styleId = getString(option, 'styleId');
      if (!styleId) return null;
      const effort = readRecord(getValue(option, 'effort'));
      const estimatedMinutesValue = getValue(effort, 'estimatedMinutes') ?? getValue(option, 'estimatedMinutes');
      const nodeSummaries = arrayOfRecords(getValue(option, 'nodeSummaries'))
        .map((summary): AdaptivePathStoredNodeSummary | null => {
          const nodeId = getString(summary, 'nodeId');
          if (!nodeId) return null;
          return {
            nodeId,
            title: getString(summary, 'title') || getString(summary, 'displayName'),
            resourceType: getString(summary, 'pathNodeType') || getString(summary, 'resourceType'),
          };
        })
        .filter((summary): summary is AdaptivePathStoredNodeSummary => Boolean(summary));
      const readinessSummary = arrayOfRecords(getValue(option, 'readinessSummary'))
        .map((readiness) => ({
          nodeId: getString(readiness, 'nodeId'),
          state: getString(readiness, 'state') || 'unknown',
          message: getString(readiness, 'message'),
        }))
        .filter((readiness) => Boolean(readiness.nodeId));
      const terminalValidationStrategy = readRecord(getValue(option, 'terminalValidationStrategy'));
      return [styleId, {
        optionId: getString(option, 'optionId') || `path-option-${index + 1}`,
        styleId,
        label: getString(option, 'label') || styleId,
        policyFamily: getString(option, 'policyFamily') || null,
        nodeIds: arrayOfStrings(getValue(option, 'nodeIds')),
        nodeSummaries,
        estimatedMinutes: typeof estimatedMinutesValue === 'number' && Number.isFinite(estimatedMinutesValue)
          ? estimatedMinutesValue
          : null,
        resourceMix: readNumberRecord(getValue(option, 'resourceMix')),
        readinessSummary,
        lockedNodeIds: arrayOfStrings(getValue(option, 'lockedNodeIds')),
        checkpointNodeIds: arrayOfStrings(getValue(option, 'checkpointNodeIds')),
        terminalValidationNodeIds: uniqueStringList([
          ...arrayOfStrings(getValue(option, 'terminalValidationNodeIds')),
          ...arrayOfStrings(getValue(terminalValidationStrategy, 'nodeIds')),
        ]),
        limitations: arrayOfStrings(getValue(option, 'limitations')),
        rationaleMetadata: buildStoredAdaptivePathOptionRationale(option),
      }];
    })
    .filter((entry): entry is [string, AdaptivePathStoredOption] => Boolean(entry)));
}

function buildAdaptivePathDifferenceExplanation(
  pathId: string,
  left: AdaptivePathStoredOption,
  right: AdaptivePathStoredOption,
): AdaptivePathDifferenceExplanation {
  const limitations = uniqueStringList([...left.limitations, ...right.limitations]);
  const missingFacts = [left, right].flatMap((option) => {
    if (option.nodeIds.length === 0) return [`${option.label}缺少有序节点。`];
    const summaries = new Map(option.nodeSummaries.map((node) => [node.nodeId, node]));
    const missingNodeIds = option.nodeIds.filter((nodeId) => {
      const summary = summaries.get(nodeId);
      return !summary?.title || !summary.resourceType;
    });
    return missingNodeIds.length > 0
      ? [`${option.label}缺少 ${missingNodeIds.length} 个节点的可靠摘要。`]
      : [];
  });
  const comparisonLimitations = uniqueStringList([...limitations, ...missingFacts]);
  const leftSummaryById = new Map(left.nodeSummaries.map((node) => [node.nodeId, node]));
  const rightSummaryById = new Map(right.nodeSummaries.map((node) => [node.nodeId, node]));
  const leftNodeIds = new Set(left.nodeIds);
  const rightNodeIds = new Set(right.nodeIds);
  const commonNodes = left.nodeIds
    .filter((nodeId) => rightNodeIds.has(nodeId))
    .map((nodeId) => ({
      ...(leftSummaryById.get(nodeId) ?? rightSummaryById.get(nodeId) ?? {
        nodeId,
        title: '',
        resourceType: '',
      }),
      positions: [left.nodeIds.indexOf(nodeId) + 1, right.nodeIds.indexOf(nodeId) + 1] as [number, number],
    }));
  const optionOnlyNodes = [left, right].map((option) => {
    const otherNodeIds = option.styleId === left.styleId ? rightNodeIds : leftNodeIds;
    const summaryById = option.styleId === left.styleId ? leftSummaryById : rightSummaryById;
    return {
      optionId: option.optionId,
      nodes: option.nodeIds
        .filter((nodeId) => !otherNodeIds.has(nodeId))
        .map((nodeId) => ({
          ...(summaryById.get(nodeId) ?? { nodeId, title: '', resourceType: '' }),
          position: option.nodeIds.indexOf(nodeId) + 1,
        })),
    };
  });
  const orderDifferences = commonNodes
    .filter((node) => node.positions[0] !== node.positions[1])
    .map((node) => ({
      nodeId: node.nodeId,
      title: node.title,
      positions: node.positions,
    }));
  const optionMetrics = [left, right].map((option) => ({
    optionId: option.optionId,
    styleId: option.styleId,
    label: option.label,
    metrics: buildAdaptivePathDifferenceMetrics(option),
  }));
  const materiallyEqual = missingFacts.length === 0
    && left.nodeIds.length === right.nodeIds.length
    && left.nodeIds.every((nodeId, index) => nodeId === right.nodeIds[index])
    && areAdaptivePathDifferenceMetricsEqual(optionMetrics[0]?.metrics, optionMetrics[1]?.metrics);
  return {
    status: missingFacts.length > 0
      ? 'insufficient-data'
      : materiallyEqual ? 'no-material-difference' : 'ready',
    pathId,
    options: optionMetrics,
    commonNodes,
    optionOnlyNodes,
    orderDifferences,
    tradeoffs: missingFacts.length > 0 ? [] : buildAdaptivePathTradeoffs(left, right),
    limitations: comparisonLimitations,
  };
}

function buildUnavailableAdaptivePathDifferenceExplanation(
  pathId: string,
  options: AdaptivePathStoredOption[],
): AdaptivePathDifferenceExplanation {
  return {
    status: 'insufficient-data',
    pathId,
    options: options.slice(0, 2).map((option) => ({
      optionId: option.optionId,
      styleId: option.styleId,
      label: option.label,
      metrics: buildAdaptivePathDifferenceMetrics(option),
    })),
    commonNodes: [],
    optionOnlyNodes: [],
    orderDifferences: [],
    tradeoffs: [],
    limitations: ['当前路径缺少两条可比较的候选方案。'],
  };
}

function buildAdaptivePathDifferenceMetrics(option: AdaptivePathStoredOption) {
  const readiness = option.readinessSummary.reduce<Record<string, number>>((counts, item) => {
    counts[item.state] = (counts[item.state] ?? 0) + 1;
    return counts;
  }, {});
  return {
    estimatedMinutes: option.estimatedMinutes,
    nodeCount: option.nodeIds.length,
    resourceMix: option.resourceMix,
    readiness,
    readinessSummary: option.readinessSummary,
    checkpointCount: option.checkpointNodeIds.length,
    checkpointNodeIds: option.checkpointNodeIds,
    lockedNodeCount: option.lockedNodeIds.length,
    lockedNodeIds: option.lockedNodeIds,
    terminalValidationCount: option.terminalValidationNodeIds.length,
    terminalValidationNodeIds: option.terminalValidationNodeIds,
  };
}

function areAdaptivePathDifferenceMetricsEqual(
  left: ReturnType<typeof buildAdaptivePathDifferenceMetrics> | undefined,
  right: ReturnType<typeof buildAdaptivePathDifferenceMetrics> | undefined,
) {
  if (!left || !right) return false;
  return left.estimatedMinutes === right.estimatedMinutes
    && left.nodeCount === right.nodeCount
    && left.checkpointCount === right.checkpointCount
    && left.lockedNodeCount === right.lockedNodeCount
    && left.terminalValidationCount === right.terminalValidationCount
    && areNumberRecordsEqual(left.resourceMix, right.resourceMix)
    && areNumberRecordsEqual(left.readiness, right.readiness)
    && areReadinessSummariesEqual(left.readinessSummary, right.readinessSummary)
    && areStringSetsEqual(left.checkpointNodeIds, right.checkpointNodeIds)
    && areStringSetsEqual(left.lockedNodeIds, right.lockedNodeIds)
    && areStringSetsEqual(left.terminalValidationNodeIds, right.terminalValidationNodeIds);
}

function areNumberRecordsEqual(left: Record<string, number>, right: Record<string, number>) {
  const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
  return [...keys].every((key) => (left[key] ?? 0) === (right[key] ?? 0));
}

function areReadinessSummariesEqual(
  left: AdaptivePathStoredOption['readinessSummary'],
  right: AdaptivePathStoredOption['readinessSummary'],
) {
  if (left.length !== right.length) return false;
  const normalized = (items: AdaptivePathStoredOption['readinessSummary']) => items
    .map(({ nodeId, state, message }) => `${nodeId}\u0000${state}\u0000${message}`)
    .sort();
  const normalizedLeft = normalized(left);
  const normalizedRight = normalized(right);
  return normalizedLeft.every((value, index) => value === normalizedRight[index]);
}

function areStringSetsEqual(left: readonly string[], right: readonly string[]) {
  if (left.length !== right.length) return false;
  const sortedLeft = [...left].sort();
  const sortedRight = [...right].sort();
  return sortedLeft.every((value, index) => value === sortedRight[index]);
}

function buildAdaptivePathTradeoffs(left: AdaptivePathStoredOption, right: AdaptivePathStoredOption): string[] {
  const tradeoffs: string[] = [];
  if (left.estimatedMinutes !== null && right.estimatedMinutes !== null && left.estimatedMinutes !== right.estimatedMinutes) {
    const longer = left.estimatedMinutes > right.estimatedMinutes ? left : right;
    const shorter = longer === left ? right : left;
    tradeoffs.push(`${longer.label}预计比${shorter.label}多用 ${Math.abs(left.estimatedMinutes - right.estimatedMinutes)} 分钟。`);
  }
  appendCountTradeoff(tradeoffs, left, right, left.nodeIds.length, right.nodeIds.length, '个学习节点');
  appendCountTradeoff(tradeoffs, left, right, left.checkpointNodeIds.length, right.checkpointNodeIds.length, '个检查点');
  appendCountTradeoff(tradeoffs, left, right, left.lockedNodeIds.length, right.lockedNodeIds.length, '个锁定节点');
  appendCountTradeoff(
    tradeoffs,
    left,
    right,
    left.terminalValidationNodeIds.length,
    right.terminalValidationNodeIds.length,
    '个终点验证节点',
  );
  const resourceTypes = [...new Set([...Object.keys(left.resourceMix), ...Object.keys(right.resourceMix)])].sort();
  for (const resourceType of resourceTypes) {
    const leftCount = left.resourceMix[resourceType] ?? 0;
    const rightCount = right.resourceMix[resourceType] ?? 0;
    if (leftCount === rightCount) continue;
    tradeoffs.push(`${left.label}包含 ${leftCount} 个 ${resourceType} 资源，${right.label}包含 ${rightCount} 个。`);
  }
  return tradeoffs;
}

function appendCountTradeoff(
  tradeoffs: string[],
  left: AdaptivePathStoredOption,
  right: AdaptivePathStoredOption,
  leftCount: number,
  rightCount: number,
  unit: string,
) {
  if (leftCount === rightCount) return;
  const larger = leftCount > rightCount ? left : right;
  const smaller = larger === left ? right : left;
  tradeoffs.push(`${larger.label}比${smaller.label}多 ${Math.abs(leftCount - rightCount)} ${unit}。`);
}

function buildAdaptivePathDifferenceRationale(comparison: AdaptivePathDifferenceExplanation): string[] {
  const [left, right] = comparison.options;
  if (!left || !right) return ['当前路径缺少两条可比较的候选方案。'];
  const heading = `正在比较：${left.label} ↔ ${right.label}。`;
  if (comparison.status === 'insufficient-data') {
    return [heading, '当前路径缺少完整节点信息，暂时无法生成可靠的差异解释。'];
  }
  if (comparison.status === 'no-material-difference') {
    return [heading, '两条路径目前没有实质差异。'];
  }
  return [
    heading,
    `两条路径共有 ${comparison.commonNodes.length} 个节点，各自独有 ${comparison.optionOnlyNodes[0]?.nodes.length ?? 0} 个和 ${comparison.optionOnlyNodes[1]?.nodes.length ?? 0} 个节点。`,
    ...comparison.tradeoffs,
  ];
}

function buildStoredAdaptivePathOptionRationale(option: Record<string, unknown>): Record<string, unknown> {
  return compactRuntimeRecord({
    evidenceBasis: arrayOfStrings(getValue(option, 'evidenceBasis')),
    limitations: arrayOfStrings(getValue(option, 'limitations')),
    terminalValidationNodeIds: arrayOfStrings(getValue(option, 'terminalValidationNodeIds')),
    terminalValidationStrategy: readRecord(getValue(option, 'terminalValidationStrategy')),
  });
}

function compactRuntimeRecord(value: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => {
    if (Array.isArray(entry)) return entry.length > 0;
    if (entry && typeof entry === 'object') return Object.keys(entry).length > 0;
    return entry !== null && entry !== undefined;
  }));
}

function resolveAdaptivePathDiagnosisSnapshotRef(path: unknown): string | null {
  const inputSnapshot = readRecord(getValue(path, 'inputSnapshot'));
  const candidates = [
    getValue(path, 'learnerStateRef'),
    getValue(inputSnapshot, 'diagnosisSnapshotRef'),
    getValue(inputSnapshot, 'diagnosisReportSnapshotId'),
    getValue(inputSnapshot, 'snapshotId'),
    getValue(readRecord(getValue(inputSnapshot, 'diagnosisReportSnapshot')), 'id'),
  ];
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.length > 0) return candidate;
  }
  return null;
}

function buildAdaptivePathToolScope(input: KonlingToolRuntimeInput, goalId: string, pathId?: string | null) {
  return {
    targetUserId: input.scope.targetUserId,
    actorUserId: input.scope.authenticatedUserId,
    role: input.scope.role,
    classId: input.scope.classId ?? null,
    courseId: input.scope.courseId,
    pageId: input.scope.pageId,
    resourceId: input.scope.resourceId ?? null,
    pathNodeId: input.scope.pathNodeId ?? null,
    pathId: pathId ?? input.context.planContext?.currentPathId ?? null,
    goalId,
    privacyScopes: input.scope.privacyScopes.filter((scope) => scope === 'student-visible' || scope === 'teacher-scoped'),
  };
}

function summarizeStudentIntent(intent?: string | null) {
  const value = typeof intent === 'string' ? intent.trim() : '';
  if (!value) return null;
  return `sha256:${createHash('sha256').update(value).digest('hex')}`;
}

function isKonlingAdaptivePathTool(toolName: KonlingToolName) {
  return KONLING_ADAPTIVE_PATH_TOOLS.has(toolName);
}

function isKonlingModeOwnedTool(
  mode: KonlingTeachingAssistantModeContract,
  toolName: KonlingToolName,
  scope: KonlingRuntimeScope,
  serverModeContext: KonlingTeachingAssistantServerModeContext | null | undefined,
) {
  return mode.id === 'path-advisor'
    && mode.mountingSurfaces.includes('student-path-center')
    && KONLING_ADAPTIVE_PATH_TOOLS.has(toolName)
    && scope.role === 'student'
    && scope.authenticatedUserId === scope.targetUserId
    && serverModeContext?.['student-path-center'] === true
    && isKonlingStudentPathCenterScope(scope);
}

function isKonlingStudentPathCenterScope(scope: KonlingRuntimeScope) {
  return scope.pageId === 'adaptive-path-center' || scope.pageId === 'student-path-center';
}

function buildKonlingToolInputSummary(toolName: KonlingToolName, input: unknown) {
  if (toolName === 'search_textbook') {
    return summarizeTextbookSearchQuery(getString(readRecord(input), 'query'));
  }
  if (!isKonlingAdaptivePathTool(toolName)) {
    return redactSensitivePayload(input ?? {});
  }
  const record = readRecord(input);
  const base = {
    idempotencyKey: getString(record, 'idempotencyKey') || null,
    goalId: getString(record, 'goalId') || null,
    pathId: getString(record, 'pathId') || null,
    graphNodeId: getString(record, 'graphNodeId') || null,
    routeIntent: getString(record, 'routeIntent') || null,
    naturalLanguageIntent: summarizeStudentIntent(getString(record, 'naturalLanguageIntent')),
  };
  if (toolName === 'generate_learning_path' || toolName === 'revise_learning_path_options') {
    const generationSummary = {
      ...base,
      timeBudgetMinutes: getNumber(record, 'timeBudgetMinutes') || null,
      difficultyRhythm: getString(record, 'difficultyRhythm') || null,
      resourcePreference: uniqueStringList(arrayOfStrings(record.resourcePreference)).sort(),
      checkpointPreference: getString(record, 'checkpointPreference') || null,
      allowExternalResources: typeof record.allowExternalResources === 'boolean' ? record.allowExternalResources : null,
      excludedNodeIds: uniqueStringList(arrayOfStrings(record.excludedNodeIds)).sort(),
      preferredStyleId: getString(record, 'preferredStyleId') || null,
      requestedAt: getString(record, 'requestedAt') || null,
      priorRequestId: getString(record, 'priorRequestId') || null,
      rejectedStyleIds: uniqueStringList(arrayOfStrings(record.rejectedStyleIds)).sort(),
      selectedStyleId: getString(record, 'selectedStyleId') || null,
    };
    return redactSensitivePayload(toolName === 'revise_learning_path_options'
      ? {
          ...generationSummary,
          sourceBatchId: getString(record, 'sourceBatchId') || null,
          sourceCandidateId: getString(record, 'sourceCandidateId') || null,
          sourceCandidateFingerprint: getString(record, 'sourceCandidateFingerprint') || null,
          activeProgressVersion: getString(record, 'activeProgressVersion') || null,
        }
      : generationSummary);
  }
  if (toolName === 'reject_learning_path_option') {
    return redactSensitivePayload({
      ...base,
      rejectedStyleId: getString(record, 'rejectedStyleId') || null,
      reasonSummary: getString(record, 'reason') ? 'student-provided-path-option-rejection-reason' : null,
    });
  }
  if (toolName === 'select_learning_path') {
    return redactSensitivePayload({
      ...base,
      batchId: getString(record, 'batchId') || null,
      candidateId: getString(record, 'candidateId') || null,
      selectedStyleId: getString(record, 'selectedStyleId') || null,
      helpful: typeof record.helpful === 'boolean' ? record.helpful : null,
    });
  }
  if (toolName === 'record_path_adjustment_outcome') {
    return redactSensitivePayload({
      ...base,
      outcome: getString(record, 'outcome') || null,
      selectedStyleId: getString(record, 'selectedStyleId') || null,
      rejectedStyleIds: arrayOfStrings(record.rejectedStyleIds),
    });
  }
  return redactSensitivePayload({
    ...base,
    styleId: getString(record, 'styleId') || null,
    compareWithStyleId: getString(record, 'compareWithStyleId') || null,
  });
}

function summarizeTextbookSearchQuery(query: string) {
  const normalized = query.normalize('NFKC').trim();
  return {
    queryHash: createHash('sha256').update(normalized).digest('hex'),
    queryLength: normalized.length,
    queryCategory: normalized.length === 0
      ? 'empty'
      : normalized.length <= 40
        ? 'short-course-query'
        : normalized.length <= 200
          ? 'course-query'
          : 'long-course-query',
  };
}

export async function createKonlingAgentSession(
  db: KonlingRuntimeDb,
  input: KonlingAgentSessionCreateInput,
): Promise<KonlingAgentSessionView> {
  assertSmartPrepSessionBinding(input.scope, input.smartPrepBinding);
  const state = {
    ...(input.state ?? {}),
    ...(input.smartPrepBinding ? {
      smartPrepBinding: {
        taskId: input.smartPrepBinding.taskId,
        taskRevision: input.smartPrepBinding.taskRevision,
        ownerUserId: input.scope.targetUserId,
      },
    } : {}),
  };
  const created = await db.agentSession?.create?.({
    data: {
      konlingSessionId: input.konlingSessionId ?? null,
      ownerUserId: input.scope.targetUserId,
      actorUserId: input.scope.authenticatedUserId,
      classId: input.scope.classId ?? null,
      courseId: input.scope.courseId,
      pageId: input.scope.pageId,
      resourceId: input.scope.resourceId ?? null,
      pathNodeId: input.scope.pathNodeId ?? null,
      phase: input.phase,
      status: input.status ?? 'draft',
      stateJson: redactSensitivePayload(state),
      permittedTools: input.permittedTools ?? DEFAULT_TOOLS,
      pendingApproval: input.pendingApproval ? redactSensitivePayload(input.pendingApproval) : null,
      expiresAt: input.expiresAt ?? null,
    },
  });
  if (!created) {
    throw new KonlingRuntimeScopeError(404, 'AgentSession 存储不可用。');
  }
  return toAgentSessionView(created);
}

export async function resumeKonlingAgentSession(
  db: KonlingRuntimeDb,
  input: KonlingAgentSessionRefInput,
): Promise<KonlingAgentSessionView> {
  assertSmartPrepSessionBinding(input.scope, input.smartPrepBinding);
  const session = await db.agentSession?.findFirst?.({
    where: buildAgentSessionScopeWhere(
      input.scope,
      input.agentSessionId,
      input.phase,
      input.smartPrepBinding,
      input.konlingSessionId,
    ),
  });
  if (!session) {
    throw new KonlingRuntimeScopeError(404, 'AgentSession 不存在或不属于当前用户作用域。');
  }
  return toAgentSessionView(session);
}

export async function getOrCreateKonlingAgentSession(
  db: KonlingRuntimeDb,
  input: KonlingAgentSessionResolveInput,
): Promise<KonlingAgentSessionView> {
  if (input.agentSessionId) {
    return resumeKonlingAgentSession(db, {
      scope: input.scope,
      agentSessionId: input.agentSessionId,
      konlingSessionId: input.konlingSessionId,
      phase: input.phase,
      smartPrepBinding: input.smartPrepBinding,
    });
  }

  const awaitingApprovalSession = await db.agentSession?.findFirst?.({
    where: {
      ...buildAgentSessionScopeWhere(
        input.scope,
        undefined,
        undefined,
        input.smartPrepBinding,
        input.konlingSessionId,
      ),
      phase: input.phase,
      status: 'awaiting_approval',
    },
    orderBy: { updatedAt: 'desc' },
  });
  if (awaitingApprovalSession) {
    return toAgentSessionView(awaitingApprovalSession);
  }

  return createKonlingAgentSession(db, input);
}

export async function pauseKonlingAgentSession(
  db: KonlingRuntimeDb,
  input: KonlingAgentSessionRefInput & { state?: Record<string, unknown> },
) {
  return updateKonlingAgentSessionStatus(db, {
    ...input,
    status: 'paused',
  });
}

export async function failKonlingAgentSession(
  db: KonlingRuntimeDb,
  input: KonlingAgentSessionRefInput & { error?: unknown },
) {
  return updateKonlingAgentSessionStatus(db, {
    ...input,
    status: 'failed',
    pendingApproval: input.error ? { error: redactSensitivePayload(input.error) as Record<string, unknown> } : null,
  });
}

export async function archiveKonlingAgentSession(
  db: KonlingRuntimeDb,
  input: KonlingAgentSessionRefInput,
) {
  return updateKonlingAgentSessionStatus(db, {
    ...input,
    status: 'archived',
    archivedAt: new Date(),
  });
}

export async function startKonlingToolRun(
  db: KonlingRuntimeDb,
  input: KonlingToolRunStartInput,
): Promise<KonlingToolRunView> {
  const registryEntry = KONLING_TOOL_REGISTRY[input.toolName];
  if (!registryEntry) {
    throw new KonlingRuntimeScopeError(403, `Konling 工具 ${input.toolName} 未注册。`);
  }
  const agentSession = await db.agentSession?.findFirst?.({
    where: buildAgentSessionScopeWhere(input.scope, input.agentSessionId),
    select: { id: true, permittedTools: true },
  });
  if (!agentSession) {
    throw new KonlingRuntimeScopeError(404, 'AgentSession 不存在或不属于当前用户作用域。');
  }
  const permittedTools = arrayOfStrings(getValue(agentSession, 'permittedTools'));
  if (!permittedTools.includes(input.toolName)) {
    throw new KonlingRuntimeScopeError(403, `AgentSession 未授权 Konling 工具 ${input.toolName}。`);
  }
  const idempotencyWhere = input.idempotencyKey && registryEntry.idempotencyPolicy !== 'none'
    ? buildAgentToolRunIdempotencyWhere(input)
    : null;

  if (idempotencyWhere) {
    const existing = await db.agentToolRun?.findFirst?.({
      where: idempotencyWhere,
    });
    if (existing) {
      if (registryEntry.idempotencyPolicy === 'reject') {
        throw new KonlingRuntimeScopeError(403, '重复的 Konling 工具请求已被拒绝。');
      }
      return toToolRunView(existing, { reused: true });
    }
  }

  await input.preflight?.();

  const approvalState = resolveKonlingToolApprovalState(registryEntry, input);
  const status: KonlingToolRunStatus =
    approvalState === 'required' ? 'awaiting_approval' : 'running';
  let created: unknown | null | undefined;
  try {
    created = await db.agentToolRun?.create?.({
      data: {
        agentSessionId: input.agentSessionId,
        ownerUserId: input.scope.targetUserId,
        actorUserId: input.scope.authenticatedUserId,
        targetUserId: input.scope.targetUserId,
        classId: input.scope.classId ?? null,
        courseId: input.scope.courseId,
        pageId: input.scope.pageId,
        resourceId: input.scope.resourceId ?? null,
        pathNodeId: input.scope.pathNodeId ?? null,
        toolName: input.toolName,
        permissionTier: registryEntry.permissionTier,
        approvalState,
        status,
        inputSummary: buildKonlingToolInputSummary(input.toolName, input.input),
        outputSummary: null,
        errorSummary: null,
        idempotencyKey: input.idempotencyKey ?? null,
        correlationId: input.correlationId ?? `${input.agentSessionId}:${input.toolName}:${Date.now()}`,
        startedAt: new Date(),
      },
    });
  } catch (error) {
    if (idempotencyWhere && isPrismaUniqueConstraintError(error)) {
      const existing = await db.agentToolRun?.findFirst?.({ where: idempotencyWhere });
      if (existing) {
        if (registryEntry.idempotencyPolicy === 'reject') {
          throw new KonlingRuntimeScopeError(403, '重复的 Konling 工具请求已被拒绝。');
        }
        return toToolRunView(existing, { reused: true });
      }
    }
    throw error;
  }
  if (!created) {
    throw new KonlingRuntimeScopeError(404, 'AgentToolRun 存储不可用。');
  }
  return toToolRunView(created);
}

function resolveKonlingToolApprovalState(
  registryEntry: KonlingToolRegistryEntry,
  input: KonlingToolRunStartInput,
): KonlingToolApprovalState {
  if (registryEntry.approvalPolicy === 'required') return 'required';
  if (
    KONLING_ADAPTIVE_PATH_WRITE_TOOLS.has(input.toolName) &&
    !isStudentOwnedKonlingToolScope(input.scope)
  ) {
    return 'required';
  }
  return 'not_required';
}

function isStudentOwnedKonlingToolScope(scope: KonlingRuntimeScope) {
  return scope.role === 'student' && scope.authenticatedUserId === scope.targetUserId;
}

export async function completeKonlingToolRun(
  db: KonlingRuntimeDb,
  input: KonlingToolRunCompleteInput,
): Promise<{ success: true; status: 'succeeded' }> {
  const toolRun = await findScopedToolRun(db, input.scope, input.toolRunId);
  const permissionTier = getString(toolRun, 'permissionTier');
  const approvalState = getString(toolRun, 'approvalState');
  if (
    (permissionTier === 'write' || permissionTier === 'publish') &&
    approvalState !== 'approved' &&
    approvalState !== 'not_required'
  ) {
    throw new KonlingRuntimeScopeError(403, '写入或发布工具必须先获得 approval。');
  }
  const now = input.now ?? new Date();
  if (getString(toolRun, 'toolName') === 'apply_controller_patch') {
    await applyApprovedControllerPatchToSession(db, input.scope, input.toolRunId, toolRun);
  }
  await updateScopedToolRun(db, input.scope, input.toolRunId, {
    status: 'succeeded',
    outputSummary: redactSensitivePayload(input.output ?? {}),
    completedAt: now,
    latencyMs: calculateLatencyMs(getValue(toolRun, 'startedAt'), now),
  });
  const toolName = getString(toolRun, 'toolName') as KonlingToolName;
  if (!(input.scope.candidateGraph && KONLING_CANDIDATE_READ_TOOL_SET.has(toolName))) {
    await persistKonlingAgentToolEvidence(db, {
      ...readRecord(toolRun),
      status: 'succeeded',
      outputSummary: redactSensitivePayload(input.output ?? {}),
      completedAt: now,
      latencyMs: calculateLatencyMs(getValue(toolRun, 'startedAt'), now),
    });
  }
  return { success: true, status: 'succeeded' };
}

export async function failKonlingToolRun(
  db: KonlingRuntimeDb,
  input: KonlingToolRunFailInput,
): Promise<{ success: true; status: 'failed' }> {
  const toolRun = await findScopedToolRun(db, input.scope, input.toolRunId);
  const now = input.now ?? new Date();
  await updateScopedToolRun(db, input.scope, input.toolRunId, {
    status: 'failed',
    errorSummary: redactSensitivePayload(input.error ?? {}),
    completedAt: now,
    latencyMs: calculateLatencyMs(getValue(toolRun, 'startedAt'), now),
  });
  return { success: true, status: 'failed' };
}

async function runKonlingRuntimeTool<T>(
  runtimeInput: KonlingToolRuntimeInput,
  toolName: KonlingToolName,
  toolInput: unknown,
  effect: (toolRun?: KonlingToolRunView) => Promise<T>,
) {
  assertCandidateToolAllowed(runtimeInput.scope, toolName);
  const agentSessionId = runtimeInput.agentSessionId;
  if (!agentSessionId) {
    if (isKonlingAdaptivePathTool(toolName)) {
      throw new KonlingRuntimeScopeError(403, '自适应路径工具必须通过 AgentSession 执行。');
    }
    return assertToolResult(runtimeInput, toolName, await effect());
  }

  const inputRecord = readRecord(toolInput);
  const idempotencyKey = typeof inputRecord.idempotencyKey === 'string' ? inputRecord.idempotencyKey : null;
  const adaptivePathGoalId = resolveAdaptivePathGoalLock(runtimeInput, toolName, toolInput);
  const toolRun = await startKonlingToolRun(runtimeInput.db, {
    scope: runtimeInput.scope,
    agentSessionId,
    toolName,
    input: toolInput,
    idempotencyKey,
    preflight: () => validateKonlingToolPreflight(runtimeInput, toolName, toolInput),
  });

  if (toolRun.approvalState === 'required') {
    const approvalPreview = buildKonlingApprovalPreview(runtimeInput, toolName, toolInput);
    await markKonlingAgentSessionAwaitingApproval(
      runtimeInput.db,
      runtimeInput.scope,
      agentSessionId,
      toolRun,
      approvalPreview,
    );
    return assertToolResult(runtimeInput, toolName, {
      approvalRequired: true,
      toolRunId: toolRun.id,
      toolName,
      permissionTier: toolRun.permissionTier,
      status: toolRun.status,
      message: '该 Konling 工具需要 approval 后才能执行。',
      ...(approvalPreview ?? {}),
    });
  }
  if (toolRun.reused) {
    assertReusedAdaptivePathToolRunMatchesGoal(toolName, toolRun, adaptivePathGoalId);
    assertReusedCandidateSelectionToolRunMatchesInput(toolName, toolRun, toolInput);
    if (toolRun.status === 'succeeded') {
      await assertReusedAdaptivePathAdjustmentToolRunMatchesInput(
        runtimeInput,
        toolName,
        toolRun,
        toolInput,
        adaptivePathGoalId,
      );
      return assertToolResult(runtimeInput, toolName, toolRun.outputSummary ?? {
        toolRunReused: true,
        toolRunId: toolRun.id,
        toolName,
        status: toolRun.status,
      });
    }
    if (toolRun.status === 'failed') {
      if (toolName !== 'run_virtual_simulation') {
        throw new KonlingRuntimeScopeError(409, '幂等 Konling 工具请求此前已失败，不能重复执行。');
      }
    } else if (toolName === 'select_learning_path' && toolRun.status === 'running') {
      return assertToolResult(runtimeInput, toolName, await effect(toolRun));
    } else {
      return assertToolResult(runtimeInput, toolName, {
        toolRunReused: true,
        toolRunId: toolRun.id,
        toolName,
        permissionTier: toolRun.permissionTier,
        status: toolRun.status,
        message: '该 Konling 工具请求已存在，等待当前执行完成。',
      });
    }
  }

  try {
    const result = await effect(toolRun);
    if (toolName === 'select_learning_path' && getString(readRecord(result), 'status') === 'pending_commit') {
      return assertToolResult(runtimeInput, toolName, result);
    }
    await completeKonlingToolRun(runtimeInput.db, {
      scope: runtimeInput.scope,
      toolRunId: toolRun.id,
      output: result,
    });
    return assertToolResult(runtimeInput, toolName, result);
  } catch (error) {
    await failKonlingToolRun(runtimeInput.db, {
      scope: runtimeInput.scope,
      toolRunId: toolRun.id,
      error: summarizeRuntimeToolError(error),
    });
    throw error;
  }
}

function resolveAdaptivePathGoalLock(
  runtimeInput: KonlingToolRuntimeInput,
  toolName: KonlingToolName,
  toolInput: unknown,
): string | null {
  if (!isKonlingAdaptivePathTool(toolName)) return null;
  const requestedGoalId = getString(readRecord(toolInput), 'goalId') || null;
  return resolveScopedAdaptivePathGoalId(runtimeInput, requestedGoalId);
}

function assertReusedAdaptivePathToolRunMatchesGoal(
  toolName: KonlingToolName,
  toolRun: KonlingToolRunView,
  goalId: string | null,
): void {
  if (!goalId || !isKonlingAdaptivePathTool(toolName)) return;
  const inputGoalId = getString(readRecord(toolRun.inputSummary), 'goalId') || null;
  if (inputGoalId && inputGoalId !== goalId) {
    throw new KonlingRuntimeScopeError(403, '幂等 Konling 工具请求不属于当前页面目标。');
  }
  const outputScope = readRecord(getValue(readRecord(toolRun.outputSummary), 'scope'));
  const outputGoalId = getString(outputScope, 'goalId') || null;
  if (outputGoalId && outputGoalId !== goalId) {
    throw new KonlingRuntimeScopeError(403, '幂等 Konling 工具结果不属于当前页面目标。');
  }
}

function assertReusedCandidateSelectionToolRunMatchesInput(
  toolName: KonlingToolName,
  toolRun: KonlingToolRunView,
  toolInput: unknown,
): void {
  if (toolName !== 'select_learning_path') return;
  const requested = readRecord(toolInput);
  const persisted = readRecord(toolRun.inputSummary);
  const requestedCandidateId = getString(requested, 'candidateId');
  const requestedIntent = summarizeStudentIntent(getString(requested, 'naturalLanguageIntent'));
  const persistedIntent = getString(persisted, 'naturalLanguageIntent')?.trim() || null;
  if (
    getString(persisted, 'batchId') !== getString(requested, 'batchId')
    || (requestedCandidateId && getString(persisted, 'candidateId') !== requestedCandidateId)
    || (requestedIntent !== null && requestedIntent !== persistedIntent)
    || (getString(requested, 'pathId') && getString(persisted, 'pathId') !== getString(requested, 'pathId'))
  ) {
    throw new KonlingRuntimeScopeError(409, '幂等候选路径选择与已完成的工具请求不一致。');
  }
}

async function assertReusedAdaptivePathAdjustmentToolRunMatchesInput(
  runtimeInput: KonlingToolRuntimeInput,
  toolName: KonlingToolName,
  toolRun: KonlingToolRunView,
  toolInput: unknown,
  goalId: string | null,
): Promise<void> {
  if (toolName !== 'revise_learning_path_options') return;
  const parsed = reviseLearningPathOptionsParameters.parse(toolInput);
  const requestedSummary = buildKonlingToolInputSummary(toolName, parsed);
  if (stableKonlingToolIdentityJson(toolRun.inputSummary) !== stableKonlingToolIdentityJson(requestedSummary)) {
    throw new KonlingRuntimeScopeError(409, '幂等候选路径调整与已完成的工具请求不一致。');
  }
  const scopedGoalId = goalId ?? resolveScopedAdaptivePathGoalId(runtimeInput, parsed.goalId);
  await resolveAdaptivePathAdjustmentSource(runtimeInput, scopedGoalId, parsed);
  await assertAdaptivePathAdjustmentProgressStillCurrent(runtimeInput, scopedGoalId, parsed);
}

function stableKonlingToolIdentityJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableKonlingToolIdentityJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, nested]) => `${JSON.stringify(key)}:${stableKonlingToolIdentityJson(nested)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}

async function validateKonlingToolPreflight(
  runtimeInput: KonlingToolRuntimeInput,
  toolName: KonlingToolName,
  toolInput: unknown,
) {
  requireIdempotencyKeyForTool(toolName, toolInput);
  if (toolName === 'generate_learning_path') {
    const parsed = generateLearningPathParameters.parse(toolInput);
    const goalId = resolveScopedAdaptivePathGoalId(runtimeInput, parsed.goalId);
    await assertScopedAdaptivePathToolPath(runtimeInput, parsed.pathId, { goalId, requirePath: false, requireExisting: false });
    return;
  }
  if (toolName === 'revise_learning_path_options') {
    const parsed = reviseLearningPathOptionsParameters.parse(toolInput);
    const goalId = resolveScopedAdaptivePathGoalId(runtimeInput, parsed.goalId);
    const path = await assertScopedAdaptivePathToolPath(runtimeInput, parsed.pathId, { goalId, requirePath: true, requireExisting: true });
    assertAdaptivePathOptionIds(path, parsed.selectedStyleId, parsed.rejectedStyleIds ?? [], { allowPolicyFallback: true });
    return;
  }
  if (toolName === 'select_learning_path') {
    selectLearningPathParameters.parse(toolInput);
    return;
  }
  if (toolName === 'reject_learning_path_option') {
    const parsed = rejectLearningPathOptionParameters.parse(toolInput);
    const goalId = resolveScopedAdaptivePathGoalId(runtimeInput, parsed.goalId);
    const path = await assertScopedAdaptivePathToolPath(runtimeInput, parsed.pathId, { goalId, requirePath: true, requireExisting: true });
    assertAdaptivePathOptionIds(path, null, [parsed.rejectedStyleId]);
    return;
  }
  if (toolName === 'explain_learning_path_tradeoff') {
    const parsed = explainLearningPathTradeoffParameters.parse(toolInput);
    const goalId = resolveScopedAdaptivePathGoalId(runtimeInput, parsed.goalId);
    const requiresPathOptionValidation = Boolean(parsed.pathId || parsed.styleId || parsed.compareWithStyleId);
    const path = await assertScopedAdaptivePathToolPath(runtimeInput, parsed.pathId, {
      goalId,
      requirePath: Boolean(parsed.styleId || parsed.compareWithStyleId),
      requireExisting: requiresPathOptionValidation,
    });
    if (path) {
      assertAdaptivePathOptionIds(
        path,
        parsed.styleId,
        [parsed.compareWithStyleId].filter((styleId): styleId is string => Boolean(styleId)),
        { allowPolicyFallback: true },
      );
    }
    return;
  }
  if (toolName === 'record_path_adjustment_outcome') {
    const parsed = recordPathAdjustmentOutcomeParameters.parse(toolInput);
    const goalId = resolveScopedAdaptivePathGoalId(runtimeInput, parsed.goalId);
    const path = await assertScopedAdaptivePathToolPath(runtimeInput, parsed.pathId, { goalId, requirePath: true, requireExisting: true });
    assertAdaptivePathOptionIds(path, parsed.selectedStyleId, parsed.rejectedStyleIds ?? []);
    return;
  }
  if (toolName === 'set_simulation_params') {
    assertSimulationScope(runtimeInput.scope, Boolean(runtimeInput.scopedSimulationState));
    buildSimulationParamChangeRequest(readRecord(toolInput) as SimulationParamChangeInput);
    return;
  }
  if (toolName === 'run_virtual_simulation') {
    runVirtualSimulationParameters.parse(toolInput);
    return;
  }
  if (toolName === 'get_simulation_context') {
    simulationContextParameters.parse(toolInput);
    return;
  }
  if (toolName === 'analyze_simulation_trace') {
    analyzeSimulationTraceParameters.parse(toolInput);
    return;
  }
  if (toolName === 'compare_simulation_runs') {
    compareSimulationRunsParameters.parse(toolInput);
    return;
  }
  if (toolName === 'propose_controller_patch') {
    proposeControllerPatchParameters.parse(toolInput);
    return;
  }
  if (toolName === 'apply_controller_patch') {
    const parsed = applyControllerPatchParameters.parse(toolInput);
    await resolveScopedSimulationRun(runtimeInput.db, runtimeInput.scope, {
      simulationRunId: parsed.simulationRunId,
      includeTrace: true,
    });
    return;
  }
  if (toolName === 'record_intervention_result') {
    await assertInterventionFeedbackScope(runtimeInput.db, runtimeInput.scope, toolInput);
  }
}

function buildKonlingApprovalPreview(
  runtimeInput: KonlingToolRuntimeInput,
  toolName: KonlingToolName,
  toolInput: unknown,
): Record<string, unknown> | null {
  if (toolName === 'apply_controller_patch') {
    const input = applyControllerPatchParameters.parse(toolInput);
    return {
      pendingControllerPatch: {
        simulationRunId: input.simulationRunId,
        patch: input.patch,
        rationale: input.rationale ?? null,
        scope: buildToolScopeRef(runtimeInput.scope),
      },
    };
  }
  if (toolName !== 'set_simulation_params') return null;
  const request = buildSimulationParamChangeRequest(readRecord(toolInput) as SimulationParamChangeInput);
  return {
    ...formatSimulationParamChangeResponse(request),
    pendingRequest: {
      type: request.type,
      params: request.params,
      scope: buildToolScopeRef(runtimeInput.scope),
    },
  };
}

async function markKonlingAgentSessionAwaitingApproval(
  db: KonlingRuntimeDb,
  scope: KonlingRuntimeScope,
  agentSessionId: string,
  toolRun: KonlingToolRunView,
  approvalPreview: Record<string, unknown> | null,
) {
  await updateKonlingAgentSessionStatus(db, {
    scope,
    agentSessionId,
    status: 'awaiting_approval',
    pendingApproval: redactSensitivePayload({
      toolRunId: toolRun.id,
      toolName: toolRun.toolName,
      permissionTier: toolRun.permissionTier,
      approvalState: toolRun.approvalState,
      status: toolRun.status,
      inputSummary: toolRun.inputSummary,
      idempotencyKey: toolRun.idempotencyKey,
      correlationId: toolRun.correlationId,
      startedAt: toolRun.startedAt,
      ...(approvalPreview ? { preview: approvalPreview } : {}),
    }) as Record<string, unknown>,
  });
}

async function assertInterventionFeedbackScope(
  db: KonlingRuntimeDb,
  scope: KonlingRuntimeScope,
  toolInput: unknown,
) {
  const input = readRecord(toolInput);
  const interventionId = getString(input, 'interventionId');
  const intervention = await db.aIIntervention?.findFirst?.({
    where: {
      id: interventionId,
      userId: scope.targetUserId,
      classId: scope.classId ?? null,
      resourceId: scope.resourceId ?? null,
      pathNodeId: scope.pathNodeId ?? null,
    },
  });
  if (!intervention) {
    throw new KonlingRuntimeScopeError(404, '干预不存在或不属于当前 Konling 作用域。');
  }
}

function requireIdempotencyKeyForTool(toolName: KonlingToolName, toolInput: unknown) {
  if (!KONLING_IDEMPOTENCY_REQUIRED_TOOLS.has(toolName)) return;
  const idempotencyKey = getString(readRecord(toolInput), 'idempotencyKey');
  if (!idempotencyKey) {
    throw new KonlingRuntimeScopeError(400, `Konling 工具 ${toolName} 需要 idempotencyKey。`);
  }
}

function assertAgentSessionRequiredForPersistentSimulationTool(
  input: KonlingToolRuntimeInput,
  toolName: KonlingToolName,
) {
  if (input.agentSessionId) return;
  throw new KonlingRuntimeScopeError(400, `Konling 工具 ${toolName} 必须通过 AgentSession 和 AgentToolRun 执行。`);
}

function assertOwnerSimulationWriteScope(scope: KonlingRuntimeScope) {
  if (scope.role === 'student' && scope.authenticatedUserId === scope.targetUserId) return;
  throw new KonlingRuntimeScopeError(403, 'Konling 仿真写入工具只能作用于 owner user，教师 class scope 不能 impersonate 学生执行写入。');
}

async function resolveScopedSimulationRun(
  db: KonlingRuntimeDb,
  scope: KonlingRuntimeScope,
  input: Pick<SimulationContextInput, 'simulationRunId' | 'taskSpecId' | 'includeTrace'>,
): Promise<SimulationDbRun> {
  if (!input.simulationRunId && !input.taskSpecId) {
    throw new KonlingRuntimeScopeError(400, '必须提供 simulationRunId 或 taskSpecId。');
  }
  const where = buildSimulationRunScopeWhere(scope, {
    simulationRunId: input.simulationRunId,
    taskSpecId: input.taskSpecId,
  });
  const run = await db.simulationRun?.findFirst?.({
    where,
    include: {
      taskSpec: true,
      traces: {
        orderBy: { createdAt: 'desc' },
        take: input.includeTrace ? 1 : 1,
      },
    },
  });
  if (!run) {
    throw new KonlingRuntimeScopeError(404, 'SimulationRun 不存在或不属于当前 Konling 仿真作用域。');
  }
  assertSimulationRunAccess(scope, run as SimulationDbRun);
  return run as SimulationDbRun;
}

async function resolveScopedSimulationTaskSpec(
  db: KonlingRuntimeDb,
  scope: KonlingRuntimeScope,
  taskSpecId?: string | null,
): Promise<SimulationDbTaskSpec> {
  if (!taskSpecId) {
    throw new KonlingRuntimeScopeError(400, '必须提供 simulationRunId 或 taskSpecId。');
  }
  const taskSpec = await db.simulationTaskSpec?.findFirst?.({
    where: { id: taskSpecId },
  });
  if (!taskSpec) {
    throw new KonlingRuntimeScopeError(404, 'SimulationTaskSpec 不存在或不属于当前 Konling 仿真作用域。');
  }
  assertSimulationTaskSpecAccess(scope, taskSpec as SimulationDbTaskSpec);
  return taskSpec as SimulationDbTaskSpec;
}

async function resolveScopedSimulationRuns(
  db: KonlingRuntimeDb,
  scope: KonlingRuntimeScope,
  simulationRunIds: string[],
): Promise<SimulationDbRun[]> {
  const uniqueIds = Array.from(new Set(simulationRunIds));
  if (uniqueIds.length !== simulationRunIds.length) {
    throw new KonlingRuntimeScopeError(400, 'compare_simulation_runs 需要提供互不重复的 simulationRunIds。');
  }
  if (uniqueIds.length < 2) {
    throw new KonlingRuntimeScopeError(400, 'compare_simulation_runs 至少需要两个不同的 SimulationRun。');
  }
  const runs = await db.simulationRun?.findMany?.({
    where: {
      ...buildSimulationRunScopeWhere(scope, {}),
      id: { in: uniqueIds },
    },
    include: {
      taskSpec: true,
      traces: {
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
    },
  });
  if (!runs || runs.length !== uniqueIds.length) {
    throw new KonlingRuntimeScopeError(404, '部分 SimulationRun 不存在或不属于当前 Konling 仿真作用域。');
  }
  for (const run of runs) {
    assertSimulationRunAccess(scope, run as SimulationDbRun);
  }
  return runs as SimulationDbRun[];
}

function buildSimulationRunScopeWhere(
  scope: KonlingRuntimeScope,
  input: { simulationRunId?: string | null; taskSpecId?: string | null },
) {
  const base: Record<string, unknown> = {
    ...(input.simulationRunId ? { id: input.simulationRunId } : {}),
    ...(input.taskSpecId ? { taskSpecId: input.taskSpecId } : {}),
    OR: buildSimulationRunContextScopeWhere(scope),
  };
  if (scope.role === 'student') {
    return {
      ...base,
      ownerUserId: scope.targetUserId,
    };
  }
  if (scope.role === 'teacher') {
    if (!scope.classId) {
      throw new KonlingRuntimeScopeError(400, '教师读取 Konling 仿真工具必须提供 classId。');
    }
    return {
      ...base,
      classId: scope.classId,
    };
  }
  return base;
}

function buildSimulationRunContextScopeWhere(scope: KonlingRuntimeScope) {
  return [
    {
      courseId: scope.courseId,
      ...(scope.resourceId ? { resourceId: scope.resourceId } : {}),
    },
    {
      sourceDomain: 'arena_virtual_preview',
      courseId: null,
      resourceId: null,
    },
  ];
}

function assertSimulationRunAccess(scope: KonlingRuntimeScope, run: SimulationDbRun) {
  const decision = authorizeSimulationRunAccess({
    requester: {
      userId: scope.authenticatedUserId,
      role: toSimulationAccessRole(scope.role),
      classIds: scope.classId ? [scope.classId] : [],
      allowRawTraceAudit: scope.role === 'admin',
    },
    run: toSimulationRunEnvelope(run),
  });
  if (!decision.allowed) {
    throw new KonlingRuntimeScopeError(403, '无权访问该 SimulationRun。');
  }
  assertSimulationRunContextScope(scope, run);
  return decision;
}

function assertSimulationRunContextScope(scope: KonlingRuntimeScope, run: SimulationDbRun) {
  const taskSpec = readSimulationTaskSpec(run);
  const launchContext = taskSpec.launchContext;
  const courseIds = [getString(run, 'courseId'), launchContext.courseId].filter(Boolean);
  const resourceIds = [getString(run, 'resourceId'), launchContext.resourceId].filter(Boolean);
  const pageIds = [launchContext.pageId].filter(Boolean);

  if (courseIds.some((courseId) => courseId !== scope.courseId)) {
    throw new KonlingRuntimeScopeError(403, '无权访问该 SimulationRun。');
  }
  if (resourceIds.some((resourceId) => resourceId !== scope.resourceId)) {
    throw new KonlingRuntimeScopeError(403, '无权访问该 SimulationRun。');
  }
  if (scope.resourceId && resourceIds.length === 0) {
    throw new KonlingRuntimeScopeError(403, '无权访问该 SimulationRun。');
  }
  if (pageIds.some((pageId) => pageId !== scope.pageId)) {
    throw new KonlingRuntimeScopeError(403, '无权访问该 SimulationRun。');
  }
}

function assertSimulationTaskSpecAccess(scope: KonlingRuntimeScope, taskSpecRow: SimulationDbTaskSpec) {
  if (scope.role === 'teacher' && !scope.classId) {
    throw new KonlingRuntimeScopeError(400, '教师读取 Konling 仿真工具必须提供 classId。');
  }
  const taskSpec = readSimulationTaskSpecRow(taskSpecRow);
  const launchContext = taskSpec.launchContext;
  const scopedContextKeys = [
    launchContext.courseId,
    launchContext.classId,
    launchContext.resourceId,
    launchContext.pageId,
  ].filter(Boolean);
  if (scopedContextKeys.length === 0 && scope.role !== 'admin') {
    throw new KonlingRuntimeScopeError(403, 'SimulationTaskSpec 缺少可验证的 Konling 仿真作用域。');
  }
  if (launchContext.courseId && launchContext.courseId !== scope.courseId) {
    throw new KonlingRuntimeScopeError(403, '无权访问该 SimulationTaskSpec。');
  }
  if (launchContext.classId && launchContext.classId !== scope.classId) {
    throw new KonlingRuntimeScopeError(403, '无权访问该 SimulationTaskSpec。');
  }
  if (launchContext.resourceId && launchContext.resourceId !== scope.resourceId) {
    throw new KonlingRuntimeScopeError(403, '无权访问该 SimulationTaskSpec。');
  }
  if (launchContext.pageId && launchContext.pageId !== scope.pageId) {
    throw new KonlingRuntimeScopeError(403, '无权访问该 SimulationTaskSpec。');
  }
  if (scope.role === 'teacher') return 'class-summary' as const;
  if (scope.role === 'admin') return 'audit-summary' as const;
  return 'owner' as const;
}

async function resolveScopedSimulationTrace(
  db: KonlingRuntimeDb,
  run: SimulationDbRun,
  traceId?: string | null,
): Promise<SimulationDbTrace | null> {
  const traces = arrayOfRecords(getValue(run, 'traces'));
  if (traceId) {
    const inlineTrace = traces.find((trace) => getString(trace, 'id') === traceId);
    if (inlineTrace) return inlineTrace;
    const storedTrace = await db.simulationTrace?.findFirst?.({
      where: {
        id: traceId,
        runId: getString(run, 'id'),
      },
    });
    if (!storedTrace) {
      throw new KonlingRuntimeScopeError(404, 'SimulationTrace 不存在或不属于当前 SimulationRun。');
    }
    return storedTrace as SimulationDbTrace;
  }
  return traces[0] ?? null;
}

function buildSimulationContextOutput(
  scope: KonlingRuntimeScope,
  run: SimulationDbRun,
  options: { includeTrace: boolean },
) {
  const decision = assertSimulationRunAccess(scope, run);
  const trace = arrayOfRecords(getValue(run, 'traces'))[0] ?? null;
  return {
    simulationRunId: getString(run, 'id'),
    accessScope: decision.scope,
    ownerUserId: getString(run, 'ownerUserId') || null,
    classId: getString(run, 'classId') || null,
    task: compactSimulationTaskSpec(readSimulationTaskSpec(run)),
    controllerSnapshotRef: getString(run, 'controllerSnapshotRef') || null,
    status: getString(run, 'status'),
    summary: readRecord(getValue(run, 'summary')),
    replay: {
      replayToken: getString(run, 'replayToken') || null,
      replayState: getString(run, 'status') === 'completed' ? 'available' : 'not_ready',
    },
    provenance: buildSimulationProvenance(run),
    evidenceStatus: buildSimulationEvidenceStatus(run, trace),
    traceRef: trace ? formatSimulationTraceRef(trace, { includeStorageUri: decision.rawTraceAllowed }) : null,
    rawTraceIncluded: options.includeTrace && decision.rawTraceAllowed,
  };
}

function buildSimulationTaskSpecContextOutput(
  scope: KonlingRuntimeScope,
  taskSpecRow: SimulationDbTaskSpec,
) {
  const accessScope = assertSimulationTaskSpecAccess(scope, taskSpecRow);
  const taskSpec = readSimulationTaskSpecRow(taskSpecRow);
  const evaluationVisibility = taskSpec.evaluationSpecRef.visibility ?? 'preview';
  return {
    taskSpecId: getString(taskSpecRow, 'id') || null,
    simulationRunId: null,
    accessScope,
    ownerUserId: null,
    classId: taskSpec.launchContext.classId ?? null,
    task: compactSimulationTaskSpec(taskSpec),
    controllerSnapshotRef: null,
    status: 'task_spec_ready',
    summary: {},
    replay: {
      replayToken: null,
      replayState: 'not_run',
    },
    provenance: {
      runKind: null,
      sourceDomain: null,
      sourceRefId: null,
      evaluationVisibility,
      officialEligible: evaluationVisibility === 'official',
      previewOnly: evaluationVisibility !== 'official',
      courseId: taskSpec.launchContext.courseId ?? null,
      classId: taskSpec.launchContext.classId ?? null,
      resourceId: taskSpec.launchContext.resourceId ?? null,
      publicationId: taskSpec.launchContext.publicationId ?? null,
    },
    evidenceStatus: {
      lowEvidence: true,
      confidence: 'low',
      traceAvailable: false,
      replayAvailable: false,
    },
    traceRef: null,
    rawTraceIncluded: false,
  };
}

async function createKonlingVirtualSimulationRun(
  db: KonlingRuntimeDb,
  scope: KonlingRuntimeScope,
  input: RunVirtualSimulationInput,
  refs: { agentSessionId: string | null; agentToolRunId: string | null },
) {
  const sourceRefId = buildKonlingSimulationSourceRefId(scope, input.idempotencyKey);
  const existingRun = await db.simulationRun?.findFirst?.({
    where: {
      ...buildSimulationRunScopeWhere(scope, {}),
      sourceDomain: 'konling_agent',
      sourceRefId,
    },
    include: {
      taskSpec: true,
      traces: {
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
    },
  });
  if (existingRun) {
    assertSimulationRunAccess(scope, existingRun as SimulationDbRun);
    await persistKonlingSimulationEvidence(
      db,
      existingRun,
      arrayOfRecords(getValue(existingRun, 'traces'))[0] ?? null,
    );
    return buildSimulationRunCreationOutput(existingRun as SimulationDbRun);
  }
  const taskSpec = buildScopedSimulationTaskSpec(scope, input.taskSpec, refs.agentSessionId);
  const taskSpecRow = await resolveOrCreateSimulationTaskSpec(db, taskSpec);
  const summaryMetrics = input.summaryMetrics ?? input.trace?.summaryMetrics ?? {};
  const summary = {
    metrics: summaryMetrics,
    agentSessionId: refs.agentSessionId,
    agentToolRunId: refs.agentToolRunId,
    provenance: {
      runKind: 'agent_experiment',
      sourceDomain: 'konling_agent',
      evaluationVisibility: taskSpec.evaluationSpecRef.visibility ?? 'preview',
    },
    lowEvidence: Object.keys(summaryMetrics).length === 0,
  };
  const run = await db.simulationRun?.create?.({
    data: {
      ownerUserId: scope.targetUserId,
      classId: scope.classId ?? null,
      courseId: scope.courseId,
      resourceId: scope.resourceId ?? null,
      sessionId: refs.agentSessionId,
      runKind: 'agent_experiment',
      sourceDomain: 'konling_agent',
      sourceRefId,
      taskSpecId: getString(taskSpecRow, 'id') || null,
      taskSpecSnapshot: taskSpec,
      controllerSnapshotRef: input.controllerSnapshotRef ?? null,
      status: 'completed',
      summary,
      replayToken: `konling-replay:${sourceRefId}`,
      seed: typeof input.seed === 'number' ? BigInt(input.seed) : null,
      protocolVersion: '1.0',
      runtimeVersion: 'konling-simulation-tool-v1',
      modelVersion: taskSpec.scenarioId,
      sceneSpecVersion: taskSpec.sceneId,
      startedAt: new Date(),
      completedAt: new Date(),
    },
  });
  if (!run) {
    throw new KonlingRuntimeScopeError(404, 'SimulationRun 存储不可用。');
  }
  const trace = await db.simulationTrace?.create?.({
    data: {
      runId: getString(run, 'id'),
      protocolVersion: '1.0',
      runtimeVersion: 'konling-simulation-tool-v1',
      modelVersion: taskSpec.scenarioId,
      seed: typeof input.seed === 'number' ? BigInt(input.seed) : null,
      checksum: input.trace?.checksum ?? hashSimulationValue({ sourceRefId, summaryMetrics }),
      summaryMetrics,
      sampleCount: input.trace?.sampleCount ?? 0,
      sampleCadence: input.trace?.sampleCadence ?? 0,
      sampleStorageUri: input.trace?.sampleStorageUri ?? null,
    },
  });
  await persistKonlingSimulationEvidence(db, run, trace ?? null);
  return buildSimulationRunCreationOutput(run as SimulationDbRun, trace as SimulationDbTrace | null, taskSpec);
}

async function persistKonlingSimulationEvidence(
  db: KonlingRuntimeDb,
  run: unknown,
  trace: unknown | null,
) {
  if (!db.learningFact?.createMany) return;
  await persistSimulationAgentEvidenceMaterialization(
    {
      learningFact: { createMany: db.learningFact.createMany },
      learningEvidenceDraft: db.learningEvidenceDraft?.createMany
        ? { createMany: db.learningEvidenceDraft.createMany }
        : undefined,
      evidenceOutbox: db.evidenceOutbox?.createMany
        ? { createMany: db.evidenceOutbox.createMany }
        : undefined,
    },
    {
      simulationRuns: [
        {
          run: readRecord(run),
          trace: trace ? readRecord(trace) : null,
        },
      ],
    },
  );
}

async function persistKonlingAgentToolEvidence(
  db: KonlingRuntimeDb,
  toolRun: Record<string, unknown>,
) {
  if (!db.learningFact?.createMany) return;
  await persistSimulationAgentEvidenceMaterialization(
    {
      learningFact: { createMany: db.learningFact.createMany },
      learningEvidenceDraft: db.learningEvidenceDraft?.createMany
        ? { createMany: db.learningEvidenceDraft.createMany }
        : undefined,
      evidenceOutbox: db.evidenceOutbox?.createMany
        ? { createMany: db.evidenceOutbox.createMany }
        : undefined,
    },
    {
      agentToolRuns: [toolRun],
    },
  );
}

function buildKonlingSimulationSourceRefId(scope: KonlingRuntimeScope, idempotencyKey: string) {
  const resourcePart = scope.resourceId ? `resource:${scope.resourceId}` : 'resource:none';
  return [
    'konling',
    scope.targetUserId,
    `course:${scope.courseId}`,
    resourcePart,
    `page:${scope.pageId}`,
    'run_virtual_simulation',
    idempotencyKey,
  ].join(':');
}

function buildSimulationRunCreationOutput(
  run: SimulationDbRun,
  traceInput?: SimulationDbTrace | null,
  taskSpecInput?: SimulationTaskSpecV1,
) {
  const trace = traceInput ?? arrayOfRecords(getValue(run, 'traces'))[0] ?? null;
  return {
    simulationRunId: getString(run, 'id'),
    traceId: trace ? getString(trace, 'id') : null,
    status: getString(run, 'status'),
    summary: readRecord(getValue(run, 'summary')),
    provenance: buildSimulationProvenance(run, taskSpecInput),
    evidenceStatus: buildSimulationEvidenceStatus(run, trace),
  };
}

function buildScopedSimulationTaskSpec(
  scope: KonlingRuntimeScope,
  input: RunVirtualSimulationInput['taskSpec'],
  agentSessionId: string | null,
): SimulationTaskSpecV1 {
  const launchContext = {
    ...(input.launchContext ?? {}),
    courseId: scope.courseId,
    classId: scope.classId ?? undefined,
    resourceId: scope.resourceId ?? undefined,
    pageId: scope.pageId,
    agentSessionId: agentSessionId ?? undefined,
  };
  return buildSimulationTaskSpec({
    ...(input as SimulationTaskSpecInputV1),
    launchContext,
  });
}

async function resolveOrCreateSimulationTaskSpec(db: KonlingRuntimeDb, taskSpec: SimulationTaskSpecV1) {
  const existing = await db.simulationTaskSpec?.findFirst?.({
    where: { specHash: taskSpec.specHash },
  });
  if (existing) return existing as SimulationDbTaskSpec;
  const created = await db.simulationTaskSpec?.create?.({
    data: {
      schemaVersion: taskSpec.schemaVersion,
      sceneId: taskSpec.sceneId,
      scenarioId: taskSpec.scenarioId,
      specHash: taskSpec.specHash,
      payload: taskSpec,
      launchContext: taskSpec.launchContext,
    },
  });
  if (!created) {
    throw new KonlingRuntimeScopeError(404, 'SimulationTaskSpec 存储不可用。');
  }
  return created as SimulationDbTaskSpec;
}

function buildSimulationTraceAnalysisOutput(
  scope: KonlingRuntimeScope,
  run: SimulationDbRun,
  trace: SimulationDbTrace | null,
) {
  const context = buildSimulationContextOutput(scope, run, { includeTrace: true });
  return {
    simulationRunId: context.simulationRunId,
    traceId: trace ? getString(trace, 'id') : null,
    accessScope: context.accessScope,
    analyzer: {
      summaryMetrics: trace ? readRecord(getValue(trace, 'summaryMetrics')) : context.summary,
      sampleCount: trace ? getNumber(trace, 'sampleCount') : 0,
      lowEvidence: context.evidenceStatus.lowEvidence,
      confidence: context.evidenceStatus.lowEvidence ? 'low' : 'medium',
    },
    provenance: context.provenance,
    evidenceReferences: [
      { kind: 'SimulationRun', id: context.simulationRunId },
      ...(trace ? [{ kind: 'SimulationTrace', id: getString(trace, 'id') }] : []),
    ],
    rawTraceIncluded: false,
  };
}

function buildSimulationComparisonOutput(scope: KonlingRuntimeScope, runs: SimulationDbRun[]) {
  const summaries = runs.map((run) => buildSimulationContextOutput(scope, run, { includeTrace: false }));
  return {
    comparedRunIds: summaries.map((summary) => summary.simulationRunId),
    accessScope: summaries[0]?.accessScope ?? 'none',
    runs: summaries.map((summary) => ({
      simulationRunId: summary.simulationRunId,
      status: summary.status,
      summary: summary.summary,
      provenance: summary.provenance,
      evidenceStatus: summary.evidenceStatus,
      replay: summary.replay,
    })),
    lowConfidenceRunIds: summaries
      .filter((summary) => summary.evidenceStatus.lowEvidence)
      .map((summary) => summary.simulationRunId),
    rawTraceIncluded: false,
  };
}

function buildControllerPatchProposal(
  scope: KonlingRuntimeScope,
  run: SimulationDbRun,
  input: ProposeControllerPatchInput,
) {
  const context = buildSimulationContextOutput(scope, run, { includeTrace: false });
  const metrics = readSimulationSummaryMetrics(context.summary);
  const candidatePatch = inferControllerPatch(metrics, input.targetMetrics ?? {});
  return {
    simulationRunId: context.simulationRunId,
    candidatePatch,
    rationale: input.objective ?? '基于当前仿真摘要生成控制器草稿补丁候选。',
    affectedControllerFields: Object.keys(candidatePatch),
    expectedTradeoffs: input.constraints ?? [],
    evidenceReferences: [
      { kind: 'SimulationRun', id: context.simulationRunId },
      ...(context.traceRef ? [{ kind: 'SimulationTrace', id: context.traceRef.traceId }] : []),
    ],
    provenance: context.provenance,
    mutatesControllerDraft: false,
  };
}

function readSimulationSummaryMetrics(summary: Record<string, unknown>) {
  const metrics = readRecord(getValue(summary, 'metrics'));
  return Object.keys(metrics).length > 0 ? metrics : summary;
}

function buildPendingControllerPatch(
  scope: KonlingRuntimeScope,
  run: SimulationDbRun,
  input: ApplyControllerPatchInput,
) {
  return {
    simulationRunId: input.simulationRunId,
    patch: input.patch,
    rationale: input.rationale ?? null,
    scope: buildToolScopeRef(scope),
    provenance: buildSimulationProvenance(run),
  };
}

async function applyApprovedControllerPatchToSession(
  db: KonlingRuntimeDb,
  scope: KonlingRuntimeScope,
  toolRunId: string,
  toolRun: unknown,
) {
  const input = readRecord(getValue(toolRun, 'inputSummary'));
  const patch = readRecord(getValue(input, 'patch'));
  const simulationRunId = getString(input, 'simulationRunId');
  if (!simulationRunId || Object.keys(patch).length === 0) {
    throw new KonlingRuntimeScopeError(400, '批准的 controller patch 缺少 simulationRunId 或 patch。');
  }
  const agentSessionId = getString(toolRun, 'agentSessionId');
  const existingSession = await db.agentSession?.findFirst?.({
    where: buildAgentSessionScopeWhere(scope, agentSessionId),
    select: { stateJson: true },
  });
  if (!existingSession) {
    throw new KonlingRuntimeScopeError(404, 'AgentSession 不存在或不属于当前用户作用域。');
  }
  const existingState = readRecord(getValue(existingSession, 'stateJson'));
  const result = await db.agentSession?.updateMany?.({
    where: buildAgentSessionScopeWhere(scope, agentSessionId),
    data: {
      stateJson: {
        ...existingState,
        controllerDraft: {
          simulationRunId,
          patch,
          rationale: getString(input, 'rationale') || null,
          sourceToolRunId: toolRunId,
          appliedAt: new Date().toISOString(),
        },
      },
      pendingApproval: null,
    },
  });
  const updatedCount = typeof getValue(result, 'count') === 'number' ? getValue(result, 'count') as number : 0;
  if (updatedCount !== 1) {
    throw new KonlingRuntimeScopeError(404, 'AgentSession 不存在或不属于当前用户作用域。');
  }
}

function toSimulationRunEnvelope(run: SimulationDbRun): SimulationRunEnvelopeV1 {
  const taskSpec = readSimulationTaskSpec(run);
  return {
    id: getString(run, 'id'),
    ownerUserId: getString(run, 'ownerUserId') || null,
    classId: getString(run, 'classId') || null,
    courseId: getString(run, 'courseId') || null,
    sessionId: getString(run, 'sessionId') || null,
    resourceId: getString(run, 'resourceId') || null,
    publicationId: getString(run, 'publicationId') || null,
    runKind: normalizeSimulationRunKind(getString(run, 'runKind')),
    sourceDomain: normalizeSimulationSourceDomain(getString(run, 'sourceDomain')),
    sourceRefId: getString(run, 'sourceRefId'),
    taskSpec,
    controllerSnapshotRef: getString(run, 'controllerSnapshotRef') || null,
    status: normalizeSimulationRunStatus(getString(run, 'status')),
    summary: readRecord(getValue(run, 'summary')),
    replayToken: getString(run, 'replayToken') || null,
    seed: getBigIntNumberOrNull(getValue(run, 'seed')),
    protocolVersion: getString(run, 'protocolVersion') || '1.0',
    runtimeVersion: getString(run, 'runtimeVersion') || 'unknown',
    modelVersion: getString(run, 'modelVersion') || 'unknown',
    sceneSpecVersion: getString(run, 'sceneSpecVersion') || null,
    createdAt: toIsoOrNull(getValue(run, 'createdAt')) ?? new Date(0).toISOString(),
    startedAt: toIsoOrNull(getValue(run, 'startedAt')),
    completedAt: toIsoOrNull(getValue(run, 'completedAt')),
  };
}

function readSimulationTaskSpec(run: SimulationDbRun): SimulationTaskSpecV1 {
  const relatedTaskSpec = readRecord(getValue(run, 'taskSpec'));
  const relatedPayload = readRecord(getValue(relatedTaskSpec, 'payload'));
  const snapshot = readRecord(getValue(run, 'taskSpecSnapshot'));
  const candidate = Object.keys(relatedPayload).length > 0 ? relatedPayload : snapshot;
  return normalizeSimulationTaskSpec(candidate);
}

function readSimulationTaskSpecRow(taskSpecRow: SimulationDbTaskSpec): SimulationTaskSpecV1 {
  const payload = readRecord(getValue(taskSpecRow, 'payload'));
  const candidate = Object.keys(payload).length > 0 ? payload : taskSpecRow;
  return normalizeSimulationTaskSpec(candidate);
}

function normalizeSimulationTaskSpec(value: Record<string, unknown>): SimulationTaskSpecV1 {
  if (getString(value, 'schemaVersion') === 'simulation-task-spec-v1' && getString(value, 'specHash')) {
    return value as unknown as SimulationTaskSpecV1;
  }
  return buildSimulationTaskSpec({
    sceneId: getString(value, 'sceneId') || 'unknown-scene',
    scenarioId: getString(value, 'scenarioId') || 'unknown-scenario',
    objectives: arrayOfStrings(getValue(value, 'objectives')),
    constraints: arrayOfStrings(getValue(value, 'constraints')),
    disturbancePolicy: readRecord(getValue(value, 'disturbancePolicy')),
    evaluationSpecRef: {
      id: getString(readRecord(getValue(value, 'evaluationSpecRef')), 'id') || 'unknown-evaluation',
      visibility: normalizeEvaluationVisibility(getString(readRecord(getValue(value, 'evaluationSpecRef')), 'visibility')),
    },
    allowedControllers: arrayOfStrings(getValue(value, 'allowedControllers')),
    launchContext: readRecord(getValue(value, 'launchContext')),
  });
}

function compactSimulationTaskSpec(taskSpec: SimulationTaskSpecV1) {
  return {
    taskSpecHash: taskSpec.specHash,
    sceneId: taskSpec.sceneId,
    scenarioId: taskSpec.scenarioId,
    objectives: taskSpec.objectives,
    constraints: taskSpec.constraints,
    evaluationSpecRef: taskSpec.evaluationSpecRef,
    allowedControllers: taskSpec.allowedControllers,
    launchContext: taskSpec.launchContext,
  };
}

function buildSimulationProvenance(run: SimulationDbRun, taskSpecInput?: SimulationTaskSpecV1) {
  const summary = readRecord(getValue(run, 'summary'));
  const previewBoundary = readRecord(getValue(summary, 'previewBoundary'));
  const taskSpec = taskSpecInput ?? readSimulationTaskSpec(run);
  const evaluationVisibility =
    normalizeEvaluationVisibility(getString(previewBoundary, 'evaluationVisibility')) ??
    taskSpec.evaluationSpecRef.visibility ??
    'preview';
  const runKind = getString(run, 'runKind') || 'agent_experiment';
  const sourceDomain = getString(run, 'sourceDomain') || 'konling_agent';
  const officialEligible =
    getValue(previewBoundary, 'officialEligible') === true ||
    evaluationVisibility === 'official' ||
    sourceDomain === 'arena_official_evaluation';
  return {
    runKind,
    sourceDomain,
    sourceRefId: getString(run, 'sourceRefId') || null,
    evaluationVisibility,
    officialEligible,
    previewOnly: evaluationVisibility === 'preview' || officialEligible === false,
    courseId: getString(run, 'courseId') || null,
    classId: getString(run, 'classId') || null,
    resourceId: getString(run, 'resourceId') || null,
    publicationId: getString(run, 'publicationId') || null,
  };
}

function buildSimulationEvidenceStatus(run: SimulationDbRun, trace: SimulationDbTrace | null) {
  const summary = readRecord(getValue(run, 'summary'));
  const lowEvidence = getValue(summary, 'lowEvidence') === true || !trace;
  return {
    lowEvidence,
    confidence: lowEvidence ? 'low' : 'medium',
    traceAvailable: Boolean(trace),
    replayAvailable: Boolean(getString(run, 'replayToken')),
  };
}

function formatSimulationTraceRef(
  trace: SimulationDbTrace,
  options: { includeStorageUri?: boolean } = {},
) {
  return {
    traceId: getString(trace, 'id'),
    checksum: getString(trace, 'checksum') || null,
    sampleCount: getNumber(trace, 'sampleCount'),
    sampleCadence: getNumber(trace, 'sampleCadence'),
    sampleStorageUri: options.includeStorageUri ? getString(trace, 'sampleStorageUri') || null : null,
    summaryMetrics: readRecord(getValue(trace, 'summaryMetrics')),
    createdAt: toIsoOrNull(getValue(trace, 'createdAt')),
  };
}

function inferControllerPatch(
  metrics: Record<string, unknown>,
  targetMetrics: Record<string, unknown>,
) {
  const patch: Record<string, unknown> = {};
  if (typeof metrics.overshoot === 'number' && metrics.overshoot > 0.2) patch.kp = 0.9;
  if (typeof metrics.settlingTime === 'number' && metrics.settlingTime > 5) patch.ki = 0.05;
  for (const [key, value] of Object.entries(targetMetrics)) {
    if (key.startsWith('controller.')) {
      patch[key.slice('controller.'.length)] = value;
    }
  }
  return Object.keys(patch).length > 0 ? patch : { kp: 1, ki: 0, kd: 0 };
}

function toSimulationAccessRole(role: AdaptiveLearnerStateRole): SimulationAccessRole {
  if (role === 'teacher') return 'TEACHER';
  if (role === 'admin' || role === 'system') return 'ADMIN';
  return 'STUDENT';
}

function normalizeSimulationRunKind(value: string): SimulationRunEnvelopeV1['runKind'] {
  if (value === 'arena_preview' || value === 'teacher_batch' || value === 'agent_experiment') return value;
  return 'scene_simulation';
}

function normalizeSimulationSourceDomain(value: string): SimulationRunEnvelopeV1['sourceDomain'] {
  if (
    value === 'arena_virtual_preview' ||
    value === 'arena_official_evaluation' ||
    value === 'konling_agent' ||
    value === 'teacher_batch'
  ) {
    return value;
  }
  return 'simulation_scene';
}

function normalizeSimulationRunStatus(value: string): SimulationRunEnvelopeV1['status'] {
  if (value === 'queued' || value === 'running' || value === 'failed' || value === 'abandoned') return value;
  return 'completed';
}

function normalizeEvaluationVisibility(value: string): 'preview' | 'official' | 'both' | undefined {
  if (value === 'official' || value === 'both') return value;
  if (value === 'preview') return 'preview';
  return undefined;
}

function hashSimulationValue(value: unknown) {
  return `sha256:${createHash('sha256').update(JSON.stringify(value)).digest('hex')}`;
}

export interface KonlingTextbookModelToolResult {
  mode: TextbookV2ToolResult['mode'];
  optimizationPending: boolean;
  candidates: Array<{
    displayNumber: number;
    title: string;
    text: string;
    limitation: string | null;
  }>;
}

const KONLING_TEXTBOOK_MODEL_INTERNAL_FIELD =
  /["']?(?:canonicalKey|bookId|edition|sourceRevision|unitId|fragmentId|structuralPath|identity)["']?\s*[:=]\s*(?:\{[^}\n]*\}|\[[^\]\n]*\]|"[^"\n]*"|'[^'\n]*'|[^\s,，。；;)\]}]+)/gi;
const KONLING_TEXTBOOK_MODEL_INTERNAL_ID =
  /\b(?:textbook-(?:unit|fragment|window)|textbook):[^\s,，。；;)\]}]+/gi;
const KONLING_TEXTBOOK_MODEL_SOURCE_SLUG =
  /\b(?:hu-shousong-auto-control-(?:7th|8th)|liu-sheng-auto-control-2015|dorf-modern-control-systems|feedback-control-of-dynamic-systems|hu-shousong-exercise-analysis-3rd|control-encyclopedia)\b/gi;
const KONLING_TEXTBOOK_MODEL_STRUCTURE_PATH = /\b(?:chapter|section)-[a-z0-9._-]+\b/gi;
const KONLING_TEXTBOOK_MODEL_LOCAL_PATH =
  /(?:file:\/\/|\/(?:Users|home|workspace|course-content|src|var|tmp)\/)[^\s)\]}]+/gi;
const KONLING_TEXTBOOK_MODEL_URL = /https?:\/\/[^\s)\]}，。；、]+/gi;

function sanitizeKonlingTextbookModelText(value: string) {
  return value
    .replace(KONLING_TEXTBOOK_MODEL_INTERNAL_FIELD, '')
    .replace(KONLING_TEXTBOOK_MODEL_INTERNAL_ID, '')
    .replace(KONLING_TEXTBOOK_MODEL_SOURCE_SLUG, '')
    .replace(KONLING_TEXTBOOK_MODEL_STRUCTURE_PATH, '')
    .replace(KONLING_TEXTBOOK_MODEL_LOCAL_PATH, '')
    .replace(KONLING_TEXTBOOK_MODEL_URL, '')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

export function projectKonlingTextbookModelToolResult(
  result: unknown,
): KonlingTextbookModelToolResult {
  const record = readRecord(result);
  const mode = getString(record, 'mode');
  const rawCandidates = Array.isArray(record.candidates) ? record.candidates : [];
  return {
    mode: mode === 'lexical-vector' ? 'lexical-vector' : 'lexical',
    optimizationPending: record.optimizationPending === true,
    candidates: rawCandidates.flatMap((value) => {
      const candidate = readRecord(value);
      const displayNumber = getNumber(candidate, 'displayNumber');
      const title = getString(candidate, 'title');
      const text = getString(candidate, 'text');
      if (!Number.isInteger(displayNumber) || displayNumber < 1 || !title || !text) return [];
      return [{
        displayNumber,
        title: sanitizeKonlingTextbookModelText(title),
        text: sanitizeKonlingTextbookModelText(text),
        limitation: getString(candidate, 'limitation') || null,
      }];
    }),
  };
}

export function buildScopedKonlingAiTools(runtime: ReturnType<typeof buildKonlingToolRuntime>) {
  const tools = {
    get_page_context: tool({
      description: '读取服务端确认的当前页面上下文。',
      inputSchema: z.object({}),
      execute: () => runtime.getPageContext(),
    }),
    search_textbook: tool({
      description: '按当前问题检索授权教材正文。只在课程知识支撑确有必要时调用；导航、状态或普通操作问题无需调用。',
      inputSchema: z.object({
        query: z.string().trim().min(1).max(500),
      }),
      execute: async (args, options) => projectKonlingTextbookModelToolResult(
        await runtime.searchTextbook(args, {
          toolCallId: options.toolCallId,
          abortSignal: options.abortSignal,
        }),
      ),
    }),
    get_learner_state: tool({
      description: '读取服务端学习者状态，包含能力、知识掌握、风险与证据置信度。',
      inputSchema: z.object({}),
      execute: () => runtime.getLearnerState(),
    }),
    get_student_risk_flags: tool({
      description: '读取当前教师授权班级内的受治理风险摘要；不返回原始证据载荷。',
      inputSchema: teacherDiagnosisStudentParameters,
      execute: (args) => runtime.getStudentRiskFlags(args),
    }),
    get_class_competency_summary: tool({
      description: '读取当前教师授权班级的能力聚合、成员分母、证据覆盖与置信度。',
      inputSchema: teacherDiagnosisClassParameters,
      execute: (args) => runtime.getClassCompetencySummary(args),
    }),
    get_student_knowledge_progress: tool({
      description: '读取当前教师授权班级成员的知识点进度摘要与证据引用。',
      inputSchema: teacherDiagnosisStudentParameters,
      execute: (args) => runtime.getStudentKnowledgeProgress(args),
    }),
    get_plan_context: tool({
      description: '读取当前学习路径与下一步节点上下文。',
      inputSchema: z.object({}),
      execute: () => runtime.getPlanContext(),
    }),
    search_learning_memory: tool({
      description: '检索隐私范围允许的 Konling 学习记忆摘要。',
      inputSchema: z.object({
        query: z.string().optional(),
        limit: z.number().int().min(1).max(10).optional(),
      }),
      execute: (args) => runtime.searchLearningMemory(args),
    }),
    search_knowledge_graph: tool({
      description: '按关键词检索课程知识图谱节点。',
      inputSchema: z.object({
        query: z.string().optional(),
        limit: z.number().int().min(1).max(10).optional(),
      }),
      execute: (args) => runtime.searchKnowledgeGraph(args),
    }),
    search_candidate_canonical: tool({
      description: '在服务端固定 ReleaseSet 中按 Canonical ID、类型和权威字段检索候选对象；禁止推断 Legacy 对应项。',
      inputSchema: candidateCanonicalSearchParameters,
      execute: (args) => runtime.searchCandidateCanonical(args),
    }),
    get_candidate_canonical_detail: tool({
      description: '读取服务端固定 ReleaseSet 中的角色安全 Canonical 对象详情。',
      inputSchema: candidateCanonicalDetailParameters,
      execute: (args) => runtime.getCandidateCanonicalDetail(args),
    }),
    get_candidate_canonical_neighbors: tool({
      description: '读取服务端固定 ReleaseSet 中的有界一跳邻居，保留谓词、方向、遍历方向和治理等级。',
      inputSchema: candidateCanonicalNeighborsParameters,
      execute: (args) => runtime.getCandidateCanonicalNeighbors(args),
    }),
    recommend_next_action: tool({
      description: '基于学习状态、路径和记忆推荐下一步动作。',
      inputSchema: z.object({}),
      execute: () => runtime.recommendNextAction(),
    }),
    get_simulation_status: tool({
      description: '读取当前资源范围内的仿真状态。',
      inputSchema: getSimulationStatusInputSchema,
      execute: (args) => runtime.getSimulationStatus(args),
    }),
    set_simulation_params: tool({
      description: '在当前资源范围内创建仿真参数修改请求，等待学生在仿真界面确认。',
      inputSchema: setSimulationParamsInputSchema.extend({
        idempotencyKey: KONLING_IDEMPOTENCY_KEY_PARAMETER,
      }),
      execute: (args) => runtime.setSimulationParams(args),
    }),
    analyze_result: tool({
      description: '分析当前资源范围内的仿真结果，给出控制性能、安全性与参数建议。',
      inputSchema: analyzeResultInputSchema,
      execute: (args) => runtime.analyzeResult(args),
    }),
    get_simulation_context: tool({
      description: '读取持久化 SimulationRun 或 SimulationTaskSpec 的仿真上下文摘要。',
      inputSchema: simulationContextParameters,
      execute: (args) => runtime.getSimulationContext(args),
    }),
    run_virtual_simulation: tool({
      description: '通过持久化 SimulationRun 和 SimulationTrace 创建一次幂等虚拟仿真运行。',
      inputSchema: runVirtualSimulationParameters,
      execute: (args) => runtime.runVirtualSimulation(args),
    }),
    analyze_simulation_trace: tool({
      description: '基于持久化 SimulationTrace 摘要分析仿真表现，默认不暴露高频原始样本。',
      inputSchema: analyzeSimulationTraceParameters,
      execute: (args) => runtime.analyzeSimulationTrace(args),
    }),
    compare_simulation_runs: tool({
      description: '比较同一授权 owner 或班级范围内的多个持久化仿真运行。',
      inputSchema: compareSimulationRunsParameters,
      execute: (args) => runtime.compareSimulationRuns(args),
    }),
    propose_controller_patch: tool({
      description: '基于仿真证据提出控制器补丁候选，不直接改变控制器草稿。',
      inputSchema: proposeControllerPatchParameters,
      execute: (args) => runtime.proposeControllerPatch(args),
    }),
    apply_controller_patch: tool({
      description: '申请将控制器补丁写入当前 owner 的控制器草稿，必须等待 approval。',
      inputSchema: applyControllerPatchParameters,
      execute: (args) => runtime.applyControllerPatch(args),
    }),
    record_intervention_result: tool({
      description: '记录学生对 Konling 干预的接受、忽略或评分结果；AI 工具路径只创建待审批请求，不替学生直接确认。',
      inputSchema: z.object({
        interventionId: z.string(),
        feedback: z.enum(['accepted', 'ignored', 'rejected', 'partially-accepted', 'dismissed', 'rated']),
        helpful: z.boolean().optional(),
        studentResponse: z.string().optional(),
        idempotencyKey: KONLING_IDEMPOTENCY_KEY_PARAMETER,
      }),
      execute: (args) => runtime.recordInterventionResult(args),
    }),
    generate_learning_path: tool({
      description: '基于服务端学习者状态和当前页面目标生成受治理的自适应学习路径方案。',
      inputSchema: generateLearningPathParameters,
      execute: (args) => runtime.generateLearningPath(args),
    }),
    revise_learning_path_options: tool({
      description: '在不扩大用户、班级、课程、目标或隐私范围的前提下调整学习路径方案。',
      inputSchema: reviseLearningPathOptionsParameters,
      execute: (args) => runtime.reviseLearningPathOptions(args),
    }),
    select_learning_path: tool({
      description: '仅依据已持久化候选批次解析学生的路径选择；唯一匹配时返回稳定候选身份，存在歧义时返回澄清选项，不直接开始学习。',
      inputSchema: selectLearningPathParameters,
      execute: (args) => runtime.selectLearningPath(args),
    }),
    reject_learning_path_option: tool({
      description: '记录学生拒绝某个学习路径方案及学生可见原因。',
      inputSchema: rejectLearningPathOptionParameters,
      execute: (args) => runtime.rejectLearningPathOption(args),
    }),
    explain_learning_path_tradeoff: tool({
      description: '用学生可理解的语言解释路径方案之间的时间、资源和检查点取舍。',
      inputSchema: explainLearningPathTradeoffParameters,
      execute: (args) => runtime.explainLearningPathTradeoff(args),
    }),
    record_path_adjustment_outcome: tool({
      description: '记录路径调整、采纳、忽略或有用性反馈，保留审计链但不写入掌握度。',
      inputSchema: recordPathAdjustmentOutcomeParameters,
      execute: (args) => runtime.recordPathAdjustmentOutcome(args),
    }),
    propose_smart_lesson_task_change: tool({
      description: '将教师本轮自然语言投影为完整结构化单课任务建议。无任务时使用 bootstrap，已有任务时使用 revise 并携带当前 revision。信息不唯一时只提交 clarification，且不得同时提交 proposedTask、knowledgePointPatches 或 goalPatches；范围已明确时提交 proposedTask 或补丁，且不得携带 clarification。只保存待确认建议，不直接创建或修改任务。',
      inputSchema: proposeSmartLessonTaskChangeToolParameters,
      execute: (args) => runtime.proposeSmartLessonTaskChange(args),
    }),
    analyze_attempt: tool({
      description: '分析最近尝试并判断是否需要纠偏或补救干预。',
      inputSchema: z.object({
        studentState: z.any(),
      }),
      execute: (args) => runtime.analyzeAttempt(args as { studentState: StudentState }),
    }),
    calculate: tool({
      description: '使用 Wolfram 符号计算引擎求解数学表达式，返回 LaTeX 结果与中间步骤；该运行时入口仅供受治理的服务端调用，不向聊天模型暴露。',
      inputSchema: calculateToolParameters,
      execute: (args) => runtime.calculate(args),
    }),
  };
  if (!('permittedTools' in runtime)) {
    return tools;
  }
  const permittedTools = new Set<string>(normalizeKonlingToolNames(runtime.permittedTools));
  return Object.fromEntries(
    Object.entries(tools).filter(([toolName]) => permittedTools.has(toolName)),
  ) as typeof tools;
}

export async function createKonlingMemory(
  db: KonlingRuntimeDb,
  input: KonlingMemoryCreateInput,
): Promise<KonlingMemoryView | null> {
  assertMemoryWriteScope(input.scope, input.userId);
  const summary = sanitizeMemorySummary(input.summary);
  if (!summary) return null;
  const created = await db.konlingMemory?.create?.({
    data: {
      userId: input.userId,
      sessionId: input.sessionId ?? null,
      classId: input.classId ?? null,
      courseId: input.courseId ?? null,
      pageId: input.pageId ?? null,
      resourceId: input.resourceId ?? null,
      pathNodeId: input.pathNodeId ?? null,
      memoryType: input.memoryType,
      privacyScope: input.privacyScope ?? 'student-visible',
      summary,
      evidenceRefs: redactSensitivePayload(input.evidenceRefs ?? []),
      metadata: redactSensitivePayload(input.metadata ?? {}),
      expiresAt: input.expiresAt ?? null,
    },
  });
  return created ? toMemoryView(created) : null;
}

export async function createScopedKonlingMemory(
  db: KonlingRuntimeDb,
  input: Omit<KonlingMemoryCreateInput, 'userId' | 'sessionId' | 'classId' | 'courseId' | 'pageId' | 'resourceId' | 'pathNodeId' | 'scope'> & {
    scope: KonlingRuntimeScope;
    sessionId?: string | null;
  },
): Promise<KonlingMemoryView | null> {
  assertMemoryWriteScope(input.scope, input.scope.targetUserId);
  return createKonlingMemory(db, {
    ...input,
    scope: input.scope,
    userId: input.scope.targetUserId,
    sessionId: input.sessionId ?? null,
    classId: input.scope.classId ?? null,
    courseId: input.scope.courseId,
    pageId: input.scope.pageId,
    resourceId: input.scope.resourceId ?? null,
    pathNodeId: input.scope.pathNodeId ?? null,
  });
}

export async function persistKonlingSessionMemories(
  db: KonlingRuntimeDb,
  input: {
    userId: string;
    sessionId: string;
    courseId: string;
    pageId: string;
    classId?: string | null;
    resourceId?: string | null;
    pathNodeId?: string | null;
    userMessage: string;
    assistantMessage: string;
  },
): Promise<KonlingMemoryView[]> {
  const summaries = buildNonVerbatimSessionSummaries(input);
  const working = await createKonlingMemory(db, {
    userId: input.userId,
    sessionId: input.sessionId,
    classId: input.classId,
    courseId: input.courseId,
    pageId: input.pageId,
    memoryType: 'working-summary',
    resourceId: input.resourceId,
    pathNodeId: input.pathNodeId,
    summary: summaries.working,
    evidenceRefs: [{ kind: 'konling-session', ref: input.sessionId }],
  });
  const session = await createKonlingMemory(db, {
    userId: input.userId,
    sessionId: input.sessionId,
    classId: input.classId,
    courseId: input.courseId,
    pageId: input.pageId,
    memoryType: 'session-summary',
    resourceId: input.resourceId,
    pathNodeId: input.pathNodeId,
    summary: summaries.session,
    evidenceRefs: [{ kind: 'konling-session', ref: input.sessionId }],
  });
  const episodic = await createKonlingMemory(db, {
    userId: input.userId,
    sessionId: input.sessionId,
    classId: input.classId,
    courseId: input.courseId,
    pageId: input.pageId,
    memoryType: 'episodic',
    resourceId: input.resourceId,
    pathNodeId: input.pathNodeId,
    summary: summaries.episodic,
    evidenceRefs: [{ kind: 'konling-user-message', ref: input.sessionId }],
  });
  return [working, session, episodic].filter((item): item is KonlingMemoryView => Boolean(item));
}

export async function createGovernedKonlingIntervention(
  db: KonlingRuntimeDb,
  input: KonlingInterventionInput,
): Promise<KonlingInterventionRecord> {
  if (input.arenaContext || isClientAuthoredArenaCompanionScope(input.scope)) {
    throw new Error('Arena 受治理干预不能由客户端尝试状态创建');
  }
  const now = input.now ?? new Date();
  const interventionSessionId = buildKonlingInterventionSessionId(input.scope, input.arenaContext);
  const evidence = buildInterventionEvidence(input.studentState, input.arenaContext);
  const teacherPolicy = resolveServerTeacherPolicy(input.scope);
  if (teacherPolicy === 'blocked') {
    return {
      id: '',
      shouldIntervene: false,
      reason: 'teacher-policy-blocked',
      interventionType: 'none',
      content: '',
      whyNow: '教师策略阻止本次 Konling 干预。',
      evidence: [],
      alternatives: ['继续当前任务', '请求教师帮助'],
      relatedConcepts: [],
      highlightParams: ['kp'],
      showTrendPrediction: false,
      cooldownUntil: null,
    };
  }

  const recent = await db.aIIntervention?.findFirst?.({
    where: {
      userId: input.scope.targetUserId,
      sessionId: interventionSessionId,
      classId: input.scope.classId ?? null,
      resourceId: input.scope.resourceId ?? null,
      pathNodeId: input.scope.pathNodeId ?? null,
      interventionType: { not: 'feedback-only' },
      cooldownUntil: { gt: now },
    },
    orderBy: { createdAt: 'desc' },
  });
  if (recent) {
    return {
      id: getString(recent, 'id'),
      shouldIntervene: false,
      reason: 'cooldown-active',
      interventionType: getString(recent, 'interventionType') || 'cooldown',
      content: '',
      whyNow: '最近已经触发过 Konling 干预，当前仍处于冷却期。',
      evidence: [],
      alternatives: ['继续当前路径节点', '稍后再请求帮助'],
      relatedConcepts: [],
      highlightParams: ['kp'],
      showTrendPrediction: false,
      cooldownUntil: toIsoOrNull(getValue(recent, 'cooldownUntil')),
    };
  }

  const decided = decideIntervention({
    actorUserId: input.scope.authenticatedUserId,
    subjectUserId: input.scope.targetUserId,
    role: input.scope.role,
    studentState: input.studentState,
    arenaContext: input.arenaContext,
  });
  const decision = decided.decision;
  const payload = decided.payload;
  if (!decision.shouldIntervene) {
    return {
      id: '',
      shouldIntervene: false,
      reason: decision.reason,
      interventionType: 'none',
      content: payload.content,
      whyNow: buildWhyNow(decision, input.studentState),
      evidence,
      alternatives: payload.suggestedNextSteps,
      relatedConcepts: payload.relatedConcepts,
      highlightParams: payload.highlightParams,
      showTrendPrediction: payload.showTrendPrediction,
      cooldownUntil: null,
    };
  }
  const cooldownUntil = new Date(now.getTime() + 20 * 60_000);
  const whyNow = buildWhyNow(decision, input.studentState);
  const alternatives = payload.suggestedNextSteps.slice(0, 3);

  const record = await db.aIIntervention?.create?.({
    data: {
      userId: input.scope.targetUserId,
      sessionId: interventionSessionId,
      classId: input.scope.classId ?? null,
      resourceId: input.scope.resourceId ?? null,
      pathNodeId: input.scope.pathNodeId ?? null,
      triggerType: decision.reason,
      interventionType: payload.feedbackType,
      content: payload.content,
      whyNow,
      evidence,
      alternatives,
      privacyScope: 'student-visible',
      teacherPolicy,
      cooldownUntil,
    },
  });

  const interventionId = getString(record, 'id') || `intv-${now.getTime()}`;
  await createKonlingMemory(db, {
    userId: input.scope.targetUserId,
    sessionId: interventionSessionId,
    classId: input.scope.classId ?? null,
    courseId: input.scope.courseId,
    pageId: input.scope.pageId,
    resourceId: input.scope.resourceId ?? null,
    pathNodeId: input.scope.pathNodeId ?? null,
    memoryType: 'intervention-outcome',
    privacyScope: 'teacher-scoped',
    summary: `${whyNow} 干预类型：${payload.feedbackType}`,
    evidenceRefs: [
      ...evidence,
      { kind: 'ai-intervention', ref: interventionId },
    ],
  });

  return {
    id: interventionId,
    shouldIntervene: decision.shouldIntervene,
    reason: decision.reason,
    interventionType: payload.feedbackType,
    content: payload.content,
    whyNow,
    evidence,
    alternatives,
    relatedConcepts: payload.relatedConcepts,
    highlightParams: payload.highlightParams,
    showTrendPrediction: payload.showTrendPrediction,
    cooldownUntil: cooldownUntil.toISOString(),
  };
}

export async function recordKonlingInterventionFeedback(
  db: KonlingRuntimeDb,
  input: {
    scope: KonlingRuntimeScope;
    interventionId: string;
    feedback: KonlingInterventionFeedback;
    helpful?: boolean;
    studentResponse?: string;
  },
) {
  const existingIntervention = await db.aIIntervention?.findFirst?.({
    where: {
      id: input.interventionId,
      userId: input.scope.targetUserId,
      classId: input.scope.classId ?? null,
      resourceId: input.scope.resourceId ?? null,
      pathNodeId: input.scope.pathNodeId ?? null,
    },
  });
  const outcome = {
    feedback: input.feedback,
    pathOutcome: toPathInterventionOutcome(input.feedback, input.helpful),
    helpful: input.helpful ?? null,
    recordedAt: new Date().toISOString(),
  };
  const executeRaw = (db as { $executeRaw?: (strings: TemplateStringsArray, ...values: unknown[]) => Promise<number> }).$executeRaw;
  let updatedCount = 0;
  if (typeof executeRaw === 'function') {
    updatedCount = await executeRaw`
      UPDATE "AIIntervention"
      SET
        "wasHelpful" = ${input.helpful ?? null},
        "studentResponse" = COALESCE(${input.studentResponse ? sanitizeMemorySummary(input.studentResponse) : null}, "studentResponse"),
        outcome = COALESCE(outcome, '{}'::jsonb) || ${JSON.stringify(outcome)}::jsonb
      WHERE id = ${input.interventionId}
        AND "userId" = ${input.scope.targetUserId}
        AND "classId" IS NOT DISTINCT FROM ${input.scope.classId ?? null}
        AND "resourceId" IS NOT DISTINCT FROM ${input.scope.resourceId ?? null}
        AND "pathNodeId" IS NOT DISTINCT FROM ${input.scope.pathNodeId ?? null}
    `;
  } else {
    const updateResult = await db.aIIntervention?.updateMany?.({
      where: {
        id: input.interventionId,
        userId: input.scope.targetUserId,
        classId: input.scope.classId ?? null,
        resourceId: input.scope.resourceId ?? null,
        pathNodeId: input.scope.pathNodeId ?? null,
      },
      data: {
        wasHelpful: input.helpful ?? null,
        studentResponse: input.studentResponse ? sanitizeMemorySummary(input.studentResponse) : undefined,
        outcome,
      },
    });
    updatedCount = typeof getValue(updateResult, 'count') === 'number' ? getValue(updateResult, 'count') as number : 0;
  }
  if (updatedCount !== 1) {
    throw new KonlingRuntimeScopeError(404, '干预不存在或不属于当前 Konling 作用域。');
  }
  await createKonlingMemory(db, {
    userId: input.scope.targetUserId,
    sessionId: `konling:${input.scope.courseId}:${input.scope.pageId}`,
    classId: input.scope.classId ?? null,
    courseId: input.scope.courseId,
    pageId: input.scope.pageId,
    resourceId: input.scope.resourceId ?? null,
    pathNodeId: input.scope.pathNodeId ?? null,
    memoryType: 'intervention-outcome',
    privacyScope: 'teacher-scoped',
    summary: `学生对干预 ${input.interventionId} 的反馈：${input.feedback}${input.helpful === undefined ? '' : `，helpful=${input.helpful}`}`,
    evidenceRefs: [{ kind: 'ai-intervention', ref: input.interventionId }],
  });
  if (!isArenaOfficialIntervention(existingIntervention)) {
    await recordKonlingPathInterventionOutcome(db, input, existingIntervention ?? null);
  }
  return { success: true, outcome };
}

function isArenaOfficialIntervention(intervention: unknown): boolean {
  return getString(intervention, 'sessionId').startsWith('arena-official:');
}

async function recordKonlingPathInterventionOutcome(
  db: KonlingRuntimeDb,
  input: {
    scope: KonlingRuntimeScope;
    interventionId: string;
    feedback: KonlingInterventionFeedback;
    helpful?: boolean;
    studentResponse?: string;
  },
  intervention: unknown | null,
) {
  if (!db.learningPath?.findMany || !db.learningPathIntervention) return;
  const paths = await db.learningPath.findMany({
    where: {
      userId: input.scope.targetUserId,
      goalId: CONTROL_CORRECTION_PATH_ROUND_GOAL_ID,
      pathStatus: 'active',
      ...(input.scope.classId ? { classId: input.scope.classId } : {}),
    },
    orderBy: { updatedAt: 'desc' },
    take: 5,
  });
  const path = input.scope.pathNodeId
    ? paths.find((candidate) => arrayOfStrings(getValue(candidate, 'nodeIds')).includes(input.scope.pathNodeId as string))
    : paths[0];
  const pathId = getString(path, 'id');
  if (!pathId) return;
  await recordPathIntervention(db as any, {
    pathId,
    userId: input.scope.targetUserId,
    interventionKind: toPathInterventionKind(getString(intervention, 'interventionType')),
    citedEvidence: buildPathInterventionCitations(input, intervention),
    suggestedAction: summarizeText(getString(intervention, 'content') || getString(intervention, 'whyNow') || '记录控灵干预反馈。', 220),
    studentOutcome: toPathInterventionOutcome(input.feedback, input.helpful),
    privacySafeSummary: buildPrivacySafeInterventionSummary(input, intervention),
    idempotencyKey: buildKonlingFeedbackIdempotencyKey(input),
    actorUserId: input.scope.authenticatedUserId,
    actorRole: input.scope.role,
  });
}

function toPathInterventionOutcome(feedback: KonlingInterventionFeedback, helpful?: boolean) {
  if (feedback === 'accepted') return 'accepted';
  if (feedback === 'ignored' || feedback === 'dismissed') return 'ignored';
  if (feedback === 'rejected') return 'rejected';
  if (feedback === 'partially-accepted') return 'partially-accepted';
  if (feedback === 'rated') {
    if (helpful === true) return 'partially-accepted';
    if (helpful === false) return 'rejected';
  }
  return 'pending';
}

function buildKonlingFeedbackIdempotencyKey(input: { interventionId: string; feedback: KonlingInterventionFeedback; helpful?: boolean }) {
  if (input.feedback !== 'rated') {
    return `konling-feedback:${input.interventionId}:${input.feedback}`;
  }
  const helpfulState = input.helpful === true ? 'true' : input.helpful === false ? 'false' : 'unknown';
  return `konling-feedback:${input.interventionId}:rated:helpful:${helpfulState}`;
}

function toPathInterventionKind(interventionType: string) {
  if (interventionType === 'failure-analysis') return 'diagnosis';
  if (interventionType === 'constraint-hint') return 'hint';
  if (interventionType === 'guidance') return 'reflection-prompt';
  return 'hint';
}

function buildPathInterventionCitations(
  input: { scope: KonlingRuntimeScope; interventionId: string; feedback: KonlingInterventionFeedback; helpful?: boolean },
  intervention: unknown | null,
) {
  return [
    { kind: 'ai-intervention', ref: input.interventionId },
    ...(input.scope.pathNodeId ? [{ kind: 'learning-path-node', ref: input.scope.pathNodeId }] : []),
    ...arrayOfRecords(getValue(intervention, 'evidence')),
  ];
}

function buildPrivacySafeInterventionSummary(
  input: { interventionId: string; feedback: KonlingInterventionFeedback; helpful?: boolean; studentResponse?: string },
  intervention: unknown | null,
) {
  const response = input.studentResponse ? `，学生反馈：${sanitizeMemorySummary(input.studentResponse)}` : '';
  const whyNow = getString(intervention, 'whyNow') || getString(intervention, 'triggerType') || '控灵干预反馈';
  return summarizeText(
    `${whyNow}；结果：${toPathInterventionOutcome(input.feedback, input.helpful)}${input.helpful === undefined ? '' : `，helpful=${input.helpful}`}${response}`,
    500,
  );
}

export function normalizeKonlingRole(role: string | undefined): AdaptiveLearnerStateRole {
  const normalizedRole = role?.toLowerCase();
  if (normalizedRole === 'admin') return 'admin';
  if (normalizedRole === 'teacher') return 'teacher';
  if (normalizedRole === 'system') return 'system';
  return 'student';
}

export function privacyScopesForRole(role: AdaptiveLearnerStateRole): AdaptiveLearnerStatePrivacyScope[] {
  if (role === 'admin') return ['student-visible', 'teacher-scoped', 'admin-scoped', 'audit-only'];
  if (role === 'teacher') return ['student-visible', 'teacher-scoped'];
  if (role === 'system') return ['student-visible', 'teacher-scoped', 'admin-scoped', 'audit-only', 'system-internal'];
  return ['student-visible'];
}

function normalizeKonlingToolNames(value: unknown): KonlingToolName[] {
  const names = arrayOfStrings(value);
  return names.filter((name): name is KonlingToolName => name in KONLING_TOOL_REGISTRY);
}

function toolRegistryEntry(
  name: KonlingToolName,
  permissionTier: KonlingToolPermissionTier,
  approvalPolicy: KonlingToolApprovalPolicy = 'none',
  idempotencyPolicy: KonlingToolIdempotencyPolicy = permissionTier === 'read' || permissionTier === 'analyze' ? 'none' : 'reuse',
): KonlingToolRegistryEntry {
  return {
    name,
    permissionTier,
    approvalPolicy,
    idempotencyPolicy,
    redactionPolicy: 'summary-only',
  };
}

async function updateKonlingAgentSessionStatus(
  db: KonlingRuntimeDb,
  input: KonlingAgentSessionRefInput & {
    status: KonlingAgentSessionStatus;
    state?: Record<string, unknown>;
    pendingApproval?: Record<string, unknown> | null;
    archivedAt?: Date | null;
  },
): Promise<{ success: true; status: KonlingAgentSessionStatus }> {
  const result = await db.agentSession?.updateMany?.({
    where: buildAgentSessionScopeWhere(input.scope, input.agentSessionId),
    data: {
      status: input.status,
      ...(input.state ? { stateJson: redactSensitivePayload(input.state) } : {}),
      ...(input.pendingApproval !== undefined ? { pendingApproval: input.pendingApproval } : {}),
      ...(input.archivedAt !== undefined ? { archivedAt: input.archivedAt } : {}),
    },
  });
  const updatedCount = typeof getValue(result, 'count') === 'number' ? getValue(result, 'count') as number : 0;
  if (updatedCount !== 1) {
    throw new KonlingRuntimeScopeError(404, 'AgentSession 不存在或不属于当前用户作用域。');
  }
  return { success: true, status: input.status };
}

function buildAgentSessionScopeWhere(
  scope: KonlingRuntimeScope,
  agentSessionId?: string,
  phase?: string,
  smartPrepBinding?: KonlingSmartPrepSessionBinding | null,
  konlingSessionId?: string | null,
) {
  return {
    ...(agentSessionId ? { id: agentSessionId } : {}),
    ...(phase ? { phase } : {}),
    ...(konlingSessionId !== undefined ? { konlingSessionId } : {}),
    ownerUserId: scope.targetUserId,
    actorUserId: scope.authenticatedUserId,
    classId: scope.classId ?? null,
    courseId: scope.courseId,
    pageId: scope.pageId,
    resourceId: scope.resourceId ?? null,
    pathNodeId: scope.pathNodeId ?? null,
    ...(smartPrepBinding ? {
      stateJson: {
        path: ['smartPrepBinding', 'taskId'],
        equals: smartPrepBinding.taskId,
      },
    } : {}),
  };
}

function assertSmartPrepSessionBinding(
  scope: KonlingRuntimeScope,
  binding?: KonlingSmartPrepSessionBinding | null,
) {
  if (!binding) return;
  if (
    scope.role !== 'teacher' ||
    scope.authenticatedUserId !== scope.targetUserId ||
    !isKonlingSmartPrepPage(scope.pageId) ||
    !binding.taskId.trim()
  ) {
    throw new KonlingRuntimeScopeError(403, 'Smart-prep AgentSession 必须绑定当前教师和明确的备课任务。');
  }
}

function isKonlingSmartPrepPage(pageId: string) {
  return pageId === '/teacher/smart-prep' || pageId === 'teacher-smart-prep' || pageId === 'smart-prep';
}

function buildToolRunScopeWhere(scope: KonlingRuntimeScope, toolRunId: string) {
  return {
    id: toolRunId,
    ownerUserId: scope.targetUserId,
    classId: scope.classId ?? null,
    courseId: scope.courseId,
    pageId: scope.pageId,
    resourceId: scope.resourceId ?? null,
    pathNodeId: scope.pathNodeId ?? null,
  };
}

function buildAgentToolRunIdempotencyWhere(input: KonlingToolRunStartInput) {
  return {
    ownerUserId: input.scope.targetUserId,
    toolName: input.toolName,
    idempotencyKey: input.idempotencyKey,
    classId: input.scope.classId ?? null,
    courseId: input.scope.courseId,
    pageId: input.scope.pageId,
    resourceId: input.scope.resourceId ?? null,
    pathNodeId: input.scope.pathNodeId ?? null,
  };
}

async function findScopedToolRun(db: KonlingRuntimeDb, scope: KonlingRuntimeScope, toolRunId: string) {
  const toolRun = await db.agentToolRun?.findFirst?.({
    where: buildToolRunScopeWhere(scope, toolRunId),
  });
  if (!toolRun) {
    throw new KonlingRuntimeScopeError(404, 'AgentToolRun 不存在或不属于当前用户作用域。');
  }
  return toolRun;
}

async function updateScopedToolRun(
  db: KonlingRuntimeDb,
  scope: KonlingRuntimeScope,
  toolRunId: string,
  data: Record<string, unknown>,
) {
  const result = await db.agentToolRun?.updateMany?.({
    where: buildToolRunScopeWhere(scope, toolRunId),
    data,
  });
  const updatedCount = typeof getValue(result, 'count') === 'number' ? getValue(result, 'count') as number : 0;
  if (updatedCount !== 1) {
    throw new KonlingRuntimeScopeError(404, 'AgentToolRun 不存在或不属于当前用户作用域。');
  }
}

function assertMemoryWriteScope(scope: KonlingRuntimeScope | undefined, userId: string) {
  if (!scope) return;
  if (scope.role === 'student' && scope.authenticatedUserId !== scope.targetUserId) {
    throw new KonlingRuntimeScopeError(403, '学生只能写入自己的 Konling 长期记忆。');
  }
  if (scope.targetUserId !== userId) {
    throw new KonlingRuntimeScopeError(403, 'Konling 长期记忆写入必须绑定当前 owner user。');
  }
}

function toAgentSessionView(session: unknown): KonlingAgentSessionView {
  return {
    id: getString(session, 'id'),
    ownerUserId: getString(session, 'ownerUserId'),
    actorUserId: getString(session, 'actorUserId') || null,
    phase: getString(session, 'phase'),
    status: getString(session, 'status'),
    state: readRecord(getValue(session, 'stateJson')),
    permittedTools: arrayOfStrings(getValue(session, 'permittedTools')),
    pendingApproval: getValue(session, 'pendingApproval') ? readRecord(getValue(session, 'pendingApproval')) : null,
    expiresAt: toIsoOrNull(getValue(session, 'expiresAt')),
    createdAt: toIsoOrNull(getValue(session, 'createdAt')) ?? new Date(0).toISOString(),
    updatedAt: toIsoOrNull(getValue(session, 'updatedAt')) ?? new Date(0).toISOString(),
  };
}

function toToolRunView(toolRun: unknown, options: { reused?: boolean } = {}): KonlingToolRunView {
  return {
    id: getString(toolRun, 'id'),
    agentSessionId: getString(toolRun, 'agentSessionId'),
    ownerUserId: getString(toolRun, 'ownerUserId'),
    actorUserId: getString(toolRun, 'actorUserId'),
    targetUserId: getString(toolRun, 'targetUserId'),
    toolName: getString(toolRun, 'toolName'),
    permissionTier: getString(toolRun, 'permissionTier'),
    approvalState: getString(toolRun, 'approvalState'),
    status: getString(toolRun, 'status'),
    inputSummary: redactSensitivePayload(getValue(toolRun, 'inputSummary') ?? {}),
    outputSummary: getValue(toolRun, 'outputSummary') ? redactSensitivePayload(getValue(toolRun, 'outputSummary')) : null,
    errorSummary: getValue(toolRun, 'errorSummary') ? redactSensitivePayload(getValue(toolRun, 'errorSummary')) : null,
    idempotencyKey: getString(toolRun, 'idempotencyKey') || null,
    correlationId: getString(toolRun, 'correlationId'),
    startedAt: toIsoOrNull(getValue(toolRun, 'startedAt')) ?? new Date(0).toISOString(),
    completedAt: toIsoOrNull(getValue(toolRun, 'completedAt')),
    latencyMs: typeof getValue(toolRun, 'latencyMs') === 'number' ? getValue(toolRun, 'latencyMs') as number : null,
    reused: options.reused ?? false,
  };
}

function calculateLatencyMs(startedAt: unknown, completedAt: Date): number | null {
  const startedIso = toIsoOrNull(startedAt);
  if (!startedIso) return null;
  const latencyMs = completedAt.getTime() - Date.parse(startedIso);
  return Number.isFinite(latencyMs) && latencyMs >= 0 ? latencyMs : null;
}

function summarizeRuntimeToolError(error: unknown): Record<string, unknown> {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
    };
  }
  return { message: String(error) };
}

function assertToolResult(input: KonlingToolRuntimeInput, toolName: KonlingToolName, result: unknown) {
  const permittedTools = normalizeKonlingToolNames(
    input.permittedTools
      ?? (input.agentSessionId ? input.context.permittedTools : DEFAULT_TOOLS),
  );
  if (!permittedTools.includes(toolName)) {
    throw new KonlingRuntimeScopeError(403, `Konling 工具 ${toolName} 未授权。`);
  }
  return redactSensitivePayload(result, input.scope.privacyScopes);
}

function assertSimulationScope(scope: KonlingRuntimeScope, hasScopedSimulationState: boolean) {
  if (hasScopedSimulationState || scope.courseId === 'simulation') return;
  throw new KonlingRuntimeScopeError(403, '当前 Konling 作用域未提供仿真工具权限。');
}

function buildToolScopeRef(scope: KonlingRuntimeScope) {
  return {
    userId: scope.targetUserId,
    classId: scope.classId ?? null,
    courseId: scope.courseId,
    pageId: scope.pageId,
    resourceId: scope.resourceId ?? null,
    pathNodeId: scope.pathNodeId ?? null,
  };
}

async function readPlanContext(db: KonlingRuntimeDb, scope: KonlingRuntimeScope): Promise<KonlingPlanContext> {
  if (!scope.pathNodeId) {
    return {
      currentPathId: null,
      activeNodeId: null,
      nextNodeIds: [],
      recentPathIds: [],
      completedNodeIds: [],
      status: 'missing',
    };
  }
  const paths = await db.learningPath?.findMany?.({
    where: {
      userId: scope.targetUserId,
      goalId: CONTROL_CORRECTION_PATH_ROUND_GOAL_ID,
      pathStatus: 'active',
      ...(scope.classId ? { classId: scope.classId } : {}),
    },
    orderBy: { updatedAt: 'desc' },
    take: 5,
  }) ?? [];
  const scopedPaths = paths.filter((path) => arrayOfStrings(getValue(path, 'nodeIds')).includes(scope.pathNodeId as string));
  const current = scopedPaths[0];
  const nodeIds = arrayOfStrings(getValue(current, 'nodeIds'));
  if (!current) {
    return {
      currentPathId: null,
      activeNodeId: null,
      nextNodeIds: [],
      recentPathIds: [],
      completedNodeIds: [],
      status: 'missing',
    };
  }
  const pathPayload = readRecord(getValue(current, 'pathPayload'));
  return {
    currentPathId: getString(current, 'id') || null,
    activeNodeId: getString(current, 'currentNodeId') || scope.pathNodeId || nodeIds[0] || null,
    nextNodeIds: nodeIds.slice(0, 3),
    recentPathIds: scopedPaths.map((path) => getString(path, 'id')).filter(Boolean),
    completedNodeIds: [],
    pathOptions: readPathOptionContext(pathPayload),
    pathOptionFallback: readPathOptionFallbackContext(pathPayload),
    selectionHistory: readPathSelectionContext(pathPayload),
    status: current ? 'available' : 'missing',
  };
}

function readPathOptionContext(pathPayload: Record<string, unknown>): KonlingPathOptionContext[] {
  const policyBundle = readRecord(getValue(pathPayload, 'policyBundle'));
  const pathOptions = arrayOfRecords(getValue(policyBundle, 'paths')).length > 0
    ? arrayOfRecords(getValue(policyBundle, 'paths'))
    : arrayOfRecords(getValue(pathPayload, 'pathOptions'));
  return pathOptions.map((path) => {
    const effort = readRecord(getValue(path, 'effort'));
    return {
      styleId: getString(path, 'styleId'),
      policyFamily: getString(path, 'policyFamily'),
      label: getString(path, 'label'),
      nodeIds: arrayOfStrings(getValue(path, 'nodeIds')),
      targetDeficits: readPathOptionTargetDeficits(path),
      evidenceBasis: arrayOfStrings(getValue(path, 'evidenceBasis')),
      lockedNodeIds: arrayOfStrings(getValue(path, 'lockedNodeIds')),
      readinessSummary: arrayOfRecords(getValue(path, 'readinessSummary')).map((item) => ({
        nodeId: getString(item, 'nodeId'),
        state: getString(item, 'state') || 'ready',
        message: getString(item, 'message') || '',
      })).filter((item) => item.nodeId),
      resourceMix: readNumberRecord(getValue(path, 'resourceMix')),
      effort: {
        estimatedMinutes: getNumber(effort, 'estimatedMinutes'),
        relative: getString(effort, 'relative') || 'unknown',
      },
      terminalValidationNodeIds: arrayOfStrings(getValue(path, 'terminalValidationNodeIds')),
      limitations: arrayOfStrings(getValue(path, 'limitations')),
    };
  }).filter((path) => path.styleId && path.nodeIds.length > 0);
}

function readPathOptionTargetDeficits(path: Record<string, unknown>): string[] {
  const targetDeficits = getValue(path, 'targetDeficits');
  return [
    ...arrayOfStrings(targetDeficits),
    ...arrayOfRecords(targetDeficits).map((target) => getString(target, 'targetId')),
  ].filter((target): target is string => Boolean(target));
}

function readPathOptionFallbackContext(pathPayload: Record<string, unknown>): KonlingPathOptionFallbackContext | null {
  const policyBundle = readRecord(getValue(pathPayload, 'policyBundle'));
  const status = getString(policyBundle, 'status');
  if (!status || status === 'ready') {
    return null;
  }
  return {
    status,
    fallbackReasons: arrayOfStrings(getValue(policyBundle, 'fallbackReasons')),
  };
}

function readPathSelectionContext(pathPayload: Record<string, unknown>): KonlingPathSelectionContext[] {
  return arrayOfRecords(getValue(pathPayload, 'selectionHistory')).map((entry) => ({
    type: getString(entry, 'type'),
    selectedStyleId: getString(entry, 'selectedStyleId') || null,
    previousStyleId: getString(entry, 'previousStyleId') || null,
    rejectedStyleIds: arrayOfStrings(getValue(entry, 'rejectedStyleIds')),
    createdAt: toIsoOrNull(getValue(entry, 'createdAt')),
    helpful: typeof getValue(entry, 'helpful') === 'boolean' ? getValue(entry, 'helpful') as boolean : null,
  })).filter((entry) => entry.type);
}

async function buildKonlingCitationContext(
  db: KonlingRuntimeDb,
  input: {
    scope: KonlingRuntimeScope;
    pageContext: PageContext;
    learnerState: AdaptiveLearnerState | null;
    planContext: KonlingPlanContext;
    memory: KonlingMemoryView[];
    knowledgeWorkspace?: KonlingKnowledgeWorkspaceContext | null;
    sarAssociatedGrounding?: KonlingSarAssociatedGroundingContext | null;
    trustedContentContext: boolean;
    currentUserQuery?: string | null;
  },
): Promise<KonlingCitationContext> {
  const contentCitations = input.trustedContentContext
    ? [
        ...buildContentCitations(input.pageContext),
        ...buildKnowledgeWorkspaceContentCitations(input.knowledgeWorkspace),
      ]
    : [];
  const evidenceCitations: KonlingCitation[] = [];

  if (input.learnerState) {
    evidenceCitations.push({
      id: `learner-state:${input.scope.targetUserId}`,
      sourceType: 'learner-state',
      displayTitle: '服务端学习者状态',
      href: null,
      confidence: normalizeCitationConfidence(input.learnerState.evidence?.confidence?.level),
      evidenceBasis: 'AdaptiveLearnerState',
      owner: 'recommendation',
      citationChip: buildKonlingCitationChip({
        id: `learner-state:${input.scope.targetUserId}`,
        sourceType: 'learner-state',
        displayTitle: '服务端学习者状态',
        href: null,
        confidence: normalizeCitationConfidence(input.learnerState.evidence?.confidence?.level),
      }),
    });
  } else if (isKonlingStudentPathCenterScope(input.scope)) {
    evidenceCitations.push(buildColdStartLearnerStateCitation(input.scope));
  }
  if (input.planContext.currentPathId) {
    evidenceCitations.push({
      id: `path:${input.planContext.currentPathId}`,
      sourceType: 'path-execution',
      displayTitle: '当前控制校正学习路径',
      href: null,
      confidence: 'medium',
      evidenceBasis: 'LearningPath',
      owner: 'recommendation',
      citationChip: buildKonlingCitationChip({
        id: `path:${input.planContext.currentPathId}`,
        sourceType: 'path-execution',
        displayTitle: '当前控制校正学习路径',
        href: null,
        confidence: 'medium',
      }),
    });
  }
  for (const memory of input.memory.slice(0, 2)) {
    const id = `memory:${memory.id}`;
    const displayTitle = `控灵记忆摘要：${memory.memoryType}`;
    evidenceCitations.push({
      id,
      sourceType: 'memory',
      displayTitle,
      href: null,
      confidence: 'medium',
      evidenceBasis: 'KonlingMemory',
      owner: 'answer',
      citationChip: buildKonlingCitationChip({
        id,
        sourceType: 'memory',
        displayTitle,
        href: null,
        confidence: 'medium',
      }),
    });
  }

  const featureCacheRead = db.studentEvidenceFeatureCache?.findUnique?.({
    where: { userId: input.scope.targetUserId },
  });
  const featureCache = featureCacheRead ? await featureCacheRead.catch(() => null) : null;
  evidenceCitations.push(...buildFeatureCacheCitations(featureCache, input.scope, input.planContext));

  const hasLearnerStateCitation = evidenceCitations.some((citation) => citation.sourceType === 'learner-state');
  const missingCitationClasses = [
    contentCitations.length === 0 ? 'content' : null,
    hasLearnerStateCitation ? null : 'learner-state',
    input.planContext.status === 'available' ? null : 'path-execution',
    evidenceCitations.length > 0 ? null : 'evidence',
  ].filter((item): item is string => Boolean(item));
  const lowConfidenceReasons = [
    ...missingCitationClasses.map((item) => `missing-${item}`),
    ...evidenceCitations
      .filter((citation) => citation.confidence === 'none' || citation.confidence === 'low')
      .map((citation) => `low-confidence-${citation.sourceType}`),
  ];

  const {
    contentCitations: assignedContentCitations,
    evidenceCitations: assignedEvidenceCitations,
  } = assignKonlingRuntimeCitationDisplayNumbers(contentCitations, evidenceCitations);

  return {
    required: true,
    contentCitations: assignedContentCitations,
    evidenceCitations: assignedEvidenceCitations,
    sourcePacks: [],
    missingCitationClasses,
    lowConfidenceReasons: [...new Set(lowConfidenceReasons)],
    responseProtocol: {
      requiredOwners: ['answer', 'recommendation', 'intervention', 'report-explanation'],
      minimum: {
        content: 1,
        evidenceWhenAvailable: 1,
      },
      fallbackWhenMissing: 'low-confidence',
    },
  };
}

export function assignKonlingRuntimeCitationDisplayNumbers(
  contentCitations: readonly KonlingCitation[],
  evidenceCitations: readonly KonlingCitation[],
) {
  const allCitations = [...contentCitations, ...evidenceCitations];
  const assignable = allCitations.map(toAssignableRuntimeCitation);
  const assignedCitations = assignKonlingCitationDisplayNumbers(assignable);
  const assignedByCanonicalKey = new Map(
    assignedCitations.map((citation) => [citation.canonicalKey, citation]),
  );
  const hydrate = (citation: KonlingCitation): KonlingCitation | null => {
    const canonicalKey = buildKonlingCitationCanonicalKey(
      toAssignableRuntimeCitation(citation).identity,
    );
    const assigned = assignedByCanonicalKey.get(canonicalKey);
    return assigned ? {
      ...citation,
      displayNumber: assigned.displayNumber,
      canonicalKey: assigned.canonicalKey,
      identity: assigned.identity,
    } : null;
  };
  return {
    contentCitations: contentCitations.flatMap((citation) => {
      const hydrated = hydrate(citation);
      return hydrated ? [hydrated] : [];
    }),
    evidenceCitations: evidenceCitations.flatMap((citation) => {
      const hydrated = hydrate(citation);
      return hydrated ? [hydrated] : [];
    }),
  };
}

export function mergeCandidateAssignedCitations<T extends KonlingRuntimeContext>(
  context: T,
  assignedCitations: readonly KonlingAssignedCitation[],
): T {
  if (!context.citationContext) return context;
  // 最终 guard 必须与 normalize 层共享同一 assigned 表视图：检索工具分配的
  // 教材与 candidate 引用只存在于 assigned 表，不投影进 citationContext 时，
  // collectUnverifiedCitationMarkers 会把有效工具编号误判为未分配而剥离（#1949）。
  const existingByCanonicalKey = new Set([
    ...context.citationContext.contentCitations,
    ...context.citationContext.evidenceCitations,
  ].flatMap((citation) => [citation.canonicalKey
    ?? buildKonlingCitationCanonicalKey(toAssignableRuntimeCitation(citation).identity)]));
  const toolCitations: KonlingCitation[] = assignedCitations
    .filter((citation) => citation.verifiable !== false && !existingByCanonicalKey.has(citation.canonicalKey))
    .map((citation) => ({
      id: citation.id,
      // runtime citation 的 sourceType 联合不含 textbook：投影条目归一为
      // content 分类（guard 内部分类用），用户可见的教材标签以 assigned
      // 表持久化投影（normalized.citations）为准。
      sourceType: 'content' as const,
      displayTitle: citation.displayTitle,
      href: citation.href,
      confidence: citation.confidence ?? 'high',
      evidenceBasis: citation.evidenceBasis ?? 'server-assigned-citation',
      owner: 'answer' as const,
      citationTargetId: assignedCitationTargetId(citation),
      verified: true,
      resolver: citation.evidenceBasis?.startsWith('candidate-canonical:')
        ? 'candidate-authoritative-repository'
        : null,
      displayNumber: citation.displayNumber,
      canonicalKey: citation.canonicalKey,
      identity: citation.identity,
    }));
  if (toolCitations.length === 0) return context;
  // assigned 表条目携带服务器分配的 displayNumber，与 normalize 层处于同一
  // 编号空间，直接拼接保留原编号：后台优化移除中间教材候选时编号有缺口，
  // 重新连续编号会让正文引用与 guard 视图错位而被误剥离（#1949 review）。
  const contentCitations = [
    ...context.citationContext.contentCitations,
    ...toolCitations,
  ];
  return {
    ...context,
    citationContext: {
      ...context.citationContext,
      contentCitations,
      evidenceCitations: context.citationContext.evidenceCitations,
      missingCitationClasses: context.citationContext.missingCitationClasses
        .filter((item) => item !== 'content'),
      lowConfidenceReasons: context.citationContext.lowConfidenceReasons
        .filter((item) => (
          item !== 'missing-content'
          && item !== 'candidate-tool-citation-required'
        )),
    },
  };
}

function assignedCitationTargetId(citation: KonlingAssignedCitation): string {
  if (citation.identity.kind === 'textbook') {
    return citation.identity.fragmentId ?? citation.identity.unitId;
  }
  if (citation.identity.kind === 'content') {
    return citation.identity.contentId;
  }
  return citation.identity.evidenceId;
}

function toAssignableRuntimeCitation(citation: KonlingCitation) {
  const identity = citation.identity ?? (
    citation.sourceType === 'content'
      ? {
          kind: 'content' as const,
          sourceType: 'content' as const,
          contentId: citation.citationTargetId ?? citation.id,
        }
      : {
          kind: 'evidence' as const,
          sourceType: citation.sourceType,
          evidenceId: citation.id,
          timeSemantic: readCitationTimeSemantic(citation),
        }
  );
  return {
    id: citation.id,
    sourceType: citation.sourceType,
    displayTitle: citation.displayTitle,
    href: citation.displayHref ?? citation.href,
    // 与 isBindableAnswerUnitCitation 同一判定：未核验或无目标的条目不得
    // 作为已核验引用进入正式回答（#1949）
    verifiable: citation.verified === true && Boolean(citation.citationTargetId),
    identity,
    confidence: citation.confidence,
    evidenceBasis: citation.evidenceBasis,
    limitation: citation.omittedCitationReason ?? null,
  };
}

function readCitationTimeSemantic(citation: KonlingCitation) {
  const chip = citation.citationChip as unknown as Record<string, unknown> | undefined;
  for (const key of ['evidenceTimestamp', 'observedAt', 'stateCommittedAt', 'sourceWindow']) {
    const value = chip?.[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return null;
}

function buildContentCitations(pageContext: PageContext): KonlingCitation[] {
  const stepContext = getStepAIContext(pageContext.courseId, pageContext.stepId);
  if (!stepContext) return buildAdaptivePathCenterContentCitations(pageContext);
  return [{
    id: `content:${pageContext.courseId}:${pageContext.stepId}`,
    sourceType: 'content',
    displayTitle: pageContext.topic || pageContext.courseTitle || pageContext.stepId,
    href: null,
    confidence: 'high',
    evidenceBasis: 'course-ai-context',
    owner: 'answer',
    citationChip: buildKonlingCitationChip({
      id: `content:${pageContext.courseId}:${pageContext.stepId}`,
      sourceType: 'content',
      displayTitle: pageContext.topic || pageContext.courseTitle || pageContext.stepId,
      href: null,
      confidence: 'high',
    }),
  }];
}

function buildAdaptivePathCenterContentCitations(pageContext: PageContext): KonlingCitation[] {
  if (pageContext.stepId !== 'adaptive-path-center' && pageContext.stepId !== 'student-path-center') return [];
  const registeredGoal = getRegisteredAdaptiveLearningPathGoal(pageContext.courseId);
  if (!registeredGoal) return [];

  return [{
    id: `content:${registeredGoal.goal.id}:adaptive-path-center`,
    sourceType: 'content',
    displayTitle: `${registeredGoal.displayName}学习路径中心`,
    href: '/assessment/adaptive-practice',
    confidence: 'high',
    evidenceBasis: 'adaptive-learning-path-goal-registry',
    owner: 'answer',
    citationChip: buildKonlingCitationChip({
      id: `content:${registeredGoal.goal.id}:adaptive-path-center`,
      sourceType: 'content',
      displayTitle: `${registeredGoal.displayName}学习路径中心`,
      href: '/assessment/adaptive-practice',
      confidence: 'high',
    }),
  }];
}

function buildKnowledgeWorkspaceContentCitations(
  knowledgeWorkspace: KonlingKnowledgeWorkspaceContext | null | undefined,
): KonlingCitation[] {
  const selectedNode = knowledgeWorkspace?.selected_node;
  if (!selectedNode) return [];
  const id = `content:knowledge-node:${selectedNode.id}`;
  return [{
    id,
    sourceType: 'content',
    displayTitle: selectedNode.name,
    href: null,
    confidence: 'high',
    evidenceBasis: 'knowledge-workspace-selected-node',
    owner: 'answer',
    citationChip: buildKonlingCitationChip({
      id,
      sourceType: 'content',
      displayTitle: selectedNode.name,
      href: null,
      confidence: 'high',
    }),
  }];
}

/**
 * Legacy Source Pack content citations (production path only).
 * Shadow comparison for textbooks lives on search_textbook via the TextbookV2
 * foreground, not on this unused helper path.
 */
async function buildKonlingSourcePackContentCitations(input: {
  scope: KonlingRuntimeScope;
  pageContext: PageContext;
  knowledgeWorkspace?: KonlingKnowledgeWorkspaceContext | null;
  sarAssociatedGrounding?: KonlingSarAssociatedGroundingContext | null;
  currentUserQuery?: string | null;
}): Promise<{
  citations: KonlingCitation[];
  sourcePack: KonlingSourcePackCitationSummary | null;
}> {
  const units = await loadAllTextbookStructureUnitProjections().catch(() => []);
  const adapted = units.map(adaptTextbookStructureUnit);
  const query = buildKonlingSourcePackQuery(
    input.pageContext,
    input.knowledgeWorkspace,
    input.currentUserQuery,
  );
  const result = retrieveSourcePack({
    query,
    answerRelevanceQuery: buildKonlingAnswerRelevanceQueries(input.currentUserQuery, query),
    profile: 'konling-answer',
    role: sourcePackRoleForKonling(input.scope.role),
    caller: 'konling-agent-runtime',
    topK: 6,
    graphNodeRefs: buildKonlingSourcePackGraphRefs(
      input.pageContext,
      input.knowledgeWorkspace,
      input.sarAssociatedGrounding,
    ),
    capabilityTargetRefs: buildKonlingSourcePackCapabilityRefs(input.knowledgeWorkspace),
    resourceIds: input.sarAssociatedGrounding?.candidateRefs.resourceNodeIds,
    learnerContextRefs: buildKonlingSourcePackSarLearnerRefs(input.sarAssociatedGrounding),
    candidates: adapted.map((entry) => entry.item),
    limitations: adapted.flatMap((entry) => entry.limitations),
  });

  return {
    citations: result.pack.items.map((item) => buildSourcePackContentCitation(result.pack, item)),
    sourcePack: {
      packId: result.pack.packId,
      profile: result.pack.profile,
      queryText: result.pack.query.text,
      citationTargetIds: result.pack.audit.citationTargetIds,
      retrievalChunkIds: result.pack.audit.retrievalChunkIds,
      limitationCodes: result.pack.limitations.map((limitation) => limitation.code),
      answerRelevanceBases: uniqueStrings(result.pack.items
        .map((item) => metadataString(item, 'answerRelevanceBasis'))),
    },
  };
}

function buildKonlingSourcePackQuery(
  pageContext: PageContext,
  knowledgeWorkspace: KonlingKnowledgeWorkspaceContext | null | undefined,
  currentUserQuery?: string | null,
): string {
  const selectedNode = knowledgeWorkspace?.selected_node;
  return [
    normalizeSourcePackQueryText(currentUserQuery),
    pageContext.topic,
    pageContext.courseTitle,
    selectedNode?.name,
    selectedNode?.description,
    ...(selectedNode?.tags ?? []),
  ]
    .filter((value): value is string => Boolean(value?.trim()))
    .join(' ');
}

function buildKonlingAnswerRelevanceQueries(currentUserQuery: string | null | undefined, combinedQuery: string): string[] {
  const userQuery = normalizeAnswerRelevanceUserQuery(currentUserQuery);
  if (!userQuery) return [combinedQuery];
  if (hasSpecificAnswerRelevanceSignal(userQuery)) return [userQuery];
  return uniqueStrings([userQuery, combinedQuery]);
}

function normalizeAnswerRelevanceUserQuery(value: string | null | undefined): string | null {
  const normalized = normalizeSourcePackQueryText(value);
  if (!normalized) return null;
  const withoutNegatedContinuation = normalized
    .replace(/(?:^|[，。；,.!?]\s*)不是[^，。；,.!?]*(?=[，。；,.!?]\s*(?:我|现在|想|要|问))/g, ' ')
    .replace(/(?:而)?不是继续?(?:讨论|问|看|讲|学习)[^，。；,.!?]*[，。；,.!?]?/g, ' ')
    .replace(/(?:不要|别)继续?(?:讨论|问|看|讲|学习)[^，。；,.!?]*[，。；,.!?]?/g, ' ')
    .replace(/(?:^|[，。；,.!?]\s*)(?:not|no)\s+[^，。；,.!?]*(?=[，。；,.!?]\s*(?:i|we)\b)/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return withoutNegatedContinuation || normalized;
}

const SPECIFIC_ANSWER_RELEVANCE_QUERY_TERMS = [
  'bode',
  'nyquist',
  'pid',
  'root locus',
  'routh',
  'hurwitz',
  'laplace',
  'mason',
  '伯德',
  '闭环',
  '传递函数',
  '传函',
  '超调',
  '调节时间',
  '动态响应',
  '根轨迹',
  '胡尔维茨',
  '开环',
  '劳斯',
  '奈奎斯特',
  '频率响应',
  '稳定',
  '稳态误差',
  '相位裕度',
  '状态空间',
  '增益裕度',
  '单位阶跃响应',
  '阶跃响应',
  '阻尼比',
  '零点',
  '极点',
];

function hasSpecificAnswerRelevanceSignal(query: string): boolean {
  const normalized = query.toLowerCase().normalize('NFKC');
  return SPECIFIC_ANSWER_RELEVANCE_QUERY_TERMS.some((term) => normalized.includes(term));
}

function normalizeSourcePackQueryText(value: string | null | undefined): string | null {
  const normalized = value?.replace(/\s+/g, ' ').trim();
  if (!normalized) return null;
  return normalized.slice(0, 500);
}

function buildKonlingSourcePackGraphRefs(
  _pageContext: PageContext,
  knowledgeWorkspace: KonlingKnowledgeWorkspaceContext | null | undefined,
  sarAssociatedGrounding?: KonlingSarAssociatedGroundingContext | null,
): string[] {
  return uniqueStrings([
    knowledgeWorkspace?.selected_node?.id,
    ...sarGraphNodeRefs(sarAssociatedGrounding),
  ]);
}

function buildKonlingSourcePackCapabilityRefs(
  knowledgeWorkspace: KonlingKnowledgeWorkspaceContext | null | undefined,
): string[] {
  return uniqueStrings(knowledgeWorkspace?.selected_node?.capability_target_refs ?? []);
}

function buildKonlingSourcePackSarLearnerRefs(
  grounding: KonlingSarAssociatedGroundingContext | null | undefined,
): string[] {
  if (!grounding) return [];
  return uniqueStrings([
    ...grounding.candidateRefs.citationTargetIds,
    ...grounding.candidateRefs.retrievalChunkIds,
    ...grounding.candidateRefs.planningUnitIds,
  ]);
}

function sarGraphNodeRefs(grounding: KonlingSarAssociatedGroundingContext | null | undefined): string[] {
  if (!grounding) return [];
  return grounding.associatedEntityRefs
    .filter((ref) => ref.startsWith('sar:entity:graph-node:'))
    .map((ref) => ref.replace(/^sar:entity:graph-node:/, ''));
}

function uniqueStrings(values: readonly (string | null | undefined)[]): string[] {
  return [...new Set(values.map((value) => value?.trim()).filter((value): value is string => Boolean(value)))];
}

function sourcePackRoleForKonling(role: AdaptiveLearnerStateRole): SourcePackCallerRole {
  if (role === 'admin' || role === 'teacher' || role === 'student') return role;
  return 'student';
}

function buildSourcePackContentCitation(pack: SourcePack, item: SourcePackItem): KonlingCitation {
  const citation = item.citation;
  const citationTargetRef = citation?.citationTargetId ?? item.citationTargetId ?? item.id;
  const retrievalChunkId = item.retrievalChunkId ?? citation?.sourceId ?? item.id;
  const id = `content:${citationTargetRef}`;
  const title = citation?.displayTitle ?? item.title;
  const canonicalHref = citation?.canonicalHref ?? citation?.href ?? null;
  const displayHref = citation?.displayHref ?? canonicalHref;
  const citationAddressKind = metadataString(item, 'citationAddressKind');
  const citationAddressKindValue = citationAddressKind
    ? citationAddressKind as LearningEvidenceCitationChipPayload['addressKind']
    : undefined;
  const citationLocator = metadataString(item, 'citationLocator');
  const contentHash = metadataString(item, 'contentHash');
  return {
    id,
    sourceType: 'content',
    displayTitle: title,
    href: canonicalHref,
    displayHref,
    canonicalHref,
    confidence: 'high',
    evidenceBasis: `source-pack:${pack.profile}:${pack.packId}`,
    owner: 'answer',
    citationTargetId: citationTargetRef,
    retrievalChunkId,
    answerRelevanceBasis: metadataString(item, 'answerRelevanceBasis'),
    answerRelevanceMatch: metadataString(item, 'answerRelevanceMatch'),
    answerRelevanceQueryHash: metadataString(item, 'answerRelevanceQueryHash'),
    omittedCitationReason: metadataString(item, 'omittedCitationReason'),
    verified: citation?.verified === true,
    resolver: citation?.resolver ?? null,
    citationChip: {
      chunkId: id,
      displayTitle: title,
      displayHref,
      sourceType: 'course-content',
      addressKind: citationAddressKindValue,
      citationAddress: canonicalHref ? {
        kind: citationAddressKind || 'text',
        sourceRefId: citationTargetRef,
        href: canonicalHref,
        locator: citationLocator,
        contentHash,
      } as LearningEvidenceCitationChipPayload['citationAddress'] : undefined,
      authorityLevel: 'canonical',
      confidence: 'high',
      freshnessBucket: 'current',
      privacyVisibility: 'public',
      limitationState: null,
    },
  };
}

function metadataString(item: SourcePackItem, key: string): string | null {
  const value = item.metadata?.[key];
  return typeof value === 'string' && value.length > 0 ? value : null;
}


function buildColdStartLearnerStateCitation(scope: KonlingRuntimeScope): KonlingCitation {
  return {
    id: `learner-state:${scope.targetUserId}:cold-start`,
    sourceType: 'learner-state',
    displayTitle: '冷启动学习状态',
    href: null,
    confidence: 'low',
    evidenceBasis: 'ColdStartAdaptiveLearnerStateFallback',
    owner: 'recommendation',
    citationChip: buildKonlingCitationChip({
      id: `learner-state:${scope.targetUserId}:cold-start`,
      sourceType: 'learner-state',
      displayTitle: '冷启动学习状态',
      href: null,
      confidence: 'low',
    }),
  };
}

function buildFeatureCacheCitations(
  featureCache: unknown,
  scope: KonlingRuntimeScope,
  planContext: KonlingPlanContext,
): KonlingCitation[] {
  const features = readRecord(getValue(featureCache, 'features'));
  const pathExecution = readRecord(getValue(features, 'pathExecution'));
  const simulationArena = readRecord(getValue(features, 'simulationArena'));
  return [
    ...buildPathExecutionCitations(pathExecution, scope, planContext),
    ...buildSimulationArenaCitations(simulationArena),
  ];
}

function buildPathExecutionCitations(
  pathExecution: Record<string, unknown>,
  scope: KonlingRuntimeScope,
  planContext: KonlingPlanContext,
): KonlingCitation[] {
  const allTime = readRecord(getValue(pathExecution, 'allTime'));
  return arrayOfRecords(getValue(allTime, 'sourceReferences'))
    .filter((ref) => isCitationReferenceInScope(ref, scope, planContext))
    .sort((left, right) => comparePathCitationReferences(left, right, scope))
    .slice(0, 4)
    .map((ref) => {
      const id = `${getString(ref, 'sourceType')}:${getString(ref, 'sourceId')}`;
      const sourceType = getString(ref, 'sourceType') === 'LearningPathIntervention' ? 'intervention' : 'path-execution';
      const displayTitle = buildPathCitationTitle(ref);
      const confidence = buildPathCitationConfidence(ref, allTime);
      return {
        id,
        sourceType,
        displayTitle,
        href: null,
        confidence,
        evidenceBasis: buildPathCitationEvidenceBasis(ref),
        owner: getString(ref, 'sourceType') === 'LearningPathIntervention' ? 'intervention' : 'recommendation',
        citationChip: buildKonlingCitationChip({
          id,
          sourceType,
          displayTitle,
          href: null,
          confidence,
        }),
      } satisfies KonlingCitation;
    });
}

function comparePathCitationReferences(
  left: Record<string, unknown>,
  right: Record<string, unknown>,
  scope: KonlingRuntimeScope,
) {
  const leftIntervention = getString(left, 'sourceType') === 'LearningPathIntervention' ? 1 : 0;
  const rightIntervention = getString(right, 'sourceType') === 'LearningPathIntervention' ? 1 : 0;
  if (leftIntervention !== rightIntervention) return rightIntervention - leftIntervention;

  const leftCurrentNode = scope.pathNodeId && getString(left, 'nodeId') === scope.pathNodeId ? 1 : 0;
  const rightCurrentNode = scope.pathNodeId && getString(right, 'nodeId') === scope.pathNodeId ? 1 : 0;
  if (leftCurrentNode !== rightCurrentNode) return rightCurrentNode - leftCurrentNode;

  return readTimestamp(right, 'occurredAt') - readTimestamp(left, 'occurredAt');
}

function readTimestamp(value: Record<string, unknown>, key: string) {
  const timestamp = Date.parse(getString(value, key));
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function isCitationReferenceInScope(
  ref: Record<string, unknown>,
  scope: KonlingRuntimeScope,
  planContext: KonlingPlanContext,
): boolean {
  const privacyLevel = getString(ref, 'privacyLevel') || 'student-visible';
  if (!scope.privacyScopes.includes(privacyLevel as AdaptiveLearnerStatePrivacyScope)) return false;
  const pathId = getString(ref, 'pathId');
  if (planContext.currentPathId && pathId !== planContext.currentPathId) return false;
  const nodeId = getString(ref, 'nodeId');
  if (scope.pathNodeId) {
    if (getString(ref, 'sourceType') === 'LearningPathIntervention' && !nodeId) return false;
    if (nodeId && nodeId !== scope.pathNodeId) return false;
  }
  return true;
}

function buildSimulationArenaCitations(simulationArena: Record<string, unknown>): KonlingCitation[] {
  const allTime = readRecord(getValue(simulationArena, 'allTime'));
  return arrayOfRecords(getValue(allTime, 'traceReferences')).slice(0, 3).map((ref) => {
    const source = getString(ref, 'source') === 'arena' ? 'arena' : 'simulation';
    return {
      id: `${source}:${getString(ref, 'factId') || getString(ref, 'traceReference')}`,
      sourceType: source,
      displayTitle: source === 'arena' ? 'Arena 迁移证据' : '仿真运行证据',
      href: null,
      confidence: readRecord(getValue(allTime, 'replayConfidence')).lowConfidenceCount ? 'low' : 'medium',
      evidenceBasis: getString(ref, 'traceReference') || 'StudentEvidenceFeatureCache',
      owner: 'recommendation',
      citationChip: buildKonlingCitationChip({
        id: `${source}:${getString(ref, 'factId') || getString(ref, 'traceReference')}`,
        sourceType: source,
        displayTitle: source === 'arena' ? 'Arena 迁移证据' : '仿真运行证据',
        href: null,
        confidence: readRecord(getValue(allTime, 'replayConfidence')).lowConfidenceCount ? 'low' : 'medium',
      }),
    } satisfies KonlingCitation;
  });
}

function buildKonlingCitationChip(input: Pick<KonlingCitation, 'id' | 'sourceType' | 'displayTitle' | 'href' | 'confidence'>): LearningEvidenceCitationChipPayload {
  const sourceTypeMap: Record<KonlingCitation['sourceType'], LearningEvidenceCitationChipPayload['sourceType']> = {
    content: 'course-content',
    'learner-state': 'diagnosis',
    'path-execution': 'path-summary',
    simulation: 'simulation-summary',
    arena: 'arena-summary',
    intervention: 'path-summary',
    memory: 'path-summary',
  };
  const authorityMap: Record<KonlingCitation['sourceType'], LearningEvidenceCitationChipPayload['authorityLevel']> = {
    content: 'canonical',
    'learner-state': 'learner-evidence',
    'path-execution': 'learner-evidence',
    simulation: 'learner-evidence',
    arena: 'learner-evidence',
    intervention: 'learner-evidence',
    memory: 'service-internal',
  };
  return {
    chunkId: input.id,
    displayTitle: input.displayTitle,
    displayHref: input.href,
    sourceType: sourceTypeMap[input.sourceType],
    authorityLevel: authorityMap[input.sourceType],
    confidence: input.confidence,
    freshnessBucket: 'current',
    privacyVisibility: input.sourceType === 'content' ? 'public' : 'redacted',
    limitationState: null,
  };
}

function buildPathCitationTitle(ref: Record<string, unknown>): string {
  const sourceType = getString(ref, 'sourceType');
  if (sourceType === 'LearningPathIntervention') return '控灵路径干预结果';
  if (sourceType === 'LearningPathDeviation') return '学习路径偏离证据';
  const terminalState = getString(ref, 'terminalValidationState');
  if (terminalState === 'failed') return '控制校正终端验证失败证据';
  if (terminalState === 'low-confidence') return '控制校正终端验证低置信证据';
  if (terminalState === 'completed') return '控制校正终端验证通过证据';
  return '学习路径执行证据';
}

function buildPathCitationConfidence(ref: Record<string, unknown>, allTime: Record<string, unknown>): KonlingCitation['confidence'] {
  const terminalState = getString(ref, 'terminalValidationState');
  if (terminalState === 'failed' || terminalState === 'low-confidence') return 'low';
  const lowConfidenceMarkers = getValue(ref, 'lowConfidenceMarkers');
  if (Array.isArray(lowConfidenceMarkers) && lowConfidenceMarkers.length > 0) return 'low';
  return normalizeCitationConfidence(getString(ref, 'confidence') || readRecord(getValue(allTime, 'confidence')).level);
}

function buildPathCitationEvidenceBasis(ref: Record<string, unknown>): string {
  const terminalState = getString(ref, 'terminalValidationState');
  if (terminalState) return `LearningPathTerminalValidation:${terminalState}`;
  return getString(ref, 'sourceType') || 'LearningPathEvidence';
}

function normalizeCitationConfidence(value: unknown): KonlingCitation['confidence'] {
  if (value === 'high' || value === 'medium' || value === 'low') return value;
  return 'none';
}

function createMissingCitationContext(): KonlingCitationContext {
  return {
    required: true,
    contentCitations: [],
    evidenceCitations: [],
    missingCitationClasses: ['content', 'evidence'],
    lowConfidenceReasons: ['missing-content', 'missing-evidence'],
    responseProtocol: {
      requiredOwners: ['answer', 'recommendation', 'intervention', 'report-explanation'],
      minimum: {
        content: 1,
        evidenceWhenAvailable: 1,
      },
      fallbackWhenMissing: 'low-confidence',
    },
  };
}

export function buildKonlingCitationGuard(
  context: Pick<KonlingRuntimeContext, 'citationContext'> & {
    teachingAssistantMode?: KonlingTeachingAssistantRuntimeContract;
  },
  assistantMessage?: string,
): KonlingCitationGuard {
  const citationContext = context.citationContext ?? createMissingCitationContext();
  const modeContract = context.teachingAssistantMode;
  const citations = [
    ...citationContext.contentCitations,
    ...citationContext.evidenceCitations,
  ];
  const studyIntent = modeContract?.studyQuestion && isKnownStudyQuestionIntent(modeContract.studyQuestion.intent)
    ? modeContract.studyQuestion.intent as StudyQuestionIntent
    : null;
  const answerScan = assistantMessage === undefined
    ? null
    : scanKonlingAnswerUnits(assistantMessage, citations, studyIntent ?? undefined);
  const answerUnits = answerScan?.bindings ?? [];
  const missingCitationClasses = [...citationContext.missingCitationClasses];
  const lowConfidenceReasons = [...citationContext.lowConfidenceReasons];
  let answerUnitCoverage: KonlingAnswerUnitCitationCoverage | null = null;
  let derivedSectionIds: string[] = [];
  if (studyIntent && answerScan) {
    // Coverage is measured per substantive answer unit (#1819, #1902): an
    // evidence-required section counts as covered only when every substantive
    // answer unit in it carries a bindable citation marker; structural lines
    // (lead-ins, short transitions, pure math display) never dilute coverage.
    const sectionUnits = (sectionId: string) => answerScan.units.filter(
      (unitRecord) => unitRecord.sectionId === sectionId && unitRecord.substantive,
    );
    const presentSectionIds = new Set(answerScan.units
      .map((unitRecord) => unitRecord.sectionId)
      .filter((sectionId): sectionId is string => Boolean(sectionId)));
    derivedSectionIds = STUDY_QUESTION_SECTIONS[studyIntent]
      .filter((section) => section.citationPolicy === 'model-derived' && presentSectionIds.has(section.id))
      .map((section) => section.id);
    const normativeFailClosed = modeContract?.studyQuestion?.normativeGuidance === 'verification-required';
    const sections = normativeFailClosed && studyIntent === 'normative-content'
      ? []
      : STUDY_QUESTION_SECTIONS[studyIntent].map((section) => {
        const unitRecords = sectionUnits(section.id);
        return {
          sectionId: section.id,
          sectionTitle: section.title,
          citationPolicy: section.citationPolicy,
          covered: unitRecords.length > 0 && unitRecords.every((unitRecord) => unitRecord.bound),
        };
      });
    const applicable = sections.filter((section) => (
      section.citationPolicy === 'evidence-required'
      && presentSectionIds.has(section.sectionId)
    ));
    const requiredUnits = applicable.flatMap((section) => sectionUnits(section.sectionId));
    const coveredUnits = requiredUnits.filter((unitRecord) => unitRecord.bound);
    // 未绑定需证据单元的缺失原因分桶（#1902），供分意图覆盖率报告消费
    const missReasonCounts = new Map<KonlingAnswerUnitMissReason, number>();
    for (const unitRecord of requiredUnits) {
      if (!unitRecord.bound && unitRecord.missReason) {
        missReasonCounts.set(unitRecord.missReason, (missReasonCounts.get(unitRecord.missReason) ?? 0) + 1);
      }
    }
    answerUnitCoverage = requiredUnits.length > 0
      ? {
        intent: studyIntent,
        sections,
        coveredCount: coveredUnits.length,
        requiredCount: requiredUnits.length,
        ratio: coveredUnits.length / requiredUnits.length,
        missingReasons: [...missReasonCounts].map(([reason, count]) => ({ reason, count })),
      }
      : null;
    for (const uncovered of applicable.filter((section) => !section.covered)) {
      lowConfidenceReasons.push(`answer-unit-citation-missing:${uncovered.sectionId}`);
    }
  }
  // 不可绑定编号的收集不限于学习问答：所有正式回答路径都需要这道
  // 防线，非 study-question 路径由 strip 层据此剥离（#1949）
  const unverifiedCitationMarkers = assistantMessage === undefined
    ? []
    : collectUnverifiedCitationMarkers(assistantMessage, citations);
  if (unverifiedCitationMarkers.length > 0) {
    // 未核验编号本身构成降级原因：上下文完整时也不能在静默删除标记后
    // 仍以 verified 状态交付（#1949 review）
    lowConfidenceReasons.push('assistant-unverified-citation-markers');
  }
  const normativeCompliance = assistantMessage !== undefined
    && modeContract?.studyQuestion?.normativeGuidance === 'verification-required'
    ? scanKonlingNormativeCompliance(assistantMessage)
    : null;
  if (normativeCompliance?.status === 'degraded') {
    lowConfidenceReasons.push(`normative-answer-degraded:${normativeCompliance.violations.join('+')}`);
  }
  if (modeContract) {
    if (modeContract.status === 'unavailable') {
      lowConfidenceReasons.push(`assistant-mode-unavailable:${modeContract.mode.id}`);
    }
    lowConfidenceReasons.push(...modeContract.degradedReasons);
    lowConfidenceReasons.push(...buildKonlingGroundingFallbackReasons(modeContract.answerIntent, modeContract.groundingContext));
    for (const missingClass of modeContract.citationRequirements.missingClasses) {
      if (!missingCitationClasses.includes(missingClass)) {
        missingCitationClasses.push(missingClass);
      }
    }
    for (const requiredOwner of modeContract.outputContract.requiredCitationOwners) {
      if (!citations.some((citation) => citation.owner === requiredOwner)) {
        lowConfidenceReasons.push(`assistant-required-citation-owner-missing:${requiredOwner}`);
      }
    }
    for (const intentCitationReason of buildAnswerIntentCitationFallbackReasons(modeContract.answerIntent, citationContext, assistantMessage)) {
      lowConfidenceReasons.push(intentCitationReason);
    }
    if (modeContract.studyQuestion?.normativeGuidance === 'verification-required') {
      lowConfidenceReasons.push('normative-guidance-verification-required');
    }
    if (
      assistantMessage !== undefined
      && modeContract.studyQuestion
      && citationContext.contentCitations.some(isBindableAnswerUnitCitation)
      && answerUnits.length === 0
    ) {
      lowConfidenceReasons.push('assistant-answer-unit-citations-missing');
    }
  }
  if (assistantMessage !== undefined && citations.length > 0) {
    const mentionsAnyCitation = assistantMentionsCitation(assistantMessage, citations);
    if (!mentionsAnyCitation) {
      lowConfidenceReasons.push('assistant-citations-missing');
    } else {
      if (
        citationContext.responseProtocol.minimum.content > 0 &&
        citationContext.contentCitations.length > 0 &&
        !assistantMentionsCitation(assistantMessage, citationContext.contentCitations)
      ) {
        lowConfidenceReasons.push('assistant-content-citations-missing');
      }
      if (
        citationContext.responseProtocol.minimum.evidenceWhenAvailable > 0 &&
        citationContext.evidenceCitations.length > 0 &&
        !assistantMentionsCitation(assistantMessage, citationContext.evidenceCitations)
      ) {
        lowConfidenceReasons.push('assistant-evidence-citations-missing');
      }
    }
  }
  if (assistantMessage !== undefined && modeContract) {
    const normalizedAssistantMessage = assistantMessage.toLowerCase();
    const forbiddenOutputTokens = [
      ...modeContract.outputContract.forbiddenActions,
      ...modeContract.privacyPolicy.forbiddenContent,
    ];
    for (const forbiddenToken of forbiddenOutputTokens) {
      if (normalizedAssistantMessage.includes(forbiddenToken.toLowerCase())) {
        lowConfidenceReasons.push(`assistant-mode-contract-violation:${forbiddenToken}`);
      }
    }
  }
  const personalizationMissingClasses = missingCitationClasses.filter(isPersonalizationCitationClass);
  const personalizationLowConfidenceReasons = lowConfidenceReasons.filter(isPersonalizationLowConfidenceReason);
  const shouldRecordPersonalizationAsMetadata = modeContract
    ? supportsLimitedPersonalizationAnswerIntent(modeContract.answerIntent)
    : false;
  const requiredMissingCitationClasses = shouldRecordPersonalizationAsMetadata
    ? missingCitationClasses.filter((item) => !isPersonalizationCitationClass(item))
    : missingCitationClasses;
  const requiredLowConfidenceReasons = shouldRecordPersonalizationAsMetadata
    ? lowConfidenceReasons.filter((item) => !isPersonalizationLowConfidenceReason(item))
    : lowConfidenceReasons;
  const uniqueLowConfidenceReasons = [...new Set(requiredLowConfidenceReasons)];
  const uniqueMissingCitationClasses = [...new Set(requiredMissingCitationClasses)];
  const fallbackRequired = uniqueMissingCitationClasses.length > 0 || uniqueLowConfidenceReasons.length > 0;
  return {
    status: fallbackRequired ? 'low-confidence' : 'verified',
    citations,
    missingCitationClasses: uniqueMissingCitationClasses,
    lowConfidenceReasons: uniqueLowConfidenceReasons,
    fallbackRequired,
    personalizationAvailability: buildPersonalizationAvailability(
      personalizationMissingClasses,
      personalizationLowConfidenceReasons,
    ),
    studyQuestion: modeContract?.studyQuestion ?? null,
    answerUnits,
    answerUnitCoverage,
    // 计数挂在 guard 顶层而非 coverage：无任何需证据单元时 coverage 为 null，
    // 仅出现在 model-derived/章节外的漂移与堆叠仍必须可观测（#1902 review）
    answerCitationDriftCount: answerScan ? answerScan.driftedMarkerCount : 0,
    answerCitationStackCount: answerScan ? answerScan.stackedMarkerCount : 0,
    derivedSectionIds,
    unverifiedCitationMarkers,
    normativeCompliance,
  };
}


function isPersonalizationCitationClass(value: string): boolean {
  return value === 'learner-state'
    || value === 'path-execution'
    || value === 'evidence'
    || value === 'simulation'
    || value === 'arena'
    || value === 'intervention'
    || value === 'memory'
    || value === 'learner-evidence';
}

function isPersonalizationLowConfidenceReason(value: string): boolean {
  const missingCitationPrefix = 'missing-citation:';
  const missingContextPrefix = 'missing-context:';
  if (value.startsWith(missingCitationPrefix)) {
    return isPersonalizationCitationClass(value.slice(missingCitationPrefix.length));
  }
  if (value.startsWith(missingContextPrefix)) {
    return isLimitedPersonalizationContextReason(value);
  }
  if (!value.startsWith('missing-')) return false;
  const missingClass = value.slice('missing-'.length);
  return missingClass === 'personalization'
    || isPersonalizationCitationClass(missingClass);
}

function buildPersonalizationAvailability(
  missingCitationClasses: string[],
  lowConfidenceReasons: string[],
): KonlingCitationGuard['personalizationAvailability'] {
  const uniqueMissingCitationClasses = [...new Set(missingCitationClasses)];
  const uniqueLowConfidenceReasons = [...new Set(lowConfidenceReasons)];
  if (uniqueMissingCitationClasses.length === 0 && uniqueLowConfidenceReasons.length === 0) {
    return {
      status: 'available',
      missingCitationClasses: [],
      lowConfidenceReasons: [],
    };
  }
  return {
    status: 'limited',
    missingCitationClasses: uniqueMissingCitationClasses,
    lowConfidenceReasons: uniqueLowConfidenceReasons,
  };
}

function buildAnswerIntentCitationFallbackReasons(
  answerIntent: KonlingAnswerIntent,
  citationContext: KonlingCitationContext,
  assistantMessage?: string,
): string[] {
  const reasons: string[] = [];
  if (requiresContentCitation(answerIntent)) {
    if (citationContext.contentCitations.length === 0) {
      reasons.push(`answer-intent-content-citation-missing:${answerIntent}`);
    } else if (
      assistantMessage !== undefined &&
      assistantMentionsCitation(assistantMessage, citationContext.contentCitations) === false
    ) {
      reasons.push(`answer-intent-content-citation-missing:${answerIntent}`);
    }
  }
  if (requiresEvidenceCitation(answerIntent) && citationContext.evidenceCitations.length > 0) {
    if (
      assistantMessage !== undefined &&
      assistantMentionsCitation(assistantMessage, citationContext.evidenceCitations) === false
    ) {
      reasons.push(`answer-intent-evidence-citation-missing:${answerIntent}`);
    }
  }
  return reasons;
}

function requiresContentCitation(answerIntent: KonlingAnswerIntent): boolean {
  return answerIntent === 'fact-explanation'
    || answerIntent === 'formula-derivation'
    || answerIntent === 'code-debugging'
    || answerIntent === 'concept-comparison'
    || answerIntent === 'normative-content'
    || answerIntent === 'open-ended-explanation'
    || answerIntent === 'grading-explanation'
    || answerIntent === 'media-guidance'
    || answerIntent === 'path-advice';
}

function requiresEvidenceCitation(answerIntent: KonlingAnswerIntent): boolean {
  return answerIntent === 'personalized-diagnosis' || answerIntent === 'path-advice';
}

export function buildKonlingStreamingCitationGuard(
  context: Pick<KonlingRuntimeContext, 'citationContext'> & {
    teachingAssistantMode?: KonlingTeachingAssistantRuntimeContract;
  },
): KonlingCitationGuard {
  const base = buildKonlingCitationGuard(context);
  return {
    ...base,
    diagnosticReasons: [...new Set([...(base.diagnosticReasons ?? []), 'assistant-citations-unverified-stream'])],
  };
}

function collectUnverifiedCitationMarkers(
  assistantMessage: string,
  citations: readonly KonlingCitation[],
): number[] {
  const bindableNumbers = new Set(
    citations.filter(isBindableAnswerUnitCitation).map((citation) => citation.displayNumber),
  );
  const assignedNumbers = assignedCitationNumbers(citations);
  const codeRanges = markdownCodeRanges(assistantMessage);
  const invalid: number[] = [];
  for (const match of assistantMessage.matchAll(/\[(\d+)\]/g)) {
    const number = Number(match[1]);
    if (!isCitationMarkerPosition(assistantMessage, codeRanges, match.index ?? 0, number, assignedNumbers)) continue;
    if (!bindableNumbers.has(number) && !invalid.includes(number)) {
      invalid.push(number);
    }
  }
  return invalid;
}

export function stripUnverifiedKonlingCitationMarkers(
  assistantMessage: string,
  guard: KonlingCitationGuard,
): string {
  const invalidNumbers = guard.unverifiedCitationMarkers ?? [];
  if (invalidNumbers.length === 0) return assistantMessage;
  const invalidSet = new Set(invalidNumbers);
  const assignedNumbers = assignedCitationNumbers(guard.citations);
  const codeRanges = markdownCodeRanges(assistantMessage);
  return assistantMessage
    .replace(/ ?\[(\d+)\]/g, (raw, digits: string, offset: number) => {
      if (!invalidSet.has(Number(digits))) return raw;
      // offset points at the optional leading space; the technical-index
      // check must see the text right before the bracket itself.
      const bracketOffset = offset + raw.indexOf('[');
      return isCitationMarkerPosition(assistantMessage, codeRanges, bracketOffset, Number(digits), assignedNumbers)
        ? ''
        : raw;
    })
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n');
}

// 学生可见的降级原因映射：未登记的内部 reason code 一律不进入「证据限制」
// 文本，详细原因仅保留在开发诊断 metadata（#1949 review）。
const CITATION_MISSING_CLASS_LABELS: Record<string, string> = {
  content: '课程内容',
  'learner-state': '学习证据',
  'path-execution': '学习路径',
  evidence: '学习证据',
  simulation: '仿真记录',
  arena: 'Arena',
  intervention: '干预记录',
  memory: '记忆摘要',
};

const CITATION_LOW_CONFIDENCE_LABELS: Record<string, string> = {
  'assistant-unverified-citation-markers': '存在未能核验的引用',
};

export function applyKonlingCitationFallback(
  assistantMessage: string,
  guard: KonlingCitationGuard,
): string {
  const sanitizedMessage = stripUnverifiedKonlingCitationMarkers(assistantMessage, guard);
  const unverifiedMarkerCount = (guard.unverifiedCitationMarkers ?? []).length;
  if (!guard.fallbackRequired && unverifiedMarkerCount === 0) return sanitizedMessage;
  const limitation = [
    ...guard.missingCitationClasses
      .flatMap((item) => {
        const label = CITATION_MISSING_CLASS_LABELS[item];
        return label ? [`缺少${label}引用`] : [];
      }),
    ...guard.lowConfidenceReasons
      .flatMap((reason) => {
        const label = CITATION_LOW_CONFIDENCE_LABELS[reason];
        return label ? [label] : [];
      }),
  ].join('；');
  const citations = guard.citations.slice(0, 4)
    .map((citation) => `${citation.displayTitle} (${citation.sourceType}, ${citation.confidence})`)
    .join('；');
  return [
    sanitizedMessage.trim(),
    '',
    `证据限制：本次回答按低置信处理，原因是 ${limitation || '引用覆盖不足'}。`,
    unverifiedMarkerCount > 0
      ? `已移除 ${unverifiedMarkerCount} 个未能核验的引用标记。`
      : '',
    citations ? `可用引用：${citations}` : '',
  ].filter(Boolean).join('\n');
}

const NORMATIVE_ANSWER_AUTHORITY_MARKERS = [
  '法规', '法条', '法律', '官方规定', '官方要求', '官方限值', '官方标准', '官方规范',
  '国家标准', '国标', '行业标准', '标准要求', '规范要求', '标准格式', '规范格式',
  '规范书写', '国标格式', '操作规程', '考核办法', '认证要求',
  'official rule', 'official requirement', 'official limit', 'legal requirement',
] as const;
const NORMATIVE_ANSWER_OBLIGATION_MARKERS = [
  '必须', '不得', '应当', '严禁', '禁止', '务必', '一定要', '才算合格', 'must', 'shall',
] as const;
const NORMATIVE_ANSWER_HEDGE_MARKERS = [
  '需核验', '待核验', '无法核验', '未能核验', '未经核验', '不可核验', '无法确认',
  '无法确定', '不确定', '待确认', '请以', '为准', '建议以', '建议向', '通常', '一般',
  '可能', '原则上', '不能保证', '无法保证',
  'cannot verify', 'unable to verify', 'needs verification', 'unverified',
] as const;

export type KonlingNormativeComplianceViolationClass =
  | 'unhedged-normative-assertion'
  | 'unverified-standard-identifier'
  | 'authority-link';

export interface KonlingNormativeCompliance {
  status: 'compliant' | 'degraded';
  violations: KonlingNormativeComplianceViolationClass[];
}

function scanKonlingNormativeCompliance(assistantMessage: string): KonlingNormativeCompliance {
  const violations = new Set<KonlingNormativeComplianceViolationClass>();
  const codeRanges = markdownCodeRanges(assistantMessage);
  // Per-line matchAll keeps exact absolute offsets: no separator arithmetic,
  // so CRLF bodies cannot drift a line into a code range and skip the scan.
  for (const match of assistantMessage.matchAll(/[^\r\n]*/g)) {
    const rawLine = match[0];
    const lineStart = match.index ?? 0;
    // English markers are lowercase; normalize like query detection so a
    // capitalized “Official requirement: … must …” cannot slip through.
    const normalizedLine = rawLine.trim().toLowerCase().normalize('NFKC');
    if (
      !normalizedLine
      || /^\s*```/.test(rawLine)
      || codeRanges.some((range) => lineStart >= range.start && lineStart < range.end)
    ) {
      continue;
    }
      if (includesAny(normalizedLine, NORMATIVE_ANSWER_HEDGE_MARKERS)) continue;
      // A standard identifier is itself an authority claim: “根据 GB/T 7713 的
      // 规定，…必须…” asserts that standard's obligation without verification.
      const standardId = NORMATIVE_STANDARD_ID.test(normalizedLine);
      const authority = standardId || includesAny(normalizedLine, NORMATIVE_ANSWER_AUTHORITY_MARKERS);
      const obligation = includesAny(normalizedLine, NORMATIVE_ANSWER_OBLIGATION_MARKERS);
      // The gate only runs in verification-required state, where no
      // server-verified official-reference citation exists, so any standard
      // identifier or authority link in the answer is unsourced by definition.
      if (authority && obligation) violations.add('unhedged-normative-assertion');
      if (standardId) violations.add('unverified-standard-identifier');
      if ((authority || obligation) && /https?:\/\//i.test(normalizedLine)) {
        violations.add('authority-link');
      }
    }
  return {
    status: violations.size > 0 ? 'degraded' : 'compliant',
    violations: [...violations],
  };
}

const KONLING_NORMATIVE_DEGRADED_ANSWER = [
  '本次回答涉及规范、标准或官方要求类内容，但当前没有可核验的权威来源，无法确认其中的确定性结论，已按「需核验」降级处理。',
  '',
  '证据缺口：缺少服务端已核验的官方标准文本、法规条款或课程正式规定。',
  '可回答边界：与官方规范效力、具体条款、标准编号或强制要求相关的结论均未经核验，不应作为规范依据。',
  '核验建议：请以课程正式文本、教师确认的书写要求或官方发布渠道为准；如需继续讨论一般原理，可以换一种不依赖官方条款的问法。',
].join('\n');

export function applyKonlingNormativeSafetyDegradation(
  assistantMessage: string,
  guard: KonlingCitationGuard,
): string {
  if (guard.normativeCompliance?.status !== 'degraded') return assistantMessage;
  return KONLING_NORMATIVE_DEGRADED_ANSWER;
}

function assistantMentionsCitation(message: string, citations: KonlingCitation[]): boolean {
  return citations.some((citation) => (
    (
      Number.isInteger(citation.displayNumber)
      && message.includes(`[${citation.displayNumber}]`)
    ) ||
    (
      message.includes(citation.sourceType) &&
      message.includes(citation.displayTitle) &&
      message.includes(citation.confidence) &&
      message.includes(citation.evidenceBasis) &&
      (!citation.href || message.includes(citation.href))
    )
  ));
}

async function searchKonlingMemory(
  db: KonlingRuntimeDb,
  input: { scope: KonlingRuntimeScope; query: string; limit: number },
): Promise<KonlingMemoryView[]> {
  const memories = await db.konlingMemory?.findMany?.({
    where: {
      userId: input.scope.targetUserId,
      privacyScope: { in: input.scope.privacyScopes },
      classId: input.scope.classId ?? null,
      courseId: input.scope.courseId,
      pageId: input.scope.pageId,
      resourceId: input.scope.resourceId ?? null,
      pathNodeId: input.scope.pathNodeId ?? null,
      ...(input.query
        ? {
            summary: {
              contains: input.query,
              mode: 'insensitive',
            },
          }
        : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: input.limit,
  }) ?? [];
  return memories.map(toMemoryView);
}

async function searchKnowledgeGraph(db: KonlingRuntimeDb, query: string, limit: number) {
  const nodes = await db.knowledgeNode?.findMany?.({
    where: query
      ? {
          isActive: true,
          OR: [
            { name: { contains: query, mode: 'insensitive' } },
            { description: { contains: query, mode: 'insensitive' } },
            { tags: { has: query } },
          ],
        }
      : { isActive: true },
    select: {
      id: true,
      name: true,
      description: true,
      tags: true,
    },
    take: limit,
  }) ?? [];
  return nodes.map((node) => ({
    id: getString(node, 'id'),
    name: getString(node, 'name'),
    description: summarizeText(getString(node, 'description'), 160),
    tags: arrayOfStrings(getValue(node, 'tags')),
  }));
}

async function buildKnowledgeWorkspaceContext(
  db: KonlingRuntimeDb,
  scope: KonlingRuntimeScope,
  hint?: KonlingKnowledgeWorkspaceHint | null,
): Promise<KonlingKnowledgeWorkspaceContext | null> {
  if (scope.pageId !== '/knowledge' && scope.pageId !== 'knowledge') return null;

  const selectedNodeId = sanitizeKnowledgeWorkspaceText(hint?.selectedNodeId);
  const requestedNodeId = sanitizeKnowledgeWorkspaceText(hint?.requestedNodeId);
  const contextNodeId = hint?.status === 'degraded'
    ? null
    : selectedNodeId ?? requestedNodeId;
  const relationSummary = {
    density_mode: sanitizeKnowledgeWorkspaceText(hint?.densityMode),
    view_mode: sanitizeKnowledgeWorkspaceText(hint?.viewMode),
    active_filters: normalizeKnowledgeWorkspaceStrings(hint?.activeFilters),
    visible_relation_count: normalizeKnowledgeWorkspaceCount(hint?.visibleRelationCount),
    selected_node_relation_count: normalizeKnowledgeWorkspaceCount(hint?.selectedNodeRelationCount),
  };

  if (!contextNodeId) {
    const missingContext = hint?.status === 'degraded'
      ? 'knowledge-workspace-selected-node-unresolved'
      : 'knowledge-workspace-selected-node-missing';
    return {
      source: 'server-owned',
      route: '/knowledge',
      status: hint?.status === 'degraded' ? 'degraded' : 'no-selection',
      selected_node: null,
      relation_summary: relationSummary,
      available_learning_actions: ['search-knowledge-graph', 'open-chapter-directory'],
      hover_policy: 'preview-only-not-durable-context',
      missing_context: [missingContext],
    };
  }

  const nodes = await db.knowledgeNode?.findMany?.({
    where: {
      isActive: true,
      id: { in: [contextNodeId] },
    },
    select: {
      id: true,
      name: true,
      nodeType: true,
      description: true,
      knowledgeDim: true,
      metadata: true,
      tags: true,
    },
    take: 1,
  }) ?? [];
  const selectedNode = nodes[0] ?? null;
  if (!selectedNode) {
    return {
      source: 'server-owned',
      route: '/knowledge',
      status: 'degraded',
      selected_node: null,
      relation_summary: relationSummary,
      available_learning_actions: ['search-knowledge-graph', 'open-chapter-directory'],
      hover_policy: 'preview-only-not-durable-context',
      missing_context: ['knowledge-workspace-selected-node-unresolved'],
    };
  }

  return {
    source: 'server-owned',
    route: '/knowledge',
    status: 'selected-node',
    selected_node: {
      id: getString(selectedNode, 'id'),
      name: getString(selectedNode, 'name'),
      node_type: getString(selectedNode, 'nodeType'),
      chapter: resolveKnowledgeWorkspaceChapter(selectedNode),
      knowledge_dim: getString(selectedNode, 'knowledgeDim') || null,
      description: summarizeText(getString(selectedNode, 'description'), 220),
      tags: arrayOfStrings(getValue(selectedNode, 'tags')),
      capability_target_refs: readKnowledgeWorkspaceCapabilityTargetRefs(selectedNode),
    },
    relation_summary: relationSummary,
    available_learning_actions: ['open-knowledge-card', 'search-related-resources', 'continue-learning-path'],
    hover_policy: 'preview-only-not-durable-context',
    missing_context: [],
  };
}

function resolveKnowledgeWorkspaceChapter(node: unknown): string | null {
  const metadata = readRecord(getValue(node, 'metadata'));
  const chapterName = metadata.chapterName ?? metadata.chapter_name ?? metadata.chapter;
  if (typeof chapterName === 'string' && chapterName.trim()) return chapterName.trim();
  if (typeof chapterName === 'number' && Number.isFinite(chapterName)) return `第 ${chapterName} 章`;
  return null;
}

function readKnowledgeWorkspaceCapabilityTargetRefs(node: unknown): string[] {
  const metadata = readRecord(getValue(node, 'metadata'));
  return [
    ...arrayOfStrings(metadata.capabilityTargetRefs),
    ...arrayOfStrings(metadata.capabilityTargets),
    ...arrayOfStrings(metadata.capability_target_refs),
    ...arrayOfStrings(metadata.targetDeficits),
    ...arrayOfStrings(metadata.knowledgeTargets),
  ].map((item) => sanitizeKnowledgeWorkspaceText(item))
    .filter((item): item is string => Boolean(item));
}

function sanitizeKnowledgeWorkspaceText(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.replace(/\s+/g, ' ').trim();
  return normalized.length > 0 ? normalized : null;
}

function normalizeKnowledgeWorkspaceStrings(value: unknown): string[] {
  return arrayOfStrings(value)
    .map((item) => sanitizeKnowledgeWorkspaceText(item))
    .filter((item): item is string => Boolean(item));
}

function normalizeKnowledgeWorkspaceCount(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
}

function normalizeKnowledgeWorkspaceOptionalCount(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value) && value >= 0) return Math.floor(value);
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed >= 0) return Math.floor(parsed);
  }
  return null;
}

function recommendNextAction(context: KonlingRuntimeContext) {
  const citationSupport = buildRecommendationCitationSupport(context.citationContext ?? createMissingCitationContext());
  if (context.planContext.activeNodeId) {
    return {
      action: 'continue_path_node',
      nodeId: context.planContext.activeNodeId,
      reason: '当前学习路径已有可继续节点。',
      citationSupport,
    };
  }
  if (context.learnerState?.risks.activeFlags.length) {
    return {
      action: 'request_remedial_intervention',
      reason: '学习状态存在未解决风险，应优先补救。',
      citationSupport,
    };
  }
  return {
    action: 'ask_clarifying_question',
    reason: '路径上下文不足，先确认学生当前目标。',
    citationSupport,
  };
}

function buildRecommendationCitationSupport(citationContext: KonlingCitationContext) {
  return {
    citations: [
      ...citationContext.contentCitations.slice(0, 2),
      ...citationContext.evidenceCitations.slice(0, 4),
    ],
    missingCitationClasses: citationContext.missingCitationClasses,
    lowConfidenceReasons: citationContext.lowConfidenceReasons,
    readiness: citationContext.missingCitationClasses.length > 0 || citationContext.lowConfidenceReasons.length > 0
      ? 'low-confidence'
      : 'verified',
  };
}

function analyzeKonlingAttempt(studentState: StudentState) {
  const decision = shouldIntervene(studentState);
  return {
    decision,
    whyNow: buildWhyNow(decision, studentState),
    evidence: buildInterventionEvidence(studentState),
    alternatives: decision.shouldIntervene
      ? ['改用更小参数步长', '回到前置知识卡', '请求教师确认约束']
      : ['继续当前探索', '记录本轮参数与指标关系'],
  };
}

function buildServerOwnedPageContext(scope: KonlingRuntimeScope): PageContext {
  const stepContext = getStepAIContext(scope.courseId, scope.pageId);
  const simulationContext = buildServerOwnedSimulationPageContext(scope);
  return {
    courseId: scope.courseId,
    courseTitle: stepContext?.courseTitle || scope.courseId,
    pageType: stepContext?.pageType || 'theory',
    stepId: scope.pageId,
    topic: stepContext?.topic || scope.pageId,
    learningObjectives: stepContext?.learningObjectives || [],
    knowledgeType: stepContext?.knowledgeType || 'C',
    candidateGraph: scope.candidateGraph ?? null,
    ...simulationContext,
  };
}

function buildServerOwnedTextbookRetrievalQuery(input: {
  pageContext: PageContext;
}): string | null {
  const query = uniqueStrings([
    input.pageContext.courseTitle,
    input.pageContext.topic,
    ...input.pageContext.learningObjectives,
  ]).join(' ').replace(/\s+/g, ' ').trim().slice(0, 1_000);
  return query || null;
}

function buildServerOwnedSimulationPageContext(scope: KonlingRuntimeScope): Partial<PageContext> {
  if (scope.courseId !== 'simulation') return {};
  const simulationId = scope.pageId && scope.pageId !== 'unknown-page' ? scope.pageId : 'catalog';
  return {
    simulationId,
    routeProvenance: 'simulation-route',
    runSummaryAvailability: 'unavailable-until-runtime-run',
  };
}

function buildServerOwnedUserProfile(input: {
  userId: string;
  name: string;
  learnerState: AdaptiveLearnerState | null;
}): UserProfile {
  return toServerOwnedUserProfile(projectGovernedCopilotProfile(input.learnerState, {
    authenticatedUserId: input.userId,
    displayName: input.name,
    unavailable: !input.learnerState,
  }));
}

function buildMissingContext(input: {
  learnerStateEnabled: boolean;
  learnerState: AdaptiveLearnerState | null;
  planContext: KonlingPlanContext;
  memory: KonlingMemoryView[];
  citationContext: KonlingCitationContext;
  pageContext: PageContext;
  knowledgeWorkspace?: KonlingKnowledgeWorkspaceContext | null;
  graphContext?: KonlingKaqGraphContext | null;
}): string[] {
  return [
    !input.learnerStateEnabled ? ADAPTIVE_LEARNER_STATE_FEATURE_FLAG : null,
    input.learnerStateEnabled && !input.learnerState ? 'learner-state-read-failed' : null,
    input.planContext.status === 'missing' ? 'plan-context-missing' : null,
    input.memory.length === 0 ? 'learning-memory-empty' : null,
    input.pageContext.courseId === 'simulation' && input.pageContext.runSummaryAvailability === 'unavailable-until-runtime-run'
      ? 'simulation-run-summary-unavailable'
      : null,
    ...input.citationContext.missingCitationClasses.map((item) => `citation-${item}-missing`),
    ...input.citationContext.lowConfidenceReasons,
    ...(input.knowledgeWorkspace?.missing_context ?? []),
    ...(input.graphContext?.missingGrounding.map((item) => `graph-${item.class}-missing`) ?? []),
  ].filter((item): item is string => Boolean(item));
}

function buildWhyNow(decision: InterventionDecision, state: StudentState): string {
  if (decision.reason === 'constraint_violation') return '最近一次尝试触及约束边界，继续调参可能扩大风险。';
  if (decision.reason === 'multiple_failures') return `已经出现 ${state.attemptHistory.filter((attempt) => !attempt.isSuccessful).length} 次失败尝试，需要先重建策略。`;
  if (decision.reason === 'stagnation') return '最近几次尝试指标改善不足，学习者可能陷入低收益搜索。';
  return '当前不需要主动干预。';
}

function resolveServerTeacherPolicy(_scope: KonlingRuntimeScope): 'allowed' | 'blocked' {
  return 'allowed';
}

function buildKonlingInterventionSessionId(
  scope: KonlingRuntimeScope,
  arenaContext?: ArenaCompanionContext,
) {
  const base = `konling:${scope.courseId}:${scope.pageId}`;
  if (!arenaContext) return base;
  return `${base}:arena:${arenaContext.taskId}:${arenaContext.method}`;
}

function buildInterventionEvidence(
  state: StudentState,
  arenaContext?: ArenaCompanionContext,
): unknown[] {
  const attempts = state.attemptHistory.slice(-3).map((attempt) => ({
    attemptNumber: attempt.attemptNumber,
    isSuccessful: attempt.isSuccessful,
    result: redactSensitivePayload(attempt.result),
  }));
  if (!arenaContext) return attempts;
  return [
    {
      kind: 'arena-companion-context',
      ref: `${arenaContext.taskId}:${arenaContext.method}`,
    },
    ...attempts,
  ];
}

function formatSimulationStatus(state: Partial<SimulationStateStore>) {
  return {
    status: state.isRunning ? (state.isPaused ? '已暂停' : '运行中') : '已停止',
    time: formatNumberWithUnit(state.time, '秒', 1),
    position: {
      x: formatNumberWithUnit(state.position?.x, '米', 1),
      z: formatNumberWithUnit(state.position?.z, '米', 1),
    },
    heading: formatNumberWithUnit(state.heading, '°', 1),
    targetHeading: formatNumberWithUnit(state.targetHeading, '°', 1),
    rudder: formatNumberWithUnit(state.rudder, '°', 1),
    speed: formatNumberWithUnit(state.speed, 'm/s', 1),
    pidGains: {
      Kp: state.pidGains?.kp ?? null,
      Ki: state.pidGains?.ki ?? null,
      Kd: state.pidGains?.kd ?? null,
    },
    nomotoModel: {
      K: state.nomotoParams?.K ?? null,
      T: formatNumberWithUnit(state.nomotoParams?.T, '秒', 0),
    },
    seaState: {
      level: typeof state.seaState?.level === 'number' ? `${state.seaState.level} 级` : '不可用',
      waveHeight: formatNumberWithUnit(state.seaState?.waveHeight, '米', 1),
      windSpeed: formatNumberWithUnit(state.seaState?.windSpeed, 'm/s', 1),
    },
    metrics: {
      avgError: formatNumberWithUnit(state.metrics?.avgError, '米', 1),
      maxRudderRate: formatNumberWithUnit(state.metrics?.maxRudderRate, '°/s', 2),
      currentError: formatNumberWithUnit(state.metrics?.currentError, '米', 1),
    },
  };
}

function formatUnavailableSimulationStatus(scope: KonlingRuntimeScope) {
  return {
    unavailable: true,
    reason: '当前 Konling runtime 未提供资源范围内的仿真状态。',
    resourceId: scope.resourceId ?? null,
    ...formatSimulationStatus({}),
  };
}

function formatNumberWithUnit(value: number | undefined, unit: string, digits: number) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '不可用';
  const separator = unit === '°' ? '' : ' ';
  return `${value.toFixed(digits)}${separator}${unit}`;
}

function redactSensitivePayload(value: unknown, _allowedScopes: readonly string[] = ['student-visible']): unknown {
  if (Array.isArray(value)) return value.map((item) => redactSensitivePayload(item, _allowedScopes));
  if (!value || typeof value !== 'object') return value;
  const record = value as Record<string, unknown>;
  const redacted: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(record)) {
    if (/rawDialogue|answerData|privateLearnerEvidence|hiddenEvaluation|konlingMemory|promptContent|messages/i.test(key)) {
      continue;
    }
    redacted[key] = redactSensitivePayload(child, _allowedScopes);
  }
  return redacted;
}

function toMemoryView(memory: unknown): KonlingMemoryView {
  return {
    id: getString(memory, 'id'),
    memoryType: getString(memory, 'memoryType'),
    privacyScope: getString(memory, 'privacyScope'),
    summary: sanitizeMemorySummary(getString(memory, 'summary')),
    evidenceRefs: Array.isArray(getValue(memory, 'evidenceRefs')) ? getValue(memory, 'evidenceRefs') as unknown[] : [],
    createdAt: toIsoOrNull(getValue(memory, 'createdAt')) ?? new Date(0).toISOString(),
  };
}

function sanitizeMemorySummary(value: string): string {
  return summarizeText(
    value
      .replace(/\b(rawDialogue|answerData|privateLearnerEvidence|hiddenEvaluation|promptContent|messages)\b/gi, '[redacted]')
      .replace(/\s+/g, ' ')
      .trim(),
    500,
  );
}

function buildNonVerbatimSessionSummaries(input: {
  courseId: string;
  pageId: string;
  userMessage: string;
  assistantMessage: string;
}) {
  const userIntent = classifyLearningIntent(input.userMessage);
  const supportKind = classifyAssistantSupport(input.assistantMessage);
  const topic = `${input.courseId}/${input.pageId}`;
  return {
    working: `本轮 Konling 支持发生在 ${topic}，学习者意图为 ${userIntent}，系统支持类型为 ${supportKind}。`,
    session: `会话摘要：${topic} 中出现一次 ${userIntent} 请求，Konling 采用 ${supportKind} 方式回应。`,
    episodic: `学习片段：学习者在 ${topic} 主动请求 ${userIntent} 支持。`,
  };
}

function classifyLearningIntent(text: string): string {
  if (/错|失败|不会|不懂|卡住|why|原因|error|fail/i.test(text)) return '困惑澄清';
  if (/下一步|建议|怎么做|路径|推荐|next/i.test(text)) return '下一步规划';
  if (/公式|推导|证明|计算|算/i.test(text)) return '计算推理';
  if (/参数|仿真|超调|稳定|裕度|pid/i.test(text)) return '仿真调参';
  return '一般学习咨询';
}

function classifyAssistantSupport(text: string): string {
  if (/步骤|先|再|最后|1\.|2\./i.test(text)) return '分步脚手架';
  if (/原因|因为|证据|显示/i.test(text)) return '证据解释';
  if (/建议|可以|尝试|下一步/i.test(text)) return '行动建议';
  return '概念说明';
}

function summarizeText(value: string, maxLength: number): string {
  const normalized = value.replace(/\s+/g, ' ').trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength - 1)}…`;
}

function arrayOfStrings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function arrayOfRecords(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value)
    ? value.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object' && !Array.isArray(item))
    : [];
}

function readRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function readNumberRecord(value: unknown): Record<string, number> {
  return Object.fromEntries(
    Object.entries(readRecord(value)).filter((entry): entry is [string, number] =>
      typeof entry[1] === 'number' && Number.isFinite(entry[1])
    ),
  );
}

function getValue(value: unknown, key: string): unknown {
  return value && typeof value === 'object' ? (value as Record<string, unknown>)[key] : undefined;
}

function getString(value: unknown, key: string): string {
  const child = getValue(value, key);
  return typeof child === 'string' ? child : '';
}

function getNumber(value: unknown, key: string): number {
  const child = getValue(value, key);
  return typeof child === 'number' && Number.isFinite(child) ? child : 0;
}

function getBigIntNumberOrNull(value: unknown): number | null {
  if (typeof value === 'bigint') return Number(value);
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function isPrismaUniqueConstraintError(error: unknown): boolean {
  return getString(error, 'code') === 'P2002';
}

function toIsoOrNull(value: unknown): string | null {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string') {
    const time = Date.parse(value);
    return Number.isFinite(time) ? new Date(time).toISOString() : null;
  }
  return null;
}

export class KonlingRuntimeScopeError extends Error {
  constructor(
    readonly status: 400 | 403 | 404 | 409 | 429,
    message: string,
  ) {
    super(message);
    this.name = 'KonlingRuntimeScopeError';
  }
}
