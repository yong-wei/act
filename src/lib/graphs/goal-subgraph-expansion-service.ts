import {
  AUTOCONTROL_KAQ_GRAPH_CATALOG,
  AUTOCONTROL_KAQ_GRAPH_VERSION,
} from '../data-governance/autocontrol-kaq-graph-catalog';
import {
  buildKaqArtifactVersionRefs,
  GRAPH_CENTER_OVERLAY_VERSION,
  KONLING_GRAPH_GROUNDING_VERSION,
  type KaqArtifactVersionRefs,
} from '../kaq-artifact-versioning';
import type {
  KaqGraphCatalog,
  KaqGraphDomain,
  KaqGraphEdge,
  KaqGraphEdgeStrength,
  KaqGraphNode,
  KaqGraphRelation,
} from '../data-governance/kaq-graph-schema';
import {
  getLearningGoal,
  type AdaptiveLearningPathEvidenceType,
  type LearningGoalDefinition,
} from '../adaptive-learning-path-planner';

export const GOAL_SUBGRAPH_EXPANSION_VERSION = 'goal-subgraph-expansion.v1';

export type GoalSubgraphExpansionStatus = 'expanded' | 'degraded' | 'rejected';
export type GoalSubgraphPrerequisitePolicySemantics =
  | 'hard_prerequisite'
  | 'soft_prerequisite'
  | 'co_requisite'
  | 'remediation'
  | 'extension'
  | 'transfer_to'
  | 'evidence_for';

export interface GoalSubgraphLimitation {
  code:
    | 'missing-learning-goal'
    | 'missing-graph-node'
    | 'inactive-graph-node'
  | 'weak-relation-evidence'
  | 'unsupported-relation'
  | 'outgoing-relation-not-prerequisite'
  | 'learning-goal-limitation'
  | 'quality-evidence-limitation';
  graphNodeId?: string | null;
  edgeId?: string | null;
  severity: 'blocking' | 'warning';
  message: string;
}

export interface GoalSubgraphPolicyEntry {
  edgeId: string;
  sourceNodeId: string;
  targetNodeId: string;
  domain: KaqGraphDomain;
  relation: KaqGraphRelation;
  strength: KaqGraphEdgeStrength;
  semantics: GoalSubgraphPrerequisitePolicySemantics;
  direction: 'incoming' | 'outgoing' | 'internal';
  required: boolean;
  rationale: string;
}

export interface GoalSubgraphCheckpointSuggestion {
  id: string;
  graphNodeId: string;
  evidenceTypes: AdaptiveLearningPathEvidenceType[];
  reason: string;
}

export interface GoalSubgraphTerminalValidationCandidate {
  id: string;
  graphNodeId: string;
  acceptedEvidenceTypes: AdaptiveLearningPathEvidenceType[];
  required: boolean;
  summary: string;
}

export interface GoalSubgraphPlannerFixture {
  learningGoalId: string;
  graphVersion: string;
  targetGraphNodeIds: string[];
  prerequisitePolicy: GoalSubgraphPolicyEntry[];
  terminalValidationCandidates: GoalSubgraphTerminalValidationCandidate[];
  checkpointSuggestions: GoalSubgraphCheckpointSuggestion[];
  limitationCodes: GoalSubgraphLimitation['code'][];
}

export interface GoalSubgraphKonlingContextFixture {
  learningGoalId: string;
  graphVersion: string;
  versionRefs: KaqArtifactVersionRefs;
  groundingNodeIds: string[];
  prerequisitePolicySummaries: string[];
  limitations: GoalSubgraphLimitation[];
}

export interface GoalSubgraphGraphCenterDrillDownPayload {
  learningGoalId: string;
  graphVersion: string;
  versionRefs: KaqArtifactVersionRefs;
  domains: Array<{
    domain: KaqGraphDomain;
    nodeIds: string[];
  }>;
  relationIds: string[];
  actionable: false;
}

export interface ExpandedGoalSubgraph {
  expansionVersion: typeof GOAL_SUBGRAPH_EXPANSION_VERSION;
  status: GoalSubgraphExpansionStatus;
  learningGoalId: string;
  learningGoalVersion: string;
  graphVersion: string;
  graphNodeIds: Record<KaqGraphDomain, string[]>;
  requiredEdges: GoalSubgraphPolicyEntry[];
  recommendedEdges: GoalSubgraphPolicyEntry[];
  prerequisitePolicy: GoalSubgraphPolicyEntry[];
  remediationCandidates: string[];
  extensionCandidates: string[];
  transferCandidates: string[];
  terminalValidationCandidates: GoalSubgraphTerminalValidationCandidate[];
  checkpointSuggestions: GoalSubgraphCheckpointSuggestion[];
  limitations: GoalSubgraphLimitation[];
  fixtures: {
    planner: GoalSubgraphPlannerFixture;
    konling: GoalSubgraphKonlingContextFixture;
    graphCenter: GoalSubgraphGraphCenterDrillDownPayload;
  };
}

