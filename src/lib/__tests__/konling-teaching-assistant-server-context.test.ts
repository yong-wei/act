import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createHmac } from 'node:crypto';

vi.mock('server-only', () => ({}));

import {
  createKonlingTeachingAssistantServerContextToken,
  resolveKonlingTeachingAssistantSignedGraphNodeId,
  resolveKonlingTeachingAssistantScopeOverride,
  resolveKonlingTeachingAssistantServerModeContext,
} from '@/lib/konling-teaching-assistant-server-context';
import type { KonlingRuntimeContext, KonlingRuntimeScope } from '@/lib/konling-agent-runtime';

function scope(overrides: Partial<KonlingRuntimeScope> = {}): KonlingRuntimeScope {
  return {
    authenticatedUserId: 'teacher-1',
    targetUserId: 'teacher-1',
    role: 'teacher',
    classId: 'class-1',
    courseId: 'course-1',
    pageId: 'teacher-report',
    resourceId: null,
    pathNodeId: null,
    privacyScopes: ['teacher-scoped'],
    ...overrides,
  };
}

const runtimeContext = {} as KonlingRuntimeContext;
const TEST_SECRET = 'test-konling-mode-context-secret-for-unit-tests';

describe('Konling teaching-assistant server context', () => {
  let originalContextSecret: string | undefined;
  let originalServerContextSecret: string | undefined;
  let originalNextAuthSecret: string | undefined;
  let originalAuthSecret: string | undefined;

  beforeEach(() => {
    originalContextSecret = process.env.KONLING_MODE_CONTEXT_SECRET;
    originalServerContextSecret = process.env.KONLING_SERVER_MODE_CONTEXT_SECRET;
    originalNextAuthSecret = process.env.NEXTAUTH_SECRET;
    originalAuthSecret = process.env.AUTH_SECRET;
    process.env.KONLING_MODE_CONTEXT_SECRET = TEST_SECRET;
    delete process.env.KONLING_SERVER_MODE_CONTEXT_SECRET;
    delete process.env.NEXTAUTH_SECRET;
    delete process.env.AUTH_SECRET;
  });

  afterEach(() => {
    restoreEnv('KONLING_MODE_CONTEXT_SECRET', originalContextSecret);
    restoreEnv('KONLING_SERVER_MODE_CONTEXT_SECRET', originalServerContextSecret);
    restoreEnv('NEXTAUTH_SECRET', originalNextAuthSecret);
    restoreEnv('AUTH_SECRET', originalAuthSecret);
  });

  it('resolves a diagnosis attempt only from the authenticated student answer', async () => {
    const questionSnapshot = {
      version: 'adaptive-question-snapshot.v1',
      prompt: '单位负反馈系统的稳态误差由什么决定？',
      options: [
        { key: 'A', label: 'A', text: '系统型别与输入类型', explanation: '正确。' },
        { key: 'B', label: 'B', text: '只由带宽决定', explanation: '忽略了低频增益。' },
      ],
      correctOptionKey: 'A',
      explanation: '应同时检查系统型别和输入类型。',
      knowledgeTags: ['steady-state-error'],
      misconceptionTags: ['bandwidth-only'],
      remediationResources: [],
    };
    const answer = {
      id: 'answer-1', userId: 'student-1', sessionId: 'session-1', questionId: 'question-1',
      selectedOptionKey: 'B', correctOptionKey: 'A', isCorrect: false, answeredAt: new Date('2026-07-28T00:00:00.000Z'),
      session: { id: 'session-1', userId: 'student-1', sessionKey: 'practice-1' },
      questionRef: { knowledgeTags: ['steady-state-error'], metadata: { questionSnapshot } },
    };
    const db = {
      adaptiveAssessmentAnswer: {
        findFirst: vi.fn().mockResolvedValue(answer),
        findMany: vi.fn().mockResolvedValue([answer]),
      },
    };

    const context = await resolveKonlingTeachingAssistantServerModeContext({
      db,
      modeId: 'diagnosis-explainer',
      scope: scope({
        authenticatedUserId: 'student-1', targetUserId: 'student-1', role: 'student',
        pageId: 'adaptive-practice', privacyScopes: ['student-visible'],
      }),
      runtimeContext,
      clientContextHints: { answerId: 'answer-1' },
    });

    expect(db.adaptiveAssessmentAnswer.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'answer-1', userId: 'student-1' },
    }));
    expect(context.adaptiveAttempt).toMatchObject({ answerId: 'answer-1', selectedOptionKey: 'B', question: questionSnapshot });
  });

  it('fails closed when diagnosis attempt context cannot be verified', async () => {
    await expect(resolveKonlingTeachingAssistantServerModeContext({
      db: {
        adaptiveAssessmentAnswer: {
          findFirst: vi.fn().mockResolvedValue(null),
          findMany: vi.fn(),
        },
      },
      modeId: 'diagnosis-explainer',
      scope: scope({
        authenticatedUserId: 'student-1', targetUserId: 'student-1', role: 'student',
        pageId: 'adaptive-practice', privacyScopes: ['student-visible'],
      }),
      runtimeContext,
      clientContextHints: { answerId: 'answer-other-user' },
    })).rejects.toMatchObject({
      name: 'KonlingAdaptiveAttemptContextError',
      status: 409,
      message: 'KONLING_ADAPTIVE_ATTEMPT_CONTEXT_UNAVAILABLE',
    });
  });

  it('accepts signed class summarizer context tokens as server-owned context', async () => {
    const modeContextToken = createKonlingTeachingAssistantServerContextToken({
      mode: 'class-summarizer',
      classId: 'class-1',
      classReportId: 'class-1:control-correction',
      goalId: 'control-correction',
      courseId: 'course-1',
      pageId: 'teacher-report',
      context: {
        'class-report': true,
        'diagnosis-view': true,
        'learner-state-summary': true,
      },
    });

    const context = await resolveKonlingTeachingAssistantServerModeContext({
      db: {
        class: {
          findUnique: async () => ({ teacherId: 'teacher-1' }),
        },
      },
      modeId: 'class-summarizer',
      scope: scope(),
      runtimeContext,
      clientContextHints: {
        modeContextToken,
      },
    });

    expect(context).toMatchObject({
      'class-report': true,
      'diagnosis-view': true,
      'learner-state-summary': true,
    });

    await expect(resolveKonlingTeachingAssistantServerModeContext({
      db: {
        class: {
          findUnique: async () => ({ teacherId: 'teacher-1' }),
        },
      },
      modeId: 'class-summarizer',
      scope: scope({ role: 'student', authenticatedUserId: 'student-1', targetUserId: 'student-1' }),
      runtimeContext,
      clientContextHints: {
        modeContextToken,
        classReportId: 'class-1:control-correction',
        goalId: 'control-correction',
      },
    })).resolves.toEqual({});

    await expect(resolveKonlingTeachingAssistantServerModeContext({
      db: {
        class: {
          findUnique: async () => ({ teacherId: 'teacher-2' }),
        },
      },
      modeId: 'class-summarizer',
      scope: scope(),
      runtimeContext,
      clientContextHints: {
        modeContextToken,
        classReportId: 'class-1:control-correction',
        goalId: 'control-correction',
      },
    })).resolves.toEqual({});
  });

  it('accepts signed student path-center context for path-advisor tools', async () => {
    const modeContextToken = createKonlingTeachingAssistantServerContextToken({
      mode: 'path-advisor',
      classId: 'class-1',
      courseId: 'course-1',
      pageId: 'adaptive-path-center',
      goalId: 'control-correction',
      graphNodeId: 'kn:autocontrol:controller-correction',
      context: {
        'student-path-center': true,
        'learner-state-summary': true,
        'resource-node': true,
      },
    });

    await expect(resolveKonlingTeachingAssistantServerModeContext({
      db: {},
      modeId: 'path-advisor',
      scope: scope({
        role: 'student',
        authenticatedUserId: 'student-1',
        targetUserId: 'student-1',
        pageId: 'adaptive-path-center',
        privacyScopes: ['student-visible'],
      }),
      runtimeContext,
      clientContextHints: {
        modeContextToken,
        goalId: 'control-correction',
        graphNodeId: 'kn:autocontrol:controller-correction',
      },
    })).resolves.toEqual({
      'student-path-center': true,
      'learner-state-summary': true,
      'resource-node': true,
    });

    await expect(resolveKonlingTeachingAssistantServerModeContext({
      db: {},
      modeId: 'path-advisor',
      scope: scope({
        role: 'student',
        authenticatedUserId: 'student-1',
        targetUserId: 'student-1',
        pageId: 'adaptive-path-center',
        privacyScopes: ['student-visible'],
      }),
      runtimeContext,
      clientContextHints: {
        modeContextToken,
        goalId: 'control-correction',
        graphNodeId: 'kn:autocontrol:forged-node',
      },
    })).resolves.toEqual({});

    await expect(resolveKonlingTeachingAssistantServerModeContext({
      db: {},
      modeId: 'path-advisor',
      scope: scope({
        role: 'teacher',
        authenticatedUserId: 'teacher-1',
        targetUserId: 'student-1',
        pageId: 'adaptive-path-center',
      }),
      runtimeContext,
      clientContextHints: { modeContextToken },
    })).resolves.toEqual({});
  });

  it('resolves signed path-advisor graph node ids as canonical server context', () => {
    const modeContextToken = createKonlingTeachingAssistantServerContextToken({
      mode: 'path-advisor',
      classId: 'class-1',
      courseId: 'control-correction',
      pageId: 'adaptive-path-center',
      goalId: 'control-correction',
      graphNodeId: 'kn:autocontrol:controller-correction',
      context: {
        'student-path-center': true,
        'learner-state-summary': true,
        'resource-node': true,
      },
    });
    const studentPathScope = scope({
      role: 'student',
      authenticatedUserId: 'student-1',
      targetUserId: 'student-1',
      courseId: 'control-correction',
      pageId: 'adaptive-path-center',
      privacyScopes: ['student-visible'],
    });

    expect(resolveKonlingTeachingAssistantSignedGraphNodeId({
      modeId: 'path-advisor',
      scope: studentPathScope,
      clientContextHints: {
        modeContextToken,
        goalId: 'control-correction',
      },
    })).toBe('kn:autocontrol:controller-correction');

    expect(resolveKonlingTeachingAssistantSignedGraphNodeId({
      modeId: 'path-advisor',
      scope: studentPathScope,
      clientContextHints: {
        modeContextToken,
        goalId: 'control-correction',
        graphNodeId: 'kn:autocontrol:forged-node',
      },
    })).toBeNull();
  });

  it('does not sign server context tokens with the documented placeholder secret', () => {
    process.env.KONLING_SERVER_MODE_CONTEXT_SECRET = 'replace-with-strong-konling-context-secret';
    delete process.env.KONLING_MODE_CONTEXT_SECRET;

    expect(createKonlingTeachingAssistantServerContextToken({
      mode: 'path-advisor',
      classId: 'class-1',
      context: { 'student-path-center': true },
    })).toBeNull();
  });

  it('uses signed path-advisor context to bind the student class before scope verification', async () => {
    const modeContextToken = createKonlingTeachingAssistantServerContextToken({
      mode: 'path-advisor',
      classId: 'class-1',
      courseId: 'control-correction',
      pageId: 'adaptive-path-center',
      goalId: 'control-correction',
      context: {
        'student-path-center': true,
        'learner-state-summary': true,
        'evidence-citations': true,
      },
    });

    await expect(resolveKonlingTeachingAssistantScopeOverride({
      db: {},
      modeId: 'path-advisor',
      authenticatedUserId: 'student-1',
      role: 'STUDENT',
      clientContextHints: {
        classId: 'class-1',
        courseId: 'control-correction',
        goalId: 'control-correction',
        pageId: 'adaptive-path-center',
        modeContextToken,
      },
    })).resolves.toEqual({ classId: 'class-1' });

    await expect(resolveKonlingTeachingAssistantScopeOverride({
      db: {},
      modeId: 'path-advisor',
      authenticatedUserId: 'student-1',
      role: 'STUDENT',
      clientContextHints: {
        classId: 'class-1',
        courseId: 'frequency-response-foundations',
        goalId: 'frequency-response-foundations',
        pageId: 'adaptive-path-center',
        modeContextToken,
      },
    })).resolves.toEqual({});
  });

  it('uses the documented server mode context secret for path-advisor tokens', async () => {
    delete process.env.KONLING_MODE_CONTEXT_SECRET;
    process.env.KONLING_SERVER_MODE_CONTEXT_SECRET = TEST_SECRET;

    const modeContextToken = createKonlingTeachingAssistantServerContextToken({
      mode: 'path-advisor',
      classId: 'class-1',
      courseId: 'course-1',
      pageId: 'adaptive-path-center',
      context: {
        'student-path-center': true,
      },
    });

    expect(modeContextToken).toEqual(expect.any(String));
    await expect(resolveKonlingTeachingAssistantServerModeContext({
      db: {},
      modeId: 'path-advisor',
      scope: scope({
        role: 'student',
        authenticatedUserId: 'student-1',
        targetUserId: 'student-1',
        pageId: 'adaptive-path-center',
        privacyScopes: ['student-visible'],
      }),
      runtimeContext,
      clientContextHints: { modeContextToken },
    })).resolves.toEqual({
      'student-path-center': true,
    });
  });

  it('fails closed when mode context signing secret is unavailable', async () => {
    const modeContextToken = createKonlingTeachingAssistantServerContextToken({
      mode: 'class-summarizer',
      classId: 'class-1',
      context: {
        'class-report': true,
      },
    });

    delete process.env.KONLING_MODE_CONTEXT_SECRET;
    await expect(resolveKonlingTeachingAssistantServerModeContext({
      db: {},
      modeId: 'class-summarizer',
      scope: scope(),
      runtimeContext,
      clientContextHints: {
        modeContextToken,
      },
    })).resolves.toEqual({});

    expect(createKonlingTeachingAssistantServerContextToken({
      mode: 'class-summarizer',
      classId: 'class-1',
      context: {
        'class-report': true,
      },
    })).toBeNull();
  });

  it('rejects unsigned class report and prep-pack client hints without server-verifiable context', async () => {
    await expect(resolveKonlingTeachingAssistantServerModeContext({
      db: {},
      modeId: 'class-summarizer',
      scope: scope(),
      runtimeContext,
      clientContextHints: {
        classReportId: 'class-2:control-correction',
      },
    })).resolves.toEqual({});

    await expect(resolveKonlingTeachingAssistantServerModeContext({
      db: {},
      modeId: 'prep-coauthor',
      scope: scope(),
      runtimeContext,
      clientContextHints: {
        prepPackId: 'prep-pack:class-1:control-correction:2026-06-05',
      },
    })).resolves.toEqual({});
  });

  it('only grants path-advisor server context with a signed path center token', async () => {
    const modeContextToken = createKonlingTeachingAssistantServerContextToken({
      mode: 'path-advisor',
      classId: 'class-1',
      courseId: 'course-1',
      pageId: 'adaptive-path-center',
      context: {
        'student-path-center': true,
      },
    });

    await expect(resolveKonlingTeachingAssistantServerModeContext({
      db: {},
      modeId: 'path-advisor',
      scope: scope({
        role: 'student',
        authenticatedUserId: 'student-1',
        targetUserId: 'student-1',
        pageId: 'adaptive-path-center',
        privacyScopes: ['student-visible'],
      }),
      runtimeContext,
      clientContextHints: {
        modeContextToken,
      },
    })).resolves.toEqual({ 'student-path-center': true });

    await expect(resolveKonlingTeachingAssistantServerModeContext({
      db: {},
      modeId: 'path-advisor',
      scope: scope({
        role: 'student',
        authenticatedUserId: 'student-1',
        targetUserId: 'student-1',
        pageId: 'step-03',
        privacyScopes: ['student-visible'],
      }),
      runtimeContext,
      clientContextHints: {
        modeContextToken,
      },
    })).resolves.toEqual({});

    await expect(resolveKonlingTeachingAssistantServerModeContext({
      db: {},
      modeId: 'path-advisor',
      scope: scope({
        role: 'student',
        authenticatedUserId: 'student-1',
        targetUserId: 'student-1',
        pageId: 'adaptive-path-center',
        privacyScopes: ['student-visible'],
      }),
      runtimeContext,
    })).resolves.toEqual({});
  });

  it('rejects signed mode context tokens when object bindings do not match hints or scope', async () => {
    const modeContextToken = createKonlingTeachingAssistantServerContextToken({
      mode: 'prep-coauthor',
      classId: 'class-1',
      teacherId: 'teacher-1',
      goalId: 'control-correction',
      prepPackId: 'prep-pack-1',
      context: {
        'prep-pack': true,
        'diagnosis-view': true,
        'teacher-review-state': true,
      },
    });

    await expect(resolveKonlingTeachingAssistantServerModeContext({
      db: {},
      modeId: 'prep-coauthor',
      scope: scope({ classId: 'class-1', targetUserId: 'teacher-1' }),
      runtimeContext,
      clientContextHints: {
        modeContextToken,
        prepPackId: 'prep-pack-2',
        goalId: 'control-correction',
      },
    })).resolves.toEqual({});

    await expect(resolveKonlingTeachingAssistantServerModeContext({
      db: {},
      modeId: 'prep-coauthor',
      scope: scope({ authenticatedUserId: 'teacher-2', targetUserId: 'teacher-2', classId: 'class-1' }),
      runtimeContext,
      clientContextHints: {
        modeContextToken,
        prepPackId: 'prep-pack-1',
      },
    })).resolves.toEqual({});
  });

  it('rejects legacy, expired, and archived signed prep-pack tokens before readiness', async () => {
    const legacyToken = createLegacyModeContextToken({
      mode: 'prep-coauthor',
      classId: 'class-1',
      context: {
        'prep-pack': true,
        'diagnosis-view': true,
        'teacher-review-state': true,
      },
    });
    const expiredToken = createKonlingTeachingAssistantServerContextToken({
      mode: 'prep-coauthor',
      classId: 'class-1',
      teacherId: 'teacher-1',
      goalId: 'control-correction',
      prepPackId: 'prep-pack-1',
      expiresAt: '2026-01-01T00:00:00.000Z',
      context: {
        'prep-pack': true,
        'diagnosis-view': true,
        'teacher-review-state': true,
      },
    });
    const archivedToken = createKonlingTeachingAssistantServerContextToken({
      mode: 'prep-coauthor',
      classId: 'class-1',
      teacherId: 'teacher-1',
      goalId: 'control-correction',
      prepPackId: 'prep-pack-archived',
      context: {
        'prep-pack': true,
        'diagnosis-view': true,
        'teacher-review-state': true,
      },
    });
    const db = {
      courseEnhancementPack: {
        findFirst: async () => ({
          id: 'enhancement-pack-archived',
          sourcePrepPackId: 'prep-pack-archived',
          classId: 'class-1',
          teacherId: 'teacher-1',
          goalId: 'control-correction',
          status: 'archived',
        }),
      },
    };

    for (const modeContextToken of [legacyToken, expiredToken, archivedToken]) {
      await expect(resolveKonlingTeachingAssistantServerModeContext({
        db,
        modeId: 'prep-coauthor',
        scope: scope({ classId: 'class-1', targetUserId: 'teacher-1' }),
        runtimeContext,
        clientContextHints: {
          modeContextToken,
          prepPackId: modeContextToken === archivedToken ? 'prep-pack-archived' : 'prep-pack-1',
          goalId: 'control-correction',
        },
      })).resolves.toEqual({});
    }
  });

  it('resolves prep-pack mode from the persisted course enhancement pack reader', async () => {
    const db = {
      courseEnhancementPack: {
        findFirst: async ({ where }: { where: { classId: string; teacherId: string; goalId: string; OR: Array<{ id: string } | { sourcePrepPackId: string }> } }) =>
          where.classId === 'class-1' &&
          where.teacherId === 'teacher-1' &&
          where.goalId === 'control-correction' &&
          where.OR.some((item) => ('id' in item && item.id === 'enhancement-pack-1') || ('sourcePrepPackId' in item && item.sourcePrepPackId === 'prep-pack-1'))
            ? { id: 'enhancement-pack-1', sourcePrepPackId: 'prep-pack-1', classId: 'class-1', teacherId: 'teacher-1', goalId: 'control-correction', status: 'draft' }
            : null,
      },
    };

    await expect(resolveKonlingTeachingAssistantServerModeContext({
      db,
      modeId: 'prep-coauthor',
      scope: scope({ classId: 'class-1', targetUserId: 'teacher-1' }),
      runtimeContext,
      clientContextHints: {
        prepPackId: 'prep-pack-1',
        goalId: 'control-correction',
      },
    })).resolves.toEqual({
      'prep-pack': true,
      'diagnosis-view': true,
      'teacher-review-state': true,
    });

    await expect(resolveKonlingTeachingAssistantServerModeContext({
      db,
      modeId: 'prep-coauthor',
      scope: scope({ authenticatedUserId: 'teacher-2', targetUserId: 'teacher-2', classId: 'class-1' }),
      runtimeContext,
      clientContextHints: {
        prepPackId: 'prep-pack-1',
        goalId: 'control-correction',
      },
    })).resolves.toEqual({});

    await expect(resolveKonlingTeachingAssistantServerModeContext({
      db,
      modeId: 'prep-coauthor',
      scope: scope({ classId: 'class-1', targetUserId: 'teacher-1' }),
      runtimeContext,
      clientContextHints: {
        prepPackId: 'prep-pack-1',
        goalId: 'other-goal',
      },
    })).resolves.toEqual({});

    await expect(resolveKonlingTeachingAssistantServerModeContext({
      db: {
        courseEnhancementPack: {
          findFirst: async () => ({
          id: 'enhancement-pack-archived',
          sourcePrepPackId: 'prep-pack-archived',
          classId: 'class-1',
          teacherId: 'teacher-1',
          goalId: 'control-correction',
          status: 'archived',
        }),
        },
      },
      modeId: 'prep-coauthor',
      scope: scope({ classId: 'class-1', targetUserId: 'teacher-1' }),
      runtimeContext,
      clientContextHints: {
        prepPackId: 'prep-pack-archived',
        goalId: 'control-correction',
      },
    })).resolves.toEqual({});
  });

  it('projects server-owned smart-task context and clarification readiness for the owning teacher', async () => {
    const findFirst = async ({ where }: { where: { id: string; ownerId: string } }) =>
      where.id === 'task-1' && where.ownerId === 'teacher-1'
        ? {
            id: 'task-1',
            ownerUserId: 'teacher-1',
            revision: 7,
            selectedCourseBasisVersions: [{ versionId: 'basis-version-2', citationState: 'verified', reviewState: 'CONFIRMED' }],
            unresolvedAmbiguities: [{
              id: 'ambiguity-duration',
              field: 'durationMinutes',
              question: '本课采用 45 分钟还是 90 分钟？',
              alternatives: [{ id: '45', label: '45 分钟' }, { id: '90', label: '90 分钟' }],
            }],
            confirmedDecisions: [{
              id: 'decision-topic',
              field: 'topic',
              value: '根轨迹校正',
              confirmedAt: '2026-07-19T03:00:00.000Z',
              confirmedBy: 'teacher-1',
            }],
            citationState: 'partially-verified',
            reviewState: 'teacher-draft',
          }
        : null;

    const context = await resolveKonlingTeachingAssistantServerModeContext({
      db: { smartLessonTask: { findFirst } },
      modeId: 'prep-coauthor',
      scope: scope({ classId: null, pageId: '/teacher/smart-prep' }),
      clientContextHints: {
        smartTaskId: 'task-1',
        smartTaskRevision: '7',
        reviewState: 'client-approved',
      },
    });

    expect(context).toMatchObject({
      'smart-task': true,
      'selected-course-basis-versions': true,
      'teacher-review-state': true,
      smartPreparation: {
        taskId: 'task-1',
        taskRevision: '7',
        citationState: 'partially-verified',
        reviewState: 'teacher-draft',
        clarificationReadiness: {
          status: 'clarification-required',
          canGenerate: false,
          unresolvedAmbiguityIds: ['ambiguity-duration'],
        },
        updatePolicy: {
          suggestionStatus: 'draft',
          requiresExplicitTeacherConfirmation: true,
          expectedTaskRevision: '7',
        },
      },
    });
    expect(context.smartPreparation?.reviewState).not.toBe('client-approved');
  });

  it('rejects foreign and non-teacher smart-prep task bindings', async () => {
    const findFirst = async () => null;
    const base = {
      db: { smartLessonTask: { findFirst } },
      modeId: 'prep-coauthor',
      clientContextHints: { smartTaskId: 'task-1', smartTaskRevision: '6' },
    };

    await expect(resolveKonlingTeachingAssistantServerModeContext({
      ...base,
      scope: scope({ classId: null, pageId: '/teacher/smart-prep' }),
    })).resolves.toEqual({});
    await expect(resolveKonlingTeachingAssistantServerModeContext({
      ...base,
      scope: scope({ role: 'student', authenticatedUserId: 'student-1', targetUserId: 'student-1', classId: null, pageId: '/teacher/smart-prep' }),
    })).resolves.toEqual({});
  });

  it('exposes a teacher-only bootstrap context before a smart task exists', async () => {
    const findMany = vi.fn(async () => [{
      id: 'basis-1', title: '自动控制原理',
      documents: [{ id: 'document-1', title: '教材', versions: [{ id: 'version-1', versionNumber: 2 }] }],
    }]);
    await expect(resolveKonlingTeachingAssistantServerModeContext({
      db: { courseBasis: { findMany } },
      modeId: 'prep-coauthor',
      scope: scope({ classId: null, pageId: '/teacher/smart-prep' }),
      clientContextHints: { smartPrepBootstrap: 'true' },
    })).resolves.toMatchObject({
      'prep-pack': true,
      'clarification-readiness': true,
      smartPreparation: {
        bootstrap: true,
        taskId: null,
        taskRevision: null,
        currentTask: { availableCourseBases: [{ id: 'basis-1', title: '自动控制原理' }] },
        clarificationReadiness: { status: 'clarification-required', canGenerate: false },
      },
    });
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { ownerId: 'teacher-1' },
      take: 20,
    }));
  });

  it('derives confirmed decisions and citation readiness from the persisted smart-task shape', async () => {
    const findFirst = async () => ({
      id: 'task-2',
      ownerId: 'teacher-1',
      revision: 3,
      topic: '频域稳定裕度',
      audience: '自动化专业本科生',
      durationMinutes: 45,
      scopeConfirmedAt: new Date('2026-07-19T03:10:00.000Z'),
      goalsConfirmedAt: new Date('2026-07-19T03:11:00.000Z'),
      sources: [{
        sourceVersionId: 'basis-version-3',
        sourceVersion: { reviewState: 'CONFIRMED', retiredAt: null },
      }],
      knowledgePoints: [{ id: 'kp-1', state: 'CONFIRMED', title: '稳定裕度' }],
      goals: [{ id: 'goal-1', state: 'CONFIRMED', content: '解释稳定裕度' }],
    });

    const context = await resolveKonlingTeachingAssistantServerModeContext({
      db: { smartLessonTask: { findFirst } },
      modeId: 'prep-coauthor',
      scope: scope({ classId: null, pageId: '/teacher/smart-prep' }),
      clientContextHints: { smartTaskId: 'task-2', smartTaskRevision: '3' },
    });

    expect(context.smartPreparation).toMatchObject({
      taskId: 'task-2',
      taskRevision: '3',
      selectedCourseBasisVersions: [{
        versionId: 'basis-version-3',
        citationState: 'verified',
        reviewState: 'CONFIRMED',
      }],
      unresolvedAmbiguities: [],
      citationState: 'verified',
      reviewState: 'confirmed',
      clarificationReadiness: { status: 'ready', canGenerate: true },
    });
    expect(context.smartPreparation?.confirmedDecisions).toEqual(expect.arrayContaining([
      expect.objectContaining({ field: 'scope', confirmedBy: 'teacher-1' }),
      expect.objectContaining({ field: 'goals', value: ['goal-1'] }),
    ]));
  });

  it('resolves class summarizer mode from governed diagnosis report snapshots without a token', async () => {
    const findManyCalls: Array<{ where: Record<string, unknown> }> = [];
    const db = {
      class: {
        findUnique: async () => ({ teacherId: 'teacher-1' }),
      },
      diagnosisReportSnapshot: {
        findMany: async ({ where }: { where: Record<string, unknown> }) => {
          findManyCalls.push({ where });
          return where.goalId === 'control-correction' &&
            where.subjectKind === 'class' &&
            where.classId === 'class-1' &&
            where.materializerVersion === 'control-correction-diagnosis-profile.v1'
            ? [{
              id: 'diagnosis-report:control-correction:class:class-1:2026-06-05T00:00:00.000Z',
              goalId: 'control-correction',
              classId: 'class-1',
            }]
            : [];
        },
      },
    };

    await expect(resolveKonlingTeachingAssistantServerModeContext({
      db,
      modeId: 'class-summarizer',
      scope: scope({ classId: 'class-1', targetUserId: 'teacher-1' }),
      runtimeContext,
      clientContextHints: {
        classReportId: 'class-1:control-correction',
        goalId: 'control-correction',
      },
    })).resolves.toEqual({
      'class-report': true,
      'diagnosis-view': true,
    });
    expect(findManyCalls.at(-1)?.where).toEqual(expect.objectContaining({
      materializerVersion: 'control-correction-diagnosis-profile.v1',
    }));

    await expect(resolveKonlingTeachingAssistantServerModeContext({
      db,
      modeId: 'class-summarizer',
      scope: scope({ authenticatedUserId: 'teacher-2', targetUserId: 'teacher-2', classId: 'class-1' }),
      runtimeContext,
      clientContextHints: {
        classReportId: 'class-1:control-correction',
        goalId: 'control-correction',
      },
    })).resolves.toEqual({});
  });

  it('requires a server-readable teaching resource before enabling resource coach context', async () => {
    const db = {
      teachingResource: {
        findUnique: async () => ({ id: 'resource-1', teacherOnly: false, type: 'STATIC_MEDIA' }),
      },
    };

    await expect(resolveKonlingTeachingAssistantServerModeContext({
      db,
      modeId: 'resource-coach',
      scope: scope({ role: 'student', resourceId: 'resource-1' }),
      runtimeContext,
      clientContextHints: {
        resourceId: 'forged-resource',
      },
    })).resolves.toEqual({ 'resource-node': true, 'media-resource': true });

    await expect(resolveKonlingTeachingAssistantServerModeContext({
      db: {
        teachingResource: {
          findUnique: async () => ({ id: 'resource-2', teacherOnly: false, type: 'STATIC_TEXT' }),
        },
      },
      modeId: 'resource-coach',
      scope: scope({ role: 'student', resourceId: 'resource-2' }),
      runtimeContext,
      clientContextHints: {
        resourceId: 'video-looking-client-hint',
      },
    })).resolves.toEqual({ 'resource-node': true });

    await expect(resolveKonlingTeachingAssistantServerModeContext({
      db: {
        teachingResource: {
          findUnique: async () => null,
        },
      },
      modeId: 'resource-coach',
      scope: scope({ role: 'student', resourceId: 'forged-resource' }),
      runtimeContext,
      clientContextHints: {
        resourceId: 'forged-resource',
      },
    })).resolves.toEqual({});

    await expect(resolveKonlingTeachingAssistantServerModeContext({
      db: {
        teachingResource: {
          findUnique: async () => ({ id: 'teacher-resource', teacherOnly: true, type: 'STATIC_MEDIA' }),
        },
      },
      modeId: 'resource-coach',
      scope: scope({ role: 'student', resourceId: 'teacher-resource' }),
      runtimeContext,
      clientContextHints: {
        resourceId: 'teacher-resource',
      },
    })).resolves.toEqual({});
  });
});

function restoreEnv(
  name: 'KONLING_MODE_CONTEXT_SECRET' | 'KONLING_SERVER_MODE_CONTEXT_SECRET' | 'NEXTAUTH_SECRET' | 'AUTH_SECRET',
  value: string | undefined,
) {
  if (value === undefined) {
    delete process.env[name];
    return;
  }
  process.env[name] = value;
}

function createLegacyModeContextToken(payload: Record<string, unknown>) {
  const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  return `${encoded}.${createHmac('sha256', TEST_SECRET).update(encoded).digest('base64url')}`;
}
