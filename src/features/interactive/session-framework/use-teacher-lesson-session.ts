'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type {
  LessonSessionAdapter,
  LessonStepLite,
  TeacherLessonSessionResult,
} from './session-contract';
import { getFetchFailureTelemetry, shouldSurfaceSyncFailure } from './fetch-diagnostics';
import {
  createStableTeacherSyncSignature,
  shouldPollSessionStatus,
  useSessionProgressChannel,
} from './use-session-progress-channel';
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
  const stateFailureCountRef = useRef(0);
  const lastTeacherSyncSignatureRef = useRef<string | null>(null);

  const syncStates = useCallback(async () => {
    if (isSyncingStatesRef.current) {
      return;
    }

    if (!shouldPollSessionStatus(sessionInfo?.status)) {
      return;
    }

    isSyncingStatesRef.current = true;
    try {
      await fetchTeacherViewStates();
      stateFailureCountRef.current = 0;
      setError(null);
      setStateErrorTelemetry(null);
    } catch (requestError) {
      stateFailureCountRef.current += 1;
      const telemetry = getFetchFailureTelemetry(requestError);
      const shouldSurface = shouldSurfaceSyncFailure({
        telemetry,
        consecutiveFailures: stateFailureCountRef.current,
      });
      const errorMessage = requestError instanceof Error ? requestError.message : '课堂状态同步失败';
      setError(shouldSurface ? errorMessage : null);
      setStateErrorTelemetry(shouldSurface ? telemetry : null);
    } finally {
      isSyncingStatesRef.current = false;
    }
  }, [fetchTeacherViewStates, sessionInfo?.status]);

  useEffect(() => {
    void syncStates();
  }, [syncStates]);

  useEffect(() => {
    if (!shouldPollSessionStatus(sessionInfo?.status)) {
      return;
    }

    const timer = window.setInterval(() => {
      void syncStates();
    }, pollIntervalMs ?? 5000);

    return () => window.clearInterval(timer);
  }, [pollIntervalMs, sessionInfo?.status, syncStates]);

  const patchCurrentStep = useCallback(
    async (nextIndex: number, patch: Record<string, unknown>) => {
      await patchProgressCurrentStep(nextIndex, patch);
    },
    [patchProgressCurrentStep],
  );

  const postTeacherSyncState = useCallback(
    async (payload: TeacherSyncState) => {
      if (!shouldPollSessionStatus(sessionInfo?.status)) {
        return;
      }

      const signature = createStableTeacherSyncSignature(payload);
      if (signature === lastTeacherSyncSignatureRef.current) {
        return;
      }

      await postState({
        itemId: adapter.teacherItemId,
        stateKey: adapter.teacherStateKey,
        lessonKey: adapter.lessonKey,
        clientEventAt: Date.now(),
        data: payload,
      });
      lastTeacherSyncSignatureRef.current = signature;
    },
    [adapter, postState, sessionInfo?.status],
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
