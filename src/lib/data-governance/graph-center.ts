import {
  AUTOCONTROL_KAQ_GRAPH_CATALOG,
  AUTOCONTROL_KAQ_OBJECTIVE_CATALOG,
  AUTOCONTROL_KAQ_RUNTIME_KNOWLEDGE_COVERAGE,
  validateAutocontrolKaqGraphCatalog,
} from './autocontrol-kaq-graph-catalog';
import {
  verifyLearningEvidenceCitations,
  type LearningEvidenceCorpusChunk,
} from './learning-evidence-rag-corpus';
import {
  chunkMatchesGraphCoverageRefs,
  resourceMatchesGraphCoverageRefs,
} from './resource-coverage-matching';
import {
  projectKaqGraphNodeToSar,
  projectLearningEvidenceChunkToSar,
} from './sar-projection';
import {
  expandSarAssociations,
  type SarAssociationCandidateRefs,
  type SarAssociationExpansionResult,
} from './sar-association-expansion';
import {
  PORTRAIT_V2_DIMENSIONS,
  type KaqObjective,
  type KaqObjectiveDomain,
  type PortraitV2DimensionId,
} from './kaq-objective-taxonomy';
import type {
  SarRetrievalResult,
} from './structured-associative-retrieval';
import type {
  AdaptiveLearnerState,
  AdaptiveLearnerStateRole,
  MasteryEvidenceReference,
  MasteryTraceabilityEntry,
} from './adaptive-learner-state-service';
import type { KaqGraphEdge, KaqGraphNode } from './kaq-graph-schema';
import { getAllRegisteredResourceMetadata } from '../resource-registry-metadata';
import { CONTROL_CORRECTION_CAPABILITY_TARGETS } from '../adaptive-learning-path-planner';
import { buildResourceNodeRegistry, type ResourceNode, type ResourceNodeRegistry } from '../resource-node-registry';
import {
  summarizeResourceFieldCompletionCoverageSummaries,
  summarizeResourceFieldCompletionForCoverage,
  type ResourceFieldCompletionAuditSummary,
  type ResourceFieldCompletionCoverageSummary,
} from '../resource-field-completion-audit';
import type { GraphCenterViewerRole } from './graph-center-source-scope';

export type GraphCenterDomain = KaqObjectiveDomain;
export type GraphCenterOverlayStatus = 'available' | 'unavailable' | 'empty' | 'low-confidence' | 'suppressed' | 'unauthorized';
export type GraphCenterResourceCoverageState = 'sufficient' | 'partial' | 'missing' | 'not-audited';
export type GraphCenterResourceCoverageMissingType =
  | 'linked-resource'
  | 'path-eligible-resource'
  | 'rag-indexed-resource'
  | 'citation-ready-resource'
  | 'verified-citation-resource'
  | 'assessment-resource'
  | 'simulation-resource'
  | 'arena-preview-resource'
  | 'arena-official-resource'
  | 'terminal-validation-capable-resource';
export type GraphCenterLimitationCode =
  | 'partial-seed-coverage'
  | 'learner-overlay-unavailable'
  | 'class-overlay-unavailable'
  | 'learner-overlay-unauthorized'
  | 'learner-overlay-empty'
  | 'learner-overlay-low-confidence'
  | 'learner-overlay-suppressed'
  | 'class-overlay-unauthorized'
  | 'class-overlay-empty'
  | 'class-overlay-low-confidence'
  | 'class-overlay-suppressed'
  | 'resource-coverage-indexed-without-verified-citation';
export type GraphCenterLearnerOverlayState =
  | 'mastered'
  | 'developing'
  | 'weak'
  | 'not-started'
  | 'locked'
  | 'evidence-needed';
export type GraphCenterLearnerOverlayReasonCode =
  | 'advance'
  | 'targeted-practice'
  | 'confirm-with-evidence'
  | 'collect-evidence'
  | 'resource-coverage-needed'
  | 'locked-path';
export type GraphCenterActionRole = 'student' | 'teacher' | 'admin';
export type GraphCenterActionStatus = 'available' | 'disabled' | 'degraded';
export type GraphCenterActionReasonCode =
  | 'missing-path-context'
  | 'missing-resource-context'
  | 'missing-citation-context'
  | 'missing-overlay-context'
  | 'missing-route-context'
  | 'missing-authorization'
  | 'missing-evidence-route';
export type GraphCenterActionRoute =
  | '/interactive-learning'
  | '/assessment/adaptive-practice'
  | '/interactive-learning/resources/[id]'
  | '/teacher/classes/[classId]/analytics-v2'
  | '/teacher/resources/resource-nodes'
  | '/teacher/prep-packs'
  | '/admin/data-governance';

export interface GraphCenterPayloadInput {
  domain?: GraphCenterDomain;
  objectiveId?: string | null;
  portraitDimension?: PortraitV2DimensionId | null;
  selectedNodeId?: string | null;
  resourceRegistry?: ResourceNodeRegistry;
  evidenceCorpus?: LearningEvidenceCorpusChunk[];
  learnerOverlay?: GraphCenterLearnerOverlayInput;
  classOverlay?: GraphCenterClassOverlayInput;
  viewerRole?: GraphCenterViewerRole;
  resourceFieldCompletionSummary?: ResourceFieldCompletionGraphSummary;
  sarAssociation?: GraphCenterSarAssociationInput;
}

export interface GraphCenterDomainOption {
  id: GraphCenterDomain;
  label: string;
  nodeCount: number;
}

export interface GraphCenterObjectiveOption {
  id: string;
  title: string;
  level: KaqObjective['level'];
  parentId: string | null;
  nodeCount: number;
  nodeIds: string[];
}

export interface GraphCenterPortraitDimensionOption {
  id: PortraitV2DimensionId;
  label: string;
  description: string;
  nodeCount: number;
}

export interface GraphCenterLimitation {
  code: GraphCenterLimitationCode;
  message: string;
  nodeId?: string;
}

export interface GraphCenterResourceCoverage {
  domain: GraphCenterDomain;
  nodeId: string;
  linkedResourceCount: number;
  pathEligibleResourceCount: number;
  ragIndexedCount: number;
  citationReadyCount: number;
  verifiedCitationCount: number;
  assessmentResourceCount: number;
  simulationResourceCount: number;
  arenaPreviewResourceCount: number;
  arenaOfficialResourceCount: number;
  terminalValidationCapableResourceCount: number;
  coverageState: GraphCenterResourceCoverageState;
  missingCoverageTypes: GraphCenterResourceCoverageMissingType[];
  linkedResourceIds: string[];
  pathEligibleResourceIds: string[];
  pathEligibleResourceRouteIds: string[];
  filterKnowledgeRefs: string[];
  fieldCompletion?: ResourceFieldCompletionCoverageSummary;
}

export type ResourceFieldCompletionGraphSummary = Pick<ResourceFieldCompletionAuditSummary, 'graphCoverageDiagnostics'>;

export interface GraphCenterSarAssociationInput {
  enabled?: boolean;
  studentId?: string | null;
  classId?: string | null;
  maxEvents?: number;
  maxEntities?: number;
  minConfidence?: number;
}

export interface GraphCenterAssociatedEventSummary {
  id: string;
  title: string;
  safeSummary: string;
  authorityLevel: string;
  privacyScope: string;
}

export interface GraphCenterSarTraceSummary {
  seedEntityIds: string[];
  expansionHopCount: number;
  selectedRefCount: number;
  rejectedRefCount: number;
  limitations: string[];
}

export interface GraphCenterSarResourceGapSuggestion {
  id: string;
  ref: string;
  refType: 'resource-node' | 'retrieval-chunk' | 'citation-target' | 'planning-unit';
  status: 'suggested';
  draft: true;
  suggestedForMissingCoverageTypes: GraphCenterResourceCoverageMissingType[];
  rationale: {
    basisEventIds: string[];
    traceHopCount: number;
    reason: string;
  };
}

export interface GraphCenterAssociatedEvidence {
  status: 'available' | 'unavailable';
  eventCount: number;
  topEvents: GraphCenterAssociatedEventSummary[];
  traceSummary: GraphCenterSarTraceSummary;
  candidateRefs: SarAssociationCandidateRefs;
  resourceGapSuggestions: GraphCenterSarResourceGapSuggestion[];
  limitations: string[];
}

export interface GraphCenterActionTarget {
  route: GraphCenterActionRoute;
  href: string;
  params: Record<string, string>;
}

export interface GraphCenterAction {
  id: `${GraphCenterActionRole}:${string}`;
  role: GraphCenterActionRole;
  label: string;
  description?: string;
  status: GraphCenterActionStatus;
  reasonCode?: GraphCenterActionReasonCode;
  reason?: string;
  target?: GraphCenterActionTarget;
}

export interface GraphCenterEvidenceWindow {
  from: string | null;
  to: string | null;
  freshness: MasteryTraceabilityEntry['freshness'];
}

export interface GraphCenterLearnerEvidenceRef {
  sourceType: MasteryEvidenceReference['sourceType'];
  sourceId: string;
  evidenceAt: string | null;
  confidence: MasteryEvidenceReference['confidence'];
  privacyLevel: MasteryEvidenceReference['privacyLevel'];
}

export interface GraphCenterLearnerRecommendation {
  label: string;
  reasonCode: GraphCenterLearnerOverlayReasonCode;
  rationale: {
    targetRequirement: string;
    observedMastery: string;
    resourceCoverage: string;
    pathContext: string;
  };
  sourceCoverage: MasteryTraceabilityEntry['sourceCoverage'] | null;
  evidenceWindow: GraphCenterEvidenceWindow;
  confidence: number;
  verifiedCitationRefs: string[];
  limitations: string[];
}

export interface GraphCenterLearnerOverlayItem {
  domain: GraphCenterDomain;
  nodeId: string;
  learnerId: string;
  state: GraphCenterLearnerOverlayState;
  score: number | null;
  confidence: number;
  evidenceCount: number;
  lastEvidenceAt: string | null;
  evidenceRefs: GraphCenterLearnerEvidenceRef[];
  reasonCode: GraphCenterLearnerOverlayReasonCode;
  evidenceWindow: GraphCenterEvidenceWindow;
  sourceCoverage: MasteryTraceabilityEntry['sourceCoverage'] | null;
  verifiedCitationRefs: string[];
  recommendation: GraphCenterLearnerRecommendation;
  limitations: string[];
}

export interface GraphCenterLearnerOverlay {
  status: GraphCenterOverlayStatus;
  learnerId: string | null;
  classId: string | null;
  generatedAt: string | null;
  items: Record<string, GraphCenterLearnerOverlayItem>;
  limitations: GraphCenterLimitation[];
}

export interface GraphCenterLearnerOverlayInput {
  state: AdaptiveLearnerState | null;
  requestedLearnerId: string;
  viewerRole: AdaptiveLearnerStateRole;
  authorized: boolean;
  evidenceWindow?: Partial<GraphCenterEvidenceWindow>;
  verifiedCitationRefs?: Record<string, string[]>;
  lockedNodeIds?: string[];
}

export interface GraphCenterClassOverlayDistribution {
  mastered: number;
  developing: number;
  weak: number;
  'not-started': number;
  'evidence-needed': number;
}

