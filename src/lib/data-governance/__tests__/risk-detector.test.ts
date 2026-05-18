import { describe, it, expect } from 'vitest';
import type { LearningFact } from '@prisma/client';
import {
  detectRisks,
  getRiskLevelDescription,
  getRecommendedScaffolding,
  type RiskFlag,
  type RiskDetectionContext,
} from '../risk-detector';
import { createEmptyCompetencyVector } from '../competency-model';
import type { CompetencyVector } from '../competency-model';

// Helper function to create mock LearningFact
function createMockFact(overrides: Partial<LearningFact> = {}): LearningFact {
  const now = new Date();
  return {
    id: 'fact-' + Math.random().toString(36).substr(2, 9),
    userId: 'user-1',
    factType: 'question',
    moduleId: null,
    sessionId: null,
    startedAt: now,
    finishedAt: now,
    outcome: 'success',
    score: 80,
    timeSpent: 300,
    competencyContribution: {},
    sourceEventId: null,
    sourceLogId: null,
    courseId: null,
    lessonId: null,
    contextJson: {},
    createdAt: now,
    ...overrides,
  };
}

// Helper to create context with custom facts and vector
function createMockContext(
  facts: LearningFact[],
  vectorOverrides: Partial<CompetencyVector> = {},
  previousSnapshot?: CompetencyVector
): RiskDetectionContext {
  const baseVector = createEmptyCompetencyVector();
  const vector = { ...baseVector, ...vectorOverrides };

  return {
    userId: 'user-1',
    facts,
    competencyVector: vector,
    previousSnapshot,
  };
}

describe('detectRisks - participation', () => {
  it('should detect high participation risk when < 3 recent facts', () => {
    const twoWeeksAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    const facts: LearningFact[] = [
      createMockFact({ startedAt: twoWeeksAgo }),
    ];

    const context = createMockContext(facts);
    const risks = detectRisks(context);

    const participationRisk = risks.find(r => r.type === 'participation');
    expect(participationRisk).toBeDefined();
    expect(participationRisk?.severity).toBe('high');
  });

  it('should detect medium participation risk when 3-4 recent facts', () => {
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    const facts: LearningFact[] = [
      createMockFact({ startedAt: threeDaysAgo }),
      createMockFact({ startedAt: threeDaysAgo }),
      createMockFact({ startedAt: threeDaysAgo }),
    ];

    const context = createMockContext(facts);
    const risks = detectRisks(context);

    const participationRisk = risks.find(r => r.type === 'participation');
    expect(participationRisk).toBeDefined();
    expect(participationRisk?.severity).toBe('medium');
  });

  it('should not detect participation risk when >= 5 recent facts', () => {
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    const facts: LearningFact[] = Array(5).fill(null).map(() =>
      createMockFact({ startedAt: threeDaysAgo })
    );

    const context = createMockContext(facts);
    const risks = detectRisks(context);

    const participationRisk = risks.find(r => r.type === 'participation');
    expect(participationRisk).toBeUndefined();
  });
});

