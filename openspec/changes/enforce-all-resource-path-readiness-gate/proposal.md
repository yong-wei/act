## Why

After resource metadata is completed in batches, the platform needs a hard gate proving that all existing resources have an effective path-planning role and that every registered LearningGoal can generate paths from the governed resource pool. Otherwise future imports can silently recreate the same gap.

## What Changes

- Add a full-resource path readiness gate driven by the data-completeness helper.
- Require every discovered resource to have reviewed disposition and either a path-plannable role, a parent/supporting role, an evidence role, or exclusion rationale.
- Require path generation tests across all registered LearningGoals using the backend-configured goal list.
- Require generated paths to include governed resource diversity where resources exist, rather than returning a single resource or hard-coded goal-specific fallback.
- Require Konling/path rationale citations to resolve through governed citation metadata for selected and supporting resources.

## Impact

- Extends data-quality gates, ResourceNode governance, path planner tests, and RAG/citation tests.
- Depends on core, long-form, evidence-lineage, and assessment item catalog completion changes.
- Becomes the acceptance gate for declaring all existing resources path-ready.
