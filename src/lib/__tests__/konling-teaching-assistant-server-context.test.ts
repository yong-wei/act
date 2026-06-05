import { afterEach, beforeEach, describe, expect, it } from 'vitest';

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
  let originalNextAuthSecret: string | undefined;
  let originalAuthSecret: string | undefined;

  beforeEach(() => {
    originalContextSecret = process.env.KONLING_MODE_CONTEXT_SECRET;
    originalNextAuthSecret = process.env.NEXTAUTH_SECRET;
    originalAuthSecret = process.env.AUTH_SECRET;
    process.env.KONLING_MODE_CONTEXT_SECRET = TEST_SECRET;
    delete process.env.NEXTAUTH_SECRET;
    delete process.env.AUTH_SECRET;
  });

  afterEach(() => {
    restoreEnv('KONLING_MODE_CONTEXT_SECRET', originalContextSecret);
    restoreEnv('NEXTAUTH_SECRET', originalNextAuthSecret);
    restoreEnv('AUTH_SECRET', originalAuthSecret);
  });

  it('accepts signed class summarizer context tokens as server-owned context', async () => {
    const modeContextToken = createKonlingTeachingAssistantServerContextToken({
      mode: 'class-summarizer',
      classId: 'class-1',
      courseId: 'course-1',
      pageId: 'teacher-report',
      context: {
        'class-report': true,
        'diagnosis-view': true,
        'learner-state-summary': true,
      },
    });

    const context = await resolveKonlingTeachingAssistantServerModeContext({
      db: {},
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

function restoreEnv(name: 'KONLING_MODE_CONTEXT_SECRET' | 'NEXTAUTH_SECRET' | 'AUTH_SECRET', value: string | undefined) {
  if (value === undefined) {
    delete process.env[name];
    return;
  }
  process.env[name] = value;
}
