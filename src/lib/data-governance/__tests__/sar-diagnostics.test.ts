import { describe, expect, it } from 'vitest';

import {
  buildControlCorrectionSarDemoFixture,
  buildSarDiagnosticsReport,
  serializeSarTraceForDiagnostics,
} from '../sar-diagnostics';

describe('SAR diagnostics and evaluation report', () => {
  it('builds deterministic counts, privacy metrics, handoff metrics, and citation rate', () => {
    const fixture = buildControlCorrectionSarDemoFixture('2026-06-30T00:00:00.000Z');
    const { report } = fixture;

    expect(report.generatedAt).toBe('2026-06-30T00:00:00.000Z');
    expect(report.totals).toMatchObject({
      queryCount: 1,
      eventCount: 5,
      entityCount: 6,
      relationCount: 10,
      privacyRejectionCount: 1,
      verifiedCitationRate: 0.5,
    });
    expect(report.eventTypeCounts).toMatchObject({
      'path-summary': 1,
      'resource-node': 1,
      'learning-fact-summary': 1,
      'simulation-summary': 1,
      'arena-summary': 1,
    });
    expect(report.privacyScopeCounts).toMatchObject({
      'student-visible': 5,
      'teacher-scoped': 6,
    });
    expect(report.authorityLevelCounts).toMatchObject({
      'platform-verified': 3,
      'teacher-approved': 1,
      'metadata-projected': 1,
    });
    expect(report.queryTraceSummaries[0]).toMatchObject({
      id: 'control-correction-demo',
      hopCount: 4,
      privacyRejectionCount: 1,
      sourcePackHandoffCount: 2,
      verifiedCitationRate: 0.5,
      limitationCount: 3,
    });
    expect(report.demoFixtureStatus).toMatchObject({
      id: 'control-correction-demo',
      deterministic: true,
      sourcePackHandoff: true,
      verifiedCitationOutcome: 'available',
    });
    expect(report.comparison.sarAssistedRefCount).toBeGreaterThan(report.comparison.ordinarySourcePackRefCount);
    expect(report.totals.sourcePackHandoffCount).toBe(2);
    expect(report.totals.sarCandidateAdoptionCount).toBe(17);
    expect(report.totals.sarCandidateRejectionCount).toBe(1);
    expect(report.totals.limitationCount).toBe(report.serializedTraces[0].limitations.length);
  });

  it('serializes traces without private raw evidence or hidden internals', () => {
    const fixture = buildControlCorrectionSarDemoFixture('2026-06-30T00:00:00.000Z');
    const serialized = serializeSarTraceForDiagnostics({
      id: 'control-correction-demo',
      query: fixture.query,
      result: fixture.result,
      verifiedCitationRefs: ['citation:frequency-margin-source'],
    });
    const text = JSON.stringify(serialized);

    expect(serialized.seedEntityIds).toContain('sar:entity:goal:control-correction');
    expect(serialized.rejectedRefs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          ref: '[redacted]',
          reason: 'audit-scope-required',
        }),
      ]),
    );
    expect(serialized.selectedEventIds).not.toContain('sar:event:hidden-arena-internals');
    expect(text).toContain('sourcePackHandoffRefs');
    expect(text).not.toContain('sar:event:hidden-arena-internals');
    expect(text).not.toContain('student-control-demo');
    expect(text).not.toContain('ownerUserId');
    expect(text).not.toContain('classId');
    expect(text).not.toContain('contentHash');
    expect(text).not.toContain('"metadata"');
    expect(text).not.toContain('private raw answer');
    expect(text).not.toContain('rawLearnerSubmission');
    expect(text).not.toContain('hiddenArenaEvaluationInternalsPayload');
    expect(text).not.toContain('rawScoreVector');
  });

  it('redacts sensitive reason and limitation text supplied by traces', () => {
    const fixture = buildControlCorrectionSarDemoFixture('2026-06-30T00:00:00.000Z');
    const result = {
      ...fixture.result,
      trace: {
        ...fixture.result.trace,
        rejectedRefs: [
          ...fixture.result.trace.rejectedRefs,
          { ref: 'unsafe-ref', reason: 'raw learner submission included hidden internals' },
        ],
        limitations: [
          ...fixture.result.trace.limitations,
          'raw private evidence must not serialize',
        ],
      },
      limitations: [
        ...fixture.result.limitations,
        'hidden arena internals were filtered',
      ],
    };
    const report = buildSarDiagnosticsReport({
      generatedAt: '2026-06-30T00:00:00.000Z',
      traces: [{
        id: 'redaction-probe',
        query: fixture.query,
        result,
      }],
    });

    expect(JSON.stringify(report)).not.toContain('raw learner submission');
    expect(JSON.stringify(report)).not.toContain('hidden arena internals');
    expect(report.serializedTraces[0].rejectedRefs).toContainEqual({
      ref: 'unsafe-ref',
      reason: '[redacted]',
    });
    expect(report.serializedTraces[0].limitations).toContain('[redacted]');
    expect(report.limitationCounts['[redacted]']).toBe(1);
  });

  it('caps verified citation rate to verified citation targets only', () => {
    const fixture = buildControlCorrectionSarDemoFixture('2026-06-30T00:00:00.000Z');
    const report = buildSarDiagnosticsReport({
      generatedAt: '2026-06-30T00:00:00.000Z',
      traces: [{
        id: 'verified-citation-probe',
        query: fixture.query,
        result: fixture.result,
        verifiedCitationRefs: [
          'citation:frequency-margin-source',
          'citation:arena-validation-source',
          'citation:not-in-targets',
          'citation:not-in-targets',
        ],
      }],
    });

    expect(report.totals.verifiedCitationRate).toBe(1);
    expect(report.queryTraceSummaries[0].verifiedCitationRate).toBe(1);
    expect(report.serializedTraces[0].downstream.verifiedCitationRefs).toEqual([
      'citation:arena-validation-source',
      'citation:frequency-margin-source',
    ]);
  });
});
