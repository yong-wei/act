import { prisma } from '@/lib/prisma';
import { readReviewedDerivativeObject } from '@/lib/data-governance/teacher-assignment-review-derivative-storage';

import { AssignmentDomainError } from './assignment-domain';
import {
  completeAssignmentContentAssetUpload,
  readAssignmentContentAsset,
  signAssignmentContentAssetUpload,
} from './assignment-content-assets';
import {
  generateAssignmentRubricGuidelines,
  resolveAssignmentRubricGenerationProvider,
} from './assignment-rubric-generation';
import { listAssignmentQuestionCatalog, selectAssignmentQuestionCatalogItem } from './assignment-question-catalog';
import {
  createAssignmentDraft,
  createNextDraftRevision,
  deleteDraftRevision,
  listTeacherAssignments,
  publishAssignmentRevision,
  updateAssignmentDraft,
} from './assignment-service';
import { SubmissionError } from './submission-domain';
import { assertSubmissionObjectIntegrity } from './submission-integrity';
import { createSubmissionObjectStore, getLocalTestSubmissionObjectStore } from './submission-object-store';
import {
  approveTeacherAssignmentReview,
  buildTeacherAssignmentReviewApiProjection,
  consumeTeacherAssignmentOriginalAssetRead,
  createTeacherAssignmentReview,
  getTeacherAssignmentReview,
  listTeacherAssignmentSubmissions,
  requestTeacherAssignmentFeedbackRelease,
  returnTeacherAssignmentReview,
  saveTeacherAssignmentReview,
  signTeacherAssignmentOriginalAssetRead,
  TeacherAssignmentReviewError,
} from './assignment-review';
import {
  createAssignmentAiGradingBatches,
  createManualQuestionGradingReview,
  refreshAssignmentAiGradingOperation as refreshAssignmentAiGradingOperationImpl,
} from './assignment-grading-orchestration';
import { retryQuestionGradingBatchItem } from '@/lib/data-governance/math-document-grading-batch';
import { retryDocumentConversion } from '@/lib/data-governance/math-document-grading-persistence';
import { enqueueMathDocumentGradingJob } from '@/lib/data-governance/math-document-grading-queue';
import {
  AssignmentSubmissionGradeError,
  confirmAssignmentSubmissionGrade,
  getAssignmentSubmissionGrade,
  recordAssignmentQuestionConclusion,
  refreshAssignmentSubmissionGrade,
  releaseAssignmentSubmissionGrade,
  returnAssignmentQuestionForResubmission,
} from './assignment-grading-closure';
import {
  consumeSubmissionAssetRead,
  finalizeQuestionAsset,
  getQuestionUploadStatus,
  getStudentAssignment,
  listStudentAssignments,
  removeQuestionAsset,
  reorderQuestionAssets,
  saveQuestionDraft,
  signQuestionUpload,
  signSubmissionAssetRead,
  submitQuestionAnswer,
} from './submission-service';

export type AssignmentActor = { id: string; role: 'TEACHER' | 'ADMIN' };
export type StudentActor = { id: string };

export type { StudentAssignmentDto, StudentQuestionDto, StudentAssignmentFeedbackDto } from './submission-dto';
export type { AssignmentDraftInput, AssignmentDraftPersistenceInput, AssignmentAudienceInput } from './assignment-domain';
export { AssignmentDomainError, assignmentDraftPersistenceSchema } from './assignment-domain';
export {
  SubmissionError,
  SUBMISSION_LIMITS,
  finalizeSchema,
  removeAssetSchema,
  reorderAssetsSchema,
  submitAnswerSchema,
  textDraftSchema,
  uploadIntentSchema,
} from './submission-domain';
export { TeacherAssignmentReviewError } from './assignment-review';
export { assignmentContentAssetUploadSchema } from './assignment-content-assets';
export { assignmentRubricGenerationRequestSchema } from './assignment-rubric-generation';
export { getLocalTestSubmissionObjectStore };

function db() {
  return prisma;
}

function store() {
  return createSubmissionObjectStore();
}

export async function teacherListAssignments(actor: AssignmentActor) {
  return listTeacherAssignments(db(), actor);
}

export async function teacherGetAssignment(actor: AssignmentActor, assignmentId: string) {
  const assignment = await db().assignment.findFirst({
    where: actor.role === 'ADMIN' ? { id: assignmentId } : { id: assignmentId, authorId: actor.id },
    include: {
      revisions: {
        orderBy: { revisionNumber: 'desc' },
        include: { questions: { orderBy: { orderIndex: 'asc' } }, audiences: true },
      },
    },
  });
  if (!assignment) throw new AssignmentDomainError('assignment-not-found');
  return assignment;
}

