/**
 * #1951：公平实验引用精确率与答案单元追溯覆盖率的确定性审计。
 *
 * 输入是冻结回答文本 + 生成阶段持久化的 citation 快照 + 题库意图；
 * 单元划分、结构行过滤与 missReason 语义复用 #1902 已冻结的
 * `scanKonlingAnswerUnits`，本模块只做计数与分类，不引入第二套口径。
 */

import {
  scanKonlingAnswerUnits,
  type KonlingAnswerUnitScannableCitation,
} from '@/lib/konling-answer-unit-scan';
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
}

function ratio(numerator: number, denominator: number): KonlingFairExperimentRatioMetric {
  return { numerator, denominator, ratio: denominator === 0 ? 0 : numerator / denominator };
}

/**
 * 单条回答的确定性审计。占位符（未分配编号）、未核验引用、无锚点引用
 * 与 model-derived 章节标记分别统计；只有绑定到 evidence-required
 * substantive 单元的已核验引用计入精确率分子，任何单元覆盖只认可绑定
 * 标记（`scanKonlingAnswerUnits` 的 bound 语义）。
 */
export function auditKonlingFairCitationRecord(
  input: KonlingFairCitationAuditInput,
): KonlingFairExperimentCitationAuditRecord {
  const scannable: readonly KonlingAnswerUnitScannableCitation[] = input.citations;
  const scan = scanKonlingAnswerUnits(input.answer, scannable, input.intent);

  // 已呈现引用 = scan 判定处于有效引用标记位置的唯一编号（代码块与
  // 技术下标位置已在 scan 内排除，口径与生产 guard 一致）。
  const presentedNumbers = new Set(scan.presentedNumbers);

  const sections = STUDY_QUESTION_SECTIONS[input.intent];
  const requiredUnits = scan.units.filter((unit) => (
    unit.substantive
    && unit.sectionId !== null
    && sections.some((section) => section.id === unit.sectionId && section.citationPolicy === 'evidence-required')
  ));
  const coveredUnits = requiredUnits.filter((unit) => unit.bound);

  // 只有绑定落在 evidence-required 章节的引用才算「直接支撑」；
  // model-derived / 无章节区域的绑定计为漂移，不入精确率分子。
  const bindingCitationIds = new Set(
    scan.bindings
      .filter((binding) => binding.sectionId !== null
        && sections.some((section) => section.id === binding.sectionId && section.citationPolicy === 'evidence-required'))
      .map((binding) => binding.citationId),
  );
  const citationClasses = {
    realVerifiedSupporting: 0,
    markerUnassigned: 0,
    citationUnverified: 0,
    citationNoTarget: 0,
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
    if (!citation.citationTargetId) {
      citationClasses.citationNoTarget += 1;
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
    driftedMarkerCount: scan.driftedMarkerCount + verifiedDrifted,
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
