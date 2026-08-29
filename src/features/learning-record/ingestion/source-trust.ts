import type { SourceTrustClass } from '@/features/learning-record/event-contract/types';
import { stableEventOrder } from '@/features/learning-record/event-contract/digest';
import type { LearningRecordEnvelope } from '@/features/learning-record/event-contract';

export interface SourceTrustPolicy {
  trustClass: SourceTrustClass;
  clockSkewMs: number;
  lateInputPolicy: 'accept' | 'reject';
  lateWindowMs: number;
}

export const SOURCE_TRUST_POLICIES: Record<SourceTrustClass, SourceTrustPolicy> = {
  'server-authoritative': {
    trustClass: 'server-authoritative',
    clockSkewMs: 0,
    lateInputPolicy: 'accept',
    lateWindowMs: 7 * 24 * 60 * 60 * 1000,
  },
  'web-untrusted-client-time': {
    trustClass: 'web-untrusted-client-time',
    clockSkewMs: 5 * 60 * 1000,
    lateInputPolicy: 'accept',
    lateWindowMs: 24 * 60 * 60 * 1000,
  },
  'outbox-authoritative': {
    trustClass: 'outbox-authoritative',
    clockSkewMs: 60 * 1000,
    lateInputPolicy: 'accept',
    lateWindowMs: 7 * 24 * 60 * 60 * 1000,
  },
  'legacy-compat': {
    trustClass: 'legacy-compat',
    clockSkewMs: 24 * 60 * 60 * 1000,
    lateInputPolicy: 'accept',
    lateWindowMs: 7 * 24 * 60 * 60 * 1000,
  },
};

export function evaluateSourceTimes(input: {
  trustClass: SourceTrustClass;
  receivedAt: Date;
  reportedClientAt?: Date | null;
  trustedOccurredAt: Date;
}): { clockSkew: boolean; late: boolean; rejected: 'clock-skew' | 'late-input' | null } {
  const policy = SOURCE_TRUST_POLICIES[input.trustClass];
  if (input.reportedClientAt) {
    const delta = Math.abs(input.reportedClientAt.getTime() - input.receivedAt.getTime());
    if (delta > policy.clockSkewMs) {
      return { clockSkew: true, late: false, rejected: 'clock-skew' };
    }
  }
  const age = input.receivedAt.getTime() - input.trustedOccurredAt.getTime();
  if (age > policy.lateWindowMs) {
    return {
      clockSkew: false,
      late: true,
      rejected: policy.lateInputPolicy === 'reject' ? 'late-input' : null,
    };
  }
  return { clockSkew: false, late: age > 60_000, rejected: null };
}

export function orderEnvelopes(events: LearningRecordEnvelope[]): LearningRecordEnvelope[] {
  return stableEventOrder(events);
}
