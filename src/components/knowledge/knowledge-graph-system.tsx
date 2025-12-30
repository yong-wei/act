'use client';

/**
 * KnowledgeGraphSystem - 船舶知识图谱交互系统主组件
 *
 * 重构自 knowledge0316.html，使用 React Three Fiber
 */

import { Suspense, useState, useCallback, useMemo, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { KnowledgeSidebar } from './sidebar/knowledge-sidebar';
import { ResourcePanel } from './resource-panel/resource-panel';
// import { getAllLessonCards, getAllLessonCardLinks } from './data/lesson-knowledge-cards'; // Removed static import

// 动态导入 3D 图谱组件（客户端专用）
const KnowledgeGraphCanvas = dynamic(
  () => import('./graph/knowledge-graph-canvas').then((mod) => mod.KnowledgeGraphCanvas),
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

// 学习路径接口
export interface LearningPathItem {
  order: number;
  title: string;
  description: string;
  estimatedTime: number;
  priority: 'high' | 'medium' | 'low';
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
  const [activeTab, setActiveTab] = useState<'cognitive' | 'style' | 'ethics'>('cognitive');
  const [searchQuery, setSearchQuery] = useState('');

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
        activeTab={activeTab}
        onTabChange={setActiveTab}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        learningPath={[]} // TODO: Fetch from Playlist API
        onNodeSelect={handleNodeClick}
        nodes={nodes}
      />

      {/* 中央图谱区域 */}
      <div className="relative flex-1">
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
                    <div className="text-blue-400">渲染 3D 视图...</div>
                </div>
                </div>
            }
            >
            <KnowledgeGraphCanvas
                nodes={filteredNodes}
                links={links}
                selectedNode={selectedNode}
                hoveredNode={hoveredNode}
                onNodeClick={handleNodeClick}
                onNodeHover={handleNodeHover}
            />
            </Suspense>
        )}

        {/* 节点图例 */}
        <div className="absolute bottom-20 left-4 rounded-lg border border-blue-500/30 bg-[#091540]/80 p-4">
          <div className="mb-2 text-sm text-slate-400">节点类型</div>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-sm bg-[#f5544f]" />
              <span className="text-xs">船舶场景节点</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-sm bg-[#4f86c6]" />
              <span className="text-xs">控制理论节点</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-sm bg-[#50c38a]" />
              <span className="text-xs">伦理决策节点</span>
            </div>
          </div>
        </div>

        {/* 悬停提示 */}
        {hoveredNode && (
          <div className="pointer-events-none absolute left-1/2 top-4 z-50 -translate-x-1/2 transform rounded-lg border border-blue-500/50 bg-[#091540]/95 p-4 shadow-lg">
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
      />
    </div>
  );
}

export default KnowledgeGraphSystem;
