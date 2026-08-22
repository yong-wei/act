import { Prisma, UserRole } from '@prisma/client';
import { NextResponse } from 'next/server';

import { getServerAuthSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import {
  selectLearningFactAuthority,
  writeKnowledgeScopedLearningFacts,
  type LearningFactWriteRow,
} from '@/lib/canonical-learning-fact-identity';
import {
  approveGradingRun,
  editCriterionGrade,
  parsePersistedDocumentRubricGradingDraft,
  validateDocumentRubricGradingDraftInvariants,
  writeApprovedGradingEvidence,
} from '@/lib/data-governance/document-rubric-grading-workbench';
import { rethrowIfNextDynamicError } from '@/lib/nextjs-dynamic-error';
import {
  GradingMutationError,
  validateGradingMutationOrigin,
} from '@/lib/data-governance/math-document-grading-contracts';
import {
  buildPipelineReviewFactCandidates,
  buildPipelineReviewFacts,
  assertPipelineReviewActor,
  isPipelineRunReviewable,
  PIPELINE_GRADING_REVIEW_INCLUDE,
  pipelineReviewScope,
  validatePipelineReviewContract,
  validatePipelineReviewEdits,
  validatePipelineRuntimeSource,
} from '@/lib/data-governance/math-document-grading-review';
import { writeGradingAudit } from '@/lib/data-governance/math-document-grading-persistence';
import { gradingRequestScope, pseudonymousAuditId, sha256, stableStringify } from '@/lib/data-governance/math-document-grading-contracts';
import { createSubmissionObjectStore } from '@/lib/assignments/submission-object-store';
import { hasAtMostOneDecimal } from '@/lib/assignments/assignment-rubric-contract';
import { requestCumulativeLearnerReconciliation } from '@/lib/data-governance/cumulative-snapshot-jobs';
import { resolveActiveKnowledgeRevision } from '@/lib/data-governance/knowledge-truth-revision';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const session = await getServerAuthSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: '未授权' }, { status: 401 });
    }
    if (session.user.role !== UserRole.TEACHER && session.user.role !== UserRole.ADMIN) {
      return NextResponse.json({ error: '无权审批文档评分' }, { status: 403 });
    }
    validateGradingMutationOrigin({ request });

    const body = await request.json() as {
      gradingRunId?: string;
      decision?: unknown;
      edits?: Array<{
        criterionId?: unknown;
        levelId?: unknown;
        score?: unknown;
        comment?: unknown;
      }>;
      notes?: unknown;
      idempotencyKey?: string;
    };
    if (!body.gradingRunId) {
      return NextResponse.json({ error: '缺少评分运行标识' }, { status: 400 });
    }
    if (body.decision !== undefined && !isDocumentGradingDecision(body.decision)) {
      return NextResponse.json({ error: '审批决策无效' }, { status: 400 });
    }
    if (body.edits !== undefined && !isDocumentGradingEditList(body.edits)) {
      return NextResponse.json({ error: '评分编辑无效' }, { status: 400 });
    }
    if (body.idempotencyKey !== undefined && (!/^[A-Za-z0-9._:-]{8,160}$/.test(body.idempotencyKey))) {
      return NextResponse.json({ error: '审批幂等键无效' }, { status: 400 });
    }
    if (body.notes !== undefined && (typeof body.notes !== 'string' || body.notes.length > 2000)) {
      return NextResponse.json({ error: '审批备注无效' }, { status: 400 });
    }
    const notes = typeof body.notes === 'string' ? body.notes.trim() : undefined;

    const pipelineRun = await prisma.gradingRun.findUnique({
      where: { id: body.gradingRunId },
      include: PIPELINE_GRADING_REVIEW_INCLUDE,
    });
    if (pipelineRun) {
      if (body.decision !== undefined && body.decision !== 'approved') {
        return NextResponse.json({ error: 'native-grading-decision-unsupported' }, { status: 400 });
      }
      return await approvePipelineRun({
        run: pipelineRun,
        reviewerId: session.user.id,
        reviewerRole: session.user.role,
        decision: body.decision ?? 'approved',
        edits: body.edits ?? [],
        notes,
        idempotencyKey: body.idempotencyKey,
      });
    }

    const draft = await prisma.learningEvidenceDraft.findFirst({
      where: {
        id: body.gradingRunId,
        sourceType: 'document_rubric_grading',
      },
    });
    if (!draft) {
      return NextResponse.json({ error: '评分草稿不存在' }, { status: 404 });
    }

    const parsed = parsePersistedDocumentRubricGradingDraft(draft);
    if (!parsed) {
      return NextResponse.json({ error: '评分草稿结构不可用' }, { status: 422 });
    }
    const invariants = validateDocumentRubricGradingDraftInvariants({ draft, parsed });
    if (!invariants.valid) {
      return NextResponse.json({
        error: '评分草稿归属不一致',
        reasons: invariants.reasons,
      }, { status: 422 });
    }

    const classData = await prisma.class.findUnique({
      where: { id: parsed.goalContext.classId },
      select: { id: true, teacherId: true },
    });
    if (!classData) {
      return NextResponse.json({ error: '班级不存在' }, { status: 404 });
    }
    if (session.user.role !== UserRole.ADMIN && classData.teacherId !== session.user.id) {
      return NextResponse.json({ error: '权限不足' }, { status: 403 });
    }

    const studentProfile = await prisma.studentProfile.findFirst({
      where: {
        classId: parsed.goalContext.classId,
        userId: draft.ownerUserId,
      },
      select: { id: true },
    });
    if (!studentProfile) {
      return NextResponse.json({ error: '学生不在该班级中' }, { status: 404 });
    }
    const alreadyApproved = parsed.run.status === 'approved' || draft.reviewerState === 'approved';
    if (alreadyApproved) {
      if ((body.edits ?? []).length > 0) {
        return NextResponse.json({ error: '已批准评分不能直接编辑' }, { status: 409 });
      }
      return NextResponse.json({ error: 'grading-review-already-approved' }, { status: 409 });
    }
    if (parsed.run.status === 'blocked' || parsed.run.evaluator.status === 'blocked') {
      return NextResponse.json({
        error: '评分草稿存在阻塞的评估器输出，需要重新转换或重新评估后再审批',
        reasons: parsed.run.evaluator.blockedReasons,
      }, { status: 409 });
    }
    const editValidationError = validateDocumentGradingEditsAgainstRubric(
      body.edits ?? [],
      parsed.rubric,
    );
    if (editValidationError) {
      return NextResponse.json({ error: editValidationError }, { status: 400 });
    }

    const decision = body.decision ?? 'approved';
    const editedRun = (body.edits ?? []).reduce((run, edit) => editCriterionGrade(run, {
      criterionId: edit.criterionId,
      levelId: edit.levelId,
      score: edit.score,
      comment: edit.comment,
      reviewerId: session.user.id,
      rubric: parsed.rubric,
    }), parsed.run);
    const approved = approveGradingRun(editedRun, {
      reviewerId: session.user.id,
      decision,
      notes,
    });
    const existingSummary = typeof draft.summary === 'object' && draft.summary !== null && !Array.isArray(draft.summary)
      ? draft.summary as Record<string, unknown>
      : {};
    const existingProvenance = typeof draft.provenance === 'object' && draft.provenance !== null && !Array.isArray(draft.provenance)
      ? draft.provenance as Record<string, unknown>
      : {};

    const updatedSummary = toPrismaJsonObject({
      ...existingSummary,
      run: approved,
    });
    const updatedProvenance = toPrismaJsonObject({
      ...existingProvenance,
      reviewerId: session.user.id,
      reviewedAt: approved.teacherReview.reviewedAt,
      decision,
    });

    const writeback = await prisma.$transaction(async (tx) => {
      const [currentDraft, currentClass, currentMembership] = await Promise.all([
        tx.learningEvidenceDraft.findFirst({ where: { id: draft.id, sourceType: 'document_rubric_grading' } }),
        tx.class.findUnique({ where: { id: parsed.goalContext.classId }, select: { id: true, teacherId: true } }),
        tx.studentProfile.findFirst({ where: { userId: draft.ownerUserId, classId: parsed.goalContext.classId }, select: { id: true } }),
      ]);
      if (!currentDraft || new Date(currentDraft.updatedAt).getTime() !== new Date(draft.updatedAt).getTime() || currentDraft.ownerUserId !== draft.ownerUserId) throw new GradingMutationError('grading-review-conflict', 409);
      if (!currentClass || (session.user.role !== UserRole.ADMIN && currentClass.teacherId !== session.user.id)) throw new GradingMutationError('grading-review-forbidden', 403);
      if (!currentMembership) throw new GradingMutationError('grading-review-membership-changed', 409);
      const reviewUpdate = await tx.learningEvidenceDraft.updateMany({
        where: {
          id: draft.id,
          reviewerState: draft.reviewerState,
          updatedAt: draft.updatedAt,
        },
        data: {
          reviewerState: decision,
          summary: updatedSummary,
          provenance: updatedProvenance,
        },
      });
      if (reviewUpdate.count !== 1) {
        throw new GradingMutationError('grading-review-conflict', 409);
      }
      if (decision !== 'approved') {
        return {
          status: 'blocked-unapproved' as const,
          created: 0,
          skipped: 0,
          blocked: approved.draftGrades.length,
          facts: [],
        };
      }

      const result = await writeApprovedGradingEvidence({
        db: {
          learningFact: {
            createMany: async (input) => tx.learningFact.createMany({
              data: input.data as NonNullable<Parameters<typeof prisma.learningFact.createMany>[0]>['data'],
              skipDuplicates: input.skipDuplicates,
            }),
          },
          studentEvidenceFeatureCache: {
            deleteMany: async (input) => tx.studentEvidenceFeatureCache.deleteMany(input),
          },
        },
        run: approved,
        rubric: parsed.rubric,
        studentId: draft.ownerUserId,
        goalContext: parsed.goalContext,
        sourceLogId: currentDraft.id,
      });
      await requestCumulativeLearnerReconciliation(tx, {
        userId: draft.ownerUserId,
        classIds: parsed.goalContext.classId ? [parsed.goalContext.classId] : [],
        reason: 'document-grading-approved',
      });
      return result;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    return NextResponse.json({
      status: decision,
      gradingRunId: approved.id,
      createdFacts: writeback.created,
      skippedFacts: writeback.skipped,
      blockedFacts: writeback.blocked,
      evidenceSourceEventIds: writeback.facts.map((fact) => fact.sourceEventId),
    });
  } catch (error) {
    rethrowIfNextDynamicError(error);
    if (error instanceof PipelineReviewContractError) {
      return NextResponse.json({ error: error.code, reasons: error.reasons }, { status: error.status });
    }
    if (error instanceof GradingMutationError) {
      return NextResponse.json({ error: error.code }, { status: error.status });
    }
    console.error('[DocumentRubricGrading] approve failed', error);
    return NextResponse.json({ error: '审批文档评分失败' }, { status: 500 });
  }
}

