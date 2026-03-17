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

  const syncSession = useCallback(async () => {
    if (isDemo) {
      return;
    }

    try {
      const response = await fetch(`/api/session/${sessionId}`);
      const data = (await response.json()) as SessionInfo & { error?: string };

      if (!response.ok) {
        throw new Error(data.error || '课堂读取失败');
      }

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
  }, [followTeacher, isDemo, sessionId, stepIds]);

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
      setActiveIndex(nextIndex);
      setTeacherIndex(nextIndex);
      pendingStepIdRef.current = nextStepId ?? null;
      setError(null);

      try {
        await patchSession(patch);
      } catch (requestError) {
        pendingStepIdRef.current = null;
        setActiveIndex(previousIndex);
        setTeacherIndex(previousIndex);
        setError(requestError instanceof Error ? requestError.message : '课堂推进失败');
        throw requestError;
      }
    },
    [activeIndex, patchSession, stepIds],
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
