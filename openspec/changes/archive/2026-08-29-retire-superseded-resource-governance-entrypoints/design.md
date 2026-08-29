## Context

R1 introduces the source-bound generated RegistryIndex, R2 separates context eligibility from formal activation, and R3 makes knowledge reads use one composite server-side envelope. Those changes do not automatically prove that an old reader, readiness chain, registry table, or knowledge-resource projection is unused. This change is the final deletion slice for only the entries whose consumers have moved and whose historical/runtime contracts are explicitly protected.

## Goals / Non-Goals

**Goals:**

- Make deletion a separate, immutable, reviewable operation with a complete caller denominator.
- Require exact replacement and migration revision identities, zero callers, and a usable rollback archive.
- Reduce the architecture allowlist and deprecation ledger monotonically without hiding remaining debt behind wrappers.
- Preserve Legacy/historical evidence, immutable Runtime/Teaching Projection readers, and all protected issue contracts.
- Keep activation, release publication, and product behavior unchanged except for removal of proven dead entrypoints.

**Non-Goals:**

- Deleting a source owner that still renders or publishes resources, or deleting any data/artifact retained for history or rollback.
- Removing the Legacy knowledge view, Authority snapshots, crosswalk/audit manifests, Runtime Release readers, Teaching Projection readers, or #1498/#1503/#1509/#1515/#1543 contracts.
- Performing a migration, activation, deployment, schema change, or broad cleanup merely because a name looks obsolete.
- Calling a re-export, renamed wrapper, feature flag, or no-op adapter a completed retirement.

## Decisions

### 1. Retire only explicitly superseded entrypoints

The retirement candidate set is limited to old identity/readiness/eligibility, registry-read, and knowledge-resource projection entrypoints whose replacement is an implemented R1/R2/R3 public contract. Every candidate names its owner, source path/export, semantic role, replacement API/contract, migration revision, and all known consumers. A source-owned render registry, immutable artifact reader, or historical adapter is not a candidate solely because it shares a name with a new contract.

### 2. Use an immutable retirement manifest and gate

`ResourceGovernanceRetirementManifest` binds the source revision inspected, candidate set hash, full consumer-denominator hash, replacement contract/index/eligibility/read-envelope identities, migration commit/revision, zero-caller scan receipt, protected-surface scan, rollback archive/digest, and reviewer decision. `verifyResourceGovernanceRetirement` recomputes the denominator and replacement identities before any delete operation. Missing, stale, mixed-revision, or unreviewed evidence blocks deletion.

The deletion command accepts only a manifest that validates against the current graph. It deletes the exact listed source entrypoint(s), not a directory, glob, generated output, or unknown caller. It emits a post-delete zero-caller and import/build/test receipt. If any new caller appears between scan and deletion, the gate fails and no deletion is attempted.

### 3. Prove migration at the revision boundary

The replacement must be active for every classified caller at one captured revision. R1 callers resolve the generated RegistryIndex; R2 callers consume context-bound dimension results; R3 knowledge callers consume the composite server response. Old and new outputs are compared for identity, role, authorization, scope, revision, optional degradation, and formal fail-closed behavior. A merely renamed function or facade over an old reader fails the replacement proof.

### 4. Require zero-caller evidence across all classes

The denominator includes production and test imports, route conventions, server actions, package scripts, generated references, dynamic import strings, compatibility aliases, browser fixtures, reverse callers, and rollback/historical readers. Tests that intentionally exercise a legacy reader count as callers unless they are migrated to an explicit historical adapter. A zero result is valid only for the exact candidate identity at the migration revision, with the scan rules and excluded framework files recorded.

### 5. Protect historical and immutable surfaces

The gate has a non-deletable allowlist for Legacy display, historical Authority/runtime snapshots, crosswalks, audit manifests, rollback archives, immutable Runtime Release readers, immutable Teaching Projection readers, and contracts #1498, #1503, #1509, #1515, and #1543. A candidate that is reachable from one of these surfaces is retained or split into a new migration slice. Retention is intentional and does not count as a failed zero-caller result for the protected artifact.

### 6. Make ledger and allowlist monotonic

The architecture allowlist/deprecation ledger stores candidate id, owner, consumer denominator, replacement, migration revision, evidence, deletion state, and rollback identity. A later revision may remove an entry after deletion or narrow it to a retained historical adapter; it may not add a broad exception, widen a pattern, or mark a wrapper as retired. The validator compares the prior ledger and rejects growth or unexplained state reversal.

### 7. Rollback is restoration of an exact prior revision

Before deletion, the manifest must contain a digest-verified archive or immutable Git revision sufficient to restore the exact old entrypoint and its contract tests. Rollback restores source bytes and caller configuration to that revision in a controlled development/release workflow; it does not create a permanent runtime fallback, change selectors, or mutate historical artifacts. The deletion gate is not complete without a proven restore rehearsal.

## Migration and deletion evidence

First classify candidates and freeze the denominator. Then complete R1/R2/R3 migrations and capture a clean revision. Run the replacement parity, zero-caller, protected-surface, rollback, and post-delete checks. Delete a narrow candidate batch only after all checks pass and record the result. If a candidate still has a caller, retain it with an explicit condition and do not hide it behind a facade.

## Verification

Run manifest schema/identity tests, incomplete/mixed-revision/denominator mismatch tests, replacement parity tests, production/test/generated/compatibility/dynamic caller scans, zero-caller and race checks, protected-surface tests, no-facade tests, allowlist/ledger monotonicity tests, rollback restore rehearsal, and post-delete import/build/route tests. Then run affected resource/knowledge domain suites, typecheck, strict OpenSpec validation, and `git diff --check`.

## Risks / Trade-offs

- Static caller discovery may miss dynamic or framework references. → Include string/config/route/generated scans, reverse edges, and a post-delete import/build test; keep the candidate narrow.
- A facade can make old behavior appear gone. → Compare source implementation ownership and require zero callers to the old symbol/path, not only a new export.
- Deletion may remove a needed historical reader. → Protect explicit history/rollback/runtime/projection surfaces and fail when a candidate is reachable from them.
- Ledger growth can hide unresolved debt. → Enforce monotonic count/edge reduction and require an owned deletion condition for retained candidates.
- Rollback evidence may be theoretical. → Require a digest-verified restore rehearsal at the exact pre-delete revision.

## Migration Plan

1. Verify R1/R2/R3 implementation, identities, and domain test evidence; freeze the full old-entrypoint and caller denominator.
2. Define and validate the retirement manifest, protected allowlist, replacement parity, zero-caller, post-delete, and rollback contracts.
3. Migrate all callers in a narrow candidate set at one clean revision and capture the exact replacement identities.
4. Run deletion gates, remove only the exact proven entrypoints, and publish post-delete/rollback receipts and the reduced ledger.
5. Repeat only for a new candidate batch whose denominator and replacement evidence are independently closed; leave unresolved entries explicit.

Rollback restores the archived pre-delete revision and prior ledger entry after the restore rehearsal. It does not delete history or change any production selector, Runtime Release, Teaching Projection, or active Authority pointer.

## Open Questions

None blocking. The repository may choose its existing ledger/receipt storage path, but the validator must enforce the full denominator, revision-bound replacement, protected surfaces, zero callers, rollback, and monotonic reduction.
