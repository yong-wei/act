import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getServerSession: vi.fn(),
  prisma: {
    user: { findUnique: vi.fn() },
    knowledgeNode: { findMany: vi.fn() },
    lessonPlan: { create: vi.fn() },
  },
}));

vi.mock('next-auth', () => ({
  getServerSession: mocks.getServerSession,
}));

vi.mock('@/lib/auth', () => ({
  authOptions: {},
}));

vi.mock('@/lib/prisma', () => ({
  prisma: mocks.prisma,
}));

import { POST } from '@/app/api/knowledge/playlists/route';

describe('POST /api/knowledge/playlists', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getServerSession.mockResolvedValue({ user: { id: 'teacher-1' } });
    mocks.prisma.user.findUnique.mockResolvedValue({ id: 'teacher-1' });
    mocks.prisma.knowledgeNode.findMany.mockResolvedValue([
      { id: 'kn-bode', name: '伯德图', description: '频域响应工具' },
      { id: 'kn-root', name: '根轨迹', description: '根轨迹规则' },
    ]);
    mocks.prisma.lessonPlan.create.mockResolvedValue({
      id: 'playlist-1',
      title: '频域课程流',
      _count: { items: 2 },
    });
  });

  it('creates LessonItem records for selected knowledge nodes', async () => {
    const response = await POST(new Request('http://localhost/api/knowledge/playlists', {
      method: 'POST',
      body: JSON.stringify({
        title: '频域课程流',
        description: '从知识节点编排',
        isPublic: true,
        items: [
          { nodeId: 'kn-bode', nodeName: '伯德图', duration: 12, interactionMode: 'lecture' },
          { nodeId: 'kn-root', nodeName: '根轨迹', duration: 18, interactionMode: 'quiz' },
        ],
      }),
    }));

    expect(response.status).toBe(200);
    expect(mocks.prisma.knowledgeNode.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: { in: ['kn-bode', 'kn-root'] }, isActive: true },
    }));
    expect(mocks.prisma.lessonPlan.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        title: '频域课程流',
        authorId: 'teacher-1',
        isPublic: true,
        items: {
          create: [
            expect.objectContaining({
              itemType: 'KNOWLEDGE_NODE',
              knowledgeNodeId: 'kn-bode',
              stage: 'PARTICIPATORY',
              order: 1,
              duration: 12,
            }),
            expect.objectContaining({
              itemType: 'KNOWLEDGE_NODE',
              knowledgeNodeId: 'kn-root',
              stage: 'PARTICIPATORY',
              order: 2,
              duration: 18,
            }),
          ],
        },
      }),
    }));
  });

  it('rejects saving an empty course flow', async () => {
    const response = await POST(new Request('http://localhost/api/knowledge/playlists', {
      method: 'POST',
      body: JSON.stringify({ title: '空课程流', items: [] }),
    }));
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.error).toContain('至少选择一个知识节点');
    expect(mocks.prisma.lessonPlan.create).not.toHaveBeenCalled();
  });
});
