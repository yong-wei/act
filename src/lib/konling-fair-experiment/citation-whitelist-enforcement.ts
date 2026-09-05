/**
 * #2017：正式回答送达前的引用编号白名单校验与确定性修复。
 *
 * 语义与 `normalizeKonlingCitations`（#1949）一致：只接受分配编号；
 * 未分配编号删除标记并把对应结论降级为待核验。本模块是公平实验
 * runner 在写盘前的同步防线（不调用模型、不产生第二套口径），
 * 复用 `markdownCodeRanges` / `isTechnicalIndexContext` 的既有判定。
 */

import { createHash } from 'node:crypto';

import {
  isTechnicalIndexContext,
  markdownCodeRanges,
} from '@/lib/konling-citation-repair';

const CITATION_NUMBER_MARKER = /\[(\d+)\]/g;

export interface KonlingCitationWhitelistEnforcementResult {
  body: string;
  /** 被删除的未分配编号标记（含方括号原文，按首次出现序去重）。 */
  removedMarkers: string[];
  /** 因伪编号删除而被降级的结论数（按被删标记出现次数计）。 */
  demotedClaimCount: number;
  downgraded: boolean;
  bodyHash: string;
}

/**
 * 编号白名单校验：`[n]` 只有 n 在分配集合内才保留；代码块与技术下标
 * （a[2]、arr[3] 等变量/集合读法）不按引用标记处理。无法修复的未分配
 * 编号删除标记，其后紧跟的结论视为失去引用支撑（由调用方按待核验
 * 呈现——删除标记本身就是降级，不在正文伪造「已核验」标记）。
 */
export function enforceKonlingCitationNumberWhitelist(input: {
  answer: string;
  citations: ReadonlyArray<{ displayNumber: number | null }>;
}): KonlingCitationWhitelistEnforcementResult {
  const assigned = new Set(
    input.citations
      .map((citation) => citation.displayNumber)
      .filter((number): number is number => typeof number === 'number' && Number.isInteger(number)),
  );
  const codeRanges = markdownCodeRanges(input.answer);
  const removedMarkers: string[] = [];
  let demotedClaimCount = 0;

  const body = input.answer.replace(CITATION_NUMBER_MARKER, (raw, value: string, offset: number) => {
    const number = Number(value);
    if (assigned.has(number)) return raw;
    if (codeRanges.some((range) => offset >= range.start && offset < range.end)) return raw;
    if (isTechnicalIndexContext(input.answer, offset, assigned.has(number))) return raw;
    if (!removedMarkers.includes(raw)) removedMarkers.push(raw);
    demotedClaimCount += 1;
    return '';
  });

  return {
    body,
    removedMarkers,
    demotedClaimCount,
    downgraded: demotedClaimCount > 0,
    bodyHash: createHash('sha256').update(body).digest('hex'),
  };
}

export interface KonlingAnswerUnitCoverageEnforcementResult {
  body: string;
  coverageRepaired: boolean;
}

const COVERAGE_REPAIR_NOTICE = [
  '> 证据缺口说明：以下结论缺少可核验引用，按待核验处理，不作为已核验事实。',
].join('\n');

/**
 * 答案单元覆盖的有界修复（一次、确定性）：必需证据单元存在覆盖缺口时
 * 在回答尾部追加显式证据缺口说明，把未覆盖结论降级为待核验——不在正文
 * 伪造引用标记，也不把未核验来源升级为已核验权威来源（规范类回答的
 * verification-required 语义保持）。
 */
export function enforceAnswerUnitCitationCoverage(input: {
  answer: string;
  requiredUnitCount: number;
  coveredUnitCount: number;
  normativeGuidance?: 'verification-required' | 'not-applicable' | null;
}): KonlingAnswerUnitCoverageEnforcementResult {
  const missing = input.requiredUnitCount - input.coveredUnitCount;
  if (input.requiredUnitCount === 0 || missing <= 0) {
    return { body: input.answer, coverageRepaired: false };
  }
  const notice = input.normativeGuidance === 'verification-required'
    ? `${COVERAGE_REPAIR_NOTICE}\n> 规范类结论须经权威来源核验后才能作为已核验结论使用；当前缺失的引用不构成核验。`
    : COVERAGE_REPAIR_NOTICE;
  return {
    body: `${input.answer.trimEnd()}\n\n${notice}`,
    coverageRepaired: true,
  };
}
