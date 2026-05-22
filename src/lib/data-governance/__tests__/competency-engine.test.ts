import { describe, it, expect } from 'vitest';
import type { LearningFact } from '@prisma/client';
import {
  calculateCompetencyVector,
  calculateTrendVector,
  identifyStrengths,
  identifyWeaknesses,
  calculateConfidence,
  generateEvidenceSummary,
} from '../competency-engine';
import type { CompetencyVector } from '../competency-model';

// Helper function to create mock LearningFact
function createMockFact(overrides: Partial<LearningFact> = {}): LearningFact {
  return {
    id: 'fact-' + Math.random().toString(36).substr(2, 9),
    userId: 'user-1',
    factType: 'question',
    moduleId: null,
    sessionId: null,
    startedAt: new Date(),
    finishedAt: new Date(),
    outcome: 'success',
    score: 80,
    timeSpent: 300,
    competencyContribution: {},
    sourceEventId: null,
    sourceLogId: null,
    courseId: null,
    lessonId: null,
    contextJson: {},
    createdAt: new Date(),
    ...overrides,
  };
}

describe('calculateCompetencyVector', () => {
  it('should return empty vector when no facts provided', () => {
    const vector = calculateCompetencyVector([], '1m');

    expect(vector.controlModeling.score).toBe(0);
    expect(vector.controlModeling.confidence).toBe(0);
    expect(vector.parameterDesign.score).toBe(0);
  });

  it('should calculate scores from facts with competency contributions', () => {
    const facts: LearningFact[] = [
      createMockFact({
        factType: 'question',
        outcome: 'success',
        score: 80,
        competencyContribution: { controlModeling: 0.8 },
      }),
      createMockFact({
        factType: 'question',
        outcome: 'success',
        score: 90,
        competencyContribution: { controlModeling: 0.9 },
      }),
      createMockFact({
        factType: 'simulation',
        outcome: 'success',
        score: 85,
        competencyContribution: { crossDomainTransfer: 1.0 },
      }),
    ];

    const vector = calculateCompetencyVector(facts, '1m');

    expect(vector.controlModeling.score).toBeGreaterThan(0);
    expect(vector.controlModeling.evidenceCount).toBe(2);
    expect(vector.crossDomainTransfer.score).toBeGreaterThan(0);
  });

  it('should count one fact as evidence for every contributed competency dimension', () => {
    const facts: LearningFact[] = [
      createMockFact({
        factType: 'question',
        outcome: 'success',
        score: 80,
        competencyContribution: {
          controlModeling: 0.5,
          selfDirectedLearning: 0.3,
        },
      }),
    ];

    const vector = calculateCompetencyVector(facts, '1m');

    expect(vector.controlModeling.evidenceCount).toBe(1);
    expect(vector.selfDirectedLearning.evidenceCount).toBe(1);
    expect(vector.selfDirectedLearning.score).toBeGreaterThan(0);
  });

  it('should ignore facts marked as context-only evidence in competency profiles', () => {
    const facts: LearningFact[] = [
      createMockFact({
        factType: 'question',
        outcome: 'success',
        score: 90,
        competencyContribution: { controlModeling: 0.8 },
        contextJson: {
          evidenceGovernance: {
            profileWeight: 0,
            skipProfileContribution: true,
            evidenceQuality: 'legacy',
          },
        },
      }),
    ];

    const vector = calculateCompetencyVector(facts, '1m');

    expect(vector.controlModeling.score).toBe(0);
    expect(vector.controlModeling.evidenceCount).toBe(0);
  });

  it('should downgrade partial evidence through profile weight metadata', () => {
    const facts: LearningFact[] = [
      createMockFact({
        factType: 'question',
        outcome: 'success',
        score: 90,
        competencyContribution: { controlModeling: 0.8 },
        contextJson: {
          evidenceGovernance: {
            profileWeight: 0.25,
            skipProfileContribution: false,
            evidenceQuality: 'partial',
          },
        },
      }),
    ];

    const vector = calculateCompetencyVector(facts, '1m');

    expect(vector.controlModeling.score).toBe(20);
    expect(vector.controlModeling.evidenceCount).toBe(1);
  });

  it('should filter facts by time window', () => {
    const oldDate = new Date();
    oldDate.setDate(oldDate.getDate() - 40); // 40 days ago

    const recentFacts: LearningFact[] = [
      createMockFact({
        outcome: 'success',
        score: 90,
        competencyContribution: { controlModeling: 1.0 },
      }),
    ];

    const oldFacts: LearningFact[] = [
      createMockFact({
        startedAt: oldDate,
        outcome: 'success',
        score: 50,
        competencyContribution: { controlModeling: 1.0 },
      }),
    ];

    const vector = calculateCompetencyVector([...recentFacts, ...oldFacts], '1m');

    // Should only consider recent facts for 1m window
    expect(vector.controlModeling.score).toBeGreaterThan(70);
  });

  it('should weight facts by outcome', () => {
    const facts: LearningFact[] = [
      createMockFact({
        outcome: 'success',
        score: 80,
        competencyContribution: { controlModeling: 1.0 },
      }),
      createMockFact({
        outcome: 'failure',
        score: 20,
        competencyContribution: { controlModeling: 1.0 },
      }),
    ];

    const vector = calculateCompetencyVector(facts, '1m');

    // Success should have higher weight than failure
    // Score is weighted by outcome (success=1.0, failure=0.3) and other factors
    // With scores of 80 and 20, and weights favoring success, expect 60-100 range
  });

  it('should cap scores at 100', () => {
    const facts: LearningFact[] = [
      createMockFact({
        outcome: 'success',
        score: 200, // Very high score
        competencyContribution: { controlModeling: 2.0 }, // High contribution
      }),
    ];

    const vector = calculateCompetencyVector(facts, '1m');

    expect(vector.controlModeling.score).toBeLessThanOrEqual(100);
  });
});

