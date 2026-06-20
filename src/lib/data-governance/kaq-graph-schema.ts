import {
  PORTRAIT_V2_DIMENSION_IDS,
  validateKaqObjectiveCatalog,
  type KaqObjective,
  type KaqObjectiveDomain,
  type KaqObjectiveSeedCatalog,
  type KaqObjectiveStatus,
  type PortraitV2DimensionId,
} from './kaq-objective-taxonomy';

export type KaqGraphDomain = KaqObjectiveDomain;
export type KaqGraphNodeStatus = KaqObjectiveStatus;
export type KaqGraphRelation =
  | 'depends-on'
  | 'supports'
  | 'extends'
  | 'assesses'
  | 'applies'
  | 'transfers-to'
  | 'constrains';
export type KaqGraphEdgeStrength = 'weak' | 'medium' | 'strong';
export type KaqGraphKnowledgeNodeKind =
  | 'concept'
  | 'method'
  | 'formula'
  | 'criterion'
  | 'model'
  | 'case';
export type KaqCapabilityBloomLevel = 'remember' | 'understand' | 'apply' | 'analyze' | 'evaluate' | 'create';

export interface KaqGraphNodeBase {
  id: string;
  domain: KaqGraphDomain;
  title: string;
  description: string;
  objectiveIds: string[];
  moduleId?: string;
  portraitDimensions: PortraitV2DimensionId[];
  status: KaqGraphNodeStatus;
}

export interface KaqKnowledgeGraphNode extends KaqGraphNodeBase {
  domain: 'knowledge';
  kind: KaqGraphKnowledgeNodeKind;
  knowledgeRefs: string[];
}

export interface KaqCapabilityGraphNode extends KaqGraphNodeBase {
  domain: 'capability';
  knowledgeNodeIds: string[];
  bloomLevel: KaqCapabilityBloomLevel;
  behaviorVerb: string;
  taskContext: string;
  successCriteria: string[];
  observableEvidenceTypes: string[];
  evaluationMethods: string[];
}

export interface KaqQualityRubricLevel {
  id: string;
  label: string;
  criteria: string[];
}

export interface KaqQualityGraphNode extends KaqGraphNodeBase {
  domain: 'quality';
  scenario: string;
  observableBehaviors: string[];
  rubricLevels: KaqQualityRubricLevel[];
  evidenceSources: string[];
}

export type KaqGraphNode = KaqKnowledgeGraphNode | KaqCapabilityGraphNode | KaqQualityGraphNode;

export interface KaqGraphEdge {
  id: string;
  domain: KaqGraphDomain;
  sourceNodeId: string;
  targetNodeId: string;
  relation: KaqGraphRelation;
  strength: KaqGraphEdgeStrength;
  rationale: string;
}

export interface KaqGraphCatalog {
  nodes: KaqGraphNode[];
  edges: KaqGraphEdge[];
}

export interface KaqGraphLearnerOverlay {
  domain: KaqGraphDomain;
  nodeId: string;
  learnerId: string;
  score: number;
  confidence: number;
  evidenceCount: number;
}

export interface KaqGraphClassOverlay {
  domain: KaqGraphDomain;
  nodeId: string;
  classId: string;
  distribution: Record<string, number>;
  sampleSize: number;
}

export interface KaqGraphResourceCoverageOverlay {
  domain: KaqGraphDomain;
  nodeId: string;
  coveredResourceIds: string[];
  missingResourceTypes: string[];
}

export type KaqGraphValidationIssueCode =
  | 'invalid-catalog-shape'
  | 'invalid-objective-catalog'
  | 'invalid-node-shape'
  | 'missing-node-id'
  | 'invalid-node-id'
  | 'missing-node-title'
  | 'missing-node-description'
  | 'invalid-node-domain'
  | 'invalid-node-status'
  | 'invalid-knowledge-kind'
  | 'duplicate-node-id'
  | 'invalid-edge-shape'
  | 'missing-edge-id'
  | 'invalid-edge-id'
  | 'invalid-edge-domain'
  | 'invalid-edge-relation'
  | 'invalid-edge-strength'
  | 'missing-edge-rationale'
  | 'duplicate-edge-id'
  | 'invalid-edge-reference'
  | 'edge-domain-mismatch'
  | 'unknown-objective-id'
  | 'invalid-portrait-dimension'
  | 'graph-body-contains-overlay-data'
  | 'capability-missing-knowledge-binding'
  | 'capability-missing-observable-evidence'
  | 'invalid-capability-bloom-level'
  | 'quality-missing-scenario'
  | 'quality-missing-observable-behavior'
  | 'quality-missing-rubric-levels'
  | 'invalid-quality-rubric-level'
  | 'quality-missing-evidence-sources';

