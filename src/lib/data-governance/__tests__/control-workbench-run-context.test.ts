import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  classSessionFindUnique: vi.fn(),
  studentProfileFindUnique: vi.fn(),
  loadRuntimeLessonManifestSnapshot: vi.fn(),
  getRegisteredResourceMetadata: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    classSession: { findUnique: mocks.classSessionFindUnique },
    studentProfile: { findUnique: mocks.studentProfileFindUnique },
  },
}));

vi.mock('@/lib/session-lesson-snapshot', () => ({
  loadRuntimeLessonManifestSnapshot: mocks.loadRuntimeLessonManifestSnapshot,
}));

vi.mock('@/lib/resource-registry-metadata', () => ({
  getRegisteredResourceMetadata: mocks.getRegisteredResourceMetadata,
}));

vi.mock('@/features/teacher/preset-lessons', () => ({
  ALL_PRESETS: [{
    key: 'unit-1-4-time-frequency-views-v1',
    items: [
      { runtimeStepId: 'step-01', registryId: 'classroom-objective' },
      { runtimeStepId: 'step-02', registryId: 'classroom-objective' },
    ],
  }],
}));

import {
  persistedControlWorkbenchRunMatchesContext,
  resolveTrustedControlWorkbenchContext,
} from '../control-workbench-run-context';

const trustedContext = {
  sessionId: 'session-1',
  classId: 'class-1',
  lessonPlanId: 'plan-1',
  manifestHash: 'manifest-hash-1',
  lessonId: '1-4',
  stepId: 'step-01',
  moduleId: 'workbench-1',
  capabilityId: 'control-linked-comparison',
  registryId: 'classroom-objective',
};