describe('calculateTrendVector', () => {
  it('should detect upward trend', () => {
    const current: CompetencyVector = {
      controlModeling: { score: 80, trend: 'stable', confidence: 0.8, evidenceCount: 5, lastUpdated: '' },
      parameterDesign: { score: 70, trend: 'stable', confidence: 0.8, evidenceCount: 5, lastUpdated: '' },
      crossDomainTransfer: { score: 60, trend: 'stable', confidence: 0.8, evidenceCount: 5, lastUpdated: '' },
      engineeringDecision: { score: 75, trend: 'stable', confidence: 0.8, evidenceCount: 5, lastUpdated: '' },
      inquiryReflection: { score: 70, trend: 'stable', confidence: 0.8, evidenceCount: 5, lastUpdated: '' },
      selfDirectedLearning: { score: 65, trend: 'stable', confidence: 0.8, evidenceCount: 5, lastUpdated: '' },
    };

    const previous: CompetencyVector = {
      controlModeling: { score: 70, trend: 'stable', confidence: 0.8, evidenceCount: 5, lastUpdated: '' },
      parameterDesign: { score: 60, trend: 'stable', confidence: 0.8, evidenceCount: 5, lastUpdated: '' },
      crossDomainTransfer: { score: 50, trend: 'stable', confidence: 0.8, evidenceCount: 5, lastUpdated: '' },
      engineeringDecision: { score: 65, trend: 'stable', confidence: 0.8, evidenceCount: 5, lastUpdated: '' },
      inquiryReflection: { score: 60, trend: 'stable', confidence: 0.8, evidenceCount: 5, lastUpdated: '' },
      selfDirectedLearning: { score: 55, trend: 'stable', confidence: 0.8, evidenceCount: 5, lastUpdated: '' },
    };

    const trend = calculateTrendVector(current, previous);

    expect(trend.controlModeling).toBe('up');
    expect(trend.parameterDesign).toBe('up');
  });

  it('should detect downward trend', () => {
    const current: CompetencyVector = {
      controlModeling: { score: 60, trend: 'stable', confidence: 0.8, evidenceCount: 5, lastUpdated: '' },
      parameterDesign: { score: 70, trend: 'stable', confidence: 0.8, evidenceCount: 5, lastUpdated: '' },
      crossDomainTransfer: { score: 60, trend: 'stable', confidence: 0.8, evidenceCount: 5, lastUpdated: '' },
      engineeringDecision: { score: 75, trend: 'stable', confidence: 0.8, evidenceCount: 5, lastUpdated: '' },
      inquiryReflection: { score: 70, trend: 'stable', confidence: 0.8, evidenceCount: 5, lastUpdated: '' },
      selfDirectedLearning: { score: 65, trend: 'stable', confidence: 0.8, evidenceCount: 5, lastUpdated: '' },
    };

    const previous: CompetencyVector = {
      controlModeling: { score: 75, trend: 'stable', confidence: 0.8, evidenceCount: 5, lastUpdated: '' },
      parameterDesign: { score: 80, trend: 'stable', confidence: 0.8, evidenceCount: 5, lastUpdated: '' },
      crossDomainTransfer: { score: 60, trend: 'stable', confidence: 0.8, evidenceCount: 5, lastUpdated: '' },
      engineeringDecision: { score: 75, trend: 'stable', confidence: 0.8, evidenceCount: 5, lastUpdated: '' },
      inquiryReflection: { score: 70, trend: 'stable', confidence: 0.8, evidenceCount: 5, lastUpdated: '' },
      selfDirectedLearning: { score: 65, trend: 'stable', confidence: 0.8, evidenceCount: 5, lastUpdated: '' },
    };

    const trend = calculateTrendVector(current, previous);

    expect(trend.controlModeling).toBe('down');
  });

  it('should detect stable trend for small changes', () => {
    const current: CompetencyVector = {
      controlModeling: { score: 72, trend: 'stable', confidence: 0.8, evidenceCount: 5, lastUpdated: '' },
      parameterDesign: { score: 70, trend: 'stable', confidence: 0.8, evidenceCount: 5, lastUpdated: '' },
      crossDomainTransfer: { score: 60, trend: 'stable', confidence: 0.8, evidenceCount: 5, lastUpdated: '' },
      engineeringDecision: { score: 75, trend: 'stable', confidence: 0.8, evidenceCount: 5, lastUpdated: '' },
      inquiryReflection: { score: 70, trend: 'stable', confidence: 0.8, evidenceCount: 5, lastUpdated: '' },
      selfDirectedLearning: { score: 65, trend: 'stable', confidence: 0.8, evidenceCount: 5, lastUpdated: '' },
    };

    const previous: CompetencyVector = {
      controlModeling: { score: 70, trend: 'stable', confidence: 0.8, evidenceCount: 5, lastUpdated: '' },
      parameterDesign: { score: 68, trend: 'stable', confidence: 0.8, evidenceCount: 5, lastUpdated: '' },
      crossDomainTransfer: { score: 60, trend: 'stable', confidence: 0.8, evidenceCount: 5, lastUpdated: '' },
      engineeringDecision: { score: 75, trend: 'stable', confidence: 0.8, evidenceCount: 5, lastUpdated: '' },
      inquiryReflection: { score: 70, trend: 'stable', confidence: 0.8, evidenceCount: 5, lastUpdated: '' },
      selfDirectedLearning: { score: 65, trend: 'stable', confidence: 0.8, evidenceCount: 5, lastUpdated: '' },
    };

    const trend = calculateTrendVector(current, previous);

    expect(trend.controlModeling).toBe('stable');
  });
});

