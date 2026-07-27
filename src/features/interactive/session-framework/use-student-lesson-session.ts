'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type {
  LessonSessionAdapter,
  LessonStepLite,
  StudentLessonSessionResult,
} from './session-contract';
import { shouldPollSessionStatus, useSessionProgressChannel } from './use-session-progress-channel';
import { useSessionStateChannel } from './use-session-state-channel';
import { useSessionSSE } from './use-session-sse';
import { getFetchFailureTelemetry, shouldSurfaceSyncFailure } from './fetch-diagnostics';
import { shouldRunHiddenAwarePoll } from './polling-visibility';
import { persistCourseStateUpdate } from '@/features/interactive/shared/confirmed-state';

interface UseStudentLessonSessionOptions<StudentState, TeacherSyncState> {
  sessionId: string;
  steps: LessonStepLite[];
  adapter: LessonSessionAdapter<StudentState, TeacherSyncState>;
  currentStudentName: string;
  currentUserId?: string;
  isDemo?: boolean;
  demoStepId?: string | null;
  pollIntervalMs?: number;
  /**
   * 是否显式启用 SSE 实时推送
   * 当前默认关闭，课堂场景以轮询为主，避免在低配服务器上维护大量长连接。
   */
  enableSSE?: boolean;
}

function stateUpdatedAt(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const updatedAt = Number((value as Record<string, unknown>).updatedAt);
  return Number.isFinite(updatedAt) ? updatedAt : null;
}

export function shouldApplyStudentServerState(input: {
  localState: unknown;
  serverState: unknown;
  hasLocalMutation: boolean;
  pendingSaves: number;
}) {
  if (input.pendingSaves > 0) return false;
  const localUpdatedAt = stateUpdatedAt(input.localState);
  const serverUpdatedAt = stateUpdatedAt(input.serverState);
  if (localUpdatedAt !== null && serverUpdatedAt !== null) return serverUpdatedAt >= localUpdatedAt;
  return !input.hasLocalMutation;
}

