import { describe, expect, it } from 'vitest';

import {
  createKnowledgeGraphEdgePath,
  getKnowledgeGraphEndpointArrow,
  getKnowledgeGraphNodeBoundaryIntersection,
  isKnowledgeGraphPointInsideNodeBoundary,
  getKnowledgeGraphPathPoint,
  getKnowledgeGraphPathTangent,
} from '../graph/edge-geometry';
import { getKnowledgeGraphMotionMarkerPose } from '../graph/motion';

const radialBoundary = (presentationRadius: number) => ({
  shape: 'circle' as const,
  presentationRadius,
});

const expectPointCloseTo = (
  actual: { x: number; y: number; z: number },
  expected: { x: number; y: number; z: number },
) => {
  expect(actual.x).toBeCloseTo(expected.x, 10);
  expect(actual.y).toBeCloseTo(expected.y, 10);
  expect(actual.z).toBeCloseTo(expected.z, 10);
};

const expectFinitePoint = (point: { x: number; y: number; z: number }) => {
  expect(Number.isFinite(point.x)).toBe(true);
  expect(Number.isFinite(point.y)).toBe(true);
  expect(Number.isFinite(point.z)).toBe(true);
};

describe('shared knowledge graph edge geometry', () => {
  it.each([0.5, 1, 3])('classifies rendered shape boundaries with fixed screen tolerance at zoom %s', (zoom) => {
    const tolerance = 8 / zoom;
    const cases = [
      { boundary: { shape: 'circle' as const, presentationRadius: 10 }, inside: { x: 10 + tolerance - 0.01, y: 0 }, outside: { x: 10 + tolerance + 0.01, y: 0 } },
      { boundary: { shape: 'square' as const, presentationRadius: 10 }, inside: { x: 8 + tolerance - 0.01, y: 0 }, outside: { x: 8 + tolerance + 0.01, y: 0 } },
      { boundary: { shape: 'rectangle' as const, presentationRadius: 10, halfExtentRatios: { x: 0.8, y: 0.4 } }, inside: { x: 0, y: 4 + tolerance - 0.01 }, outside: { x: 0, y: 4 + tolerance + 0.01 } },
      { boundary: { shape: 'regular-hexagon' as const, presentationRadius: 10 }, inside: { x: 0, y: 12 + tolerance - 0.01 }, outside: { x: 0, y: 12 + tolerance + 0.01 } },
    ];
    cases.forEach(({ boundary, inside, outside }) => {
      expect(isKnowledgeGraphPointInsideNodeBoundary(inside, { x: 0, y: 0 }, boundary, tolerance)).toBe(true);
      expect(isKnowledgeGraphPointInsideNodeBoundary(outside, { x: 0, y: 0 }, boundary, tolerance)).toBe(false);
    });
  });

  it('intersects circular and spherical presentation boundaries at multiple angles', () => {
    expectPointCloseTo(
      getKnowledgeGraphNodeBoundaryIntersection(
        { x: 0, y: 0 },
        { x: 3, y: 4 },
        { shape: 'circle', presentationRadius: 2 },
      ),
      { x: 1.2, y: 1.6, z: 0 },
    );
    expectPointCloseTo(
      getKnowledgeGraphNodeBoundaryIntersection(
        { x: 0, y: 0, z: 0 },
        { x: 1, y: 2, z: 2 },
        { shape: 'sphere', presentationRadius: 10 },
      ),
      { x: 8 / 3, y: 16 / 3, z: 16 / 3 },
    );
  });

  it('intersects renderer-accurate square, rectangle, and regular hexagon boundaries', () => {
    expectPointCloseTo(
      getKnowledgeGraphNodeBoundaryIntersection(
        { x: 0, y: 0 },
        { x: 1, y: 1 },
        { shape: 'square', presentationRadius: 10 },
      ),
      { x: 8, y: 8, z: 0 },
    );
    expectPointCloseTo(
      getKnowledgeGraphNodeBoundaryIntersection(
        { x: 0, y: 0 },
        { x: 1, y: 1 },
        {
          shape: 'rectangle',
          presentationRadius: 10,
          halfExtentRatios: { x: 0.8, y: 0.4 },
        },
      ),
      { x: 4, y: 4, z: 0 },
    );

    const hexagonRadius = 12;
    expectPointCloseTo(
      getKnowledgeGraphNodeBoundaryIntersection(
        { x: 0, y: 0 },
        { x: 0, y: 1 },
        { shape: 'regular-hexagon', presentationRadius: 10 },
      ),
      { x: 0, y: hexagonRadius, z: 0 },
    );
    expectPointCloseTo(
      getKnowledgeGraphNodeBoundaryIntersection(
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { shape: 'regular-hexagon', presentationRadius: 10 },
      ),
      { x: hexagonRadius * Math.sqrt(3) / 2, y: 0, z: 0 },
    );
  });

  it('intersects renderer-accurate boxes and icosahedra at multiple angles', () => {
    expectPointCloseTo(
      getKnowledgeGraphNodeBoundaryIntersection(
        { x: 0, y: 0, z: 0 },
        { x: 2, y: 1, z: 0.5 },
        { shape: 'box', presentationRadius: 10 },
      ),
      { x: 7, y: 3.5, z: 1.75 },
    );

    const phi = (1 + Math.sqrt(5)) / 2;
    const vertexDirection = { x: -1, y: phi, z: 0 };
    const vertexIntersection = getKnowledgeGraphNodeBoundaryIntersection(
      { x: 0, y: 0, z: 0 },
      vertexDirection,
      { shape: 'icosahedron', presentationRadius: 10 },
    );
    expect(Math.hypot(
      vertexIntersection.x,
      vertexIntersection.y,
      vertexIntersection.z,
    )).toBeCloseTo(10, 10);

    const faceIntersection = getKnowledgeGraphNodeBoundaryIntersection(
      { x: 0, y: 0, z: 0 },
      { x: 1, y: 1, z: 1 },
      { shape: 'icosahedron', presentationRadius: 10 },
    );
    expectFinitePoint(faceIntersection);
    const expectedInradius = 10 * (1 + phi) / (Math.sqrt(3) * Math.sqrt(phi + 2));
    expect(Math.hypot(
      faceIntersection.x,
      faceIntersection.y,
      faceIntersection.z,
    )).toBeCloseTo(expectedInradius, 10);
  });

  it('builds a boundary-clipped straight path with target endpoint arrow geometry', () => {
    const path = createKnowledgeGraphEdgePath({
      source: { x: 0, y: 0 },
      target: { x: 10, y: 0 },
      sourceBoundary: radialBoundary(2),
      targetBoundary: radialBoundary(3),
    });

    expect(path.kind).toBe('line');
    expectPointCloseTo(path.start, { x: 2, y: 0, z: 0 });
    expectPointCloseTo(path.end, { x: 7, y: 0, z: 0 });
    expectPointCloseTo(getKnowledgeGraphPathPoint(path, 0.5), { x: 4.5, y: 0, z: 0 });
    expectPointCloseTo(getKnowledgeGraphPathTangent(path, 0.5), { x: 1, y: 0, z: 0 });

    const arrow = getKnowledgeGraphEndpointArrow(path, { length: 2, halfWidth: 1 });
    expectPointCloseTo(arrow.tip, path.end);
    expectPointCloseTo(arrow.direction, { x: 1, y: 0, z: 0 });
    expectPointCloseTo(arrow.base, { x: 5, y: 0, z: 0 });
    expectPointCloseTo(arrow.left, { x: 5, y: 1, z: 0 });
    expectPointCloseTo(arrow.right, { x: 5, y: -1, z: 0 });
  });

  it('separates reciprocal directions with deterministic signed quadratic curves', () => {
    const forward = createKnowledgeGraphEdgePath({
      source: { x: 0, y: 0 },
      target: { x: 10, y: 0 },
      sourceBoundary: radialBoundary(1),
      targetBoundary: radialBoundary(1),
      sourceKey: 'A',
      targetKey: 'B',
      laneCurvature: 0.25,
    });
    const reverse = createKnowledgeGraphEdgePath({
      source: { x: 10, y: 0 },
      target: { x: 0, y: 0 },
      sourceBoundary: radialBoundary(1),
      targetBoundary: radialBoundary(1),
      sourceKey: 'B',
      targetKey: 'A',
      laneCurvature: -0.25,
    });

    expect(forward.kind).toBe('quadratic');
    expect(reverse.kind).toBe('quadratic');
    if (forward.kind !== 'quadratic' || reverse.kind !== 'quadratic') return;

    expect(forward.control.y).toBeGreaterThan(0);
    expect(reverse.control.y).toBeLessThan(0);
    expect(getKnowledgeGraphPathPoint(forward, 0.5).y).toBeGreaterThan(0);
    expect(getKnowledgeGraphPathPoint(reverse, 0.5).y).toBeLessThan(0);
    expect(Math.hypot(forward.start.x, forward.start.y)).toBeCloseTo(1, 10);
    expect(Math.hypot(forward.end.x - 10, forward.end.y)).toBeCloseTo(1, 10);
  });

  it('evaluates arbitrary path points and normalized tangents from one descriptor', () => {
    const path = createKnowledgeGraphEdgePath({
      source: { x: 0, y: 0, z: 2 },
      target: { x: 12, y: 4, z: 2 },
      sourceBoundary: radialBoundary(0),
      targetBoundary: radialBoundary(0),
      sourceKey: 'left',
      targetKey: 'right',
      laneCurvature: -0.2,
    });

    expectPointCloseTo(getKnowledgeGraphPathPoint(path, -1), path.start);
    expectPointCloseTo(getKnowledgeGraphPathPoint(path, 2), path.end);
    const point = getKnowledgeGraphPathPoint(path, 0.37);
    const tangent = getKnowledgeGraphPathTangent(path, 0.37);
    expectFinitePoint(point);
    expectFinitePoint(tangent);
    expect(Math.hypot(tangent.x, tangent.y, tangent.z)).toBeCloseTo(1, 10);
  });

  it('keeps zero-distance and overlapping-node geometry finite and stable', () => {
    const input = {
      source: { x: 4, y: -2, z: 7 },
      target: { x: 4, y: -2, z: 7 },
      sourceBoundary: radialBoundary(3),
      targetBoundary: radialBoundary(5),
      sourceKey: 'same-a',
      targetKey: 'same-b',
      laneCurvature: 0.4,
    } as const;
    const first = createKnowledgeGraphEdgePath(input);
    const second = createKnowledgeGraphEdgePath(input);

    expect(first).toEqual(second);
    expect(first.kind).toBe('line');
    expect(first.hiddenReason).toBe('coincident-centers');
    expectFinitePoint(first.start);
    expectFinitePoint(first.end);
    expectPointCloseTo(first.start, { x: 4, y: -2, z: 7 });
    expectPointCloseTo(getKnowledgeGraphPathTangent(first, 0.5), { x: 0, y: 0, z: 0 });

    const arrow = getKnowledgeGraphEndpointArrow(first, { length: 2, halfWidth: 1 });
    [arrow.tip, arrow.base, arrow.left, arrow.right, arrow.direction].forEach(expectFinitePoint);

    const overlapping = createKnowledgeGraphEdgePath({
      source: { x: 0, y: 0 },
      target: { x: 2, y: 0 },
      sourceBoundary: radialBoundary(2),
      targetBoundary: radialBoundary(2),
    });
    expect(overlapping.hiddenReason).toBe('overlapping-boundaries');
    expectPointCloseTo(overlapping.start, overlapping.end);
    expectPointCloseTo(getKnowledgeGraphPathTangent(overlapping, 0.5), { x: 0, y: 0, z: 0 });
    expectPointCloseTo(
      getKnowledgeGraphEndpointArrow(overlapping, { length: 2, halfWidth: 1 }).direction,
      { x: 0, y: 0, z: 0 },
    );
  });

  it('rejects non-finite coordinates instead of emitting unstable geometry', () => {
    expect(() => getKnowledgeGraphNodeBoundaryIntersection(
      { x: Number.NaN, y: 0 },
      { x: 1, y: 0 },
      radialBoundary(1),
    )).toThrow(/finite/i);
    expect(() => createKnowledgeGraphEdgePath({
      source: { x: 0, y: 0 },
      target: { x: Number.POSITIVE_INFINITY, y: 0 },
      sourceBoundary: radialBoundary(1),
      targetBoundary: radialBoundary(1),
    })).toThrow(/finite/i);
  });

  it('gives static 2D, static 3D, and animation consumers identical path samples', () => {
    const twoDimensionalPath = createKnowledgeGraphEdgePath({
      source: { x: -4, y: 2 },
      target: { x: 8, y: 10 },
      sourceBoundary: radialBoundary(1.5),
      targetBoundary: radialBoundary(2.5),
      sourceKey: 'source',
      targetKey: 'target',
      laneCurvature: 0.18,
    });
    const threeDimensionalPath = createKnowledgeGraphEdgePath({
      source: { x: -4, y: 2, z: 0 },
      target: { x: 8, y: 10, z: 0 },
      sourceBoundary: radialBoundary(1.5),
      targetBoundary: radialBoundary(2.5),
      sourceKey: 'source',
      targetKey: 'target',
      laneCurvature: 0.18,
    });

    expect(twoDimensionalPath).toEqual(threeDimensionalPath);
    for (const progress of [0, 0.2, 0.5, 0.85, 1]) {
      const staticPoint = getKnowledgeGraphPathPoint(twoDimensionalPath, progress);
      const staticTangent = getKnowledgeGraphPathTangent(twoDimensionalPath, progress);
      const animated = getKnowledgeGraphMotionMarkerPose(threeDimensionalPath, progress);
      expectPointCloseTo(animated.point, staticPoint);
      expectPointCloseTo(animated.tangent, staticTangent);
    }
  });
});
