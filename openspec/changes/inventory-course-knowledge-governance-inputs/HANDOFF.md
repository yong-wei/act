# Issue #948 handoff: authoritative anchors and isolated database snapshot

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

### 2. Historical database data may be exported from the main worktree

The main worktree may be used as the trusted execution environment for a
read-only historical-data export. The export may then be imported into an
isolated worktree for inventory validation.

The worktree itself is not the database consistency proof. The export must
record or carry verifiable evidence for:

- database/source identity without committing credentials;
- schema and migration version;
- export time and transaction start time;
- one `REPEATABLE READ READ ONLY` transaction, a shared exported-snapshot
  token, or a genuinely immutable export object;
- export-object SHA-256 and proof digest;
- dataset counts, watermarks, and historical shape/version summaries;
- five-person small-cell suppression and the existing repository privacy
  boundary.

No real learner row, raw answer, event payload, reversible row key, credential,
or unsuppressed small-cell output may be committed. Empty databases, synthetic
databases, and caller-authored proof labels do not substitute for the real
historical snapshot. Synthetic fixtures remain appropriate for contract tests.

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

The two input questions that previously required human direction now have an
authorized resolution. They no longer justify `status:needs-human` by
themselves:

- anchor authority is provided by reviewed agent extraction;
- historical evidence is provided by a real main-worktree export imported into
  the isolated worktree.

Implementation and independent review are still required. Issue #948 must not
be closed or archived until its remaining P1 defects and incomplete OpenSpec
tasks are resolved.

## Known implementation gaps at the handoff baseline

The pushed scaffold is diagnostic and not merge-ready. The last independent
review identified these concrete gaps:

1. 325 declared PNG/PDF inputs were treated as failed text reads and omitted
   from complete physical-record coverage.
2. Runtime output validation checked only top-level manifest structure instead
   of executing the full nested JSON Schema.
3. Child decoder discriminator/version validation did not close recursively.
4. Writer/producer discovery remained a file-level approximation, with 29
   bidirectional registry differences and 3 unresolved dynamic SQL paths.
5. Real accepted anchors and the controlled historical database snapshot had
   not yet been generated.

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
5. Compile and recursively validate the decoder graph, including child version,
   discriminator, selector, namespace, join, and schema-source closure.
6. Replace file-level writer propagation with symbol-level TypeScript call-path
   evidence and reconcile declared/discovered sets bidirectionally.
7. Generate anchor candidates from registered documents, independently review
   them, and admit only accepted anchors to the inventory.
8. Produce the real read-only historical export in the main worktree, import it
   into the isolated environment, and validate proof, counts, watermarks,
   privacy suppression, and historical shape classes.
9. Run fixed-revision repeatability, no-write, TypeScript, focused tests,
   Prisma/DMMF checks, and strict OpenSpec validation.
10. Request a fresh independent review. Check tasks and Issue acceptance items
    only for evidence that the reviewer explicitly confirms.

## Required non-effects

- Do not mutate inventoried sources in either worktree.
- Do not commit the historical database export if it contains protected rows or
  payloads.
- Do not treat agent extraction as accepted authority before independent
  review.
- Do not generate identity, domain, relation, or resource-binding decisions in
  this change.
- Do not use `readiness=false` diagnostic output as the downstream source
  snapshot for Issues #949 and later.
