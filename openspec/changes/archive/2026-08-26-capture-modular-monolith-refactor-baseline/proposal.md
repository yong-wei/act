## Why

ACT's current architecture decisions are being made from a mixture of directory names, historical evidence, and broad estimates. A fresh read on `integration@dd5be47fad96d9b3e1bd1b56115d94a6c4358713` confirms the structural concern but also corrects important details: the cold TypeScript program peaks at 5,874,728,960 bytes RSS, `test:unit` has 93 failing tests in 37 files plus three unhandled errors, `npm test` is itself red on stale product-QA evidence, and only two non-test feature files currently import App Router modules directly. The refactor needs a revision-bound, denominator-closed fact base before it fixes boundaries or moves code.

## What Changes

- Add a deterministic, read-only architecture census for product code, workers, toolchains, tests, routes, APIs, Prisma models, event contracts, scripts, dependency edges, reverse dependencies, cross-domain deep imports, cycles, compatibility surfaces, hard gates, and oversized change centers.
- Bind every baseline artifact to one clean Git commit and record the commands, scope, environment, and limitations required to reproduce each measurement.
- Publish current-owner and target-owner candidate inventories without silently resolving ambiguous ownership; unresolved items remain explicit inputs to the follow-up charter change.
- Reconcile every inventory denominator, including the complete declared dependency-edge set and its strongly connected components, and classify observations by evidence strength, change reason, and trust-boundary role rather than treating file size or directory placement alone as a defect.
- Record the current test, CI, TypeScript, dependency, compatibility, and deprecation baselines in machine-readable and human-readable forms suitable for later monotonic gates.
- Keep this change read-only with respect to product behavior, CI enforcement, build configuration, database state, runtime releases, and production selectors.

## Capabilities

### New Capabilities

- `modular-monolith-architecture-baseline`: Defines revision-bound, reproducible, denominator-closed architecture evidence and ownership inventories for the ACT refactor.

### Modified Capabilities

None.

## Impact

- Adds an architecture census command, its contract tests, and versioned baseline artifacts under repository-owned architecture documentation/artifact paths.
- Reads repository source, configuration, Git metadata, OpenSpec metadata, and generated summaries; it does not read production data or include secrets, learner records, raw answers, media content, or machine-local absolute paths in committed output.
- Provides the factual input for the modular-monolith charter, engineering control-plane reset, domain migrations, toolchain extraction, and deprecation program.
- Does not create npm workspaces, move modules, change import rules, alter tests, or claim that any existing domain already satisfies its proposed target boundary.
