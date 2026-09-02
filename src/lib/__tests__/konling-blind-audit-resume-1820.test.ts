import { mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  aggregateKonlingBlindAuditRun,
  buildKonlingBlindAuditTaskKey,
  konlingBlindAuditManifestHash,
  KonlingBlindAuditManifestDriftError,
  KonlingBlindAuditRunLockError,
  listKonlingBlindAuditFailureKeys,
  listKonlingBlindAuditRecordKeys,
  prepareKonlingBlindAuditRun,
  readKonlingBlindAuditFailure,
  runKonlingBlindAudit,
  type KonlingBlindAuditErrorCode,
  type KonlingBlindAuditItem,
  type KonlingBlindAuditManifest,
  type KonlingBlindAuditProvider,
} from '@/lib/konling-blind-audit';

const MANIFEST: KonlingBlindAuditManifest = {
  benchmarkVersion: 'test-v1',
  modes: ['rule-score', 'blind-audit'],
  replicates: 2,
  items: [
    {
      itemId: 'item-a',
      intent: 'fact-explanation',
      question: '什么是超调量？',
      referenceAnswer: '峰值相对稳态的超出比例。',
    },
    {
      itemId: 'item-b',
      intent: 'formula-derivation',
      question: '请推导闭环传递函数。',
      referenceAnswer: 'G/(1+GH)。',
    },
  ],
};

const CONFIG = {
  mode: 'rule-score',
  model: 'test-model',
  provider: 'test-provider',
  promptVersion: 'prompt.v1',
  scoreVersion: 'rubric.v1',
  gitRevision: 'testrev',
} as const;

function okProvider(): KonlingBlindAuditProvider {
  return async (item: KonlingBlindAuditItem, replicate: number) => ({
    ok: true,
    result: { ruleScore: 0.9, itemId: item.itemId, replicate },
  });
}

function faultProvider(
  faults: Record<string, KonlingBlindAuditErrorCode>,
): KonlingBlindAuditProvider {
  return async (item, replicate) => {
    const taskKey = buildKonlingBlindAuditTaskKey({
      benchmarkVersion: MANIFEST.benchmarkVersion,
      mode: 'rule-score',
      itemId: item.itemId,
      replicate,
    });
    const code = faults[taskKey];
    if (code) return { ok: false, error: { code, message: `injected ${code}` } };
    return { ok: true, result: { ruleScore: 0.9 } };
  };
}

function trackingProvider(calls: string[], faults: Record<string, KonlingBlindAuditErrorCode> = {}) {
  return async (item: KonlingBlindAuditItem, replicate: number) => {
    const taskKey = buildKonlingBlindAuditTaskKey({
      benchmarkVersion: MANIFEST.benchmarkVersion,
      mode: 'rule-score',
      itemId: item.itemId,
      replicate,
    });
    calls.push(taskKey);
    const code = faults[taskKey];
    if (code) return { ok: false, error: { code, message: `injected ${code}` } };
    return { ok: true, result: { ruleScore: 0.9 } };
  };
}

function keyOf(itemId: string, replicate: number): string {
  return buildKonlingBlindAuditTaskKey({
    benchmarkVersion: MANIFEST.benchmarkVersion,
    mode: 'rule-score',
    itemId,
    replicate,
  });
}

let root: string;

beforeAll(() => {
  root = mkdtempSync(path.join(tmpdir(), 'konling-blind-audit-'));
});

afterAll(() => {
  rmSync(root, { recursive: true, force: true });
});

function runOptions(runId: string, provider: KonlingBlindAuditProvider, manifest = MANIFEST) {
  return {
    root,
    runId,
    manifest,
    manifestPayload: manifest,
    manifestHash: konlingBlindAuditManifestHash(manifest),
    mode: 'rule-score' as const,
    config: CONFIG,
    provider,
  };
}

