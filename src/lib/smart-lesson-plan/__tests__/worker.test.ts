import { beforeEach, describe, expect, it, vi } from 'vitest';

const serviceMocks = vi.hoisted(() => ({
  begin: vi.fn(),
  beginCorrection: vi.fn(),
  complete: vi.fn(),
  fail: vi.fn(),
  action: vi.fn(),
}));
const sourcePackMocks = vi.hoisted(() => ({
  sar: vi.fn(),
  pack: vi.fn(),
}));
const adoptionMocks = vi.hoisted(() => ({ adopt: vi.fn() }));
const textbookMocks = vi.hoisted(() => ({ retrieve: vi.fn() }));

vi.mock('../service', () => ({
  beginCorrectionAttempt: serviceMocks.beginCorrection,
  beginProviderAttempt: serviceMocks.begin,
  completeGenerationStage: serviceMocks.complete,
  failGenerationStage: serviceMocks.fail,
  setGenerationStageActionState: serviceMocks.action,
}));
vi.mock('../../course-basis/lesson-design-source-pack', () => ({
  buildCourseBasisLessonDesignSar: sourcePackMocks.sar,
  buildCourseBasisLessonDesignSourcePack: sourcePackMocks.pack,
}));
vi.mock('../../course-basis/service', () => ({
  adoptCourseBasisVersion: adoptionMocks.adopt,
}));
vi.mock('../textbook-resource-pack', () => ({
  retrieveConfirmedTextbookBindings: textbookMocks.retrieve,
}));

import { consumeSmartLessonE2EFailOnce, processSmartLessonGenerationJob } from '../worker';

const sourcePackItem = {
  id: 'item-1',
  title: '稳定性依据',
  sourceKind: 'reference',
  modality: 'text',
  excerpt: '有界 Source Pack 摘录',
  inclusionRationale: 'governed evidence',
  retrievalChunkId: 'teacher-course-basis:basis-1:version-1:chapter-1',
  citationTargetId: 'teacher-course-basis-citation:basis-1:version-1:chapter-1',
  scores: { relevance: 1, final: 1 },
  access: { visibility: 'teacher', aiUseAllowed: true },
  metadata: {
    versionId: 'version-1',
    stableAnchor: 'chapter-1',
    contentHash: 'a'.repeat(64),
  },
};
const textbookBinding = {
  citationId: 'textbook-v2:fragment:formula-3.2-1',
  sourceVersionId: 'textbook-v2:book-1:8:revision-1',
  anchor: 'formula-3.2-1',
  contentHash: 'b'.repeat(64),
  sourceKind: 'textbook' as const,
  title: '单位阶跃响应',
  structuralPath: ['chapter-3', 'section-3.2'],
  snippet: '一阶系统单位阶跃响应为指数形式。',
  href: '/textbooks/book-1/8/chapter-3/section-3.2#formula-3.2-1',
};

function outlineJobContext() {
  return {
    id: 'job-1', ownerId: 'teacher-1', draftId: 'draft-1', state: 'QUEUED', firstIncompleteStage: 'OUTLINE',
    stages: [{ id: 'stage-1', kind: 'OUTLINE', orderIndex: 0, state: 'PENDING', output: null }],
    draft: { task: {
      courseBasis: { title: '自动控制原理' }, topic: '稳定性', audience: '本科生', prerequisites: '', durationMinutes: 30,
      aggregateClassContext: null, aggregateClassContextRef: null,
      sources: [{ sourceVersionId: 'version-1' }], knowledgePoints: [], goals: [],
    } },
  };
}

function outlineMissingPostAssessment() {
  return {
    keyContent: ['稳定性'], difficultContent: [], limitations: [], classAdaptation: null,
    coursewareStepOutline: [
      ['bridgeIn', 5], ['bridgeIn', 5], ['objectives', 5],
      ['preAssessment', 5], ['participatoryLearning', 5], ['summary', 5],
    ].map(([bopppsStage, minutes]) => ({ title: String(bopppsStage), bopppsStage, minutes })),
  };
}

function persistenceDb(context: object, transitionedCount = 1) {
  const tx = {
    smartLessonGenerationStage: { updateMany: vi.fn(async () => ({ count: 1 })) },
    smartLessonGenerationJob: { updateMany: vi.fn(async () => ({ count: transitionedCount })) },
    smartLessonDraft: { updateMany: vi.fn(async () => ({ count: 1 })) },
  };
  return {
    db: {
      smartLessonGenerationJob: { findUnique: vi.fn(async () => context) },
      $transaction: vi.fn(async (callback) => callback(tx)),
    },
    tx,
  };
}

