'use client';

/**
 * KnowledgeGraphSystem - 船舶知识图谱交互系统主组件
 *
 * 重构自 knowledge0316.html，使用 React Three Fiber
 */

import { Suspense, useState, useCallback, useEffect, useRef, useMemo, useReducer, type CSSProperties, type Dispatch, type KeyboardEvent, type SetStateAction } from 'react';
import dynamic from 'next/dynamic';
import { BookOpen, Filter, LocateFixed, SlidersHorizontal, X } from 'lucide-react';
import { useGlobalAI } from '@/components/providers/global-ai-provider';
import type { PlatformRole } from '@/components/platform/platform-ui-contracts';
import type { SanitizedKnowledgeLessonContext } from '@/lib/knowledge-lesson-overlay';
import { KnowledgeSidebar } from './sidebar/knowledge-sidebar';
import { ResourcePanel } from './resource-panel/resource-panel';
import {
  CHAPTER_DISPLAY_ORDER,
  getBloomLabel,
  getKnowledgeDimLabel,
  resolveChapterName,
} from '@/lib/knowledge-labels';
import {
  buildFocusNeighborhood,
  buildGraphStatistics,
  calculateGraphClarityMetrics,
  injectChapterNodes,
  matchesNodeFilters,
} from './graph/filter-utils';
import type { KnowledgeGraphLabelMode } from './graph/label-policy';
import type { KnowledgeGraphCameraPose } from './graph/knowledge-graph-canvas';
import { getGraphFilterLabel, KNOWLEDGE_GRAPH_FAMILY_PRESENTATION_CONFIG } from './graph/visual-config';
import {
  DEFAULT_KNOWLEDGE_GRAPH_RELATION_FAMILIES,
  selectCanonicalDomainRelationEdges,
  selectLearnerVisibleRelationEdges,
  toggleAllRelationFamilies,
  toggleRelationFamily,
} from './graph/relation-family-controls';
import type { KnowledgeGraphRelationFamily } from './graph/relation-contract';
import { RelationFamilyControl, resolveRelationFamilyControlPlacement } from './graph/relation-family-control';
import {
  clearKnowledgeGraphLayoutPins,
  getEmptyKnowledgeGraphLayoutState,
  getKnowledgeGraphRuntimeNodePosition,
  isKnowledgeGraphNodePinned,
  removeKnowledgeGraphNodePin,
  storeKnowledgeGraphNodePosition,
} from './graph/layout-state';
import {
  applyRadialLayout,
} from './graph/layout-engine';
import {
  resolveKnowledgeLessonLocation,
  resolveInitialKnowledgeNodeId,
} from './graph/node-activation';
import {
  createKnowledgeGraphNavigationState,
  knowledgeGraphNavigationReducer,
} from './graph/domain-navigation';
import {
  createKnowledgeInspectionState,
  knowledgeInspectionReducer,
} from './graph/inspection-state';
import { KnowledgeDomainReturnAction } from './graph/domain-return-action';
import type { KnowledgeGraphFitRequest } from './graph/root-layout';
import { buildKnowledgeTeachingOrderLayout } from './graph/teaching-order-layout';
import { getKnowledgeNodeSemanticLabel } from './graph/node-label-layout';
import { selectKnowledgeGraphFocusedPresentationLinks } from './graph/edge-presentation';
import { deriveSelectedKnowledgeGraphCorridor } from './graph/selected-corridor';
import {
  buildInitialGraphCache,
  mergeProgressiveGraphPayload,
  selectCanvasKnowledgeRelationLinks,
  selectKnowledgeNavigationSnapshot,
  type KnowledgeGraphCacheState,
  type ProgressiveGraphApiResponse,
} from './progressive-graph-cache';
import {
  buildKnowledgeGraphDomainRequestUrl,
  buildKnowledgeGraphRootRequestUrl,
} from './graph/knowledge-graph-request';
// import { getAllLessonCards, getAllLessonCardLinks } from './data/lesson-knowledge-cards'; // Removed static import

// 动态导入 3D 图谱组件（客户端专用）
const KnowledgeGraphCanvas = dynamic(
  () => import('./graph/knowledge-graph-canvas').then((mod) => mod.KnowledgeGraphCanvas),
  { ssr: false }
);

// 动态导入 2D 图谱组件（客户端专用）
const KnowledgeGraph2D = dynamic(
  () => import('./graph/knowledge-graph-2d').then((mod) => mod.KnowledgeGraph2D),
  { ssr: false }
);

// 知识节点类型
export type NodeType = 'THEORY' | 'SCENARIO' | 'ETHICS';
type KnowledgeMobileTool = 'chapter-directory' | 'node-filters' | 'view-layout';
type KnowledgeDesktopTool = KnowledgeMobileTool;
const DESKTOP_TOOL_PANEL_ID_PREFIX = 'knowledge-desktop-tool-panel';
const KNOWLEDGE_WORKSPACE_STYLE = {
  '--knowledge-workspace-inset': '1rem',
  '--knowledge-local-tool-panel-width': 'min(28rem, calc(100vw - 38rem))',
  '--knowledge-inspector-width': 'clamp(22.5rem,30vw,28.75rem)',
} as CSSProperties;
const KNOWLEDGE_LOCAL_TOOL_PANEL_CLASS = 'mt-2 max-h-[min(36rem,calc(100dvh-9rem))] w-[var(--knowledge-local-tool-panel-width)] min-w-[22rem] overflow-y-auto rounded-xl border border-platform-border bg-platform-surface/95 p-3 text-xs text-platform-fg-primary shadow-xl backdrop-blur-md';
const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');
// 知识节点接口 (Aligned with Prisma Model)
export interface KnowledgeNodeData {
  id: string;
  name: string;
  nodeType: NodeType;
  description: string;
  positionX: number;
  positionY: number;
  positionZ: number;
  bloomLevel?: string;
  knowledgeDim?: string;
  metadata?: any; // New field for atomized content
  content?: Record<string, unknown>; // Legacy support
  resources?: unknown[];
  tags?: string[];
  chapter?: number;
  chapterName?: string;
  ethicsContent?: Record<string, unknown>;
  graphDegree?: number;
  graphImportanceScore?: number;
  importance?: number;
  expansion?: {
    state: 'expandable' | 'leaf' | 'unknown';
    revealableNeighborCount?: number;
  };
}

// 知识连接接口
export interface KnowledgeLinkData {
  id: string;
  sourceId: string;
  targetId: string;
  relation: string;
  relationType?: string;
  strength?: number;
}

interface KnowledgeGraphSystemProps {
  // Props can still be passed for initial state or override, but we default to fetching
  initialNodes?: KnowledgeNodeData[];
  initialLinks?: KnowledgeLinkData[];
  initialSelectedNodeId?: string | null;
  trustedLessonId?: string | null;
  viewerRole?: PlatformRole;
}

function isCollapsedRootNode(node: KnowledgeNodeData): boolean {
  const metadata = (node.metadata ?? {}) as Record<string, unknown>;
  return Boolean(metadata.isVirtualChapter || metadata.isCollapsedRoot || node.id.startsWith('chapter-node:'));
}

function hasNodeFilters(input: {
  searchQuery: string;
  selectedChapters: string[];
  selectedCategories: string[];
  selectedBloomLevels: string[];
}) {
  return Boolean(
    input.searchQuery.trim()
    || input.selectedChapters.length > 0
    || input.selectedCategories.length > 0
    || input.selectedBloomLevels.length > 0
  );
}

function collapsedRootMatchesNodeFilters(
  rootNode: KnowledgeNodeData,
  rootChildren: KnowledgeNodeData[],
  filters: Parameters<typeof matchesNodeFilters>[1]
) {
  if (matchesNodeFilters(rootNode, filters)) return true;
  if (rootChildren.length === 0) return true;
  return rootChildren.some((child) => matchesNodeFilters(child, filters));
}

