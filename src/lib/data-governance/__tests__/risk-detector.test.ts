import type { LearningFact } from '@prisma/client';
import { describe, expect, it } from 'vitest';

import { createEmptyCompetencyVector, type CompetencyVector } from '../competency-model';
import {
  buildEvidenceRiskStateChanges,
  detectCumulativePortraitRisks,
  detectRisks,
  getRecommendedScaffolding,
  type RiskDetectionContext,
} from '../risk-detector';
import {
  PORTRAIT_V2_CALCULATION_VERSION,
  PORTRAIT_V2_DIMENSION_IDS,
  createPortraitV2Payload,
} from '../portrait-v2-model';

const evidenceAt = new Date('2026-05-04T00:00:00.000Z');

function fact(id: string, overrides: Partial<LearningFact> = {}): LearningFact {
  return {
    id,
    userId: 'student-1',
    factType: 'question',
    moduleId: null,
    sessionId: null,
    startedAt: evidenceAt,
    finishedAt: evidenceAt,
    outcome: 'success',
    score: 80,
    timeSpent: 300,
    competencyContribution: {},
    sourceEventId: null,
    sourceLogId: null,
    courseId: null,
    lessonId: null,
    contextJson: {},
    knowledgeIdentityNamespace: null,
    canonicalObjectId: null,
    aggregateReleaseSetId: null,
    aggregateReleaseId: null,
    knowledgeProjectionId: null,
    knowledgeRevisionRef: null,
    createdAt: evidenceAt,
    ...overrides,
  };
}

function vector(score: number, overrides: Partial<CompetencyVector> = {}): CompetencyVector {
  const empty = createEmptyCompetencyVector();
  const dimension = {
    score,
    trend: 'stable' as const,
    confidence: 0.8,
    evidenceCount: 5,
    lastUpdated: evidenceAt.toISOString(),
  };
  return {
    controlModeling: { ...dimension },
    parameterDesign: { ...dimension },
    crossDomainTransfer: { ...dimension },
    engineeringDecision: { ...dimension },
    inquiryReflection: { ...dimension },
    selfDirectedLearning: { ...dimension },
    ...overrides,
  };
}

function context(input: Partial<RiskDetectionContext> = {}): RiskDetectionContext {
  return {
    userId: 'student-1',
    facts: [],
    competencyVector: vector(70),
    portraitEvidenceAt: evidenceAt,
    ...input,
  };
}

