import { sha256 } from '@/lib/data-governance/math-document-grading-contracts';
import { returnTeacherAssignmentReview } from './assignment-review';
import {
  presentStudentReferenceAnswer,
  presentStudentScoringStandard,
} from './student-result-presentation';

export type AssignmentGradeActor = { id: string; role: 'TEACHER' | 'ADMIN' };

export class AssignmentSubmissionGradeError extends Error {
  constructor(
    readonly code: string,
    readonly status: number,
    readonly details?: unknown,
  ) {
    super(code);
    this.name = 'AssignmentSubmissionGradeError';
  }
}

// 作业级批改收口视图：全部从题级 canonical 审批快照、豁免与发布 outbox 派生，
// 不落任何并行状态机。state 语义与既有 UI 契约保持一致：
// PENDING_GRADING -> PARTIAL_FAILURE | AWAITING_CONFIRMATION -> RELEASED。
export type AssignmentGradingClosureView = {
  state: 'PENDING_GRADING' | 'PARTIAL_FAILURE' | 'AWAITING_CONFIRMATION' | 'RELEASED';
  totalScore: number | null;
  overallComment: string | null;
  questionProjection: any[];
  publishing: boolean;
};

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
  const closure = deriveClosureView(snapshot);
  return {
    grade: { snapshotId: snapshot.id, ...closure },
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
  submissionId?: string;
  snapshotId: string;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const snapshot = await loadSnapshot(db, input.snapshotId);
  assertSnapshotScope(snapshot, input.assignmentId, input.submissionId);
  authorize(input.actor, snapshot, now);
  assertDeadline(snapshot, now);
  const closure = deriveClosureView(snapshot);
  return {
    grade: { snapshotId: snapshot.id, ...closure },
    aggregate: {
      complete: closure.totalScore != null,
      total: closure.totalScore,
      overallComment: closure.overallComment,
      questions: closure.questionProjection,
      blockers: closureBlockers(snapshot),
      state: closure.state,
    },
  };
}

