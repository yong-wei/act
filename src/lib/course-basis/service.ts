import { Prisma, type PrismaClient } from '@prisma/client';
import { z } from 'zod';

import { CourseBasisError, type CourseBasisActor, type CourseBasisSource } from './domain';
import {
  COURSE_BASIS_EXTRACTION_VERSION,
  extractCourseBasisSource,
  failedCourseBasisExtraction,
  normalizeCourseBasisMimeType,
} from './extraction';

type CourseBasisDb = PrismaClient;
const courseBasisActorSchema = z.object({ id: z.string().trim().min(1).max(200), role: z.enum(['TEACHER', 'ADMIN']) }).strict();
const courseBasisIdSchema = z.string().trim().min(1).max(200);
const courseBasisDocumentKindSchema = z.enum(['STANDARD', 'TEXTBOOK', 'OTHER']);
const COURSE_BASIS_LIST_PREVIEW_SEGMENTS = 3;
const COURSE_BASIS_LIST_PREVIEW_CHARS = 320;
const COURSE_BASIS_LIST_LIMIT = 50;
const COURSE_BASIS_DOCUMENT_LIST_LIMIT = 20;
const COURSE_BASIS_VERSION_LIST_LIMIT = 20;
const COURSE_BASIS_PREVIEW_DEFAULT_PAGE_SIZE = 20;
export const COURSE_BASIS_PREVIEW_MAX_PAGE_SIZE = 100;

export async function createCourseBasis(db: CourseBasisDb, input: {
  actor: CourseBasisActor;
  courseIdentity: string;
  title: string;
  description?: string | null;
}) {
  const actor = validateActor(input.actor);
  return db.courseBasis.create({
    data: {
      ownerId: actor.id,
      courseIdentity: requiredText(input.courseIdentity, 'course-identity-required', 160),
      title: requiredText(input.title, 'title-required', 200),
      description: optionalText(input.description, 'description-invalid', 1000),
    },
  });
}

export async function listCourseBases(db: CourseBasisDb, actor: CourseBasisActor, options: {
  offset?: number;
  limit?: number;
  courseBasisId?: string;
  fullHistory?: boolean;
} = {}) {
  const validatedActor = validateActor(actor);
  const offset = Math.max(0, Math.trunc(options.offset ?? 0));
  const limit = Math.min(COURSE_BASIS_LIST_LIMIT, Math.max(1, Math.trunc(options.limit ?? COURSE_BASIS_LIST_LIMIT)));
  const rows = await db.courseBasis.findMany({
    where: {
      ...(validatedActor.role === 'ADMIN' ? {} : { ownerId: validatedActor.id }),
      ...(options.courseBasisId ? { id: validateId(options.courseBasisId, 'course-basis-id-invalid') } : {}),
    },
    orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
    skip: offset,
    take: limit,
    select: {
      id: true,
      ownerId: true,
      courseIdentity: true,
      title: true,
      description: true,
      createdAt: true,
      updatedAt: true,
      documents: {
        orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
        ...(!options.fullHistory ? { take: COURSE_BASIS_DOCUMENT_LIST_LIMIT } : {}),
        select: {
          id: true,
          courseBasisId: true,
          title: true,
          kind: true,
          createdAt: true,
          updatedAt: true,
          versions: {
            orderBy: { versionNumber: 'desc' },
            ...(!options.fullHistory ? { take: COURSE_BASIS_VERSION_LIST_LIMIT } : {}),
            select: {
              id: true,
              documentId: true,
              versionNumber: true,
              sourceType: true,
              sourceName: true,
              mimeType: true,
              byteSize: true,
              contentHash: true,
              extractionState: true,
              extractionVersion: true,
              failureReason: true,
              reviewState: true,
              reviewedAt: true,
              retiredAt: true,
              createdAt: true,
              _count: { select: { segments: true } },
              segments: {
                orderBy: { orderIndex: 'asc' },
                take: COURSE_BASIS_LIST_PREVIEW_SEGMENTS,
                select: {
                  stableAnchor: true,
                  headingPath: true,
                  pageNumber: true,
                  paragraphNumber: true,
                  contentHash: true,
                  text: true,
                },
              },
            },
          },
        },
      },
    },
  });
  return rows.map((courseBasis) => ({
    ...courseBasis,
    documents: courseBasis.documents.map((document) => ({
      ...document,
      versions: document.versions.map(({ _count, segments, ...version }) => {
        const previewTruncated = _count.segments > segments.length
          || segments.some((segment) => segment.text.length > COURSE_BASIS_LIST_PREVIEW_CHARS);
        return {
          ...version,
          segmentCount: _count.segments,
          previewTruncated,
          segments: segments.map(({ text, ...segment }) => ({
            ...segment,
            text: text.slice(0, COURSE_BASIS_LIST_PREVIEW_CHARS),
            previewTruncated: text.length > COURSE_BASIS_LIST_PREVIEW_CHARS,
          })),
        };
      }),
    })),
  }));
}

