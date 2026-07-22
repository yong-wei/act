import {
  deriveKnowledgeGraphRelationEvidenceState,
  KNOWLEDGE_GRAPH_RELATION_CONTRACTS,
  projectKnowledgeGraphRelations,
  type ContributingKnowledgeGraphRelation,
  type KnowledgeGraphRelationDiagnostic,
  type KnowledgeGraphRelationProjectionResult,
  type RawKnowledgeGraphRelation,
} from '@/features/knowledge/graph/relation-contract';
import { getRelationLabel } from '@/lib/knowledge-labels';

type RelationCoverageStage = 'loading' | 'labeling' | 'projection' | 'inspection';

function stableStringCompare(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

export interface RuntimeKnowledgeRelationDiagnostic {
  blocking: boolean;
  code: string;
  line?: number;
  message: string;
  motionEligible?: false;
  nodeIds?: string[];
  relationIds: string[];
  stage: RelationCoverageStage;
  stages?: RelationCoverageStage[];
}

export interface RuntimeKnowledgeRelationLink {
  id: string;
  motionEligible: boolean;
  provenance: {
    canonicalType: string;
    detailSentence: ContributingKnowledgeGraphRelation['detailSentence'];
    evidenceState: ContributingKnowledgeGraphRelation['evidenceState'];
    evidenceText: string;
    rawRelation: RawKnowledgeGraphRelation;
    rawType: string;
    relationId: string;
    sourceId: string;
    targetId: string;
    visualKey: string;
  };
  relation: string;
  relationType: string;
  sourceId: string;
  strength: number;
  targetId: string;
}

export interface RuntimeKnowledgeRelationCoverageReport {
  contractCoverage: RuntimeKnowledgeRelationContractCoverage[];
  coverage: Array<{
    canonicalType: string;
    inputTypes: string[];
    stages: Record<RelationCoverageStage, string>;
  }>;
  counts: {
    inputLines: number;
    parsedRelations: number;
    projectedRelations: number;
    visualEdges: number;
  };
  diagnostics: RuntimeKnowledgeRelationDiagnostic[];
  ok: boolean;
  stageAgreement: boolean;
}

export interface RuntimeKnowledgeRelationContractCoverage {
  evidence: string[];
  failureCodes: string[];
  id: string;
  machineReadable: true;
  status: 'blocked' | 'covered' | 'not-evaluated';
}

type RuntimeKnowledgeRelationContractDefinition = Omit<RuntimeKnowledgeRelationContractCoverage, 'status'>;

const RUNTIME_KNOWLEDGE_RELATION_CONTRACT_DEFINITIONS: RuntimeKnowledgeRelationContractDefinition[] = [
  { id: 'direction', failureCodes: ['REVERSE_CHILD_RELATION'], evidence: ['contract.direction', 'authored-endpoints'], machineReadable: true },
  { id: 'malformed-input', failureCodes: ['MALFORMED_RELATION_JSONL'], evidence: ['diagnostic.line', 'diagnostic.stage'], machineReadable: true },
  { id: 'duplicate-id', failureCodes: ['DUPLICATE_RELATION_ID'], evidence: ['diagnostic.relationIds'], machineReadable: true },
  { id: 'chapter-link-exclusion', failureCodes: ['SYNTHETIC_CHAPTER_LINK_EXCLUDED', 'INVALID_SYNTHETIC_CHAPTER_LINK'], evidence: ['navigation-metadata-only'], machineReadable: true },
  { id: 'order-source', failureCodes: ['ORDER_SOURCE_NOT_POST_REQUISITE'], evidence: [], machineReadable: true },
  { id: 'density', failureCodes: ['ASSOCIATION_DENSITY_MISMATCH'], evidence: [], machineReadable: true },
  { id: 'cycle', failureCodes: ['POST_REQUISITE_CYCLE'], evidence: ['motionEligible=false', 'diagnostic.nodeIds'], machineReadable: true },
  { id: 'provenance', failureCodes: ['PROVENANCE_MISMATCH'], evidence: [], machineReadable: true },
  { id: 'overlay-triple-eligibility', failureCodes: ['OVERLAY_TRIPLE_INELIGIBLE'], evidence: [], machineReadable: true },
  { id: 'unknown-type', failureCodes: ['UNKNOWN_RELATION_TYPE'], evidence: ['all-stages-blocking'], machineReadable: true },
];

export const RUNTIME_KNOWLEDGE_RELATION_CONTRACT_COVERAGE: RuntimeKnowledgeRelationContractCoverage[] =
  RUNTIME_KNOWLEDGE_RELATION_CONTRACT_DEFINITIONS.map((definition) => ({
    ...definition,
    status: 'not-evaluated',
  }));

export interface RuntimeKnowledgeRelationAuditExpectation {
  canonicalType: string;
  relationId: string;
  sourceId: string;
  targetId: string;
}

export interface RuntimeKnowledgeRelationAuditInput {
  schemaVersion: 1;
  orderSource: { relationIds: string[] };
  density: { selectedNodeId: string; visibleAssociationRelationIds: string[] };
  provenance: RuntimeKnowledgeRelationAuditExpectation[];
  overlayTripleEligibility: Array<Omit<RuntimeKnowledgeRelationAuditExpectation, 'canonicalType'> & {
    normalizedType: string;
  }>;
}

export interface RuntimeKnowledgeRelationCoverageResult {
  inspectionLinks: RuntimeKnowledgeRelationLink[];
  projection: KnowledgeGraphRelationProjectionResult<RawKnowledgeGraphRelation>;
  report: RuntimeKnowledgeRelationCoverageReport;
  runtimeLinks: RuntimeKnowledgeRelationLink[];
}

export interface RuntimeKnowledgeRelationInspectionItem {
  canonicalType: string;
  cycleState?: 'cyclic';
  category: 'membership' | 'prerequisite' | 'follows' | 'related';
  direction: 'parent-to-child' | 'earlier-to-later' | 'unordered';
  evidenceState: 'available' | 'unavailable';
  family: 'child' | 'post-requisite' | 'association';
  id: string;
  inspectionSentence: string;
  name: string;
  nodeType: string;
  rationale?: string;
  rawType: string;
  relationId: string;
  sourceDocument?: string;
  sourceChapter?: string | number;
  sourceId: string;
  sourceMetadata?: Record<string, string | number>;
  strength: number;
  targetChapter?: string | number;
  targetId: string;
  visualMergeCount: number;
  visualMergeKey: string;
}

export class RuntimeKnowledgeRelationCoverageError extends Error {
  constructor(public readonly report: RuntimeKnowledgeRelationCoverageReport) {
    super('Runtime knowledge relation coverage is blocked.');
    this.name = 'RuntimeKnowledgeRelationCoverageError';
  }
}

const MAX_PUBLIC_DIAGNOSTICS = 100;
export const PUBLIC_DIAGNOSTICS_BYTE_BUDGET = 64_000;

export function toPublicRuntimeKnowledgeDiagnostics(report: RuntimeKnowledgeRelationCoverageReport) {
  const diagnostics: Array<Record<string, unknown>> = [];
  for (const item of report.diagnostics.slice(0, MAX_PUBLIC_DIAGNOSTICS)) {
    const candidate = {
      blocking: item.blocking,
      code: item.code.slice(0, 100),
      ...(typeof item.line === 'number' ? { line: item.line } : {}),
      message: item.message.slice(0, 500),
      ...(item.motionEligible === false ? { motionEligible: false as const } : {}),
      ...(item.nodeIds ? { nodeIds: item.nodeIds.slice(0, 50).map((id) => id.slice(0, 200)) } : {}),
      relationIds: item.relationIds.slice(0, 50).map((id) => id.slice(0, 200)),
      stage: item.stage,
      ...(item.stages ? { stages: item.stages } : {}),
    };
    if (Buffer.byteLength(JSON.stringify({ diagnostics: [...diagnostics, candidate], truncated: true }), 'utf8')
      > PUBLIC_DIAGNOSTICS_BYTE_BUDGET - 1_000) break;
    diagnostics.push(candidate);
  }
  return {
    diagnostics,
    truncated: diagnostics.length < report.diagnostics.length,
  };
}

function parseJsonl(content: string): {
  diagnostics: RuntimeKnowledgeRelationDiagnostic[];
  inputLines: number;
  relations: RawKnowledgeGraphRelation[];
} {
  const diagnostics: RuntimeKnowledgeRelationDiagnostic[] = [];
  const relations: RawKnowledgeGraphRelation[] = [];
  let inputLines = 0;

  content.split('\n').forEach((line, index) => {
    if (!line.trim()) return;
    inputLines += 1;
    try {
      const parsed = JSON.parse(line) as unknown;
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error('JSONL row must be an object.');
      }
      relations.push(parsed as RawKnowledgeGraphRelation);
    } catch (error) {
      diagnostics.push({
        blocking: true,
        code: 'MALFORMED_RELATION_JSONL',
        line: index + 1,
        message: error instanceof Error ? error.message : 'Relation JSONL row is malformed.',
        relationIds: [],
        stage: 'loading',
        stages: ['loading', 'labeling', 'projection', 'inspection'],
      });
    }
  });

  return { diagnostics, inputLines, relations };
}

