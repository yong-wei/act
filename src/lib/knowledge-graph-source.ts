import 'server-only';

import { createHash } from 'node:crypto';
import fs from 'fs/promises';
import path from 'path';
import { prisma } from '@/lib/prisma';
import { CHAPTER_DISPLAY_ORDER, resolveChapterName } from '@/lib/knowledge-labels';
import {
  assertRuntimeKnowledgeRelationCoverage,
  buildRuntimeKnowledgeRelationInspectionItems,
  RuntimeKnowledgeRelationCoverageError,
  type RuntimeKnowledgeRelationLink,
} from '@/lib/knowledge-graph-relation-runtime';

type NodeType = 'THEORY' | 'SCENARIO' | 'ETHICS';
type BloomLevel = 'REMEMBER' | 'UNDERSTAND' | 'APPLY' | 'ANALYZE' | 'EVALUATE' | 'CREATE';
type KnowledgeDim = 'FACTUAL' | 'CONCEPTUAL' | 'PROCEDURAL' | 'METACOGNITIVE';
type RelatedCategory = 'membership' | 'prerequisite' | 'follows' | 'related';

export interface KnowledgeNodeExpansion {
  state: 'expandable' | 'leaf' | 'unknown';
  revealableNeighborCount?: number;
}

export interface UnifiedKnowledgeNode {
  id: string;
  name: string;
  nodeType: NodeType;
  description: string;
  positionX: number;
  positionY: number;
  positionZ: number;
  bloomLevel?: BloomLevel;
  knowledgeDim?: KnowledgeDim;
  metadata?: Record<string, unknown>;
  content?: Record<string, unknown>;
  resources?: unknown[];
  tags?: string[];
  chapter?: number;
  chapterName?: string;
  expansion?: KnowledgeNodeExpansion;
}

export interface UnifiedKnowledgeLink {
  id: string;
  motionEligible?: boolean;
  provenance?: RuntimeKnowledgeRelationLink['provenance'];
  sourceId: string;
  targetId: string;
  relation: string;
  relationType: string;
  strength: number;
}

export interface PublicKnowledgeGraphLink {
  id: string;
  motionEligible?: false;
  relation: string;
  relationType?: string;
  sourceId: string;
  strength?: number;
  targetId: string;
}

export interface KnowledgeGraphMembershipLink {
  id: string;
  relation: 'contains';
  relationType: 'contains';
  sourceId: string;
  strength: 1;
  targetId: string;
}

export interface UnifiedKnowledgeGraphPayload {
  nodes: UnifiedKnowledgeNode[];
  links: UnifiedKnowledgeLink[];
  inspectionLinks?: RuntimeKnowledgeRelationLink[];
  source: 'file' | 'database';
  versionDigest?: string;
  versionLinkCount?: number;
}

export type KnowledgeGraphProgressiveMode = 'root' | 'expansion' | 'active-filter' | 'remaining';

export interface KnowledgeGraphRootSummary {
  rootId: string;
  label: string;
  chapterName: string;
  nodeCount: number;
  linkCount: number;
  hasExpansion: boolean;
}

export interface KnowledgeGraphRootCatalogEntry {
  nodeId: string;
  nodeName: string;
  nodeType: NodeType;
  domainId: string;
  chapterName: string;
}

export interface KnowledgeGraphProgressivePayload {
  mode: KnowledgeGraphProgressiveMode;
  graphVersion: string;
  shardKey: string;
  filterSignature: string;
  nodes: PublicKnowledgeGraphNode[];
  links: PublicKnowledgeGraphLink[];
  membershipLinks?: KnowledgeGraphMembershipLink[];
  source: 'file' | 'database';
  truncated: { nodes: boolean; links: boolean; membershipLinks: boolean };
  rootSummaries?: KnowledgeGraphRootSummary[];
  rootCatalog?: KnowledgeGraphRootCatalogEntry[];
  domainId?: string;
}

export interface PublicKnowledgeGraphNode {
  id: string;
  name: string;
  nodeType: NodeType;
  description: string;
  positionX: number;
  positionY: number;
  positionZ: number;
  bloomLevel?: BloomLevel;
  knowledgeDim?: KnowledgeDim;
  tags?: string[];
  chapter?: number;
  chapterName?: string;
  expansion?: KnowledgeNodeExpansion;
  importance?: number;
}

export interface PublicKnowledgeGraphPayload {
  nodes: PublicKnowledgeGraphNode[];
  links: PublicKnowledgeGraphLink[];
  source: 'file' | 'database';
  versionDigest?: string;
  versionLinkCount?: number;
  truncated: { nodes: boolean; links: boolean };
}

export interface KnowledgeGraphManifestPayload {
  graphVersion: string;
  source: 'file' | 'database';
  nodeCount: number;
  linkCount: number;
  rootShardKey: string;
  activeFilterShardKey: string;
  remainingShardKey: string;
}

export interface UnifiedKnowledgeNodeDetail extends PublicKnowledgeGraphNode {
  content?: Record<string, unknown>;
  isActive: boolean;
  metadata?: Record<string, unknown>;
  resources?: unknown[];
  truncated: {
    content: boolean;
    metadata: boolean;
    relatedNodes: boolean;
    resources: boolean;
  };
  relatedNodes: Array<{
    id: string;
    name: string;
    nodeType: NodeType;
    canonicalType: string;
    cycleState?: 'cyclic';
    relationId: string;
    category: RelatedCategory;
    direction: 'parent-to-child' | 'earlier-to-later' | 'unordered';
    family: 'child' | 'post-requisite' | 'association';
    inspectionSentence: string;
    evidenceState: 'available' | 'unavailable';
    rationale?: string;
    sourceDocument?: string;
    sourceId: string;
    sourceMetadata?: Record<string, string | number>;
    strength: number;
    targetId: string;
  }>;
}

interface RawKnowledgeGraphNode {
  id: string;
  name: string;
  category?: string;
  bloom_level?: string;
  chapter?: number;
  chapter_name?: string;
  definition?: string;
  examples?: string[];
  formulas?: string[];
  prerequisites?: string[];
  related_concepts?: string[];
  difficulty?: number;
  importance?: number;
  keywords?: string[];
  created_at?: string;
  updated_at?: string;
}

interface DatabaseKnowledgeNodeRow {
  id: string;
  name: string;
  nodeType: NodeType;
  description: string;
  positionX: number;
  positionY: number;
  positionZ: number;
  bloomLevel: BloomLevel | null;
  knowledgeDim: KnowledgeDim | null;
  metadata: unknown;
  content: unknown;
  resources: unknown;
  tags: string[] | null;
}

interface DatabaseKnowledgeLinkRow {
  id: string;
  metadata?: unknown;
  strength?: number;
  sourceId: string;
  targetId: string;
  relation: string;
}

interface DatabaseRelationVersionEvidence {
  linkCount: number;
  fingerprint: string;
}

