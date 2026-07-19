import { describe, expect, it, vi } from 'vitest';
import { Prisma } from '@prisma/client';

import type { GeneratedSlideManifest } from '@/features/interactive/shared/manifest-runtime/generated-slide-contract';
import { contentHash } from '@/lib/smart-lesson-plan/domain';
import { sourceBindingFixture, validPlanFixture } from '@/lib/smart-lesson-plan/__tests__/fixtures';

import {
  acceptCoursewareModuleCandidate,
  generateCoursewareModuleCandidate,
  requestCoursewareModuleRegeneration,
} from '../module-regeneration-service';
import { coursewareManifestHash } from '../domain';
import { validCompositionInput } from './fixtures';

const actor = { id: 'teacher-1', role: 'TEACHER' as const };

describe('smart courseware selected-module regeneration acceptance', () => {
  it('persists a draft-exclusive MODULE job, enqueues it, and returns before provider work begins', async () => {
    const fixture = acceptanceFixture();
    const selected = fixture.job.draft.modules[2];
    const created = {
      id: 'queued-module-job', ownerId: actor.id, draftId: fixture.job.draft.id,
      mode: 'MODULE', state: 'QUEUED', targetModuleId: selected.runtimeModuleId,
      targetModuleHash: selected.contentHash, candidateRuntimeModule: null,
    };
    const create = vi.fn().mockResolvedValue(created);
    const enqueue = vi.fn().mockResolvedValue({ queued: true, job: created });
    const db = {
      smartCoursewareGenerationCommand: { findFirst: vi.fn().mockResolvedValue(null) },
      smartCoursewareDraft: { findFirst: vi.fn().mockResolvedValue({
        ...fixture.job.draft,
        modules: [selected],
      }) },
      smartCoursewareGenerationJob: { findFirst: vi.fn().mockResolvedValue(created) },
      $transaction: vi.fn(async (run: (tx: unknown) => unknown) => run({
        smartCoursewareDraft: { findUnique: vi.fn().mockResolvedValue(fixture.job.draft) },
        smartCoursewareGenerationJob: { create },
      })),
    };

    await expect(requestCoursewareModuleRegeneration(db as never, {
      actor, draftId: fixture.job.draft.id, moduleId: selected.runtimeModuleId,
      idempotencyKey: 'request-module-1',
    }, { enqueue: enqueue as never })).resolves.toEqual(created);

    expect(create).toHaveBeenCalledWith({ data: expect.objectContaining({
      mode: 'MODULE',
      activeIdentity: `draft:${fixture.job.draft.id}`,
      firstIncompleteUnitKey: null,
    }) });
    expect(enqueue).toHaveBeenCalledWith(db, created.id);
    expect(created.candidateRuntimeModule).toBeNull();
  });

  it('returns the existing draft-level active job when another module races', async () => {
    const fixture = acceptanceFixture();
    const selected = fixture.job.draft.modules[3];
    const active = {
      id: 'active-module-job', ownerId: actor.id, draftId: fixture.job.draft.id,
      mode: 'MODULE', state: 'RUNNING', targetModuleId: 'module-3', activeIdentity: `draft:${fixture.job.draft.id}`,
    };
    const db = {
      smartCoursewareGenerationCommand: { findFirst: vi.fn().mockResolvedValue(null) },
      smartCoursewareDraft: { findFirst: vi.fn().mockResolvedValue({ ...fixture.job.draft, modules: [selected] }) },
      smartCoursewareGenerationJob: { findFirst: vi.fn().mockResolvedValue(active) },
      $transaction: vi.fn().mockRejectedValue(new Prisma.PrismaClientKnownRequestError('unique', {
        code: 'P2002', clientVersion: 'test', meta: {},
      })),
    };

    await expect(requestCoursewareModuleRegeneration(db as never, {
      actor, draftId: fixture.job.draft.id, moduleId: selected.runtimeModuleId,
      idempotencyKey: 'request-module-2',
    }, { enqueue: vi.fn() as never })).resolves.toEqual(active);
    expect(db.smartCoursewareGenerationJob.findFirst).toHaveBeenCalledWith({
      where: { ownerId: actor.id, activeIdentity: `draft:${fixture.job.draft.id}` },
    });
  });

  it('rejects module request and idempotent replay after the draft is ACCEPTED', async () => {
    const fixture = acceptanceFixture();
    const selected = fixture.job.draft.modules[2];
    const acceptedDraft = { ...fixture.job.draft, state: 'ACCEPTED' };
    const directDb = {
      smartCoursewareGenerationCommand: { findFirst: vi.fn().mockResolvedValue(null) },
      smartCoursewareDraft: { findFirst: vi.fn().mockResolvedValue({ ...acceptedDraft, modules: [selected] }) },
      $transaction: vi.fn(),
    };
    await expect(requestCoursewareModuleRegeneration(directDb as never, {
      actor, draftId: acceptedDraft.id, moduleId: selected.runtimeModuleId,
      idempotencyKey: 'accepted-module-request',
    }, { enqueue: vi.fn() as never })).rejects.toMatchObject({ code: 'accepted-courseware-immutable' });
    expect(directDb.$transaction).not.toHaveBeenCalled();

    const requestHash = contentHash({ draftId: acceptedDraft.id, moduleId: selected.runtimeModuleId });
    const replayDb = {
      smartCoursewareGenerationCommand: { findFirst: vi.fn().mockResolvedValue({ jobId: 'module-replay', requestHash }) },
      smartCoursewareGenerationJob: { findFirst: vi.fn().mockResolvedValue({
        id: 'module-replay', state: 'QUEUED', draft: { state: 'ACCEPTED' },
      }) },
    };
    const replayEnqueue = vi.fn();
    await expect(requestCoursewareModuleRegeneration(replayDb as never, {
      actor, draftId: acceptedDraft.id, moduleId: selected.runtimeModuleId,
      idempotencyKey: 'accepted-module-replay',
    }, { enqueue: replayEnqueue as never })).rejects.toMatchObject({ code: 'accepted-courseware-immutable' });
    expect(replayEnqueue).not.toHaveBeenCalled();
  });

  it('does not claim or invoke the module provider for an ACCEPTED draft', async () => {
    const fixture = acceptanceFixture();
    const acceptedJob = { ...fixture.job, state: 'QUEUED', draft: { ...fixture.job.draft, state: 'ACCEPTED' } };
    const resolveProvider = vi.fn();
    const db = {
      smartCoursewareGenerationJob: {
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
        findFirst: vi.fn().mockResolvedValue(acceptedJob),
      },
      smartCoursewareDraft: { findUnique: vi.fn().mockResolvedValue({ state: 'ACCEPTED' }) },
    };
    await expect(generateCoursewareModuleCandidate(db as never, { actor, jobId: acceptedJob.id }, {
      resolveProvider: resolveProvider as never,
    })).rejects.toMatchObject({ code: 'accepted-courseware-immutable' });
    expect(resolveProvider).not.toHaveBeenCalled();
  });

  it('builds server-side local context and persists provider output as a candidate without changing the draft', async () => {
    const fixture = acceptanceFixture();
    const job = {
      ...fixture.job,
      state: 'RUNNING',
      candidateRuntimeModule: null,
      candidateModuleMetadata: null,
      candidateHash: null,
      sourceBindingsSnapshot: null,
      moduleAttemptGeneration: 1,
    };
    const updateJob = vi.fn().mockResolvedValue({ count: 1 });
    const createAttempt = vi.fn().mockResolvedValue({
      id: 'module-provider-attempt-1', attemptNumber: 1,
      idempotencyKey: `smart-courseware-module:${job.id}:1`,
    });
    const updateAttempt = vi.fn().mockResolvedValue({ count: 1 });
    const generate = vi.fn().mockResolvedValue({
      output: {
        runtimeModule: fixture.job.candidateRuntimeModule,
        moduleMetadata: fixture.job.candidateModuleMetadata,
      },
      normalizedResponseId: 'provider-response-1', inputTokens: 10, outputTokens: 20, costMicros: null,
    });
    const db = {
      smartCoursewareGenerationJob: {
        updateMany: updateJob,
        findFirstOrThrow: vi.fn().mockResolvedValue(job),
        findFirst: vi.fn().mockResolvedValue({ ...job, state: 'COMPLETED' }),
      },
      smartCoursewareProviderAttempt: { create: createAttempt, updateMany: updateAttempt },
      $transaction: vi.fn(async (run: (tx: unknown) => unknown) => run({
        smartCoursewareGenerationJob: { updateMany: updateJob },
        smartCoursewareProviderAttempt: { create: createAttempt, updateMany: updateAttempt },
      })),
    };

    await generateCoursewareModuleCandidate(db as never, { actor, jobId: job.id }, {
      buildSar: vi.fn().mockResolvedValue({ selectedVersionIds: [sourceBindingFixture.sourceVersionId] }) as never,
      buildSourcePack: vi.fn().mockResolvedValue({ retrieval: { pack: { items: [{
        citationTargetId: sourceBindingFixture.citationId,
        metadata: {
          versionId: sourceBindingFixture.sourceVersionId,
          stableAnchor: sourceBindingFixture.anchor,
          contentHash: sourceBindingFixture.contentHash,
        },
      }] } } }) as never,
      resolveProvider: vi.fn().mockResolvedValue({
        serviceId: 'service-1', providerKind: 'fixture', model: 'model-1', generate,
      }) as never,
    });

    const providerInput = generate.mock.calls[0][0];
    const localContext = JSON.parse(providerInput.prompt);
    expect(localContext).toMatchObject({
      planBaseline: { revisionId: fixture.job.planRevisionId, contentHash: fixture.job.planContentHash },
      selectedModule: { id: fixture.job.targetModuleId },
      authoritativeSourceBindings: [sourceBindingFixture],
    });
    expect(localContext.goals).toHaveLength(1);
    expect(localContext.stage.stage).toBe('pre-assessment');
    expect(localContext.step.id).toBe('step-3');
    expect(createAttempt).toHaveBeenCalledWith({ data: expect.objectContaining({
      generationJobId: job.id,
      unitId: null,
      attemptNumber: 1,
      requestSnapshot: localContext,
    }) });
    expect(generate).toHaveBeenCalledWith(expect.objectContaining({
      idempotencyKey: `smart-courseware-module:${job.id}:1`,
    }));
    const claimWrite = updateJob.mock.calls[0][0];
    const claimToken = claimWrite.data.moduleClaimToken;
    expect(claimWrite).toEqual(expect.objectContaining({
      where: expect.objectContaining({
        OR: [{ state: 'QUEUED' }, { state: 'RUNNING', moduleClaimExpiresAt: expect.any(Object) }],
      }),
      data: expect.objectContaining({
        moduleAttemptGeneration: { increment: 1 },
        moduleClaimToken: expect.any(String),
        moduleClaimExpiresAt: expect.any(Date),
      }),
    }));
    expect(updateJob).toHaveBeenLastCalledWith(expect.objectContaining({ data: expect.objectContaining({
      state: 'COMPLETED',
      candidateRuntimeModule: fixture.job.candidateRuntimeModule,
      candidateModuleMetadata: fixture.job.candidateModuleMetadata,
      sourceBindingsSnapshot: [sourceBindingFixture],
    }), where: expect.objectContaining({ moduleAttemptGeneration: 1, moduleClaimToken: claimToken }) }));
    expect(updateAttempt).toHaveBeenLastCalledWith(expect.objectContaining({
      where: { id: 'module-provider-attempt-1', generationJobId: job.id, outcome: 'RUNNING' },
      data: expect.objectContaining({ outcome: 'SUCCEEDED', normalizedResponseId: 'provider-response-1' }),
    }));
    expect((db as Record<string, unknown>).smartCoursewareDraft).toBeUndefined();
  });

  it('lets a new worker reclaim an expired MODULE lease after a hard interruption', async () => {
    const fixture = acceptanceFixture();
    const now = new Date('2026-07-19T12:00:00Z');
    const interrupted = {
      ...fixture.job,
      state: 'RUNNING',
      moduleAttemptGeneration: 2,
      moduleClaimToken: 'dead-worker-token',
      moduleClaimExpiresAt: new Date(now.getTime() - 1),
      candidateRuntimeModule: null,
      candidateModuleMetadata: null,
      candidateHash: null,
      sourceBindingsSnapshot: null,
    };
    const updateJob = vi.fn().mockResolvedValue({ count: 1 });
    const generate = vi.fn().mockResolvedValue({
      output: {
        runtimeModule: fixture.job.candidateRuntimeModule,
        moduleMetadata: fixture.job.candidateModuleMetadata,
      },
      normalizedResponseId: 'takeover-response', inputTokens: 1, outputTokens: 1, costMicros: null,
    });
    const updateAttempt = vi.fn().mockResolvedValue({ count: 1 });
    const db = {
      smartCoursewareGenerationJob: {
        updateMany: updateJob,
        findFirstOrThrow: vi.fn().mockResolvedValue({ ...interrupted, moduleAttemptGeneration: 3 }),
        findFirst: vi.fn().mockResolvedValue({ ...interrupted, state: 'COMPLETED' }),
      },
      smartCoursewareProviderAttempt: {
        updateMany: updateAttempt,
        create: vi.fn().mockResolvedValue({
          id: 'takeover-attempt', attemptNumber: 3,
          idempotencyKey: `smart-courseware-module:${interrupted.id}:3`,
        }),
      },
      $transaction: vi.fn(async (run: (tx: unknown) => unknown) => run({
        smartCoursewareGenerationJob: { updateMany: updateJob },
        smartCoursewareProviderAttempt: {
          create: vi.fn().mockResolvedValue({
            id: 'takeover-attempt', attemptNumber: 3,
            idempotencyKey: `smart-courseware-module:${interrupted.id}:3`,
          }),
          updateMany: updateAttempt,
        },
      })),
    };

    await generateCoursewareModuleCandidate(db as never, { actor, jobId: interrupted.id }, {
      ...moduleGenerationDependencies(fixture, generate), now: () => now, leaseMs: 10_000,
    });

    expect(updateJob.mock.calls[0][0].where.OR).toEqual([
      { state: 'QUEUED' },
      { state: 'RUNNING', moduleClaimExpiresAt: { lte: now } },
    ]);
    const takeoverToken = updateJob.mock.calls[0][0].data.moduleClaimToken;
    expect(takeoverToken).not.toBe('dead-worker-token');
    expect(updateAttempt.mock.calls[0][0]).toEqual({
      where: {
        generationJobId: interrupted.id,
        unitId: null,
        outcome: 'RUNNING',
        attemptNumber: { lt: 3 },
      },
      data: { outcome: 'RETRYABLE_FAILURE', finishedAt: now },
    });
    expect(updateJob).toHaveBeenLastCalledWith(expect.objectContaining({
      where: expect.objectContaining({ moduleAttemptGeneration: 3, moduleClaimToken: takeoverToken }),
    }));
  });

  it('prevents an old worker from completing or failing after a newer claim wins', async () => {
    const fixture = acceptanceFixture();
    const staleWorkerJob = {
      ...fixture.job,
      state: 'RUNNING',
      moduleAttemptGeneration: 4,
      candidateRuntimeModule: null,
      candidateModuleMetadata: null,
      candidateHash: null,
      sourceBindingsSnapshot: null,
    };
    let write = 0;
    const updateJob = vi.fn().mockImplementation(async () => ({ count: write++ === 0 ? 1 : 0 }));
    const generate = vi.fn().mockResolvedValue({
      output: {
        runtimeModule: fixture.job.candidateRuntimeModule,
        moduleMetadata: fixture.job.candidateModuleMetadata,
      },
      normalizedResponseId: 'stale-response', inputTokens: 1, outputTokens: 1, costMicros: null,
    });
    const updateAttempt = vi.fn().mockResolvedValue({ count: 1 });
    const db = {
      smartCoursewareGenerationJob: {
        updateMany: updateJob,
        findFirstOrThrow: vi.fn().mockResolvedValue(staleWorkerJob),
        findFirst: vi.fn().mockResolvedValue(staleWorkerJob),
      },
      smartCoursewareProviderAttempt: {
        updateMany: updateAttempt,
        create: vi.fn().mockResolvedValue({
          id: 'stale-attempt', attemptNumber: 4,
          idempotencyKey: `smart-courseware-module:${staleWorkerJob.id}:4`,
        }),
      },
      $transaction: vi.fn(async (run: (tx: unknown) => unknown) => run({
        smartCoursewareGenerationJob: { updateMany: updateJob },
        smartCoursewareProviderAttempt: {
          create: vi.fn().mockResolvedValue({
            id: 'stale-attempt', attemptNumber: 4,
            idempotencyKey: `smart-courseware-module:${staleWorkerJob.id}:4`,
          }),
          updateMany: updateAttempt,
        },
      })),
    };

    await expect(generateCoursewareModuleCandidate(db as never, { actor, jobId: staleWorkerJob.id },
      moduleGenerationDependencies(fixture, generate)))
      .rejects.toMatchObject({ code: 'courseware-module-job-claim-lost' });

    const staleToken = updateJob.mock.calls[0][0].data.moduleClaimToken;
    expect(updateJob.mock.calls[1][0].where).toEqual(expect.objectContaining({
      moduleAttemptGeneration: 4,
      moduleClaimToken: staleToken,
    }));
    expect(updateJob.mock.calls[2][0].where).toEqual(expect.objectContaining({
      state: 'RUNNING',
      moduleClaimToken: staleToken,
    }));
  });

  it('does not create or invoke an attempt when cancellation wins during provider preflight', async () => {
    const fixture = acceptanceFixture();
    const race = moduleGenerationRaceDb(fixture);
    const preflight = deferred<ReturnType<typeof providerRuntime>>();
    const reachedPreflight = deferred<void>();
    const generate = vi.fn();
    const running = generateCoursewareModuleCandidate(race.db as never, { actor, jobId: fixture.job.id }, {
      ...moduleGenerationDependencies(fixture, generate),
      now: race.now,
      resolveProvider: vi.fn(() => {
        reachedPreflight.resolve();
        return preflight.promise;
      }) as never,
    });

    await reachedPreflight.promise;
    race.cancel();
    preflight.resolve(providerRuntime(generate));

    await expect(running).rejects.toMatchObject({ code: 'courseware-module-job-claim-lost' });
    expect(race.createAttempt).not.toHaveBeenCalled();
    expect(generate).not.toHaveBeenCalled();
    expect(race.state.job.state).toBe('CANCELLED');
  });

  it('does not touch the new attempt when an expired lease is reclaimed during provider preflight', async () => {
    const fixture = acceptanceFixture();
    const race = moduleGenerationRaceDb(fixture);
    const preflightA = deferred<ReturnType<typeof providerRuntime>>();
    const reachedPreflightA = deferred<void>();
    const generateA = vi.fn();
    const runningA = generateCoursewareModuleCandidate(race.db as never, { actor, jobId: fixture.job.id }, {
      ...moduleGenerationDependencies(fixture, generateA),
      now: race.now,
      leaseMs: 10_000,
      resolveProvider: vi.fn(() => {
        reachedPreflightA.resolve();
        return preflightA.promise;
      }) as never,
    });
    await reachedPreflightA.promise;

    race.advance(10_001);
    const providerB = deferred<ProviderResult>();
    const reachedProviderB = deferred<void>();
    const generateB = vi.fn(() => {
      reachedProviderB.resolve();
      return providerB.promise;
    });
    const runningB = generateCoursewareModuleCandidate(race.db as never, { actor, jobId: fixture.job.id }, {
      ...moduleGenerationDependencies(fixture, generateB),
      now: race.now,
      leaseMs: 10_000,
      resolveProvider: vi.fn().mockResolvedValue(providerRuntime(generateB)) as never,
    });
    await reachedProviderB.promise;
    const newAttempt = race.state.attempts[0];
    expect(newAttempt).toMatchObject({ attemptNumber: 2, outcome: 'RUNNING' });

    preflightA.resolve(providerRuntime(generateA));
    await expect(runningA).rejects.toMatchObject({ code: 'courseware-module-job-claim-lost' });
    expect(generateA).not.toHaveBeenCalled();
    expect(race.state.attempts).toHaveLength(1);
    expect(newAttempt.outcome).toBe('RUNNING');

    providerB.resolve(providerResult(fixture));
    await expect(runningB).resolves.toMatchObject({ state: 'COMPLETED' });
    expect(newAttempt.outcome).toBe('SUCCEEDED');
  });

  it('does not overwrite a cancelled attempt when cancellation wins after provider invocation', async () => {
    const fixture = acceptanceFixture();
    const race = moduleGenerationRaceDb(fixture);
    const provider = deferred<ProviderResult>();
    const reachedProvider = deferred<void>();
    const generate = vi.fn(() => {
      reachedProvider.resolve();
      return provider.promise;
    });
    const running = generateCoursewareModuleCandidate(race.db as never, { actor, jobId: fixture.job.id }, {
      ...moduleGenerationDependencies(fixture, generate),
      now: race.now,
      resolveProvider: vi.fn().mockResolvedValue(providerRuntime(generate)) as never,
    });

    await reachedProvider.promise;
    const attempt = race.state.attempts[0];
    race.cancel();
    provider.resolve(providerResult(fixture));

    await expect(running).rejects.toMatchObject({ code: 'courseware-module-provider-attempt-lost' });
    expect(attempt.outcome).toBe('CANCELLED');
    expect(race.state.job.state).toBe('CANCELLED');
  });

  it('accepts an AI candidate over a teacher-created module with current and revision provider provenance', async () => {
    const fixture = acceptanceFixture();
    fixture.target.provenance = 'TEACHER_CREATED';
    (fixture.target as { originalAttemptId: string | null }).originalAttemptId = null;
    const db = acceptanceDb(fixture.job);

    await expect(acceptCoursewareModuleCandidate(db.value as never, {
      actor,
      jobId: fixture.job.id,
      expectedDraftVersion: fixture.job.draft.version,
      expectedModuleHash: fixture.target.contentHash,
      idempotencyKey: 'accept-module-1',
    })).resolves.toMatchObject({ id: fixture.job.id });

    const draftWrite = db.updateDraft.mock.calls[0][0].data;
    const next = draftWrite.runtimeManifest as GeneratedSlideManifest;
    expect(withoutTarget(next, fixture.job.targetModuleId)).toEqual(withoutTarget(
      fixture.job.draft.runtimeManifest as GeneratedSlideManifest,
      fixture.job.targetModuleId,
    ));
    expect(findModule(next, fixture.job.targetModuleId)?.payload).toEqual({
      prompt: '重新生成后的单选题',
      options: [{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }],
    });
    expect(db.updateModule).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ contentHash: fixture.target.contentHash }),
      data: expect.objectContaining({
        provenance: 'AI_GENERATED',
        originalAttemptId: fixture.job.providerAttempt.id,
        currentRevisionNumber: 2,
      }),
    }));
    expect(db.createRevision).toHaveBeenCalledWith({ data: expect.objectContaining({
      moduleRecordId: fixture.target.id,
      revisionNumber: 2,
      changeKind: 'REGENERATE_ACCEPT',
      provenance: 'AI_GENERATED',
      generationJobId: fixture.job.id,
      providerAttemptId: fixture.job.providerAttempt.id,
      candidateHash: fixture.job.candidateHash,
      candidateDiffId: `${fixture.job.id}:${fixture.job.candidateHash}`,
      acceptedCommandId: expect.any(String),
      originalAttemptIdSnapshot: fixture.job.providerAttempt.id,
      actorId: actor.id,
    }) });
    expect(db.createCommand).toHaveBeenCalledWith({ data: expect.objectContaining({
      id: expect.any(String), action: 'MODULE_ACCEPT', jobId: fixture.job.id,
    }) });
  });

  it('rejects candidate acceptance after whole-course approval', async () => {
    const fixture = acceptanceFixture();
    (fixture.job.draft as { state: string }).state = 'ACCEPTED';
    const db = acceptanceDb(fixture.job);
    await expect(acceptCoursewareModuleCandidate(db.value as never, {
      actor,
      jobId: fixture.job.id,
      expectedDraftVersion: fixture.job.draft.version,
      expectedModuleHash: fixture.target.contentHash,
      idempotencyKey: 'accept-after-approval',
    })).rejects.toMatchObject({ code: 'accepted-courseware-immutable' });
    expect(db.updateDraft).not.toHaveBeenCalled();
    expect(db.updateModule).not.toHaveBeenCalled();
  });

  it('rejects a malicious candidate that targets a sibling module', async () => {
    const fixture = acceptanceFixture();
    fixture.job.candidateRuntimeModule.id = 'module-4';
    fixture.job.candidateModuleMetadata.moduleId = 'module-4';
    fixture.job.candidateHash = contentHash({
      runtimeModule: fixture.job.candidateRuntimeModule,
      moduleMetadata: fixture.job.candidateModuleMetadata,
    });
    const db = acceptanceDb(fixture.job);

    await expect(acceptCoursewareModuleCandidate(db.value as never, {
      actor, jobId: fixture.job.id, expectedDraftVersion: fixture.job.draft.version,
      expectedModuleHash: fixture.target.contentHash, idempotencyKey: 'accept-module-2',
    })).rejects.toMatchObject({ code: 'courseware-module-candidate-target-changed' });
    expect(db.updateDraft).not.toHaveBeenCalled();
    expect(db.updateModule).not.toHaveBeenCalled();
  });

  it('rejects stale draft versions and stale module hashes before any mutation', async () => {
    const fixture = acceptanceFixture();
    const staleVersionDb = acceptanceDb(fixture.job);
    await expect(acceptCoursewareModuleCandidate(staleVersionDb.value as never, {
      actor, jobId: fixture.job.id, expectedDraftVersion: fixture.job.draft.version - 1,
      expectedModuleHash: fixture.target.contentHash, idempotencyKey: 'accept-module-3',
    })).rejects.toMatchObject({ code: 'courseware-version-conflict' });
    expect(staleVersionDb.updateJob).not.toHaveBeenCalled();

    const staleHashDb = acceptanceDb(fixture.job);
    await expect(acceptCoursewareModuleCandidate(staleHashDb.value as never, {
      actor, jobId: fixture.job.id, expectedDraftVersion: fixture.job.draft.version,
      expectedModuleHash: 'f'.repeat(64), idempotencyKey: 'accept-module-4',
    })).rejects.toMatchObject({ code: 'courseware-module-hash-conflict' });
    expect(staleHashDb.updateJob).not.toHaveBeenCalled();
    expect(staleHashDb.updateDraft).not.toHaveBeenCalled();
  });

  it('aborts the transaction without revision or command evidence when the module CAS loses', async () => {
    const fixture = acceptanceFixture();
    const db = acceptanceDb(fixture.job, { moduleClaimCount: 0 });

    await expect(acceptCoursewareModuleCandidate(db.value as never, {
      actor, jobId: fixture.job.id, expectedDraftVersion: fixture.job.draft.version,
      expectedModuleHash: fixture.target.contentHash, idempotencyKey: 'accept-module-5',
    })).rejects.toMatchObject({ code: 'courseware-module-hash-conflict' });
    expect(db.createRevision).not.toHaveBeenCalled();
    expect(db.createCommand).not.toHaveBeenCalled();
  });

  it('records a retryable provider failure on both the job summary and the independent attempt', async () => {
    const fixture = acceptanceFixture();
    const job = {
      ...fixture.job,
      state: 'RUNNING',
      moduleAttemptGeneration: 2,
      candidateRuntimeModule: null,
      candidateModuleMetadata: null,
      candidateHash: null,
      sourceBindingsSnapshot: null,
    };
    const updateJob = vi.fn().mockResolvedValue({ count: 1 });
    const updateAttempt = vi.fn().mockResolvedValue({ count: 1 });
    const providerError = new Error('provider unavailable');
    const db = {
      smartCoursewareGenerationJob: {
        updateMany: updateJob,
        findFirstOrThrow: vi.fn().mockResolvedValue(job),
      },
      smartCoursewareProviderAttempt: {
        updateMany: updateAttempt,
        create: vi.fn().mockResolvedValue({
          id: 'failed-attempt', attemptNumber: 2,
          idempotencyKey: `smart-courseware-module:${job.id}:2`,
        }),
      },
      $transaction: vi.fn(async (run: (tx: unknown) => unknown) => run({
        smartCoursewareGenerationJob: { updateMany: updateJob },
        smartCoursewareProviderAttempt: {
          create: vi.fn().mockResolvedValue({
            id: 'failed-attempt', attemptNumber: 2,
            idempotencyKey: `smart-courseware-module:${job.id}:2`,
          }),
          updateMany: updateAttempt,
        },
      })),
    };

    await expect(generateCoursewareModuleCandidate(db as never, { actor, jobId: job.id },
      moduleGenerationDependencies(fixture, vi.fn().mockRejectedValue(providerError))))
      .rejects.toBe(providerError);

    expect(updateJob).toHaveBeenLastCalledWith(expect.objectContaining({ data: expect.objectContaining({
      state: 'RETRYABLE',
      failureCode: 'courseware-module-provider-failed',
      providerAudit: { latestAttemptId: 'failed-attempt', outcome: 'RETRYABLE_FAILURE' },
    }) }));
    expect(updateAttempt).toHaveBeenLastCalledWith({
      where: { id: 'failed-attempt', generationJobId: job.id, outcome: 'RUNNING' },
      data: { outcome: 'RETRYABLE_FAILURE', finishedAt: expect.any(Date) },
    });
  });
});

