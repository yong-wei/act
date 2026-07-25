import { randomUUID } from 'node:crypto';
import { Prisma, type PrismaClient } from '@prisma/client';

import type { GeneratedSlideManifest, GeneratedSlideModule } from '@/features/interactive/shared/manifest-runtime/generated-slide-contract';
import { contentHash, normalizeSourceBindings } from '@/lib/smart-lesson-plan/domain';
import { smartLessonAdvisoryReviewSchema, validateSmartLessonPlan } from '@/lib/smart-lesson-plan/schema';

import {
  SmartCoursewareError,
  assertCoursewareManifestIdentity,
  assertPersistedCoursewareManifest,
  coursewareManifestHash,
  deriveCoursewareModuleMetadata,
  persistenceProvenanceFor,
  persistenceSourceStateFor,
  projectCoursewareForStudent,
  projectCoursewareForTeacher,
  validateCoursewareComposition,
  type SmartCoursewareActor,
} from './domain';
import type { CoursewareModuleMetadata } from './schema';

type CoursewareDb = PrismaClient;

export function buildSmartCoursewareDraftCreationKey(planRevisionId: string, creationIntentId: string) {
  return `courseware-editor:${contentHash({ planRevisionId, creationIntentId })}`;
}

export async function createSmartCoursewareDraft(db: CoursewareDb, input: {
  actor: SmartCoursewareActor;
  planRevisionId: string;
  idempotencyKey: string;
}) {
  const actor = validateActor(input.actor);
  const planRevisionId = validateId(input.planRevisionId);
  const idempotencyKey = validateIdempotencyKey(input.idempotencyKey);
  const requestHash = contentHash({ planRevisionId });

  const revision = await db.smartLessonRevision.findFirst({
    where: { id: planRevisionId, ownerId: actor.id },
    include: { task: { select: { revision: true } } },
  });
  if (!revision) throw new SmartCoursewareError('approved-plan-revision-not-found', 404);
  if (revision.taskRevision !== revision.task.revision) {
    throw new SmartCoursewareError('approved-plan-revision-stale', 409);
  }
  const replay = await db.smartCoursewareDraft.findFirst({
    where: { ownerId: actor.id, creationIdempotencyKey: idempotencyKey },
  });
  if (replay) return assertCreateReplay(replay, requestHash);
  validateSmartLessonPlan(revision.content);
  if (contentHash(revision.content) !== revision.contentHash) {
    throw new SmartCoursewareError('approved-plan-revision-hash-mismatch', 409);
  }

  try {
    return await db.smartCoursewareDraft.create({
      data: {
        id: randomUUID(),
        ownerId: revision.ownerId,
        planRevisionId: revision.id,
        planRevisionNumber: revision.revisionNumber,
        planContentHash: revision.contentHash,
        authoringLineageRoot: randomUUID(),
        creationIdempotencyKey: idempotencyKey,
        creationRequestHash: requestHash,
      },
    });
  } catch (error) {
    if (!isUniqueConstraint(error)) throw error;
    const raced = await db.smartCoursewareDraft.findFirst({
      where: { ownerId: actor.id, creationIdempotencyKey: idempotencyKey },
    });
    if (!raced) throw error;
    return assertCreateReplay(raced, requestHash);
  }
}

export async function getSmartCoursewareDraft(db: CoursewareDb, input: {
  actor: SmartCoursewareActor;
  draftId: string;
}) {
  const actor = validateActor(input.actor);
  const draft = await db.smartCoursewareDraft.findFirst({
    where: readableWhere(actor, { id: validateId(input.draftId) }),
    include: {
      planRevision: true,
      modules: { where: { deletedAt: null }, orderBy: { createdAt: 'asc' } },
    },
  });
  if (!draft) throw new SmartCoursewareError('courseware-draft-not-found', 404);
  if (draft.runtimeManifest || draft.contentHash) {
    const plan = validateSmartLessonPlan(draft.planRevision.content);
    assertPersistedCoursewareManifest({
      draftId: draft.id,
      approvedPlanTitle: plan.topic,
      manifest: draft.runtimeManifest as unknown as GeneratedSlideManifest | null,
      contentHash: draft.contentHash,
    });
  }
  return draft;
}

