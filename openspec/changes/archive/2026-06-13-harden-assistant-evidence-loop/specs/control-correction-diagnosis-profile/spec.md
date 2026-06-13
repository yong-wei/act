## MODIFIED Requirements

### Requirement: Diagnosis snapshots are reproducible
Control-correction diagnosis snapshots SHALL remain reproducible and SHALL expose report-ready observations for competition assistant workflows.

#### Scenario: Report snapshot is materialized
- **WHEN** the system materializes a control-correction diagnosis report snapshot
- **THEN** the snapshot SHALL include score, confidence, time window, limitations, and source version metadata for each reported dimension
- **AND** each report-ready dimension SHALL include observation records or observation payload entries with indicator key, evidence references, source family, and calculation window
- **AND** missing or sparse evidence SHALL be represented as a limitation instead of a fabricated score.

### Requirement: Control-correction diagnosis uses governed indicators
The diagnosis profile SHALL consume governed evidence sources that are relevant to the competition assistant story.

#### Scenario: Indicator evidence is gathered
- **WHEN** diagnosis evidence is gathered for the competition baseline class or learner
- **THEN** eligible sources SHALL include document rubric grading, adaptive-practice answers, simulation or Arena summaries, learning-path execution or deviation records, and approved learning facts when available
- **AND** every source SHALL be filtered by goal or scope so unrelated course activity cannot inflate control-correction diagnosis.
