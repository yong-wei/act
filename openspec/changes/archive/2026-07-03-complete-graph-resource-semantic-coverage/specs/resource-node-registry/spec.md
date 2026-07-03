## MODIFIED Requirements

### Requirement: Resource field completion audit protects path quality
The system SHALL audit path-eligible resources and expose a worklist suitable for staged human completion of existing project resources.

#### Scenario: Resource field completion is audited
- **WHEN** a resource candidate is inventoried for future path planning
- **THEN** the audit SHALL record missing identity, source, graph binding, path profile, evidence, readiness, grounding, version, and review-state fields
- **AND** it SHALL classify each missing field by completion method: manual, local-model-assisted, external-tool-assisted, generated-provisional, already-governed, or blocked.
- **AND** it SHALL record evidence-contract completeness, including event source, event type, client event id policy, attempt key, source log id, dedupe key, timestamps, LearningFact materialization policy, confidence policy, and privacy scope.
- **AND** it SHALL preserve stable candidate ids that can be used by the data completeness helper and subsequent human review batches.

#### Scenario: Human confirmation is audited
- **WHEN** a provisional or manually completed field set is promoted to human-confirmed
- **THEN** the audit SHALL record reviewer id, reviewer role, reviewed time, review batch id, reviewed source hash, reviewed version ref, generation tool or model where applicable, prompt or manifest hash where applicable, confidence, and stale invalidation rules
- **AND** a source hash, version, prompt hash, or generation-tool version change SHALL make the confirmed field set stale until it is reviewed again.
- **AND** only human-confirmed semantic fields MAY make a ResourceNode path-eligible, mastery-affecting, or terminal-validation-capable.

### Requirement: Runtime ResourceNode projections preserve source-of-record ownership
The system SHALL keep planning metadata, semantic resource mappings, and projection status separate from records that own renderable content and teacher-editable resource metadata.

#### Scenario: Runtime step becomes a PlanningUnit
- **WHEN** a runtime lesson step is projected as a path resource
- **THEN** it SHALL have a verified route target, LearningGoal or graph bindings, knowledge coverage, ability impact, evidence instrumentation, evidence contract, estimated time, privacy, teacher policy, and human-confirmed review state
- **AND** verified route targets SHALL match an actual interactive course App Router base, student session, or teacher session page pattern
- **AND** missing or provisional fields SHALL prevent PlanningUnit creation.
- **AND** runtime projection blockers SHALL also make the base ResourceNode eligibility path-ineligible.
- **AND** long-form sections, transcript chunks, figures, and other citation-only records SHALL NOT become PlanningUnits unless they are separately reviewed with path profile and evidence policy.

#### Scenario: Arena resource preserves official scoring boundary
- **WHEN** an Arena resource is mapped as path-plannable or evidence-producing context
- **THEN** ResourceNode and LearningFact metadata MAY represent auxiliary learning evidence, preview behavior, preparation progress, or terminal validation context
- **AND** official Arena score, validity, ranking, leaderboard position, and official submission result semantics SHALL remain sourced only from `ArenaSubmission` and governed official Arena evaluation records.