export interface KaqGraphValidationIssue {
  code: KaqGraphValidationIssueCode;
  nodeId?: string | null;
  edgeId?: string | null;
  message: string;
}

export interface KaqGraphValidationResult {
  valid: boolean;
  issues: KaqGraphValidationIssue[];
}

const GRAPH_BODY_OVERLAY_KEYS = [
  'learnerId',
  'learnerScore',
  'learnerState',
  'classId',
  'classDistribution',
  'classHeat',
  'sampleSize',
  'resourceCoverage',
  'resourceCoverageStatus',
  'coverageStatus',
  'score',
  'confidence',
  'evidenceCount',
  'distribution',
  'coveredResourceIds',
  'missingResourceTypes',
] as const;

const PORTRAIT_DIMENSION_SET = new Set<string>(PORTRAIT_V2_DIMENSION_IDS);
const GRAPH_DOMAIN_SET = new Set<string>(['knowledge', 'capability', 'quality']);
const NODE_STATUS_SET = new Set<string>(['draft', 'active', 'deprecated']);
const KNOWLEDGE_KIND_SET = new Set<string>(['concept', 'method', 'formula', 'criterion', 'model', 'case']);
const BLOOM_LEVEL_SET = new Set<string>(['remember', 'understand', 'apply', 'analyze', 'evaluate', 'create']);
const GRAPH_RELATION_SET = new Set<string>(['depends-on', 'supports', 'extends', 'assesses', 'applies', 'transfers-to', 'constrains']);
const EDGE_STRENGTH_SET = new Set<string>(['weak', 'medium', 'strong']);

export function validateKaqGraphCatalog(
  catalog: unknown,
  objectivesInput: KaqObjective[] | KaqObjectiveSeedCatalog,
): KaqGraphValidationResult {
  const issues: KaqGraphValidationIssue[] = [];
  if (!isCatalogShape(catalog)) {
    return {
      valid: false,
      issues: [issue('invalid-catalog-shape', 'Graph catalog must declare nodes and edges arrays.')],
    };
  }

  const objectiveValidation = validateKaqObjectiveCatalog(objectivesInput);
  if (!objectiveValidation.valid) {
    issues.push(issue('invalid-objective-catalog', 'Objective taxonomy must be valid before graph validation.'));
  }

  const objectives = Array.isArray(objectivesInput)
    ? objectivesInput
    : [...objectivesInput.knowledge, ...objectivesInput.capability, ...objectivesInput.quality];
  const objectiveIds = new Set(objectives.map((objective) => objective.id));
  const nodesById = new Map<string, KaqGraphNode>();
  const seenNodeIds = new Set<string>();
  const seenEdgeIds = new Set<string>();

  for (const nodeValue of catalog.nodes) {
    if (!isRecord(nodeValue)) {
      issues.push(issue('invalid-node-shape', 'Graph node must be an object.', { nodeId: null }));
      continue;
    }
    const node = nodeValue as KaqGraphNode;
    validateGraphBodyBoundary(node, issues);
    validateCommonNode(node, objectiveIds, issues);

    if (!node.id) {
      issues.push(issue('missing-node-id', 'Graph node id is required.', { nodeId: null }));
      continue;
    }
    if (!isNonEmptyString(node.id)) {
      issues.push(issue('invalid-node-id', 'Graph node id must be a non-empty string.', { nodeId: null }));
      continue;
    }
    if (seenNodeIds.has(node.id)) {
      issues.push(issue('duplicate-node-id', 'Graph node id must be unique.', { nodeId: safeId(node.id) }));
    }
    seenNodeIds.add(node.id);
    nodesById.set(node.id, node);
  }

  for (const nodeValue of catalog.nodes) {
    if (!isRecord(nodeValue)) continue;
    const node = nodeValue as KaqGraphNode;
    if (node.domain === 'capability') validateCapabilityNode(node, nodesById, issues);
    if (node.domain === 'quality') validateQualityNode(node, issues);
  }

  for (const edgeValue of catalog.edges) {
    if (!isRecord(edgeValue)) {
      issues.push(issue('invalid-edge-shape', 'Graph edge must be an object.', { edgeId: null }));
      continue;
    }
    const edge = edgeValue as KaqGraphEdge;
    const hasTrackableEdgeId = isNonEmptyString(edge.id);
    if (!edge.id) {
      issues.push(issue('missing-edge-id', 'Graph edge id is required.', { edgeId: null }));
    } else if (!hasTrackableEdgeId) {
      issues.push(issue('invalid-edge-id', 'Graph edge id must be a non-empty string.', { edgeId: null }));
    } else if (seenEdgeIds.has(edge.id)) {
      issues.push(issue('duplicate-edge-id', 'Graph edge id must be unique.', { edgeId: safeId(edge.id) }));
    }
    if (hasTrackableEdgeId) seenEdgeIds.add(edge.id);
    validateEdge(edge, nodesById, issues);
  }

  return {
    valid: issues.length === 0,
    issues,
  };
}

