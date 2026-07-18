---
change_id: establish-assignment-authoring-domain
claim_branch: establish-assignment-authoring-domain
series: assignment-grading-workflow
coupling_group: assignment-grading-workflow
execution_mode: isolated
base_branch: integration
required_branch:
depends_on: []
parent_issue: 900
blocked_by: []
blocking:
  - integrate-mainline-assignment-mission-center
openspec_path: openspec/changes/establish-assignment-authoring-domain
risk: high
area: assignment-grading
---

## Goal

Create a first-class, versioned assignment authoring and publication domain with teacher management surfaces, governed question snapshots, analytic rubrics, class audiences, and hard score-consistency gates.

## Scope

- Assignment, revision, audience, question-snapshot, rubric, schedule, and policy persistence.
- Teacher assignment list, editor, question-bank picker, preview, and publication workflow.
- Central teacher `作业` navigation and `新建作业` action.
- Immutable publication revisions and protected teacher/student projections.

## Out of Scope

- Student submissions and uploads.
- Document conversion or AI grading.
- Teacher grading and student feedback.
- Migration of external platform history.

## Acceptance Checklist

- [ ] AC-1: Teachers can create, edit, version, and publish durable assignments to authorized classes with explicit historical authorization and mutation security. Owner: independent reviewer.
  Evidence: migration/referential checks, current-versus-historical authorization, CSRF/schema/bounds tests, assignment CRUD/publication integration tests, and teacher-route evidence.
- [ ] AC-2: Every published question freezes prompt, answer, response type, points, rubric, source lineage, and content hash. Owner: independent reviewer.
  Evidence: snapshot immutability tests covering manual and governed catalog sources.
- [ ] AC-3: Publication rejects inconsistent assignment, question, criterion, or rubric-level totals without silent rescaling. Owner: independent reviewer.
  Evidence: 10/20/25-style mismatch test and teacher-visible publication blocker evidence.
- [ ] AC-4: Teacher assignment navigation and authoring surfaces expose complete empty/error/conflict states and are responsive, accessible, and centrally registered. Owner: independent reviewer.
  Evidence: route-ledger checks, browser screenshots at 320/375/768/1024/1440px according to the support contract, keyboard focus checks, and accessible-name assertions.
- [ ] AC-5: The change passes OpenSpec, Prisma, TypeScript, and targeted regression gates. Owner: independent reviewer.
  Evidence: strict OpenSpec validation, Prisma validation/generation, typecheck, and targeted test output.

## Tasks

- [ ] Task 1: Implement the assignment persistence, revision, audience, authorization, and migration layer.
  Covers: AC-1, AC-2
  Acceptance: Published revisions are immutable, class-scoped, versioned, protected by current/frozen authorization, and safely projected by role.
  Evidence: schema/migration diff plus lifecycle, referential, CSRF/schema, authorization, concurrency, and immutability tests.
  Reviewer Check: Confirm the relational lifecycle replaces generic workflow JSON, historical revisions cannot cascade away, and new teachers do not automatically inherit prior documents.
- [ ] Task 2: Implement question authoring, governed source selection, rubric editing, and immutable source snapshots.
  Covers: AC-2, AC-3
  Acceptance: Manual and catalog-backed questions share a complete snapshot contract and invalid rubrics cannot publish.
  Evidence: service/UI tests and stored snapshot fixtures with source hashes and rubric versions.
  Reviewer Check: Confirm published grading never reads mutable live question or rubric content.
- [ ] Task 3: Implement publication validation and class audience binding.
  Covers: AC-1, AC-3
  Acceptance: Publishing is transactional, authorized, idempotent, and blocks every score-scale mismatch.
  Evidence: publication integration tests including unauthorized classes and inconsistent totals.
  Reviewer Check: Confirm no code path silently normalizes or rescales score totals.
- [ ] Task 4: Implement teacher assignment list, editor, picker, navigation, responsive layout, and accessibility behavior.
  Covers: AC-4
  Acceptance: Teachers can complete the authoring journey with clear loading/empty/error/conflict states, supported-width behavior, and central route continuity.
  Evidence: Playwright/browser evidence at the declared widths, route inventory tests, keyboard focus restoration, and accessibility checks.
  Reviewer Check: Confirm `作业` is secondary teacher workflow navigation, narrow phones do not expose a broken editor, and the three question regions remain visually primary.
- [ ] Task 5: Run and record all required verification.
  Covers: AC-5
  Acceptance: All scoped validation commands pass with no new TypeScript errors.
  Evidence: command outputs recorded in the implementation handoff or PR.
  Reviewer Check: Re-run or independently inspect every reported gate before approving AC-5.

## Agent Guardrails

- Only execute this issue's change.
- Implementation agents may propose satisfied AC ids with evidence, but must not check Acceptance Checklist items themselves.
- Check AC items only after an independent reviewer confirms the linked task evidence.
- Use the claim branch named in front matter.
- Do not execute other planned OpenSpec changes.
- Stop if dependency, coupling group, or branch constraints fail.
- Stop if GitHub blockedBy relationships still contain open blockers.
