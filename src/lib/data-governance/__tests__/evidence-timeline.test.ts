import { describe, expect, it, vi } from 'vitest';
import type { LearningFact } from '@prisma/client';

import {
  createEvidenceTimelineCursor,
  listEvidenceTimeline,
} from '../evidence-timeline';

function fact(overrides: Partial<LearningFact> = {}): LearningFact {
  return {
    id: overrides.id ?? 'fact-1',
    userId: overrides.userId ?? 'student-1',
    factType: overrides.factType ?? 'question',
    moduleId: overrides.moduleId ?? 'step-09',
    sessionId: overrides.sessionId ?? 'session-1',
    startedAt: overrides.startedAt ?? new Date('2026-05-21T08:00:00.000Z'),
    finishedAt: overrides.finishedAt ?? new Date('2026-05-21T08:05:00.000Z'),
    outcome: overrides.outcome ?? 'success',
    score: overrides.score ?? 80,
    timeSpent: overrides.timeSpent ?? 240,
    competencyContribution: overrides.competencyContribution ?? { engineeringDecision: 0.8 },
    sourceEventId: overrides.sourceEventId ?? 'event-1',
    sourceLogId: overrides.sourceLogId ?? 'log-1',
    courseId: overrides.courseId ?? 'automatic-control',
    lessonId: overrides.lessonId ?? 'unit-5-2-phase-plane-disturbance-boundary',
    contextJson: overrides.contextJson ?? {},
    createdAt: overrides.createdAt ?? new Date('2026-05-21T08:05:01.000Z'),
  };
}

function response(overrides: Record<string, unknown> = {}) {
  return {
    id: overrides.id ?? 'response-1',
    userId: overrides.userId ?? 'student-1',
    sessionId: overrides.sessionId ?? 'session-1',
    lessonKey: overrides.lessonKey ?? 'unit-5-2-phase-plane-disturbance-boundary',
    stepId: overrides.stepId ?? 'step-09',
    attemptKey: overrides.attemptKey ?? 'attempt-1',
    sourceLogId: overrides.sourceLogId ?? 'log-1',
    clientEventId: overrides.clientEventId ?? 'client-event-1',
    submittedAt: overrides.submittedAt ?? new Date('2026-05-21T08:05:00.000Z'),
    responseData: overrides.responseData ?? {
      schemaVersion: 'manifest-submission-v2',
      evidenceQuality: 'rich',
      score: 100,
      questionSummaries: [
        {
          questionId: '5-2-q1',
          prompt: '扰动边界如何影响相轨线？',
          studentAnswer: '边界外需要重新判断收敛路径',
          referenceAnswer: '边界外需要重新判断收敛路径',
          isCorrect: true,
        },
      ],
    },
    createdAt: overrides.createdAt ?? new Date('2026-05-21T08:05:01.000Z'),
  };
}

describe('evidence timeline browser', () => {
  it('returns newest-first timeline items with 5-2 rich submission summaries', async () => {
    const db = {
      learningFact: {
        findMany: vi.fn().mockResolvedValue([
          fact({
            id: 'newer-5-2-lower-score',
            score: 55,
            startedAt: new Date('2026-05-21T08:00:00.000Z'),
            createdAt: new Date('2026-05-21T08:05:01.000Z'),
          }),
          fact({
            id: 'older-4-4-high-score',
            score: 98,
            lessonId: 'unit-4-4-fixed-structure-optimization',
            sourceLogId: 'log-2',
            startedAt: new Date('2026-05-01T08:00:00.000Z'),
            createdAt: new Date('2026-05-01T08:05:01.000Z'),
          }),
          fact({
            id: 'extra-page-item',
            sourceLogId: 'log-3',
            startedAt: new Date('2026-04-30T08:00:00.000Z'),
            createdAt: new Date('2026-04-30T08:05:01.000Z'),
          }),
        ]),
      },
      studentStepResponse: {
        findMany: vi.fn().mockResolvedValue([
          response({ sourceLogId: 'log-1' }),
        ]),
      },
    };

    const page = await listEvidenceTimeline({
      db,
      userId: 'student-1',
      filters: { limit: 2 },
    });

    expect(db.learningFact.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { userId: 'student-1' },
      orderBy: [{ startedAt: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
      take: 3,
    }));
    expect(page.items.map((item) => item.id)).toEqual([
      'newer-5-2-lower-score',
      'older-4-4-high-score',
    ]);
    expect(page.items[0]).toMatchObject({
      score: 55,
      lessonId: 'unit-5-2-phase-plane-disturbance-boundary',
      quality: 'rich',
      stepId: 'step-09',
      questionSummaries: [
        {
          questionId: '5-2-q1',
          studentAnswer: '边界外需要重新判断收敛路径',
          referenceAnswer: '边界外需要重新判断收敛路径',
          isCorrect: true,
        },
      ],
    });
    expect(page.nextCursor).toBeTruthy();
  });

  it('applies field filters, dimension filters, and cursor pagination', async () => {
    const cursor = createEvidenceTimelineCursor({
      startedAt: '2026-05-21T08:00:00.000Z',
      createdAt: '2026-05-21T08:05:01.000Z',
      id: 'cursor-fact',
    });
    const db = {
      learningFact: {
        findMany: vi.fn().mockResolvedValue([
          fact({
            id: 'ignored-other-dimension',
            competencyContribution: { controlModeling: 0.7 },
            sourceLogId: 'log-a',
          }),
          fact({
            id: 'matched-5-1-fixture',
            lessonId: 'unit-5-1-controller-parameter-observation',
            sourceLogId: 'log-b',
            competencyContribution: { engineeringDecision: 0.6 },
          }),
        ]),
      },
      studentStepResponse: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    };

    const page = await listEvidenceTimeline({
      db,
      userId: 'student-1',
      filters: {
        limit: 5,
        cursor,
        dimension: 'engineeringDecision',
        lessonId: 'unit-5-1-controller-parameter-observation',
        factType: 'question',
        outcome: 'success',
        sessionId: 'session-1',
      },
    });

    expect(db.learningFact.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        userId: 'student-1',
        lessonId: 'unit-5-1-controller-parameter-observation',
        factType: 'question',
        outcome: 'success',
        sessionId: 'session-1',
        AND: expect.any(Array),
      }),
    }));
    expect(page.items.map((item) => item.id)).toEqual(['matched-5-1-fixture']);
    expect(page.appliedFilters).toMatchObject({
      dimension: 'engineeringDecision',
      lessonId: 'unit-5-1-controller-parameter-observation',
    });
  });
});
