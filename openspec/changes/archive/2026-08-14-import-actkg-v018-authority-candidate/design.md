## Context

ACT currently selects the v0.9 Authority snapshot. v0.18 contains 7,061
released knowledge nodes; its runtime Projection exposes 6,843 nodes and 2,811
relations and carries 1,909 `zh-CN` terminology rows. Admission must preserve
the complete upstream package and materialize an inactive ACT snapshot without
using the v0.17 to v0.18 diff as a migration substitute.

## Goals / Non-Goals

**Goals:**

- Mirror the exact upstream publication bytes into an immutable ACT release directory.
- Import the full v0.18 runtime projection into a deterministic candidate snapshot.
- Produce a complete v0.9 to v0.18 impact report and reproducibility proof.

**Non-Goals:**

- Changing current pointers or production markers.
- Creating ACT teaching relationships or selecting localized labels for display.
- Re-reviewing upstream engineering entities and relations.

## Decisions

### 1. Mirror the full tag tree, not a mutable checkout

The mirror copies only files from the pinned publication tag tree and records
the tag target, source revision, Git object IDs, raw hashes, and Bundle digest.
The working state of the ActKG repository is not an input.

### 2. Treat the runtime Projection as the visible Authority membership

The 7,061 Release entries remain part of the preserved package, while the
6,843 runtime Projection nodes and 2,811 links define the candidate visible
snapshot. Projection profiles, label rows, components, crosswalks, link
metadata, and validation reports remain separately hashed evidence.

### 3. Build from complete baseline and candidate snapshots

The impact report compares current v0.9 and candidate v0.18 identities,
objects, relations, types, and endpoint closure directly. Upstream
`release-diff.json` is retained and verified, but cannot replace the computed
v0.9 to v0.18 comparison.

### 4. Make staging idempotent and non-activating

Candidate identity derives from normalized validated content. Re-import of the
same package returns the same snapshot identity and does not duplicate rows or
rewrite immutable files. Any database-backed proof uses a disposable local
schema and leaves shared schemas and all current pointers unchanged.

### 5. Use a dedicated V2 persistence adapter

The accepted Sol decision is implemented as option A: the candidate write
boundary accepts only `ValidatedActKGBundleV2` and persists protocol
`actkg-public-bundle/2` through an explicit adapter. The adapter reuses the
existing transaction, advisory-lock, idempotency, receipt, and reconstruction
infrastructure, but never delegates to or structurally casts into the V1
importer. V2 projection profiles, multilingual labels, raw Artifacts, and the
registered admission binding use dedicated evidence records; none are encoded
as V1 semantic fields. The public V1 importer and its CLI/file behavior remain
unchanged, and the V2 identity namespace includes the protocol in both the
receipt key and persistence path. The Bundle receipt natural key is
`(bundleContractVersion, bundleDigest)`, so a coincident raw digest cannot
cross the V1/V2 idempotency boundary; existing V1 queries remain explicitly
scoped to the V1 protocol.

### 6. Prove deterministic reconstruction twice

Two clean materializations from the mirrored package must produce identical
snapshot bytes, hashes, counts, label-index identity, and impact report. A
mixed revision or untracked source is rejected before output publication. The
capture closure explicitly includes the complete `prisma/migrations/` tree,
`prisma.config.ts`, package lock/config inputs, the disposable-database helper
(`admit-latest-actkg-aggregate.ts`) and its Prisma client/config seams, the
complete v0.9 audit inputs, and every implementation dependency that can
change the result (V2 loader/admission schemas/importer, impact calculator,
capture resolver, Authority snapshot/contracts/repository, schema migration,
and candidate runner). The
runner additionally compares every migration Git blob and mode with the
current filesystem, including ignored and untracked files, because Prisma
reads the directory directly. A changed, deleted, added, or ignored migration
therefore fails closed even when ordinary Git status path filtering would miss
it. The adjacent tracked v0.18 mirror receipt is also in this closure: the
runner and closeout use the same exact Git-file check to compare its blob bytes
and mode, then retain the existing JSON semantic comparison. Blank, reformatted,
mode-drifted, missing, or newly introduced receipt paths fail closed before any
candidate artifact is written. After both replays and both impact computations,
the runner repeats the same check immediately before publication; a late drift
therefore removes the partial output root and cannot leave a candidate receipt.
`--v09-root` is only an assertion of that captured path; it cannot select an
external working tree.

### 6a. Separate stable source capture from derived candidate evidence

The candidate evidence runner uses a local two-commit contract. `captureRevision`
is the stable source commit E. `generationRevision` is the verification HEAD F
and must resolve to the current HEAD. E == F remains valid; an ancestor E < F is
accepted only when every E..F changed tree path is under the explicitly declared
candidate output root. A non-ancestor, an ordinary code/manifest/schema/config/
lock change, or a caller-supplied generation revision that is not current HEAD
fails closed. No generic V1 or Bundle capture helper is widened for this
exception.

The runner resolves the complete source membership from the declared capture
roots only. For every source path it compares the E Git path set, object type,
blob bytes, and Git mode with the F tree and the current working tree; missing,
extra, symlink, mode, or content drift is rejected. Source and derived roots
must be strictly disjoint. The default roots include the complete controlled
Bundle tree, and the receipt persists every captured `sourceEntries` member in
addition to the source manifest digest. An ignored untracked file inside that
tree is still discovered by the explicit walk and therefore fails closed.
Derived output files are checked against F and are summarized in the receipt
with byte length, digest, and mode. The receipt is itself a derived output;
its digest uses the canonical receipt body with the `outputs` list removed to
avoid a self-referential hash. The receipt records both revisions, the source
contract version, and the source manifest digest;
the generation-time receipt's `generationRevision` is the stable generator
revision (equal to E), while the verifier's contract `generationRevision` is
the committed F checked separately. The receipt never invents a final commit
SHA.

The runner's `--verify-derived` path is read-only with respect to candidate
evidence: after the generated files are committed as F, it replays the source
contract and receipt/output summaries without rerunning or rewriting the
candidate. The full PostgreSQL disposable-schema replay remains a real-run
gate; unit tests cover the Git boundary and receipt closeout only.

### 7. Merge V2 projection evidence by normalized profile identity

The V2 preserved-projection list may already contain the selected runtime
projection, while the impact snapshot must index projections by profile. Sol
DECIDE=A therefore requires a deterministic profile-keyed merge: duplicate
normalized `(profile, projectionId, versionDigest)` identities may be merged,
but any conflict fails closed. The selected runtime identity must agree with
an existing row when present and mark that row as runtime; otherwise it is
added once. The resulting candidate has one row per profile and exactly one
runtime row. V1 import and the generic delta calculator remain unchanged.

## Risks / Trade-offs

- The complete package and snapshot are larger than an incremental patch, but
  they are independently auditable and suitable for rollback.
- Existing card assets may not cover every new node; card coverage is reported
  separately and does not alter Authority identity.

## Migration Plan

1. Add the pinned release mirror and lock record.
2. Validate it through the v2 adapter.
3. Materialize the candidate and v0.9 to v0.18 impact evidence twice.
4. Publish only immutable candidate artifacts; assert all current pointers are unchanged.

## Open Questions

- None. Teaching and presentation readiness belong to later changes.
