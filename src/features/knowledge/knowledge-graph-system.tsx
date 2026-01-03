'use client';

/**
 * KnowledgeGraphSystem - 船舶知识图谱交互系统主组件
 *
 * 重构自 knowledge0316.html，使用 React Three Fiber
 */

import { Suspense, useState, useCallback, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import { KnowledgeSidebar } from './sidebar/knowledge-sidebar';
import { ResourcePanel } from './resource-panel/resource-panel';
// import { getAllLessonCards, getAllLessonCardLinks } from './data/lesson-knowledge-cards'; // Removed static import

// 动态导入 3D 图谱组件（客户端专用）
const KnowledgeGraphCanvas = dynamic(
  () => import('./graph/knowledge-graph-canvas').then((mod) => mod.KnowledgeGraphCanvas),
  { ssr: false }
);

// 动态导入 2D 图谱组件（客户端专用）
const KnowledgeGraph2D = dynamic(
  () => import('./graph/knowledge-graph-2d').then((mod) => mod.KnowledgeGraph2D),
  { ssr: false }
);

// 知识节点类型
export type NodeType = 'THEORY' | 'SCENARIO' | 'ETHICS';

// 知识节点接口 (Aligned with Prisma Model)
export interface KnowledgeNodeData {
  id: string;
  name: string;
  nodeType: NodeType;
  description: string;
  positionX: number;
  positionY: number;
  positionZ: number;
  bloomLevel?: string;
  knowledgeDim?: string;
  metadata?: any; // New field for atomized content
  content?: Record<string, unknown>; // Legacy support
  resources?: unknown[];
  ethicsContent?: Record<string, unknown>;
}

// 知识连接接口
export interface KnowledgeLinkData {
  id: string;
  sourceId: string;
  targetId: string;
  relation: string;
}

interface KnowledgeGraphSystemProps {
  // Props can still be passed for initial state or override, but we default to fetching
  initialNodes?: KnowledgeNodeData[];
  initialLinks?: KnowledgeLinkData[];
}

export function KnowledgeGraphSystem({
  initialNodes = [],
  initialLinks = [],
}: KnowledgeGraphSystemProps) {
  const [nodes, setNodes] = useState<KnowledgeNodeData[]>(initialNodes);
  const [links, setLinks] = useState<KnowledgeLinkData[]>(initialLinks);
  const [isLoading, setIsLoading] = useState(true);

  const [selectedNode, setSelectedNode] = useState<KnowledgeNodeData | null>(null);
  const [hoveredNode, setHoveredNode] = useState<KnowledgeNodeData | null>(null);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  // 视图模式：默认 2D
  const [viewMode, setViewMode] = useState<'2D' | '3D'>('2D');
  
  // 容器尺寸测量
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });

  // 监听容器大小变化
  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.offsetWidth,
          height: containerRef.current.offsetHeight
        });
      }
    };
    
    // 初始化
    updateSize();
    
    // 监听窗口缩放
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  // Fetch data from API on mount
  useEffect(() => {
    const fetchGraphData = async () => {
      try {
        const response = await fetch('/api/knowledge/graph');
        if (response.ok) {
          const data = await response.json();
          setNodes(data.nodes);
          setLinks(data.links);
        } else {
          console.error('Failed to fetch knowledge graph data');
        }
      } catch (error) {
        console.error('Error fetching knowledge graph data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchGraphData();
  }, []);

  // 节点点击处理
  const handleNodeClick = useCallback((node: KnowledgeNodeData) => {
    setSelectedNode(node);
    setIsPanelOpen(true);
  }, []);

  // 通过 ID 选择节点（用于关联知识点跳转）
  const handleNodeSelectById = useCallback((nodeId: string) => {
    const node = nodes.find(n => n.id === nodeId);
    if (node) {
      setSelectedNode(node);
      setIsPanelOpen(true);
    }
  }, [nodes]);

  // 节点悬停处理
  const handleNodeHover = useCallback((node: KnowledgeNodeData | null) => {
    setHoveredNode(node);
  }, []);

  // 关闭资源面板
  const handleClosePanel = useCallback(() => {
    setIsPanelOpen(false);
  }, []);

  // 搜索节点
  const filteredNodes = searchQuery
    ? nodes.filter(
        (node) =>
          node.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          node.description.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : nodes;

  return (
    <div className="flex h-screen w-full bg-[#020721] text-slate-200">
      {/* 左侧导航侧边栏 */}
      <KnowledgeSidebar
        nodes={nodes}
        selectedNodeId={selectedNode?.id}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onNodeSelect={handleNodeClick}
      />

      {/* 中央图谱区域 */}
      <div ref={containerRef} className="relative flex-1 h-full overflow-hidden">
        {/* 视图切换按钮 */}
        <div className="absolute top-4 right-4 z-10 flex bg-[#091540]/90 rounded-lg border border-blue-500/30 p-1 backdrop-blur-sm shadow-lg">
          <button 
            onClick={() => setViewMode('2D')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
              viewMode === '2D' 
                ? 'bg-blue-600 text-white shadow-sm' 
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            2D 视图
          </button>
          <button 
            onClick={() => setViewMode('3D')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
              viewMode === '3D' 
                ? 'bg-blue-600 text-white shadow-sm' 
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            3D 视图
          </button>
        </div>

        {isLoading ? (
            <div className="flex h-full w-full items-center justify-center">
              <div className="text-center">
                <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-2 border-blue-500/30 border-t-blue-500" />
                <div className="text-blue-400">正在从知识库加载数据...</div>
                <div className="mt-2 text-sm text-slate-500">同步 {nodes.length} 个节点...</div>
              </div>
            </div>
        ) : (
            <Suspense
            fallback={
                <div className="flex h-full w-full items-center justify-center">
                <div className="text-center">
                    <div className="text-blue-400">渲染视图...</div>
                </div>
                </div>
            }
            >
            {viewMode === '2D' ? (
              <KnowledgeGraph2D
                nodes={filteredNodes}
                links={links}
                selectedNode={selectedNode}
                hoveredNode={hoveredNode}
                onNodeClick={handleNodeClick}
                onNodeHover={handleNodeHover}
                width={dimensions.width}
                height={dimensions.height}
              />
            ) : (
              <KnowledgeGraphCanvas
                nodes={filteredNodes}
                links={links}
                selectedNode={selectedNode}
                hoveredNode={hoveredNode}
                onNodeClick={handleNodeClick}
                onNodeHover={handleNodeHover}
              />
            )}
            </Suspense>
        )}

        {/* 悬停提示 */}
        {hoveredNode && (
          <div className="pointer-events-none absolute left-1/2 top-4 z-50 -translate-x-1/2 transform rounded-lg border border-blue-500/50 bg-[#091540]/95 p-4 shadow-lg backdrop-blur-md">
            <div className="flex items-center gap-2">
              <span className="font-medium text-slate-100">{hoveredNode.name}</span>
              <span
                className={`rounded-full px-2 py-0.5 text-xs ${
                  hoveredNode.nodeType === 'THEORY'
                    ? 'bg-blue-500/20 text-blue-400'
                    : hoveredNode.nodeType === 'SCENARIO'
                      ? 'bg-red-500/20 text-red-400'
                      : 'bg-green-500/20 text-green-400'
                }`}
              >
                {hoveredNode.nodeType === 'THEORY'
                  ? '控制理论'
                  : hoveredNode.nodeType === 'SCENARIO'
                    ? '船舶场景'
                    : '伦理决策'}
              </span>
            </div>
            <p className="mt-2 text-sm text-slate-400">{hoveredNode.description}</p>
          </div>
        )}
      </div>

      {/* 右侧资源面板 */}
      <ResourcePanel
        isOpen={isPanelOpen}
        selectedNode={selectedNode}
        onClose={handleClosePanel}
        onNodeClick={handleNodeSelectById}
      />
    </div>
  );
}

export default KnowledgeGraphSystem;
