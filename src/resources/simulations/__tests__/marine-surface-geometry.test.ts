import { it, expect } from 'vitest';
import { createMarineSurfaceGeometry } from '../scene/water/marine-surface-geometry';

it('covers the surface once and stitches every interior coarse/fine edge', () => {
  const geometry = createMarineSurfaceGeometry(2048, 128);
  const position = geometry.getAttribute('position'), index = geometry.index!;
  const edges = new Map<string, { a: number; b: number; count: number }>();
  let area = 0;
  for (let i = 0; i < index.count; i += 3) {
    const a = index.getX(i), b = index.getX(i + 1), c = index.getX(i + 2);
    const signed = ((position.getZ(b) - position.getZ(a)) * (position.getX(c) - position.getX(a))
      - (position.getX(b) - position.getX(a)) * (position.getZ(c) - position.getZ(a))) / 2;
    expect(signed).toBeGreaterThan(0); area += signed;
    for (const [x, y] of [[a, b], [b, c], [c, a]]) {
      const key = Math.min(x, y) + ':' + Math.max(x, y);
      const old = edges.get(key); if (old) old.count++; else edges.set(key, { a: x, b: y, count: 1 });
    }
  }
  expect(area).toBe(2048 * 2048);
  for (const { a, b, count } of edges.values()) {
    if (count === 2) continue;
    const outer = (Math.abs(position.getX(a)) === 1024 && position.getX(a) === position.getX(b))
      || (Math.abs(position.getZ(a)) === 1024 && position.getZ(a) === position.getZ(b));
    expect(outer).toBe(true); expect(count).toBe(1);
  }
  geometry.dispose();
});
