import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  session: vi.fn(),
  listCourseBases: vi.fn(),
  listTaskSummaries: vi.fn(),
  getTask: vi.fn(),
  classFindMany: vi.fn(),
  userFindUnique: vi.fn(),
  textbookCatalog: vi.fn(),
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
    user: { findUnique: mocks.userFindUnique },
  },
}));
vi.mock('@/lib/smart-lesson-plan', () => ({
  getSmartLessonTask: mocks.getTask,
  listSmartLessonTaskSummaries: mocks.listTaskSummaries,
}));
vi.mock('@/lib/smart-lesson-plan/textbook-resource-pack', () => ({
  loadSmartPreparationTextbookCatalog: mocks.textbookCatalog,
}));

import SmartPrepPage from '../teacher/smart-prep/page';

describe('smart preparation page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.session.mockResolvedValue({ user: { id: 'teacher-1', role: 'TEACHER' } });
    mocks.listCourseBases.mockResolvedValue([{ id: 'basis-1' }, { id: 'basis-2' }]);
    mocks.listTaskSummaries.mockResolvedValue([]);
    mocks.classFindMany.mockResolvedValue([]);
    mocks.userFindUnique.mockResolvedValue({ defaultTeachingClassId: null });
    mocks.textbookCatalog.mockResolvedValue([]);
  });

  it('loads the complete course-basis list while restoring the requested selection', async () => {
    const pageBases = Array.from({ length: 50 }, (_, index) => ({ id: `basis-${index + 1}` }));
    mocks.listCourseBases
      .mockResolvedValueOnce(pageBases)
      .mockResolvedValueOnce([{ id: 'basis-75' }]);
    const page = await SmartPrepPage({
      searchParams: Promise.resolve({ view: 'basis', courseBasisId: 'basis-75' }),
    });

    expect(mocks.listCourseBases).toHaveBeenNthCalledWith(
      1,
      expect.anything(),
      { id: 'teacher-1', role: 'TEACHER' },
    );
    expect(mocks.listCourseBases).toHaveBeenNthCalledWith(
      2,
      expect.anything(),
      { id: 'teacher-1', role: 'TEACHER' },
      { courseBasisId: 'basis-75' },
    );
    expect(page.props.courseBases).toEqual([...pageBases, { id: 'basis-75' }]);
    expect(page.props.initialCourseBasisId).toBe('basis-75');
    expect(page.props.initialCourseBasisOffset).toBe(50);
    expect(page.props.initialHasMoreCourseBases).toBe(true);
  });
});
