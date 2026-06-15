import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createHmac } from 'node:crypto';

import {
  createKonlingTeachingAssistantServerContextToken,
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
      context: {
        'student-path-center': true,
        'learner-state-summary': true,
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
      clientContextHints: { modeContextToken },
    })).resolves.toEqual({
      'student-path-center': true,
      'learner-state-summary': true,
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
        'student-path-center': true,
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
        findUnique: async () => ({ id: 'resource-1', teacherOnly: false }),
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
          findUnique: async () => ({ id: 'teacher-resource', teacherOnly: true }),
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
