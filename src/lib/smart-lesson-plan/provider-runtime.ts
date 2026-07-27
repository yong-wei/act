import { generateText, Output, zodSchema } from 'ai';
import { z } from 'zod';

import { createAIProviderFromConfig } from '../ai/provider-registry';
import {
  AIProviderCapabilityUnavailableError,
  getAIProviderSettings,
  resolveConfiguredAIProviderConfig,
  type AIProviderSettings,
} from '../ai/provider-settings';

import {
  SmartLessonPlanError,
  contentHash,
  createDeterministicFixtureProvider,
  type SmartLessonFixtureStage,
} from './domain';
import {
  BOPPPS_STAGE_KEYS,
  smartLessonAdvisoryReviewSchema,
  smartLessonPlanSchema,
  smartLessonReviewProviderAuditSchema,
  type SmartLessonPlan,
} from './schema';

export const SMART_LESSON_PROMPT_VERSION = 'smart-lesson-plan.v1';
export const SMART_LESSON_REVIEW_PROMPT_VERSION = 'smart-lesson-review.v1';
const SMART_LESSON_ADVISORY_TIMEOUT_MS = 180_000;

const smartLessonAdvisoryProviderResponseSchema = z.object({
  goalCoverage: z.string().trim().min(1).max(800),
  sourceConsistency: z.string().trim().min(1).max(800),
  bopppsStructure: z.string().trim().min(1).max(800),
  findings: z.array(z.object({
    category: z.enum(['GOAL_COVERAGE', 'SOURCE_CONSISTENCY', 'BOPPPS_STRUCTURE', 'CONTENT_QUALITY']),
    severity: z.enum(['INFO', 'SUGGESTION', 'WARNING']),
    message: z.string().trim().min(1).max(500),
    path: z.string().trim().min(1).max(500).nullable(),
    proposedReplacement: z.string().trim().min(1).max(2_000).nullable().optional(),
  }).strict()).max(8),
  suggestions: z.array(z.string().trim().min(1).max(500)).max(6),
}).strict();

type GenerateObjectResult<T> = {
  object: T;
  usage?: { inputTokens?: number; outputTokens?: number };
  response?: { id?: string };
};

type RuntimeDependencies = {
  resolveConfig?: typeof resolveConfiguredAIProviderConfig;
  getSettings?: typeof getAIProviderSettings;
  generate?: (input: Record<string, unknown>) => Promise<GenerateObjectResult<unknown>>;
  advisoryTimeoutMs?: number;
};

type StructuredProviderSelection = {
  providerId?: string;
  modelId?: string;
  settings?: AIProviderSettings;
};

