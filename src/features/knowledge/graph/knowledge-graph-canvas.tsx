'use client';

/**
 * KnowledgeGraphCanvas - 3D 知识图谱画布
 *
 * 使用 React Three Fiber 实现的 3D 知识图谱
 */

import { useRef, useState, useCallback, useMemo } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Line, Text } from '@react-three/drei';
import * as THREE from 'three';
import { ZoomIn, ZoomOut, RotateCcw, Maximize2, Target, Crosshair } from 'lucide-react';
import type { KnowledgeNodeData, KnowledgeLinkData, NodeType } from '../knowledge-graph-system';

// 节点颜色映射
const NODE_COLORS: Record<NodeType, string> = {
  THEORY: '#4f86c6',   // 蓝色 - 控制理论
  SCENARIO: '#f5544f', // 红色 - 船舶场景
  ETHICS: '#50c38a',   // 绿色 - 伦理决策
};

interface GraphNodeProps {
  node: KnowledgeNodeData;
  isSelected: boolean;
  isHovered: boolean;
  onClick: () => void;
  onPointerOver: () => void;
  onPointerOut: () => void;
}

// 单个节点组件
function GraphNode({
  node,
  isSelected,
  isHovered,
  onClick,
  onPointerOver,
  onPointerOut,
}: GraphNodeProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const color = NODE_COLORS[node.nodeType];

  // 节点动画
  useFrame((state) => {
    if (meshRef.current) {
      // 悬停或选中时轻微放大
      const scale = isHovered || isSelected ? 1.3 : 1;
      meshRef.current.scale.lerp(new THREE.Vector3(scale, scale, scale), 0.1);

      // 轻微浮动动画
      if (isSelected) {
        meshRef.current.position.y =
          node.positionY + Math.sin(state.clock.elapsedTime * 2) * 0.5;
      }
    }
  });

  // 根据类型选择几何体
  const geometry = useMemo(() => {
    switch (node.nodeType) {
      case 'THEORY':
        return <sphereGeometry args={[1.5, 32, 32]} />;
      case 'SCENARIO':
        return <boxGeometry args={[2.5, 2.5, 2.5]} />;
      case 'ETHICS':
        return <icosahedronGeometry args={[2, 0]} />;
      default:
        return <sphereGeometry args={[1.5, 32, 32]} />;
    }
  }, [node.nodeType]);

  return (
    <group position={[node.positionX, node.positionY, node.positionZ]}>
      {/* 主节点 */}
      <mesh
        ref={meshRef}
        onClick={onClick}
        onPointerOver={onPointerOver}
        onPointerOut={onPointerOut}
      >
        {geometry}
        <meshPhongMaterial
          color={color}
          transparent
          opacity={isHovered || isSelected ? 1 : 0.8}
          emissive={color}
          emissiveIntensity={isHovered || isSelected ? 0.7 : 0.3}
        />
      </mesh>

      {/* 发光效果 */}
      <mesh>
        <sphereGeometry args={[2.5, 32, 32]} />
        <meshBasicMaterial color={color} transparent opacity={0.15} />
      </mesh>

      {/* 节点标签 */}
      {(isHovered || isSelected) && (
        <Text
          position={[0, 4, 0]}
          fontSize={1.5}
          color="white"
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.1}
          outlineColor="#091540"
        >
          {node.name}
        </Text>
      )}
    </group>
  );
}

interface GraphLinkProps {
  link: KnowledgeLinkData;
  sourceNode: KnowledgeNodeData;
  targetNode: KnowledgeNodeData;
}

// 连接线组件
function GraphLink({ link, sourceNode, targetNode }: GraphLinkProps) {
  const points = useMemo(() => {
    return [
      new THREE.Vector3(sourceNode.positionX, sourceNode.positionY, sourceNode.positionZ),
      new THREE.Vector3(targetNode.positionX, targetNode.positionY, targetNode.positionZ),
    ];
  }, [sourceNode, targetNode]);

  // 根据连接的节点类型确定颜色
  const color = useMemo(() => {
    if (sourceNode.nodeType === 'ETHICS' || targetNode.nodeType === 'ETHICS') {
      return NODE_COLORS.ETHICS;
    } else if (sourceNode.nodeType === 'SCENARIO' || targetNode.nodeType === 'SCENARIO') {
      return NODE_COLORS.SCENARIO;
    }
    return NODE_COLORS.THEORY;
  }, [sourceNode.nodeType, targetNode.nodeType]);

  return (
    <Line
      points={points}
      color={color}
      lineWidth={1}
      transparent
      opacity={0.4}
    />
  );
}

interface GraphSceneProps {
  nodes: KnowledgeNodeData[];
  links: KnowledgeLinkData[];
  selectedNode: KnowledgeNodeData | null;
  hoveredNode: KnowledgeNodeData | null;
  onNodeClick: (node: KnowledgeNodeData) => void;
  onNodeHover: (node: KnowledgeNodeData | null) => void;
}

