import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getServerAuthSession: vi.fn(),
  readStudentEvidencePort: vi.fn(),
  isAuthoritativeConsumerRead: vi.fn(),
  summarizePortraitV2: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  getServerAuthSession: mocks.getServerAuthSession,
}));

vi.mock('@/features/learning-record/consumers/public-api', () => ({
  readStudentEvidencePort: mocks.readStudentEvidencePort,
  isAuthoritativeConsumerRead: mocks.isAuthoritativeConsumerRead,
  isConsumerUnauthorized: () => false,
}));

vi.mock('@/lib/data-governance/portrait-v2-consumer', () => ({
  summarizePortraitV2: mocks.summarizePortraitV2,
}));

vi.mock('@/lib/prisma', () => ({ prisma: {} }));

import { GET } from '../route';
import { NextRequest } from 'next/server';

function snapshotEvidence() {
  return {
    portrait: {
      stateKind: 'SNAPSHOT',
      payload: {
        dimensions: [
          {
            id: 'stability',
            label: '系统稳定性',
            score: 58,
            confidence: 0.7,
            evidenceSummary: { totalCount: 6 },
            freshness: { asOf: '2026-09-01T00:00:00.000Z' },
          },
        ],
      },
      generatedAt: '2026-09-02T00:00:00.000Z',
      lastRisk: [
        { type: 'constraint', severity: 'high', evidenceRefs: [] },
      ],
      availabilityReason: null,
    },
    status: 'current',
    reason: null,
    knownZero: false,
    read: { fields: { provenanceRevision: 'rev-1' } },
  };
}

describe('GET /api/student/competency-snapshot navigation contract (Issue #1930)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getServerAuthSession.mockResolvedValue({ user: { id: 'student-1' } });
    mocks.isAuthoritativeConsumerRead.mockReturnValue(true);
    mocks.summarizePortraitV2.mockImplementation((payload: unknown) => payload);
  });

  it('emits a formal student learning action URL for every evidence-backed recommendation', async () => {
    mocks.readStudentEvidencePort.mockResolvedValue(snapshotEvidence());

    const response = await GET(new NextRequest('http://localhost/api/student/competency-snapshot'));
    const body = await response.json();

    expect(response.status).toBe(200);
    // 风险建议 + 最弱维度建议都必须携带已验证学生学习入口，不返回空地址。
    expect(body.recommendations.length).toBeGreaterThanOrEqual(2);
    for (const recommendation of body.recommendations) {
      expect(recommendation.actionUrl).toBe('/interactive-learning/courses');
    }
  });

  it('routes cumulative diagnosis next actions to the formal interactive course entry', async () => {
    mocks.readStudentEvidencePort.mockResolvedValue(snapshotEvidence());

    const response = await GET(new NextRequest('http://localhost/api/student/competency-snapshot'));
    const body = await response.json();

    const nextActions = body.diagnosis.claims.flatMap(
      (claim: { nextActions: Array<{ href: string }> }) => claim.nextActions,
    );
    expect(nextActions.length).toBeGreaterThan(0);
    for (const action of nextActions) {
      expect(action.href).toBe('/interactive-learning/courses');
      expect(action.href).not.toBe('/courses');
    }
  });
});
