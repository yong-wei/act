import { describe, expect, it, vi } from 'vitest';
import type { LearningFact } from '@prisma/client';

import {
  buildSimulationAgentEvidenceMaterialization,
  persistSimulationAgentEvidenceMaterialization,
} from '../simulation-agent-evidence-materialization';
import { buildStudentEvidenceFeaturePayload } from '../student-evidence-feature-cache';
import { buildTeacherScopedSimulationArenaFeatureMap } from '../teacher-evidence-governance';

const completedAt = new Date('2026-05-29T02:00:00.000Z');

function simulationRun(overrides: Record<string, unknown> = {}) {
  return {
    id: 'run-1',
    ownerUserId: 'student-1',
    classId: 'class-1',
    courseId: 'course-1',
    sessionId: 'session-1',
    resourceId: 'resource-1',
    publicationId: 'publication-1',
    runKind: 'arena_preview',
    sourceDomain: 'arena_virtual_preview',
    sourceRefId: 'preview-1',
    taskSpecId: 'task-spec-1',
    status: 'completed',
    summary: {
      score: 74,
      valid: true,
      replayConfidence: 0.82,
      agentAssisted: true,
      satisfaction: {
        trackingError: 0.52,
      },
      weakMetrics: [{ metricId: 'trackingError', value: 0.52 }],
      samples: [
        { t: 0, y: 0 },
        { t: 0.01, y: 0.1 },
      ],
    },
    protocolVersion: 'simulation-run-v1',
    runtimeVersion: 'runtime-v1',
    modelVersion: 'model-v1',
    startedAt: new Date('2026-05-29T01:58:00.000Z'),
    completedAt,
    ...overrides,
  };
}

function simulationTrace(overrides: Record<string, unknown> = {}) {
  return {
    id: 'trace-1',
    runId: 'run-1',
    protocolVersion: 'trace-v1',
    runtimeVersion: 'runtime-v1',
    modelVersion: 'model-v1',
    checksum: 'checksum-1',
    summaryMetrics: {
      settlingTime: 8.4,
    },
    sampleCount: 240,
    sampleCadence: 0.016,
    sampleStorageUri: 's3://private/raw-trace',
    createdAt: completedAt,
    ...overrides,
  };
}

function agentToolRun(overrides: Record<string, unknown> = {}) {
  return {
    id: 'tool-run-1',
    agentSessionId: 'agent-session-1',
    ownerUserId: 'student-1',
    actorUserId: 'student-1',
    targetUserId: 'student-1',
    classId: 'class-1',
    courseId: 'course-1',
    pageId: 'page-1',
    resourceId: 'resource-1',
    toolName: 'analyze_simulation_trace',
    permissionTier: 'analyze',
    approvalState: 'not_required',
    status: 'succeeded',
    inputSummary: {
      simulationRunId: 'run-1',
    },
    outputSummary: {
      narrative: '模型建议学生关注调节时间。',
      simulationRunId: 'run-1',
      traceRef: {
        traceId: 'trace-1',
      },
    },
    idempotencyKey: 'analysis-1',
    correlationId: 'corr-tool-1',
    startedAt: new Date('2026-05-29T02:01:00.000Z'),
    completedAt: new Date('2026-05-29T02:02:00.000Z'),
    ...overrides,
  };
}

function asLearningFact(input: Record<string, unknown>, id: string): LearningFact {
  return {
    id,
    createdAt: new Date('2026-05-29T02:05:00.000Z'),
    moduleId: null,
    sessionId: null,
    finishedAt: null,
    score: null,
    timeSpent: null,
    sourceLogId: null,
    courseId: null,
    lessonId: null,
    ...input,
  } as LearningFact;
}

