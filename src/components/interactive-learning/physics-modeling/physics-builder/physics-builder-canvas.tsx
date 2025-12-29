'use client';

/**
 * 物理建模画布
 * Physics Builder Canvas with React Flow
 */

import { useCallback, useRef, useMemo, useState } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  Connection,
  Edge,
  ReactFlowProvider,
  ReactFlowInstance,
} from 'reactflow';
import 'reactflow/dist/style.css';

import { ComponentSidebar } from './component-sidebar';
import { EquationDisplay } from './equation-display';
import { nodeTypes } from './physics-node';
import {
  generateMechanicalEquation,
  generateCircuitEquation,
  validateMechanicalEquation,
  validateCircuitEquation,
} from '../utils/equation-generator';
import type {
  BuilderMode,
  PhysicsNode,
  PhysicsEdge,
  PhysicsNodeData,
  ComponentType,
} from '../types';
import {
  MECHANICAL_COMPONENTS,
  ELECTRICAL_COMPONENTS,
} from '../types';

interface PhysicsBuilderCanvasProps {
  mode: BuilderMode;
  targetEquation?: string;
  onModelChange?: (nodes: PhysicsNode[], edges: PhysicsEdge[]) => void;
  onEquationChange?: (equation: string, isComplete: boolean) => void;
  initialNodes?: PhysicsNode[];
  initialEdges?: PhysicsEdge[];
}

let nodeId = 0;
const getNodeId = () => `node_${nodeId++}`;

export function PhysicsBuilderCanvas({
  mode,
  targetEquation,
  onModelChange,
  onEquationChange,
  initialNodes = [],
  initialEdges = [],
}: PhysicsBuilderCanvasProps) {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [reactFlowInstance, setReactFlowInstance] = useState<ReactFlowInstance | null>(
    null
  );
  const [nodes, setNodes, onNodesChange] = useNodesState<PhysicsNodeData>(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // 计算当前方程
  const { equation, isComplete, missing } = useMemo(() => {
    const eq =
      mode === 'mechanical'
        ? generateMechanicalEquation(nodes, edges)
        : generateCircuitEquation(nodes, edges);

    const validation =
      mode === 'mechanical'
        ? validateMechanicalEquation(nodes, targetEquation || '')
        : validateCircuitEquation(nodes, targetEquation || '');

    return {
      equation: eq,
      isComplete: validation.isComplete,
      missing: validation.missing,
    };
  }, [nodes, edges, mode, targetEquation]);

  // 通知父组件方程变化
  useMemo(() => {
    onEquationChange?.(equation, isComplete);
  }, [equation, isComplete, onEquationChange]);

  // 处理连接
  const onConnect = useCallback(
    (connection: Connection) => {
      setEdges((eds) => addEdge(connection, eds));
    },
    [setEdges]
  );

  // 处理拖拽开始
  const onDragStart = useCallback(
    (event: React.DragEvent, componentType: ComponentType) => {
      event.dataTransfer.setData('application/reactflow', componentType);
      event.dataTransfer.effectAllowed = 'move';
    },
    []
  );

  // 处理拖拽放置
  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      const type = event.dataTransfer.getData('application/reactflow') as ComponentType;
      if (!type || !reactFlowInstance || !reactFlowWrapper.current) return;

      // 获取元件定义
      const components =
        mode === 'mechanical' ? MECHANICAL_COMPONENTS : ELECTRICAL_COMPONENTS;
      const componentDef = components.find((c) => c.type === type);
      if (!componentDef) return;

      // 计算放置位置
      const reactFlowBounds = reactFlowWrapper.current.getBoundingClientRect();
      const position = reactFlowInstance.project({
        x: event.clientX - reactFlowBounds.left,
        y: event.clientY - reactFlowBounds.top,
      });

      // 对齐到网格
      position.x = Math.round(position.x / 20) * 20;
      position.y = Math.round(position.y / 20) * 20;

      // 创建新节点
      const newNode: PhysicsNode = {
        id: getNodeId(),
        type: type,
        position,
        data: {
          type: type,
          params: { ...componentDef.defaultParams },
          label: componentDef.name,
          symbol: componentDef.symbol,
        },
      };

      setNodes((nds) => [...nds, newNode]);
      onModelChange?.([...nodes, newNode], edges);
    },
    [reactFlowInstance, mode, setNodes, nodes, edges, onModelChange]
  );

  // 节点变化回调
  const handleNodesChange = useCallback(
    (changes: Parameters<typeof onNodesChange>[0]) => {
      onNodesChange(changes);
      // 延迟通知，避免频繁调用
      setTimeout(() => {
        onModelChange?.(nodes, edges);
      }, 0);
    },
    [onNodesChange, nodes, edges, onModelChange]
  );

  return (
    <div className="flex h-full w-full">
      {/* 元件侧边栏 */}
      <ComponentSidebar mode={mode} onDragStart={onDragStart} />

      {/* 主画布区域 */}
      <div className="flex flex-1 flex-col">
        {/* React Flow 画布 */}
        <div
          ref={reactFlowWrapper}
          className="flex-1 bg-slate-950"
          onDrop={onDrop}
          onDragOver={onDragOver}
        >
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={handleNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onInit={setReactFlowInstance}
            nodeTypes={nodeTypes}
            snapToGrid
            snapGrid={[20, 20]}
            fitView
            attributionPosition="bottom-left"
            className="bg-slate-950"
          >
            <Background color="#334155" gap={20} size={1} />
            <Controls className="!bg-slate-800 !border-slate-700 [&>button]:!bg-slate-800 [&>button]:!border-slate-700 [&>button]:!text-slate-300 [&>button:hover]:!bg-slate-700" />
            <MiniMap
              nodeColor={(node) => {
                const type = node.data?.type;
                if (type === 'mass' || type === 'inductor') return '#f59e0b';
                if (type === 'spring' || type === 'capacitor') return '#22c55e';
                if (type === 'damper' || type === 'resistor') return '#ef4444';
                return '#64748b';
              }}
              className="!bg-slate-900 !border-slate-700"
              maskColor="rgba(15, 23, 42, 0.8)"
            />
          </ReactFlow>
        </div>

        {/* 方程显示区域 */}
        <div className="border-t border-slate-800 bg-slate-900/50 p-4">
          <EquationDisplay
            equation={equation}
            isComplete={isComplete}
            missing={missing}
            targetEquation={targetEquation}
          />
        </div>
      </div>
    </div>
  );
}

/** 包装器：提供 ReactFlowProvider */
export function PhysicsBuilder(props: PhysicsBuilderCanvasProps) {
  return (
    <ReactFlowProvider>
      <PhysicsBuilderCanvas {...props} />
    </ReactFlowProvider>
  );
}
