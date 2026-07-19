import { beforeEach, describe, expect, it, vi } from 'vitest';

import { sourceBindingFixture, validPlanFixture } from '@/lib/smart-lesson-plan/__tests__/fixtures';

const mocks = vi.hoisted(() => ({
  buildSar: vi.fn(),
  buildSourcePack: vi.fn(),
  beginAttempt: vi.fn(),
  completeUnit: vi.fn(),
  failUnit: vi.fn(),
  generateModule: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({ prisma: {} }));
vi.mock('@/lib/course-basis/lesson-design-source-pack', () => ({
  buildCourseBasisLessonDesignSar: mocks.buildSar,
  buildCourseBasisLessonDesignSourcePack: mocks.buildSourcePack,
}));
vi.mock('../generation-service', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../generation-service')>();
  return {
    ...actual,
    beginCoursewareProviderAttempt: mocks.beginAttempt,
    completeCoursewareGenerationUnit: mocks.completeUnit,
    failCoursewareGenerationUnit: mocks.failUnit,
  };
});
vi.mock('../module-regeneration-service', () => ({
  generateCoursewareModuleCandidate: mocks.generateModule,
}));

import { createDeterministicCoursewareStage } from '../provider-runtime';
import { processCoursewareGenerationJob } from '../worker';

describe('smart courseware generation worker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('dispatches queued MODULE jobs to background candidate generation without INITIAL units', async () => {
    const context = {
      id: 'module-job-1', ownerId: 'teacher-1', draftId: 'draft-1', mode: 'MODULE',
      state: 'QUEUED', firstIncompleteUnitKey: null, units: [], draft: {},
    };
    const completed = { ...context, state: 'COMPLETED' };
    const db = { smartCoursewareGenerationJob: { findUnique: vi.fn().mockResolvedValue(context) } };
    mocks.generateModule.mockResolvedValue(completed);

    await expect(processCoursewareGenerationJob(db as never, context.id)).resolves.toBe(completed);
    expect(mocks.generateModule).toHaveBeenCalledWith(db, {
      actor: { id: context.ownerId, role: 'TEACHER' },
      jobId: context.id,
    });
    expect(mocks.beginAttempt).not.toHaveBeenCalled();
  });

  it('does not resolve or invoke a provider after the draft is ACCEPTED', async () => {
    const context = {
      id: 'accepted-worker-job', ownerId: 'teacher-1', draftId: 'accepted-draft', mode: 'INITIAL',
      state: 'QUEUED', firstIncompleteUnitKey: 'bridge-in', units: [], draft: { state: 'ACCEPTED' },
    };
    const db = { smartCoursewareGenerationJob: { findUnique: vi.fn().mockResolvedValue(context) } };
    const resolveProvider = vi.fn();

    await expect(processCoursewareGenerationJob(db as never, context.id, resolveProvider as never))
      .rejects.toMatchObject({ code: 'accepted-courseware-immutable' });
    expect(resolveProvider).not.toHaveBeenCalled();
    expect(mocks.generateModule).not.toHaveBeenCalled();
  });

  it('records the same-run server-authoritative Source Pack allowlist on the provider attempt', async () => {
    const plan = validPlanFixture();
    const context = {
      id: 'job-1', ownerId: 'teacher-1', draftId: 'draft-1', state: 'QUEUED', firstIncompleteUnitKey: 'bridge-in',
      deliveryGeneration: 1,
      draft: { id: 'draft-1', planRevision: { content: plan } },
      units: [{ id: 'unit-1', unitKey: 'bridge-in', state: 'PENDING', output: null, orderIndex: 0, attemptGeneration: 0 }],
    };
    const db = { smartCoursewareGenerationJob: { findUnique: vi.fn().mockResolvedValue(context) } };
    mocks.buildSar.mockResolvedValue({ selectedVersionIds: [sourceBindingFixture.sourceVersionId] });
    mocks.buildSourcePack.mockResolvedValue({
      retrieval: {
        pack: {
          items: [{
            citationTargetId: sourceBindingFixture.citationId,
            metadata: {
              versionId: sourceBindingFixture.sourceVersionId,
              stableAnchor: sourceBindingFixture.anchor,
              contentHash: sourceBindingFixture.contentHash,
            },
          }],
        },
      },
    });
    mocks.beginAttempt.mockResolvedValue({
      claimed: true, claimToken: 'claim-1', attempt: { id: 'attempt-1', idempotencyKey: 'attempt-key-1' },
    });
    mocks.completeUnit.mockResolvedValue({ state: 'COMPLETED' });
    const output = createDeterministicCoursewareStage({
      unitKey: 'bridge-in', durationSeconds: 300, sourceBinding: sourceBindingFixture,
    });
    const runtime = {
      serviceId: 'fixture-service', providerKind: 'fixture', model: 'fixture-model',
      generate: vi.fn().mockResolvedValue({
        output, normalizedResponseId: 'fixture-response', inputTokens: 0, outputTokens: 0, costMicros: null,
      }),
    };

    await expect(processCoursewareGenerationJob(db as never, 'job-1', async () => runtime as never))
      .resolves.toEqual({ jobId: 'job-1', state: 'COMPLETED' });

    expect(mocks.beginAttempt).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      request: expect.objectContaining({ authoritativeSourceBindings: [sourceBindingFixture] }),
    }));
    expect(mocks.completeUnit).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      unitKey: 'bridge-in', output,
    }));
    expect(mocks.failUnit).not.toHaveBeenCalled();
  });

  it('fails a crash redelivery with a live unit lease and processes a later reclaimed delivery', async () => {
    const plan = validPlanFixture();
    const context = {
      id: 'job-1', ownerId: 'teacher-1', draftId: 'draft-1', state: 'RUNNING', firstIncompleteUnitKey: 'bridge-in',
      deliveryGeneration: 1,
      draft: { id: 'draft-1', planRevision: { content: plan } },
      units: [{ id: 'unit-1', unitKey: 'bridge-in', state: 'RUNNING', output: null, orderIndex: 0, attemptGeneration: 1 }],
    };
    const db = { smartCoursewareGenerationJob: { findUnique: vi.fn().mockResolvedValue(context) } };
    mocks.buildSar.mockResolvedValue({ selectedVersionIds: [sourceBindingFixture.sourceVersionId] });
    mocks.buildSourcePack.mockResolvedValue({
      retrieval: { pack: { items: [{
        citationTargetId: sourceBindingFixture.citationId,
        metadata: {
          versionId: sourceBindingFixture.sourceVersionId,
          stableAnchor: sourceBindingFixture.anchor,
          contentHash: sourceBindingFixture.contentHash,
        },
      }] } },
    });
    mocks.beginAttempt
      .mockResolvedValueOnce({ claimed: false, claimToken: null, attempt: { id: 'attempt-1' } })
      .mockResolvedValueOnce({ claimed: true, claimToken: 'claim-2', attempt: { id: 'attempt-2', idempotencyKey: 'attempt-key-2' } });
    mocks.completeUnit.mockResolvedValue({ state: 'COMPLETED' });
    const output = createDeterministicCoursewareStage({
      unitKey: 'bridge-in', durationSeconds: 300, sourceBinding: sourceBindingFixture,
    });
    const runtime = {
      serviceId: 'fixture-service', providerKind: 'fixture', model: 'fixture-model',
      generate: vi.fn().mockResolvedValue({
        output, normalizedResponseId: 'fixture-response', inputTokens: 0, outputTokens: 0, costMicros: null,
      }),
    };

    await expect(processCoursewareGenerationJob(db as never, 'job-1', async () => runtime as never))
      .rejects.toMatchObject({ code: 'courseware-unit-lease-active' });
    expect(runtime.generate).not.toHaveBeenCalled();

    await expect(processCoursewareGenerationJob(db as never, 'job-1', async () => runtime as never))
      .resolves.toEqual({ jobId: 'job-1', state: 'COMPLETED' });
    expect(runtime.generate).toHaveBeenCalledOnce();
    expect(mocks.completeUnit).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      claimToken: 'claim-2', attemptId: 'attempt-2',
    }));
  });

  it('does not overwrite cancellation when pre-provider resolution fails', async () => {
    const context = {
      id: 'job-1', ownerId: 'teacher-1', draftId: 'draft-1', state: 'QUEUED', firstIncompleteUnitKey: 'bridge-in',
      deliveryGeneration: 1,
      draft: { id: 'draft-1', planRevision: { content: validPlanFixture() } },
      units: [{ id: 'unit-1', unitKey: 'bridge-in', state: 'PENDING', output: null, orderIndex: 0, attemptGeneration: 0 }],
    };
    const updateUnit = vi.fn();
    const updateDraft = vi.fn();
    const db = {
      smartCoursewareGenerationJob: {
        findUnique: vi.fn().mockResolvedValueOnce(context).mockResolvedValueOnce({ state: 'CANCELLED' }),
      },
      $transaction: vi.fn(async (run: (tx: unknown) => unknown) => run({
        smartCoursewareGenerationJob: { updateMany: vi.fn().mockResolvedValue({ count: 0 }) },
        smartCoursewareGenerationUnit: { updateMany: updateUnit },
        smartCoursewareDraft: { updateMany: updateDraft },
      })),
    };

    await expect(processCoursewareGenerationJob(db as never, 'job-1', async () => { throw new Error('provider-offline'); }))
      .resolves.toEqual({ jobId: 'job-1', state: 'CANCELLED' });
    expect(updateUnit).not.toHaveBeenCalled();
    expect(updateDraft).not.toHaveBeenCalled();
  });

  it('rolls back the pre-provider job transition when a newer unit lease wins', async () => {
    const context = {
      id: 'job-1', ownerId: 'teacher-1', draftId: 'draft-1', state: 'QUEUED', firstIncompleteUnitKey: 'bridge-in',
      deliveryGeneration: 2,
      draft: { id: 'draft-1', planRevision: { content: validPlanFixture() } },
      units: [{ id: 'unit-1', unitKey: 'bridge-in', state: 'PENDING', output: null, orderIndex: 0, attemptGeneration: 1 }],
    };
    const updateDraft = vi.fn();
    const db = {
      smartCoursewareGenerationJob: {
        findUnique: vi.fn().mockResolvedValueOnce(context).mockResolvedValueOnce({ state: 'RUNNING' }),
      },
      $transaction: vi.fn(async (run: (tx: unknown) => unknown) => run({
        smartCoursewareGenerationJob: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
        smartCoursewareGenerationUnit: { updateMany: vi.fn().mockResolvedValue({ count: 0 }) },
        smartCoursewareDraft: { updateMany: updateDraft },
      })),
    };

    await expect(processCoursewareGenerationJob(db as never, 'job-1', async () => { throw new Error('provider-offline'); }))
      .resolves.toEqual({ jobId: 'job-1', state: 'RUNNING' });
    expect(updateDraft).not.toHaveBeenCalled();
  });
});