export async function getCourseBasisVersionExtractionPreview(db: CourseBasisDb, input: {
  actor: CourseBasisActor;
  versionId: string;
  page?: number;
  pageSize?: number;
}) {
  const actor = validateActor(input.actor);
  const versionId = validateId(input.versionId, 'version-id-invalid');
  const page = positiveInteger(input.page ?? 1, 'preview-page-invalid');
  const pageSize = boundedPageSize(input.pageSize ?? COURSE_BASIS_PREVIEW_DEFAULT_PAGE_SIZE);
  const version = await db.courseBasisDocumentVersion.findFirst({
    where: actor.role === 'ADMIN'
      ? { id: versionId }
      : { id: versionId, document: { courseBasis: { ownerId: actor.id } } },
    select: {
      id: true,
      documentId: true,
      versionNumber: true,
      sourceName: true,
      sourceType: true,
      contentHash: true,
      extractionState: true,
      extractionVersion: true,
      failureReason: true,
      reviewState: true,
      retiredAt: true,
    },
  });
  if (!version) throw new CourseBasisError('version-not-found');

  const [total, segments] = await Promise.all([
    db.courseBasisSegment.count({ where: { versionId } }),
    db.courseBasisSegment.findMany({
      where: { versionId },
      orderBy: { orderIndex: 'asc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        orderIndex: true,
        stableAnchor: true,
        headingPath: true,
        pageNumber: true,
        paragraphNumber: true,
        contentHash: true,
        text: true,
      },
    }),
  ]);
  return {
    version,
    page,
    pageSize,
    total,
    pageCount: total === 0 ? 0 : Math.ceil(total / pageSize),
    segments,
  };
}

export async function getCourseBasis(db: CourseBasisDb, actor: CourseBasisActor, courseBasisId: string) {
  actor = validateActor(actor);
  courseBasisId = validateId(courseBasisId, 'course-basis-id-invalid');
  const courseBasis = await db.courseBasis.findFirst({
    where: actor.role === 'ADMIN' ? { id: courseBasisId } : { id: courseBasisId, ownerId: actor.id },
    include: {
      documents: {
        include: {
          versions: {
            orderBy: { versionNumber: 'desc' },
            include: { segments: { orderBy: { orderIndex: 'asc' } } },
          },
        },
      },
    },
  });
  if (!courseBasis) throw new CourseBasisError('course-basis-not-found');
  return courseBasis;
}

export async function createCourseBasisDocument(db: CourseBasisDb, input: {
  actor: CourseBasisActor;
  courseBasisId: string;
  title: string;
  kind: 'STANDARD' | 'TEXTBOOK' | 'OTHER';
}) {
  const actor = validateActor(input.actor);
  const courseBasisId = validateId(input.courseBasisId, 'course-basis-id-invalid');
  const kind = courseBasisDocumentKindSchema.safeParse(input.kind);
  if (!kind.success) throw new CourseBasisError('document-kind-invalid');
  await assertCourseBasisAccess(db, actor, courseBasisId);
  return db.courseBasisDocument.create({
    data: {
      courseBasisId,
      title: requiredText(input.title, 'document-title-required', 200),
      kind: kind.data,
    },
  });
}

