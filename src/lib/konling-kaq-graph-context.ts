import {
  getLearningGoal,
  type LearningGoalDefinition,
} from './adaptive-learning-path-planner';
import { CONTROL_CORRECTION_COURSE_ID_VALUES } from './data-governance/adaptive-learner-state-service';
import {
  buildGraphCenterPayload,
  type GraphCenterOverlayStatus,
  type GraphCenterClassOverlay,
  type GraphCenterClassOverlayInput,
  type GraphCenterDomain,
  type GraphCenterLearnerOverlay,
  type GraphCenterLearnerOverlayInput,
  type GraphCenterResourceCoverage,
} from './data-governance/graph-center';
import type { KaqArtifactVersionRefs } from './kaq-artifact-versioning';
import {
  expandLearningGoalSubgraph,
  type ExpandedGoalSubgraph,
  type GoalSubgraphLimitation,
  type GoalSubgraphPolicyEntry,
} from './graphs/goal-subgraph-expansion-service';
import type {
  KonlingCitationContext,
  KonlingPlanContext,
  KonlingRuntimeScope,
} from './konling-agent-runtime';

export type KonlingGraphGroundingClass =
  | 'learning-goal'
  | 'graph'
  | 'overlay'
  | 'resource'
  | 'path'
  | 'citation'
  | 'version';

export interface KonlingGraphMissingGrounding {
  class: KonlingGraphGroundingClass;
  severity: 'blocking' | 'warning';
  reason: string;
}

export interface KonlingGraphLearningGoalContext {
  id: string;
  title: string;
  version: string;
  objectiveBoundary: {
    knowledgeObjectiveIds: string[];
    capabilityObjectiveIds: string[];
    qualityObjectiveIds: string[];
  };
  pathPolicyFamily: string;
  terminalValidationPolicy: LearningGoalDefinition['terminalValidationPolicy'];
}

export interface KonlingExpandedSubgraphContext {
  learningGoalId: string;
  learningGoalVersion: string;
  graphVersion: string;
  graphNodeIds: ExpandedGoalSubgraph['graphNodeIds'];
  prerequisitePolicy: GoalSubgraphPolicyEntry[];
  checkpointSuggestions: ExpandedGoalSubgraph['checkpointSuggestions'];
  terminalValidationCandidates: ExpandedGoalSubgraph['terminalValidationCandidates'];
  limitations: GoalSubgraphLimitation[];
}

export interface KonlingPathArtifactContext {
  currentPathId: string | null;
  activeNodeId: string | null;
  nextNodeIds: string[];
  completedNodeIds: string[];
  recentPathIds: string[];
  pathOptions: NonNullable<KonlingPlanContext['pathOptions']>;
  selectionHistory: NonNullable<KonlingPlanContext['selectionHistory']>;
  status: KonlingPlanContext['status'];
}

export interface KonlingKaqGraphContext {
  source: 'server-owned';
  status: 'complete' | 'degraded' | 'missing';
  advisoryOnly: true;
  learningGoal: KonlingGraphLearningGoalContext | null;
  selectedGraphNodeIds: string[];
  expandedSubgraph: KonlingExpandedSubgraphContext | null;
  learnerOverlay: GraphCenterLearnerOverlay | null;
  classOverlay: GraphCenterClassOverlay | null;
  resourceCoverage: Record<string, GraphCenterResourceCoverage>;
  pathArtifact: KonlingPathArtifactContext | null;
  citationRefs: string[];
  evidenceRefs: string[];
  versionRefs: KaqArtifactVersionRefs | null;
  confidence: 'high' | 'medium' | 'low';
  missingGrounding: KonlingGraphMissingGrounding[];
  clientHintsAccepted: [];
  clientHintsRejected: string[];
}

