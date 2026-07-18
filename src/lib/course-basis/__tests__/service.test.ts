import { describe, expect, it, vi } from 'vitest';

import {
  COURSE_BASIS_PREVIEW_MAX_PAGE_SIZE,
  confirmCourseBasisVersion,
  createCourseBasis,
  createCourseBasisDocument,
  deleteCourseBasisVersion,
  getCourseBasis,
  getCourseBasisVersionExtractionPreview,
  importCourseBasisVersion,
  listCourseBases,
  rejectCourseBasisVersion,
  retireCourseBasisVersion,
  retryCourseBasisExtraction,
} from '../service';

const teacher = { id: 'teacher-1', role: 'TEACHER' as const };
const otherTeacher = { id: 'teacher-2', role: 'TEACHER' as const };
const admin = { id: 'admin-1', role: 'ADMIN' as const };

describe('course-basis service', () => {
  it('normalizes invalid runtime inputs into stable service errors before persistence', async () => {
    const db: any = {
      courseBasis: { create: vi.fn(), findFirst: vi.fn() },
    };

    await expect(createCourseBasis(db, {
      actor: teacher,
      courseIdentity: 'control',
      title: 'Control',
      description: 42 as unknown as string,
    })).rejects.toMatchObject({ code: 'description-invalid' });
    await expect(createCourseBasisDocument(db, {
      actor: teacher,
      courseBasisId: 'basis-1',
      title: 'Standard',
      kind: 'INVALID' as 'STANDARD',
    })).rejects.toMatchObject({ code: 'document-kind-invalid' });
    expect(db.courseBasis.create).not.toHaveBeenCalled();
    expect(db.courseBasis.findFirst).not.toHaveBeenCalled();
  });

  it('creates unique continuous versions under concurrent imports using Serializable transactions', async () => {
    const rows: Array<Record<string, unknown>> = [];
    let lock = Promise.resolve<unknown>(undefined);
    const transactionOptions: unknown[] = [];
    const db: any = {
      courseBasisDocument: {
        findFirst: vi.fn(async ({ where }: any) => where.id === 'document-1' ? { id: 'document-1' } : null),
      },
      courseBasisDocumentVersion: {
        findFirst: vi.fn(async () => rows.length ? { versionNumber: rows.length } : null),
        create: vi.fn(async ({ data }: any) => {
          if (rows.some((row) => row.versionNumber === data.versionNumber)) throw Object.assign(new Error('unique'), { code: 'P2002' });
          const row = { id: `version-${data.versionNumber}`, ...data, segments: data.segments.create };
          rows.push(row);
          return row;
        }),
      },
    };
    db.$transaction = vi.fn((callback: (tx: any) => unknown, options: unknown) => {
      transactionOptions.push(options);
      const result = lock.then(() => callback(db));
      lock = result.then(() => undefined, () => undefined);
      return result;
    });

    const source = (value: string) => ({
      sourceType: 'PASTED_TEXT' as const,
      sourceName: 'Pasted standard',
      mimeType: 'text/plain',
      content: value,
    });
    const created = await Promise.all([
      importCourseBasisVersion(db, { actor: teacher, documentId: 'document-1', source: source('First version') }),
      importCourseBasisVersion(db, { actor: teacher, documentId: 'document-1', source: source('Second version') }),
    ]);

    expect(created.map((row) => row.versionNumber).sort()).toEqual([1, 2]);
    expect(transactionOptions).toEqual([
      { isolationLevel: 'Serializable' },
      { isolationLevel: 'Serializable' },
    ]);
  });

  it('retries a bounded P2002 race and advances from the competing version', async () => {
    let transactionCount = 0;
    let createCount = 0;
    const db: any = {
      courseBasisDocument: { findFirst: vi.fn(async () => ({ id: 'document-1' })) },
      courseBasisDocumentVersion: {
        findFirst: vi.fn(async () => transactionCount === 1 ? null : { versionNumber: 1 }),
        create: vi.fn(async ({ data }: any) => {
          createCount += 1;
          if (createCount === 1) throw Object.assign(new Error('unique race'), { code: 'P2002' });
          return { id: 'version-2', ...data, segments: data.segments.create };
        }),
      },
    };
    db.$transaction = vi.fn(async (callback: (tx: any) => unknown, options: unknown) => {
      expect(options).toEqual({ isolationLevel: 'Serializable' });
      transactionCount += 1;
      return callback(db);
    });

    const created = await importCourseBasisVersion(db, {
      actor: teacher,
      documentId: 'document-1',
      source: {
        sourceType: 'PASTED_TEXT',
        sourceName: 'Replacement',
        mimeType: 'text/plain',
        content: 'Replacement text',
      },
    });

    expect(created.versionNumber).toBe(2);
    expect(transactionCount).toBe(2);
  });

  it('uses indistinguishable not-found behavior for another teacher while allowing an administrator', async () => {
    const db: any = {
      courseBasis: {
        findFirst: vi.fn(async ({ where }: any) => {
          if (where.id !== 'basis-1') return null;
          if (where.ownerId && where.ownerId !== teacher.id) return null;
          return { id: 'basis-1', ownerId: teacher.id, documents: [] };
        }),
      },
    };

    await expect(getCourseBasis(db, otherTeacher, 'basis-1')).rejects.toMatchObject({ code: 'course-basis-not-found' });
    await expect(getCourseBasis(db, admin, 'basis-1')).resolves.toMatchObject({ ownerId: teacher.id });
  });

  it('lists metadata and bounded segment previews without returning stored source text', async () => {
    const fullText = 'x'.repeat(500);
    const db: any = {
      courseBasis: {
        findMany: vi.fn(async () => [{
          id: 'basis-1',
          ownerId: teacher.id,
          courseIdentity: 'automatic-control',
          title: 'Automatic Control',
          description: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          documents: [{
            id: 'document-1',
            courseBasisId: 'basis-1',
            title: 'Standard',
            kind: 'STANDARD',
            createdAt: new Date(),
            updatedAt: new Date(),
            versions: [{
              id: 'version-1',
              documentId: 'document-1',
              versionNumber: 1,
              sourceType: 'PLAIN_TEXT',
              sourceName: 'standard.txt',
              mimeType: 'text/plain',
              byteSize: 500,
              contentHash: 'hash',
              extractionState: 'EXTRACTED',
              extractionVersion: 'v1',
              failureReason: null,
              reviewState: 'PENDING',
              reviewedAt: null,
              retiredAt: null,
              createdAt: new Date(),
              _count: { segments: 8 },
              segments: [{
                stableAnchor: 'root/paragraph:1',
                headingPath: [],
                pageNumber: null,
                paragraphNumber: 1,
                contentHash: 'segment-hash',
                text: fullText,
              }],
            }],
          }],
        }]),
      },
    };

    const result = await listCourseBases(db, teacher);
    const query = db.courseBasis.findMany.mock.calls[0][0];
    const versionSelect = query.select.documents.select.versions.select;
    expect(versionSelect.originalContent).toBeUndefined();
    expect(versionSelect.normalizedText).toBeUndefined();
    expect(result[0].documents[0].versions[0]).toMatchObject({ segmentCount: 8 });
    expect(result[0].documents[0].versions[0].segments[0]).toMatchObject({
      text: 'x'.repeat(320),
      previewTruncated: true,
    });
    expect(result[0].documents[0].versions[0].previewTruncated).toBe(true);
    expect(JSON.stringify(result)).not.toContain(fullText);
  });

  it('returns an authorized paginated extraction preview with full segment text but no original source', async () => {
    const fullText = 'Full extracted paragraph '.repeat(40);
    const db: any = {
      courseBasisDocumentVersion: {
        findFirst: vi.fn(async ({ where }: any) => where.document?.courseBasis?.ownerId === teacher.id
          ? {
            id: 'version-1',
            documentId: 'document-1',
            versionNumber: 1,
            sourceName: 'standard.md',
            sourceType: 'MARKDOWN',
            contentHash: 'version-hash',
            extractionState: 'EXTRACTED',
            extractionVersion: 'v1',
            failureReason: null,
            reviewState: 'PENDING',
            retiredAt: null,
          }
          : null),
      },
      courseBasisSegment: {
        count: vi.fn(async () => 5),
        findMany: vi.fn(async () => [{
          orderIndex: 2,
          stableAnchor: 'h1:topic/paragraph:3',
          headingPath: ['Topic'],
          pageNumber: null,
          paragraphNumber: 3,
          contentHash: 'segment-hash',
          text: fullText,
        }]),
      },
    };

    const result = await getCourseBasisVersionExtractionPreview(db, {
      actor: teacher,
      versionId: 'version-1',
      page: 2,
      pageSize: 2,
    });

    const versionQuery = db.courseBasisDocumentVersion.findFirst.mock.calls[0][0];
    const segmentQuery = db.courseBasisSegment.findMany.mock.calls[0][0];
    expect(versionQuery.where).toEqual({ id: 'version-1', document: { courseBasis: { ownerId: teacher.id } } });
    expect(versionQuery.select.originalContent).toBeUndefined();
    expect(versionQuery.select.normalizedText).toBeUndefined();
    expect(segmentQuery).toMatchObject({ skip: 2, take: 2, orderBy: { orderIndex: 'asc' } });
    expect(result).toMatchObject({ page: 2, pageSize: 2, total: 5, pageCount: 3 });
    expect(result.segments[0].text).toBe(fullText);
    expect(JSON.stringify(result)).not.toContain('originalContent');
  });

  it('allows admin preview access, denies another teacher, and enforces the page-size ceiling', async () => {
    const db: any = {
      courseBasisDocumentVersion: {
        findFirst: vi.fn(async ({ where }: any) => where.document ? null : {
          id: 'version-1',
          documentId: 'document-1',
          versionNumber: 1,
          sourceName: 'standard.md',
          sourceType: 'MARKDOWN',
          contentHash: 'hash',
          extractionState: 'EXTRACTED',
          extractionVersion: 'v1',
          failureReason: null,
          reviewState: 'CONFIRMED',
          retiredAt: null,
        }),
      },
      courseBasisSegment: {
        count: vi.fn(async () => 0),
        findMany: vi.fn(async () => []),
      },
    };

    await expect(getCourseBasisVersionExtractionPreview(db, {
      actor: otherTeacher,
      versionId: 'version-1',
    })).rejects.toMatchObject({ code: 'version-not-found' });
    await expect(getCourseBasisVersionExtractionPreview(db, {
      actor: admin,
      versionId: 'version-1',
    })).resolves.toMatchObject({ total: 0, pageCount: 0, segments: [] });
    await expect(getCourseBasisVersionExtractionPreview(db, {
      actor: admin,
      versionId: 'version-1',
      pageSize: COURSE_BASIS_PREVIEW_MAX_PAGE_SIZE + 1,
    })).rejects.toMatchObject({
      code: 'preview-page-size-invalid',
      details: [String(COURSE_BASIS_PREVIEW_MAX_PAGE_SIZE)],
    });
    expect(db.courseBasisSegment.findMany).toHaveBeenCalledTimes(1);
  });

  it('does not allow confirmed versions to be rejected or re-extracted', async () => {
    const confirmed = {
      id: 'version-1',
      reviewState: 'CONFIRMED',
      extractionState: 'EXTRACTED',
      normalizedText: 'Confirmed text',
      retiredAt: null,
      sourceType: 'PLAIN_TEXT',
      sourceName: 'confirmed.txt',
      mimeType: 'text/plain',
      originalContent: new TextEncoder().encode('Confirmed text'),
      segments: [],
    };
    const db: any = {
      courseBasisDocumentVersion: { findFirst: vi.fn(async () => confirmed) },
      $transaction: vi.fn(async (callback: (tx: any) => unknown) => callback(db)),
    };

    await expect(rejectCourseBasisVersion(db, { actor: teacher, versionId: confirmed.id }))
      .rejects.toMatchObject({ code: 'confirmed-version-immutable' });
    await expect(retryCourseBasisExtraction(db, { actor: teacher, versionId: confirmed.id }))
      .rejects.toMatchObject({ code: 'confirmed-version-immutable' });
  });

  it('records confirmation and retirement without changing extracted content', async () => {
    const original = {
      id: 'version-1',
      reviewState: 'PENDING',
      extractionState: 'EXTRACTED',
      normalizedText: 'Stable extracted text',
      contentHash: 'content-hash',
      retiredAt: null,
      document: { courseBasis: { id: 'basis-1', ownerId: teacher.id } },
      segments: [{ id: 'segment-1', stableAnchor: 'root/paragraph:1', text: 'Stable extracted text' }],
    };
    let stored: any = original;
    let projections: any[] = [];
    const db: any = {
      courseBasisDocumentVersion: {
        findFirst: vi.fn(async () => stored),
        update: vi.fn(async ({ data }: any) => {
          stored = { ...stored, ...data };
          return stored;
        }),
        findUniqueOrThrow: vi.fn(async () => ({ ...stored, projections })),
      },
      courseBasisProjection: {
        createMany: vi.fn(async ({ data }: any) => {
          projections = data;
          return { count: data.length };
        }),
        count: vi.fn(async () => projections.length),
      },
    };
    db.$transaction = vi.fn(async (callback: (tx: any) => unknown) => callback(db));

    await confirmCourseBasisVersion(db, { actor: teacher, versionId: original.id, now: new Date('2026-07-19T00:00:00Z') });
    await retireCourseBasisVersion(db, { actor: teacher, versionId: original.id, now: new Date('2026-07-20T00:00:00Z') });

    expect(stored).toMatchObject({
      reviewState: 'CONFIRMED',
      reviewedById: teacher.id,
      retiredById: teacher.id,
      normalizedText: original.normalizedText,
      contentHash: original.contentHash,
      segments: original.segments,
    });
    expect(projections).toEqual([expect.objectContaining({
      versionId: original.id,
      segmentId: 'segment-1',
      projectionKey: 'course-basis-projection:basis-1:version-1:root%2Fparagraph%3A1',
      corpusSourceId: 'teacher-course-basis:basis-1:version-1:root%2Fparagraph%3A1',
    })]);
  });

  it('retries an unsupported extraction by creating a new sequential version without mutating the old version', async () => {
    const oldVersion = {
      id: 'version-1',
      documentId: 'document-1',
      reviewState: 'PENDING',
      extractionState: 'UNSUPPORTED',
      retiredAt: null,
      sourceType: 'PLAIN_TEXT',
      sourceName: 'standard.txt',
      mimeType: 'text/plain',
      originalContent: new TextEncoder().encode('Recovered text'),
      document: { courseBasis: { id: 'basis-1', ownerId: teacher.id } },
      segments: [],
    };
    const create = vi.fn(async ({ data }: any) => ({ id: 'version-2', ...data, segments: data.segments.create }));
    const db: any = {
      courseBasisDocument: { findFirst: vi.fn(async () => ({ id: 'document-1' })) },
      courseBasisDocumentVersion: {
        findFirst: vi.fn(async ({ select }: any) => select ? { versionNumber: 1 } : oldVersion),
        create,
        update: vi.fn(),
      },
      courseBasisSegment: { deleteMany: vi.fn() },
    };
    db.$transaction = vi.fn(async (callback: (tx: any) => unknown) => callback(db));

    const retried = await retryCourseBasisExtraction(db, { actor: teacher, versionId: oldVersion.id });

    expect(retried.versionNumber).toBe(2);
    expect(create).toHaveBeenCalledOnce();
    expect(db.courseBasisDocumentVersion.update).not.toHaveBeenCalled();
    expect(db.courseBasisSegment.deleteMany).not.toHaveBeenCalled();
  });

  it('retries P2034 three times and returns an explicit transaction conflict', async () => {
    const db: any = {
      $transaction: vi.fn().mockRejectedValue(Object.assign(new Error('serialization'), { code: 'P2034' })),
    };

    await expect(retireCourseBasisVersion(db, { actor: teacher, versionId: 'version-1' }))
      .rejects.toMatchObject({ code: 'transaction-conflict-retryable' });
    expect(db.$transaction).toHaveBeenCalledTimes(3);
  });

  it('protects referenced versions from deletion and reports blockers only after authorization', async () => {
    const version = { id: 'version-1', retiredAt: null, segments: [] };
    const db: any = {
      courseBasisDocumentVersion: { findFirst: vi.fn(async () => version) },
      courseBasisReferenceLink: {
        findMany: vi.fn(async () => [{ referenceType: 'LESSON_PLAN_REVISION', referenceId: 'lesson-revision-7' }]),
      },
      courseBasisProjection: { count: vi.fn(async () => 0) },
      courseBasisSegment: { deleteMany: vi.fn() },
      $transaction: vi.fn(async (callback: (tx: any) => unknown) => callback(db)),
    };

    await expect(deleteCourseBasisVersion(db, { actor: teacher, versionId: version.id }))
      .rejects.toMatchObject({
        code: 'version-delete-referenced',
        details: ['LESSON_PLAN_REVISION:lesson-revision-7'],
      });
    expect(db.courseBasisSegment.deleteMany).not.toHaveBeenCalled();
  });
});
