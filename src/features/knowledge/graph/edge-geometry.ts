const GEOMETRY_EPSILON = 1e-9;
const GOLDEN_RATIO = (1 + Math.sqrt(5)) / 2;

export interface KnowledgeGraphPoint {
  x: number;
  y: number;
  z: number;
}

export type KnowledgeGraphPointInput = Omit<KnowledgeGraphPoint, 'z'> & {
  z?: number;
};

interface KnowledgeGraphBoundaryBase {
  presentationRadius: number;
}

interface KnowledgeGraphRadialBoundary extends KnowledgeGraphBoundaryBase {
  shape: 'circle' | 'sphere' | 'regular-hexagon' | 'icosahedron';
}

interface KnowledgeGraphPlanarBoundary extends KnowledgeGraphBoundaryBase {
  shape: 'square' | 'rectangle';
  halfExtentRatios?: {
    x: number;
    y: number;
  };
}

interface KnowledgeGraphBoxBoundary extends KnowledgeGraphBoundaryBase {
  shape: 'box';
  halfExtentRatios?: {
    x: number;
    y: number;
    z: number;
  };
}

export type KnowledgeGraphNodeBoundary =
  | KnowledgeGraphRadialBoundary
  | KnowledgeGraphPlanarBoundary
  | KnowledgeGraphBoxBoundary;

export type KnowledgeGraphPathHiddenReason =
  | 'coincident-centers'
  | 'overlapping-boundaries';

interface KnowledgeGraphPathBase {
  start: KnowledgeGraphPoint;
  end: KnowledgeGraphPoint;
  hiddenReason: KnowledgeGraphPathHiddenReason | null;
}

export interface KnowledgeGraphLinePath extends KnowledgeGraphPathBase {
  kind: 'line';
}

export interface KnowledgeGraphQuadraticPath extends KnowledgeGraphPathBase {
  kind: 'quadratic';
  control: KnowledgeGraphPoint;
}

export type KnowledgeGraphEdgePath = KnowledgeGraphLinePath | KnowledgeGraphQuadraticPath;

export interface KnowledgeGraphEndpointArrow {
  tip: KnowledgeGraphPoint;
  base: KnowledgeGraphPoint;
  left: KnowledgeGraphPoint;
  right: KnowledgeGraphPoint;
  direction: KnowledgeGraphPoint;
}

const ICOSAHEDRON_VERTICES: readonly KnowledgeGraphPoint[] = [
  { x: -1, y: GOLDEN_RATIO, z: 0 },
  { x: 1, y: GOLDEN_RATIO, z: 0 },
  { x: -1, y: -GOLDEN_RATIO, z: 0 },
  { x: 1, y: -GOLDEN_RATIO, z: 0 },
  { x: 0, y: -1, z: GOLDEN_RATIO },
  { x: 0, y: 1, z: GOLDEN_RATIO },
  { x: 0, y: -1, z: -GOLDEN_RATIO },
  { x: 0, y: 1, z: -GOLDEN_RATIO },
  { x: GOLDEN_RATIO, y: 0, z: -1 },
  { x: GOLDEN_RATIO, y: 0, z: 1 },
  { x: -GOLDEN_RATIO, y: 0, z: -1 },
  { x: -GOLDEN_RATIO, y: 0, z: 1 },
].map((vertex) => normalize(vertex));

const ICOSAHEDRON_FACES = [
  [0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11],
  [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8],
  [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9],
  [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1],
] as const;

function toPoint(point: KnowledgeGraphPointInput): KnowledgeGraphPoint {
  const result = {
    x: point.x,
    y: point.y,
    z: point.z ?? 0,
  };
  assertFinitePoint(result);
  return result;
}

function assertFinitePoint(point: KnowledgeGraphPoint): void {
  if (![point.x, point.y, point.z].every(Number.isFinite)) {
    throw new RangeError('Knowledge graph geometry coordinates must be finite.');
  }
}

function assertFiniteNonNegative(value: number, name: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`${name} must be a finite non-negative number.`);
  }
}

function subtract(left: KnowledgeGraphPoint, right: KnowledgeGraphPoint): KnowledgeGraphPoint {
  return {
    x: left.x - right.x,
    y: left.y - right.y,
    z: left.z - right.z,
  };
}

function dot(left: KnowledgeGraphPoint, right: KnowledgeGraphPoint): number {
  return left.x * right.x + left.y * right.y + left.z * right.z;
}

