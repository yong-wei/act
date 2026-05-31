## Why

Next audit remediation requires moving beyond the current Next 14 line, but direct framework upgrade would combine API changes, lint changes, config changes, and cache behavior in one risky step. Preparation should remove known incompatibilities first.

## What Changes

- Prepare the codebase for Next major upgrade without changing the Next runtime major.
- Replace or isolate deprecated `next lint` usage.
- Convert image domain configuration to `remotePatterns` where applicable.
- Audit App Router route handlers, async `params/searchParams`, cache policy, middleware/proxy behavior, and standalone build assumptions.
- Produce a readiness report for the Next 15 upgrade change.

## Capabilities

### New Capabilities
- `dependency-vulnerability-catalog`: Adds the Next major-upgrade readiness requirement.

### Modified Capabilities
- None.

## Impact

- Affects `package.json` scripts, Next config, route-handler conventions, middleware/proxy review, build scripts, and documentation.
- Should avoid changing the installed Next major version.
- Reduces the risk of `upgrade-next15-validation`.