export interface GoalSubgraphExpansionOptions {
  catalog?: KaqGraphCatalog;
  graphVersion?: string;
}

export function expandLearningGoalSubgraph(
  learningGoalId: string,
  options: GoalSubgraphExpansionOptions = {},
): ExpandedGoalSubgraph {
  const learningGoal = getLearningGoal(learningGoalId);
  if (!learningGoal) {
    return buildRejectedExpansion(learningGoalId, options, [{
      code: 'missing-learning-goal',
      severity: 'blocking',
      message: `LearningGoal not found: ${learningGoalId}.`,
    }]);
  }
  return expandLearningGoalDefinitionSubgraph(learningGoal, options);
}

export function expandLearningGoalDefinitionSubgraph(
  learningGoal: LearningGoalDefinition,
  options: GoalSubgraphExpansionOptions = {},
): ExpandedGoalSubgraph {
  const catalog = options.catalog ?? AUTOCONTROL_KAQ_GRAPH_CATALOG;
  const graphVersion = options.graphVersion ?? AUTOCONTROL_KAQ_GRAPH_VERSION;
  const nodesById = new Map(catalog.nodes.map((node) => [node.id, node]));
  const limitations = buildLearningGoalLimitations(learningGoal);
  const targetNodes: KaqGraphNode[] = [];

  for (const nodeId of uniqueSorted(learningGoal.targetGraphNodeIds)) {
    const node = nodesById.get(nodeId);
    if (!node) {
      limitations.push({
        code: 'missing-graph-node',
        graphNodeId: nodeId,
        severity: learningGoal.status === 'path-ready' || learningGoal.status === 'fully-governed' ? 'blocking' : 'warning',
        message: `LearningGoal references missing graph node: ${nodeId}.`,
      });
      continue;
    }
    if (node.status !== 'active') {
      limitations.push({
        code: 'inactive-graph-node',
        graphNodeId: nodeId,
        severity: learningGoal.status === 'fully-governed' ? 'blocking' : 'warning',
        message: `LearningGoal references inactive graph node: ${nodeId}.`,
      });
    }
    targetNodes.push(node);
  }

  const targetNodeIds = new Set(targetNodes.map((node) => node.id));
  const policy = catalog.edges
    .filter((edge) => targetNodeIds.has(edge.sourceNodeId) || targetNodeIds.has(edge.targetNodeId))
    .map((edge) => mapEdgeToPolicy(edge, targetNodeIds, limitations))
    .filter((entry): entry is GoalSubgraphPolicyEntry => Boolean(entry))
    .sort((left, right) => left.edgeId.localeCompare(right.edgeId));
  const requiredEdges = policy.filter((entry) => entry.required);
  const recommendedEdges = policy.filter((entry) => !entry.required);
  const status: GoalSubgraphExpansionStatus = limitations.some((item) => item.severity === 'blocking')
    ? 'rejected'
    : limitations.length > 0
      ? 'degraded'
      : 'expanded';
  const graphNodeIds = groupNodeIdsByDomain(targetNodes);
  const terminalValidationCandidates = buildTerminalValidationCandidates(learningGoal, targetNodes);
  const checkpointSuggestions = buildCheckpointSuggestions(learningGoal, targetNodes);
  const expansion: Omit<ExpandedGoalSubgraph, 'fixtures'> = {
    expansionVersion: GOAL_SUBGRAPH_EXPANSION_VERSION,
    status,
    learningGoalId: learningGoal.id,
    learningGoalVersion: learningGoal.version,
    graphVersion,
    graphNodeIds,
    requiredEdges,
    recommendedEdges,
    prerequisitePolicy: policy,
    remediationCandidates: uniqueSorted(policy
      .filter((entry) => entry.semantics === 'hard_prerequisite' || entry.semantics === 'soft_prerequisite')
      .map(prerequisiteCandidateNodeId)
      .filter((nodeId) => !targetNodeIds.has(nodeId))),
    extensionCandidates: uniqueSorted(policy
      .filter((entry) => entry.semantics === 'extension')
      .map((entry) => entry.targetNodeId)),
    transferCandidates: uniqueSorted(policy
      .filter((entry) => entry.semantics === 'transfer_to')
      .map((entry) => entry.targetNodeId)),
    terminalValidationCandidates,
    checkpointSuggestions,
    limitations,
  };

  return {
    ...expansion,
    fixtures: buildFixtures(expansion, targetNodes),
  };
}

