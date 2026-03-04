import {
  CHAPTER_DISPLAY_ORDER,
  getRelationCategory,
  resolveChapterName,
} from '@/lib/knowledge-labels';
import type { KnowledgeLinkData, KnowledgeNodeData } from '../knowledge-graph-system';

const CHAPTER_ORDER_INDEX = new Map<string, number>(
  CHAPTER_DISPLAY_ORDER.map((name, index) => [name, index])
);

export const CHAPTER_NODE_PREFIX = 'chapter-node:';
export { CHAPTER_DISPLAY_ORDER, resolveChapterName };

export function isChapterNodeId(nodeId?: string | null): boolean {
  if (!nodeId) return false;
  return nodeId.startsWith(CHAPTER_NODE_PREFIX);
}

function stringifyArrayValue(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string');
}

function extractNodeTextForSearch(node: KnowledgeNodeData): string {
  const metadata = (node.metadata ?? {}) as Record<string, unknown>;
  const metadataKeywords = stringifyArrayValue(metadata.keywords);
  const metadataExamples = stringifyArrayValue(metadata.examples);
  const metadataFormulas = stringifyArrayValue(metadata.formulas);
  const metadataCategory = typeof metadata.category === 'string' ? metadata.category : '';
  const metadataBloom = typeof metadata.bloom_level === 'string' ? metadata.bloom_level : '';
  const chapterName = resolveChapterName(
    node.chapter,
    (typeof node.chapterName === 'string' ? node.chapterName : null) ??
      (typeof metadata.chapterName === 'string' ? metadata.chapterName : null)
  );

  return [
    node.name,
    node.description,
    ...(node.tags ?? []),
    ...metadataKeywords,
    ...metadataExamples,
    ...metadataFormulas,
    metadataCategory,
    metadataBloom,
    chapterName,
  ]
    .join(' ')
    .toLowerCase();
}

export function matchesNodeFilters(
  node: KnowledgeNodeData,
  filters: {
    searchQuery?: string;
    selectedChapters?: string[];
    selectedCategories?: string[];
    selectedBloomLevels?: string[];
  }
): boolean {
  const metadata = (node.metadata ?? {}) as Record<string, unknown>;
  const chapterName = resolveChapterName(
    node.chapter,
    (typeof node.chapterName === 'string' ? node.chapterName : null) ??
      (typeof metadata.chapterName === 'string' ? metadata.chapterName : null)
  );
  const category =
    (typeof metadata.category === 'string' ? metadata.category : '') || node.knowledgeDim || '';
  const bloom =
    (typeof metadata.bloom_level === 'string' ? metadata.bloom_level : '') || node.bloomLevel || '';

  if (filters.selectedChapters && filters.selectedChapters.length > 0) {
    if (!filters.selectedChapters.includes(chapterName)) return false;
  }

  if (filters.selectedCategories && filters.selectedCategories.length > 0) {
    if (!filters.selectedCategories.includes(category)) return false;
  }

  if (filters.selectedBloomLevels && filters.selectedBloomLevels.length > 0) {
    if (!filters.selectedBloomLevels.includes(bloom)) return false;
  }

  const keyword = filters.searchQuery?.trim().toLowerCase();
  if (!keyword) return true;
  return extractNodeTextForSearch(node).includes(keyword);
}

export function buildRelationTypeStats(
  links: Array<Pick<KnowledgeLinkData, 'sourceId' | 'targetId' | 'relation' | 'relationType'>>,
  eligibleNodeIds: Set<string>
): Array<{ type: string; count: number }> {
  const counts = new Map<string, number>();
  links.forEach((link) => {
    if (!eligibleNodeIds.has(link.sourceId) || !eligibleNodeIds.has(link.targetId)) return;
    const type = link.relationType || link.relation || 'related';
    counts.set(type, (counts.get(type) ?? 0) + 1);
  });

  return Array.from(counts.entries())
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count || a.type.localeCompare(b.type));
}

export function buildDefaultSelectedRelationTypes(types: string[]): string[] {
  const prerequisiteTypes = types.filter((type) => getRelationCategory(type) === 'prerequisite');
  if (prerequisiteTypes.length > 0) return prerequisiteTypes;
  return types.slice(0, 1);
}

export function buildChapterGroups(nodes: KnowledgeNodeData[]): Array<{
  chapterName: string;
  nodes: KnowledgeNodeData[];
}> {
  const groups = new Map<string, KnowledgeNodeData[]>();

  nodes.forEach((node) => {
    const metadata = (node.metadata ?? {}) as Record<string, unknown>;
    const chapterName = resolveChapterName(
      node.chapter,
      (typeof node.chapterName === 'string' ? node.chapterName : null) ??
        (typeof metadata.chapterName === 'string' ? metadata.chapterName : null)
    );
    const list = groups.get(chapterName) ?? [];
    list.push(node);
    groups.set(chapterName, list);
  });

  return Array.from(groups.entries())
    .map(([chapterName, chapterNodes]) => ({
      chapterName,
      nodes: chapterNodes.sort((a, b) => a.name.localeCompare(b.name, 'zh-Hans-CN')),
    }))
    .sort((a, b) => {
      const orderA = CHAPTER_ORDER_INDEX.get(a.chapterName);
      const orderB = CHAPTER_ORDER_INDEX.get(b.chapterName);
      if (typeof orderA === 'number' && typeof orderB === 'number') return orderA - orderB;
      if (typeof orderA === 'number') return -1;
      if (typeof orderB === 'number') return 1;
      return a.chapterName.localeCompare(b.chapterName, 'zh-Hans-CN');
    });
}

export function injectChapterNodes(
  nodes: KnowledgeNodeData[],
  links: KnowledgeLinkData[]
): { nodes: KnowledgeNodeData[]; links: KnowledgeLinkData[] } {
  if (nodes.length === 0) return { nodes, links };

  const groups = buildChapterGroups(nodes);
  const chapterNodes: KnowledgeNodeData[] = [];
  const chapterLinks: KnowledgeLinkData[] = [];

  groups.forEach((group, index) => {
    const chapterNodeId = `${CHAPTER_NODE_PREFIX}${group.chapterName}`;
    chapterNodes.push({
      id: chapterNodeId,
      name: group.chapterName,
      chapterName: group.chapterName,
      chapter: index + 1,
      nodeType: 'THEORY',
      knowledgeDim: 'METACOGNITIVE',
      bloomLevel: 'UNDERSTAND',
      description: `${group.chapterName}（共 ${group.nodes.length} 个知识点）`,
      positionX: 0,
      positionY: 0,
      positionZ: index + 1,
      metadata: {
        isVirtualChapter: true,
        chapterName: group.chapterName,
        nodeCount: group.nodes.length,
      },
      tags: ['chapter'],
    });

    group.nodes.forEach((node) => {
      chapterLinks.push({
        id: `chapter-link:${chapterNodeId}->${node.id}`,
        sourceId: chapterNodeId,
        targetId: node.id,
        relation: 'contains',
        relationType: 'contains',
        strength: 1,
      });
    });
  });

  return {
    nodes: [...chapterNodes, ...nodes],
    links: [...chapterLinks, ...links],
  };
}
