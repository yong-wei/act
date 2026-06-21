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
  PORTRAIT_V2_DIMENSIONS,
  type KaqObjective,
  type KaqObjectiveDomain,
  type PortraitV2DimensionId,
} from './kaq-objective-taxonomy';
import type { KaqGraphEdge, KaqGraphNode } from './kaq-graph-schema';
import { getAllRegisteredResourceMetadata } from '../resource-registry-metadata';
import { buildResourceNodeRegistry, type ResourceNode, type ResourceNodeRegistry } from '../resource-node-registry';

export type GraphCenterDomain = KaqObjectiveDomain;
export type GraphCenterOverlayStatus = 'available' | 'unavailable';
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
  | 'resource-coverage-indexed-without-verified-citation';

export interface GraphCenterPayloadInput {
  domain?: GraphCenterDomain;
  objectiveId?: string | null;
  portraitDimension?: PortraitV2DimensionId | null;
  selectedNodeId?: string | null;
  resourceRegistry?: ResourceNodeRegistry;
  evidenceCorpus?: LearningEvidenceCorpusChunk[];
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
}

export interface GraphCenterSelectedNodeDetail {
  node: KaqGraphNode;
  objectives: KaqObjective[];
  incomingEdges: KaqGraphEdge[];
  outgoingEdges: KaqGraphEdge[];
  boundResourceRefs: string[];
  resourceCoverage: GraphCenterResourceCoverage;
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
  const resourceCoverage = buildResourceCoverageByNode(filteredNodes, resourceRegistry, evidenceCorpus);
  const limitations = buildLimitations(filteredNodes, resourceCoverage);
  const nodeDetails = buildNodeDetails(filteredNodes, filteredEdges, resourceCoverage, limitations);

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
    nodeDetails,
    selectedNode: selectedNode ? nodeDetails[selectedNode.id] : null,
    limitations,
    overlays: {
      learner: 'unavailable',
      class: 'unavailable',
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
  limitations: GraphCenterLimitation[],
): Record<string, GraphCenterSelectedNodeDetail> {
  return Object.fromEntries(nodes.map((node) => [
    node.id,
    {
      node,
      objectives: node.objectiveIds
        .map((id) => OBJECTIVE_BY_ID.get(id))
        .filter((objective): objective is KaqObjective => Boolean(objective)),
      incomingEdges: edges.filter((edge) => edge.targetNodeId === node.id),
      outgoingEdges: edges.filter((edge) => edge.sourceNodeId === node.id),
      boundResourceRefs: buildBoundResourceRefs(node),
      resourceCoverage: resourceCoverage[node.id],
      limitations: limitations.filter((limitation) => limitation.nodeId === node.id),
    },
  ]));
}

function buildLimitations(
  nodes: KaqGraphNode[],
  resourceCoverage: Record<string, GraphCenterResourceCoverage>,
): GraphCenterLimitation[] {
  const limitations: GraphCenterLimitation[] = [
    {
      code: 'learner-overlay-unavailable',
      message: '学习者掌握度 overlay 尚未接入，本页仅展示图谱主体。',
    },
    {
      code: 'class-overlay-unavailable',
      message: '班级热力 overlay 尚未接入，本页仅展示图谱主体。',
    },
  ];

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
): Record<string, GraphCenterResourceCoverage> {
  return Object.fromEntries(
    nodes.map((node) => [
      node.id,
      buildResourceCoverage(node, registry.nodes, evidenceCorpus),
    ]),
  );
}

function buildResourceCoverage(
  node: KaqGraphNode,
  resourceNodes: ResourceNode[],
  evidenceCorpus: LearningEvidenceCorpusChunk[],
): GraphCenterResourceCoverage {
  const coverageRefs = buildCoverageRefs(node);
  if (coverageRefs.length === 0) {
    return emptyResourceCoverage(node, 'not-audited', []);
  }

  const coverageRefSet = new Set(coverageRefs);
  const linkedResources = resourceNodes.filter((resource) => resourceMatchesRefs(resource, coverageRefSet));
  const pathEligibleResources = linkedResources.filter((resource) => resource.eligibility.pathEligible);
  const indexedChunks = evidenceCorpus.filter((chunk) => chunkMatchesRefs(chunk, coverageRefSet, linkedResources));
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
  };
}

function emptyResourceCoverage(
  node: KaqGraphNode,
  coverageState: GraphCenterResourceCoverageState,
  missingCoverageTypes: GraphCenterResourceCoverageMissingType[],
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
  };
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
    ]);
  }

  return [];
}

function resourceMatchesRefs(resource: ResourceNode, refs: Set<string>): boolean {
  return [
    resource.id,
    resource.sourceRef,
    ...resource.sourceRefs.map((ref) => ref.ref),
    ...resource.planningMetadata.knowledgeCoverage,
    ...Object.keys(resource.planningMetadata.abilityImpact),
    ...resource.planningMetadata.evidenceInstrumentation,
  ].some((ref) => refs.has(ref));
}

function chunkMatchesRefs(
  chunk: LearningEvidenceCorpusChunk,
  refs: Set<string>,
  linkedResources: ResourceNode[],
): boolean {
  const projectionRefs = [
    ...(chunk.resourceProjection?.knowledgeNodeRefs ?? []),
    ...(chunk.resourceProjection?.capabilityTargetRefs ?? []),
    ...chunk.retrieval.tags,
    ...chunk.retrieval.goals,
  ];
  if (chunk.resourceProjection) {
    return projectionRefs.some((ref) => refs.has(ref));
  }

  const linkedResourceIds = new Set(linkedResources.flatMap((resource) => [
    resource.id,
    `resource:${resource.id}`,
    resource.sourceRef,
  ]));
  return [
    chunk.id,
    chunk.sourceRef.id,
    chunk.sourceRef.resourceId ?? '',
  ].some((ref) => refs.has(ref) || linkedResourceIds.has(ref));
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
