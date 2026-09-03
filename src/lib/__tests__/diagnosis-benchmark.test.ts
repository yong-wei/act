import { mkdir, readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';

import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import {
  DIAGNOSIS_BENCHMARK_SCENARIOS,
  benchmarkGroundTruth,
  scenarioById,
} from '@/lib/diagnosis-benchmark/scenarios';
import { materializeScenario } from '@/lib/diagnosis-benchmark/generate';
import {
  aggregateBenchmarkMetrics,
  computeScenarioMetrics,
} from '@/lib/diagnosis-benchmark/metrics';
import {
  createFixtureGenerate,
  evaluateBenchmarkThreshold,
  replayBenchmarkGovernance,
  runDiagnosisBenchmark,
  writeBenchmarkRun,
  type DiagnosisBenchmarkCandidateReport,
} from '@/lib/diagnosis-benchmark/runner';

describe('diagnosis benchmark scenarios and generation', () => {
  it('covers the ten scenario classes with versioned ground truth', () => {
    expect(DIAGNOSIS_BENCHMARK_SCENARIOS).toHaveLength(10);
    const healthy = scenarioById('healthy-class');
    expect(benchmarkGroundTruth(healthy).trueWeakNodes).toEqual([]);
    expect(benchmarkGroundTruth(healthy).primaryWeakNode).toBeNull();
    for (const scenario of DIAGNOSIS_BENCHMARK_SCENARIOS.slice(1)) {
      const truth = benchmarkGroundTruth(scenario);
      expect(truth.trueWeakNodes.length).toBeGreaterThan(0);
      expect(truth.primaryWeakNode).not.toBeNull();
    }
    const conflict = scenarioById('assignment-assessment-conflict');
    expect(conflict.assignmentAssessmentConflict).toBe(true);
    expect(conflict.allowedConclusionBoundary.requireLimitations).toBe(true);
  });

  it('regenerates byte-identical governed input for the same seed', () => {
    const scenario = scenarioById('attribution-pressure');
    const first = materializeScenario(scenario);
    const second = materializeScenario(scenario);
    expect(second.governedInput).toEqual(first.governedInput);
    expect(second.groundTruth).toEqual(first.groundTruth);
  });

  it('injects weak students, coverage gaps and evidence conflicts deterministically', () => {
    const weak = materializeScenario(scenarioById('single-weak-node'));
    const weakRows = weak.governedInput.knowledgeProgress.filter((row) => (
      row.nodeId === 'bench-node-03' && (row.status === 'NOT_STARTED' || (row.progress < 40 && row.status !== 'COMPLETED'))
    ));
    expect(weakRows).toHaveLength(28);
    expect(weak.groundTruth.actualProgressCoverage).toBe(1);

    const missing = materializeScenario(scenarioById('thirty-percent-missing'));
    expect(missing.groundTruth.actualProgressCoverage).toBeGreaterThan(0.6);
    expect(missing.groundTruth.actualProgressCoverage).toBeLessThan(1);

    const conflict = materializeScenario(scenarioById('assignment-assessment-conflict'));
    const firstAssignment = conflict.governedInput.assignmentSubmissions?.[0];
    const firstAssessment = conflict.governedInput.assessmentSessions?.[0];
    expect(firstAssignment?.score).toBeGreaterThanOrEqual(90);
    expect(firstAssessment?.score).toBeLessThan(50);
  });

  it('keeps injected truth nodes eligible under the production class threshold', () => {
    for (const scenario of DIAGNOSIS_BENCHMARK_SCENARIOS) {
      const materialized = materializeScenario(scenario);
      for (const injection of scenario.weaknessInjection) {
        const rows = materialized.governedInput.knowledgeProgress.filter((row) => (
          row.nodeId === injection.nodeId
          && (row.status === 'NOT_STARTED' || (row.progress < 40 && row.status !== 'COMPLETED'))
        ));
        const covered = materialized.governedInput.knowledgeProgress.filter((row) => row.nodeId === injection.nodeId).length;
        const threshold = Math.max(3, Math.ceil(0.2 * covered));
        expect(rows.length, `${scenario.id}/${injection.nodeId}`).toBeGreaterThanOrEqual(threshold);
      }
    }
  });
});

describe('diagnosis benchmark metrics', () => {
  const scenario = scenarioById('multiple-weak-nodes');

  it('computes node-level precision, recall, exact match and primary hit against truth', () => {
    const truth = benchmarkGroundTruth(scenario);
    const metrics = computeScenarioMetrics(scenario, truth, [
      {
        scenarioId: scenario.id,
        replicate: 1,
        status: 'ok',
        reportedNodes: ['bench-node-02', 'bench-node-07', 'bench-node-11'],
        primaryReportedNode: 'bench-node-07',
        chineseCompliant: true,
        evidenceRefsValid: true,
        attributionValid: true,
        coverageClaimAccurate: true,
        durationMs: 1,
      },
      {
        scenarioId: scenario.id,
        replicate: 2,
        status: 'ok',
        reportedNodes: ['bench-node-02', 'bench-node-07', 'bench-node-99'],
        primaryReportedNode: 'bench-node-02',
        chineseCompliant: true,
        evidenceRefsValid: true,
        attributionValid: true,
        coverageClaimAccurate: true,
        durationMs: 1,
      },
    ]);

    // replicate1: P=R=F1=1, exact, primary hit; replicate2: P=2/3, R=2/3, F1=2/3, miss primary。
    expect(metrics.precision).toBeCloseTo((1 + 2 / 3) / 2, 3);
    expect(metrics.recall).toBeCloseTo((1 + 2 / 3) / 2, 3);
    expect(metrics.exactMatchRate).toBe(0.5);
    expect(metrics.primaryHitRate).toBe(0.5);
    expect(metrics.generationSuccessRate).toBe(1);
  });

  it('counts healthy false positives as reported nodes over all nodes', () => {
    const healthy = scenarioById('healthy-class');
    const metrics = computeScenarioMetrics(healthy, benchmarkGroundTruth(healthy), [
      {
        scenarioId: healthy.id,
        replicate: 1,
        status: 'ok',
        reportedNodes: ['bench-node-04', 'bench-node-08'],
        primaryReportedNode: 'bench-node-04',
        chineseCompliant: true,
        evidenceRefsValid: true,
        attributionValid: true,
        coverageClaimAccurate: true,
        durationMs: 1,
      },
    ]);
    expect(metrics.healthyFalsePositiveRate).toBeCloseTo(2 / 12, 3);
    // 健康场景误报：reported 非空对空真值，P=R=F1=0。
    expect(metrics.precision).toBe(0);
    expect(metrics.recall).toBe(0);
    expect(metrics.f1).toBe(0);
  });

  it('aggregates micro metrics from node events across scenarios', () => {
    const run = {
      scenario,
      groundTruth: benchmarkGroundTruth(scenario),
      evaluations: [
        {
          scenarioId: scenario.id,
          replicate: 1,
          status: 'ok' as const,
          reportedNodes: ['bench-node-02', 'bench-node-07', 'bench-node-11'],
          primaryReportedNode: 'bench-node-07',
          chineseCompliant: true,
          evidenceRefsValid: true,
          attributionValid: true,
          coverageClaimAccurate: true,
          durationMs: 1,
        },
        {
          scenarioId: scenario.id,
          replicate: 2,
          status: 'calibration-rejected' as const,
          reportedNodes: [],
          primaryReportedNode: null,
          chineseCompliant: true,
          evidenceRefsValid: true,
          attributionValid: true,
          coverageClaimAccurate: true,
          durationMs: 1,
          failureReason: 'calibration=findings[0]',
        },
      ],
    };
    const aggregate = aggregateBenchmarkMetrics([run]);
    // 仅成功的 replicate 计入微平均：3 TP / 0 FP / 0 FN。
    expect(aggregate.microPrecision).toBe(1);
    expect(aggregate.microRecall).toBe(1);
    expect(aggregate.microF1).toBe(1);
    expect(aggregate.generationSuccessRate).toBeLessThan(1);
    expect(aggregate.replicateDispersion.macroF1Worst).not.toBeNull();
  });

  it('excludes governance-rejected replicates from compliance rate denominators', () => {
    const truth = benchmarkGroundTruth(scenario);
    const metrics = computeScenarioMetrics(scenario, truth, [
      {
        scenarioId: scenario.id,
        replicate: 1,
        status: 'ok',
        reportedNodes: truth.trueWeakNodes,
        primaryReportedNode: 'bench-node-07',
        chineseCompliant: true,
        evidenceRefsValid: true,
        attributionValid: true,
        coverageClaimAccurate: true,
        durationMs: 1,
      },
      {
        scenarioId: scenario.id,
        replicate: 2,
        status: 'calibration-rejected',
        reportedNodes: [],
        primaryReportedNode: null,
        chineseCompliant: false,
        evidenceRefsValid: false,
        attributionValid: false,
        coverageClaimAccurate: false,
        durationMs: 1,
        failureReason: 'language=1',
      },
    ]);

    // 拒绝 replicate 不进治理率分母（Issue #1749），但计入失败率。
    expect(metrics.chineseComplianceRate).toBe(1);
    expect(metrics.evidenceReferenceValidityRate).toBe(1);
    expect(metrics.attributionValidityRate).toBe(1);
    expect(metrics.coverageClaimAccuracyRate).toBe(1);
    expect(metrics.generationSuccessRate).toBe(0.5);
  });

  it('pools governance compliance across successful replicates instead of scenario rates', () => {
    const truth = benchmarkGroundTruth(scenario);
    const okReplicate = (overrides: Partial<Record<string, unknown>>) => ({
      scenarioId: scenario.id,
      replicate: 1,
      status: 'ok' as const,
      reportedNodes: truth.trueWeakNodes,
      primaryReportedNode: 'bench-node-07',
      chineseCompliant: true,
      evidenceRefsValid: true,
      attributionValid: true,
      coverageClaimAccurate: true,
      durationMs: 1,
      ...overrides,
    });
    // 场景级比例 1/1 与 1/2：池化口径应为 2/3，而非"完全合规场景占比" 0.5。
    const aggregate = aggregateBenchmarkMetrics([
      {
        scenario,
        groundTruth: truth,
        evaluations: [okReplicate({ replicate: 1 })],
      },
      {
        scenario: scenarioById('single-weak-node'),
        groundTruth: benchmarkGroundTruth(scenarioById('single-weak-node')),
        evaluations: [
          okReplicate({ replicate: 1 }),
          okReplicate({ replicate: 2, coverageClaimAccurate: false }),
        ],
      },
    ]);
    expect(aggregate.coverageClaimAccuracyRate).toBeCloseTo(2 / 3, 3);
    expect(aggregate.chineseComplianceRate).toBe(1);
  });

  it('pools the generation success rate across all replicates', () => {
    const truth = benchmarkGroundTruth(scenario);
    const replicate = (n: number, failed = false) => ({
      scenarioId: scenario.id,
      replicate: n,
      status: failed ? ('generation-failed' as const) : ('ok' as const),
      reportedNodes: failed ? [] : truth.trueWeakNodes,
      primaryReportedNode: failed ? null : 'bench-node-07',
      chineseCompliant: !failed,
      evidenceRefsValid: !failed,
      attributionValid: !failed,
      coverageClaimAccurate: !failed,
      durationMs: 1,
      ...(failed ? { failureReason: 'provider unavailable' } : {}),
    });
    // 6 个 replicate 中 5 个成功：池化口径 5/6，而非"全成功场景占比" 0.5。
    const aggregate = aggregateBenchmarkMetrics([
      { scenario, groundTruth: truth, evaluations: [replicate(1), replicate(2), replicate(3)] },
      { scenario: scenarioById('single-weak-node'), groundTruth: benchmarkGroundTruth(scenarioById('single-weak-node')), evaluations: [replicate(1), replicate(2, true), replicate(3)] },
    ]);
    expect(aggregate.generationSuccessRate).toBeCloseTo(5 / 6, 3);
  });

  it('fails the threshold gate when any scenario has no successful replicate', () => {
    const truth = benchmarkGroundTruth(scenario);
    const unavailableRun = {
      scenario,
      groundTruth: truth,
      evaluations: [{
        scenarioId: scenario.id,
        replicate: 1,
        status: 'generation-failed' as const,
        reportedNodes: [],
        primaryReportedNode: null,
        chineseCompliant: false,
        evidenceRefsValid: false,
        attributionValid: false,
        coverageClaimAccurate: false,
        durationMs: 1,
        failureReason: 'provider unavailable',
      }],
    };
    const failures = evaluateBenchmarkThreshold(aggregateBenchmarkMetrics([unavailableRun]), [unavailableRun]);
    expect(failures.some((failure) => failure.metric === 'scenarioSuccessfulReplicateFloor')).toBe(true);
  });

  it('records full compliance for scenarios with no successful replicate', () => {
    const truth = benchmarkGroundTruth(scenario);
    const metrics = computeScenarioMetrics(scenario, truth, [
      {
        scenarioId: scenario.id,
        replicate: 1,
        status: 'generation-failed',
        reportedNodes: [],
        primaryReportedNode: null,
        chineseCompliant: false,
        evidenceRefsValid: false,
        attributionValid: false,
        coverageClaimAccurate: false,
        durationMs: 1,
        failureReason: 'provider unavailable',
      },
    ]);

    expect(metrics.chineseComplianceRate).toBe(1);
    expect(metrics.coverageClaimAccuracyRate).toBe(1);
    expect(metrics.generationSuccessRate).toBe(0);
  });

  it('computes replicate dispersion from per-replicate F1, not scenario means', () => {
    const run = {
      scenario,
      groundTruth: benchmarkGroundTruth(scenario),
      evaluations: [1, 2, 3].map((replicate) => ({
        scenarioId: scenario.id,
        replicate,
        status: 'ok' as const,
        // 偶数 replicate 完整命中（F1=1），奇数 replicate 全漏（F1=0）：
        // 场景均值恒为 1/3，若按场景均值计算会得到 stdev=0、掩盖波动。
        reportedNodes: replicate % 2 === 0 ? benchmarkGroundTruth(scenario).trueWeakNodes : [],
        primaryReportedNode: replicate % 2 === 0 ? 'bench-node-07' : null,
        chineseCompliant: true,
        evidenceRefsValid: true,
        attributionValid: true,
        coverageClaimAccurate: true,
        durationMs: 1,
      })),
    };
    const aggregate = aggregateBenchmarkMetrics([run]);
    expect(aggregate.replicateDispersion.macroF1Stdev).toBeGreaterThan(0);
    expect(aggregate.replicateDispersion.macroF1Worst).toBe(0);
  });

  it('lists scenario, replicate, expected and actual in threshold failure details', () => {
    const run = {
      scenario,
      groundTruth: benchmarkGroundTruth(scenario),
      evaluations: [
        {
          scenarioId: scenario.id,
          replicate: 1,
          status: 'ok' as const,
          reportedNodes: ['bench-node-02'],
          primaryReportedNode: 'bench-node-02',
          chineseCompliant: true,
          evidenceRefsValid: true,
          attributionValid: true,
          coverageClaimAccurate: true,
          durationMs: 1,
        },
      ],
    };
    const aggregate = aggregateBenchmarkMetrics([run]);
    const failures = evaluateBenchmarkThreshold(aggregate, [run]);
    expect(failures.length).toBeGreaterThan(0);
    const detail = failures.find((failure) => failure.metric === 'replicateDetail');
    expect(detail).toMatchObject({
      scenarioId: scenario.id,
      replicate: 1,
      expected: benchmarkGroundTruth(scenario).trueWeakNodes,
      actual: ['bench-node-02'],
    });
  });
});

describe('diagnosis benchmark fixture run', () => {
  it('replays the healthy overdiagnosis anchor through the production calibration gate', async () => {
    const healthy = scenarioById('healthy-class');
    const materialized = materializeScenario(healthy);
    const generate = createFixtureGenerate();

    const overdiagnosed = await generate({
      scenario: healthy,
      governedInput: materialized.governedInput,
      groundTruth: materialized.groundTruth,
      replicate: 2,
    });
    expect(overdiagnosed.ok).toBe(true);
    const replayed = replayBenchmarkGovernance(
      healthy,
      materialized.governedInput,
      (overdiagnosed as { report: DiagnosisBenchmarkCandidateReport }).report,
    );
    expect(replayed.status).toBe('calibration-rejected');
    expect(replayed.failureReason).toContain('calibration=');
    // 原始输出保留供审计；该 replicate 不计入健康误报（指标层按 ok 过滤）。
    expect(replayed.reportedNodes).toEqual(['bench-node-10']);

    const ideal = await generate({
      scenario: healthy,
      governedInput: materialized.governedInput,
      groundTruth: materialized.groundTruth,
      replicate: 1,
    });
    const idealReplayed = replayBenchmarkGovernance(
      healthy,
      materialized.governedInput,
      (ideal as { report: DiagnosisBenchmarkCandidateReport }).report,
    );
    expect(idealReplayed.status).toBe('ok');
  });

  it('enforces the conflict scenario conclusion boundary on coverage claims', async () => {
    const conflict = scenarioById('assignment-assessment-conflict');
    const materialized = materializeScenario(conflict);
    const generate = createFixtureGenerate();
    const generated = await generate({
      scenario: conflict,
      governedInput: materialized.governedInput,
      groundTruth: materialized.groundTruth,
      replicate: 1,
    });
    expect(generated.ok).toBe(true);
    const compliant = replayBenchmarkGovernance(
      conflict,
      materialized.governedInput,
      (generated as { report: DiagnosisBenchmarkCandidateReport }).report,
    );
    expect(compliant.coverageClaimAccurate).toBe(true);

    const strongConclusion: DiagnosisBenchmarkCandidateReport = {
      ...(generated as { report: DiagnosisBenchmarkCandidateReport }).report,
      confidence: 'high',
      limitations: [],
    };
    const violated = replayBenchmarkGovernance(conflict, materialized.governedInput, strongConclusion);
    expect(violated.coverageClaimAccurate).toBe(false);
  });

  it('replays the complete-coverage boundary anchor through the limitation-coverage gate (Issue #1904)', async () => {
    const scenario = scenarioById('full-coverage-medium-boundary');
    const materialized = materializeScenario(scenario);
    const generate = createFixtureGenerate();

    const defective = await generate({
      scenario,
      governedInput: materialized.governedInput,
      groundTruth: materialized.groundTruth,
      replicate: 2,
    });
    expect(defective.ok).toBe(true);
    const replayed = replayBenchmarkGovernance(
      scenario,
      materialized.governedInput,
      (defective as { report: DiagnosisBenchmarkCandidateReport }).report,
    );
    expect(replayed.status).toBe('calibration-rejected');
    expect(replayed.failureReason).toContain('limitationCoverage=limitations[0]');

    const boundary = await generate({
      scenario,
      governedInput: materialized.governedInput,
      groundTruth: materialized.groundTruth,
      replicate: 1,
    });
    expect(boundary.ok).toBe(true);
    const boundaryReplayed = replayBenchmarkGovernance(
      scenario,
      materialized.governedInput,
      (boundary as { report: DiagnosisBenchmarkCandidateReport }).report,
    );
    expect(boundaryReplayed.status).toBe('ok');
    expect(boundaryReplayed.coverageClaimAccurate).toBe(true);
  });

  it('passes all ten scenarios end to end with the fixture stub', async () => {
    const result = await runDiagnosisBenchmark({
      generate: createFixtureGenerate(),
      replicates: 3,
      versionInfo: {
        mode: 'fixture',
        provider: 'deterministic-fixture-stub',
        model: null,
        promptVersion: 'diagnosis-benchmark-fixture.v1',
        schemaVersion: 'teacher-diagnosis-report-body.v1',
        generatorVersion: 'diagnosis-benchmark.v1',
        projectionVersion: 'governance-replay.v1',
        codeRevision: 'test',
      },
    });

    expect(result.scenarioEvaluations).toHaveLength(10);
    expect(result.aggregate.microPrecision).toBe(1);
    expect(result.aggregate.microRecall).toBe(1);
    expect(result.aggregate.macroF1).toBe(1);
    expect(result.aggregate.healthyFalsePositiveRate).toBe(0);
    expect(result.passed).toBe(true);
    expect(result.thresholdFailures).toEqual([]);

    const healthy = result.scenarioEvaluations.find((run) => run.scenario.id === 'healthy-class');
    expect(healthy?.evaluations.map((entry) => entry.status)).toEqual(['ok', 'calibration-rejected', 'ok']);
    const boundary = result.scenarioEvaluations.find((run) => run.scenario.id === 'full-coverage-medium-boundary');
    expect(boundary?.evaluations.map((entry) => entry.status)).toEqual(['ok', 'calibration-rejected', 'ok']);
  });

  it('writes a non-overwriting run directory with manifest, summary and replicates', async () => {
    const result = await runDiagnosisBenchmark({
      generate: createFixtureGenerate(),
      replicates: 2,
      scenarios: [scenarioById('healthy-class')],
      versionInfo: {
        mode: 'fixture',
        provider: 'deterministic-fixture-stub',
        model: null,
        promptVersion: 'diagnosis-benchmark-fixture.v1',
        schemaVersion: 'teacher-diagnosis-report-body.v1',
        generatorVersion: 'diagnosis-benchmark.v1',
        projectionVersion: 'governance-replay.v1',
        codeRevision: 'test',
      },
    });
    const root = await mkdir(path.join(tmpdir(), `diagnosis-benchmark-${Date.now()}`), { recursive: true });
    try {
      const runDir = await writeBenchmarkRun(root, result);
      const manifest = JSON.parse(await readFile(path.join(runDir, 'manifest.json'), 'utf8'));
      expect(manifest.runId).toBe(result.runId);
      expect(manifest.scenarios[0]).toMatchObject({ id: 'healthy-class', scenarioVersion: 'bench-v1' });
      const summary = JSON.parse(await readFile(path.join(runDir, 'summary.json'), 'utf8'));
      expect(summary.passed).toBe(true);
      expect(summary.scenarios[0].scenarioId).toBe('healthy-class');
      const replicate = JSON.parse(await readFile(path.join(runDir, 'runs', 'healthy-class-1.json'), 'utf8'));
      expect(replicate.groundTruth.trueWeakNodes).toEqual([]);
      expect(replicate.rawOutput).toMatchObject({ confidence: 'high', findings: [] });
      expect(replicate.evaluation.scenarioId).toBe('healthy-class');
      const csv = await readFile(path.join(runDir, 'summary.csv'), 'utf8');
      expect(csv).toContain('aggregate,macroF1,1');
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

describe('sparse risk-flags benchmark scenario (Issue #1755)', () => {
  it('generates sparse risk flags deterministically with complete coverage', () => {
    const scenario = scenarioById('sparse-risk-flags-conflict');
    const first = materializeScenario(scenario);
    const second = materializeScenario(scenario);

    expect(first.governedInput.riskFlags).toHaveLength(52);
    expect(new Set(first.governedInput.riskFlags.map((row) => row.userId)).size).toBe(52);
    expect(first.governedInput.studentIds).toHaveLength(100);
    expect(first.groundTruth.actualProgressCoverage).toBe(1);
    expect(first.governedInput).toEqual(second.governedInput);
  });

  it('rejects a report that misreads risk-flag hits as coverage through the production gate', async () => {
    const scenario = scenarioById('sparse-risk-flags-conflict');
    const materialized = materializeScenario(scenario);
    const generate = createFixtureGenerate();
    const generated = await generate({
      scenario,
      governedInput: materialized.governedInput,
      groundTruth: materialized.groundTruth,
      replicate: 1,
    });
    expect(generated.ok).toBe(true);
    const compliant = replayBenchmarkGovernance(
      scenario,
      materialized.governedInput,
      (generated as { report: DiagnosisBenchmarkCandidateReport }).report,
    );
    expect(compliant.status).toBe('ok');

    const misread: DiagnosisBenchmarkCandidateReport = {
      ...(generated as { report: DiagnosisBenchmarkCandidateReport }).report,
      limitations: ['风险标志数据仅覆盖52名学生（占比52%），样本覆盖度有限。'],
    };
    const violated = replayBenchmarkGovernance(scenario, materialized.governedInput, misread);
    expect(violated.status).toBe('calibration-rejected');
    expect(violated.failureReason).toContain('riskCoverage=limitations[0]');
  });
});

describe('sparse risk-flags conclusion boundary (Issue #1755 review)', () => {
  it('records the misread prohibition in the scenario boundary and enforces it on coverage claims', async () => {
    const scenario = scenarioById('sparse-risk-flags-conflict');
    expect(scenario.allowedConclusionBoundary.forbidRiskCoverageMisread).toBe(true);

    const materialized = materializeScenario(scenario);
    const generate = createFixtureGenerate();
    const generated = await generate({
      scenario,
      governedInput: materialized.governedInput,
      groundTruth: materialized.groundTruth,
      replicate: 1,
    });
    const report = (generated as { report: DiagnosisBenchmarkCandidateReport }).report;
    expect(report.limitations[0]).toContain('冲突');
    expect(replayBenchmarkGovernance(scenario, materialized.governedInput, report).coverageClaimAccurate).toBe(true);

    const misread: DiagnosisBenchmarkCandidateReport = {
      ...report,
      limitations: ['风险标志数据仅覆盖52名学生（占比52%），样本覆盖度有限。'],
    };
    expect(replayBenchmarkGovernance(scenario, materialized.governedInput, misread).coverageClaimAccurate).toBe(false);
  });
});
