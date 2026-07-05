# graph-resource-coverage-overlay Specification

## Purpose
Define the read-only graph-center overlay that reports ResourceNode, runtime, RAG, and Arena coverage readiness for KAQ graph nodes without copying governed source content.
## Requirements
### Requirement: Graph nodes expose resource coverage status
The system SHALL provide read-only resource coverage overlays for graph nodes.

#### Scenario: Resource coverage is generated
- **WHEN** graph-center resource coverage mode is requested
- **THEN** each covered graph node SHALL expose linked resource count, path-eligible resource count, RAG-indexed resource count, citation-ready resource count, verified-citation resource count, assessment resource count, simulation resource count, Arena preview resource count, Arena official resource count, terminal-validation-capable resource count, coverage state, and missing coverage types.

### Requirement: Resource coverage preserves source ownership
The resource coverage overlay SHALL consume resource projections without copying raw content or bypassing ResourceNode governance.

#### Scenario: Coverage reads registered resources
- **WHEN** ResourceNode, textbook runtime, lesson runtime, or RAG projection data is used for coverage
- **THEN** the overlay SHALL retain only identity, mapping, count, status, and governance fields needed for coverage
- **AND** it SHALL not store raw markdown, chunk text, hidden Arena internals, raw submissions, or teacher-editable catalog payloads.

### Requirement: Coverage status distinguishes availability dimensions
The resource coverage overlay SHALL not conflate a linked resource with a path-eligible or citation-ready resource.

#### Scenario: Node has linked but not path-eligible resources
- **WHEN** a graph node has linked resources that are blocked, unavailable, or missing path audit requirements
- **THEN** the overlay SHALL show linked count separately from path-eligible count
- **AND** the coverage state SHALL expose the missing governance dimensions.

#### Scenario: Node has indexed but not citation-ready resources
- **WHEN** a graph node has RAG-indexed resources whose citation target, CitationAddress, authority, freshness, privacy visibility, or resolver validation is missing or rejected
- **THEN** the overlay SHALL show indexed count separately from citation-ready and verified-citation counts
- **AND** the node detail SHALL expose a limitation rather than presenting indexed resources as verified clickable citations.

#### Scenario: Arena resource is counted
- **WHEN** Arena resources contribute to graph coverage
- **THEN** preview, official, and terminal-validation-capable coverage SHALL be counted separately
- **AND** official validation coverage SHALL not be inferred unless governed official evaluation evidence is available through the Arena contract.

### Requirement: Field completion coverage exposes governance dimensions
The resource coverage overlay SHALL not conflate a linked resource with a path-eligible or citation-ready resource.

#### Scenario: Resource coverage includes field completion state
- **WHEN** graph resource coverage is generated
- **THEN** each graph node SHALL expose counts for complete, missing-field, provisional, review-confirmed, citation-ready, path-eligible, and blocked resources where available
- **AND** missing field dimensions SHALL be visible to teacher or administrator diagnostics without copying raw resource content.
- **AND** the coverage payload SHALL include denominator, source window, artifact version, sample limitations, and limitation reasons for each displayed coverage dimension.
- **AND** the coverage payload SHALL identify whether remaining blockers are citation-only, path-planning, evidence-contract, or semantic-review blockers.

### Requirement: LearningGoal baseline coverage is exposed by graph overlays
The system SHALL provide read-only resource coverage overlays for graph nodes.

#### Scenario: LearningGoal baseline coverage is generated
- **WHEN** resource coverage is generated for a path-ready LearningGoal
- **THEN** the overlay SHALL report coverage by K/A/Q objective and by baseline category: concept, diagnostic, practice, checkpoint, remediation, citation, and terminal validation where required
- **AND** it SHALL distinguish linked, review-confirmed, path-eligible, citation-ready, assessment-capable, and high-complexity locked resources.
- **AND** it SHALL expose the resource ids and blocker categories needed for staged implementing-agent completion without exposing raw content to unauthorized roles.

### Requirement: LearningGoal baseline coverage distinguishes availability dimensions
The resource coverage overlay SHALL not conflate a linked resource with a path-eligible or citation-ready resource.