export async function teacherCreateDraft(actor: AssignmentActor, input: { courseContext?: string; draft: Parameters<typeof createAssignmentDraft>[1]['draft'] }) {
  return createAssignmentDraft(db(), { actor, ...input });
}

export async function teacherUpdateDraft(actor: AssignmentActor, input: Omit<Parameters<typeof updateAssignmentDraft>[1], 'actor'>) {
  return updateAssignmentDraft(db(), { actor, ...input });
}

export async function teacherDeleteDraft(actor: AssignmentActor, input: Omit<Parameters<typeof deleteDraftRevision>[1], 'actor'>) {
  return deleteDraftRevision(db(), { actor, ...input });
}

export async function teacherCreateNextDraft(actor: AssignmentActor, assignmentId: string) {
  return createNextDraftRevision(db(), { actor, assignmentId });
}

export async function teacherPublishRevision(actor: AssignmentActor, input: Omit<Parameters<typeof publishAssignmentRevision>[1], 'actor'>) {
  return publishAssignmentRevision(db(), { actor, ...input });
}

export async function teacherGenerateRubricGuidelines(
  actor: AssignmentActor,
  assignmentId: string,
  request: Parameters<typeof generateAssignmentRubricGuidelines>[1]['request'],
) {
  return generateAssignmentRubricGuidelines(
    prisma,
    { actor, assignmentId, request },
    await resolveAssignmentRubricGenerationProvider(),
  );
}

export async function teacherListManagedClasses(actor: AssignmentActor) {
  return db().class.findMany({
    where: actor.role === 'ADMIN' ? { isActive: true } : { teacherId: actor.id, isActive: true },
    orderBy: [{ name: 'asc' }, { id: 'asc' }],
    select: { id: true, name: true, code: true, year: true, semester: true },
  });
}

export async function teacherListQuestionCatalog() {
  return listAssignmentQuestionCatalog();
}

export async function teacherSelectQuestionCatalogItem(sourceId: string) {
  return selectAssignmentQuestionCatalogItem(sourceId);
}

export async function teacherSignContentAssetUpload(actor: AssignmentActor, assignmentId: string, upload: Parameters<typeof signAssignmentContentAssetUpload>[1]['upload']) {
  return signAssignmentContentAssetUpload(db(), {
    actorId: actor.id,
    actorRole: actor.role,
    assignmentId,
    upload,
  });
}

export async function teacherCompleteContentAssetUpload(actor: AssignmentActor, assignmentId: string, assetId: string) {
  return completeAssignmentContentAssetUpload(db(), {
    actorId: actor.id,
    actorRole: actor.role,
    assignmentId,
    assetId,
  });
}

export async function readPublicAssignmentContentAsset(input: { actorId: string; actorRole: string; assignmentId: string; assetId: string }) {
  return readAssignmentContentAsset(db(), input);
}

export async function studentListAssignments(actor: StudentActor) {
  return listStudentAssignments(db(), actor.id);
}

export async function studentGetAssignment(actor: StudentActor, assignmentId: string, revisionId?: string) {
  return getStudentAssignment(db(), actor.id, assignmentId, new Date(), revisionId);
}

export async function studentSaveQuestionDraft(actor: StudentActor, input: Omit<Parameters<typeof saveQuestionDraft>[1], 'studentId'>) {
  return saveQuestionDraft(db(), { studentId: actor.id, ...input });
}

export async function studentSignQuestionUpload(actor: StudentActor, input: Omit<Parameters<typeof signQuestionUpload>[2], 'studentId'>) {
  return signQuestionUpload(db(), store(), { studentId: actor.id, ...input });
}

export async function studentFinalizeQuestionAsset(actor: StudentActor, input: Omit<Parameters<typeof finalizeQuestionAsset>[2], 'studentId'>) {
  return finalizeQuestionAsset(db(), store(), { studentId: actor.id, ...input });
}

export async function studentGetQuestionUploadStatus(actor: StudentActor, input: Omit<Parameters<typeof getQuestionUploadStatus>[1], 'studentId'>) {
  return getQuestionUploadStatus(db(), { studentId: actor.id, ...input });
}

export async function studentReorderQuestionAssets(actor: StudentActor, input: Omit<Parameters<typeof reorderQuestionAssets>[1], 'studentId'>) {
  return reorderQuestionAssets(db(), { studentId: actor.id, ...input });
}

