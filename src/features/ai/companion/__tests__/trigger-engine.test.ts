import { describe, expect, it } from 'vitest';

import {
  DEFAULT_COMPANION_TRIGGER_CONFIG,
  confirmPauseCandidate,
  deliveryLeaseKey,
  eventPriority,
  isCoolingDown,
  isExpired,
  pauseSignalsEligible,
  pickDeliverable,
  type CompanionEventRecord,
  type CompanionPauseSignals,
} from '@/features/ai/companion/trigger-engine';

const T0 = new Date('2026-09-04T10:00:00Z');
const T_PLUS = (ms: number) => new Date(T0.getTime() + ms);

function candidate(overrides: Partial<CompanionEventRecord> = {}): CompanionEventRecord {
  return {
    id: 'event-1',
    userId: 'student-1',
    pageKind: 'resource-textbook',
    pageRef: 'resource-9',
    eventType: 'pause-candidate',
    status: 'candidate',
    createdAt: T0,
    confirmedAt: null,
    expiresAt: T_PLUS(10 * 60_000),
    ...overrides,
  };
}

const eligibleSignals: CompanionPauseSignals = {
  visible: true,
  focused: true,
  mediaPlaying: false,
  recentActionCount: 0,
};

describe('pauseSignalsEligible', () => {
  it('accepts visible focused idle page without media', () => {
    expect(pauseSignalsEligible(eligibleSignals)).toBe(true);
  });

  it.each([
    ['media playing', { ...eligibleSignals, mediaPlaying: true }],
    ['page hidden', { ...eligibleSignals, visible: false }],
    ['window unfocused', { ...eligibleSignals, focused: false }],
    ['interrupting actions', { ...eligibleSignals, recentActionCount: 1 }],
  ])('rejects %s', (_label, signals) => {
    expect(pauseSignalsEligible(signals)).toBe(false);
  });
});

describe('confirmPauseCandidate（两阶段停顿确认）', () => {
  it('confirms when signals still hold inside the window', () => {
    const result = confirmPauseCandidate(candidate(), eligibleSignals, T_PLUS(20_000));
    expect(result.decision).toBe('confirmed');
  });

  it('expires a candidate beyond the confirmation window (left and returned)', () => {
    const result = confirmPauseCandidate(candidate(), eligibleSignals, T_PLUS(60_000));
    expect(result.decision).toBe('expired');
  });

  it('suppresses when media started or actions interrupted during the window', () => {
    const playing = confirmPauseCandidate(candidate(), { ...eligibleSignals, mediaPlaying: true }, T_PLUS(20_000));
    expect(playing.decision).toBe('suppressed');
    const interrupted = confirmPauseCandidate(candidate(), { ...eligibleSignals, recentActionCount: 2 }, T_PLUS(20_000));
    expect(interrupted.decision).toBe('suppressed');
  });

  it('never confirms a non-candidate event', () => {
    const result = confirmPauseCandidate(candidate({ status: 'delivered' }), eligibleSignals, T_PLUS(20_000));
    expect(result.decision).toBe('suppressed');
  });
});

describe('cooldown and expiry', () => {
  it('cools down same-type events within the window and releases after it', () => {
    const previous = { eventType: 'wrong-answer' as const, createdAt: T0 };
    expect(isCoolingDown(previous, T_PLUS(5 * 60_000))).toBe(true);
    expect(isCoolingDown(previous, T_PLUS(DEFAULT_COMPANION_TRIGGER_CONFIG.cooldownMs + 1_000))).toBe(false);
  });

  it('has no cooldown without a previous event', () => {
    expect(isCoolingDown(null, T0)).toBe(false);
  });

  it('marks events expired past expiresAt', () => {
    expect(isExpired({ expiresAt: T_PLUS(1_000) }, T_PLUS(2_000))).toBe(true);
    expect(isExpired({ expiresAt: T_PLUS(1_000) }, T0)).toBe(false);
  });
});

describe('priority and delivery', () => {
  it('prioritizes wrong-answer over pause-candidate and older events on ties', () => {
    const pauseOld = candidate({ id: 'pause-old', eventType: 'pause-candidate', status: 'confirmed' });
    const pauseNew = candidate({ id: 'pause-new', eventType: 'pause-candidate', status: 'confirmed', createdAt: T_PLUS(1_000) });
    const wrong = candidate({ id: 'wrong', eventType: 'wrong-answer', status: 'confirmed', createdAt: T_PLUS(2_000) });
    expect(pickDeliverable([pauseNew, wrong, pauseOld])?.id).toBe('wrong');
    expect(pickDeliverable([pauseNew, pauseOld])?.id).toBe('pause-old');
    expect(eventPriority('wrong-answer')).toBeGreaterThan(eventPriority('pause-candidate'));
  });

  it('returns null without confirmed events and ignores other statuses', () => {
    expect(pickDeliverable([])).toBeNull();
    expect(pickDeliverable([candidate({ status: 'candidate' })])).toBeNull();
    expect(pickDeliverable([candidate({ status: 'expired' })])).toBeNull();
  });
});

describe('deliveryLeaseKey', () => {
  it('scopes the lease key per student and event', () => {
    expect(deliveryLeaseKey('student-1', 'event-1')).toBe('konling-companion:student-1:event-1');
  });
});
