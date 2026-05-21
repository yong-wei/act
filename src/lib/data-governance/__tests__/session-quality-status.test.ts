import { describe, expect, it } from 'vitest';

import { computeSessionQualityStatus } from '../session-quality-status';

describe('computeSessionQualityStatus', () => {
  it('marks a healthy rich-evidence session as green', () => {
    const decision = computeSessionQualityStatus({
      participants: 10,
      durableSubmittedParticipants: 10,
      durableSubmissions: 10,
      evidenceQualityCounts: {
        rich: 9,
        partial: 1,
        legacy: 0,
        missing: 0,
      },
      reportFresh: true,
      snapshotFresh: true,
      syncSeverity: 'none',
      unresolvedSyncIncidents: 0,
      syncAffectedUsers: 0,
    });

    expect(decision).toMatchObject({
      status: 'green',
      reasons: ['healthy_quality_gate'],
      metrics: {
        participants: 10,
        durableSubmissionCoverage: 1,
        richEvidenceRatio: 0.9,
        richOrPartialEvidenceRatio: 1,
        legacyOrMissingRatio: 0,
        reportFresh: true,
        snapshotFresh: true,
        syncSeverity: 'none',
        unresolvedSyncIncidents: 0,
      },
    });
  });

  it('marks unfinished sessions as pending yellow instead of final red', () => {
    const decision = computeSessionQualityStatus({
      participants: 5,
      durableSubmittedParticipants: 0,
      durableSubmissions: 0,
      evidenceQualityCounts: {
        rich: 0,
        partial: 0,
        legacy: 0,
        missing: 0,
      },
      reportFresh: false,
      snapshotFresh: false,
      syncSeverity: 'none',
      unresolvedSyncIncidents: 0,
      syncAffectedUsers: 0,
      finalized: false,
    });

    expect(decision).toMatchObject({
      status: 'yellow',
      reasons: ['session_not_finished'],
      metrics: {
        participants: 5,
        durableSubmissionCoverage: 0,
        reportFresh: false,
        snapshotFresh: false,
      },
    });
  });

  it('marks partial evidence and missing snapshots as yellow', () => {
    const decision = computeSessionQualityStatus({
      participants: 10,
      durableSubmittedParticipants: 8,
      durableSubmissions: 10,
      evidenceQualityCounts: {
        rich: 3,
        partial: 5,
        legacy: 2,
        missing: 0,
      },
      reportFresh: true,
      snapshotFresh: false,
      syncSeverity: 'medium',
      unresolvedSyncIncidents: 1,
      syncAffectedUsers: 1,
    });

    expect(decision.status).toBe('yellow');
    expect(decision.reasons).toEqual([
      'usable_evidence_ratio_partial',
      'legacy_or_missing_ratio_warning',
      'durable_submission_coverage_partial',
      'snapshot_partially_missing',
      'medium_sync_incident',
    ]);
    expect(decision.metrics).toMatchObject({
      durableSubmissionCoverage: 0.8,
      richEvidenceRatio: 0.3,
      richOrPartialEvidenceRatio: 0.8,
      legacyOrMissingRatio: 0.2,
      syncSeverity: 'medium',
      unresolvedSyncIncidents: 1,
    });
  });

  it('marks weak legacy evidence and unresolved high severity sync incidents as red', () => {
    const decision = computeSessionQualityStatus({
      participants: 10,
      durableSubmittedParticipants: 4,
      durableSubmissions: 10,
      evidenceQualityCounts: {
        rich: 1,
        partial: 2,
        legacy: 5,
        missing: 2,
      },
      reportFresh: true,
      snapshotFresh: true,
      syncSeverity: 'high',
      unresolvedSyncIncidents: 1,
      syncAffectedUsers: 4,
    });

    expect(decision.status).toBe('red');
    expect(decision.reasons).toEqual([
      'legacy_or_missing_ratio_high',
      'unresolved_high_sync_incident',
      'sync_affected_user_ratio_high',
    ]);
    expect(decision.metrics).toMatchObject({
      richOrPartialEvidenceRatio: 0.3,
      legacyOrMissingRatio: 0.7,
      syncAffectedUserRatio: 0.4,
    });
  });

  it('marks sessions without durable submissions as red', () => {
    const decision = computeSessionQualityStatus({
      participants: 2,
      durableSubmittedParticipants: 0,
      durableSubmissions: 0,
      evidenceQualityCounts: {
        rich: 0,
        partial: 0,
        legacy: 0,
        missing: 0,
      },
      reportFresh: true,
      snapshotFresh: true,
      syncSeverity: 'none',
      unresolvedSyncIncidents: 0,
      syncAffectedUsers: 0,
    });

    expect(decision.status).toBe('red');
    expect(decision.reasons).toEqual(['no_durable_submissions']);
  });
});