export async function studentRemoveQuestionAsset(actor: StudentActor, input: Omit<Parameters<typeof removeQuestionAsset>[1], 'studentId'>) {
  return removeQuestionAsset(db(), { studentId: actor.id, ...input });
}

export async function studentSubmitQuestionAnswer(actor: StudentActor, input: Omit<Parameters<typeof submitQuestionAnswer>[1], 'studentId'>) {
  return submitQuestionAnswer(db(), { studentId: actor.id, ...input });
}

export async function studentSignQuestionAssetRead(actor: StudentActor, input: { assignmentId: string; questionId: string; assetId: string }) {
  return signSubmissionAssetRead(db(), { studentId: actor.id, ...input });
}

export async function studentReadQuestionAsset(actor: StudentActor, input: { assignmentId: string; questionId: string; assetId: string; token: string }) {
  const asset = await consumeSubmissionAssetRead(db(), { studentId: actor.id, ...input });
  const bytes = await store().readObject(asset.objectKey);
  if (!asset.checksum) throw new SubmissionError('submission-content-unavailable', 410);
  assertSubmissionObjectIntegrity(bytes, asset.sizeBytes, asset.checksum);
  return { bytes, mimeType: asset.mimeType, displayName: asset.displayName, sizeBytes: bytes.byteLength };
}

export async function studentReadFeedbackAsset(actor: StudentActor, assignmentId: string, snapshotId: string) {
  const snapshot = await db().teacherAssignmentApprovalSnapshot.findUnique({
    where: { id: snapshotId },
    include: {
      submission: true,
      feedbackRelease: { include: { derivative: true } },
      outboxCommands: { where: { command: 'RELEASE_STUDENT_FEEDBACK', state: 'SUCCEEDED' }, select: { id: true } },
    },
  });
  const derivative = snapshot?.feedbackRelease?.derivative;
  if (!snapshot
    || snapshot.assignmentId !== assignmentId
    || snapshot.submission.studentId !== actor.id
    || snapshot.submission.frozenStudentId !== actor.id
    || snapshot.feedbackRelease?.ownerStudentId !== actor.id
    || snapshot.outboxCommands.length !== 1
    || derivative?.state !== 'READY'
    || !derivative.outputObjectKey
    || !derivative.outputChecksum) {
    throw new SubmissionError('reviewed-asset-not-found', 404);
  }
  let bytes: Uint8Array;
  try {
    bytes = await readReviewedDerivativeObject(derivative.outputObjectKey);
  } catch {
    throw new SubmissionError('reviewed-asset-unavailable', 503);
  }
  const checksum = `sha256:${Buffer.from(await crypto.subtle.digest('SHA-256', bytes)).toString('hex')}`;
  if (checksum !== derivative.outputChecksum) throw new SubmissionError('reviewed-asset-integrity-failed', 409);
  const extension = derivative.outputKind === 'REVIEWED_DOCX' ? 'docx' : derivative.outputKind === 'REVIEWED_PDF' ? 'pdf' : 'md';
  return {
    bytes,
    mimeType: derivative.outputMimeType,
    filename: `reviewed-assignment-${snapshot.questionId}.${extension}`,
  };
}

export async function teacherListAssignmentSubmissions(actor: AssignmentActor, assignmentId: string) {
  return listTeacherAssignmentSubmissions(db(), { actor, assignmentId });
}

export async function teacherGetReview(
  actor: AssignmentActor,
  assignmentId: string,
  submissionId: string,
  query?: { reviewId?: string; gradingRunId?: string },
) {
  const review = await getTeacherAssignmentReview(db(), {
    actor,
    assignmentId,
    submissionId,
    reviewId: query?.reviewId,
    gradingRunId: query?.gradingRunId,
  });
  return buildTeacherAssignmentReviewApiProjection(review);
}

export async function teacherOpenReview(
  actor: AssignmentActor,
  assignmentId: string,
  submissionId: string,
  gradingRunId: string,
) {
  const result = await createTeacherAssignmentReview(db(), { actor, assignmentId, submissionId, gradingRunId });
  return {
    ...result,
    review: buildTeacherAssignmentReviewApiProjection(result.review),
  };
}

export async function teacherSaveReview(
  actor: AssignmentActor,
  assignmentId: string,
  submissionId: string,
  input: {
    reviewId: string;
    expectedVersion: number;
    criteria: Array<{ criterionId: string; levelId: string | null; score: number; comment: string }>;
    annotations: Array<{
      id?: string;
      criterionId: string;
      status: 'ACTIVE' | 'SUPPRESSED';
      comment: string;
      anchor: Record<string, unknown>;
      origin?: 'AI_DRAFT' | 'TEACHER';
    }>;
    overallComment: string;
  },
) {
  const review = await saveTeacherAssignmentReview(db(), { actor, assignmentId, submissionId, ...input });
  return buildTeacherAssignmentReviewApiProjection(review);
}

