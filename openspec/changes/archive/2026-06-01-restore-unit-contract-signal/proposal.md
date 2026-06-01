## Why

`npm run test:unit` currently fails in a focused set of existing contract assertions: interactive manifest standardization, data-governance feature-cache state, lesson entry knowledge-map ordering, and dynamic API route guards. These failures are separate from TypeScript compilation and should be restored as a runtime contract signal before dependency upgrades.

## What Changes

- Repair existing Vitest failures that reflect stale test expectations or missing source behavior under current specs.
- Align interactive manifest tests with canonical module classes and renderer coverage.
- Align data-governance status expectations with current feature-cache payload/version semantics.
- Repair dynamic API route guard gaps or stale assertions according to existing route behavior specs.
- Do not repair unrelated TypeScript-only failures except where shared fixtures already compile.
- Do not update dependency versions.

## Capabilities

### New Capabilities
- Adds unit-contract signal restoration requirements to `release-signal-noise-governance`.

### Modified Capabilities
- None.

## Impact

- Affects unit tests, fixtures, and minimal source behavior where an existing spec requires it.
- Restores `rtk npm run test:unit` as a meaningful runtime contract gate.
