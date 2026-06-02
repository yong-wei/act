'use client';

import React, { useCallback, useEffect, useRef, useMemo, useState } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import * as d3 from 'd3';
import { KnowledgeNodeData, KnowledgeLinkData } from '../knowledge-graph-system';
import { applyRadialLayout } from './layout-engine';
import {
  getNodeColor,
  getGlowColor,
  getRelationStyle,
  getNodeTypeConfig,
  hexToRgba,
} from './visual-config';
import {
  shouldRenderKnowledgeNodeLabel,
  type KnowledgeGraphLabelMode,
} from './label-policy';

interface KnowledgeGraph2DProps {
  nodes: KnowledgeNodeData[];
  links: KnowledgeLinkData[];
  selectedNode: KnowledgeNodeData | null;
  hoveredNode: KnowledgeNodeData | null;
  onNodeClick: (node: KnowledgeNodeData) => void;
  onNodeHover: (node: KnowledgeNodeData | null) => void;
  width?: number;
  height?: number;
  labelMode: KnowledgeGraphLabelMode;
}

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

export function KnowledgeGraph2D({
  nodes,
  links,
  selectedNode,
  hoveredNode,
  onNodeClick,
  onNodeHover,
  width,
  height,
  labelMode,
}: KnowledgeGraph2DProps) {
  const fgRef = useRef<any>(null);
  const [isLightTheme, setIsLightTheme] = useState(false);

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

  // 1. 处理数据并应用布局
  const graphData = useMemo(() => {
    const clonedNodes = nodes.map(n => ({ ...n }));

    // 转换 links: sourceId/targetId -> source/target (ForceGraph2D 格式)
    const transformedLinks = links.map(l => ({
      ...l,
      source: l.sourceId,
      target: l.targetId,
    }));

    // 应用辐射布局
    const layoutNodes = applyRadialLayout(clonedNodes, links, undefined, 180);

    return {
      nodes: layoutNodes,
      links: transformedLinks
    };
  }, [nodes, links]);

  // 2. 自定义节点渲染
  const paintNode = useCallback((node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
    // 获取颜色配置
    const fillColor = getNodeColor(node.knowledgeDim);
    const glowColor = getGlowColor(node.bloomLevel);

    // 高亮状态
    const isSelected = selectedNode?.id === node.id;
    const isHovered = hoveredNode?.id === node.id;
    const isActive = isSelected || isHovered;

    // 节点尺寸
    const baseRadius = isActive ? 8 : 5;
    const glowRadius = isActive ? 22 : 14;

    // 绘制辉光（如果有 bloomLevel）
    if (glowColor) {
      ctx.fillStyle = hexToRgba(glowColor, isActive ? 0.4 : 0.25);
      drawShape(ctx, node.nodeType, node.x, node.y, glowRadius);
    }

    // 绘制节点核心
    ctx.fillStyle = fillColor;
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

  // 3. 自定义连线渲染
  const paintLink = useCallback((link: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
    const source = link.source;
    const target = link.target;

    // 确保 source 和 target 是已解析的节点对象（带有坐标）
    if (typeof source !== 'object' || typeof target !== 'object') return;
    if (source.x === undefined || source.y === undefined) return;
    if (target.x === undefined || target.y === undefined) return;

    const style = getRelationStyle(link.relation);
    const strength = typeof link.strength === 'number'
      ? Math.min(1, Math.max(0, link.strength))
      : 1;
    const alpha = 0.2 + strength * 0.65;
    const lineWidth = style.width * (0.6 + strength * 0.9);

    ctx.beginPath();
    ctx.moveTo(source.x, source.y);
    ctx.lineTo(target.x, target.y);

    ctx.strokeStyle = hexToRgba(style.color, alpha);
    ctx.setLineDash(style.dash.map(d => d / globalScale));
    ctx.lineWidth = lineWidth / globalScale;
    ctx.stroke();

    // 绘制箭头（对于有方向的关系）
    if (style.hasArrow) {
      drawArrow(ctx, source.x, source.y, target.x, target.y, globalScale, hexToRgba(style.color, alpha));
    }

    // 重置虚线设置
    ctx.setLineDash([]);
  }, []);

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

  return (
    <ForceGraph2D
      ref={fgRef}
      width={width}
      height={height}
      graphData={graphData}

      // 节点渲染
      nodeCanvasObject={paintNode}
      nodeLabel="name"

      // 连线渲染
      linkCanvasObject={paintLink}
      linkCanvasObjectMode={() => 'replace'}

      // 背景透明
      backgroundColor="rgba(0,0,0,0)"

      // 交互
      onNodeClick={onNodeClick}
      onNodeHover={onNodeHover}

      // 物理引擎配置
      d3VelocityDecay={0.3}
      warmupTicks={20}
      cooldownTicks={50}
    />
  );
}
