'use client';

/**
 * KnowledgeGraphCanvas - 3D 知识图谱画布
 *
 * 使用 react-force-graph-3d 实现的力导向 3D 知识图谱
 * 支持自动布局、手动拖拽、节点标签始终显示
 */

import { useRef, useCallback, useMemo, useEffect, useState, type PointerEvent } from 'react';
import ForceGraph3D from 'react-force-graph-3d';
import * as THREE from 'three';
import type { KnowledgeNodeData, KnowledgeLinkData } from '../knowledge-graph-system';
import {
  getNodeColor,
  getGlowColor,
  getRelationStyle,
  getRelationThreeDimensionalEncoding,
  getNodeTypeConfig,
  getKnowledgeNodeScale,
  getKnowledgeSemanticRegionStyle,
  getKnowledgeGraphEffectiveEdgeWidth,
  hexToRgba,
  KNOWLEDGE_GRAPH_SEMANTIC_MAP_CONTRACT,
} from './visual-config';
import { CHAPTER_DISPLAY_ORDER } from '@/lib/knowledge-labels';
import { CHAPTER_NODE_PREFIX, getRelationFocusState } from './filter-utils';
import {
  shouldRenderKnowledgeNodeLabel,
  type KnowledgeGraphLabelMode,
} from './label-policy';
import {
  markKnowledgeGraphAutomaticNodeAnchors,
  syncKnowledgeGraphMutableNodePositions,
  type KnowledgeGraphLayoutState,
} from './layout-state';
import {
  applyFocusedExpansionLayout,
  calculateFocusedExpansionRevealTranslation,
  commitKnowledgeGraphRelayoutVersion,
  createFocusedExpansionRevealSignature,
  resolveKnowledgeGraphRuntimeNodeCoordinates,
  resolveFocusedExpansionDepthByNodeId,
  resolveFocusedExpansionRevealTarget,
  selectFocusedExpansionGraphNodes,
  freezeKnowledgeGraphDragFrame,
  translateKnowledgeGraphCameraPose,
  type KnowledgeGraphPositionedNode,
} from './layout-engine';
import {
  createKnowledgeGraphRevealPlan,
  getKnowledgeGraphPresentationLinkOpacity,
  getKnowledgeGraphPresentationLinkProgress,
  getKnowledgeGraphPresentationNodeScale,
  getKnowledgeGraphPresentationNodeOpacity,
  IDLE_KNOWLEDGE_GRAPH_PRESENTATION,
  KnowledgeGraphTransitionGate,
  type KnowledgeGraphPresentationState,
  KNOWLEDGE_GRAPH_MOTION,
  prefersReducedKnowledgeGraphMotion,
} from './motion';
import { KnowledgeGraphCameraTransition } from './camera-transition';

interface KnowledgeGraphCanvasProps {
  nodes: KnowledgeNodeData[];
  links: KnowledgeLinkData[];
  selectedNode: KnowledgeNodeData | null;
  hoveredNode: KnowledgeNodeData | null;
  onNodeClick: (node: KnowledgeNodeData) => void;
  onNodeHover: (node: KnowledgeNodeData | null) => void;
  onNodeDragEnd: (node: KnowledgeNodeData) => void;
  onManipulationStart?: () => void;
  labelMode: KnowledgeGraphLabelMode;
  layoutState: KnowledgeGraphLayoutState;
  fitViewVersion: number;
  relayoutVersion: number;
  width?: number;
  height?: number;
  expandedNodeIds: readonly string[];
  expandedDirectLinks: readonly KnowledgeLinkData[];
  activationSequenceByCenterId: Readonly<Record<string, number>>;
  materializedNodeIds: readonly string[];
  graphVersion: string | null;
  collapsingNodeId?: string | null;
  onCollapsePresentationComplete?: (nodeId: string) => void;
}

type RuntimeKnowledgeGraphNode = KnowledgeGraphPositionedNode & {
  vx?: number;
  vy?: number;
  vz?: number;
};

// ========== 几何体创建函数 ==========

/**
 * 根据节点类型创建几何体
 */
function createGeometryByType(nodeType?: string): THREE.BufferGeometry {
  const config = getNodeTypeConfig(nodeType);
  switch (config.shape) {
    case 'circle': // sphere for 3D
      return new THREE.SphereGeometry(4, 32, 32);
    case 'square': // box for 3D
      return new THREE.BoxGeometry(7, 7, 7);
    case 'hexagon': // icosahedron for 3D
      return new THREE.IcosahedronGeometry(5, 0);
    default:
      return new THREE.SphereGeometry(4, 32, 32);
  }
}

/**
 * 创建文本精灵（始终面向相机的标签）
 */
