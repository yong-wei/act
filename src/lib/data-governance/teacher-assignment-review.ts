import { createHash, randomBytes } from 'node:crypto';

import { stableStringify, sha256 } from './math-document-grading-contracts';
import { hasAtMostOneDecimal } from '@/lib/assignments/assignment-rubric-contract';
import { writeGradingAudit } from './math-document-grading-persistence';

export type TeacherReviewActor = { id: string; role: 'TEACHER' | 'ADMIN' };

export class TeacherAssignmentReviewError extends Error {
  constructor(public readonly code: string, public readonly status: number, public readonly details?: unknown) {
    super(code);
  }
}

export const TEACHER_ASSIGNMENT_REVIEW_INCLUDE = {
  assignment: { include: { reviewGrants: true } },
  revision: true,
  submission: {
    include: {
      audience: { include: { class: true } },
      student: { include: { profile: true } },
    },
  },
  gradingRun: {
    include: {
      assessments: true,
      annotations: true,
      answerEvidence: {
        select: {
          id: true,
          attemptId: true,
          limitationState: true,
          sourceManifest: true,
        },
      },
      answerAttempt: {
        include: {
          answer: true,
          assets: {
            select: {
              id: true,
              answerId: true,
              attemptId: true,
              originalName: true,
              mimeType: true,
              sizeBytes: true,
              assetRole: true,
              orderIndex: true,
              embeddedPosition: true,
              state: true,
            },
            orderBy: [{ orderIndex: 'asc' }, { version: 'asc' }, { id: 'asc' }],
          },
        },
      },
      question: true,
    },
  },
  approvalSnapshot: true,
} as const;

type ReviewCriterionValue = {
  criterionId: string;
  levelId: string | null;
  score: number;
  comment: string;
};

type ReviewAnnotationValue = {
  id?: string;
  criterionId: string;
  status: 'ACTIVE' | 'SUPPRESSED';
  comment: string;
  anchor: Record<string, unknown>;
  origin?: 'AI_DRAFT' | 'TEACHER';
};

export function deriveTeacherAssignmentReviewTotal(rubric: any, values: ReviewCriterionValue[]): number {
  const rubricCriteria = Array.isArray(rubric?.criteria) ? rubric.criteria : [];
  if (rubricCriteria.length === 0 || values.length !== rubricCriteria.length) {
    throw new TeacherAssignmentReviewError('teacher-review-criteria-incomplete', 422);
  }
  const byId = new Map(values.map((value) => [value.criterionId, value]));
  if (byId.size !== values.length) throw new TeacherAssignmentReviewError('teacher-review-criterion-duplicate', 422);
  let total = 0;
  for (const criterion of rubricCriteria) {
    const value = byId.get(criterion.id);
    if (!value) throw new TeacherAssignmentReviewError('teacher-review-criteria-incomplete', 422);
    if (!Number.isFinite(value.score) || value.score < 0 || value.score > Number(criterion.maxPoints)) {
      throw new TeacherAssignmentReviewError('teacher-review-score-out-of-range', 422, { criterionId: criterion.id });
    }
    const v2 = rubric.schemaVersion === 'assignment-scoring-rubric.v2';
    const detailed = v2 ? criterion.detailedRubricEnabled === true : true;
    const level = Array.isArray(criterion.levels) && value.levelId
      ? criterion.levels.find((candidate: any) => candidate.id === value.levelId)
      : null;
    if (v2 && !hasAtMostOneDecimal(value.score)) {
      throw new TeacherAssignmentReviewError('teacher-review-score-precision-invalid', 422, { criterionId: criterion.id });
    }
    if ((detailed && !level) || (!detailed && value.levelId !== null)) {
      throw new TeacherAssignmentReviewError('teacher-review-level-score-mismatch', 422, { criterionId: criterion.id });
    }
    if (!v2 && level && (value.score < Number(level.minPoints) || value.score > Number(level.maxPoints))) {
      throw new TeacherAssignmentReviewError('teacher-review-level-score-mismatch', 422, { criterionId: criterion.id });
    }
    total += value.score;
  }
  if (Number.isFinite(Number(rubric.maxScore)) && total > Number(rubric.maxScore)) {
    throw new TeacherAssignmentReviewError('teacher-review-total-out-of-range', 422);
  }
  return Number(total.toFixed(4));
}

export function evaluateAssignmentReviewCompleteness(input: {
  questions: Array<{ id: string }>;
  answers: Array<{ id?: string; assignmentQuestionId: string; currentAttemptNumber: number; attempts: Array<{ id: string; attemptNumber: number; gradingState?: string }> }>;
  approvalSnapshots: Array<{ questionId: string; attemptId: string; questionTotal: number; approvedAt?: Date | string }>;
  activeGrants: Array<{ answerId?: string; questionId: string }>;
  exemptions: Array<{ questionId: string; scoreEffect: number }>;
}): { complete: boolean; total: number | null; blockers: Array<{ questionId: string; reason: string }> } {
  const blockers: Array<{ questionId: string; reason: string }> = [];
  let total = 0;
  for (const question of input.questions) {
    const exemption = input.exemptions.find((row) => row.questionId === question.id);
    if (exemption) {
      total += Number(exemption.scoreEffect);
      continue;
    }
    const answer = input.answers.find((row) => row.assignmentQuestionId === question.id);
    if (!answer || answer.currentAttemptNumber <= 0) {
      blockers.push({ questionId: question.id, reason: 'never-submitted' });
      continue;
    }
    if (input.activeGrants.some((grant) => grant.questionId === question.id && (!grant.answerId || !answer.id || grant.answerId === answer.id))) {
      blockers.push({ questionId: question.id, reason: 'returned-awaiting-resubmission' });
      continue;
    }
    const attempt = answer.attempts.find((row) => row.attemptNumber === answer.currentAttemptNumber);
    if (!attempt) {
      blockers.push({ questionId: question.id, reason: 'current-attempt-missing' });
      continue;
    }
    const snapshot = input.approvalSnapshots
      .filter((row) => row.questionId === question.id && row.attemptId === attempt.id)
      .reduce<(typeof input.approvalSnapshots)[number] | undefined>((latest, candidate) => {
        if (!latest) return candidate;
        const latestAt = latest.approvedAt ? new Date(latest.approvedAt).getTime() : Number.NEGATIVE_INFINITY;
        const candidateAt = candidate.approvedAt ? new Date(candidate.approvedAt).getTime() : Number.NEGATIVE_INFINITY;
        return candidateAt >= latestAt ? candidate : latest;
      }, undefined);
    if (!snapshot) {
      const processing = attempt.gradingState && ['QUEUED', 'RUNNING', 'RETRYABLE'].includes(attempt.gradingState);
      blockers.push({ questionId: question.id, reason: processing ? 'current-attempt-processing' : 'unapproved-current-attempt' });
      continue;
    }
    total += Number(snapshot.questionTotal);
  }
  return blockers.length > 0 ? { complete: false, total: null, blockers } : { complete: true, total: Number(total.toFixed(4)), blockers: [] };
}

