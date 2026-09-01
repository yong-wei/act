## Why

The committed modular-monolith census and charter still describe an older revision, while the current HEAD has already moved several Assessment and Personalization boundaries. A bounded current-HEAD delta is needed before further owner migration so that conflicts, retirement candidates, and simplification hotspots use one evidence set instead of three parallel inventories.

## What Changes

- Capture the exact clean source commit and tree for HEAD `957f367026d6d247ef79df2be081debe5c40a617` and compare it with the previously qualified architecture baseline without replacing that historical baseline.
- Produce one compact current-head evidence package combining owner conflicts, retirement candidates, and hotspot priorities, with stable record identities, current consumers, target owners, deletion conditions, and repository-relative evidence.
- Reconcile the Assessment/Adaptive/Personalization surfaces and the remaining `src/lib/adaptive-*` entrypoints against the existing architecture census, charter, deprecation ledger, and dependency allowlist.
- Record active OpenSpec overlap as a conflict matrix; archived proposals and completed tasks remain historical evidence only.
- Keep the change governance-only: no product code, route, schema, runtime, production selector, database, CI, or GitHub state changes.

## Capabilities

### New Capabilities

- `current-head-consolidation-delta`: A reproducible, privacy-minimized delta package for current owner, retirement, hotspot, and active-change evidence.

### Modified Capabilities

- None. The existing modular-monolith baseline, charter, and dependency contracts remain authoritative; this change adds a bounded delta input for later migrations.

## Impact

- Reads the current source tree, Git metadata, existing architecture projections, OpenSpec changes/specs, imports, tests, scripts, and package command contracts.
- Writes only the bounded current-head evidence package, expected under `docs/architecture/modular-monolith/current-head/` (summary, owner conflicts, retirement candidates, hotspot priority, and compact delta JSON).
- Does not publish, deploy, activate, migrate data, or update production authority.
