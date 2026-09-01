import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PrismaClient } from '@prisma/client';

vi.mock('server-only', () => ({}));

const { listStudentAssignments } = vi.hoisted(() => ({
  listStudentAssignments: vi.fn(),
}));

vi.mock('@/lib/assignments/submission-service', () => ({ listStudentAssignments }));

import {
  assembleAiWorkshopCollections,
} from '@/features/ai/ai-workshop-collections.server';
import { orderByOccurrence } from '@/features/ai/ai-workshop-collections';

function createDb() {
  return {
    learningPath: { findFirst: vi.fn().mockResolvedValue(null) },
    knowledgeNode: { findMany: vi.fn().mockResolvedValue([]) },
    growthRecord: { findMany: vi.fn().mockResolvedValue([]), count: vi.fn().mockResolvedValue(0) },
    simulationLog: { findMany: vi.fn().mockResolvedValue([]), count: vi.fn().mockResolvedValue(0) },
    arenaSubmission: { findMany: vi.fn().mockResolvedValue([]), count: vi.fn().mockResolvedValue(0) },
    ethicalLog: { findMany: vi.fn().mockResolvedValue([]), count: vi.fn().mockResolvedValue(0) },
  };
}

describe('assembleAiWorkshopCollections', () => {
  beforeEach(() => {
    listStudentAssignments.mockReset();
  });

  it('projects mixed source states independently with student-safe items', async () => {
    listStudentAssignments.mockResolvedValue([
      {
        id: 'assignment-1', title: '时域分析作业', contextStatus: 'CURRENT', state: 'IN_PROGRESS',
        submittedRequiredCount: 1, requiredQuestionCount: 2,
      },
      {
        id: 'assignment-2', title: '历史作业', contextStatus: 'HISTORICAL', state: 'REVIEWED',
        submittedRequiredCount: 3, requiredQuestionCount: 3,
      },
    ]);
    const db = createDb();
    db.learningPath.findFirst.mockResolvedValue({
      id: 'path-1', title: '控制矫正路径', nodeIds: ['node-a', 'node-b', 'node-c'], currentNodeId: 'node-b',
    });
    db.knowledgeNode.findMany.mockResolvedValue([
      { id: 'node-a', name: '根轨迹' },
      { id: 'node-b', name: '频域分析' },
      { id: 'node-c', name: '校正设计' },
    ]);
    db.simulationLog.findMany.mockResolvedValue([{
      id: 'sim-1', controlMode: 'PID', inputParams: { kp: 1.2, ki: 0.3, kd: 0.05, raw: 'x' },
      score: 86, isEthicalViolation: false, odysseyCompletedAt: new Date('2026-08-20T08:00:00Z'),
      createdAt: new Date('2026-08-20T08:00:00Z'),
    }]);
    db.simulationLog.count.mockResolvedValue(1);
    db.arenaSubmission.findMany.mockResolvedValue([{
      id: 'arena-1', method: 'PID', score: 42, valid: false, submittedAt: new Date('2026-08-21T08:00:00Z'),
    }]);
    db.arenaSubmission.count.mockResolvedValue(1);
    db.growthRecord.findMany.mockImplementation(({ where }: { where: { recordType: { in: string[] } } }) => (
      where.recordType.in.includes('reflection')
        ? [{
          id: 'growth-j1', recordType: 'reflection', title: '反思一',
          description: '本周复盘了根轨迹绘制。', occurredAt: new Date('2026-08-22T08:00:00Z'),
        }]
        : []
    ));
    db.growthRecord.count.mockImplementation(({ where }: { where: { recordType: { in: string[] } } }) => (
      where.recordType.in.includes('reflection') ? 1 : 0
    ));
    db.ethicalLog.findMany.mockResolvedValue([{
      id: 'ethics-1', violationType: 'SPEED_LIMIT', studentJustification: '已调整舵角速率。',
      resolvedAt: new Date('2026-08-23T08:00:00Z'), createdAt: new Date('2026-08-19T08:00:00Z'),
    }]);
    db.ethicalLog.count.mockResolvedValue(1);

    const collections = await assembleAiWorkshopCollections('student-1', db as unknown as PrismaClient);

    expect(collections.authority).toBe('server-owned');
    // 历史作业不属于当前发布范围，不得进入任务集合。
    expect(collections.tasks.state).toBe('available');
    expect(collections.tasks.items).toHaveLength(1);
    expect(collections.tasks.items[0]).toMatchObject({
      id: 'assignment:assignment-1',
      status: 'in_progress',
      progress: 50,
      sourceKind: 'assignment',
    });
    // 里程碑保留路径身份与权威状态。
    expect(collections.milestones.state).toBe('available');
    expect(collections.milestones.items.map((item) => item.status)).toEqual(['COMPLETED', 'CURRENT', 'PENDING']);
    expect(collections.milestones.items[1]?.title).toBe('频域分析');
    // 成就为空是权威空态，total 为 0 而非未知。
    expect(collections.achievements).toMatchObject({ state: 'empty', total: 0 });
    // 实验：无效 Arena 结果不得表示为正式分数；原始载荷字段被白名单裁掉。
    expect(collections.experiments.state).toBe('available');
    expect(collections.experiments.total).toBe(2);
    const arena = collections.experiments.items.find((item) => item.id === 'arena:arena-1');
    expect(arena).toMatchObject({ resultAuthority: 'preview', score: null, type: 'ARENA_SUBMISSION' });
    const simulation = collections.experiments.items.find((item) => item.id === 'simulation:sim-1');
    expect(simulation).toMatchObject({ resultAuthority: 'official', parameters: { kp: 1.2, ki: 0.3, kd: 0.05 } });
    expect(JSON.stringify(collections.experiments.items)).not.toContain('raw');
    // 日志：反思与已整改伦理决策进入，草稿与候选没有入口。
    expect(collections.journals.state).toBe('available');
    expect(collections.journals.items.map((item) => item.entryType).sort()).toEqual(['ETHICS_DECISION', 'REFLECTION']);
  });

  it('isolates a failing source without zeroing other collections', async () => {
    listStudentAssignments.mockResolvedValue([{
      id: 'assignment-1', title: '作业一', contextStatus: 'CURRENT', state: 'NOT_STARTED',
      submittedRequiredCount: 0, requiredQuestionCount: 2,
    }]);
    const db = createDb();
    db.simulationLog.findMany.mockRejectedValue(new Error('simulation source down'));

    const collections = await assembleAiWorkshopCollections('student-1', db as unknown as PrismaClient);

    expect(collections.experiments).toMatchObject({ state: 'unavailable', total: null, items: [] });
    expect(collections.experiments.limitation).toContain('暂时无法确认');
    expect(collections.tasks.state).toBe('available');
    expect(collections.journals.state).toBe('empty');
  });

  it('restricts achievements and journals to durable registered record types', async () => {
    listStudentAssignments.mockResolvedValue([]);
    const db = createDb();

    await assembleAiWorkshopCollections('student-1', db as unknown as PrismaClient);

    const growthWhere = db.growthRecord.findMany.mock.calls.map((call) => call[0].where);
    expect(growthWhere).toEqual(expect.arrayContaining([
      expect.objectContaining({ recordType: { in: ['milestone', 'breakthrough'] }, invalidations: { none: {} } }),
      expect.objectContaining({ recordType: { in: ['reflection', 'portfolio'] }, invalidations: { none: {} } }),
    ]));
    // 未整改的伦理记录不是学生确认的日志。
    expect(db.ethicalLog.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ isResolved: true }),
    }));
  });

  it('never accepts a client-provided learner identity', async () => {
    listStudentAssignments.mockResolvedValue([]);
    const db = createDb();

    await assembleAiWorkshopCollections('student-1', db as unknown as PrismaClient);

    expect(listStudentAssignments).toHaveBeenCalledWith(db, 'student-1');
    expect(db.learningPath.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ userId: 'student-1' }),
    }));
  });
});

describe('orderByOccurrence', () => {
  it('orders by descending occurrence with id tie-breaker deterministically', () => {
    const items = [
      { id: 'b', at: '2026-08-01T00:00:00.000Z' },
      { id: 'a', at: '2026-08-01T00:00:00.000Z' },
      { id: 'c', at: '2026-08-02T00:00:00.000Z' },
    ];
    const ordered = orderByOccurrence(items, (item) => item.at);
    expect(ordered.map((item) => item.id)).toEqual(['c', 'b', 'a']);
    expect(orderByOccurrence(items, (item) => item.at)).toEqual(ordered);
  });
});
