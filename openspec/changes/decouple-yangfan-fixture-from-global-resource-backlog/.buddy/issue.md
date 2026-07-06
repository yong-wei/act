---
change_id: decouple-yangfan-fixture-from-global-resource-backlog
claim_branch: decouple-yangfan-fixture-from-global-resource-backlog
series: resource-path-readiness
coupling_group: resource-path-readiness-2026-07
execution_mode: isolated
base_branch: integration
required_branch:
depends_on: []
parent_issue: 786
blocked_by: []
blocking: []
openspec_path: openspec/changes/decouple-yangfan-fixture-from-global-resource-backlog
risk: high
area: data-governance
---

## Goal

Allow Yang Fan fixture readiness to be evaluated from a scoped, reviewed resource subset so test-account data completion can proceed without waiting for the entire global resource backlog.

## Execution Clarification

- This change does not weaken resource governance. It only narrows fixture preconditions to the resources actually used by fixture tests.
- This issue must not block `seed-yangfan-diagnostic-learning-state`; it should make that fixture issue easier to execute once claimed.
- Unrelated global resource blockers must remain visible as platform limitations.

## Scope

- Define fixture-owned resource subset readiness.
- Update helper diagnostics so fixture blockers are scoped.
- Add tests or helper checks proving unreviewed resources cannot be cited or materialized by the fixture.
- Preserve limited-coverage diagnostics while global completeness remains incomplete.

## Out of Scope

- Do not create Yang Fan fixture data.
- Do not delete duplicate accounts.
- Do not mark global resource backlog rows complete.
- Do not bypass evidence lineage for resources used by the fixture.

## Acceptance Checklist

- [ ] AC-1: Helper output distinguishes fixture-owned blockers from unrelated global resource backlog rows. Owner: independent reviewer.
  Evidence: before/after data-completeness helper output.
- [ ] AC-2: Fixture readiness can pass in limited mode when all fixture-owned resources are governed and only unrelated global backlog remains. Owner: independent reviewer.
  Evidence: fixture precondition test or dry-run report.
- [ ] AC-3: Fixture generation remains blocked when a fixture-owned citation, path node, assessment item, or evidence event lacks governance. Owner: independent reviewer.
  Evidence: negative fixture precondition test.

## Tasks

- [ ] Task 1: Define fixture-owned resource subset.
  Covers: AC-1
  Acceptance: Fixture-owned resources, graph nodes, path nodes, assessment items, citations, and evidence events are enumerated with stable ids.
  Evidence: helper output or fixture readiness report.
  Reviewer Check: Confirm unrelated textbook/search-document backlog rows are not included as fixture blockers.
- [ ] Task 2: Update helper fixture diagnostics.
  Covers: AC-1, AC-2
  Acceptance: Helper separates scoped fixture blockers from global limitations and emits limited-coverage diagnostics.
  Evidence: before/after helper output.
  Reviewer Check: Confirm global backlog remains visible.
- [ ] Task 3: Enforce fixture-owned governance.
  Covers: AC-2, AC-3
  Acceptance: Fixture dry-run/apply refuses ungoverned fixture-owned resources and never uses unreviewed resources as verified evidence.
  Evidence: targeted tests or dry-run reports.
  Reviewer Check: Confirm no unreviewed citation or learner evidence is fabricated.
- [ ] Task 4: Validate the change.
  Covers: AC-1, AC-2, AC-3
  Acceptance: OpenSpec validation and targeted helper/fixture tests pass.
  Evidence: `rtk openspec validate decouple-yangfan-fixture-from-global-resource-backlog --strict`.
  Reviewer Check: Confirm the issue has no blockedBy edge to the Yang Fan fixture issue.

## Agent Guardrails

- Only execute this issue's change.
- Implementation agents may propose satisfied AC ids with evidence, but must not check Acceptance Checklist items themselves.
- Check AC items only after an independent reviewer confirms the linked task evidence.
- Use the claim branch named in front matter.
- Preserve before/after helper evidence for this batch.
- Do not create or mutate fixture learner data in this issue.
- Do not mark global resource backlog rows complete unless they are directly in the scoped fixture subset and reviewed under this issue.
- Do not add blockedBy or dependency edges from this issue to `seed-yangfan-diagnostic-learning-state`.
- Do not execute other planned OpenSpec changes.
- Stop if dependency, coupling group, or branch constraints fail.
