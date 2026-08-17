## ADDED Requirements

### Requirement: Portfolio evidence is authenticated and user-scoped
The portfolio evidence read API MUST require an authenticated student session and MUST derive the owner from the session rather than from a request parameter.

#### Scenario: Unauthenticated request
- **WHEN** a request without an authenticated user calls `GET /api/profile/portfolio-evidence`
- **THEN** the API returns `401` and performs no evidence query

#### Scenario: Student cannot select another owner
- **WHEN** an authenticated student supplies a user identifier in the query string
- **THEN** the API ignores it and returns only evidence whose owner is the session user

### Requirement: Durable classroom submissions are projected
The portfolio evidence API MUST project the current student's durable classroom step responses into safe classroom-work summaries and MUST exclude teacher synchronization state and raw response payloads.

#### Scenario: Student has classroom submissions
- **WHEN** the student has one or more `StudentStepResponse` rows
- **THEN** the response marks the classroom source `available`, returns its total, and includes recent summaries with a title, type, timestamp, and safe content description

#### Scenario: Student has no classroom submissions
- **WHEN** the classroom query succeeds with no rows
- **THEN** the response marks the classroom source `empty` and returns an empty item list without inventing a work

### Requirement: Simulation logs are projected without raw run payloads
The portfolio evidence API MUST project the current student's simulation logs into recent design summaries containing only display-safe control parameters, score, mode, and timestamp.

#### Scenario: Student has simulation logs
- **WHEN** the student has persisted simulation logs
- **THEN** the response marks the simulation source `available`, returns its total, and excludes trajectory data and unfiltered input JSON

#### Scenario: Student has no simulation logs
- **WHEN** the simulation query succeeds with no rows
- **THEN** the response marks the simulation source `empty` and returns no placeholder design

### Requirement: Ethics records preserve remediation state
The portfolio evidence API MUST project the current student's ethical logs with violation description, remediation text when present, remediation state, and timestamp, without exposing records from other students.

#### Scenario: Unresolved and resolved cases coexist
- **WHEN** the student has both unresolved and resolved ethical logs
- **THEN** both cases are returned, each retains its own `isResolved` state, and only the resolved case exposes a non-empty remediation action when one exists

### Requirement: The UI distinguishes empty and unavailable evidence
The portfolio page MUST consume the portfolio evidence API and MUST render separate status copy for a successful empty source and an unavailable source.

#### Scenario: Evidence is available
- **WHEN** the API returns a source with `available` state and items
- **THEN** the corresponding portfolio tab renders those items instead of a hard-coded empty array

#### Scenario: Source is unavailable
- **WHEN** the API returns `unavailable` for a source
- **THEN** the corresponding tab states that the source could not be loaded and does not claim that the student has no records
