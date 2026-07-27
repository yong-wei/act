# Issue #948 handoff: authoritative anchors and isolated database snapshot

> Superseded boundary decision (ADR 0045, 2026-07-20): the reviewed anchor authorization below remains valid. The former full-history database export, decoder closure, writer recovery, event replay, learner-state reconciliation, and fact-backfill sequence no longer applies. Resume only against current governed truth, reviewed anchors, active references, reviewed active legacy mappings, and legacy snapshot compatibility. Earlier checkbox evidence must be reverified under this boundary.

## Purpose

This handoff records the human decisions made on 2026-07-19 for resuming
`inventory-course-knowledge-governance-inputs` in another isolated worktree.
It changes the availability of required inputs; it does not declare the change
complete and does not relax its read-only, privacy, or review requirements.

Branch at handoff: `inventory-course-knowledge-governance-inputs`

Implementation baseline before this handoff: `e6f73aeaff1dd88fd1fc0f2bb5cfb99a7b0c0f45`

## Authorized decisions

### 1. Agent-extracted anchors may become authoritative after review

The inventory is part of an automated knowledge-graph generation workflow.
Agents are authorized to extract course-scope anchor candidates from the
registered documents. An extracted record becomes an authoritative inventory
input only after an independent review confirms all of the following:

- the source path and source locator identify the cited text exactly;
- the extracted text is faithful to the source and its digest matches;
- the anchor type and nullable course/module/lesson scope are supported by the
  cited document rather than guessed from unrelated context;
- the record contains no identity grouping, domain membership, relation
  approval, resource-binding approval, or merge/split decision;
- rejected and unreviewed candidates remain distinguishable from accepted
  anchors and cannot enter downstream manifests.

The authority chain is therefore:

`registered document -> agent extraction -> independent review -> accepted anchor`

Each candidate must retain at least:

- logical source-relative path and source-root identity;
- source revision or immutable source digest;
- stable locator such as heading path, paragraph, page, or structured selector;
- quoted-text digest and normalized extracted text;
- extraction contract/model/rule version;
- review state, reviewer evidence, and rejection reason where applicable.

Independent review in this change assesses provenance, type, scope, and textual
fidelity. It does not perform the semantic decisions owned by downstream
identity, domain, relation, or resource-binding changes.

### 2. Historical data remains outside this series

No historical fact/event export, decoder or lineage catalog, writer discovery,
derived learner-state reconciliation, or historical trajectory fixture is an
input or deliverable of this change. Compatibility work is limited to reading
an original legacy revision or immutable legacy snapshot; it does not inventory
or reinterpret the rows behind that interface.

### 3. Main-worktree-only resources may be read directly

If a required resource exists only in the main worktree, the isolated worker
may read it by resolving the same repository-relative path against the main
worktree root. Reads must remain non-mutating.

Every such input record must distinguish logical identity from physical
location and record:

- repository-relative logical path;
- source-root identity (`main-worktree` or `isolated-worktree`);
- main-worktree Git revision at capture time;
- tracked, ignored, or untracked status;
- raw-byte content hash and declared codec/media type;
- the reason the isolated worktree copy was absent.

Same-named files with different content hashes are distinct observations and
must produce exact drift rather than silent precedence.

## Consequence for Issue status

The anchor question that previously required human direction has an authorized
resolution: anchor authority is provided by reviewed agent extraction.

Implementation and independent review are still required. Issue #948 must not
be closed or archived until its remaining P1 defects and incomplete OpenSpec
tasks are resolved.

## Known implementation gaps at the handoff baseline

The pushed scaffold is not merge-ready. Under ADR 0045, only these bounded gaps
remain relevant:

1. 325 declared PNG/PDF inputs were treated as failed text reads and omitted
   from complete physical-record coverage.
2. Runtime output validation checked only top-level manifest structure instead
   of executing the full nested JSON Schema.
3. Real accepted anchors and a bounded active-reference snapshot had not yet
   been generated.

Only OpenSpec task 2.3 was independently confirmed complete at that baseline.
All other task checkboxes intentionally remain incomplete.

## Resume sequence

1. Start from this branch in a clean isolated worktree and verify the handoff
   commit and the main-worktree revision to be used as an input source.
2. Update Issue #948 labels only after confirming that the authorized anchor
   review lane and real database export are actually available.
3. Replace the file-level input reader with declared text/media codecs so every
   required source produces an observed, missing, or invalid typed record.
4. Execute a complete nested manifest schema and add nested privacy/forbidden
   field counterexamples.
5. Generate anchor candidates from registered documents, independently review
   them, and admit only accepted anchors to the inventory.
6. Produce the bounded active-reference snapshot and validate its proof,
   completed/incomplete path classification, and current-reader evidence.
7. Run fixed-revision repeatability, no-write, TypeScript, focused tests,
   Prisma/DMMF checks, and strict OpenSpec validation.
8. Request a fresh independent review. Check tasks and Issue acceptance items
    only for evidence that the reviewer explicitly confirms.

## Required non-effects

- Do not mutate inventoried sources in either worktree.
- Do not generate, consume, validate, or commit historical diagnostic exports.
- Do not treat agent extraction as accepted authority before independent
  review.
- Do not generate identity, domain, relation, or resource-binding decisions in
  this change.
- Do not create a historical diagnostic output for Issues #949 and later.
