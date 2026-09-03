/**
 * 诊断基准评测 runner 核心（Issue #1729）。
 *
 * fixture 模式注入确定性 provider stub（含健康场景过度诊断负样本），
 * live 模式由调用方注入真实 provider 包装；两种模式共用同一套治理
 * 重放（复用生产语言门、证据引用、归因与薄弱校准门函数）与指标
 * 计算。输出以统一 run ID 落盘，目录只增不改。
 */

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import {
  buildKnowledgeNodeByEvidenceRef,
  buildKnowledgeNodeWeaknessStats,
  enforceDiagnosisFindingCalibration,
  enforceDiagnosisFindingNodeAttribution,
  enforceLimitationCoverageConsistency,
  enforceRiskFlagCoverageSemantics,
  validateDiagnosisReportBodyLanguage,
} from '@/lib/diagnosis-generation-provider';
import {
  DIAGNOSIS_BENCHMARK_SCENARIOS,
  benchmarkGroundTruth,
} from '@/lib/diagnosis-benchmark/scenarios';
import { materializeScenario } from '@/lib/diagnosis-benchmark/generate';
import {
  aggregateBenchmarkMetrics,
  computeScenarioMetrics,
  type DiagnosisBenchmarkScenarioRun,
} from '@/lib/diagnosis-benchmark/metrics';
import type {
  DiagnosisBenchmarkCandidateFinding,
  DiagnosisBenchmarkCandidateReport,
  DiagnosisBenchmarkGovernedInput,
  DiagnosisBenchmarkGroundTruth,
  DiagnosisBenchmarkReplicateEvaluation,
  DiagnosisBenchmarkScenario,
} from '@/lib/diagnosis-benchmark/types';

export const DIAGNOSIS_BENCHMARK_THRESHOLD = {
  microPrecision: 0.8,
  microRecall: 0.8,
  macroF1: 0.8,
  exactMatchRate: 0.75,
  primaryHitRate: 0.85,
  healthyFalsePositiveRate: 0.1,
  complianceRate: 1,
  coverageClaimAccuracyRate: 0.95,
  scenarioMinimumSuccessfulReplicates: 1,
} as const;

export type DiagnosisBenchmarkGenerate = (context: {
  scenario: DiagnosisBenchmarkScenario;
  governedInput: DiagnosisBenchmarkGovernedInput;
  groundTruth: DiagnosisBenchmarkGroundTruth;
  replicate: number;
}) => Promise<
  | { ok: true; report: DiagnosisBenchmarkCandidateReport; rawOutput?: unknown; durationMs: number }
  | { ok: false; reason: string; rawOutput?: unknown; durationMs: number }
>;

export interface DiagnosisBenchmarkVersionInfo {
  mode: 'fixture' | 'live';
  provider: string;
  model: string | null;
  promptVersion: string;
  schemaVersion: string;
  generatorVersion: string;
  projectionVersion: string;
  codeRevision: string;
}

export interface DiagnosisBenchmarkThresholdFailure {
  metric: string;
  threshold: number;
  observed: number | null;
  scenarioId?: string;
  replicate?: number;
  expected?: string[];
  actual?: string[];
}

/**
 * 治理重放：对候选报告跑生产校验函数链。返回 replicate 评测结果；
 * 校准门拒绝记为 calibration-rejected（不计入误报，Issue #1729 回归锚点）。
 */