describe('trusted control workbench run context', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.classSessionFindUnique.mockResolvedValue({
      id: 'session-1',
      classId: 'class-1',
      teacherId: 'teacher-1',
      status: 'ACTIVE',
      manifestHash: 'manifest-hash-1',
      plan: {
        id: 'plan-1',
        items: [
          {
            overrideConfig: {
              __presetRuntimeBinding: {
                schemaVersion: 'preset-runtime-step-binding-v1',
                sourcePresetKey: 'unit-1-4-time-frequency-views-v1',
                runtimeLessonId: '1-4',
                runtimeStepId: 'step-02',
              },
            },
            resource: {
              registryId: 'classroom-objective',
              teacherOnly: false,
            },
          },
          {
            overrideConfig: {
              __presetRuntimeBinding: {
                schemaVersion: 'preset-runtime-step-binding-v1',
                sourcePresetKey: 'unit-1-4-time-frequency-views-v1',
                runtimeLessonId: '1-4',
                runtimeStepId: 'step-01',
              },
            },
            resource: {
              registryId: 'classroom-objective',
              teacherOnly: false,
            },
          },
        ],
      },
    });
    mocks.studentProfileFindUnique.mockResolvedValue({ classId: 'class-1' });
    mocks.loadRuntimeLessonManifestSnapshot.mockReturnValue({
      manifest: {
        lesson_id: '1-4',
        steps: {
          'step-01': {
            modules: [{
              id: 'workbench-1',
              payload: { capabilityRef: 'control-linked-comparison' },
            }],
          },
        },
      },
      snapshot: {
        lessonVersion: '2.0',
        manifestHash: 'manifest-hash-1',
        totalSteps: 1,
      },
    });
    mocks.getRegisteredResourceMetadata.mockReturnValue({
      id: 'classroom-objective',
    });
  });

  it('derives trusted context without relying on mutable titles or stage-local item order', async () => {
    await expect(resolveTrustedControlWorkbenchContext({
      user: { id: 'student-1', role: 'STUDENT' },
      sessionId: 'session-1',
      lessonId: '1-4',
      stepId: 'step-01',
      moduleId: 'workbench-1',
      capabilityId: 'control-linked-comparison',
    })).resolves.toEqual(trustedContext);
  });

  it('resolves canonical runtime ids and preset lesson keys to the same trusted context', async () => {
    await expect(resolveTrustedControlWorkbenchContext({
      user: { id: 'student-1', role: 'STUDENT' },
      sessionId: 'session-1',
      lessonId: 'unit-1-4-time-frequency-views-v1',
      stepId: 'step-01',
      moduleId: 'workbench-1',
      capabilityId: 'control-linked-comparison',
    })).resolves.toEqual(trustedContext);

    expect(mocks.loadRuntimeLessonManifestSnapshot).toHaveBeenCalledWith('1-4');
  });

  it('fails closed for an unknown lesson identity', async () => {
    await expect(resolveTrustedControlWorkbenchContext({
      user: { id: 'student-1', role: 'STUDENT' },
      sessionId: 'session-1',
      lessonId: 'unknown-runtime-lesson',
      stepId: 'step-01',
      moduleId: 'workbench-1',
      capabilityId: 'control-linked-comparison',
    })).resolves.toBeNull();
    expect(mocks.loadRuntimeLessonManifestSnapshot).not.toHaveBeenCalled();
  });

  it('rejects a student outside the session class and a forged capability', async () => {
    mocks.studentProfileFindUnique.mockResolvedValue({ classId: 'class-2' });
    await expect(resolveTrustedControlWorkbenchContext({
      user: { id: 'student-1', role: 'STUDENT' },
      sessionId: 'session-1',
      lessonId: '1-4',
      stepId: 'step-01',
      moduleId: 'workbench-1',
      capabilityId: 'control-linked-comparison',
    })).resolves.toBeNull();

    mocks.studentProfileFindUnique.mockResolvedValue({ classId: 'class-1' });
    await expect(resolveTrustedControlWorkbenchContext({
      user: { id: 'student-1', role: 'STUDENT' },
      sessionId: 'session-1',
      lessonId: '1-4',
      stepId: 'step-01',
      moduleId: 'workbench-1',
      capabilityId: 'forged-capability',
    })).resolves.toBeNull();
  });

  it('accepts an ACTIVE classless temporary session through classroom access policy', async () => {
    const classSession = await mocks.classSessionFindUnique();
    mocks.classSessionFindUnique.mockResolvedValue({
      ...classSession,
      classId: null,
    });
    mocks.studentProfileFindUnique.mockResolvedValue({ classId: null });
    const { classId: _classId, ...classlessTrustedContext } = trustedContext;

    await expect(resolveTrustedControlWorkbenchContext({
      user: { id: 'student-1', role: 'STUDENT' },
      sessionId: 'session-1',
      lessonId: '1-4',
      stepId: 'step-01',
      moduleId: 'workbench-1',
      capabilityId: 'control-linked-comparison',
    })).resolves.toEqual(classlessTrustedContext);
  });

  it('permits delayed materialization for a FINISHED classless temporary session', async () => {
    const classSession = await mocks.classSessionFindUnique();
    mocks.classSessionFindUnique.mockResolvedValue({
      ...classSession,
      classId: null,
      status: 'FINISHED',
    });
    mocks.studentProfileFindUnique.mockResolvedValue({ classId: null });
    const { classId: _classId, ...classlessTrustedContext } = trustedContext;
    const input = {
      user: { id: 'student-1', role: 'STUDENT' },
      sessionId: 'session-1',
      lessonId: '1-4',
      stepId: 'step-01',
      moduleId: 'workbench-1',
      capabilityId: 'control-linked-comparison',
    };

    await expect(resolveTrustedControlWorkbenchContext(input)).resolves.toBeNull();
    await expect(resolveTrustedControlWorkbenchContext({
      ...input,
      requireActive: false,
    })).resolves.toEqual(classlessTrustedContext);
  });

  it('requires a persisted run to match the trusted event context', () => {
    const matchingRun = {
      sessionId: 'session-1',
      resourceId: 'classroom-objective',
      taskSpecSnapshot: {
        scenarioId: 'control-linked-comparison',
        objectives: ['control-linked-comparison'],
        launchContext: {
          lessonPlanId: 'plan-1',
          manifestHash: 'manifest-hash-1',
          lessonId: '1-4',
          stepId: 'step-01',
          moduleId: 'workbench-1',
          registryId: 'classroom-objective',
        },
      },
    };
    expect(persistedControlWorkbenchRunMatchesContext(matchingRun, trustedContext)).toBe(true);
    expect(persistedControlWorkbenchRunMatchesContext({
      ...matchingRun,
      sessionId: 'session-2',
    }, trustedContext)).toBe(false);
    for (const taskSpecSnapshot of [
      {
        ...matchingRun.taskSpecSnapshot,
        objectives: ['forged-capability'],
      },
      {
        ...matchingRun.taskSpecSnapshot,
        launchContext: {
          ...matchingRun.taskSpecSnapshot.launchContext,
          lessonPlanId: 'different-plan',
        },
      },
      {
        ...matchingRun.taskSpecSnapshot,
        launchContext: {
          ...matchingRun.taskSpecSnapshot.launchContext,
          manifestHash: 'different-manifest',
        },
      },
      {
        ...matchingRun.taskSpecSnapshot,
        launchContext: {
          ...matchingRun.taskSpecSnapshot.launchContext,
          registryId: 'classroom-assessment',
        },
      },
    ]) {
      expect(persistedControlWorkbenchRunMatchesContext({
        ...matchingRun,
        taskSpecSnapshot,
      }, trustedContext)).toBe(false);
    }
  });

  it('rejects a runtime manifest that does not match the session snapshot', async () => {
    mocks.loadRuntimeLessonManifestSnapshot.mockReturnValue({
      manifest: { lesson_id: '1-4', steps: {} },
      snapshot: {
        lessonVersion: '2.0',
        manifestHash: 'different-manifest-hash',
        totalSteps: 0,
      },
    });

    await expect(resolveTrustedControlWorkbenchContext({
      user: { id: 'student-1', role: 'STUDENT' },
      sessionId: 'session-1',
      lessonId: '1-4',
      stepId: 'step-01',
      moduleId: 'workbench-1',
      capabilityId: 'control-linked-comparison',
    })).resolves.toBeNull();
  });

  it('requires ACTIVE for new runs but permits FINISHED sessions during evidence materialization', async () => {
    mocks.classSessionFindUnique.mockResolvedValue({
      id: 'session-1',
      classId: 'class-1',
      teacherId: 'teacher-1',
      status: 'FINISHED',
      manifestHash: 'manifest-hash-1',
      plan: {
        id: 'plan-1',
        items: [{
          overrideConfig: {
            __presetRuntimeBinding: {
              schemaVersion: 'preset-runtime-step-binding-v1',
              sourcePresetKey: 'unit-1-4-time-frequency-views-v1',
              runtimeLessonId: '1-4',
              runtimeStepId: 'step-01',
            },
          },
          resource: {
            registryId: 'classroom-objective',
            teacherOnly: false,
          },
        }],
      },
    });
    const input = {
      user: { id: 'student-1', role: 'STUDENT' },
      sessionId: 'session-1',
      lessonId: '1-4',
      stepId: 'step-01',
      moduleId: 'workbench-1',
      capabilityId: 'control-linked-comparison',
    };

    await expect(resolveTrustedControlWorkbenchContext(input)).resolves.toBeNull();
    await expect(resolveTrustedControlWorkbenchContext({
      ...input,
      requireActive: false,
    })).resolves.toEqual(trustedContext);
  });

  it('rejects plan, registry, step, module, and capability mismatches', async () => {
    mocks.classSessionFindUnique.mockResolvedValueOnce({
      id: 'session-1',
      classId: 'class-1',
      teacherId: 'teacher-1',
      status: 'ACTIVE',
      manifestHash: 'manifest-hash-1',
      plan: {
        id: 'plan-1',
        items: [{
          overrideConfig: {
            __presetRuntimeBinding: {
              schemaVersion: 'preset-runtime-step-binding-v1',
              sourcePresetKey: 'unit-1-4-time-frequency-views-v1',
              runtimeLessonId: '1-4',
              runtimeStepId: 'step-01',
            },
          },
          resource: {
            registryId: 'classroom-assessment',
            teacherOnly: false,
          },
        }],
      },
    });
    await expect(resolveTrustedControlWorkbenchContext({
      user: { id: 'student-1', role: 'STUDENT' },
      sessionId: 'session-1',
      lessonId: '1-4',
      stepId: 'step-01',
      moduleId: 'workbench-1',
      capabilityId: 'control-linked-comparison',
    })).resolves.toBeNull();

    for (const mismatch of [
      { stepId: 'missing-step', moduleId: 'workbench-1', capabilityId: 'control-linked-comparison' },
      { stepId: 'step-01', moduleId: 'missing-module', capabilityId: 'control-linked-comparison' },
      { stepId: 'step-01', moduleId: 'workbench-1', capabilityId: 'wrong-capability' },
    ]) {
      await expect(resolveTrustedControlWorkbenchContext({
        user: { id: 'student-1', role: 'STUDENT' },
        sessionId: 'session-1',
        lessonId: '1-4',
        ...mismatch,
      })).resolves.toBeNull();
    }
  });

  it('rejects a deleted target step even when another item keeps the same registry', async () => {
    mocks.classSessionFindUnique.mockResolvedValue({
      id: 'session-1',
      classId: 'class-1',
      teacherId: 'teacher-1',
      status: 'ACTIVE',
      manifestHash: 'manifest-hash-1',
      plan: {
        id: 'plan-1',
        items: [{
          overrideConfig: {
            __presetRuntimeBinding: {
              schemaVersion: 'preset-runtime-step-binding-v1',
              sourcePresetKey: 'unit-1-4-time-frequency-views-v1',
              runtimeLessonId: '1-4',
              runtimeStepId: 'step-02',
            },
          },
          resource: {
            registryId: 'classroom-objective',
            teacherOnly: false,
          },
        }],
      },
    });

    await expect(resolveTrustedControlWorkbenchContext({
      user: { id: 'student-1', role: 'STUDENT' },
      sessionId: 'session-1',
      lessonId: '1-4',
      stepId: 'step-01',
      moduleId: 'workbench-1',
      capabilityId: 'control-linked-comparison',
    })).resolves.toBeNull();
  });

  it('fails closed for an existing lesson plan without runtime bindings', async () => {
    mocks.classSessionFindUnique.mockResolvedValue({
      id: 'session-1',
      classId: 'class-1',
      teacherId: 'teacher-1',
      status: 'ACTIVE',
      manifestHash: 'manifest-hash-1',
      plan: {
        id: 'plan-1',
        items: [{
          overrideConfig: {},
          resource: {
            registryId: 'classroom-objective',
            teacherOnly: false,
          },
        }],
      },
    });

    await expect(resolveTrustedControlWorkbenchContext({
      user: { id: 'student-1', role: 'STUDENT' },
      sessionId: 'session-1',
      lessonId: '1-4',
      stepId: 'step-01',
      moduleId: 'workbench-1',
      capabilityId: 'control-linked-comparison',
    })).resolves.toBeNull();
  });
});
