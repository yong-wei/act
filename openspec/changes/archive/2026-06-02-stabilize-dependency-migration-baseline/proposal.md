## Why

The migration branch now has clean typecheck and default test signals, but the dependency graph spans production runtime packages, build tooling, worker scripts, Docker image assembly, Prisma CLI behavior, and UI framework tooling. Moving everything to latest stable versions without a shared baseline would make failures hard to attribute.

## What Changes

- Establish the source-of-truth dependency migration baseline for both development and production environments.
- Record current Node/npm engines, lockfile state, `npm outdated`, `npm audit`, production/dev dependency boundaries, and known upstream audit residuals.
- Define the staged migration order and validation matrix for later executable changes.
- Do not upgrade packages, change lockfiles, or modify runtime code in this baseline change.

## Capabilities

### New Capabilities
- `stable-dependency-chain-migration`: Defines how the project migrates development and production dependency chains to latest stable versions without losing verification signal.

### Modified Capabilities
- `dependency-audit-governance`: Uses the baseline to classify audit findings that remain after latest-stable dependency checks.

## Impact

- Affects OpenSpec planning, issue coordination, and release validation criteria.
- Establishes downstream change dependencies for production runtime separation, low-risk package refresh, Next/React, Prisma, Tailwind, and 3D visualization upgrades.
- Provides the compatibility-test and browser-verification expectations that later changes must satisfy.
