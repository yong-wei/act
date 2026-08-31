import { sha256, stableStringify } from './math-document-grading-contracts';

import { presentStudentReferenceAnswer, presentStudentScoringStandard } from '@/lib/assignments/student-result-presentation';

export type AssignmentGradeActor = { id: string; role: 'TEACHER' | 'ADMIN' };

export class AssignmentSubmissionGradeError extends Error {
  constructor(public readonly code: string, public readonly status: number, public readonly details?: unknown) {
    super(code);
  }
}

export async function getAssignmentSubmissionGrade(db: any, input: {
  actor: AssignmentGradeActor;
  assignmentId: string;
  submissionId?: string;
  snapshotId: string;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const snapshot = await loadSnapshot(db, input.snapshotId);
  assertSnapshotScope(snapshot, input.assignmentId, input.submissionId);
  authorize(input.actor, snapshot, now);
  const grade = await ensureGrade(db, snapshot, now);
  return {
    grade,
    snapshot: { id: snapshot.id, attemptVectorHash: snapshot.attemptVectorHash, originalDueAt: snapshot.originalDueAt },
    questions: snapshot.items.map((item: any) => ({
      snapshotItemId: item.id,
      questionId: item.questionId,
      attemptId: item.attemptId,
      promptSnapshot: item.question.promptSnapshot,
      sourceHistory: (item.attempt?.gradingRuns ?? []).map((run: any) => ({ id: run.id, source: run.source, state: run.state, draftTotalScore: run.draftTotalScore, overallComment: run.overallComment, updatedAt: run.updatedAt })),
      approvalHistory: (item.attempt?.approvalSnapshots ?? []).map((approval: any) => ({
        id: approval.id,
        source: approval.gradingRun?.source ?? 'AI',
        questionTotal: approval.questionTotal,
        overallComment: approval.overallComment,
        approvedAt: approval.approvedAt,
        reviewedPdfId: (approval.reviewedDerivatives ?? []).find((derivative: any) => derivative.state === 'READY' && derivative.outputKind === 'REVIEWED_PDF')?.id ?? null,
      })),
    })),
  };
}

export async function refreshAssignmentSubmissionGrade(db: any, input: {
  actor: AssignmentGradeActor;
  assignmentId: string;
  snapshotId: string;
  submissionId?: string;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const snapshot = await loadSnapshot(db, input.snapshotId);
  assertSnapshotScope(snapshot, input.assignmentId, input.submissionId);
  authorize(input.actor, snapshot, now);
  assertDeadline(snapshot, now);
  const grade = await ensureGrade(db, snapshot, now);
  if (grade.state === 'CONFIRMED' || grade.state === 'RELEASED') {
    return {
      grade,
      aggregate: {
        complete: true,
        total: grade.totalScore == null ? null : Number(grade.totalScore),
        overallComment: grade.overallComment ?? null,
        questions: Array.isArray(grade.questionProjection) ? grade.questionProjection : [],
        blockers: [],
        state: grade.state,
      },
    };
  }
  const aggregate = deriveAggregate(snapshot, grade.conclusions ?? []);
  const updated = await db.assignmentSubmissionGrade.updateMany({
    where: {
      id: grade.id,
      version: grade.version,
      state: { in: ['PENDING_GRADING', 'PARTIAL_FAILURE', 'AWAITING_CONFIRMATION'] },
    },
    data: {
      version: { increment: 1 },
      state: aggregate.state,
      questionProjection: aggregate.questions,
      totalScore: aggregate.total,
      overallComment: aggregate.overallComment,
      updatedAt: now,
    },
  });
  if (updated?.count === 1) {
    return {
      grade: {
        ...grade,
        version: grade.version + 1,
        state: aggregate.state,
        questionProjection: aggregate.questions,
        totalScore: aggregate.total,
        overallComment: aggregate.overallComment,
        updatedAt: now,
      },
      aggregate,
    };
  }
  const current = await db.assignmentSubmissionGrade.findUnique({ where: { id: grade.id }, include: { confirmations: { orderBy: { version: 'desc' }, take: 1 }, conclusions: true } });
  if (current?.state === 'CONFIRMED' || current?.state === 'RELEASED') {
    return {
      grade: current,
      aggregate: {
        complete: true,
        total: current.totalScore == null ? null : Number(current.totalScore),
        overallComment: current.overallComment ?? null,
        questions: Array.isArray(current.questionProjection) ? current.questionProjection : [],
        blockers: [],
        state: current.state,
      },
    };
  }
  throw new AssignmentSubmissionGradeError('assignment-result-refresh-conflict', 409);
}

export async function recordAssignmentQuestionConclusion(db: any, input: {
  actor: AssignmentGradeActor;
  assignmentId: string;
  snapshotId: string;
  submissionId?: string;
  snapshotItemId: string;
  kind: 'UNANSWERED' | 'EXEMPT';
  scoreEffect: number;
  reason: string;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const snapshot = await loadSnapshot(db, input.snapshotId);
  assertSnapshotScope(snapshot, input.assignmentId, input.submissionId);
  authorize(input.actor, snapshot, now);
  assertDeadline(snapshot, now);
  const item = snapshot.items.find((row: any) => row.id === input.snapshotItemId);
  if (!item) throw new AssignmentSubmissionGradeError('assignment-result-snapshot-item-not-found', 404);
  if (!Number.isFinite(input.scoreEffect) || input.scoreEffect < 0 || input.scoreEffect > Number(item.question.points)) {
    throw new AssignmentSubmissionGradeError('assignment-result-conclusion-score-invalid', 422);
  }
  const grade = await ensureGrade(db, snapshot, now);
  if (grade.state === 'CONFIRMED' || grade.state === 'RELEASED') throw new AssignmentSubmissionGradeError('assignment-result-confirmation-conflict', 409);
  await db.assignmentQuestionConclusion.upsert({
    where: { gradeId_snapshotItemId: { gradeId: grade.id, snapshotItemId: item.id } },
    create: {
      id: `assignment-question-conclusion:${sha256(`${grade.id}:${item.id}`).slice(-32)}`,
      gradeId: grade.id,
      snapshotItemId: item.id,
      kind: input.kind,
      scoreEffect: input.scoreEffect,
      reason: input.reason,
      actorId: input.actor.id,
      authorizationSnapshot: authorizationSnapshot(input.actor, snapshot, now),
      createdAt: now,
      updatedAt: now,
    },
    update: { kind: input.kind, scoreEffect: input.scoreEffect, reason: input.reason, actorId: input.actor.id, authorizationSnapshot: authorizationSnapshot(input.actor, snapshot, now), updatedAt: now },
  });
  return refreshAssignmentSubmissionGrade(db, input);
}

export async function confirmAssignmentSubmissionGrade(db: any, input: {
  actor: AssignmentGradeActor;
  assignmentId: string;
  snapshotId: string;
  submissionId?: string;
  expectedVersion: number;
  idempotencyKey: string;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  return transaction(db, async (tx: any) => {
    const snapshot = await loadSnapshot(tx, input.snapshotId);
    assertSnapshotScope(snapshot, input.assignmentId, input.submissionId);
    authorize(input.actor, snapshot, now);
    assertDeadline(snapshot, now);
    const grade = await ensureGrade(tx, snapshot, now);
    const requestHash = sha256(stableStringify({ actorId: input.actor.id, expectedVersion: input.expectedVersion, snapshotId: input.snapshotId }));
    const replay = await tx.assignmentSubmissionGradeConfirmation.findUnique({ where: { gradeId_idempotencyKey: { gradeId: grade.id, idempotencyKey: input.idempotencyKey } } });
    if (replay) {
      if (replay.requestHash !== requestHash) throw new AssignmentSubmissionGradeError('assignment-result-confirmation-conflict', 409);
      return { confirmation: replay, replay: true };
    }
    if (grade.version !== input.expectedVersion || ['CONFIRMED', 'RELEASED'].includes(grade.state)) throw new AssignmentSubmissionGradeError('assignment-result-confirmation-conflict', 409);
    const aggregate = deriveAggregate(snapshot, grade.conclusions ?? []);
    if (!aggregate.complete || aggregate.total == null) throw new AssignmentSubmissionGradeError('assignment-result-incomplete', 409, { blockers: aggregate.blockers });
    const updated = await tx.assignmentSubmissionGrade.updateMany({
      where: { id: grade.id, version: input.expectedVersion, state: { in: ['PENDING_GRADING', 'PARTIAL_FAILURE', 'AWAITING_CONFIRMATION'] } },
      data: { version: { increment: 1 }, state: 'CONFIRMED', questionProjection: aggregate.questions, totalScore: aggregate.total, overallComment: aggregate.overallComment, confirmedById: input.actor.id, confirmedAt: now, updatedAt: now },
    });
    if (updated?.count !== 1) throw new AssignmentSubmissionGradeError('assignment-result-confirmation-conflict', 409);
    const confirmation = await tx.assignmentSubmissionGradeConfirmation.create({
      data: {
        id: `assignment-grade-confirmation:${sha256(`${grade.id}:${input.expectedVersion}:${requestHash}`).slice(-32)}`,
        gradeId: grade.id,
        version: input.expectedVersion + 1,
        idempotencyKey: input.idempotencyKey,
        requestHash,
        attemptVectorHash: snapshot.attemptVectorHash,
        totalScore: aggregate.total,
        overallComment: aggregate.overallComment,
        questionProjection: aggregate.questions,
        confirmedById: input.actor.id,
        confirmedAt: now,
        createdAt: now,
      },
    });
    return { confirmation, replay: false };
  });
}

export async function releaseAssignmentSubmissionGrade(db: any, input: {
  actor: AssignmentGradeActor;
  assignmentId: string;
  snapshotId: string;
  submissionId?: string;
  confirmationId: string;
  idempotencyKey: string;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const requestHash = sha256(stableStringify({ actorId: input.actor.id, snapshotId: input.snapshotId, confirmationId: input.confirmationId }));
  try {
    return await transaction(db, async (tx: any) => {
      const snapshot = await loadSnapshot(tx, input.snapshotId);
      assertSnapshotScope(snapshot, input.assignmentId, input.submissionId);
      authorize(input.actor, snapshot, now);
      if (snapshot.revision.solutionReleasePolicy?.mode !== 'TEACHER_CONFIRMED_RESULT') {
        throw new AssignmentSubmissionGradeError('assignment-result-release-policy-invalid', 409);
      }
      const grade = await ensureGrade(tx, snapshot, now);
      const existing = await tx.assignmentSubmissionGradeRelease.findUnique({ where: { gradeId: grade.id } });
      if (existing) {
        if (existing.confirmationId !== input.confirmationId
          || (existing.idempotencyKey === input.idempotencyKey && existing.requestHash !== requestHash)) {
          throw new AssignmentSubmissionGradeError('assignment-result-release-conflict', 409);
        }
        const confirmation = await tx.assignmentSubmissionGradeConfirmation.findFirst({ where: { id: existing.confirmationId, gradeId: grade.id } });
        await ensureFinalResultFeedbackReleases(tx, snapshot, confirmation, now);
        return { release: existing, replay: true };
      }
      if (grade.state !== 'CONFIRMED') throw new AssignmentSubmissionGradeError('assignment-result-unconfirmed', 409);
      const confirmation = await tx.assignmentSubmissionGradeConfirmation.findFirst({ where: { id: input.confirmationId, gradeId: grade.id } });
      if (!confirmation || confirmation.version !== grade.version) throw new AssignmentSubmissionGradeError('assignment-result-unconfirmed', 409);
      const released = await tx.assignmentSubmissionGrade.updateMany({
        where: { id: grade.id, version: grade.version, state: 'CONFIRMED' },
        data: { state: 'RELEASED', releasedAt: now, updatedAt: now },
      });
      if (released?.count !== 1) throw new AssignmentSubmissionGradeError('assignment-result-release-conflict', 409);
      const release = await tx.assignmentSubmissionGradeRelease.create({
        data: {
          id: `assignment-grade-release:${sha256(`${grade.id}:${confirmation.id}`).slice(-32)}`,
          gradeId: grade.id,
          confirmationId: confirmation.id,
          ownerStudentId: snapshot.submission.frozenStudentId,
          releasedById: input.actor.id,
          idempotencyKey: input.idempotencyKey,
          requestHash,
          packageSnapshot: studentResultPackage(confirmation, now),
          releasedAt: now,
          createdAt: now,
        },
      });
      await ensureFinalResultFeedbackReleases(tx, snapshot, confirmation, now);
      return { release, replay: false };
    });
  } catch (error) {
    if (!(error && typeof error === 'object' && (error as any).code === 'P2002')) throw error;
    const grade = await db.assignmentSubmissionGrade.findUnique({ where: { snapshotId: input.snapshotId } });
    const replay = grade ? await db.assignmentSubmissionGradeRelease.findUnique({ where: { gradeId: grade.id } }) : null;
    if (!replay) throw error;
    if (replay.requestHash !== requestHash || replay.confirmationId !== input.confirmationId) {
      throw new AssignmentSubmissionGradeError('assignment-result-release-conflict', 409);
    }
    return { release: replay, replay: true };
  }
}

async function ensureFinalResultFeedbackReleases(db: any, snapshot: any, confirmation: any, now: Date) {
  const approvalIds = [...new Set((Array.isArray(confirmation?.questionProjection) ? confirmation.questionProjection : [])
    .map((item: any) => item?.approvalSnapshotId).filter((value: unknown): value is string => typeof value === 'string' && value.length > 0))];
  if (approvalIds.length === 0) return;
  const approvals = await db.teacherAssignmentApprovalSnapshot.findMany({
    where: { id: { in: approvalIds }, submissionId: snapshot.submissionId },
    include: { reviewedDerivatives: { where: { state: 'READY', outputKind: 'REVIEWED_PDF' }, orderBy: { readyAt: 'desc' } } },
  });
  for (const approval of approvals) {
    const derivative = approval.reviewedDerivatives.find((row: any) => row.outputObjectKey && row.outputChecksum);
    if (!derivative) continue;
    await db.teacherAssignmentFeedbackRelease.upsert({
      where: { snapshotId: approval.id },
      create: {
        snapshotId: approval.id,
        derivativeId: derivative.id,
        mode: 'DERIVATIVE',
        ownerStudentId: snapshot.submission.frozenStudentId,
        idempotencyKey: `assignment-result-feedback:${snapshot.id}:${approval.id}:${derivative.id}`,
        authorizationSnapshot: approval.authorizationSnapshot,
        releasedAt: now,
      },
      update: {},
    });
  }
}

export async function returnAssignmentQuestionForResubmission(db: any, input: {
  actor: AssignmentGradeActor;
  assignmentId: string;
  submissionId?: string;
  snapshotId: string;
  snapshotItemId: string;
  reason: string;
  newDeadlineAt: Date;
  idempotencyKey: string;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  return transaction(db, async (tx: any) => {
    const snapshot = await loadSnapshot(tx, input.snapshotId);
    assertSnapshotScope(snapshot, input.assignmentId, input.submissionId);
    authorize(input.actor, snapshot, now);
    assertDeadline(snapshot, now);
    const grade = await ensureGrade(tx, snapshot, now);
    if (!['CONFIRMED', 'RELEASED'].includes(grade.state)) throw new AssignmentSubmissionGradeError('assignment-result-return-unconfirmed', 409);
    const item = snapshot.items.find((row: any) => row.id === input.snapshotItemId);
    const approval = [...(item?.attempt?.approvalSnapshots ?? [])]
      .sort((left: any, right: any) => new Date(right.approvedAt).getTime() - new Date(left.approvedAt).getTime())[0];
    if (!item?.answerId || !item.attemptId || !approval?.reviewId || !approval?.gradingRunId) {
      throw new AssignmentSubmissionGradeError('assignment-result-return-not-available', 409);
    }
    if (input.newDeadlineAt <= new Date(snapshot.originalDueAt) || input.newDeadlineAt <= now) {
      throw new AssignmentSubmissionGradeError('assignment-result-return-deadline-invalid', 422);
    }
    const requestHash = sha256(stableStringify({
      snapshotId: input.snapshotId,
      snapshotItemId: input.snapshotItemId,
      actorId: input.actor.id,
      reason: input.reason,
      newDeadlineAt: input.newDeadlineAt.toISOString(),
    }));
    const existing = await tx.teacherAssignmentResubmissionGrant.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
    if (existing) {
      if (existing.requestHash !== requestHash || existing.sourceReviewId !== approval.reviewId || existing.teacherId !== input.actor.id) {
        throw new AssignmentSubmissionGradeError('assignment-result-return-conflict', 409);
      }
      return { grant: existing, replay: true };
    }
    const grant = await tx.teacherAssignmentResubmissionGrant.create({
      data: {
        assignmentId: input.assignmentId,
        assignmentRevisionId: snapshot.assignmentRevisionId,
        submissionId: snapshot.submissionId,
        answerId: item.answerId,
        attemptId: item.attemptId,
        questionId: item.questionId,
        sourceReviewId: approval.reviewId,
        sourceGradingRunId: approval.gradingRunId,
        teacherId: input.actor.id,
        idempotencyKey: input.idempotencyKey,
        requestHash,
        state: 'ACTIVE',
        reason: input.reason,
        allowedResponseType: item.question.responseType,
        newDeadlineAt: input.newDeadlineAt,
        authorizationSnapshot: authorizationSnapshot(input.actor, snapshot, now),
        grantedAt: now,
        expiresAt: input.newDeadlineAt,
      },
    });
    await tx.submissionAnswer.update({ where: { id: item.answerId }, data: { state: 'DRAFT', version: { increment: 1 }, updatedAt: now } });
    await tx.assignmentSubmission.update({ where: { id: snapshot.submissionId }, data: { reviewState: 'RETURNED', approvedTotal: null, reviewedAt: null, updatedAt: now } });
    return { grant, replay: false };
  });
}

function deriveAggregate(snapshot: any, conclusions: any[]) {
  let total = 0;
  const blockers: Array<{ questionId: string; reason: string }> = [];
  const questions = snapshot.items.map((item: any) => {
    const conclusion = conclusions.find((row: any) => row.snapshotItemId === item.id);
    if (conclusion) {
      total += Number(conclusion.scoreEffect);
      return questionProjection(item, { status: 'COMPLETE', source: conclusion.kind, score: Number(conclusion.scoreEffect), comment: conclusion.reason, criteria: [], annotations: [] });
    }
    const approvals = [...(item.attempt?.approvalSnapshots ?? [])]
      .sort((left: any, right: any) => new Date(right.approvedAt).getTime() - new Date(left.approvedAt).getTime());
    const approval = approvals.find((row: any) => row.gradingRun?.source === 'MANUAL') ?? approvals[0];
    if (approval) {
      total += Number(approval.questionTotal);
      return questionProjection(item, { status: 'COMPLETE', source: approval.gradingRun?.source ?? 'AI', score: Number(approval.questionTotal), comment: approval.overallComment ?? '', criteria: Array.isArray(approval.criterionSnapshot) ? approval.criterionSnapshot : [], annotations: Array.isArray(approval.annotationSnapshot) ? approval.annotationSnapshot : [], approvalSnapshotId: approval.id });
    }
    const run = [...(item.attempt?.gradingRuns ?? [])].sort((left: any, right: any) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime())[0];
    const reason = !item.attemptId ? 'missing-attempt' : run && ['FAILED', 'BLOCKED', 'CONTENT_UNAVAILABLE'].includes(run.state) ? 'question-failed' : run ? 'question-processing' : 'question-ungraded';
    blockers.push({ questionId: item.questionId, reason });
    return questionProjection(item, { status: reason === 'question-failed' ? 'FAILED' : 'UNRESOLVED', source: null, score: null, comment: null, criteria: [], annotations: [], failureReason: reason });
  });
  const state = blockers.length === 0 ? 'AWAITING_CONFIRMATION' : questions.some((row: any) => row.status === 'FAILED') ? 'PARTIAL_FAILURE' : 'PENDING_GRADING';
  const overallComment = questions
    .map((question: any, index: number) => typeof question.comment === 'string' && question.comment.trim() ? `第 ${index + 1} 题：${question.comment.trim()}` : null)
    .filter((comment: string | null): comment is string => comment !== null)
    .join('\n');
  return { complete: blockers.length === 0, total: blockers.length === 0 ? Number(total.toFixed(4)) : null, overallComment: overallComment || null, questions, blockers, state };
}

function questionProjection(item: any, value: any) {
  return { questionId: item.questionId, snapshotItemId: item.id, attemptId: item.attemptId, questionSnapshotHash: item.questionSnapshotHash, question: { promptSnapshot: item.question.promptSnapshot, answerSnapshot: item.question.answerSnapshot, rubricSnapshot: item.question.rubricSnapshot }, approvalSnapshotId: value.approvalSnapshotId ?? null, ...value };
}

function studentResultPackage(confirmation: any, releasedAt: Date) {
  const questions = Array.isArray(confirmation.questionProjection) ? confirmation.questionProjection.map((item: any) => ({
    questionId: item.questionId,
    score: Number(item.score),
    comment: typeof item.comment === 'string' ? item.comment : '',
    criteria: studentCriteria(item.criteria),
    annotations: studentAnnotations(item.annotations),
    referenceAnswer: presentStudentReferenceAnswer(item.question?.answerSnapshot),
    scoringStandard: presentStudentScoringStandard(item.question?.rubricSnapshot),
  })) : [];
  return {
    version: 'assignment-student-result.v1',
    totalScore: Number(confirmation.totalScore),
    overallComment: typeof confirmation.overallComment === 'string' ? confirmation.overallComment : null,
    releasedAt: releasedAt.toISOString(),
    questions,
  };
}

function studentCriteria(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.flatMap((row) => {
    if (!row || typeof row !== 'object') return [];
    const criterion = row as Record<string, unknown>;
    const score = Number(criterion.score);
    return [{
      ...(typeof criterion.criterionId === 'string' ? { criterionId: criterion.criterionId } : {}),
      ...(typeof criterion.levelId === 'string' ? { levelId: criterion.levelId } : {}),
      ...(Number.isFinite(score) ? { score } : {}),
      ...(typeof criterion.comment === 'string' ? { comment: criterion.comment } : {}),
    }];
  });
}

function studentAnnotations(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.flatMap((row) => {
    if (!row || typeof row !== 'object' || (row as Record<string, unknown>).status === 'SUPPRESSED') return [];
    const annotation = row as Record<string, unknown>;
    const anchor = annotation.anchor && typeof annotation.anchor === 'object' ? annotation.anchor as Record<string, unknown> : null;
    return [{
      ...(typeof annotation.criterionId === 'string' ? { criterionId: annotation.criterionId } : {}),
      ...(typeof annotation.comment === 'string' ? { comment: annotation.comment } : {}),
      ...(anchor ? { anchor: studentAnnotationAnchor(anchor) } : {}),
    }];
  });
}

function studentAnnotationAnchor(anchor: Record<string, unknown>) {
  return {
    ...(typeof anchor.blockId === 'string' ? { blockId: anchor.blockId } : {}),
    ...(Number.isInteger(anchor.pageNumber) ? { pageNumber: anchor.pageNumber } : {}),
    ...(Number.isInteger(anchor.spanStart) ? { spanStart: anchor.spanStart } : {}),
    ...(Number.isInteger(anchor.spanEnd) ? { spanEnd: anchor.spanEnd } : {}),
    ...(Array.isArray(anchor.bbox) && anchor.bbox.every((value) => typeof value === 'number' && Number.isFinite(value)) ? { bbox: anchor.bbox } : {}),
    ...(typeof anchor.precision === 'string' ? { precision: anchor.precision } : {}),
  };
}

async function ensureGrade(db: any, snapshot: any, now: Date) {
  const existing = await db.assignmentSubmissionGrade.findUnique({ where: { snapshotId: snapshot.id }, include: { conclusions: true } });
  if (existing) return existing;
  try {
    return await db.assignmentSubmissionGrade.create({ data: { id: `assignment-submission-grade:${sha256(snapshot.id).slice(-32)}`, snapshotId: snapshot.id, questionProjection: [], createdAt: now, updatedAt: now }, include: { conclusions: true } });
  } catch (error) {
    if (!(error && typeof error === 'object' && (error as any).code === 'P2002')) throw error;
    const winner = await db.assignmentSubmissionGrade.findUnique({ where: { snapshotId: snapshot.id }, include: { conclusions: true } });
    if (!winner) throw error;
    return winner;
  }
}

async function loadSnapshot(db: any, snapshotId: string) {
  const snapshot = await db.assignmentSubmissionSnapshot.findUnique({
    where: { id: snapshotId },
    include: {
      revision: { include: { assignment: { include: { reviewGrants: true } } } },
      submission: { include: { audience: { include: { class: true } }, student: { include: { profile: true } } } },
      items: {
        orderBy: [{ question: { orderIndex: 'asc' } }, { id: 'asc' }],
        include: {
          question: true,
          attempt: {
            include: {
              gradingRuns: true,
              approvalSnapshots: {
                include: {
                  gradingRun: { select: { source: true } },
                  reviewedDerivatives: { where: { state: 'READY', outputKind: 'REVIEWED_PDF' }, select: { id: true, state: true, outputKind: true } },
                },
              },
            },
          },
        },
      },
    },
  });
  if (!snapshot) throw new AssignmentSubmissionGradeError('assignment-result-snapshot-not-found', 404);
  return snapshot;
}

function assertSnapshotScope(snapshot: any, assignmentId: string, submissionId?: string) {
  if (snapshot.revision.assignmentId !== assignmentId
    || snapshot.submission.assignmentRevisionId !== snapshot.assignmentRevisionId
    || (submissionId && snapshot.submissionId !== submissionId)) throw new AssignmentSubmissionGradeError('assignment-result-access-forbidden', 403);
}

function authorize(actor: AssignmentGradeActor, snapshot: any, now: Date) {
  if (actor.role === 'ADMIN' || snapshot.revision.assignment.authorId === actor.id) return;
  const grant = snapshot.revision.assignment.reviewGrants.some((row: any) => row.teacherId === actor.id && row.revokedAt == null && (!row.expiresAt || new Date(row.expiresAt) > now));
  const classTeacher = snapshot.submission.audience?.class?.teacherId === actor.id && snapshot.submission.audience?.class?.isActive === true && snapshot.submission.student?.profile?.classId === snapshot.frozenAudienceClassId;
  if (!grant && !classTeacher) throw new AssignmentSubmissionGradeError('assignment-result-access-forbidden', 403);
}

function assertDeadline(snapshot: any, now: Date) {
  if (now <= new Date(snapshot.originalDueAt)) throw new AssignmentSubmissionGradeError('assignment-grading-before-deadline', 409);
}

function authorizationSnapshot(actor: AssignmentGradeActor, snapshot: any, now: Date) {
  return { version: 'assignment-submission-grade-authorization.v1', actorId: actor.id, snapshotId: snapshot.id, submissionId: snapshot.submissionId, authorizedAt: now.toISOString() };
}

async function transaction<T>(db: any, callback: (tx: any) => Promise<T>) {
  return typeof db.$transaction === 'function' ? db.$transaction(callback, { isolationLevel: 'Serializable' }) : callback(db);
}