export async function importCourseBasisVersion(db: CourseBasisDb, input: {
  actor: CourseBasisActor;
  documentId: string;
  source: CourseBasisSource;
}) {
  const actor = validateActor(input.actor);
  const documentId = validateId(input.documentId, 'document-id-invalid');
  await assertDocumentAccess(db, actor, documentId);
  const sourceName = requiredText(input.source.sourceName, 'source-name-required', 255);
  let extracted;
  try {
    extracted = await extractCourseBasisSource(input.source);
  } catch (error) {
    if (!(error instanceof CourseBasisError) || error.code !== 'pdf-extraction-failed') throw error;
    extracted = failedCourseBasisExtraction(input.source, error.code);
  }
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await db.$transaction(async (tx) => {
        await assertDocumentAccess(tx as CourseBasisDb, actor, documentId);
        const latest = await tx.courseBasisDocumentVersion.findFirst({
          where: { documentId },
          orderBy: { versionNumber: 'desc' },
          select: { versionNumber: true },
        });
        const { _count, ...version } = await tx.courseBasisDocumentVersion.create({
          data: {
            documentId,
            versionNumber: (latest?.versionNumber ?? 0) + 1,
            sourceType: input.source.sourceType,
            sourceName,
            mimeType: normalizeCourseBasisMimeType(input.source.mimeType),
            byteSize: extracted.byteSize,
            contentHash: extracted.contentHash,
            originalContent: extracted.originalContent,
            normalizedText: extracted.normalizedText,
            extractionState: extracted.extractionState,
            extractionVersion: COURSE_BASIS_EXTRACTION_VERSION,
            failureReason: extracted.failureReason,
            segments: { create: extracted.segments },
          },
          select: {
            id: true,
            documentId: true,
            versionNumber: true,
            sourceType: true,
            sourceName: true,
            mimeType: true,
            byteSize: true,
            contentHash: true,
            extractionState: true,
            extractionVersion: true,
            failureReason: true,
            reviewState: true,
            reviewedById: true,
            reviewedAt: true,
            retiredById: true,
            retiredAt: true,
            createdAt: true,
            _count: { select: { segments: true } },
          },
        });
        return { ...version, segmentCount: _count?.segments ?? extracted.segments.length };
      }, { isolationLevel: 'Serializable' });
    } catch (error) {
      if (!isVersionRace(error) || attempt === 2) {
        if (isVersionRace(error)) throw new CourseBasisError('version-conflict-retryable');
        throw error;
      }
    }
  }
  throw new CourseBasisError('version-conflict-retryable');
}

export async function confirmCourseBasisVersion(db: CourseBasisDb, input: {
  actor: CourseBasisActor;
  versionId: string;
  now?: Date;
}) {
  const actor = validateActor(input.actor);
  const versionId = validateId(input.versionId, 'version-id-invalid');
  return withSerializableRetry(db, async (tx) => {
    const version = await findVersionForActor(tx as CourseBasisDb, actor, versionId);
    if (version.retiredAt) throw new CourseBasisError('version-retired');
    if (version.reviewState === 'REJECTED') throw new CourseBasisError('rejected-version-immutable');
    if (version.extractionState !== 'EXTRACTED' || !version.normalizedText || version.segments.length === 0) {
      throw new CourseBasisError('extraction-not-confirmable');
    }
    const courseBasisId = version.document.courseBasis.id;
    await tx.courseBasisProjection.createMany({
      data: version.segments.map((segment) => ({
        versionId: version.id,
        segmentId: segment.id,
        projectionKey: courseBasisProjectionKey(courseBasisId, version.id, segment.stableAnchor),
        corpusSourceId: courseBasisCorpusSourceId(courseBasisId, version.id, segment.stableAnchor),
        projectedAt: input.now ?? new Date(),
      })),
      skipDuplicates: true,
    });
    const projectionCount = await tx.courseBasisProjection.count({ where: { versionId: version.id } });
    if (projectionCount !== version.segments.length) throw new CourseBasisError('projection-conflict');
    if (version.reviewState !== 'CONFIRMED') {
      await tx.courseBasisDocumentVersion.update({
        where: { id: version.id },
        data: { reviewState: 'CONFIRMED', reviewedById: actor.id, reviewedAt: input.now ?? new Date() },
      });
    }
    return selectVersionMutationResult(tx as CourseBasisDb, version.id);
  });
}

