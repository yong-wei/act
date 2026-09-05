import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

import { PORTRAIT_V2_DIMENSIONS } from '@/lib/data-governance/kaq-objective-taxonomy';
import {
  createPortraitV2Payload,
  PORTRAIT_V2_CALCULATION_VERSION,
} from '@/lib/data-governance/portrait-v2-model';

const mocks = vi.hoisted(() => ({
  getServerAuthSession: vi.fn(),
  readCurrentCumulativePortrait: vi.fn(),
  prisma: {},
}));

vi.mock('@/lib/auth', () => ({
  getServerAuthSession: mocks.getServerAuthSession,
}));
vi.mock('@/lib/prisma', () => ({
  prisma: mocks.prisma,
}));
vi.mock('@/lib/data-governance/cumulative-portrait-read-model', () => ({
  readCurrentCumulativePortrait: mocks.readCurrentCumulativePortrait,
}));

import { GET } from '@/app/api/student/competency-snapshot/route';

function cumulativeState() {
  const evidenceAt = new Date('2025-11-01T08:00:00.000Z');
  const payload = createPortraitV2Payload({
    userId: 'student-1',
    generatedAt: evidenceAt.toISOString(),
    now: evidenceAt,
    dimensions: PORTRAIT_V2_DIMENSIONS.map(({ id }, index) => ({
      id,
      score: index === 6 ? 0 : 60 + index * 5,
      confidence: index === 6 ? 0 : 0.8,
      trend: 'stable',
      freshness: {
        state: index === 6 ? 'missing' : 'current',
        asOf: index === 6 ? null : evidenceAt.toISOString(),
        evidenceAgeDays: index === 6 ? null : 0,
      },
      evidenceSummary: {
        totalCount: index === 6 ? 0 : 2,
        sourceFamilyCounts: index === 6
          ? {} as Record<string, number>
          : { LearningFact: 2 } as Record<string, number>,
      },
      lastPositiveEvidenceAt: index === 6 ? null : evidenceAt.toISOString(),
      lastNegativeEvidenceAt: null,
      rationale: index === 6
        ? 'No safe legacy mapping exists.'
        : 'Governed evidence supports the current score.',
      limitations: index === 6 ? ['missing-native-portrait-v2-evidence'] : [],
      sourceLineage: index === 6
        ? []
        : [
            {
              kind: 'evidence-family',
              ref: 'LearningFact',
              privacyScope: 'student-visible',
            },
            {
              kind: 'citation',
              ref: `citation-target:sha256:${String(index).padStart(64, '0')}`,
              privacyScope: 'student-visible',
            },
            {
              kind: 'hashed',
              ref: `sar:evidence:sha256:${String(index).padStart(64, '0')}`,
              privacyScope: 'student-visible',
            },
            {
              kind: 'aggregate',
              ref: `aggregate:sha256:${String(index).padStart(64, '0')}`,
              privacyScope: 'student-visible',
            },
          ],
      calculationVersion: PORTRAIT_V2_CALCULATION_VERSION,
    })),
  });
  return {
    stateKind: 'SNAPSHOT',
    payload,
    overallScore: 72.5,
    dimensionCoverage: {
      evidencedDimensionIds: PORTRAIT_V2_DIMENSIONS.slice(0, 6).map(({ id }) => id),
      missingDimensionIds: [PORTRAIT_V2_DIMENSIONS[6].id],
    },
    evidenceAsOf: evidenceAt.toISOString(),
    confidence: 0.8,
    lastTrend: 'stable',
    lastRisk: [{
      type: 'cross_domain',
      severity: 'medium',
      occurredAt: evidenceAt.toISOString(),
    }],
    availabilityReason: 'available',
    generatedAt: '2026-07-23T08:00:00.000Z',
    publication: {
      calculationVersion: PORTRAIT_V2_CALCULATION_VERSION,
      generation: '4',
      queueGeneration: '9',
      cutoverFence: '7',
      stateWatermark: '12',
      processingWatermark: '9',
      captureRevision: 'state-1',
      inputDigest: 'task-input-1',
    },
  };
}

