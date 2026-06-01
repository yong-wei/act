## Why

The release branch currently has multiple failing or misleading signals before dependency upgrades begin: lint scans vendored sample code, typecheck reports existing fixture drift, unit tests fail on already-known contract shifts, runtime logs retain stale fixed errors, and dependency audit/deprecation output mixes real risk with owned migration work. These signals make later package updates hard to attribute.

## What Changes

- Create a release signal noise catalog for the migration branch.
- Classify every known noisy signal as stale log residue, command-scope defect, existing contract drift, real blocking debt, owned residual dependency risk, or environment drift.
- Record the owner lane, follow-up change, and validation command for each signal.
- Do not change application code, package versions, lockfiles, or test behavior in this baseline change.

## Capabilities

### New Capabilities
- `release-signal-noise-governance`: Defines how release-readiness signals are cataloged before dependency and framework upgrades.

### Modified Capabilities
- None.

## Impact

- Affects OpenSpec planning and future issue coordination only.
- Establishes the source of truth for this clean-up series before any implementation change.
- Provides the dependency order for validation, UI, runtime log, environment, and dependency-audit clean-up work.