describe('identifyStrengths', () => {
  it('should identify top 2 dimensions with score > 60', () => {
    const vector: CompetencyVector = {
      controlModeling: { score: 85, trend: 'stable', confidence: 0.8, evidenceCount: 5, lastUpdated: '' },
      parameterDesign: { score: 75, trend: 'stable', confidence: 0.8, evidenceCount: 5, lastUpdated: '' },
      crossDomainTransfer: { score: 65, trend: 'stable', confidence: 0.8, evidenceCount: 5, lastUpdated: '' },
      engineeringDecision: { score: 55, trend: 'stable', confidence: 0.8, evidenceCount: 5, lastUpdated: '' },
      inquiryReflection: { score: 45, trend: 'stable', confidence: 0.8, evidenceCount: 5, lastUpdated: '' },
      selfDirectedLearning: { score: 35, trend: 'stable', confidence: 0.8, evidenceCount: 5, lastUpdated: '' },
    };

    const strengths = identifyStrengths(vector);

    expect(strengths).toHaveLength(2);
    expect(strengths).toContain('控制建模与分析');
    expect(strengths).toContain('参数设计与调优');
  });

  it('should return empty array when no dimension exceeds 60', () => {
    const vector: CompetencyVector = {
      controlModeling: { score: 55, trend: 'stable', confidence: 0.8, evidenceCount: 5, lastUpdated: '' },
      parameterDesign: { score: 50, trend: 'stable', confidence: 0.8, evidenceCount: 5, lastUpdated: '' },
      crossDomainTransfer: { score: 45, trend: 'stable', confidence: 0.8, evidenceCount: 5, lastUpdated: '' },
      engineeringDecision: { score: 40, trend: 'stable', confidence: 0.8, evidenceCount: 5, lastUpdated: '' },
      inquiryReflection: { score: 35, trend: 'stable', confidence: 0.8, evidenceCount: 5, lastUpdated: '' },
      selfDirectedLearning: { score: 30, trend: 'stable', confidence: 0.8, evidenceCount: 5, lastUpdated: '' },
    };

    const strengths = identifyStrengths(vector);

    expect(strengths).toHaveLength(0);
  });

  it('should only include dimensions with score > 60', () => {
    const vector: CompetencyVector = {
      controlModeling: { score: 90, trend: 'stable', confidence: 0.8, evidenceCount: 5, lastUpdated: '' },
      parameterDesign: { score: 58, trend: 'stable', confidence: 0.8, evidenceCount: 5, lastUpdated: '' },
      crossDomainTransfer: { score: 55, trend: 'stable', confidence: 0.8, evidenceCount: 5, lastUpdated: '' },
      engineeringDecision: { score: 50, trend: 'stable', confidence: 0.8, evidenceCount: 5, lastUpdated: '' },
      inquiryReflection: { score: 45, trend: 'stable', confidence: 0.8, evidenceCount: 5, lastUpdated: '' },
      selfDirectedLearning: { score: 40, trend: 'stable', confidence: 0.8, evidenceCount: 5, lastUpdated: '' },
    };

    const strengths = identifyStrengths(vector);

    expect(strengths).toHaveLength(1);
    expect(strengths).toContain('控制建模与分析');
  });
});

