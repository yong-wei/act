import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getServerAuthSession: vi.fn(),
  loadGeneratedCandidateStore: vi.fn(),
  persistGeneratedCandidateStore: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  getServerAuthSession: mocks.getServerAuthSession,
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {},
}));

vi.mock('@/features/adaptive-assessment/generated-candidate-persistence', () => ({
  loadGeneratedCandidateStore: mocks.loadGeneratedCandidateStore,
  persistGeneratedCandidateStore: mocks.persistGeneratedCandidateStore,
}));

import { createGeneratedCandidateStore } from '@/features/adaptive-assessment/generated-candidate-governance';
import { POST as createCandidate } from '@/app/api/assessment/generated-candidates/route';
import { POST as reviewCandidate } from '@/app/api/assessment/generated-candidates/[id]/review/route';
import { POST as publishCandidate } from '@/app/api/assessment/generated-candidates/[id]/publish/route';

const content = {
  stem: '校正方案必须同时核对哪组独立证据？',
  options: [
    { label: 'A', text: '缺口、补偿理由、参数和指标对比', isCorrect: true, explanation: '完整设计链。' },
    { label: 'B', text: '只看检查点截图', isCorrect: false, explanation: '不够。' },
  ],
  knowledgeTags: ['controller-tuning'],
  learningGoalIds: ['control-correction'],
  graphNodeIds: [],
  difficulty: 0.6,
  intendedStage: 'low-stakes-practice' as const,
};

describe('generated candidate API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.loadGeneratedCandidateStore.mockResolvedValue(createGeneratedCandidateStore());
    mocks.persistGeneratedCandidateStore.mockResolvedValue(undefined);
  });

  it('creates a persisted AI candidate without treating it as published', async () => {
    mocks.getServerAuthSession.mockResolvedValue({ user: { id: 'teacher-1', role: 'TEACHER' } });
    const response = await createCandidate(new Request('http://localhost/api/assessment/generated-candidates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        generationKind: 'ai',
        promptText: 'SECRET_PROMPT',
        content,
      }),
    }));
    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.candidate.generationKind).toBe('ai');
    expect(payload.candidate.status).toBe('awaiting-human-review');
    expect(JSON.stringify(payload)).not.toContain('SECRET_PROMPT');
    expect(mocks.persistGeneratedCandidateStore).toHaveBeenCalled();
  });

  it('rejects template candidates on the publication pipeline', async () => {
    mocks.getServerAuthSession.mockResolvedValue({ user: { id: 'teacher-1', role: 'TEACHER' } });
    const response = await createCandidate(new Request('http://localhost/api/assessment/generated-candidates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ generationKind: 'template', content }),
    }));
    expect(response.status).toBe(400);
  });

  it('reviews and publishes through authorized roles', async () => {
    const store = createGeneratedCandidateStore();
    mocks.loadGeneratedCandidateStore.mockImplementation(async () => store);
    mocks.getServerAuthSession.mockResolvedValue({ user: { id: 'teacher-1', role: 'TEACHER' } });
    const created = await createCandidate(new Request('http://localhost/api/assessment/generated-candidates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ generationKind: 'human', content }),
    }));
    const createdPayload = await created.json();
    mocks.getServerAuthSession.mockResolvedValue({ user: { id: 'reviewer-1', role: 'TEACHER' } });
    const reviewed = await reviewCandidate(new Request('http://localhost/api/assessment/generated-candidates/id/review', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        outcome: 'approved',
        rationale: '逐项核对通过。',
        itemDecisions: {
          answer: 'accept',
          distractors: 'accept',
          semantics: 'accept',
          stage: 'accept',
          source: 'accept',
        },
      }),
    }), { params: Promise.resolve({ id: createdPayload.candidate.candidateId }) });
    expect(reviewed.status).toBe(200);
    mocks.getServerAuthSession.mockResolvedValue({ user: { id: 'admin-1', role: 'ADMIN' } });
    const published = await publishCandidate(new Request('http://localhost/api/assessment/generated-candidates/id/publish', {
      method: 'POST',
    }), { params: Promise.resolve({ id: createdPayload.candidate.candidateId }) });
    expect(published.status).toBe(200);
    const publishedPayload = await published.json();
    expect(publishedPayload.status).toBe('published');
    expect(publishedPayload.receiptHash).toEqual(expect.any(String));
  });
});
