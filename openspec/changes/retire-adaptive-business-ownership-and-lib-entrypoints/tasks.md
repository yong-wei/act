## 1. Ownership and consumer inventory

- [ ] 1.1 Consume the qualified C0 delta and C1 Assessment owner-migration evidence; verify predecessor change identities and non-goals.
- [ ] 1.2 Inventory the 10 production `src/features/adaptive` files and 19 production `src/lib/adaptive-*`/`src/lib/adaptive-planning/*` files with owner, exports, file bytes, and current deletion disposition.
- [ ] 1.3 Scan all production routes, workers, scripts, dynamic loads, re-exports, package aliases, and tests; classify each consumer as Assessment, Personalization, Learning Record, presentation-only, tooling, or historical.
- [ ] 1.4 Record active feature flags, fallback helpers, compatibility aliases, old test paths, retained tables/outbox consumers, and exact replacement/deletion conditions.

## 2. Consumer migration and retirement

- [ ] 2.1 Add or preserve characterization tests for path-advisor, journey/timeline, candidate batch, destination/execution/correction, diagnosis, cold-start, profile, and student-safe error/fallback behavior.
- [ ] 2.2 Move assessment behavior to the C1 Assessment boundary and learner/path/recommendation/intervention behavior to Personalization; keep presentation-only composition thin and owner-labeled.
- [ ] 2.3 Migrate every production caller and test to canonical APIs/ports/plugins; remove adaptive deep imports, duplicate parsers, re-exports, aliases, and flags only when their deletion conditions are met.
- [ ] 2.4 Run the exact current-revision zero-production-import/dynamic-load/re-export scan for each candidate; block deletion on any remaining production consumer.
- [ ] 2.5 Delete unconsumed entrypoints and obsolete facades, and preserve retained historical tables, facts, outbox consumers, and bounded historical fixtures with explicit ownership evidence.

## 3. Verification and handoff

- [ ] 3.1 Run affected Assessment/Personalization unit and route/contract tests, including path history, learner privacy, assessment persistence, and failure semantics.
- [ ] 3.2 Run `rtk npm run typecheck`, relevant web/worker/tools graphs, architecture fitness, and the deprecation/entrypoint negative tests.
- [ ] 3.3 Compare before/after active production files, bytes, exports, compatibility surfaces, production imports, tests, and retained persistence objects; verify the result is a net decrease.
- [ ] 3.4 Run `rtk openspec validate retire-adaptive-business-ownership-and-lib-entrypoints --type change --strict` and record the exact result.
- [ ] 3.5 Record rollback revision, unresolved non-blocking paths, and the C3/C4 simplification prerequisites; do not simplify the canonical hotspots in this change.
