import type { NormalizedCourseEvidenceMapping } from '@/features/personalization/plugins/learning-record-adapter-types';

export function toPersistedAdapterEnvelope(mapping: NormalizedCourseEvidenceMapping) {
  return {
    adapterId: mapping.adapterId,
    adapterVersion: mapping.adapterVersion,
    schemaVersion: mapping.schemaVersion,
    pluginId: mapping.pluginId,
    pluginVersion: mapping.pluginVersion,
    releaseRevision: mapping.releaseRevision,
    captureRevision: mapping.captureRevision,
    revision: mapping.revision,
    decoderVersion: mapping.decoderVersion,
    materializerVersion: mapping.materializerVersion,
    inputDigest: mapping.inputDigest,
    trustedSetDigest: mapping.trustedSetDigest,
    sourceEventId: mapping.sourceEventId,
    sourceLogId: mapping.sourceLogId ?? null,
    canonicalLessonId: mapping.canonicalLessonId ?? null,
    canonicalActivityId: mapping.canonicalActivityId ?? null,
    canonicalResourceId: mapping.canonicalResourceId ?? null,
    contributionKind: mapping.contributionKind,
    cannotOverrideOfficial: mapping.cannotOverrideOfficial,
    officialAuthority: mapping.officialAuthority,
    quality: mapping.quality,
    coverage: mapping.coverage,
    normalizedValue: mapping.normalizedValue,
    confidence: mapping.confidence,
  };
}
