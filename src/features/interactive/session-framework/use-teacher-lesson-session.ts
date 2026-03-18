'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import type {
  LessonSessionAdapter,
  LessonStepLite,
  TeacherLessonSessionResult,
} from './session-contract';
import { useSessionProgressChannel } from './use-session-progress-channel';
import { useSessionStateChannel } from './use-session-state-channel';

interface UseTeacherLessonSessionOptions<
  StudentState,
  TeacherSyncState,
  TeacherSyncInput extends Record<string, unknown>,
> {
  sessionId: string;
  steps: LessonStepLite[];
  adapter: LessonSessionAdapter<StudentState, TeacherSyncState, TeacherSyncInput>;
  pollIntervalMs?: number;
}

export function useTeacherLessonSession<
  StudentState,
  TeacherSyncState,
  TeacherSyncInput extends Record<string, unknown>,
>({
  sessionId,
  steps,
  adapter,
  pollIntervalMs,
}: UseTeacherLessonSessionOptions<StudentState, TeacherSyncState, TeacherSyncInput>): TeacherLessonSessionResult<TeacherSyncState, TeacherSyncInput> {
  const {
    sessionInfo,
    activeIndex,
    teacherIndex,
    loadingSession,
    error: progressError,
    patchCurrentStep: patchProgressCurrentStep,
    syncSession,
    finishSession,
  } = useSessionProgressChannel({
    sessionId,
    stepIds: steps.map((step) => step.id),
    followTeacher: false,
    pollIntervalMs,
  });
  const {
    stateRecords,
    courseStates,
    teacherStates,
    teacherViewHydrated,
    fetchTeacherViewStates,
    postState,
  } = useSessionStateChannel({ sessionId });
  const [error, setError] = useState<string | null>(null);

  const syncStates = useCallback(async () => {
    try {
      await fetchTeacherViewStates();
      setError(null);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : '课堂状态同步失败');
    }
  }, [fetchTeacherViewStates]);

  useEffect(() => {
    void syncStates();
  }, [syncStates]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      void syncStates();
    }, pollIntervalMs ?? 5000);

    return () => window.clearInterval(timer);
  }, [pollIntervalMs, syncStates]);

  const patchCurrentStep = useCallback(
    async (nextIndex: number, patch: Record<string, unknown>) => {
      await patchProgressCurrentStep(nextIndex, patch);
    },
    [patchProgressCurrentStep],
  );

  const postTeacherSyncState = useCallback(
    async (payload: TeacherSyncState) => {
      await postState({
        itemId: adapter.teacherItemId,
        stateKey: adapter.teacherStateKey,
        lessonKey: adapter.lessonKey,
        clientEventAt: Date.now(),
        data: payload,
      });
    },
    [adapter, postState],
  );

  const postTeacherSyncInput = useCallback(
    async (input: TeacherSyncInput) => {
      await postTeacherSyncState(adapter.buildTeacherSyncPayload(input));
    },
    [adapter, postTeacherSyncState],
  );

  return useMemo(
    () => ({
      sessionInfo,
      stateRecords,
      courseStates,
      teacherStates,
      activeIndex,
      teacherIndex,
      isOutOfSync: false,
      loadingSession,
      error: error ?? progressError,
      teacherViewHydrated,
      patchCurrentStep,
      postTeacherSyncState,
      postTeacherSyncInput,
      syncSession,
      syncStates,
      finishSession,
    }),
    [
      sessionInfo,
      stateRecords,
      courseStates,
      teacherStates,
      activeIndex,
      teacherIndex,
      loadingSession,
      error,
      progressError,
      teacherViewHydrated,
      patchCurrentStep,
      postTeacherSyncState,
      postTeacherSyncInput,
      syncSession,
      syncStates,
      finishSession,
    ],
  );
}
