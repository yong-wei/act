import type { PrismaClient } from '@prisma/client';
import { Worker, type Job } from 'bullmq';
import type { Redis } from 'ioredis';
import { ZodError } from 'zod';

import { buildCourseBasisLessonDesignSar, buildCourseBasisLessonDesignSourcePack } from '@/lib/course-basis/lesson-design-source-pack';
import type { GeneratedSlideManifest } from '@/features/interactive/shared/manifest-runtime/generated-slide-contract';
import { prisma } from '@/lib/prisma';
import { normalizeSourceBindings } from '@/lib/smart-lesson-plan/domain';
import { validateSmartLessonPlan, type SmartLessonPlan } from '@/lib/smart-lesson-plan/schema';

import {
  SmartCoursewareError,
  assertAiGeneratedCoursewareSourceState,
  assertPersistedCoursewareManifest,
} from './domain';
import {
  beginCoursewareProviderAttempt,
  completeCoursewareGenerationUnit,
  failCoursewareGenerationUnit,
  type CoursewareGenerationUnitKey,
} from './generation-service';
import { generateCoursewareModuleCandidate } from './module-regeneration-service';
import {
  createDeterministicCoursewareStage,
  resolveSmartCoursewareStructuredProvider,
  SMART_COURSEWARE_PROMPT_VERSION,
} from './provider-runtime';
import { coursewareGeneratedStageOutputSchema } from './schema';

export const COURSEWARE_GENERATION_QUEUE = 'smart-courseware-generation';

type Db = PrismaClient;
type Resolver = typeof resolveSmartCoursewareStructuredProvider;
let worker: Worker<{ jobId: string }> | null = null;

const PLAN_STAGE_KEYS = {
  'bridge-in': 'bridgeIn',
  objective: 'objectives',
  'pre-assessment': 'preAssessment',
  'participatory-learning': 'participatoryLearning',
  'post-assessment': 'postAssessment',
  summary: 'summary',
} as const;

export async function ensureCoursewareGenerationWorker(connection: Redis) {
  if (worker) {
    await waitUntilReady(worker);
    return worker;
  }
  const candidate = new Worker<{ jobId: string }>(
    COURSEWARE_GENERATION_QUEUE,
    (job) => processCoursewareGenerationJob(prisma, job.data.jobId),
    { connection: connection.duplicate({ maxRetriesPerRequest: null }), concurrency: 2, ...(queuePrefix() ? { prefix: queuePrefix() } : {}) },
  );
  candidate.on('error', (error) => console.error('[SmartCoursewareWorker]', error));
  worker = candidate;
  try {
    await waitUntilReady(candidate);
    return candidate;
  } catch (error) {
    if (worker === candidate) worker = null;
    await candidate.close(true).catch(() => undefined);
    throw error;
  }
}

export async function closeCoursewareGenerationWorker() {
  await worker?.close();
  worker = null;
}

