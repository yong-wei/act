import type { KnowledgeLinkData, KnowledgeNodeData } from './knowledge-graph-system';
import type { KnowledgeGraphNavigationView } from './graph/domain-navigation';
import type { SanitizedKnowledgeLessonContext } from '@/lib/knowledge-lesson-overlay';

interface GraphApiResponse {
  nodes?: KnowledgeNodeData[];
  links?: KnowledgeLinkData[];
  membershipLinks?: KnowledgeLinkData[];
  source?: 'file' | 'database';
  truncated?: { nodes?: boolean; links?: boolean; membershipLinks?: boolean };
  rootCatalog?: Array<{
    nodeId: string;
    nodeName: string;
    nodeType: KnowledgeNodeData['nodeType'];
    domainId: string;
    chapterName: string;
  }>;
  lessonContext?: SanitizedKnowledgeLessonContext | null;
}

export interface ProgressiveGraphApiResponse extends GraphApiResponse {
  mode?: 'root' | 'expansion' | 'active-filter' | 'remaining';
  graphVersion?: string;
  shardKey?: string;
  filterSignature?: string;
  domainId?: string;
}

export interface KnowledgeGraphCacheState {
  nodesById: Record<string, KnowledgeNodeData>;
  linksByKey: Record<string, KnowledgeLinkData>;
  membershipLinksByKey: Record<string, KnowledgeLinkData>;
  loadedShardKeys: string[];
  incompleteShardKeys: string[];
  loadingShardKeys: string[];
  graphVersion: string;
  filterSignature: string;
  rootNodeIds: string[];
  rootShardKey: string;
  domainNodeIdsByDomainId: Record<string, string[]>;
  domainLinkKeysByDomainId: Record<string, string[]>;
  domainMembershipLinkKeysByDomainId: Record<string, string[]>;
  domainShardKeysByDomainId: Record<string, string>;
  rootCatalogByNodeId: Record<string, NonNullable<GraphApiResponse['rootCatalog']>[number]>;
}

export function knowledgeLinkCacheKey(link: KnowledgeLinkData): string {
  return link.id || `${link.sourceId}->${link.targetId}:${link.relationType || link.relation || 'related'}`;
}

export function isKnowledgeNavigationMembershipLink(link: KnowledgeLinkData): boolean {
  return link.sourceId.startsWith('chapter-node:')
    && link.id === `chapter-link:${link.sourceId}->${link.targetId}`
    && (link.relationType || link.relation) === 'contains';
}

export function selectCanvasKnowledgeRelationLinks(
  links: readonly KnowledgeLinkData[]
): KnowledgeLinkData[] {
  return links.filter((link) => !isKnowledgeNavigationMembershipLink(link));
}

function normalizeKnowledgeNodeExpansion(node: KnowledgeNodeData): KnowledgeNodeData {
  return {
    ...node,
    expansion: node.expansion ?? { state: 'unknown' },
  };
}

function isRootNode(node: KnowledgeNodeData): boolean {
  const metadata = (node.metadata ?? {}) as Record<string, unknown>;
  return node.id.startsWith('chapter-node:')
    || metadata.isVirtualChapter === true
    || metadata.isCollapsedRoot === true;
}

export function buildInitialGraphCache(
  nodes: KnowledgeNodeData[],
  links: KnowledgeLinkData[]
): KnowledgeGraphCacheState {
  return {
    nodesById: Object.fromEntries(nodes.map((node) => [node.id, normalizeKnowledgeNodeExpansion(node)])),
    linksByKey: Object.fromEntries(
      selectCanvasKnowledgeRelationLinks(links).map((link) => [knowledgeLinkCacheKey(link), link])
    ),
    membershipLinksByKey: {},
    loadedShardKeys: [],
    incompleteShardKeys: [],
    loadingShardKeys: [],
    graphVersion: '',
    filterSignature: '',
    rootNodeIds: nodes.filter(isRootNode).map((node) => node.id),
    rootShardKey: '',
    domainNodeIdsByDomainId: {},
    domainLinkKeysByDomainId: {},
    domainMembershipLinkKeysByDomainId: {},
    domainShardKeysByDomainId: {},
    rootCatalogByNodeId: {},
  };
}

