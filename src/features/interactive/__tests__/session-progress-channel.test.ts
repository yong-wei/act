import { describe, expect, it } from 'vitest';

import { getStepIdsSyncKey, parseStepIdsSyncKey } from '../session-framework/use-session-progress-channel';

describe('session progress step id stability', () => {
  it('keeps the same sync key for equivalent step id arrays', () => {
    const first = ['step-01', 'step-02', 'step-03'];
    const second = ['step-01', 'step-02', 'step-03'];

    expect(first).not.toBe(second);
    expect(getStepIdsSyncKey(first)).toBe(getStepIdsSyncKey(second));
    expect(parseStepIdsSyncKey(getStepIdsSyncKey(second))).toEqual(first);
  });
});
