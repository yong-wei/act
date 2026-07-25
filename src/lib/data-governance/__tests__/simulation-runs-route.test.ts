import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  getServerSession: vi.fn(),
  persistControlWorkbenchSimulationRun: vi.fn(),
  persistSceneTraceSimulationRun: vi.fn(),
  computeControlAnalysisServer: vi.fn(),
  classSessionFindUnique: vi.fn(),
  studentProfileFindUnique: vi.fn(),
  resolveTrustedControlWorkbenchContext: vi.fn(),
}));

vi.mock('next-auth', () => ({
  getServerSession: mocks.getServerSession,
}));

vi.mock('@/lib/auth', () => ({
  authOptions: {},
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    classSession: { findUnique: mocks.classSessionFindUnique },
    studentProfile: { findUnique: mocks.studentProfileFindUnique },
  },
}));

vi.mock('@/lib/data-governance/simulation-scene-run-persistence', () => ({
  persistControlWorkbenchSimulationRun: mocks.persistControlWorkbenchSimulationRun,
  persistSceneTraceSimulationRun: mocks.persistSceneTraceSimulationRun,
}));

vi.mock('@/lib/data-governance/control-workbench-run-context', () => ({
  resolveTrustedControlWorkbenchContext: mocks.resolveTrustedControlWorkbenchContext,
}));

vi.mock('@/resources/control-system/analysis/control-engine-server-runtime', () => ({
  computeControlAnalysisServer: mocks.computeControlAnalysisServer,
}));

vi.mock('@/resources/simulations/lib/monte-carlo-optimizer', () => ({
  DEFAULT_TARGET: {},
  evaluatePIDParams: vi.fn(),
}));

vi.mock('@/resources/simulations/simulations/cruise/telemetry-bridge', () => ({
  validateCruiseTelemetryBridgeSummary: vi.fn(() => true),
}));

vi.mock('@/lib/nextjs-dynamic-error', () => ({
  rethrowIfNextDynamicError: vi.fn(),
}));

import { POST } from '@/app/api/simulation/runs/route';

