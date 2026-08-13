import type { TeacherGradingWorkbenchView } from './document-rubric-grading-workbench';
import { DOCUMENT_RUBRIC_GOAL_DIMENSION_MAP } from './document-rubric-grading-workbench';
import { GradingMutationError, normalizeTextAnswerEvidence, sha256, stableStringify, validateEvidenceAnchor } from './math-document-grading-contracts';
import type { SubmissionObjectStore } from '@/lib/assignments/submission-object-store';
import { hasAtMostOneDecimal } from '@/lib/assignments/assignment-rubric-contract';
import { assertPipelineActorScope, questionContractFromRow, validateFrozenRunInput } from './math-document-grading-persistence';

export const PIPELINE_GRADING_REVIEW_INCLUDE = {
  assessments: true,
  annotations: true,
  answerEvidence: { include: { blocks: true, sourceAsset: true, conversion: true } },
  question: { include: { revision: { include: { assignment: true } } } },
  answerAttempt: { include: { answer: { include: { submission: { include: { revision: { include: { assignment: true } }, audience: { include: { class: true, revision: { include: { assignment: true } } } } } } } } } },
} as const;

export async function assertPipelineReviewActor(input: { db: any; run: any; actor: { id: string; role: 'TEACHER' | 'ADMIN' }; now?: Date }) {
  const scope = pipelineReviewScope(input.run);
  const liveClassId = input.run?.answerAttempt?.answer?.submission?.audience?.classId;
  const unavailableSnapshot = input.run?.state === 'CONTENT_UNAVAILABLE' && input.run?.authorizationSnapshot;
  if (!scope.classId || (!unavailableSnapshot && liveClassId !== scope.classId)) throw new GradingMutationError('grading-review-class-drift', 409);
  if (!scope.assignmentRevisionId) throw new GradingMutationError('grading-review-revision-missing', 409);
  const frozenClass = unavailableSnapshot && input.db.class?.findUnique
    ? await input.db.class.findUnique({ where: { id: scope.classId }, select: { teacherId: true } })
    : null;
  try {
    await assertPipelineActorScope({ db: input.db, actor: input.actor, assignmentRevisionId: scope.assignmentRevisionId, classId: scope.classId, classTeacherId: frozenClass?.teacherId ?? scope.teacherId, ownerStudentId: scope.studentId ?? (unavailableSnapshot ? 'retained-owner-scope' : null), purpose: 'teacher-review', now: input.now ?? new Date() });
  } catch (error) {
    if (error instanceof Error && error.message === 'grading-forbidden') throw new GradingMutationError('grading-forbidden', 403);
    throw error;
  }
}

export function pipelineReviewScope(run: any) {
  const submission = run?.answerAttempt?.answer?.submission;
  const authorization = run?.state === 'CONTENT_UNAVAILABLE' && run?.authorizationSnapshot && typeof run.authorizationSnapshot === 'object' ? run.authorizationSnapshot : {};
  return {
    studentId: submission?.frozenStudentId as string | undefined,
    classId: (submission?.frozenAudienceClassId ?? authorization.classId) as string | undefined,
    teacherId: submission?.audience?.class?.teacherId as string | undefined,
    assignmentId: (run?.question?.revision?.assignment?.id ?? authorization.assignmentId) as string | undefined,
    assignmentRevisionId: (run?.question?.assignmentRevisionId ?? authorization.assignmentRevisionId) as string | undefined,
    courseId: run?.question?.revision?.assignment?.courseContext as string | null | undefined,
    answerId: run?.answerAttempt?.answerId as string | undefined,
  };
}

