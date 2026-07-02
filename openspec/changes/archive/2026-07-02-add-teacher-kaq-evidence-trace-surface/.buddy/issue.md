---
change_id: add-teacher-kaq-evidence-trace-surface
claim_branch: add-teacher-kaq-evidence-trace-surface
series: structured-associative-retrieval
coupling_group: structured-associative-retrieval
execution_mode: isolated
base_branch: integration
required_branch:
depends_on:
  - persist-sar-retrieval-index-and-query-traces
parent_issue:
blocked_by: []
blocking: []
openspec_path: openspec/changes/add-teacher-kaq-evidence-trace-surface
risk: high
area: teacher
---

## Goal

Implement the teacher-facing K/A/Q evidence trace surface described by the SAG/SAR proposal, backed by privacy-safe SAR associated evidence.

## Scope

- Add `/teacher/classes/[classId]/kaq-evidence-trace` or an equivalent canonical teacher route.
- Show selected K/A/Q node context, SAR trace summary, safe evidence, resource gaps, candidate resources, limitations, and return links.
- Enforce teacher class authorization, student scope, and SAR privacy redaction.

## Out of Scope

- Administrator SAR diagnostics.
- Student evidence timeline redesign.
- Teacher intervention execution or remedial path writeback already covered by active audit remediation.
- Suggested binding approval workflow.

## Acceptance Checklist

- [ ] AC-1: Authorized teachers can inspect K/A/Q node evidence traces for their classes. Owner: independent reviewer.
  Evidence: route/API/UI test for an authorized class.
- [ ] AC-2: The trace shows SAR associated evidence, resource gaps, candidate resources, limitations, and useful return links. Owner: independent reviewer.
  Evidence: UI/DOM or payload test for selected graph node trace content.
- [ ] AC-3: Unauthorized, cross-class, audit-only, raw learner, hidden Arena, and private memory evidence is rejected or redacted. Owner: independent reviewer.
  Evidence: authorization and forbidden-string tests.
- [ ] AC-4: OpenSpec and targeted tests pass. Owner: independent reviewer.
  Evidence: `rtk openspec validate add-teacher-kaq-evidence-trace-surface --strict` and targeted test output.

## Tasks

- [ ] Task 1: Define teacher K/A/Q evidence trace payload and route contract.
  Covers: AC-1, AC-2
  Acceptance: Contract covers class, graph node, optional student, associated evidence, resource gaps, candidates, limitations, and return links.
  Evidence: Contract diff and route/payload tests.
  Reviewer Check: Confirm it is not a duplicate of existing student evidence pages.
- [ ] Task 2: Implement route, authorization, data adapter, and UI.
  Covers: AC-1, AC-2
  Acceptance: Authorized teacher can inspect the trace from a class context and see actionable evidence.
  Evidence: UI/DOM or browser evidence plus tests.
  Reviewer Check: Confirm the teacher workflow is useful without exposing administrator-only diagnostics.
- [ ] Task 3: Add privacy and authorization tests.
  Covers: AC-3
  Acceptance: Cross-class, audit-only, raw learner, hidden Arena, and private memory data is omitted or redacted.
  Evidence: Authorization and forbidden-string tests.
  Reviewer Check: Confirm tests cover negative cases, not only the happy path.
- [ ] Task 4: Run validation and record evidence.
  Covers: AC-4
  Acceptance: OpenSpec strict validation and targeted tests pass.
  Evidence: Validation command output and test output.
  Reviewer Check: Confirm failures are fixed or explicitly unrelated.

## Agent Guardrails

- Only execute this issue's change.
- Implementation agents may propose satisfied AC ids with evidence, but must not check Acceptance Checklist items themselves.
- Check AC items only after an independent reviewer confirms the linked task evidence.
- Use the claim branch named in front matter.
- Do not execute other planned OpenSpec changes.
- Stop if dependency, coupling group, or branch constraints fail.
- Stop if GitHub blockedBy relationships still contain open blockers.
