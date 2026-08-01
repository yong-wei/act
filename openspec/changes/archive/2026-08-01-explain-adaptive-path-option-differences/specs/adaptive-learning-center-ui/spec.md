## ADDED Requirements

### Requirement: Path difference actions display the compared path facts
The adaptive learning center SHALL render the server-owned structured result of an “解释差异” action inside the selected option's decision module and SHALL identify both compared paths.

#### Scenario: Student explains a non-recommended option
- **WHEN** a student requests an explanation for an option that is not the recommended option
- **THEN** the page SHALL compare it with the recommended option and show both path names
- **AND** the result SHALL render common nodes, each option's unique nodes, order differences, metrics, trade-offs and limitations supplied by the server.

#### Scenario: Student explains the recommended option
- **WHEN** a student requests an explanation for the recommended option
- **THEN** the page SHALL compare it with the next ordered candidate option and show both path names.

#### Scenario: Candidate path set changes
- **WHEN** path generation or revision changes the active path id or the ordered candidate node identities
- **THEN** the page SHALL remove explanations from the previous candidate path set
- **AND** it SHALL NOT present a stale result as a comparison of the new options.

#### Scenario: Difference result is read on a narrow viewport
- **WHEN** the structured explanation is displayed at a 320px viewport width
- **THEN** path names, node lists, metric labels, values, units, trade-offs and limitations SHALL remain readable without page-level horizontal overflow.
