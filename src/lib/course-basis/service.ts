import { Prisma, type PrismaClient } from '@prisma/client';
import { z } from 'zod';

import {
  CourseBasisError,
  projectCourseBasisLifecycle,
  type CourseBasisActor,
  type CourseBasisReferenceBlocker,
  type CourseBasisSource,
} from './domain';
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
const courseBasisReferenceTypeSchema = z.enum([
  'SMART_LESSON_KNOWLEDGE_POINT',
  'SMART_LESSON_GOAL',
  'GENERATION_JOB',
  'LESSON_PLAN_REVISION',
  'COURSEWARE_REVISION',
  'PUBLICATION_REVISION',
  'CLASSROOM_SESSION',
  'RESOURCE_PACK',
]);
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
  documentId?: string;
  documentOffset?: number;
  versionOffset?: number;
} = {}) {
  const validatedActor = validateActor(actor);
  const offset = nonNegativeInteger(options.offset ?? 0, 'offset-invalid');
  const limit = Math.min(COURSE_BASIS_LIST_LIMIT, positiveInteger(options.limit ?? COURSE_BASIS_LIST_LIMIT, 'limit-invalid'));
  const documentOffset = nonNegativeInteger(options.documentOffset ?? 0, 'document-offset-invalid');
  const versionOffset = nonNegativeInteger(options.versionOffset ?? 0, 'version-offset-invalid');
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
      _count: { select: { documents: true } },
      documents: {
        ...(options.documentId ? { where: { id: validateId(options.documentId, 'document-id-invalid') } } : {}),
        orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
        skip: documentOffset,
        take: COURSE_BASIS_DOCUMENT_LIST_LIMIT,
        select: {
          id: true,
          courseBasisId: true,
          title: true,
          kind: true,
          createdAt: true,
          updatedAt: true,
          _count: { select: { versions: true } },
          versions: {
            orderBy: { versionNumber: 'desc' },
            skip: versionOffset,
            take: COURSE_BASIS_VERSION_LIST_LIMIT,
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
  return rows.map(({ _count, ...courseBasis }) => ({
    ...courseBasis,
    documentPagination: {
      offset: documentOffset,
      limit: COURSE_BASIS_DOCUMENT_LIST_LIMIT,
      total: _count.documents,
      hasMore: documentOffset + courseBasis.documents.length < _count.documents,
    },
    documents: courseBasis.documents.map(({ _count: documentCount, ...document }) => ({
      ...document,
      versionPagination: {
        offset: versionOffset,
        limit: COURSE_BASIS_VERSION_LIST_LIMIT,
        total: documentCount.versions,
        hasMore: versionOffset + document.versions.length < documentCount.versions,
      },
      versions: document.versions.map(({ _count, segments, ...version }) => {
        const previewTruncated = _count.segments > segments.length
          || segments.some((segment) => segment.text.length > COURSE_BASIS_LIST_PREVIEW_CHARS);
        return {
          ...version,
          lifecycle: projectCourseBasisLifecycle(version),
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
    version: { ...version, lifecycle: projectCourseBasisLifecycle(version) },
    page,
    pageSize,
    total,
    pageCount: total === 0 ? 0 : Math.ceil(total / pageSize),
    segments,
  };
}

export async function getCourseBasisVersionForEditing(db: CourseBasisDb, input: {
  actor: CourseBasisActor;
  versionId: string;
}) {
  const actor = validateActor(input.actor);
  const version = await findVersionForActor(db, actor, validateId(input.versionId, 'version-id-invalid'));
  if (version.extractionState !== 'EXTRACTED' || !version.normalizedText) {
    throw new CourseBasisError('version-not-editable');
  }
  const lifecycle = projectCourseBasisLifecycle(version);
  return {
    id: version.id,
    documentId: version.documentId,
    documentTitle: version.document.title,
    courseBasisId: version.document.courseBasis.id,
    versionNumber: version.versionNumber,
    sourceName: version.sourceName,
    contentHash: version.contentHash,
    markdown: editableCourseBasisText(version),
    lifecycle,
    frozen: lifecycle.frozen || lifecycle.state === 'DISABLED' || lifecycle.state === 'FAILED',
  };
}

export async function saveCourseBasisVersionEdit(db: CourseBasisDb, input: {
  actor: CourseBasisActor;
  versionId: string;
  expectedContentHash: string;
  markdown: string;
}) {
  const actor = validateActor(input.actor);
  const versionId = validateId(input.versionId, 'version-id-invalid');
  const markdown = requiredPreservedText(input.markdown, 'document-content-required', 2_000_000);
  const current = await findVersionForActor(db, actor, versionId);
  if (current.contentHash !== input.expectedContentHash) throw new CourseBasisError('version-edit-conflict');
  const extracted = await extractCourseBasisSource({
    sourceType: 'MARKDOWN',
    sourceName: '可视编辑器',
    mimeType: 'text/markdown',
    content: markdown,
  });
  const frozen = Boolean(current.retiredAt)
    || current.reviewState === 'REJECTED'
    || current.reviewState === 'CONFIRMED';
  if (frozen) {
    const latest = await db.courseBasisDocumentVersion.findFirst({
      where: { documentId: current.documentId },
      orderBy: { versionNumber: 'desc' },
      select: { id: true, versionNumber: true, contentHash: true, reviewState: true, retiredAt: true },
    });
    if (!latest) throw new CourseBasisError('version-edit-conflict');
    if (latest.versionNumber > current.versionNumber && latest.contentHash === extracted.contentHash) {
      if (!latest.retiredAt && latest.reviewState === 'PENDING') {
        return { version: await selectVersionMutationResult(db, latest.id), createdSuccessor: true };
      }
    }
    const successor = await importCourseBasisVersion(db, {
      actor,
      documentId: current.documentId,
      expectedLatestVersionId: latest.id,
      expectedLatestVersionNumber: latest.versionNumber,
      source: {
        sourceType: 'MARKDOWN',
        sourceName: `${current.sourceName}（编辑）`,
        mimeType: 'text/markdown',
        content: markdown,
      },
    });
    return { version: successor, createdSuccessor: true };
  }
  const version = await withSerializableRetry(db, async (tx) => {
    const updated = await tx.courseBasisDocumentVersion.updateMany({
      where: {
        id: versionId,
        contentHash: input.expectedContentHash,
        reviewState: 'PENDING',
        retiredAt: null,
      },
      data: {
        sourceType: 'MARKDOWN',
        mimeType: 'text/markdown',
        byteSize: extracted.byteSize,
        contentHash: extracted.contentHash,
        originalContent: extracted.originalContent,
        normalizedText: extracted.normalizedText,
        extractionState: extracted.extractionState,
        extractionVersion: COURSE_BASIS_EXTRACTION_VERSION,
        failureReason: null,
        reviewState: 'PENDING',
        reviewedById: null,
        reviewedAt: null,
      },
    });
    if (updated.count !== 1) throw new CourseBasisError('version-edit-conflict');
    await tx.courseBasisProjection.deleteMany({ where: { versionId } });
    await tx.courseBasisSegment.deleteMany({ where: { versionId } });
    await tx.courseBasisSegment.createMany({
      data: extracted.segments.map((segment) => ({ ...segment, versionId })),
    });
    await ensureCourseBasisProjection(tx, {
      courseBasisId: current.document.courseBasis.id,
      versionId,
      projectedAt: new Date(),
    });
    return selectVersionMutationResult(tx as unknown as CourseBasisDb, versionId);
  });
  return { version, createdSuccessor: false };
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
  expectedLatestVersionId?: string;
  expectedLatestVersionNumber?: number;
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
        const document = await assertDocumentAccess(tx as CourseBasisDb, actor, documentId);
        const latest = await tx.courseBasisDocumentVersion.findFirst({
          where: { documentId },
          orderBy: { versionNumber: 'desc' },
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
        if (input.expectedLatestVersionId && latest?.id !== input.expectedLatestVersionId) {
          if (
            latest?.versionNumber === Number(input.expectedLatestVersionNumber) + 1
            && latest.contentHash === extracted.contentHash
          ) {
            const { _count, ...existing } = latest;
            return { ...existing, segmentCount: _count.segments };
          }
          throw new CourseBasisError('version-edit-conflict');
        }
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
        let projectionCount = 0;
        if (version.extractionState === 'EXTRACTED' && extracted.segments.length > 0) {
          projectionCount = await ensureCourseBasisProjection(tx, {
            courseBasisId: document.courseBasisId,
            versionId: version.id,
            projectedAt: new Date(),
          });
        }
        return {
          ...version,
          lifecycle: projectCourseBasisLifecycle(version),
          segmentCount: _count?.segments ?? extracted.segments.length,
          projectionCount,
        };
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

export type AdoptCourseBasisVersionInput = {
  actor: CourseBasisActor;
  versionId: string;
  adopter: {
    referenceType: z.infer<typeof courseBasisReferenceTypeSchema>;
    referenceId: string;
  };
  anchors: Array<{ stableAnchor: string; contentHash: string }>;
  now?: Date;
};

export async function adoptCourseBasisVersion(
  db: CourseBasisDb | Prisma.TransactionClient,
  input: AdoptCourseBasisVersionInput,
) {
  const actor = validateActor(input.actor);
  const versionId = validateId(input.versionId, 'version-id-invalid');
  const referenceType = courseBasisReferenceTypeSchema.safeParse(input.adopter.referenceType);
  if (!referenceType.success) throw new CourseBasisError('reference-type-invalid');
  const referenceId = validateId(input.adopter.referenceId, 'reference-id-invalid');
  const anchors = [...new Map(input.anchors.map((anchor) => {
    const stableAnchor = requiredText(anchor.stableAnchor, 'anchor-invalid', 500);
    const contentHash = requiredText(anchor.contentHash, 'content-hash-required', 200);
    return [stableAnchor, { stableAnchor, contentHash }];
  })).values()].sort((left, right) => left.stableAnchor.localeCompare(right.stableAnchor));
  if (anchors.length === 0) throw new CourseBasisError('anchors-required');

  const adopt = async (tx: Prisma.TransactionClient) => {
    const version = await findVersionForActor(tx as CourseBasisDb, actor, versionId);
    if (version.retiredAt) throw new CourseBasisError('version-retired');
    if (version.reviewState === 'REJECTED') throw new CourseBasisError('rejected-version-immutable');
    if (version.extractionState !== 'EXTRACTED' || !version.normalizedText || version.segments.length === 0) {
      throw new CourseBasisError('extraction-not-adoptable');
    }
    const availableAnchors = new Map(
      version.segments.map((segment) => [segment.stableAnchor, segment.contentHash]),
    );
    if (anchors.some((anchor) => availableAnchors.get(anchor.stableAnchor) !== anchor.contentHash)) {
      throw new CourseBasisError('adoption-anchor-conflict');
    }

    const existing = await tx.courseBasisReferenceLink.findUnique({
      where: {
        versionId_referenceType_referenceId: {
          versionId,
          referenceType: referenceType.data,
          referenceId,
        },
      },
    });
    if (existing) {
      if (existing.contentHash !== version.contentHash) {
        throw new CourseBasisError('adoption-identity-conflict');
      }
      const referenceLink = sameAnchorIdentity(existing.anchors, anchors)
        ? existing
        : await tx.courseBasisReferenceLink.update({
          where: { id: existing.id },
          data: { anchors },
        });
      return {
        version: await selectVersionMutationResult(tx as CourseBasisDb, versionId),
        referenceLink,
        frozenNow: false,
      };
    }

    await ensureCourseBasisProjection(tx, {
      courseBasisId: version.document.courseBasis.id,
      versionId,
      projectedAt: input.now ?? new Date(),
      segments: version.segments,
    });

    let frozenNow = false;
    if (version.reviewState !== 'CONFIRMED') {
      const frozen = await tx.courseBasisDocumentVersion.updateMany({
        where: {
          id: versionId,
          contentHash: version.contentHash,
          reviewState: 'PENDING',
          retiredAt: null,
        },
        data: {
          reviewState: 'CONFIRMED',
          reviewedById: actor.id,
          reviewedAt: input.now ?? new Date(),
        },
      });
      if (frozen.count !== 1) throw new CourseBasisError('adoption-content-conflict');
      frozenNow = true;
    }

    const referenceLink = await tx.courseBasisReferenceLink.create({
      data: {
        versionId,
        referenceType: referenceType.data,
        referenceId,
        contentHash: version.contentHash,
        anchors,
      },
    });
    return {
      version: await selectVersionMutationResult(tx as CourseBasisDb, versionId),
      referenceLink,
      frozenNow,
    };
  };
  return '$transaction' in db
    ? withSerializableRetry(db as CourseBasisDb, adopt)
    : adopt(db);
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
    const blockers = await collectCourseBasisReferenceBlockers(tx, [version.id]);
    if (blockers.length > 0) throw new CourseBasisError('version-delete-referenced', blockers);
    await tx.courseBasisProjection.deleteMany({ where: { versionId: version.id } });
    await tx.courseBasisSegment.deleteMany({ where: { versionId: version.id } });
    return tx.courseBasisDocumentVersion.delete({ where: { id: version.id } });
  });
}

export async function deleteCourseBasisDocument(db: CourseBasisDb, input: {
  actor: CourseBasisActor;
  documentId: string;
}) {
  const actor = validateActor(input.actor);
  const documentId = validateId(input.documentId, 'document-id-invalid');
  return withSerializableRetry(db, async (tx) => {
    await assertDocumentAccess(tx as CourseBasisDb, actor, documentId);
    const versions = await tx.courseBasisDocumentVersion.findMany({
      where: { documentId },
      select: { id: true },
    });
    const versionIds = versions.map((version) => version.id);
    const blockers = await collectCourseBasisReferenceBlockers(tx, versionIds);
    if (blockers.length > 0) throw new CourseBasisError('document-delete-referenced', blockers);
    await deleteCourseBasisVersionRecords(tx, versionIds);
    return tx.courseBasisDocument.delete({ where: { id: documentId } });
  });
}

export async function deleteCourseBasis(db: CourseBasisDb, input: {
  actor: CourseBasisActor;
  courseBasisId: string;
}) {
  const actor = validateActor(input.actor);
  const courseBasisId = validateId(input.courseBasisId, 'course-basis-id-invalid');
  return withSerializableRetry(db, async (tx) => {
    await assertCourseBasisAccess(tx as CourseBasisDb, actor, courseBasisId);
    const [documents, tasks] = await Promise.all([
      tx.courseBasisDocument.findMany({
        where: { courseBasisId },
        select: { id: true, versions: { select: { id: true } } },
      }),
      tx.smartLessonTask.findMany({
        where: { courseBasisId },
        select: { id: true },
      }),
    ]);
    const versionIds = documents.flatMap((document) => document.versions.map((version) => version.id));
    const blockers = [
      ...(await collectCourseBasisReferenceBlockers(tx, versionIds)),
      ...tasks.map((task) => ({ category: 'SMART_LESSON_TASK', referenceId: task.id })),
    ];
    const uniqueBlockers = await enrichReferenceBlockers(tx, uniqueReferenceBlockers(blockers));
    if (uniqueBlockers.length > 0) throw new CourseBasisError('course-basis-delete-referenced', uniqueBlockers);
    await deleteCourseBasisVersionRecords(tx, versionIds);
    await tx.courseBasisDocument.deleteMany({ where: { courseBasisId } });
    return tx.courseBasis.delete({ where: { id: courseBasisId } });
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
    select: { id: true, courseBasisId: true },
  });
  if (!found) throw new CourseBasisError('document-not-found');
  return found;
}

async function collectCourseBasisReferenceBlockers(
  tx: Prisma.TransactionClient,
  versionIds: string[],
): Promise<CourseBasisReferenceBlocker[]> {
  if (versionIds.length === 0) return [];
  const [selections, links] = await Promise.all([
    tx.smartLessonSourceSelection.findMany({
      where: { sourceVersionId: { in: versionIds } },
      select: { taskId: true },
    }),
    tx.courseBasisReferenceLink.findMany({
      where: { versionId: { in: versionIds } },
      select: { referenceType: true, referenceId: true },
      orderBy: [{ referenceType: 'asc' }, { referenceId: 'asc' }],
    }),
  ]);
  const blockers: ReferenceBlockerIdentity[] = [
    ...selections.map((selection) => ({ category: 'SMART_LESSON_TASK', referenceId: selection.taskId })),
    ...links.map((link) => ({ category: link.referenceType, referenceId: link.referenceId })),
  ];

  const planRevisionIds = links
    .filter((link) => link.referenceType === 'LESSON_PLAN_REVISION')
    .map((link) => link.referenceId);
  const directCoursewareIds = links
    .filter((link) => link.referenceType === 'COURSEWARE_REVISION')
    .map((link) => link.referenceId);
  const directPublicationIds = links
    .filter((link) => link.referenceType === 'PUBLICATION_REVISION')
    .map((link) => link.referenceId);

  const courseware = planRevisionIds.length === 0
    ? []
    : await tx.smartCoursewareRevision.findMany({
      where: { planRevisionId: { in: planRevisionIds } },
      select: { id: true },
    });
  const coursewareIds = [...new Set([...directCoursewareIds, ...courseware.map((revision) => revision.id)])];
  blockers.push(...courseware.map((revision) => ({ category: 'COURSEWARE_REVISION', referenceId: revision.id })));

  const publications = planRevisionIds.length === 0 && coursewareIds.length === 0
    ? []
    : await tx.smartCoursewarePublicationRevision.findMany({
      where: {
        OR: [
          ...(planRevisionIds.length > 0 ? [{ planRevisionId: { in: planRevisionIds } }] : []),
          ...(coursewareIds.length > 0 ? [{ sourceRevisionId: { in: coursewareIds } }] : []),
        ],
      },
      select: { id: true },
    });
  const publicationIds = [...new Set([...directPublicationIds, ...publications.map((revision) => revision.id)])];
  blockers.push(...publications.map((revision) => ({ category: 'PUBLICATION_REVISION', referenceId: revision.id })));

  if (publicationIds.length > 0) {
    const sessions = await tx.classSession.findMany({
      where: { coursewarePublicationRevisionId: { in: publicationIds } },
      select: { id: true },
    });
    blockers.push(...sessions.map((session) => ({ category: 'CLASSROOM_SESSION', referenceId: session.id })));
  }
  return enrichReferenceBlockers(tx, uniqueReferenceBlockers(blockers));
}

async function deleteCourseBasisVersionRecords(tx: Prisma.TransactionClient, versionIds: string[]) {
  if (versionIds.length === 0) return;
  await tx.courseBasisProjection.deleteMany({ where: { versionId: { in: versionIds } } });
  await tx.courseBasisSegment.deleteMany({ where: { versionId: { in: versionIds } } });
  await tx.courseBasisDocumentVersion.deleteMany({ where: { id: { in: versionIds } } });
}

type ReferenceBlockerIdentity = Pick<CourseBasisReferenceBlocker, 'category' | 'referenceId'>;

async function enrichReferenceBlockers(
  tx: Prisma.TransactionClient,
  blockers: ReferenceBlockerIdentity[],
): Promise<CourseBasisReferenceBlocker[]> {
  const ids = (category: string) => blockers
    .filter((blocker) => blocker.category === category)
    .map((blocker) => blocker.referenceId);
  const taskIds = ids('SMART_LESSON_TASK');
  const knowledgePointIds = ids('SMART_LESSON_KNOWLEDGE_POINT');
  const goalIds = ids('SMART_LESSON_GOAL');
  const generationJobIds = ids('GENERATION_JOB');
  const planRevisionIds = ids('LESSON_PLAN_REVISION');
  const coursewareRevisionIds = ids('COURSEWARE_REVISION');
  const publicationRevisionIds = ids('PUBLICATION_REVISION');
  const classroomSessionIds = ids('CLASSROOM_SESSION');
  const [tasks, knowledgePoints, goals, generationJobs, plans, courseware, publications, sessions] = await Promise.all([
    taskIds.length > 0
      ? tx.smartLessonTask.findMany({
        where: { id: { in: taskIds } },
        select: { id: true, topic: true },
      })
      : [],
    knowledgePointIds.length > 0
      ? tx.smartLessonKnowledgePoint.findMany({
        where: { id: { in: knowledgePointIds } },
        select: { id: true, title: true, taskId: true },
      })
      : [],
    goalIds.length > 0
      ? tx.smartLessonGoal.findMany({
        where: { id: { in: goalIds } },
        select: { id: true, content: true, taskId: true },
      })
      : [],
    generationJobIds.length > 0
      ? tx.smartLessonGenerationJob.findMany({
        where: { id: { in: generationJobIds } },
        select: { id: true, deliveryGeneration: true, draft: { select: { taskId: true, task: { select: { topic: true } } } } },
      })
      : [],
    planRevisionIds.length > 0
      ? tx.smartLessonRevision.findMany({
        where: { id: { in: planRevisionIds } },
        select: { id: true, displayName: true, taskId: true },
      })
      : [],
    coursewareRevisionIds.length > 0
      ? tx.smartCoursewareRevision.findMany({
        where: { id: { in: coursewareRevisionIds } },
        select: { id: true, revisionNumber: true, draftId: true },
      })
      : [],
    publicationRevisionIds.length > 0
      ? tx.smartCoursewarePublicationRevision.findMany({
        where: { id: { in: publicationRevisionIds } },
        select: { id: true, displayName: true, sourceRevision: { select: { draftId: true } } },
      })
      : [],
    classroomSessionIds.length > 0
      ? tx.classSession.findMany({
        where: { id: { in: classroomSessionIds } },
        select: { id: true, coursewareDisplayName: true, lessonVersion: true },
      })
      : [],
  ]);
  const names = new Map<string, { name: string; navigationTarget: string }>();
  for (const task of tasks) {
    names.set(`SMART_LESSON_TASK:${task.id}`, {
      name: task.topic,
      navigationTarget: `/teacher/smart-prep?taskId=${encodeURIComponent(task.id)}`,
    });
  }
  for (const point of knowledgePoints) {
    names.set(`SMART_LESSON_KNOWLEDGE_POINT:${point.id}`, {
      name: point.title,
      navigationTarget: `/teacher/smart-prep?taskId=${encodeURIComponent(point.taskId)}`,
    });
  }
  for (const goal of goals) {
    names.set(`SMART_LESSON_GOAL:${goal.id}`, {
      name: goal.content,
      navigationTarget: `/teacher/smart-prep?taskId=${encodeURIComponent(goal.taskId)}`,
    });
  }
  for (const job of generationJobs) {
    names.set(`GENERATION_JOB:${job.id}`, {
      name: `${job.draft.task.topic}生成记录（第 ${job.deliveryGeneration} 次）`,
      navigationTarget: `/teacher/smart-prep?taskId=${encodeURIComponent(job.draft.taskId)}`,
    });
  }
  for (const plan of plans) {
    names.set(`LESSON_PLAN_REVISION:${plan.id}`, {
      name: plan.displayName,
      navigationTarget: `/teacher/smart-prep?taskId=${encodeURIComponent(plan.taskId)}`,
    });
  }
  for (const revision of courseware) {
    names.set(`COURSEWARE_REVISION:${revision.id}`, {
      name: `课件第 ${revision.revisionNumber} 版`,
      navigationTarget: `/teacher/smart-prep/courseware/${encodeURIComponent(revision.draftId)}`,
    });
  }
  for (const publication of publications) {
    names.set(`PUBLICATION_REVISION:${publication.id}`, {
      name: publication.displayName,
      navigationTarget: `/teacher/smart-prep/courseware/${encodeURIComponent(publication.sourceRevision.draftId)}`,
    });
  }
  for (const session of sessions) {
    names.set(`CLASSROOM_SESSION:${session.id}`, {
      name: session.coursewareDisplayName ?? session.lessonVersion ?? '课堂记录',
      navigationTarget: '/teacher/classes',
    });
  }
  return blockers.map((blocker) => ({
    ...blocker,
    ...(names.get(`${blocker.category}:${blocker.referenceId}`) ?? {
      name: blocker.category === 'RESOURCE_PACK' ? '备课依据包' : '历史教学内容',
      navigationTarget: blocker.category === 'CLASSROOM_SESSION' ? '/teacher/classes' : '/teacher/smart-prep',
    }),
  }));
}

function uniqueReferenceBlockers<T extends ReferenceBlockerIdentity>(blockers: T[]) {
  return [...new Map(
    blockers.map((blocker) => [`${blocker.category}:${blocker.referenceId}`, blocker]),
  ).values()].sort((left, right) => (
    left.category.localeCompare(right.category) || left.referenceId.localeCompare(right.referenceId)
  ));
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

function editableCourseBasisText(version: {
  sourceType: string;
  originalContent: Uint8Array;
  normalizedText: string | null;
}) {
  if (version.sourceType === 'SEARCHABLE_PDF') return version.normalizedText ?? '';
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(version.originalContent);
  } catch {
    return version.normalizedText ?? '';
  }
}

async function ensureCourseBasisProjection(
  tx: Prisma.TransactionClient,
  input: {
    courseBasisId: string;
    versionId: string;
    projectedAt: Date;
    segments?: Array<{ id: string; stableAnchor: string }>;
  },
) {
  const segments = input.segments ?? await tx.courseBasisSegment.findMany({
    where: { versionId: input.versionId },
    orderBy: { orderIndex: 'asc' },
    select: { id: true, stableAnchor: true },
  });
  if (segments.length === 0) return 0;
  await tx.courseBasisProjection.createMany({
    data: segments.map((segment) => ({
      versionId: input.versionId,
      segmentId: segment.id,
      projectionKey: courseBasisProjectionKey(input.courseBasisId, input.versionId, segment.stableAnchor),
      corpusSourceId: courseBasisCorpusSourceId(input.courseBasisId, input.versionId, segment.stableAnchor),
      projectedAt: input.projectedAt,
    })),
    skipDuplicates: true,
  });
  const projectionCount = await tx.courseBasisProjection.count({ where: { versionId: input.versionId } });
  if (projectionCount !== segments.length) throw new CourseBasisError('projection-conflict');
  return projectionCount;
}

function sameAnchorIdentity(
  value: Prisma.JsonValue,
  expected: Array<{ stableAnchor: string; contentHash: string }>,
) {
  if (!Array.isArray(value) || value.length !== expected.length) return false;
  const actual = value.flatMap((item) => {
    if (item === null || typeof item !== 'object' || Array.isArray(item)) return [];
    if (typeof item.stableAnchor !== 'string' || typeof item.contentHash !== 'string') return [];
    return [{ stableAnchor: item.stableAnchor, contentHash: item.contentHash }];
  }).sort((left, right) => left.stableAnchor.localeCompare(right.stableAnchor));
  return actual.length === expected.length
    && actual.every((item, index) => (
      item.stableAnchor === expected[index]?.stableAnchor
      && item.contentHash === expected[index]?.contentHash
    ));
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

function nonNegativeInteger(value: number, code: string) {
  const result = z.number().int().nonnegative().safeParse(value);
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

function requiredPreservedText(value: string, code: string, maxLength: number) {
  const result = z.string().max(maxLength).refine((candidate) => candidate.trim().length > 0).safeParse(value);
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
  return {
    ...version,
    lifecycle: projectCourseBasisLifecycle(version),
    segmentCount: _count?.segments ?? 0,
    projectionCount: _count?.projections ?? 0,
  };
}
