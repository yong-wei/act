import { describe, expect, it, vi } from 'vitest';
import { resolveKonlingContinuitySnapshot } from '@/lib/konling-learning-continuity';
import { verifyCompanionPracticeMetadata } from '@/lib/konling-continuity-assessment';

function db(input?: {
  path?: { id: string; title: string; currentNodeId: string; updatedAt: Date } | null;
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
    learningPath: { findFirst: vi.fn().mockResolvedValue(input?.path ?? null) },
    adaptiveAssessmentAnswer: {
      findFirst: vi.fn().mockImplementation((args: { where?: { isCorrect?: boolean } }) => Promise.resolve(
        args.where?.isCorrect === false ? input?.mistake ?? null : input?.latest ?? input?.mistake ?? null,
      )),
    },
  };
}

describe('Konling learning continuity', () => {
  it('prioritizes an unfinished task over a recent mistake', async () => {
    const store = db({
      path: { id: 'path-1', title: '根轨迹练习', currentNodeId: 'node-2', updatedAt: new Date('2026-08-01T08:00:00Z') },
      mistake: { id: 'answer-1', answeredAt: new Date('2026-08-01T09:00:00Z'), questionRef: { knowledgeTags: ['root-locus'], metadata: {} } },
    });
    const snapshot = await resolveKonlingContinuitySnapshot(store, { userId: 'student-1' });
    expect(snapshot).toMatchObject({ state: 'unfinished_task', unfinishedTask: { pathId: 'path-1', nodeId: 'node-2' } });
    expect(store.adaptiveAssessmentAnswer.findFirst).not.toHaveBeenCalled();
  });

  it('uses a governed recent mistake without inventing a missing cause', async () => {
    const store = db({
      mistake: { id: 'answer-1', answeredAt: new Date('2026-08-01T09:00:00Z'), questionRef: { knowledgeTags: ['root-locus'], metadata: { knowledgeLabel: '根轨迹' } } },
    });
    const snapshot = await resolveKonlingContinuitySnapshot(store, { userId: 'student-1' });
    expect(snapshot).toMatchObject({
      state: 'recent_mistake',
      recentMistake: { knowledgeId: 'root-locus', knowledgeLabel: '根轨迹', structuredCauseId: null, structuredCauseLabel: null },
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
        questionRef: { knowledgeTags: ['root-locus'], metadata: { structuredCause: { id: 'cause-1', label: '符号方向错误' } } },
      },
    });
    const snapshot = await resolveKonlingContinuitySnapshot(store, { userId: 'student-1' });
    await expect(verifyCompanionPracticeMetadata(store, {
      userId: 'student-1',
      continuity: {
        origin: 'konling-companion-practice',
        snapshotId: snapshot.snapshotId,
        targetKnowledgeId: 'root-locus',
        structuredCauseId: 'cause-1',
      },
    })).resolves.toMatchObject({ snapshotId: snapshot.snapshotId });

    await expect(verifyCompanionPracticeMetadata(store, {
      userId: 'student-2',
      continuity: {
        origin: 'konling-companion-practice',
        snapshotId: snapshot.snapshotId,
        targetKnowledgeId: 'root-locus',
        structuredCauseId: 'cause-1',
      },
    })).rejects.toThrow('Stale or cross-user');
  });

  it('changes the snapshot and separates a correct companion result from stable mastery', async () => {
    const store = db({
      mistake: { id: 'answer-1', answeredAt: new Date('2026-08-01T09:00:00Z'), questionRef: { knowledgeTags: ['root-locus'], metadata: {} } },
      latest: {
        id: 'answer-2',
        answeredAt: new Date('2026-08-01T10:00:00Z'),
        isCorrect: true,
        session: { metadata: { origin: 'konling-companion-practice', targetKnowledgeId: 'root-locus' } },
        questionRef: { knowledgeTags: ['root-locus'], metadata: {} },
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
});
