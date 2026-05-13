import { describe, expect, it } from 'vitest';

import {
  createStableTeacherSyncSignature,
  resolveDemoStepSyncUpdate,
  shouldPollSessionStatus,
} from '../session-framework/use-session-progress-channel';
import { shouldRunHiddenAwarePoll } from '../session-framework/polling-visibility';

describe('resolveDemoStepSyncUpdate', () => {
  it('skips resetting demo progress when the route inputs are unchanged', () => {
    const firstSync = resolveDemoStepSyncUpdate({
      stepIds: ['intro', 'analysis', 'summary'],
      demoStepId: null,
      previousSyncKey: null,
    });

    expect(firstSync).toEqual({
      nextIndex: 0,
      syncKey: 'intro::analysis::summary::',
    });

    const repeatedSync = resolveDemoStepSyncUpdate({
      stepIds: ['intro', 'analysis', 'summary'],
      demoStepId: null,
      previousSyncKey: firstSync?.syncKey ?? null,
    });

    expect(repeatedSync).toBeNull();
  });

  it('recomputes the demo index when the requested route step changes', () => {
    const firstSync = resolveDemoStepSyncUpdate({
      stepIds: ['intro', 'analysis', 'summary'],
      demoStepId: null,
      previousSyncKey: null,
    });

    const nextSync = resolveDemoStepSyncUpdate({
      stepIds: ['intro', 'analysis', 'summary'],
      demoStepId: 'summary',
      previousSyncKey: firstSync?.syncKey ?? null,
    });

    expect(nextSync).toEqual({
      nextIndex: 2,
      syncKey: 'intro::analysis::summary::summary',
    });
  });

  it('throttles hidden document polling but allows periodic recovery checks', () => {
    Object.defineProperty(globalThis, 'document', {
      value: { visibilityState: 'hidden' },
      configurable: true,
    });

    const firstPoll = shouldRunHiddenAwarePoll({
      now: 10_000,
      lastHiddenPollAt: 0,
      hiddenPollIntervalMs: 30_000,
    });
    expect(firstPoll).toEqual({
      shouldRun: true,
      lastHiddenPollAt: 10_000,
    });

    const skippedPoll = shouldRunHiddenAwarePoll({
      now: 20_000,
      lastHiddenPollAt: firstPoll.lastHiddenPollAt,
      hiddenPollIntervalMs: 30_000,
    });
    expect(skippedPoll.shouldRun).toBe(false);
    expect(skippedPoll.lastHiddenPollAt).toBe(10_000);

    const recoveryPoll = shouldRunHiddenAwarePoll({
      now: 41_000,
      lastHiddenPollAt: skippedPoll.lastHiddenPollAt,
      hiddenPollIntervalMs: 30_000,
    });
    expect(recoveryPoll).toEqual({
      shouldRun: true,
      lastHiddenPollAt: 41_000,
    });
  });

  it('stops classroom progress polling once the session is finished', () => {
    expect(shouldPollSessionStatus(null)).toBe(true);
    expect(shouldPollSessionStatus('ACTIVE')).toBe(true);
    expect(shouldPollSessionStatus('PAUSED')).toBe(true);
    expect(shouldPollSessionStatus('FINISHED')).toBe(false);
  });

  it('builds stable teacher sync signatures while ignoring volatile timestamps', () => {
    expect(createStableTeacherSyncSignature({
      kind: 'teacher_sync',
      activeStepId: 'step-04',
      updatedAt: 1_776_307_900_000,
      revealedAnswers: {
        'step-04': true,
      },
    })).toBe(createStableTeacherSyncSignature({
      revealedAnswers: {
        'step-04': true,
      },
      activeStepId: 'step-04',
      kind: 'teacher_sync',
      updatedAt: 1_776_307_950_000,
    }));

    expect(createStableTeacherSyncSignature({
      kind: 'teacher_sync',
      activeStepId: 'step-05',
      revealedAnswers: {
        'step-04': true,
      },
      updatedAt: 1_776_307_950_000,
    })).not.toBe(createStableTeacherSyncSignature({
      kind: 'teacher_sync',
      activeStepId: 'step-04',
      revealedAnswers: {
        'step-04': true,
      },
      updatedAt: 1_776_307_950_000,
    }));
  });
});
