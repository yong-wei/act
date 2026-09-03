## Context

The repository already has one deterministic architecture-census core, one family of measurement receipts, a committed modular-monolith baseline, and a current-head consolidation delta. Those artifacts are authoritative for their own capture identities and must remain immutable. The post-convergence work is a successor capture, not a replacement census and not an activation step.

The capture is permitted only after live Issues #1805–#1810 are closed, carry `status:archived`, and have their native `blockedBy` dependencies resolved. This is a hard coordination gate for the entire change: until the parent coordination layer verifies it from live Issue state, the change may not be claimed or applied and no implementation checkpoint, test, or capture may start. The change artifacts do not create or assert that native relationship. After the gate passes, the capture source must be the clean `origin/integration` HEAD that is actually checked out. The implementation checkpoint containing the capture changes and tests is not the final capture revision; a subsequent clean capture is required so the artifact cannot describe its own uncommitted or mixed state.

The scope is governance evidence. The result must let later owner, payload, quality, and fitness work consume a single identity and digest without copying a large per-file ledger into Git. It must preserve historical predecessor identity, source identity, tool/schema identity, and all unresolved evidence while making no product, release, database, CI, runtime, GitHub, or production decision.

## Goals / Non-Goals

**Goals:**

- Generate one immutable A2 successor package from one clean source commit/tree and one declared tool/schema contract.
- Preserve the predecessor modular-monolith baseline identity and the predecessor current-head delta identity/digest; never rewrite either artifact or silently replace a missing one.
- Reuse `scripts/architecture-census.ts`, `src/lib/architecture-census/**`, the deterministic census core, and the existing measurement-receipt authority.
- Reconcile the complete `INVENTORY_KINDS` set and the predecessor manifest's complete stable kind set (currently 18 kinds) and add explicit aggregate slices for feature-to-App Router, deep imports, core infrastructure, SCCs, `src/lib` business surfaces, compatibility, duplicate owners, public entrypoints, single-implementation interfaces, delegate-only wrappers, and zero callers.
- Classify tracked repository material into hand-authored production, tests, tools/scripts, authored course content, generated runtime/release, active/archive OpenSpec, QA/browser evidence, build assets, and binary/media/model layers without storing raw payloads.
- Emit deterministic owner-residue and Top 50 hotspot observations, payload-class aggregates, and test/build observations with repository-relative evidence, bounded receipts, and explicit `observation`, `ambiguous`, or `unresolved` states.
- Keep Git output compact: aggregate/summary projections and complete local/CI artifact locators plus hashes are committed; the full reproducible per-file inventory is a separately addressable artifact.
- Make source drift, dirty or mixed worktrees, denominator gaps, unsafe content, absolute paths, secrets, duplicate identities, and historical overwrite attempts fail closed.
- Give B/C/D and later N5 a digest-bound, read-only handoff contract. `captured`, `digest-verified`, and `qualified-for-investigation` remain distinct from an active baseline.

**Non-Goals:**

- Do not create a second census, fitness evaluator/budget, measurement-receipt family, quality registry, payload registry, ledger, or parallel source of truth.
- Do not modify `REQUIRED_BASELINE`, `REQUIRED_FITNESS_BUDGET`, test-command qualification, CI/runtime gates, or any existing baseline/current-head artifact.
- Do not resolve ownership, adjudicate test failures, decide payload authority/materialization/retention, select deletions, migrate callers, transfer owners, or update architecture fitness budgets.
- Do not run a full repository test suite, change product code, routes, database/schema, runtime or OSS release, deployment, GitHub coordination, or production selectors.
- Do not commit raw source, complete command logs, learner identifiers, answers/events, private course content, screenshots, media/model contents, secrets, or machine-local absolute paths.

## Decisions

### 1. Use an A2 immutable successor, not an active-baseline refresh

The package records a `successorCaptureId` derived from the canonical source identity, predecessor identities, schema/tool contract, and normalized deterministic input digests. It is independent of the predecessor ID and is never written into `REQUIRED_BASELINE`. The capture records `sourceCommit`, `sourceTree`, commit time, tool versions, schema versions, and frozen receipt IDs in every projection and in the compact JSON envelope.

Qualification has explicit states:

- `captured`: the package was generated from the declared input set;
- `digest-verified`: every committed projection and every referenced local/CI artifact matches its recorded digest;
- `qualified-for-investigation`: source identity, privacy, deterministic serialization, and all declared denominators pass;
- `active-baseline`: not an output of this change. Only N5 may atomically refresh and activate baseline, charter, fitness, and test qualification after its own identity/equivalence checks.