function acceptanceFixture() {
  const composition = validCompositionInput();
  const planContent = validPlanFixture();
  const planRevision = {
    id: 'plan-1', revisionNumber: 1, content: planContent, contentHash: contentHash(planContent),
  };
  const modules = composition.runtimeManifest.stages.flatMap((stage) => stage.steps.flatMap((step) => step.modules)).map((module, index) => ({
    id: `stored-${module.id}`,
    ownerId: actor.id,
    draftId: 'draft-1',
    runtimeModuleId: module.id,
    moduleInstanceLineage: `lineage-${module.id}`,
    contentHash: contentHash(module),
    sourceState: 'VERIFIED',
    sourceBindings: [sourceBindingFixture],
    sourceBindingSetHash: contentHash([sourceBindingFixture]),
    gapIdentity: null,
    provenance: 'AI_GENERATED',
    originalAttemptId: `attempt-${index + 1}`,
    teacherMetadata: composition.moduleMetadata[index].teacherFields,
    currentRevisionNumber: 1,
    deletedAt: null,
  }));
  const target = modules[2];
  const original = findModule(composition.runtimeManifest, target.runtimeModuleId)!;
  const candidateRuntimeModule = {
    ...original,
    payload: {
      prompt: '重新生成后的单选题',
      options: [{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }],
    },
  };
  const candidateModuleMetadata = {
    ...composition.moduleMetadata[2],
    teacherFields: {
      referenceAnswer: 'a',
      explanation: '基于权威来源形成的新解释。',
      scoring: { strategy: 'exact-match', maxPoints: 1 },
      inclusionRationale: '该权威来源直接支撑重新生成的单选题。',
    },
  };
  const draft = {
    id: 'draft-1', ownerId: actor.id, planRevisionId: planRevision.id, planRevisionNumber: 1,
    planContentHash: planRevision.contentHash, authoringLineageRoot: 'draft-lineage', state: 'READY', version: 2,
    runtimeManifest: composition.runtimeManifest, contentHash: coursewareManifestHash(composition.runtimeManifest), modules, planRevision,
  };
  const candidate = { runtimeModule: candidateRuntimeModule, moduleMetadata: candidateModuleMetadata };
  const job = {
    id: 'module-job-1', ownerId: actor.id, draftId: draft.id, mode: 'MODULE', state: 'COMPLETED',
    targetModuleId: target.runtimeModuleId, targetModuleHash: target.contentHash,
    planRevisionId: draft.planRevisionId, planContentHash: draft.planContentHash,
    sourceBindingsSnapshot: [sourceBindingFixture], candidateRuntimeModule, candidateModuleMetadata,
    candidateHash: contentHash(candidate), acceptedAt: null, draft, moduleAttemptGeneration: 1,
    providerAttempt: { id: 'module-provider-attempt-1', attemptNumber: 1, outcome: 'SUCCEEDED' },
  };
  return { job, target };
}

