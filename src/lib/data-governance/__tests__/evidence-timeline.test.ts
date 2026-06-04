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
      take: 5,
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

  it('groups repeated low-signal events while keeping high-signal evidence visible', async () => {
    const db = {
      learningFact: {
        findMany: vi.fn().mockResolvedValue([
          fact({
            id: 'empty-question-2',
            score: 0,
            outcome: 'abandoned',
            sourceLogId: 'empty-log-2',
            sourceEventId: 'empty-event-2',
            startedAt: new Date('2026-05-21T08:10:00.000Z'),
            createdAt: new Date('2026-05-21T08:10:01.000Z'),
            contextJson: { stepId: 'step-09', evidenceQuality: 'missing' },
          }),
          fact({
            id: 'empty-question-1',
            score: 0,
            outcome: 'abandoned',
            sourceLogId: 'empty-log-1',
            sourceEventId: 'empty-event-1',
            startedAt: new Date('2026-05-21T08:08:00.000Z'),
            createdAt: new Date('2026-05-21T08:08:01.000Z'),
            contextJson: { stepId: 'step-09', evidenceQuality: 'missing' },
          }),
          fact({
            id: 'simulation-breakthrough',
            factType: 'simulation',
            score: 92,
            outcome: 'success',
            sourceLogId: 'sim-log',
            sourceEventId: 'sim-event',
            startedAt: new Date('2026-05-21T08:06:00.000Z'),
            createdAt: new Date('2026-05-21T08:06:01.000Z'),
            contextJson: { evidenceTitle: '相轨线边界仿真突破', evidenceQuality: 'rich' },
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
      filters: { limit: 10 },
    });

    expect(page.items).toHaveLength(2);
    expect(page.items[0]).toMatchObject({
      id: 'empty-question-2',
      factType: 'question',
      outcome: 'abandoned',
      stepId: 'step-09',
      groupedCount: 2,
      groupedEvidenceIds: ['empty-question-2', 'empty-question-1'],
      displayPriority: 'deemphasized',
      groupLabel: '重复低信号证据 2 条',
    });
    expect(page.items[1]).toMatchObject({
      id: 'simulation-breakthrough',
      factType: 'simulation',
      displayPriority: 'normal',
    });
  });

  it('keeps legacy high-value simulation events visually identifiable instead of grouping them as low signal', async () => {
    const db = {
      learningFact: {
        findMany: vi.fn().mockResolvedValue([
          fact({
            id: 'legacy-simulation-2',
            factType: 'simulation',
            score: 91,
            outcome: 'success',
            sourceLogId: 'sim-log-2',
            sourceEventId: 'sim-event-2',
            startedAt: new Date('2026-05-21T08:10:00.000Z'),
            createdAt: new Date('2026-05-21T08:10:01.000Z'),
            contextJson: { evidenceTitle: '鲁棒性仿真突破', evidenceQuality: 'legacy-envelope' },
          }),
          fact({
            id: 'legacy-simulation-1',
            factType: 'simulation',
            score: 89,
            outcome: 'success',
            sourceLogId: 'sim-log-1',
            sourceEventId: 'sim-event-1',
            startedAt: new Date('2026-05-21T08:08:00.000Z'),
            createdAt: new Date('2026-05-21T08:08:01.000Z'),
            contextJson: { evidenceTitle: '鲁棒性仿真突破', evidenceQuality: 'legacy-envelope' },
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
      filters: { limit: 10 },
    });

    expect(page.items.map((item) => item.id)).toEqual(['legacy-simulation-2', 'legacy-simulation-1']);
    expect(page.items.every((item) => item.displayPriority === 'normal')).toBe(true);
    expect(page.items.every((item) => item.groupedCount === undefined)).toBe(true);
  });

  it('keeps a next cursor when grouped low-signal events consume the page lookahead window', async () => {
    const rows = [
      fact({
        id: 'empty-question-page-1',
        score: 0,
        outcome: 'abandoned',
        sourceLogId: 'empty-page-log-1',
        sourceEventId: 'empty-page-event-1',
        startedAt: new Date('2026-05-21T08:10:00.000Z'),
        createdAt: new Date('2026-05-21T08:10:01.000Z'),
        contextJson: { stepId: 'step-09', evidenceQuality: 'missing' },
      }),
      fact({
        id: 'empty-question-lookahead',
        score: 0,
        outcome: 'abandoned',
        sourceLogId: 'empty-page-log-2',
        sourceEventId: 'empty-page-event-2',
        startedAt: new Date('2026-05-21T08:08:00.000Z'),
        createdAt: new Date('2026-05-21T08:08:01.000Z'),
        contextJson: { stepId: 'step-09', evidenceQuality: 'missing' },
      }),
      fact({
        id: 'empty-question-lookahead-tail',
        score: 0,
        outcome: 'abandoned',
        sourceLogId: 'empty-page-log-3',
        sourceEventId: 'empty-page-event-3',
        startedAt: new Date('2026-05-21T08:06:00.000Z'),
        createdAt: new Date('2026-05-21T08:06:01.000Z'),
        contextJson: { stepId: 'step-09', evidenceQuality: 'missing' },
      }),
      fact({
        id: 'new-page-item',
        score: 84,
        outcome: 'success',
        sourceLogId: 'new-page-log',
        sourceEventId: 'new-page-event',
        startedAt: new Date('2026-05-21T08:04:00.000Z'),
        createdAt: new Date('2026-05-21T08:04:01.000Z'),
      }),
    ];
    const db = {
      learningFact: {
        findMany: vi.fn(async (args) => {
          const where = JSON.stringify(args.where ?? {});
          const cursorIndex = rows.findIndex((row) => where.includes(`"id":{"lt":"${row.id}"}`));
          const startIndex = cursorIndex >= 0 ? cursorIndex + 1 : 0;
          return rows.slice(startIndex, startIndex + (args.take ?? rows.length));
        }),
      },
      studentStepResponse: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    };

    const page = await listEvidenceTimeline({
      db,
      userId: 'student-1',
      filters: { limit: 1 },
    });

    expect(db.learningFact.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 4 }));
    expect(page.items).toHaveLength(1);
    expect(page.items[0]).toMatchObject({
      id: 'empty-question-page-1',
      groupedCount: 3,
      groupedEvidenceIds: ['empty-question-page-1', 'empty-question-lookahead', 'empty-question-lookahead-tail'],
      displayPriority: 'deemphasized',
    });
    expect(page.nextCursor).toBeTruthy();
    expect(JSON.parse(Buffer.from(page.nextCursor ?? '', 'base64').toString('utf8'))).toMatchObject({
      id: 'empty-question-lookahead-tail',
    });

    const secondPage = await listEvidenceTimeline({
      db,
      userId: 'student-1',
      filters: { limit: 1, cursor: page.nextCursor ?? undefined },
    });

    expect(JSON.stringify(db.learningFact.findMany.mock.calls[1][0].where)).toContain('"id":{"lt":"empty-question-lookahead-tail"}');
    expect(secondPage.items.map((item) => item.id)).toEqual(['new-page-item']);
  });
});
