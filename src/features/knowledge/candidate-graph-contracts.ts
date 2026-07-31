import {
  CURRENT_AGGREGATE_RELEASE_ID,
  CURRENT_AGGREGATE_RELEASE_SET_ID,
} from '@/lib/authoritative-knowledge/contracts';
import type {
  CanvasProjection,
  NodeDetailProjection,
} from '@/lib/authoritative-knowledge/projections';

export const CANDIDATE_RELEASE_SELECTOR = {
  authorityState: 'candidate',
  releaseSetId: CURRENT_AGGREGATE_RELEASE_SET_ID,
  releaseId: CURRENT_AGGREGATE_RELEASE_ID,
} as const;

export const CANDIDATE_GRAPH_SUPPORT = {
  consumerId: 'candidate-authoritative-knowledge-graph',
  supportedObjectTypes: [
    'DomainConcept',
    'Formula',
    'KnowledgeStatement',
    'SystemModel',
  ],
  supportedPredicates: [
    'association',
    'applies_to',
    'derived_from',
    'has_component',
    'has_formula',
    'has_representation',
    'is_a',
    'part_of',
    'used_to_analyze',
  ],
} as const;

export interface CandidateTypePresentation {
  canonicalType: string;
  label: string;
  tone: 'concept' | 'formula' | 'statement' | 'model' | 'generic';
  generic: boolean;
}

const TYPE_VOCABULARY = {
  DomainConcept: { label: '领域概念', tone: 'concept' },
  Formula: { label: '公式', tone: 'formula' },
  KnowledgeStatement: { label: '知识陈述', tone: 'statement' },
  SystemModel: { label: '系统模型', tone: 'model' },
} as const;

export function getCandidateTypePresentation(canonicalType: string): CandidateTypePresentation {
  const registered = TYPE_VOCABULARY[canonicalType as keyof typeof TYPE_VOCABULARY];
  return registered
    ? { canonicalType, ...registered, generic: false }
    : { canonicalType, label: canonicalType, tone: 'generic', generic: true };
}

export interface CandidatePredicatePresentation {
  predicate: string;
  label: string;
  direction: 'undirected' | 'source-to-target' | null;
  lineStyle: 'solid' | 'dashed' | 'dotted';
  explanation: string;
  registered: boolean;
}

const PREDICATE_VOCABULARY = {
  association: {
    label: '关联',
    direction: 'undirected',
    lineStyle: 'dashed',
    explanation: '两个对象存在已审查的语义关联，不推断先后或包含关系。',
  },
  applies_to: {
    label: '适用于',
    direction: 'source-to-target',
    lineStyle: 'dashed',
    explanation: '来源方法、公式或陈述适用于目标对象。',
  },
  derived_from: {
    label: '推导自',
    direction: 'source-to-target',
    lineStyle: 'solid',
    explanation: '来源对象由目标对象推导得到。',
  },
  has_component: {
    label: '包含组成部分',
    direction: 'source-to-target',
    lineStyle: 'solid',
    explanation: '来源对象包含目标对象作为其组成部分。',
  },
  has_formula: {
    label: '具有公式',
    direction: 'source-to-target',
    lineStyle: 'solid',
    explanation: '来源对象以目标公式作为其公式表达。',
  },
  has_representation: {
    label: '具有表示',
    direction: 'source-to-target',
    lineStyle: 'solid',
    explanation: '来源对象具有目标对象作为其表示形式。',
  },
  is_a: {
    label: '属于',
    direction: 'source-to-target',
    lineStyle: 'solid',
    explanation: '来源对象属于目标类型或上位概念。',
  },
  part_of: {
    label: '组成部分',
    direction: 'source-to-target',
    lineStyle: 'solid',
    explanation: '来源对象是目标对象的组成部分。',
  },
  used_to_analyze: {
    label: '用于分析',
    direction: 'source-to-target',
    lineStyle: 'dotted',
    explanation: '来源对象用于分析目标对象。',
  },
} as const;