async function approvePipelineRun(input: {
  run: any;
  reviewerId: string;
  reviewerRole: UserRole;
  decision: 'approved';
  edits: Array<{ criterionId: string; levelId: string | null; score: number; comment: string }>;
  notes?: string;
  idempotencyKey?: string;
}) {
  if (!isPipelineRunReviewable(input.run)) {
    return NextResponse.json({ error: '评分运行当前不可审批' }, { status: 409 });
  }
  const initialScope = pipelineReviewScope(input.run);
  await assertPipelineReviewActor({ db: prisma, run: input.run, actor: { id: input.reviewerId, role: input.reviewerRole as 'TEACHER' | 'ADMIN' } });
  const studentProfile = await prisma.studentProfile.findFirst({
    where: { classId: initialScope.classId, userId: initialScope.studentId },
    select: { id: true },
  });
  if (!studentProfile) return NextResponse.json({ error: '学生不在该班级中' }, { status: 404 });
  const editError = validatePipelineReviewEdits(input.run, input.edits);
  if (editError) return NextResponse.json({ error: editError }, { status: 400 });
  const requestIdentity = buildReviewRequestIdentity(input);
  if (input.run.state === 'APPROVED') {
    const replay = await findApprovedReviewReplay(input.run.id, input.reviewerId, requestIdentity);
    if (!replay) return NextResponse.json({ error: 'grading-review-conflict' }, { status: 409 });
    return pipelineApprovalResponse(input.run, input.edits, input.run.teacherReviewedAt ?? new Date(), 0);
  }
  if ((await validatePipelineRuntimeSource(input.run, createSubmissionObjectStore())).length > 0) throw new GradingMutationError('grading-review-runtime-source-unavailable', 409);

  const reviewedAt = new Date();
  const result = await runSerializableReviewTransaction(async (tx) => {
    const current = await tx.gradingRun.findUnique({
      where: { id: input.run.id },
      include: PIPELINE_GRADING_REVIEW_INCLUDE,
    });
    if (!current || current.state !== 'AWAITING_REVIEW' || current.teacherReviewedAt) {
      throw new GradingMutationError('grading-review-conflict', 409);
    }
    const scope = pipelineReviewScope(current);
    if (scope.classId !== initialScope.classId || scope.studentId !== initialScope.studentId) {
      throw new GradingMutationError('grading-review-scope-changed', 409);
    }
    await assertPipelineReviewActor({ db: tx, run: current, actor: { id: input.reviewerId, role: input.reviewerRole as 'TEACHER' | 'ADMIN' }, now: reviewedAt });
    const runtimeReasons = await validatePipelineRuntimeSource(current, createSubmissionObjectStore(), reviewedAt);
    if (runtimeReasons.length > 0) throw new PipelineReviewContractError(runtimeReasons);
    const currentStudentProfile = await tx.studentProfile.findFirst({ where: { classId: scope.classId, userId: scope.studentId }, select: { id: true } });
    if (!currentStudentProfile) throw new GradingMutationError('grading-review-student-scope-changed', 409);
    const contractReasons = validatePipelineReviewContract(current, reviewedAt);
    if (contractReasons.length > 0) {
      throw new PipelineReviewContractError(contractReasons);
    }
    const currentEditError = validatePipelineReviewEdits(current, input.edits);
    if (currentEditError) throw new GradingMutationError('grading-review-edits-stale', 409);
    const actorPseudoId = pseudonymousAuditId(input.reviewerId, 'idempotency');
    await tx.gradingRequestIdempotency.deleteMany({ where: { expiresAt: { lte: reviewedAt } } });
    const protectedKey = pseudonymousAuditId(requestIdentity.idempotencyKey, 'idempotency-key:grading-run-review');
    const requestWhere = { operation: 'grading-run-review', scope: gradingRequestScope(input.reviewerRole === UserRole.ADMIN ? 'ADMIN' : 'TEACHER'), actorPseudoId, idempotencyKey: protectedKey };
    const existingRequest = await tx.gradingRequestIdempotency.findFirst({ where: requestWhere });
    if (existingRequest) {
      if (existingRequest.requestHash !== requestIdentity.requestHash || existingRequest.resourceId !== current.id) throw new GradingMutationError('idempotency-key-conflict', 409);
      throw new GradingMutationError('grading-review-conflict', 409);
    }
    const conflictingRequest = await tx.gradingRequestIdempotency.findFirst({ where: { operation: 'grading-run-review', resourceType: 'GradingRun', resourceId: current.id, actorPseudoId, expiresAt: { gt: reviewedAt } } });
    if (conflictingRequest && conflictingRequest.requestHash !== requestIdentity.requestHash) throw new GradingMutationError('grading-review-conflict', 409);
    await tx.gradingRequestIdempotency.create({ data: { ...requestWhere, requestHash: requestIdentity.requestHash, resourceType: 'GradingRun', resourceId: current.id, expiresAt: new Date(reviewedAt.getTime() + 24 * 60 * 60 * 1000), createdAt: reviewedAt, updatedAt: reviewedAt } });
    const finalState = 'APPROVED';
    const fenced = await tx.gradingRun.updateMany({
      where: { id: current.id, state: 'AWAITING_REVIEW', teacherReviewedAt: null },
      data: { state: finalState, teacherReviewedAt: reviewedAt },
    });
    if (fenced.count !== 1) throw new GradingMutationError('grading-review-conflict', 409);

    const editMap = new Map(input.edits.map((edit) => [edit.criterionId, edit]));
    const finalGrades = current.assessments.map((assessment) => {
      const edit = editMap.get(assessment.criterionId);
      return {
        assessment,
        criterionId: assessment.criterionId,
        levelId: edit?.levelId ?? assessment.levelId,
        score: edit?.score ?? assessment.score,
        feedbackPresent: Boolean(edit?.comment.trim()),
      };
    });
    for (const grade of finalGrades) {
      const saved = await tx.gradingCriterionAssessment.updateMany({
        where: { id: grade.assessment.id, gradingRunId: current.id, teacherReviewedAt: null },
        data: {
          teacherLevelId: grade.levelId,
          teacherScore: grade.score,
          teacherComment: editMap.get(grade.criterionId)?.comment ?? null,
          teacherReviewedAt: reviewedAt,
        },
      });
      if (saved.count !== 1) throw new GradingMutationError('grading-review-conflict', 409);
    }

    const factCandidates = input.decision === 'approved'
      ? buildPipelineReviewFactCandidates({ run: current, edits: input.edits, reviewedAt })
      : [];
    const audit = await writeGradingAudit(tx as any, {
      actor: { id: input.reviewerId, role: input.reviewerRole === UserRole.ADMIN ? 'ADMIN' : 'TEACHER' },
      action: 'grading-run.teacher-reviewed',
      purpose: 'teacher-review',
      resourceType: 'GradingRun',
      resourceId: current.id,
      assignmentId: scope.assignmentId,
      answerId: scope.answerId,
      classId: scope.classId,
      metadata: {
        decision: input.decision,
        state: finalState,
        rubric: { idDigest: reviewAuditHmac(String(current.rubricId), 'rubric'), version: current.rubricVersion },
        evaluator: { idDigest: reviewAuditHmac(current.evaluatorId, 'evaluator'), version: current.evaluatorVersion },
        assignmentRevisionDigest: reviewAuditHmac(scope.assignmentRevisionId!, 'assignment-revision'),
        replayKey: reviewAuditHmac(requestIdentity.idempotencyKey, 'idempotency'),
        reviewRequestDigest: reviewAuditHmac(requestIdentity.requestHash, 'review-request'),
        sourceEventDigests: factCandidates.map((fact: any) => reviewAuditHmac(fact.sourceEventId, 'source-event')),
        factVerification: { count: factCandidates.length, allGoverned: factCandidates.every((fact: any) => String(fact.sourceEventId).startsWith('adaptive-assessment:document-rubric-grading:')) },
        notesPresent: Boolean(input.notes?.trim()),
        gradeChanges: finalGrades.map(({ assessment, criterionId, levelId, score, feedbackPresent }) => {
          const edit = editMap.get(criterionId);
          return {
            criterionDigest: reviewAuditHmac(criterionId, 'criterion'),
            ai: { rationalePresent: Boolean(assessment.rationale), rationaleLengthBucket: textLengthBucket(assessment.rationale) },
            final: { feedbackPresent, feedbackLengthBucket: edit ? textLengthBucket(edit.comment) : 'none' },
            diff: { levelChanged: levelId !== assessment.levelId, scoreChanged: score !== assessment.score, feedbackChanged: (edit?.comment ?? assessment.teacherComment ?? '').trim() !== (assessment.teacherComment ?? '').trim() },
            anchorDigests: current.annotations.filter((annotation) => annotation.criterionId === criterionId).map((annotation) => reviewAuditHmac(stableStringify({ annotationId: annotation.id, assessmentId: annotation.assessmentId, blockId: annotation.blockId, precision: annotation.precision, spanStart: annotation.spanStart, spanEnd: annotation.spanEnd, pageNumber: annotation.pageNumber }), 'anchor')),
          };
        }),
      },
    });
    if (!audit?.id) throw new Error('grading-audit-id-required');
    const facts = input.decision === 'approved'
      ? buildPipelineReviewFacts({ run: current, edits: input.edits, reviewedAt, sourceLogId: audit.id })
      : [];
    const existingFacts = facts.length > 0 ? await tx.learningFact.findMany({ where: { sourceEventId: { in: facts.map((fact: any) => fact.sourceEventId) } } }) : [];
    const existingBySource = new Map(existingFacts.map((fact: any) => [fact.sourceEventId, fact]));
    const comparable = (fact: any) => stableStringify({
      userId: fact.userId, factType: fact.factType, moduleId: fact.moduleId ?? null, sessionId: fact.sessionId ?? null,
      startedAt: new Date(fact.startedAt).toISOString(), finishedAt: fact.finishedAt ? new Date(fact.finishedAt).toISOString() : null,
      outcome: fact.outcome, score: fact.score ?? null, timeSpent: fact.timeSpent ?? null,
      competencyContribution: fact.competencyContribution, sourceEventId: fact.sourceEventId ?? null, sourceLogId: fact.sourceLogId ?? null,
      courseId: fact.courseId ?? null, lessonId: fact.lessonId ?? null, contextJson: fact.contextJson ?? {},
    });
    for (const fact of facts) {
      const existing = existingBySource.get(fact.sourceEventId);
      if (existing && comparable(existing) !== comparable(fact)) throw new GradingMutationError('grading-review-fact-conflict', 409);
    }
    const pendingFacts = facts.filter((fact: any) => !existingBySource.has(fact.sourceEventId));
    const written = pendingFacts.length > 0
      ? await (async () => {
          const selector = selectLearningFactAuthority('FORMAL_PRODUCTION');
          const activeRevision = await resolveActiveKnowledgeRevision(tx as never);
          const result = await writeKnowledgeScopedLearningFacts(
            {
              learningFact: {
                createMany: async (args) => tx.learningFact.createMany({
                  data: args.data as Prisma.LearningFactCreateManyInput[],
                  skipDuplicates: args.skipDuplicates,
                }),
              },
            },
            {
              rows: pendingFacts as LearningFactWriteRow[],
              knowledgeScoped: true,
            },
            {
              selector,
              knowledgeRevisionRef: activeRevision.id,
            },
          );
          return { count: result.written };
        })()
      : { count: 0 };
    if (facts.length > 0) {
      if (!scope.studentId || !scope.classId) throw new GradingMutationError('grading-review-scope-changed', 409);
      await tx.studentEvidenceFeatureCache.deleteMany({ where: { userId: scope.studentId } });
      await requestCumulativeLearnerReconciliation(tx, {
        userId: scope.studentId,
        classIds: [scope.classId],
        reason: 'document-rubric-grading-approved',
        now: reviewedAt,
      });
    }
    return { facts, written: written.count };
  });

  return pipelineApprovalResponse(input.run, input.edits, reviewedAt, result.written);
}

