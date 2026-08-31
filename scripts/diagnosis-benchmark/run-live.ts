/**
 * 诊断基准 live 评测入口（Issue #1729）：真实 provider 重复评测。
 *
 * 显式 opt-in：需设置 DIAGNOSIS_BENCHMARK_LIVE=1，普通验证与普通提
 * 交流程不会触发，避免外部服务波动变成不稳定门禁。每场景至少 3 次
 * 重复（更小的 DIAGNOSIS_BENCHMARK_REPLICATES 会被钳制到 3）；提示词
 * 与工具投影复用生产诊断构建函数，候选版本对生产提示词或投影的修改
 * 直接进入评测面。
 */

import { execFileSync } from 'node:child_process';

import {
  buildDiagnosisProviderToolResults,
  generateDiagnosisProviderOutput,
} from '@/lib/diagnosis-generation-provider';
import { diagnosisReportBodySchema } from '@/lib/diagnosis-persistence';
import {
  runDiagnosisBenchmark,
  writeBenchmarkRun,
  type DiagnosisBenchmarkCandidateReport,
  type DiagnosisBenchmarkGenerate,
} from '@/lib/diagnosis-benchmark/runner';
import { DIAGNOSIS_BENCHMARK_SCENARIOS } from '@/lib/diagnosis-benchmark/scenarios';
import { materializeScenario } from '@/lib/diagnosis-benchmark/generate';

const PRODUCTION_PROMPT_VERSION = 'teacher-diagnosis.v1';

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
  if (process.env.DIAGNOSIS_BENCHMARK_LIVE !== '1') {
    process.stderr.write('live 评测需要显式开启：DIAGNOSIS_BENCHMARK_LIVE=1（避免外部服务波动进入普通提交门禁）。\n');
    process.exitCode = 1;
    return;
  }
  const requested = Number.parseInt(process.env.DIAGNOSIS_BENCHMARK_REPLICATES ?? '3', 10);
  const replicates = Number.isFinite(requested) ? Math.max(3, requested) : 3;
  if (replicates !== requested) {
    process.stderr.write(`live 评测每场景至少 3 次重复：${requested} 已被钳制为 ${replicates}。\n`);
  }
  const scenarioMaterializations = DIAGNOSIS_BENCHMARK_SCENARIOS.map((scenario) => ({
    scenario,
    materialized: materializeScenario(scenario),
  }));
  const liveGenerate: DiagnosisBenchmarkGenerate = async ({ scenario, replicate }) => {
    const entry = scenarioMaterializations.find((item) => item.scenario.id === scenario.id);
    if (!entry) {
      return { ok: false, reason: `unknown scenario ${scenario.id}`, durationMs: 0 };
    }
    const startedAt = Date.now();
    const attemptId = `diagnosis-benchmark-${scenario.id}-${replicate}-${Date.now()}`;
    try {
      // 完整复用生产 provider 调用协议（Issue #1729 review）：生产 provider
      // schema、deferValidation/fallbackToTextJson、text-JSON 回退校验与
      // 空/超时转换；再按生产方式用持久化 schema 复核报告体。
      const { providerToolResults, learnerAliasFor } = buildDiagnosisProviderToolResults(
        entry.materialized.governedInput,
        { attemptId, targetStudentId: null },
      );
      const generated = await generateDiagnosisProviderOutput({
        attemptId,
        classId: entry.materialized.governedInput.classId,
        targetStudentId: null,
        evidenceCutoffIso: '2026-08-31T08:00:00.000Z',
        generatorVersion: PRODUCTION_PROMPT_VERSION,
        governedToolResults: providerToolResults,
        learnerAliasFor,
      });
      const parsed = diagnosisReportBodySchema.safeParse(generated.output);
      if (!parsed.success) {
        return {
          ok: false,
          durationMs: Date.now() - startedAt,
          reason: `report-body-invalid: ${parsed.error.issues.map((issue) => issue.path.join('.')).join(',')}`,
        };
      }
      return {
        ok: true,
        durationMs: Date.now() - startedAt,
        report: parsed.data as DiagnosisBenchmarkCandidateReport,
        // 审计留解析前原始输出：safeParse 会补默认值并裁剪字符串，
        // 规范化结果不可还原模型实际返回（Issue #1729 review）。
        rawOutput: generated.output,
      };
    } catch (error) {
      return {
        ok: false,
        durationMs: Date.now() - startedAt,
        reason: error instanceof Error ? error.message : String(error),
      };
    }
  };

  const result = await runDiagnosisBenchmark({
    generate: liveGenerate,
    replicates,
    versionInfo: {
      mode: 'live',
      provider: process.env.SMART_LESSON_PROVIDER ?? 'default-structured-provider',
      model: process.env.SMART_LESSON_MODEL ?? null,
      promptVersion: `${PRODUCTION_PROMPT_VERSION} (production replay)`,
      schemaVersion: 'teacher-diagnosis-report-body.v1',
      generatorVersion: 'diagnosis-benchmark.v1',
      projectionVersion: 'production-provider-projection',
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
