## Why

The committed architecture baseline and current-head delta describe pre-convergence evidence, while the owner-consolidation work is intended to establish a new factual starting point. After live Issues #1805–#1810 are closed, carry `status:archived`, and have their native `blockedBy` dependencies resolved, a bounded recensus is needed from the then-clean `origin/integration` HEAD so B/C/D can consume one reproducible successor identity instead of inferring state from several historical ledgers. Until that coordination gate is verified, this change may not be claimed or applied and no implementation or capture may start. This is an observation-only A2 capture: it creates an immutable successor record and never makes that record the active baseline.

## What Changes

- Add a post-convergence successor capture that preserves the predecessor baseline/current-head identities and binds every observation to one clean source commit, tree, tool contract, and schema version.
- Reuse the existing `scripts/architecture-census.ts` and `src/lib/architecture-census/**` deterministic core and measurement-receipt authority; do not create a second census, fitness, receipt, quality, or payload registry.
- Reconcile layered observations for hand-authored production, tests, tools/scripts, authored course content, generated runtime/release, active/archive OpenSpec, QA/browser evidence, build assets, and binary/media/model surfaces. Extend the architecture denominator with feature-to-App Router, deep import, core-infrastructure, SCC, `src/lib` business, compatibility, duplicate-owner, public-entrypoint, single-implementation-interface, delegate-only-wrapper, and zero-caller slices.
- Publish compact aggregate and summary projections plus complete artifact locators and digests; keep the reproducible per-file inventory as a local/CI artifact rather than adding a 20 MB or larger Git ledger.
- Record owner residue, Top 50 hotspots, test/build observations, and payload classes as `observation`, `ambiguous`, or `unresolved` only. Do not adjudicate test failures, payload authority/materialization, data-governance ownership, or deletion.
- Make dirty, mixed-worktree, unresolved identity, denominator drift, unsafe payload, absolute path, secret, and historical-overwrite conditions fail closed. A successor is never silently merged into or substituted for its predecessor.
- Define digest-bound read-only handoff contracts for B/C/D. `captured`, `digest-verified`, and `qualified-for-investigation` do not imply an active baseline; N5 alone may atomically refresh and activate baseline, charter, fitness, and test qualification after a later recapture/equivalence check.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `modular-monolith-architecture-baseline`: extend the existing baseline contract with an immutable post-convergence successor capture, layered denominator closure, compact artifact locator/digest output, and explicit separation between investigation qualification and active-baseline activation.
- `current-head-consolidation-delta`: make current-head owner, hotspot, consumer, and payload observations consumable by the successor identity without replacing historical records, resolving ownership, or implying deletion or activation.

## Impact

- Affects the existing architecture census generator, its schemas/projections/tests, and repository-relative architecture evidence under `docs/architecture/modular-monolith/`.
- Reads only the clean source tree, Git metadata, existing baseline/current-head artifacts, OpenSpec status, and bounded local measurements. Complete detailed inventories remain reproducible local/CI artifacts and are addressed by locators and digests.
- Downstream charter, owner-residue, quality, payload, and fitness work consumes the successor by exact identity and digest and fails closed on missing or drifted inputs. The capture does not change `REQUIRED_BASELINE`, `REQUIRED_FITNESS_BUDGET`, test-command qualification, CI/runtime gates, product code, database, runtime, OSS, GitHub, or production state.
