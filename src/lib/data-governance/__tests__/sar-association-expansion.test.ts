import { describe, expect, it } from 'vitest';

import { expandSarAssociations } from '../sar-association-expansion';
import type {
  SarRetrievalEntity,
  SarRetrievalEvent,
  SarRetrievalEventEntity,
  SarRetrievalResult,
} from '../structured-associative-retrieval-types';

const entity = (overrides: Partial<SarRetrievalEntity>): SarRetrievalEntity => ({
  id: 'sar:entity:graph-node:knowledge:bode-margin',
  entityType: 'graph-node',
  canonicalRef: 'knowledge:bode-margin',
  label: 'Bode margin',
  aliases: ['bode margin'],
  privacyScope: 'student-visible',
  extraction: 'platform-stable-id',
  ...overrides,
});

const event = (overrides: Partial<SarRetrievalEvent>): SarRetrievalEvent => ({
  id: 'sar:event:graph-node:bode-margin',
  eventType: 'graph-node',
  title: 'Bode margin relation',
  safeSummary: 'Safe governed summary.',
  sourceRef: {
    id: 'knowledge:bode-margin',
    owner: 'kaq-graph',
    authorityLevel: 'platform-verified',
    freshness: 'test',
  },
  privacyScope: 'student-visible',
  ...overrides,
});

const relation = (overrides: Partial<SarRetrievalEventEntity>): SarRetrievalEventEntity => ({
  eventId: 'sar:event:graph-node:bode-margin',
  entityId: 'sar:entity:graph-node:knowledge:bode-margin',
  role: 'about',
  confidence: 1,
  provenance: 'deterministic-id',
  source: 'test-fixture',
  ...overrides,
});

const projection = (overrides: Partial<SarRetrievalResult> = {}): SarRetrievalResult => ({
  id: 'sar:result:test',
  events: [],
  entities: [],
  relations: [],
  citationTargetRefs: [],
  retrievalChunkRefs: [],
  limitations: [],
  trace: {
    id: 'sar:trace:test',
    seedEntityIds: [],
    expansionHops: [],
    selectedRefs: [],
    rejectedRefs: [],
    limitations: [],
    versionRefs: ['sar-projection.test'],
  },
  ...overrides,
});

const teachingFixture = (): SarRetrievalResult => {
  const bodeMargin = entity({
    id: 'sar:entity:graph-node:knowledge:bode-margin',
    entityType: 'graph-node',
    canonicalRef: 'knowledge:bode-margin',
    label: 'Bode margin',
  });
  const correction = entity({
    id: 'sar:entity:learning-goal:control-correction',
    entityType: 'learning-goal',
    canonicalRef: 'control-correction',
    label: 'Controller correction',
  });
  const simulation = entity({
    id: 'sar:entity:resource-node:simulation:control-correction',
    entityType: 'resource-node',
    canonicalRef: 'simulation:control-correction',
    label: 'Control correction simulation',
  });
  const arena = entity({
    id: 'sar:entity:resource-node:arena:official-evidence',
    entityType: 'resource-node',
    canonicalRef: 'arena:official-evidence',
    label: 'Arena official evidence',
  });
  const marginEvent = event({
    id: 'sar:event:graph-node:bode-margin',
    title: 'Bode margin informs correction',
    metadata: {
      citationTargetId: 'citation-target:bode-margin',
      retrievalChunkId: 'retrieval-chunk:bode-margin',
    },
  });
  const correctionEvent = event({
    id: 'sar:event:simulation-summary:control-correction',
    eventType: 'simulation-summary',
    title: 'Controller correction validated in simulation and Arena',
    sourceRef: {
      id: 'simulation:control-correction',
      owner: 'simulation-runtime',
      authorityLevel: 'teacher-approved',
      freshness: 'test',
    },
    metadata: {
      resourceNodeId: 'simulation:control-correction',
      planningUnitId: 'planning-unit:control-correction',
    },
  });
  return projection({
    events: [marginEvent, correctionEvent],
    entities: [bodeMargin, correction, simulation, arena],
    relations: [
      relation({ eventId: marginEvent.id, entityId: bodeMargin.id, role: 'about' }),
      relation({ eventId: marginEvent.id, entityId: correction.id, role: 'supports' }),
      relation({ eventId: correctionEvent.id, entityId: correction.id, role: 'about' }),
      relation({ eventId: correctionEvent.id, entityId: simulation.id, role: 'evidence-for' }),
      relation({ eventId: correctionEvent.id, entityId: arena.id, role: 'evidence-for' }),
    ],
    citationTargetRefs: ['citation-target:projection-top'],
    retrievalChunkRefs: ['retrieval-chunk:projection-top'],
  });
};