function normalizeProjectionDiagnostic(
  item: KnowledgeGraphRelationDiagnostic
): RuntimeKnowledgeRelationDiagnostic {
  const stage = item.code === 'REVERSE_CHILD_RELATION'
    || item.code === 'SYNTHETIC_CHAPTER_LINK_EXCLUDED'
    || item.code === 'INVALID_SYNTHETIC_CHAPTER_LINK'
    ? 'projection'
    : 'loading';
  return {
    blocking: item.blocking,
    code: item.code,
    message: item.message,
    relationIds: item.relationIds,
    stage,
    stages: item.blocking ? ['loading', 'labeling', 'projection', 'inspection'] : [stage],
  };
}

function findPostRequisiteCycles(
  relations: readonly ContributingKnowledgeGraphRelation[]
): RuntimeKnowledgeRelationDiagnostic[] {
  const postRelations = relations.filter((relation) => relation.family === 'post-requisite');
  const adjacency = new Map<string, string[]>();
  postRelations.forEach((relation) => {
    const targets = adjacency.get(relation.sourceId) ?? [];
    targets.push(relation.targetId);
    adjacency.set(relation.sourceId, targets);
    if (!adjacency.has(relation.targetId)) adjacency.set(relation.targetId, []);
  });

  let nextIndex = 0;
  const indices = new Map<string, number>();
  const lowLinks = new Map<string, number>();
  const stack: string[] = [];
  const onStack = new Set<string>();
  const components: string[][] = [];

  const visit = (nodeId: string) => {
    indices.set(nodeId, nextIndex);
    lowLinks.set(nodeId, nextIndex);
    nextIndex += 1;
    stack.push(nodeId);
    onStack.add(nodeId);

    for (const targetId of adjacency.get(nodeId) ?? []) {
      if (!indices.has(targetId)) {
        visit(targetId);
        lowLinks.set(nodeId, Math.min(lowLinks.get(nodeId)!, lowLinks.get(targetId)!));
      } else if (onStack.has(targetId)) {
        lowLinks.set(nodeId, Math.min(lowLinks.get(nodeId)!, indices.get(targetId)!));
      }
    }

    if (lowLinks.get(nodeId) !== indices.get(nodeId)) return;
    const component: string[] = [];
    let currentId: string;
    do {
      currentId = stack.pop()!;
      onStack.delete(currentId);
      component.push(currentId);
    } while (currentId !== nodeId);
    components.push(component);
  };

  Array.from(adjacency.keys()).sort().forEach((nodeId) => {
    if (!indices.has(nodeId)) visit(nodeId);
  });

  return components.flatMap((component) => {
    const nodeIds = [...component].sort();
    const nodeIdSet = new Set(nodeIds);
    const componentRelations = postRelations.filter((relation) => (
      nodeIdSet.has(relation.sourceId) && nodeIdSet.has(relation.targetId)
    ));
    const hasSelfLoop = componentRelations.some((relation) => relation.sourceId === relation.targetId);
    if (nodeIds.length < 2 && !hasSelfLoop) return [];
    return [{
      blocking: false,
      code: 'POST_REQUISITE_CYCLE',
      message: '需共同理解或待审查',
      motionEligible: false,
      nodeIds,
      relationIds: componentRelations.map((relation) => relation.relationId).sort(),
      stage: 'projection' as const,
      stages: ['projection', 'inspection'] as RelationCoverageStage[],
    }];
  });
}

