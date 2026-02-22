export interface Complex {
  re: number;
  im: number;
}

export interface TransferFunctionSpec {
  poles: Complex[];
  zeros?: Complex[];
  gain?: number;
}

export interface TimeDomainRequest extends TransferFunctionSpec {
  closedLoopPoles?: Complex[];
  timeRange: {
    start: number;
    end: number;
    step: number;
  };
  responseType: 'step' | 'impulse' | 'ramp';
}

export interface TimeDomainResponse {
  samples: Array<{ time: number; response: number }>;
  metrics: {
    overshoot: number;
    settlingTime: number;
    riseTime: number;
    steadyStateError: number;
  };
}

export interface RootLocusPoint extends Complex {
  gain: number;
}

export interface RootLocusResponse {
  branches: RootLocusPoint[][];
  gainRange: {
    min: number;
    max: number;
    points: number;
  };
  selectedGain: number;
  closedLoopPoles: Complex[];
}

export interface NyquistSample extends Complex {
  frequency: number;
  magnitudeDb: number;
  phaseDeg: number;
}

export interface FrequencyDomainRequest extends TransferFunctionSpec {
  frequencyRange: {
    min: number;
    max: number;
    points: number;
  };
}

export interface FrequencyDomainResponse {
  samples: Array<{ frequency: number; magnitudeDb: number; phaseDeg: number }>;
  nyquistSamples: NyquistSample[];
  stabilityMargins: {
    gainMargin: { value: number; frequency: number; isInfinite?: boolean };
    phaseMargin: { value: number; frequency: number };
  };
  marginPoints: {
    gainCrossover?: NyquistSample;
    phaseCrossover?: NyquistSample;
  };
}

export interface StabilityAnalysisResponse {
  isStable: boolean;
  stabilityMargins: {
    gainMargin: { value: number; frequency: number; isInfinite?: boolean };
    phaseMargin: { value: number; frequency: number };
  };
  polesInRHP: number;
  dampingRatios: number[];
  hints: string[];
  closedLoopPoles: Complex[];
  rootLocus: RootLocusResponse;
}

const EPS = 1e-9;

const c = {
  add: (a: Complex, b: Complex): Complex => ({ re: a.re + b.re, im: a.im + b.im }),
  sub: (a: Complex, b: Complex): Complex => ({ re: a.re - b.re, im: a.im - b.im }),
  mul: (a: Complex, b: Complex): Complex => ({
    re: a.re * b.re - a.im * b.im,
    im: a.re * b.im + a.im * b.re,
  }),
  div: (a: Complex, b: Complex): Complex => {
    const d = b.re * b.re + b.im * b.im;
    if (d < EPS) {
      return { re: 0, im: 0 };
    }
    return {
      re: (a.re * b.re + a.im * b.im) / d,
      im: (a.im * b.re - a.re * b.im) / d,
    };
  },
  abs: (a: Complex): number => Math.sqrt(a.re * a.re + a.im * a.im),
};

function sanitizeComplex(value: Complex): Complex {
  return {
    re: Number.isFinite(value.re) ? value.re : 0,
    im: Number.isFinite(value.im) ? value.im : 0,
  };
}

function normalizeComplexArray(values: Complex[] | undefined): Complex[] {
  return (values ?? []).map(sanitizeComplex);
}

function trimLeadingZeros(coeffs: number[]): number[] {
  const out = [...coeffs];
  while (out.length > 1 && Math.abs(out[0]) < EPS) {
    out.shift();
  }
  return out;
}

function normalizePolynomial(coeffs: number[]): number[] {
  const trimmed = trimLeadingZeros(coeffs);
  const lead = trimmed[0];
  if (Math.abs(lead) < EPS) {
    throw new Error('多项式首项系数无效');
  }
  return trimmed.map((item) => item / lead);
}

function polyFromRoots(roots: Complex[]): number[] {
  if (roots.length === 0) {
    return [1];
  }

  let coeffs: Complex[] = [{ re: 1, im: 0 }];
  for (const root of roots) {
    const next: Complex[] = Array.from({ length: coeffs.length + 1 }, () => ({ re: 0, im: 0 }));
    for (let i = 0; i < coeffs.length; i += 1) {
      next[i] = c.add(next[i], coeffs[i]);
      next[i + 1] = c.sub(next[i + 1], c.mul(coeffs[i], root));
    }
    coeffs = next;
  }

  return coeffs.map((item) => item.re);
}

