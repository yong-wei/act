import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ runtime: vi.fn(), generateText: vi.fn() }));
vi.mock('@/lib/ai/provider-runtime', () => ({ getConfiguredAIProviderRuntime: mocks.runtime }));
vi.mock('ai', () => ({ generateText: mocks.generateText }));

import { prepareGrowthEvaluationDescription, refreshStudentGrowthEvaluation } from '../growth-evaluation';

const policy = { id: 'growth-policy-1', provider: 'openai', model: 'growth-model', endpoint: 'https://api.example/v1', credentialRef: 'env:GROWTH_KEY', processingRegion: 'CN', purpose: 'growth-evaluation', dataCategories: ['competency-profile', 'learning-evidence-summary'], minimizedScope: ['competency-vector', 'evidence-summary'], institutionScope: null, classScope: ['class-1'], agreementVersion: 'dpa-v1', noTraining: true, providerRetentionSeconds: 0, deletionCapability: true, version: 'v1', enabled: true, disabledAt: null };
const snapshot = { id: 'snapshot-1', userId: 'student-1', snapshotAt: new Date('2026-07-15T00:00:00Z'), factCount: 1, factInputDigest: 'facts-1', competencyVector: { controlModeling: { score: 80, evidenceCount: 1 } }, evidenceSummary: { controlModeling: [{ factType: 'assessment', outcome: 'success', score: 80 }] } };

function db() {
  const creates: any[] = [];
  return { creates, value: {
    user: { findUnique: async () => ({ name: null, profile: { studentNumber: null } }) },
    studentProfile: { findUnique: async () => ({ classId: 'class-1' }) },
    gradingProviderPolicy: { findFirst: async () => policy },
    growthRecord: { findUnique: async () => null, findFirst: async () => null, create: async ({ data }: any) => { creates.push(data); return data; }, updateMany: async () => ({ count: 0 }) },
  } };
}

describe('Growth governed provider runtime', () => {
  beforeEach(() => vi.clearAllMocks());
  it('uses one frozen runtime binding and persists the complete policy snapshot/hash and real request locator', async () => {
    mocks.runtime.mockResolvedValue({ binding: { provider: 'openai', model: 'growth-model', endpoint: 'https://api.example/v1', credentialRef: 'env:GROWTH_KEY' }, configured: true, model: { id: 'frozen-model-instance' } });
    mocks.generateText.mockResolvedValue({ text: '受治理的成长评价。', response: { id: 'provider-request-1' } });
    const store = db();
    const prepared = await prepareGrowthEvaluationDescription(store.value as any, { snapshot });
    await refreshStudentGrowthEvaluation(store.value as any, { snapshot, preparedDescription: prepared! });
    expect(mocks.runtime).toHaveBeenCalledTimes(1);
    expect(mocks.generateText).toHaveBeenCalledWith(expect.objectContaining({ model: { id: 'frozen-model-instance' } }));
    expect(store.creates[0].evidenceJson).toMatchObject({
      policySnapshot: expect.objectContaining({ purpose: 'growth-evaluation', dataCategories: policy.dataCategories, minimizedScope: policy.minimizedScope, classScope: ['class-1'], agreementVersion: 'dpa-v1', noTraining: true, endpoint: policy.endpoint, credentialRef: policy.credentialRef }),
      policyHash: expect.stringMatching(/^[a-f0-9]{64}$/), providerRequestId: 'provider-request-1', deletionHandle: null,
    });
  });

  it('does not invoke the provider when the frozen runtime binding differs from policy', async () => {
    mocks.runtime.mockResolvedValue({ binding: { provider: 'openai', model: 'other-model', endpoint: 'https://api.example/v1', credentialRef: 'env:GROWTH_KEY' }, configured: true, model: {} });
    const store = db();
    const prepared = await prepareGrowthEvaluationDescription(store.value as any, { snapshot });
    expect(prepared).toEqual(expect.objectContaining({ source: 'fallback' }));
    expect(mocks.generateText).not.toHaveBeenCalled();
  });
});
