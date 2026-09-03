## 1. Ownership and consumer inventory

- [x] 1.1 Consume the qualified C0 delta and C1 Assessment owner-migration evidence; verify predecessor change identities and non-goals.
- [x] 1.2 Inventory the following exact 29 production paths with owner, exports, file bytes, current consumers, and deletion disposition:
  - `src/features/adaptive/adaptive-learning-center-contracts.ts`
  - `src/features/adaptive/adaptive-path-correction-outcomes.ts`
  - `src/features/adaptive/adaptive-path-journey-contracts.ts`
  - `src/features/adaptive/adaptive-path-journey-control.tsx`
  - `src/features/adaptive/adaptive-path-timeline.tsx`
  - `src/features/adaptive/adaptive-path-unlock-chain-view.tsx`
  - `src/features/adaptive/cold-start-collection-panel.tsx`
  - `src/features/adaptive/diagnosis-surface-panel.tsx`
  - `src/features/adaptive/path-advisor-entrypoint-bridge.tsx`
  - `src/features/adaptive/path-workspace-module.tsx`
  - `src/lib/adaptive-cold-start-detection.ts`
  - `src/lib/adaptive-generation-readiness.ts`
  - `src/lib/adaptive-learning-optimization-experiments.ts`
  - `src/lib/adaptive-path-candidate-batches.ts`
  - `src/lib/adaptive-path-candidate-limitation-copy.ts`
  - `src/lib/adaptive-path-comparison.ts`
  - `src/lib/adaptive-path-correction-decisions.ts`
  - `src/lib/adaptive-path-decision-evidence.ts`
  - `src/lib/adaptive-path-destination-contract.ts`
  - `src/lib/adaptive-path-execution-state.ts`
  - `src/lib/adaptive-path-generation-panel.ts`
  - `src/lib/adaptive-path-goal-options-client.ts`
  - `src/lib/adaptive-path-goal-options.ts`
  - `src/lib/adaptive-path-node-decisions.ts`
  - `src/lib/adaptive-path-option-display.ts`
  - `src/lib/adaptive-path-round-restore.ts`
  - `src/lib/adaptive-path-unlock-chain.ts`
  - `src/lib/adaptive-planning/item-type-terminal-validation.ts`
  - `src/lib/adaptive-planning/path-constraint-repair.ts`
  - `src/lib/adaptive-planning/resource-ranker.ts`
- [x] 1.3 Scan all production routes, workers, scripts, dynamic loads, re-exports, package aliases, and tests; classify each consumer as Assessment, Personalization, Learning Record, presentation-only, tooling, or historical.
- [x] 1.4 Record active feature flags, fallback helpers, compatibility aliases, old test paths, retained tables/outbox consumers, and exact replacement/deletion conditions.

## 2. Consumer migration and retirement

- [x] 2.1 Add or preserve characterization tests for path-advisor, journey/timeline, candidate batch, destination/execution/correction, diagnosis, cold-start, profile, and student-safe error/fallback behavior.
- [x] 2.2 Move assessment behavior to the C1 Assessment boundary and learner/path/recommendation/intervention behavior to Personalization; keep presentation-only composition thin and owner-labeled.
- [x] 2.3 Migrate every production caller and test to canonical APIs/ports/plugins; remove adaptive deep imports, duplicate parsers, re-exports, aliases, and flags only when their deletion conditions are met.
- [x] 2.4 Run the exact current-revision zero-production-import/dynamic-load/re-export scan for each candidate; block deletion on any remaining production consumer.
- [x] 2.5 Delete unconsumed entrypoints and obsolete facades, and preserve retained historical tables, facts, outbox consumers, and bounded historical fixtures with explicit ownership evidence.

## 3. Verification and handoff

- [x] 3.1 Run affected Assessment/Personalization unit and route/contract tests, including path history, learner privacy, assessment persistence, and failure semantics.
- [x] 3.2 Run `rtk npm run typecheck`, relevant web/worker/tools graphs, architecture fitness, and the deprecation/entrypoint negative tests.
- [x] 3.3 Compare before/after active production files, bytes, exports, compatibility surfaces, production imports, tests, and retained persistence objects; verify the result is a net decrease.
- [x] 3.4 Run `rtk openspec validate retire-adaptive-business-ownership-and-lib-entrypoints --type change --strict` and record the exact result.
- [x] 3.5 Record rollback revision, unresolved non-blocking paths, and the C3/C4 simplification prerequisites; do not simplify the canonical hotspots in this change.
