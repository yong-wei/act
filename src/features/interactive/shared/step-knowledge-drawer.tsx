'use client';

import { useEffect, useMemo, useState } from 'react';
import { BookOpen } from 'lucide-react';

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { usePageFloatingControls } from '@/components/shared/page-floating-controls';
import {
  KnowledgeCard,
  normalizeKnowledgeMetadata,
} from '@/features/knowledge/knowledge-card';
import {
  teachingResourceTypeLabel,
  teachingRoleLabel,
  type StepDrawerResolution,
} from '@/features/knowledge/layered-graph-workspace-contracts';
import type { RuntimeLessonEntryBundle, RuntimeLessonEntryNode } from '@/lib/course-bundle';

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

function layeredEntryByCanonical(
  entries: readonly StepDrawerResolution[] | undefined,
  canonicalId: string,
): StepDrawerResolution | null {
  if (!entries?.length) return null;
  return entries.find((entry) => entry.canonicalId === canonicalId) ?? null;
}

/**
 * Step knowledge drawer. Legacy path uses lesson runtime graph overlay nodes.
 * When `layeredDrawerEntries` is provided (from Teaching Projection consumers),
 * optional-card absence shows node summary / linked resources instead of a
 * node-not-found error (#1273).
 */
export function StepKnowledgeDrawer({
  lessonRuntime,
  currentStepId,
  orderedStepIds,
  title = '页面知识卡片',
  inlineTool = false,
  layeredDrawerEntries,
}: {
  lessonRuntime: RuntimeLessonEntryBundle;
  currentStepId: string;
  orderedStepIds: string[];
  title?: string;
  inlineTool?: boolean;
  /**
   * Optional pre-resolved Teaching Projection drawer entries for this step
   * (step.knowledgeRefs → canonicalId → optional card).
   */
  layeredDrawerEntries?: readonly StepDrawerResolution[];
}) {
  const { registerControl } = usePageFloatingControls();
  const [isOpen, setIsOpen] = useState(false);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  const nodesById = useMemo(
    () => new Map(lessonRuntime.graphOverlay.nodes.map((node) => [node.id, node])),
    [lessonRuntime.graphOverlay.nodes],
  );

  const stepNodeIds = useMemo(() => {
    if (layeredDrawerEntries && layeredDrawerEntries.length > 0) {
      return layeredDrawerEntries.map((entry) => entry.canonicalId);
    }
    const map = buildStepNodeMap(lessonRuntime, orderedStepIds);
    return map.get(currentStepId) ?? [];
  }, [currentStepId, layeredDrawerEntries, lessonRuntime, orderedStepIds]);

  const nodes = useMemo(() => {
    if (layeredDrawerEntries && layeredDrawerEntries.length > 0) {
      return layeredDrawerEntries.map((entry) => {
        const runtimeNode = nodesById.get(entry.canonicalId);
        if (runtimeNode) return runtimeNode;
        // Card-absent path: synthesize a summary node from layered resolution.
        // Never surface node-not-found when Canonical summary exists.
        return {
          id: entry.canonicalId,
          name: entry.summary.title ?? entry.canonicalId,
          nodeType: entry.summary.engineeringType ?? 'THEORY',
          description: entry.summary.description ?? entry.studentMessage,
          positionX: 0,
          positionY: 0,
          positionZ: 0,
          resources: entry.linkedResources.map((resource) => ({
            id: resource.resourceId,
            title: resource.title ?? teachingResourceTypeLabel(resource.resourceType),
            href: resource.launch.href,
            role: teachingRoleLabel(resource.role),
          })),
        } as RuntimeLessonEntryNode;
      });
    }
    return stepNodeIds
      .map((nodeId) => nodesById.get(nodeId))
      .filter((node): node is RuntimeLessonEntryNode => Boolean(node));
  }, [layeredDrawerEntries, nodesById, stepNodeIds]);

  const selectedNode = useMemo(() => {
    if (!nodes.length) return null;
    return nodes.find((node) => node.id === selectedNodeId) ?? nodes[0];
  }, [nodes, selectedNodeId]);

  const selectedLayered = useMemo(
    () => (selectedNode ? layeredEntryByCanonical(layeredDrawerEntries, selectedNode.id) : null),
    [layeredDrawerEntries, selectedNode],
  );

  useEffect(() => {
    if (!nodes.length) return undefined;

    return registerControl({
      id: 'lesson-step-knowledge-card',
      label: '知识卡片',
      priority: 20,
      icon: <BookOpen className="h-4 w-4 text-cyan-500" />,
      badge: <span className="text-xs text-muted-foreground">{nodes.length}</span>,
      ariaLabel: '打开页面知识卡片',
      onSelect: () => {
        setSelectedNodeId(nodes[0]?.id ?? null);
        setIsOpen(true);
      },
    });
  }, [nodes, registerControl]);

  if (!nodes.length && !inlineTool) {
    return null;
  }

  if (!nodes.length) {
    return (
      <div
        className="rounded-md border border-platform-border bg-platform-surface-muted px-3 py-3 text-sm text-platform-fg-secondary"
        data-step-knowledge-inline-tool="empty"
      >
        本页暂无知识卡片。
      </div>
    );
  }

  return (
    <>
      {inlineTool ? (
        <button
          type="button"
          onClick={() => {
            setSelectedNodeId(nodes[0]?.id ?? null);
            setIsOpen(true);
          }}
          className="flex w-full items-start gap-3 rounded-md border border-platform-border bg-platform-surface-muted px-3 py-3 text-left text-sm text-platform-fg-primary transition hover:border-platform-action-primary/60 hover:bg-platform-surface"
          data-step-knowledge-inline-tool="trigger"
        >
          <BookOpen className="mt-0.5 h-4 w-4 flex-none text-platform-action-primary" />
          <span className="min-w-0">
            <span className="block font-medium">{title}</span>
            <span className="mt-1 block text-xs leading-5 text-platform-fg-secondary">
              查看当前页面关联的 {nodes.length} 张知识卡片。
            </span>
          </span>
        </button>
      ) : null}
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
              {selectedLayered && selectedLayered.cardStatus !== 'active-card' ? (
                <div
                  className="space-y-4"
                  data-step-knowledge-layered="summary"
                  data-card-status={selectedLayered.cardStatus}
                  data-node-not-found={selectedLayered.nodeNotFound ? 'true' : 'false'}
                >
                  <div className="rounded-md border border-platform-border bg-platform-surface-muted px-3 py-3 text-sm text-platform-fg-secondary">
                    {selectedLayered.studentMessage}
                    {selectedLayered.fallback ? (
                      <div className="mt-2 text-xs text-platform-fg-secondary" data-fallback-adapter={selectedLayered.fallback.adapterId}>
                        兼容来源：{selectedLayered.fallback.adapterId}
                      </div>
                    ) : null}
                  </div>
                  <KnowledgeCard
                    name={selectedLayered.summary.title ?? selectedLayered.canonicalId}
                    description={selectedLayered.summary.description ?? selectedLayered.studentMessage}
                    nodeType={selectedLayered.summary.engineeringType ?? 'THEORY'}
                    metadata={normalizeKnowledgeMetadata({
                      description: selectedLayered.summary.description ?? selectedLayered.studentMessage,
                    })}
                    resources={selectedLayered.linkedResources.map((resource) => ({
                      id: resource.resourceId,
                      title: resource.title ?? teachingResourceTypeLabel(resource.resourceType),
                      href: resource.launch.href,
                      role: teachingRoleLabel(resource.role),
                    }))}
                    variant="compact"
                    className="premium-lesson-surface-elevated shadow-none"
                  />
                </div>
              ) : selectedNode ? (
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
