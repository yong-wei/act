## Why

The current Next 14 line remains covered by many audit findings. Moving first to a validated Next 15 line gives the project a smaller, reviewable framework migration before considering Next 16.

## What Changes

- Upgrade Next to a supported Next 15 release that addresses the relevant audit findings available on that line.
- Apply required React, TypeScript, ESLint, route, cache, and config compatibility fixes.
- Validate primary app routes, API routes, build output, and deployment assumptions.
- Leave Next 16-specific changes out of scope.

## Capabilities

### New Capabilities
- `dependency-vulnerability-catalog`: Adds the Next 15 framework remediation requirement.

### Modified Capabilities
- None.

## Impact

- Affects framework packages, lockfile, route/runtime compatibility, lint/build scripts, and possibly React peer dependencies.
- Requires broad build and route validation.
- Targets the migration branch, not `integration` directly.
