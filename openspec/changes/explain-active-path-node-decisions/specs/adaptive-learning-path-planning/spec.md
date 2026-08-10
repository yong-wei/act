## ADDED Requirements

### Requirement: Adopted path nodes preserve their historical selection basis
The system SHALL persist a student-safe selection basis on each node when a candidate path is adopted, using only the persisted recommendation provenance for that candidate.

#### Scenario: Candidate path is adopted
- **WHEN** a student adopts a persisted candidate with recommendation provenance
- **THEN** each adopted plan node SHALL retain the candidate-level summary and the provenance entries whose affected node set contains that node
- **AND** the projection SHALL retain student-safe confidence and limitation text without internal reason codes, fingerprints, or raw evidence identifiers

#### Scenario: Candidate has no node-specific provenance entry
- **WHEN** an adopted candidate has recommendation provenance but no entry identifies a particular adopted node
- **THEN** that node SHALL retain the candidate-level selection summary and limitations
- **AND** the system SHALL NOT infer a node-specific historical reason from the student's current learner state

#### Scenario: Legacy active path has no historical selection projection
- **WHEN** an existing active path node predates node-level selection projection
- **THEN** the system SHALL preserve the missing historical state
- **AND** it SHALL NOT reconstruct the selection basis from current learner evidence

### Requirement: Historical node decisions survive execution state changes
The system SHALL preserve a node's selection basis and latest confirmed adjustment when refreshing readiness or execution status.

#### Scenario: Explained node completes or is skipped
- **WHEN** an explained activity-path node becomes completed or skipped
- **THEN** its persisted historical selection and latest adjustment fields SHALL remain unchanged and available for student review

#### Scenario: Node readiness changes
- **WHEN** prerequisite completion or evidence availability changes a node's governed readiness
- **THEN** the current readiness SHALL update independently of the node's historical selection and adjustment fields
