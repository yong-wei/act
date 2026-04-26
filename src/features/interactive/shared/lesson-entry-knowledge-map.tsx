'use client';

import { useMemo, useState } from 'react';
import { Network } from 'lucide-react';

import {
  createLessonKnowledgeMapLayout,
  getVisibleKnowledgeMapLinks,
  type KnowledgeMapInputNode,
} from '@/features/interactive/shared/lesson-entry-knowledge-map-layout';
import type { RuntimeLessonEntryBundle, RuntimeLessonEntryNode } from '@/lib/course-runtime';

const ARROW_MARKER_ID = 'lesson-entry-knowledge-map-arrow';

const NODE_TONES: Record<string, { bar: string; badge: string }> = {
  THEORY: {
    bar: 'hsl(var(--premium-tone-cyan-border))',
    badge: 'hsl(var(--premium-tone-cyan-bg) / 0.92)',
  },
  METHOD: {
    bar: 'hsl(var(--premium-tone-violet-border))',
    badge: 'hsl(var(--premium-tone-violet-bg) / 0.92)',
  },
  CASE: {
    bar: 'hsl(var(--premium-tone-amber-border))',
    badge: 'hsl(var(--premium-tone-amber-bg) / 0.92)',
  },
  TOOL: {
    bar: 'hsl(var(--premium-tone-emerald-border))',
    badge: 'hsl(var(--premium-tone-emerald-bg) / 0.92)',
  },
};

function getNodeBadge(node: KnowledgeMapInputNode) {
  const nodeType = String(node.nodeType ?? '').toUpperCase();
  if (nodeType === 'THEORY') return '概念';
  if (nodeType === 'METHOD') return '方法';
  if (nodeType === 'CASE') return '案例';
  if (nodeType === 'TOOL') return '工具';
  return node.knowledgeDim ?? node.nodeType ?? '知识';
}

function getNodeTone(node: KnowledgeMapInputNode) {
  return NODE_TONES[String(node.nodeType ?? '').toUpperCase()] ?? {
    bar: 'hsl(var(--premium-lesson-graph-node-stroke))',
    badge: 'hsl(var(--premium-lesson-surface-muted) / 0.94)',
  };
}

function getRelationLabelPoint(link: { x1: number; y1: number; x2: number; y2: number; relationLabel: string | null }) {
  const dx = link.x2 - link.x1;
  const dy = link.y2 - link.y1;
  const distance = Math.hypot(dx, dy) || 1;
  const direction = link.relationLabel === '前置' ? -1 : 1;
  const progress = link.relationLabel === '前置' ? 0.68 : 0.32;
  const perpendicularOffset = Math.abs(dx) < 80 ? 118 : 46;
  return {
    x: link.x1 + dx * progress + (-dy / distance) * perpendicularOffset * direction,
    y: link.y1 + dy * progress + (dx / distance) * perpendicularOffset * direction,
  };
}

