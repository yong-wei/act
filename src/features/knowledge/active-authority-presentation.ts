import type {
  ActiveCanvasNode,
  ActiveCanvasRelation,
  ActiveCanvasResponse,
  ActiveNodeAdjacency,
  ActiveNodeDetailResponse,
} from './active-authority-graph-contracts';

/**
 * The active Authority response is intentionally richer than the browser
 * presentation.  This module is the only place where the response is turned
 * into user-facing graph semantics.  Opaque keys remain available for graph
 * topology, but never become a display fallback.
 */

export const ACTIVE_GRAPH_NODE_LIMIT = 24;

export type ActiveNodeShape = 'circle' | 'diamond' | 'hexagon' | 'rounded' | 'square';
export type ActiveRelationKind = 'directed' | 'undirected';

export interface ActiveNodeTypePresentation {
  canonicalType: string;
  label: string;
  shape: ActiveNodeShape;
  tone: string;
  supported: boolean;
}

export interface ActiveRelationPresentation {
  predicate: string;
  label: string;
  kind: ActiveRelationKind;
  directionLabel: string;
  supported: boolean;
}

export interface ActiveNodePresentation {
  key: string;
  label: string;
  aliases: readonly string[];
  description: string | null;
  type: ActiveNodeTypePresentation;
  sourceNode: ActiveCanvasNode;
}

export interface ActiveRelationView {
  key: string;
  sourceKey: string;
  targetKey: string;
  semantic: ActiveRelationPresentation;
  qualityLabel: string;
  sourceRelation: ActiveCanvasRelation;
}

export interface ActiveAuthorityGraphModel {
  nodes: readonly ActiveNodePresentation[];
  relations: readonly ActiveRelationView[];
  nodeByKey: ReadonlyMap<string, ActiveNodePresentation>;
  adjacency: ReadonlyMap<string, readonly ActiveRelationView[]>;
  totalNodeCount: number;
  totalRelationCount: number;
  omittedNodeCount: number;
  omittedRelationCount: number;
}

export interface ActiveVisibleGraph {
  nodes: ActiveNodePresentation[];
  relations: ActiveRelationView[];
  keys: Set<string>;
}

const NODE_TYPES: Readonly<Record<string, Omit<ActiveNodeTypePresentation, 'canonicalType'>>> = {
  DomainConcept: {
    label: '领域概念',
    shape: 'circle',
    tone: 'cyan',
    supported: true,
  },
  Formula: {
    label: '公式',
    shape: 'diamond',
    tone: 'violet',
    supported: true,
  },
  KnowledgeStatement: {
    label: '知识陈述',
    shape: 'rounded',
    tone: 'amber',
    supported: true,
  },
  SystemModel: {
    label: '系统模型',
    shape: 'hexagon',
    tone: 'emerald',
    supported: true,
  },
  ModelRepresentation: {
    label: '模型表示',
    shape: 'square',
    tone: 'blue',
    supported: true,
  },
};

const RELATION_TYPES: Readonly<Record<string, Omit<ActiveRelationPresentation, 'predicate'>>> = {
  association: {
    label: '关联',
    kind: 'undirected',
    directionLabel: '关联关系',
    supported: true,
  },
  applies_to: {
    label: '适用于',
    kind: 'directed',
    directionLabel: '由前者指向后者',
    supported: true,
  },
  derived_from: {
    label: '推导自',
    kind: 'directed',
    directionLabel: '由前者指向后者',
    supported: true,
  },
  has_component: {
    label: '包含组成部分',
    kind: 'directed',
    directionLabel: '由前者指向后者',
    supported: true,
  },
  has_formula: {
    label: '具有公式',
    kind: 'directed',
    directionLabel: '由前者指向后者',
    supported: true,
  },
  has_representation: {
    label: '具有表示',
    kind: 'directed',
    directionLabel: '由前者指向后者',
    supported: true,
  },
  is_a: {
    label: '属于',
    kind: 'directed',
    directionLabel: '由前者指向后者',
    supported: true,
  },
  part_of: {
    label: '组成部分',
    kind: 'directed',
    directionLabel: '由前者指向后者',
    supported: true,
  },
  used_to_analyze: {
    label: '用于分析',
    kind: 'directed',
    directionLabel: '由前者指向后者',
    supported: true,
  },
  PREREQUISITE: {
    label: '先修',
    kind: 'directed',
    directionLabel: '由前者指向后者',
    supported: true,
  },
};