describe('simulation agent evidence materialization', () => {
  it('stages SimulationRun evidence with outbox causation and privacy-safe LearningFact input', () => {
    const result = buildSimulationAgentEvidenceMaterialization({
      simulationRuns: [
        {
          run: simulationRun(),
          trace: simulationTrace(),
        },
      ],
      now: completedAt,
    });

    expect(result.drafts).toHaveLength(1);
    expect(result.drafts[0]).toMatchObject({
      ownerUserId: 'student-1',
      sourceType: 'simulation_run',
      dedupeKey: 'simulation_run:run-1:simulation-run-v1',
      reviewerState: 'auto_approved',
      privacyScope: 'student-visible',
      provenance: {
        sourceDomain: 'arena_virtual_preview',
        runKind: 'arena_preview',
        preview: true,
        agentAssisted: true,
      },
    });
    expect(result.outboxEvents[0]).toMatchObject({
      eventType: 'simulation_agent_evidence.draft_created',
      correlationId: 'simulation-run:run-1',
      causationId: 'SimulationRun:run-1',
      ownerUserId: 'student-1',
      source: {
        simulationRunId: 'run-1',
      },
      privacyScope: 'student-visible',
    });
    expect(result.learningFacts).toHaveLength(1);
    expect(result.learningFacts[0]).toMatchObject({
      userId: 'student-1',
      factType: 'simulation',
      moduleId: 'task-spec-1',
      sourceEventId: 'simulation-agent-evidence:simulation_run:run-1:simulation-run-v1',
      sourceLogId: 'SimulationRun:run-1',
      courseId: 'course-1',
      sessionId: 'session-1',
      contextJson: {
        evidenceGovernance: {
          evidenceQuality: 'partial',
          profileWeight: 0,
          skipProfileContribution: true,
          policyReason: 'unmanaged_learning_fact_context_only',
        },
        simulation: {
          runId: 'run-1',
          traceReference: 'SimulationTrace:trace-1',
          replayConfidence: 0.45,
          agentAssisted: true,
          governanceContext: {
            classId: 'class-1',
            privacyScope: 'student-visible',
          },
        },
      },
    });
    expect(JSON.stringify(result.learningFacts[0].contextJson)).not.toContain('samples');
    expect(JSON.stringify(result.learningFacts[0].contextJson)).not.toContain('sampleStorageUri');
  });

  it('caps preview replay confidence before feature-cache aggregation without changing non-preview trace confidence', () => {
    const preview = buildSimulationAgentEvidenceMaterialization({
      simulationRuns: [
        {
          run: simulationRun(),
          trace: simulationTrace(),
        },
      ],
      now: completedAt,
    });
    const nonPreview = buildSimulationAgentEvidenceMaterialization({
      simulationRuns: [
        {
          run: simulationRun({
            runKind: 'official_evaluation',
            sourceDomain: 'official_simulation',
            summary: {
              score: 74,
              valid: true,
            },
          }),
          trace: simulationTrace(),
        },
      ],
      now: completedAt,
    });

    expect(preview.drafts[0]?.confidence).toBe(0.45);
    expect(preview.learningFacts[0]).toMatchObject({
      contextJson: {
        simulation: {
          replayConfidence: 0.45,
        },
      },
    });
    expect(nonPreview.drafts[0]?.confidence).toBe(0.8);
  });

  it('keeps Arena preview top-level metrics when generating simulation LearningFacts', () => {
    const result = buildSimulationAgentEvidenceMaterialization({
      simulationRuns: [
        {
          run: simulationRun({
            summary: {
              trackingError: 0.1,
              maxDeviation: 0.5,
              controlEnergy: 0.2,
              safetyViolations: 0,
              smoothness: 0.8,
            },
          }),
          trace: simulationTrace(),
        },
      ],
      now: completedAt,
    });
    const factInput = result.learningFacts[0] as Record<string, any>;

    expect(factInput).toMatchObject({
      factType: 'simulation',
      moduleId: 'task-spec-1',
      outcome: 'success',
      score: 87,
      contextJson: {
        simulation: {
          summary: {
            valid: true,
            score: 87,
            metrics: {
              trackingError: 0.1,
              maxDeviation: 0.5,
              controlEnergy: 0.2,
              safetyViolations: 0,
              smoothness: 0.8,
            },
          },
        },
      },
    });
  });

  it('rounds fractional simulation duration before writing LearningFact timeSpent', () => {
    const result = buildSimulationAgentEvidenceMaterialization({
      simulationRuns: [
        {
          run: simulationRun({
            summary: {
              score: 72,
              valid: true,
              durationSeconds: 12.6,
            },
          }),
          trace: simulationTrace(),
        },
      ],
      now: completedAt,
    });

    expect(result.learningFacts[0]).toMatchObject({
      timeSpent: 13,
    });
  });

  it('persists deterministic facts idempotently with stable dedupe keys', async () => {
    const createMany = vi.fn()
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 0 });
    const draftCreateMany = vi.fn().mockResolvedValue({ count: 1 });
    const outboxCreateMany = vi.fn().mockResolvedValue({ count: 1 });

    const input = {
      simulationRuns: [
        {
          run: simulationRun(),
          trace: simulationTrace(),
        },
      ],
      now: completedAt,
    };

    const first = await persistSimulationAgentEvidenceMaterialization({
      learningFact: { createMany },
      learningEvidenceDraft: { createMany: draftCreateMany },
      evidenceOutbox: { createMany: outboxCreateMany },
    }, input);
    const second = await persistSimulationAgentEvidenceMaterialization({
      learningFact: { createMany },
      learningEvidenceDraft: { createMany: draftCreateMany },
      evidenceOutbox: { createMany: outboxCreateMany },
    }, input);

    expect(createMany).toHaveBeenCalledTimes(2);
    expect(createMany).toHaveBeenCalledWith(expect.objectContaining({
      skipDuplicates: true,
      data: [
        expect.objectContaining({
          sourceEventId: 'simulation-agent-evidence:simulation_run:run-1:simulation-run-v1',
        }),
      ],
    }));
    expect(first).toMatchObject({ created: 1, skipped: false });
    expect(second).toMatchObject({ created: 0, skipped: true });
    expect(draftCreateMany).toHaveBeenCalledWith(expect.objectContaining({
      skipDuplicates: true,
      data: [
        expect.objectContaining({
          ownerUserId: 'student-1',
          dedupeKey: 'simulation_run:run-1:simulation-run-v1',
          sourceType: 'simulation_run',
        }),
      ],
    }));
    expect(outboxCreateMany).toHaveBeenCalledWith(expect.objectContaining({
      skipDuplicates: true,
      data: [
        expect.objectContaining({
          eventType: 'simulation_agent_evidence.draft_created',
          causationId: 'SimulationRun:run-1',
          dedupeKey: 'simulation_run:run-1:simulation-run-v1',
        }),
      ],
    }));
  });

  it('preserves Konling agent session and tool causation in simulation run drafts and outbox events', () => {
    const result = buildSimulationAgentEvidenceMaterialization({
      simulationRuns: [
        {
          run: simulationRun({
            runKind: 'agent_experiment',
            sourceDomain: 'konling_agent',
            summary: {
              score: 81,
              valid: true,
              agentSessionId: 'agent-session-1',
              agentToolRunId: 'tool-run-sim-1',
              metrics: { settlingTime: 4.2 },
            },
          }),
          trace: simulationTrace(),
        },
      ],
      now: completedAt,
    });

    expect(result.drafts[0]).toMatchObject({
      sourceRefs: {
        simulationRunId: 'run-1',
        simulationTraceId: 'trace-1',
        agentSessionId: 'agent-session-1',
        agentToolRunId: 'tool-run-sim-1',
      },
      evidenceRefs: {
        simulationRunId: 'run-1',
        simulationTraceId: 'trace-1',
        agentSessionId: 'agent-session-1',
        agentToolRunId: 'tool-run-sim-1',
      },
    });
    expect(result.outboxEvents[0]).toMatchObject({
      source: {
        simulationRunId: 'run-1',
        simulationTraceId: 'trace-1',
        agentSessionId: 'agent-session-1',
        agentToolRunId: 'tool-run-sim-1',
      },
    });
  });

  it('keeps model-authored AgentToolRun narrative reviewable instead of creating high-confidence facts', () => {
    const result = buildSimulationAgentEvidenceMaterialization({
      agentToolRuns: [agentToolRun()],
      now: completedAt,
    });

    expect(result.drafts).toHaveLength(1);
    expect(result.drafts[0]).toMatchObject({
      sourceType: 'agent_tool_run',
      dedupeKey: 'agent_tool_run:tool-run-1:analysis-1',
      reviewerState: 'review_required',
      confidence: 0.35,
      sourceRefs: {
        agentSessionId: 'agent-session-1',
        agentToolRunId: 'tool-run-1',
        simulationRunId: 'run-1',
      },
      provenance: {
        agentAssisted: true,
        modelAuthored: true,
      },
    });
    expect(result.learningFacts).toEqual([]);
  });

  it('materializes approved deterministic AgentToolRun evidence into simulation-agent feature inputs', () => {
    const result = buildSimulationAgentEvidenceMaterialization({
      agentToolRuns: [
        agentToolRun({
          approvalState: 'approved',
          outputSummary: {
            simulationRunId: 'run-1',
            traceRef: { traceId: 'trace-1' },
            metrics: { interventionOutcome: 0.78 },
          },
        }),
      ],
      now: completedAt,
    });
    const factInput = result.learningFacts[0] as Record<string, any>;

    expect(result.drafts[0]).toMatchObject({
      reviewerState: 'approved',
      confidence: 0.65,
    });
    expect(factInput).toMatchObject({
      userId: 'student-1',
      factType: 'ai_intervention',
      sourceEventId: 'simulation-agent-evidence:agent_tool_run:tool-run-1:analysis-1',
      sourceLogId: 'AgentToolRun:tool-run-1',
      contextJson: {
        agentTool: {
          agentToolRunId: 'tool-run-1',
          simulationRunId: 'run-1',
          traceReference: 'SimulationTrace:trace-1',
          agentAssisted: true,
          interventionOutcome: 0.78,
          reviewerState: 'approved',
        },
      },
    });

    const payload = buildStudentEvidenceFeaturePayload({
      userId: 'student-1',
      facts: [asLearningFact(factInput, 'agent-fact-1')],
      now: completedAt,
    });
    expect(payload.features.simulationArena.allTime).toMatchObject({
      evidenceCount: 1,
      agentAssistedCount: 1,
      traceReferenceCount: 1,
      interventionOutcome: {
        reviewedCount: 1,
        improvedCount: 1,
        lowConfidenceCount: 0,
      },
    });
  });

  it('materializes real record_intervention_result output into intervention outcome evidence', () => {
    const result = buildSimulationAgentEvidenceMaterialization({
      agentToolRuns: [
        agentToolRun({
          toolName: 'record_intervention_result',
          permissionTier: 'write',
          approvalState: 'approved',
          outputSummary: {
            success: true,
            outcome: {
              feedback: 'accepted',
              helpful: true,
            },
          },
        }),
      ],
      now: completedAt,
    });
    const factInput = result.learningFacts[0] as Record<string, any>;

    expect(result.drafts[0]).toMatchObject({
      reviewerState: 'approved',
      confidence: 0.65,
      summary: {
        deterministicMetrics: {
          interventionOutcome: 1,
        },
      },
    });
    expect(factInput).toMatchObject({
      factType: 'ai_intervention',
      contextJson: {
        agentTool: {
          agentToolRunId: 'tool-run-1',
          agentSessionId: 'agent-session-1',
          agentAssisted: true,
          interventionOutcome: 1,
          reviewerState: 'approved',
        },
      },
    });
  });

  it('feeds feature cache and teacher scope from materialized summaries without raw trace scans', () => {
    const result = buildSimulationAgentEvidenceMaterialization({
      simulationRuns: [
        {
          run: simulationRun(),
          trace: simulationTrace(),
        },
        {
          run: simulationRun({
            id: 'run-other-class',
            ownerUserId: 'student-2',
            classId: 'class-2',
            sourceRefId: 'preview-2',
          }),
          trace: simulationTrace({
            id: 'trace-other-class',
            runId: 'run-other-class',
          }),
        },
      ],
      now: completedAt,
    });
    const facts = result.learningFacts.map((item, index) => asLearningFact(item as Record<string, unknown>, `fact-${index}`));

    const payload = buildStudentEvidenceFeaturePayload({
      userId: 'student-1',
      facts: facts.filter((item) => item.userId === 'student-1'),
      now: completedAt,
    });
    expect(payload.features.simulationArena.allTime).toMatchObject({
      evidenceCount: 1,
      previewCount: 1,
      agentAssistedCount: 1,
      traceReferenceCount: 1,
      replayConfidence: {
        average: 0.45,
        highConfidenceCount: 0,
        lowConfidenceCount: 1,
      },
    });
    expect(JSON.stringify(payload.features.simulationArena)).not.toContain('samples');

    const scoped = buildTeacherScopedSimulationArenaFeatureMap(
      ['student-1', 'student-2'],
      facts,
      {
        classId: 'class-1',
        now: completedAt,
      },
    );
    expect(scoped.get('student-1')?.allTime.evidenceCount).toBe(1);
    expect(scoped.get('student-2')?.allTime.evidenceCount).toBe(0);
  });
});
