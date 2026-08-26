import { describe, expect, it, vi } from 'vitest';

import {
  buildGradingRequestHash,
  buildPipelineDedupeKey,
  buildRerunIdentity,
  externalProcessingPolicyHash,
  gradingRequestScope,
  normalizeDocumentEvidence,
  pseudonymousAuditId,
  sha256,
  stableStringify,
} from '../math-document-grading-contracts';
import { MemorySubmissionObjectStore } from '@/lib/assignments/submission-object-store';
import { ConversionLeaseLostError, convertProtectedSubmission } from '../math-document-conversion';
import {
  buildConversionLayoutRepresentation,
  cancelDocumentConversion,
  buildPersistedAnswerEvidenceBlocks,
  evidenceFromRow,
  enqueueDocumentConversion,
  enqueueGradingRun,
  materializeAssignmentAnswerEvidence,
  materializeTextAnswerEvidence,
  persistValidatedGradingDraft,
  processDocumentConversionJob,
  processGradingRunJob,
  retryDocumentConversion,
  withGradingRequestIdempotency,
  writeRenderedObjectToSubmissionStore,
} from '../math-document-grading-persistence';
import type { ExternalProcessingPolicy } from '../math-document-grading-contracts';

const now = new Date();

function gradingPolicy(overrides: Record<string, unknown> = {}) {
  return {
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
    ...overrides,
  };
}

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

function submittedAttempt() {
  return {
    id: 'attempt-1',
    answerId: 'answer-1',
    answerVersion: 3,
    textSnapshot: '第一段证据。\n\n第二段稳定性说明。',
    answer: {
      assets: [],
      question: {
        id: 'question-1',
        assignmentRevisionId: 'revision-1',
        stableQuestionId: 'q1',
        responseType: 'SUBJECTIVE_TEXT',
        promptSnapshot: { text: 'Explain stability.' },
        answerSnapshot: { text: 'Cite the margin.' },
        rubricSnapshot: {
          schemaVersion: 'assignment-analytic-rubric.v1',
          criteria: [{ id: 'criterion-1', label: 'Evidence', goalDimension: 'controlModeling', maxPoints: 5, levels: [] }],
        },
        contentHash: 'sha256:question',
      },
      submission: {
        studentId: 'student-1',
        frozenStudentId: 'student-1',
        frozenAudienceClassId: 'class-1',
        audience: { classId: 'class-1', class: { teacherId: 'teacher-1' } },
      },
    },
  };
}

function lifecyclePolicyRepository() {
  return {
    assignmentRevision: {
      findUnique: async () => ({ assignment: { courseContext: 'course-1' } }),
    },
    gradingLifecyclePolicy: {
      findMany: async ({ where }: any) => where.dataClass.in.map((dataClass: string) => ({ id: `lifecycle:${dataClass}:v1`, dataClass, version: 'v1', retentionSeconds: 3600, governedRecordRule: null, deleteStrategy: 'delete-content', providerRetentionSeconds: 0, enabled: true })),
    },
    gradingAuditEvent: { create: async () => ({ id: 'audit-test' }) },
  };
}

