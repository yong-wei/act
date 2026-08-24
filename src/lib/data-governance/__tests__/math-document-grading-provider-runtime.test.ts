import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  resolve: vi.fn(),
  create: vi.fn(),
  generateText: vi.fn(),
  outputJson: vi.fn(() => ({ type: 'json' })),
}));

vi.mock('@/lib/ai/provider-settings', () => ({ resolveConfiguredAIProviderConfig: mocks.resolve }));
vi.mock('@/lib/ai/provider-registry', () => ({ createAIProviderFromConfig: mocks.create }));
vi.mock('ai', () => ({ generateText: mocks.generateText, Output: { json: mocks.outputJson } }));

import {
  createProviderRuntimeGradingAdapter,
  evaluateWithProvider,
} from '../math-document-grading-evaluator';
import type { ExternalProcessingPolicy, FrozenQuestionContract } from '../math-document-grading-contracts';
import { normalizeTextAnswerEvidence, sha256 } from '../math-document-grading-contracts';

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
    rubric: { schemaVersion: 'assignment-analytic-rubric.v1', id: 'rubric-1', version: 'rubric.v1', maxScore: 1, criteria: [{ id: 'criterion-1', label: 'Evidence', goalDimension: 'controlModeling', maxPoints: 1, evidenceDescription: 'evidence', feedbackGuidance: 'cite', levels: [{ id: 'full', label: 'Full', minPoints: 1, maxPoints: 1, description: 'full' }] }] },
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
    const attempts: Array<{ status: string; error?: unknown }> = [];
    const result = await evaluateWithProvider({
      question: question(), evidence: normalizeTextAnswerEvidence('evidence'), classId: 'class-1', policy: policy(),
      onProviderAttempt: (attempt) => { attempts.push(attempt); },
    });
    expect(result.state).toBe('retryable');
    expect(result.blockedReasons).toContain('provider-timeout');
    expect(attempts).toEqual([expect.objectContaining({ status: 'failed', error: expect.any(Error) })]);
  });

  it('bounds a configured-provider request and preserves it as a retryable timeout', async () => {
    vi.useFakeTimers();
    mocks.resolve.mockResolvedValue({ provider: 'configured-openai', providerKind: 'openai-compatible', baseURL: 'https://provider.example/v1', apiKey: 'secret', authMode: 'bearer-api-key', secretRef: 'env:CONFIGURED_OPENAI_KEY', model: 'model.v1', enabled: true, priority: 1, health: 'healthy', capabilities: { tools: false, reasoning: false, vision: false, jsonSchema: true, streaming: false, citationNormalization: false } });
    mocks.create.mockReturnValue({ getModel: vi.fn() });
    mocks.generateText.mockImplementationOnce(({ abortSignal }) => new Promise((_resolve, reject) => {
      abortSignal.addEventListener('abort', () => reject(abortSignal.reason), { once: true });
    }));

    const pending = evaluateWithProvider({ question: question(), evidence: normalizeTextAnswerEvidence('evidence'), classId: 'class-1', policy: policy() });
    await vi.advanceTimersByTimeAsync(60_000);

    await expect(pending).resolves.toMatchObject({
      state: 'retryable',
      blockedReasons: ['provider-timeout'],
    });
    vi.useRealTimers();
  });

  it('retries an exhausted transient SiliconFlow DeepSeek request', async () => {
    mocks.resolve.mockResolvedValue({ provider: 'configured-openai', providerKind: 'openai-compatible', baseURL: 'https://provider.example/v1', apiKey: 'secret', authMode: 'bearer-api-key', secretRef: 'env:CONFIGURED_OPENAI_KEY', model: 'model.v1', enabled: true, priority: 1, health: 'healthy', capabilities: { tools: false, reasoning: false, vision: false, jsonSchema: true, streaming: false, citationNormalization: false } });
    mocks.create.mockReturnValue({ getModel: vi.fn() });
    mocks.generateText.mockRejectedValueOnce(new Error('SiliconFlow DeepSeek request failed after retries (Error).'));

    const result = await evaluateWithProvider({ question: question(), evidence: normalizeTextAnswerEvidence('evidence'), classId: 'class-1', policy: policy() });

    expect(result.state).toBe('retryable');
  });

  it('retries a provider response that generated no output', async () => {
    const result = await evaluateWithProvider({
      question: question(), evidence: normalizeTextAnswerEvidence('evidence'), classId: 'class-1', policy: policy({ provider: 'ai-evaluator' }),
      provider: {
        id: 'fixture-provider', version: 'fixture.v1',
        evaluate: async () => { throw new Error('no-output-generated'); },
      },
    });

    expect(result.state).toBe('retryable');
    expect(result.blockedReasons).toContain('provider-no-output-generated');
  });

  it('retries an SDK error that generated no structured object', async () => {
    const result = await evaluateWithProvider({
      question: question(), evidence: normalizeTextAnswerEvidence('evidence'), classId: 'class-1', policy: policy({ provider: 'ai-evaluator' }),
      provider: {
        id: 'fixture-provider', version: 'fixture.v1',
        evaluate: async () => { throw new Error('No object generated: response was empty.'); },
      },
    });

    expect(result.state).toBe('retryable');
    expect(result.blockedReasons).toContain('provider-no-object-generated');
  });

  it('retries a provider error whose retryable cause was preserved through a wrapper', async () => {
    const result = await evaluateWithProvider({
      question: question(), evidence: normalizeTextAnswerEvidence('evidence'), classId: 'class-1', policy: policy({ provider: 'ai-evaluator' }),
      provider: {
        id: 'fixture-provider', version: 'fixture.v1',
        evaluate: async () => { throw Object.assign(new Error('provider-error'), { cause: Object.assign(new Error('transport unavailable'), { retryable: true }) }); },
      },
    });

    expect(result.state).toBe('retryable');
  });

  it('classifies structured transient HTTP status as retryable without exposing response data', async () => {
    const result = await evaluateWithProvider({
      question: question(), evidence: normalizeTextAnswerEvidence('evidence'), classId: 'class-1', policy: policy({ provider: 'ai-evaluator' }),
      provider: {
        id: 'fixture-provider', version: 'fixture.v1',
        evaluate: async () => { throw Object.assign(new Error('request failed'), { statusCode: 503, responseBody: 'secret payload' }); },
      },
    });

    expect(result.state).toBe('retryable');
    expect(result.blockedReasons).toContain('provider-http-503');
    expect(JSON.stringify(result)).not.toContain('secret payload');
  });

  it('retries a provider error whose retryable cause was preserved through a wrapper', async () => {
    const result = await evaluateWithProvider({
      question: question(), evidence: normalizeTextAnswerEvidence('evidence'), classId: 'class-1', policy: policy({ provider: 'ai-evaluator' }),
      provider: {
        id: 'fixture-provider', version: 'fixture.v1',
        evaluate: async () => { throw Object.assign(new Error('provider-error'), { cause: Object.assign(new Error('transport unavailable'), { retryable: true }) }); },
      },
    });

    expect(result.state).toBe('retryable');
  });

  it('retries provider output that has no usable evidence anchors', async () => {
    const result = await evaluateWithProvider({
      question: question(), evidence: normalizeTextAnswerEvidence('evidence'), classId: 'class-1', policy: policy({ provider: 'ai-evaluator' }),
      provider: {
        id: 'fixture-provider', version: 'fixture.v1',
        evaluate: async () => ({ ...validProviderOutput(), assessments: [{ ...validProviderOutput().assessments[0], anchors: [] }] }),
      },
    });

    expect(result.state).toBe('retryable');
    expect(result.blockedReasons).toContain('schema:assessments.0.anchors:Array must contain at least 1 element(s)');
  });

  it('canonicalizes a provider page number when its selected evidence block is known', async () => {
    const evidence = normalizeTextAnswerEvidence('evidence');
    evidence.blocks[0].pageNumber = 1;
    const result = await evaluateWithProvider({
      question: question(), evidence, classId: 'class-1', policy: policy({ provider: 'ai-evaluator' }),
      provider: {
        id: 'fixture-provider', version: 'fixture.v1',
        evaluate: async () => ({
          ...validProviderOutput(),
          assessments: [{
            ...validProviderOutput().assessments[0],
            anchors: [{ blockId: evidence.blocks[0].id, precision: 'span', excerpt: 'evidence', pageNumber: 2, spanStart: 0, spanEnd: 8 }],
          }],
        }),
      },
    });

    expect(result.state).toBe('awaiting-review');
    expect(result.assessments[0]?.anchors[0]).toMatchObject({
      blockId: evidence.blocks[0].id,
      pageNumber: 1,
      excerpt: 'evidence',
    });
  });

  it('retries a provider response that violates the frozen rubric contract', async () => {
    const result = await evaluateWithProvider({
      question: question(), evidence: normalizeTextAnswerEvidence('evidence'), classId: 'class-1', policy: policy({ provider: 'ai-evaluator' }),
      provider: {
        id: 'fixture-provider', version: 'fixture.v1',
        evaluate: async () => ({
          ...validProviderOutput(),
          assessments: [{ ...validProviderOutput().assessments[0], criterionId: 'unknown-criterion' }],
        }),
      },
    });

    expect(result.state).toBe('retryable');
    expect(result.blockedReasons).toContain('unknown-criterion');
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

  it('sends selected image evidence but keeps PDF evidence out of configured provider requests', async () => {
    mocks.resolve.mockResolvedValue({ provider: 'configured-openai', providerKind: 'openai-compatible', baseURL: 'https://provider.example/v1', apiKey: 'secret', authMode: 'bearer-api-key', secretRef: 'env:CONFIGURED_OPENAI_KEY', model: 'model.v1', enabled: true, priority: 1, health: 'healthy', capabilities: { tools: false, reasoning: false, vision: true, jsonSchema: true, streaming: false, citationNormalization: false } });
    mocks.create.mockReturnValue({ getModel: vi.fn(() => 'configured-model') });
    mocks.generateText.mockResolvedValueOnce({
      text: JSON.stringify({ ...validProviderOutput(), evaluatorId: 'configured-openai', evaluatorVersion: 'model.v1' }),
      response: { id: 'request-multimodal-1' },
      usage: { inputTokens: 321, outputTokens: 123, totalTokens: 444 },
    });
    const image = new Uint8Array([1, 2, 3]);
    const pdf = new Uint8Array([4, 5, 6]);

    const result = await evaluateWithProvider({
      question: question(),
      evidence: normalizeTextAnswerEvidence('evidence'),
      classId: 'class-1',
      policy: policy(),
      attachments: [
        { kind: 'image', mediaType: 'image/png', data: image, checksum: sha256(image), questionId: 'question-1' },
        { kind: 'document', mediaType: 'application/pdf', data: pdf, checksum: sha256(pdf), fileName: 'answer.pdf' },
        { kind: 'image', mediaType: 'image/png', data: new Uint8Array([9]), checksum: sha256(new Uint8Array([9])), questionId: 'question-2' },
      ],
    });

    expect(result).toMatchObject({
      state: 'awaiting-review',
      inputTokens: 321,
      outputTokens: 123,
      telemetryComplete: true,
    });
    expect(mocks.generateText).toHaveBeenCalledWith(expect.objectContaining({
      messages: [{
        role: 'user',
        content: [
          expect.objectContaining({ type: 'text' }),
          expect.objectContaining({ type: 'image', image, mediaType: 'image/png' }),
        ],
      }],
    }));
    expect(mocks.generateText.mock.calls.at(-1)?.[0]).not.toEqual(expect.objectContaining({
      messages: [expect.objectContaining({ content: expect.arrayContaining([
        expect.objectContaining({ type: 'file', data: pdf }),
      ]) })],
    }));
    expect(mocks.generateText.mock.calls.at(-1)?.[0]).not.toHaveProperty('prompt');
  });

  it('parses a string-valued SDK output for visual descriptions before local validation', async () => {
    mocks.resolve.mockResolvedValue({ provider: 'configured-openai', providerKind: 'openai-compatible', baseURL: 'https://provider.example/v1', apiKey: 'secret', authMode: 'bearer-api-key', secretRef: 'env:CONFIGURED_OPENAI_KEY', model: 'model.v1', enabled: true, priority: 1, health: 'healthy', capabilities: { tools: false, reasoning: false, vision: true, jsonSchema: true, streaming: false, citationNormalization: false } });
    mocks.create.mockReturnValue({ getModel: vi.fn(() => 'configured-model') });
    mocks.generateText.mockResolvedValueOnce({
      output: JSON.stringify({ description: 'A blank page with no visible diagram.', confidence: 0.99, pageNumber: null, bbox: null, limitations: [] }),
      text: '',
      response: { id: 'request-visual-string-output' },
      usage: { inputTokens: 10, outputTokens: 12, totalTokens: 22 },
    });
    const adapter = await createProviderRuntimeGradingAdapter({
      policy: policy({ provider: 'configured-openai', purpose: 'visual-description', dataCategories: ['student-answer', 'student-answer-visual'], minimizedScope: ['selected-question', 'answer-evidence', 'visual-evidence'] }),
      classId: 'class-1',
      purpose: 'visual-description',
      requireVision: true,
    });
    const result = await adapter.evaluate({ system: 'visual', user: '{}', attachments: [{ kind: 'image', mediaType: 'image/png', data: new Uint8Array([1]), checksum: sha256(new Uint8Array([1])) }] });
    expect(result).toMatchObject({ output: expect.objectContaining({ description: expect.any(String), confidence: 0.99 }) });
  });

  it('binds selected attachment checksums to grading identity and blocks invalid attachments before provider access', async () => {
    const provider = {
      id: 'fixture-provider',
      version: 'fixture.v1',
      evaluate: vi.fn(async () => validProviderOutput()),
    };
    const firstBytes = new Uint8Array([1, 2, 3]);
    const secondBytes = new Uint8Array([1, 2, 4]);
    const base = {
      question: question(),
      evidence: normalizeTextAnswerEvidence('evidence'),
      classId: 'class-1',
      policy: policy({ provider: 'ai-evaluator' }),
      provider,
    };

    const first = await evaluateWithProvider({
      ...base,
      attachments: [{ kind: 'document', mediaType: 'application/pdf', data: firstBytes, checksum: sha256(firstBytes), fileName: 'answer.pdf' }],
    });
    const second = await evaluateWithProvider({
      ...base,
      attachments: [{ kind: 'document', mediaType: 'application/pdf', data: secondBytes, checksum: sha256(secondBytes), fileName: 'answer.pdf' }],
    });
    expect(first.inputHash).not.toBe(second.inputHash);
    expect(first.dedupeKey).not.toBe(second.dedupeKey);

    provider.evaluate.mockClear();
    const checksumMismatch = await evaluateWithProvider({
      ...base,
      attachments: [{ kind: 'image', mediaType: 'image/png', data: firstBytes, checksum: sha256(secondBytes), questionId: 'question-1' }],
    });
    const unsupported = await evaluateWithProvider({
      ...base,
      attachments: [{ kind: 'image', mediaType: 'image/gif', data: firstBytes, checksum: sha256(firstBytes), questionId: 'question-1' }],
    });
    expect(checksumMismatch).toMatchObject({ state: 'blocked', blockedReasons: ['grading-attachment-checksum-mismatch'] });
    expect(unsupported).toMatchObject({ state: 'blocked', blockedReasons: ['grading-attachment-media-type-unsupported'] });
    expect(provider.evaluate).not.toHaveBeenCalled();
  });
});