// 确认动作不再落独立确认表：题级 approve 即唯一分数权威与审计来源。
// CONFIRM 仅在服务端重算完整性，complete 时返回派生确认视图（天然幂等）。
export async function confirmAssignmentSubmissionGrade(db: any, input: {
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
  assertDeadline(snapshot, now);
  const closure = deriveClosureView(snapshot);
  if (closure.totalScore == null) {
    throw new AssignmentSubmissionGradeError('assignment-result-incomplete', 409, { blockers: closureBlockers(snapshot) });
  }
  const approvedAt = snapshot.items
    .flatMap((item: any) => item.attempt?.approvalSnapshots ?? [])
    .map((approval: any) => new Date(approval.approvedAt).getTime())
    .reduce((latest: number, value: number) => Math.max(latest, value), Number.NEGATIVE_INFINITY);
  return {
    confirmation: {
      id: `assignment-grade-confirmation:${sha256(`${snapshot.id}:${closure.totalScore}`).slice(-32)}`,
      snapshotId: snapshot.id,
      attemptVectorHash: snapshot.attemptVectorHash,
      totalScore: closure.totalScore,
      overallComment: closure.overallComment,
      questionProjection: closure.questionProjection,
      confirmedAt: new Date(approvedAt === Number.NEGATIVE_INFINITY ? now : approvedAt).toISOString(),
    },
    replay: true,
  };
}

// 发布是显式授权动作：approve 在 TEACHER_CONFIRMED_RESULT revision 上创建的
// RELEASE_STUDENT_FEEDBACK 命令带 assignmentResultReleaseGate，worker 只准备派生物、
// 不授予学生可见性。这里逐题解除 gate 并唤醒命令（payload 记录显式发布审计），
// worker 完成 feedbackRelease 后 reconcile 才把作业推进到 REVIEWED；全豁免作业
// 没有题级命令，直接在 submission 上写入显式发布状态。
export async function releaseAssignmentSubmissionGrade(db: any, input: {
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
  assertDeadline(snapshot, now);
  const closure = deriveClosureView(snapshot);
  if (closure.totalScore == null) {
    throw new AssignmentSubmissionGradeError('assignment-result-not-confirmed', 409, { blockers: closureBlockers(snapshot) });
  }
  if (snapshot.revision.solutionReleasePolicy?.mode !== 'TEACHER_CONFIRMED_RESULT') {
    throw new AssignmentSubmissionGradeError('assignment-result-release-policy-invalid', 409);
  }
  if (!['APPROVED_PENDING_RELEASE', 'RELEASE_BLOCKED', 'REVIEWED'].includes(snapshot.submission.reviewState)) {
    throw new AssignmentSubmissionGradeError('assignment-result-not-confirmed', 409);
  }
  const releaseAudit = { actorId: input.actor.id, releasedAt: now.toISOString() };
  const releasedApprovals: string[] = [];
  const pendingApprovals: string[] = [];
  for (const item of snapshot.items) {
    const approval = latestApproval(item);
    if (!approval) continue;
    const releaseCommand = (approval.outboxCommands ?? []).find((row: any) => row.command === 'RELEASE_STUDENT_FEEDBACK');
    if (!releaseCommand) continue;
    const payload = releaseCommand.payload && typeof releaseCommand.payload === 'object' && !Array.isArray(releaseCommand.payload)
      ? releaseCommand.payload
      : {};
    if (releaseCommand.state === 'SUCCEEDED' && approval.feedbackRelease) {
      releasedApprovals.push(approval.id);
      continue;
    }
    await db.teacherAssignmentReviewOutbox.update({
      where: { id: releaseCommand.id },
      data: {
        state: 'PENDING',
        attemptCount: 0,
        availableAt: now,
        claimToken: null,
        claimedAt: null,
        leaseExpiresAt: null,
        lastErrorCode: null,
        limitationCode: null,
        processedAt: null,
        payload: { ...payload, assignmentResultReleaseGate: false, assignmentResultRelease: releaseAudit },
        updatedAt: now,
      },
    });
    pendingApprovals.push(approval.id);
  }
  if (pendingApprovals.length === 0) {
    // 全豁免（或全部已发布）作业：没有可激活的题级命令，显式发布状态直接落在 submission 上。
    await db.assignmentSubmission.update({
      where: { id: snapshot.submissionId },
      data: { reviewState: 'REVIEWED', reviewedAt: now, updatedAt: now },
    });
  }
  const after = deriveClosureView(await loadSnapshot(db, input.snapshotId));
  return {
    release: { snapshotId: snapshot.id, state: after.state, totalScore: after.totalScore, publishing: pendingApprovals.length > 0, releasedApprovals, pendingApprovals },
    replay: pendingApprovals.length === 0,
  };
}

// 题目结论（未作答/豁免）落到 canonical TeacherAssignmentQuestionExemption，
// 唯一约束 (submissionId, questionId) 提供幂等；scoreEffect 计入作业总分派生。
export async function recordAssignmentQuestionConclusion(db: any, input: {
  actor: AssignmentGradeActor;
  assignmentId: string;
  submissionId?: string;
  snapshotId: string;
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
  if (!item?.questionId) throw new AssignmentSubmissionGradeError('assignment-result-invalid-request', 422);
  const exemption = await db.teacherAssignmentQuestionExemption.upsert({
    where: { submissionId_questionId: { submissionId: snapshot.submissionId, questionId: item.questionId } },
    create: {
      assignmentId: input.assignmentId,
      assignmentRevisionId: snapshot.assignmentRevisionId,
      submissionId: snapshot.submissionId,
      questionId: item.questionId,
      actorId: input.actor.id,
      reason: `[${input.kind}] ${input.reason}`,
      scoreEffect: input.scoreEffect,
      authorizationSnapshot: authorizationSnapshot(input.actor, snapshot, now),
    },
    update: { actorId: input.actor.id, reason: `[${input.kind}] ${input.reason}`, scoreEffect: input.scoreEffect, authorizationSnapshot: authorizationSnapshot(input.actor, snapshot, now) },
  });
  const closure = deriveClosureView(await loadSnapshot(db, input.snapshotId));
  return { exemption, grade: { snapshotId: snapshot.id, ...closure } };
}

// 退回补交完全委托 canonical returnTeacherAssignmentReview，
// 复用其乐观版本栅栏、幂等键与 resubmission grant 语义。
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
  const snapshot = await loadSnapshot(db, input.snapshotId);
  assertSnapshotScope(snapshot, input.assignmentId, input.submissionId);
  authorize(input.actor, snapshot, now);
  assertDeadline(snapshot, now);
  const closure = deriveClosureView(snapshot);
  if (!['AWAITING_CONFIRMATION', 'RELEASED'].includes(closure.state)) {
    throw new AssignmentSubmissionGradeError('assignment-result-return-unconfirmed', 409);
  }
  const item = snapshot.items.find((row: any) => row.id === input.snapshotItemId);
  const approval = latestApproval(item);
  if (!item?.answerId || !item.attemptId || !approval?.reviewId) {
    throw new AssignmentSubmissionGradeError('assignment-result-return-not-available', 409);
  }
  if (input.newDeadlineAt <= new Date(snapshot.originalDueAt) || input.newDeadlineAt <= now) {
    throw new AssignmentSubmissionGradeError('assignment-result-return-deadline-invalid', 422);
  }
  const review = await db.teacherAssignmentReview.findUnique({ where: { id: approval.reviewId } });
  if (!review) throw new AssignmentSubmissionGradeError('assignment-result-return-not-available', 409);
  try {
    const grant = await returnTeacherAssignmentReview(db, {
      actor: { id: input.actor.id, role: input.actor.role },
      assignmentId: input.assignmentId,
      submissionId: snapshot.submissionId,
      reviewId: approval.reviewId,
      expectedVersion: review.version,
      idempotencyKey: input.idempotencyKey,
      reason: input.reason,
      allowedResponseType: item.question.responseType,
      newDeadlineAt: input.newDeadlineAt,
      now,
    });
    return { grant, replay: false };
  } catch (error) {
    const code = (error as any)?.code;
    if (code === 'teacher-review-idempotency-conflict' || code === 'teacher-review-conflict') {
      throw new AssignmentSubmissionGradeError('assignment-result-return-conflict', 409);
    }
    throw error;
  }
}

function latestApproval(item: any) {
  return [...(item?.attempt?.approvalSnapshots ?? [])]
    .sort((left: any, right: any) => new Date(right.approvedAt).getTime() - new Date(left.approvedAt).getTime())[0] ?? null;
}

function deriveClosureView(snapshot: any): AssignmentGradingClosureView {
  const exemptions = snapshot.submission?.questionExemptions ?? [];
  let total = 0;
  let failed = false;
  let unresolved = false;
  let releasedAll = true;
  let publishing = false;
  const questions = snapshot.items.map((item: any) => {
    const exemption = exemptions.find((row: any) => row.questionId === item.questionId);
    if (exemption) {
      total += Number(exemption.scoreEffect);
      return questionProjection(item, { status: 'COMPLETE', source: 'EXEMPT', score: Number(exemption.scoreEffect), comment: exemption.reason, criteria: [], annotations: [] });
    }
    const approvals = [...(item.attempt?.approvalSnapshots ?? [])]
      .sort((left: any, right: any) => new Date(right.approvedAt).getTime() - new Date(left.approvedAt).getTime());
    const approval = approvals.find((row: any) => row.gradingRun?.source === 'MANUAL') ?? approvals[0];
    if (approval) {
      total += Number(approval.questionTotal);
      const releaseCommand = (approval.outboxCommands ?? []).find((row: any) => row.command === 'RELEASE_STUDENT_FEEDBACK');
      const feedbackRelease = approval.feedbackRelease;
      if (releaseCommand?.state === 'SUCCEEDED' && feedbackRelease) {
        // released
      } else if (releaseCommand && ['PENDING', 'CLAIMED', 'RETRYABLE'].includes(releaseCommand.state)) {
        publishing = true;
        releasedAll = false;
      } else {
        releasedAll = false;
      }
      return questionProjection(item, { status: 'COMPLETE', source: approval.gradingRun?.source ?? 'AI', score: Number(approval.questionTotal), comment: approval.overallComment ?? '', criteria: Array.isArray(approval.criterionSnapshot) ? approval.criterionSnapshot : [], annotations: Array.isArray(approval.annotationSnapshot) ? approval.annotationSnapshot : [], approvalSnapshotId: approval.id });
    }
    const run = [...(item.attempt?.gradingRuns ?? [])].sort((left: any, right: any) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime())[0];
    const reason = !item.attemptId ? 'missing-attempt' : run && ['FAILED', 'BLOCKED', 'CONTENT_UNAVAILABLE'].includes(run.state) ? 'question-failed' : run ? 'question-processing' : 'question-ungraded';
    if (reason === 'question-failed') failed = true;
    else unresolved = true;
    releasedAll = false;
    return questionProjection(item, { status: reason === 'question-failed' ? 'FAILED' : 'UNRESOLVED', source: null, score: null, comment: null, criteria: [], annotations: [], failureReason: reason });
  });
  const complete = !failed && !unresolved;
  const overallComment = questions
    .map((question: any, index: number) => typeof question.comment === 'string' && question.comment.trim() ? `第 ${index + 1} 题：${question.comment.trim()}` : null)
    .filter((comment: string | null): comment is string => comment !== null)
    .join('\n');
  const state: AssignmentGradingClosureView['state'] = failed
    ? 'PARTIAL_FAILURE'
    : complete
      ? releasedAll ? 'RELEASED' : 'AWAITING_CONFIRMATION'
      : 'PENDING_GRADING';
  return {
    state,
    totalScore: complete ? Number(total.toFixed(4)) : null,
    overallComment: overallComment || null,
    questionProjection: questions,
    publishing,
  };
}

function closureBlockers(snapshot: any) {
  return deriveClosureView(snapshot).questionProjection
    .filter((question: any) => question.status !== 'COMPLETE')
    .map((question: any) => ({ questionId: question.questionId, reason: question.failureReason ?? 'unapproved-current-attempt' }));
}

function questionProjection(item: any, value: any) {
  return { questionId: item.questionId, snapshotItemId: item.id, attemptId: item.attemptId, questionSnapshotHash: item.questionSnapshotHash, question: { promptSnapshot: item.question.promptSnapshot, answerSnapshot: item.question.answerSnapshot, rubricSnapshot: item.question.rubricSnapshot }, approvalSnapshotId: value.approvalSnapshotId ?? null, ...value };
}

export function studentResultPackage(closure: AssignmentGradingClosureView, releasedAt: Date) {
  const questions = (closure.questionProjection ?? []).map((item: any) => ({
    questionId: item.questionId,
    score: Number(item.score),
    comment: typeof item.comment === 'string' ? item.comment : '',
    criteria: studentCriteria(item.criteria),
    annotations: studentAnnotations(item.annotations),
    referenceAnswer: presentStudentReferenceAnswer(item.question?.answerSnapshot),
    scoringStandard: presentStudentScoringStandard(item.question?.rubricSnapshot),
  }));
  return {
    version: 'assignment-student-result.v1',
    totalScore: Number(closure.totalScore),
    overallComment: typeof closure.overallComment === 'string' ? closure.overallComment : null,
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

async function loadSnapshot(db: any, snapshotId: string) {
  const snapshot = await db.assignmentSubmissionSnapshot.findUnique({
    where: { id: snapshotId },
    include: {
      revision: { include: { assignment: { include: { reviewGrants: true } } } },
      submission: {
        include: {
          audience: { include: { class: true } },
          student: { include: { profile: true } },
          questionExemptions: true,
        },
      },
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
                  outboxCommands: { where: { command: 'RELEASE_STUDENT_FEEDBACK' }, select: { id: true, command: true, state: true } },
                  feedbackRelease: { select: { id: true, ownerStudentId: true, releasedAt: true } },
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
  return { version: 'assignment-grading-closure-authorization.v1', actorId: actor.id, snapshotId: snapshot.id, submissionId: snapshot.submissionId, authorizedAt: now.toISOString() };
}
