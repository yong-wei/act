/**
 * #2039：公平实验 full-feature 臂的多来源证据装配（与生产同源）。
 *
 * 候选池从题库参考材料确定性派生（分片段 + 词面匹配出 relevance basis），
 * 装配本身走生产分配模块 `buildEvidenceRequiredUnitSourcePlan`——同一
 * 函数、同一白名单判据，实验结论可外推到生产改进。冻结绑定不变：
 * 每条候选携带 sourceRevision（gitRevision），随记录落盘。
 */

import {
  buildEvidenceRequiredUnitSourcePlan,
  cjkBigramsForMatching as cjkBigrams,
  evidenceUnitCitationMappings,
  type KonlingEvidenceAllocationCandidate,
  type KonlingEvidenceAllocationPlan,
} from '@/lib/konling-evidence-allocation';
import {
  evidenceRequiredStudyQuestionSections,
  type StudyQuestionIntent,
} from '@/lib/konling-study-question-structure';

import type {
  KonlingFairExperimentBankItem,
  KonlingFairExperimentCitationSnapshot,
} from './types';

export interface KonlingFairExperimentCitationAssembly {
  plan: KonlingEvidenceAllocationPlan;
  citations: readonly KonlingFairExperimentCitationSnapshot[];
  /** 章节标题 → 分配编号映射（prompt 逐单元渲染与 fixture 绑定共用）。 */
  unitMappings: ReadonlyArray<{ sectionTitle: string; displayNumbers: readonly number[] }>;
  candidates: readonly KonlingEvidenceAllocationCandidate[];
}

function splitReferenceFragments(referenceAnswer: string, limit: number): string[] {
  const clean = (parts: readonly string[]): string[] => (
    parts.map((fragment) => fragment.trim()).filter((fragment) => fragment.length >= 8)
  );
  const paragraphs = clean(referenceAnswer.split(/\n\s*\n/));
  if (paragraphs.length >= 2) return paragraphs.slice(0, limit);
  // 题库参考材料以单换行拼接的带标签行（「最小修复：…」）是天然片段
  // 边界；句子切分会把 limit 耗在长行的前几句上，截掉后面的必需章节。
  const lines = clean(referenceAnswer.split(/\n+/));
  if (lines.length >= 2) return lines.slice(0, limit);
  return clean(referenceAnswer.split(/(?<=[。；;！？])/)).slice(0, limit);
}

function longestCommonRunLength(left: string, right: string): number {
  if (!left || !right) return 0;
  let best = 0;
  const previous = new Array<number>(right.length + 1).fill(0);
  for (let i = 1; i <= left.length; i += 1) {
    let diagonal = 0;
    for (let j = 1; j <= right.length; j += 1) {
      const temp = previous[j];
      if (left[i - 1] === right[j - 1]) {
        previous[j] = (diagonal ?? 0) + 1;
        if (previous[j] > best) best = previous[j];
      } else {
        previous[j] = 0;
      }
      diagonal = temp;
    }
  }
  return best;
}

function sharedBigramCount(left: ReadonlySet<string>, right: ReadonlySet<string>): number {
  let count = 0;
  for (const gram of left) {
    if (right.has(gram)) count += 1;
  }
  return count;
}

function deriveAnswerRelevanceBasis(input: {
  fragment: string;
  question: string;
  intent: StudyQuestionIntent;
}): 'query-exact' | 'query-lexical' | 'semantic-score' {
  const normalizedFragment = input.fragment.toLowerCase().normalize('NFKC');
  const normalizedQuestion = input.question.toLowerCase().normalize('NFKC');
  if (longestCommonRunLength(normalizedFragment, normalizedQuestion) >= 6) return 'query-exact';
  const fragmentGrams = cjkBigrams(input.fragment);
  if (sharedBigramCount(fragmentGrams, cjkBigrams(input.question)) >= 2) return 'query-lexical';
  for (const section of evidenceRequiredStudyQuestionSections(input.intent)) {
    if (sharedBigramCount(fragmentGrams, cjkBigrams(section.title)) >= 1) return 'query-lexical';
  }
  return 'semantic-score';
}

