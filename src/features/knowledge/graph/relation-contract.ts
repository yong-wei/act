export type KnowledgeGraphRelationFamily = 'child' | 'post-requisite' | 'association';
export type KnowledgeGraphRelationDirection = 'parent-to-child' | 'earlier-to-later' | 'unordered';

export type KnowledgeGraphRelationDensityPolicy =
  | {
    defaultVisible: boolean;
    scope: 'all-eligible';
  }
  | {
    beforeSelection: 0;
    defaultVisible: boolean;
    maxEdges: 24;
    orderBy: readonly ['strength-desc', 'stable-id'];
    scope: 'selected-one-hop';
  };

export interface KnowledgeGraphRelationContract {
  aliases: readonly string[];
  authoringGrammar?: {
    en: string;
    zh: string;
  };
  canonicalType: string;
  densityPolicy: KnowledgeGraphRelationDensityPolicy;
  detailSentence: {
    source: string;
    target: string;
  };
  direction: KnowledgeGraphRelationDirection;
  family: KnowledgeGraphRelationFamily;
}

export interface RawKnowledgeGraphRelation {
  [key: string]: unknown;
  id?: unknown;
  relation?: unknown;
  relationId?: unknown;
  relationType?: unknown;
  relation_id?: unknown;
  relation_type?: unknown;
  sourceId?: unknown;
  source_id?: unknown;
  strength?: unknown;
  targetId?: unknown;
  target_id?: unknown;
  type?: unknown;
}

export type KnowledgeGraphRelationDiagnosticCode =
  | 'DUPLICATE_RELATION_ID'
  | 'EMPTY_RELATION_TYPE'
  | 'INVALID_RELATION_FIELD_FAMILY'
  | 'INVALID_SYNTHETIC_CHAPTER_LINK'
  | 'MISSING_RELATION_ENDPOINT'
  | 'MISSING_RELATION_ID'
  | 'INVALID_RELATION_ENDPOINT_ENCODING'
  | 'REVERSE_CHILD_RELATION'
  | 'SELF_CHILD_RELATION'
  | 'SYNTHETIC_CHAPTER_LINK_EXCLUDED'
  | 'UNKNOWN_RELATION_TYPE';

export interface KnowledgeGraphRelationDiagnostic {
  blocking: boolean;
  code: KnowledgeGraphRelationDiagnosticCode;
  fieldFamily?: 'id' | 'source' | 'target' | 'type';
  message: string;
  relationIds: string[];
}

export interface ContributingKnowledgeGraphRelation<
  T extends RawKnowledgeGraphRelation = RawKnowledgeGraphRelation,
> {
  canonicalType: string;
  detailSentence: KnowledgeGraphRelationContract['detailSentence'];
  direction: KnowledgeGraphRelationDirection;
  evidenceState: 'available' | 'unavailable';
  evidenceText: string;
  family: KnowledgeGraphRelationFamily;
  rawRelation: T;
  rawType: string;
  relationId: string;
  sourceId: string;
  strength: number | null;
  targetId: string;
  visualKey: string;
}

export interface KnowledgeGraphVisualEdge<
  T extends RawKnowledgeGraphRelation = RawKnowledgeGraphRelation,
> {
  contributingRelations: ContributingKnowledgeGraphRelation<T>[];
  densityPolicy: KnowledgeGraphRelationDensityPolicy;
  direction: KnowledgeGraphRelationDirection;
  family: KnowledgeGraphRelationFamily;
  key: string;
  sourceId: string;
  strength: number | null;
  strengthPolicy: 'max-contributing-strength';
  targetId: string;
}

export interface KnowledgeGraphRelationProjectionResult<
  T extends RawKnowledgeGraphRelation = RawKnowledgeGraphRelation,
> {
  blocked: boolean;
  contributingRelations: ContributingKnowledgeGraphRelation<T>[];
  contributingRelationsUse: 'diagnostics-only' | 'renderer-input';
  diagnostics: KnowledgeGraphRelationDiagnostic[];
  visualEdges: KnowledgeGraphVisualEdge<T>[];
}

const CHILD_DENSITY_POLICY = {
  defaultVisible: false,
  scope: 'all-eligible',
} as const;

