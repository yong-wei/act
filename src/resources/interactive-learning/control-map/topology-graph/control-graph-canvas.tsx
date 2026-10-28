'use client';

import { useCallback, useMemo, useEffect, useRef, type RefObject } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  useReactFlow,
  ConnectionLineType,
  type Node,
  type Edge,
  type OnNodesChange,
  type OnEdgesChange,
  type NodeTypes,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { useOptionalTheme } from '@/components/providers/theme-provider';
import { ControlNode, type ControlNodeType } from './control-node';
import { controlTheoryNodes, controlTheoryEdges, getRelatedNodes } from '../data/control-theory-nodes';
import { isControlNodeVisible } from '../control-map-filters';
import { zoneConfigs, type ViewState } from '../types';

interface ControlGraphCanvasProps {
  viewState: ViewState;
  onNodeClick: (nodeId: string) => void;
  onNodeHover: (nodeId: string | null) => void;
  /** 变化时把画布移动到 `focusNodeId`。 */
  focusRequest?: { nodeId: string; sequence: number } | null;
  /** 详情面板所在的右侧浮层列；选中节点时画布会避开这块区域。 */
  detailAreaRef?: RefObject<HTMLElement | null>;
}

const REVEAL_MARGIN = 16;
const FOCUS_ZOOM_RANGE = { min: 0.9, max: 1.2 } as const;

// v12: nodeTypes 需要在组件外定义以保持引用稳定
const nodeTypes: NodeTypes = {
  controlNode: ControlNode,
};

const EDGE_COLOR = 'hsl(var(--platform-border-strong))';
const EDGE_HIGHLIGHT_COLOR = 'hsl(var(--platform-action-primary))';

