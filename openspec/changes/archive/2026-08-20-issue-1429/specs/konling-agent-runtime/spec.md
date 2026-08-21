## MODIFIED Requirements

### Requirement: Konling exposes governed adaptive path tools
Konling SHALL expose scoped tools for adaptive learning path generation, revision, selection, rejection, explanation, and outcome recording. The explanation operation SHALL accept two explicitly identified options from the same authorized saved path and SHALL remain read-only.

#### Scenario: Konling explains an explicit candidate pair
- **WHEN** the path-advisor receives two different valid option identities for the current saved path
- **THEN** it SHALL return the server-owned structured comparison, normalized pair identity, and student-safe limitations
- **AND** it SHALL not mutate path selection, execution, recommendation, or candidate snapshots.

#### Scenario: Konling receives an invalid comparison pair
- **WHEN** the selected and compared option are the same, belong to different paths, or are outside the authorized candidate set
- **THEN** the tool SHALL reject the request with a governed validation outcome
- **AND** it SHALL not fall back to another option or infer a replacement pair.
