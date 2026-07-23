import { generateObject } from 'ai';
import type { z } from 'zod';

import { createAIProviderFromConfig } from '@/lib/ai/provider-registry';
import { AIProviderCapabilityUnavailableError, resolveConfiguredAIProviderConfig } from '@/lib/ai/provider-settings';
import { contentHash } from '@/lib/smart-lesson-plan/domain';
import type { SmartLessonSourceBinding } from '@/lib/smart-lesson-plan/domain';
import { validateSmartLessonPlan, type SmartLessonPlan } from '@/lib/smart-lesson-plan/schema';

import { SmartCoursewareError } from './domain';
import type { CoursewareGenerationUnitKey } from './generation-service';
import {
  coursewareGeneratedStageOutputSchema,
  legacyCoursewareGeneratedStageOutputSchema,
} from './schema';

export const SMART_COURSEWARE_PROMPT_VERSION = 'smart-courseware-generation.v2';

export const COURSEWARE_PLAN_STAGE_KEYS = {
  'bridge-in': 'bridgeIn',
  objective: 'objectives',
  'pre-assessment': 'preAssessment',
  'participatory-learning': 'participatoryLearning',
  'post-assessment': 'postAssessment',
  summary: 'summary',
} as const;

type RuntimeDependencies = {
  resolveConfig?: typeof resolveConfiguredAIProviderConfig;
  generate?: (input: Record<string, unknown>) => Promise<{
    object: unknown;
    usage?: { inputTokens?: number; outputTokens?: number };
    response?: { id?: string };
  }>;
};

export async function resolveSmartCoursewareStructuredProvider(dependencies: RuntimeDependencies = {}) {
  try {
    if (!dependencies.resolveConfig && !dependencies.generate && fixtureRequested()) {
      return deterministicCoursewareRuntime();
    }
    const config = await (dependencies.resolveConfig ?? resolveConfiguredAIProviderConfig)(undefined, undefined, { jsonSchema: true });
    if (!config.enabled) throw new SmartCoursewareError('structured-provider-unavailable', 503);
    const adapter = createAIProviderFromConfig(config);
    return {
      serviceId: config.provider,
      providerKind: config.providerKind,
      model: config.model,
      async generate<T>(input: {
        schema: z.ZodType<T>;
        schemaVersion: string;
        system: string;
        prompt: string;
        idempotencyKey: string;
        fixtureOutput?: unknown;
      }) {
        const generator = dependencies.generate ?? (generateObject as unknown as RuntimeDependencies['generate']);
        const result = await generator!({
          model: adapter.getModel(), schema: input.schema,
          schemaName: input.schemaVersion.replace(/[^A-Za-z0-9_-]/g, '_'),
          system: input.system, prompt: input.prompt, temperature: 0.1,
          maxRetries: 0, maxOutputTokens: 8_000,
          headers: { 'Idempotency-Key': input.idempotencyKey },
        });
        const output = input.schema.parse(result.object);
        return {
          output,
          normalizedResponseId: result.response?.id?.trim() || `sha256:${contentHash(output)}`,
          inputTokens: result.usage?.inputTokens ?? null,
          outputTokens: result.usage?.outputTokens ?? null,
          costMicros: null,
        };
      },
    };
  } catch (error) {
    if (error instanceof SmartCoursewareError) throw error;
    if (error instanceof AIProviderCapabilityUnavailableError) throw new SmartCoursewareError('structured-provider-unavailable', 503);
    throw error;
  }
}

