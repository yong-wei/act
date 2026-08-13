import { describe, expect, it, vi } from 'vitest';
import type { LearningFact } from '@prisma/client';
import { createEmptyCompetencyVector } from '../competency-model';
import { PORTRAIT_V2_DIMENSIONS } from '../kaq-objective-taxonomy';
import type { LearningEvent } from '../event-protocol';
import { eventToLearningFactInput } from '../learning-fact-materialization';
import {
  createPortraitV2Payload,
  derivePortraitV2Compatibility,
  PORTRAIT_V2_CALCULATION_VERSION,
} from '../portrait-v2-model';
import {
  buildKnowledgeIdentityCoverage,
  buildKnowledgeIdentityLayers,
  buildStudentEvidenceFeaturePayload,
  getStudentEvidenceFeatureCacheAdminSummary,
  readStudentEvidenceFeatures,
  rebuildStudentEvidenceFeatureCache,
  refreshStudentEvidenceFeatureCache,
  STUDENT_EVIDENCE_FEATURE_PAYLOAD_VERSION,
} from '../student-evidence-feature-cache';

function governedContext(context: unknown) {
  const base = context && typeof context === 'object' && !Array.isArray(context)
    ? context as Record<string, unknown>
    : {};
  const declaredGovernance = base.evidenceGovernance;
  const evidenceGovernance = declaredGovernance && typeof declaredGovernance === 'object' && !Array.isArray(declaredGovernance)
    ? declaredGovernance
    : {};
  return {
    ...base,
    evidenceGovernance: {
      evidenceQuality: 'rich',
      profileWeight: 1,
      skipProfileContribution: false,
      policyReason: 'rich_objective_evidence',
      ...evidenceGovernance,
    },
  };
}

function fact(overrides: Partial<LearningFact> = {}): LearningFact {
  const { contextJson, ...rest } = overrides;
  return {
    id: 'fact-1',
    userId: 'student-1',
    factType: 'question',
    moduleId: 'module-1',
    sessionId: 'session-1',
    startedAt: new Date('2026-05-01T10:00:00.000Z'),
    finishedAt: new Date('2026-05-01T10:05:00.000Z'),
    outcome: 'success',
    score: 80,
    timeSpent: 300,
    competencyContribution: { controlModeling: 0.8 },
    sourceEventId: 'event-1',
    sourceLogId: 'log-1',
    courseId: 'course-1',
    lessonId: 'lesson-1',
    contextJson: governedContext(contextJson),
    knowledgeIdentityNamespace: null,
    canonicalObjectId: null,
    aggregateReleaseSetId: null,
    aggregateReleaseId: null,
    knowledgeProjectionId: null,
    knowledgeRevisionRef: null,
    createdAt: new Date('2026-05-01T10:05:00.000Z'),
    ...rest,
  };
}

function clientArenaEvaluationEvent(overrides: Partial<LearningEvent> = {}): LearningEvent {
  return {
    eventId: 'client-event:arena_evaluation_complete:fake',
    occurredAt: '2026-05-20T10:05:00.000Z',
    userId: 'student-1',
    role: 'student',
    courseId: 'control-correction',
    lessonId: 'task-preview',
    sessionId: 'session-1',
    pagePath: '/arena/task-preview',
    pageType: 'simulation',
    moduleId: 'task-preview',
    actionType: 'arena_evaluation_complete',
    targetType: 'arena-task',
    targetId: 'task-preview',
    payload: {
      taskId: 'task-preview',
      score: 100,
      valid: true,
      eventType: 'arena_evaluation_complete',
    },
    source: 'web',
    priority: 'core',
    ...overrides,
  };
}

