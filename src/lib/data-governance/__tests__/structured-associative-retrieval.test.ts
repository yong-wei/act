import { describe, expect, it } from 'vitest';

import {
  validateSarEntity,
  validateSarEvent,
  validateSarRelation,
  validateSarResult,
  validateSarTrace,
  type SarRetrievalEntity,
  type SarRetrievalEvent,
  type SarRetrievalEventEntity,
  type SarRetrievalResult,
  type SarRetrievalTrace,
  type SarTraceHop,
} from '../structured-associative-retrieval';

const event = (overrides: Partial<SarRetrievalEvent> = {}): SarRetrievalEvent => ({
  id: 'sar:event:kaq:root-locus',
  eventType: 'graph-node',
  title: 'Root locus learning objective',
  safeSummary: 'Safe summary of the governed KAQ graph node.',
  sourceRef: {
    id: 'kaq:unit-3:root-locus',
    owner: 'kaq-graph',
    authorityLevel: 'platform-verified',
    freshness: 'kaq-graph.v1',
    contentHash: 'sha256:abc123',
  },
  privacyScope: 'teacher-scoped',
  ...overrides,
});

const entity = (overrides: Partial<SarRetrievalEntity> = {}): SarRetrievalEntity => ({
  id: 'sar:entity:kaq:root-locus',
  entityType: 'kaq-objective',
  canonicalRef: 'kaq:unit-3:root-locus',
  label: 'Root locus',
  aliases: ['root locus', 'locus plot'],
  privacyScope: 'teacher-scoped',
  extraction: 'platform-stable-id',
  ...overrides,
});

const relation = (overrides: Partial<SarRetrievalEventEntity> = {}): SarRetrievalEventEntity => ({
  eventId: 'sar:event:kaq:root-locus',
  entityId: 'sar:entity:kaq:root-locus',
  role: 'about',
  confidence: 0.94,
  provenance: 'deterministic-id',
  source: 'matched KAQ objective id',
  ...overrides,
});

const trace = (overrides: Partial<SarRetrievalTrace> = {}): SarRetrievalTrace => ({
  id: 'sar:trace:root-locus',
  seedEntityIds: ['sar:entity:kaq:root-locus'],
  expansionHops: [{
    fromEntityId: 'sar:entity:kaq:root-locus',
    toEntityId: 'sar:entity:kaq:root-locus',
    viaEventId: 'sar:event:kaq:root-locus',
    relationRole: 'supports',
    confidence: 0.72,
  }],
  selectedRefs: ['sar:event:kaq:root-locus'],
  rejectedRefs: [{ ref: 'sar:event:private-memory', reason: 'private scope unavailable' }],
  limitations: ['Candidates still require governed citation verification.'],
  versionRefs: ['sar-contract.v1'],
  ...overrides,
});

const sarResult = (overrides: Partial<SarRetrievalResult> = {}): SarRetrievalResult => ({
  id: 'sar:result:root-locus',
  trace: trace(),
  events: [event()],
  entities: [entity()],
  relations: [relation()],
  citationTargetRefs: ['citation-target:kaq:root-locus'],
  retrievalChunkRefs: ['learning-evidence:chunk:root-locus'],
  limitations: ['SAR does not verify final CitationChip payloads.'],
  ...overrides,
});