export interface GraphCenterClassOverlayItem {
  domain: GraphCenterDomain;
  nodeId: string;
  classId: string;
  distribution: GraphCenterClassOverlayDistribution;
  averageScore: number | null;
  confidence: number;
  commonIssueCodes: GraphCenterLearnerOverlayReasonCode[];
  denominator: number;
  includedPopulation: number;
  excludedPopulation: number;
  suppressionReason: 'low-denominator' | 'empty-class' | 'none';
  roundingPolicy: {
    minimumDenominator: number;
    increment: number;
  };
}

export interface GraphCenterClassOverlay {
  status: GraphCenterOverlayStatus;
  classId: string | null;
  items: Record<string, GraphCenterClassOverlayItem>;
  limitations: GraphCenterLimitation[];
}

export interface GraphCenterClassOverlayInput {
  classId: string;
  viewerRole: AdaptiveLearnerStateRole;
  authorized: boolean;
  learnerStates: AdaptiveLearnerState[];
  minimumDenominator?: number;
  roundingIncrement?: number;
  excludedPopulation?: number;
}

export interface GraphCenterSelectedNodeDetail {
  node: KaqGraphNode;
  objectives: KaqObjective[];
  incomingEdges: KaqGraphEdge[];
  outgoingEdges: KaqGraphEdge[];
  boundResourceRefs: string[];
  resourceCoverage: GraphCenterResourceCoverage;
  associatedEvidence: GraphCenterAssociatedEvidence | null;
  actions: GraphCenterAction[];
  limitations: GraphCenterLimitation[];
}

export interface GraphCenterOverlayPlaceholders {
  learner: GraphCenterOverlayStatus;
  class: GraphCenterOverlayStatus;
  resourceCoverage: GraphCenterOverlayStatus;
}

export interface GraphCenterPayload {
  domains: GraphCenterDomainOption[];
  activeDomain: GraphCenterDomain;
  objectiveId: string | null;
  portraitDimension: PortraitV2DimensionId | null;
  objectives: GraphCenterObjectiveOption[];
  portraitDimensions: GraphCenterPortraitDimensionOption[];
  graph: {
    nodes: KaqGraphNode[];
    edges: KaqGraphEdge[];
  };
  resourceCoverage: Record<string, GraphCenterResourceCoverage>;
  learnerOverlay: GraphCenterLearnerOverlay;
  classOverlay: GraphCenterClassOverlay;
  nodeDetails: Record<string, GraphCenterSelectedNodeDetail>;
  selectedNode: GraphCenterSelectedNodeDetail | null;
  limitations: GraphCenterLimitation[];
  overlays: GraphCenterOverlayPlaceholders;
  validation: ReturnType<typeof validateAutocontrolKaqGraphCatalog>;
}

const DOMAIN_LABELS: Record<GraphCenterDomain, string> = {
  knowledge: '知识',
  capability: '能力',
  quality: '素养',
};

const VALID_DOMAINS: GraphCenterDomain[] = ['knowledge', 'capability', 'quality'];

const OBJECTIVES = [
  ...AUTOCONTROL_KAQ_OBJECTIVE_CATALOG.knowledge,
  ...AUTOCONTROL_KAQ_OBJECTIVE_CATALOG.capability,
  ...AUTOCONTROL_KAQ_OBJECTIVE_CATALOG.quality,
];

const OBJECTIVE_BY_ID = new Map(OBJECTIVES.map((objective) => [objective.id, objective]));
type GraphCenterAdaptivePracticeGoal = 'control-correction' | 'frequency-response-foundations';
const ADAPTIVE_PRACTICE_GOAL_BY_GRAPH_NODE_ID: Record<string, GraphCenterAdaptivePracticeGoal> = {
  'kn:autocontrol:time-domain-performance': 'control-correction',
  'kn:autocontrol:root-locus': 'control-correction',
  'kn:autocontrol:controller-correction': 'control-correction',
  'kn:autocontrol:simulation-validation': 'control-correction',
  'cap:autocontrol:synthesize-controller-correction': 'control-correction',
  'cap:autocontrol:validate-with-simulation-evidence': 'control-correction',
  'cap:autocontrol:transfer-to-ship-ocean-mission': 'control-correction',
  'qual:autocontrol:evidence-integrity': 'control-correction',
  'kn:autocontrol:frequency-response': 'frequency-response-foundations',
  'kn:autocontrol:stability-margin': 'frequency-response-foundations',
  'cap:autocontrol:interpret-time-frequency-response': 'frequency-response-foundations',
};
const CONTROL_CORRECTION_CAPABILITY_TARGET_REFS_BY_NODE_ID: Record<string, string[]> = {
  'cap:autocontrol:interpret-time-frequency-response': [
    'control-correction:time-domain-targets:apply',
    'control-correction:time-domain-targets',
  ],
  'cap:autocontrol:synthesize-controller-correction': [
    'control-correction:root-locus-design:analyze',
    'control-correction:root-locus-design',
  ],
  'cap:autocontrol:validate-with-simulation-evidence': [
    'control-correction:simulation-validation:evaluate',
    'control-correction:simulation-validation',
  ],
  'cap:autocontrol:transfer-to-ship-ocean-mission': [
    'control-correction:arena-transfer:create',
    'control-correction:arena-transfer',
  ],
};
const COVERAGE_BY_NODE_ID = new Map(
  AUTOCONTROL_KAQ_RUNTIME_KNOWLEDGE_COVERAGE.map((coverage) => [coverage.graphNodeId, coverage]),
);
const DEFAULT_RESOURCE_REGISTRY = buildResourceNodeRegistry({
  registeredResources: getAllRegisteredResourceMetadata(),
});
const DEFAULT_EVIDENCE_CORPUS: LearningEvidenceCorpusChunk[] = [];

export function buildGraphCenterPayload(input: GraphCenterPayloadInput = {}): GraphCenterPayload {
  const activeDomain = resolveDomain(input.domain);
  const resourceRegistry = input.resourceRegistry ?? DEFAULT_RESOURCE_REGISTRY;
  const evidenceCorpus = input.evidenceCorpus ?? DEFAULT_EVIDENCE_CORPUS;
  const domainNodes = AUTOCONTROL_KAQ_GRAPH_CATALOG.nodes.filter((node) => node.domain === activeDomain);
  const objectiveId = resolveObjectiveId(input.objectiveId, activeDomain);
  const objective = objectiveId ? OBJECTIVE_BY_ID.get(objectiveId) ?? null : null;
  const portraitDimension = resolvePortraitDimension(input.portraitDimension, domainNodes);
  const filteredNodes = domainNodes.filter((node) => (
    (!objective || nodeMatchesObjective(node, objective)) &&
    (!portraitDimension || node.portraitDimensions.includes(portraitDimension))
  ));
  const filteredNodeIds = new Set(filteredNodes.map((node) => node.id));
  const filteredEdges = AUTOCONTROL_KAQ_GRAPH_CATALOG.edges.filter((edge) => (
    edge.domain === activeDomain &&
    filteredNodeIds.has(edge.sourceNodeId) &&
    filteredNodeIds.has(edge.targetNodeId)
  ));
  const selectedNode = selectNode(filteredNodes, input.selectedNodeId);
  const resourceCoverage = buildResourceCoverageByNode(filteredNodes, resourceRegistry, evidenceCorpus, {
    exposeFieldCompletion: input.viewerRole === 'TEACHER' || input.viewerRole === 'ADMIN',
    resourceFieldCompletionSummary: input.resourceFieldCompletionSummary,
  });
  const baseLimitations = buildLimitations(filteredNodes, resourceCoverage);
  const learnerOverlay = buildLearnerGraphOverlay(filteredNodes, resourceCoverage, input.learnerOverlay);
  const classOverlay = buildClassGraphOverlay(filteredNodes, resourceCoverage, input.classOverlay);
  const limitations = [
    ...baseLimitations,
    ...learnerOverlay.limitations,
    ...classOverlay.limitations,
  ];
  const nodeDetails = buildNodeDetails(
    filteredNodes,
    filteredEdges,
    resourceCoverage,
    resourceRegistry,
    evidenceCorpus,
    limitations,
    {
      viewerRole: input.viewerRole,
      learnerOverlay,
      classOverlay,
      sarAssociation: input.sarAssociation,
    },
  );

  return {
    domains: buildDomains(),
    activeDomain,
    objectiveId,
    portraitDimension,
    objectives: buildObjectiveOptions(activeDomain, domainNodes),
    portraitDimensions: buildPortraitDimensionOptions(domainNodes),
    graph: {
      nodes: filteredNodes,
      edges: filteredEdges,
    },
    resourceCoverage,
    learnerOverlay,
    classOverlay,
    nodeDetails,
    selectedNode: selectedNode ? nodeDetails[selectedNode.id] : null,
    limitations,
    overlays: {
      learner: learnerOverlay.status,
      class: classOverlay.status,
      resourceCoverage: 'available',
    },
    validation: validateAutocontrolKaqGraphCatalog(),
  };
}

function resolveDomain(domain: GraphCenterPayloadInput['domain']): GraphCenterDomain {
  return domain && VALID_DOMAINS.includes(domain) ? domain : 'knowledge';
}

function resolveObjectiveId(objectiveId: GraphCenterPayloadInput['objectiveId'], domain: GraphCenterDomain): string | null {
  if (!objectiveId) return null;
  return OBJECTIVE_BY_ID.get(objectiveId)?.domain === domain ? objectiveId : null;
}

function resolvePortraitDimension(
  dimension: GraphCenterPayloadInput['portraitDimension'],
  domainNodes: KaqGraphNode[],
): PortraitV2DimensionId | null {
  if (!dimension) return null;
  if (!PORTRAIT_V2_DIMENSIONS.some((definition) => definition.id === dimension)) return null;
  return domainNodes.some((node) => node.portraitDimensions.includes(dimension)) ? dimension : null;
}

function selectNode(nodes: KaqGraphNode[], requestedNodeId?: string | null): KaqGraphNode | null {
  if (requestedNodeId) {
    return nodes.find((node) => node.id === requestedNodeId) ?? null;
  }
  return nodes[0] ?? null;
}

function buildDomains(): GraphCenterDomainOption[] {
  return VALID_DOMAINS.map((domain) => ({
    id: domain,
    label: DOMAIN_LABELS[domain],
    nodeCount: AUTOCONTROL_KAQ_GRAPH_CATALOG.nodes.filter((node) => node.domain === domain).length,
  }));
}

function buildObjectiveOptions(domain: GraphCenterDomain, nodes: KaqGraphNode[]): GraphCenterObjectiveOption[] {
  return OBJECTIVES
    .filter((objective) => objective.domain === domain)
    .map((objective) => {
      const matchingNodeIds = nodes
        .filter((node) => nodeMatchesObjective(node, objective))
        .map((node) => node.id);
      return {
        id: objective.id,
        title: objective.title,
        level: objective.level,
        parentId: objective.parentId,
        nodeCount: matchingNodeIds.length,
        nodeIds: matchingNodeIds,
      };
    });
}

