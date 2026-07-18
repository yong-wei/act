## Why

The platform needs a final closure point after the resource-family batches. Earlier changes add helpers and gates, and the new batches complete specific resource families, but someone must verify the whole system: every discovered resource has a reviewed disposition, all path-ready LearningGoals can generate meaningful paths from governed resources, and Konling/path citations resolve through reviewed metadata.

This change is the integration gate for declaring current project resources semantically complete.

## What Changes

- Run full-resource readiness helper, ResourceNode audit, LearningGoal stage coverage matrix, all-goal path diagnostics, and resource-metadata citation addressability checks after the family batches land.
- Require all 5291 current discovered resources, plus any new additions since baseline, to be accounted for as path-plannable, supporting-citation, embedded-asset, evidence-producing, or excluded-with-rationale.
- Require no unexplained unreviewed semantic fields, invalid path promotions, missing parent PlanningUnit links, or missing exclusion rationale.
- Tighten the new-resource gate into an all-resource gate once the closure passes.

## Impact

- Depends on planner alignment, K/A/Q boundary enforcement, new-resource gate, and all resource-family semantic completion batches.
- May only make small repair edits for residual uncovered records; large newly discovered resource families should create a follow-up blocker rather than being silently ignored.
- Provides the acceptance evidence for claiming resource labeling is complete.
- Does not replace the separate Konling answer-citation relevance change; it verifies that reviewed resource metadata and path-explanation citations are addressable.
