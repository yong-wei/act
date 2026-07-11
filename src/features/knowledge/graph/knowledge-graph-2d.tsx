'use client';

import React, { useCallback, useEffect, useRef, useMemo, useState } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import * as d3 from 'd3';
import { KnowledgeNodeData, KnowledgeLinkData } from '../knowledge-graph-system';
import {
  applyFocusedExpansionLayout,
  applyRadialLayout,
  calculateFocusedExpansionRevealTranslation,
  commitKnowledgeGraphRelayoutVersion,
  createFocusedExpansionRevealSignature,
  resolveKnowledgeGraphRuntimeNodeCoordinates,
  resolveFocusedExpansionRevealTarget,
  selectFocusedExpansionGraphNodes,
  type KnowledgeGraphNodeScreenPosition,
  type KnowledgeGraphPositionedNode,
} from './layout-engine';
import {
  getNodeColor,
  getGlowColor,
  getRelationStyle,
  getNodeTypeConfig,
  getKnowledgeNodeScale,
  getKnowledgeSemanticRegionStyle,
  getKnowledgeGraphEffectiveEdgeWidth,
  hexToRgba,
  KNOWLEDGE_GRAPH_SEMANTIC_MAP_CONTRACT,
} from './visual-config';
import {
  shouldRenderKnowledgeNodeLabel,
  type KnowledgeGraphLabelMode,
} from './label-policy';
import { getRelationFocusState } from './filter-utils';
import {
  markKnowledgeGraphAutomaticNodeAnchors,
  syncKnowledgeGraphMutableNodePositions,
  type KnowledgeGraphLayoutState,
} from './layout-state';

interface KnowledgeGraph2DProps {
  nodes: KnowledgeNodeData[];
  links: KnowledgeLinkData[];
  selectedNode: KnowledgeNodeData | null;
  hoveredNode: KnowledgeNodeData | null;
  onNodeClick: (node: KnowledgeNodeData) => void;
  onNodeHover: (node: KnowledgeNodeData | null) => void;
  onNodeDragEnd: (node: KnowledgeNodeData) => void;
  width?: number;
  height?: number;
  labelMode: KnowledgeGraphLabelMode;
  layoutState: KnowledgeGraphLayoutState;
  fitViewVersion: number;
  relayoutVersion: number;
  expandedNodeIds: readonly string[];
  expandedDirectLinks: readonly KnowledgeLinkData[];
  onSelectedNodeScreenPosition: (position: KnowledgeGraphNodeScreenPosition) => void;
}

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
 * 根据节点类型选择绘制函数
 */
function drawShape(
  ctx: CanvasRenderingContext2D,
  nodeType: string | undefined,
  x: number,
  y: number,
  size: number
) {
  const config = getNodeTypeConfig(nodeType);
  switch (config.shape) {
    case 'circle':
      drawCircle(ctx, x, y, size);
      break;
    case 'square':
      drawSquare(ctx, x, y, size * 1.6); // 方形需要稍大以保持视觉一致
      break;
    case 'hexagon':
      drawHexagon(ctx, x, y, size * 1.2);
      break;
    default:
      drawCircle(ctx, x, y, size);
  }
}

/**
 * 绘制箭头
 */
