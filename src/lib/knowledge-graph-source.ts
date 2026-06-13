import 'server-only';

import fs from 'fs/promises';
import path from 'path';
import { prisma } from '@/lib/prisma';
import { getRelationCategory, resolveChapterName } from '@/lib/knowledge-labels';

type NodeType = 'THEORY' | 'SCENARIO' | 'ETHICS';
type BloomLevel = 'REMEMBER' | 'UNDERSTAND' | 'APPLY' | 'ANALYZE' | 'EVALUATE' | 'CREATE';
type KnowledgeDim = 'FACTUAL' | 'CONCEPTUAL' | 'PROCEDURAL' | 'METACOGNITIVE';
type RelatedCategory = 'prerequisite' | 'follows' | 'related';

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
};

const FILE_GRAPH_CACHE_TTL_MS = 60_000;

let graphCache: {
  expiresAt: number;
  data: UnifiedKnowledgeGraphPayload;
} | null = null;

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

async function loadKnowledgeGraphFromFiles(): Promise<UnifiedKnowledgeGraphPayload | null> {
  const graphPath = path.join(process.cwd(), 'course-content', 'runtime', 'knowledge', 'graph', 'nodes.json');
  const relationsPath = path.join(process.cwd(), 'course-content', 'runtime', 'knowledge', 'graph', 'relations.jsonl');

  let rawNodes: string;
  let rawRelations: string;
  try {
    [rawNodes, rawRelations] = await Promise.all([
      fs.readFile(graphPath, 'utf-8'),
      fs.readFile(relationsPath, 'utf-8'),
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

  const nodes: UnifiedKnowledgeNode[] = parsedNodes.map((node) => {
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

  return {
    nodes: nodes.map((node) => {
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
        chapter,
        chapterName,
        metadata,
        content: (node.content ?? {}) as Record<string, unknown>,
        resources: Array.isArray(node.resources) ? (node.resources as unknown[]) : [],
        tags: node.tags ?? [],
      };
    }),
    links: links.map((link) => {
      const relationType = normalizeRelationType(link.relation);
      return {
        id: link.id,
        sourceId: link.sourceId,
        targetId: link.targetId,
        relation: relationType,
        relationType,
        strength: 1,
      };
    }),
    source: 'database',
  };
}

export async function loadKnowledgeGraphData(): Promise<UnifiedKnowledgeGraphPayload> {
  const now = Date.now();
  if (graphCache && graphCache.expiresAt > now) {
    return graphCache.data;
  }

  const fileGraph = await loadKnowledgeGraphFromFiles();
  const data = fileGraph && fileGraph.nodes.length > 0 ? fileGraph : await loadKnowledgeGraphFromDatabase();

  graphCache = {
    expiresAt: now + FILE_GRAPH_CACHE_TTL_MS,
    data,
  };

  return data;
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