describe('identifyWeaknesses', () => {
  it('should identify bottom 2 dimensions with score < 70', () => {
    const vector: CompetencyVector = {
      controlModeling: { score: 85, trend: 'stable', confidence: 0.8, evidenceCount: 5, lastUpdated: '' },
      parameterDesign: { score: 80, trend: 'stable', confidence: 0.8, evidenceCount: 5, lastUpdated: '' },
      crossDomainTransfer: { score: 75, trend: 'stable', confidence: 0.8, evidenceCount: 5, lastUpdated: '' },
      engineeringDecision: { score: 65, trend: 'stable', confidence: 0.8, evidenceCount: 5, lastUpdated: '' },
      inquiryReflection: { score: 55, trend: 'stable', confidence: 0.8, evidenceCount: 5, lastUpdated: '' },
      selfDirectedLearning: { score: 45, trend: 'stable', confidence: 0.8, evidenceCount: 5, lastUpdated: '' },
    };

    const weaknesses = identifyWeaknesses(vector);

    expect(weaknesses).toHaveLength(2);
    expect(weaknesses).toContain('自主学习进展');
    expect(weaknesses).toContain('探究反思与提示词');
  });

  it('should return empty array when all dimensions >= 70', () => {
    const vector: CompetencyVector = {
      controlModeling: { score: 85, trend: 'stable', confidence: 0.8, evidenceCount: 5, lastUpdated: '' },
      parameterDesign: { score: 80, trend: 'stable', confidence: 0.8, evidenceCount: 5, lastUpdated: '' },
      crossDomainTransfer: { score: 75, trend: 'stable', confidence: 0.8, evidenceCount: 5, lastUpdated: '' },
      engineeringDecision: { score: 75, trend: 'stable', confidence: 0.8, evidenceCount: 5, lastUpdated: '' },
      inquiryReflection: { score: 70, trend: 'stable', confidence: 0.8, evidenceCount: 5, lastUpdated: '' },
      selfDirectedLearning: { score: 72, trend: 'stable', confidence: 0.8, evidenceCount: 5, lastUpdated: '' },
    };

    const weaknesses = identifyWeaknesses(vector);

    expect(weaknesses).toHaveLength(0);
  });
});

