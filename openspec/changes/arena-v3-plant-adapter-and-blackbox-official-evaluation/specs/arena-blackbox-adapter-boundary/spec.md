## MODIFIED Requirements

### Requirement: Production black-box experiments use the persisted service path
Production Arena black-box experiment creation SHALL use a production PlantAdapter registry that delegates to the existing budgeted persisted experiment service and SHALL NOT create random dataset hashes outside that service.

#### Scenario: Public experiment creation
- **WHEN** a student runs a public black-box experiment from the production API
- **THEN** the request MUST resolve a production adapter through the Arena PlantAdapter registry
- **AND** the dataset MUST be created through the service that enforces user ownership, daily budget, persisted dataset payload, and deterministic dataset hash generation

#### Scenario: Random dataset generator
- **WHEN** a random cruise-roll dataset generator is still needed for tests
- **THEN** it MUST be named as a mock or test-only adapter
- **AND** it MUST NOT be exported as a production plant adapter
- **AND** production API routes MUST NOT import the mock adapter

#### Scenario: Unsupported adapter selection
- **WHEN** a production API receives a task/object combination without a supported adapter
- **THEN** it MUST reject the request before experiment or preview execution
- **AND** it MUST return a controlled input error rather than falling back to mock data

### Requirement: Black-box submission ownership remains enforced
Black-box official submissions SHALL continue to validate that the referenced dataset belongs to the submitting student and task.

#### Scenario: Foreign dataset hash
- **WHEN** a black-box artifact references a dataset hash not owned by the current student for the task
- **THEN** official submission creation MUST reject the artifact before evaluation or leaderboard insertion

#### Scenario: Registry-backed preview keeps ownership check
- **WHEN** a student requests a virtual simulation preview through a registry-backed adapter
- **THEN** the preview path MUST still verify the dataset hash belongs to the current student and task
- **AND** it MUST reject forged, missing, or cross-user datasets before storing a preview run