function hasTruncatedContent(payload: ProgressiveGraphApiResponse): boolean {
  return Object.values(payload.truncated ?? {}).some(Boolean);
}

function hasValidPayloadIdentity(
  current: KnowledgeGraphCacheState,
  payload: ProgressiveGraphApiResponse
): boolean {
  if (!payload.mode || !payload.graphVersion || !payload.shardKey) return false;
  if (payload.mode === 'root') {
    return payload.shardKey === `${payload.graphVersion}:shard:root:chapters`
      && payload.domainId === undefined;
  }
  if (!current.graphVersion || payload.graphVersion !== current.graphVersion) return false;
  if (payload.mode === 'expansion') {
    return Boolean(payload.domainId)
      && payload.shardKey === `${payload.graphVersion}:shard:expansion:${payload.domainId}`;
  }
  if (payload.mode === 'active-filter') {
    return payload.shardKey === `${payload.graphVersion}:shard:active-filter:${payload.filterSignature ?? 'default'}`;
  }
  return payload.shardKey === `${payload.graphVersion}:shard:remaining:all`;
}

export function mergeProgressiveGraphPayload(
  current: KnowledgeGraphCacheState,
  payload: ProgressiveGraphApiResponse
): KnowledgeGraphCacheState {
  if (!hasValidPayloadIdentity(current, payload)) return current;
  const graphVersion = payload.graphVersion ?? current.graphVersion;
  const versionMismatch = Boolean(current.graphVersion && graphVersion && current.graphVersion !== graphVersion);
  const resetForVersion = versionMismatch && payload.mode === 'root';
  if (payload.mode === 'expansion' && hasTruncatedContent(payload)) {
    const incompleteShardKeys = new Set(current.incompleteShardKeys);
    const loadedShardKeys = new Set(current.loadedShardKeys);
    const loadingShardKeys = new Set(current.loadingShardKeys);
    incompleteShardKeys.add(payload.shardKey!);
    loadedShardKeys.delete(payload.shardKey!);
    loadingShardKeys.delete(payload.shardKey!);
    return {
      ...current,
      incompleteShardKeys: [...incompleteShardKeys],
      loadedShardKeys: [...loadedShardKeys],
      loadingShardKeys: [...loadingShardKeys],
    };
  }
  const nodesById: Record<string, KnowledgeNodeData> = resetForVersion ? {} : { ...current.nodesById };
  const linksByKey: Record<string, KnowledgeLinkData> = resetForVersion ? {} : { ...current.linksByKey };
  const membershipLinksByKey: Record<string, KnowledgeLinkData> = resetForVersion
    ? {}
    : { ...current.membershipLinksByKey };

  for (const node of payload.nodes ?? []) {
    nodesById[node.id] = normalizeKnowledgeNodeExpansion(node);
  }
  for (const link of selectCanvasKnowledgeRelationLinks(payload.links ?? [])) {
    linksByKey[knowledgeLinkCacheKey(link)] = link;
  }
  for (const link of payload.membershipLinks ?? []) {
    if (!isKnowledgeNavigationMembershipLink(link)) continue;
    membershipLinksByKey[knowledgeLinkCacheKey(link)] = link;
  }

  const loadedShardKeys = new Set(resetForVersion ? [] : current.loadedShardKeys);
  const incompleteShardKeys = new Set(resetForVersion ? [] : current.incompleteShardKeys);
  const loadingShardKeys = new Set(resetForVersion ? [] : current.loadingShardKeys);
  if (payload.shardKey) {
    const isTruncated = hasTruncatedContent(payload);
    if (isTruncated) {
      loadedShardKeys.delete(payload.shardKey);
      incompleteShardKeys.add(payload.shardKey);
    } else {
      loadedShardKeys.add(payload.shardKey);
      incompleteShardKeys.delete(payload.shardKey);
    }
    loadingShardKeys.delete(payload.shardKey);
  }

  const domainId = payload.mode === 'expansion' ? payload.domainId : undefined;
  const domainNodeIdsByDomainId = resetForVersion ? {} : { ...current.domainNodeIdsByDomainId };
  const domainLinkKeysByDomainId = resetForVersion ? {} : { ...current.domainLinkKeysByDomainId };
  const domainMembershipLinkKeysByDomainId = resetForVersion
    ? {}
    : { ...current.domainMembershipLinkKeysByDomainId };
  const domainShardKeysByDomainId = resetForVersion ? {} : { ...current.domainShardKeysByDomainId };
  const rootCatalogByNodeId = resetForVersion ? {} : { ...current.rootCatalogByNodeId };
  if (domainId && payload.shardKey) {
    domainNodeIdsByDomainId[domainId] = [...new Set((payload.nodes ?? []).map((node) => node.id))];
    domainLinkKeysByDomainId[domainId] = [...new Set(
      selectCanvasKnowledgeRelationLinks(payload.links ?? []).map(knowledgeLinkCacheKey)
    )];
    domainMembershipLinkKeysByDomainId[domainId] = [...new Set(
      (payload.membershipLinks ?? []).filter(isKnowledgeNavigationMembershipLink).map(knowledgeLinkCacheKey)
    )];
    domainShardKeysByDomainId[domainId] = payload.shardKey;
  }
  if (payload.mode === 'root') {
    for (const entry of payload.rootCatalog ?? []) rootCatalogByNodeId[entry.nodeId] = entry;
  }

  return {
    nodesById,
    linksByKey,
    membershipLinksByKey,
    loadedShardKeys: [...loadedShardKeys],
    incompleteShardKeys: [...incompleteShardKeys],
    loadingShardKeys: [...loadingShardKeys],
    graphVersion,
    filterSignature: payload.filterSignature ?? current.filterSignature,
    rootNodeIds: payload.mode === 'root'
      ? (payload.nodes ?? []).filter(isRootNode).map((node) => node.id)
      : resetForVersion ? [] : current.rootNodeIds,
    rootShardKey: payload.mode === 'root' ? payload.shardKey ?? '' : resetForVersion ? '' : current.rootShardKey,
    domainNodeIdsByDomainId,
    domainLinkKeysByDomainId,
    domainMembershipLinkKeysByDomainId,
    domainShardKeysByDomainId,
    rootCatalogByNodeId,
  };
}

export function selectKnowledgeNavigationSnapshot(
  cache: KnowledgeGraphCacheState,
  view: KnowledgeGraphNavigationView
): { nodes: KnowledgeNodeData[]; links: KnowledgeLinkData[]; membershipLinks: KnowledgeLinkData[] } {
  const nodeIds = view.kind === 'root'
    ? cache.rootNodeIds
    : cache.domainNodeIdsByDomainId[view.domainId] ?? [view.domainId];
  const nodes = nodeIds.flatMap((nodeId) => cache.nodesById[nodeId] ? [cache.nodesById[nodeId]] : []);
  if (view.kind === 'root') return { nodes, links: [], membershipLinks: [] };
  const links = (cache.domainLinkKeysByDomainId[view.domainId] ?? [])
    .flatMap((key) => cache.linksByKey[key] ? [cache.linksByKey[key]] : []);
  const membershipLinks = (cache.domainMembershipLinkKeysByDomainId[view.domainId] ?? [])
    .flatMap((key) => cache.membershipLinksByKey[key] ? [cache.membershipLinksByKey[key]] : []);
  return { nodes, links, membershipLinks };
}
