import { renderToString } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import type { StudentLessonSessionResult } from '../session-framework/session-contract';
import {
  shouldApplyStudentServerState,
  shouldInitializeStudentPresence,
  useStudentLessonSession,
} from '../session-framework/use-student-lesson-session';

type StudentState = { studentName: string; items: string[] };
type TeacherState = { activeStepId: string };

const adapter = {
  lessonKey: 'queue-test',
  studentItemId: 'student:queue-test:state',
  teacherItemId: 'teacher:queue-test:sync',
  studentStateKey: 'student-state',
  teacherStateKey: 'teacher-sync',
  createEmptyStudentState: (studentName: string): StudentState => ({ studentName, items: [] }),
  isStudentState: (value: unknown): value is StudentState =>
    Boolean(value && typeof value === 'object' && 'items' in value),
  isTeacherSyncState: (value: unknown): value is TeacherState =>
    Boolean(value && typeof value === 'object' && 'activeStepId' in value),
  buildTeacherSyncPayload: (input: TeacherState) => input,
};

type PendingRequest = {
  body: StudentState;
  resolve: () => void;
};

describe('useStudentLessonSession', () => {
  it('rejects stale polling snapshots while local writes are pending or newer', () => {
    expect(shouldApplyStudentServerState({
      localState: { updatedAt: 200, responses: { current: true } },
      serverState: { updatedAt: 100, responses: {} },
      hasLocalMutation: true,
      pendingSaves: 0,
    })).toBe(false);
    expect(shouldApplyStudentServerState({
      localState: { updatedAt: 100 },
      serverState: { updatedAt: 300 },
      hasLocalMutation: true,
      pendingSaves: 1,
    })).toBe(false);
    expect(shouldApplyStudentServerState({
      localState: { updatedAt: 100 },
      serverState: { updatedAt: 300 },
      hasLocalMutation: true,
      pendingSaves: 0,
    })).toBe(true);
  });

  it('does not initialize empty presence before the first student-view read completes', () => {
    expect(shouldInitializeStudentPresence({
      isDemo: false,
      loadingSession: false,
      studentViewHydrated: false,
      hasCurrentUser: true,
      hasSelfState: false,
      presenceAlreadySynced: false,
    })).toBe(false);
    expect(shouldInitializeStudentPresence({
      isDemo: false,
      loadingSession: false,
      studentViewHydrated: true,
      hasCurrentUser: true,
      hasSelfState: false,
      presenceAlreadySynced: false,
    })).toBe(true);
  });

  it('serializes delayed updaters against the latest confirmed course state', async () => {
    const requests: PendingRequest[] = [];
    vi.stubGlobal('fetch', vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const payload = JSON.parse(String(init?.body)) as { data: StudentState };
      return new Promise<Response>((resolve) => {
        requests.push({
          body: payload.data,
          resolve: () => resolve(new Response('{}', {
            status: 200,
            headers: { 'content-type': 'application/json' },
          })),
        });
      });
    }));

    let session: StudentLessonSessionResult<StudentState, TeacherState> | null = null;
    function Harness() {
      session = useStudentLessonSession({
        sessionId: 'session-queue',
        steps: [{ id: 'step-01' }],
        adapter,
        currentStudentName: '学生甲',
      });
      return null;
    }
    renderToString(<Harness />);

    const studentSession = session as StudentLessonSessionResult<StudentState, TeacherState> | null;
    if (!studentSession) throw new Error('Expected student lesson session');

    const first = studentSession.saveCourseState((prev) => ({
      ...prev,
      items: [...prev.items, 'first'],
    }));
    const second = studentSession.saveCourseState((prev) => ({
      ...prev,
      items: [...prev.items, 'second'],
    }));

    await Promise.resolve();
    expect(requests).toHaveLength(1);
    expect(requests[0]!.body.items).toEqual(['first']);

    requests[0]!.resolve();
    await first;
    await Promise.resolve();
    expect(requests).toHaveLength(2);
    expect(requests[1]!.body.items).toEqual(['first', 'second']);

    requests[1]!.resolve();
    await second;
    vi.unstubAllGlobals();
  });
});