export function getCandidatePredicatePresentation(predicate: string): CandidatePredicatePresentation {
  const registered = PREDICATE_VOCABULARY[predicate as keyof typeof PREDICATE_VOCABULARY];
  return registered
    ? { predicate, ...registered, registered: true }
    : {
        predicate,
        label: predicate,
        direction: null,
        lineStyle: 'dotted',
        explanation: '上游谓词尚未登记中文说明，按原始方向只读显示。',
        registered: false,
      };
}

export interface CandidateRelationDirectionPresentation {
  kind: 'undirected' | 'directed' | 'unknown';
  label: string;
  rawDirection: string | null;
}

export function resolveCandidateRelationDirection(
  predicate: CandidatePredicatePresentation,
  rawDirection: string | null | undefined,
): CandidateRelationDirectionPresentation {
  // 方向只来自上游 raw direction：已通过固定合同的数据保留原始方向展示，
  // 本地谓词登记不得静默覆盖；raw 未声明或未知谓词保持 raw fallback，不推断。
  void predicate;
  const normalizedRawDirection = rawDirection?.trim() || null;
  if (normalizedRawDirection === 'unordered' || normalizedRawDirection === 'undirected') {
    return {
      kind: 'undirected',
      label: '无向/双向',
      rawDirection: normalizedRawDirection,
    };
  }
  if (normalizedRawDirection === 'source-to-target' || normalizedRawDirection === 'source_to_target' || normalizedRawDirection === 'directed') {
    return {
      kind: 'directed',
      label: '来源→目标',
      rawDirection: normalizedRawDirection,
    };
  }
  return {
    kind: 'unknown',
    label: normalizedRawDirection
      ? `原始方向：${normalizedRawDirection}`
      : '原始方向未声明',
    rawDirection: normalizedRawDirection,
  };
}

export function getCandidateDetailDirectionLabel(input: {
  direction: CandidateRelationDirectionPresentation;
  traversal: 'outgoing' | 'incoming';
}): string {
  if (input.direction.kind === 'undirected') return input.direction.label;
  if (input.direction.kind === 'directed') {
    return input.traversal === 'outgoing'
      ? '出向（来源→目标）'
      : '入向（来源→目标）';
  }
  return input.direction.label;
}

export type CandidateGovernanceFilter = 'CORE' | 'EXTENSION';

export function selectCandidateGraphView(
  projection: CanvasProjection,
  input: {
    canonicalType: string | null;
    governance: CandidateGovernanceFilter;
  },
): Pick<CanvasProjection, 'nodes' | 'relations'> {
  // 核心/扩展只来自聚合 release tier：核心视图仅保留 Gold 节点及两端均可视的
  // Gold 关系；默认（扩展）视图同时显示 Gold 与 Silver 两层。
  const tierNodes = input.governance === 'CORE'
    ? projection.nodes.filter((node) => node.releaseTier === 'gold')
    : projection.nodes;
  const tierNodeIds = new Set(tierNodes.map((node) => node.id));
  const tierRelations = projection.relations.filter((relation) => (
    (input.governance === 'EXTENSION' || relation.qualityTier === 'GOLD')
    && tierNodeIds.has(relation.sourceId)
    && tierNodeIds.has(relation.targetId)
  ));
  if (!input.canonicalType) {
    return { nodes: tierNodes, relations: tierRelations };
  }

  const centerIds = new Set(
    tierNodes
      .filter((node) => node.canonicalType === input.canonicalType)
      .map((node) => node.id),
  );
  const oneHopRelations = tierRelations.filter((relation) => (
    centerIds.has(relation.sourceId) || centerIds.has(relation.targetId)
  ));
  const visibleIds = new Set(centerIds);
  oneHopRelations.forEach((relation) => {
    visibleIds.add(relation.sourceId);
    visibleIds.add(relation.targetId);
  });
  return {
    nodes: tierNodes.filter((node) => visibleIds.has(node.id)),
    relations: oneHopRelations,
  };
}

export type CandidateCanvasResponse = CanvasProjection;
export type CandidateNodeDetailResponse = NodeDetailProjection;
