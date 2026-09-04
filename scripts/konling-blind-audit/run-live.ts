/**
 * 知识问答盲审评测 live 入口（Issue #1820）。
 *
 * 显式 opt-in：必须设置 KONLING_BLIND_AUDIT_LIVE=1 并配置 AI 服务。
 * 每条审计原子落盘、断点续跑、不完整批次 fail closed；中断后用相同
 * runId 重复执行即可从断点继续，已完成条目不会重复计费。
 *
 * 用法：
 *   KONLING_BLIND_AUDIT_LIVE=1 npx tsx scripts/konling-blind-audit/run-live.ts \
 *     --run-id blind-240-round1 [--mode blind-audit] [--model <id>]
 */

import { generateText } from 'ai';

import {
  getConfiguredAIModel,
  getConfiguredAIProviderBinding,
  isConfiguredAIServiceAvailable,
} from '@/lib/ai/provider-runtime';
import {
  aggregateKonlingBlindAuditRun,
  KONLING_BLIND_AUDIT_BENCHMARK_V1,
  konlingBlindAuditManifestHash,
  runKonlingBlindAudit,
  writeKonlingBlindAuditAggregate,
  type KonlingBlindAuditErrorCode,
  type KonlingBlindAuditMode,
} from '@/lib/konling-blind-audit';

import { defaultRunId, gitRevision, parseCliFlags } from './cli';

const PROMPT_VERSION = 'konling-blind-audit.v1';
const SCORE_VERSION = 'rubric.v1';
const BLIND_AUDIT_SYSTEM_PROMPT = [
  '你是自动控制课程知识问答的独立盲审评委。',
  '对给定问题与被审回答，按评分规则独立判定引用支撑、推导正确性与讲解完整性。',
  '只输出 JSON：{"verdict":"pass"|"needs-improvement"|"fail","ruleScore":0-1,"notes":"简要理由"}',
].join('\n');

function classifyProviderError(error: unknown): KonlingBlindAuditErrorCode {
  const message = error instanceof Error ? error.message : String(error);
  if (/insufficient|balance|quota|402|余额/i.test(message)) return 'insufficient-balance';
  if (/rate.?limit|429|too many requests/i.test(message)) return 'rate-limited';
  if (/timeout|timed out|aborted|ETIMEDOUT/i.test(message)) return 'timeout';
  return 'provider-error';
}

async function main() {
  if (process.env.KONLING_BLIND_AUDIT_LIVE !== '1') {
    console.error('live 盲审需要显式 opt-in：设置 KONLING_BLIND_AUDIT_LIVE=1。不要把 live 评测加入普通提交门禁。');
    process.exitCode = 1;
    return;
  }
  if (!(await isConfiguredAIServiceAvailable())) {
    console.error('AI 服务未配置（AI_API_KEY）。');
    process.exitCode = 1;
    return;
  }
  const { values } = parseCliFlags(process.argv.slice(2), ['run-id', 'mode', 'model']);
  const runId = values['run-id'] ?? defaultRunId('live');
  const requestedMode = values['mode'] as KonlingBlindAuditMode | undefined;
  const requestedModel = values['model'];
  const manifest = KONLING_BLIND_AUDIT_BENCHMARK_V1;
  const manifestHash = konlingBlindAuditManifestHash(manifest);
  const model = await getConfiguredAIModel(requestedModel);
  const binding = await getConfiguredAIProviderBinding(requestedModel);
  const modes = requestedMode ? [requestedMode] : [...manifest.modes];

  for (const mode of modes) {
    const summary = await runKonlingBlindAudit({
      root: process.cwd(),
      runId,
      manifest,
      manifestPayload: manifest,
      manifestHash,
      mode,
      config: {
        mode,
        model: binding.model,
        provider: binding.provider,
        promptVersion: PROMPT_VERSION,
        scoreVersion: SCORE_VERSION,
        gitRevision: gitRevision(),
      },
      provider: async (item) => {
        const started = Date.now();
        try {
          const response = await generateText({
            model,
            system: BLIND_AUDIT_SYSTEM_PROMPT,
            prompt: [
              `问题：${item.question}`,
              `被审回答（唯一评审对象，参考要点仅作对照）：${item.candidateAnswer}`,
              `参考要点：${item.referenceAnswer}`,
              `意图类型：${item.intent}`,
              '请针对被审回答的引用支撑、推导正确性与讲解完整性给出盲审判定 JSON。',
            ].join('\n'),
            abortSignal: AbortSignal.timeout(120_000),
          });
          const parsed = JSON.parse(response.text.trim().replace(/^```(?:json)?|```$/g, '')) as {
            verdict?: unknown;
            ruleScore?: unknown;
            notes?: unknown;
          };
          if (typeof parsed.verdict !== 'string' || typeof parsed.ruleScore !== 'number') {
            return {
              ok: false,
              error: { code: 'parse-failure' as KonlingBlindAuditErrorCode, message: `unparseable verdict: ${response.text.slice(0, 200)}` },
            };
          }
          return {
            ok: true,
            result: { verdict: parsed.verdict, ruleScore: parsed.ruleScore, notes: parsed.notes ?? null, elapsedMs: Date.now() - started },
          };
        } catch (error) {
          return { ok: false, error: { code: classifyProviderError(error), message: error instanceof Error ? error.message : String(error) } };
        }
      },
    });
    process.stdout.write(`${mode}: ${JSON.stringify(summary)}\n`);
    const aggregate = aggregateKonlingBlindAuditRun({ root: process.cwd(), runId, manifest, mode });
    writeKonlingBlindAuditAggregate(process.cwd(), aggregate);
    process.stdout.write(`${mode} aggregate: ${JSON.stringify(aggregate)}\n`);
    if (aggregate.status !== 'complete') process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
