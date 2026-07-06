## Tasks

- [ ] 1. Select the knowledge-card/infograph shard.
  - Use helper output to select a deterministic shard prioritized by active LearningGoals, graph nodes used in planner tests, and missing semantic review state.
  - Record selected ids and residual unselected counts.

- [ ] 2. Review selected resources item by item.
  - Inspect each selected card/infograph source and assign graph, LearningGoal, K/A/Q, path disposition, route/citation, authority, evidence, privacy, and rationale fields.
  - Keep ambiguous or display-only items as supporting, embedded, or excluded rather than path-plannable.

- [ ] 3. Validate citation and path boundaries.
  - Verify selected path-plannable items have route/citation/evidence metadata.
  - Verify supporting-only images or derived descriptions do not become independent PathNodes.

- [ ] 4. Validate shard completion.
  - Run `rtk openspec validate review-knowledge-card-infograph-semantic-shard --strict`.
  - Run the helper and targeted ResourceNode/RAG checks.
