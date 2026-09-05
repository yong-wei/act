/**
 * #1951：公平实验引用精确率与答案单元追溯覆盖率的确定性审计。
 *
 * 输入是冻结回答文本 + 生成阶段持久化的 citation 快照 + 题库意图；
 * 单元划分、结构行过滤与 missReason 语义复用 #1902 已冻结的
 * `scanKonlingAnswerUnits`，本模块只做计数与分类，不引入第二套口径。
 */

import { scanKonlingAnswerUnits } from '@/lib/konling-answer-unit-scan';
import {
  STUDY_QUESTION_SECTIONS,
  type StudyQuestionIntent,
} from '@/lib/konling-study-question-structure';

import type {
  KonlingFairExperimentArm,
  KonlingFairExperimentCitationAuditRecord,
  KonlingFairExperimentRatioMetric,
} from './types';

export interface KonlingFairCitationAuditInput {
  taskKey: string;
  arm: KonlingFairExperimentArm;
  itemId: string;
  replicate: number;
  intent: StudyQuestionIntent;
  answer: string;
  citations: readonly KonlingFairExperimentCitationInput[];
}

export interface KonlingFairExperimentCitationInput {
  id: string;
  citationTargetId: string | null;
  verified: boolean;
  displayNumber: number | null;
  sourceType: string;
  href: string | null;
  answerRelevanceMatch?: string | null;
  answerRelevanceBasis?: string | null;
}

function ratio(numerator: number, denominator: number): KonlingFairExperimentRatioMetric {
  return { numerator, denominator, ratio: denominator === 0 ? 0 : numerator / denominator };
}

/**
 * 检索相关性的纯语义证据：只证明来源与问题相似，不证明支撑任何具体
 * 主张（生产 hybrid-retriever 的 semantic-score 分数桶）。
 */
const PURE_SEMANTIC_RELEVANCE_BASIS = 'semantic-score';

/**
 * 直接支撑判据（spec：占位符、未知编号、无法访问的目标与仅相关但不
 * 直接支撑的来源不得计入分子/覆盖）：已核验 + 有锚点 + href 可访问 +
 * 快照冻结答案相关性证据且分级为显式引用/查询直接命中（排除纯语义
 * 相似）。任一信号缺失或仅为语义相似即降级到对应失败桶，宁可低估也
 * 不高估。判据上限是生产端引用核验 + 直接选中证据；主张级蕴含验证
 * 超出确定性审计范围（非目标，#1992 review P1）。
 */
function isDirectVerifiedSupport(citation: KonlingFairExperimentCitationInput): boolean {
  return citation.verified === true
    && Boolean(citation.citationTargetId)
    && Boolean(citation.href)
    && Boolean(citation.answerRelevanceMatch)
    && citation.answerRelevanceBasis !== PURE_SEMANTIC_RELEVANCE_BASIS;
}

/**
 * 单条回答的确定性审计。占位符（未分配编号）、未核验引用、无锚点或
 * 不可访问引用、仅相关无直接支撑证据引用与 model-derived 章节标记分别
 * 统计；只有通过 `isDirectVerifiedSupport` 且绑定到 evidence-required
 * substantive 单元的引用计入精确率分子，单元覆盖只认可绑定标记中的
 * 直接支撑引用（`scanKonlingAnswerUnits` 的绑定语义 + 审计侧核验）。
 */
