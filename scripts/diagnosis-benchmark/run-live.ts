/**
 * 诊断基准 live 评测入口（Issue #1729）：真实 provider 重复评测。
 *
 * 显式 opt-in：需设置 DIAGNOSIS_BENCHMARK_LIVE=1，普通验证与普通提
 * 交流程不会触发，避免外部服务波动变成不稳定门禁。默认每场景 3 次
 * 重复，可用 DIAGNOSIS_BENCHMARK_REPLICATES 覆盖。
 */

import { execFileSync } from 'node:child_process';

import { resolveSmartLessonStructuredProvider } from '@/lib/smart-lesson-plan/provider-runtime';
import { diagnosisReportBodySchema } from '@/lib/diagnosis-persistence';
import {
  runDiagnosisBenchmark,
  writeBenchmarkRun,
  type DiagnosisBenchmarkCandidateReport,
  type DiagnosisBenchmarkGenerate,
} from '@/lib/diagnosis-benchmark/runner';

const LIVE_SYSTEM_PROMPT = [
  '你是教师学情诊断评测生成器，只能依据给定的受治理工具结果生成结构化报告。',
  '所有自然语言内容使用简体中文；知识点薄弱判定只报告有充分绝对弱势证据的节点。',
  '相对较低但处于正常范围的节点不得判为薄弱；全部正常时 findings 为空。',
].join('\n');

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
  const replicates = Number.parseInt(process.env.DIAGNOSIS_BENCHMARK_REPLICATES ?? '3', 10);
  const provider = await resolveSmartLessonStructuredProvider();
  const generate: DiagnosisBenchmarkGenerate = async ({ governedInput, scenario }) => {
    const startedAt = Date.now();
    try {
      const generated = await provider.generate({
        schema: diagnosisReportBodySchema,
        schemaVersion: 'teacher-diagnosis-report-body.v1',
        promptVersion: 'diagnosis-benchmark-live.v1',
        system: LIVE_SYSTEM_PROMPT,
        prompt: JSON.stringify({
          scope: { type: 'class', classId: governedInput.classId, scenario: scenario.id },
          governedToolResults: {
            assignments: governedInput.assignmentSubmissions,
            assessments: governedInput.assessmentSessions,
            knowledgeProgress: governedInput.knowledgeProgress,
          },
        }),
        idempotencyKey: `diagnosis-benchmark-${scenario.id}-${Date.now()}`,
        maxOutputTokens: 2_400,
        timeoutMs: 120_000,
      });
      return {
        ok: true,
        durationMs: Date.now() - startedAt,
        report: generated.output as DiagnosisBenchmarkCandidateReport,
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
    generate,
    replicates: Number.isFinite(replicates) && replicates > 0 ? replicates : 3,
    versionInfo: {
      mode: 'live',
      provider: process.env.SMART_LESSON_PROVIDER ?? 'default-structured-provider',
      model: process.env.SMART_LESSON_MODEL ?? null,
      promptVersion: 'diagnosis-benchmark-live.v1',
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
