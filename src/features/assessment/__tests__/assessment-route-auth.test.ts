import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getServerAuthSession: vi.fn(),
  submitAnswerWithPersistenceFallback: vi.fn(),
  selectNextQuestionWithPersistenceFallback: vi.fn(),
  getDiagnosticWithPersistenceFallback: vi.fn(),
  getAbilityReportWithPersistenceFallback: vi.fn(),
  prisma: {
    learningPath: {
      findFirst: vi.fn(),
    },
  },
}));

vi.mock('@/lib/auth', () => ({
  getServerAuthSession: mocks.getServerAuthSession,
}));

vi.mock('@/features/assessment/adaptive-persistence', () => ({
  submitAnswerWithPersistenceFallback: mocks.submitAnswerWithPersistenceFallback,
  selectNextQuestionWithPersistenceFallback: mocks.selectNextQuestionWithPersistenceFallback,
  getDiagnosticWithPersistenceFallback: mocks.getDiagnosticWithPersistenceFallback,
  getAbilityReportWithPersistenceFallback: mocks.getAbilityReportWithPersistenceFallback,
}));

vi.mock('@/lib/prisma', () => ({
  prisma: mocks.prisma,
}));

import { POST as submitAnswer } from '@/app/api/assessment/submit-answer/route';
import { POST as getNextQuestion } from '@/app/api/assessment/next-question/route';
import { GET as getDiagnostic } from '@/app/api/assessment/diagnostic/route';
import { GET as getAbilityReport } from '@/app/api/assessment/ability-report/[userId]/route';

function submitRequest(body: unknown) {
  return submitAnswer(new Request('http://localhost/api/assessment/submit-answer', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }));
}

function nextQuestionRequest(body: unknown) {
  return getNextQuestion(new Request('http://localhost/api/assessment/next-question', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }));
}

