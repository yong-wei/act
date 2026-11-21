'use client';

import { useCallback, useEffect, useEffectEvent, useMemo, useRef, useState } from 'react';

import type { SessionInfo } from './session-contract';
import {
  buildFetchFailureTelemetry,
  buildHttpFailureTelemetry,
  createSyncIncidentTracker,
  createFetchTimeout,
  DEFAULT_SYNC_FETCH_TIMEOUT_MS,
  dispatchSyncRecoveryTelemetry,
  getFetchFailureTelemetry,
  shouldSurfaceSyncFailure,
  toFetchTelemetryError,
  type FetchFailureTelemetry,
} from './fetch-diagnostics';
import { useSessionSSE } from './use-session-sse';
import { shouldRunHiddenAwarePoll } from './polling-visibility';
import { admissionRetryDelay } from './admission-retry-delay';

interface UseSessionProgressChannelOptions {
  sessionId: string;
  stepIds: string[];
  isDemo?: boolean;
  demoStepId?: string | null;
  followTeacher?: boolean;
  pollIntervalMs?: number;
  studentSync?: boolean;
  enableSSE?: boolean;
}

type DemoStepSyncUpdate = {
  nextIndex: number;
  syncKey: string;
};

export function getStepIdsSyncKey(stepIds: string[]) {
  return stepIds.join('::');
}

export function parseStepIdsSyncKey(syncKey: string): string[] {
  return syncKey.length > 0 ? syncKey.split('::') : [];
}

export function resolveDemoStepSyncUpdate({
  stepIds,
  demoStepId,
  previousSyncKey,
}: {
  stepIds: string[];
  demoStepId?: string | null;
  previousSyncKey: string | null;
}): DemoStepSyncUpdate | null {
  const syncKey = `${getStepIdsSyncKey(stepIds)}::${demoStepId ?? ''}`;
  if (previousSyncKey === syncKey) {
    return null;
  }

  const demoIndex = demoStepId ? stepIds.findIndex((stepId) => stepId === demoStepId) : -1;

  return {
    nextIndex: demoIndex >= 0 ? demoIndex : 0,
    syncKey,
  };
}

export function shouldPollSessionStatus(status: SessionInfo['status'] | null | undefined) {
  return status !== 'FINISHED';
}

export function resolveTeacherFollowIndex({
  activeIndex,
  nextTeacherIndex,
  previousTeacherIndex,
}: {
  activeIndex: number;
  nextTeacherIndex: number;
  previousTeacherIndex: number | null;
}) {
  return previousTeacherIndex === null || previousTeacherIndex !== nextTeacherIndex
    ? nextTeacherIndex
    : activeIndex;
}

function normalizeTeacherSyncValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => normalizeTeacherSyncValue(item));
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([key]) => key !== 'updatedAt')
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, normalizeTeacherSyncValue(item)]),
    );
  }

  return value;
}

export function createStableTeacherSyncSignature(value: unknown) {
  return JSON.stringify(normalizeTeacherSyncValue(value)) ?? 'null';
}

