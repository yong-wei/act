import { describe, expect, it, vi } from 'vitest';

import { readAdaptiveAttemptContext } from '../adaptive-attempt-context';

const questionSnapshot = {
  version: 'adaptive-question-snapshot.v1',
  prompt: '单位负反馈系统的稳态误差主要由什么决定？',
  options: [
    { key: 'A', label: '开环低频增益', text: '开环低频增益', explanation: '低频增益决定稳态跟踪能力。' },
    { key: 'B', label: '高频截止频率', text: '高频截止频率', explanation: '高频特性不是本题的主要决定因素。' },
  ],
  correctOptionKey: 'A',
  explanation: '比较系统型别和低频增益。',
  knowledgeTags: ['steady-state-error'],
  misconceptionTags: ['confuses-low-and-high-frequency'],
  remediationResources: [
    { id: 'resource-1', title: '稳态误差知识卡', href: '/knowledge/resource-1', governanceState: 'reviewed' },
  ],
};

function answer(overrides: Record<string, unknown> = {}) {
  return {
    id: 'answer-current',
    userId: 'student-1',
    sessionId: 'session-db-1',
    questionId: 'question-1',
    selectedOptionKey: 'B',
    correctOptionKey: 'A',
    isCorrect: false,
    answeredAt: new Date('2026-07-28T08:03:00.000Z'),
    session: {
      id: 'session-db-1',
      userId: 'student-1',
      sessionKey: 'practice-session-1',
    },
    questionRef: {
      knowledgeTags: ['steady-state-error'],
      metadata: { questionSnapshot },
    },
    ...overrides,
  };
}

describe('readAdaptiveAttemptContext', () => {
  it('returns the owned attempt and the latest three attempts from the same practice session', async () => {
    const current = answer();
    const repeatedMisconceptionSnapshot = {
      ...questionSnapshot,
      misconceptionTags: ['confuses-low-and-high-frequency', 'misses-system-type'],
    };
    const db = {
      adaptiveAssessmentAnswer: {
        findFirst: vi.fn().mockResolvedValue(current),
        findMany: vi.fn().mockResolvedValue([
          current,
          answer({ id: 'answer-previous-1', questionId: 'question-2', answeredAt: new Date('2026-07-28T08:02:00.000Z') }),
          answer({
            id: 'answer-previous-2',
            questionId: 'question-3',
            answeredAt: new Date('2026-07-28T08:01:00.000Z'),
            questionRef: { knowledgeTags: [], metadata: { questionSnapshot: repeatedMisconceptionSnapshot } },
          }),
        ]),
      },
    };

    const context = await readAdaptiveAttemptContext({
      db,
      authenticatedUserId: 'student-1',
      answerId: 'answer-current',
    });

    expect(db.adaptiveAssessmentAnswer.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'answer-current', userId: 'student-1' },
    }));
    expect(db.adaptiveAssessmentAnswer.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { userId: 'student-1', sessionId: 'session-db-1' },
      take: 3,
    }));
    expect(context).toMatchObject({
      answerId: 'answer-current',
      sessionKey: 'practice-session-1',
      question: {
        prompt: questionSnapshot.prompt,
        correctOptionKey: 'A',
      },
      selectedOptionKey: 'B',
      isCorrect: false,
    });
    expect(context?.recentAttempts.map((attempt) => attempt.answerId)).toEqual([
      'answer-current',
      'answer-previous-1',
      'answer-previous-2',
    ]);
    expect(context?.recentAttempts.map((attempt) => attempt.misconceptionTags)).toEqual([
      ['confuses-low-and-high-frequency'],
      ['confuses-low-and-high-frequency'],
      ['confuses-low-and-high-frequency', 'misses-system-type'],
    ]);
  });

  it('fails closed when the answer is not owned by the authenticated student', async () => {
    const db = {
      adaptiveAssessmentAnswer: {
        findFirst: vi.fn().mockResolvedValue(null),
        findMany: vi.fn(),
      },
    };

    await expect(readAdaptiveAttemptContext({
      db,
      authenticatedUserId: 'student-1',
      answerId: 'answer-owned-by-another-student',
    })).resolves.toBeNull();
    expect(db.adaptiveAssessmentAnswer.findMany).not.toHaveBeenCalled();
  });

  it('fails closed when the server-owned question snapshot is unavailable', async () => {
    const db = {
      adaptiveAssessmentAnswer: {
        findFirst: vi.fn().mockResolvedValue(answer({ questionRef: { knowledgeTags: [], metadata: {} } })),
        findMany: vi.fn(),
      },
    };

    await expect(readAdaptiveAttemptContext({
      db,
      authenticatedUserId: 'student-1',
      answerId: 'answer-current',
    })).resolves.toBeNull();
    expect(db.adaptiveAssessmentAnswer.findMany).not.toHaveBeenCalled();
  });

  it('fails closed when any recent attempt has an invalid server snapshot', async () => {
    const current = answer();
    const db = {
      adaptiveAssessmentAnswer: {
        findFirst: vi.fn().mockResolvedValue(current),
        findMany: vi.fn().mockResolvedValue([
          current,
          answer({ id: 'answer-invalid-history', questionRef: { knowledgeTags: [], metadata: {} } }),
        ]),
      },
    };

    await expect(readAdaptiveAttemptContext({
      db,
      authenticatedUserId: 'student-1',
      answerId: 'answer-current',
    })).resolves.toBeNull();
  });

  it.each([
    ['missing', { ...questionSnapshot, remediationResources: undefined }],
    ['not an array', { ...questionSnapshot, remediationResources: 'resource-1' }],
    ['containing a damaged entry', {
      ...questionSnapshot,
      remediationResources: [{ id: 'resource-1', title: '', href: '/knowledge/resource-1', governanceState: 'reviewed' }],
    }],
  ])('fails closed when a recent attempt has %s remediation resources', async (_label, damagedSnapshot) => {
    const current = answer();
    const db = {
      adaptiveAssessmentAnswer: {
        findFirst: vi.fn().mockResolvedValue(current),
        findMany: vi.fn().mockResolvedValue([
          current,
          answer({
            id: 'answer-damaged-remediation',
            questionRef: { knowledgeTags: [], metadata: { questionSnapshot: damagedSnapshot } },
          }),
        ]),
      },
    };

    await expect(readAdaptiveAttemptContext({
      db,
      authenticatedUserId: 'student-1',
      answerId: 'answer-current',
    })).resolves.toBeNull();
  });

  it('fails closed if a recent row escapes the authenticated session scope', async () => {
    const current = answer();
    const db = {
      adaptiveAssessmentAnswer: {
        findFirst: vi.fn().mockResolvedValue(current),
        findMany: vi.fn().mockResolvedValue([
          current,
          answer({
            id: 'answer-other-student',
            userId: 'student-2',
            session: { id: 'session-db-1', userId: 'student-2', sessionKey: 'practice-session-1' },
          }),
        ]),
      },
    };

    await expect(readAdaptiveAttemptContext({
      db,
      authenticatedUserId: 'student-1',
      answerId: 'answer-current',
    })).resolves.toBeNull();
  });
});
