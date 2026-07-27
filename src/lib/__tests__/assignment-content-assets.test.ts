import { createHash } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';

import {
  assertAssignmentRevisionAssetReferences,
  assignmentContentAssetHref,
  completeAssignmentContentAssetUpload,
  extractAssignmentContentMarkers,
  readAssignmentContentAsset,
  replaceAssignmentRevisionAssetReferences,
} from '../assignments/assignment-content-assets';

const png = Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10, 0]);
const checksum = `sha256:${createHash('sha256').update(png).digest('hex')}`;

function store() {
  return {
    healthCheck: vi.fn(),
    signUpload: vi.fn(),
    head: vi.fn(async () => ({
      key: 'private-key',
      ownerId: 'teacher-1',
      answerId: 'assignment-content:assignment-1:asset-1',
      sizeBytes: png.byteLength,
      mimeType: 'image/png',
      checksum,
      scanState: 'PENDING' as const,
    })),
    readObject: vi.fn(async () => png),
    delete: vi.fn(),
  };
}

describe('assignment content assets', () => {
  it('requires the stable same-origin href and asset title marker', () => {
    const href = assignmentContentAssetHref('assignment-1', 'asset:1');
    expect(extractAssignmentContentMarkers(
      'assignment-1',
      'question:1',
      'PROMPT',
      `![图](${href} "asset:asset:1")`,
    )).toEqual([{
      assetId: 'asset:1',
      stableQuestionId: 'question:1',
      field: 'PROMPT',
    }]);
    expect(() => extractAssignmentContentMarkers(
      'assignment-1',
      'question:1',
      'PROMPT',
      '![图](https://evil.example/a.png "asset:asset:1")',
    )).toThrow('invalid-assignment-content-asset-marker');
    expect(() => extractAssignmentContentMarkers(
      'assignment-1',
      'question:1',
      'PROMPT',
      '![图][remote]\n\n[remote]: https://evil.example/a.png',
    )).toThrow('invalid-assignment-content-asset-marker');
    expect(extractAssignmentContentMarkers(
      'assignment-1',
      'question:1',
      'PROMPT',
      `![图][protected]\n\n[protected]: ${href} "asset:asset:1"`,
    )).toEqual([{
      assetId: 'asset:1',
      stableQuestionId: 'question:1',
      field: 'PROMPT',
    }]);
    expect(() => extractAssignmentContentMarkers(
      'assignment-1',
      'question:1',
      'PROMPT',
      `![图][duplicate]\n\n[duplicate]: https://evil.example/a.png\n[duplicate]: ${href} "asset:asset:1"`,
    )).toThrow('invalid-assignment-content-asset-marker');
  });

  it('verifies owner metadata, checksum, size and image magic before availability', async () => {
    const db = {
      assignmentContentAsset: {
        findUnique: vi.fn(async () => ({
          id: 'asset-1',
          assignmentId: 'assignment-1',
          uploaderId: 'teacher-1',
          objectKey: 'private-key',
          originalName: 'figure.png',
          mimeType: 'image/png',
          sizeBytes: png.byteLength,
          checksum,
          state: 'PENDING',
          assignment: { authorId: 'teacher-1' },
        })),
        update: vi.fn(async () => ({})),
      },
    };
    await expect(completeAssignmentContentAssetUpload(
      db as never,
      {
        actorId: 'teacher-1',
        actorRole: 'TEACHER',
        assignmentId: 'assignment-1',
        assetId: 'asset-1',
      },
      store(),
      { healthCheck: vi.fn(), scan: vi.fn(async () => 'CLEAN' as const) },
    )).resolves.toEqual({
      assetId: 'asset-1',
      href: '/api/assignments/assignment-1/content-assets/asset-1',
    });
    expect(db.assignmentContentAsset.update).toHaveBeenCalledWith({
      where: { id: 'asset-1' },
      data: { state: 'AVAILABLE', availableAt: expect.any(Date) },
    });
  });

  it('atomically replaces draft references and rejects foreign assets', async () => {
    const href = assignmentContentAssetHref('assignment-1', 'asset-1');
    const tx = {
      assignmentContentAsset: {
        findMany: vi.fn(async () => [{ id: 'asset-1' }]),
      },
      assignmentRevisionAssetReference: {
        deleteMany: vi.fn(async () => ({ count: 0 })),
        createMany: vi.fn(async () => ({ count: 1 })),
      },
    };
    await replaceAssignmentRevisionAssetReferences(tx as never, {
      assignmentId: 'assignment-1',
      revisionId: 'revision-1',
      questions: [{
        stableQuestionId: 'question:1',
        prompt: `![图](${href} "asset:asset-1")\n\n再次引用：![图](${href} "asset:asset-1")`,
        referenceAnswer: '',
      }],
    });
    expect(tx.assignmentContentAsset.findMany).toHaveBeenCalledWith({
      where: {
        id: { in: ['asset-1'] },
        assignmentId: 'assignment-1',
        state: 'AVAILABLE',
      },
      select: { id: true },
    });
    expect(tx.assignmentRevisionAssetReference.createMany).toHaveBeenCalledWith({
      data: [{
        revisionId: 'revision-1',
        assetId: 'asset-1',
        stableQuestionId: 'question:1',
        field: 'PROMPT',
      }],
      skipDuplicates: true,
    });

    tx.assignmentContentAsset.findMany.mockResolvedValueOnce([]);
    await expect(replaceAssignmentRevisionAssetReferences(tx as never, {
      assignmentId: 'assignment-1',
      revisionId: 'revision-1',
      questions: [{
        stableQuestionId: 'question:1',
        prompt: `![图](${href} "asset:asset-1")`,
        referenceAnswer: '',
      }],
    })).rejects.toMatchObject({ code: 'assignment-content-asset-reference-forbidden' });
  });

  it('checks marker/reference equality again before publication', async () => {
    const href = assignmentContentAssetHref('assignment-1', 'asset-1');
    const tx = {
      assignmentRevisionAssetReference: {
        findMany: vi.fn(async () => [{
          assetId: 'asset-1',
          stableQuestionId: 'question:1',
          field: 'PROMPT',
        }]),
      },
    };
    await expect(assertAssignmentRevisionAssetReferences(tx as never, {
      assignmentId: 'assignment-1',
      revisionId: 'revision-1',
      questions: [{
        stableQuestionId: 'question:1',
        prompt: `![图](${href} "asset:asset-1")\n\n再次引用：![图](${href} "asset:asset-1")`,
        referenceAnswer: '',
      }],
    })).resolves.toBeUndefined();
    tx.assignmentRevisionAssetReference.findMany.mockResolvedValueOnce([]);
    await expect(assertAssignmentRevisionAssetReferences(tx as never, {
      assignmentId: 'assignment-1',
      revisionId: 'revision-1',
      questions: [{
        stableQuestionId: 'question:1',
        prompt: `![图](${href} "asset:asset-1")`,
        referenceAnswer: '',
      }],
    })).rejects.toMatchObject({ code: 'assignment-content-asset-reference-mismatch' });
  });

  it('allows assigned students to read prompt assets and rejects reference-answer assets', async () => {
    const db = {
      assignmentContentAsset: {
        findUnique: vi.fn(async () => ({
          id: 'asset-1',
          assignmentId: 'assignment-1',
          uploaderId: 'teacher-1',
          objectKey: 'private-key',
          mimeType: 'image/png',
          sizeBytes: png.byteLength,
          checksum,
          state: 'AVAILABLE',
          assignment: { authorId: 'teacher-1' },
          references: [{ revisionId: 'revision-1', field: 'PROMPT' }],
        })),
      },
      studentProfile: {
        findUnique: vi.fn(async () => ({ classId: 'class-1' })),
      },
      assignmentRevision: {
        findFirst: vi.fn(async () => ({ id: 'revision-1' })),
      },
    };
    await expect(readAssignmentContentAsset(
      db as never,
      {
        actorId: 'student-1',
        actorRole: 'STUDENT',
        assignmentId: 'assignment-1',
        assetId: 'asset-1',
      },
      store(),
    )).resolves.toMatchObject({ mimeType: 'image/png' });
    db.assignmentContentAsset.findUnique.mockResolvedValueOnce({
      ...(await db.assignmentContentAsset.findUnique()),
      references: [{ revisionId: 'revision-1', field: 'REFERENCE_ANSWER' }],
    });
    await expect(readAssignmentContentAsset(
      db as never,
      {
        actorId: 'student-1',
        actorRole: 'STUDENT',
        assignmentId: 'assignment-1',
        assetId: 'asset-1',
      },
      store(),
    )).rejects.toMatchObject({ code: 'assignment-content-asset-forbidden' });
  });

  it('rejects former authors after their role changes and stale published revisions', async () => {
    const db = {
      assignmentContentAsset: {
        findUnique: vi.fn(async () => ({
          id: 'asset-1',
          assignmentId: 'assignment-1',
          uploaderId: 'teacher-1',
          objectKey: 'private-key',
          mimeType: 'image/png',
          sizeBytes: png.byteLength,
          checksum,
          state: 'AVAILABLE',
          assignment: { authorId: 'former-teacher' },
          references: [{ revisionId: 'revision-1', field: 'PROMPT' }],
        })),
      },
      studentProfile: {
        findUnique: vi.fn(async () => ({ classId: 'class-1' })),
      },
      assignmentRevision: {
        findFirst: vi.fn(async () => ({ id: 'revision-2' })),
      },
      assignmentSubmission: {
        findFirst: vi.fn(async () => null),
      },
    };
    await expect(readAssignmentContentAsset(
      db as never,
      {
        actorId: 'former-teacher',
        actorRole: 'STUDENT',
        assignmentId: 'assignment-1',
        assetId: 'asset-1',
      },
      store(),
    )).rejects.toMatchObject({ code: 'assignment-content-asset-forbidden' });
    expect(db.assignmentRevision.findFirst).toHaveBeenCalledWith({
      where: {
        assignmentId: 'assignment-1',
        state: 'PUBLISHED',
        frozenAt: { not: null },
        assignment: { archivedAt: null },
        audiences: {
          some: {
            classId: 'class-1',
            archivedAt: null,
            availableAt: { lte: expect.any(Date) },
            class: { isActive: true },
          },
        },
      },
      orderBy: { revisionNumber: 'desc' },
      select: { id: true },
    });
  });

  it('allows a frozen historical prompt revision only when ownership lineage agrees', async () => {
    const historicalSubmission = {
      frozenStudentId: 'student-1',
      frozenAudienceClassId: 'class-old',
      audience: { classId: 'class-old' },
      revision: {
        historicalOwnerships: [{
          audienceClassId: 'class-old',
          anonymizedAt: null,
        }],
      },
    };
    const db = {
      assignmentContentAsset: {
        findUnique: vi.fn(async () => ({
          id: 'asset-1',
          assignmentId: 'assignment-1',
          uploaderId: 'teacher-1',
          objectKey: 'private-key',
          mimeType: 'image/png',
          sizeBytes: png.byteLength,
          checksum,
          state: 'AVAILABLE',
          assignment: { authorId: 'teacher-1' },
          references: [{ revisionId: 'revision-old', field: 'PROMPT' }],
        })),
      },
      studentProfile: {
        findUnique: vi.fn(async () => ({ classId: 'class-current' })),
      },
      assignmentRevision: {
        findFirst: vi.fn(async () => ({ id: 'revision-current' })),
      },
      assignmentSubmission: {
        findFirst: vi.fn(async () => historicalSubmission),
      },
    };
    await expect(readAssignmentContentAsset(
      db as never,
      {
        actorId: 'student-1',
        actorRole: 'STUDENT',
        assignmentId: 'assignment-1',
        assetId: 'asset-1',
      },
      store(),
    )).resolves.toMatchObject({ mimeType: 'image/png' });
    expect(db.assignmentSubmission.findFirst).toHaveBeenCalledWith({
      where: {
        studentId: 'student-1',
        frozenStudentId: 'student-1',
        assignmentRevisionId: { in: ['revision-old'] },
        revision: {
          assignmentId: 'assignment-1',
          historicalOwnerships: {
            some: { studentId: 'student-1', anonymizedAt: null },
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
      include: {
        audience: { select: { classId: true } },
        revision: {
          select: {
            historicalOwnerships: {
              where: { studentId: 'student-1' },
              take: 1,
              select: { audienceClassId: true, anonymizedAt: true },
            },
          },
        },
      },
    });

    db.assignmentSubmission.findFirst.mockResolvedValueOnce({
      ...historicalSubmission,
      frozenAudienceClassId: 'class-forged',
    });
    await expect(readAssignmentContentAsset(
      db as never,
      {
        actorId: 'student-1',
        actorRole: 'STUDENT',
        assignmentId: 'assignment-1',
        assetId: 'asset-1',
      },
      store(),
    )).rejects.toMatchObject({ code: 'assignment-content-asset-forbidden' });
  });

  it('revalidates object integrity before returning protected bytes', async () => {
    const db = {
      assignmentContentAsset: {
        findUnique: vi.fn(async () => ({
          id: 'asset-1',
          assignmentId: 'assignment-1',
          uploaderId: 'teacher-1',
          objectKey: 'private-key',
          mimeType: 'image/png',
          sizeBytes: png.byteLength,
          checksum,
          state: 'AVAILABLE',
          assignment: { authorId: 'teacher-1' },
          references: [],
        })),
      },
      studentProfile: {
        findUnique: vi.fn(),
      },
      assignmentRevision: {
        findFirst: vi.fn(),
      },
    };
    const changedStore = store();
    changedStore.readObject.mockResolvedValueOnce(Uint8Array.from([137, 80, 78, 71]));

    await expect(readAssignmentContentAsset(
      db as never,
      {
        actorId: 'teacher-1',
        actorRole: 'TEACHER',
        assignmentId: 'assignment-1',
        assetId: 'asset-1',
      },
      changedStore,
    )).rejects.toMatchObject({ code: 'assignment-content-asset-integrity-mismatch' });
  });
});