function drawArrow(
  ctx: CanvasRenderingContext2D,
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  globalScale: number,
  color: string
) {
  const headLength = 8 / globalScale;
  const dx = toX - fromX;
  const dy = toY - fromY;
  const angle = Math.atan2(dy, dx);

  // 箭头位置在线段中点偏后
  const midX = fromX + dx * 0.65;
  const midY = fromY + dy * 0.65;

  ctx.save();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(midX, midY);
  ctx.lineTo(
    midX - headLength * Math.cos(angle - Math.PI / 6),
    midY - headLength * Math.sin(angle - Math.PI / 6)
  );
  ctx.lineTo(
    midX - headLength * Math.cos(angle + Math.PI / 6),
    midY - headLength * Math.sin(angle + Math.PI / 6)
  );
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function getQuadraticPoint(
  fromX: number,
  fromY: number,
  controlX: number,
  controlY: number,
  toX: number,
  toY: number,
  t: number
) {
  const inverseT = 1 - t;
  return {
    x: inverseT * inverseT * fromX + 2 * inverseT * t * controlX + t * t * toX,
    y: inverseT * inverseT * fromY + 2 * inverseT * t * controlY + t * t * toY,
  };
}

function getQuadraticTangentAngle(
  fromX: number,
  fromY: number,
  controlX: number,
  controlY: number,
  toX: number,
  toY: number,
  t: number
) {
  const dx = 2 * (1 - t) * (controlX - fromX) + 2 * t * (toX - controlX);
  const dy = 2 * (1 - t) * (controlY - fromY) + 2 * t * (toY - controlY);
  return Math.atan2(dy, dx);
}

function drawArrowHead(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  angle: number,
  globalScale: number,
  color: string
) {
  const headLength = 8 / globalScale;

  ctx.save();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(
    x - headLength * Math.cos(angle - Math.PI / 6),
    y - headLength * Math.sin(angle - Math.PI / 6)
  );
  ctx.lineTo(
    x - headLength * Math.cos(angle + Math.PI / 6),
    y - headLength * Math.sin(angle + Math.PI / 6)
  );
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawEndpointMarker(
  ctx: CanvasRenderingContext2D,
  endpoint: 'arrow' | 'none' | 'dot' | 'bar' | 'diamond',
  x: number,
  y: number,
  angle: number,
  globalScale: number,
  color: string
) {
  if (endpoint === 'none' || endpoint === 'arrow') return;

  const size = 4.5 / globalScale;
  ctx.save();
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.4 / globalScale;
  if (endpoint === 'dot') {
    ctx.beginPath();
    ctx.arc(x, y, size * 0.62, 0, 2 * Math.PI);
    ctx.fill();
  } else if (endpoint === 'bar') {
    const barAngle = angle + Math.PI / 2;
    ctx.beginPath();
    ctx.moveTo(x - size * Math.cos(barAngle), y - size * Math.sin(barAngle));
    ctx.lineTo(x + size * Math.cos(barAngle), y + size * Math.sin(barAngle));
    ctx.stroke();
  } else if (endpoint === 'diamond') {
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.beginPath();
    ctx.moveTo(size, 0);
    ctx.lineTo(0, size * 0.72);
    ctx.lineTo(-size, 0);
    ctx.lineTo(0, -size * 0.72);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

export function KnowledgeGraph2D({
  nodes,
  links,
  selectedNode,
  hoveredNode,
  onNodeClick,
  onNodeHover,
  onNodeDragEnd,
  width,
  height,
  labelMode,
  layoutState,
  fitViewVersion,
  relayoutVersion,
  expandedNodeIds,
  expandedDirectLinks,
  onSelectedNodeScreenPosition,
}: KnowledgeGraph2DProps) {
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

  // 1. 处理数据并应用布局
  const graphData = useMemo(() => {
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

    const layoutRadius = 180 + relayoutVersion * 0;
    const preserveRuntimeCoordinates = committedRelayoutVersionRef.current === relayoutVersion;

    // 应用辐射布局。layoutState.version 变化时重算已展开邻域，确保直接子节点
    // 随固定中心同步移动；普通运行时坐标仍由下方 preserve gate 保留。
    const baseLayoutNodes = applyRadialLayout(clonedNodes, links, undefined, layoutRadius);
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
      layoutState: layoutStateRef.current,
    });

    return {
      nodes: focusedLayoutNodes,
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
      onSelectedNodeScreenPosition({ nodeId: null, viewMode: '2D' });
      return;
    }
    const graphNode = graphNodes.find((node) => node.id === selectedNode.id);
    const graphX = Number(graphNode?.x);
    const graphY = Number(graphNode?.y);
    if (!Number.isFinite(graphX) || !Number.isFinite(graphY)) {
      onSelectedNodeScreenPosition({ nodeId: null, viewMode: '2D' });
      return;
    }
    const screen = fgRef.current.graph2ScreenCoords(graphX, graphY);
    const screenX = Number(screen?.x);
    const screenY = Number(screen?.y);
    if (!Number.isFinite(screenX) || !Number.isFinite(screenY)) {
      onSelectedNodeScreenPosition({ nodeId: null, viewMode: '2D' });
      return;
    }
    onSelectedNodeScreenPosition({
      nodeId: selectedNode.id,
      viewMode: '2D',
      x: screenX,
      y: screenY,
    });
  }, [graphData.nodes, onSelectedNodeScreenPosition, selectedNode?.id]);

  useEffect(() => {
    let animationFrame = 0;
    const reportFrame = () => {
      reportSelectedNodeScreenPosition();
      animationFrame = window.requestAnimationFrame(reportFrame);
    };
    onSelectedNodeScreenPosition({ nodeId: null, viewMode: '2D' });
    animationFrame = window.requestAnimationFrame(reportFrame);
    return () => {
      window.cancelAnimationFrame(animationFrame);
      onSelectedNodeScreenPosition({ nodeId: null, viewMode: '2D' });
    };
  }, [height, onSelectedNodeScreenPosition, reportSelectedNodeScreenPosition, width]);

  useEffect(() => {
    const qaWindow = window as Window & {
      __knowledgeGraphProductQaSelectedNodeDragPoints?: () => Array<{ x: number; y: number }>;
    };
    const qaEnabled = new URLSearchParams(window.location.search).get('qa') === 'knowledge-product';
    if (!qaEnabled) {
      delete qaWindow.__knowledgeGraphProductQaSelectedNodeDragPoints;
      return;
    }
    qaWindow.__knowledgeGraphProductQaSelectedNodeDragPoints = () => {
      if (!selectedNode?.id || !fgRef.current?.graph2ScreenCoords) return [];
      const graphNodes = [
        ...((fgRef.current.graphData?.()?.nodes ?? []) as Array<KnowledgeNodeData & { x?: number; y?: number }>),
        ...(graphData.nodes as Array<KnowledgeNodeData & { x?: number; y?: number }>),
      ];
      const canvas = document.querySelector<HTMLCanvasElement>('[data-knowledge-canvas-primary="true"] canvas');
      const rect = canvas?.getBoundingClientRect();
      const candidates: Array<{ x: number; y: number }> = [];
      for (const graphNode of graphNodes) {
        if (graphNode.id !== selectedNode.id) continue;
        const graphX = Number(graphNode.x);
        const graphY = Number(graphNode.y);
        if (!Number.isFinite(graphX) || !Number.isFinite(graphY)) continue;
        const screen = fgRef.current.graph2ScreenCoords(graphX, graphY);
        const screenX = Number(screen?.x);
        const screenY = Number(screen?.y);
        if (!Number.isFinite(screenX) || !Number.isFinite(screenY)) continue;
        candidates.push({ x: screenX, y: screenY });
        if (rect) {
          candidates.push({ x: rect.left + screenX, y: rect.top + screenY });
        }
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
    return () => {
      delete qaWindow.__knowledgeGraphProductQaSelectedNodeDragPoints;
    };
  }, [graphData, selectedNode?.id]);

  // 2. 自定义节点渲染
  const paintNode = useCallback((node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
    // 获取颜色配置
    const fillColor = getNodeColor(node.knowledgeDim);
    const glowColor = getGlowColor(node.bloomLevel);

    // 高亮状态
    const isSelected = selectedNode?.id === node.id;
    const isHovered = hoveredNode?.id === node.id;
    const isActive = isSelected || isHovered;

    // 节点尺寸：显式教学重要性优先，连接度只作为封顶的辅助信号。
    const nodeScale = getKnowledgeNodeScale({
      metadata: node.metadata,
      degree: node.graphDegree,
      focused: isActive,
    });
    const baseRadius = nodeScale.radius;
    const glowRadius = nodeScale.glowRadius;
    const semanticRegionStyle = getKnowledgeSemanticRegionStyle(node, isLightTheme);

    if (semanticRegionStyle.enabled) {
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
    if (glowColor) {
      ctx.fillStyle = hexToRgba(glowColor, isActive ? 0.34 : 0.18);
      drawShape(ctx, node.nodeType, node.x, node.y, glowRadius);
    }

    // 绘制节点核心
    ctx.fillStyle = hexToRgba(fillColor, 1);
    drawShape(ctx, node.nodeType, node.x, node.y, baseRadius);

    // 绘制选中环
    if (isSelected) {
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2 / globalScale;
      ctx.beginPath();
      const config = getNodeTypeConfig(node.nodeType);
      if (config.shape === 'circle') {
        ctx.arc(node.x, node.y, baseRadius + 4, 0, 2 * Math.PI);
      } else if (config.shape === 'square') {
        const ringSize = baseRadius * 1.6 + 6;
        ctx.rect(node.x - ringSize / 2, node.y - ringSize / 2, ringSize, ringSize);
      } else {
        // hexagon ring
        const ringRadius = baseRadius * 1.2 + 4;
        for (let i = 0; i < 6; i++) {
          const angle = (Math.PI / 3) * i - Math.PI / 2;
          const px = node.x + ringRadius * Math.cos(angle);
          const py = node.y + ringRadius * Math.sin(angle);
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
      }
      ctx.stroke();
    }

    if (!shouldRenderKnowledgeNodeLabel({
      labelMode,
      nodeId: node.id,
      selectedNodeId: selectedNode?.id,
      hoveredNodeId: hoveredNode?.id,
      globalScale,
    })) {
      return;
    }

    const label = node.name;
    const fontSize = isActive ? 12 / globalScale : 10 / globalScale;
    const minFontSize = 8 / globalScale;
    const displayFontSize = Math.max(fontSize, minFontSize);

    ctx.font = `${isActive ? 'bold' : 'normal'} ${displayFontSize}px "PingFang SC", "Microsoft YaHei", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const labelFillColor = isLightTheme
      ? (isActive ? '#0f172a' : 'rgba(15, 23, 42, 0.9)')
      : (isActive ? '#ffffff' : 'rgba(255, 255, 255, 0.85)');
    const labelStrokeColor = isLightTheme
      ? 'rgba(255, 255, 255, 0.95)'
      : 'rgba(2, 8, 23, 0.82)';
    // 标签位置：节点下方
    const labelOffset = (glowColor ? glowRadius : baseRadius) + 8;
    ctx.lineJoin = 'round';
    ctx.strokeStyle = labelStrokeColor;
    ctx.lineWidth = (isActive ? 3.1 : 2.4) / globalScale;
    ctx.strokeText(label, node.x, node.y + labelOffset);
    ctx.fillStyle = labelFillColor;

    ctx.fillText(label, node.x, node.y + labelOffset);
  }, [selectedNode, hoveredNode, isLightTheme, labelMode]);

  const paintNodePointerArea = useCallback((node: any, color: string, ctx: CanvasRenderingContext2D) => {
    const nodeScale = getKnowledgeNodeScale({
      metadata: node.metadata,
      degree: node.graphDegree,
      focused: selectedNode?.id === node.id || hoveredNode?.id === node.id,
    });
    ctx.fillStyle = color;
    drawShape(ctx, node.nodeType, node.x, node.y, nodeScale.radius + 8);
  }, [hoveredNode?.id, selectedNode?.id]);

  // 3. 自定义连线渲染
  const paintLink = useCallback((link: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
    const source = link.source;
    const target = link.target;

    // 确保 source 和 target 是已解析的节点对象（带有坐标）
    if (typeof source !== 'object' || typeof target !== 'object') return;
    if (source.x === undefined || source.y === undefined) return;
    if (target.x === undefined || target.y === undefined) return;

    const style = getRelationStyle(link.relationType || link.relation);
    const strokeColor = isLightTheme ? style.lightColor : style.darkColor;
    const strength = typeof link.strength === 'number'
      ? Math.min(1, Math.max(0, link.strength))
      : 1;
    const focusNodeId = hoveredNode?.id ?? selectedNode?.id ?? null;
    const focusState = getRelationFocusState(source.id, target.id, focusNodeId);
    const focusOpacity = focusState === 'dimmed'
      ? KNOWLEDGE_GRAPH_SEMANTIC_MAP_CONTRACT.dimmedNeighborhoodOpacity
      : focusState === 'active'
        ? KNOWLEDGE_GRAPH_SEMANTIC_MAP_CONTRACT.activeEdgeOpacity
        : KNOWLEDGE_GRAPH_SEMANTIC_MAP_CONTRACT.neutralEdgeOpacity;
    const alpha = (0.16 + strength * 0.44) * focusOpacity * style.opacity;
    const lineWidth = getKnowledgeGraphEffectiveEdgeWidth(style, strength, focusState, '2d');

    const dx = target.x - source.x;
    const dy = target.y - source.y;
    const distance = Math.hypot(dx, dy) || 1;
    const controlX = (source.x + target.x) / 2 - (dy / distance) * distance * style.curvature;
    const controlY = (source.y + target.y) / 2 + (dx / distance) * distance * style.curvature;
    const isCurved = Math.abs(style.curvature) > 0.001;

    ctx.beginPath();
    ctx.moveTo(source.x, source.y);
    if (isCurved) {
      ctx.quadraticCurveTo(controlX, controlY, target.x, target.y);
    } else {
      ctx.lineTo(target.x, target.y);
    }

    ctx.strokeStyle = hexToRgba(strokeColor, alpha);
    ctx.setLineDash(style.dash.map(d => d / globalScale));
    ctx.lineWidth = lineWidth / globalScale;
    ctx.stroke();

    // 绘制箭头（对于有方向的关系）
    if (style.hasArrow) {
      if (isCurved) {
        const arrowPoint = getQuadraticPoint(source.x, source.y, controlX, controlY, target.x, target.y, 0.65);
        const arrowAngle = getQuadraticTangentAngle(source.x, source.y, controlX, controlY, target.x, target.y, 0.65);
        drawArrowHead(ctx, arrowPoint.x, arrowPoint.y, arrowAngle, globalScale, hexToRgba(strokeColor, alpha));
      } else {
        drawArrow(ctx, source.x, source.y, target.x, target.y, globalScale, hexToRgba(strokeColor, alpha));
      }
    }

    const endpointPoint = isCurved
      ? getQuadraticPoint(source.x, source.y, controlX, controlY, target.x, target.y, 0.82)
      : {
          x: source.x + (target.x - source.x) * 0.82,
          y: source.y + (target.y - source.y) * 0.82,
        };
    const endpointAngle = isCurved
      ? getQuadraticTangentAngle(source.x, source.y, controlX, controlY, target.x, target.y, 1)
      : Math.atan2(target.y - source.y, target.x - source.x);
    drawEndpointMarker(ctx, style.endpoint, endpointPoint.x, endpointPoint.y, endpointAngle, globalScale, hexToRgba(strokeColor, alpha));

    // 重置虚线设置
    ctx.setLineDash([]);
  }, [hoveredNode?.id, isLightTheme, selectedNode?.id]);

  const handleNodeDragEnd = useCallback((node: any) => {
    rememberRuntimeNodePosition(node as RuntimeKnowledgeGraphNode);
    onNodeDragEnd(node as KnowledgeNodeData);
  }, [onNodeDragEnd, rememberRuntimeNodePosition]);

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
    if (fitViewVersion === 0 || !fgRef.current?.zoomToFit) return;
    window.setTimeout(() => {
      fgRef.current?.zoomToFit?.(320, 48);
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
      const targetCenter = fgRef.current.screen2GraphCoords(
        viewportWidth / 2 - reveal.x,
        viewportHeight / 2 - reveal.y
      );
      const targetX = Number(targetCenter?.x);
      const targetY = Number(targetCenter?.y);
      if (!Number.isFinite(targetX) || !Number.isFinite(targetY)) return;
      fgRef.current.centerAt(targetX, targetY, 240);
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

  return (
    <ForceGraph2D
      ref={fgRef}
      width={width}
      height={height}
      graphData={graphData}

      // 节点渲染
      nodeCanvasObject={paintNode}
      nodePointerAreaPaint={paintNodePointerArea}
      nodeLabel="name"

      // 连线渲染
      linkCanvasObject={paintLink}
      linkCanvasObjectMode={() => 'replace'}

      // 背景透明
      backgroundColor="rgba(0,0,0,0)"

      // 交互
      onNodeClick={onNodeClick}
      onNodeHover={onNodeHover}
      onNodeDragEnd={handleNodeDragEnd}
      onEngineStop={snapshotRuntimePositions}
      enableNodeDrag={true}

      // 物理引擎配置
      d3VelocityDecay={0.3}
      warmupTicks={20}
      cooldownTicks={50}
    />
  );
}
