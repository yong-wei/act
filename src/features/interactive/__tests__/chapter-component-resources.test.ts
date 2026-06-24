import { describe, expect, it, vi, beforeEach } from 'vitest';
import { ResourceType } from '@prisma/client';

vi.mock('server-only', () => ({}));

vi.mock('next-auth', () => ({
  getServerSession: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  authOptions: { providers: [] },
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    teachingResource: {
      findMany: vi.fn(),
    },
  },
}));

describe('loadChapterComponentResources', () => {
  beforeEach(async () => {
    const [{ getServerSession }, { prisma }] = await Promise.all([
      import('next-auth'),
      import('@/lib/prisma'),
    ]);
    vi.mocked(getServerSession).mockReset();
    vi.mocked(prisma.teachingResource.findMany).mockReset();
    vi.mocked(prisma.teachingResource.findMany).mockResolvedValue([
      {
        id: 'modeling',
        title: '建模组件',
        displayName: '建模组件',
        description: null,
        type: ResourceType.INTERACTIVE_COMP,
        category: 'SYSTEM_MODELING',
        registryId: 'modeling',
        displayOrder: 1,
      },
      {
        id: 'classroom-only',
        title: '课堂组件',
        displayName: '课堂组件',
        description: null,
        type: ResourceType.INTERACTIVE_COMP,
        category: 'CLASSROOM',
        registryId: 'classroom',
        displayOrder: 2,
      },
    ] as never);
  });

  it('loads public chapter resources server-side with the same default filters as /api/resources', async () => {
    const [{ getServerSession }, { prisma }, { loadChapterComponentResources }] = await Promise.all([
      import('next-auth'),
      import('@/lib/prisma'),
      import('../chapter-component-resources'),
    ]);

    vi.mocked(getServerSession).mockResolvedValue(null);

    const resources = await loadChapterComponentResources();

    expect(prisma.teachingResource.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { teacherOnly: false },
      orderBy: [
        { category: 'asc' },
        { displayOrder: 'asc' },
        { updatedAt: 'desc' },
      ],
    }));
    expect(resources.map((resource) => resource.id)).toEqual(['modeling']);
  });

  it('keeps teacher-only resources visible for teachers and supports category filters', async () => {
    const [{ getServerSession }, { prisma }, { loadChapterComponentResources }] = await Promise.all([
      import('next-auth'),
      import('@/lib/prisma'),
      import('../chapter-component-resources'),
    ]);

    vi.mocked(getServerSession).mockResolvedValue({ user: { role: 'TEACHER' } });

    await loadChapterComponentResources('SYSTEM_MODELING');

    expect(prisma.teachingResource.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { category: 'SYSTEM_MODELING' },
      orderBy: [
        { category: 'asc' },
        { displayOrder: 'asc' },
        { updatedAt: 'desc' },
      ],
    }));
  });
});
