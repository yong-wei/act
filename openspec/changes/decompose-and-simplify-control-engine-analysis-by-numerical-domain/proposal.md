## Why

The Rust control-engine now has the correct owner and stable WASM facade, but `analysis.rs` is still a 192 KB center. A second pass should reduce repeated numerical plumbing inside that owner rather than merely moving code between files.

## What Changes

- Group analysis internals by real numerical domain: common transfer-function math, time domain, frequency/Nyquist, root locus, and nonlinear analysis.
- Consolidate repeated sampling, complex conversion, range validation, metrics, and error mapping only where behavior is identical.
- Keep module dependencies one-way and remove forwarding wrappers that add no contract.
- Preserve the existing WASM facade, result shapes, tolerances, non-finite handling, and Arena authority boundary.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `control-engine-wasm-facade`: require numerical-domain decomposition to produce a real simplification while preserving the public facade and numerical behavior.

## Impact

- Primary code: `rust/control-engine/src/analysis.rs` and focused Rust characterization tests.
- No TypeScript API, WASM ABI, persisted format, scoring rule, or deployment change.
