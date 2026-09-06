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
import type { KonlingEvidenceAllocationPlan } from '@/lib/konling-evidence-allocation';
import { STUDY_QUESTION_SECTIONS } from '@/lib/konling-study-question-structure';

import { defaultRunId, gitRevision, parseCliFlags } from '../konling-blind-audit/cli';

/**
 * #2039：fixture 的 citation 装配与生产同源——编号、主源/备用映射与冻结
 * 快照均来自 runner 传入的 `task.citations` / `task.evidencePlan`（由
 * `buildKonlingFairExperimentCitationAssembly` 从参考材料片段确定性装配）。
 * fixture 在此之上追加三条审计口径演练用的边缘类引用（编号顺延，不入
 * 分配表）：未核验（audit-unverified）、仅语义相关（audit-semantic，
 * semantic-score）与不可访问（audit-inaccessible，href 为空）。
 * full-feature 臂每个 evidence-required 章节末行以该章节主源编号绑定；
 * itemId 确定性奇偶决定最后一个证据章节改绑未核验或仅语义引用；偶数
 * 条目的第一个证据章节同时绑定主源与不可访问引用（覆盖由主源达成、
 * 不可访问引用落对应桶），保持 #1951 的引用类分布可审计。
 */
function fixtureEdgeCitations(
  item: KonlingFairExperimentBankItem,
  bankVersion: string,
  sourceRevision: string,
  baseCitations: readonly KonlingFairExperimentCitationSnapshot[],
): KonlingFairExperimentCitationSnapshot[] {
  const next = baseCitations.reduce((max, citation) => Math.max(max, citation.displayNumber ?? 0), 0) + 1;
  const anchor = (suffix: string) => `fair-experiment:${bankVersion}:${item.itemId}:${suffix}`;
  return [
    {
      id: `${item.itemId}:audit-unverified`,
      citationTargetId: anchor('audit-unverified'),
      verified: false,
      displayNumber: next,
      sourceType: 'content',
      href: null,
      answerRelevanceBasis: 'query-lexical',
    },
    {
      id: `${item.itemId}:audit-semantic`,
      citationTargetId: anchor('audit-semantic'),
      verified: true,
      displayNumber: next + 1,
      sourceType: 'content',
      href: `https://act.example/fair-experiment/${encodeURIComponent(bankVersion)}/${encodeURIComponent(item.itemId)}#audit-semantic`,
      answerRelevanceBasis: 'semantic-score',
    },
    {
      id: `${item.itemId}:audit-inaccessible`,
      citationTargetId: anchor('audit-inaccessible'),
      verified: true,
      displayNumber: next + 2,
      sourceType: 'content',
      href: null,
      answerRelevanceBasis: 'query-lexical',
    },
  ];
}

function fixtureAnswer(
  arm: 'plain-baseline' | 'enhanced-baseline' | 'full-feature',
  item: KonlingFairExperimentBankItem,
  replicate: number,
  bankVersion: string,
  sourceRevision: string,
  taskCitations?: readonly KonlingFairExperimentCitationSnapshot[],
  evidencePlan?: KonlingEvidenceAllocationPlan,
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
  const assembled = taskCitations ?? [];
  const edges = fixtureEdgeCitations(item, bankVersion, sourceRevision, assembled);
  const edgeNumber = (suffix: string) => edges.find((edge) => edge.id.endsWith(suffix))?.displayNumber ?? null;
  const primaryNumberFor = (sectionId: string) => evidencePlan?.assignments
    .find((assignment) => assignment.sectionId === sectionId)?.primaryDisplayNumber ?? null;
  let evidenceIndex = 0;
  return {
    answer: sections
      .map((section) => {
        if (section.citationPolicy !== 'evidence-required') {
          return `## ${headingOf(section)}\n按推导作答${suffix}。`;
        }
        evidenceIndex += 1;
        const isLastEvidence = evidenceIndex === evidenceSections.length;
        const primary = primaryNumberFor(section.id);
        let marker = primary !== null ? ` [${primary}]` : '';
        if (isLastEvidence && useUnverifiedOnLast) {
          const unverified = edgeNumber(':audit-unverified');
          marker = unverified !== null ? ` [${unverified}]` : marker;
        }
        if (isLastEvidence && !useUnverifiedOnLast) {
          const semantic = edgeNumber(':audit-semantic');
          marker = semantic !== null ? ` [${semantic}]` : marker;
        }
        if (!useUnverifiedOnLast && evidenceIndex === 1 && evidenceSections.length > 1) {
          const inaccessible = edgeNumber(':audit-inaccessible');
          if (inaccessible !== null && primary !== null) marker = ` [${primary}] [${inaccessible}]`;
        }
        return `## ${headingOf(section)}\n按参考材料作答${suffix}。${marker}`;
      })
      .join('\n'),
    citations: [...assembled, ...edges],
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
      const fixture = fixtureAnswer(
        task.arm,
        task.item,
        task.replicate,
        bank.bankVersion,
        revision,
        task.citations,
        task.evidencePlan,
      );
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