export function replayBenchmarkGovernance(
  scenario: DiagnosisBenchmarkScenario,
  governedInput: DiagnosisBenchmarkGovernedInput,
  report: DiagnosisBenchmarkCandidateReport,
): Omit<DiagnosisBenchmarkReplicateEvaluation, 'scenarioId' | 'replicate' | 'durationMs' | 'rawReport'> {
  const observedRefs = new Set<string>([
    ...governedInput.knowledgeProgress.map((row) => `knowledge-progress:${row.id}`),
    ...(governedInput.assignmentSubmissions ?? []).map((row) => `assignment-submission:${row.id}`),
    ...(governedInput.assessmentSessions ?? []).map((row) => `adaptive-assessment-session:${row.id}`),
    ...(governedInput.riskFlags ?? []).map((row) => `student-risk-flag:${row.id}`),
  ]);
  const languageViolations = validateDiagnosisReportBodyLanguage({
    summary: report.summary,
    findings: report.findings.map((finding) => ({ title: finding.title, summary: finding.summary })),
    limitations: report.limitations,
  });
  const nodeByEvidenceRef = buildKnowledgeNodeByEvidenceRef(governedInput.knowledgeProgress);
  const attributionViolations = enforceDiagnosisFindingNodeAttribution(report.findings, nodeByEvidenceRef);
  const citedRefs = [
    ...report.evidenceRefs,
    ...report.findings.flatMap((finding) => finding.evidenceRefs),
  ];
  const evidenceRefsValid = citedRefs.every((ref) => observedRefs.has(ref));
  const weaknessStats = buildKnowledgeNodeWeaknessStats(governedInput.knowledgeProgress);
  const calibrationViolations = enforceDiagnosisFindingCalibration(
    report.findings,
    report.confidence,
    report.limitations,
    nodeByEvidenceRef,
    weaknessStats,
    governedInput.studentIds,
    null,
  );

  const knowledgeFindings = report.findings.filter((finding) => (
    finding.knowledgeNodeId
    || finding.evidenceRefs.some((ref) => ref.startsWith('knowledge-progress:'))
  ));
  // 稀疏风险标志覆盖误读（Issue #1755）：复用生产校验函数，违例同样视为治理拒绝。
  const riskFlagCoverageViolations = enforceRiskFlagCoverageSemantics({
    summary: report.summary,
    limitations: report.limitations,
  });
  // 限制×覆盖一致性（Issue #1904）：复用生产校验函数，违例同样视为治理拒绝。
  const limitationCoverageViolations = enforceLimitationCoverageConsistency({
    sourceCoverage: report.sourceCoverage,
    limitations: report.limitations,
  });
  const governanceFailed = languageViolations.length > 0
    || attributionViolations.length > 0
    || !evidenceRefsValid
    || calibrationViolations.length > 0
    || riskFlagCoverageViolations.length > 0
    || limitationCoverageViolations.length > 0;

  return {
    status: governanceFailed ? 'calibration-rejected' : 'ok',
    reportedNodes: knowledgeFindings
      .map((finding) => finding.knowledgeNodeId)
      .filter((nodeId): nodeId is string => Boolean(nodeId)),
    primaryReportedNode: knowledgeFindings[0]?.knowledgeNodeId ?? null,
    chineseCompliant: languageViolations.length === 0,
    evidenceRefsValid,
    attributionValid: attributionViolations.length === 0,
    coverageClaimAccurate: report.sourceCoverage.progressRows === governedInput.knowledgeProgress.length
      && boundaryRespected(scenario, report),
    failureReason: governanceFailed
      ? `language=${languageViolations.length},attribution=${attributionViolations.length},refs=${evidenceRefsValid ? 'ok' : 'invalid'},calibration=${calibrationViolations.join(',') || 'none'},riskCoverage=${riskFlagCoverageViolations.join(',') || 'none'},limitationCoverage=${limitationCoverageViolations.join(',') || 'none'}`
      : undefined,
  };
}

const CONFIDENCE_ORDER = ['unavailable', 'low', 'medium', 'high'] as const;

/**
 * 场景结论边界（Issue #1729 review）：证据冲突或覆盖缺失的场景要求
 * 报告携带 limitations 且置信不超过声明的最高档；违反即覆盖/降级
 * 主张不准确，计入合规率并在阈值门禁中失败。
 */
