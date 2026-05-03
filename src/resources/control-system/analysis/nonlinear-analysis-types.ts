'use client';

export type NonlinearAnalysisKind =
  | 'phase_plane'
  | 'harmonic_lowpass'
  | 'characteristic'
  | 'negative_inverse_family'
  | 'turning_radius';

export interface NonlinearTimeRangeConfig {
  start: number;
  end: number;
  samples: number;
}

export interface NonlinearAnalysisRequest {
  runtimeMode: 'nonlinear_analysis';
  analysisKind: NonlinearAnalysisKind;
  modelId: string;
  parameters?: Record<string, number | string | boolean>;
  initialPoint?: [number, number];
  timeRange: NonlinearTimeRangeConfig;
}

export interface NonlinearPoint {
  x: number;
  y: number;
}

export interface NonlinearComplexPoint {
  re: number;
  im: number;
}

export interface NonlinearAnalysisResult {
  phasePlane?: {
    vectorField: Array<{ x: number; y: number; dx: number; dy: number }>;
    trajectories: Array<{ id: string; points: NonlinearPoint[] }>;
  };
  harmonic?: {
    input: NonlinearPoint[];
    relayOutput: NonlinearPoint[];
    filteredOutput: NonlinearPoint[];
    describingFunctionApproximation: NonlinearPoint[];
    spectrum: Array<{ harmonic?: number; amplitude?: number; x?: number; y?: number }>;
  };
  characteristic?: {
    curve: NonlinearPoint[];
    sineEnvelope: NonlinearPoint[];
    describingFunction: { re: number; im: number };
  };
  negativeInverse?: {
    curves: Array<{
      id: string;
      label: string;
      points: NonlinearComplexPoint[];
      marks: Record<string, string>;
    }>;
  };
  turningRadius?: {
    dStartM: number;
    deltaDDeg: number;
    maxDeltaDeg: number;
    saturationActive: boolean;
    safetyConstraintSatisfied: boolean;
    headingCurves: Array<{
      id: string;
      label: string;
      points: NonlinearPoint[];
    }>;
    path: {
      actual: NonlinearPoint[];
      nominal: NonlinearPoint[];
      obstacleCenter: NonlinearPoint;
      obstacleRadius: number;
      clearanceRadius: number;
    };
  };
  summary: {
    outcome: string;
    metrics: string[];
  };
  isFallback?: boolean;
  fallbackMessage?: string;
}

export interface NonlinearAnalysisEngineState {
  result: NonlinearAnalysisResult | null;
  isLoading: boolean;
  error: string | null;
  isFallback: boolean;
  requestKey: string;
  resultRequestKey: string | null;
}
