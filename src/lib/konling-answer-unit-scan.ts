/**
 * #1902/#1951：答案单元扫描与 citation 绑定的确定性语义（轻模块）。
 *
 * 生产 runtime guard 与公平实验 citation 审计共用同一实现；本模块只
 * 依赖 citation 修复与学习问答结构的纯函数，不引入服务端重链，实验
 * 脚本（tsx/node）可直接 import。
 */

import { isTechnicalIndexContext, markdownCodeRanges } from '@/lib/konling-citation-repair';
import {
  STUDY_QUESTION_SECTIONS,
  detectStudyQuestionSectionHeading,
  type StudyQuestionIntent,
} from '@/lib/konling-study-question-structure';

import type { KonlingCitation } from './konling-agent-runtime';

export interface KonlingAnswerUnitCitationBinding {
  unit: string;
  citationId: string;
  citationTargetId: string | null;
  limitation: string | null;
  sectionId?: string | null;
  sectionTitle?: string | null;
}

export type KonlingAnswerUnitMissReason =
  | 'no-marker'
  | 'marker-unassigned'
  | 'citation-unverified'
  | 'citation-no-target';

/**
 * #1951：公平实验 citation 快照只需要扫描器消费的字段子集。
 * `displayNumber` 放宽为 `number | null | undefined`：生产 runtime 是
 * 可选 number（未分配即缺省），实验冻结快照显式写 null 表示未分配编号；
 * 两种表示在扫描器内等价（非整数编号一律视为未分配）。
 */
export type KonlingAnswerUnitScannableCitation = Pick<
  KonlingCitation,
  'id' | 'citationTargetId' | 'verified' | 'href'
> & { displayNumber?: number | null };

export interface KonlingAnswerUnitRecord {
  unit: string;
  sectionId: string | null;
  bound: boolean;
  substantive: boolean;
  missReason: KonlingAnswerUnitMissReason | null;
}

/** 与公平实验审计共用同一绑定判定：未核验或无锚点的引用不可绑定答案单元。 */
export function isBindableAnswerUnitCitation(citation: KonlingAnswerUnitScannableCitation): boolean {
  return citation.verified === true && Boolean(citation.citationTargetId);
}

export interface KonlingAnswerUnitRecord {
  unit: string;
  sectionId: string | null;
  bound: boolean;
  substantive: boolean;
  missReason: KonlingAnswerUnitMissReason | null;
  /**
   * #1951：该单元行内可绑定标记（verified 且有锚点）对应的 citation id，
   * 供公平实验覆盖分子做绑定级判定（可访问性/直接支撑在审计侧核验）；
   * 生产 guard 不消费此字段。
   */
  bindingCitationIds?: readonly string[];
}

export function assignedCitationNumbers(citations: readonly KonlingAnswerUnitScannableCitation[]): ReadonlySet<number> {
  return new Set(
    citations
      .map((citation) => citation.displayNumber)
      .filter((number): number is number => Number.isInteger(number)),
  );
}

// 结构性行不进入需证据分母（#1902）：引导头、显式过渡短行、纯数学展示行与
// 分隔线不是 substantive 答案单元。规则保守：先剥离尾部引用编号再判定，
// 「短且无终止标点」本身不等同于过渡语——只有显式过渡词开头的短行才排除，
// 宁可分母略大也不把未引用的短结论挤出覆盖统计（#1902 review）。
const STRUCTURAL_TRANSITION_PREFIX = /^(?:接下来|首先|其次|然后|接着|此外|另外|下面|再看|继续|综上|总之)/;

function stripTrailingCitationMarkers(value: string): string {
  return value.replace(/(?:\s*\[\d+\])+\s*$/, '').trim();
}

