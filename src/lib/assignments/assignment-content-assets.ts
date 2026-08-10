import { createHash } from 'node:crypto';
import { fromMarkdown } from 'mdast-util-from-markdown';
import { z } from 'zod';
import type { PrismaClient } from '@prisma/client';

import { SUBMISSION_LIMITS, checksumSchema, SubmissionError } from './submission-domain';
import {
  createSubmissionObjectStore,
  type SubmissionObjectStore,
} from './submission-object-store';
import {
  createSubmissionContentScanner,
  type SubmissionContentScanner,
} from './submission-scanner';

export const assignmentContentAssetUploadSchema = z.object({
  fileName: z.string().trim().min(1).max(240),
  mimeType: z.enum(['image/png', 'image/jpeg']),
  sizeBytes: z.number().int().positive().max(SUBMISSION_LIMITS.file),
  checksum: checksumSchema,
}).strict();

export type AssignmentContentField = 'PROMPT' | 'REFERENCE_ANSWER';
export type AssignmentContentMarker = {
  assetId: string;
  stableQuestionId: string;
  field: AssignmentContentField;
};

export function assignmentContentAssetHref(assignmentId: string, assetId: string) {
  return `/api/assignments/${encodeURIComponent(assignmentId)}/content-assets/${encodeURIComponent(assetId)}`;
}

export function extractAssignmentContentMarkers(
  assignmentId: string,
  stableQuestionId: string,
  field: AssignmentContentField,
  markdown: string,
): AssignmentContentMarker[] {
  const markers: AssignmentContentMarker[] = [];
  if (/<img\b/i.test(markdown)) {
    throw new SubmissionError('invalid-assignment-content-asset-marker');
  }
  for (const image of markdownImages(markdown)) {
    const assetId = image.title?.startsWith('asset:')
      ? image.title.slice('asset:'.length)
      : '';
    if (
      !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/.test(assetId)
      || image.url !== assignmentContentAssetHref(assignmentId, assetId)
    ) {
      throw new SubmissionError('invalid-assignment-content-asset-marker');
    }
    markers.push({ assetId, stableQuestionId, field });
  }
  return markers;
}

export async function signAssignmentContentAssetUpload(
  db: PrismaClient,
  input: {
    actorId: string;
    actorRole: 'TEACHER' | 'ADMIN';
    assignmentId: string;
    upload: z.infer<typeof assignmentContentAssetUploadSchema>;
  },
  store: SubmissionObjectStore = createSubmissionObjectStore(),
) {
  const upload = assignmentContentAssetUploadSchema.parse(input.upload);
  const assignment = await db.assignment.findUnique({
    where: { id: input.assignmentId },
    select: { authorId: true, archivedAt: true },
  });
  if (!assignment) throw new SubmissionError('assignment-not-found', 404);
  if (input.actorRole !== 'ADMIN' && assignment.authorId !== input.actorId) {
    throw new SubmissionError('assignment-forbidden', 403);
  }
  if (assignment.archivedAt) throw new SubmissionError('assignment-archived', 409);
  const asset = await db.assignmentContentAsset.create({
    data: {
      assignmentId: input.assignmentId,
      uploaderId: input.actorId,
      objectKey: `pending:${crypto.randomUUID()}`,
      originalName: upload.fileName,
      mimeType: upload.mimeType,
      sizeBytes: upload.sizeBytes,
      checksum: upload.checksum,
    },
  });
  const signed = await store.signUpload({
    ownerId: input.actorId,
    answerId: `assignment-content:${input.assignmentId}:${asset.id}`,
    sizeBytes: upload.sizeBytes,
    mimeType: upload.mimeType,
    checksum: upload.checksum,
  });
  await db.assignmentContentAsset.update({
    where: { id: asset.id },
    data: { objectKey: signed.key },
  });
  return {
    assetId: asset.id,
    upload: {
      url: signed.url,
      expiresAt: signed.expiresAt,
      requiredHeaders: signed.requiredHeaders,
    },
  };
}