interface FileGraphVersionMetadata {
  digestInput: string;
  relationCount: number;
}

interface FileGraphSnapshot {
  fingerprint: string;
  rawNodes: string;
  rawRelations: string;
  versionMetadata: FileGraphVersionMetadata;
}

const BLOOM_LEVEL_MAP: Record<string, BloomLevel> = {
  REMEMBER: 'REMEMBER',
  UNDERSTAND: 'UNDERSTAND',
  APPLY: 'APPLY',
  ANALYZE: 'ANALYZE',
  EVALUATE: 'EVALUATE',
  CREATE: 'CREATE',
  记忆: 'REMEMBER',
  理解: 'UNDERSTAND',
  应用: 'APPLY',
  分析: 'ANALYZE',
  评价: 'EVALUATE',
  创造: 'CREATE',
};

const KNOWLEDGE_DIM_MAP: Record<string, KnowledgeDim> = {
  FACTUAL: 'FACTUAL',
  CONCEPTUAL: 'CONCEPTUAL',
  PROCEDURAL: 'PROCEDURAL',
  METACOGNITIVE: 'METACOGNITIVE',
  事实性: 'FACTUAL',
  概念性: 'CONCEPTUAL',
  程序性: 'PROCEDURAL',
  元认知: 'METACOGNITIVE',
};

const FILE_GRAPH_CACHE_TTL_MS = 60_000;
const CHAPTER_ROOT_NODE_PREFIX = 'chapter-node:';
const DEFAULT_GRAPH_FILTER_SIGNATURE = 'density=structure;strength=0.8;connected=true;relations=default';

let graphCache: {
  expiresAt: number;
  data: UnifiedKnowledgeGraphPayload;
  sourceFingerprint?: string;
} | null = null;

let rootGraphCache: {
  expiresAt: number;
  data: UnifiedKnowledgeGraphPayload;
} | null = null;

let sharedGraphCacheExpiresAt = 0;

function normalizeBloomLevel(value?: string): BloomLevel {
  if (!value) return 'UNDERSTAND';
  const mapped = BLOOM_LEVEL_MAP[value.trim()];
  return mapped ?? 'UNDERSTAND';
}

function normalizeKnowledgeDim(value?: string): KnowledgeDim {
  if (!value) return 'CONCEPTUAL';
  const mapped = KNOWLEDGE_DIM_MAP[value.trim()];
  return mapped ?? 'CONCEPTUAL';
}

function inferNodeType(node: RawKnowledgeGraphNode): NodeType {
  const text = `${node.name ?? ''} ${node.category ?? ''}`;
  if (text.includes('伦理')) return 'ETHICS';
  if (text.includes('场景')) return 'SCENARIO';
  return 'THEORY';
}

async function readStableFile(filePath: string): Promise<{ content: string; fingerprint: Record<string, unknown> }> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const before = await fs.stat(filePath);
    const content = await fs.readFile(filePath, 'utf8');
    const after = await fs.stat(filePath);
    if (before.size === after.size && before.mtimeMs === after.mtimeMs) {
      return {
        content,
        fingerprint: {
          size: after.size,
          mtimeMs: after.mtimeMs,
          sha256: createHash('sha256').update(content).digest('hex'),
        },
      };
    }
  }
  throw new Error(`Runtime knowledge source changed while being read: ${filePath}`);
}

async function readFileGraphSnapshot(): Promise<FileGraphSnapshot | null> {
  const runtimeRoot = process.env.KNOWLEDGE_RUNTIME_ROOT
    ? path.resolve(process.env.KNOWLEDGE_RUNTIME_ROOT)
    : path.join(process.cwd(), 'course-content', 'runtime', 'knowledge');
  const graphPath = path.join(runtimeRoot, 'graph', 'nodes.json');
  const relationsPath = path.join(runtimeRoot, 'graph', 'relations.jsonl');
  const [nodesResult, relationsResult] = await Promise.allSettled([
    readStableFile(graphPath),
    readStableFile(relationsPath),
  ]);
  const nodeAbsent = nodesResult.status === 'rejected'
    && (nodesResult.reason as NodeJS.ErrnoException).code === 'ENOENT';
  const relationsAbsent = relationsResult.status === 'rejected'
    && (relationsResult.reason as NodeJS.ErrnoException).code === 'ENOENT';
  if (nodeAbsent && relationsAbsent) return null;
  if (nodeAbsent || relationsAbsent) {
    throw runtimeLoadingError(
      'INCOMPLETE_RUNTIME_GRAPH_SOURCE',
      `Canonical runtime graph source is incomplete: ${nodeAbsent ? 'nodes.json' : 'relations.jsonl'} is absent.`,
    );
  }
  if (nodesResult.status === 'rejected') throw nodesResult.reason;
  if (relationsResult.status === 'rejected') throw relationsResult.reason;
  const nodes = nodesResult.value;
  const relations = relationsResult.value;
    const digestInput = stableJson({ nodes: nodes.fingerprint, relations: relations.fingerprint });
    return {
      fingerprint: createHash('sha256').update(digestInput).digest('hex'),
      rawNodes: nodes.content,
      rawRelations: relations.content,
      versionMetadata: {
        digestInput,
        relationCount: relations.content.split('\n').filter((line) => line.trim().length > 0).length,
      },
    };
}

function buildRawFileGraphVersionDigest(rawNodes: string, versionMetadata: FileGraphVersionMetadata): string {
  return createHash('sha256')
    .update(rawNodes)
    .update('\n---relation-metadata---\n')
    .update(versionMetadata.digestInput)
    .digest('hex')
    .slice(0, 16);
}

function normalizeDatabaseKnowledgeNodes(nodes: DatabaseKnowledgeNodeRow[]): UnifiedKnowledgeNode[] {
  return nodes.map((node) => {
    const metadata = (node.metadata ?? {}) as Record<string, unknown>;
    const chapterValue = metadata.chapter;
    const chapter = typeof chapterValue === 'number' ? chapterValue : undefined;
    const chapterNameValue = metadata.chapterName;
    const chapterName = resolveChapterName(
      chapter,
      typeof chapterNameValue === 'string' ? chapterNameValue : null
    );

    return {
      ...node,
      bloomLevel: node.bloomLevel ?? undefined,
      knowledgeDim: node.knowledgeDim ?? undefined,
      chapter,
      chapterName,
      metadata,
      content: (node.content ?? {}) as Record<string, unknown>,
      resources: Array.isArray(node.resources) ? (node.resources as unknown[]) : [],
      tags: node.tags ?? [],
    };
  });
}

