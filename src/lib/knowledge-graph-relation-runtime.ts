import {
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
  };
  relation: string;
  relationType: string;
  sourceId: string;
  strength: number;
  targetId: string;
}

export interface RuntimeKnowledgeRelationCoverageReport {
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
  relationId: string;
  sourceDocument?: string;
  sourceId: string;
  sourceMetadata?: Record<string, string | number>;
  strength: number;
  targetId: string;
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

export function inspectRuntimeKnowledgeRelationCoverage(
  content: string,
  options: { nodeIds?: ReadonlySet<string> } = {}
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
  const diagnostics = [
    ...parsed.diagnostics,
    ...emptyDiagnostics,
    ...projection.diagnostics.map(normalizeProjectionDiagnostic),
    ...unresolvedEndpointDiagnostics(projection.contributingRelations, options.nodeIds),
    ...cycles,
  ];
  const blocking = diagnostics.some((item) => item.blocking);
  const cycleRelationIds = new Set(cycles.flatMap((item) => item.relationIds));
  const coverage = buildCoverage();
  const stageAgreement = coverage.every((item) => new Set(Object.values(item.stages)).size === 1);
  const inspectionLinks = blocking ? [] : projection.contributingRelations.map((relation) => ({
    id: relation.relationId,
    motionEligible: !cycleRelationIds.has(relation.relationId),
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
      motionEligible: contributing.every((relation) => !cycleRelationIds.has(relation.relationId)),
      sourceId: edge.sourceId,
      strength: edge.strength ?? 1,
      targetId: edge.targetId,
    };
  });
  const report = {
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
    const evidenceState: RuntimeKnowledgeRelationInspectionItem['evidenceState'] = Object.keys(evidenceSummary).length > 0
      ? 'available'
      : 'unavailable';
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
      ...evidenceSummary,
      relationId: link.id,
      sourceId: link.sourceId,
      strength: link.strength,
      targetId: link.targetId,
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
  'sourceChapter',
  'source_chapter',
  'targetChapter',
  'target_chapter',
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
  const rawSourceMetadata = relation.sourceMetadata && typeof relation.sourceMetadata === 'object'
    && !Array.isArray(relation.sourceMetadata)
    ? relation.sourceMetadata as Record<string, unknown>
    : {};
  const sourceMetadata = summarizeSourceMetadata({
    ...rawSourceMetadata,
    ...(relation.source_chapter !== undefined ? { source_chapter: relation.source_chapter } : {}),
    ...(relation.target_chapter !== undefined ? { target_chapter: relation.target_chapter } : {}),
    ...(relation.sourceChapter !== undefined ? { sourceChapter: relation.sourceChapter } : {}),
    ...(relation.targetChapter !== undefined ? { targetChapter: relation.targetChapter } : {}),
  });
  return {
    ...(rationale ? { rationale } : {}),
    ...(sourceDocument ? { sourceDocument } : {}),
    ...(sourceMetadata ? { sourceMetadata } : {}),
  };
}
