import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getServerAuthSession: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  getServerAuthSession: mocks.getServerAuthSession,
}));

import { POST as generateQuestion } from '@/app/api/assessment/generate-question/route';

function generateRequest(body: unknown) {
  return generateQuestion(new Request('http://localhost/api/assessment/generate-question', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }));
}

describe('generate-question API auth boundaries', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    globalThis.__adaptiveAssessmentStore = undefined;
  });

  it('rejects unauthenticated generated question requests', async () => {
    mocks.getServerAuthSession.mockResolvedValue(null);

    const response = await generateRequest({
      targetKnowledgeTags: ['controller-tuning'],
      difficultyTarget: 0.5,
      domains: ['time', 'frequency'],
      goalId: 'control-correction',
      sessionId: 'practice-1',
    });

    expect(response.status).toBe(401);
  });

  it('marks generated questions with authenticated owner and session scope', async () => {
    mocks.getServerAuthSession.mockResolvedValue({
      user: { id: 'student-1', role: 'STUDENT' },
    });

    const response = await generateRequest({
      targetKnowledgeTags: ['controller-tuning'],
      difficultyTarget: 0.5,
      domains: ['time', 'frequency'],
      goalId: 'control-correction',
      sessionId: 'practice-1',
    });

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.question.generatedMetadata).toMatchObject({
      learningGoalIds: ['control-correction'],
      ownerUserId: 'student-1',
      sessionId: 'practice-1',
      generationKind: 'template',
    });
    expect(payload.generationKind).toBe('template');
    expect(payload.source).toBe('template-generated');
    expect(payload.source).not.toBe('ai_generated');
  });
});
