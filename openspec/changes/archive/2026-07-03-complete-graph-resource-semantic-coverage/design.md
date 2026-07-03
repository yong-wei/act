## Design

### Completion Order

Resource completion should use the helper from `add-data-completeness-audit-helper` as the authoritative worklist:

1. Complete citation identity and source hash fields.
2. Complete graph bindings and KAQ/LearningGoal coverage.
3. Complete path profile and route targets for resources intended to become PlanningUnits.
4. Complete evidence contracts and instrumentation.
5. Mark reviewed fields as human-confirmed only after semantic review.
6. Regenerate runtime governance artifacts and rerun the helper.

### Resource Classes

Do not promote every resource to path eligibility. Each candidate should be classified as:

- `citation-only`: textbook sections, reference entries, figure descriptions, transcript chunks, and supporting passages.
- `path-plannable`: lesson steps, selected textbook sections, knowledge cards, quizzes, simulations, checkpoints, and selected practice resources.
- `evidence-producing`: quizzes, adaptive assessment, simulation traces, Arena tasks, homework/checkpoints, and path completion records.

Arena official score, validity, ranking, and leaderboard semantics remain owned by `ArenaSubmission` and official Arena evaluation records. Resource completion may expose Arena resources as learning evidence or terminal validation context, but it must not fabricate, overwrite, or reinterpret official Arena scoring.

### Manual Review Boundary

Semantic fields such as knowledge coverage, ability impact, quality target, prerequisite position, LearningGoal fit, remediation role, and assessment use require human review. Automated extraction may propose values but must remain provisional until reviewed.

### Validation

Completion is acceptable only when:

- The helper shows reduced blockers for the targeted resource set.
- Graph Center coverage can explain linked/path/citation gaps by node.
- Path planner can select more than a single resource for relevant LearningGoals.
- Konling can retrieve and cite governed resources for selected graph nodes.
- Arena-related resources preserve the boundary between auxiliary learning evidence and official Arena submission results.
