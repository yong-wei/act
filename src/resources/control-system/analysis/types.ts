'use client';

export type AnalysisOutputKind =
  | 'step_response'
  | 'root_locus'
  | 'magnitude'
  | 'phase'
  | 'nyquist'
  | 'bode';

export type StructureKind =
  | 'gain'
  | 'p'
  | 'pi'
  | 'pd'
  | 'pid'
  | 'lead'
  | 'lag'
  | 'lead_lag';

export interface TransferFunctionSpec {
  numerator: number[];
  denominator: number[];
  coefficientOrder: 'descending';
  label?: string;
}

export interface StructureSpec {
  kind: StructureKind;
  enabled: boolean;
  params: Record<string, number>;
  label?: string;
}

export interface TimeRangeConfig {
  start: number;
  end: number;
  samples: number;
}

export interface FrequencyRangeConfig {
  min: number;
  max: number;
  samples: number;
}

export interface NyquistConfig {
  mode?: 'full' | 'half';
  samplingMode?: 'adaptive' | 'fixed';
}

export interface RootLocusConfig {
  minGain: number;
  maxGain: number;
  samples: number;
  currentGain: number;
  increment?: number;
  samplingMode?: 'adaptive' | 'fixed';
}

export interface FeasibleRegionConfig {
  zetaMin: number;
  sigmaMin: number;
  mpRatio?: number;
  settlingTime?: number;
}

export interface DiscreteConfig {
  sampleTime: number;
  method: 'tustin' | 'zoh';
}

export interface StateSpaceSpec {
  A: number[][];
  B: number[][];
  C: number[][];
  D: number[][];
}

export interface SignalProfilePoint {
  time: number;
  value: number;
}

export interface ControlAnalysisRequest {
  runtimeMode: 'analysis';
  caseId?: string;
  plant: TransferFunctionSpec;
  structures: StructureSpec[];
  outputs: AnalysisOutputKind[];
  responseType?: 'step' | 'impulse' | 'ramp';
  timeRange: TimeRangeConfig;
  frequencyRange: FrequencyRangeConfig;
  nyquist?: NyquistConfig;
  rootLocus: RootLocusConfig;
  feasibleRegion?: FeasibleRegionConfig;
  delay?: number;
  discreteConfig?: DiscreteConfig;
  stateSpaceSpec?: StateSpaceSpec;
  referenceProfile?: SignalProfilePoint[];
  disturbanceProfile?: SignalProfilePoint[];
}

export interface ControlMetrics {
  overshootPct: number;
  riseTimeSec: number | null;
  settlingTimeSec: number | null;
  peakTimeSec: number | null;
  finalValue: number;
  phaseMarginDeg: number | null;
  gainMarginDb: number | null;
  gainCrossoverRadPerSec: number | null;
  phaseCrossoverRadPerSec: number | null;
  bandwidthRadPerSec: number | null;
}

export interface CurvePoint {
  x: number;
  y: number;
}

export interface ComplexPoint {
  re: number;
  im: number;
}

export interface NyquistSamplePoint extends ComplexPoint {
  frequency: number;
  magnitudeDb: number;
  phaseDeg: number;
}

export interface RootLocusSamplePoint extends ComplexPoint {
  gain?: number;
  branchId?: number;
  sampleIndex?: number;
}

export interface StepResponseData {
  points: CurvePoint[];
}

export interface BodeAxisData {
  points: CurvePoint[];
}

export interface NyquistClosureSegment {
  points: ComplexPoint[];
  segments?: ComplexPoint[][];
  lineStyle: 'dashed';
}

export type NyquistSegmentType =
  | 'regular_positive'
  | 'regular_negative'
  | 'infinity_arc'
  | 'big_arc'
  | 'connector'
  | 'asymptote'
  | string;

export interface NyquistSegmentMetadata {
  poleLocation?: ComplexPoint;
  poleOrder?: number;
  frequencyInterval?: [number, number];
  parameterRange?: [number, number];
  layerIndex?: number;
  isAuxiliary?: boolean;
  collapsed?: boolean;
  branch?: 'positive' | 'negative' | string;
  [key: string]: unknown;
}

export interface NyquistSegment {
  type: NyquistSegmentType;
  points: ComplexPoint[];
  direction?: string;
  lineStyle?: 'solid' | 'dashed' | 'dotted' | string;
  metadata?: NyquistSegmentMetadata;
}

export interface NyquistKeyPoint {
  kind: 'real_axis_crossing' | 'imaginary_axis_crossing' | 'unit_circle_crossing' | string;
  point: ComplexPoint;
  frequency: number;
}

export interface NyquistAsymptote {
  end: 'low_frequency' | 'high_frequency' | string;
  kind: 'infinite' | 'zero' | string;
  angleDeg?: number;
  point?: ComplexPoint;
}

export interface NyquistCriterion {
  n: number;
  p: number;
  z: number;
  relation: 'Z = P + N';
  isConsistent: boolean;
}

