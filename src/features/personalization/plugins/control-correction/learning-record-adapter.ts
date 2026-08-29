import {
  collectForbiddenFields,
  opaqueSubjectRef,
} from '@/features/learning-record/event-contract/allowlist';
import { sha256Canonical } from '@/features/learning-record/event-contract/digest';
import { containsForbiddenExportField } from '@/features/learning-record/event-contract/export-policy';
import {
  authorizeRawArtifact,
  authorizeReplay,
} from '@/features/learning-record/event-contract/replay';
import {
  LEARNING_RECORD_DECODER_VERSION,
  LEARNING_RECORD_MATERIALIZER_VERSION,
} from '@/features/learning-record/event-contract/types';
import { inspectIngestionBoundary } from '@/features/learning-record/ingestion/sanitizer';
import type {
  CourseAdapterMapInput,
  CourseAdapterMapResult,
  CourseAdapterRejectReason,
  CourseLearningRecordAdapter,
  NormalizedCourseEvidenceMapping,
  PersonalizationAdapterProjection,
} from '../learning-record-adapter-types';
import { readString } from '../json';
import {
  CONTROL_CORRECTION_ARENA_TASK_IDS,
  CONTROL_CORRECTION_COURSE_IDS,
  CONTROL_CORRECTION_GOAL_ID,
  CONTROL_CORRECTION_LESSON_IDS,
  CONTROL_CORRECTION_PERSONALIZATION_PLUGIN_ID,
  CONTROL_CORRECTION_PERSONALIZATION_PLUGIN_VERSION,
} from './mappings';

export const CONTROL_CORRECTION_LEARNING_RECORD_ADAPTER_ID =
  'control-correction-learning-record-adapter';
export const CONTROL_CORRECTION_LEARNING_RECORD_ADAPTER_VERSION =
  'control-correction-learning-record-adapter.v1';
export const CONTROL_CORRECTION_ADAPTER_SCHEMA_VERSION = 'control-correction-adapter.schema.v1';
export const CONTROL_CORRECTION_ADAPTER_RELEASE_REVISION =
  CONTROL_CORRECTION_LEARNING_RECORD_ADAPTER_VERSION;

function fingerprint(code: string): string {
  return sha256Canonical({ code, adapter: CONTROL_CORRECTION_LEARNING_RECORD_ADAPTER_VERSION }).slice(0, 16);
}

function rejected(reason: CourseAdapterRejectReason): CourseAdapterMapResult {
  return {
    status: 'rejected',
    reason,
    diagnostic: { code: reason, fingerprint: fingerprint(reason), stage: 'adapter' },
  };
}

function qualityFrom(confidence: number | null): NormalizedCourseEvidenceMapping['quality'] {
  if (confidence == null) return 'missing';
  if (confidence >= 0.75) return 'high';
  if (confidence >= 0.4) return 'medium';
  return 'low';
}

function registeredIdentity(value: string | null, pool: ReadonlySet<string>): 'match' | 'missing' | 'unknown' {
  if (!value) return 'missing';
  return pool.has(value) ? 'match' : 'unknown';
}

function inspectPayload(input: CourseAdapterMapInput): string[] {
  if (!input.extra) return [];
  return [
    ...inspectIngestionBoundary(input.extra),
    ...collectForbiddenFields(input.extra),
    ...containsForbiddenExportField(input.extra),
  ];
}

function isAuthorizedRebase(
  receipt: CourseAdapterMapInput['rebaseReceipt'] | CourseAdapterMapInput['captureRebaseReceipt'],
  sourceRevision: string,
  targetRevision: string,
): boolean {
  return Boolean(
    receipt
    && receipt.sourceRevision === sourceRevision
    && receipt.targetRevision === targetRevision
    && readString(receipt.authorizedBy)
  );
}

function isUnauthorizedRebaseReceipt(
  receipt: CourseAdapterMapInput['rebaseReceipt'] | CourseAdapterMapInput['captureRebaseReceipt'],
  releaseRevision: string,
  expectedCapture: string | null,
  captureRevision: string,
): boolean {
  if (!receipt) return false;
  if (!readString(receipt.sourceRevision) || !readString(receipt.targetRevision)) return false;
  if (isAuthorizedRebase(
    receipt,
    releaseRevision,
    CONTROL_CORRECTION_ADAPTER_RELEASE_REVISION,
  )) {
    return false;
  }
  if (expectedCapture && isAuthorizedRebase(receipt, expectedCapture, captureRevision)) {
    return false;
  }
  if (receipt.sourceRevision === captureRevision || receipt.targetRevision === captureRevision) {
    return false;
  }
  return true;
}