function isStructuralAnswerUnitLine(trimmedUnit: string): boolean {
  const withoutMarkers = stripTrailingCitationMarkers(trimmedUnit);
  if (/^-{3,}$/.test(withoutMarkers) || /^\*{3,}$/.test(withoutMarkers) || /^_{3,}$/.test(withoutMarkers)) {
    return true;
  }
  if (/[:：]$/.test(withoutMarkers)) return true;
  if (!/[\u4e00-\u9fff]/.test(withoutMarkers)) {
    if (/^\$\$[\s\S]*\$\$$/.test(withoutMarkers)) return true;
    if (/^\\\[.*\\\]$/.test(withoutMarkers)) return true;
    if (/^\\(begin|end)\{/.test(withoutMarkers)) return true;
    if (/\\[a-zA-Z]+/.test(withoutMarkers)) return true;
    if (/^[\w\s^_{}().=<>+\-*/%,.]*$/.test(withoutMarkers) && /[=^_]/.test(withoutMarkers)) return true;
  }
  if (
    withoutMarkers.length <= 20
    && STRUCTURAL_TRANSITION_PREFIX.test(withoutMarkers)
    && !/[。；;！!？?]$/.test(withoutMarkers)
  ) return true;
  return false;
}

// 未绑定需证据单元的原因按证据链顺序取首个可确定环节（#1902）
function resolveAnswerUnitMissReason(
  trustedMarkers: readonly number[],
  citations: readonly KonlingAnswerUnitScannableCitation[],
): KonlingAnswerUnitMissReason {
  if (trustedMarkers.length === 0) return 'no-marker';
  const present = trustedMarkers
    .map((number) => citations.find((candidate) => candidate.displayNumber === number))
    .filter((citation): citation is KonlingCitation => Boolean(citation));
  if (present.length === 0) return 'marker-unassigned';
  if (present.every((citation) => citation.verified !== true)) return 'citation-unverified';
  return 'citation-no-target';
}

export function isCitationMarkerPosition(
  assistantMessage: string,
  codeRanges: readonly { start: number; end: number }[],
  offset: number,
  number: number,
  assignedNumbers: ReadonlySet<number>,
): boolean {
  if (codeRanges.some((range) => offset >= range.start && offset < range.end)) return false;
  // 技术下标豁免统一为明确的变量/集合表达式读法（单字母或集合词），
  // 中文或英文普通词紧邻的编号（含未分配编号）都按引用标记处理（#1949）。
  return !isTechnicalIndexContext(assistantMessage, offset, assignedNumbers.has(number));
}



export function scanKonlingAnswerUnits(
  assistantMessage: string,
  citations: readonly KonlingAnswerUnitScannableCitation[],
  intent?: StudyQuestionIntent,
): {
  bindings: KonlingAnswerUnitCitationBinding[];
  units: KonlingAnswerUnitRecord[];
  driftedMarkerCount: number;
  stackedMarkerCount: number;
  /** #1951：处于有效引用标记位置的唯一编号（按首次出现序），供公平实验引用精确率审计。 */
  presentedNumbers: number[];
} {
  const bindings: KonlingAnswerUnitCitationBinding[] = [];
  const units: KonlingAnswerUnitRecord[] = [];
  let driftedMarkerCount = 0;
  let stackedMarkerCount = 0;
  const presentedNumberSet = new Set<number>();
  const marker = /\[(\d+)\]/g;
  const codeRanges = markdownCodeRanges(assistantMessage);
  const assignedNumbers = assignedCitationNumbers(citations);
  let currentSection: { id: string; title: string } | null = null;
  let lineStart = 0;
  for (const line of assistantMessage.split(/\r?\n/)) {
    try {
      if (intent) {
        const headingSection = detectStudyQuestionSectionHeading(line, intent);
        if (headingSection) {
          currentSection = { id: headingSection.id, title: headingSection.title };
          continue;
        }
      }
      // Fenced/inline code and its fence lines are not substantive answer
      // units and never require per-unit citations (#1819). The fence regex
      // also catches indented fences whose line start falls outside the code
      // range (which begins at the backticks, not the indentation).
      if (/^\s*```/.test(line)) {
        continue;
      }
      if (codeRanges.some((range) => lineStart >= range.start && lineStart < range.end)) {
        continue;
      }
      const trimmedUnit = line.replace(/^\s*(?:[-*]|\d+[.)]|#+)\s*/, '').trim();
      if (!trimmedUnit) continue;
      const substantive = !isStructuralAnswerUnitLine(trimmedUnit);
      const trustedMarkers: number[] = [];
      const perLineNumberCounts = new Map<number, number>();
      const perUnitCitationIds = new Set<string>();
      let bound = false;
      for (const match of line.matchAll(marker)) {
        const markerNumber = Number(match[1]);
        const markerOffset = lineStart + (match.index ?? 0);
        if (!isCitationMarkerPosition(assistantMessage, codeRanges, markerOffset, markerNumber, assignedNumbers)) continue;
        presentedNumberSet.add(markerNumber);
        trustedMarkers.push(markerNumber);
        perLineNumberCounts.set(markerNumber, (perLineNumberCounts.get(markerNumber) ?? 0) + 1);
        const citation = citations.find((candidate) => candidate.displayNumber === markerNumber);
        if (!citation || citation.verified !== true || !citation.citationTargetId) continue;
        // 可绑定 marker 出现在 model-derived 章节或无章节区域时不服务于任何
        // 需证据单元的覆盖，计为漂移（#1902）
        if (intent && (!currentSection
          || STUDY_QUESTION_SECTIONS[intent].find((section) => section.id === currentSection?.id)?.citationPolicy === 'model-derived')) {
          driftedMarkerCount += 1;
        }
        const unit = line.slice(0, match.index ?? 0)
          .replace(/^\s*(?:[-*]|\d+[.)]|#+)\s*/, '')
          .trim()
          .slice(0, 180);
        if (!unit) continue;
        // 只有标记前存在可绑定文本（形成实质绑定）才计入单元的绑定引用，
        // 行首标记（空前缀）不支撑任何主张（#1992 review P1）。
        perUnitCitationIds.add(citation.id);
        if (!bindings.some((binding) => binding.unit === unit && binding.citationId === citation.id)) {
          bindings.push({
            unit,
            citationId: citation.id,
            citationTargetId: citation.citationTargetId,
            limitation: citation.href ? null : 'unavailable-address',
            sectionId: currentSection?.id ?? null,
            sectionTitle: currentSection?.title ?? null,
          });
        }
        bound = true;
      }
      for (const count of perLineNumberCounts.values()) {
        if (count >= 2) stackedMarkerCount += 1;
      }
      units.push({
        unit: trimmedUnit.slice(0, 180),
        sectionId: currentSection?.id ?? null,
        bound,
        substantive,
        missReason: bound || !substantive ? null : resolveAnswerUnitMissReason(trustedMarkers, citations),
        bindingCitationIds: [...perUnitCitationIds],
      });
    } finally {
      lineStart += line.length + 1;
    }
  }
  return {
    bindings,
    units,
    driftedMarkerCount,
    stackedMarkerCount,
    presentedNumbers: [...presentedNumberSet],
  };
}
