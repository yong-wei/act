import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getServerAuthSession: vi.fn(),
  submitAnswerDurably: vi.fn(),
  selectNextQuestionDurably: vi.fn(),
  getDiagnosticDurably: vi.fn(),
  getAbilityReportDurably: vi.fn(),
  verifyCompanionPracticeMetadata: vi.fn(),
  verifyCompanionPracticeSubmissionMetadata: vi.fn(),
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
  submitAnswerDurably: mocks.submitAnswerDurably,
  selectNextQuestionDurably: mocks.selectNextQuestionDurably,
  getDiagnosticDurably: mocks.getDiagnosticDurably,
  getAbilityReportDurably: mocks.getAbilityReportDurably,
}));

vi.mock('@/lib/prisma', () => ({
  prisma: mocks.prisma,
}));

vi.mock('@/lib/konling-continuity-assessment', () => ({
  verifyCompanionPracticeMetadata: mocks.verifyCompanionPracticeMetadata,
  verifyCompanionPracticeSubmissionMetadata: mocks.verifyCompanionPracticeSubmissionMetadata,
}));

import { POST as submitAnswer } from '@/app/api/assessment/submit-answer/route';
import { POST as getNextQuestion } from '@/app/api/assessment/next-question/route';
import { GET as getDiagnostic } from '@/app/api/assessment/diagnostic/route';
import { GET as getAbilityReport } from '@/app/api/assessment/ability-report/[userId]/route';
import { AdaptiveAssessmentCatalogSelectionError } from '@/features/assessment/adaptive-assessment-catalog-selector';

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
    mocks.submitAnswerDurably.mockResolvedValue({
      isCorrect: true,
      correctOption: 'A',
      explanation: 'ok',
      estimatedAbility: 0.4,
      recommendedFocus: [],
    });
    mocks.selectNextQuestionDurably.mockResolvedValue({
      question: { id: 'preset-q-01', options: [] },
      estimatedAbility: 0.4,
      confidenceInterval: [-0.1, 0.9],
    });
    mocks.getDiagnosticDurably.mockResolvedValue({
      knowledgeDimensions: {
        computational: 55,
        crossDomain: 50,
        design: 50,
      },
      weakAreas: [],
      recommendedFocus: [],
    });
    mocks.getAbilityReportDurably.mockResolvedValue({
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
    mocks.verifyCompanionPracticeMetadata.mockResolvedValue(undefined);
    mocks.verifyCompanionPracticeSubmissionMetadata.mockResolvedValue(undefined);
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
    expect(mocks.submitAnswerDurably).not.toHaveBeenCalled();
  });

  it('uses the authenticated user id instead of a submitted user id', async () => {
    mocks.getServerAuthSession.mockResolvedValue({
      user: { id: 'student-1', role: 'STUDENT' },
    });
    mocks.prisma.learningPath.findFirst.mockResolvedValue({
      goalId: 'control-correction',
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
    await expect(response.json()).resolves.toMatchObject({
      microTutoring: {
        stage: 'readiness',
        qualified: false,
        unavailableReason: null,
        retryAttribution: false,
      },
    });
    expect(mocks.submitAnswerDurably).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'student-1',
      sessionId: 'adaptive-path:path-1:adaptive-quiz:control-target-check',
      pathContext: {
        pathId: 'path-1',
        nodeId: 'adaptive-quiz:control-target-check',
        goalId: 'control-correction',
        routeIntent: 'path-execution',
        questionScope: 'readiness',
      },
    }));
  });

  it('rejects path-execution submissions when the session is not path scoped', async () => {
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

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      message: '路径自适应答案提交的 sessionId 与 path/node 不匹配',
    });
    expect(mocks.submitAnswerDurably).not.toHaveBeenCalled();
  });

  it('rejects path-owned submissions with incomplete path fields', async () => {
    mocks.getServerAuthSession.mockResolvedValue({
      user: { id: 'student-1', role: 'STUDENT' },
    });

    const response = await submitRequest({
      sessionId: 'adaptive-path:path-1:adaptive-quiz:control-target-check',
      questionId: 'preset-q-01',
      selectedOption: 'A',
      timeSpent: 12,
      goalId: 'control-correction',
      pathId: 'path-1',
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      message: '路径自适应答案提交缺少完整 path/node 上下文',
    });
    expect(mocks.prisma.learningPath.findFirst).not.toHaveBeenCalled();
    expect(mocks.submitAnswerDurably).not.toHaveBeenCalled();
  });

  it('derives submitted path context goal from the server-owned learning path', async () => {
    mocks.getServerAuthSession.mockResolvedValue({
      user: { id: 'student-1', role: 'STUDENT' },
    });
    mocks.prisma.learningPath.findFirst.mockResolvedValue({
      goalId: 'control-correction',
      nodeIds: ['adaptive-quiz:control-target-check'],
      pathPayload: {
        mainPathNodeIds: ['adaptive-quiz:control-target-check'],
        planNodes: [{ nodeId: 'adaptive-quiz:control-target-check', type: 'adaptive_quiz' }],
      },
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
    expect(mocks.submitAnswerDurably).toHaveBeenCalledWith(expect.objectContaining({
      pathContext: {
        pathId: 'path-1',
        nodeId: 'adaptive-quiz:control-target-check',
        goalId: 'control-correction',
        routeIntent: 'path-execution',
        questionScope: 'readiness',
      },
    }));
  });

  it('persists submitted path context for checkpoint assessment nodes', async () => {
    mocks.getServerAuthSession.mockResolvedValue({
      user: { id: 'student-1', role: 'STUDENT' },
    });
    mocks.prisma.learningPath.findFirst.mockResolvedValue({
      goalId: 'control-correction',
      nodeIds: ['checkpoint:control-correction-review'],
      pathPayload: {
        mainPathNodeIds: ['checkpoint:control-correction-review'],
        planNodes: [{ nodeId: 'checkpoint:control-correction-review', type: 'checkpoint' }],
      },
    });

    const response = await submitRequest({
      sessionId: 'adaptive-path:path-1:checkpoint:control-correction-review',
      questionId: 'preset-q-01',
      selectedOption: 'A',
      timeSpent: 12,
      routeIntent: 'path-execution',
      pathId: 'path-1',
      nodeId: 'checkpoint:control-correction-review',
    });

    expect(response.status).toBe(200);
    expect(mocks.submitAnswerDurably).toHaveBeenCalledWith(expect.objectContaining({
      pathContext: {
        pathId: 'path-1',
        nodeId: 'checkpoint:control-correction-review',
        goalId: 'control-correction',
        routeIntent: 'path-execution',
        questionScope: 'checkpoint',
      },
    }));
  });

  it('rejects submitted path context when client goal mismatches the server path', async () => {
    mocks.getServerAuthSession.mockResolvedValue({
      user: { id: 'student-1', role: 'STUDENT' },
    });
    mocks.prisma.learningPath.findFirst.mockResolvedValue({
      goalId: 'control-correction',
      nodeIds: ['adaptive-quiz:control-target-check'],
      pathPayload: {
        mainPathNodeIds: ['adaptive-quiz:control-target-check'],
        planNodes: [{ nodeId: 'adaptive-quiz:control-target-check', type: 'adaptive_quiz' }],
      },
    });

    const response = await submitRequest({
      sessionId: 'adaptive-path:path-1:adaptive-quiz:control-target-check',
      questionId: 'preset-q-01',
      selectedOption: 'A',
      timeSpent: 12,
      goalId: 'frequency-response-foundations',
      routeIntent: 'path-execution',
      pathId: 'path-1',
      nodeId: 'adaptive-quiz:control-target-check',
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      message: '路径自适应答案提交的 goalId 与服务端路径目标不匹配',
    });
    expect(mocks.submitAnswerDurably).not.toHaveBeenCalled();
  });

  it('rejects path submissions when the current path node is not an adaptive quiz', async () => {
    mocks.getServerAuthSession.mockResolvedValue({
      user: { id: 'student-1', role: 'STUDENT' },
    });
    mocks.prisma.learningPath.findFirst.mockResolvedValue({
      goalId: 'control-correction',
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

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      message: '路径自适应答案提交的 nodeId 不是自适应测验或检查点节点',
    });
    expect(mocks.submitAnswerDurably).not.toHaveBeenCalled();
  });

  it('rejects unauthenticated next-question requests before durable session writes', async () => {
    mocks.getServerAuthSession.mockResolvedValue(null);

    const response = await nextQuestionRequest({
      userId: 'victim-user',
      sessionId: 'session-1',
    });

    expect(response.status).toBe(401);
    expect(mocks.selectNextQuestionDurably).not.toHaveBeenCalled();
  });

  it('uses the authenticated user id for next-question requests', async () => {
    mocks.getServerAuthSession.mockResolvedValue({
      user: { id: 'student-1', role: 'STUDENT' },
    });

    const response = await nextQuestionRequest({
      userId: 'victim-user',
      sessionId: 'session-1',
      goalId: 'control-correction',
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      assessmentStage: 'practice',
    });
    expect(mocks.selectNextQuestionDurably).toHaveBeenCalledWith({
      userId: 'student-1',
      sessionId: 'session-1',
      goalId: 'control-correction',
      questionScope: 'practice',
    });
  });

  it('passes only server-verified companion metadata to question selection', async () => {
    const verified = {
      origin: 'konling-companion-practice',
      snapshotId: 'continuity:1',
      targetKnowledgeId: 'root-locus',
      structuredCauseId: null,
    } as const;
    mocks.getServerAuthSession.mockResolvedValue({ user: { id: 'student-1', role: 'STUDENT' } });
    mocks.verifyCompanionPracticeMetadata.mockResolvedValue(verified);

    const response = await nextQuestionRequest({
      userId: 'victim-user',
      sessionId: 'konling-continuity:continuity:1',
      goalId: 'root-locus',
      continuity: { ...verified, snapshotId: 'client-value-is-revalidated' },
    });
    expect(response.status).toBe(200);
    expect(mocks.verifyCompanionPracticeMetadata).toHaveBeenCalledWith(expect.anything(), {
      userId: 'student-1',
      continuity: { ...verified, snapshotId: 'client-value-is-revalidated' },
    });
    expect(mocks.selectNextQuestionDurably).toHaveBeenCalledWith({
      userId: 'student-1',
      sessionId: 'konling-continuity:continuity:1',
      goalId: 'root-locus',
      questionScope: 'practice',
      continuity: verified,
    });
  });

  it('uses persisted companion authority for a completed submission retry', async () => {
    const verified = {
      origin: 'konling-companion-practice',
      snapshotId: 'continuity:before-result',
      targetKnowledgeId: 'root-locus',
      structuredCauseId: null,
    } as const;
    mocks.getServerAuthSession.mockResolvedValue({ user: { id: 'student-1', role: 'STUDENT' } });
    mocks.verifyCompanionPracticeSubmissionMetadata.mockResolvedValue(verified);

    const response = await submitRequest({
      sessionId: 'konling-continuity:continuity:before-result',
      questionId: 'preset-q-01',
      selectedOption: 'A',
      timeSpent: 10,
      continuity: verified,
    });

    expect(response.status).toBe(200);
    expect(mocks.verifyCompanionPracticeSubmissionMetadata).toHaveBeenCalledWith(expect.anything(), {
      userId: 'student-1',
      sessionId: 'konling-continuity:continuity:before-result',
      questionId: 'preset-q-01',
      continuity: verified,
    });
    expect(mocks.submitAnswerDurably).toHaveBeenCalledWith(expect.objectContaining({ continuity: verified }));
  });

  it('rejects companion practice when the session is not bound to the verified snapshot', async () => {
    const verified = {
      origin: 'konling-companion-practice',
      snapshotId: 'continuity:1',
      targetKnowledgeId: 'root-locus',
      structuredCauseId: null,
    } as const;
    mocks.getServerAuthSession.mockResolvedValue({ user: { id: 'student-1', role: 'STUDENT' } });
    mocks.verifyCompanionPracticeMetadata.mockResolvedValue(verified);

    const response = await nextQuestionRequest({
      sessionId: 'practice-other-session',
      goalId: 'attacker-controlled-goal',
      continuity: verified,
    });

    expect(response.status).toBe(400);
    expect(mocks.selectNextQuestionDurably).not.toHaveBeenCalled();
  });

  it('rejects reserved companion sessions when continuity metadata is omitted', async () => {
    mocks.getServerAuthSession.mockResolvedValue({ user: { id: 'student-1', role: 'STUDENT' } });
    mocks.verifyCompanionPracticeMetadata.mockResolvedValue(undefined);

    const response = await nextQuestionRequest({
      sessionId: 'konling-continuity:continuity:reserved',
      goalId: 'attacker-controlled-goal',
    });

    expect(response.status).toBe(400);
    expect(mocks.selectNextQuestionDurably).not.toHaveBeenCalled();
  });

  it('derives path next-question goal from the server-owned learning path', async () => {
    mocks.getServerAuthSession.mockResolvedValue({
      user: { id: 'student-1', role: 'STUDENT' },
    });
    mocks.prisma.learningPath.findFirst.mockResolvedValue({
      goalId: 'control-correction',
      nodeIds: ['adaptive-quiz:control-target-check'],
      pathPayload: {
        mainPathNodeIds: ['adaptive-quiz:control-target-check'],
        planNodes: [{ nodeId: 'adaptive-quiz:control-target-check', type: 'adaptive_quiz' }],
      },
    });

    const response = await nextQuestionRequest({
      userId: 'victim-user',
      sessionId: 'adaptive-path:path-1:adaptive-quiz:control-target-check',
      goalId: 'control-correction',
      pathId: 'path-1',
      nodeId: 'adaptive-quiz:control-target-check',
    });

    expect(response.status).toBe(200);
    expect(mocks.prisma.learningPath.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'path-1',
        userId: 'student-1',
        currentNodeId: 'adaptive-quiz:control-target-check',
      },
      select: {
        goalId: true,
        nodeIds: true,
        pathPayload: true,
      },
    });
    expect(mocks.selectNextQuestionDurably).toHaveBeenCalledWith({
      userId: 'student-1',
      sessionId: 'adaptive-path:path-1:adaptive-quiz:control-target-check',
      goalId: 'control-correction',
      questionScope: 'readiness',
    });
  });

  it('derives path next-question goal for checkpoint assessment nodes', async () => {
    mocks.getServerAuthSession.mockResolvedValue({
      user: { id: 'student-1', role: 'STUDENT' },
    });
    mocks.prisma.learningPath.findFirst.mockResolvedValue({
      goalId: 'control-correction',
      nodeIds: ['checkpoint:control-correction-review'],
      pathPayload: {
        mainPathNodeIds: ['checkpoint:control-correction-review'],
        planNodes: [{ nodeId: 'checkpoint:control-correction-review', type: 'checkpoint' }],
      },
    });

    const response = await nextQuestionRequest({
      sessionId: 'adaptive-path:path-1:checkpoint:control-correction-review',
      pathId: 'path-1',
      nodeId: 'checkpoint:control-correction-review',
    });

    expect(response.status).toBe(200);
    expect(mocks.selectNextQuestionDurably).toHaveBeenCalledWith({
      userId: 'student-1',
      sessionId: 'adaptive-path:path-1:checkpoint:control-correction-review',
      goalId: 'control-correction',
      questionScope: 'checkpoint',
    });
  });

  it('derives remediation scope from server-owned path node metadata', async () => {
    mocks.getServerAuthSession.mockResolvedValue({
      user: { id: 'student-1', role: 'STUDENT' },
    });
    mocks.prisma.learningPath.findFirst.mockResolvedValue({
      goalId: 'control-correction',
      nodeIds: ['adaptive-quiz:control-correction-remediation'],
      pathPayload: {
        mainPathNodeIds: ['adaptive-quiz:control-correction-remediation'],
        planNodes: [{
          nodeId: 'adaptive-quiz:control-correction-remediation',
          type: 'adaptive_quiz',
          checkpoint: {
            assessmentPurpose: 'remediation',
            remediationBehavior: '补救薄弱目标',
          },
        }],
      },
    });

    const response = await nextQuestionRequest({
      sessionId: 'adaptive-path:path-1:adaptive-quiz:control-correction-remediation',
      pathId: 'path-1',
      nodeId: 'adaptive-quiz:control-correction-remediation',
    });

    expect(response.status).toBe(200);
    expect(mocks.selectNextQuestionDurably).toHaveBeenCalledWith({
      userId: 'student-1',
      sessionId: 'adaptive-path:path-1:adaptive-quiz:control-correction-remediation',
      goalId: 'control-correction',
      questionScope: 'remediation',
    });
  });

  it('returns structured coverage limitations for path catalog selection failures', async () => {
    mocks.getServerAuthSession.mockResolvedValue({
      user: { id: 'student-1', role: 'STUDENT' },
    });
    mocks.prisma.learningPath.findFirst.mockResolvedValue({
      goalId: 'unknown-goal',
      nodeIds: ['adaptive-quiz:unknown-readiness'],
      pathPayload: {
        mainPathNodeIds: ['adaptive-quiz:unknown-readiness'],
        planNodes: [{ nodeId: 'adaptive-quiz:unknown-readiness', type: 'adaptive_quiz' }],
      },
    });
    mocks.selectNextQuestionDurably.mockRejectedValueOnce(
      new AdaptiveAssessmentCatalogSelectionError({
        code: 'path-assessment-catalog-coverage-incomplete',
        state: 'limited',
        learningGoalId: 'unknown-goal',
        requestedStage: 'readiness',
        reviewedPathEligibleCandidateCount: 0,
        limitationReason: 'no-reviewed-path-eligible-readiness-items',
      }),
    );

    const response = await nextQuestionRequest({
      sessionId: 'adaptive-path:path-1:adaptive-quiz:unknown-readiness',
      pathId: 'path-1',
      nodeId: 'adaptive-quiz:unknown-readiness',
    });

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      error: 'assessment_catalog_coverage_limited',
      limitation: {
        code: 'path-assessment-catalog-coverage-incomplete',
        state: 'limited',
        learningGoalId: 'unknown-goal',
        requestedStage: 'readiness',
      },
    });
  });

  it('rejects path next-question requests with mismatched client goal', async () => {
    mocks.getServerAuthSession.mockResolvedValue({
      user: { id: 'student-1', role: 'STUDENT' },
    });
    mocks.prisma.learningPath.findFirst.mockResolvedValue({
      goalId: 'control-correction',
      nodeIds: ['adaptive-quiz:control-target-check'],
      pathPayload: {
        mainPathNodeIds: ['adaptive-quiz:control-target-check'],
        planNodes: [{ nodeId: 'adaptive-quiz:control-target-check', type: 'adaptive_quiz' }],
      },
    });

    const response = await nextQuestionRequest({
      sessionId: 'adaptive-path:path-1:adaptive-quiz:control-target-check',
      goalId: 'frequency-response-foundations',
      pathId: 'path-1',
      nodeId: 'adaptive-quiz:control-target-check',
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      message: '路径自适应题目请求的 goalId 与服务端路径目标不匹配',
    });
    expect(mocks.selectNextQuestionDurably).not.toHaveBeenCalled();
  });

  it('rejects path next-question requests with mismatched session scope', async () => {
    mocks.getServerAuthSession.mockResolvedValue({
      user: { id: 'student-1', role: 'STUDENT' },
    });

    const response = await nextQuestionRequest({
      sessionId: 'session-1',
      goalId: 'control-correction',
      pathId: 'path-1',
      nodeId: 'adaptive-quiz:control-target-check',
    });

    expect(response.status).toBe(400);
    expect(mocks.prisma.learningPath.findFirst).not.toHaveBeenCalled();
    expect(mocks.selectNextQuestionDurably).not.toHaveBeenCalled();
  });

  it('allows path-selection next-question requests with only a path id', async () => {
    mocks.getServerAuthSession.mockResolvedValue({
      user: { id: 'student-1', role: 'STUDENT' },
    });

    const response = await nextQuestionRequest({
      sessionId: 'practice-1',
      goalId: 'control-correction',
      routeIntent: 'path-selection',
      pathId: 'path-1',
    });

    expect(response.status).toBe(200);
    expect(mocks.prisma.learningPath.findFirst).not.toHaveBeenCalled();
    expect(mocks.selectNextQuestionDurably).toHaveBeenCalledWith({
      userId: 'student-1',
      sessionId: 'practice-1',
      goalId: 'control-correction',
      questionScope: 'practice',
    });
  });

  it('rejects path next-question requests with only a path id', async () => {
    mocks.getServerAuthSession.mockResolvedValue({
      user: { id: 'student-1', role: 'STUDENT' },
    });

    const response = await nextQuestionRequest({
      sessionId: 'adaptive-path:path-1:adaptive-quiz:control-target-check',
      goalId: 'control-correction',
      pathId: 'path-1',
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      message: '路径自适应题目请求缺少完整 path/node 上下文',
    });
    expect(mocks.prisma.learningPath.findFirst).not.toHaveBeenCalled();
    expect(mocks.selectNextQuestionDurably).not.toHaveBeenCalled();
  });

  it('rejects path-execution next-question requests with only a path id', async () => {
    mocks.getServerAuthSession.mockResolvedValue({
      user: { id: 'student-1', role: 'STUDENT' },
    });

    const response = await nextQuestionRequest({
      sessionId: 'practice-1',
      goalId: 'control-correction',
      routeIntent: 'path-execution',
      pathId: 'path-1',
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      message: '路径自适应题目请求缺少完整 path/node 上下文',
    });
    expect(mocks.prisma.learningPath.findFirst).not.toHaveBeenCalled();
    expect(mocks.selectNextQuestionDurably).not.toHaveBeenCalled();
  });

  it('rejects path next-question requests with only a node id', async () => {
    mocks.getServerAuthSession.mockResolvedValue({
      user: { id: 'student-1', role: 'STUDENT' },
    });

    const response = await nextQuestionRequest({
      sessionId: 'adaptive-path:path-1:adaptive-quiz:control-target-check',
      goalId: 'control-correction',
      nodeId: 'adaptive-quiz:control-target-check',
    });

    expect(response.status).toBe(400);
    expect(mocks.prisma.learningPath.findFirst).not.toHaveBeenCalled();
    expect(mocks.selectNextQuestionDurably).not.toHaveBeenCalled();
  });

  it('rejects path-scoped next-question sessions without path fields', async () => {
    mocks.getServerAuthSession.mockResolvedValue({
      user: { id: 'student-1', role: 'STUDENT' },
    });

    const response = await nextQuestionRequest({
      sessionId: 'adaptive-path:path-1:adaptive-quiz:control-target-check',
      goalId: 'control-correction',
    });

    expect(response.status).toBe(400);
    expect(mocks.prisma.learningPath.findFirst).not.toHaveBeenCalled();
    expect(mocks.selectNextQuestionDurably).not.toHaveBeenCalled();
  });

  it('rejects unauthenticated diagnostic reads', async () => {
    mocks.getServerAuthSession.mockResolvedValue(null);

    const response = await getDiagnostic(new Request('http://localhost/api/assessment/diagnostic?userId=victim-user'));

    expect(response.status).toBe(401);
    expect(mocks.getDiagnosticDurably).not.toHaveBeenCalled();
  });

  it('uses the authenticated user id for diagnostic reads', async () => {
    mocks.getServerAuthSession.mockResolvedValue({
      user: { id: 'student-1', role: 'STUDENT' },
    });

    const response = await getDiagnostic(new Request('http://localhost/api/assessment/diagnostic?userId=victim-user'));

    expect(response.status).toBe(200);
    expect(mocks.getDiagnosticDurably).toHaveBeenCalledWith('student-1');
  });

  it('rejects unauthenticated ability report reads', async () => {
    mocks.getServerAuthSession.mockResolvedValue(null);

    const response = await getAbilityReport(
      new Request('http://localhost/api/assessment/ability-report/student-1'),
      { params: Promise.resolve({ userId: 'student-1' }) },
    );

    expect(response.status).toBe(401);
    expect(mocks.getAbilityReportDurably).not.toHaveBeenCalled();
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
    expect(mocks.getAbilityReportDurably).not.toHaveBeenCalled();
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
    expect(mocks.getAbilityReportDurably).toHaveBeenCalledWith('student-1');
  });
});