const GOVERNANCE_LABELS: Readonly<Record<string, string>> = {
  approved: '已审核',
  published: '已发布',
  active: '当前有效',
  CORE: '核心内容',
  EXTENSION: '扩展内容',
  UNCLASSIFIED: '未分类内容',
  gold: '高置信内容',
  silver: '一般置信内容',
};

function nonEmpty(value: string | null | undefined): string | null {
  const trimmed = typeof value === 'string' ? value.trim() : '';
  return trimmed.length > 0 ? trimmed : null;
}

function isUnsafeIdentity(value: string): boolean {
  return /^(?:node|relation|source|target|release|snapshot|activation|projection|edition|section)[-_:/]/iu.test(value)
    || /^[a-f0-9]{32,}$/iu.test(value);
}

export function presentActiveHumanText(value: string | null | undefined, fallback: string): string {
  const normalized = nonEmpty(value);
  return normalized && !isUnsafeIdentity(normalized) ? normalized : fallback;
}

/** Return a controlled type state; never return the unknown raw value. */
export function presentActiveNodeType(
  canonicalType: string,
  projectedLabel?: string | null,
): ActiveNodeTypePresentation {
  const known = NODE_TYPES[canonicalType];
  const overlay = nonEmpty(projectedLabel);
  if (!known) {
    return {
      canonicalType: 'unknown',
      label: '类型暂不可解释',
      shape: 'circle',
      tone: 'muted',
      supported: false,
    };
  }
  return { canonicalType, ...known, label: overlay ?? known.label };
}

export const presentActiveType = presentActiveNodeType;

export interface ActivePredicatePresentation {
  predicate: string;
  label: string;
  supported: boolean;
}

export function presentActivePredicate(predicate: string): ActivePredicatePresentation {
  const known = RELATION_TYPES[predicate];
  return {
    predicate: known ? predicate : 'unknown',
    label: known?.label ?? '关系暂不可解释',
    supported: Boolean(known),
  };
}

/** Return a controlled relation state; never return the unknown raw value. */
export function presentActiveRelation(
  predicate: string,
  direction: string | null,
  projected?: { label?: string | null; directionLabel?: string | null },
): ActiveRelationPresentation {
  const known = RELATION_TYPES[predicate];
  const isUndirected = direction === 'unordered' || direction === 'undirected';
  const isDirected = direction === 'directed'
    || direction === 'source_to_target'
    || direction === 'source-to-target';
  if (!known || (!isUndirected && !isDirected)) {
    return {
      predicate: 'unknown',
      label: '关系暂不可解释',
      kind: 'undirected',
      directionLabel: '关系方向暂不可解释',
      supported: false,
    };
  }
  return {
    predicate,
    label: nonEmpty(projected?.label) ?? known.label,
    kind: isUndirected ? 'undirected' : 'directed',
    directionLabel: nonEmpty(projected?.directionLabel)
      ?? (isUndirected ? '关联关系' : known.directionLabel),
    supported: true,
  };
}

export interface ActiveDirectionPresentation {
  direction: string | null;
  label: string;
  kind: ActiveRelationKind | 'unknown';
  supported: boolean;
}

export function presentActiveDirection(direction: string | null): ActiveDirectionPresentation {
  const isUndirected = direction === 'unordered' || direction === 'undirected';
  const isDirected = direction === 'directed'
    || direction === 'source_to_target'
    || direction === 'source-to-target';
  return {
    direction: isUndirected || isDirected ? direction : null,
    label: isUndirected ? '关联关系' : isDirected ? '由前者指向后者' : '关系方向暂不可解释',
    kind: isUndirected ? 'undirected' : isDirected ? 'directed' : 'unknown',
    supported: isUndirected || isDirected,
  };
}

export function presentGovernanceLabel(value: string | null | undefined): string {
  const normalized = nonEmpty(value);
  return normalized ? GOVERNANCE_LABELS[normalized] ?? '状态暂不可解释' : '状态暂不可用';
}

export function presentSourceCitation(
  sources: ActiveNodeDetailResponse['node']['sources'] | undefined,
): string {
  const labels = (sources ?? [])
    .map((source) => nonEmpty(source.label))
    .filter((label): label is string => Boolean(label));
  if (labels.length > 0) return labels.join(' · ');
  return sources && sources.length > 0 ? '来源定位暂不可用' : '暂无公开来源';
}