function acceptanceDb(job: ReturnType<typeof acceptanceFixture>['job'], options: { moduleClaimCount?: number } = {}) {
  const updateJob = vi.fn().mockResolvedValue({ count: 1 });
  const updateDraft = vi.fn().mockResolvedValue({ count: 1 });
  const updateModule = vi.fn().mockResolvedValue({ count: options.moduleClaimCount ?? 1 });
  const createRevision = vi.fn().mockResolvedValue({});
  const createCommand = vi.fn().mockResolvedValue({});
  const findJob = vi.fn().mockResolvedValue(job);
  const value = {
    smartCoursewareGenerationCommand: { findFirst: vi.fn().mockResolvedValue(null) },
    smartCoursewareGenerationJob: { findFirst: findJob },
    $transaction: vi.fn(async (run: (tx: unknown) => unknown) => run({
      smartCoursewareGenerationJob: { findFirst: vi.fn().mockResolvedValue(job), updateMany: updateJob },
      smartCoursewareDraft: { updateMany: updateDraft },
      smartCoursewareModule: { updateMany: updateModule },
      smartCoursewareModuleRevision: { create: createRevision },
      smartCoursewareProviderAttempt: { findFirst: vi.fn().mockResolvedValue(job.providerAttempt) },
      smartCoursewareGenerationCommand: { create: createCommand },
    })),
  };
  return { value, updateJob, updateDraft, updateModule, createRevision, createCommand };
}