function buildPortraitDimensionOptions(nodes: KaqGraphNode[]): GraphCenterPortraitDimensionOption[] {
  return PORTRAIT_V2_DIMENSIONS.map((dimension) => ({
    ...dimension,
    nodeCount: nodes.filter((node) => node.portraitDimensions.includes(dimension.id)).length,
  })).filter((dimension) => dimension.nodeCount > 0);
}

function buildNodeDetails(
  nodes: KaqGraphNode[],
  edges: KaqGraphEdge[],
  resourceCoverage: Record<string, GraphCenterResourceCoverage>,
  resourceRegistry: ResourceNodeRegistry,
  evidenceCorpus: LearningEvidenceCorpusChunk[],
  limitations: GraphCenterLimitation[],
  actionContext: {
    viewerRole: GraphCenterViewerRole;
    learnerOverlay: GraphCenterLearnerOverlay;
    classOverlay: GraphCenterClassOverlay;
    sarAssociation?: GraphCenterSarAssociationInput;
  },
): Record<string, GraphCenterSelectedNodeDetail> {
  return Object.fromEntries(nodes.map((node) => {
    const objectives = node.objectiveIds
      .map((id) => OBJECTIVE_BY_ID.get(id))
      .filter((objective): objective is KaqObjective => Boolean(objective));
    const nodeLimitations = limitations.filter((limitation) => limitation.nodeId === node.id);
    const coverage = resourceCoverage[node.id];
    return [
      node.id,
      {
      node,
      objectives,
      incomingEdges: edges.filter((edge) => edge.targetNodeId === node.id),
      outgoingEdges: edges.filter((edge) => edge.sourceNodeId === node.id),
      boundResourceRefs: buildBoundResourceRefs(node),
      resourceCoverage: coverage,
      associatedEvidence: buildGraphCenterAssociatedEvidence({
        node,
        objectives,
        resourceCoverage: coverage,
        resourceRegistry,
        evidenceCorpus,
        viewerRole: actionContext.viewerRole,
        sarAssociation: actionContext.sarAssociation,
        authorizedScope: sarAuthorizedScope(actionContext.learnerOverlay, actionContext.classOverlay, actionContext.sarAssociation?.studentId ?? null),
      }),
      actions: buildGraphCenterActions({
        node,
        objectives,
        resourceCoverage: coverage,
        limitations: nodeLimitations,
        ...actionContext,
      }),
      limitations: nodeLimitations,
    }];
  }));
}

function buildGraphCenterAssociatedEvidence(input: {
  node: KaqGraphNode;
  objectives: KaqObjective[];
  resourceCoverage: GraphCenterResourceCoverage;
  resourceRegistry: ResourceNodeRegistry;
  evidenceCorpus: LearningEvidenceCorpusChunk[];
  viewerRole: GraphCenterViewerRole;
  sarAssociation?: GraphCenterSarAssociationInput;
  authorizedScope: GraphCenterSarAuthorizedScope;
}): GraphCenterAssociatedEvidence | null {
  if (!input.sarAssociation?.enabled) return null;
  const callerRole = graphCenterSarCallerRole(input.viewerRole);
  if (!callerRole) return null;

  const coverageRefs = buildCoverageRefs(input.node);
  if (coverageRefs.length === 0) {
    return {
      status: 'unavailable',
      eventCount: 0,
      topEvents: [],
      traceSummary: emptySarTraceSummary(['no-graph-coverage-refs']),
      candidateRefs: emptySarCandidateRefs(),
      resourceGapSuggestions: [],
      limitations: ['no-graph-coverage-refs'],
    };
  }

  const linkedResourceIdSet = new Set(input.resourceCoverage.linkedResourceIds);
  const pathEligibleResourceIdSet = new Set(input.resourceCoverage.pathEligibleResourceIds);
  const coverageRefSet = new Set([input.node.id, ...coverageRefs]);
  const graphProjection = projectKaqGraphNodeToSar({
    node: input.node,
    objectives: input.objectives,
    portraitDimensions: PORTRAIT_V2_DIMENSIONS,
    coverageRefs,
  });
  const linkedResources = input.resourceRegistry.nodes.filter((resource) => linkedResourceIdSet.has(resource.id));
  const evidenceProjections = input.evidenceCorpus
    .filter((chunk) => (
      chunkMatchesGraphCoverageRefs(chunk, coverageRefs, linkedResources) &&
      canProjectEvidenceChunkToGraphCenterSar({
        chunk,
        callerRole,
        studentId: input.sarAssociation?.studentId ?? null,
        authorizedScope: input.authorizedScope,
      })
    ))
    .map((chunk) => ({
      chunk,
      projection: projectLearningEvidenceChunkToSar({
        chunk: graphCenterSarProjectionChunk(chunk, callerRole),
        coverageRefs,
        linkedResources,
      }),
    }));
  const projection = mergeSarResults([
    graphProjection,
    ...evidenceProjections.map((entry) => entry.projection),
  ]);
  const seedRefs = projection.entities
    .filter((entity) => entity.entityType === 'graph-node' && coverageRefSet.has(entity.canonicalRef))
    .map((entity) => entity.id);
  const matchedEvidenceSeedRefs = evidenceProjections
    .flatMap((entry) => entry.projection.events.map((event) => event.id));
  const expansion = expandSarAssociations({
    id: `graph-center:${input.node.id}`,
    query: input.node.title,
    useCase: 'graph-context',
    callerScope: {
      role: callerRole,
      ...(input.sarAssociation.studentId ? { studentId: input.sarAssociation.studentId } : {}),
      ...(input.authorizedScope.classId ? { classId: input.authorizedScope.classId } : {}),
    },
    seedRefs: uniqueSorted([...seedRefs, ...matchedEvidenceSeedRefs]),
    projection,
    maxHops: 1,
    maxEvents: input.sarAssociation.maxEvents ?? 8,
    maxEntities: input.sarAssociation.maxEntities ?? 12,
    minConfidence: input.sarAssociation.minConfidence ?? 0.5,
  });
  const safeExpansion = projectGraphCenterAssociatedEvidenceForRole(expansion, input.viewerRole);
  const resourceGapSuggestions = buildSarResourceGapSuggestions({
    expansion,
    visibleExpansion: safeExpansion,
    missingCoverageTypes: input.resourceCoverage.missingCoverageTypes,
    linkedResourceIdSet,
    pathEligibleResourceIdSet,
  });
  return {
    status: safeExpansion.events.length > 0 || resourceGapSuggestions.length > 0
      ? 'available'
      : 'unavailable',
    eventCount: safeExpansion.events.length,
    topEvents: safeExpansion.events.slice(0, 3).map((event) => ({
      id: event.id,
      title: event.title,
      safeSummary: event.safeSummary,
      authorityLevel: event.sourceRef.authorityLevel,
      privacyScope: event.privacyScope,
    })),
    traceSummary: {
      seedEntityIds: safeExpansion.trace.seedEntityIds,
      expansionHopCount: safeExpansion.trace.expansionHops.length,
      selectedRefCount: safeExpansion.trace.selectedRefs.length,
      rejectedRefCount: safeExpansion.trace.rejectedRefs.length,
      limitations: safeExpansion.limitations,
    },
    candidateRefs: safeExpansion.candidateRefs,
    resourceGapSuggestions,
    limitations: safeExpansion.limitations,
  };
}

interface GraphCenterSarAuthorizedScope {
  classId: string | null;
  learnerId: string | null;
}

function sarAuthorizedScope(
  learnerOverlay: GraphCenterLearnerOverlay,
  classOverlay: GraphCenterClassOverlay,
  requestedStudentId: string | null,
): GraphCenterSarAuthorizedScope {
  if (
    requestedStudentId &&
    learnerOverlay.status !== 'unauthorized' &&
    learnerOverlay.status !== 'unavailable' &&
    learnerOverlay.learnerId === requestedStudentId
  ) {
    const classId = learnerOverlay.classId
      ?? (classOverlay.status !== 'unauthorized' && classOverlay.status !== 'unavailable' ? classOverlay.classId : null);
    return { classId, learnerId: learnerOverlay.learnerId };
  }
  if (classOverlay.status !== 'unauthorized' && classOverlay.status !== 'unavailable' && classOverlay.classId) {
    return { classId: classOverlay.classId, learnerId: null };
  }
  if (learnerOverlay.status !== 'unauthorized' && learnerOverlay.status !== 'unavailable' && learnerOverlay.classId) {
    return { classId: learnerOverlay.classId, learnerId: learnerOverlay.learnerId };
  }
  return { classId: null, learnerId: null };
}

function canProjectEvidenceChunkToGraphCenterSar(input: {
  chunk: LearningEvidenceCorpusChunk;
  callerRole: 'student' | 'teacher' | 'admin';
  studentId: string | null;
  authorizedScope: GraphCenterSarAuthorizedScope;
}): boolean {
  const { chunk, callerRole, studentId, authorizedScope } = input;
  const classId = authorizedScope.classId;
  if (!chunk.authority.scopeRule.allowedRoles.includes(callerRole)) return false;
  if (chunk.authority.scopeRule.visibility !== chunk.privacyClass) return false;
  if (chunk.privacyClass === 'service-only') return false;
  if (chunk.privacyClass === 'admin-only') return callerRole === 'admin';
  if (chunk.authority.scopeRule.classRequired && (!chunk.sourceRef.classId || chunk.sourceRef.classId !== classId)) {
    return false;
  }
  if (chunk.authority.scopeRule.ownerRequired && !chunk.sourceRef.ownerUserId) return false;
  if (chunk.sourceRef.ownerUserId) {
    if (callerRole === 'student') return Boolean(studentId && chunk.sourceRef.ownerUserId === studentId);
    if (callerRole === 'teacher') {
      if (!chunk.sourceRef.classId || chunk.sourceRef.classId !== classId) return false;
      return !authorizedScope.learnerId || chunk.sourceRef.ownerUserId === authorizedScope.learnerId;
    }
    return callerRole === 'admin';
  }
  if (chunk.sourceRef.classId && (callerRole === 'student' || callerRole === 'teacher')) {
    return chunk.sourceRef.classId === classId;
  }
  if (chunk.privacyClass === 'teacher-visible') return callerRole === 'teacher' || callerRole === 'admin';
  if (chunk.privacyClass === 'student-visible') {
    if (callerRole === 'admin') return true;
    if (callerRole === 'teacher') return Boolean(classId);
    return !chunk.sourceRef.ownerUserId || chunk.sourceRef.ownerUserId === studentId;
  }
  return chunk.privacyClass === 'public';
}

function graphCenterSarProjectionChunk(
  chunk: LearningEvidenceCorpusChunk,
  callerRole: 'student' | 'teacher' | 'admin',
): LearningEvidenceCorpusChunk {
  if (callerRole !== 'student') return chunk;
  return {
    ...chunk,
    sourceRef: {
      ...chunk.sourceRef,
      ownerUserId: null,
      classId: null,
    },
    authority: {
      ...chunk.authority,
      scopeRule: {
        ...chunk.authority.scopeRule,
        ownerRequired: false,
        classRequired: false,
      },
    },
  };
}

