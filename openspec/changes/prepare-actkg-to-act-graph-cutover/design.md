## Context

The repository already separates four stages: candidate admission of an
authoritative engineering release, deterministic ACT Teaching Projection rebase,
consumer activation, and legacy runtime retirement. Those stages must remain
separate because the same release can be complete for engineering identity while
its teaching projection or consumer evidence remains incomplete.

This change is executed from the permanent `resource` worktree. It may use the
main worktree's local PostgreSQL service only through a unique, disposable
task-specific schema to validate candidate import and materialize a staged
Authority Snapshot. It does not write the shared `public` schema, a remote
server, a deployment, or a legacy-retirement operation. After complete local
proof, it advances repository-local selectors only through their existing
atomic stores. The existing 34-batch CourseCoverage audit and its
4,880 DEFER outcomes are historical evidence. They are immutable inputs, not
candidates in this release delta denominator.

## Goals / Non-Goals

**Goals:**

- Freeze the clean worktree revision and the exact locally available ActKG
  Release before reading candidate inputs.
- Materialize content-addressed Authority and Teaching Projection releases with
  a deterministic impact set; derive missing ACT resource semantics from the
  current BOPPPS/interactive-course authoring corpus as formal author decisions.
- Record exact pre-existing pointer observations without following, replacing,
  or repairing those pointers.
- Prepare six named consumer manifests with readiness, shadow comparison, and
  rollback evidence, then atomically activate their one shared manifest.
- Emit one readiness and activation report with the exact post-switch pointer
  and rollback identities.

**Non-Goals:**

- Changing a shared database authority record, a deployed runtime, remote
  server, Docker image, production configuration, or a legacy-retirement
  pointer. Candidate records in the unique disposable local schema are
  permitted only for import and snapshot verification; they are not production
  authority and must be cleaned up.
- Treating candidate import as activation, or treating shadow verification as a
  production cutover.
- Retiring legacy knowledge, mutating historical CourseCoverage evidence, or
  re-reviewing unbound ActKG entities semantically.

## Decisions

### 1. Use a per-run immutable preparation root

Each run writes only to
`artifacts/actkg-cutover-preparation/<capture-revision-or-run-id>/`. The root
contains a manifest that hashes every materialized input and derived document.
It is never named `current.json` and is outside Authority, Projection,
consumer-activation, and legacy-retirement default-pointer directories.

This makes review and rollback a matter of selecting an immutable directory,
not reconstructing a transient command invocation. Writing a default candidate
location was rejected because its name could be mistaken for activation and can
erase evidence from an earlier attempt.

### 2. Freeze identity before projection work

Phase 0 records the ACT capture revision, the resource worktree role and dirty
ownership, and byte-level observations of the existing relevant pointers. Phase
1 then validates the selected Release's declared schema, bundle identity,
digests, closure, and compatibility before copying or deriving any candidate
artifact.

The alternative—discovering inputs independently per consumer—was rejected:
it can create a plausible but mixed revision set and violates the existing
capture-revision invariants.

### 3. Treat engineering identity as verified input and teaching as the only
incremental review domain

Published ActKG engineering entities, formulae, system models, and engineering
relationships receive identity, schema, hash, and closure verification only.
The projection impact set is computed by matching the frozen baseline and
candidate release, then filtering to active ACT course resource bindings,
textbook locators, prerequisites, and teaching semantics. Split, merge, missing
successor, and semantic ambiguity produce stable REVIEW_REQUIRED records instead
of guessed successors.

Re-reviewing the whole upstream graph was rejected because it duplicates the
authority release process and makes the delta non-deterministic. Folding the
historical CourseCoverage DEFER population into the denominator was rejected
because it changes a completed audit rather than evaluating this release.

### 4. Model consumers as explicit staged contracts

Each of engineering-graph, engineering-rag, course-runtime, konling,
teaching-resource-rag, and learning-path receives one manifest that pins the
same Authority and Projection identities (or records why that consumer cannot
pin one), readiness result, shadow result, and rollback target. A consumer may
be `READY`, `PINNED`, `BLOCKED`, or `SHADOW`; it is not called activation-ready
solely because a candidate exists.

A shared aggregate status without per-consumer manifests was rejected because it
cannot show an atomic switch set or identify the specific missing evidence.

### 5. Stage, shadow-verify, and atomically activate one release set

The run creates immutable Authority, Teaching Projection, prerequisite, and
consumer releases, validates shadow reads against the staged consumer manifest,
then exercises rollback before making the shared consumer manifest current. The
consumer manifest is the atomic activation unit: all six consumer records read
one pointer and must agree on Authority identity; teaching consumers must agree
on the same Projection identity. Individual consumer pointer rewrites are not
an activation mechanism.

Sequentially rewriting six consumer selectors was rejected because readers
could observe a mixed release set. Skipping rollback evidence was rejected
because an activated release cannot support a reversible switch without it.

### 6. Use a disposable local schema for candidate import only

The local `DATABASE_URL` may be used only after it is verified to address the
local PostgreSQL service. Candidate import, Prisma migration, repository reads,
and raw SQL must all inherit one explicitly schema-qualified connection URL
(`schema=<unique-name>` and an explicit `search_path`). The run records a
before-and-after fingerprint of the shared `public` schema and default pointer
bytes. Its cleanup removes only the exact schema it created, on both success and
failure. The staged Authority files remain under the preparation root and are
marked `staged`, never `current`.

