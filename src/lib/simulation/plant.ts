import type {
  DiscreteStateSpaceModel,
  NonlinearModel,
  SolverType,
  StateSpaceModel,
  TransferFunctionModel,
} from './types';
import { DelayLine } from './delay';
import { discretizeStateSpaceTustin, discretizeTransferFunctionTustin, stepDiscreteStateSpace } from './linear';
import { integrateStep } from './integrators';

const zeros = (size: number) => Array.from({ length: size }, () => 0);

export const createLinearPlant = (
  model: TransferFunctionModel | StateSpaceModel,
  dt: number,
  initialState?: number[]
) => {
  const discrete = model.type === 'transfer_function'
    ? discretizeTransferFunctionTustin(model, dt)
    : discretizeStateSpaceTustin(model, dt);
  const stateSize = discrete.A.length;
  const outputSize = discrete.C.length;
  const inputSize = discrete.B[0]?.length ?? 0;
  let state = initialState ? [...initialState] : zeros(stateSize);
  let output = zeros(outputSize);
  let time = 0;
  const delay = model.delay ?? 0;
  const delayLine = delay > 0 ? new DelayLine<number[]>(delay, dt, zeros(inputSize)) : null;

  const step = (input: number[]) => {
    const appliedInput = delayLine ? delayLine.push([...input]) : input;
    const result = stepDiscreteStateSpace(discrete, state, appliedInput);
    state = result.state;
    output = result.output;
    time += dt;
    return { state, output, time };
  };

  const reset = (nextState?: number[]) => {
    state = nextState ? [...nextState] : zeros(stateSize);
    output = zeros(outputSize);
    time = 0;
    if (delayLine) {
      delayLine.reset(zeros(inputSize));
    }
  };

  return { step, reset, getState: () => ({ state, output, time }), discrete };
};

export const createNonlinearPlant = (
  model: NonlinearModel,
  dt: number,
  solver: SolverType,
  initialState?: number[]
) => {
  const stateSize = model.stateSize;
  const outputSize = model.outputSize ?? model.stateSize;
  const inputSize = model.inputSize;
  let state = initialState ? [...initialState] : zeros(stateSize);
  let output = zeros(outputSize);
  let time = 0;
  const delay = model.delay ?? 0;
  const delayLine = delay > 0 ? new DelayLine<number[]>(delay, dt, zeros(inputSize)) : null;

  const step = (input: number[]) => {
    const appliedInput = delayLine ? delayLine.push([...input]) : input;
    state = integrateStep(solver, model, state, appliedInput, time, dt);
    output = model.output ? model.output(state, appliedInput, time, model.params) : [...state];
    time += dt;
    return { state, output, time };
  };

  const reset = (nextState?: number[]) => {
    state = nextState ? [...nextState] : zeros(stateSize);
    output = zeros(outputSize);
    time = 0;
    if (delayLine) {
      delayLine.reset(zeros(inputSize));
    }
  };

  return { step, reset, getState: () => ({ state, output, time }) };
};
