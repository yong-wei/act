import { renderToString } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { TeacherLessonSessionResult } from '../session-framework/session-contract';
import { getFetchFailureTelemetry } from '../session-framework/fetch-diagnostics';
import { useTeacherLessonSession } from '../session-framework/use-teacher-lesson-session';

type StudentState = { name: string };
type TeacherSyncState = {
  activeStepId: string;
  revealedAnswers: Record<string, boolean>;
  updatedAt: number;
};
type TeacherSyncInput = {
  activeStepId: string;
  revealedAnswers: Record<string, boolean>;
};

const adapter = {
  lessonKey: 'unit-test-lesson',
  studentItemId: 'student:test:state',
  teacherItemId: 'teacher:test:sync',
  studentStateKey: 'student-state',
  teacherStateKey: 'teacher-sync',
  createEmptyStudentState: (name: string): StudentState => ({ name }),
  isStudentState: (value: unknown): value is StudentState =>
    Boolean(value && typeof value === 'object' && 'name' in value),
  isTeacherSyncState: (value: unknown): value is TeacherSyncState =>
    Boolean(value && typeof value === 'object' && 'activeStepId' in value),
  buildTeacherSyncPayload: (input: TeacherSyncInput): TeacherSyncState => ({
    ...input,
    updatedAt: Date.now(),
  }),
};

describe('useTeacherLessonSession', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 200 })));
  });

  it('skips repeated teacher sync posts when only volatile timestamps changed', async () => {
    let session: TeacherLessonSessionResult<TeacherSyncState, TeacherSyncInput> | null = null;

    function Harness() {
      session = useTeacherLessonSession({
        sessionId: 'session-001',
        steps: [{ id: 'step-04' }, { id: 'step-05' }],
        adapter,
      });
      return null;
    }

    renderToString(<Harness />);

    const teacherSession = session as unknown as TeacherLessonSessionResult<TeacherSyncState, TeacherSyncInput> | null;
    if (!teacherSession) throw new Error('Expected teacher lesson session');

    await teacherSession.postTeacherSyncState({
      activeStepId: 'step-04',
      revealedAnswers: { 'step-04': true },
      updatedAt: 1_776_307_900_000,
    });
    await teacherSession.postTeacherSyncState({
      revealedAnswers: { 'step-04': true },
      activeStepId: 'step-04',
      updatedAt: 1_776_307_950_000,
    });
    await teacherSession.postTeacherSyncState({
      activeStepId: 'step-05',
      revealedAnswers: { 'step-04': true },
      updatedAt: 1_776_308_000_000,
    });

    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('tags state sync failures with the current lesson step', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(
      JSON.stringify({ error: 'state write failed' }),
      {
        status: 503,
        statusText: 'Service Unavailable',
        headers: { 'content-type': 'application/json' },
      },
    )));
    let session: TeacherLessonSessionResult<TeacherSyncState, TeacherSyncInput> | null = null;

    function Harness() {
      session = useTeacherLessonSession({
        sessionId: 'session-001',
        steps: [{ id: 'step-04' }, { id: 'step-05' }],
        adapter,
      });
      return null;
    }

    renderToString(<Harness />);

    const teacherSession = session as unknown as TeacherLessonSessionResult<TeacherSyncState, TeacherSyncInput> | null;
    if (!teacherSession) throw new Error('Expected teacher lesson session');

    let caughtError: unknown;
    try {
      await teacherSession.postTeacherSyncState({
        activeStepId: 'step-04',
        revealedAnswers: { 'step-04': true },
        updatedAt: 1_776_307_900_000,
      });
    } catch (error) {
      caughtError = error;
    }

    const telemetry = getFetchFailureTelemetry(caughtError);
    expect(telemetry?.incidentKey).toContain('\u0000step-04\u0000');
  });
});
