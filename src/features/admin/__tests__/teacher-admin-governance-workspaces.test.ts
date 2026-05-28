import { describe, expect, it } from 'vitest';

import {
  ADMIN_DATA_CENTER_GOVERNANCE_PANELS,
  TEACHER_GOVERNANCE_WORKSPACE_REGIONS,
  buildAdminDataCenterExportSummary,
  buildAdminDataCenterWorkspace,
  buildTeacherGovernanceWorkspace,
} from '../teacher-admin-governance-workspaces';
import type { GovernanceStatusPayload } from '../data-governance-overview';
import type { TeacherResourceNodeView } from '@/lib/teacher-resource-node-management';

function resourceNodeView(overrides: Partial<TeacherResourceNodeView> = {}): TeacherResourceNodeView {
  return {
    id: 'teaching-resource:control-case',
    title: '控制案例讲解',
    description: '带路径规划元数据的教师资源',
    type: 'lesson',
    courseModule: 'module-5',
    sourceKind: 'teaching_resource',
    sourceRefs: [{ kind: 'teaching_resource', ref: 'owned-resource' }],
    renderTarget: '/teacher/resources/owned-resource',
    launchTarget: '/learn/control-case',
    knowledgeCoverage: ['root-locus'],
    prerequisites: ['time-domain'],
    estimatedTimeMinutes: 18,
    cognitiveLoad: 'medium',
    availability: 'available',
    teacherPolicy: 'allowed',
    privacyLevel: 'student-visible',
    evidenceInstrumentationConfigured: true,
    pathEligible: true,
    pathExclusionReasons: [],
    warnings: [],
    editable: true,
    ...overrides,
  };
}

function governancePayload(overrides: Partial<GovernanceStatusPayload> = {}): GovernanceStatusPayload {
  return {
    status: 'warning',
    timestamp: '2026-05-28T08:00:00.000Z',
    freshness: {
      lastSnapshotMinutes: 45,
      status: 'stale',
    },
    data: {
      studentSnapshots: 80,
      classSnapshots: 6,
      learningFacts: 420,
      activeRiskFlags: 3,
      bufferedEvents: 5,
    },
    queues: {
      eventIngestion: { waiting: 1, active: 1, completed: 30, failed: 0 },
      studentSnapshot: { waiting: 2, active: 0, completed: 25, failed: 1 },
      classSnapshot: { waiting: 0, active: 0, completed: 8, failed: 0 },
    },
    factTypeDistribution: [{ label: '仿真实验', count: 120 }],
    featureCache: {
      payloadVersion: 'student-evidence-features.v1',
      totalEntries: 12,
      staleEntries: 3,
      latestRefreshAt: '2026-05-28T07:30:00.000Z',
      totalSourceFacts: 240,
      totalRebuilds: 9,
      coverage: {
        SimulationRun: { available: 4, missing: 2 },
      },
    },
    sourceCoverage: {
      generatedAt: '2026-05-28T07:45:00.000Z',
      catalogVersion: '2026-05-28',
      totals: {
        totalRows: 20,
        eligibleRows: 12,
        excludedRows: 5,
        unsupportedRows: 3,
        affectedUsers: 7,
      },
      sources: [],
      exclusions: [
        {
          sourceId: 'ArenaEvaluationRun',
          reason: 'hidden_official_evaluation_internal',
          rowCount: 2,
          affectedUsers: 2,
          sampleSourceReference: 'ArenaEvaluationRun:official-secret-1',
        },
      ],
    },
    sourceCatalog: {
      totalSources: 2,
      coverageCommand: 'npm run db:evidence-source-coverage -- --text',
      sources: [
        {
          id: 'SimulationRun',
          learningScope: 'historical',
          valueLevel: 'high',
          eligibility: 'eligible',
          materializationReadiness: 'ready',
          totalRows: 12,
          eligibleRows: 12,
          excludedRows: 0,
          unsupportedRows: 0,
          affectedUsers: 5,
        },
        {
          id: 'ArenaEvaluationRun',
          learningScope: 'official-evaluation',
          valueLevel: 'high',
          eligibility: 'unsupported',
          materializationReadiness: 'future',
          totalRows: 8,
          eligibleRows: 0,
          excludedRows: 5,
          unsupportedRows: 3,
          affectedUsers: 2,
          exclusionReasons: ['hidden_official_evaluation_internal'],
        },
      ],
    },
    recentRiskFlags: [],
    recentSnapshots: [],
    topSnapshotStudents: [],
    ...overrides,
  };
}

