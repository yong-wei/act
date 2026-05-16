## ADDED Requirements

### Requirement: Production black-box experiments use the persisted service path
Production Arena black-box experiment creation SHALL use the existing budgeted persisted experiment service and SHALL NOT create random dataset hashes outside that service.

#### Scenario: Public experiment creation
- **WHEN** a student runs a public black-box experiment from the production API
- **THEN** the dataset MUST be created through the service that enforces user ownership, daily budget, persisted dataset payload, and deterministic dataset hash generation

#### Scenario: Random dataset generator
- **WHEN** a random cruise-roll dataset generator is still needed for tests
- **THEN** it MUST be named as a mock or test-only adapter and MUST NOT be exported as a production plant adapter

### Requirement: Black-box submission ownership remains enforced
Black-box official submissions SHALL continue to validate that the referenced dataset belongs to the submitting student and task.

#### Scenario: Foreign dataset hash
- **WHEN** a black-box artifact references a dataset hash not owned by the current student for the task
- **THEN** official submission creation MUST reject the artifact before evaluation or leaderboard insertion
