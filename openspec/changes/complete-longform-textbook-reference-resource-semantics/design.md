## Semantic Review Protocol

The implementing agent must inspect section context, title hierarchy, source manifest, figure/caption descriptions, citation anchors, graph context, and LearningGoal fit. The agent performs semantic review directly; `needs-human-review` is not a stop condition.

Scripts may enumerate workqueues, expose parent links, and verify before/after counts. Scripts must not decide accepted graph refs, K/A/Q mapping, path roles, or exclusion rationale without agent review.

## Grain Rules

- `textbook_section` or `reference_section`: may become path-plannable after section-level review.
- search document, chunk, paragraph, figure, caption, image description, equation, table: supporting citation or embedded asset by default.
- A raw chunk may become path-plannable only if a separate reviewed PlanningUnit is created with launch target, evidence policy, path profile, and review metadata.

## Batch Boundary

In scope:

- all remaining textbook/reference long-form workqueue items
- section/chunk/figure/caption parent relations
- citation target and route metadata

Out of scope:

- runtime lesson media
- assessment item semantics
- external vector index implementation
