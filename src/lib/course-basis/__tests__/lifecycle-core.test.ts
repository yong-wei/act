import { describe, expect, it, vi } from 'vitest';

import { projectCourseBasisLifecycle } from '../domain';
import {
  adoptCourseBasisVersion,
  deleteCourseBasis,
  deleteCourseBasisDocument,
  deleteCourseBasisVersion,
  getCourseBasisVersionForEditing,
} from '../service';

const teacher = { id: 'teacher-1', role: 'TEACHER' as const };

function adoptionDb() {
  const version: any = {
    id: 'version-1',
    documentId: 'document-1',
    versionNumber: 1,
    sourceType: 'MARKDOWN',
    sourceName: 'basis.md',
    mimeType: 'text/markdown',
    byteSize: 10,
    originalContent: new TextEncoder().encode('Basis'),
    normalizedText: 'Basis',
    contentHash: 'content-hash',
    extractionState: 'EXTRACTED',
    extractionVersion: 'v1',
    failureReason: null,
    reviewState: 'PENDING',
    reviewedById: null,
    reviewedAt: null,
    retiredById: null,
    retiredAt: null,
    createdAt: new Date(),
    document: {
      title: 'Basis',
      courseBasis: { id: 'basis-1', ownerId: teacher.id },
    },
    segments: [
      { id: 'segment-1', stableAnchor: 'root/paragraph:1', contentHash: 'segment-hash-1' },
      { id: 'segment-2', stableAnchor: 'root/paragraph:2', contentHash: 'segment-hash-2' },
    ],
  };
  let referenceLink: any = null;
  const db: any = {
    courseBasisDocumentVersion: {
      findFirst: vi.fn(async () => version),
      updateMany: vi.fn(async ({ data }: any) => {
        Object.assign(version, data);
        return { count: 1 };
      }),
      findUniqueOrThrow: vi.fn(async () => ({
        ...version,
        _count: { segments: version.segments.length, projections: version.segments.length },
      })),
    },
    courseBasisProjection: {
      createMany: vi.fn(async () => ({ count: version.segments.length })),
      count: vi.fn(async () => version.segments.length),
    },
    courseBasisReferenceLink: {
      findUnique: vi.fn(async () => referenceLink),
      create: vi.fn(async ({ data }: any) => {
        referenceLink = { id: 'reference-1', ...data };
        return referenceLink;
      }),
      update: vi.fn(async ({ data }: any) => {
        referenceLink = { ...referenceLink, ...data };
        return referenceLink;
      }),
    },
  };
  db.$transaction = vi.fn(async (run: (tx: any) => unknown) => run(db));
  return { db, version };
}

