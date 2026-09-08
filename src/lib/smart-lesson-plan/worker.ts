import type { PrismaClient, SmartLessonGenerationStageKind } from '@prisma/client';
import { zodSchema } from 'ai';
import { Worker, type Job } from 'bullmq';
import type { Redis } from 'ioredis';
import { ZodError, type z } from 'zod';

import { prisma } from '../prisma';
import {
  buildCourseBasisLessonDesignSar,
  buildCourseBasisLessonDesignSourcePack,
} from '../course-basis/lesson-design-source-pack';
import { CourseBasisError } from '../course-basis/domain';
import { adoptCourseBasisVersion } from '../course-basis/service';

import { SmartLessonPlanError } from './domain';
import {
  resolveSmartLessonStructuredProvider,
  SMART_LESSON_PROMPT_VERSION,
  validateSmartLessonProviderOutput,
  type SmartLessonValidationReceipt,
} from './provider-runtime';
import {
  BOPPPS_STAGE_KEYS,
  SMART_LESSON_PLAN_SCHEMA_VERSION,
  bopppsStageSchema,
  createBopppsStageSchemaForAllowedBindings,
  smartLessonOutlineOutputSchema,
  sourceBindingSchema,
} from './schema';
import { confirmedTextbookRangeSchema } from './textbook-range';
import {
  beginCorrectionAttempt,
  beginProviderAttempt,
  completeGenerationStage,
  failGenerationStage,
  setGenerationStageActionState,
} from './service';

export const SMART_LESSON_GENERATION_QUEUE = 'smart-lesson-generation';

const STAGE_TO_PLAN_KEY = {
  BRIDGE_IN: 'bridgeIn',
  OBJECTIVES: 'objectives',
  PRE_ASSESSMENT: 'preAssessment',
  PARTICIPATORY_LEARNING: 'participatoryLearning',
  POST_ASSESSMENT: 'postAssessment',
  SUMMARY: 'summary',
} as const;

type WorkerDb = PrismaClient;
type ProviderResolver = typeof resolveSmartLessonStructuredProvider;
type JobContext = Awaited<ReturnType<typeof loadJobContext>>;
let worker: Worker<{ jobId: string }> | null = null;
const consumedE2EFaultTokens = new Set<string>();

export async function ensureSmartLessonGenerationWorker(connection: Redis): Promise<Worker<{ jobId: string }>> {
  if (worker) {
    await waitForWorkerReady(worker);
    return worker;
  }
  const workerConnection = connection.duplicate({ maxRetriesPerRequest: null });
  const candidate = new Worker<{ jobId: string }>(
    SMART_LESSON_GENERATION_QUEUE,
    (job) => processSmartLessonGenerationJob(prisma, job.data.jobId),
    {
      connection: workerConnection,
      concurrency: 2,
      ...(smartLessonQueuePrefix() ? { prefix: smartLessonQueuePrefix() } : {}),
    },
  );
  candidate.on('error', (error) => console.error('[SmartLessonWorker]', error));
  worker = candidate;
  try {
    await waitForWorkerReady(candidate);
    return candidate;
  } catch (error) {
    if (worker === candidate) worker = null;
    await candidate.close(true).catch(() => undefined);
    throw error;
  }
}

function smartLessonQueuePrefix() {
  return process.env.SMART_LESSON_REDIS_PREFIX?.trim() || undefined;
}

export async function closeSmartLessonGenerationWorker() {
  await worker?.close();
  worker = null;
}