export function LessonEntryKnowledgeMap({
  graphOverlay,
  selectedNodeId,
  onSelectNode,
}: {
  graphOverlay: RuntimeLessonEntryBundle['graphOverlay'];
  selectedNodeId: string | null;
  onSelectNode: (node: RuntimeLessonEntryNode) => void;
}) {
  const [showAllRelations, setShowAllRelations] = useState(false);
  const layout = useMemo(
    () => createLessonKnowledgeMapLayout({
      nodes: graphOverlay.nodes,
      links: graphOverlay.links,
      groups: graphOverlay.groups,
      cardOrder: graphOverlay.card_order,
    }),
    [graphOverlay.card_order, graphOverlay.groups, graphOverlay.links, graphOverlay.nodes],
  );
  const visibleLinks = useMemo(
    () => getVisibleKnowledgeMapLinks(layout, selectedNodeId, showAllRelations),
    [layout, selectedNodeId, showAllRelations],
  );

  return (
    <div className="premium-lesson-panel min-w-0 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="premium-lesson-title flex items-center gap-2 text-sm font-medium">
            <Network className="h-4 w-4" />
            本课知识点网络
          </div>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            点击任意节点查看卡片正面内容，再用“详情”展开完整知识卡。
          </p>
        </div>
        <label className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/40 px-3 py-1.5 text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={showAllRelations}
            onChange={(event) => setShowAllRelations(event.target.checked)}
            className="h-3.5 w-3.5 accent-cyan-500"
          />
          显示全部关系
        </label>
      </div>

      <div className="premium-lesson-panel-soft mt-4 max-w-full overflow-x-auto overflow-y-hidden rounded-[22px] p-0">
        <div
          className="relative"
          data-knowledge-map="lesson-entry"
          style={{ width: layout.width, height: layout.height }}
        >
          <svg
            className="pointer-events-none absolute inset-0"
            width={layout.width}
            height={layout.height}
            viewBox={`0 0 ${layout.width} ${layout.height}`}
          >
            <defs>
              <marker id={ARROW_MARKER_ID} markerWidth="14" markerHeight="14" refX="12" refY="6" orient="auto">
                <path d="M0,0 L14,6 L0,12 z" fill="hsl(var(--premium-lesson-graph-edge-active))" />
              </marker>
            </defs>
            {visibleLinks.map((link) => {
              const highlighted = selectedNodeId === link.sourceId || selectedNodeId === link.targetId;
              return (
                <g key={link.id}>
                  <line
                    x1={link.x1}
                    y1={link.y1}
                    x2={link.x2}
                    y2={link.y2}
                    stroke={highlighted ? 'hsl(var(--premium-lesson-graph-edge-active))' : 'hsl(var(--premium-lesson-graph-edge))'}
                    strokeWidth={highlighted ? 2.8 : 1.35}
                    opacity={highlighted ? 0.95 : 0.34}
                    markerEnd={`url(#${ARROW_MARKER_ID})`}
                  />
                  {link.relationLabel ? (
                    <g>
                      {(() => {
                        const labelPoint = getRelationLabelPoint(link);
                        return (
                          <>
                            <rect
                              x={labelPoint.x - 23}
                              y={labelPoint.y - 12}
                              rx={10}
                              width={46}
                              height={20}
                              fill="hsl(var(--premium-lesson-graph-label-bg))"
                              stroke="hsl(var(--premium-lesson-graph-label-stroke))"
                            />
                            <text
                              x={labelPoint.x}
                              y={labelPoint.y}
                              textAnchor="middle"
                              dominantBaseline="central"
                              fontSize={11}
                              fill="hsl(var(--premium-lesson-graph-label-text))"
                            >
                              {link.relationLabel}
                            </text>
                          </>
                        );
                      })()}
                    </g>
                  ) : null}
                </g>
              );
            })}
          </svg>

          {layout.columns.map((column) => (
            <div
              key={column.id}
              className="absolute top-5 flex items-center justify-center text-center text-xs font-medium text-muted-foreground"
              style={{ left: column.x, width: column.width }}
            >
              {column.title}
            </div>
          ))}

          {layout.nodes.map((positionedNode) => {
            const active = positionedNode.node.id === selectedNodeId;
            const tone = getNodeTone(positionedNode.node);
            return (
              <button
                key={positionedNode.node.id}
                type="button"
                data-knowledge-map-node="true"
                data-node-id={positionedNode.node.id}
                onClick={() => onSelectNode(positionedNode.node as RuntimeLessonEntryNode)}
                className={`absolute overflow-hidden rounded-[16px] border px-3 py-2 text-left shadow-sm transition ${
                  active
                    ? 'border-[hsl(var(--premium-lesson-graph-node-active-stroke))] bg-[hsl(var(--premium-lesson-graph-node-active-fill))]'
                    : 'border-[hsl(var(--premium-lesson-graph-node-stroke))] bg-[hsl(var(--premium-lesson-graph-node-fill))] hover:bg-[hsl(var(--premium-lesson-highlight-surface))]'
                }`}
                style={{
                  left: positionedNode.x,
                  top: positionedNode.y,
                  width: layout.nodeWidth,
                  height: layout.nodeHeight,
                }}
              >
                <span className="absolute inset-y-0 left-0 w-1.5" style={{ background: tone.bar }} />
                <span className="flex min-w-0 items-start justify-between gap-2 pl-1.5">
                  <span className="min-w-0">
                    <span className="line-clamp-2 text-sm font-semibold leading-5 text-[hsl(var(--premium-lesson-graph-node-text))]">
                      {positionedNode.node.name}
                    </span>
                    <span className="mt-1 inline-flex max-w-full items-center truncate rounded-full border border-white/15 px-2 py-0.5 text-[10px] text-[hsl(var(--premium-lesson-graph-node-text))]" style={{ background: tone.badge }}>
                      {getNodeBadge(positionedNode.node)}
                    </span>
                  </span>
                  <span className="flex shrink-0 flex-col items-end gap-1 text-[10px] font-medium text-[hsl(var(--premium-lesson-graph-node-text))]">
                    <span title="前置数量">←{positionedNode.incomingCount}</span>
                    <span title="后置数量">→{positionedNode.outgoingCount}</span>
                  </span>
                </span>
              </button>
            );
          })}
        </div>
        <div className="border-t border-border/70 px-4 py-3 text-xs text-muted-foreground">
          箭头方向表示前置 → 后置关系；默认只显示当前节点的一跳关系。
        </div>
      </div>
    </div>
  );
}
