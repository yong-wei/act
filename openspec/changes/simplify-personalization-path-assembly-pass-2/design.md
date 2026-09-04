## Context

The first pass established one Personalization owner and a broad characterization suite. The remaining problem is repeated work inside the canonical assembler, not a missing abstraction.

## Goals / Non-Goals

**Goals:**

- Reduce repeated normalization, filtering, repair, and explanation logic.
- Reduce the module's production code, guards, and internal state forms.
- Keep every existing path result and side effect stable.

**Non-Goals:**

- No new planner, strategy registry, public API, schema, or product behavior.
- No course-policy redesign or persistence migration.

## Decisions

1. Simplify one existing stage at a time: identity, candidate merge, eligibility, ranking, prerequisite repair, redaction, explanation, then persistence handoff.
2. Reuse named intermediate facts inside the current pipeline. Do not introduce a parallel pipeline or generic framework.
3. Delete a helper only when its callers and tests show that it is forwarding or duplicating equivalent logic.
4. Compare complete outputs, errors, ordering, explanations, and persistence effects before and after each step.

## Risks / Trade-offs

- **A shared condition may hide stage-specific behavior.** Keep separate branches when tests show different errors, ordering, or audit output.
- **Splitting the file may look like progress without reducing complexity.** Measure the whole path-planning production scope, not the main file alone.
