import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const getServerSession = vi.fn();
  const teachingResourceFindFirst = vi.fn();
  const teachingResourceFindMany = vi.fn();
  const teachingResourceUpdate = vi.fn();

  return {
    getServerSession,
    prisma: {
      teachingResource: {
        findFirst: teachingResourceFindFirst,
        findMany: teachingResourceFindMany,
        update: teachingResourceUpdate,
      },
    },
  };
});

vi.mock('next-auth', () => ({
  getServerSession: mocks.getServerSession,
}));

vi.mock('@/lib/auth', () => ({
  authOptions: {},
}));

vi.mock('@/lib/prisma', () => ({
  prisma: mocks.prisma,
}));

vi.mock('@/lib/resource-registry-metadata', () => ({
  getAllRegisteredResourceMetadata: () => [
    {
      id: 'registered-quiz',
      label: '注册后测组件',
      type: 'INTERACTIVE_COMP',
      renderTarget: '/interactive-learning/resources/registered-quiz',
      knowledgeNodeIds: ['kn-bode'],
    },
  ],
}));

import { PATCH } from '../route';

const ownedResource = {
  id: 'owned-quiz',
  title: 'Bode 后测',
  displayName: null,
  description: '频域后测',
  type: 'INTERACTIVE_COMP',
  registryId: 'lesson12-bode-post-quiz',
  content: null,
  category: 'FREQUENCY_DOMAIN',
  teacherOnly: false,
  config: {
    existing: true,
    resourceNodePlanning: {
      estimatedTimeMinutes: 18,
    },
  },
  knowledgeNodes: [
    {
      id: 'kn-bode',
      name: '伯德图',
      resources: [],
      tags: ['frequency'],
    },
  ],
};

const prerequisiteResource = {
  id: 'owned-prerequisite',
  title: '前置资源',
  displayName: null,
  description: null,
  type: 'STATIC_TEXT',
  registryId: null,
  content: '前置内容',
  category: 'FREQUENCY_DOMAIN',
  teacherOnly: false,
  config: {},
  knowledgeNodes: [
    {
      id: 'kn-bode',
      name: '伯德图',
      resources: [],
      tags: ['frequency'],
    },
  ],
};

