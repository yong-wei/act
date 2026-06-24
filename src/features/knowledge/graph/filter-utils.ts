import {
  CHAPTER_DISPLAY_ORDER,
  getRelationCategory,
  resolveChapterName,
} from '@/lib/knowledge-labels';
import {
  getKnowledgeNodeScale,
  KNOWLEDGE_NODE_SCALE_CONTRACT,
} from './visual-config';
import type { KnowledgeLinkData, KnowledgeNodeData } from '../knowledge-graph-system';

const CHAPTER_ORDER_INDEX = new Map<string, number>(
  CHAPTER_DISPLAY_ORDER.map((name, index) => [name, index])
);

export const CHAPTER_NODE_PREFIX = 'chapter-node:';
export { CHAPTER_DISPLAY_ORDER, resolveChapterName };

export type RelationDensityMode = 'structure' | 'focused' | 'all';
export type RelationFocusState = 'neutral' | 'active' | 'dimmed';
export type RelationFamily = 'structure' | 'context' | 'optional' | 'weak';

export interface KnowledgeGraphStatistics {
  nodeCount: number;
  edgeCount: number;
  maxDegree: number;
  degreeByNodeId: Map<string, number>;
  importanceScoreByNodeId: Map<string, number>;
  relationFamilyCounts: Record<RelationFamily, number>;
}

export interface KnowledgeGraphFocusNeighborhood {
  focusNodeId: string | null;
  firstOrderNodeIds: Set<string>;
  secondOrderNodeIds: Set<string>;
  directLinkIds: Set<string>;
  contextualLinkIds: Set<string>;
}

export interface KnowledgeGraphClarityMetrics {
  nodeCount: number;
  visibleEdgeCount: number;
  edgeToNodeRatio: number;
  weakEdgeRatio: number;
  selectedNeighborhoodEdgeRatio: number;
  minNodeRadius: number;
  maxNodeRadius: number;
  relationFamilyCounts: Record<RelationFamily, number>;
}

const DEFAULT_STRUCTURE_RELATION_ORDER = [
  'contains',
  'prerequisite',
  'provides_foundation',
  'follows',
  'leads_to',
] as const;

const HIGH_SIGNAL_RELATION_ORDER = [
  ...DEFAULT_STRUCTURE_RELATION_ORDER,
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
] as const;

const HIGH_SIGNAL_RELATIONS = new Set<string>(HIGH_SIGNAL_RELATION_ORDER);
const WEAK_RELATION_MIN_STRENGTH = 0.7;

const STRUCTURE_RELATION_LIMITS: Record<string, { maxEdges: number; maxDegreePerNode: number }> = {
  contains: { maxEdges: 360, maxDegreePerNode: 4 },
  prerequisite: { maxEdges: 260, maxDegreePerNode: 3 },
  provides_foundation: { maxEdges: 180, maxDegreePerNode: 3 },
  follows: { maxEdges: 120, maxDegreePerNode: 2 },
  leads_to: { maxEdges: 120, maxDegreePerNode: 2 },
  applies_to: { maxEdges: 120, maxDegreePerNode: 2 },
  derives: { maxEdges: 110, maxDegreePerNode: 2 },
  determines: { maxEdges: 110, maxDegreePerNode: 2 },
  generalizes: { maxEdges: 100, maxDegreePerNode: 2 },
  instance_of: { maxEdges: 100, maxDegreePerNode: 2 },
  cross_domain: { maxEdges: 90, maxDegreePerNode: 2 },
  supports: { maxEdges: 90, maxDegreePerNode: 2 },
  enables: { maxEdges: 90, maxDegreePerNode: 2 },
  uses: { maxEdges: 90, maxDegreePerNode: 2 },
  visualized_by: { maxEdges: 80, maxDegreePerNode: 2 },
  quantified_by: { maxEdges: 80, maxDegreePerNode: 2 },
  embodies: { maxEdges: 80, maxDegreePerNode: 2 },
  describes_migration_of: { maxEdges: 70, maxDegreePerNode: 1 },
  complements: { maxEdges: 70, maxDegreePerNode: 1 },
  contrasts_with: { maxEdges: 70, maxDegreePerNode: 1 },
  informs: { maxEdges: 70, maxDegreePerNode: 1 },
  opposite: { maxEdges: 80, maxDegreePerNode: 1 },
  related: { maxEdges: 80, maxDegreePerNode: 1 },
};

