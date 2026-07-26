import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  session: vi.fn(),
  listCourseBases: vi.fn(),
  listTaskSummaries: vi.fn(),
  getTask: vi.fn(),
  classFindMany: vi.fn(),
  snapshotFindMany: vi.fn(),
}));

vi.mock('next/navigation', () => ({ redirect: vi.fn() }));
vi.mock('@/features/teacher/smart-preparation-workspace', () => ({
  SmartPreparationWorkspace: () => null,
}));
vi.mock('@/lib/auth', () => ({ getServerAuthSession: mocks.session }));
vi.mock('@/lib/course-basis', () => ({ listCourseBases: mocks.listCourseBases }));
vi.mock('@/lib/prisma', () => ({
  prisma: {
    class: { findMany: mocks.classFindMany },
    diagnosisReportSnapshot: { findMany: mocks.snapshotFindMany },
  },
}));
vi.mock('@/lib/smart-lesson-plan', () => ({
  getSmartLessonTask: mocks.getTask,
  listSmartLessonTaskSummaries: mocks.listTaskSummaries,
}));

import SmartPrepPage from '../teacher/smart-prep/page';

describe('smart preparation page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.session.mockResolvedValue({ user: { id: 'teacher-1', role: 'TEACHER' } });
    mocks.listCourseBases.mockResolvedValue([{ id: 'basis-1' }, { id: 'basis-2' }]);
    mocks.listTaskSummaries.mockResolvedValue([]);
    mocks.classFindMany.mockResolvedValue([]);
    mocks.snapshotFindMany.mockResolvedValue([]);
  });

  it('loads the complete course-basis list while restoring the requested selection', async () => {
    const page = await SmartPrepPage({
      searchParams: Promise.resolve({ view: 'basis', courseBasisId: 'basis-2' }),
    });

    expect(mocks.listCourseBases).toHaveBeenCalledWith(
      expect.anything(),
      { id: 'teacher-1', role: 'TEACHER' },
    );
    expect(page.props.courseBases).toEqual([{ id: 'basis-1' }, { id: 'basis-2' }]);
    expect(page.props.initialCourseBasisId).toBe('basis-2');
  });
});
