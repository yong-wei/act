'use client';

/**
 * KnowledgeGraphSystem - 船舶知识图谱交互系统主组件
 *
 * 重构自 knowledge0316.html，使用 React Three Fiber
 */

import { Suspense, useState, useCallback, useEffect, useRef, useMemo, type CSSProperties, type Dispatch, type KeyboardEvent, type SetStateAction } from 'react';
import dynamic from 'next/dynamic';
import { BookOpen, Filter, LocateFixed, Network, SlidersHorizontal, X } from 'lucide-react';
import { useGlobalAI } from '@/components/providers/global-ai-provider';
import type { PlatformRole } from '@/components/platform/platform-ui-contracts';
import { KnowledgeSidebar } from './sidebar/knowledge-sidebar';
import { ResourcePanel } from './resource-panel/resource-panel';
import {
  CHAPTER_DISPLAY_ORDER,
  getBloomLabel,
  getKnowledgeDimLabel,
  getRelationCategory,
  getRelationLabel,
  resolveChapterName,
} from '@/lib/knowledge-labels';
import {
  buildFocusNeighborhood,
  buildGraphStatistics,
  buildDefaultSelectedRelationTypes,
  buildRelationTypeStats,
  calculateGraphClarityMetrics,
  injectChapterNodes,
  isNodeVisibleInFocusedGraph,
  limitStructureRelationDensity,
  matchesNodeFilters,
  relationPassesActiveFilters,
  relationPassesFocusNeighborhoodSeedFilters,
  type RelationDensityMode,
} from './graph/filter-utils';
import type { KnowledgeGraphLabelMode } from './graph/label-policy';
import {
  getGraphFilterLabel,
  getRelationLegendItems,
  type RelationLegendItem,
} from './graph/visual-config';
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
  createKnowledgeExpansionCommitQueue,
  isExpansionFilteredEmpty,
  resolveKnowledgeNodeActivation,
  selectNewlyMaterializedKnowledgeNodeIds,
  shouldCommitKnowledgeExpansionPayload,
  shouldCommitKnowledgeNodeActivation,
} from './graph/node-activation';
import {
  buildInitialGraphCache,
  knowledgeLinkCacheKey,
  mergeProgressiveGraphPayload,
  type KnowledgeGraphCacheState,
  type ProgressiveGraphApiResponse,
} from './progressive-graph-cache';
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
type KnowledgeMobileTool = 'chapter-directory' | 'relation-filters' | 'legend' | 'view-layout';
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
  viewerRole?: PlatformRole;
}

function isCollapsedRootNode(node: KnowledgeNodeData): boolean {
  const metadata = (node.metadata ?? {}) as Record<string, unknown>;
  return Boolean(metadata.isVirtualChapter || metadata.isCollapsedRoot || node.id.startsWith('chapter-node:'));
}