function buildCoverage() {
  return KNOWLEDGE_GRAPH_RELATION_CONTRACTS.map((contract) => {
    const signature = [
      contract.canonicalType,
      contract.family,
      contract.direction,
      getRelationLabel(contract.canonicalType),
      contract.detailSentence.source,
      contract.detailSentence.target,
    ].join('|');
    return {
      canonicalType: contract.canonicalType,
      inputTypes: [contract.canonicalType, ...contract.aliases],
      stages: {
        loading: signature,
        labeling: signature,
        projection: signature,
        inspection: signature,
      },
    };
  });
}

function unresolvedEndpointDiagnostics(
  relations: readonly ContributingKnowledgeGraphRelation[],
  nodeIds?: ReadonlySet<string>
): RuntimeKnowledgeRelationDiagnostic[] {
  if (!nodeIds) return [];
  return relations.flatMap((relation) => {
    const missingNodeIds = [relation.sourceId, relation.targetId].filter((nodeId) => !nodeIds.has(nodeId));
    if (missingNodeIds.length === 0) return [];
    return [{
      blocking: true,
      code: 'UNRESOLVED_RELATION_ENDPOINT',
      message: `Relation endpoint is absent from the runtime node set: ${missingNodeIds.join(', ')}`,
      nodeIds: missingNodeIds,
      relationIds: [relation.relationId],
      stage: 'loading' as const,
      stages: ['loading', 'labeling', 'projection', 'inspection'] as RelationCoverageStage[],
    }];
  });
}

