'use client';

import { useEffect, useMemo, useState } from 'react';
import { BookOpen, Download, Network, PanelTopOpen, Sparkles } from 'lucide-react';

import 'katex/dist/katex.min.css';

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { MdxSlide } from '@/components/shared/mdx-slide';
import { useResourceInteractionTracking } from '@/features/interactive/hooks/useResourceInteractionTracking';
import { KnowledgeCard, normalizeKnowledgeMetadata } from '@/features/knowledge/knowledge-card';
import { downloadLessonHandoutPdf } from '@/features/interactive/shared/download-handout-pdf';
import type { RuntimeLessonEntryBundle, RuntimeLessonEntryNode } from '@/lib/course-runtime';

const surfaceClassName =
  'premium-lesson-panel p-4';
const KNOWLEDGE_ARROW_MARKER_WIDTH = 14;
const KNOWLEDGE_ARROW_REF_X = 12;
const KNOWLEDGE_ARROW_TARGET_PADDING = 16;
const GRAPH_THEME = {
  edge: 'hsl(var(--premium-lesson-graph-edge))',
  edgeActive: 'hsl(var(--premium-lesson-graph-edge-active))',
  nodeFill: 'hsl(var(--premium-lesson-graph-node-fill))',
  nodeStroke: 'hsl(var(--premium-lesson-graph-node-stroke))',
  nodeActiveFill: 'hsl(var(--premium-lesson-graph-node-active-fill))',
  nodeActiveStroke: 'hsl(var(--premium-lesson-graph-node-active-stroke))',
  nodeText: 'hsl(var(--premium-lesson-graph-node-text))',
  labelBg: 'hsl(var(--premium-lesson-graph-label-bg))',
  labelStroke: 'hsl(var(--premium-lesson-graph-label-stroke))',
  labelText: 'hsl(var(--premium-lesson-graph-label-text))',
};

function useGraphLayout(nodes: RuntimeLessonEntryNode[]) {
  return useMemo(() => {
    if (!nodes.length) return [] as Array<RuntimeLessonEntryNode & { svgX: number; svgY: number }>;

    const minX = Math.min(...nodes.map((node) => node.positionX));
    const maxX = Math.max(...nodes.map((node) => node.positionX));
    const minY = Math.min(...nodes.map((node) => node.positionY));
    const maxY = Math.max(...nodes.map((node) => node.positionY));

    const width = Math.max(maxX - minX, 1);
    const height = Math.max(maxY - minY, 1);

    return nodes.map((node) => ({
      ...node,
      svgX: 80 + ((node.positionX - minX) / width) * 840,
      svgY: 60 + ((node.positionY - minY) / height) * 360,
    }));
  }, [nodes]);
}

function useIsLightTheme() {
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

  return isLightTheme;
}

function resolveRelationLabel(link: RuntimeLessonEntryBundle['graphOverlay']['links'][number], selectedNodeId: string | null) {
  if (!selectedNodeId) return null;
  if (link.sourceId === selectedNodeId) return '后置';
  if (link.targetId === selectedNodeId) return '前置';
  return null;
}

function getNodeRadius(nodeId: string, selectedNodeId: string | null) {
  return nodeId === selectedNodeId ? 18 : 14;
}

function getEdgeLinePoints({
  source,
  target,
  selectedNodeId,
}: {
  source: RuntimeLessonEntryNode & { svgX: number; svgY: number };
  target: RuntimeLessonEntryNode & { svgX: number; svgY: number };
  selectedNodeId: string | null;
}) {
  const dx = target.svgX - source.svgX;
  const dy = target.svgY - source.svgY;
  const distance = Math.hypot(dx, dy) || 1;
  const sourceOffset = getNodeRadius(source.id, selectedNodeId) + 2;
  const targetOffset = getNodeRadius(target.id, selectedNodeId) + KNOWLEDGE_ARROW_TARGET_PADDING;

  return {
    x1: source.svgX + (dx / distance) * sourceOffset,
    y1: source.svgY + (dy / distance) * sourceOffset,
    x2: target.svgX - (dx / distance) * targetOffset,
    y2: target.svgY - (dy / distance) * targetOffset,
  };
}

