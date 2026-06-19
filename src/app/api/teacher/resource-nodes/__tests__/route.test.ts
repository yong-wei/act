import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const getServerSession = vi.fn();
  const teachingResourceFindMany = vi.fn();

  return {
    getServerSession,
    prisma: {
      teachingResource: {
        findMany: teachingResourceFindMany,
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

import { GET } from '../route';

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
    resourceNodePlanning: {
      teacherPolicy: 'teacher-assigned',
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

describe('GET /api/teacher/resource-nodes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getServerSession.mockResolvedValue({
      user: { id: 'teacher-1', role: 'TEACHER' },
    });
    mocks.prisma.teachingResource.findMany.mockResolvedValue([ownedResource]);
  });

  it('rejects non-teacher users', async () => {
    mocks.getServerSession.mockResolvedValue({
      user: { id: 'student-1', role: 'STUDENT' },
    });

    const response = await GET(new Request('http://localhost/api/teacher/resource-nodes'));

    expect(response.status).toBe(403);
    expect(mocks.prisma.teachingResource.findMany).not.toHaveBeenCalled();
  });

  it('lists filtered teacher-scoped ResourceNodes with warning-safe view models', async () => {
    const response = await GET(
      new Request('http://localhost/api/teacher/resource-nodes?nodeType=quiz&teacherPolicy=teacher-assigned')
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(mocks.prisma.teachingResource.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { authorId: 'teacher-1' },
      include: expect.objectContaining({
        knowledgeNodes: expect.any(Object),
      }),
    }));
    expect(payload.summary).toMatchObject({
      totalNodes: 1,
      pathEligibleNodes: 1,
    });
    expect(payload.nodes).toEqual([
      expect.objectContaining({
        id: 'teaching-resource:owned-quiz',
        editable: true,
        teacherPolicy: 'teacher-assigned',
        evidenceInstrumentationConfigured: true,
      }),
    ]);
    expect(JSON.stringify(payload)).not.toContain('abilityImpact');
    expect(JSON.stringify(payload)).not.toContain('terminalConstraints');
  });

  it('includes system registered resources when they are registered', async () => {
    const response = await GET(
      new Request('http://localhost/api/teacher/resource-nodes?q=注册后测组件')
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.nodes).toEqual([
      expect.objectContaining({
        id: 'registry:registered-quiz',
        title: '注册后测组件',
        editable: false,
      }),
    ]);
  });

  it('includes knowledge cards and filters by course/module metadata', async () => {
    const response = await GET(new Request('http://localhost/api/teacher/resource-nodes'));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.nodes).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'knowledge-node:kn-bode',
        courseModule: 'frequency',
        editable: false,
      }),
      expect.objectContaining({
        id: 'knowledge-card:kn-bode',
        courseModule: 'frequency',
        editable: false,
      }),
      expect.objectContaining({
        id: 'teaching-resource:owned-quiz',
        courseModule: 'FREQUENCY_DOMAIN',
        editable: true,
      }),
    ]));

    const moduleResponse = await GET(
      new Request('http://localhost/api/teacher/resource-nodes?courseModule=FREQUENCY_DOMAIN')
    );
    const modulePayload = await moduleResponse.json();
    expect(modulePayload.nodes.map((node: { id: string }) => node.id)).toEqual(['teaching-resource:owned-quiz']);
  });

  it('filters path eligibility using high-confidence audit readiness', async () => {
    mocks.prisma.teachingResource.findMany.mockResolvedValue([
      {
        ...ownedResource,
        config: {
          resourceNodePlanning: {
            abilityImpact: {},
            evidenceInstrumentation: [],
          },
        },
      },
    ]);

    const eligibleResponse = await GET(
      new Request('http://localhost/api/teacher/resource-nodes?pathEligibility=eligible')
    );
    const eligiblePayload = await eligibleResponse.json();
    const excludedResponse = await GET(
      new Request('http://localhost/api/teacher/resource-nodes?pathEligibility=excluded')
    );
    const excludedPayload = await excludedResponse.json();

    expect(eligibleResponse.status).toBe(200);
    expect(eligiblePayload.nodes.map((node: { id: string }) => node.id)).not.toContain('teaching-resource:owned-quiz');
    expect(eligiblePayload.nodes).toEqual([
      expect.objectContaining({ id: 'registry:registered-quiz' }),
    ]);
    expect(excludedPayload.nodes).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'teaching-resource:owned-quiz',
        pathEligible: true,
        audit: expect.objectContaining({
          pathEligible: false,
          exclusionReasons: expect.arrayContaining([
            'missing-capability-mapping',
            'missing-evidence-instrumentation',
          ]),
        }),
      }),
    ]));
  });
});
