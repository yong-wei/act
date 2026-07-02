import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const getServerSession = vi.fn();
  const teachingResourceFindMany = vi.fn();
  const teachingResourceUpdate = vi.fn();
  const loadAllLessonRuntimeResourceCatalogEntries = vi.fn();
  const loadAllTextbookRuntimeResourceCatalogEntries = vi.fn();
  const loadRuntimeResourceProjectionInputs = vi.fn();

  return {
    getServerSession,
    loadAllLessonRuntimeResourceCatalogEntries,
    loadAllTextbookRuntimeResourceCatalogEntries,
    loadRuntimeResourceProjectionInputs,
    prisma: {
      teachingResource: {
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

vi.mock('@/lib/course-runtime', () => ({
  loadAllLessonRuntimeResourceCatalogEntries: mocks.loadAllLessonRuntimeResourceCatalogEntries,
}));

vi.mock('@/lib/textbook-runtime-resources', () => ({
  loadAllTextbookRuntimeResourceCatalogEntries: mocks.loadAllTextbookRuntimeResourceCatalogEntries,
}));

vi.mock('@/lib/teacher-resource-node-data', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/teacher-resource-node-data')>();
  return {
    ...actual,
    loadRuntimeResourceProjectionInputs: mocks.loadRuntimeResourceProjectionInputs,
  };
});

vi.mock('@/lib/resource-registry-metadata', () => ({
  getAllRegisteredResourceMetadata: () => [{ id: 'lesson12-bode-post-quiz' }],
}));

import { POST } from '../route';

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

describe('POST /api/teacher/sar-suggested-bindings/review', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getServerSession.mockResolvedValue({
      user: { id: 'teacher-1', role: 'TEACHER' },
    });
    mocks.prisma.teachingResource.findMany.mockResolvedValue([ownedResource]);
    mocks.prisma.teachingResource.update.mockResolvedValue(ownedResource);
    mocks.loadAllLessonRuntimeResourceCatalogEntries.mockResolvedValue([]);
    mocks.loadAllTextbookRuntimeResourceCatalogEntries.mockResolvedValue([textbookEntry]);
    mocks.loadRuntimeResourceProjectionInputs.mockResolvedValue([]);
  });

  it('rejects non-teacher users before reading governance resources', async () => {
    mocks.getServerSession.mockResolvedValue({
      user: { id: 'student-1', role: 'STUDENT' },
    });

    const response = await POST(reviewRequest({ decision: 'reject' }));

    expect(response.status).toBe(403);
    expect(mocks.prisma.teachingResource.findMany).not.toHaveBeenCalled();
  });

  it('reviews SAR suggested bindings through the production teacher route', async () => {
    const response = await POST(reviewRequest({ decision: 'reject' }));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      ok: true,
      persisted: true,
      persistedResourceId: 'owned-quiz',
      state: 'rejected',
      auditRecord: {
        candidateId: 'sar-gap:owned-quiz',
        candidateRef: 'teaching-resource:owned-quiz',
        decision: 'reject',
        reviewer: {
          id: 'teacher-1',
          role: 'TEACHER',
        },
      },
    });
    expect(mocks.prisma.teachingResource.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'owned-quiz' },
      data: expect.objectContaining({
        config: expect.objectContaining({
          resourceNodePlanning: expect.objectContaining({
            sarSuggestedBindingReviews: [
              expect.objectContaining({
                candidateId: 'sar-gap:owned-quiz',
                decision: 'reject',
              }),
            ],
          }),
        }),
      }),
    }));
  });

  it('rejects accepted suggestions without an explicit governance patch', async () => {
    const response = await POST(reviewRequest({ decision: 'accept' }));
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload).toMatchObject({
      ok: false,
      code: 'SAR_ACCEPT_REQUIRES_PATCH',
    });
    expect(mocks.prisma.teachingResource.update).not.toHaveBeenCalled();
  });

  it('persists authorized non-ResourceNode reviews on an owned source resource audit target', async () => {
    const response = await POST(reviewRequest({
      decision: 'reject',
      candidateId: 'sar-gap:chunk-bode-gap',
      candidateRef: 'chunk-bode-gap',
      refType: 'retrieval-chunk',
      resourceNodeId: null,
      sourceRefs: ['owned-quiz'],
    }));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      ok: true,
      persisted: true,
      persistedResourceId: 'owned-quiz',
      state: 'rejected',
      auditRecord: {
        candidateId: 'sar-gap:chunk-bode-gap',
        candidateRef: 'chunk-bode-gap',
        decision: 'reject',
      },
    });
    expect(mocks.prisma.teachingResource.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'owned-quiz' },
      data: expect.objectContaining({
        config: expect.objectContaining({
          resourceNodePlanning: expect.objectContaining({
            sarSuggestedBindingReviews: [
              expect.objectContaining({
                candidateId: 'sar-gap:chunk-bode-gap',
                candidateRefType: 'retrieval-chunk',
                decision: 'reject',
              }),
            ],
          }),
        }),
      }),
    }));
  });

  it('rejects textbook SAR reviews when no persistent audit target is available', async () => {
    const response = await POST(reviewRequest({
      decision: 'defer',
      candidateId: 'sar-gap:textbook-section',
      candidateRef: 'citation-target:dorf-modern-control-systems:ch10-sec01',
      refType: 'citation-target',
      resourceNodeId: null,
      sourceRefs: ['textbook-section:dorf-modern-control-systems:ch10-sec01'],
    }));
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload).toMatchObject({
      ok: false,
      code: 'SAR_REVIEW_REQUIRES_PERSISTENT_AUDIT_TARGET',
    });
    expect(mocks.prisma.teachingResource.update).not.toHaveBeenCalled();
  });

  it('does not infer non-resource SAR audit targets from candidate refs', async () => {
    const response = await POST(reviewRequest({
      decision: 'reject',
      candidateId: 'sar-gap:textbook-spoof',
      candidateRef: 'owned-quiz',
      refType: 'citation-target',
      resourceNodeId: null,
      sourceRefs: ['textbook-section:dorf-modern-control-systems:ch10-sec01'],
    }));
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload).toMatchObject({
      ok: false,
      code: 'SAR_REVIEW_REQUIRES_PERSISTENT_AUDIT_TARGET',
    });
    expect(mocks.prisma.teachingResource.update).not.toHaveBeenCalled();
  });
});

