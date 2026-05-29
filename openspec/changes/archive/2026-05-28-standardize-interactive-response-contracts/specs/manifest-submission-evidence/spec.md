## ADDED Requirements

### Requirement: Evidence uses canonical response metadata
The manifest submission evidence envelope SHALL include canonical response metadata for activity-card answers.

#### Scenario: Submitted answer carries response kind
- **WHEN** a student submits a manifest activity card
- **THEN** the evidence envelope SHALL preserve the card id, submitted answer, canonical response kind, and legacy response alias when applicable
- **AND** governance consumers SHALL classify evidence from the canonical response kind rather than course-private page names.

#### Scenario: Unsupported scoring remains explicit
- **WHEN** a canonical response kind is subjective or lacks enough reference metadata for objective scoring
- **THEN** the evidence envelope SHALL mark scoring as unsupported or subjective
- **AND** it SHALL NOT present the answer as a failed objective response.
