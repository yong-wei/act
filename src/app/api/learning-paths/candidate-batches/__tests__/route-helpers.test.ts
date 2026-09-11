import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    class: { findUnique: vi.fn() },
    studentProfile: { findUnique: vi.fn() },
    learningPath: { findFirst: vi.fn() },
  },
}));

import {
  sanitizeCandidateBatchForStudentResponse,
  type VersionedAdaptivePathCandidateBatch,
} from '../route-helpers';

function batchFixture(): VersionedAdaptivePathCandidateBatch {
  return {
    id: 'batch-1',
    userId: 'student-1',
    classId: null,
    goalId: 'control-correction',
    generationRequestId: 'request-1',
    sourcePathId: 'path-1',
    plannerVersion: 'v1',
    status: 'succeeded',
    createdAt: '2026-08-03T00:00:00.000Z',
    sourcePathVersion: '2026-08-03T00:00:00.000Z',
    metadata: {
      runtimeResourceBindings: [{
        nodeId: 'knowledge-card:Bode图_1_1',
        resourceId: 'act:card:Bode图_1_1',
        resourceType: 'card',
        state: 'bound',
        objectKey: 'blob:aa11',
        contentSha256: 'a'.repeat(64),
        runtimeReleaseId: 'runtime-release-1',
        projectionId: 'proj-1',
        reason: null,
        candidateStyleIds: ['foundation-remediation'],
      }],
      runtimeBindingLimitationCodes: [],
    },
    candidates: [{
      id: 'candidate-1',
      fingerprint: 'fp-1',
      ordinal: 0,
      styleId: 'foundation-remediation',
      policyFamily: 'foundation-remediation',
      label: '稳步掌握',
      snapshot: {
        styleId: 'foundation-remediation',
        planNodes: [
          {
            nodeId: 'knowledge-card:Bode图_1_1',
            title: 'Bode图',
            target: '/knowledge?node=Bode%E5%9B%BE_1_1',
            runtimeResourceBinding: {
              nodeId: 'knowledge-card:Bode图_1_1',
              resourceId: 'act:card:Bode图_1_1',
              resourceType: 'card',
              state: 'bound',
              objectKey: 'blob:aa11',
              contentSha256: 'a'.repeat(64),
              runtimeReleaseId: 'runtime-release-1',
              projectionId: 'proj-1',
              reason: null,
            },
          },
        ],
      },
    }],
  } as unknown as VersionedAdaptivePathCandidateBatch;
}

describe('sanitizeCandidateBatchForStudentResponse (#2055 student surface)', () => {
  it('strips raw runtime bindings from metadata and candidate snapshots but keeps the safe projection', () => {
    const sanitized = sanitizeCandidateBatchForStudentResponse(batchFixture());

    // metadata：内部字段（含对象键原文）整体剥离。
    expect((sanitized.metadata as Record<string, unknown>).runtimeResourceBindings).toBeUndefined();
    // 候选快照 planNodes：runtimeResourceBinding（对象键/校验值）剥除，其余字段保留。
    const snapshot = sanitized.candidates[0].snapshot as {
      planNodes: Array<{ nodeId: string; target: string; runtimeResourceBinding?: unknown }>;
    };
    expect(snapshot.planNodes[0].nodeId).toBe('knowledge-card:Bode图_1_1');
    expect(snapshot.planNodes[0].target).toBe('/knowledge?node=Bode%E5%9B%BE_1_1');
    expect(snapshot.planNodes[0].runtimeResourceBinding).toBeUndefined();
    // 学生安全投影：绑定状态可见、对象键不可见。
    const comparison = sanitized.comparison;
    expect(comparison.runtimeBindings).toEqual([expect.objectContaining({
      styleId: 'foundation-remediation',
      boundResources: 1,
      items: [expect.objectContaining({ nodeId: 'knowledge-card:Bode图_1_1', state: 'bound' })],
    })]);
    const serialized = JSON.stringify({ metadata: sanitized.metadata, snapshot, comparison });
    expect(serialized).not.toContain('blob:aa11');
    expect(serialized).not.toContain('a'.repeat(64));
  });

  it('presents student-readable notes for unbound resources', () => {
    const batch = batchFixture();
    batch.metadata = {
      runtimeResourceBindings: [
        {
          nodeId: 'runtime-media:1-1:1-1-course',
          resourceId: null,
          resourceType: null,
          state: 'no-runtime-identity',
          objectKey: null,
          contentSha256: null,
          runtimeReleaseId: 'runtime-release-1',
          projectionId: 'proj-1',
          reason: 'unmapped-node-id',
          candidateStyleIds: ['foundation-remediation'],
        },
        {
          nodeId: 'runtime-media:1-1:1-1-intro-video',
          resourceId: 'act:video:1-1',
          resourceType: 'video',
          state: 'not-in-active-release',
          objectKey: null,
          contentSha256: null,
          runtimeReleaseId: 'runtime-release-1',
          projectionId: 'proj-1',
          reason: 'content-key-not-in-release',
          candidateStyleIds: ['foundation-remediation'],
        },
      ],
    };
    const sanitized = sanitizeCandidateBatchForStudentResponse(batch);
    expect(sanitized.comparison.runtimeBindings[0]).toMatchObject({
      styleId: 'foundation-remediation',
      boundResources: 0,
      unboundResources: 2,
    });
    expect(sanitized.comparison.runtimeBindings[0].notes).toEqual([
      '这条路径有 1 个资源暂无 Runtime 资源身份，无法绑定课程资源库发布。',
      '这条路径有 1 个资源未包含在当前课程资源发布中。',
    ]);
  });

  it('hides persisted candidates when hard diversity failed', () => {
    const batch = batchFixture();
    batch.metadata = {
      ...batch.metadata,
      diversityLimitations: ['insufficient-candidate-diversity'],
    };
    const sanitized = sanitizeCandidateBatchForStudentResponse(batch);
    expect(sanitized.candidates).toEqual([]);
    expect(sanitized.comparison.insufficientCandidateDiversity).toBe(true);
  });
});