export function getKnowledgeLinkKey(
  link: Pick<KnowledgeLinkData, 'sourceId' | 'targetId' | 'relation' | 'relationType'> & { id?: string }
): string {
  return link.id || `${link.sourceId}->${link.targetId}:${link.relationType || link.relation || 'related'}`;
}

export function getRelationFamily(relation?: string | null): RelationFamily {
  if (!relation || relation === 'related' || relation === 'informs') return 'weak';
  if (DEFAULT_STRUCTURE_RELATION_ORDER.includes(relation as (typeof DEFAULT_STRUCTURE_RELATION_ORDER)[number])) {
    return 'structure';
  }
  if (getRelationCategory(relation) === 'related') return 'optional';
  return 'context';
}

export function getBoundedKnowledgeNodeImportanceScore(metadata?: Record<string, unknown> | null): number {
  const safeMetadata = metadata ?? {};
  const rawImportance = safeMetadata.importance ?? safeMetadata.teachingImportance ?? safeMetadata.priority;
  if (typeof rawImportance === 'number') {
    const normalized = rawImportance > 1 && rawImportance <= 5 ? rawImportance / 5 : rawImportance;
    return Math.max(0, Math.min(1, normalized));
  }
  if (typeof rawImportance !== 'string') return 0.46;
  if (['core', '核心', 'essential', 'main'].includes(rawImportance)) return 0.96;
  if (['foundation', '基础', 'important'].includes(rawImportance)) return 0.82;
  if (['supporting', '辅助', 'optional'].includes(rawImportance)) return 0.38;
  return 0.56;
}

export function buildGraphStatistics(
  nodes: KnowledgeNodeData[],
  links: KnowledgeLinkData[]
): KnowledgeGraphStatistics {
  const nodeIds = new Set(nodes.map((node) => node.id));
  const degreeByNodeId = new Map<string, number>(nodes.map((node) => [node.id, 0]));
  const importanceScoreByNodeId = new Map<string, number>(
    nodes.map((node) => [node.id, getBoundedKnowledgeNodeImportanceScore(node.metadata)])
  );
  const relationFamilyCounts: Record<RelationFamily, number> = {
    structure: 0,
    context: 0,
    optional: 0,
    weak: 0,
  };
  let edgeCount = 0;

  links.forEach((link) => {
    if (!nodeIds.has(link.sourceId) || !nodeIds.has(link.targetId)) return;
    edgeCount += 1;
    degreeByNodeId.set(link.sourceId, (degreeByNodeId.get(link.sourceId) ?? 0) + 1);
    degreeByNodeId.set(link.targetId, (degreeByNodeId.get(link.targetId) ?? 0) + 1);
    relationFamilyCounts[getRelationFamily(link.relationType || link.relation)] += 1;
  });

  return {
    nodeCount: nodes.length,
    edgeCount,
    maxDegree: Math.max(0, ...Array.from(degreeByNodeId.values())),
    degreeByNodeId,
    importanceScoreByNodeId,
    relationFamilyCounts,
  };
}

