import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createKonlingTeachingAssistantServerContextToken: vi.fn(),
  getServerAuthSession: vi.fn(),
  classFindUnique: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  getServerAuthSession: mocks.getServerAuthSession,
}));

vi.mock('@/lib/konling-teaching-assistant-server-context', () => ({
  createKonlingTeachingAssistantServerContextToken: mocks.createKonlingTeachingAssistantServerContextToken,
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    class: {
      findUnique: mocks.classFindUnique,
    },
  },
}));

import { GET } from '@/app/api/adaptive/path-advisor-context/route';
import { getAdaptivePracticeGoalOptions } from '@/lib/adaptive-path-goal-options';

function request(query: string) {
  return GET(new Request(`http://localhost/api/adaptive/path-advisor-context?${query}`));
}

describe('path advisor context route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createKonlingTeachingAssistantServerContextToken.mockReturnValue('signed-token');
    mocks.classFindUnique.mockResolvedValue({ teacherId: 'teacher-1' });
    mocks.getServerAuthSession.mockResolvedValue({
      user: {
        id: 'student-1',
        role: 'STUDENT',
        profile: { classId: 'class-1' },
      },
    });
  });

  it('signs graphNodeId only when it belongs to the selected goal subgraph', async () => {
    const response = await request('goal=control-correction&graphNodeId=kn%3Aautocontrol%3Acontroller-correction');
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      goalId: 'control-correction',
      graphNodeId: 'kn:autocontrol:controller-correction',
      modeContextToken: 'signed-token',
      readiness: {
        status: 'ready',
        reason: 'ready',
        studentAction: 'continue-practice',
        staffAction: 'none',
      },
    });
    expect(mocks.createKonlingTeachingAssistantServerContextToken).toHaveBeenCalledWith(
      expect.objectContaining({
        goalId: 'control-correction',
        graphNodeId: 'kn:autocontrol:controller-correction',
        context: expect.objectContaining({
          'graph-node-context': true,
        }),
      }),
    );
  });

  it('builds advisor context from every visible LearningGoal metadata projection', async () => {
    const response = await request('goal=simulation-validation-practice&graphNodeId=kn%3Aautocontrol%3Asimulation-validation');
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      goalId: 'simulation-validation-practice',
      graphNodeId: 'kn:autocontrol:simulation-validation',
      modeContextToken: 'signed-token',
      courseTitle: '仿真验证实践',
      topic: '仿真验证实践学习路径',
      graphGrounding: expect.objectContaining({
        goalId: 'simulation-validation-practice',
        targetGraphNodeIds: expect.arrayContaining(['kn:autocontrol:simulation-validation']),
      }),
    });
    expect(body.learningObjectives).toEqual(expect.arrayContaining([
      expect.stringContaining('仿真'),
    ]));
    expect(body.quickPrompts).toEqual(expect.arrayContaining([
      expect.objectContaining({
        question: expect.stringContaining('仿真验证实践'),
      }),
    ]));
    expect(mocks.createKonlingTeachingAssistantServerContextToken).toHaveBeenCalledWith(
      expect.objectContaining({
        goalId: 'simulation-validation-practice',
        courseId: 'simulation-validation-practice',
        graphNodeId: 'kn:autocontrol:simulation-validation',
        context: expect.objectContaining({
          'graph-node-context': true,
        }),
      }),
    );
  });

  it('signs every visible path-ready LearningGoal with goal-specific advisor metadata', async () => {
    const options = getAdaptivePracticeGoalOptions();

    expect(options).toHaveLength(9);
    for (const option of options) {
      const response = await request(`goal=${encodeURIComponent(option.id)}`);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body).toMatchObject({
        goalId: option.id,
        courseTitle: option.title,
        topic: option.konlingContext.topic,
        learningObjectives: option.konlingContext.learningObjectives,
        quickPrompts: option.konlingContext.quickPrompts,
        graphGrounding: option.konlingContext.graphGrounding,
        modeContextToken: 'signed-token',
      });
    }
  });

  it('rejects unknown goals before signing any advisor context', async () => {
    const response = await request('goal=unknown-learning-goal');

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: '学习路径目标未注册',
    });
    expect(mocks.createKonlingTeachingAssistantServerContextToken).not.toHaveBeenCalled();
  });

  it('does not sign advisor context when authentication or class membership is missing', async () => {
    mocks.getServerAuthSession.mockResolvedValueOnce(null);
    const unauthenticatedResponse = await request('goal=simulation-validation-practice');

    expect(unauthenticatedResponse.status).toBe(401);
    expect(mocks.createKonlingTeachingAssistantServerContextToken).not.toHaveBeenCalled();

    mocks.getServerAuthSession.mockResolvedValueOnce({
      user: {
        id: 'student-1',
        role: 'STUDENT',
        profile: {},
      },
    });
    const missingClassResponse = await request('goal=simulation-validation-practice');

    expect(missingClassResponse.status).toBe(403);
    await expect(missingClassResponse.json()).resolves.toMatchObject({
      readiness: {
        status: 'blocked',
        reason: 'missing-class-binding',
        studentAction: 'request-teacher-binding',
        staffAction: 'bind-class',
      },
    });
    expect(mocks.createKonlingTeachingAssistantServerContextToken).not.toHaveBeenCalled();
  });

  it('returns readiness when teacher binding or path advisor service is unavailable', async () => {
    mocks.classFindUnique.mockResolvedValueOnce({ teacherId: null });
    const missingTeacherResponse = await request('goal=simulation-validation-practice');

    expect(missingTeacherResponse.status).toBe(403);
    await expect(missingTeacherResponse.json()).resolves.toMatchObject({
      readiness: {
        status: 'blocked',
        reason: 'missing-teacher-binding',
        studentAction: 'request-teacher-binding',
        staffAction: 'bind-class',
      },
    });
    expect(mocks.createKonlingTeachingAssistantServerContextToken).not.toHaveBeenCalled();

    mocks.classFindUnique.mockResolvedValueOnce({ teacherId: 'teacher-1' });
    mocks.createKonlingTeachingAssistantServerContextToken.mockReturnValueOnce(null);
    const serviceUnavailableResponse = await request('goal=simulation-validation-practice');

    expect(serviceUnavailableResponse.status).toBe(503);
    await expect(serviceUnavailableResponse.json()).resolves.toMatchObject({
      readiness: {
        status: 'retryable',
        reason: 'service-unavailable',
        studentAction: 'retry',
        staffAction: 'check-service',
      },
    });
  });

  it('rejects graphNodeId outside the selected goal subgraph', async () => {
    const response = await request('goal=control-correction&graphNodeId=kn%3Aautocontrol%3Afrequency-response');

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: '图谱节点不属于当前学习路径目标',
    });
    expect(mocks.createKonlingTeachingAssistantServerContextToken).not.toHaveBeenCalled();
  });

  it('does not treat legacy nodeId as graph node context', async () => {
    const response = await request('goal=control-correction&nodeId=kn%3Aautocontrol%3Acontroller-correction');
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.graphNodeId).toBeNull();
    expect(mocks.createKonlingTeachingAssistantServerContextToken).toHaveBeenCalledWith(
      expect.not.objectContaining({
        graphNodeId: expect.any(String),
      }),
    );
    expect(mocks.createKonlingTeachingAssistantServerContextToken).toHaveBeenCalledWith(
      expect.objectContaining({
        context: expect.not.objectContaining({
          'graph-node-context': true,
        }),
      }),
    );
  });
});