export function buildDatabaseKnowledgeGraphPayload(
  nodes: DatabaseKnowledgeNodeRow[],
  links: DatabaseKnowledgeLinkRow[],
  options: { includeLinks: boolean; relationVersion: DatabaseRelationVersionEvidence }
): UnifiedKnowledgeGraphPayload {
  const normalizedNodes = normalizeDatabaseKnowledgeNodes(nodes);
  const stableNodes = [...normalizedNodes].sort((left, right) => (
    left.id < right.id ? -1 : left.id > right.id ? 1 : 0
  ));
  assertCanonicalGraphIdentity({ nodes: stableNodes, links: [] });
  const coverage = options.includeLinks
    ? assertRuntimeKnowledgeRelationCoverage([...links].sort((a, b) => stableStringCompare(a.id, b.id)).map((link) => {
      const metadata = link.metadata && typeof link.metadata === 'object' && !Array.isArray(link.metadata)
        ? { ...(link.metadata as Record<string, unknown>) }
        : {};
      for (const key of [
        'id', 'relationId', 'relation_id', 'sourceId', 'source_id', 'targetId', 'target_id',
        'type', 'relation', 'relationType', 'relation_type', 'strength',
      ]) delete metadata[key];
      return JSON.stringify({
        ...metadata,
        id: link.id,
        sourceId: link.sourceId,
        targetId: link.targetId,
        type: link.relation,
        strength: typeof link.strength === 'number' ? link.strength : 1,
      });
    }).join('\n'), { nodeIds: new Set(normalizedNodes.map((node) => node.id)) })
    : null;
  const normalizedLinks = coverage?.runtimeLinks ?? [];
  const versionLinkCount = options.relationVersion.linkCount;
  const versionDigest = createHash('sha256')
    .update(stableJson({
      source: 'database',
      nodes: stableNodes,
      relationFingerprint: options.relationVersion.fingerprint,
      versionLinkCount,
    }))
    .digest('hex')
    .slice(0, 16);

  const payload: UnifiedKnowledgeGraphPayload = {
    nodes: stableNodes,
    links: normalizedLinks,
    inspectionLinks: coverage?.inspectionLinks,
    source: 'database',
    versionDigest,
    versionLinkCount,
  };
  assertCanonicalGraphIdentity(payload);
  return payload;
}

function toPublicKnowledgeGraphLink(link: UnifiedKnowledgeLink): PublicKnowledgeGraphLink {
  return {
    id: link.id.includes('|')
      ? `visual:${createHash('sha256').update(link.id).digest('hex').slice(0, 16)}`
      : link.id.length > 200
        ? `link:${createHash('sha256').update(link.id).digest('hex').slice(0, 32)}`
        : link.id,
    relation: link.relation.slice(0, 100),
    sourceId: link.sourceId,
    targetId: link.targetId,
    ...(link.strength !== 1 ? { strength: link.strength } : {}),
    ...(link.motionEligible === false ? { motionEligible: false as const } : {}),
  };
}

const MAX_PUBLIC_NODES = 20_000;
const MAX_PUBLIC_LINKS = 20_000;
const MAX_PUBLIC_MEMBERSHIP_LINKS = 20_000;
export const PUBLIC_GRAPH_BYTE_BUDGET = 4_000_000;
export const PUBLIC_DETAIL_BYTE_BUDGET = 256_000;
const MAX_NODE_TEXT = 200;
const MAX_NODE_DESCRIPTION = 800;
const MAX_NODE_TAGS = 10;
const MAX_NODE_TAG_LENGTH = 100;

const MAX_CANONICAL_NODE_ID_LENGTH = 200;
const MAX_DERIVED_MEMBERSHIP_ID_LENGTH = 500;
export const RUNTIME_NODE_SOURCE_MARKER = 'course-content/runtime/knowledge/graph/nodes.json';
export const RUNTIME_RELATION_SOURCE_MARKER = 'course-content/runtime/knowledge/graph/relations.jsonl';

export class InvalidKnowledgeGraphIdentityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidKnowledgeGraphIdentityError';
  }
}

