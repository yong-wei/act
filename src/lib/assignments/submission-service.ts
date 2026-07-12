import type { PrismaClient } from '@prisma/client';
import { createHash, randomBytes } from 'node:crypto';

import { assertDeliveryWindow, deriveAggregate, mayReadSubmission, opaqueObjectKey, SubmissionError, submissionHash } from './submission-domain';
import type { SubmissionObjectStore } from './submission-object-store';
import { deriveStudentAssignmentPresentation, safePromptText, type StudentAssignmentDto } from './submission-dto';

export async function listStudentAssignments(prisma: PrismaClient, studentId: string, now = new Date()) {
  const profile = await prisma.studentProfile.findUnique({ where: { userId: studentId }, select: { classId: true } });
  const currentClassId = profile?.classId ?? null;
  const revisions = currentClassId ? await prisma.assignmentRevision.findMany({
    where: { state: 'PUBLISHED', audiences: { some: { classId: currentClassId, archivedAt: null, availableAt: { lte: now }, class: { isActive: true } } } },
    include: { audiences: { where: { classId: currentClassId, archivedAt: null }, take: 1 }, questions: { orderBy: { orderIndex: 'asc' } }, submissions: { where: { studentId }, include: { answers: true }, take: 1 } },
    orderBy: { publishedAt: 'desc' },
  }) : [];
  const historical = await prisma.assignmentSubmission.findMany({
    where: { studentId, answers: { some: { attempts: { some: {} } } }, revision: { id: { notIn: revisions.map((revision) => revision.id) }, historicalOwnerships: { some: { studentId, anonymizedAt: null } } } },
    include: { revision: { include: { questions: { orderBy: { orderIndex: 'asc' } } } }, audience: true, answers: true },
  });
  return [...revisions.map((revision) => presentRevision(revision, revision.audiences[0], revision.submissions[0], true, now)), ...historical.map((item) => presentRevision(item.revision, item.audience, item, false, now))];
}

export async function getStudentAssignment(prisma: PrismaClient, studentId: string, assignmentId: string, now = new Date()) {
  const profile = await prisma.studentProfile.findUnique({ where: { userId: studentId }, select: { classId: true } });
  const revision = profile?.classId ? await prisma.assignmentRevision.findFirst({ where: { assignmentId, state: 'PUBLISHED', audiences: { some: { classId: profile.classId, archivedAt: null, class: { isActive: true } } } }, orderBy: { revisionNumber: 'desc' }, include: { audiences: true, questions: { orderBy: { orderIndex: 'asc' } }, submissions: { where: { studentId }, include: { answers: { include: { attempts: { orderBy: { attemptNumber: 'desc' }, include: { assets: true } }, assets: { orderBy: { version: 'desc' } } } } }, take: 1 } } }) : null;
  if (!revision) {
    const historical = await prisma.assignmentSubmission.findFirst({ where: { studentId, revision: { assignmentId }, answers: { some: { attempts: { some: {} } } } }, orderBy: { updatedAt: 'desc' }, include: { audience: true, revision: { include: { questions: { orderBy: { orderIndex: 'asc' } }, historicalOwnerships: { where: { studentId }, take: 1 } } }, answers: { include: { attempts: { orderBy: { attemptNumber: 'desc' }, include: { assets: true } }, assets: { orderBy: { version: 'desc' } } } } } });
    const ownership = historical?.revision.historicalOwnerships[0];
    if (!historical || !ownership || ownership.anonymizedAt || historical.frozenStudentId !== studentId || historical.frozenAudienceClassId !== historical.audience.classId || ownership.audienceClassId !== historical.frozenAudienceClassId) throw new SubmissionError('assignment-not-found', 404);
    return presentRevision({ ...historical.revision, submissions: [historical] }, historical.audience, historical, false, now);
  }
  const submission = revision.submissions[0];
  const audience = revision.audiences.find((candidate) => candidate.classId === profile?.classId) ?? revision.audiences.find((candidate) => candidate.id === submission?.audienceId);
  if (!audience || !mayReadSubmission({ currentClassId: profile?.classId, audienceClassId: audience.classId, studentId, ownerStudentId: submission?.studentId ?? studentId, hasSubmittedAttempt: submission?.answers.some((answer) => answer.attempts.length > 0) ?? false })) throw new SubmissionError('assignment-forbidden', 403);
  if (!submission) assertDeliveryWindow({ now, availableAt: audience.availableAt, dueAt: audience.dueAt, latePolicy: revision.latePolicy as never });
  return presentRevision(revision, audience, submission, audience.classId === profile?.classId && !audience.archivedAt, now);
}

