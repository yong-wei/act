## 1. Baseline

- [ ] 1.1 Use a working Rust toolchain to run the current control-engine tests and record analysis size, modules, and exported facade.
- [ ] 1.2 Identify repeated numerical work by domain and reject candidates whose floating-point or error behavior is not proven equivalent.

## 2. Simplification

- [ ] 2.1 Move coherent time, frequency/Nyquist, root-locus, and nonlinear analysis internals behind one-way module boundaries.
- [ ] 2.2 Consolidate identical shared math and validation, then remove obsolete wrappers and duplicate code.

## 3. Verification

- [ ] 3.1 Run the control-engine test suite, WASM build, facade compatibility checks, and `git diff --check`.
- [ ] 3.2 Report before/after crate and analysis size, duplicate helpers removed, and unchanged ABI, tolerances, errors, and scoring boundaries.
