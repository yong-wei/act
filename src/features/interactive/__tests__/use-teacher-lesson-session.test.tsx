import { renderToString } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { TeacherLessonSessionResult } from '../session-framework/session-contract';
import { getFetchFailureTelemetry, SYNC_RECOVERY_EVENT_NAME } from '../session-framework/fetch-diagnostics';
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

  it('emits recovery telemetry after surfaced repeated state sync network failures', async () => {
    const dispatchedRecoveryEvents: Record<string, unknown>[] = [];
    class TestCustomEvent {
      type: string;
      detail: Record<string, unknown>;

      constructor(type: string, init: { detail?: Record<string, unknown> } = {}) {
        this.type = type;
        this.detail = init.detail ?? {};
      }
    }
    vi.stubGlobal('CustomEvent', TestCustomEvent);
    vi.stubGlobal('window', {
      dispatchEvent: vi.fn((event: TestCustomEvent) => {
        if (event.type === SYNC_RECOVERY_EVENT_NAME) {
          dispatchedRecoveryEvents.push(event.detail);
        }
        return true;
      }),
    });

    let requestCount = 0;
    vi.stubGlobal('fetch', vi.fn(async () => {
      requestCount += 1;
      if (requestCount <= 3) {
        throw new TypeError('Failed to fetch');
      }
      return new Response('{}', { status: 200 });
    }));
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

    let thirdError: unknown;
    for (let index = 0; index < 3; index += 1) {
      try {
        await teacherSession.postTeacherSyncState({
          activeStepId: 'step-04',
          revealedAnswers: { 'step-04': true },
          updatedAt: 1_776_307_900_000,
        });
      } catch (error) {
        thirdError = error;
      }
    }

    const thirdTelemetry = getFetchFailureTelemetry(thirdError);
    expect(thirdTelemetry).toMatchObject({
      source: 'session_state_post',
      failureKind: 'network',
      incidentConsecutiveFailures: 3,
      incidentOccurrenceCount: 3,
      incidentSuppressed: false,
    });

    await teacherSession.postTeacherSyncState({
      activeStepId: 'step-04',
      revealedAnswers: { 'step-04': true },
      updatedAt: 1_776_307_900_000,
    });

    expect(dispatchedRecoveryEvents).toHaveLength(1);
    expect(dispatchedRecoveryEvents[0]).toMatchObject({
      eventType: 'sync_recovered',
      source: 'session_state_post',
      stepId: 'step-04',
      recoveredFailureCount: 3,
      recoveryState: 'recovered',
    });
  });
});