function evaluatePolynomial(coeffs: number[], s: Complex): Complex {
  let acc: Complex = { re: 0, im: 0 };
  for (const coeff of coeffs) {
    acc = c.add(c.mul(acc, s), { re: coeff, im: 0 });
  }
  return acc;
}

function addPolynomials(a: number[], b: number[]): number[] {
  const size = Math.max(a.length, b.length);
  const out = Array.from({ length: size }, () => 0);

  const offsetA = size - a.length;
  for (let i = 0; i < a.length; i += 1) {
    out[i + offsetA] += a[i];
  }

  const offsetB = size - b.length;
  for (let i = 0; i < b.length; i += 1) {
    out[i + offsetB] += b[i];
  }

  return out;
}

function scalePolynomial(coeffs: number[], factor: number): number[] {
  return coeffs.map((item) => item * factor);
}

function buildOpenLoopTransferFunction(spec: TransferFunctionSpec, gainOverride?: number): { num: number[]; den: number[] } {
  const poles = normalizeComplexArray(spec.poles);
  const zeros = normalizeComplexArray(spec.zeros);
  const gainValue = Number.isFinite(gainOverride)
    ? (gainOverride as number)
    : Number.isFinite(spec.gain ?? 1)
      ? (spec.gain ?? 1)
      : 1;

  if (poles.length === 0) {
    throw new Error('至少需要一个开环极点');
  }

  const den = normalizePolynomial(polyFromRoots(poles));
  const numBase = polyFromRoots(zeros);
  const numRaw = scalePolynomial(numBase, gainValue);
  const num = numRaw.every((item) => Math.abs(item) < EPS) ? [0] : trimLeadingZeros(numRaw);

  return {
    num,
    den,
  };
}

function buildClosedLoopTransferFunction(spec: TransferFunctionSpec, gainOverride?: number): { num: number[]; den: number[] } {
  const openLoop = buildOpenLoopTransferFunction(spec, gainOverride);
  const denRaw = addPolynomials(openLoop.den, openLoop.num);

  return {
    num: openLoop.num,
    den: normalizePolynomial(denRaw),
  };
}

function buildCharacteristicPolynomial(openDen: number[], openNumUnitGain: number[], gain: number): number[] {
  return normalizePolynomial(addPolynomials(openDen, scalePolynomial(openNumUnitGain, gain)));
}

function fromPolar(radius: number, angle: number): Complex {
  return {
    re: radius * Math.cos(angle),
    im: radius * Math.sin(angle),
  };
}

function complexDistance(a: Complex, b: Complex): number {
  return Math.hypot(a.re - b.re, a.im - b.im);
}

function normalizeAngleDiffDeg(value: number): number {
  let out = value;
  while (out > 180) {
    out -= 360;
  }
  while (out < -180) {
    out += 360;
  }
  return out;
}

function sortRoots(roots: Complex[]): Complex[] {
  return [...roots].sort((lhs, rhs) => {
    if (Math.abs(lhs.re - rhs.re) > 1e-8) {
      return lhs.re - rhs.re;
    }
    return lhs.im - rhs.im;
  });
}

function findPolynomialRoots(coefficients: number[]): Complex[] {
  const coeffs = normalizePolynomial(coefficients);
  const degree = coeffs.length - 1;

  if (degree <= 0) {
    return [];
  }

  if (degree === 1) {
    return [{ re: -coeffs[1] / coeffs[0], im: 0 }];
  }

  const maxCoeff = Math.max(...coeffs.slice(1).map((item) => Math.abs(item)));
  const radius = 1 + maxCoeff;
  let roots = Array.from({ length: degree }, (_, idx) => fromPolar(radius, (2 * Math.PI * idx) / degree));

  const maxIterations = 120;
  const tolerance = 1e-10;

  for (let iter = 0; iter < maxIterations; iter += 1) {
    let maxDelta = 0;

    const nextRoots = roots.map((root, index) => {
      let denominator: Complex = { re: 1, im: 0 };
      for (let j = 0; j < roots.length; j += 1) {
        if (j === index) {
          continue;
        }
        denominator = c.mul(denominator, c.sub(root, roots[j]));
      }

      const numerator = evaluatePolynomial(coeffs, root);
      const delta = c.div(numerator, denominator);
      const updated = c.sub(root, delta);
      maxDelta = Math.max(maxDelta, c.abs(delta));
      return updated;
    });

    roots = nextRoots;
    if (maxDelta < tolerance) {
      break;
    }
  }

  return sortRoots(roots);
}