const AUDIT_CONTRACT_IDS = new Set([
  'order-source',
  'density',
  'provenance',
  'overlay-triple-eligibility',
]);

function auditDiagnostic(
  code: string,
  message: string,
  relationIds: string[]
): RuntimeKnowledgeRelationDiagnostic {
  return {
    blocking: true,
    code,
    message,
    relationIds,
    stage: 'projection',
    stages: ['projection', 'inspection'],
  };
}

function inspectRelationAuditInput(
  input: RuntimeKnowledgeRelationAuditInput,
  relations: readonly ContributingKnowledgeGraphRelation[]
): { diagnostics: RuntimeKnowledgeRelationDiagnostic[]; evidenceByContractId: Map<string, string[]> } {
  const diagnostics: RuntimeKnowledgeRelationDiagnostic[] = [];
  const evidenceByContractId = new Map<string, string[]>();
  const relationById = new Map(relations.map((relation) => [relation.relationId, relation]));

  const invalidOrderRelationIds = input.orderSource.relationIds.filter((relationId) => {
    const relation = relationById.get(relationId);
    return !relation
      || relation.family !== 'post-requisite'
      || relation.direction !== 'earlier-to-later';
  });
  if (input.orderSource.relationIds.length === 0 || invalidOrderRelationIds.length > 0) {
    diagnostics.push(auditDiagnostic(
      'ORDER_SOURCE_NOT_POST_REQUISITE',
      'Every audited teaching-order source must resolve to an authored earlier-to-later post-requisite relation.',
      invalidOrderRelationIds
    ));
  } else {
    evidenceByContractId.set('order-source', input.orderSource.relationIds.map((id) => `relation:${id}`));
  }

  const expectedDensityRelationIds = relations
    .filter((relation) => relation.family === 'association'
      && (relation.sourceId === input.density.selectedNodeId || relation.targetId === input.density.selectedNodeId))
    .sort((left, right) => (
      (right.strength ?? 0) - (left.strength ?? 0)
      || stableStringCompare(left.relationId, right.relationId)
    ))
    .slice(0, 24)
    .map((relation) => relation.relationId);
  if (
    expectedDensityRelationIds.length !== input.density.visibleAssociationRelationIds.length
    || expectedDensityRelationIds.some((id, index) => id !== input.density.visibleAssociationRelationIds[index])
  ) {
    diagnostics.push(auditDiagnostic(
      'ASSOCIATION_DENSITY_MISMATCH',
      `Selected-node association fixture must equal the strongest 24-or-fewer real association relations for ${input.density.selectedNodeId}.`,
      input.density.visibleAssociationRelationIds
    ));
  } else {
    evidenceByContractId.set('density', [
      `selectedNode:${input.density.selectedNodeId}`,
      ...expectedDensityRelationIds.map((id) => `relation:${id}`),
    ]);
  }

  const invalidProvenanceIds = input.provenance.filter((expected) => {
    const relation = relationById.get(expected.relationId);
    return !relation
      || relation.sourceId !== expected.sourceId
      || relation.targetId !== expected.targetId
      || relation.canonicalType !== expected.canonicalType
      || relation.rawRelation === null
      || typeof relation.rawRelation !== 'object';
  }).map((expected) => expected.relationId);
  if (input.provenance.length === 0 || invalidProvenanceIds.length > 0) {
    diagnostics.push(auditDiagnostic(
      'PROVENANCE_MISMATCH',
      'Audited provenance must resolve to the exact real relation id, canonical type, and authored endpoints.',
      invalidProvenanceIds
    ));
  } else {
    evidenceByContractId.set('provenance', input.provenance.map((item) => `relation:${item.relationId}`));
  }

  const invalidOverlayIds = input.overlayTripleEligibility.filter((expected) => {
    const relation = relationById.get(expected.relationId);
    return !relation
      || relation.sourceId !== expected.sourceId
      || relation.targetId !== expected.targetId
      || relation.canonicalType !== expected.normalizedType;
  }).map((expected) => expected.relationId);
  if (input.overlayTripleEligibility.length === 0 || invalidOverlayIds.length > 0) {
    diagnostics.push(auditDiagnostic(
      'OVERLAY_TRIPLE_INELIGIBLE',
      'Every audited overlay triple must match a canonical relation id, normalized type, and authored endpoints.',
      invalidOverlayIds
    ));
  } else {
    evidenceByContractId.set(
      'overlay-triple-eligibility',
      input.overlayTripleEligibility.map((item) => `relation:${item.relationId}`)
    );
  }

  return { diagnostics, evidenceByContractId };
}

