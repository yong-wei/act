## Why

Textbooks and references now contribute a large governed RAG corpus, but long-form sections and chunks cannot simply become path nodes. The planner needs section-level planning units and citation-level support so these resources can effectively influence paths without overwhelming students with arbitrary chunks.

## What Changes

- Complete path-planning disposition and semantic metadata for textbook and reference resources.
- Promote reviewed section-level resources to PlanningUnits where they are suitable for learning paths.
- Keep fine-grained chunks, figures, transcripts, and descriptions as supporting citations or embedded assets unless separately reviewed.
- Use RAG and SAR to explore semantic relations, then manually review graph, LearningGoal, prerequisite, and citation fields.

## Impact

- Updates textbook/reference runtime projections, citation maps, ResourceNode sidecars, and governed RAG metadata.
- Depends on the resource disposition contract and core resource readiness conventions.
- Does not require every retrieval chunk to become a path node.