export function buildFocusNeighborhood(
  links: KnowledgeLinkData[],
  focusNodeId?: string | null,
  eligibleNodeIds?: Set<string>
): KnowledgeGraphFocusNeighborhood {
  const firstOrderNodeIds = new Set<string>();
  const secondOrderNodeIds = new Set<string>();
  const directLinkIds = new Set<string>();
  const contextualLinkIds = new Set<string>();
  if (!focusNodeId) {
    return { focusNodeId: null, firstOrderNodeIds, secondOrderNodeIds, directLinkIds, contextualLinkIds };
  }

  const isEligible = (nodeId: string) => !eligibleNodeIds || eligibleNodeIds.has(nodeId);
  links.forEach((link) => {
    if (!isEligible(link.sourceId) || !isEligible(link.targetId)) return;
    if (link.sourceId !== focusNodeId && link.targetId !== focusNodeId) return;
    directLinkIds.add(getKnowledgeLinkKey(link));
    firstOrderNodeIds.add(link.sourceId === focusNodeId ? link.targetId : link.sourceId);
  });

  const contextualCandidates = links
    .filter((link) => {
      if (!isEligible(link.sourceId) || !isEligible(link.targetId)) return false;
      if (directLinkIds.has(getKnowledgeLinkKey(link))) return false;
      if (!isHighSignalRelation(link.relationType || link.relation)) return false;
      return firstOrderNodeIds.has(link.sourceId) || firstOrderNodeIds.has(link.targetId);
    })
    .sort((a, b) => {
      const strengthA = typeof a.strength === 'number' ? a.strength : 1;
      const strengthB = typeof b.strength === 'number' ? b.strength : 1;
      if (strengthA !== strengthB) return strengthB - strengthA;
      return getKnowledgeLinkKey(a).localeCompare(getKnowledgeLinkKey(b));
    });

  const secondOrderDegreeByFirstOrder = new Map<string, number>();
  contextualCandidates.forEach((link) => {
    const firstOrderEndpoint = firstOrderNodeIds.has(link.sourceId) ? link.sourceId : link.targetId;
    const secondOrderEndpoint = firstOrderEndpoint === link.sourceId ? link.targetId : link.sourceId;
    if (secondOrderEndpoint === focusNodeId || firstOrderNodeIds.has(secondOrderEndpoint)) return;
    const count = secondOrderDegreeByFirstOrder.get(firstOrderEndpoint) ?? 0;
    if (count >= 3 || contextualLinkIds.size >= 120) return;
    secondOrderDegreeByFirstOrder.set(firstOrderEndpoint, count + 1);
    secondOrderNodeIds.add(secondOrderEndpoint);
    contextualLinkIds.add(getKnowledgeLinkKey(link));
  });

  return { focusNodeId, firstOrderNodeIds, secondOrderNodeIds, directLinkIds, contextualLinkIds };
}

export function calculateGraphClarityMetrics(
  nodes: KnowledgeNodeData[],
  visibleLinks: KnowledgeLinkData[],
  focusNeighborhood?: KnowledgeGraphFocusNeighborhood
): KnowledgeGraphClarityMetrics {
  const statistics = buildGraphStatistics(nodes, visibleLinks);
  const radii = nodes.map((node) =>
    getKnowledgeNodeScale({
      metadata: node.metadata,
      degree: statistics.degreeByNodeId.get(node.id) ?? 0,
      focused: focusNeighborhood?.focusNodeId === node.id,
    }).radius
  );
  const neighborhoodLinkCount = visibleLinks.filter((link) => {
    const key = getKnowledgeLinkKey(link);
    return focusNeighborhood?.directLinkIds.has(key) || focusNeighborhood?.contextualLinkIds.has(key);
  }).length;
  const weakEdgeCount = visibleLinks.filter((link) => getRelationFamily(link.relationType || link.relation) === 'weak').length;

  return {
    nodeCount: nodes.length,
    visibleEdgeCount: visibleLinks.length,
    edgeToNodeRatio: nodes.length === 0 ? 0 : visibleLinks.length / nodes.length,
    weakEdgeRatio: visibleLinks.length === 0 ? 0 : weakEdgeCount / visibleLinks.length,
    selectedNeighborhoodEdgeRatio: visibleLinks.length === 0 ? 0 : neighborhoodLinkCount / visibleLinks.length,
    minNodeRadius: radii.length === 0 ? KNOWLEDGE_NODE_SCALE_CONTRACT.minRadius : Math.min(...radii),
    maxNodeRadius: radii.length === 0 ? KNOWLEDGE_NODE_SCALE_CONTRACT.minRadius : Math.max(...radii),
    relationFamilyCounts: statistics.relationFamilyCounts,
  };
}

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
  const availableTypes = new Set(types);
  const structureTypes = DEFAULT_STRUCTURE_RELATION_ORDER.filter((type) => availableTypes.has(type));
  if (structureTypes.length > 0) return structureTypes;
  const highSignalTypes = HIGH_SIGNAL_RELATION_ORDER.filter((type) => availableTypes.has(type));
  if (highSignalTypes.length > 0) return highSignalTypes.slice(0, 1);
  return types.slice(0, 1);
}

