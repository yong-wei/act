'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Prisma } from '@prisma/client';

import { useInteractiveTracking } from '@/features/interactive/hooks/useInteractiveTracking';
import { useCourseEventTracking } from '@/features/interactive/session-framework/use-course-event-tracking';
import { useSessionStateChannel } from '@/features/interactive/session-framework/use-session-state-channel';
import {
  createManifestStudentActivityRegistry,
  renderStudentInteractiveActivity,
  type ManifestStepResponse,
} from '@/features/interactive/shared/manifest-runtime/activity-renderers';
import { createManifestContentModuleRegistry } from '@/features/interactive/shared/manifest-runtime/content-renderers';
import { renderInteractiveManifestStep } from '@/features/interactive/shared/manifest-runtime/layout-renderer';
import { useManifestSubmissionController } from '@/features/interactive/shared/manifest-runtime/submission-controller';
import type { InteractiveRuntimeManifest } from '@/lib/interactive-lesson-manifest';
import type { WidgetResult, WidgetState } from '@/resources/widgets/widget-props';

export const GENERATED_COURSEWARE_RESOURCE_KIND = 'generated-courseware-student-runtime-v1' as const;

export type GeneratedCoursewareResourceConfig = {
  kind: typeof GENERATED_COURSEWARE_RESOURCE_KIND;
  publicationRevisionId: string;
  manifestHash: string;
  stepId: string;
  runtimeManifest: InteractiveRuntimeManifest;
};

type GeneratedCoursewareClassroomState = {
  generatedCoursewareResponses?: Record<string, Record<string, ManifestStepResponse>>;
  updatedAt?: number;
  [key: string]: unknown;
};

function readGeneratedResponse(
  state: unknown,
  publicationRevisionId: string,
  stepId: string,
) {
  if (!state || typeof state !== 'object' || Array.isArray(state)) return undefined;
  const responses = (state as GeneratedCoursewareClassroomState).generatedCoursewareResponses;
  return responses?.[publicationRevisionId]?.[stepId];
}

export function mergeGeneratedCoursewareResponse(
  state: unknown,
  publicationRevisionId: string,
  stepId: string,
  response: ManifestStepResponse,
): GeneratedCoursewareClassroomState {
  const current = state && typeof state === 'object' && !Array.isArray(state)
    ? state as GeneratedCoursewareClassroomState
    : {};
  return {
    ...current,
    updatedAt: Date.now(),
    generatedCoursewareResponses: {
      ...(current.generatedCoursewareResponses ?? {}),
      [publicationRevisionId]: {
        ...(current.generatedCoursewareResponses?.[publicationRevisionId] ?? {}),
        [stepId]: response,
      },
    },
  };
}

export function resolveGeneratedCoursewareResourceConfig(
  value: Prisma.JsonValue | null | undefined,
): GeneratedCoursewareResourceConfig | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const config = value as Record<string, unknown>;
  if (config.kind !== GENERATED_COURSEWARE_RESOURCE_KIND
    || typeof config.publicationRevisionId !== 'string'
    || typeof config.manifestHash !== 'string'
    || typeof config.stepId !== 'string'
    || !config.runtimeManifest
    || typeof config.runtimeManifest !== 'object'
    || Array.isArray(config.runtimeManifest)) return null;
  const runtimeManifest = config.runtimeManifest as unknown as InteractiveRuntimeManifest;
  if (!Array.isArray(runtimeManifest.steps)
    || !runtimeManifest.steps.some((step) => step.id === config.stepId)) return null;
  return {
    kind: GENERATED_COURSEWARE_RESOURCE_KIND,
    publicationRevisionId: config.publicationRevisionId,
    manifestHash: config.manifestHash,
    stepId: config.stepId,
    runtimeManifest,
  };
}

