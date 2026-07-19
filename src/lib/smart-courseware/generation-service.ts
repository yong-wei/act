import { randomUUID } from 'node:crypto';
import { Prisma, type PrismaClient } from '@prisma/client';

import type { GeneratedSlideManifest } from '@/features/interactive/shared/manifest-runtime/generated-slide-contract';
import { contentHash, normalizeSourceBindings } from '@/lib/smart-lesson-plan/domain';
import { validateSmartLessonPlan } from '@/lib/smart-lesson-plan/schema';

import {
  SmartCoursewareError,
  coursewareManifestHash,
  coursewareModuleGenerationInputHash,
  deriveCoursewareModuleMetadata,
  persistenceProvenanceFor,
  persistenceSourceStateFor,
  validateCoursewareComposition,
  type SmartCoursewareActor,
} from './domain';

export const COURSEWARE_GENERATION_UNITS = [
  'bridge-in', 'objective', 'pre-assessment',
  'participatory-learning', 'post-assessment', 'summary',
] as const;
export type CoursewareGenerationUnitKey = typeof COURSEWARE_GENERATION_UNITS[number];

type Db = PrismaClient;
type CommandInput = { actor: SmartCoursewareActor; jobId: string; idempotencyKey: string };

export async function startCoursewareGenerationJob(db: Db, input: {
  actor: SmartCoursewareActor;
  draftId: string;
  idempotencyKey: string;
}) {
  const actor = validateActor(input.actor);
  const idempotencyKey = validateIdempotencyKey(input.idempotencyKey);
  const requestHash = contentHash({ draftId: input.draftId });
  const replay = await findCommandReplay(db, actor, 'START', idempotencyKey, requestHash);
  if (replay) return replay;
  try {
    return await db.$transaction(async (tx) => {
      const draft = await tx.smartCoursewareDraft.findFirst({
        where: { id: validateId(input.draftId), ownerId: actor.id },
        include: { planRevision: true, modules: { where: { deletedAt: null }, take: 1 } },
      });
      if (!draft) throw new SmartCoursewareError('courseware-draft-not-found', 404);
      if (draft.state === 'ACCEPTED') throw new SmartCoursewareError('accepted-courseware-immutable', 409);
      if (draft.runtimeManifest || draft.modules.length) throw new SmartCoursewareError('courseware-already-initialized', 409);
      assertBaseline(draft);
      const active = await tx.smartCoursewareGenerationJob.findFirst({
        where: { draftId: draft.id, activeIdentity: `draft:${draft.id}` },
      });
      if (active) {
        await recordCommand(tx, active, 'START', idempotencyKey, requestHash);
        return active;
      }
      const jobId = randomUUID();
      const job = await tx.smartCoursewareGenerationJob.create({
        data: {
          id: jobId,
          ownerId: draft.ownerId,
          draftId: draft.id,
          planRevisionId: draft.planRevisionId,
          planContentHash: draft.planContentHash,
          inputHash: generationInputHash(draft),
          activeIdentity: `draft:${draft.id}`,
          units: {
            create: COURSEWARE_GENERATION_UNITS.map((unitKey, orderIndex) => ({ ownerId: draft.ownerId, unitKey, orderIndex })),
          },
          commands: {
            create: {
              ownerId: draft.ownerId, action: 'START', idempotencyKey, requestHash,
              resultSnapshot: asJson({ jobId, state: 'QUEUED' }),
            },
          },
        },
        include: { units: { orderBy: { orderIndex: 'asc' } } },
      });
      await tx.smartCoursewareDraft.update({ where: { id: draft.id }, data: { state: 'GENERATING' } });
      return job;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch (error) {
    if (isTransactionConflict(error)) {
      const replay = await findCommandReplay(db, actor, 'START', idempotencyKey, requestHash);
      if (replay) return replay;
      const active = await db.smartCoursewareGenerationJob.findFirst({
        where: { ownerId: actor.id, draftId: input.draftId, activeIdentity: `draft:${input.draftId}` },
      });
      if (active) return active;
    }
    throw error;
  }
}

export async function resumeCoursewareGenerationJob(db: Db, input: CommandInput) {
  return transitionJob(db, input, 'RESUME', ['RETRYABLE', 'FAILED', 'CANCELLED', 'RUNNING'], async (tx, job) => {
    await assertInputUnchanged(tx, job);
    if (job.mode === 'MODULE') {
      if (job.state === 'RUNNING' && (!job.moduleClaimExpiresAt || job.moduleClaimExpiresAt > new Date())) {
        throw new SmartCoursewareError('courseware-module-lease-active', 409);
      }
      return tx.smartCoursewareGenerationJob.update({
        where: { id: job.id },
        data: {
          state: 'QUEUED', activeIdentity: `draft:${job.draftId}`, firstIncompleteUnitKey: null,
          failureCode: null, cancelledAt: null, deliveryGeneration: { increment: 1 },
          moduleClaimToken: null, moduleClaimExpiresAt: null,
        },
      });
    }
    if (job.state === 'RUNNING') throw new SmartCoursewareError('courseware-job-resume-invalid', 409);
    await tx.smartCoursewareGenerationUnit.updateMany({
      where: { jobId: job.id, state: { in: ['RETRYABLE', 'FAILED', 'CANCELLED'] } },
      data: { state: 'PENDING', claimToken: null, claimExpiresAt: null },
    });
    await tx.smartCoursewareDraft.update({ where: { id: job.draftId }, data: { state: 'GENERATING' } });
    return tx.smartCoursewareGenerationJob.update({
      where: { id: job.id },
      data: { state: 'QUEUED', activeIdentity: `draft:${job.draftId}`, failureCode: null, cancelledAt: null, deliveryGeneration: { increment: 1 } },
    });
  });
}

export async function retryCoursewareGenerationJob(db: Db, input: CommandInput) {
  return transitionJob(db, input, 'RETRY', ['RETRYABLE', 'FAILED'], async (tx, job) => {
    await assertInputUnchanged(tx, job);
    if (job.mode === 'MODULE') {
      return tx.smartCoursewareGenerationJob.update({
        where: { id: job.id },
        data: {
          state: 'QUEUED', activeIdentity: `draft:${job.draftId}`, firstIncompleteUnitKey: null,
          failureCode: null, deliveryGeneration: { increment: 1 },
          moduleClaimToken: null, moduleClaimExpiresAt: null,
        },
      });
    }
    const unit = await tx.smartCoursewareGenerationUnit.findFirst({
      where: { jobId: job.id, state: { in: ['RETRYABLE', 'FAILED'] } }, orderBy: { orderIndex: 'asc' },
    });
    if (!unit) throw new SmartCoursewareError('retryable-courseware-unit-not-found', 409);
    await tx.smartCoursewareGenerationUnit.update({ where: { id: unit.id }, data: { state: 'PENDING', claimToken: null, claimExpiresAt: null } });
    await tx.smartCoursewareDraft.update({ where: { id: job.draftId }, data: { state: 'GENERATING' } });
    return tx.smartCoursewareGenerationJob.update({
      where: { id: job.id },
      data: { state: 'QUEUED', activeIdentity: `draft:${job.draftId}`, firstIncompleteUnitKey: unit.unitKey, failureCode: null, deliveryGeneration: { increment: 1 } },
    });
  });
}

export async function cancelCoursewareGenerationJob(db: Db, input: CommandInput) {
  return transitionJob(db, input, 'CANCEL', ['QUEUED', 'RUNNING', 'RETRYABLE'], async (tx, job) => {
    if (job.mode === 'MODULE') {
      await tx.smartCoursewareProviderAttempt.updateMany({
        where: { generationJobId: job.id, outcome: 'RUNNING' },
        data: { outcome: 'CANCELLED', finishedAt: new Date() },
      });
      return tx.smartCoursewareGenerationJob.update({
        where: { id: job.id },
        data: {
          state: 'CANCELLED', activeIdentity: null, firstIncompleteUnitKey: null, cancelledAt: new Date(),
          moduleClaimToken: null, moduleClaimExpiresAt: null,
        },
      });
    }
    await tx.smartCoursewareProviderAttempt.updateMany({
      where: { generationJobId: job.id, outcome: 'RUNNING' },
      data: { outcome: 'CANCELLED', finishedAt: new Date() },
    });
    await tx.smartCoursewareGenerationUnit.updateMany({
      where: { jobId: job.id, state: { in: ['PENDING', 'RUNNING', 'RETRYABLE'] } },
      data: { state: 'CANCELLED', claimToken: null, claimExpiresAt: null },
    });
    await tx.smartCoursewareDraft.update({ where: { id: job.draftId }, data: { state: 'EDITABLE' } });
    return tx.smartCoursewareGenerationJob.update({
      where: { id: job.id }, data: { state: 'CANCELLED', activeIdentity: null, cancelledAt: new Date() },
    });
  });
}

export async function beginCoursewareProviderAttempt(db: Db, input: {
  actor: SmartCoursewareActor;
  jobId: string;
  unitKey: CoursewareGenerationUnitKey;
  serviceId: string;
  providerKind: string;
  model: string;
  promptVersion: string;
  schemaVersion: string;
  request: unknown;
  leaseMs?: number;
}) {
  const actor = validateActor(input.actor);
  const now = new Date();
  const claimToken = randomUUID();
  const identity = {
    serviceId: requiredText(input.serviceId, 200), providerKind: requiredText(input.providerKind, 100),
    model: requiredText(input.model, 300), promptVersion: requiredText(input.promptVersion, 100),
    schemaVersion: requiredText(input.schemaVersion, 100), requestHash: contentHash(input.request),
  };
  return db.$transaction(async (tx) => {
    const job = await tx.smartCoursewareGenerationJob.findFirst({ where: { id: validateId(input.jobId), ownerId: actor.id } });
    if (!job || !['QUEUED', 'RUNNING'].includes(job.state)) throw new SmartCoursewareError('courseware-job-not-runnable', 409);
    let unit = await tx.smartCoursewareGenerationUnit.findUnique({ where: { jobId_unitKey: { jobId: job.id, unitKey: input.unitKey } } });
    if (!unit || unit.unitKey !== job.firstIncompleteUnitKey || unit.state === 'COMPLETED') {
      throw new SmartCoursewareError('courseware-unit-not-runnable', 409);
    }
    if (unit.state === 'RUNNING' && unit.claimExpiresAt && unit.claimExpiresAt > now) {
      const attempt = await tx.smartCoursewareProviderAttempt.findFirst({ where: { unitId: unit.id, outcome: 'RUNNING' }, orderBy: { attemptNumber: 'desc' } });
      return { claimed: false as const, claimToken: null, attempt };
    }
    if (unit.state === 'RUNNING') {
      await tx.smartCoursewareGenerationUnit.update({ where: { id: unit.id }, data: { state: 'RETRYABLE', claimToken: null, claimExpiresAt: null } });
      await tx.smartCoursewareProviderAttempt.updateMany({ where: { unitId: unit.id, outcome: 'RUNNING' }, data: { outcome: 'RETRYABLE_FAILURE', finishedAt: now } });
      unit = await tx.smartCoursewareGenerationUnit.findUniqueOrThrow({ where: { id: unit.id } });
    }
    const latest = await tx.smartCoursewareProviderAttempt.findFirst({ where: { unitId: unit.id }, orderBy: { attemptNumber: 'desc' } });
    const attemptNumber = (latest?.attemptNumber ?? 0) + 1;
    const claimed = await tx.smartCoursewareGenerationUnit.updateMany({
      where: { id: unit.id, state: { in: ['PENDING', 'RETRYABLE'] }, attemptGeneration: unit.attemptGeneration },
      data: { state: 'RUNNING', attemptGeneration: { increment: 1 }, claimToken, claimExpiresAt: new Date(now.getTime() + Math.max(60_000, input.leaseMs ?? 60_000)), startedAt: unit.startedAt ?? now },
    });
    if (claimed.count !== 1) return { claimed: false as const, claimToken: null, attempt: null };
    await tx.smartCoursewareGenerationJob.update({ where: { id: job.id }, data: { state: 'RUNNING', startedAt: job.startedAt ?? now } });
    const attempt = await tx.smartCoursewareProviderAttempt.create({
      data: {
        ownerId: job.ownerId, generationJobId: job.id, unitId: unit.id, attemptNumber,
        idempotencyKey: `smart-courseware-unit:${unit.id}:${attemptNumber}`,
        ...identity, requestSnapshot: asJson(input.request),
      },
    });
    return { claimed: true as const, claimToken, attempt };
  });
}

export async function completeCoursewareGenerationUnit(db: Db, input: {
  actor: SmartCoursewareActor;
  jobId: string;
  unitKey: CoursewareGenerationUnitKey;
  claimToken: string;
  attemptId: string;
  output: unknown;
  completedManifest?: GeneratedSlideManifest;
  completedModuleMetadata?: unknown[];
  normalizedResponseId?: string | null;
  inputTokens?: number | null;
  outputTokens?: number | null;
  costMicros?: bigint | null;
}) {
  const actor = validateActor(input.actor);
  return db.$transaction(async (tx) => {
    const job = await tx.smartCoursewareGenerationJob.findFirst({
      where: { id: validateId(input.jobId), ownerId: actor.id },
      include: { draft: { include: { planRevision: true, modules: { where: { deletedAt: null } } } }, units: { orderBy: { orderIndex: 'asc' }, include: { attempts: { orderBy: { attemptNumber: 'desc' } } } } },
    });
    if (!job) throw new SmartCoursewareError('courseware-job-not-found', 404);
    const unit = job.units.find((candidate) => candidate.unitKey === input.unitKey);
    if (!unit) throw new SmartCoursewareError('courseware-unit-not-found', 404);
    const outputHash = contentHash(input.output);
    if (unit.state === 'COMPLETED') {
      if (unit.outputHash !== outputHash) throw new SmartCoursewareError('completed-courseware-unit-output-conflict', 409);
      return job;
    }
    const attempt = unit.attempts.find((candidate) => candidate.id === input.attemptId && candidate.outcome === 'RUNNING');
    if (unit.state !== 'RUNNING' || !attempt) throw new SmartCoursewareError('courseware-unit-not-running', 409);
    const completed = await tx.smartCoursewareGenerationUnit.updateMany({
      where: { id: unit.id, state: 'RUNNING', claimToken: validateId(input.claimToken) },
      data: { state: 'COMPLETED', output: asJson(input.output), outputHash, completedAt: new Date(), claimToken: null, claimExpiresAt: null },
    });
    if (completed.count !== 1) throw new SmartCoursewareError('courseware-unit-claim-lost', 409);
    await tx.smartCoursewareProviderAttempt.update({
      where: { id: attempt.id }, data: {
        outcome: 'SUCCEEDED', normalizedResponseId: input.normalizedResponseId ?? null,
        inputTokens: input.inputTokens ?? null, outputTokens: input.outputTokens ?? null,
        costMicros: input.costMicros ?? null, finishedAt: new Date(),
      },
    });
    const next = job.units.find((candidate) => candidate.orderIndex > unit.orderIndex && candidate.state !== 'COMPLETED');
    if (next) return tx.smartCoursewareGenerationJob.update({ where: { id: job.id }, data: { firstIncompleteUnitKey: next.unitKey } });
    if (!input.completedManifest || !input.completedModuleMetadata) throw new SmartCoursewareError('completed-courseware-manifest-required', 409);
    await persistCompletedManifest(tx, actor, job, input.completedManifest, input.completedModuleMetadata, attempt.id);
    return tx.smartCoursewareGenerationJob.update({
      where: { id: job.id }, data: { state: 'COMPLETED', activeIdentity: null, completedAt: new Date(), firstIncompleteUnitKey: 'summary' },
    });
  });
}

export async function failCoursewareGenerationUnit(db: Db, input: {
  actor: SmartCoursewareActor; jobId: string; unitKey: CoursewareGenerationUnitKey;
  claimToken: string; attemptId: string; failureCode: string; retryable: boolean;
}) {
  const actor = validateActor(input.actor);
  return db.$transaction(async (tx) => {
    const job = await tx.smartCoursewareGenerationJob.findFirst({ where: { id: input.jobId, ownerId: actor.id } });
    if (!job) throw new SmartCoursewareError('courseware-job-not-found', 404);
    const unit = await tx.smartCoursewareGenerationUnit.findUnique({ where: { jobId_unitKey: { jobId: job.id, unitKey: input.unitKey } } });
    if (!unit || unit.state !== 'RUNNING') throw new SmartCoursewareError('courseware-unit-not-running', 409);
    const state = input.retryable ? 'RETRYABLE' : 'FAILED';
    const failed = await tx.smartCoursewareGenerationUnit.updateMany({
      where: { id: unit.id, state: 'RUNNING', claimToken: input.claimToken },
      data: { state, claimToken: null, claimExpiresAt: null },
    });
    if (failed.count !== 1) throw new SmartCoursewareError('courseware-unit-claim-lost', 409);
    await tx.smartCoursewareProviderAttempt.updateMany({
      where: { id: input.attemptId, unitId: unit.id, outcome: 'RUNNING' },
      data: { outcome: input.retryable ? 'RETRYABLE_FAILURE' : 'PERMANENT_FAILURE', finishedAt: new Date() },
    });
    await tx.smartCoursewareDraft.update({ where: { id: job.draftId }, data: { state: 'EDITABLE' } });
    return tx.smartCoursewareGenerationJob.update({
      where: { id: job.id }, data: { state, activeIdentity: null, failureCode: requiredText(input.failureCode, 200), firstIncompleteUnitKey: unit.unitKey },
    });
  });
}

async function persistCompletedManifest(tx: Prisma.TransactionClient, actor: SmartCoursewareActor, job: JobWithContext, manifest: GeneratedSlideManifest, rawMetadata: unknown[], finalAttemptId: string) {
  if (job.draft.modules.length || job.draft.runtimeManifest) throw new SmartCoursewareError('courseware-already-initialized', 409);
  assertBaseline(job.draft);
  const plan = validateSmartLessonPlan(job.draft.planRevision.content);
  const allowed = authoritativeBindingsFromAttempts(job, plan.sources.map((binding) => binding.sourceVersionId));
  const composition = validateCoursewareComposition(
    { expectedVersion: job.draft.version, runtimeManifest: manifest, moduleMetadata: rawMetadata },
    { ...plan, sources: allowed },
  );
  const metadataById = new Map(composition.moduleMetadata.map((item) => [item.moduleId, item]));
  const attemptByStage = new Map<string, string>([
    ...job.units.flatMap((unit): Array<[string, string]> => unit.attempts[0]?.id ? [[unit.unitKey, unit.attempts[0].id]] : []),
    ['summary', finalAttemptId],
  ]);
  for (const stage of composition.runtimeManifest.stages) {
    for (const step of stage.steps) {
      for (const runtimeModule of step.modules) {
        const metadata = deriveCoursewareModuleMetadata({
          authoringLineageRoot: job.draft.authoringLineageRoot, runtimeModule,
          requested: metadataById.get(runtimeModule.id)!, allowedSourceBindings: allowed,
          newProvenance: 'ai_generated', originalAttemptId: attemptByStage.get(stage.stage) ?? finalAttemptId,
        });
        await tx.smartCoursewareModule.create({ data: {
          ownerId: job.ownerId, draftId: job.draftId, runtimeModuleId: runtimeModule.id,
          moduleInstanceLineage: metadata.moduleInstanceLineage, activeIdentity: `${job.draftId}:${runtimeModule.id}`,
          contentHash: metadata.moduleContentHash, sourceState: persistenceSourceStateFor(metadata.sourceState),
          sourceBindings: asJson(metadata.sourceBindings), sourceBindingSetHash: metadata.sourceBindingSetHash,
          gapIdentity: metadata.gapIdentity, provenance: persistenceProvenanceFor(metadata.provenance),
          originalAttemptId: metadata.originalAttemptId, teacherMetadata: asJson(metadata.teacherFields),
          revisions: { create: {
            ownerId: job.ownerId, revisionNumber: 1, changeKind: 'GENERATE', runtimeModuleSnapshot: asJson(runtimeModule),
            teacherMetadataSnapshot: asJson(metadata.teacherFields), contentHash: metadata.moduleContentHash,
            sourceState: persistenceSourceStateFor(metadata.sourceState), sourceBindings: asJson(metadata.sourceBindings),
            sourceBindingSetHash: metadata.sourceBindingSetHash, gapIdentity: metadata.gapIdentity,
            provenance: persistenceProvenanceFor(metadata.provenance),
            generationJobId: job.id,
            providerAttemptId: metadata.originalAttemptId,
            originalAttemptIdSnapshot: metadata.originalAttemptId,
            actorId: actor.id,
          } },
        } });
      }
    }
  }
  await tx.smartCoursewareDraft.update({ where: { id: job.draftId }, data: {
    state: 'READY', version: { increment: 1 }, runtimeManifest: asJson(composition.runtimeManifest),
    contentHash: coursewareManifestHash(composition.runtimeManifest), validationSnapshot: asJson(composition.validation),
  } });
}

type JobWithContext = Awaited<ReturnType<Prisma.TransactionClient['smartCoursewareGenerationJob']['findFirstOrThrow']>> & {
  draft: Awaited<ReturnType<Prisma.TransactionClient['smartCoursewareDraft']['findFirstOrThrow']>> & { planRevision: Awaited<ReturnType<Prisma.TransactionClient['smartLessonRevision']['findFirstOrThrow']>>; modules: unknown[] };
  units: Array<Awaited<ReturnType<Prisma.TransactionClient['smartCoursewareGenerationUnit']['findFirstOrThrow']>> & { attempts: Array<Awaited<ReturnType<Prisma.TransactionClient['smartCoursewareProviderAttempt']['findFirstOrThrow']>>> }>;
};

async function transitionJob(db: Db, input: CommandInput, action: string, allowedStates: string[], transition: (tx: Prisma.TransactionClient, job: any) => Promise<any>) {
  const actor = validateActor(input.actor);
  const idempotencyKey = validateIdempotencyKey(input.idempotencyKey);
  const requestHash = contentHash({ jobId: input.jobId });
  const replay = await findCommandReplay(db, actor, action, idempotencyKey, requestHash);
  if (replay) return replay;
  try {
    return await db.$transaction(async (tx) => {
      const job = await tx.smartCoursewareGenerationJob.findFirst({ where: { id: validateId(input.jobId), ownerId: actor.id } });
      if (!job) throw new SmartCoursewareError('courseware-job-not-found', 404);
      if (!allowedStates.includes(job.state)) throw new SmartCoursewareError(`courseware-job-${action.toLowerCase()}-invalid`, 409);
      const updated = await transition(tx, job);
      await recordCommand(tx, job, action, idempotencyKey, requestHash, updated);
      return updated;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch (error) {
    if (isTransactionConflict(error)) {
      const replayAfterConflict = await findCommandReplay(db, actor, action, idempotencyKey, requestHash);
      if (replayAfterConflict) return replayAfterConflict;
    }
    throw error;
  }
}

function authoritativeBindingsFromAttempts(job: JobWithContext, selectedVersionIds: string[]) {
  const selected = new Set(selectedVersionIds);
  const snapshots = job.units.flatMap((unit) => unit.attempts
    .filter((attempt) => attempt.outcome === 'SUCCEEDED' || attempt.outcome === 'RUNNING')
    .slice(0, 1)
    .flatMap((attempt) => {
      const snapshot = attempt.requestSnapshot;
      if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) return [];
      const bindings = (snapshot as Record<string, unknown>).authoritativeSourceBindings;
      return Array.isArray(bindings) ? bindings : [];
    }));
  const normalized = normalizeSourceBindings(snapshots);
  if (!normalized.length || normalized.some((binding) => !selected.has(binding.sourceVersionId))) {
    throw new SmartCoursewareError('governed-source-evidence-unavailable', 409);
  }
  return normalized;
}

async function assertInputUnchanged(tx: Prisma.TransactionClient, job: {
  draftId: string;
  inputHash: string;
  mode: string;
  targetModuleId?: string | null;
  targetModuleHash?: string | null;
}) {
  const draft = await tx.smartCoursewareDraft.findUnique({
    where: { id: job.draftId },
    include: { planRevision: true, modules: { where: { deletedAt: null } } },
  });
  if (!draft) throw new SmartCoursewareError('courseware-generation-input-changed', 409);
  if (job.mode === 'MODULE') {
    const runtimeManifest = draft.runtimeManifest as unknown as GeneratedSlideManifest | null;
    const runtimeModule = runtimeManifest?.stages
      .flatMap((stage) => stage.steps.flatMap((step) => step.modules))
      .find((module) => module.id === job.targetModuleId);
    const stored = draft.modules.find((module) => module.runtimeModuleId === job.targetModuleId);
    if (!runtimeModule || !stored || !job.targetModuleId || !job.targetModuleHash
      || stored.contentHash !== job.targetModuleHash
      || contentHash(runtimeModule) !== job.targetModuleHash
      || coursewareModuleGenerationInputHash({
        draftId: draft.id,
        draftVersion: draft.version,
        planRevisionId: draft.planRevisionId,
        planContentHash: draft.planContentHash,
        moduleId: job.targetModuleId,
        moduleHash: job.targetModuleHash,
      }) !== job.inputHash) {
      throw new SmartCoursewareError('courseware-generation-input-changed', 409);
    }
    return;
  }
  if (generationInputHash(draft) !== job.inputHash) throw new SmartCoursewareError('courseware-generation-input-changed', 409);
}

function assertBaseline(draft: { planRevisionId: string; planRevisionNumber: number; planContentHash: string; planRevision: { id: string; revisionNumber: number; contentHash: string; content: unknown } }) {
  if (draft.planRevisionId !== draft.planRevision.id || draft.planRevisionNumber !== draft.planRevision.revisionNumber
    || draft.planContentHash !== draft.planRevision.contentHash || contentHash(draft.planRevision.content) !== draft.planContentHash) {
    throw new SmartCoursewareError('approved-plan-baseline-changed', 409);
  }
}

function generationInputHash(draft: { id: string; planRevisionId: string; planRevisionNumber: number; planContentHash: string; authoringLineageRoot: string }) {
  return contentHash({ draftId: draft.id, planRevisionId: draft.planRevisionId, planRevisionNumber: draft.planRevisionNumber, planContentHash: draft.planContentHash, authoringLineageRoot: draft.authoringLineageRoot });
}

async function findCommandReplay(db: Db, actor: SmartCoursewareActor, action: string, key: string, requestHash: string) {
  const command = await db.smartCoursewareGenerationCommand.findFirst({ where: { ownerId: actor.id, action, idempotencyKey: key } });
  if (!command) return null;
  if (command.requestHash !== requestHash) throw new SmartCoursewareError('idempotency-key-conflict', 409);
  return db.smartCoursewareGenerationJob.findFirst({ where: { id: command.jobId, ownerId: actor.id } });
}

async function recordCommand(tx: Prisma.TransactionClient, job: { id: string; ownerId: string }, action: string, key: string, requestHash: string, result: unknown = job) {
  await tx.smartCoursewareGenerationCommand.create({ data: { ownerId: job.ownerId, jobId: job.id, action, idempotencyKey: key, requestHash, resultSnapshot: asJson(result) } });
}

function validateActor(actor: SmartCoursewareActor) {
  if (!actor?.id?.trim() || !['TEACHER', 'ADMIN'].includes(actor.role)) throw new SmartCoursewareError('teacher-or-admin-required', 403);
  return { id: actor.id.trim(), role: actor.role };
}
function validateId(value: string) { return requiredText(value, 200); }
function validateIdempotencyKey(value: string) {
  const key = requiredText(value, 160);
  if (!/^[A-Za-z0-9._:-]{8,160}$/.test(key)) throw new SmartCoursewareError('idempotency-key-invalid');
  return key;
}
function requiredText(value: string, max: number) {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text || text.length > max) throw new SmartCoursewareError('text-invalid');
  return text;
}
function asJson(value: unknown): Prisma.InputJsonValue { return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue; }
function isTransactionConflict(error: unknown) { return error instanceof Prisma.PrismaClientKnownRequestError && ['P2002', 'P2034'].includes(error.code); }
