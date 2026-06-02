## MODIFIED Requirements

### Requirement: Commercial UI governance has advisory and blocking modes
The system SHALL support advisory and blocking governance modes for commercial UI rules so migrations can report legacy debt before strict enforcement begins.

#### Scenario: Governance runs during migration
- **WHEN** a commercial UI governance check runs while allowlisted legacy debt remains
- **THEN** advisory mode SHALL report the violation and owning migration reference
- **AND** blocking mode SHALL fail only new or unallowlisted violations according to the migration stage.

#### Scenario: Default test encounters commercial UI debt
- **WHEN** the default project test command includes commercial UI governance
- **THEN** any failure for `/` or another primary route SHALL be treated as real UI governance debt unless it has a narrow temporary exception
- **AND** dependency-upgrade work SHALL NOT classify that failure as package noise.