export function validatePipelineUnavailableListLineage(run: any): string[] {
  const authorization = run?.authorizationSnapshot;
  if (authorization && typeof authorization === 'object') {
    return authorization.version === 'grading-authorization.v1'
      && typeof authorization.classId === 'string'
      && typeof authorization.assignmentId === 'string'
      && typeof authorization.assignmentRevisionId === 'string'
      ? [] : ['authorization-snapshot-invalid'];
  }
  const submission = run?.answerAttempt?.answer?.submission;
  const questionRevision = run?.question?.revision;
  const reasons: string[] = [];
  if (!submission || !run?.answerAttempt?.answer) return ['submission-lineage-missing'];
  if (run.answerAttemptId !== run.answerAttempt.id || run.answerAttempt.answerId !== run.answerAttempt.answer.id) reasons.push('answer-lineage-mismatch');
  if (!submission.frozenStudentId || submission.frozenStudentId !== submission.studentId) reasons.push('student-lineage-mismatch');
  if (!submission.frozenAudienceClassId || submission.frozenAudienceClassId !== submission.audience?.classId) reasons.push('class-lineage-mismatch');
  if (!submission.assignmentRevisionId || submission.assignmentRevisionId !== submission.audience?.assignmentRevisionId || submission.assignmentRevisionId !== submission.revision?.id) reasons.push('revision-lineage-mismatch');
  if (questionRevision && (questionRevision.id !== submission.assignmentRevisionId || questionRevision.assignment?.id !== submission.revision?.assignment?.id)) reasons.push('assignment-lineage-mismatch');
  return [...new Set(reasons)];
}

export function isPipelineRunReviewable(run: any): boolean {
  return Boolean(run && ['AWAITING_REVIEW', 'APPROVED'].includes(run.state)
    && run.answerEvidence && run.answerAttempt?.answer?.submission && run.questionSnapshot?.rubric);
}

export function buildPipelineReviewListItem(run: any) {
  const scope = pipelineReviewScope(run);
  if (run.state === 'CONTENT_UNAVAILABLE') return {
    gradingRunId: run.id, state: run.state, assignmentId: scope.assignmentId, assignmentRevisionId: scope.assignmentRevisionId,
    classId: scope.classId, studentId: scope.studentId, contentAvailable: false, rerunRequired: true,
    unavailableReasons: [...new Set([...(run.blockedReasons ?? []), ...(run.limitations ?? []), 'rerun-required'])],
    workbenchHref: `/teacher/grading-workbench?gradingRunId=${encodeURIComponent(run.id)}`,
  };
  return {
    gradingRunId: run.id,
    state: run.state,
    teacherReviewedAt: run.teacherReviewedAt,
    studentId: scope.studentId,
    classId: scope.classId,
    assignmentId: scope.assignmentId,
    assignmentRevisionId: scope.assignmentRevisionId,
    courseId: scope.courseId ?? null,
    sourceAssetId: run.answerEvidence?.sourceAsset?.id ?? null,
    fileName: run.answerEvidence?.sourceAsset?.originalName ?? '文本作答',
    createdAt: run.createdAt,
    workbenchHref: `/teacher/grading-workbench?gradingRunId=${encodeURIComponent(run.id)}`,
    contentAvailable: true,
  };
}

