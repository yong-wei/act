## MODIFIED Requirements

### Requirement: Compatibility proof is revalidated under the selection transaction
Immediately before desired or active Runtime lifecycle mutation, the system SHALL re-open and canonical-hash the compatibility receipt and re-read the candidate manifest, current application image digest, embedded application revision, migration-set digest and consumer contract version. It SHALL select the candidate only when all receipt bindings match. On mismatch, missing proof, unreadable proof, or lifecycle drift, it SHALL fail before selector mutation and preserve the existing active and rollback identities. The activation journal and active receipt projection SHALL bind the exact proof SHA-256 used for that selection; crash recovery SHALL use that exact identity rather than inferring a proof from the Runtime identity alone. When a qualified daily activation retains the existing Runtime Release identity, it SHALL still atomically re-project the exact newly verified proof SHA-256 through the journaled transaction without changing the active Runtime identity or selection generation. The application-side active receipt reader SHALL accept a present compatibility projection only when it has the canonical `runtime-app-compatibility.v1` field set and valid proof, Runtime source revision, application revision, image-digest, migration-set and consumer-contract values; malformed or unknown receipt fields SHALL fail readiness. Public readiness SHALL continue to expose only the existing minimal active Runtime projection.

#### Scenario: Recovery follows an interrupted qualified selection
- **WHEN** a qualified lifecycle transition commits before its active receipt projection completes
- **THEN** recovery SHALL project the proof SHA-256 recorded by that transition
- **AND** it SHALL not select a different proof for the same Runtime manifest

#### Scenario: Application image changes after candidate qualification
- **WHEN** the running application image digest or embedded revision changes after a candidate compatibility receipt is written
- **THEN** the system SHALL reject selection under the old receipt before desired or active Runtime state changes

#### Scenario: Candidate manifest or migration state drifts
- **WHEN** the candidate manifest identity, migration-set digest or consumer contract differs from the compatibility receipt during selection
- **THEN** the system SHALL fail closed before selector mutation
- **AND** it SHALL retain the prior active and rollback Runtime identities

#### Scenario: Active receipt is inspected by public readiness
- **WHEN** a Runtime Release with a compatibility proof is active
- **THEN** the lifecycle receipt SHALL retain the compatibility receipt identity for audit and recovery
- **AND** public readiness SHALL continue to expose only the existing minimal active Runtime projection

#### Scenario: Same Runtime identity is requalified after application deployment
- **WHEN** the active Runtime manifest is newly qualified against a changed application image, revision, migration set, or consumer contract
- **THEN** the journaled transaction SHALL replace the active receipt compatibility projection with the newly verified proof
- **AND** it SHALL retain the active Runtime Release identity and selection generation

#### Scenario: Application reads a projected compatibility receipt
- **WHEN** a blob-backed Runtime manifest and matching active receipt include a valid compatibility projection
- **THEN** the application SHALL accept the receipt for readiness and media resolution
- **AND** it SHALL not expose compatibility fields in the public readiness projection

#### Scenario: Active receipt compatibility projection is malformed
- **WHEN** a blob-backed active receipt includes an unknown, missing, or invalid compatibility field
- **THEN** the application SHALL reject the active receipt and fail readiness
