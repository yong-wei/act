## Why

The platform has many registered and runtime-derived teaching resources, but current coverage remains incomplete for governed path planning and high-confidence Konling citation. Resource candidates can be citation-ready without being path-eligible; provisional metadata and missing evidence contracts still block PlanningUnit creation. The graph also lacks effective TeachingResource-to-KnowledgeNode bindings and complete KAQ/resource coverage.

This change makes the data completion work explicit and testable after the completeness helper exists.

## What Changes

- Complete graph-resource semantic bindings using the helper's blocker report.
- Fill missing knowledge, ability, quality, LearningGoal, citation, path profile, evidence contract, review state, source hash, route target, and readiness fields for existing project resources.
- Promote only human-reviewed resources into path-plannable status.
- Keep citation-only resources distinct from path-plannable resources.
- Regenerate and validate runtime governance artifacts after completion.

## Impact

- Updates resource governance data and runtime projection artifacts.
- May touch authoring/runtime metadata, ResourceNode sidecars, and registry/test fixtures.
- Does not create Yang Fan learner mock data until the resource and graph data are sufficiently complete.