async function waitForWorkerReady(candidate: Worker<{ jobId: string }>) {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      candidate.waitUntilReady(),
      new Promise<never>((_, reject) => {
        timeout = setTimeout(() => reject(new Error('smart-lesson-worker-readiness-timeout')), 5_000);
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

export async function processSmartLessonGenerationJob(
  db: WorkerDb,
  jobId: string,
  resolveProvider: ProviderResolver = resolveSmartLessonStructuredProvider,
) {
  for (;;) {
    const context = await loadJobContext(db, jobId);
    if (!context) throw new SmartLessonPlanError('generation-job-not-found', 404);
    if (['PAUSED', 'CANCELLED', 'FAILED', 'RETRYABLE', 'COMPLETED'].includes(context.state)) {
      return { jobId, state: context.state };
    }
    const stage = context.stages.find((candidate) => candidate.kind === context.firstIncompleteStage);
    if (!stage) throw new SmartLessonPlanError('generation-stage-not-found', 404);

    let runtime;
    let request;
    let claim;
    try {
      runtime = await resolveProvider();
      if (stage.state !== 'RUNNING') {
        await setGenerationStageActionState(db, {
          actor: { id: context.ownerId, role: 'TEACHER' },
          jobId: context.id,
          stage: stage.kind,
          actionState: 'PREPARING_EVIDENCE',
        });
      }
      request = await buildStageRequest(db, context, stage.kind);
      claim = await beginProviderAttempt(db, {
        actor: { id: context.ownerId, role: 'TEACHER' },
        jobId: context.id,
        stage: stage.kind,
        serviceId: runtime.serviceId,
        providerKind: runtime.providerKind,
        model: runtime.model,
        promptVersion: SMART_LESSON_PROMPT_VERSION,
        schemaVersion: request.schemaVersion,
        request: { system: request.system, prompt: request.prompt },
      });
    } catch (error) {
      const state = await markPreProviderFailure(db, context, stage.kind, error);
      return { jobId, state };
    }
    if (!claim.claimed || !claim.attempt || !claim.claimToken) {
      throw new Error('generation-stage-lease-active');
    }

    let validationReceipt: SmartLessonValidationReceipt | undefined;
    let finalAttemptId = claim.attempt.id;
    try {
      if (consumeSmartLessonE2EFailOnce(stage.kind)) {
        throw new Error('curl: (28) Operation timed out during authorized smart-lesson E2E fault');
      }
      const original = await runtime.generate({
        schema: request.schema,
        schemaVersion: request.schemaVersion,
        promptVersion: SMART_LESSON_PROMPT_VERSION,
        system: request.system,
        prompt: request.prompt,
        idempotencyKey: claim.attempt.idempotencyKey,
        maxOutputTokens: request.maxOutputTokens,
        deferValidation: true,
      });
      await setGenerationStageActionState(db, {
        actor: { id: context.ownerId, role: 'TEACHER' },
        jobId: context.id,
        stage: stage.kind,
        actionState: 'VALIDATING',
        claimToken: claim.claimToken,
      });
      let validated = validateStageCandidate({
        context,
        stage: stage.kind,
        schema: request.schema,
        schemaVersion: request.schemaVersion,
        output: original.output,
        allowedSourceBindings: request.allowedSourceBindings,
        allowedBindingKeys: request.allowedBindingKeys,
      });
      let finalAttempt = claim.attempt;
      let finalGenerated = original;
      if (!validated.success) {
        const correctionContext = buildCorrectionContext(
          context,
          stage.kind,
          validated.output,
          validated.receipt,
        );
        const correctionRequest = {
          stablePromptPrefix: request.system,
          originalStructuredResult: validated.output,
          validationErrors: validated.receipt.issues,
          requiredSchema: zodSchema(request.schema).jsonSchema,
          schemaVersion: request.schemaVersion,
          ...(correctionContext ? { correctionContext } : {}),
        };
        const correctionAttempt = await beginCorrectionAttempt(db, {
          actor: { id: context.ownerId, role: 'TEACHER' },
          jobId: context.id,
          stage: stage.kind,
          claimToken: claim.claimToken,
          originalAttemptId: claim.attempt.id,
          request: correctionRequest,
          validationReceipt: validated.receipt,
          normalizedResponseId: original.normalizedResponseId,
          inputTokens: original.inputTokens,
          outputTokens: original.outputTokens,
          costMicros: original.costMicros,
        });
        finalAttempt = correctionAttempt;
        finalAttemptId = correctionAttempt.id;
        finalGenerated = await runtime.generate({
          schema: request.schema,
          schemaVersion: request.schemaVersion,
          promptVersion: SMART_LESSON_PROMPT_VERSION,
          system: request.system,
          prompt: `仅修正下列结构化结果，使其符合给定 schema；不得扩展教学语义：${JSON.stringify(correctionRequest)}`,
          idempotencyKey: correctionAttempt.idempotencyKey,
          maxOutputTokens: request.maxOutputTokens,
          deferValidation: true,
        });
        await setGenerationStageActionState(db, {
          actor: { id: context.ownerId, role: 'TEACHER' },
          jobId: context.id,
          stage: stage.kind,
          actionState: 'VALIDATING',
          claimToken: claim.claimToken,
        });
        validated = validateStageCandidate({
          context,
          stage: stage.kind,
          schema: request.schema,
          schemaVersion: request.schemaVersion,
          output: finalGenerated.output,
          allowedSourceBindings: request.allowedSourceBindings,
          allowedBindingKeys: request.allowedBindingKeys,
        });
        if (!validated.success) {
          validationReceipt = validated.receipt;
          throw new SmartLessonPlanError('provider-output-invalid-after-correction', 409);
        }
      }
      validationReceipt = validated.receipt;
      const output = validated.output;
      const completedPlan = stage.kind === 'SUMMARY'
        ? assembleCompletedPlan(context, output)
        : undefined;
      const updated = await completeGenerationStage(db, {
        actor: { id: context.ownerId, role: 'TEACHER' },
        jobId: context.id,
        stage: stage.kind,
        claimToken: claim.claimToken,
        attemptId: finalAttempt.id,
        output,
        completedPlan,
        normalizedResponseId: finalGenerated.normalizedResponseId,
        inputTokens: finalGenerated.inputTokens,
        outputTokens: finalGenerated.outputTokens,
        costMicros: finalGenerated.costMicros,
        validationReceipt,
      });
      if (['PAUSED', 'COMPLETED'].includes(updated.state)) return { jobId, state: updated.state };
    } catch (error) {
      const retryable = isRetryableStageError(error);
      try {
        const failed = await failGenerationStage(db, {
          actor: { id: context.ownerId, role: 'TEACHER' },
          jobId: context.id,
          stage: stage.kind,
          claimToken: claim.claimToken,
          attemptId: finalAttemptId,
          failureCode: errorCode(error),
          retryable,
          validationReceipt,
        });
        return { jobId, state: failed.state };
      } catch {
        throw error;
      }
    }
  }
}

export function consumeSmartLessonE2EFailOnce(
  stage: SmartLessonGenerationStageKind,
  environment: Record<string, string | undefined> = process.env,
) {
  if (environment.SMART_LESSON_REAL_PROVIDER_REQUIRED !== '1') return false;
  const configuredStage = environment.SMART_LESSON_E2E_FAIL_ONCE_STAGE?.trim();
  const token = environment.SMART_LESSON_E2E_FAULT_TOKEN?.trim();
  const secret = environment.SMART_LESSON_E2E_FAULT_SECRET?.trim();
  if (
    configuredStage !== stage
    || !token
    || token !== secret
    || !/^smart-lesson-e2e-fault-[a-f0-9]{48}$/.test(token)
    || consumedE2EFaultTokens.has(token)
  ) return false;
  consumedE2EFaultTokens.add(token);
  return true;
}

async function loadJobContext(db: WorkerDb, jobId: string) {
  return db.smartLessonGenerationJob.findUnique({
    where: { id: jobId },
    include: {
      stages: { orderBy: { orderIndex: 'asc' } },
      draft: {
        include: {
          task: {
            include: {
              courseBasis: { select: { title: true } },
              sources: { where: { state: 'SELECTED' }, select: { sourceVersionId: true } },
              knowledgePoints: { where: { state: 'CONFIRMED' }, orderBy: { createdAt: 'asc' } },
              goals: { where: { state: 'CONFIRMED' }, orderBy: { createdAt: 'asc' } },
            },
          },
        },
      },
    },
  });
}

async function buildStageRequest(db: WorkerDb, context: NonNullable<JobContext>, stage: SmartLessonGenerationStageKind) {
  const selectedVersionIds = context.draft.task.sources.map((source) => source.sourceVersionId);
  const task = context.draft.task;
  const query = [task.topic, ...task.goals.map((goal) => goal.content), ...task.knowledgePoints.map((point) => point.title)]
    .join('\n')
    .slice(0, 4_000);
  const textbookRanges = confirmedTextbookRangeSchema.array().max(20).parse(task.textbookRanges ?? []);
  let sourcePackItems: Awaited<ReturnType<
    typeof buildCourseBasisLessonDesignSourcePack
  >>['retrieval']['pack']['items'] = [];
  if (selectedVersionIds.length > 0) {
    try {
      const actor = { id: context.ownerId, role: 'TEACHER' as const };
      const sar = await buildCourseBasisLessonDesignSar(db, {
        actor,
        selectedVersionIds,
        explicitRetiredVersionIds: selectedVersionIds,
        query,
      });
      const sourcePack = await buildCourseBasisLessonDesignSourcePack(db, {
        actor,
        selectedVersionIds,
        explicitRetiredVersionIds: selectedVersionIds,
        sar,
        retrieval: { query, topK: 8 },
      });
      sourcePackItems = sourcePack.retrieval.pack.items;
    } catch (error) {
      if (error instanceof CourseBasisError) {
        throw new SmartLessonPlanError('governed-source-evidence-unavailable', 409);
      }
      throw error;
    }
  }
  const uploadedBindings = sourceBindingSchema.array().safeParse(sourcePackItems.map((item) => ({
    citationId: item.citationTargetId ?? item.citation?.citationTargetId,
    sourceVersionId: item.metadata?.versionId,
    anchor: item.metadata?.stableAnchor,
    contentHash: item.metadata?.contentHash,
  })));
  if (!uploadedBindings.success) throw new SmartLessonPlanError('governed-source-evidence-invalid', 409);
  const { retrieveConfirmedTextbookBindings } = await import('./textbook-resource-pack');
  const textbookBindings = await retrieveConfirmedTextbookBindings(query, textbookRanges);
  const allowedBindings = sourceBindingSchema.array().safeParse([
    ...uploadedBindings.data,
    ...textbookBindings,
  ]);
  if (!allowedBindings.success) throw new SmartLessonPlanError('governed-source-evidence-invalid', 409);
  const allowedSourceBindings = allowedBindings.data;
  if (allowedSourceBindings.length === 0) {
    throw new SmartLessonPlanError('governed-source-evidence-unavailable', 409);
  }
  const freezeGenerationInputs = async (tx: Parameters<typeof adoptCourseBasisVersion>[0]) => {
    const byVersion = new Map<string, typeof uploadedBindings.data>();
    for (const binding of uploadedBindings.data) {
      byVersion.set(binding.sourceVersionId, [...(byVersion.get(binding.sourceVersionId) ?? []), binding]);
    }
    for (const [versionId, bindings] of byVersion) {
      await adoptCourseBasisVersion(tx, {
        actor: { id: context.ownerId, role: 'TEACHER' },
        versionId,
        adopter: { referenceType: 'GENERATION_JOB', referenceId: context.id },
        anchors: bindings.map((binding) => ({
          stableAnchor: binding.anchor,
          contentHash: binding.contentHash,
        })),
      });
    }
  };
  if ('$transaction' in db) {
    await db.$transaction(
      (tx) => freezeGenerationInputs(tx),
      { isolationLevel: 'Serializable' },
    );
  } else {
    await freezeGenerationInputs(db);
  }
  const common = {
    course: task.courseBasis.title,
    topic: task.topic,
    audience: task.audience,
    prerequisites: task.prerequisites,
    durationMinutes: task.durationMinutes,
    goals: task.goals,
    knowledgePoints: task.knowledgePoints,
    aggregateClassContext: task.aggregateClassContext,
    sourcePackItems: [...sourcePackItems, ...textbookBindings],
  };
  const previous = Object.fromEntries(context.stages
    .filter((item) => item.state === 'COMPLETED' && item.output !== null)
    .map((item) => [item.kind, item.output]));
  const schema: z.ZodTypeAny = stage === 'OUTLINE'
    ? smartLessonOutlineOutputSchema
    : createBopppsStageSchemaForAllowedBindings(allowedSourceBindings);
  return {
    schema,
    schemaVersion: stage === 'OUTLINE' ? 'smart-lesson-outline.v1' : `smart-lesson-boppps-${stage.toLowerCase()}.v1`,
    maxOutputTokens: stage === 'OUTLINE' ? 2_048 : 4_096,
    system: '你是单课 BOPPPS 教案生成器。只能使用给定的已确认目标、知识点、服务端来源证据和聚合班级上下文；不得创建新的来源绑定。sourceBindings 只能从 JSON Schema 枚举的可用来源绑定中完整选择；没有适用项时使用 []。每个 BOPPPS 阶段的 minutes 必须严格等于该阶段所有 steps 的 minutes 之和。输出必须符合 JSON Schema。',
    prompt: `生成阶段 ${stage}。任务上下文：${JSON.stringify(common)}。可用来源绑定（逐字复制，不得改写）：${JSON.stringify(allowedSourceBindings)}。已完成阶段：${JSON.stringify(previous)}。`,
    allowedSourceBindings,
    allowedBindingKeys: new Set(allowedSourceBindings.map(bindingKey)),
  };
}

type SourceBinding = z.infer<typeof sourceBindingSchema>;

const STAGE_STEP_DURATION_MISMATCH_MESSAGE = /^stage-step-duration-mismatch:(\d+):(\d+)$/;

function normalizeStageStepDurationIssues(issues: SmartLessonValidationReceipt['issues']) {
  return issues.map((issue) => (STAGE_STEP_DURATION_MISMATCH_MESSAGE.test(issue.message)
    ? { ...issue, code: 'stage-step-duration-mismatch', path: ['steps'] as Array<string | number> }
    : issue));
}

function validateStageCandidate(input: {
  context: NonNullable<JobContext>;
  stage: SmartLessonGenerationStageKind;
  schema: z.ZodType<unknown>;
  schemaVersion: string;
  output: unknown;
  allowedSourceBindings: SourceBinding[];
  allowedBindingKeys: ReadonlySet<string>;
}): { success: true; output: unknown; receipt: SmartLessonValidationReceipt }
  | { success: false; output: unknown; receipt: SmartLessonValidationReceipt } {
  const schemaValidated = validateSmartLessonProviderOutput(
    input.schema,
    input.schemaVersion,
    normalizeCandidateSourceBindings(input.stage, input.output, input.allowedSourceBindings),
  );
  if (!schemaValidated.success) {
    return {
      ...schemaValidated,
      receipt: {
        ...schemaValidated.receipt,
        issues: normalizeStageStepDurationIssues(schemaValidated.receipt.issues),
      },
    };
  }
  try {
    const output = canonicalizeGeneratedStageOutput(
      input.stage,
      schemaValidated.output,
      input.allowedSourceBindings,
    );
    validateGeneratedStage(input.context, input.stage, output, input.allowedBindingKeys);
    return { success: true, output, receipt: schemaValidated.receipt };
  } catch (error) {
    const receipt = stageGateValidationReceipt(error, input.schemaVersion);
    if (!receipt) throw error;
    return { success: false, output: schemaValidated.output, receipt };
  }
}

function stageGateValidationReceipt(
  error: unknown,
  schemaVersion: string,
): SmartLessonValidationReceipt | null {
  if (error instanceof ZodError) {
    return {
      valid: false,
      schemaVersion,
      issues: error.issues.slice(0, 50).map((issue) => ({
        code: issue.code,
        path: issue.path,
        message: '候选内容未通过结构校验。',
      })),
    };
  }
  if (!(error instanceof SmartLessonPlanError)) return null;
  const stageMissing = /^outline-stage-missing:(bridgeIn|objectives|preAssessment|participatoryLearning|postAssessment|summary)$/.exec(error.code);
  if (stageMissing) {
    return {
      valid: false,
      schemaVersion,
      issues: [{
        code: 'outline-stage-missing',
        path: ['coursewareStepOutline'],
        message: `提纲缺少必要的 ${stageMissing[1]} 阶段。`,
      }],
    };
  }
  const issue = ({
    'outline-duration-mismatch': {
      path: ['coursewareStepOutline'],
      message: '提纲各阶段时长总和与课程时长不一致。',
    },
    'aggregate-context-ref-changed': {
      path: ['classAdaptation', 'aggregateContextRef'],
      message: '班级学情引用与任务上下文不一致。',
    },
    'generated-source-binding-unverified': {
      path: ['steps', 'sourceBindings'],
      message: '生成内容包含未验证的来源绑定。',
    },
    'stage-duration-mismatch': {
      path: ['minutes'],
      message: '阶段时长与已确认提纲不一致。',
    },
  } as const)[error.code as 'outline-duration-mismatch'
    | 'aggregate-context-ref-changed'
    | 'generated-source-binding-unverified'
    | 'stage-duration-mismatch'];
  return issue ? {
    valid: false,
    schemaVersion,
    issues: [{ code: error.code, path: [...issue.path], message: issue.message }],
  } : null;
}

function normalizeCandidateSourceBindings(
  stage: SmartLessonGenerationStageKind,
  output: unknown,
  allowedSourceBindings: SourceBinding[],
) {
  if (stage === 'OUTLINE') return output;
  const parsed = bopppsStageSchema.safeParse(output);
  return parsed.success
    ? canonicalizeGeneratedStageOutput(stage, parsed.data, allowedSourceBindings)
    : output;
}

function canonicalizeGeneratedStageOutput(
  stage: SmartLessonGenerationStageKind,
  output: unknown,
  allowedSourceBindings: SourceBinding[],
) {
  if (stage === 'OUTLINE') return output;
  const parsed = bopppsStageSchema.parse(output);
  const bindingsByEvidenceIdentity = new Map<string, SourceBinding[]>();
  for (const binding of allowedSourceBindings) {
    const identity = evidenceIdentity(binding);
    bindingsByEvidenceIdentity.set(identity, [...(bindingsByEvidenceIdentity.get(identity) ?? []), binding]);
  }
  return {
    ...parsed,
    steps: parsed.steps.map((step) => ({
      ...step,
      sourceBindings: step.sourceBindings.map((binding) => {
        const matches = bindingsByEvidenceIdentity.get(evidenceIdentity(binding)) ?? [];
        return matches.length === 1 ? matches[0] : binding;
      }),
    })),
  };
}

function validateGeneratedStage(
  context: NonNullable<JobContext>,
  stage: SmartLessonGenerationStageKind,
  output: unknown,
  allowedBindings: ReadonlySet<string>,
) {
  if (stage === 'OUTLINE') {
    const outline = smartLessonOutlineOutputSchema.parse(output);
    if (outline.coursewareStepOutline.reduce((total, step) => total + step.minutes, 0) !== context.draft.task.durationMinutes) {
      throw new SmartLessonPlanError('outline-duration-mismatch', 409);
    }
    for (const key of BOPPPS_STAGE_KEYS) {
      if (!outline.coursewareStepOutline.some((step) => step.bopppsStage === key)) {
        throw new SmartLessonPlanError(`outline-stage-missing:${key}`, 409);
      }
    }
    if ((outline.classAdaptation?.aggregateContextRef ?? null) !== (context.draft.task.aggregateClassContextRef ?? null)) {
      throw new SmartLessonPlanError('aggregate-context-ref-changed', 409);
    }
    return;
  }
  const parsed = bopppsStageSchema.parse(output);
  for (const binding of parsed.steps.flatMap((step) => step.sourceBindings)) {
    if (!allowedBindings.has(bindingKey(binding))) throw new SmartLessonPlanError('generated-source-binding-unverified', 409);
  }
  const expectedMinutes = expectedStageMinutes(context, stage);
  if (parsed.minutes !== expectedMinutes) throw new SmartLessonPlanError('stage-duration-mismatch', 409);
}

function buildCorrectionContext(
  context: NonNullable<JobContext>,
  stage: SmartLessonGenerationStageKind,
  output: unknown,
  receipt: SmartLessonValidationReceipt,
) {
  if (stage === 'OUTLINE') return null;
  const stepMismatch = receipt.issues.find((issue) => issue.code === 'stage-step-duration-mismatch');
  if (stepMismatch) {
    const match = STAGE_STEP_DURATION_MISMATCH_MESSAGE.exec(stepMismatch.message);
    let expectedMinutes: number;
    try {
      expectedMinutes = expectedStageMinutes(context, stage);
    } catch {
      return null;
    }
    if (!match || !Number.isInteger(expectedMinutes) || expectedMinutes <= 0) return null;
    return {
      stage,
      expectedMinutes,
      actualMinutes: Number(match[1]),
      instruction: `保持步骤数量、顺序、标题、教学活动、评价内容与 sourceBindings 不变；stage.minutes 与每个步骤 minutes 都必须是正整数，所有步骤 minutes 之和必须严格等于 ${expectedMinutes} 分钟，stage.minutes 同步修正为 ${expectedMinutes}；优先保持原有步骤时长比例，不得扩展教学语义。`,
    };
  }
  if (!receipt.issues.some((issue) => issue.code === 'stage-duration-mismatch')) return null;
  const parsed = bopppsStageSchema.parse(output);
  const expectedMinutes = expectedStageMinutes(context, stage);
  return {
    stage,
    expectedMinutes,
    actualMinutes: parsed.minutes,
    instruction: `将 minutes 和 steps 时长总和修正为 ${expectedMinutes} 分钟；sourceBindings 仍只能使用 requiredSchema 允许的来源绑定。`,
  };
}

function expectedStageMinutes(
  context: NonNullable<JobContext>,
  stage: Exclude<SmartLessonGenerationStageKind, 'OUTLINE'>,
) {
  const outline = smartLessonOutlineOutputSchema.parse(context.stages.find((item) => item.kind === 'OUTLINE')?.output);
  const planKey = STAGE_TO_PLAN_KEY[stage];
  return outline.coursewareStepOutline
    .filter((step) => step.bopppsStage === planKey)
    .reduce((total, step) => total + step.minutes, 0);
}

function assembleCompletedPlan(context: NonNullable<JobContext>, summaryOutput: unknown) {
  const task = context.draft.task;
  const outline = smartLessonOutlineOutputSchema.parse(context.stages.find((stage) => stage.kind === 'OUTLINE')?.output);
  const outputFor = (kind: keyof typeof STAGE_TO_PLAN_KEY) => bopppsStageSchema.parse(
    kind === 'SUMMARY' ? summaryOutput : context.stages.find((stage) => stage.kind === kind)?.output,
  );
  const goals = task.goals.map((goal) => ({
    id: goal.id,
    content: goal.content,
    sourceState: goal.sourceState,
    sourceBindings: sourceBindingSchema.array().parse(goal.sourceBindings),
    gapIdentity: goal.gapIdentity,
    standardsMappings: Array.isArray(goal.standardsMappings) ? goal.standardsMappings : [],
  }));
  const knowledgePoints = task.knowledgePoints.map((point) => ({
    id: point.id,
    title: point.title,
    sourceState: point.sourceState,
    sourceBindings: sourceBindingSchema.array().parse(point.sourceBindings),
    gapIdentity: point.gapIdentity,
  }));
  const boppps = Object.fromEntries(Object.entries(STAGE_TO_PLAN_KEY).map(([kind, key]) => [key, outputFor(kind as keyof typeof STAGE_TO_PLAN_KEY)]));
  const sources = uniqueBindings([
    ...goals.flatMap((goal) => goal.sourceBindings),
    ...knowledgePoints.flatMap((point) => point.sourceBindings),
    ...Object.values(boppps).flatMap((stage) => stage.steps.flatMap((step) => step.sourceBindings)),
  ]);
  return {
    schemaVersion: SMART_LESSON_PLAN_SCHEMA_VERSION,
    course: task.courseBasis.title,
    topic: task.topic,
    audience: task.audience,
    durationMinutes: task.durationMinutes,
    prerequisites: task.prerequisites,
    goals,
    knowledgePoints,
    keyContent: outline.keyContent,
    difficultContent: outline.difficultContent,
    boppps,
    sources,
    limitations: outline.limitations,
    classAdaptation: outline.classAdaptation,
    coursewareStepOutline: outline.coursewareStepOutline,
  };
}

function uniqueBindings(bindings: Array<ReturnType<typeof sourceBindingSchema.parse>>) {
  return [...new Map(bindings.map((binding) => [bindingKey(binding), binding])).values()];
}

function bindingKey(binding: ReturnType<typeof sourceBindingSchema.parse>) {
  return `${binding.sourceVersionId}\u0000${binding.anchor}\u0000${binding.contentHash}\u0000${binding.citationId}`;
}

function evidenceIdentity(binding: SourceBinding) {
  return `${binding.sourceVersionId}\u0000${binding.anchor}\u0000${binding.contentHash}`;
}

async function markPreProviderFailure(
  db: WorkerDb,
  context: NonNullable<JobContext>,
  stage: SmartLessonGenerationStageKind,
  error: unknown,
) {
  const retryable = isRetryableStageError(error);
  const state = retryable ? 'RETRYABLE' as const : 'FAILED' as const;
  if (!('$transaction' in db)) throw error;
  await db.$transaction(async (tx) => {
    const transitioned = await tx.smartLessonGenerationJob.updateMany({
      where: {
        id: context.id,
        state: { in: ['QUEUED', 'RUNNING'] },
        activeIdentity: `draft:${context.draftId}`,
      },
      data: { state, failureCode: errorCode(error), firstIncompleteStage: stage },
    });
    if (transitioned.count !== 1) return;
    await tx.smartLessonGenerationStage.updateMany({
      where: { jobId: context.id, kind: stage, state: { in: ['PENDING', 'RETRYABLE'] } },
      data: { state, actionState: 'RETRYABLE', claimToken: null, claimExpiresAt: null },
    });
    await tx.smartLessonDraft.updateMany({
      where: { id: context.draftId, state: 'GENERATING' },
      data: { state: 'EDITABLE' },
    });
  });
  return state;
}

function errorCode(error: unknown) {
  if (error instanceof SmartLessonPlanError) return error.code.slice(0, 200);
  if (error instanceof ZodError) return 'provider-schema-invalid';
  if (error instanceof Error && /(?:curl:\s*\(28\)|\b(?:timed out|timeout)\b)/i.test(error.message)) {
    return 'provider-timeout';
  }
  if (error instanceof Error && error.name) return `provider-${error.name}`.slice(0, 200);
  return 'provider-request-failed';
}

function isRetryableStageError(error: unknown) {
  if (error instanceof SmartLessonPlanError && error.code === 'provider-output-invalid-after-correction') return true;
  return !(error instanceof SmartLessonPlanError)
    && !(error instanceof CourseBasisError)
    && !(error instanceof ZodError);
}

export async function processSmartLessonBullJob(job: Job<{ jobId: string }>) {
  return processSmartLessonGenerationJob(prisma, job.data.jobId);
}
