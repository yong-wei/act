import type { PrismaClient } from '@prisma/client';
import { Worker, type Job } from 'bullmq';
import type { Redis } from 'ioredis';
import { ZodError } from 'zod';

import { buildCourseBasisLessonDesignSar, buildCourseBasisLessonDesignSourcePack } from '@/lib/course-basis/lesson-design-source-pack';
import { validateGeneratedSlideManifest, type GeneratedSlideManifest } from '@/features/interactive/shared/manifest-runtime/generated-slide-contract';
import { prisma } from '@/lib/prisma';
import { contentHash, normalizeSourceBindings } from '@/lib/smart-lesson-plan/domain';
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
  COURSEWARE_PLAN_STAGE_KEYS,
  createDeterministicCoursewareStage,
  deriveCoursewareApprovedPlanAlignment,
  deriveCoursewareApprovedStepExpectations,
  parsePersistedCoursewareStageOutput,
  resolveSmartCoursewareStructuredProvider,
  SMART_COURSEWARE_PROMPT_VERSION,
} from './provider-runtime';
import {
  createCoursewareGeneratedStageProviderOutputSchema,
  coursewareGeneratedStageOutputSchema,
} from './schema';

export const COURSEWARE_GENERATION_QUEUE = 'smart-courseware-generation';

type Db = PrismaClient;
type Resolver = typeof resolveSmartCoursewareStructuredProvider;
let worker: Worker<{ jobId: string }> | null = null;

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
        schemaVersion: `smart-courseware-stage-${unit.unitKey}.v2`,
        request: {
          system: request.system,
          prompt: request.prompt,
          authoritativeSourceBindings: request.authoritativeSourceBindings,
          approvedPlanAlignment: request.expectedPlanAlignment,
          approvedStepExpectations: request.expectedStepExpectations,
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
        schema: request.providerOutputSchema,
        schemaVersion: `smart-courseware-stage-${unit.unitKey}.v2`,
        system: request.system,
        prompt: request.prompt,
        idempotencyKey: claim.attempt.idempotencyKey,
        fixtureOutput: request.fixtureOutput,
      });
      const output = validateUnitOutput(
        attachServerOwnedPlanBindings(
          request.providerOutputSchema.parse(generated.output),
          unit.unitKey as CoursewareGenerationUnitKey,
          request.expectedPlanAlignment,
          request.expectedStepExpectations,
          request.authoritativeSourceBindings,
        ),
        unit.unitKey as CoursewareGenerationUnitKey,
        request.expectedDurationSeconds,
        request.allowedBindingKeys,
        request.expectedPlanAlignment,
        request.expectedStepExpectations,
      );
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
      units: { orderBy: { orderIndex: 'asc' }, include: { attempts: { orderBy: { attemptNumber: 'desc' } } } },
      draft: { include: { planRevision: true } },
    },
  });
}

