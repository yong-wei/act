import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  extractInteractiveSessionHint,
  resolveInteractiveTutoringState,
  type InteractiveTutoringDb,
} from '@/lib/konling-interactive-tutoring-state';

const LESSON = 'unit-1-4-time-frequency-views-v1';
const STEP = 'step-03';
const REQUIRED = ['card-1', 'card-2'];

const boundManifest = () => ({
  steps: [{
    id: STEP,
    interactionSpec: { activityCards: REQUIRED.map((id) => ({ id })) },
    modules: [],
  }],
});

const sessionReaderMock = vi.hoisted(() => ({
  loadSessionBoundLessonRuntime: vi.fn(async () => ({ status: 'legacy' as const })),
}));

vi.mock('@/lib/course-bundle/session-reader', () => sessionReaderMock);

function boundRuntime() {
  sessionReaderMock.loadSessionBoundLessonRuntime.mockResolvedValue({
    status: 'bound',
    lessonRuntime: { interactiveManifest: boundManifest() },
  });
}

function buildDb(rows: {
  sessionClassId?: string | null;
  memberOfClass?: boolean;
  courseStateData?: unknown;
  teacherSyncData?: unknown;
  evidenceAnswers?: Record<string, string> | null;
} = {}): InteractiveTutoringDb {
  return {
    classSession: {
      findUnique: async () => (rows.sessionClassId === undefined ? null : { classId: rows.sessionClassId }),
    },
    studentProfile: {
      findFirst: async (args: { where: { userId: string } }) => (
        rows.memberOfClass ? { userId: args.where.userId } : null
      ),
    },
    studentState: {
      findUnique: async () => ({ data: rows.courseStateData ?? null, lessonKey: LESSON }),
      findFirst: async () => (rows.teacherSyncData === undefined ? null : { data: rows.teacherSyncData }),
    },
    studentStepResponse: {
      findFirst: async () => (
        rows.evidenceAnswers === undefined || rows.evidenceAnswers === null
          ? null
          : { responseData: { answers: rows.evidenceAnswers } }
      ),
    },
  };
}

const student = { authenticatedUserId: 'student-1', role: 'STUDENT', courseId: LESSON, pageId: STEP };
const memberDb = (extra: Parameters<typeof buildDb>[0] = {}) => buildDb({
  sessionClassId: 'class-1',
  memberOfClass: true,
  courseStateData: {},
  ...extra,
});

beforeEach(() => {
  vi.clearAllMocks();
  boundRuntime();
});

describe('extractInteractiveSessionHint', () => {
  it('parses classroom and student session ids from route hints', () => {
    expect(extractInteractiveSessionHint({ url: '/interactive-learning/courses/x/student/sess-9' })).toBe('sess-9');
    expect(extractInteractiveSessionHint({ stepId: '/interactive-learning/resources/r/classroom/sess-2' })).toBe('sess-2');
    expect(extractInteractiveSessionHint({ url: '/interactive-learning/courses/x/demo' })).toBeNull();
    expect(extractInteractiveSessionHint(null)).toBeNull();
  });
});

