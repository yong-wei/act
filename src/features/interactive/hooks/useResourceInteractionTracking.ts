'use client';

import { useCallback, useMemo } from 'react';
import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';

import { useInteractiveTracking } from './useInteractiveTracking';
import { inferStandaloneCompletionEventType } from './resource-interaction-utils';

interface UseResourceInteractionTrackingOptions {
  resourceKey: string;
  resourceId?: string | null;
  lessonKey?: string | null;
  surface: string;
  pageType: string;
  targetType: string;
  targetId?: string | null;
  targetLabel?: string | null;
  moduleId?: string | null;
  registryId?: string | null;
  provider?: string | null;
  resourceType?: string | null;
}

export function useResourceInteractionTracking({
  resourceKey,
  resourceId,
  lessonKey,
  surface,
  pageType,
  targetType,
  targetId,
  targetLabel,
  moduleId,
  registryId,
  provider,
  resourceType,
}: UseResourceInteractionTrackingOptions) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const tracking = useInteractiveTracking({
    resourceId: resourceId ?? undefined,
    resourceKey,
    userId: session?.user?.id ?? undefined,
    persistWithoutSession: true,
  });

  const baseData = useMemo(
    () => ({
      lessonKey: lessonKey ?? null,
      surface,
      pageType,
      targetType,
      targetId: targetId ?? null,
      targetLabel: targetLabel ?? null,
      moduleId: moduleId ?? null,
      registryId: registryId ?? null,
      provider: provider ?? null,
      resourceType: resourceType ?? null,
      originPath: pathname ?? '/',
    }),
    [lessonKey, moduleId, pageType, pathname, provider, registryId, resourceType, surface, targetId, targetLabel, targetType],
  );

  const emitWithEventType = useCallback((
    eventType: string,
    mode: 'view' | 'interact' | 'submit' | 'complete' = 'interact',
    data: Record<string, unknown> = {},
  ) => {
    tracking.emit(mode, {
      ...baseData,
      ...data,
      eventType,
    });
  }, [baseData, tracking]);

  const trackResourceView = useCallback((data: Record<string, unknown> = {}) =>
    emitWithEventType('resource_view', 'view', data), [emitWithEventType]);
  const trackResourceOpen = useCallback((data: Record<string, unknown> = {}) =>
    emitWithEventType('resource_open', 'interact', data), [emitWithEventType]);
  const trackResourcePlay = useCallback((data: Record<string, unknown> = {}) =>
    emitWithEventType('resource_play', 'interact', data), [emitWithEventType]);
  const trackResourceProgress = useCallback((data: Record<string, unknown> = {}) =>
    emitWithEventType('resource_progress', 'interact', data), [emitWithEventType]);
  const trackResourceDownload = useCallback((data: Record<string, unknown> = {}) =>
    emitWithEventType('resource_download', 'interact', data), [emitWithEventType]);
  const trackKnowledgeNodeFocus = useCallback((data: Record<string, unknown> = {}) =>
    emitWithEventType('knowledge_graph_node_focus', 'interact', data), [emitWithEventType]);
  const trackKnowledgeCardOpen = useCallback((data: Record<string, unknown> = {}) =>
    emitWithEventType('knowledge_card_open', 'interact', data), [emitWithEventType]);
  const trackExternalModuleOpen = useCallback((data: Record<string, unknown> = {}) =>
    emitWithEventType('external_module_open', 'interact', data), [emitWithEventType]);
  const trackResourceComplete = useCallback((data: Record<string, unknown> = {}) =>
    emitWithEventType(
        inferStandaloneCompletionEventType({ registryId, resourceType, surface }),
        'complete',
        data,
      ), [emitWithEventType, registryId, resourceType, surface]);

  return useMemo(() => ({
    emitWithEventType,
    trackResourceView,
    trackResourceOpen,
    trackResourcePlay,
    trackResourceProgress,
    trackResourceDownload,
    trackKnowledgeNodeFocus,
    trackKnowledgeCardOpen,
    trackExternalModuleOpen,
    trackResourceComplete,
    getHistory: tracking.getHistory,
    clearHistory: tracking.clearHistory,
  }), [
    emitWithEventType,
    trackResourceView,
    trackResourceOpen,
    trackResourcePlay,
    trackResourceProgress,
    trackResourceDownload,
    trackKnowledgeNodeFocus,
    trackKnowledgeCardOpen,
    trackExternalModuleOpen,
    trackResourceComplete,
    tracking.clearHistory,
    tracking.getHistory,
  ]);
}