export async function processCoursewareGenerationJob(
  db: Db,
  jobId: string,
  resolveProvider: Resolver = resolveSmartCoursewareStructuredProvider,
) {
  for (;;) {
    const context = await loadContext(db, jobId);
    if (!context) throw new SmartCoursewareError('courseware-job-not-found', 404);
    if (context.draft.state === 'ACCEPTED') throw new SmartCoursewareError('accepted-courseware-immutable', 409);
    if (context.draft.planRevision?.content) {
      const approvedPlan = validateSmartLessonPlan(context.draft.planRevision.content);
      assertPersistedCoursewareManifest({
        draftId: context.draft.id,
        approvedPlanTitle: approvedPlan.topic,
        manifest: context.draft.runtimeManifest as unknown as GeneratedSlideManifest | null,
        contentHash: context.draft.contentHash,
      });
    }
    if (['RETRYABLE', 'FAILED', 'CANCELLED', 'COMPLETED'].includes(context.state)) return { jobId, state: context.state };
    if (context.mode === 'MODULE') {
      return generateCoursewareModuleCandidate(db, {
        actor: { id: context.ownerId, role: 'TEACHER' },
        jobId: context.id,
      });
    }
    if (!context.firstIncompleteUnitKey) throw new SmartCoursewareError('courseware-unit-not-found', 404);
    const unit = context.units.find((candidate) => candidate.unitKey === context.firstIncompleteUnitKey);
    if (!unit) throw new SmartCoursewareError('courseware-unit-not-found', 404);
    let runtime;
    let request;
    let claim;
    try {
      runtime = await resolveProvider();
      request = await buildUnitRequest(db, context, unit.unitKey as CoursewareGenerationUnitKey);
      claim = await beginCoursewareProviderAttempt(db, {
        actor: { id: context.ownerId, role: 'TEACHER' }, jobId: context.id,
        unitKey: unit.unitKey as CoursewareGenerationUnitKey,
        serviceId: runtime.serviceId, providerKind: runtime.providerKind, model: runtime.model,
        promptVersion: SMART_COURSEWARE_PROMPT_VERSION,
        schemaVersion: `smart-courseware-stage-${unit.unitKey}.v1`,
        request: {
          system: request.system,
          prompt: request.prompt,
          authoritativeSourceBindings: request.authoritativeSourceBindings,
        },
      });
    } catch (error) {
      const state = await markPreProviderFailure(db, {
        jobId: context.id,
        draftId: context.draftId,
        unitId: unit.id,
        unitKey: unit.unitKey,
        deliveryGeneration: context.deliveryGeneration,
        attemptGeneration: unit.attemptGeneration,
      }, error);
      return { jobId, state };
    }
    if (!claim.claimed || !claim.attempt || !claim.claimToken) {
      throw new SmartCoursewareError('courseware-unit-lease-active', 409);
    }
    try {
      const generated = await runtime.generate({
        schema: coursewareGeneratedStageOutputSchema,
        schemaVersion: `smart-courseware-stage-${unit.unitKey}.v1`,
        system: request.system,
        prompt: request.prompt,
        idempotencyKey: claim.attempt.idempotencyKey,
        fixtureOutput: request.fixtureOutput,
      });
      const output = validateUnitOutput(generated.output, unit.unitKey as CoursewareGenerationUnitKey, request.expectedDurationSeconds, request.allowedBindingKeys);
      const completed = unit.unitKey === 'summary' ? assembleManifest(context, output) : undefined;
      const updated = await completeCoursewareGenerationUnit(db, {
        actor: { id: context.ownerId, role: 'TEACHER' }, jobId: context.id,
        unitKey: unit.unitKey as CoursewareGenerationUnitKey,
        claimToken: claim.claimToken, attemptId: claim.attempt.id, output,
        completedManifest: completed?.manifest, completedModuleMetadata: completed?.moduleMetadata,
        normalizedResponseId: generated.normalizedResponseId,
        inputTokens: generated.inputTokens, outputTokens: generated.outputTokens, costMicros: generated.costMicros,
      });
      if (updated.state === 'COMPLETED') return { jobId, state: updated.state };
    } catch (error) {
      await failCoursewareGenerationUnit(db, {
        actor: { id: context.ownerId, role: 'TEACHER' }, jobId: context.id,
        unitKey: unit.unitKey as CoursewareGenerationUnitKey,
        claimToken: claim.claimToken, attemptId: claim.attempt.id,
        failureCode: errorCode(error), retryable: isRetryable(error),
      }).catch(() => undefined);
      throw error;
    }
  }
}

async function loadContext(db: Db, jobId: string) {
  return db.smartCoursewareGenerationJob.findUnique({
    where: { id: jobId },
    include: {
      units: { orderBy: { orderIndex: 'asc' } },
      draft: { include: { planRevision: true } },
    },
  });
}