describe('smart lesson BullMQ worker', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
    serviceMocks.fail.mockResolvedValue({ state: 'RETRYABLE' });
    serviceMocks.action.mockResolvedValue(undefined);
    serviceMocks.beginCorrection.mockResolvedValue({
      id: 'attempt-correction-1',
      idempotencyKey: 'attempt-correction-key-1',
    });
    sourcePackMocks.sar.mockResolvedValue({ candidateRefs: { retrievalChunkIds: ['chunk-1'] } });
    sourcePackMocks.pack.mockResolvedValue({ retrieval: { pack: { items: [sourcePackItem] } } });
    textbookMocks.retrieve.mockResolvedValue([]);
  });

  it('enables one fail-closed real-provider E2E fault only for the authorized stage and token', () => {
    const token = `smart-lesson-e2e-fault-${'a'.repeat(48)}`;
    const authorized = {
      SMART_LESSON_REAL_PROVIDER_REQUIRED: '1',
      SMART_LESSON_E2E_FAIL_ONCE_STAGE: 'BRIDGE_IN',
      SMART_LESSON_E2E_FAULT_TOKEN: token,
      SMART_LESSON_E2E_FAULT_SECRET: token,
    };
    expect(consumeSmartLessonE2EFailOnce('OUTLINE', authorized)).toBe(false);
    expect(consumeSmartLessonE2EFailOnce('BRIDGE_IN', {
      ...authorized,
      SMART_LESSON_E2E_FAULT_SECRET: 'mismatch',
    })).toBe(false);
    expect(consumeSmartLessonE2EFailOnce('BRIDGE_IN', authorized)).toBe(true);
    expect(consumeSmartLessonE2EFailOnce('BRIDGE_IN', authorized)).toBe(false);
    expect(consumeSmartLessonE2EFailOnce('BRIDGE_IN', {
      ...authorized,
      SMART_LESSON_REAL_PROVIDER_REQUIRED: '0',
      SMART_LESSON_E2E_FAULT_TOKEN: `smart-lesson-e2e-fault-${'b'.repeat(48)}`,
      SMART_LESSON_E2E_FAULT_SECRET: `smart-lesson-e2e-fault-${'b'.repeat(48)}`,
    })).toBe(false);
  });

  it('routes the authorized one-time BRIDGE_IN fault through failGenerationStage', async () => {
    const token = `smart-lesson-e2e-fault-${'c'.repeat(48)}`;
    vi.stubEnv('SMART_LESSON_REAL_PROVIDER_REQUIRED', '1');
    vi.stubEnv('SMART_LESSON_E2E_FAIL_ONCE_STAGE', 'BRIDGE_IN');
    vi.stubEnv('SMART_LESSON_E2E_FAULT_TOKEN', token);
    vi.stubEnv('SMART_LESSON_E2E_FAULT_SECRET', token);
    const outline = {
      keyContent: ['稳定性'], difficultContent: [], limitations: [], classAdaptation: null,
      coursewareStepOutline: [
        ['bridgeIn', 5], ['objectives', 5], ['preAssessment', 5],
        ['participatoryLearning', 5], ['postAssessment', 5], ['summary', 5],
      ].map(([bopppsStage, minutes]) => ({ title: String(bopppsStage), bopppsStage, minutes })),
    };
    const context = {
      id: 'job-fault', ownerId: 'teacher-1', draftId: 'draft-1', state: 'QUEUED', firstIncompleteStage: 'BRIDGE_IN',
      stages: [
        { id: 'stage-outline', kind: 'OUTLINE', orderIndex: 0, state: 'COMPLETED', output: outline },
        { id: 'stage-bridge', kind: 'BRIDGE_IN', orderIndex: 1, state: 'PENDING', output: null },
      ],
      draft: { task: {
        courseBasis: { title: '自动控制原理' }, topic: '稳定性', audience: '本科生', prerequisites: '', durationMinutes: 30,
        aggregateClassContext: null, aggregateClassContextRef: null,
        sources: [{ sourceVersionId: 'version-1' }], knowledgePoints: [], goals: [],
      } },
    };
    const generate = vi.fn();
    serviceMocks.begin.mockResolvedValue({
      claimed: true,
      claimToken: 'claim-fault',
      attempt: { id: 'attempt-fault', idempotencyKey: 'attempt-fault-key' },
    });

    await expect(processSmartLessonGenerationJob(
      { smartLessonGenerationJob: { findUnique: vi.fn(async () => context) } } as never,
      'job-fault',
      vi.fn(async () => ({
        serviceId: 'provider-1',
        providerKind: 'openai-compatible',
        model: 'model-1',
        generate,
      })) as never,
    )).resolves.toEqual({ jobId: 'job-fault', state: 'RETRYABLE' });

    expect(generate).not.toHaveBeenCalled();
    expect(serviceMocks.fail).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      jobId: 'job-fault',
      stage: 'BRIDGE_IN',
      attemptId: 'attempt-fault',
      claimToken: 'claim-fault',
      failureCode: 'provider-timeout',
      retryable: true,
    }));
  });

  it('loads governed evidence, claims before provider use, and persists the stage result', async () => {
    const context = {
      id: 'job-1', ownerId: 'teacher-1', draftId: 'draft-1', state: 'QUEUED', firstIncompleteStage: 'OUTLINE',
      stages: [{ id: 'stage-1', kind: 'OUTLINE', orderIndex: 0, state: 'PENDING', output: null }],
      draft: { task: {
        courseBasis: { title: '自动控制原理' }, topic: '稳定性', audience: '本科生', prerequisites: '', durationMinutes: 30,
        aggregateClassContext: null, aggregateClassContextRef: null,
        sources: [{ sourceVersionId: 'version-1' }], knowledgePoints: [], goals: [],
      } },
    };
    const db = {
      smartLessonGenerationJob: { findUnique: vi.fn(async () => context) },
    };
    const outline = {
      keyContent: ['稳定性'], difficultContent: [], limitations: [], classAdaptation: null,
      coursewareStepOutline: [
        ['bridgeIn', 5], ['objectives', 5], ['preAssessment', 5], ['participatoryLearning', 5], ['postAssessment', 5], ['summary', 5],
      ].map(([bopppsStage, minutes]) => ({ title: String(bopppsStage), bopppsStage, minutes })),
    };
    const generate = vi.fn(async () => ({
      output: outline, normalizedResponseId: 'response-1', inputTokens: 10, outputTokens: 20, costMicros: null,
    }));
    serviceMocks.begin.mockResolvedValue({ claimed: true, claimToken: 'claim-1', attempt: { id: 'attempt-1', idempotencyKey: 'attempt-key-1' } });
    serviceMocks.complete.mockResolvedValue({ state: 'PAUSED' });

    await expect(processSmartLessonGenerationJob(db as never, 'job-1', vi.fn(async () => ({
      serviceId: 'provider-1', providerKind: 'openai-compatible', model: 'model-1', generate,
    })) as never)).resolves.toEqual({ jobId: 'job-1', state: 'PAUSED' });
    expect(serviceMocks.begin).toHaveBeenCalledBefore(generate);
    expect(sourcePackMocks.sar).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      selectedVersionIds: ['version-1'], explicitRetiredVersionIds: ['version-1'], query: '稳定性',
    }));
    expect(adoptionMocks.adopt).toHaveBeenCalledWith(db, {
      actor: { id: 'teacher-1', role: 'TEACHER' },
      versionId: 'version-1',
      adopter: { referenceType: 'GENERATION_JOB', referenceId: 'job-1' },
      anchors: [{
        stableAnchor: sourcePackItem.metadata.stableAnchor,
        contentHash: sourcePackItem.metadata.contentHash,
      }],
    });
    expect(sourcePackMocks.pack).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      explicitRetiredVersionIds: ['version-1'],
      retrieval: { query: '稳定性', topK: 8 },
    }));
    expect(generate).toHaveBeenCalledWith(expect.objectContaining({
      prompt: expect.stringContaining('有界 Source Pack 摘录'),
    }));
    expect(generate).toHaveBeenCalledWith(expect.objectContaining({
      system: expect.stringContaining('sourceBindings 只能从 JSON Schema 枚举的可用来源绑定中完整选择'),
      prompt: expect.stringContaining('teacher-course-basis-citation:basis-1:version-1:chapter-1'),
      maxOutputTokens: 2048,
    }));
    expect(serviceMocks.complete).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      stage: 'OUTLINE', claimToken: 'claim-1', attemptId: 'attempt-1', output: outline,
    }));
    expect(serviceMocks.fail).not.toHaveBeenCalled();
  });

  it('merges confirmed textbook evidence into the provider request without adopting it as a course-basis version', async () => {
    const outline = {
      keyContent: ['稳定性'], difficultContent: [], limitations: [], classAdaptation: null,
      coursewareStepOutline: [
        ['bridgeIn', 5], ['objectives', 5], ['preAssessment', 5], ['participatoryLearning', 5], ['postAssessment', 5], ['summary', 5],
      ].map(([bopppsStage, minutes]) => ({ title: String(bopppsStage), bopppsStage, minutes })),
    };
    const textbookRanges = [{
      bookId: 'book-1', level: 'SECTION', unitId: 'section-3.2', structuralPath: ['chapter-3', 'section-3.2'],
    }];
    const context = {
      id: 'job-1', ownerId: 'teacher-1', draftId: 'draft-1', state: 'RUNNING', firstIncompleteStage: 'BRIDGE_IN',
      stages: [
        { id: 'stage-outline', kind: 'OUTLINE', orderIndex: 0, state: 'COMPLETED', output: outline },
        { id: 'stage-bridge', kind: 'BRIDGE_IN', orderIndex: 1, state: 'PENDING', output: null },
      ],
      draft: { task: {
        courseBasis: { title: '自动控制原理' }, topic: '稳定性', audience: '本科生', prerequisites: '', durationMinutes: 30,
        aggregateClassContext: null, aggregateClassContextRef: null, textbookRanges,
        sources: [{ sourceVersionId: 'version-1' }], knowledgePoints: [], goals: [],
      } },
    };
    const db = { smartLessonGenerationJob: { findUnique: vi.fn(async () => context) } };
    textbookMocks.retrieve.mockResolvedValue([textbookBinding]);
    serviceMocks.begin.mockResolvedValue({
      claimed: true, claimToken: 'claim-1', attempt: { id: 'attempt-1', idempotencyKey: 'attempt-key-1' },
    });
    serviceMocks.complete.mockResolvedValue({ state: 'PAUSED' });
    const generate = vi.fn(async () => ({
      output: {
        minutes: 5, teacherActivity: '讲授', studentActivity: '参与', assessment: '观察',
        steps: [{
          title: '导入', minutes: 5, teacherActivity: '展示', studentActivity: '回答', assessment: '提问',
          sourceBindings: [textbookBinding],
        }],
      },
      normalizedResponseId: 'response-1', inputTokens: 10, outputTokens: 20, costMicros: null,
    }));

    await expect(processSmartLessonGenerationJob(db as never, 'job-1', vi.fn(async () => ({
      serviceId: 'provider-1', providerKind: 'openai-compatible', model: 'model-1', generate,
    })) as never)).resolves.toEqual({ jobId: 'job-1', state: 'PAUSED' });

    expect(textbookMocks.retrieve).toHaveBeenCalledWith('稳定性', textbookRanges);
    expect(generate).toHaveBeenCalledWith(expect.objectContaining({
      prompt: expect.stringContaining(textbookBinding.snippet),
    }));
    expect(serviceMocks.complete).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      output: expect.objectContaining({
        steps: [expect.objectContaining({ sourceBindings: [textbookBinding] })],
      }),
    }));
    expect(adoptionMocks.adopt).toHaveBeenCalledTimes(1);
    expect(adoptionMocks.adopt).toHaveBeenCalledWith(db, expect.objectContaining({ versionId: 'version-1' }));
  });

  it('generates from confirmed textbook evidence when the task has no uploaded versions', async () => {
    const outline = {
      keyContent: ['稳定性'], difficultContent: [], limitations: [], classAdaptation: null,
      coursewareStepOutline: [
        ['bridgeIn', 5], ['objectives', 5], ['preAssessment', 5], ['participatoryLearning', 5], ['postAssessment', 5], ['summary', 5],
      ].map(([bopppsStage, minutes]) => ({ title: String(bopppsStage), bopppsStage, minutes })),
    };
    const textbookRanges = [{
      bookId: 'book-1', level: 'SECTION', unitId: 'section-3.2', structuralPath: ['chapter-3', 'section-3.2'],
    }];
    const context = {
      id: 'job-1', ownerId: 'teacher-1', draftId: 'draft-1', state: 'QUEUED', firstIncompleteStage: 'OUTLINE',
      stages: [{ id: 'stage-1', kind: 'OUTLINE', orderIndex: 0, state: 'PENDING', output: null }],
      draft: { task: {
        courseBasis: { title: '自动控制原理' }, topic: '稳定性', audience: '本科生', prerequisites: '', durationMinutes: 30,
        aggregateClassContext: null, aggregateClassContextRef: null, textbookRanges,
        sources: [], knowledgePoints: [], goals: [],
      } },
    };
    const db = { smartLessonGenerationJob: { findUnique: vi.fn(async () => context) } };
    textbookMocks.retrieve.mockResolvedValue([textbookBinding]);
    serviceMocks.begin.mockResolvedValue({
      claimed: true, claimToken: 'claim-1', attempt: { id: 'attempt-1', idempotencyKey: 'attempt-key-1' },
    });
    serviceMocks.complete.mockResolvedValue({ state: 'PAUSED' });
    const generate = vi.fn(async () => ({
      output: outline,
      normalizedResponseId: 'response-1',
      inputTokens: 10,
      outputTokens: 20,
      costMicros: null,
    }));

    await expect(processSmartLessonGenerationJob(db as never, 'job-1', vi.fn(async () => ({
      serviceId: 'provider-1', providerKind: 'openai-compatible', model: 'model-1', generate,
    })) as never)).resolves.toEqual({ jobId: 'job-1', state: 'PAUSED' });

    expect(sourcePackMocks.sar).not.toHaveBeenCalled();
    expect(sourcePackMocks.pack).not.toHaveBeenCalled();
    expect(textbookMocks.retrieve).toHaveBeenCalledWith('稳定性', textbookRanges);
    expect(adoptionMocks.adopt).not.toHaveBeenCalled();
    expect(generate).toHaveBeenCalledWith(expect.objectContaining({
      prompt: expect.stringContaining(textbookBinding.snippet),
    }));
  });

  it('makes exactly one linked correction call and marks a second invalid result retryable', async () => {
    const context = {
      id: 'job-1', ownerId: 'teacher-1', draftId: 'draft-1', state: 'QUEUED', firstIncompleteStage: 'OUTLINE',
      stages: [{ id: 'stage-1', kind: 'OUTLINE', orderIndex: 0, state: 'PENDING', output: null }],
      draft: { task: {
        courseBasis: { title: '自动控制原理' }, topic: '稳定性', audience: '本科生', prerequisites: '', durationMinutes: 30,
        aggregateClassContext: null, aggregateClassContextRef: null,
        sources: [{ sourceVersionId: 'version-1' }], knowledgePoints: [], goals: [],
      } },
    };
    const db = {
      smartLessonGenerationJob: { findUnique: vi.fn(async () => context) },
    };
    serviceMocks.begin.mockResolvedValue({ claimed: true, claimToken: 'claim-1', attempt: { id: 'attempt-1', idempotencyKey: 'attempt-key-1' } });

    await expect(processSmartLessonGenerationJob(db as never, 'job-1', vi.fn(async () => ({
      serviceId: 'provider-1', providerKind: 'openai-compatible', model: 'model-1',
      generate: vi.fn(async () => ({ output: {}, normalizedResponseId: 'response-1' })),
    })) as never)).resolves.toEqual({ jobId: 'job-1', state: 'RETRYABLE' });

    expect(serviceMocks.beginCorrection).toHaveBeenCalledTimes(1);
    expect(serviceMocks.fail).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      stage: 'OUTLINE', attemptId: 'attempt-correction-1', retryable: true,
      validationReceipt: expect.objectContaining({ valid: false }),
    }));
  });

  it('attributes a correction provider timeout to the running correction attempt', async () => {
    const context = outlineJobContext();
    const generate = vi.fn()
      .mockResolvedValueOnce({ output: {}, normalizedResponseId: 'invalid-original-response' })
      .mockRejectedValueOnce(new Error('curl: (28) Operation timed out after 240000 milliseconds with 0 bytes received'));
    serviceMocks.begin.mockResolvedValue({
      claimed: true, claimToken: 'claim-1', attempt: { id: 'attempt-original-1', idempotencyKey: 'attempt-key-1' },
    });

    await expect(processSmartLessonGenerationJob(
      { smartLessonGenerationJob: { findUnique: vi.fn(async () => context) } } as never,
      'job-1',
      vi.fn(async () => ({ serviceId: 'provider-1', providerKind: 'openai-compatible', model: 'model-1', generate })) as never,
    )).resolves.toEqual({ jobId: 'job-1', state: 'RETRYABLE' });

    expect(serviceMocks.beginCorrection).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      originalAttemptId: 'attempt-original-1',
    }));
    expect(serviceMocks.fail).toHaveBeenCalledTimes(1);
    expect(serviceMocks.fail).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      attemptId: 'attempt-correction-1',
      failureCode: 'provider-timeout',
      retryable: true,
    }));
    expect(serviceMocks.fail).not.toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      attemptId: 'attempt-original-1',
    }));
  });

  it('persists a corrected valid result from the single linked correction attempt', async () => {
    const context = {
      id: 'job-1', ownerId: 'teacher-1', draftId: 'draft-1', state: 'QUEUED', firstIncompleteStage: 'OUTLINE',
      stages: [{ id: 'stage-1', kind: 'OUTLINE', orderIndex: 0, state: 'PENDING', output: null }],
      draft: { task: {
        courseBasis: { title: '自动控制原理' }, topic: '稳定性', audience: '本科生', prerequisites: '', durationMinutes: 30,
        aggregateClassContext: null, aggregateClassContextRef: null,
        sources: [{ sourceVersionId: 'version-1' }], knowledgePoints: [], goals: [],
      } },
    };
    const outline = {
      keyContent: ['稳定性'], difficultContent: [], limitations: [], classAdaptation: null,
      coursewareStepOutline: [
        ['bridgeIn', 5], ['objectives', 5], ['preAssessment', 5], ['participatoryLearning', 5], ['postAssessment', 5], ['summary', 5],
      ].map(([bopppsStage, minutes]) => ({ title: String(bopppsStage), bopppsStage, minutes })),
    };
    const generate = vi.fn()
      .mockResolvedValueOnce({ output: {}, normalizedResponseId: 'invalid-response' })
      .mockResolvedValueOnce({ output: outline, normalizedResponseId: 'corrected-response', inputTokens: 2, outputTokens: 3, costMicros: null });
    serviceMocks.begin.mockResolvedValue({
      claimed: true, claimToken: 'claim-1', attempt: { id: 'attempt-1', idempotencyKey: 'attempt-key-1' },
    });
    serviceMocks.complete.mockResolvedValue({ state: 'PAUSED' });

    await expect(processSmartLessonGenerationJob(
      { smartLessonGenerationJob: { findUnique: vi.fn(async () => context) } } as never,
      'job-1',
      vi.fn(async () => ({ serviceId: 'provider-1', providerKind: 'openai-compatible', model: 'model-1', generate })) as never,
    )).resolves.toEqual({ jobId: 'job-1', state: 'PAUSED' });

    expect(generate).toHaveBeenCalledTimes(2);
    expect(serviceMocks.beginCorrection).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      originalAttemptId: 'attempt-1',
      validationReceipt: expect.objectContaining({ valid: false }),
    }));
    expect(serviceMocks.complete).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      attemptId: 'attempt-correction-1',
      output: outline,
      validationReceipt: expect.objectContaining({ valid: true }),
    }));
  });

  it('provides the expected stage minutes to correction without relaxing source bindings', async () => {
    const outline = {
      keyContent: ['稳定性'], difficultContent: [], limitations: [], classAdaptation: null,
      coursewareStepOutline: [
        ['bridgeIn', 5], ['objectives', 5], ['preAssessment', 5],
        ['participatoryLearning', 10], ['postAssessment', 5], ['summary', 5],
      ].map(([bopppsStage, minutes]) => ({ title: String(bopppsStage), bopppsStage, minutes })),
    };
    const context = {
      id: 'job-1', ownerId: 'teacher-1', draftId: 'draft-1', state: 'RUNNING', firstIncompleteStage: 'PARTICIPATORY_LEARNING',
      stages: [
        { id: 'stage-outline', kind: 'OUTLINE', orderIndex: 0, state: 'COMPLETED', output: outline },
        { id: 'stage-participatory', kind: 'PARTICIPATORY_LEARNING', orderIndex: 4, state: 'PENDING', output: null },
      ],
      draft: { task: {
        courseBasis: { title: '自动控制原理' }, topic: '稳定性', audience: '本科生', prerequisites: '', durationMinutes: 35,
        aggregateClassContext: null, aggregateClassContextRef: null,
        sources: [{ sourceVersionId: 'version-1' }], knowledgePoints: [], goals: [],
      } },
    };
    const stageOutput = (minutes: number) => ({
      minutes, teacherActivity: '讲授', studentActivity: '参与', assessment: '观察',
      steps: [{
        title: '参与式学习', minutes, teacherActivity: '引导', studentActivity: '练习', assessment: '反馈',
        sourceBindings: [{
          citationId: sourcePackItem.citationTargetId,
          sourceVersionId: sourcePackItem.metadata.versionId,
          anchor: sourcePackItem.metadata.stableAnchor,
          contentHash: sourcePackItem.metadata.contentHash,
        }],
      }],
    });
    const generate = vi.fn()
      .mockResolvedValueOnce({ output: stageOutput(5), normalizedResponseId: 'invalid-duration' })
      .mockResolvedValueOnce({ output: stageOutput(10), normalizedResponseId: 'corrected-duration' });
    serviceMocks.begin.mockResolvedValue({
      claimed: true, claimToken: 'claim-1', attempt: { id: 'attempt-1', idempotencyKey: 'attempt-key-1' },
    });
    serviceMocks.complete.mockResolvedValue({ state: 'PAUSED' });

    await expect(processSmartLessonGenerationJob(
      { smartLessonGenerationJob: { findUnique: vi.fn(async () => context) } } as never,
      'job-1',
      vi.fn(async () => ({ serviceId: 'provider-1', providerKind: 'openai-compatible', model: 'model-1', generate })) as never,
    )).resolves.toEqual({ jobId: 'job-1', state: 'PAUSED' });

    expect(serviceMocks.beginCorrection).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      request: expect.objectContaining({
        correctionContext: expect.objectContaining({
          stage: 'PARTICIPATORY_LEARNING',
          expectedMinutes: 10,
          actualMinutes: 5,
        }),
      }),
    }));
    expect(generate).toHaveBeenNthCalledWith(2, expect.objectContaining({
      prompt: expect.stringContaining('"expectedMinutes":10'),
    }));
    expect(serviceMocks.complete).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      output: expect.objectContaining({
        minutes: 10,
        steps: [expect.objectContaining({
          sourceBindings: [expect.objectContaining({
            citationId: sourcePackItem.citationTargetId,
            contentHash: sourcePackItem.metadata.contentHash,
          })],
        })],
      }),
    }));
  });

  it('normalizes stage-step-duration-mismatch into a targeted correction context', async () => {
    const outline = {
      keyContent: ['稳定性'], difficultContent: [], limitations: [], classAdaptation: null,
      coursewareStepOutline: [
        ['bridgeIn', 5], ['objectives', 5], ['preAssessment', 5],
        ['participatoryLearning', 5], ['postAssessment', 5], ['summary', 5],
      ].map(([bopppsStage, minutes]) => ({ title: String(bopppsStage), bopppsStage, minutes })),
    };
    const context = {
      id: 'job-1', ownerId: 'teacher-1', draftId: 'draft-1', state: 'RUNNING', firstIncompleteStage: 'OBJECTIVES',
      stages: [
        { id: 'stage-outline', kind: 'OUTLINE', orderIndex: 0, state: 'COMPLETED', output: outline },
        { id: 'stage-objectives', kind: 'OBJECTIVES', orderIndex: 1, state: 'PENDING', output: null },
      ],
      draft: { task: {
        courseBasis: { title: '自动控制原理' }, topic: '稳定性', audience: '本科生', prerequisites: '', durationMinutes: 30,
        aggregateClassContext: null, aggregateClassContextRef: null,
        sources: [{ sourceVersionId: 'version-1' }], knowledgePoints: [], goals: [],
      } },
    };
    const stageOutput = (stageMinutes: number, stepMinutes: number) => ({
      minutes: stageMinutes, teacherActivity: '讲授目标', studentActivity: '理解目标', assessment: '口头确认',
      steps: [{
        title: '目标说明', minutes: stepMinutes, teacherActivity: '宣读目标', studentActivity: '记录目标', assessment: '提问',
        sourceBindings: [{
          citationId: sourcePackItem.citationTargetId,
          sourceVersionId: sourcePackItem.metadata.versionId,
          anchor: sourcePackItem.metadata.stableAnchor,
          contentHash: sourcePackItem.metadata.contentHash,
        }],
      }],
    });
    const generate = vi.fn()
      .mockResolvedValueOnce({ output: stageOutput(5, 3), normalizedResponseId: 'step-duration-invalid' })
      .mockResolvedValueOnce({ output: stageOutput(5, 5), normalizedResponseId: 'step-duration-corrected' });
    serviceMocks.begin.mockResolvedValue({
      claimed: true, claimToken: 'claim-1', attempt: { id: 'attempt-1', idempotencyKey: 'attempt-key-1' },
    });
    serviceMocks.complete.mockResolvedValue({ state: 'PAUSED' });

    await expect(processSmartLessonGenerationJob(
      { smartLessonGenerationJob: { findUnique: vi.fn(async () => context) } } as never,
      'job-1',
      vi.fn(async () => ({ serviceId: 'provider-1', providerKind: 'openai-compatible', model: 'qwen', generate })) as never,
    )).resolves.toEqual({ jobId: 'job-1', state: 'PAUSED' });

    expect(serviceMocks.beginCorrection).toHaveBeenCalledTimes(1);
    expect(serviceMocks.beginCorrection).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      originalAttemptId: 'attempt-1',
      validationReceipt: {
        valid: false,
        schemaVersion: 'smart-lesson-boppps-objectives.v1',
        issues: [{
          code: 'stage-step-duration-mismatch',
          path: ['steps'],
          message: 'stage-step-duration-mismatch:3:5',
        }],
      },
      request: expect.objectContaining({
        correctionContext: {
          stage: 'OBJECTIVES',
          expectedMinutes: 5,
          actualMinutes: 3,
          instruction: expect.stringContaining('严格等于 5 分钟'),
        },
      }),
    }));
    expect(generate).toHaveBeenNthCalledWith(2, expect.objectContaining({
      prompt: expect.stringContaining('"expectedMinutes":5'),
      promptVersion: 'smart-lesson-plan.v2',
    }));
    expect(serviceMocks.complete).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      attemptId: 'attempt-correction-1',
      output: expect.objectContaining({ minutes: 5 }),
    }));
  });

  it('falls back to the generic correction prompt when other schema errors coexist with the duration mismatch', async () => {
    const outline = {
      keyContent: ['稳定性'], difficultContent: [], limitations: [], classAdaptation: null,
      coursewareStepOutline: [
        ['bridgeIn', 5], ['objectives', 5], ['preAssessment', 5],
        ['participatoryLearning', 5], ['postAssessment', 5], ['summary', 5],
      ].map(([bopppsStage, minutes]) => ({ title: String(bopppsStage), bopppsStage, minutes })),
    };
    const context = {
      id: 'job-1', ownerId: 'teacher-1', draftId: 'draft-1', state: 'RUNNING', firstIncompleteStage: 'OBJECTIVES',
      stages: [
        { id: 'stage-outline', kind: 'OUTLINE', orderIndex: 0, state: 'COMPLETED', output: outline },
        { id: 'stage-objectives', kind: 'OBJECTIVES', orderIndex: 1, state: 'PENDING', output: null },
      ],
      draft: { task: {
        courseBasis: { title: '自动控制原理' }, topic: '稳定性', audience: '本科生', prerequisites: '', durationMinutes: 30,
        aggregateClassContext: null, aggregateClassContextRef: null,
        sources: [{ sourceVersionId: 'version-1' }], knowledgePoints: [], goals: [],
      } },
    };
    const stageOutput = (stageMinutes: number, stepMinutes: number, teacherActivity: string) => ({
      minutes: stageMinutes, teacherActivity, studentActivity: '理解目标', assessment: '口头确认',
      steps: [{
        title: '目标说明', minutes: stepMinutes, teacherActivity: '宣读目标', studentActivity: '记录目标', assessment: '提问',
        sourceBindings: [{
          citationId: sourcePackItem.citationTargetId,
          sourceVersionId: sourcePackItem.metadata.versionId,
          anchor: sourcePackItem.metadata.stableAnchor,
          contentHash: sourcePackItem.metadata.contentHash,
        }],
      }],
    });
    const generate = vi.fn()
      .mockResolvedValueOnce({
        output: stageOutput(5, 3, ''),
        normalizedResponseId: 'multi-error-invalid',
      })
      .mockResolvedValueOnce({
        output: stageOutput(5, 5, '讲授目标'),
        normalizedResponseId: 'multi-error-corrected',
      });
    serviceMocks.begin.mockResolvedValue({
      claimed: true, claimToken: 'claim-1', attempt: { id: 'attempt-1', idempotencyKey: 'attempt-key-1' },
    });
    serviceMocks.complete.mockResolvedValue({ state: 'PAUSED' });

    await expect(processSmartLessonGenerationJob(
      { smartLessonGenerationJob: { findUnique: vi.fn(async () => context) } } as never,
      'job-1',
      vi.fn(async () => ({ serviceId: 'provider-1', providerKind: 'openai-compatible', model: 'qwen', generate })) as never,
    )).resolves.toEqual({ jobId: 'job-1', state: 'PAUSED' });

    expect(serviceMocks.beginCorrection).toHaveBeenCalledTimes(1);
    const correctionInput = serviceMocks.beginCorrection.mock.calls[0][1];
    const issueCodes = correctionInput.validationReceipt.issues.map((issue: { code: string }) => issue.code);
    expect(issueCodes).toContain('stage-step-duration-mismatch');
    expect(issueCodes.length).toBeGreaterThan(1);
    expect('correctionContext' in correctionInput.request).toBe(false);
    expect(generate.mock.calls[1][0].prompt).not.toContain('correctionContext');
    expect(serviceMocks.complete).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      attemptId: 'attempt-correction-1',
      output: expect.objectContaining({ teacherActivity: '讲授目标' }),
    }));
  });

  it('falls back to the generic correction prompt when outline minutes cannot be resolved', async () => {    const context = {
      id: 'job-1', ownerId: 'teacher-1', draftId: 'draft-1', state: 'RUNNING', firstIncompleteStage: 'OBJECTIVES',
      stages: [
        { id: 'stage-outline', kind: 'OUTLINE', orderIndex: 0, state: 'PENDING', output: null },
        { id: 'stage-objectives', kind: 'OBJECTIVES', orderIndex: 1, state: 'PENDING', output: null },
      ],
      draft: { task: {
        courseBasis: { title: '自动控制原理' }, topic: '稳定性', audience: '本科生', prerequisites: '', durationMinutes: 30,
        aggregateClassContext: null, aggregateClassContextRef: null,
        sources: [{ sourceVersionId: 'version-1' }], knowledgePoints: [], goals: [],
      } },
    };
    const stageOutput = (stageMinutes: number, stepMinutes: number) => ({
      minutes: stageMinutes, teacherActivity: '讲授目标', studentActivity: '理解目标', assessment: '口头确认',
      steps: [{
        title: '目标说明', minutes: stepMinutes, teacherActivity: '宣读目标', studentActivity: '记录目标', assessment: '提问',
        sourceBindings: [{
          citationId: sourcePackItem.citationTargetId,
          sourceVersionId: sourcePackItem.metadata.versionId,
          anchor: sourcePackItem.metadata.stableAnchor,
          contentHash: sourcePackItem.metadata.contentHash,
        }],
      }],
    });
    const generate = vi.fn()
      .mockResolvedValueOnce({ output: stageOutput(5, 3), normalizedResponseId: 'step-duration-invalid' })
      .mockResolvedValueOnce({ output: stageOutput(5, 5), normalizedResponseId: 'generic-corrected' });
    serviceMocks.begin.mockResolvedValue({
      claimed: true, claimToken: 'claim-1', attempt: { id: 'attempt-1', idempotencyKey: 'attempt-key-1' },
    });
    serviceMocks.fail.mockResolvedValue({ state: 'RETRYABLE' });

    await expect(processSmartLessonGenerationJob(
      { smartLessonGenerationJob: { findUnique: vi.fn(async () => context) } } as never,
      'job-1',
      vi.fn(async () => ({ serviceId: 'provider-1', providerKind: 'openai-compatible', model: 'qwen', generate })) as never,
    )).resolves.toEqual({ jobId: 'job-1', state: 'RETRYABLE' });

    expect(serviceMocks.beginCorrection).toHaveBeenCalledTimes(1);
    const correctionInput = serviceMocks.beginCorrection.mock.calls[0][1];
    expect(correctionInput.validationReceipt.issues[0].code).toBe('stage-step-duration-mismatch');
    expect('correctionContext' in correctionInput.request).toBe(false);
    expect(generate.mock.calls[1][0].prompt).not.toContain('correctionContext');
    expect(serviceMocks.fail).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      failureCode: 'provider-output-invalid-after-correction',
    }));
  });

  it('routes a schema-valid outline missing post-assessment through the linked correction attempt', async () => {
    const context = outlineJobContext();
    const correctedOutline = {
      ...outlineMissingPostAssessment(),
      coursewareStepOutline: [
        ['bridgeIn', 5], ['objectives', 5], ['preAssessment', 5],
        ['participatoryLearning', 5], ['postAssessment', 5], ['summary', 5],
      ].map(([bopppsStage, minutes]) => ({ title: String(bopppsStage), bopppsStage, minutes })),
    };
    const generate = vi.fn()
      .mockResolvedValueOnce({ output: outlineMissingPostAssessment(), normalizedResponseId: 'qwen-outline' })
      .mockResolvedValueOnce({ output: correctedOutline, normalizedResponseId: 'qwen-outline-corrected' });
    serviceMocks.begin.mockResolvedValue({
      claimed: true, claimToken: 'claim-1', attempt: { id: 'attempt-1', idempotencyKey: 'attempt-key-1' },
    });
    serviceMocks.complete.mockResolvedValue({ state: 'PAUSED' });

    await expect(processSmartLessonGenerationJob(
      { smartLessonGenerationJob: { findUnique: vi.fn(async () => context) } } as never,
      'job-1',
      vi.fn(async () => ({ serviceId: 'provider-1', providerKind: 'openai-compatible', model: 'qwen', generate })) as never,
    )).resolves.toEqual({ jobId: 'job-1', state: 'PAUSED' });

    expect(serviceMocks.beginCorrection).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      originalAttemptId: 'attempt-1',
      validationReceipt: {
        valid: false,
        schemaVersion: 'smart-lesson-outline.v1',
        issues: [{
          code: 'outline-stage-missing',
          path: ['coursewareStepOutline'],
          message: '提纲缺少必要的 postAssessment 阶段。',
        }],
      },
    }));
    expect(serviceMocks.complete).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      attemptId: 'attempt-correction-1',
      output: correctedOutline,
    }));
  });

  it('routes an outline class-context ref mismatch through correction with the expected ref', async () => {
    const contextRef = `cumulative-class-portrait:${'d'.repeat(64)}`;
    const context = outlineJobContext();
    context.draft.task.aggregateClassContextRef = contextRef;
    const mismatched = {
      keyContent: ['稳定性'], difficultContent: [], limitations: [], classAdaptation: null,
      coursewareStepOutline: [
        ['bridgeIn', 5], ['objectives', 5], ['preAssessment', 5],
        ['participatoryLearning', 5], ['postAssessment', 5], ['summary', 5],
      ].map(([bopppsStage, minutes]) => ({ title: String(bopppsStage), bopppsStage, minutes })),
    };
    const corrected = {
      ...mismatched,
      classAdaptation: { aggregateContextRef: contextRef, emphasis: [] },
    };
    const generate = vi.fn()
      .mockResolvedValueOnce({ output: mismatched, normalizedResponseId: 'qwen-outline' })
      .mockResolvedValueOnce({ output: corrected, normalizedResponseId: 'qwen-outline-corrected' });
    serviceMocks.begin.mockResolvedValue({
      claimed: true, claimToken: 'claim-1', attempt: { id: 'attempt-1', idempotencyKey: 'attempt-key-1' },
    });
    serviceMocks.complete.mockResolvedValue({ state: 'PAUSED' });

    await expect(processSmartLessonGenerationJob(
      { smartLessonGenerationJob: { findUnique: vi.fn(async () => context) } } as never,
      'job-1',
      vi.fn(async () => ({ serviceId: 'provider-1', providerKind: 'openai-compatible', model: 'qwen', generate })) as never,
    )).resolves.toEqual({ jobId: 'job-1', state: 'PAUSED' });

    expect(serviceMocks.beginCorrection).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      request: expect.objectContaining({
        correctionContext: expect.objectContaining({ expectedAggregateContextRef: contextRef }),
      }),
    }));
    expect(serviceMocks.complete).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      attemptId: 'attempt-correction-1',
      output: corrected,
    }));
  });

  it('marks a corrected schema-valid outline still missing post-assessment as retryable', async () => {
    const context = outlineJobContext();
    const generate = vi.fn(async () => ({
      output: outlineMissingPostAssessment(),
      normalizedResponseId: 'qwen-outline-still-incomplete',
    }));
    serviceMocks.begin.mockResolvedValue({
      claimed: true, claimToken: 'claim-1', attempt: { id: 'attempt-1', idempotencyKey: 'attempt-key-1' },
    });

    await expect(processSmartLessonGenerationJob(
      { smartLessonGenerationJob: { findUnique: vi.fn(async () => context) } } as never,
      'job-1',
      vi.fn(async () => ({ serviceId: 'provider-1', providerKind: 'openai-compatible', model: 'qwen', generate })) as never,
    )).resolves.toEqual({ jobId: 'job-1', state: 'RETRYABLE' });

    expect(generate).toHaveBeenCalledTimes(2);
    expect(serviceMocks.beginCorrection).toHaveBeenCalledTimes(1);
    expect(serviceMocks.fail).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      stage: 'OUTLINE',
      attemptId: 'attempt-correction-1',
      failureCode: 'provider-output-invalid-after-correction',
      retryable: true,
      validationReceipt: expect.objectContaining({
        valid: false,
        issues: [expect.objectContaining({ code: 'outline-stage-missing' })],
      }),
    }));
  });

  it('bounds correction when a generated source binding is not present in the same source pack', async () => {
    const outline = {
      keyContent: ['稳定性'], difficultContent: [], limitations: [], classAdaptation: null,
      coursewareStepOutline: [
        ['bridgeIn', 5], ['objectives', 5], ['preAssessment', 5], ['participatoryLearning', 5], ['postAssessment', 5], ['summary', 5],
      ].map(([bopppsStage, minutes]) => ({ title: String(bopppsStage), bopppsStage, minutes })),
    };
    const context = {
      id: 'job-1', ownerId: 'teacher-1', draftId: 'draft-1', state: 'RUNNING', firstIncompleteStage: 'BRIDGE_IN',
      stages: [
        { id: 'stage-outline', kind: 'OUTLINE', orderIndex: 0, state: 'COMPLETED', output: outline },
        { id: 'stage-bridge', kind: 'BRIDGE_IN', orderIndex: 1, state: 'PENDING', output: null },
      ],
      draft: { task: {
        courseBasis: { title: '自动控制原理' }, topic: '稳定性', audience: '本科生', prerequisites: '', durationMinutes: 30,
        aggregateClassContext: null, aggregateClassContextRef: null,
        sources: [{ sourceVersionId: 'version-1' }], knowledgePoints: [], goals: [],
      } },
    };
    const db = { smartLessonGenerationJob: { findUnique: vi.fn(async () => context) } };
    serviceMocks.begin.mockResolvedValue({
      claimed: true, claimToken: 'claim-1', attempt: { id: 'attempt-1', idempotencyKey: 'attempt-key-1' },
    });

    await expect(processSmartLessonGenerationJob(db as never, 'job-1', vi.fn(async () => ({
      serviceId: 'provider-1', providerKind: 'openai-compatible', model: 'model-1',
      generate: vi.fn(async () => ({
        output: {
          minutes: 5, teacherActivity: '讲授', studentActivity: '参与', assessment: '观察',
          steps: [{
            title: '导入', minutes: 5, teacherActivity: '展示', studentActivity: '回答', assessment: '提问',
            sourceBindings: [{
              citationId: 'citation:not-in-pack', sourceVersionId: 'version-1', anchor: 'other', contentHash: 'b'.repeat(64),
            }],
          }],
        },
        normalizedResponseId: 'response-1', inputTokens: 10, outputTokens: 20, costMicros: null,
      })),
    })) as never)).resolves.toEqual({ jobId: 'job-1', state: 'RETRYABLE' });

    expect(serviceMocks.fail).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      stage: 'BRIDGE_IN', attemptId: 'attempt-correction-1', retryable: true,
    }));
  });

  it('canonicalizes an otherwise exact source binding when the provider changes only its opaque citation id', async () => {
    const outline = {
      keyContent: ['稳定性'], difficultContent: [], limitations: [], classAdaptation: null,
      coursewareStepOutline: [
        ['bridgeIn', 5], ['objectives', 5], ['preAssessment', 5], ['participatoryLearning', 5], ['postAssessment', 5], ['summary', 5],
      ].map(([bopppsStage, minutes]) => ({ title: String(bopppsStage), bopppsStage, minutes })),
    };
    const context = {
      id: 'job-1', ownerId: 'teacher-1', draftId: 'draft-1', state: 'RUNNING', firstIncompleteStage: 'BRIDGE_IN',
      stages: [
        { id: 'stage-outline', kind: 'OUTLINE', orderIndex: 0, state: 'COMPLETED', output: outline },
        { id: 'stage-bridge', kind: 'BRIDGE_IN', orderIndex: 1, state: 'PENDING', output: null },
      ],
      draft: { task: {
        courseBasis: { title: '自动控制原理' }, topic: '稳定性', audience: '本科生', prerequisites: '', durationMinutes: 30,
        aggregateClassContext: null, aggregateClassContextRef: null,
        sources: [{ sourceVersionId: 'version-1' }], knowledgePoints: [], goals: [],
      } },
    };
    const db = { smartLessonGenerationJob: { findUnique: vi.fn(async () => context) } };
    serviceMocks.begin.mockResolvedValue({
      claimed: true, claimToken: 'claim-1', attempt: { id: 'attempt-1', idempotencyKey: 'attempt-key-1' },
    });
    serviceMocks.complete.mockResolvedValue({ state: 'PAUSED' });
    const generate = vi.fn(async () => ({
      output: {
        minutes: 5, teacherActivity: '讲授', studentActivity: '参与', assessment: '观察',
        steps: [{
          title: '导入', minutes: 5, teacherActivity: '展示', studentActivity: '回答', assessment: '提问',
          sourceBindings: [{
            citationId: 'provider-rephrased-citation', sourceVersionId: 'version-1', anchor: 'chapter-1', contentHash: 'a'.repeat(64),
          }],
        }],
      },
      normalizedResponseId: 'response-1', inputTokens: 10, outputTokens: 20, costMicros: null,
    }));

    await expect(processSmartLessonGenerationJob(db as never, 'job-1', vi.fn(async () => ({
      serviceId: 'provider-1', providerKind: 'openai-compatible', model: 'model-1',
      generate,
    })) as never)).resolves.toEqual({ jobId: 'job-1', state: 'PAUSED' });

    expect(serviceMocks.complete).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      output: expect.objectContaining({
        steps: [expect.objectContaining({
          sourceBindings: [expect.objectContaining({ citationId: sourcePackItem.citationTargetId })],
        })],
      }),
    }));
    expect(generate).toHaveBeenCalledWith(expect.objectContaining({ maxOutputTokens: 4096 }));
    expect(serviceMocks.complete).toHaveBeenCalledTimes(1);
    expect(serviceMocks.fail).not.toHaveBeenCalled();
  });

  it('records a zero-byte SiliconFlow timeout with a stable retryable failure code', async () => {
    const context = {
      id: 'job-1', ownerId: 'teacher-1', draftId: 'draft-1', state: 'QUEUED', firstIncompleteStage: 'OUTLINE',
      stages: [{ id: 'stage-1', kind: 'OUTLINE', orderIndex: 0, state: 'PENDING', output: null }],
      draft: { task: {
        courseBasis: { title: '自动控制原理' }, topic: '稳定性', audience: '本科生', prerequisites: '', durationMinutes: 30,
        aggregateClassContext: null, aggregateClassContextRef: null,
        sources: [{ sourceVersionId: 'version-1' }], knowledgePoints: [], goals: [],
      } },
    };
    const db = { smartLessonGenerationJob: { findUnique: vi.fn(async () => context) } };
    serviceMocks.begin.mockResolvedValue({
      claimed: true, claimToken: 'claim-1', attempt: { id: 'attempt-1', idempotencyKey: 'attempt-key-1' },
    });

    await expect(processSmartLessonGenerationJob(db as never, 'job-1', vi.fn(async () => ({
      serviceId: 'provider-1', providerKind: 'openai-compatible', model: 'model-1',
      generate: vi.fn(async () => { throw new Error('curl: (28) Operation timed out after 240000 milliseconds with 0 bytes received'); }),
    })) as never)).resolves.toEqual({ jobId: 'job-1', state: 'RETRYABLE' });

    expect(serviceMocks.fail).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      failureCode: 'provider-timeout', retryable: true,
    }));
  });

  it('rethrows the provider error when persisting the failed stage also fails', async () => {
    const context = outlineJobContext();
    const providerError = new Error('provider connection reset');
    serviceMocks.begin.mockResolvedValue({
      claimed: true, claimToken: 'claim-1', attempt: { id: 'attempt-1', idempotencyKey: 'attempt-key-1' },
    });
    serviceMocks.fail.mockRejectedValueOnce(new Error('database temporarily unavailable'));

    await expect(processSmartLessonGenerationJob(
      { smartLessonGenerationJob: { findUnique: vi.fn(async () => context) } } as never,
      'job-1',
      vi.fn(async () => ({
        serviceId: 'provider-1',
        providerKind: 'openai-compatible',
        model: 'model-1',
        generate: vi.fn(async () => { throw providerError; }),
      })) as never,
    )).rejects.toBe(providerError);

    expect(serviceMocks.fail).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      attemptId: 'attempt-1',
      retryable: true,
    }));
  });

  it('persists a permanent failure when selected governed source evidence is no longer available', async () => {
    const context = {
      id: 'job-1', ownerId: 'teacher-1', draftId: 'draft-1', state: 'QUEUED', firstIncompleteStage: 'OUTLINE',
      stages: [{ id: 'stage-1', kind: 'OUTLINE', orderIndex: 0, state: 'PENDING', output: null }],
      draft: { task: {
        courseBasis: { title: '自动控制原理' }, topic: '稳定性', audience: '本科生', prerequisites: '', durationMinutes: 30,
        aggregateClassContext: null, aggregateClassContextRef: null,
        sources: [{ sourceVersionId: 'version-retired' }], knowledgePoints: [], goals: [],
      } },
    };
    sourcePackMocks.pack.mockResolvedValue({ retrieval: { pack: { items: [] } } });
    const { db, tx } = persistenceDb(context);

    await expect(processSmartLessonGenerationJob(db as never, 'job-1', vi.fn(async () => ({
      serviceId: 'provider-1', providerKind: 'openai-compatible', model: 'model-1', generate: vi.fn(),
    })) as never)).resolves.toEqual({ jobId: 'job-1', state: 'FAILED' });

    expect(tx.smartLessonGenerationStage.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ state: 'FAILED' }),
    }));
    expect(tx.smartLessonGenerationJob.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ activeIdentity: 'draft:draft-1' }),
      data: expect.objectContaining({
        state: 'FAILED', failureCode: 'governed-source-evidence-unavailable', firstIncompleteStage: 'OUTLINE',
      }),
    }));
    expect(tx.smartLessonDraft.updateMany).toHaveBeenCalledWith({
      where: { id: 'draft-1', state: 'GENERATING' }, data: { state: 'EDITABLE' },
    });
    expect(serviceMocks.begin).not.toHaveBeenCalled();
  });

  it('persists a retryable failure when the provider attempt claim fails', async () => {
    const context = {
      id: 'job-1', ownerId: 'teacher-1', draftId: 'draft-1', state: 'QUEUED', firstIncompleteStage: 'OUTLINE',
      stages: [{ id: 'stage-1', kind: 'OUTLINE', orderIndex: 0, state: 'PENDING', output: null }],
      draft: { task: {
        courseBasis: { title: '自动控制原理' }, topic: '稳定性', audience: '本科生', prerequisites: '', durationMinutes: 30,
        aggregateClassContext: null, aggregateClassContextRef: null,
        sources: [{ sourceVersionId: 'version-1' }], knowledgePoints: [], goals: [],
      } },
    };
    serviceMocks.begin.mockRejectedValue(new Error('database temporarily unavailable'));
    const { db, tx } = persistenceDb(context);

    await expect(processSmartLessonGenerationJob(db as never, 'job-1', vi.fn(async () => ({
      serviceId: 'provider-1', providerKind: 'openai-compatible', model: 'model-1', generate: vi.fn(),
    })) as never)).resolves.toEqual({ jobId: 'job-1', state: 'RETRYABLE' });

    expect(tx.smartLessonGenerationStage.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ state: 'RETRYABLE' }),
    }));
    expect(tx.smartLessonGenerationJob.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ state: 'RETRYABLE', firstIncompleteStage: 'OUTLINE' }),
    }));
    expect(tx.smartLessonDraft.updateMany).toHaveBeenCalledWith({
      where: { id: 'draft-1', state: 'GENERATING' }, data: { state: 'EDITABLE' },
    });
  });

  it('does not let a stale worker unlock a draft owned by a newer job', async () => {
    const context = {
      id: 'job-old', ownerId: 'teacher-1', draftId: 'draft-1', state: 'QUEUED', firstIncompleteStage: 'OUTLINE',
      stages: [{ id: 'stage-old', kind: 'OUTLINE', orderIndex: 0, state: 'PENDING', output: null }],
      draft: { task: {
        courseBasis: { title: '自动控制原理' }, topic: '稳定性', audience: '本科生', prerequisites: '', durationMinutes: 30,
        aggregateClassContext: null, aggregateClassContextRef: null,
        sources: [{ sourceVersionId: 'version-1' }], knowledgePoints: [], goals: [],
      } },
    };
    sourcePackMocks.pack.mockResolvedValue({ retrieval: { pack: { items: [] } } });
    const { db, tx } = persistenceDb(context, 0);

    await processSmartLessonGenerationJob(db as never, 'job-old', vi.fn(async () => ({
      serviceId: 'provider-1', providerKind: 'openai-compatible', model: 'model-1', generate: vi.fn(),
    })) as never);

    expect(tx.smartLessonGenerationJob.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: 'job-old', activeIdentity: 'draft:draft-1' }),
    }));
    expect(tx.smartLessonGenerationStage.updateMany).not.toHaveBeenCalled();
    expect(tx.smartLessonDraft.updateMany).not.toHaveBeenCalled();
  });
});
