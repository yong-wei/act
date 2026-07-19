import { describe, expect, it, vi } from 'vitest';

import { contentHash } from '@/lib/smart-lesson-plan/domain';
import { validPlanFixture } from '@/lib/smart-lesson-plan/__tests__/fixtures';

import {
  COURSEWARE_GENERATION_UNITS,
  beginCoursewareProviderAttempt,
  cancelCoursewareGenerationJob,
  completeCoursewareGenerationUnit,
  resumeCoursewareGenerationJob,
  retryCoursewareGenerationJob,
  startCoursewareGenerationJob,
  failCoursewareGenerationUnit,
} from '../generation-service';
import { coursewareManifestHash, coursewareModuleGenerationInputHash } from '../domain';
import { validCoursewareManifest } from './fixtures';

const actor = { id: 'teacher-1', role: 'TEACHER' as const };

function baselineDraft() {
  const content = validPlanFixture();
  const revision = { id: 'plan-1', revisionNumber: 1, content, contentHash: contentHash(content) };
  return {
    id: 'draft-1', ownerId: actor.id, planRevisionId: revision.id, planRevisionNumber: 1,
    planContentHash: revision.contentHash, authoringLineageRoot: 'lineage-1', state: 'EDITABLE',
    runtimeManifest: null, modules: [], planRevision: revision,
  };
}