export async function completeAssignmentContentAssetUpload(
  db: PrismaClient,
  input: { actorId: string; actorRole: 'TEACHER' | 'ADMIN'; assignmentId: string; assetId: string },
  store: SubmissionObjectStore = createSubmissionObjectStore(),
  scanner: SubmissionContentScanner = createSubmissionContentScanner(),
) {
  const asset = await db.assignmentContentAsset.findUnique({
    where: { id: input.assetId },
    include: { assignment: { select: { authorId: true } } },
  });
  if (!asset || asset.assignmentId !== input.assignmentId) {
    throw new SubmissionError('assignment-content-asset-not-found', 404);
  }
  if (
    input.actorRole !== 'ADMIN'
    && (asset.assignment.authorId !== input.actorId || asset.uploaderId !== input.actorId)
  ) {
    throw new SubmissionError('assignment-content-asset-forbidden', 403);
  }
  if (asset.state === 'AVAILABLE') {
    return { assetId: asset.id, href: assignmentContentAssetHref(asset.assignmentId, asset.id) };
  }
  const [metadata, bytes] = await Promise.all([
    store.head(asset.objectKey),
    store.readObject(asset.objectKey),
  ]);
  if (
    !metadata
    || metadata.ownerId !== asset.uploaderId
    || metadata.answerId !== `assignment-content:${asset.assignmentId}:${asset.id}`
    || metadata.mimeType !== asset.mimeType
    || metadata.sizeBytes !== asset.sizeBytes
    || metadata.checksum !== asset.checksum
    || bytes.byteLength !== asset.sizeBytes
    || `sha256:${createHash('sha256').update(bytes).digest('hex')}` !== asset.checksum
    || !matchesImageMagic(bytes, asset.mimeType)
  ) {
    throw new SubmissionError('assignment-content-asset-integrity-mismatch', 409);
  }
  await scanner.healthCheck();
  if (await scanner.scan(bytes) !== 'CLEAN') {
    throw new SubmissionError('assignment-content-asset-unsafe', 409);
  }
  await db.assignmentContentAsset.update({
    where: { id: asset.id },
    data: { state: 'AVAILABLE', availableAt: new Date() },
  });
  return { assetId: asset.id, href: assignmentContentAssetHref(asset.assignmentId, asset.id) };
}

export async function replaceAssignmentRevisionAssetReferences(
  tx: Pick<PrismaClient, 'assignmentContentAsset' | 'assignmentRevisionAssetReference'>,
  input: {
    assignmentId: string;
    revisionId: string;
    questions: readonly { stableQuestionId: string; prompt: string; referenceAnswer: string }[];
  },
) {
  const discoveredMarkers = input.questions.flatMap((question) => [
    ...extractAssignmentContentMarkers(input.assignmentId, question.stableQuestionId, 'PROMPT', question.prompt),
    ...extractAssignmentContentMarkers(input.assignmentId, question.stableQuestionId, 'REFERENCE_ANSWER', question.referenceAnswer),
  ]);
  const markers = [...new Map(
    discoveredMarkers.map((marker) => [referenceKey(marker), marker]),
  ).values()];
  const assetIds = [...new Set(markers.map((marker) => marker.assetId))];
  const assets = assetIds.length
      ? await tx.assignmentContentAsset.findMany({
        where: {
          id: { in: assetIds },
          assignmentId: input.assignmentId,
          state: 'AVAILABLE',
        },
        select: { id: true },
      })
    : [];
  if (assets.length !== assetIds.length) {
    throw new SubmissionError('assignment-content-asset-reference-forbidden', 403);
  }
  await tx.assignmentRevisionAssetReference.deleteMany({
    where: { revisionId: input.revisionId },
  });
  if (markers.length) {
    await tx.assignmentRevisionAssetReference.createMany({
      data: markers.map((marker) => ({ revisionId: input.revisionId, ...marker })),
      skipDuplicates: true,
    });
  }
}

export async function assertAssignmentRevisionAssetReferences(
  tx: Pick<PrismaClient, 'assignmentRevisionAssetReference'>,
  input: {
    assignmentId: string;
    revisionId: string;
    questions: readonly { stableQuestionId: string; prompt: string; referenceAnswer: string }[];
  },
) {
  const expected = [...new Set(input.questions.flatMap((question) => [
    ...extractAssignmentContentMarkers(input.assignmentId, question.stableQuestionId, 'PROMPT', question.prompt),
    ...extractAssignmentContentMarkers(input.assignmentId, question.stableQuestionId, 'REFERENCE_ANSWER', question.referenceAnswer),
  ]).map(referenceKey))].sort();
  const actual = (await tx.assignmentRevisionAssetReference.findMany({
    where: { revisionId: input.revisionId, asset: { state: 'AVAILABLE' } },
    select: { assetId: true, stableQuestionId: true, field: true },
  })).map((reference) => referenceKey(reference as AssignmentContentMarker)).sort();
  if (expected.length !== actual.length || expected.some((value, index) => value !== actual[index])) {
    throw new SubmissionError('assignment-content-asset-reference-mismatch', 409);
  }
}

