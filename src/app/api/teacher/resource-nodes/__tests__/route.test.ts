import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const getServerSession = vi.fn();
  const teachingResourceFindMany = vi.fn();
  const loadAllLessonRuntimeResourceCatalogEntries = vi.fn();
  const loadAllTextbookStructureRuntimeCatalogEntries = vi.fn();
  const loadRuntimeResourceProjectionInputs = vi.fn();

  return {
    getServerSession,
    loadAllLessonRuntimeResourceCatalogEntries,
    loadAllTextbookStructureRuntimeCatalogEntries,
    loadRuntimeResourceProjectionInputs,
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

vi.mock('@/lib/course-bundle', () => ({
  loadAllLessonRuntimeResourceCatalogEntries: mocks.loadAllLessonRuntimeResourceCatalogEntries,
  loadAllTextbookStructureRuntimeCatalogEntries: mocks.loadAllTextbookStructureRuntimeCatalogEntries,
}));

vi.mock('@/lib/teacher-resource-node-data', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/teacher-resource-node-data')>();
  return {
    ...actual,
    loadRuntimeResourceProjectionInputs: mocks.loadRuntimeResourceProjectionInputs,
  };
});

vi.mock('@/lib/resource-registry-metadata', () => ({
  getAllRegisteredResourceMetadata: () => [
    {
      id: 'registered-quiz',
      label: '注册后测组件',
      type: 'INTERACTIVE_COMP',
      renderTarget: '/interactive-learning/resources/registered-quiz',
      knowledgeNodeIds: ['kn-bode'],
      planningOverride: reviewedPathPlanningOverride('resource_registry', 'registered-quiz'),
    },
  ],
}));

import { GET } from '../route';

