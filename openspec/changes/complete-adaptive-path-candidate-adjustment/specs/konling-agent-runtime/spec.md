## ADDED Requirements

### Requirement: Konling adjustment returns a persisted derived candidate batch
Konling SHALL execute candidate adjustment against an authorized persisted source candidate and SHALL return the server-owned derived batch and candidate identities only after a materially changed batch is persisted.

#### Scenario: Adjustment succeeds materially
- **WHEN** Konling completes an authorized candidate adjustment with materially changed candidates
- **THEN** its structured result SHALL reference the persisted derived batch and candidate identities
- **AND** the adaptive learning center SHALL be able to read the same batch without regenerating candidates from assistant text.

#### Scenario: Adjustment has no material difference
- **WHEN** the governed adjustment result does not differ materially from the source candidate
- **THEN** Konling SHALL return `no_material_difference`
- **AND** it SHALL NOT claim that a new path was generated or selected.

### Requirement: Konling adjustment audit does not create path-choice evidence
Konling SHALL record candidate adjustment as its own governed tool run and outcome and SHALL NOT record a path selection, rejection, or switch unless the learner separately performs that explicit action.

#### Scenario: Adjustment tool completes
- **WHEN** a candidate adjustment tool succeeds, fails, becomes stale, or returns no material difference
- **THEN** its AgentToolRun SHALL preserve the adjustment request and redacted outcome according to the existing audit contract
- **AND** it SHALL NOT create `action: switch` or equivalent path-choice evidence.

#### Scenario: Learner later chooses an adjusted candidate
- **WHEN** the learner explicitly selects a candidate from the derived batch
- **THEN** the existing path-choice workflow MAY record selection or switch evidence independently from the adjustment tool run.