function safeNodeLabel(node: ActiveCanvasNode): string | null {
  const label = nonEmpty(node.label);
  if (!label || label === node.id || isUnsafeIdentity(label)) return null;
  return label;
}

function safeDescription(node: ActiveCanvasNode): string | null {
  const description = nonEmpty(node.description);
  return description && !isUnsafeIdentity(description) ? description : null;
}

function relationQualityLabel(relation: ActiveCanvasRelation): string {
  return presentGovernanceLabel(relation.qualityTier);
}

function isSupportedNode(node: ActiveCanvasNode): boolean {
  return Boolean(
    nonEmpty(node.id)
      && safeNodeLabel(node)
      && node.semanticSupport?.supported === true
      && node.semanticSupport?.readOnly === true
      && presentActiveNodeType(node.canonicalType).supported,
  );
}

function isSupportedRelation(
  relation: ActiveCanvasRelation,
  nodeKeys: ReadonlyMap<string, ActiveNodePresentation>,
): boolean {
  const semantic = presentActiveRelation(relation.predicate, relation.direction);
  return Boolean(
    nonEmpty(relation.id)
      && nodeKeys.has(relation.sourceId)
      && nodeKeys.has(relation.targetId)
      && relation.semanticSupport?.supported === true
      && relation.semanticSupport?.readOnly === true
      && semantic.supported,
  );
}

function compareKey(left: { key: string }, right: { key: string }): number {
  return left.key.localeCompare(right.key);
}

/** Build deterministic, fail-closed browser presentation state. */
export function createActiveAuthorityGraphModel(
  response: Pick<ActiveCanvasResponse, 'nodes' | 'relations'>,
): ActiveAuthorityGraphModel {
  const candidates = response.nodes
    .filter(isSupportedNode)
    .map((sourceNode) => ({
      key: sourceNode.id,
      label: safeNodeLabel(sourceNode) as string,
      aliases: sourceNode.aliases ?? [],
      description: safeDescription(sourceNode),
      type: presentActiveNodeType(sourceNode.canonicalType, sourceNode.typeLabel),
      sourceNode,
    } satisfies ActiveNodePresentation))
    .sort(compareKey);
  const nodeByKey = new Map(candidates.map((node) => [node.key, node]));
  const relations = response.relations
    .filter((relation) => isSupportedRelation(relation, nodeByKey))
    .map((sourceRelation) => ({
      key: sourceRelation.id,
      sourceKey: sourceRelation.sourceId,
      targetKey: sourceRelation.targetId,
      semantic: presentActiveRelation(sourceRelation.predicate, sourceRelation.direction, {
        label: sourceRelation.predicateLabel,
        directionLabel: sourceRelation.directionLabel,
      }),
      qualityLabel: relationQualityLabel(sourceRelation),
      sourceRelation,
    } satisfies ActiveRelationView))
    .sort(compareKey);
  const adjacencyMutable = new Map<string, ActiveRelationView[]>();
  candidates.forEach((node) => adjacencyMutable.set(node.key, []));
  relations.forEach((relation) => {
    adjacencyMutable.get(relation.sourceKey)?.push(relation);
    if (relation.targetKey !== relation.sourceKey) {
      adjacencyMutable.get(relation.targetKey)?.push(relation);
    }
  });
  const adjacency = new Map<string, readonly ActiveRelationView[]>();
  adjacencyMutable.forEach((items, key) => {
    adjacency.set(key, [...items].sort(compareKey));
  });
  return {
    nodes: candidates,
    relations,
    nodeByKey,
    adjacency,
    totalNodeCount: response.nodes.length,
    totalRelationCount: response.relations.length,
    omittedNodeCount: response.nodes.length - candidates.length,
    omittedRelationCount: response.relations.length - relations.length,
  };
}

export const buildActiveAuthorityPresentation = createActiveAuthorityGraphModel;

export const presentActiveNodeName = presentActiveHumanText;
export const presentActiveGovernance = presentGovernanceLabel;
export const presentActiveSourceCitation = presentSourceCitation;

function degree(model: ActiveAuthorityGraphModel, key: string): number {
  return model.adjacency.get(key)?.length ?? 0;
}

function orderedNeighbors(model: ActiveAuthorityGraphModel, key: string): string[] {
  const neighbors = new Set<string>();
  model.adjacency.get(key)?.forEach((relation) => {
    neighbors.add(relation.sourceKey === key ? relation.targetKey : relation.sourceKey);
  });
  return [...neighbors].sort((left, right) => {
    const degreeDifference = degree(model, right) - degree(model, left);
    return degreeDifference || left.localeCompare(right);
  });
}