async function buildUnitRequest(db: Db, context: NonNullable<Awaited<ReturnType<typeof loadContext>>>, unitKey: CoursewareGenerationUnitKey) {
  const plan = validateSmartLessonPlan(context.draft.planRevision.content);
  const selectedVersionIds = [...new Set(plan.sources.map((binding) => binding.sourceVersionId))];
  const query = [plan.topic, ...plan.goals.map((goal) => goal.content), ...plan.knowledgePoints.map((point) => point.title)].join('\n').slice(0, 4_000);
  const actor = { id: context.ownerId, role: 'TEACHER' as const };
  let authoritativeBindings: ReturnType<typeof normalizeSourceBindings> = [];
  if (selectedVersionIds.length) {
    const sar = await buildCourseBasisLessonDesignSar(db, { actor, selectedVersionIds, explicitRetiredVersionIds: selectedVersionIds, query });
    const sourcePack = await buildCourseBasisLessonDesignSourcePack(db, {
      actor, selectedVersionIds, explicitRetiredVersionIds: selectedVersionIds, sar,
      retrieval: { query, topK: 12 },
    });
    authoritativeBindings = normalizeSourceBindings(sourcePack.retrieval.pack.items.map((item) => ({
      citationId: item.citationTargetId ?? item.citation?.citationTargetId,
      sourceVersionId: item.metadata?.versionId,
      anchor: item.metadata?.stableAnchor,
      contentHash: item.metadata?.contentHash,
    })));
    if (!authoritativeBindings.length) throw new SmartCoursewareError('governed-source-evidence-unavailable', 409);
  }
  const planStage = plan.boppps[COURSEWARE_PLAN_STAGE_KEYS[unitKey]];
  const expectedPlanAlignment = deriveCoursewareApprovedPlanAlignment(plan, unitKey);
  const expectedStepExpectations = deriveCoursewareApprovedStepExpectations(plan, unitKey);
  const previous = Object.fromEntries(context.units.filter((unit) => unit.state === 'COMPLETED').map((unit) => [
    unit.unitKey,
    parsePersistedCoursewareStageOutput({
      output: unit.output,
      unitKey: unit.unitKey as CoursewareGenerationUnitKey,
      schemaVersion: unit.attempts.find((attempt) => attempt.outcome === 'SUCCEEDED')?.schemaVersion,
    }),
  ]));
  const providerPlan = {
    course: plan.course,
    topic: plan.topic,
    audience: plan.audience,
    prerequisites: plan.prerequisites,
    goals: plan.goals,
    knowledgePoints: plan.knowledgePoints,
    keyContent: plan.keyContent,
    difficultContent: plan.difficultContent,
    limitations: plan.limitations,
    classAdaptation: plan.classAdaptation,
    coursewareStepOutline: plan.coursewareStepOutline,
    currentStageTeachingIntent: {
      minutes: planStage.minutes,
      teacherActivity: planStage.teacherActivity,
      studentActivity: planStage.studentActivity,
      assessment: planStage.assessment,
    },
  };
  return {
    providerOutputSchema: createCoursewareGeneratedStageProviderOutputSchema(
      expectedStepExpectations.length,
      ['pre-assessment', 'participatory-learning', 'post-assessment'].includes(unitKey),
    ),
    system: `你是单课互动课件生成器。只能按已批准教案、注册版式、注册模块、服务端来源证据生成当前 BOPPPS 阶段；不得改写、遗漏或新增当前阶段内容或批准的课件纲要。按批准纲要的数量和顺序生成 stage.steps；layoutId、slotId、sizeId、canonicalClass 必须从 JSON Schema 的注册枚举中选择。${['pre-assessment', 'participatory-learning', 'post-assessment'].includes(unitKey) ? '当前阶段必须生成至少一个 activity.panel 互动模块，并在 teacherActivityEvidence 中为每个互动模块提供 moduleId、referenceAnswer、explanation 和 scoring。每个 choice.single 选项的 label 必须是能独立判别的完整答案文本，不得只写 A/B、选项 A/B 或编号。' : ''}来源绑定、来源状态、目标对齐和步骤绑定均由服务端写入，禁止输出这些字段。数学表达使用纯文本，例如 K/(s(s+2))；不得输出未转义反斜杠或 LaTex 命令。输出严格符合 JSON Schema。`,
    prompt: `当前阶段：${unitKey}。已批准课程上下文：${JSON.stringify(providerPlan)}。批准课件纲要：${JSON.stringify(expectedStepExpectations.map(({ approvedTitle, approvedDurationSeconds }) => ({ approvedTitle, approvedDurationSeconds })))}。权威来源：${JSON.stringify(authoritativeBindings)}。已完成阶段：${JSON.stringify(previous)}。`,
    expectedDurationSeconds: planStage.minutes * 60,
    expectedPlanAlignment,
    expectedStepExpectations,
    authoritativeSourceBindings: authoritativeBindings,
    allowedBindingKeys: new Set(authoritativeBindings.map(bindingKey)),
    fixtureOutput: toProviderFixtureOutput(createDeterministicCoursewareStage({
      unitKey,
      durationSeconds: planStage.minutes * 60,
      approvedPlan: plan,
      sourceBinding: authoritativeBindings[0],
    })),
  };
}

function toProviderFixtureOutput(output: ReturnType<typeof createDeterministicCoursewareStage>) {
  return {
    stage: output.stage,
    teacherActivityEvidence: output.moduleMetadata.flatMap((metadata) => (
      metadata.teacherFields.referenceAnswer
      && metadata.teacherFields.explanation
      && metadata.teacherFields.scoring
        ? [{
          moduleId: metadata.moduleId,
          referenceAnswer: metadata.teacherFields.referenceAnswer,
          explanation: metadata.teacherFields.explanation,
          scoring: metadata.teacherFields.scoring,
        }]
        : []
    )),
  };
}

