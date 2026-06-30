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
    expect(report.comparison.sarAssistedRefCount).toBe(2);
    expect(report.totals.sarCandidateAdoptionCount).toBe(1);
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
          reason: '[redacted]',
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
    expect(text).not.toContain('audit-scope-required');
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
          { ref: 'rawTraceJson', reason: 'rawAnswerBody included rawLearnerSubmission' },
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
    expect(JSON.stringify(report)).not.toContain('rawLearnerSubmission');
    expect(JSON.stringify(report)).not.toContain('rawTraceJson');
    expect(JSON.stringify(report)).not.toContain('rawAnswerBody');
    expect(JSON.stringify(report)).not.toContain('hidden arena internals');
    expect(report.serializedTraces[0].rejectedRefs).toContainEqual({
      ref: 'unsafe-ref',
      reason: '[redacted]',
    });
    expect(report.serializedTraces[0].rejectedRefs).toContainEqual({
      ref: '[redacted]',
      reason: '[redacted]',
    });
    expect(report.serializedTraces[0].limitations).toContain('[redacted]');
    expect(report.limitationCounts['[redacted]']).toBe(1);
  });

  it('serializes result-level limitations consistently with report counts', () => {
    const fixture = buildControlCorrectionSarDemoFixture('2026-06-30T00:00:00.000Z');
    const result = {
      ...fixture.result,
      trace: {
        ...fixture.result.trace,
        limitations: ['trace-only-limitation'],
      },
      limitations: ['trace-only-limitation', 'result-only-limitation'],
    };
    const report = buildSarDiagnosticsReport({
      generatedAt: '2026-06-30T00:00:00.000Z',
      traces: [{
        id: 'limitation-probe',
        query: fixture.query,
        result,
      }],
    });

    expect(report.serializedTraces[0].limitations).toEqual([
      'result-only-limitation',
      'trace-only-limitation',
    ]);
    expect(report.queryTraceSummaries[0].limitationCount).toBe(2);
    expect(report.totals.limitationCount).toBe(2);
  });

  it('defaults SAR-assisted comparison to retrieval chunk refs', () => {
    const fixture = buildControlCorrectionSarDemoFixture('2026-06-30T00:00:00.000Z');
    const report = buildSarDiagnosticsReport({
      generatedAt: '2026-06-30T00:00:00.000Z',
      traces: [{
        id: 'chunk-default-probe',
        query: fixture.query,
        result: fixture.result,
        ordinarySourcePackRefs: ['chunk:source-pack:frequency-margin'],
      }],
    });

    expect(fixture.result.trace.selectedRefs.length).toBeGreaterThan(fixture.result.retrievalChunkRefs.length);
    expect(report.comparison.sarAssistedRefCount).toBe(2);
    expect(report.totals.sarCandidateAdoptionCount).toBe(1);
  });

  it('redacts sensitive ids and refs from unfiltered trace inputs', () => {
    const fixture = buildControlCorrectionSarDemoFixture('2026-06-30T00:00:00.000Z');
    const result = {
      ...fixture.result,
      trace: {
        ...fixture.result.trace,
        id: 'sar:trace:hidden-arena-internals',
        seedEntityIds: [
          ...fixture.result.trace.seedEntityIds,
          'sar:entity:private-raw-submission',
          'sar:entity:private-student',
        ],
        selectedRefs: [
          ...fixture.result.trace.selectedRefs,
          'sar:event:hidden-arena-internals',
          'raw-submission-payload:student-control-demo',
          'sar:event:private-memory',
          'citation:private-source-ref',
          'sar:event:rawLearnerSubmission',
          'sar:trace:rawTraceJson',
        ],
        versionRefs: [
          ...fixture.result.trace.versionRefs,
          'audit-only-trace.v1',
          'version:private-source-ref',
        ],
      },
      events: [
        ...fixture.result.events,
        {
          ...fixture.result.events[0],
          id: 'sar:event:hidden-arena-internals',
          sourceRef: {
            ...fixture.result.events[0].sourceRef,
            id: 'sar:event:hidden-arena-internals',
          },
        },
        {
          ...fixture.result.events[0],
          id: 'sar:event:private-memory',
          title: 'rawLearnerSubmission should be omitted',
          safeSummary: 'rawTraceJson should be omitted',
          sourceRef: {
            ...fixture.result.events[0].sourceRef,
            id: 'source:private-source-ref',
          },
        },
      ],
      entities: [
        ...fixture.result.entities,
        {
          ...fixture.result.entities[0],
          id: 'sar:entity:raw-submission',
          canonicalRef: 'raw-submission-payload:student-control-demo',
        },
        {
          ...fixture.result.entities[0],
          id: 'sar:entity:private-source-ref',
          canonicalRef: 'canonical:private-source-ref',
          label: 'rawAnswerBody should be omitted',
        },
      ],
      citationTargetRefs: [
        ...fixture.result.citationTargetRefs,
        'citation:private-source-ref',
        'citation:rawAnswerBody',
      ],
      retrievalChunkRefs: [
        ...fixture.result.retrievalChunkRefs,
        'chunk:hidden-arena-internals',
        'chunk:private-source-ref',
        'chunk:rawTracePayload',
      ],
    };

    const serialized = serializeSarTraceForDiagnostics({
      id: 'unfiltered-probe',
      query: fixture.query,
      result,
      verifiedCitationRefs: ['citation:private-source-ref', 'citation:rawAnswerBody'],
    });
    const text = JSON.stringify(serialized);

    expect(serialized.id).toBe('[redacted]');
    expect(serialized.seedEntityIds).toContain('[redacted]');
    expect(serialized.selectedRefs).toContain('[redacted]');
    expect(serialized.versionRefs).toContain('[redacted]');
    expect(serialized.downstream.sourcePackHandoffRefs).toContain('[redacted]');
    expect(serialized.downstream.verifiedCitationRefs).toContain('[redacted]');
    expect(text).not.toContain('sar:event:hidden-arena-internals');
    expect(text).not.toContain('private-raw-submission');
    expect(text).not.toContain('private-student');
    expect(text).not.toContain('private-memory');
    expect(text).not.toContain('private-source-ref');
    expect(text).not.toContain('rawLearnerSubmission');
    expect(text).not.toContain('rawTraceJson');
    expect(text).not.toContain('rawAnswerBody');
    expect(text).not.toContain('rawTracePayload');
    expect(text).not.toContain('raw-submission-payload');
    expect(text).not.toContain('audit-only-trace');
    expect(text).not.toContain('chunk:hidden-arena-internals');
    expect(text).not.toContain('chunk:private-source-ref');
  });

  it('omits audit-only and system-internal events from serialized and counted diagnostics', () => {
    const fixture = buildControlCorrectionSarDemoFixture('2026-06-30T00:00:00.000Z');
    const hiddenAuditEvent = {
      ...fixture.result.events[0],
      id: 'sar:event:audit-only-visible-title',
      title: 'Audit Only Visible Title',
      safeSummary: 'Audit-only summary that should be omitted as an event object.',
      privacyScope: 'audit-only' as const,
      sourceRef: {
        ...fixture.result.events[0].sourceRef,
        id: 'sar:event:audit-only-visible-title',
        owner: 'AuditOnlyOwner',
      },
      metadata: {
        auditCitationTargetId: 'citation:audit-only-visible-target',
        auditRetrievalChunkId: 'chunk:audit-only-visible-target',
      },
    };
    const hiddenSystemEvent = {
      ...fixture.result.events[0],
      id: 'sar:event:system-internal-visible-title',
      title: 'System Internal Visible Title',
      safeSummary: 'System-internal summary that should be omitted as an event object.',
      privacyScope: 'system-internal' as const,
      sourceRef: {
        ...fixture.result.events[0].sourceRef,
        id: 'sar:event:system-internal-visible-title',
        owner: 'SystemInternalOwner',
      },
      metadata: {
        systemCitationTargetId: 'citation:system-internal-visible-target',
        systemRetrievalChunkId: 'chunk:system-internal-visible-target',
        nestedRefs: {
          artifactRefs: ['chunk:system-internal-nested-target'],
        },
      },
    };
    const hiddenEntity = {
      ...fixture.result.entities[0],
      id: 'sar:entity:system-internal-visible-label',
      canonicalRef: 'canonical:system-internal-visible-label',
      label: 'System Internal Visible Entity Label',
      privacyScope: 'system-internal' as const,
    };
    const hiddenRejectedRefs = [
      { ref: hiddenAuditEvent.id, reason: 'audit-only privacy scope blocked' },
      { ref: hiddenEntity.id, reason: 'system-internal privacy scope blocked' },
    ];
    const result = {
      ...fixture.result,
      trace: {
        ...fixture.result.trace,
        rejectedRefs: [
          ...fixture.result.trace.rejectedRefs,
          ...hiddenRejectedRefs,
        ],
        expansionHops: [
          ...fixture.result.trace.expansionHops,
          {
            fromEntityId: fixture.result.entities[0].id,
            toEntityId: hiddenEntity.id,
            viaEventId: hiddenSystemEvent.id,
            relationRole: 'about' as const,
            confidence: 1,
          },
        ],
        selectedRefs: [
          ...fixture.result.trace.selectedRefs,
          hiddenAuditEvent.id,
          hiddenSystemEvent.id,
          hiddenEntity.id,
        ],
      },
      events: [
        ...fixture.result.events,
        hiddenAuditEvent,
        hiddenSystemEvent,
      ],
      relations: [
        ...fixture.result.relations,
        {
          eventId: hiddenAuditEvent.id,
          entityId: fixture.result.entities[0].id,
          role: 'about' as const,
          confidence: 1,
          provenance: 'metadata-projection' as const,
          source: 'diagnostics-test',
        },
        {
          eventId: hiddenSystemEvent.id,
          entityId: hiddenEntity.id,
          role: 'about' as const,
          confidence: 1,
          provenance: 'metadata-projection' as const,
          source: 'diagnostics-test',
        },
      ],
      entities: [
        ...fixture.result.entities,
        hiddenEntity,
      ],
      citationTargetRefs: [
        ...fixture.result.citationTargetRefs,
        'citation:audit-only-visible-target',
        'citation:system-internal-visible-target',
      ],
      retrievalChunkRefs: [
        ...fixture.result.retrievalChunkRefs,
        'chunk:audit-only-visible-target',
        'chunk:system-internal-visible-target',
        'chunk:system-internal-nested-target',
      ],
    };
    const report = buildSarDiagnosticsReport({
      generatedAt: '2026-06-30T00:00:00.000Z',
      traces: [{
        id: 'privacy-scope-probe',
        query: fixture.query,
        result,
        sourcePackHandoffRefs: [
          ...fixture.result.retrievalChunkRefs,
          'chunk:audit-only-visible-target',
          'chunk:system-internal-visible-target',
          'chunk:system-internal-nested-target',
        ],
        verifiedCitationRefs: [
          fixture.result.citationTargetRefs[0],
          'citation:audit-only-visible-target',
          'citation:system-internal-visible-target',
        ],
        ordinarySourcePackRefs: [
          fixture.result.retrievalChunkRefs[0],
          'chunk:audit-only-visible-target',
        ],
        sarAssistedRefs: [
          ...fixture.result.retrievalChunkRefs,
          'chunk:audit-only-visible-target',
          'chunk:system-internal-visible-target',
        ],
      }],
    });
    const text = JSON.stringify(report);

    expect(report.totals.eventCount).toBe(fixture.result.events.length);
    expect(report.totals.entityCount).toBe(fixture.result.entities.length);
    expect(report.totals.relationCount).toBe(fixture.result.relations.length);
    expect(report.totals.sourcePackHandoffCount).toBe(fixture.result.retrievalChunkRefs.length);
    expect(report.totals.privacyRejectionCount).toBe(
      fixture.report.totals.privacyRejectionCount + hiddenRejectedRefs.length,
    );
    expect(report.totals.sarCandidateRejectionCount).toBe(
      fixture.report.totals.sarCandidateRejectionCount + hiddenRejectedRefs.length,
    );
    expect(report.comparison.ordinarySourcePackRefCount).toBe(1);
    expect(report.comparison.sarAssistedRefCount).toBe(fixture.result.retrievalChunkRefs.length);
    expect(report.serializedTraces[0].rejectedRefs.slice(-hiddenRejectedRefs.length)).toEqual([
      { ref: '[redacted]', reason: '[redacted]' },
      { ref: '[redacted]', reason: '[redacted]' },
    ]);
    expect(report.privacyScopeCounts).not.toHaveProperty('audit-only');
    expect(report.privacyScopeCounts).not.toHaveProperty('system-internal');
    expect(report.sourceOwnerCounts).not.toHaveProperty('AuditOnlyOwner');
    expect(report.sourceOwnerCounts).not.toHaveProperty('SystemInternalOwner');
    expect(report.eventTypeCounts['path-summary']).toBe(fixture.report.eventTypeCounts['path-summary']);
    expect(report.authorityLevelCounts['platform-verified']).toBe(fixture.report.authorityLevelCounts['platform-verified']);
    expect(text).not.toContain('Audit Only Visible Title');
    expect(text).not.toContain('System Internal Visible Title');
    expect(text).not.toContain('AuditOnlyOwner');
    expect(text).not.toContain('SystemInternalOwner');
    expect(text).not.toContain('System Internal Visible Entity Label');
    expect(text).not.toContain(hiddenEntity.id);
    expect(text).not.toContain(hiddenEntity.canonicalRef);
    expect(text).not.toContain(hiddenAuditEvent.id);
    expect(text).not.toContain(hiddenSystemEvent.id);
    expect(text).not.toContain('citation:audit-only-visible-target');
    expect(text).not.toContain('citation:system-internal-visible-target');
    expect(text).not.toContain('chunk:audit-only-visible-target');
    expect(text).not.toContain('chunk:system-internal-visible-target');
    expect(text).not.toContain('chunk:system-internal-nested-target');
  });

  it('redacts sensitive report summary id and query text', () => {
    const fixture = buildControlCorrectionSarDemoFixture('2026-06-30T00:00:00.000Z');
    const report = buildSarDiagnosticsReport({
      generatedAt: '2026-06-30T00:00:00.000Z',
      traces: [{
        id: 'trace:private-source-ref',
        query: 'show raw learner submission hidden arena internals',
        result: fixture.result,
      }],
    });

    expect(report.queryTraceSummaries[0].id).toBe('[redacted]');
    expect(report.queryTraceSummaries[0].query).toBe('[redacted]');
    expect(JSON.stringify(report.queryTraceSummaries[0])).not.toContain('private-source-ref');
    expect(JSON.stringify(report.queryTraceSummaries[0])).not.toContain('raw learner submission');
    expect(JSON.stringify(report.queryTraceSummaries[0])).not.toContain('hidden arena internals');
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