function graphCenterSarCallerRole(viewerRole: GraphCenterViewerRole): 'student' | 'teacher' | 'admin' | null {
  if (viewerRole === 'STUDENT') return 'student';
  if (viewerRole === 'TEACHER') return 'teacher';
  if (viewerRole === 'ADMIN') return 'admin';
  return null;
}

function projectGraphCenterAssociatedEvidenceForRole(
  expansion: SarAssociationExpansionResult,
  viewerRole: GraphCenterViewerRole,
): SarAssociationExpansionResult {
  if (viewerRole !== 'STUDENT') return expansion;
  const eventIdMap = new Map(expansion.events.map((event, index) => [event.id, `sar-event:${index + 1}`]));
  const entityIdMap = new Map(expansion.entities.map((entity, index) => [entity.id, `sar-entity:${index + 1}`]));
  return {
    ...expansion,
    candidateRefs: {
      eventIds: expansion.candidateRefs.eventIds.map((id) => eventIdMap.get(id) ?? 'sar-event:redacted'),
      entityIds: expansion.candidateRefs.entityIds.map((id) => entityIdMap.get(id) ?? 'sar-entity:redacted'),
      citationTargetIds: expansion.candidateRefs.citationTargetIds.map((_, index) => `citation-target:${index + 1}`),
      retrievalChunkIds: expansion.candidateRefs.retrievalChunkIds.map((_, index) => `retrieval-chunk:${index + 1}`),
      resourceNodeIds: expansion.candidateRefs.resourceNodeIds.map((_, index) => `resource-candidate:${index + 1}`),
      planningUnitIds: expansion.candidateRefs.planningUnitIds.map((_, index) => `planning-unit:${index + 1}`),
    },
    events: expansion.events.map((event, index) => ({
      ...event,
      id: eventIdMap.get(event.id) ?? `sar-event:${index + 1}`,
      title: `Associated evidence ${index + 1}`,
      sourceRef: {
        ...event.sourceRef,
        id: `source:${index + 1}`,
        ownerUserId: undefined,
        classId: undefined,
        contentHash: undefined,
      },
      metadata: undefined,
    })),
    entities: expansion.entities.map((entity, index) => ({
      ...entity,
      id: entityIdMap.get(entity.id) ?? `sar-entity:${index + 1}`,
      canonicalRef: `entity:${index + 1}`,
      aliases: [],
    })),
    trace: {
      ...expansion.trace,
      seedEntityIds: expansion.trace.seedEntityIds.map((id) => entityIdMap.get(id) ?? 'sar-entity:redacted'),
      expansionHops: expansion.trace.expansionHops.map((hop) => ({
        ...hop,
        fromEntityId: entityIdMap.get(hop.fromEntityId) ?? 'sar-entity:redacted',
        toEntityId: entityIdMap.get(hop.toEntityId) ?? 'sar-entity:redacted',
        ...(hop.viaEventId ? { viaEventId: eventIdMap.get(hop.viaEventId) ?? 'sar-event:redacted' } : {}),
      })),
      selectedRefs: expansion.trace.selectedRefs.map((_, index) => `sar-ref:${index + 1}`),
      rejectedRefs: expansion.trace.rejectedRefs.map((item, index) => ({
        ref: `sar-rejected:${index + 1}`,
        reason: item.reason,
      })),
    },
    limitations: expansion.limitations.filter(isStudentVisibleSarLimitation),
    sourcePackSeedRefs: expansion.sourcePackSeedRefs.map((_, index) => `sar-ref:${index + 1}`),
  };
}

function isStudentVisibleSarLimitation(limitation: string): boolean {
  return [
    'source-pack-ranking-required',
    'citation-hydration-required',
    'no-resolved-seed-refs',
    'no-expansion-hop-selected',
  ].includes(limitation) || /^event-budget:\d+$/.test(limitation) || /^entity-budget:\d+$/.test(limitation);
}

function buildSarResourceGapSuggestions(input: {
  expansion: SarAssociationExpansionResult;
  visibleExpansion?: SarAssociationExpansionResult;
  missingCoverageTypes: GraphCenterResourceCoverageMissingType[];
  linkedResourceIdSet: ReadonlySet<string>;
  pathEligibleResourceIdSet: ReadonlySet<string>;
}): GraphCenterSarResourceGapSuggestion[] {
  if (input.missingCoverageTypes.length === 0) return [];
  const visibleExpansion = input.visibleExpansion ?? input.expansion;
  const refs: Array<{ ref: string; refType: GraphCenterSarResourceGapSuggestion['refType'] }> = [
    ...input.expansion.candidateRefs.resourceNodeIds
      .map((ref, index) => ({
        rawRef: ref,
        visibleRef: visibleExpansion.candidateRefs.resourceNodeIds[index] ?? 'resource-candidate:redacted',
      }))
      .filter(({ rawRef }) => !input.linkedResourceIdSet.has(rawRef) && !input.pathEligibleResourceIdSet.has(rawRef))
      .map(({ visibleRef }) => ({ ref: visibleRef, refType: 'resource-node' as const })),
    ...visibleExpansion.candidateRefs.retrievalChunkIds.map((ref) => ({ ref, refType: 'retrieval-chunk' as const })),
    ...visibleExpansion.candidateRefs.citationTargetIds.map((ref) => ({ ref, refType: 'citation-target' as const })),
    ...visibleExpansion.candidateRefs.planningUnitIds.map((ref) => ({ ref, refType: 'planning-unit' as const })),
  ];
  return refs.map(({ ref, refType }, index) => ({
    id: `sar-gap:${index + 1}`,
    ref,
    refType,
    status: 'suggested',
    draft: true,
    suggestedForMissingCoverageTypes: input.missingCoverageTypes,
    rationale: {
      basisEventIds: visibleExpansion.candidateRefs.eventIds,
      traceHopCount: visibleExpansion.trace.expansionHops.length,
      reason: 'SAR associated this candidate with the selected graph node; ResourceNode governance review is still required.',
    },
  }));
}

function mergeSarResults(results: SarRetrievalResult[]): Pick<
  SarRetrievalResult,
  'events' | 'entities' | 'relations' | 'citationTargetRefs' | 'retrievalChunkRefs' | 'limitations'
> & { trace: SarRetrievalResult['trace'] } {
  const events = uniqueBy(results.flatMap((result) => result.events), (event) => event.id);
  const entities = uniqueBy(results.flatMap((result) => result.entities), (entity) => entity.id);
  const relations = uniqueBy(
    results.flatMap((result) => result.relations),
    (relation) => `${relation.eventId}:${relation.entityId}:${relation.role}:${relation.source}`,
  );
  const limitations = uniqueSorted(results.flatMap((result) => [
    ...result.limitations,
    ...result.trace.limitations,
  ]));
  return {
    events,
    entities,
    relations,
    citationTargetRefs: uniqueSorted(results.flatMap((result) => result.citationTargetRefs)),
    retrievalChunkRefs: uniqueSorted(results.flatMap((result) => result.retrievalChunkRefs)),
    limitations,
    trace: {
      id: 'sar:trace:graph-center',
      seedEntityIds: uniqueSorted(results.flatMap((result) => result.trace.seedEntityIds)),
      expansionHops: results.flatMap((result) => result.trace.expansionHops),
      selectedRefs: uniqueSorted(results.flatMap((result) => result.trace.selectedRefs)),
      rejectedRefs: results.flatMap((result) => result.trace.rejectedRefs),
      versionRefs: uniqueSorted(results.flatMap((result) => result.trace.versionRefs)),
      limitations,
    },
  };
}

function emptySarCandidateRefs(): SarAssociationCandidateRefs {
  return {
    eventIds: [],
    entityIds: [],
    citationTargetIds: [],
    retrievalChunkIds: [],
    resourceNodeIds: [],
    planningUnitIds: [],
  };
}

function emptySarTraceSummary(limitations: string[]): GraphCenterSarTraceSummary {
  return {
    seedEntityIds: [],
    expansionHopCount: 0,
    selectedRefCount: 0,
    rejectedRefCount: 0,
    limitations,
  };
}

function buildGraphCenterActions(input: {
  node: KaqGraphNode;
  objectives: KaqObjective[];
  resourceCoverage: GraphCenterResourceCoverage;
  limitations: GraphCenterLimitation[];
  viewerRole: GraphCenterViewerRole;
  learnerOverlay: GraphCenterLearnerOverlay;
  classOverlay: GraphCenterClassOverlay;
}): GraphCenterAction[] {
  const role = normalizeGraphCenterActionRole(input.viewerRole);
  if (!role) return [];
  if (role === 'teacher') return buildTeacherGraphCenterActions(input);
  if (role === 'admin') return buildAdminGraphCenterActions(input);
  return buildStudentGraphCenterActions(input);
}

function buildStudentGraphCenterActions(input: {
  node: KaqGraphNode;
  objectives: KaqObjective[];
  resourceCoverage: GraphCenterResourceCoverage;
  learnerOverlay: GraphCenterLearnerOverlay;
}): GraphCenterAction[] {
  const learningGoalId = input.objectives[0]?.id ?? input.node.objectiveIds[0] ?? null;
  const adaptivePracticeGoal = ADAPTIVE_PRACTICE_GOAL_BY_GRAPH_NODE_ID[input.node.id] ?? null;
  const firstResourceId = input.resourceCoverage.pathEligibleResourceRouteIds[0] ?? null;
  const hasLearnerOverlay = Boolean(input.learnerOverlay.items[input.node.id]);
  const learnerOverlayUnauthorized = input.learnerOverlay.status === 'unauthorized';

  return [
    adaptivePracticeGoal
      ? {
          id: 'student:start-path',
          role: 'student',
          label: '进入学习路径',
          description: '从当前 LearningGoal 与图谱节点进入学习路径。',
          status: 'available',
          target: buildGraphCenterActionTarget('/assessment/adaptive-practice', {
            goal: adaptivePracticeGoal,
            graphNodeId: input.node.id,
            intent: 'contextual-recommendation',
          }),
        }
      : {
          id: 'student:start-path',
          role: 'student',
          label: '进入学习路径',
          description: '从当前 LearningGoal 与图谱节点进入学习路径。',
          status: learningGoalId ? 'degraded' : 'disabled',
          reasonCode: 'missing-path-context',
          reason: learningGoalId
            ? '该节点尚未接入可进入的自适应学习路径入口。'
            : '该节点尚未绑定可进入的学习目标。',
        },
    firstResourceId
      ? {
          id: 'student:inspect-resource',
          role: 'student',
          label: '查看推荐资源',
          description: '查看当前节点已绑定且路径可用的推荐资源。',
          status: 'available',
          target: buildGraphCenterActionTarget('/interactive-learning/resources/[id]', {
            resourceId: firstResourceId,
            graphNodeId: input.node.id,
          }),
        }
      : {
          id: 'student:inspect-resource',
          role: 'student',
          label: '查看推荐资源',
          description: '查看当前节点已绑定且路径可用的推荐资源。',
          status: 'degraded',
          reasonCode: 'missing-resource-context',
          reason: '该节点尚未绑定可直接查看的推荐资源。',
        },
    {
      id: 'student:review-evidence',
      role: 'student',
      label: '复查个人证据',
      description: '保留当前图谱节点和学习者证据上下文。',
      status: hasLearnerOverlay ? 'degraded' : 'disabled',
      reasonCode: learnerOverlayUnauthorized
        ? 'missing-authorization'
        : hasLearnerOverlay
          ? 'missing-evidence-route'
          : 'missing-overlay-context',
      reason: learnerOverlayUnauthorized
        ? '当前用户无权读取该学习者图谱 overlay。'
        : hasLearnerOverlay
          ? '证据复查需要学习者证据路由接入。'
          : '学习者 overlay 不可用，暂不能复查个人证据。',
    },
    adaptivePracticeGoal
      ? {
          id: 'student:ask-konling',
          role: 'student',
          label: '向 Konling 提问',
          description: '以当前图谱节点和目标作为提问上下文。',
          status: 'available',
          target: buildGraphCenterActionTarget('/assessment/adaptive-practice', {
            goal: adaptivePracticeGoal,
            graphNodeId: input.node.id,
            intent: 'contextual-recommendation',
          }),
        }
      : {
          id: 'student:ask-konling',
          role: 'student',
          label: '向 Konling 提问',
          description: '以当前图谱节点和目标作为提问上下文。',
          status: learningGoalId ? 'degraded' : 'disabled',
          reasonCode: 'missing-path-context',
          reason: learningGoalId
            ? '该节点尚未接入可进入的 Konling 图谱提问上下文。'
            : '该节点尚未绑定可进入的学习目标。',
        },
  ];
}

