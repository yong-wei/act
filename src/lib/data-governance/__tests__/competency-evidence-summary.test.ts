import { describe, expect, it } from 'vitest';
import type { LearningFact } from '@prisma/client';

import { generateEvidenceSummary } from '../competency-engine';

function fact(overrides: Partial<LearningFact>): LearningFact {
  return {
    id: overrides.id ?? 'fact-1',
    userId: overrides.userId ?? 'user-1',
    factType: overrides.factType ?? 'question',
    moduleId: overrides.moduleId ?? 'step-12',
    sessionId: overrides.sessionId ?? 'session-1',
    startedAt: overrides.startedAt ?? new Date('2026-05-06T03:58:00Z'),
    finishedAt: overrides.finishedAt ?? new Date('2026-05-06T03:58:00Z'),
    outcome: overrides.outcome ?? 'success',
    score: overrides.score ?? 100,
    timeSpent: overrides.timeSpent ?? 90,
    competencyContribution: overrides.competencyContribution ?? { engineeringDecision: 0.9 },
    sourceEventId: overrides.sourceEventId ?? 'event-1',
    sourceLogId: overrides.sourceLogId ?? 'log-1',
    courseId: overrides.courseId ?? null,
    lessonId: overrides.lessonId ?? 'unit-4-1-design-task-expression-v1',
    contextJson: overrides.contextJson ?? {
      evidenceGovernance: {
        profileWeight: 1,
        skipProfileContribution: false,
        policyReason: 'unit-test-complete-governance',
      },
    },
    knowledgeIdentityNamespace: overrides.knowledgeIdentityNamespace ?? null,
    canonicalObjectId: overrides.canonicalObjectId ?? null,
    aggregateReleaseSetId: overrides.aggregateReleaseSetId ?? null,
    aggregateReleaseId: overrides.aggregateReleaseId ?? null,
    knowledgeProjectionId: overrides.knowledgeProjectionId ?? null,
    knowledgeRevisionRef: overrides.knowledgeRevisionRef ?? null,
    createdAt: overrides.createdAt ?? new Date('2026-05-06T03:58:01Z'),
  };
}

describe('generateEvidenceSummary', () => {
  it('keeps readable evidence details instead of only question-success', () => {
    const summary = generateEvidenceSummary([
      fact({
        sourceLogId: 'log-1',
        competencyContribution: {
          engineeringDecision: 0.9,
          parameterDesign: 0.7,
        },
      }),
    ], 3, {
      'log-1': {
        evidenceTitle: '4-1 后测：任务表达出口判断',
        stepId: 'step-12',
        questionSummaries: [
          {
            questionId: 'post-q1',
            prompt: '4-1 的出口是什么？',
            studentAnswer: 'B',
            referenceAnswer: 'B',
            isCorrect: true,
          },
        ],
      },
    });

    expect(summary.engineeringDecision[0]).toMatchObject({
      factType: 'question',
      outcome: 'success',
      score: 100,
      moduleId: 'step-12',
      lessonId: 'unit-4-1-design-task-expression-v1',
      evidenceTitle: '4-1 后测：任务表达出口判断',
    });
    expect(summary.engineeringDecision[0].questionSummaries?.[0]).toMatchObject({
      questionId: 'post-q1',
      studentAnswer: 'B',
      referenceAnswer: 'B',
      isCorrect: true,
    });
  });

  it('keeps zero-score evidence as an explicit score', () => {
    const summary = generateEvidenceSummary([
      fact({
        score: 0,
        outcome: 'failure',
        competencyContribution: {
          engineeringDecision: 0.9,
        },
      }),
    ]);

    expect(summary.engineeringDecision[0]).toMatchObject({
      outcome: 'failure',
      score: 0,
    });
  });
});