function createTextSprite(text: string, isLightTheme: boolean): THREE.Sprite {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;

  // 动态计算画布尺寸
  const fontSize = 48;
  ctx.font = `bold ${fontSize}px "PingFang SC", "Microsoft YaHei", sans-serif`;
  const textWidth = ctx.measureText(text).width;

  canvas.width = Math.max(256, textWidth + 40);
  canvas.height = 80;

  // 清空背景
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // 绘制文字
  ctx.font = `bold ${fontSize}px "PingFang SC", "Microsoft YaHei", sans-serif`;
  ctx.fillStyle = isLightTheme ? '#0f172a' : '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // 添加描边增强可读性
  ctx.strokeStyle = isLightTheme ? 'rgba(255, 255, 255, 0.95)' : 'rgba(9, 21, 64, 0.8)';
  ctx.lineWidth = 4;
  ctx.strokeText(text, canvas.width / 2, canvas.height / 2);
  ctx.fillText(text, canvas.width / 2, canvas.height / 2);

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;

  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthTest: false,
    sizeAttenuation: true, // 标签大小随距离缩放（与2D一致）
  });

  const sprite = new THREE.Sprite(material);
  // 调整标签尺寸（启用 sizeAttenuation 后需要较大的值）
  const aspect = canvas.width / canvas.height;
  sprite.scale.set(12 * aspect, 4, 1);

  return sprite;
}

