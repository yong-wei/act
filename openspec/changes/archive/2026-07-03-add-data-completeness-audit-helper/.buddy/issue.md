---
change_id: add-data-completeness-audit-helper
claim_branch: add-data-completeness-audit-helper
series: data-completeness-grounding
coupling_group: data-completeness-grounding
execution_mode: isolated
base_branch: integration
required_branch:
depends_on: []
parent_issue:
blocked_by: []
blocking: []
openspec_path: openspec/changes/add-data-completeness-audit-helper
risk: medium
area: data-governance
---

## Goal

Add a read-only helper that reports graph, resource, citation, path-planning, and learner fixture data completeness so agents can complete missing data in a staged and verifiable way.

## Scope

- Implement a read-only data completeness helper.
- Report layered readiness for graph, resources, citation/RAG, path planning, and learner fixtures.
- Include canonical Yang Fan account diagnostics without mutating account or evidence data.
- Add deterministic tests or fixtures for the helper output.

## Out of Scope

- Do not complete resource semantic fields in this change.
- Do not create Yang Fan mock data in this change.
- Do not delete duplicate accounts in this change.
- Do not change Konling UI or citation rendering behavior.

## Acceptance Checklist

- [ ] AC-1: The helper reports graph, resource, citation, path-planning, and learner fixture readiness separately. Owner: independent reviewer.
  Evidence: helper JSON output and targeted tests.
- [ ] AC-2: The helper audits source-event lineage from raw events/batches to LearningFacts, snapshots, and feature caches. Owner: independent reviewer.
  Evidence: helper JSON output and lineage-focused tests.
- [ ] AC-3: The helper is read-only and does not mutate database or runtime artifacts. Owner: independent reviewer.
  Evidence: implementation review and tests covering dry/read-only behavior.
- [ ] AC-4: The helper reports canonical Yang Fan readiness and duplicate-account candidates without changing accounts. Owner: independent reviewer.
  Evidence: helper output fixture or local diagnostic output.
- [ ] AC-5: Helper output is privacy-minimized and does not expose raw answers, raw events, raw resources, or direct PII by default. Owner: independent reviewer.
  Evidence: privacy-focused tests and output review.
- [ ] AC-6: OpenSpec and helper tests pass. Owner: independent reviewer.
  Evidence: `rtk openspec validate add-data-completeness-audit-helper --strict` and targeted helper test command.

## Tasks

- [ ] Task 1: Define the completeness audit contract.
  Covers: AC-1
  Acceptance: Layer names, severities, stable ids, thresholds, privacy rules, and output shapes are documented in code or tests.
  Evidence: contract types or schemas and test fixtures.
  Reviewer Check: Confirm readiness dimensions are not collapsed into a single score.
- [ ] Task 2: Implement the read-only helper.
  Covers: AC-1, AC-2, AC-3
  Acceptance: The helper reads Prisma, runtime governance artifacts, ResourceNode registry, graph-center coverage sources, source-event lineage, and learner readiness without mutating records.
  Evidence: helper implementation and tests.
  Reviewer Check: Confirm there are no write operations or destructive commands.
- [ ] Task 3: Add Yang Fan canonical-account diagnostics.
  Covers: AC-4
  Acceptance: The helper reports canonical account identity, duplicate candidates, and missing learner-state evidence sources.
  Evidence: fixture output or local diagnostic output.
  Reviewer Check: Confirm duplicate accounts are only reported, not deleted or merged.
- [ ] Task 4: Add privacy-minimized output behavior.
  Covers: AC-5
  Acceptance: Output masks direct student identifiers by default and omits raw answer, event, resource, and private memory payloads.
  Evidence: privacy tests and sample output.
  Reviewer Check: Confirm diagnostic usefulness remains without leaking PII or raw content.
- [ ] Task 5: Validate the change.
  Covers: AC-6
  Acceptance: OpenSpec validation and targeted helper tests pass.
  Evidence: validation command output.
  Reviewer Check: Confirm the evidence is from the implementation branch.

## Agent Guardrails

- Only execute this issue's change.
- Implementation agents may propose satisfied AC ids with evidence, but must not check Acceptance Checklist items themselves.
- Check AC items only after an independent reviewer confirms the linked task evidence.
- Use the claim branch named in front matter.
- Do not execute other planned OpenSpec changes.
- Stop if dependency, coupling group, or branch constraints fail.
- Stop if GitHub blockedBy relationships still contain open blockers.
