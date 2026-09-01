# Before/after metrics — simplify-personalization-learner-state

Rollback revision: `3512d1b4d78b16f810e6d208e0d75fa9ca4d4917` (`origin/integration` after #1777).

Canonical owner: Personalization learner-state reducer/application. C2 retired Adaptive/`src/lib` business entrypoints.

## Scope

Production module: `src/features/personalization/learner-state/**` excluding `__tests__`.
Primary files: `internal.ts`, `reducer.ts`.
Public export names unchanged.

## Characterization

Existing tests unchanged on `3512d1b4d7`: reducer 8, plugin-registry + learner-state service 54, route 9.

## Pass

One bounded pure-boundary pass:

- Move `reduceLearnerState` into `reducer.ts` so the reducer file is the real I/O-free entry (no Prisma/Next/React).
- Delete duplicate `getObject` conversion (`asRecord` remains).
- Delete `projectLearnerStateFactIdentities` / `projectLearnerStateFactIdentity` wrappers; public-api aliases the canonical identity helpers.

Did not add a second reducer or forwarding barrel. Application still performs reads; reducer stays pure.

## Metrics

Agreed semantic inventory is learner-state production `function` counts plus duplicate conversion wrappers (`getObject`, fact-identity wrappers). Types/guards/validators counted on `internal.ts` + `reducer.ts`.

| Metric | Before | After | Delta |
| --- | --- | --- | --- |
| Module bytes | 128262 | 127762 | -500 |
| Module LOC | 3214 | 3199 | -15 |
| `internal.ts` bytes | 111670 | 104343 | -7327 |
| `reducer.ts` bytes | 85 | 6746 | +6661 |
| Functions | 108 | 105 | -3 |
| Types / interfaces | 27 | 27 | 0 |
| Guards (`if (`) | 175 | 175 | 0 |
| Validators (`validate*`) | 1 | 1 | 0 |
| Duplicate conversions | 3 | 0 | -3 |
| Public export names | unchanged | unchanged | 0 |
| Tests | 71 | 71 | 0 |

`reducer.ts` now holds the pure function instead of re-exporting `internal.ts`. Guards, validators, identity/privacy/no-evidence checks were not removed.

## Verification

- Characterization: 8 + 54 + 9 passed after the pass.
- `rtk npm run typecheck` exit 0 (pre-existing production-to-documentation/tooling only).
- `rtk npm run lint` exit 0 (`--max-warnings=0`).
- `openspec validate simplify-personalization-learner-state --type change --strict` valid.
- No schema, selector, or deployment change.