describe('buildStudentEvidenceFeaturePayload', () => {
  it('excludes ungoverned facts from source activity and competency features', () => {
    const payload = buildStudentEvidenceFeaturePayload({
      userId: 'student-1',
      facts: [{ ...fact(), contextJson: {} }],
      now: new Date('2026-05-21T00:00:00.000Z'),
    });

    expect(payload.sourceCounts.LearningFact).toBe(0);
    expect(payload.features.competencyContributions.controlModeling.evidenceCount).toBe(0);
  });

  it('excludes context-only facts from feature activity and evidence windows', () => {
    const payload = buildStudentEvidenceFeaturePayload({
      userId: 'student-1',
      facts: [
        fact({
          id: 'zero-weight',
          contextJson: governedContext({
            evidenceGovernance: { profileWeight: 0 },
          }),
        }),
        fact({
          id: 'skipped',
          factType: 'media',
          startedAt: new Date('2026-05-20T10:00:00.000Z'),
          contextJson: governedContext({
            evidenceGovernance: { skipProfileContribution: true },
          }),
        }),
      ],
      now: new Date('2026-05-21T00:00:00.000Z'),
    });

    expect(payload.sourceCounts.LearningFact).toBe(0);
    expect(payload.evidenceWindow).toEqual({
      firstStartedAt: null,
      lastStartedAt: null,
      daysCovered: 0,
    });
    expect(payload.features.activity.totalFacts).toBe(0);
  });

  it('reports multi-era knowledge identity coverage without reinterpreting historical scores', () => {
    const now = new Date('2026-07-30T00:00:00.000Z');
    const mixedFacts = [
      fact({
        id: 'unversioned',
        knowledgeIdentityNamespace: null,
        knowledgeRevisionRef: null,
        competencyContribution: { controlModeling: 0.5 },
        startedAt: new Date('2026-01-01T00:00:00.000Z'),
        finishedAt: new Date('2026-01-01T00:00:00.000Z'),
      }),
      fact({
        id: 'legacy',
        knowledgeIdentityNamespace: 'LEGACY',
        knowledgeRevisionRef: 'legacy-active:pre-cutover-v1',
        competencyContribution: { controlModeling: 0.6 },
        startedAt: new Date('2026-05-01T00:00:00.000Z'),
        finishedAt: new Date('2026-05-01T00:00:00.000Z'),
      }),
      fact({
        id: 'canonical',
        knowledgeIdentityNamespace: 'CANONICAL',
        knowledgeRevisionRef: 'a'.repeat(64),
        canonicalObjectId: 'ctr:object:feedback-loop',
        aggregateReleaseSetId: 'rs',
        aggregateReleaseId: 'rel',
        knowledgeProjectionId: 'proj',
        competencyContribution: { controlModeling: 0.7 },
        startedAt: new Date('2026-07-30T00:00:00.000Z'),
        finishedAt: new Date('2026-07-30T00:00:00.000Z'),
      }),
    ];
    const payload = buildStudentEvidenceFeaturePayload({
      userId: 'student-1',
      now,
      facts: mixedFacts,
    });

    expect(payload.payloadVersion).toBe(STUDENT_EVIDENCE_FEATURE_PAYLOAD_VERSION);
    expect(payload.knowledgeIdentityCoverage).toMatchObject({
      totalFacts: 3,
      mixedNamespaces: true,
      mixedRevisions: true,
      singleVersionComparable: false,
      availability: 'mixed-version',
      byNamespace: {
        LEGACY_UNVERSIONED: 1,
        LEGACY: 1,
        CANONICAL: 1,
      },
    });
    expect(payload.mergedAggregateComparability).toEqual({
      singleVersionComparable: false,
      reason: 'mixed-layers',
      layerCount: 3,
    });
    expect(payload.statusMarkers).toEqual(
      expect.arrayContaining(['mixed-knowledge-identity', 'partial']),
    );
    // Historical scores remain aggregated for continuity (not recomputed).
    expect(payload.features.competencyContributions.controlModeling.evidenceCount).toBe(3);

    // Per-identity-layer aggregates: deterministic namespace order + revision totals.
    expect(payload.knowledgeIdentityLayers.map((layer) => layer.identityNamespace)).toEqual([
      'LEGACY_UNVERSIONED',
      'LEGACY',
      'CANONICAL',
    ]);
    expect(payload.knowledgeIdentityLayers.map((layer) => layer.factCount)).toEqual([1, 1, 1]);
    expect(payload.knowledgeIdentityLayers[0]).toMatchObject({
      knowledgeRevisionRef: 'legacy-unversioned',
      factCount: 1,
      competencyContributions: {
        controlModeling: expect.objectContaining({ evidenceCount: 1, averageContribution: 0.5 }),
      },
    });
    expect(payload.knowledgeIdentityLayers[1]).toMatchObject({
      knowledgeRevisionRef: 'legacy-active:pre-cutover-v1',
      factCount: 1,
      competencyContributions: {
        controlModeling: expect.objectContaining({ evidenceCount: 1, averageContribution: 0.6 }),
      },
    });
    expect(payload.knowledgeIdentityLayers[2]).toMatchObject({
      knowledgeRevisionRef: 'a'.repeat(64),
      factCount: 1,
      competencyContributions: {
        controlModeling: expect.objectContaining({ evidenceCount: 1, averageContribution: 0.7 }),
      },
    });
    // Layer helper is deterministic for the same inputs.
    expect(buildKnowledgeIdentityLayers(mixedFacts)).toEqual(payload.knowledgeIdentityLayers);
    // Identity diagnostics must also live inside features for Prisma JSON persistence.
    expect(payload.features.knowledgeIdentityCoverage).toEqual(payload.knowledgeIdentityCoverage);
    expect(payload.features.knowledgeIdentityLayers).toEqual(payload.knowledgeIdentityLayers);
    expect(payload.features.mergedAggregateComparability).toEqual(payload.mergedAggregateComparability);

    const single = buildKnowledgeIdentityCoverage([
      fact({
        id: 'only-legacy',
        knowledgeIdentityNamespace: 'LEGACY',
        knowledgeRevisionRef: 'legacy-active:pre-cutover-v1',
      }),
    ]);
    expect(single).toMatchObject({
      singleVersionComparable: true,
      availability: 'single-version',
      mixedNamespaces: false,
    });
  });

  it('uses portrait v2 as the primary competency source without inventing a legacy snapshot', () => {
    const now = new Date('2026-05-19T00:00:00.000Z');
    const vector = createEmptyCompetencyVector();
    for (const entry of Object.values(vector)) {
      entry.score = 70;
      entry.confidence = 0.8;
      entry.evidenceCount = 3;
      entry.lastUpdated = now.toISOString();
    }
    const portrait = derivePortraitV2Compatibility({
      userId: 'student-1',
      snapshotId: 'portrait-v2-only',
      snapshotAt: now.toISOString(),
      sourceFamily: 'StudentCompetencySnapshot',
      vector,
      now,
    });

    const payload = buildStudentEvidenceFeaturePayload({
      userId: 'student-1',
      now,
      facts: [fact({ startedAt: now, finishedAt: now })],
      latestPortraitV2: { payload: portrait },
      profileSummary: {
        updatedAt: now,
        overallScore: 70,
        riskLevel: 'low',
        trendDirection: 'stable',
      },
    });

    expect(payload.sourceCounts).toMatchObject({
      StudentCompetencySnapshot: 0,
      StudentPortraitV2Snapshot: 1,
    });
    expect(payload.sourceCoverage).toMatchObject({
      StudentCompetencySnapshot: 'missing',
      StudentPortraitV2Snapshot: 'available',
    });
    expect(payload.statusMarkers).not.toContain('missing-source');
    expect(payload.features.adaptiveLearnerState.sourceCoverage.primaryCompetencies).toBe('available');
  });

  it('does not treat an evidence-free native portrait as available primary competencies', () => {
    const now = new Date('2026-05-19T00:00:00.000Z');
    const portrait = createPortraitV2Payload({
      userId: 'student-1',
      generatedAt: now.toISOString(),
      now,
      derivation: { kind: 'native', limitations: [] },
      dimensions: PORTRAIT_V2_DIMENSIONS.map(({ id }) => ({
        id,
        score: 0,
        confidence: 0,
        trend: 'stable' as const,
        freshness: { state: 'missing' as const, asOf: null, evidenceAgeDays: null },
        evidenceSummary: { totalCount: 0, sourceFamilyCounts: {} },
        lastPositiveEvidenceAt: null,
        lastNegativeEvidenceAt: null,
        rationale: 'No safe legacy mapping exists.',
        limitations: ['missing-native-portrait-v2-evidence'],
        sourceLineage: [],
        calculationVersion: PORTRAIT_V2_CALCULATION_VERSION,
      })),
    });

    const payload = buildStudentEvidenceFeaturePayload({
      userId: 'student-1',
      now,
      facts: [fact({ startedAt: now, finishedAt: now })],
      latestPortraitV2: { payload: portrait },
      profileSummary: {
        updatedAt: now,
        overallScore: 0,
        riskLevel: 'low',
        trendDirection: 'stable',
      },
    });

    expect(payload.sourceCoverage.StudentPortraitV2Snapshot).toBe('missing');
    expect(payload.sourceCounts.StudentPortraitV2Snapshot).toBe(0);
    expect(payload.statusMarkers).toContain('missing-source');
    expect(payload.features.adaptiveLearnerState.sourceCoverage.primaryCompetencies).toBe('missing');
  });

  it('derives governed path execution features without raw execution payloads', () => {
    const payload = buildStudentEvidenceFeaturePayload({
      userId: 'student-1',
      now: new Date('2026-06-04T12:00:00.000Z'),
      facts: [fact()],
      pathEvidence: {
        executions: [
          {
            id: 'exec-start',
            pathId: 'path-1',
            userId: 'student-1',
            nodeId: 'node-1',
            resourceType: 'simulation',
            status: 'started',
            startedAt: new Date('2026-06-04T10:00:00.000Z'),
            completedAt: null,
            failedAt: null,
            evidenceRefs: [{ kind: 'LearningFact', id: 'fact-1', raw: 'hidden' }],
            liftMetadata: { rawTracePayload: [{ t: 0, y: 1 }] },
            simulationRef: { traceReference: 'SimulationTrace:path-run-1' },
            arenaRef: null,
            idempotencyKey: 'exec-start',
            createdAt: new Date('2026-06-04T10:00:01.000Z'),
            path: { goalId: 'control-correction', terminalValidation: { nodeId: 'terminal-node' } },
          },
          {
            id: 'exec-complete',
            pathId: 'path-1',
            userId: 'student-1',
            nodeId: 'terminal-node',
            resourceType: 'arena_task',
            status: 'completed',
            startedAt: new Date('2026-06-04T10:10:00.000Z'),
            completedAt: new Date('2026-06-04T10:20:00.000Z'),
            failedAt: null,
            evidenceRefs: [{ kind: 'ArenaEvaluationRun', id: 'arena-run-1' }],
            liftMetadata: {},
            simulationRef: null,
            arenaRef: { traceReference: 'ArenaEvaluationRun:path-arena-1', valid: true },
            idempotencyKey: 'exec-terminal',
            createdAt: new Date('2026-06-04T10:20:01.000Z'),
            path: { goalId: 'control-correction', terminalValidation: { nodeId: 'terminal-node' } },
          },
        ],
        deviations: [
          {
            id: 'dev-1',
            pathId: 'path-1',
            userId: 'student-1',
            deviationType: 'resource-failure',
            priorNodeId: 'node-1',
            targetNodeId: 'fallback-node',
            context: { rawReasoning: 'hidden' },
            evidenceConfidence: 'low',
            idempotencyKey: 'dev-key',
            createdAt: new Date('2026-06-04T10:05:00.000Z'),
          },
        ],
        interventions: [
          {
            id: 'int-1',
            pathId: 'path-1',
            userId: 'student-1',
            interventionKind: 'fallback-path',
            citedEvidence: [
              { kind: 'LearningPathDeviation', id: 'dev-1' },
              { kind: 'learning-path-node', ref: 'node-1' },
            ],
            suggestedAction: 'raw model instruction should stay out',
            studentOutcome: 'accepted',
            privacySafeSummary: '改走补救路径。',
            idempotencyKey: 'int-key',
            createdAt: new Date('2026-06-04T10:06:00.000Z'),
          },
        ],
      },
    } as any);

    const pathExecution = (payload.features as any).pathExecution;

    expect(pathExecution.allTime).toMatchObject({
      evidenceCount: 4,
      adoptionCount: 1,
      completionCount: 1,
      deviationCount: 1,
      fallbackCount: 1,
      terminalValidationCount: 1,
      interventionOutcome: {
        acceptedCount: 1,
        completedCount: 0,
        lowConfidenceCount: 1,
      },
      sourceCoverage: {
        adoption: 'available',
        completion: 'available',
        deviation: 'available',
        fallback: 'available',
        terminalValidation: 'available',
        interventionOutcome: 'available',
      },
      confidence: {
        level: 'medium',
      },
    });
    expect(pathExecution.allTime.sourceReferences).toEqual([
      expect.objectContaining({
        sourceType: 'LearningPathExecution',
        sourceId: 'exec-start',
        pathId: 'path-1',
        goalId: 'control-correction',
        nodeId: 'node-1',
        privacyLevel: 'student-visible',
      }),
      expect.objectContaining({
        sourceType: 'LearningPathDeviation',
        sourceId: 'dev-1',
        confidence: 'low',
      }),
      expect.objectContaining({
        sourceType: 'LearningPathIntervention',
        sourceId: 'int-1',
        nodeId: 'node-1',
        studentOutcome: 'accepted',
      }),
      expect.objectContaining({
        sourceType: 'LearningPathExecution',
        sourceId: 'exec-complete',
        goalId: 'control-correction',
        nodeId: 'terminal-node',
      }),
    ]);
    expect(payload.features.adaptiveLearnerState.sourceCoverage.pathContext).toBe('available');
    expect(JSON.stringify(pathExecution)).not.toContain('rawTracePayload');
    expect(JSON.stringify(pathExecution)).not.toContain('raw model instruction');
  });

  it('dedupes repeated path evidence by idempotency keys and stable source ids', () => {
    const payload = buildStudentEvidenceFeaturePayload({
      userId: 'student-1',
      now: new Date('2026-06-04T12:00:00.000Z'),
      facts: [],
      pathEvidence: {
        executions: [
          {
            id: 'exec-1',
            pathId: 'path-1',
            userId: 'student-1',
            nodeId: 'node-1',
            resourceType: 'simulation',
            status: 'completed',
            completedAt: new Date('2026-06-04T10:05:00.000Z'),
            idempotencyKey: 'same-exec',
            createdAt: new Date('2026-06-04T10:05:01.000Z'),
          },
          {
            id: 'exec-duplicate',
            pathId: 'path-1',
            userId: 'student-1',
            nodeId: 'node-1',
            resourceType: 'simulation',
            status: 'completed',
            completedAt: new Date('2026-06-04T10:06:00.000Z'),
            idempotencyKey: 'same-exec',
            createdAt: new Date('2026-06-04T10:06:01.000Z'),
          },
        ],
        deviations: [],
        interventions: [
          {
            id: 'int-1',
            pathId: 'path-1',
            userId: 'student-1',
            interventionKind: 'hint',
            citedEvidence: [{ kind: 'learning-path-node', ref: 'node-1' }],
            studentOutcome: 'accepted',
            privacySafeSummary: '采用提示。',
            idempotencyKey: 'same-int',
            createdAt: new Date('2026-06-04T10:07:00.000Z'),
          },
          {
            id: 'int-duplicate',
            pathId: 'path-1',
            userId: 'student-1',
            interventionKind: 'hint',
            studentOutcome: 'accepted',
            privacySafeSummary: '采用提示。',
            idempotencyKey: 'same-int',
            createdAt: new Date('2026-06-04T10:08:00.000Z'),
          },
        ],
      },
    } as any);

    expect((payload.features as any).pathExecution.allTime).toMatchObject({
      evidenceCount: 2,
      completionCount: 1,
      interventionOutcome: {
        acceptedCount: 1,
      },
    });
  });

  it('does not count path activity records as completions even if legacy rows are completed', () => {
    const activityKinds = [
      'continued-interaction',
      'review',
      'return-to-skipped',
      'external-resource-reference',
      'konling-support',
    ];
    const payload = buildStudentEvidenceFeaturePayload({
      userId: 'student-1',
      now: new Date('2026-06-04T12:00:00.000Z'),
      facts: [],
      pathEvidence: {
        executions: activityKinds.map((activityKind, index) => ({
          id: `exec-activity-${index}`,
          pathId: 'path-1',
          userId: 'student-1',
          nodeId: `node-${index}`,
          resourceType: 'simulation',
          status: 'completed',
          completedAt: new Date(`2026-06-04T10:0${index}:00.000Z`),
          idempotencyKey: `activity-${index}`,
          liftMetadata: { pathActivityKind: activityKind },
          createdAt: new Date(`2026-06-04T10:0${index}:01.000Z`),
        })),
        deviations: [],
        interventions: [],
      },
    } as any);

    expect((payload.features as any).pathExecution.allTime).toMatchObject({
      evidenceCount: activityKinds.length,
      completionCount: 0,
      sourceCoverage: {
        completion: 'missing',
      },
    });
  });

  it('summarizes failed terminal validation executions', () => {
    const payload = buildStudentEvidenceFeaturePayload({
      userId: 'student-1',
      now: new Date('2026-06-04T12:00:00.000Z'),
      facts: [],
      pathEvidence: {
        executions: [
          {
            id: 'exec-terminal-failed',
            pathId: 'path-1',
            userId: 'student-1',
            nodeId: 'simulation:control-correction-step-response-lab',
            resourceType: 'simulation',
            status: 'failed',
            startedAt: new Date('2026-06-04T10:00:00.000Z'),
            completedAt: null,
            failedAt: new Date('2026-06-04T10:03:00.000Z'),
            idempotencyKey: 'terminal-failed',
            createdAt: new Date('2026-06-04T10:03:01.000Z'),
            path: {
              goalId: 'control-correction',
              terminalValidation: {
                nodeId: 'simulation:control-correction-step-response-lab',
                state: 'failed',
                fallbackRequired: true,
                failureReasons: ['simulation-failed'],
                lowConfidenceMarkers: [],
              },
            },
          },
        ],
        deviations: [],
        interventions: [],
      },
    } as any);

    const allTime = (payload.features as any).pathExecution.allTime;
    expect(allTime).toMatchObject({
      evidenceCount: 1,
      fallbackCount: 1,
      terminalValidationCount: 1,
      terminalValidation: {
        latestState: 'failed',
        failedCount: 1,
        fallbackRequiredCount: 1,
        failureReasons: ['simulation-failed'],
      },
    });
    expect(allTime.sourceReferences).toEqual([
      expect.objectContaining({
        sourceId: 'exec-terminal-failed',
        terminalValidationState: 'failed',
        failureReasons: ['simulation-failed'],
      }),
    ]);
  });

  it('counts cited Konling path intervention outcomes beyond legacy dismissed', () => {
    const payload = buildStudentEvidenceFeaturePayload({
      userId: 'student-1',
      now: new Date('2026-06-04T12:00:00.000Z'),
      facts: [],
      pathEvidence: {
        executions: [],
        deviations: [],
        interventions: [
          {
            id: 'int-ignored',
            pathId: 'path-1',
            userId: 'student-1',
            interventionKind: 'hint',
            studentOutcome: 'ignored',
            privacySafeSummary: '学生暂时忽略提示。',
            idempotencyKey: 'ignored',
            createdAt: new Date('2026-06-04T10:01:00.000Z'),
          },
          {
            id: 'int-rejected',
            pathId: 'path-1',
            userId: 'student-1',
            interventionKind: 'diagnosis',
            studentOutcome: 'rejected',
            privacySafeSummary: '学生拒绝本轮诊断。',
            idempotencyKey: 'rejected',
            createdAt: new Date('2026-06-04T10:02:00.000Z'),
          },
          {
            id: 'int-partial',
            pathId: 'path-1',
            userId: 'student-1',
            interventionKind: 'reflection-prompt',
            studentOutcome: 'partially-accepted',
            privacySafeSummary: '学生只采纳部分反思建议。',
            idempotencyKey: 'partial',
            createdAt: new Date('2026-06-04T10:03:00.000Z'),
          },
        ],
      },
    } as any);

    expect((payload.features as any).pathExecution.allTime).toMatchObject({
      evidenceCount: 3,
      sourceCoverage: {
        interventionOutcome: 'available',
      },
      interventionOutcome: {
        ignoredCount: 1,
        rejectedCount: 1,
        partiallyAcceptedCount: 1,
      },
    });
    expect((payload.features as any).pathExecution.allTime.sourceReferences).toEqual([
      expect.objectContaining({ sourceId: 'int-ignored', studentOutcome: 'ignored' }),
      expect.objectContaining({ sourceId: 'int-rejected', studentOutcome: 'rejected' }),
      expect.objectContaining({ sourceId: 'int-partial', studentOutcome: 'partially-accepted' }),
    ]);
  });

  it('does not count non-terminal simulation completion as terminal validation', () => {
    const payload = buildStudentEvidenceFeaturePayload({
      userId: 'student-1',
      now: new Date('2026-06-04T12:00:00.000Z'),
      facts: [],
      pathEvidence: {
        executions: [
          {
            id: 'exec-mid-sim',
            pathId: 'path-1',
            userId: 'student-1',
            nodeId: 'mid-simulation',
            resourceType: 'simulation',
            status: 'completed',
            completedAt: new Date('2026-06-04T10:05:00.000Z'),
            idempotencyKey: 'exec-mid-sim',
            createdAt: new Date('2026-06-04T10:05:01.000Z'),
            path: { goalId: 'control-correction', terminalValidation: { nodeId: 'terminal-node' } },
          },
        ],
        deviations: [],
        interventions: [],
      },
    } as any);

    expect((payload.features as any).pathExecution.allTime).toMatchObject({
      completionCount: 1,
      terminalValidationCount: 0,
      sourceCoverage: {
        terminalValidation: 'missing',
      },
    });
  });

  it('derives compact simulation and Arena features from governed summaries and trace references', () => {
    const payload = buildStudentEvidenceFeaturePayload({
      userId: 'student-1',
      now: new Date('2026-05-21T00:00:00.000Z'),
      facts: [
        fact({
          id: 'course-sim',
          factType: 'simulation',
          startedAt: new Date('2026-05-18T10:00:00.000Z'),
          finishedAt: new Date('2026-05-18T10:08:00.000Z'),
          outcome: 'partial',
          score: 62,
          sessionId: 'class-session-1',
          lessonId: 'unit-5-2-nonlinear-analysis-entry',
          contextJson: {
            simulation: {
              sourceId: 'simulation/cruise',
              sceneId: 'sim/cruise',
              launchMode: 'course-resource',
              traceReference: 'SimulationTrace:course-run-1',
              replayConfidence: 0.86,
              protocolVersion: '1.0',
              checksum: 'checksum-course-run-1',
              summary: {
                metrics: {
                  settlingTime: 9.2,
                  rollRms: 0.42,
                },
                passed: false,
                durationSeconds: 138,
              },
              weakMetrics: [{ metricId: 'rollRms', value: 0.42 }],
            },
          },
        }),
        fact({
          id: 'official-arena',
          factType: 'design',
          startedAt: new Date('2026-05-19T10:00:00.000Z'),
          finishedAt: new Date('2026-05-19T10:05:00.000Z'),
          outcome: 'failure',
          score: 48,
          sourceEventId: 'arena_evaluation_complete:event-1',
          sourceLogId: 'arena-log-1',
          contextJson: {
            arena: {
              taskId: 'task-cruise-roll',
              classId: 'class-1',
              publicationId: 'publication-1',
              score: 48,
              valid: false,
              official: true,
              replayConfidence: 0.92,
              traceReference: 'ArenaEvaluationRun:official-run-1',
              protocolVersion: 'arena-eval-v1',
              satisfaction: {
                trackingError: 0.45,
                controlEnergy: 0.3,
              },
            },
            evidenceGovernance: {
              policyReason: 'official_arena_evaluation',
            },
          },
        }),
        fact({
          id: 'preview-arena',
          factType: 'simulation',
          startedAt: new Date('2026-04-01T10:00:00.000Z'),
          finishedAt: new Date('2026-04-01T10:05:00.000Z'),
          outcome: 'success',
          score: 74,
          sessionId: null,
          lessonId: null,
          courseId: null,
          sourceEventId: 'arena_simulation_run:event-preview',
          sourceLogId: 'arena-preview-log',
          contextJson: {
            arena: {
              taskId: 'task-preview',
              preview: true,
              launchMode: 'standalone',
              valid: true,
              replayConfidence: 0.34,
              traceReference: 'ArenaVirtualSimulationRun:preview-run-1',
              satisfaction: {
                smoothness: 0.55,
              },
            },
          },
        }),
      ],
    });

    const simulationArena = (payload.features as any).simulationArena;

    expect(simulationArena.recent30d).toMatchObject({
      evidenceCount: 2,
      completedCount: 0,
      officialCount: 1,
      previewCount: 0,
      courseLaunchedCount: 2,
      standaloneCount: 0,
      traceReferenceCount: 2,
      sourceCoverage: {
        simulation: 'available',
        arena: 'available',
        traceReferences: 'available',
        replayConfidence: 'available',
      },
      replayConfidence: {
        average: 0.89,
        lowConfidenceCount: 0,
        missingCount: 0,
      },
    });
    expect(simulationArena.allTime).toMatchObject({
      evidenceCount: 3,
      officialCount: 1,
      previewCount: 1,
      courseLaunchedCount: 2,
      standaloneCount: 1,
      traceReferenceCount: 3,
      replayConfidence: {
        average: 0.71,
        lowConfidenceCount: 1,
      },
    });
    expect(simulationArena.allTime.weakMetrics.map((metric: { metricId: string }) => metric.metricId)).toEqual([
      'controlEnergy',
      'rollRms',
      'smoothness',
      'trackingError',
    ]);
    expect(simulationArena.allTime.traceReferences).toEqual([
      expect.objectContaining({
        factId: 'preview-arena',
        source: 'arena',
        traceReference: 'ArenaVirtualSimulationRun:preview-run-1',
      }),
      expect.objectContaining({
        factId: 'course-sim',
        source: 'simulation',
        traceReference: 'SimulationTrace:course-run-1',
      }),
      expect.objectContaining({
        factId: 'official-arena',
        source: 'arena',
        traceReference: 'ArenaEvaluationRun:official-run-1',
      }),
    ]);
    expect(JSON.stringify(simulationArena)).not.toContain('samples');
  });

  it('counts persisted accepted Arena writeback facts as official Arena evidence', () => {
    const payload = buildStudentEvidenceFeaturePayload({
      userId: 'student-1',
      now: new Date('2026-05-21T00:00:00.000Z'),
      facts: [
        fact({
          id: 'persisted-arena-writeback',
          factType: 'design',
          startedAt: new Date('2026-05-20T10:00:00.000Z'),
          finishedAt: new Date('2026-05-20T10:05:00.000Z'),
          outcome: 'success',
          score: 88,
          sourceEventId: 'arena-official:publication-a:task-second-order-lead-pid:submission-a:student-1:hash-a',
          sourceLogId: 'submission-a',
          contextJson: {
            arena: {
              taskId: 'task-second-order-lead-pid',
              publicationId: 'publication-a',
              artifactHash: 'hash-a',
              score: 88,
              valid: true,
              evidenceWriteback: {
                status: 'accepted',
                terminalValidationAccepted: true,
              },
            },
          },
        }),
      ],
    });

    expect((payload.features as any).simulationArena.recent30d).toMatchObject({
      evidenceCount: 1,
      completedCount: 1,
      officialCount: 1,
      previewCount: 0,
    });
  });

  it('does not promote client-controlled Arena event ids that merely contain the official prefix text', () => {
    const payload = buildStudentEvidenceFeaturePayload({
      userId: 'student-1',
      now: new Date('2026-05-21T00:00:00.000Z'),
      facts: [
        fact({
          id: 'spoofed-arena-prefix',
          factType: 'simulation',
          startedAt: new Date('2026-05-20T10:00:00.000Z'),
          finishedAt: new Date('2026-05-20T10:05:00.000Z'),
          outcome: 'success',
          score: 72,
          sourceEventId: 'client-event:arena-official:fake',
          sourceLogId: 'client-arena-log',
          contextJson: {
            arena: {
              taskId: 'task-preview',
              preview: true,
              launchMode: 'standalone',
              valid: true,
            },
          },
        }),
      ],
    });

    expect((payload.features as any).simulationArena.recent30d).toMatchObject({
      evidenceCount: 1,
      completedCount: 1,
      officialCount: 0,
      previewCount: 1,
    });
  });

  it('does not promote client-controlled Arena event ids that contain legacy evaluation text', () => {
    const payload = buildStudentEvidenceFeaturePayload({
      userId: 'student-1',
      now: new Date('2026-05-21T00:00:00.000Z'),
      facts: [
        fact({
          id: 'spoofed-arena-legacy-event',
          factType: 'simulation',
          startedAt: new Date('2026-05-20T10:00:00.000Z'),
          finishedAt: new Date('2026-05-20T10:05:00.000Z'),
          outcome: 'success',
          score: 72,
          sourceEventId: 'client-event:arena_evaluation_complete:fake',
          sourceLogId: 'client-arena-log',
          contextJson: {
            arena: {
              taskId: 'task-preview',
              preview: true,
              launchMode: 'standalone',
              valid: true,
            },
          },
        }),
      ],
    });

    expect((payload.features as any).simulationArena.recent30d).toMatchObject({
      evidenceCount: 1,
      completedCount: 1,
      officialCount: 0,
      previewCount: 1,
    });
  });

  it('excludes client-materialized Arena evaluation events from personalized evidence', () => {
    const materialized = eventToLearningFactInput(clientArenaEvaluationEvent());

    expect(materialized).toMatchObject({
      sourceEventId: 'client-event:arena_evaluation_complete:fake',
      contextJson: {
        evidenceGovernance: {
          profileWeight: 0,
          skipProfileContribution: true,
          policyReason: 'arena_client_evaluation_context_only',
        },
      },
    });

    const payload = buildStudentEvidenceFeaturePayload({
      userId: 'student-1',
      now: new Date('2026-05-21T00:00:00.000Z'),
      facts: [fact(materialized as Partial<LearningFact>)],
    });

    expect((payload.features as any).simulationArena.recent30d).toMatchObject({
      evidenceCount: 0,
      completedCount: 0,
      officialCount: 0,
    });
  });

  it('does not count non-accepted Arena writeback facts as official evidence', () => {
    const payload = buildStudentEvidenceFeaturePayload({
      userId: 'student-1',
      now: new Date('2026-05-21T00:00:00.000Z'),
      facts: [
        fact({
          id: 'blocked-arena-writeback',
          factType: 'design',
          startedAt: new Date('2026-05-20T10:00:00.000Z'),
          finishedAt: new Date('2026-05-20T10:05:00.000Z'),
          outcome: 'success',
          score: 0,
          sourceEventId: 'arena-official:publication-a:task-second-order-lead-pid:submission-blocked:student-1:hash-a',
          sourceLogId: 'submission-blocked',
          contextJson: {
            arena: {
              taskId: 'task-second-order-lead-pid',
              publicationId: 'publication-a',
              artifactHash: 'hash-a',
              score: 0,
              valid: false,
              evidenceWriteback: {
                status: 'blocked',
                terminalValidationAccepted: false,
              },
            },
          },
        }),
        fact({
          id: 'degraded-arena-writeback',
          factType: 'design',
          startedAt: new Date('2026-05-20T11:00:00.000Z'),
          finishedAt: new Date('2026-05-20T11:05:00.000Z'),
          outcome: 'success',
          score: 66,
          sourceEventId: 'arena-official:publication-a:task-second-order-lead-pid:submission-degraded:student-1:hash-b',
          sourceLogId: 'submission-degraded',
          contextJson: {
            arena: {
              taskId: 'task-second-order-lead-pid',
              publicationId: 'publication-a',
              artifactHash: 'hash-b',
              score: 66,
              valid: true,
              evidenceWriteback: {
                status: 'degraded',
                terminalValidationAccepted: false,
              },
            },
          },
        }),
      ],
    });

    expect((payload.features as any).simulationArena.recent30d).toMatchObject({
      evidenceCount: 2,
      completedCount: 2,
      officialCount: 0,
      previewCount: 0,
    });
  });

  it('produces a stable payload for unchanged governed facts regardless of input order', () => {
    const facts = [
      fact({
        id: 'fact-b',
        factType: 'simulation',
        startedAt: new Date('2026-05-02T10:00:00.000Z'),
        finishedAt: new Date('2026-05-02T10:08:00.000Z'),
        score: 60,
        outcome: 'partial',
        competencyContribution: { parameterDesign: 0.4 },
        sourceEventId: 'event-b',
        sourceLogId: 'log-b',
      }),
      fact({
        id: 'fact-a',
        startedAt: new Date('2026-05-01T10:00:00.000Z'),
        finishedAt: new Date('2026-05-01T10:05:00.000Z'),
        sourceEventId: 'event-a',
        sourceLogId: 'log-a',
      }),
    ];

    const first = buildStudentEvidenceFeaturePayload({
      userId: 'student-1',
      facts,
    });
    const second = buildStudentEvidenceFeaturePayload({
      userId: 'student-1',
      facts: [...facts].reverse(),
    });

    expect(first).toEqual(second);
    expect(first.payloadVersion).toBe(STUDENT_EVIDENCE_FEATURE_PAYLOAD_VERSION);
    expect(first.evidenceWindow).toEqual({
      firstStartedAt: '2026-05-01T10:00:00.000Z',
      lastStartedAt: '2026-05-02T10:00:00.000Z',
      daysCovered: 1,
    });
    expect(first.sourceCounts).toMatchObject({
      LearningFact: 2,
      StudentCompetencySnapshot: 0,
      StudentProfileSummary: 0,
      byFactType: {
        question: 1,
        simulation: 1,
      },
    });
  });

  it('adds adaptive learner-state feature groups with coverage and confidence metadata', () => {
    const payload = buildStudentEvidenceFeaturePayload({
      userId: 'student-1',
      now: new Date('2026-05-19T00:00:00.000Z'),
      facts: [
        fact({
          id: 'assessment-fact',
          factType: 'question',
          moduleId: 'adaptive-assessment',
          contextJson: {
            adaptiveAssessment: {
              knowledgeTags: ['root-locus'],
              masteryPosterior: 0.74,
              masteryConfidence: 0.81,
            },
          },
        }),
        fact({
          id: 'media-fact',
          factType: 'media',
          score: 58,
          timeSpent: 420,
          contextJson: {
            media: {
              mediaType: 'video',
              progress: 0.58,
            },
          },
        }),
      ],
      latestSnapshot: {
        snapshotAt: new Date('2026-05-18T00:00:00.000Z'),
        factCount: 12,
        calculationVersion: 'competency-v2',
        competencyVector: { controlModeling: { score: 76 } },
      },
      profileSummary: {
        updatedAt: new Date('2026-05-18T01:00:00.000Z'),
        overallScore: 69,
        riskLevel: 'medium',
        trendDirection: 'up',
      },
    });

    expect(payload.payloadVersion).toBe(STUDENT_EVIDENCE_FEATURE_PAYLOAD_VERSION);
    expect(payload.features.adaptiveLearnerState).toMatchObject({
      payloadVersion: 'adaptive-learner-state.v1',
      sourceCoverage: {
        primaryCompetencies: 'available',
        knowledgeMastery: 'available',
        resourcePreference: 'available',
        mediaAbsorption: 'available',
        pathContext: 'missing',
        simulationArena: 'missing',
      },
      sourceCounts: {
        LearningFact: 2,
        AdaptiveMasteryEvidence: 1,
      },
      confidence: {
        level: 'medium',
        markers: [],
      },
    });
    expect(JSON.stringify(payload.features.adaptiveLearnerState)).not.toContain('rawTracePayload');
  });

  it('does not treat ordinary adaptive question tags as mastery posterior evidence', () => {
    const payload = buildStudentEvidenceFeaturePayload({
      userId: 'student-1',
      now: new Date('2026-05-19T00:00:00.000Z'),
      facts: [
        fact({
          id: 'tag-only-question',
          factType: 'question',
          moduleId: 'adaptive-assessment',
          contextJson: {
            adaptiveAssessment: {
              knowledgeTags: ['root-locus'],
            },
          },
        }),
      ],
    });

    expect(payload.features.adaptiveLearnerState).toMatchObject({
      sourceCoverage: {
        knowledgeMastery: 'missing',
      },
      sourceCounts: {
        AdaptiveMasteryEvidence: 0,
      },
    });
  });

  it('separates thirty-day learner windows from all-time audit windows', () => {
    const payload = buildStudentEvidenceFeaturePayload({
      userId: 'student-1',
      now: new Date('2026-05-19T00:00:00.000Z'),
      facts: [
        fact({
          id: 'older-rich-fact',
          startedAt: new Date('2026-03-01T10:00:00.000Z'),
          finishedAt: new Date('2026-03-01T10:04:00.000Z'),
          score: 50,
          competencyContribution: { controlModeling: 0.4 },
        }),
        fact({
          id: 'recent-rich-fact',
          startedAt: new Date('2026-05-18T10:00:00.000Z'),
          finishedAt: new Date('2026-05-18T10:06:00.000Z'),
          score: 90,
          competencyContribution: { parameterDesign: 0.9 },
        }),
      ],
    });

    expect(payload.features.activity30d).toMatchObject({
      totalFacts: 1,
      averageScore: 90,
    });
    expect(payload.features.activityAll).toMatchObject({
      totalFacts: 2,
      averageScore: 70,
    });
    expect(payload.features.activity).toEqual(payload.features.activityAll);
    expect(payload.features.competencyContributions30d.parameterDesign).toMatchObject({
      evidenceCount: 1,
      averageContribution: 0.9,
    });
    expect(payload.features.competencyContributionsAll.controlModeling).toMatchObject({
      evidenceCount: 1,
      averageContribution: 0.4,
    });
    expect(payload.sourceWindows.activity30d).toEqual({
      firstStartedAt: '2026-05-18T10:00:00.000Z',
      lastStartedAt: '2026-05-18T10:00:00.000Z',
      daysCovered: 0,
    });
    expect(payload.sourceWindows.activityAll).toEqual({
      firstStartedAt: '2026-03-01T10:00:00.000Z',
      lastStartedAt: '2026-05-18T10:00:00.000Z',
      daysCovered: 78,
    });
  });

  it('marks missing, partial, low-confidence, and stale evidence explicitly', () => {
    const payload = buildStudentEvidenceFeaturePayload({
      userId: 'student-1',
      facts: [
        fact({
          id: 'old-partial',
          outcome: 'partial',
          score: 40,
          startedAt: new Date('2025-12-01T00:00:00.000Z'),
          finishedAt: null,
          sourceEventId: null,
          sourceLogId: null,
        }),
      ],
      now: new Date('2026-05-19T00:00:00.000Z'),
    });

    expect(payload.statusMarkers).toEqual(
      expect.arrayContaining(['stale', 'partial', 'low-confidence', 'missing-source'])
    );
    expect(payload.confidence).toMatchObject({
      level: 'low',
      evidenceCount: 1,
    });
    expect(payload.sourceCoverage.LearningFact).toBe('partial');
  });

  it('omits absent optional trace metadata instead of producing stale v2 payloads', async () => {
    const payload = buildStudentEvidenceFeaturePayload({
      userId: 'student-1',
      now: new Date('2026-05-21T00:00:00.000Z'),
      facts: [
        fact({
          id: 'trace-without-optional-metadata',
          factType: 'simulation',
          contextJson: {
            simulation: {
              traceReference: 'SimulationTrace:without-optional-metadata',
              replayConfidence: 0.86,
            },
          },
        }),
      ],
    });

    expect(payload.features.simulationArena.allTime.traceReferences[0]).not.toHaveProperty('protocolVersion');
    expect(payload.features.simulationArena.allTime.traceReferences[0]).not.toHaveProperty('checksum');

    const db = {
      studentEvidenceFeatureCache: {
        findUnique: vi.fn().mockResolvedValue({
          userId: 'student-1',
          payloadVersion: STUDENT_EVIDENCE_FEATURE_PAYLOAD_VERSION,
          refreshedAt: new Date('2026-05-21T00:00:00.000Z'),
          statusMarkers: [],
          sourceCounts: payload.sourceCounts,
          sourceCoverage: payload.sourceCoverage,
          features: payload.features,
        }),
      },
    };

    await expect(
      readStudentEvidenceFeatures(db, 'student-1', {
        now: new Date('2026-05-21T00:00:00.000Z'),
      })
    ).resolves.toMatchObject({
      state: 'ready',
    });
  });
});

