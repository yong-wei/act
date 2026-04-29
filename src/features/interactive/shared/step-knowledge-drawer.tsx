'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BookOpen, Moon, Settings, Sun } from 'lucide-react';

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useTheme } from '@/components/providers/theme-provider';
import {
  KnowledgeCard,
  normalizeKnowledgeMetadata,
} from '@/features/knowledge/knowledge-card';
import type { RuntimeLessonEntryBundle, RuntimeLessonEntryNode } from '@/lib/course-runtime';

function buildStepNodeMap(
  runtime: RuntimeLessonEntryBundle,
  orderedStepIds: string[],
) {
  const directMap = new Map<string, string[]>();

  for (const group of runtime.graphOverlay.groups) {
    for (const stepId of group.step_ids) {
      directMap.set(stepId, group.node_ids);
    }
  }

  if (orderedStepIds.every((stepId) => directMap.has(stepId))) {
    return directMap;
  }

  const flatStepIds = runtime.graphOverlay.groups.flatMap((group) => group.step_ids);
  const looksLikeLegacySequence = flatStepIds.every((stepId) => /^step-\d+$/i.test(stepId));
  if (!looksLikeLegacySequence || flatStepIds.length !== orderedStepIds.length) {
    return directMap;
  }

  const fallbackMap = new Map<string, string[]>();
  for (const group of runtime.graphOverlay.groups) {
    const translatedStepIds = group.step_ids
      .map((stepId) => {
        const match = /^step-(\d+)$/i.exec(stepId);
        if (!match) return null;
        const index = Number(match[1]) - 1;
        return orderedStepIds[index] ?? null;
      })
      .filter((stepId): stepId is string => Boolean(stepId));

    for (const stepId of translatedStepIds) {
      fallbackMap.set(stepId, group.node_ids);
    }
  }

  return fallbackMap;
}

export function StepKnowledgeDrawer({
  lessonRuntime,
  currentStepId,
  orderedStepIds,
  title = '页面知识卡片',
}: {
  lessonRuntime: RuntimeLessonEntryBundle;
  currentStepId: string;
  orderedStepIds: string[];
  title?: string;
}) {
  const menuRef = useRef<HTMLDivElement>(null);
  const { mounted, theme, toggleTheme } = useTheme();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const isDark = theme === 'dark';

  const nodesById = useMemo(
    () => new Map(lessonRuntime.graphOverlay.nodes.map((node) => [node.id, node])),
    [lessonRuntime.graphOverlay.nodes],
  );

  const stepNodeIds = useMemo(() => {
    const map = buildStepNodeMap(lessonRuntime, orderedStepIds);
    return map.get(currentStepId) ?? [];
  }, [currentStepId, lessonRuntime, orderedStepIds]);

  const nodes = useMemo(
    () => stepNodeIds.map((nodeId) => nodesById.get(nodeId)).filter((node): node is RuntimeLessonEntryNode => Boolean(node)),
    [nodesById, stepNodeIds],
  );

  const selectedNode = useMemo(() => {
    if (!nodes.length) return null;
    return nodes.find((node) => node.id === selectedNodeId) ?? nodes[0];
  }, [nodes, selectedNodeId]);

  const closeMenu = useCallback(() => setIsMenuOpen(false), []);

  const handleOutsideClick = useCallback((event: MouseEvent) => {
    if (!menuRef.current) return;
    if (!menuRef.current.contains(event.target as Node)) {
      setIsMenuOpen(false);
    }
  }, []);

  useEffect(() => {
    if (!isMenuOpen) return;
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [handleOutsideClick, isMenuOpen]);

  useEffect(() => {
    if (!isMenuOpen) return;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsMenuOpen(false);
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isMenuOpen]);

  if (!nodes.length) {
    return null;
  }

  return (
    <>
      <div ref={menuRef} data-lesson-floating-tools="true" className="no-print fixed bottom-4 right-4 z-[120]">
        {isMenuOpen ? (
          <div className="mb-3 w-56 rounded-2xl border border-border/70 bg-background/95 p-2 text-sm text-foreground shadow-2xl backdrop-blur">
            <button
              type="button"
              onClick={() => {
                toggleTheme();
                closeMenu();
              }}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition hover:bg-accent hover:text-accent-foreground"
              aria-label={isDark ? '切换到浅色主题' : '切换到深色主题'}
            >
              {mounted && isDark ? <Sun className="h-4 w-4 text-amber-500" /> : <Moon className="h-4 w-4 text-sky-600" />}
              <span className="flex-1">主题切换</span>
              <span className="text-xs text-muted-foreground">{mounted && isDark ? '浅色' : '深色'}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setSelectedNodeId(nodes[0]?.id ?? null);
                setIsOpen(true);
                closeMenu();
              }}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition hover:bg-accent hover:text-accent-foreground"
              aria-label="打开页面知识卡片"
            >
              <BookOpen className="h-4 w-4 text-cyan-500" />
              <span className="flex-1">知识卡片</span>
              <span className="text-xs text-muted-foreground">{nodes.length}</span>
            </button>
          </div>
        ) : null}

        <button
          type="button"
          onClick={() => setIsMenuOpen((prev) => !prev)}
          aria-expanded={isMenuOpen}
          aria-label="打开页面工具菜单"
          className="premium-lesson-action-primary h-12 w-12 rounded-full p-0 shadow-2xl"
        >
          <Settings className="h-5 w-5" />
        </button>
      </div>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="left-auto right-0 top-0 h-screen max-h-screen w-full max-w-4xl translate-x-0 translate-y-0 rounded-none border-l border-border bg-background p-0 text-foreground data-[state=closed]:slide-out-to-right-full data-[state=closed]:slide-out-to-top-0 data-[state=open]:slide-in-from-right-full data-[state=open]:slide-in-from-top-0 sm:max-w-4xl">
          <div className="grid h-full gap-0 md:grid-cols-[260px_1fr]">
            <div className="border-b border-border bg-muted/30 p-4 md:border-b-0 md:border-r">
              <DialogHeader className="text-left">
                <DialogTitle className="text-foreground">{title}</DialogTitle>
                <DialogDescription className="text-muted-foreground">
                  当前页面相关的知识卡片
                </DialogDescription>
              </DialogHeader>
              <div className="mt-4 space-y-2">
                {nodes.map((node, index) => (
                  <button
                    key={node.id}
                    type="button"
                    onClick={() => setSelectedNodeId(node.id)}
                    className={`w-full px-3 py-3 text-left ${
                      node.id === selectedNode?.id
                        ? 'premium-lesson-selectable-card premium-lesson-selectable-card-active'
                        : 'premium-lesson-selectable-card'
                    }`}
                  >
                    <div className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Card {index + 1}</div>
                    <div className="mt-2 text-sm font-semibold">{node.name}</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="overflow-y-auto p-4 md:p-6">
              {selectedNode ? (
                <KnowledgeCard
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
                  className="premium-lesson-surface-elevated shadow-none"
                />
              ) : null}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