async function buildUnitRequest(db: Db, context: NonNullable<Awaited<ReturnType<typeof loadContext>>>, unitKey: CoursewareGenerationUnitKey) {
  const plan = validateSmartLessonPlan(context.draft.planRevision.content);
  const selectedVersionIds = [...new Set(plan.sources.map((binding) => binding.sourceVersionId))];
  if (!selectedVersionIds.length) throw new SmartCoursewareError('governed-source-evidence-unavailable', 409);
  const query = [plan.topic, ...plan.goals.map((goal) => goal.content), ...plan.knowledgePoints.map((point) => point.title)].join('\n').slice(0, 4_000);
  const actor = { id: context.ownerId, role: 'TEACHER' as const };
  const sar = await buildCourseBasisLessonDesignSar(db, { actor, selectedVersionIds, explicitRetiredVersionIds: selectedVersionIds, query });
  const sourcePack = await buildCourseBasisLessonDesignSourcePack(db, {
    actor, selectedVersionIds, explicitRetiredVersionIds: selectedVersionIds, sar,
    retrieval: { query, topK: 12 },
  });
  const authoritativeBindings = normalizeSourceBindings(sourcePack.retrieval.pack.items.map((item) => ({
    citationId: item.citationTargetId ?? item.citation?.citationTargetId,
    sourceVersionId: item.metadata?.versionId,
    anchor: item.metadata?.stableAnchor,
    contentHash: item.metadata?.contentHash,
  })));
  if (!authoritativeBindings.length) throw new SmartCoursewareError('governed-source-evidence-unavailable', 409);
  const planStage = plan.boppps[PLAN_STAGE_KEYS[unitKey]];
  const previous = Object.fromEntries(context.units.filter((unit) => unit.state === 'COMPLETED').map((unit) => [unit.unitKey, unit.output]));
  return {
    system: '你是单课互动课件生成器。只能按已批准教案、注册版式、注册模块、服务端来源证据生成当前 BOPPPS 阶段；不得改写目标、时长或其他阶段。来源状态为 verified 时，teacherFields.inclusionRationale 必须说明引用证据与模块内容的关系。输出严格符合 JSON Schema。',
    prompt: `当前阶段：${unitKey}。已批准教案：${JSON.stringify(plan)}。权威来源：${JSON.stringify(authoritativeBindings)}。已完成阶段：${JSON.stringify(previous)}。`,
    expectedDurationSeconds: planStage.minutes * 60,
    authoritativeSourceBindings: authoritativeBindings,
    allowedBindingKeys: new Set(authoritativeBindings.map(bindingKey)),
    fixtureOutput: createDeterministicCoursewareStage({ unitKey, durationSeconds: planStage.minutes * 60, sourceBinding: authoritativeBindings[0] }),
  };
}

function validateUnitOutput(output: unknown, unitKey: CoursewareGenerationUnitKey, durationSeconds: number, allowed: ReadonlySet<string>) {
  const parsed = coursewareGeneratedStageOutputSchema.parse(output);
  if (parsed.stage.stage !== unitKey) throw new SmartCoursewareError('generated-courseware-stage-changed', 409);
  if (parsed.stage.durationSeconds !== durationSeconds || parsed.stage.steps.reduce((sum, step) => sum + step.durationSeconds, 0) !== durationSeconds) {
    throw new SmartCoursewareError('generated-courseware-stage-timing-changed', 409);
  }
  const moduleIds = parsed.stage.steps.flatMap((step) => step.modules.map((module) => module.id));
  if (new Set(moduleIds).size !== moduleIds.length || parsed.moduleMetadata.length !== moduleIds.length
    || parsed.moduleMetadata.some((metadata) => !moduleIds.includes(metadata.moduleId))) {
    throw new SmartCoursewareError('generated-courseware-metadata-coverage-invalid', 409);
  }
  for (const binding of parsed.moduleMetadata.flatMap((metadata) => metadata.sourceBindings)) {
    if (!allowed.has(bindingKey(binding))) throw new SmartCoursewareError('generated-source-binding-unverified', 409);
  }
  parsed.moduleMetadata.forEach(assertAiGeneratedCoursewareSourceState);
  return parsed;
}

