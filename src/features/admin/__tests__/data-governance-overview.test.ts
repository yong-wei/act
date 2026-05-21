import { describe, expect, it } from 'vitest';

import { buildGovernanceOverview } from '../data-governance-overview';

describe('buildGovernanceOverview', () => {
  it('should expose Chinese overview cards and deeper content blocks', () => {
    const overview = buildGovernanceOverview({
      status: 'healthy',
      timestamp: '2026-03-19T10:30:00.000Z',
      freshness: {
        lastSnapshotMinutes: 18,
        status: 'fresh',
      },
      data: {
        studentSnapshots: 128,
        classSnapshots: 12,
        learningFacts: 560,
        activeRiskFlags: 6,
        bufferedEvents: 4,
      },
      queues: {
        eventIngestion: { waiting: 2, active: 1, completed: 24, failed: 0 },
        studentSnapshot: { waiting: 0, active: 1, completed: 16, failed: 0 },
        classSnapshot: { waiting: 1, active: 0, completed: 8, failed: 1 },
      },
      factTypeDistribution: [
        { label: '习题作答', count: 220 },
        { label: '仿真实验', count: 180 },
      ],
      sessionQuality: {
        recentSessions: 20,
        green: 12,
        yellow: 5,
        red: 3,
        unknown: 0,
      },
      sourceCatalog: {
        totalSources: 2,
        coverageCommand: 'npm run db:evidence-source-coverage -- --text',
        sources: [
          {
            id: 'InteractionLog',
            learningScope: 'mixed',
            valueLevel: 'medium',
            eligibility: 'eligible',
            materializationReadiness: 'partial',
          },
          {
            id: 'ArenaEvaluationRun',
            learningScope: 'historical',
            valueLevel: 'medium',
            eligibility: 'unsupported',
            materializationReadiness: 'future',
          },
        ],
      },
      recentRiskFlags: [
        {
          id: 'risk-1',
          userId: 'u-1',
          userName: '张三',
          flagType: 'ai_misuse',
          severity: 'high',
          description: '最近 7 天 AI 依赖显著升高',
          triggeredAt: '2026-03-19T08:00:00.000Z',
          isResolved: false,
        },
      ],
      recentSnapshots: [
        {
          userId: 'u-2',
          userName: '李四',
          snapshotAt: '2026-03-19T07:00:00.000Z',
          factCount: 18,
        },
      ],
      topSnapshotStudents: [
        {
          userId: 'u-2',
          userName: '李四',
          factCount: 18,
          snapshotAt: '2026-03-19T07:00:00.000Z',
        },
      ],
    });

    expect(overview.summaryCards.map((card) => card.title)).toEqual(
      expect.arrayContaining(['系统状态', '数据新鲜度', '学习事实总量', '待处理风险', '课堂质量'])
    );
    expect(overview.summaryCards.find((card) => card.title === '课堂质量')).toMatchObject({
      value: '12/20',
      detail: '黄 5 · 红 3 · 未识别 0',
      tone: 'danger',
    });
    expect(overview.queueCards.map((card) => card.title)).toEqual(
      expect.arrayContaining(['事件入池队列', '学生快照队列', '班级快照队列'])
    );
    expect(overview.riskPanel.title).toBe('最新风险清单');
    expect(overview.factPanel.title).toBe('事实类型分布');
    expect(overview.sourceCatalogPanel).toMatchObject({
      title: '证据源目录',
      totalSources: 2,
      eligibleSources: 1,
      unsupportedSources: 1,
      coverageCommand: 'npm run db:evidence-source-coverage -- --text',
    });
    expect(overview.snapshotPanel.title).toBe('最新快照明细');
    expect(overview.riskPanel.rows[0]?.userName).toBe('张三');
  });
});
