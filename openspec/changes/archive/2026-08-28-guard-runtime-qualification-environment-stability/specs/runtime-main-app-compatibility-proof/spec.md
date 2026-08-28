## MODIFIED Requirements

### Requirement: Compatibility qualification uses the actual deployed consumer environment
The Runtime activator SHALL capture the application revision and image digest from the running application container and SHALL verify that the app and worker containers use the same deployed application image. It SHALL execute the declared structured-runtime, route, media, textbook-reader and hybrid-index consumers against the materialized candidate mount in that environment. The compatibility receipt SHALL be created only after all declared consumers pass and after the migration-set digest is captured from the deployed database state. It SHALL capture the application/image/migration identity before consumer smoke and require it to equal the identity captured into the proof after smoke; a mismatch SHALL fail before desired or active Runtime lifecycle mutation.

#### Scenario: Candidate consumer smoke succeeds in the current application container
- **WHEN** every declared candidate consumer reads the materialized Runtime view successfully in the current application container
- **THEN** the system SHALL record the consumer contract version and actual application/image/migration identities in the candidate compatibility receipt

#### Scenario: Application changes while candidate consumers run
- **WHEN** the application image, embedded revision, worker image consistency, or applied migration set changes after the pre-smoke identity capture and before proof capture
- **THEN** the system SHALL reject the candidate before desired or active Runtime selection changes
- **AND** it SHALL retain the prior active and rollback Runtime identities

#### Scenario: A declared candidate consumer fails
- **WHEN** any structured runtime, route, media, textbook-reader or hybrid-index consumer rejects the candidate view
- **THEN** the system SHALL not create a passing compatibility receipt
- **AND** the existing active and rollback Runtime identities SHALL remain unchanged