export function buildPipelineGradingWorkbenchView(run: any): TeacherGradingWorkbenchView {
  if (!isPipelineRunReviewable(run)) throw new Error('pipeline-grading-run-not-reviewable');
  const contractReasons = validatePipelineReviewContract(run);
  if (contractReasons.length > 0) throw new PipelineReviewContentUnavailableError(contractReasons);
  const scope = pipelineReviewScope(run);
  const evidence = run.answerEvidence;
  const asset = evidence.sourceAsset;
  const conversion = evidence.conversion;
  const rubric = run.questionSnapshot.rubric;
  const blocks = evidence.blocks.map((block: any) => ({
    id: block.id,
    pageNumber: block.pageNumber,
    text: block.text,
    markdown: block.markdown,
    confidence: block.confidence,
    spanStart: block.spanStart ?? undefined,
    spanEnd: block.spanEnd ?? undefined,
    bbox: Array.isArray(block.bbox) ? block.bbox : undefined,
  }));
  const assessmentMap = new Map(run.assessments.map((item: any) => [item.criterionId, item]));
  const annotations = run.annotations.map((annotation: any) => {
    const block = evidence.blocks.find((item: any) => item.id === annotation.blockId);
    return {
      id: annotation.id,
      criterionId: annotation.criterionId,
      comment: annotation.comment,
      authorRole: annotation.authorRole === 'TEACHER' ? 'teacher' as const : 'ai-draft' as const,
      reference: {
        convertedDocumentId: conversion?.id ?? evidence.id,
        blockId: annotation.blockId ?? block?.id,
        pageNumber: annotation.pageNumber ?? block?.pageNumber ?? null,
        precision: String(annotation.precision ?? evidence.precision).toLowerCase() as 'span' | 'block' | 'page',
        excerpt: annotation.excerpt,
        checksum: block?.sourceHash ?? evidence.sourceHash,
        citationChip: {
          chunkId: `grading:${run.id}:${annotation.id}`,
          displayTitle: annotation.pageNumber ? `AI 评分证据 P${annotation.pageNumber}` : 'AI 评分证据',
          displayHref: null,
          sourceType: 'grading-artifact' as const,
          authorityLevel: annotation.authorRole === 'TEACHER' ? 'teacher-authored' as const : 'service-internal' as const,
          confidence: block?.confidence >= 0.85 ? 'high' as const : block?.confidence >= 0.6 ? 'medium' as const : 'low' as const,
          freshnessBucket: 'current' as const,
          privacyVisibility: 'redacted' as const,
          limitationState: null,
        },
      },
    };
  });
  return {
    gradingRunId: run.id,
    asset: {
      id: asset?.id ?? null,
      studentId: scope.studentId!,
      fileName: asset?.originalName ?? '文本作答',
      checksum: asset?.checksum ?? evidence.sourceHash,
      uploadedAt: new Date(run.answerAttempt.submittedAt).toISOString(),
    },
    conversion: {
      status: evidence.readiness === 'READY' ? 'converted' : 'failed',
      adapter: String(conversion?.adapter ?? '').toLowerCase().includes('markitdown') ? 'markitdown' : 'fallback',
      confidence: blocks.length ? blocks.reduce((sum: number, block: any) => sum + block.confidence, 0) / blocks.length : 0,
      referencePrecision: String(evidence.precision).toLowerCase() as 'span' | 'block' | 'page',
      warnings: [...(evidence.limitations ?? []), ...(conversion?.warningCodes ?? [])],
    },
    preview: { markdown: evidence.canonicalMarkdown, blocks },
    rubricTree: rubric.criteria.map((criterion: any) => {
      const assessment: any = assessmentMap.get(criterion.id);
      return { criterionId: criterion.id, label: criterion.label, weight: criterion.maxPoints / rubric.maxScore, selectedLevelId: assessment?.teacherLevelId ?? assessment?.levelId ?? null, editableScore: assessment?.teacherScore ?? assessment?.score ?? null, aiLevelId: assessment?.levelId ?? null, aiScore: assessment?.score ?? null, teacherComment: assessment?.teacherComment ?? '', levels: criterion.levels.map((level: any) => ({ id: level.id, label: level.label, minPoints: level.minPoints, maxPoints: level.maxPoints })), limitationState: assessment?.limitationState ?? null, evidenceCount: run.annotations.filter((item: any) => item.criterionId === criterion.id).length };
    }),
    annotations,
    draftSummary: {
      status: run.state === 'APPROVED' ? 'approved' : run.state === 'RETURNED' ? 'returned' : run.state === 'REJECTED' ? 'rejected' : 'draft',
      averageConfidence: run.assessments.length ? run.assessments.reduce((sum: number, item: any) => sum + item.confidence, 0) / run.assessments.length : 0,
      requiresTeacherApproval: run.state === 'AWAITING_REVIEW',
    },
    evaluator: contractReasons.length > 0 ? { status: 'blocked', blockedReasons: contractReasons } : { status: 'valid', blockedReasons: [] },
    actions: run.state === 'AWAITING_REVIEW' && contractReasons.length === 0 ? ['approve'] : [],
    konlingEntryPoint: { mode: 'grading-assistant', promptContext: `grading-run:${run.id}`, serverContext: { gradingRunId: run.id, assetId: asset?.id ?? null, rubricId: run.rubricId } },
  };
}