#### Scenario: Resource has provisional field completion
- **WHEN** a resource is linked to a LearningGoal only through provisional or model-assisted metadata
- **THEN** the overlay SHALL count it separately from review-confirmed coverage
- **AND** it SHALL NOT count it as baseline path coverage.

### Requirement: Resource coverage overlay can display SAR candidate gaps
The graph resource coverage overlay SHALL display SAR-backed candidate resources as suggestions without treating them as covered resources.

#### Scenario: SAR suggests a resource for a coverage gap
- **WHEN** SAR finds a candidate resource or evidence item for a graph node with missing coverage
- **THEN** the overlay SHALL show the candidate separately from linked, path-eligible, citation-ready, and verified-citation counts
- **AND** it SHALL expose the trace or rationale for teacher/admin review.

### Requirement: Foundation graph resource bindings are completed in reviewed batches
The graph resource coverage workflow SHALL support bounded implementing-agent-reviewed batches for foundational control-system graph nodes.

#### Scenario: Foundation batch is reviewed
- **WHEN** feedback, closed-loop, transfer-function, and time-domain foundation nodes are reviewed
- **THEN** accepted resource refs SHALL record source resource id, coverage role, citation/path distinction, reviewer-visible rationale, and version or source hash where available
- **AND** nodes without suitable resources SHALL retain explicit gap states.

#### Scenario: Baseline coverage is recalculated
- **WHEN** a foundation graph binding batch is completed
- **THEN** LearningGoal baseline coverage SHALL distinguish linked, review-confirmed, path-eligible, citation-ready, and blocked resources for the affected goals.

### Requirement: Analysis and design graph resource bindings are completed in reviewed batches
The graph resource coverage workflow SHALL support bounded implementing-agent-reviewed batches for analysis and controller-design graph nodes.

#### Scenario: Analysis and design batch is reviewed
- **WHEN** stability, steady-state error, root-locus, frequency-response, margin, and correction-design nodes are reviewed
- **THEN** accepted resource refs SHALL declare coverage role, graph-node relation, LearningGoal fit, reviewer rationale, and version or source hash where available
- **AND** checkpoint, remediation, and terminal-validation candidates SHALL remain candidates until their own resource or assessment reviews approve them.

#### Scenario: Missing design coverage remains visible
- **WHEN** a target graph node lacks suitable resources after review
- **THEN** the coverage overlay SHALL expose a precise resource gap rather than counting provisional suggestions as coverage.

### Requirement: Simulation and transfer graph resource bindings preserve evidence authority
The graph resource coverage workflow SHALL review simulation-validation and ship-ocean transfer resources as high-complexity graph coverage.

#### Scenario: Simulation or transfer resource is bound
- **WHEN** a simulation, control workbench, Arena, reflection, or transfer-application resource is linked to a graph node
- **THEN** the binding SHALL declare whether the resource is concept support, practice, evidence-producing, preview validation, official validation, terminal validation, remediation, or excluded
- **AND** official Arena score, validity, ranking, and leaderboard authority SHALL remain sourced only from official Arena contracts.

#### Scenario: High-complexity coverage is incomplete
- **WHEN** readiness metadata, evidence authority, or route target is missing
- **THEN** the coverage overlay SHALL keep the resource blocked or locked rather than marking it path-eligible.

### Requirement: Residual graph resource coverage backlog is closed
The graph resource coverage workflow SHALL close residual graph nodes without resource refs after priority graph/resource batches complete.

#### Scenario: Residual graph-node workqueue is reviewed
- **WHEN** the helper emits remaining `graph-node-resource-missing` findings after foundation, analysis/design, simulation/transfer, runtime, media, long-form, and assessment batches
- **THEN** each finding SHALL be resolved by a reviewed resource ref or a reviewed limitation state
- **AND** the decision SHALL include graph node id, source family where applicable, coverage role, reviewer rationale, source/version evidence, and whether the result is citation support, path support, assessment support, remediation, terminal validation, or an explicit gap.

#### Scenario: Graph node remains without a suitable resource
- **WHEN** no existing resource should be linked to a graph node
- **THEN** the node SHALL carry an actionable reviewed limitation category
- **AND** downstream coverage overlays and final readiness gates SHALL not treat it as an unexplained missing resource ref.