export function KnowledgeGraphSystem({
  initialNodes = [],
  initialLinks = [],
  initialSelectedNodeId = null,
  trustedLessonId = null,
  viewerRole = 'student',
}: KnowledgeGraphSystemProps) {
  const { updatePageContext, isOpen: aiSidebarOpen } = useGlobalAI();
  const initialRequestedNodeId = initialSelectedNodeId;
  const [graphCache, setGraphCache] = useState<KnowledgeGraphCacheState>(() => buildInitialGraphCache(initialNodes, initialLinks));
  const [navigation, dispatchNavigation] = useReducer(
    knowledgeGraphNavigationReducer,
    undefined,
    createKnowledgeGraphNavigationState
  );
  const navigationSnapshot = useMemo(
    () => selectKnowledgeNavigationSnapshot(graphCache, navigation.view),
    [graphCache, navigation.view]
  );
  const nodes = navigationSnapshot.nodes;
  const links = navigationSnapshot.links;
  const corridorLinks = navigationSnapshot.corridorLinks;
  const corridorCycleEdgeIds = navigationSnapshot.corridorCycleEdgeIds;
  const membershipLinks = navigationSnapshot.membershipLinks;
  const rootCatalogNodes = useMemo<KnowledgeNodeData[]>(() => (
    Object.values(graphCache.rootCatalogByNodeId).map((entry) => ({
      id: entry.nodeId,
      name: entry.nodeName,
      nodeType: entry.nodeType,
      description: '',
      positionX: 0,
      positionY: 0,
      positionZ: 0,
      chapterName: entry.chapterName,
      metadata: { chapterName: entry.chapterName },
      expansion: { state: 'leaf' },
    }))
  ), [graphCache.rootCatalogByNodeId]);

  const [requestedNodeId, setRequestedNodeId] = useState<string | null>(initialRequestedNodeId);
  const initialLessonLocationRef = useRef(
    typeof window === 'undefined'
      ? { lessonId: trustedLessonId, search: '' }
      : resolveKnowledgeLessonLocation(window.location.search, trustedLessonId)
  );
  const [requestedLessonId, setRequestedLessonId] = useState<string | null>(
    initialLessonLocationRef.current.lessonId
  );
  const [activeLessonId, setActiveLessonId] = useState<string | null>(null);
  const [lessonContext, setLessonContext] = useState<SanitizedKnowledgeLessonContext | null>(null);
  const [inspection, dispatchInspection] = useReducer(
    knowledgeInspectionReducer<KnowledgeNodeData>,
    undefined,
    createKnowledgeInspectionState<KnowledgeNodeData>
  );
  const selectedNode = inspection.selectedNode;
  const isPanelOpen = inspection.isPanelOpen;
  const explicitFocusNodeId = inspection.explicitFocusNodeId;
  const [hoveredNode, setHoveredNode] = useState<KnowledgeNodeData | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [enabledRelationFamilies, setEnabledRelationFamilies] = useState<KnowledgeGraphRelationFamily[]>(
    () => [...DEFAULT_KNOWLEDGE_GRAPH_RELATION_FAMILIES]
  );
  const [selectedChapters, setSelectedChapters] = useState<string[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedBloomLevels, setSelectedBloomLevels] = useState<string[]>([]);
  const [labelMode, setLabelMode] = useState<KnowledgeGraphLabelMode>('focus');
  const [desktopActiveTool, setDesktopActiveTool] = useState<KnowledgeDesktopTool | null>(null);
  const [mobileActiveTool, setMobileActiveTool] = useState<KnowledgeMobileTool>('chapter-directory');
  const [mobileToolPanelOpen, setMobileToolPanelOpen] = useState(false);
  const [isLightTheme, setIsLightTheme] = useState(false);
  const [layoutState, setLayoutState] = useState(getEmptyKnowledgeGraphLayoutState);
  const [fitViewRequest, setFitViewRequest] = useState<KnowledgeGraphFitRequest>({
    id: 0,
    target: 'root',
  });
  const teachingLayoutFitDomainRef = useRef<string | null>(null);
  const materializedDomainFitSignaturesRef = useRef(new Set<string>());
  const [relayoutVersion, setRelayoutVersion] = useState(0);
  const hoverAnimationFrameRef = useRef<number | null>(null);
  const pendingHoveredNodeRef = useRef<KnowledgeNodeData | null>(null);
  const hoveredNodeIdRef = useRef<string | null>(null);
  const desktopToolPanelRef = useRef<HTMLDivElement | null>(null);
  const desktopToolTriggerRefs = useRef<Partial<Record<KnowledgeDesktopTool, HTMLButtonElement | null>>>({});
  const previousDesktopToolRef = useRef<KnowledgeDesktopTool | null>(null);
  const mobileToolPanelRef = useRef<HTMLDivElement | null>(null);
  const mobileToolToggleRef = useRef<HTMLButtonElement | null>(null);
  const mountedRef = useRef(true);
  const navigationRequestSequenceRef = useRef(0);
  const navigationRequestControllerRef = useRef<AbortController | null>(null);
  const loadingShardOwnerByKeyRef = useRef(new Map<string, number>());
  const currentNavigationLoadingRef = useRef<{ shardKey: string; requestId: number } | null>(null);

  // 视图模式：默认 2D
  const [viewMode, setViewMode] = useState<'2D' | '3D'>('2D');
  const [manipulatedAutoFitScopeKeys, setManipulatedAutoFitScopeKeys] = useState<ReadonlySet<string>>(
    () => new Set()
  );
  const [consumedAutoFitScopeKeys, setConsumedAutoFitScopeKeys] = useState<ReadonlySet<string>>(
    () => new Set()
  );
  const cameraPoseByAutoFitScopeRef = useRef(new Map<string, KnowledgeGraphCameraPose>());

  // 容器尺寸测量
  const containerRef = useRef<HTMLDivElement>(null);
  const initialRequestedNodeIdRef = useRef(initialRequestedNodeId);
  const initialSelectedNodeResolvedRef = useRef(false);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });

  useEffect(() => {
    const loadingShardOwners = loadingShardOwnerByKeyRef.current;
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      navigationRequestSequenceRef.current += 1;
      navigationRequestControllerRef.current?.abort();
      navigationRequestControllerRef.current = null;
      loadingShardOwners.clear();
      currentNavigationLoadingRef.current = null;
    };
  }, []);

  useEffect(() => {
    const syncLocation = (allowTrustedContext: boolean) => {
      const lessonLocation = resolveKnowledgeLessonLocation(
        window.location.search,
        allowTrustedContext ? trustedLessonId : null
      );
      if (lessonLocation.search !== window.location.search) {
        window.history.replaceState(window.history.state, '', `${window.location.pathname}${lessonLocation.search}`);
      }
      setActiveLessonId((current) => current === lessonLocation.lessonId ? current : null);
      setLessonContext((current) => current?.lessonId === lessonLocation.lessonId ? current : null);
      setRequestedLessonId(lessonLocation.lessonId);
      const nodeId = resolveInitialKnowledgeNodeId(window.location.search, initialRequestedNodeIdRef.current);
      initialRequestedNodeIdRef.current = nodeId;
      initialSelectedNodeResolvedRef.current = false;
      setRequestedNodeId(nodeId);
    };

    syncLocation(true);
    const handlePopState = () => syncLocation(false);
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [trustedLessonId]);

  // 监听容器大小变化
  useEffect(() => {
    const container = containerRef.current;
    const updateSize = () => {
      if (container) {
        setDimensions({
          width: container.offsetWidth,
          height: container.offsetHeight
        });
      }
    };

    // 初始化
    updateSize();

    const observer = typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(updateSize)
      : null;
    if (container) {
      observer?.observe(container);
    }

    window.addEventListener('resize', updateSize);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', updateSize);
    };
  }, []);

  useEffect(() => {
    const updateTheme = () => {
      setIsLightTheme(document.documentElement.classList.contains('light'));
    };

    updateTheme();
    const observer = new MutationObserver(updateTheme);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  const fetchGraphPayload = useCallback(async (url: string, controller: AbortController) => {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) throw new Error(`Knowledge graph request failed with ${response.status}`);
    return (await response.json()) as ProgressiveGraphApiResponse;
  }, []);

  const registerLoadingShard = useCallback((shardKey: string, requestId: number) => {
    if (!shardKey) return;
    loadingShardOwnerByKeyRef.current.set(shardKey, requestId);
    currentNavigationLoadingRef.current = { shardKey, requestId };
    setGraphCache((current) => ({
      ...current,
      loadingShardKeys: current.loadingShardKeys.includes(shardKey)
        ? current.loadingShardKeys
        : [...current.loadingShardKeys, shardKey],
    }));
  }, []);

  const clearOwnedLoadingShard = useCallback((shardKey: string, requestId: number) => {
    if (!shardKey || loadingShardOwnerByKeyRef.current.get(shardKey) !== requestId) return;
    loadingShardOwnerByKeyRef.current.delete(shardKey);
    if (
      currentNavigationLoadingRef.current?.shardKey === shardKey
      && currentNavigationLoadingRef.current.requestId === requestId
    ) {
      currentNavigationLoadingRef.current = null;
    }
    if (!mountedRef.current) return;
    setGraphCache((current) => ({
      ...current,
      loadingShardKeys: current.loadingShardKeys.filter((key) => key !== shardKey),
    }));
  }, []);

  const loadRoot = useCallback(async () => {
    const currentLoading = currentNavigationLoadingRef.current;
    if (currentLoading) clearOwnedLoadingShard(currentLoading.shardKey, currentLoading.requestId);
    navigationRequestControllerRef.current?.abort();
    const controller = new AbortController();
    const requestId = ++navigationRequestSequenceRef.current;
    navigationRequestControllerRef.current = controller;
    setActiveLessonId(null);
    setLessonContext(null);
    dispatchInspection({ type: 'return-root' });
    dispatchNavigation({ type: 'root-loading', requestId });
    try {
      const payload = await fetchGraphPayload(
        buildKnowledgeGraphRootRequestUrl({ lessonId: requestedLessonId }),
        controller
      );
      if (!mountedRef.current || controller.signal.aborted || requestId !== navigationRequestSequenceRef.current) return;
      if (
        payload.mode !== 'root'
        || !payload.graphVersion
        || payload.shardKey !== `${payload.graphVersion}:shard:root:chapters`
        || payload.domainId !== undefined
        || Object.values(payload.truncated ?? {}).some(Boolean)
      ) {
        throw new Error('Invalid root shard response');
      }
      setGraphCache((current) => mergeProgressiveGraphPayload(current, payload));
      const verifiedLessonId = payload.lessonContext?.lessonId ?? null;
      if (requestedLessonId && verifiedLessonId !== requestedLessonId) {
        const params = new URLSearchParams(window.location.search);
        params.delete('lessonId');
        const search = params.toString();
        window.history.replaceState(
          window.history.state,
          '',
          `${window.location.pathname}${search ? `?${search}` : ''}`
        );
        setRequestedLessonId(null);
        setActiveLessonId(null);
        setLessonContext(null);
      } else {
        setActiveLessonId(verifiedLessonId);
        setLessonContext(payload.lessonContext ?? null);
      }
      dispatchNavigation({ type: 'root-loaded', requestId, graphVersion: payload.graphVersion });
      const nodeId = initialRequestedNodeIdRef.current
        ?? resolveInitialKnowledgeNodeId(window.location.search);
      initialRequestedNodeIdRef.current = nodeId;
      setRequestedNodeId(nodeId);
    } catch (error) {
      if ((error as Error).name === 'AbortError' || controller.signal.aborted) return;
      console.error('Error fetching knowledge graph root shard:', error);
      setActiveLessonId(null);
      setLessonContext(null);
      dispatchNavigation({ type: 'root-failed', requestId, error: '知识领域加载失败，请重试。' });
    }
  }, [clearOwnedLoadingShard, fetchGraphPayload, requestedLessonId]);

  useEffect(() => {
    void loadRoot();
    return () => navigationRequestControllerRef.current?.abort();
  }, [loadRoot]);

  const loadDomain = useCallback(async (domainId: string, retry = false, targetNodeId?: string) => {
    const cachedShardKey = graphCache.domainShardKeysByDomainId[domainId];
    const cached = Boolean(cachedShardKey && graphCache.loadedShardKeys.includes(cachedShardKey));
    const requestId = ++navigationRequestSequenceRef.current;
    const intendedTargetNodeId = targetNodeId
      ?? (retry ? inspection.pendingNavigationTarget?.nodeId : undefined);
    const isCurrentCachedDomain = navigation.view.kind === 'domain'
      && navigation.view.domainId === domainId
      && cached
      && !retry;
    if (isCurrentCachedDomain && !intendedTargetNodeId) return;
    if (isCurrentCachedDomain && intendedTargetNodeId) {
      const targetNode = graphCache.nodesById[intendedTargetNodeId];
      if (targetNode) dispatchInspection({ type: 'inspect-node', node: targetNode });
      return;
    }
    if (!retry || intendedTargetNodeId) {
      dispatchInspection({
        type: 'begin-navigation',
        intentId: requestId,
        ...(intendedTargetNodeId ? {
          targetNodeId: intendedTargetNodeId,
        } : {}),
      });
    }
    const currentLoading = currentNavigationLoadingRef.current;
    if (currentLoading) clearOwnedLoadingShard(currentLoading.shardKey, currentLoading.requestId);
    navigationRequestControllerRef.current?.abort();
    navigationRequestControllerRef.current = null;
    if (cached && !retry) {
      dispatchNavigation({ type: 'enter-domain', domainId, requestId, cached: true });
      if (intendedTargetNodeId) {
        const targetNode = graphCache.nodesById[intendedTargetNodeId];
        if (targetNode) {
          dispatchInspection({
            type: 'commit-navigation-target',
            intentId: requestId,
            nodeId: intendedTargetNodeId,
            node: targetNode,
          });
        }
      }
      return;
    }

    const controller = new AbortController();
    navigationRequestControllerRef.current = controller;
    dispatchNavigation(retry
      ? { type: 'retry-domain', requestId }
      : { type: 'enter-domain', domainId, requestId, cached: false });
    const expectedShardKey = graphCache.graphVersion
      ? `${graphCache.graphVersion}:shard:expansion:${domainId}`
      : '';
    registerLoadingShard(expectedShardKey, requestId);
    try {
      const payload = await fetchGraphPayload(
        buildKnowledgeGraphDomainRequestUrl({ domainId }),
        controller
      );
      if (!mountedRef.current || controller.signal.aborted || requestId !== navigationRequestSequenceRef.current) return;
      if (
        payload.mode !== 'expansion'
        || payload.domainId !== domainId
        || payload.graphVersion !== graphCache.graphVersion
        || payload.shardKey !== expectedShardKey
      ) {
        throw new Error('Invalid or stale domain shard response');
      }
      setGraphCache((current) => mergeProgressiveGraphPayload(current, payload));
      if (Object.values(payload.truncated ?? {}).some(Boolean)) {
        dispatchNavigation({
          type: 'domain-incomplete',
          domainId,
          requestId,
          error: '领域知识分片不完整，请重试。',
        });
        return;
      }
      dispatchNavigation({ type: 'domain-loaded', domainId, requestId });
      if (intendedTargetNodeId) {
        const targetNode = payload.nodes?.find((node) => node.id === intendedTargetNodeId);
        if (targetNode) {
          dispatchInspection({
            type: 'commit-navigation-target',
            intentId: requestId,
            nodeId: intendedTargetNodeId,
            node: targetNode,
          });
        }
      }
    } catch (error) {
      if ((error as Error).name === 'AbortError' || controller.signal.aborted) return;
      if (requestId !== navigationRequestSequenceRef.current) return;
      console.error('Error fetching knowledge graph domain shard:', error);
      dispatchNavigation({ type: 'domain-failed', domainId, requestId, error: '领域知识加载失败，请重试。' });
    } finally {
      clearOwnedLoadingShard(expectedShardKey, requestId);
    }
  }, [clearOwnedLoadingShard, fetchGraphPayload, graphCache.domainShardKeysByDomainId, graphCache.graphVersion, graphCache.loadedShardKeys, graphCache.nodesById, inspection.pendingNavigationTarget?.nodeId, navigation.view, registerLoadingShard]);

  const returnToRoot = useCallback(() => {
    navigationRequestSequenceRef.current += 1;
    const currentLoading = currentNavigationLoadingRef.current;
    if (currentLoading) clearOwnedLoadingShard(currentLoading.shardKey, currentLoading.requestId);
    navigationRequestControllerRef.current?.abort();
    navigationRequestControllerRef.current = null;
    dispatchInspection({ type: 'return-root' });
    dispatchNavigation({ type: 'return-root' });
    setFitViewRequest((current) => ({ id: current.id + 1, target: 'root' }));
  }, [clearOwnedLoadingShard]);

  const resolveRootReturnFocus = useCallback(() => {
    if (navigation.view.kind !== 'domain') return null;
    const domainId = navigation.view.domainId;
    return Array.from(document.querySelectorAll<HTMLElement>('[data-knowledge-node-control]'))
      .find((element) => element.dataset.knowledgeNodeControl === domainId)
      ?? document.querySelector<HTMLElement>('[data-knowledge-canvas-primary="true"]');
  }, [navigation.view]);

  const activateNodeById = useCallback((nodeId: string) => {
    const node = graphCache.nodesById[nodeId]
      ?? rootCatalogNodes.find((candidate) => candidate.id === nodeId);
    if (!node) return;
    if (isCollapsedRootNode(node)) {
      if (navigation.view.kind === 'domain'
        && navigation.view.domainId === node.id
        && navigation.status === 'loading') return;
      void loadDomain(node.id);
      return;
    }
    const catalogEntry = graphCache.rootCatalogByNodeId[nodeId];
    const chapterName = catalogEntry?.chapterName ?? resolveChapterName(node.chapter, node.chapterName);
    const domainId = catalogEntry?.domainId ?? (chapterName ? `chapter-node:${chapterName}` : null);
    if (!domainId) return;
    const cachedShardKey = graphCache.domainShardKeysByDomainId[domainId];
    const domainCached = Boolean(cachedShardKey && graphCache.loadedShardKeys.includes(cachedShardKey));
    if (navigation.view.kind === 'domain' && navigation.view.domainId === domainId && domainCached) {
      dispatchInspection({ type: 'inspect-node', node });
      return;
    }
    void loadDomain(domainId, false, nodeId);
  }, [graphCache.domainShardKeysByDomainId, graphCache.loadedShardKeys, graphCache.nodesById, graphCache.rootCatalogByNodeId, loadDomain, navigation.status, navigation.view, rootCatalogNodes]);

  const activateNode = useCallback((node: KnowledgeNodeData) => {
    activateNodeById(node.id);
  }, [activateNodeById]);

  useEffect(() => {
    if (!requestedNodeId || initialSelectedNodeResolvedRef.current) return;
    const requestedNode = graphCache.nodesById[requestedNodeId]
      ?? rootCatalogNodes.find((node) => node.id === requestedNodeId);
    if (!requestedNode) return;
    initialSelectedNodeResolvedRef.current = true;
    activateNodeById(requestedNodeId);
  }, [activateNodeById, graphCache.nodesById, requestedNodeId, rootCatalogNodes]);

  // 节点悬停处理
  const handleNodeHover = useCallback((node: KnowledgeNodeData | null) => {
    pendingHoveredNodeRef.current = node;
    if (hoverAnimationFrameRef.current !== null) return;
    hoverAnimationFrameRef.current = window.requestAnimationFrame(() => {
      hoverAnimationFrameRef.current = null;
      const nextNode = pendingHoveredNodeRef.current;
      const nextNodeId = nextNode?.id ?? null;
      if (hoveredNodeIdRef.current === nextNodeId) return;
      hoveredNodeIdRef.current = nextNodeId;
      setHoveredNode(nextNode);
    });
  }, []);

  useEffect(() => () => {
    if (hoverAnimationFrameRef.current !== null) {
      window.cancelAnimationFrame(hoverAnimationFrameRef.current);
    }
  }, []);

  const handleNodeDragEnd = useCallback((node: KnowledgeNodeData) => {
    const runtimePosition = getKnowledgeGraphRuntimeNodePosition(
      node as KnowledgeNodeData & { x?: number; y?: number; z?: number }
    );
    if (!runtimePosition) return;
    setLayoutState((current) =>
      storeKnowledgeGraphNodePosition(current, runtimePosition)
    );
  }, []);

  // 关闭资源面板
  const handleClosePanel = useCallback(() => {
    dispatchInspection({ type: 'close-inspector' });
  }, []);

  const chapterOptions = useMemo(() => {
    const chapterSet = new Set<string>();
    nodes.forEach((node) => {
      const chapterName = resolveChapterName(
        node.chapter,
        typeof node.chapterName === 'string' ? node.chapterName : null
      );
      chapterSet.add(chapterName);
    });

    const listed = CHAPTER_DISPLAY_ORDER.filter((item) => chapterSet.has(item));
    const unlisted = Array.from(chapterSet)
      .filter((item) => !CHAPTER_DISPLAY_ORDER.includes(item as (typeof CHAPTER_DISPLAY_ORDER)[number]))
      .sort((a, b) => a.localeCompare(b, 'zh-Hans-CN'));
    return [...listed, ...unlisted];
  }, [nodes]);

  const categoryOptions = useMemo(() => {
    const categorySet = new Set<string>();
    nodes.forEach((node) => {
      if (isCollapsedRootNode(node)) return;
      const metadata = (node.metadata ?? {}) as Record<string, unknown>;
      const category = typeof metadata.category === 'string' ? metadata.category : node.knowledgeDim;
      if (category) categorySet.add(category);
    });
    return Array.from(categorySet).sort((a, b) => a.localeCompare(b, 'zh-Hans-CN'));
  }, [nodes]);

  const bloomOptions = useMemo(() => {
    const bloomSet = new Set<string>();
    nodes.forEach((node) => {
      if (isCollapsedRootNode(node)) return;
      const metadata = (node.metadata ?? {}) as Record<string, unknown>;
      const bloom = typeof metadata.bloom_level === 'string' ? metadata.bloom_level : node.bloomLevel;
      if (bloom) bloomSet.add(bloom);
    });
    return Array.from(bloomSet).sort((a, b) => a.localeCompare(b, 'zh-Hans-CN'));
  }, [nodes]);

  const collapsedRootChildNodesByRootId = useMemo(() => {
    const childrenByRootId = new Map<string, KnowledgeNodeData[]>();
    nodes.forEach((node) => {
      if (isCollapsedRootNode(node)) return;
      const metadata = (node.metadata ?? {}) as Record<string, unknown>;
      const chapterName = resolveChapterName(
        node.chapter,
        typeof node.chapterName === 'string'
          ? node.chapterName
          : (typeof metadata.chapterName === 'string' ? metadata.chapterName : null)
      );
      const rootId = `chapter-node:${chapterName}`;
      const current = childrenByRootId.get(rootId) ?? [];
      current.push(node);
      childrenByRootId.set(rootId, current);
    });
    const nodeById = new Map(nodes.map((node) => [node.id, node]));
    membershipLinks.forEach((link) => {
      const relation = link.relationType || link.relation;
      if (relation !== 'contains' || !link.sourceId.startsWith('chapter-node:')) return;
      const child = nodeById.get(link.targetId);
      if (!child || isCollapsedRootNode(child)) return;
      const current = childrenByRootId.get(link.sourceId) ?? [];
      if (current.some((node) => node.id === child.id)) return;
      current.push(child);
      childrenByRootId.set(link.sourceId, current);
    });
    return childrenByRootId;
  }, [membershipLinks, nodes]);
  const navigationVisibleNodeIds = useMemo(
    () => new Set(nodes.map((node) => node.id)),
    [nodes]
  );

  // 节点筛选（章节 / category / bloom_level / 搜索关键词）
  const nodeFilteredByMeta = useMemo(
    () => {
      const filters = {
        searchQuery,
        selectedChapters,
        selectedCategories,
        selectedBloomLevels,
      };
      const hasActiveNodeFilters = hasNodeFilters(filters);
      return nodes.filter((node) => {
        if (!navigationVisibleNodeIds.has(node.id)) return false;
        if (isCollapsedRootNode(node) && hasActiveNodeFilters) {
          return collapsedRootMatchesNodeFilters(
            node,
            collapsedRootChildNodesByRootId.get(node.id) ?? [],
            filters
          );
        }
        return matchesNodeFilters(node, filters);
      });
    },
    [collapsedRootChildNodesByRootId, navigationVisibleNodeIds, nodes, searchQuery, selectedChapters, selectedCategories, selectedBloomLevels]
  );

  const nodeFilterIdSet = useMemo(
    () => new Set(nodeFilteredByMeta.map((item) => item.id)),
    [nodeFilteredByMeta]
  );
  const directoryNodes = useMemo(() => {
    if (rootCatalogNodes.length === 0) return nodeFilteredByMeta;
    const filters = {
      searchQuery,
      selectedChapters,
      selectedCategories,
      selectedBloomLevels,
    };
    return rootCatalogNodes.filter((node) => matchesNodeFilters(node, filters));
  }, [nodeFilteredByMeta, rootCatalogNodes, searchQuery, selectedBloomLevels, selectedCategories, selectedChapters]);

  const eligibleLinks = useMemo(
    () => links.filter((link) => nodeFilterIdSet.has(link.sourceId) && nodeFilterIdSet.has(link.targetId)),
    [links, nodeFilterIdSet]
  );
  const graphStatistics = useMemo(
    () => buildGraphStatistics(nodeFilteredByMeta, eligibleLinks),
    [eligibleLinks, nodeFilteredByMeta]
  );
  const graphFilterFocusNodeId = explicitFocusNodeId && nodeFilterIdSet.has(explicitFocusNodeId)
    ? explicitFocusNodeId
    : null;

  const expandedDirectLinks = useMemo<KnowledgeLinkData[]>(() => [], []);

  const filteredNodes = nodeFilteredByMeta;

  const filteredNodeIdSet = useMemo(() => new Set(filteredNodes.map((item) => item.id)), [filteredNodes]);
  const domainMemberNodeIdSet = useMemo(() => new Set(nodes.map((node) => node.id)), [nodes]);

  const filteredLinks = useMemo(() => selectLearnerVisibleRelationEdges({
    links: eligibleLinks,
    activeDomainNodeIds: domainMemberNodeIdSet,
    enabledFamilies: enabledRelationFamilies,
    selectedNodeId: selectedNode?.id ?? null,
  }).map((edge) => ({
    id: edge.relationIds[0] ?? edge.key,
    sourceId: edge.sourceId,
    targetId: edge.targetId,
    relation: edge.relationType,
    relationType: edge.relationType,
    strength: edge.strength ?? undefined,
  })), [domainMemberNodeIdSet, eligibleLinks, enabledRelationFamilies, selectedNode?.id]);

  const canonicalPresentationLinks = useMemo(() => selectCanonicalDomainRelationEdges({
    links: eligibleLinks,
    activeDomainNodeIds: domainMemberNodeIdSet,
  }).map((edge) => ({
    id: edge.relationIds[0] ?? edge.key,
    sourceId: edge.sourceId,
    targetId: edge.targetId,
    relation: edge.relationType,
    relationType: edge.relationType,
    strength: edge.strength ?? undefined,
  })), [domainMemberNodeIdSet, eligibleLinks]);

  const graphWithChapterNodes = useMemo(() => {
    const scoredNodes = filteredNodes.map((node) => ({
      ...node,
      graphDegree: graphStatistics.degreeByNodeId.get(node.id) ?? 0,
      graphImportanceScore: typeof node.importance === 'number'
        ? Math.max(0, Math.min(1, node.importance / 5))
        : graphStatistics.importanceScoreByNodeId.get(node.id) ?? 0,
    }));
    if (scoredNodes.some(isCollapsedRootNode)) {
      return { nodes: scoredNodes, links: filteredLinks };
    }
    return injectChapterNodes(scoredNodes, filteredLinks);
  }, [filteredNodes, filteredLinks, graphStatistics]);

  const displayNodes = graphWithChapterNodes.nodes;
  const displayLinks = useMemo(
    () => selectCanvasKnowledgeRelationLinks(graphWithChapterNodes.links),
    [graphWithChapterNodes.links]
  );
  const teachingOrderLinks = useMemo(
    () => navigation.view.kind === 'domain' ? links : [],
    [links, navigation.view.kind]
  );
  const teachingOrderLayout = useMemo(() => navigation.view.kind === 'domain'
    ? buildKnowledgeTeachingOrderLayout({
        nodes: displayNodes,
        links: teachingOrderLinks,
        lessonOrderNodeIds: lessonContext?.cardOrderNodeIds ?? [],
        viewportWidth: dimensions.width || 1280,
        viewportHeight: dimensions.height || 720,
      })
    : null,
  [dimensions.height, dimensions.width, displayNodes, lessonContext, navigation.view.kind, teachingOrderLinks]);
  const autoFitScopeKey = navigation.view.kind === 'domain'
    ? `${navigation.view.domainId}:${lessonContext?.overlayRevision ?? 'post-only'}`
    : null;
  const autoFitReady = navigation.status === 'ready';
  const handleCameraManipulation = useCallback((scopeKey: string) => {
    setManipulatedAutoFitScopeKeys((current) => {
      if (current.has(scopeKey)) return current;
      const next = new Set(current);
      next.add(scopeKey);
      return next;
    });
  }, []);
  const handleAutoFitConsumed = useCallback((scopeKey: string) => {
    setConsumedAutoFitScopeKeys((current) => {
      if (current.has(scopeKey)) return current;
      const next = new Set(current);
      next.add(scopeKey);
      return next;
    });
  }, []);
  const handleCameraPoseChange = useCallback((scopeKey: string, pose: KnowledgeGraphCameraPose) => {
    cameraPoseByAutoFitScopeRef.current.set(scopeKey, pose);
  }, []);
  const lessonOrderConflictCount = teachingOrderLayout?.diagnostics.filter(
    (diagnostic) => diagnostic.code === 'LESSON_POST_REQUISITE_CONFLICT'
  ).length ?? 0;
  const postRequisiteCycleCount = teachingOrderLayout?.diagnostics.filter(
    (diagnostic) => diagnostic.code === 'POST_REQUISITE_CYCLE'
  ).length ?? 0;
  useEffect(() => {
    if (navigation.view.kind !== 'root') return;
    materializedDomainFitSignaturesRef.current.clear();
    teachingLayoutFitDomainRef.current = null;
  }, [navigation.view]);
  useEffect(() => {
    if (
      navigation.view.kind !== 'domain'
      || navigation.status !== 'ready'
      || displayNodes.length <= 1
    ) return;
    const signature = [
      graphCache.graphVersion,
      navigation.view.domainId,
      lessonContext?.overlayRevision ?? 'post-only',
    ].join(':');
    if (materializedDomainFitSignaturesRef.current.has(signature)) return;
    let settledFrame = 0;
    const materializedFrame = window.requestAnimationFrame(() => {
      settledFrame = window.requestAnimationFrame(() => {
        if (materializedDomainFitSignaturesRef.current.has(signature)) return;
        materializedDomainFitSignaturesRef.current.add(signature);
        setFitViewRequest((current) => ({ id: current.id + 1, target: 'current' }));
      });
    });
    return () => {
      window.cancelAnimationFrame(materializedFrame);
      window.cancelAnimationFrame(settledFrame);
    };
  }, [
    displayNodes.length,
    graphCache.graphVersion,
    lessonContext,
    navigation.status,
    navigation.view,
  ]);
  useEffect(() => {
    if (navigation.view.kind !== 'domain' || !teachingOrderLayout || !lessonContext) return;
    const signature = `${navigation.view.domainId}:${lessonContext.overlayRevision}`;
    if (teachingLayoutFitDomainRef.current === signature) return;
    if (teachingOrderLayout.fitScale < 1) {
      teachingLayoutFitDomainRef.current = signature;
      setFitViewRequest((current) => ({ id: current.id + 1, target: 'teaching-layout' }));
    }
  }, [lessonContext, navigation.view, teachingOrderLayout]);
  const rendererLayoutVersion = `${graphCache.graphVersion}:${lessonContext?.overlayRevision ?? 'post-only'}`;
  useEffect(() => {
    if (navigation.view.kind !== 'domain') return;
    dispatchNavigation({
      type: 'domain-filter-result',
      domainId: navigation.view.domainId,
      visibleMemberCount: displayNodes.filter((node) => !isCollapsedRootNode(node)).length,
    });
  }, [displayNodes, navigation.status, navigation.view]);
  const displaySelectedNode = selectedNode
    ? displayNodes.find((node) => node.id === selectedNode.id) ?? null
    : null;
  const visibleSelectedNode = useMemo(
    () => selectedNode && displaySelectedNode
      ? { ...displaySelectedNode, ...selectedNode }
      : null,
    [displaySelectedNode, selectedNode]
  );
  const inspectorSelectedNode = useMemo(
    () => selectedNode
      ? { ...selectedNode, ...(displaySelectedNode ?? {}) }
      : null,
    [displaySelectedNode, selectedNode]
  );
  const canvasSelectedNode = displaySelectedNode && selectedNode
    ? { ...displaySelectedNode, ...selectedNode }
    : null;
  const canvasSelectedNodeId = canvasSelectedNode?.id ?? null;
  const domainIdByNodeId = useMemo(() => new Map(
    Object.values(graphCache.rootCatalogByNodeId).map((entry) => [entry.nodeId, entry.domainId])
  ), [graphCache.rootCatalogByNodeId]);
  const corridorCycleEdgeIdSet = useMemo(
    () => new Set(corridorCycleEdgeIds),
    [corridorCycleEdgeIds]
  );
  const selectedCorridor = useMemo(() => canvasSelectedNodeId
    ? deriveSelectedKnowledgeGraphCorridor({
        selectedNodeId: canvasSelectedNodeId,
        links: [...links, ...corridorLinks],
        domainMemberNodeIds: domainMemberNodeIdSet,
        visibleNodeIds: filteredNodeIdSet,
        domainIdByNodeId,
        precomputedMotionSuppressedEdgeIds: corridorCycleEdgeIdSet,
      })
    : null,
  [canvasSelectedNodeId, corridorCycleEdgeIdSet, corridorLinks, domainIdByNodeId, domainMemberNodeIdSet, filteredNodeIdSet, links]);
  const selectedCorridorEmphasis = useMemo(() => selectedCorridor ? ({
    selectedNodeId: selectedCorridor.selectedNodeId,
    nodeIds: selectedCorridor.canvasVisibleNodeIds,
    edgeIds: selectedCorridor.canvasVisibleEdgeIds,
    primaryEdgeIds: selectedCorridor.primaryEdgeIds,
    primaryNodeIds: selectedCorridor.primaryNodeIds,
    motionEligibleEdgeIds: selectedCorridor.motionEligibleEdgeIds,
    motionSuppressedEdgeIds: selectedCorridor.motionSuppressedEdgeIds,
  }) : null, [selectedCorridor]);
  const renderDisplayLinks = useMemo(() => selectKnowledgeGraphFocusedPresentationLinks({
    links: displayLinks,
    emphasis: selectedCorridorEmphasis,
  }), [displayLinks, selectedCorridorEmphasis]);
  const visiblePanelOpen = isPanelOpen;
  const relationFamilyControlPlacement = resolveRelationFamilyControlPlacement({
    isMobile: dimensions.width < 1024,
    inspectorVisible: visiblePanelOpen && Boolean(visibleSelectedNode),
    toolPanelVisible: !aiSidebarOpen && mobileToolPanelOpen,
  });
  const mobileInspectorControlVisible = relationFamilyControlPlacement === 'inspector';
  const mobileToolControlVisible = relationFamilyControlPlacement === 'tool-panel';
  const konlingContextStatus = visibleSelectedNode
    ? 'selected-node'
    : requestedNodeId
      ? 'degraded'
      : 'no-selection';
  const pinnedNodeCount = Object.keys(layoutState.positionsByNodeId).length;
  const pinnedLayoutSignature = Object.entries(layoutState.positionsByNodeId)
    .map(([nodeId, position]) =>
      `${nodeId}:${position.x.toFixed(1)},${position.y.toFixed(1)},${(position.z ?? 0).toFixed(1)}`
    )
    .sort()
    .join('|');
  const selectedNodePinned = isKnowledgeGraphNodePinned(layoutState, visibleSelectedNode?.id);
  const selectedNodeFallbackLayoutPosition = useMemo(() => {
    if (!visibleSelectedNode) return null;
    const positionedNode = applyRadialLayout(displayNodes, displayLinks, undefined, 180)
      .find((node) => node.id === visibleSelectedNode.id);
    return getKnowledgeGraphRuntimeNodePosition(
      positionedNode as (KnowledgeNodeData & { x?: number; y?: number; z?: number }) | null | undefined
    );
  }, [displayLinks, displayNodes, visibleSelectedNode]);
  const selectedNodeRuntimePosition = getKnowledgeGraphRuntimeNodePosition(
    visibleSelectedNode as (KnowledgeNodeData & { x?: number; y?: number; z?: number }) | null
  ) ?? selectedNodeFallbackLayoutPosition;
  const selectedNodePinUnavailable = Boolean(visibleSelectedNode && !selectedNodePinned && !selectedNodeRuntimePosition);
  const selectedNodeFocused = Boolean(visibleSelectedNode && graphFilterFocusNodeId === visibleSelectedNode.id);
  const selectedNodeRelationCount = visibleSelectedNode
    ? displayLinks.filter((link) => link.sourceId === visibleSelectedNode.id || link.targetId === visibleSelectedNode.id).length
    : 0;
  const navigationStatusText = navigation.view.kind === 'root'
    ? navigation.status === 'loading'
      ? '正在加载知识领域。'
      : navigation.status === 'failure'
        ? navigation.error ?? '知识领域加载失败，请重试。'
        : '知识领域已就绪。'
    : navigation.status === 'loading'
      ? '正在加载当前领域知识。'
      : navigation.status === 'failure' || navigation.status === 'incomplete'
        ? navigation.error ?? '领域知识加载失败，请重试。'
        : navigation.status === 'filtered-empty'
          ? '当前筛选条件下没有可见知识点。'
          : '当前领域知识已就绪。';
  const mobileKonlingModalOpen = aiSidebarOpen && dimensions.width < 640;
  const activeFilterSummary = [
    searchQuery ? `搜索：${searchQuery}` : '',
    selectedChapters.length > 0 ? `章节 ${selectedChapters.length}` : '',
    selectedCategories.length > 0 ? `分类 ${selectedCategories.length}` : '',
    selectedBloomLevels.length > 0 ? `层级 ${selectedBloomLevels.length}` : '',
  ].filter(Boolean).join(' · ') || '未启用额外筛选';
  const knowledgeWorkspaceFilterSummary = [
    searchQuery.trim() ? '搜索词已启用' : '',
    selectedChapters.length > 0 ? `章节 ${selectedChapters.length}` : '',
    selectedCategories.length > 0 ? `分类 ${selectedCategories.length}` : '',
    selectedBloomLevels.length > 0 ? `层级 ${selectedBloomLevels.length}` : '',
  ].filter(Boolean).join(' · ') || '未启用额外筛选';

  const toggleFamily = useCallback((family: KnowledgeGraphRelationFamily) => {
    setEnabledRelationFamilies((current) => toggleRelationFamily(current, family));
  }, []);

  const toggleAllFamilies = useCallback(() => {
    setEnabledRelationFamilies(toggleAllRelationFamilies);
  }, []);

  const toggleMultiSelectValue = useCallback(
    (value: string, setter: Dispatch<SetStateAction<string[]>>) => {
      setter((prev) => (prev.includes(value) ? prev.filter((item) => item !== value) : [...prev, value]));
    },
    []
  );

  const handleFitView = useCallback(() => {
    setFitViewRequest((current) => ({ id: current.id + 1, target: 'current' }));
  }, []);

  const handleRelayout = useCallback(() => {
    setLayoutState((current) => ({
      version: current.version + 1,
      positionsByNodeId: {},
    }));
    setRelayoutVersion((current) => current + 1);
    setFitViewRequest((current) => ({ id: current.id + 1, target: 'current' }));
  }, []);

  const handleToggleSelectedNodePin = useCallback(() => {
    if (!visibleSelectedNode) return;
    if (isKnowledgeGraphNodePinned(layoutState, visibleSelectedNode.id)) {
      setLayoutState((current) => removeKnowledgeGraphNodePin(current, visibleSelectedNode.id));
      return;
    }
    if (!selectedNodeRuntimePosition) return;
    setLayoutState((current) =>
      storeKnowledgeGraphNodePosition(current, selectedNodeRuntimePosition)
    );
  }, [layoutState, selectedNodeRuntimePosition, visibleSelectedNode]);

  const handleClearLayoutPins = useCallback(() => {
    setLayoutState((current) => clearKnowledgeGraphLayoutPins(current));
  }, []);

  const handleBlankCanvasClick = useCallback(() => {
    dispatchInspection({ type: 'dismiss-selection' });
  }, []);

  const handleToggleSelectedFocus = useCallback(() => {
    if (!visibleSelectedNode) return;
    dispatchInspection({ type: 'toggle-explicit-focus', nodeId: visibleSelectedNode.id });
  }, [visibleSelectedNode]);

  useEffect(() => {
    if (desktopActiveTool) {
      previousDesktopToolRef.current = desktopActiveTool;
      window.requestAnimationFrame(() => {
        const panel = desktopToolPanelRef.current;
        const focusTarget = panel?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR) ?? panel;
        focusTarget?.focus();
      });
      return;
    }

    const previousTool = previousDesktopToolRef.current;
    if (!previousTool) return;
    previousDesktopToolRef.current = null;
    window.requestAnimationFrame(() => {
      desktopToolTriggerRefs.current[previousTool]?.focus();
    });
  }, [desktopActiveTool]);

  const closeDesktopTool = useCallback(() => {
    setDesktopActiveTool(null);
  }, []);

  const handleDesktopToolPanelKeyDown = useCallback((event: KeyboardEvent<HTMLElement>) => {
    if (event.key !== 'Escape') return;
    event.stopPropagation();
    closeDesktopTool();
  }, [closeDesktopTool]);

  useEffect(() => {
    if (!mobileToolPanelOpen) return;
    window.requestAnimationFrame(() => {
      mobileToolPanelRef.current?.focus();
    });
  }, [mobileActiveTool, mobileToolPanelOpen]);

  const handleMobileToolPanelKeyDown = useCallback((event: KeyboardEvent<HTMLElement>) => {
    if (event.key !== 'Escape') return;
    event.stopPropagation();
    setMobileToolPanelOpen(false);
    window.requestAnimationFrame(() => {
      mobileToolToggleRef.current?.focus();
    });
  }, []);

  const handleMobileToolPanelToggle = useCallback(() => {
    setMobileToolPanelOpen(!mobileToolPanelOpen);
    if (mobileToolPanelOpen) {
      window.requestAnimationFrame(() => {
        mobileToolToggleRef.current?.focus();
      });
    }
  }, [mobileToolPanelOpen]);

  const hoveredBloomLabel = hoveredNode?.bloomLevel ? getBloomLabel(hoveredNode.bloomLevel) : '';
  const hoveredKnowledgeDimLabel = hoveredNode?.knowledgeDim
    ? getKnowledgeDimLabel(hoveredNode.knowledgeDim)
    : '';
  const hoveredChapterName = hoveredNode
    ? resolveChapterName(hoveredNode.chapter, hoveredNode.chapterName)
    : '';
  const focusNeighborhood = useMemo(
    () => buildFocusNeighborhood(displayLinks, graphFilterFocusNodeId, filteredNodeIdSet),
    [displayLinks, filteredNodeIdSet, graphFilterFocusNodeId]
  );
  const clarityMetrics = useMemo(
    () => calculateGraphClarityMetrics(displayNodes, displayLinks, focusNeighborhood),
    [displayLinks, displayNodes, focusNeighborhood]
  );
  const claritySummary = [
    `${clarityMetrics.visibleEdgeCount} 条可见关系`,
    `${clarityMetrics.edgeToNodeRatio.toFixed(2)} 边/点`,
    `邻域 ${(clarityMetrics.selectedNeighborhoodEdgeRatio * 100).toFixed(0)}%`,
  ].join(' · ');
  const desktopToolItems = [
    {
      id: 'chapter-directory',
      label: '目录',
      icon: BookOpen,
      summary: `${filteredNodes.length} 个节点`,
    },
    {
      id: 'node-filters',
      label: '筛选',
      icon: Filter,
      summary: activeFilterSummary,
    },
    {
      id: 'view-layout',
      label: '视图',
      icon: SlidersHorizontal,
      summary: `${viewMode} · ${pinnedNodeCount} 固定`,
    },
  ] satisfies Array<{
    id: KnowledgeDesktopTool;
    label: string;
    icon: typeof BookOpen;
    summary: string;
  }>;
  const desktopActiveToolLabel = desktopToolItems.find((item) => item.id === desktopActiveTool)?.label ?? '';

  useEffect(() => {
    updatePageContext({
      courseId: 'knowledge',
      courseTitle: '知识资源',
      stepId: '/knowledge',
      topic: visibleSelectedNode ? visibleSelectedNode.name : '知识图谱',
      pageType: 'workspace',
      learningObjectives: ['结合知识图谱关系定位当前概念、资源和后续学习动作。'],
      knowledgeType: 'C',
      tools: ['search_knowledge_graph', 'recommend_next_action'],
      systemPromptExtension: visibleSelectedNode
        ? `当前知识图谱选中节点：${visibleSelectedNode.name}`
        : '当前知识图谱尚未选中节点。',
      knowledgeWorkspaceHint: {
        selectedNodeId: visibleSelectedNode?.id ?? null,
        requestedNodeId,
        status: konlingContextStatus,
        activeFilters: [knowledgeWorkspaceFilterSummary],
        densityMode: 'family-scoped',
        viewMode,
        visibleRelationCount: displayLinks.length,
        selectedNodeRelationCount,
      },
    });
  }, [
    displayLinks.length,
    knowledgeWorkspaceFilterSummary,
    requestedNodeId,
    selectedNodeRelationCount,
    updatePageContext,
    viewMode,
    visibleSelectedNode,
    konlingContextStatus,
  ]);

  return (
    <div
      className="relative flex h-full min-h-0 w-full overflow-hidden bg-platform-page text-platform-fg-primary"
      style={KNOWLEDGE_WORKSPACE_STYLE}
      data-knowledge-workspace="canvas-first"
      data-knowledge-route-scroll-policy="workspace-contained"
      data-knowledge-squeeze-down-rejected="permanent-panels-hidden-at-320"
      data-knowledge-konling-context-source="server-owned"
      data-knowledge-konling-context-status={konlingContextStatus}
      data-knowledge-shared-dock-collision-policy="avoid-local-tools-and-inspector"
    >
      {/* 中央图谱区域 */}
      <div
        ref={containerRef}
        id="knowledge-graph-canvas"
        className="relative h-full min-w-0 flex-1 overflow-hidden"
        tabIndex={-1}
        aria-label="知识图谱画布"
        data-knowledge-canvas-primary="true"
        data-knowledge-layout-version={layoutState.version}
        data-knowledge-visible-node-count={displayNodes.length}
        data-knowledge-visible-link-count={displayLinks.length}
        data-knowledge-pinned-node-count={pinnedNodeCount}
        data-knowledge-pinned-layout-signature={pinnedLayoutSignature}
        data-knowledge-progressive-loading="root-first"
        data-knowledge-graph-version={graphCache.graphVersion}
        data-knowledge-loaded-shard-count={graphCache.loadedShardKeys.length}
        data-knowledge-incomplete-shard-count={graphCache.incompleteShardKeys.length}
        data-knowledge-loading-shard-count={graphCache.loadingShardKeys.length}
        data-knowledge-navigation-view={navigation.view.kind}
        data-knowledge-root-state={navigation.view.kind === 'root' ? navigation.status : undefined}
        data-knowledge-active-domain-id={navigation.view.kind === 'domain' ? navigation.view.domainId : ''}
        data-knowledge-domain-state={navigation.view.kind === 'domain' ? navigation.status : undefined}
        data-knowledge-fit-request-id={String(fitViewRequest.id)}
        data-knowledge-domain-cache-count={Object.keys(graphCache.domainShardKeysByDomainId).length}
        data-knowledge-full-graph-first-render="avoided"
        data-knowledge-selected-node-id={visibleSelectedNode?.id ?? ''}
        data-knowledge-active-lesson-id={activeLessonId ?? ''}
        data-knowledge-lesson-overlay-revision={lessonContext?.overlayRevision ?? ''}
        data-knowledge-teaching-order-source={lessonContext?.overlayRevision ?? 'post-only'}
        data-knowledge-lesson-card-order-count={lessonContext?.cardOrderNodeIds?.length ?? 0}
        data-knowledge-lesson-mapping-gap-count={
          (lessonContext?.mappingGaps?.cardOrder?.length ?? 0)
          + (lessonContext?.mappingGaps?.links?.length ?? 0)
        }
        data-knowledge-layout-conflict-count={teachingOrderLayout?.diagnostics.length ?? 0}
        data-knowledge-layout-unordered-node-count={teachingOrderLayout?.unorderedNodeIds.length ?? 0}
        data-knowledge-layout-fit-scale={teachingOrderLayout?.fitScale ?? 1}
        data-knowledge-konling-selected-node-id={visibleSelectedNode?.id ?? ''}
        data-knowledge-konling-relation-summary={activeFilterSummary}
        data-knowledge-konling-relation-families={enabledRelationFamilies.join(',')}
        data-knowledge-konling-view-mode={viewMode}
      >
        <KnowledgeDomainReturnAction
          avoidInspector={visiblePanelOpen && Boolean(inspectorSelectedNode)}
          domainId={navigation.view.kind === 'domain' ? navigation.view.domainId : null}
          onReturn={returnToRoot}
          resolveReturnFocus={resolveRootReturnFocus}
        />
        {navigation.view.kind === 'domain' && lessonOrderConflictCount > 0 && lessonContext && (
          <div
            className="pointer-events-none absolute left-1/2 top-3 z-20 -translate-x-1/2 rounded-md border border-amber-500/30 bg-slate-950/80 px-3 py-1.5 text-xs text-amber-200"
            role="status"
            data-knowledge-layout-diagnostic="teaching-order-conflict"
          >
            {lessonOrderConflictCount} 项概念先后关系与本课学习顺序不同，当前按本课顺序呈现。
          </div>
        )}
        {navigation.view.kind === 'domain' && postRequisiteCycleCount > 0 && (
          <div
            className="pointer-events-none absolute left-1/2 top-12 z-20 -translate-x-1/2 rounded-md border border-amber-500/30 bg-slate-950/80 px-3 py-1.5 text-xs text-amber-200"
            role="status"
            data-knowledge-layout-diagnostic="post-requisite-cycle"
          >
            {postRequisiteCycleCount} 组概念相互依赖，已置于同一层级，建议结合学习。
          </div>
        )}
        {navigation.view.kind === 'domain' && (teachingOrderLayout?.unorderedNodeIds.length ?? 0) > 0 && (
          <div
            className="pointer-events-none absolute bottom-4 right-4 z-20 rounded-md border border-platform-border bg-platform-surface/95 px-2.5 py-1.5 text-xs text-platform-fg-secondary shadow-sm backdrop-blur"
            data-knowledge-layout-region="unordered"
          >
            尚无可验证的先后关系 · {teachingOrderLayout?.unorderedNodeIds.length}
          </div>
        )}
        {graphCache.incompleteShardKeys.length > 0 && (
          <div
            role="status"
            className="absolute bottom-14 left-3 z-30 rounded-md border border-platform-evidence-context/35 bg-platform-evidence-context/10 px-2 py-1 text-xs text-platform-evidence-context"
            data-knowledge-graph-incomplete="true"
          >
            图谱数据受限，当前视图可能不完整
          </div>
        )}
        <div
          className="absolute left-[var(--knowledge-workspace-inset)] top-[var(--knowledge-workspace-inset)] z-30 hidden max-w-[min(45rem,calc(100vw-36rem))] lg:block"
          data-knowledge-desktop-command-system="compact"
          data-knowledge-local-tool-shell="desktop"
          data-knowledge-local-tool={desktopActiveTool ?? 'closed'}
          data-state={desktopActiveTool ? 'open' : 'closed'}
          data-knowledge-active-filter-summary={activeFilterSummary}
          data-knowledge-command-summary={`${claritySummary} · ${desktopActiveTool ? `打开：${desktopActiveToolLabel}` : '局部工具已收起'}`}
        >
          <div className="rounded-xl border border-platform-border bg-platform-surface/90 p-2 shadow-lg backdrop-blur-md">
            <div className="flex flex-wrap items-center gap-1.5">
              {desktopToolItems.map((item) => {
                const Icon = item.icon;
                const active = desktopActiveTool === item.id;
                return (
                  <button
                    key={item.id}
                    ref={(element) => {
                      desktopToolTriggerRefs.current[item.id] = element;
                    }}
	                    type="button"
	                    aria-label={`${item.label}工具`}
	                    aria-controls={`${DESKTOP_TOOL_PANEL_ID_PREFIX}-${item.id}`}
	                    aria-expanded={active}
                    aria-pressed={active}
                    onClick={() => setDesktopActiveTool((current) => current === item.id ? null : item.id)}
                    className={`inline-flex h-9 items-center gap-2 rounded-lg border px-3 text-xs font-medium transition ${
                      active
                        ? 'border-platform-action-primary bg-platform-action-subtle text-platform-fg-primary'
                        : 'border-platform-border bg-platform-surface/80 text-platform-fg-secondary hover:bg-platform-action-subtle hover:text-platform-fg-primary'
                    }`}
                    data-knowledge-command-trigger={item.id}
                  >
                    <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>{item.label}</span>
                    <span className="hidden max-w-24 truncate text-[10px] font-normal text-platform-fg-muted xl:inline">
                      {item.summary}
                    </span>
                  </button>
                );
              })}
              {desktopActiveTool && (
                <button
                  type="button"
                  aria-label="收起知识图谱局部工具"
                  onClick={closeDesktopTool}
                  className="ml-1 inline-flex h-9 w-9 items-center justify-center rounded-lg border border-platform-border bg-platform-surface/80 text-platform-fg-secondary transition hover:bg-platform-action-subtle hover:text-platform-fg-primary"
                  data-knowledge-command-close="true"
                >
                  <X className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              )}
            </div>
            <div
              className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px] text-platform-fg-secondary"
              data-knowledge-local-tool-summary="desktop"
            >
              <span className="rounded-full border border-platform-border bg-platform-canvas-muted px-2 py-0.5">
                {displayNodes.length} 节点
              </span>
              <span className="rounded-full border border-platform-border bg-platform-canvas-muted px-2 py-0.5">
                {displayLinks.length} 关系
              </span>
              <span className="rounded-full border border-platform-border bg-platform-canvas-muted px-2 py-0.5">
                {enabledRelationFamilies.map((family) => KNOWLEDGE_GRAPH_FAMILY_PRESENTATION_CONFIG[family].label).join(' · ') || '未显示关系'}
              </span>
              <span className="min-w-0 max-w-[26rem] truncate rounded-full border border-platform-border bg-platform-canvas-muted px-2 py-0.5">
                {activeFilterSummary}
              </span>
            </div>

            {desktopActiveTool && (
              <div
                id={`${DESKTOP_TOOL_PANEL_ID_PREFIX}-${desktopActiveTool}`}
                ref={desktopToolPanelRef}
                role="region"
                tabIndex={-1}
                aria-label={`${desktopActiveToolLabel}工具`}
                onKeyDown={handleDesktopToolPanelKeyDown}
                className={KNOWLEDGE_LOCAL_TOOL_PANEL_CLASS}
                data-knowledge-desktop-tool-panel={desktopActiveTool}
                data-knowledge-local-tool-panel={desktopActiveTool}
                data-knowledge-local-tool={desktopActiveTool}
                data-state="open"
              >
                {desktopActiveTool === 'chapter-directory' && (
                  <KnowledgeSidebar
                    nodes={directoryNodes}
                    selectedNodeId={visibleSelectedNode?.id}
                    searchQuery={searchQuery}
                    onSearchChange={setSearchQuery}
                    onNodeSelect={activateNode}
                    onNodeHover={handleNodeHover}
                  />
                )}

                {desktopActiveTool === 'node-filters' && (
                  <div className="space-y-3" data-knowledge-local-panel="node-filters">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="font-semibold text-platform-fg-primary">节点筛选</div>
                        <div className="text-[11px] text-platform-fg-muted">
                          当前显示节点 {filteredNodes.length} / {nodes.length}
                        </div>
                      </div>
                    </div>

                    <div
                      className="rounded-lg border border-platform-border bg-platform-canvas-muted px-2 py-1.5 text-[11px] text-platform-fg-secondary"
                      data-knowledge-clarity-summary="desktop"
                    >
                      {claritySummary}
                    </div>

                    <div className="flex items-center justify-between gap-3 rounded-lg border border-platform-border bg-platform-canvas-muted px-2 py-1.5">
                      <span className="text-[11px] text-platform-fg-secondary">标签显示</span>
                      <div className="flex rounded-md border border-platform-border p-0.5">
                        {([
                          ['focus', '重点标签'],
                          ['all', '全部标签'],
                        ] as const).map(([mode, label]) => (
                          <button
                            key={mode}
                            type="button"
                            aria-pressed={labelMode === mode}
                            onClick={() => setLabelMode(mode)}
                            className={`rounded px-2 py-1 text-[10px] transition-colors ${
                              labelMode === mode
                                ? 'bg-platform-action-primary text-platform-fg-inverse'
                                : 'text-platform-fg-muted hover:bg-platform-action-subtle hover:text-platform-fg-primary'
                            }`}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <input
                      id="knowledge-node-filter-search-desktop"
                      name="knowledge-node-filter-search"
                      aria-label="关键词搜索（名称 / 标签 / 公式 / 示例）"
                      type="text"
                      value={searchQuery}
                      onChange={(event) => setSearchQuery(event.target.value)}
                      placeholder="关键词搜索（名称 / 标签 / 公式 / 示例）"
                      className="w-full rounded-lg border border-platform-border bg-platform-surface px-2.5 py-2 text-xs text-platform-fg-primary outline-none placeholder:text-platform-fg-muted focus:border-platform-border-strong"
                    />

                    <div className="space-y-2">
                      <details className="rounded-lg border border-platform-border bg-platform-canvas-muted px-2 py-1.5">
                        <summary className="cursor-pointer text-[11px] font-medium text-platform-fg-primary">
                          章节筛选（多选）{selectedChapters.length > 0 ? ` · ${selectedChapters.length}` : ''}
                        </summary>
                        <div className="mt-2 max-h-28 space-y-1 overflow-y-auto pr-1">
                          {chapterOptions.map((chapterName) => (
                            <label key={chapterName} className="flex cursor-pointer items-center gap-2 text-[11px] text-platform-fg-secondary">
                              <input
                                type="checkbox"
                                checked={selectedChapters.includes(chapterName)}
                                onChange={() => toggleMultiSelectValue(chapterName, setSelectedChapters)}
                                className="accent-[hsl(var(--platform-action-primary))]"
                              />
                              <span>{chapterName}</span>
                            </label>
                          ))}
                        </div>
                      </details>

                      <details className="rounded-lg border border-platform-border bg-platform-canvas-muted px-2 py-1.5">
                        <summary className="cursor-pointer text-[11px] font-medium text-platform-fg-primary">
                          {getGraphFilterLabel('category')}筛选{selectedCategories.length > 0 ? ` · ${selectedCategories.length}` : ''}
                        </summary>
                        <div className="mt-2 max-h-24 space-y-1 overflow-y-auto pr-1">
                          {categoryOptions.map((category) => (
                            <label key={category} className="flex cursor-pointer items-center gap-2 text-[11px] text-platform-fg-secondary">
                              <input
                                type="checkbox"
                                checked={selectedCategories.includes(category)}
                                onChange={() => toggleMultiSelectValue(category, setSelectedCategories)}
                                className="accent-[hsl(var(--platform-action-primary))]"
                              />
                              <span>{category}</span>
                            </label>
                          ))}
                        </div>
                      </details>

                      <details className="rounded-lg border border-platform-border bg-platform-canvas-muted px-2 py-1.5">
                        <summary className="cursor-pointer text-[11px] font-medium text-platform-fg-primary">
                          {getGraphFilterLabel('bloom_level')}筛选{selectedBloomLevels.length > 0 ? ` · ${selectedBloomLevels.length}` : ''}
                        </summary>
                        <div className="mt-2 max-h-24 space-y-1 overflow-y-auto pr-1">
                          {bloomOptions.map((bloom) => (
                            <label key={bloom} className="flex cursor-pointer items-center gap-2 text-[11px] text-platform-fg-secondary">
                              <input
                                type="checkbox"
                                checked={selectedBloomLevels.includes(bloom)}
                                onChange={() => toggleMultiSelectValue(bloom, setSelectedBloomLevels)}
                                className="accent-[hsl(var(--platform-action-primary))]"
                              />
                              <span>{getBloomLabel(bloom)}</span>
                            </label>
                          ))}
                        </div>
                      </details>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setSelectedChapters([]);
                        setSelectedCategories([]);
                        setSelectedBloomLevels([]);
                        setSearchQuery('');
                      }}
                      className="w-full rounded-md border border-platform-border bg-platform-surface px-2 py-1 text-[11px] text-platform-fg-secondary hover:bg-platform-action-subtle hover:text-platform-fg-primary"
                    >
                      清空节点筛选条件
                    </button>
                  </div>
                )}

                {desktopActiveTool === 'view-layout' && (
                  <div className="space-y-3" data-knowledge-local-panel="view-layout-controls">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-semibold text-platform-fg-primary">视图与布局</div>
                        <div className="text-[11px] text-platform-fg-muted">布局命令只响应显式操作，不跟随选择或悬停重排。</div>
                      </div>
                      <LocateFixed className="h-4 w-4 text-platform-action-primary" aria-hidden="true" />
                    </div>
                    <div className="grid grid-cols-2 gap-1 rounded-lg border border-platform-border p-1">
                      {([
                        ['2D', '2D 视图'],
                        ['3D', '3D 视图'],
                      ] as const).map(([mode, label]) => (
                        <button
                          key={mode}
                          type="button"
                          onClick={() => setViewMode(mode)}
                          className={`rounded-md px-3 py-2 text-xs font-medium transition-all ${
                            viewMode === mode
                              ? 'bg-platform-action-primary text-platform-fg-inverse shadow-sm'
                              : 'text-platform-fg-secondary hover:bg-platform-action-subtle hover:text-platform-fg-primary'
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={handleFitView}
                        className="rounded-md border border-platform-border bg-platform-action-subtle px-2 py-2 text-xs font-medium text-platform-fg-secondary hover:bg-platform-action-primary hover:text-platform-fg-inverse"
                        data-knowledge-layout-control="fit-view"
                      >
                        适配视图
                      </button>
                      <button
                        type="button"
                        onClick={handleRelayout}
                        className="rounded-md border border-platform-border bg-platform-action-subtle px-2 py-2 text-xs font-medium text-platform-fg-secondary hover:bg-platform-action-primary hover:text-platform-fg-inverse"
                        data-knowledge-layout-control="relayout"
                      >
                        重新布局
                      </button>
                      <button
                        type="button"
                        onClick={handleToggleSelectedNodePin}
                        disabled={!visibleSelectedNode || selectedNodePinUnavailable}
                        className="rounded-md border border-platform-border bg-platform-action-subtle px-2 py-2 text-xs font-medium text-platform-fg-secondary hover:bg-platform-action-primary hover:text-platform-fg-inverse disabled:cursor-not-allowed disabled:opacity-45"
                        data-knowledge-layout-control={selectedNodePinned ? 'unpin-selected' : 'pin-selected'}
                        title={selectedNodePinUnavailable ? '需要先在图谱中点击或拖拽节点，才能固定当前画布坐标' : undefined}
                      >
                        {selectedNodePinned ? '取消固定' : '固定节点'}
                      </button>
                      <button
                        type="button"
                        onClick={handleToggleSelectedFocus}
                        disabled={!visibleSelectedNode}
                        className="rounded-md border border-platform-border bg-platform-action-subtle px-2 py-2 text-xs font-medium text-platform-fg-secondary hover:bg-platform-action-primary hover:text-platform-fg-inverse disabled:cursor-not-allowed disabled:opacity-45"
                        data-knowledge-layout-control={selectedNodeFocused ? 'clear-focus-node' : 'set-focus-node'}
                      >
                        {selectedNodeFocused ? '取消焦点' : '设为焦点'}
                      </button>
                      <button
                        type="button"
                        onClick={handleClearLayoutPins}
                        className="col-span-2 rounded-md border border-platform-border bg-platform-surface px-2 py-2 text-xs font-medium text-platform-fg-secondary hover:bg-platform-action-subtle hover:text-platform-fg-primary"
                        data-knowledge-layout-control="clear-pins"
                      >
                        清除固定节点
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {!aiSidebarOpen && (
          <div
            className={`absolute left-3 right-3 top-3 grid gap-2 lg:hidden ${
              mobileToolPanelOpen ? 'z-[60]' : 'z-30'
            }`}
            data-knowledge-mobile-command-surface="single-tool-panel"
            data-knowledge-local-tool={mobileActiveTool}
            data-state={mobileToolPanelOpen ? 'open' : 'closed'}
          >
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-platform-border bg-platform-surface/95 p-2 text-xs text-platform-fg-primary shadow-lg backdrop-blur">
            {([
              ['chapter-directory', '目录'],
              ['node-filters', '筛选'],
              ['view-layout', '视图'],
            ] as const).map(([tool, label]) => (
              <button
                key={tool}
                type="button"
                aria-pressed={mobileActiveTool === tool}
                aria-expanded={mobileActiveTool === tool && mobileToolPanelOpen}
                onClick={() => {
                  setMobileActiveTool(tool);
                  setMobileToolPanelOpen(true);
                }}
                className={`rounded-lg border px-2.5 py-1.5 transition ${
                  mobileActiveTool === tool
                    ? 'border-platform-action-primary bg-platform-action-subtle text-platform-fg-primary'
                    : 'border-platform-border text-platform-fg-secondary'
                }`}
              >
                {label}
              </button>
            ))}
            <span className="min-w-0 flex-1 truncate text-[11px] text-platform-fg-secondary">
              {activeFilterSummary}
            </span>
            <button
              ref={mobileToolToggleRef}
              type="button"
              aria-expanded={mobileToolPanelOpen}
              onClick={handleMobileToolPanelToggle}
              className="rounded-lg border border-platform-border px-2.5 py-1.5 text-[11px] text-platform-fg-secondary transition hover:bg-platform-action-subtle hover:text-platform-fg-primary"
              data-knowledge-mobile-panel-toggle="true"
            >
              {mobileToolPanelOpen ? '收起' : '展开'}
            </button>
          </div>

          {mobileToolPanelOpen && (
            <div
              ref={mobileToolPanelRef}
              tabIndex={-1}
              onKeyDown={handleMobileToolPanelKeyDown}
              className={`max-h-[min(28rem,calc(100vh-7rem))] overflow-y-auto rounded-xl border border-platform-border bg-platform-surface/95 px-3 pb-3 text-xs text-platform-fg-primary shadow-xl backdrop-blur ${
                navigation.view.kind === 'domain' ? 'pt-14' : 'pt-3'
              }`}
              data-knowledge-mobile-tool-panel={mobileActiveTool}
              data-knowledge-mobile-tool-return-safe-area={navigation.view.kind === 'domain' ? 'reserved' : 'none'}
              data-state="open"
            >
            {mobileToolControlVisible && (
              <div
                className={`sticky z-10 mb-3 bg-platform-surface/95 pb-2 ${navigation.view.kind === 'domain' ? 'top-12' : 'top-0'}`}
                data-knowledge-mobile-tool-sticky-control="relation-family"
              >
                <RelationFamilyControl
                  enabledFamilies={enabledRelationFamilies}
                  isLightTheme={isLightTheme}
                  placement="tool-panel"
                  onToggleAll={toggleAllFamilies}
                  onToggleFamily={toggleFamily}
                />
              </div>
            )}
            {mobileActiveTool === 'chapter-directory' && (
              <div data-knowledge-mobile-drawer="chapter-directory" data-knowledge-local-tool="chapter-directory" data-state="open">
                <KnowledgeSidebar
                  nodes={directoryNodes}
                  selectedNodeId={visibleSelectedNode?.id}
                  searchQuery={searchQuery}
                  onSearchChange={setSearchQuery}
                  onNodeSelect={activateNode}
                  onNodeHover={handleNodeHover}
                />
              </div>
            )}

            {mobileActiveTool === 'node-filters' && (
              <div className="space-y-2" data-knowledge-mobile-drawer="node-filters" data-knowledge-local-tool="node-filters" data-state="open">
                <p className="text-platform-fg-secondary">节点 {filteredNodes.length} / {nodes.length}</p>
                <p className="text-[11px] text-platform-fg-muted" data-knowledge-clarity-summary="mobile">
                  {claritySummary}
                </p>
                <input id="knowledge-node-filter-search-mobile"
                  name="knowledge-node-filter-search"
                  aria-label="关键词搜索"
                  type="text"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="关键词搜索"
                  className="w-full rounded-md border border-platform-border bg-platform-surface px-2 py-1.5 text-xs text-platform-fg-primary outline-none"
                />
                <div className="grid gap-2">
                  <details className="rounded-md border border-platform-border px-2 py-1.5">
                    <summary className="cursor-pointer text-[11px] font-medium">{getGraphFilterLabel('category')}筛选{selectedCategories.length > 0 ? ` · ${selectedCategories.length}` : ''}</summary>
                    <div className="mt-2 grid gap-1">
                      {categoryOptions.map((category) => (
                        <label key={`mobile-category-${category}`} className="flex items-center gap-2 text-[11px] text-platform-fg-secondary">
                          <input
                            type="checkbox"
                            checked={selectedCategories.includes(category)}
                            onChange={() => toggleMultiSelectValue(category, setSelectedCategories)}
                            className="accent-[hsl(var(--platform-action-primary))]"
                          />
                          <span>{category}</span>
                        </label>
                      ))}
                    </div>
                  </details>
                  <details className="rounded-md border border-platform-border px-2 py-1.5">
                    <summary className="cursor-pointer text-[11px] font-medium">{getGraphFilterLabel('bloom_level')}筛选{selectedBloomLevels.length > 0 ? ` · ${selectedBloomLevels.length}` : ''}</summary>
                    <div className="mt-2 grid gap-1">
                      {bloomOptions.map((bloom) => (
                        <label key={`mobile-bloom-${bloom}`} className="flex items-center gap-2 text-[11px] text-platform-fg-secondary">
                          <input
                            type="checkbox"
                            checked={selectedBloomLevels.includes(bloom)}
                            onChange={() => toggleMultiSelectValue(bloom, setSelectedBloomLevels)}
                            className="accent-[hsl(var(--platform-action-primary))]"
                          />
                          <span>{getBloomLabel(bloom)}</span>
                        </label>
                      ))}
                    </div>
                  </details>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedChapters([]);
                    setSelectedCategories([]);
                    setSelectedBloomLevels([]);
                    setSearchQuery('');
                  }}
                  className="w-full rounded-md border border-platform-border px-2 py-1.5 text-[11px] text-platform-fg-secondary"
                >
                  清空节点筛选条件
                </button>
              </div>
            )}

            {mobileActiveTool === 'view-layout' && (
              <div
                className="space-y-3"
                data-knowledge-mobile-drawer="view-layout"
                data-knowledge-local-tool="view-layout"
                data-knowledge-local-panel="view-layout-controls"
                data-state="open"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-platform-fg-primary">视图与布局</div>
                    <div className="text-[11px] text-platform-fg-muted">移动端保留同一组显式布局命令。</div>
                  </div>
                  <LocateFixed className="h-4 w-4 text-platform-action-primary" aria-hidden="true" />
                </div>
                <div className="grid grid-cols-2 gap-1 rounded-lg border border-platform-border p-1">
                  {([
                    ['2D', '2D 视图'],
                    ['3D', '3D 视图'],
                  ] as const).map(([mode, label]) => (
                    <button
                      key={`mobile-view-${mode}`}
                      type="button"
                      onClick={() => setViewMode(mode)}
                      className={`rounded-md px-3 py-2 text-xs font-medium transition-all ${
                        viewMode === mode
                          ? 'bg-platform-action-primary text-platform-fg-inverse shadow-sm'
                          : 'text-platform-fg-secondary hover:bg-platform-action-subtle hover:text-platform-fg-primary'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={handleFitView}
                    className="rounded-md border border-platform-border bg-platform-action-subtle px-2 py-2 text-xs font-medium text-platform-fg-secondary hover:bg-platform-action-primary hover:text-platform-fg-inverse"
                    data-knowledge-layout-control="fit-view"
                  >
                    适配视图
                  </button>
                  <button
                    type="button"
                    onClick={handleRelayout}
                    className="rounded-md border border-platform-border bg-platform-action-subtle px-2 py-2 text-xs font-medium text-platform-fg-secondary hover:bg-platform-action-primary hover:text-platform-fg-inverse"
                    data-knowledge-layout-control="relayout"
                  >
                    重新布局
                  </button>
                  <button
                    type="button"
                    onClick={handleToggleSelectedNodePin}
                    disabled={!visibleSelectedNode || selectedNodePinUnavailable}
                    className="rounded-md border border-platform-border bg-platform-action-subtle px-2 py-2 text-xs font-medium text-platform-fg-secondary hover:bg-platform-action-primary hover:text-platform-fg-inverse disabled:cursor-not-allowed disabled:opacity-45"
                    data-knowledge-layout-control={selectedNodePinned ? 'unpin-selected' : 'pin-selected'}
                    title={selectedNodePinUnavailable ? '需要先在图谱中点击或拖拽节点，才能固定当前画布坐标' : undefined}
                  >
                    {selectedNodePinned ? '取消固定' : '固定节点'}
                  </button>
                  <button
                    type="button"
                    onClick={handleToggleSelectedFocus}
                    disabled={!visibleSelectedNode}
                    className="rounded-md border border-platform-border bg-platform-action-subtle px-2 py-2 text-xs font-medium text-platform-fg-secondary hover:bg-platform-action-primary hover:text-platform-fg-inverse disabled:cursor-not-allowed disabled:opacity-45"
                    data-knowledge-layout-control={selectedNodeFocused ? 'clear-focus-node' : 'set-focus-node'}
                  >
                    {selectedNodeFocused ? '取消焦点' : '设为焦点'}
                  </button>
                  <button
                    type="button"
                    onClick={handleClearLayoutPins}
                    className="col-span-2 rounded-md border border-platform-border bg-platform-surface px-2 py-2 text-xs font-medium text-platform-fg-secondary hover:bg-platform-action-subtle hover:text-platform-fg-primary"
                    data-knowledge-layout-control="clear-pins"
                  >
                    清除固定节点
                  </button>
                </div>
              </div>
            )}
            </div>
          )}
          </div>
        )}

        {!mobileInspectorControlVisible && !mobileToolControlVisible && (
          <RelationFamilyControl
            enabledFamilies={enabledRelationFamilies}
            isLightTheme={isLightTheme}
            placement="canvas"
            onToggleAll={toggleAllFamilies}
            onToggleFamily={toggleFamily}
          />
        )}

        <div
          className="pointer-events-none absolute bottom-4 left-1/2 z-40 flex max-h-[min(10rem,calc(100%-2rem))] w-[min(calc(100%-2rem),32rem)] min-w-0 -translate-x-1/2 flex-wrap justify-center gap-2 overflow-y-auto px-1"
          aria-label="知识图谱节点控制"
        >
          {displayNodes.map((node) => {
            const semanticLabel = getKnowledgeNodeSemanticLabel(
              node.name,
              isCollapsedRootNode(node) ? 'domain' : 'node'
            );
            return (
              <button
                key={`semantic-node-${node.id}`}
                type="button"
                data-knowledge-node-control={node.id}
                aria-label={semanticLabel.ariaLabel}
                title={semanticLabel.title}
                aria-busy={isCollapsedRootNode(node) && navigation.view.kind === 'domain' && navigation.view.domainId === node.id && navigation.status === 'loading'}
                aria-expanded={isCollapsedRootNode(node) ? navigation.view.kind === 'domain' && navigation.view.domainId === node.id : undefined}
                aria-describedby="knowledge-node-activation-status"
                data-error={isCollapsedRootNode(node) && navigation.view.kind === 'domain' && navigation.view.domainId === node.id && navigation.status === 'failure' ? 'true' : 'false'}
                data-filtered-empty={isCollapsedRootNode(node) && navigation.view.kind === 'domain' && navigation.view.domainId === node.id && navigation.status === 'filtered-empty' ? 'true' : 'false'}
                data-shard-cached={graphCache.domainShardKeysByDomainId[node.id] ? 'true' : 'false'}
                onClick={() => activateNodeById(node.id)}
                className="pointer-events-none h-px w-px max-w-full min-w-0 overflow-hidden opacity-0 focus:pointer-events-auto focus:h-auto focus:w-auto focus:max-w-[min(24rem,calc(100vw-2rem))] focus:whitespace-normal focus:break-words focus:overflow-visible focus:rounded-md focus:border focus:border-platform-action-primary focus:bg-platform-surface focus:px-3 focus:py-2 focus:text-center focus:opacity-100 focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-inset focus:ring-platform-action-primary"
              >
                {semanticLabel.accessibleName}
              </button>
            );
          })}
        </div>
        <span id="knowledge-node-activation-status" role="status" aria-live="polite" className="sr-only">
          {navigationStatusText}
        </span>
        {navigation.view.kind === 'domain' && navigation.status === 'loading' && (
          <div
            role="status"
            className="absolute bottom-16 left-1/2 z-30 -translate-x-1/2 rounded-md border border-platform-border bg-platform-surface px-3 py-2 text-xs text-platform-fg-secondary shadow-lg"
            data-knowledge-domain-loading="true"
          >
            正在加载当前领域知识…
          </div>
        )}
        {navigation.view.kind === 'domain' && (navigation.status === 'failure' || navigation.status === 'incomplete') && (
          <div className="absolute bottom-16 left-1/2 z-30 flex -translate-x-1/2 items-center gap-3 rounded-md border border-platform-evidence-context/35 bg-platform-surface px-3 py-2 text-xs text-platform-fg-secondary shadow-lg" role="alert">
            <span>{navigation.error}</span>
            <button
              type="button"
              onClick={() => {
                if (navigation.view.kind === 'domain') {
                  void loadDomain(navigation.view.domainId, true);
                }
              }}
              className="rounded-md border border-platform-border bg-platform-action-subtle px-2 py-1 font-medium text-platform-fg-primary hover:bg-platform-action-primary hover:text-platform-fg-inverse"
              data-knowledge-domain-retry="true"
            >
              重试
            </button>
          </div>
        )}
        {navigation.view.kind === 'domain' && navigation.status === 'filtered-empty' && (
          <div
            role="status"
            className="absolute bottom-16 left-1/2 z-30 -translate-x-1/2 rounded-md border border-platform-border bg-platform-surface px-3 py-2 text-xs text-platform-fg-secondary shadow-lg"
            data-knowledge-filtered-empty-explanation="visible"
          >
            当前筛选条件下没有可见知识点；领域缓存仍保留，可调整筛选或返回全部领域。
          </div>
        )}

        {navigation.view.kind === 'root' && navigation.status === 'loading' && displayNodes.length === 0 ? (
            <div className="flex h-full w-full items-center justify-center">
              <div className="text-center">
                <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-2 border-platform-border border-t-platform-action-primary" />
                <div className="text-platform-action-primary">正在从知识库加载数据...</div>
                <div className="mt-2 text-sm text-platform-fg-muted">同步 {nodes.length} 个节点...</div>
              </div>
            </div>
        ) : navigation.view.kind === 'root' && navigation.status === 'failure' ? (
          <div className="flex h-full w-full items-center justify-center">
            <div className="text-center">
              <div className="text-platform-fg-secondary">{navigation.error}</div>
              <button
                type="button"
                onClick={() => void loadRoot()}
                className="mt-3 rounded-md border border-platform-border bg-platform-action-subtle px-3 py-2 text-sm font-medium text-platform-fg-primary hover:bg-platform-action-primary hover:text-platform-fg-inverse"
                data-knowledge-root-retry="true"
              >
                重试
              </button>
            </div>
          </div>
        ) : (
            <Suspense
            fallback={
                <div className="flex h-full w-full items-center justify-center">
                <div className="text-center">
                    <div className="text-platform-action-primary">渲染视图...</div>
                </div>
                </div>
            }
            >
            {viewMode === '2D' ? (
              <KnowledgeGraph2D
                nodes={displayNodes}
                links={renderDisplayLinks}
                presentationLinks={canonicalPresentationLinks}
                selectedNode={canvasSelectedNode}
                hoveredNode={hoveredNode}
                onNodeClick={activateNode}
                onNodeHover={handleNodeHover}
                onNodeDragEnd={handleNodeDragEnd}
                onBackgroundClick={handleBlankCanvasClick}
                width={dimensions.width}
                height={dimensions.height}
                labelMode={labelMode}
                layoutState={layoutState}
                fitViewRequest={fitViewRequest}
                relayoutVersion={relayoutVersion}
                expandedNodeIds={[]}
                expandedDirectLinks={expandedDirectLinks}
                activationSequenceByCenterId={{}}
                materializedNodeIds={[]}
                graphVersion={rendererLayoutVersion}
                lessonOrderNodeIds={lessonContext?.cardOrderNodeIds ?? []}
                teachingOrderLinks={teachingOrderLinks}
                selectedCorridorEmphasis={selectedCorridorEmphasis}
              />
            ) : (
              <KnowledgeGraphCanvas
                nodes={displayNodes}
                links={renderDisplayLinks}
                presentationLinks={canonicalPresentationLinks}
                selectedNode={canvasSelectedNode}
                hoveredNode={hoveredNode}
                onNodeClick={activateNode}
                onNodeHover={handleNodeHover}
                onNodeDragEnd={handleNodeDragEnd}
                onBackgroundClick={handleBlankCanvasClick}
                labelMode={labelMode}
                layoutState={layoutState}
                fitViewRequest={fitViewRequest}
                autoFitScopeKey={autoFitScopeKey}
                autoFitReady={autoFitReady}
                autoFitConsumed={Boolean(
                  autoFitScopeKey && consumedAutoFitScopeKeys.has(autoFitScopeKey)
                )}
                autoFitCameraManipulated={Boolean(
                  autoFitScopeKey && manipulatedAutoFitScopeKeys.has(autoFitScopeKey)
                )}
                restoredCameraPose={autoFitScopeKey
                  ? cameraPoseByAutoFitScopeRef.current.get(autoFitScopeKey) ?? null
                  : null}
                onAutoFitConsumed={handleAutoFitConsumed}
                onCameraManipulation={handleCameraManipulation}
                onCameraPoseChange={handleCameraPoseChange}
                relayoutVersion={relayoutVersion}
                width={dimensions.width}
                height={dimensions.height}
                expandedNodeIds={[]}
                expandedDirectLinks={expandedDirectLinks}
                activationSequenceByCenterId={{}}
                materializedNodeIds={[]}
                graphVersion={rendererLayoutVersion}
                lessonOrderNodeIds={lessonContext?.cardOrderNodeIds ?? []}
                teachingOrderLinks={teachingOrderLinks}
                selectedCorridorEmphasis={selectedCorridorEmphasis}
              />
            )}
            </Suspense>
        )}

        {/* 悬停提示 */}
        {hoveredNode && (
          <div
            className="surface-card pointer-events-none absolute left-1/2 top-4 z-50 -translate-x-1/2 transform p-4 shadow-lg backdrop-blur-md"
            data-knowledge-local-panel="node-hover-preview"
            data-knowledge-hover-context-policy="preview-only-not-durable-context"
          >
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium text-platform-fg-primary">
                {getKnowledgeNodeSemanticLabel(hoveredNode.name, 'node').accessibleName}
              </span>
              <span
                className={`rounded-full px-2 py-0.5 text-xs ${
                  hoveredNode.nodeType === 'THEORY'
                    ? 'border border-platform-border bg-platform-action-subtle text-platform-fg-secondary'
                    : hoveredNode.nodeType === 'SCENARIO'
                      ? 'border border-platform-evaluation-preview bg-platform-action-subtle text-platform-fg-secondary'
                      : 'border border-platform-replay-ready bg-platform-action-subtle text-platform-fg-secondary'
                }`}
              >
                {hoveredNode.nodeType === 'THEORY'
                  ? '控制理论'
                  : hoveredNode.nodeType === 'SCENARIO'
                    ? '船舶场景'
                    : '伦理决策'}
              </span>
              {hoveredBloomLabel && (
                <span className="rounded-full border border-platform-replay-ready bg-platform-action-subtle px-2 py-0.5 text-xs text-platform-fg-secondary">
                  Bloom：{hoveredBloomLabel}
                </span>
              )}
              {hoveredKnowledgeDimLabel && (
                <span className="rounded-full border border-platform-border bg-platform-action-subtle px-2 py-0.5 text-xs text-platform-fg-secondary">
                  维度：{hoveredKnowledgeDimLabel}
                </span>
              )}
              {hoveredChapterName && (
                <span className="rounded-full border border-platform-border bg-platform-action-subtle px-2 py-0.5 text-xs text-platform-fg-secondary">
                  章节：{hoveredChapterName}
                </span>
              )}
            </div>
            <p className="mt-2 text-sm text-platform-fg-secondary">{hoveredNode.description}</p>
          </div>
        )}
      </div>

      {/* 右侧资源面板 */}
      <ResourcePanel
        isOpen={visiblePanelOpen}
        selectedNode={inspectorSelectedNode}
        onClose={handleClosePanel}
        onNodeClick={activateNodeById}
        adjacentDomainNavigations={(selectedCorridor?.adjacentDomainNavigations ?? []).map((navigation) => ({
          ...navigation,
          nodeName: graphCache.rootCatalogByNodeId[navigation.nodeId]?.nodeName ?? navigation.nodeId,
        }))}
        canonicalCorridor={selectedCorridor ? {
          ancestors: selectedCorridor.ancestorNodeIds.map((nodeId) => ({
            id: nodeId,
            name: graphCache.nodesById[nodeId]?.name
              ?? graphCache.rootCatalogByNodeId[nodeId]?.nodeName
              ?? nodeId,
          })),
          descendants: selectedCorridor.descendantNodeIds.map((nodeId) => ({
            id: nodeId,
            name: graphCache.nodesById[nodeId]?.name
              ?? graphCache.rootCatalogByNodeId[nodeId]?.nodeName
              ?? nodeId,
          })),
          ...(selectedCorridor.motionSuppressedEdgeIds.length > 0
            ? { cycleState: 'cyclic' as const }
            : {}),
        } : null}
        viewerRole={viewerRole}
        mobileToolPanelOpen={mobileToolPanelOpen}
        mobileHeaderControl={mobileInspectorControlVisible ? (
          <RelationFamilyControl
            enabledFamilies={enabledRelationFamilies}
            isLightTheme={isLightTheme}
            placement="inspector"
            onToggleAll={toggleAllFamilies}
            onToggleFamily={toggleFamily}
          />
        ) : undefined}
      />
    </div>
  );
}

export default KnowledgeGraphSystem;