describe('resolveInteractiveTutoringState', () => {
  it('returns null for pages outside the interactive lesson registry', async () => {
    const state = await resolveInteractiveTutoringState(buildDb(), {
      ...student,
      courseId: 'interactive',
      pageId: '/some/other/page',
      sessionIdHint: 'sess-1',
    });
    expect(state).toBeNull();
    expect(sessionReaderMock.loadSessionBoundLessonRuntime).not.toHaveBeenCalled();
  });

  it('grounds the embedded interactive resource entry through its resource identity', async () => {
    const state = await resolveInteractiveTutoringState(memberDb(), {
      ...student,
      courseId: 'interactive',
      pageId: '/interactive-learning/resources/unit11%3Astep-03/classroom/sess-1',
      sessionIdHint: 'sess-1',
    });
    expect(state?.status).not.toBe('unresolved');
    expect(sessionReaderMock.loadSessionBoundLessonRuntime).toHaveBeenCalledWith(
      expect.objectContaining({ expectedCanonicalId: '1-1', role: 'student' }),
    );
  });

  it('degrades to unresolved without a session hint and never claims response awareness', async () => {
    const state = await resolveInteractiveTutoringState(memberDb(), { ...student, sessionIdHint: null });
    expect(state?.status).toBe('unresolved');
    expect(state?.checkAnswerAllowed).toBe(false);
    expect(state?.stateRule).toContain('不得声称已读取学生作答');
    expect(sessionReaderMock.loadSessionBoundLessonRuntime).not.toHaveBeenCalled();
  });

  it('degrades to unresolved for teacher role', async () => {
    const state = await resolveInteractiveTutoringState(memberDb(), { ...student, role: 'TEACHER', sessionIdHint: 'sess-1' });
    expect(state?.status).toBe('unresolved');
  });

  it('degrades to unresolved for an unbound legacy session', async () => {
    sessionReaderMock.loadSessionBoundLessonRuntime.mockResolvedValue({ status: 'legacy' });
    const state = await resolveInteractiveTutoringState(memberDb(), { ...student, sessionIdHint: 'sess-1' });
    expect(state?.status).toBe('unresolved');
  });

  it('degrades to unresolved for missing sessions, drift and non-members', async () => {
    sessionReaderMock.loadSessionBoundLessonRuntime.mockResolvedValue({ status: 'drift', code: 'course-bundle-binding-drift' });
    const drift = await resolveInteractiveTutoringState(memberDb(), { ...student, sessionIdHint: 'sess-1' });
    expect(drift?.status).toBe('unresolved');

    boundRuntime();
    const noSession = await resolveInteractiveTutoringState(buildDb(), { ...student, sessionIdHint: 'ghost' });
    expect(noSession?.status).toBe('unresolved');

    const outsider = await resolveInteractiveTutoringState(
      buildDb({ sessionClassId: 'class-2', memberOfClass: false }),
      { ...student, sessionIdHint: 'sess-1' },
    );
    expect(outsider?.status).toBe('unresolved');
    expect(outsider?.checkAnswerAllowed).toBe(false);
  });

  it('answers unanswered before any persisted response exists', async () => {
    const state = await resolveInteractiveTutoringState(memberDb(), { ...student, sessionIdHint: 'sess-1' });
    expect(state?.status).toBe('unanswered');
    expect(state?.checkAnswerAllowed).toBe(false);
    expect(state?.stateRule).toContain('禁止给出答案、检查答案或生成提交内容');
  });

  it('keeps hint-only tutoring while a response is saved but not submitted', async () => {
    const state = await resolveInteractiveTutoringState(
      memberDb({ courseStateData: { responses: { [STEP]: { answers: { 'card-1': '部分作答' } } } } }),
      { ...student, sessionIdHint: 'sess-1' },
    );
    expect(state?.status).toBe('in_progress');
    expect(state?.checkAnswerAllowed).toBe(false);
    expect(state?.promptSection).not.toContain('部分作答');
  });

  it('requires every required answer in the immutable submission evidence row', async () => {
    const partial = await resolveInteractiveTutoringState(
      memberDb({ courseStateData: { responses: { [STEP]: { answers: { 'card-1': 'x', 'card-2': 'y' } } } }, evidenceAnswers: { 'card-1': '第一卡作答' } }),
      { ...student, sessionIdHint: 'sess-1' },
    );
    expect(partial?.status).toBe('in_progress');
    expect(partial?.checkAnswerAllowed).toBe(false);

    const emptyValue = await resolveInteractiveTutoringState(
      memberDb({ courseStateData: { responses: { [STEP]: { answers: { 'card-1': 'x', 'card-2': 'y' } } } }, evidenceAnswers: { 'card-1': '第一卡作答', 'card-2': '   ' } }),
      { ...student, sessionIdHint: 'sess-1' },
    );
    expect(emptyValue?.status).toBe('in_progress');
    expect(emptyValue?.checkAnswerAllowed).toBe(false);
  });

  it('permits bounded checking from evidence answers after complete submission', async () => {
    const state = await resolveInteractiveTutoringState(
      memberDb({
        courseStateData: { responses: { [STEP]: { answers: { 'card-1': 'x', 'card-2': 'y' } } } },
        evidenceAnswers: { 'card-1': 'Bode 幅频低频段', 'card-2': 'Nyquist 包含 (-1, j0)' },
      }),
      { ...student, sessionIdHint: 'sess-1' },
    );
    expect(state?.status).toBe('submitted');
    expect(state?.checkAnswerAllowed).toBe(true);
    expect(state?.promptSection).toContain('card-1=Bode 幅频低频段');
    expect(state?.stateRule).toContain('不得代写或替学生提交');
  });

  it('honours only the server-persisted teacher disclosure', async () => {
    const disclosed = await resolveInteractiveTutoringState(
      memberDb({ teacherSyncData: { revealedAnswers: { [STEP]: true } } }),
      { ...student, sessionIdHint: 'sess-1' },
    );
    expect(disclosed?.status).toBe('teacher_disclosed');
    expect(disclosed?.checkAnswerAllowed).toBe(true);

    const otherStep = await resolveInteractiveTutoringState(
      memberDb({ teacherSyncData: { revealedAnswers: { 'step-09': true } } }),
      { ...student, sessionIdHint: 'sess-1' },
    );
    expect(otherStep?.status).toBe('unanswered');
  });

  it('reflects persisted state changes between turns without holding conversation state', async () => {
    const rows: { courseStateData?: unknown; evidenceAnswers?: Record<string, string> | null } = {
      courseStateData: {},
    };
    const mutable = buildDb({
      sessionClassId: 'class-1',
      memberOfClass: true,
      get courseStateData() { return rows.courseStateData; },
      get evidenceAnswers() { return rows.evidenceAnswers; },
    } as Parameters<typeof buildDb>[0]);
    const before = await resolveInteractiveTutoringState(mutable, { ...student, sessionIdHint: 'sess-1' });
    expect(before?.status).toBe('unanswered');

    rows.courseStateData = { responses: { [STEP]: { answers: { 'card-1': '部分作答' } } } };
    const partial = await resolveInteractiveTutoringState(mutable, { ...student, sessionIdHint: 'sess-1' });
    expect(partial?.status).toBe('in_progress');

    rows.evidenceAnswers = { 'card-1': '完整一', 'card-2': '完整二' };
    const after = await resolveInteractiveTutoringState(mutable, { ...student, sessionIdHint: 'sess-1' });
    expect(after?.status).toBe('submitted');
  });

  it('bounds the learner answer summary', async () => {
    const answers: Record<string, string> = {
      'card-1': 'x'.repeat(300),
      'card-2': 'x'.repeat(300),
      ...Object.fromEntries(Array.from({ length: 14 }, (_, index) => [`extra-${index + 1}`, 'x'.repeat(300)])),
    };
    const state = await resolveInteractiveTutoringState(
      memberDb({ evidenceAnswers: answers }),
      { ...student, sessionIdHint: 'sess-1' },
    );
    expect(state?.status).toBe('submitted');
    const section = state?.promptSection ?? '';
    expect(section).not.toContain('extra-11');
    expect(section.length).toBeLessThan(3000);
  });
});
