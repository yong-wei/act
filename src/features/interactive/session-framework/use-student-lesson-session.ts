'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type {
  LessonSessionAdapter,
  LessonStepLite,
  StudentLessonSessionResult,
} from './session-contract';
import { useSessionProgressChannel } from './use-session-progress-channel';
import { useSessionStateChannel } from './use-session-state-channel';
import { useSessionSSE } from './use-session-sse';

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
   * 是否启用 SSE 实时推送
   * - true: 优先使用 SSE，失败时自动降级到轮询
   * - false: 仅使用轮询（默认行为，向后兼容）
   * @default true
   */
  enableSSE?: boolean;
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
  enableSSE = true,
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

  const progress = useSessionProgressChannel({
    sessionId,
    stepIds: steps.map((step) => step.id),
    isDemo,
    demoStepId,
    followTeacher: true,
    pollIntervalMs: effectivePollInterval,
  });
  const stateChannel = useSessionStateChannel({ sessionId, isDemo });
  const [courseState, setCourseState] = useState<StudentState>(() => adapter.createEmptyStudentState(currentStudentName));
  const [error, setError] = useState<string | null>(null);
  const initialPresenceSyncedRef = useRef(false);

  // 合并 SSE 和轮询的错误状态
  const combinedError = useMemo(() => {
    if (error) return error;
    if (sseConnection.error && !sseConnection.isConnected && sseConnection.reconnectAttempt >= 5) {
      return '实时连接失败，已降级到轮询模式';
    }
    return progress.error;
  }, [error, sseConnection.error, sseConnection.isConnected, sseConnection.reconnectAttempt, progress.error]);

  // SSE 状态同步到 progress channel
  useEffect(() => {
    if (isDemo || !enableSSE || !sseConnection.state) return;

    // 当 SSE 推送了新状态，触发进度同步
    if (sseLastUpdate > 0) {
      progress.syncSession();
    }
  }, [isDemo, enableSSE, sseLastUpdate, sseConnection.state, progress]);

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
    error: combinedError,
    courseState,
    selfState,
    teacherSyncState,
    saveCourseState,
    syncSession: progress.syncSession,
    syncStates,
    setActiveIndex: progress.setActiveIndex,
    // SSE 连接状态（用于调试和 UI 显示）
    sseStatus: {
      isConnected: sseConnection.isConnected,
      reconnectAttempt: sseConnection.reconnectAttempt,
      isFallbackActive: !sseConnection.isConnected && sseConnection.reconnectAttempt > 0,
    },
  };
}
