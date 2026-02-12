'use client';

/**
 * KnowledgeGraphSystem - 船舶知识图谱交互系统主组件
 *
 * 重构自 knowledge0316.html，使用 React Three Fiber
 */

import { Suspense, useState, useCallback, useEffect, useRef, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { KnowledgeSidebar } from './sidebar/knowledge-sidebar';
import { ResourcePanel } from './resource-panel/resource-panel';
import {
  getBloomLabel,
  getKnowledgeDimLabel,
  getRelationLabel,
} from '@/lib/knowledge-labels';
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
  tags?: string[];
  chapter?: number;
  ethicsContent?: Record<string, unknown>;
}

// 知识连接接口
export interface KnowledgeLinkData {
  id: string;
  sourceId: string;
  targetId: string;
  relation: string;
  relationType?: string;
  strength?: number;
}

interface KnowledgeGraphSystemProps {
  // Props can still be passed for initial state or override, but we default to fetching
  initialNodes?: KnowledgeNodeData[];
  initialLinks?: KnowledgeLinkData[];
}

interface GraphApiResponse {
  nodes?: KnowledgeNodeData[];
  links?: KnowledgeLinkData[];
  source?: 'file' | 'database';
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
  const [dataSource, setDataSource] = useState<'file' | 'database'>('database');
  const [minRelationStrength, setMinRelationStrength] = useState(0.8);
  const [selectedRelationTypes, setSelectedRelationTypes] = useState<string[]>([]);
  const [showOnlyConnectedNodes, setShowOnlyConnectedNodes] = useState(true);

  // 视图模式：默认 2D
  const [viewMode, setViewMode] = useState<'2D' | '3D'>('2D');

  // 容器尺寸测量
  const containerRef = useRef<HTMLDivElement>(null);
  const relationTypesInitialized = useRef(false);
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
          const data = (await response.json()) as GraphApiResponse;
          setNodes(Array.isArray(data.nodes) ? data.nodes : []);
          setLinks(Array.isArray(data.links) ? data.links : []);
          setDataSource(data.source === 'file' ? 'file' : 'database');
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

  useEffect(() => {
    if (!selectedNode) return;
    if (!nodes.some((node) => node.id === selectedNode.id)) {
      setSelectedNode(null);
      setIsPanelOpen(false);
    }
  }, [nodes, selectedNode]);

  // 节点悬停处理
  const handleNodeHover = useCallback((node: KnowledgeNodeData | null) => {
    setHoveredNode(node);
  }, []);

  // 关闭资源面板
  const handleClosePanel = useCallback(() => {
    setIsPanelOpen(false);
  }, []);

  // 搜索节点 + 关系筛选
  const searchedNodes = useMemo(() => {
    if (!searchQuery) return nodes;
    const q = searchQuery.toLowerCase();
    return nodes.filter((node) => {
      const tagText = (node.tags ?? []).join(' ').toLowerCase();
      return (
        node.name.toLowerCase().includes(q) ||
        node.description.toLowerCase().includes(q) ||
        tagText.includes(q)
      );
    });
  }, [nodes, searchQuery]);