describe('structured associative retrieval contract', () => {
  it('accepts governed events, entities, relations, traces, and results', () => {
    expect(validateSarEvent(event()).issues).toEqual([]);
    expect(validateSarEntity(entity()).issues).toEqual([]);
    expect(validateSarRelation(relation(), [entity()]).issues).toEqual([]);
    expect(validateSarTrace(trace()).issues).toEqual([]);
    expect(validateSarResult(sarResult()).issues).toEqual([]);
  });

  it('rejects retrieval events without a required source ref', () => {
    const result = validateSarEvent(event({ sourceRef: undefined as unknown as SarRetrievalEvent['sourceRef'] }));
    expect(result.valid).toBe(false);
    expect(result.issues.map((issue) => issue.code)).toContain('missing-event-source-ref');
  });

  it('rejects retrieval entities without a canonical platform ref', () => {
    const result = validateSarEntity(entity({ canonicalRef: '' }));
    expect(result.valid).toBe(false);
    expect(result.issues.map((issue) => issue.code)).toContain('missing-entity-canonical-ref');
  });

  it('rejects unsupported contract enum values', () => {
    expect(validateSarEvent(event({
      eventType: 'unknown-event' as SarRetrievalEvent['eventType'],
    })).issues.map((issue) => issue.path)).toContain('eventType');

    expect(validateSarEvent(event({
      sourceRef: {
        ...event().sourceRef,
        authorityLevel: 'unreviewed' as SarRetrievalEvent['sourceRef']['authorityLevel'],
      },
    })).issues.map((issue) => issue.path)).toContain('sourceRef.authorityLevel');

    expect(validateSarRelation(relation({
      provenance: 'guess' as SarRetrievalEventEntity['provenance'],
    })).issues.map((issue) => issue.path)).toContain('provenance');
  });

  it('rejects confidence outside the governed relation range', () => {
    expect(validateSarRelation(relation({ confidence: -0.01 })).issues.map((issue) => issue.code))
      .toContain('invalid-confidence');
    expect(validateSarRelation(relation({ confidence: 1.01 })).issues.map((issue) => issue.code))
      .toContain('invalid-confidence');
    expect(validateSarTrace(trace({
      expansionHops: [{ ...trace().expansionHops[0], confidence: Number.NaN }],
    })).issues.map((issue) => issue.code)).toContain('invalid-confidence');
  });

  it('keeps LLM extracted entities explicitly low confidence until canonicalized', () => {
    const llmEntity = entity({
      id: 'sar:entity:llm:candidate',
      canonicalRef: 'llm-candidate:dominant-pole',
      extraction: 'llm-candidate',
    });
    const result = validateSarRelation(relation({
      entityId: llmEntity.id,
      confidence: 0.82,
      provenance: 'llm-extraction',
    }), [llmEntity]);
    expect(result.issues.map((issue) => issue.code)).toContain('llm-candidate-high-confidence');
  });

  it('keeps LLM extraction provenance low confidence even without entity context', () => {
    const result = validateSarRelation(relation({
      confidence: 0.99,
      provenance: 'llm-extraction',
    }));
    expect(result.issues.map((issue) => issue.code)).toContain('llm-candidate-high-confidence');
  });

  it('rejects restricted raw content in event summaries and metadata', () => {
    expect(validateSarEvent(event({
      safeSummary: 'Includes raw learner submission text.',
    })).issues.map((issue) => issue.code)).toContain('restricted-raw-content');

    expect(validateSarEvent(event({
      metadata: { nested: { rawSubmission: 'student answer dump' } },
    })).issues.map((issue) => issue.code)).toContain('restricted-raw-content');

    expect(validateSarEvent(event({
      metadata: { arena: 'hidden arena internal scoring table' },
    })).issues.map((issue) => issue.code)).toContain('restricted-raw-content');

    expect(validateSarEvent(event({
      metadata: { hiddenEvaluationInternals: { rubric: 'private' } },
    })).issues.map((issue) => issue.code)).toContain('restricted-raw-content');

    expect(validateSarEvent(event({
      metadata: { note: 'hidden evaluation internals must stay private' },
    })).issues.map((issue) => issue.code)).toContain('restricted-raw-content');

    expect(validateSarEvent(event({
      metadata: { entries: [{ rawSubmission: 'student answer dump' }] },
    })).issues.map((issue) => issue.code)).toContain('restricted-raw-content');

    expect(validateSarEvent(event({
      metadata: { entries: [{ citationChip: { label: 'verified citation' } }] },
    })).issues.map((issue) => issue.code)).toContain('citation-boundary-violation');

    expect(validateSarEvent(event({
      metadata: { entries: ['raw learner submission text'] },
    })).issues.map((issue) => issue.code)).toContain('restricted-raw-content');

    expect(validateSarEvent(event({
      metadata: { rawLearnerSubmission: { answer: 'student answer dump' } },
    })).issues.map((issue) => issue.code)).toContain('restricted-raw-content');

    for (const key of [
      'rawContent',
      'raw_submission',
      'rawSubmission',
      'rawTrace',
      'rawTracePayload',
      'rawAnswers',
      'rawAnswerBody',
      'hiddenArenaEvaluationInternals',
    ] as const) {
      expect(validateSarEvent(event({
        metadata: { [key]: { answer: 'student answer dump' } },
      })).issues.map((issue) => issue.code)).toContain('restricted-raw-content');
    }

    for (const note of [
      'raw trace payload',
      'raw answer body',
      'hidden arena evaluation internals',
    ] as const) {
      expect(validateSarEvent(event({
        metadata: { note },
      })).issues.map((issue) => issue.code)).toContain('restricted-raw-content');
    }

    for (const key of [
      'rawLearnerSubmissionText',
      'rawSubmissionsByStudent',
      'rawAnswerText',
      'rawTraceJson',
      'rawEvidencePayload',
      'hiddenArenaInternalsPayload',
      'privateKonlingMemoryPayload',
      'auditOnlyTracePayload',
    ] as const) {
      expect(validateSarEvent(event({
        metadata: { [key]: { value: 'summarized value' } },
      })).issues.map((issue) => issue.code)).toContain('restricted-raw-content');
    }

    for (const key of ['rawTraceAllowed', 'rawTraceIncluded'] as const) {
      expect(validateSarEvent(event({
        metadata: { [key]: true },
      })).issues).toEqual([]);
    }

    expect(validateSarEvent(event({
      metadata: { CitationChip: { label: 'verified citation' } },
    })).issues.map((issue) => issue.code)).toContain('citation-boundary-violation');

    for (const key of [
      'citationChip',
      'citation_chip',
      'citationAddress',
      'verifiedCitationRefs',
      'citationRefs',
      'citationAddressPayload',
      'verifiedCitationPayload',
      'citationRefsPayload',
      'citationChipPayload',
    ] as const) {
      expect(validateSarEvent(event({
        metadata: { [key]: { label: 'verified citation' } },
      })).issues.map((issue) => issue.code)).toContain('citation-boundary-violation');
    }
  });

  it('preserves the Source Pack and CitationChip boundary', () => {
    expect(validateSarEvent(event({
      metadata: { citationChip: { label: 'verified citation' } },
    })).issues.map((issue) => issue.code)).toContain('citation-boundary-violation');

    expect(validateSarResult(sarResult({
      citationTargetRefs: ['verified:citation-target:kaq:root-locus'],
    })).issues.map((issue) => issue.code)).toContain('citation-boundary-violation');

    expect(validateSarResult(sarResult({
      retrievalChunkRefs: ['verified:learning-evidence:chunk:root-locus'],
    })).issues.map((issue) => issue.code)).toContain('citation-boundary-violation');
  });

  it('validates rejected refs and relation references inside result traces', () => {
    expect(validateSarTrace(trace({
      rejectedRefs: [{} as SarRetrievalTrace['rejectedRefs'][number]],
    })).issues.map((issue) => issue.code)).toContain('invalid-trace');

    expect(validateSarResult(sarResult({
      relations: [relation({ entityId: 'sar:entity:missing' })],
    })).issues.map((issue) => issue.code)).toContain('invalid-reference');
  });

  it('returns issues instead of throwing for malformed nested result arrays', () => {
    expect(() => validateSarResult(sarResult({
      events: [null as unknown as SarRetrievalEvent],
    }))).not.toThrow();
    expect(() => validateSarResult(sarResult({
      entities: [null as unknown as SarRetrievalEntity],
    }))).not.toThrow();
    expect(() => validateSarResult(sarResult({
      relations: [null as unknown as SarRetrievalEventEntity],
    }))).not.toThrow();

    expect(validateSarResult(sarResult({
      events: [null as unknown as SarRetrievalEvent],
    })).valid).toBe(false);
    expect(validateSarResult(sarResult({
      entities: [null as unknown as SarRetrievalEntity],
    })).valid).toBe(false);
    expect(validateSarResult(sarResult({
      relations: [null as unknown as SarRetrievalEventEntity],
    })).valid).toBe(false);
  });

  it('validates trace references against result events and entities', () => {
    expect(validateSarResult(sarResult({
      trace: trace({ seedEntityIds: ['sar:entity:missing'] }),
    })).issues.map((issue) => issue.code)).toContain('invalid-reference');

    expect(validateSarResult(sarResult({
      trace: trace({
        expansionHops: [{
          ...trace().expansionHops[0],
          fromEntityId: 'sar:entity:missing',
        }],
      }),
    })).issues.map((issue) => issue.code)).toContain('invalid-reference');

    expect(validateSarResult(sarResult({
      trace: trace({
        expansionHops: [{
          ...trace().expansionHops[0],
          toEntityId: 'sar:entity:missing',
        }],
      }),
    })).issues.map((issue) => issue.code)).toContain('invalid-reference');

    expect(validateSarResult(sarResult({
      trace: trace({
        expansionHops: [{
          ...trace().expansionHops[0],
          viaEventId: 'sar:event:missing',
        }],
      }),
    })).issues.map((issue) => issue.code)).toContain('invalid-reference');

    expect(validateSarTrace(trace({
      expansionHops: [{
        ...trace().expansionHops[0],
        viaEventId: 42,
      } as unknown as SarTraceHop],
    })).issues.map((issue) => issue.code)).toContain('invalid-trace');

    expect(validateSarTrace(trace({
      expansionHops: [{
        ...trace().expansionHops[0],
        viaEventId: ' ',
      }],
    })).issues.map((issue) => issue.code)).toContain('invalid-trace');

    expect(validateSarResult(sarResult({
      trace: trace({ selectedRefs: ['sar:event:missing'] }),
    })).issues.map((issue) => issue.code)).toContain('invalid-reference');
  });

  it('allows selected refs to point at result citation targets and retrieval chunks', () => {
    expect(validateSarResult(sarResult({
      trace: trace({
        selectedRefs: [
          'citation-target:kaq:root-locus',
          'learning-evidence:chunk:root-locus',
        ],
      }),
    })).issues).toEqual([]);
  });

  it('rejects blank or whitespace-only strings in ref/id string arrays', () => {
    const r1 = validateSarResult(sarResult({
      citationTargetRefs: [''],
    }));
    expect(r1.issues.map((i) => i.code)).toContain('missing-required-field');
    expect(r1.issues.find((i) => i.path === 'citationTargetRefs.0')).toBeTruthy();

    const r2 = validateSarResult(sarResult({
      retrievalChunkRefs: ['  ', '\t'],
    }));
    expect(r2.issues.map((i) => i.code)).toContain('missing-required-field');
    expect(r2.issues.find((i) => i.path === 'retrievalChunkRefs.0')).toBeTruthy();
    expect(r2.issues.find((i) => i.path === 'retrievalChunkRefs.1')).toBeTruthy();

    const r3 = validateSarResult(sarResult({
      trace: trace({ seedEntityIds: [''] }),
    }));
    expect(r3.issues.map((i) => i.code)).toContain('invalid-trace');
    expect(r3.issues.find((i) => i.path === 'trace.seedEntityIds.0')).toBeTruthy();

    const r4 = validateSarResult(sarResult({
      trace: trace({ selectedRefs: ['  '] }),
    }));
    expect(r4.issues.map((i) => i.code)).toContain('invalid-trace');
    expect(r4.issues.find((i) => i.path === 'trace.selectedRefs.0')).toBeTruthy();

    const r5 = validateSarTrace(trace({ versionRefs: [''] }));
    expect(r5.issues.map((i) => i.code)).toContain('invalid-trace');
    expect(r5.issues.find((i) => i.path === 'versionRefs.0')).toBeTruthy();
  });

  it('rejects rawLearnerSubmissions and rawSubmissions metadata keys as restricted raw content', () => {
    for (const key of ['rawLearnerSubmissions', 'rawSubmissions', 'raw_submissions', 'learnerSubmissions']) {
      const r = validateSarEvent(event({
        metadata: { [key]: { entries: ['some data'] } },
      }));
      expect(r.issues.map((i) => i.code)).toContain('restricted-raw-content');
      expect(r.issues.find((i) => i.path.includes(key))).toBeTruthy();
    }

    const text = validateSarEvent(event({
      metadata: { note: 'raw learner submissions must stay outside SAR metadata' },
    }));
    expect(text.issues.map((i) => i.code)).toContain('restricted-raw-content');
    expect(text.issues.find((i) => i.path === 'metadata.note')).toBeTruthy();
  });
});
