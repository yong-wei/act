## Why

React Doctor error and Security blocker channels are clean, but the advisory warning channel still reports 3,418 owned-surface diagnostics. Treating all warnings as equal would create noisy, risky cleanup work; ignoring them would hide real accessibility, App Router, and state/effect risks.

## What Changes

- Establish a React Doctor warning baseline that separates blocker channels from advisory remediation queues.
- Classify warning rules into product-risk, mechanical-cleanup, and tool-noise buckets.
- Define evidence format for per-series warning deltas, allowed R3F/Three false-positive handling, and owned-surface grouping.
- Keep React Doctor local-only and CI-free while making warning cleanup measurable.

## Capabilities

### Modified Capabilities

- `react-doctor-local-governance`: add warning-baseline classification, evidence, and remediation-series contracts.

## Impact

- Affects React Doctor wrapper reporting, documentation, OpenSpec cleanup planning, and local evidence artifacts.
- Does not turn warning diagnostics into CI blockers.
- Does not change application runtime behavior.
