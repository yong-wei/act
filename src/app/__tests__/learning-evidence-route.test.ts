import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { GET } from '../api/learning-evidence/route';

const mocks = vi.hoisted(() => ({
  listEvidenceTimeline: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  getServerAuthSession: vi.fn(async () => ({ user: { id: 'student-1' } })),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {},
}));

vi.mock('@/lib/data-governance/evidence-timeline', async () => {
  const actual = await vi.importActual<typeof import('@/lib/data-governance/evidence-timeline')>(
    '@/lib/data-governance/evidence-timeline',
  );
  return {
    ...actual,
    listEvidenceTimeline: mocks.listEvidenceTimeline,
  };
});

function request(query: string) {
  return new NextRequest(`http://localhost/api/learning-evidence${query}`);
}

describe('/api/learning-evidence', () => {
  beforeEach(() => {
    mocks.listEvidenceTimeline.mockReset();
  });

  it('passes document feedback assignment, criterion, and source filters to the evidence timeline query', async () => {
    mocks.listEvidenceTimeline.mockResolvedValue({
      items: [],
      nextCursor: null,
      appliedFilters: {
        assignment: 'report-control-design',
        criterion: 'simulation-evidence',
        assignmentSource: 'document-feedback',
      },
    });

    const response = await GET(request(
      '?assignment=report-control-design&criterion=simulation-evidence&source=document-feedback&status=completed',
    ));

    expect(response.status).toBe(200);
    expect(mocks.listEvidenceTimeline).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'student-1',
      filters: expect.objectContaining({
        assignment: 'report-control-design',
        criterion: 'simulation-evidence',
        assignmentSource: 'document-feedback',
      }),
    }));
    const body = await response.json();
    expect(body.writeback.status).toBe('empty');
    expect(body.assignmentContext.assignmentId).toBe('report-control-design');
  });

  it('does not treat document feedback source alone as available assignment evidence', async () => {
    mocks.listEvidenceTimeline.mockResolvedValue({
      items: [],
      nextCursor: null,
      appliedFilters: {
        assignment: 'report-control-design',
        assignmentSource: 'document-feedback',
      },
    });

    const response = await GET(request(
      '?assignment=report-control-design&source=document-feedback&status=completed',
    ));

    expect(response.status).toBe(200);
    expect(mocks.listEvidenceTimeline).toHaveBeenCalledWith(expect.objectContaining({
      filters: expect.objectContaining({
        assignment: 'report-control-design',
        assignmentSource: 'document-feedback',
      }),
    }));
    expect(mocks.listEvidenceTimeline.mock.calls[0][0].filters).not.toHaveProperty('criterion');
    const body = await response.json();
    expect(body.writeback).toMatchObject({
      status: 'empty',
      itemCount: 0,
    });
  });

  it('does not mark unrelated evidence as available when the assignment scoped page is empty', async () => {
    mocks.listEvidenceTimeline.mockResolvedValue({
      items: [],
      nextCursor: null,
      appliedFilters: {
        assignment: 'report-control-design',
        criterion: 'engineering-rationale',
      },
    });

    const response = await GET(request(
      '?assignment=report-control-design&criterion=engineering-rationale&status=completed',
    ));

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.writeback).toMatchObject({
      status: 'empty',
      target: 'evidence-growth-portfolio',
      itemCount: 0,
    });
  });
});