function boundaryRespected(
  scenario: DiagnosisBenchmarkScenario,
  report: DiagnosisBenchmarkCandidateReport,
): boolean {
  const boundary = scenario.allowedConclusionBoundary;
  // 稀疏风险标志语义（Issue #1755 review）：命中数被表述为覆盖不足即违反边界，
  // 复用生产确定性校验的同一判定。
  if (boundary.forbidRiskCoverageMisread
    && enforceRiskFlagCoverageSemantics({ summary: report.summary, limitations: report.limitations }).length > 0) {
    return false;
  }
  // 限制×覆盖一致性（Issue #1904）：完整覆盖下声称学生证据可能缺失即违反边界，
  // 复用生产确定性校验的同一判定。
  if (boundary.forbidHypotheticalMissingData
    && enforceLimitationCoverageConsistency({ sourceCoverage: report.sourceCoverage, limitations: report.limitations }).length > 0) {
    return false;
  }
  if (!boundary.requireLimitations) return true;
  if (report.limitations.length === 0) return false;
  const observed = CONFIDENCE_ORDER.indexOf(report.confidence as typeof CONFIDENCE_ORDER[number]);
  const allowed = CONFIDENCE_ORDER.indexOf(boundary.maxConfidence);
  return observed >= 0 && allowed >= 0 && observed <= allowed;
}

function evidenceRefFor(governedInput: DiagnosisBenchmarkGovernedInput, nodeId: string, take: number): string[] {
  return governedInput.knowledgeProgress
    .filter((row) => row.nodeId === nodeId)
    .slice(0, take)
    .map((row) => `knowledge-progress:${row.id}`);
}

/**
 * fixture provider stub：正样本按真值构造（只报满足生产门槛的薄弱节点，
 * sourceCoverage 与实际一致，中文、引用、归因全部合规）；健康场景的
 * 第 2 次 replicate 固定输出 #1728 修复前的过度诊断行为（把正常节点
 * 判为薄弱），用于锚定"旧行为触发校准拒绝、新行为通过"的回归用例。
 */
