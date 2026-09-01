/**
 * 诊断基准指标计算（Issue #1729）：节点级精确率/召回率/F1、宏/微平均、
 * 完全匹配率、首要弱点命中率、健康场景假阳性率与治理合规率。
 *
 * 节点比较语义与生产门一致：以报告知识点 findings（带 knowledgeNodeId）
 * 解析出的薄弱节点集合对照场景真值。
 */

import type {
  DiagnosisBenchmarkAggregateMetrics,
  DiagnosisBenchmarkGroundTruth,
  DiagnosisBenchmarkReplicateEvaluation,
  DiagnosisBenchmarkScenario,
  DiagnosisBenchmarkScenarioMetrics,
} from '@/lib/diagnosis-benchmark/types';

function round4(value: number): number {
  return Math.round(value * 10000) / 10000;
}

function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  return round4(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function stdev(values: number[]): number | null {
  if (values.length === 0) return null;
  const avg = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance = values.reduce((sum, value) => sum + (value - avg) ** 2, 0) / values.length;
  return round4(Math.sqrt(variance));
}

function rate(truth: boolean[]): number {
  if (truth.length === 0) return 1;
  return round4(truth.filter(Boolean).length / truth.length);
}

function nodeLevelSetMetrics(reported: string[], truth: string[]) {
  const reportedSet = new Set(reported);
  const truthSet = new Set(truth);
  let truePositives = 0;
  for (const node of reportedSet) {
    if (truthSet.has(node)) truePositives += 1;
  }
  const precision = reportedSet.size === 0 ? null : round4(truePositives / reportedSet.size);
  const recall = truthSet.size === 0
    ? (reportedSet.size === 0 ? 1 : 0)
    : round4(truePositives / truthSet.size);
  // 空对空（健康场景的理想输出）既无误报也无漏报，按 F1=1 计；
  // 其余无交叠情形 F1=0。
  const f1 = reportedSet.size === 0 && truthSet.size === 0
    ? 1
    : precision === null || precision + recall === 0 ? 0 : round4(2 * precision * recall / (precision + recall));
  return {
    precision,
    recall,
    f1,
    exactMatch: reportedSet.size === truthSet.size && [...reportedSet].every((node) => truthSet.has(node)),
  };
}

export function computeScenarioMetrics(
  scenario: DiagnosisBenchmarkScenario,
  groundTruth: DiagnosisBenchmarkGroundTruth,
  evaluations: DiagnosisBenchmarkReplicateEvaluation[],
): DiagnosisBenchmarkScenarioMetrics {
  const successful = evaluations.filter((entry) => entry.status === 'ok');
  const perReplicate = successful.map((entry) => nodeLevelSetMetrics(entry.reportedNodes, groundTruth.trueWeakNodes));
  const precisions = perReplicate.map((entry) => entry.precision).filter((value): value is number => value !== null);
  const scenarioF1s = perReplicate.map((entry) => entry.f1);
  const primaryHits = successful.map((entry) => (
    groundTruth.primaryWeakNode !== null && entry.primaryReportedNode === groundTruth.primaryWeakNode
  ));
  // 治理合规率只以成功 replicate 为分母（Issue #1749）：被治理门拒绝是
  // 治理生效的证明，由 generationSuccessRate 计数，不得再把合规率拉低；
  // 违规细节保留在 replicate 记录的 failureReason 中可审计。
  // 无成功 replicate 的场景记 1（无输出即无违规输出）。
  const governed = successful.length === 0
    ? { chinese: 1, refs: 1, attribution: 1, coverage: 1 }
    : {
        chinese: rate(successful.map((entry) => entry.chineseCompliant)),
        refs: rate(successful.map((entry) => entry.evidenceRefsValid)),
        attribution: rate(successful.map((entry) => entry.attributionValid)),
        coverage: rate(successful.map((entry) => entry.coverageClaimAccurate)),
      };
  return {
    scenarioId: scenario.id,
    precision: mean(precisions),
    recall: mean(perReplicate.map((entry) => entry.recall)),
    f1: mean(scenarioF1s),
    exactMatchRate: rate(perReplicate.map((entry) => entry.exactMatch)),
    primaryHitRate: groundTruth.primaryWeakNode === null ? null : rate(primaryHits),
    healthyFalsePositiveRate: groundTruth.trueWeakNodes.length > 0
      ? null
      : round4(successful.reduce((sum, entry) => sum + entry.reportedNodes.length, 0) / (scenario.nodeCount * Math.max(successful.length, 1))),
    chineseComplianceRate: governed.chinese,
    evidenceReferenceValidityRate: governed.refs,
    attributionValidityRate: governed.attribution,
    coverageClaimAccuracyRate: governed.coverage,
    generationSuccessRate: rate(evaluations.map((entry) => entry.status === 'ok')),
    replicateCount: evaluations.length,
  };
}

export interface DiagnosisBenchmarkScenarioRun {
  scenario: DiagnosisBenchmarkScenario;
  groundTruth: DiagnosisBenchmarkGroundTruth;
  evaluations: DiagnosisBenchmarkReplicateEvaluation[];
}

export function aggregateBenchmarkMetrics(
  runs: DiagnosisBenchmarkScenarioRun[],
): DiagnosisBenchmarkAggregateMetrics {
  const metrics = runs.map((run) => computeScenarioMetrics(run.scenario, run.groundTruth, run.evaluations));
  const scored = metrics.filter((entry) => entry.replicateCount > 0);

  // 微平均按节点级事件计数：跨场景、跨成功 replicate 汇总 TP/FP/FN。
  let truePositives = 0;
  let falsePositives = 0;
  let falseNegatives = 0;
  for (const run of runs) {
    const truth = new Set(run.groundTruth.trueWeakNodes);
    for (const evaluation of run.evaluations) {
      if (evaluation.status !== 'ok') continue;
      const reported = new Set(evaluation.reportedNodes);
      for (const node of reported) {
        if (truth.has(node)) truePositives += 1;
        else falsePositives += 1;
      }
      for (const node of truth) {
        if (!reported.has(node)) falseNegatives += 1;
      }
    }
  }
  const microPrecision = truePositives + falsePositives === 0
    ? null
    : round4(truePositives / (truePositives + falsePositives));
  const microRecall = truePositives + falseNegatives === 0
    ? null
    : round4(truePositives / (truePositives + falseNegatives));
  const microF1 = microPrecision === null || microRecall === null || microPrecision + microRecall === 0
    ? null
    : round4(2 * microPrecision * microRecall / (microPrecision + microRecall));

  const healthyEntries = scored.filter((entry) => entry.healthyFalsePositiveRate !== null);
  const macroF1Values = scored.map((entry) => entry.f1).filter((value): value is number => value !== null);
  // 重复运行稳定性按逐 replicate F1 事件计算（Issue #1729 review）：
  // 场景均值的标准差衡量的是场景间差异，会掩盖单次调用的大幅波动。
  const replicateF1Values: number[] = [];
  for (const run of runs) {
    for (const evaluation of run.evaluations) {
      if (evaluation.status !== 'ok') continue;
      replicateF1Values.push(nodeLevelSetMetrics(evaluation.reportedNodes, run.groundTruth.trueWeakNodes).f1);
    }
  }
  return {
    microPrecision,
    microRecall,
    microF1,
    macroF1: mean(macroF1Values),
    exactMatchRate: rate(scored.map((entry) => entry.exactMatchRate >= 1)),
    primaryHitRate: mean(scored.map((entry) => entry.primaryHitRate).filter((value): value is number => value !== null)),
    healthyFalsePositiveRate: mean(healthyEntries.map((entry) => entry.healthyFalsePositiveRate ?? 0)),
    chineseComplianceRate: rate(scored.map((entry) => entry.chineseComplianceRate >= 1)),
    evidenceReferenceValidityRate: rate(scored.map((entry) => entry.evidenceReferenceValidityRate >= 1)),
    attributionValidityRate: rate(scored.map((entry) => entry.attributionValidityRate >= 1)),
    coverageClaimAccuracyRate: rate(scored.map((entry) => entry.coverageClaimAccuracyRate >= 1)),
    generationSuccessRate: rate(scored.map((entry) => entry.generationSuccessRate >= 1)),
    scenarioCount: scored.length,
    replicateDispersion: {
      macroF1Stdev: stdev(replicateF1Values),
      macroF1Worst: replicateF1Values.length === 0 ? null : round4(Math.min(...replicateF1Values)),
    },
  };
}
