import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { opaqueSubjectRef } from '@/features/learning-record/event-contract/allowlist';
import { projectForConsumer } from '@/features/learning-record/event-contract/export-policy';
import {
  authorizeRawArtifact,
  authorizeReplay,
} from '@/features/learning-record/event-contract/replay';
import { retentionCapMs } from '@/features/learning-record/event-contract/retention';
import {
  INGESTION_RETENTION,
  assertTerminalBeforeDelete,
  verifyDeletionUnreadability,
} from '@/features/learning-record/ingestion/public-api';
import { mapCourseLearningRecordEvidence } from '@/features/learning-record/course-adapters/public-api';
import {
  CONTROL_CORRECTION_ADAPTER_RELEASE_REVISION,
  CONTROL_CORRECTION_ADAPTER_SCHEMA_VERSION,
  CONTROL_CORRECTION_GOAL_ID,
  CONTROL_CORRECTION_LEARNING_RECORD_ADAPTER_ID,
  CONTROL_CORRECTION_LEARNING_RECORD_ADAPTER_VERSION,
  CONTROL_CORRECTION_PERSONALIZATION_PLUGIN_ID,
  createControlCorrectionLearningRecordAdapter,
  createIdempotentPluginWritePort,
  createPersonalizationPluginRegistry,
} from '../public-api';
import type { CourseAdapterMapInput } from '../learning-record-adapter-types';

function baseInput(overrides: Partial<CourseAdapterMapInput> = {}): CourseAdapterMapInput {
  return {
    goalId: CONTROL_CORRECTION_GOAL_ID,
    captureRevision: 'capture-1',
    canonicalLessonId: 'unit-3-6-zero-design-workshop',
    sourceEventId: 'evt-adapter-1',
    sourceLogId: 'log-adapter-1',
    trustedOccurredAt: '2026-08-29T00:00:00.000Z',
    receivedAt: '2026-08-29T00:00:01.000Z',
    subjectRef: opaqueSubjectRef('student-1'),
    idempotencyKey: 'idem-adapter-1',
    materialization: 'direct',
    ...overrides,
  };
}

