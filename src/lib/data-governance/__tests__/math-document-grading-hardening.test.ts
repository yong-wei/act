import { createHash } from 'node:crypto';

import { describe, expect, it, vi } from 'vitest';

import { MemorySubmissionObjectStore } from '@/lib/assignments/submission-object-store';
import { garbageCollectQuarantine, garbageCollectSourceAssets, renewSubmissionAssetDeletionLease } from '@/lib/assignments/submission-service';
import {
  enqueueDocumentConversion,
  materializeTextAnswerEvidence,
  renewGradingJobLease,
  startGradingJobLeaseHeartbeat,
  writeGradingAudit,
} from '../math-document-grading-persistence';
import {
  claimGradingTombstone,
  completeGradingTombstone,
  renewGradingTombstoneLease,
  runGradingRetentionGc,
} from '../math-document-grading-lifecycle';
import { renewBatchItemLease, retryQuestionGradingBatchItem } from '../math-document-grading-batch';

const now = new Date();

function matchesTombstoneCas(row: Record<string, any>, where: Record<string, any>): boolean {
  if (where.OR && !where.OR.some((part: any) => matchesTombstoneCas(row, part))) return false;
  if (where.AND && !where.AND.every((part: any) => matchesTombstoneCas(row, part))) return false;
  for (const [field, expected] of Object.entries(where)) {
    if (field === 'OR' || field === 'AND') continue;
    const actual = row[field];
    if (expected && typeof expected === 'object' && !Array.isArray(expected)) {
      if ('in' in expected && !(expected as any).in.includes(actual)) return false;
      if ('lt' in expected && !(actual && actual < (expected as any).lt)) return false;
      if ('gt' in expected && !(actual && actual > (expected as any).gt)) return false;
      continue;
    }
    if (actual !== expected) return false;
  }
  return true;
}

function lifecycleRow(dataClass: string, overrides: Record<string, unknown> = {}) {
  return {
    id: `lifecycle:${dataClass}:v2`,
    dataClass,
    version: 'v2',
    retentionSeconds: 60,
    governedRecordRule: null,
    deleteStrategy: 'delete-content' as const,
    providerRetentionSeconds: 0,
    enabled: true,
    ...overrides,
  };
}

function submittedTextAttempt() {
  return {
    id: 'attempt-hardening-1',
    answerId: 'answer-hardening-1',
    answerVersion: 2,
    textSnapshot: '稳定性证据',
    answer: {
      assets: [],
      question: {
        id: 'question-hardening-1',
        assignmentRevisionId: 'revision-hardening-1',
        stableQuestionId: 'stable-question-hardening-1',
        responseType: 'SUBJECTIVE_TEXT',
        promptSnapshot: { text: 'Explain stability.' },
        answerSnapshot: { text: 'Use evidence.' },
        rubricSnapshot: { criteria: [{ id: 'criterion-1', maxPoints: 5, levels: [] }] },
        contentHash: 'sha256:question-hardening',
      },
      submission: {
        studentId: 'student-hardening-1',
        frozenStudentId: 'student-hardening-1',
        frozenAudienceClassId: 'class-hardening-1',
        audience: { classId: 'class-hardening-1', class: { teacherId: 'teacher-hardening-1' } },
      },
    },
  };
}