export function shouldInitializeStudentPresence(input: {
  isDemo: boolean;
  loadingSession: boolean;
  studentViewHydrated: boolean;
  hasCurrentUser: boolean;
  hasSelfState: boolean;
  presenceAlreadySynced: boolean;
}) {
  return !input.isDemo
    && !input.loadingSession
    && input.studentViewHydrated
    && input.hasCurrentUser
    && !input.hasSelfState
    && !input.presenceAlreadySynced;
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
  enableSSE = false,
}: UseStudentLessonSessionOptions<StudentState, TeacherSyncState>): StudentLessonSessionResult<StudentState, TeacherSyncState> {
  // SSE 状态追踪
  const [sseLastUpdate, setSseLastUpdate] = useState<number>(0);
  const sseActiveRef = useRef(false);

  // SSE 连接
  const sseConnection = useSessionSSE({
    sessionId: enableSSE && !isDemo ? sessionId : null,
    onStateChange: (state) => {
      // 当 SSE 推送更新时，记录时间戳
      if (state.updatedAt) {
        setSseLastUpdate(state.updatedAt);
      }
    },
    onError: () => {
      sseActiveRef.current = false;
    },
  });

  // 标记 SSE 是否活跃（连接成功且近期有更新）
  useEffect(() => {
    sseActiveRef.current = sseConnection.isConnected;
  }, [sseConnection.isConnected]);

  // 动态轮询间隔：SSE 连接时降低轮询频率
  const effectivePollInterval = useMemo(() => {
    if (isDemo) return pollIntervalMs;
    // SSE 连接正常时，轮询作为备份，频率降低到 15 秒
    if (sseConnection.isConnected) return 15000;
    // SSE 重连中，使用较短的轮询间隔作为补充
    if (sseConnection.reconnectAttempt > 0) return pollIntervalMs ?? 3000;
    // 默认轮询间隔
    return pollIntervalMs ?? 5000;
  }, [isDemo, pollIntervalMs, sseConnection.isConnected, sseConnection.reconnectAttempt]);

  const {
    sessionInfo,
    loadingSession,
    activeIndex,
    teacherIndex,
    error: progressError,
    errorTelemetry: progressErrorTelemetry,
    syncSession: syncProgressSession,
    setActiveIndex,
  } = useSessionProgressChannel({
    sessionId,
    stepIds: steps.map((step) => step.id),
    isDemo,
    demoStepId,
    followTeacher: true,
    pollIntervalMs: effectivePollInterval,
  });
  const {
    stateRecords,
    courseStates,
    teacherStates,
    studentViewHydrated,
    fetchStudentViewStates,
    postState,
  } = useSessionStateChannel({
    sessionId,
    isDemo,
    currentStepId: steps[activeIndex]?.id ?? null,
  });
  const [courseState, setCourseState] = useState<StudentState>(() => adapter.createEmptyStudentState(currentStudentName));
  const courseStateRef = useRef(courseState);
  const courseStateSaveQueueRef = useRef<Promise<void>>(Promise.resolve());
  const pendingCourseStateSavesRef = useRef(0);
  const hasLocalMutationRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [stateErrorTelemetry, setStateErrorTelemetry] = useState<Record<string, unknown> | null>(null);
  const initialPresenceSyncedRef = useRef(false);
  const isSyncingStatesRef = useRef(false);
  const stateFailureCountRef = useRef(0);
  const lastHiddenStatePollAtRef = useRef(0);

  // 合并 SSE 和轮询的错误状态
  const combinedError = useMemo(() => error ?? progressError, [error, progressError]);
  const combinedErrorTelemetry = useMemo(
    () => (error ? stateErrorTelemetry : progressErrorTelemetry),
    [error, progressErrorTelemetry, stateErrorTelemetry],
  );

  // SSE 状态同步到 progress channel
  useEffect(() => {
    if (isDemo || !enableSSE || !sseConnection.state) return;

    // 当 SSE 推送了新状态，触发进度同步
    if (sseLastUpdate > 0) {
      syncProgressSession();
    }
  }, [enableSSE, isDemo, sseLastUpdate, sseConnection.state, syncProgressSession]);

  const syncStates = useCallback(async () => {
    if (isSyncingStatesRef.current) {
      return;
    }

    if (!shouldPollSessionStatus(sessionInfo?.status)) {
      return;
    }

    isSyncingStatesRef.current = true;
    try {
      await fetchStudentViewStates();
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
  }, [fetchStudentViewStates, sessionInfo?.status]);

  useEffect(() => {
    if (isDemo || !shouldPollSessionStatus(sessionInfo?.status)) {
      return;
    }

    void syncStates();
  }, [isDemo, sessionInfo?.status, syncStates]);

  useEffect(() => {
    if (isDemo || !shouldPollSessionStatus(sessionInfo?.status)) {
      return;
    }

    const timer = window.setInterval(() => {
      const pollDecision = shouldRunHiddenAwarePoll({
        now: Date.now(),
        lastHiddenPollAt: lastHiddenStatePollAtRef.current,
      });
      lastHiddenStatePollAtRef.current = pollDecision.lastHiddenPollAt;
      if (!pollDecision.shouldRun) {
        return;
      }
      void syncStates();
    }, pollIntervalMs ?? 5000);

    return () => window.clearInterval(timer);
  }, [isDemo, pollIntervalMs, sessionInfo?.status, syncStates]);

  useEffect(() => {
    if (isDemo || typeof document === 'undefined') {
      return;
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState !== 'visible' || !shouldPollSessionStatus(sessionInfo?.status)) {
        return;
      }
      lastHiddenStatePollAtRef.current = 0;
      void syncStates();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [isDemo, sessionInfo?.status, syncStates]);

  const selfState = useMemo(() => {
    if (!currentUserId) {
      return null;
    }

    const record = courseStates.find((item) => item.user?.id === currentUserId);
    return record && adapter.isStudentState(record.data) ? record.data : null;
  }, [adapter, courseStates, currentUserId]);

  const teacherSyncState = useMemo(() => {
    const record = teacherStates.find((item) => item.itemId === adapter.teacherItemId);
    return record && adapter.isTeacherSyncState(record.data) ? record.data : null;
  }, [adapter, teacherStates]);

  useEffect(() => {
    if (selfState && shouldApplyStudentServerState({
      localState: courseStateRef.current,
      serverState: selfState,
      hasLocalMutation: hasLocalMutationRef.current,
      pendingSaves: pendingCourseStateSavesRef.current,
    })) {
      initialPresenceSyncedRef.current = true;
      courseStateRef.current = selfState;
      setCourseState(selfState);
    }
  }, [selfState]);

  const persistCourseState = useCallback(
    async (nextState: StudentState) => {
      if (isDemo) {
        return;
      }

      await postState({
        itemId: adapter.studentItemId,
        stateKey: adapter.studentStateKey,
        lessonKey: adapter.lessonKey,
        clientEventAt: Date.now(),
        data: nextState,
      });
    },
    [adapter, isDemo, postState],
  );

  const saveCourseState = useCallback(
    (updater: (prev: StudentState) => StudentState) => {
      hasLocalMutationRef.current = true;
      pendingCourseStateSavesRef.current += 1;
      const run = courseStateSaveQueueRef.current.then(async () => {
        const nextState = await persistCourseStateUpdate({
          currentState: courseStateRef.current,
          update: updater,
          persist: persistCourseState,
        });
        courseStateRef.current = nextState;
        setCourseState(nextState);
      }).finally(() => {
        pendingCourseStateSavesRef.current = Math.max(0, pendingCourseStateSavesRef.current - 1);
      });
      courseStateSaveQueueRef.current = run.catch(() => undefined);
      return run;
    },
    [persistCourseState],
  );

  useEffect(() => {
    if (!shouldInitializeStudentPresence({
      isDemo,
      loadingSession,
      studentViewHydrated,
      hasCurrentUser: Boolean(currentUserId),
      hasSelfState: Boolean(selfState),
      presenceAlreadySynced: initialPresenceSyncedRef.current,
    })) {
      return;
    }

    initialPresenceSyncedRef.current = true;
    void saveCourseState((current) => current).then(syncStates).catch(() => undefined);
  }, [currentUserId, isDemo, loadingSession, saveCourseState, selfState, studentViewHydrated, syncStates]);

  return useMemo(
    () => ({
      sessionInfo,
      stateRecords,
      courseStates,
      teacherStates,
      activeIndex,
      teacherIndex,
      isOutOfSync: !isDemo && teacherIndex !== activeIndex,
      loadingSession,
      error: combinedError,
      errorTelemetry: combinedErrorTelemetry,
      courseState,
      selfState,
      teacherSyncState,
      saveCourseState,
      syncSession: syncProgressSession,
      syncStates,
      setActiveIndex,
      // SSE 连接状态（用于调试和 UI 显示）
      sseStatus: {
        isConnected: sseConnection.isConnected,
        reconnectAttempt: sseConnection.reconnectAttempt,
        isFallbackActive: !sseConnection.isConnected && sseConnection.reconnectAttempt > 0,
      },
    }),
    [
      sessionInfo,
      stateRecords,
      courseStates,
      teacherStates,
      activeIndex,
      teacherIndex,
      isDemo,
      loadingSession,
      combinedError,
      combinedErrorTelemetry,
      courseState,
      selfState,
      teacherSyncState,
      saveCourseState,
      syncProgressSession,
      syncStates,
      setActiveIndex,
      sseConnection.isConnected,
      sseConnection.reconnectAttempt,
    ],
  );
}
