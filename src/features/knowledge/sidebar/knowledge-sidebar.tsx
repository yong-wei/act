'use client';

/**
 * KnowledgeSidebar - 知识图谱左侧导航栏
 * 重构版本：按节点类型分组的层级导航
 */

import { useState, useMemo } from 'react';
import { Search, ChevronDown, ChevronRight, Circle, Square, Hexagon } from 'lucide-react';
import type { KnowledgeNodeData } from '../knowledge-graph-system';
import { NODE_TYPE_CONFIGS } from '../graph/visual-config';
import { getBloomLabel } from '@/lib/knowledge-labels';

interface KnowledgeSidebarProps {
  nodes: KnowledgeNodeData[];
  selectedNodeId?: string;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onNodeSelect: (node: KnowledgeNodeData) => void;
}

// 节点类型配置（包含图标和显示顺序）
const NODE_TYPE_ORDER = ['THEORY', 'SCENARIO', 'ETHICS'] as const;

const NODE_TYPE_ICONS: Record<string, React.ReactNode> = {
  THEORY: <Circle className="h-3 w-3" />,
  SCENARIO: <Square className="h-3 w-3" />,
  ETHICS: <Hexagon className="h-3 w-3" />,
};

const NODE_TYPE_COLORS: Record<string, string> = {
  THEORY: 'text-blue-400',
  SCENARIO: 'text-red-400',
  ETHICS: 'text-green-400',
};

export function KnowledgeSidebar({
  nodes,
  selectedNodeId,
  searchQuery,
  onSearchChange,
  onNodeSelect,
}: KnowledgeSidebarProps) {
  // 各分组的展开状态
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({
    THEORY: true,
    SCENARIO: true,
    ETHICS: true,
  });

  // 按类型分组并过滤节点
  const groupedNodes = useMemo(() => {
    const filtered = searchQuery
      ? nodes.filter(
          (node) =>
            node.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            node.description.toLowerCase().includes(searchQuery.toLowerCase())
        )
      : nodes;

    const groups: Record<string, KnowledgeNodeData[]> = {
      THEORY: [],
      SCENARIO: [],
      ETHICS: [],
    };

    filtered.forEach((node) => {
      const type = node.nodeType || 'THEORY';
      if (groups[type]) {
        groups[type].push(node);
      }
    });

    return groups;
  }, [nodes, searchQuery]);

  // 切换分组展开/折叠
  const toggleGroup = (type: string) => {
    setExpandedGroups((prev) => ({
      ...prev,
      [type]: !prev[type],
    }));
  };

  return (
    <aside className="w-[200px] shrink-0 overflow-y-auto border-r border-blue-500/30 bg-[#091540]/90 backdrop-blur-sm">
      {/* 头部标题 */}
      <div className="sticky top-0 z-10 bg-[#091540]/95 backdrop-blur-sm border-b border-blue-500/20 px-3 py-3">
        <h2 className="text-sm font-medium text-blue-400 flex items-center gap-1.5">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="3" />
            <path d="M12 2v4" />
            <path d="M12 18v4" />
            <path d="m4.93 4.93 2.83 2.83" />
            <path d="m16.24 16.24 2.83 2.83" />
            <path d="M2 12h4" />
            <path d="M18 12h4" />
            <path d="m4.93 19.07 2.83-2.83" />
            <path d="m16.24 7.76 2.83-2.83" />
          </svg>
          知识图谱
        </h2>
      </div>

      {/* 搜索框 */}
      <div className="px-3 py-2 border-b border-blue-500/10">
        <div className="flex items-center gap-2 rounded-md border border-blue-500/20 bg-[#0c1d4f]/40 px-2.5 py-1.5">
          <Search className="h-3.5 w-3.5 text-slate-500" />
          <input
            type="text"
            placeholder="搜索知识点..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full bg-transparent text-xs text-slate-200 outline-none placeholder:text-slate-500"
          />
        </div>
      </div>

      {/* 分组导航 */}
      <nav className="py-2">
        {NODE_TYPE_ORDER.map((type) => {
          const config = NODE_TYPE_CONFIGS[type];
          const nodesInGroup = groupedNodes[type] || [];
          const isExpanded = expandedGroups[type];
          const colorClass = NODE_TYPE_COLORS[type];

          return (
            <div key={type} className="mb-1">
              {/* 分组标题 */}
              <button
                onClick={() => toggleGroup(type)}
                className="w-full flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium hover:bg-white/5 transition-colors"
              >
                <span className="text-slate-500">
                  {isExpanded ? (
                    <ChevronDown className="h-3 w-3" />
                  ) : (
                    <ChevronRight className="h-3 w-3" />
                  )}
                </span>
                <span className={colorClass}>{NODE_TYPE_ICONS[type]}</span>
                <span className={`${colorClass} flex-1 text-left`}>
                  {config.label}
                </span>
                <span className="text-slate-500 text-[10px]">
                  {nodesInGroup.length}
                </span>
              </button>

              {/* 节点列表 */}
              {isExpanded && nodesInGroup.length > 0 && (
                <div className="ml-3 border-l border-slate-700/50">
                  {nodesInGroup.map((node) => {
                    const isSelected = selectedNodeId === node.id;
                    return (
                      <button
                        key={node.id}
                        onClick={() => onNodeSelect(node)}
                        className={`w-full flex items-center gap-1.5 pl-3 pr-2 py-1 text-left text-xs transition-colors ${
                          isSelected
                            ? 'bg-blue-500/20 text-blue-300 border-l-2 border-blue-400 -ml-[1px]'
                            : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                        }`}
                        title={node.description}
                      >
                        <span className="truncate flex-1">{node.name}</span>
                        {node.bloomLevel && (
                          <span className="shrink-0 rounded px-1 py-0.5 text-[9px] leading-none text-emerald-200 bg-emerald-500/20 border border-emerald-500/30">
                            {getBloomLabel(node.bloomLevel)}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* 空状态 */}
              {isExpanded && nodesInGroup.length === 0 && searchQuery && (
                <div className="ml-6 py-1 text-[10px] text-slate-600">
                  无匹配结果
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* 底部图例 */}
      <div className="sticky bottom-0 border-t border-blue-500/20 bg-[#091540]/95 backdrop-blur-sm px-3 py-2">
        <div className="text-[10px] text-slate-500 mb-1.5">图例</div>
        <div className="grid grid-cols-2 gap-1 text-[10px]">
          <div className="flex items-center gap-1 text-slate-400">
            <div className="w-2 h-2 rounded-full bg-cyan-500" />
            <span>事实性</span>
          </div>
          <div className="flex items-center gap-1 text-slate-400">
            <div className="w-2 h-2 rounded-full bg-blue-500" />
            <span>概念性</span>
          </div>
          <div className="flex items-center gap-1 text-slate-400">
            <div className="w-2 h-2 rounded-full bg-purple-500" />
            <span>程序性</span>
          </div>
          <div className="flex items-center gap-1 text-slate-400">
            <div className="w-2 h-2 rounded-full bg-pink-500" />
            <span>元认知</span>
          </div>
        </div>
      </div>
    </aside>
  );
}
