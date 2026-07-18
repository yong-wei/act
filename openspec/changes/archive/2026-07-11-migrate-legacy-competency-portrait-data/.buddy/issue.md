---
change_id: migrate-legacy-competency-portrait-data
claim_branch: migrate-legacy-competency-portrait-data
series: portrait-v2-primary-model
coupling_group: learner-portrait-v2
execution_mode: isolated
base_branch: integration
required_branch:
depends_on:
  - define-portrait-v2-primary-model
  - stabilize-portrait-incremental-updates
parent_issue:
blocked_by: []
blocking: []
openspec_path: openspec/changes/migrate-legacy-competency-portrait-data
risk: high
area: data-governance
---

## Goal

Migrate legacy six-dimensional learner portrait data and Yang Fan diagnostic fixture data into the primary seven-dimensional portrait v2 model with auditable lineage.

## Scope

- Add dry-run and apply migration support for legacy portrait rows.
- Preserve mapping confidence, limitations, and source lineage.
- Update Yang Fan fixture data so all seven portrait v2 dimensions survive worker recomputation.
- Extend the data completeness helper to report portrait migration state.

## Out of Scope

- Defining the primary portrait v2 contract.
- Implementing the incremental update engine.
- Adapting every frontend and Konling consumer.
- Manually altering production database rows outside the governed migration path.

## Acceptance Checklist

- [ ] AC-1: Migration dry-run reports eligible, migrated, skipped, conflicting, and unmigrated records with mapping limitations. Owner: independent reviewer.
  Evidence: migration dry-run tests.
- [ ] AC-2: Migration apply path is idempotent and preserves lineage. Owner: independent reviewer.
  Evidence: idempotency tests.
- [ ] AC-3: Yang Fan canonical fixture covers all seven portrait v2 dimensions and survives normal worker recomputation. Owner: independent reviewer.
  Evidence: fixture and worker recomputation tests.
- [ ] AC-4: Data completeness helper reports native, migrated, stale, unmigrated, and fixture-blocked portrait states. Owner: independent reviewer.
  Evidence: helper output tests.
- [ ] AC-5: OpenSpec and Buddy contracts remain valid. Owner: independent reviewer.
  Evidence: `rtk openspec validate migrate-legacy-competency-portrait-data --strict` and issue-body validation pass.

## Tasks

- [ ] Task 1: Add legacy-to-portrait-v2 migration dry-run.
  Covers: AC-1
  Acceptance: Dry-run reports record buckets and mapping limitations without writes.
  Evidence: Migration dry-run tests.
  Reviewer Check: Confirm privacy minimization and explicit mapping confidence.
- [ ] Task 2: Implement idempotent migration apply.
  Covers: AC-2
  Acceptance: Apply path writes portrait v2 records once and preserves lineage across repeated runs.
  Evidence: Idempotency tests.
  Reviewer Check: Confirm no blind overwrite or duplicate rows.
- [ ] Task 3: Update Yang Fan fixture evidence and seed path.
  Covers: AC-3
  Acceptance: Canonical Yang Fan account has all seven portrait v2 dimensions after worker recomputation.
  Evidence: Fixture and worker tests.
  Reviewer Check: Confirm duplicate accounts are handled only by canonical identifiers, not name-only matches.
- [ ] Task 4: Extend data completeness helper.
  Covers: AC-4
  Acceptance: Helper reports portrait migration readiness and fixture blockers.
  Evidence: Helper output tests.
  Reviewer Check: Confirm helper is read-only and privacy-minimized.
- [ ] Task 5: Run validation and prepare review evidence.
  Covers: AC-5
  Acceptance: OpenSpec validation, issue-body validation, and focused tests pass.
  Evidence: Command output in implementation summary.
  Reviewer Check: Confirm all AC ids have evidence and no AC is self-approved.

## Agent Guardrails

- Only execute this issue's change.
- Do not manually patch production data outside the governed migration path.
- Do not merge duplicate students by display name alone.
- Do not claim native portrait v2 evidence for compatibility-derived values.
- Implementation agents may propose satisfied AC ids with evidence, but must not check Acceptance Checklist items themselves.
- Check AC items only after an independent reviewer confirms the linked task evidence.
- Use the claim branch named in front matter.
- Do not execute other planned OpenSpec changes.
- Stop if dependency, coupling group, or branch constraints fail.
- Stop if GitHub blockedBy relationships still contain open blockers.
