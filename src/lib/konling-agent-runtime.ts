import { createHash } from 'node:crypto';

import { z } from 'zod';
import { tool } from 'ai';

import { getStepAIContext } from '@/lib/course-ai-contexts';
import {
  authorizeSimulationRunAccess,
  buildSimulationTaskSpec,
  type SimulationAccessRole,
  type SimulationRunEnvelopeV1,
  type SimulationTaskSpecInputV1,
  type SimulationTaskSpecV1,
} from '@/resources/simulations/core/run-contract';
import {
  ADAPTIVE_LEARNER_STATE_FEATURE_FLAG,
  CONTROL_CORRECTION_COURSE_ID_VALUES,
  isAdaptiveLearnerStateServiceEnabled,
  readAdaptiveLearnerState,
  type AdaptiveLearnerState,
  type AdaptiveLearnerStatePrivacyScope,
  type AdaptiveLearnerStateRole,
} from '@/lib/data-governance/adaptive-learner-state-service';
import { persistSimulationAgentEvidenceMaterialization } from '@/lib/data-governance/simulation-agent-evidence-materialization';
import {
  CONTROL_CORRECTION_PATH_ROUND_GOAL_ID,
  persistLearningPathRound,
  recordPathChoiceEvidence,
  recordPathIntervention,
} from '@/lib/control-correction-path-rounds';
import {
  loadAllTextbookRuntimeResourceCatalogEntries,
  loadAllTextbookRuntimeSearchDocuments,
  type TextbookRuntimeSearchDocument,
} from '@/lib/textbook-runtime-resources';
import {
  buildAdaptiveLearningPathPlan,
  getRegisteredAdaptiveLearningPathGoal,
  type AdaptiveLearningPathGraphContextInput,
  type AdaptiveLearningPathPolicyFamily,
  type AdaptiveLearningPathLearnerState,
  type AdaptiveLearningPathPlan,
  type AdaptiveLearningPathPlanNode,
} from '@/lib/adaptive-learning-path-planner';
import {
  buildKonlingGraphGroundingDegradedReasons,
  buildKonlingKaqGraphContext,
  projectKonlingGraphContextForRole,
  resolveKonlingGraphContextLearningGoalId,
  type KonlingKaqGraphContext,
} from '@/lib/konling-kaq-graph-context';
import { getLearningGoalResourceBaselineForPlanner } from '@/lib/learning-goal-resource-baseline-runtime';
import type { GraphCenterClassOverlayInput } from '@/lib/data-governance/graph-center';
import { buildResourceNodeRegistry } from '@/lib/resource-node-registry';
import { getAllRegisteredResourceMetadata } from '@/lib/resource-registry-metadata';
import { buildFrequencyResponseFoundationsResourceSeedInput } from '@/lib/frequency-response-resource-seed';
import { expandLearningGoalSubgraph } from '@/lib/graphs/goal-subgraph-expansion-service';
import type { PageContext, UserProfile, AbilityVector } from '@/types/ai-context';
import type { InterventionDecision, StudentState } from '@/features/ai/companion/intervention-engine';
import { generateIntervention, shouldIntervene } from '@/features/ai/companion/intervention-engine';
import {
  analyzeResultTool,
  analyzeResultInputSchema,
  analyzeSimulationResult,
  buildSimulationParamChangeRequest,
  formatSimulationParamChangeResponse,
  getSimulationStatusInputSchema,
  getSimulationStatusTool,
  setSimulationParamsInputSchema,
  setSimulationParamsTool,
  type SimulationAnalysisInput,
  type SimulationParamChangeInput,
  type SimulationStateStore,
} from '@/lib/ai-tools';
import type { LearningEvidenceCitationChipPayload } from '@/lib/data-governance/learning-evidence-rag-corpus';

export const KONLING_SEMANTIC_MEMORY_FEATURE_FLAG = 'KONLING_SEMANTIC_MEMORY_ENABLED';
export const KONLING_STRATEGY_MEMORY_FEATURE_FLAG = 'KONLING_STRATEGY_MEMORY_ENABLED';

export type KonlingToolName =
  | 'get_page_context'
  | 'get_learner_state'
  | 'get_plan_context'
  | 'search_learning_memory'
  | 'search_knowledge_graph'
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
  | 'analyze_attempt';

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
  | 'prep-coauthor';
export type KonlingTeachingAssistantMountSurface =
  | 'generic-chat'
  | 'student-learning-overview'
  | 'student-path-center'
  | 'resource-node-launch'
  | 'teacher-grading-workbench'
  | 'student-feedback'
  | 'teacher-class-report'
  | 'teacher-prep-pack';
export type KonlingTeachingAssistantContextKey =
  | 'student-path-center'
  | 'diagnosis-view'
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
  | 'prep-pack';
export type KonlingTeachingAssistantStatus = 'ready' | 'degraded' | 'unavailable';
export type KonlingAnswerIntent =
  | 'fact-explanation'
  | 'personalized-diagnosis'
  | 'path-advice'
  | 'grading-explanation'
  | 'media-guidance';

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
  clientHintsAccepted: string[];
  clientHintsRejected: string[];
}

export type KonlingTeachingAssistantServerModeContext = Partial<Record<KonlingTeachingAssistantContextKey, boolean>>;

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
}