export function auditKonlingFairCitationRecord(
  input: KonlingFairCitationAuditInput,
): KonlingFairExperimentCitationAuditRecord {
  const scan = scanKonlingAnswerUnits(input.answer, input.citations, input.intent);

  // 已呈现引用 = scan 判定处于有效引用标记位置的唯一编号（代码块与
  // 技术下标位置已在 scan 内排除，口径与生产 guard 一致）。
  const presentedNumbers = new Set(scan.presentedNumbers);

  const sections = STUDY_QUESTION_SECTIONS[input.intent];
  const requiredUnits = scan.units.filter((unit) => (
    unit.substantive
    && unit.sectionId !== null
    && sections.some((section) => section.id === unit.sectionId && section.citationPolicy === 'evidence-required')
  ));
  // 单元覆盖只认可「该单元行内可绑定标记中存在直接支撑引用」的单元；
  // 绑定到不可访问/仅相关引用的单元仍 bound（#1902 语义）但不计覆盖。
  const directSupportIds = new Set(input.citations.filter(isDirectVerifiedSupport).map((citation) => citation.id));
  const coveredUnits = requiredUnits.filter((unit) => (
    (unit.bindingCitationIds ?? []).some((id) => directSupportIds.has(id))
  ));

  // 精确率分子与覆盖分子同源：只有支撑了至少一个 evidence-required
  // substantive 单元的直接引用才算「已核验直接支撑」。仅标在结构行
  // （引导头/过渡语等 substantive=false）上的绑定不支撑任何实质主张，
  // 不入分子（#1992 review P1）；model-derived / 无章节区域的绑定计为
  // 漂移，同样不入分子。
  const bindingCitationIds = new Set(
    requiredUnits.flatMap((unit) => (unit.bindingCitationIds ?? []).filter((id) => directSupportIds.has(id))),
  );
  const citationClasses = {
    realVerifiedSupporting: 0,
    markerUnassigned: 0,
    citationUnverified: 0,
    citationNoTarget: 0,
    citationNoDirectSupport: 0,
  };
  let verifiedDrifted = 0;
  for (const number of presentedNumbers) {
    const citation = input.citations.find((candidate) => candidate.displayNumber === number);
    if (!citation) {
      citationClasses.markerUnassigned += 1;
      continue;
    }
    if (citation.verified !== true) {
      citationClasses.citationUnverified += 1;
      continue;
    }
    if (!citation.citationTargetId || !citation.href) {
      citationClasses.citationNoTarget += 1;
      continue;
    }
    if (!citation.answerRelevanceMatch || citation.answerRelevanceBasis === PURE_SEMANTIC_RELEVANCE_BASIS) {
      citationClasses.citationNoDirectSupport += 1;
      continue;
    }
    if (bindingCitationIds.has(citation.id)) {
      citationClasses.realVerifiedSupporting += 1;
    } else {
      verifiedDrifted += 1;
    }
  }

  const missReasons: Record<string, number> = {};
  for (const unit of requiredUnits) {
    if (unit.bound || !unit.missReason) continue;
    missReasons[unit.missReason] = (missReasons[unit.missReason] ?? 0) + 1;
  }

  return {
    taskKey: input.taskKey,
    arm: input.arm,
    itemId: input.itemId,
    replicate: input.replicate,
    intent: input.intent,
    presentedCitationCount: presentedNumbers.size,
    verifiedSupportingCount: citationClasses.realVerifiedSupporting,
    requiredUnitCount: requiredUnits.length,
    coveredUnitCount: coveredUnits.length,
    citationClasses,
    missReasons,
    // 唯一编号口径：已核验、可访问、有直接支撑证据、已呈现，但未绑定
    // 任何 evidence-required 单元的引用数（多数落在 model-derived 章节）。
    // 不叠加 scan.driftedMarkerCount（出现次数口径，供生产 guard）——
    // 同一标记会被双计（#1992 review P2）。
    driftedMarkerCount: verifiedDrifted,
  };
}

export interface KonlingFairCitationArmAggregate {
  precision: KonlingFairExperimentRatioMetric;
  coverage: KonlingFairExperimentRatioMetric;
  byIntent: ReadonlyArray<{
    intent: StudyQuestionIntent;
    precision: KonlingFairExperimentRatioMetric;
    coverage: KonlingFairExperimentRatioMetric;
  }>;
}

/** 池化聚合：臂级比率 = Σ分子 / Σ分母（与既有 rate 指标的池化口径一致）。 */
export function aggregateKonlingFairCitationAudit(
  records: readonly KonlingFairExperimentCitationAuditRecord[],
): KonlingFairCitationArmAggregate {
  const sum = (values: readonly number[]): number => values.reduce((total, value) => total + value, 0);
  const precisionNumerator = sum(records.map((record) => record.verifiedSupportingCount));
  const precisionDenominator = sum(records.map((record) => record.presentedCitationCount));
  const coverageNumerator = sum(records.map((record) => record.coveredUnitCount));
  const coverageDenominator = sum(records.map((record) => record.requiredUnitCount));

  const intents = [...new Set(records.map((record) => record.intent))];
  return {
    precision: ratio(precisionNumerator, precisionDenominator),
    coverage: ratio(coverageNumerator, coverageDenominator),
    byIntent: intents.map((intent) => {
      const scoped = records.filter((record) => record.intent === intent);
      return {
        intent,
        precision: ratio(
          sum(scoped.map((record) => record.verifiedSupportingCount)),
          sum(scoped.map((record) => record.presentedCitationCount)),
        ),
        coverage: ratio(
          sum(scoped.map((record) => record.coveredUnitCount)),
          sum(scoped.map((record) => record.requiredUnitCount)),
        ),
      };
    }),
  };
}
