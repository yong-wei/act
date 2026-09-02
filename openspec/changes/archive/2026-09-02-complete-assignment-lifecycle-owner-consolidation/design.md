## Context

The Assignment public surface already aggregates authoring/publication,
student submission, review, grading closure, and feedback operations.  Its
implementation still imports assignment grading orchestration and document
grading helpers from Data Governance, while Assessment owns attempt semantics
and Learning Record owns current projection reads/writeback policy.  The target
is an ownership closure, not a rewrite of those contracts.

## Goals / Non-Goals

**Goals:**

- Make Assignment the single application owner for assignment lifecycle
  commands and role-safe DTOs.
- Make all cross-domain interactions explicit through the existing Assessment
  and Learning Record contracts/ports.
- Preserve immutable revision/snapshot/attempt lineage, teacher approval,
  AI-draft advisory status, idempotency, CAS, outbox, privacy, and release rules.
- Produce a complete caller inventory and no-hidden-facade proof.

**Non-Goals:**

- Adding or renaming a public lifecycle API, table, enum, grading state, or
  worker contract.
- Moving Assessment ownership into Assignment or letting Assignment become a
  Learning Record projection reader/writer.
- Changing score formulas, assignment content, route URLs, or UI layout.

## Decisions

### 1. Assignment owns lifecycle commands

Create/update/delete draft, publish, list/read delivery, save/submit response,
open/save/approve/return review, release feedback, resubmission, and grading
closure enter through the existing `src/lib/assignments` public API.  Routes
remain thin adapters for authentication, mutation protection, parsing, and
response mapping.

### 2. Cross-domain owners remain explicit

Assessment continues to own attempt selection, scoring, and assessment
evidence.  Learning Record continues to own current projections and governed
fact/read boundaries.  Assignment passes stable revision/question/attempt or
approved-snapshot references through existing ports; it does not query another
domain's tables or copy its state machine.

### 3. Existing lifecycle identities remain canonical

The migration reuses Assignment, AssignmentRevision, question/content
snapshots, audiences, answers, attempts, reviews, approval snapshots,
outbox/derivative, release, and audit identities.  New calls preserve request
hashes, idempotency keys, optimistic versions, actor scope, frozen student
ownership, and teacher approval as currently defined.

### 4. Owner closure is proven by all caller classes

The denominator includes production routes/features, server actions, workers,
scripts, tests, document grading, Assessment adapters, Learning Record
writeback/read consumers, and dynamic imports.  A direct import is removed
only after its replacement and behavior/privacy evidence are recorded.

### 5. C16 owns the orchestration extraction

This change establishes the ownership target and migrates callers.  The next
change moves the concrete orchestration out of Data Governance into Assignment
without introducing a forwarding facade.  C15 must not claim that a facade is
an owner migration.

## Risks / Trade-offs

- [A caller loses a lineage or authorization check] → replay route fixtures and
  compare assignment/revision/submission/attempt identities and errors.
- [Assignment starts writing Learning Record facts] → enforce explicit ports
  and import fitness tests; keep governed writeback in its owner.
- [Assessment state is duplicated] → require Assessment use cases for attempts
  and reject direct table reads from Assignment routes.
- [A hidden worker or script remains on the old owner] → include dynamic,
  worker, script, and test inventories before deleting imports.

## Migration Plan

1. Freeze owner/caller matrix and behavior/error/privacy baseline.
2. Migrate routes, features, workers, scripts, Assessment adapters, and
  Learning Record consumers to existing public/port contracts.
3. Verify revision/snapshot/attempt lineage, idempotency/CAS, approval, release,
  role DTOs, outbox, and evidence boundaries.
4. Close the inventory and hand the concrete Data Governance extraction to C16.
5. Roll back before deletion proof by restoring the last qualified adapters;
  preserve all durable records and identities.

## Open Questions

None.  The implementation may choose internal module placement under
`src/lib/assignments`, but there must remain one public Assignment entrypoint.