export function createFixtureGenerate(): DiagnosisBenchmarkGenerate {
  return async ({ scenario, governedInput, groundTruth, replicate }) => {
    if (scenario.weaknessInjection.length === 0) {
      if (replicate === 2) {
        const overdiagnosisNode = 'bench-node-10';
        return {
          ok: true,
          durationMs: 1,
          report: {
            summary: '班级整体需要关注，相对薄弱的知识点已经列出。',
            findings: [{
              title: '相对最低知识点判为薄弱',
              knowledgeNodeId: overdiagnosisNode,
              evidenceRefs: evidenceRefFor(governedInput, overdiagnosisNode, 3),
            }],
            evidenceRefs: evidenceRefFor(governedInput, overdiagnosisNode, 1),
            evidenceCutoff: '2026-08-31T08:00:00.000Z',
            sourceCoverage: { classMembers: governedInput.studentIds.length, progressRows: governedInput.knowledgeProgress.length },
            confidence: 'medium',
            limitations: [],
          },
        };
      }
      return {
        ok: true,
        durationMs: 1,
        report: {
          summary: '全部知识节点均处于正常范围，本次诊断未发现明确薄弱节点。',
          findings: [],
          evidenceRefs: evidenceRefFor(governedInput, 'bench-node-01', 1),
          evidenceCutoff: '2026-08-31T08:00:00.000Z',
          sourceCoverage: { classMembers: governedInput.studentIds.length, progressRows: governedInput.knowledgeProgress.length },
          confidence: 'high',
          limitations: [],
        },
      };
    }

    const strength = scenario.assignmentAssessmentConflict || groundTruth.actualProgressCoverage < 1;
    const orderedNodes = [...groundTruth.trueWeakNodes].sort((left, right) => (
      (left === groundTruth.primaryWeakNode ? -1 : 0) - (right === groundTruth.primaryWeakNode ? -1 : 0)
    ));
    const findings: DiagnosisBenchmarkCandidateFinding[] = orderedNodes.map((nodeId) => ({
      title: nodeId === groundTruth.primaryWeakNode
        ? '首要薄弱知识点需要优先干预'
        : '薄弱知识点需要针对性巩固',
      knowledgeNodeId: nodeId,
      evidenceRefs: evidenceRefFor(governedInput, nodeId, 3),
    }));
    // 完整覆盖判断边界（Issue #1904）：正样本携带风险规则解释边界限制 +
    // 完整覆盖事实；第 2 次 replicate 固定输出修复前的假设性缺失限制，
    // 锚定"矛盾输出触发限制×覆盖一致性拒绝、边界限制通过"的回归用例。
    if (scenario.id === 'full-coverage-medium-boundary') {
      const memberCount = governedInput.studentIds.length;
      return {
        ok: true,
        durationMs: 1,
        report: {
          summary: '班级诊断完成，薄弱知识点与证据范围已在发现中列出。',
          findings,
          evidenceRefs: evidenceRefFor(governedInput, groundTruth.primaryWeakNode ?? orderedNodes[0], 2),
          evidenceCutoff: '2026-08-31T08:00:00.000Z',
          sourceCoverage: {
            classMembers: memberCount,
            includedStudents: memberCount,
            progressRows: governedInput.knowledgeProgress.length,
            coverage: 1,
            assignment: { includedStudents: memberCount, missingStudents: 0 },
            assessment: { includedStudents: memberCount, missingStudents: 0 },
          },
          confidence: 'medium',
          limitations: [replicate === 2
            ? '知识节点薄弱判定严格依赖进度数据，若部分学生数据缺失可能影响弱势人数统计的精确性。'
            : '风险标志数据基于特定触发条件，未命中风险的学生不代表无学习障碍，仅表示未触发该特定约束规则。'],
        },
      };
    }
    // 限制文案必须与场景事实一致：覆盖缺失场景声明缺失，冲突场景声明冲突，
    // 完整覆盖场景不得生成"数据缺失"式错误限制（Issue #1755 review）。
    const limitations = groundTruth.actualProgressCoverage < 1
      ? ['知识进度数据存在缺失，结论强度已相应降低。']
      : strength
        ? ['作业与测评整体表现正常，与部分学生知识进度长期滞后存在冲突。']
        : [];
    return {
      ok: true,
      durationMs: 1,
      report: {
        summary: '班级诊断完成，薄弱知识点与证据范围已在发现中列出。',
        findings,
        evidenceRefs: evidenceRefFor(governedInput, groundTruth.primaryWeakNode ?? orderedNodes[0], 2),
        evidenceCutoff: '2026-08-31T08:00:00.000Z',
        sourceCoverage: { classMembers: governedInput.studentIds.length, progressRows: governedInput.knowledgeProgress.length },
        confidence: strength ? 'medium' : 'high',
        limitations,
      },
    };
  };
}

export interface DiagnosisBenchmarkRunResult {
  runId: string;
  versionInfo: DiagnosisBenchmarkVersionInfo;
  scenarioEvaluations: DiagnosisBenchmarkScenarioRun[];
  aggregate: ReturnType<typeof aggregateBenchmarkMetrics>;
  thresholdFailures: DiagnosisBenchmarkThresholdFailure[];
  passed: boolean;
}

