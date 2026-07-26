import { execFileSync } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { Pool } from 'pg';

const { getServerAuthSession } = vi.hoisted(() => ({ getServerAuthSession: vi.fn() }));
vi.mock('@/lib/auth', () => ({ getServerAuthSession }));

import { getLocalTestSubmissionObjectStore, type MemorySubmissionObjectStore } from '@/lib/assignments/submission-object-store';
import { LocalSubmissionObjectScanner, runSubmissionScanBatch } from '@/lib/assignments/submission-scanner';
import { consumeSubmissionAssetRead, finalizeQuestionAsset, garbageCollectQuarantine, getQuestionUploadStatus, getStudentAssignment, saveQuestionDraft, signQuestionUpload, signSubmissionAssetRead, submitQuestionAnswer } from '@/lib/assignments/submission-service';
import { prisma } from '@/lib/prisma';
import { GET as GET_ASSET, POST as CREATE_ASSET_ACCESS } from '@/app/api/student/assignments/[assignmentId]/answers/[questionId]/assets/[assetId]/read/route';
import { PUT as PUT_LOCAL_UPLOAD } from '@/app/api/student/submission-objects/local-upload/route';
import { GET as GET_FINALIZE_ROUTE, POST as FINALIZE_ROUTE } from '@/app/api/student/assignments/[assignmentId]/answers/[questionId]/finalize/route';

const enabled = process.env.SUBMISSION_REAL_DB_TEST === '1';
const schemaName = `assignment902_it_${process.pid}_${randomBytes(4).toString('hex')}`;
const teacherId = 'assignment902-teacher'; const studentId = 'assignment902-student'; const otherStudentId = 'assignment902-other'; const classId = 'assignment902-class';
let adminUrl = ''; let assignmentId = ''; let firstRevisionId = ''; let textQuestionId = ''; let fileQuestionId = ''; let store: MemorySubmissionObjectStore;

