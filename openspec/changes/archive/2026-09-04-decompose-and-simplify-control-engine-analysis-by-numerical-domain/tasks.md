## 1. Baseline

- [x] 1.1 Use a working Rust toolchain to run the current control-engine tests and record analysis size, modules, and exported facade.
- [x] 1.2 Identify repeated numerical work by domain and reject candidates whose floating-point or error behavior is not proven equivalent.

## 2. Simplification

- [x] 2.1 Move coherent time, frequency/Nyquist, root-locus, and nonlinear analysis internals behind one-way module boundaries.
- [x] 2.2 Consolidate identical shared math and validation, then remove obsolete wrappers and duplicate code.

## 3. Verification

- [x] 3.1 Run the control-engine test suite, WASM build, facade compatibility checks, and `git diff --check`.
- [x] 3.2 Report before/after crate and analysis size, duplicate helpers removed, and unchanged ABI, tolerances, errors, and scoring boundaries.
