## Why

The migration branch currently reports `68` TypeScript errors across `20` files before dependency upgrades begin. The failures are mostly stale test fixtures and type contracts that no longer match the current Next/App Router, Arena, control-workbench, adaptive assessment, teacher auth, Konling, and data-governance runtime surfaces. This makes `tsc --noEmit` unusable as a regression signal.

## What Changes

- Repair existing `tsc --noEmit` failures caused by stale fixtures, route parameter mocks, and current TypeScript target/lib drift.
- Prefer fixture and type-alignment fixes when runtime contracts are already correct.
- Apply minimal source contract fixes only where an existing spec requires the source behavior.
- Do not repair Vitest assertion drift except where required to make TypeScript pass.
- Do not update dependency versions or perform framework major migrations.

## Capabilities

### New Capabilities
- Adds typecheck-signal restoration requirements to `release-signal-noise-governance`.

### Modified Capabilities
- None.

## Impact

- Affects tests, fixtures, and minimal source type contracts.
- Restores `rtk npx tsc --noEmit --pretty false` as a meaningful gate before dependency upgrades.