export function resolveTeacherAssignmentReviewAuthorization(input: { actor: TeacherReviewActor; review: any; now?: Date }) {
  const now = input.now ?? new Date();
  const { actor, review } = input;
  const submission = review?.submission;
  if (!review?.assignment || !submission
    || review.assignmentId !== review.assignment.id
    || review.assignmentRevisionId !== submission.assignmentRevisionId
    || review.submissionId !== submission.id
    || submission.studentId !== submission.frozenStudentId
    || submission.audience?.classId !== submission.frozenAudienceClassId) {
    throw new TeacherAssignmentReviewError('teacher-review-lineage-invalid', 409);
  }
  let mode: 'admin' | 'assignment-author' | 'current-class' | 'review-grant' | null = null;
  if (actor.role === 'ADMIN') mode = 'admin';
  else if (review.assignment.authorId === actor.id) mode = 'assignment-author';
  else {
    const grant = (review.assignment.reviewGrants ?? []).find((row: any) => row.teacherId === actor.id
      && row.revokedAt == null && (row.expiresAt == null || new Date(row.expiresAt) > now));
    if (grant) mode = 'review-grant';
    else if (submission.audience?.archivedAt == null
      && submission.audience?.class?.isActive === true
      && submission.audience.class.teacherId === actor.id
      && submission.student?.profile?.classId === submission.frozenAudienceClassId) mode = 'current-class';
  }
  if (!mode) throw new TeacherAssignmentReviewError('teacher-review-forbidden', 403);
  return {
    mode,
    snapshot: {
      version: 'teacher-assignment-review-authorization.v1',
      mode,
      actorId: actor.id,
      assignmentId: review.assignmentId,
      assignmentRevisionId: review.assignmentRevisionId,
      submissionId: review.submissionId,
      studentId: submission.frozenStudentId,
      classId: submission.frozenAudienceClassId,
      authorizedAt: now.toISOString(),
    },
  };
}

