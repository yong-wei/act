import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { assertDeliveryWindow, assertSubmissionObjectIntegrity, deriveAggregate, finalizeSchema, mayReadSubmission, SubmissionError, uploadIntentSchema } from '@/lib/assignments/submission-domain';
import { deriveStudentAssignmentPresentation, safePromptText } from '@/lib/assignments/submission-dto';
import { getLocalTestSubmissionObjectStore, MemorySubmissionObjectStore, S3CompatibleSubmissionObjectStore } from '@/lib/assignments/submission-object-store';

describe('assignment submission domain', () => {
  it('derives aggregate only from independently submitted required answers', () => {
    expect(deriveAggregate([{ state: 'SUBMITTED' }, { state: 'DRAFT' }])).toEqual({ state: 'IN_PROGRESS', submittedRequiredCount: 1, requiredQuestionCount: 2 });
    expect(deriveAggregate([{ state: 'SUBMITTED' }, { state: 'SUBMITTED' }]).state).toBe('SUBMITTED');
  });
  it('enforces deadlines and explicit late policy', () => {
    expect(() => assertDeliveryWindow({ now: new Date('2026-07-12'), availableAt: new Date('2026-07-01'), dueAt: new Date('2026-07-11'), latePolicy: { version: 1, mode: 'CLOSED' } })).toThrowError(new SubmissionError('assignment-deadline-closed', 409));
    expect(() => assertDeliveryWindow({ now: new Date('2026-07-12'), availableAt: new Date('2026-07-01'), dueAt: new Date('2026-07-11'), latePolicy: { version: 1, mode: 'ALLOW', penaltyPercentPerDay: 10 } })).not.toThrow();
  });
  it('allows frozen history only for the owning student with a submitted attempt', () => {
    expect(mayReadSubmission({ currentClassId: null, audienceClassId: 'c1', studentId: 's1', ownerStudentId: 's1', hasSubmittedAttempt: true })).toBe(true);
    expect(mayReadSubmission({ currentClassId: null, audienceClassId: 'c1', studentId: 's2', ownerStudentId: 's1', hasSubmittedAttempt: true })).toBe(false);
  });
  it('requires a question-scoped quarantine object key', () => {
    expect(finalizeSchema.safeParse({ objectKey: 'combined-assignment.pdf', idempotencyKey: 'abcdefgh' }).success).toBe(false);
  });
  it('rejects the whole-assignment submission endpoint', async () => {
    const { POST } = await import('@/app/api/student/assignments/route');
    const response = await POST();
    expect(response.status).toBe(405);
    await expect(response.json()).resolves.toEqual({ error: 'whole-assignment-submission-unsupported' });
  });
  it('uses strict response and checksum contracts', () => {
    expect(uploadIntentSchema.safeParse({ fileName: 'all.docx', mimeType: 'application/msword', sizeBytes: 12, checksum: 'abc' }).success).toBe(false);
    expect(uploadIntentSchema.safeParse({ fileName: 'q1.pdf', mimeType: 'application/pdf', sizeBytes: 12, checksum: `sha256:${'a'.repeat(64)}` }).success).toBe(true);
  });
  it('rejects same-size object tampering during download', () => {
    expect(() => assertSubmissionObjectIntegrity(new Uint8Array([1]), 1, `sha256:${'a'.repeat(64)}`)).toThrowError(new SubmissionError('asset-integrity-mismatch', 502));
  });
  it('accepts an object whose size and SHA-256 match persisted metadata', () => {
    const bytes = new Uint8Array([1, 2, 3]);
    const checksum = `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
    expect(() => assertSubmissionObjectIntegrity(bytes, bytes.byteLength, checksum)).not.toThrow();
  });
  it('rejects an object whose size differs from persisted metadata', () => {
    const bytes = new Uint8Array([1, 2, 3]);
    const checksum = `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
    expect(() => assertSubmissionObjectIntegrity(bytes, bytes.byteLength + 1, checksum))
      .toThrowError(new SubmissionError('asset-integrity-mismatch', 502));
  });
  it('whitelists prompt text and never serializes teacher-only snapshots', () => {
    expect(safePromptText({ prompt: 'student prompt', referenceAnswer: 'secret', rubric: { hidden: true } })).toBe('student prompt');
    expect(safePromptText({ referenceAnswer: 'secret' })).toBe('');
  });
  it('derives overdue and downstream next actions from a server whitelist', () => {
    expect(deriveStudentAssignmentPresentation({ persistedState: 'IN_PROGRESS', dueAt: new Date('2026-07-10'), now: new Date('2026-07-11'), lateClosed: true })).toEqual({ state: 'OVERDUE', nextAction: 'contact-teacher' });
    expect(deriveStudentAssignmentPresentation({ persistedState: 'SUBMITTED', dueAt: new Date('2026-07-10'), now: new Date('2026-07-11'), lateClosed: true, downstreamState: 'RESUBMISSION_REQUIRED' })).toEqual({ state: 'RESUBMISSION_REQUIRED', nextAction: 'resubmit-question' });
  });
});