export function evaluateBenchmarkThreshold(
  aggregate: ReturnType<typeof aggregateBenchmarkMetrics>,
  runs: DiagnosisBenchmarkScenarioRun[],
): DiagnosisBenchmarkThresholdFailure[] {
  const failures: DiagnosisBenchmarkThresholdFailure[] = [];
  const check = (metric: string, threshold: number, observed: number | null, worst = false) => {
    if (observed === null) return;
    if (worst ? observed > threshold : observed < threshold) {
      failures.push({ metric, threshold, observed });
    }
  };
  check('microPrecision', DIAGNOSIS_BENCHMARK_THRESHOLD.microPrecision, aggregate.microPrecision);
  check('microRecall', DIAGNOSIS_BENCHMARK_THRESHOLD.microRecall, aggregate.microRecall);
  check('macroF1', DIAGNOSIS_BENCHMARK_THRESHOLD.macroF1, aggregate.macroF1);
  check('exactMatchRate', DIAGNOSIS_BENCHMARK_THRESHOLD.exactMatchRate, aggregate.exactMatchRate);
  check('primaryHitRate', DIAGNOSIS_BENCHMARK_THRESHOLD.primaryHitRate, aggregate.primaryHitRate);
  check('healthyFalsePositiveRate', DIAGNOSIS_BENCHMARK_THRESHOLD.healthyFalsePositiveRate, aggregate.healthyFalsePositiveRate, true);
  // 场景成功下限（Issue #1749 review）：任一场景零成功 replicate 时，
  // 准确率指标为 null、治理率记 1，完全不可用的评测不得通过门禁。
  for (const run of runs) {
    const successful = run.evaluations.filter((entry) => entry.status === 'ok').length;
    if (successful < DIAGNOSIS_BENCHMARK_THRESHOLD.scenarioMinimumSuccessfulReplicates) {
      failures.push({
        metric: 'scenarioSuccessfulReplicateFloor',
        threshold: DIAGNOSIS_BENCHMARK_THRESHOLD.scenarioMinimumSuccessfulReplicates,
        observed: successful,
        scenarioId: run.scenario.id,
      });
    }
  }
  check('chineseComplianceRate', DIAGNOSIS_BENCHMARK_THRESHOLD.complianceRate, aggregate.chineseComplianceRate);
  check('evidenceReferenceValidityRate', DIAGNOSIS_BENCHMARK_THRESHOLD.complianceRate, aggregate.evidenceReferenceValidityRate);
  check('attributionValidityRate', DIAGNOSIS_BENCHMARK_THRESHOLD.complianceRate, aggregate.attributionValidityRate);
  check('coverageClaimAccuracyRate', DIAGNOSIS_BENCHMARK_THRESHOLD.coverageClaimAccuracyRate, aggregate.coverageClaimAccuracyRate);
  // 逐 replicate 失败明细：阈值失败时列出场景、运行编号、预期真值与实际输出。
  if (failures.length > 0) {
    for (const run of runs) {
      for (const evaluation of run.evaluations) {
        const mismatch = evaluation.status !== 'ok'
          || new Set(evaluation.reportedNodes).size !== run.groundTruth.trueWeakNodes.length
          || !run.groundTruth.trueWeakNodes.every((node) => evaluation.reportedNodes.includes(node));
        if (mismatch) {
          failures.push({
            metric: 'replicateDetail',
            threshold: 0,
            observed: null,
            scenarioId: run.scenario.id,
            replicate: evaluation.replicate,
            expected: run.groundTruth.trueWeakNodes,
            actual: evaluation.status === 'ok' ? evaluation.reportedNodes : [`${evaluation.status}:${evaluation.failureReason ?? ''}`],
          });
        }
      }
    }
  }
  return failures;
}