export function LessonEntryRuntimeSections({
  runtime,
  hideHandoutEntry = false,
}: {
  runtime: RuntimeLessonEntryBundle;
  hideHandoutEntry?: boolean;
}) {
  const lessonId = runtime.lesson.lesson_id;
  const tracker = useResourceInteractionTracking({
    resourceKey: `lesson-entry:${lessonId}:knowledge-graph`,
    lessonKey: lessonId,
    surface: 'lesson_entry',
    pageType: 'knowledge',
    targetType: 'knowledge_hub',
    targetId: lessonId,
    targetLabel: runtime.lesson.title,
    moduleId: lessonId,
    provider: 'lesson-entry-runtime-sections',
  });
  const isLightTheme = useIsLightTheme();
  const positionedNodes = useGraphLayout(runtime.graphOverlay.nodes);
  const nodeById = useMemo(
    () => new Map(positionedNodes.map((node) => [node.id, node])),
    [positionedNodes],
  );

  const orderedNodes = useMemo(() => {
    const order = runtime.graphOverlay.card_order;
    const seen = new Set<string>();
    return order
      .map((id) => nodeById.get(id))
      .filter((node): node is RuntimeLessonEntryNode & { svgX: number; svgY: number } => Boolean(node))
      .filter((node) => {
        if (seen.has(node.id)) return false;
        seen.add(node.id);
        return true;
      });
  }, [runtime.graphOverlay.card_order, nodeById]);

  const defaultNodeId = runtime.graphOverlay.entry_nodes?.[0] ?? orderedNodes[0]?.id ?? positionedNodes[0]?.id ?? null;
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(defaultNodeId);
  const [isHandoutOpen, setIsHandoutOpen] = useState(false);
  const [isExportingHandout, setIsExportingHandout] = useState(false);

  const selectedNode = selectedNodeId ? nodeById.get(selectedNodeId) ?? orderedNodes[0] ?? null : orderedNodes[0] ?? null;

  const handleHandoutExport = async () => {
    if (isExportingHandout) {
      return;
    }

    setIsExportingHandout(true);
    try {
      await downloadLessonHandoutPdf({
        lessonId: runtime.lesson.lesson_id,
        lessonTitle: runtime.lesson.title,
        handoutPdfPath: runtime.handoutPdfPath,
      });
    } catch (error) {
      window.alert(error instanceof Error ? error.message : '讲义 PDF 导出失败，请稍后重试。');
    } finally {
      setIsExportingHandout(false);
    }
  };

  return (
    <>
      <section className="mt-5 grid gap-4 lg:grid-cols-[1.35fr_0.95fr]">
        <div className={surfaceClassName}>
          <div className="premium-lesson-title flex items-center gap-2 text-sm font-medium">
            <Network className="h-4 w-4" />
            本课知识点网络
          </div>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            点击任意节点查看卡片正面内容，再用“详情”展开完整知识卡。
          </p>
          <div className="premium-lesson-panel-soft mt-4 overflow-hidden rounded-[22px]">
            <svg viewBox="0 0 1000 480" className="h-[320px] w-full">
              <defs>
                <marker
                  id="knowledge-arrow"
                  markerWidth={KNOWLEDGE_ARROW_MARKER_WIDTH}
                  markerHeight={KNOWLEDGE_ARROW_MARKER_WIDTH}
                  refX={KNOWLEDGE_ARROW_REF_X}
                  refY="6"
                  orient="auto-start-reverse"
                >
                  <path d="M0,0 L14,6 L0,12 z" fill={GRAPH_THEME.edgeActive} />
                </marker>
              </defs>
              {runtime.graphOverlay.links.map((link) => {
                const source = nodeById.get(link.sourceId);
                const target = nodeById.get(link.targetId);
                if (!source || !target) return null;
                const highlighted = selectedNodeId && (link.sourceId === selectedNodeId || link.targetId === selectedNodeId);
                const relationLabel = resolveRelationLabel(link, selectedNodeId);
                const line = getEdgeLinePoints({ source, target, selectedNodeId });
                const midX = (line.x1 + line.x2) / 2;
                const midY = (line.y1 + line.y2) / 2;
                return (
                  <g key={link.id}>
                    <line
                      x1={line.x1}
                      y1={line.y1}
                      x2={line.x2}
                      y2={line.y2}
                      stroke={highlighted ? GRAPH_THEME.edgeActive : GRAPH_THEME.edge}
                      strokeWidth={highlighted ? 3 : 1.6}
                      opacity={highlighted ? 0.95 : 0.85}
                      markerEnd="url(#knowledge-arrow)"
                    />
                    {relationLabel ? (
                      <>
                        <rect
                          x={midX - 24}
                          y={midY - 14}
                          rx={10}
                          width={48}
                          height={20}
                          fill={GRAPH_THEME.labelBg}
                          stroke={GRAPH_THEME.labelStroke}
                        />
                        <text
                          x={midX}
                          y={midY}
                          textAnchor="middle"
                          dominantBaseline="central"
                          fontSize={11}
                          fill={GRAPH_THEME.labelText}
                          className="select-none"
                        >
                          {relationLabel}
                        </text>
                      </>
                    ) : null}
                  </g>
                );
              })}

              {positionedNodes.map((node) => {
                const active = node.id === selectedNodeId;
                return (
                  <g
                    key={node.id}
                    transform={`translate(${node.svgX}, ${node.svgY})`}
                    className="cursor-pointer"
                    onClick={() => {
                      tracker.trackKnowledgeNodeFocus({
                        resourceKey: `knowledge-node:${node.id}`,
                        targetType: 'knowledge_node',
                        targetId: node.id,
                        targetLabel: node.name,
                      });
                      setSelectedNodeId(node.id);
                    }}
                  >
                    <circle
                      r={active ? 18 : 14}
                      fill={active ? GRAPH_THEME.nodeActiveFill : GRAPH_THEME.nodeFill}
                      stroke={active ? GRAPH_THEME.nodeActiveStroke : GRAPH_THEME.nodeStroke}
                      strokeWidth={active ? 4 : 2}
                    />
                    <text
                      y={active ? 42 : 36}
                      textAnchor="middle"
                      fontSize={active ? 16 : 14}
                      fill={GRAPH_THEME.nodeText}
                      className="select-none font-medium"
                    >
                      {node.name}
                    </text>
                  </g>
                );
              })}
            </svg>
            <div className="border-t border-border/70 px-4 py-3 text-xs text-muted-foreground">
              箭头方向表示前置 → 后置关系。
            </div>
          </div>
        </div>

        <div className={surfaceClassName}>
          <div className="premium-lesson-title flex items-center gap-2 text-sm font-medium">
            <Sparkles className="h-4 w-4" />
            节点卡片正面
          </div>
          {selectedNode ? (
            <div className="mt-3">
              <KnowledgeCard
                trackingContext={{
                  resourceKey: `lesson-entry:${lessonId}:knowledge-card:${selectedNode.id}`,
                  lessonKey: lessonId,
                  surface: 'lesson_entry',
                  pageType: 'knowledge',
                  targetType: 'knowledge_card',
                  targetId: selectedNode.id,
                  targetLabel: selectedNode.name,
                  moduleId: lessonId,
                  provider: 'lesson-entry-runtime-sections',
                }}
                name={selectedNode.name}
                description={selectedNode.description}
                nodeType={selectedNode.nodeType}
                bloomLevel={selectedNode.bloomLevel}
                knowledgeDim={selectedNode.knowledgeDim}
                metadata={normalizeKnowledgeMetadata({
                  metadata: selectedNode.metadata,
                  content: selectedNode.content,
                  description: selectedNode.description,
                })}
                resources={selectedNode.resources}
                variant="compact"
                className="border border-border bg-card text-card-foreground"
              />
            </div>
          ) : (
            <p className="mt-4 text-sm text-muted-foreground">当前没有可展示的节点。</p>
          )}
        </div>
      </section>

      <section className={`mt-4 ${surfaceClassName}`}>
        <div className="premium-lesson-title flex items-center gap-2 text-sm font-medium">
          <BookOpen className="h-4 w-4" />
          知识卡片预览
        </div>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          展示本课知识卡片顺序，便于在进入课堂前先建立知识主线。
        </p>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {orderedNodes.map((node, index) => (
            <button
              key={node.id}
              type="button"
              onClick={() => {
                tracker.trackKnowledgeNodeFocus({
                  resourceKey: `knowledge-node:${node.id}`,
                  targetType: 'knowledge_node',
                  targetId: node.id,
                  targetLabel: node.name,
                });
                setSelectedNodeId(node.id);
              }}
              className={`rounded-[20px] px-4 py-4 text-left ${
                node.id === selectedNodeId
                  ? 'premium-lesson-selectable-card premium-lesson-selectable-card-active'
                  : 'premium-lesson-selectable-card'
              }`}
            >
              <div className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Card {index + 1}</div>
              <div className="mt-2 text-lg font-semibold text-foreground">{node.name}</div>
              <div className="mt-2 text-sm leading-6 text-muted-foreground line-clamp-3">{node.description}</div>
            </button>
          ))}
        </div>
      </section>

      {hideHandoutEntry ? null : (
        <section className={`mt-4 ${surfaceClassName}`}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="premium-lesson-title flex items-center gap-2 text-sm font-medium">
                <PanelTopOpen className="h-4 w-4" />
                讲义入口
              </div>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
                {runtime.handoutSummary}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  tracker.trackResourceDownload({
                    resourceKey: `lesson-entry:${lessonId}:handout`,
                    targetType: 'handout',
                    targetId: 'handout',
                    targetLabel: '讲义',
                  });
                  void handleHandoutExport();
                }}
                disabled={isExportingHandout}
                className="premium-lesson-action-secondary"
              >
                <Download className="h-4 w-4" />
                {isExportingHandout ? '导出中...' : '导出 PDF'}
              </button>
              <button
                type="button"
                onClick={() => {
                  tracker.trackResourceOpen({
                    resourceKey: `lesson-entry:${lessonId}:handout`,
                    targetType: 'handout',
                    targetId: 'handout',
                    targetLabel: '讲义',
                    openMode: 'dialog',
                  });
                  setIsHandoutOpen(true);
                }}
                className="premium-lesson-action-primary"
              >
                查看讲义
              </button>
            </div>
          </div>
        </section>
      )}
      {hideHandoutEntry ? null : (
        <LessonEntryHandoutDialog
          runtime={runtime}
          open={isHandoutOpen}
          onOpenChange={setIsHandoutOpen}
          isExportingHandout={isExportingHandout}
          onHandoutExport={() => void handleHandoutExport()}
        />
      )}
    </>
  );
}

