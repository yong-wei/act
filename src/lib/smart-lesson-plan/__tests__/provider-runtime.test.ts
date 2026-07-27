import { describe, expect, it, vi } from 'vitest';

import {
  generateSmartLessonAdvisoryReport,
  normalizeSmartLessonProviderOutput,
  resolveSmartLessonStructuredProvider,
  validateSmartLessonProviderOutput,
} from '../provider-runtime';
import { smartLessonAdvisoryReviewSchema } from '../schema';

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
  });

  it('keeps the complete plan while applying the advisory-only timeout and narrow response budget', async () => {
    const plan = { topic: '稳定性', nested: { retained: '完整教案内容' } };
    const generate = vi.fn(async (input) => {
      expect(input).toMatchObject({
        maxOutputTokens: 1_600,
        timeout: 25,
        headers: { 'Idempotency-Key': 'review-1' },
      });
      expect(input.prompt).toContain(JSON.stringify(plan));
      expect(input.system).toContain('目标覆盖、来源一致性、BOPPPS 结构、内容质量四类事项');
      expect(input.abortSignal).toBeInstanceOf(AbortSignal);
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
      { plan: { topic: '稳定性' }, idempotencyKey: 'review-invalid' },
      { resolveConfig: vi.fn(async () => config) as never, generate, advisoryTimeoutMs: 25 },
    )).rejects.toMatchObject({
      code: 'advisory-provider-schema-invalid',
      status: 503,
    });
  });

  it('classifies a hanging advisory provider as timeout and aborts its signal', async () => {
    let signal: AbortSignal | undefined;
    const generate = vi.fn((input: Record<string, unknown>) => {
      signal = input.abortSignal as AbortSignal;
      return new Promise<never>(() => undefined);
    });

    await expect(generateSmartLessonAdvisoryReport(
      { plan: { topic: '稳定性' }, idempotencyKey: 'review-timeout' },
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
      { plan: { topic: '稳定性' }, idempotencyKey: 'review-upstream' },
      { resolveConfig: vi.fn(async () => config) as never, generate, advisoryTimeoutMs: 25 },
    )).rejects.toMatchObject({
      code: 'advisory-provider-upstream-failed',
      status: 503,
    });
  });

  it('preserves structured-provider-unavailable for advisory provider selection failures', async () => {
    await expect(generateSmartLessonAdvisoryReport(
      { plan: { topic: '稳定性' }, idempotencyKey: 'review-unavailable' },
      {
        resolveConfig: vi.fn(async () => ({ ...config, enabled: false })) as never,
        advisoryTimeoutMs: 25,
      },
    )).rejects.toMatchObject({
      code: 'structured-provider-unavailable',
      status: 503,
    });
  });
});
