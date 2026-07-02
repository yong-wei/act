import { describe, expect, it } from 'vitest';

import { buildControlCorrectionSarDemoFixture } from '../sar-diagnostics';
import {
  buildControlCorrectionSarRefreshSources,
  runSarProjectionRefresh,
} from '../sar-refresh';

describe('SAR projection refresh orchestration', () => {
  it('upserts SAR projections idempotently and reports persisted counts', () => {
    const now = '2026-07-02T08:00:00.000Z';
    const first = runSarProjectionRefresh({
      sources: buildControlCorrectionSarRefreshSources(now),
      now,
    });
    const second = runSarProjectionRefresh({
      repository: first.repository,
      sources: buildControlCorrectionSarRefreshSources(now),
      now,
    });

    expect(first.writes).toHaveLength(1);
    expect(first.writes[0]).toMatchObject({ family: 'path-summary', persisted: true });
    expect(first.health.totals).toMatchObject({
      sourceFamilyCount: 8,
      projectedEventCount: 5,
      projectedEntityCount: 6,
      projectedRelationCount: 10,
    });
    expect(second.health.totals).toEqual(first.health.totals);
    expect(Object.keys(second.repository.getSnapshot().events)).toHaveLength(5);
  });

  it('reports stale and failed source health with retry state', () => {
    const result = buildControlCorrectionSarDemoFixture('2026-07-02T08:00:00.000Z').result;
    const refresh = runSarProjectionRefresh({
      now: '2026-07-02T08:05:00.000Z',
      sources: [
        {
          family: 'learning-fact-summary',
          sourceVersion: 'learning-facts.v3',
          highWaterMark: '2026-07-01T08:00:00.000Z',
          staleCount: 2,
          retryState: 'retry-scheduled',
          result,
        },
        {
          family: 'simulation-summary',
          sourceVersion: 'simulation.v1',
          failureCount: 1,
          retryState: 'blocked',
          limitations: ['source-unavailable'],
        },
      ],
    });

    expect(refresh.health.status).toBe('failed');
    expect(refresh.health.totals.staleSourceCount).toBe(1);
    expect(refresh.health.totals.failureCount).toBe(1);
    expect(refresh.health.sources).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          family: 'learning-fact-summary',
          status: 'stale',
          retryState: 'retry-scheduled',
          staleCount: 2,
        }),
        expect.objectContaining({
          family: 'simulation-summary',
          status: 'failed',
          retryState: 'blocked',
          failureCount: 1,
        }),
      ]),
    );
  });

  it('redacts restricted limitation details from health payloads', () => {
    const refresh = runSarProjectionRefresh({
      now: '2026-07-02T08:00:00.000Z',
      sources: [
        {
          family: 'learning-evidence',
          limitations: [
            'raw answer body leaked',
            'hiddenArenaEvaluationInternalsPayload',
            'private Konling memory',
            'audit only trace',
          ],
        },
      ],
    });
    const serialized = JSON.stringify(refresh.health);

    expect(refresh.health.limitations).toEqual([
      'restricted-health-detail-redacted',
      'sar-projection-builder-unavailable',
    ]);
    expect(serialized).not.toContain('raw answer body');
    expect(serialized).not.toContain('hiddenArenaEvaluationInternalsPayload');
    expect(serialized).not.toContain('private Konling memory');
    expect(serialized).not.toContain('audit only trace');
  });

  it('preserves Arena official authority and demotes auxiliary sources', () => {
    const valid = runSarProjectionRefresh({
      now: '2026-07-02T08:00:00.000Z',
      sources: [{
        family: 'arena-official',
        arenaAuthority: {
          scoreSource: 'ArenaEvaluationRun',
          validitySource: 'ArenaEvaluationRun',
          rankingSource: 'ArenaSubmission',
          attemptPolicySource: 'ArenaSubmission',
          evaluationMetricsSource: 'ArenaEvaluationRun',
          auxiliarySources: ['LearningFact', 'SARTrace', 'KAQWriteback'],
          officialRecords: {
            submissionCount: 1,
            evaluationRunCount: 1,
            latestSubmissionAt: '2026-07-02T07:55:00.000Z',
            latestEvaluationCompletedAt: '2026-07-02T07:56:00.000Z',
            scoreRefs: ['ArenaSubmission:submission-1:score:86'],
            validityRefs: ['ArenaSubmission:submission-1:valid:true'],
            rankingRefs: ['ArenaSubmission:task-1:score-rank'],
            attemptPolicyRefs: ['ArenaSubmission:submission-1:attempt:attempt-1'],
            evaluationMetricRefs: ['ArenaEvaluationRun:run-1:metrics:arena-protocol.v1'],
          },
        },
      }],
    });
    const invalid = runSarProjectionRefresh({
      now: '2026-07-02T08:00:00.000Z',
      sources: [{
        family: 'arena-official',
        arenaAuthority: {
          scoreSource: 'LearningFact',
          validitySource: 'SARTrace',
          rankingSource: 'KAQWriteback',
          attemptPolicySource: 'ArenaSubmission',
          evaluationMetricsSource: 'ArenaEvaluationRun',
        },
      }],
    });

    expect(valid.health.status).toBe('degraded');
    expect(valid.health.sources[0].arenaAuthority).toMatchObject({
      officialSources: ['ArenaEvaluationRun', 'ArenaSubmission'],
      auxiliarySources: ['KAQWriteback', 'LearningFact', 'SARTrace'],
      officialRecordSummary: {
        submissionCount: 1,
        evaluationRunCount: 1,
      },
    });
    expect(valid.health.limitations).toEqual([
      'arena-auxiliary-evidence-context-only',
      'sar-projection-builder-unavailable',
    ]);
    expect(invalid.health.status).toBe('failed');
    expect(invalid.health.limitations).toEqual([
      'arena-auxiliary-evidence-context-only',
      'arena-official-records-missing',
      'arena-official-source-authority-invalid',
      'sar-projection-builder-unavailable',
    ]);
    expect(invalid.health.sources[0].arenaAuthority).toMatchObject({
      officialSources: ['ArenaEvaluationRun', 'ArenaSubmission'],
      auxiliarySources: ['KAQWriteback', 'LearningFact', 'SARTrace'],
    });
  });
});
