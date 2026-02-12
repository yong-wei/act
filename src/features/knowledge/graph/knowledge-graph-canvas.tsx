'use client';

/**
 * KnowledgeGraphCanvas - 3D 知识图谱画布
 *
 * 使用 react-force-graph-3d 实现的力导向 3D 知识图谱
 * 支持自动布局、手动拖拽、节点标签始终显示
 */

import { useRef, useCallback, useMemo, useEffect } from 'react';
import ForceGraph3D from 'react-force-graph-3d';
import * as THREE from 'three';
import type { KnowledgeNodeData, KnowledgeLinkData } from '../knowledge-graph-system';
import {
  getNodeColor,
  getGlowColor,
  getRelationStyle,
  getNodeTypeConfig,
} from './visual-config';

interface KnowledgeGraphCanvasProps {
  nodes: KnowledgeNodeData[];
  links: KnowledgeLinkData[];
  selectedNode: KnowledgeNodeData | null;
  hoveredNode: KnowledgeNodeData | null;
  onNodeClick: (node: KnowledgeNodeData) => void;
  onNodeHover: (node: KnowledgeNodeData | null) => void;
}

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
function createTextSprite(text: string): THREE.Sprite {
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
  ctx.fillStyle = 'white';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // 添加描边增强可读性
  ctx.strokeStyle = 'rgba(9, 21, 64, 0.8)';
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
}: KnowledgeGraphCanvasProps) {
  const fgRef = useRef<any>();

  // 1. 处理数据并转换 links 格式
  const graphData = useMemo(() => {
    // 转换 links: sourceId/targetId -> source/target (ForceGraph3D 格式)
    const transformedLinks = links.map(l => ({
      ...l,
      source: l.sourceId,
      target: l.targetId,
    }));

    return {
      nodes: nodes.map(n => ({ ...n })),
      links: transformedLinks
    };
  }, [nodes, links]);

  // 2. 创建自定义节点 3D 对象
  const createNodeObject = useCallback((node: any) => {
    const group = new THREE.Group();

    // 获取颜色配置
    const fillColor = getNodeColor(node.knowledgeDim);
    const glowColor = getGlowColor(node.bloomLevel);
    const isSelected = selectedNode?.id === node.id;
    const isHovered = hoveredNode?.id === node.id;
    const isActive = isSelected || isHovered;

    // 1. 创建节点几何体
    const geometry = createGeometryByType(node.nodeType);

    // 2. 创建材质（带发光效果）
    const material = new THREE.MeshPhongMaterial({
      color: new THREE.Color(fillColor),
      emissive: glowColor ? new THREE.Color(glowColor) : new THREE.Color(fillColor),
      emissiveIntensity: glowColor ? (isActive ? 0.8 : 0.5) : (isActive ? 0.4 : 0.2),
      transparent: true,
      opacity: isActive ? 1 : 0.9,
      shininess: 100,
    });

    const mesh = new THREE.Mesh(geometry, material);
    group.add(mesh);

    // 3. 创建辉光层（如果有 bloomLevel）
    if (glowColor) {
      const glowGeometry = new THREE.SphereGeometry(7, 16, 16);
      const glowMaterial = new THREE.MeshBasicMaterial({
        color: new THREE.Color(glowColor),
        transparent: true,
        opacity: isActive ? 0.3 : 0.15,
      });
      const glowMesh = new THREE.Mesh(glowGeometry, glowMaterial);
      group.add(glowMesh);
    }

    // 4. 创建选中环
    if (isSelected) {
      const ringGeometry = new THREE.RingGeometry(6, 7, 32);
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

    // 5. 创建标签（始终显示）
    const sprite = createTextSprite(node.name);
    sprite.position.set(0, 10, 0);
    group.add(sprite);

    return group;
  }, [selectedNode, hoveredNode]);

  // 3. 获取连线颜色
  const getLinkColor = useCallback((link: any) => {
    const style = getRelationStyle(link.relation);
    const strength = typeof link.strength === 'number'
      ? Math.min(1, Math.max(0, link.strength))
      : 1;
    const color = new THREE.Color(style.color);
    const gain = 0.55 + strength * 0.45;
    color.multiplyScalar(gain);
    return color.getStyle();
  }, []);

  // 4. 获取连线宽度
  const getLinkWidth = useCallback((link: any) => {
    const style = getRelationStyle(link.relation);
    const strength = typeof link.strength === 'number'
      ? Math.min(1, Math.max(0, link.strength))
      : 1;
    return style.width * (0.7 + strength) * 1.1;
  }, []);

  // 5. 配置物理引擎
  useEffect(() => {
    if (fgRef.current) {
      // 配置力导向参数（降低斥力使节点更紧凑）
      fgRef.current.d3Force('charge').strength(-80);
      fgRef.current.d3Force('link').distance(50);

      // 添加碰撞检测
      const d3 = require('d3');
      fgRef.current.d3Force('collide', d3.forceCollide(15).strength(0.8));
    }
  }, []);

  // 6. 节点点击处理
  const handleNodeClick = useCallback((node: any) => {
    onNodeClick(node as KnowledgeNodeData);
  }, [onNodeClick]);

  // 7. 节点悬停处理
  const handleNodeHover = useCallback((node: any) => {
    onNodeHover(node as KnowledgeNodeData | null);
  }, [onNodeHover]);

  return (
    <div className="relative h-full w-full">
      <ForceGraph3D
        ref={fgRef}
        graphData={graphData}

        // 节点渲染
        nodeThreeObject={createNodeObject}
        nodeThreeObjectExtend={false}

        // 连线渲染
        linkColor={getLinkColor}
        linkWidth={getLinkWidth}
        linkOpacity={0.62}

        // 交互
        onNodeClick={handleNodeClick}
        onNodeHover={handleNodeHover}
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
