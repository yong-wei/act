---
change_id: govern-sar-suggested-bindings-workflow
claim_branch: govern-sar-suggested-bindings-workflow
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
openspec_path: openspec/changes/govern-sar-suggested-bindings-workflow
risk: high
area: data-governance
---

## Goal

Turn SAR resource gap suggestions into governed review objects while preserving the rule that SAR never automatically creates authoritative bindings.

## Scope

- Define SAR suggested binding lifecycle and audit payload.
- Add authorized accept, reject, defer, and invalidate actions.
- Let accepted candidates update ResourceNode or graph metadata only through existing governance validation.

## Out of Scope

- SAR persistence and refresh implementation.
- Teacher K/A/Q evidence trace page.
- Source Pack ranking or citation verification.
- Automatic graph mutation without review.

## Acceptance Checklist

- [ ] AC-1: SAR suggested bindings have review states and audit records. Owner: independent reviewer.
  Evidence: contract/schema/service tests.
- [ ] AC-2: Accept/reject/defer/invalidate actions are authorized and privacy-safe. Owner: independent reviewer.
  Evidence: action tests for allowed and denied reviewers plus forbidden-string scan.
- [ ] AC-3: Only accepted suggestions can update ResourceNode or graph metadata, and they still pass governance validation. Owner: independent reviewer.
  Evidence: accepted/rejected mutation tests.
- [ ] AC-4: OpenSpec and targeted tests pass. Owner: independent reviewer.
  Evidence: `rtk openspec validate govern-sar-suggested-bindings-workflow --strict` and targeted test output.

## Tasks

- [ ] Task 1: Define SAR suggested binding review contract.
  Covers: AC-1
  Acceptance: Review objects include candidate provenance, trace summary, missing coverage type, decision, reviewer, rationale, timestamp, and affected refs.
  Evidence: Contract diff and lifecycle tests.
  Reviewer Check: Confirm suggested candidates remain non-authoritative before approval.
- [ ] Task 2: Implement authorized review actions.
  Covers: AC-2
  Acceptance: Authorized reviewers can accept, reject, defer, or invalidate candidates; unauthorized users cannot inspect restricted evidence.
  Evidence: Action tests and forbidden-string scan.
  Reviewer Check: Confirm teacher-scoped evidence is not exposed outside scope.
- [ ] Task 3: Connect accepted candidates to ResourceNode governance.
  Covers: AC-3
  Acceptance: Accepted suggestions update metadata only through existing validation; rejected/deferred candidates do not mutate authoritative state.
  Evidence: Mutation and non-mutation tests.
  Reviewer Check: Confirm no automatic graph binding path bypasses review.
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