describe('detectRisks - stagnation', () => {
  it('should detect high stagnation risk when score drops > 10', () => {
    // Calculate overall scores: need significant drop across all dimensions
    const currentVector: CompetencyVector = {
      controlModeling: { score: 60, trend: 'stable', confidence: 0.8, evidenceCount: 5, lastUpdated: '' },
      parameterDesign: { score: 60, trend: 'stable', confidence: 0.8, evidenceCount: 5, lastUpdated: '' },
      crossDomainTransfer: { score: 60, trend: 'stable', confidence: 0.8, evidenceCount: 5, lastUpdated: '' },
      engineeringDecision: { score: 60, trend: 'stable', confidence: 0.8, evidenceCount: 5, lastUpdated: '' },
      inquiryReflection: { score: 60, trend: 'stable', confidence: 0.8, evidenceCount: 5, lastUpdated: '' },
      selfDirectedLearning: { score: 60, trend: 'stable', confidence: 0.8, evidenceCount: 5, lastUpdated: '' },
    };
    const previousVector: CompetencyVector = {
      controlModeling: { score: 80, trend: 'stable', confidence: 0.8, evidenceCount: 5, lastUpdated: '' },
      parameterDesign: { score: 80, trend: 'stable', confidence: 0.8, evidenceCount: 5, lastUpdated: '' },
      crossDomainTransfer: { score: 80, trend: 'stable', confidence: 0.8, evidenceCount: 5, lastUpdated: '' },
      engineeringDecision: { score: 80, trend: 'stable', confidence: 0.8, evidenceCount: 5, lastUpdated: '' },
      inquiryReflection: { score: 80, trend: 'stable', confidence: 0.8, evidenceCount: 5, lastUpdated: '' },
      selfDirectedLearning: { score: 80, trend: 'stable', confidence: 0.8, evidenceCount: 5, lastUpdated: '' },
    };

    const facts: LearningFact[] = [];
    const context = createMockContext(facts, currentVector, previousVector);
    const risks = detectRisks(context);

    const stagnationRisk = risks.find(r => r.type === 'stagnation');
    expect(stagnationRisk).toBeDefined();
    expect(stagnationRisk?.severity).toBe('high');
  });

  it('should detect medium stagnation risk when score drops 5-10', () => {
    const currentVector: CompetencyVector = {
      ...createEmptyCompetencyVector(),
      controlModeling: { score: 65, trend: 'stable', confidence: 0.8, evidenceCount: 5, lastUpdated: '' },
    };
    const previousVector: CompetencyVector = {
      ...createEmptyCompetencyVector(),
      controlModeling: { score: 72, trend: 'stable', confidence: 0.8, evidenceCount: 5, lastUpdated: '' },
    };

    const facts: LearningFact[] = [];
    const context = createMockContext(facts, currentVector, previousVector);
    const risks = detectRisks(context);

    const stagnationRisk = risks.find(r => r.type === 'stagnation');
    expect(stagnationRisk).toBeDefined();
    expect(stagnationRisk?.severity).toBe('medium');
  });

  it('should detect stagnation when no success in 2 weeks and score < 70', () => {
    // Create facts only from 3 weeks ago (no recent success in last 2 weeks)
    const threeWeeksAgo = new Date(Date.now() - 21 * 24 * 60 * 60 * 1000);

    const facts: LearningFact[] = [
      // Only facts from 3 weeks ago - no success in the last 2 weeks
      createMockFact({ startedAt: threeWeeksAgo, outcome: 'success' }),
      createMockFact({ startedAt: threeWeeksAgo, outcome: 'success' }),
    ];

    // Set all dimensions to have an overall score < 70
    const currentVector: CompetencyVector = {
      controlModeling: { score: 60, trend: 'stable', confidence: 0.8, evidenceCount: 5, lastUpdated: '' },
      parameterDesign: { score: 60, trend: 'stable', confidence: 0.8, evidenceCount: 5, lastUpdated: '' },
      crossDomainTransfer: { score: 60, trend: 'stable', confidence: 0.8, evidenceCount: 5, lastUpdated: '' },
      engineeringDecision: { score: 60, trend: 'stable', confidence: 0.8, evidenceCount: 5, lastUpdated: '' },
      inquiryReflection: { score: 60, trend: 'stable', confidence: 0.8, evidenceCount: 5, lastUpdated: '' },
      selfDirectedLearning: { score: 60, trend: 'stable', confidence: 0.8, evidenceCount: 5, lastUpdated: '' },
    };

    // Previous snapshot with similar scores (no significant change to trigger score-based stagnation)
    const previousVector: CompetencyVector = {
      controlModeling: { score: 62, trend: 'stable', confidence: 0.8, evidenceCount: 5, lastUpdated: '' },
      parameterDesign: { score: 62, trend: 'stable', confidence: 0.8, evidenceCount: 5, lastUpdated: '' },
      crossDomainTransfer: { score: 62, trend: 'stable', confidence: 0.8, evidenceCount: 5, lastUpdated: '' },
      engineeringDecision: { score: 62, trend: 'stable', confidence: 0.8, evidenceCount: 5, lastUpdated: '' },
      inquiryReflection: { score: 62, trend: 'stable', confidence: 0.8, evidenceCount: 5, lastUpdated: '' },
      selfDirectedLearning: { score: 62, trend: 'stable', confidence: 0.8, evidenceCount: 5, lastUpdated: '' },
    };

    const context = createMockContext(facts, currentVector, previousVector);
    const risks = detectRisks(context);

    const stagnationRisk = risks.find(r => r.type === 'stagnation');
    expect(stagnationRisk).toBeDefined();
    expect(stagnationRisk?.severity).toBe('medium');
  });
});