describe('issue #916 phase-one governance hardening', () => {
  it('freezes the answer-evidence lifecycle policy at materialization time', async () => {
    const created: any[] = [];
    const db: any = {
      gradingLifecyclePolicy: { findMany: async () => [lifecycleRow('answer-evidence', { id: 'answer-policy-v2', version: 'v2', retentionSeconds: 600 })] },
      submissionAttempt: { findUnique: async () => submittedTextAttempt() },
      answerEvidence: {
        findFirst: async () => null,
        create: async ({ data }: any) => { created.push(data); return { ...data, blocks: data.blocks.create }; },
      },
      gradingAuditEvent: { create: async () => undefined },
    };

    await materializeTextAnswerEvidence({
      db,
      attemptId: 'attempt-hardening-1',
      actor: { id: 'teacher-hardening-1', role: 'TEACHER' },
      now,
    });

    expect(created[0]).toEqual(expect.objectContaining({
      lifecyclePolicyId: 'answer-policy-v2',
      lifecyclePolicyVersion: 'v2',
      lifecycleDeleteStrategy: 'delete-content',
      lifecycleRetentionSeconds: 600,
      retentionExpiresAt: new Date(now.getTime() + 600_000),
    }));
  });

  it('executes the frozen retain-governed-record strategy instead of current policy data', async () => {
    const evidence: any = {
      id: 'evidence-retain-frozen',
      attemptId: 'attempt-retain-frozen',
      sourceHash: 'sha256:evidence-retain-frozen',
      canonicalMarkdown: 'must remain governed',
      readiness: 'READY',
      limitations: [],
      tombstonedAt: null,
      retentionExpiresAt: null,
      lifecyclePolicyId: 'answer-policy-v1',
      lifecyclePolicyVersion: 'v1',
      lifecycleDeleteStrategy: 'retain-governed-record',
      lifecycleRetentionSeconds: null,
      lifecycleGovernedRecordRule: 'legal-evidence',
      lifecycleProviderRetentionSeconds: 0,
      blocks: [],
      attempt: { id: 'attempt-retain-frozen', answerId: 'answer-retain-frozen', answer: { submission: { frozenAudienceClassId: 'class-retain-frozen' } } },
    };
    const tombstones: any[] = [];
    const db: any = {
      answerEvidence: { findMany: async () => [evidence], update: async ({ data }: any) => Object.assign(evidence, data) },
      answerEvidenceBlock: { updateMany: async () => ({ count: 0 }) },
      documentConversion: { findMany: async () => [] },
      gradingRun: { findMany: async () => [] },
      gradingJob: { updateMany: async () => ({ count: 1 }) },
      gradingLegalHold: { findFirst: async () => null },
      gradingTombstone: {
        findUnique: async ({ where }: any) => tombstones.find((row) => row.resourceKey === where.resourceKey) ?? null,
        create: async ({ data }: any) => { tombstones.push(data); return data; },
        updateMany: async ({ where, data }: any) => {
          const row = tombstones.find((candidate) => candidate.resourceKey === where.resourceKey);
          if (!row || (where.status?.in && !where.status.in.includes(row.status)) || (where.deletionClaimToken !== undefined && row.deletionClaimToken !== where.deletionClaimToken)) return { count: 0 };
          Object.assign(row, data);
          return { count: 1 };
        },
        update: async ({ where, data }: any) => { const row = tombstones.find((candidate) => candidate.resourceKey === where.resourceKey); Object.assign(row, data); return row; },
      },
      $transaction: async (callback: (tx: any) => Promise<unknown>) => callback(db),
      gradingAuditEvent: { create: async () => undefined },
    };
    const store = new MemorySubmissionObjectStore();

    await runGradingRetentionGc({
      db,
      store,
      policies: [
        lifecycleRow('answer-evidence', { id: 'answer-policy-v2', version: 'v2', deleteStrategy: 'delete-content' }),
        lifecycleRow('document-conversion'),
        lifecycleRow('ai-draft'),
      ],
      now,
    });

    expect(evidence.canonicalMarkdown).toBe('must remain governed');
    expect(tombstones[0]).toEqual(expect.objectContaining({
      lifecyclePolicyId: 'answer-policy-v1',
      lifecyclePolicyVersion: 'v1',
      lifecycleDeleteStrategy: 'retain-governed-record',
      status: 'RETAINED',
      contentDeletedAt: null,
    }));
  });

  it('pseudonymizes audit identifiers, creates a stable event key, and fails closed on missing audit storage', async () => {
    const events: any[] = [];
    const input: any = {
      actor: { id: 'teacher-hardening-1', role: 'TEACHER' },
      action: 'grading-run.enqueued',
      purpose: 'rubric-grading',
      resourceType: 'GradingRun',
      resourceId: 'run-hardening-1',
      assignmentId: 'assignment-hardening-1',
      answerId: 'answer-hardening-1',
      classId: 'class-hardening-1',
      metadata: { questionId: 'question-hardening-1', text: 'do not persist this' },
    };
    const db: any = { gradingAuditEvent: { create: async ({ data }: any) => { events.push(data); return data; } } };

    await writeGradingAudit(db, { ...input, metadata: { ...input.metadata, attempt: 1, errorCode: 'provider-timeout' } });
    await writeGradingAudit(db, { ...input, metadata: { ...input.metadata, attempt: 2, errorCode: 'provider-timeout' } });
    await writeGradingAudit(db, { ...input, metadata: { ...input.metadata, attempt: 2, error: 'object-store-delete-failed' } });

    expect(events[0].eventKey).not.toBe(events[1].eventKey);
    expect(events[0].metadata.attempt).toBe(1);
    expect(events[1].metadata.attempt).toBe(2);
    expect(events[0].resourceId).not.toBe('run-hardening-1');
    expect(events[0].assignmentId).not.toBe('assignment-hardening-1');
    expect(events[0].answerId).not.toBe('answer-hardening-1');
    expect(events[0].classId).not.toBe('class-hardening-1');
    expect(events[0].metadata.questionId).not.toBe('question-hardening-1');
    expect(events[0].metadata.text).toBe('[redacted]');
    expect(events[2].metadata.safeRuntime.errorCode).toBe('object-store-delete-failed');
    expect(events[2].metadata.error).toBeUndefined();
    await expect(writeGradingAudit({}, input)).rejects.toThrow('grading-audit-repository-unavailable');
  });

  it('claims a grading tombstone once, rechecks holds, and fences an old owner after takeover', async () => {
    const tombstone: any = {
      resourceKey: 'run:lease-hardening',
      resourceType: 'GradingRun',
      resourceId: 'run-lease-hardening',
      status: 'PENDING',
      deletionClaimToken: null,
      deletionLeaseExpiresAt: null,
    };
    const updates: any[] = [];
    const db: any = {
      gradingLegalHold: { findFirst: async () => null },
      gradingTombstone: {
        findUnique: async () => tombstone,
        updateMany: async ({ where, data }: any) => {
          if (where.resourceKey !== tombstone.resourceKey
            || (where.deletionClaimToken !== undefined && where.deletionClaimToken !== tombstone.deletionClaimToken)
            || (where.status?.in && !where.status.in.includes(tombstone.status))) return { count: 0 };
          const claimable = !where.OR || where.OR.some((condition: any) => (condition.deletionClaimToken === null && tombstone.deletionClaimToken === null)
            || (condition.deletionLeaseExpiresAt?.lt && (!tombstone.deletionLeaseExpiresAt || tombstone.deletionLeaseExpiresAt < condition.deletionLeaseExpiresAt.lt)));
          if (!claimable) return { count: 0 };
          Object.assign(tombstone, data);
          updates.push({ where, data });
          return { count: 1 };
        },
      },
    };

    await expect(claimGradingTombstone({ db, resourceKey: tombstone.resourceKey, claimToken: 'owner-a', now })).resolves.toBe(true);
    await expect(claimGradingTombstone({ db, resourceKey: tombstone.resourceKey, claimToken: 'owner-b', now: new Date(now.getTime() + 1) })).resolves.toBe(false);
    await expect(completeGradingTombstone(db, tombstone.resourceKey, now, { workerClaimToken: 'owner-b' })).rejects.toThrow('grading-tombstone-complete-fenced');
    await expect(completeGradingTombstone(db, tombstone.resourceKey, now, { workerClaimToken: 'owner-a' })).resolves.toBeUndefined();
    expect(tombstone.status).toBe('DELETED');
    expect(updates).toHaveLength(2);
  });

  it('does not claim a tombstone when a hold appears between scan and claim', async () => {
    let claimUpdates = 0;
    const db: any = {
      gradingLegalHold: { findFirst: async () => ({ id: 'hold-during-claim' }) },
      gradingTombstone: {
        findUnique: async () => ({ resourceKey: 'run:held-claim', resourceType: 'GradingRun', resourceId: 'held-claim', status: 'PENDING', deletionClaimToken: null, deletionLeaseExpiresAt: null }),
        updateMany: async () => { claimUpdates += 1; return { count: 1 }; },
      },
    };
    await expect(claimGradingTombstone({ db, resourceKey: 'run:held-claim', claimToken: 'owner-held', holdScopes: [['run', 'held-claim']], now })).resolves.toBe(false);
    expect(claimUpdates).toBe(0);
  });

  it.each([
    ['answer', 'answer-quarantine-hold'],
    ['assignment', 'assignment-quarantine-hold'],
    ['class', 'class-quarantine-hold'],
  ])('rechecks the complete quarantine lineage before deleting when a %s hold exists', async (scopeType, scopeId) => {
    const asset: any = {
      id: 'asset-quarantine-lineage-hold', answerId: 'answer-quarantine-hold', attemptId: 'attempt-quarantine-hold', objectKey: `quarantine/${scopeType}-hold`, checksum: 'sha256:quarantine-hold', state: 'QUARANTINED',
      createdAt: new Date(now.getTime() - 86_400_000), quarantineExpiresAt: new Date(now.getTime() - 1), retentionExpiresAt: new Date(now.getTime() - 1), retentionPolicyId: 'source-policy-v1', retentionPolicyVersion: 'v1', retentionDeleteStrategy: 'delete-content', retentionSeconds: 60, governedRecordRule: null, deletionClaimToken: null, deletionLeaseExpiresAt: null,
      answer: { id: 'answer-quarantine-hold', question: { assignmentRevisionId: 'revision-quarantine-hold' }, submission: { assignmentRevisionId: 'revision-quarantine-hold', frozenAudienceClassId: 'class-quarantine-hold', revision: { id: 'revision-quarantine-hold', assignmentId: 'assignment-quarantine-hold' } } },
      attempt: { id: 'attempt-quarantine-hold', answerId: 'answer-quarantine-hold' },
    };
    const holdQueries: any[] = [];
    let deleteCalls = 0;
    const db: any = {
      submissionAsset: {
        findMany: async () => [asset],
        findUnique: async () => asset,
        updateMany: async ({ data }: any) => { Object.assign(asset, data); return { count: 1 }; },
      },
      submissionObjectTombstone: { findUnique: async () => null, upsert: async () => undefined },
      gradingLegalHold: { findFirst: async ({ where }: any) => { holdQueries.push(where); return where.OR.some((scope: any) => scope.scopeType === scopeType && scope.scopeId === scopeId) ? { id: 'hold-quarantine-lineage' } : null; } },
      gradingAuditEvent: { create: async () => undefined },
      $transaction: async (callback: (tx: any) => Promise<unknown>) => callback(db),
    };
    const store = new MemorySubmissionObjectStore();
    store.put({ key: asset.objectKey, ownerId: 'student-quarantine-hold', answerId: asset.answerId, sizeBytes: 1, mimeType: 'application/pdf', checksum: asset.checksum, scanState: 'CLEAN' });
    store.delete = async () => { deleteCalls += 1; };

    await expect(garbageCollectQuarantine(db, store, now)).resolves.toEqual({ claimed: 0, deleted: 0, failed: 0 });
    expect(deleteCalls).toBe(0);
    expect(holdQueries[0].OR).toEqual(expect.arrayContaining([
      { scopeType: 'asset', scopeId: asset.id },
      { scopeType: 'attempt', scopeId: asset.attemptId },
      { scopeType: 'answer', scopeId: asset.answerId },
      { scopeType: 'assignment-revision', scopeId: 'revision-quarantine-hold' },
      { scopeType: 'assignment', scopeId: 'assignment-quarantine-hold' },
      { scopeType: 'class', scopeId: 'class-quarantine-hold' },
    ]));
  });

  it('executes pseudonymize-lineage and preserves only the frozen lineage tombstone', async () => {
    const conversion: any = {
      id: 'conversion-pseudonymize-1',
      renderedObjectKey: 'grading-rendered/pseudonymize-1',
      assetId: 'asset-pseudonymize-1',
      attemptId: 'attempt-pseudonymize-1',
      lifecyclePolicyId: 'conversion-policy-v1',
      lifecyclePolicyVersion: 'v1',
      lifecycleDeleteStrategy: 'pseudonymize-lineage',
      lifecycleRetentionSeconds: 60,
      lifecycleGovernedRecordRule: null,
      lifecycleProviderRetentionSeconds: 0,
      retentionExpiresAt: new Date(now.getTime() - 1),
      asset: { objectKey: 'quarantine/source-pseudonymize-1', checksum: 'sha256:source' },
    };
    const tombstones: any[] = [];
    const auditEvents: any[] = [];
    const store = new MemorySubmissionObjectStore();
    store.put({ key: conversion.renderedObjectKey, ownerId: 'worker', answerId: 'answer-pseudonymize-1', sizeBytes: 1, mimeType: 'application/json', checksum: 'sha256:rendered', scanState: 'CLEAN' });
    const db: any = {
      answerEvidence: { findMany: async () => [] },
      documentConversion: { findMany: async () => [conversion], update: async ({ data }: any) => Object.assign(conversion, data) },
      gradingRun: { findMany: async () => [] },
      gradingJob: { updateMany: async () => ({ count: 1 }) },
      gradingTombstone: {
        findUnique: async ({ where }: any) => tombstones.find((row) => row.resourceKey === where.resourceKey) ?? null,
        create: async ({ data }: any) => { tombstones.push(data); return data; },
        updateMany: async ({ where, data }: any) => {
          const row = tombstones.find((candidate) => candidate.resourceKey === where.resourceKey);
          if (!row || (where.status?.in && !where.status.in.includes(row.status)) || (where.deletionClaimToken !== undefined && row.deletionClaimToken !== where.deletionClaimToken)) return { count: 0 };
          Object.assign(row, data);
          return { count: 1 };
        },
        update: async ({ where, data }: any) => { const row = tombstones.find((candidate) => candidate.resourceKey === where.resourceKey); Object.assign(row, data); return row; },
      },
      gradingLegalHold: { findFirst: async () => null },
      gradingAuditEvent: { create: async ({ data }: any) => { auditEvents.push(data); return data; } },
      $transaction: async (callback: (tx: any) => Promise<unknown>) => callback(db),
    };

    await runGradingRetentionGc({ db, store, policies: [lifecycleRow('document-conversion', { id: 'conversion-policy-v1', version: 'v1' })], now });

    expect(conversion).toEqual(expect.objectContaining({ state: 'DELETED', canonicalMarkdown: null, renderedObjectKey: null }));
    expect(tombstones[0]).toEqual(expect.objectContaining({
      lifecyclePolicyId: 'conversion-policy-v1',
      lifecyclePolicyVersion: 'v1',
      lifecycleDeleteStrategy: 'pseudonymize-lineage',
      status: 'DELETED',
      pseudonymizedAt: now,
      contentDeletedAt: now,
    }));
    expect(auditEvents.every((event) => event.resourceId !== conversion.id)).toBe(true);
  });

  it('erases an expired text snapshot using its bound policy instead of implicit permanence', async () => {
    const snapshot: any = {
      id: 'attempt-text-expiry-1',
      answerId: 'answer-text-expiry-1',
      textSnapshot: 'private text snapshot',
      textSnapshotPolicyId: 'answer-policy-v1',
      textSnapshotPolicyVersion: 'v1',
      textSnapshotDeleteStrategy: 'delete-content',
      textSnapshotRetentionSeconds: 60,
      textSnapshotGovernedRecordRule: null,
      textSnapshotProviderRetentionSeconds: 0,
      textSnapshotExpiresAt: new Date(now.getTime() - 1),
    };
    const tombstones: any[] = [];
    const db: any = {
      answerEvidence: { findMany: async () => [] },
      documentConversion: { findMany: async () => [] },
      gradingRun: { findMany: async () => [] },
      submissionAttempt: {
        findMany: async () => [snapshot],
        update: async ({ data }: any) => Object.assign(snapshot, data),
      },
      gradingTombstone: {
        findUnique: async ({ where }: any) => tombstones.find((row) => row.resourceKey === where.resourceKey) ?? null,
        create: async ({ data }: any) => {
          const row = { deletionClaimToken: null, deletionLeaseExpiresAt: null, ...data };
          tombstones.push(row);
          return row;
        },
        updateMany: async ({ where, data }: any) => {
          const row = tombstones.find((candidate) => candidate.resourceKey === where.resourceKey);
          if (!row || !matchesTombstoneCas(row, where)) return { count: 0 };
          Object.assign(row, data);
          return { count: 1 };
        },
        update: async ({ where, data }: any) => { const row = tombstones.find((candidate) => candidate.resourceKey === where.resourceKey); Object.assign(row, data); return row; },
      },
      gradingLegalHold: { findFirst: async () => null },
      gradingAuditEvent: { create: async () => undefined },
      $transaction: async (callback: (tx: any) => Promise<unknown>) => callback(db),
    };

    await runGradingRetentionGc({ db, store: new MemorySubmissionObjectStore(), policies: [lifecycleRow('document-conversion')], now });

    expect(snapshot.textSnapshot).toBeNull();
    expect(tombstones[0]).toEqual(expect.objectContaining({
      resourceType: 'SubmissionAttempt',
      lifecyclePolicyId: 'answer-policy-v1',
      lifecycleDeleteStrategy: 'delete-content',
      status: 'DELETED',
      contentDeletedAt: now,
    }));
  });

  it('rechecks the locked asset state inside the enqueue transaction', async () => {
    const finalizedAsset: any = {
      id: 'asset-toctou-1',
      answerId: 'answer-toctou-1',
      attemptId: 'attempt-toctou-1',
      state: 'FINALIZED',
      scanState: 'CLEAN',
      checksum: 'sha256:asset-toctou',
      answer: { submission: { frozenAudienceClassId: 'class-toctou-1', frozenStudentId: 'student-toctou-1', audience: { classId: 'class-toctou-1', class: { teacherId: 'teacher-toctou-1' } } }, question: { assignmentRevisionId: 'revision-toctou-1' } },
      attempt: { id: 'attempt-toctou-1', answerId: 'answer-toctou-1' },
    };
    let reads = 0;
    const db: any = {
      gradingLifecyclePolicy: { findMany: async () => [lifecycleRow('answer-evidence'), lifecycleRow('document-conversion')] },
      submissionAsset: { findUnique: async () => reads++ === 0 ? finalizedAsset : { ...finalizedAsset, state: 'DELETING' } },
      documentConversion: { findUnique: async () => null },
    };

    await expect(enqueueDocumentConversion({
      db,
      assetId: finalizedAsset.id,
      attemptId: finalizedAsset.attemptId,
      actor: { id: 'grading-worker', role: 'SERVICE' },
      adapterVersion: 'adapter-v1',
      idempotencyKey: 'toctou-enqueue-001',
      now,
    })).rejects.toThrow('conversion-source-not-finalized-clean');
    expect(reads).toBe(2);
  });

  it('renews a running job lease and fences a stale worker token', async () => {
    const updates: any[] = [];
    const db: any = {
      gradingJob: {
        updateMany: async ({ where, data }: any) => {
          updates.push({ where, data });
          return { count: where.workerClaimToken === 'current-token' ? 1 : 0 };
        },
      },
    };
    await expect(renewGradingJobLease({ db, jobId: 'job-lease-1', workerClaimToken: 'current-token', now })).resolves.toBe(true);
    await expect(renewGradingJobLease({ db, jobId: 'job-lease-1', workerClaimToken: 'stale-token', now })).resolves.toBe(false);
    expect(updates[0].data.workerLeaseExpiresAt).toEqual(new Date(now.getTime() + 5 * 60_000));

    vi.useFakeTimers();
    const heartbeat = startGradingJobLeaseHeartbeat({ db, jobId: 'job-lease-1', workerClaimToken: 'current-token', intervalMs: 1_000, now: () => now });
    await vi.advanceTimersByTimeAsync(1_000);
    heartbeat.stop();
    vi.useRealTimers();
    expect(updates.length).toBeGreaterThanOrEqual(3);
  });

  it('does not move a lease backwards after a slow call or after the current lease has expired', async () => {
    const claimedAt = new Date(now.getTime() + 120_000);
    const existingExpiry = new Date(now.getTime() + 600_000);
    const updates: any[] = [];
    const jobDb: any = {
      gradingJob: {
        findUnique: async () => ({ state: 'RUNNING', workerClaimToken: 'slow-owner', workerClaimedAt: claimedAt, workerLeaseExpiresAt: existingExpiry }),
        updateMany: async ({ where, data }: any) => { updates.push({ where, data }); return { count: 1 }; },
      },
    };
    await expect(renewGradingJobLease({ db: jobDb, jobId: 'job-slow-renew', workerClaimToken: 'slow-owner', now })).resolves.toBe(true);
    expect(updates[0].where).toEqual(expect.objectContaining({ state: { in: ['RUNNING'] }, workerClaimToken: 'slow-owner', OR: expect.any(Array) }));
    expect(updates[0].data.workerClaimedAt.getTime()).toBeGreaterThanOrEqual(claimedAt.getTime());
    expect(updates[0].data.workerLeaseExpiresAt.getTime()).toBeGreaterThanOrEqual(existingExpiry.getTime());
    await expect(renewGradingJobLease({ db: jobDb, jobId: 'job-slow-renew', workerClaimToken: 'slow-owner', now: new Date(existingExpiry.getTime() + 1) })).resolves.toBe(false);

    const tombstone: any = { resourceKey: 'run:slow-tombstone', status: 'PENDING', deletionClaimToken: 'slow-owner', deletionClaimedAt: claimedAt, deletionLeaseExpiresAt: existingExpiry };
    const tombstoneDb: any = {
      gradingTombstone: {
        findUnique: async () => tombstone,
        updateMany: async ({ where, data }: any) => { Object.assign(tombstone, data); expect(where.deletionClaimToken).toBe('slow-owner'); return { count: 1 }; },
      },
      gradingLegalHold: { findFirst: async () => null },
    };
    await expect(renewGradingTombstoneLease({ db: tombstoneDb, resourceKey: tombstone.resourceKey, claimToken: 'slow-owner', now })).resolves.toBe(true);
    expect(tombstone.deletionClaimedAt.getTime()).toBeGreaterThanOrEqual(claimedAt.getTime());
    expect(tombstone.deletionLeaseExpiresAt.getTime()).toBeGreaterThanOrEqual(existingExpiry.getTime());
  });

  it('rejects retry for terminal items and clears an old worker claim before retrying a failed item', async () => {
    const batch = { id: 'batch-hardening-1', assignmentRevisionId: 'revision-hardening-1', classId: 'class-hardening-1', class: { teacherId: 'teacher-hardening-1' }, evaluatorVersion: 'model-v1', questionSnapshotHash: 'sha256:question' };
    const item: any = { id: 'item-hardening-1', batchId: batch.id, attemptId: 'attempt-hardening-1', state: 'SUCCEEDED', retryCount: 0, workerClaimToken: 'old-token', workerClaimedAt: now };
    const db: any = {
      gradingBatch: { findUnique: async () => batch },
      gradingBatchItem: {
        findUnique: async () => item,
        update: async ({ data }: any) => { Object.assign(item, data); return item; },
      },
      gradingAuditEvent: { create: async () => undefined },
    };
    await expect(retryQuestionGradingBatchItem({ db, batchId: batch.id, itemId: item.id, actor: { id: 'teacher-hardening-1', role: 'TEACHER' }, idempotencyKey: 'retry-hardening-001', reason: 'retry provider failure', now })).rejects.toThrow('batch-item-not-retryable');

    item.state = 'FAILED';
    const jobs: any[] = [];
    db.gradingJob = { findUnique: async () => null, create: async ({ data }: any) => { jobs.push(data); return data; } };
    db.gradingRerun = { create: async () => undefined };
    await retryQuestionGradingBatchItem({ db, batchId: batch.id, itemId: item.id, actor: { id: 'teacher-hardening-1', role: 'TEACHER' }, idempotencyKey: 'retry-hardening-002', reason: 'retry provider failure', now });
    expect(item).toEqual(expect.objectContaining({ state: 'QUEUED', workerClaimToken: null, workerClaimedAt: null }));
    expect(jobs).toHaveLength(1);
  });

  it('does not let two source GC workers both claim the same DELETING asset', async () => {
    const store = new MemorySubmissionObjectStore();
    store.put({ key: 'quarantine/concurrent-source', ownerId: 'student-hardening-1', answerId: 'answer-hardening-1', sizeBytes: 1, mimeType: 'text/plain', checksum: 'sha256:source', scanState: 'CLEAN' });
    const asset: any = { id: 'asset-concurrent-source', objectKey: 'quarantine/concurrent-source', checksum: 'sha256:source', state: 'FINALIZED', retentionExpiresAt: new Date(now.getTime() - 1), retentionPolicyId: 'source-policy-v1', retentionPolicyVersion: 'source-v1', retentionDeleteStrategy: 'delete-content', retentionSeconds: 60, governedRecordRule: null, answer: { submission: { assignmentRevisionId: 'revision-hardening-1', frozenAudienceClassId: 'class-hardening-1' } }, documentConversions: [], answerEvidence: [] };
    let deleteCalls = 0;
    const tombstone: any = { objectKey: asset.objectKey, status: 'PENDING' };
    const db: any = {
      gradingLifecyclePolicy: { findMany: async () => [lifecycleRow('source-asset', { id: 'source-policy-v1', version: 'source-v1' })] },
      submissionAsset: {
        findMany: async () => asset.state === 'DELETED' ? [] : [asset],
        updateMany: async ({ where, data }: any) => {
          const eligible = asset.id === where.id && (where.state?.in?.includes(asset.state) || where.state === asset.state);
          if (!eligible || (asset.state === 'DELETING' && where.state?.in?.includes('DELETING') && asset.deletionClaimToken)) return { count: 0 };
          Object.assign(asset, data);
          return { count: 1 };
        },
      },
      documentConversion: { findMany: async () => [] },
      answerEvidence: { findMany: async () => [] },
      gradingRun: { findMany: async () => [] },
      gradingLegalHold: { findFirst: async () => null },
      submissionObjectTombstone: {
        findUnique: async () => tombstone.status === 'DELETED' ? tombstone : null,
        upsert: async ({ create, update }: any) => Object.assign(tombstone, tombstone.status === 'PENDING' ? create : update),
        update: async ({ data }: any) => Object.assign(tombstone, data),
      },
      gradingAuditEvent: { create: async () => undefined },
      $transaction: async (callback: (tx: any) => Promise<unknown>) => callback(db),
    };
    store.delete = async (key: string) => { deleteCalls += 1; await MemorySubmissionObjectStore.prototype.delete.call(store, key); };

    await Promise.all([
      garbageCollectSourceAssets(db, store, now),
      garbageCollectSourceAssets(db, store, now),
    ]);

    expect(deleteCalls).toBe(1);
    expect(asset.state).toBe('DELETED');
  });

  it('keeps a governed source asset retained instead of marking it DELETED', async () => {
    const asset: any = {
      id: 'asset-retained-governed',
      objectKey: 'quarantine/retained-governed',
      checksum: 'sha256:retained-governed',
      state: 'FINALIZED',
      retentionExpiresAt: null,
      retentionPolicyId: 'source-policy-governed',
      retentionPolicyVersion: 'v1',
      retentionDeleteStrategy: 'retain-governed-record',
      retentionSeconds: null,
      governedRecordRule: 'legal-evidence',
      deletionClaimToken: null,
      deletionClaimedAt: null,
      deletionLeaseExpiresAt: null,
      answer: { id: 'answer-retained-governed', submission: { assignmentRevisionId: 'revision-retained-governed', frozenAudienceClassId: 'class-retained-governed' } },
      documentConversions: [],
      answerEvidence: [],
    };
    const tombstone: any = { objectKey: asset.objectKey, status: 'PENDING' };
    const store = new MemorySubmissionObjectStore();
    store.put({ key: asset.objectKey, ownerId: 'student-retained-governed', answerId: asset.answer.id, sizeBytes: 1, mimeType: 'application/pdf', checksum: asset.checksum, scanState: 'CLEAN' });
    const db: any = {
      gradingLifecyclePolicy: { findMany: async () => [lifecycleRow('source-asset', { id: 'source-policy-governed', version: 'v1', retentionSeconds: null, governedRecordRule: 'legal-evidence', deleteStrategy: 'retain-governed-record' })] },
      submissionAsset: {
        findMany: async () => [asset],
        findUnique: async () => asset,
        updateMany: async ({ where, data }: any) => {
          if (where.id !== asset.id || (where.state?.in && !where.state.in.includes(asset.state)) || (where.deletionClaimToken && where.deletionClaimToken !== asset.deletionClaimToken)) return { count: 0 };
          Object.assign(asset, data);
          return { count: 1 };
        },
      },
      documentConversion: { findMany: async () => [] },
      answerEvidence: { findMany: async () => [] },
      gradingRun: { findMany: async () => [] },
      gradingLegalHold: { findFirst: async () => null },
      submissionObjectTombstone: {
        findUnique: async () => tombstone.status === 'PENDING' ? tombstone : null,
        upsert: async ({ create, update }: any) => { Object.assign(tombstone, tombstone.status === 'PENDING' ? create : update); return tombstone; },
        update: async ({ data }: any) => { Object.assign(tombstone, data); return tombstone; },
      },
      gradingAuditEvent: { create: async () => undefined },
      $transaction: async (callback: (tx: any) => Promise<unknown>) => callback(db),
    };

    await expect(garbageCollectSourceAssets(db, store, now)).resolves.toEqual({ scanned: 1, deleted: 0, held: 0, blocked: 0, retained: 1 });
    expect(asset.state).toBe('FINALIZED');
    expect(tombstone).toEqual(expect.objectContaining({ status: 'RETAINED', physicalDeletedAt: null, deletedAt: null }));
    await expect(store.head(asset.objectKey)).resolves.toEqual(expect.objectContaining({ key: asset.objectKey }));
    await expect(garbageCollectSourceAssets(db, store, now)).resolves.toEqual({ scanned: 1, deleted: 0, held: 0, blocked: 0, retained: 1 });
    expect(tombstone.status).toBe('RETAINED');
    await expect(store.head(asset.objectKey)).resolves.toEqual(expect.objectContaining({ key: asset.objectKey }));
  });

  it('reuses a submission tombstone whose lookup was backfilled after phase-four redaction', async () => {
    const rawObjectKey = 'quarantine:phase-four-lookup-compat';
    const md5 = (value: string) => createHash('md5').update(value).digest('hex');
    const phaseFourObjectKey = `redacted:submission-object:${md5(rawObjectKey)}`;
    const staleMigrationLookupKey = `redacted:submission-lookup:${md5(phaseFourObjectKey)}`;
    const asset: any = {
      id: 'asset-phase-four-lookup-compat',
      objectKey: rawObjectKey,
      checksum: 'sha256:phase-four-lookup-compat',
      state: 'FINALIZED',
      retentionExpiresAt: new Date(now.getTime() - 1),
      retentionPolicyId: 'source-policy-v1',
      retentionPolicyVersion: 'v1',
      retentionDeleteStrategy: 'delete-content',
      retentionSeconds: 60,
      governedRecordRule: null,
      deletionClaimToken: null,
      deletionClaimedAt: null,
      deletionLeaseExpiresAt: null,
      answer: { submission: { assignmentRevisionId: 'revision-phase-four-lookup-compat', frozenAudienceClassId: 'class-phase-four-lookup-compat' } },
      documentConversions: [],
      answerEvidence: [],
    };
    const tombstone: any = {
      objectKey: phaseFourObjectKey,
      lookupKey: staleMigrationLookupKey,
      status: 'DELETED',
      physicalDeletedAt: now,
    };
    let upsertCalls = 0;
    let deleteCalls = 0;
    const db: any = {
      submissionAsset: {
        findMany: async () => [asset],
        findUnique: async () => asset,
        updateMany: async ({ data }: any) => { Object.assign(asset, data); return { count: 1 }; },
      },
      submissionObjectTombstone: {
        findUnique: async ({ where }: any) => {
          if (where.objectKey) return where.objectKey === tombstone.objectKey ? tombstone : null;
          return where.lookupKey === tombstone.lookupKey ? tombstone : null;
        },
        upsert: async () => { upsertCalls += 1; throw new Error('duplicate-submission-tombstone'); },
      },
      $transaction: async (callback: (tx: any) => Promise<unknown>) => callback(db),
    };
    const store = new MemorySubmissionObjectStore();
    store.delete = async () => { deleteCalls += 1; };

    await expect(garbageCollectSourceAssets(db, store, now)).resolves.toEqual({ scanned: 1, deleted: 1, held: 0, blocked: 0, retained: 0 });
    expect(upsertCalls).toBe(0);
    expect(deleteCalls).toBe(0);
    expect(asset.state).toBe('DELETED');
  });

  it('interprets a source asset with frozen v1 retention fields even when the current policy is v2', async () => {
    const asset: any = {
      id: 'asset-frozen-v1', answerId: 'answer-frozen-v1', attemptId: 'attempt-frozen-v1', objectKey: 'quarantine/frozen-v1', checksum: 'sha256:frozen-v1', state: 'FINALIZED',
      retentionPolicyId: 'source-policy-v1', retentionPolicyVersion: 'v1', retentionDeleteStrategy: 'delete-content', retentionSeconds: 60, retentionExpiresAt: new Date(now.getTime() - 1), governedRecordRule: null, deletionClaimToken: null, deletionLeaseExpiresAt: null,
      answer: { id: 'answer-frozen-v1', submission: { assignmentRevisionId: 'revision-frozen-v1', frozenAudienceClassId: 'class-frozen-v1', revision: { id: 'revision-frozen-v1', assignmentId: 'assignment-frozen-v1' } } }, documentConversions: [], answerEvidence: [],
    };
    const tombstone: any = { objectKey: asset.objectKey, lookupKey: 'seed-submission-lookup', status: 'PENDING', deletionClaimToken: null };
    let currentPolicyReads = 0;
    const db: any = {
      gradingLifecyclePolicy: { findMany: async () => { currentPolicyReads += 1; return [{ id: 'source-policy-v2', version: 'v2', deleteStrategy: 'retain-governed-record' }]; } },
      submissionAsset: { findMany: async () => [asset], findUnique: async () => asset, updateMany: async ({ data }: any) => { Object.assign(asset, data); return { count: 1 }; } },
      documentConversion: { findMany: async () => [] }, answerEvidence: { findMany: async () => [] }, gradingRun: { findMany: async () => [] }, gradingLegalHold: { findFirst: async () => null },
      submissionObjectTombstone: {
        findUnique: async () => tombstone.status === 'DELETED' ? tombstone : null,
        upsert: async ({ create, update }: any) => { Object.assign(tombstone, tombstone.status === 'PENDING' ? create : update); return tombstone; },
        updateMany: async ({ data }: any) => { Object.assign(tombstone, data); return { count: 1 }; },
      },
      gradingAuditEvent: { create: async () => undefined },
      $transaction: async (callback: (tx: any) => Promise<unknown>) => callback(db),
    };
    const store = new MemorySubmissionObjectStore();
    store.put({ key: asset.objectKey, ownerId: 'student-frozen-v1', answerId: asset.answerId, sizeBytes: 1, mimeType: 'application/pdf', checksum: asset.checksum, scanState: 'CLEAN' });

    await expect(garbageCollectSourceAssets(db, store, now)).resolves.toEqual({ scanned: 1, deleted: 1, held: 0, blocked: 0, retained: 0 });
    expect(currentPolicyReads).toBe(0);
    expect(asset.state).toBe('DELETED');
    expect(tombstone.objectKey).not.toBe(asset.objectKey);
    expect(tombstone.checksum).toBeNull();
    expect(await store.head(asset.objectKey)).toBeNull();
  });

  it('blocks a finite-expiry source asset when any frozen retention field is missing', async () => {
    const asset: any = { id: 'asset-finite-metadata-missing', objectKey: 'quarantine/finite-metadata-missing', checksum: 'sha256:finite-metadata-missing', state: 'FINALIZED', retentionExpiresAt: new Date(now.getTime() - 1), retentionPolicyId: null, retentionPolicyVersion: 'v1', retentionDeleteStrategy: null, retentionSeconds: 60, governedRecordRule: null };
    const tombstone: any = { objectKey: asset.objectKey, status: 'PENDING' };
    const audits: any[] = [];
    const db: any = {
      submissionAsset: { findMany: async () => [asset], updateMany: async ({ data }: any) => { Object.assign(asset, data); return { count: 1 }; } },
      submissionObjectTombstone: { upsert: async ({ create }: any) => { Object.assign(tombstone, create); return tombstone; } },
      gradingAuditEvent: { create: async ({ data }: any) => { audits.push(data); return data; } },
    };
    const store = new MemorySubmissionObjectStore();
    store.put({ key: asset.objectKey, ownerId: 'student-finite-metadata-missing', answerId: 'answer-finite-metadata-missing', sizeBytes: 1, mimeType: 'application/pdf', checksum: asset.checksum, scanState: 'CLEAN' });

    await expect(garbageCollectSourceAssets(db, store, now)).resolves.toEqual(expect.objectContaining({ scanned: 1, blocked: 1, deleted: 0 }));
    expect(tombstone.status).toBe('BLOCKED');
    expect(asset).toEqual(expect.objectContaining({ lifecycleBlockedAt: expect.any(Date), lifecycleBlockReason: expect.stringContaining('frozen-retention-field-missing') }));
    expect(audits).toEqual(expect.arrayContaining([expect.objectContaining({ action: 'source-asset.lifecycle-metadata-blocked' })]));
    expect(await store.head(asset.objectKey)).not.toBeNull();
  });

  it('deletes an abandoned quarantined upload by quarantine expiry despite future source retention', async () => {
    const asset: any = {
      id: 'asset-abandoned-quarantine',
      objectKey: 'quarantine/abandoned-upload',
      checksum: 'sha256:abandoned-upload',
      state: 'QUARANTINED',
      createdAt: new Date(now.getTime() - 86_400_000),
      quarantineExpiresAt: new Date(now.getTime() - 1),
      retentionPolicyId: 'source-policy-future',
      retentionPolicyVersion: 'v2',
      retentionDeleteStrategy: 'delete-content',
      retentionSeconds: 86_400,
      retentionExpiresAt: new Date(now.getTime() + 86_400_000),
      governedRecordRule: null,
      deletionClaimToken: null,
      deletionClaimedAt: null,
      deletionLeaseExpiresAt: null,
    };
    const tombstone: any = { objectKey: asset.objectKey, lookupKey: 'seed-submission-lookup', status: 'PENDING', deletionClaimToken: null };
    const store = new MemorySubmissionObjectStore();
    store.put({ key: asset.objectKey, ownerId: 'student-abandoned-quarantine', answerId: 'answer-abandoned-quarantine', sizeBytes: 1, mimeType: 'application/pdf', checksum: asset.checksum, scanState: 'PENDING' });
    const db: any = {
      submissionAsset: {
        findMany: async () => asset.state === 'DELETED' ? [] : [asset],
        findUnique: async () => asset,
        updateMany: async ({ where, data }: any) => {
          if (where.id && where.id !== asset.id) return { count: 0 };
          if (where.deletionClaimToken !== undefined && where.deletionClaimToken !== asset.deletionClaimToken) return { count: 0 };
          Object.assign(asset, data);
          return { count: 1 };
        },
      },
      submissionObjectTombstone: {
        findUnique: async () => tombstone,
        upsert: async ({ create, update }: any) => { Object.assign(tombstone, tombstone.objectKey ? update : create); return tombstone; },
        updateMany: async ({ where, data }: any) => {
          if (where.objectKey && where.objectKey !== tombstone.objectKey) return { count: 0 };
          if (where.deletionClaimToken !== undefined && where.deletionClaimToken !== tombstone.deletionClaimToken) return { count: 0 };
          Object.assign(tombstone, data);
          return { count: 1 };
        },
        update: async ({ data }: any) => { Object.assign(tombstone, data); return tombstone; },
      },
      gradingAuditEvent: { create: async () => undefined },
      gradingLegalHold: { findFirst: async () => null },
      $transaction: async (callback: (tx: any) => Promise<unknown>) => callback(db),
    };

    await expect(garbageCollectQuarantine(db, store, new Date(now.getTime() - 86_400_000))).resolves.toEqual({ claimed: 1, deleted: 1, failed: 0 });
    expect(asset.state).toBe('DELETED');
    expect(tombstone).toEqual(expect.objectContaining({ status: 'DELETED', lifecycleDeleteStrategy: 'delete-content' }));
    expect(tombstone.lookupKey).toEqual(expect.any(String));
    expect(tombstone.objectKey).not.toBe(asset.objectKey);
    expect(tombstone.checksum).toBeNull();
    expect(await store.head(asset.objectKey)).toBeNull();
  });

  it('pseudonymizes source object and submission lineage fields after physical deletion', async () => {
    const databaseNow = new Date(now.getTime() + 4 * 60_000);
    const rawObjectKey = 'quarantine/pseudonymized-source';
    const rawFinalizationKey = 'finalize:pseudonymized-source';
    const asset: any = {
      id: 'asset-pseudonymized-source', answerId: 'answer-pseudonymized-source', attemptId: 'attempt-pseudonymized-source', objectKey: rawObjectKey, originalName: 'student-answer.docx', finalizationKey: rawFinalizationKey, checksum: 'sha256:pseudonymized-source', state: 'FINALIZED',
      retentionPolicyId: 'source-policy-v1', retentionPolicyVersion: 'v1', retentionDeleteStrategy: 'pseudonymize-lineage', retentionSeconds: 60, retentionExpiresAt: new Date(now.getTime() - 1), deletionClaimToken: null, deletionLeaseExpiresAt: null,
      answer: { id: 'answer-pseudonymized-source', submission: { assignmentRevisionId: 'revision-pseudonymized-source', frozenAudienceClassId: 'class-pseudonymized-source', revision: { id: 'revision-pseudonymized-source', assignmentId: 'assignment-pseudonymized-source' } } }, documentConversions: [], answerEvidence: [],
    };
    const tombstone: any = { objectKey: rawObjectKey, status: 'PENDING', deletionClaimToken: null };
    const accessTokenDeletes: any[] = [];
    const db: any = {
      submissionAsset: { findMany: async () => [asset], findUnique: async () => asset, updateMany: async ({ data }: any) => { Object.assign(asset, data); return { count: 1 }; } },
      submissionAssetAccessToken: { deleteMany: async (args: any) => { accessTokenDeletes.push(args); return { count: 1 }; } },
      documentConversion: { findMany: async () => [] }, answerEvidence: { findMany: async () => [] }, gradingRun: { findMany: async () => [] }, gradingLegalHold: { findFirst: async () => null },
      submissionObjectTombstone: {
        findUnique: async () => tombstone.status === 'DELETED' ? tombstone : null,
        upsert: async ({ create, update }: any) => { Object.assign(tombstone, tombstone.status === 'PENDING' ? create : update); return tombstone; },
        updateMany: async ({ data }: any) => { Object.assign(tombstone, data); return { count: 1 }; },
      },
      gradingAuditEvent: { create: async () => undefined },
      $queryRaw: async () => [{ now: databaseNow }],
      $transaction: async (callback: (tx: any) => Promise<unknown>) => callback(db),
    };
    const store = new MemorySubmissionObjectStore();
    store.put({ key: rawObjectKey, ownerId: 'student-pseudonymized-source', answerId: asset.answerId, sizeBytes: 1, mimeType: 'application/pdf', checksum: asset.checksum, scanState: 'CLEAN' });

    await expect(garbageCollectSourceAssets(db, store, now)).resolves.toEqual(expect.objectContaining({ deleted: 1, blocked: 0 }));
    expect(tombstone.objectKey).not.toBe(rawObjectKey);
    expect(tombstone.checksum).toBeNull();
    expect(tombstone.lineageReference).toBeTruthy();
    expect(asset.objectKey).not.toBe(rawObjectKey);
    expect(asset.answerId).toBeNull();
    expect(asset.attemptId).toBeNull();
    expect(asset.originalName).not.toBe('student-answer.docx');
    expect(asset.finalizationKey).toBeNull();
    expect(asset.checksum).toBeNull();
    expect(asset.tombstonedAt).toEqual(databaseNow);
    expect(tombstone.physicalDeletedAt).toEqual(databaseNow);
    expect(accessTokenDeletes).toEqual([{ where: { assetId: 'asset-pseudonymized-source' } }]);
  });

  it('claims quarantine deletion once, recovers a failed delete, and never regresses a deleted tombstone', async () => {
    const asset: any = { id: 'asset-quarantine-retry', objectKey: 'quarantine/retry', checksum: 'sha256:retry', state: 'QUARANTINED', createdAt: new Date(now.getTime() - 86_400_000), retentionExpiresAt: new Date(now.getTime() - 1), retentionPolicyId: 'source-policy-v1', retentionPolicyVersion: 'v1', retentionDeleteStrategy: 'delete-content', retentionSeconds: 60, governedRecordRule: null, deletionClaimToken: null, deletionLeaseExpiresAt: null };
    const tombstone: any = { objectKey: asset.objectKey, status: 'PENDING', deletionClaimToken: null };
    const store = new MemorySubmissionObjectStore();
    store.put({ key: asset.objectKey, ownerId: 'student-hardening-1', answerId: 'answer-hardening-1', sizeBytes: 1, mimeType: 'application/pdf', checksum: asset.checksum, scanState: 'CLEAN' });
    let failDelete = true;
    const db: any = {
      submissionAsset: {
        findMany: async () => asset.state === 'DELETED' ? [] : [asset],
        findUnique: async () => asset,
        updateMany: async ({ where, data }: any) => {
          const claimUpdate = where.deletionClaimToken === undefined;
          if (where.id !== asset.id || (where.state?.in && !where.state.in.includes(asset.state)) || (where.state && typeof where.state === 'string' && where.state !== asset.state)) return { count: 0 };
          if (claimUpdate && asset.state === 'DELETING' && asset.deletionClaimToken) return { count: 0 };
          if (where.deletionClaimToken && where.deletionClaimToken !== asset.deletionClaimToken) return { count: 0 };
          Object.assign(asset, data);
          return { count: 1 };
        },
      },
      submissionObjectTombstone: {
        findUnique: async () => tombstone.status === 'DELETED' ? tombstone : null,
        upsert: async ({ create, update }: any) => { Object.assign(tombstone, tombstone.status === 'PENDING' && !tombstone.deletionClaimToken ? create : update); return tombstone; },
        updateMany: async ({ where, data }: any) => {
          if (where.objectKey !== tombstone.objectKey || tombstone.status === 'DELETED' || where.deletionClaimToken !== tombstone.deletionClaimToken) return { count: 0 };
          Object.assign(tombstone, data);
          return { count: 1 };
        },
        update: async ({ data }: any) => { Object.assign(tombstone, data); return tombstone; },
      },
      gradingAuditEvent: { create: async () => undefined },
      $transaction: async (callback: (tx: any) => Promise<unknown>) => callback(db),
    };
    store.delete = async (key: string) => {
      if (failDelete) { failDelete = false; throw new Error('object-store-delete-failed'); }
      await MemorySubmissionObjectStore.prototype.delete.call(store, key);
    };

    await expect(garbageCollectQuarantine(db, store, now)).resolves.toEqual({ claimed: 1, deleted: 0, failed: 1 });
    expect(asset.state).toBe('DELETING');
    expect(tombstone.status).toBe('RETRYABLE');
    await expect(garbageCollectQuarantine(db, store, now)).resolves.toEqual({ claimed: 1, deleted: 1, failed: 0 });
    expect(asset.state).toBe('DELETED');
    expect(tombstone).toEqual(expect.objectContaining({ status: 'DELETED', deletionClaimToken: null }));
  });

  it('does not let quarantine GC take over a source-retention deletion lease', async () => {
    const asset: any = {
      id: 'asset-source-retention-deleting',
      objectKey: 'final/source-retention-deleting',
      checksum: 'sha256:source-retention-deleting',
      state: 'DELETING',
      createdAt: new Date(now.getTime() - 86_400_000),
      quarantineExpiresAt: null,
      deletionClaimToken: null,
      deletionLeaseExpiresAt: new Date(now.getTime() - 1),
    };
    const tombstone: any = {
      objectKey: asset.objectKey,
      status: 'RETRYABLE',
      lifecyclePolicyId: 'source-policy-v1',
      lifecyclePolicyVersion: 'v1',
      deletionClaimToken: null,
    };
    let deleteCalls = 0;
    let claimCalls = 0;
    const db: any = {
      submissionAsset: {
        findMany: async () => [asset],
        findUnique: async () => asset,
        updateMany: async () => { claimCalls += 1; return { count: 1 }; },
      },
      submissionObjectTombstone: { findUnique: async () => tombstone },
      $transaction: async (callback: (tx: any) => Promise<unknown>) => callback(db),
    };
    const store = new MemorySubmissionObjectStore();
    store.delete = async () => { deleteCalls += 1; };

    await expect(garbageCollectQuarantine(db, store, now)).resolves.toEqual({ claimed: 0, deleted: 0, failed: 0 });
    expect(claimCalls).toBe(0);
    expect(deleteCalls).toBe(0);
    expect(tombstone).toMatchObject({ status: 'RETRYABLE', lifecyclePolicyId: 'source-policy-v1' });
  });

  it('fences two concurrent quarantine GC claims before either can delete twice', async () => {
    const asset: any = { id: 'asset-quarantine-concurrent', objectKey: 'quarantine/concurrent', checksum: 'sha256:concurrent', state: 'DELETING', createdAt: new Date(now.getTime() - 86_400_000), retentionExpiresAt: new Date(now.getTime() - 1), retentionPolicyId: 'source-policy-v1', retentionPolicyVersion: 'v1', retentionDeleteStrategy: 'delete-content', retentionSeconds: 60, governedRecordRule: null, deletionClaimToken: null, deletionLeaseExpiresAt: null };
    const tombstone: any = { objectKey: asset.objectKey, status: 'PENDING', deletionClaimToken: null };
    const store = new MemorySubmissionObjectStore();
    store.put({ key: asset.objectKey, ownerId: 'student-hardening-1', answerId: 'answer-hardening-1', sizeBytes: 1, mimeType: 'application/pdf', checksum: asset.checksum, scanState: 'CLEAN' });
    let deleteCalls = 0;
    const db: any = {
      submissionAsset: {
        findMany: async () => [asset],
        findUnique: async () => ({ ...asset }),
        updateMany: async ({ where, data }: any) => {
          if (where.deletionClaimToken === undefined && asset.deletionClaimToken) return { count: 0 };
          if (where.deletionClaimToken && where.deletionClaimToken !== asset.deletionClaimToken) return { count: 0 };
          Object.assign(asset, data);
          return { count: 1 };
        },
      },
      submissionObjectTombstone: {
        findUnique: async () => null,
        upsert: async ({ create }: any) => { if (tombstone.deletionClaimToken) throw new Error('tombstone-claim-race'); Object.assign(tombstone, create); return tombstone; },
        updateMany: async ({ where, data }: any) => { if (where.deletionClaimToken !== tombstone.deletionClaimToken || tombstone.status === 'DELETED') return { count: 0 }; Object.assign(tombstone, data); return { count: 1 }; },
      },
      gradingAuditEvent: { create: async () => undefined },
      $transaction: async (callback: (tx: any) => Promise<unknown>) => callback(db),
    };
    store.delete = async (key: string) => { deleteCalls += 1; await MemorySubmissionObjectStore.prototype.delete.call(store, key); };

    await Promise.all([garbageCollectQuarantine(db, store, now), garbageCollectQuarantine(db, store, now)]);
    expect(deleteCalls).toBe(1);
    expect(asset.state).toBe('DELETED');
  });

  it('stops source physical deletion immediately when the heartbeat CAS loses ownership', async () => {
    const asset: any = {
      id: 'asset-stale-source',
      objectKey: 'quarantine/stale-source',
      checksum: 'sha256:stale-source',
      state: 'FINALIZED',
      retentionExpiresAt: new Date(now.getTime() - 1),
      retentionPolicyId: 'source-policy-v1',
      retentionPolicyVersion: 'v1',
      retentionDeleteStrategy: 'delete-content',
      retentionSeconds: 60,
      answer: { submission: { assignmentRevisionId: 'revision-stale-source', frozenAudienceClassId: 'class-stale-source' } },
      documentConversions: [],
      answerEvidence: [],
    };
    const tombstone: any = { objectKey: asset.objectKey, status: 'PENDING', deletionClaimToken: null };
    let deleteCalls = 0;
    const db: any = {
      gradingLifecyclePolicy: { findMany: async () => [lifecycleRow('source-asset', { id: 'source-policy-v1', version: 'v1' })] },
      submissionAsset: {
        findMany: async () => [asset],
        findUnique: async () => asset,
        updateMany: async ({ data }: any) => {
          if (data.deletionClaimedAt && !data.state) return { count: 0 };
          Object.assign(asset, data);
          return { count: 1 };
        },
      },
      documentConversion: { findMany: async () => [] },
      answerEvidence: { findMany: async () => [] },
      gradingRun: { findMany: async () => [] },
      gradingLegalHold: { findFirst: async () => null },
      submissionObjectTombstone: {
        findUnique: async () => tombstone.status === 'DELETED' ? tombstone : null,
        upsert: async ({ create }: any) => { Object.assign(tombstone, create); return tombstone; },
        updateMany: async ({ data }: any) => { Object.assign(tombstone, data); return { count: 1 }; },
      },
      gradingAuditEvent: { create: async () => undefined },
      $transaction: async (callback: (tx: any) => Promise<unknown>) => callback(db),
    };
    const store = new MemorySubmissionObjectStore();
    store.put({ key: asset.objectKey, ownerId: 'student-stale-source', answerId: 'answer-stale-source', sizeBytes: 1, mimeType: 'application/pdf', checksum: asset.checksum, scanState: 'CLEAN' });
    store.delete = async () => { deleteCalls += 1; };

    await expect(garbageCollectSourceAssets(db, store, now)).resolves.toEqual({ scanned: 1, deleted: 0, held: 0, blocked: 1, retained: 0 });
    expect(deleteCalls).toBe(0);
    expect(tombstone.status).toBe('RETRYABLE');
  });

  it('stops quarantine physical deletion when a lease is taken over before the store call', async () => {
    const asset: any = {
      id: 'asset-stale-quarantine',
      objectKey: 'quarantine/stale-quarantine',
      checksum: 'sha256:stale-quarantine',
      state: 'QUARANTINED',
      createdAt: new Date(now.getTime() - 1),
      quarantineExpiresAt: new Date(now.getTime() - 1),
      retentionExpiresAt: new Date(now.getTime() - 1),
      retentionPolicyId: 'source-policy-v1',
      retentionPolicyVersion: 'v1',
      retentionDeleteStrategy: 'delete-content',
      retentionSeconds: 60,
      deletionClaimToken: null,
      deletionLeaseExpiresAt: null,
    };
    const tombstone: any = { objectKey: asset.objectKey, status: 'PENDING', deletionClaimToken: null };
    let deleteCalls = 0;
    let leaseTakeoverVisible = false;
    const db: any = {
      submissionAsset: {
        findMany: async () => [asset],
        findUnique: async () => asset.state === 'DELETING' && asset.deletionClaimToken && !leaseTakeoverVisible
          ? (leaseTakeoverVisible = true, { ...asset, deletionClaimToken: 'takeover-owner' })
          : asset,
        updateMany: async ({ data }: any) => {
          if (data.deletionClaimedAt && !data.state) return { count: 0 };
          Object.assign(asset, data);
          return { count: 1 };
        },
      },
      submissionObjectTombstone: {
        findUnique: async () => null,
        upsert: async ({ create }: any) => { Object.assign(tombstone, create); return tombstone; },
        updateMany: async ({ data }: any) => { Object.assign(tombstone, data); return { count: 1 }; },
      },
      gradingAuditEvent: { create: async () => undefined },
      $transaction: async (callback: (tx: any) => Promise<unknown>) => callback(db),
    };
    const store = new MemorySubmissionObjectStore();
    store.put({ key: asset.objectKey, ownerId: 'student-stale-quarantine', answerId: 'answer-stale-quarantine', sizeBytes: 1, mimeType: 'application/pdf', checksum: asset.checksum, scanState: 'CLEAN' });
    store.delete = async () => { deleteCalls += 1; };

    await expect(garbageCollectQuarantine(db, store, now)).resolves.toEqual({ claimed: 1, deleted: 0, failed: 1 });
    expect(deleteCalls).toBe(0);
    expect(tombstone.status).toBe('RETRYABLE');
  });

  it('does not roll back any of the four lease clocks after interleaved heartbeats', async () => {
    const base = new Date('2026-07-13T00:00:00.000Z');
    const later = new Date(base.getTime() + 30_000);

    async function runInterleaved(input: {
      field: 'workerLeaseExpiresAt' | 'deletionLeaseExpiresAt' | 'workerClaimedAt';
      buildDb: (model: any) => any;
      renew: (db: any, at: Date) => Promise<boolean>;
      read: (row: any) => Date;
      state?: string;
      status?: string;
    }) {
      const row: any = {
        state: input.state ?? (input.field === 'workerLeaseExpiresAt' ? 'RUNNING' : input.field === 'deletionLeaseExpiresAt' ? 'PENDING' : 'CONVERTING'),
        ...(input.status ? { status: input.status } : {}),
        workerClaimToken: 'worker-token',
        deletionClaimToken: 'worker-token',
        workerClaimedAt: base,
        deletionClaimedAt: base,
        workerLeaseExpiresAt: new Date(base.getTime() + 300_000),
        deletionLeaseExpiresAt: new Date(base.getTime() + 300_000),
      };
      const snapshot = { ...row, workerClaimedAt: new Date(row.workerClaimedAt), deletionClaimedAt: new Date(row.deletionClaimedAt), workerLeaseExpiresAt: new Date(row.workerLeaseExpiresAt), deletionLeaseExpiresAt: new Date(row.deletionLeaseExpiresAt) };
      let reads = 0;
      let updates = 0;
      let releaseFirst!: () => void;
      let signalFirstUpdate!: () => void;
      const firstUpdateStarted = new Promise<void>((resolve) => { signalFirstUpdate = resolve; });
      const db: any = input.buildDb({
        findUnique: async () => {
          reads += 1;
          return reads <= 2 ? { ...snapshot } : { ...row };
        },
        updateMany: async ({ where, data }: any) => {
          updates += 1;
          if (updates === 1) {
            signalFirstUpdate();
            await new Promise<void>((resolve) => { releaseFirst = resolve; });
          }
          const proposed = new Date(data[input.field]);
          const current = input.read(row);
          const hasMonotonicPredicate = JSON.stringify(where).includes('"lt"');
          if (hasMonotonicPredicate && current >= proposed) return { count: 0 };
          Object.assign(row, data);
          return { count: 1 };
        },
      });
      const slow = input.renew(db, base);
      await firstUpdateStarted;
      const fast = input.renew(db, later);
      await fast;
      releaseFirst();
      await expect(slow).resolves.toBe(true);
      expect(input.read(row).getTime()).toBeGreaterThanOrEqual(input.field === 'workerClaimedAt' ? later.getTime() : later.getTime() + 300_000);
    }

    await runInterleaved({
      field: 'workerLeaseExpiresAt',
      buildDb: (model) => ({ gradingJob: model }),
      renew: (db, at) => renewGradingJobLease({ db, jobId: 'job-interleaved', workerClaimToken: 'worker-token', now: at }),
      read: (row) => row.workerLeaseExpiresAt,
    });
    await runInterleaved({
      field: 'deletionLeaseExpiresAt',
      buildDb: (model) => ({ gradingTombstone: model }),
      renew: (db, at) => renewGradingTombstoneLease({ db, resourceKey: 'run:interleaved', claimToken: 'worker-token', now: at }),
      read: (row) => row.deletionLeaseExpiresAt,
      status: 'PENDING',
    });
    await runInterleaved({
      field: 'workerClaimedAt',
      buildDb: (model) => ({ gradingBatchItem: model }),
      renew: (db, at) => renewBatchItemLease({ db, itemId: 'item-interleaved', workerClaimToken: 'worker-token', now: at }),
      read: (row) => row.workerClaimedAt,
    });
    await runInterleaved({
      field: 'deletionLeaseExpiresAt',
      buildDb: (model) => ({ submissionAsset: model }),
      renew: (db, at) => renewSubmissionAssetDeletionLease({ db, assetId: 'asset-interleaved', claimToken: 'worker-token', now: at }),
      read: (row) => row.deletionLeaseExpiresAt,
      state: 'DELETING',
    });
  });

  it('records physical deletion as unavailable when a parent hold appears after the delete barrier', async () => {
    const databaseNow = new Date(now.getTime() + 4 * 60_000);
    const asset: any = {
      id: 'asset-hold-barrier',
      objectKey: 'quarantine/hold-barrier',
      checksum: 'sha256:hold-barrier',
      state: 'QUARANTINED',
      createdAt: new Date(now.getTime() - 86_400_000),
      quarantineExpiresAt: new Date(now.getTime() - 1),
      retentionPolicyId: 'source-policy-v1',
      retentionPolicyVersion: 'v1',
      retentionDeleteStrategy: 'delete-content',
      retentionSeconds: 60,
      retentionExpiresAt: new Date(now.getTime() - 1),
      deletionClaimToken: null,
      deletionLeaseExpiresAt: null,
    };
    const tombstone: any = { objectKey: asset.objectKey, status: 'PENDING', deletionClaimToken: null };
    let holdVisible = false;
    const db: any = {
      submissionAsset: {
        findMany: async () => [asset],
        findUnique: async () => asset,
        updateMany: async ({ where, data }: any) => {
          if (where.deletionClaimToken && where.deletionClaimToken !== asset.deletionClaimToken) return { count: 0 };
          Object.assign(asset, data);
          return { count: 1 };
        },
      },
      submissionObjectTombstone: {
        findUnique: async () => tombstone,
        upsert: async ({ create, update }: any) => { Object.assign(tombstone, tombstone.deletionClaimToken ? update : create); return tombstone; },
        updateMany: async ({ where, data }: any) => {
          if (where.deletionClaimToken && where.deletionClaimToken !== tombstone.deletionClaimToken) return { count: 0 };
          Object.assign(tombstone, data);
          return { count: 1 };
        },
      },
      gradingLegalHold: { findFirst: async () => holdVisible ? { id: 'hold-parent' } : null },
      gradingAuditEvent: { create: async () => undefined },
      $queryRaw: async () => [{ now: databaseNow }],
      $transaction: async (callback: (tx: any) => Promise<unknown>) => callback(db),
    };
    const store = new MemorySubmissionObjectStore();
    store.put({ key: asset.objectKey, ownerId: 'student-hold-barrier', answerId: 'answer-hold-barrier', sizeBytes: 1, mimeType: 'application/pdf', checksum: asset.checksum, scanState: 'CLEAN' });
    const originalDelete = store.delete.bind(store);
    store.delete = async (key: string, signal?: AbortSignal) => {
      await originalDelete(key, signal);
      holdVisible = true;
    };

    await expect(garbageCollectQuarantine(db, store, now)).resolves.toEqual(expect.objectContaining({ claimed: 1, deleted: 0, failed: 1 }));
    expect(await store.head(asset.objectKey)).toBeNull();
    expect(asset.state).toBe('CONTENT_UNAVAILABLE');
    expect(tombstone).toEqual(expect.objectContaining({ status: 'DELETED_WITH_HOLD', physicalDeletedAt: databaseNow, deletedAt: databaseNow, lastErrorCode: 'deleted-with-hold', deletionClaimToken: null }));
    expect(asset.tombstonedAt).toEqual(databaseNow);
  });

  it('reconciles a physical delete when the old owner loses its CAS to a new owner', async () => {
    const asset: any = {
      id: 'asset-owner-fence-after-delete',
      objectKey: 'quarantine/owner-fence-after-delete',
      checksum: 'sha256:owner-fence-after-delete',
      state: 'QUARANTINED',
      createdAt: new Date(now.getTime() - 86_400_000),
      quarantineExpiresAt: new Date(now.getTime() - 1),
      retentionPolicyId: 'source-policy-v1',
      retentionPolicyVersion: 'v1',
      retentionDeleteStrategy: 'delete-content',
      retentionSeconds: 60,
      retentionExpiresAt: new Date(now.getTime() - 1),
      deletionClaimToken: null,
      deletionLeaseExpiresAt: null,
    };
    const tombstone: any = { objectKey: asset.objectKey, status: 'PENDING', deletionClaimToken: null };
    const db: any = {
      submissionAsset: {
        findMany: async () => [asset],
        findUnique: async () => asset,
        updateMany: async ({ where, data }: any) => {
          if (where.deletionClaimToken && where.deletionClaimToken !== asset.deletionClaimToken) return { count: 0 };
          Object.assign(asset, data);
          return { count: 1 };
        },
      },
      submissionObjectTombstone: {
        findUnique: async () => tombstone,
        upsert: async ({ create, update }: any) => { Object.assign(tombstone, tombstone.deletionClaimToken ? update : create); return tombstone; },
        updateMany: async ({ where, data }: any) => {
          if (where.deletionClaimToken && where.deletionClaimToken !== tombstone.deletionClaimToken) return { count: 0 };
          Object.assign(tombstone, data);
          return { count: 1 };
        },
      },
      gradingLegalHold: { findFirst: async () => null },
      gradingAuditEvent: { create: async () => undefined },
      $transaction: async (callback: (tx: any) => Promise<unknown>) => callback(db),
    };
    const store = new MemorySubmissionObjectStore();
    store.put({ key: asset.objectKey, ownerId: 'student-owner-fence', answerId: 'answer-owner-fence', sizeBytes: 1, mimeType: 'application/pdf', checksum: asset.checksum, scanState: 'CLEAN' });
    const originalDelete = store.delete.bind(store);
    store.delete = async (key: string, signal?: AbortSignal) => {
      await originalDelete(key, signal);
      asset.deletionClaimToken = 'new-owner';
      tombstone.deletionClaimToken = 'new-owner';
    };

    await expect(garbageCollectQuarantine(db, store, now)).resolves.toEqual(expect.objectContaining({ claimed: 1, deleted: 0, failed: 1 }));
    expect(asset.state).toBe('DELETED');
    expect(tombstone).toEqual(expect.objectContaining({ status: 'DELETED', physicalDeletedAt: expect.any(Date), lastErrorCode: null, deletionClaimToken: null }));
  });

  it('abandons a source-asset claim when the frozen policy tuple changes after scan', async () => {
    const scanned: any = {
      id: 'asset-policy-race-source', objectKey: 'quarantine/policy-race-source', checksum: 'sha256:policy-race-source', state: 'FINALIZED',
      retentionExpiresAt: new Date(now.getTime() - 1), retentionPolicyId: 'source-policy-v1', retentionPolicyVersion: 'v1', retentionDeleteStrategy: 'delete-content', retentionSeconds: 60, governedRecordRule: null,
      answer: { submission: { assignmentRevisionId: 'revision-policy-race', frozenAudienceClassId: 'class-policy-race' } }, documentConversions: [], answerEvidence: [],
    };
    const current = { ...scanned, retentionPolicyVersion: 'v2' };
    let claimUpdates = 0;
    const db: any = {
      submissionAsset: {
        findMany: async () => [scanned],
        findUnique: async () => current,
        updateMany: async () => { claimUpdates += 1; return { count: 1 }; },
      },
      documentConversion: { findMany: async () => [] },
      answerEvidence: { findMany: async () => [] },
      gradingRun: { findMany: async () => [] },
      submissionObjectTombstone: { findUnique: async () => null, upsert: async () => undefined },
      gradingLegalHold: { findFirst: async () => null },
      gradingAuditEvent: { create: async () => undefined },
      $transaction: async (callback: (tx: any) => Promise<unknown>) => callback(db),
    };

    const result = await garbageCollectSourceAssets(db, new MemorySubmissionObjectStore(), now);
    expect(result).toEqual(expect.objectContaining({ scanned: 1, deleted: 0, blocked: 0 }));
    expect(claimUpdates).toBe(0);
  });

});
