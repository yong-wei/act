## ADDED Requirements

### Requirement: Classic workbench manages session-scoped design snapshots
The classic four-view workbench SHALL allow a student to save a named design snapshot in the active browser session. A snapshot SHALL contain the object identity and every editable design and analysis setting that changes its four-view analysis result, together with a stable color, creation time, and visibility state.

#### Scenario: Student saves the current design
- **WHEN** a student saves the current classic four-view design as a snapshot
- **THEN** the workbench SHALL add a named snapshot with a stable color to the active session
- **AND** it SHALL preserve the object, controller or correction configuration, response type, and applicable analysis ranges used by that design.

#### Scenario: Current edits do not overwrite a snapshot
- **WHEN** a student changes the current object or controller after saving a snapshot
- **THEN** the saved snapshot parameters and its comparison result SHALL remain unchanged
- **AND** the current design SHALL continue to update its own analysis in real time.

#### Scenario: Session is restarted
- **WHEN** the browser session ends and a new session starts
- **THEN** the workbench SHALL NOT restore the previous session's snapshots
- **AND** it SHALL continue to operate with the existing single-design workflow.

### Requirement: Student can manage and restore snapshots
The classic four-view workbench SHALL allow a student to show, hide, rename, delete, and restore a saved snapshot. Restoring SHALL replace the current editable design with the snapshot's complete saved state without changing the saved snapshot itself.

#### Scenario: Student changes snapshot visibility
- **WHEN** a student hides or shows a saved snapshot
- **THEN** the snapshot's comparison curves SHALL be removed from or added to all supported comparison views
- **AND** the current editable design SHALL remain unchanged.

#### Scenario: Student restores a snapshot
- **WHEN** a student chooses to restore a saved snapshot
- **THEN** all classic four-view analyses for the current design SHALL use that snapshot's complete saved configuration
- **AND** the snapshot SHALL remain available for later comparison or restoration.

#### Scenario: Student deletes a snapshot
- **WHEN** a student deletes a saved snapshot
- **THEN** the snapshot and its comparison curves SHALL be removed from the active session
- **AND** the current editable design SHALL remain unchanged.

### Requirement: Snapshots do not participate in Arena submission
The workbench SHALL use only the current editable design for official Arena submission. Saved snapshots SHALL remain client-side comparison state and SHALL NOT alter Arena evaluation, ranking, or scoring inputs.

#### Scenario: Student submits after comparing snapshots
- **WHEN** a student submits from an Arena-bound classic workbench with one or more saved snapshots
- **THEN** the submitted artifact SHALL be built only from the current editable controller state
- **AND** no saved snapshot SHALL be included in the submission or official evaluation request.