describe('course-basis lifecycle core', () => {
  it('projects disabled before frozen and exposes the approved Chinese labels', () => {
    expect(projectCourseBasisLifecycle({
      extractionState: 'UPLOADING',
      reviewState: 'PENDING',
    })).toMatchObject({ state: 'UPLOADING', label: '上传中' });
    expect(projectCourseBasisLifecycle({
      extractionState: 'PROCESSING',
      reviewState: 'PENDING',
    })).toMatchObject({ state: 'PROCESSING', label: '正在提取' });
    expect(projectCourseBasisLifecycle({
      extractionState: 'EXTRACTED',
      reviewState: 'CONFIRMED',
      retiredAt: new Date(),
    })).toMatchObject({ state: 'DISABLED', label: '已停用', frozen: true });
    expect(projectCourseBasisLifecycle({
      extractionState: 'EXTRACTED',
      reviewState: 'PENDING',
    })).toMatchObject({ state: 'EDITABLE', label: '可编辑', editable: true });
    expect(projectCourseBasisLifecycle({
      extractionState: 'FAILED',
      reviewState: 'PENDING',
    })).toMatchObject({ state: 'FAILED', label: '处理失败' });
    expect([
      '上传中',
      '正在提取',
      '可编辑',
      '已冻结',
      '已停用',
      '处理失败',
    ]).toHaveLength(6);
  });

  it('does not freeze a merely selected version', async () => {
    const { db, version } = adoptionDb();
    db.smartLessonSourceSelection = { count: vi.fn(async () => 1) };
    db.courseBasisReferenceLink.count = vi.fn(async () => 0);

    await expect(getCourseBasisVersionForEditing(db, {
      actor: teacher,
      versionId: version.id,
    })).resolves.toMatchObject({ frozen: false, lifecycle: { label: '可编辑' } });
  });

  it('keeps a disabled historical version readable to its owner', async () => {
    const { db, version } = adoptionDb();
    version.retiredAt = new Date('2026-07-26T00:00:00Z');

    await expect(getCourseBasisVersionForEditing(db, {
      actor: teacher,
      versionId: version.id,
    })).resolves.toMatchObject({
      markdown: 'Basis',
      frozen: true,
      lifecycle: { state: 'DISABLED', label: '已停用' },
    });
  });

  it('freezes on adoption and keeps the same adopting identity idempotent', async () => {
    const { db, version } = adoptionDb();
    const input = {
      actor: teacher,
      versionId: version.id,
      adopter: { referenceType: 'SMART_LESSON_GOAL' as const, referenceId: 'goal-1' },
      anchors: [{ stableAnchor: 'root/paragraph:1', contentHash: 'segment-hash-1' }],
      now: new Date('2026-07-26T00:00:00Z'),
    };

    await expect(adoptCourseBasisVersion(db, input)).resolves.toMatchObject({
      frozenNow: true,
      referenceLink: {
        contentHash: 'content-hash',
        anchors: [{ stableAnchor: 'root/paragraph:1', contentHash: 'segment-hash-1' }],
      },
    });
    await expect(adoptCourseBasisVersion(db, input)).resolves.toMatchObject({ frozenNow: false });
    expect(version).toMatchObject({
      reviewState: 'CONFIRMED',
      reviewedById: teacher.id,
      reviewedAt: input.now,
    });
    expect(db.courseBasisReferenceLink.create).toHaveBeenCalledOnce();
  });

  it('updates anchors when the same adopting record changes its binding', async () => {
    const { db, version } = adoptionDb();
    const adopter = { referenceType: 'SMART_LESSON_GOAL' as const, referenceId: 'goal-1' };

    await adoptCourseBasisVersion(db, {
      actor: teacher,
      versionId: version.id,
      adopter,
      anchors: [{ stableAnchor: 'root/paragraph:1', contentHash: 'segment-hash-1' }],
    });
    await expect(adoptCourseBasisVersion(db, {
      actor: teacher,
      versionId: version.id,
      adopter,
      anchors: [{ stableAnchor: 'root/paragraph:2', contentHash: 'segment-hash-2' }],
    })).resolves.toMatchObject({
      frozenNow: false,
      referenceLink: {
        anchors: [{ stableAnchor: 'root/paragraph:2', contentHash: 'segment-hash-2' }],
      },
    });
    expect(db.courseBasisReferenceLink.update).toHaveBeenCalledOnce();
  });

  it('rejects a different content identity without freezing it', async () => {
    const { db, version } = adoptionDb();

    await expect(adoptCourseBasisVersion(db, {
      actor: teacher,
      versionId: version.id,
      adopter: { referenceType: 'GENERATION_JOB', referenceId: 'job-1' },
      anchors: [{ stableAnchor: 'root/paragraph:1', contentHash: 'different-hash' }],
    })).rejects.toMatchObject({ code: 'adoption-anchor-conflict' });
    expect(version.reviewState).toBe('PENDING');
    expect(db.courseBasisReferenceLink.create).not.toHaveBeenCalled();
  });

  it('returns structured blockers only after owner authorization', async () => {
    const db: any = {
      courseBasisDocumentVersion: {
        findFirst: vi.fn(async ({ where }: any) => where.document?.courseBasis?.ownerId === teacher.id ? {
          id: 'version-1',
          document: { courseBasis: { id: 'basis-1', ownerId: teacher.id } },
          segments: [],
        } : null),
      },
      smartLessonSourceSelection: { findMany: vi.fn(async () => []) },
      courseBasisReferenceLink: {
        findMany: vi.fn(async () => [{
          referenceType: 'RESOURCE_PACK',
          referenceId: 'pack-1',
        }]),
      },
    };
    db.$transaction = vi.fn(async (run: (tx: any) => unknown) => run(db));

    await expect(deleteCourseBasisVersion(db, {
      actor: teacher,
      versionId: 'version-1',
    })).rejects.toMatchObject({
      code: 'version-delete-referenced',
      details: [{ category: 'RESOURCE_PACK', referenceId: 'pack-1' }],
    });
    await expect(deleteCourseBasisVersion(db, {
      actor: { id: 'teacher-2', role: 'TEACHER' },
      versionId: 'version-1',
    })).rejects.toMatchObject({ code: 'version-not-found', details: [] });
    expect(db.courseBasisReferenceLink.findMany).toHaveBeenCalledOnce();
  });

  it('expands task, plan, courseware, publication, and classroom blockers', async () => {
    const db: any = {
      courseBasisDocumentVersion: {
        findFirst: vi.fn(async () => ({
          id: 'version-1',
          document: { courseBasis: { id: 'basis-1', ownerId: teacher.id } },
          segments: [],
        })),
      },
      smartLessonSourceSelection: {
        findMany: vi.fn(async () => [{ taskId: 'task-1', state: 'REMOVED' }]),
      },
      smartLessonTask: {
        findMany: vi.fn(async () => [{ id: 'task-1', topic: '根轨迹备课' }]),
      },
      smartLessonKnowledgePoint: {
        findMany: vi.fn(async () => [{ id: 'point-1', title: '根轨迹', taskId: 'task-1' }]),
      },
      smartLessonGoal: {
        findMany: vi.fn(async () => [{ id: 'goal-1', content: '判断根轨迹', taskId: 'task-1' }]),
      },
      smartLessonGenerationJob: {
        findMany: vi.fn(async () => [{
          id: 'job-1',
          deliveryGeneration: 1,
          draft: { taskId: 'task-1', task: { topic: '根轨迹备课' } },
        }]),
      },
      smartLessonRevision: {
        findMany: vi.fn(async () => [{ id: 'plan-1', displayName: '教案第1版', taskId: 'task-1' }]),
      },
      courseBasisReferenceLink: {
        findMany: vi.fn(async () => [
          { referenceType: 'SMART_LESSON_KNOWLEDGE_POINT', referenceId: 'point-1' },
          { referenceType: 'SMART_LESSON_GOAL', referenceId: 'goal-1' },
          { referenceType: 'GENERATION_JOB', referenceId: 'job-1' },
          { referenceType: 'LESSON_PLAN_REVISION', referenceId: 'plan-1' },
          { referenceType: 'RESOURCE_PACK', referenceId: 'pack-1' },
        ]),
      },
      smartCoursewareRevision: {
        findMany: vi.fn(async () => [{ id: 'courseware-1', revisionNumber: 1, draftId: 'draft-1' }]),
      },
      smartCoursewarePublicationRevision: {
        findMany: vi.fn(async () => [{
          id: 'publication-1',
          displayName: '互动课件第1版',
          sourceRevision: { draftId: 'draft-1' },
        }]),
      },
      classSession: {
        findMany: vi.fn(async () => [{
          id: 'session-1',
          coursewareDisplayName: '互动课件第1版',
          lessonVersion: null,
        }]),
      },
    };
    db.$transaction = vi.fn(async (run: (tx: any) => unknown) => run(db));

    await expect(deleteCourseBasisVersion(db, {
      actor: teacher,
      versionId: 'version-1',
    })).rejects.toMatchObject({
      code: 'version-delete-referenced',
      details: expect.arrayContaining([
        expect.objectContaining({ category: 'SMART_LESSON_TASK', referenceId: 'task-1' }),
        expect.objectContaining({ category: 'SMART_LESSON_KNOWLEDGE_POINT', referenceId: 'point-1' }),
        expect.objectContaining({ category: 'SMART_LESSON_GOAL', referenceId: 'goal-1' }),
        expect.objectContaining({ category: 'GENERATION_JOB', referenceId: 'job-1' }),
        expect.objectContaining({ category: 'LESSON_PLAN_REVISION', referenceId: 'plan-1' }),
        expect.objectContaining({ category: 'RESOURCE_PACK', referenceId: 'pack-1' }),
        expect.objectContaining({ category: 'COURSEWARE_REVISION', referenceId: 'courseware-1' }),
        expect.objectContaining({ category: 'PUBLICATION_REVISION', referenceId: 'publication-1' }),
        expect.objectContaining({ category: 'CLASSROOM_SESSION', referenceId: 'session-1' }),
      ]),
    });
    await expect(deleteCourseBasisVersion(db, {
      actor: teacher,
      versionId: 'version-1',
    })).rejects.toMatchObject({
      details: expect.arrayContaining([
        expect.objectContaining({
          category: 'LESSON_PLAN_REVISION',
          name: '教案第1版',
          navigationTarget: '/teacher/smart-prep?taskId=task-1',
        }),
        expect.objectContaining({
          category: 'COURSEWARE_REVISION',
          name: '课件第 1 版',
          navigationTarget: '/teacher/smart-prep/courseware/draft-1',
        }),
      ]),
    });
    expect(db.smartLessonSourceSelection.findMany).toHaveBeenCalledWith({
      where: { sourceVersionId: { in: ['version-1'] } },
      select: { taskId: true },
    });
  });

  it('hard-deletes unreferenced documents and course bases in dependency order', async () => {
    const calls: string[] = [];
    const db: any = {
      courseBasis: {
        findFirst: vi.fn(async () => ({ id: 'basis-1' })),
        delete: vi.fn(async () => { calls.push('basis'); return { id: 'basis-1' }; }),
      },
      courseBasisDocument: {
        findFirst: vi.fn(async () => ({ id: 'document-1', courseBasisId: 'basis-1' })),
        findMany: vi.fn(async () => [{ id: 'document-1', versions: [{ id: 'version-1' }] }]),
        delete: vi.fn(async () => { calls.push('document'); return { id: 'document-1' }; }),
        deleteMany: vi.fn(async () => { calls.push('documents'); return { count: 1 }; }),
      },
      courseBasisDocumentVersion: {
        findMany: vi.fn(async () => [{ id: 'version-1' }]),
        deleteMany: vi.fn(async () => { calls.push('versions'); return { count: 1 }; }),
      },
      courseBasisProjection: {
        deleteMany: vi.fn(async () => { calls.push('projections'); return { count: 1 }; }),
      },
      courseBasisSegment: {
        deleteMany: vi.fn(async () => { calls.push('segments'); return { count: 1 }; }),
      },
      smartLessonSourceSelection: { findMany: vi.fn(async () => []) },
      courseBasisReferenceLink: { findMany: vi.fn(async () => []) },
      smartLessonTask: { findMany: vi.fn(async () => []) },
    };
    db.$transaction = vi.fn(async (run: (tx: any) => unknown) => run(db));

    await expect(deleteCourseBasisDocument(db, {
      actor: teacher,
      documentId: 'document-1',
    })).resolves.toMatchObject({ id: 'document-1' });
    expect(calls).toEqual(['projections', 'segments', 'versions', 'document']);
    calls.length = 0;
    await expect(deleteCourseBasis(db, {
      actor: teacher,
      courseBasisId: 'basis-1',
    })).resolves.toMatchObject({ id: 'basis-1' });
    expect(calls).toEqual(['projections', 'segments', 'versions', 'documents', 'basis']);
  });
});
