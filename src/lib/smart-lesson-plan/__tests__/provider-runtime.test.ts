import { describe, expect, it, vi } from 'vitest';

import {
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
});