function stableStringCompare(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function assertCanonicalNodeId(id: string): void {
  if (!id || id.length > MAX_CANONICAL_NODE_ID_LENGTH) {
    throw new InvalidKnowledgeGraphIdentityError('Knowledge graph node id exceeds the canonical identity boundary.');
  }
}

function assertCanonicalGraphIdentity(graph: Pick<UnifiedKnowledgeGraphPayload, 'nodes' | 'links'>): void {
  const nodeIds = new Set<string>();
  for (const node of graph.nodes) {
    assertCanonicalNodeId(node.id);
    if (nodeIds.has(node.id)) {
      throw new InvalidKnowledgeGraphIdentityError('Knowledge graph contains a duplicate canonical node id.');
    }
    nodeIds.add(node.id);
  }
  for (const link of graph.links) {
    if (link.sourceId.length > MAX_CANONICAL_NODE_ID_LENGTH || link.targetId.length > MAX_CANONICAL_NODE_ID_LENGTH) {
      throw new InvalidKnowledgeGraphIdentityError('Knowledge graph link endpoint exceeds the canonical identity boundary.');
    }
    if (!nodeIds.has(link.sourceId) || !nodeIds.has(link.targetId)) {
      throw new InvalidKnowledgeGraphIdentityError('Knowledge graph link endpoint is absent from the canonical node set.');
    }
  }
}

export function toPublicKnowledgeGraphNode(node: UnifiedKnowledgeNode): PublicKnowledgeGraphNode {
  const rawImportance = node.metadata?.importance;
  const importance = typeof rawImportance === 'number' && Number.isFinite(rawImportance)
    ? Math.max(0, Math.min(5, rawImportance))
    : undefined;
  return {
    id: node.id,
    name: node.name.slice(0, MAX_NODE_TEXT),
    nodeType: node.nodeType,
    description: node.description.slice(0, MAX_NODE_DESCRIPTION),
    positionX: node.positionX,
    positionY: node.positionY,
    positionZ: node.positionZ,
    ...(node.bloomLevel ? { bloomLevel: node.bloomLevel } : {}),
    ...(node.knowledgeDim ? { knowledgeDim: node.knowledgeDim } : {}),
    ...(node.tags ? { tags: node.tags.slice(0, MAX_NODE_TAGS).map((tag) => tag.slice(0, MAX_NODE_TAG_LENGTH)) } : {}),
    ...(typeof node.chapter === 'number' ? { chapter: node.chapter } : {}),
    ...(node.chapterName ? { chapterName: node.chapterName.slice(0, MAX_NODE_TEXT) } : {}),
    ...(node.expansion ? { expansion: node.expansion } : {}),
    ...(importance !== undefined ? { importance } : {}),
  };
}

const SAFE_METADATA_KEYS = new Set([
  'applications', 'chapter', 'chapterName', 'challengeId', 'content', 'difficulty',
  'continuous', 'discrete', 'formulas', 'importance', 'launchTarget', 'lessonEntry', 'lessonId', 'nodeCount',
  'description', 'href', 'label', 'preview', 'previewDescription', 'previewTitle',
  'renderTarget', 'taskId', 'title', 'type',
]);
const SAFE_CONTENT_KEYS = new Set([
  'applications', 'challenge', 'challengePreview', 'content', 'definition', 'examples',
  'continuous', 'description', 'discrete', 'formulas', 'href', 'keywords', 'label', 'summary', 'title',
]);
const SAFE_RESOURCE_KEYS = new Set([
  'challengeId', 'lessonId', 'nodeId', 'path', 'registryId', 'taskId', 'title', 'type', 'url',
]);

function projectSafeValue(value: unknown, allowedKeys: ReadonlySet<string>, depth = 0): unknown {
  if (typeof value === 'string') return value.slice(0, 500);
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
  if (typeof value === 'boolean') return value;
  if (depth >= 3) return undefined;
  if (Array.isArray(value)) return value.slice(0, 10)
    .map((item) => projectSafeValue(item, allowedKeys, depth + 1))
    .filter((item) => item !== undefined);
  if (!value || typeof value !== 'object') return undefined;
  return Object.fromEntries(Object.entries(value as Record<string, unknown>)
    .filter(([key]) => allowedKeys.has(key))
    .sort(([left], [right]) => stableStringCompare(left, right))
    .slice(0, 30)
    .map(([key, item]) => [key, projectSafeValue(item, allowedKeys, depth + 1)])
    .filter((entry): entry is [string, unknown] => entry[1] !== undefined));
}

function projectSafeResources(resources: unknown[] | undefined): unknown[] | undefined {
  if (!resources) return undefined;
  const projected = resources.slice(0, 10).map((resource) => (
    typeof resource === 'string'
      ? resource.slice(0, 500)
      : projectSafeValue(resource, SAFE_RESOURCE_KEYS)
  )).filter((item) => item !== undefined);
  return projected.length ? projected : undefined;
}

function utf8Bytes(value: unknown): number {
  return Buffer.byteLength(JSON.stringify(value), 'utf8');
}

function boundedProgressiveGraph(
  nodesInput: readonly UnifiedKnowledgeNode[],
  linksInput: readonly UnifiedKnowledgeLink[],
  requiredNodeIds: readonly string[] = []
) {
  assertCanonicalGraphIdentity({ nodes: [...nodesInput], links: [...linksInput] });
  const required = new Set(requiredNodeIds);
  const orderedNodes = [...nodesInput].sort((left, right) => (
    Number(required.has(right.id)) - Number(required.has(left.id)) || stableStringCompare(left.id, right.id)
  ));
  const nodes: PublicKnowledgeGraphNode[] = [];
  let serializedBytes = 200;
  for (const node of orderedNodes.slice(0, MAX_PUBLIC_NODES)) {
    const candidate = toPublicKnowledgeGraphNode(node);
    const candidateBytes = utf8Bytes(candidate) + 1;
    if (serializedBytes + candidateBytes > PUBLIC_GRAPH_BYTE_BUDGET - 100_000) break;
    nodes.push(candidate);
    serializedBytes += candidateBytes;
  }
  const nodeIds = new Set(nodes.map((node) => node.id));
  const links: PublicKnowledgeGraphLink[] = [];
  for (const link of [...linksInput].sort((a, b) => stableStringCompare(a.id, b.id)).slice(0, MAX_PUBLIC_LINKS)) {
    if (!nodeIds.has(link.sourceId) || !nodeIds.has(link.targetId)) continue;
    const candidate = toPublicKnowledgeGraphLink(link);
    const candidateBytes = utf8Bytes(candidate) + 1;
    if (serializedBytes + candidateBytes > PUBLIC_GRAPH_BYTE_BUDGET - 10_000) break;
    links.push(candidate);
    serializedBytes += candidateBytes;
  }
  return {
    nodes,
    links,
    nodeIds,
    truncated: {
      nodes: nodes.length < nodesInput.length,
      links: links.length < linksInput.length,
      membershipLinks: false,
    },
  };
}

export function toPublicKnowledgeGraphPayload(
  graph: UnifiedKnowledgeGraphPayload
): PublicKnowledgeGraphPayload {
  assertCanonicalGraphIdentity(graph);
  const bounded = boundedProgressiveGraph(graph.nodes, graph.links);
  return {
    nodes: bounded.nodes,
    links: bounded.links,
    source: graph.source,
    ...(graph.versionDigest ? { versionDigest: graph.versionDigest } : {}),
    ...(typeof graph.versionLinkCount === 'number' ? { versionLinkCount: graph.versionLinkCount } : {}),
    truncated: { nodes: bounded.truncated.nodes, links: bounded.truncated.links },
  };
}

type KnowledgeGraphReadTransaction = Pick<typeof prisma, 'knowledgeNode' | 'knowledgeLink' | '$queryRaw'>;

async function loadDatabaseRelationVersionEvidence(
  db: KnowledgeGraphReadTransaction
): Promise<DatabaseRelationVersionEvidence> {
  const rows = await db.$queryRaw<Array<{ linkCount: bigint; fingerprint: string }>>`
    SELECT
      COUNT(*)::bigint AS "linkCount",
      md5(
        COALESCE(
          string_agg(
            concat_ws(chr(31), link."id", link."sourceId", link."targetId", link."relation", link."strength", link."metadata"::text),
            chr(30)
            ORDER BY link."id", link."sourceId", link."targetId", link."relation"
          ),
          ''
        )
      ) AS "fingerprint"
    FROM "KnowledgeLink" AS link
    WHERE link."metadata"->>'runtimeSource' = ${RUNTIME_RELATION_SOURCE_MARKER}
  `;
  const evidence = rows[0];
  if (!evidence) throw new Error('Knowledge graph relation version evidence is unavailable.');
  return {
    linkCount: Number(evidence.linkCount),
    fingerprint: evidence.fingerprint,
  };
}

function normalizeFileKnowledgeNodes(parsedNodes: UnifiedKnowledgeNode[]): UnifiedKnowledgeNode[] {
  return parsedNodes.map((node) => {
    const metadata = (node.metadata ?? {}) as Record<string, unknown>;
    const chapter = typeof node.chapter === 'number'
      ? node.chapter
      : typeof metadata.chapter === 'number'
        ? metadata.chapter
        : undefined;
    const chapterNameValue = typeof node.chapterName === 'string'
      ? node.chapterName
      : typeof metadata.chapterName === 'string'
        ? metadata.chapterName
        : null;

    return {
      ...node,
      nodeType: node.nodeType ?? inferNodeType({
        id: node.id,
        name: node.name,
        category: typeof metadata.category === 'string' ? metadata.category : undefined,
      }),
      description: node.description?.trim() || `${node.name} 的知识节点`,
      bloomLevel: normalizeBloomLevel(node.bloomLevel ?? (typeof metadata.bloom_level === 'string' ? metadata.bloom_level : undefined)),
      knowledgeDim: normalizeKnowledgeDim(node.knowledgeDim ?? (typeof metadata.category === 'string' ? metadata.category : undefined)),
      chapter,
      chapterName: resolveChapterName(chapter, chapterNameValue),
      metadata,
      content: (node.content ?? {}) as Record<string, unknown>,
      resources: Array.isArray(node.resources) ? node.resources : [],
      tags: Array.isArray(node.tags) ? node.tags : [],
    };
  });
}

function runtimeLoadingError(code: string, message: string): RuntimeKnowledgeRelationCoverageError {
  return new RuntimeKnowledgeRelationCoverageError({
    coverage: [],
    counts: { inputLines: 0, parsedRelations: 0, projectedRelations: 0, visualEdges: 0 },
    diagnostics: [{ blocking: true, code, message, relationIds: [], stage: 'loading', stages: ['loading', 'labeling', 'projection', 'inspection'] }],
    ok: false,
    stageAgreement: false,
  });
}

function loadKnowledgeGraphFromFiles(snapshot: FileGraphSnapshot): UnifiedKnowledgeGraphPayload {
  const { rawNodes, rawRelations, versionMetadata } = snapshot;
  let parsedNodes: UnifiedKnowledgeNode[];
  try {
    parsedNodes = JSON.parse(rawNodes) as UnifiedKnowledgeNode[];
  } catch {
    throw runtimeLoadingError('MALFORMED_RUNTIME_NODES', 'Runtime knowledge nodes JSON is malformed.');
  }

  if (!Array.isArray(parsedNodes) || parsedNodes.length === 0) {
    throw runtimeLoadingError('EMPTY_RUNTIME_NODES', 'Runtime knowledge nodes must be a non-empty JSON array.');
  }
  const nodeIds = new Set<string>();
  for (const [index, node] of parsedNodes.entries()) {
    const id = node && typeof node === 'object' ? node.id : undefined;
    if (typeof id !== 'string' || !id || id.trim() !== id || id.length > MAX_CANONICAL_NODE_ID_LENGTH) {
      throw runtimeLoadingError('INVALID_RUNTIME_NODE_ID', `Runtime knowledge node at index ${index} has an invalid canonical id.`);
    }
    if (nodeIds.has(id)) {
      throw runtimeLoadingError('DUPLICATE_RUNTIME_NODE_ID', `Runtime knowledge node id is duplicated: ${id}`);
    }
    nodeIds.add(id);
  }

  const nodes = normalizeFileKnowledgeNodes(parsedNodes);

  const relationCoverage = assertRuntimeKnowledgeRelationCoverage(rawRelations, {
    nodeIds,
  });

  const payload: UnifiedKnowledgeGraphPayload = {
    nodes,
    links: relationCoverage.runtimeLinks,
    inspectionLinks: relationCoverage.inspectionLinks,
    source: 'file',
    versionDigest: buildRawFileGraphVersionDigest(rawNodes, versionMetadata),
    versionLinkCount: versionMetadata.relationCount,
  };
  assertCanonicalGraphIdentity(payload);
  return payload;
}

function isRetryableKnowledgeGraphSnapshotError(error: unknown): boolean {
  const code = (error as { code?: unknown }).code;
  return code === 'P2034' || code === '40001';
}

export async function loadKnowledgeGraphFromDatabase(options: {
  afterNodesRead?: () => Promise<void>;
} = {}): Promise<UnifiedKnowledgeGraphPayload> {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      return await prisma.$transaction(async (tx) => {
        const db = tx as KnowledgeGraphReadTransaction;
        const nodes = await db.knowledgeNode.findMany({
      where: {
        isActive: true,
        metadata: { path: ['source'], equals: RUNTIME_NODE_SOURCE_MARKER },
      },
      select: {
        id: true,
        name: true,
        nodeType: true,
        description: true,
        positionX: true,
        positionY: true,
        positionZ: true,
        bloomLevel: true,
        knowledgeDim: true,
        metadata: true,
        content: true,
        resources: true,
        tags: true,
      },
        });
        await options.afterNodesRead?.();
        const [links, relationVersion] = await Promise.all([
          db.knowledgeLink.findMany({
            where: { metadata: { path: ['runtimeSource'], equals: RUNTIME_RELATION_SOURCE_MARKER } },
            select: {
              id: true,
              sourceId: true,
              targetId: true,
              relation: true,
              strength: true,
              metadata: true,
            },
          }),
          loadDatabaseRelationVersionEvidence(db),
        ]);
        return buildDatabaseKnowledgeGraphPayload(nodes, links, { includeLinks: true, relationVersion });
      }, {
        isolationLevel: 'RepeatableRead',
        maxWait: 5_000,
        timeout: 15_000,
      });
    } catch (error) {
      if (attempt === 0 && isRetryableKnowledgeGraphSnapshotError(error)) continue;
      throw error;
    }
  }
  throw new Error('Knowledge graph snapshot retry exhausted.');
}