export async function saveQuestionDraft(prisma: PrismaClient, input: { studentId: string; assignmentId: string; questionId: string; version: number; text: string; now?: Date }) {
  return prisma.$transaction(async (tx) => {
    const context = await requireMutableQuestion(tx as never, input, input.now ?? new Date());
    const answer = context.answer ?? await tx.submissionAnswer.create({ data: { submissionId: context.submission.id, assignmentQuestionId: context.question.id, responseType: context.question.responseType, textDraft: '', state: 'DRAFT' } });
    if (answer.state === 'SUBMITTED') throw new SubmissionError('answer-already-submitted', 409);
    if (answer.version !== input.version) throw new SubmissionError('answer-version-conflict', 409);
    return tx.submissionAnswer.update({ where: { id: answer.id }, data: { textDraft: input.text, state: input.text.trim() ? 'READY' : 'DRAFT', version: { increment: 1 } } });
  });
}

export async function signQuestionUpload(prisma: PrismaClient, store: SubmissionObjectStore, input: { studentId: string; assignmentId: string; questionId: string; fileName: string; mimeType: string; sizeBytes: number; checksum: string; now?: Date }) {
  const key = opaqueObjectKey();
  const { answer } = await withSerializableRetry(() => prisma.$transaction(async (tx) => {
    const context = await requireMutableQuestion(tx as never, input, input.now ?? new Date());
    if (context.question.responseType !== 'SUBJECTIVE_FILE') throw new SubmissionError('question-does-not-accept-file');
    const answer = await tx.submissionAnswer.upsert({ where: { submissionId_assignmentQuestionId: { submissionId: context.submission.id, assignmentQuestionId: context.question.id } }, create: { submissionId: context.submission.id, assignmentQuestionId: context.question.id, responseType: context.question.responseType, state: 'DRAFT' }, update: {} });
    const version = (await tx.submissionAsset.aggregate({ where: { answerId: answer.id }, _max: { version: true } }))._max.version ?? 0;
    await tx.submissionAsset.create({ data: { answerId: answer.id, version: version + 1, objectKey: key, originalName: input.fileName, mimeType: input.mimeType, sizeBytes: input.sizeBytes, checksum: input.checksum, state: 'QUARANTINED', scanState: 'PENDING', quarantineExpiresAt: new Date(Date.now() + 600_000) } });
    return { answer };
  }, { isolationLevel: 'Serializable' }));
  await store.healthCheck();
  const signed = await store.signUpload({ ownerId: input.studentId, answerId: answer.id, sizeBytes: input.sizeBytes, mimeType: input.mimeType, checksum: input.checksum }, 600, key);
  await prisma.submissionAsset.update({ where: { objectKey: key }, data: { quarantineExpiresAt: new Date(signed.expiresAt) } });
  return { intentId: (await prisma.submissionAsset.findUniqueOrThrow({ where: { objectKey: key }, select: { id: true } })).id, ...signed };
}