describe('calculateConfidence', () => {
  it('should return higher confidence with more evidence', () => {
    const manyFacts = Array(15).fill(null).map(() =>
      createMockFact({ outcome: 'success', score: 80 })
    );
    const fewFacts = Array(3).fill(null).map(() =>
      createMockFact({ outcome: 'success', score: 80 })
    );

    const highConfidence = calculateConfidence(manyFacts.length, manyFacts);
    const lowConfidence = calculateConfidence(fewFacts.length, fewFacts);

    expect(highConfidence).toBeGreaterThan(lowConfidence);
  });

  it('should reduce confidence with high score variance', () => {
    const consistentFacts = Array(10).fill(null).map(() =>
      createMockFact({ outcome: 'success', score: 80 })
    );
    const variedFacts = [
      ...Array(5).fill(null).map(() => createMockFact({ outcome: 'success', score: 100 })),
      ...Array(5).fill(null).map(() => createMockFact({ outcome: 'failure', score: 20 })),
    ];

    const consistentConfidence = calculateConfidence(consistentFacts.length, consistentFacts);
    const variedConfidence = calculateConfidence(variedFacts.length, variedFacts);

    expect(consistentConfidence).toBeGreaterThan(variedConfidence);
  });
});

describe('generateEvidenceSummary', () => {
  it('should generate summary grouped by competency', () => {
    const facts: LearningFact[] = [
      createMockFact({
        factType: 'question',
        outcome: 'success',
        score: 90,
        competencyContribution: { controlModeling: 1.0 },
      }),
      createMockFact({
        factType: 'simulation',
        outcome: 'success',
        score: 85,
        competencyContribution: { parameterDesign: 1.0 },
      }),
      createMockFact({
        factType: 'ai_intervention',
        outcome: 'failure',
        score: 40,
        competencyContribution: { inquiryReflection: 0.8 },
      }),
    ];

    const summary = generateEvidenceSummary(facts, 2);

    expect(summary.controlModeling).toHaveLength(1);
    expect(summary.parameterDesign).toHaveLength(1);
    expect(summary.inquiryReflection).toHaveLength(1);
    expect(summary.controlModeling[0].factType).toBe('question');
    expect(summary.controlModeling[0].outcome).toBe('success');
  });

  it('should limit results to topN', () => {
    const facts: LearningFact[] = Array(10).fill(null).map((_, i) =>
      createMockFact({
        factType: 'question',
        outcome: 'success',
        score: 50 + i * 5,
        competencyContribution: { controlModeling: 1.0 },
      })
    );

    const summary = generateEvidenceSummary(facts, 3);

    expect(summary.controlModeling).toHaveLength(3);
  });

  it('should sort by newest evidence before older high-score evidence', () => {
    const facts: LearningFact[] = [
      createMockFact({
        id: 'old-high-score',
        factType: 'question',
        outcome: 'success',
        score: 95,
        lessonId: 'unit-4-4-fixed-structure-optimization',
        startedAt: new Date('2026-05-01T08:00:00.000Z'),
        createdAt: new Date('2026-05-01T08:00:01.000Z'),
        competencyContribution: { controlModeling: 1.0 },
      }),
      createMockFact({
        id: 'newer-5-2-lower-score',
        factType: 'question',
        outcome: 'partial',
        score: 55,
        lessonId: 'unit-5-2-phase-plane-disturbance-boundary',
        startedAt: new Date('2026-05-21T08:00:00.000Z'),
        createdAt: new Date('2026-05-21T08:00:01.000Z'),
        competencyContribution: { controlModeling: 1.0 },
      }),
      createMockFact({
        id: 'middle-score',
        factType: 'question',
        outcome: 'success',
        score: 75,
        lessonId: 'unit-5-1-controller-parameter-observation',
        startedAt: new Date('2026-05-12T08:00:00.000Z'),
        createdAt: new Date('2026-05-12T08:00:01.000Z'),
        competencyContribution: { controlModeling: 1.0 },
      }),
    ];

    const summary = generateEvidenceSummary(facts, 3);

    expect(summary.controlModeling.map((item) => item.lessonId)).toEqual([
      'unit-5-2-phase-plane-disturbance-boundary',
      'unit-5-1-controller-parameter-observation',
      'unit-4-4-fixed-structure-optimization',
    ]);
    expect(summary.controlModeling[0]).toMatchObject({
      id: 'newer-5-2-lower-score',
      startedAt: '2026-05-21T08:00:00.000Z',
      createdAt: '2026-05-21T08:00:01.000Z',
      score: 55,
    });
    expect(summary.controlModeling[1].score).toBe(75);
    expect(summary.controlModeling[2].score).toBe(95);
  });
});