export async function readAssignmentContentAsset(
  db: PrismaClient,
  input: { actorId: string; actorRole: string; assignmentId: string; assetId: string },
  store: SubmissionObjectStore = createSubmissionObjectStore(),
) {
  const asset = await db.assignmentContentAsset.findUnique({
    where: { id: input.assetId },
    include: {
      assignment: { select: { authorId: true } },
      references: { select: { revisionId: true, field: true } },
    },
  });
  if (!asset || asset.assignmentId !== input.assignmentId || asset.state !== 'AVAILABLE') {
    throw new SubmissionError('assignment-content-asset-not-found', 404);
  }
  const teacherAllowed = input.actorRole === 'ADMIN'
    || (input.actorRole === 'TEACHER' && asset.assignment.authorId === input.actorId);
  const promptRevisionIds = asset.references
    .filter((reference) => reference.field === 'PROMPT')
    .map((reference) => reference.revisionId);
  const studentProfile = input.actorRole === 'STUDENT' && promptRevisionIds.length > 0
    ? await db.studentProfile.findUnique({
        where: { userId: input.actorId },
        select: { classId: true },
      })
    : null;
  const currentRevision = studentProfile?.classId
    ? await db.assignmentRevision.findFirst({
        where: {
          assignmentId: input.assignmentId,
          state: 'PUBLISHED',
          frozenAt: { not: null },
          assignment: { archivedAt: null },
          audiences: {
            some: {
              classId: studentProfile.classId,
              archivedAt: null,
              availableAt: { lte: new Date() },
              class: { isActive: true },
            },
          },
        },
        orderBy: { revisionNumber: 'desc' },
        select: { id: true },
      })
    : null;
  const studentAllowed = Boolean(
    currentRevision && promptRevisionIds.includes(currentRevision.id),
  );
  const historicalSubmission = !studentAllowed
    && input.actorRole === 'STUDENT'
    && promptRevisionIds.length > 0
    ? await db.assignmentSubmission.findFirst({
        where: {
          studentId: input.actorId,
          frozenStudentId: input.actorId,
          assignmentRevisionId: { in: promptRevisionIds },
          revision: {
            assignmentId: input.assignmentId,
            historicalOwnerships: {
              some: { studentId: input.actorId, anonymizedAt: null },
            },
          },
        },
        orderBy: { updatedAt: 'desc' },
        include: {
          audience: { select: { classId: true } },
          revision: {
            select: {
              historicalOwnerships: {
                where: { studentId: input.actorId },
                take: 1,
                select: { audienceClassId: true, anonymizedAt: true },
              },
            },
          },
        },
      })
    : null;
  const historicalOwnership = historicalSubmission?.revision.historicalOwnerships[0];
  const historicalAllowed = Boolean(
    historicalSubmission
    && historicalOwnership
    && !historicalOwnership.anonymizedAt
    && historicalSubmission.frozenStudentId === input.actorId
    && historicalSubmission.frozenAudienceClassId === historicalSubmission.audience.classId
    && historicalOwnership.audienceClassId === historicalSubmission.frozenAudienceClassId,
  );
  if (!teacherAllowed && !studentAllowed && !historicalAllowed) {
    throw new SubmissionError('assignment-content-asset-forbidden', 403);
  }
  const [metadata, bytes] = await Promise.all([
    store.head(asset.objectKey),
    store.readObject(asset.objectKey),
  ]);
  if (
    !metadata
    || metadata.ownerId !== asset.uploaderId
    || metadata.answerId !== `assignment-content:${asset.assignmentId}:${asset.id}`
    || metadata.mimeType !== asset.mimeType
    || metadata.sizeBytes !== asset.sizeBytes
    || metadata.checksum !== asset.checksum
    || bytes.byteLength !== asset.sizeBytes
    || `sha256:${createHash('sha256').update(bytes).digest('hex')}` !== asset.checksum
    || !matchesImageMagic(bytes, asset.mimeType)
  ) {
    throw new SubmissionError('assignment-content-asset-integrity-mismatch', 409);
  }
  return { bytes, mimeType: asset.mimeType };
}

function matchesImageMagic(bytes: Uint8Array, mimeType: string) {
  if (mimeType === 'image/png') {
    return bytes.length >= 8
      && [137, 80, 78, 71, 13, 10, 26, 10].every((value, index) => bytes[index] === value);
  }
  return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
}

function referenceKey(marker: AssignmentContentMarker) {
  return `${marker.stableQuestionId}\u0000${marker.field}\u0000${marker.assetId}`;
}

type MarkdownNode = {
  type: string;
  children?: MarkdownNode[];
  identifier?: string;
  url?: string;
  title?: string | null;
};

function markdownImages(markdown: string): Array<{ url: string; title: string | null }> {
  const root = fromMarkdown(markdown) as MarkdownNode;
  const definitions = new Map<string, { url: string; title: string | null }>();
  visitMarkdown(root, (node) => {
    if (node.type !== 'definition' || !node.identifier || !node.url) return;
    const identifier = node.identifier.toLowerCase();
    if (definitions.has(identifier)) return;
    definitions.set(identifier, {
      url: node.url,
      title: node.title ?? null,
    });
  });
  const images: Array<{ url: string; title: string | null }> = [];
  visitMarkdown(root, (node) => {
    if (node.type === 'image' && node.url) {
      images.push({ url: node.url, title: node.title ?? null });
      return;
    }
    if (node.type !== 'imageReference' || !node.identifier) return;
    const definition = definitions.get(node.identifier.toLowerCase());
    if (!definition) {
      throw new SubmissionError('invalid-assignment-content-asset-marker');
    }
    images.push(definition);
  });
  return images;
}

function visitMarkdown(node: MarkdownNode, visitor: (node: MarkdownNode) => void) {
  visitor(node);
  for (const child of node.children ?? []) {
    visitMarkdown(child, visitor);
  }
}
