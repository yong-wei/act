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
  return <Circle className="h-3 w-3 text-platform-action-primary" />;
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
      className="h-full w-full min-w-0 shrink-0 overflow-y-auto border border-platform-border bg-platform-surface/95 text-platform-fg-primary shadow-sm backdrop-blur-sm lg:w-[17rem]"
      data-knowledge-local-panel="chapter-directory"
      data-platform-local-tool-panel="chapter-directory"
    >
      <div className="sticky top-0 z-10 border-b border-platform-border bg-platform-surface-raised/95 px-3 py-3 backdrop-blur-sm">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold text-platform-fg-primary">
          章节目录
        </h2>
      </div>

      <div className="border-b border-platform-border px-3 py-2">
        <div className="flex items-center gap-2 rounded-md border border-platform-border bg-platform-surface-muted px-2.5 py-1.5">
          <Search className="h-3.5 w-3.5 text-platform-fg-muted" />
          <input
            type="text"
            aria-label="搜索知识图谱章节节点"
            placeholder="搜索知识点..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full bg-transparent text-xs text-platform-fg-primary outline-none placeholder:text-platform-fg-muted"
          />
        </div>
      </div>

      <div className="py-2" role="tree" aria-label="知识图谱章节目录">
        {chapterGroups.map((group) => {
          const isExpanded = expandedGroups[group.chapterName];
          return (
            <div key={group.chapterName} className="mb-1">
              <button
                onClick={() => toggleChapter(group.chapterName)}
                className="flex w-full items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-platform-fg-secondary transition-colors hover:bg-platform-action-subtle hover:text-platform-fg-primary"
                aria-expanded={isExpanded}
              >
                <span className="text-platform-fg-muted">
                  {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                </span>
                <span className="flex-1 text-left">{group.chapterName}</span>
                <span className="text-[10px] text-platform-fg-muted">
                  {group.nodes.length}
                </span>
              </button>

              {isExpanded && group.nodes.length > 0 && (
                <div className="ml-3 border-l border-platform-border">
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
                            ? '-ml-[1px] border-l-2 border-platform-action-primary bg-platform-action-subtle text-platform-fg-primary'
                            : 'text-platform-fg-secondary hover:bg-platform-surface-muted hover:text-platform-fg-primary'
                        }`}
                        title={node.description}
                      >
                        <span className="shrink-0">{getNodeTypeIcon(node.nodeType)}</span>
                        <span className="flex-1 truncate">{node.name}</span>
                        {node.bloomLevel && (
                          <span
                            className="shrink-0 rounded border border-platform-border bg-platform-surface-muted px-1 py-0.5 text-[9px] leading-none text-platform-fg-secondary"
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
      </div>
    </aside>
  );
}