export function expandLearningGoalPackageSubgraph(
  learningGoal: LearningGoalDefinition,
  options: GoalSubgraphExpansionOptions = {},
): ExpandedGoalSubgraph {
  return expandLearningGoalSubgraph(learningGoal.id, options);
}

function buildRejectedExpansion(
  learningGoalId: string,
  options: GoalSubgraphExpansionOptions,
  limitations: GoalSubgraphLimitation[],
): ExpandedGoalSubgraph {
  const graphVersion = options.graphVersion ?? AUTOCONTROL_KAQ_GRAPH_VERSION;
  const expansion: Omit<ExpandedGoalSubgraph, 'fixtures'> = {
    expansionVersion: GOAL_SUBGRAPH_EXPANSION_VERSION,
    status: 'rejected',
    learningGoalId,
    learningGoalVersion: 'unknown',
    graphVersion,
    graphNodeIds: { knowledge: [], capability: [], quality: [] },
    requiredEdges: [],
    recommendedEdges: [],
    prerequisitePolicy: [],
    remediationCandidates: [],
    extensionCandidates: [],
    transferCandidates: [],
    terminalValidationCandidates: [],
    checkpointSuggestions: [],
    limitations,
  };
  return {
    ...expansion,
    fixtures: buildFixtures(expansion, []),
  };
}

function mapEdgeToPolicy(
  edge: KaqGraphEdge,
  targetNodeIds: Set<string>,
  limitations: GoalSubgraphLimitation[],
): GoalSubgraphPolicyEntry | null {
  const direction = edgeDirectionForTarget(edge, targetNodeIds);
  const semantics = semanticsForRelation(edge, direction);
  if (!semantics) {
    limitations.push({
      code: direction === 'outgoing' ? 'outgoing-relation-not-prerequisite' : 'unsupported-relation',
      edgeId: edge.id,
      severity: 'warning',
      message: direction === 'outgoing'
        ? `Outgoing graph edge is not a prerequisite or evidence policy for this goal: ${edge.id}.`
        : `Graph edge relation is not supported by goal expansion: ${edge.relation}.`,
    });
    return null;
  }
  if (edge.strength === 'weak') {
    limitations.push({
      code: 'weak-relation-evidence',
      edgeId: edge.id,
      severity: 'warning',
      message: `Graph edge has weak relation evidence and is treated as recommended: ${edge.id}.`,
    });
  }
  return {
    edgeId: edge.id,
    sourceNodeId: edge.sourceNodeId,
    targetNodeId: edge.targetNodeId,
    domain: edge.domain,
    relation: edge.relation,
    strength: edge.strength,
    semantics,
    direction,
    required: edge.strength === 'strong' && (
      semantics === 'hard_prerequisite' ||
      semantics === 'co_requisite' ||
      semantics === 'evidence_for'
    ),
    rationale: edge.rationale,
  };
}

function edgeDirectionForTarget(edge: KaqGraphEdge, targetNodeIds: Set<string>): GoalSubgraphPolicyEntry['direction'] {
  const sourceIsTarget = targetNodeIds.has(edge.sourceNodeId);
  const targetIsTarget = targetNodeIds.has(edge.targetNodeId);
  if (sourceIsTarget && targetIsTarget) return 'internal';
  return targetIsTarget ? 'incoming' : 'outgoing';
}

function semanticsForRelation(
  edge: KaqGraphEdge,
  direction: GoalSubgraphPolicyEntry['direction'],
): GoalSubgraphPrerequisitePolicySemantics | null {
  if (edge.relation === 'depends-on') {
    return direction === 'outgoing' || direction === 'internal' ? 'hard_prerequisite' : null;
  }
  if (direction === 'outgoing') {
    if (edge.relation === 'extends') return 'extension';
    if (edge.relation === 'transfers-to') return 'transfer_to';
    return null;
  }
  if (edge.relation === 'supports') return edge.strength === 'strong' ? 'hard_prerequisite' : 'soft_prerequisite';
  if (edge.relation === 'applies') return 'co_requisite';
  if (edge.relation === 'assesses') return 'evidence_for';
  if (edge.relation === 'extends') return 'extension';
  if (edge.relation === 'transfers-to') return 'transfer_to';
  if (edge.relation === 'constrains') return 'co_requisite';
  return null;
}

function prerequisiteCandidateNodeId(entry: GoalSubgraphPolicyEntry): string {
  if (entry.relation === 'depends-on' && entry.direction === 'outgoing') {
    return entry.targetNodeId;
  }
  return entry.sourceNodeId;
}

