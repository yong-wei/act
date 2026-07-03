## Why

The helper shows core resource readiness is blocked: registered teaching resources are missing knowledge mappings, registry references are inconsistent, and many ResourceNodes are unavailable, teacher-policy-blocked, provisional, or missing evidence/path metadata. These are the highest-priority resources because they are already surfaced by the platform and should form the stable backbone of generated learning paths.

## What Changes

- Complete path-planning metadata for all helper-discovered existing core teaching resources: registered TeachingResources, lesson runtime planning units, knowledge cards, infographs, simulations, control workbench entries, Arena preview/terminal-validation resources, quizzes, interactive lessons, and platform-managed exercises.
- Manually review semantic fields instead of filling them by script.
- Use helper findings, SAR candidates, and RAG evidence to identify correct graph and LearningGoal bindings.
- Resolve missing registry references, unregistered registry refs, missing knowledge mappings, missing route targets, teacher-policy blocks, and provisional review states for every in-scope core resource, or classify it with reviewed limitation/exclusion rationale.

## Impact

- Updates resource metadata, runtime projection sidecars, registry records, and governance artifacts for core resources.
- Depends on the resource disposition contract and the existing semantic coverage batch.
- Does not complete long-form textbook/reference section planning units.
