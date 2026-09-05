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
 * 直接支撑的答案相关性证据分级白名单（生产 hybrid-retriever 的
 * basis）：显式引用（selected-node-ref / capability-target-ref /
 * resource-ref / learner-context-ref）与查询词直接命中（query-exact /
 * query-lexical）。纯语义相似（semantic-score）只是检索级相关；缺失或
 * 未知的 basis 证据不足——一律不算直接支撑（白名单，未知值保守拒绝，
 * #1992 review P1）。
 */
const DIRECT_SUPPORT_RELEVANCE_BASES: ReadonlySet<string> = new Set([
  'selected-node-ref',
  'capability-target-ref',
  'resource-ref',
  'learner-context-ref',
  'query-exact',
  'query-lexical',
]);

/**
 * 直接支撑判据（spec：占位符、未知编号、无法访问的目标与仅相关但不
 * 直接支撑的来源不得计入分子/覆盖）：已核验 + 有锚点 + href 可访问 +
 * 答案相关性证据分级在白名单内（显式引用/查询直接命中）。判据只依赖
 * `answerRelevanceBasis`——`answerRelevanceMatch` 原文在 student pack
 * 脱敏（hybrid-retriever redactStudentItemMetadata）中被有意删除，
 * 生产引用不携带；basis 是脱敏后仍保留的非敏感证明类型。任一信号
 * 缺失或分级未知即降级到对应失败桶，宁可低估也不高估。判据上限是
 * 生产端引用核验 + 直接选中证据；主张级蕴含验证超出确定性审计范围
 * （非目标，#1992 review P1）。
 */
function isDirectVerifiedSupport(citation: KonlingFairExperimentCitationInput): boolean {
  return citation.verified === true
    && Boolean(citation.citationTargetId)
    && Boolean(citation.href)
    && DIRECT_SUPPORT_RELEVANCE_BASES.has(citation.answerRelevanceBasis ?? '');
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
    // 正交事实：同一编号两边都出现时分别统计，不得由前者短路后者
    // （#1992 review）。
    const touchesModelDerived = scan.bindings.some((binding) => (
      binding.citationId === citation.id
      && binding.sectionId != null
      && modelDerivedSectionIds.has(binding.sectionId)
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