export async function runDiagnosisBenchmark(options: {
  generate: DiagnosisBenchmarkGenerate;
  versionInfo: DiagnosisBenchmarkVersionInfo;
  replicates?: number;
  scenarios?: DiagnosisBenchmarkScenario[];
}): Promise<DiagnosisBenchmarkRunResult> {
  const replicates = options.replicates ?? 3;
  const scenarios = options.scenarios ?? DIAGNOSIS_BENCHMARK_SCENARIOS;
  const runId = `${new Date().toISOString().replace(/[:.]/g, '-')}-${options.versionInfo.mode}`;
  const scenarioEvaluations: DiagnosisBenchmarkScenarioRun[] = [];

  for (const scenario of scenarios) {
    const materialized = materializeScenario(scenario);
    const groundTruth = { ...benchmarkGroundTruth(scenario), actualProgressCoverage: materialized.groundTruth.actualProgressCoverage };
    const evaluations: DiagnosisBenchmarkReplicateEvaluation[] = [];
    for (let replicate = 1; replicate <= replicates; replicate += 1) {
      const startedAt = Date.now();
      const generated = await options.generate({
        scenario,
        governedInput: materialized.governedInput,
        groundTruth,
        replicate,
      });
      const durationMs = generated.durationMs || Math.max(1, Date.now() - startedAt);
      if (!generated.ok) {
        evaluations.push({
          scenarioId: scenario.id,
          replicate,
          status: 'generation-failed',
          reportedNodes: [],
          primaryReportedNode: null,
          chineseCompliant: false,
          evidenceRefsValid: false,
          attributionValid: false,
          coverageClaimAccurate: false,
          durationMs,
          // 解析/生成失败路径同样保留原始输出（Issue #1729 review）：
          // 失败样本最需要审计，不得因失败而丢弃。
          rawOutput: generated.rawOutput ?? null,
          failureReason: generated.reason,
        });
        continue;
      }
      const replayed = replayBenchmarkGovernance(scenario, materialized.governedInput, generated.report);
      evaluations.push({
        scenarioId: scenario.id,
        replicate,
        durationMs,
        rawOutput: generated.rawOutput ?? generated.report,
        ...replayed,
      });
    }
    scenarioEvaluations.push({ scenario, groundTruth, evaluations });
  }

  const aggregate = aggregateBenchmarkMetrics(scenarioEvaluations);
  const thresholdFailures = evaluateBenchmarkThreshold(aggregate, scenarioEvaluations);
  return {
    runId,
    versionInfo: options.versionInfo,
    scenarioEvaluations,
    aggregate,
    thresholdFailures,
    passed: thresholdFailures.length === 0,
  };
}

/** 把运行结果写入 artifacts/diagnosis-benchmark/<runId>/（目录只增不改）。 */
export async function writeBenchmarkRun(root: string, result: DiagnosisBenchmarkRunResult): Promise<string> {
  const runDir = path.join(root, 'artifacts', 'diagnosis-benchmark', result.runId);
  await mkdir(path.join(runDir, 'runs'), { recursive: true });
  const manifest = {
    runId: result.runId,
    ...result.versionInfo,
    threshold: DIAGNOSIS_BENCHMARK_THRESHOLD,
    scenarios: result.scenarioEvaluations.map((run) => ({
      id: run.scenario.id,
      scenarioVersion: run.scenario.scenarioVersion,
      seed: run.scenario.seed,
    })),
  };
  await writeFile(path.join(runDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  const summary = {
    runId: result.runId,
    passed: result.passed,
    aggregate: result.aggregate,
    thresholdFailures: result.thresholdFailures,
    scenarios: result.scenarioEvaluations.map((run) => computeScenarioMetrics(run.scenario, run.groundTruth, run.evaluations)),
  };
  await writeFile(path.join(runDir, 'summary.json'), `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
  const csvHeader = 'scenarioId,metric,value';
  const csvRows: string[] = [];
  for (const [metric, value] of Object.entries(result.aggregate)) {
    if (typeof value === 'number') csvRows.push(`aggregate,${metric},${value}`);
  }
  for (const run of result.scenarioEvaluations) {
    const metrics = computeScenarioMetrics(run.scenario, run.groundTruth, run.evaluations);
    for (const [metric, value] of Object.entries(metrics)) {
      if (typeof value === 'number') csvRows.push(`${run.scenario.id},${metric},${value}`);
    }
    for (const evaluation of run.evaluations) {
      await writeFile(
        path.join(runDir, 'runs', `${run.scenario.id}-${evaluation.replicate}.json`),
        `${JSON.stringify({ groundTruth: run.groundTruth, rawOutput: evaluation.rawOutput ?? null, evaluation }, null, 2)}\n`,
        'utf8',
      );
    }
  }
  await writeFile(path.join(runDir, 'summary.csv'), `${csvHeader}\n${csvRows.join('\n')}\n`, 'utf8');
  return runDir;
}