const POST_DENSITY_POLICY = {
  defaultVisible: true,
  scope: 'all-eligible',
} as const;

const ASSOCIATION_DENSITY_POLICY = {
  beforeSelection: 0,
  defaultVisible: true,
  maxEdges: 24,
  orderBy: ['strength-desc', 'stable-id'],
  scope: 'selected-one-hop',
} as const;

export const KNOWLEDGE_GRAPH_RELATION_RUNTIME_SCHEMA_COMPATIBILITY = {
  allowedDuplicateIdFields: ['id', 'relation_id'],
  requireExactNonBlankMatch: true,
  whitespacePolicy: 'reject-unicode-s',
} as const;

const ALIASES_BY_CANONICAL_TYPE: Record<string, readonly string[]> = {
  applies_to: ['电路应用'],
  cross_domain: ['机电类比'],
  generalizes: ['非线性扩展'],
  informs: ['explains'],
  instance_of: ['example'],
  leads_to: ['引出机械建模', '引出电路建模'],
  provides_foundation: ['建模基础'],
  related: ['defines', 'governs', 'implements', 'influences'],
};

function defineContract(input: Omit<KnowledgeGraphRelationContract, 'aliases'>): KnowledgeGraphRelationContract {
  return {
    ...input,
    aliases: ALIASES_BY_CANONICAL_TYPE[input.canonicalType] ?? [],
  };
}

const CONTRACTS = [
  defineContract({
    canonicalType: 'contains',
    family: 'child',
    direction: 'parent-to-child',
    densityPolicy: CHILD_DENSITY_POLICY,
    detailSentence: {
      source: '本节点包含目标子级',
      target: '本节点隶属于来源父级',
    },
  }),
  defineContract({
    canonicalType: 'prerequisite',
    family: 'post-requisite',
    direction: 'earlier-to-later',
    densityPolicy: POST_DENSITY_POLICY,
    detailSentence: {
      source: '本节点是目标节点的先修知识',
      target: '学习本节点前应先掌握来源节点',
    },
  }),
  defineContract({
    canonicalType: 'provides_foundation',
    family: 'post-requisite',
    direction: 'earlier-to-later',
    densityPolicy: POST_DENSITY_POLICY,
    detailSentence: {
      source: '本节点为目标节点提供学习基础',
      target: '本节点建立在来源节点的基础上',
    },
  }),
  defineContract({
    canonicalType: 'follows',
    family: 'post-requisite',
    direction: 'earlier-to-later',
    densityPolicy: POST_DENSITY_POLICY,
    authoringGrammar: {
      en: 'source is followed by target',
      zh: 'target 是 source 的学习后续',
    },
    detailSentence: {
      source: '本节点之后学习目标节点',
      target: '本节点是来源节点的学习后续',
    },
  }),
  defineContract({
    canonicalType: 'leads_to',
    family: 'post-requisite',
    direction: 'earlier-to-later',
    densityPolicy: POST_DENSITY_POLICY,
    detailSentence: {
      source: '本节点引出目标节点',
      target: '本节点由来源节点引出',
    },
  }),
  ...([
    ['applies_to', '本节点可应用于目标', '本节点可接受来源方法的应用'],
    ['opposite', '本节点与另一节点语义相反', '本节点与另一节点语义相反'],
    ['related', '本节点与另一节点相关', '本节点与另一节点相关'],
    ['cross_domain', '本节点迁移到目标领域概念', '本节点承接来源概念的跨域迁移'],
    ['generalizes', '本节点抽象推广为目标', '本节点由来源概念抽象推广得到'],
    ['instance_of', '本节点是目标一般概念的实例', '本节点包含来源这一具体实例'],
    ['supports', '本节点支撑目标结论', '本节点由来源证据或概念支撑'],
    ['enables', '掌握本节点可启用目标任务或概念', '本节点由来源概念启用'],
    ['complements', '本节点与另一节点形成互补', '本节点与另一节点形成互补'],
    ['contrasts_with', '本节点与另一节点形成对照', '本节点与另一节点形成对照'],
    ['derives', '本节点推导得到目标', '本节点由来源推导得到'],
    ['describes_migration_of', '本节点描述目标的迁移', '本节点的迁移由来源描述'],
    ['determines', '本节点决定或约束目标', '本节点由来源决定或约束'],
    ['embodies', '本节点与另一节点共同体现相关概念', '本节点与另一节点共同体现相关概念'],
    ['informs', '本节点为目标提供提示', '本节点接收来源提示'],
    ['quantified_by', '本节点由目标指标或图形量化', '本节点用于量化来源概念'],
    ['uses', '本节点使用目标方法或工具', '本节点被来源任务或概念使用'],
    ['visualized_by', '本节点由目标图形呈现', '本节点用于呈现来源概念'],
  ] as const).map(([canonicalType, source, target]) => defineContract({
    canonicalType,
    family: 'association',
    direction: 'unordered',
    densityPolicy: ASSOCIATION_DENSITY_POLICY,
    detailSentence: { source, target },
  })),
] satisfies KnowledgeGraphRelationContract[];