function buildReviewRequestIdentity(input: { run: any; reviewerId: string; edits: Array<{ criterionId: string; levelId: string | null; score: number; comment: string }>; notes?: string; idempotencyKey?: string }) {
  const requestHash = sha256(stableStringify({
    gradingRunId: input.run.id,
    reviewerId: input.reviewerId,
    decision: 'approved',
    edits: [...input.edits].sort((left, right) => left.criterionId.localeCompare(right.criterionId)),
    notes: input.notes?.trim() || null,
  }));
  return { requestHash, idempotencyKey: input.idempotencyKey ?? `grading-review:${requestHash}` };
}

async function findApprovedReviewReplay(runId: string, reviewerId: string, identity: { requestHash: string; idempotencyKey: string }) {
  const actorPseudoId = pseudonymousAuditId(reviewerId, 'idempotency');
  const row = await prisma.gradingRequestIdempotency.findFirst({ where: { operation: 'grading-run-review', resourceType: 'GradingRun', resourceId: runId, actorPseudoId } });
  const protectedKey = pseudonymousAuditId(identity.idempotencyKey, 'idempotency-key:grading-run-review');
  return row?.requestHash === identity.requestHash && row.idempotencyKey === protectedKey && (!row.expiresAt || new Date(row.expiresAt) > new Date()) ? row : null;
}