function buildTeacherGraphCenterActions(input: {
  node: KaqGraphNode;
  objectives: KaqObjective[];
  resourceCoverage: GraphCenterResourceCoverage;
  classOverlay: GraphCenterClassOverlay;
}): GraphCenterAction[] {
  const classId = input.classOverlay.classId;
  const classItem = input.classOverlay.items[input.node.id];
  const hasClassContext = Boolean(classId && classItem);
  const classRouteId = hasClassContext ? classId : null;
  const classOverlayUnauthorized = input.classOverlay.status === 'unauthorized';
  const missingClassReasonCode: GraphCenterActionReasonCode = classOverlayUnauthorized
    ? 'missing-authorization'
    : 'missing-overlay-context';
  const missingClassReason = classOverlayUnauthorized
    ? '当前用户无权读取该班级图谱 overlay。'
    : '班级 overlay 不可用，暂不能定位薄弱节点。';
  const resourceGapStatus: GraphCenterActionStatus = input.resourceCoverage.coverageState === 'sufficient'
    ? 'available'
    : 'degraded';
  const resourceGapKnowledgeRef = input.resourceCoverage.filterKnowledgeRefs[0] ?? input.node.id;
  const learningGoalId = input.objectives[0]?.id ?? input.node.objectiveIds[0] ?? null;
  const prepPackStatus: GraphCenterActionStatus = hasClassContext ? 'available' : classOverlayUnauthorized ? 'disabled' : 'degraded';

  return [
    classRouteId
      ? {
          id: 'teacher:diagnose-weak-node',
          role: 'teacher',
          label: '诊断薄弱节点',
          description: '打开班级诊断并保留当前图谱节点。',
          status: 'available',
          target: buildGraphCenterActionTarget('/teacher/classes/[classId]/analytics-v2', {
            classId: classRouteId,
            graphNodeId: input.node.id,
          }),
        }
      : {
          id: 'teacher:diagnose-weak-node',
          role: 'teacher',
          label: '诊断薄弱节点',
          description: '打开班级诊断并保留当前图谱节点。',
          status: classOverlayUnauthorized ? 'disabled' : 'degraded',
          reasonCode: missingClassReasonCode,
          reason: missingClassReason,
        },
    classRouteId
      ? {
          id: 'teacher:inspect-affected-population',
          role: 'teacher',
          label: '查看影响学生',
          description: '进入班级受影响学生视图。',
          status: 'degraded',
          reasonCode: 'missing-route-context',
          reason: '班级诊断入口当前只保留图谱节点提示，尚未按该节点过滤受影响学生。',
          target: buildGraphCenterActionTarget('/teacher/classes/[classId]/analytics-v2', {
            classId: classRouteId,
            graphNodeId: input.node.id,
            view: 'population',
          }),
        }
      : {
          id: 'teacher:inspect-affected-population',
          role: 'teacher',
          label: '查看影响学生',
          description: '查看当前节点关联的班级样本与受影响人群。',
          status: classOverlayUnauthorized ? 'disabled' : 'degraded',
          reasonCode: missingClassReasonCode,
          reason: classOverlayUnauthorized
            ? missingClassReason
            : '班级 overlay 不可用，暂不能查看影响学生。',
        },
    {
      id: 'teacher:inspect-resource-gap',
      role: 'teacher',
      label: '检查资源缺口',
      description: '查看资源绑定、引用与路径可用性的缺口。',
      status: resourceGapStatus,
      reasonCode: resourceGapStatus === 'degraded' ? 'missing-resource-context' : undefined,
      reason: resourceGapStatus === 'degraded' ? '该节点资源覆盖不足，需要教师补齐资源上下文。' : undefined,
      target: buildGraphCenterActionTarget('/teacher/resources/resource-nodes', {
        knowledge: resourceGapKnowledgeRef,
        pathEligibility: resourceGapStatus === 'degraded' ? 'excluded' : 'all',
      }),
    },
    {
      id: 'teacher:open-prep-pack',
      role: 'teacher',
      label: '生成备课包',
      description: '进入当前班级备课包入口，并保留图谱节点与资源缺口上下文。',
      status: prepPackStatus,
      reasonCode: prepPackStatus === 'available' ? undefined : missingClassReasonCode,
      reason: prepPackStatus === 'available'
        ? undefined
        : classOverlayUnauthorized
          ? missingClassReason
          : '缺少班级上下文，备课包只能进入通用复核入口。',
      target: hasClassContext
        ? buildGraphCenterActionTarget('/teacher/prep-packs', {
            classId: classRouteId ?? '',
            graphNodeId: input.node.id,
            ...(learningGoalId ? { learningGoalId } : {}),
            resourceGapStatus: input.resourceCoverage.coverageState,
          })
        : undefined,
    },
  ];
}

function buildAdminGraphCenterActions(input: {
  node: KaqGraphNode;
  resourceCoverage: GraphCenterResourceCoverage;
  learnerOverlay: GraphCenterLearnerOverlay;
  classOverlay: GraphCenterClassOverlay;
}): GraphCenterAction[] {
  const citationStatus: GraphCenterActionStatus = input.resourceCoverage.verifiedCitationCount > 0
    ? 'available'
    : 'degraded';
  const hasOverlayContext = input.learnerOverlay.status === 'available' || input.classOverlay.status === 'available';

  return [
    {
      id: 'admin:inspect-resource-binding',
      role: 'admin',
      label: '检查资源绑定',
      description: '检查当前节点的资源绑定与路径资格。',
      status: 'available',
      target: buildGraphCenterActionTarget('/admin/data-governance', {
        graphNodeId: input.node.id,
        audit: 'resource-binding',
      }),
    },
    {
      id: 'admin:inspect-citation-readiness',
      role: 'admin',
      label: '检查引用就绪',
      description: '检查 RAG 索引、可引用目标与已校验引用。',
      status: citationStatus,
      reasonCode: citationStatus === 'degraded' ? 'missing-citation-context' : undefined,
      reason: citationStatus === 'degraded' ? '该节点尚无已校验引用，需要治理引用上下文。' : undefined,
      target: buildGraphCenterActionTarget('/admin/data-governance', {
        graphNodeId: input.node.id,
        audit: 'citation-readiness',
      }),
    },
    {
      id: 'admin:inspect-overlay-limitations',
      role: 'admin',
      label: '检查 overlay 限制',
      description: '检查学习者、班级 overlay 的抑制、过期与权限限制。',
      status: hasOverlayContext ? 'available' : 'degraded',
      reasonCode: hasOverlayContext ? undefined : 'missing-overlay-context',
      reason: hasOverlayContext ? undefined : '缺少学习者或班级 overlay 上下文，只能查看图谱主体限制。',
      target: buildGraphCenterActionTarget('/admin/data-governance', {
        graphNodeId: input.node.id,
        audit: 'overlay-limitations',
      }),
    },
  ];
}

function normalizeGraphCenterActionRole(viewerRole: GraphCenterViewerRole): GraphCenterActionRole | null {
  if (viewerRole === 'STUDENT') return 'student';
  if (viewerRole === 'TEACHER') return 'teacher';
  if (viewerRole === 'ADMIN') return 'admin';
  return null;
}

function buildGraphCenterActionTarget(
  route: GraphCenterActionRoute,
  params: Record<string, string>,
): GraphCenterActionTarget {
  if (route === '/interactive-learning/resources/[id]') {
    const { resourceId, ...queryParams } = params;
    return {
      route,
      params,
      href: `${route.replace('[id]', encodeURIComponent(resourceId))}${formatGraphCenterActionQuery(queryParams)}`,
    };
  }
  if (route === '/teacher/classes/[classId]/analytics-v2') {
    const { classId, ...queryParams } = params;
    return {
      route,
      params,
      href: `${route.replace('[classId]', encodeURIComponent(classId))}${formatGraphCenterActionQuery(queryParams)}`,
    };
  }
  return {
    route,
    params,
    href: `${route}${formatGraphCenterActionQuery(params)}`,
  };
}

function formatGraphCenterActionQuery(params: Record<string, string>): string {
  const entries = Object.entries(params).filter(([, value]) => value.length > 0);
  if (entries.length === 0) return '';
  return `?${new URLSearchParams(entries).toString()}`;
}

function buildLimitations(
  nodes: KaqGraphNode[],
  resourceCoverage: Record<string, GraphCenterResourceCoverage>,
): GraphCenterLimitation[] {
  const limitations: GraphCenterLimitation[] = [];

  for (const node of nodes) {
    if (node.domain === 'knowledge') {
      const coverage = COVERAGE_BY_NODE_ID.get(node.id);
      if (coverage?.coverageState === 'partial' && coverage.limitation) {
        limitations.push({
          code: 'partial-seed-coverage',
          nodeId: node.id,
          message: coverage.limitation,
        });
      }
    }
    const resourceCoverageForNode = resourceCoverage[node.id];
    if (
      resourceCoverageForNode?.ragIndexedCount > 0 &&
      resourceCoverageForNode.verifiedCitationCount === 0
    ) {
      limitations.push({
        code: 'resource-coverage-indexed-without-verified-citation',
        nodeId: node.id,
        message: '该节点已有 RAG 索引材料，但尚无通过引用解析校验的可点击证据。',
      });
    }
  }

  return limitations;
}

export function canReadGraphCenterLearnerOverlay(input: {
  viewerRole: AdaptiveLearnerStateRole;
  viewerUserId: string | null | undefined;
  requestedLearnerId: string;
  teacherLearnerIds?: string[];
}): boolean {
  if (input.viewerRole === 'admin' || input.viewerRole === 'system') return true;
  if (input.viewerRole === 'student') return input.viewerUserId === input.requestedLearnerId;
  if (input.viewerRole === 'teacher') {
    return input.teacherLearnerIds?.includes(input.requestedLearnerId) ?? false;
  }
  return false;
}