// 图谱场景
function GraphScene({
  nodes,
  links,
  selectedNode,
  hoveredNode,
  onNodeClick,
  onNodeHover,
}: GraphSceneProps) {
  // 创建节点映射
  const nodeMap = useMemo(() => {
    return new Map(nodes.map((node) => [node.id, node]));
  }, [nodes]);

  return (
    <>
      {/* 环境光 */}
      <ambientLight intensity={0.4} />
      <directionalLight position={[10, 10, 10]} intensity={0.8} />

      {/* 渲染连接线 */}
      {links.map((link) => {
        const sourceNode = nodeMap.get(link.sourceId);
        const targetNode = nodeMap.get(link.targetId);
        if (!sourceNode || !targetNode) return null;

        return (
          <GraphLink
            key={link.id}
            link={link}
            sourceNode={sourceNode}
            targetNode={targetNode}
          />
        );
      })}

      {/* 渲染节点 */}
      {nodes.map((node) => (
        <GraphNode
          key={node.id}
          node={node}
          isSelected={selectedNode?.id === node.id}
          isHovered={hoveredNode?.id === node.id}
          onClick={() => onNodeClick(node)}
          onPointerOver={() => onNodeHover(node)}
          onPointerOut={() => onNodeHover(null)}
        />
      ))}

      {/* 轨道控制器 */}
      <OrbitControls
        enableDamping
        dampingFactor={0.05}
        minDistance={30}
        maxDistance={200}
      />
    </>
  );
}

interface CameraControllerProps {
  view: 'macro' | 'meso' | 'micro';
}

// 相机控制器
function CameraController({ view }: CameraControllerProps) {
  const { camera } = useThree();

  useFrame(() => {
    let targetZ: number;
    switch (view) {
      case 'macro':
        targetZ = 150;
        break;
      case 'meso':
        targetZ = 100;
        break;
      case 'micro':
        targetZ = 50;
        break;
      default:
        targetZ = 100;
    }

    camera.position.z = THREE.MathUtils.lerp(camera.position.z, targetZ, 0.05);
  });

  return null;
}

interface KnowledgeGraphCanvasProps {
  nodes: KnowledgeNodeData[];
  links: KnowledgeLinkData[];
  selectedNode: KnowledgeNodeData | null;
  hoveredNode: KnowledgeNodeData | null;
  onNodeClick: (node: KnowledgeNodeData) => void;
  onNodeHover: (node: KnowledgeNodeData | null) => void;
}

export function KnowledgeGraphCanvas({
  nodes,
  links,
  selectedNode,
  hoveredNode,
  onNodeClick,
  onNodeHover,
}: KnowledgeGraphCanvasProps) {
  const [view, setView] = useState<'macro' | 'meso' | 'micro'>('meso');

  const handleZoomIn = useCallback(() => {
    setView((prev) => (prev === 'macro' ? 'meso' : prev === 'meso' ? 'micro' : 'micro'));
  }, []);

  const handleZoomOut = useCallback(() => {
    setView((prev) => (prev === 'micro' ? 'meso' : prev === 'meso' ? 'macro' : 'macro'));
  }, []);

  const handleResetView = useCallback(() => {
    setView('meso');
  }, []);

  return (
    <div className="relative h-full w-full">
      <Canvas
        camera={{ position: [0, 0, 100], fov: 60 }}
        style={{
          background: 'radial-gradient(circle, rgba(9, 21, 64, 0.5) 0%, rgba(2, 7, 33, 0.9) 100%)',
        }}
      >
        <GraphScene
          nodes={nodes}
          links={links}
          selectedNode={selectedNode}
          hoveredNode={hoveredNode}
          onNodeClick={onNodeClick}
          onNodeHover={onNodeHover}
        />
        <CameraController view={view} />
      </Canvas>

      {/* 控制按钮 */}
      <div className="absolute bottom-5 left-1/2 flex -translate-x-1/2 transform items-center gap-2 rounded-full bg-[#091540]/70 px-4 py-2">
        <button
          onClick={handleZoomIn}
          className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-blue-500/15 hover:text-blue-400"
          title="放大"
        >
          <ZoomIn className="h-4 w-4" />
        </button>
        <button
          onClick={handleZoomOut}
          className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-blue-500/15 hover:text-blue-400"
          title="缩小"
        >
          <ZoomOut className="h-4 w-4" />
        </button>
        <button
          onClick={handleResetView}
          className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-blue-500/15 hover:text-blue-400"
          title="重置视图"
        >
          <RotateCcw className="h-4 w-4" />
        </button>
        <div className="mx-1 h-4 w-px bg-slate-600" />
        <button
          onClick={() => setView('macro')}
          className={`flex h-8 w-8 items-center justify-center rounded-full transition-colors ${
            view === 'macro' ? 'bg-blue-500/30 text-blue-400' : 'text-slate-400 hover:bg-blue-500/15 hover:text-blue-400'
          }`}
          title="宏观视图"
        >
          <Maximize2 className="h-4 w-4" />
        </button>
        <button
          onClick={() => setView('meso')}
          className={`flex h-8 w-8 items-center justify-center rounded-full transition-colors ${
            view === 'meso' ? 'bg-blue-500/30 text-blue-400' : 'text-slate-400 hover:bg-blue-500/15 hover:text-blue-400'
          }`}
          title="中观视图"
        >
          <Target className="h-4 w-4" />
        </button>
        <button
          onClick={() => setView('micro')}
          className={`flex h-8 w-8 items-center justify-center rounded-full transition-colors ${
            view === 'micro' ? 'bg-blue-500/30 text-blue-400' : 'text-slate-400 hover:bg-blue-500/15 hover:text-blue-400'
          }`}
          title="微观视图"
        >
          <Crosshair className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
