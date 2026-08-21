## ADDED Requirements

### Requirement: Candidate adjustment remains separate from path selection
The adaptive learning center SHALL treat adjustment as a request for a derived candidate batch and SHALL preserve the current active path until the learner explicitly selects a candidate through the existing path-choice workflow.

#### Scenario: Student opens adjustment for a candidate
- **WHEN** the student activates adjustment from a persisted candidate
- **THEN** the adjustment controls SHALL identify that candidate as the source and SHALL retain editable time, rhythm, resource, checkpoint, and supported intent parameters
- **AND** opening or submitting adjustment SHALL NOT change the active path.

#### Scenario: Adjusted candidates are returned
- **WHEN** an authorized material adjustment succeeds
- **THEN** the same learning-center workspace SHALL load and display the derived candidate batch for comparison
- **AND** the current-path continuation and execution state SHALL remain available and unchanged.

#### Scenario: Student selects an adjusted candidate
- **WHEN** the student explicitly selects a candidate from the derived batch
- **THEN** the center SHALL use the existing governed path-choice workflow before entering execution
- **AND** adjustment success alone SHALL NOT be presented as a selected or switched path.

### Requirement: Candidate adjustment states follow server truth
The adaptive learning center SHALL bind visible adjustment results to the current source batch, source candidate, request identity, and active-progress version and SHALL render server-owned degraded outcomes without fabricating alternatives.

#### Scenario: Adjustment has no material difference
- **WHEN** the server returns `no_material_difference`
- **THEN** the center SHALL keep the source candidates available and explain that the requested settings produced no substantive route change
- **AND** it SHALL offer parameter editing without displaying a duplicate successful option.

#### Scenario: An older adjustment completes late
- **WHEN** a newer request, candidate source, batch, or active-progress version is current before an older response completes
- **THEN** the center SHALL ignore the obsolete result
- **AND** it SHALL NOT replace the current comparison or execution state.

#### Scenario: Adjustment evidence is incomplete
- **WHEN** the server cannot resolve a stable source candidate or sufficient governed facts
- **THEN** the center SHALL show an unavailable or data-insufficient state
- **AND** it SHALL NOT infer a source from candidate order or synthesize a comparison result.
