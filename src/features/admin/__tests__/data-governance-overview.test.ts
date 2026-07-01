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
        latestReports: [
          {
            sessionId: 'session-5-2',
            lessonKey: 'unit-5-2-nonlinear-analysis-entry',
            reportStatus: 'READY',
            summary: '5-2 富证据课堂',
            updatedAt: '2026-03-19T08:30:00.000Z',
            qualityStatus: 'green',
            qualityReasons: ['healthy_quality_gate'],
          },
          {
            sessionId: 'session-5-1',
            lessonKey: 'unit-5-1-linear-backbone-boundaries',
            reportStatus: 'READY',
            summary: '5-1 旧证据课堂',
            updatedAt: '2026-03-19T08:20:00.000Z',
            qualityStatus: 'red',
            qualityReasons: ['low_fact_coverage'],
          },
        ],
      },
      featureCache: {
        payloadVersion: 'student-evidence-features.v1',
        totalEntries: 9,
        staleEntries: 2,
        latestRefreshAt: '2026-03-19T08:40:00.000Z',
        totalSourceFacts: 42,
        totalRebuilds: 11,
        coverage: {
          LearningFact: { available: 8, missing: 1 },
        },
      },
      sourceCoverage: {
        generatedAt: '2026-03-19T08:45:00.000Z',
        catalogVersion: '2026-05-19',
        totals: {
          totalRows: 4,
          eligibleRows: 1,
          excludedRows: 2,
          unsupportedRows: 1,
          affectedUsers: 2,
        },
        sources: [],
        exclusions: [
          {
            sourceId: 'InteractionLog',
            reason: 'non_real_provenance',
            rowCount: 1,
            affectedUsers: 1,
            sampleSourceReference: 'InteractionLog:log-demo-5-2',
          },
        ],
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
            totalRows: 3,
            eligibleRows: 1,
            excludedRows: 2,
            unsupportedRows: 0,
            affectedUsers: 2,
            provenanceCounts: { demo: 1, real: 2 },
            exclusionReasons: ['non_real_provenance', 'low_value_activity_context'],
          },
          {
            id: 'ArenaEvaluationRun',
            learningScope: 'historical',
            valueLevel: 'medium',
            eligibility: 'unsupported',
            materializationReadiness: 'future',
            totalRows: 1,
            eligibleRows: 0,
            excludedRows: 0,
            unsupportedRows: 1,
            affectedUsers: 0,
            provenanceCounts: { real: 1 },
            exclusionReasons: ['source_not_profile_ready'],
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
      targetRiskFlag: {
        id: 'risk-1',
        userId: 'u-1',
        userName: '张三',
        flagType: 'ai_misuse',
        severity: 'high',
        description: '最近 7 天 AI 依赖显著升高',
        triggeredAt: '2026-03-19T08:00:00.000Z',
        isResolved: true,
        resolvedAt: '2026-03-19T09:00:00.000Z',
        dispositionStatus: 'ignored',
        undoAvailable: true,
      },
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
    expect(overview.tabs.map((tab) => tab.label)).toEqual(['总览', '风险治理', '课堂质量', '证据源', '缓存健康']);
    expect(overview.sessionQualityPanel).toMatchObject({
      title: '课堂质量分布',
      rows: [
        expect.objectContaining({
          sessionId: 'session-5-2',
          qualityStatus: 'green',
          qualityReasons: ['healthy_quality_gate'],
        }),
        expect.objectContaining({
          sessionId: 'session-5-1',
          qualityStatus: 'red',
          qualityReasons: ['low_fact_coverage'],
        }),
      ],
    });
    expect(overview.sourceCoveragePanel).toMatchObject({
      title: '证据源覆盖',
      totals: {
        totalRows: 4,
        eligibleRows: 1,
        excludedRows: 2,
        unsupportedRows: 1,
      },
      exclusions: [
        expect.objectContaining({
          sourceId: 'InteractionLog',
          reason: 'non_real_provenance',
          rowCount: 1,
        }),
      ],
    });
    expect(overview.cachePanel).toMatchObject({
      title: '特征缓存健康',
      totalEntries: 9,
      staleEntries: 2,
      latestRefreshAt: '2026-03-19T08:40:00.000Z',
      totalSourceFacts: 42,
    });
    expect(overview.snapshotPanel.title).toBe('最新快照明细');
    expect(overview.riskPanel.rows[0]?.userName).toBe('张三');
    expect(overview.riskPanel.rows[0]).toMatchObject({
      id: 'risk-1',
      isResolved: true,
      undoAvailable: true,
      flagLabel: 'AI 依赖风险',
    });
    expect(overview.riskPanel.rows).toHaveLength(1);
  });
});
