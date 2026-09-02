import fs from 'node:fs';
import path from 'node:path';

import {
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
 * 指标；混配置批次拒绝汇总；rule-score 与 blind-audit 永远分开（#1820）。
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

  if (!fs.existsSync(path.join(runDir, 'manifest.snapshot.json'))) {
    return { ...base, status: 'manifest-missing' };
  }

  const configuration = deriveConfiguration(records);
  if (configuration === 'mixed') {
    return { ...base, status: 'mixed-configuration' };
  }

  if (records.length < expected) {
    const completedKeys = new Set(records.map((record) => record.taskKey));
    const missingTaskKeys: string[] = [];
    for (let replicate = 1; replicate <= input.manifest.replicates; replicate += 1) {
      for (const item of input.manifest.items) {
        const taskKey = buildKonlingBlindAuditTaskKey({
          benchmarkVersion: input.manifest.benchmarkVersion,
          mode: input.mode,
          itemId: item.itemId,
          replicate,
        });
        if (!completedKeys.has(taskKey)) missingTaskKeys.push(taskKey);
      }
    }
    return {
      ...base,
      configuration,
      status: 'incomplete',
      incompleteDetail: { missingTaskKeys },
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
  const consistent = records.every((record) => record.model === first.model
    && record.provider === first.provider
    && record.promptVersion === first.promptVersion
    && record.scoreVersion === first.scoreVersion);
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
