## MODIFIED Requirements

### Requirement: Diagnosis snapshots are reproducible
Control-correction diagnosis snapshots SHALL remain reproducible and SHALL expose report-ready observations for competition assistant workflows.

#### Scenario: Indicator snapshot is materialized
- **WHEN** an indicator is calculated for a student, class, or report scope
- **THEN** the snapshot SHALL store score, confidence, source coverage, evidence count, evidence window, materializer version, and limitations
- **AND** stale, preview-only, low-confidence, missing, or sparse sources SHALL lower confidence or mark the indicator unavailable instead of producing a precise high-confidence score.

#### Scenario: Report snapshot is materialized
- **WHEN** the system materializes a control-correction diagnosis report snapshot
- **THEN** the snapshot SHALL include score, confidence, time window, limitations, and source version metadata for each reported dimension
- **AND** each report-ready dimension SHALL include observation records or observation payload entries with indicator key, evidence references, source family, and calculation window
- **AND** missing or sparse evidence SHALL be represented as a limitation instead of a fabricated score.

### Requirement: Control-correction diagnosis uses governed indicators
The diagnosis profile SHALL use governed indicator definitions and consume governed evidence sources that are relevant to the competition assistant story.

#### Scenario: Indicator definition is registered
- **WHEN** a control-correction diagnosis indicator is added
- **THEN** it SHALL declare dimension id, indicator id, source families, query spec, normalization policy, confidence policy, privacy visibility, materializer version, and fallback behavior
- **AND** definitions missing query spec or evidence threshold metadata SHALL fail validation.

#### Scenario: Indicator evidence is gathered
- **WHEN** diagnosis evidence is gathered for the competition baseline class or learner
- **THEN** eligible sources SHALL include document rubric grading, adaptive-practice answers, simulation or Arena summaries, learning-path execution or deviation records, and approved learning facts when available
- **AND** every source SHALL be filtered by goal or scope so unrelated course activity cannot inflate control-correction diagnosis.