export function useSessionProgressChannel({
  sessionId,
  stepIds,
  isDemo = false,
  demoStepId,
  followTeacher = false,
  pollIntervalMs = 5000,
  studentSync = false,
  enableSSE = true,
}: UseSessionProgressChannelOptions) {
  const stepIdsSyncKey = getStepIdsSyncKey(stepIds);
  const stableStepIds = useMemo(() => parseStepIdsSyncKey(stepIdsSyncKey), [stepIdsSyncKey]);
  const [sessionInfo, setSessionInfo] = useState<SessionInfo | null>(null);
  const live = useSessionSSE(enableSSE && studentSync && !isDemo && sessionInfo?.id === sessionId
    && sessionInfo.classroomStream && sessionInfo.status !== 'FINISHED' ? sessionId : null);
  const [loadingSession, setLoadingSession] = useState(!isDemo);
  const [activeIndex, setActiveIndex] = useState(0);
  const [teacherIndex, setTeacherIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [errorTelemetry, setErrorTelemetry] = useState<FetchFailureTelemetry | null>(null);
  const [waiting, setWaiting] = useState<{ sessionId: string; delay: number } | null>(null);
  const admittedSessionRef = useRef<string | null>(null);
  const lastTeacherIndexRef = useRef<number | null>(null);
  const initializedTeacherRef = useRef(isDemo || followTeacher);
  const pendingStepIdRef = useRef<string | null>(null);
  const demoSyncKeyRef = useRef<string | null>(null);

  // 版本控制: 记录已知最新状态的时间戳，防止旧状态覆盖新状态
  const lastKnownTimestampRef = useRef({ sessionId, at: 0 });
  // PATCH请求进行中标志 - 暂停轮询以避免竞态
  const isPatchingRef = useRef<boolean>(false);
  // 轮询暂停计数器 - 允许暂停指定次数的轮询
  const pollSkipCountRef = useRef<number>(0);
  // 错误计数和退避
  const errorCountRef = useRef<number>(0);
  const lastErrorTimeRef = useRef<number>(0);
  const isPausedRef = useRef<boolean>(false);
  const isSyncingRef = useRef<boolean>(false);
  const lastHiddenPollAtRef = useRef<number>(0);
  const activeStepIdRef = useRef<string | null>(null);
  const syncIncidentTrackerRef = useRef<ReturnType<typeof createSyncIncidentTracker> | null>(null);

  activeStepIdRef.current = stableStepIds[activeIndex] ?? null;
  if (!syncIncidentTrackerRef.current) {
    syncIncidentTrackerRef.current = createSyncIncidentTracker();
  }

  /**
   * 获取服务器状态的时间戳（毫秒）
   */
  const getTimestampFromSession = useCallback((data: SessionInfo): number => {
    if (data.updatedAt) {
      const ts = /^\d+$/.test(String(data.updatedAt)) ? Number(data.updatedAt) : new Date(data.updatedAt).getTime();
      if (!Number.isNaN(ts)) return ts;
    }
    return Date.now();
  }, []);

  const applySession = useCallback((data: SessionInfo, pushed: boolean) => {
    const serverTimestamp = getTimestampFromSession(data);
    const lastKnown = lastKnownTimestampRef.current;
    const freshProgress = data.id !== lastKnown.sessionId || serverTimestamp >= lastKnown.at;
    if (freshProgress) lastKnownTimestampRef.current = { sessionId: data.id, at: serverTimestamp };

    setSessionInfo((previous) => {
      const current = previous?.id === data.id ? previous : null;
      const previousTeacher = current?.teacherSync;
      const newTeacher = data.teacherSync;
      const revision = (record: typeof newTeacher) => new Date(record?.submittedAt ?? 0).getTime();
      const teacherSync = revision(previousTeacher) > revision(newTeacher) ? previousTeacher : newTeacher;
      const next = freshProgress
        ? pushed && current ? { ...current, ...data } : data
        : current;
      return next ? { ...next, teacherSync } : previous;
    });

    if (!freshProgress) return;
    const nextIndex = data.currentItemId ? stableStepIds.indexOf(data.currentItemId) : -1;
    if (followTeacher) {
      if (nextIndex >= 0) {
        const previousTeacherIndex = lastTeacherIndexRef.current;
        setTeacherIndex(nextIndex);
        setActiveIndex((current) => resolveTeacherFollowIndex({
          activeIndex: current, nextTeacherIndex: nextIndex, previousTeacherIndex,
        }));
        lastTeacherIndexRef.current = nextIndex;
      }
    } else if (!initializedTeacherRef.current) {
      if (nextIndex >= 0) {
        setActiveIndex(nextIndex);
        setTeacherIndex(nextIndex);
      }
      initializedTeacherRef.current = true;
      pendingStepIdRef.current = null;
    } else if (nextIndex >= 0) {
      setTeacherIndex(nextIndex);
      if (pendingStepIdRef.current === stableStepIds[nextIndex]) pendingStepIdRef.current = null;
    }
  }, [followTeacher, getTimestampFromSession, stableStepIds]);

  useEffect(() => {
    if (live.state) applySession(live.state, true);
  }, [applySession, live.state]);

  const syncSession = useCallback(async () => {
    if (isDemo) {
      return;
    }

    if (!shouldPollSessionStatus(sessionInfo?.status)) {
      return;
    }

    // PATCH请求期间暂停轮询，避免竞态条件
    if (isPatchingRef.current) {
      return;
    }

    // 跳过计数器 - 允许在特定操作后暂停轮询
    if (pollSkipCountRef.current > 0) {
      pollSkipCountRef.current -= 1;
      return;
    }

    const query = studentSync
      ? `?studentSync=1${admittedSessionRef.current === sessionId ? '' : '&admission=1'}`
      : '';
    const url = `/api/session/${sessionId}${query}`;
    const startedAt = Date.now();

    if (isSyncingRef.current) {
      return;
    }

    isSyncingRef.current = true;
    const timeout = createFetchTimeout();

    try {
      const response = await fetch(url, timeout ? { signal: timeout.signal } : undefined);
      const data = (await response.json().catch(() => ({}))) as SessionInfo & { error?: string; retryAfterMs?: number };

      if (studentSync && response.status === 202 && typeof data.retryAfterMs === 'number') {
        setWaiting({ sessionId, delay: admissionRetryDelay(data.retryAfterMs) });
        return;
      }
      if (studentSync) setWaiting(null);

      if (!response.ok) {
        throw toFetchTelemetryError(
          data.error || '课堂读取失败',
          buildHttpFailureTelemetry({
            source: 'session_progress_get',
            url,
            method: 'GET',
            startedAt,
            response,
            retryCount: errorCountRef.current,
            pollIntervalMs,
          }),
        );
      }
      if (studentSync) admittedSessionRef.current = sessionId;

      applySession(data, false);

      // 成功时重置错误计数
      if (errorCountRef.current > 0) {
        const recoveryTelemetry = syncIncidentTrackerRef.current!.recordRecovery({
          sessionId,
          source: 'session_progress_get',
          url,
          method: 'GET',
        });
        for (const telemetry of recoveryTelemetry) {
          dispatchSyncRecoveryTelemetry(telemetry);
        }
        errorCountRef.current = 0;
      }

      // 合并状态更新，避免抖动
      setLoadingSession(false);
      setError(null);
      setErrorTelemetry(null);
    } catch (requestError) {
      const httpStatus = getFetchFailureTelemetry(requestError)?.status;
      if (studentSync && admittedSessionRef.current !== sessionId
        && (typeof httpStatus !== 'number' || httpStatus === 429 || httpStatus >= 500)) {
        errorCountRef.current += 1;
        setWaiting({ sessionId, delay: Math.min(8000, 1000 * errorCountRef.current) + Math.random() * 350 });
        return;
      }
      if (studentSync) setWaiting(null);
      const errorMessage = requestError instanceof Error ? requestError.message : '课堂同步失败';

      // 错误退避：连续错误时增加跳过次数
      errorCountRef.current += 1;
      lastErrorTimeRef.current = Date.now();

      // 根据错误次数增加轮询暂停次数（指数退避）
      const backoffSkips = Math.min(errorCountRef.current * 2, 10);
      pollSkipCountRef.current = backoffSkips;

      const telemetry =
        getFetchFailureTelemetry(requestError) ??
        buildFetchFailureTelemetry({
            source: 'session_progress_get',
            url,
            method: 'GET',
            startedAt,
            error: requestError,
            retryCount: errorCountRef.current,
            pollIntervalMs,
            timeoutMs: DEFAULT_SYNC_FETCH_TIMEOUT_MS,
          });
      const shouldSurface = shouldSurfaceSyncFailure({
        telemetry,
        consecutiveFailures: errorCountRef.current,
      });
      const incident = syncIncidentTrackerRef.current!.recordFailure({
        telemetry,
        stepId: activeStepIdRef.current,
        consecutiveFailures: errorCountRef.current,
      });
      if (incident.shouldEmit) {
        setError(errorMessage);
        setErrorTelemetry(incident.telemetry);
      } else if (!shouldSurface) {
        setError(null);
        setErrorTelemetry(null);
      }
      setLoadingSession(false);

      // 连续错误超过5次，暂停轮询5秒
      if (errorCountRef.current >= 5) {
        isPausedRef.current = true;
        setTimeout(() => {
          isPausedRef.current = false;
          errorCountRef.current = 0;
        }, 5000);
      }
    } finally {
      timeout?.clear();
      isSyncingRef.current = false;
    }
  }, [applySession, isDemo, pollIntervalMs, sessionId, sessionInfo?.status, studentSync]);

  const patchSession = useCallback(
    async (patch: Record<string, unknown>) => {
      const url = `/api/session/${sessionId}`;
      const startedAt = Date.now();
      const timeout = createFetchTimeout();
      try {
        const response = await fetch(url, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(patch),
          ...(timeout ? { signal: timeout.signal } : {}),
        });

        const data = (await response.json().catch(() => ({}))) as { error?: string };
        if (!response.ok) {
          throw toFetchTelemetryError(
            data.error || '课堂更新失败',
            buildHttpFailureTelemetry({
              source: 'session_progress_patch',
              url,
              method: 'PATCH',
              startedAt,
              response,
            }),
          );
        }

        return data;
      } catch (requestError) {
        if (getFetchFailureTelemetry(requestError)) {
          throw requestError;
        }

        throw toFetchTelemetryError(
          requestError instanceof Error ? requestError.message : '课堂更新失败',
          buildFetchFailureTelemetry({
            source: 'session_progress_patch',
            url,
            method: 'PATCH',
            startedAt,
            error: requestError,
            timeoutMs: DEFAULT_SYNC_FETCH_TIMEOUT_MS,
          }),
        );
      } finally {
        timeout?.clear();
      }
    },
    [sessionId],
  );

  const patchCurrentStep = useCallback(
    async (nextIndex: number, patch: Record<string, unknown>) => {
      const previousIndex = activeIndex;
      const nextStepId = stableStepIds[nextIndex];

      if (isDemo) {
        setActiveIndex(nextIndex);
        setTeacherIndex(nextIndex);
        pendingStepIdRef.current = nextStepId ?? null;
        setError(null);
        setErrorTelemetry(null);
        return;
      }

      // 设置PATCH进行中标志，暂停轮询
      isPatchingRef.current = true;

      pendingStepIdRef.current = nextStepId ?? null;
      setError(null);

      const url = `/api/session/${sessionId}`;
      const startedAt = Date.now();
      const timeout = createFetchTimeout();

      try {
        const response = await fetch(url, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(patch),
          ...(timeout ? { signal: timeout.signal } : {}),
        });

        const data = (await response.json().catch(() => ({}))) as SessionInfo & { error?: string };

        if (!response.ok) {
          throw toFetchTelemetryError(
            data.error || '课堂更新失败',
            buildHttpFailureTelemetry({
              source: 'session_progress_patch',
              url,
              method: 'PATCH',
              startedAt,
              response,
            }),
          );
        }

        // PATCH成功后，更新已知时间戳并跳过接下来的2次轮询
        // 给服务器时间传播状态，避免竞态
        const serverTimestamp = getTimestampFromSession(data);
        lastKnownTimestampRef.current = { sessionId, at: serverTimestamp };
        pollSkipCountRef.current = 2;

        // 更新本地sessionInfo以确保一致性
        setSessionInfo(data);
        setActiveIndex(nextIndex);
        setTeacherIndex(nextIndex);
      } catch (requestError) {
        pendingStepIdRef.current = null;
        // 合并状态更新，避免抖动
        const errorMessage = requestError instanceof Error ? requestError.message : '课堂推进失败';
        setError(errorMessage);
        setErrorTelemetry(
          getFetchFailureTelemetry(requestError) ??
            buildFetchFailureTelemetry({
              source: 'session_progress_patch',
              url,
              method: 'PATCH',
              startedAt,
              error: requestError,
              pollIntervalMs,
              timeoutMs: DEFAULT_SYNC_FETCH_TIMEOUT_MS,
            }),
        );
        throw requestError;
      } finally {
        timeout?.clear();
        // 恢复轮询
        isPatchingRef.current = false;
      }
    },
    [activeIndex, getTimestampFromSession, isDemo, pollIntervalMs, sessionId, stableStepIds],
  );

  const finishSession = useCallback(async () => {
    if (isDemo) {
      setSessionInfo((current) => ({
        id: sessionId,
        joinCode: current?.joinCode ?? undefined,
        status: 'FINISHED',
        currentItemId: current?.currentItemId ?? stableStepIds[activeIndex] ?? null,
        currentStage: current?.currentStage,
        updatedAt: new Date(),
      }));
      return;
    }

    try {
      const data = await patchSession({ status: 'FINISHED' });
      setSessionInfo(data as SessionInfo);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : '结束课堂失败');
      setErrorTelemetry(getFetchFailureTelemetry(requestError));
      throw requestError;
    }
  }, [activeIndex, isDemo, patchSession, sessionId, stableStepIds]);

  useEffect(() => {
    if (!isDemo) {
      return;
    }

    setLoadingSession(false);
    const nextSync = resolveDemoStepSyncUpdate({
      stepIds: stableStepIds,
      demoStepId,
      previousSyncKey: demoSyncKeyRef.current,
    });
    if (!nextSync) {
      return;
    }
    demoSyncKeyRef.current = nextSync.syncKey;
    setActiveIndex(nextSync.nextIndex);
    setTeacherIndex(nextSync.nextIndex);
    initializedTeacherRef.current = true;
  }, [demoStepId, isDemo, stableStepIds]);

  const refreshProgress = useEffectEvent(() => { void syncSession(); });

  useEffect(() => {
    if (!isDemo) refreshProgress();
  }, [isDemo, sessionId]);

  useEffect(() => {
    if (!isDemo && live.reconnectAttempt > 0 && !live.isConnected) refreshProgress();
  }, [isDemo, live.isConnected, live.reconnectAttempt]);

  useEffect(() => {
    if (isDemo) {
      return;
    }

    if (!shouldPollSessionStatus(sessionInfo?.status)) {
      return;
    }

    if (waiting?.sessionId === sessionId) {
      const retry = window.setTimeout(() => { void syncSession(); }, waiting.delay);
      return () => window.clearTimeout(retry);
    }

    const timer = window.setInterval(() => {
      // 如果暂停或错误退避中，跳过本次轮询
      if (isPausedRef.current) {
        return;
      }
      const pollDecision = shouldRunHiddenAwarePoll({
        now: Date.now(),
        lastHiddenPollAt: lastHiddenPollAtRef.current,
      });
      lastHiddenPollAtRef.current = pollDecision.lastHiddenPollAt;
      if (!pollDecision.shouldRun) {
        return;
      }
      void syncSession();
    }, live.isConnected ? 60_000 + Math.random() * 10_000 : pollIntervalMs + (studentSync ? Math.random() * 850 : 0));

    return () => window.clearInterval(timer);
  }, [isDemo, live.isConnected, pollIntervalMs, sessionId, sessionInfo?.status, studentSync, syncSession, waiting]);

  useEffect(() => {
    if (isDemo || typeof document === 'undefined') {
      return;
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState !== 'visible' || !shouldPollSessionStatus(sessionInfo?.status)) {
        return;
      }
      lastHiddenPollAtRef.current = 0;
      void syncSession();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [isDemo, sessionInfo?.status, syncSession]);

  return useMemo(
    () => ({
      sessionInfo,
      loadingSession,
      activeIndex,
      teacherIndex,
      error,
      errorTelemetry,
      setActiveIndex,
      setTeacherIndex,
      syncSession,
      patchCurrentStep,
      finishSession,
      sseStatus: {
        isConnected: live.isConnected,
        reconnectAttempt: live.reconnectAttempt,
        isFallbackActive: !live.isConnected && live.reconnectAttempt > 0,
      },
    }),
    [
      sessionInfo,
      loadingSession,
      activeIndex,
      teacherIndex,
      error,
      errorTelemetry,
      setActiveIndex,
      setTeacherIndex,
      syncSession,
      patchCurrentStep,
      finishSession,
      live.isConnected,
      live.reconnectAttempt,
    ],
  );
}
