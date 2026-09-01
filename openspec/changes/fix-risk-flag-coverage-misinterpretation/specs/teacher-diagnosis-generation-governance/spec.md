# teacher-diagnosis-generation-governance Delta

## ADDED Requirements

### Requirement: Risk flags are projected as a sparse hit set

The provider-facing projection of governed risk flags SHALL present them as a sparse hit set: the aggregated projection SHALL carry explicit hit-semantics fields such as `flaggedStudentCount` (students with at least one current risk flag) and `diagnosedStudentCount` (total diagnosed students), and SHALL NOT reuse coverage vocabulary for risk-flag counts. The system prompt SHALL state in Simplified Chinese that risk flags are a sparse hit set whose count is the number of students currently hitting a risk, not the number of students covered by risk evidence, and SHALL forbid deriving a coverage ratio or "risk data covers only N students" limitation from the risk-flag record count. A deterministic post-generation validation SHALL reject output whose summary or limitations present the risk-flag hit count as evidence-coverage insufficiency, treating it as a retryable model-behavior defect under the existing attempt budget, and SHALL NOT persist it.

#### Scenario: Sparse risk flags with complete coverage

- **WHEN** the governed input has complete assignment, assessment, and knowledge-progress coverage and risk flags for a subset of students
- **THEN** the provider tool results SHALL carry explicit hit-semantics fields for the risk-flag aggregate
- **AND** the report SHALL NOT contain a limitation interpreting the risk-flag count as risk-evidence coverage.

#### Scenario: Model misreads hit count as coverage

- **WHEN** the provider returns a summary or limitation stating that risk data covers only the flagged students or an equivalent coverage ratio
- **THEN** the deterministic validation SHALL reject the output as a retryable model-behavior defect
- **AND** the report SHALL NOT be persisted while the misstatement remains.

#### Scenario: No fabricated zero-risk records

- **WHEN** a student has no current risk flag
- **THEN** the system SHALL NOT create a synthetic "no risk" record for that student
- **AND** the absence of a flag SHALL NOT be treated as missing evidence.
