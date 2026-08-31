import { afterEach, describe, expect, it, vi } from 'vitest';
import { parseGradingPolicySeedConfig } from '../../../../scripts/assignments/ensure-grading-policies';

import * as gradingPersistence from '../math-document-grading-persistence';
import { buildGradingRequestHash, externalProcessingPolicyHash, sha256, stableStringify } from '../math-document-grading-contracts';

import {
  cancelQuestionGradingBatch,
  createQuestionScopedGradingBatch,
  processQuestionGradingBatch,
  retryQuestionGradingBatchItem,
} from '../math-document-grading-batch';

const now = new Date();

function requestIdempotencyRepository(rows: any[] = []) {
  return {
    findFirst: async ({ where }: any) => rows.find((row) => row.operation === where.operation
      && row.scope === where.scope
      && row.actorPseudoId === where.actorPseudoId
      && row.idempotencyKey === where.idempotencyKey) ?? null,
    create: async ({ data }: any) => {
      if (rows.some((row) => row.operation === data.operation
        && row.scope === data.scope
        && row.actorPseudoId === data.actorPseudoId
        && row.idempotencyKey === data.idempotencyKey)) {
        throw Object.assign(new Error('unique request idempotency key'), { code: 'P2002' });
      }
      const row = { id: `request:${rows.length + 1}`, ...data };
      rows.push(row);
      return row;
    },
    update: async ({ where, data }: any) => {
      const row = rows.find((candidate) => candidate.id === where.id);
      if (!row) throw new Error('request-idempotency-row-not-found');
      Object.assign(row, data);
      return row;
    },
  };
}

function questionRow() {
  return {
    id: 'question-1',
    assignmentRevisionId: 'revision-1',
    stableQuestionId: 'q1',
    responseType: 'SUBJECTIVE_TEXT',
    promptSnapshot: { text: 'Explain the stability evidence.' },
    answerSnapshot: { text: 'Cite the stability margin.' },
    rubricSnapshot: {
      schemaVersion: 'assignment-analytic-rubric.v1',
      criteria: [{ id: 'criterion-1', label: 'Evidence', maxPoints: 5, levels: [] }],
    },
    contentHash: 'sha256:question',
  };
}

function lifecyclePolicyRepository() {
  return {
    gradingLifecyclePolicy: {
      findMany: async ({ where }: any) => where.dataClass.in.map((dataClass: string) => ({ id: `lifecycle:${dataClass}:v1`, dataClass, version: 'v1', retentionSeconds: 3600, governedRecordRule: null, deleteStrategy: 'delete-content', providerRetentionSeconds: 0, enabled: true })),
    },
    gradingAuditEvent: { create: async () => ({ id: 'audit-test' }) },
  };
}

