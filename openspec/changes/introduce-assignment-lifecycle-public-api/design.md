## Context

The Assignment owner already exists in `src/lib/assignments` and Prisma.
`assignment-service.ts` contains teacher listing, draft creation/update/delete,
next-draft creation, and publication.  `submission-service.ts` contains the
student read model, question draft and asset operations, submission, and
retention helpers.  The current route set includes:

- `/api/teacher/assignments`, `/api/teacher/assignments/[assignmentId]`,
  `next-draft`, `publish`, content-assets, question-catalog, and
  `submissions`/`review` entrypoints;
- `/api/student/assignments`, question answer/asset/history/submit routes, and
  the approved-feedback asset route; and
- teacher and student pages under `/teacher/assignments` and
  `/missions/assignments/[assignmentId]`.

The relational lifecycle is already represented by `Assignment`,
`AssignmentRevision`, `AssignmentAudience`, `AssignmentQuestion`,
`AssignmentSubmission`, `SubmissionAnswer`, and `SubmissionAttempt`.  Review
records such as `GradingRun` and `TeacherAssignmentReview` are downstream
contracts and are not re-owned or redesigned here.

## Goals / Non-Goals

**Goals:**

- Make one typed, stable public boundary for assignment lifecycle use cases.
- Keep persistence and object-store details behind ports and adapters while
  retaining the current Prisma/object-store behavior.
- Give every route and UI caller a safe DTO and a single authorization path.
- Preserve identity, immutable revision, snapshot, audience, publication CAS,
  idempotency, and student-data protection invariants.
- Produce a denominator-closed migration and a machine-checkable no-facade
  proof.

**Non-Goals:**

- Adding or redesigning Prisma models, assignment states, scoring, review
  states, AI providers, or LearningFact/evidence authority.
- Moving the completed teacher-review state machine; that is the next change.
- Deleting legacy document-grading routes or the `LearningEvidenceDraft`
  model; that is a later retirement change.
- Changing production deployment, selectors, or run-specific QA storage.

## Decisions

### 1. Keep the current Assignment owner and create one real application boundary

The public entry module is placed under `src/lib/assignments` and owns the
application orchestration.  It exposes stable DTOs for teacher assignment
summaries/revisions/questions/audiences and student assignment/submission/
answer/attempt/feedback projections, plus use cases for listing, draft CRUD,
next-draft creation, publication, student reads, answer editing, assets, and
submission.  The API may be split into local `public-api`, `application`,
`ports`, and `adapters` files, but those files remain one Assignment owner.

This is an extraction of existing behavior, not a facade that delegates each
public function to a route or to an unrelated data-governance module.  The
application layer performs validation, authorization context checks, state
transitions, and transaction boundaries; the Prisma adapter performs only
persistence and the object-store adapter performs only content access.

### 2. Preserve the existing identity and lifecycle records

No schema migration is required.  A published `AssignmentRevision` remains
immutable and is selected by its stable assignment/revision identity.  A
question retains its prompt, answer, rubric, source lineage, and content hash
snapshot.  Submissions remain bound to the published revision and frozen
student/audience class identities; attempts remain append-only.  The public
DTOs never replace these ids with display names.

### 3. Make routes delivery adapters only

Each route performs, in order, session/role authentication, Origin/CSRF
mutation protection, bounded schema parsing, one public use-case call, and
safe error/response mapping.  A route MUST NOT import Prisma, query an
Assignment model directly, import a private service helper, or construct a
student/teacher DTO by selecting fields ad hoc.  UI features consume the
public DTOs and do not become a second application boundary.

### 4. Preserve publication compare-and-swap and idempotency

Publication receives a saved revision id, expected version, content digest,
audiences, and an idempotency key.  The application verifies the saved draft,
audience authorization, digest, and current version in the existing
transaction, then reuses the existing publication-operation identity.  A
retry with the same request returns the same immutable result; a different
baseline or request hash conflicts.  Publication never performs an implicit
save.

