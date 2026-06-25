## ADDED Requirements

### Requirement: Learner state is enabled in production runtime
The Learner State Service SHALL be enabled in production app and worker runtimes.

#### Scenario: Production app starts
- **WHEN** the production app container is created
- **THEN** `ADAPTIVE_LEARNER_STATE_SERVICE_ENABLED` SHALL be set to `true`
- **AND** learner-state API and Konling runtime reads SHALL treat the service as available.

#### Scenario: Production worker starts
- **WHEN** the production worker container is created
- **THEN** it SHALL receive the same learner-state service flag as the app container
- **AND** background evidence or feature-cache tasks SHALL not run with a contradictory disabled learner-state assumption.

#### Scenario: Deployment examples are inspected
- **WHEN** operators inspect local and production environment examples
- **THEN** the examples SHALL document `ADAPTIVE_LEARNER_STATE_SERVICE_ENABLED=true` as the expected production value
- **AND** model-provider examples SHALL not imply that learner-state is optional for normal production Konling behavior.

### Requirement: Learner-state no-data states are explicit
The Learner State Service SHALL distinguish an unavailable service from an available service with sparse or missing learner data.

#### Scenario: New learner has no evidence
- **WHEN** learner-state is requested for a learner with no relevant evidence rows
- **THEN** the service SHALL return an explicit low-confidence or no-evidence state
- **AND** it SHALL NOT present missing evidence as a failed learner-state read.

#### Scenario: Learner has no active path
- **WHEN** learner-state is requested for a goal that has no active path for the learner
- **THEN** the service SHALL return an explicit no-active-path state
- **AND** consumers SHALL be able to distinguish it from path read failure.
