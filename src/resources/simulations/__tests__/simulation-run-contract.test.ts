import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  authorizeSimulationRunAccess,
  buildSimulationTaskSpec,
  buildSimulationTraceRecord,
  validateSimulationRunEnvelope,
  type SimulationRunEnvelopeV1,
} from '../core/run-contract';

const repoRoot = process.cwd();

function buildRun(overrides: Partial<SimulationRunEnvelopeV1> = {}): SimulationRunEnvelopeV1 {
  return {
    id: 'run-course-1',
    ownerUserId: 'student-1',
    classId: 'class-1',
    courseId: 'control-principles',
    resourceId: 'resource-step-response',
    runKind: 'scene_simulation',
    sourceDomain: 'simulation_scene',
    sourceRefId: 'sim-run-source-1',
    taskSpec: buildSimulationTaskSpec({
      sceneId: 'sim/cruise',
      scenarioId: 'step-response',
      objectives: ['settling_time'],
      constraints: ['rudder_rate'],
      disturbancePolicy: { family: 'none' },
      evaluationSpecRef: { id: 'eval/cruise-preview', visibility: 'preview' },
      allowedControllers: ['pid'],
      launchContext: {
        courseId: 'control-principles',
        classId: 'class-1',
        resourceId: 'resource-step-response',
      },
    }),
    controllerSnapshotRef: 'controller:pid:hash-1',
    status: 'completed',
    summary: { settlingTime: 4.2, overshoot: 0.08 },
    replayToken: 'replay-token-1',
    seed: 42,
    protocolVersion: '1.0',
    runtimeVersion: 'simulation-runtime-v1',
    modelVersion: 'nomoto-v1',
    sceneSpecVersion: 'scene-spec-v1',
    createdAt: '2026-05-28T00:00:00.000Z',
    startedAt: '2026-05-28T00:00:01.000Z',
    completedAt: '2026-05-28T00:00:08.000Z',
    ...overrides,
  };
}

describe('SimulationTaskSpec', () => {
  it('attaches launch context outside the scene description and computes a stable spec hash', () => {
    const first = buildSimulationTaskSpec({
      sceneId: 'sim/cruise',
      scenarioId: 'step-response',
      objectives: ['settling_time', 'overshoot'],
      constraints: ['rudder_rate'],
      disturbancePolicy: { family: 'waves', seedPolicy: 'required' },
      evaluationSpecRef: { id: 'eval/cruise-preview', visibility: 'preview' },
      allowedControllers: ['pid', 'lead-lag'],
      launchContext: {
        courseId: 'control-principles',
        classId: 'class-1',
        lessonId: '2-2',
        resourceId: 'resource-step-response',
        publicationId: 'pub-1',
      },
    });
    const second = buildSimulationTaskSpec({
      sceneId: 'sim/cruise',
      scenarioId: 'step-response',
      objectives: ['settling_time', 'overshoot'],
      constraints: ['rudder_rate'],
      disturbancePolicy: { seedPolicy: 'required', family: 'waves' },
      evaluationSpecRef: { visibility: 'preview', id: 'eval/cruise-preview' },
      allowedControllers: ['pid', 'lead-lag'],
      launchContext: {
        publicationId: 'pub-1',
        resourceId: 'resource-step-response',
        lessonId: '2-2',
        classId: 'class-1',
        courseId: 'control-principles',
      },
    });

    expect(first.specHash).toMatch(/^sha256:/);
    expect(second.specHash).toBe(first.specHash);
    expect(first.sceneId).toBe('sim/cruise');
    expect(first.launchContext).toEqual(expect.objectContaining({
      classId: 'class-1',
      resourceId: 'resource-step-response',
    }));
  });
});