export interface KonlingKaqGraphContextInput {
  scope: Pick<KonlingRuntimeScope, 'courseId' | 'role' | 'targetUserId' | 'classId'>;
  learningGoalId?: string | null;
  selectedGraphNodeIds?: string[] | null;
  learnerOverlay?: GraphCenterLearnerOverlay | null;
  learnerOverlayInput?: GraphCenterLearnerOverlayInput | null;
  classOverlay?: GraphCenterClassOverlay | null;
  classOverlayInput?: GraphCenterClassOverlayInput | null;
  resourceCoverage?: Record<string, GraphCenterResourceCoverage> | null;
  planContext?: KonlingPlanContext | null;
  citationContext?: KonlingCitationContext | null;
  clientHints?: Record<string, unknown> | null;
}

const GRAPH_DOMAINS: GraphCenterDomain[] = ['knowledge', 'capability', 'quality'];

export function resolveKonlingGraphContextLearningGoalId(
  ...candidates: Array<string | null | undefined>
): string | null {
  for (const candidate of candidates) {
    if (!candidate) continue;
    if (getLearningGoal(candidate)) return candidate;
    if (CONTROL_CORRECTION_COURSE_ID_VALUES.includes(candidate as typeof CONTROL_CORRECTION_COURSE_ID_VALUES[number])) {
      return 'control-correction';
    }
  }
  return null;
}

export function buildKonlingKaqGraphContext(input: KonlingKaqGraphContextInput): KonlingKaqGraphContext {
  const learningGoalId = input.learningGoalId
    ?? resolveKonlingGraphContextLearningGoalId(input.scope.courseId);
  const learningGoal = learningGoalId ? getLearningGoal(learningGoalId) : null;
  const expandedSubgraph = learningGoal ? expandLearningGoalSubgraph(learningGoal.id) : null;
  const groundingNodeIds = expandedSubgraph
    ? [
        ...expandedSubgraph.graphNodeIds.knowledge,
        ...expandedSubgraph.graphNodeIds.capability,
        ...expandedSubgraph.graphNodeIds.quality,
      ]
    : [];
  const selectedGraphNodeIds = normalizeSelectedGraphNodeIds(
    input.selectedGraphNodeIds ?? [],
    groundingNodeIds,
  );
  const graphCenterContext = buildGraphCenterContext({
    targetGraphNodeIds: groundingNodeIds,
    learnerOverlayInput: input.learnerOverlayInput,
    classOverlayInput: input.classOverlayInput,
  });
  const learnerOverlay = filterLearnerOverlay(
    input.learnerOverlay ?? graphCenterContext.learnerOverlay,
    groundingNodeIds,
  );
  const classOverlay = filterClassOverlay(
    input.classOverlay ?? graphCenterContext.classOverlay,
    groundingNodeIds,
  );
  const resourceCoverage = filterResourceCoverage(
    input.resourceCoverage ?? graphCenterContext.resourceCoverage,
    groundingNodeIds,
  );
  const pathArtifact = input.planContext ? buildPathArtifact(input.planContext) : null;
  const citationRefs = buildCitationRefs(input.citationContext);
  const evidenceRefs = buildEvidenceRefs(learnerOverlay, input.citationContext);
  const versionRefs = expandedSubgraph?.fixtures.konling.versionRefs ?? null;
  const missingGrounding = buildMissingGrounding({
    learningGoal,
    expandedSubgraph,
    learnerOverlay,
    classOverlay,
    resourceCoverage,
    pathArtifact,
    citationContext: input.citationContext,
    versionRefs,
  });

  return {
    source: 'server-owned',
    status: !learningGoal ? 'missing' : missingGrounding.length > 0 ? 'degraded' : 'complete',
    advisoryOnly: true,
    learningGoal: learningGoal ? projectLearningGoal(learningGoal) : null,
    selectedGraphNodeIds,
    expandedSubgraph: expandedSubgraph ? projectExpandedSubgraph(expandedSubgraph) : null,
    learnerOverlay,
    classOverlay,
    resourceCoverage,
    pathArtifact,
    citationRefs,
    evidenceRefs,
    versionRefs,
    confidence: buildGraphContextConfidence(missingGrounding),
    missingGrounding,
    clientHintsAccepted: [],
    clientHintsRejected: Object.keys(input.clientHints ?? {}),
  };
}