export function LessonEntryHandoutDialog({
  runtime,
  open,
  onOpenChange,
  isExportingHandout,
  onHandoutExport,
}: {
  runtime: RuntimeLessonEntryBundle;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isExportingHandout: boolean;
  onHandoutExport: () => void;
}) {
  const isLightTheme = useIsLightTheme();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl border-border bg-background p-0 text-foreground">
        <DialogHeader className="border-b border-border px-6 py-4">
          <div className="flex flex-wrap items-center justify-between gap-3 pr-10">
            <DialogTitle className="text-foreground">{runtime.lesson.lesson_id} 讲义</DialogTitle>
            <DialogDescription className="sr-only">
              {runtime.handoutSummary}
            </DialogDescription>
            <button
              type="button"
              onClick={onHandoutExport}
              disabled={isExportingHandout}
              className="premium-lesson-action-secondary"
            >
              <Download className="h-4 w-4" />
              {isExportingHandout ? '导出中...' : '导出 PDF'}
            </button>
          </div>
        </DialogHeader>
        <div className="max-h-[75vh] overflow-y-auto p-6">
          <MdxSlide path={runtime.handoutSourcePath} theme={isLightTheme ? 'light' : 'dark'} size="adaptive" />
        </div>
      </DialogContent>
    </Dialog>
  );
}
