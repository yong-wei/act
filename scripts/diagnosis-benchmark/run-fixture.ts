/**
 * 诊断基准 fixture 评测入口（Issue #1729）。
 *
 * 确定性 provider stub，不访问网络；验证指标计算、阈值判断与失败
 * 明细生成。产物写入 artifacts/diagnosis-benchmark/<runId>/。
 */

import { execFileSync } from 'node:child_process';

import {
  createFixtureGenerate,
  runDiagnosisBenchmark,
  writeBenchmarkRun,
} from '@/lib/diagnosis-benchmark/runner';

function gitRevision(): string {
  try {
    const commit = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
    const dirty = execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim().length > 0;
    return dirty ? `${commit}-dirty` : commit;
  } catch {
    return 'unknown';
  }
}

async function main() {
  const result = await runDiagnosisBenchmark({
    generate: createFixtureGenerate(),
    replicates: 3,
    versionInfo: {
      mode: 'fixture',
      provider: 'deterministic-fixture-stub',
      model: null,
      promptVersion: 'diagnosis-benchmark-fixture.v1',
      schemaVersion: 'teacher-diagnosis-report-body.v1',
      generatorVersion: 'diagnosis-benchmark.v1',
      projectionVersion: 'governance-replay.v1',
      codeRevision: gitRevision(),
    },
  });
  const runDir = await writeBenchmarkRun(process.cwd(), result);
  process.stdout.write(`runId: ${result.runId}\npassed: ${result.passed}\noutput: ${runDir}\n`);
  process.stdout.write(`aggregate: ${JSON.stringify(result.aggregate)}\n`);
  if (result.thresholdFailures.length > 0) {
    process.stdout.write(`threshold failures:\n${JSON.stringify(result.thresholdFailures, null, 2)}\n`);
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