export function buildPipelineReviewFacts(input: { run: any; edits: any[]; reviewedAt: Date }) {
  const scope = pipelineReviewScope(input.run);
  const rubric = input.run.questionSnapshot.rubric;
  const edits = new Map(input.edits.map((edit) => [edit.criterionId, edit]));
  return input.run.assessments.map((assessment: any) => {
    const criterion = rubric.criteria.find((item: any) => item.id === assessment.criterionId);
    if (!criterion || criterion.maxPoints <= 0 || rubric.maxScore <= 0) throw new Error('pipeline-review-rubric-invalid');
    const edit: any = edits.get(assessment.criterionId);
    const score = edit?.score ?? assessment.score;
    const dimension = DOCUMENT_RUBRIC_GOAL_DIMENSION_MAP[String(criterion.goalDimension)] ?? null;
    if (!dimension) throw new Error(`pipeline-review-goal-dimension-invalid:${assessment.criterionId}`);
    const normalizedScore = score / criterion.maxPoints;
    const rubricWeight = criterion.maxPoints / rubric.maxScore;
    return {
      userId: scope.studentId,
      factType: 'document_rubric_grading',
      outcome: score === 0 ? 'failure' : score / criterion.maxPoints < 0.6 ? 'partial' : 'success',
      score: normalizedScore,
      startedAt: input.run.answerAttempt.submittedAt,
      finishedAt: input.reviewedAt,
      competencyContribution: { [dimension]: normalizedScore },
      sourceEventId: `adaptive-assessment:document-rubric-grading:${[input.run.id, assessment.criterionId, input.run.rubricVersion].map((value) => encodeURIComponent(String(value))).join(':')}`,
      courseId: scope.courseId ?? null,
      contextJson: {
        gradingRunId: input.run.id,
        rubricId: input.run.rubricId,
        rubricVersion: input.run.rubricVersion,
        criterionId: assessment.criterionId,
        assessmentId: assessment.id,
        criterionMaxPoints: criterion.maxPoints,
        competencyDimension: dimension,
        classId: scope.classId,
        assignmentId: scope.assignmentId,
        assignmentRevisionId: scope.assignmentRevisionId,
        evidenceAuthority: 'ai-draft',
        decisionAuthority: 'teacher-reviewed',
        reviewState: 'approved',
        privacyScope: 'student-private',
        evidenceAnchorPrivacyScope: 'teacher-review',
        rawScore: score,
        maxPoints: criterion.maxPoints,
        normalizedScore,
        evidenceGovernance: {
          evidenceQuality: 'rich',
          profileWeight: 1,
          skipProfileContribution: false,
          policyReason: 'adaptive_assessment_evidence',
        },
        rubricWeight,
        reviewedAt: input.reviewedAt.toISOString(),
        retentionPolicy: {
          version: input.run.lifecyclePolicyVersion,
          deleteStrategy: input.run.lifecycleDeleteStrategy,
          governedRecordRule: input.run.lifecycleGovernedRecordRule,
        },
        confidence: assessment.confidence,
      },
    };
  });
}

