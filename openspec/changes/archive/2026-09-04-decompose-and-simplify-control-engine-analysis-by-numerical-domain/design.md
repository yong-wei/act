## Context

The Rust facade is stable and analysis already has the correct owner. The remaining work is to reduce repeated numerical plumbing inside `analysis.rs` while keeping that facade untouched.

## Goals / Non-Goals

**Goals:**

- Separate real numerical domains with one-way internal dependencies.
- Share only genuinely identical math, validation, and result construction.
- Reduce the crate's analysis implementation without changing numerical behavior.

**Non-Goals:**

- No WASM ABI, JSON shape, TypeScript facade, tolerance, scoring, or runtime change.
- No mechanical split into same-sized files.

## Decisions

1. Keep common transfer-function math and shared result/error types below time, frequency/Nyquist, root-locus, and nonlinear analysis modules.
2. Move a function only when its numerical responsibility is clear; otherwise simplify it in place.
3. Consolidate repeated sampling, complex conversion, metrics, and range checks only after focused tests prove equivalence.
4. Keep `lib.rs` and exported WASM functions as the stable outer boundary.

## Risks / Trade-offs

- **A shared helper may change floating-point order.** Preserve operation order unless existing tolerance tests prove equivalence.
- **Module extraction may add wrappers.** Prefer direct internal calls and reject pass-through layers.