describe('PATCH /api/teacher/resource-nodes/[nodeId]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getServerSession.mockResolvedValue({
      user: { id: 'teacher-1', role: 'TEACHER' },
    });
    mocks.prisma.teachingResource.findFirst.mockResolvedValue(ownedResource);
    mocks.prisma.teachingResource.findMany.mockResolvedValue([ownedResource, prerequisiteResource]);
    mocks.prisma.teachingResource.update.mockResolvedValue({
      ...ownedResource,
      displayName: '课堂使用的 Bode 后测',
      description: '用于频域单元。',
      config: {
        existing: true,
        resourceNodePlanning: {
          estimatedTimeMinutes: 20,
          teacherPolicy: 'blocked',
          knowledgeCoverage: ['kn-bode', 'kn-frequency-response'],
        },
      },
    });
  });

  it('allows pathEligible=true to clear a blocked teacher policy', async () => {
    mocks.prisma.teachingResource.findFirst.mockResolvedValue({
      ...ownedResource,
      config: {
        resourceNodePlanning: {
          teacherPolicy: 'blocked',
        },
      },
    });
    mocks.prisma.teachingResource.findMany.mockResolvedValue([
      {
        ...ownedResource,
        config: {
          resourceNodePlanning: {
            teacherPolicy: 'blocked',
          },
        },
      },
    ]);
    mocks.prisma.teachingResource.update.mockResolvedValue({
      ...ownedResource,
      config: {
        resourceNodePlanning: {
          teacherPolicy: 'allowed',
        },
      },
    });

    const response = await PATCH(
      new Request('http://localhost/api/teacher/resource-nodes/teaching-resource%3Aowned-quiz', {
        method: 'PATCH',
        body: JSON.stringify({
          planningMetadata: {
            teacherPolicy: 'blocked',
            pathEligible: true,
          },
        }),
      }),
      { params: Promise.resolve({ nodeId: 'teaching-resource:owned-quiz' }) }
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(mocks.prisma.teachingResource.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        config: {
          resourceNodePlanning: {
            teacherPolicy: 'allowed',
          },
        },
      }),
    }));
    expect(payload.node).toEqual(expect.objectContaining({
      teacherPolicy: 'allowed',
      pathEligible: true,
    }));
  });

  it('audits patched prerequisites against the full teacher resource scope', async () => {
    mocks.prisma.teachingResource.update.mockResolvedValue({
      ...ownedResource,
      config: {
        resourceNodePlanning: {
          prerequisites: ['teaching-resource:owned-prerequisite'],
        },
      },
    });

    const response = await PATCH(
      new Request('http://localhost/api/teacher/resource-nodes/teaching-resource%3Aowned-quiz', {
        method: 'PATCH',
        body: JSON.stringify({
          planningMetadata: {
            prerequisites: ['teaching-resource:owned-prerequisite'],
          },
        }),
      }),
      { params: Promise.resolve({ nodeId: 'teaching-resource:owned-quiz' }) }
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(mocks.prisma.teachingResource.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { authorId: 'teacher-1' },
    }));
    expect(payload.node).toEqual(expect.objectContaining({
      prerequisites: ['teaching-resource:owned-prerequisite'],
      pathExclusionReasons: [],
    }));
  });

  it('audits patched prerequisites against registered resource nodes', async () => {
    mocks.prisma.teachingResource.update.mockResolvedValue({
      ...ownedResource,
      config: {
        resourceNodePlanning: {
          prerequisites: ['registry:registered-quiz'],
        },
      },
    });

    const response = await PATCH(
      new Request('http://localhost/api/teacher/resource-nodes/teaching-resource%3Aowned-quiz', {
        method: 'PATCH',
        body: JSON.stringify({
          planningMetadata: {
            prerequisites: ['registry:registered-quiz'],
          },
        }),
      }),
      { params: Promise.resolve({ nodeId: 'teaching-resource:owned-quiz' }) }
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.node).toEqual(expect.objectContaining({
      prerequisites: ['registry:registered-quiz'],
      pathExclusionReasons: [],
    }));
  });

  it('persists permitted display and planning metadata into TeachingResource config', async () => {
    const response = await PATCH(
      new Request('http://localhost/api/teacher/resource-nodes/teaching-resource%3Aowned-quiz', {
        method: 'PATCH',
        body: JSON.stringify({
          displayName: '课堂使用的 Bode 后测',
          description: '用于频域单元。',
          planningMetadata: {
            estimatedTimeMinutes: 20,
            knowledgeCoverage: ['kn-frequency-response', 'kn-bode'],
            pathEligible: false,
          },
        }),
      }),
      { params: Promise.resolve({ nodeId: 'teaching-resource:owned-quiz' }) }
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(mocks.prisma.teachingResource.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'owned-quiz', authorId: 'teacher-1' },
    }));
    expect(mocks.prisma.teachingResource.update).toHaveBeenCalledWith({
      where: { id: 'owned-quiz' },
      data: {
        displayName: '课堂使用的 Bode 后测',
        description: '用于频域单元。',
        config: {
          existing: true,
          resourceNodePlanning: {
            estimatedTimeMinutes: 20,
            teacherPolicy: 'blocked',
            knowledgeCoverage: ['kn-bode', 'kn-frequency-response'],
          },
        },
      },
      include: expect.objectContaining({
        knowledgeNodes: expect.any(Object),
      }),
    });
    expect(payload.node).toEqual(expect.objectContaining({
      id: 'teaching-resource:owned-quiz',
      title: '课堂使用的 Bode 后测',
      teacherPolicy: 'blocked',
      pathEligible: false,
      pathExclusionReasons: expect.arrayContaining(['teacher-policy-blocked']),
    }));
  });

  it('rejects immutable fields without updating the resource', async () => {
    const response = await PATCH(
      new Request('http://localhost/api/teacher/resource-nodes/teaching-resource%3Aowned-quiz', {
        method: 'PATCH',
        body: JSON.stringify({
          sourceRef: 'different',
          privateLearnerEvidence: [{ userId: 'student-1' }],
        }),
      }),
      { params: Promise.resolve({ nodeId: 'teaching-resource:owned-quiz' }) }
    );
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload).toMatchObject({
      code: 'IMMUTABLE_RESOURCE_NODE_FIELDS',
    });
    expect(mocks.prisma.teachingResource.update).not.toHaveBeenCalled();
  });

  it('preserves existing description when only planning metadata is submitted', async () => {
    const response = await PATCH(
      new Request('http://localhost/api/teacher/resource-nodes/teaching-resource%3Aowned-quiz', {
        method: 'PATCH',
        body: JSON.stringify({
          planningMetadata: {
            estimatedTimeMinutes: 22,
          },
        }),
      }),
      { params: Promise.resolve({ nodeId: 'teaching-resource:owned-quiz' }) }
    );

    expect(response.status).toBe(200);
    expect(mocks.prisma.teachingResource.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.not.objectContaining({
        description: expect.anything(),
      }),
    }));
  });

  it('rejects resources outside the current teacher scope without revealing details', async () => {
    mocks.prisma.teachingResource.findFirst.mockResolvedValue(null);

    const response = await PATCH(
      new Request('http://localhost/api/teacher/resource-nodes/teaching-resource%3Aforeign-project', {
        method: 'PATCH',
        body: JSON.stringify({
          planningMetadata: { teacherPolicy: 'blocked' },
        }),
      }),
      { params: Promise.resolve({ nodeId: 'teaching-resource:foreign-project' }) }
    );

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({
      code: 'RESOURCE_NODE_FORBIDDEN',
      error: '资源不存在或无权管理。',
    });
    expect(mocks.prisma.teachingResource.update).not.toHaveBeenCalled();
  });
});
