'use client';

import React, { useCallback, useEffect, useRef, useMemo, useState } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import * as d3 from 'd3';
import { KnowledgeNodeData, KnowledgeLinkData } from '../knowledge-graph-system';
import {
  applyFocusedExpansionLayout,
  calculateFocusedExpansionRevealTranslation,
  commitKnowledgeGraphRelayoutVersion,
  createFocusedExpansionRevealSignature,
  resolveKnowledgeGraphRuntimeNodeCoordinates,
  resolveFocusedExpansionRevealTarget,
  selectFocusedExpansionGraphNodes,
  freezeKnowledgeGraphDragFrame,
  type KnowledgeGraphPositionedNode,
} from './layout-engine';
import {
  getNodeColor,
  getGlowColor,
  getKnowledgeConceptNodeShape,
  getKnowledgeGraphEdgeRenderModulation,
  getKnowledgeNodeScale,
  getKnowledgeSemanticRegionStyle,
  getKnowledgeNodeMaximumPresentationRadius,
  getKnowledgeGraphEffectiveEdgeOpacity,
  getKnowledgeGraphEffectiveEdgeWidth,
  hexToRgba,
  KNOWLEDGE_GRAPH_CANDIDATE_PRESENTATION,
  KNOWLEDGE_GRAPH_SEMANTIC_MAP_CONTRACT,
  KNOWLEDGE_ROOT_BUBBLE_VITALITY,
  type KnowledgeConceptNodeShape,
} from './visual-config';
import {
  paintActiveNodeDecorations2d,
  readActiveNodeDecoration,
} from './active-node-decoration';
import {
  getKnowledgeNodeLabelPresentation,
  type KnowledgeGraphLabelMode,
} from './label-policy';
import {
  createKnowledgeGraphMotionScopeKey,
  bindKnowledgeGraphMotionEnvironment,
  createKnowledgeGraphRevealPlan,
  getKnowledgeGraphBreathingIntensity,
  getKnowledgeGraphEntranceFade,
  getKnowledgeGraphMotionMarkerFrame,
  getKnowledgeGraphMotionMarkerPlacement,
  getKnowledgeGraphMotionPhasedMarkerFrame,
  getKnowledgeGraphPresentationLinkOpacity,
  getKnowledgeGraphPresentationLinkProgress,
  getKnowledgeGraphPresentationNodeScale,
  getKnowledgeGraphPresentationNodeOpacity,
  IDLE_KNOWLEDGE_GRAPH_PRESENTATION,
  KnowledgeGraphMotionFrameLoop,
  KnowledgeGraphTransitionGate,
  KNOWLEDGE_GRAPH_FLOW_MARKER_GEOMETRY,
  KNOWLEDGE_GRAPH_MOTION_TRANSITION_EVENT,
  resolveFlowMarkerSet,
  type KnowledgeGraphPresentationState,
  KNOWLEDGE_GRAPH_MOTION,
  KNOWLEDGE_GRAPH_CORRIDOR_MARKER_GEOMETRY,
  prefersReducedKnowledgeGraphMotion,
  selectKnowledgeGraphMotionMarkerEdgeIds,
} from './motion';
import { KnowledgeGraphCameraTransition } from './camera-transition';
import {
  markKnowledgeGraphAutomaticNodeAnchors,
  syncKnowledgeGraphMutableNodePositions,
  type KnowledgeGraphLayoutState,
} from './layout-state';
import {
  isKnowledgeCanvasPolylineHit,
  finishKnowledgeCanvasBlankGesture,
  moveKnowledgeCanvasBlankGesture,
  shouldDismissKnowledgeCanvasBlankGesture,
  startKnowledgeCanvasBlankGesture,
  type KnowledgeCanvasBlankGesture,
} from './canvas-dismissal';
import {
  KNOWLEDGE_ROOT_BUBBLE_STYLE,
  type KnowledgeGraphFitRequest,
  isCompactKnowledgeRootSet,
  packKnowledgeGraphRootNodes,
} from './root-layout';
import { buildKnowledgeTeachingOrderLayout } from './teaching-order-layout';
import {
  KNOWLEDGE_NODE_LABEL_POLICY,
  KNOWLEDGE_ROOT_MINIMUM_PROJECTION_SCALE,
  getKnowledgeNodeLabelBounds,
  getKnowledgeNodeLabelPaintModel,
  getKnowledgeRootLabelPaintModel,
  layoutKnowledgeNodeLabel,
} from './node-label-layout';
import {
  getKnowledgeGraphViewportFit,
  getKnowledgeGraphViewportSafeInsets,
} from './viewport-fit';
import { placeKnowledgeGraphLabels } from './viewport-fit';
import {
  getKnowledgeGraphEndpointArrow,
  isKnowledgeGraphPointInsideNodeBoundary,
  type KnowledgeGraphNodeBoundary,
} from './edge-geometry';
import {
  buildKnowledgeGraphEdgeLaneCurvatures,
  createKnowledgeGraphRendererEdgePath,
  getKnowledgeGraphEdgeEmphasisState,
  getKnowledgeGraphEdgePresentation,
  getKnowledgeGraphNodeEmphasisOpacity,
  getKnowledgeGraphPartialEdgePath,
  getKnowledgeGraphPresentationLinkKey,
  getKnowledgeGraphPresentationFamily,
  getKnowledgeGraphRendererNodeBoundary,
  selectKnowledgeGraphStructuralForegroundEdgeIds,
  sampleKnowledgeGraphEdgePath,
  type KnowledgeGraphSelectedCorridorEmphasis,
} from './edge-presentation';
import {
  installKnowledgeGraphTask74Snapshot,
  isKnowledgeGraphTask74PerformanceQa,
} from './performance-snapshot';
import { SemanticLabelLayer } from './semantic-label-layer';

interface KnowledgeGraph2DProps {
  nodes: KnowledgeNodeData[];
  links: KnowledgeLinkData[];
  presentationLinks?: readonly KnowledgeLinkData[];
  selectedNode: KnowledgeNodeData | null;
  hoveredNode: KnowledgeNodeData | null;
  onNodeClick: (node: KnowledgeNodeData) => void;
  onNodeHover: (node: KnowledgeNodeData | null) => void;
  onNodeDragEnd: (node: KnowledgeNodeData) => void;
  onBackgroundClick?: () => void;
  width?: number;
  height?: number;
  labelMode: KnowledgeGraphLabelMode;
  layoutState: KnowledgeGraphLayoutState;
  fitViewRequest: KnowledgeGraphFitRequest;
  relayoutVersion: number;
  expandedNodeIds: readonly string[];
  expandedDirectLinks: readonly KnowledgeLinkData[];
  activationSequenceByCenterId: Readonly<Record<string, number>>;
  materializedNodeIds: readonly string[];
  graphVersion: string | null;
  lessonOrderNodeIds?: readonly string[];
  teachingOrderLinks?: readonly KnowledgeLinkData[];
  selectedCorridorEmphasis?: KnowledgeGraphSelectedCorridorEmphasis | null;
  collapsingNodeId?: string | null;
  onCollapsePresentationComplete?: (nodeId: string) => void;
}

export const KNOWLEDGE_GRAPH_2D_LIBRARY_DEFAULT_MIN_ZOOM = 0.01;

const EMPTY_LESSON_ORDER_NODE_IDS: readonly string[] = [];

type RuntimeKnowledgeGraphNode = KnowledgeGraphPositionedNode & {
  vx?: number;
  vy?: number;
  vz?: number;
};

// ========== 形状绘制函数 ==========

/**
 * 绘制圆形
 */
function drawCircle(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number
) {
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, 2 * Math.PI, false);
  ctx.fill();
}

/**
 * 绘制方形
 */
function drawSquare(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number
) {
  ctx.fillRect(x - size / 2, y - size / 2, size, size);
}

/**
 * 绘制六边形
 */
function drawHexagon(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number
) {
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 3) * i - Math.PI / 2;
    const px = x + radius * Math.cos(angle);
    const py = y + radius * Math.sin(angle);
    if (i === 0) {
      ctx.moveTo(px, py);
    } else {
      ctx.lineTo(px, py);
    }
  }
  ctx.closePath();
  ctx.fill();
}

/**
 * 绘制正多边形（三角形/菱形/五边形等，canvas y 轴向下，-π/2 即顶点朝上）
 */
function drawRegularPolygon(
  ctx: CanvasRenderingContext2D,
  sides: number,
  x: number,
  y: number,
  radius: number
) {
  ctx.beginPath();
  for (let i = 0; i < sides; i++) {
    const angle = (Math.PI * 2 * i) / sides - Math.PI / 2;
    const px = x + radius * Math.cos(angle);
    const py = y + radius * Math.sin(angle);
    if (i === 0) {
      ctx.moveTo(px, py);
    } else {
      ctx.lineTo(px, py);
    }
  }
  ctx.closePath();
  ctx.fill();
}

/**
 * 根据概念形状选择绘制函数
 */
function drawShape(
  ctx: CanvasRenderingContext2D,
  shape: KnowledgeConceptNodeShape,
  x: number,
  y: number,
  size: number
) {
  switch (shape) {
    case 'circle':
      drawCircle(ctx, x, y, size);
      break;
    case 'square':
      drawSquare(ctx, x, y, size * 1.6); // 方形需要稍大以保持视觉一致
      break;
    case 'hexagon':
      drawHexagon(ctx, x, y, size * 1.2);
      break;
    case 'triangle':
      drawRegularPolygon(ctx, 3, x, y, size * 1.2);
      break;
    case 'diamond':
      drawRegularPolygon(ctx, 4, x, y, size * 1.2);
      break;
    case 'pentagon':
      drawRegularPolygon(ctx, 5, x, y, size * 1.2);
      break;
    default:
      drawCircle(ctx, x, y, size);
  }
}

function getNodePointerBoundary(
  shape: KnowledgeConceptNodeShape,
  presentationRadius: number,
): KnowledgeGraphNodeBoundary {
  return getKnowledgeGraphRendererNodeBoundary({ renderer: '2d', shape, presentationRadius });
}

function drawNodePointerShape(
  ctx: CanvasRenderingContext2D,
  shape: KnowledgeConceptNodeShape,
  x: number,
  y: number,
  presentationRadius: number,
  tolerance: number,
) {
  switch (shape) {
    case 'square':
      drawSquare(ctx, x, y, presentationRadius * 1.6 + tolerance * 2);
      break;
    case 'hexagon':
      drawHexagon(ctx, x, y, presentationRadius * 1.2 + tolerance);
      break;
    case 'triangle':
      drawRegularPolygon(ctx, 3, x, y, presentationRadius * 1.2 + tolerance);
      break;
    case 'diamond':
      drawRegularPolygon(ctx, 4, x, y, presentationRadius * 1.2 + tolerance);
      break;
    case 'pentagon':
      drawRegularPolygon(ctx, 5, x, y, presentationRadius * 1.2 + tolerance);
      break;
    default:
      drawCircle(ctx, x, y, presentationRadius + tolerance);
  }
}

function traceNodeShapeOutline(
  ctx: CanvasRenderingContext2D,
  shape: KnowledgeConceptNodeShape,
  x: number,
  y: number,
  baseRadius: number
) {
  if (shape === 'circle') {
    ctx.arc(x, y, baseRadius, 0, 2 * Math.PI);
    return;
  }
  if (shape === 'square') {
    const size = baseRadius * 1.6;
    ctx.rect(x - size / 2, y - size / 2, size, size);
    return;
  }
  const sides = shape === 'triangle' ? 3 : shape === 'diamond' ? 4 : shape === 'pentagon' ? 5 : 6;
  const radius = baseRadius * 1.2;
  for (let i = 0; i < sides; i += 1) {
    const angle = (Math.PI * 2 * i) / sides - Math.PI / 2;
    const px = x + radius * Math.cos(angle);
    const py = y + radius * Math.sin(angle);
    if (i === 0) {
      ctx.moveTo(px, py);
    } else {
      ctx.lineTo(px, py);
    }
  }
  ctx.closePath();
}