export function createDeterministicCoursewareStage(input: {
  unitKey: CoursewareGenerationUnitKey;
  durationSeconds: number;
  approvedPlan: unknown;
  sourceBinding?: SmartLessonSourceBinding;
}) {
  const approvedPlan = validateSmartLessonPlan(input.approvedPlan);
  const stepExpectations = deriveCoursewareApprovedStepExpectations(approvedPlan, input.unitKey);
  const activity = ['pre-assessment', 'participatory-learning', 'post-assessment'].includes(input.unitKey);
  const knowledgeIndex = ({
    'bridge-in': 0,
    objective: 0,
    'pre-assessment': 1,
    'participatory-learning': 1,
    'post-assessment': 2,
    summary: 2,
  } as const)[input.unitKey];
  const knowledgeText = approvedPlan.knowledgePoints[knowledgeIndex]?.title ?? approvedPlan.topic;
  const generatedSteps = stepExpectations.map((expectation, index) => {
    const suffix = index === 0 ? '' : `-${index + 1}`;
    const moduleId = `generated-${input.unitKey}${suffix}`;
    const runtimeModule = activity && index === 0 ? {
      id: moduleId,
      canonicalClass: 'activity.panel',
      slotId: 'main',
      sizeId: 'full',
      responseKind: 'choice.single',
      evidencePath: `responses.${input.unitKey}.${moduleId}`,
      payload: {
        prompt: `${knowledgeText} 学习活动`,
        options: [{ value: 'a', label: `${knowledgeText}的正确判断` }, { value: 'b', label: `${knowledgeText}的错误判断` }],
      },
      roleMetadata: { studentVisible: true, teacherVisible: true, referenceAnswerVisibility: 'teacher-only' },
    } : {
      id: moduleId,
      canonicalClass: 'content.rich',
      slotId: 'main',
      sizeId: 'full',
      payload: { text: knowledgeText },
      roleMetadata: { studentVisible: true, teacherVisible: true, referenceAnswerVisibility: 'none' },
    };
    return {
      step: {
        id: `generated-step-${input.unitKey}${suffix}`,
        title: expectation.approvedTitle,
        durationSeconds: expectation.approvedDurationSeconds,
        layoutId: 'single',
        modules: [runtimeModule],
      },
      metadata: {
        moduleId,
        sourceState: input.sourceBinding ? 'verified' : 'ai_generated_source_pending',
        sourceBindings: input.sourceBinding ? [input.sourceBinding] : [],
        teacherFields: activity && index === 0 ? {
          referenceAnswer: 'a',
          explanation: '确定性测试答案。',
          scoring: { strategy: 'exact-match', maxPoints: 1 },
          ...(input.sourceBinding ? { inclusionRationale: '该权威来源直接支撑本阶段活动内容。' } : {}),
        } : input.sourceBinding
          ? { inclusionRationale: '该权威来源直接支撑本阶段教学内容。' }
          : {},
      },
    };
  });
  return coursewareGeneratedStageOutputSchema.parse({
    approvedPlanAlignment: deriveCoursewareApprovedPlanAlignment(approvedPlan, input.unitKey),
    stepPlanBindings: generatedSteps.map(({ step }, index) => ({
      generatedStepId: step.id,
      ...stepExpectations[index],
    })),
    stage: {
      stage: input.unitKey,
      durationSeconds: input.durationSeconds,
      steps: generatedSteps.map(({ step }) => step),
    },
    moduleMetadata: generatedSteps.map(({ metadata }) => metadata),
  });
}

export function deriveCoursewareApprovedPlanAlignment(
  plan: SmartLessonPlan,
  unitKey: CoursewareGenerationUnitKey,
) {
  const stageKey = COURSEWARE_PLAN_STAGE_KEYS[unitKey];
  const goalsById = [...plan.goals].sort((left, right) => (
    left.id < right.id ? -1 : left.id > right.id ? 1 : 0
  ));
  return {
    goalIds: plan.goals.map((goal) => goal.id),
    goalSetHash: contentHash(goalsById),
    stageContentHash: contentHash(plan.boppps[stageKey]),
    stageOutlineTitles: plan.coursewareStepOutline
      .filter((step) => step.bopppsStage === stageKey)
      .map((step) => step.title),
  };
}

export function deriveCoursewareApprovedStepExpectations(
  plan: SmartLessonPlan,
  unitKey: CoursewareGenerationUnitKey,
) {
  const stageKey = COURSEWARE_PLAN_STAGE_KEYS[unitKey];
  const outlineSteps = plan.coursewareStepOutline
    .map((step, approvedOutlineIndex) => ({ ...step, approvedOutlineIndex }))
    .filter((step) => step.bopppsStage === stageKey);
  const goalIds = plan.goals.map((goal) => goal.id);
  return outlineSteps.map((step, approvedStageStepIndex) => ({
    approvedStageStepIndex,
    approvedOutlineIndex: step.approvedOutlineIndex,
    approvedTitle: step.title,
    approvedDurationSeconds: step.minutes * 60,
    goalIds,
  }));
}

export function parsePersistedCoursewareStageOutput(input: {
  output: unknown;
  unitKey: CoursewareGenerationUnitKey;
  schemaVersion: string | null | undefined;
}) {
  if (input.schemaVersion === `smart-courseware-stage-${input.unitKey}.v1`) {
    return legacyCoursewareGeneratedStageOutputSchema.parse(input.output);
  }
  if (input.schemaVersion === `smart-courseware-stage-${input.unitKey}.v2`) {
    return coursewareGeneratedStageOutputSchema.parse(input.output);
  }
  throw new SmartCoursewareError('persisted-courseware-stage-schema-version-unsupported', 409);
}

function deterministicCoursewareRuntime(environment = process.env.NODE_ENV) {
  if (environment === 'production') throw new SmartCoursewareError('fixture-provider-forbidden', 500);
  return {
    serviceId: 'smart-courseware-fixture',
    providerKind: 'fixture',
    model: 'deterministic-smart-courseware-v1',
    async generate<T>(input: {
      schema: z.ZodType<T>;
      schemaVersion: string;
      system: string;
      prompt: string;
      idempotencyKey: string;
      fixtureOutput?: unknown;
    }) {
      const output = input.schema.parse(input.fixtureOutput);
      return {
        output,
        normalizedResponseId: `fixture:${contentHash({ schemaVersion: input.schemaVersion, output })}`,
        inputTokens: 0,
        outputTokens: 0,
        costMicros: null,
      };
    },
  };
}

function fixtureRequested() {
  return process.env.SMART_COURSEWARE_E2E_FIXTURE_TOKEN === 'smart-courseware-real-browser-v1';
}