function assignRootsByContinuity(previous: Complex[], current: Complex[]): Complex[] {
  const n = Math.min(previous.length, current.length);
  if (n === 0) {
    return [...current];
  }

  // 精确匹配可显著减少分支“跳线”，避免根轨迹视觉杂乱。
  if (n <= 9) {
    const memo = new Map<string, { cost: number; path: number[] }>();

    const solve = (index: number, mask: number): { cost: number; path: number[] } => {
      if (index >= n) {
        return { cost: 0, path: [] };
      }

      const key = `${index}|${mask}`;
      const cached = memo.get(key);
      if (cached) {
        return cached;
      }

      let best = { cost: Number.POSITIVE_INFINITY, path: [] as number[] };
      for (let j = 0; j < n; j += 1) {
        if (mask & (1 << j)) {
          continue;
        }
        const tail = solve(index + 1, mask | (1 << j));
        const cost = complexDistance(previous[index], current[j]) + tail.cost;
        if (cost < best.cost) {
          best = { cost, path: [j, ...tail.path] };
        }
      }

      memo.set(key, best);
      return best;
    };

    const orderedIndex = solve(0, 0).path;
    const orderedRoots = orderedIndex.map((idx) => current[idx]);
    const used = new Set(orderedIndex);
    for (let i = 0; i < current.length; i += 1) {
      if (!used.has(i)) {
        orderedRoots.push(current[i]);
      }
    }

    return orderedRoots;
  }

  const fallback: Complex[] = [];
  const used = new Set<number>();
  for (const prev of previous) {
    let bestIndex = -1;
    let bestDistance = Number.POSITIVE_INFINITY;
    for (let i = 0; i < current.length; i += 1) {
      if (used.has(i)) {
        continue;
      }
      const d = complexDistance(prev, current[i]);
      if (d < bestDistance) {
        bestDistance = d;
        bestIndex = i;
      }
    }
    if (bestIndex >= 0) {
      used.add(bestIndex);
      fallback.push(current[bestIndex]);
    }
  }
  for (let i = 0; i < current.length; i += 1) {
    if (!used.has(i)) {
      fallback.push(current[i]);
    }
  }
  return fallback;
}

function logspace(min: number, max: number, points: number): number[] {
  const safeMin = Math.max(min, 1e-6);
  const safeMax = Math.max(max, safeMin * 1.01);
  const count = Math.max(points, 2);

  const start = Math.log10(safeMin);
  const end = Math.log10(safeMax);

  return Array.from({ length: count }, (_, i) => {
    const ratio = i / (count - 1);
    return 10 ** (start + (end - start) * ratio);
  });
}

function recommendRootLocusMaxGain(poles: Complex[], zeros: Complex[], currentGain: number): number {
  const poleScale = Math.max(1, ...poles.map((pole) => c.abs(pole)));
  const zeroScale = Math.max(1, ...zeros.map((zero) => c.abs(zero)));
  const order = Math.max(1, poles.length);
  const estimate = (poleScale + zeroScale + 1) ** order;
  const target = Math.max(40, currentGain * 2, estimate);
  return Math.min(Math.max(target, 10), 5_000);
}

function buildRootLocusGainGrid(min: number, max: number, points: number): number[] {
  const count = Math.max(points, 24);
  const positiveMin = Math.max(max / 1e4, 1e-4);
  const positive = logspace(positiveMin, max, count - 1);
  return [min, ...positive];
}

interface GainRootsSnapshot {
  gain: number;
  roots: Complex[];
}

function midpointGain(left: number, right: number): number {
  if (left <= 0) {
    return (left + right) / 2;
  }
  return Math.sqrt(left * right);
}

function calculateRootsAtGain(openLoopUnit: { num: number[]; den: number[] }, gain: number): Complex[] {
  const charPoly = buildCharacteristicPolynomial(openLoopUnit.den, openLoopUnit.num, gain);
  return findPolynomialRoots(charPoly);
}

function shouldRefineRootLocusSegment(startRoots: Complex[], endRoots: Complex[], midRoots: Complex[]): boolean {
  if (startRoots.length !== endRoots.length || startRoots.length !== midRoots.length) {
    return false;
  }

  for (let i = 0; i < startRoots.length; i += 1) {
    const start = startRoots[i];
    const end = endRoots[i];
    const mid = midRoots[i];

    const chord = complexDistance(start, end);
    const interp = {
      re: (start.re + end.re) / 2,
      im: (start.im + end.im) / 2,
    };
    const deviation = complexDistance(mid, interp);

    if (chord > 0.42 || deviation > Math.max(0.02, chord * 0.12)) {
      return true;
    }
  }

  return false;
}

