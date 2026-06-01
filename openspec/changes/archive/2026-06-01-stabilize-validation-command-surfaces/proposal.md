## Why

Several validation commands currently fail before they reach project code. `npm run lint` scans `evaluate/test_repos`, and `test:model-render-policy` resolves a repository import from `scripts/tests` as if `src` lived under `scripts`. These command-surface defects create false failures for later dependency work.

## What Changes

- Align lint scope with the project source and existing TypeScript exclusions.
- Fix repository-root import resolution for standalone verification scripts.
- Define the expected minimum validation behavior for command entrypoints before deeper test-contract repairs.
- Do not update dependency versions or fix product contract drift in this change.

## Capabilities

### New Capabilities
- Adds command-surface requirements to `release-signal-noise-governance`.

### Modified Capabilities
- None.

## Impact

- Affects package scripts, ESLint ignore/configuration, and standalone test script import conventions.
- Unblocks accurate lint and script-level checks for later changes.
- Leaves failing product tests to the contract drift change.
