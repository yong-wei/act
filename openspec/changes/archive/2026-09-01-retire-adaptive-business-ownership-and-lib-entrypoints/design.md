## Context

The current HEAD has 10 production files under `src/features/adaptive` and 19 production files matching `src/lib/adaptive-*` or `src/lib/adaptive-planning/*`, totaling 185,917 bytes by the current tree scan. Representative current consumers include `/api/adaptive/path-advisor-context`, `/api/adaptive/path-advisor-tool`, `/api/learning-paths/*`, `/assessment/adaptive-practice`, profile/knowledge/simulation pages, journey and correction routes, and product-qa/capture scripts. The surface includes UI contracts and controls, path journey/timeline/unlock helpers, cold-start/diagnosis panels, destination/option/execution helpers, candidate batches, ranking, and constraint repair.

The exact current production path set captured for this change is:

```text
src/features/adaptive/adaptive-learning-center-contracts.ts
src/features/adaptive/adaptive-path-correction-outcomes.ts
src/features/adaptive/adaptive-path-journey-contracts.ts
src/features/adaptive/adaptive-path-journey-control.tsx
src/features/adaptive/adaptive-path-timeline.tsx
src/features/adaptive/adaptive-path-unlock-chain-view.tsx
src/features/adaptive/cold-start-collection-panel.tsx
src/features/adaptive/diagnosis-surface-panel.tsx
src/features/adaptive/path-advisor-entrypoint-bridge.tsx
src/features/adaptive/path-workspace-module.tsx
src/lib/adaptive-cold-start-detection.ts
src/lib/adaptive-generation-readiness.ts
src/lib/adaptive-learning-optimization-experiments.ts
src/lib/adaptive-path-candidate-batches.ts
src/lib/adaptive-path-candidate-limitation-copy.ts
src/lib/adaptive-path-comparison.ts
src/lib/adaptive-path-correction-decisions.ts
src/lib/adaptive-path-decision-evidence.ts
src/lib/adaptive-path-destination-contract.ts
src/lib/adaptive-path-execution-state.ts
src/lib/adaptive-path-generation-panel.ts
src/lib/adaptive-path-goal-options-client.ts
src/lib/adaptive-path-goal-options.ts
src/lib/adaptive-path-node-decisions.ts
src/lib/adaptive-path-option-display.ts
src/lib/adaptive-path-round-restore.ts
src/lib/adaptive-path-unlock-chain.ts
src/lib/adaptive-planning/item-type-terminal-validation.ts
src/lib/adaptive-planning/path-constraint-repair.ts
src/lib/adaptive-planning/resource-ranker.ts
```

The canonical targets already exist: Assessment owns attempt/catalog/evidence runtime after C1; Personalization owns learner state, plugin context, planning, recommendations, and interventions; Learning Record owns facts and projections; route/UI code composes those public results. The archived `adaptive-entrypoint-retirement` specification already requires zero production imports and protects historical storage. This change applies those rules to the remaining current-head business entrypoints without recreating the archived contract.

## Goals / Non-Goals

**Goals:**

- Establish a complete current-head mapping from every in-scope adaptive file and consumer to one canonical owner or a deliberately ownerless UI composition boundary.
- Migrate production consumers and delete the old path once exact import, dynamic-load, re-export, and route scans prove it is unreachable.
- Reduce active compatibility surfaces and `src/lib` business ownership while preserving all durable state and user-visible behavior.

**Non-Goals:**

- Reimplement or simplify the canonical path planner or learner-state reducer; those are C3/C4.
- Change Assessment selection/scoring, Personalization ranking, Learning Record facts, path schemas, authorization, or privacy rules.
- Delete historical tables, facts, outbox records, answer snapshots, path history, or tests that still protect canonical behavior.
- Keep a generic `adaptive` facade, duplicate public API, or hidden runtime fallback.

## Decisions

1. **Use a domain mapping, not a directory rename.** Each file is classified by the fact or state it owns: Assessment for attempts/catalog/evidence, Personalization for learner/path/recommendation/intervention, Learning Record for facts/projections, and route/experience modules for presentation-only composition.
2. **Migrate complete vertical consumers.** A route and its helper, worker, script, and test imports move together so no double-read, double-write, or split state machine remains. The route contract and student-safe projection stay unchanged.
3. **Move reusable path logic into Personalization internals.** Candidate ranking, hard eligibility, constraint repair, destination policy, path option/decision/execution projections, and journey state must be reached through the Personalization path-planning public/application boundary or its declared ports. No new `src/lib` business file is allowed.
4. **Keep UI composition thin and explicit.** Adaptive pages may retain an experience module only when it has no business authority, persistence, domain constants, or alternate validation. The module consumes canonical DTOs and is named for its owning experience; it cannot become a compatibility barrel.
5. **Delete only with current evidence.** For each path, record static and dynamic production consumers, test-only/history references, replacement, deletion condition, and rollback. A stale deprecation entry or archived change cannot satisfy the gate.
6. **Retired flags and storage are handled conservatively.** Remove flags that select obsolete adaptive behavior only after all callers are on canonical APIs. Preserve old Prisma tables and historical records when any non-retired adapter still owns them; do not use the tables as a second write authority.

## Risks / Trade-offs

- [A UI helper contains hidden domain decisions] → classify exports and call sites, add characterization around fallback/error/authorization behavior, and move the decision to the owning API before deletion.
- [A dynamic import or test fixture masks a production caller] → scan static imports, dynamic loads, re-exports, route manifests, workers, scripts, and compiled production/tool graphs at the exact revision.
- [Deleting a bridge removes historical evidence tests] → migrate behavior assertions to canonical tests; retain only bounded historical fixtures with an explicit non-production classification.
- [Path and learner state are simplified accidentally during migration] → keep C3/C4 separate, preserve public DTOs/versions and route response shapes, and require focused tests before each deletion.

## Migration Plan

1. Consume C0/C1 and build a file-by-file ownership and consumer table for the exact 29 production files listed above.
2. Characterize representative route, journey, path-advisor, profile, diagnosis, candidate, destination, and execution behavior.
3. Move domain decisions and reusable helpers behind Assessment or Personalization public/application boundaries; place presentation-only code in the owning experience module.
4. Update all production consumers and tests, remove obsolete flags/re-exports, and run an exact zero-production-import scan for each retired path.
5. Delete paths with no production consumers, update deprecation/architecture evidence with each exact path and scan revision, and record before/after active file/byte/export counts.
6. Rollback by restoring the preceding code revision and keeping all historical state; do not restore a generic adaptive facade or mutate production selectors.

## Open Questions

- Which remaining adaptive components are genuinely shared presentation composition versus owner-specific business logic once C1's runtime move is complete?
- Can every `src/lib/adaptive-planning/*` helper move under Personalization without changing the existing path-planning public export surface, or is one declared internal port needed for a tool-only caller?