function buildContractCoverage(
  diagnostics: readonly RuntimeKnowledgeRelationDiagnostic[],
  auditInput: RuntimeKnowledgeRelationAuditInput | undefined,
  evidenceByContractId: ReadonlyMap<string, string[]>
): RuntimeKnowledgeRelationContractCoverage[] {
  return RUNTIME_KNOWLEDGE_RELATION_CONTRACT_DEFINITIONS.map((definition) => {
    const blocked = diagnostics.some((diagnostic) => (
      diagnostic.blocking && definition.failureCodes.includes(diagnostic.code)
    ));
    const status = blocked
      ? 'blocked'
      : AUDIT_CONTRACT_IDS.has(definition.id) && !auditInput
        ? 'not-evaluated'
        : 'covered';
    return {
      ...definition,
      evidence: evidenceByContractId.get(definition.id) ?? definition.evidence,
      status,
    };
  });
}

export function inspectRuntimeKnowledgeRelationCoverage(
  content: string,
  options: {
    auditInput?: RuntimeKnowledgeRelationAuditInput;
    nodeIds?: ReadonlySet<string>;
  } = {}
): RuntimeKnowledgeRelationCoverageResult {
  const parsed = parseJsonl(content);
  const projection = projectKnowledgeGraphRelations(parsed.relations);
  const emptyDiagnostics: RuntimeKnowledgeRelationDiagnostic[] = parsed.inputLines === 0 ? [{
    blocking: true,
    code: 'EMPTY_RUNTIME_RELATIONS',
    message: 'Runtime knowledge relations must contain at least one canonical relation.',
    relationIds: [],
    stage: 'loading',
    stages: ['loading', 'labeling', 'projection', 'inspection'],
  }] : [];
  const cycles = findPostRequisiteCycles(projection.contributingRelations);
  const audit = options.auditInput
    ? inspectRelationAuditInput(options.auditInput, projection.contributingRelations)
    : { diagnostics: [], evidenceByContractId: new Map<string, string[]>() };
  const diagnostics = [
    ...parsed.diagnostics,
    ...emptyDiagnostics,
    ...projection.diagnostics.map(normalizeProjectionDiagnostic),
    ...unresolvedEndpointDiagnostics(projection.contributingRelations, options.nodeIds),
    ...cycles,
    ...audit.diagnostics,
  ];
  const blocking = diagnostics.some((item) => item.blocking);
  const cycleRelationIds = new Set(cycles.flatMap((item) => item.relationIds));
  const coverage = buildCoverage();
  const stageAgreement = coverage.every((item) => new Set(Object.values(item.stages)).size === 1);
  const contractCoverage = buildContractCoverage(diagnostics, options.auditInput, audit.evidenceByContractId);
  const inspectionLinks = blocking ? [] : projection.contributingRelations.map((relation) => ({
    id: relation.relationId,
    motionEligible: relation.family === 'post-requisite'
      && !cycleRelationIds.has(relation.relationId),
    provenance: {
      canonicalType: relation.canonicalType,
      detailSentence: relation.detailSentence,
      evidenceState: relation.evidenceState,
      evidenceText: relation.evidenceText,
      rawRelation: relation.rawRelation,
      rawType: relation.rawType,
      relationId: relation.relationId,
      sourceId: relation.sourceId,
      targetId: relation.targetId,
      visualKey: relation.visualKey,
    },
    relation: relation.canonicalType,
    relationType: relation.canonicalType,
    sourceId: relation.sourceId,
    strength: relation.strength ?? 1,
    targetId: relation.targetId,
  }));
  const relationById = new Map(inspectionLinks.map((link) => [link.id, link]));
  const runtimeLinks = blocking ? [] : projection.visualEdges.map((edge) => {
    const contributing = [...edge.contributingRelations]
      .sort((left, right) => stableStringCompare(left.relationId, right.relationId));
    const representative = relationById.get(contributing[0]!.relationId)!;
    return {
      ...representative,
      id: edge.key,
      motionEligible: edge.family === 'post-requisite'
        && contributing.every((relation) => !cycleRelationIds.has(relation.relationId)),
      sourceId: edge.sourceId,
      strength: edge.strength ?? 1,
      targetId: edge.targetId,
    };
  });
  const report = {
    contractCoverage,
    coverage,
    counts: {
      inputLines: parsed.inputLines,
      parsedRelations: parsed.relations.length,
      projectedRelations: projection.contributingRelations.length,
      visualEdges: projection.visualEdges.length,
    },
    diagnostics,
    ok: !blocking && stageAgreement,
    stageAgreement,
  };
  return { inspectionLinks, projection, report, runtimeLinks };
}

