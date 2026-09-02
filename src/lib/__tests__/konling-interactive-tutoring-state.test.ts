import { describe, expect, it } from 'vitest';

import {
  extractInteractiveSessionHint,
  loadInteractiveStepRequiredResponseKeys,
  resolveInteractiveTutoringState,
  type InteractiveTutoringDb,
} from '@/lib/konling-interactive-tutoring-state';

const LESSON = 'unit-1-4-time-frequency-views-v1';
const STEP = 'step-03';

async function requiredKeysForStep(): Promise<string[]> {
  const keys = await loadInteractiveStepRequiredResponseKeys(LESSON, STEP);
  // 测试依赖仓库内已发布的 1-4 manifest；缺失则该文件本身失败。
  if (keys === null || keys.size === 0) throw new Error('published manifest missing required keys for unit-1-4 step-03');
  return [...keys];
}

function answersForKeys(keys: string[], partial = false): Record<string, string> {
  const selected = partial ? keys.slice(0, Math.max(1, keys.length - 1)) : keys;
  return Object.fromEntries(selected.map((key, index) => [key, `作答 ${index + 1}`]));
}

function courseDataWith(answers: Record<string, string> | null): unknown {
  return answers === null ? {} : { responses: { [STEP]: { answers } } };
}

function buildDb(rows: {
  sessionClassId?: string | null;
  memberOfClass?: boolean;
  courseStateData?: unknown;
  courseLessonKey?: string | null;
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
          ? { data: rows.courseStateData ?? null, lessonKey: rows.courseLessonKey === undefined ? LESSON : rows.courseLessonKey }
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
const memberDb = () => buildDb({
  sessionClassId: 'class-1',
  memberOfClass: true,
  courseStateData: {},
  courseLessonKey: LESSON,
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
    const db = buildDb();
    const state = await resolveInteractiveTutoringState(db, {
      ...student,
      courseId: 'interactive',
      pageId: '/some/other/page',
      sessionIdHint: 'sess-1',
    });
    expect(state).toBeNull();
    expect(db.queries).toEqual([]);
  });

  it('grounds the embedded interactive resource entry through its resource identity', async () => {
    const db = buildDb({
      sessionClassId: 'class-1',
      memberOfClass: true,
      courseStateData: {},
      courseLessonKey: 'unit-1-1-see-the-full-picture-v1',
    });
    const state = await resolveInteractiveTutoringState(db, {
      ...student,
      courseId: 'interactive',
      pageId: '/interactive-learning/resources/unit11%3Astep-03/classroom/sess-1',
      sessionIdHint: 'sess-1',
    });
    expect(state?.status).not.toBe('unresolved');
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

  it('rejects a course state row bound to a different lesson', async () => {
    const state = await resolveInteractiveTutoringState(
      buildDb({ sessionClassId: 'class-1', memberOfClass: true, courseStateData: {}, courseLessonKey: 'unit-2-1-modeling-language-v1' }),
      { ...student, sessionIdHint: 'sess-1' },
    );
    expect(state?.status).toBe('unresolved');
    expect(state?.checkAnswerAllowed).toBe(false);
  });

  it('keeps hint-only tutoring when evidence exists but required answers are incomplete', async () => {
    const required = await requiredKeysForStep();
    const state = await resolveInteractiveTutoringState(
      buildDb({
        sessionClassId: 'class-1',
        memberOfClass: true,
        courseStateData: courseDataWith(answersForKeys(required, true)),
        courseLessonKey: LESSON,
        submitted: true,
      }),
      { ...student, sessionIdHint: 'sess-1' },
    );
    expect(state?.status).toBe('in_progress');
    expect(state?.checkAnswerAllowed).toBe(false);
    expect(state?.promptSection).not.toContain('作答 1');
  });

  it('keeps hint-only tutoring while a response is saved but not submitted', async () => {
    const required = await requiredKeysForStep();
    const db = buildDb({
      sessionClassId: 'class-1',
      memberOfClass: true,
      courseStateData: courseDataWith(answersForKeys(required, true)),
      courseLessonKey: LESSON,
    });
    const state = await resolveInteractiveTutoringState(db, { ...student, sessionIdHint: 'sess-1' });
    expect(state?.status).toBe('in_progress');
    expect(state?.checkAnswerAllowed).toBe(false);
    expect(state?.promptSection).not.toContain('作答 1');
  });

  it('permits bounded checking from the learner own persisted answers after complete submission', async () => {
    const required = await requiredKeysForStep();
    const answers = answersForKeys(required);
    const db = buildDb({
      sessionClassId: 'class-1',
      memberOfClass: true,
      courseStateData: courseDataWith(answers),
      courseLessonKey: LESSON,
      submitted: true,
    });
    const state = await resolveInteractiveTutoringState(db, { ...student, sessionIdHint: 'sess-1' });
    expect(state?.status).toBe('submitted');
    expect(state?.checkAnswerAllowed).toBe(true);
    expect(state?.promptSection).toContain(`${required[0]}=作答 1`);
    expect(state?.stateRule).toContain('不得代写或替学生提交');
  });

  it('honours only the server-persisted teacher disclosure', async () => {
    const disclosed = await resolveInteractiveTutoringState(
      buildDb({ sessionClassId: 'class-1', memberOfClass: true, courseStateData: {}, courseLessonKey: LESSON, teacherSyncData: { revealedAnswers: { [STEP]: true } } }),
      { ...student, sessionIdHint: 'sess-1' },
    );
    expect(disclosed?.status).toBe('teacher_disclosed');
    expect(disclosed?.checkAnswerAllowed).toBe(true);

    const otherStep = await resolveInteractiveTutoringState(
      buildDb({ sessionClassId: 'class-1', memberOfClass: true, courseStateData: {}, courseLessonKey: LESSON, teacherSyncData: { revealedAnswers: { 'step-09': true } } }),
      { ...student, sessionIdHint: 'sess-1' },
    );
    expect(otherStep?.status).toBe('unanswered');
  });

  it('reflects persisted state changes between turns without holding conversation state', async () => {
    const rows: {
      sessionClassId?: string | null;
      memberOfClass?: boolean;
      courseStateData?: unknown;
      courseLessonKey?: string | null;
      submitted?: boolean;
    } = { sessionClassId: 'class-1', memberOfClass: true, courseStateData: {}, courseLessonKey: LESSON };
    const mutable = buildDb(rows);
    const before = await resolveInteractiveTutoringState(mutable, { ...student, sessionIdHint: 'sess-1' });
    expect(before?.status).toBe('unanswered');

    const required = await requiredKeysForStep();
    rows.courseStateData = courseDataWith(answersForKeys(required, true));
    rows.courseLessonKey = LESSON;
    const partial = await resolveInteractiveTutoringState(mutable, { ...student, sessionIdHint: 'sess-1' });
    expect(partial?.status).toBe('in_progress');

    rows.courseStateData = courseDataWith(answersForKeys(required));
    rows.submitted = true;
    const after = await resolveInteractiveTutoringState(mutable, { ...student, sessionIdHint: 'sess-1' });
    expect(after?.status).toBe('submitted');
  });

  it('bounds the learner answer summary', async () => {
    const answers = Object.fromEntries(
      Array.from({ length: 14 }, (_, index) => [`card-${index + 1}`, 'x'.repeat(300)]),
    );
    const required = await requiredKeysForStep();
    const extraAnswers = { ...Object.fromEntries(required.map((key) => [key, 'x'])), ...answers };
    const state = await resolveInteractiveTutoringState(
      buildDb({
        sessionClassId: 'class-1',
        memberOfClass: true,
        courseStateData: { responses: { [STEP]: { answers: extraAnswers } } },
        courseLessonKey: LESSON,
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
