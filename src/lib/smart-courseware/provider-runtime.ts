import { generateObject } from 'ai';
import type { z } from 'zod';

import { createAIProviderFromConfig } from '@/lib/ai/provider-registry';
import { AIProviderCapabilityUnavailableError, resolveConfiguredAIProviderConfig } from '@/lib/ai/provider-settings';
import { contentHash } from '@/lib/smart-lesson-plan/domain';
import type { SmartLessonSourceBinding } from '@/lib/smart-lesson-plan/domain';

import { SmartCoursewareError } from './domain';
import type { CoursewareGenerationUnitKey } from './generation-service';
import { coursewareGeneratedStageOutputSchema } from './schema';

export const SMART_COURSEWARE_PROMPT_VERSION = 'smart-courseware-generation.v1';

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
  sourceBinding?: SmartLessonSourceBinding;
}) {
  const moduleId = `generated-${input.unitKey}`;
  const activity = ['pre-assessment', 'participatory-learning', 'post-assessment'].includes(input.unitKey);
  const runtimeModule = activity ? {
    id: moduleId,
    canonicalClass: 'activity.panel',
    slotId: 'main',
    sizeId: 'full',
    responseKind: 'choice.single',
    evidencePath: `responses.${input.unitKey}.${moduleId}`,
    payload: {
      prompt: `${input.unitKey} 学习活动`,
      options: [{ value: 'a', label: '选项 A' }, { value: 'b', label: '选项 B' }],
    },
    roleMetadata: { studentVisible: true, teacherVisible: true, referenceAnswerVisibility: 'teacher-only' },
  } : {
    id: moduleId,
    canonicalClass: 'content.rich',
    slotId: 'main',
    sizeId: 'full',
    payload: { text: `${input.unitKey} 教学内容` },
    roleMetadata: { studentVisible: true, teacherVisible: true, referenceAnswerVisibility: 'none' },
  };
  return coursewareGeneratedStageOutputSchema.parse({
    stage: {
      stage: input.unitKey,
      durationSeconds: input.durationSeconds,
      steps: [{
        id: `generated-step-${input.unitKey}`,
        title: `${input.unitKey} 教学步骤`,
        durationSeconds: input.durationSeconds,
        layoutId: 'single',
        modules: [runtimeModule],
      }],
    },
    moduleMetadata: [{
      moduleId,
      sourceState: input.sourceBinding ? 'verified' : 'ai_generated_source_pending',
      sourceBindings: input.sourceBinding ? [input.sourceBinding] : [],
      teacherFields: activity ? {
        referenceAnswer: 'a',
        explanation: '确定性测试答案。',
        scoring: { strategy: 'exact-match', maxPoints: 1 },
        ...(input.sourceBinding ? { inclusionRationale: '该权威来源直接支撑本阶段活动内容。' } : {}),
      } : input.sourceBinding
        ? { inclusionRationale: '该权威来源直接支撑本阶段教学内容。' }
        : {},
    }],
  });
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
