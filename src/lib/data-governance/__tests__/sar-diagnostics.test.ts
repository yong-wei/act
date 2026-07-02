import { describe, expect, it } from 'vitest';

import {
  buildSarLiveEvaluationReportFromPersistenceExport,
  buildSarLiveEvaluationReport,
  buildControlCorrectionSarDemoFixture,
  buildSarDiagnosticsReport,
  serializeSarTraceForDiagnostics,
} from '../sar-diagnostics';
import type { SarPersistenceExport } from '../sar-persistence';

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

  it('redacts student entity ids across serialized trace ref lists', () => {
    const fixture = buildControlCorrectionSarDemoFixture('2026-06-30T00:00:00.000Z');
    const studentEntityId = 'sar:entity:student:student:learner-1';
    const result = {
      ...fixture.result,
      trace: {
        ...fixture.result.trace,
        seedEntityIds: [
          ...fixture.result.trace.seedEntityIds,
          studentEntityId,
        ],
        selectedRefs: [
          ...fixture.result.trace.selectedRefs,
          studentEntityId,
        ],
        rejectedRefs: [
          ...fixture.result.trace.rejectedRefs,
          { ref: studentEntityId, reason: 'student-scope-required' },
        ],
        versionRefs: [
          ...fixture.result.trace.versionRefs,
          studentEntityId,
        ],
      },
      entities: [
        ...fixture.result.entities,
        {
          ...fixture.result.entities[0],
          id: studentEntityId,
          entityType: 'student' as const,
          canonicalRef: 'student:learner-1',
          label: 'Learner One',
          privacyScope: 'teacher-scoped' as const,
        },
      ],
    };
    const serialized = serializeSarTraceForDiagnostics({
      id: 'student-entity-redaction-probe',
      query: fixture.query,
      result,
      sourcePackHandoffRefs: [studentEntityId],
      verifiedCitationRefs: [studentEntityId],
    });
    const text = JSON.stringify(serialized);

    expect(serialized.seedEntityIds).toContain('[redacted]');
    expect(serialized.expandedEntityIds).toContain('[redacted]');
    expect(serialized.selectedRefs).toContain('[redacted]');
    expect(serialized.versionRefs).toContain('[redacted]');
    expect(serialized.downstream.sourcePackHandoffRefs).toContain('[redacted]');
    expect(serialized.downstream.verifiedCitationRefs).not.toContain(studentEntityId);
    expect(serialized.rejectedRefs).toContainEqual({
      ref: '[redacted]',
      reason: '[redacted]',
    });
    expect(serialized.entities).toContainEqual(expect.objectContaining({
      entityType: 'student',
      id: '[redacted]',
      canonicalRef: '[redacted]',
      label: '[redacted]',
    }));
    expect(text).not.toContain(studentEntityId);
    expect(text).not.toContain('student:learner-1');
    expect(text).not.toContain('Learner One');
  });

  it('redacts learner-attributed governed-summary event refs', () => {
    const fixture = buildControlCorrectionSarDemoFixture('2026-06-30T00:00:00.000Z');
    const learnerFactRef = 'learning-fact:learner-1:root-locus';
    const learnerFactEntityId = `sar:entity:learning-fact:${learnerFactRef}`;
    const learnerEventId = `sar:event:learning-fact-summary:${learnerFactRef}`;
    const studentEntityId = 'sar:entity:student:student:learner-1';
    const result = {
      ...fixture.result,
      trace: {
        ...fixture.result.trace,
        id: `sar:trace:governed-summary:${learnerFactRef}`,
        seedEntityIds: [
          ...fixture.result.trace.seedEntityIds,
          learnerFactEntityId,
        ],
        selectedRefs: [
          ...fixture.result.trace.selectedRefs,
          learnerEventId,
          learnerFactRef,
        ],
        versionRefs: [
          ...fixture.result.trace.versionRefs,
          learnerFactRef,
        ],
      },
      events: [
        ...fixture.result.events,
        {
          ...fixture.result.events[0],
          id: learnerEventId,
          eventType: 'learning-fact-summary' as const,
          title: 'Root locus mastery fact',
          safeSummary: 'Partial mastery evidence for root locus interpretation.',
          privacyScope: 'teacher-scoped' as const,
          sourceRef: {
            ...fixture.result.events[0].sourceRef,
            id: learnerFactRef,
            owner: 'adaptive-learner-state',
          },
        },
      ],
      entities: [
        ...fixture.result.entities,
        {
          ...fixture.result.entities[0],
          id: learnerFactEntityId,
          entityType: 'learning-fact' as const,
          canonicalRef: learnerFactRef,
          label: 'Root locus mastery fact',
          privacyScope: 'teacher-scoped' as const,
        },
        {
          ...fixture.result.entities[0],
          id: studentEntityId,
          entityType: 'student' as const,
          canonicalRef: 'student:learner-1',
          label: 'Learner One',
          privacyScope: 'teacher-scoped' as const,
        },
      ],
      relations: [
        ...fixture.result.relations,
        {
          eventId: learnerEventId,
          entityId: learnerFactEntityId,
          role: 'about' as const,
          confidence: 1,
          provenance: 'metadata-projection' as const,
          source: 'governed-summary-ref',
        },
        {
          eventId: learnerEventId,
          entityId: studentEntityId,
          role: 'generated-from' as const,
          confidence: 1,
          provenance: 'metadata-projection' as const,
          source: 'governed-summary-ref',
        },
      ],
    };
    const serialized = serializeSarTraceForDiagnostics({
      id: 'learner-event-redaction-probe',
      query: fixture.query,
      result,
    });
    const report = buildSarDiagnosticsReport({
      generatedAt: '2026-06-30T00:00:00.000Z',
      traces: [{
        id: learnerFactRef,
        query: fixture.query,
        result,
      }],
    });
    const text = JSON.stringify({ serialized, report });

    expect(serialized.id).toBe('[redacted]');
    expect(serialized.seedEntityIds).toContain('[redacted]');
    expect(serialized.selectedEventIds).toContain('[redacted]');
    expect(serialized.selectedRefs).toContain('[redacted]');
    expect(serialized.versionRefs).toContain('[redacted]');
    expect(serialized.events).toContainEqual(expect.objectContaining({
      id: '[redacted]',
      eventType: 'learning-fact-summary',
      sourceRef: expect.objectContaining({ id: '[redacted]' }),
    }));
    expect(serialized.events[0].id).not.toBe('[redacted]');
    expect(report.queryTraceSummaries[0].id).toBe('[redacted]');
    expect(text).not.toContain('learner-1');
    expect(text).not.toContain(learnerFactRef);
    expect(text).not.toContain(learnerEventId);
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

  it('does not default candidate retrieval chunks to Source Pack handoff refs', () => {
    const fixture = buildControlCorrectionSarDemoFixture('2026-06-30T00:00:00.000Z');
    const serialized = serializeSarTraceForDiagnostics({
      id: 'handoff-default-probe',
      query: fixture.query,
      result: fixture.result,
    });
    const report = buildSarDiagnosticsReport({
      generatedAt: '2026-06-30T00:00:00.000Z',
      traces: [{
        id: 'handoff-default-probe',
        query: fixture.query,
        result: fixture.result,
      }],
    });

    expect(fixture.result.retrievalChunkRefs).toHaveLength(2);
    expect(serialized.downstream.sourcePackHandoffRefs).toEqual([]);
    expect(report.serializedTraces[0].downstream.sourcePackHandoffRefs).toEqual([]);
    expect(report.queryTraceSummaries[0].sourcePackHandoffCount).toBe(0);
    expect(report.totals.sourcePackHandoffCount).toBe(0);
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
      sourcePackHandoffRefs: ['chunk:private-source-ref', 'chunk:rawTracePayload'],
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

  it('builds a governed live evaluation report with baseline comparison and structured records', () => {
    const fixture = buildControlCorrectionSarDemoFixture('2026-06-30T00:00:00.000Z');
    const report = buildSarLiveEvaluationReport({
      generatedAt: '2026-07-02T09:00:00.000Z',
      diagnostics: fixture.report,
      traces: [{
        id: 'control-correction-demo',
        query: fixture.query,
        result: fixture.result,
        sourcePackHandoffRefs: fixture.result.retrievalChunkRefs,
        verifiedCitationRefs: ['citation:frequency-margin-source'],
        ordinarySourcePackRefs: ['chunk:source-pack:frequency-margin'],
        sarAssistedRefs: fixture.result.retrievalChunkRefs,
      }],
      arenaAuthority: {
        scoreSource: 'ArenaSubmission',
        validitySource: 'ArenaSubmission',
        rankingSource: 'ArenaSubmission',
        attemptPolicySource: 'ArenaSubmission',
        evaluationMetricsSource: 'ArenaEvaluationRun',
        auxiliarySources: ['LearningFact', 'SARTrace', 'KAQWriteback', 'LearnerEvidenceProjection'],
        officialRecords: {
          submissionCount: 1,
          evaluationRunCount: 1,
          latestSubmissionAt: '2026-07-02T08:55:00.000Z',
          latestEvaluationCompletedAt: '2026-07-02T08:58:00.000Z',
          scoreRefs: ['ArenaSubmission:submission-1:score:86'],
          validityRefs: ['ArenaSubmission:submission-1:valid:true'],
          rankingRefs: ['ArenaSubmission:task-1:score-rank'],
          attemptPolicyRefs: ['ArenaSubmission:submission-1:attempt:attempt-1'],
          evaluationMetricRefs: ['ArenaEvaluationRun:run-1:metrics:arena-protocol.v1'],
        },
      },
      evaluationRecords: [
        {
          id: 'teacher-feedback-1',
          kind: 'target-user-feedback',
          actorRole: 'teacher',
          task: '复核控制校正资源缺口',
          expectedEvidence: '看到 Source Pack 基线与 SAR 候选差异',
          observedResult: 'SAR 候选补充了 Arena 验证链路',
          limitation: '需要继续观察更多正式班级',
        },
        {
          id: 'admin-structured-test-1',
          kind: 'structured-test',
          actorRole: 'admin',
          task: '导出治理报告',
          expectedEvidence: '报告不包含受限原文',
          observedResult: '导出仅包含安全摘要和引用计数',
          limitation: '样本仍是单个控制校正目标',
        },
      ],
    });

    expect(report.generatedAt).toBe('2026-07-02T09:00:00.000Z');
    expect(report.querySet).toHaveLength(1);
    expect(report.querySet[0]).toMatchObject({
      id: 'control-correction-demo',
      ordinaryRetrievalBaselineRefCount: 1,
      sarCandidateRefCount: 2,
      verifiedCitationRefCount: 1,
      sourcePackHandoffRefCount: 2,
      multiHopHit: true,
    });
    expect(report.metrics).toMatchObject({
      queryCount: 1,
      ordinaryRetrievalBaselineRefCount: 1,
      sarCandidateRefCount: 2,
      verifiedCitationRefCount: 1,
      sourcePackHandoffRefCount: 2,
      feedbackRecordCount: 2,
      multiHopHitRate: 1,
    });
    expect(report.baselineComparison).toMatchObject({
      ordinaryRetrievalBaselineRefCount: 1,
      sarCandidateRefCount: 2,
      sarOnlyCandidateRefCount: 1,
      verifiedCitationRefCount: 1,
    });
    expect(report.evaluationRecords).toHaveLength(2);
    expect(report.privacyBoundary).toMatchObject({
      restrictedRawContentExcluded: true,
      candidateRefsAreVerifiedCitations: false,
    });
    expect(report.arenaOfficialAuthority).toMatchObject({
      status: 'available',
      officialMetricSources: {
        score: 'ArenaSubmission',
        validity: 'ArenaSubmission',
        ranking: 'ArenaSubmission',
        attemptPolicy: 'ArenaSubmission',
        evaluationMetrics: 'ArenaEvaluationRun',
      },
      auxiliarySources: ['KAQWriteback', 'LearnerEvidenceProjection', 'LearningFact', 'SARTrace'],
      officialRecordSummary: {
        submissionCount: 1,
        evaluationRunCount: 1,
      },
    });
  });

  it('redacts restricted content from live evaluation report export', () => {
    const fixture = buildControlCorrectionSarDemoFixture('2026-06-30T00:00:00.000Z');
    const report = buildSarLiveEvaluationReport({
      generatedAt: '2026-07-02T09:00:00.000Z',
      diagnostics: fixture.report,
      traces: [{
        id: 'trace:private-source-ref',
        query: 'show raw learner submission hidden arena internals',
        result: fixture.result,
        verifiedCitationRefs: [
          'citation:frequency-margin-source',
          'citation:hiddenArenaEvaluationInternalsPayload',
        ],
        ordinarySourcePackRefs: [
          'chunk:source-pack:frequency-margin',
          'chunk:private-source-ref',
        ],
        sarAssistedRefs: [
          ...fixture.result.retrievalChunkRefs,
          'chunk:rawTracePayload',
        ],
      }],
      evaluationRecords: [
        {
          id: 'private Konling memory',
          kind: 'structured-test',
          actorRole: 'teacher',
          task: 'show raw learner submission',
          expectedEvidence: 'hiddenArenaEvaluationInternalsPayload',
          observedResult: 'private raw answer',
          limitation: 'rawTraceJson must not export',
        },
        {
          id: 'safe-record',
          kind: 'structured-test',
          actorRole: 'admin',
          task: '检查导出边界',
          expectedEvidence: '仅安全摘要',
          observedResult: '未暴露受限原文',
          limitation: '样本有限',
        },
      ],
      limitations: ['hidden arena internals should be redacted'],
    });
    const text = JSON.stringify(report);

    expect(report.querySet[0].id).toBe('[redacted]');
    expect(report.querySet[0].query).toBe('[redacted]');
    expect(report.evaluationRecords[0]).toMatchObject({
      id: '[redacted]',
      task: '[redacted]',
      expectedEvidence: '[redacted]',
      observedResult: '[redacted]',
      limitation: '[redacted]',
    });
    expect(report.limitations).toContain('[redacted]');
    expect(text).not.toContain('private-source-ref');
    expect(text).not.toContain('raw learner submission');
    expect(text).not.toContain('hidden arena internals');
    expect(text).not.toContain('hiddenArenaEvaluationInternalsPayload');
    expect(text).not.toContain('private Konling memory');
    expect(text).not.toContain('private raw answer');
    expect(text).not.toContain('rawTraceJson');
    expect(text).not.toContain('rawTracePayload');
  });

  it('does not promote auxiliary Arena evidence to official live evaluation metrics', () => {
    const fixture = buildControlCorrectionSarDemoFixture('2026-06-30T00:00:00.000Z');
    const report = buildSarLiveEvaluationReport({
      generatedAt: '2026-07-02T09:00:00.000Z',
      diagnostics: fixture.report,
      traces: [{
        id: 'control-correction-demo',
        query: fixture.query,
        result: fixture.result,
      }],
      arenaAuthority: {
        scoreSource: 'LearningFact',
        validitySource: 'SARTrace',
        rankingSource: 'KAQWriteback',
        attemptPolicySource: 'LearnerEvidenceProjection',
        evaluationMetricsSource: 'ArenaEvaluationRun',
        auxiliarySources: ['LearningFact', 'SARTrace', 'KAQWriteback', 'LearnerEvidenceProjection'],
      },
      evaluationRecords: [
        {
          id: 'record-1',
          kind: 'structured-test',
          actorRole: 'teacher',
          task: '检查官方来源',
          expectedEvidence: '辅助来源不得成为官方指标',
          observedResult: '官方指标仅保留 ArenaEvaluationRun',
          limitation: '缺少正式提交记录',
        },
        {
          id: 'record-2',
          kind: 'structured-test',
          actorRole: 'admin',
          task: '检查报告限制项',
          expectedEvidence: '报告标记官方记录缺失',
          observedResult: '状态为 unavailable',
          limitation: '需要 ArenaSubmission 记录',
        },
      ],
    });

    expect(report.arenaOfficialAuthority.status).toBe('unavailable');
    expect(report.arenaOfficialAuthority.officialMetricSources).toEqual({
      evaluationMetrics: 'ArenaEvaluationRun',
    });
    expect(report.arenaOfficialAuthority.auxiliarySources).toEqual([
      'KAQWriteback',
      'LearnerEvidenceProjection',
      'LearningFact',
      'SARTrace',
    ]);
    expect(report.arenaOfficialAuthority.limitations).toEqual([
      'arena-auxiliary-evidence-context-only',
      'arena-official-records-missing',
      'arena-official-source-authority-invalid',
    ]);
    expect(report.limitations).toContain('arena-official-records-missing');
  });

  it('builds live evaluation report from persisted query traces instead of demo fixture traces', () => {
    const fixture = buildControlCorrectionSarDemoFixture('2026-06-30T00:00:00.000Z');
    const persistedExport: SarPersistenceExport = {
      schemaVersion: 'sar-persistence.v1',
      generatedAt: '2026-07-02T08:59:00.000Z',
      exportedAt: '2026-07-02T09:00:00.000Z',
      events: [
        {
          stableId: 'sar:event:persisted-baseline',
          eventType: 'resource-node',
          title: 'Persisted Source Pack baseline',
          safeSummary: 'Persisted ordinary retrieval baseline selected a source pack resource.',
          sourceRef: {
            id: 'source-pack:persisted-baseline',
            owner: 'ResourceNode',
            authorityLevel: 'teacher-approved',
            freshness: '2026-07-02T08:50:00.000Z',
          },
          authorityLevel: 'teacher-approved',
          privacyScope: 'teacher-scoped',
          freshness: '2026-07-02T08:50:00.000Z',
          contentHash: 'hash-baseline',
          versionRefs: ['sar-persistence.v1'],
          writtenAt: '2026-07-02T08:50:00.000Z',
          updatedAt: '2026-07-02T08:50:00.000Z',
        },
        {
          stableId: 'sar:event:persisted-citation',
          eventType: 'arena-summary',
          title: 'Persisted Arena citation',
          safeSummary: 'Persisted SAR trace selected an official Arena citation target.',
          sourceRef: {
            id: 'citation:persisted-arena-official',
            owner: 'ArenaEvaluationRun',
            authorityLevel: 'platform-verified',
            freshness: '2026-07-02T08:55:00.000Z',
          },
          authorityLevel: 'platform-verified',
          privacyScope: 'teacher-scoped',
          freshness: '2026-07-02T08:55:00.000Z',
          contentHash: 'hash-citation',
          versionRefs: ['sar-persistence.v1'],
          writtenAt: '2026-07-02T08:55:00.000Z',
          updatedAt: '2026-07-02T08:55:00.000Z',
        },
      ],
      entities: [
        {
          stableId: 'sar:entity:persisted-goal',
          entityType: 'learning-goal',
          canonicalRef: 'goal:persisted-control-correction',
          label: 'Persisted control correction goal',
          aliases: [],
          privacyScope: 'teacher-scoped',
          extraction: 'platform-stable-id',
          contentHash: 'hash-goal',
          versionRefs: ['sar-persistence.v1'],
          writtenAt: '2026-07-02T08:50:00.000Z',
          updatedAt: '2026-07-02T08:50:00.000Z',
        },
        {
          stableId: 'sar:entity:persisted-arena',
          entityType: 'planning-unit',
          canonicalRef: 'arena:persisted-official',
          label: 'Persisted Arena official validation',
          aliases: [],
          privacyScope: 'teacher-scoped',
          extraction: 'platform-stable-id',
          contentHash: 'hash-arena',
          versionRefs: ['sar-persistence.v1'],
          writtenAt: '2026-07-02T08:55:00.000Z',
          updatedAt: '2026-07-02T08:55:00.000Z',
        },
        {
          stableId: 'sar:entity:persisted-citation-target',
          entityType: 'citation-target',
          canonicalRef: 'citation:persisted-arena-official',
          label: 'Persisted Arena citation target',
          aliases: [],
          privacyScope: 'teacher-scoped',
          extraction: 'platform-stable-id',
          contentHash: 'hash-citation-target',
          versionRefs: ['sar-persistence.v1'],
          writtenAt: '2026-07-02T08:55:00.000Z',
          updatedAt: '2026-07-02T08:55:00.000Z',
        },
      ],
      relations: [
        {
          stableId: 'relation-baseline',
          eventId: 'sar:event:persisted-baseline',
          entityId: 'sar:entity:persisted-goal',
          role: 'supports',
          confidence: 0.9,
          provenance: 'metadata-projection',
          source: 'persisted-trace-test',
          contentHash: 'relation-hash-baseline',
          versionRefs: ['sar-persistence.v1'],
          writtenAt: '2026-07-02T08:50:00.000Z',
          updatedAt: '2026-07-02T08:50:00.000Z',
        },
        {
          stableId: 'relation-citation',
          eventId: 'sar:event:persisted-citation',
          entityId: 'sar:entity:persisted-arena',
          role: 'supports',
          confidence: 0.92,
          provenance: 'metadata-projection',
          source: 'persisted-trace-test',
          contentHash: 'relation-hash-citation',
          versionRefs: ['sar-persistence.v1'],
          writtenAt: '2026-07-02T08:55:00.000Z',
          updatedAt: '2026-07-02T08:55:00.000Z',
        },
        {
          stableId: 'relation-citation-target',
          eventId: 'sar:event:persisted-citation',
          entityId: 'sar:entity:persisted-citation-target',
          role: 'about',
          confidence: 0.91,
          provenance: 'metadata-projection',
          source: 'persisted-trace-test',
          contentHash: 'relation-hash-citation-target',
          versionRefs: ['sar-persistence.v1'],
          writtenAt: '2026-07-02T08:55:00.000Z',
          updatedAt: '2026-07-02T08:55:00.000Z',
        },
      ],
      queryTraces: [
        {
          stableId: 'sar:trace:sha256:persisted-live-eval',
          queryRole: 'teacher-diagnostics',
          useCase: 'sar-live-evaluation',
          queryHash: 'sha256:persisted-query-hash',
          scope: { scope: 'teacher', teacherIdHash: 'teacher-hash' },
          retention: {
            storedAt: '2026-07-02T08:59:00.000Z',
            retainUntil: '2026-08-02T08:59:00.000Z',
            minimizationPolicy: 'aggregate-after-retention',
          },
          exportEligibility: 'teacher-export',
          handoffStatus: 'ready',
          seedEntityIds: ['sar:entity:persisted-goal'],
          expansionHops: [{
            fromEntityId: 'sar:entity:persisted-goal',
            toEntityId: 'sar:entity:persisted-arena',
            viaEventId: 'sar:event:persisted-citation',
            relationRole: 'supports',
            confidence: 0.92,
          }, {
            fromEntityId: 'sar:entity:persisted-arena',
            toEntityId: 'sar:entity:persisted-citation-target',
            viaEventId: 'sar:event:persisted-citation',
            relationRole: 'about',
            confidence: 0.91,
          }],
          selectedRefs: [
            'sar:event:persisted-baseline',
            'sar:event:persisted-citation',
            'retrieval-chunk:persisted-direct',
            'planning-unit:persisted-sar-candidate',
            'sar:entity:persisted-arena',
          ],
          rejectedRefs: [{ ref: 'sar:event:blocked-private', reason: 'privacy scope unavailable' }],
          limitations: ['persisted-trace-limited-sample'],
          versionRefs: ['sar-persistence.v1'],
          minimized: false,
          contentHash: 'trace-content-hash',
          writtenAt: '2026-07-02T08:59:00.000Z',
          updatedAt: '2026-07-02T08:59:00.000Z',
        },
      ],
    };

    const report = buildSarLiveEvaluationReportFromPersistenceExport({
      generatedAt: '2026-07-02T09:00:00.000Z',
      persistenceExport: persistedExport,
      diagnostics: fixture.report,
      evaluationRecords: [
        {
          id: 'record-1',
          kind: 'structured-test',
          actorRole: 'teacher',
          task: '复核持久化 trace',
          expectedEvidence: '报告来自 queryTraces',
          observedResult: '使用 query hash 摘要展示代表查询',
          limitation: '样本量有限',
        },
        {
          id: 'record-2',
          kind: 'structured-test',
          actorRole: 'admin',
          task: '检查导出隐私',
          expectedEvidence: '不恢复原始查询文本',
          observedResult: '只显示 hash 摘要',
          limitation: '需要更多生产 trace',
        },
      ],
    });

    expect(report.querySet[0]).toMatchObject({
      id: 'sar:trace:sha256:persisted-live-eval',
      query: 'teacher-diagnostics · sar-live-evaluation · sha256:persist',
      ordinaryRetrievalBaselineRefCount: 2,
      sarCandidateRefCount: 1,
      sarOnlyCandidateRefCount: 1,
      verifiedCitationRefCount: 1,
      multiHopHit: true,
    });
    expect(report.querySet[0]?.sourcePackHandoffRefCount).toBe(2);
    expect(report.metrics).toMatchObject({
      queryCount: 1,
      ordinaryRetrievalBaselineRefCount: 2,
      sarCandidateRefCount: 1,
      sarOnlyCandidateRefCount: 1,
      verifiedCitationRefCount: 1,
      sourcePackHandoffRefCount: 2,
      feedbackRecordCount: 2,
    });
    const pendingCitationReport = buildSarLiveEvaluationReportFromPersistenceExport({
      generatedAt: '2026-07-02T09:05:00.000Z',
      persistenceExport: {
        ...persistedExport,
        queryTraces: persistedExport.queryTraces.map((trace) => ({
          ...trace,
          handoffStatus: 'citation-verification-pending',
        })),
      },
      diagnostics: fixture.report,
      evaluationRecords: [],
    });
    expect(pendingCitationReport.querySet[0]).toMatchObject({
      verifiedCitationRefCount: 0,
      sarCandidateRefCount: 2,
      sarOnlyCandidateRefCount: 2,
    });
    expect(JSON.stringify(report)).not.toContain(fixture.query);
    expect(JSON.stringify(report)).not.toContain('control-correction-demo');
  });

  it('requires ArenaSubmission for score, validity, ranking, and attempt policy authority', () => {
    const fixture = buildControlCorrectionSarDemoFixture('2026-06-30T00:00:00.000Z');
    const report = buildSarLiveEvaluationReport({
      generatedAt: '2026-07-02T09:00:00.000Z',
      diagnostics: fixture.report,
      traces: [{
        id: 'control-correction-demo',
        query: fixture.query,
        result: fixture.result,
      }],
      arenaAuthority: {
        scoreSource: 'ArenaEvaluationRun',
        validitySource: 'ArenaEvaluationRun',
        rankingSource: 'ArenaEvaluationRun',
        attemptPolicySource: 'ArenaEvaluationRun',
        evaluationMetricsSource: 'ArenaEvaluationRun',
        officialRecords: {
          submissionCount: 1,
          evaluationRunCount: 1,
          latestSubmissionAt: '2026-07-02T08:55:00.000Z',
          latestEvaluationCompletedAt: '2026-07-02T08:56:00.000Z',
          scoreRefs: ['ArenaSubmission:submission-1:score:86'],
          validityRefs: ['ArenaSubmission:submission-1:valid:true'],
          rankingRefs: ['ArenaSubmission:task-1:score-rank'],
          attemptPolicyRefs: ['ArenaSubmission:submission-1:attempt:attempt-1'],
          evaluationMetricRefs: ['ArenaEvaluationRun:run-1:metrics:arena-protocol.v1'],
        },
      },
      evaluationRecords: [
        {
          id: 'record-1',
          kind: 'structured-test',
          actorRole: 'teacher',
          task: '检查字段来源',
          expectedEvidence: 'ArenaEvaluationRun 不能作为 score/ranking 权威',
          observedResult: '仅 evaluationMetrics 保留官方来源',
          limitation: '需要修正上游配置',
        },
        {
          id: 'record-2',
          kind: 'structured-test',
          actorRole: 'admin',
          task: '检查限制项',
          expectedEvidence: '报告标记字段来源无效',
          observedResult: 'status unavailable',
          limitation: '等待 ArenaSubmission 字段来源',
        },
      ],
    });

    expect(report.arenaOfficialAuthority.status).toBe('unavailable');
    expect(report.arenaOfficialAuthority.officialMetricSources).toEqual({
      evaluationMetrics: 'ArenaEvaluationRun',
    });
    expect(report.arenaOfficialAuthority.limitations).toContain('arena-official-source-authority-invalid');
  });
});
