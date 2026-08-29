import {
  PROJECTION_STATUS,
  type ProjectionStatus,
} from '@/features/learning-record/projections/types';
import type { CumulativePortraitReadModel } from '@/lib/data-governance/cumulative-portrait-read-model';

export function mapPortraitStatus(portrait: CumulativePortraitReadModel): {
  status: ProjectionStatus;
  reason: string | null;
  knownZero: boolean;
} {
  if (portrait.stateKind === 'NO_EVIDENCE') {
    return {
      status: PROJECTION_STATUS.partial,
      reason: portrait.availabilityReason,
      knownZero: true,
    };
  }
  if (portrait.availabilityReason === 'current-state-version-mismatch') {
    return {
      status: PROJECTION_STATUS.conflict,
      reason: portrait.availabilityReason,
      knownZero: false,
    };
  }
  if (
    portrait.availabilityReason === 'reconciliation-pending'
    || portrait.availabilityReason === 'migration-in-progress'
  ) {
    return {
      status: PROJECTION_STATUS.stale,
      reason: portrait.availabilityReason,
      knownZero: false,
    };
  }
  if (portrait.stateKind === 'SNAPSHOT' && portrait.availabilityReason === 'available') {
    return {
      status: PROJECTION_STATUS.qualified,
      reason: null,
      knownZero: false,
    };
  }
  return {
    status: PROJECTION_STATUS.unavailable,
    reason: portrait.availabilityReason,
    knownZero: false,
  };
}

export function isNewerGovernedFact(evidenceAsOf: string | null, latestFactAt: string | null): boolean {
  if (!evidenceAsOf || !latestFactAt) return false;
  return Date.parse(latestFactAt) > Date.parse(evidenceAsOf);
}

export function isAuthoritativeConsumerRead(input: {
  status: ProjectionStatus;
  knownZero: boolean;
}): boolean {
  return input.status === PROJECTION_STATUS.qualified && !input.knownZero;
}
