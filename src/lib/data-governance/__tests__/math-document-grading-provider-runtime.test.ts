import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  resolve: vi.fn(),
  create: vi.fn(),
  generateText: vi.fn(),
}));

vi.mock('@/lib/ai/provider-settings', () => ({ resolveConfiguredAIProviderConfig: mocks.resolve }));
vi.mock('@/lib/ai/provider-registry', () => ({ createAIProviderFromConfig: mocks.create }));
vi.mock('ai', () => ({ generateText: mocks.generateText }));

import {
  createProviderRuntimeGradingAdapter,
  evaluateWithProvider,
} from '../math-document-grading-evaluator';
import type { ExternalProcessingPolicy, FrozenQuestionContract } from '../math-document-grading-contracts';
import { normalizeTextAnswerEvidence } from '../math-document-grading-contracts';

function policy(overrides: Partial<ExternalProcessingPolicy> = {}): ExternalProcessingPolicy {
  return {
    provider: 'configured-openai',
    version: 'policy.v1',
    model: 'model.v1',
    endpoint: 'https://provider.example/v1',
    purpose: 'rubric-grading',
    dataCategories: ['student-answer'],
    minimizedScope: ['selected-question', 'answer-evidence'],
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
    credentialRef: 'env:CONFIGURED_OPENAI_KEY',
    ...overrides,
  };
}

function question(): FrozenQuestionContract {
  return {
    assignmentRevisionId: 'revision-1',
    questionId: 'question-1',
    stableQuestionId: 'q1',
    responseType: 'SUBJECTIVE_TEXT',
    prompt: 'Explain the evidence.',
    referenceAnswer: 'Cite the evidence.',
    contentHash: 'sha256:question',
    rubric: { schemaVersion: 'rubric.v1', id: 'rubric-1', version: 'rubric.v1', maxScore: 1, criteria: [{ id: 'criterion-1', label: 'Evidence', goalDimension: 'controlModeling', maxPoints: 1, evidenceDescription: 'evidence', feedbackGuidance: 'cite', levels: [{ id: 'full', label: 'Full', minPoints: 1, maxPoints: 1, description: 'full' }] }] },
  };
}

function validProviderOutput() {
  return {
    evaluatorId: 'fixture-provider',
    evaluatorVersion: 'fixture.v1',
    assessments: [{
      criterionId: 'criterion-1',
      levelId: 'full',
      score: 1,
      rationale: 'The answer cites the supplied evidence clearly.',
      confidence: 0.9,
      anchors: [{ blockId: 'text-block-1', precision: 'span' as const, excerpt: 'evidence', spanStart: 0, spanEnd: 8 }],
      limitationState: 'none',
      annotations: [],
    }],
    limitations: [],
    overallComment: 'The response is supported by the submitted evidence.',
  };
}

describe('provider-backed math grading runtime identity', () => {
  it('uses the persisted provider policy identity and rejects missing binding before provider initialization', async () => {
    mocks.resolve.mockResolvedValue({ provider: 'configured-openai', providerKind: 'openai-compatible', baseURL: 'https://provider.example/v1', apiKey: 'secret', authMode: 'bearer-api-key', secretRef: 'env:CONFIGURED_OPENAI_KEY', model: 'model.v1', enabled: true, priority: 1, health: 'healthy', capabilities: { tools: false, reasoning: false, vision: false, jsonSchema: true, streaming: false, citationNormalization: false } });
    mocks.create.mockReturnValue({ getModel: vi.fn() });
    const adapter = await createProviderRuntimeGradingAdapter({ policy: policy(), classId: 'class-1' });
    expect(adapter).toEqual(expect.objectContaining({ id: 'configured-openai', version: 'model.v1' }));

    const blocked = await evaluateWithProvider({ question: question(), evidence: normalizeTextAnswerEvidence('evidence'), classId: 'class-1', policy: policy({ model: null, endpoint: null }) });
    expect(blocked.state).toBe('blocked');
    expect(blocked.blockedReasons).toContain('provider-provider-policy-identity-missing');
  });

  it('records a retryable state for a transient configured-provider call failure', async () => {
    mocks.resolve.mockResolvedValue({ provider: 'configured-openai', providerKind: 'openai-compatible', baseURL: 'https://provider.example/v1', apiKey: 'secret', authMode: 'bearer-api-key', secretRef: 'env:CONFIGURED_OPENAI_KEY', model: 'model.v1', enabled: true, priority: 1, health: 'healthy', capabilities: { tools: false, reasoning: false, vision: false, jsonSchema: true, streaming: false, citationNormalization: false } });
    mocks.create.mockReturnValue({ getModel: vi.fn() });
    mocks.generateText.mockRejectedValueOnce(new Error('request timeout'));
    const result = await evaluateWithProvider({ question: question(), evidence: normalizeTextAnswerEvidence('evidence'), classId: 'class-1', policy: policy() });
    expect(result.state).toBe('retryable');
    expect(result.blockedReasons).toContain('provider-timeout');
  });

  it('freezes a real provider request locator without persisting a secret or payload', async () => {
    const result = await evaluateWithProvider({
      question: question(),
      evidence: normalizeTextAnswerEvidence('evidence'),
      classId: 'class-1',
      policy: policy({ provider: 'ai-evaluator', providerRetentionSeconds: 120 }),
      provider: {
        id: 'fixture-provider',
        version: 'fixture.v1',
        evaluate: async () => ({
          output: validProviderOutput(),
          provider: 'fixture-provider',
          providerRequestId: 'provider-request-916',
          deletionHandle: 'provider-delete-916',
        }),
      },
    });

    expect(result).toMatchObject({
      state: 'awaiting-review',
      provider: 'fixture-provider',
      providerRequestId: 'provider-request-916',
      deletionHandle: 'provider-delete-916',
    });
    expect(JSON.stringify(result)).not.toContain('secret');
    expect(JSON.stringify(result)).not.toContain('payload');
  });

  it('blocks immediately after a provider response when positive retention has no deletion locator', async () => {
    const result = await evaluateWithProvider({
      question: question(),
      evidence: normalizeTextAnswerEvidence('evidence'),
      classId: 'class-1',
      policy: policy({ provider: 'ai-evaluator', providerRetentionSeconds: 120 }),
      provider: {
        id: 'fixture-provider',
        version: 'fixture.v1',
        evaluate: async () => validProviderOutput(),
      },
    });

    expect(result.state).toBe('blocked');
    expect(result.blockedReasons).toContain('provider-deletion-locator-missing');
  });
});