/**
 * 参考材料的可解析来源地址（#2039 review P1）：指向题库真源在生成修订
 * 上的 Git blob 视图——引用可点击核验且被 sourceRevision 冻结，不再
 * 使用不可解析的 `.example` 占位域名充当可访问引用。
 */
function bankSourceHref(bankVersion: string, sourceRevision: string): string {
  const bankFile = bankVersion.includes('v2') ? 'bank-v2.ts' : 'bank.ts';
  // #2039 review P1：`<commit>-dirty` / `unknown` 不是可解析 ref。提取
  // 干净 commit 构建地址；无法提取时回退默认分支视图（引用身份的
  // sourceRevision 仍保留原始标记，真源审计按记录内冻结值进行）。
  const commit = /^([0-9a-f]{40})(?:-dirty)?$/u.exec(sourceRevision)?.[1];
  const ref = commit ?? 'main';
  return `https://github.com/yong-wei/act/blob/${ref}/src/lib/konling-fair-experiment/${bankFile}`;
}

function fragmentCandidate(input: {
  item: KonlingFairExperimentBankItem;
  bankVersion: string;
  sourceRevision: string;
  index: number;
  fragment: string;
}): KonlingEvidenceAllocationCandidate {
  const { item, bankVersion, sourceRevision, index, fragment } = input;
  const anchor = `p${index}`;
  return {
    id: `${item.itemId}:ref-${anchor}`,
    displayTitle: `参考材料片段 ${index + 1}`,
    citationTargetId: `fair-experiment:${bankVersion}:${item.itemId}:${anchor}`,
    verified: true,
    href: bankSourceHref(bankVersion, sourceRevision),
    answerRelevanceBasis: deriveAnswerRelevanceBasis({
      fragment,
      question: item.question,
      intent: item.intent,
    }),
    identity: {
      kind: 'content',
      sourceType: 'content',
      contentId: `${bankVersion}:${item.itemId}:${anchor}`,
      sourceRevision,
    },
    matchText: fragment,
  };
}

/**
 * 装配 full-feature 臂的 citationContext：参考材料片段池 → 生产分配模块
 * → 编号引用快照 + 逐单元映射。`includeAuditEdgeCandidates` 供 fixture
 * 保持 #1951 的审计口径演练（未核验/仅语义/不可访问三类边缘候选，不参与
 * 分配、只进入可用池）；live 装配不包含边缘候选。
 */
export function buildKonlingFairExperimentCitationAssembly(input: {
  item: KonlingFairExperimentBankItem;
  bankVersion: string;
  sourceRevision: string;
}): KonlingFairExperimentCitationAssembly {
  const { item, bankVersion, sourceRevision } = input;
  const requiredCount = evidenceRequiredStudyQuestionSections(item.intent).length;
  const limit = Math.max(4, requiredCount * 3);
  const fragments = splitReferenceFragments(item.referenceAnswer, limit);
  const candidates: KonlingEvidenceAllocationCandidate[] = fragments.map((fragment, index) => (
    fragmentCandidate({ item, bankVersion, sourceRevision, index, fragment })
  ));
  const plan = buildEvidenceRequiredUnitSourcePlan({
    intent: item.intent,
    candidates,
    queryText: item.question,
  });
  const byId = new Map(candidates.map((candidate) => [candidate.id, candidate]));
  const citations: KonlingFairExperimentCitationSnapshot[] = plan.assignedCitations.map((citation) => {
    const candidate = byId.get(citation.id);
    return {
      id: citation.id,
      citationTargetId: candidate?.citationTargetId ?? null,
      verified: candidate?.verified === true,
      displayNumber: citation.displayNumber,
      sourceType: 'content',
      href: citation.href,
      answerRelevanceBasis: candidate?.answerRelevanceBasis ?? null,
    };
  });
  return {
    plan,
    citations,
    unitMappings: evidenceUnitCitationMappings(plan),
    candidates,
  };
}
