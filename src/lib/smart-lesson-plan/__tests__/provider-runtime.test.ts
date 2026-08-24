import { NoOutputGeneratedError } from 'ai';
import { describe, expect, it, vi } from 'vitest';

import {
  generateSmartLessonAdvisoryReport,
  normalizeSmartLessonProviderOutput,
  resolveSmartLessonStructuredProvider,
  TextJsonFallbackOutputError,
  validateSmartLessonProviderOutput,
} from '../provider-runtime';
import { AIProviderCapabilityUnavailableError, type AIProviderSettings } from '../../ai/provider-settings';
import { smartLessonAdvisoryReviewSchema, smartLessonPlanSchema } from '../schema';
import { validPlanFixture } from './fixtures';

const config = {
  provider: 'configured-provider',
  providerKind: 'openai-compatible' as const,
  baseURL: 'https://provider.example/v1',
  apiKey: 'server-secret',
  authMode: 'bearer-api-key' as const,
  secretRef: 'env:SERVER_KEY',
  model: 'structured-model-v1',
  enabled: true,
  priority: 1,
  health: 'healthy' as const,
  capabilities: { tools: true, reasoning: false, vision: false, jsonSchema: true, streaming: false, citationNormalization: false },
};

function providerSettings(
  models: AIProviderSettings['providers'][number]['models'],
  selectedModel = 'deepseek-ai/DeepSeek-V4-Flash',
): AIProviderSettings {
  return {
    activeProvider: 'configured-provider',
    providers: [{
      id: 'configured-provider',
      name: 'Configured Provider',
      providerKind: 'openai-compatible',
      baseURL: 'https://provider.example/v1',
      authMode: 'bearer-api-key',
      secretRef: 'env:SERVER_KEY',
      selectedModel,
      models,
      enabled: true,
      priority: 1,
      health: 'healthy',
      capabilities: config.capabilities,
    }],
  };
}

function representativePlanFixture() {
  const plan = smartLessonPlanSchema.parse(validPlanFixture());
  const sourceBinding = {
    ...plan.sources[0],
    sourceKind: 'textbook' as const,
    title: '自动控制原理教材：闭环稳定性',
    structuralPath: ['第三章 线性系统稳定性', '3.2 闭环稳定判据'],
    snippet: `审核不需要重复传输的来源摘录：${'稳定性判据说明。'.repeat(80)}`,
    href: 'https://course-basis.example/private/stability',
  };
  plan.sources = [sourceBinding];
  plan.goals[0] = {
    ...plan.goals[0],
    sourceState: 'VERIFIED',
    sourceBindings: [sourceBinding],
    gapIdentity: null,
    standardsMappings: [{ standardId: 'standard-1', label: '能够判断闭环系统稳定性' }],
  };
  plan.knowledgePoints[0] = {
    ...plan.knowledgePoints[0],
    sourceBindings: [sourceBinding],
  };
  for (const stage of Object.values(plan.boppps)) {
    for (const step of stage.steps) step.sourceBindings = [sourceBinding];
  }
  plan.classAdaptation = {
    aggregateContextRef: 'aggregate-context-private-ref',
    emphasis: ['加强临界稳定条件辨析'],
  };
  return plan;
}

function collectStrings(value: unknown): string[] {
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.flatMap(collectStrings);
  if (value && typeof value === 'object') return Object.values(value).flatMap(collectStrings);
  return [];
}