export async function rejectCourseBasisVersion(db: CourseBasisDb, input: {
  actor: CourseBasisActor;
  versionId: string;
  now?: Date;
}) {
  const actor = validateActor(input.actor);
  const versionId = validateId(input.versionId, 'version-id-invalid');
  return withSerializableRetry(db, async (tx) => {
    const version = await findVersionForActor(tx as CourseBasisDb, actor, versionId);
    if (version.retiredAt) throw new CourseBasisError('version-retired');
    if (version.reviewState === 'CONFIRMED') throw new CourseBasisError('confirmed-version-immutable');
    if (version.reviewState === 'REJECTED') return selectVersionMutationResult(tx as CourseBasisDb, version.id);
    await tx.courseBasisDocumentVersion.update({
      where: { id: version.id },
      data: { reviewState: 'REJECTED', reviewedById: actor.id, reviewedAt: input.now ?? new Date() },
    });
    return selectVersionMutationResult(tx as CourseBasisDb, version.id);
  });
}

export async function retryCourseBasisExtraction(db: CourseBasisDb, input: {
  actor: CourseBasisActor;
  versionId: string;
}) {
  const actor = validateActor(input.actor);
  const versionId = validateId(input.versionId, 'version-id-invalid');
  const current = await findVersionForActor(db, actor, versionId);
  if (current.reviewState === 'CONFIRMED') throw new CourseBasisError('confirmed-version-immutable');
  if (current.retiredAt) throw new CourseBasisError('version-retired');
  if (current.extractionState === 'EXTRACTED' && current.reviewState !== 'REJECTED') {
    throw new CourseBasisError('extracted-version-immutable');
  }
  return importCourseBasisVersion(db, {
    actor,
    documentId: current.documentId,
    source: {
      sourceType: current.sourceType,
      sourceName: current.sourceName,
      mimeType: current.mimeType,
      content: current.originalContent,
    },
  });
}

export async function retireCourseBasisVersion(db: CourseBasisDb, input: {
  actor: CourseBasisActor;
  versionId: string;
  now?: Date;
}) {
  const actor = validateActor(input.actor);
  const versionId = validateId(input.versionId, 'version-id-invalid');
  return withSerializableRetry(db, async (tx) => {
    const version = await findVersionForActor(tx as CourseBasisDb, actor, versionId);
    if (!version.retiredAt) {
      await tx.courseBasisDocumentVersion.update({
        where: { id: version.id },
        data: { retiredById: actor.id, retiredAt: input.now ?? new Date() },
      });
    }
    return selectVersionMutationResult(tx as CourseBasisDb, version.id);
  });
}

export async function deleteCourseBasisVersion(db: CourseBasisDb, input: {
  actor: CourseBasisActor;
  versionId: string;
}) {
  const actor = validateActor(input.actor);
  const versionId = validateId(input.versionId, 'version-id-invalid');
  return withSerializableRetry(db, async (tx) => {
    const version = await findVersionForActor(tx as CourseBasisDb, actor, versionId);
    const [referenceLinks, projectionCount] = await Promise.all([
      tx.courseBasisReferenceLink.findMany({
        where: { versionId: version.id },
        select: { referenceType: true, referenceId: true },
        orderBy: [{ referenceType: 'asc' }, { referenceId: 'asc' }],
      }),
      tx.courseBasisProjection.count({ where: { versionId: version.id } }),
    ]);
    if (referenceLinks.length > 0) {
      throw new CourseBasisError('version-delete-referenced', referenceLinks.map((link) => `${link.referenceType}:${link.referenceId}`));
    }
    if (projectionCount > 0) throw new CourseBasisError('version-delete-projected');
    await tx.courseBasisSegment.deleteMany({ where: { versionId: version.id } });
    return tx.courseBasisDocumentVersion.delete({ where: { id: version.id } });
  });
}

async function assertCourseBasisAccess(db: CourseBasisDb, actor: CourseBasisActor, courseBasisId: string) {
  const found = await db.courseBasis.findFirst({
    where: actor.role === 'ADMIN' ? { id: courseBasisId } : { id: courseBasisId, ownerId: actor.id },
    select: { id: true },
  });
  if (!found) throw new CourseBasisError('course-basis-not-found');
}

async function assertDocumentAccess(db: CourseBasisDb, actor: CourseBasisActor, documentId: string) {
  const found = await db.courseBasisDocument.findFirst({
    where: actor.role === 'ADMIN' ? { id: documentId } : { id: documentId, courseBasis: { ownerId: actor.id } },
    select: { id: true },
  });
  if (!found) throw new CourseBasisError('document-not-found');
}

