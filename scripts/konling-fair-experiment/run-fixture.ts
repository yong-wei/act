/**
 * 知识问答公平基线实验 fixture 入口（Issue #1900）。
 *
 * 确定性 provider，不访问网络；三臂回答由条目结构确定性生成：
 * plain 无结构、enhanced 使用语义别名标题、full-feature 使用 canonical
 * 标题，从而在两种评分口径下产生可解释的差异。支持注入外部失败剧本
 * 演示断点续跑。产物写入 artifacts/konling-fair-experiment/<runId>/。
 *
 * 用法：
 *   npx tsx scripts/konling-fair-experiment/run-fixture.ts --run-id demo
 *   npx tsx scripts/konling-fair-experiment/run-fixture.ts --run-id demo \
 *     --inject fair-experiment-v1--enhanced-baseline--code-antiwindup--1=insufficient-balance
 */

import {
  runKonlingFairExperiment,
  type KonlingFairExperimentErrorCode,
} from '@/lib/konling-fair-experiment';
import { KONLING_FAIR_EXPERIMENT_BANK_V1 } from '@/lib/konling-fair-experiment';
import { STUDY_QUESTION_SECTIONS } from '@/lib/konling-study-question-structure';

import { defaultRunId, gitRevision, parseCliFlags } from '../konling-blind-audit/cli';

function fixtureAnswer(
  arm: 'plain-baseline' | 'enhanced-baseline' | 'full-feature',
  itemId: string,
  intent: keyof typeof STUDY_QUESTION_SECTIONS,
  replicate: number,
): string {
  const sections = STUDY_QUESTION_SECTIONS[intent];
  const suffix = `（${itemId}#${replicate}）`;
  if (arm === 'plain-baseline') {
    return [
      `${sections.map((section) => section.title).join('、')}这些内容合在一起讲：`,
      `${sections.map((section) => `${section.title}方面按参考材料回答${suffix}。`).join('')}`,
    ].join('\n');
  }
  const headingOf = arm === 'enhanced-baseline'
    ? (section: (typeof sections)[number]) => section.aliases[0] ?? section.title
    : (section: (typeof sections)[number]) => section.title;
  return sections
    .map((section) => `## ${headingOf(section)}\n按参考材料作答${suffix}。`)
    .join('\n');
}

async function main() {
  const { values } = parseCliFlags(process.argv.slice(2), ['run-id', 'inject']);
  const runId = values['run-id'] ?? defaultRunId('fair-fixture');
  const inject = new Map<string, KonlingFairExperimentErrorCode>();
  if (values['inject']) {
    const [taskKey, code] = values['inject'].split('=');
    inject.set(taskKey, code as KonlingFairExperimentErrorCode);
  }
  const revision = gitRevision();

  const summary = await runKonlingFairExperiment({
    root: process.cwd(),
    runId,
    bank: KONLING_FAIR_EXPERIMENT_BANK_V1,
    config: {
      model: 'fixture-generator',
      provider: 'deterministic-fixture-stub',
      sampling: { seed: 20260903, temperature: 0.2, topP: 1, maxOutputTokens: 2048 },
      armPromptVersions: {
        'plain-baseline': 'fair-experiment-plain.v1',
        'enhanced-baseline': 'fair-experiment-enhanced.v1',
        'full-feature': 'konling-generic-chat.v1',
      },
      gitRevision: revision,
      scorerRevision: revision,
      bootstrapIterations: 2000,
      audit: {
        enabled: true,
        promptVersion: 'konling-blind-audit.v1',
        scoreVersion: 'rubric.v1',
      },
    },
    calibers: ['structure-alias.v1'],
    generateProvider: async (task) => {
      const taskKey = [KONLING_FAIR_EXPERIMENT_BANK_V1.bankVersion, task.arm, task.item.itemId, String(task.replicate)].join('--');
      const injected = inject.get(taskKey);
      if (injected) {
        return { ok: false, error: { code: injected, message: `injected ${injected} for ${taskKey}` } };
      }
      return {
        ok: true,
        result: {
          answer: fixtureAnswer(task.arm, task.item.itemId, task.item.intent, task.replicate),
          elapsedMs: 1,
        },
      };
    },
    auditProvider: async (item, replicate) => {
      const seed = [...`${item.itemId}:${replicate}`].reduce((sum, ch) => sum + ch.codePointAt(0)!, 0);
      const ruleScore = 0.6 + (seed % 4) * 0.1;
      return {
        ok: true,
        result: {
          verdict: ruleScore >= 0.8 ? 'pass' : 'needs-improvement',
          ruleScore,
          notes: 'fixture judge',
        },
      };
    },
  });

  process.stdout.write(`summary: ${JSON.stringify({ ...summary, aggregate: undefined })}\n`);
  process.stdout.write(`aggregate: ${JSON.stringify(summary.aggregate.status)} ${JSON.stringify(summary.aggregate.officialSummary?.generationDeltas ?? summary.aggregate.incompleteDetail ?? summary.aggregate.mixedConfigurationDetail)}\n`);
  if (summary.aggregateStatus !== 'complete') process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