export async function teacherApproveReview(
  actor: AssignmentActor,
  assignmentId: string,
  submissionId: string,
  input: {
    reviewId: string;
    expectedVersion: number;
    idempotencyKey: string;
    confirmIncompleteEvidence?: boolean;
    omittedAssetIds?: string[];
  },
) {
  return approveTeacherAssignmentReview(db(), { actor, assignmentId, submissionId, ...input });
}

export async function teacherReturnReview(
  actor: AssignmentActor,
  assignmentId: string,
  submissionId: string,
  input: {
    reviewId: string;
    expectedVersion: number;
    idempotencyKey: string;
    reason: string;
    allowedResponseType: 'SUBJECTIVE_TEXT' | 'SUBJECTIVE_FILE';
    newDeadlineAt: Date;
  },
) {
  return returnTeacherAssignmentReview(db(), { actor, assignmentId, submissionId, ...input });
}

export async function teacherRequestFeedbackRelease(
  actor: AssignmentActor,
  assignmentId: string,
  submissionId: string,
  input: { reviewId: string; mode: 'RETRY_DERIVATIVE' | 'STRUCTURED_ONLY'; limitationAcknowledgement?: string },
) {
  return requestTeacherAssignmentFeedbackRelease(db(), { actor, assignmentId, submissionId, ...input });
}

export async function teacherSignOriginalAssetRead(
  actor: AssignmentActor,
  input: { assignmentId: string; submissionId: string; reviewId: string; assetId: string },
) {
  return signTeacherAssignmentOriginalAssetRead(db(), { actor, ...input });
}

export async function teacherReadOriginalAsset(
  actor: AssignmentActor,
  input: { assignmentId: string; submissionId: string; reviewId: string; assetId: string; token?: string },
) {
  if (!input.token) {
    throw new TeacherAssignmentReviewError('teacher-review-original-asset-token-invalid', 403);
  }
  const asset = await consumeTeacherAssignmentOriginalAssetRead(db(), {
    actor,
    assignmentId: input.assignmentId,
    submissionId: input.submissionId,
    reviewId: input.reviewId,
    assetId: input.assetId,
    token: input.token,
  });
  const bytes = await store().readObject(asset.objectKey);
  if (!asset.checksum) throw new SubmissionError('submission-content-unavailable', 410);
  assertSubmissionObjectIntegrity(bytes, asset.sizeBytes, asset.checksum);
  return {
    bytes,
    mimeType: asset.mimeType,
    displayName: asset.displayName,
    sizeBytes: bytes.byteLength,
  };
}

// ---- 教师批改编排与作业级收口的 public API 入口 ----
// Assignment-scoped 批改操作统一从这里进入；路由层保持薄壳，不直接触 Prisma。

export async function teacherStartAssignmentAiGrading(input: Omit<Parameters<typeof createAssignmentAiGradingBatches>[0], 'db'>) {
  return createAssignmentAiGradingBatches({ ...input, db: prisma });
}

export async function refreshAssignmentAiGradingOperation(input: {
  batchId: string;
  now?: Date;
  db?: Parameters<typeof refreshAssignmentAiGradingOperationImpl>[0]['db'];
}) {
  return refreshAssignmentAiGradingOperationImpl({
    db: input.db ?? prisma,
    batchId: input.batchId,
    now: input.now,
  });
}

export async function teacherCreateManualQuestionGrading(input: {
  assignmentId: string;
  submissionId: string;
  questionId: string;
  actor: { id: string; role: 'TEACHER' | 'ADMIN' };
  idempotencyKey: string;
  now?: Date;
}) {
  const result = await createManualQuestionGradingReview({ db: prisma, ...input });
  return {
    run: { id: result.run.id, source: result.run.source, state: result.run.state },
    review: buildTeacherAssignmentReviewApiProjection(result.review),
    replay: result.replay,
  };
}

export async function teacherRetryAssignmentGradingBatchItem(input: {
  actor: { id: string; role: 'TEACHER' | 'ADMIN' };
  assignmentId: string;
  batchId: string;
  itemId: string;
  idempotencyKey: string;
  reason: string;
}): Promise<
  | { kind: 'not-found' }
  | { kind: 'conversion'; job: unknown; replay: boolean }
  | { kind: 'question'; job: unknown; replay: boolean }
