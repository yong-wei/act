import {
  AUTOCONTROL_KAQ_GRAPH_CATALOG,
  AUTOCONTROL_KAQ_OBJECTIVE_CATALOG,
  AUTOCONTROL_KAQ_RUNTIME_KNOWLEDGE_COVERAGE,
  validateAutocontrolKaqGraphCatalog,
} from './autocontrol-kaq-graph-catalog';
import {
  PORTRAIT_V2_DIMENSIONS,
  type KaqObjective,
  type KaqObjectiveDomain,
  type PortraitV2DimensionId,
} from './kaq-objective-taxonomy';
import type { KaqGraphEdge, KaqGraphNode } from './kaq-graph-schema';

export type GraphCenterDomain = KaqObjectiveDomain;
export type GraphCenterOverlayStatus = 'unavailable';
export type GraphCenterLimitationCode =
  | 'partial-seed-coverage'
  | 'learner-overlay-unavailable'
  | 'class-overlay-unavailable'
  | 'resource-coverage-overlay-unavailable';

export interface GraphCenterPayloadInput {
  domain?: GraphCenterDomain;
  objectiveId?: string | null;
  portraitDimension?: PortraitV2DimensionId | null;
  selectedNodeId?: string | null;
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

export interface GraphCenterSelectedNodeDetail {
  node: KaqGraphNode;
  objectives: KaqObjective[];
  incomingEdges: KaqGraphEdge[];
  outgoingEdges: KaqGraphEdge[];
  boundResourceRefs: string[];
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

export function buildGraphCenterPayload(input: GraphCenterPayloadInput = {}): GraphCenterPayload {
  const activeDomain = resolveDomain(input.domain);
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
  const limitations = buildLimitations(filteredNodes);

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
    selectedNode: selectedNode
      ? {
          node: selectedNode,
          objectives: selectedNode.objectiveIds
            .map((id) => OBJECTIVE_BY_ID.get(id))
            .filter((objective): objective is KaqObjective => Boolean(objective)),
          incomingEdges: filteredEdges.filter((edge) => edge.targetNodeId === selectedNode.id),
          outgoingEdges: filteredEdges.filter((edge) => edge.sourceNodeId === selectedNode.id),
          boundResourceRefs: buildBoundResourceRefs(selectedNode),
          limitations: limitations.filter((limitation) => limitation.nodeId === selectedNode.id),
        }
      : null,
    limitations,
    overlays: {
      learner: 'unavailable',
      class: 'unavailable',
      resourceCoverage: 'unavailable',
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
    .map((objective) => ({
      id: objective.id,
      title: objective.title,
      level: objective.level,
      parentId: objective.parentId,
      nodeCount: nodes.filter((node) => nodeMatchesObjective(node, objective)).length,
    }));
}

function buildPortraitDimensionOptions(nodes: KaqGraphNode[]): GraphCenterPortraitDimensionOption[] {
  return PORTRAIT_V2_DIMENSIONS.map((dimension) => ({
    ...dimension,
    nodeCount: nodes.filter((node) => node.portraitDimensions.includes(dimension.id)).length,
  })).filter((dimension) => dimension.nodeCount > 0);
}

function buildLimitations(nodes: KaqGraphNode[]): GraphCenterLimitation[] {
  const limitations: GraphCenterLimitation[] = [
    {
      code: 'learner-overlay-unavailable',
      message: '学习者掌握度 overlay 尚未接入，本页仅展示图谱主体。',
    },
    {
      code: 'class-overlay-unavailable',
      message: '班级热力 overlay 尚未接入，本页仅展示图谱主体。',
    },
    {
      code: 'resource-coverage-overlay-unavailable',
      message: '资源覆盖 overlay 尚未接入，本页仅展示图谱主体。',
    },
  ];

  for (const node of nodes) {
    if (node.domain !== 'knowledge') continue;
    const coverage = COVERAGE_BY_NODE_ID.get(node.id);
    if (coverage?.coverageState === 'partial' && coverage.limitation) {
      limitations.push({
        code: 'partial-seed-coverage',
        nodeId: node.id,
        message: coverage.limitation,
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