function pipelineApprovalResponse(run: any, edits: Array<{ criterionId: string; levelId: string | null; score: number; comment: string }>, reviewedAt: Date, written: number) {
  const facts = buildPipelineReviewFactCandidates({ run, edits, reviewedAt: new Date(reviewedAt) });
  return NextResponse.json({ status: 'approved', gradingRunId: run.id, createdFacts: written, skippedFacts: Math.max(facts.length - written, 0), blockedFacts: 0, evidenceSourceEventIds: facts.map((fact: any) => fact.sourceEventId) });
}

async function runSerializableReviewTransaction<T>(callback: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      return await prisma.$transaction(callback, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      if ((error as { code?: string }).code !== 'P2034') throw error;
      if (attempt === 1) throw new GradingMutationError('grading-review-conflict', 409);
    }
  }
  throw new GradingMutationError('grading-review-conflict', 409);
}

class PipelineReviewContractError extends GradingMutationError {
  constructor(public readonly reasons: string[]) {
    super('grading-review-contract-drift', 409);
  }
}

function reviewAuditHmac(value: string, field: string): string {
  return pseudonymousAuditId(`${field}:${value}`, `teacher-review:${field}`);
}

function textLengthBucket(value: string | null | undefined): 'none' | 'short' | 'medium' | 'long' {
  const length = value?.length ?? 0;
  if (length === 0) return 'none';
  if (length <= 40) return 'short';
  if (length <= 200) return 'medium';
  return 'long';
}