function refineRootLocusSegment(
  openLoopUnit: { num: number[]; den: number[] },
  left: GainRootsSnapshot,
  right: GainRootsSnapshot,
  depth: number,
  maxDepth: number
): GainRootsSnapshot[] {
  if (depth >= maxDepth || right.gain - left.gain < 1e-6) {
    return [right];
  }

  const midGain = midpointGain(left.gain, right.gain);
  if (!Number.isFinite(midGain) || midGain <= left.gain + 1e-9 || midGain >= right.gain - 1e-9) {
    return [right];
  }

  const midRootsRaw = calculateRootsAtGain(openLoopUnit, midGain);
  const midRoots = assignRootsByContinuity(left.roots, midRootsRaw);
  const rightRootsAligned = assignRootsByContinuity(midRoots, right.roots);
  const rightAlignedSnapshot: GainRootsSnapshot = { gain: right.gain, roots: rightRootsAligned };

  if (!shouldRefineRootLocusSegment(left.roots, rightRootsAligned, midRoots)) {
    return [rightAlignedSnapshot];
  }

  const midSnapshot: GainRootsSnapshot = { gain: midGain, roots: midRoots };
  return [
    ...refineRootLocusSegment(openLoopUnit, left, midSnapshot, depth + 1, maxDepth),
    ...refineRootLocusSegment(openLoopUnit, midSnapshot, rightAlignedSnapshot, depth + 1, maxDepth),
  ];
}

const ROOT_LOCUS_CACHE_LIMIT = 12;
const rootLocusCache = new Map<string, { branches: RootLocusPoint[][]; gainRange: RootLocusResponse['gainRange'] }>();

function rootLocusCacheKey(
  poles: Complex[],
  zeros: Complex[],
  gainRange: { min: number; max: number; points: number }
): string {
  const fmt = (value: number) => value.toFixed(4);
  const polesKey = poles.map((item) => `${fmt(item.re)}:${fmt(item.im)}`).join('|');
  const zerosKey = zeros.map((item) => `${fmt(item.re)}:${fmt(item.im)}`).join('|');
  return `${polesKey}__${zerosKey}__${fmt(gainRange.min)}:${fmt(gainRange.max)}:${gainRange.points}`;
}

function calculateClosedLoopPoles(spec: TransferFunctionSpec, gainOverride?: number): Complex[] {
  const selectedGain = Number.isFinite(gainOverride)
    ? (gainOverride as number)
    : Number.isFinite(spec.gain ?? 1)
      ? (spec.gain ?? 1)
      : 1;

  const openLoopUnit = buildOpenLoopTransferFunction(spec, 1);
  const charPoly = buildCharacteristicPolynomial(openLoopUnit.den, openLoopUnit.num, selectedGain);
  return sortRoots(findPolynomialRoots(charPoly));
}