describe('GET /api/student/competency-snapshot', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getServerAuthSession.mockResolvedValue({
      user: { id: 'student-1', role: 'STUDENT' },
    });
    mocks.readCurrentCumulativePortrait.mockResolvedValue(cumulativeState());
  });

  it('rejects the removed timeRange contract after authentication', async () => {
    const response = await GET(new NextRequest(
      'http://localhost/api/student/competency-snapshot?timeRange=30d',
    ));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: 'unsupported-scope',
      scope: '30d',
    });
    expect(mocks.readCurrentCumulativePortrait).not.toHaveBeenCalled();
  });

  it('emits formal student learning action URLs for recommendations and diagnosis next actions (Issue #1930)', async () => {
    const response = await GET(new NextRequest(
      'http://localhost/api/student/competency-snapshot',
    ));
    const body = await response.json();

    expect(response.status).toBe(200);
    // 每条证据支撑的建议都携带已验证学生学习入口，不返回空地址（Issue #1930）。
    expect(body.recommendations.length).toBeGreaterThan(0);
    for (const recommendation of body.recommendations) {
      expect(recommendation.actionUrl).toBe('/interactive-learning/courses');
    }
    // 诊断"继续学习"不再使用失效旧路由 /courses。
    const nextActions = body.diagnosis.claims.flatMap(
      (claim: { nextActions: Array<{ href: string }> }) => claim.nextActions,
    );
    expect(nextActions.length).toBeGreaterThan(0);
    for (const action of nextActions) {
      expect(action.href).toBe('/interactive-learning/courses');
    }
  });

  it('keeps a historical cumulative portrait visible without recent-window checks', async () => {
    const response = await GET(new NextRequest(
      'http://localhost/api/student/competency-snapshot',
    ));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mocks.readCurrentCumulativePortrait).toHaveBeenCalledWith(
      mocks.prisma,
      'student-1',
      'student',
    );
    expect(body).toMatchObject({
      derivationState: 'current',
      evidenceState: 'current',
      availabilityReason: 'available',
      currentSnapshot: {
        snapshotAt: '2026-07-23T08:00:00.000Z',
        overallScore: 72.5,
        evidenceAsOf: '2025-11-01T08:00:00.000Z',
        factCount: 12,
      },
      lastTrend: 'stable',
      previousSnapshot: null,
      trendVector: null,
      riskFlags: [{
        type: 'cross_domain',
        severity: 'medium',
        description: '累计学习证据显示跨域迁移能力需要关注。',
      }],
    });
    expect(body.currentSnapshot).not.toHaveProperty('vector');
    expect(body.currentSnapshot).not.toHaveProperty('legacyCompatibility');
    expect(body.diagnosis.goalId).toBe('cumulative-portrait-overall');
    expect(body.diagnosis.claims).toHaveLength(7);
    expect(JSON.stringify(body)).not.toContain('participation');
    expect(JSON.stringify(body)).not.toContain('ai_misuse');
    expect(JSON.stringify(body)).not.toContain('no-recent-evidence');
  });

  it('projects student-safe evidence references from the governed cumulative summary (Issue #2010)', async () => {
    const response = await GET(new NextRequest(
      'http://localhost/api/student/competency-snapshot',
    ));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.diagnosis.materialization.inputs).toEqual(['canonical-cumulative-portrait']);
    const claims = body.diagnosis.claims as Array<{
      dimensionId: string;
      evidenceRefs: Array<{
        chunkId: string;
        sourceType: string;
        displayHref: string | null;
        capsule: string;
        citationChip: { privacyVisibility: string; authorityLevel: string; freshnessBucket: string };
      }>;
      confidence: { evidenceCount: number };
      limitations: Array<{ reason: string }>;
    }>;
    const evidenced = claims.filter((claim) => claim.confidence.evidenceCount > 0);
    const missing = claims.filter((claim) => claim.confidence.evidenceCount === 0);

    // 有证据维度：每维度一条学生安全摘要引用，与卡片证据计数同源。
    expect(evidenced.length).toBe(6);
    for (const claim of evidenced) {
      expect(claim.evidenceRefs).toHaveLength(1);
      const ref = claim.evidenceRefs[0];
      expect(ref.chunkId).toBe(`cumulative-portrait:${claim.dimensionId}`);
      expect(ref.sourceType).toBe('diagnosis');
      expect(ref.displayHref).toBe('/profile/evidence');
      expect(ref.capsule).toContain('累计 2 条合格学习证据');
      expect(ref.citationChip.privacyVisibility).toBe('redacted');
      expect(ref.citationChip.authorityLevel).toBe('learner-evidence');
      expect(ref.citationChip.freshnessBucket).toBe('current');
      expect(claim.limitations).toHaveLength(0);
    }
    // 缺失维度：不伪造引用，保留显式限制。
    expect(missing.length).toBe(1);
    for (const claim of missing) {
      expect(claim.evidenceRefs).toHaveLength(0);
      expect(claim.limitations.map((item) => item.reason)).toContain('missing-dimension-evidence');
    }
    // 不泄露 sourceLineage/citation 原始引用值。
    const serialized = JSON.stringify(body);
    expect(serialized).not.toContain('citation-target:sha256:');
    expect(serialized).not.toContain('sar:evidence:sha256:');
    expect(serialized).not.toContain('aggregate:sha256:');
  });

  it('returns the current no-evidence tombstone without a zero-valued portrait', async () => {
    mocks.readCurrentCumulativePortrait.mockResolvedValue({
      ...cumulativeState(),
      stateKind: 'NO_EVIDENCE',
      payload: null,
      overallScore: null,
      evidenceAsOf: null,
      confidence: null,
      dimensionCoverage: {
        evidencedDimensionIds: [],
        missingDimensionIds: PORTRAIT_V2_DIMENSIONS.map(({ id }) => id),
      },
      lastRisk: [],
      availabilityReason: 'no-evidence-after-revocation',
    });

    const body = await (await GET(new NextRequest(
      'http://localhost/api/student/competency-snapshot',
    ))).json();

    expect(body).toMatchObject({
      derivationState: 'no-evidence-after-revocation',
      evidenceState: 'empty',
      currentSnapshot: null,
      recommendations: [],
      diagnosis: null,
    });
  });

  it('does not fall back to a legacy portrait when the current pointer is unavailable', async () => {
    mocks.readCurrentCumulativePortrait.mockResolvedValue({
      ...cumulativeState(),
      stateKind: 'UNAVAILABLE',
      payload: null,
      overallScore: null,
      evidenceAsOf: null,
      confidence: null,
      dimensionCoverage: {
        evidencedDimensionIds: [],
        missingDimensionIds: [],
      },
      lastTrend: null,
      lastRisk: [],
      availabilityReason: 'current-state-version-mismatch',
      generatedAt: null,
    });

    const body = await (await GET(new NextRequest(
      'http://localhost/api/student/competency-snapshot',
    ))).json();

    expect(body).toMatchObject({
      evidenceState: 'unavailable',
      availabilityReason: 'current-state-version-mismatch',
      currentSnapshot: null,
      riskFlags: [],
    });
    expect(JSON.stringify(body)).not.toContain('legacyCompatibility');
    expect(JSON.stringify(body)).not.toContain('StudentCompetencySnapshot');
  });

  it('preserves authentication before portrait lookup', async () => {
    mocks.getServerAuthSession.mockResolvedValue(null);

    const response = await GET(new NextRequest(
      'http://localhost/api/student/competency-snapshot',
    ));

    expect(response.status).toBe(401);
    expect(mocks.readCurrentCumulativePortrait).not.toHaveBeenCalled();
  });

  it('ignores client subject identifiers and only reads the authenticated student', async () => {
    await GET(new NextRequest(
      'http://localhost/api/student/competency-snapshot?userId=other-student',
    ));

    expect(mocks.readCurrentCumulativePortrait).toHaveBeenCalledWith(
      mocks.prisma,
      'student-1',
      'student',
    );
  });

  it('does not label a stale SNAPSHOT as current evidence', async () => {
    Object.assign(mocks.prisma, {
      learningFact: {
        findFirst: vi.fn().mockResolvedValue({ startedAt: '2026-08-21T00:00:00.000Z' }),
      },
    });

    const body = await (await GET(new NextRequest(
      'http://localhost/api/student/competency-snapshot',
    ))).json();

    expect(body).toMatchObject({
      derivationState: 'newer-learning-fact',
      evidenceState: 'stale',
      projectionStatus: 'stale',
      currentSnapshot: {
        overallScore: 72.5,
      },
    });
  });
});