export async function updateSmartCoursewareComposition(db: CoursewareDb, input: {
  actor: SmartCoursewareActor;
  draftId: string;
  expectedVersion: number;
  runtimeManifest: unknown;
  moduleMetadata: unknown;
}) {
  const actor = validateActor(input.actor);
  const draft = await db.smartCoursewareDraft.findFirst({
    where: { id: validateId(input.draftId), ownerId: actor.id },
    include: {
      planRevision: true,
      modules: { where: { deletedAt: null }, orderBy: { createdAt: 'asc' } },
    },
  });
  if (!draft) throw new SmartCoursewareError('courseware-draft-not-found', 404);
  if (draft.state === 'GENERATING') throw new SmartCoursewareError('active-generation-locks-courseware', 409);
  if (draft.state === 'ACCEPTED') throw new SmartCoursewareError('accepted-courseware-immutable', 409);
  if (draft.planContentHash !== draft.planRevision.contentHash
    || draft.planRevisionNumber !== draft.planRevision.revisionNumber
    || contentHash(draft.planRevision.content) !== draft.planContentHash) {
    throw new SmartCoursewareError('approved-plan-baseline-changed', 409);
  }

  const plan = validateSmartLessonPlan(draft.planRevision.content);
  if (draft.runtimeManifest || draft.contentHash) {
    assertPersistedCoursewareManifest({
      draftId: draft.id,
      approvedPlanTitle: plan.topic,
      manifest: draft.runtimeManifest as unknown as GeneratedSlideManifest | null,
      contentHash: draft.contentHash,
    });
  }
  const composition = validateCoursewareComposition({
    expectedVersion: input.expectedVersion,
    runtimeManifest: input.runtimeManifest,
    moduleMetadata: input.moduleMetadata,
  }, plan);
  assertCoursewareManifestIdentity({
    draftId: draft.id,
    approvedPlanTitle: plan.topic,
    manifest: composition.runtimeManifest,
  });
  const runtimeModules = allRuntimeModules(composition.runtimeManifest);
  const requestedById = new Map(composition.moduleMetadata.map((metadata) => [metadata.moduleId, metadata]));
  const existingById = new Map(draft.modules.map((module) => [module.runtimeModuleId, module]));
  const priorRuntime = draft.runtimeManifest ? allRuntimeModules(draft.runtimeManifest as unknown as GeneratedSlideManifest) : [];
  const priorRuntimeById = new Map(priorRuntime.map((module) => [module.id, module]));
  const allowedSourceBindings = normalizeSourceBindings([
    ...plan.sources,
    ...draft.modules.flatMap((module) => normalizeSourceBindings(module.sourceBindings)),
  ]);
  const derived = runtimeModules.map((runtimeModule) => {
    const { copiedFromModuleId, ...requested } = requestedById.get(runtimeModule.id)!;
    const existing = existingById.get(runtimeModule.id);
    const matchingCopyOrigins = existing ? [] : priorRuntime.filter((candidate) => (
      existingById.has(candidate.id) && moduleCopyContentHash(candidate) === moduleCopyContentHash(runtimeModule)
    ));
    if (matchingCopyOrigins.length > 1) {
      throw new SmartCoursewareError('courseware-module-copy-origin-ambiguous', 409);
    }
    const copyOriginId = copiedFromModuleId ?? matchingCopyOrigins[0]?.id;
    if (!copyOriginId) {
      return deriveCoursewareModuleMetadata({
        authoringLineageRoot: draft.authoringLineageRoot, runtimeModule, requested,
        allowedSourceBindings, existing,
      });
    }
    const copiedFrom = existingById.get(copyOriginId);
    const copiedRuntime = priorRuntimeById.get(copyOriginId);
    if (existing || !copiedFrom || !copiedRuntime || moduleCopyContentHash(runtimeModule) !== moduleCopyContentHash(copiedRuntime)) {
      throw new SmartCoursewareError('courseware-module-copy-origin-invalid', 409);
    }
    const sourceMetadata = publicModuleMetadata(copiedFrom);
    const aiProvenance = copiedFrom.provenance === 'AI_GENERATED' || copiedFrom.provenance === 'AI_GENERATED_TEACHER_EDITED';
    if (aiProvenance && !copiedFrom.originalAttemptId) {
      throw new SmartCoursewareError('courseware-module-copy-origin-unaudited', 409);
    }
    return deriveCoursewareModuleMetadata({
      authoringLineageRoot: draft.authoringLineageRoot,
      runtimeModule,
      requested: {
        ...requested,
        sourceState: sourceMetadata.sourceState,
        sourceBindings: sourceMetadata.sourceBindings,
      },
      allowedSourceBindings,
      newProvenance: aiProvenance ? 'ai_generated_teacher_edited' : 'teacher_created',
      originalAttemptId: copiedFrom.originalAttemptId,
    });
  });

  try {
    await db.$transaction(async (tx) => {
      const claimed = await tx.smartCoursewareDraft.updateMany({
        where: {
          id: draft.id,
          ownerId: draft.ownerId,
          version: input.expectedVersion,
          state: { in: ['EDITABLE', 'READY'] },
        },
        data: {
          state: 'READY',
          version: { increment: 1 },
          runtimeManifest: asJson(composition.runtimeManifest),
          contentHash: coursewareManifestHash(composition.runtimeManifest),
          validationSnapshot: asJson(composition.validation),
        },
      });
      if (claimed.count !== 1) throw new SmartCoursewareError('courseware-version-conflict', 409);

      const runtimeById = new Map(runtimeModules.map((module) => [module.id, module]));
      for (const metadata of derived) {
        const runtimeModule = runtimeById.get(metadata.moduleId)!;
        const existing = existingById.get(metadata.moduleId);
        if (!existing) {
          await createModule(tx, draft, actor, runtimeModule, metadata);
          continue;
        }
        await updateModuleIfChanged(tx, existing, actor, runtimeModule, metadata);
      }

      const retainedIds = new Set(derived.map((metadata) => metadata.moduleId));
      for (const deleted of draft.modules.filter((module) => !retainedIds.has(module.runtimeModuleId))) {
        await deleteModule(tx, deleted, actor, priorRuntimeById.get(deleted.runtimeModuleId));
      }
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch (error) {
    if (isRetryableTransactionConflict(error)) throw new SmartCoursewareError('courseware-version-conflict', 409);
    throw error;
  }

  return getSmartCoursewareDraft(db, { actor, draftId: draft.id });
}

export async function approveSmartCoursewareDraft(db: CoursewareDb, input: {
  actor: SmartCoursewareActor;
  draftId: string;
  idempotencyKey: string;
}) {
  const actor = validateActor(input.actor);
  const draftId = validateId(input.draftId);
  const idempotencyKey = validateIdempotencyKey(input.idempotencyKey);
  const keyed = await db.smartCoursewareRevision.findFirst({
    where: { ownerId: actor.id, approvalIdempotencyKey: idempotencyKey },
  });
  if (keyed) return assertCoursewareApprovalReplay(db, actor, keyed, draftId);
  const alreadyApproved = await db.smartCoursewareRevision.findFirst({ where: { ownerId: actor.id, draftId } });
  if (alreadyApproved) return assertCoursewareApprovalReplay(db, actor, alreadyApproved, draftId);

  let requestHash: string | null = null;
  try {
    return await db.$transaction(async (tx) => {
      const draft = await tx.smartCoursewareDraft.findFirst({
        where: { id: draftId, ownerId: actor.id },
        include: {
          planRevision: true,
          modules: { where: { deletedAt: null }, orderBy: { createdAt: 'asc' } },
        },
      });
      if (!draft) throw new SmartCoursewareError('courseware-draft-not-found', 404);
      if (draft.state !== 'READY' || !draft.runtimeManifest || !draft.contentHash) {
        throw new SmartCoursewareError('valid-ready-courseware-required', 409);
      }
      const activeJob = await tx.smartCoursewareGenerationJob.findFirst({
        where: { draftId: draft.id, state: { in: ['QUEUED', 'RUNNING', 'RETRYABLE'] } },
        select: { id: true },
      });
      if (activeJob) throw new SmartCoursewareError('active-generation-locks-courseware', 409);
      if (draft.planContentHash !== draft.planRevision.contentHash
        || draft.planRevisionNumber !== draft.planRevision.revisionNumber
        || contentHash(draft.planRevision.content) !== draft.planContentHash) {
        throw new SmartCoursewareError('approved-plan-baseline-changed', 409);
      }
      const plan = validateSmartLessonPlan(draft.planRevision.content);
      const manifest = draft.runtimeManifest as unknown as GeneratedSlideManifest;
      assertPersistedCoursewareManifest({
        draftId: draft.id,
        approvedPlanTitle: plan.topic,
        manifest,
        contentHash: draft.contentHash,
      });
      const moduleMetadata = draft.modules.map(publicModuleMetadata);
      const validationMetadata = moduleMetadata.map((module) => ({
        moduleId: module.moduleId,
        sourceState: module.sourceState,
        sourceBindings: module.sourceBindings,
        teacherFields: module.teacherFields,
      }));
      const composition = validateCoursewareComposition({
        expectedVersion: draft.version,
        runtimeManifest: manifest,
        moduleMetadata: validationMetadata,
      }, plan);
      if (!composition.validation.valid) throw new SmartCoursewareError('valid-ready-courseware-required', 409);
      const moduleMetadataHash = contentHash(moduleMetadata);
      const gaps = moduleMetadata
        .filter((module) => module.gapIdentity !== null)
        .map((module) => ({
          moduleId: module.moduleId,
          gapIdentity: module.gapIdentity,
          sourceState: module.sourceState,
          sourceBindingSetHash: module.sourceBindingSetHash,
        }));
      const provenance = moduleMetadata.map((module) => ({
        moduleId: module.moduleId,
        moduleInstanceLineage: module.moduleInstanceLineage,
        provenance: module.provenance,
        originalAttemptId: module.originalAttemptId,
      }));
      const approvalHash = coursewareApprovalRequestHash({
        draftId: draft.id,
        draftVersion: draft.version,
        manifestHash: draft.contentHash,
        moduleMetadataHash,
        planRevisionId: draft.planRevisionId,
        planContentHash: draft.planContentHash,
      });
      requestHash = approvalHash;
      const claimed = await tx.smartCoursewareDraft.updateMany({
        where: {
          id: draft.id,
          ownerId: actor.id,
          state: 'READY',
          version: draft.version,
          contentHash: draft.contentHash,
          planRevisionId: draft.planRevisionId,
          planContentHash: draft.planContentHash,
        },
        data: { state: 'ACCEPTED' },
      });
      if (claimed.count !== 1) throw new SmartCoursewareError('courseware-approval-conflict', 409);
      const revision = await tx.smartCoursewareRevision.create({ data: {
        id: randomUUID(),
        ownerId: draft.ownerId,
        draftId: draft.id,
        revisionNumber: 1,
        planRevisionId: draft.planRevisionId,
        planRevisionNumber: draft.planRevisionNumber,
        planContentHash: draft.planContentHash,
        manifestSnapshot: asJson(composition.runtimeManifest),
        manifestHash: draft.contentHash,
        moduleMetadataSnapshot: asJson(moduleMetadata),
        moduleMetadataHash,
        gapsSnapshot: asJson(gaps),
        provenanceSnapshot: asJson(provenance),
        validationSnapshot: asJson(composition.validation),
        contentHash: contentHash({
          planRevisionId: draft.planRevisionId,
          planContentHash: draft.planContentHash,
          manifestHash: draft.contentHash,
          moduleMetadataHash,
          gaps,
          provenance,
          validation: composition.validation,
        }),
        approvalIdempotencyKey: idempotencyKey,
        approvalRequestHash: approvalHash,
        approvedById: actor.id,
      } });
      const versionIds = [...new Set([
        ...plan.sources.map((binding) => binding.sourceVersionId),
        ...moduleMetadata.flatMap((module) => module.sourceBindings.map((binding) => binding.sourceVersionId)),
      ])];
      await tx.courseBasisReferenceLink.createMany({
        data: versionIds.map((versionId) => ({
          versionId,
          referenceType: 'COURSEWARE_REVISION' as const,
          referenceId: revision.id,
        })),
        skipDuplicates: true,
      });
      return revision;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch (error) {
    if (isUniqueConstraint(error) || isRetryableTransactionConflict(error)) {
      const replay = await db.smartCoursewareRevision.findFirst({
        where: { ownerId: actor.id, OR: [{ approvalIdempotencyKey: idempotencyKey }, { draftId }] },
      });
      if (replay && requestHash && replay.approvalRequestHash === requestHash) return replay;
      throw new SmartCoursewareError('courseware-approval-conflict', 409);
    }
    throw error;
  }
}

export async function getSmartCoursewareTeacherProjection(db: CoursewareDb, input: {
  actor: SmartCoursewareActor;
  draftId: string;
}) {
  const draft = await getSmartCoursewareDraft(db, input);
  if (!draft.runtimeManifest) throw new SmartCoursewareError('courseware-manifest-not-ready', 409);
  const plan = validateSmartLessonPlan(draft.planRevision.content);
  const [review, jobs] = await Promise.all([
    db.smartLessonAdvisoryReview.findFirst({
      where: {
        ownerId: draft.ownerId,
        draftId: draft.planRevision.draftId,
        contentHash: draft.planContentHash,
        state: 'COMPLETED',
      },
      orderBy: { completedAt: 'desc' },
      select: { report: true },
    }),
    db.smartCoursewareGenerationJob.findMany({
      where: { ownerId: draft.ownerId, draftId: draft.id },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: {
        id: true,
        mode: true,
        state: true,
        providerAttempts: {
          orderBy: { attemptNumber: 'asc' },
          take: 100,
          select: {
            id: true,
            attemptNumber: true,
            serviceId: true,
            providerKind: true,
            model: true,
            outcome: true,
          },
        },
      },
    }),
  ]);
  const aiReview = review?.report
    ? smartLessonAdvisoryReviewSchema.parse(review.report)
    : null;
  return projectCoursewareForTeacher({
    draftId: draft.id,
    version: draft.version,
    planRevisionId: draft.planRevisionId,
    planContentHash: draft.planContentHash,
    runtimeManifest: draft.runtimeManifest as unknown as GeneratedSlideManifest,
    moduleMetadata: draft.modules.map(publicModuleMetadata),
    planLimitations: plan.limitations,
    aiReview: aiReview ? { findings: aiReview.findings, suggestions: aiReview.suggestions } : null,
    generationAudit: jobs.map((job) => ({
      jobId: job.id,
      mode: job.mode,
      state: job.state,
      attempts: job.providerAttempts.map(({ id, ...attempt }) => ({ attemptId: id, ...attempt })),
    })),
  });
}

export async function getSmartCoursewareStudentProjection(db: CoursewareDb, input: {
  actor: SmartCoursewareActor;
  draftId: string;
}, dependencies: { orderingPermutationSecret: string }) {
  const draft = await getSmartCoursewareDraft(db, input);
  if (!draft.runtimeManifest) throw new SmartCoursewareError('courseware-manifest-not-ready', 409);
  return projectCoursewareForStudent({
    draftId: draft.id,
    version: draft.version,
    runtimeManifest: draft.runtimeManifest as unknown as GeneratedSlideManifest,
    orderingPermutationSecret: dependencies.orderingPermutationSecret,
  });
}

async function createModule(
  tx: Prisma.TransactionClient,
  draft: { id: string; ownerId: string },
  actor: SmartCoursewareActor,
  runtimeModule: GeneratedSlideModule,
  metadata: CoursewareModuleMetadata,
) {
  await tx.smartCoursewareModule.create({
    data: {
      ownerId: draft.ownerId,
      draftId: draft.id,
      runtimeModuleId: runtimeModule.id,
      moduleInstanceLineage: metadata.moduleInstanceLineage,
      activeIdentity: `${draft.id}:${runtimeModule.id}`,
      contentHash: metadata.moduleContentHash,
      sourceState: persistenceSourceStateFor(metadata.sourceState),
      sourceBindings: asJson(metadata.sourceBindings),
      sourceBindingSetHash: metadata.sourceBindingSetHash,
      gapIdentity: metadata.gapIdentity,
      provenance: persistenceProvenanceFor(metadata.provenance),
      originalAttemptId: metadata.originalAttemptId,
      teacherMetadata: asJson(metadata.teacherFields),
      revisions: { create: moduleRevisionData(actor, runtimeModule, metadata, 1, 'CREATE') },
    },
  });
}

async function updateModuleIfChanged(
  tx: Prisma.TransactionClient,
  existing: CoursewareModuleRow,
  actor: SmartCoursewareActor,
  runtimeModule: GeneratedSlideModule,
  metadata: CoursewareModuleMetadata,
) {
  if (existing.contentHash === metadata.moduleContentHash
    && existing.sourceState === persistenceSourceStateFor(metadata.sourceState)
    && existing.sourceBindingSetHash === metadata.sourceBindingSetHash
    && existing.gapIdentity === metadata.gapIdentity
    && existing.provenance === persistenceProvenanceFor(metadata.provenance)
    && contentHash(existing.teacherMetadata) === contentHash(metadata.teacherFields)) return;
  const revisionNumber = existing.currentRevisionNumber + 1;
  await tx.smartCoursewareModule.update({
    where: { id: existing.id },
    data: {
      contentHash: metadata.moduleContentHash,
      sourceState: persistenceSourceStateFor(metadata.sourceState),
      sourceBindings: asJson(metadata.sourceBindings),
      sourceBindingSetHash: metadata.sourceBindingSetHash,
      gapIdentity: metadata.gapIdentity,
      provenance: persistenceProvenanceFor(metadata.provenance),
      teacherMetadata: asJson(metadata.teacherFields),
      currentRevisionNumber: revisionNumber,
      revisions: { create: moduleRevisionData(actor, runtimeModule, metadata, revisionNumber, 'UPDATE') },
    },
  });
}

async function deleteModule(
  tx: Prisma.TransactionClient,
  existing: CoursewareModuleRow,
  actor: SmartCoursewareActor,
  runtimeModule?: GeneratedSlideModule,
) {
  const revisionNumber = existing.currentRevisionNumber + 1;
  await tx.smartCoursewareModule.update({
    where: { id: existing.id },
    data: {
      activeIdentity: null,
      deletedAt: new Date(),
      currentRevisionNumber: revisionNumber,
      revisions: {
        create: {
          ownerId: existing.ownerId,
          revisionNumber,
          changeKind: 'DELETE',
          runtimeModuleSnapshot: asJson(runtimeModule ?? { id: existing.runtimeModuleId, deleted: true }),
          teacherMetadataSnapshot: asJson(existing.teacherMetadata),
          contentHash: existing.contentHash,
          sourceState: existing.sourceState,
          sourceBindings: asJson(existing.sourceBindings),
          sourceBindingSetHash: existing.sourceBindingSetHash,
          gapIdentity: existing.gapIdentity,
          provenance: existing.provenance,
          originalAttemptIdSnapshot: existing.originalAttemptId,
          actorId: actor.id,
        },
      },
    },
  });
}

function moduleRevisionData(
  actor: SmartCoursewareActor,
  runtimeModule: GeneratedSlideModule,
  metadata: CoursewareModuleMetadata,
  revisionNumber: number,
  changeKind: 'CREATE' | 'UPDATE',
) {
  return {
    ownerId: actor.id,
    revisionNumber,
    changeKind,
    runtimeModuleSnapshot: asJson(runtimeModule),
    teacherMetadataSnapshot: asJson(metadata.teacherFields),
    contentHash: metadata.moduleContentHash,
    sourceState: persistenceSourceStateFor(metadata.sourceState),
    sourceBindings: asJson(metadata.sourceBindings),
    sourceBindingSetHash: metadata.sourceBindingSetHash,
    gapIdentity: metadata.gapIdentity,
    provenance: persistenceProvenanceFor(metadata.provenance),
    originalAttemptIdSnapshot: metadata.originalAttemptId,
    actorId: actor.id,
  };
}

type CoursewareModuleRow = Awaited<ReturnType<PrismaClient['smartCoursewareModule']['findFirstOrThrow']>>;

function publicModuleMetadata(module: CoursewareModuleRow): CoursewareModuleMetadata {
  return {
    moduleId: module.runtimeModuleId,
    moduleInstanceLineage: module.moduleInstanceLineage,
    moduleContentHash: module.contentHash,
    sourceState: module.sourceState === 'VERIFIED'
      ? 'verified'
      : module.sourceState === 'AI_GENERATED_SOURCE_PENDING'
        ? 'ai_generated_source_pending'
        : 'teacher_created_source_pending',
    sourceBindings: normalizeSourceBindings(module.sourceBindings),
    sourceBindingSetHash: module.sourceBindingSetHash,
    gapIdentity: module.gapIdentity,
    provenance: module.provenance === 'AI_GENERATED'
      ? 'ai_generated'
      : module.provenance === 'AI_GENERATED_TEACHER_EDITED'
        ? 'ai_generated_teacher_edited'
        : 'teacher_created',
    originalAttemptId: module.originalAttemptId,
    teacherFields: module.teacherMetadata as CoursewareModuleMetadata['teacherFields'],
  };
}

function allRuntimeModules(manifest: GeneratedSlideManifest): GeneratedSlideModule[] {
  return manifest.stages.flatMap((stage) => stage.steps.flatMap((step) => step.modules));
}

function moduleCopyContentHash(module: GeneratedSlideModule) {
  const { id: _id, evidencePath: _evidencePath, ...content } = module;
  return contentHash(content);
}

function assertCreateReplay<T extends { creationRequestHash: string }>(draft: T, requestHash: string) {
  if (draft.creationRequestHash !== requestHash) throw new SmartCoursewareError('idempotency-key-conflict', 409);
  return draft;
}

async function assertCoursewareApprovalReplay<T extends {
  draftId: string;
  moduleMetadataHash: string;
  approvalRequestHash: string;
}>(db: CoursewareDb, actor: SmartCoursewareActor, revision: T, draftId: string) {
  if (revision.draftId !== draftId) throw new SmartCoursewareError('idempotency-key-conflict', 409);
  const draft = await db.smartCoursewareDraft.findFirst({
    where: { id: draftId, ownerId: actor.id },
    include: { planRevision: true },
  });
  if (!draft?.contentHash || !draft.runtimeManifest) throw new SmartCoursewareError('idempotency-key-conflict', 409);
  const plan = validateSmartLessonPlan(draft.planRevision.content);
  assertPersistedCoursewareManifest({
    draftId: draft.id,
    approvedPlanTitle: plan.topic,
    manifest: draft.runtimeManifest as unknown as GeneratedSlideManifest,
    contentHash: draft.contentHash,
  });
  if (revision.approvalRequestHash !== coursewareApprovalRequestHash({
    draftId: draft.id,
    draftVersion: draft.version,
    manifestHash: draft.contentHash,
    moduleMetadataHash: revision.moduleMetadataHash,
    planRevisionId: draft.planRevisionId,
    planContentHash: draft.planContentHash,
  })) {
    throw new SmartCoursewareError('idempotency-key-conflict', 409);
  }
  return revision;
}

function coursewareApprovalRequestHash(input: {
  draftId: string;
  draftVersion: number;
  manifestHash: string;
  moduleMetadataHash: string;
  planRevisionId: string;
  planContentHash: string;
}) {
  return contentHash(input);
}

function validateActor(actor: SmartCoursewareActor): SmartCoursewareActor {
  if (!actor || typeof actor.id !== 'string' || !actor.id.trim() || !['TEACHER', 'ADMIN'].includes(actor.role)) {
    throw new SmartCoursewareError('teacher-or-admin-required', 403);
  }
  return { id: actor.id.trim(), role: actor.role };
}

function validateId(value: string) {
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (!normalized || normalized.length > 200) throw new SmartCoursewareError('id-invalid');
  return normalized;
}

function validateIdempotencyKey(value: string) {
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (!/^[A-Za-z0-9._:-]{8,160}$/.test(normalized)) throw new SmartCoursewareError('idempotency-key-invalid');
  return normalized;
}

function readableWhere(actor: SmartCoursewareActor, where: Record<string, unknown>) {
  return actor.role === 'ADMIN' ? where : { ...where, ownerId: actor.id };
}

function asJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function isUniqueConstraint(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

function isRetryableTransactionConflict(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034';
}
