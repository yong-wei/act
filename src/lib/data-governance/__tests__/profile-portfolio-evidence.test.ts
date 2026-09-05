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

  it('projects simulation designs from the shared student-safe evidence items', () => {
    const rows = buildSimulationPortfolioDesigns([
      {
        id: 'simulation-run:run-1',
        sourceKind: 'canonical-run',
        sourceRefId: 'control-workbench:hash',
        title: '控制工作台分析',
        sourceLabel: '控制工作台',
        resultAuthority: 'preview',
        score: 86.4,
        durationSeconds: null,
        parameters: { kp: 1.2, ki: 0.4, kd: 2.1 },
        occurredAt: '2026-08-16T02:00:00.000Z',
        href: '/interactive-learning/control-workbench',
      },
    ]);

    expect(rows).toEqual([
      expect.objectContaining({
        id: 'simulation-run:run-1',
        name: '控制工作台分析',
        score: 86,
        parameters: { kp: 1.2, ki: 0.4, kd: 2.1 },
        createdAt: '2026-08-16T02:00:00.000Z',
      }),
    ]);
  });

  it('keeps score-null semantics instead of fabricating a zero score', () => {
    const rows = buildSimulationPortfolioDesigns([
      {
        id: 'simulation:log-1',
        sourceKind: 'legacy-log',
        sourceRefId: null,
        title: '仿真调参（PID）',
        sourceLabel: '仿真训练',
        resultAuthority: 'preview',
        score: null,
        durationSeconds: 600,
        parameters: {},
        occurredAt: '2026-08-16T02:30:00.000Z',
        href: '/simulations/destroyer',
      },
    ]);

    expect(rows[0]).toEqual(expect.objectContaining({
      score: null,
      parameters: {},
    }));
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
