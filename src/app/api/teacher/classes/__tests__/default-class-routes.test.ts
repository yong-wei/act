import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getServerAuthSession: vi.fn(),
  prisma: {
    class: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    user: { findUnique: vi.fn() },
  },
  service: {
    createClass: vi.fn(),
    setDefaultClass: vi.fn(),
    activateClass: vi.fn(),
    deactivateClass: vi.fn(),
    deleteClass: vi.fn(),
  },
}));

vi.mock('@/lib/auth', () => ({
  getServerAuthSession: mocks.getServerAuthSession,
}));

vi.mock('@/lib/prisma', () => ({ prisma: mocks.prisma }));

vi.mock('@/lib/nextjs-dynamic-error', () => ({
  rethrowIfNextDynamicError: vi.fn(),
}));

vi.mock('@/lib/teacher-default-class-service', () => ({
  TeacherDefaultClassServiceError: class TeacherDefaultClassServiceError extends Error {},
  teacherDefaultClassService: mocks.service,
}));

import { GET as getClasses, POST as createClass } from '../route';
import { PATCH as updateClass, DELETE as deleteClass } from '../[classId]/route';
import { PUT as setDefaultClass } from '../default/route';
import { GET as getLaunchOptions } from '../launch-options/route';

const teacherSession = { user: { id: 'teacher-1', role: 'TEACHER' } };
const activeClass = {
  id: 'class-1',
  teacherId: 'teacher-1',
  name: '自动化 1 班',
  code: 'AUTO01',
  isActive: true,
  createdAt: new Date('2026-07-01T00:00:00Z'),
};

describe('teacher default-class routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getServerAuthSession.mockResolvedValue(teacherSession);
  });

  it('marks the persisted default in the teacher class list', async () => {
    mocks.prisma.class.findMany.mockResolvedValue([
      { ...activeClass, _count: { students: 12 } },
    ]);
    mocks.prisma.user.findUnique.mockResolvedValue({ defaultTeachingClassId: activeClass.id });

    const response = await getClasses();
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual([
      expect.objectContaining({ id: activeClass.id, isDefault: true }),
    ]);
  });

  it('creates a class through the shared default-class service', async () => {
    mocks.prisma.class.findUnique.mockResolvedValue(null);
    mocks.service.createClass.mockResolvedValue(activeClass);

    const response = await createClass(new Request('http://localhost/api/teacher/classes', {
      method: 'POST',
      body: JSON.stringify({ name: activeClass.name }),
    }));

    expect(response.status).toBe(201);
    expect(mocks.service.createClass).toHaveBeenCalledWith(expect.objectContaining({
      teacherId: 'teacher-1',
      name: activeClass.name,
    }));
  });

  it('routes lifecycle transitions through the shared service', async () => {
    mocks.prisma.class.findUnique.mockResolvedValue(activeClass);
    mocks.service.deactivateClass.mockResolvedValue({ ...activeClass, isActive: false });
    mocks.prisma.class.update.mockResolvedValue({ ...activeClass, isActive: false });

    const response = await updateClass(
      new Request('http://localhost/api/teacher/classes/class-1', {
        method: 'PATCH',
        body: JSON.stringify({ isActive: false }),
      }),
      { params: Promise.resolve({ classId: activeClass.id }) },
    );

    expect(response.status).toBe(200);
    expect(mocks.service.deactivateClass).toHaveBeenCalledWith('teacher-1', activeClass.id);
  });

  it('routes deletion through the shared service', async () => {
    mocks.prisma.class.findUnique.mockResolvedValue(activeClass);
    mocks.service.deleteClass.mockResolvedValue(activeClass);

    const response = await deleteClass(
      new Request('http://localhost/api/teacher/classes/class-1', { method: 'DELETE' }),
      { params: Promise.resolve({ classId: activeClass.id }) },
    );

    expect(response.status).toBe(200);
    expect(mocks.service.deleteClass).toHaveBeenCalledWith('teacher-1', activeClass.id);
  });

  it('sets only an owned active class as the default through the service', async () => {
    mocks.service.setDefaultClass.mockResolvedValue(activeClass);

    const response = await setDefaultClass(new Request('http://localhost/api/teacher/classes/default', {
      method: 'PUT',
      body: JSON.stringify({ classId: activeClass.id }),
    }));

    expect(response.status).toBe(200);
    expect(mocks.service.setDefaultClass).toHaveBeenCalledWith('teacher-1', activeClass.id);
  });

  it('returns only active owned launch options and a valid default', async () => {
    mocks.prisma.class.findMany.mockResolvedValue([activeClass]);
    mocks.prisma.user.findUnique.mockResolvedValue({ defaultTeachingClassId: activeClass.id });

    const response = await getLaunchOptions();
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      classes: [expect.objectContaining({ id: activeClass.id, name: activeClass.name })],
      defaultClassId: activeClass.id,
    });
    expect(mocks.prisma.class.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { teacherId: 'teacher-1', isActive: true },
    }));
  });
});