export function canReadGraphCenterClassOverlay(input: {
  viewerRole: AdaptiveLearnerStateRole;
  requestedClassId: string;
  teacherClassIds?: string[];
}): boolean {
  if (input.viewerRole === 'admin' || input.viewerRole === 'system') return true;
  if (input.viewerRole === 'teacher') return input.teacherClassIds?.includes(input.requestedClassId) ?? false;
  return false;
}

function buildLearnerGraphOverlay(
  nodes: KaqGraphNode[],
  resourceCoverage: Record<string, GraphCenterResourceCoverage>,
  input?: GraphCenterLearnerOverlayInput,
): GraphCenterLearnerOverlay {
  if (!input) {
    return {
      status: 'unavailable',
      learnerId: null,
      classId: null,
      generatedAt: null,
      items: {},
      limitations: [{
        code: 'learner-overlay-unavailable',
        message: '学习者掌握度 overlay 尚未接入，本页仅展示图谱主体。',
      }],
    };
  }

  if (!input.authorized || (input.state && input.state.userId !== input.requestedLearnerId)) {
    return {
      status: 'unauthorized',
      learnerId: null,
      classId: null,
      generatedAt: null,
      items: {},
      limitations: [{
        code: 'learner-overlay-unauthorized',
        message: '当前用户无权读取该学习者图谱 overlay。',
      }],
    };
  }

  if (!input.state) {
    return {
      status: 'empty',
      learnerId: input.requestedLearnerId,
      classId: null,
      generatedAt: null,
      items: {},
      limitations: [{
        code: 'learner-overlay-empty',
        message: '当前学习者暂无可用于图谱 overlay 的服务端状态。',
      }],
    };
  }

  const state = input.state;
  const lockedNodeIds = new Set(input.lockedNodeIds ?? []);
  const items = Object.fromEntries(nodes.map((node) => {
    const item = buildLearnerOverlayItem(node, resourceCoverage[node.id], { ...input, state }, lockedNodeIds);
    return [node.id, item];
  }));
  const values = Object.values(items);
  const status: GraphCenterOverlayStatus = values.length === 0
    ? 'empty'
    : values.every((item) => item.confidence < 0.35 || item.state === 'evidence-needed')
      ? 'low-confidence'
      : 'available';
  const limitations: GraphCenterLimitation[] = [];
  if (status === 'empty') {
    limitations.push({
      code: 'learner-overlay-empty',
      message: '当前筛选条件下没有可展示的学习者图谱 overlay。',
    });
  }
  if (status === 'low-confidence') {
    limitations.push({
      code: 'learner-overlay-low-confidence',
      message: '当前学习者图谱 overlay 证据不足，仅可作为补证提示。',
    });
  }

  return {
    status,
    learnerId: input.requestedLearnerId,
    classId: state.roleScope.classId,
    generatedAt: state.generatedAt,
    items,
    limitations,
  };
}

function buildLearnerOverlayItem(
  node: KaqGraphNode,
  resourceCoverage: GraphCenterResourceCoverage,
  input: GraphCenterLearnerOverlayInput & { state: AdaptiveLearnerState },
  lockedNodeIds: Set<string>,
): GraphCenterLearnerOverlayItem {
  const traceability = findTraceabilityForNode(input.state, node);
  const tagMastery = findKnowledgeMasteryForNode(input.state, node);
  const rawEvidenceRefs = traceability?.supportingEvidenceRefs ?? tagMastery?.supportingEvidenceRefs ?? null;
  const evidenceRefs = visibleEvidenceRefs(rawEvidenceRefs ?? [], input.viewerRole);
  const evidenceFullyVisible = !rawEvidenceRefs || evidenceRefs.length === rawEvidenceRefs.length;
  const score = evidenceFullyVisible
    ? traceability ? traceability.masteryLevel : tagMastery?.posteriorMastery ?? null
    : null;
  const confidence = evidenceFullyVisible
    ? clamp01(traceability ? traceability.confidence : tagMastery?.confidence ?? 0)
    : 0;
  const evidenceCount = rawEvidenceRefs ? evidenceRefs.length : tagMastery?.evidenceCount ?? 0;
  const lastEvidenceAt = latestEvidenceAt(evidenceRefs) ?? (rawEvidenceRefs ? null : tagMastery?.lastUpdatedAt ?? null);
  const evidenceWindow = buildEvidenceWindow(input.evidenceWindow, traceability?.freshness, lastEvidenceAt);
  const sourceCoverage = evidenceFullyVisible ? traceability?.sourceCoverage ?? tagMastery?.sourceCoverage ?? null : null;
  const limitations = [
    ...(traceability?.limitations ?? []),
    ...(tagMastery?.limitations ?? []),
    ...(!evidenceFullyVisible ? ['hidden-evidence-redacted'] : []),
  ];
  const state = classifyLearnerOverlayState({
    locked: lockedNodeIds.has(node.id),
    score,
    confidence,
    evidenceCount,
    resourceCoverage,
  });
  const reasonCode = learnerReasonCode(state, resourceCoverage, confidence, evidenceCount, score);
  const verifiedCitationRefs = uniqueSorted(input.verifiedCitationRefs?.[node.id] ?? []);
  const recommendation = buildLearnerRecommendation({
    node,
    state,
    score,
    confidence,
    evidenceCount,
    reasonCode,
    evidenceWindow,
    sourceCoverage,
    resourceCoverage,
    verifiedCitationRefs,
    limitations,
    pathContext: input.state.pathContext.activeControlCorrectionPath,
  });

  return {
    domain: node.domain,
    nodeId: node.id,
    learnerId: input.requestedLearnerId,
    state,
    score,
    confidence,
    evidenceCount,
    lastEvidenceAt,
    evidenceRefs,
    reasonCode,
    evidenceWindow,
    sourceCoverage,
    verifiedCitationRefs,
    recommendation,
    limitations,
  };
}

function buildClassGraphOverlay(
  nodes: KaqGraphNode[],
  resourceCoverage: Record<string, GraphCenterResourceCoverage>,
  input?: GraphCenterClassOverlayInput,
): GraphCenterClassOverlay {
  if (!input) {
    return {
      status: 'unavailable',
      classId: null,
      items: {},
      limitations: [{
        code: 'class-overlay-unavailable',
        message: '班级热力 overlay 尚未接入，本页仅展示图谱主体。',
      }],
    };
  }

  if (!input.authorized) {
    return {
      status: 'unauthorized',
      classId: null,
      items: {},
      limitations: [{
        code: 'class-overlay-unauthorized',
        message: '当前用户无权读取该班级图谱 overlay。',
      }],
    };
  }

  const classScopedLearnerStates = input.learnerStates.filter((state) => state.roleScope.classId === input.classId);
  const scopeExcludedPopulation = input.learnerStates.length - classScopedLearnerStates.length;

  if (classScopedLearnerStates.length === 0) {
    return {
      status: 'empty',
      classId: input.classId,
      items: {},
      limitations: [{
        code: 'class-overlay-empty',
        message: '当前班级暂无可聚合的学习者状态。',
      }],
    };
  }

  const minimumDenominator = Math.max(input.minimumDenominator ?? 5, 5);
  const roundingIncrement = Math.max(1, input.roundingIncrement ?? 1);
  const scopedInput = {
    ...input,
    learnerStates: classScopedLearnerStates,
    excludedPopulation: (input.excludedPopulation ?? 0) + scopeExcludedPopulation,
  };
  const items = Object.fromEntries(nodes.map((node) => [
    node.id,
    buildClassOverlayItem(node, resourceCoverage[node.id], scopedInput, minimumDenominator, roundingIncrement),
  ]));
  const suppressedCount = Object.values(items).filter((item) => item.suppressionReason !== 'none').length;

  return {
    status: suppressedCount === Object.keys(items).length ? 'suppressed' : 'available',
    classId: input.classId,
    items,
    limitations: suppressedCount > 0
      ? [{
          code: 'class-overlay-suppressed',
          message: '部分班级图谱热力因样本量过低已抑制或仅保留分母元数据。',
        }]
      : [],
  };
}

function buildClassOverlayItem(
  node: KaqGraphNode,
  resourceCoverage: GraphCenterResourceCoverage,
  input: GraphCenterClassOverlayInput,
  minimumDenominator: number,
  roundingIncrement: number,
): GraphCenterClassOverlayItem {
  const denominator = input.learnerStates.length;
  const excludedPopulation = input.excludedPopulation ?? 0;
  if (denominator < minimumDenominator) {
    return {
      domain: node.domain,
      nodeId: node.id,
      classId: input.classId,
      distribution: emptyClassDistribution(),
      averageScore: null,
      confidence: 0,
      commonIssueCodes: [],
      denominator,
      includedPopulation: 0,
      excludedPopulation: denominator + excludedPopulation,
      suppressionReason: denominator === 0 ? 'empty-class' : 'low-denominator',
      roundingPolicy: { minimumDenominator, increment: roundingIncrement },
    };
  }

  const learnerItems = input.learnerStates.map((state) => buildLearnerOverlayItem(
    node,
    resourceCoverage,
    {
      state,
      requestedLearnerId: state.userId,
      viewerRole: input.viewerRole,
      authorized: true,
    },
    new Set(),
  ));
  const nodeVisibleSampleCount = learnerItems.filter((item) => item.evidenceCount > 0 || item.score !== null).length;
  if (nodeVisibleSampleCount < minimumDenominator) {
    return {
      domain: node.domain,
      nodeId: node.id,
      classId: input.classId,
      distribution: emptyClassDistribution(),
      averageScore: null,
      confidence: 0,
      commonIssueCodes: [],
      denominator,
      includedPopulation: nodeVisibleSampleCount,
      excludedPopulation: denominator - nodeVisibleSampleCount + excludedPopulation,
      suppressionReason: 'low-denominator',
      roundingPolicy: { minimumDenominator, increment: roundingIncrement },
    };
  }
  const distribution = learnerItems.reduce((acc, item) => {
    if (item.state !== 'locked') {
      acc[item.state] += 1;
    }
    return acc;
  }, emptyClassDistribution());
  const scoredItems = learnerItems.filter((item) => item.score !== null);
  const issueCodes = learnerItems
    .filter((item) => item.state === 'weak' || item.state === 'evidence-needed')
    .map((item) => item.reasonCode);

  return {
    domain: node.domain,
    nodeId: node.id,
    classId: input.classId,
    distribution: roundClassDistribution(distribution, roundingIncrement),
    averageScore: scoredItems.length >= minimumDenominator
      ? roundRatioBucket(scoredItems.reduce((sum, item) => sum + (item.score ?? 0), 0) / scoredItems.length)
      : null,
    confidence: roundRatioBucket(
      learnerItems.reduce((sum, item) => sum + item.confidence, 0) / Math.max(learnerItems.length, 1),
    ),
    commonIssueCodes: mostCommonIssueCodes(issueCodes),
    denominator,
    includedPopulation: learnerItems.filter((item) => item.state !== 'locked').length,
    excludedPopulation: learnerItems.filter((item) => item.state === 'locked').length + excludedPopulation,
    suppressionReason: 'none',
    roundingPolicy: { minimumDenominator, increment: roundingIncrement },
  };
}

