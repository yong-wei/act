## Context

Arena currently has a persisted submission path through `/api/arena/evaluate`, `createPersistedArenaSubmission`, `ArenaEvaluationRun`, and `ArenaSubmission`. The first-stage PR already improved workbench context handling and artifact construction, but several boundaries are still inaccurate:

- `evaluateWhiteBoxSubmission` constructs a heuristic provider but still reads metrics directly from `estimateMetrics`.
- `analysis-whitebox-v1` exists as a constant, while all non-black-box methods still return `template-whitebox-v1`.
- `listSubmissions` includes `whitebox-v1` in current leaderboards by default.
- `plant-adapter.ts` still exposes a production-named random black-box dataset generator beside the persisted budgeted experiment service.
- Arena telemetry constants are duplicated across `telemetry.ts` and `arena-event-dictionary.ts`.
- `src/features/arena/index.ts` remains a broad barrel that exports domain, client, server, adapter, persistence, and evaluator surfaces together.

This change is a hardening pass. It makes the current implementation honest and internally consistent before any real analysis-based evaluation is introduced.

## Goals / Non-Goals

**Goals:**

- Make template white-box evaluation use one synchronous provider selector as the official metric source.
- Keep protocol naming aligned with actual behavior.
- Prevent current leaderboards from mixing legacy protocol scores unless explicitly requested.
- Ensure production black-box dataset creation goes through the budgeted persisted experiment service.
- Establish clear Arena import boundaries.
- Keep documentation aligned with the actual evaluation state.

**Non-Goals:**

- Do not implement `analysis-whitebox-v1`.
- Do not make `evaluateArenaSubmission` asynchronous in this change.
- Do not change scoring formulas unless required to route through the provider.
- Do not add teacher publication persistence, assignment workflow, or Odyssey submission bridging.

## Decisions

### Decision: Use a synchronous white-box metric provider for current template evaluation

`evaluateWhiteBoxSubmission` is currently synchronous and is called inside `createPersistedArenaSubmission`. The hardening path should introduce `SyncWhiteBoxMetricProvider` instead of carrying the existing async provider shape forward.

Alternative considered: convert the whole path to async now. That belongs in `arena-analysis-whitebox-evaluation`, where async computation is actually needed.

### Decision: Make protocol version a provider property for white-box methods

`selectWhiteBoxMetricProvider(method)` should return both the provider identity and `protocolVersion`. `getArenaEvaluationProtocolVersion` should use that selector for white-box methods, then branch separately for black-box and disabled code-controller methods.

This avoids maintaining parallel `method -> provider` and `method -> protocol` maps.

### Decision: Legacy protocol visibility is an explicit caller option

The store should add `includeLegacyProtocols?: boolean` to listing options. Default `false` keeps public leaderboards protocol-clean. Historical teacher/admin views can opt in later and label legacy rows.

Alternative considered: migrate all legacy rows. Migration is not enough because future protocol changes will recur; listing policy should be explicit.

### Decision: Random black-box generation must be test-only

The production-named `createCruiseRollBlackBoxAdapter` should no longer generate random dataset hashes or PRBS samples. Either it becomes a service-backed adapter requiring `userId`, `store`, and experiment input, or the random implementation is renamed to `createMockCruiseRollBlackBoxAdapterForTests` and not exported from server production paths.

### Decision: Split Arena entrypoints without breaking all imports at once

Add `domain.ts`, `client.ts`, and `server.ts`. Existing `index.ts` can remain as compatibility during the transition, but touched UI and API imports should move to the narrow entrypoint. New code must not import from the root barrel.

## Risks / Trade-offs

- [Risk] Tests may still import from `@/features/arena` and hide boundary violations. → Add import-boundary coverage or a lightweight static test for client/server entrypoints.
- [Risk] Removing default legacy inclusion may make existing historical leaderboard rows disappear. → Keep explicit opt-in and document that current leaderboards show only current protocol results.
- [Risk] Provider indirection can look like abstraction without immediate behavior change. → Keep the provider minimal and synchronous; its purpose is protocol honesty and future analysis handoff.
- [Risk] Renaming the mock black-box adapter may break tests. → Update tests to import the mock by the explicit test-only name.

## Migration Plan

1. Introduce the sync provider interface and selector.
2. Route white-box evaluation and protocol selection through the selector.
3. Update submission listing policy and tests for legacy inclusion.
4. Isolate the random black-box adapter and keep production black-box API on the persisted service.
5. Add Arena entrypoint files and migrate current touched imports.
6. Merge telemetry constants into one source and update imports.
7. Update Arena docs to state that analysis white-box is reserved.

Rollback is straightforward: provider selection and entrypoint files can coexist with the old root barrel. The only visible behavior change is default legacy leaderboard exclusion, which can be temporarily reverted by setting `includeLegacyProtocols: true` at callers if needed.

## Open Questions

- Should admin-only pages expose a legacy submissions view in the same change, or should this change only provide the store option?
- Should the root barrel emit a lint warning by policy only, or should a test forbid new imports from it immediately?
