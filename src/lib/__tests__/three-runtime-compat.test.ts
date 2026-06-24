import { describe, expect, it, vi } from 'vitest';

import { Clock, PCFShadowMap, PCFSoftShadowMap } from '../three-runtime-compat';

describe('three-runtime-compat', () => {
  it('preserves Three shadow-map constants while replacing deprecated Clock construction', () => {
    expect(PCFSoftShadowMap).not.toBe(PCFShadowMap);

    const now = vi.spyOn(performance, 'now');
    now.mockReturnValueOnce(1000);
    const clock = new Clock();

    expect(clock.getDelta()).toBe(0);
    expect(clock.running).toBe(true);

    now.mockReturnValueOnce(1250);
    expect(clock.getDelta()).toBeCloseTo(0.25);

    now.mockRestore();
  });
});