function findTraceabilityForNode(
  state: AdaptiveLearnerState,
  node: KaqGraphNode,
): MasteryTraceabilityEntry | null {
  const refs = buildCoverageRefs(node);
  const capabilityTargetRefs = buildCapabilityTargetRefs(node);
  const targets = node.domain === 'capability'
    ? state.masteryTraceability?.capabilityTargets
    : state.masteryTraceability?.knowledgeTargets;
  if (!targets) return null;
  return [
    targets[node.id],
    ...refs.map((ref) => targets[ref]),
    ...capabilityTargetRefs.map((ref) => targets[ref]),
  ].find((entry): entry is MasteryTraceabilityEntry => Boolean(entry)) ?? null;
}

function findKnowledgeMasteryForNode(
  state: AdaptiveLearnerState,
  node: KaqGraphNode,
): AdaptiveLearnerState['knowledgeMastery']['tags'][string] | null {
  if (node.domain !== 'knowledge') return null;
  const refs = buildCoverageRefs(node);
  return [
    state.knowledgeMastery.tags[node.id],
    ...refs.map((ref) => state.knowledgeMastery.tags[ref]),
  ].find((entry): entry is AdaptiveLearnerState['knowledgeMastery']['tags'][string] => Boolean(entry)) ?? null;
}

function classifyLearnerOverlayState(input: {
  locked: boolean;
  score: number | null;
  confidence: number;
  evidenceCount: number;
  resourceCoverage: GraphCenterResourceCoverage;
}): GraphCenterLearnerOverlayState {
  if (input.locked) return 'locked';
  if (input.resourceCoverage.coverageState === 'missing' || input.resourceCoverage.coverageState === 'not-audited') {
    return 'evidence-needed';
  }
  if (input.score === null && input.evidenceCount === 0) return 'not-started';
  if (input.confidence < 0.35) return 'evidence-needed';
  if ((input.score ?? 0) >= 0.8 && input.confidence >= 0.6) return 'mastered';
  if ((input.score ?? 0) >= 0.55) return 'developing';
  return 'weak';
}

function learnerReasonCode(
  state: GraphCenterLearnerOverlayState,
  resourceCoverage: GraphCenterResourceCoverage,
  confidence: number,
  evidenceCount: number,
  score: number | null,
): GraphCenterLearnerOverlayReasonCode {
  if (state === 'locked') return 'locked-path';
  if (resourceCoverage.coverageState === 'missing' || resourceCoverage.coverageState === 'not-audited') {
    return 'resource-coverage-needed';
  }
  if (evidenceCount === 0 || score === null) return 'collect-evidence';
  if (confidence < 0.35) return 'confirm-with-evidence';
  if (state === 'mastered') return 'advance';
  return 'targeted-practice';
}

function buildLearnerRecommendation(input: {
  node: KaqGraphNode;
  state: GraphCenterLearnerOverlayState;
  score: number | null;
  confidence: number;
  evidenceCount: number;
  reasonCode: GraphCenterLearnerOverlayReasonCode;
  evidenceWindow: GraphCenterEvidenceWindow;
  sourceCoverage: MasteryTraceabilityEntry['sourceCoverage'] | null;
  resourceCoverage: GraphCenterResourceCoverage;
  verifiedCitationRefs: string[];
  limitations: string[];
  pathContext: AdaptiveLearnerState['pathContext']['activeControlCorrectionPath'];
}): GraphCenterLearnerRecommendation {
  return {
    label: recommendationLabel(input.reasonCode),
    reasonCode: input.reasonCode,
    rationale: {
      targetRequirement: `${input.node.title} 目标要求`,
      observedMastery: input.score === null
        ? `尚无掌握度分数，证据数 ${input.evidenceCount}`
        : `观察掌握度 ${Math.round(input.score * 100)}%，置信度 ${Math.round(input.confidence * 100)}%`,
      resourceCoverage: `${input.resourceCoverage.coverageState}: 关联 ${input.resourceCoverage.linkedResourceCount}，已校验引用 ${input.resourceCoverage.verifiedCitationCount}`,
      pathContext: input.pathContext.currentNodeId
        ? `路径当前节点 ${input.pathContext.currentNodeId}`
        : input.pathContext.state === 'none'
          ? '暂无活动学习路径'
          : '路径上下文不足',
    },
    sourceCoverage: input.sourceCoverage,
    evidenceWindow: input.evidenceWindow,
    confidence: input.confidence,
    verifiedCitationRefs: input.verifiedCitationRefs,
    limitations: input.limitations,
  };
}

function recommendationLabel(reasonCode: GraphCenterLearnerOverlayReasonCode): string {
  const labels: Record<GraphCenterLearnerOverlayReasonCode, string> = {
    advance: '进入下一目标',
    'targeted-practice': '进行针对练习',
    'confirm-with-evidence': '补充高置信证据',
    'collect-evidence': '先采集学习证据',
    'resource-coverage-needed': '补齐可用资源和引用证据',
    'locked-path': '等待路径解锁',
  };
  return labels[reasonCode];
}

function visibleEvidenceRefs(
  refs: MasteryEvidenceReference[],
  viewerRole: AdaptiveLearnerStateRole,
): GraphCenterLearnerEvidenceRef[] {
  return refs
    .filter((ref) => {
      if (ref.privacyLevel === 'student-visible') return true;
      if (ref.privacyLevel === 'teacher-scoped') return viewerRole === 'teacher' || viewerRole === 'admin' || viewerRole === 'system';
      return false;
    })
    .map((ref) => ({
      sourceType: ref.sourceType,
      sourceId: ref.sourceId,
      evidenceAt: ref.evidenceAt,
      confidence: ref.confidence,
      privacyLevel: ref.privacyLevel,
    }));
}

function latestEvidenceAt(refs: GraphCenterLearnerEvidenceRef[]): string | null {
  return refs
    .map((ref) => ref.evidenceAt)
    .filter((value): value is string => Boolean(value))
    .sort((a, b) => b.localeCompare(a))[0] ?? null;
}

function buildEvidenceWindow(
  input: Partial<GraphCenterEvidenceWindow> | undefined,
  freshness: MasteryTraceabilityEntry['freshness'] | undefined,
  lastEvidenceAt: string | null,
): GraphCenterEvidenceWindow {
  return {
    from: input?.from ?? null,
    to: input?.to ?? lastEvidenceAt,
    freshness: input?.freshness ?? freshness ?? (lastEvidenceAt ? 'partial' : 'missing'),
  };
}

function emptyClassDistribution(): GraphCenterClassOverlayDistribution {
  return {
    mastered: 0,
    developing: 0,
    weak: 0,
    'not-started': 0,
    'evidence-needed': 0,
  };
}

function roundClassDistribution(
  distribution: GraphCenterClassOverlayDistribution,
  increment: number,
): GraphCenterClassOverlayDistribution {
  if (increment <= 1) return distribution;

  const buckets = [
    'mastered',
    'developing',
    'weak',
    'not-started',
    'evidence-needed',
  ] as const;
  const rawTotal = buckets.reduce((sum, bucket) => sum + distribution[bucket], 0);
  const rounded: GraphCenterClassOverlayDistribution = {
    mastered: Math.floor(distribution.mastered / increment) * increment,
    developing: Math.floor(distribution.developing / increment) * increment,
    weak: Math.floor(distribution.weak / increment) * increment,
    'not-started': Math.floor(distribution['not-started'] / increment) * increment,
    'evidence-needed': Math.floor(distribution['evidence-needed'] / increment) * increment,
  };
  let roundedTotal = buckets.reduce((sum, bucket) => sum + rounded[bucket], 0);

  const candidates = buckets
    .map((bucket, index) => ({
      bucket,
      index,
      remainder: distribution[bucket] - rounded[bucket],
    }))
    .filter((candidate) => candidate.remainder > 0)
    .sort((left, right) => right.remainder - left.remainder || left.index - right.index);

  for (const candidate of candidates) {
    if (roundedTotal + increment > rawTotal) break;
    rounded[candidate.bucket] += increment;
    roundedTotal += increment;
  }

  return rounded;
}

