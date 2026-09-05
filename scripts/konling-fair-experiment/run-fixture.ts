/**
 * 知识问答公平基线实验 fixture 入口（Issue #1900；#1952 增 --bank 分层题库）。
 *
 * 确定性 provider，不访问网络；三臂回答由条目结构确定性生成：
 * plain 无结构、enhanced 使用语义别名标题、full-feature 使用 canonical
 * 标题，从而在两种评分口径下产生可解释的差异。支持注入外部失败剧本
 * 演示断点续跑。产物写入 artifacts/konling-fair-experiment/<runId>/。
 *
 * --bank v1|v2（默认 v2）：v1 保持冻结的二元盲审 fixture；v2 使用分级
 * rubric——对抗题 plain 臂的回答未经核验直接接受题设前提，分级 fixture
 * judge 据此产出重大错误样例，为聚合提供非退化的判别力分布。
 *
 * 用法：
 *   npx tsx scripts/konling-fair-experiment/run-fixture.ts --run-id demo
 *   npx tsx scripts/konling-fair-experiment/run-fixture.ts --run-id demo --bank v1
 *   npx tsx scripts/konling-fair-experiment/run-fixture.ts --run-id demo \
 *     --inject fair-experiment-v2--enhanced-baseline--code-antiwindup--1=insufficient-balance
 */

import {
  runKonlingFairExperiment,
  KONLING_FAIR_EXPERIMENT_BANK_V1,
  KONLING_FAIR_EXPERIMENT_BANK_V2,
  KONLING_FAIR_EXPERIMENT_AUDIT_DIMENSIONS,
  type KonlingFairExperimentAuditDimension,
  type KonlingFairExperimentBank,
  type KonlingFairExperimentBankItem,
  type KonlingFairExperimentCitationSnapshot,
  type KonlingFairExperimentErrorCode,
  type KonlingFairExperimentGradedVerdictName,
} from '@/lib/konling-fair-experiment';
import type { KonlingBlindAuditProvider } from '@/lib/konling-blind-audit';
import { STUDY_QUESTION_SECTIONS } from '@/lib/konling-study-question-structure';

import { defaultRunId, gitRevision, parseCliFlags } from '../konling-blind-audit/cli';

/**
 * #1951 fixture citation 快照：cit-1 已核验、可访问且冻结了答案相关性
 * 匹配证据（直接支撑）；cit-2 未核验；cit-3 已核验可访问但无直接支撑
 * 证据（仅相关）；cit-4 已核验有锚点但 href 为空（不可访问）。
 * full-feature 臂每个 evidence-required 章节末行以 [1] 绑定 cit-1；
 * itemId 确定性奇偶决定最后一个证据章节改标 [2]（未核验）或 [3]
 * （仅相关）；偶数条目的第一个证据章节同时标 [1] [4]（同单元绑定
 * 直接支撑与不可访问引用，覆盖由 [1] 达成、[4] 落不可访问桶）。
 */
const FIXTURE_CITATIONS: readonly KonlingFairExperimentCitationSnapshot[] = [
  {
    id: 'cit-1',
    citationTargetId: 'kb:fixture-primary',
    verified: true,
    displayNumber: 1,
    sourceType: 'knowledge-graph',
    href: 'https://act.example/kb/fixture-primary',
    answerRelevanceMatch: 'query-exact',
  },
  {
    id: 'cit-2',
    citationTargetId: 'kb:fixture-secondary',
    verified: false,
    displayNumber: 2,
    sourceType: 'knowledge-graph',
    href: null,
  },
  {
    id: 'cit-3',
    citationTargetId: 'kb:fixture-related-only',
    verified: true,
    displayNumber: 3,
    sourceType: 'knowledge-graph',
    href: 'https://act.example/kb/fixture-related-only',
  },
  {
    id: 'cit-4',
    citationTargetId: 'kb:fixture-inaccessible',
    verified: true,
    displayNumber: 4,
    sourceType: 'knowledge-graph',
    href: null,
    answerRelevanceMatch: 'token:keyword',
  },
];

function fixtureAnswer(
  arm: 'plain-baseline' | 'enhanced-baseline' | 'full-feature',
  item: KonlingFairExperimentBankItem,
  replicate: number,
): { answer: string; citations: readonly KonlingFairExperimentCitationSnapshot[] } {
  const sections = STUDY_QUESTION_SECTIONS[item.intent];
  const suffix = `（${item.itemId}#${replicate}）`;
  if (arm === 'plain-baseline') {
    const lines = [
      `${sections.map((section) => section.title).join('、')}这些内容合在一起讲：`,
      `${sections.map((section) => `${section.title}方面按参考材料回答${suffix}。`).join('')}`,
    ];
    // 对抗题（题库 V2）：plain 臂未经核验直接接受题设前提，分级 fixture
    // judge 据此判定重大错误；V1 条目无分层标注，输出与冻结行为一致。
    if (item.difficulty === 'adversarial') lines.push('前提无需核验，按题设直接作答。');
    return { answer: lines.join('\n'), citations: [] };
  }
  const headingOf = arm === 'enhanced-baseline'
    ? (section: (typeof sections)[number]) => section.aliases[0] ?? section.title
    : (section: (typeof sections)[number]) => section.title;
  if (arm !== 'full-feature') {
    return {
      answer: sections
        .map((section) => `## ${headingOf(section)}\n按参考材料作答${suffix}。`)
        .join('\n'),
      citations: [],
    };
  }
  const useUnverifiedOnLast = [...item.itemId].reduce((sum, ch) => sum + ch.codePointAt(0)!, 0) % 2 === 1;
  const evidenceSections = sections.filter((section) => section.citationPolicy === 'evidence-required');
  let evidenceIndex = 0;
  return {
    answer: sections
      .map((section) => {
        if (section.citationPolicy !== 'evidence-required') {
          return `## ${headingOf(section)}\n按推导作答${suffix}。`;
        }
        evidenceIndex += 1;
        const isLastEvidence = evidenceIndex === evidenceSections.length;
        let marker = ' [1]';
        if (isLastEvidence && useUnverifiedOnLast) marker = ' [2]';
        if (isLastEvidence && !useUnverifiedOnLast) marker = ' [3]';
        if (!useUnverifiedOnLast && evidenceIndex === 1 && evidenceSections.length > 1) marker = ' [1] [4]';
        return `## ${headingOf(section)}\n按参考材料作答${suffix}。${marker}`;
      })
      .join('\n'),
    citations: FIXTURE_CITATIONS,
  };
}

