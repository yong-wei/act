/**
 * #2039：evidence-required 答案单元的生成前逐单元来源分配（确定性模块）。
 *
 * 输入意图合同的 evidence-required 章节 + 检索候选池，输出「章节 →
 * 有序来源分配表」。选择逻辑只用确定性信号：直接支撑 relevance-basis
 * 白名单、章节标题/别名与候选文本的词面重合、查询词命中与
 * `maxPerCitationTarget` 去重；不做模型驱动的分配，保证可回归、可审计。
 * 生产 full-feature 路径与公平实验 full-feature 臂共用同一分配函数。
 */

import { scanKonlingAnswerUnits } from '@/lib/konling-answer-unit-scan';
import {
  assignKonlingCitationDisplayNumbers,
  isDirectVerifiedSupportCitation,
  type KonlingAssignedCitation,
  type KonlingCitationIdentity,
} from '@/lib/konling-citation-protocol';
import {
  detectStudyQuestionSectionHeading,
  evidenceRequiredStudyQuestionSections,
  type StudyQuestionIntent,
} from '@/lib/konling-study-question-structure';

/** 每个必需章节在分配层请求的候选数（预算 = 必需章节数 × 该值）。 */
export const ALLOCATION_CANDIDATES_PER_SECTION = 3;

/** 每个章节除主源外保留的备用来源数上限（供一轮有界补证换源）。 */
export const MAX_ALTERNATES_PER_SECTION = 2;

export interface KonlingEvidenceAllocationCandidate {
  readonly id: string;
  readonly displayTitle: string;
  readonly citationTargetId: string | null;
  readonly verified: boolean;
  readonly href: string | null;
  readonly answerRelevanceBasis: string | null;
  readonly identity: KonlingCitationIdentity;
  /** 章节匹配文本（标题/关键词/摘录）；缺省用 displayTitle。 */
  readonly matchText?: string | null;
}

export interface KonlingEvidenceUnitAssignment {
  readonly sectionId: string;
  readonly sectionTitle: string;
  readonly primaryDisplayNumber: number | null;
  /** 有界补证可换用的备用编号（按分配顺序，已按 canonicalKey 去重）。 */
  readonly alternateDisplayNumbers: readonly number[];
}

export interface KonlingEvidenceAllocationPlan {
  readonly intent: StudyQuestionIntent;
  readonly assignments: readonly KonlingEvidenceUnitAssignment[];
  /** 已编号的完整可用池（主源在前，随后备用，最后未分配候选）。 */
  readonly assignedCitations: readonly KonlingAssignedCitation[];
  readonly unassignedSectionIds: readonly string[];
  /** 分配层按必需章节数放大的检索候选预算（不改全局 profile 默认）。 */
  readonly retrievalBudget: number;
}

export function evidenceAllocationRetrievalBudget(requiredSectionCount: number): number {
  return Math.max(1, requiredSectionCount) * ALLOCATION_CANDIDATES_PER_SECTION;
}

function normaliseForMatch(value: string): string {
  return value.toLowerCase().normalize('NFKC').replace(/[\s\p{P}\p{S}]+/gu, '');
}

function cjkBigrams(value: string): ReadonlySet<string> {
  const normalized = normaliseForMatch(value);
  const grams = new Set<string>();
  const cjkRuns = normalized.match(/[\u4e00-\u9fff]+/g) ?? [];
  for (const run of cjkRuns) {
    if (run.length === 1) {
      grams.add(run);
      continue;
    }
    for (let index = 0; index + 1 < run.length; index += 1) {
      grams.add(run.slice(index, index + 2));
    }
  }
  // 拉丁/数字词整体作为匹配 token（API 名、符号名、条款号）。
  for (const word of normalized.match(/[a-z0-9]{3,}/g) ?? []) {
    grams.add(word);
  }
  return grams;
}

/** 装配层（如公平实验证据池）复用的确定性词面匹配 token 集。 */
export const cjkBigramsForMatching = cjkBigrams;

