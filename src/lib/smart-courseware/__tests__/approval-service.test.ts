import { describe, expect, it, vi } from 'vitest';

import { contentHash } from '@/lib/smart-lesson-plan/domain';
import { sourceBindingFixture, validPlanFixture } from '@/lib/smart-lesson-plan/__tests__/fixtures';

import { coursewareManifestHash } from '../domain';
import { approveSmartCoursewareDraft } from '../service';
import { validCompositionInput } from './fixtures';

const actor = { id: 'teacher-1', role: 'TEACHER' as const };

describe('smart courseware whole-course approval', () => {
  it('freezes the full audit snapshot, preserves pending gaps, creates source references, and creates no acknowledgement', async () => {
    const draft = approvalDraft();
    const createRevision = vi.fn(async ({ data }) => ({ ...data, approvedAt: new Date('2026-07-19T00:00:00Z') }));
    const createLinks = vi.fn().mockResolvedValue({ count: 1 });
    const updateDraft = vi.fn().mockResolvedValue({ count: 1 });
    const db = approvalDb(draft, { createRevision, createLinks, updateDraft });

    const revision = await approveSmartCoursewareDraft(db as never, {
      actor, draftId: draft.id, idempotencyKey: 'approve-courseware-1',
    });

    expect(revision).toMatchObject({ draftId: draft.id, revisionNumber: 1 });
    expect(createRevision).toHaveBeenCalledWith({ data: expect.objectContaining({
      planRevisionId: draft.planRevisionId,
      planRevisionNumber: draft.planRevisionNumber,
      planContentHash: draft.planContentHash,
      manifestSnapshot: draft.runtimeManifest,
      manifestHash: draft.contentHash,
      moduleMetadataSnapshot: expect.any(Array),
      gapsSnapshot: [{
        moduleId: 'module-1',
        gapIdentity: 'courseware-gap:pending-module-1',
        sourceState: 'ai_generated_source_pending',
        sourceBindingSetHash: contentHash([]),
      }],
      provenanceSnapshot: expect.arrayContaining([expect.objectContaining({
        moduleId: 'module-1', provenance: 'ai_generated', originalAttemptId: 'attempt-1',
      })]),
      validationSnapshot: expect.objectContaining({ valid: true }),
      approvalIdempotencyKey: 'approve-courseware-1',
      approvedById: actor.id,
    }) });
    expect(createLinks).toHaveBeenCalledWith({
      data: [{
        versionId: sourceBindingFixture.sourceVersionId,
        referenceType: 'COURSEWARE_REVISION',
        referenceId: revision.id,
      }],
      skipDuplicates: true,
    });
    expect(updateDraft).toHaveBeenCalledWith(expect.objectContaining({ data: { state: 'ACCEPTED' } }));
    expect((db as Record<string, unknown>).courseBasisAcknowledgement).toBeUndefined();
  });

  it('replays the immutable revision for the same approval intent', async () => {
    const draft = approvalDraft();
    const createRevision = vi.fn(async ({ data }) => ({ ...data, approvedAt: new Date() }));
    const firstDb = approvalDb(draft, { createRevision });
    const revision = await approveSmartCoursewareDraft(firstDb as never, {
      actor, draftId: draft.id, idempotencyKey: 'approve-courseware-2',
    });
    const transaction = vi.fn();
    const replayDb = {
      smartCoursewareRevision: { findFirst: vi.fn().mockResolvedValue(revision) },
      smartCoursewareDraft: { findFirst: vi.fn().mockResolvedValue({
        id: draft.id,
        version: draft.version,
        contentHash: draft.contentHash,
        planRevisionId: draft.planRevisionId,
        planContentHash: draft.planContentHash,
      }) },
      $transaction: transaction,
    };

    await expect(approveSmartCoursewareDraft(replayDb as never, {
      actor, draftId: draft.id, idempotencyKey: 'approve-courseware-2',
    })).resolves.toEqual(revision);
    expect(transaction).not.toHaveBeenCalled();
  });

  it('loses the Serializable READY claim atomically under concurrent approval', async () => {
    const draft = approvalDraft();
    const createRevision = vi.fn();
    const createLinks = vi.fn();
    const db = approvalDb(draft, {
      createRevision,
      createLinks,
      updateDraft: vi.fn().mockResolvedValue({ count: 0 }),
    });

    await expect(approveSmartCoursewareDraft(db as never, {
      actor, draftId: draft.id, idempotencyKey: 'approve-courseware-3',
    })).rejects.toMatchObject({ code: 'courseware-approval-conflict' });
    expect(createRevision).not.toHaveBeenCalled();
    expect(createLinks).not.toHaveBeenCalled();
  });
});

function approvalDraft() {
  const composition = validCompositionInput();
  const planContent = validPlanFixture();
  const planRevision = {
    id: 'plan-1', revisionNumber: 1, content: planContent, contentHash: contentHash(planContent),
  };
  const runtimeModules = composition.runtimeManifest.stages
    .flatMap((stage) => stage.steps.flatMap((step) => step.modules));
  const modules = runtimeModules.map((module, index) => {
    const pending = index === 0;
    return {
      id: `stored-${module.id}`,
      ownerId: actor.id,
      draftId: 'draft-approval',
      runtimeModuleId: module.id,
      moduleInstanceLineage: `lineage-${module.id}`,
      contentHash: contentHash(module),
      sourceState: pending ? 'AI_GENERATED_SOURCE_PENDING' : 'VERIFIED',
      sourceBindings: pending ? [] : [sourceBindingFixture],
      sourceBindingSetHash: contentHash(pending ? [] : [sourceBindingFixture]),
      gapIdentity: pending ? 'courseware-gap:pending-module-1' : null,
      provenance: 'AI_GENERATED',
      originalAttemptId: `attempt-${index + 1}`,
      teacherMetadata: composition.moduleMetadata[index].teacherFields,
      currentRevisionNumber: 1,
      deletedAt: null,
      createdAt: new Date(index),
    };
  });
  return {
    id: 'draft-approval', ownerId: actor.id, state: 'READY', version: 2,
    planRevisionId: planRevision.id, planRevisionNumber: 1, planContentHash: planRevision.contentHash,
    authoringLineageRoot: 'approval-lineage', runtimeManifest: composition.runtimeManifest,
    contentHash: coursewareManifestHash(composition.runtimeManifest), validationSnapshot: { valid: true },
    planRevision, modules,
  };
}

function approvalDb(draft: ReturnType<typeof approvalDraft>, overrides: {
  createRevision?: ReturnType<typeof vi.fn>;
  createLinks?: ReturnType<typeof vi.fn>;
  updateDraft?: ReturnType<typeof vi.fn>;
} = {}) {
  const createRevision = overrides.createRevision ?? vi.fn(async ({ data }) => ({ ...data, approvedAt: new Date() }));
  const createLinks = overrides.createLinks ?? vi.fn().mockResolvedValue({ count: 1 });
  const updateDraft = overrides.updateDraft ?? vi.fn().mockResolvedValue({ count: 1 });
  return {
    smartCoursewareRevision: { findFirst: vi.fn().mockResolvedValue(null) },
    $transaction: vi.fn(async (run: (tx: unknown) => unknown) => run({
      smartCoursewareDraft: { findFirst: vi.fn().mockResolvedValue(draft), updateMany: updateDraft },
      smartCoursewareRevision: { create: createRevision },
      courseBasisReferenceLink: { createMany: createLinks },
    })),
  };
}
