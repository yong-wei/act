import { describe, expect, it, vi } from 'vitest';

import { contentHash } from '@/lib/smart-lesson-plan/domain';
import { sourceBindingFixture, validPlanFixture } from '@/lib/smart-lesson-plan/__tests__/fixtures';

import {
  buildSmartCoursewareDraftCreationKey,
  createSmartCoursewareDraft,
  getSmartCoursewareDraft,
  getSmartCoursewareStudentProjection,
  getSmartCoursewareTeacherProjection,
  updateSmartCoursewareComposition,
} from '../service';
import { coursewareManifestHash } from '../domain';
import { validCompositionInput } from './fixtures';

const teacher = { id: 'teacher-1', role: 'TEACHER' as const };

describe('smart courseware service', () => {
  it('scopes draft creation idempotency to one creation intent rather than the plan revision forever', () => {
    const first = buildSmartCoursewareDraftCreationKey('plan-revision-1', 'intent-1');
    expect(buildSmartCoursewareDraftCreationKey('plan-revision-1', 'intent-1')).toBe(first);
    expect(buildSmartCoursewareDraftCreationKey('plan-revision-1', 'intent-2')).not.toBe(first);
  });

  it('creates an idempotent draft from the exact owned approved revision', async () => {
    const content = validPlanFixture();
    const revision = {
      id: 'plan-revision-1', ownerId: teacher.id, revisionNumber: 3,
      content, contentHash: contentHash(content),
    };
    const created = {
      id: 'draft-1', ownerId: teacher.id, planRevisionId: revision.id,
      planRevisionNumber: 3, planContentHash: revision.contentHash,
      creationRequestHash: contentHash({ planRevisionId: revision.id }),
    };
    const db = {
      smartCoursewareDraft: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue(created),
      },
      smartLessonRevision: { findFirst: vi.fn().mockResolvedValue(revision) },
    };

    await expect(createSmartCoursewareDraft(db as never, {
      actor: teacher, planRevisionId: revision.id, idempotencyKey: 'create-key-1',
    })).resolves.toBe(created);
    expect(db.smartLessonRevision.findFirst).toHaveBeenCalledWith({
      where: { id: revision.id, ownerId: teacher.id },
    });
    expect(db.smartCoursewareDraft.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        ownerId: teacher.id,
        planRevisionId: revision.id,
        planRevisionNumber: 3,
        planContentHash: revision.contentHash,
      }),
    });
  });

  it('allows governance administrators to read without weakening teacher mutation scope', async () => {
    const row = { id: 'draft-1', modules: [], planRevision: {} };
    const findFirst = vi.fn().mockResolvedValue(row);
    const db = { smartCoursewareDraft: { findFirst } };
    await expect(getSmartCoursewareDraft(db as never, {
      actor: { id: 'admin-1', role: 'ADMIN' }, draftId: row.id,
    })).resolves.toBe(row);
    expect(findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: row.id } }));
  });

  it('fails closed on raw and projected reads when persisted manifest identity or hash is corrupt', async () => {
    const plan = validPlanFixture();
    const manifest = validCompositionInput().runtimeManifest;
    const corrupted = {
      id: 'draft-1', ownerId: teacher.id, planRevisionId: 'plan-1', planRevisionNumber: 1,
      planContentHash: contentHash(plan), state: 'READY', version: 2,
      runtimeManifest: { ...manifest, lessonId: 'other-draft' },
      contentHash: coursewareManifestHash(manifest),
      planRevision: { id: 'plan-1', revisionNumber: 1, content: plan, contentHash: contentHash(plan) },
      modules: [],
    };
    const db = { smartCoursewareDraft: { findFirst: vi.fn().mockResolvedValue(corrupted) } };
    await expect(getSmartCoursewareDraft(db as never, { actor: teacher, draftId: corrupted.id }))
      .rejects.toMatchObject({ code: 'courseware-manifest-identity-mismatch' });
    await expect(getSmartCoursewareTeacherProjection(db as never, { actor: teacher, draftId: corrupted.id }))
      .rejects.toMatchObject({ code: 'courseware-manifest-identity-mismatch' });
    await expect(getSmartCoursewareStudentProjection(
      db as never,
      { actor: teacher, draftId: corrupted.id },
      { orderingPermutationSecret: 'smart-courseware-service-test-secret-v1' },
    ))
      .rejects.toMatchObject({ code: 'courseware-manifest-identity-mismatch' });

    corrupted.runtimeManifest = manifest;
    corrupted.contentHash = '0'.repeat(64);
    await expect(getSmartCoursewareDraft(db as never, { actor: teacher, draftId: corrupted.id }))
      .rejects.toMatchObject({ code: 'courseware-content-hash-mismatch' });
  });

  it('updates a validated composition through expectedVersion CAS and creates module audit rows', async () => {
    const planContent = validPlanFixture();
    const planRevision = {
      id: 'plan-1', ownerId: teacher.id, revisionNumber: 1,
      content: planContent, contentHash: contentHash(planContent),
    };
    const draft = {
      id: 'draft-1', ownerId: teacher.id, planRevisionId: planRevision.id,
      planRevisionNumber: 1, planContentHash: planRevision.contentHash,
      authoringLineageRoot: 'lineage-1', state: 'EDITABLE', version: 1,
      runtimeManifest: null, modules: [], planRevision,
    };
    const updatedManifest = validCompositionInput().runtimeManifest;
    const updated = {
      ...draft, state: 'READY', version: 2, runtimeManifest: updatedManifest,
      contentHash: coursewareManifestHash(updatedManifest),
    };
    const updateMany = vi.fn().mockResolvedValue({ count: 1 });
    const createModule = vi.fn().mockResolvedValue({});
    const db = {
      smartCoursewareDraft: { findFirst: vi.fn().mockResolvedValueOnce(draft).mockResolvedValueOnce(updated) },
      $transaction: vi.fn(async (callback: (tx: unknown) => unknown) => callback({
        smartCoursewareDraft: { updateMany },
        smartCoursewareModule: { create: createModule, update: vi.fn() },
      })),
    };
    const composition = validCompositionInput();

    await expect(updateSmartCoursewareComposition(db as never, {
      actor: teacher, draftId: draft.id, ...composition,
    })).resolves.toMatchObject({ id: draft.id, version: 2 });
    expect(updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: draft.id, ownerId: teacher.id, version: 1 }),
      data: expect.objectContaining({ state: 'READY', version: { increment: 1 } }),
    }));
    expect(createModule).toHaveBeenCalledTimes(6);
    expect(createModule).toHaveBeenCalledWith({ data: expect.objectContaining({
      activeIdentity: `${draft.id}:module-1`,
      revisions: { create: expect.objectContaining({ changeKind: 'CREATE', actorId: teacher.id }) },
    }) });
  });

  it('accepts an edited module binding already persisted from Source Pack retrieval but rejects a new client binding', async () => {
    const planContent = validPlanFixture();
    const planRevision = {
      id: 'plan-1', ownerId: teacher.id, revisionNumber: 1,
      content: planContent, contentHash: contentHash(planContent),
    };
    const composition = validCompositionInput();
    const runtimeModule = composition.runtimeManifest.stages[0].steps[0].modules[0];
    const retrievedBinding = {
      ...sourceBindingFixture,
      citationId: 'citation-retrieved-fragment',
      anchor: 'chapter-1#retrieved-fragment',
      contentHash: 'b'.repeat(64),
    };
    composition.moduleMetadata[0].sourceBindings = [retrievedBinding];
    const existing = {
      id: 'stored-module-1', ownerId: teacher.id, draftId: 'draft-1', runtimeModuleId: runtimeModule.id,
      moduleInstanceLineage: 'module-lineage-1', contentHash: contentHash(runtimeModule),
      sourceState: 'VERIFIED', sourceBindings: [retrievedBinding], sourceBindingSetHash: contentHash([retrievedBinding]),
      gapIdentity: null, provenance: 'AI_GENERATED', originalAttemptId: 'audited-attempt-1',
      teacherMetadata: {}, currentRevisionNumber: 1, deletedAt: null,
    };
    const draft = {
      id: 'draft-1', ownerId: teacher.id, planRevisionId: planRevision.id,
      planRevisionNumber: 1, planContentHash: planRevision.contentHash,
      authoringLineageRoot: 'lineage-1', state: 'READY', version: 1,
      runtimeManifest: composition.runtimeManifest, contentHash: coursewareManifestHash(composition.runtimeManifest), modules: [existing], planRevision,
    };
    const updated = { ...draft, version: 2 };
    const db = {
      smartCoursewareDraft: { findFirst: vi.fn().mockResolvedValueOnce(draft).mockResolvedValueOnce(updated) },
      $transaction: vi.fn(async (callback: (tx: unknown) => unknown) => callback({
        smartCoursewareDraft: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
        smartCoursewareModule: { create: vi.fn().mockResolvedValue({}), update: vi.fn().mockResolvedValue({}) },
      })),
    };

    await expect(updateSmartCoursewareComposition(db as never, {
      actor: teacher, draftId: draft.id, ...composition,
    })).resolves.toMatchObject({ id: draft.id, version: 2 });

    const arbitrary = structuredClone(composition);
    arbitrary.moduleMetadata[0].sourceBindings = [{
      ...retrievedBinding,
      citationId: 'client-invented-citation',
      anchor: 'client-invented-anchor',
      contentHash: 'c'.repeat(64),
    }];
    const rejectingDb = { smartCoursewareDraft: { findFirst: vi.fn().mockResolvedValue(draft) } };
    await expect(updateSmartCoursewareComposition(rejectingDb as never, {
      actor: teacher, draftId: draft.id, ...arbitrary,
    })).rejects.toMatchObject({ code: 'source-binding-not-in-approved-plan', status: 409 });
  });

  it('does not persist module changes after losing the version claim', async () => {
    const planContent = validPlanFixture();
    const planRevision = { id: 'plan-1', revisionNumber: 1, content: planContent, contentHash: contentHash(planContent) };
    const draft = {
      id: 'draft-1', ownerId: teacher.id, planRevisionId: planRevision.id,
      planRevisionNumber: 1, planContentHash: planRevision.contentHash,
      authoringLineageRoot: 'lineage-1', state: 'READY', version: 2,
      runtimeManifest: null, modules: [], planRevision,
    };
    const createModule = vi.fn();
    const db = {
      smartCoursewareDraft: { findFirst: vi.fn().mockResolvedValue(draft) },
      $transaction: vi.fn(async (callback: (tx: unknown) => unknown) => callback({
        smartCoursewareDraft: { updateMany: vi.fn().mockResolvedValue({ count: 0 }) },
        smartCoursewareModule: { create: createModule, update: vi.fn() },
      })),
    };
    const composition = validCompositionInput();
    composition.expectedVersion = 2;

    await expect(updateSmartCoursewareComposition(db as never, {
      actor: teacher, draftId: draft.id, ...composition,
    })).rejects.toMatchObject({ code: 'courseware-version-conflict' });
    expect(createModule).not.toHaveBeenCalled();
  });

  it('creates an immutable revision when a teacher changes only AI-generated sidecar evidence', async () => {
    const planContent = validPlanFixture();
    const planRevision = { id: 'plan-1', revisionNumber: 1, content: planContent, contentHash: contentHash(planContent) };
    const composition = validCompositionInput();
    const runtimeModule = composition.runtimeManifest.stages[2].steps[0].modules[0];
    const existing = {
      id: 'stored-module-3', ownerId: teacher.id, draftId: 'draft-1', runtimeModuleId: runtimeModule.id,
      moduleInstanceLineage: 'module-lineage-3', contentHash: contentHash(runtimeModule),
      sourceState: 'VERIFIED', sourceBindings: [sourceBindingFixture], sourceBindingSetHash: contentHash([sourceBindingFixture]),
      gapIdentity: null, provenance: 'AI_GENERATED', originalAttemptId: 'attempt-1',
      teacherMetadata: { referenceAnswer: 'a', explanation: '原解释', scoring: { maxPoints: 1 } },
      currentRevisionNumber: 1, deletedAt: null,
    };
    const draft = {
      id: 'draft-1', ownerId: teacher.id, planRevisionId: planRevision.id,
      planRevisionNumber: 1, planContentHash: planRevision.contentHash,
      authoringLineageRoot: 'lineage-1', state: 'READY', version: 1,
      runtimeManifest: composition.runtimeManifest, contentHash: coursewareManifestHash(composition.runtimeManifest), modules: [existing], planRevision,
    };
    composition.moduleMetadata[2].teacherFields.explanation = '教师修订解释';
    const updateModule = vi.fn().mockResolvedValue({});
    const updated = { ...draft, version: 2 };
    const db = {
      smartCoursewareDraft: { findFirst: vi.fn().mockResolvedValueOnce(draft).mockResolvedValueOnce(updated) },
      $transaction: vi.fn(async (callback: (tx: unknown) => unknown) => callback({
        smartCoursewareDraft: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
        smartCoursewareModule: { create: vi.fn().mockResolvedValue({}), update: updateModule },
      })),
    };

    await updateSmartCoursewareComposition(db as never, {
      actor: teacher, draftId: draft.id, ...composition,
    });

    expect(updateModule).toHaveBeenCalledWith({
      where: { id: existing.id },
      data: expect.objectContaining({
        provenance: 'AI_GENERATED_TEACHER_EDITED',
        currentRevisionNumber: 2,
        revisions: { create: expect.objectContaining({
          revisionNumber: 2,
          changeKind: 'UPDATE',
          provenance: 'AI_GENERATED_TEACHER_EDITED',
          originalAttemptIdSnapshot: 'attempt-1',
          teacherMetadataSnapshot: expect.objectContaining({ explanation: '教师修订解释' }),
          actorId: teacher.id,
        }) },
      }),
    });
  });

  it('derives teacher review, plan limitations, and provider/model audit from persisted records', async () => {
    const plan = validPlanFixture();
    const composition = validCompositionInput();
    const draft = {
      id: 'draft-1', ownerId: teacher.id, planRevisionId: 'plan-1', planRevisionNumber: 1,
      planContentHash: contentHash(plan), version: 2, runtimeManifest: composition.runtimeManifest,
      contentHash: coursewareManifestHash(composition.runtimeManifest),
      planRevision: { id: 'plan-1', draftId: 'plan-draft-1', revisionNumber: 1, content: plan, contentHash: contentHash(plan) },
      modules: composition.moduleMetadata.map((metadata, index) => ({
        runtimeModuleId: metadata.moduleId,
        moduleInstanceLineage: `lineage-${index}`,
        contentHash: contentHash(composition.runtimeManifest.stages[index].steps[0].modules[0]),
        sourceState: 'VERIFIED', sourceBindings: metadata.sourceBindings,
        sourceBindingSetHash: contentHash(metadata.sourceBindings), gapIdentity: null,
        provenance: 'AI_GENERATED', originalAttemptId: `attempt-${index}`,
        teacherMetadata: metadata.teacherFields,
      })),
    };
    const findReview = vi.fn().mockResolvedValue({
      report: {
        goalCoverage: '完整', sourceConsistency: '一致', bopppsStructure: '完整',
        findings: [{ category: 'CONTENT_QUALITY', severity: 'WARNING', message: '补充课堂误区说明', path: 'summary' }],
        suggestions: ['加入教师复核提示'],
      },
    });
    const findJobs = vi.fn().mockResolvedValue([{
      id: 'job-1', mode: 'INITIAL', state: 'COMPLETED',
      providerAttempts: [{ attemptNumber: 1, serviceId: 'provider-service', providerKind: 'openai-compatible', model: 'courseware-model', outcome: 'SUCCEEDED' }],
    }]);
    const db = {
      smartCoursewareDraft: { findFirst: vi.fn().mockResolvedValue(draft) },
      smartLessonAdvisoryReview: { findFirst: findReview },
      smartCoursewareGenerationJob: { findMany: findJobs },
    };

    const projection = await getSmartCoursewareTeacherProjection(db as never, { actor: teacher, draftId: draft.id });

    expect(projection.planLimitations).toEqual(plan.limitations);
    expect(projection.aiReview?.findings[0].message).toBe('补充课堂误区说明');
    expect(projection.generationAudit[0]).toMatchObject({
      jobId: 'job-1',
      attempts: [expect.objectContaining({ serviceId: 'provider-service', model: 'courseware-model' })],
    });
    expect(findReview).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ draftId: 'plan-draft-1', contentHash: contentHash(plan), state: 'COMPLETED' }),
    }));
    expect(findJobs).toHaveBeenCalledWith(expect.objectContaining({ where: { ownerId: teacher.id, draftId: draft.id }, take: 20 }));
  });

  it.each([
    ['missing', undefined],
    ['blank', '   '],
  ])('fails closed on teacher GET when verified persisted metadata has a %s inclusion rationale', async (_label, rationale) => {
    const plan = validPlanFixture();
    const composition = validCompositionInput();
    const modules = composition.moduleMetadata.map((metadata, index) => ({
      runtimeModuleId: metadata.moduleId,
      moduleInstanceLineage: `lineage-${index}`,
      contentHash: contentHash(composition.runtimeManifest.stages[index].steps[0].modules[0]),
      sourceState: 'VERIFIED',
      sourceBindings: metadata.sourceBindings,
      sourceBindingSetHash: contentHash(metadata.sourceBindings),
      gapIdentity: null,
      provenance: 'AI_GENERATED',
      originalAttemptId: `attempt-${index}`,
      teacherMetadata: { ...metadata.teacherFields } as Record<string, unknown>,
    }));
    if (rationale === undefined) delete modules[0].teacherMetadata.inclusionRationale;
    else modules[0].teacherMetadata.inclusionRationale = rationale;
    const draft = {
      id: 'draft-1', ownerId: teacher.id, planRevisionId: 'plan-1', planRevisionNumber: 1,
      planContentHash: contentHash(plan), version: 2, runtimeManifest: composition.runtimeManifest,
      contentHash: coursewareManifestHash(composition.runtimeManifest),
      planRevision: { id: 'plan-1', draftId: 'plan-draft-1', revisionNumber: 1, content: plan, contentHash: contentHash(plan) },
      modules,
    };
    const db = {
      smartCoursewareDraft: { findFirst: vi.fn().mockResolvedValue(draft) },
      smartLessonAdvisoryReview: { findFirst: vi.fn().mockResolvedValue(null) },
      smartCoursewareGenerationJob: { findMany: vi.fn().mockResolvedValue([]) },
    };

    await expect(getSmartCoursewareTeacherProjection(db as never, { actor: teacher, draftId: draft.id }))
      .rejects.toMatchObject({
        issues: expect.arrayContaining([
          expect.objectContaining({ path: ['moduleMetadata', 0, 'teacherFields', 'inclusionRationale'] }),
        ]),
      });
  });
});