export async function resolveSmartLessonStructuredProvider(
  dependencies: RuntimeDependencies = {},
  selection: StructuredProviderSelection = {},
) {
  try {
    if (!dependencies.resolveConfig && !dependencies.generate && smartLessonE2EFixtureRequested()) {
      return deterministicStructuredFixtureRuntime();
    }
    const config = await (dependencies.resolveConfig ?? resolveConfiguredAIProviderConfig)(
      selection.providerId,
      selection.modelId,
      { jsonSchema: true },
      selection.settings,
    );
    if (!config.enabled) throw new SmartLessonPlanError('structured-provider-unavailable', 503);
    const adapter = createAIProviderFromConfig(config);
    return {
      serviceId: config.provider,
      providerKind: config.providerKind,
      model: config.model,
      async generate<T>(input: {
        schema: z.ZodType<T>;
        schemaVersion: string;
        promptVersion: string;
        system: string;
        prompt: string;
        idempotencyKey: string;
        maxOutputTokens?: number;
        deferValidation?: boolean;
        timeoutMs?: number;
      }) {
        const schemaName = input.schemaVersion.replace(/[^A-Za-z0-9_-]/g, '_');
        const result = await runWithOptionalTimeout(input.timeoutMs, (abortSignal) => (
          dependencies.generate
            ? dependencies.generate({
                model: adapter.getModel(),
                schema: input.schema,
                schemaName,
                system: input.system,
                prompt: input.prompt,
                temperature: 0.1,
                maxRetries: 0,
                maxOutputTokens: input.maxOutputTokens ?? 8_000,
                timeout: input.timeoutMs,
                abortSignal,
                headers: { 'Idempotency-Key': input.idempotencyKey },
              })
            : generateUnvalidatedJson({
                model: adapter.getModel(),
                schema: input.schema,
                schemaName,
                system: input.system,
                prompt: input.prompt,
                idempotencyKey: input.idempotencyKey,
                maxOutputTokens: input.maxOutputTokens ?? 8_000,
                timeoutMs: input.timeoutMs,
                abortSignal,
              })
        ));
        const normalized = normalizeSmartLessonProviderOutput(result.object);
        const output = input.deferValidation ? normalized : input.schema.parse(normalized);
        return {
          output,
          normalizedResponseId: result.response?.id?.trim() || `sha256:${contentHash(output)}`,
          inputTokens: result.usage?.inputTokens ?? null,
          outputTokens: result.usage?.outputTokens ?? null,
          costMicros: null,
          audit: smartLessonReviewProviderAuditSchema.parse({
            serviceId: config.provider,
            providerKind: config.providerKind,
            model: config.model,
            promptVersion: input.promptVersion,
            schemaVersion: input.schemaVersion,
            normalizedResponseId: result.response?.id?.trim() || `sha256:${contentHash(result.object)}`,
            inputTokens: result.usage?.inputTokens ?? null,
            outputTokens: result.usage?.outputTokens ?? null,
            costMicros: null,
          }),
        };
      },
    };
  } catch (error) {
    if (error instanceof SmartLessonPlanError) throw error;
    if (error instanceof AIProviderCapabilityUnavailableError) {
      throw new SmartLessonPlanError('structured-provider-unavailable', 503);
    }
    throw error;
  }
}

async function generateUnvalidatedJson(input: {
  model: Parameters<typeof generateText>[0]['model'];
  schema: z.ZodTypeAny;
  schemaName: string;
  system: string;
  prompt: string;
  idempotencyKey: string;
  maxOutputTokens: number;
  timeoutMs?: number;
  abortSignal?: AbortSignal;
}): Promise<GenerateObjectResult<unknown>> {
  const result = await generateText({
    model: input.model,
    output: Output.json({ name: input.schemaName }),
    system: input.system,
    prompt: `${input.prompt}\n必须遵循的 JSON Schema：${JSON.stringify(zodSchema(input.schema).jsonSchema)}`,
    temperature: 0.1,
    maxRetries: 0,
    maxOutputTokens: input.maxOutputTokens,
    timeout: input.timeoutMs,
    abortSignal: input.abortSignal,
    headers: { 'Idempotency-Key': input.idempotencyKey },
  });
  return {
    object: result.output,
    usage: {
      inputTokens: result.usage.inputTokens,
      outputTokens: result.usage.outputTokens,
    },
    response: { id: result.response.id },
  };
}

async function runWithOptionalTimeout<T>(
  timeoutMs: number | undefined,
  operation: (abortSignal?: AbortSignal) => Promise<T>,
): Promise<T> {
  if (timeoutMs === undefined) return operation();
  const controller = new AbortController();
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const timeoutResult = new Promise<never>((_resolve, reject) => {
    timeout = setTimeout(() => {
      reject(new SmartLessonPlanError('advisory-provider-timeout', 503));
      controller.abort();
    }, timeoutMs);
  });
  try {
    return await Promise.race([operation(controller.signal), timeoutResult]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

export type SmartLessonValidationReceipt = {
  valid: boolean;
  schemaVersion: string;
  issues: Array<{ code: string; path: Array<string | number>; message: string }>;
};

export function normalizeSmartLessonProviderOutput(value: unknown, key?: string): unknown {
  if (Array.isArray(value)) return value.map((item) => normalizeSmartLessonProviderOutput(item));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>)
      .map(([childKey, child]) => [childKey, normalizeSmartLessonProviderOutput(child, childKey)]));
  }
  if (typeof value === 'string') {
    const normalized = value.trim().replaceAll(/\r\n?/g, '\n');
    if (key === 'minutes' && /^\d+$/.test(normalized)) return Number(normalized);
    return normalized;
  }
  return value;
}