function validateCommonNode(
  node: KaqGraphNode,
  objectiveIds: Set<string>,
  issues: KaqGraphValidationIssue[],
): void {
  if (!isNonEmptyString(node.title)) {
    issues.push(issue('missing-node-title', 'Graph node title is required.', { nodeId: safeId(node.id) }));
  }
  if (!isNonEmptyString(node.description)) {
    issues.push(issue('missing-node-description', 'Graph node description is required.', { nodeId: safeId(node.id) }));
  }
  if (!GRAPH_DOMAIN_SET.has(node.domain)) {
    issues.push(issue('invalid-node-domain', 'Graph node domain must be knowledge, capability, or quality.', { nodeId: safeId(node.id) }));
  }
  if (!NODE_STATUS_SET.has(node.status)) {
    issues.push(issue('invalid-node-status', 'Graph node status must be draft, active, or deprecated.', { nodeId: safeId(node.id) }));
  }
  const nodeRecord = node as unknown as Record<string, unknown>;
  if (
    (node.domain === 'knowledge' || Object.hasOwn(nodeRecord, 'kind')) &&
    !KNOWLEDGE_KIND_SET.has(String((node as Partial<KaqKnowledgeGraphNode>).kind ?? ''))
  ) {
    issues.push(issue('invalid-knowledge-kind', 'Knowledge graph node kind is invalid.', { nodeId: safeId(node.id) }));
  }

  if (!Array.isArray(node.objectiveIds) || node.objectiveIds.length === 0) {
    issues.push(issue('unknown-objective-id', 'Graph node must reference at least one known objective id.', { nodeId: safeId(node.id) }));
  } else {
    for (const objectiveId of node.objectiveIds) {
      if (!objectiveIds.has(objectiveId)) {
        issues.push(issue('unknown-objective-id', `Unknown objective id: ${objectiveId}.`, { nodeId: safeId(node.id) }));
      }
    }
  }

  if (!Array.isArray(node.portraitDimensions) || node.portraitDimensions.length === 0) {
    issues.push(issue('invalid-portrait-dimension', 'Graph node must map to at least one portrait v2 dimension.', { nodeId: safeId(node.id) }));
    return;
  }

  for (const dimension of node.portraitDimensions) {
    if (!PORTRAIT_DIMENSION_SET.has(dimension)) {
      issues.push(issue('invalid-portrait-dimension', `Unknown portrait v2 dimension: ${dimension}.`, { nodeId: safeId(node.id) }));
    }
  }
}

function validateGraphBodyBoundary(
  node: KaqGraphNode,
  issues: KaqGraphValidationIssue[],
): void {
  const value = node as unknown as Record<string, unknown>;
  for (const key of GRAPH_BODY_OVERLAY_KEYS) {
    if (Object.hasOwn(value, key)) {
      issues.push(issue('graph-body-contains-overlay-data', `Graph body node must not contain overlay field: ${key}.`, { nodeId: safeId(node.id) }));
    }
  }
}

function validateCapabilityNode(
  node: KaqCapabilityGraphNode,
  nodesById: Map<string, KaqGraphNode>,
  issues: KaqGraphValidationIssue[],
): void {
  const knowledgeNodeIds = Array.isArray(node.knowledgeNodeIds) ? node.knowledgeNodeIds : [];
  const hasKnowledgeBinding = knowledgeNodeIds.some((nodeId) => nodesById.get(nodeId)?.domain === 'knowledge');
  if (!BLOOM_LEVEL_SET.has(node.bloomLevel)) {
    issues.push(issue('invalid-capability-bloom-level', 'Capability node Bloom level is invalid.', { nodeId: safeId(node.id) }));
  }
  if (node.status === 'active' && !hasKnowledgeBinding) {
    issues.push(issue('capability-missing-knowledge-binding', 'Active capability node must bind to at least one knowledge node.', { nodeId: safeId(node.id) }));
  }

  const hasObservableEvidence =
    isNonEmptyString(node.behaviorVerb) &&
    isNonEmptyString(node.taskContext) &&
    hasNonEmptyString(node.successCriteria) &&
    hasNonEmptyString(node.observableEvidenceTypes) &&
    hasNonEmptyString(node.evaluationMethods);

  if (node.status === 'active' && !hasObservableEvidence) {
    issues.push(issue('capability-missing-observable-evidence', 'Active capability node must declare observable evidence semantics.', { nodeId: safeId(node.id) }));
  }
}