describe('SAR association expansion provider', () => {
  it('returns direct zero-hop candidates without expansion hops', () => {
    const result = expandSarAssociations({
      id: 'zero-hop',
      useCase: 'source-pack-seeding',
      callerScope: { role: 'student', studentId: 'stu-1', classId: 'class-a' },
      seedRefs: ['sar:entity:graph-node:knowledge:bode-margin'],
      projection: teachingFixture(),
      maxHops: 0,
    });

    expect(result.candidateRefs.entityIds).toEqual(['sar:entity:graph-node:knowledge:bode-margin']);
    expect(result.candidateRefs.eventIds).toEqual(['sar:event:graph-node:bode-margin']);
    expect(result.candidateRefs.citationTargetIds).toEqual(['citation-target:bode-margin']);
    expect(result.candidateRefs.retrievalChunkIds).toEqual(['retrieval-chunk:bode-margin']);
    expect(result.sourcePackSeedRefs).toEqual(expect.arrayContaining([
      'citation-target:bode-margin',
      'retrieval-chunk:bode-margin',
    ]));
    expect(result.trace.expansionHops).toEqual([]);
  });

  it('expands deterministic one-hop and two-hop association paths', () => {
    const oneHop = expandSarAssociations({
      id: 'one-hop',
      useCase: 'diagnostic-trace',
      callerScope: { role: 'teacher', classId: 'class-a' },
      seedRefs: ['sar:entity:graph-node:knowledge:bode-margin'],
      projection: teachingFixture(),
      maxHops: 1,
    });

    expect(oneHop.candidateRefs.entityIds).toEqual([
      'sar:entity:graph-node:knowledge:bode-margin',
      'sar:entity:learning-goal:control-correction',
    ]);
    expect(oneHop.trace.expansionHops).toEqual([expect.objectContaining({
      fromEntityId: 'sar:entity:graph-node:knowledge:bode-margin',
      toEntityId: 'sar:entity:learning-goal:control-correction',
      viaEventId: 'sar:event:graph-node:bode-margin',
    })]);

    const twoHop = expandSarAssociations({
      id: 'two-hop',
      useCase: 'source-pack-seeding',
      callerScope: { role: 'teacher', classId: 'class-a' },
      seedRefs: ['sar:entity:graph-node:knowledge:bode-margin'],
      projection: teachingFixture(),
      maxHops: 2,
    });

    expect(twoHop.candidateRefs.entityIds).toEqual([
      'sar:entity:graph-node:knowledge:bode-margin',
      'sar:entity:learning-goal:control-correction',
      'sar:entity:resource-node:arena:official-evidence',
      'sar:entity:resource-node:simulation:control-correction',
    ]);
    expect(twoHop.candidateRefs.resourceNodeIds).toEqual([
      'arena:official-evidence',
      'simulation:control-correction',
    ]);
    expect(twoHop.candidateRefs.planningUnitIds).toEqual(['planning-unit:control-correction']);
    expect(twoHop.trace.expansionHops).toHaveLength(3);
  });

  it('filters restricted caller scope before exposing candidates', () => {
    const restrictedEvent = event({
      id: 'sar:event:learning-fact-summary:private-student',
      eventType: 'learning-fact-summary',
      privacyScope: 'teacher-scoped',
      metadata: {
        ownerUserId: 'stu-2',
        classId: 'class-a',
        retrievalChunkId: 'retrieval-chunk:private-student',
      },
    });
    const visibleEntity = entity({ id: 'sar:entity:learning-fact:stu-2-private', entityType: 'learning-fact' });
    const result = expandSarAssociations({
      id: 'privacy',
      useCase: 'source-pack-seeding',
      callerScope: { role: 'student', studentId: 'stu-1', classId: 'class-a' },
      seedRefs: ['sar:entity:graph-node:knowledge:bode-margin'],
      projection: projection({
        events: [event({ id: 'sar:event:graph-node:bode-margin' }), restrictedEvent],
        entities: [
          entity({ id: 'sar:entity:graph-node:knowledge:bode-margin' }),
          visibleEntity,
        ],
        relations: [
          relation({ eventId: 'sar:event:graph-node:bode-margin', entityId: 'sar:entity:graph-node:knowledge:bode-margin' }),
          relation({ eventId: restrictedEvent.id, entityId: 'sar:entity:graph-node:knowledge:bode-margin' }),
          relation({ eventId: restrictedEvent.id, entityId: visibleEntity.id }),
        ],
      }),
      maxHops: 1,
    });

    expect(result.candidateRefs.eventIds).toEqual(['sar:event:graph-node:bode-margin']);
    expect(result.candidateRefs.entityIds).toEqual(['sar:entity:graph-node:knowledge:bode-margin']);
    expect(result.candidateRefs.retrievalChunkIds).toEqual([]);
    expect(result.trace.rejectedRefs).toContainEqual({
      ref: 'sar:event:learning-fact-summary:private-student',
      reason: 'teacher-scope-required',
    });
  });

  it('applies teacher class scope from learner source refs before exposing evidence refs', () => {
    const restrictedEvent = event({
      id: 'sar:event:corpus-chunk-summary:private-source-ref',
      eventType: 'corpus-chunk-summary',
      privacyScope: 'teacher-scoped',
      sourceRef: {
        id: 'chunk:private-source-ref',
        owner: 'learning-evidence',
        authorityLevel: 'platform-verified',
        freshness: 'test',
        ownerUserId: 'stu-2',
        classId: 'class-b',
      } as SarRetrievalEvent['sourceRef'] & { ownerUserId: string; classId: string },
      metadata: { retrievalChunkId: 'retrieval-chunk:private-source-ref' },
    });
    const result = expandSarAssociations({
      id: 'source-ref-scope',
      useCase: 'source-pack-seeding',
      callerScope: { role: 'teacher' },
      seedRefs: ['sar:entity:graph-node:knowledge:bode-margin'],
      projection: projection({
        events: [restrictedEvent],
        entities: [entity({ id: 'sar:entity:graph-node:knowledge:bode-margin' })],
        relations: [
          relation({ eventId: restrictedEvent.id, entityId: 'sar:entity:graph-node:knowledge:bode-margin' }),
        ],
      }),
      maxHops: 0,
    });

    expect(result.candidateRefs.eventIds).toEqual([]);
    expect(result.candidateRefs.retrievalChunkIds).toEqual([]);
    expect(result.sourcePackSeedRefs).not.toContain('retrieval-chunk:private-source-ref');
    expect(result.trace.rejectedRefs).toContainEqual({
      ref: restrictedEvent.id,
      reason: 'class-scope-required',
    });
  });

  it('does not expose top-level Source Pack refs when a projection contains filtered events', () => {
    const restrictedEvent = event({
      id: 'sar:event:learning-fact-summary:private-source',
      eventType: 'learning-fact-summary',
      privacyScope: 'teacher-scoped',
      metadata: { retrievalChunkId: 'retrieval-chunk:private-source' },
    });
    const result = expandSarAssociations({
      id: 'mixed-projection',
      useCase: 'source-pack-seeding',
      callerScope: { role: 'student', studentId: 'stu-1', classId: 'class-a' },
      seedRefs: ['sar:entity:graph-node:knowledge:bode-margin'],
      projection: projection({
        events: [event({ id: 'sar:event:graph-node:bode-margin' }), restrictedEvent],
        entities: [entity({ id: 'sar:entity:graph-node:knowledge:bode-margin' })],
        relations: [
          relation({ eventId: 'sar:event:graph-node:bode-margin', entityId: 'sar:entity:graph-node:knowledge:bode-margin' }),
          relation({ eventId: restrictedEvent.id, entityId: 'sar:entity:graph-node:knowledge:bode-margin' }),
        ],
        citationTargetRefs: ['citation-target:projection-private'],
        retrievalChunkRefs: ['retrieval-chunk:projection-private'],
      }),
      maxHops: 1,
    });

    expect(result.candidateRefs.citationTargetIds).toEqual([]);
    expect(result.candidateRefs.retrievalChunkIds).toEqual([]);
    expect(result.sourcePackSeedRefs).not.toContain('citation-target:projection-private');
    expect(result.sourcePackSeedRefs).not.toContain('retrieval-chunk:projection-private');
  });

  it('rejects student and class entity seeds outside caller scope', () => {
    const result = expandSarAssociations({
      id: 'entity-scope',
      useCase: 'diagnostic-trace',
      callerScope: { role: 'student', studentId: 'stu-1', classId: 'class-a' },
      seedRefs: ['sar:entity:student:stu-2', 'sar:entity:class:class-b'],
      projection: projection({
        entities: [
          entity({
            id: 'sar:entity:student:stu-2',
            entityType: 'student',
            canonicalRef: 'stu-2',
            label: 'Student 2',
          }),
          entity({
            id: 'sar:entity:class:class-b',
            entityType: 'class',
            canonicalRef: 'class-b',
            label: 'Class B',
          }),
        ],
      }),
      maxHops: 0,
    });

    expect(result.candidateRefs.entityIds).toEqual([]);
    expect(result.trace.seedEntityIds).toEqual([]);
    expect(result.trace.rejectedRefs).toEqual(expect.arrayContaining([
      { ref: 'sar:entity:student:stu-2', reason: 'student-scope-mismatch' },
      { ref: 'sar:entity:class:class-b', reason: 'class-scope-mismatch' },
    ]));
  });

  it('returns candidate refs without Source Pack ranking or citation hydration payloads', () => {
    const result = expandSarAssociations({
      id: 'candidate-refs',
      useCase: 'source-pack-seeding',
      callerScope: { role: 'teacher', classId: 'class-a' },
      seedRefs: ['sar:entity:graph-node:knowledge:bode-margin'],
      projection: teachingFixture(),
      maxHops: 2,
    });

    expect(result.candidateRefs.citationTargetIds).toEqual([
      'citation-target:bode-margin',
      'citation-target:projection-top',
    ]);
    expect(result.candidateRefs.retrievalChunkIds).toEqual([
      'retrieval-chunk:bode-margin',
      'retrieval-chunk:projection-top',
    ]);
    expect(result.sourcePackSeedRefs).toEqual(expect.arrayContaining([
      'citation-target:bode-margin',
      'citation-target:projection-top',
      'retrieval-chunk:bode-margin',
      'retrieval-chunk:projection-top',
      'sar:event:simulation-summary:control-correction',
    ]));
    expect(JSON.stringify(result)).not.toMatch(/CitationChip|citationAddress|verifiedCitation/);
    expect(result.limitations).toEqual(expect.arrayContaining([
      'source-pack-ranking-required',
      'citation-hydration-required',
    ]));
  });

  it('rejects unresolved seeds and low-confidence relations', () => {
    const weakEvent = event({
      id: 'sar:event:graph-node:weak-correction',
      title: 'Weak correction association',
    });
    const correction = entity({
      id: 'sar:entity:learning-goal:weak-correction',
      entityType: 'learning-goal',
      canonicalRef: 'weak-correction',
      label: 'Weak correction',
    });
    const result = expandSarAssociations({
      id: 'rejections',
      useCase: 'diagnostic-trace',
      callerScope: { role: 'teacher', classId: 'class-a' },
      seedRefs: ['sar:entity:graph-node:knowledge:bode-margin', 'sar:entity:missing'],
      projection: projection({
        events: [weakEvent],
        entities: [
          entity({ id: 'sar:entity:graph-node:knowledge:bode-margin' }),
          correction,
        ],
        relations: [
          relation({ eventId: weakEvent.id, entityId: 'sar:entity:graph-node:knowledge:bode-margin', confidence: 0.2 }),
          relation({ eventId: weakEvent.id, entityId: correction.id, confidence: 0.2 }),
        ],
      }),
      maxHops: 1,
      minConfidence: 0.5,
    });

    expect(result.candidateRefs.entityIds).toEqual(['sar:entity:graph-node:knowledge:bode-margin']);
    expect(result.candidateRefs.eventIds).toEqual([]);
    expect(result.trace.rejectedRefs).toEqual(expect.arrayContaining([
      { ref: 'sar:entity:missing', reason: 'seed-ref-not-found' },
      { ref: weakEvent.id, reason: 'low-confidence-relation' },
    ]));
  });

  it('fails closed for missing class scope before returning class-scoped candidates', () => {
    const classEvent = event({
      id: 'sar:event:diagnosis-summary:class-b',
      eventType: 'diagnosis-summary',
      metadata: { classId: 'class-b' },
    });
    const result = expandSarAssociations({
      id: 'class-scope',
      useCase: 'diagnostic-trace',
      callerScope: { role: 'teacher' },
      seedRefs: ['sar:entity:graph-node:knowledge:bode-margin'],
      projection: projection({
        events: [classEvent],
        entities: [
          entity({ id: 'sar:entity:graph-node:knowledge:bode-margin' }),
          entity({
            id: 'sar:entity:learning-goal:class-b',
            entityType: 'learning-goal',
            canonicalRef: 'class-b',
            label: 'Class B goal',
          }),
        ],
        relations: [
          relation({ eventId: classEvent.id, entityId: 'sar:entity:graph-node:knowledge:bode-margin' }),
          relation({ eventId: classEvent.id, entityId: 'sar:entity:learning-goal:class-b' }),
        ],
      }),
      maxHops: 1,
    });

    expect(result.candidateRefs.eventIds).toEqual([]);
    expect(result.trace.rejectedRefs).toContainEqual({
      ref: classEvent.id,
      reason: 'class-scope-required',
    });
  });

  it('rejects events that only become visible through out-of-scope class entities', () => {
    const classEvent = event({
      id: 'sar:event:diagnosis-summary:class-b-link',
      eventType: 'diagnosis-summary',
    });
    const result = expandSarAssociations({
      id: 'class-linked-event',
      useCase: 'diagnostic-trace',
      callerScope: { role: 'teacher', classId: 'class-a' },
      seedRefs: ['sar:entity:graph-node:knowledge:bode-margin'],
      projection: projection({
        events: [classEvent],
        entities: [
          entity({ id: 'sar:entity:graph-node:knowledge:bode-margin' }),
          entity({
            id: 'sar:entity:class:class-b',
            entityType: 'class',
            canonicalRef: 'class-b',
            label: 'Class B',
          }),
        ],
        relations: [
          relation({ eventId: classEvent.id, entityId: 'sar:entity:graph-node:knowledge:bode-margin' }),
          relation({ eventId: classEvent.id, entityId: 'sar:entity:class:class-b' }),
        ],
      }),
      maxHops: 1,
    });

    expect(result.candidateRefs.eventIds).toEqual([]);
    expect(result.trace.rejectedRefs).toEqual(expect.arrayContaining([
      { ref: 'sar:entity:class:class-b', reason: 'class-scope-mismatch' },
      { ref: classEvent.id, reason: 'event-linked-class-scope-mismatch' },
    ]));
  });

  it('rejects event seeds that link to out-of-scope class entities', () => {
    const classEvent = event({
      id: 'sar:event:diagnosis-summary:seed-class-b-link',
      eventType: 'diagnosis-summary',
    });
    const result = expandSarAssociations({
      id: 'class-linked-event-seed',
      useCase: 'diagnostic-trace',
      callerScope: { role: 'teacher', classId: 'class-a' },
      seedRefs: [classEvent.id],
      projection: projection({
        events: [classEvent],
        entities: [
          entity({
            id: 'sar:entity:class:class-b',
            entityType: 'class',
            canonicalRef: 'class-b',
            label: 'Class B',
          }),
        ],
        relations: [
          relation({ eventId: classEvent.id, entityId: 'sar:entity:class:class-b' }),
        ],
      }),
      maxHops: 0,
    });

    expect(result.candidateRefs.eventIds).toEqual([]);
    expect(result.trace.selectedRefs).not.toContain(classEvent.id);
    expect(result.sourcePackSeedRefs).not.toContain(classEvent.id);
    expect(result.trace.rejectedRefs).toEqual(expect.arrayContaining([
      { ref: 'sar:entity:class:class-b', reason: 'class-scope-mismatch' },
      { ref: classEvent.id, reason: 'event-linked-class-scope-mismatch' },
    ]));
  });

  it('honors admin and audit privacy scopes', () => {
    const adminEvent = event({
      id: 'sar:event:diagnosis-summary:admin',
      eventType: 'diagnosis-summary',
      privacyScope: 'admin-scoped',
    });
    const auditEvent = event({
      id: 'sar:event:teacher-report:audit',
      eventType: 'teacher-report',
      privacyScope: 'audit-only',
    });
    const adminEntity = entity({
      id: 'sar:entity:learning-fact:admin',
      entityType: 'learning-fact',
      privacyScope: 'admin-scoped',
    });
    const auditEntity = entity({
      id: 'sar:entity:learning-fact:audit',
      entityType: 'learning-fact',
      privacyScope: 'audit-only',
    });
    const privateProjection = projection({
      events: [adminEvent, auditEvent],
      entities: [adminEntity, auditEntity],
      relations: [
        relation({ eventId: adminEvent.id, entityId: adminEntity.id }),
        relation({ eventId: auditEvent.id, entityId: auditEntity.id }),
      ],
    });

    const adminResult = expandSarAssociations({
      id: 'admin',
      useCase: 'diagnostic-trace',
      callerScope: { role: 'admin' },
      seedRefs: [adminEvent.id, auditEvent.id],
      projection: privateProjection,
      maxHops: 0,
    });
    expect(adminResult.candidateRefs.eventIds).toEqual([adminEvent.id]);
    expect(adminResult.trace.rejectedRefs).toContainEqual({
      ref: auditEvent.id,
      reason: 'audit-scope-required',
    });

    const auditResult = expandSarAssociations({
      id: 'audit',
      useCase: 'diagnostic-trace',
      callerScope: { role: 'auditor' },
      seedRefs: [adminEvent.id, auditEvent.id],
      projection: privateProjection,
      maxHops: 0,
    });
    expect(auditResult.candidateRefs.eventIds).toEqual([adminEvent.id, auditEvent.id]);
  });

  it('filters authority and declared use-case before expansion', () => {
    const llmEvent = event({
      id: 'sar:event:prep-pack-item:llm',
      eventType: 'prep-pack-item',
      sourceRef: {
        id: 'llm-candidate',
        owner: 'prep-pack',
        authorityLevel: 'llm-extracted',
        freshness: 'test',
      },
    });
    const wrongUseCaseEvent = event({
      id: 'sar:event:graph-node:path-only',
      metadata: { useCases: ['path-planning'] },
    });
    const sourcePackResult = expandSarAssociations({
      id: 'authority',
      useCase: 'source-pack-seeding',
      callerScope: { role: 'teacher', classId: 'class-a' },
      seedRefs: ['sar:entity:graph-node:knowledge:bode-margin'],
      projection: projection({
        events: [llmEvent, wrongUseCaseEvent],
        entities: [
          entity({ id: 'sar:entity:graph-node:knowledge:bode-margin' }),
          entity({
            id: 'sar:entity:learning-goal:llm',
            entityType: 'learning-goal',
            canonicalRef: 'llm',
            label: 'LLM candidate',
          }),
        ],
        relations: [
          relation({ eventId: llmEvent.id, entityId: 'sar:entity:graph-node:knowledge:bode-margin' }),
          relation({ eventId: llmEvent.id, entityId: 'sar:entity:learning-goal:llm' }),
          relation({ eventId: wrongUseCaseEvent.id, entityId: 'sar:entity:graph-node:knowledge:bode-margin' }),
        ],
      }),
      maxHops: 1,
    });

    expect(sourcePackResult.candidateRefs.eventIds).toEqual([]);
    expect(sourcePackResult.trace.rejectedRefs).toEqual(expect.arrayContaining([
      { ref: llmEvent.id, reason: 'authority-not-allowed:llm-extracted' },
      { ref: wrongUseCaseEvent.id, reason: 'use-case-mismatch' },
    ]));

    const diagnosticResult = expandSarAssociations({
      id: 'authority-diagnostic',
      useCase: 'diagnostic-trace',
      callerScope: { role: 'teacher', classId: 'class-a' },
      seedRefs: ['sar:entity:graph-node:knowledge:bode-margin'],
      projection: projection({
        events: [llmEvent],
        entities: [
          entity({ id: 'sar:entity:graph-node:knowledge:bode-margin' }),
          entity({
            id: 'sar:entity:learning-goal:llm',
            entityType: 'learning-goal',
            canonicalRef: 'llm',
            label: 'LLM candidate',
          }),
        ],
        relations: [
          relation({ eventId: llmEvent.id, entityId: 'sar:entity:graph-node:knowledge:bode-margin' }),
          relation({ eventId: llmEvent.id, entityId: 'sar:entity:learning-goal:llm' }),
        ],
      }),
      maxHops: 1,
    });

    expect(diagnosticResult.candidateRefs.eventIds).toEqual([llmEvent.id]);
  });

  it('applies output budgets to candidate refs and trace hops', () => {
    const result = expandSarAssociations({
      id: 'budgets',
      useCase: 'source-pack-seeding',
      callerScope: { role: 'teacher', classId: 'class-a' },
      seedRefs: ['sar:entity:graph-node:knowledge:bode-margin'],
      projection: teachingFixture(),
      maxHops: 2,
      maxEvents: 1,
      maxEntities: 2,
    });

    expect(result.candidateRefs.eventIds).toHaveLength(1);
    expect(result.candidateRefs.entityIds).toHaveLength(2);
    expect(result.candidateRefs.resourceNodeIds).toEqual([]);
    expect(result.candidateRefs.planningUnitIds).toEqual([]);
    expect(result.trace.expansionHops).toEqual([expect.objectContaining({
      fromEntityId: 'sar:entity:graph-node:knowledge:bode-margin',
      toEntityId: 'sar:entity:learning-goal:control-correction',
      viaEventId: 'sar:event:graph-node:bode-margin',
    })]);
    expect(result.limitations).toEqual(expect.arrayContaining([
      'event-budget:1',
      'entity-budget:2',
    ]));
  });

  it('removes budget-disconnected events and their source-pack refs', () => {
    const result = expandSarAssociations({
      id: 'budget-disconnected',
      useCase: 'source-pack-seeding',
      callerScope: { role: 'teacher', classId: 'class-a' },
      seedRefs: ['sar:entity:graph-node:knowledge:bode-margin'],
      projection: teachingFixture(),
      maxHops: 2,
      maxEvents: 2,
      maxEntities: 1,
    });

    expect(result.candidateRefs.entityIds).toEqual(['sar:entity:graph-node:knowledge:bode-margin']);
    expect(result.trace.expansionHops).toEqual([]);
    expect(result.candidateRefs.resourceNodeIds).toEqual([]);
    expect(result.candidateRefs.planningUnitIds).toEqual([]);
    expect(result.candidateRefs.citationTargetIds).toEqual([]);
    expect(result.candidateRefs.retrievalChunkIds).toEqual([]);
    expect(result.trace.selectedRefs).not.toContain('citation-target:projection-top');
    expect(result.trace.selectedRefs).not.toContain('retrieval-chunk:projection-top');
    expect(result.sourcePackSeedRefs).not.toContain('retrieval-chunk:projection-top');
  });

  it('keeps rejected events out of candidate and source-pack refs', () => {
    const duplicateEvent = event({
      id: 'sar:event:graph-node:duplicate-confidence',
      title: 'Duplicate confidence relation',
    });
    const result = expandSarAssociations({
      id: 'reject-select-mutual-exclusion',
      useCase: 'diagnostic-trace',
      callerScope: { role: 'teacher', classId: 'class-a' },
      seedRefs: ['sar:entity:graph-node:knowledge:bode-margin'],
      projection: projection({
        events: [duplicateEvent],
        entities: [
          entity({ id: 'sar:entity:graph-node:knowledge:bode-margin' }),
          entity({
            id: 'sar:entity:learning-goal:duplicate-confidence',
            entityType: 'learning-goal',
            canonicalRef: 'duplicate-confidence',
            label: 'Duplicate confidence',
          }),
        ],
        relations: [
          relation({
            eventId: duplicateEvent.id,
            entityId: 'sar:entity:graph-node:knowledge:bode-margin',
            confidence: 0.2,
          }),
          relation({
            eventId: duplicateEvent.id,
            entityId: 'sar:entity:graph-node:knowledge:bode-margin',
            confidence: 1,
          }),
          relation({
            eventId: duplicateEvent.id,
            entityId: 'sar:entity:learning-goal:duplicate-confidence',
            confidence: 1,
          }),
        ],
      }),
      maxHops: 1,
      minConfidence: 0.5,
    });

    expect(result.trace.rejectedRefs).toContainEqual({
      ref: duplicateEvent.id,
      reason: 'low-confidence-relation',
    });
    expect(result.candidateRefs.eventIds).not.toContain(duplicateEvent.id);
    expect(result.trace.selectedRefs).not.toContain(duplicateEvent.id);
    expect(result.sourcePackSeedRefs).not.toContain(duplicateEvent.id);
  });

  it('does not leak seed ids through trace when entity budget excludes them', () => {
    const result = expandSarAssociations({
      id: 'zero-entity-budget',
      useCase: 'source-pack-seeding',
      callerScope: { role: 'teacher', classId: 'class-a' },
      seedRefs: ['sar:entity:graph-node:knowledge:bode-margin'],
      projection: teachingFixture(),
      maxHops: 1,
      maxEntities: 0,
    });

    expect(result.candidateRefs.entityIds).toEqual([]);
    expect(result.candidateRefs.eventIds).toEqual([]);
    expect(result.candidateRefs.citationTargetIds).toEqual([]);
    expect(result.candidateRefs.retrievalChunkIds).toEqual([]);
    expect(result.candidateRefs.resourceNodeIds).toEqual([]);
    expect(result.candidateRefs.planningUnitIds).toEqual([]);
    expect(result.trace.seedEntityIds).toEqual([]);
    expect(result.trace.expansionHops).toEqual([]);
    expect(result.trace.selectedRefs).toEqual([]);
    expect(result.sourcePackSeedRefs).toEqual([]);
  });

  it('normalizes invalid numeric limits instead of using JavaScript slice edge cases', () => {
    const result = expandSarAssociations({
      id: 'invalid-limits',
      useCase: 'source-pack-seeding',
      callerScope: { role: 'teacher', classId: 'class-a' },
      seedRefs: ['sar:entity:graph-node:knowledge:bode-margin'],
      projection: teachingFixture(),
      maxHops: 2,
      maxEvents: Number.NaN,
      maxEntities: -1,
      minConfidence: Number.NaN,
    });

    expect(result.candidateRefs.eventIds.length).toBeGreaterThan(0);
    expect(result.candidateRefs.entityIds.length).toBeGreaterThan(0);
    expect(result.limitations).toEqual(expect.arrayContaining([
      'invalid-maxEvents:NaN',
      'invalid-maxEntities:-1',
      'invalid-minConfidence:NaN',
    ]));
  });
});