export function validateSmartLessonProviderOutput<T>(
  schema: z.ZodType<T>,
  schemaVersion: string,
  value: unknown,
): { success: true; output: T; receipt: SmartLessonValidationReceipt }
  | { success: false; output: unknown; receipt: SmartLessonValidationReceipt } {
  const output = normalizeSmartLessonProviderOutput(value);
  const result = schema.safeParse(output);
  if (result.success) {
    return { success: true, output: result.data, receipt: { valid: true, schemaVersion, issues: [] } };
  }
  return {
    success: false,
    output,
    receipt: {
      valid: false,
      schemaVersion,
      issues: result.error.issues.slice(0, 50).map((issue) => ({
        code: issue.code,
        path: issue.path,
        message: issue.message,
      })),
    },
  };
}

function smartLessonE2EFixtureRequested() {
  return process.env.SMART_LESSON_E2E_FIXTURE_TOKEN === 'smart-lesson-real-browser-v1';
}

function deterministicStructuredFixtureRuntime() {
  const fixture = createDeterministicFixtureProvider(process.env.NODE_ENV);
  return {
    serviceId: fixture.serviceId,
    providerKind: 'fixture',
    model: 'deterministic-smart-lesson-v1',
    async generate<T>(input: {
      schema: z.ZodType<T>;
      schemaVersion: string;
      promptVersion: string;
      system: string;
      prompt: string;
      idempotencyKey: string;
      maxOutputTokens?: number;
    }) {
      const fixtureStage = input.schemaVersion === 'smart-lesson-advisory-review.v1'
        ? null
        : fixtureStageFromSchemaVersion(input.schemaVersion);
      const output = input.schemaVersion === 'smart-lesson-advisory-review.v1'
        ? {
            goalCoverage: '教学目标已在完整教案中得到覆盖。',
            sourceConsistency: '来源状态和引用边界保持一致。',
            bopppsStructure: 'BOPPPS 六阶段结构完整。',
            findings: [{
              category: 'CONTENT_QUALITY' as const,
              severity: 'SUGGESTION' as const,
              message: '可在授课后根据形成性评价结果继续修订。',
              path: 'boppps.summary.steps.0.assessment',
              proposedReplacement: '根据形成性评价结果记录本节课的达成情况与后续修订方向。',
            }],
            suggestions: ['保留教师最终判断并记录后续修订。'],
          }
        : adaptFixtureDuration(await fixture.generateStage({
            mode: 'success',
            stage: fixtureStage!,
            seed: input.idempotencyKey,
          }), fixtureStage!, requestedFixtureDuration(input.prompt));
      const parsed = input.schema.parse(output);
      const normalizedResponseId = `fixture:${contentHash({ schemaVersion: input.schemaVersion, output: parsed })}`;
      return {
        output: parsed,
        normalizedResponseId,
        inputTokens: 0,
        outputTokens: 0,
        costMicros: null,
        audit: smartLessonReviewProviderAuditSchema.parse({
          serviceId: fixture.serviceId,
          providerKind: 'fixture',
          model: 'deterministic-smart-lesson-v1',
          promptVersion: input.promptVersion,
          schemaVersion: input.schemaVersion,
          normalizedResponseId,
          inputTokens: 0,
          outputTokens: 0,
          costMicros: null,
        }),
      };
    },
  };
}

function requestedFixtureDuration(prompt: string) {
  const match = prompt.match(/"durationMinutes"\s*:\s*(\d{2,3})/);
  return match ? Number(match[1]) : 30;
}

