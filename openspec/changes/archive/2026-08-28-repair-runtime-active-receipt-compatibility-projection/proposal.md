## Why

The new compatibility-proof projection adds a required `compatibility` member to v2 active Runtime receipts, but the application-side v2 receipt reader still rejects that member. The daily same-identity requalification path can also retain the old proof instead of projecting the proof it has just verified.

## What Changes

- Extend the application reader's strict v2 active-receipt validation to accept and validate the canonical compatibility projection without exposing it from public readiness.
- Re-project the newly qualified proof through the existing journaled activation transaction even when a daily activation keeps the same Runtime Release identity.
- Add focused regression tests for both receipt consumption and same-identity proof refresh.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `runtime-main-app-compatibility-proof`: active receipt consumption and requalification must preserve the exact proof that was verified for the current application environment.

## Impact

- `src/lib/runtime-active-release.ts` and its Vitest coverage.
- `scripts/runtime-release/activate-runtime-blob-release.sh` and Runtime activation contract tests.
- The existing journaled Runtime activation transaction and active receipt schema; no public readiness field is added.