function isExpansionLinkForNode(nodeId: string, link: KnowledgeLinkData): boolean {
  const relation = link.relationType || link.relation;
  if (nodeId.startsWith('chapter-node:')) {
    return link.sourceId === nodeId && relation === 'contains';
  }
  return link.sourceId === nodeId || link.targetId === nodeId;
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

function expansionShardKey(graphVersion: string, nodeId: string): string {
  return `${graphVersion}:shard:expansion:${nodeId}`;
}

function RelationLegendSample({ item, isLightTheme }: { item: RelationLegendItem; isLightTheme: boolean }) {
  const dashArray = item.sampleStyle.dash.length > 0 ? item.sampleStyle.dash.join(' ') : undefined;
  const markerId = `knowledge-relation-legend-${item.type}`;
  const sampleColor = isLightTheme ? item.sampleStyle.lightColor : item.sampleStyle.darkColor;

  return (
    <div className="grid grid-cols-[4rem_minmax(0,1fr)] gap-2 rounded-md border border-platform-border bg-platform-canvas-muted px-2 py-1.5">
      <svg
        viewBox="0 0 72 22"
        role="img"
        aria-label={`${item.label}关系线样式`}
        className="h-6 w-16 overflow-visible"
        data-knowledge-relation-legend-sample={item.type}
      >
        {item.sampleStyle.hasArrow && (
          <defs>
            <marker
              id={markerId}
              markerWidth="5"
              markerHeight="5"
              refX="4"
              refY="2.5"
              orient="auto"
            >
              <path d="M0,0 L5,2.5 L0,5 Z" fill={sampleColor} />
            </marker>
          </defs>
        )}
        <path
          d={`M6 11 C 24 ${11 - item.sampleStyle.curvature * 55}, 48 ${11 + item.sampleStyle.curvature * 55}, 66 11`}
          fill="none"
          stroke={sampleColor}
          strokeDasharray={dashArray}
          strokeLinecap="round"
          strokeWidth={item.sampleStyle.width}
          markerEnd={item.sampleStyle.hasArrow ? `url(#${markerId})` : undefined}
          opacity={item.sampleStyle.opacity}
        />
        {item.sampleStyle.endpoint === 'dot' && (
          <circle cx="66" cy="11" r="2.2" fill={sampleColor} opacity={item.sampleStyle.opacity} />
        )}
        {item.sampleStyle.endpoint === 'bar' && (
          <path d="M63 6 L69 16" stroke={sampleColor} strokeWidth="1.4" strokeLinecap="round" opacity={item.sampleStyle.opacity} />
        )}
        {item.sampleStyle.endpoint === 'diamond' && (
          <path d="M66 6 L70 11 L66 16 L62 11 Z" fill={sampleColor} opacity={item.sampleStyle.opacity} />
        )}
      </svg>
      <div className="min-w-0">
        <div className="text-[11px] font-medium text-platform-fg-primary">{item.label}</div>
        <div className="line-clamp-2 text-[10px] text-platform-fg-muted">{item.legendExplanation}</div>
      </div>
    </div>
  );
}

export function KnowledgeGraphSystem({
  initialNodes = [],
  initialLinks = [],
  initialSelectedNodeId = null,
  viewerRole = 'student',
}: KnowledgeGraphSystemProps) {
  const { updatePageContext, isOpen: aiSidebarOpen } = useGlobalAI();
  const initialRequestedNodeId = initialSelectedNodeId;
  const [graphCache, setGraphCache] = useState<KnowledgeGraphCacheState>(() => buildInitialGraphCache(initialNodes, initialLinks));
  const nodes = useMemo(() => Object.values(graphCache.nodesById), [graphCache.nodesById]);
  const links = useMemo(() => Object.values(graphCache.linksByKey), [graphCache.linksByKey]);
  const [isLoading, setIsLoading] = useState(initialNodes.length === 0);
  const [isBackgroundLoading, setIsBackgroundLoading] = useState(false);
  const [expandedNodeIds, setExpandedNodeIds] = useState<string[]>([]);
  const [collapsingNodeId, setCollapsingNodeId] = useState<string | null>(null);
  const [loadingExpansionNodeIds, setLoadingExpansionNodeIds] = useState<string[]>([]);
  const [filteredEmptyExpansionNodeIds, setFilteredEmptyExpansionNodeIds] = useState<string[]>([]);
  const [expansionErrorByNodeId, setExpansionErrorByNodeId] = useState<Record<string, string>>({});

  const [requestedNodeId, setRequestedNodeId] = useState<string | null>(initialRequestedNodeId);
  const [selectedNode, setSelectedNode] = useState<KnowledgeNodeData | null>(null);
  const [hoveredNode, setHoveredNode] = useState<KnowledgeNodeData | null>(null);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [dataSource, setDataSource] = useState<'file' | 'database'>('database');
  const [minRelationStrength, setMinRelationStrength] = useState(0.8);
  const [selectedRelationTypes, setSelectedRelationTypes] = useState<string[]>([]);
  const [selectedChapters, setSelectedChapters] = useState<string[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedBloomLevels, setSelectedBloomLevels] = useState<string[]>([]);
  const [showOnlyConnectedNodes, setShowOnlyConnectedNodes] = useState(true);
  const [labelMode, setLabelMode] = useState<KnowledgeGraphLabelMode>('focus');
  const [relationDensityMode, setRelationDensityMode] = useState<RelationDensityMode>('structure');
  const [desktopActiveTool, setDesktopActiveTool] = useState<KnowledgeDesktopTool | null>(null);
  const [mobileActiveTool, setMobileActiveTool] = useState<KnowledgeMobileTool>('chapter-directory');
  const [mobileToolPanelOpen, setMobileToolPanelOpen] = useState(false);
  const [isLightTheme, setIsLightTheme] = useState(false);
  const [layoutState, setLayoutState] = useState(getEmptyKnowledgeGraphLayoutState);
  const [fitViewVersion, setFitViewVersion] = useState(0);
  const [relayoutVersion, setRelayoutVersion] = useState(0);
  const [activationSequenceByCenterId, setActivationSequenceByCenterId] = useState<Record<string, number>>({});
  const [materializedNodeIds, setMaterializedNodeIds] = useState<string[]>([]);
  const [explicitFocusNodeId, setExplicitFocusNodeId] = useState<string | null>(null);
  const hoverAnimationFrameRef = useRef<number | null>(null);
  const pendingHoveredNodeRef = useRef<KnowledgeNodeData | null>(null);
  const hoveredNodeIdRef = useRef<string | null>(null);
  const desktopToolPanelRef = useRef<HTMLDivElement | null>(null);
  const desktopToolTriggerRefs = useRef<Partial<Record<KnowledgeDesktopTool, HTMLButtonElement | null>>>({});
  const previousDesktopToolRef = useRef<KnowledgeDesktopTool | null>(null);
  const mobileToolPanelRef = useRef<HTMLDivElement | null>(null);
  const mobileToolToggleRef = useRef<HTMLButtonElement | null>(null);
  const expansionActivationInFlightRef = useRef(new Set<string>());
  const expansionGenerationRef = useRef(new Map<string, number>());
  const activationSequenceRef = useRef(0);
  const expansionCommitQueueRef = useRef(createKnowledgeExpansionCommitQueue());
  const expansionIntentNodeBySequenceRef = useRef(new Map<number, string>());
  const cancelledExpansionSequencesRef = useRef(new Set<number>());
  const mountedRef = useRef(true);
  const expansionRequestControllersRef = useRef(new Map<string, AbortController>());
  const rootAutoFitTriggeredRef = useRef(false);
  const layoutGraphVersionRef = useRef<string | null>(null);
  const visibleNodeIdsRef = useRef(new Set<string>());

  const cancelPendingExpansionIntents = useCallback((centerId?: string) => {
    const candidates = [...expansionIntentNodeBySequenceRef.current.entries()]
      .filter(([, intentCenterId]) => centerId === undefined || intentCenterId === centerId);
    candidates.forEach(([sequence, intentCenterId]) => {
      cancelledExpansionSequencesRef.current.add(sequence);
      expansionRequestControllersRef.current.get(intentCenterId)?.abort();
    });
    candidates.forEach(([sequence]) => {
      expansionCommitQueueRef.current.cancel(sequence);
    });
  }, []);

  // 视图模式：默认 2D
  const [viewMode, setViewMode] = useState<'2D' | '3D'>('2D');

  // 容器尺寸测量
  const containerRef = useRef<HTMLDivElement>(null);
  const relationTypesInitialized = useRef(false);
  const initialRequestedNodeIdRef = useRef(initialRequestedNodeId);
  const initialSelectedNodeResolvedRef = useRef(false);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });

  useEffect(() => {
    if (!graphCache.graphVersion || layoutGraphVersionRef.current === graphCache.graphVersion) return;
    layoutGraphVersionRef.current = graphCache.graphVersion;
    activationSequenceRef.current = 0;
    setActivationSequenceByCenterId({});
    setMaterializedNodeIds([]);
    expansionCommitQueueRef.current.clear();
    expansionIntentNodeBySequenceRef.current.clear();
    cancelledExpansionSequencesRef.current.clear();
    expansionRequestControllersRef.current.forEach((controller) => controller.abort());
    expansionRequestControllersRef.current.clear();
    expansionActivationInFlightRef.current.clear();
    expansionGenerationRef.current.clear();
  }, [graphCache.graphVersion]);

  useEffect(() => {
    mountedRef.current = true;
    const requestControllers = expansionRequestControllersRef.current;
    return () => {
      mountedRef.current = false;
      activationSequenceRef.current += 1;
      requestControllers.forEach((controller) => controller.abort());
      requestControllers.clear();
    };
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const nodeId = params.get('node') ?? params.get('nodeId');
    initialRequestedNodeIdRef.current = nodeId;
    setRequestedNodeId(nodeId);
  }, []);

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

  // Fetch data from API on mount
  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    const mergePayload = (payload: ProgressiveGraphApiResponse) => {
      setGraphCache((current) => mergeProgressiveGraphPayload(current, payload));
      setDataSource(payload.source === 'file' ? 'file' : 'database');
    };
    const fetchProgressivePayload = async (mode: string) => {
      const response = await fetch(`/api/knowledge/graph?mode=${mode}`, { signal: controller.signal });
      if (!response.ok) throw new Error(`Failed to fetch knowledge graph ${mode} payload`);
      return (await response.json()) as ProgressiveGraphApiResponse;
    };
    const resolveRequestedNodeId = () => {
      const fromRef = initialRequestedNodeIdRef.current;
      if (fromRef) return fromRef;
      const params = new URLSearchParams(window.location.search);
      const fromUrl = params.get('node') ?? params.get('nodeId');
      initialRequestedNodeIdRef.current = fromUrl;
      setRequestedNodeId(fromUrl);
      return fromUrl;
    };
    const fetchGraphData = async () => {
      try {
        const requestedNodeId = resolveRequestedNodeId();
        const rootPayload = await fetchProgressivePayload('root');
        if (cancelled || controller.signal.aborted) return;
        mergePayload(rootPayload);
        setIsLoading(false);

        await new Promise<void>((resolve) => {
          window.requestAnimationFrame(() => resolve());
        });
        if (cancelled || controller.signal.aborted) return;
        setIsBackgroundLoading(true);
        const activePayload = await fetchProgressivePayload('active-filter');
        if (cancelled || controller.signal.aborted) return;
        mergePayload(activePayload);

        const remainingPayload = await fetchProgressivePayload('remaining');
        if (cancelled || controller.signal.aborted) return;
        mergePayload(remainingPayload);
      } catch (error) {
        if ((error as Error).name === 'AbortError') return;
        console.error('Error fetching knowledge graph data:', error);
      } finally {
        if (!cancelled && !controller.signal.aborted) {
          setIsLoading(false);
          setIsBackgroundLoading(false);
        }
      }
    };

    fetchGraphData();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, []);

  const expansionHasVisibleDescendant = useCallback((
    nodeId: string,
    candidateNodes: KnowledgeNodeData[],
    candidateLinks: KnowledgeLinkData[]
  ) => {
    const nodeById = new Map(candidateNodes.map((node) => [node.id, node]));
    return candidateLinks.some((link) => {
      if (!isExpansionLinkForNode(nodeId, link)) return false;
      const descendantId = link.sourceId === nodeId ? link.targetId : link.sourceId;
      if (descendantId === nodeId) return false;
      const descendant = nodeById.get(descendantId);
      if (!descendant) return false;
      return matchesNodeFilters(descendant, {
        searchQuery,
        selectedChapters,
        selectedCategories,
        selectedBloomLevels,
      });
    });
  }, [searchQuery, selectedBloomLevels, selectedCategories, selectedChapters]);

  const finishCollapsePresentation = useCallback((nodeId: string) => {
    setExpandedNodeIds((current) => current.filter((id) => id !== nodeId));
    setFilteredEmptyExpansionNodeIds((current) => current.filter((id) => id !== nodeId));
    setCollapsingNodeId((current) => current === nodeId ? null : current);
  }, []);

  const activateNodeById = useCallback(async (nodeId: string) => {
    const node = nodes.find((candidate) => candidate.id === nodeId);
    if (collapsingNodeId === nodeId) return;
    if (collapsingNodeId) finishCollapsePresentation(collapsingNodeId);
    const expansionState = node?.expansion?.state ?? 'unknown';
    const action = resolveKnowledgeNodeActivation({
      expansionState,
      expanded: expandedNodeIds.includes(nodeId),
      filteredEmpty: filteredEmptyExpansionNodeIds.includes(nodeId),
      loading: loadingExpansionNodeIds.includes(nodeId) || expansionActivationInFlightRef.current.has(nodeId),
      error: Boolean(expansionErrorByNodeId[nodeId]),
    });
    if (action === 'ignore') return;
    const activationSequence = ++activationSequenceRef.current;
    const releaseExpansionIntent = () => {
      expansionIntentNodeBySequenceRef.current.delete(activationSequence);
      cancelledExpansionSequencesRef.current.delete(activationSequence);
    };
    let finalizeExpansionIntent: (() => void) | null = null;
    const completeExpansionIntent = () => {
      releaseExpansionIntent();
      finalizeExpansionIntent?.();
    };
    expansionCommitQueueRef.current.register(activationSequence, () => {
      completeExpansionIntent();
    });
    if (action === 'expand' || action === 'resolve') {
      setActivationSequenceByCenterId((current) => ({ ...current, [nodeId]: activationSequence }));
      expansionIntentNodeBySequenceRef.current.set(activationSequence, nodeId);
    }
    if (action === 'inspect') {
      cancelPendingExpansionIntents();
      expansionCommitQueueRef.current.settle(activationSequence);
      if (node) {
        setSelectedNode(node);
        setIsPanelOpen(true);
      }
      return;
    }
    if (node) setSelectedNode(node);
    setIsPanelOpen(false);
    if (
      loadingExpansionNodeIds.includes(nodeId)
      || expansionActivationInFlightRef.current.has(nodeId)
    ) {
      return;
    }
    setExpansionErrorByNodeId((current) => {
      if (!current[nodeId]) return current;
      const { [nodeId]: _removed, ...remaining } = current;
      return remaining;
    });
    if (action === 'collapse') {
      cancelPendingExpansionIntents(nodeId);
      expansionCommitQueueRef.current.settle(activationSequence);
      expansionGenerationRef.current.set(nodeId, (expansionGenerationRef.current.get(nodeId) ?? 0) + 1);
      setCollapsingNodeId(nodeId);
      return;
    }

    const expectedShardKey = graphCache.graphVersion ? expansionShardKey(graphCache.graphVersion, nodeId) : '';
    const visibleNodeIdsAtActivation = new Set(visibleNodeIdsRef.current);
    let commitEnqueued = false;
    const settleExpansionCommit = (commit?: () => void) => {
      if (!commit) {
        expansionCommitQueueRef.current.settle(activationSequence);
        return;
      }
      commitEnqueued = expansionCommitQueueRef.current.settle(activationSequence, () => {
        try {
          commit();
        } finally {
          completeExpansionIntent();
        }
      }, completeExpansionIntent);
    };
    if (action !== 'resolve' && expectedShardKey && graphCache.loadedShardKeys.includes(expectedShardKey)) {
      const newlyVisibleIds = links.flatMap((link) => {
        if (!isExpansionLinkForNode(nodeId, link)) return [];
        const neighborId = link.sourceId === nodeId ? link.targetId : link.sourceId;
        return visibleNodeIdsAtActivation.has(neighborId) ? [] : [neighborId];
      });
      const hasVisibleChildren = expansionHasVisibleDescendant(nodeId, nodes, links);
      settleExpansionCommit(() => {
        if (!shouldCommitKnowledgeNodeActivation({
          mounted: mountedRef.current,
          aborted: false,
          expectedGeneration: expansionGenerationRef.current.get(nodeId) ?? 0,
          currentGeneration: expansionGenerationRef.current.get(nodeId),
          cancelled: cancelledExpansionSequencesRef.current.has(activationSequence),
        })) return;
        setMaterializedNodeIds((current) => [...new Set([...current, ...newlyVisibleIds])]);
        setExpandedNodeIds((current) => current.includes(nodeId) ? current : [...current, nodeId]);
        setFilteredEmptyExpansionNodeIds((current) => (
          hasVisibleChildren
            ? current.filter((id) => id !== nodeId)
            : current.includes(nodeId) ? current : [...current, nodeId]
        ));
      });
      return;
    }

    const requestController = new AbortController();
    expansionRequestControllersRef.current.set(nodeId, requestController);
    finalizeExpansionIntent = () => {
      const currentRequestController = expansionRequestControllersRef.current.get(nodeId);
      if (currentRequestController && currentRequestController !== requestController) return;
      expansionActivationInFlightRef.current.delete(nodeId);
      if (currentRequestController === requestController) {
        expansionRequestControllersRef.current.delete(nodeId);
      }
      if (!mountedRef.current) return;
      setLoadingExpansionNodeIds((current) => current.filter((id) => id !== nodeId));
      setGraphCache((current) => ({
        ...current,
        loadingShardKeys: expectedShardKey
          ? current.loadingShardKeys.filter((key) => key !== expectedShardKey)
          : current.loadingShardKeys,
      }));
    };
    expansionActivationInFlightRef.current.add(nodeId);
    const generation = (expansionGenerationRef.current.get(nodeId) ?? 0) + 1;
    expansionGenerationRef.current.set(nodeId, generation);
    setLoadingExpansionNodeIds((current) => current.includes(nodeId) ? current : [...current, nodeId]);
    setGraphCache((current) => ({
      ...current,
      loadingShardKeys: expectedShardKey && !current.loadingShardKeys.includes(expectedShardKey)
        ? [...current.loadingShardKeys, expectedShardKey]
        : current.loadingShardKeys,
    }));
    try {
      const response = await fetch(`/api/knowledge/graph?mode=expansion&nodeId=${encodeURIComponent(nodeId)}`, {
        signal: requestController.signal,
      });
      if (!response.ok) throw new Error(`Failed to fetch expansion shard for ${nodeId}`);
      const payload = (await response.json()) as ProgressiveGraphApiResponse;
      if (!shouldCommitKnowledgeExpansionPayload({
        mounted: mountedRef.current,
        aborted: requestController.signal.aborted,
        expectedGeneration: generation,
        currentGeneration: expansionGenerationRef.current.get(nodeId),
      })) return;
      const canonicalNode = payload.nodes?.find((candidate) => candidate.id === nodeId);
      const canonicalState = canonicalNode?.expansion?.state ?? 'unknown';
      if (canonicalState !== 'expandable' && canonicalState !== 'leaf') {
        throw new Error(`Expansion response did not resolve node ${nodeId}`);
      }
      const newlyMaterializedNodeIds = selectNewlyMaterializedKnowledgeNodeIds({
        payloadNodeIds: (payload.nodes ?? []).map((candidate) => candidate.id),
        visibleNodeIdsAtActivation,
      });
      const hasVisibleChildren = expansionHasVisibleDescendant(nodeId, payload.nodes ?? [], payload.links ?? []);
      settleExpansionCommit(() => {
        setGraphCache((current) => mergeProgressiveGraphPayload(current, payload));
        if (!shouldCommitKnowledgeNodeActivation({
          mounted: mountedRef.current,
          aborted: requestController.signal.aborted,
          expectedGeneration: generation,
          currentGeneration: expansionGenerationRef.current.get(nodeId),
          cancelled: cancelledExpansionSequencesRef.current.has(activationSequence),
        })) return;
        if (canonicalState === 'leaf') {
          setSelectedNode(canonicalNode ?? node ?? null);
          setIsPanelOpen(true);
          return;
        }
        setSelectedNode(canonicalNode ?? null);
        setMaterializedNodeIds((current) => [...new Set([
          ...current,
          ...newlyMaterializedNodeIds,
        ])]);
        setExpandedNodeIds((current) => current.includes(nodeId) ? current : [...current, nodeId]);
        setFilteredEmptyExpansionNodeIds((current) => (
          hasVisibleChildren
            ? current.filter((id) => id !== nodeId)
            : current.includes(nodeId) ? current : [...current, nodeId]
        ));
      });
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        settleExpansionCommit();
        return;
      }
      if (!shouldCommitKnowledgeExpansionPayload({
        mounted: mountedRef.current,
        aborted: requestController.signal.aborted,
        expectedGeneration: generation,
        currentGeneration: expansionGenerationRef.current.get(nodeId),
      }) || cancelledExpansionSequencesRef.current.has(activationSequence)) {
        settleExpansionCommit();
        return;
      }
      settleExpansionCommit(() => {
        if (!shouldCommitKnowledgeNodeActivation({
          mounted: mountedRef.current,
          aborted: requestController.signal.aborted,
          expectedGeneration: generation,
          currentGeneration: expansionGenerationRef.current.get(nodeId),
          cancelled: cancelledExpansionSequencesRef.current.has(activationSequence),
        })) return;
        console.error('Error fetching knowledge graph expansion shard:', error);
        setExpansionErrorByNodeId((current) => ({
          ...current,
          [nodeId]: '局部子图加载失败，可重试。',
        }));
      });
    } finally {
      if (!commitEnqueued) completeExpansionIntent();
    }
  }, [cancelPendingExpansionIntents, collapsingNodeId, expandedNodeIds, expansionErrorByNodeId, expansionHasVisibleDescendant, filteredEmptyExpansionNodeIds, finishCollapsePresentation, graphCache.graphVersion, graphCache.loadedShardKeys, links, loadingExpansionNodeIds, nodes]);

  const activateNode = useCallback((node: KnowledgeNodeData) => {
    void activateNodeById(node.id);
  }, [activateNodeById]);

  useEffect(() => {
    if (!requestedNodeId || initialSelectedNodeResolvedRef.current) return;
    if (!nodes.some((node) => node.id === requestedNodeId)) return;
    initialSelectedNodeResolvedRef.current = true;
    void activateNodeById(requestedNodeId);
  }, [activateNodeById, nodes, requestedNodeId]);

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
    setIsPanelOpen(false);
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

  const expandedNodeIdSet = useMemo(() => new Set(expandedNodeIds), [expandedNodeIds]);
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
    links.forEach((link) => {
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
  }, [links, nodes]);
  const expansionVisibleNodeIds = useMemo(() => {
    const visible = new Set<string>();
    nodes.forEach((node) => {
      if (isCollapsedRootNode(node)) visible.add(node.id);
    });
    if (selectedNode) visible.add(selectedNode.id);

    expandedNodeIdSet.forEach((nodeId) => {
      visible.add(nodeId);
      links.forEach((link) => {
        if (!isExpansionLinkForNode(nodeId, link)) return;
        visible.add(link.sourceId);
        visible.add(link.targetId);
      });
    });

    return visible;
  }, [expandedNodeIdSet, links, nodes, selectedNode]);

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
        if (!expansionVisibleNodeIds.has(node.id)) return false;
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
    [collapsedRootChildNodesByRootId, expansionVisibleNodeIds, nodes, searchQuery, selectedChapters, selectedCategories, selectedBloomLevels]
  );

  const nodeFilterIdSet = useMemo(
    () => new Set(nodeFilteredByMeta.map((item) => item.id)),
    [nodeFilteredByMeta]
  );

  // 关系类型统计按“当前节点过滤结果”计算（含搜索结果）
  const relationTypeStats = useMemo(
    () => buildRelationTypeStats(links, nodeFilterIdSet),
    [links, nodeFilterIdSet]
  );
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
  const focusNeighborhoodSeedLinks = useMemo(
    () => eligibleLinks.filter((link) =>
      relationPassesFocusNeighborhoodSeedFilters(link, {
        densityMode: relationDensityMode,
        selectedRelationTypes,
        minRelationStrength,
        focusNodeId: graphFilterFocusNodeId,
      })
    ),
    [eligibleLinks, graphFilterFocusNodeId, minRelationStrength, relationDensityMode, selectedRelationTypes]
  );
  const focusNeighborhood = useMemo(
    () => buildFocusNeighborhood(focusNeighborhoodSeedLinks, graphFilterFocusNodeId, nodeFilterIdSet),
    [focusNeighborhoodSeedLinks, graphFilterFocusNodeId, nodeFilterIdSet]
  );

  const expandedDirectLinks = useMemo(
    () => eligibleLinks.filter((link) => expandedNodeIds.some((nodeId) => isExpansionLinkForNode(nodeId, link))),
    [eligibleLinks, expandedNodeIds]
  );
  const expandedDirectNodeIds = useMemo(() => {
    const nodeIds = new Set<string>();
    expandedDirectLinks.forEach((link) => {
      nodeIds.add(link.sourceId);
      nodeIds.add(link.targetId);
    });
    expandedNodeIds.forEach((nodeId) => nodeIds.add(nodeId));
    return nodeIds;
  }, [expandedDirectLinks, expandedNodeIds]);

  useEffect(() => {
    const types = relationTypeStats.map((item) => item.type);
    setSelectedRelationTypes((prev) => {
      if (types.length === 0) return [];
      if (!relationTypesInitialized.current) {
        relationTypesInitialized.current = true;
        return buildDefaultSelectedRelationTypes(types);
      }
      const kept = prev.filter((item) => types.includes(item));
      return kept.length > 0 ? kept : buildDefaultSelectedRelationTypes(types);
    });
  }, [relationTypeStats]);

  const filteredLinksByRelation = useMemo(() => {
    return eligibleLinks.filter((link) =>
      expandedDirectLinks.includes(link) ||
      relationPassesActiveFilters(link, {
        densityMode: relationDensityMode,
        selectedRelationTypes,
        minRelationStrength,
        focusNodeId: graphFilterFocusNodeId,
        focusNeighborhood,
      })
    );
  }, [eligibleLinks, expandedDirectLinks, focusNeighborhood, graphFilterFocusNodeId, minRelationStrength, relationDensityMode, selectedRelationTypes]);

  const densityFilteredLinks = useMemo(
    () => {
      const linksAfterDensity = relationDensityMode === 'structure'
        ? limitStructureRelationDensity(filteredLinksByRelation, {
            focusNodeId: graphFilterFocusNodeId,
          })
        : filteredLinksByRelation;
      const linkKeys = new Set(linksAfterDensity.map(knowledgeLinkCacheKey));
      const retainedExpandedLinks = expandedDirectLinks.filter((link) => !linkKeys.has(knowledgeLinkCacheKey(link)));
      return [...linksAfterDensity, ...retainedExpandedLinks];
    },
    [expandedDirectLinks, filteredLinksByRelation, graphFilterFocusNodeId, relationDensityMode]
  );

  const filteredNodes = useMemo(() => {
    if (!showOnlyConnectedNodes) return nodeFilteredByMeta;

    const connectedInSearch = new Set<string>();
    const connectedByVisibleLinks = new Set<string>();

    links.forEach((link) => {
      if (nodeFilterIdSet.has(link.sourceId) && nodeFilterIdSet.has(link.targetId)) {
        connectedInSearch.add(link.sourceId);
        connectedInSearch.add(link.targetId);
      }
    });

    densityFilteredLinks.forEach((link) => {
      connectedByVisibleLinks.add(link.sourceId);
      connectedByVisibleLinks.add(link.targetId);
    });

    return nodeFilteredByMeta.filter((node) => {
      if (expandedDirectNodeIds.has(node.id)) return true;
      if (expandedNodeIdSet.has(node.id)) return true;
      if (relationDensityMode === 'focused' && focusNeighborhood.focusNodeId) {
        return isNodeVisibleInFocusedGraph(node.id, focusNeighborhood, connectedByVisibleLinks);
      }
      if (!connectedInSearch.has(node.id)) return true;
      return connectedByVisibleLinks.has(node.id);
    });
  }, [densityFilteredLinks, expandedDirectNodeIds, expandedNodeIdSet, focusNeighborhood, links, nodeFilterIdSet, nodeFilteredByMeta, relationDensityMode, showOnlyConnectedNodes]);

  const filteredNodeIdSet = useMemo(() => new Set(filteredNodes.map((item) => item.id)), [filteredNodes]);

  const filteredLinks = useMemo(() => {
    const visibleLinks = densityFilteredLinks.filter(
      (link) => filteredNodeIdSet.has(link.sourceId) && filteredNodeIdSet.has(link.targetId)
    );
    return visibleLinks;
  }, [densityFilteredLinks, filteredNodeIdSet]);

  const graphWithChapterNodes = useMemo(() => {
    const scoredNodes = filteredNodes.map((node) => ({
      ...node,
      graphDegree: graphStatistics.degreeByNodeId.get(node.id) ?? 0,
      graphImportanceScore: graphStatistics.importanceScoreByNodeId.get(node.id) ?? 0,
    }));
    if (scoredNodes.some(isCollapsedRootNode)) {
      return { nodes: scoredNodes, links: filteredLinks };
    }
    return injectChapterNodes(scoredNodes, filteredLinks);
  }, [filteredNodes, filteredLinks, graphStatistics]);

  const displayNodes = graphWithChapterNodes.nodes;
  useEffect(() => {
    visibleNodeIdsRef.current = new Set(displayNodes.map((node) => node.id));
  }, [displayNodes]);
  const displayLinks = graphWithChapterNodes.links;
  useEffect(() => {
    if (!graphCache.graphVersion || expandedNodeIds.length === 0) return;
    setFilteredEmptyExpansionNodeIds(expandedNodeIds.filter((nodeId) => isExpansionFilteredEmpty({
      shardLoaded: graphCache.loadedShardKeys.includes(expansionShardKey(graphCache.graphVersion, nodeId)),
      nodeId,
      visibleLinks: displayLinks,
    })));
  }, [displayLinks, expandedNodeIds, graphCache.graphVersion, graphCache.loadedShardKeys]);
  useEffect(() => {
    if (rootAutoFitTriggeredRef.current || displayNodes.length === 0) return;
    if (!graphCache.loadedShardKeys.some((key) => key.includes(':shard:root:'))) return;
    rootAutoFitTriggeredRef.current = true;
    setFitViewVersion((current) => current + 1);
  }, [displayNodes.length, graphCache.loadedShardKeys]);

  const displaySelectedNode = selectedNode
    ? displayNodes.find((node) => node.id === selectedNode.id) ?? null
    : null;
  const visibleSelectedNode = useMemo(
    () => selectedNode && displaySelectedNode
      ? { ...displaySelectedNode, ...selectedNode }
      : null,
    [displaySelectedNode, selectedNode]
  );
  const visiblePanelOpen = isPanelOpen && Boolean(visibleSelectedNode);
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
  const selectedNodeExpanded = Boolean(visibleSelectedNode && expandedNodeIdSet.has(visibleSelectedNode.id));
  const selectedNodeLoadingExpansion = Boolean(visibleSelectedNode && loadingExpansionNodeIds.includes(visibleSelectedNode.id));
  const selectedNodeFilteredEmpty = Boolean(visibleSelectedNode && filteredEmptyExpansionNodeIds.includes(visibleSelectedNode.id));
  const selectedNodeExpansionError = visibleSelectedNode
    ? expansionErrorByNodeId[visibleSelectedNode.id] ?? null
    : null;
  const selectedNodeExpansionState = selectedNodeLoadingExpansion
    ? 'loading'
    : selectedNodeExpansionError
      ? 'error'
      : selectedNodeFilteredEmpty
        ? 'unavailable'
        : selectedNodeExpanded
          ? 'expanded'
          : 'collapsed';
  const selectedNodeExpansionStatusText = selectedNodeExpansionState === 'loading'
    ? '正在加载当前节点的局部子图，画布和工具仍可操作。'
    : selectedNodeExpansionState === 'error'
      ? selectedNodeExpansionError ?? '局部子图加载失败，可重试。'
      : selectedNodeExpansionState === 'unavailable'
        ? '当前筛选条件下没有可见子节点，可调整筛选后再查看。'
        : selectedNodeExpansionState === 'expanded'
          ? '当前节点的局部子图已展开，缓存继续保留。'
          : '当前节点折叠显示，激活后按需加载局部子图。';
  const mobileKonlingModalOpen = aiSidebarOpen && dimensions.width < 640;
  const activeFilterSummary = [
    searchQuery ? `搜索：${searchQuery}` : '',
    selectedChapters.length > 0 ? `章节 ${selectedChapters.length}` : '',
    selectedCategories.length > 0 ? `分类 ${selectedCategories.length}` : '',
    selectedBloomLevels.length > 0 ? `层级 ${selectedBloomLevels.length}` : '',
    selectedRelationTypes.length !== relationTypeStats.length ? `关系 ${selectedRelationTypes.length}/${relationTypeStats.length}` : '',
    graphFilterFocusNodeId ? '焦点邻域' : '',
    minRelationStrength > 0 ? `强度 >= ${minRelationStrength.toFixed(1)}` : '',
    showOnlyConnectedNodes ? '仅连通节点' : '',
  ].filter(Boolean).join(' · ') || '未启用额外筛选';
  const knowledgeWorkspaceFilterSummary = [
    searchQuery.trim() ? '搜索词已启用' : '',
    selectedChapters.length > 0 ? `章节 ${selectedChapters.length}` : '',
    selectedCategories.length > 0 ? `分类 ${selectedCategories.length}` : '',
    selectedBloomLevels.length > 0 ? `层级 ${selectedBloomLevels.length}` : '',
    selectedRelationTypes.length !== relationTypeStats.length ? `关系 ${selectedRelationTypes.length}/${relationTypeStats.length}` : '',
    graphFilterFocusNodeId ? '焦点邻域' : '',
    minRelationStrength > 0 ? `强度 >= ${minRelationStrength.toFixed(1)}` : '',
    showOnlyConnectedNodes ? '仅连通节点' : '',
  ].filter(Boolean).join(' · ') || '未启用额外筛选';

  const toggleRelationType = useCallback((type: string) => {
    setSelectedRelationTypes((prev) =>
      prev.includes(type) ? prev.filter((item) => item !== type) : [...prev, type]
    );
  }, []);

  const toggleMultiSelectValue = useCallback(
    (value: string, setter: Dispatch<SetStateAction<string[]>>) => {
      setter((prev) => (prev.includes(value) ? prev.filter((item) => item !== value) : [...prev, value]));
    },
    []
  );

  const handleFitView = useCallback(() => {
    setFitViewVersion((current) => current + 1);
  }, []);

  const handleRelayout = useCallback(() => {
    setLayoutState((current) => ({
      version: current.version + 1,
      positionsByNodeId: {},
    }));
    setRelayoutVersion((current) => current + 1);
    setActivationSequenceByCenterId({});
    setMaterializedNodeIds([]);
    setFitViewVersion((current) => current + 1);
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

  const handleGraphManipulationStart = useCallback(() => {
    setIsPanelOpen(false);
  }, []);

  const handleToggleSelectedFocus = useCallback(() => {
    if (!visibleSelectedNode) return;
    setExplicitFocusNodeId((current) => current === visibleSelectedNode.id ? null : visibleSelectedNode.id);
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

  const hoveredBloomLabel = hoveredNode?.bloomLevel ? getBloomLabel(hoveredNode.bloomLevel) : '';
  const hoveredKnowledgeDimLabel = hoveredNode?.knowledgeDim
    ? getKnowledgeDimLabel(hoveredNode.knowledgeDim)
    : '';
  const hoveredChapterName = hoveredNode
    ? resolveChapterName(hoveredNode.chapter, hoveredNode.chapterName)
    : '';
  const relationLegendItems = getRelationLegendItems();
  const clarityMetrics = useMemo(
    () => calculateGraphClarityMetrics(displayNodes, displayLinks, focusNeighborhood),
    [displayLinks, displayNodes, focusNeighborhood]
  );
  const claritySummary = [
    `${clarityMetrics.visibleEdgeCount} 条可见关系`,
    `${clarityMetrics.edgeToNodeRatio.toFixed(2)} 边/点`,
    relationDensityMode === 'focused'
      ? `邻域 ${(clarityMetrics.selectedNeighborhoodEdgeRatio * 100).toFixed(0)}%`
      : `弱关系 ${(clarityMetrics.weakEdgeRatio * 100).toFixed(0)}%`,
  ].join(' · ');
  const desktopToolItems = [
    {
      id: 'chapter-directory',
      label: '目录',
      icon: BookOpen,
      summary: `${filteredNodes.length} 个节点`,
    },
    {
      id: 'relation-filters',
      label: '筛选',
      icon: Filter,
      summary: `${selectedRelationTypes.length}/${relationTypeStats.length} 类关系`,
    },
    {
      id: 'legend',
      label: '图例',
      icon: Network,
      summary: `${relationLegendItems.length} 种语义`,
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
        densityMode: relationDensityMode,
        viewMode,
        visibleRelationCount: displayLinks.length,
        selectedNodeRelationCount,
      },
    });
  }, [
    displayLinks.length,
    knowledgeWorkspaceFilterSummary,
    relationDensityMode,
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
        data-knowledge-loading-shard-count={graphCache.loadingShardKeys.length}
        data-knowledge-expanded-node-count={expandedNodeIds.length}
        data-knowledge-loading-expansion-count={loadingExpansionNodeIds.length}
        data-knowledge-background-loading={isBackgroundLoading ? 'true' : 'false'}
        data-knowledge-full-graph-first-render="avoided"
        data-knowledge-selected-node-id={visibleSelectedNode?.id ?? ''}
        data-knowledge-konling-selected-node-id={visibleSelectedNode?.id ?? ''}
        data-knowledge-konling-relation-summary={activeFilterSummary}
        data-knowledge-konling-density-mode={relationDensityMode}
        data-knowledge-konling-view-mode={viewMode}
      >
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
                {relationDensityMode === 'structure' ? '结构优先' : relationDensityMode === 'focused' ? '焦点邻域' : '全部关系'}
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
                    nodes={nodeFilteredByMeta}
                    selectedNodeId={visibleSelectedNode?.id}
                    searchQuery={searchQuery}
                    onSearchChange={setSearchQuery}
                    onNodeSelect={activateNode}
                    onNodeHover={handleNodeHover}
                  />
                )}

                {desktopActiveTool === 'relation-filters' && (
                  <div className="space-y-3" data-knowledge-local-panel="relation-filters">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="font-semibold text-platform-fg-primary">关系筛选</div>
                        <div className="text-[11px] text-platform-fg-muted">
                          当前显示关系 {displayLinks.length} 条，节点 {filteredNodes.length} / {nodes.length}
                        </div>
                      </div>
                      <span className="rounded-full border border-platform-border bg-platform-action-subtle px-2 py-0.5 text-[10px] text-platform-fg-secondary">
                        {dataSource === 'file' ? '文件图谱' : '数据库图谱'}
                      </span>
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

                    <div>
                      <div className="mb-1.5 text-[11px] text-platform-fg-secondary">关系密度</div>
                      <div className="mb-3 grid grid-cols-3 gap-1 rounded-lg border border-platform-border p-0.5">
                        {([
                          ['structure', '结构优先'],
                          ['focused', '焦点邻域'],
                          ['all', '全部关系'],
                        ] as const).map(([mode, label]) => (
                          <button
                            key={mode}
                            type="button"
                            aria-pressed={relationDensityMode === mode}
                            data-knowledge-density-mode={mode}
                            onClick={() => setRelationDensityMode(mode)}
                            className={`rounded px-2 py-1 text-[10px] transition-colors ${
                              relationDensityMode === mode
                                ? 'bg-platform-action-primary text-platform-fg-inverse'
                                : 'text-platform-fg-muted hover:bg-platform-action-subtle hover:text-platform-fg-primary'
                            }`}
                          >
                            {label}
                          </button>
                        ))}
                      </div>

                      <div className="mb-1.5 flex items-center justify-between text-[11px] text-platform-fg-secondary">
                        <span>关系类型</span>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            className="text-[10px] text-platform-fg-muted hover:text-platform-fg-primary"
                            onClick={() => setSelectedRelationTypes(relationTypeStats.map((item) => item.type))}
                          >
                            全选
                          </button>
                          <button
                            type="button"
                            className="text-[10px] text-platform-fg-muted hover:text-platform-fg-primary"
                            onClick={() => setSelectedRelationTypes([])}
                          >
                            清空
                          </button>
                        </div>
                      </div>
                      <div className="flex max-h-24 flex-wrap gap-1.5 overflow-y-auto">
                        {relationTypeStats.map((item) => {
                          const selected = selectedRelationTypes.includes(item.type);
                          return (
                            <button
                              type="button"
                              key={item.type}
                              onClick={() => toggleRelationType(item.type)}
                              className={`rounded-full border px-2 py-1 text-[10px] transition-colors ${
                                selected
                                  ? 'border-platform-action-primary bg-platform-action-subtle text-platform-fg-primary'
                                  : 'border-platform-border bg-platform-surface text-platform-fg-secondary hover:border-platform-border-strong hover:text-platform-fg-primary'
                              }`}
                            >
                              {getRelationLabel(item.type)} · {item.count}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="rounded-lg border border-platform-surface bg-platform-surface px-2.5 py-2 text-[11px] text-platform-fg-secondary">
                      <div className="mb-1 font-medium text-platform-fg-primary">关系图例</div>
                      <div className="grid max-h-48 grid-cols-2 gap-1.5 overflow-y-auto pr-1">
                        {relationLegendItems.map((item) => (
                          <RelationLegendSample key={`desktop-filter-legend-${item.type}`} item={item} isLightTheme={isLightTheme} />
                        ))}
                      </div>
                    </div>

                    <div>
                      <div className="mb-1.5 flex items-center justify-between text-[11px] text-platform-fg-secondary">
                        <span>关系强度阈值</span>
                        <span className="text-platform-action-primary">{minRelationStrength.toFixed(1)}</span>
                      </div>
                      <input
                        aria-label="关系强度阈值"
                        type="range"
                        min={0}
                        max={1}
                        step={0.1}
                        value={minRelationStrength}
                        onChange={(e) => setMinRelationStrength(Number(e.target.value))}
                        className="w-full accent-[hsl(var(--platform-action-primary))]"
                      />
                      {relationDensityMode === 'focused' && (
                        <p className="mt-1 text-[10px] text-platform-fg-muted">
                          焦点邻域会保留直连弱关系，关系类型筛选仍然生效。
                        </p>
                      )}
                    </div>

                    <label className="flex cursor-pointer items-center gap-2 text-[11px] text-platform-fg-secondary">
                      <input
                        type="checkbox"
                        checked={showOnlyConnectedNodes}
                        onChange={(e) => setShowOnlyConnectedNodes(e.target.checked)}
                        className="h-3.5 w-3.5 accent-[hsl(var(--platform-action-primary))]"
                      />
                      <span>仅显示存在可见关系的节点</span>
                    </label>

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

                {desktopActiveTool === 'legend' && (
                  <div className="grid gap-2" data-knowledge-local-panel="relation-legend">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="font-semibold text-platform-fg-primary">关系图例</div>
                        <div className="text-[11px] text-platform-fg-muted">细线、虚线和端点标记解释关系语义。</div>
                      </div>
                      <Network className="h-4 w-4 text-platform-action-primary" aria-hidden="true" />
                    </div>
                    <div className="grid gap-1.5">
                      {relationLegendItems.map((item) => (
                        <RelationLegendSample key={`desktop-command-legend-${item.type}`} item={item} isLightTheme={isLightTheme} />
                      ))}
                    </div>
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
            className="absolute left-3 right-3 top-3 z-30 grid gap-2 lg:hidden"
            data-knowledge-mobile-command-surface="single-tool-panel"
            data-knowledge-local-tool={mobileActiveTool}
            data-state={mobileToolPanelOpen ? 'open' : 'closed'}
          >
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-platform-border bg-platform-surface/95 p-2 text-xs text-platform-fg-primary shadow-lg backdrop-blur">
            {([
              ['chapter-directory', '目录'],
              ['relation-filters', '筛选'],
              ['legend', '图例'],
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
              onClick={() => setMobileToolPanelOpen((open) => !open)}
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
              className="max-h-[min(28rem,calc(100vh-7rem))] overflow-y-auto rounded-xl border border-platform-border bg-platform-surface/95 p-3 text-xs text-platform-fg-primary shadow-xl backdrop-blur"
              data-knowledge-mobile-tool-panel={mobileActiveTool}
              data-state="open"
            >
            {mobileActiveTool === 'chapter-directory' && (
              <div data-knowledge-mobile-drawer="chapter-directory" data-knowledge-local-tool="chapter-directory" data-state="open">
                <KnowledgeSidebar
                  nodes={nodeFilteredByMeta}
                  selectedNodeId={visibleSelectedNode?.id}
                  searchQuery={searchQuery}
                  onSearchChange={setSearchQuery}
                  onNodeSelect={activateNode}
                  onNodeHover={handleNodeHover}
                />
              </div>
            )}

            {mobileActiveTool === 'relation-filters' && (
              <div className="space-y-2" data-knowledge-mobile-drawer="relation-filters" data-knowledge-local-tool="relation-filters" data-state="open">
                <p className="text-platform-fg-secondary">关系 {displayLinks.length} 条 · 节点 {filteredNodes.length} / {nodes.length}</p>
                <p className="text-[11px] text-platform-fg-muted" data-knowledge-clarity-summary="mobile">
                  {claritySummary}
                </p>
                <input aria-label="关键词搜索"
                  type="text"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="关键词搜索"
                  className="w-full rounded-md border border-platform-border bg-platform-surface px-2 py-1.5 text-xs text-platform-fg-primary outline-none"
                />
	                <details className="rounded-md border border-platform-border px-2 py-1.5" data-knowledge-mobile-filter-group="density-mode">
	                  <summary className="cursor-pointer text-[11px] font-medium">密度模式 · {relationDensityMode === 'structure' ? '结构优先' : relationDensityMode === 'focused' ? '焦点邻域' : '全部关系'}</summary>
	                  <div className="mt-2 grid grid-cols-3 gap-1 rounded-lg border border-platform-border p-0.5">
	                    {([
	                      ['structure', '结构优先'],
	                      ['focused', '焦点邻域'],
	                      ['all', '全部关系'],
	                    ] as const).map(([mode, label]) => (
	                      <button
	                        key={`mobile-density-${mode}`}
	                        type="button"
	                        aria-pressed={relationDensityMode === mode}
	                        data-knowledge-density-mode={mode}
	                        onClick={() => setRelationDensityMode(mode)}
	                        className={`rounded px-2 py-1 text-[10px] transition-colors ${
	                          relationDensityMode === mode
	                            ? 'bg-platform-action-primary text-platform-fg-inverse'
	                            : 'text-platform-fg-muted hover:bg-platform-action-subtle hover:text-platform-fg-primary'
	                        }`}
	                      >
	                        {label}
	                      </button>
	                    ))}
	                  </div>
	                </details>
	                <details className="rounded-md border border-platform-border px-2 py-1.5" data-knowledge-mobile-filter-group="relation-types">
	                  <summary className="cursor-pointer text-[11px] font-medium">关系类型 · {selectedRelationTypes.length}/{relationTypeStats.length}</summary>
	                  <div className="mt-2 flex flex-wrap gap-1.5">
	                    {relationTypeStats.map((item) => {
	                      const selected = selectedRelationTypes.includes(item.type);
	                      return (
	                        <button
	                          type="button"
	                          key={`mobile-relation-${item.type}`}
	                          aria-pressed={selected}
	                          onClick={() => toggleRelationType(item.type)}
	                          className={`rounded-full border px-2 py-1 text-[10px] transition-colors ${
	                            selected
	                              ? 'border-platform-action-primary bg-platform-action-subtle text-platform-fg-primary'
	                              : 'border-platform-border text-platform-fg-secondary'
	                          }`}
	                        >
	                          {getRelationLabel(item.type)} · {item.count}
	                        </button>
	                      );
	                    })}
	                  </div>
	                </details>
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
	                <details className="rounded-md border border-platform-border px-2 py-1.5" data-knowledge-mobile-filter-group="advanced-thresholds">
	                  <summary className="cursor-pointer text-[11px] font-medium">进阶过滤 · 强度 {minRelationStrength.toFixed(1)}</summary>
	                  <div className="mt-2 grid gap-2">
	                    <label className="grid gap-1 text-[11px] text-platform-fg-secondary">
	                      <span>关系强度阈值：{minRelationStrength.toFixed(1)}</span>
	                      <input
	                        type="range"
	                        min={0}
	                        max={1}
	                        step={0.1}
	                        value={minRelationStrength}
	                        onChange={(event) => setMinRelationStrength(Number(event.target.value))}
	                        className="w-full accent-[hsl(var(--platform-action-primary))]"
	                      />
	                    </label>
	                    <label className="flex items-center gap-2 text-[11px] text-platform-fg-secondary">
	                      <input
	                        type="checkbox"
	                        checked={showOnlyConnectedNodes}
	                        onChange={(event) => setShowOnlyConnectedNodes(event.target.checked)}
	                        className="accent-[hsl(var(--platform-action-primary))]"
	                      />
	                      <span>仅显示存在可见关系的节点</span>
	                    </label>
	                  </div>
	                </details>
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

            {mobileActiveTool === 'legend' && (
              <div className="grid gap-1.5 text-[11px] text-platform-fg-secondary" data-knowledge-mobile-drawer="legend" data-knowledge-local-tool="legend" data-state="open">
                {relationLegendItems.map((item) => (
                  <RelationLegendSample key={`mobile-legend-${item.type}`} item={item} isLightTheme={isLightTheme} />
                ))}
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

        <div
          className="pointer-events-none absolute bottom-4 left-1/2 z-40 flex -translate-x-1/2 gap-2"
          aria-label="知识图谱节点控制"
        >
          {displayNodes.map((node) => (
            <button
              key={`semantic-node-${node.id}`}
              type="button"
              data-knowledge-node-control={node.id}
              aria-label={`${node.name}，${node.expansion?.state === 'leaf' ? '叶节点' : node.expansion?.state === 'expandable' ? '可展开节点' : '状态待解析'}`}
              aria-busy={loadingExpansionNodeIds.includes(node.id)}
              aria-expanded={node.expansion?.state === 'expandable' ? expandedNodeIdSet.has(node.id) : undefined}
              aria-describedby="knowledge-node-activation-status"
              data-error={expansionErrorByNodeId[node.id] ? 'true' : 'false'}
              data-filtered-empty={filteredEmptyExpansionNodeIds.includes(node.id) ? 'true' : 'false'}
              data-shard-cached={graphCache.graphVersion && graphCache.loadedShardKeys.includes(expansionShardKey(graphCache.graphVersion, node.id)) ? 'true' : 'false'}
              onClick={() => void activateNodeById(node.id)}
              className="pointer-events-auto h-px w-px overflow-hidden opacity-0 focus:h-auto focus:w-auto focus:overflow-visible focus:rounded-md focus:border focus:border-platform-action-primary focus:bg-platform-surface focus:px-3 focus:py-2 focus:opacity-100 focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-platform-action-primary"
            >
              {node.name}
            </button>
          ))}
        </div>
        <span id="knowledge-node-activation-status" role="status" aria-live="polite" className="sr-only">
          {selectedNodeExpansionStatusText}
        </span>
        {selectedNodeFilteredEmpty && (
          <div
            role="status"
            className="absolute bottom-16 left-1/2 z-30 -translate-x-1/2 rounded-md border border-platform-border bg-platform-surface px-3 py-2 text-xs text-platform-fg-secondary shadow-lg"
            data-knowledge-filtered-empty-explanation="visible"
          >
            当前筛选条件隐藏了此节点的邻居；恢复筛选后将从缓存重新显示。
          </div>
        )}

        {isLoading ? (
            <div className="flex h-full w-full items-center justify-center">
              <div className="text-center">
                <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-2 border-platform-border border-t-platform-action-primary" />
                <div className="text-platform-action-primary">正在从知识库加载数据...</div>
                <div className="mt-2 text-sm text-platform-fg-muted">同步 {nodes.length} 个节点...</div>
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
                links={displayLinks}
                selectedNode={visibleSelectedNode}
                hoveredNode={hoveredNode}
                onNodeClick={activateNode}
                onNodeHover={handleNodeHover}
                onNodeDragEnd={handleNodeDragEnd}
                onManipulationStart={handleGraphManipulationStart}
                width={dimensions.width}
                height={dimensions.height}
                labelMode={labelMode}
                layoutState={layoutState}
                fitViewVersion={fitViewVersion}
                relayoutVersion={relayoutVersion}
                expandedNodeIds={expandedNodeIds}
                expandedDirectLinks={expandedDirectLinks}
                activationSequenceByCenterId={activationSequenceByCenterId}
                materializedNodeIds={materializedNodeIds}
                graphVersion={graphCache.graphVersion}
                collapsingNodeId={collapsingNodeId}
                onCollapsePresentationComplete={finishCollapsePresentation}
              />
            ) : (
              <KnowledgeGraphCanvas
                nodes={displayNodes}
                links={displayLinks}
                selectedNode={visibleSelectedNode}
                hoveredNode={hoveredNode}
                onNodeClick={activateNode}
                onNodeHover={handleNodeHover}
                onNodeDragEnd={handleNodeDragEnd}
                onManipulationStart={handleGraphManipulationStart}
                labelMode={labelMode}
                layoutState={layoutState}
                fitViewVersion={fitViewVersion}
                relayoutVersion={relayoutVersion}
                width={dimensions.width}
                height={dimensions.height}
                expandedNodeIds={expandedNodeIds}
                expandedDirectLinks={expandedDirectLinks}
                activationSequenceByCenterId={activationSequenceByCenterId}
                materializedNodeIds={materializedNodeIds}
                graphVersion={graphCache.graphVersion}
                collapsingNodeId={collapsingNodeId}
                onCollapsePresentationComplete={finishCollapsePresentation}
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
              <span className="font-medium text-platform-fg-primary">{hoveredNode.name}</span>
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
        selectedNode={visibleSelectedNode}
        onClose={handleClosePanel}
        onNodeClick={activateNodeById}
        viewerRole={viewerRole}
      />
    </div>
  );
}

export default KnowledgeGraphSystem;