export function calculateRootLocus(
  spec: TransferFunctionSpec,
  options?: { gainRange?: { min: number; max: number; points: number } }
): RootLocusResponse {
  const poles = normalizeComplexArray(spec.poles);
  const zeros = normalizeComplexArray(spec.zeros);
  if (poles.length === 0) {
    throw new Error('至少需要一个开环极点');
  }

  const selectedGain = Number.isFinite(spec.gain ?? 1) ? (spec.gain ?? 1) : 1;
  const defaultMax = recommendRootLocusMaxGain(poles, zeros, selectedGain);

  const gainRange = {
    min: options?.gainRange?.min ?? 0,
    max: options?.gainRange?.max ?? defaultMax,
    points: options?.gainRange?.points ?? 90,
  };
  const cacheKey = rootLocusCacheKey(poles, zeros, gainRange);
  let cached = rootLocusCache.get(cacheKey);

  if (!cached) {
    const gains = buildRootLocusGainGrid(gainRange.min, gainRange.max, gainRange.points);
    const openLoopUnit = buildOpenLoopTransferFunction(spec, 1);
    const firstRoots = calculateRootsAtGain(openLoopUnit, gains[0]);
    let leftSnapshot: GainRootsSnapshot = { gain: gains[0], roots: firstRoots };
    const snapshots: GainRootsSnapshot[] = [leftSnapshot];

    for (let i = 1; i < gains.length; i += 1) {
      const nextRootsRaw = calculateRootsAtGain(openLoopUnit, gains[i]);
      const nextRoots = assignRootsByContinuity(leftSnapshot.roots, nextRootsRaw);
      const rightSnapshot: GainRootsSnapshot = { gain: gains[i], roots: nextRoots };

      const refined = refineRootLocusSegment(openLoopUnit, leftSnapshot, rightSnapshot, 0, 4);
      snapshots.push(...refined);
      leftSnapshot = refined[refined.length - 1];
    }

    const branches: RootLocusPoint[][] = Array.from({ length: snapshots[0]?.roots.length ?? 0 }, () => []);
    for (const snapshot of snapshots) {
      snapshot.roots.forEach((root, branchIndex) => {
        branches[branchIndex].push({
          re: root.re,
          im: root.im,
          gain: snapshot.gain,
        });
      });
    }

    cached = {
      branches,
      gainRange: {
        ...gainRange,
        points: snapshots.length,
      },
    };
    if (rootLocusCache.size >= ROOT_LOCUS_CACHE_LIMIT) {
      const oldestKey = rootLocusCache.keys().next().value;
      if (oldestKey) {
        rootLocusCache.delete(oldestKey);
      }
    }
    rootLocusCache.set(cacheKey, cached);
  }

  return {
    branches: cached.branches,
    gainRange: cached.gainRange,
    selectedGain,
    closedLoopPoles: calculateClosedLoopPoles(spec, selectedGain),
  };
}

function createCanonicalStateSpace(num: number[], den: number[]) {
  const n = den.length - 1;
  const bPadded = Array.from({ length: n + 1 }, () => 0);
  const offset = n + 1 - num.length;
  for (let i = 0; i < num.length; i += 1) {
    const idx = i + offset;
    if (idx >= 0 && idx < bPadded.length) {
      bPadded[idx] = num[i];
    }
  }

  const d = bPadded[0];
  const tail = den.slice(1);
  const aAsc = [...tail].reverse();
  const bAsc = [...bPadded.slice(1)].reverse();

  const a = Array.from({ length: n }, () => Array.from({ length: n }, () => 0));
  for (let i = 0; i < n - 1; i += 1) {
    a[i][i + 1] = 1;
  }
  for (let i = 0; i < n; i += 1) {
    a[n - 1][i] = -aAsc[i];
  }

  const b = Array.from({ length: n }, () => 0);
  b[n - 1] = 1;

  const cVec = Array.from({ length: n }, (_, i) => bAsc[i] - aAsc[i] * d);

  return { a, b, c: cVec, d };
}

function matVecMul(matrix: number[][], vector: number[]): number[] {
  return matrix.map((row) => row.reduce((sum, value, idx) => sum + value * vector[idx], 0));
}

function vecAdd(a: number[], b: number[]): number[] {
  return a.map((value, idx) => value + b[idx]);
}

function vecScale(a: number[], factor: number): number[] {
  return a.map((value) => value * factor);
}

function dot(a: number[], b: number[]): number {
  return a.reduce((sum, value, idx) => sum + value * b[idx], 0);
}

function makeInput(responseType: 'step' | 'impulse' | 'ramp', dt: number): (time: number, index: number) => number {
  if (responseType === 'impulse') {
    return (_, index) => (index === 0 ? 1 / Math.max(dt, 1e-4) : 0);
  }
  if (responseType === 'ramp') {
    return (time) => Math.max(0, time);
  }
  return () => 1;
}

function clampPositive(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(value, 0);
}

function computeStepMetrics(samples: Array<{ time: number; response: number }>) {
  if (samples.length === 0) {
    return {
      overshoot: 0,
      settlingTime: 0,
      riseTime: 0,
      steadyStateError: 1,
    };
  }

  const finalValue = samples[samples.length - 1]?.response ?? 0;
  const absFinal = Math.abs(finalValue);
  const target = absFinal < EPS ? 1 : finalValue;
  const targetAbs = Math.max(Math.abs(target), EPS);

  const maxResponse = Math.max(...samples.map((item) => item.response));
  const overshoot = clampPositive(((maxResponse - target) / targetAbs) * 100);

  const riseThreshold = target * 0.9;
  const risePoint = samples.find((item) =>
    target >= 0 ? item.response >= riseThreshold : item.response <= riseThreshold
  );

  const settleTolerance = targetAbs * 0.02;
  let settlingTime = samples[samples.length - 1]?.time ?? 0;
  for (let i = 0; i < samples.length; i += 1) {
    const remainsWithin = samples.slice(i).every((point) => Math.abs(point.response - target) <= settleTolerance);
    if (remainsWithin) {
      settlingTime = samples[i].time;
      break;
    }
  }

  const steadyStateError = Math.abs(1 - finalValue);

  return {
    overshoot,
    settlingTime,
    riseTime: risePoint?.time ?? (samples[samples.length - 1]?.time ?? 0),
    steadyStateError,
  };
}

