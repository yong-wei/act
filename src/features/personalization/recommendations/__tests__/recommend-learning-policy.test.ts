import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { recommendLearning, PersonalizationPolicyScopeError } from '../public-api';
import { PERSONALIZATION_RECOMMENDATION_POLICY_REVISION } from '../constants';
import type { RecommendationEvidenceDb } from '@/features/learning-record/personalization-ports/types';

function emptyDb(): RecommendationEvidenceDb {
  return {
    studentEvidenceFeatureCache: {
      findUnique: async () => null,
    },
    studentCompetencySnapshot: {
      findFirst: async () => null,
    },
    studentRiskFlag: {
      findMany: async () => [],
    },
    learningFact: {
      findMany: async () => [],
    },
    userProgress: {
      count: async () => 0,
    },
  };
}

describe('RecommendLearning policy', () => {
  it('returns compatible recommendation fields, policy metadata, and no mastery grant', async () => {
    const first = await recommendLearning({
      actorUserId: 'student-1',
      subjectUserId: 'student-1',
      role: 'STUDENT',
      db: emptyDb(),
    });
    const second = await recommendLearning({
      actorUserId: 'student-1',
      subjectUserId: 'student-1',
      role: 'STUDENT',
      db: emptyDb(),
    });

    expect(first.grantsMastery).toBe(false);
    expect(first.policyRevision).toBe(PERSONALIZATION_RECOMMENDATION_POLICY_REVISION);
    expect(first.ownerUserId).toBe('student-1');
    expect(first.recommendations.map((item) => item.id)).toEqual(second.recommendations.map((item) => item.id));
    for (const item of first.recommendations) {
      expect(item).toEqual(expect.objectContaining({
        id: expect.any(String),
        type: expect.stringMatching(/immediate|weekly|challenge/),
        title: expect.any(String),
        description: expect.any(String),
        reason: expect.any(String),
        actionUrl: expect.any(String),
        actionLabel: expect.any(String),
        priority: expect.any(Number),
        tags: expect.any(Array),
        rationale: expect.objectContaining({
          reasonCode: expect.any(String),
          evidenceBasis: expect.any(String),
          confidence: expect.objectContaining({
            state: expect.any(String),
            level: expect.any(String),
            score: expect.any(Number),
          }),
        }),
        policyRevision: PERSONALIZATION_RECOMMENDATION_POLICY_REVISION,
        ownerUserId: 'student-1',
        privacyClass: 'learner-owner',
      }));
    }
  });

  it('fails closed when a student requests another learner', async () => {
    await expect(recommendLearning({
      actorUserId: 'student-1',
      subjectUserId: 'student-2',
      role: 'STUDENT',
      db: emptyDb(),
    })).rejects.toBeInstanceOf(PersonalizationPolicyScopeError);
  });
});

describe('recommendation engine source boundary', () => {
  it('does not import Prisma in the policy engine', () => {
    const source = readFileSync('src/features/personalization/recommendations/engine.ts', 'utf8');
    expect(source).not.toMatch(/from ['"]@\/lib\/prisma['"]/);
    expect(source).not.toMatch(/from ['"]next(?:\/|['"])/);
    expect(source).not.toMatch(/id: `\$\{rule\.id\}-\$\{Date\.now\(\)\}`/);
  });
});