function mostCommonIssueCodes(
  codes: GraphCenterLearnerOverlayReasonCode[],
): GraphCenterLearnerOverlayReasonCode[] {
  const counts = new Map<GraphCenterLearnerOverlayReasonCode, number>();
  for (const code of codes) {
    counts.set(code, (counts.get(code) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 3)
    .map(([code]) => code);
}

function clamp01(value: number): number {
  if (Number.isNaN(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

function roundRatioBucket(value: number): number {
  return Math.round(value * 10) / 10;
}

function buildBoundResourceRefs(node: KaqGraphNode): string[] {
  if (node.domain === 'knowledge') {
    const coverage = COVERAGE_BY_NODE_ID.get(node.id);
    return uniqueSorted([
      ...node.knowledgeRefs,
      ...(coverage?.runtimeKnowledgeRefs ?? []),
    ]);
  }

  const objectiveBindingRefs = node.objectiveIds.flatMap((objectiveId) => {
    const objective = OBJECTIVE_BY_ID.get(objectiveId);
    return objective?.graphBinding?.bindingRefs ?? [];
  });

  if (node.domain === 'capability') {
    return uniqueSorted([...node.knowledgeNodeIds, ...objectiveBindingRefs]);
  }

  return uniqueSorted(objectiveBindingRefs);
}

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b));
}

function uniqueBy<T>(values: T[], keyFor: (value: T) => string): T[] {
  const seen = new Set<string>();
  const result: T[] = [];
  for (const value of values) {
    const key = keyFor(value);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(value);
  }
  return result;
}

function nodeMatchesObjective(node: KaqGraphNode, objective: KaqObjective): boolean {
  if (node.domain !== objective.domain) return false;
  if (node.objectiveIds.includes(objective.id)) return true;
  const bindingRefs = objective.graphBinding?.bindingRefs ?? [];
  return bindingRefs.includes(node.id);
}

function buildResourceCoverageByNode(
  nodes: KaqGraphNode[],
  registry: ResourceNodeRegistry,
  evidenceCorpus: LearningEvidenceCorpusChunk[],
  options: ResourceCoverageBuildOptions,
): Record<string, GraphCenterResourceCoverage> {
  return Object.fromEntries(
    nodes.map((node) => [
      node.id,
      buildResourceCoverage(node, registry.nodes, evidenceCorpus, options),
    ]),
  );
}

function buildResourceCoverage(
  node: KaqGraphNode,
  resourceNodes: ResourceNode[],
  evidenceCorpus: LearningEvidenceCorpusChunk[],
  options: ResourceCoverageBuildOptions,
): GraphCenterResourceCoverage {
  const coverageRefs = buildCoverageRefs(node);
  if (coverageRefs.length === 0) {
    return emptyResourceCoverage(node, 'not-audited', [], options);
  }

  const coverageRefSet = new Set(coverageRefs);
  const linkedResources = resourceNodes.filter((resource) => resourceMatchesGraphCoverageRefs(resource, coverageRefSet));
  const pathEligibleResources = linkedResources.filter((resource) => resource.eligibility.pathEligible);
  const indexedChunks = evidenceCorpus.filter((chunk) => chunkMatchesGraphCoverageRefs(chunk, coverageRefSet, linkedResources));
  const citationReadyChunks = indexedChunks.filter(isCitationReadyChunk);
  const verifiedCitationChunks = citationReadyChunks.filter((chunk) => isVerifiedCitationChunk(chunk, evidenceCorpus));
  const missingCoverageTypes = buildMissingCoverageTypes({
    linkedResources,
    pathEligibleResources,
    indexedChunks,
    citationReadyChunks,
    verifiedCitationChunks,
  });
  const linkedResourceIds = uniqueSorted(linkedResources.map((resource) => resource.id));
  const pathEligibleResourceIds = uniqueSorted(pathEligibleResources.map((resource) => resource.id));
  const pathEligibleResourceRouteIds = uniqueSorted(pathEligibleResources.flatMap((resource) => {
    const routeId = resourceRouteIdForInteractiveResource(resource);
    return routeId ? [routeId] : [];
  }));
  const filterKnowledgeRefs = uniqueSorted(linkedResources.flatMap((resource) =>
    resource.planningMetadata.knowledgeCoverage.filter((ref) => coverageRefSet.has(ref))
  ));
  const fieldCompletion = options.exposeFieldCompletion
    ? summarizeFieldCompletionForGraphCoverage(
      coverageRefSet,
      linkedResources,
      options.resourceFieldCompletionSummary,
    )
    : undefined;

  return {
    domain: node.domain,
    nodeId: node.id,
    linkedResourceCount: linkedResources.length,
    pathEligibleResourceCount: pathEligibleResources.length,
    ragIndexedCount: indexedChunks.length,
    citationReadyCount: citationReadyChunks.length,
    verifiedCitationCount: verifiedCitationChunks.length,
    assessmentResourceCount: linkedResources.filter(isAssessmentResource).length,
    simulationResourceCount: linkedResources.filter(isSimulationResource).length,
    arenaPreviewResourceCount: linkedResources.filter((resource) => isArenaResource(resource) && !isArenaOfficialResource(resource)).length,
    arenaOfficialResourceCount: linkedResources.filter(isArenaOfficialResource).length,
    terminalValidationCapableResourceCount: linkedResources.filter(isTerminalValidationCapableResource).length,
    coverageState: classifyResourceCoverage(missingCoverageTypes, linkedResources),
    missingCoverageTypes,
    linkedResourceIds,
    pathEligibleResourceIds,
    pathEligibleResourceRouteIds,
    filterKnowledgeRefs,
    ...(fieldCompletion ? { fieldCompletion } : {}),
  };
}

function emptyResourceCoverage(
  node: KaqGraphNode,
  coverageState: GraphCenterResourceCoverageState,
  missingCoverageTypes: GraphCenterResourceCoverageMissingType[],
  options: ResourceCoverageBuildOptions,
): GraphCenterResourceCoverage {
  return {
    domain: node.domain,
    nodeId: node.id,
    linkedResourceCount: 0,
    pathEligibleResourceCount: 0,
    ragIndexedCount: 0,
    citationReadyCount: 0,
    verifiedCitationCount: 0,
    assessmentResourceCount: 0,
    simulationResourceCount: 0,
    arenaPreviewResourceCount: 0,
    arenaOfficialResourceCount: 0,
    terminalValidationCapableResourceCount: 0,
    coverageState,
    missingCoverageTypes,
    linkedResourceIds: [],
    pathEligibleResourceIds: [],
    pathEligibleResourceRouteIds: [],
    filterKnowledgeRefs: [],
    ...(options.exposeFieldCompletion ? { fieldCompletion: summarizeResourceFieldCompletionForCoverage([]) } : {}),
  };
}

function resourceRouteIdForInteractiveResource(resource: ResourceNode): string | null {
  if (resource.sourceKind === 'resource_registry' || resource.sourceKind === 'teaching_resource') {
    return resource.sourceRef;
  }
  return null;
}

interface ResourceCoverageBuildOptions {
  exposeFieldCompletion: boolean;
  resourceFieldCompletionSummary?: ResourceFieldCompletionGraphSummary;
}

function summarizeFieldCompletionForGraphCoverage(
  coverageRefs: Set<string>,
  linkedResources: ResourceNode[],
  auditSummary?: ResourceFieldCompletionGraphSummary,
): ResourceFieldCompletionCoverageSummary {
  const auditSummaries = auditSummary
    ? Object.entries(auditSummary.graphCoverageDiagnostics)
      .filter(([denominatorKey]) => denominatorKeyMatchesCoverageRefs(denominatorKey, coverageRefs))
      .map(([, summary]) => summary)
    : [];
  const dynamicTeachingResources = auditSummaries.length > 0
    ? linkedResources.filter((resource) => resource.sourceRefs.some((ref) => ref.kind === 'teaching_resource'))
    : linkedResources;
  const dynamicSummary = dynamicTeachingResources.length > 0
    ? [summarizeResourceFieldCompletionForCoverage(dynamicTeachingResources)]
    : [];
  const summaries = [...auditSummaries, ...dynamicSummary];
  if (summaries.length > 0) {
    return summarizeResourceFieldCompletionCoverageSummaries(summaries);
  }

  return summarizeResourceFieldCompletionForCoverage([]);
}

function denominatorKeyMatchesCoverageRefs(denominatorKey: string, coverageRefs: Set<string>): boolean {
  return denominatorKey.split('|').some((ref) => coverageRefs.has(ref));
}

function buildCoverageRefs(node: KaqGraphNode): string[] {
  if (node.domain === 'knowledge') {
    const runtimeCoverage = COVERAGE_BY_NODE_ID.get(node.id);
    return uniqueSorted([
      node.id,
      ...node.objectiveIds,
      ...node.knowledgeRefs,
      ...(runtimeCoverage?.runtimeKnowledgeRefs ?? []),
    ]);
  }

  if (node.domain === 'capability') {
    return uniqueSorted([
      node.id,
      ...node.objectiveIds,
      ...node.knowledgeNodeIds,
      ...node.knowledgeNodeIds.flatMap((knowledgeNodeId) => buildBoundResourceRefs(
        AUTOCONTROL_KAQ_GRAPH_CATALOG.nodes.find((candidate) => candidate.id === knowledgeNodeId) ?? node,
      )),
      ...node.observableEvidenceTypes,
      ...node.evaluationMethods,
      ...buildCapabilityTargetRefs(node),
    ]);
  }

  return [];
}

function buildCapabilityTargetRefs(node: KaqGraphNode): string[] {
  if (node.domain !== 'capability') return [];
  const explicitRefs = CONTROL_CORRECTION_CAPABILITY_TARGET_REFS_BY_NODE_ID[node.id] ?? [];
  const registeredRefs = CONTROL_CORRECTION_CAPABILITY_TARGETS
    .filter((target) => explicitRefs.includes(target.id) || explicitRefs.includes(target.knowledgeNodeRef))
    .flatMap((target) => [target.id, target.knowledgeNodeRef]);
  return uniqueSorted([...explicitRefs, ...registeredRefs]);
}

function isCitationReadyChunk(chunk: LearningEvidenceCorpusChunk): boolean {
  return Boolean(chunk.citationAddress || chunk.resourceProjection?.citationTargetRef);
}

function isVerifiedCitationChunk(
  chunk: LearningEvidenceCorpusChunk,
  evidenceCorpus: LearningEvidenceCorpusChunk[],
): boolean {
  const verification = verifyLearningEvidenceCitations(
    evidenceCorpus,
    {
      role: 'teacher',
      useCase: 'konling',
    },
    [{
      chunkId: chunk.id,
      sourceType: chunk.sourceType,
      useCase: 'konling',
      addressKind: chunk.citationAddress?.kind,
    }],
    {
      minimumAuthority: 'contextual',
      exposePrivacyRedaction: true,
    },
  );
  return verification.status === 'verified' && verification.verifiedRefs.some((ref) => ref.chunkId === chunk.id);
}

function buildMissingCoverageTypes(input: {
  linkedResources: ResourceNode[];
  pathEligibleResources: ResourceNode[];
  indexedChunks: LearningEvidenceCorpusChunk[];
  citationReadyChunks: LearningEvidenceCorpusChunk[];
  verifiedCitationChunks: LearningEvidenceCorpusChunk[];
}): GraphCenterResourceCoverageMissingType[] {
  const missing: GraphCenterResourceCoverageMissingType[] = [];
  if (input.linkedResources.length === 0) missing.push('linked-resource');
  if (input.pathEligibleResources.length === 0) missing.push('path-eligible-resource');
  if (input.indexedChunks.length === 0) missing.push('rag-indexed-resource');
  if (input.citationReadyChunks.length === 0) missing.push('citation-ready-resource');
  if (input.verifiedCitationChunks.length === 0) missing.push('verified-citation-resource');
  if (!input.linkedResources.some(isAssessmentResource)) missing.push('assessment-resource');
  if (!input.linkedResources.some(isSimulationResource)) missing.push('simulation-resource');
  if (!input.linkedResources.some((resource) => isArenaResource(resource) && !isArenaOfficialResource(resource))) {
    missing.push('arena-preview-resource');
  }
  if (!input.linkedResources.some(isArenaOfficialResource)) missing.push('arena-official-resource');
  if (!input.linkedResources.some(isTerminalValidationCapableResource)) {
    missing.push('terminal-validation-capable-resource');
  }
  return missing;
}

function classifyResourceCoverage(
  missingCoverageTypes: GraphCenterResourceCoverageMissingType[],
  linkedResources: ResourceNode[],
): GraphCenterResourceCoverageState {
  if (linkedResources.length === 0) return 'missing';
  return missingCoverageTypes.length === 0 ? 'sufficient' : 'partial';
}

function isAssessmentResource(resource: ResourceNode): boolean {
  return resource.type === 'quiz' ||
    resource.type === 'adaptive_quiz' ||
    resource.type === 'checkpoint' ||
    resource.pathSemantics.evidenceBehavior === 'assessment' ||
    resource.planningMetadata.evidenceInstrumentation.some((signal) => (
      signal.includes('assessment') || signal.includes('quiz') || signal.includes('rubric')
    ));
}

function isSimulationResource(resource: ResourceNode): boolean {
  if (isArenaResource(resource)) return false;
  return resource.type === 'simulation' ||
    resource.type === 'control_workbench' ||
    resource.pathSemantics.evidenceBehavior === 'simulation_run' ||
    resource.pathSemantics.evidenceBehavior === 'simulation_trace' ||
    resource.planningMetadata.evidenceInstrumentation.some((signal) => signal.includes('simulation'));
}

function isArenaResource(resource: ResourceNode): boolean {
  return resource.type === 'arena_task' || resource.sourceKind === 'arena_task';
}

function isArenaOfficialResource(resource: ResourceNode): boolean {
  return isArenaResource(resource) &&
    resource.planningMetadata.evidenceInstrumentation.some((signal) => (
      signal.includes('arena_evaluation_complete') || signal.includes('arena_submission_valid')
    ));
}

function isTerminalValidationCapableResource(resource: ResourceNode): boolean {
  return resource.planningMetadata.terminalConstraints.includes('terminal-validation');
}
