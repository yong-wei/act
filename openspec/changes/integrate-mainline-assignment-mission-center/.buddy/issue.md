---
change_id: integrate-mainline-assignment-mission-center
claim_branch: integrate-mainline-assignment-mission-center
series: assignment-grading-workflow
coupling_group: assignment-grading-workflow
execution_mode: isolated
base_branch: integration
required_branch:
depends_on:
  - establish-assignment-authoring-domain
parent_issue:
blocked_by: []
blocking: []
openspec_path: openspec/changes/integrate-mainline-assignment-mission-center
risk: high
area: assignment-grading
---

## Goal

Turn `/missions` into the student Task Center with teacher-published `主线作业`, preserved `任务进阶`, independently submitted question answers and attachments, aggregate assignment state, and protected immutable object assets.

## Scope

- Student profile Task Center entry and `/missions` information architecture.
- Assignment envelope, question answer attempt, immutable asset, aggregate state, and idempotency lifecycle.
- Per-question text/attachment drafts, formal question submissions, attempts, and aggregate assignment progress.
- Private S3-compatible object storage, signed upload/finalization, audience, deadline, mutation-security, and historical ownership authorization.

## Out of Scope

- Whole-assignment document upload or automatic question segmentation.
- Document conversion and AI grading.
- Teacher review, teacher return/resubmission commands, or approved feedback publication.
- Migration of legacy Mission/UserProgress into assignment tables.

## Acceptance Checklist

- [ ] AC-1: Personal Center and `/missions` expose `任务中心`, default `主线作业`, and preserved `任务进阶` without removing class join. Owner: independent reviewer.
  Evidence: route/component tests and browser evidence for profile, both Task Center tabs, and loading/empty/filtered-empty/error states.
- [ ] AC-2: Every question persists and formally submits text or attachment answer attempts, versions, upload state, and history independently. Owner: independent reviewer.
  Evidence: schema/API tests proving one question submit does not mutate other answers and aggregate state is server-derived.
- [ ] AC-3: Private S3-compatible storage, signed upload/finalization, and immutable asset contracts reject unbound whole-assignment documents and unsafe or replayed access. Owner: independent reviewer.
  Evidence: object adapter, quarantine, maximum-TTL signature, finalization, overwrite, GC, and idempotency tests.
- [ ] AC-4: Student delivery and historical-own-submission access use explicit current/frozen authorization and protected mutation routes. Owner: independent reviewer.
  Evidence: class-change, cross-student, CSRF, schema/bounds, forged-resource, quota, and history tests.
- [ ] AC-5: Deadline handling, responsive behavior, accessibility, and project validation gates pass. Owner: independent reviewer.
  Evidence: deadline tests, question-change and submit-success/failure/retry/history focus restoration, 320/375/1024/1440 browser evidence, OpenSpec validation, Prisma, and typecheck.

## Tasks

- [ ] Task 1: Implement assignment envelope, question answer/attempt, immutable asset, migration, current/frozen authorization, and mutation-security records.
  Covers: AC-2, AC-4, AC-5
  Acceptance: Records are relational, question-bound, versioned, indexed, protected by current/frozen ownership, and safe by role and request origin.
  Evidence: migration diff and authorization, CSRF/schema, ownership, history, and deadline tests.
  Reviewer Check: Confirm answer/asset ownership cannot cross questions, submissions, students, or classes and class changes do not fail open.
- [ ] Task 2: Implement the private object-store adapter, per-question draft/upload/finalization, and formal `提交本题` APIs.
  Covers: AC-2, AC-3, AC-4
  Acceptance: The server deploys one S3-compatible production contract, validates short-lived signed access, creates immutable asset versions, seals one answer attempt at a time, and rejects unbound combined documents.
  Evidence: adapter/deployment and API tests for URL TTL/binding, HEAD/scan finalization, overwrite prevention, partial failure, duplicate requests, MIME/checksum failure, and whole-document rejection.
  Reviewer Check: Confirm unfinished assets cannot be submitted, full bearer URLs are never persisted/logged, and downstream grading consumes the same object-store contract.
- [ ] Task 3: Implement profile entry, `主线作业`/`任务进阶`, compact assignment list, and assignment detail UI.
  Covers: AC-1, AC-5
  Acceptance: Mainline assignments are the default, legacy missions remain usable, complete list states are distinguishable, and the full student journey is responsive and accessible with deterministic focus restoration.
  Evidence: browser screenshots, Playwright flows, loading/empty/filtered-empty/error actions, mobile behavior, question/submit/retry focus checks, and state labels.
  Reviewer Check: Confirm the name-card link changes but class join remains available, and question submission never leaves keyboard/screen-reader focus ambiguous.
- [ ] Task 4: Implement per-question aggregate state, historical-own-submission recovery, and protected error behavior.
  Covers: AC-2, AC-4
  Acceptance: Required question submissions drive aggregate state and historical ownership remains explicit without exposing other audiences.
  Evidence: aggregate-state, class-change, missing-context, cross-student, and end-to-end evidence.
  Reviewer Check: Confirm no whole-assignment sealing action is required and unchanged question drafts or submissions remain untouched.
- [ ] Task 5: Run and record all required validation.
  Covers: AC-5
  Acceptance: Scoped OpenSpec, Prisma, TypeScript, integration, and browser gates pass.
  Evidence: command outputs and captured browser evidence in the implementation handoff or PR.
  Reviewer Check: Independently verify the reported gates and test coverage before approving AC-5.

## Agent Guardrails

- Only execute this issue's change.
- Implementation agents may propose satisfied AC ids with evidence, but must not check Acceptance Checklist items themselves.
- Check AC items only after an independent reviewer confirms the linked task evidence.
- Use the claim branch named in front matter.
- Do not execute other planned OpenSpec changes.
- Stop if dependency, coupling group, or branch constraints fail.
- Stop if GitHub blockedBy relationships still contain open blockers.
