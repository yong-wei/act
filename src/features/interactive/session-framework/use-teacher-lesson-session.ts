'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type {
  LessonSessionAdapter,
  LessonStepLite,
  TeacherLessonSessionResult,
} from './session-contract';
import { getFetchFailureTelemetry } from './fetch-diagnostics';
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
    errorTelemetry: progressErrorTelemetry,
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
  const [stateErrorTelemetry, setStateErrorTelemetry] = useState<Record<string, unknown> | null>(null);
  const isSyncingStatesRef = useRef(false);

  const syncStates = useCallback(async () => {
    if (isSyncingStatesRef.current) {
      return;
    }

    isSyncingStatesRef.current = true;
    try {
      await fetchTeacherViewStates();
      setError(null);
      setStateErrorTelemetry(null);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : '课堂状态同步失败');
      setStateErrorTelemetry(getFetchFailureTelemetry(requestError));
    } finally {
      isSyncingStatesRef.current = false;
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
      errorTelemetry: error ? stateErrorTelemetry : progressErrorTelemetry,
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
      stateErrorTelemetry,
      progressError,
      progressErrorTelemetry,
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
