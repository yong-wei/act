## ADDED Requirements

### Requirement: Resource field completion audit protects path quality
The system SHALL audit path-eligible resources.

#### Scenario: Resource field completion is audited
- **WHEN** a resource candidate is inventoried for future path planning
- **THEN** the audit SHALL record missing identity, source, graph binding, path profile, evidence, readiness, grounding, version, and review-state fields
- **AND** it SHALL classify each missing field by completion method: manual, local-model-assisted, external-tool-assisted, generated-provisional, already-governed, or blocked.
- **AND** it SHALL record evidence-contract completeness, including event source, event type, client event id policy, attempt key, source log id, dedupe key, timestamps, LearningFact materialization policy, confidence policy, and privacy scope.

#### Scenario: Generated metadata is provisional
- **WHEN** local model, vision model, transcript tooling, OCR, prompt extraction, or another automated process supplies resource semantics
- **THEN** the resulting fields SHALL remain provisional until a human-confirmed review state is recorded
- **AND** provisional fields SHALL NOT make a ResourceNode path-eligible, mastery-affecting, or terminal-validation-capable.

#### Scenario: Human confirmation is audited
- **WHEN** a provisional or manually completed field set is promoted to human-confirmed
- **THEN** the audit SHALL record reviewer id, reviewer role, reviewed time, review batch id, reviewed source hash, reviewed version ref, generation tool or model where applicable, prompt or manifest hash where applicable, confidence, and stale invalidation rules
- **AND** a source hash, version, prompt hash, or generation-tool version change SHALL make the confirmed field set stale until it is reviewed again.

#### Scenario: Evidence contract is incomplete
- **WHEN** a ResourceNode lacks event attribution, dedupe, attempt, timestamp, LearningFact policy, confidence, or privacy fields required by its evidence behavior
- **THEN** the ResourceNode SHALL be blocked from path eligibility or mastery effect according to policy
- **AND** diagnostics SHALL identify the missing evidence-contract field.

#### Scenario: Completion audit feeds diagnostics
- **WHEN** a ResourceNode or resource segment is blocked from PlanningUnit creation
- **THEN** diagnostics SHALL expose the exact missing field codes and review state
- **AND** it SHALL distinguish path eligibility from retrieval, citation, and authoring-triage readiness.
