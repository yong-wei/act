'use client';

import { useCallback, useMemo, useRef, useState } from 'react';

import type {
  SelfViewStatePayload,
  SessionStateRecord,
  StudentViewStatePayload,
  TeacherViewStatePayload,
} from './session-contract';
import {
  buildFetchFailureTelemetry,
  buildHttpFailureTelemetry,
  createSyncIncidentTracker,
  createFetchTimeout,
  DEFAULT_SYNC_FETCH_TIMEOUT_MS,
  dispatchSyncRecoveryTelemetry,
  getFetchFailureTelemetry,
  toFetchTelemetryError,
  type FetchTelemetrySource,
} from './fetch-diagnostics';

interface UseSessionStateChannelOptions {
  sessionId: string;
  isDemo?: boolean;
  currentStepId?: string | null;
}

function emptyViewPayload(): TeacherViewStatePayload {
  return {
    states: [],
    courseStates: [],
    teacherStates: [],
    summary: {
      totalStudents: 0,
      latestUpdate: null,
    },
  };
}

export function useSessionStateChannel({ sessionId, isDemo = false, currentStepId = null }: UseSessionStateChannelOptions) {
  const [stateRecords, setStateRecords] = useState<SessionStateRecord[]>([]);
  const [courseStates, setCourseStates] = useState<SessionStateRecord[]>([]);
  const [teacherStates, setTeacherStates] = useState<SessionStateRecord[]>([]);
  const [summary, setSummary] = useState(emptyViewPayload().summary);
  const [teacherViewHydrated, setTeacherViewHydrated] = useState(isDemo);
  const [studentViewHydrated, setStudentViewHydrated] = useState(isDemo);
  const syncIncidentTrackerRef = useRef<ReturnType<typeof createSyncIncidentTracker> | null>(null);
  const failureCountByRequestRef = useRef<Map<string, number>>(new Map());

  if (!syncIncidentTrackerRef.current) {
    syncIncidentTrackerRef.current = createSyncIncidentTracker();
  }

  const fetchJson = useCallback(
    async <T,>(url: string, source: FetchTelemetrySource, init?: RequestInit): Promise<T> => {
      const method = init?.method ?? 'GET';
      const requestKey = `${source}\u0000${method}\u0000${url}`;
      const startedAt = Date.now();
      const timeout = init?.signal ? null : createFetchTimeout();
      const requestInit = timeout
        ? { ...(init ?? {}), signal: timeout.signal }
        : init;
      try {
        const response = await fetch(url, requestInit);
        if (!response.ok) {
          let message = '课堂状态读取失败';
          try {
            const data = (await response.clone().json()) as { error?: string };
            message = data.error || message;
          } catch {
            // Keep the generic message when the response is not JSON.
          }
          throw toFetchTelemetryError(
            message,
            buildHttpFailureTelemetry({ source, url, method, startedAt, response }),
          );
        }
        const payload = (await response.json()) as T;
        const recoveryTelemetry = syncIncidentTrackerRef.current!.recordRecovery({
          sessionId,
          stepId: currentStepId,
          source,
          url,
          method,
        });
        for (const telemetry of recoveryTelemetry) {
          dispatchSyncRecoveryTelemetry(telemetry);
        }
        failureCountByRequestRef.current.delete(requestKey);
        return payload;
      } catch (error) {
        const consecutiveFailures = (failureCountByRequestRef.current.get(requestKey) ?? 0) + 1;
        failureCountByRequestRef.current.set(requestKey, consecutiveFailures);
        const telemetry =
          getFetchFailureTelemetry(error) ??
          buildFetchFailureTelemetry({
            source,
            url,
            method,
            startedAt,
            error,
            timeoutMs: DEFAULT_SYNC_FETCH_TIMEOUT_MS,
          });
        const incident = syncIncidentTrackerRef.current!.recordFailure({
          telemetry,
          stepId: currentStepId,
          consecutiveFailures,
        });
        throw toFetchTelemetryError(
          error instanceof Error ? error.message : '课堂状态读取失败',
          incident.telemetry,
        );
      } finally {
        timeout?.clear();
      }
    },
    [currentStepId, sessionId],
  );

  const applyViewPayload = useCallback((payload: TeacherViewStatePayload | StudentViewStatePayload | SelfViewStatePayload) => {
    setStateRecords(payload.states ?? []);
    setCourseStates(payload.courseStates ?? []);
    setTeacherStates(payload.teacherStates ?? []);
    setSummary(
      payload.summary ?? {
        totalStudents: payload.courseStates?.length ?? 0,
        latestUpdate: null,
      },
    );
    return payload;
  }, []);

  const fetchSelfStates = useCallback(async () => {
    if (isDemo) {
      return emptyViewPayload();
    }

    const payload = await fetchJson<SelfViewStatePayload>(
      `/api/session/${sessionId}/state?scope=self`,
      'session_state_self_get',
    );
    return applyViewPayload(payload);
  }, [applyViewPayload, fetchJson, isDemo, sessionId]);

  const fetchStudentViewStates = useCallback(async () => {
    if (isDemo) {
      setStudentViewHydrated(true);
      return emptyViewPayload();
    }

    const payload = await fetchJson<StudentViewStatePayload>(
      `/api/session/${sessionId}/state?scope=student-view`,
      'student_state_get',
    );
    const appliedPayload = applyViewPayload(payload);
    setStudentViewHydrated(true);
    return appliedPayload;
  }, [applyViewPayload, fetchJson, isDemo, sessionId]);

  const fetchTeacherViewStates = useCallback(async () => {
    if (isDemo) {
      setTeacherViewHydrated(true);
      return emptyViewPayload();
    }

    const payload = await fetchJson<TeacherViewStatePayload>(
      `/api/session/${sessionId}/state?scope=teacher-view`,
      'teacher_state_get',
    );
    const appliedPayload = applyViewPayload(payload);
    setTeacherViewHydrated(true);
    return appliedPayload;
  }, [applyViewPayload, fetchJson, isDemo, sessionId]);

  const postState = useCallback(
    async (payload: {
      itemId: string;
      stateKey?: string;
      lessonKey?: string | null;
      clientEventAt?: number | string | null;
      data: unknown;
    }) => {
      if (isDemo) {
        return null;
      }

      return fetchJson(`/api/session/${sessionId}/state`, 'session_state_post', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    },
    [fetchJson, isDemo, sessionId],
  );

  return useMemo(
    () => ({
      stateRecords,
      courseStates,
      teacherStates,
      summary,
      teacherViewHydrated,
      studentViewHydrated,
      fetchSelfStates,
      fetchStudentViewStates,
      fetchTeacherViewStates,
      postState,
    }),
    [
      stateRecords,
      courseStates,
      teacherStates,
      summary,
      teacherViewHydrated,
      studentViewHydrated,
      fetchSelfStates,
      fetchStudentViewStates,
      fetchTeacherViewStates,
      postState,
    ],
  );
}