export const KNOWLEDGE_GRAPH_RELATION_CONTRACTS: readonly KnowledgeGraphRelationContract[] = CONTRACTS;

const CONTRACT_BY_INPUT_TYPE = new Map<string, KnowledgeGraphRelationContract>();
CONTRACTS.forEach((contract) => {
  CONTRACT_BY_INPUT_TYPE.set(contract.canonicalType, contract);
  contract.aliases.forEach((alias) => CONTRACT_BY_INPUT_TYPE.set(alias, contract));
});

export function getKnowledgeGraphRelationContract(
  rawType: string | null | undefined
): KnowledgeGraphRelationContract | null {
  if (typeof rawType !== 'string') return null;
  const normalizedInput = rawType.trim();
  if (!normalizedInput) return null;
  return CONTRACT_BY_INPUT_TYPE.get(normalizedInput) ?? null;
}

type RelationFieldFamily = 'id' | 'source' | 'target' | 'type';

const RELATION_FIELD_KEYS: Record<RelationFieldFamily, readonly string[]> = {
  id: ['id', 'relationId', 'relation_id'],
  source: ['sourceId', 'source_id'],
  target: ['targetId', 'target_id'],
  type: ['type', 'relationType', 'relation_type', 'relation'],
};

function resolveRelationFieldFamily(
  relation: RawKnowledgeGraphRelation,
  fieldFamily: RelationFieldFamily,
  diagnostics: KnowledgeGraphRelationDiagnostic[],
  relationIds: string[]
): string | null {
  const presentFields = RELATION_FIELD_KEYS[fieldFamily]
    .filter((key) => Object.prototype.hasOwnProperty.call(relation, key));
  const values = presentFields.map((key) => relation[key]);
  const compatibilityFields = KNOWLEDGE_GRAPH_RELATION_RUNTIME_SCHEMA_COMPATIBILITY.allowedDuplicateIdFields;
  const isRuntimeIdCompatibilityPair = fieldFamily === 'id'
    && presentFields.length === compatibilityFields.length
    && compatibilityFields.every((key) => presentFields.includes(key))
    && values.every((value) => typeof value === 'string')
    && values[0] === values[1]
    && values[0] !== ''
    && !/\s/u.test(values[0] as string)
    && (values[0] as string).trim() === values[0];

  if (isRuntimeIdCompatibilityPair) return values[0] as string;
  if (presentFields.length !== 1) {
    diagnostics.push({
      blocking: true,
      code: 'INVALID_RELATION_FIELD_FAMILY',
      fieldFamily,
      message: `Relation ${fieldFamily} must use exactly one field alias.`,
      relationIds,
    });
    return null;
  }

  const value = values[0];
  if (typeof value !== 'string' || value.length === 0 || value.trim() !== value) {
    const code = fieldFamily === 'type'
      ? 'EMPTY_RELATION_TYPE'
      : fieldFamily === 'id'
        ? 'MISSING_RELATION_ID'
        : 'MISSING_RELATION_ENDPOINT';
    diagnostics.push({
      blocking: true,
      code,
      fieldFamily,
      message: `Relation ${fieldFamily} must be a non-blank exact string.`,
      relationIds,
    });
    return null;
  }
  return value;
}

function getStrength(relation: RawKnowledgeGraphRelation): number | null {
  return typeof relation.strength === 'number' && Number.isFinite(relation.strength)
    ? relation.strength
    : null;
}