describe('cumulative risk detection', () => {
  it.each([
    [-11, 'high'],
    [-10, 'medium'],
    [-5, undefined],
  ] as const)('uses the native seven-dimension portrait for stagnation %s => %s', (change, severity) => {
    const risks = detectCumulativePortraitRisks({
      userId: 'student-1',
      facts: [fact('native-change', {
        competencyContribution: { controlModeling: -1 },
      })],
      currentPortrait: nativePortrait(70 + change),
      previousPortrait: nativePortrait(70),
    });

    expect(risks.find((risk) => risk.type === 'stagnation')?.severity).toBe(severity);
  });

  it('uses controlModelingRepresentation and transferIntegratedApplication for cross-domain risk', () => {
    const current = nativePortrait(70, {
      controlModelingRepresentation: 80,
      transferIntegratedApplication: 40,
    });
    const risks = detectCumulativePortraitRisks({
      userId: 'student-1',
      facts: [],
      currentPortrait: current,
    });

    expect(risks.find((risk) => risk.type === 'cross_domain')).toMatchObject({
      severity: 'high',
      evidence: { controlScore: 80, crossDomainScore: 40 },
    });
  });

  it('never emits participation or ai_misuse and does not use calendar windows', () => {
    const oldAiFailures = Array.from({ length: 8 }, (_, index) =>
      fact(`ai-${index}`, {
        factType: 'ai_intervention',
        outcome: 'failure',
        startedAt: new Date('2020-01-01T00:00:00.000Z'),
      }));

    const risks = detectRisks(context({ facts: oldAiFailures }));

    expect(risks.map((risk) => risk.type)).not.toContain('participation');
    expect(risks.map((risk) => risk.type)).not.toContain('ai_misuse');
  });

  it.each([
    [-11, 'high'],
    [-10, 'medium'],
    [-6, 'medium'],
  ] as const)('uses deterministic stagnation threshold %s => %s', (change, severity) => {
    const current = vector(70 + change);
    const risks = detectRisks(context({
      competencyVector: current,
      previousSnapshot: vector(70),
    }));

    expect(risks.find((risk) => risk.type === 'stagnation')).toMatchObject({
      severity,
      triggeredAt: evidenceAt,
    });
  });

  it('does not infer stagnation from elapsed time without a score decline', () => {
    const risks = detectRisks(context({
      facts: [fact('old-success', { startedAt: new Date('2018-01-01T00:00:00.000Z') })],
      competencyVector: vector(60),
      previousSnapshot: vector(60),
    }));

    expect(risks.find((risk) => risk.type === 'stagnation')).toBeUndefined();
  });

  it('derives constraint only from persistent supporting facts and uses latest support time', () => {
    const facts = [
      fact('constraint-1', { factType: 'ethical', outcome: 'failure', startedAt: new Date('2026-05-01T00:00:00.000Z') }),
      fact('constraint-2', { factType: 'ethical', outcome: 'failure', startedAt: new Date('2026-05-02T00:00:00.000Z') }),
      fact('constraint-3', { factType: 'ethical', outcome: 'failure', startedAt: new Date('2026-05-03T00:00:00.000Z') }),
    ];

    const risk = detectRisks(context({ facts, portraitEvidenceAt: undefined }))
      .find((item) => item.type === 'constraint');

    expect(risk).toMatchObject({
      severity: 'medium',
      triggeredAt: new Date('2026-05-03T00:00:00.000Z'),
      evidence: {
        supportFactIds: ['constraint-1', 'constraint-2', 'constraint-3'],
      },
    });
    expect(detectRisks(context({ facts: facts.slice(0, 2) }))
      .find((item) => item.type === 'constraint')).toBeUndefined();
  });

  it('preserves the deterministic cross-domain score and assessment rules', () => {
    const assessments = [
      fact('cross-1', { outcome: 'failure', competencyContribution: { crossDomainTransfer: -1 } }),
      fact('cross-2', { outcome: 'failure', competencyContribution: { crossDomainTransfer: -1 } }),
      fact('cross-3', { outcome: 'failure', competencyContribution: { crossDomainTransfer: -1 } }),
    ];
    const risks = detectRisks(context({
      facts: assessments,
      competencyVector: vector(70, {
        controlModeling: { ...vector(80).controlModeling, score: 80 },
        crossDomainTransfer: { ...vector(40).crossDomainTransfer, score: 40 },
      }),
    }));

    expect(risks.find((risk) => risk.type === 'cross_domain')).toMatchObject({
      severity: 'high',
      evidence: { crossDomainRate: 0, totalAttempts: 3 },
    });
  });

  it('returns explicit current and clear evidence-risk state changes', () => {
    const previous = detectRisks(context({
      competencyVector: vector(55),
      previousSnapshot: vector(70),
    }));
    const current = detectRisks(context({
      competencyVector: vector(70),
      previousSnapshot: vector(70),
    }));

    expect(buildEvidenceRiskStateChanges({ previous, current })).toContainEqual(expect.objectContaining({
      riskKey: 'stagnation',
      type: 'stagnation',
      isActive: false,
    }));
  });

  it('does not emit unchanged risk state and timestamps a clear from the corrective transition', () => {
    const previous = detectCumulativePortraitRisks({
      userId: 'student-1',
      facts: [],
      currentPortrait: nativePortrait(40, {
        controlModelingRepresentation: 80,
        transferIntegratedApplication: 40,
      }),
    });
    expect(buildEvidenceRiskStateChanges({ previous, current: previous })).toEqual([]);

    const clearAt = new Date('2026-05-08T00:00:00.000Z');
    expect(buildEvidenceRiskStateChanges({ previous, current: [], clearAt }))
      .toContainEqual(expect.objectContaining({
        riskKey: 'cross_domain',
        isActive: false,
        occurredAt: clearAt,
      }));
  });

  it('keeps cumulative scaffolding recommendations compatible', () => {
    const risks = detectRisks(context({
      competencyVector: vector(70, {
        controlModeling: { ...vector(80).controlModeling, score: 80 },
        crossDomainTransfer: { ...vector(40).crossDomainTransfer, score: 40 },
      }),
    }));

    expect(getRecommendedScaffolding(risks)).toContain('跨域');
  });
});

function nativePortrait(
  score: number,
  overrides: Partial<Record<(typeof PORTRAIT_V2_DIMENSION_IDS)[number], number>> = {},
) {
  return createPortraitV2Payload({
    userId: 'student-1',
    generatedAt: evidenceAt.toISOString(),
    now: evidenceAt,
    dimensions: PORTRAIT_V2_DIMENSION_IDS.map((id) => ({
      id,
      score: overrides[id] ?? score,
      confidence: 0.8,
      freshness: { state: 'current', asOf: evidenceAt.toISOString(), evidenceAgeDays: 0 },
      evidenceSummary: { totalCount: 3, sourceFamilyCounts: { LearningFact: 3 } },
      lastPositiveEvidenceAt: evidenceAt.toISOString(),
      lastNegativeEvidenceAt: null,
      rationale: 'Governed evidence supports the current score.',
      limitations: [],
      sourceLineage: [{
        kind: 'evidence-family',
        ref: 'LearningFact',
        privacyScope: 'student-visible',
      }],
      calculationVersion: PORTRAIT_V2_CALCULATION_VERSION,
    })),
  });
}