export interface KonlingRuntimeContext {
  pageContext: PageContext;
  userProfile: UserProfile;
  learnerState: AdaptiveLearnerState | null;
  planContext: KonlingPlanContext;
  memory: KonlingMemoryView[];
  knowledgeWorkspace?: KonlingKnowledgeWorkspaceContext | null;
  knowledgeCapabilityContext?: KonlingKnowledgeCapabilityContext;
  graphContext?: KonlingKaqGraphContext | null;
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
  scope: Pick<KonlingRuntimeScope, 'authenticatedUserId' | 'targetUserId' | 'role' | 'classId' | 'courseId' | 'pageId' | 'resourceId' | 'pathNodeId' | 'privacyScopes'>;
  missingContext: string[];
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
    optionalContext: ['path-execution-context'],
    permittedTools: ['get_page_context', 'get_learner_state', 'get_plan_context', 'search_knowledge_graph', 'recommend_next_action'],
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
    permittedTools: ['get_page_context', 'get_learner_state', 'get_plan_context', 'search_knowledge_graph', 'recommend_next_action', 'analyze_attempt'],
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
    permittedTools: ['get_page_context', 'search_knowledge_graph'],
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
    permittedTools: ['get_page_context', 'get_learner_state', 'search_knowledge_graph', 'recommend_next_action'],
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
  'prep-coauthor': teachingAssistantMode({
    id: 'prep-coauthor',
    label: '教师备课共创',
    supportedRoles: ['teacher'],
    mountingSurfaces: ['teacher-prep-pack'],
    requiredContext: ['prep-pack', 'diagnosis-view', 'evidence-citations', 'teacher-review-state'],
    optionalContext: ['class-report', 'resource-node'],
    permittedTools: ['get_page_context', 'get_learner_state', 'get_plan_context', 'search_knowledge_graph'],
    citationClasses: ['learner-state', 'path-execution', 'content', 'intervention'],
    payload: 'teacher-scoped-summary',
    outputStatus: 'draft-only',
    requiredCitationOwners: ['answer', 'report-explanation'],
    forbiddenActions: ['publish-prep-item', 'insert-lesson-item'],
  }),
};

const KONLING_TEACHING_ASSISTANT_MODE_ALIASES: Record<string, KonlingTeachingAssistantModeId> = {
  'teacher-grading-assistant': 'grading-assistant',
  'student-feedback-explainer': 'feedback-explainer',
};

function normalizeKonlingTeachingAssistantModeId(modeId?: string | null): KonlingTeachingAssistantModeId | null {
  if (!modeId) return 'generic-chat';
  if (modeId in KONLING_TEACHING_ASSISTANT_MODE_REGISTRY) return modeId as KonlingTeachingAssistantModeId;
  return KONLING_TEACHING_ASSISTANT_MODE_ALIASES[modeId] ?? null;
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
}): KonlingTeachingAssistantRuntimeContract {
  const normalizedModeId = normalizeKonlingTeachingAssistantModeId(input.modeId);
  const mode = resolveKonlingTeachingAssistantMode(input.modeId);
  const clientHintsRejected = Object.keys(input.clientContextHints ?? {});
  const answerIntent = classifyKonlingAnswerIntent(mode, input.runtimeContext, input.scope, input.serverModeContext);
  const groundingContext = buildKonlingKnowledgeCapabilityContext({
    runtimeContext: input.runtimeContext,
    scope: input.scope,
    answerIntent,
  });
  const roleSupported = mode.supportedRoles.includes(input.scope.role);
  const unknownModeReasons = input.modeId && !normalizedModeId ? [`unknown-mode:${input.modeId}`] : [];
  const missingRequiredContext = mode.id === 'generic-chat'
    ? []
    : mode.requiredContext.flatMap((contextKey) =>
      isKonlingModeContextAvailable(contextKey, mode, input.runtimeContext, input.scope, input.serverModeContext)
        ? []
        : [`missing-context:${contextKey}`]
    );
  const missingCitationClasses = mode.id === 'generic-chat'
    ? []
    : mode.citationClasses.flatMap((citationClass) =>
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
    status,
    unavailableReasons,
    degradedReasons,
    groundingContext,
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
      classes: mode.citationClasses,
      requiredOwners: mode.outputContract.requiredCitationOwners,
      missingClasses: missingCitationClasses.map((reason) => reason.replace('missing-citation:', '')),
    },
    privacyPolicy: mode.privacyPolicy,
    outputContract: mode.outputContract,
    clientHintsAccepted: [],
    clientHintsRejected,
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
): KonlingAnswerIntent {
  if (mode.id === 'diagnosis-explainer' || mode.id === 'class-summarizer') return 'personalized-diagnosis';
  if (mode.id === 'path-advisor') return 'path-advice';
  if (mode.id === 'grading-assistant' || mode.id === 'feedback-explainer') return 'grading-explanation';
  if (mode.id === 'resource-coach') {
    return serverModeContext?.['media-resource'] === true ? 'media-guidance' : 'fact-explanation';
  }
  if (mode.id === 'generic-chat') {
    return isKonlingMediaGuidanceScope(runtimeContext) ? 'media-guidance' : 'fact-explanation';
  }
  return 'fact-explanation';
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

  return {
    source: 'server-owned',
    answerIntent: input.answerIntent,
    knowledgeNodeRefs: [...new Set(knowledgeNodeRefs)],
    capabilityTargetRefs: [...new Set(capabilityTargetRefs)],
    resourceRefs: [...new Set(resourceRefs)],
    pathNodeRefs: [...new Set(pathNodeRefs)],
    citationRefs: buildGroundingCitationRefs(citationRefs),
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
  confidence: 'none' | 'low' | 'medium' | 'high';
  evidenceBasis: string;
  owner: 'answer' | 'recommendation' | 'intervention' | 'report-explanation';
  citationChip?: LearningEvidenceCitationChipPayload;
}

export interface KonlingCitationContext {
  required: boolean;
  contentCitations: KonlingCitation[];
  evidenceCitations: KonlingCitation[];
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
}

export function buildKonlingCitationRetrievalSources(guard: KonlingCitationGuard) {
  return guard.citations.map((citation) => ({
    sourceType: citation.sourceType,
    displayTitle: citation.displayTitle,
    href: citation.href,
    confidence: citation.confidence,
    evidenceBasis: citation.evidenceBasis,
  }));
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
  knowledgeWorkspaceHint?: KonlingKnowledgeWorkspaceHint | null;
  trustedContentContext?: boolean;
  now?: Date;
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
  now?: Date;
}

interface KonlingToolRuntimeInput {
  db: KonlingRuntimeDb;
  scope: KonlingRuntimeScope;
  context: KonlingRuntimeContext;
  agentSessionId?: string | null;
  permittedTools?: string[] | null;
  scopedSimulationState?: Partial<SimulationStateStore> | null;
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
  phase: string;
  status?: KonlingAgentSessionStatus;
  state?: Record<string, unknown>;
  permittedTools?: KonlingToolName[];
  pendingApproval?: Record<string, unknown> | null;
  expiresAt?: Date | null;
}

interface KonlingAgentSessionResolveInput extends KonlingAgentSessionCreateInput {
  agentSessionId?: string | null;
}

interface KonlingAgentSessionRefInput {
  scope: KonlingRuntimeScope;
  agentSessionId: string;
  phase?: string;
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
  studentCompetencySnapshot?: {
    findFirst?: (args: any) => Promise<unknown | null>;
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

export const KONLING_TOOL_PERMISSION_TIERS: KonlingToolPermissionTier[] = ['read', 'analyze', 'run', 'write', 'publish'];

export const KONLING_TOOL_REGISTRY: Record<KonlingToolName, KonlingToolRegistryEntry> = {
  get_page_context: toolRegistryEntry('get_page_context', 'read'),
  get_learner_state: toolRegistryEntry('get_learner_state', 'read'),
  get_plan_context: toolRegistryEntry('get_plan_context', 'read'),
  search_learning_memory: toolRegistryEntry('search_learning_memory', 'read'),
  search_knowledge_graph: toolRegistryEntry('search_knowledge_graph', 'read'),
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
  analyze_attempt: toolRegistryEntry('analyze_attempt', 'analyze'),
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
});

const selectLearningPathParameters = adaptivePathToolBaseParameters.extend({
  selectedStyleId: z.string().min(1),
  helpful: z.boolean().optional(),
});

const rejectLearningPathOptionParameters = adaptivePathToolBaseParameters.extend({
  rejectedStyleId: z.string().min(1),
  reason: z.string().max(240).optional(),
});

const explainLearningPathTradeoffParameters = adaptivePathToolBaseParameters.extend({
  styleId: z.string().min(1).optional(),
  compareWithStyleId: z.string().min(1).optional(),
});

const recordPathAdjustmentOutcomeParameters = adaptivePathToolBaseParameters.extend({
  outcome: z.enum(['adopted', 'ignored', 'helpful', 'not-helpful', 'switched']),
  selectedStyleId: z.string().min(1).optional(),
  rejectedStyleIds: z.array(z.string().min(1)).max(8).optional(),
});

export async function verifyKonlingRuntimeScope(
  db: KonlingRuntimeDb,
  input: KonlingRuntimeInput,
): Promise<{ ok: true; scope: KonlingRuntimeScope } | { ok: false; status: 400 | 403 | 404; error: string }> {
  const role = normalizeKonlingRole(input.role);
  const targetUserId = input.targetUserId || input.authenticatedUserId;
  const courseId = input.courseId || input.pageContextHint?.courseId || 'unknown-course';
  const pageId = input.pageId || input.pageContextHint?.stepId || 'unknown-page';

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
    },
  };
}