function request(body: unknown) {
  return new NextRequest('http://localhost/api/simulation/runs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/simulation/runs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getServerSession.mockResolvedValue({
      user: { id: 'student-1', role: 'STUDENT' },
    });
    mocks.persistControlWorkbenchSimulationRun.mockResolvedValue({
      simulationRunId: 'run-1',
    });
    mocks.persistSceneTraceSimulationRun.mockResolvedValue({
      simulationRunId: 'scene-run-1',
    });
    mocks.classSessionFindUnique.mockResolvedValue({
      id: 'cmoxloe52000uq5bcojma7r78',
      classId: 'class-1',
      teacherId: 'teacher-1',
    });
    mocks.studentProfileFindUnique.mockResolvedValue({ classId: 'class-1' });
    mocks.resolveTrustedControlWorkbenchContext.mockResolvedValue({
      sessionId: 'cmoxloe52000uq5bcojma7r78',
      classId: 'class-1',
      lessonPlanId: 'plan-1',
      manifestHash: 'manifest-hash-1',
      lessonId: '1-4',
      stepId: 'step-1',
      moduleId: 'module-1',
      capabilityId: 'control-linked-comparison',
      registryId: 'classroom-objective',
    });
  });

  it('persists a valid control workbench request under the authenticated student', async () => {
    const response = await POST(request({
      kind: 'control-workbench',
      clientRunId: 'step-1:module-1:1',
      capabilityId: 'control-linked-comparison',
      request: {
        runtimeMode: 'analysis',
        plant: { numerator: [1], denominator: [1, 1] },
        structures: [],
        outputs: ['step_response'],
        timeRange: { start: 0, end: 10, samples: 10 },
        frequencyRange: { min: 0.1, max: 10, samples: 10 },
        rootLocus: { minGain: 0, maxGain: 10, samples: 10, currentGain: 1 },
      },
      launchContext: {
        sessionId: 'cmoxloe52000uq5bcojma7r78',
        stepId: 'step-1',
        moduleId: 'module-1',
        lessonId: 'forged-lesson',
        ignored: 'untrusted',
      },
    }));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ simulationRunId: 'run-1' });
    expect(mocks.persistControlWorkbenchSimulationRun).toHaveBeenCalledWith(
      expect.anything(),
      'student-1',
      expect.objectContaining({
        launchContext: {
          sessionId: 'cmoxloe52000uq5bcojma7r78',
          classId: 'class-1',
          lessonPlanId: 'plan-1',
          manifestHash: 'manifest-hash-1',
          lessonId: '1-4',
          stepId: 'step-1',
          moduleId: 'module-1',
          capabilityId: 'control-linked-comparison',
          registryId: 'classroom-objective',
        },
      }),
      mocks.computeControlAnalysisServer,
    );
  });

  it('rejects a control workbench run when the server cannot resolve its classroom task', async () => {
    mocks.resolveTrustedControlWorkbenchContext.mockResolvedValue(null);
    const response = await POST(request({
      kind: 'control-workbench',
      clientRunId: 'step-1:module-1:1',
      capabilityId: 'control-linked-comparison',
      request: {
        runtimeMode: 'analysis',
        plant: { numerator: [1], denominator: [1, 1] },
        structures: [],
        outputs: ['step_response'],
        timeRange: { start: 0, end: 10, samples: 10 },
        frequencyRange: { min: 0.1, max: 10, samples: 10 },
        rootLocus: { minGain: 0, maxGain: 10, samples: 10, currentGain: 1 },
      },
      launchContext: {
        sessionId: 'cmoxloe52000uq5bcojma7r78',
        lessonId: 'forged-lesson',
        stepId: 'step-1',
        moduleId: 'module-1',
      },
    }));

    expect(response.status).toBe(403);
    expect(mocks.persistControlWorkbenchSimulationRun).not.toHaveBeenCalled();
  });

  it('rejects non-student writers', async () => {
    mocks.getServerSession.mockResolvedValue({
      user: { id: 'teacher-1', role: 'TEACHER' },
    });
    const response = await POST(request({ kind: 'control-workbench' }));
    expect(response.status).toBe(403);
    expect(mocks.persistControlWorkbenchSimulationRun).not.toHaveBeenCalled();
  });

  it('binds a server-evaluated Cruise run to the authenticated classroom context', async () => {
    const response = await POST(request({
      kind: 'scene-trace',
      traceSummary: {
        trace: {
          envelope: {
            sceneId: 'sim/cruise',
            runId: 'cruise-run-1',
            checksum: 'browser-fnv1a32:00000000',
            seed: 42,
            startedAt: '2026-07-25T01:00:00.000Z',
            completedAt: '2026-07-25T01:10:00.000Z',
            sampleCadence: 0.5,
          },
          samples: { frameCount: 1200 },
          summary: {
            passed: true,
            metrics: {
              controller_kp: 0.6,
              controller_ki: 0.008,
              controller_kd: 1.5,
            },
          },
        },
      },
      launchContext: {
        sessionId: 'cmoxloe52000uq5bcojma7r78',
        lessonId: 'lesson-1',
      },
    }));

    expect(response.status).toBe(200);
    expect(mocks.persistSceneTraceSimulationRun).toHaveBeenCalledWith(
      expect.anything(),
      'student-1',
      expect.objectContaining({
        launchContext: {
          sessionId: 'cmoxloe52000uq5bcojma7r78',
          classId: 'class-1',
          lessonId: 'lesson-1',
          registryId: 'sim-scene-cruise',
        },
      }),
      expect.any(Function),
    );
  });

  it('rejects scene traces outside the server allowlist', async () => {
    const response = await POST(request({
      kind: 'scene-trace',
      traceSummary: {
        trace: {
          envelope: {
            sceneId: 'sim/forged',
          },
        },
      },
    }));
    expect(response.status).toBe(400);
    expect(mocks.persistSceneTraceSimulationRun).not.toHaveBeenCalled();
  });
});
