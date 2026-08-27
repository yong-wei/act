## Context

The repository has four distinct generated-content areas:

- **Assessment:** src/features/adaptive-assessment/*, assessment generation
  and submission routes, the reviewed catalog, and the concrete governance
  change reconcile-reviewed-assessment-generation-governance (#1564).
- **Assignment rubric:** src/lib/assignments/assignment-rubric-generation.ts,
  Assignment question/rubric snapshots, and the Assignment public lifecycle
  boundary.
- **Smart Lesson:** src/lib/smart-lesson-plan/{domain,schema,service,queue,
  worker}.ts, SmartLessonTask/draft/revision/generation records, and teacher
  smart-lesson task/draft/generation routes.
- **Smart Courseware:** src/lib/smart-courseware/{domain,schema,
  generation-service,publication-service,queue,worker}.ts,
  SmartCourseware draft/revision/module/job/receipt records, and teacher
  draft/generation/publication routes.

Each domain has different identities and state names. The requested change is
a reconciliation and fitness layer only: it must not turn these into a single
AI product domain or make one domain's state machine the other domains'
authority.

## Goals / Non-Goals

**Goals:**

- Define a small, domain-neutral invariant vocabulary and a denominator-closed
  matrix with owner, evidence, status, and dependency fields.
- Verify that AI output is editable draft/candidate material until deterministic
  validation, human action, immutable revision/snapshot, and publication proof
  are all present in the owning domain.
- Detect direct AI writes to catalogs, scores, student feedback, LearningFact,
  or publication selectors and report the owning path.
- Preserve domain-specific routes, APIs, models, workers, scripts, tests,
  privacy, idempotency, and rollback semantics.

**Non-Goals:**

- Creating an AI superdomain, common candidate table, shared state machine,
  shared persistence, provider abstraction, or unified publication service.
- Implementing Assessment generation governance; its row remains blocked until
  #1564 is qualified.
- Moving Assignment, Smart Lesson, or Smart Courseware ownership or changing
  their scoring, catalog, classroom, or publication behavior.
- Writing catalog/score/feedback/LearningFact data, changing selectors, or
  deploying/activating production.

## Decisions

### 1. Use one invariant vocabulary, not one runtime model

The matrix defines the following checks, each evaluated against a domain's own
contract:

1. DRAFT_EDITABLE: model output is an editable draft/candidate with owner,
   input/source identity, content hash, provider metadata in a private audit,
   and no authority sink.
2. VALIDATED_DETERMINISTIC: schema, content, source, identity, and policy
   validation is deterministic and bound to the exact draft hash.
3. HUMAN_ACCEPTED: a domain-authorized human accepts or approves the exact
   draft/revision; AI or automated precheck cannot self-approve.
4. IMMUTABLE_REVISION: acceptance creates or references an immutable domain
   revision/snapshot with source/input/content hashes and lineage.
5. PUBLICATION_RECEIPT: a versioned domain publication receipt or equivalent
   authority artifact binds the immutable revision to its consumer boundary.
6. NO_DIRECT_AUTHORITY_WRITE: generation cannot directly write a catalog,
   score, student feedback, LearningFact, or production selector.
7. DOMAIN_OWNERSHIP: the domain keeps its own state machine, storage,
   worker, API, and rollback owner; cross-domain access uses a public contract.

The vocabulary is a verification lens, not a shared enum persisted in product
records.

### 2. Make the reconciliation matrix the only cross-domain record

Each row contains domain, owner, source revision/tree, draft/candidate
identity, validation evidence, human decision identity, immutable revision or
snapshot, publication receipt/equivalent, forbidden sinks, route/API/model/
worker/script/test/caller denominator, privacy class, idempotency key/hash,
rollback owner, status, and dependency. All references are repository-relative
or content-addressed; missing, mixed-revision, or stale evidence returns
BLOCKED/NOT_QUALIFIED.

No row may introduce a global candidate id or become a product source. A
domain can have several local candidate identities, but the matrix only
records their exact local references and status.

### 3. Reconcile the four domains without artificial coupling

| Domain | Owner and local authority | Matrix disposition |
| --- | --- | --- |
| Assessment | adaptive-assessment/catalog governance; concrete path is #1564 | BLOCKED until #1564 proves draft -> deterministic precheck -> independent human review -> versioned catalog publication receipt; no implementation here |
| Assignment rubric | src/lib/assignments; Assignment public API and immutable question/rubric revision | Verify generated rubric is editable, validated, teacher accepted, and frozen in the Assignment revision; it cannot set grades, feedback, LearningFact, or publish itself |
| Smart Lesson | src/lib/smart-lesson-plan; its task/draft/revision/job/worker contract | Verify local generation/review/revision/publication evidence and use its existing routes/state machine; no shared candidate/state |
| Smart Courseware | src/lib/smart-courseware; its draft/module/revision/job/publication receipt contract | Verify local generation/validation/teacher approval/immutable revision/publication receipt and classroom binding; no shared candidate/state |

The table is a matrix projection, not a new execution path. Assessment is
explicitly blocked rather than guessed complete from existing filenames.

### 4. Implement architecture fitness checks as read-only gates

Checks parse the declared source/caller denominator and domain contracts to
detect missing evidence, direct model/provider-to-authority writes, route or
feature deep imports, mixed revision/hash references, missing idempotency or
authorization, and an unowned worker/script/test caller. They report the
domain-local replacement and do not modify records. A new cross-domain sink
or a matrix row without its required evidence fails qualification; an existing
blocked row remains visible and does not become complete by this change.

### 5. Preserve privacy, idempotency, and rollback per domain

The matrix may retain only hashes, stable internal revision/receipt identities,
status, owner, and evidence paths. Prompts, model responses, student answers,
feedback bodies, credentials, user identifiers, and local absolute paths stay
within domain-private or external artifacts. Each domain's existing CAS,
idempotency, auth, outbox, worker lease, and rollback contract remains the
verification target; the matrix does not bypass it.

### 6. Keep QA receipts separate from authority

Run-specific screenshots, traces, HARs, logs, and private QA reports remain
external under externalize-run-specific-qa-evidence-artifacts. The matrix can
reference a content-addressed QA receipt containing source/revision hash,
output hash/reference, tool version, and conclusion. QA success cannot count
as human approval, publication, score, feedback, or LearningFact evidence.

## Boundary Classes

- **Hard:** no direct AI authority writes, owner/identity/source hash, human
  approval, immutable revision, publication receipt, privacy, and rollback.
- **Contract:** invariant vocabulary, domain matrix, source/tree receipt,
  route/API/model/worker/script/test/caller denominator, and fitness output.
- **Soft:** domain-specific labels and advisory presentation; they cannot
  qualify or publish an output.
- **Delete:** no product or domain data/code is deleted by this change. Any
  later cleanup remains in the owning domain's explicitly authorized change.

## Risks / Trade-offs

- [Risk] A common matrix is mistaken for a common candidate/state model. →
  Keep the record read-only, domain-local identities explicit, and add a
  fitness test rejecting shared persistence/state imports.
- [Risk] Assessment is incorrectly marked complete from old artifacts. → Keep
  its row BLOCKED until #1564's exact contract/source/tests/receipt qualify.
- [Risk] A domain's provider metadata leaks into public output. → Require
  private audit references and privacy scans over matrix and API fixtures.
- [Risk] Checks impose a new runtime coupling. → Run them as architecture
  validation against source and receipts; they do not call generation or
  publication services.
- [Trade-off] Parallel domain work may produce different local names. → The
  matrix compares invariant evidence, not names, and preserves each owner's
  state machine.

## Migration Plan

1. Freeze the source/tree and complete owner/route/API/model/worker/script/
   test/caller denominator for all four domains.
2. Publish the invariant vocabulary and matrix schema with privacy, identity,
   idempotency, revision, and receipt fields; add fixture tests.
3. Populate domain rows from existing contracts. Mark Assessment blocked and
   reference #1564; do not add implementation there.
4. Implement read-only architecture fitness checks for authority sinks,
   missing evidence, mixed revisions, deep imports, and shared-model/state
   attempts; run them against each domain's existing test/receipt evidence.
5. Reconcile remaining callers and record domain-owned follow-up changes. Do
   not make the Assignment chain a prerequisite for Smart Lesson/Courseware or
   the blocked Assessment row.
6. Run privacy, authorization, idempotency, rollback, source-boundary,
   matrix/fitness, focused domain tests, typecheck, and strict OpenSpec
   validation. Externalize run-specific QA outputs and retain only
   revision/hash/conclusion receipts.

Rollback disables the fitness gate/report publication and preserves all
domain-local drafts, candidates, revisions, snapshots, receipts, jobs, and
audit records. It does not create a shared fallback or delete local history.

## Open Questions

The matrix field names and output format may follow the existing architecture
receipt conventions. The invariant semantics, Assessment #1564 dependency,
domain ownership, no-shared-model rule, and QA/authority separation are fixed.
