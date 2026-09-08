import { describe, expect, it, vi } from 'vitest';

import { sha256, type ExternalProcessingPolicy } from '../math-document-grading-contracts';
import { describeVisualEvidence } from '../visual-evidence-description';

function policy(overrides: Partial<ExternalProcessingPolicy> = {}): ExternalProcessingPolicy {
  return {
    provider: 'ai-evaluator',
    version: 'visual.v1',
    model: 'vision-model.v1',
    endpoint: 'https://provider.example/v1',
    purpose: 'visual-description',
    dataCategories: ['student-answer', 'student-answer-visual'],
    minimizedScope: ['selected-question', 'answer-evidence', 'visual-evidence'],
    institutionScope: null,
    classScope: ['class-1'],
    processingRegion: 'CN',
    agreementVersion: 'agreement.v1',
    noTraining: true,
    providerRetentionSeconds: 0,
    deletionCapability: true,
    rateLimitPerMinute: 10,
    enabled: true,
    disabledAt: null,
    credentialRef: 'env:AI_PROVIDER_KEY',
    ...overrides,
  };
}

describe('visual evidence description', () => {
  it('accepts a structured question-bound visual description with audit locators', async () => {
    const bytes = new Uint8Array([137, 80, 78, 71]);
    const evaluate = vi.fn(async () => ({
      output: { description: 'The diagram shows a stable response approaching a bounded value.', confidence: 0.91, pageNumber: 2, bbox: [0, 0, 100, 80], limitations: [] },
      provider: 'vision-provider',
      providerRequestId: 'request-1',
      deletionHandle: 'delete-1',
      providerRequestedAt: new Date('2026-08-17T00:00:00.000Z'),
      providerProcessedAt: new Date('2026-08-17T00:00:01.000Z'),
    }));

    const result = await describeVisualEvidence({
      attachment: { kind: 'image', mediaType: 'image/png', data: bytes, checksum: sha256(bytes), questionId: 'question-1' },
      questionId: 'question-1',
      pageNumber: 2,
      classId: 'class-1',
      policy: policy(),
      provider: { id: 'vision-provider', provider: 'ai-evaluator', version: 'vision-model.v1', capabilities: { vision: true }, evaluate },
      idempotencyKey: 'visual-description-1',
    });

    expect(result).toEqual(expect.objectContaining({ provider: 'vision-provider', model: 'vision-model.v1', policyVersion: 'visual.v1', confidence: 0.91, deletionHandle: 'delete-1' }));
    expect(evaluate).toHaveBeenCalledWith(expect.objectContaining({
      attachments: [expect.objectContaining({ kind: 'image', questionId: 'question-1' })],
      system: expect.stringMatching(/必须始终输出 description、confidence、pageNumber、bbox、limitations 五个字段[\s\S]*图像可完整识别时必须返回空数组/),
    }));
  });

  it('fails closed when visual policy scope or page binding is invalid', async () => {
    const bytes = new Uint8Array([137, 80, 78, 71]);
    const provider = { id: 'vision-provider', provider: 'ai-evaluator', version: 'vision-model.v1', capabilities: { vision: true }, evaluate: vi.fn(async () => ({ description: 'The diagram shows a stable response approaching a bounded value.', confidence: 0.91, pageNumber: 3, limitations: [] })) };

    await expect(describeVisualEvidence({
      attachment: { kind: 'image', mediaType: 'image/png', data: bytes, checksum: sha256(bytes), questionId: 'question-1' },
      questionId: 'question-1', pageNumber: 2, classId: 'class-1', policy: policy({ minimizedScope: ['selected-question', 'answer-evidence'] }), provider, idempotencyKey: 'visual-description-2',
    })).rejects.toThrow('provider-policy-blocked:visual-evidence-scope-missing');
    expect(provider.evaluate).not.toHaveBeenCalled();
  });

  it('rejects a provider JSON object that violates the visual description schema', async () => {
    const bytes = new Uint8Array([137, 80, 78, 71]);
    const provider = {
      id: 'vision-provider',
      provider: 'ai-evaluator',
      version: 'vision-model.v1',
      capabilities: { vision: true },
      evaluate: vi.fn(async () => ({
        provider: 'vision-provider',
        output: {
          description: 'The diagram shows a stable response approaching a bounded value.',
          confidence: 0.91,
          pageNumber: 2,
          limitations: [],
          unexpected: true,
        },
      })),
    };

    await expect(describeVisualEvidence({
      attachment: { kind: 'image', mediaType: 'image/png', data: bytes, checksum: sha256(bytes), questionId: 'question-1' },
      questionId: 'question-1', pageNumber: 2, classId: 'class-1', policy: policy(), provider, idempotencyKey: 'visual-description-schema-rejection',
    })).rejects.toThrow('visual-description-output-invalid-shape');
  });

  it('fails closed when a provider omits limitations from an otherwise complete visual description', async () => {
    const bytes = new Uint8Array([137, 80, 78, 71]);
    const provider = {
      id: 'vision-provider',
      provider: 'ai-evaluator',
      version: 'vision-model.v1',
      capabilities: { vision: true },
      evaluate: vi.fn(async () => ({
        provider: 'vision-provider',
        output: {
          description: 'The diagram shows a stable response approaching a bounded value.',
          confidence: 0.91,
          pageNumber: 2,
          bbox: [0, 0, 100, 80],
        },
      })),
    };

    await expect(describeVisualEvidence({
      attachment: { kind: 'image', mediaType: 'image/png', data: bytes, checksum: sha256(bytes), questionId: 'question-1' },
      questionId: 'question-1', pageNumber: 2, classId: 'class-1', policy: policy(), provider, idempotencyKey: 'visual-description-limitations-required',
    })).rejects.toThrow('visual-description-output-invalid-limitations');
  });

  it('does not let an injected runtime bypass provider identity or vision capability checks', async () => {
    const bytes = new Uint8Array([137, 80, 78, 71]);
    const input = {
      attachment: { kind: 'image' as const, mediaType: 'image/png', data: bytes, checksum: sha256(bytes), questionId: 'question-1' },
      questionId: 'question-1', pageNumber: 1, classId: 'class-1', policy: policy(), idempotencyKey: 'visual-description-3',
    };

    await expect(describeVisualEvidence({
      ...input,
      provider: { id: 'other-provider', provider: 'other-provider', version: 'vision-model.v1', capabilities: { vision: true }, evaluate: vi.fn() },
    // dda125c0 起身份校验统一走 policy gate：provider-policy-blocked:provider-mismatch。
    })).rejects.toThrow('provider-policy-blocked:provider-mismatch');
    await expect(describeVisualEvidence({
      ...input,
      provider: { id: 'vision-provider', provider: 'ai-evaluator', version: 'vision-model.v1', evaluate: vi.fn() },
    })).rejects.toThrow('provider-vision-not-enabled');
  });
});