function unwrapPhase(phases: number[]): number[] {
  if (phases.length === 0) {
    return [];
  }

  const out = [phases[0]];
  for (let i = 1; i < phases.length; i += 1) {
    let value = phases[i];
    let delta = value - out[i - 1];
    while (delta > 180) {
      value -= 360;
      delta = value - out[i - 1];
    }
    while (delta < -180) {
      value += 360;
      delta = value - out[i - 1];
    }
    out.push(value);
  }
  return out;
}

function interpolateAtCrossing(
  x: number[],
  y: number[],
  target: number
): { x: number; y: number; index: number } | null {
  for (let i = 0; i < y.length - 1; i += 1) {
    const y1 = y[i] - target;
    const y2 = y[i + 1] - target;
    if (Math.abs(y1) < EPS) {
      return { x: x[i], y: y[i], index: i };
    }
    if (y1 * y2 <= 0) {
      const denom = y[i + 1] - y[i];
      const ratio = Math.abs(denom) < EPS ? 0 : (target - y[i]) / denom;
      return {
        x: x[i] + ratio * (x[i + 1] - x[i]),
        y: target,
        index: i,
      };
    }
  }
  return null;
}

function linearInterpolate(x1: number, y1: number, x2: number, y2: number, x: number): number {
  if (Math.abs(x2 - x1) < EPS) {
    return y1;
  }
  const ratio = (x - x1) / (x2 - x1);
  return y1 + ratio * (y2 - y1);
}

function evaluateOpenLoopAtFrequency(num: number[], den: number[], frequency: number): NyquistSample {
  const s: Complex = { re: 0, im: frequency };
  const numerator = evaluatePolynomial(num, s);
  const denominator = evaluatePolynomial(den, s);
  const h = c.div(numerator, denominator);
  const magnitude = c.abs(h);

  return {
    frequency,
    re: h.re,
    im: h.im,
    magnitudeDb: 20 * Math.log10(Math.max(magnitude, 1e-9)),
    phaseDeg: (Math.atan2(h.im, h.re) * 180) / Math.PI,
  };
}

function shouldRefineNyquistSegment(left: NyquistSample, right: NyquistSample, mid: NyquistSample): boolean {
  const chord = complexDistance(left, right);
  const interp: Complex = {
    re: (left.re + right.re) / 2,
    im: (left.im + right.im) / 2,
  };
  const deviation = complexDistance(mid, interp);

  const phaseMid = left.phaseDeg + normalizeAngleDiffDeg(right.phaseDeg - left.phaseDeg) / 2;
  const phaseError = Math.abs(normalizeAngleDiffDeg(mid.phaseDeg - phaseMid));
  const magnitudeMid = (left.magnitudeDb + right.magnitudeDb) / 2;
  const magnitudeError = Math.abs(mid.magnitudeDb - magnitudeMid);

  return deviation > Math.max(0.03, chord * 0.08) || phaseError > 6 || magnitudeError > 1.8;
}

function collectAdaptiveMidpoints(
  num: number[],
  den: number[],
  left: NyquistSample,
  right: NyquistSample,
  depth: number,
  maxDepth: number,
  output: NyquistSample[]
) {
  if (depth >= maxDepth) {
    return;
  }

  const midFrequency = Math.sqrt(left.frequency * right.frequency);
  if (!Number.isFinite(midFrequency) || midFrequency <= left.frequency * (1 + 1e-8)) {
    return;
  }

  const mid = evaluateOpenLoopAtFrequency(num, den, midFrequency);
  if (!shouldRefineNyquistSegment(left, right, mid)) {
    return;
  }

  collectAdaptiveMidpoints(num, den, left, mid, depth + 1, maxDepth, output);
  output.push(mid);
  collectAdaptiveMidpoints(num, den, mid, right, depth + 1, maxDepth, output);
}

