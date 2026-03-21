import { describe, expect, it } from 'vitest';

import { resolveDemoStepSyncUpdate } from '../session-framework/use-session-progress-channel';

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
});
