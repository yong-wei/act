'use client';

import { useEffect, useMemo, useState } from 'react';
import { Search, ChevronDown, ChevronRight, Circle, Square, Hexagon } from 'lucide-react';
import type { KnowledgeNodeData } from '../knowledge-graph-system';
import { buildChapterGroups } from '../graph/filter-utils';
import { getBloomLabel } from '@/lib/knowledge-labels';

interface KnowledgeSidebarProps {
  nodes: KnowledgeNodeData[];
  selectedNodeId?: string;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onNodeSelect: (node: KnowledgeNodeData) => void;
  onNodeHover?: (node: KnowledgeNodeData | null) => void;
}

function getNodeTypeIcon(nodeType?: string) {
  if (nodeType === 'SCENARIO') return <Square className="h-3 w-3 text-rose-500" />;
  if (nodeType === 'ETHICS') return <Hexagon className="h-3 w-3 text-emerald-500" />;
  return <Circle className="h-3 w-3 text-sky-500" />;
}

export function KnowledgeSidebar({
  nodes,
  selectedNodeId,
  searchQuery,
  onSearchChange,
  onNodeSelect,
  onNodeHover,
}: KnowledgeSidebarProps) {
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const [isLightTheme, setIsLightTheme] = useState(false);

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

  const chapterGroups = useMemo(() => {
    const keyword = searchQuery.trim().toLowerCase();
    const baseNodes = keyword
      ? nodes.filter((node) => {
          const metadata = (node.metadata ?? {}) as Record<string, unknown>;
          const keywords = Array.isArray(metadata.keywords)
            ? metadata.keywords.filter((item): item is string => typeof item === 'string')
            : [];
          return (
            node.name.toLowerCase().includes(keyword) ||
            node.description.toLowerCase().includes(keyword) ||
            keywords.join(' ').toLowerCase().includes(keyword)
          );
        })
      : nodes;
    return buildChapterGroups(baseNodes);
  }, [nodes, searchQuery]);

  useEffect(() => {
    setExpandedGroups((prev) => {
      const next: Record<string, boolean> = {};
      chapterGroups.forEach((group) => {
        next[group.chapterName] = prev[group.chapterName] ?? false;
      });
      return next;
    });
  }, [chapterGroups]);

  const toggleChapter = (chapterName: string) => {
    setExpandedGroups((prev) => ({
      ...prev,
      [chapterName]: !prev[chapterName],
    }));
  };

  return (
    <aside
      className={`w-[240px] shrink-0 overflow-y-auto border-r backdrop-blur-sm ${
        isLightTheme
          ? 'border-slate-300 bg-white/95'
          : 'border-blue-500/30 bg-[#091540]/90'
      }`}
    >
      <div
        className={`sticky top-0 z-10 border-b px-3 py-3 backdrop-blur-sm ${
          isLightTheme
            ? 'border-slate-200 bg-white/95'
            : 'border-blue-500/20 bg-[#091540]/95'
        }`}
      >
        <h2
          className={`flex items-center gap-1.5 text-sm font-semibold ${
            isLightTheme ? 'text-slate-800' : 'text-blue-400'
          }`}
        >
          知识图谱
        </h2>
      </div>

      <div className={`px-3 py-2 border-b ${isLightTheme ? 'border-slate-200' : 'border-blue-500/10'}`}>
        <div
          className={`flex items-center gap-2 rounded-md border px-2.5 py-1.5 ${
            isLightTheme
              ? 'border-slate-300 bg-slate-50'
              : 'border-blue-500/20 bg-[#0c1d4f]/40'
          }`}
        >
          <Search className={`h-3.5 w-3.5 ${isLightTheme ? 'text-slate-500' : 'text-slate-500'}`} />
          <input
            type="text"
            placeholder="搜索知识点..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className={`w-full bg-transparent text-xs outline-none ${
              isLightTheme
                ? 'text-slate-800 placeholder:text-slate-400'
                : 'text-slate-200 placeholder:text-slate-500'
            }`}
          />
        </div>
      </div>

      <nav className="py-2">
        {chapterGroups.map((group) => {
          const isExpanded = expandedGroups[group.chapterName];
          return (
            <div key={group.chapterName} className="mb-1">
              <button
                onClick={() => toggleChapter(group.chapterName)}
                className={`flex w-full items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors ${
                  isLightTheme ? 'hover:bg-slate-100 text-slate-700' : 'hover:bg-white/5 text-slate-200'
                }`}
              >
                <span className={isLightTheme ? 'text-slate-500' : 'text-slate-500'}>
                  {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                </span>
                <span className="flex-1 text-left">{group.chapterName}</span>
                <span className={`text-[10px] ${isLightTheme ? 'text-slate-500' : 'text-slate-500'}`}>
                  {group.nodes.length}
                </span>
              </button>

              {isExpanded && group.nodes.length > 0 && (
                <div className={`ml-3 border-l ${isLightTheme ? 'border-slate-300/70' : 'border-slate-700/50'}`}>
                  {group.nodes.map((node) => {
                    const isSelected = selectedNodeId === node.id;
                    return (
                      <button
                        key={node.id}
                        onClick={() => onNodeSelect(node)}
                        onMouseEnter={() => onNodeHover?.(node)}
                        onMouseLeave={() => onNodeHover?.(null)}
                        onFocus={() => onNodeHover?.(node)}
                        onBlur={() => onNodeHover?.(null)}
                        className={`flex w-full items-center gap-1.5 py-1 pl-3 pr-2 text-left text-xs transition-colors ${
                          isSelected
                            ? (isLightTheme
                                ? 'border-l-2 border-sky-500 -ml-[1px] bg-sky-100 text-sky-800'
                                : 'border-l-2 border-blue-400 -ml-[1px] bg-blue-500/20 text-blue-300')
                            : (isLightTheme
                                ? 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
                                : 'text-slate-300 hover:bg-white/5 hover:text-slate-100')
                        }`}
                        title={node.description}
                      >
                        <span className="shrink-0">{getNodeTypeIcon(node.nodeType)}</span>
                        <span className="flex-1 truncate">{node.name}</span>
                        {node.bloomLevel && (
                          <span
                            className={`shrink-0 rounded border px-1 py-0.5 text-[9px] leading-none ${
                              isLightTheme
                                ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                                : 'border-emerald-500/30 bg-emerald-500/20 text-emerald-200'
                            }`}
                          >
                            {getBloomLabel(node.bloomLevel)}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>
    </aside>
  );
}