const textbookEntry = {
  textbook: {
    bookId: 'dorf-modern-control-systems',
  },
  sections: [
    {
      sectionId: 'ch10-sec01',
      knowledgeNodeIds: ['kn-bode'],
    },
  ],
};

function reviewRequest(input: {
  decision: string;
  candidateId?: string;
  candidateRef?: string;
  refType?: 'resource-node' | 'retrieval-chunk' | 'citation-target' | 'planning-unit';
  resourceNodeId?: string | null;
  sourceRefs?: string[];
}): Request {
  const candidateId = input.candidateId ?? 'sar-gap:owned-quiz';
  const candidateRef = input.candidateRef ?? 'teaching-resource:owned-quiz';
  const refType = input.refType ?? 'resource-node';
  return new Request('http://localhost/api/teacher/sar-suggested-bindings/review', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      decision: input.decision,
      rationale: '教师审查 SAR 建议绑定。',
      candidate: {
        id: candidateId,
        target: {
          graphNodeId: 'kn-bode',
          objectiveId: 'objective:frequency-domain',
        },
        candidate: {
          ref: candidateRef,
          refType,
          resourceNodeId: input.resourceNodeId === undefined ? 'teaching-resource:owned-quiz' : input.resourceNodeId,
          sourceRefs: input.sourceRefs ?? ['owned-quiz'],
        },
        missingCoverageTypes: ['linked-resource'],
        provenance: {
          source: 'graph-center-sar',
          basisEventIds: ['sar-event:safe-1'],
          traceId: 'sar:trace:graph-center',
        },
        traceSummary: {
          seedEntityIds: ['sar-entity:graph-node'],
          expansionHopCount: 1,
          selectedRefCount: 2,
          rejectedRefCount: 0,
          limitations: ['source-pack-ranking-required'],
        },
        limitations: ['citation-hydration-required'],
      },
    }),
  });
}