export function mapControlCorrectionLearningRecord(
  input: CourseAdapterMapInput,
): CourseAdapterMapResult {
  const goalId = readString(input.goalId);
  const pluginId = readString(input.pluginId);
  if (!goalId && !pluginId) return { status: 'not-applicable' };
  if (goalId && goalId !== CONTROL_CORRECTION_GOAL_ID) return rejected('unknown-mapping');
  if (pluginId && pluginId !== CONTROL_CORRECTION_PERSONALIZATION_PLUGIN_ID) {
    return rejected('unknown-mapping');
  }

  const adapterVersion = readString(input.adapterVersion);
  const schemaVersion = readString(input.schemaVersion);
  const pluginVersion = readString(input.pluginVersion);
  const releaseRevision = readString(input.releaseRevision);
  const captureRevision = readString(input.captureRevision);
  if (!captureRevision || !adapterVersion || !schemaVersion || !pluginVersion || !releaseRevision) {
    return rejected('missing-canonical-identity');
  }
  if (adapterVersion !== CONTROL_CORRECTION_LEARNING_RECORD_ADAPTER_VERSION) return rejected('version-mismatch');
  if (schemaVersion !== CONTROL_CORRECTION_ADAPTER_SCHEMA_VERSION) return rejected('version-mismatch');
  if (pluginVersion !== CONTROL_CORRECTION_PERSONALIZATION_PLUGIN_VERSION) return rejected('version-mismatch');
  if (releaseRevision !== CONTROL_CORRECTION_ADAPTER_RELEASE_REVISION) {
    if (!isAuthorizedRebase(
      input.rebaseReceipt,
      releaseRevision,
      CONTROL_CORRECTION_ADAPTER_RELEASE_REVISION,
    )) {
      return rejected('revision-mismatch');
    }
  }

  const expectedCapture = readString(input.expectedCaptureRevision);
  if (expectedCapture && expectedCapture !== captureRevision) {
    const captureAuthorized = isAuthorizedRebase(
      input.captureRebaseReceipt,
      expectedCapture,
      captureRevision,
    ) || isAuthorizedRebase(input.rebaseReceipt, expectedCapture, captureRevision);
    if (!captureAuthorized) {
      return rejected('stale-capture');
    }
  }
  if (
    isUnauthorizedRebaseReceipt(input.rebaseReceipt, releaseRevision, expectedCapture, captureRevision)
    || isUnauthorizedRebaseReceipt(
      input.captureRebaseReceipt,
      releaseRevision,
      expectedCapture,
      captureRevision,
    )
  ) {
    return rejected('cross-revision');
  }

  if (inspectPayload(input).length > 0) return rejected('forbidden-field');
  const extra = input.extra ?? {};
  if (extra.promoteToOfficial === true || extra.overrideOfficial === true || extra.officialScore != null) {
    return rejected('official-overwrite-attempt');
  }

  const lessonId = readString(input.canonicalLessonId);
  const resourceId = readString(input.canonicalResourceId);
  const activityId = readString(input.canonicalActivityId);
  const arenaTaskId = readString(input.arenaReference?.taskId);
  const identities = [
    registeredIdentity(lessonId, CONTROL_CORRECTION_LESSON_IDS),
    registeredIdentity(resourceId, CONTROL_CORRECTION_COURSE_IDS),
    registeredIdentity(activityId, new Set([...CONTROL_CORRECTION_LESSON_IDS, ...CONTROL_CORRECTION_ARENA_TASK_IDS])),
    registeredIdentity(arenaTaskId, CONTROL_CORRECTION_ARENA_TASK_IDS),
  ];
  if (identities.some((status) => status === 'unknown')) return rejected('unknown-mapping');
  const matched = identities.filter((status) => status === 'match').length;
  if (matched === 0) return rejected('missing-canonical-identity');

  const supplied = [lessonId, resourceId, activityId, arenaTaskId].filter((value): value is string => Boolean(value));
  const uniqueGoals = new Set(
    supplied.map((value) => (
      CONTROL_CORRECTION_LESSON_IDS.has(value)
      || CONTROL_CORRECTION_COURSE_IDS.has(value)
      || CONTROL_CORRECTION_ARENA_TASK_IDS.has(value)
        ? CONTROL_CORRECTION_GOAL_ID
        : value
    )),
  );
  if (uniqueGoals.size > 1) return rejected('ambiguous-identity');

  if (input.rawArtifactRef) {
    const digest = readString(input.rawArtifactRef.digest);
    const expiresAt = readString(input.rawArtifactRef.expiresAt);
    const accessPolicy = readString(input.rawArtifactRef.accessPolicy);
    if (!digest || !expiresAt || !accessPolicy) return rejected('raw-artifact-forbidden');
    try {
      authorizeRawArtifact({ approved: accessPolicy === 'restricted-raw', role: 'adapter' });
    } catch {
      return rejected('raw-artifact-forbidden');
    }
  }

  if (input.materialization === 'replay') {
    try {
      authorizeReplay(input.replayAuthorization ?? {
        scope: '',
        purpose: '',
        ticket: '',
        elevatedUntil: new Date(0),
        dualControl: false,
        role: 'fact-consumer',
      });
    } catch {
      return rejected('replay-unauthorized');
    }
  }

  const official = input.officialArenaResult;
  const normalizedValue = typeof input.normalizedValue === 'number' ? input.normalizedValue : null;
  const conflict = Boolean(
    official
    && typeof official.score === 'number'
    && normalizedValue != null
    && official.score !== normalizedValue,
  );
  const confidence = typeof input.confidence === 'number' ? input.confidence : null;
  const mappingWithoutDigests: Omit<NormalizedCourseEvidenceMapping, 'inputDigest' | 'trustedSetDigest'> = {
    goalId: CONTROL_CORRECTION_GOAL_ID,
    pluginId: CONTROL_CORRECTION_PERSONALIZATION_PLUGIN_ID,
    pluginVersion: CONTROL_CORRECTION_PERSONALIZATION_PLUGIN_VERSION,
    adapterId: CONTROL_CORRECTION_LEARNING_RECORD_ADAPTER_ID,
    adapterVersion: CONTROL_CORRECTION_LEARNING_RECORD_ADAPTER_VERSION,
    schemaVersion: CONTROL_CORRECTION_ADAPTER_SCHEMA_VERSION,
    captureRevision,
    releaseRevision: CONTROL_CORRECTION_ADAPTER_RELEASE_REVISION,
    canonicalLessonId: lessonId ?? undefined,
    canonicalResourceId: resourceId ?? undefined,
    canonicalActivityId: activityId ?? arenaTaskId ?? undefined,
    arenaReference: arenaTaskId
      ? {
          taskId: arenaTaskId,
          submissionId: readString(input.arenaReference?.submissionId) ?? undefined,
        }
      : undefined,
    contributionKind: 'auxiliary-learning-evidence',
    cannotOverrideOfficial: true,
    sourceEventId: input.sourceEventId,
    sourceLogId: readString(input.sourceLogId) ?? undefined,
    revision: CONTROL_CORRECTION_ADAPTER_RELEASE_REVISION,
    decoderVersion: LEARNING_RECORD_DECODER_VERSION,
    materializerVersion: LEARNING_RECORD_MATERIALIZER_VERSION,
    normalizedValue,
    confidence,
    quality: qualityFrom(confidence),
    coverage: matched >= 2 ? 'sufficient' : 'partial',
    trustedOccurredAt: input.trustedOccurredAt,
    receivedAt: input.receivedAt,
    reportedClientAt: readString(input.reportedClientAt) ?? undefined,
    subjectRef: input.subjectRef || opaqueSubjectRef(input.sourceEventId),
    scopeRef: readString(input.scopeRef) ?? undefined,
    idempotencyKey: input.idempotencyKey,
    materialization: input.materialization,
    officialAuthority: {
      owner: 'arena-submission-result',
      score: official?.score ?? null,
      valid: official?.valid ?? null,
      submissionId: official?.submissionId ?? null,
      conflict,
    },
    rawArtifactRef: input.rawArtifactRef
      ? {
          digest: input.rawArtifactRef.digest,
          expiresAt: input.rawArtifactRef.expiresAt,
          accessPolicy: input.rawArtifactRef.accessPolicy,
        }
      : undefined,
  };
  const { materialization: _materialization, ...digestSource } = mappingWithoutDigests;
  const inputDigest = sha256Canonical(digestSource);
  const trustedSetDigest = sha256Canonical({
    trustedOccurredAt: mappingWithoutDigests.trustedOccurredAt,
    receivedAt: mappingWithoutDigests.receivedAt,
    subjectRef: mappingWithoutDigests.subjectRef,
    sourceEventId: mappingWithoutDigests.sourceEventId,
    captureRevision: mappingWithoutDigests.captureRevision,
  });

  return {
    status: 'mapped',
    mapping: {
      ...mappingWithoutDigests,
      inputDigest,
      trustedSetDigest,
    },
  };
}

export function projectControlCorrectionPersonalization(
  mapping: NormalizedCourseEvidenceMapping,
): PersonalizationAdapterProjection {
  return {
    goalId: mapping.goalId,
    pluginId: mapping.pluginId,
    pluginVersion: mapping.pluginVersion,
    quality: mapping.quality,
    coverage: mapping.coverage,
    provenance: {
      adapterId: mapping.adapterId,
      adapterVersion: mapping.adapterVersion,
      captureRevision: mapping.captureRevision,
      sourceEventId: mapping.sourceEventId,
      officialAuthority: 'arena-submission-result',
    },
  };
}

export function createControlCorrectionLearningRecordAdapter(): CourseLearningRecordAdapter {
  return {
    adapterId: CONTROL_CORRECTION_LEARNING_RECORD_ADAPTER_ID,
    adapterVersion: CONTROL_CORRECTION_LEARNING_RECORD_ADAPTER_VERSION,
    schemaVersion: CONTROL_CORRECTION_ADAPTER_SCHEMA_VERSION,
    releaseRevision: CONTROL_CORRECTION_ADAPTER_RELEASE_REVISION,
    map: mapControlCorrectionLearningRecord,
    projectPersonalization: projectControlCorrectionPersonalization,
  };
}
