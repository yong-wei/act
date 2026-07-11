import 'server-only';

import { createHash } from 'node:crypto';
import fs from 'fs/promises';
import path from 'path';
import { prisma } from '@/lib/prisma';
import { CHAPTER_DISPLAY_ORDER, getRelationCategory, resolveChapterName } from '@/lib/knowledge-labels';

type NodeType = 'THEORY' | 'SCENARIO' | 'ETHICS';
type BloomLevel = 'REMEMBER' | 'UNDERSTAND' | 'APPLY' | 'ANALYZE' | 'EVALUATE' | 'CREATE';
type KnowledgeDim = 'FACTUAL' | 'CONCEPTUAL' | 'PROCEDURAL' | 'METACOGNITIVE';
type RelatedCategory = 'prerequisite' | 'follows' | 'related';

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
  sourceId: string;
  targetId: string;
  relation: string;
  relationType: string;
  strength: number;
}

export interface UnifiedKnowledgeGraphPayload {
  nodes: UnifiedKnowledgeNode[];
  links: UnifiedKnowledgeLink[];
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

export interface KnowledgeGraphProgressivePayload {
  mode: KnowledgeGraphProgressiveMode;
  graphVersion: string;
  shardKey: string;
  filterSignature: string;
  nodes: UnifiedKnowledgeNode[];
  links: UnifiedKnowledgeLink[];
  source: 'file' | 'database';
  rootSummaries?: KnowledgeGraphRootSummary[];
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

export interface UnifiedKnowledgeNodeDetail extends UnifiedKnowledgeNode {
  isActive: boolean;
  relatedNodes: Array<{
    id: string;
    name: string;
    nodeType: NodeType;
    relation: string;
    category: RelatedCategory;
    strength: number;
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

interface RawRelationRecord {
  id?: string;
  relation_id?: string;
  source_id?: string;
  source: string;
  target_id?: string;
  target: string;
  source_chapter?: number;
  target_chapter?: number;
  relation_type?: string;
  strength?: number;
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
  sourceId: string;
  targetId: string;
  relation: string;
}

interface FileGraphVersionMetadata {
  digestInput: string;
  relationFingerprintCount: number;
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

const RELATION_TYPE_MAP: Record<string, string> = {
  applies_to: 'applies_to',
  complements: 'complements',
  contains: 'contains',
  contrasts_with: 'contrasts_with',
  cross_domain: 'cross_domain',
  derives: 'derives',
  describes_migration_of: 'describes_migration_of',
  determines: 'determines',
  embodies: 'embodies',
  enables: 'enables',
  follows: 'follows',
  generalizes: 'generalizes',
  informs: 'informs',
  instance_of: 'instance_of',
  leads_to: 'leads_to',
  opposite: 'opposite',
  prerequisite: 'prerequisite',
  provides_foundation: 'provides_foundation',
  quantified_by: 'quantified_by',
  related: 'related',
  supports: 'supports',
  uses: 'uses',
  visualized_by: 'visualized_by',
  defines: 'related',
  example: 'instance_of',
  explains: 'informs',
  governs: 'related',
  implements: 'related',
  influences: 'related',
  引出机械建模: 'leads_to',
  引出电路建模: 'leads_to',
  机电类比: 'cross_domain',
  非线性扩展: 'generalizes',
  建模基础: 'provides_foundation',
  电路应用: 'applies_to',
};

const FILE_GRAPH_CACHE_TTL_MS = 60_000;
const CHAPTER_ROOT_NODE_PREFIX = 'chapter-node:';
const DEFAULT_GRAPH_FILTER_SIGNATURE = 'density=structure;strength=0.8;connected=true;relations=default';

let graphCache: {
  expiresAt: number;
  data: UnifiedKnowledgeGraphPayload;
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

function normalizeRelationType(value?: string): string {
  if (!value) return 'related';
  const key = value.trim().toLowerCase();
  const mapped = RELATION_TYPE_MAP[key];
  if (!mapped) {
    throw new Error(`Unknown knowledge graph relation type: ${value}`);
  }
  return mapped;
}

function clampStrength(value?: number): number {
  if (typeof value !== 'number' || Number.isNaN(value)) return 1;
  return Math.min(1, Math.max(0, value));
}

function inferNodeType(node: RawKnowledgeGraphNode): NodeType {
  const text = `${node.name ?? ''} ${node.category ?? ''}`;
  if (text.includes('伦理')) return 'ETHICS';
  if (text.includes('场景')) return 'SCENARIO';
  return 'THEORY';
}

function parseJsonlLines(content: string): RawRelationRecord[] {
  const records: RawRelationRecord[] = [];
  const lines = content.split('\n');

  for (const line of lines) {
    if (!line.trim()) continue;
    try {
      const parsed = JSON.parse(line) as RawRelationRecord;
      records.push(parsed);
    } catch {
      // ignore broken lines
    }
  }
  return records;
}

async function readFileGraphVersionMetadata(relationsPath: string): Promise<FileGraphVersionMetadata> {
  const stats = await fs.stat(relationsPath);
  return {
    digestInput: stableJson({
      relations: {
        size: stats.size,
        mtimeMs: stats.mtimeMs,
      },
    }),
    relationFingerprintCount: stats.size,
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

function normalizeDatabaseKnowledgeLinks(links: DatabaseKnowledgeLinkRow[]): UnifiedKnowledgeLink[] {
  return links.map((link) => {
    const relationType = normalizeRelationType(link.relation);
    return {
      id: link.id,
      sourceId: link.sourceId,
      targetId: link.targetId,
      relation: relationType,
      relationType,
      strength: 1,
    };
  });
}

function buildDatabaseKnowledgeGraphPayload(
  nodes: DatabaseKnowledgeNodeRow[],
  links: DatabaseKnowledgeLinkRow[],
  options: { includeLinks: boolean; linkCount?: number }
): UnifiedKnowledgeGraphPayload {
  const normalizedNodes = normalizeDatabaseKnowledgeNodes(nodes);
  const normalizedLinks = options.includeLinks ? normalizeDatabaseKnowledgeLinks(links) : [];
  const versionLinkCount = options.linkCount ?? links.length;
  const versionDigest = createHash('sha256')
    .update(stableJson({ source: 'database', nodes: normalizedNodes, versionLinkCount }))
    .digest('hex')
    .slice(0, 16);

  return {
    nodes: normalizedNodes,
    links: normalizedLinks,
    source: 'database',
    versionDigest,
    versionLinkCount,
  };
}

function resolveNodeId(
  name: string,
  chapter: number | undefined,
  byNameChapter: Map<string, string>,
  byName: Map<string, string[]>
): string | null {
  if (typeof chapter === 'number') {
    const found = byNameChapter.get(`${name}|${chapter}`);
    if (found) return found;
  }

  const candidates = byName.get(name);
  if (candidates && candidates.length === 1) return candidates[0];
  return null;
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

async function loadKnowledgeGraphFromFiles(): Promise<UnifiedKnowledgeGraphPayload | null> {
  const graphPath = path.join(process.cwd(), 'course-content', 'runtime', 'knowledge', 'graph', 'nodes.json');
  const relationsPath = path.join(process.cwd(), 'course-content', 'runtime', 'knowledge', 'graph', 'relations.jsonl');

  let rawNodes: string;
  let rawRelations: string;
  let versionMetadata: FileGraphVersionMetadata;
  try {
    [rawNodes, rawRelations, versionMetadata] = await Promise.all([
      fs.readFile(graphPath, 'utf-8'),
      fs.readFile(relationsPath, 'utf-8'),
      readFileGraphVersionMetadata(relationsPath),
    ]);
  } catch {
    return null;
  }

  let parsedNodes: UnifiedKnowledgeNode[];
  try {
    parsedNodes = JSON.parse(rawNodes) as UnifiedKnowledgeNode[];
  } catch {
    return null;
  }

  if (!Array.isArray(parsedNodes) || parsedNodes.length === 0) {
    return null;
  }

  const nodes = normalizeFileKnowledgeNodes(parsedNodes);

  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const byNameChapter = new Map<string, string>();
  const byName = new Map<string, string[]>();
  nodes.forEach((node) => {
    byNameChapter.set(`${node.name}|${node.chapter ?? -1}`, node.id);
    const existing = byName.get(node.name) ?? [];
    existing.push(node.id);
    byName.set(node.name, existing);
  });

  const relationLines = parseJsonlLines(rawRelations);
  const linkMap = new Map<string, UnifiedKnowledgeLink>();

  relationLines.forEach((record, index) => {
    const sourceId = record.source_id && nodeById.has(record.source_id)
      ? record.source_id
      : resolveNodeId(record.source, record.source_chapter, byNameChapter, byName);
    const targetId = record.target_id && nodeById.has(record.target_id)
      ? record.target_id
      : resolveNodeId(record.target, record.target_chapter, byNameChapter, byName);
    if (!sourceId || !targetId || sourceId === targetId) return;

    const relationType = normalizeRelationType(record.relation_type);
    const strength = clampStrength(record.strength);
    const dedupeKey = `${sourceId}::${targetId}::${relationType}`;
    const existing = linkMap.get(dedupeKey);

    if (!existing || strength > existing.strength) {
      linkMap.set(dedupeKey, {
        id: record.relation_id ?? `file-link-${index}`,
        sourceId,
        targetId,
        relation: relationType,
        relationType,
        strength,
      });
    }
  });

  return {
    nodes,
    links: Array.from(linkMap.values()),
    source: 'file',
    versionDigest: buildRawFileGraphVersionDigest(rawNodes, versionMetadata),
    versionLinkCount: versionMetadata.relationFingerprintCount,
  };
}

async function loadKnowledgeGraphRootFromFiles(): Promise<UnifiedKnowledgeGraphPayload | null> {
  const graphPath = path.join(process.cwd(), 'course-content', 'runtime', 'knowledge', 'graph', 'nodes.json');
  const relationsPath = path.join(process.cwd(), 'course-content', 'runtime', 'knowledge', 'graph', 'relations.jsonl');

  let rawNodes: string;
  let versionMetadata: FileGraphVersionMetadata;
  try {
    [rawNodes, versionMetadata] = await Promise.all([
      fs.readFile(graphPath, 'utf-8'),
      readFileGraphVersionMetadata(relationsPath),
    ]);
  } catch {
    return null;
  }

  let parsedNodes: UnifiedKnowledgeNode[];
  try {
    parsedNodes = JSON.parse(rawNodes) as UnifiedKnowledgeNode[];
  } catch {
    return null;
  }

  if (!Array.isArray(parsedNodes) || parsedNodes.length === 0) {
    return null;
  }

  return {
    nodes: normalizeFileKnowledgeNodes(parsedNodes),
    links: [],
    source: 'file',
    versionDigest: buildRawFileGraphVersionDigest(rawNodes, versionMetadata),
    versionLinkCount: versionMetadata.relationFingerprintCount,
  };
}

async function loadKnowledgeGraphFromDatabase(): Promise<UnifiedKnowledgeGraphPayload> {
  const [nodes, links] = await Promise.all([
    prisma.knowledgeNode.findMany({
      where: { isActive: true },
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
    }),
    prisma.knowledgeLink.findMany({
      select: {
        id: true,
        sourceId: true,
        targetId: true,
        relation: true,
      },
    }),
  ]);

  return buildDatabaseKnowledgeGraphPayload(nodes, links, { includeLinks: true });
}

async function loadKnowledgeGraphRootFromDatabase(): Promise<UnifiedKnowledgeGraphPayload> {
  const [nodes, linkCount] = await Promise.all([
    prisma.knowledgeNode.findMany({
      where: { isActive: true },
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
    }),
    prisma.knowledgeLink.count(),
  ]);

  return buildDatabaseKnowledgeGraphPayload(nodes, [], { includeLinks: false, linkCount });
}

export async function loadKnowledgeGraphData(): Promise<UnifiedKnowledgeGraphPayload> {
  const now = Date.now();
  if (graphCache && sharedGraphCacheExpiresAt > now) {
    return graphCache.data;
  }

  const fileGraph = await loadKnowledgeGraphFromFiles();
  const data = fileGraph && fileGraph.nodes.length > 0 ? fileGraph : await loadKnowledgeGraphFromDatabase();
  const expiresAt = now + FILE_GRAPH_CACHE_TTL_MS;

  graphCache = {
    expiresAt,
    data,
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
  if (rootGraphCache && sharedGraphCacheExpiresAt > now) {
    return rootGraphCache.data;
  }

  const fileGraph = await loadKnowledgeGraphRootFromFiles();
  const data = fileGraph && fileGraph.nodes.length > 0 ? fileGraph : await loadKnowledgeGraphRootFromDatabase();
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
      .sort((left, right) => left.id.localeCompare(right.id)),
    links: graph.links
      .map((link) => ({
        id: link.id,
        sourceId: link.sourceId,
        targetId: link.targetId,
        relation: link.relation,
        relationType: link.relationType,
        strength: link.strength,
      }))
      .sort((left, right) => knowledgeGraphLinkKey(left).localeCompare(knowledgeGraphLinkKey(right))),
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
  return {
    id: `${CHAPTER_ROOT_NODE_PREFIX}${chapterName}`,
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
      nodes: chapterNodes.sort((left, right) => left.name.localeCompare(right.name, 'zh-Hans-CN')),
    }))
    .sort((left, right) => {
      const leftIndex = orderIndex.get(left.chapterName);
      const rightIndex = orderIndex.get(right.chapterName);
      if (typeof leftIndex === 'number' && typeof rightIndex === 'number') return leftIndex - rightIndex;
      if (typeof leftIndex === 'number') return -1;
      if (typeof rightIndex === 'number') return 1;
      return left.chapterName.localeCompare(right.chapterName, 'zh-Hans-CN');
    });
}

function chapterRootLinks(rootId: string, nodes: UnifiedKnowledgeNode[]): UnifiedKnowledgeLink[] {
  return nodes.map((node) => ({
    id: `chapter-link:${rootId}->${node.id}`,
    sourceId: rootId,
    targetId: node.id,
    relation: 'contains',
    relationType: 'contains',
    strength: 1,
  }));
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
  };
}

export function buildKnowledgeGraphManifestPayload(graph: UnifiedKnowledgeGraphPayload): KnowledgeGraphManifestPayload {
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

  return {
    mode: 'root',
    graphVersion,
    shardKey: buildProgressiveShardKey('root', graphVersion, 'chapters'),
    filterSignature: DEFAULT_GRAPH_FILTER_SIGNATURE,
    nodes: groups.map((group, index) => buildChapterRootNode(group.chapterName, index, group.nodes.length)),
    links: [],
    source: graph.source,
    rootSummaries,
  };
}

export function buildKnowledgeGraphExpansionPayload(
  graph: UnifiedKnowledgeGraphPayload,
  nodeId: string
): KnowledgeGraphProgressivePayload {
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

    return {
      mode: 'expansion',
      graphVersion,
      shardKey: buildProgressiveShardKey('expansion', graphVersion, nodeId),
      filterSignature: DEFAULT_GRAPH_FILTER_SIGNATURE,
      nodes: withCanonicalExpansionDescriptors(
        graph,
        graph.nodes.filter((node) => nodeIds.has(node.id))
      ),
      links: directLinks,
      source: graph.source,
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

  return {
    mode: 'expansion',
    graphVersion,
    shardKey: buildProgressiveShardKey('expansion', graphVersion, nodeId),
    filterSignature: DEFAULT_GRAPH_FILTER_SIGNATURE,
    nodes: [rootNode, ...withCanonicalExpansionDescriptors(graph, group.nodes)],
    links: [...chapterRootLinks(rootNode.id, group.nodes), ...groupLinks],
    source: graph.source,
  };
}

export function buildKnowledgeGraphActiveFilterPayload(graph: UnifiedKnowledgeGraphPayload): KnowledgeGraphProgressivePayload {
  const graphVersion = getKnowledgeGraphVersion(graph);
  return {
    mode: 'active-filter',
    graphVersion,
    shardKey: buildProgressiveShardKey('active-filter', graphVersion, DEFAULT_GRAPH_FILTER_SIGNATURE),
    filterSignature: DEFAULT_GRAPH_FILTER_SIGNATURE,
    nodes: withCanonicalExpansionDescriptors(graph, graph.nodes),
    links: boundedActiveFilterLinks(graph.links),
    source: graph.source,
  };
}

export function buildKnowledgeGraphRemainingPayload(graph: UnifiedKnowledgeGraphPayload): KnowledgeGraphProgressivePayload {
  const graphVersion = getKnowledgeGraphVersion(graph);
  return {
    mode: 'remaining',
    graphVersion,
    shardKey: buildProgressiveShardKey('remaining', graphVersion, 'all'),
    filterSignature: 'all',
    nodes: withCanonicalExpansionDescriptors(graph, graph.nodes),
    links: graph.links,
    source: graph.source,
  };
}

function resolveRelatedCategory(
  relation: string,
  isCurrentNodeSource: boolean
): RelatedCategory {
  const base = getRelationCategory(relation);
  if (isCurrentNodeSource && base === 'prerequisite') return 'follows';
  if (!isCurrentNodeSource && base === 'follows') return 'prerequisite';
  return base;
}

export function buildKnowledgeNodeDetailFromGraph(
  graph: UnifiedKnowledgeGraphPayload,
  nodeId: string
): UnifiedKnowledgeNodeDetail | null {
  const node = graph.nodes.find((item) => item.id === nodeId);
  if (!node) return null;

  const nodeById = new Map(graph.nodes.map((item) => [item.id, item]));
  const relatedMap = new Map<string, UnifiedKnowledgeNodeDetail['relatedNodes'][number]>();

  graph.links.forEach((link) => {
    const isSource = link.sourceId === nodeId;
    const isTarget = link.targetId === nodeId;
    if (!isSource && !isTarget) return;

    const relatedId = isSource ? link.targetId : link.sourceId;
    const relatedNode = nodeById.get(relatedId);
    if (!relatedNode) return;

    const item = {
      id: relatedNode.id,
      name: relatedNode.name,
      nodeType: relatedNode.nodeType,
      relation: link.relationType || link.relation,
      category: resolveRelatedCategory(link.relationType || link.relation, isSource),
      strength: link.strength ?? 1,
    };

    const existing = relatedMap.get(relatedId);
    if (!existing || item.strength > existing.strength) {
      relatedMap.set(relatedId, item);
    }
  });

  const relatedNodes = Array.from(relatedMap.values())
    .sort((a, b) => b.strength - a.strength || a.name.localeCompare(b.name, 'zh-Hans-CN'))
    .slice(0, 40);

  return {
    ...node,
    isActive: true,
    relatedNodes,
  };
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
    .sort((a, b) => a.name.localeCompare(b.name, 'zh-Hans-CN'));
}