export function validatePipelineReviewContract(run: any, reviewedAt = new Date()): string[] {
  const reasons: string[] = [];
  const rubric = run?.questionSnapshot?.rubric;
  const persistedRubric = run?.rubricSnapshot;
  const answer = run?.answerAttempt?.answer;
  const submission = answer?.submission;
  const audience = submission?.audience;
  const question = run?.question;
  const sourceAsset = run?.answerEvidence?.sourceAsset;
  const conversion = run?.answerEvidence?.conversion;
  const scope = pipelineReviewScope(run);
  if (!Number.isFinite(rubric?.maxScore) || rubric.maxScore <= 0) reasons.push('rubric-max-score-invalid');
  if (!rubric || rubric.id !== run.rubricId) reasons.push('rubric-id-mismatch');
  if (!rubric || rubric.version !== run.rubricVersion) reasons.push('rubric-version-mismatch');
  if (!persistedRubric || persistedRubric.id !== run.rubricId) reasons.push('rubric-snapshot-id-mismatch');
  if (!persistedRubric || persistedRubric.version !== run.rubricVersion) reasons.push('rubric-snapshot-version-mismatch');
  if (run?.questionId !== answer?.assignmentQuestionId) reasons.push('run-answer-question-mismatch');
  if (question?.assignmentRevisionId !== submission?.assignmentRevisionId || question?.assignmentRevisionId !== audience?.assignmentRevisionId) reasons.push('revision-lineage-mismatch');
  if (run?.answerEvidence?.attemptId !== run?.answerAttemptId) reasons.push('evidence-attempt-mismatch');
  if (run?.answerEvidenceId !== run?.answerEvidence?.id) reasons.push('run-evidence-mismatch');
  if (submission?.studentId !== submission?.frozenStudentId) reasons.push('submission-student-drift');
  if (audience?.classId !== submission?.frozenAudienceClassId) reasons.push('audience-class-drift');
  if (run?.lifecycleBlockedAt || run?.tombstonedAt) reasons.push('grading-run-content-unavailable');
  if (run?.answerEvidence?.readiness !== 'READY' || run?.answerEvidence?.lifecycleBlockedAt || run?.answerEvidence?.tombstonedAt) reasons.push('answer-evidence-content-unavailable');
  if (run?.answerEvidence?.sourceKind === 'DOCUMENT' && !sourceAsset) reasons.push('source-asset-content-unavailable');
  if (run?.answerEvidence?.sourceKind === 'DOCUMENT' && !conversion) reasons.push('conversion-content-unavailable');
  if (sourceAsset) {
    if (sourceAsset.answerId !== answer?.id || sourceAsset.attemptId !== run?.answerAttemptId) reasons.push('source-asset-lineage-mismatch');
    if (sourceAsset.state !== 'FINALIZED' || sourceAsset.scanState !== 'CLEAN' || sourceAsset.lifecycleBlockedAt || sourceAsset.tombstonedAt || sourceAsset.deletionIntentAt) reasons.push('source-asset-content-unavailable');
  }
  if (conversion) {
    if (run?.answerEvidence?.conversionId !== conversion.id || conversion.attemptId !== run?.answerAttemptId || conversion.assetId !== run?.answerEvidence?.sourceAssetId) reasons.push('conversion-lineage-mismatch');
    if (!['SUCCEEDED', 'FALLBACK'].includes(conversion.state) || conversion.lifecycleBlockedAt || conversion.canonicalMarkdown === null) reasons.push('conversion-content-unavailable');
  }
  if (run?.questionSnapshotHash !== question?.contentHash || run?.questionSnapshotHash !== run?.questionSnapshot?.contentHash) reasons.push('question-snapshot-hash-mismatch');
  if (question) {
    const liveQuestion = questionContractFromRow(question);
    if (stableStringify(liveQuestion) !== stableStringify(run.questionSnapshot)) reasons.push('question-snapshot-content-mismatch');
    if (stableStringify(liveQuestion.rubric) !== stableStringify(persistedRubric) || stableStringify(rubric) !== stableStringify(persistedRubric)) reasons.push('rubric-snapshot-content-mismatch');
    const frozenInputError = validateFrozenRunInput(run, liveQuestion, run.answerEvidence);
    if (frozenInputError) reasons.push(frozenInputError);
  }
  for (const [kind, record] of [['grading-run', run], ['answer-evidence', run?.answerEvidence], ['source-asset', sourceAsset], ['conversion', conversion]] as const) {
    if (!record) continue;
    const deleteStrategy = kind === 'source-asset' ? record.retentionDeleteStrategy : record.lifecycleDeleteStrategy;
    const governedRule = kind === 'source-asset' ? record.governedRecordRule : record.lifecycleGovernedRecordRule;
    const retained = deleteStrategy === 'retain-governed-record' && Boolean(governedRule);
    if (retained ? record.retentionExpiresAt != null : (!record.retentionExpiresAt || new Date(record.retentionExpiresAt).getTime() <= reviewedAt.getTime())) reasons.push(`${kind}-retention-expired`);
  }
  if (sourceAsset && (sourceAsset.checksum !== conversion?.sourceChecksum || sourceAsset.checksum !== run?.answerEvidence?.sourceHash)) reasons.push('frozen-source-checksum-mismatch');
  if (conversion && (conversion.outputChecksum !== sha256(conversion.canonicalMarkdown ?? '') || conversion.canonicalMarkdown !== run?.answerEvidence?.canonicalMarkdown)) reasons.push('converted-evidence-content-mismatch');
  const assignmentIds = [question?.revision?.assignment?.id, submission?.revision?.assignment?.id, audience?.revision?.assignment?.id];
  const revisionIds = [question?.assignmentRevisionId, submission?.assignmentRevisionId, audience?.assignmentRevisionId];
  const courseIds = [question?.revision?.assignment?.courseContext, submission?.revision?.assignment?.courseContext, audience?.revision?.assignment?.courseContext];
  if (new Set(assignmentIds).size !== 1 || assignmentIds.some((value) => !value)) reasons.push('assignment-lineage-drift');
  if (new Set(revisionIds).size !== 1 || revisionIds.some((value) => !value)) reasons.push('revision-lineage-drift');
  if (new Set(courseIds).size !== 1 || courseIds.some((value) => !value)) reasons.push('course-lineage-drift');
  if (!scope.assignmentId) reasons.push('assignment-id-missing');
  if (!scope.assignmentRevisionId) reasons.push('assignment-revision-id-missing');
  if (!scope.courseId) reasons.push('course-id-missing');
  const criteria = Array.isArray(rubric?.criteria) ? rubric.criteria : [];
  const rubricV2 = rubric?.schemaVersion === 'assignment-scoring-rubric.v2';
  if (criteria.length === 0 || criteria.some((criterion: any) => {
    const detailed = rubricV2 ? criterion?.detailedRubricEnabled === true : true;
    return !criterion || typeof criterion !== 'object' || Array.isArray(criterion)
      || typeof criterion.id !== 'string' || !criterion.id
      || !Number.isFinite(criterion.maxPoints) || criterion.maxPoints <= 0
      || !DOCUMENT_RUBRIC_GOAL_DIMENSION_MAP[String(criterion.goalDimension)]
      || !Array.isArray(criterion.levels)
      || (detailed && criterion.levels.length === 0)
      || (!detailed && criterion.levels.length > 0)
      || criterion.levels.some((level: any) => !level || typeof level !== 'object' || Array.isArray(level) || typeof level.id !== 'string' || !level.id || !Number.isFinite(level.minPoints) || !Number.isFinite(level.maxPoints) || level.minPoints > level.maxPoints);
  })) reasons.push('rubric-criteria-invalid');
  if (Number.isFinite(rubric?.maxScore) && criteria.length > 0 && Math.abs(criteria.reduce((sum: number, criterion: any) => sum + (Number.isFinite(criterion?.maxPoints) ? criterion.maxPoints : 0), 0) - rubric.maxScore) > 1e-9) reasons.push('rubric-max-score-total-mismatch');
  const criterionIds = criteria.map((criterion: any) => criterion.id);
  if (new Set(criterionIds).size !== criterionIds.length) reasons.push('rubric-criteria-not-unique');
  const assessments = Array.isArray(run?.assessments) ? run.assessments : [];
  const assessmentIds = new Set(assessments.map((assessment: any) => assessment.id));
  const assessmentsByCriterion = new Map<string, any[]>();
  for (const assessment of assessments) {
    const rows = assessmentsByCriterion.get(assessment.criterionId) ?? [];
    rows.push(assessment);
    assessmentsByCriterion.set(assessment.criterionId, rows);
  }
  for (const criterion of criteria) {
    if (!criterion.goalDimension) reasons.push(`goal-dimension-missing:${criterion.id}`);
    else if (!DOCUMENT_RUBRIC_GOAL_DIMENSION_MAP[String(criterion.goalDimension)]) reasons.push(`goal-dimension-unknown:${criterion.id}`);
    const rows = assessmentsByCriterion.get(criterion.id) ?? [];
    if (rows.length !== 1) reasons.push(`assessment-cardinality:${criterion.id}`);
    else {
      const assessment = rows[0];
      const detailed = rubricV2 ? criterion.detailedRubricEnabled === true : true;
      const level = assessment.levelId
        ? criterion.levels?.find((item: any) => item.id === assessment.levelId)
        : null;
      if ((detailed && !level) || (!detailed && assessment.levelId !== null)) reasons.push(`assessment-level-mismatch:${criterion.id}`);
      if (!Number.isFinite(assessment.score) || assessment.score < 0 || assessment.score > criterion.maxPoints
        || (rubricV2 && !hasAtMostOneDecimal(assessment.score))
        || (!rubricV2 && level && (assessment.score < level.minPoints || assessment.score > level.maxPoints))) reasons.push(`assessment-score-invalid:${criterion.id}`);
      if (!Number.isFinite(assessment.confidence) || assessment.confidence < 0 || assessment.confidence > 1) reasons.push(`assessment-confidence-invalid:${criterion.id}`);
    }
  }
  for (const criterionId of assessmentsByCriterion.keys()) {
    if (!criterionIds.includes(criterionId)) reasons.push(`assessment-criterion-mismatch:${criterionId}`);
  }
  const blockIds = new Set((run?.answerEvidence?.blocks ?? []).map((block: any) => block.id));
  for (const criterion of criteria) {
    if (!(run?.annotations ?? []).some((annotation: any) => annotation.criterionId === criterion.id && blockIds.has(annotation.blockId))) reasons.push(`criterion-evidence-anchor-missing:${criterion.id}`);
  }
  for (const annotation of run?.annotations ?? []) {
    if (!blockIds.has(annotation.blockId)) reasons.push(`annotation-block-mismatch:${annotation.id}`);
    const assessment = assessments.find((item: any) => item.id === annotation.assessmentId);
    if (!assessmentIds.has(annotation.assessmentId) || !assessment || assessment.criterionId !== annotation.criterionId) reasons.push(`annotation-assessment-mismatch:${annotation.id}`);
    const block = (run?.answerEvidence?.blocks ?? []).find((item: any) => item.id === annotation.blockId);
    const precision = String(annotation.precision).toLowerCase() as any;
    if (!annotation.excerpt?.length) reasons.push(`annotation-anchor-invalid:${annotation.id}:anchor-excerpt-empty`);
    const anchorReasons = validateEvidenceAnchor({ block, requestedPrecision: precision, excerpt: annotation.excerpt });
    if (precision === 'span') {
      const blockStart = block?.spanStart;
      const blockEnd = block?.spanEnd;
      if (!Number.isInteger(annotation.spanStart) || !Number.isInteger(annotation.spanEnd) || !Number.isInteger(blockStart) || !Number.isInteger(blockEnd) || annotation.spanStart < blockStart || annotation.spanEnd <= annotation.spanStart || annotation.spanEnd > blockEnd) anchorReasons.push('annotation-span-mismatch');
      else if (block.text.slice(annotation.spanStart - blockStart, annotation.spanEnd - blockStart) !== annotation.excerpt) anchorReasons.push('annotation-span-excerpt-mismatch');
    }
    if (annotation.pageNumber != null && annotation.pageNumber !== block?.pageNumber) anchorReasons.push('annotation-page-mismatch');
    if (annotation.bbox != null && stableStringify(annotation.bbox) !== stableStringify(block?.bbox)) anchorReasons.push('annotation-bbox-mismatch');
    for (const reason of new Set(anchorReasons)) reasons.push(`annotation-anchor-invalid:${annotation.id}:${reason}`);
  }
  const submittedAt = run?.answerAttempt?.submittedAt ? new Date(run.answerAttempt.submittedAt).getTime() : Number.NaN;
  if (!Number.isFinite(submittedAt) || submittedAt > reviewedAt.getTime()) reasons.push('answer-submitted-at-invalid');
  return [...new Set(reasons)];
}

