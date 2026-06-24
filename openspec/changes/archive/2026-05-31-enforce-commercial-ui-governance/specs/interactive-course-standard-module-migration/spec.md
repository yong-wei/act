## ADDED Requirements

### Requirement: Commercial module chrome is gate-checked
The system SHALL gate migrated interactive lessons against unregistered module kinds and lesson-private module chrome.

#### Scenario: A migrated lesson uses private visual chrome
- **WHEN** a migrated interactive lesson module declares a custom visual skin, unregistered module kind, or lesson-private presentation component
- **THEN** the module registry gate SHALL fail unless a documented temporary migration exception exists
- **AND** the exception SHALL identify the owning migration issue and removal condition.
