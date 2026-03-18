'use client';

import { useCallback, useMemo, useState } from 'react';

import type {
  SelfViewStatePayload,
  SessionStateRecord,
  StudentViewStatePayload,
  TeacherViewStatePayload,
} from './session-contract';

interface UseSessionStateChannelOptions {
  sessionId: string;
  isDemo?: boolean;
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

export function useSessionStateChannel({ sessionId, isDemo = false }: UseSessionStateChannelOptions) {
  const [stateRecords, setStateRecords] = useState<SessionStateRecord[]>([]);
  const [courseStates, setCourseStates] = useState<SessionStateRecord[]>([]);
  const [teacherStates, setTeacherStates] = useState<SessionStateRecord[]>([]);
  const [summary, setSummary] = useState(emptyViewPayload().summary);
  const [teacherViewHydrated, setTeacherViewHydrated] = useState(isDemo);

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

    const response = await fetch(`/api/session/${sessionId}/state?scope=self`);
    if (!response.ok) {
      throw new Error('课堂状态读取失败');
    }

    const payload = (await response.json()) as SelfViewStatePayload;
    return applyViewPayload(payload);
  }, [applyViewPayload, isDemo, sessionId]);

  const fetchStudentViewStates = useCallback(async () => {
    if (isDemo) {
      return emptyViewPayload();
    }

    const response = await fetch(`/api/session/${sessionId}/state?scope=student-view`);
    if (!response.ok) {
      throw new Error('课堂状态读取失败');
    }

    const payload = (await response.json()) as StudentViewStatePayload;
    return applyViewPayload(payload);
  }, [applyViewPayload, isDemo, sessionId]);

  const fetchTeacherViewStates = useCallback(async () => {
    if (isDemo) {
      setTeacherViewHydrated(true);
      return emptyViewPayload();
    }

    const response = await fetch(`/api/session/${sessionId}/state?scope=teacher-view`);
    if (!response.ok) {
      throw new Error('课堂状态读取失败');
    }

    const payload = (await response.json()) as TeacherViewStatePayload;
    const appliedPayload = applyViewPayload(payload);
    setTeacherViewHydrated(true);
    return appliedPayload;
  }, [applyViewPayload, isDemo, sessionId]);

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

      const response = await fetch(`/api/session/${sessionId}/state`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error || '课堂状态写入失败');
      }

      return response.json();
    },
    [isDemo, sessionId],
  );

  return useMemo(
    () => ({
      stateRecords,
      courseStates,
      teacherStates,
      summary,
      teacherViewHydrated,
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
      fetchSelfStates,
      fetchStudentViewStates,
      fetchTeacherViewStates,
      postState,
    ],
  );
}