async function findVersionForActor(db: CourseBasisDb, actor: CourseBasisActor, versionId: string) {
  const version = await db.courseBasisDocumentVersion.findFirst({
    where: actor.role === 'ADMIN' ? { id: versionId } : { id: versionId, document: { courseBasis: { ownerId: actor.id } } },
    include: {
      document: { include: { courseBasis: { select: { id: true, ownerId: true } } } },
      segments: { orderBy: { orderIndex: 'asc' } },
    },
  });
  if (!version) throw new CourseBasisError('version-not-found');
  return version;
}

export function courseBasisProjectionKey(courseBasisId: string, versionId: string, stableAnchor: string) {
  return stableProjectionIdentity('course-basis-projection', courseBasisId, versionId, stableAnchor);
}

export function courseBasisCorpusSourceId(courseBasisId: string, versionId: string, stableAnchor: string) {
  return stableProjectionIdentity('teacher-course-basis', courseBasisId, versionId, stableAnchor);
}

function stableProjectionIdentity(prefix: string, courseBasisId: string, versionId: string, stableAnchor: string) {
  return [prefix, courseBasisId, versionId, stableAnchor].map((part) => encodeURIComponent(part)).join(':');
}

async function withSerializableRetry<T>(
  db: CourseBasisDb,
  operation: (tx: Prisma.TransactionClient) => Promise<T>,
  attempts = 3,
) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await db.$transaction(operation, { isolationLevel: 'Serializable' });
    } catch (error) {
      if (!hasPrismaCode(error, 'P2034')) throw error;
      if (attempt === attempts - 1) throw new CourseBasisError('transaction-conflict-retryable');
    }
  }
  throw new CourseBasisError('transaction-conflict-retryable');
}

function validateActor(actor: CourseBasisActor) {
  const result = courseBasisActorSchema.safeParse(actor);
  if (!result.success) throw new CourseBasisError('invalid-actor');
  return result.data;
}

function validateId(value: string, code: string) {
  const result = courseBasisIdSchema.safeParse(value);
  if (!result.success) throw new CourseBasisError(code);
  return result.data;
}

function positiveInteger(value: number, code: string) {
  const result = z.number().int().positive().safeParse(value);
  if (!result.success) throw new CourseBasisError(code);
  return result.data;
}

function boundedPageSize(value: number) {
  const result = z.number().int().positive().max(COURSE_BASIS_PREVIEW_MAX_PAGE_SIZE).safeParse(value);
  if (!result.success) throw new CourseBasisError('preview-page-size-invalid', [String(COURSE_BASIS_PREVIEW_MAX_PAGE_SIZE)]);
  return result.data;
}

function requiredText(value: string, code: string, maxLength: number) {
  const result = z.string().trim().min(1).max(maxLength).safeParse(value);
  if (!result.success) throw new CourseBasisError(code);
  return result.data;
}

function optionalText(value: string | null | undefined, code: string, maxLength: number) {
  const result = z.string().trim().max(maxLength).nullish().safeParse(value);
  if (!result.success) throw new CourseBasisError(code);
  return result.data || null;
}

function hasPrismaCode(error: unknown, code: string) {
  return error instanceof Prisma.PrismaClientKnownRequestError
    ? error.code === code
    : Boolean(error && typeof error === 'object' && 'code' in error && (error as { code?: string }).code === code);
}

function isVersionRace(error: unknown) {
  return hasPrismaCode(error, 'P2002') || hasPrismaCode(error, 'P2034');
}

async function selectVersionMutationResult(db: CourseBasisDb, versionId: string) {
  const { _count, ...version } = await db.courseBasisDocumentVersion.findUniqueOrThrow({
    where: { id: versionId },
    select: {
      id: true,
      documentId: true,
      versionNumber: true,
      sourceType: true,
      sourceName: true,
      mimeType: true,
      byteSize: true,
      contentHash: true,
      extractionState: true,
      extractionVersion: true,
      failureReason: true,
      reviewState: true,
      reviewedById: true,
      reviewedAt: true,
      retiredById: true,
      retiredAt: true,
      createdAt: true,
      _count: { select: { segments: true, projections: true } },
    },
  });
  return { ...version, segmentCount: _count?.segments ?? 0, projectionCount: _count?.projections ?? 0 };
}
