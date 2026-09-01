## Context

The canonical learner-state surface currently consists of `src/features/personalization/learner-state/public-api.ts`, `application/read-learner-state.ts`, `ports.ts`, database adapters, `reducer.ts`, and `internal.ts`. The application already reads Learning Record and Assessment ports concurrently and passes normalized inputs to `reduceLearnerState`, but `internal.ts` also contains public types/contracts, feature-flag helpers, database pagination, portrait resolution, compatibility projection, evidence-cache reads, Arena writeback attachment, secondary dimensions, goal slices, privacy filtering, and reducer helpers.

The measured `internal.ts` is 111,670 bytes and 2,754 lines; `reducer.ts` is an 85-byte re-export. Current characterization assets include `src/features/personalization/learner-state/__tests__/learner-state-reducer.test.ts`, `src/lib/__tests__/adaptive-learner-state-service.test.ts`, `src/lib/data-governance/__tests__/adaptive-learner-state-service.test.ts`, and the adaptive learner-state route tests. The active contracts already require pure reduction, owned read ports, role/goal projections, portrait-v2/no-evidence semantics, historical LearningFact identity, plugin-provided control-correction context, and removal of the old authority after migration.

This change is a simplification pass after owner migration, not another learner-state migration. It must retain the canonical Assessment/Learning Record source boundaries and must not reinterpret legacy compatibility data as primary evidence.

## Goals / Non-Goals

**Goals:**

- Make the reducer a real, easily discoverable pure entrypoint and isolate I/O/application assembly from pure calculation.
- Convert governed facts and assessment outcomes once, reduce duplicate null/enum/source checks, and keep role/privacy projection explicit.
- Preserve portrait v2, assessment-backed mastery, freshness/confidence, no-evidence/unavailable distinction, plugin slices, historical identity, and path context.
- Demonstrate a measurable net reduction in production bytes and semantic concepts with a reviewable before/after report.

**Non-Goals:**

- Change learner-state values, algorithm/version semantics, portrait migration, LearningFact schema, Assessment persistence, or feature-flag retirement policy.
- Remove auth, role scope, privacy, evidence identity/revision, snapshot fencing, concurrency, stale/partial/no-data, or append-only protections.
- Add another reducer, learner-state service, read model, plugin registry, or fallback source.
- Migrate database data, deploy, alter runtime assets, or change production selectors.

## Decisions

1. **C2 is a hard predecessor.** The simplification targets only the canonical Personalization learner-state implementation after adaptive and `src/lib` business paths are mapped or deleted. It does not optimize a legacy authority that should be removed.
2. **Characterization comes first.** Freeze deterministic reducer cases, role projections, plugin/no-plugin cases, portrait snapshot/no-evidence/unavailable cases, duplicate/late facts, stale inputs, assessment mastery, path context, and safe redaction using existing tests. Do not rewrite expectations to fit a desired structure.
3. **Separate pure and effectful responsibilities.** The pure reducer receives normalized Learning Record/Assessment/plugin inputs and evaluation time; application/adapters perform reads, pagination, portrait authorization, cache access, and writeback attachment. A helper may remain named and shared when it expresses a real trust boundary or policy.
4. **Legacy compatibility remains explicit and non-authoritative.** Keep the compatibility projection needed by existing DTOs, but avoid repeated mapping of the same fact or portrait dimensions. `NO_EVIDENCE` must not silently read legacy portraits, caches, or vectors as authoritative state.
5. **Use `code-simplification` in bounded passes.** Call the skill with target files, invariants, non-deletable trust boundaries, allowed deletions, and baseline metrics. Test and measure after each pass; revert any behavior or net-reduction regression.
6. **Net reduction is semantic.** Compare bytes/LOC, exports, functions, state variants, guards, validators, duplicate conversions, dependencies, and tests. Equal-size file extraction, a new forwarding barrel, or a second reducer fails the change.

## Risks / Trade-offs

- [Moving a read into the reducer introduces I/O or changes determinism] → keep the reducer pure, add input-mutation/no-I/O characterization, and run the architecture boundary test.
- [A compatibility guard is removed although it protects a historical snapshot] → inspect its source/revision/error purpose; preserve any guard tied to identity, privacy, stale state, or historical readability.
- [NO_EVIDENCE becomes a legacy fallback] → retain explicit portrait resolution and no-evidence tests; compare source lineage, availability, confidence, and limitation metadata.
- [File extraction increases total code] → require production byte and semantic-concept net decline; stop and request design review if the reduction is not real.

## Migration Plan

1. Consume C0–C2 evidence and record the canonical reducer/application boundary and exact deletion set.
2. Capture baseline metrics and run all existing learner-state characterization tests unchanged.
3. Invoke `code-simplification` for one reducer/application slice at a time, starting with pure input normalization and reducer entry discovery.
4. Run direct tests after each pass, then compare learner-state payloads, privacy projections, source identities, limitations, exports, states, guards, dependencies, bytes, and tests.
5. Run related route/contract tests, typecheck, lint, architecture fitness, and Ponytail review; preserve the last passing revision.
6. Rollback to the last passing revision on any behavior or reduction failure. Do not restore the retired adaptive service or add a forwarding reducer.

## Open Questions

- Which helpers in `internal.ts` are genuine policy/contract names that should remain visible, and which are one-use conversions that can be removed after characterization?
- Can the application reader own all database/cache reads without changing existing latency/error aggregation or plugin limitation semantics?
