import {
  computeVirtualSimulationStep,
  isVirtualSimulationRuntimeReady,
  preloadVirtualSimulationRuntime,
} from '@/resources/simulations/physics/simulation-engine-facade';
import type { TransferFunctionModel } from '@/lib/simulation';

export {
  isVirtualSimulationRuntimeReady as isInteractiveSimulationRuntimeReady,
  preloadVirtualSimulationRuntime as preloadInteractiveSimulationRuntime,
};

export interface PidBatchSimulationResult {
  times: number[];
  response: number[];
  setpoint: number[];
  metrics: {
    finalValue: number;
    steadyStateError: number;
    overshootPercent: number;
  };
}

export interface StepResponseMetrics {
  riseTime: number | null;
  peakTime: number | null;
  settlingTime: number | null;
  overshoot: number;
  steadyStateError: number;
  peakValue: number;
}

export interface SecondOrderStepResponseResult {
  times: number[];
  values: number[];
  metrics: StepResponseMetrics;
}

export interface TransferFunctionResponsePoint {
  t: number;
  y: number;
}

export interface TransferFunctionResponseResult {
  points: TransferFunctionResponsePoint[];
  minY: number;
  maxY: number;
  duration: number;
}

export interface SecondOrderAnalyticResponseResult {
  points: TransferFunctionResponsePoint[];
  tMax: number;
  overshoot: number;
  peakTime: number;
  settlingTime: number;
  riseTime: number;
  wd: number;
}

export const runPidBatchSimulation = (request: {
  model: TransferFunctionModel;
  dt: number;
  duration: number;
  reference: number;
  kp: number;
  ki: number;
  kd: number;
}): PidBatchSimulationResult =>
  computeVirtualSimulationStep<PidBatchSimulationResult>({
    modelId: 'linear_pid_batch',
    numerator: request.model.numerator,
    denominator: request.model.denominator,
    dt: request.dt,
    duration: request.duration,
    reference: request.reference,
    kp: request.kp,
    ki: request.ki,
    kd: request.kd,
  });

export const runSecondOrderStepResponse = (request: {
  zeta: number;
  omega: number;
  duration: number;
  dt: number;
}): SecondOrderStepResponseResult =>
  computeVirtualSimulationStep<SecondOrderStepResponseResult>({
    modelId: 'second_order_step_response',
    ...request,
  });

export const runTransferFunctionResponse = (request: {
  numerator: number[];
  denominator: number[];
  dt: number;
  duration: number;
  signal: 'step' | 'ramp' | 'impulse';
  maxSteps?: number;
}): TransferFunctionResponseResult =>
  computeVirtualSimulationStep<TransferFunctionResponseResult>({
    modelId: 'transfer_function_response',
    ...request,
  });

export const runSecondOrderAnalyticResponse = (request: {
  zeta: number;
  wn: number;
  steps?: number;
}): SecondOrderAnalyticResponseResult =>
  computeVirtualSimulationStep<SecondOrderAnalyticResponseResult>({
    modelId: 'second_order_analytic_response',
    ...request,
  });

export const stepCruiseTyphoonScenario = <TState>(request: {
  state: TState;
  dt: number;
  seaState: number;
}): TState =>
  computeVirtualSimulationStep<TState>({
    modelId: 'cruise_typhoon_step',
    ...request,
  });

export const stepChampagneTower = (request: {
  dt: number;
  lateralAccel: number;
  shipRollDeg: number;
  params: {
    height: number;
    dampingRatio: number;
    fallThreshold: number;
  };
  state: {
    angle: number;
    angularVelocity: number;
  };
}) =>
  computeVirtualSimulationStep<{
    angle: number;
    angularVelocity: number;
    isFalling: boolean;
    stability: number;
    lateralAccel: number;
  }>({
    modelId: 'champagne_tower_step',
    ...request,
  });
