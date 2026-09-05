/**
 * 知识问答公平基线实验 live 入口（Issue #1900；#1952 增 --bank 分层题库）。
 *
 * 显式 opt-in：必须设置 KONLING_FAIR_EXPERIMENT_LIVE=1 并配置 AI 服务。
 * 三臂共用同一模型与采样参数；回答快照逐条原子落盘、断点续跑、
 * fail closed。--bank v1|v2（默认 v2）：v1 复用冻结的二元盲审 judge；
 * v2 使用分级 rubric（konling-blind-audit-graded.v2 / rubric-graded.v2）。
 *
 * 用法：
 *   KONLING_FAIR_EXPERIMENT_LIVE=1 npx tsx --import ./scripts/konling-blind-audit/server-only-shim.mjs \
 *     scripts/konling-fair-experiment/run-live.ts --run-id fair-240-round1 \
 *     [--bank v1|v2] [--seed 20260903] [--temperature 0.2] [--max-output-tokens 2048]
 */

import { generateText } from 'ai';

import {
  getConfiguredAIModel,
  getConfiguredAIProviderBinding,
  isConfiguredAIServiceAvailable,
} from '@/lib/ai/provider-runtime';
import {
  KONLING_FAIR_EXPERIMENT_BANK_V1,
  KONLING_FAIR_EXPERIMENT_BANK_V2,
  KONLING_FAIR_EXPERIMENT_GRADED_AUDIT_SYSTEM_PROMPT,
  parseKonlingFairExperimentGradedVerdict,
  parseKonlingFairExperimentJudgeVerdict,
  runKonlingFairExperiment,
  type KonlingFairExperimentErrorCode,
} from '@/lib/konling-fair-experiment';
import type { KonlingBlindAuditErrorCode, KonlingBlindAuditItem } from '@/lib/konling-blind-audit';

import { defaultRunId, gitRevision, parseCliFlags } from '../konling-blind-audit/cli';

const BLIND_AUDIT_SYSTEM_PROMPT = [
  '你是自动控制课程知识问答的独立盲审评委。',
  '对给定问题与被审回答，按评分规则独立判定引用支撑、推导正确性与讲解完整性。',
  '只输出 JSON：{"verdict":"pass"|"needs-improvement"|"fail","ruleScore":0-1,"notes":"简要理由"}',
].join('\n');

function classifyProviderError(error: unknown): KonlingFairExperimentErrorCode & KonlingBlindAuditErrorCode {
  const message = error instanceof Error ? error.message : String(error);
  if (/insufficient|balance|quota|402|余额/i.test(message)) return 'insufficient-balance';
  if (/rate.?limit|429|too many requests/i.test(message)) return 'rate-limited';
  if (/timeout|timed out|aborted|ETIMEDOUT/i.test(message)) return 'timeout';
  return 'provider-error';
}