export async function saveTeacherAssignmentReview(db: any, input: {
  actor: TeacherReviewActor;
  assignmentId: string;
  submissionId: string;
  reviewId: string;
  expectedVersion: number;
  criteria: ReviewCriterionValue[];
  annotations: ReviewAnnotationValue[];
  overallComment: string;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const review = await loadReview(db, input.reviewId);
  assertReviewPath(review, input.assignmentId, input.submissionId);
  assertReviewRunLineage(review);
  resolveTeacherAssignmentReviewAuthorization({ actor: input.actor, review, now });
  if (review.state !== 'WORKING' || review.version !== input.expectedVersion) throw conflict();
  const total = deriveTeacherAssignmentReviewTotal(review.gradingRun?.questionSnapshot?.rubric, input.criteria);
  validateReviewAnnotations(review.gradingRun?.questionSnapshot?.rubric, input.annotations);
  const result = await db.teacherAssignmentReview.updateMany({
    where: { id: input.reviewId, assignmentId: input.assignmentId, submissionId: input.submissionId, state: 'WORKING', version: input.expectedVersion },
    data: {
      version: { increment: 1 },
      criterionValues: input.criteria,
      annotationValues: jsonValue(input.annotations),
      derivedTotal: total,
      overallComment: input.overallComment,
      reviewerId: input.actor.id,
      updatedAt: now,
    },
  });
  if (result?.count !== 1) throw conflict();
  return { ...review, version: input.expectedVersion + 1, criterionValues: input.criteria, annotationValues: input.annotations, derivedTotal: total, overallComment: input.overallComment, reviewerId: input.actor.id, updatedAt: now };
}

export async function approveTeacherAssignmentReview(db: any, input: {
  actor: TeacherReviewActor;
  assignmentId: string;
  submissionId: string;
  reviewId: string;
  expectedVersion: number;
  idempotencyKey: string;
  confirmIncompleteEvidence?: boolean;
  omittedAssetIds?: string[];
  now?: Date;
}) {
  const now = input.now ?? new Date();
  return runSerializable(db, async (tx) => {
    const review = await loadReview(tx, input.reviewId);
    assertReviewPath(review, input.assignmentId, input.submissionId);
    assertReviewRunLineage(review);
    const authorization = resolveTeacherAssignmentReviewAuthorization({ actor: input.actor, review, now });
    const requestHash = sha256(stableStringify({
      reviewId: input.reviewId,
      expectedVersion: input.expectedVersion,
      actorId: input.actor.id,
      ...(input.confirmIncompleteEvidence === true
        ? { confirmIncompleteEvidence: true }
        : {}),
      ...(input.omittedAssetIds
        ? { omittedAssetIds: [...new Set(input.omittedAssetIds)] }
        : {}),
    }));
    const replay = await tx.teacherAssignmentApprovalSnapshot.findUnique?.({ where: { reviewId_idempotencyKey: { reviewId: input.reviewId, idempotencyKey: input.idempotencyKey } } });
    if (replay) {
      if (replay.requestHash !== requestHash) throw new TeacherAssignmentReviewError('teacher-review-idempotency-conflict', 409);
      const aggregate = await loadSubmissionCompleteness(tx, review.submissionId);
      const approvalSnapshots = await tx.teacherAssignmentApprovalSnapshot.findMany({ where: { submissionId: review.submissionId } });
      const completion = evaluateAssignmentReviewCompleteness({
        questions: aggregate.revision.questions,
        answers: aggregate.answers.map((answer: any) => ({
          ...answer,
          attempts: answer.attempts.map((attempt: any) => ({ ...attempt, gradingState: attempt.gradingRuns?.[0]?.state })),
        })),
        approvalSnapshots,
        activeGrants: (aggregate.resubmissionGrants ?? []).filter((grant: any) => grant.state === 'ACTIVE' && (!grant.expiresAt || new Date(grant.expiresAt) > now)),
        exemptions: aggregate.questionExemptions ?? [],
      });
      return { snapshot: replay, replay: true, assignment: completion };
    }
    if (review.state !== 'WORKING' || review.version !== input.expectedVersion) throw conflict();
    if (review.gradingRun?.state !== 'AWAITING_REVIEW' || review.gradingRun.teacherReviewedAt) throw conflict();
    const omittedAssetIds = omittedEvidenceAssetIds(
      review.gradingRun.answerEvidence?.sourceManifest,
    );
    const incompleteEvidence = review.gradingRun.evidenceState === 'EVIDENCE_INCOMPLETE'
      || review.gradingRun.answerEvidence?.limitationState === 'evidence-incomplete';
    if (input.omittedAssetIds
      && !sameStringSet(input.omittedAssetIds, omittedAssetIds)) {
      throw conflict();
    }
    if (incompleteEvidence && input.confirmIncompleteEvidence !== true) {
      throw new TeacherAssignmentReviewError(
        'teacher-review-incomplete-evidence-confirmation-required',
        409,
        { omittedAssetIds },
      );
    }
    const values = asCriterionValues(review.criterionValues);
    const total = deriveTeacherAssignmentReviewTotal(review.gradingRun.questionSnapshot?.rubric, values);
    const byCriterion = new Map(values.map((value) => [value.criterionId, value]));
    if (review.gradingRun.assessments.length !== values.length) throw new TeacherAssignmentReviewError('teacher-review-criteria-incomplete', 422);

    const reviewCas = await tx.teacherAssignmentReview.updateMany({
      where: { id: review.id, assignmentId: input.assignmentId, submissionId: input.submissionId, state: 'WORKING', version: input.expectedVersion },
      data: { state: 'APPROVED', version: { increment: 1 }, reviewerId: input.actor.id, approvedAt: now, updatedAt: now },
    });
    if (reviewCas?.count !== 1) throw conflict();
    const runCas = await tx.gradingRun.updateMany({
      where: { id: review.gradingRunId, state: 'AWAITING_REVIEW', teacherReviewedAt: null },
      data: { state: 'APPROVED', teacherReviewedAt: now, draftTotalScore: total, overallComment: review.overallComment, updatedAt: now },
    });
    if (runCas?.count !== 1) throw conflict();
    for (const assessment of review.gradingRun.assessments) {
      const value = byCriterion.get(assessment.criterionId);
      if (!value) throw new TeacherAssignmentReviewError('teacher-review-criteria-incomplete', 422);
      const assessmentCas = await tx.gradingCriterionAssessment.updateMany({
        where: { id: assessment.id, gradingRunId: review.gradingRunId, teacherReviewedAt: null },
        data: { teacherLevelId: value.levelId, teacherScore: value.score, teacherComment: value.comment, teacherReviewedAt: now, updatedAt: now },
      });
      if (assessmentCas?.count !== 1) throw conflict();
    }
    const snapshotId = `teacher-review-snapshot:${sha256(`${review.id}:${input.expectedVersion}:${requestHash}`).slice(-32)}`;
    const snapshot = await tx.teacherAssignmentApprovalSnapshot.create({
      data: {
        id: snapshotId,
        reviewId: review.id,
        assignmentId: review.assignmentId,
        assignmentRevisionId: review.assignmentRevisionId,
        submissionId: review.submissionId,
        answerId: review.answerId,
        attemptId: review.attemptId,
        questionId: review.questionId,
        gradingRunId: review.gradingRunId,
        answerEvidenceId: review.answerEvidenceId,
        reviewerId: input.actor.id,
        reviewVersion: input.expectedVersion,
        idempotencyKey: input.idempotencyKey,
        requestHash,
        machineSnapshotHash: review.machineSnapshotHash,
        criterionSnapshot: values,
        annotationSnapshot: jsonValue(review.annotationValues ?? []),
        questionTotal: total,
        overallComment: review.overallComment,
        authorizationSnapshot: authorization.snapshot,
        rubricVersion: review.gradingRun.rubricVersion,
        evaluatorVersion: review.gradingRun.evaluatorVersion,
        lifecyclePolicyVersion: review.lifecyclePolicyVersion ?? review.gradingRun.lifecyclePolicyVersion ?? null,
        incompleteEvidenceConfirmed: incompleteEvidence,
        omittedAssetIds,
        approvedAt: now,
      },
    });
    if (incompleteEvidence) {
      await writeGradingAudit(tx, {
        actor: input.actor,
        action: 'teacher-review.incomplete-evidence-confirmed',
        purpose: 'teacher-review',
        resourceType: 'TeacherAssignmentApprovalSnapshot',
        resourceId: snapshot.id,
        answerId: review.answerId,
        classId: review.submission.frozenAudienceClassId,
        metadata: {
          omittedAssetTokens: omittedAssetIds.map((assetId) =>
            sha256(`teacher-review-omitted-asset:${assetId}`)),
        },
      });
    }
    const commands = approvalOutboxRows(snapshot, review, now);
    const appended = await tx.teacherAssignmentReviewOutbox.createMany({ data: commands, skipDuplicates: true });
    if (appended?.count !== commands.length) throw new TeacherAssignmentReviewError('teacher-review-outbox-conflict', 409);

    const aggregate = await loadSubmissionCompleteness(tx, review.submissionId);
    const priorSnapshots = await tx.teacherAssignmentApprovalSnapshot.findMany({ where: { submissionId: review.submissionId } });
    const completion = evaluateAssignmentReviewCompleteness({
      questions: aggregate.revision.questions,
      answers: aggregate.answers.map((answer: any) => ({
        ...answer,
        attempts: answer.attempts.map((attempt: any) => ({ ...attempt, gradingState: attempt.gradingRuns?.[0]?.state })),
      })),
      approvalSnapshots: [...priorSnapshots.filter((row: any) => row.id !== snapshot.id), snapshot],
      activeGrants: (aggregate.resubmissionGrants ?? []).filter((grant: any) => grant.state === 'ACTIVE' && (!grant.expiresAt || new Date(grant.expiresAt) > now)),
      exemptions: aggregate.questionExemptions ?? [],
    });
    await tx.assignmentSubmission.update({
      where: { id: review.submissionId },
      data: completion.complete
        ? { reviewState: 'APPROVED_PENDING_RELEASE', approvedTotal: completion.total, reviewedAt: null, updatedAt: now }
        : { reviewState: 'REVIEWING', approvedTotal: null, reviewedAt: null, updatedAt: now },
    });
    if (completion.complete) {
      const snapshotIds = [...new Set([...priorSnapshots.map((row: any) => row.id), snapshot.id])];
      await tx.teacherAssignmentReviewOutbox.updateMany({
        where: {
          snapshotId: { in: snapshotIds },
          command: 'RELEASE_STUDENT_FEEDBACK',
          state: { in: ['RETRYABLE', 'BLOCKED', 'FAILED'] },
        },
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
          updatedAt: now,
        },
      });
    }
    return { snapshot, replay: false, assignment: completion };
  });
}

export type TeacherAssignmentOriginalAssetProjection = {
  id: string;
  displayName: string;
  mimeType: string;
  sizeBytes: number;
  role: 'EMBEDDED_IMAGE' | 'ATTACHMENT';
  orderIndex: number | null;
  embeddedPosition: string | null;
  accessEndpoint: string;
};

export type TeacherAssignmentOriginalResponseProjection = {
  textSnapshot: string | null;
  attachmentOrderProvenance: string | null;
  assets: TeacherAssignmentOriginalAssetProjection[];
};

