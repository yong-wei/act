## MODIFIED Requirements

### Requirement: Release inspection and rollback are evidence bound
The system SHALL expose inspection of a v1 or v2 release manifest and verification result without revealing credentials. Rollback SHALL select a previously verified immutable release and SHALL not overwrite or delete either release. A v2 host lifecycle record SHALL preserve a normalized rollback identity under the host lock until an explicit successful lifecycle transition retires it. Publication, runtime deployment and application deployment SHALL be independently invocable: a runtime-only operation SHALL not build or transfer an application image, export/import a database, run a Prisma migration, rewrite Nginx/systemd configuration or copy a complete runtime tree. A production application release SHALL freeze one complete `origin/main` revision and a distinct application release version before image build; a Runtime Release SHALL freeze one complete `origin/integration` revision and an independent Runtime Release identity. A Runtime selection SHALL require the matching verified runtime-app compatibility proof for the current deployed application image, rather than equality between the application and Runtime revisions.

#### Scenario: Operator requests a prior release
- **WHEN** a requested rollback release has a valid immutable manifest and passes remote verification
- **THEN** the selector SHALL create a new auditable selection generation for that release and preserve the prior active release as rollback until the transition is verified

#### Scenario: Operator requests an unverified release
- **WHEN** a requested release is absent, malformed, or fails remote verification
- **THEN** the selector SHALL leave the current active runtime and protected rollback identity unchanged

#### Scenario: Runtime source differs from the current application revision
- **WHEN** an independently frozen `origin/integration` Runtime candidate has a different revision from the current deployed `origin/main` application
- **THEN** the runtime-only workflow SHALL permit selection only after its matching compatibility proof passes
- **AND** it SHALL not rebuild, transfer, replace or roll back the application image

## ADDED Requirements

### Requirement: Legacy first-cutover tooling is not a daily Runtime deployment path
The system SHALL identify the historical first-cutover command that binds an application revision to the Runtime integration revision as migration-only tooling. The standard `deploy:runtime` path SHALL use the blob Runtime lifecycle and SHALL reject routing through that migration command for ordinary Runtime publication.

#### Scenario: Daily Runtime deployment is requested
- **WHEN** an operator invokes the standard Runtime deployment command for a new Runtime Release
- **THEN** the system SHALL use the v2 blob Runtime publication, compatibility qualification and lifecycle selection path
- **AND** it SHALL not derive the application image revision from the Runtime source revision

#### Scenario: A migration-only command is invoked without migration intent
- **WHEN** a caller attempts to use the first-cutover command as a daily Runtime deployment shortcut
- **THEN** the command SHALL fail before application-image or selector mutation and direct the caller to the standard Runtime path