function sampleNyquistAdaptive(
  num: number[],
  den: number[],
  minFrequency: number,
  maxFrequency: number,
  pointsHint: number
): NyquistSample[] {
  const seedCount = Math.max(24, Math.min(pointsHint, 84));
  const seedFrequencies = logspace(minFrequency, maxFrequency, seedCount);
  const out: NyquistSample[] = [];

  let previous = evaluateOpenLoopAtFrequency(num, den, seedFrequencies[0]);
  out.push(previous);

  for (let i = 1; i < seedFrequencies.length; i += 1) {
    const right = evaluateOpenLoopAtFrequency(num, den, seedFrequencies[i]);
    const midpoints: NyquistSample[] = [];
    collectAdaptiveMidpoints(num, den, previous, right, 0, 7, midpoints);
    out.push(...midpoints, right);
    previous = right;
  }

  const deduped: NyquistSample[] = [];
  for (const sample of out) {
    const last = deduped[deduped.length - 1];
    if (!last || sample.frequency > last.frequency * (1 + 1e-10)) {
      deduped.push(sample);
    }
  }

  return deduped;
}

function calculateMargins(frequencies: number[], magnitudeDb: number[], phaseDegRaw: number[]) {
  const phaseDeg = unwrapPhase(phaseDegRaw);

  let phaseMargin = { value: 0, frequency: 0 };
  let gainCrossoverFrequency: number | undefined;

  const unityCrossing = interpolateAtCrossing(frequencies, magnitudeDb, 0);
  if (unityCrossing) {
    const i = unityCrossing.index;
    const phaseAtGc = linearInterpolate(
      frequencies[i],
      phaseDeg[i],
      frequencies[i + 1],
      phaseDeg[i + 1],
      unityCrossing.x
    );

    phaseMargin = {
      value: 180 + phaseAtGc,
      frequency: unityCrossing.x,
    };
    gainCrossoverFrequency = unityCrossing.x;
  }

  let gainMargin: { value: number; frequency: number; isInfinite?: boolean } = {
    value: Infinity,
    frequency: 0,
    isInfinite: true,
  };

  let phaseCrossoverFrequency: number | undefined;

  const phaseCrossing = interpolateAtCrossing(frequencies, phaseDeg, -180);
  if (phaseCrossing) {
    const i = phaseCrossing.index;
    const magAtPc = linearInterpolate(
      frequencies[i],
      magnitudeDb[i],
      frequencies[i + 1],
      magnitudeDb[i + 1],
      phaseCrossing.x
    );

    gainMargin = {
      value: -magAtPc,
      frequency: phaseCrossing.x,
      isInfinite: false,
    };
    phaseCrossoverFrequency = phaseCrossing.x;
  }

  return {
    gainMargin,
    phaseMargin,
    gainCrossoverFrequency,
    phaseCrossoverFrequency,
  };
}

export function calculateTimeDomainResponse(request: TimeDomainRequest): TimeDomainResponse {
  const { start, end, step } = request.timeRange;

  if (step <= 0 || end <= start) {
    throw new Error('时间范围参数无效');
  }

  let num: number[];
  let den: number[];

  const selectedClosedLoopPoles = normalizeComplexArray(request.closedLoopPoles);
  if (selectedClosedLoopPoles.length > 0) {
    den = normalizePolynomial(polyFromRoots(selectedClosedLoopPoles));
    const dcDen = evaluatePolynomial(den, { re: 0, im: 0 }).re;
    const dcNumerator = Math.abs(dcDen) < EPS ? 1 : dcDen;
    num = [dcNumerator];
  } else {
    ({ num, den } = buildClosedLoopTransferFunction(request));
  }

  const n = den.length - 1;
  if (n < 1) {
    throw new Error('传递函数阶数必须大于 0');
  }

  const { a, b, c: cVec, d } = createCanonicalStateSpace(num, den);
  const input = makeInput(request.responseType, step);

  let x = Array.from({ length: n }, () => 0);
  const sampleCount = Math.floor((end - start) / step) + 1;
  const samples: Array<{ time: number; response: number }> = [];

  const derivative = (state: number[], t: number, index: number): number[] => {
    const u = input(t, index);
    const ax = matVecMul(a, state);
    const bu = vecScale(b, u);
    return vecAdd(ax, bu);
  };

  for (let i = 0; i < sampleCount; i += 1) {
    const t = start + i * step;
    const u = input(t, i);
    const y = dot(cVec, x) + d * u;
    samples.push({ time: t, response: Number.isFinite(y) ? y : 0 });

    if (i === sampleCount - 1) {
      break;
    }

    const k1 = derivative(x, t, i);
    const k2 = derivative(vecAdd(x, vecScale(k1, step / 2)), t + step / 2, i);
    const k3 = derivative(vecAdd(x, vecScale(k2, step / 2)), t + step / 2, i);
    const k4 = derivative(vecAdd(x, vecScale(k3, step)), t + step, i);

    x = x.map((value, idx) => value + (step / 6) * (k1[idx] + 2 * k2[idx] + 2 * k3[idx] + k4[idx]));
  }

  const metrics = computeStepMetrics(samples);
  return { samples, metrics };
}

