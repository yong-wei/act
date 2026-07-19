import { randomUUID } from 'node:crypto';
import { Prisma, type PrismaClient } from '@prisma/client';

import type { GeneratedSlideManifest, GeneratedSlideModule } from '@/features/interactive/shared/manifest-runtime/generated-slide-contract';
import { buildCourseBasisLessonDesignSar, buildCourseBasisLessonDesignSourcePack } from '@/lib/course-basis/lesson-design-source-pack';
import { contentHash, normalizeSourceBindings } from '@/lib/smart-lesson-plan/domain';
import { validateSmartLessonPlan } from '@/lib/smart-lesson-plan/schema';

import {
  SmartCoursewareError,
  assertCoursewareManifestIdentity,
  assertPersistedCoursewareManifest,
  coursewareManifestHash,
  coursewareModuleGenerationInputHash,
  deriveCoursewareModuleMetadata,
  persistenceProvenanceFor,
  persistenceSourceStateFor,
  validateCoursewareComposition,
  type SmartCoursewareActor,
} from './domain';
import { resolveSmartCoursewareStructuredProvider, SMART_COURSEWARE_PROMPT_VERSION } from './provider-runtime';
import { coursewareModuleCandidateOutputSchema, type CoursewareModuleMetadataInput } from './schema';

type Db = PrismaClient;
type Dependencies = {
  resolveProvider?: typeof resolveSmartCoursewareStructuredProvider;
  buildSar?: typeof buildCourseBasisLessonDesignSar;
  buildSourcePack?: typeof buildCourseBasisLessonDesignSourcePack;
  now?: () => Date;
  leaseMs?: number;
};
type EnqueueModuleJob = (db: Db, jobId: string) => Promise<unknown>;