export async function finalizeQuestionAsset(prisma: PrismaClient, store: SubmissionObjectStore, input: { studentId: string; assignmentId: string; questionId: string; intentId: string; idempotencyKey: string; now?: Date }) {
  const context = await prisma.$transaction((tx) => requireMutableQuestion(tx as never, input, input.now ?? new Date()));
  if (!context.answer) throw new SubmissionError('answer-not-found', 404);
  const replay = await prisma.submissionAsset.findUnique({ where: { finalizationKey: `${input.studentId}:${input.idempotencyKey}` } });
  if (replay) { if (replay.id !== input.intentId || replay.answerId !== context.answer.id) throw new SubmissionError('idempotency-key-conflict', 409); return { status: 'READY' as const, asset: replay }; }
  const existing = await prisma.submissionAsset.findUnique({ where: { id: input.intentId } });
  if (!existing || existing.answerId !== context.answer.id) throw new SubmissionError('upload-intent-not-found', 404);
  if (existing.state === 'FINALIZED') throw new SubmissionError('asset-already-finalized-with-another-key', 409);
  if (existing.scanState === 'EXPIRED' || !existing.quarantineExpiresAt || existing.quarantineExpiresAt < (input.now ?? new Date())) return { status: 'EXPIRED' as const, intentId: existing.id };
  if (existing.scanState === 'FAILED' || existing.scanState === 'MISSING') return { status: 'FAILED' as const, intentId: existing.id };
  if (existing.state === 'REVOKED' || existing.scanState === 'UNSAFE') return { status: 'UNSAFE' as const, intentId: existing.id };
  if (existing.state !== 'QUARANTINED') throw new SubmissionError('asset-not-finalizable', 409);
  const metadata = await store.head(existing.objectKey);
  if (!metadata || metadata.scanState === 'PENDING') return { status: 'SCANNING' as const, intentId: existing.id };
  if (metadata.scanState === 'UNSAFE') { await prisma.submissionAsset.updateMany({ where: { id: existing.id, state: 'QUARANTINED' }, data: { state: 'REVOKED', scanState: 'UNSAFE' } }); return { status: 'UNSAFE' as const, intentId: existing.id }; }
  if (metadata.ownerId !== input.studentId || metadata.answerId !== context.answer.id || metadata.sizeBytes !== existing.sizeBytes || metadata.mimeType !== existing.mimeType || metadata.checksum !== existing.checksum) throw new SubmissionError('asset-finalization-verification-failed', 409);
  return withSerializableRetry(() => prisma.$transaction(async (tx) => {
    const locked = await tx.submissionAsset.findUniqueOrThrow({ where: { id: existing.id } });
    if (locked.state === 'FINALIZED' && locked.finalizationKey === `${input.studentId}:${input.idempotencyKey}`) return { status: 'READY' as const, asset: locked };
    if (locked.state !== 'QUARANTINED') throw new SubmissionError('asset-not-finalizable', 409);
    await tx.submissionAsset.updateMany({ where: { answerId: context.answer!.id, state: 'FINALIZED', attemptId: null }, data: { state: 'REVOKED' } });
    const finalized = await tx.submissionAsset.update({ where: { id: existing.id }, data: { scanState: metadata.scanState, state: 'FINALIZED', finalizationKey: `${input.studentId}:${input.idempotencyKey}`, finalizedAt: new Date() } });
    await tx.submissionAnswer.update({ where: { id: context.answer!.id }, data: { state: 'READY' } });
    return { status: 'READY' as const, asset: finalized };
  }, { isolationLevel: 'Serializable' }));
}

export async function getQuestionUploadStatus(prisma: PrismaClient, input: { studentId: string; assignmentId: string; questionId: string; intentId: string; now?: Date }) {
  const context = await requireMutableQuestion(prisma, input, input.now ?? new Date());
  const asset = await prisma.submissionAsset.findUnique({ where: { id: input.intentId } });
  if (!context.answer || !asset || asset.answerId !== context.answer.id) throw new SubmissionError('upload-intent-not-found', 404);
  if (asset.state === 'FINALIZED') return { status: 'READY' as const, intentId: asset.id, asset };
  if (asset.scanState === 'EXPIRED' || !asset.quarantineExpiresAt || asset.quarantineExpiresAt < (input.now ?? new Date())) return { status: 'EXPIRED' as const, intentId: asset.id };
  if (asset.scanState === 'FAILED' || asset.scanState === 'MISSING') return { status: 'FAILED' as const, intentId: asset.id };
  if (asset.state === 'REVOKED' || asset.scanState === 'UNSAFE') return { status: 'UNSAFE' as const, intentId: asset.id };
  if (asset.state === 'QUARANTINED' && asset.scanState === 'CLEAN') return { status: 'CLEAN' as const, intentId: asset.id };
  return { status: 'SCANNING' as const, intentId: asset.id };
}

