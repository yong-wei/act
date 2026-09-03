import { describe, expect, it, vi } from 'vitest';
import { buildKaqQuizQuestionMetadata } from '@/features/assessment/kaq-quiz-foundation';
import { PRESET_QUESTIONS } from '@/features/assessment/adaptive-question-bank';
import { resolveKonlingContinuitySnapshot } from '@/lib/konling-learning-continuity';
import { verifyCompanionPracticeMetadata, verifyCompanionPracticeSubmissionMetadata } from '@/lib/konling-continuity-assessment';

function db(input?: {
  path?: { id: string; title: string; goalId?: string | null; currentNodeId: string; updatedAt: Date } | null;
  mistake?: {
    id: string;
    answeredAt: Date;
    questionRef: { knowledgeTags: string[]; metadata: unknown };
  } | null;
  latest?: {
    id: string;
    answeredAt: Date;
    isCorrect: boolean;
    session: { metadata: unknown };
    questionRef: { knowledgeTags: string[]; metadata: unknown };
  } | null;
}) {
  return {
    learningPath: { findFirst: vi.fn().mockResolvedValue(
      input?.path
        ? { goalId: null, ...input.path }
        : null,
    ) },
    adaptiveAssessmentAnswer: {
      findFirst: vi.fn().mockImplementation((args: { where?: { isCorrect?: boolean } }) => Promise.resolve(
        args.where?.isCorrect === false ? input?.mistake ?? null : input?.latest ?? input?.mistake ?? null,
      )),
    },
  };
}

function governedMetadata(value: Record<string, unknown> = {}) {
  return {
    kaq: { learningGoalIds: ['root-locus-analysis-foundations'] },
    ...value,
  };
}