> {
  const batch = await prisma.gradingBatch.findUnique({
    where: { id: input.batchId },
    select: {
      revision: { select: { assignmentId: true } },
      items: {
        where: { id: input.itemId },
        select: { conversionId: true, conversion: { select: { state: true } } },
      },
    },
  });
  if (!batch || batch.revision?.assignmentId !== input.assignmentId) return { kind: 'not-found' };
  const conversion = batch.items[0]?.conversion;
  const conversionId = batch.items[0]?.conversionId;
  if (conversionId && conversion && ['FAILED', 'RETRYABLE', 'BLOCKED'].includes(conversion.state)) {
    const result = await retryDocumentConversion({ db: prisma, conversionId, actor: input.actor, idempotencyKey: input.idempotencyKey, reason: input.reason });
    const queue = result.job
      ? await enqueueMathDocumentGradingJob({ kind: 'conversion', jobId: result.job.id, conversionId: result.conversion.id }, prisma)
      : { queued: true };
    if (!queue.queued) throw new Error('conversion-retry-queue-unavailable');
    return { kind: 'conversion', job: result.job, replay: result.replay };
  }
  const result = await retryQuestionGradingBatchItem({ db: prisma, batchId: input.batchId, itemId: input.itemId, actor: input.actor, idempotencyKey: input.idempotencyKey, reason: input.reason });
  return { kind: 'question', job: result.job, replay: result.replay };
}

export { AssignmentSubmissionGradeError } from './assignment-grading-closure';

export async function teacherGetAssignmentGradingClosure(input: Parameters<typeof getAssignmentSubmissionGrade>[1]) {
  return getAssignmentSubmissionGrade(prisma, input);
}

export async function teacherRefreshAssignmentGradingClosure(input: Parameters<typeof refreshAssignmentSubmissionGrade>[1]) {
  return refreshAssignmentSubmissionGrade(prisma, input);
}

export async function teacherConfirmAssignmentResult(input: Parameters<typeof confirmAssignmentSubmissionGrade>[1]) {
  return confirmAssignmentSubmissionGrade(prisma, input);
}

export async function teacherReleaseAssignmentResult(input: Parameters<typeof releaseAssignmentSubmissionGrade>[1]) {
  return releaseAssignmentSubmissionGrade(prisma, input);
}

export async function teacherConcludeAssignmentQuestion(input: Parameters<typeof recordAssignmentQuestionConclusion>[1]) {
  return recordAssignmentQuestionConclusion(prisma, input);
}

export async function teacherReturnAssignmentQuestion(input: Parameters<typeof returnAssignmentQuestionForResubmission>[1]) {
  return returnAssignmentQuestionForResubmission(prisma, input);
}

export async function teacherReadReviewedAssignmentAsset(input: {
  actor: { id: string; role: 'TEACHER' | 'ADMIN' };
  assignmentId: string;
  submissionId: string;
  approvalId: string;
  snapshotId: string;
}): Promise<{ bytes: Uint8Array; mimeType: string; filename: string } | null> {
  await getAssignmentSubmissionGrade(prisma, { actor: input.actor, assignmentId: input.assignmentId, submissionId: input.submissionId, snapshotId: input.snapshotId });
  const approval = await prisma.teacherAssignmentApprovalSnapshot.findFirst({
    where: { id: input.approvalId, assignmentId: input.assignmentId, submissionId: input.submissionId },
    include: { reviewedDerivatives: { where: { state: 'READY', outputKind: 'REVIEWED_PDF' }, orderBy: { readyAt: 'desc' }, take: 1 } },
  });
  const derivative = approval?.reviewedDerivatives[0];
  if (!approval || !derivative?.outputObjectKey || !derivative.outputChecksum) return null;
  const bytes = await readReviewedDerivativeObject(derivative.outputObjectKey);
  const checksum = `sha256:${Buffer.from(await crypto.subtle.digest('SHA-256', bytes)).toString('hex')}`;
  if (checksum !== derivative.outputChecksum) throw new AssignmentSubmissionGradeError('reviewed-asset-integrity-failed', 409);
  return { bytes, mimeType: derivative.outputMimeType, filename: `reviewed-assignment-${approval.questionId}.pdf` };
}

export const STUDENT_DTO_FORBIDDEN_FIELDS = [
  'referenceAnswer',
  'teacherGuidance',
  'providerMetadata',
  'NEXTAUTH_SECRET',
  'DATABASE_URL',
] as const;
