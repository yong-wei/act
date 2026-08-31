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
  it('covers the eight scenario classes with versioned ground truth', () => {
    expect(DIAGNOSIS_BENCHMARK_SCENARIOS).toHaveLength(8);
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
      materialized.governedInput,
      (ideal as { report: DiagnosisBenchmarkCandidateReport }).report,
    );
    expect(idealReplayed.status).toBe('ok');
  });

  it('passes all eight scenarios end to end with the fixture stub', async () => {
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

    expect(result.scenarioEvaluations).toHaveLength(8);
    expect(result.aggregate.microPrecision).toBe(1);
    expect(result.aggregate.microRecall).toBe(1);
    expect(result.aggregate.macroF1).toBe(1);
    expect(result.aggregate.healthyFalsePositiveRate).toBe(0);
    expect(result.passed).toBe(true);
    expect(result.thresholdFailures).toEqual([]);

    const healthy = result.scenarioEvaluations.find((run) => run.scenario.id === 'healthy-class');
    expect(healthy?.evaluations.map((entry) => entry.status)).toEqual(['ok', 'calibration-rejected', 'ok']);
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
      const csv = await readFile(path.join(runDir, 'summary.csv'), 'utf8');
      expect(csv).toContain('aggregate,macroF1,1');
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