function connectedScope(
  model: ActiveAuthorityGraphModel,
  seed: string,
  limit: number,
): Set<string> {
  const keys = new Set<string>();
  const queue = [seed];
  while (queue.length > 0 && keys.size < limit) {
    const key = queue.shift() as string;
    if (keys.has(key) || !model.nodeByKey.has(key)) continue;
    keys.add(key);
    orderedNeighbors(model, key).forEach((neighbor) => {
      if (!keys.has(neighbor) && !queue.includes(neighbor)) queue.push(neighbor);
    });
  }
  return keys;
}

/** Choose a stable high-connectivity entry without treating it as ranking. */
export function selectInitialScope(
  model: ActiveAuthorityGraphModel,
  limit = ACTIVE_GRAPH_NODE_LIMIT,
): Set<string> {
  const boundedLimit = Math.max(1, Math.floor(limit));
  const seed = [...model.nodes]
    .sort((left, right) => degree(model, right.key) - degree(model, left.key) || left.key.localeCompare(right.key))[0];
  return seed ? connectedScope(model, seed.key, boundedLimit) : new Set();
}

export const selectActiveEntryScope = selectInitialScope;

const PRIMARY_DOMAIN_OBJECT_TYPES = new Set(['DomainConcept', 'SystemModel']);

/**
 * Keep the first domain canvas readable. Formulae and knowledge statements
 * remain in the model for explicit search, directory filtering and one-hop
 * disclosure, but do not occupy the initial object layer.
 */
export function selectInitialPrimaryDomainScope(
  model: ActiveAuthorityGraphModel,
  limit = ACTIVE_GRAPH_NODE_LIMIT,
): Set<string> {
  const boundedLimit = Math.max(1, Math.floor(limit));
  const primary = model.nodes
    .filter((node) => PRIMARY_DOMAIN_OBJECT_TYPES.has(node.type.canonicalType))
    .sort((left, right) => degree(model, right.key) - degree(model, left.key) || left.key.localeCompare(right.key));
  return primary.length > 0
    ? new Set(primary.slice(0, boundedLimit).map((node) => node.key))
    : selectInitialScope(model, boundedLimit);
}

export function isPrimaryDomainObject(node: ActiveNodePresentation): boolean {
  return PRIMARY_DOMAIN_OBJECT_TYPES.has(node.type.canonicalType);
}

export function buildActiveAdjacencyIndex(
  model: ActiveAuthorityGraphModel,
): ReadonlyMap<string, readonly ActiveRelationView[]> {
  return model.adjacency;
}

export function visibleActiveGraph(
  model: ActiveAuthorityGraphModel,
  keys: Iterable<string>,
): ActiveVisibleGraph {
  const validKeys = new Set([...keys].filter((key) => model.nodeByKey.has(key)));
  const nodes = model.nodes.filter((node) => validKeys.has(node.key));
  const relations = model.relations.filter((relation) => validKeys.has(relation.sourceKey) && validKeys.has(relation.targetKey));
  return { nodes, relations, keys: validKeys };
}

export function activeNodeSearch(
  model: ActiveAuthorityGraphModel,
  query: string,
  canonicalType?: string,
): ActiveNodePresentation[] {
  const needle = query.trim().toLocaleLowerCase();
  return model.nodes
    .filter((node) => !canonicalType || node.type.canonicalType === canonicalType)
    .filter((node) => !needle || `${node.label} ${node.aliases.join(' ')} ${node.description ?? ''} ${node.type.label}`.toLocaleLowerCase().includes(needle))
    .sort((left, right) => left.label.localeCompare(right.label) || left.key.localeCompare(right.key));
}

export const searchActiveAuthorityNodes = activeNodeSearch;
export const searchActiveNodes = activeNodeSearch;

/** Materialize a search hit and its real one-hop neighborhood. */
export function materializeActiveNodeScope(
  model: ActiveAuthorityGraphModel,
  nodeKey: string,
  limit = ACTIVE_GRAPH_NODE_LIMIT,
): Set<string> {
  if (!model.nodeByKey.has(nodeKey)) return new Set();
  const boundedLimit = Math.max(1, Math.floor(limit));
  const keys = new Set<string>([nodeKey]);
  orderedNeighbors(model, nodeKey).forEach((neighbor) => {
    if (keys.size < boundedLimit) keys.add(neighbor);
  });
  return keys;
}