export async function loadKnowledgeGraphData(): Promise<UnifiedKnowledgeGraphPayload> {
  const now = Date.now();
  const fileSnapshot = await readFileGraphSnapshot();
  if (fileSnapshot && graphCache?.sourceFingerprint === fileSnapshot.fingerprint && sharedGraphCacheExpiresAt > now) {
    return graphCache.data;
  }

  const data = fileSnapshot ? loadKnowledgeGraphFromFiles(fileSnapshot) : await loadKnowledgeGraphFromDatabase();
  const expiresAt = now + FILE_GRAPH_CACHE_TTL_MS;

  graphCache = {
    expiresAt,
    data,
    ...(fileSnapshot ? { sourceFingerprint: fileSnapshot.fingerprint } : {}),
  };
  sharedGraphCacheExpiresAt = expiresAt;
  if (rootGraphCache) {
    if (getKnowledgeGraphVersion(rootGraphCache.data) === getKnowledgeGraphVersion(data)) {
      rootGraphCache = { ...rootGraphCache, expiresAt };
    } else {
      rootGraphCache = null;
    }
  }

  return data;
}

export async function loadKnowledgeGraphRootData(): Promise<UnifiedKnowledgeGraphPayload> {
  const now = Date.now();
  // Root is a presentation projection, not a weaker loading boundary. Always load and
  // validate the complete canonical relation source before exposing any node summary.
  const data = await loadKnowledgeGraphData();
  const expiresAt = now + FILE_GRAPH_CACHE_TTL_MS;

  rootGraphCache = {
    expiresAt,
    data,
  };
  sharedGraphCacheExpiresAt = expiresAt;
  if (graphCache) {
    if (getKnowledgeGraphVersion(graphCache.data) === getKnowledgeGraphVersion(data)) {
      graphCache = { ...graphCache, expiresAt };
    } else {
      graphCache = null;
    }
  }

  return data;
}

export function resetKnowledgeGraphSourceCacheForTests(): void {
  graphCache = null;
  rootGraphCache = null;
  sharedGraphCacheExpiresAt = 0;
}

