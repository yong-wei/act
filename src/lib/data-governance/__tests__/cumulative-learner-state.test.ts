import { describe, expect, it } from 'vitest';

import {
  buildLearnerFactTransitionDraft,
  planMissingLearningFactUpserts,
  reduceLearnerFactTransitions,
  requiresFullLearnerRebuild,
  type LearnerFactTransitionRow,
} from '../cumulative-learner-state';
import type { PortraitLearningFactDelta } from '../portrait-v2-incremental-update';

function fact(
  id: string,
  startedAt: string,
  contribution = 0.5,
): PortraitLearningFactDelta {
  return {
    id,
    startedAt: new Date(startedAt),
    outcome: 'success',
    score: 1,
    competencyContribution: { controlModeling: contribution },
    contextJson: {},
    createdAt: new Date('2026-05-10T00:00:00.000Z'),
  };
}

function transition(input: {
  id: string;
  sequence: bigint;
  fact: PortraitLearningFactDelta;
  operation?: 'UPSERT' | 'CORRECT' | 'REVOKE';
  correctionOfSequence?: bigint;
  correctedFact?: PortraitLearningFactDelta;
}): LearnerFactTransitionRow {
  const draft = buildLearnerFactTransitionDraft({
    userId: 'student-1',
    fact: input.fact,
    operation: input.operation ?? 'UPSERT',
    correctionOfSequence: input.correctionOfSequence,
    correctedFact: input.correctedFact,
  });
  return {
    id: input.id,
    sequence: input.sequence,
    createdAt: new Date('2026-05-11T00:00:00.000Z'),
    ...draft,
  };
}

describe('cumulative learner transition reducer', () => {
  it('plans first materialization UPSERTs in stable startedAt/id order', () => {
    const facts = [
      fact('b', '2026-05-02T00:00:00.000Z'),
      fact('c', '2026-05-01T00:00:00.000Z'),
      fact('a', '2026-05-02T00:00:00.000Z'),
    ];

    expect(planMissingLearningFactUpserts({
      userId: 'student-1',
      facts,
      transitions: [],
    }).map((item) => item.factId)).toEqual(['c', 'a', 'b']);
  });

  it('is insensitive to transition input order and retry duplicates', () => {
    const facts = [
      fact('a', '2026-05-02T00:00:00.000Z'),
      fact('b', '2026-05-01T00:00:00.000Z'),
    ];
    const a = transition({ id: 't-a', sequence: BigInt(2), fact: facts[0] });
    const b = transition({ id: 't-b', sequence: BigInt(1), fact: facts[1] });

    const first = reduceLearnerFactTransitions({ facts, transitions: [a, b, a] });
    const second = reduceLearnerFactTransitions({ facts, transitions: [b, a] });

    expect(first).toEqual(second);
    expect(first.activeFacts.map((item) => item.id)).toEqual(['b', 'a']);
  });

  it('applies CORRECT without mutating LearningFact and REVOKE removes support', () => {
    const original = fact('a', '2026-05-01T00:00:00.000Z', 0.2);
    const corrected = fact('a', '2026-04-01T00:00:00.000Z', 0.9);
    const upsert = transition({ id: 't-1', sequence: BigInt(1), fact: original });
    const correction = transition({
      id: 't-2',
      sequence: BigInt(2),
      fact: original,
      operation: 'CORRECT',
      correctionOfSequence: BigInt(1),
      correctedFact: corrected,
    });

    const correctedState = reduceLearnerFactTransitions({
      facts: [original],
      transitions: [upsert, correction],
    });
    expect(correctedState.activeFacts[0]).toMatchObject({
      id: 'a',
      competencyContribution: { controlModeling: 0.9 },
    });
    expect(original.competencyContribution).toEqual({ controlModeling: 0.2 });

    const revoked = reduceLearnerFactTransitions({
      facts: [original],
      transitions: [
        upsert,
        correction,
        transition({
          id: 't-3',
          sequence: BigInt(3),
          fact: original,
          operation: 'REVOKE',
          correctionOfSequence: BigInt(2),
        }),
      ],
    });
    expect(revoked.activeFacts).toEqual([]);
    expect(revoked.stateWatermark).toBe(BigInt(3));
  });

  it('requires learner rebuild for late, correction, revocation, and version changes', () => {
    const currentFact = fact('current', '2026-05-02T00:00:00.000Z');
    const lateFact = fact('late', '2026-05-01T00:00:00.000Z');
    const late = transition({ id: 't-late', sequence: BigInt(2), fact: lateFact });
    const base = {
      currentWatermark: BigInt(1),
      currentCalculationVersion: 'portrait-v2-cumulative.v2',
      targetCalculationVersion: 'portrait-v2-cumulative.v2',
      currentLatestOccurredAt: currentFact.startedAt,
      currentLatestFactId: currentFact.id,
    };

    expect(requiresFullLearnerRebuild({ ...base, transitions: [late] })).toBe(true);
    expect(requiresFullLearnerRebuild({
      ...base,
      currentCalculationVersion: 'portrait-v2-primary.v1',
      transitions: [],
    })).toBe(true);
    expect(requiresFullLearnerRebuild({
      ...base,
      transitions: [transition({
        id: 't-revoke',
        sequence: BigInt(2),
        fact: currentFact,
        operation: 'REVOKE',
        correctionOfSequence: BigInt(1),
      })],
    })).toBe(true);
    expect(requiresFullLearnerRebuild({
      ...base,
      currentTrustedFactPolicyVersion: 'trusted-learning-fact-policy.v0',
      targetTrustedFactPolicyVersion: 'trusted-learning-fact-policy.v1',
      transitions: [],
    })).toBe(true);
    expect(requiresFullLearnerRebuild({
      ...base,
      currentTrustedFactPolicyVersion: 'trusted-learning-fact-policy.v1',
      targetTrustedFactPolicyVersion: 'trusted-learning-fact-policy.v1',
      transitions: [],
    })).toBe(false);
  });
});