function overlapRatio(labelGrams: ReadonlySet<string>, textGrams: ReadonlySet<string>): number {
  if (labelGrams.size === 0) return 0;
  let hit = 0;
  for (const gram of labelGrams) {
    if (textGrams.has(gram)) hit += 1;
  }
  return hit / labelGrams.size;
}

function basisRank(basis: string | null): number {
  if (basis === 'query-exact') return 3;
  if (basis && basis !== 'semantic-score') return 2;
  return 0;
}

interface ScoredCandidate {
  candidate: KonlingEvidenceAllocationCandidate;
  score: number;
}

/**
 * 逐单元确定性分配。每个必需章节独立判定候选相关性（章节标题/别名与
 * 候选文本重合 + 查询词证据分级），优先分配未用作主源的候选（一源可
 * 支撑多个确实相关的单元，但池足够时不机械复制）；只有通过直接支撑
 * 白名单的候选可被分配。
 */
export function buildEvidenceRequiredUnitSourcePlan(input: {
  intent: StudyQuestionIntent;
  candidates: readonly KonlingEvidenceAllocationCandidate[];
  /** 查询文本（题面），用于候选与查询的词面重合加分；缺省只用章节匹配。 */
  queryText?: string | null;
}): KonlingEvidenceAllocationPlan {
  const sections = evidenceRequiredStudyQuestionSections(input.intent);
  const queryGrams = input.queryText ? cjkBigrams(input.queryText) : new Set<string>();
  const eligible = input.candidates.filter((candidate) => (
    isDirectVerifiedSupportCitation({
      citationTargetId: candidate.citationTargetId,
      verified: candidate.verified,
      href: candidate.href,
      answerRelevanceBasis: candidate.answerRelevanceBasis,
    })
  ));
  const scoredByText = new Map<string, ReadonlySet<string>>();
  const gramsFor = (candidate: KonlingEvidenceAllocationCandidate): ReadonlySet<string> => {
    const key = candidate.matchText ?? candidate.displayTitle;
    const cached = scoredByText.get(key);
    if (cached) return cached;
    const grams = cjkBigrams(key);
    scoredByText.set(key, grams);
    return grams;
  };

  const usedAsPrimary = new Set<string>();
  const chosen: KonlingEvidenceAllocationCandidate[] = [];
  const chosenKeys = new Set<string>();
  const unassignedSectionIds: string[] = [];
  const perSection: Array<{
    sectionId: string;
    sectionTitle: string;
    ordered: readonly KonlingEvidenceAllocationCandidate[];
  }> = [];

  const scoreCandidate = (candidate: KonlingEvidenceAllocationCandidate, sectionGrams: ReadonlySet<string>): number => {
    const sectionOverlap = overlapRatio(sectionGrams, gramsFor(candidate));
    const queryOverlap = queryGrams.size > 0 ? overlapRatio(queryGrams, gramsFor(candidate)) : 0;
    return basisRank(candidate.answerRelevanceBasis) + 2 * Math.min(1, sectionOverlap) + Math.min(1, queryOverlap);
  };

  for (const section of sections) {
    const sectionGrams = cjkBigrams([section.title, ...section.aliases].join(' '));
    const ranked: ScoredCandidate[] = eligible
      .map((candidate) => ({ candidate, score: scoreCandidate(candidate, sectionGrams) }))
      .sort((left, right) => (
        right.score - left.score
        || left.candidate.id.localeCompare(right.candidate.id)
      ));
    const ordered: KonlingEvidenceAllocationCandidate[] = [];
    const seenKeys = new Set<string>();
    const push = (candidate: KonlingEvidenceAllocationCandidate) => {
      const key = candidate.id;
      if (seenKeys.has(key)) return;
      seenKeys.add(key);
      ordered.push(candidate);
    };
    // 先取未用作主源的候选（分数降序），再允许复用已主源候选——池足够
    // 时刻意分散来源，池不足时同一来源可在确实相关的多个单元复用。
    for (const { candidate } of ranked) {
      if (ordered.length >= 1 + MAX_ALTERNATES_PER_SECTION) break;
      if (!usedAsPrimary.has(candidate.id)) push(candidate);
    }
    for (const { candidate } of ranked) {
      if (ordered.length >= 1 + MAX_ALTERNATES_PER_SECTION) break;
      push(candidate);
    }
    if (ordered.length === 0) {
      unassignedSectionIds.push(section.id);
      continue;
    }
    perSection.push({ sectionId: section.id, sectionTitle: section.title, ordered });
    usedAsPrimary.add(ordered[0].id);
    for (const candidate of ordered) {
      if (!chosenKeys.has(candidate.id)) {
        chosenKeys.add(candidate.id);
        chosen.push(candidate);
      }
    }
  }
  for (const candidate of input.candidates) {
    if (!chosenKeys.has(candidate.id)) {
      chosenKeys.add(candidate.id);
      chosen.push(candidate);
    }
  }

  const assignedCitations = assignKonlingCitationDisplayNumbers(chosen.map((candidate) => ({
    id: candidate.id,
    sourceType: candidate.identity.kind === 'textbook'
      ? 'textbook' as const
      : candidate.identity.kind === 'content' ? 'content' as const : candidate.identity.sourceType,
    displayTitle: candidate.displayTitle,
    href: candidate.href,
    identity: candidate.identity,
    confidence: 'medium' as const,
    evidenceBasis: candidate.answerRelevanceBasis ?? 'unspecified',
  })));
  const numberById = new Map(assignedCitations.map((citation) => [citation.id, citation.displayNumber]));

  return {
    intent: input.intent,
    assignments: sections.map((section) => {
      const entry = perSection.find((row) => row.sectionId === section.id);
      if (!entry) {
        return { sectionId: section.id, sectionTitle: section.title, primaryDisplayNumber: null, alternateDisplayNumbers: [] };
      }
      return {
        sectionId: section.id,
        sectionTitle: section.title,
        primaryDisplayNumber: numberById.get(entry.ordered[0].id) ?? null,
        alternateDisplayNumbers: entry.ordered
          .slice(1)
          .map((candidate) => numberById.get(candidate.id))
          .filter((number): number is number => typeof number === 'number'),
      };
    }),
    assignedCitations,
    unassignedSectionIds,
    retrievalBudget: evidenceAllocationRetrievalBudget(sections.length),
  };
}