export function projectKonlingGraphContextForRole(
  context: KonlingKaqGraphContext,
  role: KonlingRuntimeScope['role'],
): KonlingKaqGraphContext {
  if (role !== 'student') return context;
  return {
    ...context,
    classOverlay: context.classOverlay
      ? {
          status: 'unauthorized',
          classId: null,
          items: {},
          limitations: [{
            code: 'class-overlay-unauthorized',
            message: 'Class overlay is not part of the student-visible Konling graph projection.',
          }],
        }
      : null,
  };
}

export function buildKonlingGraphGroundingDegradedReasons(
  context: KonlingKaqGraphContext | null | undefined,
): string[] {
  if (!context) return ['missing-graph-grounding:graph'];
  return context.missingGrounding.map((item) => `missing-graph-grounding:${item.class}`);
}

function buildGraphCenterContext(input: {
  targetGraphNodeIds: string[];
  learnerOverlayInput?: GraphCenterLearnerOverlayInput | null;
  classOverlayInput?: GraphCenterClassOverlayInput | null;
}) {
  const payloads = GRAPH_DOMAINS.map((domain) => buildGraphCenterPayload({
    domain,
    learnerOverlay: input.learnerOverlayInput ?? undefined,
    classOverlay: input.classOverlayInput ?? undefined,
  }));
  return {
    resourceCoverage: Object.assign({}, ...payloads.map((payload) => payload.resourceCoverage)) as Record<string, GraphCenterResourceCoverage>,
    learnerOverlay: mergeLearnerOverlays(payloads.map((payload) => payload.learnerOverlay), input.targetGraphNodeIds),
    classOverlay: mergeClassOverlays(payloads.map((payload) => payload.classOverlay), input.targetGraphNodeIds),
  };
}

function projectLearningGoal(learningGoal: LearningGoalDefinition): KonlingGraphLearningGoalContext {
  return {
    id: learningGoal.id,
    title: learningGoal.title,
    version: learningGoal.version,
    objectiveBoundary: {
      knowledgeObjectiveIds: learningGoal.knowledgeObjectiveIds,
      capabilityObjectiveIds: learningGoal.capabilityObjectiveIds,
      qualityObjectiveIds: learningGoal.qualityObjectiveIds,
    },
    pathPolicyFamily: learningGoal.pathPolicyFamily,
    terminalValidationPolicy: learningGoal.terminalValidationPolicy,
  };
}

function projectExpandedSubgraph(expansion: ExpandedGoalSubgraph): KonlingExpandedSubgraphContext {
  return {
    learningGoalId: expansion.learningGoalId,
    learningGoalVersion: expansion.learningGoalVersion,
    graphVersion: expansion.graphVersion,
    graphNodeIds: expansion.graphNodeIds,
    prerequisitePolicy: expansion.prerequisitePolicy,
    checkpointSuggestions: expansion.checkpointSuggestions,
    terminalValidationCandidates: expansion.terminalValidationCandidates,
    limitations: expansion.limitations,
  };
}

function buildPathArtifact(planContext: KonlingPlanContext): KonlingPathArtifactContext {
  return {
    currentPathId: planContext.currentPathId,
    activeNodeId: planContext.activeNodeId,
    nextNodeIds: planContext.nextNodeIds,
    completedNodeIds: planContext.completedNodeIds,
    recentPathIds: planContext.recentPathIds,
    pathOptions: planContext.pathOptions ?? [],
    selectionHistory: planContext.selectionHistory ?? [],
    status: planContext.status,
  };
}

function normalizeSelectedGraphNodeIds(selectedNodeIds: string[], allowedNodeIds: string[]): string[] {
  const allowed = new Set(allowedNodeIds);
  return uniqueSorted(selectedNodeIds.filter((nodeId) => allowed.has(nodeId)));
}

