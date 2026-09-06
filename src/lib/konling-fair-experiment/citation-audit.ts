/**
 * #1951：公平实验引用精确率与答案单元追溯覆盖率的确定性审计。
 *
 * 输入是冻结回答文本 + 生成阶段持久化的 citation 快照 + 题库意图；
 * 单元划分、结构行过滤与 missReason 语义复用 #1902 已冻结的
 * `scanKonlingAnswerUnits`，本模块只做计数与分类，不引入第二套口径。
 */

import { scanKonlingAnswerUnits } from '@/lib/konling-answer-unit-scan';
import { DIRECT_SUPPORT_RELEVANCE_BASES, isDirectVerifiedSupportCitation } from '@/lib/konling-citation-protocol';
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
 * 直接支撑判据（spec：占位符、未知编号、无法访问的目标与仅相关但不直接
 * 支撑的来源不得计入分子/覆盖）与 relevance-basis 白名单统一真源于
 * `konling-citation-protocol`（#2039）：已核验 + 有锚点 + href 可访问 +
 * 答案相关性证据分级在白名单内。判据只依赖 `answerRelevanceBasis`——
 * `answerRelevanceMatch` 原文在 student pack 脱敏
 * （hybrid-retriever redactStudentItemMetadata）中被有意删除，生产引用
 * 不携带。任一信号缺失或分级未知即降级到对应失败桶，宁可低估也不高估；
 * 主张级蕴含验证超出确定性审计范围（非目标，#1992 review P1）。
 */
function isDirectVerifiedSupport(citation: KonlingFairExperimentCitationInput): boolean {
  return isDirectVerifiedSupportCitation(citation);
}

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
  let modelDerivedCount = 0;
  // spec：模型推导章节单独统计，不与其他漂移混为一类（#1992 review）。
  const modelDerivedSectionIds = new Set(
    sections.filter((section) => section.citationPolicy === 'model-derived').map((section) => section.id),
  );
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
    if (!DIRECT_SUPPORT_RELEVANCE_BASES.has(citation.answerRelevanceBasis ?? '')) {
      citationClasses.citationNoDirectSupport += 1;
      continue;
    }
    // 「是否支撑证据单元」与「是否（同时）出现在 model-derived 章节」是
    // 正交事实：同一编号两边都出现时分别统计，不得由前者短路后者。
    // 章节出现记录用 scan 的 citationSectionUsage（按引用×章节去重），
    // 不受绑定按单元文本去重的影响（#1992 review）。
    const touchesModelDerived = scan.citationSectionUsage.some((usage) => (
      usage.citationId === citation.id
      && usage.sectionId !== null
      && modelDerivedSectionIds.has(usage.sectionId)
    ));
    if (bindingCitationIds.has(citation.id)) {
      citationClasses.realVerifiedSupporting += 1;
      if (touchesModelDerived) modelDerivedCount += 1;
      continue;
    }
    // 未支撑任何 evidence-required substantive 单元：标记（至少部分）
    // 落在 model-derived 章节归模型推导计数，其余（evidence-required
    // 结构行 / 章节外）归通用漂移；均为唯一编号口径。
    if (touchesModelDerived) {
      modelDerivedCount += 1;
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
    // 两者均为唯一编号口径（不叠加 scan.driftedMarkerCount 的出现次数
    // 口径，供生产 guard；同一标记不双计，#1992 review P2）：
    // - modelDerivedMarkerCount：标记（至少部分）落在 model-derived 章节
    // - driftedMarkerCount：其余漂移（evidence-required 结构行 / 章节外）
    driftedMarkerCount: verifiedDrifted,
    modelDerivedMarkerCount: modelDerivedCount,
  };
}

export interface KonlingFairCitationArmAggregate {
  precision: KonlingFairExperimentRatioMetric;
  coverage: KonlingFairExperimentRatioMetric;
  byIntent: ReadonlyArray<{
    intent: StudyQuestionIntent;
    precision: KonlingFairExperimentRatioMetric;
    coverage: KonlingFairExperimentRatioMetric;
    /**
     * #2039：按意图池化的 missReason 分桶（no-marker / marker-unassigned /
     * citation-unverified / citation-no-target），官方摘要按意图导出失败
     * 原因，总体平均不再掩盖单意图失败。
     */
    missReasons: Readonly<Record<string, number>>;
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
      const missReasons: Record<string, number> = {};
      for (const record of scoped) {
        for (const [reason, count] of Object.entries(record.missReasons)) {
          missReasons[reason] = (missReasons[reason] ?? 0) + (count ?? 0);
        }
      }
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
        missReasons,
      };
    }),
  };
}