export function isHighSignalRelation(relation?: string | null): boolean {
  if (!relation) return false;
  if (HIGH_SIGNAL_RELATIONS.has(relation)) return true;
  return getRelationCategory(relation) !== 'related';
}

export function getRelationFocusState(
  sourceId: string,
  targetId: string,
  focusNodeId?: string | null
): RelationFocusState {
  if (!focusNodeId) return 'neutral';
  return sourceId === focusNodeId || targetId === focusNodeId ? 'active' : 'dimmed';
}

export function relationPassesDensity(
  link: Pick<KnowledgeLinkData, 'sourceId' | 'targetId' | 'relation' | 'relationType' | 'strength'>,
  options: {
    densityMode: RelationDensityMode;
    focusNodeId?: string | null;
    focusNeighborhood?: KnowledgeGraphFocusNeighborhood;
  }
): boolean {
  if (options.densityMode === 'all') return true;

  const relationType = link.relationType || link.relation || 'related';
  const linkKey = getKnowledgeLinkKey(link);
  const isDirectFocusLink = options.focusNeighborhood?.directLinkIds.has(linkKey) ?? false;
  const isContextualFocusLink = options.focusNeighborhood?.contextualLinkIds.has(linkKey) ?? false;
  if (options.densityMode === 'focused') {
    if (!options.focusNeighborhood?.focusNodeId) {
      if (isHighSignalRelation(relationType)) return true;
      const strength = typeof link.strength === 'number' ? link.strength : 1;
      return strength >= WEAK_RELATION_MIN_STRENGTH;
    }
    return isDirectFocusLink || isContextualFocusLink;
  }

  if (isHighSignalRelation(relationType)) return true;

  const strength = typeof link.strength === 'number' ? link.strength : 1;
  return strength >= WEAK_RELATION_MIN_STRENGTH;
}

export function relationPassesActiveFilters(
  link: Pick<KnowledgeLinkData, 'sourceId' | 'targetId' | 'relation' | 'relationType' | 'strength'>,
  options: {
    densityMode: RelationDensityMode;
    selectedRelationTypes: string[];
    minRelationStrength: number;
    focusNodeId?: string | null;
    focusNeighborhood?: KnowledgeGraphFocusNeighborhood;
  }
): boolean {
  if (options.densityMode !== 'all' && options.selectedRelationTypes.length === 0) return false;

  const relationType = link.relationType || link.relation || 'related';
  const strength = typeof link.strength === 'number' ? link.strength : 1;
  const isFocusedLink = options.densityMode === 'focused' && options.focusNodeId !== null
    && (link.sourceId === options.focusNodeId || link.targetId === options.focusNodeId);
  if (options.densityMode !== 'all' && !options.selectedRelationTypes.includes(relationType)) return false;
  if (options.densityMode !== 'all' && strength < options.minRelationStrength && !isFocusedLink) return false;
  return relationPassesDensity(link, {
    densityMode: options.densityMode,
    focusNodeId: options.focusNodeId,
    focusNeighborhood: options.focusNeighborhood,
  });
}

