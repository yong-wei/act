## ADDED Requirements

### Requirement: Runtime lesson and media resources have complete reviewed dispositions
Runtime lesson steps, modules, media, slides, audio/video, PDFs, and handouts SHALL have reviewed dispositions before they affect path planning or governed citations.

#### Scenario: Runtime PlanningUnit is path-plannable
- **WHEN** a runtime lesson step, handout, or media-backed resource is promoted to path-plannable
- **THEN** it SHALL have a verified launch target, parent lesson ref, graph binding, LearningGoal fit, K/A/Q mapping where applicable, path stage, time cost, evidence contract, privacy policy, readiness metadata, citation/source refs, and review metadata
- **AND** the ResourceNode audit SHALL block promotion if any required field is missing or provisional.

#### Scenario: Runtime fragment is supporting material
- **WHEN** a lesson module, slide fragment, media asset, transcript segment, or embedded PDF section lacks independent launch and evidence contracts
- **THEN** it SHALL be linked to a reviewed parent PlanningUnit or classified as supporting-citation, embedded-asset, evidence-producing, or excluded-with-rationale
- **AND** it SHALL NOT become an independent PathNode.

#### Scenario: Runtime family batch is complete
- **WHEN** scoped runtime workqueues are rerun
- **THEN** unreviewed runtime lesson and media disposition blockers SHALL be zero
- **AND** residual blockers SHALL identify concrete missing runtime artifacts, route gaps, or schema conflicts.