function moduleGenerationDependencies(
  fixture: ReturnType<typeof acceptanceFixture>,
  generate: ReturnType<typeof vi.fn>,
) {
  return {
    buildSar: vi.fn().mockResolvedValue({ selectedVersionIds: [sourceBindingFixture.sourceVersionId] }) as never,
    buildSourcePack: vi.fn().mockResolvedValue({ retrieval: { pack: { items: [{
      citationTargetId: sourceBindingFixture.citationId,
      metadata: {
        versionId: sourceBindingFixture.sourceVersionId,
        stableAnchor: sourceBindingFixture.anchor,
        contentHash: sourceBindingFixture.contentHash,
      },
    }] } } }) as never,
    resolveProvider: vi.fn().mockResolvedValue({
      serviceId: 'service-1', providerKind: 'fixture', model: 'model-1', generate,
      fixture: fixture.job.id,
    }) as never,
  };
}

type LooseRecord = Record<string, any>;
type ProviderResult = ReturnType<typeof providerResult>;

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

function providerRuntime(generate: ReturnType<typeof vi.fn>) {
  return { serviceId: 'service-1', providerKind: 'fixture', model: 'model-1', generate };
}

function providerResult(fixture: ReturnType<typeof acceptanceFixture>) {
  return {
    output: {
      runtimeModule: fixture.job.candidateRuntimeModule,
      moduleMetadata: fixture.job.candidateModuleMetadata,
    },
    normalizedResponseId: 'interleaved-response',
    inputTokens: 1,
    outputTokens: 1,
    costMicros: null,
  };
}

