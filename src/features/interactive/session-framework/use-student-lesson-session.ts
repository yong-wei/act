'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type {
  LessonSessionAdapter,
  LessonStepLite,
  StudentLessonSessionResult,
} from './session-contract';
import { useSessionProgressChannel } from './use-session-progress-channel';
import { useSessionStateChannel } from './use-session-state-channel';

interface UseStudentLessonSessionOptions<StudentState, TeacherSyncState> {
  sessionId: string;
  steps: LessonStepLite[];
  adapter: LessonSessionAdapter<StudentState, TeacherSyncState>;
  currentStudentName: string;
  currentUserId?: string;
  isDemo?: boolean;
  demoStepId?: string | null;
  pollIntervalMs?: number;
}

export function useStudentLessonSession<StudentState, TeacherSyncState>({
  sessionId,
  steps,
  adapter,
  currentStudentName,
  currentUserId,
  isDemo = false,
  demoStepId,
  pollIntervalMs,
}: UseStudentLessonSessionOptions<StudentState, TeacherSyncState>): StudentLessonSessionResult<StudentState, TeacherSyncState> {
  const progress = useSessionProgressChannel({
    sessionId,
    stepIds: steps.map((step) => step.id),
    isDemo,
    demoStepId,
    followTeacher: true,
    pollIntervalMs,
  });
  const stateChannel = useSessionStateChannel({ sessionId, isDemo });
  const [courseState, setCourseState] = useState<StudentState>(() => adapter.createEmptyStudentState(currentStudentName));
  const [error, setError] = useState<string | null>(null);
  const initialPresenceSyncedRef = useRef(false);

  const syncStates = useCallback(async () => {
    try {
      await stateChannel.fetchStudentViewStates();
      setError(null);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : '课堂状态同步失败');
    }
  }, [stateChannel]);

  useEffect(() => {
    if (isDemo) {
      return;
    }

    void syncStates();
  }, [isDemo, syncStates]);

  useEffect(() => {
    if (isDemo) {
      return;
    }

    const timer = window.setInterval(() => {
      void syncStates();
    }, pollIntervalMs ?? 5000);

    return () => window.clearInterval(timer);
  }, [isDemo, pollIntervalMs, syncStates]);

  const selfState = useMemo(() => {
    if (!currentUserId) {
      return null;
    }

    const record = stateChannel.courseStates.find((item) => item.user?.id === currentUserId);
    return record && adapter.isStudentState(record.data) ? record.data : null;
  }, [adapter, currentUserId, stateChannel.courseStates]);

  const teacherSyncState = useMemo(() => {
    const record = stateChannel.teacherStates.find((item) => item.itemId === adapter.teacherItemId);
    return record && adapter.isTeacherSyncState(record.data) ? record.data : null;
  }, [adapter, stateChannel.teacherStates]);

  useEffect(() => {
    if (selfState) {
      initialPresenceSyncedRef.current = true;
      setCourseState(selfState);
    }
  }, [selfState]);

  const persistCourseState = useCallback(
    async (nextState: StudentState) => {
      if (isDemo) {
        return;
      }

      await stateChannel.postState({
        itemId: adapter.studentItemId,
        stateKey: adapter.studentStateKey,
        lessonKey: adapter.lessonKey,
        clientEventAt: Date.now(),
        data: nextState,
      });
    },
    [adapter, isDemo, stateChannel],
  );

  const saveCourseState = useCallback(
    async (updater: (prev: StudentState) => StudentState) => {
      let nextState: StudentState | null = null;
      setCourseState((prev) => {
        nextState = updater(prev);
        return nextState;
      });

      if (nextState) {
        await persistCourseState(nextState);
      }
    },
    [persistCourseState],
  );

  useEffect(() => {
    if (isDemo || progress.loadingSession || !currentUserId || selfState || initialPresenceSyncedRef.current) {
      return;
    }

    initialPresenceSyncedRef.current = true;
    void persistCourseState(adapter.createEmptyStudentState(currentStudentName));
    void syncStates();
  }, [adapter, currentStudentName, currentUserId, isDemo, persistCourseState, progress.loadingSession, selfState, syncStates]);

  return {
    sessionInfo: progress.sessionInfo,
    stateRecords: stateChannel.stateRecords,
    courseStates: stateChannel.courseStates,
    teacherStates: stateChannel.teacherStates,
    activeIndex: progress.activeIndex,
    teacherIndex: progress.teacherIndex,
    isOutOfSync: !isDemo && progress.teacherIndex !== progress.activeIndex,
    loadingSession: progress.loadingSession,
    error: error ?? progress.error,
    courseState,
    selfState,
    teacherSyncState,
    saveCourseState,
    syncSession: progress.syncSession,
    syncStates,
  };
}
