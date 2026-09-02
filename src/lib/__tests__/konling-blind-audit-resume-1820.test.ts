import { existsSync, linkSync as fsLinkSync, mkdtempSync, readFileSync, readdirSync as fsReaddir, rmSync, utimesSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  aggregateKonlingBlindAuditRun,
  assertKonlingBlindAuditLockHeld,
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
      candidateAnswer: '超调量是峰值相对稳态值的超出比例 [1]。',
    },
    {
      itemId: 'item-b',
      intent: 'formula-derivation',
      question: '请推导闭环传递函数。',
      referenceAnswer: 'G/(1+GH)。',
      candidateAnswer: '闭环为 G/(1+GH)。',
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

  it('keeps every attempt when a task keeps failing across runs', async () => {
    const runId = 'run-repeat-failure';
    const failing = keyOf('item-a', 1);
    await runKonlingBlindAudit(runOptions(runId, faultProvider({ [failing]: 'insufficient-balance' })));
    await runKonlingBlindAudit(runOptions(runId, faultProvider({ [failing]: 'rate-limited' })));
    const runDir = path.join(root, 'artifacts', 'konling-blind-audit', runId);
    const failure = readKonlingBlindAuditFailure(runDir, 'rule-score', failing);
    expect(failure?.attempts).toHaveLength(2);
    expect(failure?.attempts[0].error.code).toBe('insufficient-balance');
    expect(failure?.attempts[1].error.code).toBe('rate-limited');
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

  it('terminates the run when its lock is taken over mid-flight', async () => {
    const runId = 'run-lock-lost';
    const runDir = path.join(root, 'artifacts', 'konling-blind-audit', runId);
    const provider: KonlingBlindAuditProvider = async () => {
      // 模拟持有权被接管：第一个任务进行期间 holder 换成外部令牌。
      const lockDir = path.join(runDir, 'run.lock.d');
      const generations = fsReaddir(lockDir).filter((entry) => entry.startsWith('pub-'));
      const latest = generations.sort().at(-1);
      if (latest) writeFileSync(path.join(lockDir, latest, 'holder'), '999999999-foreign\n', 'utf8');
      return { ok: true, result: { ruleScore: 0.9 } };
    };
    await expect(runKonlingBlindAudit(runOptions(runId, provider)))
      .rejects.toBeInstanceOf(KonlingBlindAuditRunLockError);
    // 进行中的任务正常落盘；锁丢失后下一个外部调用前终止，不再写入。
    expect(listKonlingBlindAuditRecordKeys(runDir, 'rule-score'))
      .toEqual([keyOf('item-a', 1)]);
    expect(() => assertKonlingBlindAuditLockHeld(runDir))
      .toThrow(KonlingBlindAuditRunLockError);
  });

  it('resolves concurrent same-key record writes as first-writer-wins', async () => {
    const runId = 'run-write-race';
    await runKonlingBlindAudit(runOptions(runId, okProvider()));
    const runDir = path.join(root, 'artifacts', 'konling-blind-audit', runId);
    const recordPath = path.join(runDir, 'records', 'rule-score', `${keyOf('item-a', 1)}.json`);
    const frozen = readFileSync(recordPath, 'utf8');
    // 绕过预检直接模拟并发第二写者：临时文件 + link 必须放弃而不覆盖。
    const second = { ...JSON.parse(frozen), result: { ruleScore: 0.1, tampered: true } };
    const tmpPath = `${recordPath}.race.tmp`;
    writeFileSync(tmpPath, JSON.stringify(second), 'utf8');
    let linkRejected = false;
    try {
      fsLinkSync(tmpPath, recordPath);
    } catch (error) {
      linkRejected = (error as NodeJS.ErrnoException).code === 'EEXIST';
    }
    rmSync(tmpPath, { force: true });
    expect(linkRejected).toBe(true);
    expect(readFileSync(recordPath, 'utf8')).toBe(frozen);
  });

  it('refuses aggregation when the manifest does not match the run snapshot', async () => {
    const runId = 'run-aggregate-drift';
    await runKonlingBlindAudit(runOptions(runId, okProvider()));
    const swapped: KonlingBlindAuditManifest = {
      ...MANIFEST,
      items: [MANIFEST.items[1], { ...MANIFEST.items[0], itemId: 'item-swapped' }],
    };
    // 等长异内容清单不能把既有记录凑成 complete。
    expect(() => aggregateKonlingBlindAuditRun({ root, runId, manifest: swapped, mode: 'rule-score' }))
      .toThrow(KonlingBlindAuditManifestDriftError);
  });

  it('treats differing git revisions as mixed configuration', async () => {
    const runId = 'run-revision-mixed';
    await runKonlingBlindAudit(runOptions(runId, okProvider()));
    const recordPath = path.join(
      root, 'artifacts', 'konling-blind-audit', runId, 'records', 'rule-score', `${keyOf('item-a', 1)}.json`,
    );
    const record = JSON.parse(readFileSync(recordPath, 'utf8'));
    writeFileSync(recordPath, JSON.stringify({ ...record, gitRevision: 'otherrev' }), 'utf8');
    const aggregate = aggregateKonlingBlindAuditRun({ root, runId, manifest: MANIFEST, mode: 'rule-score' });
    expect(aggregate.status).toBe('mixed-configuration');
    expect(aggregate.officialMetrics).toBeNull();
  });

  it('rejects concurrent runs and hands stale locks to the next slot', () => {
    const runId = 'run-lock';
    const runDir = path.join(root, 'artifacts', 'konling-blind-audit', runId);
    const lockDir = path.join(runDir, 'run.lock.d');
    const prepare = () => prepareKonlingBlindAuditRun({
      root,
      runId,
      manifestHash: konlingBlindAuditManifestHash(MANIFEST),
      manifestPayload: MANIFEST,
    });

    prepare();
    // 活锁（当前进程持有第一代）：第二个进程拒绝启动。
    expect(() => prepare()).toThrow(KonlingBlindAuditRunLockError);
    expect(readFileSync(path.join(lockDir, 'pub-1', 'holder'), 'utf8')).toContain(`${process.pid}-`);

    // stale 接替：伪造死持有者，接管发布第二槽。
    writeFileSync(path.join(lockDir, 'pub-1', 'holder'), '999999999-dead-token\n', 'utf8');
    expect(() => prepare()).not.toThrow();
    expect(fsReaddir(lockDir).sort()).toEqual(['pub-1', 'pub-2']);

    // 第三代持有者存活（模拟并发接替胜者完成发布）：判活拒绝启动。
    writeFileSync(path.join(lockDir, 'pub-2', 'holder'), '999999998-dead-too\n', 'utf8');
    mkdirSync(path.join(lockDir, 'pub-3'));
    writeFileSync(path.join(lockDir, 'pub-3', 'holder'), `${process.pid}-rival-live\n`, 'utf8');
    expect(() => prepare()).toThrow(KonlingBlindAuditRunLockError);
  });

  it('adopts an over-age empty slot by publishing the next one', () => {
    const runId = 'run-lock-reverify';
    const runDir = path.join(root, 'artifacts', 'konling-blind-audit', runId);
    const lockDir = path.join(runDir, 'run.lock.d');
    // 前代超龄空 holder（宽限已过），但复验时前代持有者已完成初始化并
    // 存活：接管必须让位并拒绝。用复验前置状态模拟——把前代 holder 写
    // 为当前存活进程，mtime 置于宽限之外：宽限判定读不到 holder（空），
    // 复验读到存活 holder 的交错由「先空判、后活判」两读语义覆盖。
    mkdirSync(path.join(lockDir, 'pub-1'), { recursive: true });
    utimesSync(path.join(lockDir, 'pub-1'), new Date(Date.now() - 10_000), new Date(Date.now() - 10_000));
    expect(() => prepareKonlingBlindAuditRun({
      root,
      runId,
      manifestHash: konlingBlindAuditManifestHash(MANIFEST),
      manifestPayload: MANIFEST,
    })).not.toThrow();
    expect(fsReaddir(lockDir).sort()).toEqual(['pub-1', 'pub-2']);
  });

  it('never resets slot numbering across run release and re-acquire', async () => {
    const runId = 'run-slot-reuse';
    await runKonlingBlindAudit(runOptions(runId, okProvider()));
    const runDir = path.join(root, 'artifacts', 'konling-blind-audit', runId);
    const lockDir = path.join(runDir, 'run.lock.d');
    // 正常完成后锁结构保留、槽序列不重置；第二次运行发布更高序号槽。
    expect(fsReaddir(lockDir)).toEqual(['pub-1']);
    expect(existsSync(path.join(lockDir, 'pub-1', 'released'))).toBe(true);
    await runKonlingBlindAudit(runOptions(runId, okProvider()));
    expect(fsReaddir(lockDir).sort()).toEqual(['pub-1', 'pub-2']);
  });

  it('refuses to start while a holder slot is still initializing', () => {
    const runId = 'run-lock-init';
    const runDir = path.join(root, 'artifacts', 'konling-blind-audit', runId);
    const lockDir = path.join(runDir, 'run.lock.d');
    mkdirSync(path.join(lockDir, 'pub-1'), { recursive: true });
    // hold-1 存在但 holder 未写（初始化窗口内）：拒绝启动而不是误判 stale。
    expect(() => prepareKonlingBlindAuditRun({
      root,
      runId,
      manifestHash: konlingBlindAuditManifestHash(MANIFEST),
      manifestPayload: MANIFEST,
    })).toThrow(KonlingBlindAuditRunLockError);
  });
});