export class PipelineReviewContentUnavailableError extends Error {
  constructor(public readonly reasons: string[]) { super('grading-review-content-unavailable'); }
}

export async function validatePipelineRuntimeSource(run: any, store: SubmissionObjectStore, now = new Date()): Promise<string[]> {
  const evidence = run?.answerEvidence;
  if (evidence?.sourceKind === 'TEXT_NATIVE') {
    const attempt = run?.answerAttempt;
    const retained = attempt?.textSnapshotDeleteStrategy === 'retain-governed-record' && Boolean(attempt?.textSnapshotGovernedRecordRule);
    const expired = retained ? attempt?.textSnapshotExpiresAt != null : (!attempt?.textSnapshotExpiresAt || new Date(attempt.textSnapshotExpiresAt).getTime() <= now.getTime());
    return attempt?.lifecycleBlockedAt || expired || !attempt?.textSnapshot || normalizeTextAnswerEvidence(attempt.textSnapshot).sourceHash !== evidence.sourceHash ? ['runtime-text-source-unavailable'] : [];
  }
  const asset = evidence?.sourceAsset;
  if (!asset?.objectKey || !asset.checksum) return ['runtime-document-source-unavailable'];
  try {
    const stored = await store.head(asset.objectKey);
    return !stored || stored.checksum !== asset.checksum || stored.scanState !== 'CLEAN' || stored.answerId !== asset.answerId || (stored.attemptId && stored.attemptId !== asset.attemptId) ? ['runtime-document-source-unavailable'] : [];
  } catch { return ['runtime-document-source-unavailable']; }
}

