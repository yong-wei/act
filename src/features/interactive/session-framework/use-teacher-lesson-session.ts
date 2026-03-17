'use client';

import { useCallback, useEffect, useState } from 'react';

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
  const progress = useSessionProgressChannel({
    sessionId,
    stepIds: steps.map((step) => step.id),
    followTeacher: false,
    pollIntervalMs,
  });
  const stateChannel = useSessionStateChannel({ sessionId });
  const [error, setError] = useState<string | null>(null);

  const syncStates = useCallback(async () => {
    try {
      await stateChannel.fetchTeacherViewStates();
      setError(null);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : '课堂状态同步失败');
    }
  }, [stateChannel]);

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
      await progress.patchCurrentStep(nextIndex, patch);
    },
    [progress],
  );

  const postTeacherSyncState = useCallback(
    async (payload: TeacherSyncState) => {
      await stateChannel.postState({
        itemId: adapter.teacherItemId,
        stateKey: adapter.teacherStateKey,
        lessonKey: adapter.lessonKey,
        clientEventAt: Date.now(),
        data: payload,
      });
    },
    [adapter, stateChannel],
  );

  const postTeacherSyncInput = useCallback(
    async (input: TeacherSyncInput) => {
      await postTeacherSyncState(adapter.buildTeacherSyncPayload(input));
    },
    [adapter, postTeacherSyncState],
  );

  return {
    sessionInfo: progress.sessionInfo,
    stateRecords: stateChannel.stateRecords,
    courseStates: stateChannel.courseStates,
    teacherStates: stateChannel.teacherStates,
    activeIndex: progress.activeIndex,
    teacherIndex: progress.teacherIndex,
    isOutOfSync: false,
    loadingSession: progress.loadingSession,
    error: error ?? progress.error,
    teacherViewHydrated: stateChannel.teacherViewHydrated,
    patchCurrentStep,
    postTeacherSyncState,
    postTeacherSyncInput,
    syncSession: progress.syncSession,
    syncStates,
    finishSession: progress.finishSession,
  };
}
