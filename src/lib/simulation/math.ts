export const identity = (n: number) =>
  Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => (i === j ? 1 : 0))
  );

export const matAdd = (a: number[][], b: number[][]) =>
  a.map((row, i) => row.map((value, j) => value + (b[i]?.[j] ?? 0)));

export const matSub = (a: number[][], b: number[][]) =>
  a.map((row, i) => row.map((value, j) => value - (b[i]?.[j] ?? 0)));

export const matScale = (a: number[][], scalar: number) =>
  a.map((row) => row.map((value) => value * scalar));

export const matMul = (a: number[][], b: number[][]) => {
  const rows = a.length;
  const cols = b[0]?.length ?? 0;
  const mid = b.length;
  const out = Array.from({ length: rows }, () => Array(cols).fill(0));
  for (let i = 0; i < rows; i += 1) {
    for (let k = 0; k < mid; k += 1) {
      const aik = a[i]?.[k] ?? 0;
      if (!aik) continue;
      for (let j = 0; j < cols; j += 1) {
        out[i][j] += aik * (b[k]?.[j] ?? 0);
      }
    }
  }
  return out;
};

export const matVecMul = (a: number[][], v: number[]) =>
  a.map((row) => row.reduce((sum, value, idx) => sum + value * (v[idx] ?? 0), 0));

export const vecAdd = (a: number[], b: number[]) => a.map((value, i) => value + (b[i] ?? 0));

export const vecScale = (v: number[], scalar: number) => v.map((value) => value * scalar);

export const invertMatrix = (matrix: number[][]) => {
  const n = matrix.length;
  const augmented = matrix.map((row, i) => [...row, ...identity(n)[i]]);
  for (let col = 0; col < n; col += 1) {
    let pivotRow = col;
    for (let row = col + 1; row < n; row += 1) {
      if (Math.abs(augmented[row][col]) > Math.abs(augmented[pivotRow][col])) {
        pivotRow = row;
      }
    }
    if (Math.abs(augmented[pivotRow][col]) < 1e-12) {
      throw new Error('Matrix is singular');
    }
    if (pivotRow !== col) {
      const temp = augmented[col];
      augmented[col] = augmented[pivotRow];
      augmented[pivotRow] = temp;
    }
    const pivot = augmented[col][col];
    for (let j = 0; j < 2 * n; j += 1) {
      augmented[col][j] /= pivot;
    }
    for (let row = 0; row < n; row += 1) {
      if (row === col) continue;
      const factor = augmented[row][col];
      if (!factor) continue;
      for (let j = 0; j < 2 * n; j += 1) {
        augmented[row][j] -= factor * augmented[col][j];
      }
    }
  }
  return augmented.map((row) => row.slice(n));
};
