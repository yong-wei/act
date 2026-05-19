import { describe, expect, it, vi } from 'vitest';

import {
  applyHistoricalEvidenceMaterializationPlan,
  buildHistoricalEvidenceMaterializationPlan,
} from '../historical-evidence-materialization';

describe('historical evidence materialization', () => {
  it('emits traceable candidates for real high-value historical evidence', () => {
    const plan = buildHistoricalEvidenceMaterializationPlan({
      generatedAt: '2026-05-19T00:00:00.000Z',
      existingSourceEventIds: new Set(),
      rowsBySource: {
        SimulationLog: [
          {
            id: 'sim-1',
            userId: 'student-1',
            occurredAt: '2026-05-18T10:00:00.000Z',
            sourceLabel: 'real-student-run',
            eventData: {
              moduleId: 'module-3',
              score: 82,
              durationSeconds: 140,
            },
          },
        ],
      },
    });

    expect(plan.totals).toMatchObject({
      candidateRows: 1,
      newFactRows: 1,
      excludedRows: 0,
      unsupportedRows: 0,
      lowConfidenceRows: 0,
      affectedUsers: 1,
    });
    expect(plan.candidates[0]).toMatchObject({
      sourceId: 'SimulationLog',
      stableSourceIdentity: 'historical:SimulationLog:sim-1:simulation_attempt',
      evidenceSubtype: 'simulation_attempt',
      traceReference: 'SimulationLog:sim-1',
      confidence: 'high',
      alreadyMaterialized: false,
      fact: {
        userId: 'student-1',
        sourceEventId: 'historical:SimulationLog:sim-1:simulation_attempt',
        factType: 'simulation',
        moduleId: 'module-3',
        score: 82,
        timeSpent: 140,
        contextJson: {
          historicalMaterialization: {
            sourceId: 'SimulationLog',
            sourceRecordId: 'sim-1',
            evidenceSubtype: 'simulation_attempt',
            originalTimestamp: '2026-05-18T10:00:00.000Z',
            traceReference: 'SimulationLog:sim-1',
          },
        },
      },
    });
  });

  it('keeps non-real, unknown, context-only, and unsupported rows out of profile-grade facts', () => {
    const plan = buildHistoricalEvidenceMaterializationPlan({
      generatedAt: '2026-05-19T00:00:00.000Z',
      existingSourceEventIds: new Set(),
      rowsBySource: {
        UserAnswer: [
          { id: 'answer-seed', userId: 'student-1', sourceLabel: 'showcase-seed' },
        ],
        SimulationLog: [
          { id: 'sim-unknown', userId: 'student-2' },
        ],
        InteractionLog: [
          {
            id: 'log-view',
            userId: 'student-3',
            eventType: 'view',
            eventData: { eventType: 'page_view' },
            sourceLabel: 'real-web',
          },
        ],
        ArenaEvaluationRun: [
          { id: 'arena-run', sourceLabel: 'real-arena-run' },
        ],
      },
    });

    expect(plan.totals).toMatchObject({
      candidateRows: 0,
      newFactRows: 0,
      excludedRows: 2,
      unsupportedRows: 1,
      lowConfidenceRows: 1,
      affectedUsers: 0,
    });
    expect(plan.skipped.map((item) => item.reason)).toEqual(expect.arrayContaining([
      'non_real_provenance',
      'unknown_provenance',
      'low_value_activity_context',
      'source_not_profile_ready',
    ]));
  });

  it('uses InteractionLog payload event type as the stable materialization subtype', () => {
    const plan = buildHistoricalEvidenceMaterializationPlan({
      generatedAt: '2026-05-19T00:00:00.000Z',
      existingSourceEventIds: new Set(),
      rowsBySource: {
        InteractionLog: [
          {
            id: 'log-submit',
            userId: 'student-1',
            occurredAt: '2026-05-18T11:00:00.000Z',
            eventType: 'view',
            eventData: {
              eventType: 'lesson_submit',
              lessonKey: 'unit-4-7-v1',
              stepId: 'step-02',
              score: 75,
            },
            sourceLabel: 'real-classroom',
          },
        ],
      },
    });

    expect(plan.candidates[0]).toMatchObject({
      stableSourceIdentity: 'historical:InteractionLog:log-submit:lesson_submit',
      evidenceSubtype: 'lesson_submit',
      canonicalEventType: 'lesson_submit',
      fact: {
        factType: 'question',
        lessonId: 'unit-4-7-v1',
        moduleId: 'step-02',
        sourceLogId: 'log-submit',
        score: 75,
      },
    });
  });

  it('applies only new facts and reports already materialized stable identities', async () => {
    const plan = buildHistoricalEvidenceMaterializationPlan({
      generatedAt: '2026-05-19T00:00:00.000Z',
      existingSourceEventIds: new Set(['historical:SimulationLog:sim-1:simulation_attempt']),
      rowsBySource: {
        SimulationLog: [
          {
            id: 'sim-1',
            userId: 'student-1',
            occurredAt: '2026-05-18T10:00:00.000Z',
            sourceLabel: 'real-student-run',
          },
          {
            id: 'sim-2',
            userId: 'student-2',
            occurredAt: '2026-05-18T10:05:00.000Z',
            sourceLabel: 'real-student-run',
          },
        ],
      },
    });
    const createMany = vi.fn().mockResolvedValue({ count: 1 });

    const result = await applyHistoricalEvidenceMaterializationPlan(
      { learningFact: { createMany } },
      plan,
    );

    expect(result).toMatchObject({
      candidateRows: 2,
      alreadyMaterializedRows: 1,
      requestedCreateRows: 1,
      createdRows: 1,
    });
    expect(createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          sourceEventId: 'historical:SimulationLog:sim-2:simulation_attempt',
        }),
      ],
      skipDuplicates: true,
    });
  });
});
