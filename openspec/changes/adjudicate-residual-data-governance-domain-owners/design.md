## Context

The existing `modular-monolith-refactor-charter` requires one accountable
target domain owner for every inventoried surface, and that canonical
single-owner rule remains unchanged.  Its general contract does not provide
enough resolution for the heterogeneous residue under
`src/lib/data-governance/**`.  The directory contains domain-specific state
and read models, cross-domain evidence processing, operator/backfill commands,
tests and fixtures, generated or binary assets, barrels, and compatibility
bridges.  A directory name, import count, or file size is not ownership proof.

Change A's post-convergence capture is the sole current residual factual input
for this adjudication; the predecessor baseline remains only as immutable
charter continuity evidence.  Before D is claimed, applied, implemented
(including a validator or fixture), run, or writes a normalized decision,
evidence record, or qualified projection, the parent coordination layer must
verify from live Issue state that Issue #1876 is closed, has `status:archived`,
and has its native `blockedBy` dependency resolved.  If that gate fails, the
only permitted output is a parent coordination-layer gate-rejection: it does
not consume A and is neither a D result nor a D artifact.  Once admitted, D
consumes A's exact owner-residue subject identity and full-inventory
locator/digest.  B and C are independent; D does not create a second owner
catalog, data-governance feature, ledger, or current-head capture.

The existing Learning Record, Assignment, evidence, Arena, simulation,
portrait, classroom, privacy, and retention contracts remain authoritative.
The archived C16 ownership map is particularly important: Assignment owns
command orchestration and approved-snapshot/CAS/idempotency, while
Data Governance retains question-scoped processing policy, conversion, queue,
derivative, and evidence consumers pending an evidence-backed decision.

## Goals / Non-Goals

**Goals:**

- Close a revision-bound denominator containing every current member of
  `src/lib/data-governance/**`, including assets, tests, fixtures, barrels and
  generated material, plus all production, test, tooling, dynamic-load,
  re-export, documentation, worker, scheduler and Prisma callers.
- Preserve exactly one accountable target domain owner for every normal charter
  surface, including all out-of-scope surfaces, and give each A-bound residual
  member or homogeneous family exactly one additional mutually exclusive
  outcome.  Keep owner and outcome as separate evidence-bearing fields.
- Make a strict cross-domain processing kernel possible only when every kernel
  proof condition is present; otherwise keep the record domain-bound, tooling,
  or unresolved.
- Produce a compact decision matrix, owner/kernel/tool/fixture/compatibility/
  unresolved summaries, a charter/deprecation projection, privacy and
  determinism evidence, and digest-bound future migration slices.
- Preserve unresolved conflicts as blockers and hand high-impact writer,
  pointer, retention, or authority uncertainty to a later decision-advisor.

**Non-Goals:**

- Do not move, rename, delete, re-export, or import-rewrite any source file;
  do not delete the `src/lib/data-governance` barrel.
- Do not create a Data Governance feature, second owner catalog, parallel
  charter/ledger, second Learning Record writer, or new public API.
- Do not change Prisma schema/migrations, backfill/replay/retention behavior,
  queues, grading algorithms, Assignment orchestration, LearningFact
  ingestion, Arena scores, simulation semantics, portraits, privacy, or
  production selectors.
- Do not open or update an Issue, deploy, publish, activate, or claim that a
  scoped charter is migration-ready while any record is unresolved.
- Do not treat a test, fixture, demo, generated asset, duplicate, directory,
  or historical reference as a production business owner or as a substitute for
  the unique accountable owner/steward required by a scoped outcome; the
  outcome still requires that owner/steward.

## Decisions

### 1. Gate and dual identity

The adjudication runner, if later implemented, starts with a read-only gate:

1. Verify live #1876 state (`closed`, `status:archived`, native
   `blockedBy` resolved).
2. Load A's handoff and verify its subject capture ID, source commit/tree,
   owner-residue digest, full-inventory locator/digest, schema version and
   source cleanliness.  All fields are copied verbatim; no working-tree glob
   or guessed path may substitute for A's artifact.