function adaptFixtureDuration(output: unknown, stage: SmartLessonFixtureStage, durationMinutes: number) {
  if (durationMinutes === 30) return output;
  const stageMinutes = stage === 'PARTICIPATORY_LEARNING'
    ? durationMinutes - 25
    : 5;
  if (stage === 'OUTLINE') {
    const outline = structuredClone(output) as { coursewareStepOutline: Array<{ bopppsStage: string; minutes: number }> };
    outline.coursewareStepOutline = outline.coursewareStepOutline.map((step) => ({
      ...step,
      minutes: step.bopppsStage === 'participatoryLearning' ? durationMinutes - 25 : 5,
    }));
    return outline;
  }
  const boppps = structuredClone(output) as { minutes: number; steps: Array<{ minutes: number }> };
  boppps.minutes = stageMinutes;
  boppps.steps = boppps.steps.map((step, index) => ({ ...step, minutes: index === 0 ? stageMinutes : 0 }));
  return boppps;
}

function fixtureStageFromSchemaVersion(schemaVersion: string): SmartLessonFixtureStage {
  if (schemaVersion === 'smart-lesson-outline.v1') return 'OUTLINE';
  const suffix = schemaVersion.match(/^smart-lesson-boppps-(.+)\.v1$/)?.[1]?.toUpperCase();
  if (suffix && ['BRIDGE_IN', 'OBJECTIVES', 'PRE_ASSESSMENT', 'PARTICIPATORY_LEARNING', 'POST_ASSESSMENT', 'SUMMARY'].includes(suffix)) {
    return suffix as SmartLessonFixtureStage;
  }
  throw new SmartLessonPlanError('fixture-schema-version-unsupported', 500);
}

export async function generateSmartLessonAdvisoryReport(input: {
  plan: unknown;
  idempotencyKey: string;
}, dependencies: RuntimeDependencies = {}) {
  try {
    const reviewProjection = projectSmartLessonPlanForAdvisoryReview(input.plan);
    const runtime = await resolveSmartLessonAdvisoryProvider(dependencies);
    const generated = await runtime.generate({
      schema: smartLessonAdvisoryProviderResponseSchema,
      schemaVersion: 'smart-lesson-advisory-review.v1',
      promptVersion: SMART_LESSON_REVIEW_PROMPT_VERSION,
      system: '你是教学设计审核助手。仅提供简洁建议，不得给出批准、发布或阻断结论。必须完整审核目标覆盖、来源一致性、BOPPPS 结构、内容质量四类事项。finding 只保留最重要的 8 项，suggestion 最多 6 项。可直接应用的 finding 必须把 path 定位到原教案中的一个可编辑字符串字段，并在 proposedReplacement 中给出该字段的完整替换文本；sourceCatalog 和 sourceCitationIds 仅供来源审核，不得作为 path；无法形成确定修改时将 proposedReplacement 设为 null。输出必须符合给定结构。',
      prompt: `请审核以下语义完整的教案投影并简洁作答：\n${JSON.stringify(reviewProjection)}`,
      idempotencyKey: input.idempotencyKey,
      maxOutputTokens: 1_600,
      timeoutMs: dependencies.advisoryTimeoutMs ?? SMART_LESSON_ADVISORY_TIMEOUT_MS,
    });
    return {
      ...generated,
      output: smartLessonAdvisoryReviewSchema.parse(generated.output),
    };
  } catch (error) {
    if (error instanceof SmartLessonPlanError && [
      'advisory-provider-timeout',
      'structured-provider-unavailable',
    ].includes(error.code)) {
      throw error;
    }
    if (error instanceof AIProviderCapabilityUnavailableError) {
      throw new SmartLessonPlanError('structured-provider-unavailable', 503);
    }
    if (error instanceof z.ZodError) {
      throw new SmartLessonPlanError('advisory-provider-schema-invalid', 503);
    }
    if (isTimeoutLikeProviderError(error)) {
      throw new SmartLessonPlanError('advisory-provider-timeout', 503);
    }
    throw new SmartLessonPlanError('advisory-provider-upstream-failed', 503);
  }
}