export function validatePipelineReviewEdits(run: any, edits: any[]): string | null {
  const rubric = run.questionSnapshot.rubric;
  const seen = new Set<string>();
  for (const edit of edits) {
    if (seen.has(edit.criterionId)) return '评分编辑指标重复';
    seen.add(edit.criterionId);
    const criterion = rubric.criteria.find((item: any) => item.id === edit.criterionId);
    if (!criterion) return '评分编辑指标不存在';
    const v2 = rubric.schemaVersion === 'assignment-scoring-rubric.v2';
    const detailed = v2 ? criterion.detailedRubricEnabled === true : true;
    const level = edit.levelId
      ? criterion.levels.find((item: any) => item.id === edit.levelId)
      : null;
    if (detailed && !level) return '评分编辑等级不存在';
    if (!detailed && edit.levelId !== null) return '标准评分项不得指定评价级别';
    if (!Number.isFinite(edit.score) || edit.score < 0 || edit.score > criterion.maxPoints) return '评分编辑分数超出指标范围';
    if (v2 && !hasAtMostOneDecimal(edit.score)) return '评分编辑分数必须保留一位小数';
    if (!v2 && level && (edit.score < level.minPoints || edit.score > level.maxPoints)) return '评分编辑分数不在所选等级范围';
  }
  return null;
}