describe('smart lesson structured provider runtime', () => {
  it('deterministically normalizes harmless whitespace and numeric minute strings before validation', () => {
    const schema = smartLessonAdvisoryReviewSchema.pick({ goalCoverage: true, suggestions: true });
    const normalized = normalizeSmartLessonProviderOutput({
      goalCoverage: '  完整\r\n ',
      suggestions: ['  保留教师判断  '],
      minutes: '5',
    }) as Record<string, unknown>;
    expect(normalized).toEqual({
      goalCoverage: '完整',
      suggestions: ['保留教师判断'],
      minutes: 5,
    });
    expect(validateSmartLessonProviderOutput(schema, 'review.v1', {
      goalCoverage: ' 完整 ',
      suggestions: [' 建议 '],
    })).toMatchObject({
      success: true,
      output: { goalCoverage: '完整', suggestions: ['建议'] },
      receipt: { valid: true, schemaVersion: 'review.v1', issues: [] },
    });
  });

  it('returns a bounded validation receipt instead of throwing away an invalid structured candidate', () => {
    const result = validateSmartLessonProviderOutput(
      smartLessonAdvisoryReviewSchema,
      'review.v1',
      { goalCoverage: '' },
    );
    expect(result).toMatchObject({
      success: false,
      receipt: {
        valid: false,
        schemaVersion: 'review.v1',
        issues: expect.arrayContaining([expect.objectContaining({ path: expect.any(Array), message: expect.any(String) })]),
      },
    });
  });

  it('selects the configured JSON-schema provider and generates server-owned audit metadata', async () => {
    const resolveConfig = vi.fn(async (_provider, _model, requirements) => {
      expect(requirements).toEqual({ jsonSchema: true });
      return config;
    });
    const generate = vi.fn(async (input) => {
      expect(input).toMatchObject({ headers: { 'Idempotency-Key': 'stage-attempt-1' }, maxRetries: 0 });
      return {
        object: { goalCoverage: '完整', sourceConsistency: '一致', bopppsStructure: '完整', findings: [], suggestions: [] },
        usage: { inputTokens: 12, outputTokens: 8 },
        response: { id: 'provider-response-1' },
      };
    });
    const runtime = await resolveSmartLessonStructuredProvider({ resolveConfig: resolveConfig as never, generate });
    const result = await runtime.generate({
      schema: smartLessonAdvisoryReviewSchema,
      schemaVersion: 'review.v1',
      promptVersion: 'prompt.v1',
      system: 'system',
      prompt: 'prompt',
      idempotencyKey: 'stage-attempt-1',
    });
    expect(result.audit).toEqual({
      serviceId: 'configured-provider',
      providerKind: 'openai-compatible',
      model: 'structured-model-v1',
      promptVersion: 'prompt.v1',
      schemaVersion: 'review.v1',
      normalizedResponseId: 'provider-response-1',
      inputTokens: 12,
      outputTokens: 8,
      costMicros: null,
    });
    expect(resolveConfig).toHaveBeenCalledTimes(1);
    expect(resolveConfig).toHaveBeenCalledWith(undefined, undefined, { jsonSchema: true });
  });

  it('retries an empty structured stream once as a text-only JSON response when requested', async () => {
    const generateText = vi.fn()
      .mockRejectedValueOnce(new NoOutputGeneratedError())
      .mockResolvedValueOnce({
        text: '```json\n{"goalCoverage":"完整","sourceConsistency":"一致","bopppsStructure":"完整","findings":[],"suggestions":[]}\n```',
        usage: { inputTokens: 12, outputTokens: 8 },
        response: { id: 'provider-response-fallback' },
      });
    const runtime = await resolveSmartLessonStructuredProvider({
      resolveConfig: vi.fn(async () => config) as never,
      generateText: generateText as never,
    });

    const result = await runtime.generate({
      schema: smartLessonAdvisoryReviewSchema,
      schemaVersion: 'review.v1',
      promptVersion: 'prompt.v1',
      system: 'system',
      prompt: 'prompt',
      idempotencyKey: 'stage-empty-output-1',
      fallbackToTextJson: true,
    });

    expect(result.output).toMatchObject({ goalCoverage: '完整', suggestions: [] });
    expect(result.normalizedResponseId).toBe('provider-response-fallback');
    expect(generateText).toHaveBeenCalledTimes(2);
    expect(generateText.mock.calls[0]?.[0]).toHaveProperty('output');
    expect(generateText.mock.calls[1]?.[0]).not.toHaveProperty('output');
    expect(generateText.mock.calls[1]?.[0]).toMatchObject({
      headers: { 'Idempotency-Key': expect.not.stringContaining('stage-empty-output-1') },
    });
    expect(result.usedTextJsonFallback).toBe(true);
  });

  it('marks an unparsable text fallback as an empty-output recovery failure', async () => {
    const generateText = vi.fn()
      .mockRejectedValueOnce(new NoOutputGeneratedError())
      .mockResolvedValueOnce({
        text: 'not valid JSON',
        usage: { inputTokens: 12, outputTokens: 8 },
        response: { id: 'provider-response-invalid-fallback' },
      });
    const runtime = await resolveSmartLessonStructuredProvider({
      resolveConfig: vi.fn(async () => config) as never,
      generateText: generateText as never,
    });

    await expect(runtime.generate({
      schema: smartLessonAdvisoryReviewSchema,
      schemaVersion: 'review.v1',
      promptVersion: 'prompt.v1',
      system: 'system',
      prompt: 'prompt',
      idempotencyKey: 'stage-invalid-fallback-1',
      fallbackToTextJson: true,
    })).rejects.toBeInstanceOf(TextJsonFallbackOutputError);
    expect(generateText).toHaveBeenCalledTimes(2);
  });

  it('keeps the complete plan while applying the advisory-only timeout and narrow response budget', async () => {
    const plan = representativePlanFixture();
    const generate = vi.fn(async (input) => {
      expect(input).toMatchObject({
        maxOutputTokens: 1_600,
        timeout: 25,
        headers: { 'Idempotency-Key': 'review-1' },
      });
      expect(input.system).toContain('目标覆盖、来源一致性、BOPPPS 结构、内容质量四类事项');
      expect(input.system).toContain('sourceCatalog 和 sourceCitationIds 仅供来源审核，不得作为 path');
      expect(input.abortSignal).toBeInstanceOf(AbortSignal);
      const projection = JSON.parse(input.prompt.slice(input.prompt.indexOf('\n') + 1)) as Record<string, any>;
      const projectionJson = JSON.stringify(projection);
      const teachingTexts = [
        plan.course,
        plan.topic,
        plan.audience,
        plan.prerequisites,
        ...plan.goals.flatMap((goal) => [
          goal.content,
          ...goal.standardsMappings.map((mapping) => mapping.label),
        ]),
        ...plan.knowledgePoints.map((point) => point.title),
        ...plan.keyContent,
        ...plan.difficultContent,
        ...plan.limitations,
        ...(plan.classAdaptation?.emphasis ?? []),
        ...plan.coursewareStepOutline.map((step) => step.title),
        ...Object.values(plan.boppps).flatMap((stage) => [
          stage.teacherActivity,
          stage.studentActivity,
          stage.assessment,
          ...stage.steps.flatMap((step) => [
            step.title,
            step.teacherActivity,
            step.studentActivity,
            step.assessment,
          ]),
        ]),
      ];
      expect(collectStrings(projection)).toEqual(expect.arrayContaining(teachingTexts));
      expect(projection.sourceCatalog).toEqual([{
        citationId: plan.sources[0].citationId,
        anchor: plan.sources[0].anchor,
        sourceKind: 'textbook',
        title: plan.sources[0].title,
        structuralPath: plan.sources[0].structuralPath,
      }]);
      expect(projection.goals[0].sourceCitationIds).toEqual([plan.sources[0].citationId]);
      expect(projection.knowledgePoints[0].sourceCitationIds).toEqual([plan.sources[0].citationId]);
      expect(projection.boppps.bridgeIn.steps[0].sourceCitationIds).toEqual([plan.sources[0].citationId]);
      for (const excludedField of [
        'contentHash',
        'sourceVersionId',
        'href',
        'snippet',
        'aggregateContextRef',
        'gapIdentity',
        'sourceBindings',
      ]) {
        expect(projectionJson).not.toContain(`"${excludedField}"`);
      }
      expect(projectionJson.length).toBeLessThanOrEqual(JSON.stringify(plan).length * 0.65);
      const bounded = {
        goalCoverage: '完整',
        sourceConsistency: '一致',
        bopppsStructure: '完整',
        findings: [],
        suggestions: [],
      };
      expect(input.schema.safeParse({ ...bounded, goalCoverage: '过'.repeat(801) }).success).toBe(false);
      expect(input.schema.safeParse({
        ...bounded,
        findings: [{
          category: 'CONTENT_QUALITY',
          severity: 'SUGGESTION',
          message: '长'.repeat(501),
          path: null,
        }],
      }).success).toBe(false);
      expect(input.schema.safeParse({
        ...bounded,
        findings: [{
          category: 'CONTENT_QUALITY',
          severity: 'SUGGESTION',
          message: '建议',
          path: '/topic',
          proposedReplacement: '长'.repeat(2_001),
        }],
      }).success).toBe(false);
      expect(input.schema.safeParse({ ...bounded, suggestions: Array(7).fill('建议') }).success).toBe(false);
      return {
        object: {
          goalCoverage: '目标覆盖完整',
          sourceConsistency: '来源一致',
          bopppsStructure: '结构完整',
          findings: [],
          suggestions: ['保留教师判断'],
        },
        response: { id: 'review-response-1' },
      };
    });

    const result = await generateSmartLessonAdvisoryReport(
      { plan, idempotencyKey: 'review-1' },
      { resolveConfig: vi.fn(async () => config) as never, generate, advisoryTimeoutMs: 25 },
    );

    expect(result.output).toMatchObject({ goalCoverage: '目标覆盖完整', suggestions: ['保留教师判断'] });
  });

  it('classifies an advisory response outside the narrow schema as schema-invalid', async () => {
    const generate = vi.fn(async () => ({
      object: {
        goalCoverage: '完整',
        sourceConsistency: '一致',
        bopppsStructure: '完整',
        findings: Array.from({ length: 9 }, () => ({
          category: 'CONTENT_QUALITY',
          severity: 'SUGGESTION',
          message: '建议',
          path: null,
        })),
        suggestions: [],
      },
    }));

    await expect(generateSmartLessonAdvisoryReport(
      { plan: validPlanFixture(), idempotencyKey: 'review-invalid' },
      { resolveConfig: vi.fn(async () => config) as never, generate, advisoryTimeoutMs: 25 },
    )).rejects.toMatchObject({
      code: 'advisory-provider-schema-invalid',
      status: 503,
    });
  });

  it('prefers a configured non-thinking model for the shared structured runtime and audits the actual model', async () => {
    const settings = providerSettings([
      { id: 'deepseek', label: 'DeepSeek', model: 'deepseek-ai/DeepSeek-V4-Flash' },
      { id: 'qwen', label: 'Qwen', model: 'Qwen/Qwen3.6-35B-A3B', options: { enableThinking: false } },
    ]);
    const resolveConfig = vi.fn(async (_providerId, modelId) => ({
      ...config,
      model: modelId ?? settings.providers[0].selectedModel,
    }));
    const generate = vi.fn(async () => ({
      object: {
        goalCoverage: '完整',
        sourceConsistency: '一致',
        bopppsStructure: '完整',
        findings: [],
        suggestions: [],
      },
    }));

    const runtime = await resolveSmartLessonStructuredProvider({
      resolveConfig: resolveConfig as never,
      getSettings: vi.fn(async () => settings),
      generate,
    });
    const result = await runtime.generate({
      schema: smartLessonAdvisoryReviewSchema,
      schemaVersion: 'smart-lesson-outline.v1',
      promptVersion: 'smart-lesson-plan.v1',
      system: 'system',
      prompt: 'prompt',
      idempotencyKey: 'stage-attempt-non-thinking',
    });

    expect(runtime.model).toBe('Qwen/Qwen3.6-35B-A3B');
    expect(resolveConfig).toHaveBeenNthCalledWith(
      2,
      'configured-provider',
      'Qwen/Qwen3.6-35B-A3B',
      { jsonSchema: true },
      settings,
    );
    expect(result.audit.model).toBe('Qwen/Qwen3.6-35B-A3B');
  });

  it('keeps the selected model when the shared structured runtime has no non-thinking candidate', async () => {
    const settings = providerSettings([
      { id: 'deepseek', label: 'DeepSeek', model: 'deepseek-ai/DeepSeek-V4-Flash' },
      { id: 'reasoning', label: 'Reasoning', model: 'vendor/reasoning', options: { enableThinking: true } },
    ]);
    const resolveConfig = vi.fn(async (_providerId, modelId) => ({
      ...config,
      model: modelId ?? settings.providers[0].selectedModel,
    }));
    const generate = vi.fn(async () => ({
      object: {
        goalCoverage: '完整',
        sourceConsistency: '一致',
        bopppsStructure: '完整',
        findings: [],
        suggestions: [],
      },
    }));

    const runtime = await resolveSmartLessonStructuredProvider({
      resolveConfig: resolveConfig as never,
      getSettings: vi.fn(async () => settings),
      generate,
    });
    const result = await runtime.generate({
      schema: smartLessonAdvisoryReviewSchema,
      schemaVersion: 'smart-lesson-outline.v1',
      promptVersion: 'smart-lesson-plan.v1',
      system: 'system',
      prompt: 'prompt',
      idempotencyKey: 'stage-attempt-selected-model',
    });

    expect(resolveConfig).toHaveBeenCalledTimes(1);
    expect(resolveConfig).toHaveBeenCalledWith(
      undefined,
      undefined,
      { jsonSchema: true },
      settings,
    );
    expect(runtime.model).toBe('deepseek-ai/DeepSeek-V4-Flash');
    expect(result.audit.model).toBe('deepseek-ai/DeepSeek-V4-Flash');
  });

  it('classifies a hanging advisory provider as timeout and aborts its signal', async () => {
    let signal: AbortSignal | undefined;
    const generate = vi.fn((input: Record<string, unknown>) => {
      signal = input.abortSignal as AbortSignal;
      return new Promise<never>(() => undefined);
    });

    await expect(generateSmartLessonAdvisoryReport(
      { plan: validPlanFixture(), idempotencyKey: 'review-timeout' },
      { resolveConfig: vi.fn(async () => config) as never, generate, advisoryTimeoutMs: 5 },
    )).rejects.toMatchObject({
      code: 'advisory-provider-timeout',
      status: 503,
    });
    expect(signal?.aborted).toBe(true);
  });

  it('classifies a non-timeout advisory provider error as upstream-failed', async () => {
    const generate = vi.fn(async () => {
      throw new Error('provider unavailable');
    });

    await expect(generateSmartLessonAdvisoryReport(
      { plan: validPlanFixture(), idempotencyKey: 'review-upstream' },
      { resolveConfig: vi.fn(async () => config) as never, generate, advisoryTimeoutMs: 25 },
    )).rejects.toMatchObject({
      code: 'advisory-provider-upstream-failed',
      status: 503,
    });
  });

  it('preserves structured-provider-unavailable for advisory provider selection failures', async () => {
    const settings = providerSettings([
      { id: 'deepseek', label: 'DeepSeek', model: 'deepseek-ai/DeepSeek-V4-Flash' },
    ]);
    await expect(generateSmartLessonAdvisoryReport(
      { plan: validPlanFixture(), idempotencyKey: 'review-unavailable' },
      {
        resolveConfig: vi.fn(async () => {
          throw new AIProviderCapabilityUnavailableError('No configured provider is available.');
        }) as never,
        getSettings: vi.fn(async () => settings),
        advisoryTimeoutMs: 25,
      },
    )).rejects.toMatchObject({
      code: 'structured-provider-unavailable',
      status: 503,
    });
  });
});
