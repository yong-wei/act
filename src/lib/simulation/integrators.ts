import { vecAdd, vecScale } from './math';
import type { NonlinearModel, SolverType } from './types';

export const eulerStep = (
  model: NonlinearModel,
  state: number[],
  input: number[],
  t: number,
  dt: number
) => {
  const dxdt = model.derivatives(state, input, t, model.params);
  return vecAdd(state, vecScale(dxdt, dt));
};

export const rk4Step = (
  model: NonlinearModel,
  state: number[],
  input: number[],
  t: number,
  dt: number
) => {
  const k1 = model.derivatives(state, input, t, model.params);
  const k2 = model.derivatives(vecAdd(state, vecScale(k1, dt / 2)), input, t + dt / 2, model.params);
  const k3 = model.derivatives(vecAdd(state, vecScale(k2, dt / 2)), input, t + dt / 2, model.params);
  const k4 = model.derivatives(vecAdd(state, vecScale(k3, dt)), input, t + dt, model.params);
  const weighted = k1.map((value, i) => value + 2 * k2[i] + 2 * k3[i] + k4[i]);
  return vecAdd(state, vecScale(weighted, dt / 6));
};

export const integrateStep = (
  solver: SolverType,
  model: NonlinearModel,
  state: number[],
  input: number[],
  t: number,
  dt: number
) => {
  if (solver === 'runge_kutta_4') {
    return rk4Step(model, state, input, t, dt);
  }
  return eulerStep(model, state, input, t, dt);
};
