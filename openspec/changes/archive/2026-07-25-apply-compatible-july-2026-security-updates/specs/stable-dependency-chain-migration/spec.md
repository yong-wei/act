## ADDED Requirements

### Requirement: Compatible security remediation is split at upstream blocker boundaries
The project SHALL permit a verified compatible security subset to merge
independently when unresolved dependency lanes require unavailable upstream
releases or separately scoped migrations.

#### Scenario: Compatible subset removes findings while another lane is blocked
- **WHEN** current-major dependency updates remove baseline findings, introduce no moderate-or-higher finding, and preserve every touched contract
- **THEN** those updates SHALL be delivered as an independently reviewable change
- **AND** unresolved production findings SHALL remain visible under a blocked parent change with native owner relationships
- **AND** the subset SHALL NOT add an exception that makes an unresolved production high finding appear governed.

#### Scenario: Resource producer has dependencies that application runtime does not need
- **WHEN** a build-time resource producer requires a vulnerable development dependency that is unnecessary for application installation or runtime
- **THEN** the producer SHALL use an isolated dependency project and lockfile
- **AND** application install, application build, and production image assembly SHALL consume only its produced resources
- **AND** the producer SHALL NOT execute as part of the application build.
