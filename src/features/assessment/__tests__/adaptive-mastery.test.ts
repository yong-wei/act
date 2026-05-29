import { describe, expect, it } from 'vitest';

import {
  rebuildMasteryUpdatesFromAnswers,
  resolveMasteryConfidence,
} from '../adaptive-mastery';

describe('adaptive mastery state', () => {
  it('rebuilds deterministic BKT-compatible mastery updates from persisted answers', () => {
    const answers = [
      {
        id: 'answer-late',
        questionId: 'q-2',
        isCorrect: false,
        answeredAt: new Date('2026-05-26T02:35:00.000Z'),
        knowledgeTags: ['phase-margin'],
      },
      {
        id: 'answer-early',
        questionId: 'q-1',
        isCorrect: true,
        answeredAt: new Date('2026-05-26T02:30:00.000Z'),
        knowledgeTags: ['phase-margin'],
      },
    ];

    const first = rebuildMasteryUpdatesFromAnswers(answers, {
      prerequisitesByTag: {
        'phase-margin': ['damping-ratio'],
      },
    });
    const second = rebuildMasteryUpdatesFromAnswers([...answers].reverse(), {
      prerequisitesByTag: {
        'phase-margin': ['damping-ratio'],
      },
    });

    expect(second).toEqual(first);
    expect(first).toHaveLength(2);
    expect(first[0]).toMatchObject({
      answerId: 'answer-early',
      knowledgeTag: 'phase-margin',
      attemptCount: 1,
      prerequisiteEvidence: {
        missing: ['damping-ratio'],
        stale: [],
      },
    });
    expect(first[1].posteriorMastery).toBeLessThan(first[0].posteriorMastery);
  });

  it('keeps uncalibrated non-assessment evidence below high-confidence mastery', () => {
    expect(resolveMasteryConfidence({
      evidenceKind: 'non_assessment',
      calibrated: false,
      posteriorMastery: 0.99,
      attemptCount: 12,
    })).toBeLessThan(0.7);

    expect(resolveMasteryConfidence({
      evidenceKind: 'assessment',
      calibrated: true,
      posteriorMastery: 0.99,
      attemptCount: 12,
    })).toBeGreaterThanOrEqual(0.8);
  });

  it('uses versioned BKT parameters and exposes stale prerequisite evidence', () => {
    const answers = [
      {
        id: 'answer-prerequisite',
        questionId: 'q-1',
        isCorrect: true,
        answeredAt: new Date('2026-05-01T02:30:00.000Z'),
        knowledgeTags: ['damping-ratio'],
      },
      {
        id: 'answer-target',
        questionId: 'q-2',
        isCorrect: true,
        answeredAt: new Date('2026-05-26T02:30:00.000Z'),
        knowledgeTags: ['phase-margin'],
      },
    ];

    const conservative = rebuildMasteryUpdatesFromAnswers(answers, {
      parameters: {
        initialMastery: 0.2,
        learnProbability: 0.03,
        slipProbability: 0.12,
        guessProbability: 0.18,
      },
      prerequisiteStaleAfterMs: 1000 * 60 * 60 * 24,
    });
    const optimistic = rebuildMasteryUpdatesFromAnswers(answers, {
      parameters: {
        initialMastery: 0.6,
        learnProbability: 0.2,
        slipProbability: 0.05,
        guessProbability: 0.15,
      },
      prerequisiteStaleAfterMs: 1000 * 60 * 60 * 24,
    });

    const conservativeTarget = conservative.find((update) => update.answerId === 'answer-target');
    const optimisticTarget = optimistic.find((update) => update.answerId === 'answer-target');

    expect(conservativeTarget?.posteriorMastery).not.toBe(optimisticTarget?.posteriorMastery);
    expect(conservativeTarget?.prerequisiteEvidence).toMatchObject({
      missing: [],
      stale: ['damping-ratio'],
    });
  });

  it('uses the versioned initial mastery when rebuilding the first posterior', () => {
    const answers = [
      {
        id: 'answer-1',
        questionId: 'q-1',
        isCorrect: true,
        answeredAt: new Date('2026-05-26T02:30:00.000Z'),
        knowledgeTags: ['phase-margin'],
      },
    ];

    const lowInitial = rebuildMasteryUpdatesFromAnswers(answers, {
      parameters: {
        initialMastery: 0.1,
        learnProbability: 0.08,
        slipProbability: 0.1,
        guessProbability: 0.2,
      },
    });
    const highInitial = rebuildMasteryUpdatesFromAnswers(answers, {
      parameters: {
        initialMastery: 0.8,
        learnProbability: 0.08,
        slipProbability: 0.1,
        guessProbability: 0.2,
      },
    });

    expect(lowInitial[0].priorMastery).toBe(0.1);
    expect(highInitial[0].priorMastery).toBe(0.8);
    expect(lowInitial[0].posteriorMastery).not.toBe(highInitial[0].posteriorMastery);
  });
});