export function GeneratedCoursewareResource({
  config,
  onComplete,
  onStateChange,
  sessionId,
  lessonItemId,
  resourceId,
}: {
  config: GeneratedCoursewareResourceConfig;
  onComplete?: (result?: WidgetResult) => void;
  onStateChange?: (state: WidgetState) => void;
  sessionId?: string;
  lessonItemId?: string;
  resourceId?: string;
}) {
  const step = config.runtimeManifest.steps.find((candidate) => candidate.id === config.stepId);
  const [response, setResponse] = useState<ManifestStepResponse>();
  const [courseState, setCourseState] = useState<unknown>();
  const [hydrationState, setHydrationState] = useState<'loading' | 'ready' | 'error'>(
    sessionId ? 'loading' : 'ready',
  );
  const { fetchSelfStates, postState } = useSessionStateChannel({
    sessionId: sessionId ?? 'generated-courseware-preview',
    isDemo: !sessionId,
    currentStepId: lessonItemId ?? config.stepId,
  });
  const interactiveTracking = useInteractiveTracking({
    resourceId,
    resourceKey: `generated-courseware:${config.publicationRevisionId}`,
    sessionId,
  });
  const { trackCourseEvent } = useCourseEventTracking({
    resourceKey: `generated-courseware:${config.publicationRevisionId}`,
    resourceId,
    sessionId,
    lessonKey: config.publicationRevisionId,
    actorRole: 'student',
    emit: interactiveTracking.emit,
  });
  const { submitManifestStepResponse } = useManifestSubmissionController({ trackCourseEvent });
  const moduleRegistry = useMemo(
    () => createManifestContentModuleRegistry({ revealProgress: 0, allowInlineReveal: false }),
    [],
  );
  const activityRegistry = useMemo(
    () => createManifestStudentActivityRegistry<{ id: string; title: string }>(),
    [],
  );

  useEffect(() => {
    if (!sessionId) {
      setHydrationState('ready');
      return;
    }
    let active = true;
    setHydrationState('loading');
    void fetchSelfStates().then((payload) => {
      if (!active) return;
      const savedState = payload.courseStates[0]?.data;
      setCourseState(savedState);
      setResponse(readGeneratedResponse(savedState, config.publicationRevisionId, config.stepId));
      setHydrationState('ready');
    }).catch(() => {
      if (active) setHydrationState('error');
    });
    return () => {
      active = false;
    };
  }, [config.publicationRevisionId, config.stepId, fetchSelfStates, sessionId]);

  const handleSubmit = useCallback(async (submitted: ManifestStepResponse) => {
    const submittedAt = submitManifestStepResponse({
      stepId: config.stepId,
      isResubmit: Boolean(response),
      response: submitted,
      stepManifest: step,
      dataOverrides: {
        publicationRevisionId: config.publicationRevisionId,
        manifestHash: config.manifestHash,
        lessonItemId: lessonItemId ?? null,
      },
    });
    const persistedResponse = { ...submitted, submittedAt };
    const nextState = mergeGeneratedCoursewareResponse(
      courseState,
      config.publicationRevisionId,
      config.stepId,
      persistedResponse,
    );
    if (sessionId) {
      await postState({
        itemId: lessonItemId ?? config.stepId,
        lessonKey: config.publicationRevisionId,
        data: nextState,
      });
    }
    setCourseState(nextState);
    setResponse(persistedResponse);
    onStateChange?.({
      phase: 'submitted',
      progress: 100,
      data: { stepId: config.stepId, response: persistedResponse },
      timestamp: Date.now(),
    });
    onComplete?.({ success: true, data: { stepId: config.stepId, response: persistedResponse } });
  }, [config.manifestHash, config.publicationRevisionId, config.stepId, courseState, lessonItemId, onComplete, onStateChange, postState, response, sessionId, step, submitManifestStepResponse]);
  if (!step) return null;

  return (
    <section
      className="h-full overflow-auto p-4"
      data-generated-courseware-resource={config.publicationRevisionId}
      data-generated-courseware-manifest-hash={config.manifestHash}
      data-generated-courseware-step={step.id}
    >
      {renderInteractiveManifestStep({
        manifest: config.runtimeManifest,
        step,
        moduleRegistry,
        extra: { revealProgress: 0, allowInlineReveal: false },
      })}
      <div data-courseware-student-activity={step.id}>
        {hydrationState === 'loading' ? (
          <div role="status" data-courseware-student-activity-hydration="loading">
            正在读取已保存的课堂作答…
          </div>
        ) : hydrationState === 'error' ? (
          <div role="alert" data-courseware-student-activity-hydration="error">
            课堂作答读取失败。请刷新页面，恢复已保存状态后再提交。
          </div>
        ) : renderStudentInteractiveActivity({
          registry: activityRegistry,
          step: { id: step.id, title: step.title },
          stepManifest: step,
          savedResponse: response,
          released: true,
          browseEnabled: true,
          answerVisible: false,
          revealProgress: 0,
          onSubmit: handleSubmit,
        })}
      </div>
    </section>
  );
}