export async function garbageCollectQuarantine(prisma: PrismaClient, store: SubmissionObjectStore, olderThan: Date) {
  const abandoned = await prisma.submissionAsset.findMany({ where: { state: { in: ['QUARANTINED', 'REVOKED'] }, createdAt: { lt: olderThan } } });
  let deleted = 0; let failed = 0;
  for (const asset of abandoned) {
    const claim = await prisma.submissionAsset.updateMany({ where: { id: asset.id, state: asset.state, createdAt: { lt: olderThan } }, data: { state: 'DELETING' } });
    if (claim.count !== 1) continue;
    try {
      await store.delete(asset.objectKey);
      await prisma.$transaction(async (tx) => {
        await tx.submissionObjectTombstone.upsert({ where: { objectKey: asset.objectKey }, create: { objectKey: asset.objectKey, reason: asset.state === 'REVOKED' ? 'draft-replaced' : 'quarantine-expired', checksum: asset.checksum }, update: {} });
        const completed = await tx.submissionAsset.updateMany({ where: { id: asset.id, state: 'DELETING' }, data: { state: 'DELETED' } });
        if (completed.count !== 1) throw new SubmissionError('gc-claim-lost', 409);
      });
      deleted += 1;
    } catch {
      failed += 1;
      await prisma.submissionAsset.updateMany({ where: { id: asset.id, state: 'DELETING' }, data: { state: asset.state } });
    }
  }
  return { claimed: deleted + failed, deleted, failed };
}

export async function signSubmissionAssetRead(prisma: PrismaClient, input: { studentId: string; assignmentId: string; questionId: string; assetId: string }) {
  const asset = await prisma.submissionAsset.findUnique({ where: { id: input.assetId }, include: { answer: { include: { attempts: true, submission: { include: { student: { include: { profile: true } } } }, question: { include: { revision: { select: { assignmentId: true } } } } } } } });
  if (!asset || asset.state !== 'FINALIZED' || asset.answer.assignmentQuestionId !== input.questionId || asset.answer.question.assignmentRevisionId !== asset.answer.submission.assignmentRevisionId || asset.answer.question.revision?.assignmentId !== input.assignmentId || asset.answer.submission.studentId !== input.studentId || !mayReadSubmission({ currentClassId: asset.answer.submission.student.profile?.classId, audienceClassId: asset.answer.submission.frozenAudienceClassId, studentId: input.studentId, ownerStudentId: asset.answer.submission.frozenStudentId, hasSubmittedAttempt: asset.answer.attempts.length > 0 })) throw new SubmissionError('asset-read-forbidden', 403);
  const token = randomBytes(32).toString('base64url'); const expiresAt = new Date(Date.now() + 5 * 60_000);
  await prisma.submissionAssetAccessToken.create({ data: { tokenHash: createHash('sha256').update(token).digest('hex'), assetId: asset.id, studentId: input.studentId, purpose: 'submission-source-download', expiresAt } });
  const origin = process.env.NEXTAUTH_URL ?? 'http://localhost:3000';
  return { url: `${origin}/api/student/assignments/${encodeURIComponent(input.assignmentId)}/answers/${encodeURIComponent(input.questionId)}/assets/${encodeURIComponent(input.assetId)}/read?token=${encodeURIComponent(token)}`, expiresAt: expiresAt.toISOString() };
}

export async function consumeSubmissionAssetRead(prisma: PrismaClient, input: { studentId: string; assignmentId: string; questionId: string; assetId: string; token: string }) {
  const tokenHash = createHash('sha256').update(input.token).digest('hex'); const now = new Date();
  const claimed = await prisma.submissionAssetAccessToken.updateMany({ where: { tokenHash, assetId: input.assetId, studentId: input.studentId, purpose: 'submission-source-download', expiresAt: { gt: now }, usedAt: null }, data: { usedAt: now } });
  if (claimed.count !== 1) throw new SubmissionError('asset-access-token-invalid', 403);
  const asset = await prisma.submissionAsset.findUnique({ where: { id: input.assetId }, include: { answer: { include: { attempts: true, submission: { include: { student: { include: { profile: true } } } }, question: { include: { revision: { select: { assignmentId: true } } } } } } } });
  if (!asset || asset.state !== 'FINALIZED' || asset.answer.assignmentQuestionId !== input.questionId || asset.answer.question.revision.assignmentId !== input.assignmentId || asset.answer.submission.studentId !== input.studentId || !mayReadSubmission({ currentClassId: asset.answer.submission.student.profile?.classId, audienceClassId: asset.answer.submission.frozenAudienceClassId, studentId: input.studentId, ownerStudentId: asset.answer.submission.frozenStudentId, hasSubmittedAttempt: asset.answer.attempts.length > 0 })) throw new SubmissionError('asset-read-forbidden', 403);
  return { objectKey: asset.objectKey, displayName: asset.originalName, mimeType: asset.mimeType, sizeBytes: asset.sizeBytes, checksum: asset.checksum };
}

