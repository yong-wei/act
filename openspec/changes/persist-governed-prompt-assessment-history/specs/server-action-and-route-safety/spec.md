## ADDED Requirements

### Requirement: User-scoped evaluation routes authenticate before learning-data access
The system SHALL require authenticated user identity before user-scoped prompt evaluation, consistency evaluation, or prompt-history routes evaluate, read, or persist learning data. Request-body and path user identities SHALL NOT select another user's protected scope.

#### Scenario: Evaluation route receives an unauthenticated request
- **WHEN** an unauthenticated caller invokes a prompt evaluation or consistency route
- **THEN** the route SHALL return an authentication failure before accessing assessment data

#### Scenario: History route receives a mismatched user identity
- **WHEN** an authenticated caller requests prompt history with a path user identity different from the session identity
- **THEN** the route SHALL reject the request before querying history
