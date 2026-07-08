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
  if (nodeType === 'SCENARIO') return <Square className="h-3 w-3 text-platform-evaluation-preview" />;
  if (nodeType === 'ETHICS') return <Hexagon className="h-3 w-3 text-platform-replay-ready" />;
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
    return buildChapterGroups(nodes);
  }, [nodes]);

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
    <section
      aria-label="知识图谱章节目录"
      className="h-full w-full overflow-y-auto rounded-lg border border-platform-border bg-platform-surface/95 text-platform-fg-primary backdrop-blur"
      data-knowledge-local-panel="chapter-directory"
    >
      <div className="sticky top-0 z-10 border-b border-platform-border bg-platform-surface/95 px-3 py-3 backdrop-blur">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold text-platform-fg-primary">
          章节目录
        </h2>
      </div>

      <div className="border-b border-platform-border px-3 py-2">
        <div className="flex items-center gap-2 rounded-md border border-platform-border bg-platform-canvas-muted px-2.5 py-1.5">
          <Search className="h-3.5 w-3.5 text-platform-fg-muted" />
          <input aria-label="搜索知识点..."
            type="text"
            placeholder="搜索知识点..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full bg-transparent text-xs text-platform-fg-primary outline-none placeholder:text-platform-fg-muted"
          />
        </div>
      </div>

      <nav className="py-2">
        {chapterGroups.map((group) => {
          const isExpanded = expandedGroups[group.chapterName];
          return (
            <div key={group.chapterName} className="mb-1">
              <button type="button"
                onClick={() => toggleChapter(group.chapterName)}
                className="flex w-full items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-platform-fg-secondary transition-colors hover:bg-platform-action-subtle hover:text-platform-fg-primary"
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
                      <button type="button"
                        key={node.id}
                        onClick={() => onNodeSelect(node)}
                        onMouseEnter={() => onNodeHover?.(node)}
                        onMouseLeave={() => onNodeHover?.(null)}
                        onFocus={() => onNodeHover?.(node)}
                        onBlur={() => onNodeHover?.(null)}
                        className={`flex w-full items-center gap-1.5 py-1 pl-3 pr-2 text-left text-xs transition-colors ${
                          isSelected
                            ? 'border-l-2 border-platform-action-primary -ml-[1px] bg-platform-action-subtle text-platform-fg-primary'
                            : 'text-platform-fg-secondary hover:bg-platform-action-subtle hover:text-platform-fg-primary'
                        }`}
                        title={node.description}
                      >
                        <span className="shrink-0">{getNodeTypeIcon(node.nodeType)}</span>
                        <span className="flex-1 truncate">{node.name}</span>
                        {node.bloomLevel && (
                          <span
                            className="shrink-0 rounded border border-platform-replay-ready bg-platform-action-subtle px-1 py-0.5 text-[9px] leading-none text-platform-fg-secondary"
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
    </section>
  );
}
