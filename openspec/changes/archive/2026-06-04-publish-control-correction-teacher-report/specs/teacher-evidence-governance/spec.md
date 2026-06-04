## ADDED Requirements

### Requirement: Teacher reports expose control-correction path outcomes
Teacher-facing report APIs SHALL expose scoped control-correction path outcome metrics for authorized classes.

#### Scenario: Teacher opens the control-correction report
- **WHEN** an authorized teacher opens a class report for `goal=control-correction`
- **THEN** the response SHALL include path adoption, path completion, deviation, competency lift, simulation pass rate, Arena valid submission rate, Konling intervention acceptance, intervention-after-success, citation coverage, and resource contribution metrics
- **AND** each metric SHALL include denominator, included population, excluded population or reason, calculation window, confidence, and source coverage metadata.

#### Scenario: Teacher drills into a student
- **WHEN** an authorized teacher opens a student drilldown from the control-correction report
- **THEN** the response SHALL include scoped learner-state, path execution, terminal validation, intervention, and evidence summaries for that student
- **AND** it SHALL NOT expose raw answer bodies, raw private Konling memory, hidden Arena internals, or raw high-frequency traces by default.

#### Scenario: Teacher requests export
- **WHEN** an authorized teacher exports the control-correction report
- **THEN** the export SHALL include report metrics, chart-ready data, methodology notes, confidence markers, and redaction policy notes
- **AND** it SHALL preserve the same class-scope authorization as the report API.
