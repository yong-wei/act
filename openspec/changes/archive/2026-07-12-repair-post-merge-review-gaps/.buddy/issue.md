---
change_id: repair-post-merge-review-gaps
claim_branch: repair-post-merge-review-gaps
series: post-merge-review-repairs
coupling_group: none
execution_mode: isolated
base_branch: integration
required_branch:
depends_on: []
parent_issue:
blocked_by: []
blocking: []
openspec_path: openspec/changes/repair-post-merge-review-gaps
risk: high
area: quality
---

## Goal

Close three narrowly scoped post-merge review gaps already represented by the `repair-post-merge-review-gaps` branch diff: active-class publication scope, per-student portrait materialization concurrency, and submission asset byte-integrity verification.

## Scope

- Enforce `isActive: true` for administrator-selected classes during assignment publication, before any revision or audience write.
- Serialize each student's portrait v2 materialization read/update/write sequence with a transaction-scoped advisory lock while preserving incremental cursor semantics.
- Verify submission asset size and SHA-256 digest at read time before returning object bytes, rejecting same-size tampering.

## Out of Scope

- Any `buddy-auto` or Buddy skill modification, including changes in the external OpenSpec-buddy repository.
- The `e734` worktree, `dev1`, and any other worktree or branch outside this isolated change.
- Re-running or re-performing the original PRs' local reviews.
- New product capabilities, database schema/cursor migrations, provider changes, unrelated refactors, GitHub issue/Project/PR operations during this proposal preparation, commit, or push.
- Reordering historical LearningFact ingestion by commit order; that requires a separate migration and is not claimed by this repair.

## Acceptance Checklist

- [ ] AC-1: Assignment publication rejects administrator-selected inactive classes before revision freeze or audience creation. Owner: independent reviewer.
  Evidence: `assignment-service.ts` diff and the focused inactive-class publication regression case.
- [ ] AC-2: The production Prisma transaction path serializes the per-student snapshot read/update/write unit inside a transaction-scoped lock, fails closed without lock support, and does not claim to reorder historical LearningFact ingestion. Owner: independent reviewer.
  Evidence: `portrait-v2-materialization.ts` diff, the focused transaction/advisory-lock regression cases, and the explicit OpenSpec boundary.
- [ ] AC-3: Authorized submission asset reads reject both size mismatches and same-size SHA-256 mismatches before returning bytes. Owner: independent reviewer.
  Evidence: submission domain/service/read-route diff and the focused same-size tampering regression case.
- [ ] AC-4: The OpenSpec artifacts, three capability deltas, and Buddy metadata satisfy their local structural and strict validation contracts, with the repair scope limited to AC-1 through AC-3. Owner: independent reviewer.
  Evidence: strict OpenSpec validation, issue-body validation, and final path/diff-scope checks.

## Tasks

- [ ] Task 1: Apply and verify the active-class publication boundary for administrator audiences.
  Covers: AC-1
  Acceptance: Inactive classes are excluded from the administrator lookup and publication fails with no revision freeze or audience creation.
  Evidence: `src/lib/assignments/assignment-service.ts` and `src/lib/__tests__/assignment-service.test.ts` diff plus focused test output.
  Reviewer Check: Confirm the active predicate applies to administrators without weakening teacher ownership checks or changing unrelated publication behavior.
- [ ] Task 2: Apply and verify transaction-scoped portrait materialization serialization with fail-closed lock support.
  Covers: AC-2
  Acceptance: The production Prisma transaction path holds one transaction-scoped advisory lock across the prior-snapshot read and snapshot write, missing lock support fails before the read, and cursor/evidence semantics remain intact within the declared scope.
  Evidence: `src/lib/data-governance/portrait-v2-materialization.ts` and `src/lib/data-governance/__tests__/portrait-v2-incremental-update.test.ts` diff plus focused test output.
  Reviewer Check: Confirm the lock is released with the transaction, the production path uses the transaction client, and no second portrait data path is introduced.
- [ ] Task 3: Apply and verify read-time submission asset integrity checks.
  Covers: AC-3
  Acceptance: The read path compares fetched byte length and SHA-256 digest with persisted metadata and returns no unverified bytes on mismatch.
  Evidence: `submission-domain.ts`, `submission-service.ts`, read route, and `submission-domain.test.ts` diff plus focused test output.
  Reviewer Check: Confirm authorization/token consumption remains unchanged and both size-only and same-size content tampering fail closed.
- [ ] Task 4: Add and validate the three affected capability deltas.
  Covers: AC-4
  Acceptance: Assignment publication, learner-state materialization, and submission asset integrity contracts each have a parseable delta with at least one scenario.
  Evidence: `openspec/changes/repair-post-merge-review-gaps/specs/**` and strict OpenSpec validation.
  Reviewer Check: Confirm the deltas document the repaired behavior without claiming the out-of-scope historical LearningFact cursor redesign.
- [ ] Task 5: Run scoped artifact and metadata validation.
  Covers: AC-4
  Acceptance: Proposal/design/tasks/issue body validate locally, all checklist and task checkboxes remain unchecked at propose time, and only the requested repair code, tests, and OpenSpec artifacts are changed.
  Evidence: `openspec validate repair-post-merge-review-gaps --strict`, Buddy issue-body validation, and `git status`/path checks.
  Reviewer Check: Confirm every AC has evidence, every AC is covered by a task, no proposal-stage checklist item is self-approved, and excluded Buddy/e734/original-review work is absent.

## Agent Guardrails

- Only execute this issue's change.
- Implementation agents may propose satisfied AC ids with evidence, but must not check Acceptance Checklist items themselves.
- Check AC items only after an independent reviewer confirms the linked task evidence.
- Use the claim branch named in front matter.
- Do not execute other planned OpenSpec changes.
- Stop if dependency, coupling group, or branch constraints fail.
- Stop if GitHub blockedBy relationships still contain open blockers.
