import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  prisma: {
    teachingResource: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
  getServerSession: vi.fn(),
  getRegisteredResourceMetadata: vi.fn(),
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

vi.mock('@/lib/resource-registry-metadata', () => ({
  getRegisteredResourceMetadata: mocks.getRegisteredResourceMetadata,
}));

vi.mock('@/lib/nextjs-dynamic-error', () => ({
  rethrowIfNextDynamicError: mocks.rethrowIfNextDynamicError,
}));

import { GET } from '../../app/api/resources/[id]/route';

function params(id: string) {
  return { params: Promise.resolve({ id }) };
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
    expect(mocks.getRegisteredResourceMetadata).not.toHaveBeenCalled();
  });

  it('falls back to registered resource metadata so registry path nodes are executable', async () => {
    mocks.prisma.teachingResource.findUnique.mockResolvedValue(null);
    mocks.getRegisteredResourceMetadata.mockReturnValue({
      id: 'lesson14-three-band-studio',
      label: '三频段调优工作台',
      type: 'INTERACTIVE_COMP',
      defaultConfig: { mode: 'three-band' },
      planningOverride: {
        teacherPolicy: 'allowed',
        privacyLevel: 'student-visible',
      },
    });

    const response = await GET(
      new Request('http://localhost/api/resources/lesson14-three-band-studio'),
      params('lesson14-three-band-studio')
    );
    const payload = await response.json();

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
    mocks.getRegisteredResourceMetadata.mockReturnValue({
      id: 'classroom-video',
      label: '视频播放组件',
      type: 'INTERACTIVE_COMP',
      planningOverride: {
        teacherPolicy: 'teacher-only',
        privacyLevel: 'teacher-scoped',
      },
    });

    const response = await GET(new Request('http://localhost/api/resources/classroom-video'), params('classroom-video'));
    const payload = await response.json();

    expect(response.status).toBe(404);
    expect(payload).toEqual({ error: 'Resource not found' });
  });

  it('does not expose archived registered resources through student fallback', async () => {
    mocks.prisma.teachingResource.findUnique.mockResolvedValue(null);
    mocks.getRegisteredResourceMetadata.mockReturnValue({
      id: 'lesson02-legacy-pretest-v1',
      label: '旧版前测',
      type: 'INTERACTIVE_COMP',
      planningOverride: {
        teacherPolicy: 'blocked',
        availability: 'archived',
      },
    });

    const response = await GET(
      new Request('http://localhost/api/resources/lesson02-legacy-pretest-v1'),
      params('lesson02-legacy-pretest-v1')
    );
    const payload = await response.json();

    expect(response.status).toBe(404);
    expect(payload).toEqual({ error: 'Resource not found' });
  });

  it('does not expose teacher-scoped registered resources through student fallback', async () => {
    mocks.prisma.teachingResource.findUnique.mockResolvedValue(null);
    mocks.getRegisteredResourceMetadata.mockReturnValue({
      id: 'teacher-scope-resource',
      label: '教师范围资源',
      type: 'INTERACTIVE_COMP',
      planningOverride: {
        teacherPolicy: 'allowed',
        privacyLevel: 'teacher-scoped',
      },
    });

    const response = await GET(
      new Request('http://localhost/api/resources/teacher-scope-resource'),
      params('teacher-scope-resource')
    );
    const payload = await response.json();

    expect(response.status).toBe(404);
    expect(payload).toEqual({ error: 'Resource not found' });
  });

  it('does not expose teacher-assigned registered resources without assignment context', async () => {
    mocks.prisma.teachingResource.findUnique.mockResolvedValue(null);
    mocks.getRegisteredResourceMetadata.mockReturnValue({
      id: 'ten-drops-game-v1',
      label: '十滴水',
      type: 'INTERACTIVE_COMP',
      planningOverride: {
        teacherPolicy: 'teacher-assigned',
        privacyLevel: 'student-visible',
      },
    });

    const response = await GET(new Request('http://localhost/api/resources/ten-drops-game-v1'), params('ten-drops-game-v1'));
    const payload = await response.json();

    expect(response.status).toBe(404);
    expect(payload).toEqual({ error: 'Resource not found' });
  });

  it('returns 404 when neither database nor registry contains the resource', async () => {
    mocks.prisma.teachingResource.findUnique.mockResolvedValue(null);
    mocks.getRegisteredResourceMetadata.mockReturnValue(undefined);

    const response = await GET(new Request('http://localhost/api/resources/missing'), params('missing'));
    const payload = await response.json();

    expect(response.status).toBe(404);
    expect(payload).toEqual({ error: 'Resource not found' });
  });
});
