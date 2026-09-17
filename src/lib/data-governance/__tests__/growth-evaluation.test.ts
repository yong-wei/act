import { describe, expect, it, vi } from 'vitest';

import {
  buildGrowthEvaluationPrompt,
  prepareGrowthEvaluationDescription,
  growthEvaluationInputDigest,
  preparedGrowthEvaluationMatches,
  refreshStudentGrowthEvaluation,
  resolveGrowthProviderPolicy,
  validateGrowthProviderPolicyBinding,
  deleteExpiredGrowthEvaluations,
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
      studentProfile: {
        findUnique: async () => ({ classId: 'class-1' }),
      },
      growthRecord: {
        findUnique: async () => existing,
        findFirst: async () => existing,
        create: async (args: unknown) => {
          calls.push({ method: 'create', args });
          return { id: 'created-record' };
        },
        update: async (args: unknown) => {
          calls.push({ method: 'update', args });
          return { id: 'updated-record' };
        },
        updateMany: async (args: unknown) => {
          calls.push({ method: 'updateMany', args });
          return { count: 1 };
        },
      },
    },
  };
}

describe('refreshStudentGrowthEvaluation', () => {
  it('deletes only expired current Growth evaluations by structured retention time', async () => {
    const deleteMany = vi.fn(async () => ({ count: 2 }));
    const now = new Date('2027-07-15T00:00:00Z');
    await expect(deleteExpiredGrowthEvaluations({ growthRecord: { deleteMany } } as any, now)).resolves.toBe(2);
    expect(deleteMany).toHaveBeenCalledWith({ where: { recordType: 'competency_evaluation', expiresAt: { lte: now } } });
  });
  it('uses the configured qualitative generator and creates a growth evaluation record', async () => {
    const { db, calls } = createDb();

    await refreshStudentGrowthEvaluation(db, {
      snapshot,
      generateQualitativeText: async (prompt) => {
        expect(prompt).not.toContain('王浩宇');
        expect(prompt).not.toContain('2023001');
        expect(prompt).toContain('学习者');
        expect(prompt).toContain('工程决策与约束');
        return '王浩宇（2023001）能够识别工程约束在任务表达中的底线作用，下一步需要把证据来源写得更明确。';
      },
    });

    expect(calls[0].method).toBe('create');
    expect(calls[0].args).toMatchObject({
      data: {
        userId: 'user-1',
        recordType: 'competency_evaluation',
        title: '阶段性能力画像评价',
        description: '该学习者能够识别工程约束在任务表达中的底线作用，下一步需要把证据来源写得更明确。',
        courseId: 'profile:growth-evaluation',
      },
    });
    const evidence = (calls[0].args as any).data.evidenceJson;
    expect(evidence).not.toHaveProperty('prompt');
    expect(JSON.stringify(evidence)).not.toContain('王浩宇');
    expect(JSON.stringify(evidence)).not.toContain('2023001');
    expect(evidence.summaryVersion).toBe('growth-evaluation-evidence.v1');
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
      method: 'updateMany',
      args: {
        where: { businessKey: 'competency-evaluation:user-1', sourceSnapshotAt: { lt: snapshot.snapshotAt } },
        data: { description: '新的个性化评价。' },
      },
    });
  });

  it('does not let an older worker overwrite a newer Growth evaluation after both read the old row', async () => {
    let stored = { id: 'record-1', businessKey: 'competency-evaluation:user-1', occurredAt: new Date('2026-05-06T04:00:00Z'), sourceSnapshotAt: new Date('2026-05-06T04:00:00Z'), evidenceJson: { snapshotAt: '2026-05-06T04:00:00Z' }, description: 'old' };
    let releaseOld!: () => void;
    const oldPrepared = new Promise<void>((resolve) => { releaseOld = resolve; });
    const db: any = {
      user: { findUnique: async () => ({ name: null, profile: null }) },
      studentProfile: { findUnique: async () => ({ classId: 'class-1' }) },
      growthRecord: {
        findUnique: async () => structuredClone(stored),
        updateMany: async ({ where, data }: any) => {
          if (stored.sourceSnapshotAt >= where.sourceSnapshotAt.lt) return { count: 0 };
          stored = { ...stored, ...structuredClone(data) };
          return { count: 1 };
        },
      },
    };
    const older = { ...snapshot, id: 'snapshot-older', snapshotAt: new Date('2026-05-06T05:00:00Z') };
    const oldWorker = refreshStudentGrowthEvaluation(db, { snapshot: older, generateQualitativeText: async () => { await oldPrepared; return 'older'; } });
    await Promise.resolve();
    await refreshStudentGrowthEvaluation(db, { snapshot, generateQualitativeText: async () => 'newer' });
    releaseOld();
    await oldWorker;
    expect(stored.description).toBe('newer');
    expect(stored.occurredAt).toEqual(snapshot.snapshotAt);
  });

  it('fences two concurrent first writers when both initially find no Growth row', async () => {
    let stored: any = null;
    let reads = 0;
    let releaseReads!: () => void;
    const bothRead = new Promise<void>((resolve) => { releaseReads = resolve; });
    const db: any = {
      user: { findUnique: async () => ({ name: null, profile: null }) },
      studentProfile: { findUnique: async () => ({ classId: 'class-1' }) },
      growthRecord: {
        findUnique: async () => { reads += 1; if (reads === 2) releaseReads(); await bothRead; return null; },
        create: async ({ data }: any) => {
          if (stored) throw Object.assign(new Error('unique'), { code: 'P2002' });
          stored = { id: 'growth-current', ...structuredClone(data) };
          return stored;
        },
        updateMany: async ({ where, data }: any) => {
          if (!stored || stored.businessKey !== where.businessKey || stored.sourceSnapshotAt >= where.sourceSnapshotAt.lt) return { count: 0 };
          stored = { ...stored, ...structuredClone(data) };
          return { count: 1 };
        },
      },
    };
    const older = { ...snapshot, id: 'snapshot-old', snapshotAt: new Date('2026-05-06T05:00:00Z') };
    await Promise.all([
      refreshStudentGrowthEvaluation(db, { snapshot, generateQualitativeText: async () => 'newest' }),
      refreshStudentGrowthEvaluation(db, { snapshot: older, generateQualitativeText: async () => 'older' }),
    ]);
    expect(stored.description).toBe('newest');
    expect(stored.sourceSnapshotAt).toEqual(snapshot.snapshotAt);
    expect(stored.businessKey).toBe('competency-evaluation:user-1');
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
    expect(prompt).toContain('4-1 后测：任务表达出口判断');
  });

  it('keeps growth evaluation prompt free of internal evidence identities', () => {
    const prompt = buildGrowthEvaluationPrompt({
      studentName: '杨帆',
      snapshot: {
        ...snapshot,
        evidenceSummary: {
          engineeringDecision: [{
            evidenceTitle: 'yangfan-diagnostic-fixture',
            factType: 'control_correction_path.selection_recorded',
            outcome: 'success',
            score: 100,
          }],
        },
      },
    });

    expect(prompt).toContain('路径方案选择记录');
    expect(prompt).not.toMatch(/yangfan-diagnostic-fixture|control_correction_path|ctc:/u);
  });

  it('prepares slow qualitative model output without persisting a growth record', async () => {
    const { db, calls } = createDb();
    const prepared = await prepareGrowthEvaluationDescription(db, {
      snapshot,
      generateQualitativeText: async () => '已在事务外生成。',
    });
    expect(prepared).toEqual(expect.objectContaining({ description: '已在事务外生成。', source: 'generated', inputDigest: expect.any(String), templateVersion: expect.any(String), modelVersion: expect.any(String) }));
    expect(calls).toHaveLength(0);
  });

  it('invalidates prepared output when concurrent facts change the materialization input', async () => {
    const { db } = createDb();
    const prepared = await prepareGrowthEvaluationDescription(db, { snapshot, generateQualitativeText: async () => '旧输入评价。' });
    const concurrentSnapshot = { ...snapshot, factCount: snapshot.factCount + 1 };
    expect(prepared?.inputDigest).not.toBe(growthEvaluationInputDigest(concurrentSnapshot));
    expect(preparedGrowthEvaluationMatches(prepared, concurrentSnapshot)).toBe(false);
  });

  it('eventually persists Growth when a concurrent mismatch is retried against the unchanged current snapshot', async () => {
    const { db, calls } = createDb();
    const preparedA = await prepareGrowthEvaluationDescription(db, { snapshot, generateQualitativeText: async () => '事实A评价。' });
    const snapshotB = { ...snapshot, id: 'snapshot-b', factCount: 13, factInputDigest: 'facts-b' };
    expect(preparedGrowthEvaluationMatches(preparedA, snapshotB)).toBe(false);
    expect(calls).toHaveLength(0);
    const preparedB = await prepareGrowthEvaluationDescription(db, { snapshot: snapshotB, generateQualitativeText: async () => '事实B评价。' });
    await refreshStudentGrowthEvaluation(db, { snapshot: snapshotB, preparedDescription: preparedB! });
    expect(calls).toHaveLength(1);
    expect((calls[0].args as any).data.description).toBe('事实B评价。');
  });

  it('includes the complete evidence summary in the growth input digest', () => {
    expect(growthEvaluationInputDigest(snapshot)).not.toBe(growthEvaluationInputDigest({ ...snapshot, evidenceSummary: { engineeringDecision: [] } }));
  });

  it('allows only an enabled growth-evaluation provider policy and fails closed after revocation', async () => {
    const policy = { id: 'growth-policy-1', provider: 'openai', model: 'gpt-growth', endpoint: 'https://api.example/v1', credentialRef: 'env:GROWTH_KEY', processingRegion: 'cn', purpose: 'growth-evaluation', dataCategories: ['competency-profile', 'learning-evidence-summary'], minimizedScope: ['competency-vector', 'evidence-summary'], institutionScope: 'act', classScope: [], agreementVersion: 'dpa-v1', noTraining: true, providerRetentionSeconds: 0, deletionCapability: true, version: 'v1', enabled: true, disabledAt: null };
    const delegate = { findFirst: vi.fn().mockResolvedValueOnce(policy).mockResolvedValueOnce(null) };
    await expect(resolveGrowthProviderPolicy({ gradingProviderPolicy: delegate } as any)).resolves.toEqual(policy);
    await expect(resolveGrowthProviderPolicy({ gradingProviderPolicy: delegate } as any)).resolves.toBeNull();
  });

  it('rejects a policy whose scope does not cover the target student class', async () => {
    const policy = { id: 'growth-policy-1', provider: 'openai', model: 'gpt-growth', endpoint: 'https://api.example/v1', credentialRef: 'env:GROWTH_KEY', processingRegion: 'cn', purpose: 'growth-evaluation', dataCategories: ['competency-profile', 'learning-evidence-summary'], minimizedScope: ['competency-vector', 'evidence-summary'], institutionScope: null, classScope: ['class-2'], agreementVersion: 'dpa-v1', noTraining: true, providerRetentionSeconds: 0, deletionCapability: true, version: 'v1', enabled: true, disabledAt: null };
    const { db } = createDb();
    (db as any).gradingProviderPolicy = { findFirst: vi.fn(async () => policy) };
    const prepared = await prepareGrowthEvaluationDescription(db as any, { snapshot });
    expect(prepared).toEqual(expect.objectContaining({ source: 'fallback' }));
    expect(prepared?.policySnapshot).toBeUndefined();
  });

  it('fails closed before provider invocation for positive retention without a guaranteed deletion locator', async () => {
    const policy = { id: 'growth-policy-retained', provider: 'openai', model: 'gpt-growth', endpoint: 'https://api.example/v1', credentialRef: 'env:GROWTH_KEY', processingRegion: 'cn', purpose: 'growth-evaluation', dataCategories: ['competency-profile', 'learning-evidence-summary'], minimizedScope: ['competency-vector', 'evidence-summary'], institutionScope: null, classScope: ['class-1'], agreementVersion: 'dpa-v1', noTraining: true, providerRetentionSeconds: 3600, deletionCapability: true, version: 'v1', enabled: true, disabledAt: null };
    const { db } = createDb();
    (db as any).gradingProviderPolicy = { findFirst: vi.fn(async () => policy) };
    const prepared = await prepareGrowthEvaluationDescription(db as any, { snapshot });
    expect(prepared).toEqual(expect.objectContaining({ source: 'fallback' }));
    expect(prepared?.policySnapshot).toBeUndefined();
  });

  it('persists the complete governed policy snapshot and stable hash', async () => {
    const { db, calls } = createDb();
    const prepared = await prepareGrowthEvaluationDescription(db, { snapshot, generateQualitativeText: async () => '受治理的评价。' });
    await refreshStudentGrowthEvaluation(db, { snapshot, preparedDescription: prepared! });
    const evidence = (calls[0].args as any).data.evidenceJson;
    expect(evidence).toMatchObject({ policySnapshot: null, policyHash: null, providerRequestId: null, deletionHandle: null });
  });

  it.each([
    ['provider', { provider: 'other', model: 'gpt-growth', endpoint: 'https://api.example/v1', credentialRef: 'env:GROWTH_KEY' }],
    ['model', { provider: 'openai', model: 'other-model', endpoint: 'https://api.example/v1', credentialRef: 'env:GROWTH_KEY' }],
    ['credential', { provider: 'openai', model: 'gpt-growth', endpoint: 'https://api.example/v1', credentialRef: 'env:OTHER_KEY' }],
  ])('rejects a Growth runtime %s that differs from persisted policy', (_kind, binding) => {
    const policy = { id: 'growth-policy-1', provider: 'openai', model: 'gpt-growth', endpoint: 'https://api.example/v1', credentialRef: 'env:GROWTH_KEY', processingRegion: 'cn', purpose: 'growth-evaluation', dataCategories: ['competency-profile', 'learning-evidence-summary'], minimizedScope: ['competency-vector', 'evidence-summary'], institutionScope: 'act', classScope: [], agreementVersion: 'dpa-v1', noTraining: true, providerRetentionSeconds: 0, deletionCapability: true, version: 'v1', enabled: true, disabledAt: null };
    expect(validateGrowthProviderPolicyBinding(policy as any, binding as any)).toBe(false);
  });

  it('normalizes endpoint host and default port without lowercasing a case-sensitive path', () => {
    const policy = { provider: 'openai', model: 'gpt-growth', endpoint: 'https://API.EXAMPLE:443/Growth/V1/', credentialRef: 'env:GROWTH_KEY' };
    expect(validateGrowthProviderPolicyBinding(policy as any, { ...policy, endpoint: 'https://api.example/Growth/V1' })).toBe(true);
    expect(validateGrowthProviderPolicyBinding(policy as any, { ...policy, endpoint: 'https://api.example/growth/v1' })).toBe(false);
  });

  it.each([
    ['data categories', { dataCategories: ['competency-profile'] }],
    ['minimized scope', { minimizedScope: ['competency-vector'] }],
    ['tenant scope', { institutionScope: null, classScope: [] }],
    ['agreement', { agreementVersion: '' }],
    ['credential', { credentialRef: '' }],
    ['transport', { endpoint: 'http://api.example/v1' }],
  ])('fails closed when the Growth policy has invalid %s', async (_kind, override) => {
    const policy = { id: 'growth-policy-1', provider: 'openai', model: 'gpt-growth', endpoint: 'https://api.example/v1', credentialRef: 'env:GROWTH_KEY', processingRegion: 'cn', purpose: 'growth-evaluation', dataCategories: ['competency-profile', 'learning-evidence-summary'], minimizedScope: ['competency-vector', 'evidence-summary'], institutionScope: 'act', classScope: [], agreementVersion: 'dpa-v1', noTraining: true, providerRetentionSeconds: 0, deletionCapability: true, version: 'v1', enabled: true, disabledAt: null, ...override };
    const delegate = { findFirst: vi.fn().mockResolvedValue(policy) };
    await expect(resolveGrowthProviderPolicy({ gradingProviderPolicy: delegate } as any)).resolves.toBeNull();
  });

  it('records fallback provenance when qualitative generation fails', async () => {
    const errorLog = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { db } = createDb();
    const prepared = await prepareGrowthEvaluationDescription(db, {
      snapshot,
      generateQualitativeText: async () => { throw new Error('timeout'); },
    });
    expect(prepared).toEqual(expect.objectContaining({ source: 'fallback' }));
    errorLog.mockRestore();
  });

  it('fails closed without an explicit external-processing policy', async () => {
    const { db } = createDb();
    const prepared = await prepareGrowthEvaluationDescription(db, { snapshot });
    expect(prepared).toEqual(expect.objectContaining({ source: 'fallback' }));
  });
});