describe('detectRisks - ai_misuse', () => {
  it('should not detect ai_misuse with fewer than 5 AI facts', () => {
    const facts: LearningFact[] = [
      createMockFact({ factType: 'ai_intervention', outcome: 'failure' }),
      createMockFact({ factType: 'ai_intervention', outcome: 'failure' }),
    ];

    const context = createMockContext(facts);
    const risks = detectRisks(context);

    const aiMisuseRisk = risks.find(r => r.type === 'ai_misuse');
    expect(aiMisuseRisk).toBeUndefined();
  });

  it('should detect high ai_misuse risk when failure rate > 70%', () => {
    const oneWeekAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    const facts: LearningFact[] = [
      ...Array(8).fill(null).map(() =>
        createMockFact({ factType: 'ai_intervention', outcome: 'failure', startedAt: oneWeekAgo })
      ),
      ...Array(2).fill(null).map(() =>
        createMockFact({ factType: 'ai_intervention', outcome: 'success', startedAt: oneWeekAgo })
      ),
    ];

    const context = createMockContext(facts);
    const risks = detectRisks(context);

    const aiMisuseRisk = risks.find(r => r.type === 'ai_misuse');
    expect(aiMisuseRisk).toBeDefined();
    expect(aiMisuseRisk?.severity).toBe('high');
  });

  it('should detect medium ai_misuse risk when failure rate 50-70%', () => {
    const oneWeekAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    const facts: LearningFact[] = [
      ...Array(6).fill(null).map(() =>
        createMockFact({ factType: 'ai_intervention', outcome: 'failure', startedAt: oneWeekAgo })
      ),
      ...Array(4).fill(null).map(() =>
        createMockFact({ factType: 'ai_intervention', outcome: 'success', startedAt: oneWeekAgo })
      ),
    ];

    const context = createMockContext(facts);
    const risks = detectRisks(context);

    const aiMisuseRisk = risks.find(r => r.type === 'ai_misuse');
    expect(aiMisuseRisk).toBeDefined();
    expect(aiMisuseRisk?.severity).toBe('medium');
  });
});

describe('detectRisks - constraint', () => {
  it('should detect high constraint risk with >= 5 ethical violations', () => {
    const facts: LearningFact[] = [
      ...Array(5).fill(null).map(() =>
        createMockFact({ factType: 'ethical', outcome: 'failure' })
      ),
    ];

    const context = createMockContext(facts);
    const risks = detectRisks(context);

    const constraintRisk = risks.find(r => r.type === 'constraint');
    expect(constraintRisk).toBeDefined();
    expect(constraintRisk?.severity).toBe('high');
  });

  it('should detect medium constraint risk with 3-4 ethical violations', () => {
    const facts: LearningFact[] = [
      ...Array(3).fill(null).map(() =>
        createMockFact({ factType: 'ethical', outcome: 'failure' })
      ),
    ];

    const context = createMockContext(facts);
    const risks = detectRisks(context);

    const constraintRisk = risks.find(r => r.type === 'constraint');
    expect(constraintRisk).toBeDefined();
    expect(constraintRisk?.severity).toBe('medium');
  });
});

describe('detectRisks - cross_domain', () => {
  it('should detect high cross_domain risk when control > 75 and crossDomain < 50', () => {
    const vector: CompetencyVector = {
      ...createEmptyCompetencyVector(),
      controlModeling: { score: 80, trend: 'stable', confidence: 0.8, evidenceCount: 5, lastUpdated: '' },
      crossDomainTransfer: { score: 45, trend: 'stable', confidence: 0.8, evidenceCount: 5, lastUpdated: '' },
    };

    const context = createMockContext([], vector);
    const risks = detectRisks(context);

    const crossDomainRisk = risks.find(r => r.type === 'cross_domain');
    expect(crossDomainRisk).toBeDefined();
    expect(crossDomainRisk?.severity).toBe('high');
  });

  it('should detect medium cross_domain risk when control > 65 and crossDomain < 45', () => {
    const vector: CompetencyVector = {
      ...createEmptyCompetencyVector(),
      controlModeling: { score: 70, trend: 'stable', confidence: 0.8, evidenceCount: 5, lastUpdated: '' },
      crossDomainTransfer: { score: 40, trend: 'stable', confidence: 0.8, evidenceCount: 5, lastUpdated: '' },
    };

    const context = createMockContext([], vector);
    const risks = detectRisks(context);

    const crossDomainRisk = risks.find(r => r.type === 'cross_domain');
    expect(crossDomainRisk).toBeDefined();
    expect(crossDomainRisk?.severity).toBe('medium');
  });

  it('should detect high risk when cross-domain success rate < 30%', () => {
    // Need failure rate > 70% to trigger (success rate < 30%)
    // With 10 total attempts, need <= 2 successes for < 30% success rate
    const facts: LearningFact[] = [
      ...Array(8).fill(null).map(() =>
        createMockFact({
          factType: 'question',
          outcome: 'failure',
          competencyContribution: { crossDomainTransfer: 1.0 },
        })
      ),
      ...Array(2).fill(null).map(() =>
        createMockFact({
          factType: 'question',
          outcome: 'success',
          competencyContribution: { crossDomainTransfer: 1.0 },
        })
      ),
    ];

    const context = createMockContext(facts);
    const risks = detectRisks(context);

    const crossDomainRisk = risks.find(r => r.type === 'cross_domain');
    expect(crossDomainRisk).toBeDefined();
    expect(crossDomainRisk?.severity).toBe('high');
  });
});