export async function submitQuestionAnswer(prisma: PrismaClient, input: { studentId: string; assignmentId: string; questionId: string; answerVersion: number; idempotencyKey: string; now?: Date }) {
  return withSerializableRetry(() => prisma.$transaction(async (tx) => {
    const now = input.now ?? new Date(); const context = await requireMutableQuestion(tx as never, input, now);
    if (!context.answer) throw new SubmissionError('answer-not-ready', 409);
    const scope = `submit:${context.answer.id}`; const requestHash = submissionHash({ answerVersion: input.answerVersion });
    const replay = await tx.submissionIdempotency.findUnique({ where: { studentId_scope_idempotencyKey: { studentId: input.studentId, scope, idempotencyKey: input.idempotencyKey } }, include: { attempt: true } });
    if (replay) { if (replay.requestHash !== requestHash) throw new SubmissionError('idempotency-key-conflict', 409); return { attempt: replay.attempt, aggregate: await aggregateAndUpdate(tx as never, context.submission.id) }; }
    if (context.answer.state === 'SUBMITTED' || context.answer.version !== input.answerVersion) throw new SubmissionError('answer-version-conflict', 409);
    if (context.question.responseType === 'SUBJECTIVE_TEXT' && !context.answer.textDraft?.trim()) throw new SubmissionError('text-answer-required', 409);
    const assets = await tx.submissionAsset.findMany({ where: { answerId: context.answer.id, state: 'FINALIZED', attemptId: null }, orderBy: { version: 'desc' }, take: 1 });
    if (context.question.responseType === 'SUBJECTIVE_FILE' && assets.length === 0) throw new SubmissionError('finalized-asset-required', 409);
    const attemptNumber = context.answer.currentAttemptNumber + 1;
    const attempt = await tx.submissionAttempt.create({ data: { answerId: context.answer.id, attemptNumber, answerVersion: context.answer.version, textSnapshot: context.answer.textDraft } });
    await tx.submissionAsset.updateMany({ where: { id: { in: assets.map((asset) => asset.id) } }, data: { attemptId: attempt.id } });
    await tx.submissionAnswer.update({ where: { id: context.answer.id }, data: { state: 'SUBMITTED', currentAttemptNumber: attemptNumber } });
    await tx.submissionIdempotency.create({ data: { studentId: input.studentId, scope, idempotencyKey: input.idempotencyKey, requestHash, attemptId: attempt.id } });
    return { attempt, aggregate: await aggregateAndUpdate(tx as never, context.submission.id) };
  }, { isolationLevel: 'Serializable' }));
}

async function requireMutableQuestion(prisma: PrismaClient, input: { studentId: string; assignmentId: string; questionId: string }, now: Date) {
  const revision = await prisma.assignmentRevision.findFirst({ where: { assignmentId: input.assignmentId, state: 'PUBLISHED', questions: { some: { id: input.questionId } } }, include: { audiences: { include: { class: { select: { isActive: true } } } }, questions: { where: { id: input.questionId } } } });
  const profile = await prisma.studentProfile.findUnique({ where: { userId: input.studentId }, select: { classId: true } });
  const audience = revision?.audiences.find((candidate) => candidate.classId === profile?.classId && candidate.class.isActive && !candidate.archivedAt);
  if (!revision || !audience) throw new SubmissionError('assignment-forbidden', 403);
  assertDeliveryWindow({ now, availableAt: audience.availableAt, dueAt: audience.dueAt, latePolicy: revision.latePolicy as never });
  const submission = await prisma.assignmentSubmission.upsert({ where: { assignmentRevisionId_studentId: { assignmentRevisionId: revision.id, studentId: input.studentId } }, create: { assignmentRevisionId: revision.id, audienceId: audience.id, studentId: input.studentId, frozenStudentId: input.studentId, frozenAudienceClassId: audience.classId, requiredQuestionCount: await prisma.assignmentQuestion.count({ where: { assignmentRevisionId: revision.id } }) }, update: {} });
  await prisma.assignmentHistoricalOwnership.upsert({ where: { assignmentRevisionId_studentId: { assignmentRevisionId: revision.id, studentId: input.studentId } }, create: { assignmentRevisionId: revision.id, studentId: input.studentId, audienceClassId: audience.classId, assignedAt: now }, update: {} });
  const answer = await prisma.submissionAnswer.findUnique({ where: { submissionId_assignmentQuestionId: { submissionId: submission.id, assignmentQuestionId: input.questionId } } });
  return { revision, audience, submission, question: revision.questions[0], answer };
}