export function ControlGraphCanvas({
  viewState,
  onNodeClick,
  onNodeHover,
  focusRequest,
  detailAreaRef,
}: ControlGraphCanvasProps) {
  const { selectedNode, hoveredNode } = viewState;
  const { getInternalNode, getViewport, setViewport, setCenter } = useReactFlow();
  const containerRef = useRef<HTMLDivElement>(null);
  // React Flow 会在根节点写入 light/dark 类；必须与应用主题一致，否则平台 token 在画布内取到另一套值。
  const colorMode = useOptionalTheme()?.theme ?? 'light';
  const focusNodeId = hoveredNode ?? selectedNode;

  const relatedNodeIds = useMemo(() => (focusNodeId ? getRelatedNodes(focusNodeId) : []), [focusNodeId]);

  const initialNodes: ControlNodeType[] = useMemo(() => {
    return controlTheoryNodes.map((node) => ({
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
        isDimmed: !isControlNodeVisible(node, viewState),
      },
    }));
  }, [selectedNode, hoveredNode, relatedNodeIds, viewState]);

  const initialEdges: Edge[] = useMemo(() => {
    return controlTheoryEdges.map((edge) => {
      const isHighlighted = focusNodeId !== null && (edge.source === focusNodeId || edge.target === focusNodeId);
      const isFaded = focusNodeId !== null && !isHighlighted;

      return {
        id: edge.id,
        source: edge.source,
        target: edge.target,
        type: 'default',
        animated: isHighlighted,
        zIndex: isHighlighted ? 1 : 0,
        style: {
          stroke: isHighlighted ? EDGE_HIGHLIGHT_COLOR : EDGE_COLOR,
          strokeWidth: isHighlighted ? 2 : 1.25,
          opacity: isHighlighted ? 1 : isFaded ? 0.18 : 0.55,
        },
        label: isHighlighted ? edge.relationCn : undefined,
        labelStyle: {
          fontSize: 10,
          fontWeight: 600,
          fill: EDGE_HIGHLIGHT_COLOR,
        },
        labelBgStyle: {
          fill: 'hsl(var(--platform-surface))',
          fillOpacity: 0.92,
        },
        labelBgPadding: [4, 2] as [number, number],
        labelBgBorderRadius: 4,
      };
    });
  }, [focusNodeId]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  useEffect(() => {
    setNodes(initialNodes);
    setEdges(initialEdges);
  }, [initialNodes, initialEdges, setNodes, setEdges]);

  /** 画布宽度，以及详情面板左缘之前可见区域的右边界（均为相对画布的屏幕像素）。 */
  const measureVisibleArea = useCallback(() => {
    const container = containerRef.current;
    if (!container) return null;
    const bounds = container.getBoundingClientRect();
    const detail = detailAreaRef?.current?.getBoundingClientRect();
    const right =
      detail && detail.left > bounds.left ? detail.left - bounds.left - REVEAL_MARGIN : bounds.width - REVEAL_MARGIN;
    return { width: bounds.width, right };
  }, [detailAreaRef]);

  const measureNode = useCallback(
    (nodeId: string) => {
      const node = getInternalNode(nodeId);
      if (!node) return null;
      const { x, y } = node.internals.positionAbsolute;
      return { x, y, width: node.measured.width ?? 0, height: node.measured.height ?? 0 };
    },
    [getInternalNode]
  );

  /** 把节点居中到详情面板左侧的可见区域。 */
  const centerNode = useCallback(
    (nodeId: string) => {
      const node = measureNode(nodeId);
      const area = measureVisibleArea();
      if (!node || !area) return;
      const zoom = Math.min(Math.max(getViewport().zoom, FOCUS_ZOOM_RANGE.min), FOCUS_ZOOM_RANGE.max);
      const shift = (area.width - area.right) / 2 / zoom;
      void setCenter(node.x + node.width / 2 + shift, node.y + node.height / 2, { zoom, duration: 400 });
    },
    [getViewport, measureNode, measureVisibleArea, setCenter]
  );

  /** 节点会被详情面板挡住时，只平移到恰好露出，不改变缩放。 */
  const revealNode = useCallback(
    (nodeId: string) => {
      const node = measureNode(nodeId);
      const area = measureVisibleArea();
      if (!node || !area) return;
      const viewport = getViewport();
      const left = node.x * viewport.zoom + viewport.x;
      const right = (node.x + node.width) * viewport.zoom + viewport.x;
      const shift = Math.min(right - area.right, left - REVEAL_MARGIN);
      if (shift <= 0) return;
      void setViewport({ ...viewport, x: viewport.x - shift }, { duration: 300 });
    },
    [getViewport, measureNode, measureVisibleArea, setViewport]
  );

  useEffect(() => {
    if (focusRequest) centerNode(focusRequest.nodeId);
  }, [centerNode, focusRequest]);

  const handleNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      onNodeClick(node.id);
      revealNode(node.id);
    },
    [onNodeClick, revealNode]
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

  const nodeColor = useCallback((node: ControlNodeType) => {
    return zoneConfigs[node.data.zone].color;
  }, []);

  return (
    <div ref={containerRef} className="h-full w-full">
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
        colorMode={colorMode}
        connectionLineType={ConnectionLineType.Bezier}
        fitView
        fitViewOptions={{ padding: 0.18 }}
        minZoom={0.3}
        maxZoom={2}
        className="bg-platform-canvas"
      >
        <Background color="hsl(var(--platform-border-strong) / 0.55)" gap={22} size={1} />
        <Controls
          showInteractive={false}
          className="!m-3 overflow-hidden !rounded-lg !border !border-platform-border !shadow-sm [&>button]:!border-platform-border [&>button]:!bg-platform-surface [&>button]:!fill-platform-fg-secondary [&>button:hover]:!bg-platform-action-subtle"
        />
        <MiniMap
          position="bottom-left"
          style={{ marginLeft: '3.75rem' }}
          pannable
          zoomable
          nodeColor={nodeColor}
          nodeBorderRadius={3}
          bgColor="hsl(var(--platform-surface))"
          maskColor="hsl(var(--platform-canvas) / 0.72)"
          className="!m-3 overflow-hidden !rounded-lg !border !border-platform-border !shadow-sm"
        />
      </ReactFlow>
    </div>
  );
}
