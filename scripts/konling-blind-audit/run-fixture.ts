/**
 * 知识问答盲审评测 fixture 入口（Issue #1820）。
 *
 * 确定性 provider，不访问网络；支持注入外部失败剧本以演示/验证
 * 断点续跑：首次运行注入失败，重复运行自动跳过已完成项并重试失败项。
 * 产物写入 artifacts/konling-blind-audit/<runId>/。
 *
 * 用法：
 *   npx tsx scripts/konling-blind-audit/run-fixture.ts --run-id demo
 *   npx tsx scripts/konling-blind-audit/run-fixture.ts --run-id demo \
 *     --inject blind-audit-v1--blind-audit--code-antiwindup--1=insufficient-balance
 */

import {
  aggregateKonlingBlindAuditRun,
  KONLING_BLIND_AUDIT_BENCHMARK_V1,
  konlingBlindAuditManifestHash,
  runKonlingBlindAudit,
  writeKonlingBlindAuditAggregate,
  type KonlingBlindAuditErrorCode,
} from '@/lib/konling-blind-audit';

import { defaultRunId, gitRevision, parseCliFlags } from './cli';

async function main() {
  const { values } = parseCliFlags(process.argv.slice(2), ['run-id', 'inject']);
  const runId = values['run-id'] ?? defaultRunId('fixture');
  const inject = new Map<string, KonlingBlindAuditErrorCode>();
  if (values['inject']) {
    const [taskKey, code] = values['inject'].split('=');
    inject.set(taskKey, code as KonlingBlindAuditErrorCode);
  }
  const manifest = KONLING_BLIND_AUDIT_BENCHMARK_V1;
  const manifestHash = konlingBlindAuditManifestHash(manifest);
  for (const mode of manifest.modes) {
    const summary = await runKonlingBlindAudit({
      root: process.cwd(),
      runId,
      manifest,
      manifestPayload: manifest,
      manifestHash,
      mode,
      config: {
        mode,
        model: 'fixture-blind-judge',
        provider: 'deterministic-fixture-stub',
        promptVersion: 'konling-blind-audit.v1',
        scoreVersion: 'rubric.v1',
        gitRevision: gitRevision(),
      },
      provider: async (item, replicate, config) => {
        const taskKey = [
          manifest.benchmarkVersion,
          config.mode,
          item.itemId,
          String(replicate),
        ].join('--');
        const injected = inject.get(taskKey);
        if (injected) {
          return { ok: false, error: { code: injected, message: `injected ${injected} for ${taskKey}` } };
        }
        // 确定性评审结果：条目 + replicate 稳定，不依赖随机或网络。
        const seed = [...`${item.itemId}:${replicate}`].reduce((sum, ch) => sum + ch.codePointAt(0)!, 0);
        const ruleScore = 0.6 + (seed % 4) * 0.1;
        return {
          ok: true,
          result: config.mode === 'rule-score'
            ? { ruleScore }
            : { verdict: ruleScore >= 0.8 ? 'pass' : 'needs-improvement', ruleScore },
        };
      },
    });
    process.stdout.write(`${mode}: ${JSON.stringify(summary)}\n`);
    const aggregate = aggregateKonlingBlindAuditRun({
      root: process.cwd(),
      runId,
      manifest,
      mode,
    });
    const summaryPath = writeKonlingBlindAuditAggregate(process.cwd(), aggregate);
    process.stdout.write(`${mode} aggregate: ${JSON.stringify(aggregate)}\n  -> ${summaryPath}\n`);
    if (aggregate.status !== 'complete') process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
