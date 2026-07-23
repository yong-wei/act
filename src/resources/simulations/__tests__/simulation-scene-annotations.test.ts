import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  appendTrailPoint,
  DEFAULT_TEACHING_ANNOTATIONS_VISIBLE,
  shouldRecordTrailPoint,
  TRAIL_POINT_CAP,
} from '../scene/annotations/annotation-logic';

describe('teaching annotation defaults', () => {
  it('keeps teaching annotations off by default while the path trail stays on', () => {
    expect(DEFAULT_TEACHING_ANNOTATIONS_VISIBLE).toBe(false);
  });
});

describe('actual path trail logic', () => {
  it('records points only after the sampling interval elapses', () => {
    expect(shouldRecordTrailPoint(10, 10.1, 0.25)).toBe(false);
    expect(shouldRecordTrailPoint(10, 10.3, 0.25)).toBe(true);
  });

  it('appends points and caps the buffer at the trail cap', () => {
    let points: Array<[number, number, number]> = [];
    for (let index = 0; index < TRAIL_POINT_CAP + 50; index += 1) {
      points = appendTrailPoint(points, [index, 0, 0]);
    }
    expect(points).toHaveLength(TRAIL_POINT_CAP);
    expect(points[points.length - 1][0]).toBe(TRAIL_POINT_CAP + 49);
    expect(points[0][0]).toBe(50);
  });
});

describe('sample experiment annotation wiring', () => {
  it('mounts the path trail unconditionally and gates the rest behind the toggle', () => {
    const destroyer = readFileSync(
      path.join(process.cwd(), 'src/resources/simulations/simulations/destroyer-simulation.tsx'), 'utf8'
    );
    expect(destroyer).toContain('<ActualPathTrail');
    expect(destroyer).toContain('TeachingAnnotationsToggle');
    expect(destroyer).toContain('showAnnotations');
    expect(destroyer).toContain('<TeachingAnnotations');
    expect(destroyer).not.toContain('function ShipTrail(');
  });

  it('keeps annotation styling in scene-coherent tokens instead of video styles', () => {
    const logic = readFileSync(
      path.join(process.cwd(), 'src/resources/simulations/scene/annotations/annotation-logic.ts'), 'utf8'
    );
    expect(logic).toContain('ANNOTATION_STYLE');
    expect(logic).not.toContain('#4ade80');
  });
});
