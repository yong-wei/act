import { describe, expect, it } from 'vitest';
import {
  POINTER_MOVE,
  PROJECTION_INDEPENDENT_LEARNER_MINIMUM,
  PROJECTION_STATUS,
  assertTerminalBeforeDelete,
  authorizeProjectionRead,
  authorizeRawArtifact,
  authorizeReplay,
  buildProjectionEnvelope,
  compareCurrentPointer,
  emptyAnchors,
  inspectProjectionBoundary,
  markStale,
  projectSafeFeatureRead,
  projectTeacherClassRead,
  publishCurrentPointer,
  qualifyCandidate,
  redactedProjectionFailure,
  studentFieldsFromEnvelope,
  successfulPayloadExpired,
  verifyDeletionUnreadability,
  type CurrentPointerRecord,
  type PointerWriteDb,
} from '../public-api';

function pointer(overrides: Partial<CurrentPointerRecord> = {}): CurrentPointerRecord {
  return {
    subjectUserId: 'student-1',
    versionId: 'ver-1',
    calculationVersion: 'portrait-v2.cumulative.v2',
    generation: 7n,
    queueGeneration: 11n,
    stateWatermark: 3n,
    cutoverFence: 4n,
    inputDigest: 'digest-a',
    ...overrides,
  };
}

function memoryPointerDb(seed: CurrentPointerRecord | null = null): PointerWriteDb & { rows: Map<string, CurrentPointerRecord> } {
  const rows = new Map<string, CurrentPointerRecord>();
  if (seed) rows.set(seed.subjectUserId, seed);
  return {
    rows,
    findUnique: async ({ where }) => rows.get(where.userId) ?? null,
    create: async ({ data }) => {
      const record = pointer({
        subjectUserId: String(data.userId),
        versionId: String(data.stateVersionId),
        calculationVersion: String(data.calculationVersion),
        generation: data.generation as bigint,
        queueGeneration: data.queueGeneration as bigint,
        stateWatermark: data.stateWatermark as bigint,
        cutoverFence: data.cutoverFence as bigint,
        inputDigest: String(data.taskInputDigest),
      });
      if (rows.has(record.subjectUserId)) throw new Error('unique');
      rows.set(record.subjectUserId, record);
      return record;
    },
    updateMany: async ({ where, data }) => {
      const existing = rows.get(String(where.userId));
      if (
        !existing
        || existing.generation !== where.generation
        || existing.queueGeneration !== where.queueGeneration
        || existing.stateWatermark !== where.stateWatermark
        || existing.cutoverFence !== where.cutoverFence
        || existing.calculationVersion !== where.calculationVersion
        || existing.inputDigest !== where.taskInputDigest
      ) {
        return { count: 0 };
      }
      const next = pointer({
        ...existing,
        versionId: String(data.stateVersionId),
        calculationVersion: String(data.calculationVersion),
        generation: data.generation as bigint,
        queueGeneration: data.queueGeneration as bigint,
        stateWatermark: data.stateWatermark as bigint,
        cutoverFence: data.cutoverFence as bigint,
        inputDigest: String(data.taskInputDigest),
      });
      rows.set(next.subjectUserId, next);
      return { count: 1 };
    },
  };
}

function envelopeTimes() {
  return {
    trustedOccurredAt: '2026-08-29T00:00:00.000Z',
    receivedAt: '2026-08-29T00:00:01.000Z',
    materializedAt: '2026-08-29T00:00:02.000Z',
    reportedClientAt: '2026-08-28T23:59:00.000Z',
  };
}

