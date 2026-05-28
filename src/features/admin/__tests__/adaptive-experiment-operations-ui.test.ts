import { describe, expect, it } from 'vitest';

import {
  ADAPTIVE_EXPERIMENT_BANDIT_CONSTRAINTS,
  ADAPTIVE_EXPERIMENT_OPERATIONS_UI_FEATURE_FLAG,
  ADAPTIVE_EXPERIMENT_REQUIRED_METRICS,
  buildAdaptiveExperimentOperationsExport,
  buildAdaptiveExperimentOperationsWorkspace,
  type AdaptiveExperimentOperationsInput,
} from '../adaptive-experiment-operations-ui';
import {
  ADAPTIVE_BANDIT_RERANKING_FEATURE_FLAG,
  ADAPTIVE_OPTIMIZATION_EXPERIMENTS_FEATURE_FLAG,
  KONLING_LONG_TERM_MEMORY_FEATURE_FLAG,
  type AdaptiveExperimentAssignment,
  type AdaptiveOptimizationMetricName,
  type AdaptiveOptimizationMetricSummary,
} from '@/lib/adaptive-learning-optimization-experiments';

const assignment: AdaptiveExperimentAssignment = {
  experimentId: 'stage-2-path-optimization',
  studentId: 'student-1',
  classId: 'class-1',
  cohortId: 'cohort-a',
  initialAbilityStratum: 'medium',
  variant: 'rules-graph-path',
  eligible: true,
  eligibilityReason: 'eligible',
  exclusionReason: null,
  assignedAt: '2026-05-28T08:00:00.000Z',
  assignmentKey: 'stage-2:path:student-1',
};

function metric(metricName: AdaptiveOptimizationMetricName): AdaptiveOptimizationMetricSummary {
  return {
    metric: metricName,
    variant: 'rules-graph-path',
    classId: null,
    cohortId: null,
    sampleCount: metricName === 'low-confidence-rate' ? 4 : 24,
    value: metricName === 'low-confidence-rate' ? 0.15 : 0.62,
    confidence: metricName === 'low-confidence-rate' ? 'medium' : 'high',
    completeness: 'complete',
    evidenceWindowHours: 48,
    privacyAggregationLevel: 'variant-aggregate',
  };
}

function input(overrides: Partial<AdaptiveExperimentOperationsInput> = {}): AdaptiveExperimentOperationsInput {
  return {
    role: 'admin',
    featureFlags: {
      [ADAPTIVE_EXPERIMENT_OPERATIONS_UI_FEATURE_FLAG]: true,
      [ADAPTIVE_OPTIMIZATION_EXPERIMENTS_FEATURE_FLAG]: true,
      [ADAPTIVE_BANDIT_RERANKING_FEATURE_FLAG]: true,
      [KONLING_LONG_TERM_MEMORY_FEATURE_FLAG]: true,
    },
    prerequisites: {
      'stage-1-path-contracts': { available: true },
      'konling-runtime-contracts': { available: true },
      'teacher-governance-workspace': { available: true },
      'privacy-audit': { available: true },
      'evaluation-metrics': { available: true },
      'resource-node-management': { available: true },
    },
    assignments: [assignment],
    metricSummaries: ADAPTIVE_EXPERIMENT_REQUIRED_METRICS.map(metric),
    bandit: {
      policyFamily: 'rules-plus-graph-bandit',
      applied: true,
      reason: 'local-alternatives-reranked',
      alternatives: [],
      rejected: [{ nodeId: 'blocked-node', reason: 'blocked-alternative' }],
    },
    memoryGate: {
      enabled: true,
      semanticMemoryEnabled: true,
      strategyMemoryEnabled: true,
      rollbackFeatureFlag: KONLING_LONG_TERM_MEMORY_FEATURE_FLAG,
      reasons: [],
    },
    memoryAuditEntries: [
      {
        id: 'memory-1',
        kind: 'semantic-memory',
        summary: '偏好结构化推导材料。',
        privacyScope: 'audit-only',
        evidenceWindowHours: 168,
        auditOnlyRawAvailable: true,
        rawMemoryContent: 'private memory secret',
        rawDialogueText: 'private dialogue secret',
        privateInterventionContent: 'private intervention secret',
      },
    ],
    resourceNodeOperations: {
      bulkMappingEnabled: true,
      policyReviewRequiredCount: 2,
      coverage: {
        totalNodes: 10,
        mappedNodes: 7,
        pathEligibleNodes: 6,
        coverageRatio: 0.7,
      },
      systemIssues: [
        {
          code: 'node-1:hidden-evaluation',
          message: '隐藏评测来源需要系统分诊。',
          severity: 'warning',
        },
      ],
    },
    ...overrides,
  };
}

