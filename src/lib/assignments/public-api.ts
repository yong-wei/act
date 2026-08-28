import { prisma } from '@/lib/prisma';
import { readReviewedDerivativeObject } from '@/lib/data-governance/teacher-assignment-review-derivative-storage';

import { AssignmentDomainError } from './assignment-domain';
import {
  completeAssignmentContentAssetUpload,
  readAssignmentContentAsset,
  signAssignmentContentAssetUpload,
} from './assignment-content-assets';
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
import { createSubmissionObjectStore } from './submission-object-store';
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
export { AssignmentDomainError } from './assignment-domain';
export { SubmissionError } from './submission-domain';
export { assignmentContentAssetUploadSchema } from './assignment-content-assets';

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

export const STUDENT_DTO_FORBIDDEN_FIELDS = [
  'referenceAnswer',
  'teacherGuidance',
  'providerMetadata',
  'NEXTAUTH_SECRET',
  'DATABASE_URL',
] as const;