function assembleManifest(context: NonNullable<Awaited<ReturnType<typeof loadContext>>>, summaryOutput: ReturnType<typeof coursewareGeneratedStageOutputSchema.parse>) {
  const plan = validateSmartLessonPlan(context.draft.planRevision.content);
  const outputs = context.units.map((unit) => unit.unitKey === 'summary'
    ? summaryOutput
    : coursewareGeneratedStageOutputSchema.parse(unit.output));
  return {
    manifest: {
      schemaVersion: 'generated-slide-v1' as const,
      lessonId: context.draft.id,
      title: plan.topic,
      durationSeconds: plan.durationMinutes * 60,
      stages: outputs.map((output) => output.stage),
    },
    moduleMetadata: outputs.flatMap((output) => output.moduleMetadata),
  };
}

async function markPreProviderFailure(db: Db, expected: {
  jobId: string;
  draftId: string;
  unitId: string;
  unitKey: string;
  deliveryGeneration: number;
  attemptGeneration: number;
}, error: unknown) {
  const retryable = isRetryable(error);
  const state = retryable ? 'RETRYABLE' as const : 'FAILED' as const;
  try {
    return await db.$transaction(async (tx) => {
      const transitioned = await tx.smartCoursewareGenerationJob.updateMany({
        where: {
          id: expected.jobId,
          state: { in: ['QUEUED', 'RUNNING'] },
          firstIncompleteUnitKey: expected.unitKey,
          deliveryGeneration: expected.deliveryGeneration,
        },
        data: { state, activeIdentity: null, failureCode: errorCode(error) },
      });
      if (transitioned.count !== 1) throw new PreProviderFailureClaimLost();
      const unitTransitioned = await tx.smartCoursewareGenerationUnit.updateMany({
        where: {
          id: expected.unitId,
          jobId: expected.jobId,
          state: { in: ['PENDING', 'RETRYABLE'] },
          attemptGeneration: expected.attemptGeneration,
          claimToken: null,
        },
        data: { state, claimToken: null, claimExpiresAt: null },
      });
      if (unitTransitioned.count !== 1) throw new PreProviderFailureClaimLost();
      await tx.smartCoursewareDraft.updateMany({
        where: { id: expected.draftId, state: 'GENERATING' },
        data: { state: 'EDITABLE' },
      });
      return state;
    });
  } catch (failure) {
    if (!(failure instanceof PreProviderFailureClaimLost)) throw failure;
    const current = await db.smartCoursewareGenerationJob.findUnique({
      where: { id: expected.jobId },
      select: { state: true },
    });
    return current?.state ?? state;
  }
}

class PreProviderFailureClaimLost extends Error {}

function bindingKey(binding: { citationId: string; sourceVersionId: string; anchor: string; contentHash: string }) {
  return `${binding.sourceVersionId}\u0000${binding.anchor}\u0000${binding.contentHash}\u0000${binding.citationId}`;
}
function isRetryable(error: unknown) {
  return !(error instanceof ZodError) && (!(error instanceof SmartCoursewareError) || error.status >= 500);
}
function errorCode(error: unknown) {
  if (error instanceof SmartCoursewareError) return error.code.slice(0, 200);
  if (error instanceof ZodError) return 'generated-courseware-schema-invalid';
  return 'courseware-provider-failed';
}
async function waitUntilReady(candidate: Worker<{ jobId: string }>) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([candidate.waitUntilReady(), new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('courseware-worker-readiness-timeout')), 5_000); })]);
  } finally { if (timer) clearTimeout(timer); }
}
function queuePrefix() { return process.env.SMART_COURSEWARE_REDIS_PREFIX?.trim() || undefined; }
export async function processCoursewareBullJob(job: Job<{ jobId: string }>) { return processCoursewareGenerationJob(prisma, job.data.jobId); }