function filterResourceCoverage(
  coverage: Record<string, GraphCenterResourceCoverage>,
  nodeIds: string[],
): Record<string, GraphCenterResourceCoverage> {
  const wanted = new Set(nodeIds);
  return Object.fromEntries(
    Object.entries(coverage).filter(([nodeId]) => wanted.has(nodeId)),
  );
}

function filterLearnerOverlay(
  overlay: GraphCenterLearnerOverlay | null,
  nodeIds: string[],
): GraphCenterLearnerOverlay | null {
  if (!overlay) return null;
  const wanted = new Set(nodeIds);
  const filtered = {
    ...overlay,
    items: Object.fromEntries(
      Object.entries(overlay.items).filter(([nodeId]) => wanted.has(nodeId)),
    ),
  };
  return {
    ...filtered,
    status: mergeLearnerOverlayStatus(filtered, [overlay.status]),
  };
}

function filterClassOverlay(
  overlay: GraphCenterClassOverlay | null,
  nodeIds: string[],
): GraphCenterClassOverlay | null {
  if (!overlay) return null;
  const wanted = new Set(nodeIds);
  const filtered = {
    ...overlay,
    items: Object.fromEntries(
      Object.entries(overlay.items).filter(([nodeId]) => wanted.has(nodeId)),
    ),
  };
  return {
    ...filtered,
    status: mergeClassOverlayStatus(filtered, [overlay.status]),
  };
}

function mergeLearnerOverlays(
  overlays: GraphCenterLearnerOverlay[],
  nodeIds: string[],
): GraphCenterLearnerOverlay | null {
  const first = overlays[0];
  if (!first) return null;
  const filtered = filterLearnerOverlay({
    status: first.status,
    learnerId: first.learnerId,
    generatedAt: first.generatedAt,
    items: Object.assign({}, ...overlays.map((overlay) => overlay.items)),
    limitations: overlays.flatMap((overlay) => overlay.limitations),
  }, nodeIds);
  if (!filtered) return null;
  return {
    ...filtered,
    status: mergeLearnerOverlayStatus(filtered, overlays.map((overlay) => overlay.status)),
  };
}

function mergeClassOverlays(
  overlays: GraphCenterClassOverlay[],
  nodeIds: string[],
): GraphCenterClassOverlay | null {
  const first = overlays[0];
  if (!first) return null;
  const filtered = filterClassOverlay({
    status: first.status,
    classId: first.classId,
    items: Object.assign({}, ...overlays.map((overlay) => overlay.items)),
    limitations: overlays.flatMap((overlay) => overlay.limitations),
  }, nodeIds);
  if (!filtered) return null;
  return {
    ...filtered,
    status: mergeClassOverlayStatus(filtered, overlays.map((overlay) => overlay.status)),
  };
}

function mergeLearnerOverlayStatus(
  overlay: GraphCenterLearnerOverlay,
  statuses: GraphCenterOverlayStatus[],
): GraphCenterOverlayStatus {
  const items = Object.values(overlay.items);
  if (items.some((item) => item.evidenceCount > 0 && item.confidence > 0 && item.limitations.length === 0)) {
    return 'available';
  }
  if (items.length > 0 && statuses.includes('low-confidence')) return 'low-confidence';
  if (statuses.every((status) => status === 'empty')) return 'empty';
  if (statuses.includes('unauthorized')) return 'unauthorized';
  if (statuses.includes('suppressed')) return 'suppressed';
  if (statuses.includes('low-confidence')) return 'low-confidence';
  if (statuses.includes('unavailable')) return 'unavailable';
  return statuses[0] ?? 'unavailable';
}

function mergeClassOverlayStatus(
  overlay: GraphCenterClassOverlay,
  statuses: GraphCenterOverlayStatus[],
): GraphCenterOverlayStatus {
  const items = Object.values(overlay.items);
  if (items.some((item) => item.suppressionReason === 'none' && item.denominator > 0 && item.confidence > 0)) {
    return 'available';
  }
  if (items.length > 0 && items.every((item) => item.suppressionReason !== 'none')) return 'suppressed';
  if (items.length > 0 && statuses.includes('low-confidence')) return 'low-confidence';
  if (statuses.every((status) => status === 'empty')) return 'empty';
  if (statuses.includes('unauthorized')) return 'unauthorized';
  if (statuses.includes('suppressed')) return 'suppressed';
  if (statuses.includes('low-confidence')) return 'low-confidence';
  if (statuses.includes('unavailable')) return 'unavailable';
  return statuses[0] ?? 'unavailable';
}

