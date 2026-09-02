import { describe, expect, it } from 'vitest';

import {
  extractInteractiveSessionHint,
  resolveInteractiveTutoringState,
  type InteractiveTutoringDb,
} from '@/lib/konling-interactive-tutoring-state';

const LESSON = 'unit-1-4-time-frequency-views-v1';
const STEP = 'step-03';

function buildDb(rows: {
  sessionClassId?: string | null;
  memberOfClass?: boolean;
  courseStateData?: unknown;
  teacherSyncData?: unknown;
  submitted?: boolean;
} = {}): InteractiveTutoringDb & { queries: string[] } {
  const queries: string[] = [];
  const db: InteractiveTutoringDb = {
    classSession: {
      findUnique: async (args) => {
        queries.push(`classSession:${args.where.id}`);
        return rows.sessionClassId === undefined ? null : { classId: rows.sessionClassId };
      },
    },
    studentProfile: {
      findFirst: async (args) => {
        queries.push(`studentProfile:${args.where.classId ?? 'null'}`);
        return rows.memberOfClass ? { userId: args.where.userId } : null;
      },
    },
    studentState: {
      findUnique: async (args) => {
        queries.push(`state:${args.where.sessionId_userId_stateKey.stateKey}`);
        return args.where.sessionId_userId_stateKey.stateKey === 'course'
          ? { data: rows.courseStateData ?? null }
          : null;
      },
      findFirst: async (args) => {
        queries.push(`state:${args.where.stateKey}`);
        return args.where.stateKey === 'teacher-sync'
          ? (rows.teacherSyncData === undefined ? null : { data: rows.teacherSyncData })
          : null;
      },
    },
    studentStepResponse: {
      findFirst: async (args) => {
        queries.push(`response:${args.where.lessonKey}:${args.where.stepId}`);
        return rows.submitted ? { id: 'evidence-1' } : null;
      },
    },
  };
  return { ...db, queries };
}

const student = { authenticatedUserId: 'student-1', role: 'STUDENT', courseId: LESSON, pageId: STEP };
const memberDb = () => buildDb({ sessionClassId: 'class-1', memberOfClass: true });

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
    const db = buildDb();
    const state = await resolveInteractiveTutoringState(db, {
      ...student,
      courseId: 'interactive',
      sessionIdHint: 'sess-1',
    });
    expect(state).toBeNull();
    expect(db.queries).toEqual([]);
  });

  it('degrades to unresolved without a session hint and never claims response awareness', async () => {
    const db = buildDb();
    const state = await resolveInteractiveTutoringState(db, { ...student, sessionIdHint: null });
    expect(state?.status).toBe('unresolved');
    expect(state?.checkAnswerAllowed).toBe(false);
    expect(state?.stateRule).toContain('不得声称已读取学生作答');
    expect(db.queries).toEqual([]);
  });

  it.each([
    ['teacher role', memberDb(), { role: 'TEACHER' }],
    ['missing session', buildDb(), { sessionIdHint: 'ghost' }],
    ['non-member student', buildDb({ sessionClassId: 'class-2', memberOfClass: false }), {}],
  ])('degrades to unresolved for %s', async (_label, db, overrides) => {
    const state = await resolveInteractiveTutoringState(db, { ...student, sessionIdHint: 'sess-1', ...overrides });
    expect(state?.status).toBe('unresolved');
    expect(state?.checkAnswerAllowed).toBe(false);
  });

  it('answers unanswered before any persisted response exists', async () => {
    const state = await resolveInteractiveTutoringState(memberDb(), { ...student, sessionIdHint: 'sess-1' });
    expect(state?.status).toBe('unanswered');
    expect(state?.checkAnswerAllowed).toBe(false);
    expect(state?.stateRule).toContain('禁止给出答案、检查答案或生成提交内容');
  });

  it('keeps hint-only tutoring while a response is saved but not submitted', async () => {
    const db = buildDb({
      sessionClassId: 'class-1',
      memberOfClass: true,
      courseStateData: { responses: { [STEP]: { answers: { 'card-1': 'Bode 图幅频低频段' } } } },
    });
    const state = await resolveInteractiveTutoringState(db, { ...student, sessionIdHint: 'sess-1' });
    expect(state?.status).toBe('in_progress');
    expect(state?.checkAnswerAllowed).toBe(false);
    expect(state?.promptSection).not.toContain('Bode 图幅频低频段');
  });

  it('permits bounded checking from the learner own persisted answers after submission', async () => {
    const db = buildDb({
      sessionClassId: 'class-1',
      memberOfClass: true,
      courseStateData: { responses: { [STEP]: { answers: { 'card-1': 'Bode 图幅频低频段' } } } },
      submitted: true,
    });
    const state = await resolveInteractiveTutoringState(db, { ...student, sessionIdHint: 'sess-1' });
    expect(state?.status).toBe('submitted');
    expect(state?.checkAnswerAllowed).toBe(true);
    expect(state?.promptSection).toContain('card-1=Bode 图幅频低频段');
    expect(state?.stateRule).toContain('不得代写或替学生提交');
  });

  it('honours only the server-persisted teacher disclosure', async () => {
    const disclosed = await resolveInteractiveTutoringState(
      buildDb({ sessionClassId: 'class-1', memberOfClass: true, teacherSyncData: { revealedAnswers: { [STEP]: true } } }),
      { ...student, sessionIdHint: 'sess-1' },
    );
    expect(disclosed?.status).toBe('teacher_disclosed');
    expect(disclosed?.checkAnswerAllowed).toBe(true);

    const otherStep = await resolveInteractiveTutoringState(
      buildDb({ sessionClassId: 'class-1', memberOfClass: true, teacherSyncData: { revealedAnswers: { 'step-09': true } } }),
      { ...student, sessionIdHint: 'sess-1' },
    );
    expect(otherStep?.status).toBe('unanswered');
  });

  it('reflects persisted state changes between turns without holding conversation state', async () => {
    const rows: {
      sessionClassId?: string | null;
      memberOfClass?: boolean;
      courseStateData?: unknown;
      submitted?: boolean;
    } = { sessionClassId: 'class-1', memberOfClass: true };
    const mutable = buildDb(rows);
    const before = await resolveInteractiveTutoringState(mutable, { ...student, sessionIdHint: 'sess-1' });
    expect(before?.status).toBe('unanswered');

    rows.courseStateData = { responses: { [STEP]: { answers: { 'card-1': '部分作答' } } } };
    const partial = await resolveInteractiveTutoringState(mutable, { ...student, sessionIdHint: 'sess-1' });
    expect(partial?.status).toBe('in_progress');

    rows.submitted = true;
    const after = await resolveInteractiveTutoringState(mutable, { ...student, sessionIdHint: 'sess-1' });
    expect(after?.status).toBe('submitted');
  });

  it('bounds the learner answer summary', async () => {
    const answers = Object.fromEntries(
      Array.from({ length: 14 }, (_, index) => [`card-${index + 1}`, 'x'.repeat(300)]),
    );
    const state = await resolveInteractiveTutoringState(
      buildDb({
        sessionClassId: 'class-1',
        memberOfClass: true,
        courseStateData: { responses: { [STEP]: { answers } } },
        submitted: true,
      }),
      { ...student, sessionIdHint: 'sess-1' },
    );
    expect(state?.status).toBe('submitted');
    const section = state?.promptSection ?? '';
    expect(section).not.toContain('card-11');
    expect(section.length).toBeLessThan(3000);
  });
});