describe('control-correction Learning Record adapter', () => {
  const adapter = createControlCorrectionLearningRecordAdapter();

  it('maps explicit goal, plugin and canonical identity with revision-bound anchors', () => {
    const mapped = adapter.map(baseInput({
      arenaReference: { taskId: 'task-second-order-lead-pid', submissionId: 'sub-1' },
      canonicalActivityId: 'task-second-order-lead-pid',
      confidence: 0.8,
    }));
    expect(mapped.status).toBe('mapped');
    if (mapped.status !== 'mapped') return;
    expect(mapped.mapping).toMatchObject({
      goalId: CONTROL_CORRECTION_GOAL_ID,
      pluginId: CONTROL_CORRECTION_PERSONALIZATION_PLUGIN_ID,
      adapterId: CONTROL_CORRECTION_LEARNING_RECORD_ADAPTER_ID,
      adapterVersion: CONTROL_CORRECTION_LEARNING_RECORD_ADAPTER_VERSION,
      schemaVersion: CONTROL_CORRECTION_ADAPTER_SCHEMA_VERSION,
      releaseRevision: CONTROL_CORRECTION_ADAPTER_RELEASE_REVISION,
      captureRevision: 'capture-1',
      sourceEventId: 'evt-adapter-1',
      sourceLogId: 'log-adapter-1',
      contributionKind: 'auxiliary-learning-evidence',
      cannotOverrideOfficial: true,
      officialAuthority: { owner: 'arena-submission-result', conflict: false },
    });
    expect(mapped.mapping.inputDigest).toHaveLength(64);
    expect(mapped.mapping.trustedSetDigest).toHaveLength(64);
  });

  it('does not infer a mapping from course keywords when goal is omitted', () => {
    expect(mapCourseLearningRecordEvidence(baseInput({
      goalId: null,
      extra: { courseId: '3-6', lessonTitle: '零点设计' },
    }))).toEqual({ status: 'not-applicable' });
    expect(adapter.map(baseInput({ goalId: null, pluginId: null }))).toEqual({ status: 'not-applicable' });
  });

  it('fails closed on missing, unknown, ambiguous, stale and drifted identity', () => {
    expect(adapter.map(baseInput({ canonicalLessonId: null })).status).toBe('rejected');
    expect(adapter.map(baseInput({ canonicalLessonId: 'unknown-lesson' }))).toMatchObject({
      status: 'rejected',
      reason: 'unknown-mapping',
    });
    expect(adapter.map(baseInput({ goalId: 'other-goal' }))).toMatchObject({
      status: 'rejected',
      reason: 'unknown-mapping',
    });
    expect(adapter.map(baseInput({
      adapterVersion: 'control-correction-learning-record-adapter.v0',
    }))).toMatchObject({ status: 'rejected', reason: 'version-mismatch' });
    expect(adapter.map(baseInput({
      releaseRevision: 'course-release-old',
    }))).toMatchObject({ status: 'rejected', reason: 'revision-mismatch' });
    expect(adapter.map(baseInput({
      expectedCaptureRevision: 'capture-0',
    }))).toMatchObject({ status: 'rejected', reason: 'stale-capture' });
    expect(mapCourseLearningRecordEvidence(baseInput({
      pluginVersion: 'control-correction-personalization-plugin.v0',
    }))).toMatchObject({ status: 'rejected', reason: 'version-mismatch' });
  });

  it('keeps official Arena score authoritative when auxiliary evidence conflicts', () => {
    const mapped = adapter.map(baseInput({
      arenaReference: { taskId: 'task-second-order-lead-pid', submissionId: 'sub-1' },
      officialArenaResult: { score: 88, valid: true, submissionId: 'sub-1' },
      normalizedValue: 12,
    }));
    expect(mapped.status).toBe('mapped');
    if (mapped.status !== 'mapped') return;
    expect(mapped.mapping.officialAuthority).toEqual({
      owner: 'arena-submission-result',
      score: 88,
      valid: true,
      submissionId: 'sub-1',
      conflict: true,
    });
    expect(mapped.mapping.normalizedValue).toBe(12);
    expect(mapped.mapping.cannotOverrideOfficial).toBe(true);
    expect(adapter.map(baseInput({
      extra: { promoteToOfficial: true, officialScore: 100 },
    }))).toMatchObject({ status: 'rejected', reason: 'official-overwrite-attempt' });
  });

  it('projects only Personalization-authorized fields and redacts raw/export payloads', () => {
    const mapped = adapter.map(baseInput({ confidence: 0.5 }));
    expect(mapped.status).toBe('mapped');
    if (mapped.status !== 'mapped') return;
    const projection = adapter.projectPersonalization(mapped.mapping);
    expect(projection).toEqual({
      goalId: CONTROL_CORRECTION_GOAL_ID,
      pluginId: CONTROL_CORRECTION_PERSONALIZATION_PLUGIN_ID,
      pluginVersion: mapped.mapping.pluginVersion,
      quality: 'medium',
      coverage: 'partial',
      provenance: {
        adapterId: CONTROL_CORRECTION_LEARNING_RECORD_ADAPTER_ID,
        adapterVersion: CONTROL_CORRECTION_LEARNING_RECORD_ADAPTER_VERSION,
        captureRevision: 'capture-1',
        sourceEventId: 'evt-adapter-1',
        officialAuthority: 'arena-submission-result',
      },
    });
    expect(JSON.stringify(projection)).not.toMatch(/student-1|answer|prompt/);
    for (const role of ['student', 'teacher', 'ai'] as const) {
      expect(adapter.projectPersonalization(mapped.mapping).provenance.officialAuthority, role)
        .toBe('arena-submission-result');
    }
    expect(projectForConsumer({
      goalId: CONTROL_CORRECTION_GOAL_ID,
      eventType: 'lesson_submit',
    }, 'public')).toEqual({ eventType: 'lesson_submit' });
  });

  it('rejects forbidden fields, raw payload inheritance and unauthorized replay', () => {
    expect(adapter.map(baseInput({
      extra: { answer: 'B', prompt: 'solve' },
    }))).toMatchObject({ status: 'rejected', reason: 'forbidden-field' });
    expect(adapter.map(baseInput({
      rawArtifactRef: { digest: 'abc', expiresAt: '2026-08-30T00:00:00.000Z', accessPolicy: 'inherit-queue' },
    }))).toMatchObject({ status: 'rejected', reason: 'raw-artifact-forbidden' });
    expect(adapter.map(baseInput({
      materialization: 'replay',
      replayAuthorization: {
        scope: '',
        purpose: '',
        ticket: '',
        elevatedUntil: new Date(0),
        dualControl: false,
        role: 'fact-consumer',
      },
    }))).toMatchObject({ status: 'rejected', reason: 'replay-unauthorized' });
    expect(() => authorizeReplay({
      scope: 'adapter',
      purpose: 'debug',
      ticket: 'T-1',
      elevatedUntil: new Date('2099-01-01T00:00:00.000Z'),
      dualControl: false,
      role: 'operator',
    })).toThrow(/two-person/);
    expect(() => authorizeRawArtifact({ approved: false, role: 'queue' })).toThrow(/independently authorized/);
    expect(() => authorizeReplay({
      scope: 'adapter',
      purpose: 'replay-test',
      ticket: 'T-2',
      elevatedUntil: new Date('2099-01-01T00:00:00.000Z'),
      dualControl: true,
      role: 'operator',
    })).not.toThrow();
  });

  it('is deterministic across delivery order, duplicate persist and out-of-order materialization', async () => {
    const digests = (['direct', 'outbox', 'correction', 'backfill'] as const).map((materialization) => {
      const mapped = adapter.map(baseInput({ materialization }));
      expect(mapped.status).toBe('mapped');
      return mapped.status === 'mapped' ? mapped.mapping.inputDigest : '';
    });
    expect(new Set(digests).size).toBe(1);
    const port = createIdempotentPluginWritePort();
    const mapped = adapter.map(baseInput());
    expect(mapped.status).toBe('mapped');
    if (mapped.status !== 'mapped') return;
    const request = {
      pluginId: CONTROL_CORRECTION_PERSONALIZATION_PLUGIN_ID,
      pluginVersion: mapped.mapping.pluginVersion,
      subjectUserId: 'student-1',
      idempotencyKey: mapped.mapping.idempotencyKey,
      evidenceRevision: mapped.mapping.captureRevision,
      sourceCoverage: mapped.mapping.coverage,
      confidence: 0.8,
      privacyClass: 'student-visible',
      evidenceRefs: [mapped.mapping.sourceEventId],
    };
    const first = await port.persist(request);
    const second = await port.persist(request);
    expect(second).toEqual({ ...first, duplicate: true });
  });

  it('preserves anchors across rematerialization and rejects unauthorized cross-revision rebase', () => {
    const original = adapter.map(baseInput());
    expect(original.status).toBe('mapped');
    if (original.status !== 'mapped') return;
    const rematerialized = adapter.map(baseInput({
      materialization: 'correction',
      rebaseReceipt: {
        sourceRevision: 'capture-0',
        targetRevision: 'capture-1',
        authorizedBy: 'operator-1',
      },
      expectedCaptureRevision: 'capture-0',
    }));
    expect(rematerialized.status).toBe('mapped');
    if (rematerialized.status === 'mapped') {
      expect(rematerialized.mapping.sourceEventId).toBe(original.mapping.sourceEventId);
      expect(rematerialized.mapping.captureRevision).toBe('capture-1');
    }
    expect(adapter.map(baseInput({
      rebaseReceipt: {
        sourceRevision: 'other-rev',
        targetRevision: 'another-rev',
        authorizedBy: 'operator-1',
      },
    }))).toMatchObject({ status: 'rejected', reason: 'cross-revision' });
  });

  it('enforces retention caps, terminal deletion and unreadability of isolated raw artifacts', () => {
    expect(retentionCapMs('transport-replay')).toBe(INGESTION_RETENTION.transportReplayDefaultHours * 60 * 60 * 1000);
    expect(retentionCapMs('successful-payload')).toBe(INGESTION_RETENTION.successfulPayloadHours * 60 * 60 * 1000);
    expect(retentionCapMs('failure-receipt', 120 * 24 * 60 * 60 * 1000))
      .toBe(INGESTION_RETENTION.failureReceiptMaxDays * 24 * 60 * 60 * 1000);
    expect(retentionCapMs('restricted-raw')).toBe(INGESTION_RETENTION.approvedRawDefaultHours * 60 * 60 * 1000);
    expect(() => assertTerminalBeforeDelete({
      terminalReceipt: false,
      terminalizationInProgress: false,
    })).toThrow(/retention-not-terminal/);
    assertTerminalBeforeDelete({ terminalReceipt: true, terminalizationInProgress: false });
    expect(verifyDeletionUnreadability({
      object: false,
      index: false,
      cache: false,
      replica: false,
    })).toBe(true);
    expect(verifyDeletionUnreadability({
      object: true,
      index: false,
      cache: false,
      replica: false,
    })).toBe(false);
  });

  it('fails closed when the registered adapter cannot be loaded', () => {
    const empty = createPersonalizationPluginRegistry();
    expect(empty.get(CONTROL_CORRECTION_GOAL_ID)).toBeNull();
    expect(mapCourseLearningRecordEvidence(baseInput({ goalId: 'missing-goal' }))).toMatchObject({
      status: 'rejected',
      reason: 'unknown-mapping',
    });
  });

  it('keeps generic Learning Record and Arena producer files free of control-correction literals', () => {
    for (const file of [
      'src/features/learning-record/ingestion/ingest.ts',
      'src/features/learning-record/course-adapters/map-evidence.ts',
      'src/features/arena/evidence-writeback-persistence.ts',
    ]) {
      const source = readFileSync(file, 'utf8');
      expect(source, file).not.toContain("'control-correction'");
      expect(source, file).not.toContain('unit-3-6-zero-design-workshop');
      expect(source, file).not.toContain('task-second-order-lead-pid');
    }
  });
});