function hasMeaningfulValue(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  if (Array.isArray(value)) return value.some(hasMeaningfulValue);
  if (typeof value === 'object') return Object.values(value).some(hasMeaningfulValue);
  return true;
}

function hasAvailableEvidence(relation: RawKnowledgeGraphRelation): boolean {
  return ['rationale', 'evidence', 'sourceDocument', 'sourceMetadata', 'provenance']
    .some((key) => hasMeaningfulValue(relation[key]));
}

function encodeKeyPart(value: string): string {
  return encodeURIComponent(value);
}

function compareUtf16CodeUnits(left: string, right: string): number {
  if (left === right) return 0;
  return left < right ? -1 : 1;
}

function hasWellFormedUtf16(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const codeUnit = value.charCodeAt(index);
    if (codeUnit >= 0xd800 && codeUnit <= 0xdbff) {
      if (index + 1 >= value.length) return false;
      const nextCodeUnit = value.charCodeAt(index + 1);
      if (nextCodeUnit < 0xdc00 || nextCodeUnit > 0xdfff) return false;
      index += 1;
    } else if (codeUnit >= 0xdc00 && codeUnit <= 0xdfff) {
      return false;
    }
  }
  return true;
}

function getVisualKey(
  family: KnowledgeGraphRelationFamily,
  sourceId: string,
  targetId: string
): string {
  if (family === 'association') {
    const [first, second] = [sourceId, targetId].sort(compareUtf16CodeUnits);
    return `association|${encodeKeyPart(first)}|${encodeKeyPart(second)}`;
  }
  const prefix = family === 'child' ? 'child' : 'post';
  return `${prefix}|${encodeKeyPart(sourceId)}|${encodeKeyPart(targetId)}`;
}

function diagnostic(
  code: KnowledgeGraphRelationDiagnosticCode,
  blocking: boolean,
  relationIds: string[],
  message: string
): KnowledgeGraphRelationDiagnostic {
  return { blocking, code, message, relationIds };
}