describe('student evidence feature cache service', () => {
  it('refreshes only the requested student cache entry', async () => {
    const db = {
      learningFact: {
        findMany: vi.fn().mockResolvedValue([
          fact({ userId: 'student-1', sourceEventId: 'event-a' }),
        ]),
      },
      learningPathExecution: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: 'exec-1',
            pathId: 'path-1',
            userId: 'student-1',
            nodeId: 'terminal-node',
            resourceType: 'arena_task',
            status: 'completed',
            completedAt: new Date('2026-06-04T10:20:00.000Z'),
            idempotencyKey: 'exec-key',
            liftMetadata: { pathActivityKind: 'continued-interaction' },
            createdAt: new Date('2026-06-04T10:20:01.000Z'),
            path: { goalId: 'control-correction', terminalValidation: { nodeId: 'terminal-node' } },
          },
        ]),
      },
      learningPathDeviation: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      learningPathIntervention: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      studentCompetencySnapshot: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
      studentProfileSummary: {
        findUnique: vi.fn().mockResolvedValue(null),
      },
      studentEvidenceFeatureCache: {
        upsert: vi.fn().mockImplementation(async ({ create }) => create),
      },
    };

    const entry = await refreshStudentEvidenceFeatureCache(db, 'student-1', {
      now: new Date('2026-05-19T00:00:00.000Z'),
    });

    expect(entry.userId).toBe('student-1');
    expect(db.learningFact.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'student-1' },
      })
    );
    expect(db.learningPathExecution.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        userId: 'student-1',
        path: {
          goalId: {
            in: expect.arrayContaining(['control-correction', 'frequency-response-foundations']),
          },
        },
      },
      select: expect.not.objectContaining({
        evidenceRefs: true,
      }),
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    }));
    expect(db.learningPathExecution.findMany).toHaveBeenCalledWith(expect.objectContaining({
      select: expect.objectContaining({
        liftMetadata: true,
      }),
    }));
    expect((entry.features as any).pathExecution.allTime.completionCount).toBe(0);
    expect(db.studentCompetencySnapshot.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [
          { snapshotAt: 'desc' },
          { id: 'desc' },
        ],
      })
    );
    expect(db.studentEvidenceFeatureCache.upsert).toHaveBeenCalledTimes(1);
    const upsertArgs = db.studentEvidenceFeatureCache.upsert.mock.calls[0][0];
    // Identity diagnostics must survive real cache persistence inside features JSON.
    expect(upsertArgs.create.features).toEqual(
      expect.objectContaining({
        knowledgeIdentityCoverage: expect.objectContaining({
          totalFacts: expect.any(Number),
          singleVersionComparable: expect.any(Boolean),
        }),
        knowledgeIdentityLayers: expect.any(Array),
        mergedAggregateComparability: expect.objectContaining({
          layerCount: expect.any(Number),
        }),
      }),
    );
    expect(db.studentEvidenceFeatureCache.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'student-1' },
        create: expect.objectContaining({
          freshness: expect.objectContaining({
            sourceWindows: expect.objectContaining({
              activity30d: expect.any(Object),
              activityAll: expect.any(Object),
              competencyContributions30d: expect.any(Object),
              competencyContributionsAll: expect.any(Object),
              pathExecution30d: expect.any(Object),
              pathExecutionAll: expect.any(Object),
            }),
          }),
          features: expect.objectContaining({
            pathExecution: expect.objectContaining({
              allTime: expect.objectContaining({
                completionCount: 0,
              }),
            }),
          }),
        }),
      })
    );
  });

  it('persists eligible fact counts and timestamps instead of raw audit rows', async () => {
    const db = {
      learningFact: {
        findMany: vi.fn().mockResolvedValue([
          fact({
            id: 'context-only-audit-row',
            startedAt: new Date('2026-05-19T10:00:00.000Z'),
            contextJson: {
              evidenceGovernance: {
                evidenceQuality: 'context-only',
                profileWeight: 0,
                skipProfileContribution: true,
                policyReason: 'audit-only-source',
              },
            },
          }),
        ]),
      },
      studentEvidenceFeatureCache: {
        upsert: vi.fn().mockImplementation(async ({ create }) => create),
      },
    };

    const entry = await refreshStudentEvidenceFeatureCache(db, 'student-1', {
      now: new Date('2026-05-20T00:00:00.000Z'),
    });

    expect(entry).toMatchObject({
      sourceCounts: { LearningFact: 0 },
      sourceFactCount: 0,
      lastSourceFactAt: null,
    });
  });

  it('keeps path-only evidence fresh after rebuild', async () => {
    const db = {
      learningFact: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      learningPathExecution: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: 'exec-path-only',
            pathId: 'path-only',
            userId: 'student-path',
            nodeId: 'terminal-node',
            resourceType: 'simulation',
            status: 'completed',
            completedAt: new Date('2026-06-04T10:20:00.000Z'),
            idempotencyKey: 'exec-path-only',
            createdAt: new Date('2026-06-04T10:20:01.000Z'),
            path: { goalId: 'control-correction', terminalValidation: { nodeId: 'terminal-node' } },
          },
        ]),
      },
      learningPathDeviation: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      learningPathIntervention: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      studentCompetencySnapshot: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
      studentProfileSummary: {
        findUnique: vi.fn().mockResolvedValue(null),
      },
      studentEvidenceFeatureCache: {
        upsert: vi.fn().mockImplementation(async ({ create }) => create),
      },
    };

    const entry = await refreshStudentEvidenceFeatureCache(db, 'student-path', {
      now: new Date('2026-06-04T11:00:00.000Z'),
    });

    expect(entry).toMatchObject({
      evidenceWindow: {
        firstStartedAt: '2026-06-04T10:20:00.000Z',
        lastStartedAt: '2026-06-04T10:20:00.000Z',
      },
      freshness: {
        sourceLastUpdatedAt: '2026-06-04T10:20:00.000Z',
        sourceWindows: expect.objectContaining({
          activityAll: expect.objectContaining({
            firstStartedAt: null,
            lastStartedAt: null,
          }),
          pathExecutionAll: expect.objectContaining({
            firstStartedAt: '2026-06-04T10:20:00.000Z',
            lastStartedAt: '2026-06-04T10:20:00.000Z',
          }),
        }),
      },
      statusMarkers: expect.not.arrayContaining(['stale']),
      confidenceMarkers: expect.objectContaining({
        level: 'low',
        evidenceCount: 1,
      }),
      lastSourceFactAt: null,
    });
  });

  it('includes registered non-control path executions in feature cache refresh', async () => {
    const db = {
      learningFact: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      learningPathExecution: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: 'exec-bode-quiz',
            pathId: 'path-frequency',
            userId: 'student-frequency',
            nodeId: 'registry:bode-quiz',
            resourceType: 'quiz',
            status: 'completed',
            completedAt: new Date('2026-06-04T10:20:00.000Z'),
            idempotencyKey: 'exec-bode-quiz',
            createdAt: new Date('2026-06-04T10:20:01.000Z'),
            path: { goalId: 'frequency-response-foundations', terminalValidation: { nodeId: null } },
          },
        ]),
      },
      learningPathDeviation: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      learningPathIntervention: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      studentCompetencySnapshot: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
      studentProfileSummary: {
        findUnique: vi.fn().mockResolvedValue(null),
      },
      studentEvidenceFeatureCache: {
        upsert: vi.fn().mockImplementation(async ({ create }) => create),
      },
    };

    const entry = await refreshStudentEvidenceFeatureCache(db, 'student-frequency', {
      now: new Date('2026-06-04T11:00:00.000Z'),
    });

    expect((entry.features as any).pathExecution.allTime).toMatchObject({
      evidenceCount: 1,
      completionCount: 1,
      sourceReferences: [
        expect.objectContaining({
          sourceType: 'LearningPathExecution',
          sourceId: 'exec-bode-quiz',
          pathId: 'path-frequency',
          nodeId: 'registry:bode-quiz',
        }),
      ],
    });
  });

  it('summarizes failed terminal validation without leaking hidden Arena internals', async () => {
    const db = {
      learningFact: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      learningPathExecution: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: 'exec-terminal-low-confidence',
            pathId: 'path-terminal',
            userId: 'student-path',
            nodeId: 'arena-task:task-second-order-lead-pid',
            resourceType: 'arena_task',
            status: 'completed',
            completedAt: new Date('2026-06-04T10:20:00.000Z'),
            idempotencyKey: 'exec-terminal-low-confidence',
            createdAt: new Date('2026-06-04T10:20:01.000Z'),
            path: {
              goalId: 'control-correction',
              terminalValidation: {
                nodeId: 'arena-task:task-second-order-lead-pid',
                state: 'low-confidence',
                fallbackRequired: true,
                lowConfidenceMarkers: ['arena-preview-only', 'arena-replay-confidence-missing'],
                failureReasons: [],
                evidence: {
                  arena: {
                    id: 'preview-run-1',
                    provenance: 'preview',
                    hiddenTrace: [{ t: 0, y: 1 }],
                    hiddenScenarioOrder: ['private-scenario'],
                  },
                },
              },
            },
          },
        ]),
      },
      learningPathDeviation: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      learningPathIntervention: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      studentCompetencySnapshot: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
      studentProfileSummary: {
        findUnique: vi.fn().mockResolvedValue(null),
      },
      studentEvidenceFeatureCache: {
        upsert: vi.fn().mockImplementation(async ({ create }) => create),
      },
    };

    const entry = await refreshStudentEvidenceFeatureCache(db, 'student-path', {
      now: new Date('2026-06-04T11:00:00.000Z'),
    });

    expect((entry.features as any).pathExecution.allTime).toMatchObject({
      terminalValidationCount: 1,
      fallbackCount: 1,
      confidence: expect.objectContaining({
        level: 'low',
        lowConfidenceCount: 1,
      }),
      terminalValidation: expect.objectContaining({
        latestState: 'low-confidence',
        lowConfidenceCount: 1,
        fallbackRequiredCount: 1,
        lowConfidenceMarkers: ['arena-preview-only', 'arena-replay-confidence-missing'],
      }),
      sourceReferences: [
        expect.objectContaining({
          sourceType: 'LearningPathExecution',
          terminalValidationState: 'low-confidence',
          lowConfidenceMarkers: ['arena-preview-only', 'arena-replay-confidence-missing'],
        }),
      ],
    });
    const serialized = JSON.stringify(entry);
    expect(serialized).not.toContain('hiddenTrace');
    expect(serialized).not.toContain('hiddenScenarioOrder');
    expect(serialized).not.toContain('private-scenario');
  });

  it('ignores path rows that are not scoped to control-correction paths', async () => {
    const db = {
      learningFact: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      learningPathExecution: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: 'exec-legacy',
            pathId: 'legacy-path',
            userId: 'student-1',
            nodeId: 'node-legacy',
            resourceType: 'simulation',
            status: 'completed',
            completedAt: new Date('2026-06-04T10:20:00.000Z'),
            idempotencyKey: 'legacy-exec',
            createdAt: new Date('2026-06-04T10:20:01.000Z'),
            path: { goalId: 'legacy-goal', terminalValidation: { nodeId: 'node-legacy' } },
          },
        ]),
      },
      learningPathDeviation: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      learningPathIntervention: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      studentCompetencySnapshot: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
      studentProfileSummary: {
        findUnique: vi.fn().mockResolvedValue(null),
      },
      studentEvidenceFeatureCache: {
        upsert: vi.fn().mockImplementation(async ({ create }) => create),
      },
    };

    const entry = await refreshStudentEvidenceFeatureCache(db, 'student-1', {
      now: new Date('2026-06-04T11:00:00.000Z'),
    });

    expect((entry.features as any).pathExecution.allTime.evidenceCount).toBe(0);
    expect(entry.statusMarkers).toEqual(expect.arrayContaining(['stale']));
  });

  it('full rebuild derives users from governed facts and keeps payloads stable', async () => {
    const db = {
      learningFact: {
        findMany: vi
          .fn()
          .mockResolvedValueOnce([
            { userId: 'student-2' },
            { userId: 'student-1' },
            { userId: 'student-1' },
          ])
          .mockResolvedValueOnce([fact({ userId: 'student-1', sourceEventId: 'event-a' })])
          .mockResolvedValueOnce([fact({ userId: 'student-2', sourceEventId: 'event-b' })]),
      },
      learningPathExecution: {
        findMany: vi.fn()
          .mockResolvedValueOnce([])
          .mockResolvedValueOnce([])
          .mockResolvedValueOnce([]),
      },
      learningPathDeviation: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      learningPathIntervention: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      studentCompetencySnapshot: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
      studentProfileSummary: {
        findUnique: vi.fn().mockResolvedValue(null),
      },
      studentEvidenceFeatureCache: {
        upsert: vi.fn().mockImplementation(async ({ create }) => create),
      },
    };

    const result = await rebuildStudentEvidenceFeatureCache(db, {
      now: new Date('2026-05-19T00:00:00.000Z'),
    });

    expect(result).toMatchObject({
      processedStudents: 2,
      payloadVersion: STUDENT_EVIDENCE_FEATURE_PAYLOAD_VERSION,
    });
    expect(db.studentEvidenceFeatureCache.upsert).toHaveBeenCalledTimes(2);
    expect(db.studentEvidenceFeatureCache.upsert.mock.calls.map(([args]) => args.where.userId)).toEqual([
      'student-1',
      'student-2',
    ]);
  });

  it('full rebuild also includes users that only have approved aggregates', async () => {
    const db = {
      learningFact: {
        findMany: vi
          .fn()
          .mockResolvedValue([])
          .mockResolvedValueOnce([{ userId: 'student-fact' }])
          .mockResolvedValueOnce([])
          .mockResolvedValueOnce([fact({ userId: 'student-fact', sourceEventId: 'event-a' })])
          .mockResolvedValueOnce([]),
      },
      learningPathExecution: {
        findMany: vi.fn().mockResolvedValue([])
          .mockResolvedValueOnce([{ userId: 'student-path' }])
          .mockResolvedValueOnce([])
          .mockResolvedValueOnce([])
          .mockResolvedValueOnce([
            {
              id: 'exec-path-only',
              pathId: 'path-only',
              userId: 'student-path',
              nodeId: 'node-1',
              resourceType: 'simulation',
              status: 'started',
              startedAt: new Date('2026-06-04T10:00:00.000Z'),
              idempotencyKey: 'exec-path-only',
              createdAt: new Date('2026-06-04T10:00:01.000Z'),
            },
          ]),
      },
      learningPathDeviation: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      learningPathIntervention: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      studentCompetencySnapshot: {
        findMany: vi.fn().mockResolvedValue([{ userId: 'student-aggregate' }]),
        findFirst: vi.fn().mockResolvedValue(null),
      },
      studentProfileSummary: {
        findMany: vi.fn().mockResolvedValue([{ userId: 'student-profile' }]),
        findUnique: vi.fn().mockResolvedValue(null),
      },
      studentEvidenceFeatureCache: {
        upsert: vi.fn().mockImplementation(async ({ create }) => create),
      },
    };

    const result = await rebuildStudentEvidenceFeatureCache(db, {
      now: new Date('2026-05-19T00:00:00.000Z'),
    });

    expect(result.processedStudents).toBe(4);
    expect(db.learningPathExecution.findMany).toHaveBeenNthCalledWith(1, expect.objectContaining({
      where: {
        path: {
          goalId: {
            in: expect.arrayContaining(['control-correction', 'frequency-response-foundations']),
          },
        },
      },
      select: { userId: true },
    }));
    expect(db.studentEvidenceFeatureCache.upsert.mock.calls.map(([args]) => args.where.userId)).toEqual([
      'student-aggregate',
      'student-fact',
      'student-path',
      'student-profile',
    ]);
  });

  it('returns explicit missing and stale states through the read boundary', async () => {
    const missingDb = {
      studentEvidenceFeatureCache: {
        findUnique: vi.fn().mockResolvedValue(null),
      },
    };

    await expect(readStudentEvidenceFeatures(missingDb, 'student-1')).resolves.toMatchObject({
      state: 'missing',
      cache: null,
    });

    const staleDb = {
      studentEvidenceFeatureCache: {
        findUnique: vi.fn().mockResolvedValue({
          userId: 'student-1',
          refreshedAt: new Date('2026-04-01T00:00:00.000Z'),
          statusMarkers: [],
        }),
      },
    };

    await expect(
      readStudentEvidenceFeatures(staleDb, 'student-1', {
        now: new Date('2026-05-19T00:00:00.000Z'),
        staleAfterDays: 30,
      })
    ).resolves.toMatchObject({
      state: 'stale',
      cache: {
        userId: 'student-1',
      },
    });
  });

  it('keeps current v4 path execution caches readable when terminal validation summary is absent', async () => {
    const payload = buildStudentEvidenceFeaturePayload({
      userId: 'student-1',
      now: new Date('2026-05-19T00:00:00.000Z'),
      facts: [fact()],
    });
    delete (payload.features as any).pathExecution.recent30d.terminalValidation;
    delete (payload.features as any).pathExecution.allTime.terminalValidation;
    const db = {
      studentEvidenceFeatureCache: {
        findUnique: vi.fn().mockResolvedValue({
          userId: 'student-1',
          payloadVersion: STUDENT_EVIDENCE_FEATURE_PAYLOAD_VERSION,
          refreshedAt: new Date('2026-05-18T00:00:00.000Z'),
          statusMarkers: [],
          sourceCounts: payload.sourceCounts,
          sourceCoverage: payload.sourceCoverage,
          features: payload.features,
        }),
      },
    };

    await expect(
      readStudentEvidenceFeatures(db, 'student-1', {
        now: new Date('2026-05-19T00:00:00.000Z'),
      })
    ).resolves.toMatchObject({
      state: 'ready',
      cache: {
        userId: 'student-1',
        payloadVersion: STUDENT_EVIDENCE_FEATURE_PAYLOAD_VERSION,
      },
    });
  });

  it('marks pre-governance v5 payloads as stale even when they are recent', async () => {
    const db = {
      studentEvidenceFeatureCache: {
        findUnique: vi.fn().mockResolvedValue({
          userId: 'student-1',
          payloadVersion: 'student-evidence-features.v5',
          refreshedAt: new Date('2026-05-18T00:00:00.000Z'),
          statusMarkers: [],
          features: {
            approvedAggregates: {},
          },
        }),
      },
    };

    await expect(
      readStudentEvidenceFeatures(db, 'student-1', {
        now: new Date('2026-05-19T00:00:00.000Z'),
      })
    ).resolves.toMatchObject({
      state: 'stale',
      cache: {
        userId: 'student-1',
        payloadVersion: 'student-evidence-features.v5',
      },
    });
  });

  it('normalizes current-version caches created before portrait v2 source fields were added', async () => {
    const payload = buildStudentEvidenceFeaturePayload({
      userId: 'student-1',
      now: new Date('2026-05-19T00:00:00.000Z'),
      facts: [fact()],
    });
    const sourceCounts = { ...payload.sourceCounts } as Record<string, unknown>;
    const sourceCoverage = { ...payload.sourceCoverage } as Record<string, unknown>;
    delete sourceCounts.StudentPortraitV2Snapshot;
    delete sourceCoverage.StudentPortraitV2Snapshot;
    const db = {
      studentEvidenceFeatureCache: {
        findUnique: vi.fn().mockResolvedValue({
          userId: 'student-1',
          payloadVersion: STUDENT_EVIDENCE_FEATURE_PAYLOAD_VERSION,
          refreshedAt: new Date('2026-05-18T00:00:00.000Z'),
          statusMarkers: [],
          sourceCounts,
          sourceCoverage,
          features: payload.features,
        }),
      },
    };

    await expect(
      readStudentEvidenceFeatures(db, 'student-1', {
        now: new Date('2026-05-19T00:00:00.000Z'),
      })
    ).resolves.toMatchObject({
      state: 'ready',
      cache: {
        sourceCounts: { StudentPortraitV2Snapshot: 0 },
        sourceCoverage: { StudentPortraitV2Snapshot: 'missing' },
      },
    });
  });

  it.each(['count', 'coverage'] as const)(
    'keeps current-version caches with only the portrait v2 %s missing stale',
    async (missingField) => {
      const payload = buildStudentEvidenceFeaturePayload({
        userId: 'student-1',
        now: new Date('2026-05-19T00:00:00.000Z'),
        facts: [fact()],
      });
      const sourceCounts = { ...payload.sourceCounts } as Record<string, unknown>;
      const sourceCoverage = { ...payload.sourceCoverage } as Record<string, unknown>;
      if (missingField === 'count') {
        delete sourceCounts.StudentPortraitV2Snapshot;
      } else {
        delete sourceCoverage.StudentPortraitV2Snapshot;
      }
      const db = {
        studentEvidenceFeatureCache: {
          findUnique: vi.fn().mockResolvedValue({
            userId: 'student-1',
            payloadVersion: STUDENT_EVIDENCE_FEATURE_PAYLOAD_VERSION,
            refreshedAt: new Date('2026-05-18T00:00:00.000Z'),
            statusMarkers: [],
            sourceCounts,
            sourceCoverage,
            features: payload.features,
          }),
        },
      };

      await expect(
        readStudentEvidenceFeatures(db, 'student-1', {
          now: new Date('2026-05-19T00:00:00.000Z'),
        })
      ).resolves.toMatchObject({ state: 'stale' });
    }
  );

  it('keeps current-version caches with malformed source parent structures stale', async () => {
    const payload = buildStudentEvidenceFeaturePayload({
      userId: 'student-1',
      now: new Date('2026-05-19T00:00:00.000Z'),
      facts: [fact()],
    });
    const db = {
      studentEvidenceFeatureCache: {
        findUnique: vi.fn().mockResolvedValue({
          userId: 'student-1',
          payloadVersion: STUDENT_EVIDENCE_FEATURE_PAYLOAD_VERSION,
          refreshedAt: new Date('2026-05-18T00:00:00.000Z'),
          statusMarkers: [],
          sourceCounts: null,
          sourceCoverage: payload.sourceCoverage,
          features: payload.features,
        }),
      },
    };

    await expect(
      readStudentEvidenceFeatures(db, 'student-1', {
        now: new Date('2026-05-19T00:00:00.000Z'),
      })
    ).resolves.toMatchObject({ state: 'stale' });
  });

  it('marks v2 payloads without adaptive learner-state feature groups as stale', async () => {
    const payload = buildStudentEvidenceFeaturePayload({
      userId: 'student-1',
      now: new Date('2026-05-21T00:00:00.000Z'),
      facts: [fact()],
    });
    const db = {
      studentEvidenceFeatureCache: {
        findUnique: vi.fn().mockResolvedValue({
          userId: 'student-1',
          payloadVersion: 'student-evidence-features.v2',
          refreshedAt: new Date('2026-05-21T00:00:00.000Z'),
          statusMarkers: [],
          features: {
            ...payload.features,
            adaptiveLearnerState: undefined,
          },
        }),
      },
    };

    await expect(
      readStudentEvidenceFeatures(db, 'student-1', {
        now: new Date('2026-05-21T00:00:00.000Z'),
      })
    ).resolves.toMatchObject({
      state: 'stale',
    });
  });

  it('marks malformed v2 simulation Arena payloads as stale', async () => {
    const db = {
      studentEvidenceFeatureCache: {
        findUnique: vi.fn().mockResolvedValue({
          userId: 'student-1',
          payloadVersion: STUDENT_EVIDENCE_FEATURE_PAYLOAD_VERSION,
          refreshedAt: new Date('2026-05-18T00:00:00.000Z'),
          statusMarkers: [],
          features: {
            simulationArena: {
              recent30d: {},
              allTime: {},
            },
          },
        }),
      },
    };

    await expect(
      readStudentEvidenceFeatures(db, 'student-1', {
        now: new Date('2026-05-19T00:00:00.000Z'),
      })
    ).resolves.toMatchObject({
      state: 'stale',
    });
  });

  it('marks v2 simulation Arena payloads with malformed nested fields as stale', async () => {
    const malformedWindow = {
      window: {},
      evidenceCount: 1,
      completedCount: 0,
      officialCount: 1,
      previewCount: 0,
      courseLaunchedCount: 1,
      standaloneCount: 0,
      traceReferenceCount: 1,
      sourceCoverage: {
        simulation: 'missing',
        arena: 'available',
        traceReferences: 'available',
        replayConfidence: 'available',
      },
      replayConfidence: {
        average: 0.86,
        highConfidenceCount: 1,
        lowConfidenceCount: 0,
        missingCount: 0,
      },
      weakMetrics: [
        { metricId: 'trackingError', affectedFactCount: 1, lowestValue: 0.42 },
      ],
      qualityMarkers: [],
      traceReferences: [
        {
          source: 'arena',
          traceReference: 'ArenaEvaluationRun:raw-leak',
          factId: 'fact-arena-1',
          sourceEventId: null,
          sourceLogId: null,
          startedAt: '2026-05-18T00:00:00.000Z',
          rawTracePayload: [{ t: 0, y: 1 }],
        },
      ],
    };
    const db = {
      studentEvidenceFeatureCache: {
        findUnique: vi.fn().mockResolvedValue({
          userId: 'student-1',
          payloadVersion: STUDENT_EVIDENCE_FEATURE_PAYLOAD_VERSION,
          refreshedAt: new Date('2026-05-18T00:00:00.000Z'),
          statusMarkers: [],
          features: {
            simulationArena: {
              recent30d: malformedWindow,
              allTime: malformedWindow,
            },
          },
        }),
      },
    };

    await expect(
      readStudentEvidenceFeatures(db, 'student-1', {
        now: new Date('2026-05-19T00:00:00.000Z'),
      })
    ).resolves.toMatchObject({
      state: 'stale',
    });
  });

  it('summarizes cache freshness and coverage for admin governance review', async () => {
    const db = {
      studentEvidenceFeatureCache: {
        count: vi.fn().mockResolvedValue(3),
        findMany: vi.fn().mockResolvedValue([
          {
            refreshedAt: new Date('2026-05-18T00:00:00.000Z'),
            statusMarkers: [],
            sourceCoverage: {
              LearningFact: 'available',
              StudentCompetencySnapshot: 'missing',
              StudentProfileSummary: 'missing',
            },
            sourceFactCount: 3,
            rebuildCount: 2,
          },
          {
            refreshedAt: new Date('2026-05-10T00:00:00.000Z'),
            statusMarkers: [],
            sourceCoverage: {
              LearningFact: 'partial',
              StudentCompetencySnapshot: 'available',
              StudentProfileSummary: 'missing',
            },
            sourceFactCount: 1,
            rebuildCount: 1,
          },
          {
            refreshedAt: new Date('2026-05-19T00:00:00.000Z'),
            statusMarkers: ['stale'],
            sourceCoverage: {
              LearningFact: 'missing',
              StudentCompetencySnapshot: 'available',
              StudentProfileSummary: 'available',
            },
            sourceFactCount: 0,
            rebuildCount: 1,
          },
        ]),
      },
    };

    const summary = await getStudentEvidenceFeatureCacheAdminSummary(db, {
      now: new Date('2026-05-19T00:00:00.000Z'),
      staleAfterDays: 7,
    });

    expect(summary).toMatchObject({
      totalEntries: 3,
      staleEntries: 2,
      totalSourceFacts: 4,
      totalRebuilds: 4,
      latestRefreshAt: '2026-05-19T00:00:00.000Z',
      coverage: {
        LearningFact: {
          available: 1,
          missing: 1,
          partial: 1,
        },
        StudentCompetencySnapshot: {
          available: 2,
          missing: 1,
        },
      },
    });
  });
});
