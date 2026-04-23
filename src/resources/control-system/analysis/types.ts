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

export interface RootLocusConfig {
  minGain: number;
  maxGain: number;
  samples: number;
  currentGain: number;
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

export interface RootLocusSamplePoint extends ComplexPoint {
  gain?: number;
}

export interface StepResponseData {
  points: CurvePoint[];
}

export interface BodeAxisData {
  points: CurvePoint[];
}

export interface NyquistData {
  points: ComplexPoint[];
}

export interface RootLocusData {
  branches: RootLocusSamplePoint[][];
  fullBranches?: RootLocusSamplePoint[][];
  currentPoles: ComplexPoint[];
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