function resolveAdaptiveLearnerStateGoal(...candidates: Array<string | null | undefined>): string | null {
  for (const candidate of candidates) {
    if (!candidate) continue;
    if (getRegisteredAdaptiveLearningPathGoal(candidate)) {
      return candidate;
    }
    if (CONTROL_CORRECTION_COURSE_ID_VALUES.includes(candidate as typeof CONTROL_CORRECTION_COURSE_ID_VALUES[number])) {
      return 'control-correction';
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
    return readAdaptiveLearnerState(db, {
      userId,
      role: input.scope.role,
      classId: input.scope.classId,
      goal: input.learnerStateGoal,
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
  const learnerStateEnabled = isAdaptiveLearnerStateServiceEnabled();
  const learnerStateGoal = resolveAdaptiveLearnerStateGoal(scope.courseId, input.pageContextHint?.courseId);
  const learnerState = learnerStateEnabled
    ? await readAdaptiveLearnerState(db, {
        userId: scope.targetUserId,
        role: scope.role,
        classId: scope.classId,
        goal: learnerStateGoal,
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
  const pageContext = buildServerOwnedPageContext(scope, input.pageContextHint);
  const userProfile = buildServerOwnedUserProfile({
    userId: scope.targetUserId,
    name: input.authenticatedUserName || '同学',
    learnerState,
  });
  const citationContext = await buildKonlingCitationContext(db, {
    scope,
    pageContext,
    learnerState,
    planContext,
    memory,
    knowledgeWorkspace,
    trustedContentContext: input.trustedContentContext === true,
  });
  const baseRuntimeContext: KonlingRuntimeContext = {
    pageContext,
    userProfile,
    learnerState,
    planContext,
    memory,
    knowledgeWorkspace,
    citationContext,
    permittedTools: DEFAULT_TOOLS,
    missingContext: [],
    featureFlags: {
      learnerState: learnerStateEnabled,
      semanticMemory: process.env.KONLING_SEMANTIC_MEMORY_ENABLED === 'true',
      strategyMemory: process.env.KONLING_STRATEGY_MEMORY_ENABLED === 'true',
    },
  };
  const graphContext = buildKonlingRuntimeGraphContext({
    scope,
    runtimeContext: baseRuntimeContext,
    classOverlayInput,
    clientHints: input.pageContextHint ? { pageContext: input.pageContextHint } : null,
  });
  baseRuntimeContext.graphContext = graphContext;
  const knowledgeCapabilityContext = buildKonlingKnowledgeCapabilityContext({
    runtimeContext: baseRuntimeContext,
    scope,
    answerIntent: classifyKonlingAnswerIntent(resolveKonlingTeachingAssistantMode('generic-chat'), baseRuntimeContext, scope),
  });

  return {
    pageContext,
    userProfile,
    learnerState,
    planContext,
    memory,
    knowledgeWorkspace,
    knowledgeCapabilityContext,
    graphContext,
    citationContext,
    permittedTools: DEFAULT_TOOLS,
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
  });
}

export function buildKonlingToolRuntime(input: KonlingToolRuntimeInput) {
  return {
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
        })
      ),
    })),
    getLearnerState: async () => runKonlingRuntimeTool(input, 'get_learner_state', {}, async () => input.context.learnerState),
    getPlanContext: async () => runKonlingRuntimeTool(input, 'get_plan_context', {}, async () => input.context.planContext),
    searchLearningMemory: async (args: { query?: string; limit?: number } = {}) =>
      runKonlingRuntimeTool(input, 'search_learning_memory', args, async () => searchKonlingMemory(input.db, {
        scope: input.scope,
        query: args.query ?? '',
        limit: args.limit ?? 5,
      })),
    searchKnowledgeGraph: async (args: { query?: string; limit?: number } = {}) =>
      runKonlingRuntimeTool(input, 'search_knowledge_graph', args, async () => searchKnowledgeGraph(input.db, args.query ?? '', args.limit ?? 5)),
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
      runKonlingRuntimeTool(input, 'select_learning_path', args, async () => buildAdaptivePathToolOutcome(input, 'selected', args)),
    rejectLearningPathOption: async (args: z.infer<typeof rejectLearningPathOptionParameters>) =>
      runKonlingRuntimeTool(input, 'reject_learning_path_option', args, async () => buildAdaptivePathToolOutcome(input, 'rejected', args)),
    explainLearningPathTradeoff: async (args: z.infer<typeof explainLearningPathTradeoffParameters>) =>
      runKonlingRuntimeTool(input, 'explain_learning_path_tradeoff', args, async () => buildAdaptivePathTradeoffOutput(input, args)),
    recordPathAdjustmentOutcome: async (args: z.infer<typeof recordPathAdjustmentOutcomeParameters>) =>
      runKonlingRuntimeTool(input, 'record_path_adjustment_outcome', args, async () => buildAdaptivePathToolOutcome(input, args.outcome, args)),
    analyzeAttempt: async (args: { studentState: StudentState }) =>
      runKonlingRuntimeTool(input, 'analyze_attempt', args, async () => analyzeKonlingAttempt(args.studentState)),
  };
}