export function buildTeacherAssignmentReviewApiProjection(review: any) {
  const attempt = review?.gradingRun?.answerAttempt;
  const textSnapshot = typeof attempt?.textSnapshot === 'string'
    ? attempt.textSnapshot
    : null;
  const assets: TeacherAssignmentOriginalAssetProjection[] = (
    Array.isArray(attempt?.assets) ? attempt.assets : []
  )
    .filter((asset: any) =>
      asset?.state === 'FINALIZED'
      && asset.attemptId === review.attemptId
      && asset.answerId === review.answerId)
    .map((asset: any): TeacherAssignmentOriginalAssetProjection => ({
      id: String(asset.id),
      displayName: safeOriginalAssetBasename(asset.originalName),
      mimeType: String(asset.mimeType ?? 'application/octet-stream'),
      sizeBytes: Number.isInteger(asset.sizeBytes) && asset.sizeBytes >= 0
        ? asset.sizeBytes
        : 0,
      role: asset.assetRole === 'EMBEDDED_IMAGE'
        ? 'EMBEDDED_IMAGE'
        : 'ATTACHMENT',
      orderIndex: Number.isInteger(asset.orderIndex) ? asset.orderIndex : null,
      embeddedPosition: typeof asset.embeddedPosition === 'string'
        ? asset.embeddedPosition
        : null,
      accessEndpoint: `/api/teacher/assignments/${encodeURIComponent(review.assignmentId)}/submissions/${encodeURIComponent(review.submissionId)}/review/assets/${encodeURIComponent(asset.id)}/read?reviewId=${encodeURIComponent(review.id)}`,
    }))
    .sort((
      left: TeacherAssignmentOriginalAssetProjection,
      right: TeacherAssignmentOriginalAssetProjection,
    ) => originalAssetOrder(left, right, textSnapshot));
  const displayNameByAssetId = new Map(
    assets.map((asset: TeacherAssignmentOriginalAssetProjection) =>
      [asset.id, asset.displayName]),
  );
  const omittedAssetIds = omittedEvidenceAssetIds(
    review?.gradingRun?.answerEvidence?.sourceManifest,
  );
  const omittedEvidence = omittedAssetIds.flatMap((assetId) => {
    const displayName = displayNameByAssetId.get(assetId);
    return displayName ? [{ assetId, displayName }] : [];
  });
  const incompleteEvidence =
    review?.gradingRun?.evidenceState === 'EVIDENCE_INCOMPLETE'
    || review?.gradingRun?.answerEvidence?.limitationState === 'evidence-incomplete';
  const question = review?.gradingRun?.question;
  const submission = review?.submission;
  const assignment = review?.assignment;

  return {
    id: review.id,
    assignmentId: review.assignmentId,
    assignmentRevisionId: review.assignmentRevisionId,
    submissionId: review.submissionId,
    answerId: review.answerId,
    attemptId: review.attemptId,
    questionId: review.questionId,
    gradingRunId: review.gradingRunId,
    state: review.state,
    version: review.version,
    criterionValues: review.criterionValues,
    annotationValues: review.annotationValues,
    derivedTotal: review.derivedTotal,
    overallComment: review.overallComment,
    approvedAt: review.approvedAt,
    returnedAt: review.returnedAt,
    assignment: {
      id: assignment?.id ?? review.assignmentId,
      title: assignment?.title ?? review?.revision?.title ?? null,
    },
    submission: {
      id: submission?.id ?? review.submissionId,
      student: {
        name: submission?.student?.name ?? null,
        profile: {
          studentNumber: submission?.student?.profile?.studentNumber ?? null,
        },
      },
    },
    gradingRun: {
      id: review?.gradingRun?.id ?? review.gradingRunId,
      state: review?.gradingRun?.state ?? null,
      evidenceState: review?.gradingRun?.evidenceState ?? null,
      questionSnapshot: review?.gradingRun?.questionSnapshot ?? null,
      assessments: (review?.gradingRun?.assessments ?? []).map((assessment: any) => ({
        id: assessment.id,
        criterionId: assessment.criterionId,
        levelId: assessment.levelId,
        score: assessment.score,
        rationale: assessment.rationale ?? '',
      })),
      annotations: (review?.gradingRun?.annotations ?? []).map((annotation: any) => ({
        id: annotation.id,
        criterionId: annotation.criterionId,
        comment: annotation.comment ?? '',
        origin: annotation.authorRole === 'TEACHER' ? 'TEACHER' : 'AI_DRAFT',
        anchor: {
          blockId: annotation.blockId ?? undefined,
          pageNumber: annotation.pageNumber ?? undefined,
          spanStart: annotation.spanStart ?? undefined,
          spanEnd: annotation.spanEnd ?? undefined,
          bbox: annotation.bbox ?? undefined,
          precision: String(annotation.precision ?? '').toUpperCase(),
          excerpt: annotation.excerpt ?? undefined,
        },
      })),
      question: {
        id: question?.id ?? review.questionId,
        stableQuestionId: question?.stableQuestionId ?? null,
        responseType: question?.responseType ?? null,
        orderIndex: question?.orderIndex ?? null,
        promptSnapshot: question?.promptSnapshot ?? null,
      },
    },
    originalResponse: {
      textSnapshot,
      attachmentOrderProvenance:
        typeof attempt?.answer?.attachmentOrderProvenance === 'string'
          ? attempt.answer.attachmentOrderProvenance
          : null,
      assets,
    } satisfies TeacherAssignmentOriginalResponseProjection,
    incompleteEvidence,
    omittedEvidence,
  };
}

export function safeOriginalAssetBasename(value: unknown): string {
  const normalized = typeof value === 'string'
    ? value.replace(/\\/g, '/').split('/').filter(Boolean).at(-1) ?? ''
    : '';
  const safe = normalized
    .replace(/[\p{Cc}\p{Cf}]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!safe || /^\.+$/.test(safe)) return '未命名附件';
  if (safe.length <= 180) return safe;
  const extension = safe.match(/(\.[A-Za-z0-9]{1,12})$/)?.[1] ?? '';
  return `${safe.slice(0, Math.max(1, 180 - extension.length))}${extension}`;
}

