## Why

`capture-modular-monolith-refactor-baseline` records revision-bound observations, but it deliberately does not adjudicate ownership, trust-boundary severity, or retirement decisions. The next refactor changes need one durable charter so later dependency rules and domain migrations do not recreate competing owners, gates, or compatibility layers.

## What Changes

- Establish a modular-monolith refactor charter from the exact qualified baseline change and its captured source identity.
- Assign every inventoried capability and every route, API, persistence model, event, worker, script, registry, and test surface exactly one target domain owner backed by explicit evidence; qualification fails for a missing or multi-candidate owner, even when a blocking record has an accountable owner and removal condition.
- Publish `refactor-charter.md`, `bounded-context-map.md`, `dependency-rules.md`, `trust-boundary-matrix.md`, and `deprecation-ledger.md` under `docs/architecture/` from one consistent charter input.
- Record the threat, failure consequence, and sole authoritative validator for each hard gate; distinguish hard, contract, soft, and removable defenses.
- Put every compatibility entry, facade, alias, re-export, old route, and migration exception into a deletable ledger with owner, consumers, replacement, and deletion conditions.
- Keep this change governance-only: it does not move code, change product behavior, activate architecture enforcement, claim work, deploy, or activate production.

## Capabilities

### New Capabilities

- `modular-monolith-refactor-charter`: Defines the adjudicated ownership, bounded-context, trust-boundary, dependency, and deprecation charter for the ACT modular monolith.

### Modified Capabilities

None. Existing `frontend-build-source-boundary`, `owned-surface-module-hygiene`, `server-action-and-route-safety`, `app-router-rendering-boundary-safety`, and `stable-dependency-chain-migration` specifications remain authoritative for their existing requirements; this charter records how later changes must respect them.

## Impact

- Adds five architecture documents and their reproducible generation/validation contract.
- Consumes the qualified baseline artifacts and their exact source commit/tree; it does not rewrite the baseline or silently resolve evidence outside its denominator.
- Supplies the input contract for `enforce-modular-domain-dependency-contracts` and later vertical migrations.
- Does not change `src/`, Prisma, package scripts, CI, tests, runtime releases, deployment state, GitHub state, or production selectors.
