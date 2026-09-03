## Context

The archived classification package is bound to the post-convergence subject at `698cb2f...`. It correctly retained uncertainty, but therefore left 52,159 records unresolved and emitted `package-unqualified`. The current integration tree has advanced and includes additional large tracked payload, so neither the old denominator nor its unresolved dispositions can authorize a migration.

This change extends the existing `repository-payload-classification` capability. It does not create another classifier, manifest format, object-store protocol, materializer, evidence registry, or active baseline. The archived A and C packages remain immutable predecessor evidence.

## Goals / Non-Goals

**Goals:**

- Capture one clean claim-time `integration` commit/tree as the new classification subject and reconcile its complete tracked-blob denominator.
- Bind the new subject to the archived predecessor identities without relabeling or overwriting either historical package.
- Resolve current authority, provenance, consumer, retention, privacy, recovery, rollback, and toolchain evidence by adapting existing contracts.
- Emit a deterministic compact package whose qualified state requires zero unresolved current members and complete count/byte conservation.
- Produce an action-neutral handoff from which later proposals can select genuinely eligible payload slices.

**Non-Goals:**

- Moving, deleting, uploading, downloading, externalizing, materializing, publishing, activating, or garbage-collecting payload.
- Changing production selectors, runtime views, OSS state, databases, CI, test-command qualification, Git history, or active architecture budgets.
- Reopening or rewriting #1876 or #1881, or treating their historical results as current.
- Replacing the existing content/knowledge/runtime release lifecycle or QA evidence lifecycle.

## Decisions

### 1. Use a new frozen subject with explicit predecessor continuity

At implementation start, a clean subject checkout resolves the then-current `origin/integration` commit and tree. The classifier records that identity separately from its tool checkpoint and records the archived A/C identities only as predecessors. The final artifact commit is never substituted for the subject.

This avoids a global baseline activation while still incorporating every payload added after the startup capture. A separate repository-wide recensus change was rejected because each future implementation would immediately advance HEAD again; N5 remains the only global recapture and activation point.

### 2. Reconcile Git objects, not filesystem approximations

The denominator is the complete set of tracked blobs in the frozen subject. Each path binds Git object identity, byte size, and content digest. Symlinks and gitlinks keep their existing explicit accounting rules. Ignored, untracked, materialized, or remotely discovered inputs remain separate observations and cannot change the tracked denominator.

Every current member must satisfy:

```text
discovered = qualified + justified-excluded + unresolved
tracked paths = exactly one member disposition each
tracked bytes = sum of independently counted member bytes
```

Duplicate groups remain references over independently disposed members and never reduce either equation.

### 3. Reuse existing authorities through digest-bound adapters

The classifier may read and validate existing release/runtime manifests and receipts, evidence-lifecycle records, architecture sources, generated-asset producers, and declared test/tool/document consumers. Each adapter records its entry bundle and frozen input digest. It may not infer authority from a directory name, current application revision, version string, equal hash, or archived assertion.

The previous `missing-authority-manifest`, `unknown-privacy`, consumer, retention, and toolchain-count reasons are investigation inputs, not values to suppress. If an adapter cannot prove the missing fact from an existing authority, the record stays unresolved.

### 4. Qualification is all-or-unqualified

Records continue to use the existing A-F primary classes, orthogonal facets, and fixed precedence. Known privacy-sensitive records may be qualified as F only with approved portable metadata and without copying private content. Unknown privacy, missing approval, unverifiable consumers, or missing recovery evidence remains unresolved.

The compact package may report per-slice progress, but it reports `qualified` only when the current denominator has zero unresolved members, all projections and the external detail locator reconcile, privacy checks pass, and every digest validates. Otherwise it emits one explicit unqualified package and grants no migration eligibility.

### 5. Separate classification from action authority

`futureEligible` remains an observation. Even a fully qualified package does not delete or externalize anything and does not create downstream Issues. A later Buddy propose must select a bounded slice, re-read this package, verify scoped drift against its own current base, and define the actual migration and rollback.

### 6. Keep detail external and compact projections in Git

Git retains the compact summary, index, policy, unresolved register, eligibility register, subject/tool identity, and complete detail locator/byte-count/SHA-256. The full per-member inventory remains a reproducible local or CI artifact. The index and package digest retain the existing non-self-referential construction.

## Risks / Trade-offs

- **[Risk] Existing lifecycle records do not prove all 52,159 historical gaps.** → Preserve bounded unresolved reasons and an unqualified result; do not add permissive defaults.
- **[Risk] Subject and tool trees are accidentally mixed.** → Use separate clean checkouts/checkpoints, repeat identity reads before projection, and reject path or digest drift.
- **[Risk] A busy integration branch makes the word “current” misleading.** → Define current as the exact clean subject captured at implementation start; record later base drift and require downstream scoped equivalence instead of rewriting the package.
- **[Risk] Full inventory output becomes another repository payload.** → Keep it outside Git with deterministic regeneration and a complete locator, byte count, and digest.
- **[Risk] Classification is mistaken for migration approval.** → Preserve explicit action-neutral status in every compact projection and test mutation attempts as failures.
