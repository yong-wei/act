'use client';

/**
 * KnowledgeGraphCanvas - 3D 知识图谱画布
 *
 * 使用 react-force-graph-3d 实现的力导向 3D 知识图谱
 * 支持自动布局、手动拖拽、节点标签始终显示
 */

import { useRef, useCallback, useMemo, useEffect, useState } from 'react';
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
  resolveFocusedExpansionRevealTarget,
  selectFocusedExpansionGraphNodes,
  translateKnowledgeGraphCameraPose,
  type KnowledgeGraphNodeScreenPosition,
  type KnowledgeGraphPositionedNode,
} from './layout-engine';

interface KnowledgeGraphCanvasProps {
  nodes: KnowledgeNodeData[];
  links: KnowledgeLinkData[];
  selectedNode: KnowledgeNodeData | null;
  hoveredNode: KnowledgeNodeData | null;
  onNodeClick: (node: KnowledgeNodeData) => void;
  onNodeHover: (node: KnowledgeNodeData | null) => void;
  onNodeDragEnd: (node: KnowledgeNodeData) => void;
  labelMode: KnowledgeGraphLabelMode;
  layoutState: KnowledgeGraphLayoutState;
  fitViewVersion: number;
  relayoutVersion: number;
  width?: number;
  height?: number;
  expandedNodeIds: readonly string[];
  expandedDirectLinks: readonly KnowledgeLinkData[];
  onSelectedNodeScreenPosition: (position: KnowledgeGraphNodeScreenPosition) => void;
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
  labelMode,
  layoutState,
  fitViewVersion,
  relayoutVersion,
  width,
  height,
  expandedNodeIds,
  expandedDirectLinks,
  onSelectedNodeScreenPosition,
}: KnowledgeGraphCanvasProps) {
  const fgRef = useRef<any>(null);
  const layoutStateRef = useRef(layoutState);
  const runtimePositionsByNodeIdRef = useRef(new Map<string, Partial<RuntimeKnowledgeGraphNode>>());
  const committedRelayoutVersionRef = useRef(relayoutVersion);
  const revealedExpansionSignatureRef = useRef('');
  const previousExpandedNodeIdsRef = useRef<readonly string[]>([]);
  const focusedRevealTargetNodeIdRef = useRef<string | null>(null);
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

  // 1. 处理数据并转换 links 格式
  const graphData = useMemo(() => {
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
    const preserveRuntimeCoordinates = committedRelayoutVersionRef.current === relayoutVersion;

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
      layoutState: layoutStateRef.current,
    });
    const expandedIdSet = new Set(expandedNodeIds);
    const focusedDepthByNodeId = new Map<string, number>();
    [...expandedIdSet].sort().forEach((centerId) => {
      const centerNode = focusedLayoutNodes.find((node) => node.id === centerId);
      const centerPinned = layoutStateRef.current.positionsByNodeId[centerId];
      const centerZ = centerPinned?.z ?? centerNode?.z ?? centerNode?.positionZ ?? 0;
      expandedDirectLinks.forEach((link) => {
        const childId = link.sourceId === centerId
          ? link.targetId
          : link.targetId === centerId ? link.sourceId : null;
        if (!childId || expandedIdSet.has(childId) || focusedDepthByNodeId.has(childId)) return;
        focusedDepthByNodeId.set(childId, centerZ);
      });
    });
    const focusedThreeDimensionalNodes = focusedLayoutNodes.map((node) => {
      const focusedZ = focusedDepthByNodeId.get(node.id);
      const pinnedZ = layoutStateRef.current.positionsByNodeId[node.id]?.z;
      if (focusedZ === undefined || pinnedZ !== undefined) return node;
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
  }, [nodes, links, relayoutVersion, layoutState.version, expandedNodeIds, expandedDirectLinks]);

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

  const reportSelectedNodeScreenPosition = useCallback(() => {
    const graphNodes = (fgRef.current?.graphData?.()?.nodes ?? graphData.nodes) as RuntimeKnowledgeGraphNode[];

    if (!selectedNode?.id || !fgRef.current?.graph2ScreenCoords) {
      onSelectedNodeScreenPosition({ nodeId: null, viewMode: '3D' });
      return;
    }
    const graphNode = graphNodes.find((node) => node.id === selectedNode.id);
    const graphX = Number(graphNode?.x);
    const graphY = Number(graphNode?.y);
    const graphZ = Number(graphNode?.z ?? 0);
    if (!Number.isFinite(graphX) || !Number.isFinite(graphY) || !Number.isFinite(graphZ)) {
      onSelectedNodeScreenPosition({ nodeId: null, viewMode: '3D' });
      return;
    }
    const screen = fgRef.current.graph2ScreenCoords(graphX, graphY, graphZ);
    const screenX = Number(screen?.x);
    const screenY = Number(screen?.y);
    if (!Number.isFinite(screenX) || !Number.isFinite(screenY)) {
      onSelectedNodeScreenPosition({ nodeId: null, viewMode: '3D' });
      return;
    }
    onSelectedNodeScreenPosition({
      nodeId: selectedNode.id,
      viewMode: '3D',
      x: screenX,
      y: screenY,
      z: graphZ,
    });
  }, [graphData.nodes, onSelectedNodeScreenPosition, selectedNode?.id]);

  useEffect(() => {
    let animationFrame = 0;
    const reportFrame = () => {
      reportSelectedNodeScreenPosition();
      animationFrame = window.requestAnimationFrame(reportFrame);
    };
    onSelectedNodeScreenPosition({ nodeId: null, viewMode: '3D' });
    animationFrame = window.requestAnimationFrame(reportFrame);
    return () => {
      window.cancelAnimationFrame(animationFrame);
      onSelectedNodeScreenPosition({ nodeId: null, viewMode: '3D' });
    };
  }, [height, onSelectedNodeScreenPosition, reportSelectedNodeScreenPosition, width]);

  // 2. 创建自定义节点 3D 对象
  const createNodeObject = useCallback((node: any) => {
    const group = new THREE.Group();

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
    const semanticRegionStyle = getKnowledgeSemanticRegionStyle(node, isLightTheme);

    if (semanticRegionStyle.enabled) {
      const regionRadius = Math.min(
        semanticRegionStyle.maxRadius,
        nodeScale.radius * semanticRegionStyle.radiusMultiplier
      );
      const territoryGeometry = new THREE.RingGeometry(
        regionRadius * 0.82,
        regionRadius,
        64
      );
      const territoryMaterial = new THREE.MeshBasicMaterial({
        color: new THREE.Color(hexToRgba(semanticRegionStyle.strokeColor, 1)),
        transparent: true,
        opacity: semanticRegionStyle.strokeOpacity,
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
      opacity: isActive ? 1 : 0.9,
      shininess: 100,
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.scale.setScalar(nodeScale.radius / 5);
    group.add(mesh);

    // 3. 创建辉光层（如果有 bloomLevel）
    if (glowColor) {
      const glowGeometry = new THREE.SphereGeometry(nodeScale.glowRadius / 1.7, 16, 16);
      const glowMaterial = new THREE.MeshBasicMaterial({
        color: new THREE.Color(hexToRgba(glowColor, 1)),
        transparent: true,
        opacity: isActive ? 0.3 : 0.15,
      });
      const glowMesh = new THREE.Mesh(glowGeometry, glowMaterial);
      group.add(glowMesh);
    }

    // 4. 创建选中环
    if (isSelected) {
      const ringInnerRadius = nodeScale.radius + 0.6;
      const ringOuterRadius = ringInnerRadius + Math.max(0.8, nodeScale.radius * 0.12);
      const ringGeometry = new THREE.RingGeometry(ringInnerRadius, ringOuterRadius, 32);
      const ringMaterial = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.8,
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
      sprite.position.set(0, 10, 0);
      group.add(sprite);
    }

    return group;
  }, [selectedNode, hoveredNode, isLightTheme, labelMode]);

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
    const gain = (0.55 + strength * 0.45) * focusGain * semanticGain;
    color.multiplyScalar(gain);
    return color.getStyle();
  }, [hoveredNode?.id, isLightTheme, selectedNode?.id]);

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
    return getRelationThreeDimensionalEncoding(link.relationType || link.relation).directionalParticles;
  }, []);

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
      fgRef.current.cameraPosition(
        translatedPose.cameraPosition,
        translatedPose.target,
        240
      );
      revealedExpansionSignatureRef.current = expansionSignature;
    });

    return () => window.cancelAnimationFrame(animationFrame);
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

  return (
    <div className="relative h-full w-full">
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
        linkDirectionalArrowLength={getLinkArrowLength}
        linkDirectionalArrowRelPos={1}
        linkDirectionalParticles={getLinkDirectionalParticles}
        linkDirectionalParticleWidth={getLinkDirectionalParticleWidth}
        linkDirectionalParticleSpeed={getLinkDirectionalParticleSpeed}

        // 交互
        onNodeClick={handleNodeClick}
        onNodeHover={handleNodeHover}
        onNodeDragEnd={handleNodeDragEnd}
        onEngineStop={snapshotRuntimePositions}
        enableNodeDrag={true}

        // 物理引擎
        d3VelocityDecay={0.3}
        warmupTicks={50}
        cooldownTicks={100}

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
