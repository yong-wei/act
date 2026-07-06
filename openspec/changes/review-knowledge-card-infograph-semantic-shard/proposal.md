## Why

Knowledge cards and infographs are central to graph-page Konling answers and early path-planning explanations, but helper output still shows these families as review-incomplete. They are smaller and more student-facing than the long-form textbook backlog, so they are the right next target for removing an obvious resource-completeness shortfall.

## What Changes

- Select a deterministic shard of knowledge-card and infograph resources from the current helper workqueue, prioritizing records linked to active LearningGoals and graph nodes used by path planning.
- Review each selected card or infograph against its source content, graph node, LearningGoal, K/A/Q objective, citation target, path disposition, evidence behavior, privacy scope, and source hash.
- Classify each selected item as path-plannable, supporting-citation, embedded-asset, evidence-producing, or excluded-with-rationale.
- Preserve before/after helper evidence and residual unselected counts.

## Impact

- Improves graph/Konling grounding and path-planning resource diversity for high-visibility knowledge resources.
- Does not process the full knowledge-card or infograph universe unless the selected shard equals the whole workqueue.
- Does not block fixture data completion.
