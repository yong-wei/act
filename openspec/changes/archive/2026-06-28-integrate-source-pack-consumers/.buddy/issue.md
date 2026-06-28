---
change_id: integrate-source-pack-consumers
claim_branch: integrate-source-pack-consumers
series: unified-source-pack-retrieval
coupling_group: unified-source-pack-retrieval
execution_mode: stacked
base_branch: integration
required_branch:
depends_on:
  - implement-profile-aware-hybrid-source-retrieval
parent_issue:
blocked_by: []
blocking: []
openspec_path: openspec/changes/integrate-source-pack-consumers
risk: high
area: ai
---

## Goal

Connect Source Pack retrieval to lesson/homework authoring, Konling cited answers, and adaptive path-planning evidence so the platform uses one governed retrieval mechanism.

## Scope

- Add lesson/homework authoring workflow guidance or commands for source-pack generation from large resources.
- Integrate `konling-answer` Source Packs into query-aware content citations and citation verification.
- Integrate `path-planning` Source Packs as resource evidence while preserving ResourceNode/PlanningUnit path eligibility.
- Add consumer-level regression tests for citations, filtering, limitations, and no path promotion.

## Out of Scope

- Full MCP wrapper for external agents.
- Production vector index operations.
- Replacing path planner candidate selection with Source Pack items.

## Acceptance Checklist

- [ ] AC-1: Lesson and homework workflows can generate compact Source Packs for large textbooks/references with reviewable audit output. Owner: independent reviewer.
  Evidence: documented command/example plus smoke test or fixture output.
- [ ] AC-2: Konling answers use query-aware Source Pack citations and still cite teaching content when learner personalization evidence is missing. Owner: independent reviewer.
  Evidence: Konling runtime tests covering graph/context query, verified citations, and missing learner-state limitation.
- [ ] AC-3: Path planning consumes Source Packs as explanatory evidence without promoting citation-only material into path nodes. Owner: independent reviewer.
  Evidence: path-planning tests proving ResourceNode/PlanningUnit eligibility remains the path-node gate.

## Tasks

- [ ] Task 1: Wire authoring workflow source-pack usage.
  Covers: AC-1
  Acceptance: lesson/homework workflows document or expose commands that produce compact Markdown plus JSON/audit outputs.
  Evidence: command fixture, smoke test, or docs test.
  Reviewer Check: confirm workflows do not require loading whole textbooks or references into model context.
- [ ] Task 2: Integrate Source Packs into Konling content citations.
  Covers: AC-2
  Acceptance: Konling uses `konling-answer` packs for query-aware citations and handles missing learner evidence as a personalization limitation.
  Evidence: Konling runtime tests with verified citations and missing learner-state context.
  Reviewer Check: confirm teaching-content citation retrieval is not blocked by absent learner personalization data.
- [ ] Task 3: Integrate Source Packs into path planning evidence.
  Covers: AC-3
  Acceptance: planner can consume Source Pack evidence while path nodes still require audited ResourceNode/PlanningUnit eligibility.
  Evidence: path-planning evidence tests and no-promotion regression tests.
  Reviewer Check: confirm citation-only Source Pack items never become PathNodes.

## Agent Guardrails

- Only execute this issue's change.
- Implementation agents may propose satisfied AC ids with evidence, but must not check Acceptance Checklist items themselves.
- Check AC items only after an independent reviewer confirms the linked task evidence.
- Use the claim branch named in front matter.
- Do not execute other planned OpenSpec changes.
- Stop if dependency, coupling group, or branch constraints fail.
- Stop if GitHub blockedBy relationships still contain open blockers.
