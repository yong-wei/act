import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { describe, expect, it } from 'vitest';

import {
  createSarPersistenceRepository,
  hashSarQueryIdentity,
} from '../sar-persistence';
import type {
  SarRetrievalEntity,
  SarRetrievalEvent,
  SarRetrievalEventEntity,
  SarRetrievalResult,
  SarRetrievalTrace,
} from '../structured-associative-retrieval';

const fixedNow = '2026-07-01T00:00:00.000Z';
const studentHash = `sar:student:sha256:${'a'.repeat(64)}`;
const mutatedStudentHash = `sar:student:sha256:${'b'.repeat(64)}`;
const classHash = `sar:class:sha256:${'c'.repeat(64)}`;

const event = (overrides: Partial<SarRetrievalEvent> = {}): SarRetrievalEvent => ({
  id: 'sar:event:kaq:root-locus',
  eventType: 'graph-node',
  title: 'Root locus learning objective',
  safeSummary: 'Safe governed summary of the KAQ graph node.',
  sourceRef: {
    id: 'kaq:unit-3:root-locus',
    owner: 'kaq-graph',
    authorityLevel: 'platform-verified',
    freshness: 'kaq-graph.v1',
    contentHash: 'sha256:event-v1',
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

const traceInput = (result = sarResult()) => ({
  result,
  queryRole: 'teacher-diagnostics',
  useCase: 'sar-retrieval-index',
  queryIdentity: {
    prompt: 'Which root locus objective should support this learner?',
    filters: ['unit-3'],
  },
  scope: {
    scope: 'student' as const,
    studentIdHash: studentHash,
    classIdHash: classHash,
  },
  retention: {
    storedAt: fixedNow,
    retainUntil: '2026-07-08T00:00:00.000Z',
    minimizeAfter: '2026-07-03T00:00:00.000Z',
    minimizationPolicy: 'aggregate-after-retention' as const,
  },
  exportEligibility: 'teacher-export' as const,
  handoffStatus: 'source-pack-pending' as const,
  now: fixedNow,
});

describe('SAR persistence', () => {
  it('persists projection records idempotently without duplicate relations', () => {
    const repository = createSarPersistenceRepository({ now: () => fixedNow });

    expect(repository.upsertResult(sarResult()).persisted).toBe(true);
    expect(repository.upsertResult(sarResult()).persisted).toBe(true);

    const snapshot = repository.getSnapshot();
    expect(Object.keys(snapshot.events)).toHaveLength(1);
    expect(Object.keys(snapshot.entities)).toHaveLength(1);
    expect(Object.keys(snapshot.relations)).toHaveLength(1);
    expect(snapshot.events['sar:event:kaq:root-locus']).toMatchObject({
      stableId: 'sar:event:kaq:root-locus',
      eventType: 'graph-node',
      safeSummary: 'Safe governed summary of the KAQ graph node.',
      authorityLevel: 'platform-verified',
      privacyScope: 'teacher-scoped',
      freshness: 'kaq-graph.v1',
      contentHash: 'sha256:event-v1',
    });
  });

  it('hashes direct source student and class identifiers before persistence or export', () => {
    const repository = createSarPersistenceRepository({ now: () => fixedNow });
    repository.upsertResult(sarResult({
      events: [event({
        sourceRef: {
          ...event().sourceRef,
          ownerUserId: 'learner-1',
          classId: 'class-1',
        },
      })],
    }));

    const snapshotSourceRef = repository.getSnapshot().events['sar:event:kaq:root-locus'].sourceRef;
    expect(snapshotSourceRef.ownerUserIdHash).toMatch(/^sar:owner-user:sha256:/);
    expect(snapshotSourceRef.classIdHash).toMatch(/^sar:class:sha256:/);
    expect(JSON.stringify(repository.getSnapshot())).not.toContain('learner-1');
    expect(JSON.stringify(repository.exportSafeSnapshot())).not.toContain('class-1');
  });

  it('updates stable projection records when safe summaries or labels change', () => {
    const repository = createSarPersistenceRepository({ now: () => fixedNow });
    repository.upsertResult(sarResult());
    repository.upsertResult(sarResult({
      events: [event({ safeSummary: 'Updated governed summary.' })],
      entities: [entity({ label: 'Root locus updated' })],
    }), { now: '2026-07-01T01:00:00.000Z' });

    const snapshot = repository.getSnapshot();
    expect(snapshot.events['sar:event:kaq:root-locus'].safeSummary).toBe('Updated governed summary.');
    expect(snapshot.entities['sar:entity:kaq:root-locus'].label).toBe('Root locus updated');
    expect(snapshot.events['sar:event:kaq:root-locus'].writtenAt).toBe(fixedNow);
    expect(snapshot.events['sar:event:kaq:root-locus'].updatedAt).toBe('2026-07-01T01:00:00.000Z');
  });

  it('rejects restricted raw learner, hidden Arena, private Konling, and raw audit content', () => {
    const repository = createSarPersistenceRepository({ now: () => fixedNow });
    const result = sarResult({
      events: [event({ metadata: { rawLearnerSubmission: 'student answer body' } })],
    });

    const write = repository.upsertResult(result);
    expect(write.persisted).toBe(false);
    expect(write.issues.map((issue) => issue.code)).toContain('restricted-raw-content');

    const serialized = JSON.stringify(repository.getSnapshot());
    expect(serialized).not.toContain('student answer body');

    for (const forbiddenText of [
      'hidden arena evaluation internals',
      'private konling memory',
      'raw audit trace',
    ]) {
      const blocked = repository.upsertResult(sarResult({
        trace: trace({ limitations: [forbiddenText] }),
      }));
      expect(blocked.persisted).toBe(false);
      expect(blocked.issues.map((issue) => issue.code)).toContain('restricted-raw-content');
    }
  });

  it('rejects restricted text in rejected trace refs', () => {
    const repository = createSarPersistenceRepository({ now: () => fixedNow });
    const write = repository.upsertQueryTrace(traceInput(sarResult({
      trace: trace({
        rejectedRefs: [{ ref: 'raw answer body', reason: 'scope unavailable' }],
      }),
    })));

    expect(write.persisted).toBe(false);
    expect(write.issues.map((issue) => issue.path)).toContain('rejectedRefs.0.ref');
    expect(JSON.stringify(repository.getSnapshot())).not.toContain('raw answer body');
  });

  it('rejects restricted query role and use case text before persistence', () => {
    const repository = createSarPersistenceRepository({ now: () => fixedNow });
    const write = repository.upsertQueryTrace({
      ...traceInput(),
      queryRole: 'raw answer body',
      useCase: 'hidden arena evaluation internals',
    });

    expect(write.persisted).toBe(false);
    expect(write.issues.map((issue) => issue.path)).toEqual(expect.arrayContaining([
      'queryTrace.queryRole',
      'queryTrace.useCase',
    ]));
    expect(repository.getSnapshot().queryTraces).toEqual({});
  });

  it('rejects restricted source refs before projection persistence', () => {
    const repository = createSarPersistenceRepository({ now: () => fixedNow });
    const result = sarResult({
      events: [event({
        title: 'Learner learner-raw-x mastery',
        safeSummary: 'Class class:raw-section summary',
        sourceRef: {
          ...event().sourceRef,
          id: 'learner-raw-x',
          owner: 'class:raw-section',
        },
      })],
      relations: [relation({ source: 'matched learner-raw-x' })],
    });

    const write = repository.upsertResult(result);
    expect(write.persisted).toBe(false);
    expect(write.issues.map((issue) => issue.path)).toEqual(expect.arrayContaining([
      'events.0.title',
      'events.0.safeSummary',
      'events.0.sourceRef.id',
      'events.0.sourceRef.owner',
      'relations.0.source',
    ]));
    expect(repository.getSnapshot().events).toEqual({});

    const queryWrite = repository.upsertQueryTrace(traceInput(result));
    expect(queryWrite.persisted).toBe(false);
    expect(queryWrite.issues.map((issue) => issue.path)).toEqual(expect.arrayContaining([
      'events.0.title',
      'events.0.safeSummary',
      'events.0.sourceRef.id',
      'events.0.sourceRef.owner',
      'relations.0.source',
    ]));
    expect(repository.getSnapshot().queryTraces).toEqual({});

    const rebuild = repository.rebuild([result]);
    expect(rebuild.persisted).toBe(false);
    expect(rebuild.issues.map((issue) => issue.path)).toEqual(expect.arrayContaining([
      'events.0.title',
      'events.0.safeSummary',
      'events.0.sourceRef.id',
      'events.0.sourceRef.owner',
      'relations.0.source',
    ]));
    expect(repository.getSnapshot().events).toEqual({});
  });

  it('rejects raw structured scoped refs in free-text fields', () => {
    const repository = createSarPersistenceRepository({ now: () => fixedNow });
    const result = sarResult({
      events: [event({
        title: 'sar:entity:student:student:learner-1',
        safeSummary: 'sar:entity:class:class:raw-section',
        sourceRef: {
          ...event().sourceRef,
          id: 'sar:entity:student:student:learner-1',
          owner: 'sar:entity:class:class:raw-section',
        },
      })],
      relations: [relation({ source: 'sar:entity:class:class:raw-section' })],
    });

    const write = repository.upsertResult(result);
    expect(write.persisted).toBe(false);
    expect(write.issues.map((issue) => issue.path)).toEqual(expect.arrayContaining([
      'events.0.title',
      'events.0.safeSummary',
      'events.0.sourceRef.id',
      'events.0.sourceRef.owner',
      'relations.0.source',
    ]));
    expect(JSON.stringify(repository.getSnapshot())).not.toContain('learner-1');
  });

  it('rejects raw identity labels before projection persistence', () => {
    const repository = createSarPersistenceRepository({ now: () => fixedNow });
    const result = sarResult({
      events: [event({
        id: 'student-id:abc',
        title: 'student id abc123 mastery trace',
        safeSummary: '班级 ID: A01 的聚合说明',
        sourceRef: {
          ...event().sourceRef,
          id: 'learner-id:demo',
          owner: 'user-id:abc',
        },
      })],
      relations: [relation({
        eventId: 'student-id:abc',
        source: 'matched class-id:demo',
      })],
      trace: trace({
        selectedRefs: ['student-id:abc'],
        expansionHops: [{
          fromEntityId: 'sar:entity:kaq:root-locus',
          toEntityId: 'sar:entity:kaq:root-locus',
          viaEventId: 'student-id:abc',
          relationRole: 'supports',
          confidence: 0.72,
        }],
      }),
    });

    const write = repository.upsertResult(result);
    expect(write.persisted).toBe(false);
    expect(write.issues.map((issue) => issue.path)).toEqual(expect.arrayContaining([
      'events.0.id',
      'events.0.title',
      'events.0.safeSummary',
      'events.0.sourceRef.id',
      'events.0.sourceRef.owner',
      'relations.0.eventId',
      'relations.0.source',
    ]));
    expect(JSON.stringify(repository.getSnapshot())).not.toContain('abc');
    expect(JSON.stringify(repository.getSnapshot())).not.toContain('A01');
  });

  it('rejects raw learner and class refs in non-scoped entities before persistence', () => {
    const repository = createSarPersistenceRepository({ now: () => fixedNow });
    const result = sarResult({
      entities: [entity({
        id: 'sar:entity:learning-fact:student:learner-1',
        entityType: 'learning-fact',
        canonicalRef: 'class:raw-section',
        label: 'Root locus safe label',
        aliases: ['root locus safe alias'],
      })],
      relations: [relation({
        entityId: 'sar:entity:learning-fact:student:learner-1',
      })],
      trace: trace({
        seedEntityIds: ['sar:entity:learning-fact:student:learner-1'],
        expansionHops: [],
      }),
    });

    const write = repository.upsertResult(result);
    expect(write.persisted).toBe(false);
    expect(write.issues.map((issue) => issue.path)).toEqual(expect.arrayContaining([
      'entities.0.id',
      'entities.0.canonicalRef',
    ]));

    const queryWrite = repository.upsertQueryTrace(traceInput(result));
    expect(queryWrite.persisted).toBe(false);
    expect(queryWrite.issues.map((issue) => issue.path)).toEqual(expect.arrayContaining([
      'entities.0.id',
      'entities.0.canonicalRef',
    ]));
    expect(JSON.stringify(repository.getSnapshot())).not.toContain('learner-1');
    expect(JSON.stringify(repository.exportSafeSnapshot())).not.toContain('raw-section');
  });

  it('rejects raw identity labels in query trace metadata before persistence', () => {
    const repository = createSarPersistenceRepository({ now: () => fixedNow });
    const result = sarResult({
      trace: trace({
        versionRefs: ['user-id:abc'],
      }),
    });

    const write = repository.upsertQueryTrace({
      ...traceInput(result),
      queryRole: 'learner-id:demo diagnostics',
      useCase: '学生 ID: abc retrieval',
    });

    expect(write.persisted).toBe(false);
    expect(write.issues.map((issue) => issue.path)).toEqual(expect.arrayContaining([
      'queryTrace.queryRole',
      'queryTrace.useCase',
      'versionRefs.0',
    ]));
    expect(repository.getSnapshot().queryTraces).toEqual({});
  });

  it('rejects scoped entity refs masquerading as event ids', () => {
    const repository = createSarPersistenceRepository({ now: () => fixedNow });
    const rawEventId = 'sar:entity:student:student:learner-1';
    const result = sarResult({
      events: [event({ id: rawEventId })],
      relations: [relation({ eventId: rawEventId })],
      trace: trace({
        selectedRefs: [rawEventId],
        expansionHops: [{
          fromEntityId: 'sar:entity:kaq:root-locus',
          toEntityId: 'sar:entity:kaq:root-locus',
          viaEventId: rawEventId,
          relationRole: 'supports',
          confidence: 0.72,
        }],
      }),
    });

    const write = repository.upsertResult(result);
    expect(write.persisted).toBe(false);
    expect(write.issues.map((issue) => issue.path)).toContain('events.0.id');

    const queryWrite = repository.upsertQueryTrace(traceInput(result));
    expect(queryWrite.persisted).toBe(false);
    expect(queryWrite.issues.map((issue) => issue.path)).toContain('events.0.id');

    const rebuild = repository.rebuild([result]);
    expect(rebuild.persisted).toBe(false);
    expect(rebuild.issues.map((issue) => issue.path)).toContain('events.0.id');
    expect(JSON.stringify(repository.getSnapshot())).not.toContain('learner-1');
  });

  it('allows hyphenated pedagogical descriptions that are not scoped ids', () => {
    const repository = createSarPersistenceRepository({ now: () => fixedNow });
    const result = sarResult({
      events: [event({
        title: 'Student-centered root locus reflection',
        safeSummary: 'Class-based activity summary for learner-centered practice.',
      })],
      relations: [relation({ source: 'matched learner-centered reflection' })],
    });

    expect(repository.upsertResult(result).persisted).toBe(true);
    expect(repository.exportSafeSnapshot().events[0].title).toBe('Student-centered root locus reflection');
  });

  it('rejects restricted trace version refs before persistence', () => {
    const repository = createSarPersistenceRepository({ now: () => fixedNow });
    const write = repository.upsertResult(sarResult({
      trace: trace({ versionRefs: ['raw audit trace'] }),
    }));

    expect(write.persisted).toBe(false);
    expect(write.issues.map((issue) => issue.path)).toContain('versionRefs.0');
    expect(repository.getSnapshot().events).toEqual({});

    const queryWrite = repository.upsertQueryTrace(traceInput(sarResult({
      trace: trace({ versionRefs: ['raw answer body'] }),
    })));
    expect(queryWrite.persisted).toBe(false);
    expect(queryWrite.issues.map((issue) => issue.path)).toContain('versionRefs.0');
    expect(repository.getSnapshot().queryTraces).toEqual({});
  });

  it('stores query traces with hash-only query identity and handoff state', () => {
    const repository = createSarPersistenceRepository({ now: () => fixedNow });
    const input = traceInput();

    expect(repository.upsertQueryTrace(input).persisted).toBe(true);

    const persisted = repository.getSnapshot().queryTraces['sar:trace:root-locus'];
    expect(persisted).toMatchObject({
      stableId: 'sar:trace:root-locus',
      queryRole: 'teacher-diagnostics',
      useCase: 'sar-retrieval-index',
      handoffStatus: 'source-pack-pending',
      exportEligibility: 'teacher-export',
      minimized: false,
    });
    expect(persisted.queryHash).toBe(hashSarQueryIdentity(input.queryIdentity));

    const serialized = JSON.stringify(persisted);
    expect(serialized).not.toContain('Which root locus objective should support this learner?');
    expect(serialized).not.toContain('prompt');

    const exported = repository.exportSafeSnapshot();
    expect(exported.events.map((record) => record.stableId)).toEqual(['sar:event:kaq:root-locus']);
    expect(exported.entities.map((record) => record.stableId)).toEqual(['sar:entity:kaq:root-locus']);
    expect(exported.queryTraces[0].seedEntityIds).toEqual(['sar:entity:kaq:root-locus']);
    expect(exported.queryTraces[0].selectedRefs).toEqual(['sar:event:kaq:root-locus']);
  });

  it('hashes student and class entity references before export', () => {
    const repository = createSarPersistenceRepository({ now: () => fixedNow });
    const rawStudentEntityId = 'sar:entity:student:student:learner-1';
    const rawClassEntityId = 'sar:entity:class:class:control-1';
    const rejectedStudentEntityId = 'sar:entity:student:student:rejected-learner';
    const rejectedClassEntityId = 'sar:entity:class:class:rejected-class';
    const alreadyHashedStudentRef = `sar:entity:student:sha256:${'d'.repeat(64)}`;
    const result = sarResult({
      entities: [
        entity({
          id: rawStudentEntityId,
          entityType: 'student',
          canonicalRef: 'student:learner-1',
          label: 'Learner 1',
          aliases: ['student:learner-1', 'Learner 1'],
          privacyScope: 'teacher-scoped',
        }),
        entity({
          id: rawClassEntityId,
          entityType: 'class',
          canonicalRef: 'class:control-1',
          label: 'Control class',
          aliases: ['class:control-1'],
          privacyScope: 'teacher-scoped',
        }),
      ],
      relations: [
        relation({ entityId: rawStudentEntityId }),
        relation({ entityId: rawClassEntityId, role: 'supports' }),
      ],
      trace: trace({
        seedEntityIds: [rawStudentEntityId, rawClassEntityId],
        expansionHops: [{
          fromEntityId: rawStudentEntityId,
          toEntityId: rawClassEntityId,
          viaEventId: 'sar:event:kaq:root-locus',
          relationRole: 'supports',
          confidence: 0.72,
        }],
        selectedRefs: ['sar:event:kaq:root-locus', rawStudentEntityId, rawClassEntityId],
        rejectedRefs: [
          { ref: rejectedStudentEntityId, reason: 'student-scope-mismatch' },
          { ref: rejectedClassEntityId, reason: 'class-scope-mismatch' },
          { ref: alreadyHashedStudentRef, reason: 'already-hashed' },
        ],
      }),
    });

    expect(repository.upsertQueryTrace(traceInput(result)).persisted).toBe(true);

    const snapshotJson = JSON.stringify(repository.getSnapshot());
    expect(snapshotJson).not.toContain('learner-1');
    expect(snapshotJson).not.toContain('control-1');
    expect(snapshotJson).not.toContain('rejected-learner');
    expect(snapshotJson).not.toContain('rejected-class');

    const exported = repository.exportSafeSnapshot();
    const exportedStudent = exported.entities.find((record) => record.entityType === 'student');
    const exportedClass = exported.entities.find((record) => record.entityType === 'class');
    expect(exportedStudent?.stableId).toMatch(/^sar:entity:student:sha256:[a-f0-9]{64}$/);
    expect(exportedStudent?.canonicalRef).toMatch(/^sar:student:sha256:[a-f0-9]{64}$/);
    expect(exportedStudent?.label).toBe('student entity');
    expect(exportedStudent?.aliases).toEqual([exportedStudent?.canonicalRef]);
    expect(exportedClass?.stableId).toMatch(/^sar:entity:class:sha256:[a-f0-9]{64}$/);
    expect(exportedClass?.canonicalRef).toMatch(/^sar:class:sha256:[a-f0-9]{64}$/);
    expect(exportedClass?.aliases).toEqual([exportedClass?.canonicalRef]);
    expect(exported.relations.map((record) => record.entityId)).toEqual([
      exportedStudent?.stableId,
      exportedClass?.stableId,
    ]);
    expect(exported.queryTraces[0].seedEntityIds).toEqual([
      exportedStudent?.stableId,
      exportedClass?.stableId,
    ]);
    expect(exported.queryTraces[0].expansionHops[0]).toMatchObject({
      fromEntityId: exportedStudent?.stableId,
      toEntityId: exportedClass?.stableId,
    });
    expect(exported.queryTraces[0].selectedRefs).toEqual([
      'sar:event:kaq:root-locus',
      exportedStudent?.stableId,
      exportedClass?.stableId,
    ]);
    expect(exported.queryTraces[0].rejectedRefs).toEqual([
      {
        ref: expect.stringMatching(/^sar:entity:student:sha256:[a-f0-9]{64}$/),
        reason: 'student-scope-mismatch',
      },
      {
        ref: expect.stringMatching(/^sar:entity:class:sha256:[a-f0-9]{64}$/),
        reason: 'class-scope-mismatch',
      },
      {
        ref: alreadyHashedStudentRef,
        reason: 'already-hashed',
      },
    ]);
    expect(JSON.stringify(exported)).not.toContain('learner-1');
    expect(JSON.stringify(exported)).not.toContain('control-1');
    expect(JSON.stringify(exported)).not.toContain('rejected-learner');
    expect(JSON.stringify(exported)).not.toContain('rejected-class');

    const projectionOnlyRepository = createSarPersistenceRepository({ now: () => fixedNow });
    expect(projectionOnlyRepository.upsertResult(result).persisted).toBe(true);
    const projectionOnlySnapshot = projectionOnlyRepository.getSnapshot();
    const projectionOnlyEntityIds = Object.keys(projectionOnlySnapshot.entities);
    expect(projectionOnlyEntityIds).toEqual([
      exportedStudent?.stableId,
      exportedClass?.stableId,
    ]);
    expect(Object.values(projectionOnlySnapshot.relations).map((record) => record.entityId)).toEqual([
      exportedStudent?.stableId,
      exportedClass?.stableId,
    ]);
    expect(JSON.stringify(projectionOnlyRepository.exportSafeSnapshot())).not.toContain('learner-1');
    expect(JSON.stringify(projectionOnlyRepository.exportSafeSnapshot())).not.toContain('control-1');
  });

  it('copies query trace scope and retention before caching records', () => {
    const repository = createSarPersistenceRepository({ now: () => fixedNow });
    const input = traceInput();
    expect(repository.upsertQueryTrace(input).persisted).toBe(true);

    input.scope.studentIdHash = mutatedStudentHash;
    input.retention.retainUntil = '2027-01-01T00:00:00.000Z';

    const persisted = repository.getSnapshot().queryTraces['sar:trace:root-locus'];
    expect(persisted.scope.studentIdHash).toBe(studentHash);
    expect(persisted.retention.retainUntil).toBe('2026-07-08T00:00:00.000Z');
  });

  it('rejects student-scoped traces without hash-only student identity', () => {
    const repository = createSarPersistenceRepository({ now: () => fixedNow });
    const write = repository.upsertQueryTrace({
      ...traceInput(),
      scope: {
        scope: 'student',
        studentIdHash: 'student-control-demo',
        classIdHash: classHash,
      },
    });

    expect(write.persisted).toBe(false);
    expect(write.issues.map((issue) => issue.path)).toContain('scope.studentIdHash');
    expect(repository.getSnapshot().queryTraces).toEqual({});
  });

  it('rejects readable suffixes in scoped hash refs', () => {
    const repository = createSarPersistenceRepository({ now: () => fixedNow });
    const write = repository.upsertQueryTrace({
      ...traceInput(),
      scope: {
        ...traceInput().scope,
        studentIdHash: 'sar:student:sha256:learner-raw-id',
      },
    });

    expect(write.persisted).toBe(false);
    expect(write.issues.map((issue) => issue.path)).toContain('scope.studentIdHash');

    const wrongPrefix = repository.upsertQueryTrace({
      ...traceInput(),
      scope: {
        ...traceInput().scope,
        studentIdHash: classHash,
      },
    });
    expect(wrongPrefix.persisted).toBe(false);
    expect(wrongPrefix.issues.map((issue) => issue.path)).toContain('scope.studentIdHash');
  });

  it('rejects invalid query trace export and retention enum values', () => {
    const repository = createSarPersistenceRepository({ now: () => fixedNow });
    const write = repository.upsertQueryTrace({
      ...traceInput(),
      exportEligibility: 'public-export' as never,
      handoffStatus: 'done' as never,
      retention: {
        ...traceInput().retention,
        minimizationPolicy: 'keep-forever' as never,
      },
    });

    expect(write.persisted).toBe(false);
    expect(write.issues.map((issue) => issue.path)).toEqual(expect.arrayContaining([
      'exportEligibility',
      'handoffStatus',
      'retention.minimizationPolicy',
    ]));
  });

  it('rejects unknown query trace scopes', () => {
    const repository = createSarPersistenceRepository({ now: () => fixedNow });
    const write = repository.upsertQueryTrace({
      ...traceInput(),
      scope: {
        ...traceInput().scope,
        scope: 'public' as never,
      },
    });

    expect(write.persisted).toBe(false);
    expect(write.issues.map((issue) => issue.path)).toContain('scope.scope');
  });

  it('returns validation issues for missing or unserializable query identity', () => {
    const missingRepository = createSarPersistenceRepository({ now: () => fixedNow });
    const missing = missingRepository.upsertQueryTrace({
      ...traceInput(),
      queryIdentity: undefined,
    });

    expect(missing.persisted).toBe(false);
    expect(missing.issues.map((issue) => issue.path)).toEqual(expect.arrayContaining([
      'queryIdentity',
      'queryHash',
    ]));
    expect(missingRepository.getSnapshot().queryTraces).toEqual({});

    const circularIdentity: Record<string, unknown> = { prompt: 'root locus' };
    circularIdentity.self = circularIdentity;
    const circularRepository = createSarPersistenceRepository({ now: () => fixedNow });
    const circular = circularRepository.upsertQueryTrace({
      ...traceInput(),
      queryIdentity: circularIdentity,
    });

    expect(circular.persisted).toBe(false);
    expect(circular.issues.map((issue) => issue.path)).toContain('queryIdentity');
    expect(circularRepository.getSnapshot().queryTraces).toEqual({});
  });

  it('rejects restricted trace ids before query trace persistence', () => {
    const repository = createSarPersistenceRepository({ now: () => fixedNow });
    const rawText = repository.upsertQueryTrace(traceInput(sarResult({
      trace: trace({ id: 'Which root locus objective should support this learner?' }),
    })));
    expect(rawText.persisted).toBe(false);
    expect(rawText.issues.map((issue) => issue.path)).toContain('trace.id');

    const restrictedText = repository.upsertQueryTrace(traceInput(sarResult({
      trace: trace({ id: 'raw answer body for learner-1' }),
    })));
    expect(restrictedText.persisted).toBe(false);
    expect(restrictedText.issues.map((issue) => issue.path)).toContain('trace.id');
    expect(repository.getSnapshot().queryTraces).toEqual({});
    expect(JSON.stringify(repository.exportSafeSnapshot())).not.toContain('learner-1');
  });

  it('minimizes expired traces and excludes them from safe exports', () => {
    const repository = createSarPersistenceRepository({ now: () => fixedNow });
    repository.upsertResult(sarResult());
    repository.upsertQueryTrace(traceInput());

    repository.minimizeExpiredTraces('2026-07-04T00:00:00.000Z');

    const traceRecord = repository.getSnapshot().queryTraces['sar:trace:root-locus'];
    expect(traceRecord.minimized).toBe(true);
    expect(traceRecord.seedEntityIds).toEqual([]);
    expect(traceRecord.selectedRefs).toEqual([]);
    expect(traceRecord.aggregateCounts).toMatchObject({
      seedEntityIds: 1,
      expansionHops: 1,
      selectedRefs: 1,
      rejectedRefs: 1,
    });
    expect(repository.exportSafeSnapshot('2026-07-04T00:00:00.000Z').queryTraces).toEqual([]);
  });

  it('minimizes expired traces while rebuilding the projection index', () => {
    const repository = createSarPersistenceRepository({ now: () => fixedNow });
    expect(repository.upsertQueryTrace(traceInput()).persisted).toBe(true);

    const rebuild = repository.rebuild([sarResult()], { now: '2026-07-04T00:00:00.000Z' });
    expect(rebuild.persisted).toBe(true);

    const traceRecord = repository.getSnapshot().queryTraces['sar:trace:root-locus'];
    expect(traceRecord.minimized).toBe(true);
    expect(traceRecord.seedEntityIds).toEqual([]);
    expect(traceRecord.selectedRefs).toEqual([]);
    expect(traceRecord.rejectedRefs).toEqual([]);
    expect(traceRecord.aggregateCounts).toMatchObject({
      seedEntityIds: 1,
      expansionHops: 1,
      selectedRefs: 1,
      rejectedRefs: 1,
    });
    expect(repository.exportSafeSnapshot('2026-07-04T00:00:00.000Z').queryTraces).toEqual([]);
  });

  it('minimizes expired traces while refreshing projection records', () => {
    const repository = createSarPersistenceRepository({ now: () => fixedNow });
    expect(repository.upsertQueryTrace(traceInput()).persisted).toBe(true);

    const update = repository.upsertResult(sarResult({
      events: [event({ safeSummary: 'Updated governed summary.' })],
    }), { now: '2026-07-04T00:00:00.000Z' });
    expect(update.persisted).toBe(true);

    const traceRecord = repository.getSnapshot().queryTraces['sar:trace:root-locus'];
    expect(traceRecord.minimized).toBe(true);
    expect(traceRecord.seedEntityIds).toEqual([]);
    expect(traceRecord.selectedRefs).toEqual([]);
    expect(traceRecord.rejectedRefs).toEqual([]);
    expect(traceRecord.updatedAt).toBe('2026-07-04T00:00:00.000Z');
    expect(repository.exportSafeSnapshot('2026-07-04T00:00:00.000Z').queryTraces).toEqual([]);
  });

  it('applies delete and redact trace retention policies distinctly', () => {
    const deleteRepository = createSarPersistenceRepository({ now: () => fixedNow });
    deleteRepository.upsertQueryTrace({
      ...traceInput(),
      retention: {
        ...traceInput().retention,
        minimizationPolicy: 'delete-details-after-retention',
      },
    });
    deleteRepository.minimizeExpiredTraces('2026-07-04T00:00:00.000Z');
    const deleted = deleteRepository.getSnapshot().queryTraces['sar:trace:root-locus'];
    expect(deleted.limitations).toEqual([]);
    expect(deleted.aggregateCounts).toBeUndefined();

    const redactRepository = createSarPersistenceRepository({ now: () => fixedNow });
    redactRepository.upsertQueryTrace({
      ...traceInput(),
      retention: {
        ...traceInput().retention,
        minimizationPolicy: 'redact-details-after-retention',
      },
    });
    redactRepository.minimizeExpiredTraces('2026-07-04T00:00:00.000Z');
    const redacted = redactRepository.getSnapshot().queryTraces['sar:trace:root-locus'];
    expect(redacted.limitations).toContain('Trace details redacted after SAR retention boundary.');
    expect(redacted.aggregateCounts).toBeUndefined();
  });

  it('excludes audit-only and system-internal records from safe exports', () => {
    const repository = createSarPersistenceRepository({ now: () => fixedNow });
    repository.upsertResult(sarResult({
      events: [
        event(),
        event({
          id: 'sar:event:audit-only',
          title: 'Audit-only event',
          safeSummary: 'Governed audit summary.',
          sourceRef: { ...event().sourceRef, id: 'audit:event', contentHash: 'sha256:audit' },
          privacyScope: 'audit-only',
        }),
      ],
      entities: [
        entity(),
        entity({
          id: 'sar:entity:system',
          canonicalRef: 'system:internal',
          label: 'System internal entity',
          privacyScope: 'system-internal',
        }),
      ],
      relations: [
        relation(),
        relation({
          eventId: 'sar:event:audit-only',
          entityId: 'sar:entity:system',
          source: 'audit relation summary',
        }),
      ],
    }));

    const exported = repository.exportSafeSnapshot();
    expect(exported.events.map((record) => record.stableId)).toEqual(['sar:event:kaq:root-locus']);
    expect(exported.entities.map((record) => record.stableId)).toEqual(['sar:entity:kaq:root-locus']);
    expect(exported.relations.map((record) => record.eventId)).toEqual(['sar:event:kaq:root-locus']);
  });

  it('filters restricted SAR refs from exported query traces', () => {
    const repository = createSarPersistenceRepository({ now: () => fixedNow });
    const restrictedEvent = event({
      id: 'sar:event:audit-only',
      title: 'Audit-only event',
      safeSummary: 'Governed audit summary.',
      sourceRef: { ...event().sourceRef, id: 'audit:event', contentHash: 'sha256:audit' },
      privacyScope: 'audit-only',
    });
    const restrictedEntity = entity({
      id: 'sar:entity:system',
      canonicalRef: 'system:internal',
      label: 'System internal entity',
      privacyScope: 'system-internal',
    });
    const result = sarResult({
      trace: trace({
        seedEntityIds: ['sar:entity:kaq:root-locus', 'sar:entity:system'],
        expansionHops: [{
          fromEntityId: 'sar:entity:kaq:root-locus',
          toEntityId: 'sar:entity:system',
          viaEventId: 'sar:event:audit-only',
          relationRole: 'supports',
          confidence: 0.72,
        }],
        selectedRefs: [
          'sar:event:kaq:root-locus',
          'sar:event:audit-only',
          'citation-target:kaq:root-locus',
        ],
        rejectedRefs: [
          { ref: 'sar:entity:system', reason: 'scope unavailable' },
          { ref: 'learning-evidence:chunk:root-locus', reason: 'low confidence' },
        ],
      }),
      events: [event(), restrictedEvent],
      entities: [entity(), restrictedEntity],
      relations: [
        relation(),
        relation({
          eventId: 'sar:event:audit-only',
          entityId: 'sar:entity:system',
          source: 'audit relation summary',
        }),
      ],
    });

    repository.upsertResult(result);
    repository.upsertQueryTrace(traceInput(result));

    const [exportedTrace] = repository.exportSafeSnapshot().queryTraces;
    expect(exportedTrace.seedEntityIds).toEqual(['sar:entity:kaq:root-locus']);
    expect(exportedTrace.expansionHops).toEqual([]);
    expect(exportedTrace.selectedRefs).toEqual([
      'sar:event:kaq:root-locus',
      'citation-target:kaq:root-locus',
    ]);
    expect(exportedTrace.rejectedRefs).toEqual([
      { ref: 'learning-evidence:chunk:root-locus', reason: 'low confidence' },
    ]);
    expect(JSON.stringify(exportedTrace)).not.toContain('sar:event:audit-only');
    expect(JSON.stringify(exportedTrace)).not.toContain('sar:entity:system');
  });

  it('filters orphan SAR refs from exported query traces after rebuild', () => {
    const repository = createSarPersistenceRepository({ now: () => fixedNow });
    const orphanEvent = event({
      id: 'sar:event:orphan-audit',
      title: 'Orphan audit event',
      safeSummary: 'Governed audit summary.',
      sourceRef: { ...event().sourceRef, id: 'audit:orphan', contentHash: 'sha256:orphan-audit' },
      privacyScope: 'audit-only',
    });
    const orphanEntity = entity({
      id: 'sar:entity:orphan-system',
      canonicalRef: 'system:orphan',
      label: 'Orphan system entity',
      privacyScope: 'system-internal',
    });
    const result = sarResult({
      trace: trace({
        selectedRefs: ['sar:event:kaq:root-locus', 'sar:event:orphan-audit', 'citation-target:kaq:root-locus'],
        rejectedRefs: [
          { ref: 'sar:entity:orphan-system', reason: 'scope unavailable' },
          { ref: 'learning-evidence:chunk:root-locus', reason: 'low confidence' },
        ],
      }),
      events: [event(), orphanEvent],
      entities: [entity(), orphanEntity],
      relations: [
        relation(),
        relation({
          eventId: 'sar:event:orphan-audit',
          entityId: 'sar:entity:orphan-system',
          source: 'orphan audit relation summary',
        }),
      ],
    });
    repository.upsertResult(result);
    repository.upsertQueryTrace(traceInput(result));

    repository.rebuild([sarResult()]);

    const [exportedTrace] = repository.exportSafeSnapshot().queryTraces;
    expect(exportedTrace.selectedRefs).toEqual([
      'sar:event:kaq:root-locus',
      'citation-target:kaq:root-locus',
    ]);
    expect(exportedTrace.rejectedRefs).toEqual([
      { ref: 'learning-evidence:chunk:root-locus', reason: 'low confidence' },
    ]);
    expect(JSON.stringify(exportedTrace)).not.toContain('sar:event:orphan-audit');
    expect(JSON.stringify(exportedTrace)).not.toContain('sar:entity:orphan-system');
  });

  it('keeps safe export mutations isolated from repository state', () => {
    const repository = createSarPersistenceRepository({ now: () => fixedNow });
    repository.upsertResult(sarResult());
    repository.upsertQueryTrace(traceInput());

    const exported = repository.exportSafeSnapshot();
    exported.events[0].sourceRef.ownerUserIdHash = 'learner-raw';
    exported.queryTraces[0].scope.studentIdHash = 'learner-raw';
    exported.queryTraces[0].selectedRefs.push('sar:event:raw-answer-body');

    const snapshot = repository.getSnapshot();
    expect(JSON.stringify(snapshot)).not.toContain('learner-raw');
    expect(JSON.stringify(snapshot)).not.toContain('sar:event:raw-answer-body');
  });

  it('restores durable snapshots from disk without duplicating rebuilt records', () => {
    const directory = mkdtempSync(join(tmpdir(), 'sar-persistence-'));
    const filePath = join(directory, 'sar-index.json');
    try {
      const first = createSarPersistenceRepository({ filePath, now: () => fixedNow });
      first.upsertResult(sarResult());

      const second = createSarPersistenceRepository({
        filePath,
        now: () => '2026-07-01T02:00:00.000Z',
      });
      expect(Object.keys(second.getSnapshot().events)).toHaveLength(1);

      const rebuild = second.rebuild([
        sarResult(),
        sarResult({
          id: 'sar:result:updated',
          trace: trace({ id: 'sar:trace:updated' }),
        }),
      ]);
      expect(rebuild.persisted).toBe(true);
      expect(Object.keys(second.getSnapshot().events)).toHaveLength(1);
      expect(Object.keys(second.getSnapshot().relations)).toHaveLength(1);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it('updates stable relations when relation source text changes', () => {
    const repository = createSarPersistenceRepository({ now: () => fixedNow });
    repository.upsertResult(sarResult());
    repository.upsertResult(sarResult({
      relations: [relation({ source: 'updated matched KAQ objective summary' })],
    }), { now: '2026-07-01T03:00:00.000Z' });

    const relations = Object.values(repository.getSnapshot().relations);
    expect(relations).toHaveLength(1);
    expect(relations[0]).toMatchObject({
      eventId: 'sar:event:kaq:root-locus',
      entityId: 'sar:entity:kaq:root-locus',
      role: 'about',
      provenance: 'deterministic-id',
      source: 'updated matched KAQ objective summary',
      updatedAt: '2026-07-01T03:00:00.000Z',
    });
  });

  it('rejects restored snapshots that contain raw query trace fields', () => {
    const directory = mkdtempSync(join(tmpdir(), 'sar-persistence-'));
    const filePath = join(directory, 'sar-index.json');
    try {
      const repository = createSarPersistenceRepository({ now: () => fixedNow });
      repository.upsertQueryTrace(traceInput());
      const snapshot = repository.getSnapshot();
      writeFileSync(filePath, JSON.stringify({
        ...snapshot,
        queryTraces: {
          'sar:trace:root-locus': {
            ...snapshot.queryTraces['sar:trace:root-locus'],
            rawQuery: 'Which root locus objective should support this learner?',
          },
        },
      }));

      expect(() => createSarPersistenceRepository({ filePath })).toThrow('Invalid SAR persistence snapshot');
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it('rejects restored snapshots with top-level raw fields', () => {
    const directory = mkdtempSync(join(tmpdir(), 'sar-persistence-'));
    const filePath = join(directory, 'sar-index.json');
    try {
      const repository = createSarPersistenceRepository({ now: () => fixedNow });
      repository.upsertResult(sarResult());
      const snapshot = repository.getSnapshot();
      writeFileSync(filePath, JSON.stringify({
        ...snapshot,
        rawLearnerSubmission: 'student answer body',
      }));

      expect(() => createSarPersistenceRepository({ filePath })).toThrow('Invalid SAR persistence snapshot');
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it('rejects restored projection records with extra raw fields', () => {
    const directory = mkdtempSync(join(tmpdir(), 'sar-persistence-'));
    const filePath = join(directory, 'sar-index.json');
    try {
      const repository = createSarPersistenceRepository({ now: () => fixedNow });
      repository.upsertResult(sarResult());
      const snapshot = repository.getSnapshot();
      writeFileSync(filePath, JSON.stringify({
        ...snapshot,
        events: {
          'sar:event:kaq:root-locus': {
            ...snapshot.events['sar:event:kaq:root-locus'],
            metadata: { rawLearnerSubmission: 'student answer body' },
          },
        },
        entities: {
          'sar:entity:kaq:root-locus': {
            ...snapshot.entities['sar:entity:kaq:root-locus'],
            rawAnswerBody: 'student answer body',
          },
        },
        relations: {
          [Object.keys(snapshot.relations)[0]]: {
            ...Object.values(snapshot.relations)[0],
            rawTracePayload: 'private raw trace',
          },
        },
      }));

      expect(() => createSarPersistenceRepository({ filePath })).toThrow('Invalid SAR persistence snapshot');
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it('rejects restored projection records with corrupted exported fields', () => {
    const directory = mkdtempSync(join(tmpdir(), 'sar-persistence-'));
    const filePath = join(directory, 'sar-index.json');
    try {
      const repository = createSarPersistenceRepository({ now: () => fixedNow });
      repository.upsertResult(sarResult());
      const snapshot = repository.getSnapshot();
      writeFileSync(filePath, JSON.stringify({
        ...snapshot,
        events: {
          'sar:event:kaq:root-locus': {
            ...snapshot.events['sar:event:kaq:root-locus'],
            authorityLevel: 'raw answer body',
          },
        },
      }));

      expect(() => createSarPersistenceRepository({ filePath })).toThrow('Invalid SAR persistence snapshot');
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it('rejects restored snapshots with raw scoped entity refs', () => {
    const directory = mkdtempSync(join(tmpdir(), 'sar-persistence-'));
    const filePath = join(directory, 'sar-index.json');
    try {
      const repository = createSarPersistenceRepository({ now: () => fixedNow });
      repository.upsertQueryTrace(traceInput());
      const snapshot = repository.getSnapshot();
      const relationId = Object.keys(snapshot.relations)[0];
      const rawStudentEntity = {
        ...snapshot.entities['sar:entity:kaq:root-locus'],
        stableId: 'sar:entity:student:student:learner-1',
        entityType: 'student',
        canonicalRef: 'student:learner-1',
        label: 'Learner 1',
        aliases: ['student:learner-1'],
      };
      const corruptedSnapshot = {
        ...snapshot,
        entities: {
          [rawStudentEntity.stableId]: rawStudentEntity,
        },
        relations: {
          [relationId]: {
            ...Object.values(snapshot.relations)[0],
            entityId: rawStudentEntity.stableId,
          },
        },
        queryTraces: {
          'sar:trace:root-locus': {
            ...snapshot.queryTraces['sar:trace:root-locus'],
            seedEntityIds: [rawStudentEntity.stableId],
            selectedRefs: [rawStudentEntity.stableId],
            expansionHops: [{
              ...snapshot.queryTraces['sar:trace:root-locus'].expansionHops[0],
              viaEventId: 'sar:entity:student:student:learner-1',
            }],
            rejectedRefs: [{ ref: 'sar:entity:class:class:raw-class', reason: 'class-scope-mismatch' }],
          },
        },
      };

      const restored = repository.restore(corruptedSnapshot);
      expect(restored.persisted).toBe(false);
      expect(restored.issues.map((issue) => issue.path)).toEqual(expect.arrayContaining([
        'entities.sar:entity:student:student:learner-1.stableId',
        'entities.sar:entity:student:student:learner-1.canonicalRef',
        `relations.${relationId}.entityId`,
        'queryTraces.sar:trace:root-locus.seedEntityIds.0',
        'queryTraces.sar:trace:root-locus.selectedRefs.0',
        'queryTraces.sar:trace:root-locus.expansionHops.0.viaEventId',
        'queryTraces.sar:trace:root-locus.rejectedRefs.0.ref',
      ]));

      writeFileSync(filePath, JSON.stringify(corruptedSnapshot));
      expect(() => createSarPersistenceRepository({ filePath })).toThrow('Invalid SAR persistence snapshot');
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it('rejects restored snapshots with raw identity labels', () => {
    const directory = mkdtempSync(join(tmpdir(), 'sar-persistence-'));
    const filePath = join(directory, 'sar-index.json');
    try {
      const repository = createSarPersistenceRepository({ now: () => fixedNow });
      repository.upsertQueryTrace(traceInput());
      const snapshot = repository.getSnapshot();
      const rawEventId = 'student-id:abc';
      const corruptedSnapshot = {
        ...snapshot,
        events: {
          [rawEventId]: {
            ...snapshot.events['sar:event:kaq:root-locus'],
            stableId: rawEventId,
            title: 'student id abc123 mastery trace',
            safeSummary: '班级 ID: A01 的聚合说明',
            sourceRef: {
              ...snapshot.events['sar:event:kaq:root-locus'].sourceRef,
              owner: 'user-id:abc',
            },
          },
        },
        queryTraces: {
          'sar:trace:root-locus': {
            ...snapshot.queryTraces['sar:trace:root-locus'],
            selectedRefs: ['learner-id:demo'],
            rejectedRefs: [{ ref: 'class-id:demo', reason: 'student id abc123 mismatch' }],
            versionRefs: ['user-id:abc'],
          },
        },
      };

      const restored = repository.restore(corruptedSnapshot);
      expect(restored.persisted).toBe(false);
      expect(restored.issues.map((issue) => issue.path)).toEqual(expect.arrayContaining([
        `events.${rawEventId}.stableId`,
        `events.${rawEventId}.title`,
        `events.${rawEventId}.safeSummary`,
        `events.${rawEventId}.sourceRef.owner`,
        'queryTraces.sar:trace:root-locus.versionRefs.0',
        'selectedRefs.0',
        'rejectedRefs.0.ref',
        'rejectedRefs.0.reason',
        'versionRefs.0',
      ]));

      writeFileSync(filePath, JSON.stringify(corruptedSnapshot));
      expect(() => createSarPersistenceRepository({ filePath })).toThrow('Invalid SAR persistence snapshot');
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it('rejects restored snapshots with restricted query trace stable ids', () => {
    const directory = mkdtempSync(join(tmpdir(), 'sar-persistence-'));
    const filePath = join(directory, 'sar-index.json');
    try {
      const repository = createSarPersistenceRepository({ now: () => fixedNow });
      repository.upsertQueryTrace(traceInput());
      const snapshot = repository.getSnapshot();
      const rawTraceId = 'Which root locus objective should support this learner?';
      const corruptedSnapshot = {
        ...snapshot,
        queryTraces: {
          [rawTraceId]: {
            ...snapshot.queryTraces['sar:trace:root-locus'],
            stableId: rawTraceId,
          },
        },
      };

      const restored = repository.restore(corruptedSnapshot);
      expect(restored.persisted).toBe(false);
      expect(restored.issues.map((issue) => issue.path)).toContain('trace.id');

      writeFileSync(filePath, JSON.stringify(corruptedSnapshot));
      expect(() => createSarPersistenceRepository({ filePath })).toThrow('Invalid SAR persistence snapshot');
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it('rejects restored snapshots with mismatched raw record map keys', () => {
    const directory = mkdtempSync(join(tmpdir(), 'sar-persistence-'));
    const filePath = join(directory, 'sar-index.json');
    try {
      const repository = createSarPersistenceRepository({ now: () => fixedNow });
      repository.upsertQueryTrace(traceInput());
      const snapshot = repository.getSnapshot();
      const rawEntityKey = 'sar:entity:student:student:learner-1';
      const hashedEntityId = `sar:entity:student:sha256:${'e'.repeat(64)}`;
      const hashedCanonicalRef = `sar:student:sha256:${'f'.repeat(64)}`;
      const relationRecord = Object.values(snapshot.relations)[0];
      const rawRelationKey = [
        relationRecord.eventId,
        'sar:entity:student:student:learner-1',
        relationRecord.role,
        relationRecord.provenance,
      ].map(encodeURIComponent).join('|');
      const hashedRelationKey = [
        relationRecord.eventId,
        hashedEntityId,
        relationRecord.role,
        relationRecord.provenance,
      ].map(encodeURIComponent).join('|');
      const corruptedSnapshot = {
        ...snapshot,
        entities: {
          [rawEntityKey]: {
            ...snapshot.entities['sar:entity:kaq:root-locus'],
            stableId: hashedEntityId,
            entityType: 'student',
            canonicalRef: hashedCanonicalRef,
            label: 'student entity',
            aliases: [hashedCanonicalRef],
          },
        },
        relations: {
          [rawRelationKey]: {
            ...relationRecord,
            stableId: rawRelationKey,
            entityId: hashedEntityId,
          },
        },
      };

      const restored = repository.restore(corruptedSnapshot);
      expect(restored.persisted).toBe(false);
      expect(restored.issues.map((issue) => issue.path)).toEqual(expect.arrayContaining([
        `entities.${rawEntityKey}`,
        `relations.${rawRelationKey}.stableId`,
      ]));

      writeFileSync(filePath, JSON.stringify({
        ...corruptedSnapshot,
        relations: {
          [rawRelationKey]: {
            ...corruptedSnapshot.relations[rawRelationKey],
            stableId: hashedRelationKey,
          },
        },
      }));
      expect(() => createSarPersistenceRepository({ filePath })).toThrow('Invalid SAR persistence snapshot');
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it('rejects restored records with missing or invalid persisted schema fields', () => {
    const directory = mkdtempSync(join(tmpdir(), 'sar-persistence-'));
    const filePath = join(directory, 'sar-index.json');
    try {
      const repository = createSarPersistenceRepository({ now: () => fixedNow });
      repository.upsertQueryTrace(traceInput());
      const snapshot = repository.getSnapshot();
      const eventWithoutContentHash: Record<string, unknown> = { ...snapshot.events['sar:event:kaq:root-locus'] };
      delete eventWithoutContentHash.contentHash;
      const traceWithoutContentHash: Record<string, unknown> = { ...snapshot.queryTraces['sar:trace:root-locus'] };
      delete traceWithoutContentHash.contentHash;
      delete traceWithoutContentHash.minimized;
      const relationId = Object.keys(snapshot.relations)[0];
      const corruptedSnapshot = {
        ...snapshot,
        events: {
          'sar:event:kaq:root-locus': eventWithoutContentHash,
        },
        entities: {
          'sar:entity:kaq:root-locus': {
            ...snapshot.entities['sar:entity:kaq:root-locus'],
            versionRefs: 'sar-contract.v1',
          },
        },
        relations: {
          [relationId]: {
            ...Object.values(snapshot.relations)[0],
            updatedAt: 'not-a-date',
          },
        },
        queryTraces: {
          'sar:trace:root-locus': traceWithoutContentHash,
        },
      };

      const restored = repository.restore(corruptedSnapshot);
      expect(restored.persisted).toBe(false);
      expect(restored.issues.map((issue) => issue.path)).toEqual(expect.arrayContaining([
        'events.sar:event:kaq:root-locus.contentHash',
        'entities.sar:entity:kaq:root-locus.versionRefs',
        `relations.${relationId}.updatedAt`,
        'queryTraces.sar:trace:root-locus.contentHash',
        'queryTraces.sar:trace:root-locus.minimized',
      ]));

      writeFileSync(filePath, JSON.stringify(corruptedSnapshot));

      expect(() => createSarPersistenceRepository({ filePath })).toThrow('Invalid SAR persistence snapshot');
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it('rejects restored snapshots with restricted sourceRef text', () => {
    const directory = mkdtempSync(join(tmpdir(), 'sar-persistence-'));
    const filePath = join(directory, 'sar-index.json');
    try {
      const repository = createSarPersistenceRepository({ now: () => fixedNow });
      repository.upsertResult(sarResult());
      const snapshot = repository.getSnapshot();
      writeFileSync(filePath, JSON.stringify({
        ...snapshot,
        events: {
          'sar:event:kaq:root-locus': {
            ...snapshot.events['sar:event:kaq:root-locus'],
            sourceRef: {
              ...snapshot.events['sar:event:kaq:root-locus'].sourceRef,
              owner: 'raw answer body',
            },
          },
        },
      }));

      expect(() => createSarPersistenceRepository({ filePath })).toThrow('Invalid SAR persistence snapshot');
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it('rejects restored snapshots with restricted trace text in allowed fields', () => {
    const directory = mkdtempSync(join(tmpdir(), 'sar-persistence-'));
    const filePath = join(directory, 'sar-index.json');
    try {
      const repository = createSarPersistenceRepository({ now: () => fixedNow });
      repository.upsertQueryTrace(traceInput());
      const snapshot = repository.getSnapshot();
      writeFileSync(filePath, JSON.stringify({
        ...snapshot,
        queryTraces: {
          'sar:trace:root-locus': {
            ...snapshot.queryTraces['sar:trace:root-locus'],
            seedEntityIds: ['raw answer body'],
            selectedRefs: ['raw answer body'],
            rejectedRefs: [{ ref: 'raw audit trace', reason: 'hidden arena evaluation internals' }],
            limitations: ['private konling memory'],
          },
        },
      }));

      expect(() => createSarPersistenceRepository({ filePath })).toThrow('Invalid SAR persistence snapshot');
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it('rejects restored snapshots with restricted query role text', () => {
    const directory = mkdtempSync(join(tmpdir(), 'sar-persistence-'));
    const filePath = join(directory, 'sar-index.json');
    try {
      const repository = createSarPersistenceRepository({ now: () => fixedNow });
      repository.upsertQueryTrace(traceInput());
      const snapshot = repository.getSnapshot();
      writeFileSync(filePath, JSON.stringify({
        ...snapshot,
        queryTraces: {
          'sar:trace:root-locus': {
            ...snapshot.queryTraces['sar:trace:root-locus'],
            queryRole: 'raw answer body',
            useCase: 'hidden arena evaluation internals',
          },
        },
      }));

      expect(() => createSarPersistenceRepository({ filePath })).toThrow('Invalid SAR persistence snapshot');
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it('rejects restored snapshots with forged hash suffixes', () => {
    const directory = mkdtempSync(join(tmpdir(), 'sar-persistence-'));
    const filePath = join(directory, 'sar-index.json');
    try {
      const repository = createSarPersistenceRepository({ now: () => fixedNow });
      repository.upsertQueryTrace(traceInput());
      const snapshot = repository.getSnapshot();
      writeFileSync(filePath, JSON.stringify({
        ...snapshot,
        events: {
          'sar:event:kaq:root-locus': {
            ...snapshot.events['sar:event:kaq:root-locus'],
            sourceRef: {
              ...snapshot.events['sar:event:kaq:root-locus'].sourceRef,
              ownerUserIdHash: classHash,
            },
          },
        },
        queryTraces: {
          'sar:trace:root-locus': {
            ...snapshot.queryTraces['sar:trace:root-locus'],
            queryHash: 'sar:query:sha256:Which root locus objective should support this learner?',
          },
        },
      }));

      expect(() => createSarPersistenceRepository({ filePath })).toThrow('Invalid SAR persistence snapshot');
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it('rejects restored snapshots with restricted nested trace scope text', () => {
    const directory = mkdtempSync(join(tmpdir(), 'sar-persistence-'));
    const filePath = join(directory, 'sar-index.json');
    try {
      const repository = createSarPersistenceRepository({ now: () => fixedNow });
      repository.upsertQueryTrace(traceInput());
      const snapshot = repository.getSnapshot();
      writeFileSync(filePath, JSON.stringify({
        ...snapshot,
        queryTraces: {
          'sar:trace:root-locus': {
            ...snapshot.queryTraces['sar:trace:root-locus'],
            scope: {
              ...snapshot.queryTraces['sar:trace:root-locus'].scope,
              rawQuery: 'raw answer body',
            },
          },
        },
      }));

      expect(() => createSarPersistenceRepository({ filePath })).toThrow('Invalid SAR persistence snapshot');
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it('rejects restored snapshots with restricted expansion hop fields', () => {
    const directory = mkdtempSync(join(tmpdir(), 'sar-persistence-'));
    const filePath = join(directory, 'sar-index.json');
    try {
      const repository = createSarPersistenceRepository({ now: () => fixedNow });
      repository.upsertQueryTrace(traceInput());
      const snapshot = repository.getSnapshot();
      writeFileSync(filePath, JSON.stringify({
        ...snapshot,
        queryTraces: {
          'sar:trace:root-locus': {
            ...snapshot.queryTraces['sar:trace:root-locus'],
            expansionHops: [{
              ...snapshot.queryTraces['sar:trace:root-locus'].expansionHops[0],
              relationRole: 'raw answer body',
            }],
          },
        },
      }));

      expect(() => createSarPersistenceRepository({ filePath })).toThrow('Invalid SAR persistence snapshot');
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it('rejects restored snapshots with unknown query trace scopes', () => {
    const directory = mkdtempSync(join(tmpdir(), 'sar-persistence-'));
    const filePath = join(directory, 'sar-index.json');
    try {
      const repository = createSarPersistenceRepository({ now: () => fixedNow });
      repository.upsertQueryTrace(traceInput());
      const snapshot = repository.getSnapshot();
      writeFileSync(filePath, JSON.stringify({
        ...snapshot,
        queryTraces: {
          'sar:trace:root-locus': {
            ...snapshot.queryTraces['sar:trace:root-locus'],
            scope: { scope: 'public' },
          },
        },
      }));

      expect(() => createSarPersistenceRepository({ filePath })).toThrow('Invalid SAR persistence snapshot');
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it('rejects restored snapshots with direct source owner or class identifiers', () => {
    const directory = mkdtempSync(join(tmpdir(), 'sar-persistence-'));
    const filePath = join(directory, 'sar-index.json');
    try {
      const repository = createSarPersistenceRepository({ now: () => fixedNow });
      repository.upsertResult(sarResult());
      const snapshot = repository.getSnapshot();
      writeFileSync(filePath, JSON.stringify({
        ...snapshot,
        events: {
          'sar:event:kaq:root-locus': {
            ...snapshot.events['sar:event:kaq:root-locus'],
            sourceRef: {
              ...snapshot.events['sar:event:kaq:root-locus'].sourceRef,
              ownerUserId: 'learner-raw',
              classId: 'class-raw',
            },
          },
        },
      }));

      expect(() => createSarPersistenceRepository({ filePath })).toThrow('Invalid SAR persistence snapshot');
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