function knowledgeGraphLinkKey(link: Pick<UnifiedKnowledgeLink, 'id' | 'sourceId' | 'targetId' | 'relation' | 'relationType'>): string {
  return link.id || `${link.sourceId}->${link.targetId}:${link.relationType || link.relation || 'related'}`;
}

export function getKnowledgeGraphVersion(graph: UnifiedKnowledgeGraphPayload): string {
  const digest = graph.versionDigest ?? createHash('sha256')
    .update(stableKnowledgeGraphVersionInput(graph))
    .digest('hex')
    .slice(0, 16);
  return [
    'knowledge-graph',
    graph.source,
    graph.nodes.length,
    graph.versionLinkCount ?? graph.links.length,
    digest,
  ].join(':');
}

function stableJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`).join(',')}}`;
}

function stableKnowledgeGraphVersionInput(graph: UnifiedKnowledgeGraphPayload): string {
  return stableJson({
    source: graph.source,
    nodes: graph.nodes
      .map((node) => ({
        id: node.id,
        name: node.name,
        nodeType: node.nodeType,
        description: node.description,
        bloomLevel: node.bloomLevel,
        knowledgeDim: node.knowledgeDim,
        metadata: node.metadata,
        content: node.content,
        resources: node.resources,
        tags: node.tags,
        chapter: node.chapter,
        chapterName: node.chapterName,
      }))
      .sort((left, right) => stableStringCompare(left.id, right.id)),
    links: graph.links
      .map((link) => ({
        id: link.id,
        sourceId: link.sourceId,
        targetId: link.targetId,
        relation: link.relation,
        relationType: link.relationType,
        strength: link.strength,
      }))
      .sort((left, right) => stableStringCompare(knowledgeGraphLinkKey(left), knowledgeGraphLinkKey(right))),
  });
}

function chapterNameForNode(node: UnifiedKnowledgeNode): string {
  const metadata = (node.metadata ?? {}) as Record<string, unknown>;
  return resolveChapterName(
    node.chapter,
    (typeof node.chapterName === 'string' ? node.chapterName : null)
      ?? (typeof metadata.chapterName === 'string' ? metadata.chapterName : null)
  );
}

function buildChapterRootNode(chapterName: string, index: number, nodeCount: number): UnifiedKnowledgeNode {
  const id = `${CHAPTER_ROOT_NODE_PREFIX}${chapterName}`;
  assertCanonicalNodeId(id);
  return {
    id,
    name: chapterName,
    nodeType: 'THEORY',
    description: `${chapterName}（共 ${nodeCount} 个知识点，选择后可展开）`,
    positionX: 0,
    positionY: 0,
    positionZ: index + 1,
    metadata: {
      isVirtualChapter: true,
      isCollapsedRoot: true,
      chapterName,
      nodeCount,
    },
    content: {},
    resources: [],
    tags: ['chapter', 'collapsed-root'],
    chapter: index + 1,
    chapterName,
    expansion: nodeCount > 0
      ? { state: 'expandable', revealableNeighborCount: nodeCount }
      : { state: 'leaf' },
  };
}

function buildCanonicalExpansionDescriptors(
  graph: UnifiedKnowledgeGraphPayload
): Map<string, KnowledgeNodeExpansion> {
  const neighborIdsByNodeId = new Map<string, Set<string>>();
  graph.links.forEach((link) => {
    if (link.sourceId === link.targetId) return;
    const sourceNeighbors = neighborIdsByNodeId.get(link.sourceId) ?? new Set<string>();
    sourceNeighbors.add(link.targetId);
    neighborIdsByNodeId.set(link.sourceId, sourceNeighbors);
    const targetNeighbors = neighborIdsByNodeId.get(link.targetId) ?? new Set<string>();
    targetNeighbors.add(link.sourceId);
    neighborIdsByNodeId.set(link.targetId, targetNeighbors);
  });
  return new Map(graph.nodes.map((node) => {
    const neighborCount = neighborIdsByNodeId.get(node.id)?.size ?? 0;
    return [
      node.id,
      neighborCount > 0
        ? { state: 'expandable', revealableNeighborCount: neighborCount }
        : { state: 'leaf' },
    ];
  }));
}

function withCanonicalExpansionDescriptors(
  graph: UnifiedKnowledgeGraphPayload,
  nodes: UnifiedKnowledgeNode[]
): UnifiedKnowledgeNode[] {
  const descriptors = buildCanonicalExpansionDescriptors(graph);
  return nodes.map((node) => ({
    ...node,
    expansion: node.id.startsWith(CHAPTER_ROOT_NODE_PREFIX)
      ? node.expansion ?? { state: 'unknown' }
      : descriptors.get(node.id) ?? { state: 'unknown' },
  }));
}

function groupGraphNodesByChapter(nodes: UnifiedKnowledgeNode[]): Array<{ chapterName: string; nodes: UnifiedKnowledgeNode[] }> {
  const orderIndex = new Map<string, number>(CHAPTER_DISPLAY_ORDER.map((name, index) => [name, index]));
  const groups = new Map<string, UnifiedKnowledgeNode[]>();

  nodes.forEach((node) => {
    const chapterName = chapterNameForNode(node);
    const group = groups.get(chapterName) ?? [];
    group.push(node);
    groups.set(chapterName, group);
  });

  return Array.from(groups.entries())
    .map(([chapterName, chapterNodes]) => ({
      chapterName,
      nodes: chapterNodes.sort((left, right) => stableStringCompare(left.name, right.name)),
    }))
    .sort((left, right) => {
      const leftIndex = orderIndex.get(left.chapterName);
      const rightIndex = orderIndex.get(right.chapterName);
      if (typeof leftIndex === 'number' && typeof rightIndex === 'number') return leftIndex - rightIndex;
      if (typeof leftIndex === 'number') return -1;
      if (typeof rightIndex === 'number') return 1;
      return stableStringCompare(left.chapterName, right.chapterName);
    });
}

function chapterRootLinks(rootId: string, nodes: UnifiedKnowledgeNode[]): KnowledgeGraphMembershipLink[] {
  assertCanonicalNodeId(rootId);
  return nodes.map((node) => {
    assertCanonicalNodeId(node.id);
    const id = `chapter-link:${rootId}->${node.id}`;
    if (id.length > MAX_DERIVED_MEMBERSHIP_ID_LENGTH) {
      throw new InvalidKnowledgeGraphIdentityError('Derived chapter membership id exceeds its identity boundary.');
    }
    return {
      id,
      sourceId: rootId,
      targetId: node.id,
      relation: 'contains',
      relationType: 'contains',
      strength: 1,
    };
  });
}

