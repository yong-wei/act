import { describe, expect, it, vi } from 'vitest';

import { MemorySubmissionObjectStore } from '@/lib/assignments/submission-object-store';
import { garbageCollectSourceAssets } from '@/lib/assignments/submission-service';
import { clearReverseGradingLineage, completeGradingTombstone, deleteGradingObjectsIndependently, gradingTombstoneLookupKey, hasActiveGradingHold, pseudonymizeGradingLineage, reconcileGradingPhysicalDelete, resolveGradingLineage, runGradingRetentionGc, validateLifecyclePolicy, writeLifecycleAudit } from '../math-document-grading-lifecycle';

const now = new Date();

const gcPolicies = [
  { id: 'lifecycle:answer-evidence:v1', dataClass: 'answer-evidence', version: 'v1', retentionSeconds: 60, providerRetentionSeconds: 0, deleteStrategy: 'delete-content' as const },
  { id: 'lifecycle:document-conversion:v1', dataClass: 'document-conversion', version: 'v1', retentionSeconds: 60, providerRetentionSeconds: 0, deleteStrategy: 'delete-content' as const },
  { id: 'lifecycle:ai-draft:v1', dataClass: 'ai-draft', version: 'v1', retentionSeconds: 60, providerRetentionSeconds: 0, deleteStrategy: 'delete-content' as const },
  { id: 'lifecycle:grading-run:v1', dataClass: 'grading-run', version: 'v1', retentionSeconds: 60, providerRetentionSeconds: 0, deleteStrategy: 'delete-content' as const },
];

function frozen(dataClass: 'answer-evidence' | 'document-conversion' | 'grading-run' | 'ai-draft', row: any) {
  return {
    ...row,
    lifecyclePolicyId: `lifecycle:${dataClass}:v1`,
    lifecyclePolicyVersion: 'v1',
    lifecycleDeleteStrategy: 'delete-content',
    lifecycleRetentionSeconds: 60,
    lifecycleGovernedRecordRule: null,
    lifecycleProviderRetentionSeconds: 0,
    retentionExpiresAt: row.retentionExpiresAt ?? new Date(now.getTime() - 1),
  };
}

function tombstoneUpdateMany(rows: any[]) {
  return async ({ where, data }: any) => {
    const row = rows.find((candidate) => candidate.resourceKey === where.resourceKey || candidate.lookupKey === where.lookupKey);
    if (!row) return { count: 0 };
    if (where.status?.in && !where.status.in.includes(row.status)) return { count: 0 };
    if (where.status?.not && row.status === where.status.not) return { count: 0 };
    if (where.deletionClaimToken !== undefined && row.deletionClaimToken !== where.deletionClaimToken) return { count: 0 };
    Object.assign(row, data);
    return { count: 1 };
  };
}