describe('private object store contract', () => {
  it('caps signed upload lifetime at ten minutes and creates immutable opaque keys', async () => {
    const store = new MemorySubmissionObjectStore();
    const intent = { ownerId: 'student', answerId: 'answer', sizeBytes: 12, mimeType: 'application/pdf', checksum: `sha256:${'a'.repeat(64)}` };
    await expect(store.signUpload(intent, 601)).rejects.toThrow('invalid-signed-url-ttl');
    const first = await store.signUpload(intent, 600); const second = await store.signUpload(intent, 600);
    expect(first.key).toMatch(/^quarantine\/[a-f0-9]{2}\/[a-f0-9]{48}$/); expect(second.key).not.toBe(first.key);
    expect(first.requiredHeaders['x-amz-checksum-sha256']).toBe(Buffer.from('a'.repeat(64), 'hex').toString('base64'));
  });
  it('does not overwrite finalized in-memory objects', async () => {
    const store = new MemorySubmissionObjectStore(); const metadata = { key: 'quarantine/aa/' + 'a'.repeat(48), ownerId: 's', answerId: 'a', sizeBytes: 1, mimeType: 'application/pdf', checksum: `sha256:${'b'.repeat(64)}`, scanState: 'CLEAN' as const };
    store.put(metadata); expect(await store.head(metadata.key)).toEqual(metadata);
  });
  it('uses AWS SigV4 query signing and S3 base64 checksum headers', async () => {
    const store = new S3CompatibleSubmissionObjectStore({ endpoint: 'https://minio.invalid', bucket: 'private-submissions', accessKey: 'scanner-separated-app-key', secretKey: 'test-secret', region: 'us-east-1' });
    const signed = await store.signUpload({ ownerId: 'student', answerId: 'answer', sizeBytes: 12, mimeType: 'application/pdf', checksum: `sha256:${'a'.repeat(64)}` }, 600, `quarantine/aa/${'b'.repeat(48)}`);
    const url = new URL(signed.url);
    expect(url.searchParams.get('X-Amz-Algorithm')).toBe('AWS4-HMAC-SHA256');
    expect(url.searchParams.get('X-Amz-Signature')).toMatch(/^[a-f0-9]{64}$/);
    expect(signed.requiredHeaders['x-amz-checksum-sha256']).toBe(Buffer.from('a'.repeat(64), 'hex').toString('base64'));
  });
  it('executes the local signed upload route contract without a reusable app credential', async () => {
    const bytes = new TextEncoder().encode('question-file');
    const checksum = `sha256:${(await import('node:crypto')).createHash('sha256').update(bytes).digest('hex')}`;
    const store = getLocalTestSubmissionObjectStore();
    const signed = await store.signUpload({ ownerId: 'student', answerId: 'answer-local-route', sizeBytes: bytes.byteLength, mimeType: 'application/pdf', checksum }, 600);
    const { PUT } = await import('@/app/api/student/submission-objects/local-upload/route');
    const response = await PUT(new Request(signed.url, { method: 'PUT', headers: signed.requiredHeaders, body: bytes }));
    expect(response.status).toBe(204);
    await expect(store.head(signed.key)).resolves.toMatchObject({ ownerId: 'student', answerId: 'answer-local-route', checksum, scanState: 'PENDING' });
  });
});