describe('teacher and admin governance workspace contracts', () => {
  it('wraps teacher ResourceNode management without redefining edit ownership or homepage scope', () => {
    const view = buildTeacherGovernanceWorkspace({
      role: 'teacher',
      nodes: [resourceNodeView()],
      summary: {
        totalNodes: 1,
        pathEligibleNodes: 1,
        warningNodes: 0,
        excludedNodes: 0,
      },
    });

    expect(TEACHER_GOVERNANCE_WORKSPACE_REGIONS).toEqual([
      'resource-node-browse',
      'resource-node-search-filters',
      'warning-summary',
      'node-detail',
      'single-node-edit',
      'path-eligibility',
    ]);
    expect(view.managementCapability).toBe('teacher-resource-node-management');
    expect(view.permittedEditFields).toContain('planningMetadata.teacherPolicy');
    expect(view.immutableFields).toEqual(expect.arrayContaining(['sourceRef', 'hiddenEvaluationInternals']));
    expect(view.outOfScope).toContain('teacher-homepage-dashboard-redesign');
  });

  it('keeps teacher warning display and edit permissions scoped to existing node views', () => {
    const view = buildTeacherGovernanceWorkspace({
      role: 'teacher',
      nodes: [
        resourceNodeView({
          id: 'teaching-resource:blocked',
          pathEligible: false,
          editable: false,
          evidenceInstrumentationConfigured: false,
          pathExclusionReasons: ['missing-evidence-instrumentation'],
          warnings: [
            {
              code: 'missing-evidence-instrumentation',
              message: '缺少学习证据采集。',
              severity: 'blocking',
            },
          ],
        }),
      ],
      summary: {
        totalNodes: 1,
        pathEligibleNodes: 0,
        warningNodes: 1,
        excludedNodes: 1,
      },
    });

    expect(view.warningSummary.blocking).toBe(1);
    expect(view.status.categories.readiness).toBe('blocked');
    expect(view.status.categories.sourceCoverage).toBe('partial');
    expect(view.nodes[0]).toMatchObject({
      nodeId: 'teaching-resource:blocked',
      canEdit: false,
      warnings: [
        expect.objectContaining({
          code: 'missing-evidence-instrumentation',
          roleScope: 'teacher-scoped',
        }),
      ],
    });
    expect(view.nodes[0]?.fields).toContainEqual(
      expect.objectContaining({
        id: 'evidence-instrumentation',
        value: '未配置',
      }),
    );
  });

  it('redacts restricted payload categories for teacher and admin governance views', () => {
    const teacher = buildTeacherGovernanceWorkspace({
      role: 'teacher',
      nodes: [resourceNodeView({ privacyLevel: 'admin-scoped' })],
      summary: {
        totalNodes: 1,
        pathEligibleNodes: 1,
        warningNodes: 0,
        excludedNodes: 0,
      },
    });

    expect(teacher.redactions.map((item) => item.category)).toEqual(
      expect.arrayContaining([
        'hidden-official-evaluation-internals',
        'private-learner-evidence',
        'raw-answers',
        'raw-traces',
        'private-konling-memory',
      ]),
    );
    expect(teacher.redactions.every((item) => item.exposesRawPayload === false)).toBe(true);
    expect(teacher.nodes[0]?.fields.find((field) => field.id === 'privacy-level')).toMatchObject({
      value: '受限摘要',
      restricted: true,
    });
  });

  it('separates admin presentation and governance-audit data-center panels', () => {
    const audit = buildAdminDataCenterWorkspace({
      mode: 'governance-audit',
      payload: governancePayload(),
    });
    const presentation = buildAdminDataCenterWorkspace({
      mode: 'presentation',
      payload: governancePayload(),
    });

    expect(ADMIN_DATA_CENTER_GOVERNANCE_PANELS).toEqual([
      'source-coverage',
      'readiness',
      'missing-context',
      'replay-confidence',
      'privacy-status',
      'evaluation-events',
    ]);
    expect(audit.panels.map((panel) => panel.id)).toEqual(ADMIN_DATA_CENTER_GOVERNANCE_PANELS);
    expect(audit.status.categories.readiness).toBe('degraded');
    expect(audit.status.categories.sourceCoverage).toBe('partial');
    expect(audit.drilldownLimits.allowSampleReferences).toBe(false);
    expect(presentation.panels.map((panel) => panel.id)).toEqual(['presentation-summary', 'source-coverage']);
    expect(presentation.drilldownLimits.maxRowsPerPanel).toBeLessThan(audit.drilldownLimits.maxRowsPerPanel);
  });

  it('builds export-safe governance summaries without raw references or private identifiers', () => {
    const summary = buildAdminDataCenterExportSummary(governancePayload());

    expect(summary.rows).toContainEqual({
      sourceId: 'ArenaEvaluationRun',
      reason: 'hidden_official_evaluation_internal',
      rowCount: 2,
      affectedUsers: 2,
    });
    expect(JSON.stringify(summary)).not.toContain('official-secret-1');
    expect(JSON.stringify(summary)).not.toContain('sampleSourceReference');
  });

  it('keeps healthy privacy and replay status internally consistent', () => {
    const workspace = buildAdminDataCenterWorkspace({
      mode: 'governance-audit',
      payload: governancePayload({
        status: 'healthy',
        freshness: {
          lastSnapshotMinutes: 5,
          status: 'fresh',
        },
        queues: {
          eventIngestion: { waiting: 0, active: 0, completed: 30, failed: 0 },
          studentSnapshot: { waiting: 0, active: 0, completed: 25, failed: 0 },
          classSnapshot: { waiting: 0, active: 0, completed: 8, failed: 0 },
        },
        featureCache: {
          payloadVersion: 'student-evidence-features.v1',
          totalEntries: 12,
          staleEntries: 0,
          latestRefreshAt: '2026-05-28T07:30:00.000Z',
          totalSourceFacts: 240,
          totalRebuilds: 9,
          coverage: {
            SimulationRun: { available: 6, missing: 0 },
          },
        },
        sourceCoverage: {
          generatedAt: '2026-05-28T07:45:00.000Z',
          catalogVersion: '2026-05-28',
          totals: {
            totalRows: 12,
            eligibleRows: 12,
            excludedRows: 0,
            unsupportedRows: 0,
            affectedUsers: 5,
          },
          sources: [],
          exclusions: [],
        },
      }),
    });

    expect(workspace.panels.find((panel) => panel.id === 'privacy-status')?.status.categories.readiness).toBe('ready');
    expect(workspace.panels.find((panel) => panel.id === 'replay-confidence')?.status.categories.replay).toBe('ready');
  });

  it('uses official evaluation status when evaluation events are not hidden', () => {
    const workspace = buildAdminDataCenterWorkspace({
      mode: 'governance-audit',
      payload: governancePayload({
        sourceCoverage: {
          generatedAt: '2026-05-28T07:45:00.000Z',
          catalogVersion: '2026-05-28',
          totals: {
            totalRows: 12,
            eligibleRows: 12,
            excludedRows: 0,
            unsupportedRows: 0,
            affectedUsers: 5,
          },
          sources: [],
          exclusions: [],
        },
        sourceCatalog: {
          totalSources: 1,
          coverageCommand: 'npm run db:evidence-source-coverage -- --text',
          sources: [
            {
              id: 'ArenaEvaluationRun',
              learningScope: 'official-evaluation',
              valueLevel: 'high',
              eligibility: 'eligible',
              materializationReadiness: 'ready',
            },
          ],
        },
      }),
    });

    expect(workspace.status.categories.evaluation).toBe('official');
    expect(workspace.panels.find((panel) => panel.id === 'evaluation-events')?.status.categories.evaluation).toBe('official');
  });

  it('degrades governance readiness when snapshots are stale even without queue failures', () => {
    const workspace = buildAdminDataCenterWorkspace({
      mode: 'governance-audit',
      payload: governancePayload({
        status: 'healthy',
        freshness: {
          lastSnapshotMinutes: 180,
          status: 'stale',
        },
        queues: {
          eventIngestion: { waiting: 0, active: 0, completed: 30, failed: 0 },
          studentSnapshot: { waiting: 0, active: 0, completed: 25, failed: 0 },
          classSnapshot: { waiting: 0, active: 0, completed: 8, failed: 0 },
        },
      }),
    });

    expect(workspace.status.categories.readiness).toBe('degraded');
    expect(workspace.panels.find((panel) => panel.id === 'readiness')?.status.categories.readiness).toBe('degraded');
  });

  it('degrades source coverage for excluded-only rows and restricts hidden evaluation details', () => {
    const workspace = buildAdminDataCenterWorkspace({
      mode: 'governance-audit',
      payload: governancePayload({
        sourceCoverage: {
          generatedAt: '2026-05-28T07:45:00.000Z',
          catalogVersion: '2026-05-28',
          totals: {
            totalRows: 10,
            eligibleRows: 8,
            excludedRows: 2,
            unsupportedRows: 0,
            affectedUsers: 2,
          },
          sources: [],
          exclusions: [
            {
              sourceId: 'ArenaEvaluationRun',
              reason: 'hidden_official_evaluation_internal',
              rowCount: 2,
              affectedUsers: 2,
              sampleSourceReference: 'ArenaEvaluationRun:official-secret-2',
            },
          ],
        },
      }),
    });

    expect(workspace.panels.find((panel) => panel.id === 'source-coverage')?.status.categories.readiness).toBe('degraded');
    expect(workspace.panels.find((panel) => panel.id === 'missing-context')?.details).toContainEqual(
      expect.objectContaining({
        label: 'ArenaEvaluationRun',
        roleScope: 'audit-only',
        restricted: true,
      }),
    );
  });

  it('limits missing-context drilldown details to the governance audit row cap', () => {
    const exclusions = Array.from({ length: 55 }, (_, index) => ({
      sourceId: `Source${index + 1}`,
      reason: 'low_value_activity_context',
      rowCount: 1,
      affectedUsers: 1,
      sampleSourceReference: `Source:${index + 1}`,
    }));
    const workspace = buildAdminDataCenterWorkspace({
      mode: 'governance-audit',
      payload: governancePayload({
        sourceCoverage: {
          generatedAt: '2026-05-28T07:45:00.000Z',
          catalogVersion: '2026-05-28',
          totals: {
            totalRows: 55,
            eligibleRows: 0,
            excludedRows: 55,
            unsupportedRows: 0,
            affectedUsers: 55,
          },
          sources: [],
          exclusions,
        },
      }),
    });

    const missingContext = workspace.panels.find((panel) => panel.id === 'missing-context');

    expect(workspace.drilldownLimits.maxRowsPerPanel).toBe(50);
    expect(missingContext?.details).toHaveLength(50);
    expect(missingContext?.details.at(-1)).toMatchObject({
      label: '其余排除项',
      value: '6 条已按聚合方式隐藏',
    });
  });

  it('treats empty evidence source coverage as missing rather than complete', () => {
    const workspace = buildAdminDataCenterWorkspace({
      mode: 'governance-audit',
      payload: governancePayload({
        sourceCoverage: {
          generatedAt: '2026-05-28T07:45:00.000Z',
          catalogVersion: '2026-05-28',
          totals: {
            totalRows: 0,
            eligibleRows: 0,
            excludedRows: 0,
            unsupportedRows: 0,
            affectedUsers: 0,
          },
          sources: [],
          exclusions: [],
        },
      }),
    });

    expect(workspace.status.categories.sourceCoverage).toBe('missing');
    expect(workspace.status.categories.fallback).toBe('fallback-missing-context');
    expect(workspace.panels.find((panel) => panel.id === 'source-coverage')?.status.categories.sourceCoverage).toBe('missing');
  });
});
