## Context

The current learner-state module is behaviorally owned by Personalization, but `internal.ts` remains a 104,343-byte mixed implementation. The first pass made `reducer.ts` the public pure entry while leaving most helpers and several effect-oriented dependencies in the same internal module.

## Goals / Non-Goals

**Goals:**

- Make dependency direction match the existing reducer/application contract.
- Delete duplicate normalization, projection, guard, and wrapper logic.
- Reduce the fixed learner-state production set from 127,848 bytes to at most 102,278 bytes.

**Non-Goals:**

- No new reducer, planner, compatibility facade, schema, public API, or data migration.
- No change to evidence authority, privacy, freshness, goal plugins, or portrait-v2 behavior.

## Decisions

1. Capture reducer and application outputs before editing. The baseline covers values, limitations, source identities, role visibility, missing/stale evidence, and unsupported goals.
2. Keep I/O, pagination, authorization, and persistence attachment in application/adapters. Pure helpers may live with the reducer or in a small internal pure module only when this deletes dependencies or duplicate code; file movement alone is rejected.
3. Convert each governed fact once before reduction and reuse the derived result for projections. Compatibility behavior remains explicit only where a current caller still requires it.
4. The baseline is commit `f79f1836fd57dce483d01194e627ef36d929d637`: every non-test `.ts`/`.tsx` file under `src/features/personalization/learner-state/` totals 127,848 bytes. The after total uses the same files plus any production file added or enlarged to receive code moved from this module.

## Risks / Trade-offs

- [Hidden reliance on normalization order] → lock output ordering and source identities in characterization tests before merging helpers.
- [Privacy or no-evidence regression] → run student/teacher projections and unavailable/stale cases after every retained pass.
- [Extraction hides code elsewhere] → count new files and positive byte deltas that receive moved learner-state code; reject any pass above 102,278 bytes or adding public exports.
