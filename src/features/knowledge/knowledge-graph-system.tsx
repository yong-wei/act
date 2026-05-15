'use client';

/**
 * KnowledgeGraphSystem - 船舶知识图谱交互系统主组件
 *
 * 重构自 knowledge0316.html，使用 React Three Fiber
 */

import { Suspense, useState, useCallback, useEffect, useRef, useMemo, type Dispatch, type SetStateAction } from 'react';
import dynamic from 'next/dynamic';
import { KnowledgeSidebar } from './sidebar/knowledge-sidebar';
import { ResourcePanel } from './resource-panel/resource-panel';
import {
  CHAPTER_DISPLAY_ORDER,
  getBloomLabel,
  getKnowledgeDimLabel,
  getRelationCategory,
  getRelationLabel,
  resolveChapterName,
} from '@/lib/knowledge-labels';
import {
  buildDefaultSelectedRelationTypes,
  buildRelationTypeStats,
  injectChapterNodes,
  matchesNodeFilters,
} from './graph/filter-utils';
import type { KnowledgeGraphLabelMode } from './graph/label-policy';
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
  chapterName?: string;
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
  const [selectedChapters, setSelectedChapters] = useState<string[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedBloomLevels, setSelectedBloomLevels] = useState<string[]>([]);
  const [showOnlyConnectedNodes, setShowOnlyConnectedNodes] = useState(true);
  const [labelMode, setLabelMode] = useState<KnowledgeGraphLabelMode>('focus');
  const [isLightTheme, setIsLightTheme] = useState(false);

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

  // 节点悬停处理
  const handleNodeHover = useCallback((node: KnowledgeNodeData | null) => {
    setHoveredNode(node);
  }, []);

  // 关闭资源面板
  const handleClosePanel = useCallback(() => {
    setIsPanelOpen(false);
  }, []);

  const chapterOptions = useMemo(() => {
    const chapterSet = new Set<string>();
    nodes.forEach((node) => {
      const chapterName = resolveChapterName(
        node.chapter,
        typeof node.chapterName === 'string' ? node.chapterName : null
      );
      chapterSet.add(chapterName);
    });

    const listed = CHAPTER_DISPLAY_ORDER.filter((item) => chapterSet.has(item));
    const unlisted = Array.from(chapterSet)
      .filter((item) => !CHAPTER_DISPLAY_ORDER.includes(item as (typeof CHAPTER_DISPLAY_ORDER)[number]))
      .sort((a, b) => a.localeCompare(b, 'zh-Hans-CN'));
    return [...listed, ...unlisted];
  }, [nodes]);

  const categoryOptions = useMemo(() => {
    const categorySet = new Set<string>();
    nodes.forEach((node) => {
      const metadata = (node.metadata ?? {}) as Record<string, unknown>;
      const category = typeof metadata.category === 'string' ? metadata.category : node.knowledgeDim;
      if (category) categorySet.add(category);
    });
    return Array.from(categorySet).sort((a, b) => a.localeCompare(b, 'zh-Hans-CN'));
  }, [nodes]);

  const bloomOptions = useMemo(() => {
    const bloomSet = new Set<string>();
    nodes.forEach((node) => {
      const metadata = (node.metadata ?? {}) as Record<string, unknown>;
      const bloom = typeof metadata.bloom_level === 'string' ? metadata.bloom_level : node.bloomLevel;
      if (bloom) bloomSet.add(bloom);
    });
    return Array.from(bloomSet).sort((a, b) => a.localeCompare(b, 'zh-Hans-CN'));
  }, [nodes]);

  // 节点筛选（章节 / category / bloom_level / 搜索关键词）
  const nodeFilteredByMeta = useMemo(
    () =>
      nodes.filter((node) =>
        matchesNodeFilters(node, {
          searchQuery,
          selectedChapters,
          selectedCategories,
          selectedBloomLevels,
        })
      ),
    [nodes, searchQuery, selectedChapters, selectedCategories, selectedBloomLevels]
  );

  const nodeFilterIdSet = useMemo(
    () => new Set(nodeFilteredByMeta.map((item) => item.id)),
    [nodeFilteredByMeta]
  );

  // 关系类型统计按“当前节点过滤结果”计算（含搜索结果）
  const relationTypeStats = useMemo(
    () => buildRelationTypeStats(links, nodeFilterIdSet),
    [links, nodeFilterIdSet]
  );

  useEffect(() => {
    const types = relationTypeStats.map((item) => item.type);
    setSelectedRelationTypes((prev) => {
      if (types.length === 0) return [];
      if (!relationTypesInitialized.current) {
        relationTypesInitialized.current = true;
        return buildDefaultSelectedRelationTypes(types);
      }
      const kept = prev.filter((item) => types.includes(item));
      return kept.length > 0 ? kept : buildDefaultSelectedRelationTypes(types);
    });
  }, [relationTypeStats]);

  const filteredLinksByRelation = useMemo(() => {
    if (selectedRelationTypes.length === 0) return [] as KnowledgeLinkData[];
    return links.filter((link) => {
      const relationType = link.relationType || link.relation || 'related';
      const strength = typeof link.strength === 'number' ? link.strength : 1;
      if (!selectedRelationTypes.includes(relationType)) return false;
      if (strength < minRelationStrength) return false;
      if (!nodeFilterIdSet.has(link.sourceId) || !nodeFilterIdSet.has(link.targetId)) return false;
      return true;
    });
  }, [links, minRelationStrength, nodeFilterIdSet, selectedRelationTypes]);

  const filteredNodes = useMemo(() => {
    if (!showOnlyConnectedNodes) return nodeFilteredByMeta;

    const connectedInSearch = new Set<string>();
    const connectedByVisibleLinks = new Set<string>();

    links.forEach((link) => {
      if (nodeFilterIdSet.has(link.sourceId) && nodeFilterIdSet.has(link.targetId)) {
        connectedInSearch.add(link.sourceId);
        connectedInSearch.add(link.targetId);
      }
    });

    filteredLinksByRelation.forEach((link) => {
      connectedByVisibleLinks.add(link.sourceId);
      connectedByVisibleLinks.add(link.targetId);
    });

    return nodeFilteredByMeta.filter((node) => {
      if (node.id === selectedNode?.id) return true;
      if (!connectedInSearch.has(node.id)) return true;
      return connectedByVisibleLinks.has(node.id);
    });
  }, [filteredLinksByRelation, links, nodeFilterIdSet, nodeFilteredByMeta, selectedNode?.id, showOnlyConnectedNodes]);

  const filteredNodeIdSet = useMemo(() => new Set(filteredNodes.map((item) => item.id)), [filteredNodes]);

  const filteredLinks = useMemo(
    () =>
      filteredLinksByRelation.filter(
        (link) => filteredNodeIdSet.has(link.sourceId) && filteredNodeIdSet.has(link.targetId)
      ),
    [filteredLinksByRelation, filteredNodeIdSet]
  );

  const graphWithChapterNodes = useMemo(
    () => injectChapterNodes(filteredNodes, filteredLinks),
    [filteredNodes, filteredLinks]
  );

  const displayNodes = graphWithChapterNodes.nodes;
  const displayLinks = graphWithChapterNodes.links;

  const toggleRelationType = useCallback((type: string) => {
    setSelectedRelationTypes((prev) =>
      prev.includes(type) ? prev.filter((item) => item !== type) : [...prev, type]
    );
  }, []);

  const toggleMultiSelectValue = useCallback(
    (value: string, setter: Dispatch<SetStateAction<string[]>>) => {
      setter((prev) => (prev.includes(value) ? prev.filter((item) => item !== value) : [...prev, value]));
    },
    []
  );

  useEffect(() => {
    if (!selectedNode) return;
    if (!displayNodes.some((node) => node.id === selectedNode.id)) {
      setSelectedNode(null);
      setIsPanelOpen(false);
    }
  }, [displayNodes, selectedNode]);

  const hoveredBloomLabel = hoveredNode?.bloomLevel ? getBloomLabel(hoveredNode.bloomLevel) : '';
  const hoveredKnowledgeDimLabel = hoveredNode?.knowledgeDim
    ? getKnowledgeDimLabel(hoveredNode.knowledgeDim)
    : '';
  const hoveredChapterName = hoveredNode
    ? resolveChapterName(hoveredNode.chapter, hoveredNode.chapterName)
    : '';

  return (
    <div className="flex h-screen w-full bg-[#020721] text-slate-200">
      {/* 左侧导航侧边栏 */}
      <KnowledgeSidebar
        nodes={nodeFilteredByMeta}
        selectedNodeId={selectedNode?.id}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onNodeSelect={handleNodeClick}
      />

      {/* 中央图谱区域 */}
      <div ref={containerRef} className="relative flex-1 h-full overflow-hidden">
        {/* 筛选控制区 */}
        <div
          className={`absolute left-4 top-4 z-20 w-[360px] rounded-xl p-3 backdrop-blur-md ${
            isLightTheme
              ? 'border border-slate-300/90 bg-white/95 text-slate-800 shadow-[0_12px_28px_rgba(15,23,42,0.12)]'
              : 'border border-amber-300/20 bg-[#0b183f]/90 text-slate-200 shadow-[0_8px_30px_rgba(2,8,30,0.45)]'
          }`}
        >
          <div className="mb-2 flex items-center justify-between">
            <div className={`text-xs font-semibold tracking-wide ${isLightTheme ? 'text-slate-700' : 'text-amber-200'}`}>
              关系筛选
            </div>
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] ${
                dataSource === 'file'
                  ? (isLightTheme ? 'border border-emerald-300 bg-emerald-100 text-emerald-700' : 'bg-emerald-500/20 text-emerald-300')
                  : (isLightTheme ? 'border border-sky-300 bg-sky-100 text-sky-700' : 'bg-cyan-500/20 text-cyan-300')
              }`}
            >
              {dataSource === 'file' ? '文件图谱' : '数据库图谱'}
            </span>
          </div>

          <div className={`mb-3 flex items-center justify-between text-[11px] ${isLightTheme ? 'text-slate-600' : 'text-slate-400'}`}>
            <span>当前显示关系 {filteredLinks.length} 条</span>
            <span>节点 {filteredNodes.length} / {nodes.length}</span>
          </div>

          <div className={`mb-3 flex items-center justify-between gap-3 rounded-lg border px-2 py-1.5 ${
            isLightTheme ? 'border-slate-300/80 bg-slate-50' : 'border-slate-700/50 bg-slate-900/35'
          }`}>
            <span className={`text-[11px] ${isLightTheme ? 'text-slate-700' : 'text-slate-300'}`}>标签显示</span>
            <div className="flex rounded-md border border-slate-400/30 p-0.5">
              {([
                ['focus', '重点标签'],
                ['all', '全部标签'],
              ] as const).map(([mode, label]) => (
                <button
                  key={mode}
                  type="button"
                  aria-pressed={labelMode === mode}
                  onClick={() => setLabelMode(mode)}
                  className={`rounded px-2 py-1 text-[10px] transition-colors ${
                    labelMode === mode
                      ? (isLightTheme ? 'bg-sky-600 text-white' : 'bg-cyan-500/25 text-cyan-100')
                      : (isLightTheme ? 'text-slate-600 hover:bg-white' : 'text-slate-400 hover:bg-slate-800/70')
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="mb-3">
            <input
              type="text"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="关键词搜索（名称 / 标签 / 公式 / 示例）"
              className={`w-full rounded-lg border px-2.5 py-2 text-xs outline-none ${
                isLightTheme
                  ? 'border-slate-300 bg-white text-slate-800 placeholder:text-slate-400 focus:border-sky-500'
                  : 'border-blue-500/30 bg-[#0c1d4f]/45 text-slate-100 placeholder:text-slate-500 focus:border-cyan-400'
              }`}
            />
          </div>

          <div className="mb-3 space-y-2">
            <details className={`rounded-lg border px-2 py-1.5 ${isLightTheme ? 'border-slate-300/80 bg-slate-50' : 'border-slate-700/50 bg-slate-900/35'}`}>
              <summary className={`cursor-pointer text-[11px] font-medium ${isLightTheme ? 'text-slate-700' : 'text-slate-200'}`}>
                章节筛选（多选）{selectedChapters.length > 0 ? ` · ${selectedChapters.length}` : ''}
              </summary>
              <div className="mt-2 max-h-28 space-y-1 overflow-y-auto pr-1">
                {chapterOptions.map((chapterName) => (
                  <label key={chapterName} className={`flex cursor-pointer items-center gap-2 text-[11px] ${isLightTheme ? 'text-slate-700' : 'text-slate-300'}`}>
                    <input
                      type="checkbox"
                      checked={selectedChapters.includes(chapterName)}
                      onChange={() => toggleMultiSelectValue(chapterName, setSelectedChapters)}
                      className={isLightTheme ? 'accent-sky-600' : 'accent-cyan-400'}
                    />
                    <span>{chapterName}</span>
                  </label>
                ))}
              </div>
            </details>

            <details className={`rounded-lg border px-2 py-1.5 ${isLightTheme ? 'border-slate-300/80 bg-slate-50' : 'border-slate-700/50 bg-slate-900/35'}`}>
              <summary className={`cursor-pointer text-[11px] font-medium ${isLightTheme ? 'text-slate-700' : 'text-slate-200'}`}>
                category 筛选{selectedCategories.length > 0 ? ` · ${selectedCategories.length}` : ''}
              </summary>
              <div className="mt-2 max-h-24 space-y-1 overflow-y-auto pr-1">
                {categoryOptions.map((category) => (
                  <label key={category} className={`flex cursor-pointer items-center gap-2 text-[11px] ${isLightTheme ? 'text-slate-700' : 'text-slate-300'}`}>
                    <input
                      type="checkbox"
                      checked={selectedCategories.includes(category)}
                      onChange={() => toggleMultiSelectValue(category, setSelectedCategories)}
                      className={isLightTheme ? 'accent-sky-600' : 'accent-cyan-400'}
                    />
                    <span>{category}</span>
                  </label>
                ))}
              </div>
            </details>

            <details className={`rounded-lg border px-2 py-1.5 ${isLightTheme ? 'border-slate-300/80 bg-slate-50' : 'border-slate-700/50 bg-slate-900/35'}`}>
              <summary className={`cursor-pointer text-[11px] font-medium ${isLightTheme ? 'text-slate-700' : 'text-slate-200'}`}>
                bloom_level 筛选{selectedBloomLevels.length > 0 ? ` · ${selectedBloomLevels.length}` : ''}
              </summary>
              <div className="mt-2 max-h-24 space-y-1 overflow-y-auto pr-1">
                {bloomOptions.map((bloom) => (
                  <label key={bloom} className={`flex cursor-pointer items-center gap-2 text-[11px] ${isLightTheme ? 'text-slate-700' : 'text-slate-300'}`}>
                    <input
                      type="checkbox"
                      checked={selectedBloomLevels.includes(bloom)}
                      onChange={() => toggleMultiSelectValue(bloom, setSelectedBloomLevels)}
                      className={isLightTheme ? 'accent-sky-600' : 'accent-cyan-400'}
                    />
                    <span>{getBloomLabel(bloom)}</span>
                  </label>
                ))}
              </div>
            </details>
          </div>

          <div className="mb-3">
            <div className={`mb-1.5 flex items-center justify-between text-[11px] ${isLightTheme ? 'text-slate-700' : 'text-slate-300'}`}>
              <span>关系类型</span>
              <div className="flex gap-2">
                <button
                  type="button"
                  className={`text-[10px] ${isLightTheme ? 'text-slate-600 hover:text-slate-800' : 'text-slate-400 hover:text-slate-200'}`}
                  onClick={() => setSelectedRelationTypes(relationTypeStats.map((item) => item.type))}
                >
                  全选
                </button>
                <button
                  type="button"
                  className={`text-[10px] ${isLightTheme ? 'text-slate-600 hover:text-slate-800' : 'text-slate-400 hover:text-slate-200'}`}
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
                        ? (isLightTheme
                            ? 'border-sky-300 bg-sky-100 text-sky-700'
                            : 'border-amber-300/40 bg-amber-400/15 text-amber-200')
                        : (isLightTheme
                            ? 'border-slate-300 bg-white text-slate-600 hover:border-slate-400 hover:text-slate-800'
                            : 'border-slate-600/40 bg-slate-700/30 text-slate-400 hover:border-slate-500/50 hover:text-slate-200')
                    }`}
                  >
                    {getRelationLabel(item.type)} · {item.count}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mb-3">
            <div className={`mb-1.5 flex items-center justify-between text-[11px] ${isLightTheme ? 'text-slate-700' : 'text-slate-300'}`}>
              <span>关系强度阈值</span>
              <span className={isLightTheme ? 'text-sky-700' : 'text-amber-200'}>{minRelationStrength.toFixed(1)}</span>
            </div>
            <input
              type="range"
              min={0}
              max={1}
              step={0.1}
              value={minRelationStrength}
              onChange={(e) => setMinRelationStrength(Number(e.target.value))}
              className={`w-full ${isLightTheme ? 'accent-sky-600' : 'accent-amber-400'}`}
            />
          </div>

          <label className={`mb-2 flex cursor-pointer items-center gap-2 text-[11px] ${isLightTheme ? 'text-slate-700' : 'text-slate-300'}`}>
            <input
              type="checkbox"
              checked={showOnlyConnectedNodes}
              onChange={(e) => setShowOnlyConnectedNodes(e.target.checked)}
              className={`h-3.5 w-3.5 ${isLightTheme ? 'accent-sky-600' : 'accent-amber-400'}`}
            />
            <span>仅显示存在可见关系的节点</span>
          </label>

          <button
            type="button"
            onClick={() => {
              setSelectedChapters([]);
              setSelectedCategories([]);
              setSelectedBloomLevels([]);
              setSearchQuery('');
            }}
            className={`w-full rounded-md border px-2 py-1 text-[11px] ${
              isLightTheme
                ? 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                : 'border-slate-600/60 bg-slate-800/40 text-slate-300 hover:bg-slate-700/40'
            }`}
          >
            清空节点筛选条件
          </button>
        </div>

        {/* 视图切换按钮 */}
        <div
          className={`absolute top-4 right-4 z-10 flex rounded-lg border p-1 backdrop-blur-sm shadow-lg ${
            isLightTheme
              ? 'border-slate-300 bg-white/95'
              : 'border-blue-500/30 bg-[#091540]/90'
          }`}
        >
          <button 
            onClick={() => setViewMode('2D')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
              viewMode === '2D' 
                ? (isLightTheme ? 'bg-sky-600 text-white shadow-sm' : 'bg-blue-600 text-white shadow-sm')
                : (isLightTheme ? 'text-slate-600 hover:text-slate-900 hover:bg-slate-100' : 'text-slate-400 hover:text-white hover:bg-white/5')
            }`}
          >
            2D 视图
          </button>
          <button 
            onClick={() => setViewMode('3D')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
              viewMode === '3D' 
                ? (isLightTheme ? 'bg-sky-600 text-white shadow-sm' : 'bg-blue-600 text-white shadow-sm')
                : (isLightTheme ? 'text-slate-600 hover:text-slate-900 hover:bg-slate-100' : 'text-slate-400 hover:text-white hover:bg-white/5')
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
                nodes={displayNodes}
                links={displayLinks}
                selectedNode={selectedNode}
                hoveredNode={hoveredNode}
                onNodeClick={handleNodeClick}
                onNodeHover={handleNodeHover}
                width={dimensions.width}
                height={dimensions.height}
                labelMode={labelMode}
              />
            ) : (
              <KnowledgeGraphCanvas
                nodes={displayNodes}
                links={displayLinks}
                selectedNode={selectedNode}
                hoveredNode={hoveredNode}
                onNodeClick={handleNodeClick}
                onNodeHover={handleNodeHover}
                labelMode={labelMode}
              />
            )}
            </Suspense>
        )}

        {/* 悬停提示 */}
        {hoveredNode && (
          <div
            className={`pointer-events-none absolute left-1/2 top-4 z-50 -translate-x-1/2 transform rounded-lg p-4 shadow-lg backdrop-blur-md ${
              isLightTheme
                ? 'border border-slate-300 bg-white/95'
                : 'border border-blue-500/50 bg-[#091540]/95'
            }`}
          >
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`font-medium ${isLightTheme ? 'text-slate-900' : 'text-slate-100'}`}>{hoveredNode.name}</span>
              <span
                className={`rounded-full px-2 py-0.5 text-xs ${
                  hoveredNode.nodeType === 'THEORY'
                    ? (isLightTheme ? 'bg-sky-100 text-sky-700' : 'bg-blue-500/20 text-blue-400')
                    : hoveredNode.nodeType === 'SCENARIO'
                      ? (isLightTheme ? 'bg-red-100 text-red-700' : 'bg-red-500/20 text-red-400')
                      : (isLightTheme ? 'bg-emerald-100 text-emerald-700' : 'bg-green-500/20 text-green-400')
                }`}
              >
                {hoveredNode.nodeType === 'THEORY'
                  ? '控制理论'
                  : hoveredNode.nodeType === 'SCENARIO'
                    ? '船舶场景'
                    : '伦理决策'}
              </span>
              {hoveredBloomLabel && (
                <span className={`rounded-full border px-2 py-0.5 text-xs ${isLightTheme ? 'border-emerald-300 bg-emerald-50 text-emerald-700' : 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'}`}>
                  Bloom：{hoveredBloomLabel}
                </span>
              )}
              {hoveredKnowledgeDimLabel && (
                <span className={`rounded-full border px-2 py-0.5 text-xs ${isLightTheme ? 'border-cyan-300 bg-cyan-50 text-cyan-700' : 'border-cyan-500/40 bg-cyan-500/10 text-cyan-300'}`}>
                  维度：{hoveredKnowledgeDimLabel}
                </span>
              )}
              {hoveredChapterName && (
                <span className={`rounded-full border px-2 py-0.5 text-xs ${isLightTheme ? 'border-slate-300 bg-slate-100 text-slate-700' : 'border-slate-500/40 bg-slate-700/30 text-slate-300'}`}>
                  章节：{hoveredChapterName}
                </span>
              )}
            </div>
            <p className={`mt-2 text-sm ${isLightTheme ? 'text-slate-700' : 'text-slate-400'}`}>{hoveredNode.description}</p>
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
