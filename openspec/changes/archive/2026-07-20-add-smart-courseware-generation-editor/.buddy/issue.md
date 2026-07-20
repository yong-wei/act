---
change_id: add-smart-courseware-generation-editor
claim_branch: add-smart-courseware-generation-editor
series: smart-lesson-preparation
coupling_group: smart-courseware-runtime
execution_mode: isolated
base_branch: integration
required_branch:
depends_on:
  - add-smart-lesson-plan-authoring
  - standardize-generated-courseware-slide-runtime
parent_issue:
blocked_by:
  - add-smart-lesson-plan-authoring
  - standardize-generated-courseware-slide-runtime
blocking:
  - publish-smart-courseware-to-classroom
openspec_path: openspec/changes/add-smart-courseware-generation-editor
risk: high
area: teacher-authoring
---

## Goal

Let a teacher generate plan-bound interactive courseware that renders immediately in the shared slide runtime, then inspect activities and evidence, edit registered modules, regenerate one selected module, and compare teacher and student previews.

## Scope

- Progressive courseware generation from an approved immutable plan through durable jobs.
- Executable required BOPPPS activities, verified citations or canonical source states with stable module-gap identities, AI provenance, and role separation; acknowledgement creation remains exclusively in publication.
- Teacher editing, selected-module regeneration, shared validation feedback, privacy, and teacher/student previews.

## Out of Scope

- Course-basis and plan authoring, slide-runtime schema implementation, publication, classroom binding, and PDF export.
- Arbitrary modules, multimodal generation, simulations, whole-step regeneration from a module action, or cross-teacher sharing.

## Acceptance Checklist

- [ ] AC-1: An approved plan revision generates six ordered BOPPPS stages and 6–24 directly renderable shared-runtime steps with exact timing and allowlisted modules. Owner: independent reviewer.
  Evidence: deterministic-provider, approved-baseline, job, manifest, timing, and shared-schema integration tests.
- [ ] AC-2: Required activities execute through canonical responses; citations use the shared canonical source-state values; pending modules retain stable content/source-bound gap identities without creating acknowledgements; provenance remains auditable; paired role previews hide all teacher-only content from students. Owner: independent reviewer.
  Evidence: response/submission, citation, both pending lineage states, gap-id stability and change/delete-recreate, no-implicit-acknowledgement, provenance, authorization, answer-leak, and paired browser tests.
- [ ] AC-3: Teachers can edit registered composition and accept selected-module-only regeneration while durable recovery, privacy, and production provider restrictions remain enforced. Owner: independent reviewer.
  Evidence: editor/API, scoped-diff, invalid-sibling mutation, failure/resume, owner-access, and production-provider tests.

## Tasks

- [ ] Task 1: Implement approved-plan-bound progressive courseware generation and durable jobs.
  Covers: AC-1, AC-3
  Acceptance: Generated drafts preserve baseline identity, conform to the shared runtime, recover at the first incomplete unit, and reject fixture providers in production.
  Evidence: Provider, job-state, baseline, schema, timing, idempotency, and recovery tests.
  Reviewer Check: Confirm generation cannot redesign confirmed goals or mutate completed units on resume.
- [ ] Task 2: Implement activities, citations/source gaps, provenance, and role-safe projections.
  Covers: AC-2
  Acceptance: Required stages contain executable activities, canonical source states and stable module-gap identities survive unchanged state, defining changes create new identities without acknowledgements, and every teacher-only answer, review point, citation audit, or provider detail is absent from student payloads.
  Evidence: Activity, submission, citation, cross-state gap identity, edit/regenerate/source/delete fixtures, no-implicit-acknowledgement, provenance, authorization, and answer-leak evidence.
  Reviewer Check: Confirm the editor owns only gap state/identity, defining changes cannot reuse old identities, and inspect serialized student data as well as visible browser output.
- [ ] Task 3: Implement the registered-layout editor and selected-module regeneration.
  Covers: AC-3
  Acceptance: Composition edits rerun shared validation and an accepted regeneration diff changes only the selected module.
  Evidence: Editor actions, content-hash, scoped context, diff, sibling-mutation, and stale-plan notice tests.
  Reviewer Check: Confirm layout/runtime rules are reused rather than duplicated and out-of-scope provider output is rejected atomically.
- [ ] Task 4: Complete public editor and role-preview gates.
  Covers: AC-1, AC-2, AC-3
  Acceptance: Focused generation, editor, role, privacy, type, and strict OpenSpec checks pass after both dependencies are archived.
  Evidence: API/unit/Playwright output, paired screenshots, typecheck, and strict change validation.
  Reviewer Check: Confirm the final diff contains no publication or PDF implementation.

## Agent Guardrails

- Only execute this issue's change.
- Implementation agents may propose satisfied AC ids with evidence, but must not check Acceptance Checklist items themselves.
- Check AC items only after an independent reviewer confirms the linked task evidence.
- Use the claim branch named in front matter.
- Do not execute other planned OpenSpec changes.
- Stop if dependency, coupling group, or branch constraints fail.
- Stop if GitHub blockedBy relationships still contain open blockers.
