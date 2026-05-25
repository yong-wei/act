import { describe, expect, it } from 'vitest';

import {
  buildEvidenceSourceCoverageReport,
  classifyEvidenceRow,
  getEvidenceSourceCatalog,
  resolveInteractionLogEventType,
} from '../evidence-source-catalog';

describe('evidence source catalog', () => {
  it('covers the governed evidence source tables', () => {
    const ids = getEvidenceSourceCatalog().map((entry) => entry.id);

    expect(ids).toEqual(expect.arrayContaining([
      'InteractionLog',
      'StudentStepResponse',
      'SimulationSession',
      'SimulationLog',
      'UserAnswer',
      'AbilityAssessment',
      'PromptAssessment',
      'DesignSession',
      'ArenaBlackBoxExperiment',
      'ArenaVirtualSimulationRun',
      'ArenaSubmission',
      'ArenaEvaluationRun',
      'LearningFact',
    ]));
  });

  it('uses InteractionLog.eventData.eventType before the wrapper event type', () => {
    expect(resolveInteractionLogEventType({
      eventType: 'view',
      eventData: { eventType: 'lesson_submit' },
    })).toMatchObject({
      canonicalEventType: 'lesson_submit',
      wrapperEventType: 'view',
      source: 'payload',
    });

    expect(resolveInteractionLogEventType({
      eventType: 'interact',
      eventData: {},
    })).toMatchObject({
      canonicalEventType: 'interact',
      source: 'wrapper',
      missingPayloadEventType: true,
    });
  });

  it('keeps low-value views and leaderboard browsing as context-only evidence', () => {
    expect(classifyEvidenceRow({
      id: 'log-view',
      sourceId: 'InteractionLog',
      eventType: 'view',
      eventData: { eventType: 'page_view' },
    })).toMatchObject({
      eligibility: 'context-only',
      valueLevel: 'low',
      exclusionReason: 'low_value_activity_context',
    });

    expect(classifyEvidenceRow({
      id: 'log-leaderboard',
      sourceId: 'InteractionLog',
      eventType: 'interact',
      eventData: { eventType: 'arena_leaderboard_view' },
    })).toMatchObject({
      eligibility: 'context-only',
      exclusionReason: 'low_value_activity_context',
    });
  });

  it('excludes inferred seed, showcase, demo, and test provenance from profile eligibility', () => {
    expect(classifyEvidenceRow({
      id: 'answer-seed',
      sourceId: 'UserAnswer',
      sourceLabel: 'extracurricular-showcase-seed',
    })).toMatchObject({
      provenance: 'seed',
      eligibility: 'excluded',
      exclusionReason: 'non_real_provenance',
    });
  });

  it('aggregates coverage counts, windows, users, provenance, and sample references', () => {
    const report = buildEvidenceSourceCoverageReport({
      generatedAt: '2026-05-19T00:00:00.000Z',
      rowsBySource: {
        InteractionLog: [
          {
            id: 'log-submit',
            userId: 'u-1',
            occurredAt: '2026-05-18T10:00:00.000Z',
            eventType: 'submit',
            eventData: { eventType: 'lesson_submit' },
          },
          {
            id: 'log-view',
            userId: 'u-1',
            occurredAt: '2026-05-18T11:00:00.000Z',
            eventType: 'view',
            eventData: { eventType: 'page_view' },
          },
        ],
        UserAnswer: [
          {
            id: 'answer-seed',
            userId: 'u-2',
            occurredAt: '2026-05-17T09:00:00.000Z',
            sourceLabel: 'extracurricular-showcase-seed',
          },
        ],
        ArenaEvaluationRun: [
          {
            id: 'run-1',
            occurredAt: '2026-05-16T09:00:00.000Z',
          },
        ],
      },
    });

    expect(report.totals).toMatchObject({
      totalRows: 4,
      eligibleRows: 1,
      excludedRows: 2,
      unsupportedRows: 1,
      affectedUsers: 2,
    });
    expect(report.sources.find((source) => source.sourceId === 'InteractionLog')).toMatchObject({
      totalRows: 2,
      eligibleRows: 1,
      excludedRows: 1,
      affectedUsers: 1,
      firstObservedAt: '2026-05-18T10:00:00.000Z',
      lastObservedAt: '2026-05-18T11:00:00.000Z',
      sampleSourceReferences: ['InteractionLog:log-submit', 'InteractionLog:log-view'],
    });
    expect(report.sources.find((source) => source.sourceId === 'UserAnswer')?.provenanceCounts).toMatchObject({
      seed: 1,
    });
    expect(report.exclusions).toEqual(expect.arrayContaining([
      expect.objectContaining({
        sourceId: 'InteractionLog',
        reason: 'low_value_activity_context',
        rowCount: 1,
      }),
      expect.objectContaining({
        sourceId: 'ArenaEvaluationRun',
        reason: 'source_not_profile_ready',
        rowCount: 1,
      }),
    ]));
  });
});