function cross(left: KnowledgeGraphPoint, right: KnowledgeGraphPoint): KnowledgeGraphPoint {
  return {
    x: left.y * right.z - left.z * right.y,
    y: left.z * right.x - left.x * right.z,
    z: left.x * right.y - left.y * right.x,
  };
}

function addScaled(
  point: KnowledgeGraphPoint,
  direction: KnowledgeGraphPoint,
  scale: number,
): KnowledgeGraphPoint {
  return {
    x: point.x + direction.x * scale,
    y: point.y + direction.y * scale,
    z: point.z + direction.z * scale,
  };
}

function magnitude(vector: KnowledgeGraphPoint): number {
  return Math.hypot(vector.x, vector.y, vector.z);
}

function normalize(vector: KnowledgeGraphPoint): KnowledgeGraphPoint {
  const length = magnitude(vector);
  if (length <= GEOMETRY_EPSILON) return { x: 0, y: 0, z: 0 };
  return {
    x: vector.x / length,
    y: vector.y / length,
    z: vector.z / length,
  };
}

function stablePerpendicular(direction: KnowledgeGraphPoint): KnowledgeGraphPoint {
  const planarLength = Math.hypot(direction.x, direction.y);
  if (planarLength > GEOMETRY_EPSILON) {
    return {
      x: -direction.y / planarLength,
      y: direction.x / planarLength,
      z: 0,
    };
  }
  if (Math.abs(direction.z) > GEOMETRY_EPSILON) return { x: 1, y: 0, z: 0 };
  return { x: 0, y: 0, z: 0 };
}

