import { describe, expect, it } from 'vitest';

import {
  buildGrowthEvaluationPrompt,
  refreshStudentGrowthEvaluation,
} from '../growth-evaluation';

const snapshot = {
  id: 'snapshot-1',
  userId: 'user-1',
  snapshotAt: new Date('2026-05-06T05:15:00Z'),
  factCount: 12,
  competencyVector: {
    controlModeling: { score: 42, trend: 'stable', confidence: 0.5, evidenceCount: 8, lastUpdated: '' },
    parameterDesign: { score: 55, trend: 'up', confidence: 0.6, evidenceCount: 4, lastUpdated: '' },
    crossDomainTransfer: { score: 48, trend: 'stable', confidence: 0.5, evidenceCount: 4, lastUpdated: '' },
    engineeringDecision: { score: 66, trend: 'up', confidence: 0.7, evidenceCount: 6, lastUpdated: '' },
    inquiryReflection: { score: 0, trend: 'stable', confidence: 0, evidenceCount: 0, lastUpdated: '' },
    selfDirectedLearning: { score: 36, trend: 'stable', confidence: 0.4, evidenceCount: 8, lastUpdated: '' },
  },
  evidenceSummary: {
    engineeringDecision: [{ evidenceTitle: '4-1 后测：任务表达出口判断', outcome: 'success', score: 100 }],
  },
};

function createDb(existing: { id: string; evidenceJson: unknown } | null = null) {
  const calls: Array<{ method: string; args: unknown }> = [];
  return {
    calls,
    db: {
      user: {
        findUnique: async () => ({ name: '王浩宇', profile: { studentNumber: '2023001' } }),
      },
      growthRecord: {
        findFirst: async () => existing,
        create: async (args: unknown) => {
          calls.push({ method: 'create', args });
          return { id: 'created-record' };
        },
        update: async (args: unknown) => {
          calls.push({ method: 'update', args });
          return { id: 'updated-record' };
        },
      },
    },
  };
}

describe('refreshStudentGrowthEvaluation', () => {
  it('uses the configured qualitative generator and creates a growth evaluation record', async () => {
    const { db, calls } = createDb();

    await refreshStudentGrowthEvaluation(db, {
      snapshot,
      generateQualitativeText: async (prompt) => {
        expect(prompt).toContain('王浩宇');
        expect(prompt).toContain('工程决策与约束');
        return '王浩宇能够识别工程约束在任务表达中的底线作用，下一步需要把证据来源写得更明确。';
      },
    });

    expect(calls[0].method).toBe('create');
    expect(calls[0].args).toMatchObject({
      data: {
        userId: 'user-1',
        recordType: 'competency_evaluation',
        title: '阶段性能力画像评价',
        description: '王浩宇能够识别工程约束在任务表达中的底线作用，下一步需要把证据来源写得更明确。',
        courseId: 'profile:growth-evaluation',
      },
    });
  });

  it('updates the existing evaluation when a newer snapshot arrives', async () => {
    const { db, calls } = createDb({
      id: 'record-1',
      evidenceJson: { snapshotAt: '2026-05-06T04:15:00.000Z' },
    });

    await refreshStudentGrowthEvaluation(db, {
      snapshot,
      generateQualitativeText: async () => '新的个性化评价。',
    });

    expect(calls[0]).toMatchObject({
      method: 'update',
      args: {
        where: { id: 'record-1' },
        data: { description: '新的个性化评价。' },
      },
    });
  });

  it('skips generation when the stored evaluation already matches a newer snapshot', async () => {
    const { db, calls } = createDb({
      id: 'record-1',
      evidenceJson: { snapshotAt: '2026-05-06T05:30:00.000Z' },
    });
    let generated = false;

    const result = await refreshStudentGrowthEvaluation(db, {
      snapshot,
      generateQualitativeText: async () => {
        generated = true;
        return '不应生成。';
      },
    });

    expect(result).toMatchObject({ action: 'skipped', description: null });
    expect(generated).toBe(false);
    expect(calls).toHaveLength(0);
  });

  it('does not generate an evaluation when the snapshot has no facts', async () => {
    const { db, calls } = createDb();
    let generated = false;

    const result = await refreshStudentGrowthEvaluation(db, {
      snapshot: { ...snapshot, factCount: 0 },
      generateQualitativeText: async () => {
        generated = true;
        return '不应生成。';
      },
    });

    expect(result).toMatchObject({ action: 'skipped_no_evidence', description: null });
    expect(generated).toBe(false);
    expect(calls).toHaveLength(0);
  });

  it('marks uncovered dimensions as not assessed rather than weak', () => {
    const prompt = buildGrowthEvaluationPrompt({
      studentName: '王浩宇',
      snapshot,
    });

    expect(prompt).toContain('未覆盖维度：探究反思与提示词');
    expect(prompt).toContain('不能写成能力薄弱');
    expect(prompt).toContain('改进方向只能来自已有证据维度');
  });
});