  const relationTypeStats = useMemo(() => {
    const counts = new Map<string, number>();
    links.forEach((link) => {
      const type = link.relationType || link.relation || 'related';
      counts.set(type, (counts.get(type) ?? 0) + 1);
    });
    return Array.from(counts.entries())
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count || a.type.localeCompare(b.type));
  }, [links]);

  useEffect(() => {
    const types = relationTypeStats.map((item) => item.type);
    setSelectedRelationTypes((prev) => {
      if (types.length === 0) return [];
      if (!relationTypesInitialized.current) {
        relationTypesInitialized.current = true;
        return types;
      }
      return prev.filter((item) => types.includes(item));
    });
  }, [relationTypeStats]);

  const searchedNodeIdSet = useMemo(() => new Set(searchedNodes.map((item) => item.id)), [searchedNodes]);

  const filteredLinksByRelation = useMemo(() => {
    if (selectedRelationTypes.length === 0) return [] as KnowledgeLinkData[];
    return links.filter((link) => {
      const relationType = link.relationType || link.relation || 'related';
      const strength = typeof link.strength === 'number' ? link.strength : 1;
      if (!selectedRelationTypes.includes(relationType)) return false;
      if (strength < minRelationStrength) return false;
      if (!searchedNodeIdSet.has(link.sourceId) || !searchedNodeIdSet.has(link.targetId)) return false;
      return true;
    });
  }, [links, minRelationStrength, searchedNodeIdSet, selectedRelationTypes]);

  const filteredNodes = useMemo(() => {
    if (!showOnlyConnectedNodes) return searchedNodes;

    const connectedInSearch = new Set<string>();
    const connectedByVisibleLinks = new Set<string>();

    links.forEach((link) => {
      if (searchedNodeIdSet.has(link.sourceId) && searchedNodeIdSet.has(link.targetId)) {
        connectedInSearch.add(link.sourceId);
        connectedInSearch.add(link.targetId);
      }
    });

    filteredLinksByRelation.forEach((link) => {
      connectedByVisibleLinks.add(link.sourceId);
      connectedByVisibleLinks.add(link.targetId);
    });

    return searchedNodes.filter((node) => {
      if (node.id === selectedNode?.id) return true;
      if (!connectedInSearch.has(node.id)) return true;
      return connectedByVisibleLinks.has(node.id);
    });
  }, [filteredLinksByRelation, links, searchedNodeIdSet, searchedNodes, selectedNode?.id, showOnlyConnectedNodes]);

  const filteredNodeIdSet = useMemo(() => new Set(filteredNodes.map((item) => item.id)), [filteredNodes]);

  const filteredLinks = useMemo(
    () =>
      filteredLinksByRelation.filter(
        (link) => filteredNodeIdSet.has(link.sourceId) && filteredNodeIdSet.has(link.targetId)
      ),
    [filteredLinksByRelation, filteredNodeIdSet]
  );

  const toggleRelationType = useCallback((type: string) => {
    setSelectedRelationTypes((prev) =>
      prev.includes(type) ? prev.filter((item) => item !== type) : [...prev, type]
    );
  }, []);

  const hoveredBloomLabel = hoveredNode?.bloomLevel ? getBloomLabel(hoveredNode.bloomLevel) : '';
  const hoveredKnowledgeDimLabel = hoveredNode?.knowledgeDim
    ? getKnowledgeDimLabel(hoveredNode.knowledgeDim)
    : '';

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
        {/* 筛选控制区 */}
        <div className="absolute left-4 top-4 z-20 w-[340px] rounded-xl border border-amber-300/20 bg-[#0b183f]/90 p-3 shadow-[0_8px_30px_rgba(2,8,30,0.45)] backdrop-blur-md">
          <div className="mb-2 flex items-center justify-between">
            <div className="text-xs font-semibold tracking-wide text-amber-200">关系筛选</div>
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] ${
                dataSource === 'file'
                  ? 'bg-emerald-500/20 text-emerald-300'
                  : 'bg-cyan-500/20 text-cyan-300'
              }`}
            >
              {dataSource === 'file' ? '文件图谱' : '数据库图谱'}
            </span>
          </div>

          <div className="mb-3 flex items-center justify-between text-[11px] text-slate-400">
            <span>当前显示关系 {filteredLinks.length} 条</span>
            <span>节点 {filteredNodes.length} / {nodes.length}</span>
          </div>

          <div className="mb-3">
            <div className="mb-1.5 flex items-center justify-between text-[11px] text-slate-300">
              <span>关系类型</span>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="text-[10px] text-slate-400 hover:text-slate-200"
                  onClick={() => setSelectedRelationTypes(relationTypeStats.map((item) => item.type))}
                >
                  全选
                </button>
                <button
                  type="button"
                  className="text-[10px] text-slate-400 hover:text-slate-200"
                  onClick={() => setSelectedRelationTypes([])}
                >
                  清空
                </button>
              </div>
            </div>
            <div className="flex max-h-24 flex-wrap gap-1.5 overflow-y-auto">
              {relationTypeStats.map((item) => {
                const selected = selectedRelationTypes.includes(item.type);
                return (
                  <button
                    type="button"
                    key={item.type}
                    onClick={() => toggleRelationType(item.type)}
                    className={`rounded-full border px-2 py-1 text-[10px] transition-colors ${
                      selected
                        ? 'border-amber-300/40 bg-amber-400/15 text-amber-200'
                        : 'border-slate-600/40 bg-slate-700/30 text-slate-400 hover:border-slate-500/50 hover:text-slate-200'
                    }`}
                  >
                    {getRelationLabel(item.type)} · {item.count}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mb-3">
            <div className="mb-1.5 flex items-center justify-between text-[11px] text-slate-300">
              <span>关系强度阈值</span>
              <span className="text-amber-200">{minRelationStrength.toFixed(1)}</span>
            </div>
            <input
              type="range"
              min={0}
              max={1}
              step={0.1}
              value={minRelationStrength}
              onChange={(e) => setMinRelationStrength(Number(e.target.value))}
              className="w-full accent-amber-400"
            />
          </div>

          <label className="flex cursor-pointer items-center gap-2 text-[11px] text-slate-300">
            <input
              type="checkbox"
              checked={showOnlyConnectedNodes}
              onChange={(e) => setShowOnlyConnectedNodes(e.target.checked)}
              className="h-3.5 w-3.5 accent-amber-400"
            />
            <span>仅显示存在可见关系的节点</span>
          </label>
        </div>

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
                links={filteredLinks}
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
                links={filteredLinks}
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
            <div className="flex items-center gap-2 flex-wrap">
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
              {hoveredBloomLabel && (
                <span className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-300">
                  Bloom：{hoveredBloomLabel}
                </span>
              )}
              {hoveredKnowledgeDimLabel && (
                <span className="rounded-full border border-cyan-500/40 bg-cyan-500/10 px-2 py-0.5 text-xs text-cyan-300">
                  维度：{hoveredKnowledgeDimLabel}
                </span>
              )}
              {typeof hoveredNode.chapter === 'number' && (
                <span className="rounded-full border border-slate-500/40 bg-slate-700/30 px-2 py-0.5 text-xs text-slate-300">
                  第 {hoveredNode.chapter} 章
                </span>
              )}
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
