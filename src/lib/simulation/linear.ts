import type {
  DiscreteStateSpaceModel,
  StateSpaceModel,
  TransferFunctionModel,
} from './types';
import {
  identity,
  invertMatrix,
  matAdd,
  matMul,
  matScale,
  matSub,
  matVecMul,
  vecAdd,
} from './math';

export const transferFunctionToStateSpace = (tf: TransferFunctionModel): StateSpaceModel => {
  const { numerator, denominator } = tf;

  const leading = denominator[denominator.length - 1] || 1;
  const normDen = denominator.map((c) => c / leading);
  const normNum = numerator.map((c) => c / leading);

  const order = normDen.length - 1;
  if (order <= 0) {
    const gain = normNum[0] ?? 0;
    return {
      type: 'state_space',
      A: [[0]],
      B: [[1]],
      C: [[gain]],
      D: [[0]],
      params: tf.params,
      name: tf.name,
      delay: tf.delay,
    };
  }

  const A: number[][] = Array.from({ length: order }, () => Array(order).fill(0));
  for (let i = 0; i < order - 1; i += 1) {
    A[i][i + 1] = 1;
  }
  for (let i = 0; i < order; i += 1) {
    A[order - 1][i] = -(normDen[i] ?? 0);
  }

  const B: number[][] = Array.from({ length: order }, () => [0]);
  B[order - 1][0] = 1;

  const C: number[][] = [Array(order).fill(0)];
  for (let i = 0; i < Math.min(normNum.length, order); i += 1) {
    C[0][i] = normNum[i] ?? 0;
  }

  const D: number[][] = [[normNum.length > order ? normNum[order] ?? 0 : 0]];

  return {
    type: 'state_space',
    A,
    B,
    C,
    D,
    params: tf.params,
    name: tf.name,
    delay: tf.delay,
  };
};

export const discretizeStateSpaceTustin = (
  model: StateSpaceModel,
  dt: number
): DiscreteStateSpaceModel => {
  const A = model.A;
  const B = model.B;
  const C = model.C;
  const D = model.D;
  const n = A.length;

  const I = identity(n);
  const half = dt / 2;
  const Ahalf = matScale(A, half);
  const inv = invertMatrix(matSub(I, Ahalf));
  const Ad = matMul(inv, matAdd(I, Ahalf));
  const Bd = matMul(inv, matScale(B, dt));
  const Cd = matMul(C, inv);
  const Dd = matAdd(D, matScale(matMul(Cd, B), half));

  return {
    type: 'state_space_discrete',
    A: Ad,
    B: Bd,
    C: Cd,
    D: Dd,
    dt,
    params: model.params,
    name: model.name,
    delay: model.delay,
  };
};

export const discretizeTransferFunctionTustin = (
  model: TransferFunctionModel,
  dt: number
) => discretizeStateSpaceTustin(transferFunctionToStateSpace(model), dt);

export const stepDiscreteStateSpace = (
  model: DiscreteStateSpaceModel,
  state: number[],
  input: number[]
) => {
  const nextState = vecAdd(matVecMul(model.A, state), matVecMul(model.B, input));
  const output = vecAdd(matVecMul(model.C, nextState), matVecMul(model.D, input));
  return { state: nextState, output };
};