describe('question-scoped grading batch orchestration', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('freezes one revision/question/class scope, bounds eligible attempts, and replays the batch', async () => {
    const findManyCalls: any[] = [];
    const attempts = [
      { id: 'attempt-1', answerId: 'answer-1', answerVersion: 1 },
      { id: 'attempt-2', answerId: 'answer-2', answerVersion: 1 },
    ];
    let replay: any = null;
    const db = {
      ...lifecyclePolicyRepository(),
      assignmentQuestion: { findUnique: async () => ({ ...questionRow(), revision: { id: 'revision-1' } }) },
      class: { findUnique: async () => ({ id: 'class-1', teacherId: 'teacher-1', isActive: true }) },
      gradingBatch: {
        findUnique: async () => replay,
        create: async ({ data }: any) => ({ ...data, items: data.items.create }),
      },
      submissionAttempt: { findMany: async (args: any) => { findManyCalls.push(args); return attempts; } },
      gradingJob: { create: async ({ data }: any) => data },
    };

    await expect(createQuestionScopedGradingBatch({
      db,
      request: {
        assignmentRevisionId: 'revision-1',
        questionId: 'question-1',
        classId: 'class-1',
        actor: { id: 'teacher-2', role: 'TEACHER' },
        idempotencyKey: 'batch-request-001',
        evaluatorId: 'provider-1',
        evaluatorVersion: 'model.v1',
        now,
      },
    })).rejects.toThrow('batch-class-forbidden');

    const first = await createQuestionScopedGradingBatch({
      db,
      request: {
        assignmentRevisionId: 'revision-1',
        questionId: 'question-1',
        classId: 'class-1',
        actor: { id: 'teacher-1', role: 'TEACHER' },
        idempotencyKey: 'batch-request-001',
        evaluatorId: 'provider-1',
        evaluatorVersion: 'model.v1',
        maxItems: 2,
        now,
      },
    });
    expect(first.replay).toBe(false);
    expect(first.batch.totalItems).toBe(2);
    expect(first.batch.questionId).toBe('question-1');
    expect(first.batch.classId).toBe('class-1');
    expect(first.items).toHaveLength(2);
    expect(findManyCalls[0]).toMatchObject({
      distinct: ['answerId'],
      take: 2,
      orderBy: { submittedAt: 'desc' },
    });
    expect(findManyCalls[0].where).toEqual({
      answer: {
        assignmentQuestionId: 'question-1',
        state: 'SUBMITTED',
        submission: {
          assignmentRevisionId: 'revision-1',
          frozenAudienceClassId: 'class-1',
          state: { in: ['SUBMITTED', 'IN_PROGRESS'] },
        },
      },
      gradingRuns: { none: { state: { in: ['QUEUED', 'RUNNING', 'AWAITING_REVIEW', 'APPROVED'] } } },
    });
    replay = { ...first.batch, items: first.items, jobs: [first.batch.job] };
    const second = await createQuestionScopedGradingBatch({
      db,
      request: {
        assignmentRevisionId: 'revision-1',
        questionId: 'question-1',
        classId: 'class-1',
        actor: { id: 'teacher-1', role: 'TEACHER' },
        idempotencyKey: 'batch-request-001',
        evaluatorId: 'provider-1',
        evaluatorVersion: 'model.v1',
        now,
      },
    });
    expect(second.replay).toBe(true);
    expect(second.items).toHaveLength(2);
    expect(second.batch.job).toEqual(first.batch.job);

    replay = null;
    const third = await createQuestionScopedGradingBatch({
      db,
      request: {
        assignmentRevisionId: 'revision-1',
        questionId: 'question-1',
        classId: 'class-1',
        actor: { id: 'teacher-1', role: 'TEACHER' },
        idempotencyKey: 'batch-request-002',
        evaluatorId: 'provider-1',
        evaluatorVersion: 'model.v1',
        now,
      },
    });
    expect(third.items[0].id).not.toBe(first.items[0].id);

    replay = null;
    const rerun = await createQuestionScopedGradingBatch({
      db,
      request: {
        assignmentRevisionId: 'revision-1',
        questionId: 'question-1',
        classId: 'class-1',
        actor: { id: 'teacher-1', role: 'TEACHER' },
        idempotencyKey: 'batch-request-rerun-001',
        evaluatorId: 'provider-1',
        evaluatorVersion: 'model.v1',
        rerunReason: 'rebuild complete controlled sample set',
        maxItems: 2,
        now,
      },
    });
    expect(rerun.items).toHaveLength(2);
    expect(findManyCalls[3].where.gradingRuns).toBeUndefined();
  });

  it('treats an explicit empty attempt vector as zero candidates', async () => {
    const findManyCalls: any[] = [];
    const db: any = {
      ...lifecyclePolicyRepository(),
      assignmentQuestion: { findUnique: async () => ({ ...questionRow(), revision: { id: 'revision-1' } }) },
      class: { findUnique: async () => ({ id: 'class-1', teacherId: 'teacher-1', isActive: true }) },
      submissionAttempt: { findMany: async (args: any) => {
        findManyCalls.push(args);
        return args.where.id?.in?.length === 0 ? [] : [{ id: 'new-attempt', answerId: 'answer-1', answerVersion: 2 }];
      } },
      gradingBatch: { findUnique: async () => null, create: async ({ data }: any) => ({ ...data, items: data.items.create }) },
      gradingJob: { create: async ({ data }: any) => data },
    };

    const result = await createQuestionScopedGradingBatch({
      db,
      request: {
        assignmentRevisionId: 'revision-1',
        questionId: 'question-1',
        classId: 'class-1',
        actor: { id: 'teacher-1', role: 'TEACHER' },
        idempotencyKey: 'empty-attempt-vector',
        attemptIds: [],
        now,
      },
    });

    expect(findManyCalls[0].where.id).toEqual({ in: [] });
    expect(result.items).toEqual([]);
    expect(result.batch.totalItems).toBe(0);
  });

  it('replays a batch request by actor and key, then conflicts when its class payload changes', async () => {
    const batches: any[] = [];
    const jobs: any[] = [];
    const requestRows: any[] = [];
    const providerPolicy = {
      id: 'policy-1',
      provider: 'ai-evaluator',
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
      credentialRef: 'env:AI_PROVIDER_KEY',
    };
    const db: any = {
      ...lifecyclePolicyRepository(),
      assignmentQuestion: { findUnique: async () => ({ ...questionRow(), revision: { id: 'revision-1' } }) },
      class: { findUnique: async ({ where }: any) => ({ id: where.id, teacherId: 'teacher-1', isActive: true }) },
      gradingProviderPolicy: { findUnique: async () => providerPolicy },
      submissionAttempt: { findMany: async () => [] },
      gradingBatch: {
        findUnique: async ({ where }: any) => {
          const row = where.id ? batches.find((candidate) => candidate.id === where.id) : batches.find((candidate) => candidate.dedupeKey === where.dedupeKey);
          return row ? { ...row, items: row.items, jobs: jobs.filter((job) => job.batchId === row.id) } : null;
        },
        create: async ({ data }: any) => { const row = { ...data, items: data.items.create }; batches.push(row); return row; },
      },
      gradingJob: { create: async ({ data }: any) => { jobs.push(data); return data; } },
      gradingRequestIdempotency: requestIdempotencyRepository(requestRows),
      $transaction: async (callback: (tx: any) => Promise<unknown>) => callback(db),
    };
    const request = (classId: string) => createQuestionScopedGradingBatch({
      db,
      request: {
        assignmentRevisionId: 'revision-1',
        questionId: 'question-1',
        classId,
        actor: { id: 'teacher-1', role: 'TEACHER' },
        idempotencyKey: 'batch-request-001',
        policyId: 'policy-1',
        now,
      },
    });

    const first = await request('class-1');
    const replay = await request('class-1');
    expect(replay.replay).toBe(true);
    expect(replay.batch.id).toBe(first.batch.id);
    await expect(request('class-2')).rejects.toMatchObject({ code: 'idempotency-key-conflict', status: 409 });
    expect(batches).toHaveLength(1);
    expect(requestRows).toHaveLength(1);
    expect(batches[0].policySnapshot).toEqual(expect.objectContaining({ model: 'model.v1', classScope: ['class-1'] }));
    expect(batches[0].policySnapshotHash).toMatch(/^sha256:/);
  });

  it('freezes an independent conversion policy without sending the AI grading policy to document conversion', async () => {
    const aiPolicy = {
      id: 'policy-ai',
      provider: 'ai-evaluator',
      version: 'policy.ai.v1',
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
      credentialRef: 'env:AI_PROVIDER_KEY',
    };
    const conversionPolicy = {
      ...aiPolicy,
      id: 'policy-conversion',
      provider: 'mathpix',
      version: 'policy.mathpix.v1',
      model: null,
      endpoint: 'https://api.mathpix.com/v3/text',
      purpose: 'answer-conversion',
      credentialRef: 'env:MATHPIX_APP_KEY',
    };
    const visualPolicy = {
      ...aiPolicy,
      id: 'policy-visual',
      version: 'policy.visual.v1',
      model: 'vision-model.v1',
      purpose: 'visual-description',
      dataCategories: ['student-answer', 'student-answer-visual'],
      minimizedScope: ['selected-question', 'answer-evidence', 'visual-evidence'],
    };
    const batches: any[] = [];
    const requestRows: any[] = [];
    const db: any = {
      ...lifecyclePolicyRepository(),
      assignmentQuestion: { findUnique: async () => ({ ...questionRow(), revision: { id: 'revision-1' } }) },
      class: { findUnique: async () => ({ id: 'class-1', teacherId: 'teacher-1', isActive: true }) },
      gradingProviderPolicy: { findUnique: async ({ where }: any) => where.id === 'policy-ai' ? aiPolicy : where.id === 'policy-visual' ? visualPolicy : conversionPolicy },
      submissionAttempt: { findMany: async () => [] },
      gradingBatch: {
        findUnique: async ({ where }: any) => {
          const row = where.id ? batches.find((candidate) => candidate.id === where.id) : batches.find((candidate) => candidate.dedupeKey === where.dedupeKey);
          return row ? { ...row, items: row.items, jobs: [] } : null;
        },
        create: async ({ data }: any) => { const row = { ...data, items: [] }; batches.push(row); return row; },
      },
      gradingJob: { create: async ({ data }: any) => data },
      gradingRequestIdempotency: requestIdempotencyRepository(requestRows),
      $transaction: async (callback: (tx: any) => Promise<unknown>) => callback(db),
    };
    const request = (conversionPolicyId: string | null, visualPolicyId: string | null = 'policy-visual') => createQuestionScopedGradingBatch({
      db,
      request: { assignmentRevisionId: 'revision-1', questionId: 'question-1', classId: 'class-1', actor: { id: 'teacher-1', role: 'TEACHER' }, idempotencyKey: 'batch-policy-001', policyId: 'policy-ai', conversionPolicyId, visualPolicyId, now },
    });
    const first = await request('policy-conversion');
    expect(first.batch.policySnapshot).toEqual(expect.objectContaining({ provider: 'ai-evaluator', purpose: 'rubric-grading' }));
    expect(first.batch.conversionPolicySnapshot).toEqual(expect.objectContaining({ provider: 'mathpix', purpose: 'answer-conversion' }));
    expect(first.batch.visualPolicySnapshot).toEqual(expect.objectContaining({ provider: 'ai-evaluator', purpose: 'visual-description', model: 'vision-model.v1' }));
    expect(first.batch.policySnapshotHash).not.toBe(first.batch.conversionPolicySnapshotHash);
    await expect(request(null)).rejects.toMatchObject({ code: 'idempotency-key-conflict', status: 409 });
    await expect(request('policy-conversion', 'policy-ai')).rejects.toThrow('provider-policy-purpose-mismatch');
  });

  it('passes conversion policy to document jobs and retains grading policy for the AI run', async () => {
    const aiPolicy: any = { provider: 'ai-evaluator', version: 'ai.v1', model: 'model.v1', endpoint: 'https://ai.example/v1', purpose: 'rubric-grading', dataCategories: ['student-answer'], minimizedScope: ['selected-question', 'answer-evidence'], institutionScope: null, classScope: ['class-1'], processingRegion: 'CN', agreementVersion: 'agreement.v1', noTraining: true, providerRetentionSeconds: 0, deletionCapability: true, rateLimitPerMinute: 10, enabled: true, disabledAt: null, credentialRef: 'env:AI_PROVIDER_KEY' };
    const seededMathpix = parseGradingPolicySeedConfig(enabledPolicySeedEnv()).providers.filter((policy) => policy.provider === 'mathpix');
    const imagePolicy: any = seededMathpix.find((policy) => policy.endpoint?.endsWith('/v3/text'))!;
    const documentPolicy: any = seededMathpix.find((policy) => policy.endpoint?.endsWith('/v3/pdf'))!;
    const conversionBundle: any = { kind: 'mime-routed-answer-conversion.v1', image: { id: imagePolicy.id, snapshot: imagePolicy, snapshotHash: externalProcessingPolicyHash(imagePolicy) }, document: { id: documentPolicy.id, snapshot: documentPolicy, snapshotHash: externalProcessingPolicyHash(documentPolicy) } };
    const item: any = { id: 'item-policy-routing-image', attemptId: 'attempt-policy-routing-image', answerVersion: 1, questionSnapshotHash: 'sha256:question', rubricVersion: 'rubric.v1', evaluatorVersion: 'model.v1', state: 'QUEUED', retryCount: 0 };
    const documentItem: any = { ...item, id: 'item-policy-routing-document', attemptId: 'attempt-policy-routing-document' };
    const batch: any = {
      id: 'batch-policy-routing', state: 'QUEUED', totalItems: 2, progress: 0, completedItems: 0, failedItems: 0, blockedItems: 0, cancellationRequestedAt: null,
      assignmentRevisionId: 'revision-1', questionId: 'question-1', classId: 'class-1', questionSnapshotHash: 'sha256:question', rubricVersion: 'rubric.v1', evaluatorId: 'ai-evaluator', evaluatorVersion: 'model.v1',
      questionSnapshot: { assignmentRevisionId: 'revision-1', questionId: 'question-1', stableQuestionId: 'q1', responseType: 'SUBJECTIVE_FILE', prompt: 'Explain stability.', referenceAnswer: 'Cite the margin.', rubric: { schemaVersion: 'assignment-analytic-rubric.v1', id: 'rubric:question-1', version: 'rubric.v1', maxScore: 5, criteria: [] }, contentHash: 'sha256:question' },
      rubricSnapshot: {}, referenceAnswer: 'Cite the margin.', policyId: 'policy-ai', policySnapshot: aiPolicy, policySnapshotHash: externalProcessingPolicyHash(aiPolicy), policy: aiPolicy,
      conversionPolicyId: null, conversionPolicySnapshot: conversionBundle, conversionPolicySnapshotHash: sha256(stableStringify(conversionBundle)), conversionPolicy: null,
      items: [item, documentItem], question: {},
    };
    const evidence = {
      id: 'evidence-policy-routing',
      version: 1,
      sourceHash: 'sha256:evidence',
      readiness: 'READY',
      blocks: [{
        id: 'conversion-block',
        blockIndex: 0,
        pageNumber: 2,
        text: 'converted',
        markdown: 'converted',
        bbox: [0.1, 0.2, 0.3, 0.4],
        coordinateProvenance: { origin: 'top-left', unit: 'normalized' },
        precision: 'PAGE',
        confidence: 0.9,
      }],
    };
    const db: any = {
      gradingBatch: { findUnique: async () => batch, updateMany: async ({ data }: any) => { Object.assign(batch, data); return { count: 1 }; } },
      gradingBatchItem: { updateMany: async ({ where, data }: any) => { const target = where.id === documentItem.id ? documentItem : item; Object.assign(target, data); return { count: 1 }; }, update: async ({ where, data }: any) => { const target = where.id === documentItem.id ? documentItem : item; Object.assign(target, data); return target; }, groupBy: async () => [{ state: 'SUCCEEDED', _count: { _all: 2 } }] },
      gradingProviderPolicy: { findUnique: async ({ where }: any) => where.id === imagePolicy.id ? imagePolicy : documentPolicy },
      submissionAttempt: { findUnique: async ({ where }: any) => ({ id: where.id, answerVersion: 1, answer: { assets: [{ id: `asset-${where.id}`, mimeType: where.id === documentItem.attemptId ? 'application/pdf' : 'image/png' }], question: { contentHash: 'sha256:question' } } }) },
      answerEvidence: { findUnique: async () => null, findFirst: async () => null },
    };
    const conversion = vi.spyOn(gradingPersistence, 'enqueueDocumentConversion').mockImplementation(async (input: any) => ({
      conversion: { id: `conversion:${input.assetId}`, state: 'QUEUED' },
      job: { id: `conversion-job:${input.assetId}` },
      replay: false,
    }) as any);
    const conversionWorker = vi.spyOn(gradingPersistence, 'processDocumentConversionJob').mockImplementation(async ({ jobId }: any) =>
      jobId.includes(item.attemptId)
        ? {
            conversion: {
              id: 'conversion-policy-routing-image',
              state: 'FAILED',
              canonicalMarkdown: null,
              normalizedBlocks: [],
              failureCode: 'assignment-mathpix-only',
              warningCodes: ['understanding-unavailable-policy'],
            },
            evidence: null,
          } as any
        : {
            conversion: {
              id: 'conversion-policy-routing-document',
              state: 'SUCCEEDED',
              canonicalMarkdown: 'converted',
              normalizedBlocks: evidence.blocks,
              precision: 'PAGE',
              confidence: 0.9,
            },
            evidence,
          } as any);
    const materializeEvidence = vi.spyOn(gradingPersistence, 'materializeAssignmentAnswerEvidence').mockResolvedValue({ evidence, replay: false } as any);
    const grading = vi.spyOn(gradingPersistence, 'enqueueGradingRun').mockResolvedValue({ run: { id: 'run-policy-routing', inputHash: 'sha256:input', state: 'QUEUED' }, job: { id: 'grading-job-policy-routing' }, replay: false } as any);
    vi.spyOn(gradingPersistence, 'processGradingRunJob').mockResolvedValue({ run: { id: 'run-policy-routing', state: 'AWAITING_REVIEW' }, draft: {} } as any);
    await processQuestionGradingBatch({ db, batchId: batch.id, store: {} as any, mathpix: {} as any, now });
    expect(conversion).toHaveBeenCalledWith(expect.objectContaining({ policyId: imagePolicy.id, policySnapshot: expect.objectContaining({ endpoint: 'https://api.mathpix.com/v3/text' }), policySnapshotHash: externalProcessingPolicyHash(imagePolicy), allowDefaultPolicyDiscovery: false }));
    expect(conversion).toHaveBeenCalledWith(expect.objectContaining({ policyId: documentPolicy.id, policySnapshot: expect.objectContaining({ endpoint: 'https://api.mathpix.com/v3/pdf' }), policySnapshotHash: externalProcessingPolicyHash(documentPolicy), allowDefaultPolicyDiscovery: false }));
    expect(conversion).not.toHaveBeenCalledWith(expect.objectContaining({ policyId: 'policy-ai' }));
    expect(conversionWorker).toHaveBeenCalledWith(expect.objectContaining({ mathpix: expect.anything() }));
    expect(conversionWorker).toHaveBeenCalledWith(expect.objectContaining({ writeRendered: expect.any(Function) }));
    expect(conversionWorker).toHaveBeenCalledWith(expect.objectContaining({ persistEvidence: false }));
    expect(materializeEvidence).toHaveBeenNthCalledWith(1, expect.objectContaining({
      sourceManifest: expect.objectContaining({
        sources: expect.arrayContaining([
          expect.objectContaining({
            assetId: `asset-${item.attemptId}`,
            state: 'UNDERSTANDING_UNAVAILABLE_POLICY',
          }),
        ]),
      }),
    }));
    expect(materializeEvidence).toHaveBeenNthCalledWith(2, expect.objectContaining({
      normalized: expect.objectContaining({
        blocks: expect.arrayContaining([
          expect.objectContaining({
            pageNumber: 2,
            bbox: [0.1, 0.2, 0.3, 0.4],
            precision: 'page',
          }),
        ]),
      }),
    }));
    expect(grading).toHaveBeenCalledWith(expect.objectContaining({ policyId: 'policy-ai', policySnapshotHash: batch.policySnapshotHash }));
  });

  it('stops subsequent batch items when cancellation arrives during the first provider call', async () => {
    const itemOne: any = { id: 'item-cancel-first', attemptId: 'attempt-cancel-first', answerVersion: 1, questionSnapshotHash: 'sha256:question', rubricVersion: 'rubric.v1', evaluatorVersion: 'model.v1', evidenceId: 'evidence-cancel-first', state: 'QUEUED', retryCount: 0 };
    const itemTwo: any = { id: 'item-cancel-second', attemptId: 'attempt-cancel-second', answerVersion: 1, questionSnapshotHash: 'sha256:question', rubricVersion: 'rubric.v1', evaluatorVersion: 'model.v1', evidenceId: 'evidence-cancel-second', state: 'QUEUED', retryCount: 0 };
    const batch: any = {
      id: 'batch-cancel-during-provider', state: 'QUEUED', totalItems: 2, progress: 0, completedItems: 0, failedItems: 0, blockedItems: 0, cancellationRequestedAt: null,
      assignmentRevisionId: 'revision-1', questionId: 'question-1', classId: 'class-1', questionSnapshotHash: 'sha256:question', rubricVersion: 'rubric.v1', evaluatorId: 'configured-provider', evaluatorVersion: 'model.v1',
      questionSnapshot: { assignmentRevisionId: 'revision-1', questionId: 'question-1', stableQuestionId: 'q1', responseType: 'SUBJECTIVE_TEXT', prompt: 'Explain stability.', referenceAnswer: 'Cite the margin.', rubric: { schemaVersion: 'assignment-analytic-rubric.v1', id: 'rubric:question-1', version: 'rubric.v1', maxScore: 5, criteria: [] }, contentHash: 'sha256:question' },
      rubricSnapshot: {}, referenceAnswer: 'Cite the margin.', policyId: null, policySnapshot: null, policySnapshotHash: null, policy: null, conversionPolicyId: null, conversionPolicySnapshot: null, conversionPolicySnapshotHash: null, conversionPolicy: null,
      items: [itemOne, itemTwo], question: {},
    };
    const evidence = (id: string) => ({ id, version: 1, sourceHash: `sha256:${id}`, readiness: 'READY', blocks: [] });
    const items = [itemOne, itemTwo];
    const db: any = {
      gradingBatch: {
        findUnique: async () => batch,
        updateMany: async ({ data }: any) => { Object.assign(batch, data); return { count: 1 }; },
      },
      gradingBatchItem: {
        updateMany: async ({ where, data }: any) => {
          const matches = items.filter((item) => item.id === where.id
            && (where.workerClaimToken === undefined || item.workerClaimToken === where.workerClaimToken)
            && (!where.state || (where.state.in ? where.state.in.includes(item.state) : true))
            && (!where.AND || (!item.workerClaimedAt || !data.workerClaimedAt || item.workerClaimedAt < data.workerClaimedAt))
            && (!where.OR || where.OR.some((condition: any) => (condition.workerClaimToken === null && item.workerClaimToken == null) || (condition.workerClaimedAt?.lt && (!item.workerClaimedAt || item.workerClaimedAt < condition.workerClaimedAt.lt)) || (condition.workerClaimedAt?.gt && item.workerClaimedAt && item.workerClaimedAt > condition.workerClaimedAt.gt))));
          for (const item of matches) Object.assign(item, data);
          return { count: matches.length };
        },
        findUnique: async ({ where }: any) => items.find((item) => item.id === where.id) ?? null,
        groupBy: async () => [...new Set(items.map((item) => item.state))].map((state) => ({ state, _count: { _all: items.filter((item) => item.state === state).length } })),
      },
      submissionAttempt: {
        findUnique: async ({ where }: any) => ({ id: where.id, answerVersion: 1, textSnapshot: 'answer', answer: { assets: [], question: { contentHash: 'sha256:question' }, submission: { frozenAudienceClassId: 'class-1' } } }),
      },
      answerEvidence: { findUnique: async ({ where }: any) => evidence(where.id) },
    };
    const enqueue = vi.spyOn(gradingPersistence, 'enqueueGradingRun').mockResolvedValue({ run: { id: 'run-cancelled', inputHash: 'sha256:input', state: 'QUEUED' }, job: { id: 'job-cancelled' }, replay: false } as any);
    let providerCalls = 0;
    vi.spyOn(gradingPersistence, 'processGradingRunJob').mockImplementation(async () => {
      providerCalls += 1;
      batch.cancellationRequestedAt = now;
      return { run: { id: 'run-cancelled', state: 'CANCELLED' }, draft: {} } as any;
    });

    const result = await processQuestionGradingBatch({ db, batchId: batch.id, now });

    expect(providerCalls).toBe(1);
    expect(enqueue).toHaveBeenCalledTimes(1);
    expect(result.itemResults).toEqual(expect.arrayContaining([
      { itemId: itemOne.id, state: 'CANCELLED' },
      { itemId: itemTwo.id, state: 'CANCELLED' },
    ]));
  });

  it('blocks an active batch before any item provider call when its policy scope changed', async () => {
    const snapshot: any = {
      provider: 'ai-evaluator',
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
      credentialRef: 'env:AI_PROVIDER_KEY',
    };
    const batch: any = {
      id: 'batch-policy-frozen',
      state: 'QUEUED',
      totalItems: 1,
      progress: 0,
      cancellationRequestedAt: null,
      assignmentRevisionId: 'revision-1',
      questionId: 'question-1',
      classId: 'class-1',
      items: [],
      policyId: 'policy-1',
      policySnapshot: snapshot,
      policySnapshotHash: externalProcessingPolicyHash(snapshot),
      policy: { ...snapshot, endpoint: 'https://provider.example/v2' },
    };
    const db: any = {
      gradingBatch: { findUnique: async () => batch },
      gradingJob: { findUnique: async () => null },
    };

    await expect(processQuestionGradingBatch({ db, batchId: batch.id, now })).rejects.toThrow('provider-policy-snapshot-mismatch');
  });

  it('isolates cancellation and exposes bounded retry identity for an item', async () => {
    const updates: any[] = [];
    const batch = { id: 'batch-1', assignmentRevisionId: 'revision-1', questionId: 'question-1', classId: 'class-1', class: { teacherId: 'teacher-1' }, totalItems: 2, cancellationRequestedAt: now, items: [{ id: 'item-1' }, { id: 'item-2' }] };
    const db = {
      ...lifecyclePolicyRepository(),
      gradingBatch: {
        findUnique: async () => batch,
        update: async ({ data }: any) => { updates.push(data); return { ...batch, ...data }; },
      },
      gradingBatchItem: {
        updateMany: async ({ data }: any) => { updates.push(data); return { count: data.state === 'QUEUED' ? 1 : 2 }; },
        findUnique: async () => ({ id: 'item-1', batchId: 'batch-1', attemptId: 'attempt-1', retryCount: 0, state: 'FAILED' }),
        update: async ({ data }: any) => { updates.push(data); return data; },
      },
      gradingJob: { create: async ({ data }: any) => data },
    };
    const cancelled = await processQuestionGradingBatch({ db, batchId: 'batch-1', now });
    expect(cancelled.itemResults).toEqual([{ itemId: 'item-1', state: 'CANCELLED' }, { itemId: 'item-2', state: 'CANCELLED' }]);
    expect(updates[0]).toEqual(expect.objectContaining({ state: 'CANCELLED' }));

    const retry = await retryQuestionGradingBatchItem({ db, batchId: 'batch-1', itemId: 'item-1', actor: { id: 'teacher-1', role: 'TEACHER' }, idempotencyKey: 'retry-request-001', reason: 'provider timeout', now });
    expect(retry.rerunIdentity).toContain('rerun:retry:');
    expect(updates).toEqual(expect.arrayContaining([expect.objectContaining({ state: 'QUEUED' })]));
    const requested = await cancelQuestionGradingBatch({ db, batchId: 'batch-1', actor: { id: 'teacher-1', role: 'TEACHER' }, now });
    expect(requested.cancellationRequestedAt).toBe(now);
  });

  it('durably reserves item retries by actor and request hash, including reason conflicts and concurrent replay', async () => {
    const requestRows: any[] = [];
    const jobs: any[] = [];
    const reruns: any[] = [];
    const item: any = { id: 'item-idempotent', batchId: 'batch-idempotent', attemptId: 'attempt-1', retryCount: 0, state: 'FAILED' };
    const batch: any = { id: 'batch-idempotent', assignmentRevisionId: 'revision-1', classId: 'class-1', evaluatorVersion: 'model.v1', questionSnapshotHash: 'sha256:question', class: { teacherId: 'teacher-1' } };
    const db: any = {
      gradingBatch: { findUnique: async () => batch },
      gradingBatchItem: { findUnique: async () => item, update: async ({ data }: any) => { Object.assign(item, data); return item; } },
      gradingJob: {
        findUnique: async ({ where }: any) => jobs.find((job) => job.id === where.id || job.dedupeKey === where.dedupeKey) ?? null,
        create: async ({ data }: any) => { const job = { ...data }; jobs.push(job); return job; },
      },
      gradingRerun: { create: async ({ data }: any) => { reruns.push(data); return data; } },
      gradingAuditEvent: { create: async () => ({ id: 'audit-test' }) },
      gradingRequestIdempotency: requestIdempotencyRepository(requestRows),
      $transaction: async (callback: (tx: any) => Promise<unknown>) => callback(db),
    };
    const requestHash = buildGradingRequestHash('grading-batch-item-retry', { batchId: batch.id, itemId: item.id, reason: 'provider timeout' });
    const first = await retryQuestionGradingBatchItem({ db, batchId: batch.id, itemId: item.id, actor: { id: 'teacher-1', role: 'TEACHER' }, idempotencyKey: 'retry-idempotency-001', requestHash, reason: 'provider timeout', now });
    const replay = await retryQuestionGradingBatchItem({ db, batchId: batch.id, itemId: item.id, actor: { id: 'teacher-1', role: 'TEACHER' }, idempotencyKey: 'retry-idempotency-001', requestHash, reason: 'provider timeout', now });
    expect(replay.replay).toBe(true);
    expect(replay.job.id).toBe(first.job.id);
    await expect(retryQuestionGradingBatchItem({ db, batchId: batch.id, itemId: item.id, actor: { id: 'teacher-1', role: 'TEACHER' }, idempotencyKey: 'retry-idempotency-001', requestHash: buildGradingRequestHash('grading-batch-item-retry', { batchId: batch.id, itemId: item.id, reason: 'rubric correction' }), reason: 'rubric correction', now })).rejects.toMatchObject({ code: 'idempotency-key-conflict', status: 409 });
    item.state = 'FAILED';
    const otherActor = await retryQuestionGradingBatchItem({ db, batchId: batch.id, itemId: item.id, actor: { id: 'admin-1', role: 'ADMIN' }, idempotencyKey: 'retry-idempotency-001', requestHash, reason: 'provider timeout', now });
    expect(otherActor.replay).toBe(false);
    expect(otherActor.job.id).not.toBe(first.job.id);
    expect(requestRows).toHaveLength(2);
    expect(jobs).toHaveLength(2);
    expect(reruns).toHaveLength(2);
  });

  it('persists batch cancellation idempotency instead of accepting an unrecorded key', async () => {
    const requestRows: any[] = [];
    const updates: any[] = [];
    const batch: any = { id: 'batch-cancel-idempotent', assignmentRevisionId: 'revision-1', classId: 'class-1', state: 'RUNNING', class: { teacherId: 'teacher-1' } };
    const db: any = {
      gradingBatch: {
        findUnique: async () => batch,
        update: async ({ data }: any) => { Object.assign(batch, data); updates.push(data); return batch; },
      },
      gradingAuditEvent: { create: async () => ({ id: 'audit-test' }) },
      gradingRequestIdempotency: requestIdempotencyRepository(requestRows),
      $transaction: async (callback: (tx: any) => Promise<unknown>) => callback(db),
    };
    const requestHash = buildGradingRequestHash('grading-batch-cancel', { batchId: batch.id });
    await cancelQuestionGradingBatch({ db, batchId: batch.id, actor: { id: 'teacher-1', role: 'TEACHER' }, idempotencyKey: 'cancel-idempotency-001', requestHash, now });
    await cancelQuestionGradingBatch({ db, batchId: batch.id, actor: { id: 'teacher-1', role: 'TEACHER' }, idempotencyKey: 'cancel-idempotency-001', requestHash, now });
    expect(requestRows).toHaveLength(1);
    expect(updates).toHaveLength(1);
  });

  it('converges an isolated item failure into durable batch progress and FAILED state', async () => {
    const updates: any[] = [];
    const item: any = { id: 'item-failed-1', attemptId: 'missing-attempt', state: 'QUEUED', retryCount: 5 };
    const db: any = {
      gradingBatch: {
        findUnique: async () => ({ id: 'batch-failed-1', state: 'QUEUED', assignmentRevisionId: 'revision-1', questionId: 'question-1', classId: 'class-1', totalItems: 1, progress: 0, cancellationRequestedAt: null, items: [item], question: {}, policy: null }),
        update: async ({ data }: any) => { updates.push(data); return data; },
      },
      submissionAttempt: { findUnique: async () => null },
      gradingBatchItem: {
        updateMany: async ({ where, data }: any) => {
          if (where.workerClaimToken !== undefined && item.workerClaimToken !== where.workerClaimToken) return { count: 0 };
          Object.assign(item, data);
          updates.push(data);
          return { count: 1 };
        },
        update: async ({ data }: any) => { Object.assign(item, data); updates.push(data); return item; },
        groupBy: async () => [{ state: item.state, _count: { _all: 1 } }],
      },
    };
    const result = await processQuestionGradingBatch({ db, batchId: 'batch-failed-1', now });
    expect(result.batch).toEqual(expect.objectContaining({ state: 'BLOCKED', progress: 100 }));
    expect(result.itemResults).toEqual([{ itemId: 'item-failed-1', state: 'BLOCKED', error: 'batch-item-content-unavailable:attempt-not-found' }]);
    expect(updates).toEqual(expect.arrayContaining([expect.objectContaining({ state: 'BLOCKED', progress: 100 })]));
  });

  it('converges a stale retryable batch delivery when the persisted batch is terminal', async () => {
    const updates: any[] = [];
    const db: any = {
      gradingBatch: {
        findUnique: async () => ({ id: 'batch-terminal-1', state: 'PARTIAL', items: [], totalItems: 1 }),
      },
      gradingJob: {
        findUnique: async () => ({ id: 'job-terminal-1', state: 'RETRYABLE' }),
        update: async ({ data }: any) => { updates.push(data); return data; },
      },
    };

    const result = await processQuestionGradingBatch({ db, batchId: 'batch-terminal-1', jobId: 'job-terminal-1', now });
    expect(result.itemResults).toEqual([]);
    expect(updates).toEqual(expect.arrayContaining([
      expect.objectContaining({ state: 'SUCCEEDED', progress: 100, lastErrorCode: 'batch-partial' }),
    ]));
  });

  it('fences a batch worker when retention marks the parent unavailable', async () => {
    const db: any = {
      gradingBatch: {
        findUnique: async () => ({
          id: 'batch-gc-1',
          state: 'RUNNING',
          totalItems: 1,
          progress: 0,
          cancellationRequestedAt: null,
          assignmentRevisionId: 'revision-1',
          questionId: 'question-1',
          classId: 'class-1',
          items: [],
        }),
        updateMany: async ({ where }: any) => {
          expect(where).toEqual({ id: 'batch-gc-1', state: { in: ['QUEUED', 'RUNNING', 'RETRYABLE'] } });
          return { count: 0 };
        },
        update: async () => { throw new Error('unconditional-batch-update'); },
      },
      gradingJob: {
        findUnique: async () => ({ id: 'job-gc-1', state: 'RUNNING' }),
      },
    };

    await expect(processQuestionGradingBatch({ db, batchId: 'batch-gc-1', jobId: 'job-gc-1', now }))
      .rejects.toThrow('batch-worker-fenced');
  });

  it.each([
    { state: 'PARTIAL', siblingState: 'FAILED' },
    { state: 'FAILED', siblingState: null },
    { state: 'BLOCKED', siblingState: null },
  ])('consumes a retry job for a $state batch item instead of returning at the terminal batch gate', async ({ state, siblingState }) => {
    const item = {
      id: `item-retry-${state.toLowerCase()}`,
      batchId: `batch-retry-${state.toLowerCase()}`,
      attemptId: 'attempt-retry-1',
      answerVersion: 1,
      questionSnapshotHash: 'sha256:question',
      rubricVersion: 'rubric.v1',
      evaluatorVersion: 'model.v1',
      evidenceId: null,
      evidenceHash: null,
      evidenceVersion: null,
      state: 'QUEUED',
      retryCount: 1,
      progress: 0,
    };
    const items = [item];
    if (siblingState) items.push({ ...item, id: `${item.id}-sibling`, state: siblingState });
    const batch: any = {
      id: item.batchId,
      state,
      totalItems: items.length,
      progress: 100,
      completedItems: 0,
      failedItems: state === 'FAILED' ? 1 : 0,
      blockedItems: state === 'BLOCKED' ? 1 : 0,
      cancellationRequestedAt: null,
      assignmentRevisionId: 'revision-1',
      questionId: 'question-1',
      classId: 'class-1',
      questionSnapshotHash: 'sha256:question',
      rubricVersion: 'rubric.v1',
      evaluatorId: 'provider-1',
      evaluatorVersion: 'model.v1',
      questionSnapshot: {
        assignmentRevisionId: 'revision-1',
        questionId: 'question-1',
        stableQuestionId: 'q1',
        responseType: 'SUBJECTIVE_TEXT',
        prompt: 'Explain the stability evidence.',
        referenceAnswer: 'Cite the stability margin.',
        rubric: { schemaVersion: 'assignment-analytic-rubric.v1', id: 'rubric:question-1', version: 'rubric.v1', maxScore: 5, criteria: [] },
        contentHash: 'sha256:question',
      },
      rubricSnapshot: {},
      referenceAnswer: 'Cite the stability margin.',
      policyId: null,
      rerunReason: null,
      items,
      question: {},
      policy: null,
    };
    const job: any = { id: `job-retry-${state.toLowerCase()}`, state: 'QUEUED' };
    const evidence = {
      id: 'evidence-retry-1',
      version: 1,
      sourceHash: 'sha256:evidence',
      readiness: 'READY',
      anchorVersion: 'assignment-answer-evidence.v2',
      blocks: [],
    };
    const updates: any[] = [];
    const db: any = {
      gradingBatch: {
        findUnique: async () => batch,
        update: async ({ data }: any) => { Object.assign(batch, data); updates.push(data); return batch; },
      },
      gradingJob: {
        findUnique: async () => job,
        updateMany: async ({ data }: any) => { Object.assign(job, data); updates.push(data); return { count: 1 }; },
        update: async ({ data }: any) => { Object.assign(job, data); updates.push(data); return job; },
      },
      gradingBatchItem: {
        updateMany: async ({ where, data }: any) => {
          const target = items.find((candidate) => candidate.id === where.id);
          if (!target || (where.workerClaimToken !== undefined && (target as any).workerClaimToken !== where.workerClaimToken)) return { count: 0 };
          Object.assign(target, data);
          updates.push(data);
          return { count: 1 };
        },
        update: async ({ where, data }: any) => {
          const target = items.find((candidate) => candidate.id === where.id);
          if (!target) throw new Error('batch-test-item-not-found');
          Object.assign(target, data);
          updates.push(data);
          return target;
        },
        groupBy: async () => {
          const counts = new Map<string, number>();
          for (const candidate of items) counts.set(candidate.state, (counts.get(candidate.state) ?? 0) + 1);
          return [...counts.entries()].map(([candidateState, count]) => ({ state: candidateState, _count: { _all: count } }));
        },
      },
      submissionAttempt: {
        findUnique: async () => ({ id: 'attempt-retry-1', answerVersion: 1, answer: { question: { contentHash: 'sha256:question' }, assets: [{ id: 'asset-retry-1', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', originalName: 'answer.docx' }] } }),
      },
      answerEvidence: {
        findUnique: async () => evidence,
        findFirst: async () => evidence,
      },
    };
    vi.spyOn(gradingPersistence, 'enqueueGradingRun').mockResolvedValue({ run: { id: 'run-retry-1', inputHash: 'sha256:input', state: 'QUEUED' }, job: { id: 'grading-job-1' }, replay: false } as any);
    vi.spyOn(gradingPersistence, 'processGradingRunJob').mockResolvedValue({ run: { id: 'run-retry-1', state: 'AWAITING_REVIEW' }, draft: {} } as any);

    const result = await processQuestionGradingBatch({ db, batchId: batch.id, jobId: job.id, itemId: item.id, now });

    expect(result.itemResults).toEqual([{ itemId: item.id, state: 'SUCCEEDED' }]);
    expect(gradingPersistence.enqueueGradingRun).toHaveBeenCalledTimes(1);
    expect(item.state).toBe('SUCCEEDED');
    expect(updates).toEqual(expect.arrayContaining([expect.objectContaining({ state: 'SUCCEEDED', progress: 100 })]));
  });

  it('creates independent explicit batch reruns for the same reason under different idempotency keys', async () => {
    const batches: any[] = [];
    const jobs: any[] = [];
    const reruns: any[] = [];
    const db: any = {
      ...lifecyclePolicyRepository(),
      assignmentQuestion: { findUnique: async () => ({ ...questionRow(), revision: { id: 'revision-1' } }) },
      class: { findUnique: async () => ({ id: 'class-1', teacherId: 'teacher-1', isActive: true }) },
      submissionAttempt: { findMany: async () => [] },
      gradingBatch: {
        findUnique: async ({ where }: any) => {
          const existing = batches.find((candidate) => candidate.dedupeKey === where.dedupeKey);
          return existing ? { ...existing, items: existing.items, jobs: jobs.filter((job) => job.batchId === existing.id) } : null;
        },
        create: async ({ data }: any) => {
          const row = { ...data, items: data.items.create };
          batches.push(row);
          return row;
        },
      },
      gradingJob: { create: async ({ data }: any) => { jobs.push(data); return data; } },
      gradingRerun: { create: async ({ data }: any) => { reruns.push(data); return data; } },
    };
    const request = (idempotencyKey: string) => ({
      assignmentRevisionId: 'revision-1',
      questionId: 'question-1',
      classId: 'class-1',
      actor: { id: 'teacher-1', role: 'TEACHER' as const },
      idempotencyKey,
      rerunReason: 'provider timeout',
      now,
    });

    const first = await createQuestionScopedGradingBatch({ db, request: request('batch-rerun-a') });
    const replay = await createQuestionScopedGradingBatch({ db, request: request('batch-rerun-a') });
    const second = await createQuestionScopedGradingBatch({ db, request: request('batch-rerun-b') });

    expect(replay.replay).toBe(true);
    expect(second.replay).toBe(false);
    expect(second.batch.id).not.toBe(first.batch.id);
    expect(new Set(reruns.map((rerun) => rerun.id)).size).toBe(2);
    expect(first.batch.job.rerunIdentity).toContain('rerun:batch:');
    expect(second.batch.job.rerunIdentity).toContain('rerun:batch:');
    expect(first.batch.job.reason).toBe('provider timeout');
    expect(second.batch.job.reason).toBe('provider timeout');
    expect(reruns).toEqual(expect.arrayContaining([
      expect.objectContaining({ batchId: first.batch.id, gradingJobId: first.batch.job.id, reason: 'provider timeout' }),
      expect.objectContaining({ batchId: second.batch.id, gradingJobId: second.batch.job.id, reason: 'provider timeout' }),
    ]));
  });

  it('fences duplicate batch deliveries at item claim and does not let the loser alter aggregate state', async () => {
    const item: any = {
      id: 'item-concurrent-1',
      batchId: 'batch-concurrent-1',
      attemptId: 'attempt-concurrent-1',
      answerId: 'answer-concurrent-1',
      answerVersion: 1,
      questionSnapshotHash: 'sha256:question',
      rubricVersion: 'rubric.v1',
      evaluatorVersion: 'model.v1',
      state: 'QUEUED',
      retryCount: 0,
      progress: 0,
      workerClaimToken: null,
      workerClaimedAt: null,
    };
    const batch: any = {
      id: item.batchId,
      state: 'QUEUED',
      totalItems: 1,
      progress: 0,
      completedItems: 0,
      failedItems: 0,
      blockedItems: 0,
      cancellationRequestedAt: null,
      assignmentRevisionId: 'revision-1',
      questionId: 'question-1',
      classId: 'class-1',
      questionSnapshotHash: 'sha256:question',
      rubricVersion: 'rubric.v1',
      evaluatorId: 'provider-1',
      evaluatorVersion: 'model.v1',
      questionSnapshot: {
        assignmentRevisionId: 'revision-1',
        questionId: 'question-1',
        stableQuestionId: 'q1',
        responseType: 'SUBJECTIVE_TEXT',
        prompt: 'Explain stability.',
        referenceAnswer: 'Cite the margin.',
        rubric: { schemaVersion: 'assignment-analytic-rubric.v1', id: 'rubric:question-1', version: 'rubric.v1', maxScore: 5, criteria: [] },
        contentHash: 'sha256:question',
      },
      rubricSnapshot: {},
      referenceAnswer: 'Cite the margin.',
      policyId: null,
      policy: null,
      items: [item],
    };
    const evidence = { id: 'evidence-concurrent-1', version: 1, sourceHash: 'sha256:evidence', readiness: 'READY', blocks: [] };
    const aggregateWrites: any[] = [];
    const itemWrites: any[] = [];
    const db: any = {
      gradingBatch: {
        findUnique: async () => batch,
        updateMany: async ({ data }: any) => { aggregateWrites.push(data); Object.assign(batch, data); return { count: 1 }; },
      },
      gradingBatchItem: {
        updateMany: async ({ where, data }: any) => {
          const claimable = item.state === 'QUEUED' && !item.workerClaimToken && !where.workerClaimToken;
          const ownsItem = Boolean(where.workerClaimToken) && where.workerClaimToken === item.workerClaimToken;
          if ((!claimable && !ownsItem) || where.id !== item.id) return { count: 0 };
          Object.assign(item, data);
          itemWrites.push({ where, data });
          return { count: 1 };
        },
        update: async ({ data }: any) => { Object.assign(item, data); itemWrites.push(data); return item; },
        findUnique: async () => item,
        groupBy: async () => [{ state: item.state, _count: { _all: 1 } }],
      },
      submissionAttempt: {
        findUnique: async () => ({
          id: item.attemptId,
          answerId: item.answerId,
          answerVersion: 1,
          textSnapshot: 'stability evidence',
          answer: { assets: [], question: { contentHash: 'sha256:question' } },
        }),
      },
    };
    vi.spyOn(gradingPersistence, 'materializeTextAnswerEvidence').mockResolvedValue({ evidence, replay: false });
    vi.spyOn(gradingPersistence, 'enqueueGradingRun').mockResolvedValue({ run: { id: 'run-concurrent-1', inputHash: 'sha256:input', state: 'QUEUED' }, job: { id: 'grading-job-concurrent-1' }, replay: false } as any);
    vi.spyOn(gradingPersistence, 'processGradingRunJob').mockResolvedValue({ run: { id: 'run-concurrent-1', state: 'AWAITING_REVIEW' }, draft: {} } as any);

    const results = await Promise.all([
      processQuestionGradingBatch({ db, batchId: batch.id, now }),
      processQuestionGradingBatch({ db, batchId: batch.id, now }),
    ]);

    expect(gradingPersistence.enqueueGradingRun).toHaveBeenCalledTimes(1);
    expect(results.flatMap((result) => result.itemResults).filter((result) => result.state === 'FAILED')).toHaveLength(0);
    expect(itemWrites.filter((write) => write.state === 'FAILED')).toHaveLength(0);
    expect(aggregateWrites.filter((write) => write.state === 'FAILED')).toHaveLength(0);
  });

  it('passes retry job identity and reason into a new grading run identity', async () => {
    const item: any = { id: 'item-rerun-identity', batchId: 'batch-rerun-identity', attemptId: 'attempt-rerun-identity', answerVersion: 1, questionSnapshotHash: 'sha256:question', rubricVersion: 'rubric.v1', evaluatorVersion: 'model.v1', evidenceId: 'evidence-rerun-identity', evidenceHash: 'sha256:evidence', evidenceVersion: 1, state: 'QUEUED', retryCount: 1, progress: 0 };
    const batch: any = {
      id: item.batchId, state: 'PARTIAL', totalItems: 1, progress: 100, completedItems: 0, failedItems: 1, blockedItems: 0, cancellationRequestedAt: null,
      assignmentRevisionId: 'revision-1', questionId: 'question-1', classId: 'class-1', questionSnapshotHash: 'sha256:question', rubricVersion: 'rubric.v1', evaluatorId: 'provider-1', evaluatorVersion: 'model.v1',
      questionSnapshot: { assignmentRevisionId: 'revision-1', questionId: 'question-1', stableQuestionId: 'q1', responseType: 'SUBJECTIVE_TEXT', prompt: 'Explain stability.', referenceAnswer: 'Cite the margin.', rubric: { schemaVersion: 'assignment-analytic-rubric.v1', id: 'rubric:question-1', version: 'rubric.v1', maxScore: 5, criteria: [] }, contentHash: 'sha256:question' },
      rubricSnapshot: {}, referenceAnswer: 'Cite the margin.', policyId: null, policy: null, rerunReason: null, items: [item],
    };
    const evidence = { id: item.evidenceId, version: 1, sourceHash: item.evidenceHash, readiness: 'READY', blocks: [] };
    const retryJobUpdates: any[] = [];
    const db: any = {
      gradingBatch: { findUnique: async () => batch, updateMany: async ({ data }: any) => { Object.assign(batch, data); return { count: 1 }; } },
      gradingJob: { findUnique: async () => ({ id: 'retry-job-identity', kind: 'RETRY', state: 'QUEUED', batchId: batch.id, batchItemId: item.id, rerunIdentity: 'rerun:retry:job-identity', reason: 'provider timeout' }), updateMany: async ({ data }: any) => { retryJobUpdates.push(data); return { count: 1 }; } },
      gradingBatchItem: { updateMany: async ({ data }: any) => { Object.assign(item, data); return { count: 1 }; }, update: async ({ data }: any) => { Object.assign(item, data); return item; }, groupBy: async () => [{ state: item.state, _count: { _all: 1 } }] },
      submissionAttempt: { findUnique: async () => ({ id: item.attemptId, answerVersion: 1, textSnapshot: 'stability evidence', answer: { question: { contentHash: 'sha256:question' }, assets: [] } }) },
      answerEvidence: { findUnique: async () => evidence },
    };
    const enqueue = vi.spyOn(gradingPersistence, 'enqueueGradingRun').mockResolvedValue({ run: { id: 'new-run-identity', inputHash: 'sha256:new-input', state: 'QUEUED' }, job: null, replay: false } as any);

    await processQuestionGradingBatch({ db, batchId: batch.id, jobId: 'retry-job-identity', itemId: item.id, now });

    expect(enqueue).toHaveBeenCalledWith(expect.objectContaining({
      idempotencyKey: expect.stringContaining('rerun:retry:job-identity'),
      rerunReason: expect.stringContaining('provider timeout'),
    }));
    expect(item.state).toBe('FAILED');
    expect(retryJobUpdates).toEqual(expect.arrayContaining([
      expect.objectContaining({ state: 'FAILED', workerClaimToken: null, completedAt: expect.any(Date) }),
    ]));
  });
});

function enabledPolicySeedEnv(): Record<string, string> {
  const env: Record<string, string> = {
    NODE_ENV: 'test', MATH_DOCUMENT_GRADING_WORKER_REQUIRED: 'true',
    AI_PROVIDER: 'siliconflow', AI_BASE_URL: 'https://api.siliconflow.cn/v1', AI_SECRET_REF: 'env:AI_API_KEY', AI_MODEL: 'model.v1',
    MATHPIX_IMAGE_ENDPOINT: 'https://api.mathpix.com/v3/text', MATHPIX_DOCUMENT_ENDPOINT: 'https://api.mathpix.com/v3/pdf', MATHPIX_CREDENTIAL_REF: 'env:MATHPIX_APP_KEY',
    GRADING_PROVIDER_PROCESSING_REGION: 'CN', GRADING_PROVIDER_AGREEMENT_VERSION: 'agreement.v1', GRADING_PROVIDER_NO_TRAINING: 'true', GRADING_PROVIDER_RETENTION_SECONDS: '0', GRADING_PROVIDER_DELETION_CAPABILITY: 'true', GRADING_PROVIDER_RATE_LIMIT_PER_MINUTE: '10', GRADING_PROVIDER_CLASS_SCOPE: '*',
    GRADING_AI_PROVIDER_VERSION: 'ai.v1', GRADING_AI_PROVIDER_ENABLED: 'true', GRADING_MATHPIX_POLICY_VERSION: 'mathpix.v1', GRADING_MATHPIX_ENABLED: 'true',
  };
  for (const prefix of ['SOURCE_ASSET', 'ANSWER_EVIDENCE', 'DOCUMENT_CONVERSION', 'AI_DRAFT', 'RUN']) {
    env[`GRADING_${prefix}_POLICY_VERSION`] = 'v1'; env[`GRADING_${prefix}_RETENTION_SECONDS`] = '3600'; env[`GRADING_${prefix}_DELETE_STRATEGY`] = 'delete-content'; env[`GRADING_${prefix}_PROVIDER_RETENTION_SECONDS`] = '0'; env[`GRADING_${prefix}_ENABLED`] = 'true';
  }
  return env;
}