function attachServerOwnedPlanBindings(
  providerOutput: {
    stage: { steps: Array<{ id: string; title: string; durationSeconds: number; modules: Array<{ id: string; canonicalClass: string }> }> };
    teacherActivityEvidence: Array<{ moduleId: string; referenceAnswer: string; explanation: string; scoring: Record<string, unknown> }>;
  },
  unitKey: CoursewareGenerationUnitKey,
  expectedPlanAlignment: ReturnType<typeof deriveCoursewareApprovedPlanAlignment>,
  expectedStepExpectations: ReturnType<typeof deriveCoursewareApprovedStepExpectations>,
  authoritativeSourceBindings: ReturnType<typeof normalizeSourceBindings>,
) {
  const { teacherActivityEvidence, ...providerStageOutput } = providerOutput;
  if (providerStageOutput.stage.steps.length !== expectedStepExpectations.length) {
    throw new SmartCoursewareError('generated-courseware-step-plan-binding-changed', 409);
  }
  const evidenceByModuleId = new Map(teacherActivityEvidence.map((evidence) => [evidence.moduleId, evidence]));
  if (evidenceByModuleId.size !== teacherActivityEvidence.length) {
    throw new SmartCoursewareError('generated-courseware-activity-evidence-duplicated', 409);
  }
  const consumedActivityEvidenceIds = new Set<string>();
  const teacherFieldsByServerModuleId = new Map<string, { referenceAnswer: string; explanation: string; scoring: Record<string, unknown> }>();
  const stage = {
    ...providerStageOutput.stage,
    stage: unitKey,
    durationSeconds: expectedStepExpectations.reduce((total, step) => total + step.approvedDurationSeconds, 0),
    steps: providerStageOutput.stage.steps.map((step, stepIndex) => {
      const stepId = `generated-${unitKey}-step-${stepIndex + 1}`;
      return {
        ...step,
        id: stepId,
        title: expectedStepExpectations[stepIndex]!.approvedTitle,
        durationSeconds: expectedStepExpectations[stepIndex]!.approvedDurationSeconds,
        modules: step.modules.map((module, moduleIndex) => {
          const moduleId = `generated-${unitKey}-module-${stepIndex + 1}-${moduleIndex + 1}`;
          const activityEvidence = module.canonicalClass === 'activity.panel'
            ? evidenceByModuleId.get(module.id)
            : undefined;
          if (module.canonicalClass === 'activity.panel' && !activityEvidence) {
            throw new SmartCoursewareError(`generated-courseware-activity-evidence-required:${module.id}`, 409);
          }
          if (activityEvidence) {
            consumedActivityEvidenceIds.add(module.id);
            teacherFieldsByServerModuleId.set(moduleId, {
              referenceAnswer: activityEvidence.referenceAnswer,
              explanation: activityEvidence.explanation,
              scoring: activityEvidence.scoring,
            });
          }
          return {
            ...module,
            id: moduleId,
            ...(module.canonicalClass === 'activity.panel' ? { evidencePath: `responses.${unitKey}.${moduleId}` } : {}),
          };
        }),
      };
    }),
  };
  // Only activity stages consume provider evidence. Some providers add a
  // harmless evidence array to explanatory stages despite the contract; it
  // must not turn an otherwise valid non-interactive stage into a retry.
  if (['pre-assessment', 'participatory-learning', 'post-assessment'].includes(unitKey)
    && consumedActivityEvidenceIds.size !== evidenceByModuleId.size) {
    throw new SmartCoursewareError('generated-courseware-activity-evidence-unmatched', 409);
  }
  return {
    ...providerStageOutput,
    stage,
    moduleMetadata: stage.steps.flatMap((step) => step.modules.map((module) => ({
      moduleId: module.id,
      sourceState: authoritativeSourceBindings.length ? 'verified' : 'ai_generated_source_pending',
      sourceBindings: authoritativeSourceBindings,
      teacherFields: {
        ...(authoritativeSourceBindings.length
          ? { inclusionRationale: '该模块由已批准教案生成，并以当前阶段权威来源作为可核验依据。' }
          : {}),
        ...(teacherFieldsByServerModuleId.get(module.id) ?? {}),
      },
    }))),
    approvedPlanAlignment: expectedPlanAlignment,
    stepPlanBindings: stage.steps.map((step, index) => ({
      generatedStepId: step.id,
      ...expectedStepExpectations[index]!,
    })),
  };
}