describe('adaptive experiment operations UI contracts', () => {
  it('keeps Stage 2 operations unavailable with explicit feature flag and prerequisite reasons', () => {
    const workspace = buildAdaptiveExperimentOperationsWorkspace(input({
      featureFlags: {
        [ADAPTIVE_EXPERIMENT_OPERATIONS_UI_FEATURE_FLAG]: false,
        [ADAPTIVE_OPTIMIZATION_EXPERIMENTS_FEATURE_FLAG]: true,
      },
      prerequisites: {
        'stage-1-path-contracts': { available: false, reason: 'stage-1-metrics-unstable' },
        'konling-runtime-contracts': { available: true },
        'teacher-governance-workspace': { available: true },
        'privacy-audit': { available: true },
        'evaluation-metrics': { available: true },
        'resource-node-management': { available: true },
      },
    }));

    expect(workspace.availability).toBe('unavailable');
    expect(workspace.status.categories.readiness).toBe('blocked');
    expect(workspace.unavailableReasons).toEqual(expect.arrayContaining([
      `feature-flag:${ADAPTIVE_EXPERIMENT_OPERATIONS_UI_FEATURE_FLAG}`,
      'prerequisite:stage-1-path-contracts:stage-1-metrics-unstable',
    ]));
    expect(workspace.panels.find((panel) => panel.id === 'stage-2-prerequisites')?.status.categories.readiness).toBe('blocked');
    expect(workspace.panels.find((panel) => panel.id === 'system-owned-issue-triage')?.availability).toBe('unavailable');
    expect(workspace.panels.find((panel) => panel.id === 'system-owned-issue-triage')?.status.categories.readiness).toBe('blocked');
    expect(workspace.memoryAudit[0]?.rawPayloadVisible).toBe(false);
  });

  it('defines assignment, variant, and required aggregate metric panels with confidence markers', () => {
    const workspace = buildAdaptiveExperimentOperationsWorkspace(input());

    expect(workspace.panels.find((panel) => panel.id === 'experiment-assignment-health')?.details).toContainEqual(
      expect.objectContaining({ label: '分层', value: 'medium' }),
    );
    expect(workspace.panels.find((panel) => panel.id === 'experiment-variant-outcomes')?.metric).toBe('1 variants');
    for (const metricName of ADAPTIVE_EXPERIMENT_REQUIRED_METRICS) {
      const metricPanel = workspace.panels.find((panel) => panel.id.startsWith(`metric-${metricName}`));
      expect(metricPanel?.details).toContainEqual(expect.objectContaining({ label: 'privacyAggregationLevel', value: 'variant-aggregate' }));
      expect(metricPanel?.status.categories.confidence).not.toBe('unknown');
    }
    expect(workspace.status.categories.sourceCoverage).toBe('complete');
  });

  it('keeps metric panels and export rows separate per variant and aggregation scope', () => {
    const workspace = buildAdaptiveExperimentOperationsWorkspace(input({
      metricSummaries: [
        metric('path-adoption'),
        {
          ...metric('path-adoption'),
          variant: 'rules-graph-bandit',
          sampleCount: 8,
          value: 0.41,
          confidence: 'medium',
          privacyAggregationLevel: 'class-aggregate',
          classId: 'class-1',
        },
      ],
    }));
    const exported = buildAdaptiveExperimentOperationsExport(workspace);
    const pathAdoptionRows = exported.rows.filter((row) => row.metric === 'path-adoption');

    expect(pathAdoptionRows).toEqual(expect.arrayContaining([
      expect.objectContaining({
        variant: 'rules-graph-path',
        sampleCount: 24,
        value: 0.62,
        confidence: 'high',
        privacyAggregationLevel: 'variant-aggregate',
      }),
      expect.objectContaining({
        variant: 'rules-graph-bandit',
        classId: 'class-1',
        sampleCount: 8,
        value: 0.41,
        confidence: 'medium',
        privacyAggregationLevel: 'class-aggregate',
      }),
    ]));
  });

  it('encodes bandit as local reranking after deterministic feasibility constraints', () => {
    const workspace = buildAdaptiveExperimentOperationsWorkspace(input());
    const banditPanel = workspace.panels.find((panel) => panel.id === 'local-bandit-comparison');

    expect(workspace.deterministicBanditConstraints).toEqual(ADAPTIVE_EXPERIMENT_BANDIT_CONSTRAINTS);
    expect(banditPanel?.details).toContainEqual(expect.objectContaining({
      label: '约束先行',
      value: 'prerequisites, privacy, availability, teacher-policy, device, time',
    }));
    expect(banditPanel?.metric).toBe('local-alternatives-reranked');
  });

  it('exports only privacy-safe aggregate metric rows and redacts memory payloads by default', () => {
    const workspace = buildAdaptiveExperimentOperationsWorkspace(input());
    const exported = buildAdaptiveExperimentOperationsExport(workspace);

    expect(exported.rows).toHaveLength(ADAPTIVE_EXPERIMENT_REQUIRED_METRICS.length);
    expect(exported.rows[0]).toMatchObject({
      variant: 'rules-graph-path',
      privacyAggregationLevel: 'variant-aggregate',
      sampleCount: expect.any(Number),
      value: expect.any(Number),
    });
    expect(workspace.memoryAudit[0]).toMatchObject({
      rawPayloadVisible: false,
      redactionMarkers: expect.arrayContaining(['raw-memory-hidden', 'raw-dialogue-hidden', 'private-intervention-hidden']),
    });
    expect(JSON.stringify(exported)).not.toContain('private memory secret');
    expect(JSON.stringify(workspace.memoryAudit)).not.toContain('private dialogue secret');
  });

  it('allows audit-only raw memory visibility only for audit role', () => {
    const auditWorkspace = buildAdaptiveExperimentOperationsWorkspace(input({ role: 'audit' }));
    const adminWorkspace = buildAdaptiveExperimentOperationsWorkspace(input({ role: 'admin' }));
    const disabledMemoryWorkspace = buildAdaptiveExperimentOperationsWorkspace(input({
      role: 'audit',
      featureFlags: {
        [ADAPTIVE_EXPERIMENT_OPERATIONS_UI_FEATURE_FLAG]: true,
        [ADAPTIVE_OPTIMIZATION_EXPERIMENTS_FEATURE_FLAG]: true,
        [KONLING_LONG_TERM_MEMORY_FEATURE_FLAG]: false,
      },
    }));

    expect(auditWorkspace.memoryAudit[0]?.rawPayloadVisible).toBe(true);
    expect(adminWorkspace.memoryAudit[0]?.rawPayloadVisible).toBe(false);
    expect(disabledMemoryWorkspace.panels.find((panel) => panel.id === 'long-term-memory-audit')?.availability).toBe('disabled');
    expect(disabledMemoryWorkspace.memoryAudit[0]?.rawPayloadVisible).toBe(false);
  });

  it('keeps teacher bulk operations permissioned and reserves system issue triage for admin or audit roles', () => {
    const teacherWorkspace = buildAdaptiveExperimentOperationsWorkspace(input({ role: 'teacher' }));
    const adminWorkspace = buildAdaptiveExperimentOperationsWorkspace(input({ role: 'admin' }));

    expect(teacherWorkspace.bulkActions).toContainEqual(expect.objectContaining({
      id: 'bulk-mapping',
      enabled: true,
      roleScope: 'teacher-scoped',
    }));
    expect(teacherWorkspace.bulkActions).toContainEqual(expect.objectContaining({
      id: 'system-owned-issue-triage',
      enabled: false,
      reason: 'admin-or-audit-required',
    }));
    expect(adminWorkspace.bulkActions).toContainEqual(expect.objectContaining({
      id: 'system-owned-issue-triage',
      enabled: true,
    }));
    expect(teacherWorkspace.panels.find((panel) => panel.id === 'system-owned-issue-triage')?.status.categories.privacy).toBe('restricted');
  });
});