### 5. Keep student and teacher projections separately authorized

Teacher operations resolve author, active class, or explicit review-grant
access.  Student operations resolve current audience access or frozen
historical ownership and bind every answer/asset operation to the student,
assignment, revision, question, and attempt.  Reference answers and teacher
rubric guidance are omitted from student pre-submission DTOs.  A missing,
stale, or mismatched identity fails closed without disclosing another user's
data.

### 6. Prove the boundary and migrate in vertical slices

The characterization records every production route, page, feature, direct
Prisma access, internal import, model, worker, script, test, and caller.  The
implementation then moves teacher authoring/publication first and student
submission second, followed by remaining shared callers.  A structural test
must prove the final production graph is `route/UI -> Assignment public API ->
ports -> adapters -> Prisma/object store`, with no feature/route deep import
and no new facade or parallel owner.

### 7. Keep QA and evidence authority out of the lifecycle API

Run-specific screenshots, traces, HARs, logs, and private audit payloads are
external to the repository.  A test or release receipt may retain only the
captured source/revision hash, output hash/reference, and conclusion.  This
public API does not write LearningFact, approval, or review evidence.

## Boundary Classes

- **Hard:** stable assignment/revision/question/attempt identity, student and
  teacher authorization, published-revision immutability, source/checksum
  lineage, and publication/submission CAS and idempotency.
- **Contract:** public DTOs, use-case signatures, ports/adapters, route-only
  delivery, error mapping, caller inventory, and dependency fitness proof.
- **Soft:** labels, presentation ordering, and non-authoritative loading or
  retry copy; these may change without changing lifecycle authority.
- **Delete:** only this change's superseded direct imports or temporary
  extraction adapters after the caller denominator is zero. Models, worker
  contracts, historical evidence, and governance scripts are not delete
  targets here.

## Risks / Trade-offs

- [Risk] A DTO accidentally exposes a reference answer, raw answer, or
  internal provider field. → Use separate student/teacher schemas, field-level
  contract tests, and privacy scans over serialized responses.
- [Risk] Extraction changes an existing authorization or snapshot check. →
  Characterize current outputs and replay authorization, stale-version,
  audience, historical-ownership, and student-isolation fixtures before
  changing imports.
- [Risk] Two route callers race on publication or submission. → Preserve the
  existing database CAS/unique constraints and add concurrent-request tests.
- [Risk] A public module becomes a one-line compatibility facade. → Require
  implementation ownership in the application module and assert import and
  call direction in a source-level fitness test.
- [Trade-off] Internal helper names may change. → Keep a short-lived private
  adapter only during the vertical migration and delete it once the caller
  denominator reaches zero; do not expose it as a second public API.

## Migration Plan

1. Freeze the source revision and characterize the owner/route/API/model/
   worker/script/test/caller denominator, including direct Prisma and deep
   imports.
2. Define the public DTO, use-case, error, port, and adapter contract and add
   contract tests without changing runtime behavior.
3. Migrate teacher assignment list/editor/draft/publication/assets routes and
   their feature callers, then migrate student assignment/read/answer/assets/
   submit routes.
4. Re-run the caller inventory, migrate every remaining production caller,
   and remove only direct internal imports that this change owns.  Review
   routes remain a declared downstream handoff to the next change.
5. Validate identity, authorization, concurrency, idempotency, privacy,
   rollback, no-facade, type, and focused route tests.  Externalize any
   run-specific QA and retain only a revision/hash/conclusion receipt.

Rollback disables the new route bindings and stops new lifecycle mutations
while retaining all drafts, published revisions, submissions, attempts, and
publication operations.  No data migration or destructive deletion is
performed by rollback; existing immutable identities remain readable through
the prior verified path until the next change is ready.

## Open Questions

The exact file split inside `src/lib/assignments` may follow local naming
conventions.  It must not change the public DTO semantics, owner, or
dependency direction, and any unresolved split must remain in the design
receipt rather than creating a second boundary.