export async function signTeacherAssignmentOriginalAssetRead(db: any, input: {
  actor: TeacherReviewActor;
  assignmentId: string;
  submissionId: string;
  reviewId: string;
  assetId: string;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const review = await loadReview(db, input.reviewId);
  assertReviewPath(review, input.assignmentId, input.submissionId);
  assertReviewRunLineage(review);
  resolveTeacherAssignmentReviewAuthorization({
    actor: input.actor,
    review,
    now,
  });
  const asset = await loadTeacherOriginalAsset(db, review, input.assetId);
  if (!asset.checksum) {
    throw new TeacherAssignmentReviewError(
      'teacher-review-original-asset-unavailable',
      410,
    );
  }
  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(now.getTime() + 5 * 60_000);
  await db.submissionAssetAccessToken.create({
    data: {
      tokenHash: createHash('sha256').update(token).digest('hex'),
      assetId: asset.id,
      studentId: input.actor.id,
      purpose: 'teacher-assignment-original-read',
      expiresAt,
    },
  });
  return {
    url: `/api/teacher/assignments/${encodeURIComponent(input.assignmentId)}/submissions/${encodeURIComponent(input.submissionId)}/review/assets/${encodeURIComponent(asset.id)}/read?reviewId=${encodeURIComponent(input.reviewId)}&token=${encodeURIComponent(token)}`,
    expiresAt: expiresAt.toISOString(),
  };
}

export async function consumeTeacherAssignmentOriginalAssetRead(db: any, input: {
  actor: TeacherReviewActor;
  assignmentId: string;
  submissionId: string;
  reviewId: string;
  assetId: string;
  token: string;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const review = await loadReview(db, input.reviewId);
  assertReviewPath(review, input.assignmentId, input.submissionId);
  assertReviewRunLineage(review);
  resolveTeacherAssignmentReviewAuthorization({
    actor: input.actor,
    review,
    now,
  });
  const asset = await loadTeacherOriginalAsset(db, review, input.assetId);
  const tokenHash = createHash('sha256').update(input.token).digest('hex');
  const claimed = await db.submissionAssetAccessToken.updateMany({
    where: {
      tokenHash,
      assetId: asset.id,
      studentId: input.actor.id,
      purpose: 'teacher-assignment-original-read',
      expiresAt: { gt: now },
      usedAt: null,
    },
    data: { usedAt: now },
  });
  if (claimed?.count !== 1) {
    throw new TeacherAssignmentReviewError(
      'teacher-review-original-asset-token-invalid',
      403,
    );
  }
  if (!asset.checksum) {
    throw new TeacherAssignmentReviewError(
      'teacher-review-original-asset-unavailable',
      410,
    );
  }
  return {
    objectKey: asset.objectKey,
    displayName: safeOriginalAssetBasename(asset.originalName),
    mimeType: asset.mimeType,
    sizeBytes: asset.sizeBytes,
    checksum: asset.checksum,
  };
}

function omittedEvidenceAssetIds(value: unknown): string[] {
  if (!value || typeof value !== 'object') return [];
  const sources = Array.isArray((value as { sources?: unknown }).sources)
    ? (value as { sources: unknown[] }).sources
    : [];
  return [...new Set(sources.flatMap((source) => {
    if (!source || typeof source !== 'object') return [];
    const row = source as { assetId?: unknown; state?: unknown; limitations?: unknown };
    return typeof row.assetId === 'string'
      && row.assetId
      && (row.state !== 'READY'
        || (Array.isArray(row.limitations) && row.limitations.length > 0))
      ? [row.assetId]
      : [];
  }))];
}

function originalAssetOrder(
  left: TeacherAssignmentOriginalAssetProjection,
  right: TeacherAssignmentOriginalAssetProjection,
  textSnapshot: string | null,
) {
  if (left.role === 'EMBEDDED_IMAGE' || right.role === 'EMBEDDED_IMAGE') {
    const leftPosition = left.embeddedPosition && textSnapshot
      ? textSnapshot.indexOf(`asset:${left.embeddedPosition}`)
      : -1;
    const rightPosition = right.embeddedPosition && textSnapshot
      ? textSnapshot.indexOf(`asset:${right.embeddedPosition}`)
      : -1;
    if (left.role !== right.role) return left.role === 'EMBEDDED_IMAGE' ? -1 : 1;
    if (leftPosition !== rightPosition) {
      return (leftPosition < 0 ? Number.MAX_SAFE_INTEGER : leftPosition)
        - (rightPosition < 0 ? Number.MAX_SAFE_INTEGER : rightPosition);
    }
  }
  return (left.orderIndex ?? Number.MAX_SAFE_INTEGER)
    - (right.orderIndex ?? Number.MAX_SAFE_INTEGER)
    || left.id.localeCompare(right.id);
}

async function loadTeacherOriginalAsset(db: any, review: any, assetId: string) {
  const asset = await db.submissionAsset.findUnique({ where: { id: assetId } });
  if (!asset
    || asset.state !== 'FINALIZED'
    || asset.attemptId !== review.attemptId
    || asset.answerId !== review.answerId) {
    throw new TeacherAssignmentReviewError(
      'teacher-review-original-asset-forbidden',
      403,
    );
  }
  return asset;
}

function sameStringSet(left: string[], right: string[]) {
  const leftSet = new Set(left);
  const rightSet = new Set(right);
  return leftSet.size === rightSet.size
    && [...leftSet].every((value) => rightSet.has(value));
}

export async function returnTeacherAssignmentReview(db: any, input: {
  actor: TeacherReviewActor;
  assignmentId: string;
  submissionId: string;
  reviewId: string;
  expectedVersion: number;
  idempotencyKey: string;
  reason: string;
  allowedResponseType: string;
  newDeadlineAt: Date;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  return runSerializable(db, async (tx) => {
    const review = await loadReview(tx, input.reviewId);
    assertReviewPath(review, input.assignmentId, input.submissionId);
    assertReviewRunLineage(review);
    const authorization = resolveTeacherAssignmentReviewAuthorization({ actor: input.actor, review, now });
    const requestHash = sha256(stableStringify({
      reviewId: input.reviewId,
      expectedVersion: input.expectedVersion,
      actorId: input.actor.id,
      reason: input.reason,
      allowedResponseType: input.allowedResponseType,
      newDeadlineAt: input.newDeadlineAt.toISOString(),
    }));
    const existing = await tx.teacherAssignmentResubmissionGrant.findUnique?.({ where: { idempotencyKey: input.idempotencyKey } });
    if (existing) {
      if (existing.sourceReviewId !== input.reviewId || existing.teacherId !== input.actor.id || existing.requestHash !== requestHash) {
        throw new TeacherAssignmentReviewError('teacher-review-idempotency-conflict', 409);
      }
      return { grant: existing, replay: true };
    }
    if (input.newDeadlineAt <= now) throw new TeacherAssignmentReviewError('teacher-review-resubmission-deadline-invalid', 422);
    if (review.gradingRun.question.responseType !== input.allowedResponseType) {
      throw new TeacherAssignmentReviewError('teacher-review-response-type-invalid', 422);
    }
    if (review.state !== 'WORKING' || review.version !== input.expectedVersion) throw conflict();
    const reviewCas = await tx.teacherAssignmentReview.updateMany({
      where: { id: review.id, assignmentId: input.assignmentId, submissionId: input.submissionId, state: 'WORKING', version: input.expectedVersion },
      data: { state: 'RETURNED', version: { increment: 1 }, reviewerId: input.actor.id, returnedAt: now, updatedAt: now },
    });
    if (reviewCas?.count !== 1) throw conflict();
    const runCas = await tx.gradingRun.updateMany({
      where: { id: review.gradingRunId, state: 'AWAITING_REVIEW', teacherReviewedAt: null },
      data: { state: 'CANCELLED', teacherReviewedAt: now, updatedAt: now },
    });
    if (runCas?.count !== 1) throw conflict();
    const grant = await tx.teacherAssignmentResubmissionGrant.create({
      data: {
        assignmentId: review.assignmentId,
        assignmentRevisionId: review.assignmentRevisionId,
        submissionId: review.submissionId,
        answerId: review.answerId,
        attemptId: review.attemptId,
        questionId: review.questionId,
        sourceReviewId: review.id,
        sourceGradingRunId: review.gradingRunId,
        teacherId: input.actor.id,
        idempotencyKey: input.idempotencyKey,
        requestHash,
        state: 'ACTIVE',
        reason: input.reason,
        allowedResponseType: input.allowedResponseType,
        newDeadlineAt: input.newDeadlineAt,
        authorizationSnapshot: authorization.snapshot,
        grantedAt: now,
        expiresAt: input.newDeadlineAt,
      },
    });
    await tx.submissionAnswer.update({
      where: { id: review.answerId },
      data: { state: 'DRAFT', version: { increment: 1 }, updatedAt: now },
    });
    await tx.assignmentSubmission.update({ where: { id: review.submissionId }, data: { reviewState: 'RETURNED', approvedTotal: null, reviewedAt: null, updatedAt: now } });
    return { grant, replay: false };
  });
}

export async function requestTeacherAssignmentFeedbackRelease(db: any, input: {
  actor: TeacherReviewActor;
  assignmentId: string;
  submissionId: string;
  reviewId: string;
  mode: 'RETRY_DERIVATIVE' | 'STRUCTURED_ONLY';
  limitationAcknowledgement?: string;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  return runSerializable(db, async (tx) => {
    const review = await loadReview(tx, input.reviewId);
    assertReviewPath(review, input.assignmentId, input.submissionId);
    assertReviewRunLineage(review);
    resolveTeacherAssignmentReviewAuthorization({ actor: input.actor, review, now });
    if (review.state !== 'APPROVED' || !review.approvalSnapshot) throw new TeacherAssignmentReviewError('teacher-review-release-not-approved', 409);
    const commands = await tx.teacherAssignmentReviewOutbox.findMany({ where: { snapshotId: review.approvalSnapshot.id } });
    const release = commands.find((row: any) => row.command === 'RELEASE_STUDENT_FEEDBACK');
    const derivative = commands.find((row: any) => row.command === 'GENERATE_DERIVATIVE');
    if (!release || !derivative) throw new TeacherAssignmentReviewError('teacher-review-release-command-missing', 409);
    if (release.state === 'SUCCEEDED') return { replay: true, mode: 'PUBLISHED' as const };
    if (!['APPROVED_PENDING_RELEASE', 'RELEASE_BLOCKED'].includes(review.submission.reviewState)) {
      throw new TeacherAssignmentReviewError('teacher-review-release-incomplete', 409);
    }
    if (input.mode === 'STRUCTURED_ONLY' && (input.limitationAcknowledgement?.trim().length ?? 0) < 8) {
      throw new TeacherAssignmentReviewError('teacher-review-fallback-acknowledgement-required', 422);
    }
    if (input.mode === 'RETRY_DERIVATIVE') {
      await tx.teacherAssignmentReviewedDerivative.updateMany({
        where: { snapshotId: review.approvalSnapshot.id, state: { in: ['BLOCKED', 'FAILED'] } },
        data: {
          state: 'RETRYABLE',
          outputObjectKey: null,
          outputChecksum: null,
          outputSizeBytes: null,
          readyAt: null,
          claimToken: null,
          claimedAt: null,
          leaseExpiresAt: null,
          lastErrorCode: null,
          updatedAt: now,
        },
      });
      await tx.teacherAssignmentReviewOutbox.updateMany({
        where: { id: derivative.id, state: { in: ['RETRYABLE', 'BLOCKED', 'FAILED'] } },
        data: { state: 'PENDING', availableAt: now, claimToken: null, claimedAt: null, leaseExpiresAt: null, lastErrorCode: null, limitationCode: null, processedAt: null, updatedAt: now },
      });
    }
    const payload = release.payload && typeof release.payload === 'object' && !Array.isArray(release.payload) ? release.payload : {};
    await tx.teacherAssignmentReviewOutbox.update({
      where: { id: release.id },
      data: {
        state: 'PENDING',
        availableAt: now,
        claimToken: null,
        claimedAt: null,
        leaseExpiresAt: null,
        lastErrorCode: null,
        limitationCode: null,
        processedAt: null,
        payload: input.mode === 'STRUCTURED_ONLY' ? {
          ...payload,
          structuredOnlyFallback: true,
          fallbackApproval: { actorId: input.actor.id, approvedAt: now.toISOString(), limitationAcknowledgement: input.limitationAcknowledgement?.trim() },
        } : { ...payload, structuredOnlyFallback: false },
        updatedAt: now,
      },
    });
    await tx.assignmentSubmission.update({ where: { id: review.submissionId }, data: { reviewState: 'APPROVED_PENDING_RELEASE', reviewedAt: null, updatedAt: now } });
    return { replay: false, mode: input.mode };
  });
}

export async function createTeacherAssignmentReview(db: any, input: { actor: TeacherReviewActor; assignmentId: string; submissionId: string; gradingRunId: string; now?: Date }) {
  const now = input.now ?? new Date();
  const existing = await db.teacherAssignmentReview.findUnique({ where: { gradingRunId: input.gradingRunId }, include: TEACHER_ASSIGNMENT_REVIEW_INCLUDE });
  if (existing) {
    assertReviewPath(existing, input.assignmentId, input.submissionId);
    assertReviewRunLineage(existing);
    resolveTeacherAssignmentReviewAuthorization({ actor: input.actor, review: existing, now });
    return { review: existing, replay: true };
  }
  const run = await db.gradingRun.findUnique({
    where: { id: input.gradingRunId },
    include: {
      assessments: true,
      annotations: true,
      answerEvidence: true,
      answerAttempt: { include: { answer: { include: { submission: { include: { audience: { include: { class: true } }, student: { include: { profile: true } }, revision: { include: { assignment: { include: { reviewGrants: true } } } } } } } } } },
      question: true,
    },
  });
  const submission = run?.answerAttempt?.answer?.submission;
  const assignment = submission?.revision?.assignment;
  if (!run || !submission || !assignment || run.state !== 'AWAITING_REVIEW' || run.answerEvidence?.readiness !== 'READY') {
    throw new TeacherAssignmentReviewError('teacher-review-run-not-ready', 409);
  }
  const reviewScope = {
    assignmentId: assignment.id,
    assignmentRevisionId: submission.assignmentRevisionId,
    submissionId: submission.id,
    assignment,
    submission,
  };
  assertReviewPath(reviewScope, input.assignmentId, input.submissionId);
  assertReviewRunLineage({
    ...reviewScope,
    answerId: run.answerAttempt?.answerId,
    attemptId: run.answerAttemptId,
    questionId: run.questionId,
    gradingRunId: run.id,
    answerEvidenceId: run.answerEvidenceId,
    gradingRun: run,
  });
  const authorization = resolveTeacherAssignmentReviewAuthorization({ actor: input.actor, review: reviewScope, now });
  const values = run.assessments.map((assessment: any) => ({
    criterionId: assessment.criterionId,
    levelId: assessment.teacherLevelId ?? assessment.levelId,
    score: assessment.teacherScore ?? assessment.score,
    comment: assessment.teacherComment ?? '',
  }));
  const total = deriveTeacherAssignmentReviewTotal(run.questionSnapshot?.rubric, values);
  const annotationValues = run.annotations.map((annotation: any) => ({
    id: annotation.id,
    criterionId: annotation.criterionId,
    status: 'ACTIVE',
    comment: annotation.comment,
    origin: annotation.authorRole === 'TEACHER' ? 'TEACHER' : 'AI_DRAFT',
    anchor: {
      blockId: annotation.blockId ?? undefined,
      pageNumber: annotation.pageNumber ?? undefined,
      spanStart: annotation.spanStart ?? undefined,
      spanEnd: annotation.spanEnd ?? undefined,
      bbox: annotation.bbox ?? undefined,
      precision: String(annotation.precision).toUpperCase(),
      excerpt: annotation.excerpt,
    },
  }));
  try {
    const created = await db.teacherAssignmentReview.create({
      data: {
        assignmentId: assignment.id,
        assignmentRevisionId: submission.assignmentRevisionId,
        submissionId: submission.id,
        answerId: run.answerAttempt.answerId,
        attemptId: run.answerAttemptId,
        questionId: run.questionId,
        gradingRunId: run.id,
        answerEvidenceId: run.answerEvidenceId,
        reviewerId: input.actor.id,
        state: 'WORKING',
        version: 1,
        machineSnapshotHash: sha256(stableStringify({ inputHash: run.inputHash, rubricVersion: run.rubricVersion, evaluatorVersion: run.evaluatorVersion, assessments: run.assessments, annotations: run.annotations })),
        criterionValues: values,
        annotationValues: jsonValue(annotationValues),
        derivedTotal: total,
        overallComment: run.overallComment,
        authorizationSnapshot: authorization.snapshot,
        lifecyclePolicyVersion: run.lifecyclePolicyVersion ?? null,
        createdAt: now,
        updatedAt: now,
      },
      include: TEACHER_ASSIGNMENT_REVIEW_INCLUDE,
    });
    return { review: created, replay: false };
  } catch (error) {
    if (!isUniqueConstraintError(error)) throw error;
    const winner = await db.teacherAssignmentReview.findUnique({ where: { gradingRunId: input.gradingRunId }, include: TEACHER_ASSIGNMENT_REVIEW_INCLUDE });
    if (!winner) throw error;
    assertReviewPath(winner, input.assignmentId, input.submissionId);
    assertReviewRunLineage(winner);
    resolveTeacherAssignmentReviewAuthorization({ actor: input.actor, review: winner, now });
    return { review: winner, replay: true };
  }
}

export async function getTeacherAssignmentReview(db: any, input: { actor: TeacherReviewActor; assignmentId: string; submissionId: string; reviewId?: string; gradingRunId?: string; now?: Date }) {
  if (!input.reviewId && !input.gradingRunId) {
    throw new TeacherAssignmentReviewError('teacher-review-not-found', 404);
  }
  const where = input.reviewId ? { id: input.reviewId } : { gradingRunId: input.gradingRunId };
  const review = await db.teacherAssignmentReview.findUnique({ where, include: TEACHER_ASSIGNMENT_REVIEW_INCLUDE });
  if (!review) throw new TeacherAssignmentReviewError('teacher-review-not-found', 404);
  assertReviewPath(review, input.assignmentId, input.submissionId);
  assertReviewRunLineage(review);
  resolveTeacherAssignmentReviewAuthorization({ actor: input.actor, review, now: input.now });
  return review;
}

export function deriveTeacherReviewQueueStatus(run: any) {
  const review = run?.teacherAssignmentReview;
  return review?.state === 'WORKING' ? 'IN_REVIEW'
    : run?.approvalSnapshot || review?.state === 'APPROVED' || run?.state === 'APPROVED' ? 'APPROVED'
      : review?.state === 'RETURNED' || run?.state === 'RETURNED' ? 'RETURNED'
        : run?.state === 'AWAITING_REVIEW' ? 'READY'
          : run && ['QUEUED', 'RUNNING', 'RETRYABLE'].includes(run.state) ? 'PROCESSING'
            : run && ['BLOCKED', 'FAILED', 'CONTENT_UNAVAILABLE'].includes(run.state) ? 'BLOCKED'
              : 'NOT_SUBMITTED';
}

export async function listTeacherAssignmentSubmissions(db: any, input: { actor: TeacherReviewActor; assignmentId: string; now?: Date }) {
  const now = input.now ?? new Date();
  const assignment = await db.assignment.findUnique({ where: { id: input.assignmentId }, include: { reviewGrants: true } });
  if (!assignment) throw new TeacherAssignmentReviewError('teacher-review-assignment-not-found', 404);
  const assignmentWide = input.actor.role === 'ADMIN'
    || assignment.authorId === input.actor.id
    || assignment.reviewGrants.some((grant: any) => grant.teacherId === input.actor.id && grant.revokedAt == null && (grant.expiresAt == null || new Date(grant.expiresAt) > now));
  const rows = await db.assignmentSubmission.findMany({
    where: {
      revision: { assignmentId: input.assignmentId },
      ...(assignmentWide ? {} : { audience: { archivedAt: null, class: { teacherId: input.actor.id, isActive: true } } }),
    },
    include: {
      revision: { include: { assignment: { include: { reviewGrants: true } }, questions: true } },
      audience: { include: { class: true } },
      student: { include: { profile: true } },
      answers: { include: { attempts: { include: { gradingRuns: { include: { teacherAssignmentReview: true, approvalSnapshot: true } } } } } },
    },
    orderBy: [{ updatedAt: 'asc' }, { id: 'asc' }],
  });
  const visible = [];
  for (const submission of rows) {
    const scope = { assignmentId: input.assignmentId, assignmentRevisionId: submission.assignmentRevisionId, submissionId: submission.id, assignment: submission.revision.assignment, submission };
    try {
      resolveTeacherAssignmentReviewAuthorization({ actor: input.actor, review: scope, now });
    } catch (error) {
      if (error instanceof TeacherAssignmentReviewError && error.status === 403) continue;
      throw error;
    }
    const runs = submission.answers.flatMap((answer: any) => answer.attempts.flatMap((attempt: any) => attempt.gradingRuns));
    const latestRunByQuestion = new Map<string, any>();
    for (const run of runs) {
      const current = latestRunByQuestion.get(run.questionId);
      if (!current || new Date(run.updatedAt ?? run.createdAt).getTime() > new Date(current.updatedAt ?? current.createdAt).getTime()) {
        latestRunByQuestion.set(run.questionId, run);
      }
    }
    const questions = [...submission.revision.questions]
      .sort((left: any, right: any) => left.orderIndex - right.orderIndex || String(left.id).localeCompare(String(right.id)))
      .map((question: any) => {
        const run = latestRunByQuestion.get(question.id);
        const review = run?.teacherAssignmentReview;
        const status = deriveTeacherReviewQueueStatus(run);
        return {
          id: question.id,
          questionId: question.id,
          stableQuestionId: question.stableQuestionId,
          title: typeof question.promptSnapshot === 'string'
            ? question.promptSnapshot.slice(0, 160)
            : String(question.promptSnapshot?.prompt ?? question.promptSnapshot?.text ?? `第 ${question.orderIndex + 1} 题`).slice(0, 160),
          orderIndex: question.orderIndex,
          responseKind: question.responseType,
          status,
          reviewId: review?.id ?? null,
          gradingRunId: run?.id ?? null,
        };
      });
    visible.push({
      submissionId: submission.id,
      studentId: submission.frozenStudentId,
      studentName: submission.student.name ?? '未知学生',
      studentNumber: submission.student.profile?.studentNumber ?? null,
      classId: submission.frozenAudienceClassId,
      state: submission.state,
      reviewState: submission.reviewState,
      approvedTotal: submission.approvedTotal,
      requiredQuestionCount: submission.requiredQuestionCount,
      submittedRequiredCount: submission.submittedRequiredCount,
      pendingReviewCount: runs.filter((run: any) => run.state === 'AWAITING_REVIEW').length,
      approvedQuestionCount: runs.filter((run: any) => run.approvalSnapshot).length,
      questions,
      updatedAt: submission.updatedAt,
    });
  }
  return visible;
}

function approvalOutboxRows(snapshot: any, review: any, now: Date) {
  const commands = [
    ['GENERATE_DERIVATIVE', 'generate-derivative'],
    ['RELEASE_STUDENT_FEEDBACK', 'release-student-feedback'],
    ['PROCESS_GOVERNED_EVIDENCE', 'process-governed-evidence'],
  ] as const;
  return commands.map(([command, suffix]) => ({
    snapshotId: snapshot.id,
    command,
    state: 'PENDING',
    dedupeKey: `teacher-review:${snapshot.id}:${suffix}`,
    correlationId: `teacher-review:${review.submissionId}`,
    causationId: snapshot.id,
    payload: { version: 'teacher-assignment-review-command.v1', snapshotId: snapshot.id, reviewId: review.id, assignmentId: review.assignmentId, submissionId: review.submissionId, questionId: review.questionId, attemptId: review.attemptId, reviewVersion: snapshot.reviewVersion, rubricVersion: snapshot.rubricVersion, evaluatorVersion: snapshot.evaluatorVersion, lifecyclePolicyVersion: snapshot.lifecyclePolicyVersion },
    availableAt: now,
    createdAt: now,
    updatedAt: now,
  }));
}

async function loadReview(db: any, reviewId: string) {
  const review = await db.teacherAssignmentReview.findUnique({ where: { id: reviewId }, include: TEACHER_ASSIGNMENT_REVIEW_INCLUDE });
  if (!review) throw new TeacherAssignmentReviewError('teacher-review-not-found', 404);
  return review;
}

async function loadSubmissionCompleteness(db: any, submissionId: string) {
  const row = await db.assignmentSubmission.findUnique({
    where: { id: submissionId },
    include: {
      revision: { include: { questions: { orderBy: { orderIndex: 'asc' } } } },
      answers: { include: { attempts: { include: { gradingRuns: { orderBy: { createdAt: 'desc' }, take: 1 } } } } },
      resubmissionGrants: true,
      questionExemptions: true,
    },
  });
  if (!row) throw new TeacherAssignmentReviewError('teacher-review-submission-not-found', 404);
  return row;
}

function assertReviewPath(review: any, assignmentId: string, submissionId: string) {
  if (!review || review.assignmentId !== assignmentId || review.submissionId !== submissionId) {
    throw new TeacherAssignmentReviewError('teacher-review-not-found', 404);
  }
}

function asCriterionValues(value: unknown): ReviewCriterionValue[] {
  if (!Array.isArray(value)) throw new TeacherAssignmentReviewError('teacher-review-criteria-incomplete', 422);
  return value as ReviewCriterionValue[];
}

function validateReviewAnnotations(rubric: any, annotations: ReviewAnnotationValue[]) {
  const criterionIds = new Set((rubric?.criteria ?? []).map((criterion: any) => criterion.id));
  const ids = new Set<string>();
  for (const annotation of annotations) {
    if (!criterionIds.has(annotation.criterionId)) throw new TeacherAssignmentReviewError('teacher-review-annotation-criterion-invalid', 422);
    if (annotation.id && ids.has(annotation.id)) throw new TeacherAssignmentReviewError('teacher-review-annotation-duplicate', 422);
    if (annotation.id) ids.add(annotation.id);
    if (annotation.status === 'SUPPRESSED') continue;
    const precision = String(annotation.anchor?.precision ?? '').toUpperCase();
    if (!['SPAN', 'BLOCK', 'PAGE'].includes(precision)) throw new TeacherAssignmentReviewError('teacher-review-annotation-anchor-invalid', 422);
    const hasLocation = typeof annotation.anchor?.blockId === 'string'
      || Number.isInteger(annotation.anchor?.pageNumber)
      || (Number.isInteger(annotation.anchor?.spanStart) && Number.isInteger(annotation.anchor?.spanEnd));
    if (!hasLocation) throw new TeacherAssignmentReviewError('teacher-review-annotation-anchor-invalid', 422);
  }
}

function assertReviewRunLineage(review: any) {
  const run = review?.gradingRun;
  const attempt = run?.answerAttempt;
  const answer = attempt?.answer;
  const evidence = run?.answerEvidence;
  const question = run?.question;
  if (!run || !attempt || !answer || !evidence || !question
    || review.gradingRunId !== run.id
    || review.attemptId !== run.answerAttemptId
    || review.attemptId !== attempt.id
    || review.answerId !== answer.id
    || answer.submissionId !== review.submissionId
    || review.answerEvidenceId !== run.answerEvidenceId
    || review.answerEvidenceId !== evidence.id
    || evidence.attemptId !== review.attemptId
    || review.questionId !== run.questionId
    || review.questionId !== question.id
    || answer.assignmentQuestionId !== review.questionId
    || question.assignmentRevisionId !== review.assignmentRevisionId) {
    throw new TeacherAssignmentReviewError('teacher-review-run-lineage-invalid', 409);
  }
}

function isUniqueConstraintError(error: unknown): boolean {
  return Boolean(error && typeof error === 'object' && 'code' in error && (error as { code?: string }).code === 'P2002');
}

function jsonValue<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function conflict() {
  return new TeacherAssignmentReviewError('teacher-review-version-conflict', 409);
}

async function runSerializable<T>(db: any, callback: (tx: any) => Promise<T>): Promise<T> {
  if (typeof db.$transaction !== 'function') return callback(db);
  return db.$transaction(callback, { isolationLevel: 'Serializable' });
}