function validateQualityNode(
  node: KaqQualityGraphNode,
  issues: KaqGraphValidationIssue[],
): void {
  if (node.status !== 'active') return;

  if (!isNonEmptyString(node.scenario)) {
    issues.push(issue('quality-missing-scenario', 'Active quality node must declare a scenario.', { nodeId: safeId(node.id) }));
  }
  if (!hasNonEmptyString(node.observableBehaviors)) {
    issues.push(issue('quality-missing-observable-behavior', 'Active quality node must declare observable behaviors.', { nodeId: safeId(node.id) }));
  }
  if (!Array.isArray(node.rubricLevels) || node.rubricLevels.length === 0) {
    issues.push(issue('quality-missing-rubric-levels', 'Active quality node must declare rubric levels.', { nodeId: safeId(node.id) }));
  } else {
    for (const rubricLevel of node.rubricLevels) {
      if (
        !isRecord(rubricLevel) ||
        !isNonEmptyString(rubricLevel.id) ||
        !isNonEmptyString(rubricLevel.label) ||
        !hasNonEmptyString(rubricLevel.criteria)
      ) {
        issues.push(issue('invalid-quality-rubric-level', 'Quality rubric level must declare id, label, and criteria.', { nodeId: safeId(node.id) }));
      }
    }
  }
  if (!hasNonEmptyString(node.evidenceSources)) {
    issues.push(issue('quality-missing-evidence-sources', 'Active quality node must declare evidence sources.', { nodeId: safeId(node.id) }));
  }
}

function validateEdge(
  edge: KaqGraphEdge,
  nodesById: Map<string, KaqGraphNode>,
  issues: KaqGraphValidationIssue[],
): void {
  if (!GRAPH_DOMAIN_SET.has(edge.domain)) {
    issues.push(issue('invalid-edge-domain', 'Graph edge domain must be knowledge, capability, or quality.', { edgeId: safeId(edge.id) }));
  }
  if (!GRAPH_RELATION_SET.has(edge.relation)) {
    issues.push(issue('invalid-edge-relation', 'Graph edge relation is invalid.', { edgeId: safeId(edge.id) }));
  }
  if (!EDGE_STRENGTH_SET.has(edge.strength)) {
    issues.push(issue('invalid-edge-strength', 'Graph edge strength is invalid.', { edgeId: safeId(edge.id) }));
  }
  if (!isNonEmptyString(edge.rationale)) {
    issues.push(issue('missing-edge-rationale', 'Graph edge rationale is required.', { edgeId: safeId(edge.id) }));
  }

  const source = nodesById.get(edge.sourceNodeId);
  const target = nodesById.get(edge.targetNodeId);
  if (!source || !target) {
    issues.push(issue('invalid-edge-reference', 'Graph edge source and target must reference existing nodes.', { edgeId: safeId(edge.id) }));
  }
  if ((source && source.domain !== edge.domain) || (target && target.domain !== edge.domain)) {
    issues.push(issue('edge-domain-mismatch', 'Graph edge domain must match source and target node domains.', { edgeId: safeId(edge.id) }));
  }
}

function issue(
  code: KaqGraphValidationIssueCode,
  message: string,
  ids: Pick<KaqGraphValidationIssue, 'nodeId' | 'edgeId'> = {},
): KaqGraphValidationIssue {
  return { code, message, ...ids };
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function hasNonEmptyString(values: unknown): values is string[] {
  return Array.isArray(values) && values.some((value) => isNonEmptyString(value));
}

function isCatalogShape(value: unknown): value is KaqGraphCatalog {
  const candidate = value as Partial<KaqGraphCatalog> | null;
  return Boolean(candidate) && Array.isArray(candidate?.nodes) && Array.isArray(candidate?.edges);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function safeId(value: unknown): string | null {
  return isNonEmptyString(value) ? value : null;
}