The state is monotonic only within the package and never implies downstream authority. Any B/C/D reader must require exact `successorCaptureId` plus digest and fail closed on absent, changed, or mixed inputs. If HEAD moves after A, N5 must recapture or prove equivalence under its own contract; A must not silently retarget the package.

### 2. Capture only a clean `origin/integration` source identity

The existing Git snapshot loader remains the source-of-truth boundary. The successor entrypoint first verifies that the worktree is clean, the repository root and worktree are not mixed, commit/tree resolve to full Git identities, and the checked-out commit equals the resolved `origin/integration` commit required by the capture run. It records no working-tree path.

The implementation checkpoint is a separate, clean commit containing code/schema/tests only. A later invocation loads that exact clean source (after #1805–#1810 have all been archived) and writes the successor package. A second identity read before writing catches changes during capture; any mismatch, dirty state, or unresolved predecessor fails before a qualified package is written. Existing baseline and current-head files are read and hash-checked, never rewritten.

### 3. Extend the existing census contract with derived successor slices

The generator continues to produce the existing normalized census core and its canonical manifests. Successor projections consume that core and the existing current-head delta rather than scanning a separate universe. The implementation binds the successor's inventory kind set exactly to `INVENTORY_KINDS` and the predecessor manifest's complete stable kind set (currently 18); a kind may be added only through an explicit schema-versioned addition with a migration rule. The implementation adds derived, denominator-reconciled aggregate slices for:

- the complete `INVENTORY_KINDS` dimensions, including entrypoints/routes/APIs, Prisma models/access, event contracts, workers, scripts, tests, registries, OpenSpec capabilities, dependency and reverse edges, deep imports, SCCs, compatibility surfaces, gates, and change centers;
- feature-to-App Router edges, core-infrastructure paths, `src/lib` business paths, duplicate-owner evidence, public entrypoints, single-implementation interfaces, delegate-only wrappers, and zero-caller observations.

Each slice has include/exclude rules, discovered/represented/excluded/duplicate/unresolved totals, stable record IDs, and a locator to the complete detail artifact. The successor and predecessor manifest kind sets must match exactly unless the schema version explicitly declares and validates an addition; the successor does not silently renumber or drop a kind. Layer, code, payload, and relationship categories are aggregate projections and must not be presented as an additional inventory kind. Derived slices are projections of the same source graph and must retain production/test/generated/compatibility/framework distinctions.

### 4. Keep one layered material classification and a compact Git boundary

Tracked paths and Git blob metadata are classified into these layers: hand-authored production; tests; tools/scripts; authored course content; generated runtime/release; active OpenSpec; archived OpenSpec; QA/browser evidence; build assets; and binary/media/model. The classification stores only repository-relative path identity, layer, tracked byte count/blob digest, and bounded relationship counts. It does not serialize file bodies.

The compact committed package is rooted at `docs/architecture/modular-monolith/post-convergence/` and consists of `summary.md`, `baseline.json`, `owner-residue.md`, `hotspots.md`, `payload-classes.md`, and `test-baseline.md`. `baseline.json` is the canonical envelope: it contains successor/predecessor identities, status, tool/schema versions, aggregate layer and denominator totals, frozen receipt IDs, handoff contract, and an ordered artifact index with logical locator, media/type, byte count, and SHA-256 for each complete detail artifact and projection. The package digest is computed over the canonical envelope according to its declared digest scope, avoiding a self-referential hash.

The full per-file inventory and any bounded AST/graph detail are emitted to a local/CI artifact locator such as `architecture-census/<successorCaptureId>/full-inventory.ndjson`; the locator is repository-relative/logical and contains no absolute machine path. Consumers fetch or regenerate that artifact and verify its digest before use. A missing locator, digest mismatch, or artifact that contains forbidden data makes the package unqualified. This keeps the Git package well below a large ledger while preserving reproducibility.

### 5. Preserve observation-only owner residue and payload evidence

Owner residue projects existing current-owner evidence, candidate target owners, production/test/tooling/dynamic-load/re-export/documentation consumers, duplicate-owner indicators, public-entrypoint links, and conflict references. It keeps `ambiguous` and `unresolved` records with all repository-relative evidence. Directory placement, file size, an archived proposal, or a closed Issue is never consumer or deletion proof.

Payload classes observe tracked bytes/blob identities, duplicate blobs, current runtime references, and archive-only references. They report aggregates and unresolved classifications only. They do not decide which payload is authoritative, whether it should be materialized or retained, or whether it may be deleted; those decisions belong to C and existing data-governance owners.

### 6. Rank hotspots as a deterministic observation vector

The Top 50 projection reuses change-center and dependency observations and adds deterministic source metrics: source bytes, function count, branch count, import breadth, fan-in/fan-out, change frequency from the declared Git history scope, test density, and trust density. It stores the metric vector, scope, evidence refs, and tie-break order rather than a universal threshold or fitness decision. Missing metric inputs are explicit `unresolved` observations, not zeroes.

Hotspots are ordered by the declared normalized metric tuple and then stable repository-relative identity. The projection says only where follow-up investigation may focus; a large file, central node, or high trust density is not itself an architecture defect and does not update a budget.

### 7. Reuse immutable measurement receipts without changing qualification policy

Environment-sensitive typecheck, bounded test, duration, memory, or build observations use the existing measurement-receipt schema and writers. Each receipt retains source commit/tree, command and scope, platform/tool versions, cache mode, capture time, exit status, aggregate values, and bounded fingerprints. Receipts are additive and immutable; a rerun receives a new ID.

`test-baseline.md` reports command scope and receipt IDs plus observed pass/fail totals and limitations. A red command remains an observation; A does not label it stale, accepted, quarantined, or implementation debt. The package does not modify test-command qualification or add a gate. Projections over the same census core and frozen receipt IDs are byte-identical.

### 8. Use digest-bound B/C/D handoffs and reserve activation for N5

The compact envelope contains explicit downstream contracts:

- B consumes the exact successor identity/digest and owner-residue locators to adjudicate target owners and compatibility/deletion conditions.
- C consumes the exact successor identity/digest and payload-class locators to decide payload authority/materialization/retention under its own data-governance scope.
- D consumes the exact successor identity/digest and test-baseline locators to adjudicate failures and test qualification.
- N5 may consume the completed, digest-verified inputs and is the only stage allowed to atomically refresh/activate baseline, charter, fitness, and test qualification; it must recapture or prove equivalence if the source HEAD has drifted.

All readers reject missing, stale, mixed-identity, or digest-drifted inputs and never infer activation from a file's presence or status string.

## Risks / Trade-offs

- [Risk] The post-convergence HEAD can move during or after capture. → Verify `origin/integration`, HEAD, tree, and worktree state before and after generation; bind every record to one identity and require recapture/equivalence in N5.
- [Risk] New derived slices diverge from the existing census denominator. → Derive them from the canonical core/graph, retain include/exclude rules and reconciliation totals, and fail closed on duplicate or unrepresented identities.
- [Risk] A local/CI artifact is unavailable to a downstream reader. → Record a logical locator and SHA-256 in `baseline.json`; missing or mismatched artifacts are an unresolved/failed qualification, never a best-effort fallback.
- [Risk] File size, centrality, or test redness is treated as a remediation decision. → Keep metric vectors and command receipts observational and state explicit non-adjudication in every projection.
- [Risk] Payload classification leaks private or learner data. → Read only bounded Git metadata and safe references, scan every serialized output with the existing privacy validator, and fail closed while exposing only a safe record ID and violation code.
- [Trade-off] A separate clean capture after the implementation checkpoint adds a commit boundary. → It is necessary to avoid self-referential or dirty evidence and makes successor identity reproducible.

## Migration Plan

1. **Hard coordination gate (required before any claim/apply/implementation/capture):** the parent coordination layer verifies from live Issue state that #1805–#1810 are all closed, carry `status:archived`, and have native `blockedBy` dependencies resolved. If any condition is false or cannot be verified, stop; do not claim/apply this change, start implementation, or generate evidence. This change's artifacts do not register or fabricate the native relationships.
2. After the gate passes, extend the existing census types/generator/projections and current-head adapter, add contract fixtures/tests, and add a successor mode to `scripts/architecture-census.ts`. Do not write post-convergence evidence yet.
3. Commit the implementation checkpoint cleanly and run the focused census/receipt/privacy/determinism and denominator tests, plus strict OpenSpec validation.
4. Verify the checked-out clean `origin/integration` identity and validate the immutable predecessor baseline/current-head inputs.
5. Run the successor mode once for that exact revision, produce the six compact projections and logical detail artifacts, verify hashes, privacy, kind-set/denominator closure, and deterministic re-projection from the same frozen receipt IDs, then review all `ambiguous`/`unresolved` records.
6. Commit only the compact package and artifact locators/digests. Hand the exact successor identity to B/C/D. Do not change active baseline selectors or fitness/test qualification.
7. Rollback of an unqualified package removes only the additive change revision/package. A qualified successor remains an immutable historical input; activation, if ever authorized, is a separate N5 transaction and is not rolled back by this change.

## Open Questions

None. The successor output directory, six committed filenames, A2 status semantics, predecessor continuity, compact artifact boundary, and N5/B/C/D handoff rules are fixed by this design. Metric weights, owner adjudication, payload authority, test disposition, and activation timing remain intentionally owned by later changes.