async function main() {
  if (process.env.KONLING_FAIR_EXPERIMENT_LIVE !== '1') {
    console.error('live 实验需要显式 opt-in：设置 KONLING_FAIR_EXPERIMENT_LIVE=1。不要把 live 评测加入普通提交门禁。');
    process.exitCode = 1;
    return;
  }
  if (!(await isConfiguredAIServiceAvailable())) {
    console.error('AI 服务未配置（AI_API_KEY）。');
    process.exitCode = 1;
    return;
  }
  const { values } = parseCliFlags(process.argv.slice(2), [
    'run-id', 'model', 'seed', 'temperature', 'top-p', 'max-output-tokens', 'bank',
  ]);
  const bankSelection = values.bank ?? 'v2';
  if (bankSelection !== 'v1' && bankSelection !== 'v2') {
    console.error('未知题库版本；可用值：v1, v2');
    process.exitCode = 1;
    return;
  }
  const runId = values['run-id'] ?? defaultRunId('fair-live');
  const model = await getConfiguredAIModel(values.model);
  const binding = await getConfiguredAIProviderBinding(values.model);
  const sampling = {
    seed: Number(values.seed ?? 20260903),
    temperature: Number(values.temperature ?? 0.2),
    topP: values['top-p'] === undefined ? 1 : Number(values['top-p']),
    maxOutputTokens: Number(values['max-output-tokens'] ?? 2048),
  };
  const revision = gitRevision();

  const summary = await runKonlingFairExperiment({
    root: process.cwd(),
    runId,
    bank: bankSelection === 'v1'
      ? KONLING_FAIR_EXPERIMENT_BANK_V1
      : KONLING_FAIR_EXPERIMENT_BANK_V2,
    config: {
      model: binding.model,
      provider: binding.provider,
      sampling,
      armPromptVersions: {
        'plain-baseline': 'fair-experiment-plain.v1',
        'enhanced-baseline': 'fair-experiment-enhanced.v1',
        'full-feature': 'konling-generic-chat.v1',
      },
      gitRevision: revision,
      scorerRevision: revision,
      bootstrapIterations: 10_000,
      audit: bankSelection === 'v2'
        ? {
          enabled: true,
          promptVersion: 'konling-blind-audit-graded.v2',
          scoreVersion: 'rubric-graded.v2',
        }
        : {
          enabled: true,
          promptVersion: 'konling-blind-audit.v1',
          scoreVersion: 'rubric.v1',
        },
    },
    calibers: ['structure-alias.v2'],
    generateProvider: async (task) => {
      const started = Date.now();
      try {
        const response = await generateText({
          model,
          system: task.systemPrompt,
          prompt: task.userPrompt,
          temperature: task.sampling.temperature,
          topP: task.sampling.topP ?? undefined,
          seed: task.sampling.seed,
          maxOutputTokens: task.sampling.maxOutputTokens,
          abortSignal: AbortSignal.timeout(180_000),
        });
        if (!response.text.trim()) {
          return { ok: false, error: { code: 'parse-failure' as KonlingFairExperimentErrorCode, message: 'empty answer' } };
        }
        return {
          ok: true,
          result: { answer: response.text, elapsedMs: Date.now() - started },
        };
      } catch (error) {
        return { ok: false, error: { code: classifyProviderError(error), message: error instanceof Error ? error.message : String(error) } };
      }
    },
    auditProvider: async (item: KonlingBlindAuditItem) => {
      const started = Date.now();
      const graded = bankSelection === 'v2';
      try {
        const response = await generateText({
          model,
          system: graded ? KONLING_FAIR_EXPERIMENT_GRADED_AUDIT_SYSTEM_PROMPT : BLIND_AUDIT_SYSTEM_PROMPT,
          prompt: [
            `问题：${item.question}`,
            `被审回答（唯一评审对象，参考要点仅作对照）：${item.candidateAnswer}`,
            `参考要点：${item.referenceAnswer}`,
            `意图类型：${item.intent}`,
            graded
              ? '请按分级评分规则输出五子分与整体分级 JSON。'
              : '请针对被审回答的引用支撑、推导正确性与讲解完整性给出盲审判定 JSON。',
          ].join('\n'),
          temperature: 0,
          maxOutputTokens: graded ? 768 : 512,
          abortSignal: AbortSignal.timeout(120_000),
        });
        if (graded) {
          const verdict = parseKonlingFairExperimentGradedVerdict(response.text);
          if (!verdict) {
            return {
              ok: false,
              error: { code: 'parse-failure' as KonlingBlindAuditErrorCode, message: `unparseable or invalid graded verdict: ${response.text.slice(0, 200)}` },
            };
          }
          return {
            ok: true,
            result: { ...verdict, elapsedMs: Date.now() - started },
          };
        }
        const verdict = parseKonlingFairExperimentJudgeVerdict(response.text);
        if (!verdict) {
          return {
            ok: false,
            error: { code: 'parse-failure' as KonlingBlindAuditErrorCode, message: `unparseable or invalid verdict: ${response.text.slice(0, 200)}` },
          };
        }
        return {
          ok: true,
          result: { verdict: verdict.verdict, ruleScore: verdict.ruleScore, notes: verdict.notes, elapsedMs: Date.now() - started },
        };
      } catch (error) {
        return { ok: false, error: { code: classifyProviderError(error), message: error instanceof Error ? error.message : String(error) } };
      }
    },
  });

  process.stdout.write(`summary: ${JSON.stringify({ ...summary, aggregate: undefined })}\n`);
  process.stdout.write(`aggregate: ${summary.aggregate.status} ${JSON.stringify(summary.aggregate.officialSummary?.generationDeltas ?? summary.aggregate.incompleteDetail ?? summary.aggregate.mixedConfigurationDetail)}\n`);
  if (summary.aggregateStatus !== 'complete') process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
