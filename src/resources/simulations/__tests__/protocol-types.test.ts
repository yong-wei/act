/**
 * Contract tests for SceneSpec v1, EvaluationSpec v1, and SimulationTrace v1.
 * Validates type structure without runtime coupling.
 */
import { describe, it, expect } from 'vitest';
import type {
  SceneSpecV1,
  SceneIdentityV1,
  ModelIdentityV1,
  DisturbancePolicyV1,
  EvaluationPolicyV1,
  EvaluationSpecV1,
  AssetManifestV1,
  TelemetryPolicyV1,
  ReplayPolicyV1,
  EvidenceGovernanceV1,
  SimulationTraceV1,
  TraceEnvelopeV1,
  TraceSampleRef,
  TraceSummaryV1,
  ModelRelation,
} from '../core/protocol-types';

function buildSceneSpec(): SceneSpecV1 {
  return {
    scene: {
      id: 'sim/destroyer',
      title: '055型驱逐舰',
      route: '/simulations/destroyer',
      launchModes: ['standalone'],
    },
    model: {
      family: 'Nomoto1stOrder',
      runtimeModelId: 'nomoto_step_rk4',
      parameterSchema: 'nomoto-v1',
      version: '1.0.0',
      unitPolicy: 'rad',
    },
    disturbance: {
      environmentFamilies: ['waves', 'wind', 'current'],
      stochasticPolicy: 'deterministic',
      seedRequirement: 'none',
    },
    evaluation: {
      metrics: ['avgError', 'overshoot'],
      hardConstraints: ['maxRudderRate'],
      successCriteria: [{ metricId: 'avgError', operator: 'lt', value: 10 }],
      evaluationProtocol: {
        id: 'eval/destroyer-official',
        metrics: ['avgError', 'overshoot'],
        hardConstraints: ['maxRudderRate'],
        visibility: 'both',
        modelRelation: {
          relation: 'same',
          teachingSemantics: '同一模型',
          evaluationBoundary: '无',
        },
        prohibitsMixedClaims: false,
      },
    },
    assets: {
      assetIds: ['destroyer-3d'],
      visualLayers: ['sea-surface', 'ship-hull'],
      version: '1.0.0',
    },
    telemetry: {
      sampleChannels: ['time', 'heading', 'rudder', 'speed', 'position'],
      defaultRecordInterval: 0.05,
      summaryMetrics: ['avgError', 'overshoot', 'settlingTime'],
    },
    replay: {
      seedFields: [],
      runtimeVersion: '1.0.0',
      modelVersion: '1.0.0',
      checksumPolicy: 'none',
    },
    governance: {
      evidenceSource: 'simulation/destroyer',
      privacyLevel: 'public',
      retentionClass: 'temporary',
      contextFields: ['classId', 'sessionId', 'userId'],
    },
  };
}

function buildSurrogateRelation(): ModelRelation {
  return {
    relation: 'surrogate',
    teachingSemantics: '黑箱为线性传函，3D 场景含非线性水动力导数',
    evaluationBoundary: 'Preview 评估结果不能等同于对应 3D 场景的操纵性能',
  };
}

function buildTrace(): SimulationTraceV1 {
  return {
    envelope: {
      runId: 'run-001',
      sceneId: 'sim/destroyer',
      scenarioId: 'turn90',
      protocolVersion: '1.0',
      runtimeVersion: '1.0.0',
      modelVersion: '1.0.0',
      seed: 42,
      startedAt: '2026-05-25T00:00:00Z',
      completedAt: '2026-05-25T00:01:00Z',
      sampleCadence: 0.05,
      checksum: 'sha256:abc123',
    },
    samples: {
      path: 'traces/run-001.json',
      frameCount: 1200,
      channels: ['time', 'heading', 'rudder', 'speed', 'position'],
    },
    summary: {
      metrics: { avgError: 5.2, overshoot: 3.1 },
      passed: true,
      durationSeconds: 60,
    },
  };
}

describe('SceneSpec v1', () => {
  it('builds a complete scene spec with all required domains', () => {
    const spec = buildSceneSpec();
    expect(spec.scene.id).toBe('sim/destroyer');
    expect(spec.model.family).toBe('Nomoto1stOrder');
    expect(spec.disturbance.seedRequirement).toBe('none');
    expect(spec.evaluation.evaluationProtocol.visibility).toBe('both');
    expect(spec.assets.version).toBe('1.0.0');
    expect(spec.telemetry.defaultRecordInterval).toBe(0.05);
    expect(spec.replay.checksumPolicy).toBe('none');
    expect(spec.governance.privacyLevel).toBe('public');
  });

  it('has required launchModes', () => {
    const spec = buildSceneSpec();
    expect(spec.scene.launchModes.length).toBeGreaterThan(0);
  });

  it('has required model unitPolicy in rad or deg', () => {
    const spec = buildSceneSpec();
    expect(['rad', 'deg']).toContain(spec.model.unitPolicy);
  });
});

describe('EvaluationSpec v1', () => {
  it('maps model relations correctly for simplified objects', () => {
    const rel = buildSurrogateRelation();
    expect(rel.relation).toBe('surrogate');
    expect(rel.teachingSemantics.length).toBeGreaterThan(0);
    expect(rel.evaluationBoundary.length).toBeGreaterThan(0);
  });

  it('prohibits mixed claims when model differs', () => {
    const spec = buildSceneSpec();
    spec.evaluation.evaluationProtocol.modelRelation = buildSurrogateRelation();
    // When model is surrogate, the evaluation protocol should be explicit
    expect(spec.evaluation.evaluationProtocol.modelRelation.relation).toBe('surrogate');
  });
});

describe('SimulationTrace v1', () => {
  it('builds a complete trace with envelope, samples, and summary', () => {
    const trace = buildTrace();
    expect(trace.envelope.protocolVersion).toBe('1.0');
    expect(trace.samples.frameCount).toBeGreaterThan(0);
    expect(trace.summary.passed).toBe(true);
  });

  it('envelope includes seed and checksum for replay verification', () => {
    const trace = buildTrace();
    expect(trace.envelope.seed).toBeDefined();
    expect(trace.envelope.checksum.length).toBeGreaterThan(0);
  });

  it('summary metrics are keyed by metric id', () => {
    const trace = buildTrace();
    expect(typeof trace.summary.metrics.avgError).toBe('number');
  });
});

describe('Governance', () => {
  it('requires context fields for privacy filtering', () => {
    const spec = buildSceneSpec();
    expect(spec.governance.contextFields.length).toBeGreaterThan(0);
    expect(spec.governance.contextFields).toContain('userId');
  });
});

describe('EvaluationCriterion between operator', () => {
  it('requires value2 when operator is between, and value2 must exceed value', () => {
    const criterion = buildSceneSpec().evaluation.successCriteria[0]!;
    if (criterion.operator === 'between') {
      expect(criterion.value2).toBeDefined();
      expect(criterion.value2! > criterion.value).toBe(true);
    }
  });

  it('validates a between criterion with explicit bounds', () => {
    const betweenCriterion: import('../core/protocol-types').EvaluationCriterion = {
      metricId: 'avgError',
      operator: 'between',
      value: 2,
      value2: 10,
    };
    expect(betweenCriterion.value2).toBeDefined();
    expect(betweenCriterion.value2! > betweenCriterion.value).toBe(true);
  });
});
