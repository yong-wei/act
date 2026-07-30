# path-execution-error-display Specification

## Purpose

Define front-end error handling for path execution 409 failures so users see actionable error messages in the current operation area, without confusion from shared error states.

## ADDED Requirements

### Requirement: Path execution errors do not reuse the shared error state
The system SHALL use a dedicated `pathExecutionError` state instead of the shared page-level `error` state for all path-execution operations.

#### Scenario: Execute API returns 409
- **WHEN** `writePathNodeActivity` receives a 409 response from the execute API
- **THEN** the system SHALL set `pathExecutionError` to the server error message
- **AND** the shared `error` state SHALL remain unchanged
- **AND** the current-path module SHALL display the error message with heading "路径操作未能完成"

#### Scenario: Practice load fails does not affect path error
- **WHEN** the practice loading or submit flow fails
- **THEN** the system SHALL set the shared `error` state
- **AND** `pathExecutionError` SHALL remain unchanged
- **AND** the practice-resource module SHALL display the error, not the current-path module

### Requirement: Failed path execution errors are cleared on successful retry
Every path execution success branch SHALL clear `pathExecutionError`.

#### Scenario: Failed execute followed by successful launchPathNodeAction
- **WHEN** a path execution request first returns 409 and then a subsequent `launchPathNodeAction` succeeds
- **THEN** the system SHALL clear `pathExecutionError` after the successful response
- **AND** the error display in the current-path module SHALL disappear

#### Scenario: User refreshes path state from the error banner
- **WHEN** the user clicks "刷新路径状态" button
- **THEN** the system SHALL clear `pathExecutionError`
- **AND** it SHALL trigger `reloadActiveLearningPath()`

### Requirement: Current-path module shows path execution errors at the top
The error display SHALL be rendered inside the current-path module with the heading "路径操作未能完成" and a refresh button.

#### Scenario: Error banner is rendered
- **WHEN** `pathExecutionError` is non-null
- **THEN** the banner SHALL have `data-adaptive-path-execution-error="visible"`
- **AND** it SHALL contain a "刷新路径状态" button
- **AND** it SHALL NOT overlap or hide path node action buttons
