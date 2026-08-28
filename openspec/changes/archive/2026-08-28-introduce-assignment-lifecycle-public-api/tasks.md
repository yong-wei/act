## 1. Denominator And Characterization

- [x] 1.1 Freeze the implementation source revision and enumerate every
  Assignment owner, route, API handler, Prisma model/relation, worker,
  script, test, UI feature, and production caller in a repository-relative
  inventory.
- [x] 1.2 Characterize current `assignment-service.ts`,
  `submission-service.ts`, route-guard, DTO, publication-CAS, audience,
  frozen-ownership, snapshot, and idempotency behavior with passing fixtures.
- [x] 1.3 Classify teacher, student, admin, historical, and compatibility
  projections and record fields that are forbidden in each DTO.
- [x] 1.4 Record the dependency/owner decision against the modular charter
  and domain-dependency contract before changing imports.

## 2. Public Contract And Adapters

- [x] 2.1 Define the Assignment public DTOs, error codes, and application
  use-case inputs/outputs for authoring, publication, delivery, submission,
  answer, asset, and historical reads.
- [x] 2.2 Define the minimal persistence, clock, authorization-context, and
  object-store ports and implement Prisma/object-store adapters under the
  Assignment owner.
- [x] 2.3 Preserve existing revision/question/attempt snapshots, audience
  binding, immutable publication, content hashes, and restrictive relation
  behavior without adding a table, enum, migration, or state machine.
- [x] 2.4 Encode publication compare-and-swap, publication-operation
  idempotency, bounded mutation inputs, and explicit conflict/error mapping.
- [x] 2.5 Encode student-safe versus teacher-safe DTOs and frozen student,
  audience, class, and historical-ownership authorization checks.

## 3. Vertical Caller Migration

- [x] 3.1 Move teacher assignment list, detail, draft, next-draft,
  publication, question-catalog, and content-asset routes to the public API.
- [x] 3.2 Move student assignment list/detail, answer draft, upload,
  finalize, reorder, delete, history, submit, and feedback-asset routes to
  the public API.
- [x] 3.3 Update `assignment-authoring` and `assignments` feature callers to
  consume public DTOs; keep review orchestration as the explicit next-change
  handoff.
- [x] 3.4 Re-run the inventory, migrate all remaining production callers, and
  remove this change's direct route/feature imports of Prisma or private
  Assignment helpers.
- [x] 3.5 Add a source-level no-facade proof that application logic is owned by
  the public Assignment boundary and not delegated to a route or unrelated
  data-governance module.

## 4. Verification And Safety

- [x] 4.1 Add contract tests for DTO redaction, input bounds, error mapping,
  route-only delivery responsibilities, and public import direction.
- [x] 4.2 Add authorization tests for author/admin, class/audience, review
  handoff, historical ownership, cross-student, cross-class, and stale
  revision access.
- [x] 4.3 Add concurrency and idempotency tests for draft CAS, publication
  duplicate/conflict, answer submission retry, asset retry, and immutable
  published revision behavior.
- [x] 4.4 Add rollback and data-preservation checks proving no assignment,
  revision, question, submission, attempt, or checksum is deleted by the
  migration or rollback path.
- [x] 4.5 Verify run-specific QA is externalized and receipts contain only
  revision/hash/conclusion data; run focused tests, typecheck, and strict
  OpenSpec validation for this change.
