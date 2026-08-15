import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getServerAuthSession: vi.fn(),
  rethrowIfNextDynamicError: vi.fn(),
  prisma: {
    $transaction: vi.fn(),
    promptAssessment: {
      create: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      updateMany: vi.fn(),
    },
  },
}));

vi.mock('@/lib/auth', () => ({
  getServerAuthSession: mocks.getServerAuthSession,
}));
vi.mock('@/lib/prisma', () => ({
  prisma: mocks.prisma,
}));
vi.mock('@/lib/nextjs-dynamic-error', () => ({
  rethrowIfNextDynamicError: mocks.rethrowIfNextDynamicError,
}));

import { POST as assess } from '@/app/api/evaluation/assess-prompt/route';
import { POST as trackConsistency } from '@/app/api/evaluation/track-consistency/route';
import { GET as getHistory } from '@/app/api/evaluation/prompt-history/[userId]/route';

const createdAt = new Date('2026-08-15T00:00:00.000Z');
const assessmentBody = {
  userId: 'forged-student',
  sessionId: 'prompt-session-1',
  prompt: '控制对象：邮轮航向系统；性能目标：超调<15%，调节时间<20s；约束：相位裕度>30°。',
  structuredData: {
    'control-object': '邮轮航向系统',
    'performance-goals': '超调<15%，调节时间<20s',
    constraints: '相位裕度>30°',
  },
  auditTaskContext: {
    source: 'prompt-assessment',
    assignment: 'PID 参数整定',
    intent: 'prompt-history-review',
    outputTarget: 'prompt-history' as const,
  },
  context: {
    taskType: 'controller-design' as const,
    difficulty: 'intermediate' as const,
  },
};
const consistencyBody = {
  userId: 'forged-student',
  designSessionId: assessmentBody.sessionId,
  promptVersion: 1,
  promptContent: assessmentBody.prompt,
  auditTaskContext: assessmentBody.auditTaskContext,
  designActions: [
    { timestamp: 1, action: 'adjust_kp', params: { kp: 1.2 } },
    { timestamp: 2, action: 'adjust_ki', params: { ki: 0.1 } },
  ],
  finalResult: { overshoot: 0.1 },
};
const databaseRecord = {
  id: 'assessment-1',
  userId: 'student-1',
  sessionId: assessmentBody.sessionId,
  promptContent: assessmentBody.prompt,
  structuredData: assessmentBody.structuredData,
  auditTaskContext: assessmentBody.auditTaskContext,
  consistencyResult: null,
  overallScore: 85,
  completenessScore: 100,
  precisionScore: 85,
  structurizationScore: 75,
  executabilityScore: 80,
  suggestions: [],
  version: 1,
  createdAt,
};

function studentSession() {
  return { user: { id: 'student-1', role: 'STUDENT' } };
}