function toPrismaJsonObject(value: Record<string, unknown>): Prisma.InputJsonObject {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonObject;
}

function isDocumentGradingDecision(value: unknown): value is 'approved' | 'returned' | 'rejected' {
  return value === 'approved' || value === 'returned' || value === 'rejected';
}

function isDocumentGradingEditList(value: unknown): value is Array<{
  criterionId: string;
  levelId: string | null;
  score: number;
  comment: string;
}> {
  return Array.isArray(value) && value.every((item) => item &&
    typeof item === 'object' &&
    !Array.isArray(item) &&
    typeof item.criterionId === 'string' &&
    (typeof item.levelId === 'string' || item.levelId === null) &&
    typeof item.score === 'number' &&
    Number.isFinite(item.score) &&
    typeof item.comment === 'string' &&
    item.comment.length <= 4000);
}

function validateDocumentGradingEditsAgainstRubric(
  edits: Array<{
    criterionId: string;
    levelId: string | null;
    score: number;
    comment: string;
  }>,
  rubric: {
    maxScore: number;
    schemaVersion?: string;
    criteria: Array<{
      id: string;
      maxPoints?: number;
      detailedRubricEnabled?: boolean;
      levels: Array<{ id: string; score: number }>;
    }>;
  },
): string | null {
  for (const edit of edits) {
    const criterion = rubric.criteria.find((item) => item.id === edit.criterionId);
    if (!criterion) {
      return '评分编辑指标不存在';
    }
    const detailed = rubric.schemaVersion === 'assignment-scoring-rubric.v2'
      ? criterion.detailedRubricEnabled === true
      : true;
    const level = edit.levelId ? criterion.levels.find((item) => item.id === edit.levelId) : null;
    if (detailed && !level) {
      return '评分编辑等级不存在';
    }
    if (!detailed && edit.levelId !== null) {
      return '标准评分项不得指定评价级别';
    }
    if (rubric.schemaVersion === 'assignment-scoring-rubric.v2'
      && !hasAtMostOneDecimal(edit.score)) {
      return '评分编辑分数必须保留一位小数';
    }
    if (edit.score < 0 || edit.score > (criterion.maxPoints ?? rubric.maxScore)) {
      return '评分编辑分数超出量规范围';
    }
  }
  return null;
}
