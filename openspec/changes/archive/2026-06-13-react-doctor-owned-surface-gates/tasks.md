## 1. Baseline and Scope

- [x] 1.1 Capture the current React Doctor `0.5.1` error-only and Security category baselines with the existing command.
- [x] 1.2 Identify owned product roots and non-product fixture roots, including `evaluate/**/*`.
- [x] 1.3 Decide whether to use `doctor.config.*`, package `reactDoctor`, or wrapper scripts for scan scoping.

## 2. Local Gate Implementation

- [x] 2.1 Add or update local commands for owned-surface error-only React Doctor validation.
- [x] 2.2 Add or update local commands for owned-surface Security category React Doctor validation.
- [x] 2.3 Add a warning-summary command or helper that groups advisory findings without failing release checks by default.
- [x] 2.4 Update governance docs and tests so the gate remains local-only and CI-free.

## 3. Verification

- [x] 3.1 Run the owned-surface error-only gate and confirm it reports only product-owned errors.
- [x] 3.2 Run the owned-surface Security category gate and confirm it reports only product-owned security findings.
- [x] 3.3 Run the advisory warning summary and confirm `evaluate/**/*` diagnostics are excluded or separately classified.
- [x] 3.4 Run `rtk npm run test:commercial-ui-governance` or the targeted governance test covering React Doctor scripts.