export function assertRuntimeKnowledgeRelationCoverage(
  content: string,
  options: { nodeIds?: ReadonlySet<string> } = {}
): RuntimeKnowledgeRelationCoverageResult {
  const result = inspectRuntimeKnowledgeRelationCoverage(content, options);
  if (!result.report.ok) throw new RuntimeKnowledgeRelationCoverageError(result.report);
  return result;
}

export function buildRuntimeKnowledgeRelationInspectionItems<T extends {
  id: string;
  name: string;
  nodeType: string;
}>(
  links: readonly RuntimeKnowledgeRelationLink[],
  nodeById: ReadonlyMap<string, T>,
  selectedNodeId: string
): RuntimeKnowledgeRelationInspectionItem[] {
  const visualMergeCountByKey = new Map<string, number>();
  links.forEach((link) => {
    const visualKey = link.provenance.visualKey;
    visualMergeCountByKey.set(visualKey, (visualMergeCountByKey.get(visualKey) ?? 0) + 1);
  });
  return links.flatMap((link) => {
    const isSource = link.sourceId === selectedNodeId;
    const isTarget = link.targetId === selectedNodeId;
    if (!isSource && !isTarget) return [];
    const relatedNode = nodeById.get(isSource ? link.targetId : link.sourceId);
    if (!relatedNode) return [];
    const contract = getKnowledgeGraphContract(link.provenance.canonicalType);
    const family = contract.family;
    const category: RuntimeKnowledgeRelationInspectionItem['category'] = family === 'child'
      ? 'membership'
      : family === 'association'
        ? 'related'
        : isSource
          ? 'follows'
          : 'prerequisite';
    const evidenceSummary = buildAllowedEvidenceSummary(link.provenance.rawRelation);
    const evidenceState = deriveKnowledgeGraphRelationEvidenceState(link.provenance.rawRelation);
    return [{
      canonicalType: contract.canonicalType,
      ...(link.motionEligible === false && family === 'post-requisite'
        ? { cycleState: 'cyclic' as const }
        : {}),
      category,
      direction: contract.direction,
      evidenceState,
      family,
      id: relatedNode.id,
      inspectionSentence: isSource
        ? link.provenance.detailSentence.source
        : link.provenance.detailSentence.target,
      name: relatedNode.name,
      nodeType: relatedNode.nodeType,
      ...buildRelationChapterContext(link.provenance.rawRelation),
      ...evidenceSummary,
      rawType: link.provenance.rawType,
      relationId: link.id,
      sourceId: link.sourceId,
      strength: link.strength,
      targetId: link.targetId,
      visualMergeCount: visualMergeCountByKey.get(link.provenance.visualKey) ?? 1,
      visualMergeKey: link.provenance.visualKey,
    }];
  }).sort((left, right) => right.strength - left.strength || stableStringCompare(left.relationId, right.relationId));
}