async function aggregateAndUpdate(prisma: PrismaClient, submissionId: string) {
  const answers = await prisma.submissionAnswer.findMany({ where: { submissionId }, select: { state: true } });
  const submission = await prisma.assignmentSubmission.findUniqueOrThrow({ where: { id: submissionId }, select: { requiredQuestionCount: true } });
  const aggregate = deriveAggregate([...answers, ...Array(Math.max(0, submission.requiredQuestionCount - answers.length)).fill({ state: 'NOT_STARTED' })]);
  await prisma.assignmentSubmission.update({ where: { id: submissionId }, data: { state: aggregate.state, submittedRequiredCount: aggregate.submittedRequiredCount } });
  return aggregate;
}

function presentRevision(revision: any, audience: any, submission: any, currentContext: boolean, now: Date): StudentAssignmentDto {
  const answers = new Map((submission?.answers ?? []).map((answer: any) => [answer.assignmentQuestionId, answer]));
  const historicalOnly = !currentContext;
  const persistedState = submission?.state ?? 'NOT_STARTED';
  const presentation = deriveStudentAssignmentPresentation({ persistedState, dueAt: audience.dueAt, now, lateClosed: (revision.latePolicy as { mode?: string })?.mode === 'CLOSED' });
  return { id: revision.assignmentId, revisionId: revision.id, title: revision.title, instructions: revision.instructions, availableAt: audience.availableAt, dueAt: audience.dueAt, ...presentation, contextStatus: historicalOnly ? 'HISTORICAL' : 'CURRENT', historicalOnly, canMutate: !historicalOnly && persistedState !== 'SUBMITTED' && presentation.state !== 'OVERDUE', submittedRequiredCount: submission?.submittedRequiredCount ?? 0, requiredQuestionCount: revision.questions.length, questions: revision.questions.map((question: any) => { const answer: any = answers.get(question.id); return { id: question.id, stableQuestionId: question.stableQuestionId, orderIndex: question.orderIndex, responseType: question.responseType, points: Number(question.points), promptText: safePromptText(question.promptSnapshot), state: answer?.state ?? 'NOT_STARTED', version: answer?.version ?? 1, currentAttemptNumber: answer?.currentAttemptNumber ?? 0, textDraft: answer?.textDraft ?? null, history: (answer?.attempts ?? []).map((attempt: any) => ({ id: attempt.id, attemptNumber: attempt.attemptNumber, submittedAt: attempt.submittedAt, textSnapshot: attempt.textSnapshot, assets: (attempt.assets ?? []).map((asset: any) => ({ id: asset.id, displayName: asset.originalName, mimeType: asset.mimeType, sizeBytes: asset.sizeBytes, canDownload: true as const })) })), assets: (answer?.assets ?? []).map((asset: any) => ({ id: asset.id, displayName: asset.originalName, mimeType: asset.mimeType, sizeBytes: asset.sizeBytes, state: asset.state, finalizedAt: asset.finalizedAt })) }; }) };
}

async function withSerializableRetry<T>(operation: () => Promise<T>, attempts = 3): Promise<T> {
  for (let attempt = 1; ; attempt += 1) {
    try { return await operation(); } catch (error) {
      const code = error && typeof error === 'object' && 'code' in error ? String((error as { code: unknown }).code) : '';
      if (attempt >= attempts || (code !== 'P2034' && code !== 'P2002')) throw error;
    }
  }
}