describe('smart courseware generation service', () => {
  it('starts one durable six-unit job from the immutable plan baseline', async () => {
    const draft = baselineDraft();
    const create = vi.fn(async ({ data }) => ({ id: data.id, ownerId: actor.id, draftId: draft.id, state: 'QUEUED' }));
    const updateDraft = vi.fn();
    const db = {
      smartCoursewareGenerationCommand: { findFirst: vi.fn().mockResolvedValue(null) },
      smartCoursewareGenerationJob: { findFirst: vi.fn() },
      $transaction: vi.fn(async (run: (tx: unknown) => unknown) => run({
        smartCoursewareDraft: { findFirst: vi.fn().mockResolvedValue(draft), update: updateDraft },
        smartCoursewareGenerationJob: { findFirst: vi.fn().mockResolvedValue(null), create },
      })),
    };
    await expect(startCoursewareGenerationJob(db as never, {
      actor, draftId: draft.id, idempotencyKey: 'start-key-1',
    })).resolves.toMatchObject({ draftId: draft.id, state: 'QUEUED' });
    expect(create).toHaveBeenCalledWith({ data: expect.objectContaining({
      activeIdentity: `draft:${draft.id}`,
      units: { create: COURSEWARE_GENERATION_UNITS.map((unitKey, orderIndex) => ({ ownerId: actor.id, unitKey, orderIndex })) },
    }), include: { units: { orderBy: { orderIndex: 'asc' } } } });
    expect(updateDraft).toHaveBeenCalledWith({ where: { id: draft.id }, data: { state: 'GENERATING' } });
  });

  it('does not double-claim a live unit lease', async () => {
    const attempt = { id: 'attempt-1', outcome: 'RUNNING' };
    const db = { $transaction: vi.fn(async (run: (tx: unknown) => unknown) => run({
      smartCoursewareGenerationJob: { findFirst: vi.fn().mockResolvedValue({ id: 'job-1', ownerId: actor.id, state: 'RUNNING', firstIncompleteUnitKey: 'bridge-in' }) },
      smartCoursewareGenerationUnit: { findUnique: vi.fn().mockResolvedValue({ id: 'unit-1', unitKey: 'bridge-in', state: 'RUNNING', claimExpiresAt: new Date(Date.now() + 60_000) }) },
      smartCoursewareProviderAttempt: { findFirst: vi.fn().mockResolvedValue(attempt) },
    })) };
    await expect(beginCoursewareProviderAttempt(db as never, {
      actor, jobId: 'job-1', unitKey: 'bridge-in', serviceId: 'service', providerKind: 'test',
      model: 'model', promptVersion: 'v1', schemaVersion: 'v1', request: {},
    })).resolves.toEqual({ claimed: false, claimToken: null, attempt });
  });

  it('reclaims an expired unit lease left by a crashed worker', async () => {
    const expired = {
      id: 'unit-1', unitKey: 'bridge-in', state: 'RUNNING', attemptGeneration: 1,
      claimExpiresAt: new Date(Date.now() - 60_000), startedAt: new Date(Date.now() - 120_000),
    };
    const retryable = { ...expired, state: 'RETRYABLE', claimExpiresAt: null };
    const updateUnit = vi.fn().mockResolvedValue(retryable);
    const claimUnit = vi.fn().mockResolvedValue({ count: 1 });
    const updateAttempt = vi.fn().mockResolvedValue({ count: 1 });
    const createAttempt = vi.fn().mockResolvedValue({ id: 'attempt-2', attemptNumber: 2 });
    const db = { $transaction: vi.fn(async (run: (tx: unknown) => unknown) => run({
      smartCoursewareGenerationJob: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'job-1', ownerId: actor.id, state: 'RUNNING', firstIncompleteUnitKey: 'bridge-in', startedAt: new Date(),
        }),
        update: vi.fn(),
      },
      smartCoursewareGenerationUnit: {
        findUnique: vi.fn().mockResolvedValue(expired), findUniqueOrThrow: vi.fn().mockResolvedValue(retryable),
        update: updateUnit, updateMany: claimUnit,
      },
      smartCoursewareProviderAttempt: {
        findFirst: vi.fn().mockResolvedValue({ id: 'attempt-1', attemptNumber: 1 }),
        updateMany: updateAttempt, create: createAttempt,
      },
    })) };

    await expect(beginCoursewareProviderAttempt(db as never, {
      actor, jobId: 'job-1', unitKey: 'bridge-in', serviceId: 'service', providerKind: 'test',
      model: 'model', promptVersion: 'v1', schemaVersion: 'v1', request: {},
    })).resolves.toMatchObject({ claimed: true, attempt: { id: 'attempt-2' } });
    expect(updateUnit).toHaveBeenCalledWith({
      where: { id: expired.id }, data: { state: 'RETRYABLE', claimToken: null, claimExpiresAt: null },
    });
    expect(updateAttempt).toHaveBeenCalledWith({
      where: { unitId: expired.id, outcome: 'RUNNING' },
      data: { outcome: 'RETRYABLE_FAILURE', finishedAt: expect.any(Date) },
    });
    expect(claimUnit).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: expired.id, state: { in: ['PENDING', 'RETRYABLE'] }, attemptGeneration: 1 }),
    }));
  });

  it('protects completed unit output from conflicting duplicate delivery', async () => {
    const job = {
      id: 'job-1', ownerId: actor.id, draftId: 'draft-1', state: 'RUNNING',
      draft: {}, units: [{ id: 'unit-1', unitKey: 'bridge-in', state: 'COMPLETED', outputHash: contentHash({ accepted: true }), attempts: [] }],
    };
    const db = { $transaction: vi.fn(async (run: (tx: unknown) => unknown) => run({ smartCoursewareGenerationJob: { findFirst: vi.fn().mockResolvedValue(job) } })) };
    await expect(completeCoursewareGenerationUnit(db as never, {
      actor, jobId: job.id, unitKey: 'bridge-in', claimToken: 'claim', attemptId: 'attempt', output: { accepted: false },
    })).rejects.toMatchObject({ code: 'completed-courseware-unit-output-conflict' });
  });

  it('keeps a failed initial job active and the draft generating until an explicit transition', async () => {
    const job = { id: 'job-1', ownerId: actor.id, draftId: 'draft-1', state: 'RUNNING', activeIdentity: 'draft:draft-1', draft: { state: 'GENERATING' } };
    const updateJob = vi.fn().mockResolvedValue({ ...job, state: 'FAILED' });
    const updateDraft = vi.fn();
    const db = { $transaction: vi.fn(async (run: (tx: unknown) => unknown) => run({
      smartCoursewareGenerationJob: { findFirst: vi.fn().mockResolvedValue(job), update: updateJob },
      smartCoursewareGenerationUnit: {
        findUnique: vi.fn().mockResolvedValue({ id: 'unit-1', unitKey: 'bridge-in', state: 'RUNNING' }),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      smartCoursewareProviderAttempt: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
      smartCoursewareDraft: { update: updateDraft },
    })) };

    await failCoursewareGenerationUnit(db as never, {
      actor, jobId: job.id, unitKey: 'bridge-in', claimToken: 'claim', attemptId: 'attempt-1', failureCode: 'provider-failed', retryable: false,
    });
    expect(updateDraft).not.toHaveBeenCalled();
    expect(updateJob).toHaveBeenCalledWith({ where: { id: job.id }, data: expect.not.objectContaining({ activeIdentity: expect.anything() }) });
  });

  it.each([
    ['resume', resumeCoursewareGenerationJob],
    ['retry', retryCoursewareGenerationJob],
  ])('restores MODULE jobs without touching INITIAL units or draft generation state (%s)', async (_name, transition) => {
    const { draft, job } = moduleJobFixture('FAILED');
    const updateJob = vi.fn().mockResolvedValue({ ...job, state: 'QUEUED' });
    const updateUnit = vi.fn();
    const updateDraft = vi.fn();
    const db = {
      smartCoursewareGenerationCommand: { findFirst: vi.fn().mockResolvedValue(null) },
      $transaction: vi.fn(async (run: (tx: unknown) => unknown) => run({
        smartCoursewareGenerationJob: { findFirst: vi.fn().mockResolvedValue(job), update: updateJob },
        smartCoursewareDraft: { findUnique: vi.fn().mockResolvedValue(draft), update: updateDraft },
        smartCoursewareGenerationUnit: { findFirst: vi.fn(), update: updateUnit, updateMany: updateUnit },
        smartCoursewareGenerationCommand: { create: vi.fn() },
      })),
    };

    await expect(transition(db as never, {
      actor, jobId: job.id, idempotencyKey: `${_name}-module-1`,
    })).resolves.toMatchObject({ state: 'QUEUED' });
    expect(updateJob).toHaveBeenCalledWith({ where: { id: job.id }, data: expect.objectContaining({
      activeIdentity: `draft:${draft.id}`,
      firstIncompleteUnitKey: null,
      deliveryGeneration: { increment: 1 },
    }) });
    expect(updateUnit).not.toHaveBeenCalled();
    expect(updateDraft).not.toHaveBeenCalled();
  });

  it('rejects MODULE resume when its draft-version or target-module input changed', async () => {
    const { draft, job } = moduleJobFixture('FAILED');
    const changed = { ...draft, version: draft.version + 1 };
    const updateJob = vi.fn();
    const db = {
      smartCoursewareGenerationCommand: { findFirst: vi.fn().mockResolvedValue(null) },
      $transaction: vi.fn(async (run: (tx: unknown) => unknown) => run({
        smartCoursewareGenerationJob: { findFirst: vi.fn().mockResolvedValue(job), update: updateJob },
        smartCoursewareDraft: { findUnique: vi.fn().mockResolvedValue(changed) },
      })),
    };

    await expect(resumeCoursewareGenerationJob(db as never, {
      actor, jobId: job.id, idempotencyKey: 'resume-module-stale',
    })).rejects.toMatchObject({ code: 'courseware-generation-input-changed' });
    expect(updateJob).not.toHaveBeenCalled();
  });

  it('resumes an expired MODULE lease and clears the abandoned claim', async () => {
    const { draft, job } = moduleJobFixture('RUNNING');
    Object.assign(job, {
      moduleClaimToken: 'abandoned-token',
      moduleClaimExpiresAt: new Date(Date.now() - 60_000),
    });
    const updateJob = vi.fn().mockResolvedValue({ ...job, state: 'QUEUED' });
    const db = {
      smartCoursewareGenerationCommand: { findFirst: vi.fn().mockResolvedValue(null) },
      $transaction: vi.fn(async (run: (tx: unknown) => unknown) => run({
        smartCoursewareGenerationJob: { findFirst: vi.fn().mockResolvedValue(job), update: updateJob },
        smartCoursewareDraft: { findUnique: vi.fn().mockResolvedValue(draft) },
        smartCoursewareGenerationCommand: { create: vi.fn() },
      })),
    };

    await expect(resumeCoursewareGenerationJob(db as never, {
      actor, jobId: job.id, idempotencyKey: 'resume-expired-module',
    })).resolves.toMatchObject({ state: 'QUEUED' });
    expect(updateJob).toHaveBeenCalledWith({ where: { id: job.id }, data: expect.objectContaining({
      moduleClaimToken: null,
      moduleClaimExpiresAt: null,
      deliveryGeneration: { increment: 1 },
    }) });
  });

  it('cancels MODULE jobs without cancelling units or changing the draft state', async () => {
    const { draft, job } = moduleJobFixture('RUNNING');
    const updateJob = vi.fn().mockResolvedValue({ ...job, state: 'CANCELLED' });
    const updateUnit = vi.fn();
    const updateDraft = vi.fn();
    const updateAttempt = vi.fn().mockResolvedValue({ count: 1 });
    const db = {
      smartCoursewareGenerationCommand: { findFirst: vi.fn().mockResolvedValue(null) },
      $transaction: vi.fn(async (run: (tx: unknown) => unknown) => run({
        smartCoursewareGenerationJob: { findFirst: vi.fn().mockResolvedValue(job), update: updateJob },
        smartCoursewareGenerationUnit: { updateMany: updateUnit },
        smartCoursewareProviderAttempt: { updateMany: updateAttempt },
        smartCoursewareDraft: { update: updateDraft },
        smartCoursewareGenerationCommand: { create: vi.fn() },
      })),
    };

    await expect(cancelCoursewareGenerationJob(db as never, {
      actor, jobId: job.id, idempotencyKey: 'cancel-module-1',
    })).resolves.toMatchObject({ state: 'CANCELLED' });
    expect(updateJob).toHaveBeenCalledWith({ where: { id: job.id }, data: expect.objectContaining({
      state: 'CANCELLED', activeIdentity: null, firstIncompleteUnitKey: null,
    }) });
    expect(updateUnit).not.toHaveBeenCalled();
    expect(updateDraft).not.toHaveBeenCalled();
    expect(updateAttempt).toHaveBeenCalledWith({
      where: { generationJobId: job.id, outcome: 'RUNNING' },
      data: { outcome: 'CANCELLED', finishedAt: expect.any(Date) },
    });
  });

  it('cancels the RUNNING provider attempt atomically when an INITIAL job is cancelled in flight', async () => {
    const job = {
      id: 'job-initial', ownerId: actor.id, draftId: 'draft-1', mode: 'INITIAL', state: 'RUNNING',
    };
    const calls: string[] = [];
    const updateAttempt = vi.fn(async () => { calls.push('attempt'); return { count: 1 }; });
    const updateUnit = vi.fn(async () => { calls.push('unit'); return { count: 1 }; });
    const updateDraft = vi.fn(async () => { calls.push('draft'); return {}; });
    const updateJob = vi.fn(async () => { calls.push('job'); return { ...job, state: 'CANCELLED' }; });
    const db = {
      smartCoursewareGenerationCommand: { findFirst: vi.fn().mockResolvedValue(null) },
      $transaction: vi.fn(async (run: (tx: unknown) => unknown) => run({
        smartCoursewareGenerationJob: { findFirst: vi.fn().mockResolvedValue(job), update: updateJob },
        smartCoursewareGenerationUnit: { updateMany: updateUnit },
        smartCoursewareProviderAttempt: { updateMany: updateAttempt },
        smartCoursewareDraft: { update: updateDraft },
        smartCoursewareGenerationCommand: { create: vi.fn() },
      })),
    };

    await expect(cancelCoursewareGenerationJob(db as never, {
      actor, jobId: job.id, idempotencyKey: 'cancel-initial-in-flight',
    })).resolves.toMatchObject({ state: 'CANCELLED' });
    expect(updateAttempt).toHaveBeenCalledWith({
      where: { generationJobId: job.id, outcome: 'RUNNING' },
      data: { outcome: 'CANCELLED', finishedAt: expect.any(Date) },
    });
    expect(updateUnit).toHaveBeenCalledWith({
      where: { jobId: job.id, state: { in: ['PENDING', 'RUNNING', 'RETRYABLE', 'FAILED'] } },
      data: { state: 'CANCELLED', claimToken: null, claimExpiresAt: null },
    });
    expect(calls).toEqual(['attempt', 'unit', 'draft', 'job']);
  });

  it('allows a permanently failed INITIAL job to be cancelled and releases its draft', async () => {
    const job = { id: 'job-failed', ownerId: actor.id, draftId: 'draft-1', mode: 'INITIAL', state: 'FAILED', draft: { state: 'GENERATING' } };
    const updateUnit = vi.fn().mockResolvedValue({ count: 1 });
    const updateDraft = vi.fn();
    const updateJob = vi.fn().mockResolvedValue({ ...job, state: 'CANCELLED', activeIdentity: null });
    const db = {
      smartCoursewareGenerationCommand: { findFirst: vi.fn().mockResolvedValue(null) },
      $transaction: vi.fn(async (run: (tx: unknown) => unknown) => run({
        smartCoursewareGenerationJob: { findFirst: vi.fn().mockResolvedValue(job), update: updateJob },
        smartCoursewareGenerationUnit: { updateMany: updateUnit },
        smartCoursewareProviderAttempt: { updateMany: vi.fn().mockResolvedValue({ count: 0 }) },
        smartCoursewareDraft: { update: updateDraft },
        smartCoursewareGenerationCommand: { create: vi.fn() },
      })),
    };

    await cancelCoursewareGenerationJob(db as never, { actor, jobId: job.id, idempotencyKey: 'cancel-failed-initial' });
    expect(updateUnit).toHaveBeenCalledWith({
      where: { jobId: job.id, state: { in: ['PENDING', 'RUNNING', 'RETRYABLE', 'FAILED'] } },
      data: { state: 'CANCELLED', claimToken: null, claimExpiresAt: null },
    });
    expect(updateDraft).toHaveBeenCalledWith({ where: { id: job.draftId }, data: { state: 'EDITABLE' } });
    expect(updateJob).toHaveBeenCalledWith({ where: { id: job.id }, data: expect.objectContaining({ state: 'CANCELLED', activeIdentity: null }) });
  });

  it.each([
    ['resume', resumeCoursewareGenerationJob, 'FAILED'],
    ['retry', retryCoursewareGenerationJob, 'FAILED'],
    ['cancel', cancelCoursewareGenerationJob, 'RUNNING'],
  ] as const)('rejects %s after the draft is ACCEPTED', async (name, transition, state) => {
    const job = {
      id: `accepted-${name}`, ownerId: actor.id, draftId: 'accepted-draft', mode: 'INITIAL', state,
      draft: { state: 'ACCEPTED' },
    };
    const db = {
      smartCoursewareGenerationCommand: { findFirst: vi.fn().mockResolvedValue(null) },
      $transaction: vi.fn(async (run: (tx: unknown) => unknown) => run({
        smartCoursewareGenerationJob: { findFirst: vi.fn().mockResolvedValue(job) },
      })),
    };
    await expect(transition(db as never, {
      actor, jobId: job.id, idempotencyKey: `${name}-accepted-1`,
    })).rejects.toMatchObject({ code: 'accepted-courseware-immutable' });
  });

  it('rejects an idempotent transition replay after the draft is ACCEPTED', async () => {
    const job = { id: 'accepted-replay-job', ownerId: actor.id, draftId: 'accepted-draft', state: 'QUEUED', draft: { state: 'ACCEPTED' } };
    const requestHash = contentHash({ jobId: job.id });
    const db = {
      smartCoursewareGenerationCommand: { findFirst: vi.fn().mockResolvedValue({ jobId: job.id, requestHash }) },
      smartCoursewareGenerationJob: { findFirst: vi.fn().mockResolvedValue(job) },
      $transaction: vi.fn(),
    };
    await expect(resumeCoursewareGenerationJob(db as never, {
      actor, jobId: job.id, idempotencyKey: 'accepted-replay-1',
    })).rejects.toMatchObject({ code: 'accepted-courseware-immutable' });
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it('does not claim a provider attempt for an ACCEPTED draft', async () => {
    const db = { $transaction: vi.fn(async (run: (tx: unknown) => unknown) => run({
      smartCoursewareGenerationJob: { findFirst: vi.fn().mockResolvedValue({
        id: 'accepted-provider-job', ownerId: actor.id, state: 'QUEUED', firstIncompleteUnitKey: 'bridge-in',
        draft: { state: 'ACCEPTED' },
      }) },
    })) };
    await expect(beginCoursewareProviderAttempt(db as never, {
      actor, jobId: 'accepted-provider-job', unitKey: 'bridge-in', serviceId: 'service', providerKind: 'test',
      model: 'model', promptVersion: 'v1', schemaVersion: 'v1', request: {},
    })).rejects.toMatchObject({ code: 'accepted-courseware-immutable' });
  });
});

function moduleJobFixture(state: 'FAILED' | 'RUNNING') {
  const runtimeManifest = validCoursewareManifest();
  runtimeManifest.lessonId = 'draft-module';
  const runtimeModule = runtimeManifest.stages[2].steps[0].modules[0];
  const content = validPlanFixture();
  const planRevision = { id: 'plan-1', revisionNumber: 1, content, contentHash: contentHash(content) };
  const draft = {
    id: 'draft-module', ownerId: actor.id, version: 2, planRevisionId: planRevision.id,
    planRevisionNumber: 1, planContentHash: planRevision.contentHash, authoringLineageRoot: 'lineage-module',
    state: 'READY', runtimeManifest, contentHash: coursewareManifestHash(runtimeManifest), planRevision,
    modules: [{ runtimeModuleId: runtimeModule.id, contentHash: contentHash(runtimeModule), deletedAt: null }],
  };
  const targetModuleHash = contentHash(runtimeModule);
  const job = {
    id: 'job-module', ownerId: actor.id, draftId: draft.id, mode: 'MODULE', state,
    targetModuleId: runtimeModule.id, targetModuleHash, firstIncompleteUnitKey: null,
    inputHash: coursewareModuleGenerationInputHash({
      draftId: draft.id, draftVersion: draft.version, planRevisionId: draft.planRevisionId,
      planContentHash: draft.planContentHash, moduleId: runtimeModule.id, moduleHash: targetModuleHash,
    }),
  };
  return { draft, job };
}
