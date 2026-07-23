## ADDED Requirements

### Requirement: Arena bridge validates the persisted assigned level
The system SHALL create an Odyssey Arena bridge submission only when the persisted replay snapshot's level and persisted Arena task id are an explicit configured assignment pair. A newly created controlled Arena launch MUST persist its Arena-assigned marker with that pair. Existing replay snapshots without the marker remain eligible for bridge compatibility when their persisted task and level are a valid assignment pair.

#### Scenario: Newly created controlled session has a valid persisted assignment pair
- **WHEN** a persisted Odyssey replay snapshot contains the Arena-assigned marker and a level and Arena task id that map to one another
- **THEN** the official bridge MUST evaluate and submit that assigned task using the persisted level.

#### Scenario: Compatible historic assignment pair
- **WHEN** an existing persisted Odyssey replay snapshot has no Arena-assigned marker and its level and Arena task id map to one another
- **THEN** the official bridge MUST remain able to evaluate and submit that assigned task using the persisted level.

#### Scenario: Mismatched task and level
- **WHEN** a score submission or retry contains an Arena task id that does not match the persisted level assignment
- **THEN** the system MUST NOT create or recover an Arena bridge submission for that run.