describe('learning-record current projection publication', () => {
  it('keeps snapshot, pointer and read-model envelopes distinct and revision-bound', () => {
    const anchors = {
      ...emptyAnchors('rev-1'),
      sourceEventIds: ['evt-1'],
      sourceLogIds: ['log-1'],
    };
    const qualified = qualifyCandidate({
      trustedEvidenceCount: 2,
      inputDigest: 'x',
      payload: { coverage: 1, confidence: 0.4 },
    });
    const envelope = buildProjectionEnvelope({
      subjectUserId: 'student-1',
      processingWatermark: '2',
      stateWatermark: '3',
      calculationVersion: 'v2',
      captureRevision: 'rev-1',
      generation: '7',
      queueGeneration: '11',
      cutoverFence: '4',
      coverage: 0.5,
      freshness: '2026-08-29T00:00:02.000Z',
      confidence: 0.4,
      qualification: qualified.qualification,
      anchors,
      times: envelopeTimes(),
      trustedFactIds: ['fact-1', 'fact-2'],
    });
    expect(qualified.qualification).toBe(PROJECTION_STATUS.qualified);
    expect(envelope.anchors.sourceEventIds).toEqual(['evt-1']);
    expect(envelope.times.trustedOccurredAt).not.toBe(envelope.times.materializedAt);
    expect(envelope.times.reportedClientAt).toBe('2026-08-28T23:59:00.000Z');
    expect(envelope.processingWatermark).not.toBe(envelope.stateWatermark);
  });

  it('refuses incomplete evidence and digest mismatch as unqualified', () => {
    expect(qualifyCandidate({
      trustedEvidenceCount: 0,
      inputDigest: 'a',
      payload: { coverage: 0 },
    }).qualification).toBe(PROJECTION_STATUS.partial);
    expect(qualifyCandidate({
      trustedEvidenceCount: 1,
      inputDigest: 'a',
      expectedInputDigest: 'b',
      payload: { coverage: 1 },
    }).qualification).toBe(PROJECTION_STATUS.partial);
  });

  it('does not advance a pointer for older, conflicting or duplicate candidates', () => {
    const current = pointer();
    expect(compareCurrentPointer(current, pointer({ stateWatermark: 2n }))).toBe(POINTER_MOVE.stale);
    expect(compareCurrentPointer(current, pointer({ calculationVersion: 'other' }))).toBe(POINTER_MOVE.conflict);
    expect(compareCurrentPointer(current, pointer({ inputDigest: 'other' }))).toBe(POINTER_MOVE.advance);
    expect(compareCurrentPointer(current, pointer())).toBe(POINTER_MOVE.duplicate);
    expect(compareCurrentPointer(current, pointer({ stateWatermark: 8n }))).toBe(POINTER_MOVE.advance);
  });

  it('advances current across an authorized calculationVersion cutover', () => {
    const current = pointer();
    expect(compareCurrentPointer(current, pointer({
      calculationVersion: 'portrait-v2.cumulative.v3',
      generation: 8n,
      stateWatermark: 0n,
    }))).toBe(POINTER_MOVE.advance);
    expect(compareCurrentPointer(current, pointer({
      calculationVersion: 'portrait-v2.cumulative.v3',
      cutoverFence: 5n,
      stateWatermark: 1n,
    }))).toBe(POINTER_MOVE.advance);
    expect(compareCurrentPointer(current, pointer({
      calculationVersion: 'portrait-v2.cumulative.v3',
      generation: 6n,
    }))).toBe(POINTER_MOVE.stale);
    expect(compareCurrentPointer(current, pointer({
      calculationVersion: 'portrait-v2.cumulative.v3',
      cutoverFence: 3n,
    }))).toBe(POINTER_MOVE.stale);
  });

  it('publishes a fenced calculationVersion switch onto current', async () => {
    const db = memoryPointerDb(pointer());
    const published = await publishCurrentPointer(db, pointer({
      versionId: 'ver-cutover',
      calculationVersion: 'portrait-v2.cumulative.v3',
      generation: 8n,
      cutoverFence: 5n,
      stateWatermark: 0n,
    }));
    expect(published.move).toBe(POINTER_MOVE.advance);
    expect(db.rows.get('student-1')).toMatchObject({
      versionId: 'ver-cutover',
      calculationVersion: 'portrait-v2.cumulative.v3',
      generation: 8n,
      cutoverFence: 5n,
    });
  });

  it('makes a concurrent same-fence digest race lose CAS', async () => {
    const snapshot = pointer();
    const db = memoryPointerDb(snapshot);
    const first = await publishCurrentPointer(db, pointer({
      versionId: 'ver-2',
      inputDigest: 'digest-b',
    }));
    expect(first.move).toBe(POINTER_MOVE.advance);
    db.findUnique = async () => snapshot;
    const raced = await publishCurrentPointer(db, pointer({
      versionId: 'ver-3',
      inputDigest: 'digest-c',
    }));
    expect(raced.move).toBe(POINTER_MOVE.conflict);
    expect(db.rows.get('student-1')?.versionId).toBe('ver-2');
    expect(db.rows.get('student-1')?.inputDigest).toBe('digest-b');
  });

  it('publishes create then refuses a concurrent stale write', async () => {
    const db = memoryPointerDb();
    const first = await publishCurrentPointer(db, pointer());
    expect(first.move).toBe(POINTER_MOVE.create);
    const stale = await publishCurrentPointer(db, pointer({ versionId: 'ver-old', stateWatermark: 1n }));
    expect(stale.move).toBe(POINTER_MOVE.stale);
    expect(db.rows.get('student-1')?.versionId).toBe('ver-1');
  });

  it('keeps the prior pointer when a CAS race loses', async () => {
    const current = pointer();
    const db = memoryPointerDb(current);
    db.updateMany = async () => ({ count: 0 });
    const result = await publishCurrentPointer(db, pointer({ versionId: 'ver-2', stateWatermark: 9n }));
    expect(result.move).toBe(POINTER_MOVE.conflict);
    expect(db.rows.get('student-1')?.versionId).toBe('ver-1');
  });

  it('survives a crash between immutable version write and pointer CAS', async () => {
    const versions: string[] = [];
    const db = memoryPointerDb(pointer());
    versions.push('ver-candidate');
    expect(db.rows.get('student-1')?.versionId).toBe('ver-1');
    const published = await publishCurrentPointer(db, pointer({ versionId: 'ver-candidate', stateWatermark: 9n }));
    expect(versions).toEqual(['ver-candidate']);
    expect(published.move).toBe(POINTER_MOVE.advance);
    expect(db.rows.get('student-1')?.versionId).toBe('ver-candidate');
  });

  it('does not revert a published pointer if a later cache refresh fails', async () => {
    const db = memoryPointerDb();
    await publishCurrentPointer(db, pointer());
    await expect(Promise.reject(new Error('cache-refresh-failed'))).rejects.toThrow('cache-refresh-failed');
    expect(db.rows.get('student-1')?.versionId).toBe('ver-1');
  });

  it('rebuilds a student read from the envelope without raw events', () => {
    const envelope = buildProjectionEnvelope({
      subjectUserId: 'student-1',
      processingWatermark: '2',
      stateWatermark: '3',
      calculationVersion: 'v2',
      captureRevision: 'rev-1',
      generation: '7',
      queueGeneration: '11',
      cutoverFence: '4',
      coverage: 1,
      freshness: '2026-08-29T00:00:02.000Z',
      confidence: 0.8,
      qualification: PROJECTION_STATUS.qualified,
      anchors: emptyAnchors('rev-1'),
      times: envelopeTimes(),
      trustedFactIds: ['fact-1'],
    });
    const fresh = studentFieldsFromEnvelope(envelope, PROJECTION_STATUS.qualified);
    expect(fresh.fields.provenanceRevision).toBe('rev-1');
    const stale = markStale(fresh, 'newer-fact-unqualified');
    expect(stale.status).toBe(PROJECTION_STATUS.stale);
    expect(stale.fields.coverage).toBe(1);
    expect(studentFieldsFromEnvelope(null, PROJECTION_STATUS.unavailable).status).toBe(
      PROJECTION_STATUS.unavailable,
    );
  });

  it('fails closed when a student reads another subject', () => {
    expect(() => authorizeProjectionRead({ role: 'student', subjectUserId: 'a' }, 'b'))
      .toThrow('projection-unauthorized');
    expect(() => authorizeProjectionRead({ role: 'student', subjectUserId: 'a' }, 'a')).not.toThrow();
    expect(() => authorizeProjectionRead({ role: 'teacher' }, 'a')).toThrow('projection-unauthorized');
    expect(() => authorizeProjectionRead(
      { role: 'teacher', classIds: ['class-a'] },
      'b',
      { classId: 'class-b' },
    )).toThrow('projection-unauthorized');
    expect(() => authorizeProjectionRead(
      { role: 'teacher', classIds: ['class-a'] },
      'b',
      { classId: 'class-a' },
    )).not.toThrow();
    expect(() => authorizeProjectionRead({ role: 'ai' }, 'a')).toThrow('projection-unauthorized');
    expect(() => authorizeProjectionRead({ role: 'ai', subjectUserId: 'a' }, 'a')).not.toThrow();
    expect(() => authorizeProjectionRead({ role: 'personalization' }, 'a')).toThrow('projection-unauthorized');
    expect(() => authorizeProjectionRead({ role: 'admin' }, 'a')).not.toThrow();
  });

  it('suppresses teacher aggregates below the independent-learner threshold', () => {
    const small = projectTeacherClassRead({
      independentLearnerIds: ['s1', 's1', 's2'],
      averageScore: 0.9,
      trend: 'up',
      coverage: 1,
    });
    expect(small.independentLearnerCount).toBe(2);
    expect(small.independentLearnerCount).toBeLessThan(PROJECTION_INDEPENDENT_LEARNER_MINIMUM);
    expect(small.suppressed).toBe(true);
    expect(small.aggregates).toBeNull();
    expect(small.coverage).toBe(1);
    const large = projectTeacherClassRead({
      independentLearnerIds: ['a', 'b', 'c', 'd', 'e'],
      averageScore: 0.7,
      trend: 'flat',
      coverage: 0.8,
    });
    expect(large.suppressed).toBe(false);
    expect(large.aggregates?.averageScore).toBe(0.7);
  });

  it('exposes only AI/Personalization safe fields', () => {
    const envelope = buildProjectionEnvelope({
      subjectUserId: 'student-1',
      processingWatermark: '2',
      stateWatermark: '3',
      calculationVersion: 'v2',
      captureRevision: 'rev-1',
      generation: '7',
      queueGeneration: '11',
      cutoverFence: '4',
      coverage: 0.6,
      freshness: '2026-08-29T00:00:02.000Z',
      confidence: 0.5,
      qualification: PROJECTION_STATUS.qualified,
      anchors: emptyAnchors('rev-1'),
      times: envelopeTimes(),
      trustedFactIds: ['fact-1'],
    });
    const safe = projectSafeFeatureRead({ envelope, masteryTarget: 'mastery' });
    expect(safe.subjectRef).not.toBe('student-1');
    expect(safe).not.toHaveProperty('averageScore');
    expect(JSON.stringify(safe)).not.toMatch(/teacher|admin|answer/i);
    expect(safe.masteryTarget).toBe('mastery');
  });

  it('keeps input/output digests stable across delivery permutations and records rematerialization', () => {
    const anchors = { ...emptyAnchors('rev-1'), sourceEventIds: ['b', 'a'] };
    const left = buildProjectionEnvelope({
      subjectUserId: 'student-1',
      processingWatermark: '1',
      stateWatermark: '3',
      calculationVersion: 'v2',
      captureRevision: 'rev-1',
      generation: '7',
      queueGeneration: '11',
      cutoverFence: '4',
      coverage: 1,
      freshness: 't',
      confidence: 1,
      qualification: PROJECTION_STATUS.qualified,
      anchors,
      times: envelopeTimes(),
      trustedFactIds: ['f2', 'f1'],
    });
    const right = buildProjectionEnvelope({
      subjectUserId: 'student-1',
      processingWatermark: '9',
      stateWatermark: '3',
      calculationVersion: 'v2',
      captureRevision: 'rev-1',
      generation: '7',
      queueGeneration: '11',
      cutoverFence: '4',
      coverage: 1,
      freshness: 't',
      confidence: 1,
      qualification: PROJECTION_STATUS.qualified,
      anchors: { ...anchors, sourceEventIds: ['a', 'b'] },
      times: envelopeTimes(),
      trustedFactIds: ['f1', 'f2'],
      rematerialization: { decoderVersion: '2', materializerVersion: '2' },
    });
    expect(left.inputDigest).toBe(right.inputDigest);
    expect(right.rematerialization?.decoderVersion).toBe('2');
  });

  it('rejects a captureRevision that does not match anchors', () => {
    expect(() => buildProjectionEnvelope({
      subjectUserId: 'student-1',
      processingWatermark: '1',
      stateWatermark: '3',
      calculationVersion: 'v2',
      captureRevision: 'rev-b',
      generation: '7',
      queueGeneration: '11',
      cutoverFence: '4',
      coverage: 1,
      freshness: 't',
      confidence: 1,
      qualification: PROJECTION_STATUS.qualified,
      anchors: emptyAnchors('rev-a'),
      times: envelopeTimes(),
      trustedFactIds: ['f1'],
    })).toThrow('projection-revision-mismatch');
  });

  it('rejects forbidden projection fields and isolates raw artifacts', () => {
    const failed = qualifyCandidate({
      trustedEvidenceCount: 1,
      inputDigest: 'a',
      payload: { answer: 'B', stack: 'Error: boom at /Users/YW/app.ts' },
    });
    expect(failed.qualification).toBe(PROJECTION_STATUS.failed);
    expect(qualifyCandidate({
      trustedEvidenceCount: 1,
      inputDigest: 'a',
      payload: { studentReflection: 'I failed question 2' },
    }).qualification).toBe(PROJECTION_STATUS.failed);
    expect(inspectProjectionBoundary({ userId: 'student-1', prompt: 'x' }).length).toBeGreaterThan(0);
    expect(redactedProjectionFailure('forbidden-field').code).toBe('forbidden-field');
    expect(() => authorizeRawArtifact({ approved: false, role: 'queue' })).toThrow();
    expect(() => authorizeReplay({
      scope: 'fact',
      purpose: 'debug',
      ticket: 'T-1',
      elevatedUntil: new Date(Date.now() + 60_000),
      dualControl: false,
      role: 'operator',
    })).toThrow();
  });

  it('requires a terminal receipt before deletion and verifies unreadability', () => {
    expect(() => assertTerminalBeforeDelete({
      terminalReceipt: false,
      terminalizationInProgress: true,
    })).toThrow();
    expect(verifyDeletionUnreadability({
      object: false,
      index: false,
      cache: false,
      replica: false,
    })).toBe(true);
    expect(successfulPayloadExpired(25 * 60 * 60 * 1000)).toBe(true);
  });
});
