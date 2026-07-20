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
import { deriveCoursewareModuleMetadata } from '../domain';
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
      unitKey: 'bridge-in', durationSeconds: 300, approvedPlan: plan, sourceBinding: sourceBindingFixture,
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
      schemaVersion: 'smart-courseware-stage-bridge-in.v2',
      request: expect.objectContaining({
        authoritativeSourceBindings: [sourceBindingFixture],
        approvedPlanAlignment: output.approvedPlanAlignment,
        approvedStepExpectations: output.stepPlanBindings.map(({ generatedStepId: _stepId, ...expectation }) => expectation),
      }),
    }));
    expect(runtime.generate).toHaveBeenCalledWith(expect.objectContaining({
      schemaVersion: 'smart-courseware-stage-bridge-in.v2',
      system: expect.stringContaining('approvedPlanAlignment'),
      prompt: expect.stringContaining(JSON.stringify(output.approvedPlanAlignment)),
    }));
    expect(runtime.generate.mock.calls[0][0].prompt).toContain(JSON.stringify(
      output.stepPlanBindings.map(({ generatedStepId: _stepId, ...expectation }) => expectation),
    ));
    expect(mocks.completeUnit).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      unitKey: 'bridge-in', output,
    }));
    expect(mocks.failUnit).not.toHaveBeenCalled();
  });

  it('generates source-pending output when the approved plan has no verified source bindings', async () => {
    const plan = validPlanFixture();
    plan.sources = [];
    Object.assign(plan.knowledgePoints[0], {
      sourceState: 'AI_GENERATED_SOURCE_PENDING', sourceBindings: [],
      gapIdentity: `smart-knowledge-gap:${'c'.repeat(64)}`,
    });
    const context = {
      id: 'job-pending', ownerId: 'teacher-1', draftId: 'draft-pending', state: 'QUEUED', firstIncompleteUnitKey: 'bridge-in',
      deliveryGeneration: 1,
      draft: { id: 'draft-pending', planRevision: { content: plan } },
      units: [{ id: 'unit-pending', unitKey: 'bridge-in', state: 'PENDING', output: null, orderIndex: 0, attemptGeneration: 0 }],
    };
    const db = { smartCoursewareGenerationJob: { findUnique: vi.fn().mockResolvedValue(context) } };
    mocks.beginAttempt.mockResolvedValue({
      claimed: true, claimToken: 'claim-pending', attempt: { id: 'attempt-pending', idempotencyKey: 'attempt-pending-key' },
    });
    mocks.completeUnit.mockResolvedValue({ state: 'COMPLETED' });
    const output = createDeterministicCoursewareStage({
      unitKey: 'bridge-in', durationSeconds: 300, approvedPlan: plan,
    });
    const runtime = {
      serviceId: 'fixture-service', providerKind: 'fixture', model: 'fixture-model',
      generate: vi.fn().mockResolvedValue({
        output, normalizedResponseId: 'pending-response', inputTokens: 0, outputTokens: 0, costMicros: null,
      }),
    };

    await expect(processCoursewareGenerationJob(db as never, context.id, async () => runtime as never))
      .resolves.toEqual({ jobId: context.id, state: 'COMPLETED' });
    expect(mocks.buildSar).not.toHaveBeenCalled();
    expect(mocks.buildSourcePack).not.toHaveBeenCalled();
    expect(mocks.beginAttempt).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      request: expect.objectContaining({ authoritativeSourceBindings: [] }),
    }));
    expect(output.moduleMetadata).toEqual(expect.arrayContaining([expect.objectContaining({
      sourceState: 'ai_generated_source_pending', sourceBindings: [],
    })]));
    const pending = deriveCoursewareModuleMetadata({
      authoringLineageRoot: 'lineage-pending',
      runtimeModule: output.stage.steps[0].modules[0],
      requested: output.moduleMetadata[0],
      allowedSourceBindings: [],
      newProvenance: 'ai_generated',
      originalAttemptId: 'attempt-pending',
    });
    expect(pending.gapIdentity).toMatch(/^courseware-gap:/);
    expect(mocks.failUnit).not.toHaveBeenCalled();
  });

  it('rejects provider-claimed verified output with no binding when the server allowlist is empty', async () => {
    const plan = validPlanFixture();
    plan.sources = [];
    Object.assign(plan.knowledgePoints[0], {
      sourceState: 'AI_GENERATED_SOURCE_PENDING', sourceBindings: [],
      gapIdentity: `smart-knowledge-gap:${'d'.repeat(64)}`,
    });
    const context = {
      id: 'job-false-verified', ownerId: 'teacher-1', draftId: 'draft-false-verified', state: 'QUEUED', firstIncompleteUnitKey: 'bridge-in',
      deliveryGeneration: 1,
      draft: { id: 'draft-false-verified', planRevision: { content: plan } },
      units: [{ id: 'unit-false-verified', unitKey: 'bridge-in', state: 'PENDING', output: null, orderIndex: 0, attemptGeneration: 0 }],
    };
    const db = { smartCoursewareGenerationJob: { findUnique: vi.fn().mockResolvedValue(context) } };
    mocks.beginAttempt.mockResolvedValue({
      claimed: true, claimToken: 'claim-false-verified',
      attempt: { id: 'attempt-false-verified', idempotencyKey: 'attempt-false-verified-key' },
    });
    mocks.failUnit.mockResolvedValue({ state: 'FAILED' });
    const output = createDeterministicCoursewareStage({
      unitKey: 'bridge-in', durationSeconds: 300, approvedPlan: plan,
    });
    output.moduleMetadata.forEach((metadata) => {
      metadata.sourceState = 'verified';
      metadata.sourceBindings = [];
      metadata.teacherFields.inclusionRationale = '伪造的已验证声明';
    });
    const runtime = {
      serviceId: 'fixture-service', providerKind: 'fixture', model: 'fixture-model',
      generate: vi.fn().mockResolvedValue({
        output, normalizedResponseId: 'false-verified-response', inputTokens: 0, outputTokens: 0, costMicros: null,
      }),
    };

    await expect(processCoursewareGenerationJob(db as never, context.id, async () => runtime as never))
      .rejects.toMatchObject({ code: 'verified-source-binding-required', status: 409 });
    expect(mocks.buildSar).not.toHaveBeenCalled();
    expect(mocks.buildSourcePack).not.toHaveBeenCalled();
    expect(mocks.completeUnit).not.toHaveBeenCalled();
    expect(mocks.failUnit).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      jobId: context.id, unitKey: 'bridge-in', failureCode: 'verified-source-binding-required', retryable: false,
    }));
  });

  it.each([
    ['an unrelated goal id', (output: ReturnType<typeof createDeterministicCoursewareStage>) => {
      output.approvedPlanAlignment.goalIds.push('goal-unrelated');
    }, 'generated-courseware-plan-alignment-changed'],
    ['a mutated goal set hash', (output: ReturnType<typeof createDeterministicCoursewareStage>) => {
      output.approvedPlanAlignment.goalSetHash = 'b'.repeat(64);
    }, 'generated-courseware-plan-alignment-changed'],
    ['a mutated stage content hash', (output: ReturnType<typeof createDeterministicCoursewareStage>) => {
      output.approvedPlanAlignment.stageContentHash = 'c'.repeat(64);
    }, 'generated-courseware-plan-alignment-changed'],
    ['a changed approved outline title', (output: ReturnType<typeof createDeterministicCoursewareStage>) => {
      output.approvedPlanAlignment.stageOutlineTitles = ['未批准的标题'];
    }, 'generated-courseware-plan-alignment-changed'],
    ['an omitted goal id', (output: ReturnType<typeof createDeterministicCoursewareStage>) => {
      output.approvedPlanAlignment.goalIds = [];
    }, 'generated-courseware-schema-invalid'],
    ['a mutated actual step title', (output: ReturnType<typeof createDeterministicCoursewareStage>) => {
      output.stage.steps[0].title = '未批准的标题';
    }, 'generated-courseware-step-plan-binding-changed'],
    ['a mutated actual step identity', (output: ReturnType<typeof createDeterministicCoursewareStage>) => {
      output.stage.steps[0].id = 'generated-step-mutated';
    }, 'generated-courseware-step-plan-binding-changed'],
    ['an additional actual step', (output: ReturnType<typeof createDeterministicCoursewareStage>) => {
      const step = structuredClone(output.stage.steps[0]);
      step.id = `${step.id}-extra`;
      step.modules[0].id = `${step.modules[0].id}-extra`;
      if (step.modules[0].evidencePath) step.modules[0].evidencePath = `${step.modules[0].evidencePath}-extra`;
      output.stage.steps.push(step);
      output.moduleMetadata.push({ ...structuredClone(output.moduleMetadata[0]), moduleId: step.modules[0].id });
    }, 'generated-courseware-step-plan-binding-changed'],
    ['a mutated step goal binding', (output: ReturnType<typeof createDeterministicCoursewareStage>) => {
      output.stepPlanBindings[0].goalIds = ['goal-unrelated'];
    }, 'generated-courseware-step-plan-binding-changed'],
  ])('rejects provider output with %s before unit completion', async (_label, mutate, failureCode) => {
    const plan = validPlanFixture();
    const context = {
      id: 'job-plan-alignment', ownerId: 'teacher-1', draftId: 'draft-1', state: 'QUEUED', firstIncompleteUnitKey: 'bridge-in',
      deliveryGeneration: 1,
      draft: { id: 'draft-1', planRevision: { content: plan } },
      units: [{ id: 'unit-1', unitKey: 'bridge-in', state: 'PENDING', output: null, orderIndex: 0, attemptGeneration: 0 }],
    };
    const db = { smartCoursewareGenerationJob: { findUnique: vi.fn().mockResolvedValue(context) } };
    mocks.buildSar.mockResolvedValue({ selectedVersionIds: [sourceBindingFixture.sourceVersionId] });
    mocks.buildSourcePack.mockResolvedValue({ retrieval: { pack: { items: [{
      citationTargetId: sourceBindingFixture.citationId,
      metadata: {
        versionId: sourceBindingFixture.sourceVersionId,
        stableAnchor: sourceBindingFixture.anchor,
        contentHash: sourceBindingFixture.contentHash,
      },
    }] } } });
    mocks.beginAttempt.mockResolvedValue({
      claimed: true, claimToken: 'claim-alignment', attempt: { id: 'attempt-alignment', idempotencyKey: 'attempt-alignment-key' },
    });
    mocks.failUnit.mockResolvedValue({ state: 'FAILED' });
    const output = createDeterministicCoursewareStage({
      unitKey: 'bridge-in', durationSeconds: 300, approvedPlan: plan, sourceBinding: sourceBindingFixture,
    });
    mutate(output);
    const runtime = {
      serviceId: 'fixture-service', providerKind: 'fixture', model: 'fixture-model',
      generate: vi.fn().mockResolvedValue({
        output, normalizedResponseId: 'fixture-response', inputTokens: 0, outputTokens: 0, costMicros: null,
      }),
    };

    await expect(processCoursewareGenerationJob(db as never, context.id, async () => runtime as never)).rejects.toBeDefined();
    expect(mocks.completeUnit).not.toHaveBeenCalled();
    expect(mocks.failUnit).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      failureCode, retryable: false,
    }));
  });

  it('assembles a summary after resuming with persisted v1 completed units', async () => {
    const plan = validPlanFixture();
    const completedUnitKeys = [
      'bridge-in', 'objective', 'pre-assessment', 'participatory-learning', 'post-assessment',
    ] as const;
    const units = completedUnitKeys.map((unitKey, orderIndex) => {
      const { approvedPlanAlignment: _legacyAlignment, stepPlanBindings: _legacyBindings, ...output } = createDeterministicCoursewareStage({
        unitKey, durationSeconds: 300, approvedPlan: plan, sourceBinding: sourceBindingFixture,
      });
      return {
        id: `unit-${orderIndex}`, unitKey, state: 'COMPLETED', output, orderIndex, attemptGeneration: 1,
        attempts: [{ outcome: 'SUCCEEDED', schemaVersion: `smart-courseware-stage-${unitKey}.v1` }],
      };
    });
    const context = {
      id: 'job-v1-resume', ownerId: 'teacher-1', draftId: 'draft-1', state: 'QUEUED', firstIncompleteUnitKey: 'summary',
      deliveryGeneration: 2,
      draft: { id: 'draft-1', planRevision: { content: plan } },
      units: [...units, { id: 'unit-5', unitKey: 'summary', state: 'PENDING', output: null, orderIndex: 5, attemptGeneration: 0 }],
    };
    const db = { smartCoursewareGenerationJob: { findUnique: vi.fn().mockResolvedValue(context) } };
    mocks.buildSar.mockResolvedValue({ selectedVersionIds: [sourceBindingFixture.sourceVersionId] });
    mocks.buildSourcePack.mockResolvedValue({ retrieval: { pack: { items: [{
      citationTargetId: sourceBindingFixture.citationId,
      metadata: {
        versionId: sourceBindingFixture.sourceVersionId,
        stableAnchor: sourceBindingFixture.anchor,
        contentHash: sourceBindingFixture.contentHash,
      },
    }] } } });
    mocks.beginAttempt.mockResolvedValue({
      claimed: true, claimToken: 'claim-summary', attempt: { id: 'attempt-summary', idempotencyKey: 'attempt-summary-key' },
    });
    mocks.completeUnit.mockResolvedValue({ state: 'COMPLETED' });
    const summaryOutput = createDeterministicCoursewareStage({
      unitKey: 'summary', durationSeconds: 300, approvedPlan: plan, sourceBinding: sourceBindingFixture,
    });
    const runtime = {
      serviceId: 'fixture-service', providerKind: 'fixture', model: 'fixture-model',
      generate: vi.fn().mockResolvedValue({
        output: summaryOutput, normalizedResponseId: 'fixture-response', inputTokens: 0, outputTokens: 0, costMicros: null,
      }),
    };

    await expect(processCoursewareGenerationJob(db as never, context.id, async () => runtime as never))
      .resolves.toEqual({ jobId: context.id, state: 'COMPLETED' });
    expect(mocks.completeUnit).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      unitKey: 'summary',
      completedManifest: expect.objectContaining({ stages: expect.arrayContaining([
        expect.objectContaining({ stage: 'bridge-in' }),
        expect.objectContaining({ stage: 'summary' }),
      ]) }),
    }));
  });

  it('rejects an unauthorized persisted unit before beginning or invoking the next provider attempt', async () => {
    const plan = validPlanFixture();
    const { approvedPlanAlignment: _alignment, stepPlanBindings: _bindings, ...legacyOutput } = createDeterministicCoursewareStage({
      unitKey: 'bridge-in', durationSeconds: 300, approvedPlan: plan, sourceBinding: sourceBindingFixture,
    });
    const context = {
      id: 'job-invalid-resume', ownerId: 'teacher-1', draftId: 'draft-1', state: 'QUEUED', firstIncompleteUnitKey: 'objective',
      deliveryGeneration: 2,
      draft: { id: 'draft-1', planRevision: { content: plan } },
      units: [
        {
          id: 'unit-0', unitKey: 'bridge-in', state: 'COMPLETED', output: legacyOutput, orderIndex: 0, attemptGeneration: 1,
          attempts: [{ outcome: 'SUCCEEDED', schemaVersion: 'smart-courseware-stage-bridge-in.v2' }],
        },
        { id: 'unit-1', unitKey: 'objective', state: 'PENDING', output: null, orderIndex: 1, attemptGeneration: 0, attempts: [] },
      ],
    };
    mocks.buildSar.mockResolvedValue({ selectedVersionIds: [sourceBindingFixture.sourceVersionId] });
    mocks.buildSourcePack.mockResolvedValue({ retrieval: { pack: { items: [{
      citationTargetId: sourceBindingFixture.citationId,
      metadata: {
        versionId: sourceBindingFixture.sourceVersionId,
        stableAnchor: sourceBindingFixture.anchor,
        contentHash: sourceBindingFixture.contentHash,
      },
    }] } } });
    const updateJob = vi.fn().mockResolvedValue({ count: 1 });
    const db = {
      smartCoursewareGenerationJob: { findUnique: vi.fn().mockResolvedValue(context) },
      $transaction: vi.fn(async (run: (tx: unknown) => unknown) => run({
        smartCoursewareGenerationJob: { updateMany: updateJob },
        smartCoursewareGenerationUnit: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
      })),
    };
    const runtime = {
      serviceId: 'fixture-service', providerKind: 'fixture', model: 'fixture-model', generate: vi.fn(),
    };

    await expect(processCoursewareGenerationJob(db as never, context.id, async () => runtime as never))
      .resolves.toEqual({ jobId: context.id, state: 'FAILED' });
    expect(updateJob).toHaveBeenCalledWith(expect.objectContaining({
      data: { state: 'FAILED', failureCode: 'generated-courseware-schema-invalid' },
    }));
    expect(mocks.beginAttempt).not.toHaveBeenCalled();
    expect(runtime.generate).not.toHaveBeenCalled();
  });

  it('rejects an initial provider unit that mislabels AI output as teacher-created pending', async () => {
    const plan = validPlanFixture();
    const context = {
      id: 'job-invalid-source-state', ownerId: 'teacher-1', draftId: 'draft-1', state: 'QUEUED', firstIncompleteUnitKey: 'bridge-in',
      deliveryGeneration: 1,
      draft: { id: 'draft-1', planRevision: { content: plan } },
      units: [{ id: 'unit-1', unitKey: 'bridge-in', state: 'PENDING', output: null, orderIndex: 0, attemptGeneration: 0 }],
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
    mocks.beginAttempt.mockResolvedValue({
      claimed: true, claimToken: 'claim-invalid', attempt: { id: 'attempt-invalid', idempotencyKey: 'attempt-invalid-key' },
    });
    mocks.failUnit.mockResolvedValue({ state: 'FAILED' });
    const output = createDeterministicCoursewareStage({
      unitKey: 'bridge-in', durationSeconds: 300, approvedPlan: plan, sourceBinding: sourceBindingFixture,
    });
    output.moduleMetadata[0].sourceState = 'teacher_created_source_pending';
    const runtime = {
      serviceId: 'fixture-service', providerKind: 'fixture', model: 'fixture-model',
      generate: vi.fn().mockResolvedValue({
        output, normalizedResponseId: 'fixture-response', inputTokens: 0, outputTokens: 0, costMicros: null,
      }),
    };

    await expect(processCoursewareGenerationJob(db as never, context.id, async () => runtime as never))
      .rejects.toMatchObject({ code: 'ai-generated-courseware-source-state-invalid' });
    expect(mocks.completeUnit).not.toHaveBeenCalled();
    expect(mocks.failUnit).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      failureCode: 'ai-generated-courseware-source-state-invalid',
      retryable: false,
    }));
  });

  it('rejects an invalid early-stage layout before completion and accepts a corrected retry', async () => {
    const plan = validPlanFixture();
    const pending = {
      id: 'job-layout', ownerId: 'teacher-1', draftId: 'draft-1', state: 'QUEUED', firstIncompleteUnitKey: 'bridge-in', deliveryGeneration: 1,
      draft: { id: 'draft-1', planRevision: { content: plan } },
      units: [{ id: 'unit-1', unitKey: 'bridge-in', state: 'PENDING', output: null, orderIndex: 0, attemptGeneration: 0 }],
    };
    const retry = { ...pending, state: 'QUEUED', deliveryGeneration: 2, units: [{ ...pending.units[0], state: 'PENDING', attemptGeneration: 1 }] };
    const db = { smartCoursewareGenerationJob: { findUnique: vi.fn().mockResolvedValueOnce(pending).mockResolvedValueOnce(retry) } };
    mocks.buildSar.mockResolvedValue({ selectedVersionIds: [sourceBindingFixture.sourceVersionId] });
    mocks.buildSourcePack.mockResolvedValue({ retrieval: { pack: { items: [{
      citationTargetId: sourceBindingFixture.citationId,
      metadata: { versionId: sourceBindingFixture.sourceVersionId, stableAnchor: sourceBindingFixture.anchor, contentHash: sourceBindingFixture.contentHash },
    }] } } });
    mocks.beginAttempt
      .mockResolvedValueOnce({ claimed: true, claimToken: 'claim-1', attempt: { id: 'attempt-1', idempotencyKey: 'attempt-key-1' } })
      .mockResolvedValueOnce({ claimed: true, claimToken: 'claim-2', attempt: { id: 'attempt-2', idempotencyKey: 'attempt-key-2' } });
    mocks.failUnit.mockResolvedValue({ state: 'FAILED' });
    mocks.completeUnit.mockResolvedValue({ state: 'COMPLETED' });
    const invalid = createDeterministicCoursewareStage({ unitKey: 'bridge-in', durationSeconds: 300, approvedPlan: plan, sourceBinding: sourceBindingFixture });
    invalid.stage.steps[0].layoutId = 'unregistered-layout';
    const corrected = createDeterministicCoursewareStage({ unitKey: 'bridge-in', durationSeconds: 300, approvedPlan: plan, sourceBinding: sourceBindingFixture });
    const runtime = {
      serviceId: 'fixture-service', providerKind: 'fixture', model: 'fixture-model',
      generate: vi.fn().mockResolvedValueOnce({ output: invalid }).mockResolvedValueOnce({ output: corrected }),
    };

    await expect(processCoursewareGenerationJob(db as never, pending.id, async () => runtime as never))
      .rejects.toMatchObject({ code: 'runtime-stage-invalid:layout.unregistered-template' });
    expect(mocks.completeUnit).not.toHaveBeenCalled();
    expect(mocks.failUnit).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      unitKey: 'bridge-in', failureCode: 'runtime-stage-invalid:layout.unregistered-template', retryable: false,
    }));

    await expect(processCoursewareGenerationJob(db as never, pending.id, async () => runtime as never))
      .resolves.toEqual({ jobId: pending.id, state: 'COMPLETED' });
    expect(mocks.completeUnit).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ unitKey: 'bridge-in', output: corrected }));
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
      unitKey: 'bridge-in', durationSeconds: 300, approvedPlan: plan, sourceBinding: sourceBindingFixture,
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

  it('keeps a pre-provider failure active and leaves its draft generating', async () => {
    const context = {
      id: 'job-1', ownerId: 'teacher-1', draftId: 'draft-1', state: 'QUEUED', firstIncompleteUnitKey: 'bridge-in',
      deliveryGeneration: 1,
      draft: { id: 'draft-1', planRevision: { content: validPlanFixture() } },
      units: [{ id: 'unit-1', unitKey: 'bridge-in', state: 'PENDING', output: null, orderIndex: 0, attemptGeneration: 0 }],
    };
    const updateJob = vi.fn().mockResolvedValue({ count: 1 });
    const updateDraft = vi.fn();
    const db = {
      smartCoursewareGenerationJob: { findUnique: vi.fn().mockResolvedValue(context) },
      $transaction: vi.fn(async (run: (tx: unknown) => unknown) => run({
        smartCoursewareGenerationJob: { updateMany: updateJob },
        smartCoursewareGenerationUnit: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
        smartCoursewareDraft: { updateMany: updateDraft },
      })),
    };

    await expect(processCoursewareGenerationJob(db as never, 'job-1', async () => { throw new Error('provider-offline'); }))
      .resolves.toEqual({ jobId: 'job-1', state: 'RETRYABLE' });
    expect(updateJob).toHaveBeenCalledWith(expect.objectContaining({
      data: { state: 'RETRYABLE', failureCode: 'courseware-provider-failed' },
    }));
    expect(updateDraft).not.toHaveBeenCalled();
  });
});
