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
    studentIdHash: 'sar:student:sha256:demo',
    classIdHash: 'sar:class:sha256:control',
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
  });

  it('copies query trace scope and retention before caching records', () => {
    const repository = createSarPersistenceRepository({ now: () => fixedNow });
    const input = traceInput();
    expect(repository.upsertQueryTrace(input).persisted).toBe(true);

    input.scope.studentIdHash = 'sar:student:sha256:mutated';
    input.retention.retainUntil = '2027-01-01T00:00:00.000Z';

    const persisted = repository.getSnapshot().queryTraces['sar:trace:root-locus'];
    expect(persisted.scope.studentIdHash).toBe('sar:student:sha256:demo');
    expect(persisted.retention.retainUntil).toBe('2026-07-08T00:00:00.000Z');
  });

  it('rejects student-scoped traces without hash-only student identity', () => {
    const repository = createSarPersistenceRepository({ now: () => fixedNow });
    const write = repository.upsertQueryTrace({
      ...traceInput(),
      scope: {
        scope: 'student',
        studentIdHash: 'student-control-demo',
        classIdHash: 'sar:class:sha256:control',
      },
    });

    expect(write.persisted).toBe(false);
    expect(write.issues.map((issue) => issue.path)).toContain('scope.studentIdHash');
    expect(repository.getSnapshot().queryTraces).toEqual({});
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
            selectedRefs: ['raw answer body'],
            rejectedRefs: [{ ref: 'sar:event:private', reason: 'hidden arena evaluation internals' }],
            limitations: ['private konling memory'],
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