function validateUnitOutput(
  output: unknown,
  unitKey: CoursewareGenerationUnitKey,
  durationSeconds: number,
  allowed: ReadonlySet<string>,
  expectedPlanAlignment: ReturnType<typeof deriveCoursewareApprovedPlanAlignment>,
  expectedStepExpectations: ReturnType<typeof deriveCoursewareApprovedStepExpectations>,
) {
  const parsed = coursewareGeneratedStageOutputSchema.parse(output);
  if (contentHash(parsed.approvedPlanAlignment) !== contentHash(expectedPlanAlignment)) {
    throw new SmartCoursewareError('generated-courseware-plan-alignment-changed', 409);
  }
  if (parsed.stage.steps.length !== expectedStepExpectations.length
    || parsed.stepPlanBindings.length !== expectedStepExpectations.length
    || parsed.stage.steps.some((step, index) => {
      const binding = parsed.stepPlanBindings[index];
      const expected = expectedStepExpectations[index];
      if (!binding || !expected) return true;
      const { generatedStepId, ...actualExpectation } = binding;
      return generatedStepId !== step.id
        || contentHash(actualExpectation) !== contentHash(expected)
        || step.title !== expected.approvedTitle
        || step.durationSeconds !== expected.approvedDurationSeconds;
    })) {
    throw new SmartCoursewareError('generated-courseware-step-plan-binding-changed', 409);
  }
  if (parsed.stage.stage !== unitKey) throw new SmartCoursewareError('generated-courseware-stage-changed', 409);
  if (parsed.stage.durationSeconds !== durationSeconds || parsed.stage.steps.reduce((sum, step) => sum + step.durationSeconds, 0) !== durationSeconds) {
    throw new SmartCoursewareError('generated-courseware-stage-timing-changed', 409);
  }
  const moduleIds = parsed.stage.steps.flatMap((step) => step.modules.map((module) => module.id));
  if (new Set(moduleIds).size !== moduleIds.length || parsed.moduleMetadata.length !== moduleIds.length
    || parsed.moduleMetadata.some((metadata) => !moduleIds.includes(metadata.moduleId))) {
    throw new SmartCoursewareError('generated-courseware-metadata-coverage-invalid', 409);
  }
  if (parsed.moduleMetadata.some((metadata) => (
    metadata.sourceState === 'verified' && metadata.sourceBindings.length === 0
  ))) {
    throw new SmartCoursewareError('verified-source-binding-required', 409);
  }
  for (const binding of parsed.moduleMetadata.flatMap((metadata) => metadata.sourceBindings)) {
    if (!allowed.has(bindingKey(binding))) throw new SmartCoursewareError('generated-source-binding-unverified', 409);
  }
  parsed.moduleMetadata.forEach(assertAiGeneratedCoursewareSourceState);
  const stageValidation = validateGeneratedSlideManifest({
    schemaVersion: 'generated-slide-v1', lessonId: 'stage-validation', title: 'stage-validation',
    durationSeconds: parsed.stage.durationSeconds, stages: [parsed.stage],
  });
  const localError = stageValidation.issues.find((issue) => issue.severity === 'error'
    && !['hierarchy.stage-order', 'hierarchy.step-count'].includes(issue.code));
  if (localError) throw new SmartCoursewareError(`runtime-stage-invalid:${localError.code}`, 409);
  if (['pre-assessment', 'participatory-learning', 'post-assessment'].includes(unitKey)
    && !parsed.stage.steps.some((step) => step.modules.some((module) => module.canonicalClass === 'activity.panel'))) {
    throw new SmartCoursewareError(`required-activity-missing:${unitKey}`, 409);
  }
  return parsed;
}

function assembleManifest(context: NonNullable<Awaited<ReturnType<typeof loadContext>>>, summaryOutput: ReturnType<typeof coursewareGeneratedStageOutputSchema.parse>) {
  const plan = validateSmartLessonPlan(context.draft.planRevision.content);
  const outputs = context.units.map((unit) => unit.unitKey === 'summary'
    ? summaryOutput
    : parsePersistedCoursewareStageOutput({
      output: unit.output,
      unitKey: unit.unitKey as CoursewareGenerationUnitKey,
      schemaVersion: unit.attempts.find((attempt) => attempt.outcome === 'SUCCEEDED')?.schemaVersion,
    }));
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
        data: { state, failureCode: errorCode(error) },
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
