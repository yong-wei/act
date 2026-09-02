import fs from 'node:fs';
import path from 'node:path';

import { konlingBlindAuditManifestHash } from './benchmark';
import {
  KonlingBlindAuditManifestDriftError,
  loadKonlingBlindAuditFailures,
  loadKonlingBlindAuditRecords,
} from './store';
import {
  buildKonlingBlindAuditTaskKey,
  type KonlingBlindAuditAggregate,
  type KonlingBlindAuditManifest,
  type KonlingBlindAuditMode,
} from './types';

/**
 * 完整性门禁汇总：completed < expected 一律 incomplete 且不产出正式
 * 指标；聚合前核对快照哈希与记录键集，混配置（含代码修订）拒绝汇总；
 * rule-score 与 blind-audit 永远分开（#1820）。
 */
export function aggregateKonlingBlindAuditRun(input: {
  root: string;
  runId: string;
  manifest: KonlingBlindAuditManifest;
  mode: KonlingBlindAuditMode;
}): KonlingBlindAuditAggregate {
  const runDir = path.join(input.root, 'artifacts', 'konling-blind-audit', input.runId);
  const expected = input.manifest.items.length * input.manifest.replicates;
  const records = loadKonlingBlindAuditRecords(runDir, input.mode);
  const failures = loadKonlingBlindAuditFailures(runDir, input.mode);

  const snapshotPath = path.join(runDir, 'manifest.snapshot.json');
  if (!fs.existsSync(snapshotPath)) {
    return {
      runId: input.runId,
      mode: input.mode,
      benchmarkVersion: input.manifest.benchmarkVersion,
      status: 'manifest-missing',
      expected,
      completed: records.length,
      failed: failures.length,
      officialMetrics: null,
      configuration: null,
    };
  }
  // 聚合所依据的清单必须与运行快照完全一致，防止用等长异内容清单
  // 把不属于本批次的记录凑成 complete。
  const snapshot = JSON.parse(fs.readFileSync(snapshotPath, 'utf8')) as { manifestHash?: string };
  if (snapshot.manifestHash !== konlingBlindAuditManifestHash(input.manifest)) {
    throw new KonlingBlindAuditManifestDriftError(runDir);
  }

  const expectedTaskKeys: string[] = [];
  for (let replicate = 1; replicate <= input.manifest.replicates; replicate += 1) {
    for (const item of input.manifest.items) {
      expectedTaskKeys.push(buildKonlingBlindAuditTaskKey({
        benchmarkVersion: input.manifest.benchmarkVersion,
        mode: input.mode,
        itemId: item.itemId,
        replicate,
      }));
    }
  }
  const completedKeys = records.map((record) => record.taskKey);
  const completedKeySet = new Set(completedKeys);
  const missingTaskKeys = expectedTaskKeys.filter((taskKey) => !completedKeySet.has(taskKey));
  const unexpectedKeys = completedKeys.filter(
    (taskKey) => !expectedTaskKeys.includes(taskKey),
  );

  const base: KonlingBlindAuditAggregate = {
    runId: input.runId,
    mode: input.mode,
    benchmarkVersion: input.manifest.benchmarkVersion,
    status: 'incomplete',
    expected,
    completed: records.length,
    failed: failures.length,
    officialMetrics: null,
    configuration: null,
  };

  const configuration = deriveConfiguration(records);
  if (configuration === 'mixed') {
    return { ...base, status: 'mixed-configuration' };
  }

  if (missingTaskKeys.length > 0 || unexpectedKeys.length > 0) {
    return {
      ...base,
      configuration,
      status: 'incomplete',
      incompleteDetail: {
        missingTaskKeys,
        ...(unexpectedKeys.length > 0 ? { unexpectedKeys } : {}),
      },
    };
  }

  const ruleScores = records
    .map((record) => (record.result as { ruleScore?: unknown } | null | undefined)?.ruleScore)
    .filter((score): score is number => typeof score === 'number' && Number.isFinite(score));
  return {
    ...base,
    status: 'complete',
    configuration,
    officialMetrics: {
      completedRatio: records.length / expected,
      ...(input.mode === 'rule-score' && ruleScores.length === records.length
        ? { meanRuleScore: ruleScores.reduce((sum, score) => sum + score, 0) / ruleScores.length }
        : {}),
    },
  };
}

function deriveConfiguration(
  records: ReturnType<typeof loadKonlingBlindAuditRecords>,
): KonlingBlindAuditAggregate['configuration'] | 'mixed' {
  if (records.length === 0) return null;
  const first = records[0];
  // gitRevision 一并纳入：同一实验汇总不得静默混合不同代码实现。
  const consistent = records.every((record) => record.model === first.model
    && record.provider === first.provider
    && record.promptVersion === first.promptVersion
    && record.scoreVersion === first.scoreVersion
    && record.gitRevision === first.gitRevision);
  if (!consistent) return 'mixed';
  return {
    model: first.model,
    provider: first.provider,
    promptVersion: first.promptVersion,
    scoreVersion: first.scoreVersion,
  };
}

export function writeKonlingBlindAuditAggregate(
  root: string,
  aggregate: KonlingBlindAuditAggregate,
): string {
  const runDir = path.join(root, 'artifacts', 'konling-blind-audit', aggregate.runId);
  const target = path.join(runDir, 'summary', `${aggregate.mode}.summary.json`);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, JSON.stringify(aggregate, null, 2), 'utf8');
  return target;
}