function boundedActiveFilterLinks(links: UnifiedKnowledgeLink[]): UnifiedKnowledgeLink[] {
  const highSignalTypes = new Set([
    'contains',
    'prerequisite',
    'provides_foundation',
    'follows',
    'leads_to',
    'applies_to',
    'derives',
    'determines',
    'generalizes',
    'instance_of',
    'cross_domain',
    'supports',
    'enables',
    'uses',
    'visualized_by',
    'opposite',
  ]);
  return links.filter((link) => {
    const relationType = link.relationType || link.relation || 'related';
    return highSignalTypes.has(relationType) && (link.strength ?? 1) >= 0.8;
  });
}

function buildProgressiveShardKey(mode: KnowledgeGraphProgressiveMode, graphVersion: string, suffix: string): string {
  return `${graphVersion}:shard:${mode}:${suffix}`;
}

function buildEmptyExpansionPayload(graph: UnifiedKnowledgeGraphPayload, nodeId: string): KnowledgeGraphProgressivePayload {
  const graphVersion = getKnowledgeGraphVersion(graph);
  return {
    mode: 'expansion',
    graphVersion,
    shardKey: buildProgressiveShardKey('expansion', graphVersion, nodeId || 'missing-node'),
    filterSignature: DEFAULT_GRAPH_FILTER_SIGNATURE,
    nodes: [],
    links: [],
    source: graph.source,
    truncated: { nodes: false, links: false, membershipLinks: false },
    domainId: nodeId.startsWith(CHAPTER_ROOT_NODE_PREFIX) ? nodeId : undefined,
  };
}

export function buildKnowledgeGraphManifestPayload(graph: UnifiedKnowledgeGraphPayload): KnowledgeGraphManifestPayload {
  assertCanonicalGraphIdentity(graph);
  const graphVersion = getKnowledgeGraphVersion(graph);
  return {
    graphVersion,
    source: graph.source,
    nodeCount: graph.nodes.length,
    linkCount: graph.links.length,
    rootShardKey: buildProgressiveShardKey('root', graphVersion, 'chapters'),
    activeFilterShardKey: buildProgressiveShardKey('active-filter', graphVersion, DEFAULT_GRAPH_FILTER_SIGNATURE),
    remainingShardKey: buildProgressiveShardKey('remaining', graphVersion, 'all'),
  };
}

export function buildKnowledgeGraphRootPayload(graph: UnifiedKnowledgeGraphPayload): KnowledgeGraphProgressivePayload {
  assertCanonicalGraphIdentity(graph);
  const graphVersion = getKnowledgeGraphVersion(graph);
  const groups = groupGraphNodesByChapter(graph.nodes);
  const rootSummaries = groups.map((group, index) => {
    const rootId = `${CHAPTER_ROOT_NODE_PREFIX}${group.chapterName}`;
    const groupNodeIds = new Set(group.nodes.map((node) => node.id));
    const linkCount = graph.links.filter((link) => groupNodeIds.has(link.sourceId) || groupNodeIds.has(link.targetId)).length;
    return {
      rootId,
      label: group.chapterName,
      chapterName: group.chapterName,
      nodeCount: group.nodes.length,
      linkCount,
      hasExpansion: group.nodes.length > 0,
    };
  });
  const rootCatalog = groups.flatMap((group) => {
    const domainId = `${CHAPTER_ROOT_NODE_PREFIX}${group.chapterName}`;
    return group.nodes.map((node) => ({
      nodeId: node.id,
      nodeName: node.name,
      nodeType: node.nodeType,
      domainId,
      chapterName: group.chapterName,
    }));
  });

  return {
    mode: 'root',
    graphVersion,
    shardKey: buildProgressiveShardKey('root', graphVersion, 'chapters'),
    filterSignature: DEFAULT_GRAPH_FILTER_SIGNATURE,
    nodes: groups.map((group, index) => toPublicKnowledgeGraphNode(
      buildChapterRootNode(group.chapterName, index, group.nodes.length)
    )),
    links: [],
    source: graph.source,
    rootSummaries,
    rootCatalog,
    truncated: { nodes: false, links: false, membershipLinks: false },
  };
}

export function buildKnowledgeGraphExpansionPayload(
  graph: UnifiedKnowledgeGraphPayload,
  nodeId: string
): KnowledgeGraphProgressivePayload {
  assertCanonicalGraphIdentity(graph);
  const graphVersion = getKnowledgeGraphVersion(graph);
  if (!nodeId) return buildEmptyExpansionPayload(graph, nodeId);
  const targetNode = graph.nodes.find((node) => node.id === nodeId);
  if (targetNode && !nodeId.startsWith(CHAPTER_ROOT_NODE_PREFIX)) {
    const directLinks = graph.links.filter((link) => link.sourceId === nodeId || link.targetId === nodeId);
    const nodeIds = new Set<string>([nodeId]);
    directLinks.forEach((link) => {
      nodeIds.add(link.sourceId);
      nodeIds.add(link.targetId);
    });
    const bounded = boundedProgressiveGraph(
      withCanonicalExpansionDescriptors(graph, graph.nodes.filter((node) => nodeIds.has(node.id))),
      directLinks,
      [nodeId]
    );

    return {
      mode: 'expansion',
      graphVersion,
      shardKey: buildProgressiveShardKey('expansion', graphVersion, nodeId),
      filterSignature: DEFAULT_GRAPH_FILTER_SIGNATURE,
      nodes: bounded.nodes,
      links: bounded.links,
      source: graph.source,
      truncated: bounded.truncated,
    };
  }

  const groups = groupGraphNodesByChapter(graph.nodes);
  if (!nodeId.startsWith(CHAPTER_ROOT_NODE_PREFIX)) {
    return buildEmptyExpansionPayload(graph, nodeId);
  }
  const chapterName = nodeId.slice(CHAPTER_ROOT_NODE_PREFIX.length);
  const groupIndex = groups.findIndex((group) => group.chapterName === chapterName);
  if (groupIndex < 0) {
    return buildEmptyExpansionPayload(graph, nodeId);
  }
  const group = groups[groupIndex] ?? { chapterName, nodes: [] };
  const rootNode = buildChapterRootNode(group.chapterName, Math.max(0, groupIndex), group.nodes.length);
  const groupNodeIds = new Set(group.nodes.map((node) => node.id));
  const groupLinks = graph.links.filter((link) => groupNodeIds.has(link.sourceId) && groupNodeIds.has(link.targetId));

  const membershipLinks = chapterRootLinks(rootNode.id, group.nodes);
  const bounded = boundedProgressiveGraph(
    [rootNode, ...withCanonicalExpansionDescriptors(graph, group.nodes)],
    groupLinks,
    [rootNode.id]
  );
  const eligibleMembershipLinks = membershipLinks
    .filter((link) => bounded.nodeIds.has(link.sourceId) && bounded.nodeIds.has(link.targetId))
    .sort((left, right) => stableStringCompare(left.id, right.id))
    .slice(0, MAX_PUBLIC_MEMBERSHIP_LINKS);
  const boundedMembershipLinks: KnowledgeGraphMembershipLink[] = [];
  for (const link of eligibleMembershipLinks) {
    const candidate = [...boundedMembershipLinks, link];
    if (utf8Bytes({ nodes: bounded.nodes, links: bounded.links, membershipLinks: candidate })
      > PUBLIC_GRAPH_BYTE_BUDGET - 2_000) break;
    boundedMembershipLinks.push(link);
  }
  return {
    mode: 'expansion',
    graphVersion,
    shardKey: buildProgressiveShardKey('expansion', graphVersion, nodeId),
    filterSignature: DEFAULT_GRAPH_FILTER_SIGNATURE,
    nodes: bounded.nodes,
    links: bounded.links,
    membershipLinks: boundedMembershipLinks,
    source: graph.source,
    truncated: {
      nodes: bounded.truncated.nodes,
      links: bounded.truncated.links,
      membershipLinks: boundedMembershipLinks.length < membershipLinks.length,
    },
    domainId: nodeId,
  };
}

