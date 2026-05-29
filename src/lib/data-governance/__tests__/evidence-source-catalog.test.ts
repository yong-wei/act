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

  it('reports Arena preview rows without canonical SimulationRun mapping as readiness gaps', () => {
    const catalogEntry = getEvidenceSourceCatalog().find((entry) => entry.id === 'ArenaVirtualSimulationRun');

    expect(catalogEntry?.traceabilityFields).toContain('simulationRunId');
    expect(classifyEvidenceRow({
      id: 'arena-preview-legacy',
      sourceId: 'ArenaVirtualSimulationRun',
      userId: 'student-1',
      eventData: {
        taskId: 'task-a',
        datasetHash: 'dataset-hash',
        controllerHash: 'controller-hash',
        scenarioId: 'scenario-a',
        summary: { trackingError: 0.2 },
        replay: { checksum: 'sha256:abc' },
        metadata: {
          evaluationVisibility: 'preview',
          officialEligible: false,
          modelRelation: 'identified-model-controller',
          datasetHash: 'dataset-hash',
          controllerHash: 'controller-hash',
          identificationModelId: 'model-1',
          sourceExperimentId: 'experiment-1',
        },
      },
    })).toMatchObject({
      eligibility: 'context-only',
      materializationReadiness: 'partial',
      exclusionReason: 'missing_simulation_run_mapping',
      readinessGaps: ['missing_simulation_run_mapping'],
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
        ArenaVirtualSimulationRun: [
          {
            id: 'arena-preview-legacy',
            userId: 'u-3',
            occurredAt: '2026-05-18T12:00:00.000Z',
            eventData: {
              taskId: 'task-a',
              datasetHash: 'dataset-hash',
              controllerHash: 'controller-hash',
              scenarioId: 'scenario-a',
              summary: { trackingError: 0.2 },
              replay: { checksum: 'sha256:abc' },
              metadata: {
                evaluationVisibility: 'preview',
                officialEligible: false,
                modelRelation: 'identified-model-controller',
                datasetHash: 'dataset-hash',
                controllerHash: 'controller-hash',
                identificationModelId: 'model-1',
                sourceExperimentId: 'experiment-1',
              },
            },
          },
        ],
      },
    });

    expect(report.totals).toMatchObject({
      totalRows: 5,
      eligibleRows: 1,
      excludedRows: 3,
      unsupportedRows: 1,
      affectedUsers: 3,
    });
    expect(report.sources.find((source) => source.sourceId === 'ArenaVirtualSimulationRun')).toMatchObject({
      totalRows: 1,
      eligibleRows: 0,
      excludedRows: 1,
      materializationReadiness: 'partial',
      readinessGapCounts: { missing_simulation_run_mapping: 1 },
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
      expect.objectContaining({
        sourceId: 'ArenaVirtualSimulationRun',
        reason: 'missing_simulation_run_mapping',
        rowCount: 1,
      }),
    ]));
  });
});
