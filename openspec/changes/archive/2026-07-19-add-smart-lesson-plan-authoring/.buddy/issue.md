---
change_id: add-smart-lesson-plan-authoring
claim_branch: add-smart-lesson-plan-authoring
series: smart-lesson-preparation
coupling_group: smart-prep-source-plan
execution_mode: isolated
base_branch: integration
required_branch:
depends_on:
  - add-teacher-course-basis-management
parent_issue:
blocked_by:
  - add-teacher-course-basis-management
blocking:
  - add-smart-courseware-generation-editor
openspec_path: openspec/changes/add-smart-lesson-plan-authoring
risk: high
area: teacher-authoring
---

## Goal

Let a teacher configure and refine one source-grounded lesson through natural-language multi-turn conversation or structured controls, confirm goals, generate a complete BOPPPS text plan through durable jobs, optionally request advisory AI review, and approve immutable sequential plan revisions.

## Scope

- Single-lesson setup through structured controls or the existing Konling `prep-coauthor` session, including ambiguity clarification, confirmed multi-turn changes, knowledge points, goals, optional aggregate class context, and source versions.
- Provider Registry routing, staged durable generation, failure recovery, and optional outline pause.
- Editable text-plan draft, deterministic checks, advisory AI review, approval, and `教案第N版` revisions.

## Out of Scope

- Course-basis ingestion, interactive courseware, publication, classroom binding, and export.
- Raw learner traces in prompts, LLM approval gates, automatic plan approval, or multi-lesson batch generation.

## Acceptance Checklist

- [ ] AC-1: A teacher creates and refines a valid lesson task through natural-language multi-turn conversation or structured controls, resolves ambiguity explicitly, confirms scope, sources, knowledge points, goals, duration, and optional aggregate-only class context, preserves the shared verified and two pending source lineages with stable goal-gap identities, and exposes no private learner traces. Owner: independent reviewer.
  Evidence: Konling session/mode tests, ambiguity and multi-turn fixtures, mixed form/chat concurrency tests, setup APIs, prompt-projection fixtures, source-version and canonical-state checks, both-pending-lineage fixtures, goal-gap creation, and browser evidence.
- [ ] AC-2: Provider-routed generation progresses durably by stage and remains idempotent across cancellation, retry, failure resume, and worker redelivery. Owner: independent reviewer.
  Evidence: deterministic-provider, BullMQ, job-state, audit, production-provider, and redelivery tests.
- [ ] AC-3: The complete BOPPPS text plan is editable, deterministically checked, optionally AI-reviewed only as advice, and approved as immutable sequential versions that preserve unchanged goal-gap identities without implicitly creating source-gap acknowledgements. Owner: independent reviewer.
  Evidence: schema/timing tests, browser generation/edit/review evidence, goal-gap stability/change/delete-recreate and no-implicit-acknowledgement contracts, approval transaction, and revision snapshots.

## Tasks

- [ ] Task 1: Implement structured and Konling multi-turn lesson-task setup, ambiguity confirmation, knowledge points, confirmed goals, source selection, and class-context privacy.
  Covers: AC-1
  Acceptance: Invalid or ambiguous scope cannot generate, accepted conversation turns update the same structured task, teachers retain control of points/goals, all three canonical goal-source states and stable pending-gap identities persist, and only governed aggregates reach prompts.
  Evidence: Session/mode, route, authorization, optimistic-concurrency, clarification, projection, both-pending-lineage, goal-gap creation, and browser tests.
  Reviewer Check: Confirm goal and ambiguity confirmation are hard preconditions, display labels are not machine states, stale chat cannot overwrite form edits, and raw learner data is absent.
- [ ] Task 2: Implement Provider Registry selection and durable structured job execution.
  Covers: AC-2
  Acceptance: One active job per draft persists auditable attempts and safely starts, resumes, retries, cancels, and survives redelivery.
  Evidence: Provider fixtures, worker state-machine tests, audit records, and production rejection tests.
  Reviewer Check: Confirm completed stages and charges are not duplicated.
- [ ] Task 3: Implement staged text-plan generation, editing, checks, AI review, approval, and versions.
  Covers: AC-3
  Acceptance: Full BOPPPS output with exact timing and sources is recoverable; unrelated plan revisions preserve an unchanged goal gap; content/source-set/state/delete-recreate changes produce a new identity; and teacher approval freezes `教案第N版` without creating a source-gap acknowledgement.
  Evidence: Schema, timing, source, goal-gap stability/change/delete-recreate, no-implicit-acknowledgement, review, transaction, revision, and browser evidence.
  Reviewer Check: Confirm AI review cannot block, approve, or silently rewrite; approval transfers only pending state and gap identity; and drafts cannot seed courseware.
- [ ] Task 4: Complete integration and regression gates.
  Covers: AC-1, AC-2, AC-3
  Acceptance: Public setup/job/approval seams pass authorization, failure, privacy, version, type, and strict change validation.
  Evidence: Focused API/worker/Playwright suites, typecheck, and strict OpenSpec output.
  Reviewer Check: Confirm final evidence was produced on the reviewed diff after the course-basis dependency was archived.

## Agent Guardrails

- Only execute this issue's change.
- Implementation agents may propose satisfied AC ids with evidence, but must not check Acceptance Checklist items themselves.
- Check AC items only after an independent reviewer confirms the linked task evidence.
- Use the claim branch named in front matter.
- Do not execute other planned OpenSpec changes.
- Stop if dependency, coupling group, or branch constraints fail.
- Stop if GitHub blockedBy relationships still contain open blockers.
