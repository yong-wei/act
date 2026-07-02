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

    expect(first.writes.map((write) => write.family).sort()).toEqual([
      'arena-official',
      'kaq-graph',
      'learning-evidence',
      'learning-fact-summary',
      'learning-goal',
      'path-summary',
      'resource-node',
      'simulation-summary',
    ]);
    expect(first.writes.every((write) => write.persisted)).toBe(true);
    expect(first.health.lastSuccessfulAt).toBe(now);
    expect(first.health.sources.find((source) => source.family === 'path-summary')?.lastSuccessfulAt).toBe(now);
    expect(first.health.sources.find((source) => source.family === 'kaq-graph')?.lastSuccessfulAt).toBe(now);
    expect(first.health.limitations).not.toContain('sar-projection-builder-unavailable');
    expect(first.health.totals).toMatchObject({
      sourceFamilyCount: 8,
      projectedEventCount: 8,
      projectedEntityCount: 8,
      projectedRelationCount: 8,
    });
    expect(second.health.totals).toEqual(first.health.totals);
    expect(Object.keys(second.repository.getSnapshot().events)).toHaveLength(8);
    expect(second.repository.getSnapshot().events).not.toHaveProperty('sar:event:arena-validation');
  });

  it('does not mark dry-run refreshes as newly successful', () => {
    const now = '2026-07-02T08:00:00.000Z';
    const previousSuccess = '2026-07-01T08:00:00.000Z';
    const dryRun = runSarProjectionRefresh({
      sources: buildRefreshSourcesWithOfficialArena(now).map((source) => (
        source.family === 'path-summary'
          ? { ...source, lastSuccessfulAt: previousSuccess }
          : source
      )),
      now,
      persist: false,
    });

    expect(dryRun.writes).toHaveLength(0);
    expect(dryRun.health.totals.failureCount).toBe(0);
    expect(dryRun.health.status).toBe('degraded');
    expect(dryRun.health.sources.find((source) => source.family === 'path-summary')?.lastSuccessfulAt).toBe(previousSuccess);
    expect(dryRun.health.lastSuccessfulAt).toBe(previousSuccess);
  });

  it('keeps dry-run last successful time empty when no source has succeeded before', () => {
    const now = '2026-07-02T08:00:00.000Z';
    const dryRun = runSarProjectionRefresh({
      sources: buildRefreshSourcesWithOfficialArena(now),
      now,
      persist: false,
    });

    expect(dryRun.writes).toHaveLength(0);
    expect(dryRun.health.totals.failureCount).toBe(0);
    expect(dryRun.health.lastSuccessfulAt).toBeNull();
  });

  it('reuses persisted source timestamps for ordinary dry-run health reads', () => {
    const refreshTime = '2026-07-02T08:00:00.000Z';
    const readTime = '2026-07-02T08:30:00.000Z';
    const recorded = runSarProjectionRefresh({
      sources: buildRefreshSourcesWithOfficialArena(refreshTime),
      now: refreshTime,
    });
    const ordinaryRead = runSarProjectionRefresh({
      repository: recorded.repository,
      sources: buildRefreshSourcesWithOfficialArena(readTime),
      now: readTime,
      persist: false,
    });

    expect(ordinaryRead.writes).toHaveLength(0);
    expect(ordinaryRead.health.lastSuccessfulAt).toBe(refreshTime);
    expect(ordinaryRead.health.sources.find((source) => source.family === 'kaq-graph')?.lastSuccessfulAt).toBe(refreshTime);
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

  it('keeps Arena coverage limitations when adding auxiliary context warnings', () => {
    const refresh = runSarProjectionRefresh({
      now: '2026-07-02T08:00:00.000Z',
      sources: buildControlCorrectionSarRefreshSources('2026-07-02T08:00:00.000Z', {
        coverageSources: [{
          sourceId: 'ArenaSubmission',
          totalRows: 3,
          eligibleRows: 1,
          excludedRows: 1,
          unsupportedRows: 0,
          lastObservedAt: '2026-07-02T07:55:00.000Z',
          materializationReadiness: 'ready',
          readinessGapCounts: { demoRowsExcluded: 1 },
        }],
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
      }),
    });
    const arena = refresh.health.sources.find((source) => source.family === 'arena-official');

    expect(arena?.limitations).toEqual([
      'arena-auxiliary-evidence-context-only',
      'readiness-gap:demoRowsExcluded',
      'source-rows-excluded',
    ]);
    expect(refresh.health.limitations).toEqual(expect.arrayContaining([
      'arena-auxiliary-evidence-context-only',
      'readiness-gap:demoRowsExcluded',
      'source-rows-excluded',
    ]));
  });
});

function buildRefreshSourcesWithOfficialArena(now: string): ReturnType<typeof buildControlCorrectionSarRefreshSources> {
  return buildControlCorrectionSarRefreshSources(now).map((source) => (
    source.family === 'arena-official'
      ? {
          ...source,
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
        }
      : source
  ));
}