async function resolveSmartLessonAdvisoryProvider(dependencies: RuntimeDependencies) {
  if (
    !dependencies.resolveConfig
    && !dependencies.getSettings
    && !dependencies.generate
    && smartLessonE2EFixtureRequested()
  ) {
    return resolveSmartLessonStructuredProvider(dependencies);
  }
  if (dependencies.resolveConfig && !dependencies.getSettings) {
    return resolveSmartLessonStructuredProvider(dependencies);
  }
  const settings = await (dependencies.getSettings ?? getAIProviderSettings)();
  const resolveConfig = dependencies.resolveConfig ?? resolveConfiguredAIProviderConfig;
  const selectedConfig = await resolveConfig(
    undefined,
    undefined,
    { jsonSchema: true },
    settings,
  );
  if (!selectedConfig.enabled) {
    throw new SmartLessonPlanError('structured-provider-unavailable', 503);
  }
  const provider = settings.providers.find((candidate) => candidate.id === selectedConfig.provider);
  const advisoryModel = provider?.models.find((model) => model.options?.enableThinking === false)?.model
    ?? selectedConfig.model;
  return resolveSmartLessonStructuredProvider(dependencies, {
    providerId: selectedConfig.provider,
    modelId: advisoryModel,
    settings,
  });
}

function projectSmartLessonPlanForAdvisoryReview(value: unknown) {
  const plan = smartLessonPlanSchema.parse(value);
  const sourceCatalog = new Map<string, {
    citationId: string;
    anchor: string;
    sourceKind?: 'upload' | 'textbook';
    title?: string;
    structuralPath?: string[];
  }>();
  const sourceCitationIds = (bindings: SmartLessonPlan['sources']) => {
    for (const binding of bindings) {
      const existing = sourceCatalog.get(binding.citationId);
      sourceCatalog.set(binding.citationId, {
        citationId: binding.citationId,
        anchor: existing?.anchor ?? binding.anchor,
        ...(existing?.sourceKind || binding.sourceKind
          ? { sourceKind: existing?.sourceKind ?? binding.sourceKind }
          : {}),
        ...(existing?.title || binding.title
          ? { title: existing?.title ?? binding.title }
          : {}),
        ...(existing?.structuralPath || binding.structuralPath
          ? { structuralPath: existing?.structuralPath ?? binding.structuralPath }
          : {}),
      });
    }
    return [...new Set(bindings.map((binding) => binding.citationId))];
  };

  sourceCitationIds(plan.sources);
  return {
    schemaVersion: plan.schemaVersion,
    course: plan.course,
    topic: plan.topic,
    audience: plan.audience,
    durationMinutes: plan.durationMinutes,
    prerequisites: plan.prerequisites,
    goals: plan.goals.map((goal) => ({
      id: goal.id,
      content: goal.content,
      sourceState: goal.sourceState,
      sourceCitationIds: sourceCitationIds(goal.sourceBindings),
      standardsMappings: goal.standardsMappings,
    })),
    knowledgePoints: plan.knowledgePoints.map((point) => ({
      id: point.id,
      title: point.title,
      sourceState: point.sourceState,
      sourceCitationIds: sourceCitationIds(point.sourceBindings),
    })),
    keyContent: plan.keyContent,
    difficultContent: plan.difficultContent,
    boppps: Object.fromEntries(BOPPPS_STAGE_KEYS.map((stageKey) => {
      const stage = plan.boppps[stageKey];
      return [stageKey, {
        minutes: stage.minutes,
        teacherActivity: stage.teacherActivity,
        studentActivity: stage.studentActivity,
        assessment: stage.assessment,
        steps: stage.steps.map((step) => ({
          title: step.title,
          minutes: step.minutes,
          teacherActivity: step.teacherActivity,
          studentActivity: step.studentActivity,
          assessment: step.assessment,
          sourceCitationIds: sourceCitationIds(step.sourceBindings),
        })),
      }];
    })),
    sourceCatalog: [...sourceCatalog.values()],
    limitations: plan.limitations,
    classAdaptation: plan.classAdaptation
      ? { emphasis: plan.classAdaptation.emphasis }
      : null,
    coursewareStepOutline: plan.coursewareStepOutline,
  };
}

function isTimeoutLikeProviderError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return error.name === 'AbortError'
    || error.name === 'TimeoutError'
    || error.message.toLowerCase().includes('timed out')
    || error.message.toLowerCase().includes('timeout');
}