export function relationPassesFocusNeighborhoodSeedFilters(
  link: Pick<KnowledgeLinkData, 'sourceId' | 'targetId' | 'relation' | 'relationType' | 'strength'>,
  options: {
    densityMode: RelationDensityMode;
    selectedRelationTypes: string[];
    minRelationStrength: number;
    focusNodeId?: string | null;
  }
): boolean {
  if (options.densityMode === 'all') return true;
  if (options.selectedRelationTypes.length === 0) return false;

  const relationType = link.relationType || link.relation || 'related';
  if (!options.selectedRelationTypes.includes(relationType)) return false;

  const isDirectFocusLink = options.focusNodeId !== null
    && (link.sourceId === options.focusNodeId || link.targetId === options.focusNodeId);
  const strength = typeof link.strength === 'number' ? link.strength : 1;
  return isDirectFocusLink || strength >= options.minRelationStrength;
}

export function isNodeInFocusNeighborhood(
  nodeId: string,
  focusNeighborhood: KnowledgeGraphFocusNeighborhood
): boolean {
  return focusNeighborhood.focusNodeId === nodeId
    || focusNeighborhood.firstOrderNodeIds.has(nodeId)
    || focusNeighborhood.secondOrderNodeIds.has(nodeId);
}

export function isNodeVisibleInFocusedGraph(
  nodeId: string,
  focusNeighborhood: KnowledgeGraphFocusNeighborhood,
  visibleNodeIds: Set<string>
): boolean {
  if (focusNeighborhood.focusNodeId === nodeId) return true;
  if (!isNodeInFocusNeighborhood(nodeId, focusNeighborhood)) return false;
  return visibleNodeIds.has(nodeId);
}

export function limitStructureRelationDensity<T extends Pick<KnowledgeLinkData, 'sourceId' | 'targetId' | 'relation' | 'relationType' | 'strength'>>(
  links: T[],
  options: { focusNodeId?: string | null } = {}
): T[] {
  const selectedByType = new Map<string, number>();
  const degreeByNodeAndType = new Map<string, number>();
  const relationPriority = new Map<string, number>(
    DEFAULT_STRUCTURE_RELATION_ORDER.map((type, index) => [type, index])
  );

  return [...links]
    .sort((a, b) => {
      const activeA = getRelationFocusState(a.sourceId, a.targetId, options.focusNodeId) === 'active';
      const activeB = getRelationFocusState(b.sourceId, b.targetId, options.focusNodeId) === 'active';
      if (activeA !== activeB) return activeA ? -1 : 1;
      const typeA = a.relationType || a.relation || 'related';
      const typeB = b.relationType || b.relation || 'related';
      const priorityA = relationPriority.get(typeA) ?? 99;
      const priorityB = relationPriority.get(typeB) ?? 99;
      if (priorityA !== priorityB) return priorityA - priorityB;
      const strengthA = typeof a.strength === 'number' ? a.strength : 1;
      const strengthB = typeof b.strength === 'number' ? b.strength : 1;
      if (strengthA !== strengthB) return strengthB - strengthA;
      return `${a.sourceId}:${a.targetId}`.localeCompare(`${b.sourceId}:${b.targetId}`);
    })
    .filter((link) => {
      if (getRelationFocusState(link.sourceId, link.targetId, options.focusNodeId) === 'active') {
        return true;
      }

      const relationType = link.relationType || link.relation || 'related';
      const limit = STRUCTURE_RELATION_LIMITS[relationType];
      if (!limit) return false;

      const selectedCount = selectedByType.get(relationType) ?? 0;
      if (selectedCount >= limit.maxEdges) return false;

      const sourceKey = `${relationType}:${link.sourceId}`;
      const targetKey = `${relationType}:${link.targetId}`;
      const sourceDegree = degreeByNodeAndType.get(sourceKey) ?? 0;
      const targetDegree = degreeByNodeAndType.get(targetKey) ?? 0;
      if (sourceDegree >= limit.maxDegreePerNode || targetDegree >= limit.maxDegreePerNode) return false;

      selectedByType.set(relationType, selectedCount + 1);
      degreeByNodeAndType.set(sourceKey, sourceDegree + 1);
      degreeByNodeAndType.set(targetKey, targetDegree + 1);
      return true;
    });
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