function buildCitationRefs(citationContext?: KonlingCitationContext | null): string[] {
  if (!citationContext) return [];
  return [
    ...citationContext.contentCitations.map((citation) => citation.id),
    ...citationContext.evidenceCitations.map((citation) => citation.id),
  ];
}

function buildEvidenceRefs(
  learnerOverlay: GraphCenterLearnerOverlay | null,
  citationContext?: KonlingCitationContext | null,
): string[] {
  return uniqueSorted([
    ...Object.values(learnerOverlay?.items ?? {})
      .flatMap((item) => item.evidenceRefs.map((ref) => `${ref.sourceType}:${ref.sourceId}`)),
    ...(citationContext?.evidenceCitations.map((citation) => citation.id) ?? []),
  ]);
}

function buildMissingGrounding(input: {
  learningGoal: LearningGoalDefinition | null;
  expandedSubgraph: ExpandedGoalSubgraph | null;
  learnerOverlay: GraphCenterLearnerOverlay | null;
  classOverlay: GraphCenterClassOverlay | null;
  resourceCoverage: Record<string, GraphCenterResourceCoverage>;
  pathArtifact: KonlingPathArtifactContext | null;
  citationContext?: KonlingCitationContext | null;
  versionRefs: KaqArtifactVersionRefs | null;
}): KonlingGraphMissingGrounding[] {
  const missing: KonlingGraphMissingGrounding[] = [];
  if (!input.learningGoal) {
    missing.push({ class: 'learning-goal', severity: 'blocking', reason: 'learning-goal-missing' });
  }
  if (!input.expandedSubgraph || input.expandedSubgraph.status === 'rejected') {
    missing.push({ class: 'graph', severity: 'blocking', reason: 'expanded-subgraph-missing-or-rejected' });
  }
  if (!hasUsableOverlay(input.learnerOverlay) && !hasUsableOverlay(input.classOverlay)) {
    missing.push({ class: 'overlay', severity: 'warning', reason: 'learner-or-class-overlay-missing' });
  }
  if (Object.keys(input.resourceCoverage).length === 0) {
    missing.push({ class: 'resource', severity: 'warning', reason: 'resource-coverage-missing' });
  }
  if (!input.pathArtifact || input.pathArtifact.status === 'missing') {
    missing.push({ class: 'path', severity: 'warning', reason: 'path-artifact-missing' });
  }
  if (
    !input.citationContext
    || input.citationContext.contentCitations.length + input.citationContext.evidenceCitations.length === 0
    || (input.citationContext.required === true && input.citationContext.missingCitationClasses.length > 0)
    || input.citationContext.lowConfidenceReasons.length > 0
  ) {
    missing.push({ class: 'citation', severity: 'warning', reason: 'citation-refs-missing' });
  }
  if (!input.versionRefs || !input.versionRefs.graphCatalogVersion || !input.versionRefs.groundingVersion) {
    missing.push({ class: 'version', severity: 'warning', reason: 'version-refs-missing' });
  }
  return missing;
}

function hasUsableOverlay(
  overlay: GraphCenterLearnerOverlay | GraphCenterClassOverlay | null,
): boolean {
  return Boolean(overlay && overlay.status === 'available' && Object.keys(overlay.items).length > 0);
}

function buildGraphContextConfidence(missingGrounding: KonlingGraphMissingGrounding[]): 'high' | 'medium' | 'low' {
  if (missingGrounding.some((item) => item.severity === 'blocking')) return 'low';
  if (missingGrounding.length > 0) return 'medium';
  return 'high';
}

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values)).sort((left, right) => left.localeCompare(right));
}
