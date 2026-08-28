import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  prisma: {
    teachingResource: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
  getServerSession: vi.fn(),
  resolveStudentVisibleIndexedResource: vi.fn(),
  rethrowIfNextDynamicError: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: mocks.prisma,
}));

vi.mock('next-auth', () => ({
  getServerSession: mocks.getServerSession,
}));

vi.mock('@/lib/auth', () => ({
  authOptions: {},
}));

vi.mock('@/features/knowledge/resource-index/public-api', () => ({
  resolveStudentVisibleIndexedResource: mocks.resolveStudentVisibleIndexedResource,
}));

vi.mock('@/lib/nextjs-dynamic-error', () => ({
  rethrowIfNextDynamicError: mocks.rethrowIfNextDynamicError,
}));

import { GET } from '../../app/api/resources/[id]/route';

function params(id: string) {
  return { params: Promise.resolve({ id }) };
}

function indexed(overrides: Record<string, unknown> = {}) {
  return {
    id: 'lesson14-three-band-studio',
    title: '三频段调优工作台',
    description: null,
    type: 'INTERACTIVE_COMP',
    content: null,
    registryId: 'lesson14-three-band-studio',
    category: null,
    displayName: '三频段调优工作台',
    displayOrder: 0,
    teacherOnly: false,
    config: { mode: 'three-band' },
    aiHints: null,
    authorId: 'resource-registry',
    createdAt: '1970-01-01T00:00:00.000Z',
    updatedAt: '1970-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('GET /api/resources/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns the persisted TeachingResource when it exists', async () => {
    const persisted = {
      id: 'db-resource',
      title: '数据库资源',
      type: 'INTERACTIVE_COMP',
      registryId: 'lesson12-bode-post-quiz',
      content: null,
      category: null,
      displayName: null,
      description: null,
      displayOrder: 0,
      teacherOnly: false,
      config: {},
      aiHints: null,
      authorId: 'teacher-1',
      createdAt: new Date('2026-06-20T00:00:00.000Z'),
      updatedAt: new Date('2026-06-20T00:00:00.000Z'),
    };
    mocks.prisma.teachingResource.findUnique.mockResolvedValue(persisted);

    const response = await GET(new Request('http://localhost/api/resources/db-resource'), params('db-resource'));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      id: 'db-resource',
      registryId: 'lesson12-bode-post-quiz',
      title: '数据库资源',
    });
    expect(mocks.resolveStudentVisibleIndexedResource).not.toHaveBeenCalled();
  });

  it('falls back to the generated registry index so registry path nodes are executable', async () => {
    mocks.prisma.teachingResource.findUnique.mockResolvedValue(null);
    mocks.resolveStudentVisibleIndexedResource.mockReturnValue(indexed());

    const response = await GET(
      new Request('http://localhost/api/resources/lesson14-three-band-studio'),
      params('lesson14-three-band-studio'),
    );
    const payload = await response.json();

    expect(mocks.resolveStudentVisibleIndexedResource).toHaveBeenCalledWith('lesson14-three-band-studio');
    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      id: 'lesson14-three-band-studio',
      title: '三频段调优工作台',
      displayName: '三频段调优工作台',
      type: 'INTERACTIVE_COMP',
      registryId: 'lesson14-three-band-studio',
      teacherOnly: false,
      config: { mode: 'three-band' },
    });
  });

  it('does not expose teacher-only registered resources through student fallback', async () => {
    mocks.prisma.teachingResource.findUnique.mockResolvedValue(null);
    mocks.resolveStudentVisibleIndexedResource.mockReturnValue(null);

    const response = await GET(new Request('http://localhost/api/resources/classroom-video'), params('classroom-video'));
    const payload = await response.json();

    expect(response.status).toBe(404);
    expect(payload).toEqual({ error: 'Resource not found' });
  });

  it('does not expose archived registered resources through student fallback', async () => {
    mocks.prisma.teachingResource.findUnique.mockResolvedValue(null);
    mocks.resolveStudentVisibleIndexedResource.mockReturnValue(null);

    const response = await GET(
      new Request('http://localhost/api/resources/lesson02-legacy-pretest-v1'),
      params('lesson02-legacy-pretest-v1'),
    );
    const payload = await response.json();

    expect(response.status).toBe(404);
    expect(payload).toEqual({ error: 'Resource not found' });
  });

  it('does not expose teacher-scoped registered resources through student fallback', async () => {
    mocks.prisma.teachingResource.findUnique.mockResolvedValue(null);
    mocks.resolveStudentVisibleIndexedResource.mockReturnValue(null);

    const response = await GET(new Request('http://localhost/api/resources/teacher-scope-resource'), params('teacher-scope-resource'));
    const payload = await response.json();

    expect(response.status).toBe(404);
    expect(payload).toEqual({ error: 'Resource not found' });
  });

  it('does not expose teacher-assigned registered resources without assignment context', async () => {
    mocks.prisma.teachingResource.findUnique.mockResolvedValue(null);
    mocks.resolveStudentVisibleIndexedResource.mockReturnValue(null);

    const response = await GET(new Request('http://localhost/api/resources/ten-drops-game-v1'), params('ten-drops-game-v1'));
    const payload = await response.json();

    expect(response.status).toBe(404);
    expect(payload).toEqual({ error: 'Resource not found' });
  });

  it('returns 404 when neither database nor index contains the resource', async () => {
    mocks.prisma.teachingResource.findUnique.mockResolvedValue(null);
    mocks.resolveStudentVisibleIndexedResource.mockReturnValue(null);

    const response = await GET(new Request('http://localhost/api/resources/missing'), params('missing'));
    const payload = await response.json();

    expect(response.status).toBe(404);
    expect(payload).toEqual({ error: 'Resource not found' });
  });
});
