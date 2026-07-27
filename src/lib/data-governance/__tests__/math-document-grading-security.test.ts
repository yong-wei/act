import { describe, expect, it } from 'vitest';

import {
  authorizeGradingScope,
  GradingMutationError,
  validatePipelineMutation,
} from '../math-document-grading-contracts';
import {
  canReadGradingArtifact,
  enforceGradingQuota,
  placeGradingHold,
  requireConfiguredLifecyclePolicies,
  releaseGradingHold,
} from '../math-document-grading-lifecycle';
import { gradingApiError } from '../math-document-grading-api';
import { assertPipelineActorScope, cancelDocumentConversion, enqueueDocumentConversion, materializeTextAnswerEvidence } from '../math-document-grading-persistence';
import { cancelQuestionGradingBatch } from '../math-document-grading-batch';

describe('production math-document grading security contracts', () => {
  it('maps a request idempotency conflict to HTTP 409', async () => {
    const response = gradingApiError(new GradingMutationError('idempotency-key-conflict', 409));
    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({ error: 'idempotency-key-conflict' });
  });

  it('maps nullable or content-unavailable pipeline lineage to HTTP 410 instead of a TypeError/500', async () => {
    expect(gradingApiError(new Error('conversion-content-unavailable:association-missing')).status).toBe(410);
    expect(gradingApiError(new Error('batch-content-unavailable:parent-lineage-missing')).status).toBe(410);
    await expect(materializeTextAnswerEvidence({ db: { submissionAttempt: { findUnique: async () => ({ id: 'attempt-null-lineage', answer: null }) } }, attemptId: 'attempt-null-lineage', actor: { id: 'service', role: 'SERVICE' } })).rejects.toThrow('grading-content-unavailable:association-missing');
    await expect(enqueueDocumentConversion({ db: { submissionAsset: { findUnique: async () => ({ id: 'asset-null-lineage', answerId: null, attemptId: null }) } }, assetId: 'asset-null-lineage', attemptId: 'attempt-null-lineage', actor: { id: 'service', role: 'SERVICE' }, adapterVersion: 'router.v1', idempotencyKey: 'null-lineage-001' })).rejects.toThrow('conversion-content-unavailable:association-missing');
    await expect(cancelDocumentConversion({ db: { documentConversion: { findUnique: async () => ({ id: 'conversion-null-lineage', assetId: null, attemptId: null, asset: null }) } }, conversionId: 'conversion-null-lineage', actor: { id: 'teacher', role: 'TEACHER' } })).rejects.toThrow('conversion-content-unavailable:association-missing');
    await expect(cancelQuestionGradingBatch({ db: { gradingBatch: { findUnique: async () => ({ id: 'batch-null-lineage', assignmentRevisionId: null, classId: null, class: null }) } }, batchId: 'batch-null-lineage', actor: { id: 'teacher', role: 'TEACHER' } })).rejects.toThrow('batch-content-unavailable:parent-lineage-missing');
  });

  it('requires an authenticated-origin mutation with a bounded idempotency key', () => {
    const request = new Request('https://teacher.example/api/pipeline', {
      method: 'POST',
      headers: {
        origin: 'https://teacher.example',
        'content-length': '96',
      },
      body: JSON.stringify({ idempotencyKey: 'same-request-001' }),
    });
    expect(validatePipelineMutation({ request, body: { idempotencyKey: 'same-request-001' }, expectedOrigin: 'https://teacher.example' })).toEqual({ idempotencyKey: 'same-request-001' });

    expect(() => validatePipelineMutation({
      request: new Request(request, { headers: { origin: 'https://attacker.example' } }),
      body: { idempotencyKey: 'same-request-001' },
      expectedOrigin: 'https://teacher.example',
    })).toThrowError(new GradingMutationError('invalid-origin', 403));
    expect(() => validatePipelineMutation({
      request,
      body: { idempotencyKey: 'short' },
      expectedOrigin: 'https://teacher.example',
    })).toThrowError('invalid-pipeline-payload');
    expect(() => validatePipelineMutation({
      request: new Request('https://teacher.example/api/pipeline', {
        method: 'POST',
        headers: { origin: 'https://teacher.example', 'content-length': '300000' },
      }),
      body: { idempotencyKey: 'same-request-001' },
      expectedOrigin: 'https://teacher.example',
    })).toThrowError('payload-too-large');
  });

  it('keeps student, teacher, and service scopes purpose-bound', () => {
    expect(authorizeGradingScope({
      role: 'STUDENT',
      actorId: 'student-1',
      requestedStudentId: 'student-1',
      ownerStudentId: 'student-1',
      requestedClassId: 'class-1',
      ownerClassId: 'class-1',
      purpose: 'submit',
    })).toBe(true);
    expect(authorizeGradingScope({
      role: 'STUDENT',
      actorId: 'student-2',
      requestedStudentId: 'student-1',
      ownerStudentId: 'student-1',
      requestedClassId: 'class-1',
      ownerClassId: 'class-1',
      purpose: 'submit',
    })).toBe(false);
    expect(authorizeGradingScope({
      role: 'TEACHER',
      actorId: 'teacher-1',
      classTeacherId: 'teacher-1',
      requestedClassId: 'class-1',
      ownerClassId: 'class-1',
      ownerStudentId: 'student-1',
      purpose: 'teacher-review',
    })).toBe(true);
    expect(authorizeGradingScope({
      role: 'TEACHER',
      actorId: 'teacher-2',
      classTeacherId: 'teacher-1',
      requestedClassId: 'class-1',
      ownerClassId: 'class-1',
      ownerStudentId: 'student-1',
      purpose: 'teacher-review',
    })).toBe(false);
    expect(authorizeGradingScope({
      role: 'TEACHER',
      actorId: 'teacher-2',
      classTeacherId: 'teacher-1',
      assignmentAuthorId: 'teacher-1',
      hasAssignmentReviewGrant: true,
      requestedClassId: 'class-1',
      ownerClassId: 'class-1',
      ownerStudentId: 'student-1',
      purpose: 'teacher-review',
    })).toBe(true);
    expect(authorizeGradingScope({ role: 'SERVICE', actorId: 'worker', purpose: 'service' })).toBe(true);
    expect(authorizeGradingScope({ role: 'TEACHER', actorId: 'teacher-1', purpose: 'service' })).toBe(false);

    expect(canReadGradingArtifact({ actor: { id: 'student-1', role: 'STUDENT' }, ownerStudentId: 'student-1', ownerClassId: 'class-1', artifactState: 'APPROVED', purpose: 'student-own' })).toBe(true);
    expect(canReadGradingArtifact({ actor: { id: 'student-1', role: 'STUDENT' }, ownerStudentId: 'student-1', ownerClassId: 'class-1', artifactState: 'AWAITING_REVIEW', purpose: 'student-own' })).toBe(false);
    expect(canReadGradingArtifact({ actor: { id: 'teacher-1', role: 'TEACHER' }, ownerStudentId: 'student-1', ownerClassId: 'class-1', requestedClassId: 'class-1', classTeacherId: 'teacher-1', artifactState: 'AWAITING_REVIEW', purpose: 'teacher-review' })).toBe(true);
    expect(canReadGradingArtifact({ actor: { id: 'teacher-1', role: 'TEACHER' }, ownerStudentId: 'student-1', ownerClassId: 'class-1', requestedClassId: 'class-2', classTeacherId: 'teacher-1', artifactState: 'AWAITING_REVIEW', purpose: 'teacher-review' })).toBe(false);
  });

  it('enforces a quota window and records legal holds without direct actor identifiers', async () => {
    const quotas = new Map<string, any>();
    const holds: any[] = [];
    const db = {
      $transaction: async (callback: (tx: any) => Promise<unknown>) => callback(db),
      gradingQuota: {
        findUnique: async ({ where }: any) => quotas.get(where.key) ?? null,
        upsert: async ({ where, create, update }: any) => {
          const row = { ...(quotas.get(where.key) ?? create), ...update };
          quotas.set(where.key, row);
          return row;
        },
      },
      gradingLegalHold: {
        create: async ({ data }: any) => { holds.push(data); return data; },
        update: async ({ where, data }: any) => ({ id: where.id, ...data }),
      },
      gradingAuditEvent: { create: async () => undefined },
    };
    const first = await enforceGradingQuota({ db, subjectType: 'class', subjectId: 'class-1', scope: 'conversion', maxRequests: 1, now: new Date('2026-07-12T08:00:00Z') });
    const second = await enforceGradingQuota({ db, subjectType: 'class', subjectId: 'class-1', scope: 'conversion', maxRequests: 1, now: new Date('2026-07-12T08:00:01Z') });
    expect(first.allowed).toBe(true);
    expect(second.allowed).toBe(false);
    expect(second.retryAfterSeconds).toBe(60);

    const hold = await placeGradingHold({ db, scopeType: 'evidence', scopeId: 'evidence-1', reason: 'academic review', actorId: 'teacher-1', actorRole: 'TEACHER' });
    expect(hold.placedByPseudoId).not.toContain('teacher-1');
    expect(holds[0].reason).toBe('academic review');
    const released = await releaseGradingHold({ db, holdId: hold.id, actorId: 'teacher-1', actorRole: 'TEACHER' });
    expect(released.releasedByPseudoId).not.toContain('teacher-1');
  });

  it('serializes concurrent quota increments through a serializable transaction', async () => {
    let row: any = null;
    let transactionTail = Promise.resolve();
    const isolationLevels: unknown[] = [];
    const db: any = {
      $transaction: async (callback: (tx: any) => Promise<unknown>, options: unknown) => {
        isolationLevels.push(options);
        const previous = transactionTail;
        let release!: () => void;
        transactionTail = new Promise<void>((resolve) => { release = resolve; });
        await previous;
        try {
          return await callback(db);
        } finally {
          release();
        }
      },
      gradingQuota: {
        findUnique: async () => row,
        upsert: async ({ create, update }: any) => {
          await Promise.resolve();
          row = { ...(row ?? create), ...update };
          return row;
        },
      },
    };
    const results = await Promise.all([
      enforceGradingQuota({ db, subjectType: 'user', subjectId: 'teacher-1', scope: 'grading', maxRequests: 1 }),
      enforceGradingQuota({ db, subjectType: 'user', subjectId: 'teacher-1', scope: 'grading', maxRequests: 1 }),
    ]);
    expect(results.map((result) => result.allowed).sort()).toEqual([false, true]);
    expect(isolationLevels).toEqual([{ isolationLevel: 'Serializable' }, { isolationLevel: 'Serializable' }]);
  });

  it('allows historical assignment review only through the assignment author or an unexpired explicit grant', async () => {
    const db = {
      assignmentRevision: {
        findUnique: async () => ({ assignment: { authorId: 'teacher-author', reviewGrants: [{ id: 'grant-1' }] } }),
      },
    };
    await expect(assertPipelineActorScope({ db, actor: { id: 'teacher-granted', role: 'TEACHER' }, assignmentRevisionId: 'revision-1', classId: 'class-1', classTeacherId: 'teacher-current', ownerStudentId: 'student-1', purpose: 'teacher-review', now: new Date('2026-07-12T08:00:00Z') })).resolves.toBeUndefined();
    await expect(assertPipelineActorScope({ db: { assignmentRevision: { findUnique: async () => ({ assignment: { authorId: 'teacher-author', reviewGrants: [] } }) } }, actor: { id: 'teacher-unassigned', role: 'TEACHER' }, assignmentRevisionId: 'revision-1', classId: 'class-1', classTeacherId: 'teacher-current', ownerStudentId: 'student-1', purpose: 'teacher-review', now: new Date('2026-07-12T08:00:00Z') })).rejects.toThrow('grading-forbidden');
  });

  it('filters revoked review grants at the authorization query boundary', async () => {
    let query: any;
    const db = {
      assignmentRevision: {
        findUnique: async (input: any) => {
          query = input;
          return { assignment: { authorId: 'teacher-author', reviewGrants: [{ id: 'grant-1' }] } };
        },
      },
    };
    await expect(assertPipelineActorScope({ db, actor: { id: 'teacher-granted', role: 'TEACHER' }, assignmentRevisionId: 'revision-1', classId: 'class-1', classTeacherId: 'teacher-current', ownerStudentId: 'student-1', purpose: 'teacher-review', now: new Date('2026-07-12T08:00:00Z') })).resolves.toBeUndefined();
    expect(query.select.assignment.select.reviewGrants.where).toEqual({
      teacherId: 'teacher-granted',
      revokedAt: null,
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date('2026-07-12T08:00:00Z') } }],
    });
  });

  it('fails closed when an enabled lifecycle data class is missing or incomplete', async () => {
    const db = {
      gradingLifecyclePolicy: {
        findMany: async () => [{ id: 'lifecycle:answer-evidence:v1', dataClass: 'answer-evidence', version: 'v1', retentionSeconds: 60, governedRecordRule: null, deleteStrategy: 'delete-content', providerRetentionSeconds: 0, enabled: true }],
      },
    };
    await expect(requireConfiguredLifecyclePolicies(db, ['answer-evidence', 'ai-draft'])).rejects.toThrow('lifecycle-policy-blocked:missing:ai-draft');
    await expect(requireConfiguredLifecyclePolicies({ gradingLifecyclePolicy: { findMany: async () => [{ id: 'lifecycle:ai-draft:v1', dataClass: 'ai-draft', version: 'v1', retentionSeconds: null, governedRecordRule: null, deleteStrategy: 'retain-governed-record', enabled: true }] } }, ['ai-draft'])).rejects.toThrow('finite-retention-or-record-rule-required');
  });
});
