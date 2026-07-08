## ADDED Requirements

### Requirement: Textbook and reference resources have reviewed long-form semantics
Textbook and reference resources SHALL be reviewed at section/supporting-resource grain before they affect path planning, RAG grounding, or citation presentation.

#### Scenario: Long-form section is path-plannable
- **WHEN** a textbook or reference section is promoted to path-plannable
- **THEN** it SHALL include source book/reference ref, section ref, citation target, graph binding, K/A/Q mapping where applicable, LearningGoal fit, prerequisite position, estimated time, path role, authority, privacy, source hash, and review metadata
- **AND** it SHALL be selectable by the planner only through the reviewed section PlanningUnit.

#### Scenario: Long-form child item is support only
- **WHEN** a search document, chunk, figure, caption, image description, equation, table, or citation target lacks an independent reviewed PlanningUnit
- **THEN** it SHALL be classified as supporting-citation, embedded-asset, parent-section evidence, or excluded-with-rationale
- **AND** it SHALL link to a reviewed parent section where available.

#### Scenario: Long-form batch is complete
- **WHEN** scoped long-form workqueues are rerun
- **THEN** unreviewed long-form disposition and citation-anchor blockers SHALL be zero
- **AND** residual blockers SHALL identify concrete missing source artifacts, anchor gaps, or schema conflicts.