describe('production math-document grading persistence contracts', () => {
  it('persists question-scoped PDF region evidence without discarding coordinate provenance', () => {
    const normalized = normalizeDocumentEvidence({
      sourceHash: 'sha256:layout',
      markdown: 'T1-1 answer',
      blocks: [{
        id: 'word-block-1', blockIndex: 0, questionId: 'T1-1', pageNumber: 2, text: 'T1-1 answer',
        bbox: [20, 620, 160, 636],
        coordinateProvenance: { origin: 'BOTTOM_LEFT', unit: 'PDF_POINT', pageWidth: 612, pageHeight: 792, rotation: 0 },
        precision: 'page', confidence: 0.96,
      }],
    });
    const rows = buildPersistedAnswerEvidenceBlocks({ normalized, conversionId: 'conversion-layout', evidenceId: 'evidence-layout', sourceHash: normalized.sourceHash, now });

    expect(rows).toEqual([expect.objectContaining({
      questionId: 'T1-1', pageNumber: 2, bbox: [20, 620, 160, 636],
      coordinateProvenance: { origin: 'BOTTOM_LEFT', unit: 'PDF_POINT', pageWidth: 612, pageHeight: 792, rotation: 0 },
    })]);
  });

  it('builds a replayable Word layout with immutable PDF identity and selected region evidence', () => {
    const layout = buildConversionLayoutRepresentation({
      wordRepresentation: {
        sourceFormat: 'docx', renderedPdfChecksum: 'sha256:rendered', renderedPdfPageCount: 2,
        extractorVersion: 'word-layout.v1', rendererVersion: 'LibreOffice 24.2.0.3',
        blocks: [{ id: 'word-block-1', questionId: 'T1-1', pageNumber: 2, bbox: [20, 620, 160, 636], confidence: 0.96 }],
        paragraphs: [{ id: 'word-paragraph-1', paragraphIndex: 0, questionId: 'T1-1', introducesQuestion: true }],
        formulas: [{ id: 'formula-1', paragraphId: 'word-paragraph-1', questionId: 'T1-1', text: 'x=1', omml: '<m:oMath />' }],
        images: [],
        anchors: [{ blockId: 'word-block-1', paragraphId: 'word-paragraph-1', questionId: 'T1-1', pdfPageNumber: 2, bbox: [20, 620, 160, 636], coordinateProvenance: { origin: 'BOTTOM_LEFT', unit: 'PDF_POINT', pageWidth: 612, pageHeight: 792, rotation: 0 }, precision: 'page', mappingDecision: 'pdf-text-region-match', mappingConfidence: 0.96, verified: true }],
        questionStates: [{ questionId: 'T1-1', state: 'scorable', reasons: [], candidateBlockIds: ['word-block-1'], selectedBlockIds: ['word-block-1'], mappingDecision: 'pdf-text-region-match', mappingConfidence: 0.96 }],
      } as any,
    });

    expect(layout).toMatchObject({
      schemaVersion: 'document-layout-representation.v1', renderedPdfChecksum: 'sha256:rendered', renderedPdfPageCount: 2,
      questionRegions: [expect.objectContaining({ questionId: 'T1-1', selectedBlockIds: ['word-block-1'], candidates: [expect.objectContaining({ pageNumber: 2, bbox: [20, 620, 160, 636] })] })],
    });
  });
  it('preserves namespaced aggregate evidence block ids', () => {
    const evidenceId = 'evidence:attempt-1:1';
    const evidence = evidenceFromRow({
      id: evidenceId,
      sourceKind: 'DOCUMENT',
      sourceHash: 'sha256:evidence',
      canonicalMarkdown: 'aggregate evidence',
      anchorVersion: 'assignment-answer-evidence.v2',
      precision: 'HIGH',
      readiness: 'READY',
      limitationState: 'none',
      limitations: [],
      blocks: [{
        id: `${evidenceId}:asset:asset-1:content`,
        blockIndex: 0,
        pageNumber: 1,
        text: 'aggregate evidence',
        markdown: 'aggregate evidence',
        precision: 'HIGH',
        confidence: 1,
      }],
    });

    expect(evidence.blocks[0]?.id).toBe('asset:asset-1:content');
  });

  it('persists one versioned assignment evidence manifest with namespaced blocks', async () => {
    const advisoryLock = vi.fn().mockResolvedValue([{ pg_advisory_xact_lock: '' }]);
    const db: any = {
      ...lifecyclePolicyRepository(),
      $queryRawUnsafe: advisoryLock,
      answerEvidence: {
        findFirst: async () => null,
        create: async ({ data }: any) => ({
          ...data,
          blocks: data.blocks.create,
        }),
      },
      $transaction: async (callback: (tx: any) => Promise<unknown>) => callback(db),
    };
    const result = await materializeAssignmentAnswerEvidence({
      db,
      attemptId: 'attempt-aggregate',
      answerVersion: 2,
      actor: { id: 'grading-worker', role: 'SERVICE' },
      sourceManifest: {
        version: 'assignment-answer-evidence.v2',
        sources: [{ kind: 'ATTACHMENT', assetId: 'asset-1' }],
      },
      normalized: {
        sourceKind: 'document',
        sourceHash: 'sha256:aggregate',
        canonicalMarkdown: 'aggregate evidence',
        anchorVersion: 'assignment-answer-evidence.v2',
        precision: 'block',
        readiness: 'ready',
        limitationState: 'none',
        limitations: [],
        blocks: [{
          id: 'asset:asset-1:content',
          blockIndex: 0,
          text: 'aggregate evidence',
          markdown: 'aggregate evidence',
          precision: 'block',
          confidence: 1,
        }],
      },
      now,
    });

    expect(result.evidence).toMatchObject({
      id: 'evidence:attempt-aggregate:2',
      sourceManifest: {
        version: 'assignment-answer-evidence.v2',
      },
    });
    expect(result.evidence.blocks[0]?.id)
      .toBe('evidence:attempt-aggregate:2:asset:asset-1:content');
    expect(advisoryLock).toHaveBeenCalledWith(
      'SELECT pg_advisory_xact_lock(hashtextextended($1, 0))::text AS "lock"',
      'assignment-answer-evidence:attempt-aggregate',
    );
  });

  it('creates a later immutable aggregate version instead of replacing prior evidence', async () => {
    const create = vi.fn(async ({ data }: any) => ({
      ...data,
      blocks: data.blocks.create,
    }));
    const db: any = {
      ...lifecyclePolicyRepository(),
      answerEvidence: {
        findFirst: async ({ where }: any) => where.sourceHash
          ? null
          : { version: 2 },
        create,
      },
      $transaction: async (callback: (tx: any) => Promise<unknown>) => callback(db),
    };

    const result = await materializeAssignmentAnswerEvidence({
      db,
      attemptId: 'attempt-history',
      answerVersion: 1,
      actor: { id: 'grading-worker', role: 'SERVICE' },
      sourceManifest: {
        version: 'assignment-answer-evidence.v2',
        sources: [],
      },
      normalized: {
        sourceKind: 'document',
        sourceHash: 'sha256:new-aggregate',
        canonicalMarkdown: 'new aggregate',
        anchorVersion: 'assignment-answer-evidence.v2',
        precision: 'block',
        readiness: 'ready',
        limitationState: 'none',
        limitations: [],
        blocks: [],
      },
      now,
    });

    expect(result.evidence).toMatchObject({
      id: 'evidence:attempt-history:3',
      version: 3,
    });
    expect(create).toHaveBeenCalledOnce();
  });

  it('stores text evidence as first-class canonical content and replays the same attempt/version', async () => {
    const created: any[] = [];
    const audits: any[] = [];
    let replay: any = null;
    const db = {
      ...lifecyclePolicyRepository(),
      submissionAttempt: { findUnique: async () => submittedAttempt() },
      answerEvidence: {
        findFirst: async () => replay,
        create: async ({ data }: any) => {
          created.push(data);
          return { ...data, blocks: data.blocks.create };
        },
      },
      gradingAuditEvent: { create: async ({ data }: any) => { audits.push(data); return { id: `audit:${audits.length}` }; } },
    };

    const first = await materializeTextAnswerEvidence({ db, attemptId: 'attempt-1', actor: { id: 'teacher-1', role: 'TEACHER' }, now });
    expect(first.replay).toBe(false);
    expect(created).toHaveLength(1);
    expect(created[0].canonicalMarkdown).toContain('稳定性说明');
    expect(created[0].retentionExpiresAt).toEqual(new Date(now.getTime() + 3_600_000));
    expect(created[0]).not.toHaveProperty('bytes');
    expect(created[0]).not.toHaveProperty('payload');
    expect(created[0].blocks.create[0].spanStart).toEqual(expect.any(Number));
    expect(audits[0].actorPseudoId).not.toContain('teacher-1');

    replay = first.evidence;
    const second = await materializeTextAnswerEvidence({ db, attemptId: 'attempt-1', actor: { id: 'teacher-1', role: 'TEACHER' }, now });
    expect(second.replay).toBe(true);
    expect(created).toHaveLength(1);
  });

  it('uses durable evidence reservations for replay, payload conflicts, actor isolation, and P2002 winner rereads', async () => {
    const attempts = new Map<string, any>();
    const firstAttempt = submittedAttempt();
    const secondAttempt = { ...firstAttempt, id: 'attempt-2', answerId: 'answer-2', answerVersion: 1, answer: { ...firstAttempt.answer, submission: { ...firstAttempt.answer.submission }, question: { ...firstAttempt.answer.question } } };
    attempts.set(firstAttempt.id, firstAttempt);
    attempts.set(secondAttempt.id, secondAttempt);
    const evidenceRows: any[] = [];
    const requestRows: any[] = [];
    const db: any = {
      ...lifecyclePolicyRepository(),
      submissionAttempt: { findUnique: async ({ where }: any) => attempts.get(where.id) ?? null },
      answerEvidence: {
        findFirst: async ({ where }: any) => evidenceRows.find((row) => row.attemptId === where.attemptId && row.version === where.version) ?? null,
        findUnique: async ({ where }: any) => evidenceRows.find((row) => row.id === where.id) ?? null,
        create: async ({ data }: any) => { const row = { ...data, blocks: data.blocks.create }; evidenceRows.push(row); return row; },
      },
      gradingAuditEvent: { create: async () => ({ id: 'audit-test' }) },
      gradingRequestIdempotency: requestIdempotencyRepository(requestRows),
      $transaction: async (callback: (tx: any) => Promise<unknown>) => callback(db),
    };
    const requestHash = buildGradingRequestHash('answer-evidence', { attemptId: 'attempt-1', sourceKind: 'TEXT_NATIVE' });
    const first = await materializeTextAnswerEvidence({ db, attemptId: 'attempt-1', actor: { id: 'teacher-1', role: 'TEACHER' }, operation: 'answer-evidence', idempotencyKey: 'evidence-request-001', requestHash, now });
    const replay = await materializeTextAnswerEvidence({ db, attemptId: 'attempt-1', actor: { id: 'teacher-1', role: 'TEACHER' }, operation: 'answer-evidence', idempotencyKey: 'evidence-request-001', requestHash, now });
    expect(first.replay).toBe(false);
    expect(replay.replay).toBe(true);
    expect(replay.evidence.id).toBe(first.evidence.id);
    await expect(materializeTextAnswerEvidence({ db, attemptId: 'attempt-2', actor: { id: 'teacher-1', role: 'TEACHER' }, operation: 'answer-evidence', idempotencyKey: 'evidence-request-001', requestHash: buildGradingRequestHash('answer-evidence', { attemptId: 'attempt-2', sourceKind: 'TEXT_NATIVE' }), now })).rejects.toMatchObject({ code: 'idempotency-key-conflict', status: 409 });
    const otherActor = await materializeTextAnswerEvidence({ db, attemptId: 'attempt-1', actor: { id: 'admin-1', role: 'ADMIN' }, operation: 'answer-evidence', idempotencyKey: 'evidence-request-001', requestHash, now });
    expect(otherActor.evidence.id).toBe(first.evidence.id);
    expect(requestRows).toHaveLength(2);

    const raceRows: any[] = [];
    let initialReads = 0;
    const raceDb: any = {
      ...db,
      gradingRequestIdempotency: {
        findFirst: async ({ where }: any) => {
          initialReads += 1;
          return raceRows.find((row) => row.operation === where.operation && row.scope === where.scope && row.actorPseudoId === where.actorPseudoId && row.idempotencyKey === where.idempotencyKey) ?? null;
        },
        create: async ({ data }: any) => {
          raceRows.push({ ...data, resourceId: first.evidence.id });
          throw Object.assign(new Error('unique request idempotency key'), { code: 'P2002' });
        },
        update: async () => undefined,
      },
      answerEvidence: { ...db.answerEvidence, findUnique: async ({ where }: any) => where.id === first.evidence.id ? first.evidence : null },
      $transaction: async (callback: (tx: any) => Promise<unknown>) => callback(raceDb),
    };
    const race = await materializeTextAnswerEvidence({ db: raceDb, attemptId: 'attempt-1', actor: { id: 'teacher-1', role: 'TEACHER' }, operation: 'answer-evidence', idempotencyKey: 'evidence-race-001', requestHash: buildGradingRequestHash('answer-evidence', { attemptId: 'attempt-1', sourceKind: 'TEXT_NATIVE' }), now });
    expect(race.replay).toBe(true);
    expect(race.evidence.id).toBe(first.evidence.id);
    expect(initialReads).toBeGreaterThanOrEqual(3);
  });

  it('recovers a dedupe winner created under a different idempotency key and preserves loser-key conflicts', async () => {
    const resource = { id: 'conversion-winner', dedupeKey: 'document-conversion:same-resource' };
    const requestRows: any[] = [{
      id: 'request:winner',
      operation: 'document-conversion',
      scope: gradingRequestScope('TEACHER'),
      actorPseudoId: pseudonymousAuditId('teacher-1', 'idempotency'),
      idempotencyKey: 'winner-protected-key',
      requestHash: 'sha256:winner-request',
      resourceType: 'DocumentConversion',
      resourceId: resource.id,
    }];
    const repository = requestIdempotencyRepository(requestRows);
    const db: any = {
      gradingRequestIdempotency: repository,
    };
    db.$transaction = async (callback: (tx: any) => Promise<unknown>) => {
      const requestRowCount = requestRows.length;
      try {
        return await callback(db);
      } catch (error) {
        requestRows.splice(requestRowCount);
        throw error;
      }
    };
    const execute = (requestHash: string) => withGradingRequestIdempotency({
      db,
      actor: { id: 'teacher-1', role: 'TEACHER' },
      operation: 'document-conversion',
      idempotencyKey: 'loser-idempotency-key',
      requestHash,
      resourceType: 'DocumentConversion',
      now,
      load: async (_db, resourceId) => resourceId === resource.id ? resource : null,
      create: async () => {
        throw Object.assign(new Error('duplicate dedupe key'), { code: 'P2002' });
      },
      recoverUniqueConstraint: async () => ({ resourceId: resource.id, value: resource, replay: true }),
    });

    const recovered = await execute('sha256:loser-request');

    expect(recovered).toEqual({ value: resource, replay: true });
    expect(requestRows).toHaveLength(2);
    expect(requestRows[1]).toMatchObject({
      requestHash: 'sha256:loser-request',
      resourceId: resource.id,
    });
    await expect(execute('sha256:changed-request')).rejects.toMatchObject({
      code: 'idempotency-key-conflict',
      status: 409,
    });
  });

  it('converges a stale retryable delivery when the persisted grading run is already terminal', async () => {
    const updates: any[] = [];
    const db: any = {
      ...lifecyclePolicyRepository(),
      gradingJob: {
        findUnique: async () => ({
          id: 'job-stale-1',
          state: 'RETRYABLE',
          gradingRun: {
            id: 'run-stale-1',
            state: 'AWAITING_REVIEW',
            evaluatorId: 'configured-provider',
            evaluatorVersion: 'model.v1',
            limitations: [],
            blockedReasons: [],
            overallComment: 'Persisted draft remains teacher-review only.',
            inputHash: 'sha256:input',
            dedupeKey: 'grading-run:stale',
          },
        }),
        update: async ({ data }: any) => { updates.push(data); return data; },
      },
    };

    const result = await processGradingRunJob({ db, jobId: 'job-stale-1', now });
    expect(result.draft.state).toBe('awaiting-review');
    expect(updates).toEqual(expect.arrayContaining([
      expect.objectContaining({ state: 'SUCCEEDED', progress: 100 }),
    ]));
  });

  it('refreshes blocked evidence when a retryable document conversion later succeeds', async () => {
    const bytes = new TextEncoder().encode('answer');
    const checksum = sha256(bytes);
    const store = new MemorySubmissionObjectStore();
    store.put({ key: 'quarantine/answer-1', ownerId: 'student-1', answerId: 'answer-1', sizeBytes: bytes.byteLength, mimeType: 'text/plain', checksum, scanState: 'CLEAN' });
    store.payloads.set('quarantine/answer-1', bytes);
    const oldEvidence = { id: 'evidence-old', readiness: 'BLOCKED', blocks: [] };
    const conversion = {
      id: 'conversion-1', assetId: 'asset-1', attemptId: 'attempt-1', version: 1, state: 'RETRYABLE', retentionExpiresAt: now,
      asset: { id: 'asset-1', answerId: 'answer-1', objectKey: 'quarantine/answer-1', originalName: 'answer.txt', mimeType: 'text/plain', sizeBytes: bytes.byteLength, checksum, answer: { submission: { frozenStudentId: 'student-1', frozenAudienceClassId: 'class-1' } } },
      attempt: { id: 'attempt-1' }, policy: null, answerEvidence: oldEvidence,
    };
    const updates: any[] = [];
    const blockWrites: any[] = [];
    const db: any = {
      ...lifecyclePolicyRepository(),
      gradingJob: {
        findUnique: async () => ({ id: 'job-conversion-1', state: 'QUEUED', cancelRequestedAt: null, conversion }),
        updateMany: async ({ data }: any) => { updates.push(data); return { count: 1 }; },
        update: async ({ data }: any) => { updates.push(data); return data; },
      },
      documentConversion: {
        update: async ({ data }: any) => { updates.push(data); return { ...conversion, ...data }; },
      },
      gradingConversionWarning: { createMany: async () => undefined },
      answerEvidence: {
        findFirst: async () => oldEvidence,
        update: async ({ data }: any) => ({ ...oldEvidence, ...data }),
      },
      answerEvidenceBlock: {
        deleteMany: async () => undefined,
        createMany: async ({ data }: any) => { blockWrites.push(...data); return data; },
      },
      $transaction: async (callback: (tx: any) => Promise<unknown>) => callback(db),
    };
    const result = await processDocumentConversionJob({
      db,
      jobId: 'job-conversion-1',
      store,
      local: { convert: async () => ({ markdown: '稳定性证据', blocks: [{ id: 'block-1', blockIndex: 0, text: '稳定性证据', markdown: '稳定性证据', precision: 'block' as const, confidence: 0.9 }] }) },
      now,
    });

    expect(result.conversion.state).toBe('SUCCEEDED');
    expect(result.evidence).toEqual(expect.objectContaining({ id: 'evidence-old', readiness: 'READY' }));
    expect(blockWrites).toEqual(expect.arrayContaining([expect.objectContaining({ evidenceId: 'evidence-old', id: 'conversion-1:block-1' })]));
  });

  it('persists successful conversion limitations for later evidence assembly', async () => {
    const bytes = new TextEncoder().encode('answer');
    const checksum = sha256(bytes);
    const store = new MemorySubmissionObjectStore();
    store.put({ key: 'quarantine/limited-answer', ownerId: 'student-1', answerId: 'answer-1', sizeBytes: bytes.byteLength, mimeType: 'text/plain', checksum, scanState: 'CLEAN' });
    store.payloads.set('quarantine/limited-answer', bytes);
    const conversion: any = {
      id: 'conversion-limited', assetId: 'asset-limited', attemptId: 'attempt-1', version: 1, state: 'QUEUED', retentionExpiresAt: now,
      asset: { id: 'asset-limited', answerId: 'answer-1', objectKey: 'quarantine/limited-answer', originalName: 'answer.txt', mimeType: 'text/plain', sizeBytes: bytes.byteLength, checksum, answer: { submission: { frozenStudentId: 'student-1', frozenAudienceClassId: 'class-1' } } },
      attempt: { id: 'attempt-1' }, policy: null, answerEvidence: null,
    };
    const updates: any[] = [];
    const db: any = {
      ...lifecyclePolicyRepository(),
      gradingJob: {
        findUnique: async () => ({ id: 'job-limited', state: 'QUEUED', cancelRequestedAt: null, conversion }),
        updateMany: async ({ data }: any) => { updates.push(data); return { count: 1 }; },
        update: async ({ data }: any) => { updates.push(data); return data; },
      },
      documentConversion: {
        update: async ({ data }: any) => { updates.push(data); return { ...conversion, ...data }; },
      },
      gradingConversionWarning: { createMany: async () => undefined },
      answerEvidence: {
        findFirst: async () => null,
        create: async ({ data }: any) => ({ id: 'evidence-limited', ...data }),
      },
      $transaction: async (callback: (tx: any) => Promise<unknown>) => callback(db),
    };

    await processDocumentConversionJob({
      db,
      jobId: 'job-limited',
      store,
      local: {
        convert: async () => ({
          markdown: '部分文本',
          blocks: [{ id: 'block-1', blockIndex: 0, text: '部分文本', markdown: '部分文本', precision: 'block' as const, confidence: 1 }],
          limitations: ['direct-text-truncated'],
        }),
      },
      now,
    });

    expect(updates).toEqual(expect.arrayContaining([
      expect.objectContaining({ warningCodes: ['direct-text-truncated'] }),
    ]));
  });

  it('does not commit a conversion result after retention fences the worker', async () => {
    const bytes = new TextEncoder().encode('answer');
    const checksum = sha256(bytes);
    const store = new MemorySubmissionObjectStore();
    store.put({ key: 'quarantine/fenced-answer', ownerId: 'student-1', answerId: 'answer-1', sizeBytes: bytes.byteLength, mimeType: 'text/plain', checksum, scanState: 'CLEAN' });
    store.payloads.set('quarantine/fenced-answer', bytes);
    const conversion: any = {
      id: 'conversion-fenced', assetId: 'asset-fenced', attemptId: 'attempt-1', version: 1, state: 'QUEUED', retentionExpiresAt: now,
      asset: { id: 'asset-fenced', answerId: 'answer-1', objectKey: 'quarantine/fenced-answer', originalName: 'answer.txt', mimeType: 'text/plain', sizeBytes: bytes.byteLength, checksum, answer: { submission: { frozenStudentId: 'student-1', frozenAudienceClassId: 'class-1' } } },
      attempt: { id: 'attempt-1' }, policy: null, answerEvidence: null,
    };
    const job: any = { id: 'job-fenced-conversion', state: 'QUEUED', cancelRequestedAt: null, conversion };
    const evidenceCreates: any[] = [];
    const db: any = {
      ...lifecyclePolicyRepository(),
      gradingJob: {
        findUnique: async () => job,
        update: async ({ data }: any) => { Object.assign(job, data); return job; },
        updateMany: async () => ({ count: 0 }),
      },
      documentConversion: {
        update: async ({ data }: any) => { Object.assign(conversion, data); return conversion; },
        updateMany: async () => ({ count: conversion.state === 'CONTENT_UNAVAILABLE' ? 0 : 1 }),
      },
      gradingConversionWarning: { createMany: async () => undefined },
      answerEvidence: {
        findFirst: async () => null,
        create: async ({ data }: any) => { evidenceCreates.push(data); return data; },
      },
      $transaction: async (callback: (tx: any) => Promise<unknown>) => callback(db),
    };
    await expect(processDocumentConversionJob({
      db,
      jobId: job.id,
      store,
      local: {
        convert: async () => {
          conversion.state = 'CONTENT_UNAVAILABLE';
          job.state = 'CONTENT_UNAVAILABLE';
          return { markdown: 'evidence', blocks: [{ text: 'evidence', precision: 'block' as const }] };
        },
      },
      now,
    })).rejects.toThrow('conversion-worker-fenced');
    expect(evidenceCreates).toHaveLength(0);
  });

  it('does not start a conversion worker after retention fences its durable job', async () => {
    const conversion: any = { id: 'conversion-fenced-start', state: 'QUEUED' };
    const job: any = { id: 'job-fenced-start', state: 'QUEUED', conversion };
    const db: any = {
      ...lifecyclePolicyRepository(),
      gradingJob: {
        findUnique: async () => job,
        updateMany: vi.fn(async () => ({ count: 0 })),
        update: vi.fn(async () => { throw new Error('unconditional-conversion-start'); }),
      },
      documentConversion: {
        updateMany: vi.fn(async () => ({ count: 0 })),
        update: vi.fn(async () => { throw new Error('unconditional-conversion-start'); }),
      },
      $transaction: async (callback: (tx: any) => Promise<unknown>) => callback(db),
    };

    await expect(processDocumentConversionJob({ db, jobId: job.id, now }))
      .rejects.toThrow('conversion-worker-fenced');
    expect(conversion.state).toBe('QUEUED');
  });

  it('stops before a Mathpix request when the conversion lease is taken over', async () => {
    const bytes = new Uint8Array([37, 80, 68, 70]);
    const checksum = sha256(bytes);
    const store = new MemorySubmissionObjectStore();
    store.put({ key: 'quarantine/provider-barrier.pdf', ownerId: 'student-1', answerId: 'answer-1', sizeBytes: bytes.byteLength, mimeType: 'application/pdf', checksum, scanState: 'CLEAN' });
    store.payloads.set('quarantine/provider-barrier.pdf', bytes);
    const policy: any = { provider: 'mathpix', version: 'mathpix.v1', purpose: 'answer-conversion', dataCategories: ['student-answer'], minimizedScope: ['selected-question'], institutionScope: null, classScope: ['class-1'], processingRegion: 'CN', agreementVersion: 'agreement.v1', noTraining: true, providerRetentionSeconds: 0, deletionCapability: true, rateLimitPerMinute: 10, enabled: true, disabledAt: null, credentialRef: 'env:MATHPIX_APP_KEY' };
    const conversion: any = { id: 'conversion-provider-barrier', assetId: 'asset-provider-barrier', attemptId: 'attempt-1', version: 1, state: 'QUEUED', policyId: null, policySnapshot: policy, policySnapshotHash: null, policy, asset: { id: 'asset-provider-barrier', answerId: 'answer-1', objectKey: 'quarantine/provider-barrier.pdf', originalName: 'answer.pdf', mimeType: 'application/pdf', sizeBytes: bytes.byteLength, checksum, answer: { submission: { frozenStudentId: 'student-1', frozenAudienceClassId: 'class-1' } } }, attempt: { id: 'attempt-1' }, answerEvidence: null };
    const job: any = { id: 'job-provider-barrier', state: 'QUEUED', cancelRequestedAt: null, conversion };
    let providerCalls = 0;
    const db: any = {
      ...lifecyclePolicyRepository(),
      gradingJob: {
        findUnique: async () => job,
        updateMany: async ({ where, data }: any) => {
          if (where.state.in.includes('RUNNING')) return { count: 0 };
          Object.assign(job, data);
          return { count: 1 };
        },
      },
      documentConversion: { updateMany: async () => ({ count: 1 }) },
      gradingConversionWarning: { createMany: async () => undefined },
      gradingAuditEvent: { create: async () => ({ id: 'audit-test' }) },
      $transaction: async (callback: (tx: any) => Promise<unknown>) => callback(db),
    };
    await expect(processDocumentConversionJob({
      db,
      jobId: job.id,
      store,
      mathpix: { convert: async () => { providerCalls += 1; throw new Error('must-not-call-provider'); } },
      now,
    })).rejects.toThrow('conversion-worker-fenced');
    expect(providerCalls).toBe(0);
  });

  it('stops before an AI provider request when the grading lease is taken over', async () => {
    const run: any = {
      id: 'run-provider-barrier',
      state: 'QUEUED',
      answerEvidence: { id: 'evidence-provider-barrier', sourceKind: 'TEXT_NATIVE', sourceHash: 'sha256:evidence', canonicalMarkdown: 'evidence', anchorVersion: 'text-native.v1', precision: 'SPAN', readiness: 'READY', limitationState: 'none', limitations: [], blocks: [{ id: 'block-provider-barrier', blockIndex: 0, text: 'evidence', markdown: 'evidence', precision: 'SPAN', confidence: 1 }] },
      questionSnapshot: { assignmentRevisionId: 'revision-1', questionId: 'question-1', stableQuestionId: 'q1', responseType: 'SUBJECTIVE_TEXT', prompt: 'Explain evidence.', referenceAnswer: 'Cite evidence.', rubric: { schemaVersion: 'rubric.v1', id: 'rubric-1', version: 'sha256:question', maxScore: 0, criteria: [] }, contentHash: 'sha256:question' },
      questionSnapshotHash: 'sha256:question',
      referenceAnswer: 'Cite evidence.',
      rubricVersion: 'sha256:question',
      inputHash: null,
      evaluatorId: 'provider-1',
      evaluatorVersion: 'model.v1',
      policy: null,
      answerAttempt: { answerId: 'answer-provider-barrier', answer: { submission: { frozenAudienceClassId: 'class-1' } } },
    };
    const job: any = { id: 'job-provider-barrier-grading', state: 'QUEUED', cancelRequestedAt: null, gradingRun: run };
    let providerCalls = 0;
    const db: any = {
      ...lifecyclePolicyRepository(),
      gradingJob: {
        findUnique: async () => job,
        updateMany: async ({ where, data }: any) => {
          if (where.state.in.includes('RUNNING')) return { count: 0 };
          Object.assign(job, data);
          return { count: 1 };
        },
      },
      gradingRun: { updateMany: async ({ data }: any) => { Object.assign(run, data); return { count: 1 }; } },
      gradingAuditEvent: { create: async () => ({ id: 'audit-test' }) },
      $transaction: async (callback: (tx: any) => Promise<unknown>) => callback(db),
    };
    await expect(processGradingRunJob({
      db,
      jobId: job.id,
      policy: gradingPolicy() as ExternalProcessingPolicy,
      provider: { id: 'provider-1', version: 'model.v1', evaluate: async () => { providerCalls += 1; throw new Error('must-not-call-provider'); } },
      now,
    })).rejects.toThrow('grading-worker-fenced');
    expect(providerCalls).toBe(0);
  });

  it('does not start a grading worker after retention fences its durable job', async () => {
    const run: any = {
      id: 'run-fenced-grading',
      state: 'QUEUED',
      answerEvidence: { id: 'evidence-1', sourceKind: 'TEXT_NATIVE', sourceHash: 'sha256:evidence', canonicalMarkdown: 'evidence', anchorVersion: 'text-native.v1', precision: 'SPAN', readiness: 'READY', limitationState: 'none', limitations: [], blocks: [] },
      question: { id: 'question-1', assignmentRevisionId: 'revision-1', stableQuestionId: 'q1', responseType: 'SUBJECTIVE_TEXT', promptSnapshot: { text: 'Explain evidence.' }, answerSnapshot: { text: 'Cite evidence.' }, rubricSnapshot: { criteria: [] }, contentHash: 'sha256:question' },
      questionSnapshot: { assignmentRevisionId: 'revision-1', questionId: 'question-1', stableQuestionId: 'q1', responseType: 'SUBJECTIVE_TEXT', prompt: 'Explain evidence.', referenceAnswer: 'Cite evidence.', rubric: { schemaVersion: 'rubric.v1', id: 'rubric-1', version: 'sha256:question', maxScore: 0, criteria: [] }, contentHash: 'sha256:question' },
      questionSnapshotHash: 'sha256:question',
      referenceAnswer: 'Cite evidence.',
      rubricVersion: 'sha256:question',
      inputHash: null,
      policy: null,
      answerAttempt: { answer: { submission: { frozenAudienceClassId: 'class-1' } } },
    };
    const job: any = { id: 'job-fenced-grading', state: 'QUEUED', gradingRun: run };
    const runUpdate = vi.fn();
    const db: any = {
      ...lifecyclePolicyRepository(),
      gradingJob: { findUnique: async () => job, update: vi.fn(), updateMany: async () => ({ count: 0 }) },
      gradingRun: { update: runUpdate, updateMany: async () => ({ count: 0 }) },
      $transaction: async (callback: (tx: any) => Promise<unknown>) => callback(db),
    };
    await expect(processGradingRunJob({ db, jobId: job.id, now })).rejects.toThrow('grading-worker-fenced');
    expect(runUpdate).not.toHaveBeenCalled();
  });

  it('does not persist conversion evidence or rendered artifacts when cancellation wins after local conversion', async () => {
    const bytes = new TextEncoder().encode('answer');
    const checksum = sha256(bytes);
    const store = new MemorySubmissionObjectStore();
    store.put({ key: 'quarantine/cancel-race', ownerId: 'student-1', answerId: 'answer-1', sizeBytes: bytes.byteLength, mimeType: 'text/plain', checksum, scanState: 'CLEAN' });
    store.payloads.set('quarantine/cancel-race', bytes);
    const conversion: any = {
      id: 'conversion-cancel-race', assetId: 'asset-cancel-race', attemptId: 'attempt-1', version: 1, state: 'QUEUED', cancellationRequestedAt: null,
      asset: { id: 'asset-cancel-race', answerId: 'answer-1', objectKey: 'quarantine/cancel-race', originalName: 'answer.txt', mimeType: 'text/plain', sizeBytes: bytes.byteLength, checksum, answer: { submission: { frozenStudentId: 'student-1', frozenAudienceClassId: 'class-1' } } },
      attempt: { id: 'attempt-1' }, policy: null, answerEvidence: null,
    };
    const job: any = { id: 'job-cancel-race', state: 'QUEUED', cancelRequestedAt: null, conversion };
    const evidenceCreates: any[] = [];
    const renderedKeys: string[] = [];
    const db: any = {
      ...lifecyclePolicyRepository(),
      gradingJob: {
        findUnique: async () => job,
        updateMany: async ({ data }: any) => { Object.assign(job, data); return { count: 1 }; },
        update: async ({ data }: any) => { Object.assign(job, data); return job; },
      },
      documentConversion: {
        updateMany: async ({ data }: any) => { Object.assign(conversion, data); return { count: 1 }; },
        update: async ({ data }: any) => { Object.assign(conversion, data); return conversion; },
      },
      answerEvidence: {
        findFirst: async () => null,
        create: async ({ data }: any) => { evidenceCreates.push(data); return data; },
      },
      gradingConversionWarning: { createMany: async () => undefined },
      $transaction: async (callback: (tx: any) => Promise<unknown>) => callback(db),
    };

    const result = await processDocumentConversionJob({
      db,
      jobId: job.id,
      store,
      local: {
        convert: async () => {
          job.cancelRequestedAt = now;
          conversion.cancellationRequestedAt = now;
          return { markdown: 'private answer', blocks: [{ text: 'private answer', precision: 'block' as const }], renderedBytes: new Uint8Array([1, 2, 3]), renderedMimeType: 'application/pdf' };
        },
      },
      writeRendered: async ({ key }: { key: string }) => { renderedKeys.push(key); return key; },
      now,
    });

    expect(result.evidence).toBeNull();
    expect(renderedKeys).toHaveLength(0);
    expect(evidenceCreates).toHaveLength(0);
    expect(result.conversion.state).toBe('CANCELLED');
    expect(job.state).toBe('CANCELLED');
  });

  it('writes rendered bytes with stable ownership metadata and cleans the orphan when the lease is lost', async () => {
    const bytes = new Uint8Array([1, 2, 3]);
    const checksum = sha256(bytes);
    const head = vi.fn(async (key: string) => ({ key, ownerId: 'student-rendered', answerId: 'answer-rendered', sizeBytes: bytes.byteLength, mimeType: 'application/pdf', checksum, scanState: 'CLEAN' as const }));
    const signUpload = vi.fn(async (intent: any, _ttl: number, key?: string) => ({ key: key!, url: 'https://objects.example/upload', expiresAt: new Date().toISOString(), requiredHeaders: { 'content-type': intent.mimeType } }));
    const store: any = { signUpload, head, delete: vi.fn(async () => undefined) };
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 200 }));
    await expect(writeRenderedObjectToSubmissionStore({ store, key: 'grading-rendered/conversion-rendered', bytes, mimeType: 'application/pdf', checksum, ownerId: 'student-rendered', answerId: 'answer-rendered', signal: new AbortController().signal })).resolves.toBe('grading-rendered/conversion-rendered');
    expect(signUpload).toHaveBeenCalledWith(expect.objectContaining({ ownerId: 'student-rendered', answerId: 'answer-rendered', checksum, sizeBytes: 3 }), 600, 'grading-rendered/conversion-rendered');
    expect(fetchMock).toHaveBeenCalledWith('https://objects.example/upload', expect.objectContaining({ method: 'PUT', signal: expect.any(AbortSignal) }));
    fetchMock.mockRestore();

    let renderedKey: string | null = null;
    const conversion: any = { id: 'conversion-orphaned-rendered', assetId: 'asset-orphaned-rendered', attemptId: 'attempt-orphaned-rendered', version: 1, state: 'QUEUED', cancellationRequestedAt: null, asset: { id: 'asset-orphaned-rendered', answerId: 'answer-rendered', objectKey: 'quarantine/orphaned-rendered', originalName: 'answer.docx', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', sizeBytes: bytes.byteLength, checksum, answer: { submission: { frozenStudentId: 'student-rendered', frozenAudienceClassId: 'class-rendered' } } }, attempt: { id: 'attempt-orphaned-rendered' }, policy: null, answerEvidence: null };
    const job: any = { id: 'job-orphaned-rendered', state: 'QUEUED', cancelRequestedAt: null, conversion };
    const orphanStore: any = {
      head: async (key: string) => key === renderedKey || key === 'quarantine/orphaned-rendered' ? { key, ownerId: 'student-rendered', answerId: 'answer-rendered', sizeBytes: bytes.byteLength, mimeType: key === renderedKey ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', checksum, scanState: 'CLEAN' } : null,
      delete: vi.fn(async () => undefined),
      readObject: async () => bytes,
    };
    const db: any = {
      ...lifecyclePolicyRepository(),
      gradingJob: { findUnique: async () => job, updateMany: async ({ data }: any) => { Object.assign(job, data); return { count: 1 }; }, update: async ({ data }: any) => { Object.assign(job, data); return job; } },
      documentConversion: { update: async ({ data }: any) => { Object.assign(conversion, data); return conversion; } },
      $transaction: async (callback: (tx: any) => Promise<unknown>) => callback(db),
    };
    await expect(processDocumentConversionJob({ db, jobId: job.id, store: orphanStore, local: { convert: async () => ({ markdown: 'rendered', blocks: [{ text: 'rendered', precision: 'block' as const }], renderedBytes: bytes, renderedMimeType: 'application/pdf' }) }, writeRendered: async ({ key, ownerId, answerId, attemptId, workerClaimToken, checksum: renderedChecksum }: any) => { renderedKey = key; orphanStore.head = async (candidate: string) => candidate === key ? { key, ownerId, answerId, attemptId, workerClaimFingerprint: sha256(workerClaimToken), sizeBytes: bytes.byteLength, mimeType: 'application/pdf', checksum: renderedChecksum, scanState: 'CLEAN' } : null; throw new ConversionLeaseLostError(); } })).rejects.toThrow('grading-worker-fenced');
    expect(orphanStore.delete).toHaveBeenCalledWith(expect.stringContaining('grading-rendered/conversion-orphaned-rendered/attempt-orphaned-rendered/'), expect.any(AbortSignal));
  });

  it('cleans a rendered orphan after the next ownership check fails and never deletes a replacement owner on the same key', async () => {
    async function runScenario(replaceOwner: boolean, cleanupFails = false) {
      const sourceBytes = new Uint8Array([37, 80, 68, 70]);
      const renderedBytes = new Uint8Array([7, 8, 9]);
      const sourceChecksum = sha256(sourceBytes);
      const conversion: any = {
        id: `conversion-orphan-fence-${replaceOwner ? 'replacement' : 'owned'}`,
        assetId: 'asset-orphan-fence',
        attemptId: 'attempt-orphan-fence',
        version: 1,
        state: 'QUEUED',
        cancellationRequestedAt: null,
        policyId: null,
        policySnapshot: { provider: 'local', version: 'local.v1', purpose: 'answer-conversion', dataCategories: ['student-answer'], minimizedScope: ['selected-question'], institutionScope: null, classScope: ['class-1'], processingRegion: 'CN', agreementVersion: 'agreement.v1', noTraining: true, providerRetentionSeconds: 0, deletionCapability: true, rateLimitPerMinute: 10, enabled: true, disabledAt: null, credentialRef: 'env:LOCAL_CONVERTER' },
        policySnapshotHash: null,
        policy: null,
        answerEvidence: null,
        asset: { id: 'asset-orphan-fence', answerId: 'answer-orphan-fence', objectKey: `quarantine/orphan-fence-${replaceOwner ? 'replacement' : 'owned'}`, originalName: 'answer.pdf', mimeType: 'application/pdf', sizeBytes: sourceBytes.byteLength, checksum: sourceChecksum, answer: { question: { assignmentRevisionId: 'revision-orphan-fence' }, submission: { frozenStudentId: 'student-orphan-fence', frozenAudienceClassId: 'class-1', audience: {} } } },
        attempt: { id: 'attempt-orphan-fence' },
      };
      const job: any = { id: `job-orphan-fence-${replaceOwner ? 'replacement' : 'owned'}`, state: 'QUEUED', cancelRequestedAt: null, conversion };
      const store = new MemorySubmissionObjectStore();
      const orphanTombstones: any[] = [];
      const orphanAudits: any[] = [];
      store.put({ key: conversion.asset.objectKey, ownerId: 'student-orphan-fence', answerId: 'answer-orphan-fence', sizeBytes: sourceBytes.byteLength, mimeType: 'application/pdf', checksum: sourceChecksum, scanState: 'CLEAN' });
      store.payloads.set(conversion.asset.objectKey, sourceBytes);
      const db: any = {
        ...lifecyclePolicyRepository(),
        gradingJob: { findUnique: async () => job, updateMany: async ({ data }: any) => { Object.assign(job, data); return { count: 1 }; }, update: async ({ data }: any) => { Object.assign(job, data); return job; } },
        documentConversion: { update: async ({ data }: any) => { Object.assign(conversion, data); return conversion; } },
        gradingConversionWarning: { createMany: async () => undefined },
        answerEvidence: { findFirst: async () => null, create: async ({ data }: any) => data },
        gradingTombstone: { upsert: async ({ create }: any) => { orphanTombstones.push(create); return create; } },
        gradingAuditEvent: { create: async ({ data }: any) => { orphanAudits.push(data); return { id: `audit:${orphanAudits.length}`, ...data }; } },
        $transaction: async (callback: (tx: any) => Promise<unknown>) => callback(db),
      };
      if (cleanupFails) store.delete = async () => { throw new Error('orphan-delete-failed'); };
      let writerInput: any;
      await expect(processDocumentConversionJob({
        db,
        jobId: job.id,
        store,
        local: { convert: async () => ({ markdown: 'answer', blocks: [{ text: 'answer', precision: 'block' as const }], renderedBytes, renderedMimeType: 'application/pdf' }) },
        writeRendered: async (input: any) => {
          writerInput = input;
          store.put({ key: input.key, ownerId: input.ownerId, answerId: input.answerId, attemptId: input.attemptId, workerClaimFingerprint: sha256(input.workerClaimToken), sizeBytes: input.bytes.byteLength, mimeType: input.mimeType, checksum: input.checksum, scanState: 'CLEAN' });
          store.payloads.set(input.key, input.bytes.slice());
          if (replaceOwner) store.put({ key: input.key, ownerId: 'new-owner', answerId: input.answerId, attemptId: input.attemptId, sizeBytes: input.bytes.byteLength, mimeType: input.mimeType, checksum: input.checksum, scanState: 'CLEAN' });
          job.state = 'CONTENT_UNAVAILABLE';
          return input.key;
        },
        now,
      })).rejects.toThrow(cleanupFails || replaceOwner ? 'rendered-orphan-cleanup-failed' : 'conversion-worker-fenced');
      expect(writerInput).toEqual(expect.objectContaining({ attemptId: 'attempt-orphan-fence', workerClaimToken: expect.any(String) }));
      return { store, key: writerInput.key, orphanTombstones, orphanAudits };
    }

    const owned = await runScenario(false);
    expect(await owned.store.head(owned.key)).toBeNull();
    const replacement = await runScenario(true);
    expect(await replacement.store.head(replacement.key)).toEqual(expect.objectContaining({ ownerId: 'new-owner' }));

    const failedCleanup = await runScenario(false, true);
    expect(failedCleanup.orphanTombstones).toEqual(expect.arrayContaining([expect.objectContaining({ status: 'RETRYABLE', lastErrorCode: 'rendered-orphan-cleanup-failed' })]));
    expect(failedCleanup.orphanAudits).toEqual(expect.arrayContaining([expect.objectContaining({ action: 'document-conversion.rendered-orphan-cleanup-failed' })]));
  });

  it('propagates cancellation that wins after an external conversion instead of falling back locally', async () => {
    const bytes = new TextEncoder().encode('%PDF-cancel-race');
    const checksum = sha256(bytes);
    const store = new MemorySubmissionObjectStore();
    store.put({ key: 'quarantine/external-cancel-race', ownerId: 'student-1', answerId: 'answer-1', sizeBytes: bytes.byteLength, mimeType: 'application/pdf', checksum, scanState: 'CLEAN' });
    store.payloads.set('quarantine/external-cancel-race', bytes);
    const policy: ExternalProcessingPolicy = {
      ...gradingPolicy({ purpose: 'answer-conversion', provider: 'mathpix', model: null }),
    } as ExternalProcessingPolicy;
    let checks = 0;
    let localCalls = 0;
    await expect(convertProtectedSubmission({
      source: { assetId: 'asset-1', attemptId: 'attempt-1', answerId: 'answer-1', ownerId: 'student-1', objectKey: 'quarantine/external-cancel-race', originalName: 'answer.pdf', mimeType: 'application/pdf', sizeBytes: bytes.byteLength, checksum, classId: 'class-1' },
      store,
      policy,
      mathpix: { convert: async () => ({ markdown: 'external result', lines: [{ text: 'external result', page: 1 }] }) },
      local: { convert: async () => { localCalls += 1; return { markdown: 'local result', blocks: [{ text: 'local result', precision: 'block' as const }] }; } },
      isCancellationRequested: () => { checks += 1; return checks >= 3; },
      now,
    })).rejects.toThrow('conversion-cancelled');
    expect(localCalls).toBe(0);
  });

  it('binds grading runs to the teacher-owned frozen class and replays by dedupe key', async () => {
    const attempt = submittedAttempt();
    (attempt.answer.question as any).rubricSnapshot = {
      schemaVersion: 'assignment-scoring-rubric.v2',
      criteria: [{
        id: 'criterion-1',
        label: 'Evidence',
        goalDimension: 'engineeringDecision',
        maxPoints: 5,
        scoringStandard: '依据证据评分。',
        detailedRubricEnabled: false,
        levels: [],
      }],
    };
    const evidenceRow = {
      id: 'evidence-1',
      attemptId: 'attempt-1',
      version: 3,
      sourceHash: 'sha256:evidence',
      canonicalMarkdown: 'evidence',
      anchorVersion: 'text-native.v1',
      sourceKind: 'TEXT_NATIVE',
      precision: 'SPAN',
      readiness: 'READY',
      limitationState: 'none',
      limitations: [],
      blocks: [],
      attempt,
    };
    const runs: any[] = [];
    const jobs: any[] = [];
    let replay: any = null;
    const db = {
      ...lifecyclePolicyRepository(),
      answerEvidence: { findUnique: async () => evidenceRow },
      gradingRun: {
        findUnique: async () => replay,
        create: async ({ data }: any) => { const row = { ...data, jobs: [] }; runs.push(row); return row; },
      },
      gradingJob: {
        findUnique: async () => null,
        create: async ({ data }: any) => { const row = { ...data }; jobs.push(row); return row; },
      },
    };

    await expect(enqueueGradingRun({
      db,
      attemptId: 'attempt-1',
      evidenceId: 'evidence-1',
      actor: { id: 'teacher-2', role: 'TEACHER' },
      idempotencyKey: 'same-grading-request',
      evaluatorId: 'provider-1',
      evaluatorVersion: 'model.v1',
      now,
    })).rejects.toThrow('grading-forbidden');

    const first = await enqueueGradingRun({
      db,
      attemptId: 'attempt-1',
      evidenceId: 'evidence-1',
      actor: { id: 'teacher-1', role: 'TEACHER' },
      idempotencyKey: 'same-grading-request',
      evaluatorId: 'provider-1',
      evaluatorVersion: 'model.v1',
      now,
    });
    expect(first.replay).toBe(false);
    expect(runs).toHaveLength(1);
    expect(jobs).toHaveLength(1);
    expect(first.run.questionSnapshot.rubric.criteria[0].goalDimension).toBe('engineeringDecision');

    replay = { ...first.run, jobs: [first.job] };
    const second = await enqueueGradingRun({
      db,
      attemptId: 'attempt-1',
      evidenceId: 'evidence-1',
      actor: { id: 'teacher-1', role: 'TEACHER' },
      idempotencyKey: 'same-grading-request',
      evaluatorId: 'provider-1',
      evaluatorVersion: 'model.v1',
      now,
    });
    expect(second.replay).toBe(true);
    expect(runs).toHaveLength(1);
  });

  it('rejects missing assignment course context before creating a grading run', async () => {
    const attempt = submittedAttempt();
    const createRun = vi.fn();
    const createJob = vi.fn();
    const findRevision = vi.fn(async () => ({ assignment: { courseContext: null } }));
    const db = {
      ...lifecyclePolicyRepository(),
      assignmentRevision: { findUnique: findRevision },
      answerEvidence: {
        findUnique: async () => ({
          id: 'evidence-without-course',
          attemptId: attempt.id,
          version: 1,
          sourceHash: 'sha256:evidence-without-course',
          anchorVersion: 'text-native.v1',
          readiness: 'READY',
          blocks: [],
          attempt,
        }),
      },
      gradingRun: { create: createRun },
      gradingJob: { create: createJob },
    };

    await expect(enqueueGradingRun({
      db,
      attemptId: attempt.id,
      evidenceId: 'evidence-without-course',
      actor: { id: 'teacher-1', role: 'TEACHER' },
      idempotencyKey: 'missing-course-context',
      now,
    })).rejects.toThrow('grading-content-unavailable:course-context-missing');

    expect(findRevision).toHaveBeenCalledWith({
      where: { id: 'revision-1' },
      select: { assignment: { select: { courseContext: true } } },
    });
    expect(createRun).not.toHaveBeenCalled();
    expect(createJob).not.toHaveBeenCalled();
  });

  it.each(['local-fallback', 'local-markitdown'])(
    'rejects ready legacy %s evidence before creating a grading run',
    async (adapter) => {
      const attempt = submittedAttempt();
      const createRun = vi.fn();
      const createJob = vi.fn();
      const db = {
        ...lifecyclePolicyRepository(),
        answerEvidence: {
          findUnique: async () => ({
            id: `legacy-${adapter}-evidence`,
            attemptId: attempt.id,
            version: 1,
            sourceHash: `sha256:${adapter}`,
            anchorVersion: 'document-evidence.v1',
            readiness: 'READY',
            blocks: [],
            conversion: { adapter },
            attempt,
          }),
        },
        gradingRun: { create: createRun },
        gradingJob: { create: createJob },
      };

      await expect(enqueueGradingRun({
        db,
        attemptId: attempt.id,
        evidenceId: `legacy-${adapter}-evidence`,
        actor: { id: 'teacher-1', role: 'TEACHER' },
        idempotencyKey: `legacy-${adapter}-grading`,
        now,
      })).rejects.toThrow('grading-evidence-legacy-local-binary-ineligible');

      expect(createRun).not.toHaveBeenCalled();
      expect(createJob).not.toHaveBeenCalled();
    },
  );

  it('requires aggregate assignment evidence when an attempt has attachments', async () => {
    const attempt = submittedAttempt();
    attempt.answer.assets = [{ id: 'asset-1' }] as any;
    const createRun = vi.fn();
    const createJob = vi.fn();
    const db = {
      ...lifecyclePolicyRepository(),
      answerEvidence: {
        findUnique: async () => ({
          id: 'single-asset-evidence',
          attemptId: attempt.id,
          version: 1,
          sourceHash: 'sha256:single-asset',
          anchorVersion: 'mathpix.v1:anchors',
          readiness: 'READY',
          blocks: [],
          conversion: { adapter: 'mathpix' },
          attempt,
        }),
      },
      gradingRun: { create: createRun },
      gradingJob: { create: createJob },
    };

    await expect(enqueueGradingRun({
      db,
      attemptId: attempt.id,
      evidenceId: 'single-asset-evidence',
      actor: { id: 'teacher-1', role: 'TEACHER' },
      idempotencyKey: 'single-asset-grading',
      now,
    })).rejects.toThrow('grading-evidence-assignment-aggregate-required');

    expect(createRun).not.toHaveBeenCalled();
    expect(createJob).not.toHaveBeenCalled();
  });

  it('checks grading authorization before exposing missing course context', async () => {
    const attempt = submittedAttempt();
    const createRun = vi.fn();
    const createJob = vi.fn();
    const db = {
      ...lifecyclePolicyRepository(),
      assignmentRevision: {
        findUnique: async () => ({
          assignment: { authorId: 'teacher-author', reviewGrants: [], courseContext: null },
        }),
      },
      answerEvidence: {
        findUnique: async () => ({
          id: 'unauthorized-evidence-without-course',
          attemptId: attempt.id,
          version: 1,
          sourceHash: 'sha256:unauthorized-evidence',
          anchorVersion: 'text-native.v1',
          readiness: 'READY',
          blocks: [],
          attempt,
        }),
      },
      gradingRun: { create: createRun },
      gradingJob: { create: createJob },
    };

    await expect(enqueueGradingRun({
      db,
      attemptId: attempt.id,
      evidenceId: 'unauthorized-evidence-without-course',
      actor: { id: 'teacher-intruder', role: 'TEACHER' },
      idempotencyKey: 'unauthorized-missing-course',
      now,
    })).rejects.toThrow('grading-forbidden');

    expect(createRun).not.toHaveBeenCalled();
    expect(createJob).not.toHaveBeenCalled();
  });

  it('keeps dedupe stable while explicit reruns receive distinct reasons and version boundaries', () => {
    expect(buildPipelineDedupeKey('run', { b: 2, a: 1 })).toBe(buildPipelineDedupeKey('run', { a: 1, b: 2 }));
    const first = buildRerunIdentity({ kind: 'run', sourceId: 'attempt-1', reason: 'provider retry', inputHash: 'sha256:input', versionBoundary: 'model.v1', idempotencyKey: 'rerun-a' });
    const second = buildRerunIdentity({ kind: 'run', sourceId: 'attempt-1', reason: 'rubric correction', inputHash: 'sha256:input', versionBoundary: 'model.v1', idempotencyKey: 'rerun-a' });
    const versioned = buildRerunIdentity({ kind: 'run', sourceId: 'attempt-1', reason: 'provider retry', inputHash: 'sha256:input', versionBoundary: 'model.v2', idempotencyKey: 'rerun-a' });
    expect(new Set([first, second, versioned]).size).toBe(3);
  });

  it('persists a valid provider result as an awaiting-review draft without approval or writeback', async () => {
    const updates: any[] = [];
    const annotations: any[] = [];
    const visualBytes = new Uint8Array([137, 80, 78, 71]);
    const visualChecksum = sha256(visualBytes);
    const store = new MemorySubmissionObjectStore();
    store.put({ key: 'grading-visual/run-1/1', ownerId: 'student-1', answerId: 'answer-1', attemptId: 'attempt-1', sizeBytes: visualBytes.byteLength, mimeType: 'image/png', checksum: visualChecksum, scanState: 'PENDING' });
    store.payloads.set('grading-visual/run-1/1', visualBytes);
    const question = submittedAttempt().answer.question;
    (question.rubricSnapshot.criteria[0].levels as any) = [{ id: 'excellent', label: 'Excellent', minPoints: 4, maxPoints: 5, description: 'Complete evidence.' }];
    const job = {
      id: 'job-1',
      gradingRun: {
        id: 'run-1',
        answerAttemptId: 'attempt-1',
        answerEvidenceId: 'evidence-1',
        questionId: question.id,
        rubricId: 'rubric:question-1',
        rubricSnapshot: question.rubricSnapshot,
        answerEvidence: {
          id: 'evidence-1',
          sourceKind: 'TEXT_NATIVE',
          sourceHash: 'sha256:evidence',
          canonicalMarkdown: '第一段证据。',
          anchorVersion: 'text-native.v1',
          precision: 'SPAN',
          readiness: 'READY',
          limitationState: 'none',
          limitations: [],
          blocks: [{ id: 'conversion-1:document-block-1', blockIndex: 0, pageNumber: null, text: '第一段证据。', markdown: '第一段证据。', spanStart: 0, spanEnd: 7, bbox: null, precision: 'SPAN', confidence: 1 }],
        },
        question,
        questionSnapshot: {
          assignmentRevisionId: question.assignmentRevisionId,
          questionId: question.id,
          stableQuestionId: question.stableQuestionId,
          responseType: question.responseType,
          prompt: 'Explain stability.',
          referenceAnswer: 'Cite the margin.',
          rubric: { schemaVersion: 'assignment-analytic-rubric.v1', id: 'rubric:question-1', version: 'sha256:question', maxScore: 5, criteria: question.rubricSnapshot.criteria },
          contentHash: 'sha256:question',
        },
        questionSnapshotHash: 'sha256:question',
        attachmentManifest: [{ id: 'visual-1', questionId: question.id, objectKey: 'grading-visual/run-1/1', checksum: visualChecksum, mediaType: 'image/png', sizeBytes: visualBytes.byteLength, readiness: 'ready', contentHash: sha256('visual-1') }],
        referenceAnswer: 'Cite the margin.',
        policy: null,
        answerAttempt: { id: 'attempt-1', answerId: 'answer-1', answer: { submission: { frozenStudentId: 'student-1', frozenAudienceClassId: 'class-1' } } },
      },
    };
    const db: any = {
      ...lifecyclePolicyRepository(),
      gradingJob: { findUnique: async () => job, updateMany: async ({ data }: any) => { updates.push(data); return { count: 1 }; }, update: async ({ data }: any) => { updates.push(data); return data; } },
      gradingRun: { update: async ({ data }: any) => { updates.push(data); return { ...job.gradingRun, ...data }; } },
      $transaction: async (callback: (tx: any) => Promise<unknown>) => callback(db),
      gradingCriterionAssessment: { create: async ({ data }: any) => ({ id: 'assessment-1', ...data }) },
      gradingAnnotation: { create: async ({ data }: any) => { annotations.push(data); return data; } },
    };
    const policy: ExternalProcessingPolicy = {
      provider: 'ai-evaluator',
      version: 'policy.v1',
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
    const provider = {
      id: 'provider-1',
      version: 'model.v1',
      evaluate: vi.fn(async () => ({
        evaluatorId: 'provider-1',
        evaluatorVersion: 'model.v1',
        assessments: [{ criterionId: 'criterion-1', levelId: 'excellent', score: 5, maxScore: 5, rationale: 'The submitted evidence states the stability result.', confidence: 0.9, anchors: [{ blockId: 'document-block-1', precision: 'span', excerpt: '第一段证据', spanStart: 0, spanEnd: 6 }], limitationState: 'none', annotations: [] }],
        limitations: [],
        overallComment: 'The draft is grounded in the submitted evidence.',
        overallFeedback: { strengths: ['The main conclusion is clear.'], problems: ['Supporting detail can be expanded.'], suggestions: ['Show the calculation before the conclusion.'] },
      })),
    };
    const result = await processGradingRunJob({
      db,
      jobId: 'job-1',
      store,
      policy,
      provider,
      now,
    });
    expect(result.draft.state).toBe('awaiting-review');
    expect(annotations).toEqual([]);
    expect(updates).toEqual(expect.arrayContaining([expect.objectContaining({ state: 'AWAITING_REVIEW' }), expect.objectContaining({ state: 'SUCCEEDED' })]));
    expect(updates.some((update) => update.state === 'APPROVED' || 'teacherReviewedAt' in update)).toBe(false);
    expect(provider.evaluate).toHaveBeenCalledWith(expect.objectContaining({
      attachments: [expect.objectContaining({ kind: 'image', questionId: question.id, checksum: visualChecksum, data: visualBytes })],
    }));

    job.gradingRun.attachmentManifest[0].questionId = 'question-2';
    const crossQuestionProvider = { id: 'provider-1', version: 'model.v1', evaluate: vi.fn() };
    const crossQuestion = await processGradingRunJob({
      db,
      jobId: 'job-1',
      store,
      policy,
      provider: crossQuestionProvider,
      now,
    });
    expect(crossQuestion.run).toEqual(expect.objectContaining({ state: 'BLOCKED', blockedReasons: ['visual-evidence-incomplete'] }));
    expect(crossQuestionProvider.evaluate).not.toHaveBeenCalled();

    job.gradingRun.attachmentManifest[0].questionId = question.id;
    const tamperedChecksum = sha256('tampered-visual-object');
    job.gradingRun.attachmentManifest[0].checksum = tamperedChecksum;
    const blockedProvider = { id: 'provider-1', version: 'model.v1', evaluate: vi.fn() };
    const blocked = await processGradingRunJob({
      db,
      jobId: 'job-1',
      store,
      policy,
      provider: blockedProvider,
      now,
    });
    expect(blocked.run).toEqual(expect.objectContaining({ state: 'BLOCKED', blockedReasons: ['visual-evidence-object-integrity-failed'] }));
    expect(updates).toEqual(expect.arrayContaining([expect.objectContaining({ state: 'BLOCKED', lastErrorCode: 'visual-evidence-object-integrity-failed' })]));
    expect(blockedProvider.evaluate).not.toHaveBeenCalled();
  });

  it('persists an evaluation draft on an existing run without production submission lineage', async () => {
    const run = {
      id: 'evaluation-run-1',
      rubricSnapshot: { criteria: [{ id: 'criterion-1', maxPoints: 2 }] },
      answerAttemptId: null,
      state: 'RUNNING',
      inputHash: 'sha256:evaluation-input',
      evaluatorId: 'configured-openai',
      evaluatorVersion: 'model.v1',
    };
    const runUpdates: any[] = [];
    const afterPersistStates: string[] = [];
    const assessments: any[] = [];
    const annotations: any[] = [];
    const db: any = {
      gradingRun: {
        findUnique: async () => run,
        update: async ({ data }: any) => {
          runUpdates.push(data);
          return { ...run, ...data };
        },
        updateMany: async ({ where, data }: any) => {
          if (where.id !== run.id || where.state !== run.state || where.inputHash !== run.inputHash
            || where.evaluatorId !== run.evaluatorId || where.evaluatorVersion !== run.evaluatorVersion) return { count: 0 };
          runUpdates.push(data);
          Object.assign(run, data);
          return { count: 1 };
        },
      },
      gradingCriterionAssessment: {
        create: async ({ data }: any) => {
          assessments.push(data);
          return { id: 'evaluation-assessment-1', ...data };
        },
      },
      gradingAnnotation: {
        create: async ({ data }: any) => {
          annotations.push(data);
          return data;
        },
      },
      $transaction: async (callback: (tx: any) => Promise<unknown>) => callback(db),
    };

    const result = await persistValidatedGradingDraft({
      db,
      run,
      evidenceBlocks: [{ id: 'conversion-1:block-1', pageNumber: 2 }],
      draft: {
        evaluatorId: 'configured-openai',
        evaluatorVersion: 'model.v1',
        assessments: [{
          criterionId: 'criterion-1',
          levelId: 'full',
          score: 1,
          maxScore: 2,
          rationale: 'The evidence supports the selected criterion.',
          confidence: 0.9,
          anchors: [{ blockId: 'block-1', precision: 'block', excerpt: 'evidence', pageNumber: 2 }],
          limitationState: 'none',
          annotations: [{ reason: 'The intermediate step is incomplete.', comment: 'Check this step.', anchor: { blockId: 'block-1', precision: 'block', excerpt: 'evidence', pageNumber: 2 } }],
        }],
        limitations: ['evaluation-package-source'],
        overallComment: 'The draft remains subject to teacher review.',
        overallFeedback: { strengths: ['The conclusion is clear.'], problems: ['The working needs more detail.'], suggestions: ['Show the intermediate calculation.'] },
        inputHash: 'sha256:evaluation-input',
        evaluationIdentity: sha256(`grading:${run.id}:${run.evaluatorVersion}`),
        dedupeKey: 'grading-run:evaluation-draft',
        state: 'awaiting-review',
        blockedReasons: [],
        promptInjectionDetected: false,
        provider: 'configured-openai',
        providerRequestId: 'provider-request-1',
        deletionHandle: null,
        providerRequestedAt: now,
        providerProcessedAt: now,
        inputTokens: 321,
        outputTokens: 123,
        telemetryComplete: true,
      },
      afterPersist: async (_transaction, persistedRun) => {
        afterPersistStates.push(persistedRun.state);
      },
      now,
    });

    expect(result).toEqual(expect.objectContaining({ id: run.id, answerAttemptId: null, state: 'AWAITING_REVIEW' }));
    expect(assessments).toEqual([expect.objectContaining({ gradingRunId: run.id, criterionId: 'criterion-1', score: 1 })]);
    expect(annotations).toHaveLength(1);
    expect(annotations).toEqual(expect.arrayContaining([
      expect.objectContaining({ blockId: 'conversion-1:block-1', reason: 'The intermediate step is incomplete.', authorRole: 'AI_DRAFT' }),
    ]));
    expect(runUpdates).toEqual([expect.objectContaining({
      state: 'AWAITING_REVIEW',
      provider: 'configured-openai',
      draftTotalScore: 1,
      overallFeedback: { strengths: ['The conclusion is clear.'], problems: ['The working needs more detail.'], suggestions: ['Show the intermediate calculation.'] },
      limitations: ['evaluation-package-source'],
      providerInputTokens: 321,
      providerOutputTokens: 123,
      providerTelemetryComplete: true,
    })]);
    expect(afterPersistStates).toEqual(['AWAITING_REVIEW']);
    expect(runUpdates.some((update) => update.state === 'APPROVED' || 'teacherReviewedAt' in update)).toBe(false);
  });

  it('rejects a draft whose input or evaluator identity does not match the frozen run', async () => {
    const run = {
      id: 'evaluation-run-identity',
      state: 'RUNNING',
      inputHash: 'sha256:frozen-input',
      evaluatorId: 'configured-openai',
      evaluatorVersion: 'model.v1',
    };
    const db: any = {
      gradingRun: {
        findUnique: async () => run,
        updateMany: async () => ({ count: 1 }),
        update: async () => run,
      },
      gradingCriterionAssessment: { create: async () => ({ id: 'assessment' }) },
      gradingAnnotation: { create: async () => ({}) },
      $transaction: async (callback: (tx: any) => Promise<unknown>) => callback(db),
    };
    const draft = {
      evaluatorId: run.evaluatorId,
      evaluatorVersion: run.evaluatorVersion,
      assessments: [],
      limitations: [],
      overallComment: 'The draft remains subject to teacher review.',
      inputHash: run.inputHash,
      evaluationIdentity: sha256(`grading:${run.id}:${run.evaluatorVersion}`),
      dedupeKey: 'grading-run:evaluation-identity',
      state: 'awaiting-review' as const,
      blockedReasons: [],
      promptInjectionDetected: false,
      provider: run.evaluatorId,
      providerRequestId: null,
      deletionHandle: null,
      providerRequestedAt: null,
      providerProcessedAt: null,
    };

    await expect(persistValidatedGradingDraft({ db, run, evidenceBlocks: [], draft: { ...draft, inputHash: 'sha256:wrong' } }))
      .rejects.toThrow('grading-draft-input-hash-mismatch');
    await expect(persistValidatedGradingDraft({ db, run, evidenceBlocks: [], draft: { ...draft, evaluatorVersion: 'model.v2' } }))
      .rejects.toThrow('grading-draft-evaluator-version-mismatch');
    run.state = 'AWAITING_REVIEW';
    await expect(persistValidatedGradingDraft({ db, run, evidenceBlocks: [], draft }))
      .rejects.toThrow('grading-run-not-running');
  });

  it('rejects a draft produced for a different repetition run with identical frozen inputs', async () => {
    const firstRun = {
      id: 'evaluation-run-ordinal-1',
      state: 'RUNNING',
      inputHash: 'sha256:shared-input',
      evaluatorId: 'configured-openai',
      evaluatorVersion: 'model.v1',
    };
    const secondRun = { ...firstRun, id: 'evaluation-run-ordinal-2' };
    const runs = new Map([[firstRun.id, firstRun], [secondRun.id, secondRun]]);
    const db: any = {
      gradingRun: {
        findUnique: async ({ where }: any) => runs.get(where.id) ?? null,
        updateMany: async ({ where, data }: any) => {
          const run = runs.get(where.id);
          if (!run || run.state !== where.state || run.inputHash !== where.inputHash
            || run.evaluatorId !== where.evaluatorId || run.evaluatorVersion !== where.evaluatorVersion) return { count: 0 };
          Object.assign(run, data);
          return { count: 1 };
        },
        update: async ({ where, data }: any) => Object.assign(runs.get(where.id)!, data),
      },
      gradingCriterionAssessment: { create: async () => ({ id: 'assessment' }) },
      gradingAnnotation: { create: async () => ({}) },
      $transaction: async (callback: (tx: any) => Promise<unknown>) => callback(db),
    };
    const draft = {
      evaluatorId: firstRun.evaluatorId,
      evaluatorVersion: firstRun.evaluatorVersion,
      assessments: [],
      limitations: [],
      overallComment: 'The draft remains subject to teacher review.',
      inputHash: firstRun.inputHash,
      evaluationIdentity: sha256(`grading:${firstRun.id}:${firstRun.evaluatorVersion}`),
      dedupeKey: 'grading-run:evaluation-repetition-identity',
      state: 'awaiting-review' as const,
      blockedReasons: [],
      promptInjectionDetected: false,
      provider: firstRun.evaluatorId,
      providerRequestId: null,
      deletionHandle: null,
      providerRequestedAt: null,
      providerProcessedAt: null,
    };

    await expect(persistValidatedGradingDraft({ db, run: secondRun, evidenceBlocks: [], draft }))
      .rejects.toThrow('grading-draft-evaluation-identity-mismatch');
    await expect(persistValidatedGradingDraft({ db, run: firstRun, evidenceBlocks: [], draft }))
      .resolves.toEqual(expect.objectContaining({ id: firstRun.id, state: 'AWAITING_REVIEW' }));
  });

  it('converges a run and job to CANCELLED when the provider is paused and cancellation wins before draft persistence', async () => {
    const question = submittedAttempt().answer.question;
    (question.rubricSnapshot.criteria[0].levels as any) = [{ id: 'excellent', label: 'Excellent', minPoints: 4, maxPoints: 5, description: 'Complete evidence.' }];
    const run: any = {
      id: 'run-provider-cancelled',
      batchId: 'batch-provider-cancelled',
      state: 'QUEUED',
      answerAttemptId: 'attempt-provider-cancelled',
      answerEvidenceId: 'evidence-provider-cancelled',
      questionId: question.id,
      rubricId: 'rubric:question-1',
      rubricSnapshot: question.rubricSnapshot,
      answerEvidence: {
        id: 'evidence-provider-cancelled',
        version: 1,
        sourceKind: 'TEXT_NATIVE',
        sourceHash: 'sha256:evidence-provider-cancelled',
        canonicalMarkdown: '冻结证据',
        anchorVersion: 'text-native.v1',
        precision: 'SPAN',
        readiness: 'READY',
        limitationState: 'none',
        limitations: [],
        blocks: [{ id: 'evidence-provider-cancelled:block-1', blockIndex: 0, pageNumber: null, text: '冻结证据', markdown: '冻结证据', spanStart: 0, spanEnd: 4, bbox: null, precision: 'SPAN', confidence: 1 }],
      },
      question,
      questionSnapshot: {
        assignmentRevisionId: question.assignmentRevisionId,
        questionId: question.id,
        stableQuestionId: question.stableQuestionId,
        responseType: question.responseType,
        prompt: 'Explain stability.',
        referenceAnswer: 'Cite the margin.',
        rubric: { schemaVersion: 'assignment-analytic-rubric.v1', id: 'rubric:question-1', version: 'sha256:question', maxScore: 5, criteria: question.rubricSnapshot.criteria },
        contentHash: 'sha256:question',
      },
      questionSnapshotHash: 'sha256:question',
      rubricVersion: 'sha256:question',
      referenceAnswer: 'Cite the margin.',
      evaluatorId: 'provider-1',
      evaluatorVersion: 'model.v1',
      policy: null,
      answerAttempt: { id: 'attempt-provider-cancelled', answerId: 'answer-provider-cancelled', answer: { submission: { frozenAudienceClassId: 'class-1' } } },
    };
    const batch: any = { id: run.batchId, cancellationRequestedAt: null };
    const job: any = { id: 'job-provider-cancelled', state: 'QUEUED', cancelRequestedAt: null, gradingRun: run };
    const assessments: any[] = [];
    const annotations: any[] = [];
    let providerStarted!: () => void;
    let releaseProvider!: () => void;
    const started = new Promise<void>((resolve) => { providerStarted = resolve; });
    const paused = new Promise<void>((resolve) => { releaseProvider = resolve; });
    const db: any = {
      ...lifecyclePolicyRepository(),
      gradingJob: {
        findUnique: async () => job,
        updateMany: async ({ where, data }: any) => {
          if (!where.state.in.includes(job.state)) return { count: 0 };
          Object.assign(job, data);
          return { count: 1 };
        },
      },
      gradingRun: {
        findUnique: async () => run,
        updateMany: async ({ where, data }: any) => {
          if (!where.state.in.includes(run.state)) return { count: 0 };
          Object.assign(run, data);
          return { count: 1 };
        },
      },
      gradingBatch: { findUnique: async () => batch },
      gradingCriterionAssessment: { create: async ({ data }: any) => { assessments.push(data); return data; } },
      gradingAnnotation: { create: async ({ data }: any) => { annotations.push(data); return data; } },
      $transaction: async (callback: (tx: any) => Promise<unknown>) => callback(db),
    };
    const processing = processGradingRunJob({
      db,
      jobId: job.id,
      policy: gradingPolicy() as ExternalProcessingPolicy,
      provider: {
        id: 'provider-1',
        version: 'model.v1',
        evaluate: async () => {
          providerStarted();
          await paused;
          return {
            evaluatorId: 'provider-1',
            evaluatorVersion: 'model.v1',
            assessments: [{ criterionId: 'criterion-1', levelId: 'excellent', score: 5, maxScore: 5, rationale: 'Grounded in evidence.', confidence: 0.9, anchors: [{ blockId: 'block-1', precision: 'span', excerpt: '冻结证据', spanStart: 0, spanEnd: 4 }], limitationState: 'none', annotations: [] }],
            limitations: [],
            overallComment: 'Draft remains pending review.',
            overallFeedback: { strengths: ['The conclusion is clear.'], problems: ['The reasoning can be expanded.'], suggestions: ['Show the supporting calculation.'] },
          };
        },
      },
      now,
    });
    await started;
    batch.cancellationRequestedAt = now;
    job.cancelRequestedAt = now;
    releaseProvider();
    const result = await processing;
    expect(result.run.state).toBe('CANCELLED');
    expect(job.state).toBe('CANCELLED');
    expect(assessments).toHaveLength(0);
    expect(annotations).toHaveLength(0);
  });

  it('links explicit reruns to the produced run and job while keeping distinct history', async () => {
    const reruns: any[] = [];
    const runs: any[] = [];
    const jobs: any[] = [];
    const evidenceRow = {
      id: 'evidence-1',
      attemptId: 'attempt-1',
      version: 3,
      sourceHash: 'sha256:evidence',
      canonicalMarkdown: 'evidence',
      anchorVersion: 'text-native.v1',
      sourceKind: 'TEXT_NATIVE',
      precision: 'SPAN',
      readiness: 'READY',
      limitationState: 'none',
      limitations: [],
      blocks: [],
      attempt: submittedAttempt(),
    };
    const db: any = {
      ...lifecyclePolicyRepository(),
      answerEvidence: { findUnique: async () => evidenceRow },
      gradingRun: {
        findUnique: async () => null,
        create: async ({ data }: any) => { const row = { ...data, jobs: [] }; runs.push(row); return row; },
      },
      gradingJob: {
        findUnique: async () => null,
        create: async ({ data }: any) => { const row = { ...data }; jobs.push(row); return row; },
      },
      gradingRerun: {
        create: async ({ data }: any) => { reruns.push(data); return data; },
      },
    };

    const first = await enqueueGradingRun({
      db,
      attemptId: 'attempt-1',
      evidenceId: 'evidence-1',
      actor: { id: 'teacher-1', role: 'TEACHER' },
      idempotencyKey: 'rerun-request-001',
      evaluatorId: 'client-forged-provider',
      evaluatorVersion: 'client-forged-version',
      rerunReason: 'provider timeout',
      now,
    });
    const second = await enqueueGradingRun({
      db,
      attemptId: 'attempt-1',
      evidenceId: 'evidence-1',
      actor: { id: 'teacher-1', role: 'TEACHER' },
      idempotencyKey: 'rerun-request-002',
      evaluatorId: 'client-forged-provider',
      evaluatorVersion: 'client-forged-version',
      rerunReason: 'rubric correction',
      now,
    });

    expect(first.run.id).not.toBe(second.run.id);
    expect(new Set(runs.map((run) => run.rerunIdentity)).size).toBe(2);
    expect(reruns).toEqual(expect.arrayContaining([
      expect.objectContaining({ gradingRunId: first.run.id, gradingJobId: jobs[0].id }),
      expect.objectContaining({ gradingRunId: second.run.id, gradingJobId: jobs[1].id }),
    ]));
    expect(runs.every((run) => run.evaluatorId !== 'client-forged-provider' && run.evaluatorVersion !== 'client-forged-version')).toBe(true);
  });

  it('replays only the same explicit rerun idempotency key and preserves a new history for a different key', async () => {
    const runs: any[] = [];
    const jobs: any[] = [];
    const reruns: any[] = [];
    const evidenceRow = {
      id: 'evidence-rerun-key',
      attemptId: 'attempt-1',
      version: 3,
      sourceHash: 'sha256:evidence',
      canonicalMarkdown: 'evidence',
      anchorVersion: 'text-native.v1',
      sourceKind: 'TEXT_NATIVE',
      precision: 'SPAN',
      readiness: 'READY',
      limitationState: 'none',
      limitations: [],
      blocks: [],
      attempt: submittedAttempt(),
    };
    const db: any = {
      ...lifecyclePolicyRepository(),
      answerEvidence: { findUnique: async () => evidenceRow },
      gradingRun: {
        findUnique: async ({ where }: any) => runs.find((run) => run.dedupeKey === where.dedupeKey) ?? null,
        create: async ({ data }: any) => { const row = { ...data, jobs: [] }; runs.push(row); return row; },
      },
      gradingJob: {
        findUnique: async ({ where }: any) => jobs.find((job) => job.dedupeKey === where.dedupeKey) ?? null,
        create: async ({ data }: any) => { const row = { ...data }; jobs.push(row); return row; },
      },
      gradingRerun: { create: async ({ data }: any) => { reruns.push(data); return data; } },
    };
    const request = (idempotencyKey: string) => ({
      db,
      attemptId: 'attempt-1',
      evidenceId: 'evidence-rerun-key',
      actor: { id: 'teacher-1', role: 'TEACHER' as const },
      idempotencyKey,
      evaluatorId: 'client-forged-provider',
      evaluatorVersion: 'client-forged-version',
      rerunReason: 'provider timeout',
      now,
    });

    const first = await enqueueGradingRun(request('rerun-key-a'));
    const replay = await enqueueGradingRun(request('rerun-key-a'));
    const second = await enqueueGradingRun(request('rerun-key-b'));

    expect(replay.replay).toBe(true);
    expect(replay.run.id).toBe(first.run.id);
    expect(second.replay).toBe(false);
    expect(second.run.id).not.toBe(first.run.id);
    expect(second.run.rerunIdentity).not.toBe(first.run.rerunIdentity);
    expect(reruns).toHaveLength(2);
    expect(reruns).toEqual(expect.arrayContaining([
      expect.objectContaining({ gradingRunId: first.run.id, gradingJobId: first.job.id, reason: 'provider timeout' }),
      expect.objectContaining({ gradingRunId: second.run.id, gradingJobId: second.job.id, reason: 'provider timeout' }),
    ]));
  });

  it('replays a conversion request by actor and key, then conflicts when the normalized payload changes', async () => {
    const conversions: any[] = [];
    const jobs: any[] = [];
    const requestRows: any[] = [];
    const conversionPolicy = gradingPolicy({ provider: 'mathpix', purpose: 'answer-conversion', endpoint: 'https://api.mathpix.com/v3/pdf', credentialRef: 'env:MATHPIX_APP_KEY' });
    const imageConversionPolicy = { ...conversionPolicy, id: 'grading-provider:mathpix:mathpix.v1:image', version: 'mathpix.v1:image', endpoint: 'https://api.mathpix.com/v3/text' };
    const asset = {
      id: 'asset-idempotency-1',
      answerId: 'answer-1',
      attemptId: 'attempt-1',
      version: 1,
      objectKey: 'quarantine/idempotency-answer',
      originalName: 'answer.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 10,
      checksum: 'sha256:asset',
      state: 'FINALIZED',
      scanState: 'CLEAN',
      answer: {
        submission: {
          frozenAudienceClassId: 'class-1',
          frozenStudentId: 'student-1',
          audience: { classId: 'class-1', class: { teacherId: 'teacher-1' } },
        },
        question: { assignmentRevisionId: 'revision-1' },
      },
      attempt: { id: 'attempt-1', answerId: 'answer-1' },
    };
    const db: any = {
      ...lifecyclePolicyRepository(),
      submissionAsset: { findUnique: async () => asset },
      gradingProviderPolicy: { findUnique: async ({ where }: any) => where.id === imageConversionPolicy.id ? imageConversionPolicy : conversionPolicy },
      documentConversion: {
        findUnique: async ({ where }: any) => {
          const row = where.id
            ? conversions.find((candidate) => candidate.id === where.id)
            : conversions.find((candidate) => candidate.dedupeKey === where.dedupeKey);
          return row ? { ...row, jobs: jobs.filter((job) => job.conversionId === row.id) } : null;
        },
        findFirst: async () => conversions.at(-1) ? { version: conversions.at(-1).version } : null,
        create: async ({ data }: any) => {
          const row = { ...data };
          conversions.push(row);
          return row;
        },
      },
      gradingJob: {
        findUnique: async ({ where }: any) => jobs.find((job) => job.dedupeKey === where.dedupeKey || job.id === where.id) ?? null,
        create: async ({ data }: any) => { const row = { ...data }; jobs.push(row); return row; },
      },
      gradingRequestIdempotency: requestIdempotencyRepository(requestRows),
      $transaction: async (callback: (tx: any) => Promise<unknown>) => callback(db),
    };
    const request = (adapterVersion: string) => enqueueDocumentConversion({
      db,
      assetId: asset.id,
      attemptId: asset.attemptId,
      actor: { id: 'teacher-1', role: 'TEACHER' },
      adapterVersion,
      policyId: 'policy-1',
      idempotencyKey: 'conversion-request-001',
      now,
    });

    const first = await request('router.v1');
    const replay = await request('router.v1');
    expect(replay.replay).toBe(true);
    expect(replay.conversion.id).toBe(first.conversion.id);
    await expect(request('router.v2')).rejects.toMatchObject({ code: 'idempotency-key-conflict', status: 409 });
    expect(conversions).toHaveLength(1);
    expect(requestRows).toHaveLength(1);
    expect(conversions[0].policySnapshot).toEqual(expect.objectContaining({ model: 'model.v1', credentialRef: 'env:MATHPIX_APP_KEY' }));
    expect(conversions[0].policySnapshotHash).toMatch(/^sha256:/);

    asset.mimeType = 'image/png';
    asset.originalName = 'answer.png';
    await expect(enqueueDocumentConversion({
      db, assetId: asset.id, attemptId: asset.attemptId, actor: { id: 'teacher-1', role: 'TEACHER' }, adapterVersion: 'router.v1', policyId: 'policy-1', idempotencyKey: 'conversion-cross-policy-001', now,
    })).rejects.toThrow('provider-policy-mime-endpoint-mismatch');
    expect(conversions).toHaveLength(1);

    vi.stubEnv('GRADING_MATHPIX_ENABLED', 'true');
    vi.stubEnv('GRADING_MATHPIX_POLICY_VERSION', 'mathpix.v1');
    const autoSelected = await enqueueDocumentConversion({
      db, assetId: asset.id, attemptId: asset.attemptId, actor: { id: 'teacher-1', role: 'TEACHER' }, adapterVersion: 'router.v1', idempotencyKey: 'conversion-auto-image-001', now,
    });
    vi.unstubAllEnvs();
    expect(autoSelected.conversion).toMatchObject({ policyId: imageConversionPolicy.id, policySnapshot: expect.objectContaining({ endpoint: 'https://api.mathpix.com/v3/text' }) });

    vi.stubEnv('GRADING_MATHPIX_ENABLED', 'true');
    vi.stubEnv('GRADING_MATHPIX_POLICY_VERSION', 'mathpix.v1');
    const frozenWithoutPolicy = await enqueueDocumentConversion({
      db,
      assetId: asset.id,
      attemptId: asset.attemptId,
      actor: { id: 'teacher-1', role: 'TEACHER' },
      adapterVersion: 'assignment-understanding.v1',
      allowDefaultPolicyDiscovery: false,
      idempotencyKey: 'conversion-frozen-without-policy-001',
      now,
    });
    vi.unstubAllEnvs();
    expect(frozenWithoutPolicy.conversion).toMatchObject({
      policyId: null,
      policySnapshot: null,
    });
  });

  it('replays a grading request by actor and key, then conflicts when the evidence payload changes', async () => {
    const runs: any[] = [];
    const jobs: any[] = [];
    const requestRows: any[] = [];
    const attempt = submittedAttempt();
    const evidenceRows = ['evidence-idempotency-1', 'evidence-idempotency-2'].map((id) => ({
      id,
      attemptId: attempt.id,
      version: 1,
      sourceHash: `sha256:${id}`,
      canonicalMarkdown: 'evidence',
      anchorVersion: 'text-native.v1',
      sourceKind: 'TEXT_NATIVE',
      precision: 'SPAN',
      readiness: 'READY',
      limitationState: 'none',
      limitations: [],
      blocks: [],
      attempt,
    }));
    const db: any = {
      ...lifecyclePolicyRepository(),
      answerEvidence: { findUnique: async ({ where }: any) => evidenceRows.find((row) => row.id === where.id) ?? null },
      gradingProviderPolicy: { findUnique: async () => gradingPolicy() },
      gradingRun: {
        findUnique: async ({ where }: any) => {
          const row = where.id ? runs.find((candidate) => candidate.id === where.id) : runs.find((candidate) => candidate.dedupeKey === where.dedupeKey);
          return row ? { ...row, jobs: jobs.filter((job) => job.gradingRunId === row.id) } : null;
        },
        create: async ({ data }: any) => { const row = { ...data }; runs.push(row); return row; },
      },
      gradingJob: {
        findUnique: async ({ where }: any) => jobs.find((job) => job.dedupeKey === where.dedupeKey || job.id === where.id) ?? null,
        create: async ({ data }: any) => { const row = { ...data }; jobs.push(row); return row; },
      },
      gradingRequestIdempotency: requestIdempotencyRepository(requestRows),
      $transaction: async (callback: (tx: any) => Promise<unknown>) => callback(db),
    };
    const request = (evidenceId: string) => enqueueGradingRun({
      db,
      attemptId: attempt.id,
      evidenceId,
      actor: { id: 'teacher-1', role: 'TEACHER' },
      idempotencyKey: 'grading-request-001',
      policyId: 'policy-1',
      evaluatorId: 'provider-1',
      evaluatorVersion: 'model.v1',
      now,
    });

    const first = await request(evidenceRows[0].id);
    const replay = await request(evidenceRows[0].id);
    expect(replay.replay).toBe(true);
    expect(replay.run.id).toBe(first.run.id);
    await expect(request(evidenceRows[1].id)).rejects.toMatchObject({ code: 'idempotency-key-conflict', status: 409 });
    expect(runs).toHaveLength(1);
    expect(requestRows).toHaveLength(1);
    expect(runs[0].policySnapshot).toEqual(expect.objectContaining({ model: 'model.v1', classScope: ['class-1'] }));
    expect(runs[0].policySnapshotHash).toMatch(/^sha256:/);
  });

  it('blocks a conversion job when its persisted policy snapshot no longer matches the live policy before provider access', async () => {
    const oldPolicy: any = { ...gradingPolicy({ provider: 'mathpix', purpose: 'answer-conversion', endpoint: 'https://api.mathpix.com/v3/text', credentialRef: 'env:MATHPIX_APP_KEY' }) };
    delete oldPolicy.id;
    const currentPolicy = { ...oldPolicy, model: 'mathpix.v2' };
    const mathpix = { convert: vi.fn() };
    const bytes = new TextEncoder().encode('answer');
    const checksum = sha256(bytes);
    const store = new MemorySubmissionObjectStore();
    store.put({ key: 'quarantine/policy-frozen', ownerId: 'student-1', answerId: 'answer-1', sizeBytes: bytes.byteLength, mimeType: 'application/pdf', checksum, scanState: 'CLEAN' });
    store.payloads.set('quarantine/policy-frozen', bytes);
    const conversion: any = {
      id: 'conversion-policy-frozen',
      policyId: 'policy-1',
      policySnapshot: oldPolicy,
      policySnapshotHash: externalProcessingPolicyHash(oldPolicy),
      state: 'QUEUED',
      asset: { id: 'asset-1', answerId: 'answer-1', objectKey: 'quarantine/policy-frozen', originalName: 'answer.pdf', mimeType: 'application/pdf', sizeBytes: bytes.byteLength, checksum, answer: { submission: { frozenStudentId: 'student-1', frozenAudienceClassId: 'class-1' } } },
      attemptId: 'attempt-1',
      answerEvidence: null,
      policy: currentPolicy,
    };
    const job: any = { id: 'job-policy-frozen', state: 'QUEUED', cancelRequestedAt: null, conversion };
    const db: any = {
      gradingProviderPolicy: { findUnique: async () => currentPolicy },
      gradingJob: { findUnique: async () => job, update: async ({ data }: any) => Object.assign(job, data) },
      documentConversion: { update: async ({ data }: any) => Object.assign(conversion, data) },
      $transaction: async (callback: (tx: any) => Promise<unknown>) => callback(db),
    };

    await expect(processDocumentConversionJob({ db, jobId: job.id, store, mathpix, now })).rejects.toThrow('provider-policy-snapshot-mismatch');
    expect(mathpix.convert).not.toHaveBeenCalled();
  });

  it('blocks a conversion worker when its frozen policy has the grading purpose', async () => {
    const wrongPolicy: any = { ...gradingPolicy({ provider: 'mathpix', purpose: 'rubric-grading', endpoint: 'https://api.mathpix.com/v3/text', credentialRef: 'env:MATHPIX_APP_KEY' }) };
    delete wrongPolicy.id;
    const mathpix = { convert: vi.fn() };
    const conversion: any = { id: 'conversion-purpose-mismatch', policyId: 'policy-1', policySnapshot: wrongPolicy, policySnapshotHash: externalProcessingPolicyHash(wrongPolicy), state: 'QUEUED', asset: {}, attemptId: 'attempt-1', answerEvidence: null, policy: wrongPolicy };
    const job: any = { id: 'job-purpose-mismatch', state: 'QUEUED', cancelRequestedAt: null, conversion };
    const db: any = {
      gradingProviderPolicy: { findUnique: async () => wrongPolicy },
      gradingJob: { findUnique: async () => job },
    };
    await expect(processDocumentConversionJob({ db, jobId: job.id, store: new MemorySubmissionObjectStore(), mathpix, now })).rejects.toThrow('provider-policy-purpose-mismatch');
    expect(mathpix.convert).not.toHaveBeenCalled();
  });

  it('blocks an AI grading job when its persisted policy scope changes before provider access', async () => {
    const oldPolicy: any = { ...gradingPolicy() };
    delete oldPolicy.id;
    const currentPolicy = { ...oldPolicy, classScope: ['class-2'] };
    const provider = { id: 'provider-1', version: 'model.v1', evaluate: vi.fn() };
    const run: any = {
      id: 'run-policy-frozen',
      state: 'QUEUED',
      policyId: 'policy-1',
      policySnapshot: oldPolicy,
      policySnapshotHash: externalProcessingPolicyHash(oldPolicy),
      policy: currentPolicy,
    };
    const job: any = { id: 'job-policy-frozen-grading', state: 'QUEUED', gradingRun: run };
    const db: any = {
      ...lifecyclePolicyRepository(),
      gradingProviderPolicy: { findUnique: async () => currentPolicy },
      gradingJob: { findUnique: async () => job },
    };

    await expect(processGradingRunJob({ db, jobId: job.id, provider, now })).rejects.toThrow('provider-policy-snapshot-mismatch');
    expect(provider.evaluate).not.toHaveBeenCalled();
  });

  it('evaluates the persisted frozen question snapshot instead of a drifted current question', async () => {
    const frozenQuestion = {
      ...submittedAttempt().answer.question,
      promptSnapshot: { text: 'FROZEN PROMPT' },
      answerSnapshot: { text: 'FROZEN REFERENCE ANSWER' },
      rubricSnapshot: {
        schemaVersion: 'assignment-analytic-rubric.v1',
        criteria: [{
          id: 'criterion-1',
          label: 'Frozen criterion',
          maxPoints: 5,
          evidenceDescription: 'stability',
          feedbackGuidance: 'Use the frozen evidence.',
          levels: [{ id: 'excellent', label: 'Excellent', minPoints: 4, maxPoints: 5, description: 'Complete evidence.' }],
        }],
      },
    };
    const currentQuestion = {
      ...frozenQuestion,
      promptSnapshot: { text: 'DRIFTED CURRENT PROMPT' },
      answerSnapshot: { text: 'DRIFTED CURRENT ANSWER' },
    };
    const job = {
      id: 'job-frozen-1',
      gradingRun: {
        id: 'run-frozen-1',
        answerAttemptId: 'attempt-frozen-1',
        answerEvidenceId: 'evidence-frozen-1',
        questionId: frozenQuestion.id,
        rubricId: 'rubric:question-1',
        answerEvidence: {
          id: 'evidence-frozen-1',
          sourceKind: 'TEXT_NATIVE',
          sourceHash: 'sha256:frozen-evidence',
          canonicalMarkdown: '冻结证据',
          anchorVersion: 'text-native.v1',
          precision: 'SPAN',
          readiness: 'READY',
          limitationState: 'none',
          limitations: [],
          blocks: [{ id: 'evidence-frozen-1:block-1', blockIndex: 0, pageNumber: null, text: '冻结证据', markdown: '冻结证据', spanStart: 0, spanEnd: 4, bbox: null, precision: 'SPAN', confidence: 1 }],
        },
        question: currentQuestion,
        questionSnapshot: { ...frozenQuestion, contentHash: 'sha256:frozen-question' },
        rubricSnapshot: frozenQuestion.rubricSnapshot,
        referenceAnswer: 'FROZEN REFERENCE ANSWER',
        questionSnapshotHash: 'sha256:frozen-question',
        policy: null,
        answerAttempt: { id: 'attempt-frozen-1', answerId: 'answer-frozen-1', answer: { submission: { frozenAudienceClassId: 'class-1' } } },
      },
    };
    const prompts: string[] = [];
    const updates: any[] = [];
    const db: any = {
      ...lifecyclePolicyRepository(),
      gradingJob: { findUnique: async () => job, updateMany: async ({ data }: any) => { updates.push(data); return { count: 1 }; }, update: async ({ data }: any) => { updates.push(data); return data; } },
      gradingRun: { update: async ({ data }: any) => { updates.push(data); return { ...job.gradingRun, ...data }; } },
      $transaction: async (callback: (tx: any) => Promise<unknown>) => callback(db),
      gradingCriterionAssessment: { create: async ({ data }: any) => ({ id: 'assessment-frozen-1', ...data }) },
      gradingAnnotation: { create: async ({ data }: any) => data },
    };
    const result = await processGradingRunJob({
      db,
      jobId: job.id,
      policy: {
        provider: 'ai-evaluator',
        version: 'policy.v1',
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
      },
      provider: {
        id: 'provider-1',
        version: 'model.v1',
        evaluate: async ({ user }: { user: string }) => {
          prompts.push(user);
          return {
            evaluatorId: 'provider-1',
            evaluatorVersion: 'model.v1',
            assessments: [{ criterionId: 'criterion-1', levelId: 'excellent', score: 5, maxScore: 5, rationale: 'The frozen evidence supports the criterion.', confidence: 0.9, anchors: [{ blockId: 'block-1', precision: 'span', excerpt: '冻结证据', spanStart: 0, spanEnd: 4 }], limitationState: 'none', annotations: [] }],
            limitations: [],
            overallComment: 'The frozen question and evidence were used.',
            overallFeedback: { strengths: ['The conclusion is clear.'], problems: ['The reasoning can be expanded.'], suggestions: ['Show the supporting calculation.'] },
          };
        },
      },
      now,
    });
    expect(result.draft.state).toBe('awaiting-review');
    expect(prompts[0]).toContain('FROZEN PROMPT');
    expect(prompts[0]).not.toContain('DRIFTED CURRENT PROMPT');
    expect(updates).toEqual(expect.arrayContaining([expect.objectContaining({ state: 'AWAITING_REVIEW' })]));
  });

  it('supports conversion cancellation and explicit versioned retry through the protected asset binding', async () => {
    const asset = {
      id: 'asset-1',
      answerId: 'answer-1',
      attemptId: 'attempt-1',
      version: 1,
      objectKey: 'quarantine/a/answer-1',
      originalName: 'answer.docx',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      sizeBytes: 10,
      checksum: 'sha256:source',
      state: 'FINALIZED',
      scanState: 'CLEAN',
      answer: { submission: submittedAttempt().answer.submission, question: submittedAttempt().answer.question },
      attempt: { id: 'attempt-1', answerId: 'answer-1' },
    };
    const conversion = { id: 'conversion-1', assetId: 'asset-1', attemptId: 'attempt-1', adapterVersion: 'assignment-understanding.v1', policyId: null, policySnapshot: null, policySnapshotHash: null, version: 1, state: 'FAILED', asset };
    const updates: any[] = [];
    const createdConversions: any[] = [];
    const db: any = {
      ...lifecyclePolicyRepository(),
      documentConversion: {
        findUnique: async ({ where }: any) => where.id === 'conversion-1' ? conversion : null,
        findFirst: async () => ({ version: 1 }),
        update: async ({ data }: any) => { updates.push(data); return { ...conversion, ...data }; },
        create: async ({ data }: any) => { createdConversions.push(data); return { ...data, jobs: [] }; },
      },
      submissionAsset: { findUnique: async () => asset },
      gradingJob: {
        findUnique: async () => null,
        updateMany: async ({ data }: any) => { updates.push(data); return { count: 1 }; },
        create: async ({ data }: any) => data,
      },
      $transaction: async (callback: (tx: any) => Promise<unknown>) => callback(db),
    };
    const cancelled = await cancelDocumentConversion({ db, conversionId: 'conversion-1', actor: { id: 'teacher-1', role: 'TEACHER' }, now });
    expect(cancelled.cancellationRequestedAt).toBe(now);
    vi.stubEnv('GRADING_MATHPIX_ENABLED', 'true');
    vi.stubEnv('GRADING_MATHPIX_POLICY_VERSION', 'mathpix.v1');
    const retried = await retryDocumentConversion({ db, conversionId: 'conversion-1', actor: { id: 'teacher-1', role: 'TEACHER' }, idempotencyKey: 'conversion-retry-001', reason: 'provider timeout', now });
    vi.unstubAllEnvs();
    expect(retried.conversion.version).toBe(2);
    expect(retried.conversion.policyId).toBeNull();
    expect(retried.conversion.policySnapshot).toBeNull();
    expect(retried.job.reason).toBe('conversion-rerun:provider timeout');
    expect(retried.job.rerunIdentity).toContain('rerun:conversion:');
    await retryDocumentConversion({ db, conversionId: 'conversion-1', actor: { id: 'teacher-1', role: 'TEACHER' }, idempotencyKey: 'conversion-retry-002', reason: 'provider timeout', now });
    expect(createdConversions).toHaveLength(2);
    expect(createdConversions[1].dedupeKey).not.toBe(createdConversions[0].dedupeKey);
  });

  it('rejects a full-score annotation before it can cross the persistence boundary', async () => {
    const run = {
      id: 'evaluation-run-full-score-annotation',
      rubricSnapshot: { criteria: [{ id: 'criterion-1', maxPoints: 2 }] },
      state: 'RUNNING',
      inputHash: 'sha256:evaluation-input',
      evaluatorId: 'configured-openai',
      evaluatorVersion: 'model.v1',
    };
    const db: any = {
      gradingRun: { findUnique: async () => run, updateMany: async () => ({ count: 1 }) },
      $transaction: async (callback: (tx: any) => Promise<unknown>) => callback(db),
    };
    const draft: any = {
      evaluatorId: run.evaluatorId,
      evaluatorVersion: run.evaluatorVersion,
      assessments: [{
        criterionId: 'criterion-1', levelId: 'full', score: 2, maxScore: 2,
        rationale: 'The evidence supports the selected criterion.', confidence: 0.9,
        anchors: [], limitationState: 'none',
        annotations: [{ reason: 'A deduction reason.', comment: 'A student-visible comment.', anchor: { blockId: 'block-1', precision: 'block', excerpt: 'evidence' } }],
      }],
      limitations: [], overallComment: 'The draft remains subject to teacher review.',
      inputHash: run.inputHash,
      evaluationIdentity: sha256(`grading:${run.id}:${run.evaluatorVersion}`),
      dedupeKey: 'grading-run:full-score-annotation', state: 'awaiting-review', blockedReasons: [],
      promptInjectionDetected: false, provider: run.evaluatorId, providerRequestId: null, deletionHandle: null,
      providerRequestedAt: null, providerProcessedAt: null,
    };

    await expect(persistValidatedGradingDraft({ db, run, evidenceBlocks: [], draft }))
      .rejects.toThrow('grading-draft-annotation-without-deduction');

    const forgedMaxScore = structuredClone(draft);
    forgedMaxScore.assessments[0].score = 1;
    forgedMaxScore.assessments[0].maxScore = 1;
    await expect(persistValidatedGradingDraft({ db, run, evidenceBlocks: [], draft: forgedMaxScore }))
      .rejects.toThrow('grading-draft-score-invalid');
  });

  it('makes conversion cancellation actor-scoped and idempotent, including request conflicts', async () => {
    const requestRows: any[] = [];
    const asset = {
      id: 'asset-cancel-idempotency', answerId: 'answer-1', attemptId: 'attempt-1', version: 1,
      objectKey: 'quarantine/cancel-idempotency', originalName: 'answer.pdf', mimeType: 'application/pdf', sizeBytes: 10, checksum: 'sha256:source', state: 'FINALIZED', scanState: 'CLEAN',
      answer: { submission: submittedAttempt().answer.submission, question: submittedAttempt().answer.question },
      attempt: { id: 'attempt-1', answerId: 'answer-1' },
    };
    const conversion: any = { id: 'conversion-cancel-idempotency', assetId: asset.id, attemptId: asset.attemptId, state: 'QUEUED', cancellationRequestedAt: null, asset };
    const db: any = {
      documentConversion: {
        findUnique: async () => conversion,
        update: async ({ data }: any) => { Object.assign(conversion, data); return conversion; },
      },
      gradingJob: { updateMany: async () => ({ count: 1 }) },
      gradingAuditEvent: { create: async () => ({ id: 'audit-test' }) },
      gradingRequestIdempotency: requestIdempotencyRepository(requestRows),
      $transaction: async (callback: (tx: any) => Promise<unknown>) => callback(db),
    };
    const requestHash = buildGradingRequestHash('document-conversion-cancel', { conversionId: conversion.id });
    const first = await cancelDocumentConversion({ db, conversionId: conversion.id, actor: { id: 'teacher-1', role: 'TEACHER' }, idempotencyKey: 'cancel-conversion-001', requestHash, now });
    const replay = await cancelDocumentConversion({ db, conversionId: conversion.id, actor: { id: 'teacher-1', role: 'TEACHER' }, idempotencyKey: 'cancel-conversion-001', requestHash, now });
    expect(first.replay).toBe(false);
    expect(replay.replay).toBe(true);
    await expect(cancelDocumentConversion({ db, conversionId: conversion.id, actor: { id: 'teacher-1', role: 'TEACHER' }, idempotencyKey: 'cancel-conversion-001', requestHash: buildGradingRequestHash('document-conversion-cancel', { conversionId: 'other-conversion' }), now })).rejects.toMatchObject({ code: 'idempotency-key-conflict', status: 409 });
    expect(requestRows).toHaveLength(1);

    const raceRows: any[] = [];
    const raceDb: any = {
      ...db,
      gradingRequestIdempotency: {
        findFirst: async ({ where }: any) => raceRows.find((row) => row.operation === where.operation && row.scope === where.scope && row.actorPseudoId === where.actorPseudoId && row.idempotencyKey === where.idempotencyKey) ?? null,
        create: async ({ data }: any) => {
          raceRows.push({ ...data, resourceId: conversion.id });
          throw Object.assign(new Error('unique request idempotency key'), { code: 'P2002' });
        },
        update: async () => undefined,
      },
    };
    raceDb.$transaction = async (callback: (tx: any) => Promise<unknown>) => callback(raceDb);
    const race = await cancelDocumentConversion({ db: raceDb, conversionId: conversion.id, actor: { id: 'teacher-1', role: 'TEACHER' }, idempotencyKey: 'cancel-conversion-race', requestHash, now });
    expect(race.replay).toBe(true);
  });

  it('persists Word image evidence with opaque storage and blocks scoring without a visual description', async () => {
    const bytes = new TextEncoder().encode('word source');
    const checksum = sha256(bytes);
    const image = new Uint8Array([137, 80, 78, 71]);
    const store = new MemorySubmissionObjectStore();
    store.put({ key: 'quarantine/word-source', ownerId: 'student-1', answerId: 'answer-1', attemptId: 'attempt-1', sizeBytes: bytes.byteLength, mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', checksum, scanState: 'CLEAN' });
    store.payloads.set('quarantine/word-source', bytes);
    const visualRows: any[] = [];
    const conversion: any = {
      id: 'conversion-visual-1', assetId: 'asset-1', attemptId: 'attempt-1', version: 1, state: 'QUEUED', retentionExpiresAt: now,
      asset: {
        id: 'asset-1', answerId: 'answer-1', objectKey: 'quarantine/word-source', originalName: 'answer.docx', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', sizeBytes: bytes.byteLength, checksum,
        answer: { assignmentQuestionId: 'question-1', submission: { frozenStudentId: 'student-1', frozenAudienceClassId: 'class-1' } },
      },
      attempt: { id: 'attempt-1' }, policy: null, answerEvidence: null,
    };
    const db: any = {
      ...lifecyclePolicyRepository(),
      gradingJob: {
        findUnique: async () => ({ id: 'job-visual-1', state: 'QUEUED', cancelRequestedAt: null, conversion }),
        updateMany: async () => ({ count: 1 }),
      },
      documentConversion: { update: async ({ data }: any) => ({ ...conversion, ...data }) },
      documentConversionVisualEvidence: {
        deleteMany: async () => undefined,
        createMany: async ({ data }: any) => { visualRows.push(...data); },
      },
      gradingConversionWarning: { createMany: async () => undefined },
      answerEvidence: {
        findFirst: async () => null,
        create: async ({ data }: any) => ({ ...data, blocks: data.blocks.create }),
      },
      $transaction: async (callback: (tx: any) => Promise<unknown>) => callback(db),
    };

    const result = await processDocumentConversionJob({
      db,
      jobId: 'job-visual-1',
      store,
      writeRendered: async ({ key, bytes: rendered, mimeType, checksum: renderedChecksum, ownerId, answerId, attemptId, workerClaimToken }: any) => {
        store.put({ key, ownerId, answerId, attemptId, workerClaimFingerprint: sha256(workerClaimToken), sizeBytes: rendered.byteLength, mimeType, checksum: renderedChecksum, scanState: 'PENDING' });
        store.payloads.set(key, rendered);
        return key;
      },
      local: {
        convert: async () => ({
          markdown: '作答文本',
          blocks: [{ id: 'block-1', blockIndex: 0, text: '作答文本', markdown: '作答文本', precision: 'block' as const, confidence: 0.9 }],
          wordRepresentation: {
            schemaVersion: 'math-document-word-representation.v1',
            anchorVersion: 'math-document-word-anchor.v1',
            sourceFormat: 'docx',
            normalizedFormat: 'docx',
            extractorVersion: 'word-representation.v1',
            sourceChecksum: checksum,
            normalizedChecksum: checksum,
            renderedPdfChecksum: checksum,
            renderedPdfPageCount: 1,
            normalizerVersion: null,
            rendererVersion: 'test-renderer.v1',
            normalizedDocxBytes: Buffer.from(image),
            renderedPdfBytes: Buffer.from(image),
            markdown: '作答文本',
            blocks: [],
            paragraphs: [],
            formulas: [],
            images: [{ id: 'image-1', paragraphId: 'paragraph-1', questionId: null, relationshipId: 'rId1', path: 'word/media/image1.png', mediaType: 'image/png', checksum: sha256(image), bytes: Buffer.from(image) }],
            imageAnchors: [],
            anchors: [{ blockId: 'block-1', paragraphId: 'paragraph-1', questionId: null, sourcePart: 'word/document.xml', pdfPageNumber: 1, bbox: null, coordinateProvenance: null, precision: 'page', mappingDecision: 'pdf-page-match', mappingConfidence: 0.92, verified: true }],
            questionStates: [],
            integrity: { verdict: 'scorable', issues: [] },
          },
        }),
      },
      now,
    });

    expect(visualRows).toEqual([expect.objectContaining({
      questionId: 'question-1', sourceKind: 'word-embedded-image', mediaType: 'image/png', pageNumber: 1, readiness: 'review-required', sizeBytes: image.byteLength,
    })]);
    expect(visualRows[0].objectKey).not.toContain('student-1');
    expect(result.evidence).toEqual(expect.objectContaining({ readiness: 'BLOCKED', limitationState: 'visual-evidence-incomplete' }));
  });

  it('projects a policy-approved visual description into ready evidence with provider audit fields', async () => {
    const image = new Uint8Array([137, 80, 78, 71]);
    const checksum = sha256(image);
    const store = new MemorySubmissionObjectStore();
    store.put({ key: 'quarantine/visual-source', ownerId: 'student-1', answerId: 'answer-1', attemptId: 'attempt-1', sizeBytes: image.byteLength, mimeType: 'image/png', checksum, scanState: 'CLEAN' });
    store.payloads.set('quarantine/visual-source', image);
    const visualPolicy = gradingPolicy({
      id: 'policy-visual',
      version: 'visual.v1',
      model: 'vision-model.v1',
      purpose: 'visual-description',
      dataCategories: ['student-answer', 'student-answer-visual'],
      minimizedScope: ['selected-question', 'answer-evidence', 'visual-evidence'],
      providerRetentionSeconds: 60,
    });
    const visualRows: any[] = [];
    const conversion: any = {
      id: 'conversion-described-image', assetId: 'asset-described-image', attemptId: 'attempt-1', version: 1, state: 'QUEUED', retentionExpiresAt: now,
      visualPolicyId: visualPolicy.id, visualPolicySnapshot: visualPolicy, visualPolicySnapshotHash: externalProcessingPolicyHash(visualPolicy), visualPolicy,
      asset: { id: 'asset-described-image', answerId: 'answer-1', objectKey: 'quarantine/visual-source', originalName: 'answer.png', mimeType: 'image/png', sizeBytes: image.byteLength, checksum, answer: { assignmentQuestionId: 'question-1', submission: { frozenStudentId: 'student-1', frozenAudienceClassId: 'class-1' } } },
      attempt: { id: 'attempt-1' }, policy: null, answerEvidence: null,
    };
    const db: any = {
      ...lifecyclePolicyRepository(),
      gradingProviderPolicy: { findUnique: async ({ where }: any) => where.id === visualPolicy.id ? visualPolicy : null },
      gradingJob: { findUnique: async () => ({ id: 'job-described-image', state: 'QUEUED', cancelRequestedAt: null, conversion }), updateMany: async () => ({ count: 1 }) },
      documentConversion: { update: async ({ data }: any) => ({ ...conversion, ...data }) },
      documentConversionVisualEvidence: { deleteMany: async () => undefined, createMany: async ({ data }: any) => { visualRows.push(...data); } },
      gradingConversionWarning: { createMany: async () => undefined },
      answerEvidence: { findFirst: async () => null, create: async ({ data }: any) => ({ ...data, blocks: data.blocks.create }) },
      $transaction: async (callback: (tx: any) => Promise<unknown>) => callback(db),
    };

    const result = await processDocumentConversionJob({
      db,
      jobId: 'job-described-image',
      store,
      writeRendered: async ({ key, bytes, mimeType, checksum: renderedChecksum, ownerId, answerId, attemptId, workerClaimToken }: any) => {
        store.put({ key, ownerId, answerId, attemptId, workerClaimFingerprint: sha256(workerClaimToken), sizeBytes: bytes.byteLength, mimeType, checksum: renderedChecksum, scanState: 'PENDING' });
        store.payloads.set(key, bytes);
        return key;
      },
      visualProvider: { id: 'vision-provider', provider: 'ai-evaluator', version: 'vision-model.v1', capabilities: { vision: true }, evaluate: async () => ({ output: { description: 'The hand-drawn response curve rises smoothly and settles near a bounded value.', confidence: 0.91, pageNumber: 1, bbox: [0, 0, 100, 80], limitations: [] }, provider: 'vision-provider', providerRequestId: 'vision-request-1', deletionHandle: 'vision-delete-1' }) },
      local: { convert: async () => ({ markdown: '图片作答', blocks: [{ id: 'block-1', blockIndex: 0, text: '图片作答', markdown: '图片作答', precision: 'block' as const, confidence: 0.9 }] }) },
      now,
    });

    expect(visualRows).toEqual([expect.objectContaining({ description: expect.stringContaining('hand-drawn response curve'), confidence: 0.91, readiness: 'ready', provider: 'vision-provider', model: 'vision-model.v1', policyVersion: 'visual.v1', providerRequestId: 'vision-request-1', providerDeletionHandle: 'vision-delete-1' })]);
    expect(result.evidence).toEqual(expect.objectContaining({ readiness: 'READY', limitationState: 'none', canonicalMarkdown: expect.stringContaining('视觉证据') }));
  });

  it('removes uploaded visual projections when the visual provider fails', async () => {
    const image = new Uint8Array([137, 80, 78, 71]);
    const checksum = sha256(image);
    const store = new MemorySubmissionObjectStore();
    store.put({ key: 'quarantine/failed-visual-source', ownerId: 'student-1', answerId: 'answer-1', attemptId: 'attempt-1', sizeBytes: image.byteLength, mimeType: 'image/png', checksum, scanState: 'CLEAN' });
    store.payloads.set('quarantine/failed-visual-source', image);
    const visualPolicy = gradingPolicy({ id: 'policy-visual-failure', purpose: 'visual-description', dataCategories: ['student-answer', 'student-answer-visual'], minimizedScope: ['selected-question', 'answer-evidence', 'visual-evidence'] });
    const conversion: any = {
      id: 'conversion-failed-visual', assetId: 'asset-failed-visual', attemptId: 'attempt-1', version: 1, state: 'QUEUED', retentionExpiresAt: now,
      visualPolicyId: visualPolicy.id, visualPolicySnapshot: visualPolicy, visualPolicySnapshotHash: externalProcessingPolicyHash(visualPolicy), visualPolicy,
      asset: { id: 'asset-failed-visual', answerId: 'answer-1', objectKey: 'quarantine/failed-visual-source', originalName: 'answer.png', mimeType: 'image/png', sizeBytes: image.byteLength, checksum, answer: { assignmentQuestionId: 'question-1', submission: { frozenStudentId: 'student-1', frozenAudienceClassId: 'class-1' } } },
      attempt: { id: 'attempt-1' }, policy: null, answerEvidence: null,
    };
    const updates: any[] = [];
    const db: any = {
      ...lifecyclePolicyRepository(),
      gradingProviderPolicy: { findUnique: async () => visualPolicy },
      gradingJob: { findUnique: async () => ({ id: 'job-failed-visual', state: 'QUEUED', cancelRequestedAt: null, conversion }), updateMany: async ({ data }: any) => { updates.push(data); return { count: 1 }; } },
      documentConversion: { updateMany: async ({ data }: any) => { updates.push(data); return { count: 1 }; } },
      $transaction: async (callback: (tx: any) => Promise<unknown>) => callback(db),
    };

    await expect(processDocumentConversionJob({
      db,
      jobId: 'job-failed-visual',
      store,
      writeRendered: async ({ key, bytes, mimeType, checksum: renderedChecksum, ownerId, answerId, attemptId, workerClaimToken }: any) => {
        store.put({ key, ownerId, answerId, attemptId, workerClaimFingerprint: sha256(workerClaimToken), sizeBytes: bytes.byteLength, mimeType, checksum: renderedChecksum, scanState: 'PENDING' });
        store.payloads.set(key, bytes);
        return key;
      },
      visualProvider: { id: 'vision-provider', provider: 'ai-evaluator', version: 'model.v1', capabilities: { vision: true }, evaluate: async () => { throw new Error('provider timeout'); } },
      local: { convert: async () => ({ markdown: '图片作答', blocks: [{ id: 'block-1', blockIndex: 0, text: '图片作答', markdown: '图片作答', precision: 'block' as const, confidence: 0.9 }] }) },
      now,
    })).rejects.toThrow('provider timeout');

    expect([...store.objects.keys()].filter((key) => key.startsWith('grading-visual/'))).toEqual([]);
    expect(updates).toEqual(expect.arrayContaining([expect.objectContaining({ state: 'RETRYABLE' })]));
  });

  it('continues cleaning later visual objects when orphan audit persistence fails', async () => {
    const source = Buffer.from('%PDF-1.7\ncleanup fixture');
    const sourceChecksum = sha256(source);
    const store = new MemorySubmissionObjectStore();
    store.put({ key: 'quarantine/multi-visual-source', ownerId: 'student-1', answerId: 'answer-1', attemptId: 'attempt-1', sizeBytes: source.byteLength, mimeType: 'application/pdf', checksum: sourceChecksum, scanState: 'CLEAN' });
    store.payloads.set('quarantine/multi-visual-source', source);
    const conversion: any = {
      id: 'conversion-multi-visual-cleanup', assetId: 'asset-multi-visual-cleanup', attemptId: 'attempt-1', version: 1, state: 'QUEUED', retentionExpiresAt: now,
      asset: { id: 'asset-multi-visual-cleanup', answerId: 'answer-1', objectKey: 'quarantine/multi-visual-source', originalName: 'answer.pdf', mimeType: 'application/pdf', sizeBytes: source.byteLength, checksum: sourceChecksum, answer: { assignmentQuestionId: 'question-1', submission: { frozenStudentId: 'student-1', frozenAudienceClassId: 'class-1' } } },
      attempt: { id: 'attempt-1' }, policy: null, answerEvidence: null,
    };
    const job: any = { id: 'job-multi-visual-cleanup', state: 'QUEUED', cancelRequestedAt: null, conversion };
    const db: any = {
      ...lifecyclePolicyRepository(),
      gradingJob: { findUnique: async () => job, updateMany: async ({ data }: any) => { Object.assign(job, data); return { count: 1 }; }, update: async ({ data }: any) => { Object.assign(job, data); return job; } },
      documentConversion: { updateMany: async ({ data }: any) => { Object.assign(conversion, data); return { count: 1 }; }, update: async ({ data }: any) => { Object.assign(conversion, data); return conversion; } },
      gradingConversionWarning: { createMany: async () => undefined },
      $transaction: async (callback: (tx: any) => Promise<unknown>) => callback(db),
    };
    const originalDelete = store.delete.bind(store);
    let failFirstDelete = true;
    store.delete = async (key: string, signal?: AbortSignal) => {
      if (failFirstDelete && key.startsWith('grading-visual/')) {
        failFirstDelete = false;
        throw new Error('first-visual-delete-failed');
      }
      return originalDelete(key, signal);
    };

    await expect(processDocumentConversionJob({
      db,
      jobId: job.id,
      store,
      renderPdfPages: async () => [{ pageNumber: 1, bytes: Buffer.from([1, 2, 3]) }, { pageNumber: 2, bytes: Buffer.from([4, 5, 6]) }],
      local: { convert: async () => ({ markdown: 'PDF 作答', blocks: [{ text: 'PDF 作答', precision: 'block' as const }], renderedBytes: Buffer.from([7, 8, 9]), renderedMimeType: 'application/pdf' }) },
      writeRendered: async ({ key, bytes, mimeType, checksum, ownerId, answerId, attemptId, workerClaimToken }: any) => {
        if (mimeType === 'application/pdf') throw new Error('rendered-write-failed');
        store.put({ key, ownerId, answerId, attemptId, workerClaimFingerprint: sha256(workerClaimToken), sizeBytes: bytes.byteLength, mimeType, checksum, scanState: 'PENDING' });
        store.payloads.set(key, bytes);
        return key;
      },
      now,
    })).rejects.toThrow('rendered-orphan-cleanup-failed');

    expect([...store.objects.keys()].filter((key) => key.startsWith('grading-visual/'))).toHaveLength(1);
  });

  it('renders each PDF page into question-bound visual evidence before scoring', async () => {
    const source = Buffer.from('%PDF-1.7\ncontrolled fixture');
    const checksum = sha256(source);
    const store = new MemorySubmissionObjectStore();
    store.put({ key: 'quarantine/pdf-source', ownerId: 'student-1', answerId: 'answer-1', attemptId: 'attempt-1', sizeBytes: source.byteLength, mimeType: 'application/pdf', checksum, scanState: 'CLEAN' });
    store.payloads.set('quarantine/pdf-source', source);
    const visualRows: any[] = [];
    const conversion: any = {
      id: 'conversion-pdf-1', assetId: 'asset-pdf-1', attemptId: 'attempt-1', version: 1, state: 'QUEUED', retentionExpiresAt: now,
      asset: { id: 'asset-pdf-1', answerId: 'answer-1', objectKey: 'quarantine/pdf-source', originalName: 'answer.pdf', mimeType: 'application/pdf', sizeBytes: source.byteLength, checksum, answer: { assignmentQuestionId: 'question-1', question: { assignmentRevisionId: 'revision-1' }, submission: { frozenStudentId: 'student-1', frozenAudienceClassId: 'class-1', audience: { classId: 'class-1', class: { teacherId: 'teacher-1' } } } } },
      attempt: { id: 'attempt-1' }, policy: null, answerEvidence: null,
    };
    const job: any = { id: 'job-pdf-1', state: 'QUEUED', cancelRequestedAt: null, conversion };
    const db: any = {
      ...lifecyclePolicyRepository(),
      gradingJob: { findUnique: async () => job, updateMany: async () => ({ count: 1 }) },
      documentConversion: { update: async ({ data }: any) => ({ ...conversion, ...data }) },
      documentConversionVisualEvidence: { deleteMany: async () => undefined, createMany: async ({ data }: any) => { visualRows.push(...data); } },
      gradingConversionWarning: { createMany: async () => undefined },
      answerEvidence: { findFirst: async () => null, create: async ({ data }: any) => ({ ...data, blocks: data.blocks.create }) },
      $transaction: async (callback: (tx: any) => Promise<unknown>) => callback(db),
    };

    const result = await processDocumentConversionJob({
      db,
      jobId: job.id,
      store,
      local: { convert: async () => ({ markdown: 'PDF 作答', blocks: [{ id: 'block-1', blockIndex: 0, text: 'PDF 作答', markdown: 'PDF 作答', precision: 'block' as const, confidence: 0.9 }] }) },
      renderPdfPages: async () => [
        { pageNumber: 1, bytes: Buffer.from([1, 2, 3]) },
        { pageNumber: 2, bytes: Buffer.from([4, 5, 6]) },
      ],
      writeRendered: async ({ key, bytes, mimeType, checksum: renderedChecksum, ownerId, answerId, attemptId, workerClaimToken }: any) => {
        store.put({ key, ownerId, answerId, attemptId, workerClaimFingerprint: sha256(workerClaimToken), sizeBytes: bytes.byteLength, mimeType, checksum: renderedChecksum, scanState: 'PENDING' });
        store.payloads.set(key, bytes);
        return key;
      },
      now,
    });

    expect(visualRows).toEqual([
      expect.objectContaining({ sourceKind: 'pdf-page-image', questionId: 'question-1', pageNumber: 1, mediaType: 'image/png', readiness: 'review-required' }),
      expect.objectContaining({ sourceKind: 'pdf-page-image', questionId: 'question-1', pageNumber: 2, mediaType: 'image/png', readiness: 'review-required' }),
    ]);
    expect(result.evidence).toEqual(expect.objectContaining({ readiness: 'BLOCKED', limitationState: 'visual-evidence-incomplete' }));
  });

  it('persists an independently submitted image with the answer-bound question identity', async () => {
    const image = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9G7ewAAAAASUVORK5CYII=', 'base64');
    const checksum = sha256(image);
    const store = new MemorySubmissionObjectStore();
    store.put({ key: 'quarantine/image-source', ownerId: 'student-1', answerId: 'answer-1', attemptId: 'attempt-1', sizeBytes: image.byteLength, mimeType: 'image/png', checksum, scanState: 'CLEAN' });
    store.payloads.set('quarantine/image-source', image);
    const visualRows: any[] = [];
    const conversion: any = {
      id: 'conversion-image-1', assetId: 'asset-1', attemptId: 'attempt-1', version: 1, state: 'QUEUED', retentionExpiresAt: now,
      asset: { id: 'asset-1', answerId: 'answer-1', objectKey: 'quarantine/image-source', originalName: 'answer.png', mimeType: 'image/png', sizeBytes: image.byteLength, checksum, answer: { assignmentQuestionId: 'question-1', submission: { frozenStudentId: 'student-1', frozenAudienceClassId: 'class-1' } } },
      attempt: { id: 'attempt-1' }, policy: null, answerEvidence: null,
    };
    const db: any = {
      ...lifecyclePolicyRepository(),
      gradingJob: { findUnique: async () => ({ id: 'job-image-1', state: 'QUEUED', cancelRequestedAt: null, conversion }), updateMany: async () => ({ count: 1 }) },
      documentConversion: { update: async ({ data }: any) => ({ ...conversion, ...data }) },
      documentConversionVisualEvidence: { deleteMany: async () => undefined, createMany: async ({ data }: any) => { visualRows.push(...data); } },
      gradingConversionWarning: { createMany: async () => undefined },
      answerEvidence: { findFirst: async () => null, create: async ({ data }: any) => ({ ...data, blocks: data.blocks.create }) },
      $transaction: async (callback: (tx: any) => Promise<unknown>) => callback(db),
    };

    const result = await processDocumentConversionJob({
      db,
      jobId: 'job-image-1',
      store,
      writeRendered: async ({ key, bytes: rendered, mimeType, checksum: renderedChecksum, ownerId, answerId, attemptId, workerClaimToken }: any) => {
        store.put({ key, ownerId, answerId, attemptId, workerClaimFingerprint: sha256(workerClaimToken), sizeBytes: rendered.byteLength, mimeType, checksum: renderedChecksum, scanState: 'PENDING' });
        store.payloads.set(key, rendered);
        return key;
      },
      local: { convert: async () => ({ markdown: '图片作答', blocks: [{ id: 'block-1', blockIndex: 0, text: '图片作答', markdown: '图片作答', precision: 'block' as const, confidence: 0.9 }] }) },
      now,
    });

    expect(visualRows).toEqual([expect.objectContaining({ sourceKind: 'image-attachment', questionId: 'question-1', imageChecksum: checksum, readiness: 'review-required' })]);
    expect(result.evidence).toEqual(expect.objectContaining({ readiness: 'BLOCKED', limitationState: 'visual-evidence-incomplete' }));
  });
});