export async function requestCoursewareModuleRegeneration(db: Db, input: {
  actor: SmartCoursewareActor;
  draftId: string;
  moduleId: string;
  idempotencyKey: string;
}, dependencies: { enqueue?: EnqueueModuleJob } = {}) {
  const actor = validateActor(input.actor);
  const draftId = requiredText(input.draftId, 200);
  const moduleId = requiredText(input.moduleId, 96);
  const idempotencyKey = validateIdempotencyKey(input.idempotencyKey);
  const requestHash = contentHash({ draftId, moduleId });
  const replay = await findCommandReplay(db, actor, 'MODULE_REQUEST', idempotencyKey, requestHash);
  if (replay) return enqueueRequestedModuleJob(db, actor, replay, dependencies.enqueue);

  const draft = await db.smartCoursewareDraft.findFirst({
    where: { id: draftId, ownerId: actor.id },
    include: { planRevision: true, modules: { where: { runtimeModuleId: moduleId, deletedAt: null } } },
  });
  if (!draft) throw new SmartCoursewareError('courseware-draft-not-found', 404);
  if (!draft.runtimeManifest || draft.state === 'GENERATING') throw new SmartCoursewareError('courseware-manifest-not-ready', 409);
  assertMutableDraftState(draft.state);
  assertBaseline(draft);
  const plan = validateSmartLessonPlan(draft.planRevision.content);
  assertPersistedCoursewareManifest({
    draftId: draft.id,
    approvedPlanTitle: plan.topic,
    manifest: draft.runtimeManifest as unknown as GeneratedSlideManifest,
    contentHash: draft.contentHash,
  });
  const runtimeModule = findRuntimeModule(draft.runtimeManifest as unknown as GeneratedSlideManifest, moduleId);
  const stored = draft.modules[0];
  if (!runtimeModule || !stored || stored.contentHash !== contentHash(runtimeModule)) {
    throw new SmartCoursewareError('courseware-module-baseline-mismatch', 409);
  }

  try {
    const created = await db.$transaction(async (tx) => {
      const currentDraft = await tx.smartCoursewareDraft.findUnique({
        where: { id: draft.id },
        select: { state: true, version: true, contentHash: true },
      });
      if (!currentDraft) throw new SmartCoursewareError('courseware-draft-not-found', 404);
      assertMutableDraftState(currentDraft.state);
      if (currentDraft.version !== draft.version || currentDraft.contentHash !== draft.contentHash) {
        throw new SmartCoursewareError('courseware-version-conflict', 409);
      }
      const jobId = randomUUID();
      return tx.smartCoursewareGenerationJob.create({
        data: {
          id: jobId,
          ownerId: draft.ownerId,
          draftId: draft.id,
          planRevisionId: draft.planRevisionId,
          planContentHash: draft.planContentHash,
          inputHash: coursewareModuleGenerationInputHash({
            draftId: draft.id,
            draftVersion: draft.version,
            planRevisionId: draft.planRevisionId,
            planContentHash: draft.planContentHash,
            moduleId,
            moduleHash: stored.contentHash,
          }),
          mode: 'MODULE',
          targetModuleId: moduleId,
          targetModuleHash: stored.contentHash,
          activeIdentity: `draft:${draft.id}`,
          firstIncompleteUnitKey: null,
          commands: { create: {
            ownerId: draft.ownerId,
            action: 'MODULE_REQUEST',
            idempotencyKey,
            requestHash,
            resultSnapshot: asJson({ jobId, state: 'QUEUED', mode: 'MODULE' }),
          } },
        },
      });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    return enqueueRequestedModuleJob(db, actor, created, dependencies.enqueue);
  } catch (error) {
    if (isTransactionConflict(error)) {
      const raced = await findCommandReplay(db, actor, 'MODULE_REQUEST', idempotencyKey, requestHash);
      if (raced) return enqueueRequestedModuleJob(db, actor, raced, dependencies.enqueue);
      const active = await db.smartCoursewareGenerationJob.findFirst({
        where: { ownerId: actor.id, activeIdentity: `draft:${draft.id}` },
      });
      if (active) return enqueueRequestedModuleJob(db, actor, active, dependencies.enqueue);
    }
    throw error;
  }
}

async function enqueueRequestedModuleJob(db: Db, actor: SmartCoursewareActor, job: { id: string; state: string }, override?: EnqueueModuleJob) {
  if (job.state === 'QUEUED') {
    const enqueue = override ?? (await import('./queue')).enqueueCoursewareGenerationJob;
    await enqueue(db, job.id);
  }
  return getCoursewareGenerationJob(db, { actor, jobId: job.id });
}

export async function getCoursewareGenerationJob(db: Db, input: {
  actor: SmartCoursewareActor;
  jobId: string;
}) {
  const actor = validateActor(input.actor);
  const job = await db.smartCoursewareGenerationJob.findFirst({
    where: actor.role === 'ADMIN'
      ? { id: requiredText(input.jobId, 200) }
      : { id: requiredText(input.jobId, 200), ownerId: actor.id },
    include: { units: { orderBy: { orderIndex: 'asc' } } },
  });
  if (!job) throw new SmartCoursewareError('courseware-job-not-found', 404);
  return job;
}

export async function generateCoursewareModuleCandidate(
  db: Db,
  input: { actor: SmartCoursewareActor; jobId: string },
  dependencies: Dependencies = {},
) {
  const actor = validateActor(input.actor);
  const jobId = requiredText(input.jobId, 200);
  const now = dependencies.now?.() ?? new Date();
  const claimToken = randomUUID();
  let providerAttemptId: string | null = null;
  const claimed = await db.smartCoursewareGenerationJob.updateMany({
    where: {
      id: jobId,
      ownerId: actor.id,
      mode: 'MODULE',
      draft: { state: { not: 'ACCEPTED' } },
      OR: [
        { state: 'QUEUED' },
        { state: 'RUNNING', moduleClaimExpiresAt: { lte: now } },
      ],
    },
    data: {
      state: 'RUNNING',
      startedAt: now,
      moduleAttemptGeneration: { increment: 1 },
      moduleClaimToken: claimToken,
      moduleClaimExpiresAt: new Date(now.getTime() + Math.max(10_000, dependencies.leaseMs ?? 60_000)),
    },
  });
  if (claimed.count !== 1) {
    const current = await getCoursewareGenerationJob(db, { actor, jobId });
    const currentDraft = await db.smartCoursewareDraft.findUnique({
      where: { id: current.draftId },
      select: { state: true },
    });
    if (!currentDraft) throw new SmartCoursewareError('courseware-draft-not-found', 404);
    assertMutableDraftState(currentDraft.state);
    if (current.mode === 'MODULE' && current.state === 'RUNNING') {
      throw new SmartCoursewareError('courseware-module-lease-active', 503);
    }
    return current;
  }

  try {
    const job = await db.smartCoursewareGenerationJob.findFirstOrThrow({
      where: { id: jobId, ownerId: actor.id, mode: 'MODULE', state: 'RUNNING', moduleClaimToken: claimToken },
      include: { draft: { include: { planRevision: true, modules: { where: { deletedAt: null } } } } },
    });
    assertBaseline(job.draft);
    assertMutableDraftState(job.draft.state);
    if (job.planRevisionId !== job.draft.planRevisionId || job.planContentHash !== job.draft.planContentHash) {
      throw new SmartCoursewareError('courseware-module-job-baseline-changed', 409);
    }
    const manifest = job.draft.runtimeManifest as unknown as GeneratedSlideManifest | null;
    const plan = validateSmartLessonPlan(job.draft.planRevision.content);
    assertPersistedCoursewareManifest({
      draftId: job.draft.id,
      approvedPlanTitle: plan.topic,
      manifest,
      contentHash: job.draft.contentHash,
    });
    const location = manifest && findRuntimeLocation(manifest, job.targetModuleId!);
    const stored = job.draft.modules.find((module) => module.runtimeModuleId === job.targetModuleId);
    if (!location || !stored || stored.contentHash !== job.targetModuleHash || contentHash(location.runtimeModule) !== job.targetModuleHash) {
      throw new SmartCoursewareError('courseware-module-baseline-mismatch', 409);
    }
    const selectedVersionIds = [...new Set(plan.sources.map((binding) => binding.sourceVersionId))];
    if (!selectedVersionIds.length) throw new SmartCoursewareError('governed-source-evidence-unavailable', 409);
    const query = [plan.topic, ...plan.goals.map((goal) => goal.content), location.stage.stage, location.step.title].join('\n').slice(0, 4_000);
    const sourceActor = { id: job.ownerId, role: 'TEACHER' as const };
    const sar = await (dependencies.buildSar ?? buildCourseBasisLessonDesignSar)(db, {
      actor: sourceActor, selectedVersionIds, explicitRetiredVersionIds: selectedVersionIds, query,
    });
    const sourcePack = await (dependencies.buildSourcePack ?? buildCourseBasisLessonDesignSourcePack)(db, {
      actor: sourceActor, selectedVersionIds, explicitRetiredVersionIds: selectedVersionIds, sar,
      retrieval: { query, topK: 12 },
    });
    const authoritativeBindings = normalizeSourceBindings(sourcePack.retrieval.pack.items.map((item) => ({
      citationId: item.citationTargetId ?? item.citation?.citationTargetId,
      sourceVersionId: item.metadata?.versionId,
      anchor: item.metadata?.stableAnchor,
      contentHash: item.metadata?.contentHash,
    })));
    if (!authoritativeBindings.length) throw new SmartCoursewareError('governed-source-evidence-unavailable', 409);
    const request = {
      planBaseline: { revisionId: job.planRevisionId, contentHash: job.planContentHash },
      goals: plan.goals,
      stage: location.stage,
      step: location.step,
      selectedModule: location.runtimeModule,
      authoritativeSourceBindings: authoritativeBindings,
    };
    const runtime = await (dependencies.resolveProvider ?? resolveSmartCoursewareStructuredProvider)();
    const attempt = await db.$transaction(async (tx) => {
      const attemptNow = dependencies.now?.() ?? new Date();
      const ownsClaim = await tx.smartCoursewareGenerationJob.updateMany({
        where: {
          id: job.id,
          ownerId: actor.id,
          mode: 'MODULE',
          state: 'RUNNING',
          moduleAttemptGeneration: job.moduleAttemptGeneration,
          moduleClaimToken: claimToken,
          moduleClaimExpiresAt: { gt: attemptNow },
        },
        data: { moduleClaimToken: claimToken },
      });
      if (ownsClaim.count !== 1) throw new SmartCoursewareError('courseware-module-job-claim-lost', 409);
      await tx.smartCoursewareProviderAttempt.updateMany({
        where: {
          generationJobId: job.id,
          unitId: null,
          outcome: 'RUNNING',
          attemptNumber: { lt: job.moduleAttemptGeneration },
        },
        data: { outcome: 'RETRYABLE_FAILURE', finishedAt: attemptNow },
      });
      return tx.smartCoursewareProviderAttempt.create({
        data: {
          ownerId: job.ownerId,
          generationJobId: job.id,
          unitId: null,
          attemptNumber: job.moduleAttemptGeneration,
          idempotencyKey: `smart-courseware-module:${job.id}:${job.moduleAttemptGeneration}`,
          serviceId: runtime.serviceId,
          providerKind: runtime.providerKind,
          model: runtime.model,
          promptVersion: SMART_COURSEWARE_PROMPT_VERSION,
          schemaVersion: 'smart-courseware-module-candidate.v1',
          requestHash: contentHash(request),
          requestSnapshot: asJson(request),
          startedAt: attemptNow,
        },
      });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    providerAttemptId = attempt.id;
    const generated = await runtime.generate({
      schema: coursewareModuleCandidateOutputSchema,
      schemaVersion: 'smart-courseware-module-candidate.v1',
      system: '仅重新生成指定课件模块。不得输出或修改相邻模块、步骤顺序、阶段时长或已批准教案基线。来源只能使用服务端提供的权威绑定；来源状态为 verified 时，teacherFields.inclusionRationale 必须说明引用证据与模块内容的关系。',
      prompt: JSON.stringify(request),
      idempotencyKey: attempt.idempotencyKey,
    });
    const candidate = coursewareModuleCandidateOutputSchema.parse(generated.output);
    assertCandidateBoundary(candidate, job.targetModuleId!, authoritativeBindings);
    const candidateHash = contentHash(candidate);
    const attemptCompleted = await db.smartCoursewareProviderAttempt.updateMany({
      where: { id: attempt.id, generationJobId: job.id, outcome: 'RUNNING' },
      data: {
        outcome: 'SUCCEEDED',
        normalizedResponseId: generated.normalizedResponseId,
        inputTokens: generated.inputTokens,
        outputTokens: generated.outputTokens,
        costMicros: generated.costMicros,
        finishedAt: new Date(),
      },
    });
    if (attemptCompleted.count !== 1) throw new SmartCoursewareError('courseware-module-provider-attempt-lost', 409);
    const completed = await db.smartCoursewareGenerationJob.updateMany({
      where: {
        id: job.id,
        ownerId: actor.id,
        mode: 'MODULE',
        state: 'RUNNING',
        targetModuleHash: job.targetModuleHash,
        moduleAttemptGeneration: job.moduleAttemptGeneration,
        moduleClaimToken: claimToken,
      },
      data: {
        state: 'COMPLETED', activeIdentity: null, completedAt: new Date(),
        moduleClaimToken: null, moduleClaimExpiresAt: null,
        sourceBindingsSnapshot: asJson(authoritativeBindings),
        candidateRuntimeModule: asJson(candidate.runtimeModule),
        candidateModuleMetadata: asJson(candidate.moduleMetadata),
        candidateHash,
        providerAudit: asJson({
          latestAttemptId: attempt.id,
          attemptNumber: attempt.attemptNumber,
          outcome: 'SUCCEEDED',
        }),
      },
    });
    if (completed.count !== 1) throw new SmartCoursewareError('courseware-module-job-claim-lost', 409);
    return getCoursewareGenerationJob(db, { actor, jobId });
  } catch (error) {
    const retryable = isRetryableModuleFailure(error, providerAttemptId !== null);
    if (providerAttemptId) {
      await db.smartCoursewareProviderAttempt.updateMany({
        where: { id: providerAttemptId, generationJobId: jobId, outcome: 'RUNNING' },
        data: {
          outcome: retryable ? 'RETRYABLE_FAILURE' : 'PERMANENT_FAILURE',
          finishedAt: new Date(),
        },
      });
    }
    const failureNow = dependencies.now?.() ?? new Date();
    await db.smartCoursewareGenerationJob.updateMany({
      where: {
        id: jobId,
        ownerId: actor.id,
        mode: 'MODULE',
        state: 'RUNNING',
        moduleClaimToken: claimToken,
        moduleClaimExpiresAt: { gt: failureNow },
      },
      data: {
        state: retryable ? 'RETRYABLE' : 'FAILED', activeIdentity: null, failureCode: errorCode(error),
        moduleClaimToken: null, moduleClaimExpiresAt: null,
        providerAudit: providerAttemptId ? asJson({
          latestAttemptId: providerAttemptId,
          outcome: retryable ? 'RETRYABLE_FAILURE' : 'PERMANENT_FAILURE',
        }) : undefined,
      },
    });
    throw error;
  }
}

export async function acceptCoursewareModuleCandidate(db: Db, input: {
  actor: SmartCoursewareActor;
  jobId: string;
  expectedDraftVersion: number;
  expectedModuleHash: string;
  idempotencyKey: string;
}) {
  const actor = validateActor(input.actor);
  const jobId = requiredText(input.jobId, 200);
  const expectedModuleHash = requiredText(input.expectedModuleHash, 128);
  const idempotencyKey = validateIdempotencyKey(input.idempotencyKey);
  const requestHash = contentHash({ jobId, expectedDraftVersion: input.expectedDraftVersion, expectedModuleHash });
  const replay = await findCommandReplay(db, actor, 'MODULE_ACCEPT', idempotencyKey, requestHash);
  if (replay) return replay;

  try {
    await db.$transaction(async (tx) => {
      const job = await tx.smartCoursewareGenerationJob.findFirst({
        where: { id: jobId, ownerId: actor.id, mode: 'MODULE', state: 'COMPLETED', acceptedAt: null },
        include: { draft: { include: { planRevision: true, modules: { where: { deletedAt: null } } } } },
      });
      if (!job || !job.candidateRuntimeModule || !job.candidateModuleMetadata || !job.sourceBindingsSnapshot) {
        throw new SmartCoursewareError('courseware-module-candidate-not-found', 404);
      }
      const draft = job.draft;
      if (draft.version !== input.expectedDraftVersion) throw new SmartCoursewareError('courseware-version-conflict', 409);
      assertMutableDraftState(draft.state);
      if (draft.state === 'GENERATING' || !draft.runtimeManifest) {
        throw new SmartCoursewareError('courseware-module-accept-invalid', 409);
      }
      assertBaseline(draft);
      if (job.planRevisionId !== draft.planRevisionId || job.planContentHash !== draft.planContentHash) {
        throw new SmartCoursewareError('courseware-module-job-baseline-changed', 409);
      }
      const target = draft.modules.find((module) => module.runtimeModuleId === job.targetModuleId);
      const manifest = draft.runtimeManifest as unknown as GeneratedSlideManifest;
      const currentLocation = findRuntimeLocation(manifest, job.targetModuleId!);
      if (!target || !currentLocation || target.contentHash !== expectedModuleHash
        || target.contentHash !== job.targetModuleHash || contentHash(currentLocation.runtimeModule) !== expectedModuleHash) {
        throw new SmartCoursewareError('courseware-module-hash-conflict', 409);
      }
      const candidate = coursewareModuleCandidateOutputSchema.parse({
        runtimeModule: job.candidateRuntimeModule,
        moduleMetadata: job.candidateModuleMetadata,
      });
      if (contentHash(candidate) !== job.candidateHash) {
        throw new SmartCoursewareError('courseware-module-candidate-hash-mismatch', 409);
      }
      const authoritativeBindings = normalizeSourceBindings(job.sourceBindingsSnapshot);
      assertCandidateBoundary(candidate, job.targetModuleId!, authoritativeBindings);
      const nextManifest = replaceRuntimeModule(manifest, job.targetModuleId!, candidate.runtimeModule);
      assertOnlyTargetModuleChanged(manifest, nextManifest, job.targetModuleId!);
      const plan = validateSmartLessonPlan(draft.planRevision.content);
      assertPersistedCoursewareManifest({
        draftId: draft.id,
        approvedPlanTitle: plan.topic,
        manifest,
        contentHash: draft.contentHash,
      });
      const selectedVersions = new Set(plan.sources.map((binding) => binding.sourceVersionId));
      if (authoritativeBindings.some((binding) => !selectedVersions.has(binding.sourceVersionId))) {
        throw new SmartCoursewareError('generated-source-binding-unverified', 409);
      }
      const metadata = draft.modules.map(publicModuleMetadata).map((item) =>
        item.moduleId === job.targetModuleId ? candidate.moduleMetadata : item);
      const composition = validateCoursewareComposition({
        expectedVersion: input.expectedDraftVersion,
        runtimeManifest: nextManifest,
        moduleMetadata: metadata,
      }, plan);
      assertCoursewareManifestIdentity({
        draftId: draft.id,
        approvedPlanTitle: plan.topic,
        manifest: composition.runtimeManifest,
      });
      const providerAttempt = await tx.smartCoursewareProviderAttempt.findFirst({
        where: {
          generationJobId: job.id,
          attemptNumber: job.moduleAttemptGeneration,
          outcome: 'SUCCEEDED',
        },
      });
      if (!providerAttempt) throw new SmartCoursewareError('courseware-module-provider-audit-missing', 409);
      const derived = deriveCoursewareModuleMetadata({
        authoringLineageRoot: draft.authoringLineageRoot,
        runtimeModule: candidate.runtimeModule,
        requested: candidate.moduleMetadata,
        allowedSourceBindings: authoritativeBindings,
        existing: target,
        newProvenance: 'ai_generated',
        originalAttemptId: providerAttempt.id,
      });

      const accepted = await tx.smartCoursewareGenerationJob.updateMany({
        where: { id: job.id, ownerId: actor.id, mode: 'MODULE', state: 'COMPLETED', acceptedAt: null, candidateHash: job.candidateHash },
        data: { acceptedAt: new Date() },
      });
      if (accepted.count !== 1) throw new SmartCoursewareError('courseware-module-candidate-already-accepted', 409);
      const draftClaim = await tx.smartCoursewareDraft.updateMany({
        where: {
          id: draft.id, ownerId: actor.id, version: input.expectedDraftVersion,
          planRevisionId: job.planRevisionId, planContentHash: job.planContentHash,
          state: { in: ['EDITABLE', 'READY'] },
        },
        data: {
          state: 'READY', version: { increment: 1 }, runtimeManifest: asJson(composition.runtimeManifest),
          contentHash: coursewareManifestHash(composition.runtimeManifest), validationSnapshot: asJson(composition.validation),
        },
      });
      if (draftClaim.count !== 1) throw new SmartCoursewareError('courseware-version-conflict', 409);
      const revisionNumber = target.currentRevisionNumber + 1;
      const moduleClaim = await tx.smartCoursewareModule.updateMany({
        where: { id: target.id, draftId: draft.id, deletedAt: null, contentHash: expectedModuleHash, currentRevisionNumber: target.currentRevisionNumber },
        data: {
          contentHash: derived.moduleContentHash,
          sourceState: persistenceSourceStateFor(derived.sourceState),
          sourceBindings: asJson(derived.sourceBindings),
          sourceBindingSetHash: derived.sourceBindingSetHash,
          gapIdentity: derived.gapIdentity,
          provenance: persistenceProvenanceFor(derived.provenance),
          originalAttemptId: derived.originalAttemptId,
          teacherMetadata: asJson(derived.teacherFields),
          currentRevisionNumber: revisionNumber,
        },
      });
      if (moduleClaim.count !== 1) throw new SmartCoursewareError('courseware-module-hash-conflict', 409);
      const acceptedCommandId = randomUUID();
      await tx.smartCoursewareGenerationCommand.create({ data: {
        id: acceptedCommandId,
        ownerId: actor.id,
        jobId: job.id,
        action: 'MODULE_ACCEPT',
        idempotencyKey,
        requestHash,
        resultSnapshot: asJson({ jobId: job.id, acceptedAt: true, draftVersion: input.expectedDraftVersion + 1 }),
      } });
      await tx.smartCoursewareModuleRevision.create({ data: {
        ownerId: target.ownerId,
        moduleRecordId: target.id,
        revisionNumber,
        changeKind: 'REGENERATE_ACCEPT',
        runtimeModuleSnapshot: asJson(candidate.runtimeModule),
        teacherMetadataSnapshot: asJson(derived.teacherFields),
        contentHash: derived.moduleContentHash,
        sourceState: persistenceSourceStateFor(derived.sourceState),
        sourceBindings: asJson(derived.sourceBindings),
        sourceBindingSetHash: derived.sourceBindingSetHash,
        gapIdentity: derived.gapIdentity,
        provenance: persistenceProvenanceFor(derived.provenance),
        generationJobId: job.id,
        providerAttemptId: providerAttempt.id,
        candidateHash: job.candidateHash,
        candidateDiffId: `${job.id}:${job.candidateHash}`,
        acceptedCommandId,
        originalAttemptIdSnapshot: derived.originalAttemptId,
        actorId: actor.id,
      } });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch (error) {
    if (isTransactionConflict(error)) {
      const replay = await findCommandReplay(db, actor, 'MODULE_ACCEPT', idempotencyKey, requestHash);
      if (replay) return replay;
    }
    throw error;
  }
  return getCoursewareGenerationJob(db, { actor, jobId });
}

function assertCandidateBoundary(candidate: ReturnType<typeof coursewareModuleCandidateOutputSchema.parse>, moduleId: string, allowedBindings: unknown) {
  if (candidate.runtimeModule.id !== moduleId || candidate.moduleMetadata.moduleId !== moduleId) {
    throw new SmartCoursewareError('courseware-module-candidate-target-changed', 409);
  }
  const allowed = new Set(normalizeSourceBindings(allowedBindings).map(bindingKey));
  if (candidate.moduleMetadata.sourceBindings.some((binding) => !allowed.has(bindingKey(binding)))) {
    throw new SmartCoursewareError('generated-source-binding-unverified', 409);
  }
}

function replaceRuntimeModule(manifest: GeneratedSlideManifest, moduleId: string, replacement: GeneratedSlideModule) {
  return {
    ...manifest,
    stages: manifest.stages.map((stage) => ({
      ...stage,
      steps: stage.steps.map((step) => ({
        ...step,
        modules: step.modules.map((module) => module.id === moduleId ? replacement : module),
      })),
    })),
  };
}

function assertOnlyTargetModuleChanged(before: GeneratedSlideManifest, after: GeneratedSlideManifest, moduleId: string) {
  const scrub = (manifest: GeneratedSlideManifest) => ({
    ...manifest,
    stages: manifest.stages.map((stage) => ({
      ...stage,
      steps: stage.steps.map((step) => ({
        ...step,
        modules: step.modules.map((module) => module.id === moduleId ? { id: moduleId } : module),
      })),
    })),
  });
  if (contentHash(scrub(before)) !== contentHash(scrub(after))) {
    throw new SmartCoursewareError('courseware-module-candidate-boundary-violation', 409);
  }
}

function findRuntimeLocation(manifest: GeneratedSlideManifest, moduleId: string) {
  for (const stage of manifest.stages) {
    for (const step of stage.steps) {
      const runtimeModule = step.modules.find((module) => module.id === moduleId);
      if (runtimeModule) return { stage, step, runtimeModule };
    }
  }
  return null;
}

function findRuntimeModule(manifest: GeneratedSlideManifest, moduleId: string) {
  return findRuntimeLocation(manifest, moduleId)?.runtimeModule ?? null;
}

function publicModuleMetadata(module: {
  runtimeModuleId: string;
  moduleInstanceLineage: string;
  contentHash: string;
  sourceState: string;
  sourceBindings: unknown;
  sourceBindingSetHash: string;
  gapIdentity: string | null;
  provenance: string;
  originalAttemptId: string | null;
  teacherMetadata: unknown;
}): CoursewareModuleMetadataInput {
  return {
    moduleId: module.runtimeModuleId,
    sourceState: module.sourceState === 'VERIFIED' ? 'verified'
      : module.sourceState === 'AI_GENERATED_SOURCE_PENDING' ? 'ai_generated_source_pending' : 'teacher_created_source_pending',
    sourceBindings: normalizeSourceBindings(module.sourceBindings),
    teacherFields: module.teacherMetadata as CoursewareModuleMetadataInput['teacherFields'],
  };
}

function assertBaseline(draft: {
  planRevisionId: string;
  planRevisionNumber: number;
  planContentHash: string;
  planRevision: { id: string; revisionNumber: number; contentHash: string; content: unknown };
}) {
  if (draft.planRevisionId !== draft.planRevision.id || draft.planRevisionNumber !== draft.planRevision.revisionNumber
    || draft.planContentHash !== draft.planRevision.contentHash || contentHash(draft.planRevision.content) !== draft.planContentHash) {
    throw new SmartCoursewareError('approved-plan-baseline-changed', 409);
  }
}

async function findCommandReplay(db: Db, actor: SmartCoursewareActor, action: string, key: string, requestHash: string) {
  const command = await db.smartCoursewareGenerationCommand.findFirst({ where: { ownerId: actor.id, action, idempotencyKey: key } });
  if (!command) return null;
  if (command.requestHash !== requestHash) throw new SmartCoursewareError('idempotency-key-conflict', 409);
  const job = await db.smartCoursewareGenerationJob.findFirst({
    where: { id: command.jobId, ownerId: actor.id },
    include: { draft: { select: { state: true } } },
  });
  if (job) assertMutableDraftState(job.draft?.state);
  return job;
}

function validateActor(actor: SmartCoursewareActor) {
  if (!actor?.id?.trim() || !['TEACHER', 'ADMIN'].includes(actor.role)) throw new SmartCoursewareError('teacher-or-admin-required', 403);
  return { id: actor.id.trim(), role: actor.role } as SmartCoursewareActor;
}
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
function assertMutableDraftState(state: string | undefined) {
  if (state === 'ACCEPTED') throw new SmartCoursewareError('accepted-courseware-immutable', 409);
}
function bindingKey(binding: { citationId: string; sourceVersionId: string; anchor: string; contentHash: string }) {
  return `${binding.sourceVersionId}\u0000${binding.anchor}\u0000${binding.contentHash}\u0000${binding.citationId}`;
}
function asJson(value: unknown): Prisma.InputJsonValue { return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue; }
function isTransactionConflict(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && ['P2002', 'P2034'].includes(error.code);
}
function errorCode(error: unknown) {
  return error instanceof SmartCoursewareError ? error.code.slice(0, 200) : 'courseware-module-provider-failed';
}
function isRetryableModuleFailure(error: unknown, providerWasInvoked: boolean) {
  return providerWasInvoked || !(error instanceof SmartCoursewareError) || error.status >= 500;
}