describe('math-document grading retention lifecycle', () => {
  it('keeps tombstone lookup stable when the audit secret rotates', () => {
    vi.stubEnv('GRADING_LIFECYCLE_LOOKUP_SECRET', 'stable-lifecycle-lookup-secret');
    vi.stubEnv('GRADING_AUDIT_SECRET', 'audit-secret-before-rotation');
    const before = gradingTombstoneLookupKey('conversion:rotation-proof');
    vi.stubEnv('GRADING_AUDIT_SECRET', 'audit-secret-after-rotation');
    expect(gradingTombstoneLookupKey('conversion:rotation-proof')).toBe(before);
    vi.unstubAllEnvs();
  });

  it('keeps a bounded lifecycle error code while redacting the raw error field', async () => {
    const events: any[] = [];
    await writeLifecycleAudit({ gradingAuditEvent: { create: async ({ data }: any) => { events.push(data); } } }, {
      action: 'grading-retention.provider-delete-failed',
      resourceType: 'DocumentConversion',
      resourceId: 'conversion-audit-error',
      actorId: 'grading-worker',
      actorRole: 'SERVICE',
      metadata: { error: 'provider-deletion-api-unavailable', reason: 'sensitive provider response' },
    });
    expect(events[0].metadata).toEqual(expect.objectContaining({ errorCode: 'provider-deletion-api-unavailable' }));
    expect(events[0].metadata.error).toBeUndefined();
  });

  it('enforces the immutable finite-versus-governed lifecycle contract', () => {
    expect(validateLifecyclePolicy({ dataClass: 'document-conversion', version: 'v1', retentionSeconds: 60, governedRecordRule: 'legal-evidence.v1', deleteStrategy: 'retain-governed-record' })).toEqual(expect.arrayContaining([
      'retain-governed-record-requires-no-finite-retention',
      'governed-record-rule-forbidden-with-finite-retention',
    ]));
    expect(validateLifecyclePolicy({ dataClass: 'document-conversion', version: 'v1', retentionSeconds: null, governedRecordRule: 'legal-evidence.v1', deleteStrategy: 'retain-governed-record' })).toEqual([]);
    expect(validateLifecyclePolicy({ dataClass: 'document-conversion', version: 'v1', retentionSeconds: null, governedRecordRule: '', deleteStrategy: 'retain-governed-record' })).toContain('finite-retention-or-record-rule-required');
  });

  it('fails closed when the document-conversion lifecycle policy is missing', async () => {
    const db: any = {
      answerEvidence: { findMany: async () => [] },
      documentConversion: { findMany: async () => [] },
      gradingRun: { findMany: async () => [] },
    };
    await expect(runGradingRetentionGc({
      db,
      store: new MemorySubmissionObjectStore(),
      policies: [{ dataClass: 'answer-evidence', version: 'v1', retentionSeconds: 60, deleteStrategy: 'delete-content' }],
      now,
    })).rejects.toThrow('lifecycle-policy-blocked:missing:document-conversion');
  });

  it('redacts expired evidence, fences jobs, deletes rendered artifacts, and writes tombstones', async () => {
    const updates: any[] = [];
    const tombstones: any[] = [];
    const store = new MemorySubmissionObjectStore();
    store.put({ key: 'grading-rendered/conversion-1', ownerId: 'worker', answerId: 'answer-1', sizeBytes: 3, mimeType: 'application/pdf', checksum: 'sha256:unused', scanState: 'CLEAN' });
    store.payloads.set('grading-rendered/conversion-1', new Uint8Array([1, 2, 3]));
    const db: any = {
      answerEvidence: {
        findMany: async () => [frozen('answer-evidence', { id: 'evidence-1', attemptId: 'attempt-1', sourceAssetId: null, sourceHash: 'sha256:evidence', limitations: [], blocks: [{ id: 'block-1' }] })],
        update: async ({ data }: any) => { updates.push(data); return data; },
      },
      answerEvidenceBlock: { updateMany: async ({ data }: any) => { updates.push(data); return { count: 1 }; } },
      documentConversion: {
        findMany: async () => [frozen('document-conversion', { id: 'conversion-1', renderedObjectKey: 'grading-rendered/conversion-1', assetId: 'asset-1' })],
        update: async ({ data }: any) => { updates.push(data); return data; },
      },
      gradingRun: { findMany: async () => [] },
      gradingJob: { updateMany: async ({ data }: any) => { updates.push(data); return { count: 1 }; } },
      gradingTombstone: {
        findUnique: async ({ where }: any) => tombstones.find((row) => row.resourceKey === where.resourceKey || row.lookupKey === where.lookupKey) ?? null,
        create: async ({ data }: any) => { tombstones.push(data); return data; },
        updateMany: tombstoneUpdateMany(tombstones),
        update: async ({ where, data }: any) => { const row = tombstones.find((candidate) => candidate.resourceKey === where.resourceKey); Object.assign(row, data); return row; },
      },
      gradingLegalHold: { findFirst: async () => null },
      gradingAuditEvent: { create: async () => undefined },
      $transaction: async (callback: (tx: any) => Promise<unknown>) => callback(db),
    };

    const result = await runGradingRetentionGc({
      db,
      store,
      policies: gcPolicies,
      now,
    });

    expect(result).toEqual({ scanned: 2, deleted: 2, held: 0, blocked: 0, tombstones: 2 });
    expect(tombstones.map((row) => row.resourceType)).toEqual(expect.arrayContaining(['AnswerEvidence', 'DocumentConversion']));
    expect(updates).toEqual(expect.arrayContaining([
      expect.objectContaining({ readiness: 'DELETED', canonicalMarkdown: '[deleted-by-retention-policy]' }),
      expect.objectContaining({ state: 'DELETED', canonicalMarkdown: null, renderedObjectKey: null }),
      expect.objectContaining({ state: 'CONTENT_UNAVAILABLE', lastErrorCode: 'retention-expired' }),
    ]));
    expect(await store.head('grading-rendered/conversion-1')).toBeNull();
  });

  it('keeps later-retained run handles when evidence, conversion, and batch parents expire first', async () => {
    const firstNow = new Date(now.getTime());
    const runDueAt = new Date(firstNow.getTime() + 60_000);
    const secondNow = new Date(firstNow.getTime() + 120_000);
    const evidence: any = frozen('answer-evidence', {
      id: 'evidence-parent-first',
      attemptId: 'attempt-parent-first',
      sourceHash: 'sha256:evidence-parent-first',
      canonicalMarkdown: 'parent evidence',
      readiness: 'READY',
      limitations: [],
      blocks: [],
      tombstonedAt: null,
      retentionExpiresAt: new Date(firstNow.getTime() - 1),
      conversion: null,
    });
    const conversion: any = frozen('document-conversion', {
      id: 'conversion-parent-first',
      state: 'SUCCEEDED',
      renderedObjectKey: 'grading-rendered/parent-first',
      assetId: 'asset-parent-first',
      attemptId: 'attempt-parent-first',
      retentionExpiresAt: new Date(firstNow.getTime() - 1),
    });
    const batch: any = frozen('ai-draft', {
      id: 'batch-parent-first',
      assignmentRevisionId: 'revision-parent-first',
      questionId: 'question-parent-first',
      classId: 'class-parent-first',
      state: 'SUCCEEDED',
      tombstonedAt: null,
      retentionExpiresAt: new Date(firstNow.getTime() - 1),
    });
    const run: any = frozen('grading-run', {
      id: 'run-retained-after-parent',
      batchId: batch.id,
      answerAttemptId: 'attempt-parent-first',
      answerEvidenceId: evidence.id,
      inputHash: 'sha256:run-retained-input',
      modelInputObjectKey: 'grading-model/run-retained-input',
      modelOutputObjectKey: 'grading-model/run-retained-output',
      provider: 'provider-fixture',
      providerRequestId: 'provider-request-retained',
      providerDeletionHandle: 'provider-delete-retained',
      limitations: [],
      state: 'AWAITING_REVIEW',
      tombstonedAt: null,
      retentionExpiresAt: runDueAt,
    });
    const batchItem: any = {
      id: 'batch-item-parent-first',
      batchId: batch.id,
      state: 'GRADING',
      answerId: 'answer-parent-first',
      attemptId: 'attempt-parent-first',
      evidenceId: evidence.id,
      conversionId: conversion.id,
      gradingRunId: run.id,
      inputHash: 'sha256:item-input-parent-first',
      questionSnapshotHash: 'sha256:item-question-parent-first',
    };
    const job: any = {
      id: 'grading-job-parent-first',
      state: 'RUNNING',
      batchId: batch.id,
      batchItemId: batchItem.id,
      gradingRunId: run.id,
      dedupeKey: 'grading-job-parent-first-dedupe',
      idempotencyKey: 'grading-job-parent-first-idempotency',
      rerunIdentity: 'grading-job-parent-first-rerun',
    };
    const rerun: any = {
      id: 'grading-rerun-parent-first',
      batchId: batch.id,
      gradingRunId: run.id,
      gradingJobId: job.id,
      rerunIdentity: 'grading-rerun-parent-first-identity',
      idempotencyKey: 'grading-rerun-parent-first-idempotency',
    };
    const tombstones: any[] = [];
    const objectRows: any[] = [];
    const findTombstone = (where: any) => tombstones.find((row) => (
      (where.resourceKey && row.resourceKey === where.resourceKey)
      || (where.lookupKey && row.lookupKey === where.lookupKey)
    )) ?? null;
    const matches = (row: any, where: any): boolean => {
      if (where.id && typeof where.id === 'string' && row.id !== where.id) return false;
      if (where.id?.in && !where.id.in.includes(row.id)) return false;
      if (where.answerEvidenceId && row.answerEvidenceId !== where.answerEvidenceId) return false;
      if (where.batchId && row.batchId !== where.batchId) return false;
      if (where.batchItemId && row.batchItemId !== where.batchItemId) return false;
      if (where.gradingRunId && row.gradingRunId !== where.gradingRunId) return false;
      if (where.state?.in && !where.state.in.includes(row.state)) return false;
      if (where.state?.not && row.state === where.state.not) return false;
      if (where.OR && !where.OR.some((part: any) => matches(row, part))) return false;
      return true;
    };
    const store = new MemorySubmissionObjectStore();
    store.put({ key: conversion.renderedObjectKey, ownerId: 'worker', answerId: 'answer-parent-first', sizeBytes: 1, mimeType: 'application/pdf', checksum: 'sha256:conversion-parent-first', scanState: 'CLEAN' });
    store.put({ key: run.modelInputObjectKey, ownerId: 'worker', answerId: 'answer-parent-first', sizeBytes: 1, mimeType: 'application/json', checksum: 'sha256:run-input', scanState: 'CLEAN' });
    store.put({ key: run.modelOutputObjectKey, ownerId: 'worker', answerId: 'answer-parent-first', sizeBytes: 1, mimeType: 'application/json', checksum: 'sha256:run-output', scanState: 'CLEAN' });
    const db: any = {
      answerEvidence: {
        findMany: async ({ where }: any) => {
          if (where.conversionId) return evidence.conversionId === where.conversionId ? [evidence] : [];
          return evidence.tombstonedAt ? [] : [evidence];
        },
        update: async ({ data }: any) => { Object.assign(evidence, data); return evidence; },
        updateMany: async ({ data }: any) => { Object.assign(evidence, data); return { count: 1 }; },
      },
      answerEvidenceBlock: { updateMany: async () => ({ count: 1 }) },
      documentConversion: {
        findMany: async () => conversion.state === 'DELETED' ? [] : [conversion],
        update: async ({ data }: any) => { Object.assign(conversion, data); return conversion; },
        updateMany: async ({ data }: any) => { Object.assign(conversion, data); return { count: 1 }; },
      },
      gradingRun: {
        findMany: async ({ where }: any) => {
          const parentLookup = where.answerEvidenceId === evidence.id || where.batchId === batch.id || where.id?.in?.includes(run.id);
          const dueAt = where.OR?.find((part: any) => part.retentionExpiresAt?.lte)?.retentionExpiresAt?.lte;
          const due = dueAt ? run.retentionExpiresAt <= dueAt : false;
          return !run.tombstonedAt && (parentLookup || due) ? [run] : [];
        },
        update: async ({ data }: any) => { Object.assign(run, data); return run; },
      },
      gradingBatch: {
        findMany: async () => batch.tombstonedAt ? [] : [batch],
        update: async ({ data }: any) => { Object.assign(batch, data); return batch; },
      },
      gradingBatchItem: {
        findMany: async ({ where }: any) => [batchItem].filter((row) => matches(row, where)),
        updateMany: async ({ where, data }: any) => {
          if (!matches(batchItem, where)) return { count: 0 };
          Object.assign(batchItem, data);
          return { count: 1 };
        },
      },
      gradingJob: {
        findMany: async ({ where }: any) => [job].filter((row) => matches(row, where)),
        updateMany: async ({ where, data }: any) => {
          if (!matches(job, where)) return { count: 0 };
          Object.assign(job, data);
          return { count: 1 };
        },
      },
      gradingRerun: {
        findMany: async ({ where }: any) => [rerun].filter((row) => matches(row, where)),
        update: async ({ data }: any) => { Object.assign(rerun, data); return rerun; },
      },
      gradingCriterionAssessment: { updateMany: async () => ({ count: 1 }) },
      gradingAnnotation: { updateMany: async () => ({ count: 1 }) },
      gradingTombstone: {
        findUnique: async ({ where }: any) => findTombstone(where),
        create: async ({ data }: any) => { const row = { ...data }; tombstones.push(row); return row; },
        updateMany: async ({ where, data }: any) => {
          const row = findTombstone(where);
          if (!row || (where.status?.in && !where.status.in.includes(row.status)) || (where.deletionClaimToken !== undefined && row.deletionClaimToken !== where.deletionClaimToken)) return { count: 0 };
          Object.assign(row, data);
          return { count: 1 };
        },
        update: async ({ where, data }: any) => { const row = findTombstone(where); Object.assign(row, data); return row; },
      },
      gradingTombstoneObject: {
        findMany: async ({ where }: any = {}) => objectRows.filter((row) => (!where.tombstoneId || row.tombstoneId === where.tombstoneId) && (!where.objectKey || row.objectKey === where.objectKey || where.objectKey.in?.includes(row.objectKey))),
        create: async ({ data }: any) => { const row = { ...data }; objectRows.push(row); return row; },
        upsert: async ({ create, update }: any) => {
          const existing = objectRows.find((row) => row.tombstoneId === create.tombstoneId && row.objectKey === create.objectKey);
          if (existing) { Object.assign(existing, update); return existing; }
          const row = { ...create }; objectRows.push(row); return row;
        },
        updateMany: async ({ where, data }: any) => {
          const row = objectRows.find((candidate) => (!where.id || candidate.id === where.id) && (!where.objectKey || candidate.objectKey === where.objectKey));
          if (!row || (where.status?.in && !where.status.in.includes(row.status)) || (where.deletionClaimToken !== undefined && row.deletionClaimToken !== where.deletionClaimToken)) return { count: 0 };
          Object.assign(row, data);
          return { count: 1 };
        },
      },
      gradingLegalHold: { findFirst: async () => null },
      gradingAuditEvent: { create: async () => undefined },
      $transaction: async (callback: (tx: any) => Promise<unknown>) => callback(db),
    };

    const first = await runGradingRetentionGc({ db, store, policies: gcPolicies, now: firstNow });
    expect(first).toEqual({ scanned: 3, deleted: 3, held: 0, blocked: 0, tombstones: 3 });
    expect(run).toEqual(expect.objectContaining({ state: 'CONTENT_UNAVAILABLE', modelInputObjectKey: 'grading-model/run-retained-input', modelOutputObjectKey: 'grading-model/run-retained-output', providerDeletionHandle: 'provider-delete-retained', tombstonedAt: null }));
    expect(batchItem).toEqual(expect.objectContaining({ state: 'BLOCKED', gradingRunId: run.id, inputHash: 'sha256:item-input-parent-first', questionSnapshotHash: 'sha256:item-question-parent-first' }));
    expect(job).toEqual(expect.objectContaining({ state: 'CONTENT_UNAVAILABLE', dedupeKey: 'grading-job-parent-first-dedupe', idempotencyKey: 'grading-job-parent-first-idempotency', rerunIdentity: 'grading-job-parent-first-rerun' }));
    expect(rerun).toEqual(expect.objectContaining({ batchId: null, gradingRunId: null, gradingJobId: null, rerunIdentity: 'grading-rerun-parent-first-identity', idempotencyKey: 'grading-rerun-parent-first-idempotency' }));
    expect(await store.head(run.modelInputObjectKey)).not.toBeNull();
    expect(await store.head(run.modelOutputObjectKey)).not.toBeNull();

    const second = await runGradingRetentionGc({ db, store, policies: gcPolicies, now: secondNow });
    expect(second).toEqual({ scanned: 1, deleted: 1, held: 0, blocked: 0, tombstones: 1 });
    expect(run).toEqual(expect.objectContaining({ tombstonedAt: secondNow, modelInputObjectKey: null, modelOutputObjectKey: null }));
    expect(await store.head('grading-model/run-retained-input')).toBeNull();
    expect(await store.head('grading-model/run-retained-output')).toBeNull();
  });

  it('keeps evidence blocks intact after a failed derived-object delete and retries the tombstone', async () => {
    const store = new MemorySubmissionObjectStore();
    store.put({ key: 'grading-derived/evidence-delete-fails', ownerId: 'worker', answerId: 'answer-1', sizeBytes: 3, mimeType: 'application/json', checksum: 'sha256:evidence-object', scanState: 'CLEAN' });
    const evidence: any = { id: 'evidence-delete-fails', attemptId: 'attempt-1', sourceHash: 'sha256:evidence', limitations: [], canonicalMarkdown: 'private markdown', readiness: 'READY', tombstonedAt: null, conversion: { renderedObjectKey: 'grading-derived/evidence-delete-fails' }, blocks: [{ id: 'block-1', text: 'private block', markdown: 'private block' }] };
    const tombstones: any[] = [];
    let failDelete = true;
    const db: any = {
      answerEvidence: {
        findMany: async () => evidence.tombstonedAt ? [] : [frozen('answer-evidence', evidence)],
        update: async ({ data }: any) => { Object.assign(evidence, data); return evidence; },
      },
      answerEvidenceBlock: { updateMany: async ({ data }: any) => { Object.assign(evidence.blocks[0], data); return { count: 1 }; } },
      documentConversion: { findMany: async () => [] },
      gradingRun: { findMany: async () => [] },
      gradingJob: { updateMany: async () => ({ count: 1 }) },
      gradingTombstone: {
        findUnique: async ({ where }: any) => tombstones.find((row) => row.resourceKey === where.resourceKey || row.lookupKey === where.lookupKey) ?? null,
        create: async ({ data }: any) => { tombstones.push(data); return data; },
        updateMany: tombstoneUpdateMany(tombstones),
        update: async ({ where, data }: any) => { const row = tombstones.find((candidate) => candidate.resourceKey === where.resourceKey); Object.assign(row, data); return row; },
      },
      gradingLegalHold: { findFirst: async () => null },
      gradingAuditEvent: { create: async () => undefined },
      $transaction: async (callback: (tx: any) => Promise<unknown>) => callback(db),
    };
    store.delete = async (key: string) => {
      if (failDelete) { failDelete = false; throw new Error('object-store-delete-failed'); }
      await MemorySubmissionObjectStore.prototype.delete.call(store, key);
    };

    const first = await runGradingRetentionGc({ db, store, policies: gcPolicies, now });
    expect(first).toEqual({ scanned: 1, deleted: 0, held: 0, blocked: 1, tombstones: 1 });
    expect(evidence.canonicalMarkdown).toBe('private markdown');
    expect(evidence.blocks[0].text).toBe('private block');
    expect(tombstones[0]).toEqual(expect.objectContaining({ status: 'RETRYABLE', contentDeletedAt: null }));

    const second = await runGradingRetentionGc({ db, store, policies: gcPolicies, now });
    expect(second).toEqual({ scanned: 1, deleted: 1, held: 0, blocked: 0, tombstones: 0 });
    expect(evidence.readiness).toBe('DELETED');
    expect(evidence.canonicalMarkdown).toBe('[deleted-by-retention-policy]');
    expect(tombstones[0]).toEqual(expect.objectContaining({ status: 'DELETED', contentDeletedAt: now }));
    expect(await store.head('grading-derived/evidence-delete-fails')).toBeNull();
  });

  it('deletes derived objects independently and continues after a prior object becomes 404', async () => {
    const store = new MemorySubmissionObjectStore();
    store.put({ key: 'grading-derived/object-a', ownerId: 'worker', answerId: 'answer-multi-object', sizeBytes: 1, mimeType: 'application/json', checksum: 'sha256:a', scanState: 'CLEAN' });
    const evidence: any = {
      id: 'evidence-multi-object',
      attemptId: 'attempt-multi-object',
      sourceHash: 'sha256:evidence-multi-object',
      limitations: [],
      canonicalMarkdown: 'sensitive markdown',
      readiness: 'READY',
      tombstonedAt: null,
      conversion: { renderedObjectKey: 'grading-derived/object-a' },
      blocks: [],
    };
    const tombstones: any[] = [];
    const deleteCalls: string[] = [];
    let firstPass = true;
    const realDelete = store.delete.bind(store);
    store.delete = async (key: string) => {
      deleteCalls.push(key);
      if (firstPass && key === 'grading-derived/object-a') throw new Error('object-store-delete-failed');
      if (!firstPass && key === 'grading-derived/object-a') { await realDelete(key); throw Object.assign(new Error('provider object is absent'), { name: 'NoSuchKey', statusCode: 404 }); }
      await realDelete(key);
    };
    const db: any = {
      answerEvidence: {
        findMany: async () => evidence.tombstonedAt ? [] : [frozen('answer-evidence', evidence)],
        update: async ({ data }: any) => { Object.assign(evidence, data); return evidence; },
      },
      answerEvidenceBlock: { updateMany: async () => ({ count: 0 }) },
      documentConversion: { findMany: async () => [] },
      gradingRun: { findMany: async () => [] },
      gradingJob: { updateMany: async () => ({ count: 1 }) },
      gradingLegalHold: { findFirst: async () => null },
      gradingTombstone: {
        findUnique: async ({ where }: any) => tombstones.find((row) => row.resourceKey === where.resourceKey) ?? null,
        create: async ({ data }: any) => { tombstones.push(data); return data; },
        update: async ({ where, data }: any) => { const row = tombstones.find((candidate) => candidate.resourceKey === where.resourceKey); Object.assign(row, data); return row; },
        updateMany: async ({ where, data }: any) => {
          const row = tombstones.find((candidate) => candidate.resourceKey === where.resourceKey);
          if (!row || (where.status?.not && row.status === where.status.not) || (where.deletionClaimToken !== undefined && row.deletionClaimToken !== where.deletionClaimToken)) return { count: 0 };
          Object.assign(row, data);
          return { count: 1 };
        },
      },
      gradingAuditEvent: { create: async () => undefined },
      $transaction: async (callback: (tx: any) => Promise<unknown>) => callback(db),
    };

    const first = await runGradingRetentionGc({ db, store, policies: gcPolicies, now });
    expect(first).toEqual(expect.objectContaining({ scanned: 1, deleted: 0, blocked: 1, tombstones: 1 }));
    expect(deleteCalls).toEqual(['grading-derived/object-a']);
    expect(await store.head('grading-derived/object-a')).not.toBeNull();

    firstPass = false;
    const second = await runGradingRetentionGc({ db, store, policies: gcPolicies, now });
    expect(second).toEqual(expect.objectContaining({ scanned: 1, deleted: 1, blocked: 0 }));
    expect(deleteCalls).toEqual(['grading-derived/object-a', 'grading-derived/object-a']);
    expect(tombstones[0]).toEqual(expect.objectContaining({ status: 'DELETED', contentDeletedAt: now }));
    expect(evidence.readiness).toBe('DELETED');
    expect(await store.head('grading-derived/object-a')).toBeNull();
  });

  it('attempts every derived object after one object deletion fails', async () => {
    const store = new MemorySubmissionObjectStore();
    store.put({ key: 'grading-derived/object-a-fails', ownerId: 'worker', answerId: 'answer-multi-object-error', sizeBytes: 1, mimeType: 'application/json', checksum: 'sha256:a', scanState: 'CLEAN' });
    store.put({ key: 'grading-derived/object-b-after-error', ownerId: 'worker', answerId: 'answer-multi-object-error', sizeBytes: 1, mimeType: 'application/json', checksum: 'sha256:b', scanState: 'CLEAN' });
    const attempts: string[] = [];
    const realDelete = store.delete.bind(store);
    store.delete = async (key: string) => {
      attempts.push(key);
      if (key === 'grading-derived/object-a-fails') throw new Error('object-store-delete-failed');
      await realDelete(key);
    };

    await expect(deleteGradingObjectsIndependently({
      store,
      objectKeys: ['grading-derived/object-a-fails', 'grading-derived/object-b-after-error'],
    })).rejects.toThrow('object-store-delete-failed');

    expect(attempts).toEqual(['grading-derived/object-a-fails', 'grading-derived/object-b-after-error']);
    expect(await store.head('grading-derived/object-b-after-error')).toBeNull();
  });

  it('records each grading object and reconciles a post-delete takeover without losing the fact', async () => {
    const store = new MemorySubmissionObjectStore();
    store.put({ key: 'grading-model/takeover-input', ownerId: 'worker', answerId: 'answer-takeover', sizeBytes: 1, mimeType: 'application/json', checksum: 'sha256:input', scanState: 'CLEAN' });
    store.put({ key: 'grading-model/takeover-output', ownerId: 'worker', answerId: 'answer-takeover', sizeBytes: 1, mimeType: 'application/json', checksum: 'sha256:output', scanState: 'CLEAN' });
    const run: any = frozen('grading-run', {
      id: 'run-takeover',
      answerAttemptId: 'attempt-takeover',
      answerEvidenceId: 'evidence-takeover',
      inputHash: 'sha256:run-input',
      modelInputObjectKey: 'grading-model/takeover-input',
      modelOutputObjectKey: 'grading-model/takeover-output',
      limitations: [],
      state: 'AWAITING_REVIEW',
      tombstonedAt: null,
    });
    let tombstone: any = null;
    const objectRows: any[] = [];
    let takeover = false;
    let deleteCalls: string[] = [];
    const db: any = {
      answerEvidence: { findMany: async () => [] },
      documentConversion: { findMany: async () => [] },
      gradingRun: {
        findMany: async () => run.tombstonedAt ? [] : [run],
        update: async ({ data }: any) => { Object.assign(run, data); return run; },
      },
      gradingJob: { updateMany: async () => ({ count: 1 }) },
      gradingCriterionAssessment: { updateMany: async () => ({ count: 1 }) },
      gradingAnnotation: { updateMany: async () => ({ count: 1 }) },
      gradingTombstone: {
        findUnique: async () => tombstone,
        create: async ({ data }: any) => { tombstone = { ...data }; return tombstone; },
        updateMany: async ({ where, data }: any) => {
          if (!tombstone) return { count: 0 };
          if (where.status?.in && !where.status.in.includes(tombstone.status)) return { count: 0 };
          if (where.status?.not && tombstone.status === where.status.not) return { count: 0 };
          if (where.deletionClaimToken !== undefined && tombstone.deletionClaimToken !== where.deletionClaimToken) return { count: 0 };
          Object.assign(tombstone, data);
          return { count: 1 };
        },
        update: async ({ data }: any) => { Object.assign(tombstone, data); return tombstone; },
      },
      gradingTombstoneObject: {
        findMany: async ({ where }: any = {}) => objectRows.filter((row) => (!where.tombstoneId || row.tombstoneId === where.tombstoneId) && (!where.objectKey || (typeof where.objectKey === 'string' ? row.objectKey === where.objectKey : where.objectKey.in.includes(row.objectKey)))),
        create: async ({ data }: any) => { const row = { ...data }; objectRows.push(row); return row; },
        upsert: async ({ create, update }: any) => {
          const existing = objectRows.find((row) => row.tombstoneId === create.tombstoneId && row.objectKey === create.objectKey);
          if (existing) { Object.assign(existing, update); return existing; }
          const row = { ...create };
          objectRows.push(row);
          return row;
        },
        updateMany: async ({ where, data }: any) => {
          const row = objectRows.find((candidate) => candidate.objectKey === where.objectKey);
          if (!row) return { count: 0 };
          if (where.status?.in && !where.status.in.includes(row.status)) return { count: 0 };
          if (where.status?.not && row.status === where.status.not) return { count: 0 };
          if (where.deletionClaimToken !== undefined && row.deletionClaimToken !== where.deletionClaimToken) return { count: 0 };
          Object.assign(row, data);
          return { count: 1 };
        },
      },
      gradingLegalHold: { findFirst: async () => null },
      gradingAuditEvent: { create: async () => undefined },
      $transaction: async (callback: (tx: any) => Promise<unknown>) => callback(db),
    };
    const realDelete = store.delete.bind(store);
    store.delete = async (key: string) => {
      deleteCalls.push(key);
      await realDelete(key);
      if (key === 'grading-model/takeover-input' && !takeover) {
        takeover = true;
        tombstone.deletionClaimToken = 'replacement-owner';
      }
    };

    const first = await runGradingRetentionGc({ db, store, policies: gcPolicies, now });
    expect(first).toEqual(expect.objectContaining({ scanned: 1, deleted: 0, blocked: 1 }));
    expect(deleteCalls).toEqual(['grading-model/takeover-input']);
    expect(tombstone).toEqual(expect.objectContaining({ status: 'DELETED_WITH_HOLD', physicalDeletedAt: expect.any(Date), lastErrorCode: 'deleted-with-hold', deletionClaimToken: null }));
    expect(objectRows).toEqual(expect.arrayContaining([
      expect.objectContaining({ objectKey: 'grading-model/takeover-input', status: 'DELETED_WITH_HOLD', physicalDeletedAt: expect.any(Date) }),
      expect.objectContaining({ objectKey: 'grading-model/takeover-output', status: 'PENDING' }),
    ]));

    const second = await runGradingRetentionGc({ db, store, policies: gcPolicies, now: new Date(now.getTime() + 1) });
    expect(second).toEqual(expect.objectContaining({ scanned: 1, deleted: 1, blocked: 0 }));
    expect(deleteCalls).toEqual(['grading-model/takeover-input', 'grading-model/takeover-output']);
    expect(tombstone).toEqual(expect.objectContaining({ status: 'DELETED_WITH_HOLD', contentDeletedAt: expect.any(Date), physicalDeletedAt: expect.any(Date) }));
    expect(objectRows).toEqual(expect.arrayContaining([
      expect.objectContaining({ objectKey: 'grading-model/takeover-input', status: 'DELETED_WITH_HOLD' }),
      expect.objectContaining({ objectKey: 'grading-model/takeover-output', status: 'DELETED' }),
    ]));
    expect(run).toEqual(expect.objectContaining({ answerAttemptId: null, answerEvidenceId: null, modelInputObjectKey: null, modelOutputObjectKey: null }));
  });

  it('reconciles a grading tombstone when a hold appears after physical deletion', async () => {
    const objectKey = 'grading-model/hold-after-delete';
    const tombstone: any = { id: 'tombstone-hold-after-delete', resourceKey: 'run:hold-after-delete', resourceType: 'GradingRun', resourceId: 'run-hold-after-delete', status: 'PENDING', deletionClaimToken: 'owner-a' };
    const objectRow: any = { tombstoneId: tombstone.id, objectKey, status: 'PENDING', deletionClaimToken: 'owner-a' };
    const run: any = { id: tombstone.resourceId, state: 'CONTENT_UNAVAILABLE' };
    let holdVisible = false;
    let ownershipChecks = 0;
    const db: any = {
      gradingTombstone: {
        findUnique: async () => tombstone,
        updateMany: async ({ where, data }: any) => {
          if (where.status?.in && !where.status.in.includes(tombstone.status)) return { count: 0 };
          Object.assign(tombstone, data);
          return { count: 1 };
        },
      },
      gradingTombstoneObject: {
        updateMany: async ({ where, data }: any) => {
          if (where.objectKey !== objectKey || (where.status?.in && !where.status.in.includes(objectRow.status))) return { count: 0 };
          Object.assign(objectRow, data);
          return { count: 1 };
        },
      },
      gradingLegalHold: { findFirst: async () => holdVisible ? { id: 'hold-after-delete' } : null },
      gradingRun: { update: async ({ data }: any) => { Object.assign(run, data); return run; } },
      gradingAuditEvent: { create: async () => undefined },
    };
    const store = new MemorySubmissionObjectStore();
    store.put({ key: objectKey, ownerId: 'worker', answerId: 'answer-hold-after-delete', sizeBytes: 1, mimeType: 'application/json', checksum: 'sha256:hold', scanState: 'CLEAN' });
    await expect(deleteGradingObjectsIndependently({
      store,
      objectKeys: [objectKey],
      assertOwnership: async () => {
        ownershipChecks += 1;
        if (ownershipChecks === 2) holdVisible = true;
        return ownershipChecks === 1;
      },
      onObjectDeleted: async () => { objectRow.status = 'DELETED'; },
      onOwnershipLost: async ({ objectKey: deletedObjectKey, physicalDeletedAt }) => {
        await reconcileGradingPhysicalDelete({ db, resourceKey: tombstone.resourceKey, resourceType: tombstone.resourceType, resourceId: tombstone.resourceId, objectKey: deletedObjectKey, physicalDeletedAt, reason: 'legal-hold-observed-after-physical-delete' });
      },
    })).rejects.toThrow('grading-tombstone-lease-lost');
    expect(tombstone).toEqual(expect.objectContaining({ status: 'DELETED_WITH_HOLD', physicalDeletedAt: expect.any(Date), lastErrorCode: 'deleted-with-hold', deletionClaimToken: null }));
    expect(objectRow).toEqual(expect.objectContaining({ status: 'DELETED_WITH_HOLD', physicalDeletedAt: expect.any(Date) }));
    expect(run).toEqual(expect.objectContaining({ state: 'CONTENT_UNAVAILABLE', lifecycleBlockReason: 'legal-hold-observed-after-physical-delete' }));
  });

  it('records each object timestamp from the current physical-delete input', async () => {
    const parentPhysicalDeletedAt = new Date(now.getTime() - 2_000);
    const firstObjectDeletedAt = new Date(now.getTime() - 1_000);
    const secondObjectDeletedAt = new Date(now.getTime() - 500);
    const tombstone: any = {
      id: 'tombstone-object-times',
      resourceKey: 'run:object-times',
      resourceType: 'GradingRun',
      resourceId: 'run-object-times',
      status: 'PENDING',
      physicalDeletedAt: parentPhysicalDeletedAt,
    };
    const objects: any[] = [
      { tombstoneId: tombstone.id, objectKey: 'grading-model/object-time-1', status: 'PENDING' },
      { tombstoneId: tombstone.id, objectKey: 'grading-model/object-time-2', status: 'PENDING' },
    ];
    const db: any = {
      gradingTombstone: {
        findUnique: async () => tombstone,
        updateMany: async ({ data }: any) => { Object.assign(tombstone, data); return { count: 1 }; },
      },
      gradingTombstoneObject: {
        updateMany: async ({ where, data }: any) => {
          const row = objects.find((candidate) => candidate.objectKey === where.objectKey);
          if (!row) return { count: 0 };
          Object.assign(row, data);
          return { count: 1 };
        },
      },
      gradingRun: { update: async () => undefined },
      gradingAuditEvent: { create: async () => undefined },
    };

    await reconcileGradingPhysicalDelete({ db, resourceKey: tombstone.resourceKey, resourceType: tombstone.resourceType, resourceId: tombstone.resourceId, objectKey: objects[0].objectKey, physicalDeletedAt: firstObjectDeletedAt, reason: 'takeover-after-object-1' });
    await reconcileGradingPhysicalDelete({ db, resourceKey: tombstone.resourceKey, resourceType: tombstone.resourceType, resourceId: tombstone.resourceId, objectKey: objects[1].objectKey, physicalDeletedAt: secondObjectDeletedAt, reason: 'takeover-after-object-2' });

    expect(tombstone.physicalDeletedAt).toEqual(parentPhysicalDeletedAt);
    expect(objects).toEqual(expect.arrayContaining([
      expect.objectContaining({ objectKey: 'grading-model/object-time-1', physicalDeletedAt: firstObjectDeletedAt, deletedAt: firstObjectDeletedAt }),
      expect.objectContaining({ objectKey: 'grading-model/object-time-2', physicalDeletedAt: secondObjectDeletedAt, deletedAt: secondObjectDeletedAt }),
    ]));
  });

  it('redacts a delete-content tombstone identity without breaking stable lookup', async () => {
    const rawResourceKey = 'run:terminal-redaction';
    const tombstone: any = {
      id: 'tombstone-terminal-redaction',
      resourceKey: rawResourceKey,
      resourceId: 'run-terminal-redaction',
      lookupKey: `redacted:grading-lookup:${pseudonymizeGradingLineage(rawResourceKey, 'lookup-key')}`,
      status: 'PENDING',
      deletionClaimToken: 'owner-terminal-redaction',
      lineageRetained: true,
    };
    const db: any = {
      gradingTombstone: {
        findUnique: async ({ where }: any) => (
          where.resourceKey === tombstone.resourceKey || where.lookupKey === tombstone.lookupKey ? tombstone : null
        ),
        updateMany: async ({ where, data }: any) => {
          const matches = where.resourceKey === tombstone.resourceKey || where.lookupKey === tombstone.lookupKey;
          if (!matches || (where.status?.in && !where.status.in.includes(tombstone.status)) || (where.deletionClaimToken !== undefined && where.deletionClaimToken !== tombstone.deletionClaimToken)) return { count: 0 };
          Object.assign(tombstone, data);
          return { count: 1 };
        },
      },
      gradingAuditEvent: { create: async () => undefined },
    };

    await completeGradingTombstone(db, rawResourceKey, now, { workerClaimToken: 'owner-terminal-redaction' });
    const redactedResourceKey = tombstone.resourceKey;
    expect(redactedResourceKey).not.toBe(rawResourceKey);
    expect(redactedResourceKey).toMatch(/^redacted:grading-operation:/);
    expect(tombstone.resourceId).not.toBe('run-terminal-redaction');
    expect(tombstone.lineageRetained).toBe(false);
    expect(tombstone.lookupKey).toBe(`redacted:grading-lookup:${pseudonymizeGradingLineage(rawResourceKey, 'lookup-key')}`);

    await expect(completeGradingTombstone(db, rawResourceKey, new Date(now.getTime() + 1))).resolves.toBeUndefined();
    expect(tombstone.resourceKey).toBe(redactedResourceKey);
  });

  it('clears reverse grading lineage while preserving teacher-review statistics', async () => {
    const reviewedAt = new Date(now.getTime() - 1_000);
    const run: any = { id: 'run-reverse-lineage', answerAttemptId: 'attempt-student', answerEvidenceId: 'evidence-reverse', inputHash: 'raw-input-hash', questionSnapshotHash: 'raw-question-hash', idempotencyKey: 'raw-run-request', dedupeKey: 'raw-run-dedupe', rerunIdentity: 'raw-run-rerun', limitations: [], teacherReviewedAt: reviewedAt, draftTotalScore: 8, state: 'AWAITING_REVIEW' };
    const item: any = { id: 'item-reverse-lineage', batchId: 'batch-reverse', state: 'SUCCEEDED', answerId: 'student-answer', attemptId: 'attempt-student', evidenceId: 'evidence-reverse', conversionId: 'conversion-reverse', gradingRunId: run.id, questionSnapshotHash: 'raw-item-question-hash', evidenceHash: 'raw-evidence-hash', inputHash: 'raw-item-hash' };
    const job: any = { id: 'job-reverse-lineage', state: 'SUCCEEDED', attemptId: 'attempt-student', conversionId: 'conversion-reverse', batchId: 'batch-reverse', batchItemId: item.id, gradingRunId: run.id, policyId: 'policy-raw', idempotencyKey: 'raw-job-request', rerunIdentity: 'raw-job-rerun', dedupeKey: 'raw-job-dedupe' };
    const rerun: any = { id: 'rerun-reverse-lineage', batchId: 'batch-reverse', gradingRunId: run.id, gradingJobId: job.id, rerunIdentity: 'raw-rerun', idempotencyKey: 'raw-rerun-request' };
    const evidence: any = { id: 'evidence-reverse', conversionId: 'conversion-reverse', attemptId: 'attempt-student', sourceAssetId: 'asset-student', sourceHash: 'raw-evidence-source-hash' };
    const conversion: any = { id: 'conversion-reverse', sourceChecksum: 'raw-conversion-source-checksum', outputChecksum: 'raw-conversion-output-checksum', renderedObjectKey: 'raw-conversion-object', renderedChecksum: 'raw-conversion-rendered-checksum', dedupeKey: 'raw-conversion-dedupe', assetId: 'asset-student', attemptId: 'attempt-student' };
    const matches = (row: any, where: any): boolean => {
      if (where.id?.in && !where.id.in.includes(row.id)) return false;
      if (where.id && typeof where.id === 'string' && row.id !== where.id) return false;
      if (where.answerEvidenceId && row.answerEvidenceId !== where.answerEvidenceId) return false;
      if (where.conversionId && row.conversionId !== where.conversionId) return false;
      if (where.gradingRunId && row.gradingRunId !== where.gradingRunId) return false;
      if (where.batchId && row.batchId !== where.batchId) return false;
      if (where.state?.in && !where.state.in.includes(row.state)) return false;
      if (where.OR && !where.OR.some((part: any) => matches(row, part))) return false;
      return true;
    };
    const db: any = {
      answerEvidence: {
        findMany: async ({ where }: any) => matches(evidence, where) ? [evidence] : [],
        updateMany: async ({ where, data }: any) => { if (!matches(evidence, where)) return { count: 0 }; Object.assign(evidence, data); return { count: 1 }; },
      },
      gradingRun: {
        findMany: async ({ where }: any) => matches(run, where) ? [run] : [],
        update: async ({ data }: any) => { Object.assign(run, data); return run; },
      },
      gradingBatchItem: {
        findMany: async ({ where }: any) => matches(item, where) ? [item] : [],
        updateMany: async ({ where, data }: any) => { if (!matches(item, where)) return { count: 0 }; Object.assign(item, data); return { count: 1 }; },
      },
      gradingJob: {
        findMany: async ({ where }: any) => matches(job, where) ? [job] : [],
        updateMany: async ({ where, data }: any) => { if (!matches(job, where)) return { count: 0 }; Object.assign(job, data); return { count: 1 }; },
        update: async ({ data }: any) => { Object.assign(job, data); return job; },
      },
      documentConversion: { update: async ({ data }: any) => { Object.assign(conversion, data); return conversion; } },
      gradingRerun: {
        findMany: async ({ where }: any) => matches(rerun, where) ? [rerun] : [],
        update: async ({ data }: any) => { Object.assign(rerun, data); return rerun; },
      },
      gradingCriterionAssessment: { updateMany: async () => ({ count: 1 }) },
      gradingAnnotation: { updateMany: async () => ({ count: 1 }) },
    };

    await clearReverseGradingLineage({ db, resourceType: 'GradingRun', resourceId: run.id, reason: 'run-content-unavailable', now });

    expect(run).toEqual(expect.objectContaining({ answerAttemptId: null, answerEvidenceId: null, teacherReviewedAt: reviewedAt, draftTotalScore: 8 }));
    expect(run.inputHash).not.toBe('raw-input-hash');
    expect(run.idempotencyKey).not.toBe('raw-run-request');
    expect(run.dedupeKey).not.toBe('raw-run-dedupe');
    expect(item).toEqual(expect.objectContaining({ state: 'SUCCEEDED', answerId: null, attemptId: null, evidenceId: null, conversionId: null, gradingRunId: null, evidenceHash: null, inputHash: null }));
    expect(item.questionSnapshotHash).not.toBe('raw-item-question-hash');
    expect(job).toEqual(expect.objectContaining({ state: 'SUCCEEDED', attemptId: null, conversionId: null, batchId: null, batchItemId: null, gradingRunId: null, policyId: null }));
    expect(job.dedupeKey).not.toBe('raw-job-dedupe');
    expect(rerun).toEqual(expect.objectContaining({ batchId: null, gradingRunId: null, gradingJobId: null }));
    expect(rerun.idempotencyKey).not.toBe('raw-rerun-request');

    await clearReverseGradingLineage({ db, resourceType: 'DocumentConversion', resourceId: evidence.conversionId, reason: 'conversion-content-unavailable', now });
    expect(evidence.conversionId).toBeNull();
    expect(evidence.sourceHash).not.toBe('raw-evidence-source-hash');
    expect(conversion).toEqual(expect.objectContaining({ state: 'CONTENT_UNAVAILABLE', sourceChecksum: expect.not.stringMatching('raw-conversion-source-checksum'), outputChecksum: null, renderedObjectKey: null, renderedChecksum: null, assetId: null, attemptId: null }));
    expect(run.answerAttemptId).toBeNull();
  });

  it('treats only an explicit missing-object response as already deleted', async () => {
    const store = new MemorySubmissionObjectStore();
    store.delete = async () => { throw Object.assign(new Error('bucket unavailable'), { name: 'NoSuchBucket', statusCode: 404 }); };
    await expect(deleteGradingObjectsIndependently({ store, objectKeys: ['grading-derived/bucket-error'] })).rejects.toMatchObject({ name: 'NoSuchBucket' });
    store.delete = async () => { throw Object.assign(new Error('object absent'), { name: 'NoSuchKey', statusCode: 404 }); };
    await expect(deleteGradingObjectsIndependently({ store, objectKeys: ['grading-derived/object-missing'] })).resolves.toBeUndefined();
  });

  it('blocks every legacy grading record without an expiry or frozen lifecycle policy and audits the block', async () => {
    const audits: any[] = [];
    const batchItemUpdates: any[] = [];
    const jobUpdates: any[] = [];
    const batchUpdates: any[] = [];
    const legacyEvidence: any = { id: 'legacy-evidence', attemptId: 'legacy-attempt', retentionExpiresAt: null, tombstonedAt: null, lifecyclePolicyId: null };
    const legacyConversion: any = { id: 'legacy-conversion', assetId: 'legacy-asset', attemptId: 'legacy-attempt', state: 'SUCCEEDED', retentionExpiresAt: null, lifecyclePolicyId: null };
    const legacyRun: any = { id: 'legacy-run', answerAttemptId: 'legacy-attempt', answerEvidenceId: 'legacy-evidence', state: 'AWAITING_REVIEW', retentionExpiresAt: null, lifecyclePolicyId: null };
    const legacyBatch: any = { id: 'legacy-batch', classId: 'legacy-class', assignmentRevisionId: 'legacy-revision', questionId: 'legacy-question', retentionExpiresAt: null, tombstonedAt: null, lifecyclePolicyId: null };
    const legacyAttempt: any = { id: 'legacy-attempt', answerId: 'legacy-answer', textSnapshot: 'legacy text', textSnapshotExpiresAt: null, textSnapshotPolicyId: null };
    const db: any = {
      answerEvidence: { findMany: async () => [legacyEvidence], updateMany: async ({ data }: any) => { Object.assign(legacyEvidence, data); return { count: 1 }; } },
      documentConversion: { findMany: async () => [legacyConversion], updateMany: async ({ data }: any) => { Object.assign(legacyConversion, data); return { count: 1 }; } },
      gradingRun: { findMany: async () => [legacyRun], updateMany: async ({ data }: any) => { Object.assign(legacyRun, data); return { count: 1 }; } },
      submissionAttempt: { findMany: async () => [legacyAttempt], updateMany: async ({ data }: any) => { Object.assign(legacyAttempt, data); return { count: 1 }; } },
      gradingBatchItem: {
        findMany: async () => [{ id: 'legacy-batch-item', batchId: legacyBatch.id }],
        updateMany: async ({ data }: any) => { batchItemUpdates.push(data); return { count: 1 }; },
      },
      gradingJob: { updateMany: async ({ data }: any) => { jobUpdates.push(data); return { count: 1 }; } },
      gradingBatch: { findMany: async () => [legacyBatch], updateMany: async ({ data }: any) => { batchUpdates.push(data); Object.assign(legacyBatch, data); return { count: 1 }; } },
      gradingLegalHold: { findFirst: async () => null },
      gradingAuditEvent: { create: async ({ data }: any) => { audits.push(data); return data; } },
    };

    const result = await runGradingRetentionGc({ db, store: new MemorySubmissionObjectStore(), policies: gcPolicies, now });
    expect(result).toEqual(expect.objectContaining({ scanned: 5, blocked: 5, deleted: 0 }));
    expect(audits).toHaveLength(5);
    expect(audits.every((event) => event.action.includes('blocked'))).toBe(true);
    expect(legacyEvidence).toEqual(expect.objectContaining({ readiness: 'BLOCKED', lifecycleBlockedAt: expect.any(Date), lifecycleBlockReason: expect.any(String) }));
    expect(legacyConversion).toEqual(expect.objectContaining({ state: 'BLOCKED', lifecycleBlockedAt: expect.any(Date), lifecycleBlockReason: expect.any(String) }));
    expect(legacyRun).toEqual(expect.objectContaining({ state: 'BLOCKED', lifecycleBlockedAt: expect.any(Date), lifecycleBlockReason: expect.any(String) }));
    expect(legacyBatch).toEqual(expect.objectContaining({ state: 'BLOCKED', lifecycleBlockedAt: expect.any(Date), lifecycleBlockReason: expect.any(String) }));
    expect(legacyAttempt).toEqual(expect.objectContaining({ textSnapshot: 'legacy text', lifecycleBlockedAt: expect.any(Date), lifecycleBlockReason: expect.any(String) }));
    expect(batchItemUpdates).toEqual(expect.arrayContaining([expect.objectContaining({ state: 'BLOCKED', workerClaimToken: null, workerClaimedAt: null })]));
    expect(jobUpdates).toEqual(expect.arrayContaining([expect.objectContaining({ state: 'CONTENT_UNAVAILABLE', workerClaimToken: null, workerClaimedAt: null, workerLeaseExpiresAt: null })]));
    expect(batchUpdates).toEqual(expect.arrayContaining([expect.objectContaining({ state: 'BLOCKED' })]));
  });

  it('reads retention fields from Prisma-shaped selects and does not block a finite record', async () => {
    const calls: Record<string, any> = {};
    const conversion: any = {
      id: 'conversion-finite-select',
      renderedObjectKey: null,
      assetId: null,
      attemptId: null,
      state: 'SUCCEEDED',
      lifecyclePolicyId: 'lifecycle:document-conversion:v1',
      lifecyclePolicyVersion: 'v1',
      lifecycleDeleteStrategy: 'delete-content',
      lifecycleRetentionSeconds: 60,
      lifecycleGovernedRecordRule: null,
      lifecycleProviderRetentionSeconds: 0,
      retentionExpiresAt: new Date(now.getTime() - 1),
    };
    const tombstones: any[] = [];
    const db: any = {
      answerEvidence: { findMany: async (args: any) => { calls.evidence = args; return []; } },
      documentConversion: {
        findMany: async (args: any) => { calls.conversion = args; return [conversion]; },
        update: async ({ data }: any) => { Object.assign(conversion, data); return conversion; },
        updateMany: async ({ data }: any) => { Object.assign(conversion, data); return { count: 1 }; },
      },
      gradingRun: { findMany: async (args: any) => { calls.run = args; return []; } },
      gradingBatch: { findMany: async (args: any) => { calls.batch = args; return []; } },
      submissionAttempt: { findMany: async (args: any) => { calls.snapshot = args; if (args.select.textSnapshotExpiresAt !== true) throw new Error('text-snapshot-expiry-projection-missing'); return []; } },
      gradingJob: { updateMany: async () => ({ count: 0 }) },
      gradingTombstone: {
        findUnique: async ({ where }: any) => tombstones.find((row) => row.resourceKey === where.resourceKey) ?? null,
        create: async ({ data }: any) => { tombstones.push(data); return data; },
        update: async ({ where, data }: any) => { const row = tombstones.find((candidate) => candidate.resourceKey === where.resourceKey); Object.assign(row, data); return row; },
        updateMany: async ({ where, data }: any) => {
          const row = tombstones.find((candidate) => candidate.resourceKey === where.resourceKey);
          if (!row || (where.deletionClaimToken !== undefined && row.deletionClaimToken !== where.deletionClaimToken)) return { count: 0 };
          Object.assign(row, data);
          return { count: 1 };
        },
      },
      gradingLegalHold: { findFirst: async () => null },
      gradingAuditEvent: { create: async () => undefined },
      $transaction: async (callback: (tx: any) => Promise<unknown>) => callback(db),
    };
    const result = await runGradingRetentionGc({ db, store: new MemorySubmissionObjectStore(), policies: gcPolicies, now });
    expect(result).toEqual(expect.objectContaining({ scanned: 1, deleted: 1, blocked: 0 }));
    for (const field of ['lifecyclePolicyId', 'lifecyclePolicyVersion', 'lifecycleDeleteStrategy', 'lifecycleRetentionSeconds', 'retentionExpiresAt']) {
      expect(calls.conversion.select[field]).toBe(true);
      expect(calls.run.select[field]).toBe(true);
      expect(calls.batch.select[field]).toBe(true);
    }
    expect(calls.snapshot.select).toEqual(expect.objectContaining({ textSnapshotExpiresAt: true, textSnapshotPolicyId: true, textSnapshotRetentionSeconds: true }));
    expect(calls.conversion.where.OR).toEqual(expect.arrayContaining([{ retentionExpiresAt: { lte: now } }, { retentionExpiresAt: null }]));
  });

  it('clears grading-run snapshots and direct lineage for delete-content and pseudonymize-lineage', async () => {
    const deleteRun: any = { id: 'run-delete-lineage', answerAttemptId: 'attempt-delete-lineage', answerEvidenceId: 'evidence-delete-lineage', questionId: 'question-delete-lineage', inputHash: 'sha256:delete', modelInputObjectKey: null, modelOutputObjectKey: null, limitations: [], state: 'AWAITING_REVIEW', tombstonedAt: null };
    const pseudoRun: any = { id: 'run-pseudo-lineage', answerAttemptId: 'attempt-pseudo-lineage', answerEvidenceId: 'evidence-pseudo-lineage', questionId: 'question-pseudo-lineage', inputHash: 'sha256:pseudo', modelInputObjectKey: null, modelOutputObjectKey: null, limitations: [], state: 'AWAITING_REVIEW', tombstonedAt: null };
    const updates: any[] = [];
    const tombstones: any[] = [];
    const db: any = {
      answerEvidence: { findMany: async () => [], findUnique: async () => null },
      documentConversion: { findMany: async () => [] },
      gradingRun: {
        findMany: async () => [{ ...frozen('grading-run', deleteRun), lifecyclePolicyId: 'policy-delete-lineage', lifecyclePolicyVersion: 'v1', lifecycleDeleteStrategy: 'delete-content' }, { ...frozen('grading-run', pseudoRun), lifecyclePolicyId: 'policy-pseudo-lineage', lifecyclePolicyVersion: 'v1', lifecycleDeleteStrategy: 'pseudonymize-lineage' }],
        update: async ({ where, data }: any) => { const row = where.id === deleteRun.id ? deleteRun : pseudoRun; Object.assign(row, data); updates.push({ id: where.id, data }); return row; },
      },
      gradingBatch: { findMany: async () => [] },
      gradingJob: { updateMany: async () => ({ count: 1 }) },
      gradingBatchItem: { updateMany: async ({ data }: any) => { updates.push({ batchItem: true, data }); return { count: 1 }; } },
      gradingCriterionAssessment: { updateMany: async () => ({ count: 1 }) },
      gradingAnnotation: { updateMany: async () => ({ count: 1 }) },
      gradingTombstone: {
        findUnique: async ({ where }: any) => tombstones.find((row) => row.resourceKey === where.resourceKey) ?? null,
        create: async ({ data }: any) => { tombstones.push(data); return data; },
        updateMany: tombstoneUpdateMany(tombstones),
        update: async ({ where, data }: any) => { const row = tombstones.find((candidate) => candidate.resourceKey === where.resourceKey); Object.assign(row, data); return row; },
      },
      gradingLegalHold: { findFirst: async () => null },
      gradingAuditEvent: { create: async () => undefined },
      $transaction: async (callback: (tx: any) => Promise<unknown>) => callback(db),
    };

    const result = await runGradingRetentionGc({
      db,
      store: new MemorySubmissionObjectStore(),
      policies: [
        { id: 'policy-delete-lineage', dataClass: 'grading-run', version: 'v1', retentionSeconds: 60, providerRetentionSeconds: 0, deleteStrategy: 'delete-content' },
        { id: 'policy-pseudo-lineage', dataClass: 'grading-run', version: 'v1', retentionSeconds: 60, providerRetentionSeconds: 0, deleteStrategy: 'pseudonymize-lineage' },
        { id: 'lifecycle:grading-run:v1', dataClass: 'grading-run', version: 'v1', retentionSeconds: 60, providerRetentionSeconds: 0, deleteStrategy: 'delete-content' },
        gcPolicies[1],
      ],
      now,
    });

    expect(result).toEqual(expect.objectContaining({ scanned: 2, deleted: 2, blocked: 0 }));
    expect(deleteRun).toEqual(expect.objectContaining({ questionSnapshot: null, rubricSnapshot: null, referenceAnswer: null, policySnapshot: null, answerAttemptId: null, answerEvidenceId: null, questionId: null, rubricId: null, batchId: null }));
    expect(pseudoRun).toEqual(expect.objectContaining({ questionSnapshot: null, rubricSnapshot: null, referenceAnswer: null, policySnapshot: null, answerAttemptId: null, answerEvidenceId: null, questionId: null, rubricId: null, batchId: null }));
    const deleteTombstone = tombstones.find((row) => row.resourceType === 'GradingRun' && row.lineageRetained === false);
    expect(deleteTombstone).toEqual(expect.objectContaining({ status: 'DELETED', lineageRetained: false, lineageReference: expect.any(String) }));
    expect(deleteTombstone.resourceId).not.toBe(deleteRun.id);
    const pseudoTombstone = tombstones.find((row) => row.lineageRetained === true && row.lineageReference && row.resourceKey !== `run:${pseudoRun.id}`);
    expect(pseudoTombstone).toEqual(expect.objectContaining({ status: 'DELETED', lineageRetained: true, pseudonymizedAt: now }));
    expect(pseudoTombstone.resourceKey).not.toBe(`run:${pseudoRun.id}`);
    expect(pseudoTombstone.resourceId).not.toBe(pseudoRun.id);
  });

  it('records provider retention as blocked until an adapter confirms deletion, then retries', async () => {
    const providerProcessedAt = new Date(now.getTime() - 500);
    const conversion: any = { id: 'conversion-provider-retention', renderedObjectKey: 'grading-provider/provider-retention', assetId: 'asset-provider-retention', attemptId: 'attempt-provider-retention', providerRequestId: 'provider-request-1', providerProcessedAt, policy: { provider: 'mathpix' }, state: 'SUCCEEDED' };
    const tombstones: any[] = [];
    const audits: any[] = [];
    const store = new MemorySubmissionObjectStore();
    store.put({ key: conversion.renderedObjectKey, ownerId: 'worker', answerId: 'answer-provider-retention', sizeBytes: 1, mimeType: 'application/json', checksum: 'sha256:provider', scanState: 'CLEAN' });
    const db: any = {
      answerEvidence: { findMany: async () => [] },
      documentConversion: { findMany: async () => [{ ...frozen('document-conversion', conversion), lifecyclePolicyId: 'policy-provider-retention', lifecyclePolicyVersion: 'v1', lifecycleDeleteStrategy: 'delete-content', lifecycleProviderRetentionSeconds: 1 }], update: async ({ data }: any) => Object.assign(conversion, data) },
      gradingRun: { findMany: async () => [] },
      gradingJob: { updateMany: async () => ({ count: 1 }) },
      gradingTombstone: {
        findUnique: async ({ where }: any) => tombstones.find((row) => row.resourceKey === where.resourceKey || row.lookupKey === where.lookupKey) ?? null,
        create: async ({ data }: any) => { tombstones.push(data); return data; },
        updateMany: tombstoneUpdateMany(tombstones),
        update: async ({ where, data }: any) => { const row = tombstones.find((candidate) => candidate.resourceKey === where.resourceKey); Object.assign(row, data); return row; },
      },
      gradingLegalHold: { findFirst: async () => null },
      gradingAuditEvent: { create: async ({ data }: any) => { audits.push(data); return data; } },
      $transaction: async (callback: (tx: any) => Promise<unknown>) => callback(db),
    };
    const policy = { id: 'policy-provider-retention', dataClass: 'document-conversion', version: 'v1', retentionSeconds: 60, providerRetentionSeconds: 1, deleteStrategy: 'delete-content' as const };

    const blocked = await runGradingRetentionGc({ db, store, policies: [policy], now });
    expect(blocked).toEqual(expect.objectContaining({ blocked: 1, deleted: 1 }));
    expect(tombstones[0]).toEqual(expect.objectContaining({ status: 'BLOCKED', contentDeletedAt: expect.any(Date), providerDeletionState: 'BLOCKED', providerDeletionReason: 'provider-deletion-api-unavailable', provider: 'mathpix', providerRequestId: 'provider-request-1' }));
    expect(audits.some((event) => event.action === 'grading-retention.provider-blocked')).toBe(true);

    const providerCalls: any[] = [];
    const retried = await runGradingRetentionGc({
      db,
      store,
      policies: [policy],
      providerRetentionAdapter: { delete: async (request) => { providerCalls.push(request); return { deleted: true }; } },
      now: new Date(now.getTime() + 2_000),
    });
    expect(retried).toEqual(expect.objectContaining({ blocked: 0, deleted: 1 }));
    expect(providerCalls).toHaveLength(1);
    expect(providerCalls[0]).toEqual(expect.objectContaining({
      resourceType: 'DocumentConversion',
      requestKey: 'grading-provider-retention:conversion:conversion-provider-retention',
      provider: 'mathpix',
      providerRequestId: 'provider-request-1',
      deletionHandle: null,
      providerRetentionSeconds: 1,
      deadline: expect.any(Date),
      signal: expect.any(AbortSignal),
    }));
    expect(providerCalls[0].deadline).toEqual(new Date(providerProcessedAt.getTime() + 1_000));
    expect(tombstones[0]).toEqual(expect.objectContaining({ status: 'DELETED', providerDeletionState: 'DELETED' }));
    expect(await store.head(conversion.renderedObjectKey)).toBeNull();
  });

  it('clears batch snapshots and direct lineage references when batch content is deleted', async () => {
    const batch: any = {
      id: 'batch-lineage-cleanup',
      assignmentRevisionId: 'revision-lineage-cleanup',
      questionId: 'question-lineage-cleanup',
      classId: 'class-lineage-cleanup',
      requesterUserId: 'requester-lineage-cleanup',
      retentionExpiresAt: new Date(now.getTime() - 1),
      tombstonedAt: null,
      state: 'COMPLETED',
    };
    const tombstones: any[] = [];
    const db: any = {
      answerEvidence: { findMany: async () => [] },
      documentConversion: { findMany: async () => [] },
      gradingRun: { findMany: async () => [], updateMany: async () => ({ count: 1 }) },
      gradingBatch: { findMany: async () => [frozen('ai-draft', { ...batch })], update: async ({ data }: any) => { Object.assign(batch, data); return batch; } },
      gradingBatchItem: { updateMany: async () => ({ count: 1 }), deleteMany: async () => ({ count: 1 }) },
      gradingJob: { updateMany: async () => ({ count: 1 }) },
      gradingTombstone: {
        findUnique: async ({ where }: any) => tombstones.find((row) => row.resourceKey === where.resourceKey) ?? null,
        create: async ({ data }: any) => { tombstones.push(data); return data; },
        updateMany: tombstoneUpdateMany(tombstones),
        update: async ({ where, data }: any) => { const row = tombstones.find((candidate) => candidate.resourceKey === where.resourceKey); Object.assign(row, data); return row; },
      },
      gradingLegalHold: { findFirst: async () => null },
      gradingAuditEvent: { create: async () => undefined },
      $transaction: async (callback: (tx: any) => Promise<unknown>) => callback(db),
    };

    const result = await runGradingRetentionGc({ db, store: new MemorySubmissionObjectStore(), policies: [gcPolicies[2], gcPolicies[1]], now });
    expect(result).toEqual(expect.objectContaining({ scanned: 1, deleted: 1, blocked: 0 }));
    expect(batch).toEqual(expect.objectContaining({ state: 'CONTENT_UNAVAILABLE', assignmentRevisionId: null, classId: null, requesterUserId: null }));
    expect(tombstones[0]).toEqual(expect.objectContaining({ status: 'DELETED', contentDeletedAt: now }));
  });

  it('holds expired evidence until the legal hold is released', async () => {
    const store = new MemorySubmissionObjectStore();
    const db: any = {
      answerEvidence: { findMany: async () => [frozen('answer-evidence', { id: 'evidence-1', attemptId: 'attempt-1', sourceAssetId: null, sourceHash: 'sha256:evidence', limitations: [], blocks: [] })] },
      documentConversion: { findMany: async () => [] },
      gradingRun: { findMany: async () => [] },
      gradingLegalHold: { findFirst: async () => ({ id: 'hold-1' }) },
    };
    const result = await runGradingRetentionGc({
      db,
      store,
      policies: gcPolicies,
      now,
    });
    expect(result).toEqual({ scanned: 1, deleted: 0, held: 1, blocked: 0, tombstones: 0 });
  });

  it('retains the protected source object and SubmissionAsset while deleting only rendered conversion output', async () => {
    const store = new MemorySubmissionObjectStore();
    store.put({ key: 'quarantine/source-1', ownerId: 'student-1', answerId: 'answer-1', sizeBytes: 3, mimeType: 'application/pdf', checksum: 'sha256:source', scanState: 'CLEAN' });
    store.put({ key: 'grading-rendered/conversion-1', ownerId: 'worker', answerId: 'answer-1', sizeBytes: 3, mimeType: 'application/pdf', checksum: 'sha256:rendered', scanState: 'CLEAN' });
    const updates: any[] = [];
    const assetUpdates: any[] = [];
    let assetState = 'FINALIZED';
    const tombstones: any[] = [];
    const db: any = {
      answerEvidence: { findMany: async () => [] },
      documentConversion: { findMany: async () => [frozen('document-conversion', { id: 'conversion-1', renderedObjectKey: 'grading-rendered/conversion-1', assetId: 'asset-1', asset: { objectKey: 'quarantine/source-1', checksum: 'sha256:source' } })], update: async ({ data }: any) => { updates.push(data); return data; } },
      gradingRun: { findMany: async () => [] },
      gradingJob: { updateMany: async ({ data }: any) => { updates.push(data); return data; } },
      submissionAsset: { updateMany: async ({ data }: any) => { assetState = data.state; assetUpdates.push(data); return data; } },
      submissionObjectTombstone: { upsert: async ({ create }: any) => { tombstones.push({ resourceType: 'SubmissionObject', ...create }); return create; } },
      gradingTombstone: {
        findUnique: async ({ where }: any) => tombstones.find((row) => row.resourceKey === where.resourceKey) ?? null,
        create: async ({ data }: any) => { tombstones.push(data); return data; },
        updateMany: tombstoneUpdateMany(tombstones),
        update: async ({ where, data }: any) => { const row = tombstones.find((candidate) => candidate.resourceKey === where.resourceKey); Object.assign(row, data); return row; },
      },
      gradingLegalHold: { findFirst: async () => null },
      gradingAuditEvent: { create: async () => undefined },
      $transaction: async (callback: (tx: any) => Promise<unknown>) => callback(db),
    };
    const result = await runGradingRetentionGc({ db, store, policies: gcPolicies, now });
    expect(result).toEqual({ scanned: 1, deleted: 1, held: 0, blocked: 0, tombstones: 1 });
    expect(await store.head('quarantine/source-1')).not.toBeNull();
    expect(await store.head('grading-rendered/conversion-1')).toBeNull();
    expect(tombstones.map((row) => row.resourceType)).toEqual(['DocumentConversion']);
    expect(assetUpdates).toHaveLength(0);
    expect(assetState).toBe('FINALIZED');
    expect(updates).toEqual(expect.arrayContaining([expect.objectContaining({ state: 'DELETED' })]));
  });

  it('retains a source object while another conversion still references the asset', async () => {
    const store = new MemorySubmissionObjectStore();
    store.put({ key: 'quarantine/source-1', ownerId: 'student-1', answerId: 'answer-1', sizeBytes: 3, mimeType: 'application/pdf', checksum: 'sha256:source', scanState: 'CLEAN' });
    store.put({ key: 'grading-rendered/conversion-1', ownerId: 'worker', answerId: 'answer-1', sizeBytes: 3, mimeType: 'application/pdf', checksum: 'sha256:rendered', scanState: 'CLEAN' });
    const sourceTombstones: any[] = [];
    const tombstones: any[] = [];
    const db: any = {
      answerEvidence: { findMany: async () => [], findFirst: async () => null },
      documentConversion: {
        findMany: async () => [frozen('document-conversion', { id: 'conversion-1', renderedObjectKey: 'grading-rendered/conversion-1', assetId: 'asset-1', asset: { objectKey: 'quarantine/source-1', checksum: 'sha256:source' } })],
        findFirst: async () => ({ id: 'conversion-2' }),
        update: async () => undefined,
      },
      gradingRun: { findMany: async () => [] },
      gradingJob: { updateMany: async () => ({ count: 0 }) },
      submissionAsset: { updateMany: async () => ({ count: 1 }) },
      submissionObjectTombstone: { upsert: async ({ create }: any) => { sourceTombstones.push(create); return create; } },
      gradingTombstone: {
        findUnique: async ({ where }: any) => tombstones.find((row) => row.resourceKey === where.resourceKey) ?? null,
        create: async ({ data }: any) => { tombstones.push(data); return data; },
        updateMany: tombstoneUpdateMany(tombstones),
        update: async ({ where, data }: any) => { const row = tombstones.find((candidate) => candidate.resourceKey === where.resourceKey); Object.assign(row, data); return row; },
      },
      gradingLegalHold: { findFirst: async () => null },
      gradingAuditEvent: { create: async () => undefined },
      $transaction: async (callback: (tx: any) => Promise<unknown>) => callback(db),
    };

    await runGradingRetentionGc({ db, store, policies: gcPolicies, now });
    expect(await store.head('grading-rendered/conversion-1')).toBeNull();
    expect(await store.head('quarantine/source-1')).not.toBeNull();
    expect(sourceTombstones).toHaveLength(0);
  });

  it('fences conversion workers before deleting expired rendered objects', async () => {
    const store = new MemorySubmissionObjectStore();
    store.put({ key: 'quarantine/source-race', ownerId: 'student-1', answerId: 'answer-1', sizeBytes: 3, mimeType: 'application/pdf', checksum: 'sha256:source', scanState: 'CLEAN' });
    store.put({ key: 'grading-rendered/conversion-race', ownerId: 'worker', answerId: 'answer-1', sizeBytes: 3, mimeType: 'application/pdf', checksum: 'sha256:rendered', scanState: 'CLEAN' });
    let conversionState = 'RUNNING';
    const deletionStates: string[] = [];
    const tombstones: any[] = [];
    const deleteObject = store.delete.bind(store);
    store.delete = async (key: string) => {
      deletionStates.push(conversionState);
      await deleteObject(key);
    };
    const db: any = {
      answerEvidence: { findMany: async () => [] },
      documentConversion: {
        findMany: async () => [frozen('document-conversion', { id: 'conversion-race', renderedObjectKey: 'grading-rendered/conversion-race', assetId: 'asset-race', asset: { objectKey: 'quarantine/source-race', checksum: 'sha256:source' } })],
        findFirst: async () => null,
        updateMany: async ({ data }: any) => { conversionState = data.state; return { count: 1 }; },
        update: async ({ data }: any) => { conversionState = data.state; return data; },
      },
      gradingRun: { findMany: async () => [] },
      gradingJob: { updateMany: async () => ({ count: 1 }) },
      submissionAsset: { updateMany: async () => ({ count: 1 }) },
      submissionObjectTombstone: { upsert: async () => undefined },
      gradingTombstone: {
        findUnique: async ({ where }: any) => tombstones.find((row) => row.resourceKey === where.resourceKey) ?? null,
        create: async ({ data }: any) => { tombstones.push(data); return data; },
        updateMany: tombstoneUpdateMany(tombstones),
        update: async ({ where, data }: any) => { const row = tombstones.find((candidate) => candidate.resourceKey === where.resourceKey); Object.assign(row, data); return row; },
      },
      gradingLegalHold: { findFirst: async () => null },
      gradingAuditEvent: { create: async () => undefined },
      $transaction: async (callback: (tx: any) => Promise<unknown>) => callback(db),
    };
    await runGradingRetentionGc({ db, store, policies: gcPolicies, now });
    expect(deletionStates).toEqual(['CONTENT_UNAVAILABLE']);
    expect(conversionState).toBe('DELETED');
  });

  it('persists the conversion deletion fence and tombstone before a failed physical delete', async () => {
    const events: string[] = [];
    const tombstones: any[] = [];
    const conversionUpdates: any[] = [];
    const store = new MemorySubmissionObjectStore();
    store.put({ key: 'grading-rendered/delete-fails', ownerId: 'worker', answerId: 'answer-1', sizeBytes: 3, mimeType: 'application/pdf', checksum: 'sha256:rendered', scanState: 'CLEAN' });
    const originalDelete = store.delete.bind(store);
    store.delete = async (key: string) => { events.push(`delete:${key}`); await originalDelete(key); throw new Error('object-store-delete-failed'); };
    const db: any = {
      answerEvidence: { findMany: async () => [] },
      documentConversion: {
        findMany: async () => [frozen('document-conversion', { id: 'conversion-delete-fails', renderedObjectKey: 'grading-rendered/delete-fails', canonicalMarkdown: 'private conversion markdown', assetId: 'asset-1' })],
        updateMany: async ({ data }: any) => { events.push(`conversion:${data.state}`); conversionUpdates.push(data); return { count: 1 }; },
        update: async ({ data }: any) => { events.push(`conversion:${data.state}`); conversionUpdates.push(data); return data; },
      },
      gradingRun: { findMany: async () => [] },
      gradingJob: { updateMany: async () => { events.push('job-fenced'); return { count: 1 }; } },
      gradingTombstone: {
        findUnique: async ({ where }: any) => tombstones.find((row) => row.resourceKey === where.resourceKey) ?? null,
        create: async ({ data }: any) => { events.push('tombstone-created'); tombstones.push(data); return data; },
        updateMany: tombstoneUpdateMany(tombstones),
        update: async ({ where, data }: any) => { const row = tombstones.find((candidate) => candidate.resourceKey === where.resourceKey); Object.assign(row, data); return row; },
      },
      gradingLegalHold: { findFirst: async () => null },
      gradingAuditEvent: { create: async () => undefined },
      $transaction: async (callback: (tx: any) => Promise<unknown>) => callback(db),
    };
    const result = await runGradingRetentionGc({ db, store, policies: gcPolicies, now });
    expect(result).toEqual({ scanned: 1, deleted: 0, held: 0, blocked: 1, tombstones: 1 });
    expect(events.indexOf('tombstone-created')).toBeLessThan(events.findIndex((event) => event.startsWith('delete:')));
    expect(tombstones[0]).toEqual(expect.objectContaining({ resourceType: 'DocumentConversion', status: 'RETRYABLE', contentDeletedAt: null, lastErrorCode: 'object-store-delete-failed' }));
    expect(conversionUpdates).not.toEqual(expect.arrayContaining([expect.objectContaining({ canonicalMarkdown: '[deleted-by-retention-policy]' })]));
  });

  it('recovers an existing tombstone after store.delete succeeds but final database persistence fails', async () => {
    const store = new MemorySubmissionObjectStore();
    store.put({ key: 'grading-rendered/db-fails', ownerId: 'worker', answerId: 'answer-1', sizeBytes: 3, mimeType: 'application/pdf', checksum: 'sha256:rendered', scanState: 'CLEAN' });
    const conversion: any = { id: 'conversion-db-fails', state: 'SUCCEEDED', renderedObjectKey: 'grading-rendered/db-fails', assetId: 'asset-1' };
    const tombstones: any[] = [];
    let failFinalize = true;
    const db: any = {
      answerEvidence: { findMany: async () => [] },
      documentConversion: {
        findMany: async () => conversion.state === 'DELETED' ? [] : [frozen('document-conversion', conversion)],
        updateMany: async ({ data }: any) => { Object.assign(conversion, data); return { count: 1 }; },
        update: async ({ data }: any) => { Object.assign(conversion, data); return conversion; },
      },
      gradingRun: { findMany: async () => [] },
      gradingJob: { updateMany: async () => ({ count: 1 }) },
      gradingTombstone: {
        findUnique: async ({ where }: any) => tombstones.find((row) => row.resourceKey === where.resourceKey) ?? null,
        create: async ({ data }: any) => { tombstones.push(data); return data; },
        updateMany: async ({ where, data }: any) => {
          if (failFinalize && data.status && data.status !== 'PENDING') { failFinalize = false; throw new Error('database-finalize-failed'); }
          const row = tombstones.find((candidate) => candidate.resourceKey === where.resourceKey);
          if (!row) return { count: 0 };
          Object.assign(row, data);
          return { count: 1 };
        },
        update: async ({ where, data }: any) => {
          if (failFinalize && data.status && data.status !== 'PENDING') { failFinalize = false; throw new Error('database-finalize-failed'); }
          const row = tombstones.find((candidate) => candidate.resourceKey === where.resourceKey);
          Object.assign(row, data);
          return row;
        },
      },
      gradingLegalHold: { findFirst: async () => null },
      gradingAuditEvent: { create: async () => undefined },
      $transaction: async (callback: (tx: any) => Promise<unknown>) => callback(db),
    };
    const first = await runGradingRetentionGc({ db, store, policies: gcPolicies, now });
    expect(first).toEqual({ scanned: 1, deleted: 0, held: 0, blocked: 1, tombstones: 1 });
    expect(conversion.state).toBe('CONTENT_UNAVAILABLE');
    expect(tombstones[0].contentDeletedAt).toBeNull();
    expect(await store.head('grading-rendered/db-fails')).toBeNull();

    const second = await runGradingRetentionGc({ db, store, policies: gcPolicies, now });
    expect(second).toEqual({ scanned: 1, deleted: 1, held: 0, blocked: 0, tombstones: 0 });
    expect(conversion.state).toBe('DELETED');
    expect(tombstones[0].contentDeletedAt).toEqual(now);
  });

  it('keeps grading-run content intact after a failed object delete and completes it on rerun', async () => {
    const store = new MemorySubmissionObjectStore();
    store.put({ key: 'grading-model/run-delete-fails', ownerId: 'worker', answerId: 'answer-1', sizeBytes: 3, mimeType: 'application/json', checksum: 'sha256:model', scanState: 'CLEAN' });
    store.put({ key: 'grading-model/run-delete-output', ownerId: 'worker', answerId: 'answer-1', sizeBytes: 3, mimeType: 'application/json', checksum: 'sha256:model-output', scanState: 'CLEAN' });
    const run: any = { id: 'run-delete-fails', answerAttemptId: 'attempt-1', answerEvidenceId: 'evidence-1', inputHash: 'sha256:input', modelInputObjectKey: 'grading-model/run-delete-fails', modelOutputObjectKey: 'grading-model/run-delete-output', limitations: [], state: 'AWAITING_REVIEW', tombstonedAt: null };
    const tombstones: any[] = [];
    let failDelete = true;
    const db: any = {
      answerEvidence: { findMany: async () => [], findUnique: async () => null },
      documentConversion: { findMany: async () => [] },
      gradingRun: {
        findMany: async () => run.tombstonedAt ? [] : [frozen('grading-run', run)],
        update: async ({ data }: any) => { Object.assign(run, data); return run; },
      },
      gradingJob: { updateMany: async () => ({ count: 1 }) },
      gradingCriterionAssessment: { updateMany: async () => ({ count: 1 }) },
      gradingAnnotation: { updateMany: async () => ({ count: 1 }) },
      gradingTombstone: {
        findUnique: async ({ where }: any) => tombstones.find((row) => row.resourceKey === where.resourceKey) ?? null,
        create: async ({ data }: any) => { tombstones.push(data); return data; },
        updateMany: tombstoneUpdateMany(tombstones),
        update: async ({ where, data }: any) => { const row = tombstones.find((candidate) => candidate.resourceKey === where.resourceKey); Object.assign(row, data); return row; },
      },
      gradingLegalHold: { findFirst: async () => null },
      gradingAuditEvent: { create: async () => undefined },
      $transaction: async (callback: (tx: any) => Promise<unknown>) => callback(db),
    };
    store.delete = async (key: string) => {
      if (failDelete && key === 'grading-model/run-delete-output') { failDelete = false; throw new Error('object-store-delete-failed'); }
      await MemorySubmissionObjectStore.prototype.delete.call(store, key);
    };

    const first = await runGradingRetentionGc({ db, store, policies: gcPolicies, now });
    expect(first).toEqual({ scanned: 1, deleted: 0, held: 0, blocked: 1, tombstones: 1 });
    expect(run.state).toBe('CONTENT_UNAVAILABLE');
    expect(tombstones[0]).toEqual(expect.objectContaining({ status: 'RETRYABLE', contentDeletedAt: null }));
    expect(await store.head('grading-model/run-delete-fails')).toBeNull();
    expect(await store.head('grading-model/run-delete-output')).not.toBeNull();

    const second = await runGradingRetentionGc({ db, store, policies: gcPolicies, now });
    expect(second).toEqual({ scanned: 1, deleted: 1, held: 0, blocked: 0, tombstones: 0 });
    expect(run.tombstonedAt).toEqual(now);
    expect(tombstones[0]).toEqual(expect.objectContaining({ status: 'DELETED', physicalDeletedAt: now, contentDeletedAt: now }));
    expect(await store.head('grading-model/run-delete-fails')).toBeNull();
    expect(await store.head('grading-model/run-delete-output')).toBeNull();
  });

  it('fences and redacts a grading run before deleting its model artifacts', async () => {
    const events: string[] = [];
    const tombstones: any[] = [];
    const store = new MemorySubmissionObjectStore();
    store.put({ key: 'grading-model/run-1', ownerId: 'worker', answerId: 'answer-1', sizeBytes: 3, mimeType: 'application/json', checksum: 'sha256:model', scanState: 'CLEAN' });
    const deleteObject = store.delete.bind(store);
    store.delete = async (key: string) => { events.push(`delete:${key}`); await deleteObject(key); };
    const db: any = {
      answerEvidence: { findMany: async () => [] },
      documentConversion: { findMany: async () => [] },
      gradingRun: {
        findMany: async () => [frozen('grading-run', { id: 'run-1', answerAttemptId: 'attempt-1', inputHash: 'sha256:input', modelInputObjectKey: 'grading-model/run-1', modelOutputObjectKey: null, limitations: [] })],
        update: async ({ data }: any) => { events.push(`run:${data.tombstonedAt ? 'final' : data.state}`); return data; },
      },
      gradingJob: { updateMany: async () => { events.push('job-fenced'); return { count: 1 }; } },
      gradingCriterionAssessment: { updateMany: async () => { events.push('assessment-redacted'); return { count: 1 }; } },
      gradingAnnotation: { updateMany: async () => { events.push('annotation-redacted'); return { count: 1 }; } },
      gradingTombstone: {
        findUnique: async ({ where }: any) => tombstones.find((row) => row.resourceKey === where.resourceKey) ?? null,
        create: async ({ data }: any) => { events.push('tombstone-created'); tombstones.push(data); return data; },
        updateMany: async ({ data }: any) => { events.push('tombstone-completed'); Object.assign(tombstones[0], data); return { count: 1 }; },
        update: async ({ data }: any) => { events.push('tombstone-completed'); Object.assign(tombstones[0], data); return tombstones[0]; },
      },
      gradingLegalHold: { findFirst: async () => null },
      gradingAuditEvent: { create: async () => undefined },
      $transaction: async (callback: (tx: any) => Promise<unknown>) => callback(db),
    };
    const result = await runGradingRetentionGc({ db, store, policies: gcPolicies, now });
    expect(result).toEqual({ scanned: 1, deleted: 1, held: 0, blocked: 0, tombstones: 1 });
    expect(events.indexOf('tombstone-created')).toBeLessThan(events.findIndex((event) => event.startsWith('delete:')));
    expect(tombstones[0]).toEqual(expect.objectContaining({ resourceType: 'GradingRun', contentDeletedAt: now }));
    expect(await store.head('grading-model/run-1')).toBeNull();
  });

  it('resolves asset lineage through the assignment revision to the real assignment and class scopes', async () => {
    const lineage = await resolveGradingLineage({
      db: {},
      resourceType: 'DocumentConversion',
      resource: {
        id: 'conversion-lineage',
        assetId: 'asset-lineage',
        attemptId: 'attempt-lineage',
        asset: { id: 'asset-lineage', answerId: 'answer-lineage' },
        attempt: {
          id: 'attempt-lineage',
          answer: {
            id: 'answer-lineage',
            submission: {
              assignmentRevisionId: 'revision-lineage',
              frozenAudienceClassId: 'class-lineage',
              revision: { id: 'revision-lineage', assignmentId: 'assignment-lineage' },
              audience: { classId: 'class-lineage' },
            },
          },
        },
      },
    });

    expect(lineage.scopes).toEqual(expect.arrayContaining([
      ['asset', 'asset-lineage'],
      ['attempt', 'attempt-lineage'],
      ['answer', 'answer-lineage'],
      ['assignment-revision', 'revision-lineage'],
      ['assignment', 'assignment-lineage'],
      ['class', 'class-lineage'],
    ]));
    expect(lineage.scopes).not.toContainEqual(['assignment', 'revision-lineage']);
    const spoofed = await resolveGradingLineage({ db: {}, resourceType: 'GradingBatch', resource: { id: 'batch-spoofed', assignmentRevisionId: 'revision-spoofed', assignmentId: 'revision-spoofed', classId: 'class-spoofed' } });
    expect(spoofed.scopes).not.toContainEqual(['assignment', 'revision-spoofed']);
  });

  it('fails closed on lineage database failures and only treats an explicit missing row as absent', async () => {
    const databaseFailure = new Error('database connection lost');
    await expect(resolveGradingLineage({
      db: { submissionAttempt: { findUnique: async () => { throw databaseFailure; } } },
      resourceType: 'DocumentConversion',
      resource: { id: 'conversion-db-failure', attemptId: 'attempt-db-failure' },
    })).rejects.toBe(databaseFailure);

    const endpointFailure = Object.assign(new Error('endpoint returned 404'), { name: 'EndpointNotFound', statusCode: 404 });
    await expect(resolveGradingLineage({
      db: { submissionAttempt: { findUnique: async () => { throw endpointFailure; } } },
      resourceType: 'DocumentConversion',
      resource: { id: 'conversion-endpoint-failure', attemptId: 'attempt-endpoint-failure' },
    })).rejects.toBe(endpointFailure);

    const explicitMissing = Object.assign(new Error('record not found'), { code: 'P2025' });
    const lineage = await resolveGradingLineage({
      db: { submissionAttempt: { findUnique: async () => { throw explicitMissing; } } },
      resourceType: 'DocumentConversion',
      resource: { id: 'conversion-explicit-missing', attemptId: 'attempt-explicit-missing' },
    });
    expect(lineage.scopes).toEqual(expect.arrayContaining([
      ['conversion', 'conversion-explicit-missing'],
      ['attempt', 'attempt-explicit-missing'],
    ]));
  });

  it('uses every resolved asset-to-class scope when checking legal holds', async () => {
    const holdQueries: any[] = [];
    const db: any = { gradingLegalHold: { findFirst: async ({ where }: any) => { holdQueries.push(where); return null; } } };
    const lineage = await resolveGradingLineage({
      db,
      resourceType: 'GradingRun',
      resource: {
        id: 'run-hold-lineage',
        answerAttemptId: 'attempt-hold-lineage',
        answerEvidenceId: 'evidence-hold-lineage',
        attempt: {
          id: 'attempt-hold-lineage',
          answer: {
            id: 'answer-hold-lineage',
            submission: {
              assignmentRevisionId: 'revision-hold-lineage',
              frozenAudienceClassId: 'class-hold-lineage',
              revision: { id: 'revision-hold-lineage', assignmentId: 'assignment-hold-lineage' },
              audience: { classId: 'class-hold-lineage' },
            },
          },
        },
        answerEvidence: { sourceAssetId: 'asset-hold-lineage', sourceAsset: { id: 'asset-hold-lineage' } },
      },
    });
    expect(await hasActiveGradingHold(db, lineage.scopes, now)).toBe(false);
    expect(holdQueries[0].OR).toEqual(expect.arrayContaining([
      { scopeType: 'asset', scopeId: 'asset-hold-lineage' },
      { scopeType: 'attempt', scopeId: 'attempt-hold-lineage' },
      { scopeType: 'answer', scopeId: 'answer-hold-lineage' },
      { scopeType: 'assignment-revision', scopeId: 'revision-hold-lineage' },
      { scopeType: 'assignment', scopeId: 'assignment-hold-lineage' },
      { scopeType: 'class', scopeId: 'class-hold-lineage' },
    ]));
    expect(holdQueries[0].OR).not.toContainEqual({ scopeType: 'assignment', scopeId: 'revision-hold-lineage' });
  });

  it('keeps source assets retryable after a failed delete and completes an existing tombstone on rerun', async () => {
    const store = new MemorySubmissionObjectStore();
    store.put({ key: 'quarantine/source-lifecycle', ownerId: 'student-1', answerId: 'answer-source', sizeBytes: 3, mimeType: 'application/pdf', checksum: 'sha256:source', scanState: 'CLEAN' });
    const asset: any = {
      id: 'asset-source-lifecycle', answerId: 'answer-source', attemptId: 'attempt-source', state: 'FINALIZED', objectKey: 'quarantine/source-lifecycle', checksum: 'sha256:source',
      retentionExpiresAt: new Date(now.getTime() - 1000), retentionPolicyId: 'source-policy-v1', retentionPolicyVersion: 'source.v1', retentionDeleteStrategy: 'delete-content', retentionSeconds: 60, tombstonedAt: null, deletionAttemptCount: 0,
      answer: { id: 'answer-source', submission: { assignmentRevisionId: 'revision-source', frozenAudienceClassId: 'class-source', revision: { assignmentId: 'assignment-source' } } },
      attempt: { id: 'attempt-source' }, documentConversions: [], answerEvidence: [],
    };
    const tombstones: any[] = [];
    let failDelete = true;
    const db: any = {
      gradingLifecyclePolicy: { findMany: async () => [{ id: 'lifecycle:source-asset:source.v1', dataClass: 'source-asset', version: 'source.v1', retentionSeconds: 60, governedRecordRule: null, deleteStrategy: 'delete-content', enabled: true }] },
      submissionAsset: {
        findMany: async () => asset.state === 'DELETED' ? [] : [asset],
        updateMany: async ({ data }: any) => { Object.assign(asset, data); return { count: 1 }; },
      },
      documentConversion: { findMany: async () => [] },
      answerEvidence: { findMany: async () => [] },
      gradingRun: { findMany: async () => [] },
      gradingLegalHold: { findFirst: async () => null },
      gradingAuditEvent: { create: async () => undefined },
      submissionObjectTombstone: {
        findUnique: async ({ where }: any) => tombstones.find((row) => row.objectKey === where.objectKey) ?? null,
        upsert: async ({ create, update }: any) => {
          const existing = tombstones.find((row) => row.objectKey === create.objectKey);
          if (existing) { Object.assign(existing, update); return existing; }
          tombstones.push(create);
          return create;
        },
        update: async ({ where, data }: any) => { const row = tombstones.find((candidate) => candidate.objectKey === where.objectKey); Object.assign(row, data); return row; },
      },
      $transaction: async (callback: (tx: any) => Promise<unknown>) => callback(db),
    };
    store.delete = async (key: string) => {
      if (failDelete) { failDelete = false; throw new Error('object-store-delete-failed'); }
      await MemorySubmissionObjectStore.prototype.delete.call(store, key);
    };

    const first = await garbageCollectSourceAssets(db, store, now);
    expect(first).toEqual(expect.objectContaining({ blocked: 1, deleted: 0 }));
    expect(asset.state).toBe('DELETING');
    expect(tombstones[0]).toEqual(expect.objectContaining({ objectKey: asset.objectKey, status: 'RETRYABLE' }));
    expect(await store.head(asset.objectKey)).not.toBeNull();

    const second = await garbageCollectSourceAssets(db, store, now);
    expect(second).toEqual(expect.objectContaining({ blocked: 0, deleted: 1 }));
    expect(asset.state).toBe('DELETED');
    expect(tombstones[0]).toEqual(expect.objectContaining({ status: 'DELETED', physicalDeletedAt: now }));
    expect(await store.head(asset.objectKey)).toBeNull();
  });

  it('blocks legacy finalized source assets without finite retention metadata instead of implying permanence', async () => {
    const store = new MemorySubmissionObjectStore();
    store.put({ key: 'quarantine/source-metadata-missing', ownerId: 'student-1', answerId: 'answer-source-missing', sizeBytes: 3, mimeType: 'application/pdf', checksum: 'sha256:source', scanState: 'CLEAN' });
    const asset: any = { id: 'asset-source-metadata-missing', answerId: 'answer-source-missing', state: 'FINALIZED', objectKey: 'quarantine/source-metadata-missing', retentionExpiresAt: null, retentionPolicyVersion: null, governedRecordRule: null, documentConversions: [], answerEvidence: [], answer: { submission: { assignmentRevisionId: 'revision-source-missing', frozenAudienceClassId: 'class-source-missing' } } };
    const db: any = {
      gradingLifecyclePolicy: { findMany: async () => [{ id: 'lifecycle:source-asset:source.v1', dataClass: 'source-asset', version: 'source.v1', retentionSeconds: 60, governedRecordRule: null, deleteStrategy: 'delete-content', enabled: true }] },
      submissionAsset: { findMany: async () => [asset] },
      gradingAuditEvent: { create: async () => undefined },
    };
    const result = await garbageCollectSourceAssets(db, store, now);
    expect(result).toEqual(expect.objectContaining({ scanned: 1, blocked: 1, deleted: 0 }));
    expect(await store.head(asset.objectKey)).not.toBeNull();
  });
});
