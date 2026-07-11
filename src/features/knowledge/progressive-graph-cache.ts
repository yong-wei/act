import type { KnowledgeLinkData, KnowledgeNodeData } from './knowledge-graph-system';

interface GraphApiResponse {
  nodes?: KnowledgeNodeData[];
  links?: KnowledgeLinkData[];
  source?: 'file' | 'database';
}

export interface ProgressiveGraphApiResponse extends GraphApiResponse {
  mode?: 'root' | 'expansion' | 'active-filter' | 'remaining';
  graphVersion?: string;
  shardKey?: string;
  filterSignature?: string;
}

export interface KnowledgeGraphCacheState {
  nodesById: Record<string, KnowledgeNodeData>;
  linksByKey: Record<string, KnowledgeLinkData>;
  loadedShardKeys: string[];
  loadingShardKeys: string[];
  graphVersion: string;
  filterSignature: string;
}

export function knowledgeLinkCacheKey(link: KnowledgeLinkData): string {
  return link.id || `${link.sourceId}->${link.targetId}:${link.relationType || link.relation || 'related'}`;
}

function normalizeKnowledgeNodeExpansion(node: KnowledgeNodeData): KnowledgeNodeData {
  return {
    ...node,
    expansion: node.expansion ?? { state: 'unknown' },
  };
}

export function buildInitialGraphCache(
  nodes: KnowledgeNodeData[],
  links: KnowledgeLinkData[]
): KnowledgeGraphCacheState {
  return {
    nodesById: Object.fromEntries(nodes.map((node) => [node.id, normalizeKnowledgeNodeExpansion(node)])),
    linksByKey: Object.fromEntries(links.map((link) => [knowledgeLinkCacheKey(link), link])),
    loadedShardKeys: [],
    loadingShardKeys: [],
    graphVersion: '',
    filterSignature: '',
  };
}

export function mergeProgressiveGraphPayload(
  current: KnowledgeGraphCacheState,
  payload: ProgressiveGraphApiResponse
): KnowledgeGraphCacheState {
  const graphVersion = payload.graphVersion ?? current.graphVersion;
  const resetForVersion = current.graphVersion && graphVersion && current.graphVersion !== graphVersion;
  const nodesById: Record<string, KnowledgeNodeData> = resetForVersion ? {} : { ...current.nodesById };
  const linksByKey: Record<string, KnowledgeLinkData> = resetForVersion ? {} : { ...current.linksByKey };

  for (const node of payload.nodes ?? []) {
    nodesById[node.id] = normalizeKnowledgeNodeExpansion(node);
  }
  for (const link of payload.links ?? []) {
    linksByKey[knowledgeLinkCacheKey(link)] = link;
  }

  const loadedShardKeys = new Set(resetForVersion ? [] : current.loadedShardKeys);
  const loadingShardKeys = new Set(resetForVersion ? [] : current.loadingShardKeys);
  if (payload.shardKey) {
    loadedShardKeys.add(payload.shardKey);
    loadingShardKeys.delete(payload.shardKey);
  }

  return {
    nodesById,
    linksByKey,
    loadedShardKeys: [...loadedShardKeys],
    loadingShardKeys: [...loadingShardKeys],
    graphVersion,
    filterSignature: payload.filterSignature ?? current.filterSignature,
  };
}
