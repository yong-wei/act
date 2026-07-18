import { describe, expect, it } from 'vitest';

import {
  calculateWheelRadiusOffset,
  shouldResetPresetOffset,
} from '../components/camera-controller';

describe('UnifiedCameraController preset zoom helpers', () => {
  it('stores the current OrbitControls radius as a preset-relative offset', () => {
    expect(calculateWheelRadiusOffset(300, 420, 100, 600)).toBe(120);
    expect(calculateWheelRadiusOffset(300, 180, 100, 600)).toBe(-120);
  });

  it('respects OrbitControls distance bounds and the controller safety minimum', () => {
    expect(calculateWheelRadiusOffset(300, 50, 100, 600)).toBe(-200);
    expect(calculateWheelRadiusOffset(300, 900, 100, 600)).toBe(300);
    expect(calculateWheelRadiusOffset(100, 1, 0, Number.POSITIVE_INFINITY)).toBe(-80);
  });

  it('only resets a preset offset when returning from free mode', () => {
    expect(shouldResetPresetOffset('free', 'chase')).toBe(true);
    expect(shouldResetPresetOffset('chase', 'overhead')).toBe(false);
    expect(shouldResetPresetOffset('tactical', 'free')).toBe(false);
  });
});
