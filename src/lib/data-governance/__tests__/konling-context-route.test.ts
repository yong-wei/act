import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getServerSession: vi.fn(),
  readAdaptiveLearnerState: vi.fn(),
  isAdaptiveLearnerStateServiceEnabled: vi.fn(),
  prisma: {
    class: {
      findUnique: vi.fn(),
    },
    studentProfile: {
      findFirst: vi.fn(),
    },
    studentProfileSummary: {
      findUnique: vi.fn(),
    },
    studentCompetencySnapshot: {
      findFirst: vi.fn(),
    },
    knowledgeNode: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock('server-only', () => ({}));

vi.mock('next-auth', () => ({
  getServerSession: mocks.getServerSession,
}));

vi.mock('@/lib/auth', () => ({
  authOptions: {},
}));

vi.mock('@/lib/prisma', () => ({
  prisma: mocks.prisma,
}));

vi.mock('@/lib/data-governance/adaptive-learner-state-service', async () => {
  const actual = await vi.importActual<typeof import('@/lib/data-governance/adaptive-learner-state-service')>(
    '@/lib/data-governance/adaptive-learner-state-service',
  );
  return {
    ...actual,
    isAdaptiveLearnerStateServiceEnabled: mocks.isAdaptiveLearnerStateServiceEnabled,
    readAdaptiveLearnerState: mocks.readAdaptiveLearnerState,
  };
});

import { GET } from '@/app/api/ai/konling-context/route';

function request(url = 'http://localhost/api/ai/konling-context') {
  return GET(new Request(url) as Parameters<typeof GET>[0]);
}

describe('Konling context route learner-state integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.isAdaptiveLearnerStateServiceEnabled.mockReturnValue(true);
    mocks.getServerSession.mockResolvedValue({
      user: { id: 'student-1', role: 'STUDENT' },
    });
    mocks.readAdaptiveLearnerState.mockResolvedValue({
      userId: 'student-1',
      authority: 'server-owned',
      primaryPortraitState: 'SNAPSHOT',
      primaryPortraitAvailability: 'available',
      primaryCompetencies: {
        source: 'latest-snapshot',
      },
    });
    mocks.prisma.studentProfileSummary.findUnique.mockResolvedValue({
      overallLevel: '良好',
      overallScore: 72,
      strengthsJson: ['控制建模'],
      weaknessesJson: ['跨域迁移'],
      recentTrend: '稳定提升',
      trendDirection: 'up',
      riskFlagsJson: [],
      riskLevel: 'none',
      recommendedScaffolding: '继续完成路径任务',
    });
    mocks.prisma.studentCompetencySnapshot.findFirst.mockResolvedValue({
      competencyVector: { controlModeling: { score: 72 } },
    });
    mocks.prisma.knowledgeNode.findMany.mockResolvedValue([]);
    mocks.prisma.class.findUnique.mockResolvedValue({
      id: 'class-1',
      teacherId: 'teacher-1',
    });
    mocks.prisma.studentProfile.findFirst.mockResolvedValue({
      userId: 'student-1',
      classId: 'class-1',
    });
  });

  it('returns server-owned learner state context for Konling when enabled', async () => {
    const response = await request();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mocks.readAdaptiveLearnerState).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        userId: 'student-1',
        role: 'student',
        portraitConsumer: 'konling',
      }),
    );
    expect(mocks.readAdaptiveLearnerState.mock.calls.every(([, input]) =>
      input.portraitConsumer === 'konling')).toBe(true);
    expect(body.learner_state_context).toMatchObject({
      authority: 'server-owned',
      primaryPortraitState: 'SNAPSHOT',
      primaryPortraitAvailability: 'available',
      primaryCompetencies: {
        source: 'latest-snapshot',
      },
    });
  });

  it('returns the legacy competency vector only when learner state has a trusted snapshot portrait', async () => {
    const response = await request();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mocks.prisma.studentCompetencySnapshot.findFirst).toHaveBeenCalledTimes(1);
    expect(body.competency_vector).toEqual({ controlModeling: { score: 72 } });
  });

  it('blocks legacy competency vector fallback when learner state is NO_EVIDENCE', async () => {
    mocks.readAdaptiveLearnerState.mockResolvedValue({
      userId: 'student-1',
      authority: 'server-owned',
      primaryPortraitState: 'NO_EVIDENCE',
      primaryPortraitAvailability: 'no-trusted-evidence',
      primaryCompetencies: {
        source: 'latest-snapshot',
        vector: { controlModeling: { score: 72 } },
      },
    });

    const response = await request();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mocks.prisma.studentCompetencySnapshot.findFirst).not.toHaveBeenCalled();
    expect(body.competency_vector).toBeNull();
    expect(body.learner_state_context).toMatchObject({
      primaryPortraitState: 'NO_EVIDENCE',
      primaryPortraitAvailability: 'no-trusted-evidence',
    });
  });

  it('requires class scope before a teacher reads another student context', async () => {
    mocks.getServerSession.mockResolvedValue({
      user: { id: 'teacher-1', role: 'TEACHER' },
    });

    const response = await request('http://localhost/api/ai/konling-context?userId=student-1');
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toContain('classId');
    expect(mocks.readAdaptiveLearnerState).not.toHaveBeenCalled();
  });

  it('allows a teacher to read their own context without class scope', async () => {
    mocks.getServerSession.mockResolvedValue({
      user: { id: 'teacher-1', role: 'TEACHER' },
    });
    mocks.readAdaptiveLearnerState.mockResolvedValue({
      userId: 'teacher-1',
      authority: 'server-owned',
      primaryCompetencies: {
        source: 'latest-snapshot',
      },
    });

    const response = await request();

    expect(response.status).toBe(200);
    expect(mocks.prisma.class.findUnique).not.toHaveBeenCalled();
    expect(mocks.prisma.studentProfile.findFirst).not.toHaveBeenCalled();
    expect(mocks.readAdaptiveLearnerState).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        userId: 'teacher-1',
        role: 'teacher',
        classId: null,
      }),
    );
    expect(mocks.readAdaptiveLearnerState.mock.calls.every(([, input]) =>
      input.portraitConsumer === 'konling')).toBe(true);
  });

  it('allows teacher reads only for students in the teacher class', async () => {
    mocks.getServerSession.mockResolvedValue({
      user: { id: 'teacher-1', role: 'TEACHER' },
    });

    const response = await request('http://localhost/api/ai/konling-context?userId=student-1&classId=class-1');

    expect(response.status).toBe(200);
    expect(mocks.prisma.class.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'class-1' },
      }),
    );
    expect(mocks.prisma.studentProfile.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId: 'student-1',
          classId: 'class-1',
        },
      }),
    );
    expect(mocks.readAdaptiveLearnerState).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        userId: 'student-1',
        role: 'teacher',
        classId: 'class-1',
        portraitConsumer: 'konling',
      }),
    );
  });

  it('rejects teacher reads for classes owned by another teacher', async () => {
    mocks.getServerSession.mockResolvedValue({
      user: { id: 'teacher-1', role: 'TEACHER' },
    });
    mocks.prisma.class.findUnique.mockResolvedValue({
      id: 'class-2',
      teacherId: 'teacher-2',
    });

    const response = await request('http://localhost/api/ai/konling-context?userId=student-1&classId=class-2');

    expect(response.status).toBe(403);
    expect(mocks.readAdaptiveLearnerState).not.toHaveBeenCalled();
  });

  it('returns server-owned knowledge workspace context for a selected resource node', async () => {
    mocks.prisma.knowledgeNode.findMany.mockResolvedValue([
      {
        id: 'node-second-order',
        name: '二阶系统标准型',
        nodeType: 'THEORY',
        description: '二阶系统传递函数标准形式',
        metadata: { chapterName: '时域分析' },
        knowledgeDim: 'CONCEPTUAL',
        tags: ['二阶系统', '标准型'],
      },
    ]);

    const response = await request(
      'http://localhost/api/ai/konling-context?pageId=/knowledge&selectedNodeId=node-second-order&activeFilters=关系%202/6&densityMode=focused&viewMode=2D&visibleRelationCount=7&selectedNodeRelationCount=3'
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mocks.prisma.knowledgeNode.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          isActive: true,
          id: { in: ['node-second-order'] },
        },
      }),
    );
    expect(body.knowledge_workspace_context).toMatchObject({
      source: 'server-owned',
      route: '/knowledge',
      status: 'selected-node',
      selected_node: {
        id: 'node-second-order',
        name: '二阶系统标准型',
        node_type: 'THEORY',
        chapter: '时域分析',
      },
      relation_summary: {
        density_mode: 'focused',
        view_mode: '2D',
        active_filters: ['关系 2/6'],
        visible_relation_count: 7,
        selected_node_relation_count: 3,
      },
      available_learning_actions: ['open-knowledge-card', 'search-related-resources', 'continue-learning-path'],
    });
    expect(body.missing_context).not.toContain('knowledge-workspace-selected-node-missing');
  });

  it('keeps the legacy selectedRelationCount query parameter compatible', async () => {
    mocks.prisma.knowledgeNode.findMany.mockResolvedValue([
      {
        id: 'node-second-order',
        name: '二阶系统标准型',
        nodeType: 'THEORY',
        description: '二阶系统传递函数标准形式',
        metadata: { chapterName: '时域分析' },
        knowledgeDim: 'CONCEPTUAL',
        tags: ['二阶系统', '标准型'],
      },
    ]);

    const response = await request(
      'http://localhost/api/ai/konling-context?pageId=/knowledge&selectedNodeId=node-second-order&selectedRelationCount=5'
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.knowledge_workspace_context.relation_summary.selected_node_relation_count).toBe(5);
  });

  it('keeps degraded requested knowledge nodes unresolved instead of upgrading them to selected context', async () => {
    mocks.prisma.knowledgeNode.findMany.mockResolvedValue([
      {
        id: 'node-second-order',
        name: '二阶系统标准型',
        nodeType: 'THEORY',
        description: '二阶系统传递函数标准形式',
        metadata: { chapterName: '时域分析' },
        knowledgeDim: 'CONCEPTUAL',
        tags: ['二阶系统', '标准型'],
      },
    ]);

    const response = await request(
      'http://localhost/api/ai/konling-context?pageId=/knowledge&requestedNodeId=node-second-order&status=degraded'
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mocks.prisma.knowledgeNode.findMany).not.toHaveBeenCalled();
    expect(body.knowledge_workspace_context).toMatchObject({
      source: 'server-owned',
      route: '/knowledge',
      status: 'degraded',
      selected_node: null,
    });
    expect(body.missing_context).toContain('knowledge-workspace-selected-node-unresolved');
  });

  it('keeps contradictory degraded selected-node hints unresolved', async () => {
    mocks.prisma.knowledgeNode.findMany.mockResolvedValue([
      {
        id: 'node-second-order',
        name: '二阶系统标准型',
        nodeType: 'THEORY',
        description: '二阶系统传递函数标准形式',
        metadata: { chapterName: '时域分析' },
        knowledgeDim: 'CONCEPTUAL',
        tags: ['二阶系统', '标准型'],
      },
    ]);

    const response = await request(
      'http://localhost/api/ai/konling-context?pageId=/knowledge&selectedNodeId=node-second-order&status=degraded'
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mocks.prisma.knowledgeNode.findMany).not.toHaveBeenCalled();
    expect(body.knowledge_workspace_context).toMatchObject({
      source: 'server-owned',
      route: '/knowledge',
      status: 'degraded',
      selected_node: null,
    });
    expect(body.missing_context).toContain('knowledge-workspace-selected-node-unresolved');
  });

  it('keeps hover previews out of durable knowledge workspace context', async () => {
    const response = await request(
      'http://localhost/api/ai/konling-context?pageId=/knowledge&hoveredNodeId=node-hover&activeFilters=未启用额外筛选'
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mocks.prisma.knowledgeNode.findMany).not.toHaveBeenCalled();
    expect(body.knowledge_workspace_context).toMatchObject({
      source: 'server-owned',
      route: '/knowledge',
      status: 'no-selection',
      selected_node: null,
      hover_policy: 'preview-only-not-durable-context',
    });
    expect(body.missing_context).toContain('knowledge-workspace-selected-node-missing');
  });
});