describe.runIf(enabled)('student assignment isolated PostgreSQL integration', () => {
  beforeAll(async () => {
    const baseUrl = process.env.SUBMISSION_TEST_DATABASE_BASE_URL ?? process.env.DATABASE_URL;
    if (!baseUrl) throw new Error('submission-test-database-required');
    assertTemporarySchema(schemaName);
    const admin = new URL(baseUrl); admin.searchParams.delete('schema'); adminUrl = admin.toString();
    const scoped = new URL(adminUrl); scoped.searchParams.set('schema', schemaName);
    const pool = new Pool({ connectionString: adminUrl });
    try { await pool.query(`CREATE SCHEMA "${schemaName}"`); process.env.DATABASE_URL = scoped.toString(); execFileSync('npx', ['prisma', 'db', 'push', '--url', scoped.toString()], { cwd: process.cwd(), env: process.env, stdio: 'pipe' }); } finally { await pool.end(); }
    await prisma.user.createMany({ data: [{ id: teacherId, role: 'TEACHER' }, { id: studentId, role: 'STUDENT' }, { id: otherStudentId, role: 'STUDENT' }] });
    await prisma.class.create({ data: { id: classId, name: '902班', code: 'A902IT', teacherId } });
    await prisma.studentProfile.createMany({ data: [{ userId: studentId, classId }, { userId: otherStudentId, classId }] });
    const assignment = await prisma.assignment.create({ data: { authorId: teacherId, state: 'PUBLISHED', revisions: { create: { revisionNumber: 1, state: 'PUBLISHED', title: '逐题作业', instructions: '分别提交', totalPoints: 2, latePolicy: { version: 1, mode: 'CLOSED' }, responsePolicy: { version: 1, allowedResponseTypes: ['SUBJECTIVE_TEXT', 'SUBJECTIVE_FILE'] }, resubmissionPolicy: { version: 1, maxAttempts: 1, untilDueAt: true }, solutionReleasePolicy: { version: 1, mode: 'PRIVATE' }, publishedAt: new Date(), frozenAt: new Date(), questions: { create: [question('q-text', 0, 'SUBJECTIVE_TEXT'), question('q-file', 1, 'SUBJECTIVE_FILE')] }, audiences: { create: { classId, availableAt: new Date(Date.now() - 60_000), dueAt: new Date(Date.now() + 3_600_000) } } } } }, include: { revisions: { include: { questions: true } } } });
    assignmentId = assignment.id; firstRevisionId = assignment.revisions[0].id; textQuestionId = assignment.revisions[0].questions.find((q) => q.stableQuestionId === 'q-text')!.id; fileQuestionId = assignment.revisions[0].questions.find((q) => q.stableQuestionId === 'q-file')!.id; store = getLocalTestSubmissionObjectStore(); process.env.NEXTAUTH_URL = 'https://assignment902.test'; getServerAuthSession.mockResolvedValue({ user: { id: studentId, role: 'STUDENT' } });
  });
  afterAll(async () => { await prisma.$disconnect(); if (!adminUrl) return; const pool = new Pool({ connectionString: adminUrl }); try { await pool.query(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`); } finally { await pool.end(); } });

  it('keeps question drafts independent and rejects stale autosave', async () => {
    const first = await saveQuestionDraft(prisma, { studentId, assignmentId, questionId: textQuestionId, version: 1, text: '第一题答案' });
    expect(first.version).toBe(2);
    await expect(saveQuestionDraft(prisma, { studentId, assignmentId, questionId: textQuestionId, version: 1, text: '过期覆盖' })).rejects.toMatchObject({ code: 'answer-version-conflict' });
    const submission = await prisma.assignmentSubmission.findFirstOrThrow({ where: { studentId }, include: { answers: true } });
    expect(submission.answers).toHaveLength(1); expect(submission.answers[0].assignmentQuestionId).toBe(textQuestionId);
  });

  it('finalizes one file idempotently, enforces path binding, and seals questions independently', async () => {
    const uploadedBytes = new Uint8Array(12).fill(1); const checksum = `sha256:${createHash('sha256').update(uploadedBytes).digest('hex')}`;
    const missingSigned = await signQuestionUpload(prisma, store, { studentId, assignmentId, questionId: fileQuestionId, fileName: 'not-uploaded.pdf', mimeType: 'application/pdf', sizeBytes: 12, checksum });
    const [signed, raceSigned] = await Promise.all([
      signQuestionUpload(prisma, store, { studentId, assignmentId, questionId: fileQuestionId, fileName: 'q2.pdf', mimeType: 'application/pdf', sizeBytes: 12, checksum }),
      signQuestionUpload(prisma, store, { studentId, assignmentId, questionId: fileQuestionId, fileName: 'q2-replacement.pdf', mimeType: 'application/pdf', sizeBytes: 12, checksum }),
    ]);
    const reserved = await prisma.submissionAsset.findMany({ where: { answer: { submission: { studentId }, assignmentQuestionId: fileQuestionId } }, orderBy: { version: 'asc' } });
    expect(reserved.map((asset) => asset.version)).toEqual([1, 2, 3]);
    const raceIntent = await prisma.submissionAsset.findUniqueOrThrow({ where: { objectKey: raceSigned.key } });
    expect((await PUT_LOCAL_UPLOAD(new Request(raceSigned.url, { method: 'PUT', headers: raceSigned.requiredHeaders, body: uploadedBytes }))).status).toBe(204);
    const firstIntent = await prisma.submissionAsset.findUniqueOrThrow({ where: { objectKey: signed.key } });
    expect((await PUT_LOCAL_UPLOAD(new Request(signed.url, { method: 'PUT', headers: signed.requiredHeaders, body: uploadedBytes }))).status).toBe(204);
    const finalizeContext = { params: Promise.resolve({ assignmentId, questionId: fileQuestionId }) };
    const pendingResponse = await FINALIZE_ROUTE(new Request(`https://assignment902.test/api/student/assignments/${assignmentId}/answers/${fileQuestionId}/finalize`, { method: 'POST', headers: { origin: 'https://assignment902.test', 'content-type': 'application/json' }, body: JSON.stringify({ intentId: signed.intentId, idempotencyKey: 'finalize-902-file-0001' }) }), finalizeContext) as Response;
    expect(pendingResponse.status).toBe(202); await expect(pendingResponse.json()).resolves.toEqual({ status: 'SCANNING', intentId: signed.intentId });
    await expect(getQuestionUploadStatus(prisma, { studentId, assignmentId, questionId: fileQuestionId, intentId: signed.intentId })).resolves.toMatchObject({ status: 'SCANNING' });
    const scanResult = await runSubmissionScanBatch(prisma, new LocalSubmissionObjectScanner(store), { async healthCheck() {}, async scan() { return 'CLEAN' as const; } });
    expect(scanResult).toMatchObject({ clean: 2, retrying: 1, failed: 0 });
    let missing = await prisma.submissionAsset.findUniqueOrThrow({ where: { id: missingSigned.intentId } });
    expect(missing).toMatchObject({ state: 'QUARANTINED', scanState: 'PENDING', scanRetryCount: 1, lastScanErrorCode: 'object-not-ready' }); expect(missing.nextScanAt).not.toBeNull();
    for (let retry = 0; retry < 2; retry += 1) { await prisma.submissionAsset.update({ where: { id: missing.id }, data: { nextScanAt: new Date(Date.now() - 1) } }); await runSubmissionScanBatch(prisma, new LocalSubmissionObjectScanner(store), { async healthCheck() {}, async scan() { return 'CLEAN' as const; } }, 1); }
    missing = await prisma.submissionAsset.findUniqueOrThrow({ where: { id: missing.id } });
    expect(missing).toMatchObject({ state: 'QUARANTINED', scanState: 'PENDING', scanRetryCount: 3, lastScanErrorCode: 'object-not-ready' }); expect(missing.nextScanAt!.getTime() - Date.now()).toBeLessThanOrEqual(60_000);
    if (!missing.answerId) throw new Error('real-db-fixture-answer-missing');
    store.put({ key: missingSigned.key, ownerId: studentId, answerId: missing.answerId, sizeBytes: 12, mimeType: 'application/pdf', checksum, scanState: 'PENDING' }); store.payloads.set(missingSigned.key, uploadedBytes);
    await prisma.submissionAsset.update({ where: { id: missing.id }, data: { nextScanAt: new Date(Date.now() - 1) } }); await runSubmissionScanBatch(prisma, new LocalSubmissionObjectScanner(store), { async healthCheck() {}, async scan() { return 'CLEAN' as const; } }, 1);
    await expect(prisma.submissionAsset.findUniqueOrThrow({ where: { id: missing.id } })).resolves.toMatchObject({ state: 'QUARANTINED', scanState: 'CLEAN', scanRetryCount: 0, lastScanErrorCode: null, nextScanAt: null });
    const mismatchSigned = await signQuestionUpload(prisma, store, { studentId, assignmentId, questionId: fileQuestionId, fileName: 'mismatch.pdf', mimeType: 'application/pdf', sizeBytes: 12, checksum });
    const mismatchIntent = await prisma.submissionAsset.findUniqueOrThrow({ where: { id: mismatchSigned.intentId } }); const wrongBytes = new Uint8Array(12).fill(9);
    if (!mismatchIntent.answerId) throw new Error('real-db-fixture-answer-missing');
    store.put({ key: mismatchSigned.key, ownerId: studentId, answerId: mismatchIntent.answerId, sizeBytes: 12, mimeType: 'application/pdf', checksum, scanState: 'PENDING' }); store.payloads.set(mismatchSigned.key, wrongBytes);
    const mismatchResult = await runSubmissionScanBatch(prisma, new LocalSubmissionObjectScanner(store), { async healthCheck() {}, async scan() { return 'CLEAN' as const; } }); expect(mismatchResult.unsafe).toBe(1);
    await expect(prisma.submissionAsset.findUniqueOrThrow({ where: { id: mismatchIntent.id } })).resolves.toMatchObject({ state: 'REVOKED', scanState: 'UNSAFE', lastScanErrorCode: 'integrity-mismatch' });
    expect(await prisma.submissionObjectTombstone.count({ where: { objectKey: mismatchSigned.key, reason: 'scanner-integrity-mismatch' } })).toBe(1);
    const transientSigned = await signQuestionUpload(prisma, store, { studentId, assignmentId, questionId: fileQuestionId, fileName: 'transient.pdf', mimeType: 'application/pdf', sizeBytes: 12, checksum });
    expect((await PUT_LOCAL_UPLOAD(new Request(transientSigned.url, { method: 'PUT', headers: transientSigned.requiredHeaders, body: uploadedBytes }))).status).toBe(204);
    const failingScanner = { async healthCheck() {}, async scan(): Promise<'CLEAN'> { throw new Error('provider secret detail must not persist'); } };
    for (let retry = 0; retry < 3; retry += 1) { if (retry > 0) await prisma.submissionAsset.update({ where: { id: transientSigned.intentId }, data: { nextScanAt: new Date(Date.now() - 1) } }); await runSubmissionScanBatch(prisma, new LocalSubmissionObjectScanner(store), failingScanner, 1); }
    const transient = await prisma.submissionAsset.findUniqueOrThrow({ where: { id: transientSigned.intentId } }); expect(transient).toMatchObject({ state: 'REVOKED', scanState: 'FAILED', scanRetryCount: 3, lastScanErrorCode: 'scanner-transient', nextScanAt: null }); expect(transient.lastScanErrorCode).not.toContain('provider');
    const expiredMissing = await signQuestionUpload(prisma, store, { studentId, assignmentId, questionId: fileQuestionId, fileName: 'expired-missing.pdf', mimeType: 'application/pdf', sizeBytes: 12, checksum });
    await prisma.submissionAsset.update({ where: { id: expiredMissing.intentId }, data: { quarantineExpiresAt: new Date(Date.now() - 1), nextScanAt: new Date(Date.now() - 1), createdAt: new Date(Date.now() - 48 * 3_600_000) } });
    await runSubmissionScanBatch(prisma, new LocalSubmissionObjectScanner(store), { async healthCheck() {}, async scan() { return 'CLEAN' as const; } });
    await expect(prisma.submissionAsset.findUniqueOrThrow({ where: { id: expiredMissing.intentId } })).resolves.toMatchObject({ state: 'REVOKED', scanState: 'EXPIRED', lastScanErrorCode: 'object-not-ready' });
    expect(await prisma.submissionObjectTombstone.count({ where: { objectKey: expiredMissing.key, reason: 'upload-intent-expired' } })).toBe(1);
    await garbageCollectQuarantine(prisma, store, new Date(Date.now() - 24 * 3_600_000)); await expect(prisma.submissionAsset.findUniqueOrThrow({ where: { id: expiredMissing.intentId } })).resolves.toMatchObject({ state: 'DELETED', scanState: 'EXPIRED' });
    await prisma.submissionAsset.update({ where: { id: raceIntent.id }, data: { createdAt: new Date(Date.now() - 48 * 3_600_000) } });
    const [raceFinalize] = await Promise.allSettled([
      finalizeQuestionAsset(prisma, store, { studentId, assignmentId, questionId: fileQuestionId, intentId: raceSigned.intentId, idempotencyKey: 'finalize-gc-race-0001' }),
      garbageCollectQuarantine(prisma, store, new Date(Date.now() - 24 * 3_600_000)),
    ]);
    const raceRow = await prisma.submissionAsset.findUniqueOrThrow({ where: { id: raceIntent.id } });
    expect(['FINALIZED', 'DELETED']).toContain(raceRow.state);
    expect((await prisma.submissionObjectTombstone.count({ where: { objectKey: raceSigned.key } })) > 0).toBe(raceRow.state === 'DELETED');
    expect(raceFinalize.status === 'fulfilled').toBe(raceRow.state === 'FINALIZED');
    const cleanResponse = await GET_FINALIZE_ROUTE(new Request(`https://assignment902.test/api/student/assignments/${assignmentId}/answers/${fileQuestionId}/finalize?intentId=${signed.intentId}`), finalizeContext) as Response;
    expect(cleanResponse.status).toBe(200); await expect(cleanResponse.json()).resolves.toEqual({ status: 'CLEAN', intentId: signed.intentId });
    const readyRequest = () => new Request(`https://assignment902.test/api/student/assignments/${assignmentId}/answers/${fileQuestionId}/finalize`, { method: 'POST', headers: { origin: 'https://assignment902.test', 'content-type': 'application/json' }, body: JSON.stringify({ intentId: signed.intentId, idempotencyKey: 'finalize-902-file-0001' }) });
    const readyResponse = await FINALIZE_ROUTE(readyRequest(), finalizeContext) as Response; expect(readyResponse.status).toBe(200); const ready = await readyResponse.json() as { status: 'READY'; asset: { id: string } }; expect(ready.status).toBe('READY');
    const replayResponse = await FINALIZE_ROUTE(readyRequest(), finalizeContext) as Response; expect(replayResponse.status).toBe(200); await expect(replayResponse.json()).resolves.toMatchObject({ status: 'READY', asset: { id: ready.asset.id } });
    await expect(getQuestionUploadStatus(prisma, { studentId, assignmentId, questionId: fileQuestionId, intentId: signed.intentId })).resolves.toMatchObject({ status: 'READY' });
    await expect(signSubmissionAssetRead(prisma, { studentId, assignmentId: 'wrong-assignment', questionId: fileQuestionId, assetId: ready.asset.id })).rejects.toMatchObject({ code: 'asset-read-forbidden' });
    await expect(signSubmissionAssetRead(prisma, { studentId: otherStudentId, assignmentId, questionId: fileQuestionId, assetId: ready.asset.id })).rejects.toMatchObject({ code: 'asset-read-forbidden' });
    const access = await signSubmissionAssetRead(prisma, { studentId, assignmentId, questionId: fileQuestionId, assetId: ready.asset.id }); const token = new URL(access.url).searchParams.get('token')!;
    await expect(consumeSubmissionAssetRead(prisma, { studentId, assignmentId, questionId: fileQuestionId, assetId: ready.asset.id, token })).resolves.toMatchObject({ objectKey: signed.key, displayName: 'q2.pdf' });
    await expect(consumeSubmissionAssetRead(prisma, { studentId, assignmentId, questionId: fileQuestionId, assetId: ready.asset.id, token })).rejects.toMatchObject({ code: 'asset-access-token-invalid' });
    const routeContext = { params: Promise.resolve({ assignmentId, questionId: fileQuestionId, assetId: ready.asset.id }) };
    const issueResponse = await CREATE_ASSET_ACCESS(new Request(`https://assignment902.test/api/student/assignments/${assignmentId}/answers/${fileQuestionId}/assets/${ready.asset.id}/read`, { method: 'POST', headers: { origin: 'https://assignment902.test' } }), routeContext) as Response;
    expect(issueResponse.status).toBe(200); const routeAccess = (await issueResponse.json()).access as { url: string };
    const download = await GET_ASSET(new Request(routeAccess.url), routeContext) as Response; expect(download.status).toBe(200); expect(download.headers.get('content-type')).toBe('application/pdf'); expect(download.headers.get('content-disposition')).toContain('q2.pdf'); expect(download.headers.get('x-content-type-options')).toBe('nosniff'); expect(download.headers.get('cache-control')).toBe('private, no-store');
    expect(((await GET_ASSET(new Request(routeAccess.url), routeContext)) as Response).status).toBe(403);
    const unsafeSigned = await signQuestionUpload(prisma, store, { studentId, assignmentId, questionId: fileQuestionId, fileName: 'unsafe.pdf', mimeType: 'application/pdf', sizeBytes: 12, checksum });
    expect((await PUT_LOCAL_UPLOAD(new Request(unsafeSigned.url, { method: 'PUT', headers: unsafeSigned.requiredHeaders, body: uploadedBytes }))).status).toBe(204);
    await runSubmissionScanBatch(prisma, new LocalSubmissionObjectScanner(store), { async healthCheck() {}, async scan() { return 'UNSAFE' as const; } });
    await expect(getQuestionUploadStatus(prisma, { studentId, assignmentId, questionId: fileQuestionId, intentId: unsafeSigned.intentId })).resolves.toMatchObject({ status: 'UNSAFE' });
    await expect(finalizeQuestionAsset(prisma, store, { studentId, assignmentId, questionId: fileQuestionId, intentId: unsafeSigned.intentId, idempotencyKey: 'finalize-unsafe-0001' })).resolves.toMatchObject({ status: 'UNSAFE' });
    const expiredSigned = await signQuestionUpload(prisma, store, { studentId, assignmentId, questionId: fileQuestionId, fileName: 'expired.pdf', mimeType: 'application/pdf', sizeBytes: 12, checksum });
    await prisma.submissionAsset.update({ where: { id: expiredSigned.intentId }, data: { quarantineExpiresAt: new Date(Date.now() - 1) } });
    await expect(getQuestionUploadStatus(prisma, { studentId, assignmentId, questionId: fileQuestionId, intentId: expiredSigned.intentId })).resolves.toMatchObject({ status: 'EXPIRED' });
    await expect(finalizeQuestionAsset(prisma, store, { studentId, assignmentId, questionId: fileQuestionId, intentId: expiredSigned.intentId, idempotencyKey: 'finalize-expired-0001' })).resolves.toMatchObject({ status: 'EXPIRED' });
    const text = await prisma.submissionAnswer.findFirstOrThrow({ where: { submission: { studentId }, assignmentQuestionId: textQuestionId } });
    const [submitLeft, submitRight] = await Promise.all([
      submitQuestionAnswer(prisma, { studentId, assignmentId, questionId: textQuestionId, answerVersion: text.version, idempotencyKey: 'submit-902-text-0001' }),
      submitQuestionAnswer(prisma, { studentId, assignmentId, questionId: textQuestionId, answerVersion: text.version, idempotencyKey: 'submit-902-text-0001' }),
    ]);
    expect(submitLeft.attempt?.id).toBe(submitRight.attempt?.id); expect(submitLeft.aggregate.state).toBe('IN_PROGRESS');
    const file = await prisma.submissionAnswer.findFirstOrThrow({ where: { submission: { studentId }, assignmentQuestionId: fileQuestionId } });
    const final = await submitQuestionAnswer(prisma, { studentId, assignmentId, questionId: fileQuestionId, answerVersion: file.version, idempotencyKey: 'submit-902-file-0001' });
    expect(final.aggregate).toMatchObject({ state: 'SUBMITTED', submittedRequiredCount: 2, requiredQuestionCount: 2 });
  });

  it('preserves the exact historical revision after class leave and a newer publication', async () => {
    await prisma.studentProfile.update({ where: { userId: studentId }, data: { classId: null } });
    await prisma.assignmentRevision.create({ data: { assignmentId, revisionNumber: 2, state: 'PUBLISHED', title: '新版本', instructions: '不应遮蔽历史', totalPoints: 1, latePolicy: { version: 1, mode: 'CLOSED' }, responsePolicy: { version: 1, allowedResponseTypes: ['SUBJECTIVE_TEXT'] }, resubmissionPolicy: { version: 1, maxAttempts: 1, untilDueAt: true }, solutionReleasePolicy: { version: 1, mode: 'PRIVATE' }, publishedAt: new Date(), frozenAt: new Date(), questions: { create: question('q-new', 0, 'SUBJECTIVE_TEXT') }, audiences: { create: { classId, availableAt: new Date(), dueAt: new Date(Date.now() + 3_600_000) } } } });
    const detail = await getStudentAssignment(prisma, studentId, assignmentId);
    expect(detail.title).toBe('逐题作业'); expect(detail.contextStatus).toBe('HISTORICAL'); expect(detail.canMutate).toBe(false);
    await prisma.studentProfile.update({ where: { userId: studentId }, data: { classId } });
    await expect(getStudentAssignment(prisma, studentId, assignmentId)).resolves.toMatchObject({ title: '新版本', contextStatus: 'CURRENT' });
    await expect(getStudentAssignment(prisma, studentId, assignmentId, new Date(), firstRevisionId)).resolves.toMatchObject({ title: '逐题作业', revisionId: firstRevisionId, contextStatus: 'HISTORICAL', canMutate: false });
  });

  it('rejects closed deadlines without creating another question mutation', async () => {
    const audience = await prisma.assignmentAudience.findFirstOrThrow({ where: { revision: { assignmentId, revisionNumber: 2 } } });
    await prisma.assignmentAudience.update({ where: { id: audience.id }, data: { availableAt: new Date(Date.now() - 120_000), dueAt: new Date(Date.now() - 60_000) } });
    await prisma.studentProfile.update({ where: { userId: otherStudentId }, data: { classId } });
    const newQuestion = await prisma.assignmentQuestion.findFirstOrThrow({ where: { assignmentRevisionId: audience.assignmentRevisionId } });
    await expect(saveQuestionDraft(prisma, { studentId: otherStudentId, assignmentId, questionId: newQuestion.id, version: 1, text: 'late' })).rejects.toMatchObject({ code: 'assignment-deadline-closed' });
    expect(await prisma.assignmentSubmission.count({ where: { studentId: otherStudentId, assignmentRevisionId: audience.assignmentRevisionId } })).toBe(0);
  });

});

function question(stableQuestionId: string, orderIndex: number, responseType: string) { return { stableQuestionId, orderIndex, responseType, points: 1, promptSnapshot: { text: stableQuestionId }, answerSnapshot: { text: 'secret' }, rubricSnapshot: { schemaVersion: 'test' }, sourceFamily: 'MANUAL' as const, sourceHash: `sha256:${stableQuestionId.padEnd(64, '0').slice(0, 64)}`, sourceReviewState: 'authored', sourceLineage: {}, contentHash: `sha256:${stableQuestionId.padEnd(64, '1').slice(0, 64)}` }; }
function assertTemporarySchema(value: string) { if (!/^assignment902_it_[a-zA-Z0-9_]+$/.test(value) || value === 'public') throw new Error('unsafe-submission-test-schema'); }