/**
 * 分级 fixture judge（rubric-graded.v2）：按回答内容确定性分级——
 * 含未核验前提标记 → major-error；无结构 → minor-flaw；canonical 标题 →
 * correct（对抗题 0.95、其余 1.0，供天花板比例）；别名标题按难度区分。
 */
function fixtureGradedAuditProvider(bank: KonlingFairExperimentBank): KonlingBlindAuditProvider {
  return async (item, replicate) => {
    const sections = STUDY_QUESTION_SECTIONS[item.intent as keyof typeof STUDY_QUESTION_SECTIONS];
    const canonicalHeading = `## ${sections[0].title}`;
    const aliasHeading = `## ${sections[0].aliases[0] ?? sections[0].title}`;
    const difficulty = bank.items.find((candidate) => candidate.itemId === item.itemId)?.difficulty
      ?? 'foundational';
    const answer = item.candidateAnswer;
    let verdict: KonlingFairExperimentGradedVerdictName;
    let ruleScore: number;
    if (answer.includes('前提无需核验')) {
      verdict = 'major-error';
      ruleScore = 0;
    } else if (!answer.includes('## ')) {
      verdict = 'minor-flaw';
      ruleScore = 0.5;
    } else if (answer.includes(canonicalHeading)) {
      verdict = 'correct';
      ruleScore = difficulty === 'adversarial' ? 0.95 : 1;
    } else if (answer.includes(aliasHeading)) {
      verdict = difficulty === 'adversarial' ? 'minor-flaw' : 'correct';
      ruleScore = difficulty === 'adversarial' ? 0.7 : 0.9;
    } else {
      verdict = 'minor-flaw';
      ruleScore = 0.6;
    }
    const seed = [...`${item.itemId}:${replicate}`].reduce((sum, ch) => sum + ch.codePointAt(0)!, 0);
    const subscores = Object.fromEntries(
      KONLING_FAIR_EXPERIMENT_AUDIT_DIMENSIONS.map((dimension, index) => {
        const base = verdict === 'correct' ? 0.92 : verdict === 'minor-flaw' ? 0.6 : 0.15;
        const jitter = (((seed + index) % 5) - 2) * 0.02;
        return [dimension, Math.min(1, Math.max(0, base + jitter))];
      }),
    ) as Record<KonlingFairExperimentAuditDimension, number>;
    return {
      ok: true,
      result: { verdict, ruleScore, subscores, notes: 'fixture graded judge' },
    };
  };
}

async function main() {
  const { values } = parseCliFlags(process.argv.slice(2), ['run-id', 'inject', 'bank']);
  const runId = values['run-id'] ?? defaultRunId('fair-fixture');
  const bankSelection = values.bank ?? 'v2';
  if (bankSelection !== 'v1' && bankSelection !== 'v2') {
    console.error('未知题库版本；可用值：v1, v2');
    process.exitCode = 1;
    return;
  }
  const bank = bankSelection === 'v1'
    ? KONLING_FAIR_EXPERIMENT_BANK_V1
    : KONLING_FAIR_EXPERIMENT_BANK_V2;
  const inject = new Map<string, KonlingFairExperimentErrorCode>();
  if (values['inject']) {
    const [taskKey, code] = values['inject'].split('=');
    inject.set(taskKey, code as KonlingFairExperimentErrorCode);
  }
  const revision = gitRevision();

  const summary = await runKonlingFairExperiment({
    root: process.cwd(),
    runId,
    bank,
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
      const taskKey = [bank.bankVersion, task.arm, task.item.itemId, String(task.replicate)].join('--');
      const injected = inject.get(taskKey);
      if (injected) {
        return { ok: false, error: { code: injected, message: `injected ${injected} for ${taskKey}` } };
      }
      const fixture = fixtureAnswer(task.arm, task.item, task.replicate);
      return {
        ok: true,
        result: {
          answer: fixture.answer,
          citations: fixture.citations,
          elapsedMs: 1,
        },
      };
    },
    auditProvider: bankSelection === 'v2'
      ? fixtureGradedAuditProvider(bank)
      : async (item, replicate) => {
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
