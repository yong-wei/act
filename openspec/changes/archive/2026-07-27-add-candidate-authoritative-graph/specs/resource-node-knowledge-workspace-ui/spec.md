## ADDED Requirements

### Requirement: Knowledge workspace provides an explicit migration-period graph switch
The knowledge workspace SHALL let every currently authorized graph user switch between the candidate ActKG graph and the Legacy graph, defaulting to the candidate when available.

#### Scenario: Candidate ReleaseSet is available
- **WHEN** an authorized teacher or student opens the workspace
- **THEN** the workspace SHALL select the candidate view and provide a clearly labeled Legacy switch

#### Scenario: User changes version
- **WHEN** the user selects the other graph version
- **THEN** the workspace SHALL replace the graph and detail state from the selected independent API without merging nodes