export function calculateFrequencyDomainResponse(request: FrequencyDomainRequest): FrequencyDomainResponse {
  const { num, den } = buildOpenLoopTransferFunction(request);
  const nyquistSamples = sampleNyquistAdaptive(
    num,
    den,
    request.frequencyRange.min,
    request.frequencyRange.max,
    request.frequencyRange.points
  );

  const samples = nyquistSamples.map((item) => ({
    frequency: item.frequency,
    magnitudeDb: item.magnitudeDb,
    phaseDeg: item.phaseDeg,
  }));

  const margins = calculateMargins(
    samples.map((item) => item.frequency),
    samples.map((item) => item.magnitudeDb),
    samples.map((item) => item.phaseDeg)
  );

  return {
    samples,
    nyquistSamples,
    stabilityMargins: {
      gainMargin: margins.gainMargin,
      phaseMargin: margins.phaseMargin,
    },
    marginPoints: {
      gainCrossover:
        typeof margins.gainCrossoverFrequency === 'number'
          ? evaluateOpenLoopAtFrequency(num, den, margins.gainCrossoverFrequency)
          : undefined,
      phaseCrossover:
        typeof margins.phaseCrossoverFrequency === 'number'
          ? evaluateOpenLoopAtFrequency(num, den, margins.phaseCrossoverFrequency)
          : undefined,
    },
  };
}

function dampingRatio(pole: Complex): number {
  const magnitude = Math.sqrt(pole.re * pole.re + pole.im * pole.im);
  if (magnitude < EPS) {
    return 1;
  }
  return -pole.re / magnitude;
}

function buildHints(
  closedLoopPoles: Complex[],
  analysis: Pick<StabilityAnalysisResponse, 'isStable' | 'stabilityMargins' | 'polesInRHP'>
): string[] {
  const hints: string[] = [];

  const nearImaginary = closedLoopPoles.some((pole) => Math.abs(pole.re) < 0.3);
  if (nearImaginary) {
    hints.push('闭环极点靠近虚轴，系统阻尼减小，时域振荡可能加剧。');
  }

  if (!analysis.isStable) {
    hints.push('存在右半平面闭环极点，系统不稳定，建议在根轨迹上将闭环极点左移。');
  }

  if (!analysis.stabilityMargins.gainMargin.isInfinite && analysis.stabilityMargins.gainMargin.value < 6) {
    hints.push('增益裕度偏低，建议降低交叉频率或增加超前校正。');
  }

  if (analysis.stabilityMargins.phaseMargin.value < 30) {
    hints.push('相位裕度偏低，超调风险较高，可提升阻尼或减小回路增益。');
  }

  if (analysis.polesInRHP === 0 && hints.length === 0) {
    hints.push('闭环极点位于左半平面，稳定性良好，可继续优化速度与超调折中。');
  }

  return hints;
}

export function analyzeStability(spec: TransferFunctionSpec): StabilityAnalysisResponse {
  const poles = normalizeComplexArray(spec.poles);
  if (poles.length === 0) {
    throw new Error('至少需要一个开环极点');
  }

  const frequency = calculateFrequencyDomainResponse({
    ...spec,
    frequencyRange: {
      min: 0.05,
      max: 120,
      points: 180,
    },
  });

  const rootLocus = calculateRootLocus(spec);
  const closedLoopPoles = rootLocus.closedLoopPoles;
  const polesInRHP = closedLoopPoles.filter((pole) => pole.re > 0).length;
  const isStable = polesInRHP === 0;
  const dampingRatios = closedLoopPoles.map((pole) => dampingRatio(pole));

  const base = {
    isStable,
    stabilityMargins: frequency.stabilityMargins,
    polesInRHP,
  };

  return {
    ...base,
    dampingRatios,
    hints: buildHints(closedLoopPoles, base),
    closedLoopPoles,
    rootLocus,
  };
}
