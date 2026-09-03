'use client';

import { useEffect, useMemo, useState } from 'react';
import { BookOpen, Download, PanelTopOpen, Sparkles } from 'lucide-react';

import 'katex/dist/katex.min.css';

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { MdxSlide } from '@/components/shared/mdx-slide';
import { useResourceInteractionTracking } from '@/features/interactive/hooks/useResourceInteractionTracking';
import { KnowledgeCard, normalizeKnowledgeMetadata } from '@/features/knowledge/knowledge-card';
import { downloadLessonHandoutPdf } from '@/features/interactive/shared/download-handout-pdf';
import { createLessonKnowledgeMapLayout } from '@/features/interactive/shared/lesson-entry-knowledge-map-layout';
import {
  LessonEntryKnowledgeMap,
} from '@/features/interactive/shared/lesson-entry-knowledge-map';
import type { RuntimeLessonEntryBundle, RuntimeLessonEntryNode } from '@/lib/course-bundle';

const surfaceClassName =
  'premium-lesson-panel p-4';

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

export function LessonEntryRuntimeSections({
  runtime,
  hideHandoutEntry = true,
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
  const mapLayout = useMemo(
    () => createLessonKnowledgeMapLayout({
      nodes: runtime.graphOverlay.nodes,
      links: runtime.graphOverlay.links,
      groups: runtime.graphOverlay.groups,
      cardOrder: runtime.graphOverlay.card_order,
    }),
    [
      runtime.graphOverlay.card_order,
      runtime.graphOverlay.groups,
      runtime.graphOverlay.links,
      runtime.graphOverlay.nodes,
    ],
  );
  const nodeById = useMemo(
    () => new Map(runtime.graphOverlay.nodes.map((node) => [node.id, node])),
    [runtime.graphOverlay.nodes],
  );

  const orderedNodes = useMemo(() => {
    const order = runtime.graphOverlay.card_order;
    const seen = new Set<string>();
    const nodesByCardOrder = order
      .map((id) => nodeById.get(id))
      .filter((node): node is RuntimeLessonEntryNode => Boolean(node))
      .filter((node) => {
        if (seen.has(node.id)) return false;
        seen.add(node.id);
        return true;
      });
    return nodesByCardOrder.length
      ? nodesByCardOrder
      : mapLayout.nodes.map((positionedNode) => positionedNode.node as RuntimeLessonEntryNode);
  }, [mapLayout.nodes, runtime.graphOverlay.card_order, nodeById]);

  const defaultNodeId = runtime.graphOverlay.entry_nodes?.[0] ?? orderedNodes[0]?.id ?? mapLayout.nodes[0]?.node.id ?? null;
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(defaultNodeId);
  const [isHandoutOpen, setIsHandoutOpen] = useState(false);
  const [isExportingHandout, setIsExportingHandout] = useState(false);

  const selectedNode = selectedNodeId ? nodeById.get(selectedNodeId) ?? orderedNodes[0] ?? null : orderedNodes[0] ?? null;

  useEffect(() => {
    setSelectedNodeId((currentNodeId) => {
      if (currentNodeId && nodeById.has(currentNodeId)) return currentNodeId;
      return defaultNodeId;
    });
  }, [defaultNodeId, nodeById]);

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
      <section className="mt-5 grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,0.95fr)]">
        <LessonEntryKnowledgeMap
          graphOverlay={runtime.graphOverlay}
          selectedNodeId={selectedNodeId}
          onSelectNode={(node) => {
            tracker.trackKnowledgeNodeFocus({
              resourceKey: `knowledge-node:${node.id}`,
              targetType: 'knowledge_node',
              targetId: node.id,
              targetLabel: node.name,
            });
            setSelectedNodeId(node.id);
          }}
        />

        <div className={`${surfaceClassName} min-w-0`}>
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