export function projectKnowledgeGraphRelations<T extends RawKnowledgeGraphRelation>(
  relations: readonly T[]
): KnowledgeGraphRelationProjectionResult<T> {
  const diagnostics: KnowledgeGraphRelationDiagnostic[] = [];
  const candidates = relations.flatMap((rawRelation) => {
    const relationId = resolveRelationFieldFamily(rawRelation, 'id', diagnostics, []);
    const relationIds = relationId ? [relationId] : [];
    const rawType = resolveRelationFieldFamily(rawRelation, 'type', diagnostics, relationIds);
    const sourceId = resolveRelationFieldFamily(rawRelation, 'source', diagnostics, relationIds);
    const targetId = resolveRelationFieldFamily(rawRelation, 'target', diagnostics, relationIds);
    if (!relationId || !rawType || !sourceId || !targetId) return [];
    if (!hasWellFormedUtf16(sourceId) || !hasWellFormedUtf16(targetId)) {
      diagnostics.push(diagnostic(
        'INVALID_RELATION_ENDPOINT_ENCODING',
        true,
        [relationId],
        'Relation source and target ids must contain well-formed UTF-16 strings.'
      ));
      return [];
    }
    return [{ rawRelation, rawType, relationId, sourceId, targetId }];
  });

  const relationIdCounts = new Map<string, number>();
  candidates.forEach(({ relationId }) => {
    if (!relationId) return;
    relationIdCounts.set(relationId, (relationIdCounts.get(relationId) ?? 0) + 1);
  });
  const duplicateIds = new Set(
    Array.from(relationIdCounts.entries())
      .filter(([, count]) => count > 1)
      .map(([relationId]) => relationId)
  );
  duplicateIds.forEach((relationId) => {
    diagnostics.push(diagnostic(
      'DUPLICATE_RELATION_ID',
      true,
      [relationId],
      `Relation id "${relationId}" is duplicated.`
    ));
  });

  const contributingRelations: ContributingKnowledgeGraphRelation<T>[] = [];
  candidates.forEach(({ rawRelation, rawType, relationId, sourceId, targetId }) => {
    if (duplicateIds.has(relationId)) return;

    const looksSynthetic = relationId.startsWith('chapter-link:') || sourceId.startsWith('chapter-node:');
    if (looksSynthetic) {
      const expectedId = `chapter-link:${sourceId}->${targetId}`;
      if (sourceId.startsWith('chapter-node:')
        && rawType === 'contains'
        && relationId === expectedId) {
        diagnostics.push(diagnostic(
          'SYNTHETIC_CHAPTER_LINK_EXCLUDED',
          false,
          [relationId],
          'Synthetic chapter membership is navigation metadata and is excluded from relation projection.'
        ));
      } else {
        diagnostics.push(diagnostic(
          'INVALID_SYNTHETIC_CHAPTER_LINK',
          true,
          [relationId],
          'Chapter membership must match the exact synthetic id, source, target, and contains contract.'
        ));
      }
      return;
    }

    const contract = getKnowledgeGraphRelationContract(rawType);
    if (!contract) {
      diagnostics.push(diagnostic(
        'UNKNOWN_RELATION_TYPE',
        true,
        [relationId],
        `Relation type "${rawType}" is not registered.`
      ));
      return;
    }

    if (contract.family === 'child' && sourceId === targetId) {
      diagnostics.push(diagnostic(
        'SELF_CHILD_RELATION',
        true,
        [relationId],
        'A contains relation cannot use the same node as parent and child.'
      ));
      return;
    }

    const evidenceAvailable = hasAvailableEvidence(rawRelation);
    contributingRelations.push({
      canonicalType: contract.canonicalType,
      detailSentence: contract.detailSentence,
      direction: contract.direction,
      evidenceState: evidenceAvailable ? 'available' : 'unavailable',
      evidenceText: evidenceAvailable ? '关系依据可用' : '关系依据未提供',
      family: contract.family,
      rawRelation,
      rawType,
      relationId,
      sourceId,
      strength: getStrength(rawRelation),
      targetId,
      visualKey: getVisualKey(contract.family, sourceId, targetId),
    });
  });

  const edgesByKey = new Map<string, KnowledgeGraphVisualEdge<T>>();
  contributingRelations.forEach((relation) => {
    const existing = edgesByKey.get(relation.visualKey);
    if (existing) {
      existing.contributingRelations.push(relation);
      if (relation.strength !== null && (existing.strength === null || relation.strength > existing.strength)) {
        existing.strength = relation.strength;
      }
      return;
    }
    const contract = CONTRACT_BY_INPUT_TYPE.get(relation.canonicalType)!;
    const [sourceId, targetId] = relation.family === 'association'
      ? [relation.sourceId, relation.targetId].sort(compareUtf16CodeUnits)
      : [relation.sourceId, relation.targetId];
    edgesByKey.set(relation.visualKey, {
      contributingRelations: [relation],
      densityPolicy: contract.densityPolicy,
      direction: relation.direction,
      family: relation.family,
      key: relation.visualKey,
      sourceId,
      strength: relation.strength,
      strengthPolicy: 'max-contributing-strength',
      targetId,
    });
  });

  const blockedChildKeys = new Set<string>();
  const reportedChildPairs = new Set<string>();
  edgesByKey.forEach((edge) => {
    if (edge.family !== 'child' || edge.sourceId === edge.targetId) return;
    const reverseKey = getVisualKey('child', edge.targetId, edge.sourceId);
    const reverseEdge = edgesByKey.get(reverseKey);
    if (!reverseEdge) return;
    const pairKey = [edge.key, reverseKey].sort().join('\n');
    blockedChildKeys.add(edge.key);
    blockedChildKeys.add(reverseKey);
    if (reportedChildPairs.has(pairKey)) return;
    reportedChildPairs.add(pairKey);
    diagnostics.push(diagnostic(
      'REVERSE_CHILD_RELATION',
      true,
      [edge, reverseEdge].flatMap((item) => item.contributingRelations.map((relation) => relation.relationId)),
      'Reverse child relations are invalid canonical membership and neither direction can render.'
    ));
  });

  const blocked = diagnostics.some((item) => item.blocking);
  const visualEdges = blocked
    ? []
    : Array.from(edgesByKey.values()).filter((edge) => !blockedChildKeys.has(edge.key));
  return {
    blocked,
    contributingRelations,
    contributingRelationsUse: blocked ? 'diagnostics-only' : 'renderer-input',
    diagnostics,
    visualEdges,
  };
}