describe('assessment API auth boundaries', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.submitAnswerWithPersistenceFallback.mockResolvedValue({
      isCorrect: true,
      correctOption: 'A',
      explanation: 'ok',
      estimatedAbility: 0.4,
      recommendedFocus: [],
    });
    mocks.selectNextQuestionWithPersistenceFallback.mockResolvedValue({
      question: { id: 'preset-q-01', options: [] },
      estimatedAbility: 0.4,
      confidenceInterval: [-0.1, 0.9],
    });
    mocks.getDiagnosticWithPersistenceFallback.mockResolvedValue({
      knowledgeDimensions: {
        computational: 55,
        crossDomain: 50,
        design: 50,
      },
      weakAreas: [],
      recommendedFocus: [],
    });
    mocks.getAbilityReportWithPersistenceFallback.mockResolvedValue({
      userId: 'student-1',
      estimatedAbility: 0.4,
      confidenceInterval: [-0.1, 0.9],
      timeline: [],
      dimensions: {
        computationalTheta: 0,
        crossDomainTheta: 0,
        designTheta: 0,
      },
    });
    mocks.prisma.learningPath.findFirst.mockResolvedValue(null);
  });

  it('rejects unauthenticated adaptive answer submissions before persistence', async () => {
    mocks.getServerAuthSession.mockResolvedValue(null);

    const response = await submitRequest({
      userId: 'victim-user',
      sessionId: 'session-1',
      questionId: 'preset-q-01',
      selectedOption: 'A',
      timeSpent: 12,
      goalId: 'control-correction',
      routeIntent: 'path-execution',
      pathId: 'path-1',
      nodeId: 'adaptive-quiz:control-target-check',
    });

    expect(response.status).toBe(401);
    expect(mocks.submitAnswerWithPersistenceFallback).not.toHaveBeenCalled();
  });

  it('uses the authenticated user id instead of a submitted user id', async () => {
    mocks.getServerAuthSession.mockResolvedValue({
      user: { id: 'student-1', role: 'STUDENT' },
    });
    mocks.prisma.learningPath.findFirst.mockResolvedValue({
      nodeIds: ['adaptive-quiz:control-target-check'],
      pathPayload: {
        mainPathNodeIds: ['adaptive-quiz:control-target-check'],
        planNodes: [{ nodeId: 'adaptive-quiz:control-target-check', type: 'adaptive_quiz' }],
      },
    });

    const response = await submitRequest({
      userId: 'victim-user',
      sessionId: 'adaptive-path:path-1:adaptive-quiz:control-target-check',
      questionId: 'preset-q-01',
      selectedOption: 'A',
      timeSpent: 12,
      goalId: 'control-correction',
      routeIntent: 'path-execution',
      pathId: 'path-1',
      nodeId: 'adaptive-quiz:control-target-check',
    });

    expect(response.status).toBe(200);
    expect(mocks.submitAnswerWithPersistenceFallback).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'student-1',
      sessionId: 'adaptive-path:path-1:adaptive-quiz:control-target-check',
      pathContext: {
        pathId: 'path-1',
        nodeId: 'adaptive-quiz:control-target-check',
        goalId: 'control-correction',
        routeIntent: 'path-execution',
      },
    }));
  });

  it('does not persist submitted path context when the assessment session is not path scoped', async () => {
    mocks.getServerAuthSession.mockResolvedValue({
      user: { id: 'student-1', role: 'STUDENT' },
    });

    const response = await submitRequest({
      userId: 'victim-user',
      sessionId: 'session-1',
      questionId: 'preset-q-01',
      selectedOption: 'A',
      timeSpent: 12,
      goalId: 'control-correction',
      routeIntent: 'path-execution',
      pathId: 'path-1',
      nodeId: 'adaptive-quiz:control-target-check',
    });

    expect(response.status).toBe(200);
    expect(mocks.prisma.learningPath.findFirst).not.toHaveBeenCalled();
    expect(mocks.submitAnswerWithPersistenceFallback).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'student-1',
      sessionId: 'session-1',
      pathContext: undefined,
    }));
  });

  it('does not persist path context when goal id is missing', async () => {
    mocks.getServerAuthSession.mockResolvedValue({
      user: { id: 'student-1', role: 'STUDENT' },
    });

    const response = await submitRequest({
      sessionId: 'adaptive-path:path-1:adaptive-quiz:control-target-check',
      questionId: 'preset-q-01',
      selectedOption: 'A',
      timeSpent: 12,
      routeIntent: 'path-execution',
      pathId: 'path-1',
      nodeId: 'adaptive-quiz:control-target-check',
    });

    expect(response.status).toBe(200);
    expect(mocks.prisma.learningPath.findFirst).not.toHaveBeenCalled();
    expect(mocks.submitAnswerWithPersistenceFallback).toHaveBeenCalledWith(expect.objectContaining({
      pathContext: undefined,
    }));
  });

  it('does not persist path context when the current path node is not an adaptive quiz', async () => {
    mocks.getServerAuthSession.mockResolvedValue({
      user: { id: 'student-1', role: 'STUDENT' },
    });
    mocks.prisma.learningPath.findFirst.mockResolvedValue({
      nodeIds: ['simulation:cruise'],
      pathPayload: {
        mainPathNodeIds: ['simulation:cruise'],
        planNodes: [{ nodeId: 'simulation:cruise', type: 'simulation' }],
      },
    });

    const response = await submitRequest({
      sessionId: 'adaptive-path:path-1:simulation:cruise',
      questionId: 'preset-q-01',
      selectedOption: 'A',
      timeSpent: 12,
      goalId: 'control-correction',
      routeIntent: 'path-execution',
      pathId: 'path-1',
      nodeId: 'simulation:cruise',
    });

    expect(response.status).toBe(200);
    expect(mocks.submitAnswerWithPersistenceFallback).toHaveBeenCalledWith(expect.objectContaining({
      pathContext: undefined,
    }));
  });

  it('rejects unauthenticated next-question requests before durable session writes', async () => {
    mocks.getServerAuthSession.mockResolvedValue(null);

    const response = await nextQuestionRequest({
      userId: 'victim-user',
      sessionId: 'session-1',
    });

    expect(response.status).toBe(401);
    expect(mocks.selectNextQuestionWithPersistenceFallback).not.toHaveBeenCalled();
  });

  it('uses the authenticated user id for next-question requests', async () => {
    mocks.getServerAuthSession.mockResolvedValue({
      user: { id: 'student-1', role: 'STUDENT' },
    });

    const response = await nextQuestionRequest({
      userId: 'victim-user',
      sessionId: 'session-1',
    });

    expect(response.status).toBe(200);
    expect(mocks.selectNextQuestionWithPersistenceFallback).toHaveBeenCalledWith({
      userId: 'student-1',
      sessionId: 'session-1',
    });
  });

  it('rejects unauthenticated diagnostic reads', async () => {
    mocks.getServerAuthSession.mockResolvedValue(null);

    const response = await getDiagnostic(new Request('http://localhost/api/assessment/diagnostic?userId=victim-user'));

    expect(response.status).toBe(401);
    expect(mocks.getDiagnosticWithPersistenceFallback).not.toHaveBeenCalled();
  });

  it('uses the authenticated user id for diagnostic reads', async () => {
    mocks.getServerAuthSession.mockResolvedValue({
      user: { id: 'student-1', role: 'STUDENT' },
    });

    const response = await getDiagnostic(new Request('http://localhost/api/assessment/diagnostic?userId=victim-user'));

    expect(response.status).toBe(200);
    expect(mocks.getDiagnosticWithPersistenceFallback).toHaveBeenCalledWith('student-1');
  });

  it('rejects unauthenticated ability report reads', async () => {
    mocks.getServerAuthSession.mockResolvedValue(null);

    const response = await getAbilityReport(
      new Request('http://localhost/api/assessment/ability-report/student-1'),
      { params: Promise.resolve({ userId: 'student-1' }) },
    );

    expect(response.status).toBe(401);
    expect(mocks.getAbilityReportWithPersistenceFallback).not.toHaveBeenCalled();
  });

  it('rejects ability report reads for a different student', async () => {
    mocks.getServerAuthSession.mockResolvedValue({
      user: { id: 'student-1', role: 'STUDENT' },
    });

    const response = await getAbilityReport(
      new Request('http://localhost/api/assessment/ability-report/student-2'),
      { params: Promise.resolve({ userId: 'student-2' }) },
    );

    expect(response.status).toBe(403);
    expect(mocks.getAbilityReportWithPersistenceFallback).not.toHaveBeenCalled();
  });

  it('allows a student to read their own ability report', async () => {
    mocks.getServerAuthSession.mockResolvedValue({
      user: { id: 'student-1', role: 'STUDENT' },
    });

    const response = await getAbilityReport(
      new Request('http://localhost/api/assessment/ability-report/student-1'),
      { params: Promise.resolve({ userId: 'student-1' }) },
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.userId).toBe('student-1');
    expect(mocks.getAbilityReportWithPersistenceFallback).toHaveBeenCalledWith('student-1');
  });
});
