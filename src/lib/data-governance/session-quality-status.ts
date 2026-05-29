import type { SubmissionEvidenceQualityCounts } from './submission-evidence-quality';

export type SessionQualityStatus = 'green' | 'yellow' | 'red';
export type SessionQualitySyncSeverity = 'none' | 'low' | 'medium' | 'high';

export type SessionQualityReason =
  | 'healthy_quality_gate'
  | 'no_durable_submissions'
  | 'legacy_or_missing_ratio_high'
  | 'report_missing_or_stale'
  | 'unresolved_high_sync_incident'
  | 'sync_affected_user_ratio_high'
  | 'usable_evidence_ratio_partial'
  | 'legacy_or_missing_ratio_warning'
  | 'durable_submission_coverage_partial'
  | 'snapshot_coverage_partial'
  | 'post_class_update_window_partial'
  | 'feature_cache_stale'
  | 'snapshot_partially_missing'
  | 'medium_sync_incident'
  | 'session_not_finished';

export interface ComputeSessionQualityStatusInput {
  participants: number;
  durableSubmittedParticipants: number;
  durableSubmissions: number;
  evidenceQualityCounts: SubmissionEvidenceQualityCounts;
  reportFresh: boolean;
  snapshotFresh: boolean;
  snapshotCoverageFresh?: boolean;
  postClassUpdateWindowFresh?: boolean;
  featureCacheFresh?: boolean;
  syncSeverity: SessionQualitySyncSeverity;
  unresolvedSyncIncidents: number;
  syncAffectedUsers: number;
  finalized?: boolean;
}

export interface SessionQualityDecision {
  status: SessionQualityStatus;
  reasons: SessionQualityReason[];
  metrics: {
    participants: number;
    durableSubmissionCoverage: number;
    richEvidenceRatio: number;
    partialEvidenceRatio: number;
    richOrPartialEvidenceRatio: number;
    legacyOrMissingRatio: number;
    reportFresh: boolean;
    snapshotFresh: boolean;
    snapshotCoverageFresh: boolean;
    postClassUpdateWindowFresh: boolean;
    featureCacheFresh: boolean;
    syncSeverity: SessionQualitySyncSeverity;
    unresolvedSyncIncidents: number;
    syncAffectedUsers: number;
    syncAffectedUserRatio: number;
  };
}

const GREEN_USABLE_EVIDENCE_RATIO = 0.9;
const GREEN_LEGACY_OR_MISSING_RATIO = 0.1;
const YELLOW_USABLE_EVIDENCE_RATIO = 0.6;
const RED_LEGACY_OR_MISSING_RATIO = 0.4;
const GREEN_DURABLE_SUBMISSION_COVERAGE = 0.9;
const RED_SYNC_AFFECTED_USER_RATIO = 0.3;

function ratio(numerator: number, denominator: number) {
  return denominator > 0 ? numerator / denominator : 0;
}

export function resolveSessionQualitySyncSeverity(
  distribution: Record<'low' | 'medium' | 'high', number>,
): SessionQualitySyncSeverity {
  if (distribution.high > 0) return 'high';
  if (distribution.medium > 0) return 'medium';
  if (distribution.low > 0) return 'low';
  return 'none';
}

export function computeSessionQualityStatus(
  input: ComputeSessionQualityStatusInput,
): SessionQualityDecision {
  const participants = Math.max(0, input.participants);
  const durableSubmissions = Math.max(0, input.durableSubmissions);
  const durableSubmittedParticipants = Math.max(0, input.durableSubmittedParticipants);
  const richEvidenceRatio = ratio(input.evidenceQualityCounts.rich, durableSubmissions);
  const partialEvidenceRatio = ratio(input.evidenceQualityCounts.partial, durableSubmissions);
  const richOrPartialEvidenceRatio = ratio(
    input.evidenceQualityCounts.rich + input.evidenceQualityCounts.partial,
    durableSubmissions,
  );
  const legacyOrMissingRatio = durableSubmissions > 0
    ? ratio(input.evidenceQualityCounts.legacy + input.evidenceQualityCounts.missing, durableSubmissions)
    : 1;
  const durableSubmissionCoverage = ratio(durableSubmittedParticipants, participants);
  const syncAffectedUserRatio = ratio(input.syncAffectedUsers, participants);
  const unresolvedSyncIncidents = Math.max(0, input.unresolvedSyncIncidents);
  const snapshotCoverageFresh = input.snapshotCoverageFresh ?? input.snapshotFresh;
  const postClassUpdateWindowFresh = input.postClassUpdateWindowFresh ?? true;
  const featureCacheFresh = input.featureCacheFresh ?? true;

  const metrics: SessionQualityDecision['metrics'] = {
    participants,
    durableSubmissionCoverage,
    richEvidenceRatio,
    partialEvidenceRatio,
    richOrPartialEvidenceRatio,
    legacyOrMissingRatio,
    reportFresh: input.reportFresh,
    snapshotFresh: snapshotCoverageFresh,
    snapshotCoverageFresh,
    postClassUpdateWindowFresh,
    featureCacheFresh,
    syncSeverity: input.syncSeverity,
    unresolvedSyncIncidents,
    syncAffectedUsers: Math.max(0, input.syncAffectedUsers),
    syncAffectedUserRatio,
  };

  if (input.finalized === false) {
    return {
      status: 'yellow',
      reasons: ['session_not_finished'],
      metrics,
    };
  }

  const redReasons: SessionQualityReason[] = [];
  if (durableSubmissions === 0) redReasons.push('no_durable_submissions');
  if (durableSubmissions > 0 && legacyOrMissingRatio > RED_LEGACY_OR_MISSING_RATIO) {
    redReasons.push('legacy_or_missing_ratio_high');
  }
  if (!input.reportFresh) redReasons.push('report_missing_or_stale');
  if (input.syncSeverity === 'high' && unresolvedSyncIncidents > 0) {
    redReasons.push('unresolved_high_sync_incident');
  }
  if (syncAffectedUserRatio > RED_SYNC_AFFECTED_USER_RATIO) {
    redReasons.push('sync_affected_user_ratio_high');
  }

  if (redReasons.length > 0) {
    return {
      status: 'red',
      reasons: redReasons,
      metrics,
    };
  }

  const yellowReasons: SessionQualityReason[] = [];
  if (
    richOrPartialEvidenceRatio >= YELLOW_USABLE_EVIDENCE_RATIO
    && richOrPartialEvidenceRatio < GREEN_USABLE_EVIDENCE_RATIO
  ) {
    yellowReasons.push('usable_evidence_ratio_partial');
  }
  if (
    legacyOrMissingRatio > GREEN_LEGACY_OR_MISSING_RATIO
    && legacyOrMissingRatio <= RED_LEGACY_OR_MISSING_RATIO
  ) {
    yellowReasons.push('legacy_or_missing_ratio_warning');
  }
  if (durableSubmissionCoverage < GREEN_DURABLE_SUBMISSION_COVERAGE) {
    yellowReasons.push('durable_submission_coverage_partial');
  }
  if (!snapshotCoverageFresh) yellowReasons.push('snapshot_coverage_partial');
  if (!postClassUpdateWindowFresh) yellowReasons.push('post_class_update_window_partial');
  if (!featureCacheFresh) yellowReasons.push('feature_cache_stale');
  if (input.syncSeverity === 'medium') yellowReasons.push('medium_sync_incident');

  if (yellowReasons.length > 0) {
    return {
      status: 'yellow',
      reasons: yellowReasons,
      metrics,
    };
  }

  return {
    status: 'green',
    reasons: ['healthy_quality_gate'],
    metrics,
  };
}
