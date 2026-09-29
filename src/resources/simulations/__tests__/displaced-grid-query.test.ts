import { describe, expect, it } from 'vitest';
import { displacedGridHeightAt } from '../scene/water/displaced-grid-query';

describe('visible displaced grid query', () => {
  it('samples both triangles and negative periodic lattice coordinates after horizontal displacement', () => {
    const field = (x: number, z: number) => ({ height: 2 * x + 3 * z, displacementX: 3, displacementZ: -2 });
    for (const [x, z] of [[1, 1], [7, 6], [-3.5, -9.1], [0, 0]]) {
      expect(displacedGridHeightAt(x, z, 8, field)).toBeCloseTo(2 * (x - 3) + 3 * (z + 2), 9);
    }
  });

  it('uses the actual mesh diagonal instead of bilinear interpolation', () => {
    const field = (x: number, z: number) => ({ height: x * z, displacementX: 0, displacementZ: 0 });
    expect(displacedGridHeightAt(0.25, 0.25, 1, field)).toBe(0);
    expect(displacedGridHeightAt(0.75, 0.75, 1, field)).toBeCloseTo(0.5);
  });

  it('can be used unchanged as a standalone worker function', () => {
    const workerFunction = new Function('return (' + displacedGridHeightAt.toString() + ')')() as typeof displacedGridHeightAt;
    expect(workerFunction(12, -3, 8, (x, z) => ({ height: x + z, displacementX: 2, displacementZ: 1 }))).toBe(6);
  });
});