export function KnowledgeGraphCanvas({
  nodes,
  links,
  selectedNode,
  hoveredNode,
  onNodeClick,
  onNodeHover,
  onNodeDragEnd,
  onManipulationStart,
  labelMode,
  layoutState,
  fitViewVersion,
  relayoutVersion,
  width,
  height,
  expandedNodeIds,
  expandedDirectLinks,
  activationSequenceByCenterId,
  materializedNodeIds,
  graphVersion,
  collapsingNodeId = null,
  onCollapsePresentationComplete,
}: KnowledgeGraphCanvasProps) {
  const fgRef = useRef<any>(null);
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
  const [presentation, setPresentation] = useState<KnowledgeGraphPresentationState>(
    IDLE_KNOWLEDGE_GRAPH_PRESENTATION
  );
  const presentationRef = useRef(IDLE_KNOWLEDGE_GRAPH_PRESENTATION);
  presentationRef.current = presentation;
  const [isLightTheme, setIsLightTheme] = useState(false);
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
    presentationGateRef.current.dispose();
    cameraTransitionRef.current.dispose();
  }, []);

  // 1. 处理数据并转换 links 格式
  const graphData = useMemo(() => {
    const graphVersionChanged = committedGraphVersionRef.current !== graphVersion;
    if (graphVersionChanged) runtimePositionsByNodeIdRef.current.clear();
    committedGraphVersionRef.current = graphVersion;
    const degreeById = new Map<string, number>();
    links.forEach((link) => {
      degreeById.set(link.sourceId, (degreeById.get(link.sourceId) ?? 0) + 1);
      degreeById.set(link.targetId, (degreeById.get(link.targetId) ?? 0) + 1);
    });
    const clonedNodes = nodes.map((n) => ({
      ...n,
      graphDegree: n.graphDegree ?? degreeById.get(n.id) ?? 0,
    } as any));
    const nodeById = new Map(clonedNodes.map((node) => [node.id, node]));
    const relayoutRadiusOffset = relayoutVersion * 0;
    const preserveRuntimeCoordinates = !graphVersionChanged
      && committedRelayoutVersionRef.current === relayoutVersion;

    const chapterNodes = clonedNodes.filter((node) => node.id.startsWith(CHAPTER_NODE_PREFIX));
    if (chapterNodes.length > 0) {
      const chapterOrderMap = new Map(CHAPTER_DISPLAY_ORDER.map((name, index) => [name, index]));
      const orderedChapterNodes = [...chapterNodes].sort((a, b) => {
        const orderA = chapterOrderMap.get(a.name);
        const orderB = chapterOrderMap.get(b.name);
        if (typeof orderA === 'number' && typeof orderB === 'number') return orderA - orderB;
        if (typeof orderA === 'number') return -1;
        if (typeof orderB === 'number') return 1;
        return a.name.localeCompare(b.name, 'zh-Hans-CN');
      });
      const chapterRadius = Math.max(180 + relayoutRadiusOffset, orderedChapterNodes.length * 32);
      orderedChapterNodes.forEach((node, index) => {
        const angle = -Math.PI / 2 + (index / orderedChapterNodes.length) * Math.PI * 2;
        node.x = chapterRadius * Math.cos(angle);
        node.y = chapterRadius * Math.sin(angle);
        node.z = 0;
        node.fx = node.x;
        node.fy = node.y;
        node.fz = 0;
      });

      const containsLinks = links.filter(
        (link) => (link.relationType || link.relation) === 'contains'
      );
      const membersByChapter = new Map<string, string[]>();
      containsLinks.forEach((link) => {
        if (!link.sourceId.startsWith(CHAPTER_NODE_PREFIX)) return;
        if (!nodeById.has(link.targetId)) return;
        const list = membersByChapter.get(link.sourceId) ?? [];
        list.push(link.targetId);
        membersByChapter.set(link.sourceId, list);
      });

      orderedChapterNodes.forEach((chapterNode) => {
        const members = membersByChapter.get(chapterNode.id) ?? [];
        members.forEach((memberId, index) => {
          const member = nodeById.get(memberId);
          if (!member) return;
          const ring = Math.floor(index / 14);
          const angle = (index % 14) * ((2 * Math.PI) / 14);
          const radius = 55 + ring * 22;
          member.x = chapterNode.x + radius * Math.cos(angle);
          member.y = chapterNode.y + radius * Math.sin(angle);
          member.z = (ring % 2 === 0 ? 1 : -1) * 12;
        });
      });
    }

    // 转换 links: sourceId/targetId -> source/target (ForceGraph3D 格式)
    const transformedLinks = links.map(l => ({
      ...l,
      source: l.sourceId,
      target: l.targetId,
    }));

    const clonedBaseLayoutNodes = clonedNodes as RuntimeKnowledgeGraphNode[];
    const baseLayoutNodes = resolveKnowledgeGraphRuntimeNodeCoordinates({
      nodes: clonedBaseLayoutNodes,
      liveNodes: fgRef.current?.graphData?.()?.nodes as RuntimeKnowledgeGraphNode[] | undefined,
      runtimePositionsByNodeId: runtimePositionsByNodeIdRef.current,
      preserve: preserveRuntimeCoordinates,
    }) as RuntimeKnowledgeGraphNode[];
    markKnowledgeGraphAutomaticNodeAnchors(baseLayoutNodes);
    const focusedLayoutNodes = applyFocusedExpansionLayout({
      nodes: baseLayoutNodes,
      expandedNodeIds,
      directExpansionLinks: expandedDirectLinks,
      layoutState,
      activationSequenceByCenterId,
      materializedNodeIds,
    });
    const focusedDepthByNodeId = resolveFocusedExpansionDepthByNodeId({
      nodes: focusedLayoutNodes,
      expandedNodeIds,
      directExpansionLinks: expandedDirectLinks,
      layoutState,
      activationSequenceByCenterId,
      materializedNodeIds,
    });
    const focusedThreeDimensionalNodes = focusedLayoutNodes.map((node) => {
      const focusedZ = focusedDepthByNodeId.get(node.id);
      if (focusedZ === undefined) return node;
      return {
        ...node,
        z: focusedZ,
        positionZ: focusedZ,
        fz: focusedZ,
        __knowledgeAutomaticAnchor: node.__knowledgeAutomaticAnchor
          ? { ...node.__knowledgeAutomaticAnchor, z: focusedZ }
          : node.__knowledgeAutomaticAnchor,
      };
    });

    return {
      nodes: focusedThreeDimensionalNodes,
      links: transformedLinks
    };
  }, [nodes, links, relayoutVersion, layoutState, expandedNodeIds, expandedDirectLinks, activationSequenceByCenterId, materializedNodeIds, graphVersion]);

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

  const snapshotRuntimePositions = useCallback(() => {
    const graphNodes = (fgRef.current?.graphData?.()?.nodes ?? graphData.nodes) as RuntimeKnowledgeGraphNode[];
    graphNodes.forEach(rememberRuntimeNodePosition);
  }, [graphData.nodes, rememberRuntimeNodePosition]);

  useEffect(() => {
    const qaWindow = window as Window & {
      __knowledgeGraphQaNodePoints?: (nodeId?: string) => Array<{ x: number; y: number }>;
      __knowledgeGraphQaNodeDebug?: (nodeId?: string) => Array<Record<string, number | string | null>>;
      __knowledgeGraphQaPresentationDebug?: () => Record<string, unknown>;
      __knowledgeGraphQaResetViewport?: () => void;
      __knowledgeGraphQaCenterNode?: (nodeId: string) => void;
    };
    const qaMode = new URLSearchParams(window.location.search).get('qa');
    const qaEnabled = qaMode === 'knowledge-product' || qaMode === 'issue-894-direct-activation';
    if (!qaEnabled) {
      delete qaWindow.__knowledgeGraphQaNodePoints;
      delete qaWindow.__knowledgeGraphQaNodeDebug;
      delete qaWindow.__knowledgeGraphQaPresentationDebug;
      delete qaWindow.__knowledgeGraphQaResetViewport;
      delete qaWindow.__knowledgeGraphQaCenterNode;
      return;
    }
    const getNodePoints = (requestedNodeId = selectedNode?.id) => {
      if (!requestedNodeId || !fgRef.current?.graph2ScreenCoords) return [];
      const graphNodes = [
        ...((fgRef.current.graphData?.()?.nodes ?? []) as Array<KnowledgeNodeData & { x?: number; y?: number; z?: number }>),
        ...(graphData.nodes as Array<KnowledgeNodeData & { x?: number; y?: number; z?: number }>),
      ];
      const canvas = document.querySelector<HTMLCanvasElement>('[data-knowledge-canvas-primary="true"] canvas');
      const rect = canvas?.getBoundingClientRect();
      const candidates: Array<{ x: number; y: number }> = [];
      for (const graphNode of graphNodes) {
        if (graphNode.id !== requestedNodeId) continue;
        const graphX = Number(graphNode.x);
        const graphY = Number(graphNode.y);
        const graphZ = Number(graphNode.z ?? 0);
        if (![graphX, graphY, graphZ].every(Number.isFinite)) continue;
        const screen = fgRef.current.graph2ScreenCoords(graphX, graphY, graphZ);
        const screenX = Number(screen?.x);
        const screenY = Number(screen?.y);
        if (![screenX, screenY].every(Number.isFinite)) continue;
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
        index === points.findIndex((candidate) => (
          Math.round(candidate.x) === Math.round(point.x)
          && Math.round(candidate.y) === Math.round(point.y)
        ))
      ));
    };
    qaWindow.__knowledgeGraphQaNodePoints = getNodePoints;
    qaWindow.__knowledgeGraphQaNodeDebug = (requestedNodeId = selectedNode?.id) => {
      const camera = fgRef.current?.camera?.() as { position?: { x?: number; y?: number; z?: number } } | undefined;
      const controls = fgRef.current?.controls?.() as { target?: { x?: number; y?: number; z?: number } } | undefined;
      const renderer = fgRef.current?.renderer?.() as {
        info?: { render?: { calls?: number; triangles?: number } };
        domElement?: { width?: number; height?: number };
      } | undefined;
      const scene = fgRef.current?.scene?.() as { children?: unknown[] } | undefined;
      const renderCalls = renderer?.info?.render?.calls;
      const renderTriangles = renderer?.info?.render?.triangles;
      const rendererWidth = renderer?.domElement?.width;
      const rendererHeight = renderer?.domElement?.height;
      const graphNodes = [
        ...((fgRef.current?.graphData?.()?.nodes ?? []) as Array<KnowledgeNodeData & { x?: number; y?: number; z?: number }>),
        ...(graphData.nodes as Array<KnowledgeNodeData & { x?: number; y?: number; z?: number }>),
      ];
      return graphNodes
        .filter((node) => node.id === requestedNodeId)
        .map((node) => {
          const point = fgRef.current?.graph2ScreenCoords && [node.x, node.y, node.z ?? 0].every(Number.isFinite)
            ? fgRef.current.graph2ScreenCoords(node.x!, node.y!, node.z ?? 0)
            : null;
          return {
            id: node.id,
            x: Number.isFinite(node.x) ? node.x! : null,
            y: Number.isFinite(node.y) ? node.y! : null,
            z: Number.isFinite(node.z) ? node.z! : null,
            screenX: Number.isFinite(Number(point?.x)) ? Number(point?.x) : null,
            screenY: Number.isFinite(Number(point?.y)) ? Number(point?.y) : null,
            cameraX: Number.isFinite(camera?.position?.x) ? Number(camera?.position?.x) : null,
            cameraY: Number.isFinite(camera?.position?.y) ? Number(camera?.position?.y) : null,
            cameraZ: Number.isFinite(camera?.position?.z) ? Number(camera?.position?.z) : null,
            targetX: Number.isFinite(controls?.target?.x) ? Number(controls?.target?.x) : null,
            targetY: Number.isFinite(controls?.target?.y) ? Number(controls?.target?.y) : null,
            targetZ: Number.isFinite(controls?.target?.z) ? Number(controls?.target?.z) : null,
            sceneChildren: Array.isArray(scene?.children) ? scene.children.length : null,
            renderCalls: Number.isFinite(renderCalls) ? Number(renderCalls) : null,
            renderTriangles: Number.isFinite(renderTriangles) ? Number(renderTriangles) : null,
            rendererWidth: Number.isFinite(rendererWidth) ? Number(rendererWidth) : null,
            rendererHeight: Number.isFinite(rendererHeight) ? Number(rendererHeight) : null,
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
    });
    qaWindow.__knowledgeGraphQaResetViewport = () => {
      fgRef.current?.cameraPosition?.({ x: 0, y: 0, z: 350 }, { x: 0, y: 0, z: 0 }, 0);
      const controls = fgRef.current?.controls?.() as { update?: () => void } | undefined;
      const camera = fgRef.current?.camera?.() as {
        updateMatrixWorld?: (force?: boolean) => void;
        updateProjectionMatrix?: () => void;
      } | undefined;
      controls?.update?.();
      camera?.updateProjectionMatrix?.();
      camera?.updateMatrixWorld?.(true);
    };
    qaWindow.__knowledgeGraphQaCenterNode = (nodeId: string) => {
      const node = (fgRef.current?.graphData?.()?.nodes ?? graphData.nodes)
        .find((candidate: KnowledgeNodeData & { x?: number; y?: number; z?: number }) => candidate.id === nodeId) as
        | (KnowledgeNodeData & { x?: number; y?: number; z?: number })
        | undefined;
      const x = Number(node?.x ?? node?.positionX);
      const y = Number(node?.y ?? node?.positionY);
      const z = Number(node?.z ?? node?.positionZ ?? 0);
      if (![x, y, z].every(Number.isFinite)) return;
      fgRef.current?.cameraPosition?.({ x, y, z: z + 350 }, { x, y, z }, 0);
      const controls = fgRef.current?.controls?.() as { update?: () => void } | undefined;
      const camera = fgRef.current?.camera?.() as {
        updateMatrixWorld?: (force?: boolean) => void;
        updateProjectionMatrix?: () => void;
      } | undefined;
      controls?.update?.();
      camera?.updateProjectionMatrix?.();
      camera?.updateMatrixWorld?.(true);
    };
    return () => {
      delete qaWindow.__knowledgeGraphQaNodePoints;
      delete qaWindow.__knowledgeGraphQaNodeDebug;
      delete qaWindow.__knowledgeGraphQaPresentationDebug;
      delete qaWindow.__knowledgeGraphQaResetViewport;
      delete qaWindow.__knowledgeGraphQaCenterNode;
    };
  }, [
    expandedNodeIds,
    graphData,
    materializedNodeIds,
    presentation.animatedNodeIds,
    presentation.animatedRelationIds,
    presentation.elapsedMs,
    presentation.phase,
    selectedNode?.id,
  ]);

  // 2. 创建自定义节点 3D 对象
  const createNodeObject = useCallback((node: any) => {
    const group = new THREE.Group();
    const presentationOpacity = getKnowledgeGraphPresentationNodeOpacity({ ...presentation, nodeId: node.id });

    // 获取颜色配置
    const fillColor = getNodeColor(node.knowledgeDim);
    const glowColor = getGlowColor(node.bloomLevel);
    const isSelected = selectedNode?.id === node.id;
    const isHovered = hoveredNode?.id === node.id;
    const isActive = isSelected || isHovered;
    const nodeScale = getKnowledgeNodeScale({
      metadata: node.metadata,
      degree: node.graphDegree,
      focused: isActive,
    });
    const presentationScale = getKnowledgeGraphPresentationNodeScale({ ...presentation, nodeId: node.id });
    const presentationRadius = nodeScale.radius * presentationScale;
    const presentationGlowRadius = nodeScale.glowRadius * presentationScale;
    const semanticRegionStyle = getKnowledgeSemanticRegionStyle(node, isLightTheme);

    if (semanticRegionStyle.enabled) {
      const regionRadius = Math.min(
        semanticRegionStyle.maxRadius,
        presentationRadius * semanticRegionStyle.radiusMultiplier
      );
      const territoryGeometry = new THREE.RingGeometry(
        regionRadius * 0.82,
        regionRadius,
        64
      );
      const territoryMaterial = new THREE.MeshBasicMaterial({
        color: new THREE.Color(hexToRgba(semanticRegionStyle.strokeColor, 1)),
        transparent: true,
        opacity: semanticRegionStyle.strokeOpacity * presentationOpacity,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      const territory = new THREE.Mesh(territoryGeometry, territoryMaterial);
      territory.rotation.x = Math.PI / 2;
      group.add(territory);
    }

    // 1. 创建节点几何体
    const geometry = createGeometryByType(node.nodeType);

    // 2. 创建材质（带发光效果）
    const material = new THREE.MeshPhongMaterial({
      color: new THREE.Color(hexToRgba(fillColor, 1)),
      emissive: glowColor ? new THREE.Color(hexToRgba(glowColor, 1)) : new THREE.Color(hexToRgba(fillColor, 1)),
      emissiveIntensity: glowColor ? (isActive ? 0.8 : 0.5) : (isActive ? 0.4 : 0.2),
      transparent: true,
      opacity: (isActive ? 1 : 0.9) * presentationOpacity,
      shininess: 100,
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.scale.setScalar(presentationRadius / 5);
    group.add(mesh);

    // 3. 创建辉光层（如果有 bloomLevel）
    if (glowColor) {
      const glowGeometry = new THREE.SphereGeometry(presentationGlowRadius / 1.7, 16, 16);
      const glowMaterial = new THREE.MeshBasicMaterial({
        color: new THREE.Color(hexToRgba(glowColor, 1)),
        transparent: true,
        opacity: (isActive ? 0.3 : 0.15) * presentationOpacity,
      });
      const glowMesh = new THREE.Mesh(glowGeometry, glowMaterial);
      group.add(glowMesh);
    }

    // 4. 创建选中环
    if (isSelected) {
      const ringInnerRadius = presentationRadius + 0.6;
      const ringOuterRadius = ringInnerRadius + Math.max(0.8, presentationRadius * 0.12);
      const ringGeometry = new THREE.RingGeometry(ringInnerRadius, ringOuterRadius, 32);
      const ringMaterial = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.8 * presentationOpacity,
        side: THREE.DoubleSide,
      });
      const ring = new THREE.Mesh(ringGeometry, ringMaterial);
      ring.rotation.x = Math.PI / 2;
      group.add(ring);
    }

    if (shouldRenderKnowledgeNodeLabel({
      labelMode,
      nodeId: node.id,
      selectedNodeId: selectedNode?.id,
      hoveredNodeId: hoveredNode?.id,
    })) {
      const sprite = createTextSprite(node.name, isLightTheme);
      sprite.material.opacity = presentationOpacity;
      sprite.position.set(0, 10, 0);
      group.add(sprite);
    }

    return group;
  }, [selectedNode, hoveredNode, isLightTheme, labelMode, presentation]);

  // 3. 获取连线颜色
  const getLinkColor = useCallback((link: any) => {
    const style = getRelationStyle(link.relationType || link.relation);
    const strength = typeof link.strength === 'number'
      ? Math.min(1, Math.max(0, link.strength))
      : 1;
    const color = new THREE.Color(hexToRgba(isLightTheme ? style.lightColor : style.darkColor, 1));
    const sourceId = typeof link.source === 'object' ? link.source.id : link.sourceId;
    const targetId = typeof link.target === 'object' ? link.target.id : link.targetId;
    const focusNodeId = hoveredNode?.id ?? selectedNode?.id ?? null;
    const focusState = getRelationFocusState(sourceId, targetId, focusNodeId);
    const focusGain = focusState === 'dimmed'
      ? KNOWLEDGE_GRAPH_SEMANTIC_MAP_CONTRACT.dimmedNeighborhoodOpacity
      : focusState === 'active'
        ? KNOWLEDGE_GRAPH_SEMANTIC_MAP_CONTRACT.activeNeighborhoodWidthGain
        : 0.9;
    const semanticGain = 0.4 + style.opacity * 0.6;
    const gain = (0.55 + strength * 0.45) * focusGain * semanticGain
      * getKnowledgeGraphPresentationLinkOpacity({
        ...presentation,
        sourceId,
        targetId,
      });
    color.multiplyScalar(gain);
    return color.getStyle();
  }, [hoveredNode?.id, isLightTheme, presentation, selectedNode?.id]);

  const createPresentationLinkObject = useCallback(() => {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(6), 3));
    const material = new THREE.LineBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    return new THREE.Line(geometry, material);
  }, []);

  const updatePresentationLinkObject = useCallback((
    linkObject: THREE.Object3D,
    coordinates: {
      start: { x: number; y: number; z: number };
      end: { x: number; y: number; z: number };
    },
    link: any,
  ) => {
    const line = linkObject as THREE.Line;
    const sourceId = typeof link.source === 'object' ? link.source.id : link.sourceId;
    const targetId = typeof link.target === 'object' ? link.target.id : link.targetId;
    const progress = getKnowledgeGraphPresentationLinkProgress({
      ...presentation,
      sourceId,
      targetId,
    });
    const position = line.geometry.getAttribute('position') as THREE.BufferAttribute;
    const start = coordinates.start;
    const end = coordinates.end;
    position.setXYZ(0, start.x, start.y, start.z);
    position.setXYZ(
      1,
      start.x + (end.x - start.x) * progress,
      start.y + (end.y - start.y) * progress,
      start.z + (end.z - start.z) * progress,
    );
    position.needsUpdate = true;
    const material = line.material as THREE.LineBasicMaterial;
    material.color.set(getLinkColor(link));
    material.opacity = presentation.phase === 'idle' ? 0 : 0.5;
    return true;
  }, [getLinkColor, presentation]);

  // 4. 获取连线宽度
  const getLinkWidth = useCallback((link: any) => {
    const style = getRelationStyle(link.relationType || link.relation);
    const strength = typeof link.strength === 'number'
      ? Math.min(1, Math.max(0, link.strength))
      : 1;
    const sourceId = typeof link.source === 'object' ? link.source.id : link.sourceId;
    const targetId = typeof link.target === 'object' ? link.target.id : link.targetId;
    const focusNodeId = hoveredNode?.id ?? selectedNode?.id ?? null;
    const focusState = getRelationFocusState(sourceId, targetId, focusNodeId);
    return getKnowledgeGraphEffectiveEdgeWidth(style, strength, focusState, '3d');
  }, [hoveredNode?.id, selectedNode?.id]);

  const getLinkArrowLength = useCallback((link: any) => {
    return getRelationThreeDimensionalEncoding(link.relationType || link.relation).arrowLength;
  }, []);

  const getLinkDirectionalParticles = useCallback((link: any) => {
    if (prefersReducedKnowledgeGraphMotion() || (presentation.phase !== 'idle' && presentation.animateParticles === false)) return 0;
    if (presentation.phase !== 'idle') {
      const sourceId = typeof link.source === 'object' ? link.source.id : link.sourceId;
      const targetId = typeof link.target === 'object' ? link.target.id : link.targetId;
      const progress = getKnowledgeGraphPresentationLinkProgress({
        ...presentation,
        sourceId,
        targetId,
      });
      if (progress < 0.35) return 0;
    }
    return getRelationThreeDimensionalEncoding(link.relationType || link.relation).directionalParticles;
  }, [presentation]);

  const getLinkDirectionalParticleWidth = useCallback((link: any) => {
    return getRelationThreeDimensionalEncoding(link.relationType || link.relation).particleWidth;
  }, []);

  const getLinkDirectionalParticleSpeed = useCallback((link: any) => {
    return getRelationThreeDimensionalEncoding(link.relationType || link.relation).particleSpeed;
  }, []);

  // 5. 配置物理引擎
  useEffect(() => {
    if (fgRef.current) {
      // 配置力导向参数（降低斥力使节点更紧凑）
      fgRef.current.d3Force('charge').strength(-110);
      fgRef.current.d3Force('link').distance(70);

      // 添加碰撞检测
      const d3 = require('d3');
      fgRef.current.d3Force('collide', d3.forceCollide(22).strength(0.85));
    }
  }, []);

  useEffect(() => {
    if (fitViewVersion === 0 || !fgRef.current?.zoomToFit) return;
    window.setTimeout(() => {
      fgRef.current?.zoomToFit?.(420, 56);
    }, 0);
  }, [fitViewVersion]);

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
      const camera = fgRef.current?.camera?.() as THREE.Camera | undefined;
      const controls = fgRef.current?.controls?.() as { target?: THREE.Vector3 } | undefined;
      if (
        !Number.isFinite(viewportWidth)
        || !Number.isFinite(viewportHeight)
        || !camera
        || !controls?.target
        || !fgRef.current?.graph2ScreenCoords
        || !fgRef.current?.cameraPosition
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
        const graphZ = Number(node.z ?? 0);
        if (!Number.isFinite(graphX) || !Number.isFinite(graphY) || !Number.isFinite(graphZ)) return [];
        const screen = fgRef.current.graph2ScreenCoords(graphX, graphY, graphZ);
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
      const centerNode = graphNodeById.get(targetNodeId);
      if (!reveal || !centerNode) return;

      if (reveal.x === 0 && reveal.y === 0) {
        revealedExpansionSignatureRef.current = expansionSignature;
        return;
      }
      const centerWorld = new THREE.Vector3(
        Number(centerNode.x),
        Number(centerNode.y),
        Number(centerNode.z ?? 0)
      );
      if (![centerWorld.x, centerWorld.y, centerWorld.z].every(Number.isFinite)) return;
      const projectedCenter = centerWorld.clone().project(camera);
      const centerScreen = fgRef.current.graph2ScreenCoords(
        centerWorld.x,
        centerWorld.y,
        centerWorld.z
      );
      const desiredWorld = new THREE.Vector3(
        ((Number(centerScreen?.x) + reveal.x) / viewportWidth) * 2 - 1,
        -((Number(centerScreen?.y) + reveal.y) / viewportHeight) * 2 + 1,
        projectedCenter.z
      ).unproject(camera);
      if (![desiredWorld.x, desiredWorld.y, desiredWorld.z].every(Number.isFinite)) return;
      const cameraTranslation = centerWorld.clone().sub(desiredWorld);
      const translatedPose = translateKnowledgeGraphCameraPose({
        cameraPosition: camera.position,
        target: controls.target,
        translation: cameraTranslation,
      });
      const currentCameraPosition = {
        x: camera.position.x,
        y: camera.position.y,
        z: camera.position.z,
      };
      const currentTarget = {
        x: controls.target.x,
        y: controls.target.y,
        z: controls.target.z,
      };
      cameraTransitionRef.current.start(
        prefersReducedKnowledgeGraphMotion() ? 0 : KNOWLEDGE_GRAPH_MOTION.cameraDurationMs,
        (progress) => {
          fgRef.current?.cameraPosition?.({
            x: currentCameraPosition.x + (translatedPose.cameraPosition.x - currentCameraPosition.x) * progress,
            y: currentCameraPosition.y + (translatedPose.cameraPosition.y - currentCameraPosition.y) * progress,
            z: currentCameraPosition.z + (translatedPose.cameraPosition.z - currentCameraPosition.z) * progress,
          }, {
            x: currentTarget.x + (translatedPose.target.x - currentTarget.x) * progress,
            y: currentTarget.y + (translatedPose.target.y - currentTarget.y) * progress,
            z: currentTarget.z + (translatedPose.target.z - currentTarget.z) * progress,
          }, 0);
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

  // 6. 节点点击处理
  const handleNodeClick = useCallback((node: any) => {
    onNodeClick(node as KnowledgeNodeData);
  }, [onNodeClick]);

  // 7. 节点悬停处理
  const handleNodeHover = useCallback((node: any) => {
    onNodeHover(node as KnowledgeNodeData | null);
  }, [onNodeHover]);

  const handleNodeDragEnd = useCallback((node: any) => {
    rememberRuntimeNodePosition(node as RuntimeKnowledgeGraphNode);
    onNodeDragEnd(node as KnowledgeNodeData);
  }, [onNodeDragEnd, rememberRuntimeNodePosition]);

  const handleNodeDrag = useCallback((node: any) => {
    onManipulationStart?.();
    const graphNodes = (fgRef.current?.graphData?.()?.nodes ?? graphData.nodes) as RuntimeKnowledgeGraphNode[];
    freezeKnowledgeGraphDragFrame(graphNodes, node as RuntimeKnowledgeGraphNode);
  }, [graphData.nodes, onManipulationStart]);

  const handleCanvasPointerDown = useCallback((event: PointerEvent<HTMLDivElement>) => {
    const canvas = event.currentTarget.querySelector<HTMLCanvasElement>('canvas');
    const rect = canvas?.getBoundingClientRect();
    const graph2ScreenCoords = fgRef.current?.graph2ScreenCoords;
    if (!rect || !graph2ScreenCoords) return;
    const localX = event.clientX - rect.left;
    const localY = event.clientY - rect.top;
    const graphNodes = (fgRef.current?.graphData?.()?.nodes ?? graphData.nodes) as RuntimeKnowledgeGraphNode[];
    const hitNode = graphNodes.some((node) => {
      if (![node.x, node.y, node.z ?? 0].every(Number.isFinite)) return false;
      const point = graph2ScreenCoords(node.x, node.y, node.z ?? 0);
      const nodeScale = getKnowledgeNodeScale({
        metadata: node.metadata,
        degree: node.graphDegree,
        focused: selectedNode?.id === node.id || hoveredNode?.id === node.id,
      });
      return Math.hypot(Number(point?.x) - localX, Number(point?.y) - localY) <= nodeScale.radius + 14;
    });
    if (!hitNode) onManipulationStart?.();
  }, [graphData.nodes, hoveredNode?.id, onManipulationStart, selectedNode?.id]);

  return (
    <div
      className="relative h-full w-full"
      data-knowledge-graph-renderer="3D"
      data-knowledge-graph-presentation-phase={presentation.phase}
      data-knowledge-graph-presentation-elapsed-ms={String(presentation.elapsedMs ?? 0)}
      data-knowledge-graph-animated-node-count={String(presentation.animatedNodeIds?.length ?? 0)}
      data-knowledge-graph-animated-relation-count={String(presentation.animatedRelationIds?.length ?? 0)}
      onPointerDownCapture={handleCanvasPointerDown}
    >
      <ForceGraph3D
        ref={fgRef}
        width={width}
        height={height}
        graphData={graphData}

        // 节点渲染
        nodeThreeObject={createNodeObject}
        nodeThreeObjectExtend={false}

        // 连线渲染
        linkColor={getLinkColor}
        linkWidth={getLinkWidth}
        linkOpacity={0.62}
        linkThreeObject={createPresentationLinkObject}
        linkThreeObjectExtend={true}
        linkPositionUpdate={updatePresentationLinkObject}
        linkDirectionalArrowLength={getLinkArrowLength}
        linkDirectionalArrowRelPos={1}
        linkDirectionalParticles={getLinkDirectionalParticles}
        linkDirectionalParticleWidth={getLinkDirectionalParticleWidth}
        linkDirectionalParticleSpeed={getLinkDirectionalParticleSpeed}

        // 交互
        onNodeClick={handleNodeClick}
        onNodeHover={handleNodeHover}
        onNodeDrag={handleNodeDrag}
        onNodeDragEnd={handleNodeDragEnd}
        onBackgroundClick={onManipulationStart}
        onEngineStop={snapshotRuntimePositions}
        enableNodeDrag={true}

        // 物理引擎
        d3VelocityDecay={0.3}
        warmupTicks={50}
        cooldownTicks={0}

        // 背景透明（使用CSS渐变背景）
        backgroundColor="rgba(0,0,0,0)"

        // 控制器配置
        controlType="orbit"
      />

      {/* 操作提示 */}
      <div className="absolute bottom-4 left-4 text-xs text-slate-500">
        <div>鼠标左键拖拽旋转 | 滚轮缩放 | 右键平移</div>
        <div>点击节点查看详情 | 拖拽节点调整位置</div>
      </div>
    </div>
  );
}