async function buildAdaptivePathToolOutput(
  input: KonlingToolRuntimeInput,
  operation: 'generated' | 'revised',
  args: z.infer<typeof generateLearningPathParameters> | z.infer<typeof reviseLearningPathOptionsParameters>,
) {
  const goalId = resolveScopedAdaptivePathGoalId(input, args.goalId);
  const registeredGoal = getRegisteredAdaptiveLearningPathGoal(goalId);
  if (!registeredGoal) {
    throw new KonlingRuntimeScopeError(404, '当前页面目标没有可生成的学习路径。');
  }
  const registry = await resolveAdaptivePathGenerationRegistry(goalId);
  const timeBudget = resolveAdaptivePathTimeBudget(registeredGoal, args.timeBudgetMinutes);
  const resourcePreferences = normalizeAdaptivePathResourcePreferences(args.resourcePreference)
    ?? registeredGoal.starterPathPolicy.preferredResourceTypes;
  const plannerRevisionPreference = operation === 'revised'
    ? buildAdaptivePathRevisionPlannerPreference(args)
    : {};
  const graphContext = buildAdaptivePathPlannerGraphContext(input.context.graphContext, goalId, args.graphNodeId);
  const plan = buildAdaptiveLearningPathPlan({
    studentId: input.scope.targetUserId,
    goal: registeredGoal.goal,
    learnerState: normalizeAdaptivePathLearnerStateForPlanner(input.context.learnerState as any)
      ?? buildColdStartAdaptivePathLearnerState(registeredGoal.goal.knowledgeTargets),
    registry,
    graphContext,
    constraints: {
      timeBudgetMinutes: timeBudget.effectiveMinutes,
      privacyScopes: ['student-visible'],
      completedNodeIds: input.context.planContext?.completedNodeIds ?? [],
      currentNodeId: input.context.planContext?.activeNodeId ?? null,
    },
    difficultyRhythm: args.difficultyRhythm ?? registeredGoal.starterPathPolicy.difficultyRhythm,
    resourcePreferences,
    checkpointPreference: args.checkpointPreference ?? 'standard',
    allowExternalResources: args.allowExternalResources ?? registeredGoal.starterPathPolicy.allowExternalResources,
    ...plannerRevisionPreference,
    excludedNodeIds: args.excludedNodeIds,
    preferredStyleId: args.preferredStyleId,
    requestedAt: args.requestedAt,
    now: new Date(),
  });
  const toolScope = buildAdaptivePathToolScope(input, goalId, args.pathId);
  const requestSnapshot = redactSensitivePayload({
    requestedTimeBudgetMinutes: args.timeBudgetMinutes ?? null,
    effectiveTimeBudgetMinutes: timeBudget.effectiveMinutes,
    difficultyRhythm: args.difficultyRhythm ?? null,
    resourcePreference: resourcePreferences,
    checkpointPreference: args.checkpointPreference ?? null,
    allowExternalResources: args.allowExternalResources ?? false,
    graphNodeId: args.graphNodeId ?? null,
    intentSummary: summarizeStudentIntent(args.naturalLanguageIntent),
    excludedNodeIds: args.excludedNodeIds ?? [],
    preferredStyleId: args.preferredStyleId ?? null,
    requestedAt: args.requestedAt ?? null,
  });
  const hasPersistablePath = plan.mainPath.length > 0;
  if (hasPersistablePath) {
    await persistLearningPathRound(input.db as any, {
      plan,
      classId: input.scope.classId ?? null,
      learnerStateRef: input.context.learnerState ? `adaptive-learner-state:${input.scope.targetUserId}` : null,
      inputSnapshot: {
        source: 'konling-tool',
        operation,
        toolScope,
        request: requestSnapshot,
      },
    });
  }
  if (operation === 'revised' && hasPersistablePath) {
    await recordPathChoiceEvidence(input.db as any, {
      pathId: args.pathId ?? input.context.planContext?.currentPathId ?? plan.id,
      userId: input.scope.targetUserId,
      goalId,
      action: 'switch',
      selectedStyleId: 'selectedStyleId' in args ? args.selectedStyleId ?? null : null,
      rejectedStyleIds: 'rejectedStyleIds' in args ? args.rejectedStyleIds ?? [] : [],
      resourceMix: buildPathResourceMix(plan.mainPath),
      rationaleMetadata: {
        outcome: 'revised',
        priorRequestId: 'priorRequestId' in args ? args.priorRequestId ?? null : null,
        checkpointPreference: args.checkpointPreference ?? null,
        graphNodeId: args.graphNodeId ?? null,
        intentSummary: summarizeStudentIntent(args.naturalLanguageIntent),
        excludedNodeIds: args.excludedNodeIds ?? [],
        preferredStyleId: args.preferredStyleId ?? null,
        requestedAt: args.requestedAt ?? null,
      },
      idempotencyKey: `${args.idempotencyKey}:revision`,
      actorUserId: input.scope.authenticatedUserId,
      actorRole: input.scope.role,
    });
  }
  const pathOptions = hasPersistablePath ? buildStudentSafePathOptions(plan) : [];
  const fallbackReasons = plan.explanations.fallbackReasons;
  return {
    operation,
    scope: toolScope,
    generationStatus: hasPersistablePath ? 'persisted' : 'blocked',
    request: {
      requestedTimeBudgetMinutes: args.timeBudgetMinutes ?? null,
      effectiveTimeBudgetMinutes: timeBudget.effectiveMinutes,
      timeBudgetAdjusted: timeBudget.adjusted,
      difficultyRhythm: args.difficultyRhythm ?? null,
      resourcePreference: resourcePreferences,
      checkpointPreference: args.checkpointPreference ?? null,
      allowExternalResources: args.allowExternalResources ?? false,
      graphNodeId: args.graphNodeId ?? null,
      intentSummary: summarizeStudentIntent(args.naturalLanguageIntent),
      excludedNodeIds: args.excludedNodeIds ?? [],
      preferredStyleId: args.preferredStyleId ?? null,
      requestedAt: args.requestedAt ?? null,
    },
    pathId: hasPersistablePath ? plan.id : null,
    pathOptions,
    comparison: {
      optionCount: pathOptions.length,
      message: hasPersistablePath
        ? '已根据你的学习证据生成可比较的路径方案。'
        : buildBlockedAdaptivePathGenerationMessage(fallbackReasons),
    },
    limitations: fallbackReasons,
    studentSafeRationale: [
      '路径会依据你的当前目标、学习证据和可用时间生成。',
      '证据不足时会先给出可开始的基础路径，并提示需要补充的学习记录。',
      ...(timeBudget.adjusted ? ['当前目标需要包含终端验证，系统已按最小可行学习时长生成路径。'] : []),
    ],
  };
}