export interface NyquistData {
  points: ComplexPoint[];
  mode?: 'full' | 'half';
  positivePoints?: ComplexPoint[];
  negativePoints?: ComplexPoint[];
  positiveSamples?: NyquistSamplePoint[];
  negativeSamples?: NyquistSamplePoint[];
  segments?: NyquistSegment[];
  infinityClosure?: NyquistClosureSegment;
  keyPoints?: NyquistKeyPoint[];
  asymptotes?: NyquistAsymptote[];
  encirclements?: number;
  criterion?: NyquistCriterion;
}

export interface RealAxisSegment {
  start?: number;
  end?: number;
}

export interface RootLocusAsymptote {
  centroid: number;
  angleDeg: number;
}

export type RootLocusSegmentType =
  | 'real_axis_locus'
  | 'branch'
  | 'branch_completion'
  | 'near_pole'
  | 'regular'
  | 'near_break'
  | 'near_zero'
  | 'asymptotic_tail'
  | 'asymptote';

export interface RootLocusSegmentPoint extends ComplexPoint {
  gain?: number;
  branchId?: number;
  sampleIndex?: number;
}

export interface RootLocusSegmentMetadata {
  branchId?: number;
  angleDeg?: number;
  isAuxiliary?: boolean;
  endpointType?: 'finite_zero' | 'infinity' | string;
  targetZeroIndex?: number;
  terminalDistance?: number;
  samplingParameter?: 'gain' | 'mu' | string;
}

export interface RootLocusSegment {
  type: RootLocusSegmentType;
  lineStyle: 'solid' | 'dashed';
  points: RootLocusSegmentPoint[];
  metadata?: RootLocusSegmentMetadata;
}

export type RootLocusEventType =
  | 'open_loop_pole'
  | 'open_loop_zero'
  | 'breakaway'
  | 'reentry'
  | 'imaginary_axis_crossing'
  | 'infinity_endpoint'
  | string;

export interface RootLocusEvent {
  type: RootLocusEventType;
  point: ComplexPoint;
  gain?: number;
  branchId?: number;
  label?: string;
}

export type RootLocusStructuredSegmentType =
  | 'near_pole'
  | 'regular'
  | 'near_break'
  | 'near_zero'
  | 'asymptotic_tail'
  | 'asymptote'
  | string;

export interface RootLocusStructuredSegment {
  id: string;
  type: RootLocusStructuredSegmentType;
  branchId?: number;
  points: RootLocusSegmentPoint[];
  isAuxiliary?: boolean;
}

export interface RootLocusBranchDescriptor {
  id: number;
  startEventType?: RootLocusEventType;
  endEventType?: RootLocusEventType;
  segmentIds: string[];
}

export interface RootLocusBranchStructure {
  branches: RootLocusBranchDescriptor[];
  segments: RootLocusStructuredSegment[];
}

export interface RootLocusView {
  x: [number, number];
  y: [number, number];
  includeSegmentTypes?: RootLocusStructuredSegmentType[];
  excludeSegmentTypes?: RootLocusStructuredSegmentType[];
}

export interface RootLocusViews {
  feature: RootLocusView;
  full: RootLocusView;
}

export interface RootLocusFiniteZeroCoverage {
  matchedCount: number;
  totalCount: number;
  maxTerminalDistance: number;
  allMatchedWithinTolerance: boolean;
}

export interface RootLocusDiagnostics {
  finiteZeroCoverage: RootLocusFiniteZeroCoverage;
  assignmentWarnings: string[];
}

export interface RootLocusAngle {
  point: ComplexPoint;
  angleDeg: number;
}

export interface RootLocusData {
  branches: RootLocusSamplePoint[][];
  fullBranches?: RootLocusSamplePoint[][];
  segments?: RootLocusSegment[];
  events?: RootLocusEvent[];
  branchStructure?: RootLocusBranchStructure;
  views?: RootLocusViews;
  diagnostics?: RootLocusDiagnostics;
  suggestedInsets?: RootLocusView[];
  gains?: number[];
  realAxisSegments?: RealAxisSegment[];
  stationaryPoints?: RootLocusSamplePoint[];
  asymptotes?: RootLocusAsymptote[];
  imaginaryAxisCrossings?: RootLocusSamplePoint[];
  departureAngles?: RootLocusAngle[];
  arrivalAngles?: RootLocusAngle[];
  currentPoles: ComplexPoint[];
  currentGain?: number;
  openLoopPoles: ComplexPoint[];
  openLoopZeros: ComplexPoint[];
  feasibleRegion?: FeasibleRegionConfig;
}

export interface ControlAnalysisResult {
  metrics: ControlMetrics;
  stepResponse: StepResponseData;
  magnitude: BodeAxisData;
  phase: BodeAxisData;
  nyquist: NyquistData;
  rootLocus: RootLocusData;
  isFallback?: boolean;
  fallbackMessage?: string;
}

export interface ControlEngineState {
  result: ControlAnalysisResult | null;
  isLoading: boolean;
  error: string | null;
  isFallback: boolean;
}