describe('issue #1820 resumable blind-audit evaluation', () => {
  it('persists one atomic record per completed task with unique task keys and metadata', async () => {
    const runId = 'run-persist';
    const summary = await runKonlingBlindAudit(runOptions(runId, okProvider()));
    expect(summary).toMatchObject({ expected: 4, completedThisRun: 4, complete: true });
    const keys = listKonlingBlindAuditRecordKeys(path.join(root, 'artifacts', 'konling-blind-audit', runId), 'rule-score');
    expect(new Set(keys)).toEqual(new Set([keyOf('item-a', 1), keyOf('item-a', 2), keyOf('item-b', 1), keyOf('item-b', 2)]));
    const record = JSON.parse(readFileSync(
      path.join(root, 'artifacts', 'konling-blind-audit', runId, 'records', 'rule-score', `${keyOf('item-a', 1)}.json`),
      'utf8',
    ));
    expect(record).toMatchObject({
      status: 'completed',
      model: 'test-model',
      provider: 'test-provider',
      promptVersion: 'prompt.v1',
      scoreVersion: 'rubric.v1',
      gitRevision: 'testrev',
      benchmarkVersion: 'test-v1',
      itemId: 'item-a',
      replicate: 1,
    });
    expect(typeof record.startedAt).toBe('string');
    expect(typeof record.finishedAt).toBe('string');
  });

  it('resumes without re-billing completed tasks after an interruption', async () => {
    const runId = 'run-resume';
    const firstCalls: string[] = [];
    const failing = keyOf('item-b', 2);
    await runKonlingBlindAudit(runOptions(runId, trackingProvider(firstCalls, { [failing]: 'insufficient-balance' })));
    expect(firstCalls).toHaveLength(4);

    const secondCalls: string[] = [];
    const summary = await runKonlingBlindAudit(runOptions(runId, trackingProvider(secondCalls)));
    // 已完成任务不再提交外部服务：第二轮只调用了失败项。
    expect(secondCalls).toEqual([failing]);
    expect(summary).toMatchObject({
      completedBeforeRun: 3,
      completedThisRun: 1,
      retried: 1,
      totalCompleted: 4,
      complete: true,
    });
  });

  it('repeated full runs change nothing frozen', async () => {
    const runId = 'run-idempotent';
    await runKonlingBlindAudit(runOptions(runId, okProvider()));
    const runDir = path.join(root, 'artifacts', 'konling-blind-audit', runId);
    const frozen = listKonlingBlindAuditRecordKeys(runDir, 'rule-score').map((key) => readFileSync(
      path.join(runDir, 'records', 'rule-score', `${key}.json`),
      'utf8',
    ));
    const summary = await runKonlingBlindAudit(runOptions(runId, okProvider()));
    expect(summary).toMatchObject({ completedBeforeRun: 4, completedThisRun: 0, complete: true });
    const after = listKonlingBlindAuditRecordKeys(runDir, 'rule-score').map((key) => readFileSync(
      path.join(runDir, 'records', 'rule-score', `${key}.json`),
      'utf8',
    ));
    expect(after).toEqual(frozen);
  });

  it.each([
    ['rate-limited'],
    ['timeout'],
    ['insufficient-balance'],
    ['parse-failure'],
  ] as const)('records and recovers from %s failures while keeping attempt history', async (code) => {
    const runId = `run-fault-${code}`;
    const failing = keyOf('item-a', 1);
    const first = await runKonlingBlindAudit(runOptions(
      runId,
      faultProvider({ [failing]: code }),
    ));
    expect(first).toMatchObject({ completedThisRun: 3, failed: 1, complete: false });
    const runDir = path.join(root, 'artifacts', 'konling-blind-audit', runId);
    const failureAfterFirst = readKonlingBlindAuditFailure(runDir, 'rule-score', failing);
    expect(failureAfterFirst?.attempts).toHaveLength(1);
    expect(failureAfterFirst?.attempts[0].error.code).toBe(code);

    const second = await runKonlingBlindAudit(runOptions(runId, okProvider()));
    expect(second).toMatchObject({ retried: 1, totalCompleted: 4, complete: true });
    // 失败历史在重试成功后仍可审计。
    const failureAfterRetry = readKonlingBlindAuditFailure(runDir, 'rule-score', failing);
    expect(failureAfterRetry?.attempts).toHaveLength(1);
    expect(failureAfterRetry?.attempts[0].error.code).toBe(code);
  });

  it('aggregates incomplete batches as fail-closed without official metrics', async () => {
    const runId = 'run-incomplete';
    await runKonlingBlindAudit(runOptions(
      runId,
      faultProvider({ [keyOf('item-b', 1)]: 'rate-limited', [keyOf('item-b', 2)]: 'timeout' }),
    ));
    const aggregate = aggregateKonlingBlindAuditRun({ root, runId, manifest: MANIFEST, mode: 'rule-score' });
    expect(aggregate.status).toBe('incomplete');
    expect(aggregate.officialMetrics).toBeNull();
    expect(aggregate.incompleteDetail?.missingTaskKeys).toEqual([keyOf('item-b', 1), keyOf('item-b', 2)]);
  });

  it('emits official metrics only when the expected count is fully completed', async () => {
    const runId = 'run-complete';
    await runKonlingBlindAudit(runOptions(runId, okProvider()));
    const aggregate = aggregateKonlingBlindAuditRun({ root, runId, manifest: MANIFEST, mode: 'rule-score' });
    expect(aggregate.status).toBe('complete');
    expect(aggregate.officialMetrics).toEqual({ completedRatio: 1, meanRuleScore: 0.9 });
  });

  it('refuses aggregation for mixed-configuration runs', async () => {
    const runId = 'run-mixed';
    await runKonlingBlindAudit(runOptions(runId, okProvider()));
    const recordPath = path.join(
      root, 'artifacts', 'konling-blind-audit', runId, 'records', 'rule-score', `${keyOf('item-a', 1)}.json`,
    );
    const record = JSON.parse(readFileSync(recordPath, 'utf8'));
    // 模拟历史批次混入另一模型的记录。
    mkdirSync(path.dirname(recordPath), { recursive: true });
    writeFileSync(recordPath, JSON.stringify({ ...record, model: 'other-model' }), 'utf8');
    const aggregate = aggregateKonlingBlindAuditRun({ root, runId, manifest: MANIFEST, mode: 'rule-score' });
    expect(aggregate.status).toBe('mixed-configuration');
    expect(aggregate.officialMetrics).toBeNull();
  });

  it('fails closed on manifest drift when resuming', async () => {
    const runId = 'run-drift';
    await runKonlingBlindAudit(runOptions(runId, faultProvider({ [keyOf('item-a', 1)]: 'timeout' })));
    const drifted: KonlingBlindAuditManifest = {
      ...MANIFEST,
      items: [...MANIFEST.items, {
        itemId: 'item-c',
        intent: 'concept-comparison',
        question: '比较开环与闭环。',
        referenceAnswer: '有无反馈。',
      }],
    };
    await expect(runKonlingBlindAudit(runOptions(runId, okProvider(), drifted)))
      .rejects.toBeInstanceOf(KonlingBlindAuditManifestDriftError);
  });

  it('keeps rule-score and blind-audit records in separate subtrees', async () => {
    const runId = 'run-modes';
    await runKonlingBlindAudit({ ...runOptions(runId, okProvider()), mode: 'rule-score' });
    await runKonlingBlindAudit({ ...runOptions(runId, okProvider()), mode: 'blind-audit' });
    const runDir = path.join(root, 'artifacts', 'konling-blind-audit', runId);
    expect(listKonlingBlindAuditRecordKeys(runDir, 'rule-score')).toHaveLength(4);
    expect(listKonlingBlindAuditRecordKeys(runDir, 'blind-audit')).toHaveLength(4);
    const ruleAggregate = aggregateKonlingBlindAuditRun({ root, runId, manifest: MANIFEST, mode: 'rule-score' });
    const blindAggregate = aggregateKonlingBlindAuditRun({ root, runId, manifest: MANIFEST, mode: 'blind-audit' });
    expect(ruleAggregate.mode).toBe('rule-score');
    expect(blindAggregate.mode).toBe('blind-audit');
  });

  it('rejects concurrent runs on the same run directory and adopts stale locks', () => {
    const runId = 'run-lock';
    const runDir = path.join(root, 'artifacts', 'konling-blind-audit', runId);
    prepareKonlingBlindAuditRun({
      root,
      runId,
      manifestHash: konlingBlindAuditManifestHash(MANIFEST),
      manifestPayload: MANIFEST,
    });
    // 活锁：当前进程持有。
    expect(() => prepareKonlingBlindAuditRun({
      root,
      runId,
      manifestHash: konlingBlindAuditManifestHash(MANIFEST),
      manifestPayload: MANIFEST,
    })).toThrow(KonlingBlindAuditRunLockError);
    // stale 锁（持有者已不存在）允许接管。
    writeFileSync(path.join(runDir, 'run.lock'), '999999999\n', 'utf8');
    expect(() => prepareKonlingBlindAuditRun({
      root,
      runId,
      manifestHash: konlingBlindAuditManifestHash(MANIFEST),
      manifestPayload: MANIFEST,
    })).not.toThrow();
    // cleanup：删除本测试遗留的 failures 计数干扰由独立 runId 隔离。
  });
});