function groupNodeIdsByDomain(nodes: KaqGraphNode[]): Record<KaqGraphDomain, string[]> {
  return {
    knowledge: uniqueSorted(nodes.filter((node) => node.domain === 'knowledge').map((node) => node.id)),
    capability: uniqueSorted(nodes.filter((node) => node.domain === 'capability').map((node) => node.id)),
    quality: uniqueSorted(nodes.filter((node) => node.domain === 'quality').map((node) => node.id)),
  };
}

function buildLearningGoalLimitations(learningGoal: LearningGoalDefinition): GoalSubgraphLimitation[] {
  return [
    ...learningGoal.limitations.map((message) => ({
      code: 'learning-goal-limitation' as const,
      severity: 'warning' as const,
      message,
    })),
    ...learningGoal.evidencePolicy.limitations.map((message) => ({
      code: 'quality-evidence-limitation' as const,
      severity: 'warning' as const,
      message,
    })),
  ];
}

function buildTerminalValidationCandidates(
  learningGoal: LearningGoalDefinition,
  targetNodes: KaqGraphNode[],
): GoalSubgraphTerminalValidationCandidate[] {
  if (!learningGoal.terminalValidationPolicy.acceptedEvidenceTypes.length) return [];
  return targetNodes
    .filter((node) => node.domain === 'capability' || node.domain === 'quality')
    .map((node) => ({
      id: `terminal:${learningGoal.id}:${node.id}`,
      graphNodeId: node.id,
      acceptedEvidenceTypes: learningGoal.terminalValidationPolicy.acceptedEvidenceTypes,
      required: learningGoal.terminalValidationPolicy.required,
      summary: learningGoal.terminalValidationPolicy.summary,
    }))
    .sort((left, right) => left.id.localeCompare(right.id));
}

function buildCheckpointSuggestions(
  learningGoal: LearningGoalDefinition,
  targetNodes: KaqGraphNode[],
): GoalSubgraphCheckpointSuggestion[] {
  return targetNodes
    .filter((node) => node.domain !== 'knowledge')
    .map((node) => ({
      id: `checkpoint:${learningGoal.id}:${node.id}`,
      graphNodeId: node.id,
      evidenceTypes: learningGoal.evidencePolicy.requiredEvidenceTypes,
      reason: `Checkpoint suggestion for ${node.title}.`,
    }))
    .sort((left, right) => left.id.localeCompare(right.id));
}

function buildFixtures(
  expansion: Omit<ExpandedGoalSubgraph, 'fixtures'>,
  targetNodes: KaqGraphNode[],
): ExpandedGoalSubgraph['fixtures'] {
  const targetGraphNodeIds = [
    ...expansion.graphNodeIds.knowledge,
    ...expansion.graphNodeIds.capability,
    ...expansion.graphNodeIds.quality,
  ];
  const versionRefs = buildKaqArtifactVersionRefs({
    learningGoalPackageVersion: expansion.learningGoalVersion === 'unknown' ? null : expansion.learningGoalVersion,
    graphCatalogVersion: expansion.graphVersion,
    groundingVersion: KONLING_GRAPH_GROUNDING_VERSION,
    overlayVersion: GRAPH_CENTER_OVERLAY_VERSION,
  });
  return {
    planner: {
      learningGoalId: expansion.learningGoalId,
      graphVersion: expansion.graphVersion,
      targetGraphNodeIds,
      prerequisitePolicy: expansion.prerequisitePolicy,
      terminalValidationCandidates: expansion.terminalValidationCandidates,
      checkpointSuggestions: expansion.checkpointSuggestions,
      limitationCodes: uniqueSortedLimitationCodes(expansion.limitations.map((item) => item.code)),
    },
    konling: {
      learningGoalId: expansion.learningGoalId,
      graphVersion: expansion.graphVersion,
      versionRefs,
      groundingNodeIds: targetGraphNodeIds,
      prerequisitePolicySummaries: expansion.prerequisitePolicy.map((entry) =>
        `${entry.semantics}:${entry.sourceNodeId}->${entry.targetNodeId}`
      ),
      limitations: expansion.limitations,
    },
    graphCenter: {
      learningGoalId: expansion.learningGoalId,
      graphVersion: expansion.graphVersion,
      versionRefs,
      domains: (['knowledge', 'capability', 'quality'] satisfies KaqGraphDomain[]).map((domain) => ({
        domain,
        nodeIds: targetNodes.filter((node) => node.domain === domain).map((node) => node.id).sort((left, right) => left.localeCompare(right)),
      })),
      relationIds: expansion.prerequisitePolicy.map((entry) => entry.edgeId),
      actionable: false,
    },
  };
}

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values)).sort((left, right) => left.localeCompare(right));
}

function uniqueSortedLimitationCodes(
  values: GoalSubgraphLimitation['code'][],
): GoalSubgraphLimitation['code'][] {
  return Array.from(new Set(values)).sort((left, right) => left.localeCompare(right));
}
