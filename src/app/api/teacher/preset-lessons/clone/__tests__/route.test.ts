import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getServerSession: vi.fn(),
  prisma: {
    user: {
      findUnique: vi.fn(),
    },
    knowledgeNode: {
      findUnique: vi.fn(),
    },
    teachingResource: {
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    lessonPlan: {
      create: vi.fn(),
    },
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

vi.mock('@/features/teacher/preset-lessons', () => ({
  ALL_PRESETS: [
    {
      key: 'unit-1-4-time-frequency-views-v1',
      title: '资源模板',
      description: '包含资源与知识节点',
      totalDuration: 12,
      tags: [],
      items: [
        {
          itemType: 'RESOURCE',
          runtimeStepId: 'step-01',
          stage: 'BRIDGE_IN',
          order: 1,
          duration: 5,
          registryId: 'registry-resource',
          resourceType: 'INTERACTIVE_COMP',
          title: '资源环节',
          description: '资源描述',
          config: { level: 'intro' },
        },
        {
          itemType: 'KNOWLEDGE_NODE',
          stage: 'PARTICIPATORY',
          order: 1,
          duration: 7,
          knowledgeNodeId: 'knowledge-node-1',
          title: '知识环节',
          description: '知识描述',
        },
      ],
    },
  ],
}));

import { GET, POST } from '../route';

function postRequest(body: unknown) {
  return new Request('http://localhost/api/teacher/preset-lessons/clone', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('/api/teacher/preset-lessons/clone', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getServerSession.mockResolvedValue({ user: { id: 'teacher-1' } });
    mocks.prisma.user.findUnique.mockResolvedValue({ id: 'teacher-1' });
    mocks.prisma.knowledgeNode.findUnique.mockResolvedValue({ id: 'knowledge-node-1' });
    mocks.prisma.teachingResource.findFirst.mockResolvedValue(null);
    mocks.prisma.teachingResource.create.mockResolvedValue({
      id: 'resource-1',
      registryId: 'registry-resource',
    });
    mocks.prisma.lessonPlan.create.mockResolvedValue({
      id: 'lesson-plan-1',
      items: [],
    });
  });

  it('returns a product recovery response for direct visits', async () => {
    const response = await GET();
    const payload = await response.json();

    expect(response.status).toBe(405);
    expect(response.headers.get('allow')).toBe('POST');
    expect(payload).toEqual({
      error: '请在预置教案页面选择“使用模板”来克隆教案。',
      recoveryHref: '/teacher/preset-lessons',
      method: 'POST',
    });
  });

  it('materializes registry resources before creating lesson items', async () => {
    const response = await POST(postRequest({ presetKey: 'unit-1-4-time-frequency-views-v1' }));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.lessonPlanId).toBe('lesson-plan-1');
    expect(mocks.prisma.teachingResource.create).toHaveBeenCalledWith({
      data: {
        title: '资源环节',
        description: '资源描述',
        type: 'INTERACTIVE_COMP',
        registryId: 'registry-resource',
        config: { level: 'intro' },
        authorId: 'teacher-1',
      },
    });

    const lessonPlanCreateInput = mocks.prisma.lessonPlan.create.mock.calls[0][0];
    expect(lessonPlanCreateInput.data.items.create).toEqual([
      expect.objectContaining({
        itemType: 'RESOURCE',
        resourceId: 'resource-1',
        stage: 'BRIDGE_IN',
        order: 1,
        overrideConfig: expect.objectContaining({
          __presetRuntimeBinding: {
            schemaVersion: 'preset-runtime-step-binding-v1',
            sourcePresetKey: 'unit-1-4-time-frequency-views-v1',
            runtimeLessonId: '1-4',
            runtimeStepId: 'step-01',
          },
        }),
      }),
      expect.objectContaining({
        itemType: 'KNOWLEDGE_NODE',
        knowledgeNodeId: 'knowledge-node-1',
        stage: 'PARTICIPATORY',
        order: 1,
      }),
    ]);
  });
});