describe('SimulationRun envelope and access', () => {
  it('validates run kinds, source references, owner scope, and statuses', () => {
    expect(validateSimulationRunEnvelope(buildRun()).ok).toBe(true);
    expect(validateSimulationRunEnvelope(buildRun({
      runKind: 'arena_preview',
      sourceDomain: 'arena_virtual_preview',
      sourceRefId: 'arena-preview-row-1',
    })).ok).toBe(true);
    expect(validateSimulationRunEnvelope(buildRun({
      ownerUserId: null,
      runKind: 'teacher_batch',
      sourceDomain: 'teacher_batch',
      sourceRefId: 'teacher-batch-1',
    })).ok).toBe(true);
    expect(validateSimulationRunEnvelope(buildRun({
      ownerUserId: null,
      runKind: 'scene_simulation',
    })).issues).toContain('ownerUserId is required for user-owned run kinds');
    expect(validateSimulationRunEnvelope(buildRun({
      sourceRefId: '',
    })).issues).toContain('sourceRefId is required');
  });

  it('enforces student owner reads, teacher class summary reads, and redacted admin reads', () => {
    const run = buildRun();

    expect(authorizeSimulationRunAccess({
      requester: { userId: 'student-1', role: 'STUDENT' },
      run,
    })).toEqual(expect.objectContaining({
      allowed: true,
      scope: 'owner',
      rawTraceAllowed: true,
    }));

    expect(authorizeSimulationRunAccess({
      requester: { userId: 'student-2', role: 'STUDENT' },
      run,
    })).toEqual(expect.objectContaining({
      allowed: false,
      scope: 'none',
      rawTraceAllowed: false,
    }));

    expect(authorizeSimulationRunAccess({
      requester: { userId: 'teacher-1', role: 'TEACHER', classIds: ['class-1'] },
      run,
    })).toEqual(expect.objectContaining({
      allowed: true,
      scope: 'class-summary',
      rawTraceAllowed: false,
    }));

    expect(authorizeSimulationRunAccess({
      requester: { userId: 'admin-1', role: 'ADMIN' },
      run,
    })).toEqual(expect.objectContaining({
      allowed: true,
      scope: 'audit-summary',
      rawTraceAllowed: false,
    }));
  });
});

describe('SimulationTrace persistence contract', () => {
  it('keeps high-frequency samples behind a storage reference and stores compact summary metadata', () => {
    const trace = buildSimulationTraceRecord({
      id: 'trace-1',
      runId: 'run-course-1',
      protocolVersion: '1.0',
      runtimeVersion: 'simulation-runtime-v1',
      modelVersion: 'nomoto-v1',
      seed: 42,
      checksum: 'sha256:trace-1',
      summaryMetrics: { settlingTime: 4.2, overshoot: 0.08 },
      sampleCount: 240,
      sampleCadence: 0.05,
      sampleStorageUri: 's3://simulation-traces/run-course-1.json',
      createdAt: '2026-05-28T00:00:08.000Z',
    });

    expect(trace.sampleStorageUri).toBe('s3://simulation-traces/run-course-1.json');
    expect(trace.summaryMetrics).toEqual({ settlingTime: 4.2, overshoot: 0.08 });
    expect(trace.sampleCount).toBe(240);
    expect(trace.checksum).toBe('sha256:trace-1');
  });
});

describe('SimulationRun Prisma contract', () => {
  it('declares canonical task, run, and trace tables with owner and source indexes', () => {
    const schema = readFileSync(join(repoRoot, 'prisma/schema.prisma'), 'utf8');

    expect(schema).toContain('model SimulationTaskSpec');
    expect(schema).toContain('model SimulationRun');
    expect(schema).toContain('model SimulationTrace');
    expect(schema).toContain('simulationRunId');
    expect(schema).toContain('ownerUserId');
    expect(schema).toContain('runKind');
    expect(schema).toContain('sourceDomain');
    expect(schema).toContain('sourceRefId');
    expect(schema).toContain('sampleStorageUri');
    expect(schema).toContain('@@index([ownerUserId, createdAt])');
    expect(schema).toContain('@@unique([sourceDomain, sourceRefId])');
  });
});
