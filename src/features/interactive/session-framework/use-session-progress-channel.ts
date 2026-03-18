'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import type { SessionInfo } from './session-contract';

interface UseSessionProgressChannelOptions {
  sessionId: string;
  stepIds: string[];
  isDemo?: boolean;
  demoStepId?: string | null;
  followTeacher?: boolean;
  pollIntervalMs?: number;
}

export function useSessionProgressChannel({
  sessionId,
  stepIds,
  isDemo = false,
  demoStepId,
  followTeacher = false,
  pollIntervalMs = 5000,
}: UseSessionProgressChannelOptions) {
  const [sessionInfo, setSessionInfo] = useState<SessionInfo | null>(null);
  const [loadingSession, setLoadingSession] = useState(!isDemo);
  const [activeIndex, setActiveIndex] = useState(0);
  const [teacherIndex, setTeacherIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const initialTeacherSyncRef = useRef(isDemo || !followTeacher);
  const initializedTeacherRef = useRef(isDemo || followTeacher);
  const pendingStepIdRef = useRef<string | null>(null);

  // 版本控制: 记录已知最新状态的时间戳，防止旧状态覆盖新状态
  const lastKnownTimestampRef = useRef<number>(0);
  // PATCH请求进行中标志 - 暂停轮询以避免竞态
  const isPatchingRef = useRef<boolean>(false);
  // 轮询暂停计数器 - 允许暂停指定次数的轮询
  const pollSkipCountRef = useRef<number>(0);

  /**
   * 获取服务器状态的时间戳（毫秒）
   */
  const getTimestampFromSession = useCallback((data: SessionInfo): number => {
    if (data.updatedAt) {
      const ts = typeof data.updatedAt === 'string' ? new Date(data.updatedAt).getTime() : data.updatedAt.getTime();
      if (!Number.isNaN(ts)) return ts;
    }
    return Date.now();
  }, []);

  const syncSession = useCallback(async () => {
    if (isDemo) {
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

    try {
      const response = await fetch(`/api/session/${sessionId}`);
      const data = (await response.json()) as SessionInfo & { error?: string };

      if (!response.ok) {
        throw new Error(data.error || '课堂读取失败');
      }

      const serverTimestamp = getTimestampFromSession(data);

      // 版本控制: 如果服务器状态比已知最新状态旧，忽略它
      // 允许500ms的容差以处理网络延迟
      if (serverTimestamp < lastKnownTimestampRef.current - 500) {
        console.warn('[SessionSync] Ignoring stale state:', {
          serverTimestamp,
          lastKnown: lastKnownTimestampRef.current,
          diff: lastKnownTimestampRef.current - serverTimestamp,
        });
        // 不更新状态，但也不要报错
        setLoadingSession(false);
        return;
      }

      // 更新已知最新时间戳
      lastKnownTimestampRef.current = serverTimestamp;

      setSessionInfo(data);
      const nextIndex = data.currentItemId ? stepIds.findIndex((stepId) => stepId === data.currentItemId) : -1;

      if (followTeacher) {
        if (nextIndex >= 0) {
          setTeacherIndex(nextIndex);
          if (!initialTeacherSyncRef.current) {
            setActiveIndex(nextIndex);
            initialTeacherSyncRef.current = true;
          }
        } else if (!initialTeacherSyncRef.current) {
          initialTeacherSyncRef.current = true;
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
        if (pendingStepIdRef.current === stepIds[nextIndex]) {
          pendingStepIdRef.current = null;
        }
      }

      setLoadingSession(false);
      setError(null);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : '课堂同步失败');
      setLoadingSession(false);
    }
  }, [followTeacher, isDemo, sessionId, stepIds, getTimestampFromSession]);

  const patchSession = useCallback(
    async (patch: Record<string, unknown>) => {
      const response = await fetch(`/api/session/${sessionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });

      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(data.error || '课堂更新失败');
      }

      return data;
    },
    [sessionId],
  );

  const patchCurrentStep = useCallback(
    async (nextIndex: number, patch: Record<string, unknown>) => {
      const previousIndex = activeIndex;
      const nextStepId = stepIds[nextIndex];

      // 设置PATCH进行中标志，暂停轮询
      isPatchingRef.current = true;

      // 乐观更新UI
      setActiveIndex(nextIndex);
      setTeacherIndex(nextIndex);
      pendingStepIdRef.current = nextStepId ?? null;
      setError(null);

      try {
        const response = await fetch(`/api/session/${sessionId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(patch),
        });

        const data = (await response.json()) as SessionInfo & { error?: string };

        if (!response.ok) {
          throw new Error(data.error || '课堂更新失败');
        }

        // PATCH成功后，更新已知时间戳并跳过接下来的2次轮询
        // 给服务器时间传播状态，避免竞态
        const serverTimestamp = getTimestampFromSession(data);
        lastKnownTimestampRef.current = serverTimestamp;
        pollSkipCountRef.current = 2;

        // 更新本地sessionInfo以确保一致性
        setSessionInfo(data);
      } catch (requestError) {
        pendingStepIdRef.current = null;
        setActiveIndex(previousIndex);
        setTeacherIndex(previousIndex);
        setError(requestError instanceof Error ? requestError.message : '课堂推进失败');
        throw requestError;
      } finally {
        // 恢复轮询
        isPatchingRef.current = false;
      }
    },
    [activeIndex, sessionId, stepIds, getTimestampFromSession],
  );

  const finishSession = useCallback(async () => {
    try {
      await patchSession({ status: 'FINISHED' });
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : '结束课堂失败');
      throw requestError;
    }
  }, [patchSession]);

  useEffect(() => {
    if (!isDemo) {
      return;
    }

    setLoadingSession(false);
    const demoIndex = demoStepId ? stepIds.findIndex((stepId) => stepId === demoStepId) : -1;
    const nextIndex = demoIndex >= 0 ? demoIndex : 0;
    setActiveIndex(nextIndex);
    setTeacherIndex(nextIndex);
    initialTeacherSyncRef.current = true;
    initializedTeacherRef.current = true;
  }, [demoStepId, isDemo, stepIds]);

  useEffect(() => {
    if (isDemo) {
      return;
    }

    void syncSession();
  }, [isDemo, syncSession]);

  useEffect(() => {
    if (isDemo) {
      return;
    }

    const timer = window.setInterval(() => {
      void syncSession();
    }, pollIntervalMs);

    return () => window.clearInterval(timer);
  }, [isDemo, pollIntervalMs, syncSession]);

  return {
    sessionInfo,
    loadingSession,
    activeIndex,
    teacherIndex,
    error,
    setActiveIndex,
    setTeacherIndex,
    syncSession,
    patchCurrentStep,
    finishSession,
  };
}
