import type { TransferFunctionModel } from '@/lib/simulation';

export interface ShipState {
  y: number;
  v: number;
  u: number;
  r: number;
}

export interface RustSimulationState extends ShipState {
  time: number;
  baseOffset: number;
  baseY: number;
  lastBaseY: number;
  plantState: number[];
  delayBuffer: number[];
  integral: number;
  prevError: number;
  speedFeedbackState: number;
  predictorNoDelayState: number[];
  predictorDelayState: number[];
  predictorDelayBuffer: number[];
  predictorNoDelayY: number;
  predictorDelayY: number;
  lastMode: 'manual' | 'auto' | null;
}

export interface ControlParams {
  plantModel: TransferFunctionModel;
  controlRate?: number;
  mode: 'MANUAL' | 'AUTO';
  pid: {
    kp: number;
    ki: number;
    kd: number;
  };
  speedFeedback?: {
    enabled: boolean;
    tau: number;
  };
  feedforward?: {
    enabled: boolean;
    gain: number;
    base?: number;
  };
  smithPredictor?: {
    enabled: boolean;
    delay: number;
  };
  outputLimits?: RustControllerLimits;
}

export interface RustControllerLimits {
  manual?: number;
  p?: number;
  i?: number;
  d?: number;
  vfb?: number;
  ff?: number;
}

export interface BuildRustSimulationRequestArgs extends ControlParams {
  dt: number;
  inputCommand: number;
  disturbance: number;
  state: RustSimulationState;
}

export interface RustSimulationRequest {
  model: {
    type: 'transferFunction';
    coefficientOrder: 'ascending';
    numerator: number[];
    denominator: number[];
    delay: number;
  };
  controller: {
    mode: 'manual' | 'auto';
    pid: ControlParams['pid'];
    speedFeedback?: ControlParams['speedFeedback'];
    feedforward?: ControlParams['feedforward'];
    smithPredictor?: ControlParams['smithPredictor'];
    limits?: RustControllerLimits;
    controlRate?: number;
    setpointRate?: number;
  };
  state: RustSimulationState;
  input: {
    dt: number;
    inputCommand: number;
    disturbance: number;
  };
}

export interface RustSimulationResult {
  state: RustSimulationState;
  sample: {
    time: number;
    reference: number;
    output: number;
    plantOutput: number;
    control: number;
    error: number;
    controllerTerms: {
      p: number;
      i: number;
      d: number;
      vfb: number;
      ff: number;
    };
    smith: {
      enabled: boolean;
      feedbackOutput: number;
      noDelayOutput: number;
      delayOutput: number;
    };
  };
}

export const createInitialRustSimulationState = (initialY: number = 200): RustSimulationState => ({
  time: 0,
  baseOffset: initialY,
  baseY: initialY,
  lastBaseY: initialY,
  plantState: [],
  delayBuffer: [],
  integral: 0,
  prevError: 0,
  speedFeedbackState: 0,
  predictorNoDelayState: [],
  predictorDelayState: [],
  predictorDelayBuffer: [],
  predictorNoDelayY: initialY,
  predictorDelayY: initialY,
  lastMode: 'manual',
  y: initialY,
  v: 0,
  u: 0,
  r: initialY,
});

export const buildRustSimulationRequest = ({
  dt,
  inputCommand,
  disturbance,
  plantModel,
  mode,
  pid,
  speedFeedback,
  feedforward,
  smithPredictor,
  outputLimits,
  controlRate,
  state,
}: BuildRustSimulationRequestArgs): RustSimulationRequest => ({
  model: {
    type: 'transferFunction',
    coefficientOrder: 'ascending',
    numerator: plantModel.numerator,
    denominator: plantModel.denominator,
    delay: plantModel.delay ?? 0,
  },
  controller: {
    mode: mode === 'AUTO' ? 'auto' : 'manual',
    pid,
    speedFeedback,
    feedforward,
    smithPredictor,
    limits: outputLimits,
    controlRate,
    setpointRate: 120,
  },
  state,
  input: {
    dt,
    inputCommand,
    disturbance,
  },
});
