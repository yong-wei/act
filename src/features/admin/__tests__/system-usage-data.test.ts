import { describe, expect, it } from 'vitest';

import { buildSystemUsageData } from '../states/system-usage-data';

describe('buildSystemUsageData', () => {
  it('should build a non-empty payload from real source records', () => {
    const result = buildSystemUsageData({
      now: new Date('2026-03-19T10:00:00+08:00'),
      users: {
        students: 12,
        teachers: 3,
        admins: 1,
      },
      interactionLogs: [
        {
          userId: 'stu-1',
          eventType: 'view',
          resourceKey: 'interactive-course',
          lessonKey: null,
          createdAt: new Date('2026-03-01T09:00:00+08:00'),
        },
        {
          userId: 'stu-1',
          eventType: 'complete',
          resourceKey: 'interactive-course',
          lessonKey: null,
          createdAt: new Date('2026-03-02T09:00:00+08:00'),
        },
        {
          userId: 'stu-2',
          eventType: 'ai_query',
          resourceKey: 'knowledge-graph',
          lessonKey: null,
          createdAt: new Date('2026-02-10T11:00:00+08:00'),
        },
      ],
      simulationSessions: [
        {
          userId: 'stu-1',
          simType: 'destroyer',
          createdAt: new Date('2026-03-03T10:00:00+08:00'),
        },
        {
          userId: 'stu-2',
          simType: 'cruise',
          createdAt: new Date('2026-03-04T10:00:00+08:00'),
        },
      ],
      simulationLogs: [
        {
          duration: 1200,
          inputParams: { simulationType: 'destroyer' },
          createdAt: new Date('2026-03-03T10:30:00+08:00'),
        },
        {
          duration: 900,
          inputParams: { simulationType: 'cruise' },
          createdAt: new Date('2026-03-04T10:30:00+08:00'),
        },
      ],
      learningFacts: [
        {
          factType: 'question',
          outcome: 'success',
          createdAt: new Date('2026-03-05T08:00:00+08:00'),
        },
        {
          factType: 'question',
          outcome: 'failure',
          createdAt: new Date('2026-03-06T08:00:00+08:00'),
        },
        {
          factType: 'simulation',
          outcome: 'success',
          createdAt: new Date('2026-03-07T08:00:00+08:00'),
        },
      ],
      llmSessions: [
        {
          userId: 'stu-3',
          module: 'knowledge-graph',
          createdAt: new Date('2026-03-06T14:00:00+08:00'),
        },
      ],
      ethicalLogCount: 2,
    });

    expect(result.userScale).toEqual({
      students: 12,
      teachers: 3,
      admins: 1,
    });
    expect(result.interactionByType.length).toBeGreaterThan(0);
    expect(result.simulationVisits.map((item) => item.simulation)).toEqual(
      expect.arrayContaining(['052D驱逐舰仿真', '豪华邮轮仿真'])
    );
    expect(result.moduleVisitShare.some((item) => item.module === '知识图谱')).toBe(true);
    expect(result.monthlyTrend.at(-1)?.month).toBe('2026-03');
    expect(result.estimatedPerStudent.exerciseAttempts).toBeGreaterThan(0);
  });

  it('should still return a valid payload when activity data is empty', () => {
    const result = buildSystemUsageData({
      now: new Date('2026-03-19T10:00:00+08:00'),
      users: {
        students: 0,
        teachers: 0,
        admins: 1,
      },
      interactionLogs: [],
      simulationSessions: [],
      simulationLogs: [],
      learningFacts: [],
      llmSessions: [],
      ethicalLogCount: 0,
    });

    expect(result.userScale.admins).toBe(1);
    expect(result.interactionByType).toEqual([]);
    expect(result.simulationVisits).toEqual([]);
    expect(result.monthlyTrend).toHaveLength(12);
    expect(result.monthlyTrend.every((item) => item.totalVisits === 0)).toBe(true);
  });
});