export const focusActiveAuthorityNode = materializeActiveNodeScope;
export const materializeActiveOneHop = materializeActiveNodeScope;

/** Expand an existing scope by exactly one real adjacency hop. */
export function expandActiveAuthorityOneHop(
  model: ActiveAuthorityGraphModel,
  existingKeys: Iterable<string>,
  nodeKey: string,
  limit = ACTIVE_GRAPH_NODE_LIMIT,
): Set<string> {
  if (!model.nodeByKey.has(nodeKey)) return new Set(existingKeys);
  const boundedLimit = Math.max(1, Math.floor(limit));
  const existing = [...existingKeys].filter((key) => model.nodeByKey.has(key));
  const existingSet = new Set(existing);
  const unseenNeighbor = orderedNeighbors(model, nodeKey).some((neighbor) => !existingSet.has(neighbor));
  // A saturated scope must slide to the selected node's one-hop neighborhood;
  // otherwise a boundary node could never reveal its next real neighbor.
  if (existing.length >= boundedLimit && (unseenNeighbor || !existingSet.has(nodeKey))) {
    return materializeActiveNodeScope(model, nodeKey, boundedLimit);
  }
  if (existing.length >= boundedLimit) return new Set(existing.slice(0, boundedLimit));
  const next = new Set(existing.slice(0, boundedLimit));
  next.add(nodeKey);
  orderedNeighbors(model, nodeKey).forEach((neighbor) => {
    if (next.size < boundedLimit) next.add(neighbor);
  });
  return next;
}

export const expandActiveAuthorityGraph = expandActiveAuthorityOneHop;

export const projectActiveVisibleGraph = visibleActiveGraph;

export function returnToActiveOverview(
  model: ActiveAuthorityGraphModel,
  limit = ACTIVE_GRAPH_NODE_LIMIT,
): Set<string> {
  return selectInitialScope(model, limit);
}

export function activeNodeRelationSummaries(
  detail: ActiveNodeDetailResponse['node'],
  model: ActiveAuthorityGraphModel,
): Array<{
  key: string;
  relationLabel: string;
  directionLabel: string;
  neighborLabel: string;
  neighborKey: string;
  traversal: ActiveNodeAdjacency['traversal'];
  kind: ActiveRelationKind;
}> {
  return detail.adjacency
    .map((relation) => {
      const semantic = presentActiveRelation(relation.predicate, relation.direction);
      if (!semantic.supported) return null;
      const neighborLabel = model.nodeByKey.get(relation.neighborId)?.label ?? '对象名称暂不可用';
      return {
        key: relation.relationId,
        relationLabel: semantic.label,
        directionLabel: semantic.directionLabel,
        neighborLabel,
        neighborKey: relation.neighborId,
        traversal: relation.traversal,
        kind: semantic.kind,
      };
    })
    .filter((value): value is NonNullable<typeof value> => Boolean(value))
    .sort((left, right) => left.key.localeCompare(right.key));
}

export function activeModelRelationSummaries(
  model: ActiveAuthorityGraphModel,
  nodeKey: string,
): Array<{
  key: string;
  relationLabel: string;
  directionLabel: string;
  neighborLabel: string;
  neighborKey: string;
  traversal: ActiveNodeAdjacency['traversal'];
  kind: ActiveRelationKind;
}> {
  return (model.adjacency.get(nodeKey) ?? [])
    .map((relation) => {
      const neighborKey = relation.sourceKey === nodeKey ? relation.targetKey : relation.sourceKey;
      return {
        key: relation.key,
        relationLabel: relation.semantic.label,
        directionLabel: relation.semantic.directionLabel,
        neighborLabel: model.nodeByKey.get(neighborKey)?.label ?? '对象名称暂不可用',
        neighborKey,
        traversal: (relation.sourceKey === nodeKey ? 'outgoing' : 'incoming') as ActiveNodeAdjacency['traversal'],
        kind: relation.semantic.kind,
      };
    })
    .sort((left, right) => left.key.localeCompare(right.key));
}

export function knownActiveNodeTypes(): ActiveNodeTypePresentation[] {
  return Object.keys(NODE_TYPES).sort().map((canonicalType) => presentActiveNodeType(canonicalType));
}