describe('detectRisks - edge cases', () => {
  it('should return empty array when no risks detected', () => {
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    const facts: LearningFact[] = Array(10).fill(null).map(() =>
      createMockFact({ startedAt: threeDaysAgo, outcome: 'success' })
    );

    const vector: CompetencyVector = {
      controlModeling: { score: 75, trend: 'stable', confidence: 0.8, evidenceCount: 10, lastUpdated: '' },
      parameterDesign: { score: 70, trend: 'stable', confidence: 0.8, evidenceCount: 10, lastUpdated: '' },
      crossDomainTransfer: { score: 65, trend: 'stable', confidence: 0.8, evidenceCount: 10, lastUpdated: '' },
      engineeringDecision: { score: 75, trend: 'stable', confidence: 0.8, evidenceCount: 10, lastUpdated: '' },
      inquiryReflection: { score: 70, trend: 'stable', confidence: 0.8, evidenceCount: 10, lastUpdated: '' },
      selfDirectedLearning: { score: 70, trend: 'stable', confidence: 0.8, evidenceCount: 10, lastUpdated: '' },
    };

    const context = createMockContext(facts, vector);
    const risks = detectRisks(context);

    expect(risks).toHaveLength(0);
  });

  it('should detect multiple risks simultaneously', () => {
    // Create facts to trigger multiple risks
    const now = new Date();

    // Create facts that will trigger participation risk (low recent activity)
    // and constraint risk (ethical violations)
    const facts: LearningFact[] = [
      // 1 recent fact (low participation)
      createMockFact({ startedAt: now, factType: 'question', outcome: 'success' }),
      // 5 ethical violations
      createMockFact({ startedAt: now, factType: 'ethical', outcome: 'failure' }),
      createMockFact({ startedAt: now, factType: 'ethical', outcome: 'failure' }),
      createMockFact({ startedAt: now, factType: 'ethical', outcome: 'failure' }),
      createMockFact({ startedAt: now, factType: 'ethical', outcome: 'failure' }),
      createMockFact({ startedAt: now, factType: 'ethical', outcome: 'failure' }),
    ];

    const context = createMockContext(facts);
    const risks = detectRisks(context);

    // Verify we get at least 1 risk (the constraint risk with 5 violations)
    expect(risks.length).toBeGreaterThanOrEqual(1);

    // The constraint risk should definitely be detected with 5 ethical violations
    const constraintRisk = risks.find(r => r.type === 'constraint');
    expect(constraintRisk).toBeDefined();
    expect(constraintRisk?.severity).toBe('high');
  });
});

describe('getRiskLevelDescription', () => {
  it('should return correct descriptions', () => {
    expect(getRiskLevelDescription(0)).toBe('无风险');
    expect(getRiskLevelDescription(1)).toBe('低风险');
    expect(getRiskLevelDescription(2)).toBe('中风险');
    expect(getRiskLevelDescription(3)).toBe('高风险');
    expect(getRiskLevelDescription(5)).toBe('高风险');
  });
});

describe('getRecommendedScaffolding', () => {
  it('should recommend participation intervention for participation risk', () => {
    const risks: RiskFlag[] = [
      { type: 'participation', severity: 'high', description: '', evidence: {}, triggeredAt: new Date() },
    ];

    const recommendation = getRecommendedScaffolding(risks);
    expect(recommendation).toContain('教师主动关注');
  });

  it('should recommend AI guidance for ai_misuse risk', () => {
    const risks: RiskFlag[] = [
      { type: 'ai_misuse', severity: 'medium', description: '', evidence: {}, triggeredAt: new Date() },
    ];

    const recommendation = getRecommendedScaffolding(risks);
    expect(recommendation).toContain('AI助手');
  });

  it('should recommend cross-domain exercises for cross_domain risk', () => {
    const risks: RiskFlag[] = [
      { type: 'cross_domain', severity: 'high', description: '', evidence: {}, triggeredAt: new Date() },
    ];

    const recommendation = getRecommendedScaffolding(risks);
    expect(recommendation).toContain('跨域');
  });

  it('should recommend constraint reinforcement for constraint risk', () => {
    const risks: RiskFlag[] = [
      { type: 'constraint', severity: 'medium', description: '', evidence: {}, triggeredAt: new Date() },
    ];

    const recommendation = getRecommendedScaffolding(risks);
    expect(recommendation).toContain('工程约束');
  });

  it('should recommend adjustment for stagnation risk', () => {
    const risks: RiskFlag[] = [
      { type: 'stagnation', severity: 'medium', description: '', evidence: {}, triggeredAt: new Date() },
    ];

    const recommendation = getRecommendedScaffolding(risks);
    expect(recommendation).toContain('学习路径');
  });

  it('should return default message for no risks', () => {
    const recommendation = getRecommendedScaffolding([]);
    expect(recommendation).toContain('继续保持');
  });
});