function post(url: string, body: unknown) {
  return new Request(`http://localhost${url}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function historyContext(userId: string) {
  return { params: Promise.resolve({ userId }) };
}

describe('prompt assessment history routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getServerAuthSession.mockResolvedValue(studentSession());
    mocks.prisma.$transaction.mockImplementation(async (callback) => callback(mocks.prisma));
    mocks.prisma.promptAssessment.findFirst.mockResolvedValue(null);
    mocks.prisma.promptAssessment.create.mockResolvedValue(databaseRecord);
    mocks.prisma.promptAssessment.findMany.mockResolvedValue([databaseRecord]);
    mocks.prisma.promptAssessment.updateMany.mockResolvedValue({ count: 1 });
  });

  it('rejects unauthenticated evaluation and history requests before persistence', async () => {
    mocks.getServerAuthSession.mockResolvedValue(null);

    expect((await assess(post('/api/evaluation/assess-prompt', assessmentBody))).status).toBe(401);
    expect((await trackConsistency(post('/api/evaluation/track-consistency', consistencyBody))).status).toBe(401);
    expect((await getHistory(new Request('http://localhost/api/evaluation/prompt-history/student-1'), historyContext('student-1'))).status).toBe(401);
    expect(mocks.prisma.promptAssessment.create).not.toHaveBeenCalled();
    expect(mocks.prisma.promptAssessment.findMany).not.toHaveBeenCalled();
  });

  it('persists an assessment for the authenticated student instead of a forged body userId', async () => {
    const response = await assess(post('/api/evaluation/assess-prompt', assessmentBody));

    expect(response.status).toBe(200);
    expect(mocks.prisma.promptAssessment.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        userId: 'student-1',
        sessionId: assessmentBody.sessionId,
        version: 1,
      }),
    }));
  });

  it('rejects malformed production assessment input before evaluating or persisting it', async () => {
    const response = await assess(post('/api/evaluation/assess-prompt', {
      ...assessmentBody,
      prompt: ' \n ',
    }));

    expect(response.status).toBe(400);
    expect(mocks.prisma.$transaction).not.toHaveBeenCalled();
    expect(mocks.prisma.promptAssessment.create).not.toHaveBeenCalled();
  });

  it('retries a transaction conflict and assigns the next persisted session version', async () => {
    mocks.prisma.$transaction
      .mockRejectedValueOnce(Object.assign(new Error('serialization conflict'), { code: 'P2034' }))
      .mockImplementationOnce(async (callback) => callback(mocks.prisma));
    mocks.prisma.promptAssessment.findFirst.mockResolvedValue({ version: 2 });

    const response = await assess(post('/api/evaluation/assess-prompt', assessmentBody));

    expect(response.status).toBe(200);
    expect(mocks.prisma.$transaction).toHaveBeenCalledTimes(2);
    expect(mocks.prisma.promptAssessment.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ version: 3 }),
    }));
  });

  it('attaches consistency only to an owned persisted prompt assessment', async () => {
    mocks.prisma.promptAssessment.findFirst.mockResolvedValueOnce(databaseRecord);

    const response = await trackConsistency(post('/api/evaluation/track-consistency', consistencyBody));

    expect(response.status).toBe(200);
    expect(mocks.prisma.promptAssessment.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        userId: 'student-1',
        sessionId: assessmentBody.sessionId,
        version: 1,
      },
      data: expect.objectContaining({ consistencyResult: expect.any(Object) }),
    }));
  });

  it('calculates consistency from the owned persisted prompt rather than the submitted prompt text', async () => {
    mocks.prisma.promptAssessment.findFirst.mockResolvedValueOnce(databaseRecord);

    const response = await trackConsistency(post('/api/evaluation/track-consistency', {
      ...consistencyBody,
      promptContent: '只要求生成一段无关的文字。',
    }));

    expect(response.status).toBe(200);
    expect(mocks.prisma.promptAssessment.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        consistencyResult: expect.objectContaining({
          alignmentAnalysis: expect.objectContaining({
            statedGoals: expect.arrayContaining(['控制超调']),
          }),
        }),
      }),
    }));
  });

  it('does not create a consistency record for an absent or foreign assessment', async () => {
    mocks.prisma.promptAssessment.updateMany.mockResolvedValue({ count: 0 });

    const response = await trackConsistency(post('/api/evaluation/track-consistency', consistencyBody));

    expect(response.status).toBe(404);
    expect(mocks.prisma.promptAssessment.create).not.toHaveBeenCalled();
  });

  it('rejects a foreign history path before querying assessment records', async () => {
    const response = await getHistory(
      new Request('http://localhost/api/evaluation/prompt-history/student-2'),
      historyContext('student-2'),
    );

    expect(response.status).toBe(403);
    expect(mocks.prisma.promptAssessment.findMany).not.toHaveBeenCalled();
  });

  it('returns only the authenticated student persisted history without learning-fact writes', async () => {
    const response = await getHistory(
      new Request('http://localhost/api/evaluation/prompt-history/student-1'),
      historyContext('student-1'),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ total: 1 });
    expect(mocks.prisma.promptAssessment.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { userId: 'student-1' },
    }));
    expect(Object.keys(mocks.prisma)).toEqual(['$transaction', 'promptAssessment']);
  });
});