export function KnowledgeGraph2D({
  nodes,
  links,
  presentationLinks = links,
  selectedNode,
  hoveredNode,
  onNodeClick,
  onNodeHover,
  onNodeDragEnd,
  onBackgroundClick,
  width,
  height,
  labelMode,
  layoutState,
  fitViewRequest,
  relayoutVersion,
  expandedNodeIds,
  expandedDirectLinks,
  activationSequenceByCenterId,
  materializedNodeIds,
  graphVersion,
  lessonOrderNodeIds = EMPTY_LESSON_ORDER_NODE_IDS,
  teachingOrderLinks = links,
  selectedCorridorEmphasis = selectedNode ? {
    selectedNodeId: selectedNode.id,
    nodeIds: [selectedNode.id],
    edgeIds: [],
  } : null,
  collapsingNodeId = null,
  onCollapsePresentationComplete,
}: KnowledgeGraph2DProps) {
  const compactRootView = isCompactKnowledgeRootSet(nodes);
  const fgRef = useRef<any>(null);
  const activeCanvasPointerIdsRef = useRef(new Set<number>());
  const blankGesturesByPointerIdRef = useRef(new Map<number, KnowledgeCanvasBlankGesture>());
  const completedBlankGestureRef = useRef<KnowledgeCanvasBlankGesture | null>(null);
  const consumedFitSignatureRef = useRef<string | null>(null);
  const fitTimerRef = useRef<number | null>(null);
  const labelProjectionTimerRef = useRef<number | null>(null);
  const labelRefreshTimerRef = useRef<number | null>(null);
  const syncRichLabelLayerRef = useRef<(scale?: number) => void>(() => undefined);
  const labelPlacementCacheRef = useRef<{
    nodes: readonly unknown[];
    scale: number;
    anchorX: number;
    anchorY: number;
    selectedNodeId?: string;
    hoveredNodeId?: string;
    labelMode: KnowledgeGraphLabelMode;
    width: number;
    height: number;
    placements: ReturnType<typeof placeKnowledgeGraphLabels>;
    revision: number;
  } | null>(null);
  const labelProjectionRevisionRef = useRef(0);
  const layoutStateRef = useRef(layoutState);
  const runtimePositionsByNodeIdRef = useRef(new Map<string, Partial<RuntimeKnowledgeGraphNode>>());
  const committedRelayoutVersionRef = useRef(relayoutVersion);
  const committedGraphVersionRef = useRef(graphVersion);
  const revealedExpansionSignatureRef = useRef('');
  const previousExpandedNodeIdsRef = useRef<readonly string[]>([]);
  const focusedRevealTargetNodeIdRef = useRef<string | null>(null);
  const presentationExpandedNodeIdsRef = useRef<readonly string[]>([]);
  const presentationGenerationRef = useRef(0);
  const presentationGateRef = useRef(new KnowledgeGraphTransitionGate());
  const cameraTransitionRef = useRef(new KnowledgeGraphCameraTransition());
  const motionFrameLoopRef = useRef<KnowledgeGraphMotionFrameLoop | null>(null);
  const motionElapsedMsRef = useRef(0);
  const [presentation, setPresentation] = useState<KnowledgeGraphPresentationState>(
    IDLE_KNOWLEDGE_GRAPH_PRESENTATION
  );
  const [viewportRevision, setViewportRevision] = useState(0);
  const [layoutSettledRevision, setLayoutSettledRevision] = useState(0);
  const settledLayoutSignatureRef = useRef('');
  const [reducedMotion, setReducedMotion] = useState(false);
  const [motionEnvironmentActive, setMotionEnvironmentActive] = useState(false);
  useEffect(() => {
    const handleResize = () => setViewportRevision((value) => value + 1);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  const presentationRef = useRef(IDLE_KNOWLEDGE_GRAPH_PRESENTATION);
  presentationRef.current = presentation;
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [isLightTheme, setIsLightTheme] = useState(false);
  const laneCurvatureByLinkKey = useMemo(
    () => buildKnowledgeGraphEdgeLaneCurvatures(presentationLinks),
    [presentationLinks],
  );
  layoutStateRef.current = layoutState;

  useEffect(() => {
    const updateTheme = () => {
      setIsLightTheme(document.documentElement.classList.contains('light'));
    };

    updateTheme();
    const observer = new MutationObserver(updateTheme);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    committedRelayoutVersionRef.current = commitKnowledgeGraphRelayoutVersion({
      committedVersion: committedRelayoutVersionRef.current,
      nextVersion: relayoutVersion,
      runtimePositions: runtimePositionsByNodeIdRef.current,
    });
  }, [relayoutVersion]);

  useEffect(() => {
    runtimePositionsByNodeIdRef.current.clear();
    revealedExpansionSignatureRef.current = '';
    previousExpandedNodeIdsRef.current = [];
    focusedRevealTargetNodeIdRef.current = null;
    presentationExpandedNodeIdsRef.current = [];
    presentationGateRef.current.cancel();
    presentationRef.current = IDLE_KNOWLEDGE_GRAPH_PRESENTATION;
    setPresentation(IDLE_KNOWLEDGE_GRAPH_PRESENTATION);
  }, [graphVersion]);

  useEffect(() => () => {
    if (fitTimerRef.current !== null) window.clearTimeout(fitTimerRef.current);
    if (labelProjectionTimerRef.current !== null) window.clearTimeout(labelProjectionTimerRef.current);
    if (labelRefreshTimerRef.current !== null) window.clearTimeout(labelRefreshTimerRef.current);
    presentationGateRef.current.dispose();
    cameraTransitionRef.current.dispose();
    motionFrameLoopRef.current?.dispose();
  }, []);

  // 1. 处理数据并应用布局
  const graphData = useMemo(() => {
    const graphVersionChanged = committedGraphVersionRef.current !== graphVersion;
    if (graphVersionChanged) runtimePositionsByNodeIdRef.current.clear();
    committedGraphVersionRef.current = graphVersion;
    const degreeById = new Map<string, number>();
    links.forEach((link) => {
      degreeById.set(link.sourceId, (degreeById.get(link.sourceId) ?? 0) + 1);
      degreeById.set(link.targetId, (degreeById.get(link.targetId) ?? 0) + 1);
    });
    const clonedNodes = nodes.map(n => ({
      ...n,
      graphDegree: n.graphDegree ?? degreeById.get(n.id) ?? 0,
    }));

    // 转换 links: sourceId/targetId -> source/target (ForceGraph2D 格式)
    const transformedLinks = links.map(l => ({
      ...l,
      source: l.sourceId,
      target: l.targetId,
    }));

    const useCompactRootPacking = isCompactKnowledgeRootSet(clonedNodes);
    const preserveRuntimeCoordinates = !useCompactRootPacking
      && !graphVersionChanged
      && committedRelayoutVersionRef.current === relayoutVersion;

    const baseLayoutNodes = useCompactRootPacking
      ? packKnowledgeGraphRootNodes(clonedNodes, {
          viewportWidth: width ?? 1280,
          viewportHeight: height ?? 720,
          graphVersion,
        })
      : buildKnowledgeTeachingOrderLayout({
          nodes: clonedNodes,
          links: teachingOrderLinks,
          lessonOrderNodeIds,
          viewportWidth: width ?? 1280,
          viewportHeight: height ?? 720,
        }).nodes;
    const layoutNodes = resolveKnowledgeGraphRuntimeNodeCoordinates({
      nodes: baseLayoutNodes as RuntimeKnowledgeGraphNode[],
      liveNodes: fgRef.current?.graphData?.()?.nodes as RuntimeKnowledgeGraphNode[] | undefined,
      runtimePositionsByNodeId: runtimePositionsByNodeIdRef.current,
      preserve: preserveRuntimeCoordinates,
    }) as RuntimeKnowledgeGraphNode[];
    markKnowledgeGraphAutomaticNodeAnchors(layoutNodes);
    const focusedLayoutNodes = applyFocusedExpansionLayout({
      nodes: layoutNodes,
      expandedNodeIds,
      directExpansionLinks: expandedDirectLinks,
      layoutState,
      activationSequenceByCenterId,
      materializedNodeIds,
    });

    return {
      nodes: focusedLayoutNodes,
      links: transformedLinks
    };
  }, [nodes, links, relayoutVersion, layoutState, expandedNodeIds, expandedDirectLinks, activationSequenceByCenterId, materializedNodeIds, graphVersion, width, height, lessonOrderNodeIds, teachingOrderLinks]);
  const structuralForegroundEdgeIdSet = useMemo(() => new Set(
    selectKnowledgeGraphStructuralForegroundEdgeIds(graphData.links),
  ), [graphData.links]);

  const motionMarkerEdgeIds = useMemo(() => selectKnowledgeGraphMotionMarkerEdgeIds({
    active: Boolean(selectedCorridorEmphasis?.selectedNodeId),
    motionEligibleEdgeIds: selectedCorridorEmphasis?.motionEligibleEdgeIds ?? [],
    motionSuppressedEdgeIds: selectedCorridorEmphasis?.motionSuppressedEdgeIds ?? [],
    visibleEdgeIds: graphData.links.map((link) => getKnowledgeGraphPresentationLinkKey(link)),
  }), [graphData.links, selectedCorridorEmphasis]);
  const motionMarkerEdgeIdSet = useMemo(() => new Set(motionMarkerEdgeIds), [motionMarkerEdgeIds]);
  // 环境流层：同一可见 post-requisite 结构前景集合上的确定性预算标记。
  const ambientFlowSelection = useMemo(() => resolveFlowMarkerSet({
    scope: 'ambient',
    active: true,
    motionEligibleEdgeIds: [...structuralForegroundEdgeIdSet],
    motionSuppressedEdgeIds: [],
    visibleEdgeIds: graphData.links.map((link) => getKnowledgeGraphPresentationLinkKey(link)),
  }), [graphData.links, structuralForegroundEdgeIdSet]);
  const ambientFlowEdgeIdSet = useMemo(() => new Set(ambientFlowSelection.edgeIds), [ambientFlowSelection]);
  // 并发计数与绘制同口径：环境流层会排除已选走廊边，重叠边只按走廊标记计一次，
  // 否则快照、属性与性能预算都在高报真实并发标记数。
  const activeMotionMarkerCount = motionMarkerEdgeIds.length
    + ambientFlowSelection.edgeIds.filter((edgeId) => !motionMarkerEdgeIdSet.has(edgeId)).length;

  // 根气泡入场错峰：按稳定排序的气泡 id 计算每个气泡的淡入延迟（纯绘制层）。
  // 必须从打包后的 graphData.nodes 计算——__knowledgeRootPacking 由本组件
  // packKnowledgeGraphRootNodes 注入，props.nodes 不携带该字段。
  const rootEntranceDelayByNodeId = useMemo(() => {
    const rootBubbleIds = graphData.nodes
      .filter((node: any) => Boolean(node.__knowledgeRootPacking))
      .map((node: any) => node.id)
      .sort();
    const span = KNOWLEDGE_ROOT_BUBBLE_VITALITY.entrance.staggerSpanMs;
    return new Map(rootBubbleIds.map((nodeId, index) => [
      nodeId,
      rootBubbleIds.length > 1 ? (index * span) / (rootBubbleIds.length - 1) : 0,
    ]));
  }, [graphData.nodes]);
  const rootEntranceStartMsRef = useRef<number | null>(null);
  // 入场结束态用 state 收敛：布防 ref 只服务 paintNode 的淡入采样，
  // entranceDone 让 entranceActive 在错峰播完后关闭，重绘门控才能随之冻结。
  const [entranceDone, setEntranceDone] = useState(false);
  const entranceScopeKey = `${graphVersion}:${[...rootEntranceDelayByNodeId.keys()].join('|')}:${reducedMotion ? 'rm' : 'full'}`;
  const entranceScopeKeyRef = useRef('');
  if (entranceScopeKeyRef.current !== entranceScopeKey) {
    entranceScopeKeyRef.current = entranceScopeKey;
    setEntranceDone(false);
    rootEntranceStartMsRef.current = rootEntranceDelayByNodeId.size > 0 && !reducedMotion
      ? performance.now()
      : null;
  }
  const entranceActive = rootEntranceStartMsRef.current !== null && !entranceDone;
  const rootBreathingActive = !reducedMotion && graphData.nodes.some((node: any) => (
    Boolean(node.__knowledgeRootPacking) && (selectedNode?.id === node.id || hoveredNode?.id === node.id)
  ));
  // autoPauseRedraw=false 只在运动活动时逐帧重绘（force-graph 的 ref 没有 refresh()，
  // 默认 autoPauseRedraw=true 会在引擎冷却后冻结一切绘制）；空闲时恢复冻结与指针交互。
  const motionPaintActive = motionEnvironmentActive && !reducedMotion
    && (activeMotionMarkerCount > 0 || rootBreathingActive || entranceActive);
  const motionScopeKey = createKnowledgeGraphMotionScopeKey({
    graphVersion,
    selectedNodeId: selectedCorridorEmphasis?.selectedNodeId ?? null,
    visibleNodeIds: graphData.nodes.map((node) => node.id),
    motionEligibleEdgeIds: motionMarkerEdgeIds,
  });

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') {
      setReducedMotion(false);
      setMotionEnvironmentActive(true);
      return;
    }
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    return bindKnowledgeGraphMotionEnvironment({
      documentTarget: document,
      mediaQuery,
      offscreenTarget: rootRef.current,
      transitionEvent: {
        eventTarget: document,
        isActive: () => presentationRef.current.phase !== 'idle',
      },
      suspend: () => {
        motionFrameLoopRef.current?.stop();
        motionElapsedMsRef.current = 0;
        setReducedMotion(mediaQuery.matches);
        setMotionEnvironmentActive(false);
        fgRef.current?.refresh?.();
      },
      resume: () => {
        setReducedMotion(false);
        setMotionEnvironmentActive(true);
      },
    });
  }, []);

  useEffect(() => {
    document.dispatchEvent(new CustomEvent(KNOWLEDGE_GRAPH_MOTION_TRANSITION_EVENT));
  }, [presentation.phase]);

  useEffect(() => {
    const motionDisabled = !motionEnvironmentActive || reducedMotion || prefersReducedKnowledgeGraphMotion();
    if (motionDisabled || (activeMotionMarkerCount === 0 && !rootBreathingActive && !entranceActive)) {
      const shouldRefresh = motionElapsedMsRef.current > 0 || activeMotionMarkerCount > 0;
      motionFrameLoopRef.current?.stop();
      motionElapsedMsRef.current = 0;
      if (shouldRefresh) fgRef.current?.refresh?.();
      return;
    }
    const loop = motionFrameLoopRef.current ?? new KnowledgeGraphMotionFrameLoop({
      now: () => performance.now(),
      requestFrame: (callback) => window.requestAnimationFrame(callback),
      cancelFrame: (frameId) => window.cancelAnimationFrame(frameId),
    });
    motionFrameLoopRef.current = loop;
    loop.start(motionScopeKey, (elapsedMs) => {
      motionElapsedMsRef.current = elapsedMs;
      fgRef.current?.refresh?.();
      // 入场结束后且无走廊/环境流/呼吸活动时自动停摆，避免空转。
      if (activeMotionMarkerCount === 0 && !rootBreathingActive) {
        const entranceStartMs = rootEntranceStartMsRef.current;
        if (entranceStartMs === null
          || performance.now() - entranceStartMs >= KNOWLEDGE_ROOT_BUBBLE_VITALITY.entrance.totalDurationMs) {
          setEntranceDone(true);
          motionFrameLoopRef.current?.stop();
        }
      }
    });
    return () => loop.stop();
  }, [activeMotionMarkerCount, entranceActive, motionEnvironmentActive, motionScopeKey, reducedMotion, rootBreathingActive]);

  useEffect(() => {
    cameraTransitionRef.current.cancel();
    const expandedIds = [...new Set(expandedNodeIds)];
    const previousExpandedIds = presentationExpandedNodeIdsRef.current;
    const targetNodeId = collapsingNodeId ?? resolveFocusedExpansionRevealTarget(previousExpandedIds, expandedIds);
    if (!targetNodeId) {
      presentationExpandedNodeIdsRef.current = expandedIds;
      const activePresentation = presentationRef.current;
      if (
        expandedIds.length > 0
        && activePresentation.phase !== 'idle'
        && activePresentation.targetNodeId
        && expandedIds.includes(activePresentation.targetNodeId)
      ) return;
      presentationGateRef.current.cancel();
      presentationRef.current = IDLE_KNOWLEDGE_GRAPH_PRESENTATION;
      setPresentation((current) => current.phase === 'idle'
        ? current
        : IDLE_KNOWLEDGE_GRAPH_PRESENTATION);
      return;
    }
    const targetDirectLinks = expandedDirectLinks.filter((link) => (
      link.sourceId === targetNodeId || link.targetId === targetNodeId
    ));
    const directNodeIds = [...new Set(targetDirectLinks.map((link) => (
      link.sourceId === targetNodeId ? link.targetId : link.sourceId
    )))];
    const relationIds = targetDirectLinks.map((link) => `${link.sourceId}:${link.targetId}`);
    const phase = collapsingNodeId ? 'collapsing' : 'revealing';
    const nodeById = new Map(graphData.nodes.map((node) => [node.id, node as KnowledgeNodeData & {
      __knowledgeAutomaticAnchor?: { activationSequence?: number; provenanceCenterId?: string };
    }]));
    const activationSequence = activationSequenceByCenterId[targetNodeId];
    const newlyMaterializedNodeIds = directNodeIds.filter((nodeId) => {
      const anchor = nodeById.get(nodeId)?.__knowledgeAutomaticAnchor;
      return materializedNodeIds.includes(nodeId)
        && anchor?.provenanceCenterId === targetNodeId
        && (activationSequence === undefined || anchor.activationSequence === activationSequence);
    });
    if (phase === 'revealing' && newlyMaterializedNodeIds.length === 0) {
      presentationGateRef.current.cancel();
      presentationRef.current = IDLE_KNOWLEDGE_GRAPH_PRESENTATION;
      setPresentation((current) => current.phase === 'idle'
        ? current
        : IDLE_KNOWLEDGE_GRAPH_PRESENTATION);
      return;
    }
    presentationExpandedNodeIdsRef.current = expandedIds;
    const animatedRelationIds = phase === 'collapsing'
      ? relationIds
      : targetDirectLinks
        .filter((link) => newlyMaterializedNodeIds.includes(
          link.sourceId === targetNodeId ? link.targetId : link.sourceId
        ))
        .map((link) => `${link.sourceId}:${link.targetId}`);
    const plan = createKnowledgeGraphRevealPlan({
      graphVersion: graphVersion ?? 'pending',
      targetNodeId,
      generation: ++presentationGenerationRef.current,
      nodeIds: phase === 'collapsing' ? directNodeIds : newlyMaterializedNodeIds,
      reducedMotion: prefersReducedKnowledgeGraphMotion(),
    });
    presentationGateRef.current.cancel(plan.key);
    if (plan.focusDurationMs === 0) {
      presentationRef.current = IDLE_KNOWLEDGE_GRAPH_PRESENTATION;
      setPresentation(IDLE_KNOWLEDGE_GRAPH_PRESENTATION);
      if (collapsingNodeId) onCollapsePresentationComplete?.(collapsingNodeId);
      return;
    }
    const nodeTimings = Object.fromEntries(plan.nodes.map((node) => [node.nodeId, {
      delayMs: node.delayMs,
      durationMs: node.durationMs,
    }]));
    const durationMs = phase === 'collapsing'
      ? plan.collapseDurationMs
      : Math.max(plan.focusDurationMs, plan.relationDurationMs, ...plan.nodes.map((node) => node.delayMs + node.durationMs));
    const nextPresentation: KnowledgeGraphPresentationState = {
      key: plan.key,
      phase,
      targetNodeId,
      directNodeIds,
      animatedNodeIds: phase === 'collapsing' ? directNodeIds : newlyMaterializedNodeIds,
      revealedNodeIds: phase === 'collapsing' ? directNodeIds : [],
      revealedRelationIds: phase === 'collapsing' ? relationIds : [],
      animatedRelationIds,
      elapsedMs: 0,
      durationMs,
      relationDurationMs: plan.relationDurationMs,
      collapseDurationMs: plan.collapseDurationMs,
      animateParticles: plan.animateParticles,
      nodeTimings,
    };
    presentationRef.current = nextPresentation;
    setPresentation(nextPresentation);
    if (phase === 'collapsing') {
      presentationGateRef.current.schedule(plan.key, () => {
        presentationRef.current = IDLE_KNOWLEDGE_GRAPH_PRESENTATION;
        setPresentation(IDLE_KNOWLEDGE_GRAPH_PRESENTATION);
        onCollapsePresentationComplete?.(targetNodeId);
      }, plan.collapseDurationMs);
      return;
    }
    presentationGateRef.current.schedule(plan.key, () => {
      setPresentation((current) => current.key === plan.key
        ? { ...current, revealedRelationIds: animatedRelationIds }
        : current);
    }, plan.relationDurationMs);
    plan.nodes.forEach((node) => {
      presentationGateRef.current.schedule(plan.key, () => {
        setPresentation((current) => current.key === plan.key
          ? { ...current, revealedNodeIds: [...new Set([...current.revealedNodeIds, node.nodeId])] }
          : current);
      }, node.delayMs);
    });
    presentationGateRef.current.schedule(plan.key, () => {
      presentationRef.current = IDLE_KNOWLEDGE_GRAPH_PRESENTATION;
      setPresentation(IDLE_KNOWLEDGE_GRAPH_PRESENTATION);
    }, durationMs);
  }, [activationSequenceByCenterId, collapsingNodeId, expandedDirectLinks, expandedNodeIds, graphData.nodes, graphVersion, materializedNodeIds, nodes, onCollapsePresentationComplete]);

  const presentationKey = presentation.key;
  const presentationPhase = presentation.phase;
  const presentationDurationMs = presentation.durationMs ?? 0;

  useEffect(() => {
    if (presentationPhase === 'idle' || !presentationKey || presentationDurationMs <= 0) return;
    const startedAtMs = performance.now();
    const requestFrame = typeof window.requestAnimationFrame === 'function'
      ? window.requestAnimationFrame.bind(window)
      : (callback: FrameRequestCallback) => window.setTimeout(() => callback(performance.now()), 16);
    const cancelFrame = typeof window.cancelAnimationFrame === 'function'
      ? window.cancelAnimationFrame.bind(window)
      : (frame: number) => window.clearTimeout(frame);
    let frame = 0;
    const tick = (now: number) => {
      const elapsedMs = Math.min(presentationDurationMs, Math.max(0, now - startedAtMs));
      setPresentation((current) => current.key === presentationKey
        ? { ...current, elapsedMs }
        : current);
      if (elapsedMs < presentationDurationMs) frame = requestFrame(tick);
    };
    frame = requestFrame(tick);
    return () => cancelFrame(frame);
  }, [presentationDurationMs, presentationKey, presentationPhase]);

  const rememberRuntimeNodePosition = useCallback((node: RuntimeKnowledgeGraphNode) => {
    if (!Number.isFinite(node.x) || !Number.isFinite(node.y)) return;
    runtimePositionsByNodeIdRef.current.set(node.id, {
      x: node.x,
      y: node.y,
      ...(Number.isFinite(node.z) ? { z: node.z } : {}),
      ...(Number.isFinite(node.vx) ? { vx: node.vx } : {}),
      ...(Number.isFinite(node.vy) ? { vy: node.vy } : {}),
      ...(Number.isFinite(node.vz) ? { vz: node.vz } : {}),
      ...(Number.isFinite(node.fx) ? { fx: node.fx } : {}),
      ...(Number.isFinite(node.fy) ? { fy: node.fy } : {}),
      ...(Number.isFinite(node.fz) ? { fz: node.fz } : {}),
      ...(node.__knowledgeAutomaticAnchor
        ? { __knowledgeAutomaticAnchor: node.__knowledgeAutomaticAnchor }
        : {}),
    });
  }, []);

  const layoutSignature = `${graphVersion ?? 'pending'}:${relayoutVersion}:${graphData.nodes.map((node) => node.id).join('|')}`;
  const snapshotRuntimePositions = useCallback(() => {
    const graphNodes = (fgRef.current?.graphData?.()?.nodes ?? graphData.nodes) as RuntimeKnowledgeGraphNode[];
    graphNodes.forEach(rememberRuntimeNodePosition);
  }, [graphData.nodes, rememberRuntimeNodePosition]);
  const handleEngineStop = useCallback(() => {
    snapshotRuntimePositions();
    if (settledLayoutSignatureRef.current === layoutSignature) return;
    settledLayoutSignatureRef.current = layoutSignature;
    setLayoutSettledRevision((revision) => revision + 1);
  }, [layoutSignature, snapshotRuntimePositions]);

  useEffect(() => {
    const qaWindow = window as Window & {
      __knowledgeGraphQaNodePoints?: (nodeId?: string) => Array<{ x: number; y: number }>;
      __knowledgeGraphQaNodeDebug?: (nodeId?: string) => Array<Record<string, number | string | null>>;
      __knowledgeGraphQaPresentationDebug?: () => Record<string, unknown>;
      __knowledgeGraphQaResetViewport?: () => void;
      __knowledgeGraphQaCenterNode?: (nodeId: string) => void;
      __knowledgeGraphProductQaSelectedNodeDragPoints?: () => Array<{ x: number; y: number }>;
    };
    const qaMode = new URLSearchParams(window.location.search).get('qa');
    const qaEnabled = qaMode === 'knowledge-product' || qaMode === 'issue-894-direct-activation';
    if (!qaEnabled) {
      delete qaWindow.__knowledgeGraphQaNodePoints;
      delete qaWindow.__knowledgeGraphQaNodeDebug;
      delete qaWindow.__knowledgeGraphQaPresentationDebug;
      delete qaWindow.__knowledgeGraphQaResetViewport;
      delete qaWindow.__knowledgeGraphQaCenterNode;
      delete qaWindow.__knowledgeGraphProductQaSelectedNodeDragPoints;
      return;
    }
    const getNodePoints = (requestedNodeId = selectedNode?.id) => {
      if (!requestedNodeId || !fgRef.current?.graph2ScreenCoords) return [];
      const graphNodes = [
        ...((fgRef.current.graphData?.()?.nodes ?? []) as Array<KnowledgeNodeData & { x?: number; y?: number }>),
        ...(graphData.nodes as Array<KnowledgeNodeData & { x?: number; y?: number }>),
      ];
      const canvas = document.querySelector<HTMLCanvasElement>('[data-knowledge-canvas-primary="true"] canvas');
      const rect = canvas?.getBoundingClientRect();
      const candidates: Array<{ x: number; y: number }> = [];
      for (const graphNode of graphNodes) {
        if (graphNode.id !== requestedNodeId) continue;
        const graphX = Number(graphNode.x);
        const graphY = Number(graphNode.y);
        if (!Number.isFinite(graphX) || !Number.isFinite(graphY)) continue;
        const screen = fgRef.current.graph2ScreenCoords(graphX, graphY);
        const screenX = Number(screen?.x);
        const screenY = Number(screen?.y);
        if (!Number.isFinite(screenX) || !Number.isFinite(screenY)) continue;
        if (!rect) continue;
        candidates.push({ x: rect.left + screenX, y: rect.top + screenY });
      }
      return candidates.flatMap((point) => [
        point,
        { x: point.x - 8, y: point.y },
        { x: point.x + 8, y: point.y },
        { x: point.x, y: point.y - 8 },
        { x: point.x, y: point.y + 8 },
      ]).filter((point, index, points) => (
        index === points.findIndex((candidate) =>
          Math.round(candidate.x) === Math.round(point.x)
          && Math.round(candidate.y) === Math.round(point.y)
        )
      ));
    };
    qaWindow.__knowledgeGraphQaNodePoints = getNodePoints;
    qaWindow.__knowledgeGraphQaResetViewport = () => {
      fgRef.current?.zoom?.(1, 0);
      fgRef.current?.centerAt?.(0, 0, 0);
    };
    qaWindow.__knowledgeGraphQaCenterNode = (nodeId: string) => {
      const node = (fgRef.current?.graphData?.()?.nodes ?? graphData.nodes)
        .find((candidate: KnowledgeNodeData & { x?: number; y?: number }) => candidate.id === nodeId) as
        | (KnowledgeNodeData & { x?: number; y?: number })
        | undefined;
      const x = Number(node?.x ?? node?.positionX);
      const y = Number(node?.y ?? node?.positionY);
      if (![x, y].every(Number.isFinite)) return;
      fgRef.current?.zoom?.(1, 0);
      fgRef.current?.centerAt?.(x, y, 0);
    };
    qaWindow.__knowledgeGraphQaNodeDebug = (requestedNodeId = selectedNode?.id) => {
      const graphNodes = [
        ...((fgRef.current?.graphData?.()?.nodes ?? []) as Array<KnowledgeNodeData & { x?: number; y?: number }>),
        ...(graphData.nodes as Array<KnowledgeNodeData & { x?: number; y?: number }>),
      ];
      return graphNodes
        .filter((node) => node.id === requestedNodeId)
        .map((node) => {
          const point = fgRef.current?.graph2ScreenCoords && Number.isFinite(node.x) && Number.isFinite(node.y)
            ? fgRef.current.graph2ScreenCoords(node.x!, node.y!)
            : null;
          return {
            id: node.id,
            x: Number.isFinite(node.x) ? node.x! : null,
            y: Number.isFinite(node.y) ? node.y! : null,
            screenX: Number.isFinite(Number(point?.x)) ? Number(point?.x) : null,
            screenY: Number.isFinite(Number(point?.y)) ? Number(point?.y) : null,
          };
        });
    };
    qaWindow.__knowledgeGraphQaPresentationDebug = () => ({
      phase: presentation.phase,
      elapsedMs: presentation.elapsedMs ?? 0,
      animatedNodeIds: presentation.animatedNodeIds ?? [],
      animatedRelationIds: presentation.animatedRelationIds ?? [],
      expandedNodeIds,
      materializedNodeIds,
      graphNodes: (graphData.nodes as Array<KnowledgeNodeData & { __knowledgeAutomaticAnchor?: unknown }>).map((node) => ({
        id: node.id,
        anchor: node.__knowledgeAutomaticAnchor ?? null,
      })),
      edges: graphData.links.map((link: any) => ({
        id: getKnowledgeGraphPresentationLinkKey(link),
        curvature: laneCurvatureByLinkKey.get(getKnowledgeGraphPresentationLinkKey(link)) ?? 0,
        targetArrow: getKnowledgeGraphEdgePresentation(link).directed,
      })),
    });
    qaWindow.__knowledgeGraphProductQaSelectedNodeDragPoints = () => getNodePoints();
    return () => {
      delete qaWindow.__knowledgeGraphQaNodePoints;
      delete qaWindow.__knowledgeGraphQaNodeDebug;
      delete qaWindow.__knowledgeGraphQaPresentationDebug;
      delete qaWindow.__knowledgeGraphQaResetViewport;
      delete qaWindow.__knowledgeGraphQaCenterNode;
      delete qaWindow.__knowledgeGraphProductQaSelectedNodeDragPoints;
    };
  }, [
    expandedNodeIds,
    graphData,
    laneCurvatureByLinkKey,
    materializedNodeIds,
    presentation.animatedNodeIds,
    presentation.animatedRelationIds,
    presentation.elapsedMs,
    presentation.phase,
    selectedNode?.id,
  ]);

  // 2. 自定义节点渲染
  const getFrameLabelPlacements = useCallback((globalScale: number) => {
    const projector = fgRef.current?.graph2ScreenCoords as ((x: number, y: number) => { x: number; y: number }) | undefined;
    const anchorNode = graphData.nodes[0] as any;
    const anchor = projector && anchorNode
      ? projector(anchorNode.x ?? 0, anchorNode.y ?? 0)
      : { x: Number.NaN, y: Number.NaN };
    const currentWidth = width ?? 800;
    const currentHeight = height ?? 600;
    const cached = labelPlacementCacheRef.current;
    if (cached
      && cached.nodes === graphData.nodes
      && cached.scale === globalScale
      && Object.is(cached.anchorX, anchor.x)
      && Object.is(cached.anchorY, anchor.y)
      && cached.selectedNodeId === selectedNode?.id
      && cached.hoveredNodeId === hoveredNode?.id
      && cached.labelMode === labelMode
      && cached.width === currentWidth
      && cached.height === currentHeight
      && cached.revision === labelProjectionRevisionRef.current) return cached.placements;
    const placements = placeKnowledgeGraphLabels({
      nodes: graphData.nodes.map((candidate: any) => {
        const screen = projector ? projector(candidate.x ?? 0, candidate.y ?? 0) : null;
        const rootPacking = candidate.__knowledgeRootPacking;
        const bodyRadius = rootPacking?.collisionRadius
          ?? getKnowledgeNodeMaximumPresentationRadius(candidate);
        return {
          id: candidate.id, x: candidate.x ?? 0, y: candidate.y ?? 0,
          ...(screen ? { screenX: screen.x, screenY: screen.y } : {}),
          projectedScale: globalScale,
          bodyRadius,
          isRootBubble: Boolean(rootPacking),
          isKeyNode: candidate.labelPriority,
          importance: candidate.importance,
          labelBounds: rootPacking?.labelBounds ?? getKnowledgeNodeLabelBounds({
            name: candidate.name, bodyRadius,
          }),
        };
      }),
      scale: globalScale, labelMode,
      width: currentWidth, height: currentHeight,
      padding: getKnowledgeGraphViewportSafeInsets({ width: currentWidth, height: currentHeight }),
      enforceViewport: Boolean(projector),
      selectedNodeId: selectedNode?.id, hoveredNodeId: hoveredNode?.id,
    });
    labelPlacementCacheRef.current = {
      nodes: graphData.nodes, scale: globalScale, anchorX: anchor.x, anchorY: anchor.y,
      selectedNodeId: selectedNode?.id, hoveredNodeId: hoveredNode?.id, labelMode,
      width: currentWidth, height: currentHeight, placements,
      revision: labelProjectionRevisionRef.current,
    };
    return placements;
  }, [graphData.nodes, height, hoveredNode?.id, labelMode, selectedNode?.id, width]);

  const paintNode = useCallback((node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
    ctx.save();
    ctx.globalAlpha *= getKnowledgeGraphPresentationNodeOpacity({ ...presentation, nodeId: node.id })
      * getKnowledgeGraphNodeEmphasisOpacity(node.id, selectedCorridorEmphasis);
    // 获取颜色配置
    const fillColor = getNodeColor(node.knowledgeDim);
    const glowColor = getGlowColor(node.bloomLevel);

    // 高亮状态
    const isSelected = selectedNode?.id === node.id;
    const isHovered = hoveredNode?.id === node.id;
    const isActive = isSelected || isHovered
      || Boolean(selectedCorridorEmphasis?.nodeIds.includes(node.id));

    // 节点尺寸：显式教学重要性优先，连接度只作为封顶的辅助信号，覆盖度为第三级封顶信号。
    const nodeScale = getKnowledgeNodeScale({
      metadata: node.metadata,
      degree: node.graphDegree,
      focused: isActive,
      importanceScore: node.graphImportanceScore,
      sourceCoverageCount: node.sourceCoverageCount,
    });
    const nodeShape = getKnowledgeConceptNodeShape(node);
    const presentationScale = getKnowledgeGraphPresentationNodeScale({ ...presentation, nodeId: node.id });
    const rootPacking = node.__knowledgeRootPacking;
    const isRootBubble = Boolean(rootPacking);
    const baseRadius = (rootPacking?.collisionRadius ?? nodeScale.radius) * presentationScale;
    const glowRadius = nodeScale.glowRadius * presentationScale;
    const semanticRegionStyle = getKnowledgeSemanticRegionStyle(node, isLightTheme);

    if (!isRootBubble && semanticRegionStyle.enabled) {
      const regionRadius = Math.min(
        semanticRegionStyle.maxRadius,
        baseRadius * semanticRegionStyle.radiusMultiplier
      );
      ctx.save();
      ctx.beginPath();
      ctx.arc(node.x, node.y, regionRadius, 0, 2 * Math.PI);
      ctx.fillStyle = hexToRgba(semanticRegionStyle.fillColor, semanticRegionStyle.fillOpacity);
      ctx.strokeStyle = hexToRgba(semanticRegionStyle.strokeColor, semanticRegionStyle.strokeOpacity);
      ctx.lineWidth = 1.2 / globalScale;
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    // 绘制辉光（如果有 bloomLevel）
    if (isRootBubble) {
      // 入场错峰淡入：只作用于光晕/本体/轮缘，标签契约不受影响。
      const entranceAlpha = reducedMotion || rootEntranceStartMsRef.current === null
        ? 1
        : getKnowledgeGraphEntranceFade(
          performance.now() - rootEntranceStartMsRef.current,
          rootEntranceDelayByNodeId.get(node.id) ?? 0,
          KNOWLEDGE_ROOT_BUBBLE_VITALITY.entrance.fadeDurationMs
        );
      ctx.save();
      ctx.globalAlpha *= entranceAlpha;
      // 外晕 halo：激活或悬停时按呼吸波脉冲，否则静态弱光。
      const halo = KNOWLEDGE_ROOT_BUBBLE_VITALITY.halo;
      const haloAlpha = isActive && !reducedMotion
        ? halo.alphaMin + (halo.alphaMax - halo.alphaMin)
          * getKnowledgeGraphBreathingIntensity(motionElapsedMsRef.current, KNOWLEDGE_ROOT_BUBBLE_VITALITY.breathing)
        : halo.alphaMin;
      const haloRadius = baseRadius * halo.radiusGain;
      const haloGradient = ctx.createRadialGradient(node.x, node.y, baseRadius * 0.72, node.x, node.y, haloRadius);
      haloGradient.addColorStop(0, hexToRgba(halo.color, haloAlpha));
      haloGradient.addColorStop(1, hexToRgba(halo.color, 0));
      ctx.beginPath();
      ctx.arc(node.x, node.y, haloRadius, 0, 2 * Math.PI);
      ctx.fillStyle = haloGradient;
      ctx.fill();
      ctx.shadowColor = hexToRgba(KNOWLEDGE_ROOT_BUBBLE_STYLE.glow, isActive ? 0.42 : 0.24);
      ctx.shadowBlur = (isActive ? 18 : 12) / Math.max(0.0001, globalScale);
      const gradient = ctx.createRadialGradient(
        node.x - baseRadius * 0.34,
        node.y - baseRadius * 0.38,
        baseRadius * 0.08,
        node.x,
        node.y,
        baseRadius,
      );
      gradient.addColorStop(0, hexToRgba(KNOWLEDGE_ROOT_BUBBLE_STYLE.highlight, 0.92));
      gradient.addColorStop(0.24, hexToRgba(KNOWLEDGE_ROOT_BUBBLE_STYLE.surface, 0.98));
      gradient.addColorStop(1, hexToRgba(KNOWLEDGE_ROOT_BUBBLE_STYLE.surfaceDepth, 1));
      ctx.beginPath();
      ctx.arc(node.x, node.y, baseRadius, 0, 2 * Math.PI);
      ctx.fillStyle = gradient;
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = hexToRgba(KNOWLEDGE_ROOT_BUBBLE_STYLE.rim, isActive ? 0.96 : 0.78);
      ctx.lineWidth = (isActive ? 2.2 : 1.4) / Math.max(0.0001, globalScale);
      ctx.stroke();
      // 轮缘光弧：静态区分激活态，呼吸关闭时仍保持层次。
      const rimArc = KNOWLEDGE_ROOT_BUBBLE_VITALITY.rimArc;
      ctx.beginPath();
      ctx.arc(node.x, node.y, baseRadius * rimArc.radiusGain, rimArc.startAngle, rimArc.endAngle);
      ctx.strokeStyle = hexToRgba(rimArc.color, isActive ? rimArc.activeAlpha : rimArc.inactiveAlpha);
      ctx.lineWidth = (isActive ? 1.8 : 1.1) / Math.max(0.0001, globalScale);
      ctx.stroke();
      ctx.restore();
    } else if (glowColor) {
      ctx.fillStyle = hexToRgba(glowColor, isActive ? 0.34 : 0.18);
      drawShape(ctx, nodeShape, node.x, node.y, glowRadius);
    }

    // 绘制节点核心
    if (!isRootBubble) {
      ctx.fillStyle = hexToRgba(fillColor, 1);
      drawShape(ctx, nodeShape, node.x, node.y, baseRadius);
    }

    // 候选节点：虚线轮廓与候选徽标，绝不被误认为已审知识
    if (!isRootBubble && node.candidate === true) {
      ctx.save();
      ctx.strokeStyle = hexToRgba(KNOWLEDGE_GRAPH_CANDIDATE_PRESENTATION.color, 0.95);
      ctx.lineWidth = 1.6 / Math.max(0.0001, globalScale);
      ctx.setLineDash([4 / globalScale, 3 / globalScale]);
      ctx.beginPath();
      traceNodeShapeOutline(ctx, nodeShape, node.x, node.y, baseRadius + 3 / globalScale);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.font = `600 ${10 / Math.max(0.0001, globalScale)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = isLightTheme ? 'rgba(255, 255, 255, 0.95)' : 'rgba(2, 8, 23, 0.85)';
      ctx.lineWidth = 2.4 / Math.max(0.0001, globalScale);
      const badgeX = node.x;
      const badgeY = node.y - baseRadius - 4 / Math.max(0.0001, globalScale);
      ctx.strokeText(KNOWLEDGE_GRAPH_CANDIDATE_PRESENTATION.label, badgeX, badgeY);
      ctx.fillStyle = hexToRgba(KNOWLEDGE_GRAPH_CANDIDATE_PRESENTATION.color, 1);
      ctx.fillText(KNOWLEDGE_GRAPH_CANDIDATE_PRESENTATION.label, badgeX, badgeY);
      ctx.restore();
    }

    // 绘制选中环
    if (isSelected) {
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2 / globalScale;
      ctx.beginPath();
      traceNodeShapeOutline(ctx, isRootBubble ? 'circle' : nodeShape, node.x, node.y, baseRadius + 4);
      ctx.stroke();
    }

    const decoration = readActiveNodeDecoration(node.metadata);
    if (!isRootBubble && decoration) {
      paintActiveNodeDecorations2d(ctx, {
        x: node.x,
        y: node.y,
        radius: baseRadius,
        globalScale,
        decoration,
      });
    }

    const labelPresentation = getFrameLabelPlacements(globalScale).get(node.id)!;
    if (!labelPresentation.visible || node.richTitle) {
      ctx.restore();
      return;
    }

    const labelPaint = isRootBubble
      ? getKnowledgeRootLabelPaintModel(node.name)
      : getKnowledgeNodeLabelPaintModel(node.name);
    ctx.translate(
      node.x + (isRootBubble ? 0 : labelPresentation.offsetX / globalScale),
      node.y + (isRootBubble ? 0 : labelPresentation.offsetY / globalScale)
    );
    ctx.scale(labelPresentation.scale, labelPresentation.scale);
    ctx.font = labelPaint.font;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    // Canvas cannot resolve CSS custom properties; use explicit theme colors for root text.
    const labelFillColor = isRootBubble
      ? (isLightTheme ? '#07111f' : '#f8fafc')
      : isLightTheme
      ? (isActive ? '#0f172a' : 'rgba(15, 23, 42, 0.9)')
      : (isActive ? '#ffffff' : 'rgba(255, 255, 255, 0.85)');
    const labelStrokeColor = isRootBubble
      ? (isLightTheme ? 'rgba(255, 255, 255, 0.92)' : 'rgba(3, 12, 28, 0.9)')
      : isLightTheme
      ? 'rgba(255, 255, 255, 0.95)'
      : 'rgba(2, 8, 23, 0.82)';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = labelStrokeColor;
    ctx.lineWidth = isActive ? 3.1 : 2.4;
    ctx.fillStyle = labelFillColor;
    labelPaint.lines.forEach((line) => {
      ctx.strokeText(line.text, 0, line.y);
      ctx.fillText(line.text, 0, line.y);
    });
    ctx.restore();
  }, [selectedNode, hoveredNode, isLightTheme, presentation, getFrameLabelPlacements, reducedMotion, rootEntranceDelayByNodeId, selectedCorridorEmphasis]);

  const paintNodePointerArea = useCallback((node: any, color: string, ctx: CanvasRenderingContext2D, globalScale: number) => {
    const nodeScale = getKnowledgeNodeScale({
      metadata: node.metadata,
      degree: node.graphDegree,
      focused: selectedNode?.id === node.id || hoveredNode?.id === node.id,
      importanceScore: node.graphImportanceScore,
      sourceCoverageCount: node.sourceCoverageCount,
    });
    const presentationScale = getKnowledgeGraphPresentationNodeScale({ ...presentation, nodeId: node.id });
    ctx.fillStyle = color;
    drawNodePointerShape(
      ctx,
      node.__knowledgeRootPacking ? 'circle' : getKnowledgeConceptNodeShape(node),
      node.x,
      node.y,
      (node.__knowledgeRootPacking?.collisionRadius ?? nodeScale.radius) * presentationScale,
      8 / Math.max(0.0001, globalScale),
    );
  }, [hoveredNode?.id, presentation, selectedNode?.id]);

  // 3. 自定义连线渲染
  const paintLink = useCallback((link: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
    const source = link.source;
    const target = link.target;

    // 确保 source 和 target 是已解析的节点对象（带有坐标）
    if (typeof source !== 'object' || typeof target !== 'object') return;
    if (source.x === undefined || source.y === undefined) return;
    if (target.x === undefined || target.y === undefined) return;

    const { style, directed } = getKnowledgeGraphEdgePresentation(link);
    const strokeColor = isLightTheme ? style.lightColor : style.darkColor;
    const strength = typeof link.strength === 'number'
      ? Math.min(1, Math.max(0, link.strength))
      : 1;
    const focusState = hoveredNode?.id
      ? (source.id === hoveredNode.id || target.id === hoveredNode.id ? 'active' : 'dimmed')
      : getKnowledgeGraphEdgeEmphasisState({
        link,
        emphasis: selectedCorridorEmphasis,
        structuralForegroundEdgeIds: structuralForegroundEdgeIdSet,
      });
    const renderModulation = getKnowledgeGraphEdgeRenderModulation({
      candidate: source.candidate === true || target.candidate === true,
      evidenceState: link.evidenceState,
    });
    const alpha = getKnowledgeGraphEffectiveEdgeOpacity(style, strength, focusState)
      * renderModulation.opacityFactor
      * getKnowledgeGraphPresentationLinkOpacity({
        ...presentation,
        sourceId: source.id,
        targetId: target.id,
      });
    const linkProgress = getKnowledgeGraphPresentationLinkProgress({
      ...presentation,
      sourceId: source.id,
      targetId: target.id,
    });
    if (linkProgress <= 0) return;
    const lineWidth = getKnowledgeGraphEffectiveEdgeWidth(style, strength, focusState, '2d')
      * renderModulation.widthFactor;

    const getPresentationRadius = (node: any) => (
      node.__knowledgeRootPacking?.collisionRadius ?? getKnowledgeNodeScale({
        metadata: node.metadata,
        degree: node.graphDegree,
        focused: selectedCorridorEmphasis?.nodeIds.includes(node.id)
          || selectedNode?.id === node.id
          || hoveredNode?.id === node.id,
        importanceScore: node.graphImportanceScore,
        sourceCoverageCount: node.sourceCoverageCount,
      }).radius
    ) * getKnowledgeGraphPresentationNodeScale({ ...presentation, nodeId: node.id });
    const fullPath = createKnowledgeGraphRendererEdgePath({
      renderer: '2d',
      link,
      source,
      target,
      sourceNodeType: source.nodeType,
      targetNodeType: target.nodeType,
      sourceShape: getKnowledgeConceptNodeShape(source),
      targetShape: getKnowledgeConceptNodeShape(target),
      sourcePresentationRadius: getPresentationRadius(source),
      targetPresentationRadius: getPresentationRadius(target),
      laneCurvature: laneCurvatureByLinkKey.get(getKnowledgeGraphPresentationLinkKey(link)) ?? 0,
    });
    if (fullPath.hiddenReason) return;
    const drawPath = getKnowledgeGraphPartialEdgePath(fullPath, linkProgress);

    ctx.beginPath();
    ctx.moveTo(drawPath.start.x, drawPath.start.y);
    if (drawPath.kind === 'quadratic') {
      ctx.quadraticCurveTo(drawPath.control.x, drawPath.control.y, drawPath.end.x, drawPath.end.y);
    } else {
      ctx.lineTo(drawPath.end.x, drawPath.end.y);
    }

    ctx.strokeStyle = hexToRgba(strokeColor, alpha);
    ctx.setLineDash(style.dash.map(d => d / globalScale));
    ctx.lineWidth = lineWidth / globalScale;
    ctx.stroke();

    if (directed && linkProgress >= 0.999) {
      const arrow = getKnowledgeGraphEndpointArrow(fullPath, {
        length: 8 / globalScale,
        halfWidth: 4 / globalScale,
      });
      ctx.fillStyle = hexToRgba(strokeColor, alpha);
      ctx.beginPath();
      ctx.moveTo(arrow.tip.x, arrow.tip.y);
      ctx.lineTo(arrow.left.x, arrow.left.y);
      ctx.lineTo(arrow.right.x, arrow.right.y);
      ctx.closePath();
      ctx.fill();
    }

    const linkKey = getKnowledgeGraphPresentationLinkKey(link);
    const motionEdgeEligible = motionMarkerEdgeIdSet.has(linkKey)
      || (typeof link.id === 'string' && motionMarkerEdgeIdSet.has(link.id));
    // 环境流层：走廊之外的可见结构前景边渲染弱化的族色方向标记（先于走廊绘制，
    // 与 3D 同口径排除已选走廊边，避免同边双标记）。
    const ambientEdgeEligible = !motionEdgeEligible
      && ambientFlowEdgeIdSet.has(linkKey)
      && linkProgress >= 0.999
      && motionEnvironmentActive
      && !reducedMotion;
    if (ambientEdgeEligible) {
      const markerFrame = getKnowledgeGraphMotionPhasedMarkerFrame(
        motionElapsedMsRef.current,
        ambientFlowSelection.phaseOffsetByEdgeId[linkKey] ?? 0
      );
      if (markerFrame.visible) {
        const marker = getKnowledgeGraphMotionMarkerPlacement(fullPath, markerFrame.progress, KNOWLEDGE_GRAPH_FLOW_MARKER_GEOMETRY);
        if (marker.visible) {
          ctx.save();
          ctx.translate(marker.point.x, marker.point.y);
          ctx.rotate(Math.atan2(marker.tangent.y, marker.tangent.x));
          ctx.fillStyle = hexToRgba(strokeColor, alpha * 0.82);
          ctx.beginPath();
          ctx.moveTo(KNOWLEDGE_GRAPH_FLOW_MARKER_GEOMETRY.frontExtent, 0);
          ctx.lineTo(-KNOWLEDGE_GRAPH_FLOW_MARKER_GEOMETRY.backExtent, KNOWLEDGE_GRAPH_FLOW_MARKER_GEOMETRY.halfWidth);
          ctx.lineTo(-KNOWLEDGE_GRAPH_FLOW_MARKER_GEOMETRY.backExtent, -KNOWLEDGE_GRAPH_FLOW_MARKER_GEOMETRY.halfWidth);
          ctx.closePath();
          ctx.fill();
          ctx.restore();
        }
      }
    }

    if (motionEdgeEligible && linkProgress >= 0.999 && motionEnvironmentActive && !reducedMotion) {
      const markerFrame = getKnowledgeGraphMotionMarkerFrame(motionElapsedMsRef.current);
      if (markerFrame.visible) {
        const marker = getKnowledgeGraphMotionMarkerPlacement(fullPath, markerFrame.progress);
        if (marker.visible) {
          ctx.save();
          ctx.translate(marker.point.x, marker.point.y);
          ctx.rotate(Math.atan2(marker.tangent.y, marker.tangent.x));
          ctx.fillStyle = hexToRgba(strokeColor, Math.max(alpha, 0.82));
          ctx.beginPath();
          ctx.moveTo(KNOWLEDGE_GRAPH_CORRIDOR_MARKER_GEOMETRY.frontExtent, 0);
          ctx.lineTo(-KNOWLEDGE_GRAPH_CORRIDOR_MARKER_GEOMETRY.backExtent, KNOWLEDGE_GRAPH_CORRIDOR_MARKER_GEOMETRY.halfWidth);
          ctx.lineTo(-KNOWLEDGE_GRAPH_CORRIDOR_MARKER_GEOMETRY.backExtent, -KNOWLEDGE_GRAPH_CORRIDOR_MARKER_GEOMETRY.halfWidth);
          ctx.closePath();
          ctx.fill();
          ctx.restore();
        }
      }
    }

    // 重置虚线设置
    ctx.setLineDash([]);
  }, [ambientFlowEdgeIdSet, ambientFlowSelection.phaseOffsetByEdgeId, hoveredNode?.id, isLightTheme, laneCurvatureByLinkKey, motionEnvironmentActive, motionMarkerEdgeIdSet, presentation, reducedMotion, selectedCorridorEmphasis, selectedNode?.id, structuralForegroundEdgeIdSet]);

  const handleNodeDragEnd = useCallback((node: any) => {
    labelProjectionRevisionRef.current += 1;
    rememberRuntimeNodePosition(node as RuntimeKnowledgeGraphNode);
    onNodeDragEnd(node as KnowledgeNodeData);
  }, [onNodeDragEnd, rememberRuntimeNodePosition]);

  const handleNodeDrag = useCallback((node: any) => {
    labelProjectionRevisionRef.current += 1;
    const graphNodes = (fgRef.current?.graphData?.()?.nodes ?? graphData.nodes) as RuntimeKnowledgeGraphNode[];
    freezeKnowledgeGraphDragFrame(graphNodes, node as RuntimeKnowledgeGraphNode);
  }, [graphData.nodes]);

  const syncRichLabelLayer = useCallback((projectedScale?: number) => {
    labelProjectionRevisionRef.current += 1;
    const layer = rootRef.current?.querySelector('[data-knowledge-2d-dom-label-layer="true"]');
    const projector = fgRef.current?.graph2ScreenCoords as ((x: number, y: number) => { x: number; y: number }) | undefined;
    if (!layer || !projector) return;
    const richNodes = (graphData.nodes as Array<KnowledgeNodeData & { x?: number; y?: number }>)
      .filter((node) => node.richTitle);
    if (richNodes.length === 0) return;
    const scale = Number(projectedScale ?? fgRef.current?.zoom?.() ?? 1);
    const placements = getFrameLabelPlacements(scale);
    for (const node of richNodes) {
      const element = layer.querySelector<HTMLElement>(`[data-semantic-label-id="${CSS.escape(node.id)}"]`);
      if (!element) continue;
      const placement = placements.get(node.id);
      const point = Number.isFinite(node.x) && Number.isFinite(node.y)
        ? projector(node.x!, node.y!)
        : null;
      const visible = Boolean(placement?.visible && point && Number.isFinite(point.x) && Number.isFinite(point.y));
      element.hidden = !visible;
      if (!visible || !placement || !point) continue;
      const layout = layoutKnowledgeNodeLabel(node.name);
      element.style.left = `${point.x + placement.offsetX}px`;
      element.style.top = `${point.y + placement.offsetY}px`;
      element.style.width = `${layout.width * placement.fontSize / KNOWLEDGE_NODE_LABEL_POLICY.fontSize}px`;
      element.style.minHeight = `${layout.height * placement.fontSize / KNOWLEDGE_NODE_LABEL_POLICY.fontSize}px`;
      element.style.fontSize = `${placement.fontSize}px`;
    }
  }, [getFrameLabelPlacements, graphData.nodes]);
  syncRichLabelLayerRef.current = syncRichLabelLayer;

  const handleEngineTick = useCallback(() => {
    syncRichLabelLayer();
  }, [syncRichLabelLayer]);

  useEffect(() => {
    if (!(graphData.nodes as KnowledgeNodeData[]).some((node) => node.richTitle)) return;
    if (labelRefreshTimerRef.current !== null) window.clearTimeout(labelRefreshTimerRef.current);
    labelRefreshTimerRef.current = window.setTimeout(() => {
      syncRichLabelLayerRef.current();
      labelRefreshTimerRef.current = null;
    }, 400);
    return () => {
      if (labelRefreshTimerRef.current !== null) window.clearTimeout(labelRefreshTimerRef.current);
      labelRefreshTimerRef.current = null;
    };
  }, [graphData.nodes, height, hoveredNode?.id, labelMode, selectedNode?.id, width]);

  const handleCanvasPointerDown = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const canvas = event.currentTarget.querySelector<HTMLCanvasElement>('canvas');
    completedBlankGestureRef.current = null;
    if (!activeCanvasPointerIdsRef.current.has(event.pointerId)) {
      if (activeCanvasPointerIdsRef.current.size > 0) {
        blankGesturesByPointerIdRef.current.clear();
      }
      activeCanvasPointerIdsRef.current.add(event.pointerId);
    }
    if (event.target !== canvas) return;
    const rect = canvas?.getBoundingClientRect();
    const graph2ScreenCoords = fgRef.current?.graph2ScreenCoords;
    const screen2GraphCoords = fgRef.current?.screen2GraphCoords;
    if (!rect || !graph2ScreenCoords || !screen2GraphCoords) return;
    const localX = event.clientX - rect.left;
    const localY = event.clientY - rect.top;
    const graphPoint = screen2GraphCoords(localX, localY);
    if (![graphPoint?.x, graphPoint?.y].every(Number.isFinite)) return;
    const tolerancePoints = [
      screen2GraphCoords(localX + 8, localY),
      screen2GraphCoords(localX, localY + 8),
    ];
    const graphTolerances = tolerancePoints.map((point: { x: number; y: number }) => (
      Math.hypot(Number(point.x) - Number(graphPoint.x), Number(point.y) - Number(graphPoint.y))
    )).filter((value: number) => Number.isFinite(value) && value >= 0);
    if (graphTolerances.length === 0) return;
    const graphTolerance = Math.max(...graphTolerances);
    const graphNodes = (fgRef.current?.graphData?.()?.nodes ?? graphData.nodes) as RuntimeKnowledgeGraphNode[];
    const graphNodeById = new Map(graphNodes.map((node) => [node.id, node]));
    const hitNode = graphNodes.some((node) => {
      if (!Number.isFinite(node.x) || !Number.isFinite(node.y)) return false;
      const nodeX = Number(node.x);
      const nodeY = Number(node.y);
      const nodeScale = getKnowledgeNodeScale({
        metadata: node.metadata,
        degree: node.graphDegree,
        focused: selectedNode?.id === node.id || hoveredNode?.id === node.id,
        importanceScore: node.graphImportanceScore,
        sourceCoverageCount: node.sourceCoverageCount,
      });
      const presentationScale = getKnowledgeGraphPresentationNodeScale({ ...presentation, nodeId: node.id });
      return isKnowledgeGraphPointInsideNodeBoundary(
        graphPoint,
        { x: nodeX, y: nodeY },
        getNodePointerBoundary(getKnowledgeConceptNodeShape(node), nodeScale.radius * presentationScale),
        graphTolerance,
      );
    });
    const hitLink = !hitNode && graphData.links.some((link: any) => {
      const source = typeof link.source === 'object' ? link.source : graphNodeById.get(link.sourceId);
      const target = typeof link.target === 'object' ? link.target : graphNodeById.get(link.targetId);
      if (!source || !target || !Number.isFinite(source.x) || !Number.isFinite(source.y)
        || !Number.isFinite(target.x) || !Number.isFinite(target.y)) return false;
      const getRadius = (node: RuntimeKnowledgeGraphNode) => getKnowledgeNodeScale({
        metadata: node.metadata,
        degree: node.graphDegree,
        focused: selectedCorridorEmphasis?.nodeIds.includes(node.id)
          || selectedNode?.id === node.id
          || hoveredNode?.id === node.id,
        importanceScore: node.graphImportanceScore,
        sourceCoverageCount: node.sourceCoverageCount,
      }).radius * getKnowledgeGraphPresentationNodeScale({ ...presentation, nodeId: node.id });
      const path = createKnowledgeGraphRendererEdgePath({
        renderer: '2d',
        link,
        source,
        target,
        sourceNodeType: source.nodeType,
        targetNodeType: target.nodeType,
        sourceShape: getKnowledgeConceptNodeShape(source),
        targetShape: getKnowledgeConceptNodeShape(target),
        sourcePresentationRadius: getRadius(source),
        targetPresentationRadius: getRadius(target),
        laneCurvature: laneCurvatureByLinkKey.get(getKnowledgeGraphPresentationLinkKey(link)) ?? 0,
      });
      if (path.hiddenReason) return false;
      const points = sampleKnowledgeGraphEdgePath(path, 12).map((point) => {
        const screenPoint = graph2ScreenCoords(point.x, point.y);
        return { x: Number(screenPoint?.x), y: Number(screenPoint?.y) };
      });
      if (!points.every((point) => Number.isFinite(point.x) && Number.isFinite(point.y))) return false;
      return isKnowledgeCanvasPolylineHit({ x: localX, y: localY, points, tolerance: 8 });
    });
    if (!hitNode && !hitLink) {
      if (activeCanvasPointerIdsRef.current.size === 1) {
        blankGesturesByPointerIdRef.current.set(
          event.pointerId,
          startKnowledgeCanvasBlankGesture(event)
        );
      }
    }
  }, [graphData.links, graphData.nodes, hoveredNode?.id, laneCurvatureByLinkKey, presentation, selectedCorridorEmphasis, selectedNode?.id]);

  const handleCanvasPointerMove = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const gesture = blankGesturesByPointerIdRef.current.get(event.pointerId) ?? null;
    const moved = moveKnowledgeCanvasBlankGesture(gesture, event);
    if (moved) blankGesturesByPointerIdRef.current.set(event.pointerId, moved);
  }, []);

  const handleCanvasPointerCancel = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (!activeCanvasPointerIdsRef.current.delete(event.pointerId)) return;
    blankGesturesByPointerIdRef.current.delete(event.pointerId);
  }, []);

  const handleCanvasLostPointerCapture = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    activeCanvasPointerIdsRef.current.delete(event.pointerId);
    blankGesturesByPointerIdRef.current.delete(event.pointerId);
  }, []);

  const handleCanvasPointerUp = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (!activeCanvasPointerIdsRef.current.delete(event.pointerId)) return;
    const gesture = blankGesturesByPointerIdRef.current.get(event.pointerId) ?? null;
    blankGesturesByPointerIdRef.current.delete(event.pointerId);
    completedBlankGestureRef.current = finishKnowledgeCanvasBlankGesture(gesture, event);
  }, []);

  const handleBackgroundClick = useCallback(() => {
    const shouldDismiss = shouldDismissKnowledgeCanvasBlankGesture(completedBlankGestureRef.current);
    completedBlankGestureRef.current = null;
    if (shouldDismiss) onBackgroundClick?.();
  }, [onBackgroundClick]);

  // 4. 物理引擎配置
  useEffect(() => {
    if (fgRef.current) {
      // 弱斥力，保持辐射布局
      fgRef.current.d3Force('charge').strength(-65);
      // 链接距离
      fgRef.current.d3Force('link').distance(72);
      // 碰撞避免
      fgRef.current.d3Force('collide', d3.forceCollide(24).strength(0.8));
    }
  }, []);

  useEffect(() => {
    if (!fgRef.current?.zoom || !fgRef.current?.centerAt) return;
    if ((width ?? 800) <= 0 || (height ?? 600) <= 0) return;
    const fitSignature = `${fitViewRequest.id}:${width ?? 800}:${height ?? 600}:${window.devicePixelRatio}:${relayoutVersion}`;
    if (consumedFitSignatureRef.current === fitSignature) return;
    if (fitViewRequest.target === 'root' && !compactRootView) return;
    if (graphData.nodes.length > 1 && settledLayoutSignatureRef.current !== layoutSignature) return;
    const positionedNodes = (fgRef.current?.graphData?.()?.nodes ?? graphData.nodes).map((node: any) => ({
      id: node.id,
      x: node.x ?? 0,
      y: node.y ?? 0,
      bodyRadius: getKnowledgeNodeMaximumPresentationRadius(node),
      isRootBubble: Boolean(node.__knowledgeRootPacking),
      isKeyNode: node.labelPriority,
      importance: node.importance,
      labelBounds: getKnowledgeNodeLabelBounds({
        name: node.name,
        bodyRadius: getKnowledgeNodeMaximumPresentationRadius(node),
      }),
    }));
    const fit = getKnowledgeGraphViewportFit({
      nodes: positionedNodes,
      width: width ?? 800,
      height: height ?? 600,
      padding: getKnowledgeGraphViewportSafeInsets({ width: width ?? 800, height: height ?? 600 }),
      labelMode,
      selectedNodeId: selectedNode?.id,
      hoveredNodeId: hoveredNode?.id,
    });
    if (fitTimerRef.current !== null) window.clearTimeout(fitTimerRef.current);
    if (labelProjectionTimerRef.current !== null) window.clearTimeout(labelProjectionTimerRef.current);
    fitTimerRef.current = window.setTimeout(() => {
      fgRef.current?.centerAt?.(fit.centerX, fit.centerY, 320);
      const projectedScale = compactRootView
        ? Math.max(fit.scale, KNOWLEDGE_ROOT_MINIMUM_PROJECTION_SCALE)
        : fit.scale;
      fgRef.current?.zoom?.(projectedScale, 320);
      consumedFitSignatureRef.current = fitSignature;
      fitTimerRef.current = null;
      labelProjectionTimerRef.current = window.setTimeout(() => {
        syncRichLabelLayerRef.current(projectedScale);
        labelProjectionTimerRef.current = null;
      }, 360);
    }, 0);
    return () => {
      if (fitTimerRef.current !== null) window.clearTimeout(fitTimerRef.current);
      fitTimerRef.current = null;
    };
  }, [compactRootView, fitViewRequest, graphData.nodes, height, hoveredNode?.id, labelMode, layoutSettledRevision, layoutSignature, relayoutVersion, selectedNode?.id, viewportRevision, width]);

  useEffect(() => {
    const cameraTransition = cameraTransitionRef.current;
    const expandedIds = [...new Set(expandedNodeIds)];
    const newlyExpandedTarget = resolveFocusedExpansionRevealTarget(
      previousExpandedNodeIdsRef.current,
      expandedIds
    );
    previousExpandedNodeIdsRef.current = expandedIds;
    if (newlyExpandedTarget) {
      focusedRevealTargetNodeIdRef.current = newlyExpandedTarget;
      revealedExpansionSignatureRef.current = '';
    }
    if (expandedIds.length === 0) {
      focusedRevealTargetNodeIdRef.current = null;
      revealedExpansionSignatureRef.current = '';
      return;
    }
    const targetNodeId = focusedRevealTargetNodeIdRef.current;
    if (!targetNodeId || !expandedIds.includes(targetNodeId)) {
      focusedRevealTargetNodeIdRef.current = null;
      return;
    }
    const targetDirectLinks = expandedDirectLinks.filter((link) => (
      link.sourceId === targetNodeId || link.targetId === targetNodeId
    ));
    if (targetDirectLinks.length === 0) return;
    const expansionSignature = createFocusedExpansionRevealSignature(
      [targetNodeId],
      targetDirectLinks
    );
    if (revealedExpansionSignatureRef.current === expansionSignature) return;

    const animationFrame = window.requestAnimationFrame(() => {
      const viewportWidth = Number(width);
      const viewportHeight = Number(height);
      if (
        !Number.isFinite(viewportWidth)
        || !Number.isFinite(viewportHeight)
        || !fgRef.current?.graph2ScreenCoords
        || !fgRef.current?.screen2GraphCoords
        || !fgRef.current?.centerAt
      ) {
        return;
      }

      const focusedNodeIds = new Set([targetNodeId]);
      targetDirectLinks.forEach((link) => {
        focusedNodeIds.add(link.sourceId === targetNodeId ? link.targetId : link.sourceId);
      });
      const refNodes = fgRef.current.graphData?.()?.nodes as RuntimeKnowledgeGraphNode[] | undefined;
      const graphNodes = selectFocusedExpansionGraphNodes({
        refNodes,
        currentNodes: graphData.nodes,
        requiredNodeIds: [...focusedNodeIds],
      });
      const graphNodeById = new Map(graphNodes.map((node) => [node.id, node]));
      if ([...focusedNodeIds].some((nodeId) => !graphNodeById.has(nodeId))) return;
      const focusedScreenPoints = [...focusedNodeIds].flatMap((nodeId) => {
        const node = graphNodeById.get(nodeId);
        if (!node) return [];
        const graphX = Number(node.x);
        const graphY = Number(node.y);
        if (!Number.isFinite(graphX) || !Number.isFinite(graphY)) return [];
        const screen = fgRef.current.graph2ScreenCoords(graphX, graphY);
        const screenX = Number(screen?.x);
        const screenY = Number(screen?.y);
        return Number.isFinite(screenX) && Number.isFinite(screenY)
          ? [{ x: screenX, y: screenY }]
          : [];
      });
      if (focusedScreenPoints.length !== focusedNodeIds.size) return;
      const reveal = calculateFocusedExpansionRevealTranslation({
        points: focusedScreenPoints,
        viewportWidth,
        viewportHeight,
        padding: 48,
      });
      if (!reveal) return;

      if (reveal.x === 0 && reveal.y === 0) {
        revealedExpansionSignatureRef.current = expansionSignature;
        return;
      }
      const currentCenter = fgRef.current.centerAt();
      if (!currentCenter || ![currentCenter.x, currentCenter.y].every(Number.isFinite)) return;
      const targetCenter = fgRef.current.screen2GraphCoords(
        viewportWidth / 2 - reveal.x,
        viewportHeight / 2 - reveal.y
      );
      const targetX = Number(targetCenter?.x);
      const targetY = Number(targetCenter?.y);
      if (!Number.isFinite(targetX) || !Number.isFinite(targetY)) return;
      cameraTransitionRef.current.start(
        prefersReducedKnowledgeGraphMotion() ? 0 : KNOWLEDGE_GRAPH_MOTION.cameraDurationMs,
        (progress) => {
          fgRef.current?.centerAt?.(
            currentCenter.x + (targetX - currentCenter.x) * progress,
            currentCenter.y + (targetY - currentCenter.y) * progress,
            0
          );
        }
      );
      revealedExpansionSignatureRef.current = expansionSignature;
    });

    return () => {
      window.cancelAnimationFrame(animationFrame);
      cameraTransition.cancel();
    };
  }, [expandedDirectLinks, expandedNodeIds, graphData.nodes, height, width]);

  useEffect(() => {
    const currentNodes = fgRef.current?.graphData?.()?.nodes as
      | Array<KnowledgeNodeData & { x?: number; y?: number; z?: number; fx?: number; fy?: number; fz?: number }>
      | undefined;
    syncKnowledgeGraphMutableNodePositions(currentNodes, layoutState);
    fgRef.current?.refresh?.();
  }, [graphData, layoutState]);

  useEffect(() => {
    if (!isKnowledgeGraphTask74PerformanceQa(window.location.search)) return;
    return installKnowledgeGraphTask74Snapshot(window, () => {
      const currentWidth = width ?? 800;
      const currentHeight = height ?? 600;
      const scale = Number(fgRef.current?.zoom?.() ?? 1);
      const projector = fgRef.current?.graph2ScreenCoords as ((x: number, y: number) => { x: number; y: number }) | undefined;
      const nodes = (fgRef.current?.graphData?.()?.nodes ?? graphData.nodes) as Array<KnowledgeNodeData & {
        x?: number;
        y?: number;
        graphDegree?: number;
        graphImportanceScore?: number;
      }>;
      const placements = getFrameLabelPlacements(scale);
      const bodyBounds = nodes.flatMap((node) => {
        const point = projector?.(Number(node.x ?? node.positionX), Number(node.y ?? node.positionY));
        if (!point || ![point.x, point.y].every(Number.isFinite)) return [];
        const focused = selectedNode?.id === node.id
          || hoveredNode?.id === node.id
          || Boolean(selectedCorridorEmphasis?.nodeIds.includes(node.id));
        const naturalRadius = getKnowledgeNodeScale({
          metadata: node.metadata,
          degree: node.graphDegree,
          focused,
          importanceScore: node.graphImportanceScore,
          sourceCoverageCount: node.sourceCoverageCount,
        }).radius * getKnowledgeGraphPresentationNodeScale({ ...presentationRef.current, nodeId: node.id });
        const radius = naturalRadius * scale;
        if (point.x + radius < 0 || point.x - radius > currentWidth || point.y + radius < 0 || point.y - radius > currentHeight) return [];
        return [{ id: node.id, x: point.x - radius, y: point.y - radius, width: radius * 2, height: radius * 2, radius }];
      });
      const labelBounds = nodes.flatMap((node) => {
        const point = projector?.(Number(node.x ?? node.positionX), Number(node.y ?? node.positionY));
        const placement = placements.get(node.id);
        if (!point || !placement?.visible || ![point.x, point.y].every(Number.isFinite)) return [];
        const layout = layoutKnowledgeNodeLabel(node.name);
        const labelWidth = layout.width * placement.fontSize / KNOWLEDGE_NODE_LABEL_POLICY.fontSize;
        const labelHeight = layout.height * placement.fontSize / KNOWLEDGE_NODE_LABEL_POLICY.fontSize;
        const centerX = point.x + placement.offsetX;
        const centerY = point.y + placement.offsetY;
        return [{ id: node.id, x: centerX - labelWidth / 2, y: centerY - labelHeight / 2, width: labelWidth, height: labelHeight }];
      });
      return {
        renderMode: '2D',
        visibleNodeIds: nodes.map((node) => node.id).sort(),
        bodyIds: bodyBounds.map((bound) => bound.id).sort(),
        labelIds: labelBounds.map((bound) => bound.id).sort(),
        visibleLineIds: graphData.links
          .map((link) => getKnowledgeGraphPresentationLinkKey(link))
          .sort(),
        bodyBounds: bodyBounds.sort((left, right) => left.id.localeCompare(right.id)),
        labelBounds: labelBounds.sort((left, right) => left.id.localeCompare(right.id)),
        canonicalEdges: graphData.links.map((link: any) => {
          const family = getKnowledgeGraphPresentationFamily(link);
          return {
            id: getKnowledgeGraphPresentationLinkKey(link),
            family,
            direction: family === 'association' ? 'unordered' as const : 'source-to-target' as const,
            sourceId: typeof link.source === 'object' ? link.source.id : link.sourceId,
            targetId: typeof link.target === 'object' ? link.target.id : link.targetId,
          };
        }).sort((left, right) => left.id.localeCompare(right.id)),
        corridorIds: {
          nodeIds: [...(selectedCorridorEmphasis?.nodeIds ?? [])].sort(),
          edgeIds: [...(selectedCorridorEmphasis?.edgeIds ?? [])].sort(),
        },
        markerCount: !motionEnvironmentActive || reducedMotion ? 0 : activeMotionMarkerCount,
        viewportCoverage: {
          declared: nodes.length,
          body: bodyBounds.length,
          label: labelBounds.length,
          eligible: placements.size,
          deferred: [...placements.values()].filter((placement) => !placement.visible).length,
          visibleLine: graphData.links.length,
        },
        camera: { mode: 'orthographic-2d', zoom: scale },
      };
    });
  }, [
    getFrameLabelPlacements,
    graphData,
    height,
    hoveredNode?.id,
    activeMotionMarkerCount,
    motionEnvironmentActive,
    motionMarkerEdgeIds.length,
    reducedMotion,
    selectedCorridorEmphasis,
    selectedNode?.id,
    width,
  ]);

  return (
    <div
      ref={rootRef}
      className="relative h-full w-full"
      data-knowledge-graph-renderer="2D"
      data-knowledge-render-layer-order="edge,node,label"
      data-knowledge-selected-emphasis-contract="shared-corridor-input"
      data-knowledge-edge-lanes={JSON.stringify(graphData.links.map((link: any) => ({
        id: getKnowledgeGraphPresentationLinkKey(link),
        curvature: laneCurvatureByLinkKey.get(getKnowledgeGraphPresentationLinkKey(link)) ?? 0,
        targetArrow: getKnowledgeGraphEdgePresentation(link).directed,
      })))}
      data-knowledge-label-max-lines={KNOWLEDGE_NODE_LABEL_POLICY.maxLines}
      data-knowledge-graph-presentation-phase={presentation.phase}
      data-knowledge-graph-presentation-elapsed-ms={String(presentation.elapsedMs ?? 0)}
      data-knowledge-graph-animated-node-count={String(presentation.animatedNodeIds?.length ?? 0)}
      data-knowledge-graph-animated-relation-count={String(presentation.animatedRelationIds?.length ?? 0)}
      data-knowledge-motion-marker-count={!motionEnvironmentActive || reducedMotion ? '0' : String(activeMotionMarkerCount)}
      onPointerDownCapture={handleCanvasPointerDown}
      onPointerMoveCapture={handleCanvasPointerMove}
      onPointerUpCapture={handleCanvasPointerUp}
      onPointerCancelCapture={handleCanvasPointerCancel}
      onLostPointerCapture={handleCanvasLostPointerCapture}
    >
      <ForceGraph2D
        ref={fgRef}
        width={width}
        height={height}
        graphData={graphData}
        autoPauseRedraw={!motionPaintActive}
        minZoom={compactRootView
          ? KNOWLEDGE_ROOT_MINIMUM_PROJECTION_SCALE
          : KNOWLEDGE_GRAPH_2D_LIBRARY_DEFAULT_MIN_ZOOM}

        // 节点渲染
        nodeCanvasObject={paintNode}
        nodePointerAreaPaint={paintNodePointerArea}
        nodeLabel={(node: any) => (
          node.richTitle?.state === 'available'
            ? node.richTitle.accessibleName
            : layoutKnowledgeNodeLabel(node.name).accessibleName
        )}

        // 连线渲染
        linkCanvasObject={paintLink}
        linkCanvasObjectMode={() => 'replace'}

        // 背景透明
        backgroundColor="rgba(0,0,0,0)"

        // 交互
        onNodeClick={onNodeClick}
        onNodeHover={onNodeHover}
        onNodeDrag={handleNodeDrag}
        onNodeDragEnd={handleNodeDragEnd}
        onBackgroundClick={handleBackgroundClick}
        onEngineStop={handleEngineStop}
        onEngineTick={handleEngineTick}
        onZoomEnd={() => syncRichLabelLayer()}
        enableNodeDrag={true}

        // 物理引擎配置
        d3VelocityDecay={0.3}
        warmupTicks={20}
        cooldownTicks={0}
      />
      <SemanticLabelLayer
        labels={(graphData.nodes as KnowledgeNodeData[])
          .filter((node) => node.richTitle)
          .map((node) => ({
            id: node.id,
            richTitle: node.richTitle,
            fallbackLines: layoutKnowledgeNodeLabel(node.name).lines.map((line) => line.text),
            accessibleName: node.richTitle?.state === 'available'
              ? node.richTitle.accessibleName
              : layoutKnowledgeNodeLabel(node.name).accessibleName,
            visible: false,
            x: 0,
            y: 0,
            width: 160,
            height: 32,
            fontSize: KNOWLEDGE_NODE_LABEL_POLICY.fontSize,
            isRootBubble: false,
            opacity: 1,
          }))}
        theme={isLightTheme ? 'light' : 'dark'}
        layerAttr="data-knowledge-2d-dom-label-layer"
      />
    </div>
  );
}