3. Freeze the A subject, the complete member/caller evidence, relevant specs,
   and the declared charter schema as one input bundle.

If the coordination state or A handoff fails any precondition, the runner must
stop before consuming A or writing any D decision/evidence.  It may return only
the parent coordination-layer gate-rejection; that rejection is not a D result
or artifact and cannot unlock validator/fixture work, an adjudication run, or a
qualified projection.

If D adds an adjudicator or validator, it first records a clean tool
checkpoint (`toolCommit`, `toolTree`, tool/schema version and tool-entry-bundle
digest).  The tool identity is distinct from A's subject identity.  A decision
is deterministic only when subject identity, tool identity, schema and frozen
inputs all match.  Any A, tool, schema, caller, or evidence drift fails
closed and cannot be repaired by rewriting the report.

### 2. Denominator and caller closure

The primary denominator is the exact current A entry set for
`src/lib/data-governance/**`.  It includes, without path-size shortcuts:

- production `.ts` modules and `index.ts` barrel exports;
- `__tests__/**`, `__tests__/fixtures/**`, test-only helpers and snapshots;
- `assets/**`, fonts, binary/generated/model material and demo packages;
- every caller from `src/app/**`, `src/features/**`, `src/components/**`,
  `src/resources/**`, `scripts/**`, `workers`/scheduler entrypoints and Prisma
  access sites;
- static imports, dynamic imports, re-exports, shell/path reads, manifest
  references, worker registration, documentation and archive references.

Each evidence row has a stable member ID, repository-relative path, relation
kind, caller class, public entrypoint (if any), current owner evidence,
candidate owner IDs, authority/privacy facts, source revision, and locator.
Production, test, tooling, dynamic, re-export and documentation callers are
separate classes.  A current runtime caller is not inferred from a directory
name; an archived reference is historical only.

Families are an output compression, not a new denominator.  A family is valid
only when all members have identical outcome-relevant evidence.  One member
with a different authority, consumer, privacy, lifecycle, or trust fact splits
the family or remains unresolved.  The reconciliation must account for every
member exactly once; a duplicate observation never removes a member.

### 3. One-outcome decision matrix

The normalized record set uses these mutually exclusive residual outcomes only
for A-bound `src/lib/data-governance/**` records.  They are orthogonal to the
canonical `accountableOwner` field, which remains mandatory for every qualified
record, including every out-of-scope capability, route, API, model, worker,
script, registry and test surface.  `status` is `qualified` only for a proven
owner and outcome; `unresolved` is a blocking status, not a qualified outcome
or exception.

| Outcome | Qualification rule | Projection treatment |
| --- | --- | --- |
| Exact business-domain owner | One existing charter domain explains the state machine, public boundary, authority and real consumers, and is recorded as `accountableOwner`. | Record owner and outcome separately; retain current-owner and evidence references. |
| Strict cross-domain processing kernel | All seven kernel conditions in Decision 4 are proven, with one domain owner/steward for the kernel boundary. | Record the kernel outcome, unique public API and accountable owner; no page owner. |
| Explicit operator tooling/backfill boundary | Command/tool is intentionally operator- or historical-only, with scope, dry-run/apply, frozen-input, authorization, retention evidence and one owner/steward. | Record the tooling outcome, accountable owner and zero-production-consumer/deletion condition. |
| Fixture/demo/test/generated asset | It is non-production material with a bounded producer or test/demo role, no business authority, and one maintenance/steward owner. | Record the fixture outcome and owner separately; preserve regeneration/retention evidence. |
| Compatibility/retirement candidate | It is a facade, alias, re-export, old route, fallback, flag, or migration bridge with a known replacement or explicit deletion condition and one owner/steward. | Project outcome and owner to the deprecation ledger; never delete or authorize deletion here. |
| Unresolved conflict | Owner, outcome, caller, or high-impact evidence is not closed. | Preserve safe evidence and block scoped and global charter qualification/migration. |