function getKnowledgeGraphContract(canonicalType: string) {
  const contract = KNOWLEDGE_GRAPH_RELATION_CONTRACTS.find((item) => item.canonicalType === canonicalType);
  if (!contract) throw new Error(`Unknown knowledge graph relation type: ${canonicalType}`);
  return contract;
}

const SOURCE_METADATA_KEYS = [
  'documentId',
  'page',
  'pageNumber',
  'section',
  'sectionId',
  'sourceType',
  'title',
  'version',
] as const;

function boundedText(value: unknown, maxLength: number): string | undefined {
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim();
  return normalized ? normalized.slice(0, maxLength) : undefined;
}

function summarizeSourceMetadata(value: unknown): Record<string, string | number> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const source = value as Record<string, unknown>;
  const summary: Record<string, string | number> = {};
  SOURCE_METADATA_KEYS.forEach((key) => {
    const item = source[key];
    if (typeof item === 'number' && Number.isFinite(item)) {
      summary[key] = item;
      return;
    }
    const text = boundedText(item, 200);
    if (text) summary[key] = text;
  });
  return Object.keys(summary).length > 0 ? summary : undefined;
}

function buildAllowedEvidenceSummary(relation: RawKnowledgeGraphRelation): {
  rationale?: string;
  sourceDocument?: string;
  sourceMetadata?: Record<string, string | number>;
} {
  const rationale = boundedText(relation.rationale, 500);
  const sourceDocument = boundedText(relation.sourceDocument, 300);
  const sourceMetadata = summarizeSourceMetadata(relation.sourceMetadata);
  return {
    ...(rationale ? { rationale } : {}),
    ...(sourceDocument ? { sourceDocument } : {}),
    ...(sourceMetadata ? { sourceMetadata } : {}),
  };
}

function boundedChapter(value: unknown): string | number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  return boundedText(value, 100);
}

function buildRelationChapterContext(relation: RawKnowledgeGraphRelation): {
  sourceChapter?: string | number;
  targetChapter?: string | number;
} {
  const sourceChapter = boundedChapter(relation.source_chapter ?? relation.sourceChapter);
  const targetChapter = boundedChapter(relation.target_chapter ?? relation.targetChapter);
  return {
    ...(sourceChapter !== undefined ? { sourceChapter } : {}),
    ...(targetChapter !== undefined ? { targetChapter } : {}),
  };
}
