## Context

The current `/assessment/adaptive-practice` flow treats `control-correction` as the only real goal. The planner can return fallback state and may clear usable path entries when evidence is low, producing student-visible failure language rather than a starter path. The Product Design handoff at `artifacts/product-design-audits/adaptive-learning-path-2026-06-14/design-handoff.md` sets a stricter product contract: every user can generate a path, cold start is a valid state, and internal reason codes remain outside the student UI.

## Goals / Non-Goals

**Goals:**

- Define registered learning goals and generic path generation inputs.
- Return at least two executable starter options for cold-start or low-evidence users.
- Persist generic path rounds and feedback independently from the control-correction slice.
- Preserve control-correction as one goal-specific strategy.

**Non-Goals:**

- No contextual bandit or reinforcement learning.
- No visual redesign in this change.
- No unaudited external resource ingestion; that is handled by the resource-node governance change.

## Decisions

- Use a goal registry rather than route-specific conditionals. This keeps `control-correction` as a registered strategy while allowing future goals to declare resource mix, checkpoint policy, and explanation templates.
- Treat fallback as a personalization quality state, not as a generation failure. Low evidence should reduce claim strength but still return starter paths.
- Persist path-round metadata with generic `goalId`, `plannerVersion`, path option, selection state, and evidence windows, so later execution and history views can resume without recomputing personalization.
- Keep student copy separate from diagnostic reason codes. Internal fields such as `missing-*`, `low-evidence`, and terminal validation readiness remain available for logs, admin, or teacher diagnostics only.

## Risks / Trade-offs

- Generic goals may expose weak path quality if resource coverage is poor. Mitigation: require starter-path templates and teacher/admin audit reasons while showing students limited but executable options.
- Existing control-correction tests may assume hard-coded goal behavior. Mitigation: migrate them to registered-goal fixtures and keep compatibility mappers during transition.
- Persistence changes may touch multiple tables or payload schemas. Mitigation: introduce versioned path-round payloads and migration tests before replacing legacy reads.