function buildBlockedAdaptivePathGenerationMessage(fallbackReasons: readonly string[]): string {
  if (fallbackReasons.includes('learning-goal-baseline-incomplete')) {
    return '当前目标缺少已审核的基线资源，暂不能生成可执行学习路径。';
  }
  if (fallbackReasons.includes('time-budget-insufficient')) {
    return '当前时间预算不足以生成可执行学习路径，请增加学习时长或减少限制条件。';
  }
  if (fallbackReasons.includes('resource-mapping-insufficient') || fallbackReasons.includes('feasible-goal-path-missing')) {
    return '当前目标缺少可用的路径资源映射，暂不能生成可执行学习路径。';
  }
  return '当前限制条件下暂不能生成可执行学习路径，请调整目标、时间或资源偏好后重试。';
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
): Pick<Parameters<typeof buildAdaptiveLearningPathPlan>[0], 'policyFamily' | 'policyBundle'> {
  if (!('rejectedStyleIds' in args)) return {};
  const preferredFamily = adaptivePathPolicyFamilyFromStyleId(args.preferredStyleId ?? args.selectedStyleId ?? null);
  const rejectedFamilies = new Set((args.rejectedStyleIds ?? [])
    .map((styleId) => adaptivePathPolicyFamilyFromStyleId(styleId))
    .filter((family): family is AdaptiveLearningPathPolicyFamily => Boolean(family)));
  const candidateFamilies = [
    preferredFamily,
    'simulation-driven',
    'preference-matched',
    'foundation-remediation',
    'sprint-correction',
  ].filter((family): family is AdaptiveLearningPathPolicyFamily => Boolean(family));
  const families = Array.from(new Set(candidateFamilies.filter((family) => !rejectedFamilies.has(family))));
  if (!preferredFamily && rejectedFamilies.size === 0) return {};
  return {
    policyFamily: preferredFamily ?? families[0] ?? 'rules-plus-graph-search',
    policyBundle: families.length > 0
      ? { families, overlapThreshold: 0.6 }
      : undefined,
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

function resolveAdaptivePathTimeBudget(
  registeredGoal: NonNullable<ReturnType<typeof getRegisteredAdaptiveLearningPathGoal>>,
  requestedMinutes: number | undefined,
) {
  const minimumMinutes = registeredGoal.checkpointPolicy.requiresTerminalValidation ? 90 : 45;
  const effectiveMinutes = Math.max(requestedMinutes ?? minimumMinutes, minimumMinutes);
  return {
    effectiveMinutes,
    adjusted: typeof requestedMinutes === 'number' && requestedMinutes < minimumMinutes,
  };
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
  if (plan.policyBundle?.status === 'ready' && plan.policyBundle.paths.length) {
    return plan.policyBundle.paths.map((path) => ({
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

async function buildAdaptivePathToolOutcome(
  input: KonlingToolRuntimeInput,
  outcome: string,
  args: z.infer<typeof selectLearningPathParameters> | z.infer<typeof rejectLearningPathOptionParameters> | z.infer<typeof recordPathAdjustmentOutcomeParameters>,
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
    helpful: 'helpful' in args ? args.helpful ?? null : helpfulFromPathAdjustmentOutcome(outcome),
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

function buildAdaptivePathTradeoffOutput(
  input: KonlingToolRuntimeInput,
  args: z.infer<typeof explainLearningPathTradeoffParameters>,
) {
  const goalId = resolveScopedAdaptivePathGoalId(input, args.goalId);
  return {
    operation: 'explained',
    scope: buildAdaptivePathToolScope(input, goalId, args.pathId),
    styleId: args.styleId ?? null,
    compareWithStyleId: args.compareWithStyleId ?? null,
    studentSafeRationale: [
      '路径差异主要来自学习时间、资源类型、检查点密度和当前证据覆盖。',
      '你可以选择更稳妥的路径，也可以选择挑战更高的路径；系统会保留选择和调整记录。',
    ],
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

async function resolveAdaptivePathGenerationRegistry(goalId: string) {
  const runtimeTextbooks = await loadAllTextbookRuntimeResourceCatalogEntries().catch(() => []);
  const runtimeTextbookInput = {
    textbooks: runtimeTextbooks.map((entry) => entry.textbook),
    textbookSections: runtimeTextbooks.flatMap((entry) =>
      entry.sections.map((section) => ({
        ...section,
        bookId: entry.textbook.bookId,
      }))
    ),
  };
  if (goalId === CONTROL_CORRECTION_PATH_ROUND_GOAL_ID) {
    return buildResourceNodeRegistry({
      registeredResources: getAllRegisteredResourceMetadata(),
      ...runtimeTextbookInput,
    });
  }
  if (goalId === 'frequency-response-foundations') {
    return buildResourceNodeRegistry({
      ...buildFrequencyResponseFoundationsResourceSeedInput(),
      ...runtimeTextbookInput,
    });
  }
  throw new KonlingRuntimeScopeError(403, '当前学习目标还没有可生成的路径资源注册表。');
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
    select: { id: true, pathPayload: true, learnerStateRef: true, inputSnapshot: true },
  });
  if (!path) {
    throw new KonlingRuntimeScopeError(403, 'Konling 路径工具不能访问不属于当前学生的学习路径。');
  }
  return path;
}

interface AdaptivePathStoredOption {
  styleId: string;
  policyFamily: string | null;
  resourceMix: Record<string, number>;
  rationaleMetadata: Record<string, unknown>;
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
    .map((option): [string, AdaptivePathStoredOption] | null => {
      const styleId = getString(option, 'styleId');
      if (!styleId) return null;
      return [styleId, {
        styleId,
        policyFamily: getString(option, 'policyFamily') || null,
        resourceMix: readNumberRecord(getValue(option, 'resourceMix')),
        rationaleMetadata: buildStoredAdaptivePathOptionRationale(option),
      }];
    })
    .filter((entry): entry is [string, AdaptivePathStoredOption] => Boolean(entry)));
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
  return 'student-provided-natural-language-path-intent';
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
  if (!isKonlingAdaptivePathTool(toolName)) {
    return redactSensitivePayload(input ?? {});
  }
  const record = readRecord(input);
  const base = {
    idempotencyKey: getString(record, 'idempotencyKey') || null,
    goalId: getString(record, 'goalId') || null,
    pathId: getString(record, 'pathId') || null,
    graphNodeId: getString(record, 'graphNodeId') || null,
    routeIntentProvided: Boolean(getString(record, 'routeIntent')),
    naturalLanguageIntent: summarizeStudentIntent(getString(record, 'naturalLanguageIntent')),
  };
  if (toolName === 'generate_learning_path' || toolName === 'revise_learning_path_options') {
    return redactSensitivePayload({
      ...base,
      timeBudgetMinutes: getNumber(record, 'timeBudgetMinutes') || null,
      difficultyRhythm: getString(record, 'difficultyRhythm') || null,
      resourcePreference: arrayOfStrings(record.resourcePreference),
      checkpointPreference: getString(record, 'checkpointPreference') || null,
      allowExternalResources: typeof record.allowExternalResources === 'boolean' ? record.allowExternalResources : null,
      excludedNodeIds: arrayOfStrings(record.excludedNodeIds),
      preferredStyleId: getString(record, 'preferredStyleId') || null,
      requestedAt: getString(record, 'requestedAt') || null,
      priorRequestId: getString(record, 'priorRequestId') || null,
      rejectedStyleIds: arrayOfStrings(record.rejectedStyleIds),
      selectedStyleId: getString(record, 'selectedStyleId') || null,
    });
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

export async function createKonlingAgentSession(
  db: KonlingRuntimeDb,
  input: KonlingAgentSessionCreateInput,
): Promise<KonlingAgentSessionView> {
  const created = await db.agentSession?.create?.({
    data: {
      ownerUserId: input.scope.targetUserId,
      actorUserId: input.scope.authenticatedUserId,
      classId: input.scope.classId ?? null,
      courseId: input.scope.courseId,
      pageId: input.scope.pageId,
      resourceId: input.scope.resourceId ?? null,
      pathNodeId: input.scope.pathNodeId ?? null,
      phase: input.phase,
      status: input.status ?? 'draft',
      stateJson: redactSensitivePayload(input.state ?? {}),
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
  const session = await db.agentSession?.findFirst?.({
    where: buildAgentSessionScopeWhere(input.scope, input.agentSessionId, input.phase),
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
      phase: input.phase,
    });
  }

  const awaitingApprovalSession = await db.agentSession?.findFirst?.({
    where: {
      ...buildAgentSessionScopeWhere(input.scope),
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
  await persistKonlingAgentToolEvidence(db, {
    ...readRecord(toolRun),
    status: 'succeeded',
    outputSummary: redactSensitivePayload(input.output ?? {}),
    completedAt: now,
    latencyMs: calculateLatencyMs(getValue(toolRun, 'startedAt'), now),
  });
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
    if (toolRun.status === 'succeeded') {
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

async function validateKonlingToolPreflight(
  runtimeInput: KonlingToolRuntimeInput,
  toolName: KonlingToolName,
  toolInput: unknown,
) {
  requireIdempotencyKeyForTool(toolName, toolInput);
  if (toolName === 'generate_learning_path') {
    const parsed = generateLearningPathParameters.parse(toolInput);
    const goalId = resolveScopedAdaptivePathGoalId(runtimeInput, parsed.goalId);
    await resolveAdaptivePathGenerationRegistry(goalId);
    await assertScopedAdaptivePathToolPath(runtimeInput, parsed.pathId, { goalId, requirePath: false, requireExisting: false });
    return;
  }
  if (toolName === 'revise_learning_path_options') {
    const parsed = reviseLearningPathOptionsParameters.parse(toolInput);
    const goalId = resolveScopedAdaptivePathGoalId(runtimeInput, parsed.goalId);
    await resolveAdaptivePathGenerationRegistry(goalId);
    const path = await assertScopedAdaptivePathToolPath(runtimeInput, parsed.pathId, { goalId, requirePath: true, requireExisting: true });
    assertAdaptivePathOptionIds(path, parsed.selectedStyleId, parsed.rejectedStyleIds ?? [], { allowPolicyFallback: true });
    return;
  }
  if (toolName === 'select_learning_path') {
    const parsed = selectLearningPathParameters.parse(toolInput);
    const goalId = resolveScopedAdaptivePathGoalId(runtimeInput, parsed.goalId);
    const path = await assertScopedAdaptivePathToolPath(runtimeInput, parsed.pathId, { goalId, requirePath: true, requireExisting: true });
    assertAdaptivePathOptionIds(path, parsed.selectedStyleId, []);
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

export function buildScopedKonlingAiTools(runtime: ReturnType<typeof buildKonlingToolRuntime>) {
  const tools = {
    get_page_context: tool({
      description: '读取服务端确认的当前页面上下文。',
      inputSchema: z.object({}),
      execute: () => runtime.getPageContext(),
    }),
    get_learner_state: tool({
      description: '读取服务端学习者状态，包含能力、知识掌握、风险与证据置信度。',
      inputSchema: z.object({}),
      execute: () => runtime.getLearnerState(),
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
      description: '记录学生选择某个学习路径方案的结果，选择记录不作为掌握度证据。',
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
    analyze_attempt: tool({
      description: '分析最近尝试并判断是否需要纠偏或补救干预。',
      inputSchema: z.object({
        studentState: z.any(),
      }),
      execute: (args) => runtime.analyzeAttempt(args as { studentState: StudentState }),
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
  const now = input.now ?? new Date();
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
      sessionId: `konling:${input.scope.courseId}:${input.scope.pageId}`,
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

  const decision = shouldIntervene(input.studentState);
  const payload = generateIntervention(decision, input.studentState);
  if (!decision.shouldIntervene) {
    return {
      id: '',
      shouldIntervene: false,
      reason: decision.reason,
      interventionType: 'none',
      content: payload.content,
      whyNow: buildWhyNow(decision, input.studentState),
      evidence: buildInterventionEvidence(input.studentState),
      alternatives: payload.suggestedNextSteps,
      relatedConcepts: payload.relatedConcepts,
      highlightParams: payload.highlightParams,
      showTrendPrediction: payload.showTrendPrediction,
      cooldownUntil: null,
    };
  }
  const cooldownUntil = new Date(now.getTime() + 20 * 60_000);
  const whyNow = buildWhyNow(decision, input.studentState);
  const evidence = buildInterventionEvidence(input.studentState);
  const alternatives = payload.suggestedNextSteps.slice(0, 3);

  const record = await db.aIIntervention?.create?.({
    data: {
      userId: input.scope.targetUserId,
      sessionId: `konling:${input.scope.courseId}:${input.scope.pageId}`,
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
    sessionId: `konling:${input.scope.courseId}:${input.scope.pageId}`,
    classId: input.scope.classId ?? null,
    courseId: input.scope.courseId,
    pageId: input.scope.pageId,
    resourceId: input.scope.resourceId ?? null,
    pathNodeId: input.scope.pathNodeId ?? null,
    memoryType: 'intervention-outcome',
    privacyScope: 'teacher-scoped',
    summary: `${whyNow} 干预类型：${payload.feedbackType}`,
    evidenceRefs: [{ kind: 'ai-intervention', ref: interventionId }],
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
  const updatedCount = typeof getValue(updateResult, 'count') === 'number' ? getValue(updateResult, 'count') as number : 0;
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
  await recordKonlingPathInterventionOutcome(db, input, existingIntervention ?? null);
  return { success: true, outcome };
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

function buildAgentSessionScopeWhere(scope: KonlingRuntimeScope, agentSessionId?: string, phase?: string) {
  return {
    ...(agentSessionId ? { id: agentSessionId } : {}),
    ...(phase ? { phase } : {}),
    ownerUserId: scope.targetUserId,
    classId: scope.classId ?? null,
    courseId: scope.courseId,
    pageId: scope.pageId,
    resourceId: scope.resourceId ?? null,
    pathNodeId: scope.pathNodeId ?? null,
  };
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
  const permittedTools = input.agentSessionId
    ? normalizeKonlingToolNames(input.permittedTools ?? input.context.permittedTools)
    : DEFAULT_TOOLS;
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
  if (getString(policyBundle, 'status') && getString(policyBundle, 'status') !== 'ready') {
    return [];
  }
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
    trustedContentContext: boolean;
  },
): Promise<KonlingCitationContext> {
  const contentCitations = input.trustedContentContext
    ? [
        ...buildContentCitations(input.pageContext),
        ...buildKnowledgeWorkspaceContentCitations(input.knowledgeWorkspace),
        ...await buildTextbookRuntimeContentCitations(),
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

  const featureCache = await db.studentEvidenceFeatureCache?.findUnique?.({
    where: { userId: input.scope.targetUserId },
  }).catch(() => null);
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

  return {
    required: true,
    contentCitations,
    evidenceCitations,
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

async function buildTextbookRuntimeContentCitations(): Promise<KonlingCitation[]> {
  const documents = await loadAllTextbookRuntimeSearchDocuments().catch(() => []);
  const selectedDocuments = selectTextbookRuntimeCitationDocuments(documents);
  return selectedDocuments.map((document) => buildTextbookRuntimeContentCitation(document));
}

function selectTextbookRuntimeCitationDocuments(
  documents: TextbookRuntimeSearchDocument[],
): TextbookRuntimeSearchDocument[] {
  const documentsByBookId = new Map<string, TextbookRuntimeSearchDocument[]>();
  for (const document of documents) {
    const bookId = document.metadata.bookId || 'unknown';
    const bookDocuments = documentsByBookId.get(bookId) ?? [];
    bookDocuments.push(document);
    documentsByBookId.set(bookId, bookDocuments);
  }

  const sortedBookEntries = Array.from(documentsByBookId.entries())
    .sort(([leftBookId], [rightBookId]) => leftBookId.localeCompare(rightBookId));
  const selectedDocuments = sortedBookEntries
    .map(([, bookDocuments]) => bookDocuments.find((document) => document.kind === 'chunk'))
    .filter((document): document is TextbookRuntimeSearchDocument => Boolean(document));
  selectedDocuments.push(
    ...sortedBookEntries
      .map(([, bookDocuments]) => bookDocuments.find((document) => document.kind === 'figure'))
      .filter((document): document is TextbookRuntimeSearchDocument => Boolean(document))
  );
  return selectedDocuments.slice(0, 8);
}

function buildTextbookRuntimeContentCitation(
  document: TextbookRuntimeSearchDocument,
): KonlingCitation {
  const citationTargetRef = document.resourceProjection.citationTargetRef ?? document.id;
  const href = document.citationAddress?.href ?? document.href;
  const evidenceBasis = document.kind === 'figure'
    ? 'textbook-figure-description'
    : 'textbook-section';
  const id = `content:${document.resourceProjection.resourceId}:${citationTargetRef}`;
  const title = document.kind === 'figure'
    ? `${document.title} 图像描述`
    : document.title;
  return {
    id,
    sourceType: 'content',
    displayTitle: title,
    href,
    confidence: 'high',
    evidenceBasis,
    owner: 'answer',
    citationChip: {
      chunkId: id,
      displayTitle: title,
      displayHref: href,
      sourceType: 'course-content',
      addressKind: document.citationAddress?.kind,
      citationAddress: document.citationAddress,
      authorityLevel: 'canonical',
      confidence: 'high',
      freshnessBucket: 'current',
      privacyVisibility: 'public',
      limitationState: null,
    },
  };
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
  const missingCitationClasses = [...citationContext.missingCitationClasses];
  const lowConfidenceReasons = [...citationContext.lowConfidenceReasons];
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

export function applyKonlingCitationFallback(
  assistantMessage: string,
  guard: KonlingCitationGuard,
): string {
  if (!guard.fallbackRequired) return assistantMessage;
  const limitation = [
    ...guard.missingCitationClasses.map((item) => `缺少 ${item} 引用`),
    ...guard.lowConfidenceReasons,
  ].join('；');
  const citations = guard.citations.slice(0, 4)
    .map((citation) => `${citation.displayTitle} (${citation.sourceType}, ${citation.confidence})`)
    .join('；');
  return [
    assistantMessage.trim(),
    '',
    `证据限制：本次回答按低置信处理，原因是 ${limitation || '引用覆盖不足'}。`,
    citations ? `可用引用：${citations}` : '',
  ].filter(Boolean).join('\n');
}

function assistantMentionsCitation(message: string, citations: KonlingCitation[]): boolean {
  return citations.some((citation) => (
    message.includes(citation.id) ||
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

function buildServerOwnedPageContext(scope: KonlingRuntimeScope, hint?: Partial<PageContext> | null): PageContext {
  const stepContext = getStepAIContext(scope.courseId, scope.pageId);
  const simulationContext = buildServerOwnedSimulationPageContext(scope);
  return {
    courseId: scope.courseId,
    courseTitle: stepContext?.courseTitle || hint?.courseTitle || scope.courseId,
    pageType: stepContext?.pageType || hint?.pageType || 'theory',
    stepId: scope.pageId,
    topic: stepContext?.topic || hint?.topic || scope.pageId,
    learningObjectives: stepContext?.learningObjectives || hint?.learningObjectives || [],
    knowledgeType: stepContext?.knowledgeType || hint?.knowledgeType || 'C',
    stage: hint?.stage,
    url: hint?.url,
    ...simulationContext,
  };
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
  return {
    id: input.userId,
    name: input.name,
    learningStyle: 'INTERACTIVE',
    cognitiveLevel: inferCognitiveLevel(input.learnerState),
    abilityVector: toLegacyAbilityVector(input.learnerState),
  };
}

function inferCognitiveLevel(state: AdaptiveLearnerState | null): 1 | 2 | 3 | 4 | 5 {
  const values = Object.values(state?.primaryCompetencies.vector ?? {})
    .map((entry) => typeof entry?.score === 'number' ? entry.score : null)
    .filter((value): value is number => value !== null);
  if (values.length === 0) return 3;
  const avg = values.reduce((sum, value) => sum + value, 0) / values.length;
  if (avg >= 85) return 5;
  if (avg >= 70) return 4;
  if (avg >= 50) return 3;
  if (avg >= 30) return 2;
  return 1;
}

function toLegacyAbilityVector(state: AdaptiveLearnerState | null): AbilityVector {
  const vector = (state?.primaryCompetencies.vector ?? {}) as Record<string, { score?: number } | undefined>;
  return {
    computational: normalizeScore(vector.controlModeling?.score),
    crossDomain: normalizeScore(vector.crossDomainTransfer?.score),
    design: normalizeScore(vector.parameterDesign?.score),
    analysis: normalizeScore(vector.selfDirectedLearning?.score),
    evaluation: normalizeScore(vector.engineeringDecision?.score),
  };
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

function buildInterventionEvidence(state: StudentState): unknown[] {
  return state.attemptHistory.slice(-3).map((attempt) => ({
    attemptNumber: attempt.attemptNumber,
    isSuccessful: attempt.isSuccessful,
    result: redactSensitivePayload(attempt.result),
  }));
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

function normalizeScore(value: unknown): number {
  return typeof value === 'number' ? Math.max(0, Math.min(1, value / 100)) : 0.5;
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
    readonly status: 400 | 403 | 404 | 409,
    message: string,
  ) {
    super(message);
    this.name = 'KonlingRuntimeScopeError';
  }
}