function clampUnit(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

function validateBoundary(boundary: KnowledgeGraphNodeBoundary): void {
  assertFiniteNonNegative(boundary.presentationRadius, 'presentationRadius');
  if (boundary.shape === 'square' || boundary.shape === 'rectangle') {
    const ratios = boundary.halfExtentRatios;
    if (!ratios) return;
    assertFiniteNonNegative(ratios.x, 'halfExtentRatios.x');
    assertFiniteNonNegative(ratios.y, 'halfExtentRatios.y');
  }
  if (boundary.shape === 'box' && boundary.halfExtentRatios) {
    assertFiniteNonNegative(boundary.halfExtentRatios.x, 'halfExtentRatios.x');
    assertFiniteNonNegative(boundary.halfExtentRatios.y, 'halfExtentRatios.y');
    assertFiniteNonNegative(boundary.halfExtentRatios.z, 'halfExtentRatios.z');
  }
}

function getAxisAlignedBoundaryDistance(
  direction: KnowledgeGraphPoint,
  halfExtents: KnowledgeGraphPoint,
): number {
  const candidates = [
    Math.abs(direction.x) > GEOMETRY_EPSILON ? halfExtents.x / Math.abs(direction.x) : Infinity,
    Math.abs(direction.y) > GEOMETRY_EPSILON ? halfExtents.y / Math.abs(direction.y) : Infinity,
    Math.abs(direction.z) > GEOMETRY_EPSILON ? halfExtents.z / Math.abs(direction.z) : Infinity,
  ];
  return Math.min(...candidates);
}

function getRegularHexagonBoundaryDistance(
  direction: KnowledgeGraphPoint,
  circumradius: number,
): number {
  let distance = Infinity;
  for (let index = 0; index < 6; index += 1) {
    const fromAngle = Math.PI / 3 * index - Math.PI / 2;
    const toAngle = Math.PI / 3 * (index + 1) - Math.PI / 2;
    const from = { x: Math.cos(fromAngle), y: Math.sin(fromAngle), z: 0 };
    const to = { x: Math.cos(toAngle), y: Math.sin(toAngle), z: 0 };
    const edge = subtract(to, from);
    let normal = normalize({ x: edge.y, y: -edge.x, z: 0 });
    if (dot(normal, from) < 0) normal = addScaled({ x: 0, y: 0, z: 0 }, normal, -1);
    const directionalGain = dot(normal, direction);
    if (directionalGain > GEOMETRY_EPSILON) {
      distance = Math.min(distance, circumradius * dot(normal, from) / directionalGain);
    }
  }
  return distance;
}

function getIcosahedronBoundaryDistance(
  direction: KnowledgeGraphPoint,
  circumradius: number,
): number {
  let distance = Infinity;
  for (const [firstIndex, secondIndex, thirdIndex] of ICOSAHEDRON_FACES) {
    const first = ICOSAHEDRON_VERTICES[firstIndex];
    const second = ICOSAHEDRON_VERTICES[secondIndex];
    const third = ICOSAHEDRON_VERTICES[thirdIndex];
    let normal = normalize(cross(subtract(second, first), subtract(third, first)));
    if (dot(normal, first) < 0) normal = addScaled({ x: 0, y: 0, z: 0 }, normal, -1);
    const directionalGain = dot(normal, direction);
    if (directionalGain > GEOMETRY_EPSILON) {
      distance = Math.min(distance, circumradius * dot(normal, first) / directionalGain);
    }
  }
  return distance;
}

function getBoundaryDistance(
  direction: KnowledgeGraphPoint,
  boundary: KnowledgeGraphNodeBoundary,
): number {
  validateBoundary(boundary);
  const radius = boundary.presentationRadius;
  switch (boundary.shape) {
    case 'circle':
      return radius;
    case 'sphere':
      return radius * 0.8;
    case 'square':
    case 'rectangle': {
      const ratios = boundary.halfExtentRatios ?? { x: 0.8, y: 0.8 };
      return getAxisAlignedBoundaryDistance(direction, {
        x: radius * ratios.x,
        y: radius * ratios.y,
        z: 0,
      });
    }
    case 'regular-hexagon':
      return getRegularHexagonBoundaryDistance(direction, radius * 1.2);
    case 'box': {
      const ratios = boundary.halfExtentRatios ?? { x: 0.7, y: 0.7, z: 0.7 };
      return getAxisAlignedBoundaryDistance(direction, {
        x: radius * ratios.x,
        y: radius * ratios.y,
        z: radius * ratios.z,
      });
    }
    case 'icosahedron':
      return getIcosahedronBoundaryDistance(direction, radius);
  }
}

export function getKnowledgeGraphNodeBoundaryIntersection(
  centerInput: KnowledgeGraphPointInput,
  towardInput: KnowledgeGraphPointInput,
  boundary: KnowledgeGraphNodeBoundary,
): KnowledgeGraphPoint {
  const center = toPoint(centerInput);
  const toward = toPoint(towardInput);
  const direction = normalize(subtract(toward, center));
  if (magnitude(direction) <= GEOMETRY_EPSILON) return center;
  const distance = getBoundaryDistance(direction, boundary);
  return addScaled(center, direction, Number.isFinite(distance) ? distance : 0);
}

export function isKnowledgeGraphPointInsideNodeBoundary(
  pointInput: KnowledgeGraphPointInput,
  centerInput: KnowledgeGraphPointInput,
  boundary: KnowledgeGraphNodeBoundary,
  tolerance = 0,
): boolean {
  assertFiniteNonNegative(tolerance, 'tolerance');
  const point = toPoint(pointInput);
  const center = toPoint(centerInput);
  const offset = subtract(point, center);
  const distance = magnitude(offset);
  if (distance <= GEOMETRY_EPSILON) return true;
  const boundaryDistance = getBoundaryDistance(normalize(offset), boundary);
  return Number.isFinite(boundaryDistance) && distance <= boundaryDistance + tolerance;
}

function comparePoints(left: KnowledgeGraphPoint, right: KnowledgeGraphPoint): number {
  return left.x - right.x || left.y - right.y || left.z - right.z;
}

function getStableLaneDirection({
  source,
  target,
  sourceKey,
  targetKey,
}: {
  source: KnowledgeGraphPoint;
  target: KnowledgeGraphPoint;
  sourceKey?: string;
  targetKey?: string;
}): KnowledgeGraphPoint {
  const sourceFirst = sourceKey !== undefined && targetKey !== undefined && sourceKey !== targetKey
    ? sourceKey < targetKey
    : comparePoints(source, target) <= 0;
  return normalize(sourceFirst ? subtract(target, source) : subtract(source, target));
}

function createHiddenPath(
  point: KnowledgeGraphPoint,
  hiddenReason: KnowledgeGraphPathHiddenReason,
): KnowledgeGraphLinePath {
  return { kind: 'line', start: point, end: point, hiddenReason };
}

export function createKnowledgeGraphEdgePath({
  source: sourceInput,
  target: targetInput,
  sourceBoundary,
  targetBoundary,
  sourceKey,
  targetKey,
  laneCurvature = 0,
}: {
  source: KnowledgeGraphPointInput;
  target: KnowledgeGraphPointInput;
  sourceBoundary: KnowledgeGraphNodeBoundary;
  targetBoundary: KnowledgeGraphNodeBoundary;
  sourceKey?: string;
  targetKey?: string;
  laneCurvature?: number;
}): KnowledgeGraphEdgePath {
  const source = toPoint(sourceInput);
  const target = toPoint(targetInput);
  validateBoundary(sourceBoundary);
  validateBoundary(targetBoundary);
  if (!Number.isFinite(laneCurvature)) {
    throw new RangeError('laneCurvature must be finite.');
  }

  const centerVector = subtract(target, source);
  const centerDistance = magnitude(centerVector);
  if (centerDistance <= GEOMETRY_EPSILON) {
    return createHiddenPath(source, 'coincident-centers');
  }

  const centerDirection = normalize(centerVector);
  const directStart = getKnowledgeGraphNodeBoundaryIntersection(source, target, sourceBoundary);
  const directEnd = getKnowledgeGraphNodeBoundaryIntersection(target, source, targetBoundary);
  if (dot(subtract(directEnd, directStart), centerDirection) <= GEOMETRY_EPSILON) {
    return createHiddenPath(addScaled(source, centerVector, 0.5), 'overlapping-boundaries');
  }

  if (Math.abs(laneCurvature) <= GEOMETRY_EPSILON) {
    return { kind: 'line', start: directStart, end: directEnd, hiddenReason: null };
  }

  const laneDirection = getStableLaneDirection({ source, target, sourceKey, targetKey });
  const perpendicular = stablePerpendicular(laneDirection);
  const midpoint = addScaled(source, centerVector, 0.5);
  const control = addScaled(midpoint, perpendicular, centerDistance * laneCurvature);
  const start = getKnowledgeGraphNodeBoundaryIntersection(source, control, sourceBoundary);
  const end = getKnowledgeGraphNodeBoundaryIntersection(target, control, targetBoundary);

  if (dot(subtract(end, start), centerDirection) <= GEOMETRY_EPSILON) {
    return createHiddenPath(midpoint, 'overlapping-boundaries');
  }

  return { kind: 'quadratic', start, control, end, hiddenReason: null };
}

export function getKnowledgeGraphPathPoint(
  path: KnowledgeGraphEdgePath,
  progress: number,
): KnowledgeGraphPoint {
  const t = clampUnit(progress);
  if (path.kind === 'line') return addScaled(path.start, subtract(path.end, path.start), t);

  const inverseT = 1 - t;
  return {
    x: inverseT * inverseT * path.start.x
      + 2 * inverseT * t * path.control.x
      + t * t * path.end.x,
    y: inverseT * inverseT * path.start.y
      + 2 * inverseT * t * path.control.y
      + t * t * path.end.y,
    z: inverseT * inverseT * path.start.z
      + 2 * inverseT * t * path.control.z
      + t * t * path.end.z,
  };
}

export function getKnowledgeGraphPathTangent(
  path: KnowledgeGraphEdgePath,
  progress: number,
): KnowledgeGraphPoint {
  if (path.kind === 'line') return normalize(subtract(path.end, path.start));

  const t = clampUnit(progress);
  const inverseT = 1 - t;
  const tangent = {
    x: 2 * inverseT * (path.control.x - path.start.x)
      + 2 * t * (path.end.x - path.control.x),
    y: 2 * inverseT * (path.control.y - path.start.y)
      + 2 * t * (path.end.y - path.control.y),
    z: 2 * inverseT * (path.control.z - path.start.z)
      + 2 * t * (path.end.z - path.control.z),
  };
  const normalized = normalize(tangent);
  return magnitude(normalized) > GEOMETRY_EPSILON
    ? normalized
    : normalize(subtract(path.end, path.start));
}

export function getKnowledgeGraphEndpointArrow(
  path: KnowledgeGraphEdgePath,
  {
    length,
    halfWidth,
  }: {
    length: number;
    halfWidth: number;
  },
): KnowledgeGraphEndpointArrow {
  assertFiniteNonNegative(length, 'length');
  assertFiniteNonNegative(halfWidth, 'halfWidth');
  const tip = path.end;
  const direction = getKnowledgeGraphPathTangent(path, 1);
  const side = stablePerpendicular(direction);
  const base = addScaled(tip, direction, -length);

  return {
    tip,
    base,
    left: addScaled(base, side, halfWidth),
    right: addScaled(base, side, -halfWidth),
    direction,
  };
}