describe('Konling learning continuity', () => {
  it('prioritizes an unfinished task over a recent mistake', async () => {
    const store = db({
      path: { id: 'path-1', title: '根轨迹练习', goalId: 'control-correction', currentNodeId: 'node-2', updatedAt: new Date('2026-08-01T08:00:00Z') },
      mistake: { id: 'answer-1', answeredAt: new Date('2026-08-01T09:00:00Z'), questionRef: { knowledgeTags: ['root-locus'], metadata: governedMetadata() } },
    });
    const snapshot = await resolveKonlingContinuitySnapshot(store, { userId: 'student-1' });
    expect(snapshot).toMatchObject({
      state: 'unfinished_task',
      unfinishedTask: {
        pathId: 'path-1',
        nodeId: 'node-2',
        // 继续学习与 AI 工坊路径任务共用同一导航口径（#1910）
        href: '/assessment/adaptive-practice?goal=control-correction&pathId=path-1&nodeId=node-2&intent=path-execution',
      },
    });
    expect(store.adaptiveAssessmentAnswer.findFirst).not.toHaveBeenCalled();
  });

  it('falls through to honest states when the unfinished path has no valid adaptive practice goal', async () => {
    const store = db({
      path: { id: 'path-9', title: '旧路径', goalId: null, currentNodeId: 'node-1', updatedAt: new Date('2026-08-01T08:00:00Z') },
    });
    const snapshot = await resolveKonlingContinuitySnapshot(store, { userId: 'student-1' });
    // goal 无效时目标页无法恢复执行上下文：不进入 unfinished_task，落入后续诚实状态
    expect(snapshot.state).not.toBe('unfinished_task');
    expect(snapshot.unfinishedTask).toBeUndefined();
  });

  it('uses a governed recent mistake without inventing a missing cause', async () => {
    const store = db({
      mistake: { id: 'answer-1', answeredAt: new Date('2026-08-01T09:00:00Z'), questionRef: { knowledgeTags: ['root-locus'], metadata: governedMetadata({ knowledgeLabel: '根轨迹' }) } },
    });
    const snapshot = await resolveKonlingContinuitySnapshot(store, { userId: 'student-1' });
    expect(snapshot).toMatchObject({
      state: 'recent_mistake',
      recentMistake: { knowledgeId: 'root-locus-analysis-foundations', knowledgeLabel: '根轨迹', structuredCauseId: null, structuredCauseLabel: null },
    });
    expect(PRESET_QUESTIONS.some((question) => (
      buildKaqQuizQuestionMetadata(question).learningGoalIds.includes(snapshot.recentMistake!.knowledgeId)
    ))).toBe(true);
  });

  it('does not expose an ungoverned knowledge tag as a selectable learning goal', async () => {
    const store = db({
      mistake: {
        id: 'answer-1',
        answeredAt: new Date('2026-08-01T09:00:00Z'),
        questionRef: { knowledgeTags: ['pole-stability'], metadata: {} },
      },
    });
    await expect(resolveKonlingContinuitySnapshot(store, { userId: 'student-1' })).resolves.toMatchObject({
      state: 'cold_start',
      evidenceAsOf: null,
    });
  });

  it('returns a stable cold-start snapshot when governed history is absent', async () => {
    const store = db();
    const first = await resolveKonlingContinuitySnapshot(store, { userId: 'student-1' });
    const second = await resolveKonlingContinuitySnapshot(store, { userId: 'student-1' });
    expect(first).toEqual(second);
    expect(first.state).toBe('cold_start');
    expect(first.evidenceAsOf).toBeNull();
  });

  it('accepts only metadata matching the authenticated learner snapshot', async () => {
    const store = db({
      mistake: {
        id: 'answer-1',
        answeredAt: new Date('2026-08-01T09:00:00Z'),
        questionRef: { knowledgeTags: ['root-locus'], metadata: governedMetadata({ structuredCause: { id: 'cause-1', label: '符号方向错误' } }) },
      },
    });
    const snapshot = await resolveKonlingContinuitySnapshot(store, { userId: 'student-1' });
    await expect(verifyCompanionPracticeMetadata(store, {
      userId: 'student-1',
      continuity: {
        origin: 'konling-companion-practice',
        snapshotId: snapshot.snapshotId,
        targetKnowledgeId: 'root-locus-analysis-foundations',
        structuredCauseId: 'cause-1',
      },
    })).resolves.toMatchObject({ snapshotId: snapshot.snapshotId });

    await expect(verifyCompanionPracticeMetadata(store, {
      userId: 'student-2',
      continuity: {
        origin: 'konling-companion-practice',
        snapshotId: snapshot.snapshotId,
        targetKnowledgeId: 'root-locus-analysis-foundations',
        structuredCauseId: 'cause-1',
      },
    })).rejects.toThrow('Stale or cross-user');
  });

  it('changes the snapshot and separates a correct companion result from stable mastery', async () => {
    const store = db({
      mistake: { id: 'answer-1', answeredAt: new Date('2026-08-01T09:00:00Z'), questionRef: { knowledgeTags: ['root-locus'], metadata: governedMetadata() } },
      latest: {
        id: 'answer-2',
        answeredAt: new Date('2026-08-01T10:00:00Z'),
        isCorrect: true,
        session: { metadata: { origin: 'konling-companion-practice', targetKnowledgeId: 'root-locus-analysis-foundations' } },
        questionRef: { knowledgeTags: ['root-locus'], metadata: governedMetadata() },
      },
    });
    const snapshot = await resolveKonlingContinuitySnapshot(store, { userId: 'student-1' });
    expect(snapshot.feedback).toEqual({
      result: 'correct',
      message: '本题已正确；单次正确不代表稳定掌握。',
      nextAction: '继续做一道陪伴练习',
    });
    expect(snapshot.snapshotId).not.toContain('answer-1');
  });

  it('accepts a completed submission retry after the result changes the current snapshot', async () => {
    const continuity = {
      origin: 'konling-companion-practice',
      snapshotId: 'continuity:before-result',
      targetKnowledgeId: 'root-locus',
      structuredCauseId: null,
    } as const;
    const store = {
      ...db({
        latest: {
          id: 'answer-2',
          answeredAt: new Date('2026-08-01T10:00:00Z'),
          isCorrect: true,
          session: { metadata: continuity },
          questionRef: { knowledgeTags: ['root-locus'], metadata: {} },
        },
      }),
      adaptiveAssessmentSession: {
        findUnique: vi.fn().mockResolvedValue({
          selectedQuestionIds: ['preset-q-01'],
          metadata: continuity,
          answers: [{ id: 'answer-2' }],
        }),
      },
    };

    await expect(verifyCompanionPracticeSubmissionMetadata(store, {
      userId: 'student-1',
      sessionId: 'konling-continuity:continuity:before-result',
      questionId: 'preset-q-01',
      continuity,
    })).resolves.toEqual(continuity);
  });
});
