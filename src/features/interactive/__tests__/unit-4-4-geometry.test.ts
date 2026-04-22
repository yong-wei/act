import { describe, expect, it } from 'vitest';

import {
  getUnit44GradientRevealState,
  getUnit44NearestParetoPointId,
  getUnit44ParetoPoint,
  getUnit44ParetoPlotPoint,
  getUnit44ProgressiveRevealVisibleCount,
} from '@/features/interactive/unit-4-4-fixed-structure-optimization-modeling/figure-data';

describe('unit 4-4 figure geometry helpers', () => {
  it('starts the gradient reveal chain from x_0 and only adds one point and one segment per reveal layer', () => {
    expect(getUnit44GradientRevealState(0)).toEqual({
      visiblePointCount: 1,
      visibleSegmentCount: 0,
      activePointIndex: 0,
    });

    expect(getUnit44GradientRevealState(1)).toEqual({
      visiblePointCount: 2,
      visibleSegmentCount: 1,
      activePointIndex: 1,
    });

    expect(getUnit44GradientRevealState(2)).toEqual({
      visiblePointCount: 3,
      visibleSegmentCount: 2,
      activePointIndex: 2,
    });
  });

  it('lets inline reveal counts drive the visible step count once browse is open', () => {
    expect(getUnit44ProgressiveRevealVisibleCount(0, 1, false, 3)).toBe(1);
    expect(getUnit44ProgressiveRevealVisibleCount(0, 2, true, 3)).toBe(2);
    expect(getUnit44ProgressiveRevealVisibleCount(0, 3, true, 3)).toBe(3);
    expect(getUnit44ProgressiveRevealVisibleCount(2, 1, true, 3)).toBe(3);
  });

  it('maps smaller E_u values to the left side of the Pareto plot while larger ITAE values stay higher', () => {
    const fastPoint = getUnit44ParetoPlotPoint(getUnit44ParetoPoint('pf-01'));
    const efficientPoint = getUnit44ParetoPlotPoint(getUnit44ParetoPoint('pf-09'));

    expect(efficientPoint.x).toBeLessThan(fastPoint.x);
    expect(efficientPoint.y).toBeLessThan(fastPoint.y);
  });

  it('snaps pointer picks to the nearest stored Pareto candidates in two-dimensional screen space', () => {
    const p1 = getUnit44ParetoPlotPoint(getUnit44ParetoPoint('pf-01'));
    const p2 = getUnit44ParetoPlotPoint(getUnit44ParetoPoint('pf-05'));
    const p3 = getUnit44ParetoPlotPoint(getUnit44ParetoPoint('pf-09'));

    expect(getUnit44NearestParetoPointId({ x: p1.x + 8, y: p1.y - 6 })).toBe('pf-01');
    expect(getUnit44NearestParetoPointId({ x: p2.x - 10, y: p2.y + 8 })).toBe('pf-05');
    expect(getUnit44NearestParetoPointId({ x: p3.x + 6, y: p3.y + 4 })).toBe('pf-09');
  });
});
