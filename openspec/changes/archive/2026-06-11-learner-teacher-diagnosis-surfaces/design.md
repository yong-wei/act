## Context

Existing UI already has learner data plane, profile, teacher report, teacher insights, and role navigation foundations. This change should not create a separate assistant portal. It should place diagnosis where users already expect to make decisions.

## Goals / Non-Goals

**Goals:**

- Present diagnosis snapshots in student and teacher role projections.
- Link every visible claim to evidence and confidence metadata.
- Provide action entry points to path selection, grading feedback, teacher intervention, and prep-pack generation.
- Preserve missing/low-confidence states as explicit UI states.

**Non-Goals:**

- Designing the final commercial UI shell.
- Implementing indicator calculations.
- Auto-generating teacher interventions without review.

## Decisions

### Decision 1: Student view emphasizes next action

Student pages should show dimension score, percentile, growth state, evidence, and suggested action. They should not expose raw class distribution or teacher-only diagnostics.

### Decision 2: Teacher view emphasizes clusters and interventions

Teacher class pages should prioritize weak-point clusters, affected population, denominator, confidence, evidence coverage, and prep-pack entry. Individual student drilldowns should show evidence and path deviation without exposing private Konling dialogue.

### Decision 3: Evidence drawer is shared but role-filtered

The same evidence drawer pattern can serve student and teacher surfaces, but payloads must be produced from role-specific diagnosis views and citation scope.

## Validation

- Component or route tests verify student, teacher-class, and teacher-student views render correct projections.
- Authorization tests prove cross-student and cross-class reads are denied.
- UI state tests cover missing, stale, low-confidence, and no-current-snapshot states.
- `rtk openspec validate learner-teacher-diagnosis-surfaces --strict` passes.