export function buildKnowledgeGraphActiveFilterPayload(graph: UnifiedKnowledgeGraphPayload): KnowledgeGraphProgressivePayload {
  assertCanonicalGraphIdentity(graph);
  const graphVersion = getKnowledgeGraphVersion(graph);
  const bounded = boundedProgressiveGraph(
    withCanonicalExpansionDescriptors(graph, graph.nodes),
    boundedActiveFilterLinks(graph.links)
  );
  return {
    mode: 'active-filter',
    graphVersion,
    shardKey: buildProgressiveShardKey('active-filter', graphVersion, DEFAULT_GRAPH_FILTER_SIGNATURE),
    filterSignature: DEFAULT_GRAPH_FILTER_SIGNATURE,
    nodes: bounded.nodes,
    links: bounded.links,
    source: graph.source,
    truncated: bounded.truncated,
  };
}

export function buildKnowledgeGraphRemainingPayload(graph: UnifiedKnowledgeGraphPayload): KnowledgeGraphProgressivePayload {
  assertCanonicalGraphIdentity(graph);
  const graphVersion = getKnowledgeGraphVersion(graph);
  const bounded = boundedProgressiveGraph(withCanonicalExpansionDescriptors(graph, graph.nodes), graph.links);
  return {
    mode: 'remaining',
    graphVersion,
    shardKey: buildProgressiveShardKey('remaining', graphVersion, 'all'),
    filterSignature: 'all',
    nodes: bounded.nodes,
    links: bounded.links,
    source: graph.source,
    truncated: bounded.truncated,
  };
}

export function buildKnowledgeNodeDetailFromGraph(
  graph: UnifiedKnowledgeGraphPayload,
  nodeId: string
): UnifiedKnowledgeNodeDetail | null {
  assertCanonicalGraphIdentity(graph);
  const node = graph.nodes.find((item) => item.id === nodeId);
  if (!node) return null;

  const nodeById = new Map(graph.nodes.map((item) => [item.id, item]));
  const runtimeLinks = (graph.inspectionLinks ?? graph.links).filter((link): link is RuntimeKnowledgeRelationLink => (
    Boolean(link.provenance) && typeof link.motionEligible === 'boolean'
  ));
  const allRelatedNodes = buildRuntimeKnowledgeRelationInspectionItems(runtimeLinks, nodeById, nodeId)
    .map((item) => ({
      ...item,
      canonicalType: item.canonicalType.slice(0, 100),
      id: item.id,
      inspectionSentence: item.inspectionSentence.slice(0, 500),
      name: item.name.slice(0, 200),
      nodeType: item.nodeType as NodeType,
      relationId: item.relationId.length > 200
        ? `relation:${createHash('sha256').update(item.relationId).digest('hex').slice(0, 32)}`
        : item.relationId,
      sourceId: item.sourceId,
      targetId: item.targetId,
    }));
  const metadata = projectSafeValue(node.metadata, SAFE_METADATA_KEYS) as Record<string, unknown> | undefined;
  const content = projectSafeValue(node.content, SAFE_CONTENT_KEYS) as Record<string, unknown> | undefined;
  const resources = projectSafeResources(node.resources);

  const detail: UnifiedKnowledgeNodeDetail = {
    ...toPublicKnowledgeGraphNode(node),
    isActive: true,
    relatedNodes: [],
    truncated: {
      content: false,
      metadata: false,
      relatedNodes: false,
      resources: false,
    },
  };
  const addObjectFields = (
    field: 'metadata' | 'content',
    value: Record<string, unknown> | undefined
  ) => {
    if (!value || Object.keys(value).length === 0) return;
    const accepted: Record<string, unknown> = {};
    for (const key of Object.keys(value).sort(stableStringCompare)) {
      const candidate = { ...accepted, [key]: value[key] };
      if (utf8Bytes({ ...detail, [field]: candidate }) > PUBLIC_DETAIL_BYTE_BUDGET) {
        detail.truncated[field] = true;
        continue;
      }
      accepted[key] = value[key];
    }
    if (Object.keys(accepted).length) detail[field] = accepted;
  };
  addObjectFields('metadata', metadata);
  addObjectFields('content', content);
  if (resources) {
    const accepted: unknown[] = [];
    for (const resource of resources) {
      if (utf8Bytes({ ...detail, resources: [...accepted, resource] }) > PUBLIC_DETAIL_BYTE_BUDGET) {
        detail.truncated.resources = true;
        continue;
      }
      accepted.push(resource);
    }
    if (accepted.length) detail.resources = accepted;
  }
  for (const relation of allRelatedNodes.slice(0, 40)) {
    if (utf8Bytes({ ...detail, relatedNodes: [...detail.relatedNodes, relation] }) > PUBLIC_DETAIL_BYTE_BUDGET) {
      detail.truncated.relatedNodes = true;
      break;
    }
    detail.relatedNodes.push(relation);
  }
  if (allRelatedNodes.length > detail.relatedNodes.length) detail.truncated.relatedNodes = true;
  return detail;
}

export function filterKnowledgeNodes(
  nodes: UnifiedKnowledgeNode[],
  options: {
    type?: string | null;
    bloom?: string | null;
    search?: string | null;
  }
): UnifiedKnowledgeNode[] {
  const type = options.type?.trim();
  const bloom = options.bloom?.trim();
  const search = options.search?.trim().toLowerCase();

  return nodes
    .filter((node) => {
      if (type && node.nodeType !== type) return false;
      if (bloom && node.bloomLevel !== bloom) return false;
      if (!search) return true;

      const tagText = (node.tags ?? []).join(' ').toLowerCase();
      return (
        node.name.toLowerCase().includes(search) ||
        node.description.toLowerCase().includes(search) ||
        tagText.includes(search)
      );
    })
    .sort((a, b) => stableStringCompare(a.name, b.name));
}
