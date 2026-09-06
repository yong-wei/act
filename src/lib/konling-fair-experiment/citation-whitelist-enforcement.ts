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

/**
 * 直接支撑判据与 citation-audit 的 isDirectVerifiedSupport 同一口径
 * （#2017 review P1）：verified + 锚点 + href 可访问 + 相关性证据分级
 * 在白名单内。语义相似（semantic-score）与缺失/未知值按「仅相关」处理。
 */
const DIRECT_SUPPORT_RELEVANCE_BASES: ReadonlySet<string> = new Set([
  'selected-node-ref',
  'capability-target-ref',
  'resource-ref',
  'learner-context-ref',
  'query-exact',
  'query-lexical',
]);

export function isDirectVerifiedSupportCitation(citation: {
  citationTargetId: string | null;
  verified: boolean;
  href: string | null;
  answerRelevanceBasis?: string | null;
}): boolean {
  return citation.verified === true
    && Boolean(citation.citationTargetId)
    && Boolean(citation.href)
    && DIRECT_SUPPORT_RELEVANCE_BASES.has(citation.answerRelevanceBasis ?? '');
}

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
  /** 删除伪编号后对所在断言行原地降级（#2017 review：仅删标记不构成待核验呈现）。 */
  demoteClaim?: (line: string) => string;
}): KonlingCitationWhitelistEnforcementResult {
  const assigned = new Set(
    input.citations
      .map((citation) => citation.displayNumber)
      .filter((number): number is number => typeof number === 'number' && Number.isInteger(number)),
  );
  const codeRanges = markdownCodeRanges(input.answer);
  const removedMarkers: string[] = [];
  let demotedClaimCount = 0;
  // 单遍行重建（#2017 review R3）：先按行聚合判定结果，再逐行生成输出——
  // 不做「先 replace 后按原始偏移回写」（原始偏移在已缩短文本上失效），
  // 也不对整行无差别剥 `[数字]`（会误删同行的合法引用与技术下标）。
  interface LinePlan {
    demoted: boolean;
  }
  const linePlans = new Map<number, LinePlan>();
  input.answer.replace(CITATION_NUMBER_MARKER, (raw, value: string, offset: number) => {
    const number = Number(value);
    if (assigned.has(number)) return raw;
    if (codeRanges.some((range) => offset >= range.start && offset < range.end)) return raw;
    if (isTechnicalIndexContext(input.answer, offset, assigned.has(number))) return raw;
    if (!removedMarkers.includes(raw)) removedMarkers.push(raw);
    demotedClaimCount += 1;
    const lineStart = input.answer.lastIndexOf('\n', offset) + 1;
    if (!linePlans.has(lineStart)) linePlans.set(lineStart, { demoted: false });
    linePlans.get(lineStart)!.demoted = true;
    return '';
  });

  const lines = input.answer.split('\n');
  const rebuilt: string[] = [];
  let cursor = 0;
  for (const line of lines) {
    const plan = linePlans.get(cursor);
    if (plan?.demoted) {
      // 只删除本行被判定为伪编号的具体 occurrence：重新在该行内逐标记
      // 判定，合法引用与技术下标原样保留；有 demoteClaim 时整行降级，
      // 无 demoteClaim 时仅删除伪编号标记（原有行为，#2017 review R3）。
      const lineStart = cursor;
      let rebuiltLine = '';
      let lastIndex = 0;
      for (const match of line.matchAll(CITATION_NUMBER_MARKER)) {
        const markerOffset = lineStart + (match.index ?? 0);
        const number = Number(match[1]);
        const isFake = !assigned.has(number)
          && !codeRanges.some((range) => markerOffset >= range.start && markerOffset < range.end)
          && !isTechnicalIndexContext(input.answer, markerOffset, assigned.has(number));
        if (isFake) {
          rebuiltLine += line.slice(lastIndex, match.index);
          lastIndex = (match.index ?? 0) + match[0].length;
        }
      }
      rebuiltLine += line.slice(lastIndex);
      rebuilt.push(input.demoteClaim ? input.demoteClaim(rebuiltLine) : rebuiltLine);
    } else {
      rebuilt.push(line);
    }
    cursor += line.length + 1;
  }
  const body = rebuilt.join('\n');

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

const COVERAGE_REPAIR_NOTICE = '[引用缺口：本节存在缺少可核验引用的结论，按待核验处理，不作为已核验事实。]';
const NORMATIVE_COVERAGE_REPAIR_NOTICE = '[引用缺口：本节存在缺少可核验引用的规范类结论，按待核验处理；缺失的引用不构成核验，不得作为已核验结论使用。]';
const DEMOTED_CLAIM_SUFFIX = '[引用缺口：待核验]';

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
    ? NORMATIVE_COVERAGE_REPAIR_NOTICE
    : COVERAGE_REPAIR_NOTICE;
  return {
    body: `${input.answer.trimEnd()}\n\n${notice}`,
    coverageRepaired: true,
  };
}