function moduleGenerationRaceDb(fixture: ReturnType<typeof acceptanceFixture>) {
  let clock = new Date('2026-07-19T12:00:00Z');
  const state = {
    job: {
      ...fixture.job,
      state: 'QUEUED',
      moduleAttemptGeneration: 0,
      moduleClaimToken: null as string | null,
      moduleClaimExpiresAt: null as Date | null,
      candidateRuntimeModule: null,
      candidateModuleMetadata: null,
      candidateHash: null,
      sourceBindingsSnapshot: null,
    },
    attempts: [] as LooseRecord[],
  };

  function matchesJob(where: LooseRecord) {
    const job = state.job;
    if (where.id !== undefined && where.id !== job.id) return false;
    if (where.ownerId !== undefined && where.ownerId !== job.ownerId) return false;
    if (where.mode !== undefined && where.mode !== job.mode) return false;
    if (where.state !== undefined && where.state !== job.state) return false;
    if (where.targetModuleHash !== undefined && where.targetModuleHash !== job.targetModuleHash) return false;
    if (where.moduleAttemptGeneration !== undefined && where.moduleAttemptGeneration !== job.moduleAttemptGeneration) return false;
    if (where.moduleClaimToken !== undefined && where.moduleClaimToken !== job.moduleClaimToken) return false;
    if (where.moduleClaimExpiresAt?.gt && (!job.moduleClaimExpiresAt || job.moduleClaimExpiresAt <= where.moduleClaimExpiresAt.gt)) return false;
    if (where.OR) {
      const queued = where.OR.some((branch: LooseRecord) => branch.state === 'QUEUED' && job.state === 'QUEUED');
      const expired = where.OR.some((branch: LooseRecord) => branch.state === 'RUNNING'
        && job.state === 'RUNNING'
        && job.moduleClaimExpiresAt
        && job.moduleClaimExpiresAt <= branch.moduleClaimExpiresAt.lte);
      if (!queued && !expired) return false;
    }
    return true;
  }

  const updateJob = vi.fn(async ({ where, data }: LooseRecord) => {
    if (!matchesJob(where)) return { count: 0 };
    if (data.moduleAttemptGeneration?.increment) {
      state.job.moduleAttemptGeneration += data.moduleAttemptGeneration.increment;
    }
    for (const [key, value] of Object.entries(data)) {
      if (key !== 'moduleAttemptGeneration') (state.job as LooseRecord)[key] = value;
    }
    return { count: 1 };
  });

  function matchesAttempt(attempt: LooseRecord, where: LooseRecord) {
    if (where.id !== undefined && where.id !== attempt.id) return false;
    if (where.generationJobId !== undefined && where.generationJobId !== attempt.generationJobId) return false;
    if (where.unitId !== undefined && where.unitId !== attempt.unitId) return false;
    if (where.outcome !== undefined && where.outcome !== attempt.outcome) return false;
    if (where.attemptNumber?.lt !== undefined && !(attempt.attemptNumber < where.attemptNumber.lt)) return false;
    return true;
  }

  const updateAttempt = vi.fn(async ({ where, data }: LooseRecord) => {
    let count = 0;
    for (const attempt of state.attempts) {
      if (!matchesAttempt(attempt, where)) continue;
      Object.assign(attempt, data);
      count += 1;
    }
    return { count };
  });
  const createAttempt = vi.fn(async ({ data }: LooseRecord) => {
    const attempt = { id: `attempt-${data.attemptNumber}`, outcome: 'RUNNING', ...data };
    state.attempts.push(attempt);
    return attempt;
  });
  const jobApi = {
    updateMany: updateJob,
    findFirstOrThrow: vi.fn(async ({ where }: LooseRecord) => {
      if (!matchesJob(where)) throw new Error('job not found');
      return state.job;
    }),
    findFirst: vi.fn(async ({ where }: LooseRecord) => matchesJob(where) ? state.job : null),
  };
  const attemptApi = { updateMany: updateAttempt, create: createAttempt };
  const db = {
    smartCoursewareGenerationJob: jobApi,
    smartCoursewareProviderAttempt: attemptApi,
    $transaction: vi.fn(async (run: (tx: unknown) => unknown) => run({
      smartCoursewareGenerationJob: jobApi,
      smartCoursewareProviderAttempt: attemptApi,
    })),
  };

  return {
    db,
    state,
    createAttempt,
    now: () => clock,
    advance: (milliseconds: number) => { clock = new Date(clock.getTime() + milliseconds); },
    cancel: () => {
      state.job.state = 'CANCELLED';
      state.job.moduleClaimToken = null;
      state.job.moduleClaimExpiresAt = null;
      for (const attempt of state.attempts) {
        if (attempt.outcome === 'RUNNING') attempt.outcome = 'CANCELLED';
      }
    },
  };
}

function findModule(manifest: GeneratedSlideManifest, moduleId: string) {
  return manifest.stages.flatMap((stage) => stage.steps.flatMap((step) => step.modules))
    .find((module) => module.id === moduleId);
}

function withoutTarget(manifest: GeneratedSlideManifest, moduleId: string) {
  return manifest.stages.map((stage) => ({
    stage: stage.stage,
    durationSeconds: stage.durationSeconds,
    steps: stage.steps.map((step) => ({
      id: step.id,
      title: step.title,
      durationSeconds: step.durationSeconds,
      modules: step.modules.filter((module) => module.id !== moduleId),
    })),
  }));
}