function reviewedPathPlanningOverride(sourceFamily: string, stableSourceRef: string) {
  return {
    abilityImpact: { controlModeling: 0.2, diagnosticAssessment: 0.2 },
    evidenceInstrumentation: ['answer_submit'],
    readiness: {
      minimumCompetency: { controlModeling: 0.1 },
      minimumEvidenceCount: 0,
      requiredCompletedNodeIds: [],
      requiredOutcomeRefs: [],
      unlockMessage: 'Reviewed fixture is ready for path planning.',
      fallbackNodeIds: [],
    },
    pathDisposition: {
      kind: 'path-plannable',
      reviewStatus: 'human-confirmed',
      rationale: 'Reviewed ResourceNode API fixture for path planning.',
      sourceFamily,
      stableSourceRef,
      sourceVersionRef: 'resource-node-registry.v1',
      parentResourceNodeId: null,
      reviewedAt: '2026-07-03T00:00:00.000Z',
      reviewerId: 'resource-node-api-test-review',
    },
  };
}

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
      ...reviewedPathPlanningOverride('teaching_resource', 'owned-quiz'),
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
    mocks.loadAllLessonRuntimeResourceCatalogEntries.mockResolvedValue([]);
    mocks.loadAllTextbookStructureRuntimeCatalogEntries.mockResolvedValue([]);
    mocks.loadRuntimeResourceProjectionInputs.mockResolvedValue([]);
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

  it('uses registered resource semantics when a DB TeachingResource has no direct knowledge mapping', async () => {
    mocks.prisma.teachingResource.findMany.mockResolvedValue([{
      ...ownedResource,
      id: 'owned-registry-quiz',
      title: '资源库后测实例',
      registryId: 'registered-quiz',
      knowledgeNodes: [],
      config: {},
    }]);

    const response = await GET(
      new Request('http://localhost/api/teacher/resource-nodes?q=资源库后测实例')
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.nodes).toEqual([
      expect.objectContaining({
        id: 'teaching-resource:owned-registry-quiz',
        knowledgeCoverage: ['kn-bode'],
        pathEligible: true,
        audit: expect.objectContaining({
          knowledgeCoveragePresent: true,
          capabilityMappingPresent: true,
          evidenceCapabilityConfigured: true,
        }),
      }),
    ]);
  });

  it('includes runtime lesson media and handouts as read-only resource nodes', async () => {
    mocks.loadAllLessonRuntimeResourceCatalogEntries.mockResolvedValue([
      {
        lesson: { lesson_id: '2-4', title: '频域课' },
        graphOverlay: {
          lesson_id: '2-4',
          focus_node_ids: ['kn-bode'],
          card_order: ['kn-bode'],
          nodes: [{ id: 'kn-bode', name: '伯德图' }],
          groups: [],
        },
        handoutPath: '/course-runtime/lessons/2-4/2-4-handout.md',
        handoutSourcePath: 'course-content/runtime/lessons/2-4/2-4-handout.md',
        handoutPdfPath: '/course-runtime/lessons/2-4/2-4-handout.pdf',
        mediaResources: [
          {
            id: 'slides',
            title: '频域课件',
            filename: '2-4-slides.pdf',
            kind: 'slides',
            url: 'https://example.test/2-4-slides.pdf',
            accessMode: 'new_tab',
            embedMode: 'none',
            status: 'ready',
            featured: false,
          },
          {
            id: 'intro-video',
            title: '频域导入视频',
            filename: '2-4-intro-video.mp4',
            kind: 'video',
            url: null,
            accessMode: 'dialog',
            embedMode: 'iframe',
            status: 'pending',
            featured: false,
          },
        ],
      },
    ]);

    const response = await GET(
      new Request('http://localhost/api/teacher/resource-nodes?courseModule=2-4')
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.nodes).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'runtime-handout:2-4',
        type: 'handout',
        editable: false,
      }),
      expect.objectContaining({
        id: 'runtime-media:2-4:slides',
        type: 'slides',
        editable: false,
        renderTarget: 'https://example.test/2-4-slides.pdf',
      }),
      expect.objectContaining({
        id: 'runtime-media:2-4:intro-video',
        type: 'video',
        editable: false,
        renderTarget: null,
      }),
    ]));
  });

  it('loads runtime projection sidecars into the teacher resource registry', async () => {
    mocks.loadRuntimeResourceProjectionInputs.mockResolvedValue([
      {
        id: 'runtime-step:2-4:step-01',
        resourceNodeId: 'lesson-step:2-4:step-01',
        title: '频域入口步骤',
        resourceType: 'lesson_step',
        sourceKind: 'runtime_lesson_step',
        sourceRef: '2-4:step-01',
        sourceRecord: '2-4:step-01',
        sourcePathOrUrl: 'course-content/runtime/lessons/2-4/interactive-manifest.json',
        sourceHash: 'sha256:step',
        sourceVersionRef: 'interactive-manifest.v2',
        projectionLevel: 'ResourceNode',
        routeTarget: '/interactive-learning/courses/unit-2-4-nyquist-margin-entry/student/demo?step=step-01',
        renderTarget: '/interactive-learning/courses/unit-2-4-nyquist-margin-entry/student/demo?step=step-01',
        graphNodeRefs: {
          knowledge: ['kn-bode'],
          capability: ['controlModeling'],
          quality: [],
        },
        evidenceInstrumentation: ['lesson_step_view'],
        privacyScope: 'student-visible',
        teacherPolicy: 'allowed',
        evidenceContract: {
          eventSource: true,
          eventType: true,
          clientEventIdPolicy: true,
          attemptKey: true,
          sourceLogId: true,
          dedupeKey: true,
          timestamps: true,
          learningFactPolicy: true,
          confidencePolicy: false,
          privacyScope: true,
          complete: false,
          missingFields: ['confidencePolicy'],
        },
        reviewAudit: {
          status: 'generated-provisional',
          reviewerId: null,
          reviewerRole: null,
          reviewedAt: null,
          reviewBatchId: null,
          reviewedSourceHash: null,
          reviewedVersionRef: 'interactive-manifest.v2',
          generationToolOrModel: 'template',
          promptOrManifestHash: null,
          confidence: null,
          staleInvalidationRule: 'requires human review before path eligibility or mastery effect',
        },
      },
    ]);

    const response = await GET(
      new Request('http://localhost/api/teacher/resource-nodes?q=频域入口步骤')
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.nodes).toEqual([
      expect.objectContaining({
        id: 'lesson-step:2-4:step-01',
        editable: false,
        pathEligible: false,
        pathExclusionReasons: expect.arrayContaining(['provisional-runtime-projection']),
      }),
    ]);
  });

  it('includes structured textbook containers and units as read-only resource nodes', async () => {
    mocks.loadAllTextbookStructureRuntimeCatalogEntries.mockResolvedValue([
      {
        textbook: {
          bookId: 'dorf-modern-control-systems',
          title: 'Modern Control Systems',
          sourceHref: '/textbooks/dorf-modern-control-systems/14th%20Global%20Edition',
        },
        units: [
          {
            bookId: 'dorf-modern-control-systems',
            unitId: 'ch10-sec01',
            title: '根轨迹校正设计',
            citationHref: '/textbooks/dorf-modern-control-systems/14th%20Global%20Edition/chapter-chapter-10/section-10.1',
            knowledgeNodeIds: ['kn-bode'],
            capabilityTargetIds: ['parameterDesign'],
            estimatedTimeMinutes: 18,
          },
          {
            bookId: 'dorf-modern-control-systems',
            unitId: 'ch01-preview-001',
            title: 'Preview',
            citationHref: '/textbooks/dorf-modern-control-systems/14th%20Global%20Edition/chapter-chapter-01/unnumbered-preview',
            knowledgeNodeIds: [],
            capabilityTargetIds: [],
            estimatedTimeMinutes: 2,
          },
        ],
      },
    ]);

    const response = await GET(
      new Request('http://localhost/api/teacher/resource-nodes?courseModule=dorf-modern-control-systems')
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.nodes).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'textbook:dorf-modern-control-systems',
        type: 'textbook',
        editable: false,
        pathEligible: false,
      }),
      expect.objectContaining({
        id: 'textbook-section:dorf-modern-control-systems:ch10-sec01',
        type: 'textbook_section',
        editable: false,
        pathEligible: false,
        renderTarget: '/textbooks/dorf-modern-control-systems/14th%20Global%20Edition/chapter-chapter-10/section-10.1',
      }),
      expect.objectContaining({
        id: 'textbook-section:dorf-modern-control-systems:ch01-preview-001',
        pathEligible: false,
      }),
    ]));
  });

  it('keeps registry, runtime, and knowledge nodes read-only for admins', async () => {
    mocks.getServerSession.mockResolvedValue({
      user: { id: 'admin-1', role: 'ADMIN' },
    });
    mocks.loadAllLessonRuntimeResourceCatalogEntries.mockResolvedValue([
      {
        lesson: { lesson_id: '2-4', title: '频域课' },
        graphOverlay: {
          lesson_id: '2-4',
          focus_node_ids: ['kn-bode'],
          card_order: ['kn-bode'],
          nodes: [{ id: 'kn-bode', name: '伯德图' }],
          groups: [],
        },
        handoutPath: '/course-runtime/lessons/2-4/2-4-handout.md',
        handoutSourcePath: 'course-content/runtime/lessons/2-4/2-4-handout.md',
        handoutPdfPath: '/course-runtime/lessons/2-4/2-4-handout.pdf',
        mediaResources: [
          {
            id: 'slides',
            title: '频域课件',
            filename: '2-4-slides.pdf',
            kind: 'slides',
            url: 'https://example.test/2-4-slides.pdf',
            accessMode: 'new_tab',
            embedMode: 'none',
            status: 'ready',
            featured: false,
          },
        ],
      },
    ]);

    const response = await GET(new Request('http://localhost/api/teacher/resource-nodes'));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.nodes).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'registry:registered-quiz',
        editable: false,
      }),
      expect.objectContaining({
        id: 'runtime-media:2-4:slides',
        editable: false,
      }),
      expect.objectContaining({
        id: 'knowledge-node:kn-bode',
        editable: false,
      }),
      expect.objectContaining({
        id: 'teaching-resource:owned-quiz',
        editable: true,
      }),
    ]));
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
            ...reviewedPathPlanningOverride('teaching_resource', 'owned-quiz'),
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
