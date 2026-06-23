import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createKonlingTeachingAssistantServerContextToken: vi.fn(),
  getServerAuthSession: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  getServerAuthSession: mocks.getServerAuthSession,
}));

vi.mock('@/lib/konling-teaching-assistant-server-context', () => ({
  createKonlingTeachingAssistantServerContextToken: mocks.createKonlingTeachingAssistantServerContextToken,
}));

import { GET } from '@/app/api/adaptive/path-advisor-context/route';

function request(query: string) {
  return GET(new Request(`http://localhost/api/adaptive/path-advisor-context?${query}`));
}

describe('path advisor context route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createKonlingTeachingAssistantServerContextToken.mockReturnValue('signed-token');
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