Writing candidate rows to `public` was rejected because it creates durable,
default-discoverable state without cutover authorization. Keeping the schema
after a successful run was rejected because the preparation package itself is
the audit artifact and does not require a live database residue.

### 7. Derive missing active-course semantics from ACT-owned blueprints

The absence of a default Teaching Projection does not justify an empty
projection. The run freezes the active-course inventory, preserves direct
crosswalk/card/manifest bindings, and resolves only the remaining resource rows
through a versioned ACT authoring policy grounded in the current package BOPPPS
or interactive blueprint. Each decision pins `resourceId`, `scopeId`, runtime
and blueprint digests, mapping candidates, and the policy digest. A required
resource must receive a BIND decision; `EXPLICIT_NONE` is reserved for a
resource explicitly marked non-semantic by its active projection mode.

Treating the active packages as an empty projection was rejected because it
would recast missing evidence as intentional absence. Binding every unresolved
row to a single generic endpoint was rejected because package BOPPPS evidence
must select the relevant canonical endpoint and remain independently auditable.

### 8. Use a write-ahead first-activation transaction for an all-ABSENT baseline

The current local baseline has no Authority, Teaching Projection, prerequisite,
or consumer-activation pointer. The switch therefore records a durable,
hash-sealed write-ahead journal before the first pointer write, holds an
exclusive local lock, and rechecks that all four pointers remain absent. It
stages immutable release directories first, verifies an equivalent temporary
activate-to-ready-to-absent exercise, then advances component pointers in the
fixed order Authority, Teaching Projection, prerequisite, and shared consumer
activation.

The consumer pointer is the only READY commit point. Before it is written,
consumers cannot resolve the new combination. If a write or post-read fails,
the journal removes only pointers whose current identity exactly matches the
target identity, in reverse order; any mismatch is concurrent drift and stops
compensation. The legacy-retirement pointer is neither staged nor changed.

For this all-ABSENT baseline, the shadow report records the empty predecessor
and the six staged successors. Expected predecessor absence is not itself a
discrepancy; it must still verify all six successor identities and reject any
missing successor, mixed identity, readiness failure, or write side effect.

Writing the four pointers without a journal was rejected because a failed first
switch has no predecessor pointer to restore. Extending every generic store
with an all-ABSENT rollback mode was rejected because the first-activation
protocol is narrower and preserves the existing store rollback contracts.

### 9. Persist only repository-relative first-activation locators

The journal records a versioned `repo-relative` locator for each pointer and
never serializes the local repository root or an absolute pointer path. Rollback
receives its current repository root explicitly, rejects escaping or symbolic
link traversal, and resolves each locator only inside that root before its
identity-constrained deletion. The one predecessor journal written before this
rule is converted once after its hash and legacy root are verified; normal
readers do not accept that absolute-path format.

Keeping absolute paths was rejected because these durable audit files are
shareable repository artifacts and must not disclose a developer workstation.
Replacing locators with component-name reconstruction was rejected because it
would remove the transaction's explicit, extensible recovery target.

## Risks / Trade-offs

- [No compatible locally available Release] → stop at Phase 1 with a signed
  absence/readiness record; do not synthesize a release or fetch from a remote
  host.
- [A local artifact lacks a trusted capture revision or digest] → mark the
  affected Authority, Projection, or consumer as `BLOCKED` and preserve the
  raw observation.
- [The deterministic delta needs a database-only input] → use only the
  task-specific local schema after its connection, migration isolation, and
  shared-schema fingerprints pass; otherwise record the exact missing evidence
  and stop rather than infer impact from filenames.
- [A pointer changes while preparing] → fail the manifest comparison and leave
  the candidate unactivated; no pointer-repair action is permitted here.
- [A staged shadow read cannot execute locally] → retain its manifest as
  `BLOCKED`; no claim of runtime compatibility is made.
- [No prior Teaching Projection exists] → create the first projection from the
  frozen active inventory and current BOPPPS/interactive blueprint decisions;
  do not produce an empty projection or infer upstream ActKG semantics.

## Migration Plan

1. Validate and commit the OpenSpec plan, then capture Phase 0 observations.
2. Materialize and verify the Authority candidate under the per-run root.
3. Generate and validate formal ACT author decisions, prerequisite decisions,
   deterministic projection, consumer, and readiness evidence.
4. Exercise the all-ABSENT write-ahead rollback protocol, advance the matching
   Authority/Projection/prerequisite pointers, atomically commit the single
   consumer manifest, then re-read all six consumers and record the result.
5. Commit the activation package. Legacy retirement remains a later operation
   after a zero-fallback observation window.

Rollback for this preparation is deletion of no files: retained immutable runs
remain auditable and all live pointers must compare byte-for-byte with their
Phase 0 observations.

## Open Questions

- Which locally available Release is the newest one that still has a complete,
  compatible bundle and predecessor baseline at the captured revision?
- Can every named consumer perform its existing shadow/readiness check without
  a database or service dependency, or must a concrete local evidence gap remain
  `BLOCKED`?
- Does the active-course binding corpus expose all prerequisite and textbook
  locator successors required for a complete candidate projection?
