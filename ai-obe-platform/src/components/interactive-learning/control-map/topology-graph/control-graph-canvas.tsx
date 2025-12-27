'use client';

import { useCallback, useMemo } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  type OnNodesChange,
  type OnEdgesChange,
  ConnectionLineType,
} from 'reactflow';
import 'reactflow/dist/style.css';

import { ControlNode, type ControlNodeData } from './control-node';
import { controlTheoryNodes, controlTheoryEdges, getRelatedNodes } from '../data/control-theory-nodes';
import { zoneConfigs, type ViewState } from '../types';

interface ControlGraphCanvasProps {
  viewState: ViewState;
  onNodeClick: (nodeId: string) => void;
  onNodeHover: (nodeId: string | null) => void;
}

const nodeTypes = {
  controlNode: ControlNode,
};

export function ControlGraphCanvas({
  viewState,
  onNodeClick,
  onNodeHover,
}: ControlGraphCanvasProps) {
  const { selectedNode, hoveredNode, searchQuery, showTimeDomain, showFreqDomain, showContinuous, showDiscrete } = viewState;

  // 获取高亮的相关节点
  const relatedNodeIds = useMemo(() => {
    if (hoveredNode) return getRelatedNodes(hoveredNode);
    if (selectedNode) return getRelatedNodes(selectedNode);
    return [];
  }, [hoveredNode, selectedNode]);

  // 构建节点
  const initialNodes: Node<ControlNodeData>[] = useMemo(() => {
    return controlTheoryNodes.map((node) => {
      // 检查是否应该显示
      const matchesDomain =
        (showTimeDomain && (node.domain === 'time' || node.domain === 'both')) ||
        (showFreqDomain && (node.domain === 'frequency' || node.domain === 'both'));

      const matchesTime =
        (showContinuous && (node.timeType === 'continuous' || node.timeType === 'both')) ||
        (showDiscrete && (node.timeType === 'discrete' || node.timeType === 'both'));

      const matchesSearch = searchQuery
        ? node.nameCn.includes(searchQuery) ||
          node.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          node.definition.includes(searchQuery)
        : true;

      const isVisible = matchesDomain && matchesTime && matchesSearch;
      const isDimmed = !isVisible;

      return {
        id: node.id,
        type: 'controlNode',
        position: node.position,
        data: {
          nameCn: node.nameCn,
          name: node.name,
          zone: node.zone,
          importance: node.importance,
          isSelected: selectedNode === node.id,
          isHovered: hoveredNode === node.id,
          isRelated: relatedNodeIds.includes(node.id),
          isDimmed,
        },
      };
    });
  }, [selectedNode, hoveredNode, relatedNodeIds, searchQuery, showTimeDomain, showFreqDomain, showContinuous, showDiscrete]);

  // 构建边
  const initialEdges: Edge[] = useMemo(() => {
    return controlTheoryEdges.map((edge) => {
      const isHighlighted =
        edge.source === selectedNode ||
        edge.target === selectedNode ||
        edge.source === hoveredNode ||
        edge.target === hoveredNode;

      return {
        id: edge.id,
        source: edge.source,
        target: edge.target,
        type: 'smoothstep',
        animated: isHighlighted,
        style: {
          stroke: isHighlighted ? '#f59e0b' : '#475569',
          strokeWidth: isHighlighted ? 2 : 1,
          opacity: isHighlighted ? 1 : 0.5,
        },
        label: isHighlighted ? edge.relationCn : undefined,
        labelStyle: {
          fontSize: 10,
          fill: '#f59e0b',
        },
        labelBgStyle: {
          fill: '#1e293b',
          fillOpacity: 0.9,
        },
      };
    });
  }, [selectedNode, hoveredNode]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // 更新节点
  useMemo(() => {
    setNodes(initialNodes);
    setEdges(initialEdges);
  }, [initialNodes, initialEdges, setNodes, setEdges]);

  const handleNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      onNodeClick(node.id);
    },
    [onNodeClick]
  );

  const handleNodeMouseEnter = useCallback(
    (_: React.MouseEvent, node: Node) => {
      onNodeHover(node.id);
    },
    [onNodeHover]
  );

  const handleNodeMouseLeave = useCallback(() => {
    onNodeHover(null);
  }, [onNodeHover]);

  const handlePaneClick = useCallback(() => {
    onNodeClick('');
  }, [onNodeClick]);

  // MiniMap节点颜色
  const nodeColor = useCallback((node: Node<ControlNodeData>) => {
    return zoneConfigs[node.data.zone].color;
  }, []);

  return (
    <div className="h-full w-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange as OnNodesChange}
        onEdgesChange={onEdgesChange as OnEdgesChange}
        onNodeClick={handleNodeClick}
        onNodeMouseEnter={handleNodeMouseEnter}
        onNodeMouseLeave={handleNodeMouseLeave}
        onPaneClick={handlePaneClick}
        nodeTypes={nodeTypes}
        connectionLineType={ConnectionLineType.SmoothStep}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.3}
        maxZoom={2}
        className="bg-slate-950"
      >
        <Background color="#334155" gap={20} size={1} />
        <Controls
          className="!border-slate-700 !bg-slate-800/90 [&>button]:!border-slate-700 [&>button]:!bg-slate-800 [&>button]:!text-slate-300 [&>button:hover]:!bg-slate-700"
        />
        <MiniMap
          nodeColor={nodeColor}
          maskColor="rgba(15, 23, 42, 0.8)"
          className="!border-slate-700 !bg-slate-900/90"
        />
      </ReactFlow>
    </div>
  );
}
