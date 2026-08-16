import { describe, expect, it } from 'vitest';

import {
  buildClassroomPortfolioWorks,
  buildEthicsPortfolioCases,
  buildSimulationPortfolioDesigns,
  getPortfolioEvidenceSourceState,
} from '@/lib/data-governance/profile-portfolio-evidence';

describe('profile portfolio evidence projections', () => {
  it('projects classroom submissions into safe summaries', () => {
    const rows = buildClassroomPortfolioWorks([
      {
        id: 'response-1',
        lessonKey: 'unit-5-3',
        stepId: 'step-03',
        submittedAt: new Date('2026-08-16T01:00:00.000Z'),
        responseData: {
          score: 92,
          answers: { q1: 'private-answer' },
          questionSummaries: [{ questionId: 'q1', isCorrect: true }],
        },
        session: { plan: { title: '控制系统辨识' } },
      },
    ]);

    expect(rows).toEqual([
      expect.objectContaining({
        id: 'response-1',
        title: 'unit-5-3 · step-03',
        type: '课堂提交',
        sessionName: '控制系统辨识',
        content: '已提交课堂步骤 step-03，得分 92 分。',
      }),
    ]);
    expect(JSON.stringify(rows)).not.toContain('private-answer');
  });

  it('projects only approved numeric simulation parameters', () => {
    const rows = buildSimulationPortfolioDesigns([
      {
        id: 'simulation-1',
        controlMode: 'PID',
        inputParams: { kp: 1.2, ki: 0.4, kd: 2.1, secret: 'do-not-expose' },
        score: 86.4,
        createdAt: new Date('2026-08-16T02:00:00.000Z'),
      },
    ]);

    expect(rows).toEqual([
      expect.objectContaining({
        id: 'simulation-1',
        name: 'PID 仿真设计',
        score: 86,
        parameters: { kp: 1.2, ki: 0.4, kd: 2.1 },
      }),
    ]);
    expect(JSON.stringify(rows)).not.toContain('do-not-expose');
    expect(JSON.stringify(rows)).not.toContain('trajectoryData');
  });

  it('keeps ethics remediation state visible', () => {
    const rows = buildEthicsPortfolioCases([
      {
        id: 'ethics-1',
        violationType: 'COLLISION_RISK',
        aiCritique: '存在碰撞风险',
        studentJustification: '我会先减速并重新规划航向。',
        isResolved: true,
        createdAt: new Date('2026-08-16T03:00:00.000Z'),
      },
    ]);

    expect(rows).toEqual([
      expect.objectContaining({
        id: 'ethics-1',
        description: '存在碰撞风险',
        remediationAction: '我会先减速并重新规划航向。',
        isResolved: true,
      }),
    ]);
  });

  it('distinguishes empty from unavailable source reads', () => {
    expect(getPortfolioEvidenceSourceState(0)).toBe('empty');
    expect(getPortfolioEvidenceSourceState(2)).toBe('available');
    expect(getPortfolioEvidenceSourceState(null)).toBe('unavailable');
  });
});