export interface KonlingEvidenceRepairResult {
  body: string;
  repairedUnitCount: number;
  /** 存在可分配来源但补证后仍有缺口的章节（无来源章节不参与补证）。 */
  unrepairedSectionIds: readonly string[];
}

/**
 * 生成后一轮有界补证（#2039，确定性、不调用模型）：对 evidence-required
 * 章节内未绑定直接支撑引用的实质单元行，按分配表追加该章节的主源编号
 * （主源不可用时用备用编号）；无分配来源的章节不参与补证，保持 #2017
 * fail-closed 降级。补证只追加真实分配编号，不伪造标记。
 */
export function repairUncoveredEvidenceUnits(input: {
  answer: string;
  intent: StudyQuestionIntent;
  citations: ReadonlyArray<{
    id: string;
    displayNumber?: number | null;
    verified: boolean;
    citationTargetId: string | null;
    href: string | null;
    answerRelevanceBasis?: string | null;
  }>;
  plan: KonlingEvidenceAllocationPlan;
}): KonlingEvidenceRepairResult {
  const directSupportNumbers = new Set(
    input.citations
      .filter((citation) => (
        isDirectVerifiedSupportCitation(citation)
        && Number.isInteger(citation.displayNumber)
      ))
      .map((citation) => citation.displayNumber as number),
  );
  const directSupportIds = new Set(
    input.citations
      .filter((citation) => isDirectVerifiedSupportCitation(citation))
      .map((citation) => citation.id),
  );
  const requiredSections = new Map(
    evidenceRequiredStudyQuestionSections(input.intent).map((section) => [section.id, section]),
  );
  const assignmentBySection = new Map(input.plan.assignments.map((row) => [row.sectionId, row]));
  const scan = scanKonlingAnswerUnits(input.answer, input.citations, input.intent);
  // 覆盖口径与审计一致：bound 但仅绑定 semantic-score 等非直接支撑引用的
  // 单元同样视为未覆盖，参与一轮补证（#2017 review P1 的执行侧对齐）。
  const unboundUnits = scan.units.filter((unit) => (
    unit.substantive
    && unit.sectionId !== null
    && requiredSections.has(unit.sectionId)
    && (unit.bindingCitationIds ?? []).every((id) => !directSupportIds.has(id))
  ));
  if (unboundUnits.length === 0) {
    return { body: input.answer, repairedUnitCount: 0, unrepairedSectionIds: [] };
  }
  const unboundTexts = new Set(unboundUnits.map((unit) => unit.unit));

  const numberForSection = (sectionId: string): number | null => {
    const assignment = assignmentBySection.get(sectionId);
    if (!assignment) return null;
    if (assignment.primaryDisplayNumber !== null && directSupportNumbers.has(assignment.primaryDisplayNumber)) {
      return assignment.primaryDisplayNumber;
    }
    return assignment.alternateDisplayNumbers.find((number) => directSupportNumbers.has(number)) ?? null;
  };

  const repairedSections = new Set<string>();
  const unrepaired = new Set<string>();
  let repairedUnitCount = 0;
  const rebuilt: string[] = [];
  let currentSectionId: string | null = null;
  for (const line of input.answer.split(/\r?\n/)) {
    const heading = detectStudyQuestionSectionHeading(line, input.intent);
    if (heading) {
      currentSectionId = heading.id;
      rebuilt.push(line);
      continue;
    }
    const normalized = line.replace(/^\s*(?:[-*]|\d+[.)]|#+)\s*/, '').trim().slice(0, 180);
    if (
      currentSectionId !== null
      && requiredSections.has(currentSectionId)
      && unboundTexts.has(normalized)
      && normalized.length > 0
    ) {
      const number = numberForSection(currentSectionId);
      if (number === null) {
        unrepaired.add(currentSectionId);
        rebuilt.push(line);
        continue;
      }
      repairedSections.add(currentSectionId);
      repairedUnitCount += 1;
      rebuilt.push(`${line.replace(/\s+$/u, '')} [${number}]`);
      continue;
    }
    rebuilt.push(line);
  }
  return {
    body: rebuilt.join('\n'),
    repairedUnitCount,
    unrepairedSectionIds: [...unrepaired].sort(),
  };
}

/** 章节标题 → 分配编号映射（prompt 逐单元渲染用；未分配章节不出现）。 */
export function evidenceUnitCitationMappings(
  plan: KonlingEvidenceAllocationPlan,
): Array<{ sectionTitle: string; displayNumbers: readonly number[] }> {
  return plan.assignments
    .filter((assignment) => assignment.primaryDisplayNumber !== null)
    .map((assignment) => ({
      sectionTitle: assignment.sectionTitle,
      displayNumbers: [
        assignment.primaryDisplayNumber as number,
        ...assignment.alternateDisplayNumbers,
      ],
    }));
}

/** 供调用方组装审计快照：按候选 id 回查 relevance basis 与核验状态。 */
export function evidenceCandidateFacts(
  candidates: readonly KonlingEvidenceAllocationCandidate[],
): ReadonlyMap<string, { verified: boolean; href: string | null; answerRelevanceBasis: string | null }> {
  return new Map(candidates.map((candidate) => [
    candidate.id,
    { verified: candidate.verified, href: candidate.href, answerRelevanceBasis: candidate.answerRelevanceBasis },
  ]));
}