Compact summaries must report counts and IDs for each scoped outcome, plus
unresolved reasons, without hiding members in family totals.  Every summary
carries the unique `accountableOwner` independently from the outcome; normal
out-of-scope records remain in the canonical owner projection and do not receive
these outcome categories.  The owner summary
carries current owner versus target owner; the kernel summary carries every
proof field and steward; the tooling summary carries operator boundary,
backfill isolation and steward; the fixture summary carries non-production
provenance and maintenance owner; the compatibility summary carries
replacement/deletion conditions and owner; and the unresolved summary carries
the competing evidence and accountable follow-up owner.

### 4. Strict kernel proof and domain fallback

A record may be a cross-domain processing kernel only if all of the following
are independently evidenced:

1. at least two real business-domain consumers (not tests, tools or pages);
2. the fact semantics are intrinsically cross-domain rather than merely
   convenient to share;
3. it does not own a single-domain state machine;
4. it is not itself a page or route owner;
5. it does not contain one-off backfill logic;
6. it exposes one unique public API; and
7. that API has an explicit privacy and authority boundary.

Missing any condition means the record is not kernel-qualified.  It is assigned
to the exact domain or explicit tooling boundary only when that evidence is
clear and one existing charter domain owner/steward is accountable for the
kernel boundary, privacy, retention/deletion and maintenance; otherwise it
remains unresolved.  A shared name, common Prisma import, two internal callers,
or a consumer list without an owner is insufficient.  The same unique
accountable-owner obligation applies to tooling, fixture/generated and
compatibility outcomes; the outcome never substitutes for an owner.

### 5. Fixed authority and trust constraints

The following facts are constraints on every decision and are copied into the
evidence references, not reimplemented by D:

- The only online Learning Record ingestion writer is
  `src/features/learning-record/ingestion`.  Data Governance sinks/adapters
  cannot become a second writer.  Canonical fact identity, dedupe, trusted
  time, outbox, current pointer and processing/state watermark semantics stay
  unchanged.
- Assignment owns command orchestration.  Approved snapshots, CAS and
  idempotency remain Assignment concerns.  `math-document-grading-*`, queue,
  conversion, derivative and processing-policy modules are investigated under
  the C16 boundary; directory placement cannot move them to Assignment by
  default.  LearningFact eligibility remains independent.
- `ArenaSubmission` is the official score authority.  Simulation/Arena
  LearningFacts are privacy-safe auxiliary or context-only evidence; preview,
  open, isolated parameters and `profileWeight=0` do not enter a profile.
- Portrait V2 is the primary portrait.  `StudentCompetency` is a compatibility
  surface.  Freshness, confidence, fallback, privacy and recommendation
  eligibility remain governed by their existing contracts.
- Teacher/class read models retain teacher-class/student authorization,
  independent-learner small-sample suppression (not row counts), and
  redaction.  Backfill is strictly separate from online writers and current
  pointers.
- No output contains event payloads, raw answers, `contextJson`, user
  identifiers, parser/model text, or private evidence.  Evidence references
  are safe repository-relative identities and digests only.

### 6. Compact projections and charter qualification

The normalized record set emits a compact decision matrix and summaries, a
scoped owner/deprecation projection, a privacy report, a deterministic report
identity, and a full-ledger locator/digest.  The complete ledger remains a
local/CI artifact outside Git; committed material contains only bounded rows,
safe locators and digests.  D reuses the existing charter record vocabulary and
deprecation ledger rather than introducing parallel formats.

The scoped charter projection is qualified only when the denominator is closed,
the A/tool identities match, every member has exactly one accountable owner and
exactly one qualified outcome, every qualified kernel satisfies all proof
conditions, all callers are classified, and unresolved count is zero.  The
global charter also remains subject to the canonical single-owner requirement
for every out-of-scope surface.  If any unresolved record or ownerless
qualified outcome remains, D may emit a non-qualified blocker package
containing safe IDs and resolution conditions, but it must not call the
projection qualified or migration-ready.  A compact projection, a
`captured`/`digest-verified` status, or a completed test does not activate the
canonical charter.

### 7. Future migration-ready slices

Each future slice is a candidate handoff, not an operation in D.  Its record
must contain exact paths, the public boundary, paths explicitly not touched,
zero-consumer proof, deletion condition, rollback reference, and trust
invariants.  It must also contain exactly one existing charter domain
`accountableOwner`/steward responsible for the public boundary,
privacy, retention/deletion, and maintenance; consumer lists do not substitute
for that owner.  Suggested slices are:

