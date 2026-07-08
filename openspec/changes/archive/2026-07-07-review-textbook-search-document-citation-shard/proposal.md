## Why

Textbook search-document rows are the largest current completeness deficit. Most of them should not become path nodes, but they still need reviewed citation/support classification so RAG, Konling, and path rationale can cite them without treating raw retrieval chunks as planning resources.

The backlog is too large for one implementation issue, so this change starts a deterministic shard that classifies search-document rows as supporting citation, embedded asset, parent-section evidence, or excluded-with-rationale.

## What Changes

- Select a bounded textbook search-document shard from helper output, prioritizing rows attached to active LearningGoals and already-reviewed or high-priority textbook sections.
- Review selected rows against parent section, citation anchor, figure/table/equation/page refs, graph nodes, authority, privacy, source hash, and limitation state.
- Keep raw search-document rows out of path planning unless their parent section is separately reviewed as a PlanningUnit.
- Preserve before/after helper evidence and residual unselected counts.

## Impact

- Reduces the largest resource-completeness shortfall while preserving section/chunk boundaries.
- Improves citation and RAG readiness without inflating path-plannable resource counts.
- Does not block fixture data completion.
