## ADDED Requirements

### Requirement: Foundation prerequisite increment is scope-bounded
The foundation teaching increment MUST limit its denominator and publication to explicitly selected core nodes in system modeling, time-domain analysis and stability analysis. Unselected Authority objects MUST remain outside the coverage denominator.

#### Scenario: Unselected foundation object exists
- **WHEN** the Authority contains a foundation-domain object not selected by an ACT objective, binding, prerequisite endpoint or curator
- **THEN** it SHALL remain not projected
- **AND** it SHALL not block publication of the reviewed increment