| Slice | Exact path family and public boundary | Not touched; readiness/deletion and rollback conditions |
| --- | --- | --- |
| Learning Record ingress/adapters | `src/lib/data-governance/event-protocol.ts`, `event-types.ts`, `event-buffer.ts`, `event-normalization.ts`, `interactive-event-ingestion.ts`, `learning-fact-materialization.ts`, `session-fact-replay.ts`, `learning-fact-quality-weight.ts`, `trusted-learning-fact-filter.ts`; boundary is `src/features/learning-record/ingestion/**`. | Do not alter writers, anchors, times, dedupe, outbox, pointer, watermark, schema or retention. Ready only after one online writer and all direct/staged callers are proven; rollback preserves append-only facts and original anchors. |
| Assignment evidence handoff | `assignment-attachment-understanding.ts`, `math-document-grading-api.ts`, `math-document-grading-contracts.ts`, `math-document-grading-batch.ts`, `math-document-conversion.ts`, `math-document-word-representation.ts`, `math-document-grading-evaluator.ts`, `math-document-grading-persistence.ts`, `math-document-grading-queue.ts`, `math-document-grading-lifecycle.ts`, `math-document-grading-review.ts`, `teacher-assignment-review-derivative.ts`, `teacher-assignment-review-derivative-storage.ts`, `teacher-assignment-review-outbox.ts`, `teacher-assignment-resubmission-intake.ts`; boundary is Assignment public API plus approved-snapshot port. | Do not move C16 policy by assumption or write LearningFact from routes. Ready only with zero unclassified production/worker/script/test callers and complete snapshot/lineage proof; rollback preserves approved snapshots, CAS, idempotency, derivatives and outbox history. |
| Portrait and profile projections | `competency-*.ts`, `cumulative-*.ts`, `portrait-*.ts`, `profile-center.ts`, `profile-portfolio-evidence.ts`, `growth-evaluation.ts`, `student-evidence-feature-cache.ts`, `risk-detector.ts`; boundary is the existing Portrait V2/profile read and refresh ports. | Do not change portrait algorithms, `StudentCompetency` compatibility, freshness/confidence/fallback, eligibility, privacy or current pointers. Ready only after all readers use governed ports; rollback keeps the last qualified generation. |
| Classroom/session read models | `class-attribution.ts`, `class-scoped-learning-materialization.ts`, `class-session-attribution.ts`, `session-closure-*.ts`, `session-data-quality-report.ts`, `session-finalization-snapshots.ts`, `session-quality-status.ts`, `session-reports.ts`; boundary is authorized class/session read and finalization ports. | Do not weaken class/student authorization, redaction, independent-learner suppression, or backfill isolation. Ready only after worker/scheduler and report callers close; rollback preserves immutable session snapshots and receipts. |
| Simulation/Arena evidence | `control-workbench-run-context.ts`, `simulation-agent-evidence-materialization.ts`, `simulation-scene-run-persistence.ts`, `simulation-task-*.ts`, `control-correction-demo-package.ts`; boundary is official Arena submission and governed simulation-task evidence ports. | Do not make preview/open/isolated parameters official, rewrite scoring, or let UI become the evidence writer. Ready only after official/result and context-only paths are proven; rollback preserves `ArenaSubmission` and fact identity. |
| Knowledge/resource/SAR governance | `autocontrol-kaq-graph-catalog.ts`, `graph-center*.ts`, `knowledge-truth-revision.ts`, `course-evidence-specs.ts`, `resource-coverage-matching.ts`, `new-resource-semantic-completeness-gate.ts`, `learning-evidence-rag-corpus.ts`, `structured-associative-retrieval*.ts`, `openspec-change-evidence-path.ts`, `teacher-prep-pack-generation.ts`. | Do not change knowledge authority, release selectors, resource registry, or teaching admission. Ready only after public adapters and privacy scopes are singular; rollback leaves release and catalog identities unchanged. |
| Operator/backfill boundary | `course-evidence-backfill.ts`, `historical-evidence-materialization.ts`, `unit-4-4-backfill.ts`, `data-completeness-audit.ts`, `teacher-ai-grading-lab-*.ts`, and all matching `scripts/db/**`, `scripts/ops/**`, `scripts/data-governance/**`, worker/scheduler entrypoints. | Require explicit operator authorization, dry-run/frozen input, operation receipt, retention and recovery proof. No online writer/current-pointer access; deletion requires zero production consumers and a rollback rehearsal. |
| Compatibility/assets/tests | `index.ts`, `assets/**`, `__tests__/**`, `__tests__/fixtures/**`, generated/demo material discovered by A. | Do not delete the barrel, fixtures or assets in D. A later change may retire a compatibility surface only after zero consumers, regeneration/retention evidence and a reversible rollback are recorded. |

