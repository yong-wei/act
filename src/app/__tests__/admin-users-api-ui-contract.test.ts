import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  requireAdminSession: vi.fn(),
  redirect: vi.fn((target: string) => {
    throw new Error(`redirect:${target}`);
  }),
  adminDashboard: vi.fn((props: unknown) => ({ type: 'AdminDashboard', props })),
  detachSmartLessonTasksForDeletedClass: vi.fn(),
  tx: {
    classSession: { deleteMany: vi.fn() },
    class: { findMany: vi.fn(), deleteMany: vi.fn() },
    lessonPlan: { deleteMany: vi.fn() },
    teachingResource: { findMany: vi.fn(), deleteMany: vi.fn() },
    lessonItem: { deleteMany: vi.fn() },
    studentState: { deleteMany: vi.fn() },
  },
  prisma: {
    user: {
      count: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      delete: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

vi.mock('next/navigation', () => ({
  redirect: mocks.redirect,
}));

vi.mock('@/lib/auth', () => ({
  getServerAuthSession: vi.fn(() => Promise.resolve({
    user: {
      id: 'admin-1',
      name: '管理员',
      email: 'admin@example.com',
      role: 'ADMIN',
    },
  })),
}));

vi.mock('@/features/admin/admin-dashboard', () => ({
  AdminDashboard: (props: unknown) => mocks.adminDashboard(props),
}));

vi.mock('@/lib/admin', () => ({
  requireAdminSession: mocks.requireAdminSession,
}));

vi.mock('@/lib/prisma', () => ({
  prisma: mocks.prisma,
}));

vi.mock('@/lib/teacher-default-class-service', () => ({
  detachSmartLessonTasksForDeletedClass: mocks.detachSmartLessonTasksForDeletedClass,
}));

import AdminUsersPage from '../admin/users/page';
import { GET as getAdminUsers } from '../api/admin/users/route';
import { DELETE as deleteAdminUser } from '../api/admin/users/[id]/route';

describe('admin users API/UI query contract', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdminSession.mockResolvedValue({ user: { id: 'admin-1', role: 'ADMIN' } });
    mocks.prisma.user.count.mockResolvedValue(0);
    mocks.prisma.user.findMany.mockResolvedValue([]);
    mocks.prisma.user.findUnique.mockResolvedValue(null);
    mocks.prisma.user.delete.mockResolvedValue({});
    mocks.prisma.$transaction.mockImplementation(async (operation: (tx: typeof mocks.tx) => Promise<unknown>) => operation(mocks.tx));
    mocks.tx.class.findMany.mockResolvedValue([]);
    mocks.tx.teachingResource.findMany.mockResolvedValue([]);
  });

  it('passes q, role, page, and action query state from the page to AdminDashboard', async () => {
    const element = await AdminUsersPage({
      searchParams: Promise.resolve({
        q: 'zzzz-no-match',
        role: 'STUDENT',
        page: '2',
        action: 'export',
      }),
    });

    expect(element).toMatchObject({
      props: {
        initialUsersQuery: {
          search: 'zzzz-no-match',
          role: 'STUDENT',
          page: 2,
          action: 'export',
          source: {
            searchParam: 'q',
            roleSupported: true,
            pageValid: true,
          },
        },
      },
    });
  });

  it('uses q as the API search source and scopes pagination to the active role filter', async () => {
    const response = await getAdminUsers(new Request(
      'http://localhost/api/admin/users?q=zzzz-no-match&role=STUDENT&page=2&pageSize=20',
    ) as never);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      total: 0,
      page: 2,
      pageSize: 20,
      query: {
        search: 'zzzz-no-match',
        role: 'STUDENT',
        source: {
          searchParam: 'q',
          roleSupported: true,
          pageSizeValid: true,
        },
      },
      users: [],
    });
    expect(mocks.prisma.user.count).toHaveBeenCalledWith({
      where: {
        role: 'STUDENT',
        OR: expect.any(Array),
      },
    });
    expect(mocks.prisma.user.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ role: 'STUDENT' }),
      skip: 20,
      take: 20,
    }));
  });

  it('unwraps smart lesson class references before the admin teacher deletion path removes classes', async () => {
    mocks.prisma.user.findUnique.mockResolvedValue({ id: 'teacher-1', role: 'TEACHER' });
    mocks.tx.class.findMany.mockResolvedValue([{ id: 'class-1' }, { id: 'class-2' }]);

    const response = await deleteAdminUser(new Request(
      'http://localhost/api/admin/users/teacher-1',
      { method: 'DELETE' },
    ), { params: Promise.resolve({ id: 'teacher-1' }) });

    expect(response.status).toBe(200);
    expect(mocks.detachSmartLessonTasksForDeletedClass).toHaveBeenNthCalledWith(
      1,
      mocks.tx,
      'teacher-1',
      'class-1',
    );
    expect(mocks.detachSmartLessonTasksForDeletedClass).toHaveBeenNthCalledWith(
      2,
      mocks.tx,
      'teacher-1',
      'class-2',
    );
    expect(mocks.tx.class.deleteMany).toHaveBeenCalledWith({ where: { teacherId: 'teacher-1' } });
    expect(mocks.prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: 'Serializable',
    });
  });
});
