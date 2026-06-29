import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getServerAuthSession: vi.fn(),
  redirect: vi.fn((target: string) => {
    throw new Error(`redirect:${target}`);
  }),
  findFirstCourseEnhancementPack: vi.fn(),
  loadCourseEnhancementPack: vi.fn(),
  teacherPrepPackReviewSurface: vi.fn((props: unknown) => ({ type: 'TeacherPrepPackReviewSurface', props })),
}));

vi.mock('next/navigation', () => ({
  redirect: mocks.redirect,
}));

vi.mock('@/lib/auth', () => ({
  getServerAuthSession: mocks.getServerAuthSession,
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    courseEnhancementPack: {
      findFirst: mocks.findFirstCourseEnhancementPack,
    },
  },
}));

vi.mock('@/lib/data-governance/teacher-prep-pack-generation', () => ({
  loadCourseEnhancementPack: mocks.loadCourseEnhancementPack,
}));

vi.mock('@/features/teacher/teacher-prep-pack-review-surface', () => ({
  TeacherPrepPackReviewSurface: (props: unknown) => mocks.teacherPrepPackReviewSurface(props),
}));

import TeacherPrepPacksPage from '../teacher/prep-packs/page';

describe('TeacherPrepPacksPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getServerAuthSession.mockResolvedValue({ user: { id: 'teacher-1', role: 'TEACHER' } });
    mocks.findFirstCourseEnhancementPack.mockResolvedValue({ id: 'enhancement-pack-1' });
    mocks.loadCourseEnhancementPack.mockResolvedValue({ id: 'enhancement-pack-1', items: [] });
  });

  it('loads a prep pack by the persisted role-diagnosis cluster evidence ref', async () => {
    const element = await TeacherPrepPacksPage({
      searchParams: Promise.resolve({ cluster: 'cluster-1' }),
    });

    expect(mocks.findFirstCourseEnhancementPack).toHaveBeenCalledWith({
      where: {
        teacherId: 'teacher-1',
        source: {
          path: ['sourceEvidenceRefs'],
          array_contains: ['role-diagnosis:cluster-1'],
        },
      },
      orderBy: { updatedAt: 'desc' },
      select: { id: true },
    });
    expect(mocks.loadCourseEnhancementPack).toHaveBeenCalledWith(expect.anything(), 'enhancement-pack-1');
    expect(element).toMatchObject({
      props: { pack: { id: 'enhancement-pack-1' } },
    });
  });

  it('loads a prep pack by the Graph Center graph-node context', async () => {
    const element = await TeacherPrepPacksPage({
      searchParams: Promise.resolve({
        classId: 'class-1',
        graphNodeId: 'kn:autocontrol:feedback-loop',
        learningGoalId: 'knowledge:autocontrol:feedback-loop',
        resourceGapStatus: 'partial',
      }),
    });

    expect(mocks.findFirstCourseEnhancementPack).toHaveBeenCalledWith({
      where: {
        teacherId: 'teacher-1',
        classId: 'class-1',
        source: {
          path: ['sourceEvidenceRefs'],
          array_contains: ['graph-node:kn:autocontrol:feedback-loop'],
        },
      },
      orderBy: { updatedAt: 'desc' },
      select: { id: true },
    });
    expect(element).toMatchObject({
      props: { pack: { id: 'enhancement-pack-1' } },
    });
  });

  it('renders the empty review state when a diagnosis cluster has no matching pack', async () => {
    mocks.findFirstCourseEnhancementPack.mockResolvedValue(null);

    const element = await TeacherPrepPacksPage({
      searchParams: Promise.resolve({ cluster: 'cluster-missing' }),
    });

    expect(mocks.loadCourseEnhancementPack).not.toHaveBeenCalled();
    expect(element).toMatchObject({
      props: { pack: null },
    });
  });

  it('renders a recovery state instead of throwing when the prep-pack table is missing', async () => {
    mocks.findFirstCourseEnhancementPack.mockRejectedValue({
      code: 'P2021',
      message: 'The table `CourseEnhancementPack` does not exist',
    });

    const element = await TeacherPrepPacksPage({
      searchParams: Promise.resolve({ classId: 'class-1' } as never),
    });

    expect(element).toMatchObject({
      props: {
        pack: null,
        recovery: expect.objectContaining({
          reason: 'storage-missing',
        }),
      },
    });
    expect(mocks.loadCourseEnhancementPack).not.toHaveBeenCalled();
  });

  it('passes lifecycle action receipts to the review surface', async () => {
    const element = await TeacherPrepPacksPage({
      searchParams: Promise.resolve({
        packId: 'enhancement-pack-1',
        status: 'activate',
      }),
    });

    expect(element).toMatchObject({
      props: {
        actionReceipt: expect.objectContaining({
          status: 'succeeded',
          message: expect.stringContaining('overlay 已激活'),
          displayReference: 'enhancement-pack-1',
        }),
      },
    });
  });

  it('passes failed lifecycle action receipts with recovery evidence', async () => {
    const element = await TeacherPrepPacksPage({
      searchParams: Promise.resolve({
        packId: 'enhancement-pack-1',
        status: 'action-failed',
        error: 'overlay write failed',
      }),
    });

    expect(element).toMatchObject({
      props: {
        actionReceipt: expect.objectContaining({
          status: 'failed',
          message: expect.stringContaining('overlay write failed'),
          recoveryAction: expect.stringContaining('重新执行动作'),
        }),
      },
    });
  });

  it('does not pass an action receipt when no lifecycle status is present', async () => {
    const element = await TeacherPrepPacksPage({
      searchParams: Promise.resolve({ packId: 'enhancement-pack-1' }),
    });

    expect(element).toMatchObject({
      props: {
        actionReceipt: null,
      },
    });
  });

  it('passes blocked lifecycle action receipts for invalid states', async () => {
    const element = await TeacherPrepPacksPage({
      searchParams: Promise.resolve({
        packId: 'enhancement-pack-1',
        status: 'invalid-lifecycle',
      }),
    });

    expect(element).toMatchObject({
      props: {
        actionReceipt: expect.objectContaining({
          status: 'blocked',
          message: expect.stringContaining('生命周期状态不允许'),
          recoveryAction: expect.stringContaining('重新执行动作'),
        }),
      },
    });
  });
});