The listed paths are candidate slices, not permission to classify by prefix. A
member with mixed evidence is split out and adjudicated individually; a path
not present in A is not silently added, and a current A member missing from the
table is a denominator failure.

### 8. No-mutation boundary and rollback

D writes only its OpenSpec artifacts and, in a later implementation, bounded
decision evidence. It does not move source files, alter imports/exports,
execute backfills, touch Prisma or production, or mutate A/B/C artifacts. An
unqualified output is discarded or rolled back as an additive decision package;
A's immutable subject and historical charter inputs remain unchanged. A
qualified scoped projection is still only a read-only input to later migration
work and never a production selector.

## Risks / Trade-offs

- [Risk] A missing or stale A handoff causes a false owner decision. → Require
  exact subject/digest verification and fail closed before qualification.
- [Risk] A broad kernel label hides a domain state machine. → Require all
  seven independent kernel proofs and retain the domain fallback/unresolved
  status.
- [Risk] Dynamic, worker, Prisma or documentation callers are omitted. → Use
  separate caller classes and make denominator reconciliation fail for every
  unclassified relation.
- [Risk] C16 or Learning Record ownership is accidentally reopened. → Treat
  the archived ownership map and existing writer/approved-snapshot contracts as
  fixed constraints; D only records evidence.
- [Risk] Reports expose private content or become non-reproducible. → Emit
  safe identities/digests only, keep raw/full ledgers outside Git, and bind
  deterministic output to both subject and tool identities.
- [Risk] A high-impact writer, pointer, or retention conflict is forced into a
  convenient owner. → Keep it unresolved and require a separate decision-
  advisor review before any migration slice can qualify.

## Migration Plan

1. Parent coordination verifies #1876's live closure/archive/blockedBy gate;
   until then no claim, apply, implementation (including validator/fixture),
   adjudication run, normalized decision/evidence write, or qualified
   projection is permitted.  Only a parent coordination-layer gate-rejection
   may be output; it does not consume A and is neither a D result nor a D
   artifact.
2. Freeze A's subject identity and full-artifact digest, then capture the
   complete member/caller denominator without changing source or historical
   artifacts.
3. If tooling is implemented, record the clean tool checkpoint and validate
   the dual identity/frozen-input bundle.
4. Adjudicate each member/family using the six-outcome matrix, preserve all
   evidence, and emit compact summaries, charter/deprecation projection,
   privacy/determinism results and future slices.
5. If unresolved count is non-zero, hand back a non-qualified blocker package;
   if zero, hand the digest-bound scoped charter projection to a later
   authorized migration/review stage. D never activates it.
6. Rollback removes only additive non-qualified decision artifacts. It never
   rewrites A, the canonical charter, Learning Record data, Assignment state,
   or production selectors.

## Open Questions

- The parent must provide the live #1876 gate result and A subject/digest
  before implementation. A missing result is a blocker, not an assumption.
- Which records satisfy the kernel's two-real-domain-consumer and unique-API
  tests is intentionally unresolved until A's caller artifact is consumed.
- Any ambiguity involving online writers, current pointers, retention,
  authoritative scoring, or privacy requires a later decision-advisor and
  remains unresolved in D; it cannot be settled by directory layout or
  migration convenience.
